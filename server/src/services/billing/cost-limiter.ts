/**
 * AI Cost Limiter Service
 *
 * Real-time cost enforcement and budget management for AI operations.
 * Prevents runaway costs and ensures budget compliance at scale.
 *
 * Features:
 * - Per-user budget tracking
 * - Per-request cost estimation and validation
 * - Real-time cost accumulation
 * - Budget alerts and throttling
 * - Cost-based request prioritization
 */

import { getRedis, CacheTTL } from '../infrastructure/redis.js';
import { getCreditPoolService } from './credit-pool.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CostEstimate {
    estimatedCents: number;
    model: string;
    inputTokens: number;
    outputTokens: number;
    confidence: 'low' | 'medium' | 'high';
}

export interface BudgetStatus {
    dailyBudget: number;
    dailySpent: number;
    remainingBudget: number;
    percentUsed: number;
    canProceed: boolean;
    throttled: boolean;
    throttleReason?: string;
}

export interface CostLimits {
    maxCostPerRequest: number;      // Max cost per single request (cents)
    dailyBudget: number;            // Daily budget per user (cents)
    hourlyBudget: number;           // Hourly budget per user (cents)
    maxConcurrentRequests: number;  // Max concurrent expensive requests
}

export interface UserTier {
    name: 'free' | 'pro' | 'team' | 'enterprise';
    limits: CostLimits;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Model pricing in cents per 1K tokens (input/output)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
    // Claude models
    'claude-3-opus': { input: 1.5, output: 7.5 },
    'claude-3-sonnet': { input: 0.3, output: 1.5 },
    'claude-3-haiku': { input: 0.025, output: 0.125 },
    'claude-3.5-sonnet': { input: 0.3, output: 1.5 },
    'claude-3.5-haiku': { input: 0.025, output: 0.125 },

    // GPT models
    'gpt-4-turbo': { input: 1.0, output: 3.0 },
    'gpt-4o': { input: 0.5, output: 1.5 },
    'gpt-4o-mini': { input: 0.015, output: 0.06 },

    // Default fallback
    'default': { input: 0.3, output: 1.5 },
};

// Tier-based limits (in cents)
const TIER_LIMITS: Record<string, CostLimits> = {
    free: {
        maxCostPerRequest: 10,        // $0.10 per request max
        dailyBudget: 50,              // $0.50/day
        hourlyBudget: 20,             // $0.20/hour
        maxConcurrentRequests: 1,
    },
    pro: {
        maxCostPerRequest: 100,       // $1.00 per request max
        dailyBudget: 1000,            // $10/day
        hourlyBudget: 200,            // $2/hour
        maxConcurrentRequests: 5,
    },
    team: {
        maxCostPerRequest: 500,       // $5.00 per request max
        dailyBudget: 5000,            // $50/day
        hourlyBudget: 1000,           // $10/hour
        maxConcurrentRequests: 10,
    },
    enterprise: {
        maxCostPerRequest: 2000,      // $20.00 per request max
        dailyBudget: 50000,           // $500/day
        hourlyBudget: 10000,          // $100/hour
        maxConcurrentRequests: 50,
    },
};

const KEY_PREFIX = {
    userDaily: 'cost:daily:',
    userHourly: 'cost:hourly:',
    userConcurrent: 'cost:concurrent:',
    globalDaily: 'cost:global:daily',
    globalHourly: 'cost:global:hourly',
    requestCost: 'cost:request:',
};

// ============================================================================
// COST LIMITER CLASS
// ============================================================================

class CostLimiter {
    private stats = {
        requestsChecked: 0,
        requestsApproved: 0,
        requestsDenied: 0,
        totalEstimatedCost: 0,
        totalActualCost: 0,
    };

    /**
     * Estimate cost for an AI request
     */
    estimateCost(params: {
        model: string;
        inputTokens: number;
        estimatedOutputTokens?: number;
    }): CostEstimate {
        const pricing = MODEL_PRICING[params.model] ?? MODEL_PRICING['default'];
        const outputTokens = params.estimatedOutputTokens ?? Math.floor(params.inputTokens * 0.5);

        const inputCost = (params.inputTokens / 1000) * pricing.input;
        const outputCost = (outputTokens / 1000) * pricing.output;
        const totalCents = Math.ceil(inputCost + outputCost);

        return {
            estimatedCents: totalCents,
            model: params.model,
            inputTokens: params.inputTokens,
            outputTokens,
            confidence: params.estimatedOutputTokens ? 'high' : 'medium',
        };
    }

