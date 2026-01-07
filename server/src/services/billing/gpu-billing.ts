/**
 * GPU Billing Service
 * 
 * Connects GPU cost tracking to credit deduction with margin calculation.
 * Handles:
 * - Pre-authorization of GPU usage before jobs start
 * - Real-time cost tracking during jobs
 * - Final billing with margin when jobs complete
 * - Integration with existing credit and usage systems
 */

import { getGPUCostTracker, GPU_PRICING } from './gpu-cost-tracker.js';
import { getCreditService } from './credits.js';
import { getCreditPoolService } from './credit-pool.js';
import { getUsageService } from './usage-service.js';
import { determineBillingContext, BillingContext, type BillingContextParams } from './billing-context.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface GPUBillingConfig {
    marginPercent: number;      // Default: 20%
    minimumChargeCents: number; // Default: 10 (10 cents)
    roundUpSeconds: number;     // Default: 60 (bill in 1-min increments)
}

const DEFAULT_CONFIG: GPUBillingConfig = {
    marginPercent: 20,
    minimumChargeCents: 10,
    roundUpSeconds: 60,
};

// ============================================================================
// TYPES
// ============================================================================

export interface GPUChargeResult {
    success: boolean;
    actualCostCents: number;
    chargedCents: number;
    creditsDeducted: number;
    remainingBalance: number;
    billingContext: BillingContext;
    error?: string;
}

export interface GPUAuthorizationResult {
    trackingId: string;
    estimatedCostCents: number;
    estimatedCredits: number;
    billingContext: BillingContext;
}

export interface ActiveJobCost {
    actualCostCents: number;
    chargedCents: number;
    estimatedCredits: number;
}

// ============================================================================
// GPU BILLING SERVICE CLASS
// ============================================================================

export class GPUBillingService {
    private config: GPUBillingConfig;
    private tracker = getGPUCostTracker();
    private creditService = getCreditService();
    private poolService = getCreditPoolService();
    private usageService = getUsageService();

