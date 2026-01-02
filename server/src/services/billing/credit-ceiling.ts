/**
 * Credit Ceiling Service
 *
 * User-controlled credit spending limits with intelligent warnings and estimation.
 *
 * Features:
 * - Dynamic user-controlled ceiling (no hard limits)
 * - Real-time usage tracking against ceiling
 * - Estimated credits to completion
 * - Multi-threshold warnings (75%, 90%, 100%)
 * - Pause mechanism when ceiling reached
 * - Easy ceiling adjustment during builds
 * - Links to add funds when needed
 */

import { db } from '../../db.js';
import { users, buildIntents, featureProgress } from '../../schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { getUsageService } from './usage-service.js';
import { getCreditService } from './credits.js';
import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export interface CreditCeilingSettings {
    userId: string;
    ceiling: number | null; // null = unlimited
    currentUsage: number;
    remainingCredits: number;
    percentUsed: number;
    status: 'ok' | 'warning' | 'critical' | 'exceeded';
    estimatedToComplete?: number;
    canProceed: boolean;
}

export interface CeilingWarning {
    threshold: number; // 75, 90, 100
    currentUsage: number;
    ceiling: number;
    percentUsed: number;
    estimatedToComplete?: number;
    remainingCredits: number;
    message: string;
    suggestedActions: SuggestedAction[];
}

export interface SuggestedAction {
    type: 'adjust_ceiling' | 'add_funds' | 'pause_build' | 'continue';
    label: string;
    value?: number; // For adjust_ceiling, the new ceiling amount
    url?: string; // For add_funds, the checkout URL
}

export interface CeilingCheckResult {
    allowed: boolean;
    warning?: CeilingWarning;
    shouldPause: boolean;
    reason?: string;
}

export interface TaskProgressEstimate {
    totalFeatures: number;
    completedFeatures: number;
    percentComplete: number;
    averageCreditsPerFeature: number;
    estimatedRemainingCredits: number;
}

// ============================================================================
// CREDIT CEILING SERVICE
// ============================================================================

export class CreditCeilingService extends EventEmitter {
    private warningThresholds = [75, 90, 100]; // Percentage thresholds
    private estimationCache = new Map<string, TaskProgressEstimate>();

    /**
     * Get user's ceiling settings and current status
     */
    async getCeilingStatus(userId: string, buildId?: string): Promise<CreditCeilingSettings> {
        // Get user's ceiling setting
        const [user] = await db
            .select({
                ceiling: users.creditCeiling,
                credits: users.credits,
            })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            throw new Error('User not found');
        }

        const ceiling = user.ceiling;

        // If no ceiling set, return unlimited status
        if (ceiling === null || ceiling === 0) {
            return {
                userId,
                ceiling: null,
                currentUsage: 0,
                remainingCredits: user.credits || 0,
                percentUsed: 0,
                status: 'ok',
                canProceed: true,
            };
        }

        // Get current usage from usage service
        const usageService = getUsageService();
        const monthlyUsage = await usageService.getMonthlyUsage(userId);
        const currentUsage = monthlyUsage.totalCredits || 0;

        // Calculate status
        const remainingCredits = Math.max(0, ceiling - currentUsage);
        const percentUsed = (currentUsage / ceiling) * 100;

        let status: 'ok' | 'warning' | 'critical' | 'exceeded';
        if (percentUsed >= 100) {
            status = 'exceeded';
        } else if (percentUsed >= 90) {
            status = 'critical';
        } else if (percentUsed >= 75) {
            status = 'warning';
        } else {
            status = 'ok';
        }

        // Estimate credits to complete if buildId provided
        let estimatedToComplete: number | undefined;
        if (buildId) {
            estimatedToComplete = await this.estimateCreditsToComplete(userId, buildId);
        }