    /**
     * Check if user can proceed with request
     */
    async checkBudget(
        userId: string,
        tier: string,
        estimate: CostEstimate
    ): Promise<BudgetStatus> {
        this.stats.requestsChecked++;
        const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

        // Check per-request limit
        if (estimate.estimatedCents > limits.maxCostPerRequest) {
            this.stats.requestsDenied++;
            return {
                dailyBudget: limits.dailyBudget,
                dailySpent: 0,
                remainingBudget: 0,
                percentUsed: 0,
                canProceed: false,
                throttled: true,
                throttleReason: `Request cost ($${(estimate.estimatedCents / 100).toFixed(2)}) exceeds max ($${(limits.maxCostPerRequest / 100).toFixed(2)})`,
            };
        }

        const redis = getRedis();
        const now = Date.now();
        const today = new Date().toISOString().split('T')[0];
        const hour = Math.floor(now / 3600000);

        // Get current spend
        const [dailySpentRaw, hourlySpentRaw, concurrentRaw] = await Promise.all([
            redis.get<number>(`${KEY_PREFIX.userDaily}${userId}:${today}`),
            redis.get<number>(`${KEY_PREFIX.userHourly}${userId}:${hour}`),
            redis.get<number>(`${KEY_PREFIX.userConcurrent}${userId}`),
        ]);

        const dailySpent = dailySpentRaw ?? 0;
        const hourlySpent = hourlySpentRaw ?? 0;
        const concurrent = concurrentRaw ?? 0;

        // Check daily budget
        if (dailySpent + estimate.estimatedCents > limits.dailyBudget) {
            this.stats.requestsDenied++;
            return {
                dailyBudget: limits.dailyBudget,
                dailySpent,
                remainingBudget: Math.max(0, limits.dailyBudget - dailySpent),
                percentUsed: (dailySpent / limits.dailyBudget) * 100,
                canProceed: false,
                throttled: true,
                throttleReason: 'Daily budget exceeded',
            };
        }

        // Check hourly budget
        if (hourlySpent + estimate.estimatedCents > limits.hourlyBudget) {
            this.stats.requestsDenied++;
            return {
                dailyBudget: limits.dailyBudget,
                dailySpent,
                remainingBudget: Math.max(0, limits.hourlyBudget - hourlySpent),
                percentUsed: (hourlySpent / limits.hourlyBudget) * 100,
                canProceed: false,
                throttled: true,
                throttleReason: 'Hourly budget exceeded',
            };
        }

        // Check concurrent requests
        if (concurrent >= limits.maxConcurrentRequests) {
            this.stats.requestsDenied++;
            return {
                dailyBudget: limits.dailyBudget,
                dailySpent,
                remainingBudget: Math.max(0, limits.dailyBudget - dailySpent),
                percentUsed: (dailySpent / limits.dailyBudget) * 100,
                canProceed: false,
                throttled: true,
                throttleReason: 'Too many concurrent requests',
            };
        }

        // Check global pool
        const poolService = getCreditPoolService();
        const poolCheck = await poolService.canAffordApiCall(
            estimate.estimatedCents,
            tier === 'free'
        );

        if (!poolCheck.allowed) {
            this.stats.requestsDenied++;
            return {
                dailyBudget: limits.dailyBudget,
                dailySpent,
                remainingBudget: Math.max(0, limits.dailyBudget - dailySpent),
                percentUsed: (dailySpent / limits.dailyBudget) * 100,
                canProceed: false,
                throttled: true,
                throttleReason: poolCheck.reason ?? 'System budget depleted',
            };
        }

        this.stats.requestsApproved++;
        this.stats.totalEstimatedCost += estimate.estimatedCents;

        return {
            dailyBudget: limits.dailyBudget,
            dailySpent,
            remainingBudget: Math.max(0, limits.dailyBudget - dailySpent - estimate.estimatedCents),
            percentUsed: ((dailySpent + estimate.estimatedCents) / limits.dailyBudget) * 100,
            canProceed: true,
            throttled: false,
        };
    }

    /**
     * Reserve cost for a request (increment concurrent counter)
     */
    async reserveCost(userId: string, requestId: string, estimate: CostEstimate): Promise<void> {
        const redis = getRedis();

        await Promise.all([
            // Increment concurrent counter
            redis.incr(`${KEY_PREFIX.userConcurrent}${userId}`),
            redis.expire(`${KEY_PREFIX.userConcurrent}${userId}`, 3600), // 1 hour expiry

            // Store request estimate
            redis.set(`${KEY_PREFIX.requestCost}${requestId}`, {
                userId,
                estimate,
                reservedAt: Date.now(),
            }, { ex: 3600 }),
        ]);
    }

