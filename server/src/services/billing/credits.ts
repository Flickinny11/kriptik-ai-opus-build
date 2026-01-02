/**
 * User Credit System
 *
 * Manages user credits for AI operations:
 * - Track credit balance per user
 * - Deduct credits based on token usage
 * - Integrate with Stripe for credit purchases
 * - Enforce credit limits before operations
 */

import { db } from '../../db.js';
import { users, generations, projects } from '../../schema.js';
import { eq, sql, and, gte } from 'drizzle-orm';
import { getCeilingNotificationService } from '../notifications/ceiling-notification-service.js';

// ============================================================================
// TYPES
// ============================================================================

export interface UserCredits {
    userId: string;
    balance: number;
    monthlyAllocation: number;
    usedThisMonth: number;
    resetDate: Date;
    tier: 'free' | 'pro' | 'enterprise';
}

export interface CreditTransaction {
    id: string;
    userId: string;
    amount: number;  // Positive for additions, negative for deductions
    type: 'allocation' | 'purchase' | 'usage' | 'refund' | 'adjustment';
    description: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
}

export interface UsageEstimate {
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
    creditsRequired: number;
}

// ============================================================================
// CREDIT PRICING
// ============================================================================

// Credits per dollar (100 credits = $1)
const CREDITS_PER_DOLLAR = 100;

// Token costs in dollars per 1M tokens (based on current model pricing)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
    'claude-sonnet-4-5': { input: 3, output: 15 },
    'claude-opus-4-5': { input: 15, output: 75 },
    'claude-sonnet-4': { input: 3, output: 15 },
    'claude-3-5-haiku': { input: 0.8, output: 4 },
    'gpt-4o': { input: 2.5, output: 10 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'deepseek-v3': { input: 0.14, output: 0.28 },
    'gemini-2.0-pro': { input: 1.25, output: 5 },
    'llama-3.3-70b': { input: 0.4, output: 0.4 },
    'default': { input: 1, output: 4 },
};

// Monthly credit allocations by tier
const TIER_ALLOCATIONS: Record<string, number> = {
    free: 500,        // $5 worth
    pro: 5000,        // $50 worth
    enterprise: 50000, // $500 worth
};

// ============================================================================
// CREDIT CALCULATION
// ============================================================================

/**
 * Calculate credits required for a generation
 */
export function calculateCreditsForGeneration(
    model: string,
    inputTokens: number,
    outputTokens: number
): number {
    const costs = MODEL_COSTS[model] || MODEL_COSTS['default'];

    // Calculate cost in dollars
    const inputCost = (inputTokens / 1_000_000) * costs.input;
    const outputCost = (outputTokens / 1_000_000) * costs.output;
    const totalCost = inputCost + outputCost;

    // Convert to credits (with minimum of 1 credit)
    return Math.max(1, Math.ceil(totalCost * CREDITS_PER_DOLLAR));
}

/**
 * Estimate credits for a prompt before generation
 */
export function estimateCredits(
    model: string,
    promptLength: number,
    expectedOutputLength: number = 2000
): UsageEstimate {
    // Rough token estimation: ~4 characters per token
    const inputTokens = Math.ceil(promptLength / 4);
    const outputTokens = Math.ceil(expectedOutputLength / 4);

    const costs = MODEL_COSTS[model] || MODEL_COSTS['default'];
    const inputCost = (inputTokens / 1_000_000) * costs.input;
    const outputCost = (outputTokens / 1_000_000) * costs.output;

    return {
        inputTokens,
        outputTokens,
        estimatedCost: inputCost + outputCost,
        creditsRequired: calculateCreditsForGeneration(model, inputTokens, outputTokens),
    };
}

// ============================================================================
// CREDIT SERVICE
// ============================================================================

export class CreditService {
    /**
     * Get user's current credit balance
     */
    async getCredits(userId: string): Promise<UserCredits> {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            throw new Error('User not found');
        }