    constructor(config: Partial<GPUBillingConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // ========================================================================
    // COST CALCULATION
    // ========================================================================

    /**
     * Calculate cost with margin for user billing
     */
    private calculateChargeWithMargin(actualCostCents: number): number {
        const withMargin = actualCostCents * (1 + this.config.marginPercent / 100);
        return Math.max(this.config.minimumChargeCents, Math.ceil(withMargin));
    }

    /**
     * Round up duration to billing increment (default: 1 minute)
     */
    private roundUpDuration(seconds: number): number {
        const increment = this.config.roundUpSeconds;
        return Math.ceil(seconds / increment) * increment;
    }

    /**
     * Convert cents to credits (100 credits = $1)
     */
    private centsToCredits(cents: number): number {
        return Math.ceil(cents); // 1 cent = 1 credit (100 credits = $1)
    }

    // ========================================================================
    // AUTHORIZATION
    // ========================================================================

    /**
     * Pre-authorize GPU usage before job starts
     * Returns tracking ID if authorized, throws if insufficient credits
     */
    async authorizeGPUUsage(params: {
        userId: string;
        projectId?: string;
        gpuType: string;
        estimatedDurationMinutes: number;
        operationType: 'training' | 'inference';
        isUserInitiated: boolean;
    }): Promise<GPUAuthorizationResult> {
        // Determine billing context
        const contextParams: BillingContextParams = {
            operationType: params.operationType,
            isUserInitiated: params.isUserInitiated,
            deploymentTarget: 'kriptik',
        };
        const decision = determineBillingContext(contextParams);

        // If KripTik is paying, just start tracking (no credit check)
        if (!decision.billUser) {
            const trackingId = await this.tracker.startTracking({
                userId: params.userId,
                projectId: params.projectId,
                type: params.operationType,
                provider: 'runpod',
                gpuType: params.gpuType,
                details: { billingContext: decision.context },
            });

            return {
                trackingId,
                estimatedCostCents: 0,
                estimatedCredits: 0,
                billingContext: decision.context,
            };
        }

        // Calculate estimated cost
        const pricing = GPU_PRICING[params.gpuType] || GPU_PRICING['DEFAULT'];
        const estimatedHours = params.estimatedDurationMinutes / 60;
        const estimatedCostCents = Math.ceil(estimatedHours * pricing.pricePerHour * 100);
        const chargeWithMargin = this.calculateChargeWithMargin(estimatedCostCents);
        const estimatedCredits = this.centsToCredits(chargeWithMargin);

        // Check if user has enough credits
        const hasCredits = await this.creditService.hasCredits(params.userId, estimatedCredits);
        if (!hasCredits) {
            const balance = await this.creditService.getCredits(params.userId);
            throw new Error(
                `Insufficient credits. Estimated cost: ${estimatedCredits} credits. ` +
                `Current balance: ${balance.balance} credits. ` +
                `Please add credits to continue.`
            );
        }

        // Start tracking
        const trackingId = await this.tracker.startTracking({
            userId: params.userId,
            projectId: params.projectId,
            type: params.operationType,
            provider: 'runpod',
            gpuType: params.gpuType,
            details: {
                billingContext: decision.context,
                estimatedCostCents,
                estimatedCredits,
            },
        });

        return {
            trackingId,
            estimatedCostCents,
            estimatedCredits,
            billingContext: decision.context,
        };
    }

    // ========================================================================
    // FINALIZATION
    // ========================================================================

    /**
     * Finalize GPU usage and charge user
     * Called when job completes or is cancelled
     */
    async finalizeGPUUsage(params: {
        trackingId: string;
        userId: string;
        projectId?: string;
        success: boolean;
        operationType: 'training' | 'inference';
        isUserInitiated: boolean;
    }): Promise<GPUChargeResult> {
        // Stop tracking and get final cost
        const record = await this.tracker.stopTracking(params.trackingId);

        if (!record) {
            return {
                success: false,
                actualCostCents: 0,
                chargedCents: 0,
                creditsDeducted: 0,
                remainingBalance: 0,
                billingContext: BillingContext.KRIPTIK_BUILDING,
                error: 'Tracking record not found',
            };
        }

        // Determine billing context
        const contextParams: BillingContextParams = {
            operationType: params.operationType,
            isUserInitiated: params.isUserInitiated,
            deploymentTarget: 'kriptik',
        };
        const decision = determineBillingContext(contextParams);

        // If KripTik is paying, record to pool but don't charge user
        if (!decision.billUser) {
            await this.poolService.deductApiCost(
                record.costCents,
                false, // Not free tier
                params.userId,
                {
                    model: 'gpu',
                    tokens: 0,
                    endpoint: record.gpuType || 'unknown',
                }
            );

            return {
                success: true,
                actualCostCents: record.costCents,
                chargedCents: 0,
                creditsDeducted: 0,
                remainingBalance: (await this.creditService.getCredits(params.userId)).balance,
                billingContext: decision.context,
            };
        }

        // Calculate charge with margin (round up duration first)
        const roundedDuration = record.durationSeconds
            ? this.roundUpDuration(record.durationSeconds)
            : 0;

        // Recalculate cost with rounded duration
        let finalCostCents = record.costCents;
        if (record.gpuType && GPU_PRICING[record.gpuType] && roundedDuration > 0) {
            const pricing = GPU_PRICING[record.gpuType];
            finalCostCents = Math.ceil((roundedDuration / 3600) * pricing.pricePerHour * 100);
        }

        const chargedCents = this.calculateChargeWithMargin(finalCostCents);
        const creditsToDeduct = this.centsToCredits(chargedCents);

        // Deduct credits from user
        const deductResult = await this.creditService.deductCredits(
            params.userId,
            creditsToDeduct,
            `GPU ${params.operationType}: ${record.gpuType || 'Unknown GPU'} for ${this.tracker.formatDuration(roundedDuration)}`,
            {
                trackingId: params.trackingId,
                gpuType: record.gpuType,
                durationSeconds: record.durationSeconds,
                actualCostCents: finalCostCents,
                chargedCents,
                billingContext: decision.context,
            }
        );

        if (!deductResult.success) {
            return {
                success: false,
                actualCostCents: finalCostCents,
                chargedCents,
                creditsDeducted: 0,
                remainingBalance: deductResult.newBalance,
                billingContext: decision.context,
                error: deductResult.error,
            };
        }

        // Record to usage service for analytics
        await this.usageService.recordUsage({
            userId: params.userId,
            projectId: params.projectId,
            category: params.operationType === 'training' ? 'deployment' : 'api_call',
            subcategory: `gpu_${params.operationType}`,
            creditsUsed: creditsToDeduct,
            metadata: {
                trackingId: params.trackingId,
                gpuType: record.gpuType,
                durationSeconds: record.durationSeconds,
                roundedDuration,
                actualCostCents: finalCostCents,
                chargedCents,
                marginPercent: this.config.marginPercent,
            },
        });

        // Record revenue to pool (only the margin portion is profit)
        const marginCents = chargedCents - finalCostCents;
        if (marginCents > 0) {
            await this.poolService.recordRevenue(marginCents, 'overage', params.userId);
        }

        return {
            success: true,
            actualCostCents: finalCostCents,
            chargedCents,
            creditsDeducted: creditsToDeduct,
            remainingBalance: deductResult.newBalance,
            billingContext: decision.context,
        };
    }

    // ========================================================================
    // REAL-TIME COST TRACKING
    // ========================================================================

    /**
     * Get real-time cost for active job (with margin)
     */
    getActiveJobCost(trackingId: string): ActiveJobCost {
        const actualCostCents = this.tracker.getActiveCost(trackingId);
        const chargedCents = this.calculateChargeWithMargin(actualCostCents);
        return {
            actualCostCents,
            chargedCents,
            estimatedCredits: this.centsToCredits(chargedCents),
        };
    }

    /**
     * Register callback for real-time cost updates
     */
    onCostUpdate(trackingId: string, callback: (cost: ActiveJobCost) => void): () => void {
        return this.tracker.onCostUpdate(trackingId, (costCents) => {
            callback({
                actualCostCents: costCents,
                chargedCents: this.calculateChargeWithMargin(costCents),
                estimatedCredits: this.centsToCredits(this.calculateChargeWithMargin(costCents)),
            });
        });
    }

    // ========================================================================
    // ESTIMATION
    // ========================================================================

    /**
     * Estimate cost for a training job before starting
     */
    estimateTrainingCost(params: {
        modelSizeGB: number;
        datasetSizeGB: number;
        epochs: number;
        batchSize: number;
        gpuType: string;
        trainingType: 'lora' | 'qlora' | 'full';
    }): {
        actualCostCents: number;
        chargedCents: number;
        estimatedCredits: number;
        estimatedDurationMinutes: number;
        breakdown: {
            compute: number;
            storage: number;
            margin: number;
        };
    } {
        const estimate = this.tracker.estimateTrainingCost(params);
        const chargedCents = this.calculateChargeWithMargin(estimate.estimatedCostCents);

        return {
            actualCostCents: estimate.estimatedCostCents,
            chargedCents,
            estimatedCredits: this.centsToCredits(chargedCents),
            estimatedDurationMinutes: estimate.estimatedDurationMinutes,
            breakdown: {
                compute: estimate.breakdown.compute,
                storage: estimate.breakdown.storage,
                margin: chargedCents - estimate.estimatedCostCents,
            },
        };
    }

    /**
     * Estimate cost for inference endpoint
     */
    estimateInferenceCost(params: {
        gpuType: string;
        minWorkers: number;
        maxWorkers: number;
        estimatedRequestsPerHour: number;
        avgLatencyMs: number;
        hoursPerDay: number;
    }): {
        actualCostCents: number;
        chargedCents: number;
        estimatedCredits: number;
        dailyCostCents: number;
        monthlyCostCents: number;
    } {
        const estimate = this.tracker.estimateInferenceCost(params);
        const chargedCents = this.calculateChargeWithMargin(estimate.estimatedCostCents);

        return {
            actualCostCents: estimate.estimatedCostCents,
            chargedCents,
            estimatedCredits: this.centsToCredits(chargedCents),
            dailyCostCents: chargedCents,
            monthlyCostCents: chargedCents * 30,
        };
    }

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    /**
     * Get current billing configuration
     */
    getConfig(): GPUBillingConfig {
        return { ...this.config };
    }

    /**
     * Update billing configuration
     */
    updateConfig(updates: Partial<GPUBillingConfig>): void {
        this.config = { ...this.config, ...updates };
    }

    /**
     * Get GPU pricing information
     */
    getGPUPricing(gpuType?: string): typeof GPU_PRICING[string] | typeof GPU_PRICING {
        return this.tracker.getGPUPricing(gpuType);
    }

    /**
     * Format cost for display
     */
    formatCost(cents: number): string {
        return this.tracker.formatCost(cents);
    }

    /**
     * Format duration for display
     */
    formatDuration(seconds: number): string {
        return this.tracker.formatDuration(seconds);
    }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: GPUBillingService | null = null;

export function getGPUBillingService(config?: Partial<GPUBillingConfig>): GPUBillingService {
    if (!instance) {
        instance = new GPUBillingService(config);
    }
    return instance;
}
