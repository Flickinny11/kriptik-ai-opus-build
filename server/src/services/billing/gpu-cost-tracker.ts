/**
 * GPU Cost Tracker Service
 *
 * Comprehensive cost tracking for GPU operations including:
 * - RunPod training jobs
 * - Inference endpoints
 * - Volume storage
 * - HuggingFace Pro usage
 *
 * Provides real-time cost display, historical analytics, and budget alerts.
 */

import { db } from '../../db.js';
import {
    trainingJobs,
    deployedEndpoints,
    users,
    projects
} from '../../schema.js';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { nowSQLite } from '../../utils/dates.js';

// ============================================================================
// TYPES
// ============================================================================

export interface GPUUsageRecord {
    id: string;
    userId: string;
    projectId?: string;
    type: 'training' | 'inference' | 'storage' | 'api';
    provider: 'runpod' | 'huggingface';
    gpuType?: string;
    resourceId?: string;
    startTime: Date;
    endTime?: Date;
    durationSeconds?: number;
    costCents: number;
    details?: Record<string, unknown>;
}

export interface CostSummary {
    period: 'today' | 'week' | 'month' | 'all';
    totalCostCents: number;
    breakdown: {
        training: number;
        inference: number;
        storage: number;
        api: number;
    };
    byGPU: Record<string, number>;
    byProject: Record<string, number>;
}

export interface BudgetAlert {
    level: 'warning' | 'critical' | 'exceeded';
    threshold: number; // percentage
    currentSpend: number;
    budgetLimit: number;
    message: string;
}

export interface CostEstimate {
    estimatedCostCents: number;
    estimatedDurationMinutes: number;
    gpuType: string;
    pricePerHour: number;
    confidence: 'high' | 'medium' | 'low';
    breakdown: {
        compute: number;
        storage: number;
        bandwidth?: number;
    };
}

// ============================================================================
// GPU PRICING DATA (January 2026)
// ============================================================================

export const GPU_PRICING: Record<string, { pricePerHour: number; pricePerSecond: number; vram: number }> = {
    // Consumer GPUs
    'NVIDIA GeForce RTX 4090': { pricePerHour: 0.74, pricePerSecond: 0.000206, vram: 24 },
    'NVIDIA GeForce RTX 3090': { pricePerHour: 0.44, pricePerSecond: 0.000122, vram: 24 },
    'NVIDIA GeForce RTX 3090 Ti': { pricePerHour: 0.49, pricePerSecond: 0.000136, vram: 24 },
    'NVIDIA GeForce RTX 4080': { pricePerHour: 0.54, pricePerSecond: 0.000150, vram: 16 },

    // Professional GPUs
    'NVIDIA RTX A4000': { pricePerHour: 0.39, pricePerSecond: 0.000108, vram: 16 },
    'NVIDIA RTX A5000': { pricePerHour: 0.49, pricePerSecond: 0.000136, vram: 24 },
    'NVIDIA RTX A6000': { pricePerHour: 0.79, pricePerSecond: 0.000219, vram: 48 },
    'NVIDIA A40': { pricePerHour: 0.79, pricePerSecond: 0.000219, vram: 48 },
    'NVIDIA L40': { pricePerHour: 0.99, pricePerSecond: 0.000275, vram: 48 },
    'NVIDIA L40S': { pricePerHour: 1.14, pricePerSecond: 0.000317, vram: 48 },

    // Datacenter GPUs
    'NVIDIA A100-SXM4-40GB': { pricePerHour: 1.89, pricePerSecond: 0.000525, vram: 40 },
    'NVIDIA A100 80GB PCIe': { pricePerHour: 2.21, pricePerSecond: 0.000614, vram: 80 },
    'NVIDIA A100-SXM4-80GB': { pricePerHour: 2.49, pricePerSecond: 0.000692, vram: 80 },
    'NVIDIA H100 PCIe': { pricePerHour: 3.29, pricePerSecond: 0.000914, vram: 80 },
    'NVIDIA H100 SXM': { pricePerHour: 4.29, pricePerSecond: 0.001192, vram: 80 },

    // Storage pricing (per GB per hour)
    'STORAGE_VOLUME': { pricePerHour: 0.00015, pricePerSecond: 0.0000000417, vram: 0 },

    // Default/Unknown
    'DEFAULT': { pricePerHour: 0.50, pricePerSecond: 0.000139, vram: 16 },
};

// Budget thresholds
const BUDGET_THRESHOLDS = {
    warning: 0.80,   // 80%
    critical: 0.95,  // 95%
    exceeded: 1.00,  // 100%
};

