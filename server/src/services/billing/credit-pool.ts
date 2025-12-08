/**
 * Credit Pool Service - Self-Funding Revenue Allocation
 * 
 * Automatically allocates revenue to different reserves:
 * - 60% → API Reserve (pays OpenRouter/Anthropic)
 * - 20% → Free Tier Subsidy (funds free users)
 * - 10% → Infrastructure Reserve (Vercel, Turso, etc.)
 * - 10% → Profit Reserve (business growth)
 */

import { db } from '../../db.js';
import { creditPool, poolTransactions, poolSnapshots } from '../../schema.js';
import { eq, and, gte, desc } from 'drizzle-orm';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export interface PoolAllocation {
    apiReserve: number; // cents
    freeSubsidy: number;
    infraReserve: number;
    profitReserve: number;
    totalRevenue: number;
    totalApiSpend: number;
    lastUpdated: Date;
}

export interface PoolHealth {
    status: 'healthy' | 'warning' | 'critical' | 'emergency';
    apiRunway: number; // Days of API calls remaining
    freeRunway: number; // Days of free tier remaining
    alerts: string[];
}

export class CreditPoolService extends EventEmitter {
    // Allocation percentages
    private readonly ALLOCATION = {
        api: 0.60,      // 60% for API costs
        free: 0.20,     // 20% for free tier subsidy
        infra: 0.10,    // 10% for infrastructure
        profit: 0.10,   // 10% for profit/growth
    };

    // Cost estimates for runway calculation (in cents)
    private readonly ESTIMATED_DAILY_API_COST = 5000; // $50/day
    private readonly ESTIMATED_FREE_USER_COST = 50; // $0.50 per free user per day

    /**
     * Initialize pool from database or create if not exists
     */
    async initialize(): Promise<PoolAllocation> {
        const existing = await db.select().from(creditPool).where(eq(creditPool.id, 'main')).get();

        if (!existing) {
            const initial: PoolAllocation = {
                apiReserve: 0,
                freeSubsidy: 0,
                infraReserve: 0,
                profitReserve: 0,
                totalRevenue: 0,
                totalApiSpend: 0,
                lastUpdated: new Date(),
            };

            await db.insert(creditPool).values({
                id: 'main',
                apiReserve: initial.apiReserve,
                freeSubsidy: initial.freeSubsidy,
                infraReserve: initial.infraReserve,
                profitReserve: initial.profitReserve,
                totalRevenue: initial.totalRevenue,
                totalApiSpend: initial.totalApiSpend,
                lastUpdated: initial.lastUpdated.toISOString(),
            });

            return initial;
        }

        return {
            apiReserve: existing.apiReserve,
            freeSubsidy: existing.freeSubsidy,
            infraReserve: existing.infraReserve,
            profitReserve: existing.profitReserve,
            totalRevenue: existing.totalRevenue,
            totalApiSpend: existing.totalApiSpend,
            lastUpdated: new Date(existing.lastUpdated),
        };
    }

    /**
     * Record revenue from any payment (subscription or top-up)
     * @param amountCents Amount in cents
     */
    async recordRevenue(
        amountCents: number,
        source: 'subscription' | 'topup' | 'overage',
        userId?: string,
        metadata?: Record<string, unknown>
    ): Promise<void> {
        const allocation = {
            api: Math.floor(amountCents * this.ALLOCATION.api),
            free: Math.floor(amountCents * this.ALLOCATION.free),
            infra: Math.floor(amountCents * this.ALLOCATION.infra),
            profit: Math.floor(amountCents * this.ALLOCATION.profit),
        };

        // Update pool
        const pool = await this.getPool();
        const newPool = {
            apiReserve: pool.apiReserve + allocation.api,
            freeSubsidy: pool.freeSubsidy + allocation.free,
            infraReserve: pool.infraReserve + allocation.infra,
            profitReserve: pool.profitReserve + allocation.profit,
            totalRevenue: pool.totalRevenue + amountCents,
            lastUpdated: new Date().toISOString(),
        };

        await db.update(creditPool)
            .set(newPool)
            .where(eq(creditPool.id, 'main'));

        // Log transaction
        await this.logTransaction({
            type: 'revenue',
            category: source,
            amount: amountCents,
            description: `Revenue from ${source}: $${(amountCents / 100).toFixed(2)}`,
            userId,
            apiReserveAfter: newPool.apiReserve,
            freeSubsidyAfter: newPool.freeSubsidy,
        });

        this.emit('revenue', { amount: amountCents, source, allocation, userId });

        // Check if we should alert on large payments ($100+)
        if (amountCents >= 10000) {
            this.emit('large_payment', { amount: amountCents, source, userId });
        }

        console.log(`[CreditPool] Revenue recorded: $${(amountCents / 100).toFixed(2)} from ${source}`);
    }

