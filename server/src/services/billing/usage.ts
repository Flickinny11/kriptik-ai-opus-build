/**
 * Usage Tracking Service
 *
 * Track credit usage and enforce limits
 */

import { db } from '../../db.js';
import { users, subscriptions } from '../../schema.js';
import { eq } from 'drizzle-orm';
import { BILLING_PLANS } from './stripe.js';

export interface UsageRecord {
    userId: string;
    type: 'generation' | 'deployment' | 'api_call' | 'storage';
    credits: number;
    description: string;
    metadata?: Record<string, any>;
    timestamp: Date;
}

export interface UsageSummary {
    currentCredits: number;
    totalCredits: number;
    usedCredits: number;
    plan: string;
    periodStart: Date;
    periodEnd: Date;
    recentUsage: UsageRecord[];
}

// In-memory usage store (would be a database table in production)
const usageRecords = new Map<string, UsageRecord[]>();

/**
 * Usage Tracking Service
 */
export class UsageTrackingService {
    /**
     * Record usage
     */
    async recordUsage(record: Omit<UsageRecord, 'timestamp'>): Promise<UsageRecord> {
        const fullRecord: UsageRecord = {
            ...record,
            timestamp: new Date(),
        };

        // Store record
        const userRecords = usageRecords.get(record.userId) || [];
        userRecords.push(fullRecord);
        usageRecords.set(record.userId, userRecords);

        // Update user credits (would be a database update)
        // await db.update(users)...

        return fullRecord;
    }

    /**
     * Get usage summary for user
     */
    async getUsageSummary(userId: string): Promise<UsageSummary> {
        // Query actual user subscription from database
        let plan = 'free'; // Default to free if no subscription

        try {
            const [subscription] = await db
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.userId, userId))
                .limit(1);

            if (subscription && subscription.status === 'active') {
                plan = subscription.plan;
            }
        } catch (error) {
            console.error('Error fetching user subscription:', error);
            // Fall back to free plan on error
        }

        const planDetails = BILLING_PLANS.find(p => p.id === plan);

        // Calculate period
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // Get usage records for this period
        const records = (usageRecords.get(userId) || []).filter(
            r => r.timestamp >= periodStart && r.timestamp <= periodEnd
        );

        const usedCredits = records.reduce((sum, r) => sum + r.credits, 0);
        // Use plan credits or default to 100 for free tier
        const totalCredits = planDetails?.credits || 100;

        return {
            currentCredits: Math.max(0, totalCredits - usedCredits),
            totalCredits,
            usedCredits,
            plan,
            periodStart,
            periodEnd,
            recentUsage: records.slice(-10).reverse(),
        };
    }

    /**
     * Check if user has enough credits
     */
    async hasCredits(userId: string, requiredCredits: number): Promise<boolean> {
        const summary = await this.getUsageSummary(userId);
        return summary.currentCredits >= requiredCredits;
    }

    /**
     * Deduct credits
     */
    async deductCredits(
        userId: string,
        credits: number,
        type: UsageRecord['type'],
        description: string
    ): Promise<{ success: boolean; remaining: number }> {
        const summary = await this.getUsageSummary(userId);

        if (summary.currentCredits < credits) {
            return { success: false, remaining: summary.currentCredits };
        }

        await this.recordUsage({
            userId,
            type,
            credits,
            description,
        });

        return {
            success: true,
            remaining: summary.currentCredits - credits,
        };
    }

    /**
     * Get usage by category
     */
    async getUsageByCategory(
        userId: string
    ): Promise<Record<UsageRecord['type'], number>> {
        const records = usageRecords.get(userId) || [];

        const byCategory: Record<UsageRecord['type'], number> = {
            generation: 0,
            deployment: 0,
            api_call: 0,
            storage: 0,
        };

        for (const record of records) {
            byCategory[record.type] += record.credits;
        }

        return byCategory;
    }

    /**
     * Get usage over time
     */
    async getUsageOverTime(
        userId: string,
        days: number = 30
    ): Promise<Array<{ date: string; credits: number }>> {
        const records = usageRecords.get(userId) || [];
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        // Group by date
        const byDate = new Map<string, number>();

        for (const record of records) {
            if (record.timestamp >= cutoff) {
                const dateStr = record.timestamp.toISOString().split('T')[0];
                byDate.set(dateStr, (byDate.get(dateStr) || 0) + record.credits);
            }
        }

        // Fill in missing dates
        const result: Array<{ date: string; credits: number }> = [];
        const current = new Date(cutoff);

        while (current <= new Date()) {
            const dateStr = current.toISOString().split('T')[0];
            result.push({
                date: dateStr,
                credits: byDate.get(dateStr) || 0,
            });
            current.setDate(current.getDate() + 1);
        }

        return result;
    }

    /**
     * Estimate credits for an operation
     */
    estimateCredits(operation: {
        type: 'generation' | 'deployment' | 'model';
        complexity?: 'low' | 'medium' | 'high';
        hasGPU?: boolean;
        modelSize?: 'small' | 'medium' | 'large';
    }): number {
        let credits = 0;

        switch (operation.type) {
            case 'generation':
                credits = operation.complexity === 'low' ? 5 :
                          operation.complexity === 'medium' ? 15 :
                          operation.complexity === 'high' ? 30 : 10;
                break;

            case 'deployment':
                credits = 5;
                if (operation.hasGPU) credits += 20;
                break;

            case 'model':
                credits = operation.modelSize === 'small' ? 10 :
                          operation.modelSize === 'medium' ? 25 :
                          operation.modelSize === 'large' ? 50 : 10;
                break;
        }

        return credits;
    }
}

// Singleton instance
export const usageTracker = new UsageTrackingService();