        // Get usage for current month
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const usageResult = await db
            .select({
                totalCredits: sql<number>`COALESCE(SUM(${generations.creditsUsed}), 0)`,
            })
            .from(generations)
            .where(
                and(
                    eq(generations.userId, userId),
                    gte(generations.createdAt, monthStart.toISOString())
                )
            );

        const usedThisMonth = usageResult[0]?.totalCredits || 0;
        const tier = (user.tier as 'free' | 'pro' | 'enterprise') || 'free';
        const monthlyAllocation = TIER_ALLOCATIONS[tier] || TIER_ALLOCATIONS['free'];

        // Calculate reset date (1st of next month)
        const resetDate = new Date(monthStart);
        resetDate.setMonth(resetDate.getMonth() + 1);

        // Balance = allocation + purchased credits - used
        const purchasedCredits = user.credits || 0;
        const balance = monthlyAllocation + purchasedCredits - usedThisMonth;

        return {
            userId,
            balance: Math.max(0, balance),
            monthlyAllocation,
            usedThisMonth,
            resetDate,
            tier,
        };
    }

    /**
     * Check if user has enough credits for an operation
     */
    async hasCredits(userId: string, requiredCredits: number): Promise<boolean> {
        const credits = await this.getCredits(userId);
        return credits.balance >= requiredCredits;
    }

    /**
     * Deduct credits from user's balance
     */
    async deductCredits(
        userId: string,
        amount: number,
        description: string,
        metadata?: Record<string, unknown>
    ): Promise<{ success: boolean; newBalance: number; error?: string }> {
        const credits = await this.getCredits(userId);

        if (credits.balance < amount) {
            return {
                success: false,
                newBalance: credits.balance,
                error: 'Insufficient credits',
            };
        }

        // Record the usage in generation or update user's credit balance
        // For purchased credits, deduct from user's credit balance
        if (credits.balance > credits.monthlyAllocation - credits.usedThisMonth) {
            // Deduct from purchased credits first
            const purchasedCreditsUsed = Math.min(
                amount,
                credits.balance - (credits.monthlyAllocation - credits.usedThisMonth)
            );

            if (purchasedCreditsUsed > 0) {
                await db
                    .update(users)
                    .set({
                        credits: sql`${users.credits} - ${purchasedCreditsUsed}`,
                        updatedAt: new Date().toISOString(),
                    })
                    .where(eq(users.id, userId));
            }
        }

        const newBalance = credits.balance - amount;

        // Check ceiling and send notifications if thresholds reached
        const newUsage = credits.usedThisMonth + amount;
        void this.checkCeilingAndNotify(userId, newUsage);

        return {
            success: true,
            newBalance,
        };
    }

    /**
     * Check credit ceiling and send notifications if needed
     * (Called after credit deductions)
     */
    private async checkCeilingAndNotify(userId: string, currentUsage: number): Promise<void> {
        try {
            const ceilingService = getCeilingNotificationService();
            await ceilingService.monitorAndNotify(userId, currentUsage, {
                includeUsageProjection: true,
                includeTimeEstimate: true,
            });
        } catch (error) {
            console.error('[CreditService] Failed to check ceiling:', error);
            // Don't throw - ceiling notifications are non-critical
        }
    }

    /**
     * Add credits to user's balance (from purchase)
     */
    async addCredits(
        userId: string,
        amount: number,
        description: string,
        metadata?: Record<string, unknown>
    ): Promise<{ success: boolean; newBalance: number }> {
        await db
            .update(users)
            .set({
                credits: sql`COALESCE(${users.credits}, 0) + ${amount}`,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(users.id, userId));

        const credits = await this.getCredits(userId);

        return {
            success: true,
            newBalance: credits.balance,
        };
    }

    /**
     * Record generation usage
     */
    async recordGeneration(
        userId: string,
        projectId: string,
        model: string,
        inputTokens: number,
        outputTokens: number
    ): Promise<{ creditsUsed: number; remainingBalance: number }> {
        const creditsUsed = calculateCreditsForGeneration(model, inputTokens, outputTokens);

        const deductResult = await this.deductCredits(
            userId,
            creditsUsed,
            `Generation using ${model}`,
            { model, inputTokens, outputTokens }
        );

        if (!deductResult.success) {
            throw new Error(deductResult.error || 'Failed to deduct credits');
        }

        return {
            creditsUsed,
            remainingBalance: deductResult.newBalance,
        };
    }

    /**
     * Get user's usage history
     */
    async getUsageHistory(
        userId: string,
        limit: number = 50
    ): Promise<Array<{
        id: string;
        creditsUsed: number;
        model: string;
        projectName: string;
        createdAt: string;
    }>> {
        const result = await db
            .select({
                id: generations.id,
                creditsUsed: generations.creditsUsed,
                model: generations.model,
                projectName: projects.name,
                createdAt: generations.createdAt,
            })
            .from(generations)
            .leftJoin(projects, eq(generations.projectId, projects.id))
            .where(eq(generations.userId, userId))
            .orderBy(sql`${generations.createdAt} DESC`)
            .limit(limit);

        return result.map(row => ({
            id: row.id,
            creditsUsed: row.creditsUsed || 0,
            model: row.model || 'unknown',
            projectName: row.projectName || 'Unknown Project',
            createdAt: row.createdAt || new Date().toISOString(),
        }));
    }

    /**
     * Check and enforce credit limits before operation
     */
    async enforceCredits(
        userId: string,
        estimatedCredits: number
    ): Promise<{ allowed: boolean; message?: string; credits?: UserCredits }> {
        const credits = await this.getCredits(userId);

        if (credits.balance < estimatedCredits) {
            const needed = estimatedCredits - credits.balance;
            return {
                allowed: false,
                message: `Insufficient credits. You need ${needed} more credits. Current balance: ${credits.balance}`,
                credits,
            };
        }

        // Warn if low on credits
        if (credits.balance < estimatedCredits * 2) {
            return {
                allowed: true,
                message: `Low credit balance warning. This operation will use approximately ${estimatedCredits} credits.`,
                credits,
            };
        }

        return {
            allowed: true,
            credits,
        };
    }

    /**
     * Reset monthly credits (called by cron job or on tier upgrade)
     */
    async resetMonthlyCredits(userId: string): Promise<void> {
        // Monthly reset is handled automatically by getCredits calculation
        // This method can be used for manual resets or tier changes
        await db
            .update(users)
            .set({
                updatedAt: new Date().toISOString(),
            })
            .where(eq(users.id, userId));
    }

    /**
     * Upgrade user tier and adjust credits
     */
    async upgradeTier(
        userId: string,
        newTier: 'free' | 'pro' | 'enterprise'
    ): Promise<UserCredits> {
        await db
            .update(users)
            .set({
                tier: newTier,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(users.id, userId));

        return this.getCredits(userId);
    }
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

import { Request, Response, NextFunction } from 'express';

/**
 * Credit check middleware
 * Ensures user has credits before expensive operations
 */
export function requireCredits(estimatedCredits: number = 10) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const user = (req as Request & { user?: { id: string } }).user;

        if (!user?.id) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required',
            });
            return;
        }

        try {
            const creditService = getCreditService();
            const result = await creditService.enforceCredits(user.id, estimatedCredits);

            if (!result.allowed) {
                res.status(402).json({
                    error: 'Insufficient Credits',
                    message: result.message,
                    credits: result.credits,
                });
                return;
            }

            // Attach credit info to request for downstream use
            (req as Request & { credits?: UserCredits }).credits = result.credits;

            // Log warning if present
            if (result.message) {
                console.log(`Credit warning for user ${user.id}: ${result.message}`);
            }

            next();
        } catch (error) {
            console.error('Credit check error:', error);
            res.status(500).json({
                error: 'Credit Check Failed',
                message: 'Unable to verify credit balance',
            });
        }
    };
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: CreditService | null = null;

export function getCreditService(): CreditService {
    if (!instance) {
        instance = new CreditService();
    }
    return instance;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
    MODEL_COSTS,
    TIER_ALLOCATIONS,
    CREDITS_PER_DOLLAR,
};

