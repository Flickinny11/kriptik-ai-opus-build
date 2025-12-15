/**
 * Interaction Tracker & Learning System
 *
 * Tracks user interactions with AI suggestions to continuously improve
 * the platform's responses and recommendations.
 */

import { createHash } from 'crypto';
import { db } from '../../db.js';
import { interactionLogs } from '../../schema.js';
import { desc, eq } from 'drizzle-orm';
import { getAIResponseCache } from '../performance/cache-service.js';

// ============================================================================
// TYPES
// ============================================================================

export interface Interaction {
    id: string;
    userId: string;
    projectId?: string;
    timestamp: Date;

    // Request details
    request: {
        type: 'generation' | 'fix' | 'explanation' | 'template' | 'deployment';
        prompt: string;
        promptHash: string;
        context?: string;
        model?: string;
    };

    // Response details
    response: {
        content: string;
        contentHash: string;
        tokensUsed: number;
        latencyMs: number;
        model: string;
    };

    // User feedback
    feedback?: {
        rating: 'positive' | 'negative' | 'neutral';
        applied: boolean;
        modified: boolean;
        comment?: string;
    };

    // Outcome tracking
    outcome?: {
        successful: boolean;
        errorsIntroduced: number;
        buildsSuccessfully: boolean;
        testsPass: boolean;
    };
}

export interface InteractionPattern {
    promptPattern: string;
    successRate: number;
    avgRating: number;
    totalInteractions: number;
    bestModel: string;
    commonModifications: string[];
    lastUpdated: Date;
}

export interface LearningInsight {
    category: 'prompt' | 'model' | 'pattern' | 'preference';
    insight: string;
    confidence: number;
    basedOn: number;  // Number of interactions this is based on
    actionable: boolean;
    recommendation?: string;
}

export interface ModelPerformance {
    model: string;
    taskType: string;
    successRate: number;
    avgRating: number;
    avgLatency: number;
    avgTokens: number;
    totalUsage: number;
    costEfficiency: number;
}

// ============================================================================
// INTERACTION TRACKER
// ============================================================================

export class InteractionTracker {
    private interactions: Map<string, Interaction> = new Map();
    private patterns: Map<string, InteractionPattern> = new Map();
    private modelPerformance: Map<string, ModelPerformance> = new Map();

    /**
     * Record a new interaction
     */
    async recordInteraction(interaction: Omit<Interaction, 'id' | 'timestamp'>): Promise<string> {
        const id = this.generateId();

        const fullInteraction: Interaction = {
            id,
            timestamp: new Date(),
            ...interaction,
            request: {
                ...interaction.request,
                promptHash: this.hashText(interaction.request.prompt),
            },
            response: {
                ...interaction.response,
                contentHash: this.hashText(interaction.response.content),
            },
        };

        this.interactions.set(id, fullInteraction);

        // Update patterns asynchronously
        this.updatePatterns(fullInteraction);

        // Persist to database
        await this.persistInteraction(fullInteraction);

        return id;
    }

    /**
     * Record user feedback on an interaction
     */
    async recordFeedback(
        interactionId: string,
        feedback: Interaction['feedback']
    ): Promise<void> {
        const interaction = this.interactions.get(interactionId);
        if (!interaction) return;

        interaction.feedback = feedback;

        // Update model performance based on feedback
        this.updateModelPerformance(interaction);

        // Update patterns based on feedback
        this.updatePatterns(interaction);

        // Persist update
        await this.persistInteraction(interaction);
    }

    /**
     * Record outcome of an interaction
     */
    async recordOutcome(
        interactionId: string,
        outcome: Interaction['outcome']
    ): Promise<void> {
        const interaction = this.interactions.get(interactionId);
        if (!interaction) return;

        interaction.outcome = outcome;

        // Update success rates
        this.updateModelPerformance(interaction);

        // Persist update
        await this.persistInteraction(interaction);
    }