// ============================================================================
// GPU COST TRACKER CLASS
// ============================================================================

export class GPUCostTracker {
    private activeJobs: Map<string, GPUUsageRecord> = new Map();
    private costUpdateCallbacks: Map<string, (cost: number) => void> = new Map();

    /**
     * Start tracking a GPU usage session
     */
    async startTracking(params: {
        userId: string;
        projectId?: string;
        type: GPUUsageRecord['type'];
        provider: GPUUsageRecord['provider'];
        gpuType?: string;
        resourceId?: string;
        details?: Record<string, unknown>;
    }): Promise<string> {
        const id = uuidv4();
        const record: GPUUsageRecord = {
            id,
            userId: params.userId,
            projectId: params.projectId,
            type: params.type,
            provider: params.provider,
            gpuType: params.gpuType,
            resourceId: params.resourceId,
            startTime: new Date(),
            costCents: 0,
            details: params.details,
        };

        this.activeJobs.set(id, record);
        return id;
    }

    /**
     * Update cost for an active tracking session
     */
    updateCost(trackingId: string, additionalCostCents: number): void {
        const record = this.activeJobs.get(trackingId);
        if (record) {
            record.costCents += additionalCostCents;

            // Notify listeners
            const callback = this.costUpdateCallbacks.get(trackingId);
            if (callback) {
                callback(record.costCents);
            }
        }
    }

    /**
     * Register a callback for cost updates
     */
    onCostUpdate(trackingId: string, callback: (costCents: number) => void): () => void {
        this.costUpdateCallbacks.set(trackingId, callback);
        return () => this.costUpdateCallbacks.delete(trackingId);
    }

    /**
     * Stop tracking and finalize the cost record
     */
    async stopTracking(trackingId: string): Promise<GPUUsageRecord | null> {
        const record = this.activeJobs.get(trackingId);
        if (!record) {
            return null;
        }

        record.endTime = new Date();
        record.durationSeconds = Math.floor((record.endTime.getTime() - record.startTime.getTime()) / 1000);

        // Calculate final cost based on actual duration if we have GPU pricing
        if (record.gpuType && GPU_PRICING[record.gpuType]) {
            const pricing = GPU_PRICING[record.gpuType];
            const hours = record.durationSeconds / 3600;
            record.costCents = Math.ceil(hours * pricing.pricePerHour * 100);
        }

        // Remove from active jobs
        this.activeJobs.delete(trackingId);
        this.costUpdateCallbacks.delete(trackingId);

        return record;
    }

    /**
     * Get real-time cost for active job
     */
    getActiveCost(trackingId: string): number {
        const record = this.activeJobs.get(trackingId);
        if (!record) return 0;

        if (record.gpuType && GPU_PRICING[record.gpuType]) {
            const pricing = GPU_PRICING[record.gpuType];
            const durationSeconds = (Date.now() - record.startTime.getTime()) / 1000;
            return Math.ceil((durationSeconds / 3600) * pricing.pricePerHour * 100);
        }

        return record.costCents;
    }

    /**
     * Estimate training cost
     */
    estimateTrainingCost(params: {
        modelSizeGB: number;
        datasetSizeGB: number;
        epochs: number;
        batchSize: number;
        gpuType: string;
        trainingType: 'lora' | 'qlora' | 'full';
    }): CostEstimate {
        const pricing = GPU_PRICING[params.gpuType] || GPU_PRICING['DEFAULT'];

        // Estimate based on model size, dataset, and training type
        let baseTimeMinutes: number;
        let storageGB: number;

        switch (params.trainingType) {
            case 'lora':
                baseTimeMinutes = params.modelSizeGB * 5 * params.epochs;
                storageGB = params.modelSizeGB * 0.1; // LoRA adapters are small
                break;
            case 'qlora':
                baseTimeMinutes = params.modelSizeGB * 7 * params.epochs;
                storageGB = params.modelSizeGB * 0.15;
                break;
            case 'full':
                baseTimeMinutes = params.modelSizeGB * 15 * params.epochs;
                storageGB = params.modelSizeGB * 2; // Full model + checkpoints
                break;
        }

        // Adjust for dataset size
        baseTimeMinutes *= Math.log2(Math.max(1, params.datasetSizeGB)) + 1;

        // Adjust for batch size (larger = faster but more VRAM)
        baseTimeMinutes /= Math.sqrt(params.batchSize / 4);

        const computeHours = baseTimeMinutes / 60;
        const computeCostCents = Math.ceil(computeHours * pricing.pricePerHour * 100);
        const storageCostCents = Math.ceil((storageGB * 0.00015 * baseTimeMinutes / 60) * 100);

        const totalCostCents = computeCostCents + storageCostCents;

        // Determine confidence based on how well we know this workload
        let confidence: 'high' | 'medium' | 'low' = 'medium';
        if (params.modelSizeGB < 10 && params.trainingType === 'lora') {
            confidence = 'high';
        } else if (params.modelSizeGB > 50 || params.trainingType === 'full') {
            confidence = 'low';
        }

        return {
            estimatedCostCents: totalCostCents,
            estimatedDurationMinutes: Math.ceil(baseTimeMinutes),
            gpuType: params.gpuType,
            pricePerHour: pricing.pricePerHour,
            confidence,
            breakdown: {
                compute: computeCostCents,
                storage: storageCostCents,
            },
        };
    }