    /**
     * Check if we can afford an API call before making it
     */
    async canAffordApiCall(estimatedCostCents: number, isFreeTier: boolean): Promise<{
        allowed: boolean;
        reason?: string;
        availableBalance: number;
    }> {
        const pool = await this.getPool();

        if (isFreeTier) {
            const allowed = pool.freeSubsidy >= estimatedCostCents;
            return {
                allowed,
                reason: allowed ? undefined : 'Free tier subsidy pool depleted',
                availableBalance: pool.freeSubsidy,
            };
        }

        const allowed = pool.apiReserve >= estimatedCostCents;
        return {
            allowed,
            reason: allowed ? undefined : 'API reserve depleted',
            availableBalance: pool.apiReserve,
        };
    }

    /**
     * Deduct actual API cost after call completes
     */
    async deductApiCost(
        actualCostCents: number,
        isFreeTier: boolean,
        userId?: string,
        details?: { model: string; tokens: number; endpoint: string }
    ): Promise<void> {
        const pool = await this.getPool();

        let newApiReserve = pool.apiReserve;
        let newFreeSubsidy = pool.freeSubsidy;
        let transactionType: 'api_cost' | 'free_subsidy';

        if (isFreeTier) {
            newFreeSubsidy = Math.max(0, pool.freeSubsidy - actualCostCents);
            transactionType = 'free_subsidy';
        } else {
            newApiReserve = Math.max(0, pool.apiReserve - actualCostCents);
            transactionType = 'api_cost';
        }

        await db.update(creditPool)
            .set({
                apiReserve: newApiReserve,
                freeSubsidy: newFreeSubsidy,
                totalApiSpend: pool.totalApiSpend + actualCostCents,
                lastUpdated: new Date().toISOString(),
            })
            .where(eq(creditPool.id, 'main'));

        // Log transaction
        await this.logTransaction({
            type: transactionType,
            category: 'generation',
            amount: -actualCostCents,
            description: details
                ? `API: ${details.model} (${details.tokens} tokens) - ${details.endpoint}`
                : `API cost: $${(actualCostCents / 100).toFixed(4)}`,
            userId,
            apiReserveAfter: newApiReserve,
            freeSubsidyAfter: newFreeSubsidy,
        });

        this.emit('api_cost', { cost: actualCostCents, isFreeTier, userId, details });

        // Check health after deduction
        const health = await this.getHealth();
        if (health.status === 'critical' || health.status === 'emergency') {
            this.emit('pool_alert', { health, pool: await this.getPool() });
        }
    }

    /**
     * Get current pool status
     */
    async getPool(): Promise<PoolAllocation> {
        const pool = await db.select().from(creditPool).where(eq(creditPool.id, 'main')).get();

        if (!pool) {
            return this.initialize();
        }

        return {
            apiReserve: pool.apiReserve,
            freeSubsidy: pool.freeSubsidy,
            infraReserve: pool.infraReserve,
            profitReserve: pool.profitReserve,
            totalRevenue: pool.totalRevenue,
            totalApiSpend: pool.totalApiSpend,
            lastUpdated: new Date(pool.lastUpdated),
        };
    }

    /**
     * Calculate pool health and runway
     */
    async getHealth(): Promise<PoolHealth> {
        const pool = await this.getPool();
        const alerts: string[] = [];

        // Calculate runways (days remaining)
        const apiRunway = pool.apiReserve / this.ESTIMATED_DAILY_API_COST;
        const freeRunway = pool.freeSubsidy / (this.ESTIMATED_FREE_USER_COST * 100); // Assume 100 free users

        // Determine status
        let status: PoolHealth['status'] = 'healthy';

        if (apiRunway < 1) {
            status = 'emergency';
            alerts.push('EMERGENCY: Less than 1 day of API funding remaining');
        } else if (apiRunway < 3) {
            status = 'critical';
            alerts.push('CRITICAL: Less than 3 days of API funding remaining');
        } else if (apiRunway < 7) {
            status = status === 'healthy' ? 'warning' : status;
            alerts.push('WARNING: Less than 7 days of API funding remaining');
        }

        if (freeRunway < 1) {
            status = status === 'healthy' ? 'critical' : status;
            alerts.push('Free tier subsidy nearly depleted');
        } else if (freeRunway < 3) {
            status = status === 'healthy' ? 'warning' : status;
            alerts.push('Free tier subsidy running low');
        }

        // Check profit margin
        const margin = pool.totalRevenue > 0
            ? (pool.totalRevenue - pool.totalApiSpend) / pool.totalRevenue
            : 0;

        if (margin < 0.3 && pool.totalRevenue > 0) {
            alerts.push(`Low profit margin: ${(margin * 100).toFixed(1)}%`);
        }

        return { status, apiRunway, freeRunway, alerts };
    }