    /**
     * Get insights from interactions
     */
    getInsights(): LearningInsight[] {
        const insights: LearningInsight[] = [];

        // Analyze model performance
        const models = Array.from(this.modelPerformance.values());
        if (models.length > 0) {
            const bestModel = models.reduce((a, b) =>
                a.successRate * a.costEfficiency > b.successRate * b.costEfficiency ? a : b
            );

            insights.push({
                category: 'model',
                insight: `${bestModel.model} has the best success/cost ratio for ${bestModel.taskType}`,
                confidence: Math.min(bestModel.totalUsage / 100, 1),
                basedOn: bestModel.totalUsage,
                actionable: true,
                recommendation: `Consider defaulting to ${bestModel.model} for ${bestModel.taskType} tasks`,
            });
        }

        // Analyze patterns
        for (const pattern of this.patterns.values()) {
            if (pattern.totalInteractions >= 5) {
                if (pattern.successRate < 0.5) {
                    insights.push({
                        category: 'prompt',
                        insight: `Low success rate (${(pattern.successRate * 100).toFixed(0)}%) for "${pattern.promptPattern}"`,
                        confidence: Math.min(pattern.totalInteractions / 20, 1),
                        basedOn: pattern.totalInteractions,
                        actionable: true,
                        recommendation: 'Consider adding more context or examples for this type of request',
                    });
                }

                if (pattern.commonModifications.length > 0) {
                    insights.push({
                        category: 'pattern',
                        insight: `Users often modify responses for "${pattern.promptPattern}"`,
                        confidence: Math.min(pattern.totalInteractions / 20, 1),
                        basedOn: pattern.totalInteractions,
                        actionable: true,
                        recommendation: `Common modifications: ${pattern.commonModifications.slice(0, 3).join(', ')}`,
                    });
                }
            }
        }

        return insights;
    }

    /**
     * Get model recommendations for a task type
     */
    getModelRecommendation(taskType: string): string | null {
        const performances = Array.from(this.modelPerformance.values())
            .filter(p => p.taskType === taskType && p.totalUsage >= 5)
            .sort((a, b) => (b.successRate * b.costEfficiency) - (a.successRate * a.costEfficiency));

        return performances[0]?.model || null;
    }

    /**
     * Get performance stats for a model
     */
    getModelStats(model: string): ModelPerformance | null {
        return this.modelPerformance.get(model) || null;
    }

    /**
     * Get all model performance data
     */
    getAllModelStats(): ModelPerformance[] {
        return Array.from(this.modelPerformance.values());
    }

    /**
     * Check if a similar prompt has good cached results
     */
    async getCachedGoodResult(prompt: string, taskType: string): Promise<string | null> {
        const cache = getAIResponseCache();

        // Check if we have a cached result with positive feedback
        const cacheKey = cache.aiKey(taskType, prompt);
        const cached = await cache.get<{ content: string; rating: string }>(cacheKey);

        if (cached && cached.rating === 'positive') {
            return cached.content;
        }

        return null;
    }

    /**
     * Cache a good result for reuse
     */
    async cacheGoodResult(prompt: string, taskType: string, content: string): Promise<void> {
        const cache = getAIResponseCache();
        const cacheKey = cache.aiKey(taskType, prompt);
        cache.set(cacheKey, { content, rating: 'positive' }, 7200);  // 2 hour TTL
    }

    // =========================================================================
    // PRIVATE METHODS
    // =========================================================================

