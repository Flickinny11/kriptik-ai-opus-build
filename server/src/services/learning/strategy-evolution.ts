/**
 * Strategy Evolution Engine
 *
 * Evolves problem-solving strategies based on build outcomes.
 * Implements curriculum learning, active learning, and strategy mutation.
 *
 * This is part of Layer 4 (Meta-Learning) of the Autonomous Learning Engine.
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { strategies, learningInsights } from '../../schema.js';
import { eq, desc } from 'drizzle-orm';
import { getModelRouter } from '../ai/model-router.js';
import type {
    Strategy,
    LearningInsight,
    DecisionTrace,
    BuildRecord,
    FlywheelMetrics,
} from './types.js';

// =============================================================================
// STRATEGY EVOLUTION SERVICE
// =============================================================================

export class StrategyEvolutionService {
    private modelRouter = getModelRouter();
    private strategyCache: Map<string, Strategy> = new Map();

    // =========================================================================
    // STRATEGY SELECTION
    // =========================================================================

    /**
     * Select the best strategy for a given context
     */
    async selectStrategy(params: {
        domain: string;
        context: string;
        fallbackStrategy?: string;
    }): Promise<Strategy | null> {
        try {
            // Get all strategies for this domain
            const domainStrategies = await db.select()
                .from(strategies)
                .where(eq(strategies.domain, params.domain));

            if (domainStrategies.length === 0) {
                return params.fallbackStrategy
                    ? this.createDefaultStrategy(params.domain, params.fallbackStrategy)
                    : null;
            }

            // Score strategies based on context match and success rate
            const scoredStrategies = domainStrategies.map(s => {
                const contexts = (s.contextsWhereEffective as string[]) || [];
                const contextMatch = contexts.some(c =>
                    params.context.toLowerCase().includes(c.toLowerCase())
                ) ? 1.5 : 1.0;

                // Combine success rate with exploration bonus for experimental strategies
                const explorationBonus = s.isExperimental ? 10 : 0;
                const score = ((s.successRate || 50) + explorationBonus) * contextMatch;

                return { strategy: s, score };
            });

            // Use epsilon-greedy selection (10% exploration)
            const shouldExplore = Math.random() < 0.1;

            if (shouldExplore) {
                // Pick randomly from experimental or low-usage strategies
                const experimentalOrLowUsage = scoredStrategies.filter(
                    s => s.strategy.isExperimental || (s.strategy.totalUses || 0) < 10
                );
                if (experimentalOrLowUsage.length > 0) {
                    const randomIdx = Math.floor(Math.random() * experimentalOrLowUsage.length);
                    return this.dbStrategyToStrategy(experimentalOrLowUsage[randomIdx].strategy);
                }
            }

            // Otherwise, pick the best scoring strategy
            scoredStrategies.sort((a, b) => b.score - a.score);
            return this.dbStrategyToStrategy(scoredStrategies[0].strategy);
        } catch (error) {
            console.error('[StrategyEvolution] Failed to select strategy:', error);
            return null;
        }
    }

    /**
     * Create a default strategy when none exist
     */
    private async createDefaultStrategy(domain: string, description: string): Promise<Strategy> {
        const strategy: Strategy = {
            strategyId: uuidv4(),
            domain,
            name: `Default ${domain} Strategy`,
            description,
            successRate: 50, // Start at neutral
            avgAttempts: 1,
            avgTimeMs: 0,
            contextsWhereEffective: [],
            derivedFrom: null,
            isExperimental: true,
            totalUses: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        await this.storeStrategy(strategy);
        return strategy;
    }

    // =========================================================================
    // STRATEGY EVOLUTION
    // =========================================================================

    /**
     * Record strategy usage and update metrics
     */
    async recordStrategyUsage(params: {
        strategyId: string;
        wasSuccessful: boolean;
        attemptsRequired: number;
        timeMs: number;
        context: string;
    }): Promise<void> {
        try {
            const [strategy] = await db.select()
                .from(strategies)
                .where(eq(strategies.id, params.strategyId))
                .limit(1);

            if (!strategy) return;

            const totalUses = (strategy.totalUses || 0) + 1;
            const currentSuccessRate = strategy.successRate || 50;

            // Update success rate with exponential moving average
            const alpha = 0.1; // Learning rate
            const newSuccessRate = Math.round(
                (1 - alpha) * currentSuccessRate + alpha * (params.wasSuccessful ? 100 : 0)
            );

            // Update average attempts
            const currentAvgAttempts = strategy.avgAttempts || 1;
            const newAvgAttempts = (currentAvgAttempts * (totalUses - 1) + params.attemptsRequired) / totalUses;

            // Update average time
            const currentAvgTime = strategy.avgTimeMs || 0;
            const newAvgTime = Math.round(
                (currentAvgTime * (totalUses - 1) + params.timeMs) / totalUses
            );

            // Update contexts where effective
            const contexts = (strategy.contextsWhereEffective as string[]) || [];
            if (params.wasSuccessful && !contexts.includes(params.context)) {
                contexts.push(params.context);
            }

            // Graduate from experimental after 20 uses
            const isExperimental = (strategy.isExperimental && totalUses < 20);

            await db.update(strategies)
                .set({
                    totalUses,
                    successRate: newSuccessRate,
                    avgAttempts: Math.round(newAvgAttempts * 10) / 10,
                    avgTimeMs: newAvgTime,
                    contextsWhereEffective: contexts,
                    isExperimental,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(strategies.id, params.strategyId));

            this.strategyCache.delete(params.strategyId);
        } catch (error) {
            console.error('[StrategyEvolution] Failed to record strategy usage:', error);
        }
    }

    /**
     * Evolve strategies based on performance data
     */
    async evolveStrategies(): Promise<{
        mutationsCreated: number;
        strategiesRetired: number;
        insightsGenerated: number;
    }> {
        const results = {
            mutationsCreated: 0,
            strategiesRetired: 0,
            insightsGenerated: 0,
        };

        try {
            const allStrategies = await db.select().from(strategies);

            // Identify top performers for each domain
            const byDomain: Map<string, typeof allStrategies> = new Map();
            for (const s of allStrategies) {
                const list = byDomain.get(s.domain) || [];
                list.push(s);
                byDomain.set(s.domain, list);
            }

            for (const [domain, domainStrategies] of byDomain) {
                // Sort by success rate
                domainStrategies.sort((a, b) => (b.successRate || 0) - (a.successRate || 0));

                // Mutate top performers
                const topPerformers = domainStrategies.filter(s =>
                    (s.successRate || 0) >= 70 && (s.totalUses || 0) >= 10
                );

                for (const topStrategy of topPerformers.slice(0, 2)) {
                    const mutation = await this.mutateStrategy(topStrategy);
                    if (mutation) {
                        await this.storeStrategy(mutation);
                        results.mutationsCreated++;
                    }
                }

                // Retire poor performers
                const poorPerformers = domainStrategies.filter(s =>
                    (s.successRate || 50) < 30 && (s.totalUses || 0) >= 20 && !s.isExperimental
                );

                for (const poorStrategy of poorPerformers) {
                    await db.delete(strategies).where(eq(strategies.id, poorStrategy.id));
                    this.strategyCache.delete(poorStrategy.id);
                    results.strategiesRetired++;

                    // Generate insight about retirement
                    await this.generateInsight({
                        category: 'stuck',
                        insight: `Strategy "${poorStrategy.name}" retired due to low success rate`,
                        evidence: `Success rate: ${poorStrategy.successRate}%, Uses: ${poorStrategy.totalUses}`,
                        recommendedAction: 'Consider alternative approaches for this problem type',
                        expectedImpact: 'Improve overall success rate by not using failing strategies',
                    });
                    results.insightsGenerated++;
                }
            }

            return results;
        } catch (error) {
            console.error('[StrategyEvolution] Failed to evolve strategies:', error);
            return results;
        }
    }

    /**
     * Create a mutated variant of a successful strategy
     */
    private async mutateStrategy(parent: typeof strategies.$inferSelect): Promise<Strategy | null> {
        const mutationPrompt = `Analyze this successful strategy and propose a MUTATION that might improve it further.

## Parent Strategy
- Name: ${parent.name}
- Domain: ${parent.domain}
- Description: ${parent.description}
- Success Rate: ${parent.successRate}%
- Avg Attempts: ${parent.avgAttempts}
- Contexts where effective: ${(parent.contextsWhereEffective as string[]).join(', ')}

## Mutation Guidelines
1. Keep the core insight that makes this strategy successful
2. Add a new technique or refinement
3. Or specialize for a particular context
4. Or combine with another approach

## Output Format (JSON only)
{
  "name": "Mutated strategy name",
  "description": "How this mutation differs and why it might be better",
  "hypothesis": "What we expect this mutation to improve"
}

Only output JSON.`;

        try {
            const response = await this.modelRouter.generate({
                prompt: mutationPrompt,
                taskType: 'strategy_evolution',
                temperature: 0.7, // Higher creativity for mutations
            });

            const parsed = this.parseJSON<{
                name: string;
                description: string;
                hypothesis: string;
            }>(response.content);

            return {
                strategyId: uuidv4(),
                domain: parent.domain,
                name: parsed.name,
                description: parsed.description,
                successRate: 50, // Start at neutral
                avgAttempts: 1,
                avgTimeMs: 0,
                contextsWhereEffective: [],
                derivedFrom: parent.id,
                isExperimental: true,
                totalUses: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
        } catch (error) {
            console.error('[StrategyEvolution] Failed to mutate strategy:', error);
            return null;
        }
    }

    // =========================================================================
    // META-LEARNING INSIGHTS
    // =========================================================================

    /**
     * Generate learning insights from system performance
     */
    async generateSystemInsights(metrics: FlywheelMetrics): Promise<LearningInsight[]> {
        const insights: LearningInsight[] = [];

        // Check for improvement trends
        if (metrics.meta.systemImprovement > 5) {
            insights.push({
                insightId: uuidv4(),
                category: 'improving',
                insight: `System success rate improved by ${metrics.meta.systemImprovement}%`,
                evidence: `Based on ${metrics.experienceCapture.totalBuilds} builds`,
                recommendedAction: 'Continue current learning strategy, increase training frequency',
                expectedImpact: 'Maintain improvement trajectory',
                confidence: 80,
                status: 'pending',
                actionedAt: null,
                createdAt: new Date().toISOString(),
            });
        }

        // Check for stuck areas
        if (metrics.judgment.avgCodeQualityScore < 60) {
            insights.push({
                insightId: uuidv4(),
                category: 'stuck',
                insight: 'Code quality scores consistently below target',
                evidence: `Average score: ${metrics.judgment.avgCodeQualityScore}`,
                recommendedAction: 'Increase code review judgment frequency, add more preference pairs',
                expectedImpact: 'Improve code generation quality',
                confidence: 75,
                status: 'pending',
                actionedAt: null,
                createdAt: new Date().toISOString(),
            });
        }

        // Check for new capabilities
        const recentPatterns = metrics.patterns.mostUsedPatterns.slice(0, 3);
        if (recentPatterns.some(p => p.uses > 20)) {
            insights.push({
                insightId: uuidv4(),
                category: 'new_capability',
                insight: 'Patterns showing strong adoption and success',
                evidence: `Top patterns: ${recentPatterns.map(p => `${p.name} (${p.uses} uses)`).join(', ')}`,
                recommendedAction: 'Consider promoting these patterns to core system prompts',
                expectedImpact: 'Faster builds by having patterns readily available',
                confidence: 70,
                status: 'pending',
                actionedAt: null,
                createdAt: new Date().toISOString(),
            });
        }

        // Store insights
        for (const insight of insights) {
            await this.storeInsight(insight);
        }

        return insights;
    }

    /**
     * Generate a specific insight
     */
    async generateInsight(params: {
        category: LearningInsight['category'];
        insight: string;
        evidence: string;
        recommendedAction: string;
        expectedImpact: string;
        confidence?: number;
    }): Promise<LearningInsight> {
        const insight: LearningInsight = {
            insightId: uuidv4(),
            category: params.category,
            insight: params.insight,
            evidence: params.evidence,
            recommendedAction: params.recommendedAction,
            expectedImpact: params.expectedImpact,
            confidence: params.confidence || 60,
            status: 'pending',
            actionedAt: null,
            createdAt: new Date().toISOString(),
        };

        await this.storeInsight(insight);
        return insight;
    }

    /**
     * Action an insight
     */
    async actionInsight(insightId: string): Promise<void> {
        try {
            await db.update(learningInsights)
                .set({
                    status: 'actioned',
                    actionedAt: new Date().toISOString(),
                })
                .where(eq(learningInsights.id, insightId));
        } catch (error) {
            console.error('[StrategyEvolution] Failed to action insight:', error);
        }
    }

    /**
     * Get pending insights
     */
    async getPendingInsights(): Promise<LearningInsight[]> {
        try {
            const results = await db.select()
                .from(learningInsights)
                .where(eq(learningInsights.status, 'pending'));

            return results.map(r => ({
                insightId: r.id,
                category: r.category as LearningInsight['category'],
                insight: r.insight,
                evidence: r.evidence,
                recommendedAction: r.recommendedAction,
                expectedImpact: r.expectedImpact,
                confidence: r.confidence || 60,
                status: r.status as LearningInsight['status'],
                actionedAt: r.actionedAt,
                createdAt: r.createdAt,
            }));
        } catch (error) {
            console.error('[StrategyEvolution] Failed to get insights:', error);
            return [];
        }
    }

    // =========================================================================
    // CURRICULUM LEARNING
    // =========================================================================

    /**
     * Get curriculum for training - ordered by difficulty
     */
    async getCurriculum(params: {
        domain: string;
        limit?: number;
    }): Promise<Array<{ task: string; difficulty: number; expectedPatterns: string[] }>> {
        // This would normally pull from a curriculum database
        // For now, return a structured curriculum based on domain
        const curriculums: Record<string, Array<{ task: string; difficulty: number; expectedPatterns: string[] }>> = {
            code_generation: [
                { task: 'Create a simple React component', difficulty: 1, expectedPatterns: ['component_structure'] },
                { task: 'Add state management to component', difficulty: 2, expectedPatterns: ['state_management'] },
                { task: 'Implement API integration', difficulty: 3, expectedPatterns: ['api_integration', 'error_handling'] },
                { task: 'Create complex form with validation', difficulty: 4, expectedPatterns: ['form_handling', 'validation'] },
                { task: 'Build real-time data sync', difficulty: 5, expectedPatterns: ['websocket', 'optimistic_updates'] },
            ],
            error_recovery: [
                { task: 'Fix missing import', difficulty: 1, expectedPatterns: ['import_resolution'] },
                { task: 'Fix type error', difficulty: 2, expectedPatterns: ['type_correction'] },
                { task: 'Fix runtime null reference', difficulty: 3, expectedPatterns: ['null_check'] },
                { task: 'Fix async/await issue', difficulty: 4, expectedPatterns: ['async_fix'] },
                { task: 'Fix complex integration bug', difficulty: 5, expectedPatterns: ['integration_debug'] },
            ],
            design: [
                { task: 'Apply basic color scheme', difficulty: 1, expectedPatterns: ['color_system'] },
                { task: 'Implement typography hierarchy', difficulty: 2, expectedPatterns: ['typography'] },
                { task: 'Add micro-interactions', difficulty: 3, expectedPatterns: ['animation'] },
                { task: 'Create cohesive design system', difficulty: 4, expectedPatterns: ['design_system'] },
                { task: 'Achieve anti-slop aesthetic', difficulty: 5, expectedPatterns: ['anti_slop'] },
            ],
        };

        const curriculum = curriculums[params.domain] || [];
        return curriculum.slice(0, params.limit || curriculum.length);
    }

    // =========================================================================
    // STATISTICS
    // =========================================================================

    /**
     * Get strategy evolution statistics
     */
    async getStatistics(): Promise<{
        totalStrategies: number;
        experimentalStrategies: number;
        avgSuccessRate: number;
        strategiesByDomain: Record<string, number>;
        pendingInsights: number;
        totalInsights: number;
    }> {
        try {
            const allStrategies = await db.select().from(strategies);
            const allInsights = await db.select().from(learningInsights);

            const experimental = allStrategies.filter(s => s.isExperimental).length;
            const totalSuccess = allStrategies.reduce((sum, s) => sum + (s.successRate || 0), 0);
            const avgSuccess = allStrategies.length > 0
                ? Math.round(totalSuccess / allStrategies.length)
                : 0;

            const byDomain: Record<string, number> = {};
            for (const s of allStrategies) {
                byDomain[s.domain] = (byDomain[s.domain] || 0) + 1;
            }

            const pending = allInsights.filter(i => i.status === 'pending').length;

            return {
                totalStrategies: allStrategies.length,
                experimentalStrategies: experimental,
                avgSuccessRate: avgSuccess,
                strategiesByDomain: byDomain,
                pendingInsights: pending,
                totalInsights: allInsights.length,
            };
        } catch (error) {
            console.error('[StrategyEvolution] Failed to get statistics:', error);
            return {
                totalStrategies: 0,
                experimentalStrategies: 0,
                avgSuccessRate: 0,
                strategiesByDomain: {},
                pendingInsights: 0,
                totalInsights: 0,
            };
        }
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private async storeStrategy(strategy: Strategy): Promise<void> {
        try {
            await db.insert(strategies).values({
                id: strategy.strategyId,
                domain: strategy.domain,
                name: strategy.name,
                description: strategy.description,
                successRate: strategy.successRate,
                avgAttempts: Math.round(strategy.avgAttempts),
                avgTimeMs: strategy.avgTimeMs,
                contextsWhereEffective: strategy.contextsWhereEffective,
                derivedFrom: strategy.derivedFrom,
                isExperimental: strategy.isExperimental,
                totalUses: strategy.totalUses,
            });

            this.strategyCache.set(strategy.strategyId, strategy);
        } catch (error) {
            console.error('[StrategyEvolution] Failed to store strategy:', error);
        }
    }

    private async storeInsight(insight: LearningInsight): Promise<void> {
        try {
            await db.insert(learningInsights).values({
                id: insight.insightId,
                category: insight.category,
                insight: insight.insight,
                evidence: insight.evidence,
                recommendedAction: insight.recommendedAction,
                expectedImpact: insight.expectedImpact,
                confidence: insight.confidence,
                status: insight.status,
            });
        } catch (error) {
            console.error('[StrategyEvolution] Failed to store insight:', error);
        }
    }

    private dbStrategyToStrategy(dbStrategy: typeof strategies.$inferSelect): Strategy {
        return {
            strategyId: dbStrategy.id,
            domain: dbStrategy.domain,
            name: dbStrategy.name,
            description: dbStrategy.description,
            successRate: dbStrategy.successRate || 50,
            avgAttempts: dbStrategy.avgAttempts || 1,
            avgTimeMs: dbStrategy.avgTimeMs || 0,
            contextsWhereEffective: (dbStrategy.contextsWhereEffective as string[]) || [],
            derivedFrom: dbStrategy.derivedFrom,
            isExperimental: dbStrategy.isExperimental || false,
            totalUses: dbStrategy.totalUses || 0,
            createdAt: dbStrategy.createdAt,
            updatedAt: dbStrategy.updatedAt,
        };
    }

    private parseJSON<T>(content: string): T {
        const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : content;

        try {
            return JSON.parse(jsonStr.trim());
        } catch {
            const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (objectMatch) {
                return JSON.parse(objectMatch[0]);
            }
            throw new Error('Failed to parse JSON from response');
        }
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: StrategyEvolutionService | null = null;

export function getStrategyEvolutionService(): StrategyEvolutionService {
    if (!instance) {
        instance = new StrategyEvolutionService();
    }
    return instance;
}