    /**
     * Estimate inference endpoint cost
     */
    estimateInferenceCost(params: {
        gpuType: string;
        minWorkers: number;
        maxWorkers: number;
        estimatedRequestsPerHour: number;
        avgLatencyMs: number;
        hoursPerDay: number;
    }): CostEstimate {
        const pricing = GPU_PRICING[params.gpuType] || GPU_PRICING['DEFAULT'];

        // With serverless, we pay for actual compute time
        const avgWorkersActive = (params.minWorkers + params.maxWorkers) / 2;
        const computeTimeHours = params.hoursPerDay * avgWorkersActive;
        const computeCostCents = Math.ceil(computeTimeHours * pricing.pricePerHour * 100);

        return {
            estimatedCostCents: computeCostCents,
            estimatedDurationMinutes: Math.ceil(params.hoursPerDay * 60),
            gpuType: params.gpuType,
            pricePerHour: pricing.pricePerHour,
            confidence: 'medium',
            breakdown: {
                compute: computeCostCents,
                storage: 0,
            },
        };
    }

    /**
     * Get cost summary for a user
     */
    async getCostSummary(userId: string, period: CostSummary['period'] = 'month'): Promise<CostSummary> {
        let startDate: Date;
        const now = new Date();

        switch (period) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'all':
            default:
                startDate = new Date(0);
        }

        const startDateStr = startDate.toISOString();

        // Get training jobs - cost is stored in the config JSON
        const trainingJobsData = await db
            .select({
                config: trainingJobs.config,
                projectId: trainingJobs.projectId,
            })
            .from(trainingJobs)
            .where(and(
                eq(trainingJobs.userId, userId),
                gte(trainingJobs.createdAt, startDateStr)
            ));

        // Get endpoint costs
        const endpointCosts = await db
            .select({
                totalCost: sql<number>`COALESCE(SUM(${deployedEndpoints.costTotal}), 0)`,
                gpuType: deployedEndpoints.gpuType,
                projectId: deployedEndpoints.projectId,
            })
            .from(deployedEndpoints)
            .where(and(
                eq(deployedEndpoints.userId, userId),
                gte(deployedEndpoints.createdAt, startDateStr)
            ))
            .groupBy(deployedEndpoints.gpuType, deployedEndpoints.projectId);

        // Aggregate results
        const breakdown = {
            training: 0,
            inference: 0,
            storage: 0,
            api: 0,
        };
        const byGPU: Record<string, number> = {};
        const byProject: Record<string, number> = {};

        // Process training jobs (extract cost from config JSON)
        for (const job of trainingJobsData) {
            const config = job.config as { gpuType?: string; estimatedCostCents?: number } | null;
            const cost = config?.estimatedCostCents || 0;
            const gpuType = config?.gpuType || 'unknown';

            breakdown.training += cost;
            byGPU[gpuType] = (byGPU[gpuType] || 0) + cost;
            if (job.projectId) {
                byProject[job.projectId] = (byProject[job.projectId] || 0) + cost;
            }
        }

        for (const cost of endpointCosts) {
            breakdown.inference += cost.totalCost || 0;
            if (cost.gpuType) {
                byGPU[cost.gpuType] = (byGPU[cost.gpuType] || 0) + (cost.totalCost || 0);
            }
            if (cost.projectId) {
                byProject[cost.projectId] = (byProject[cost.projectId] || 0) + (cost.totalCost || 0);
            }
        }

        // Add active job costs
        for (const job of this.activeJobs.values()) {
            if (job.userId === userId) {
                const activeCost = this.getActiveCost(job.id);
                if (job.type === 'training') {
                    breakdown.training += activeCost;
                } else if (job.type === 'inference') {
                    breakdown.inference += activeCost;
                } else if (job.type === 'storage') {
                    breakdown.storage += activeCost;
                }
                if (job.gpuType) {
                    byGPU[job.gpuType] = (byGPU[job.gpuType] || 0) + activeCost;
                }
                if (job.projectId) {
                    byProject[job.projectId] = (byProject[job.projectId] || 0) + activeCost;
                }
            }
        }