        return {
            userId,
            ceiling,
            currentUsage,
            remainingCredits,
            percentUsed,
            status,
            estimatedToComplete,
            canProceed: remainingCredits > 0 || ceiling === null,
        };
    }

    /**
     * Set user's credit ceiling
     */
    async setCeiling(userId: string, ceiling: number | null): Promise<CreditCeilingSettings> {
        // Validate ceiling
        if (ceiling !== null && ceiling < 0) {
            throw new Error('Ceiling must be a positive number or null for unlimited');
        }

        // Update user's ceiling
        await db
            .update(users)
            .set({
                creditCeiling: ceiling,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(users.id, userId));

        // Return updated status
        return this.getCeilingStatus(userId);
    }

    /**
     * Check if operation can proceed given current ceiling
     */
    async checkCeiling(
        userId: string,
        estimatedCost: number,
        buildId?: string
    ): Promise<CeilingCheckResult> {
        const status = await this.getCeilingStatus(userId, buildId);

        // No ceiling = always allowed
        if (status.ceiling === null) {
            return {
                allowed: true,
                shouldPause: false,
            };
        }

        // Check if adding estimated cost would exceed ceiling
        const projectedUsage = status.currentUsage + estimatedCost;
        const projectedPercent = (projectedUsage / status.ceiling) * 100;

        // Already exceeded
        if (status.percentUsed >= 100) {
            return {
                allowed: false,
                shouldPause: true,
                reason: 'Credit ceiling exceeded',
                warning: this.createWarning(status, buildId),
            };
        }

        // Would exceed with this operation
        if (projectedPercent >= 100) {
            return {
                allowed: false,
                shouldPause: true,
                reason: 'This operation would exceed credit ceiling',
                warning: this.createWarning(status, buildId),
            };
        }

        // Check if we should warn
        const shouldWarn = this.warningThresholds.some(
            threshold => status.percentUsed >= threshold && status.percentUsed < 100
        );

        if (shouldWarn) {
            return {
                allowed: true,
                shouldPause: false,
                warning: this.createWarning(status, buildId),
            };
        }

        return {
            allowed: true,
            shouldPause: false,
        };
    }

    /**
     * Estimate credits needed to complete current task
     */
    private async estimateCreditsToComplete(userId: string, buildId: string): Promise<number> {
        // Check cache first
        const cached = this.estimationCache.get(buildId);
        if (cached && Date.now() - (cached as any).timestamp < 60000) {
            return cached.estimatedRemainingCredits;
        }

        try {
            // Get build progress
            const progressRecords = await db
                .select()
                .from(featureProgress)
                .where(eq(featureProgress.buildIntentId, buildId));

            if (progressRecords.length === 0) {
                // No progress data, use default estimate
                return 100; // Conservative estimate
            }

            const totalFeatures = progressRecords.length;
            const completedFeatures = progressRecords.filter(p => p.passes).length;
            const percentComplete = totalFeatures > 0 ? (completedFeatures / totalFeatures) * 100 : 0;

            // Get actual usage for this build
            const usageService = getUsageService();
            const recentRecords = await usageService.getRecentRecords(userId, 100);

            // Calculate average credits per completed feature
            let totalCreditsUsed = 0;
            for (const record of recentRecords) {
                if (record.category === 'generation') {
                    totalCreditsUsed += record.creditsUsed;
                }
            }

            const averageCreditsPerFeature = completedFeatures > 0
                ? totalCreditsUsed / completedFeatures
                : 20; // Default estimate

            const remainingFeatures = totalFeatures - completedFeatures;
            const estimatedRemainingCredits = Math.ceil(remainingFeatures * averageCreditsPerFeature);

            // Cache the estimate
            const estimate: TaskProgressEstimate = {
                totalFeatures,
                completedFeatures,
                percentComplete,
                averageCreditsPerFeature,
                estimatedRemainingCredits,
            };
            this.estimationCache.set(buildId, estimate);

            return estimatedRemainingCredits;
        } catch (error) {
            console.error('Error estimating credits to complete:', error);
            return 100; // Conservative fallback
        }
    }

    /**
     * Create warning object with suggested actions
     */
    private createWarning(
        status: CreditCeilingSettings,
        buildId?: string
    ): CeilingWarning {
        const threshold = status.percentUsed >= 100 ? 100 :
                         status.percentUsed >= 90 ? 90 : 75;

        const suggestedActions: SuggestedAction[] = [];

        // Suggest ceiling adjustments
        if (status.ceiling !== null) {
            const currentCeiling = status.ceiling;
            suggestedActions.push(
                {
                    type: 'adjust_ceiling',
                    label: `+$10 (${currentCeiling + 1000} credits)`,
                    value: currentCeiling + 1000,
                },
                {
                    type: 'adjust_ceiling',
                    label: `+$25 (${currentCeiling + 2500} credits)`,
                    value: currentCeiling + 2500,
                },
                {
                    type: 'adjust_ceiling',
                    label: `+$50 (${currentCeiling + 5000} credits)`,
                    value: currentCeiling + 5000,
                },
                {
                    type: 'adjust_ceiling',
                    label: 'Unlimited',
                    value: 0,
                }
            );
        }

        // Check if user needs to add funds
        const creditService = getCreditService();
        const userCredits = status.remainingCredits;
        const estimatedNeeded = status.estimatedToComplete || 0;

        if (userCredits < estimatedNeeded) {
            const creditsNeeded = estimatedNeeded - userCredits;
            const dollarsNeeded = Math.ceil(creditsNeeded / 100);

            suggestedActions.push({
                type: 'add_funds',
                label: `Add $${dollarsNeeded} to complete`,
                url: '/dashboard?action=topup',
            });
        }

        // Pause option
        if (threshold === 100) {
            suggestedActions.push({
                type: 'pause_build',
                label: 'Pause build',
            });
        } else {
            suggestedActions.push({
                type: 'continue',
                label: 'Continue for now',
            });
        }

        const message = this.getWarningMessage(status, threshold);

        return {
            threshold,
            currentUsage: status.currentUsage,
            ceiling: status.ceiling!,
            percentUsed: status.percentUsed,
            estimatedToComplete: status.estimatedToComplete,
            remainingCredits: status.remainingCredits,
            message,
            suggestedActions,
        };
    }

    /**
     * Generate appropriate warning message
     */
    private getWarningMessage(status: CreditCeilingSettings, threshold: number): string {
        if (threshold === 100) {
            return `Credit ceiling reached! You've used ${status.currentUsage} of your ${status.ceiling} credit limit. ${
                status.estimatedToComplete
                    ? `Estimated ${status.estimatedToComplete} more credits needed to complete.`
                    : ''
            }`;
        } else if (threshold === 90) {
            return `Approaching credit ceiling (${Math.round(status.percentUsed)}% used). ${
                status.estimatedToComplete
                    ? `Estimated ${status.estimatedToComplete} more credits to complete.`
                    : ''
            }`;
        } else {
            return `Credit usage at ${Math.round(status.percentUsed)}%. ${
                status.estimatedToComplete
                    ? `Estimated ${status.estimatedToComplete} more credits to complete.`
                    : ''
            }`;
        }
    }

    /**
     * Quick adjustment helpers
     */
    async adjustCeilingBy(userId: string, amount: number): Promise<CreditCeilingSettings> {
        const currentStatus = await this.getCeilingStatus(userId);
        const currentCeiling = currentStatus.ceiling || 0;
        const newCeiling = currentCeiling + amount;

        return this.setCeiling(userId, newCeiling);
    }

    async setUnlimited(userId: string): Promise<CreditCeilingSettings> {
        return this.setCeiling(userId, null);
    }

    /**
     * Get ceiling for multiple users (for admin/analytics)
     */
    async getBatchCeilingStatus(userIds: string[]): Promise<Map<string, CreditCeilingSettings>> {
        const results = new Map<string, CreditCeilingSettings>();

        await Promise.all(
            userIds.map(async (userId) => {
                try {
                    const status = await this.getCeilingStatus(userId);
                    results.set(userId, status);
                } catch (error) {
                    console.error(`Error getting ceiling for user ${userId}:`, error);
                }
            })
        );

        return results;
    }

    /**
     * Record that a warning was shown to user (for analytics)
     */
    async recordWarningShown(userId: string, threshold: number, buildId?: string): Promise<void> {
        this.emit('warning_shown', {
            userId,
            threshold,
            buildId,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Clear estimation cache for a build
     */
    clearEstimationCache(buildId: string): void {
        this.estimationCache.delete(buildId);
    }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: CreditCeilingService | null = null;

export function getCreditCeilingService(): CreditCeilingService {
    if (!instance) {
        instance = new CreditCeilingService();
    }
    return instance;
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export async function checkCreditCeiling(
    userId: string,
    estimatedCost: number,
    buildId?: string
): Promise<CeilingCheckResult> {
    const service = getCreditCeilingService();
    return service.checkCeiling(userId, estimatedCost, buildId);
}

export async function getCeilingStatus(
    userId: string,
    buildId?: string
): Promise<CreditCeilingSettings> {
    const service = getCreditCeilingService();
    return service.getCeilingStatus(userId, buildId);
}

export async function updateCeiling(
    userId: string,
    ceiling: number | null
): Promise<CreditCeilingSettings> {
    const service = getCreditCeilingService();
    return service.setCeiling(userId, ceiling);
}
