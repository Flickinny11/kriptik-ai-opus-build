/**
 * GPU Verification Service - PROMPT 7 Integration
 *
 * GPU-specific verification agents for the Build Loop:
 * 1. GPUEndpointChecker - Verify endpoint is healthy and responsive
 * 2. CostValidator - Ensure actual costs match estimates
 * 3. PerformanceValidator - Check latency/throughput requirements
 *
 * These agents are added to the Verification Swarm when a build
 * requires GPU resources (detected by GPU Resource Classifier).
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { deployedEndpoints, trainingJobs } from '../../schema.js';
import { eq } from 'drizzle-orm';
import { createRunPodProvider, RunPodProvider } from '../cloud/runpod.js';
import { getGPUCostTracker, GPUCostTracker } from '../billing/gpu-cost-tracker.js';
import type { IntentContract } from '../ai/intent-lock.js';
import type { GPURequirement } from '../ml/gpu-requirements.js';

// ============================================================================
// TYPES
// ============================================================================

export type GPUVerificationAgentType =
    | 'gpu_endpoint_checker'
    | 'cost_validator'
    | 'performance_validator';

export interface GPUVerificationResult {
    id: string;
    orchestrationRunId: string;
    agentType: GPUVerificationAgentType;
    passed: boolean;
    score?: number;
    issues: GPUVerificationIssue[];
    details: string;
    timestamp: Date;
    durationMs: number;
    metrics?: GPUMetrics;
}

export interface GPUVerificationIssue {
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: 'endpoint_health' | 'cost_overrun' | 'performance' | 'connectivity';
    description: string;
    endpointId?: string;
    suggestion?: string;
    autoFixable: boolean;
}

export interface GPUMetrics {
    // Endpoint health
    endpointStatus?: 'running' | 'deploying' | 'stopped' | 'failed';
    endpointLatencyMs?: number;
    endpointAvailable?: boolean;

    // Cost metrics
    estimatedCostCents?: number;
    actualCostCents?: number;
    costVariancePercent?: number;

    // Performance metrics
    requestLatencyMs?: number;
    throughputRps?: number;
    gpuUtilizationPercent?: number;
    vramUsagePercent?: number;
}

export interface GPUVerificationConfig {
    endpointCheckIntervalMs: number;
    costCheckIntervalMs: number;
    performanceCheckIntervalMs: number;
    maxLatencyMs: number;
    maxCostVariancePercent: number;
    minThroughputRps: number;
}

export interface CombinedGPUVerificationResult {
    orchestrationRunId: string;
    allPassed: boolean;
    overallScore: number;
    verdict: 'GPU_READY' | 'GPU_NEEDS_WORK' | 'GPU_BLOCKED' | 'GPU_FAILED';
    results: {
        endpointCheck: GPUVerificationResult | null;
        costValidation: GPUVerificationResult | null;
        performanceValidation: GPUVerificationResult | null;
    };
    blockers: string[];
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_GPU_VERIFICATION_CONFIG: GPUVerificationConfig = {
    endpointCheckIntervalMs: 10000,    // 10s for endpoint health
    costCheckIntervalMs: 30000,        // 30s for cost validation
    performanceCheckIntervalMs: 60000, // 60s for performance
    maxLatencyMs: 5000,                // 5s max latency
    maxCostVariancePercent: 20,        // 20% variance allowed
    minThroughputRps: 1,               // At least 1 req/s
};

// ============================================================================
// GPU VERIFICATION SERVICE
// ============================================================================

export class GPUVerificationService extends EventEmitter {
    private config: GPUVerificationConfig;
    private orchestrationRunId: string;
    private projectId: string;
    private userId: string;
    private runpodProvider: RunPodProvider | null = null;
    private costTracker: GPUCostTracker;
    private gpuRequirements: GPURequirement | null = null;
    private intervals: Map<GPUVerificationAgentType, NodeJS.Timeout> = new Map();
    private running: boolean = false;

    constructor(
        orchestrationRunId: string,
        projectId: string,
        userId: string,
        config: Partial<GPUVerificationConfig> = {},
    ) {
        super();
        this.orchestrationRunId = orchestrationRunId;
        this.projectId = projectId;
        this.userId = userId;
        this.config = { ...DEFAULT_GPU_VERIFICATION_CONFIG, ...config };
        this.costTracker = getGPUCostTracker();
    }

    /**
     * Initialize with RunPod credentials
     */
    async initialize(runpodApiKey: string): Promise<void> {
        this.runpodProvider = createRunPodProvider(runpodApiKey);
        const valid = await this.runpodProvider.validateCredentials();
        if (!valid) {
            throw new Error('Invalid RunPod API key');
        }
    }

    /**
     * Set GPU requirements from Intent Contract
     */
    setGPURequirements(requirements: GPURequirement): void {
        this.gpuRequirements = requirements;
    }

    /**
     * Start all GPU verification agents
     */
    start(): void {
        if (this.running) return;
        this.running = true;

        // Start endpoint checker
        this.intervals.set('gpu_endpoint_checker', setInterval(
            () => this.runEndpointCheck(),
            this.config.endpointCheckIntervalMs
        ));

        // Start cost validator
        this.intervals.set('cost_validator', setInterval(
            () => this.runCostValidation(),
            this.config.costCheckIntervalMs
        ));

        // Start performance validator
        this.intervals.set('performance_validator', setInterval(
            () => this.runPerformanceValidation(),
            this.config.performanceCheckIntervalMs
        ));

        this.emit('started', { timestamp: new Date() });
    }

    /**
     * Stop all GPU verification agents
     */
    stop(): void {
        if (!this.running) return;
        this.running = false;

        for (const [type, interval] of this.intervals) {
            clearInterval(interval);
            this.intervals.delete(type);
        }

        this.emit('stopped', { timestamp: new Date() });
    }

    // =========================================================================
    // VERIFICATION AGENTS
    // =========================================================================

    /**
     * Agent 1: GPU Endpoint Checker
     * Verifies endpoint is healthy and responsive
     */
    async runEndpointCheck(): Promise<GPUVerificationResult> {
        const startTime = Date.now();
        const issues: GPUVerificationIssue[] = [];
        let passed = true;
        let metrics: GPUMetrics = {};

        try {
            // Get deployed endpoints for this project
            const endpoints = await db
                .select()
                .from(deployedEndpoints)
                .where(eq(deployedEndpoints.projectId, this.projectId));

            if (endpoints.length === 0) {
                // No endpoints to check - might be expected
                return this.createResult('gpu_endpoint_checker', true, 100, [],
                    'No GPU endpoints deployed for this project', Date.now() - startTime, metrics);
            }

            for (const endpoint of endpoints) {
                metrics.endpointStatus = endpoint.status as GPUMetrics['endpointStatus'];

                // Check endpoint status
                if (endpoint.status === 'failed') {
                    issues.push({
                        severity: 'critical',
                        category: 'endpoint_health',
                        description: `Endpoint ${endpoint.modelName} is in failed state`,
                        endpointId: endpoint.id,
                        suggestion: 'Check RunPod logs and redeploy the endpoint',
                        autoFixable: false,
                    });
                    passed = false;
                } else if (endpoint.status === 'deploying') {
                    issues.push({
                        severity: 'medium',
                        category: 'endpoint_health',
                        description: `Endpoint ${endpoint.modelName} is still deploying`,
                        endpointId: endpoint.id,
                        suggestion: 'Wait for deployment to complete',
                        autoFixable: false,
                    });
                } else if (endpoint.status === 'stopped') {
                    issues.push({
                        severity: 'high',
                        category: 'endpoint_health',
                        description: `Endpoint ${endpoint.modelName} is stopped`,
                        endpointId: endpoint.id,
                        suggestion: 'Start the endpoint to enable inference',
                        autoFixable: true,
                    });
                    passed = false;
                }

                // Check connectivity if endpoint is running
                if (endpoint.status === 'running' && endpoint.endpointUrl) {
                    try {
                        const healthStart = Date.now();
                        const response = await fetch(endpoint.endpointUrl + '/health', {
                            method: 'GET',
                            signal: AbortSignal.timeout(5000),
                            credentials: 'omit',
                        });
                        const latency = Date.now() - healthStart;
                        metrics.endpointLatencyMs = latency;
                        metrics.endpointAvailable = response.ok;

                        if (!response.ok) {
                            issues.push({
                                severity: 'high',
                                category: 'connectivity',
                                description: `Endpoint ${endpoint.modelName} health check failed (${response.status})`,
                                endpointId: endpoint.id,
                                suggestion: 'Check endpoint logs for errors',
                                autoFixable: false,
                            });
                            passed = false;
                        } else if (latency > this.config.maxLatencyMs) {
                            issues.push({
                                severity: 'medium',
                                category: 'performance',
                                description: `Endpoint ${endpoint.modelName} latency (${latency}ms) exceeds threshold (${this.config.maxLatencyMs}ms)`,
                                endpointId: endpoint.id,
                                suggestion: 'Consider upgrading GPU or optimizing the model',
                                autoFixable: false,
                            });
                        }
                    } catch (error) {
                        issues.push({
                            severity: 'high',
                            category: 'connectivity',
                            description: `Cannot reach endpoint ${endpoint.modelName}: ${(error as Error).message}`,
                            endpointId: endpoint.id,
                            suggestion: 'Verify endpoint URL and network connectivity',
                            autoFixable: false,
                        });
                        passed = false;
                        metrics.endpointAvailable = false;
                    }
                }
            }

            const score = passed ? 100 : Math.max(0, 100 - (issues.length * 25));
            return this.createResult('gpu_endpoint_checker', passed, score, issues,
                passed ? 'All GPU endpoints healthy' : `${issues.length} endpoint issue(s) found`,
                Date.now() - startTime, metrics);

        } catch (error) {
            return this.createResult('gpu_endpoint_checker', false, 0, [{
                severity: 'critical',
                category: 'connectivity',
                description: `Endpoint verification failed: ${(error as Error).message}`,
                autoFixable: false,
            }], `Error during endpoint check: ${(error as Error).message}`, Date.now() - startTime, metrics);
        }
    }

    /**
     * Agent 2: Cost Validator
     * Ensures actual costs match estimates
     */
    async runCostValidation(): Promise<GPUVerificationResult> {
        const startTime = Date.now();
        const issues: GPUVerificationIssue[] = [];
        let passed = true;
        let metrics: GPUMetrics = {};

        try {
            // Get training jobs for this project
            const jobs = await db
                .select()
                .from(trainingJobs)
                .where(eq(trainingJobs.projectId, this.projectId));

            // Get deployed endpoints for this project
            const endpoints = await db
                .select()
                .from(deployedEndpoints)
                .where(eq(deployedEndpoints.projectId, this.projectId));

            let totalEstimatedCents = 0;
            let totalActualCents = 0;

            // Calculate training costs
            for (const job of jobs) {
                const config = job.config as { estimatedCostCents?: number } | null;
                const estimated = config?.estimatedCostCents || 0;
                totalEstimatedCents += estimated;
                // Actual cost would be tracked separately
            }

            // Calculate endpoint costs
            for (const endpoint of endpoints) {
                totalActualCents += endpoint.costTotal || 0;
            }

            metrics.estimatedCostCents = totalEstimatedCents;
            metrics.actualCostCents = totalActualCents;

            // Calculate variance
            if (totalEstimatedCents > 0) {
                const variance = ((totalActualCents - totalEstimatedCents) / totalEstimatedCents) * 100;
                metrics.costVariancePercent = variance;

                if (variance > this.config.maxCostVariancePercent) {
                    issues.push({
                        severity: 'high',
                        category: 'cost_overrun',
                        description: `Cost variance of ${variance.toFixed(1)}% exceeds threshold of ${this.config.maxCostVariancePercent}%`,
                        suggestion: 'Review GPU usage and consider optimizing batch sizes or using quantization',
                        autoFixable: false,
                    });
                    passed = false;
                }
            }

            // Check if any endpoint is accumulating unexpected costs
            for (const endpoint of endpoints) {
                if (endpoint.costToday && endpoint.costToday > 5000) { // $50+ today
                    issues.push({
                        severity: 'medium',
                        category: 'cost_overrun',
                        description: `Endpoint ${endpoint.modelName} has incurred $${(endpoint.costToday / 100).toFixed(2)} today`,
                        endpointId: endpoint.id,
                        suggestion: 'Consider scaling down or stopping the endpoint when not in use',
                        autoFixable: false,
                    });
                }
            }

            const score = passed ? 100 : Math.max(0, 100 - (issues.length * 20));
            return this.createResult('cost_validator', passed, score, issues,
                passed ? `Costs within expected range (variance: ${(metrics.costVariancePercent || 0).toFixed(1)}%)`
                      : `${issues.length} cost issue(s) found`,
                Date.now() - startTime, metrics);

        } catch (error) {
            return this.createResult('cost_validator', false, 0, [{
                severity: 'critical',
                category: 'cost_overrun',
                description: `Cost validation failed: ${(error as Error).message}`,
                autoFixable: false,
            }], `Error during cost validation: ${(error as Error).message}`, Date.now() - startTime, metrics);
        }
    }

    /**
     * Agent 3: Performance Validator
     * Checks latency/throughput requirements
     */
    async runPerformanceValidation(): Promise<GPUVerificationResult> {
        const startTime = Date.now();
        const issues: GPUVerificationIssue[] = [];
        let passed = true;
        let metrics: GPUMetrics = {};

        try {
            // Get running endpoints for this project
            const endpoints = await db
                .select()
                .from(deployedEndpoints)
                .where(eq(deployedEndpoints.projectId, this.projectId));

            const runningEndpoints = endpoints.filter(e => e.status === 'running');

            if (runningEndpoints.length === 0) {
                return this.createResult('performance_validator', true, 100, [],
                    'No running GPU endpoints to validate', Date.now() - startTime, metrics);
            }

            for (const endpoint of runningEndpoints) {
                // Check average latency
                if (endpoint.avgLatencyMs && endpoint.avgLatencyMs > this.config.maxLatencyMs) {
                    issues.push({
                        severity: 'high',
                        category: 'performance',
                        description: `Endpoint ${endpoint.modelName} average latency (${endpoint.avgLatencyMs}ms) exceeds threshold (${this.config.maxLatencyMs}ms)`,
                        endpointId: endpoint.id,
                        suggestion: 'Consider upgrading to a faster GPU or enabling request batching',
                        autoFixable: false,
                    });
                    passed = false;
                }
                metrics.requestLatencyMs = endpoint.avgLatencyMs || undefined;

                // Check throughput (estimated from request count)
                if (endpoint.totalRequests !== undefined && endpoint.totalRequests !== null) {
                    // Calculate approximate throughput based on lifetime
                    const lifetimeHours = (Date.now() - new Date(endpoint.createdAt).getTime()) / (1000 * 60 * 60);
                    if (lifetimeHours > 1) {
                        const approxRps = endpoint.totalRequests / (lifetimeHours * 3600);
                        metrics.throughputRps = approxRps;
                    }
                }

                // Check GPU requirements match if we have them
                if (this.gpuRequirements && endpoint.gpuType) {
                    const endpointVram = this.getVramForGpuType(endpoint.gpuType);
                    if (endpointVram < this.gpuRequirements.minVRAM) {
                        issues.push({
                            severity: 'medium',
                            category: 'performance',
                            description: `Endpoint GPU (${endpoint.gpuType}, ${endpointVram}GB VRAM) may be insufficient for model requirements (${this.gpuRequirements.minVRAM}GB minimum)`,
                            endpointId: endpoint.id,
                            suggestion: 'Consider deploying with a higher VRAM GPU',
                            autoFixable: false,
                        });
                    }
                }
            }

            const score = passed ? 100 : Math.max(0, 100 - (issues.length * 25));
            return this.createResult('performance_validator', passed, score, issues,
                passed ? 'All GPU endpoints meeting performance requirements'
                      : `${issues.length} performance issue(s) found`,
                Date.now() - startTime, metrics);

        } catch (error) {
            return this.createResult('performance_validator', false, 0, [{
                severity: 'critical',
                category: 'performance',
                description: `Performance validation failed: ${(error as Error).message}`,
                autoFixable: false,
            }], `Error during performance validation: ${(error as Error).message}`, Date.now() - startTime, metrics);
        }
    }

    // =========================================================================
    // COMBINED VERIFICATION
    // =========================================================================

    /**
     * Run all GPU verification agents and return combined result
     */
    async runFullVerification(): Promise<CombinedGPUVerificationResult> {
        const [endpointCheck, costValidation, performanceValidation] = await Promise.all([
            this.runEndpointCheck(),
            this.runCostValidation(),
            this.runPerformanceValidation(),
        ]);

        const allPassed = endpointCheck.passed && costValidation.passed && performanceValidation.passed;
        const scores = [endpointCheck.score || 0, costValidation.score || 0, performanceValidation.score || 0];
        const overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;

        const blockers: string[] = [];
        if (!endpointCheck.passed) {
            blockers.push(...endpointCheck.issues.filter(i => i.severity === 'critical').map(i => i.description));
        }
        if (!costValidation.passed) {
            blockers.push(...costValidation.issues.filter(i => i.severity === 'critical').map(i => i.description));
        }
        if (!performanceValidation.passed) {
            blockers.push(...performanceValidation.issues.filter(i => i.severity === 'critical').map(i => i.description));
        }

        let verdict: CombinedGPUVerificationResult['verdict'];
        if (allPassed) {
            verdict = 'GPU_READY';
        } else if (blockers.length > 0) {
            verdict = 'GPU_BLOCKED';
        } else if (overallScore < 50) {
            verdict = 'GPU_FAILED';
        } else {
            verdict = 'GPU_NEEDS_WORK';
        }

        const result: CombinedGPUVerificationResult = {
            orchestrationRunId: this.orchestrationRunId,
            allPassed,
            overallScore,
            verdict,
            results: {
                endpointCheck,
                costValidation,
                performanceValidation,
            },
            blockers,
        };

        this.emit('verification_complete', result);
        return result;
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private createResult(
        agentType: GPUVerificationAgentType,
        passed: boolean,
        score: number,
        issues: GPUVerificationIssue[],
        details: string,
        durationMs: number,
        metrics: GPUMetrics,
    ): GPUVerificationResult {
        const result: GPUVerificationResult = {
            id: uuidv4(),
            orchestrationRunId: this.orchestrationRunId,
            agentType,
            passed,
            score,
            issues,
            details,
            timestamp: new Date(),
            durationMs,
            metrics,
        };

        this.emit('verification_result', result);
        return result;
    }

    private getVramForGpuType(gpuType: string): number {
        const vramMap: Record<string, number> = {
            'NVIDIA GeForce RTX 4090': 24,
            'NVIDIA GeForce RTX 3090': 24,
            'NVIDIA RTX A4000': 16,
            'NVIDIA RTX A5000': 24,
            'NVIDIA RTX A6000': 48,
            'NVIDIA A40': 48,
            'NVIDIA L40': 48,
            'NVIDIA A100-SXM4-40GB': 40,
            'NVIDIA A100 80GB PCIe': 80,
            'NVIDIA H100 PCIe': 80,
        };
        return vramMap[gpuType] || 16;
    }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createGPUVerificationService(
    orchestrationRunId: string,
    projectId: string,
    userId: string,
    config?: Partial<GPUVerificationConfig>,
): GPUVerificationService {
    return new GPUVerificationService(orchestrationRunId, projectId, userId, config);
}