        const totalCostCents = breakdown.training + breakdown.inference + breakdown.storage + breakdown.api;

        return {
            period,
            totalCostCents,
            breakdown,
            byGPU,
            byProject,
        };
    }

    /**
     * Check budget alerts
     */
    async checkBudgetAlerts(userId: string, budgetLimitCents: number): Promise<BudgetAlert | null> {
        const summary = await this.getCostSummary(userId, 'month');
        const currentSpend = summary.totalCostCents;
        const ratio = currentSpend / budgetLimitCents;

        if (ratio >= BUDGET_THRESHOLDS.exceeded) {
            return {
                level: 'exceeded',
                threshold: 100,
                currentSpend,
                budgetLimit: budgetLimitCents,
                message: `Budget exceeded. You've spent $${(currentSpend / 100).toFixed(2)} of your $${(budgetLimitCents / 100).toFixed(2)} limit.`,
            };
        } else if (ratio >= BUDGET_THRESHOLDS.critical) {
            return {
                level: 'critical',
                threshold: 95,
                currentSpend,
                budgetLimit: budgetLimitCents,
                message: `Critical: You've used 95% of your monthly GPU budget ($${(currentSpend / 100).toFixed(2)} / $${(budgetLimitCents / 100).toFixed(2)}).`,
            };
        } else if (ratio >= BUDGET_THRESHOLDS.warning) {
            return {
                level: 'warning',
                threshold: 80,
                currentSpend,
                budgetLimit: budgetLimitCents,
                message: `Warning: You've used 80% of your monthly GPU budget ($${(currentSpend / 100).toFixed(2)} / $${(budgetLimitCents / 100).toFixed(2)}).`,
            };
        }

        return null;
    }

    /**
     * Get cost history
     */
    async getCostHistory(userId: string, days: number = 30): Promise<Array<{
        date: string;
        training: number;
        inference: number;
        storage: number;
        total: number;
    }>> {
        const history: Array<{ date: string; training: number; inference: number; storage: number; total: number }> = [];
        const now = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().split('T')[0];
            const nextDateStr = new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            // Get training jobs for this day and extract cost from config
            const trainingJobsData = await db
                .select({
                    config: trainingJobs.config,
                })
                .from(trainingJobs)
                .where(and(
                    eq(trainingJobs.userId, userId),
                    gte(trainingJobs.createdAt, dateStr),
                    lte(trainingJobs.createdAt, nextDateStr)
                ));

            // Calculate total from config JSON
            const trainingTotal = trainingJobsData.reduce((sum, job) => {
                const config = job.config as { estimatedCostCents?: number } | null;
                return sum + (config?.estimatedCostCents || 0);
            }, 0);

            // Get endpoint costs for this day
            const endpointCosts = await db
                .select({
                    total: sql<number>`COALESCE(SUM(${deployedEndpoints.costToday}), 0)`,
                })
                .from(deployedEndpoints)
                .where(and(
                    eq(deployedEndpoints.userId, userId),
                    gte(deployedEndpoints.updatedAt, dateStr),
                    lte(deployedEndpoints.updatedAt, nextDateStr)
                ));

            const training = trainingTotal;
            const inference = endpointCosts[0]?.total || 0;
            const storage = 0; // Would calculate from volume usage

            history.push({
                date: dateStr,
                training,
                inference,
                storage,
                total: training + inference + storage,
            });
        }

        return history;
    }

    /**
     * Get GPU pricing info
     */
    getGPUPricing(gpuType?: string): typeof GPU_PRICING[string] | typeof GPU_PRICING {
        if (gpuType) {
            return GPU_PRICING[gpuType] || GPU_PRICING['DEFAULT'];
        }
        return GPU_PRICING;
    }

    /**
     * Format cost for display
     */
    formatCost(cents: number): string {
        return `$${(cents / 100).toFixed(2)}`;
    }

    /**
     * Format duration for display
     */
    formatDuration(seconds: number): string {
        if (seconds < 60) {
            return `${seconds}s`;
        } else if (seconds < 3600) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
        }
    }
}

// Singleton instance
let trackerInstance: GPUCostTracker | null = null;

export function getGPUCostTracker(): GPUCostTracker {
    if (!trackerInstance) {
        trackerInstance = new GPUCostTracker();
    }
    return trackerInstance;
}