    private generateId(): string {
        return `int_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    private hashText(text: string): string {
        return createHash('sha256').update(text).digest('hex').substring(0, 16);
    }

    private extractPromptPattern(prompt: string): string {
        // Extract a simplified pattern from the prompt
        // Remove specific identifiers, code snippets, etc.
        return prompt
            .toLowerCase()
            .replace(/```[\s\S]*?```/g, '[CODE]')
            .replace(/\{[^}]+\}/g, '[PLACEHOLDER]')
            .replace(/['"][^'"]+['"]/g, '[STRING]')
            .replace(/\d+/g, '[NUM]')
            .substring(0, 100)
            .trim();
    }

    private updatePatterns(interaction: Interaction): void {
        const pattern = this.extractPromptPattern(interaction.request.prompt);

        const existing = this.patterns.get(pattern) || {
            promptPattern: pattern,
            successRate: 0,
            avgRating: 0,
            totalInteractions: 0,
            bestModel: interaction.response.model,
            commonModifications: [],
            lastUpdated: new Date(),
        };

        existing.totalInteractions++;
        existing.lastUpdated = new Date();

        // Update success rate if we have outcome data
        if (interaction.outcome) {
            const currentSuccess = existing.successRate * (existing.totalInteractions - 1);
            existing.successRate = (currentSuccess + (interaction.outcome.successful ? 1 : 0)) / existing.totalInteractions;
        }

        // Update rating if we have feedback
        if (interaction.feedback) {
            const ratingValue = interaction.feedback.rating === 'positive' ? 1 :
                               interaction.feedback.rating === 'negative' ? 0 : 0.5;
            const currentRating = existing.avgRating * (existing.totalInteractions - 1);
            existing.avgRating = (currentRating + ratingValue) / existing.totalInteractions;

            // Track modifications
            if (interaction.feedback.modified && interaction.feedback.comment) {
                existing.commonModifications.push(interaction.feedback.comment);
                // Keep only top 10 modifications
                existing.commonModifications = existing.commonModifications.slice(-10);
            }
        }

        this.patterns.set(pattern, existing);
    }

    private updateModelPerformance(interaction: Interaction): void {
        const key = `${interaction.response.model}:${interaction.request.type}`;

        const existing = this.modelPerformance.get(key) || {
            model: interaction.response.model,
            taskType: interaction.request.type,
            successRate: 0,
            avgRating: 0,
            avgLatency: 0,
            avgTokens: 0,
            totalUsage: 0,
            costEfficiency: 1,
        };

        existing.totalUsage++;

        // Update latency and tokens
        existing.avgLatency = (existing.avgLatency * (existing.totalUsage - 1) + interaction.response.latencyMs) / existing.totalUsage;
        existing.avgTokens = (existing.avgTokens * (existing.totalUsage - 1) + interaction.response.tokensUsed) / existing.totalUsage;

        // Update success rate from outcome
        if (interaction.outcome) {
            const currentSuccess = existing.successRate * (existing.totalUsage - 1);
            existing.successRate = (currentSuccess + (interaction.outcome.successful ? 1 : 0)) / existing.totalUsage;
        }

        // Update rating from feedback
        if (interaction.feedback) {
            const ratingValue = interaction.feedback.rating === 'positive' ? 1 :
                               interaction.feedback.rating === 'negative' ? 0 : 0.5;
            const currentRating = existing.avgRating * (existing.totalUsage - 1);
            existing.avgRating = (currentRating + ratingValue) / existing.totalUsage;
        }

        // Calculate cost efficiency (higher is better)
        // Based on success rate and inverse of token usage
        existing.costEfficiency = existing.successRate / (existing.avgTokens / 1000 + 0.1);

        this.modelPerformance.set(key, existing);
    }

    private async persistInteraction(interaction: Interaction): Promise<void> {
        try {
            const [existing] = await db.select()
                .from(interactionLogs)
                .where(eq(interactionLogs.id, interaction.id))
                .limit(1);

            if (existing) {
                await db.update(interactionLogs)
                    .set({
                        data: interaction,
                        updatedAt: new Date().toISOString()
                    })
                    .where(eq(interactionLogs.id, interaction.id));
            } else {
                await db.insert(interactionLogs).values({
                    id: interaction.id,
                    userId: interaction.userId,
                    projectId: interaction.projectId,
                    data: interaction,
                });
            }
        } catch (error) {
            console.warn('Failed to persist interaction:', error);
        }
    }

    /**
     * Load historical data for analysis
     */
    async loadHistoricalData(limit = 1000): Promise<void> {
        try {
            const results = await db.select()
                .from(interactionLogs)
                .orderBy(desc(interactionLogs.createdAt))
                .limit(limit);

            for (const row of results) {
                const interaction = row.data as Interaction;
                this.interactions.set(interaction.id, interaction);
                this.updatePatterns(interaction);
                this.updateModelPerformance(interaction);
            }
        } catch (error) {
            console.warn('Failed to load historical data:', error);
        }
    }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: InteractionTracker | null = null;

export function getInteractionTracker(): InteractionTracker {
    if (!instance) {
        instance = new InteractionTracker();
    }
    return instance;
}