    /**
     * Record daily snapshot for analytics
     */
    async recordDailySnapshot(): Promise<void> {
        const pool = await this.getPool();
        const today = new Date().toISOString().split('T')[0];

        // Check if snapshot already exists for today
        const existing = await db.select()
            .from(poolSnapshots)
            .where(eq(poolSnapshots.date, today))
            .get();

        if (existing) {
            // Update existing snapshot
            await db.update(poolSnapshots)
                .set({
                    apiReserve: pool.apiReserve,
                    freeSubsidy: pool.freeSubsidy,
                    infraReserve: pool.infraReserve,
                    profitReserve: pool.profitReserve,
                })
                .where(eq(poolSnapshots.date, today));
        } else {
            // Get yesterday's snapshot to calculate daily values
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            const yesterdaySnapshot = await db.select()
                .from(poolSnapshots)
                .where(eq(poolSnapshots.date, yesterdayStr))
                .get();

            const dailyRevenue = yesterdaySnapshot
                ? pool.totalRevenue - (yesterdaySnapshot.apiReserve + yesterdaySnapshot.freeSubsidy + yesterdaySnapshot.infraReserve + yesterdaySnapshot.profitReserve)
                : 0;

            const dailyApiSpend = yesterdaySnapshot
                ? pool.totalApiSpend - (yesterdaySnapshot.dailyApiSpend || 0)
                : 0;

            await db.insert(poolSnapshots).values({
                id: `snapshot-${today}`,
                date: today,
                apiReserve: pool.apiReserve,
                freeSubsidy: pool.freeSubsidy,
                infraReserve: pool.infraReserve,
                profitReserve: pool.profitReserve,
                dailyRevenue: Math.max(0, dailyRevenue),
                dailyApiSpend: Math.max(0, dailyApiSpend),
            });
        }

        console.log(`[CreditPool] Daily snapshot recorded for ${today}`);
    }

    /**
     * Seed initial pool with starter funds
     */
    async seedPool(initialFundingCents: number): Promise<void> {
        await this.recordRevenue(initialFundingCents, 'topup', 'system', {
            reason: 'Initial pool seeding',
        });

        console.log(`[CreditPool] Seeded with $${(initialFundingCents / 100).toFixed(2)}`);
    }

    /**
     * Get recent transactions
     */
    async getRecentTransactions(limit: number = 100): Promise<Array<{
        id: string;
        type: string;
        category: string | null;
        amount: number;
        description: string | null;
        timestamp: string;
    }>> {
        const transactions = await db.select()
            .from(poolTransactions)
            .orderBy(desc(poolTransactions.timestamp))
            .limit(limit);

        return transactions;
    }

    /**
     * Get pool history (snapshots)
     */
    async getPoolHistory(days: number = 30): Promise<Array<{
        date: string;
        apiReserve: number;
        freeSubsidy: number;
        dailyRevenue: number;
        dailyApiSpend: number;
    }>> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];

        const snapshots = await db.select()
            .from(poolSnapshots)
            .where(gte(poolSnapshots.date, startDateStr))
            .orderBy(desc(poolSnapshots.date));

        return snapshots;
    }

    private async logTransaction(tx: {
        type: 'revenue' | 'api_cost' | 'free_subsidy' | 'infra_cost' | 'withdrawal';
        category?: 'subscription' | 'topup' | 'generation' | 'deployment' | 'overage';
        amount: number;
        description: string;
        userId?: string;
        apiReserveAfter: number;
        freeSubsidyAfter: number;
    }): Promise<void> {
        await db.insert(poolTransactions).values({
            id: randomUUID(),
            type: tx.type,
            category: tx.category,
            amount: tx.amount,
            description: tx.description,
            userId: tx.userId,
            apiReserveAfter: tx.apiReserveAfter,
            freeSubsidyAfter: tx.freeSubsidyAfter,
            timestamp: new Date().toISOString(),
        });
    }
}

// Singleton instance
let poolService: CreditPoolService | null = null;

export function getCreditPoolService(): CreditPoolService {
    if (!poolService) {
        poolService = new CreditPoolService();
    }
    return poolService;
}

