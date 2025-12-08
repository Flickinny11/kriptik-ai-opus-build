/**
 * Usage Service - Persistent Usage Tracking
 *
 * Records all usage events to the database for billing accuracy and analytics.
 */

import { db } from '../../db.js';
import { usageRecords, usageSummaries } from '../../schema.js';
import { eq, and, gte, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export interface UsageRecord {
    userId: string;
    projectId?: string;
    category: 'generation' | 'deployment' | 'api_call' | 'storage';
    subcategory?: string;
    creditsUsed: number;
    tokensUsed?: number;
    model?: string;
    endpoint?: string;
    metadata?: Record<string, unknown>;
}

export interface UsageSummary {
    date: string;
    totalCredits: number;
    generationCredits: number;
    deploymentCredits: number;
    apiCredits: number;
    generationCount: number;
    totalTokens: number;
}

export class UsageService {
    /**
     * Record a usage event
     */
    async recordUsage(record: UsageRecord): Promise<void> {
        const id = randomUUID();
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];

        // Insert record
        await db.insert(usageRecords).values({
            id,
            userId: record.userId,
            projectId: record.projectId,
            category: record.category,
            subcategory: record.subcategory,
            creditsUsed: record.creditsUsed,
            tokensUsed: record.tokensUsed,
            model: record.model,
            endpoint: record.endpoint,
            metadata: record.metadata,
            timestamp: now.toISOString(),
        });

        // Update daily summary
        await this.updateDailySummary(record.userId, dateStr, record);
    }

    private async updateDailySummary(userId: string, date: string, record: UsageRecord): Promise<void> {
        const summaryId = `${userId}-${date}`;

        const existing = await db.select()
            .from(usageSummaries)
            .where(eq(usageSummaries.id, summaryId))
            .get();

        if (existing) {
            // Update existing summary
            const updates: Record<string, number> = {
                totalCredits: existing.totalCredits + record.creditsUsed,
            };

            if (record.category === 'generation') {
                updates.generationCredits = existing.generationCredits + record.creditsUsed;
                updates.generationCount = existing.generationCount + 1;
                updates.totalTokens = existing.totalTokens + (record.tokensUsed || 0);
            } else if (record.category === 'deployment') {
                updates.deploymentCredits = existing.deploymentCredits + record.creditsUsed;
            } else if (record.category === 'api_call') {
                updates.apiCredits = existing.apiCredits + record.creditsUsed;
            }

            await db.update(usageSummaries)
                .set(updates)
                .where(eq(usageSummaries.id, summaryId));
        } else {
            // Create new summary
            await db.insert(usageSummaries).values({
                id: summaryId,
                userId,
                date,
                totalCredits: record.creditsUsed,
                generationCredits: record.category === 'generation' ? record.creditsUsed : 0,
                deploymentCredits: record.category === 'deployment' ? record.creditsUsed : 0,
                apiCredits: record.category === 'api_call' ? record.creditsUsed : 0,
                generationCount: record.category === 'generation' ? 1 : 0,
                totalTokens: record.tokensUsed || 0,
            });
        }
    }

    /**
     * Get usage for current billing period (month)
     */
    async getMonthlyUsage(userId: string): Promise<{
        totalCredits: number;
        byCategory: Record<string, number>;
        generationCount: number;
        totalTokens: number;
    }> {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthStartStr = monthStart.toISOString().split('T')[0];

        const summaries = await db.select()
            .from(usageSummaries)
            .where(
                and(
                    eq(usageSummaries.userId, userId),
                    gte(usageSummaries.date, monthStartStr)
                )
            );

        const result = {
            totalCredits: 0,
            byCategory: {
                generation: 0,
                deployment: 0,
                api_call: 0,
            },
            generationCount: 0,
            totalTokens: 0,
        };

        for (const summary of summaries) {
            result.totalCredits += summary.totalCredits;
            result.byCategory.generation += summary.generationCredits;
            result.byCategory.deployment += summary.deploymentCredits;
            result.byCategory.api_call += summary.apiCredits;
            result.generationCount += summary.generationCount;
            result.totalTokens += summary.totalTokens;
        }

        return result;
    }

    /**
     * Get daily usage history
     */
    async getDailyHistory(userId: string, days: number = 30): Promise<UsageSummary[]> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];

        const summaries = await db.select()
            .from(usageSummaries)
            .where(
                and(
                    eq(usageSummaries.userId, userId),
                    gte(usageSummaries.date, startDateStr)
                )
            )
            .orderBy(desc(usageSummaries.date));

        return summaries;
    }

    /**
     * Get recent usage records
     */
    async getRecentRecords(userId: string, limit: number = 50): Promise<Array<{
        id: string;
        category: string;
        creditsUsed: number;
        model: string | null;
        timestamp: string;
    }>> {
        const records = await db.select({
            id: usageRecords.id,
            category: usageRecords.category,
            creditsUsed: usageRecords.creditsUsed,
            model: usageRecords.model,
            timestamp: usageRecords.timestamp,
        })
            .from(usageRecords)
            .where(eq(usageRecords.userId, userId))
            .orderBy(desc(usageRecords.timestamp))
            .limit(limit);

        return records;
    }

    /**
     * Get usage by model
     */
    async getUsageByModel(userId: string, days: number = 30): Promise<Map<string, { credits: number; tokens: number; count: number }>> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString();

        const records = await db.select()
            .from(usageRecords)
            .where(
                and(
                    eq(usageRecords.userId, userId),
                    gte(usageRecords.timestamp, startDateStr)
                )
            );

        const byModel = new Map<string, { credits: number; tokens: number; count: number }>();

        for (const record of records) {
            const model = record.model || 'unknown';
            const existing = byModel.get(model) || { credits: 0, tokens: 0, count: 0 };
            byModel.set(model, {
                credits: existing.credits + record.creditsUsed,
                tokens: existing.tokens + (record.tokensUsed || 0),
                count: existing.count + 1,
            });
        }

        return byModel;
    }
}

// Singleton
let usageService: UsageService | null = null;

export function getUsageService(): UsageService {
    if (!usageService) {
        usageService = new UsageService();
    }
    return usageService;
}