    /**
     * Record actual cost after request completes
     */
    async recordCost(
        userId: string,
        requestId: string,
        tier: string,
        actualCost: {
            cents: number;
            model: string;
            inputTokens: number;
            outputTokens: number;
        }
    ): Promise<void> {
        const redis = getRedis();
        const now = Date.now();
        const today = new Date().toISOString().split('T')[0];
        const hour = Math.floor(now / 3600000);

        // Update daily and hourly counters
        const dailyKey = `${KEY_PREFIX.userDaily}${userId}:${today}`;
        const hourlyKey = `${KEY_PREFIX.userHourly}${userId}:${hour}`;

        const [dailySpentRaw, hourlySpentRaw] = await Promise.all([
            redis.get<number>(dailyKey),
            redis.get<number>(hourlyKey),
        ]);

        const dailySpent = dailySpentRaw ?? 0;
        const hourlySpent = hourlySpentRaw ?? 0;

        await Promise.all([
            // Update daily spend
            redis.set(dailyKey, dailySpent + actualCost.cents, { ex: CacheTTL.DAY }),

            // Update hourly spend
            redis.set(hourlyKey, hourlySpent + actualCost.cents, { ex: 3600 }),

            // Decrement concurrent counter
            redis.incr(`${KEY_PREFIX.userConcurrent}${userId}`).then(async (val) => {
                if (val <= 1) {
                    await redis.del(`${KEY_PREFIX.userConcurrent}${userId}`);
                } else {
                    // Decrement by setting to val - 2 (we just incremented, need to go back 2)
                    const newVal = Math.max(0, val - 2);
                    await redis.set(`${KEY_PREFIX.userConcurrent}${userId}`, newVal, { ex: 3600 });
                }
            }),

            // Clean up request reservation
            redis.del(`${KEY_PREFIX.requestCost}${requestId}`),
        ]);

        this.stats.totalActualCost += actualCost.cents;

        // Record to credit pool
        const poolService = getCreditPoolService();
        await poolService.deductApiCost(actualCost.cents, tier === 'free', userId, {
            model: actualCost.model,
            tokens: actualCost.inputTokens + actualCost.outputTokens,
            endpoint: 'ai_generation',
        });
    }

    /**
     * Release reservation without recording cost (on error)
     */
    async releaseReservation(userId: string, requestId: string): Promise<void> {
        const redis = getRedis();

        const concurrent = await redis.get<number>(`${KEY_PREFIX.userConcurrent}${userId}`);
        if (concurrent && concurrent > 0) {
            await redis.set(`${KEY_PREFIX.userConcurrent}${userId}`, concurrent - 1, { ex: 3600 });
        }

        await redis.del(`${KEY_PREFIX.requestCost}${requestId}`);
    }

    /**
     * Get user's budget status
     */
    async getUserBudgetStatus(userId: string, tier: string): Promise<{
        daily: { spent: number; budget: number; remaining: number; percentUsed: number };
        hourly: { spent: number; budget: number; remaining: number; percentUsed: number };
        concurrent: { active: number; max: number };
    }> {
        const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
        const redis = getRedis();
        const now = Date.now();
        const today = new Date().toISOString().split('T')[0];
        const hour = Math.floor(now / 3600000);

        const [dailySpentRaw, hourlySpentRaw, concurrentRaw] = await Promise.all([
            redis.get<number>(`${KEY_PREFIX.userDaily}${userId}:${today}`),
            redis.get<number>(`${KEY_PREFIX.userHourly}${userId}:${hour}`),
            redis.get<number>(`${KEY_PREFIX.userConcurrent}${userId}`),
        ]);

        const dailySpent = dailySpentRaw ?? 0;
        const hourlySpent = hourlySpentRaw ?? 0;
        const concurrent = concurrentRaw ?? 0;

        return {
            daily: {
                spent: dailySpent,
                budget: limits.dailyBudget,
                remaining: Math.max(0, limits.dailyBudget - dailySpent),
                percentUsed: (dailySpent / limits.dailyBudget) * 100,
            },
            hourly: {
                spent: hourlySpent,
                budget: limits.hourlyBudget,
                remaining: Math.max(0, limits.hourlyBudget - hourlySpent),
                percentUsed: (hourlySpent / limits.hourlyBudget) * 100,
            },
            concurrent: {
                active: concurrent,
                max: limits.maxConcurrentRequests,
            },
        };
    }

    /**
     * Get limiter statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Reset statistics
     */
    resetStats(): void {
        this.stats = {
            requestsChecked: 0,
            requestsApproved: 0,
            requestsDenied: 0,
            totalEstimatedCost: 0,
            totalActualCost: 0,
        };
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let costLimiter: CostLimiter | null = null;

export function getCostLimiter(): CostLimiter {
    if (!costLimiter) {
        costLimiter = new CostLimiter();
    }
    return costLimiter;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Estimate cost for a request
 */
export function estimateRequestCost(params: {
    model: string;
    inputTokens: number;
    estimatedOutputTokens?: number;
}): CostEstimate {
    return getCostLimiter().estimateCost(params);
}

/**
 * Check if user can proceed
 */
export async function checkUserBudget(
    userId: string,
    tier: string,
    estimate: CostEstimate
): Promise<BudgetStatus> {
    return getCostLimiter().checkBudget(userId, tier, estimate);
}

/**
 * Record completed request cost
 */
export async function recordRequestCost(
    userId: string,
    requestId: string,
    tier: string,
    actualCost: {
        cents: number;
        model: string;
        inputTokens: number;
        outputTokens: number;
    }
): Promise<void> {
    return getCostLimiter().recordCost(userId, requestId, tier, actualCost);
}

export default {
    getCostLimiter,
    estimateRequestCost,
    checkUserBudget,
    recordRequestCost,
};
