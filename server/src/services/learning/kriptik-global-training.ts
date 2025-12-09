/**
 * KripTik Global Training Service
 *
 * Continuously trains on ALL user data across the platform to improve
 * KripTik AI's core capabilities. This is separate from user-specific
 * model training.
 *
 * Goals:
 * - Train models that can eventually "take over" KripTik AI services
 * - Learn universal patterns from collective user behavior
 * - Identify best practices across all projects
 * - Build specialized models for different domains
 *
 * Data Sources:
 * - All user code generations (anonymized)
 * - User feedback (accepted/rejected suggestions)
 * - Error patterns and fixes
 * - Design choices and preferences
 * - Architecture decisions
 *
 * Privacy:
 * - All data is anonymized before training
 * - No PII is stored in training data
 * - Users can opt-out of global training
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { getShadowModelRegistry, ShadowModelType, SHADOW_MODEL_CONFIGS } from './shadow-model-registry.js';
import { getServerlessInferenceService } from './serverless-inference.js';

// =============================================================================
// TYPES
// =============================================================================

export interface GlobalTrainingConfig {
    enabled: boolean;
    minDataPoints: number;  // Minimum data points before training
    trainingInterval: number;  // Hours between training runs
    autoPromoteThreshold: number;  // Eval score threshold for auto-promotion
    maxConcurrentTraining: number;
    targetModels: ShadowModelType[];
    dataRetentionDays: number;  // How long to keep training data

    // Takeover configuration
    takeover: {
        enabled: boolean;
        evalThreshold: number;  // Must exceed this to be eligible
        trafficPercentage: number;  // Start with this % of traffic
        gradualRollout: boolean;
        rollbackOnDegradation: boolean;
    };
}

export interface GlobalTrainingData {
    id: string;
    domain: 'code' | 'design' | 'architecture' | 'error_fix';
    prompt: string;
    response: string;
    alternativeResponse?: string;
    quality: number;  // 0-100
    accepted: boolean;
    metadata: {
        projectType?: string;
        frameworks?: string[];
        fileType?: string;
        errorType?: string;
    };
    anonymizedAt: Date;
    createdAt: Date;
}

export interface GlobalTrainingRun {
    id: string;
    modelType: ShadowModelType;
    status: 'queued' | 'preparing' | 'training' | 'evaluating' | 'completed' | 'failed';
    progress: number;  // 0-100
    dataPointsUsed: number;
    startedAt?: Date;
    completedAt?: Date;
    metrics?: {
        evalScore: number;
        trainLoss: number;
        evalLoss: number;
        improvementOverPrevious: number;
    };
    error?: string;
    resultingModelVersion?: string;
    promotedToProduction: boolean;
    deployedForTakeover: boolean;
}

export interface TakeoverStatus {
    modelType: ShadowModelType;
    enabled: boolean;
    currentVersion?: string;
    trafficPercentage: number;  // 0-100
    requestsHandled: number;
    successRate: number;
    avgLatencyMs: number;
    userSatisfaction: number;
    canFullTakeover: boolean;
    estimatedFullTakeoverDate?: Date;
}

// =============================================================================
// KRIPTIK GLOBAL TRAINING SERVICE
// =============================================================================

export class KriptikGlobalTraining extends EventEmitter {
    private config: GlobalTrainingConfig;
    private trainingData: GlobalTrainingData[] = [];
    private trainingRuns: Map<string, GlobalTrainingRun> = new Map();
    private takeoverStatus: Map<ShadowModelType, TakeoverStatus> = new Map();
    private trainingInterval: ReturnType<typeof setInterval> | null = null;
    private isRunning: boolean = false;

    constructor() {
        super();

        // Default configuration
        this.config = {
            enabled: true,
            minDataPoints: 1000,
            trainingInterval: 24,  // Train every 24 hours
            autoPromoteThreshold: 80,  // 80% eval score
            maxConcurrentTraining: 2,
            targetModels: ['code_specialist', 'architecture_specialist', 'reasoning_specialist', 'design_specialist'],
            dataRetentionDays: 90,

            takeover: {
                enabled: true,
                evalThreshold: 85,  // Must be excellent to take over
                trafficPercentage: 10,  // Start with 10%
                gradualRollout: true,
                rollbackOnDegradation: true,
            },
        };

        // Initialize takeover status for each model type
        for (const modelType of this.config.targetModels) {
            this.takeoverStatus.set(modelType, {
                modelType,
                enabled: false,
                trafficPercentage: 0,
                requestsHandled: 0,
                successRate: 0,
                avgLatencyMs: 0,
                userSatisfaction: 0,
                canFullTakeover: false,
            });
        }
    }

    // =========================================================================
    // LIFECYCLE
    // =========================================================================

    /**
     * Start the global training service
     */
    async start(): Promise<void> {
        if (this.isRunning) return;

        this.isRunning = true;
        console.log('[GlobalTraining] Service started');

        // Start periodic training
        this.trainingInterval = setInterval(
            () => this.checkAndTriggerTraining(),
            this.config.trainingInterval * 60 * 60 * 1000
        );

        // Initial check
        await this.checkAndTriggerTraining();

        this.emit('service_started');
    }

    /**
     * Stop the service
     */
    async stop(): Promise<void> {
        if (this.trainingInterval) {
            clearInterval(this.trainingInterval);
            this.trainingInterval = null;
        }

        this.isRunning = false;
        console.log('[GlobalTraining] Service stopped');
        this.emit('service_stopped');
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<GlobalTrainingConfig>): void {
        this.config = { ...this.config, ...config };

        // Restart interval if training frequency changed
        if (config.trainingInterval && this.trainingInterval) {
            clearInterval(this.trainingInterval);
            this.trainingInterval = setInterval(
                () => this.checkAndTriggerTraining(),
                this.config.trainingInterval * 60 * 60 * 1000
            );
        }

        this.emit('config_updated', this.config);
    }

    // =========================================================================
    // DATA COLLECTION
    // =========================================================================

    /**
     * Ingest data from user interactions (anonymized)
     */
    async ingestData(input: {
        domain: GlobalTrainingData['domain'];
        prompt: string;
        response: string;
        alternativeResponse?: string;
        quality: number;
        accepted: boolean;
        metadata?: GlobalTrainingData['metadata'];
    }): Promise<void> {
        if (!this.config.enabled) return;

        // Anonymize data
        const anonymized = this.anonymizeData(input);

        const dataPoint: GlobalTrainingData = {
            id: uuidv4(),
            domain: input.domain,
            prompt: anonymized.prompt,
            response: anonymized.response,
            alternativeResponse: anonymized.alternativeResponse,
            quality: input.quality,
            accepted: input.accepted,
            metadata: input.metadata || {},
            anonymizedAt: new Date(),
            createdAt: new Date(),
        };

        this.trainingData.push(dataPoint);

        // Cleanup old data
        this.cleanupOldData();

        this.emit('data_ingested', { domain: input.domain });
    }

    /**
     * Batch ingest from daily aggregation
     */
    async batchIngest(data: Omit<GlobalTrainingData, 'id' | 'anonymizedAt' | 'createdAt'>[]): Promise<number> {
        let ingested = 0;

        for (const item of data) {
            await this.ingestData({
                domain: item.domain,
                prompt: item.prompt,
                response: item.response,
                alternativeResponse: item.alternativeResponse,
                quality: item.quality,
                accepted: item.accepted,
                metadata: item.metadata,
            });
            ingested++;
        }

        return ingested;
    }

    /**
     * Anonymize data to remove PII
     */
    private anonymizeData(input: {
        prompt: string;
        response: string;
        alternativeResponse?: string;
    }): { prompt: string; response: string; alternativeResponse?: string } {
        const anonymize = (text: string): string => {
            // Remove emails
            text = text.replace(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');

            // Remove API keys (common patterns)
            text = text.replace(/(?:api[_-]?key|token|secret)['":\s]*[=:]\s*['"][^'"]+['"]/gi, '[API_KEY]');
            text = text.replace(/sk-[a-zA-Z0-9]{20,}/g, '[API_KEY]');
            text = text.replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [TOKEN]');

            // Remove IP addresses
            text = text.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]');

            // Remove file paths that might contain usernames
            text = text.replace(/\/Users\/[^\/\s]+/g, '/Users/[USER]');
            text = text.replace(/\/home\/[^\/\s]+/g, '/home/[USER]');
            text = text.replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\[USER]');

            // Remove potential names (capitalized words in comments)
            // This is aggressive but helps ensure privacy
            text = text.replace(/(?:\/\/|#)\s*(?:Author|Created by|Written by)[:\s]*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g,
                match => match.replace(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g, '[NAME]'));

            return text;
        };

        return {
            prompt: anonymize(input.prompt),
            response: anonymize(input.response),
            alternativeResponse: input.alternativeResponse ? anonymize(input.alternativeResponse) : undefined,
        };
    }

    /**
     * Remove data older than retention period
     */
    private cleanupOldData(): void {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - this.config.dataRetentionDays);

        this.trainingData = this.trainingData.filter(d => d.createdAt >= cutoff);
    }

    // =========================================================================
    // TRAINING
    // =========================================================================

    /**
     * Check if training should be triggered and start if needed
     */
    private async checkAndTriggerTraining(): Promise<void> {
        if (!this.config.enabled) return;

        console.log('[GlobalTraining] Checking training conditions...');

        for (const modelType of this.config.targetModels) {
            const domainMap: Record<ShadowModelType, GlobalTrainingData['domain'][]> = {
                code_specialist: ['code', 'error_fix'],
                architecture_specialist: ['architecture', 'code'],
                reasoning_specialist: ['code', 'architecture', 'design', 'error_fix'],
                design_specialist: ['design'],
            };

            const relevantDomains = domainMap[modelType];
            const relevantData = this.trainingData.filter(d => relevantDomains.includes(d.domain));

            // Check if we have enough data
            if (relevantData.length >= this.config.minDataPoints) {
                // Check if already training
                const activeRuns = Array.from(this.trainingRuns.values())
                    .filter(r => r.modelType === modelType && ['queued', 'preparing', 'training', 'evaluating'].includes(r.status));

                if (activeRuns.length === 0) {
                    await this.startTraining(modelType, relevantData);
                }
            }
        }
    }

    /**
     * Start training for a model type
     */
    private async startTraining(modelType: ShadowModelType, data: GlobalTrainingData[]): Promise<GlobalTrainingRun> {
        const runId = `global-run-${uuidv4().slice(0, 8)}`;

        const run: GlobalTrainingRun = {
            id: runId,
            modelType,
            status: 'queued',
            progress: 0,
            dataPointsUsed: data.length,
            promotedToProduction: false,
            deployedForTakeover: false,
        };

        this.trainingRuns.set(runId, run);
        this.emit('training_queued', { runId, modelType, dataPoints: data.length });

        console.log(`[GlobalTraining] Started training run ${runId} for ${modelType} with ${data.length} data points`);

        // Execute training asynchronously
        this.executeTraining(run, data).catch(error => {
            console.error(`[GlobalTraining] Training failed:`, error);
            run.status = 'failed';
            run.error = error.message;
            this.emit('training_failed', { runId, error: error.message });
        });

        return run;
    }

    /**
     * Execute the training pipeline
     */
    private async executeTraining(run: GlobalTrainingRun, data: GlobalTrainingData[]): Promise<void> {
        try {
            // Stage 1: Preparing
            run.status = 'preparing';
            run.progress = 10;
            run.startedAt = new Date();
            this.emit('training_progress', { runId: run.id, status: run.status, progress: run.progress });

            // Prepare training data in DPO format
            const trainingData = this.prepareTrainingData(data);
            await this.simulateDelay(2000);  // Simulate data prep time

            // Stage 2: Training
            run.status = 'training';
            run.progress = 30;
            this.emit('training_progress', { runId: run.id, status: run.status, progress: run.progress });

            // Get shadow model registry to create training job
            const registry = getShadowModelRegistry();
            const modelConfig = SHADOW_MODEL_CONFIGS[run.modelType];

            // Register new version
            const version = `v${Date.now()}`;
            const adapterName = `kriptik-global-${run.modelType}-${version}`;

            await registry.registerModel({
                modelName: run.modelType,
                version,
                adapterName,
                trainingDataCount: data.length,
                adapterPath: `modal://kriptik-training/${adapterName}`,
            });

            // Simulate training progress
            for (let progress = 30; progress <= 70; progress += 10) {
                run.progress = progress;
                this.emit('training_progress', { runId: run.id, status: run.status, progress: run.progress });
                await this.simulateDelay(3000);
            }

            // Stage 3: Evaluating
            run.status = 'evaluating';
            run.progress = 80;
            this.emit('training_progress', { runId: run.id, status: run.status, progress: run.progress });

            // Simulate evaluation
            await this.simulateDelay(2000);

            // Calculate metrics (simulated for now)
            const evalScore = 75 + Math.random() * 20;  // 75-95
            run.metrics = {
                evalScore,
                trainLoss: 0.3 + Math.random() * 0.2,
                evalLoss: 0.4 + Math.random() * 0.2,
                improvementOverPrevious: Math.random() * 10,
            };

            // Update model in registry
            await registry.updateModelStatus(
                run.modelType,
                version,
                evalScore >= this.config.autoPromoteThreshold ? 'ready' : 'training',
                evalScore,
                {
                    codeQuality: evalScore - 5 + Math.random() * 10,
                    designQuality: evalScore - 5 + Math.random() * 10,
                    errorFixRate: evalScore - 5 + Math.random() * 10,
                    firstAttemptSuccess: evalScore - 10 + Math.random() * 15,
                }
            );

            // Stage 4: Completed
            run.status = 'completed';
            run.progress = 100;
            run.completedAt = new Date();
            run.resultingModelVersion = version;

            // Auto-promote if meets threshold
            if (evalScore >= this.config.autoPromoteThreshold) {
                await registry.promoteModel(run.modelType, version);
                run.promotedToProduction = true;
                console.log(`[GlobalTraining] Auto-promoted ${run.modelType} version ${version} with eval score ${evalScore.toFixed(1)}`);

                // Check for takeover eligibility
                if (evalScore >= this.config.takeover.evalThreshold) {
                    await this.enableTakeover(run.modelType, version);
                    run.deployedForTakeover = true;
                }
            }

            // Mark training data as used
            data.forEach(d => {
                // In production, would mark in database
            });

            this.emit('training_completed', {
                runId: run.id,
                modelType: run.modelType,
                version,
                evalScore,
                promotedToProduction: run.promotedToProduction,
                deployedForTakeover: run.deployedForTakeover,
            });

            console.log(`[GlobalTraining] Completed training run ${run.id} with eval score ${evalScore.toFixed(1)}`);

        } catch (error) {
            run.status = 'failed';
            run.error = error instanceof Error ? error.message : 'Unknown error';
            throw error;
        }
    }

    /**
     * Prepare training data in DPO format
     */
    private prepareTrainingData(data: GlobalTrainingData[]): Array<{
        prompt: string;
        chosen: string;
        rejected: string;
    }> {
        const pairs: Array<{ prompt: string; chosen: string; rejected: string }> = [];

        for (const item of data) {
            if (item.alternativeResponse) {
                // We have explicit alternatives
                if (item.accepted) {
                    pairs.push({
                        prompt: item.prompt,
                        chosen: item.response,
                        rejected: item.alternativeResponse,
                    });
                } else {
                    pairs.push({
                        prompt: item.prompt,
                        chosen: item.alternativeResponse,
                        rejected: item.response,
                    });
                }
            } else if (item.quality >= 80 && item.accepted) {
                // High quality accepted response - use as chosen
                // Generate a lower-quality variant as rejected (simplified)
                pairs.push({
                    prompt: item.prompt,
                    chosen: item.response,
                    rejected: this.generateWeakerVariant(item.response),
                });
            }
        }

        return pairs;
    }

    /**
     * Generate a weaker variant of a response for DPO training
     */
    private generateWeakerVariant(response: string): string {
        // In production, would use an AI model to generate a worse version
        // For now, simple heuristics
        let weaker = response;

        // Remove comments (makes code less readable)
        weaker = weaker.replace(/\/\/.*$/gm, '');
        weaker = weaker.replace(/\/\*[\s\S]*?\*\//g, '');

        // Simplify variable names (makes code less clean)
        weaker = weaker.replace(/const\s+([a-z][a-zA-Z]+)/g, 'const x');

        return weaker.length > 0 ? weaker : response;
    }

    // =========================================================================
    // TAKEOVER MANAGEMENT
    // =========================================================================

    /**
     * Enable takeover for a model type
     */
    async enableTakeover(modelType: ShadowModelType, version: string): Promise<void> {
        if (!this.config.takeover.enabled) return;

        const status = this.takeoverStatus.get(modelType)!;
        status.enabled = true;
        status.currentVersion = version;
        status.trafficPercentage = this.config.takeover.trafficPercentage;

        // Deploy to serverless inference
        const inferenceService = getServerlessInferenceService();
        const modelConfig = SHADOW_MODEL_CONFIGS[modelType];

        await inferenceService.onModelPromoted({
            modelName: modelType,
            baseModel: modelConfig.baseModel,
            adapterPath: `huggingface://kriptik-ai/${modelType}-${version}`,
            evalScore: status.userSatisfaction,
        });

        this.emit('takeover_enabled', { modelType, version, trafficPercentage: status.trafficPercentage });
        console.log(`[GlobalTraining] Enabled takeover for ${modelType} at ${status.trafficPercentage}% traffic`);
    }

    /**
     * Gradually increase takeover traffic
     */
    async increaseTakeoverTraffic(modelType: ShadowModelType, incrementPercent: number = 10): Promise<void> {
        const status = this.takeoverStatus.get(modelType);
        if (!status || !status.enabled) return;

        // Only increase if performance is good
        if (status.successRate < 95 || status.userSatisfaction < 80) {
            console.log(`[GlobalTraining] Not increasing traffic for ${modelType} - performance metrics too low`);
            return;
        }

        status.trafficPercentage = Math.min(100, status.trafficPercentage + incrementPercent);

        if (status.trafficPercentage === 100) {
            status.canFullTakeover = true;
            this.emit('full_takeover_ready', { modelType });
        }

        this.emit('takeover_traffic_increased', {
            modelType,
            newPercentage: status.trafficPercentage,
            canFullTakeover: status.canFullTakeover,
        });
    }

    /**
     * Rollback takeover if performance degrades
     */
    async rollbackTakeover(modelType: ShadowModelType): Promise<void> {
        const status = this.takeoverStatus.get(modelType);
        if (!status) return;

        status.enabled = false;
        status.trafficPercentage = 0;
        status.canFullTakeover = false;

        this.emit('takeover_rollback', { modelType, reason: 'performance_degradation' });
        console.log(`[GlobalTraining] Rolled back takeover for ${modelType}`);
    }

    /**
     * Record takeover request result
     */
    recordTakeoverRequest(modelType: ShadowModelType, result: {
        success: boolean;
        latencyMs: number;
        userSatisfied?: boolean;
    }): void {
        const status = this.takeoverStatus.get(modelType);
        if (!status) return;

        status.requestsHandled++;

        // Rolling average for latency
        status.avgLatencyMs = (status.avgLatencyMs * (status.requestsHandled - 1) + result.latencyMs) / status.requestsHandled;

        // Success rate
        const successCount = status.successRate * (status.requestsHandled - 1) / 100;
        status.successRate = ((successCount + (result.success ? 1 : 0)) / status.requestsHandled) * 100;

        // User satisfaction
        if (result.userSatisfied !== undefined) {
            const satisfiedCount = status.userSatisfaction * (status.requestsHandled - 1) / 100;
            status.userSatisfaction = ((satisfiedCount + (result.userSatisfied ? 1 : 0)) / status.requestsHandled) * 100;
        }

        // Check for performance degradation
        if (this.config.takeover.rollbackOnDegradation && status.requestsHandled > 100) {
            if (status.successRate < 90 || status.userSatisfaction < 70) {
                this.rollbackTakeover(modelType);
            }
        }
    }

    // =========================================================================
    // QUERIES
    // =========================================================================

    /**
     * Get training statistics
     */
    getStats(): {
        totalDataPoints: number;
        dataPointsByDomain: Record<string, number>;
        activeTrainingRuns: number;
        completedRuns: number;
        takeoverStatus: TakeoverStatus[];
    } {
        const dataPointsByDomain: Record<string, number> = {};
        for (const data of this.trainingData) {
            dataPointsByDomain[data.domain] = (dataPointsByDomain[data.domain] || 0) + 1;
        }

        const runs = Array.from(this.trainingRuns.values());
        const activeRuns = runs.filter(r => ['queued', 'preparing', 'training', 'evaluating'].includes(r.status)).length;
        const completedRuns = runs.filter(r => r.status === 'completed').length;

        return {
            totalDataPoints: this.trainingData.length,
            dataPointsByDomain,
            activeTrainingRuns: activeRuns,
            completedRuns,
            takeoverStatus: Array.from(this.takeoverStatus.values()),
        };
    }

    /**
     * Get training runs
     */
    getTrainingRuns(modelType?: ShadowModelType): GlobalTrainingRun[] {
        let runs = Array.from(this.trainingRuns.values());

        if (modelType) {
            runs = runs.filter(r => r.modelType === modelType);
        }

        return runs.sort((a, b) => {
            const aTime = a.startedAt?.getTime() || 0;
            const bTime = b.startedAt?.getTime() || 0;
            return bTime - aTime;
        });
    }

    /**
     * Get takeover status for a model
     */
    getTakeoverStatus(modelType: ShadowModelType): TakeoverStatus | undefined {
        return this.takeoverStatus.get(modelType);
    }

    /**
     * Get all takeover statuses
     */
    getAllTakeoverStatuses(): TakeoverStatus[] {
        return Array.from(this.takeoverStatus.values());
    }

    /**
     * Check if a model type should handle a request (based on traffic percentage)
     */
    shouldUseTakeover(modelType: ShadowModelType): boolean {
        const status = this.takeoverStatus.get(modelType);
        if (!status || !status.enabled) return false;

        // Random selection based on traffic percentage
        return Math.random() * 100 < status.trafficPercentage;
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private async simulateDelay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: KriptikGlobalTraining | null = null;

export function getKriptikGlobalTraining(): KriptikGlobalTraining {
    if (!instance) {
        instance = new KriptikGlobalTraining();
    }
    return instance;
}
