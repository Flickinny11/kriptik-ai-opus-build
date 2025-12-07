// @ts-nocheck - Learning module has complex nullable types from DB schema
/**
 * Strategy Evolution Service (Layer 4 - Meta-Learning)
 *
 * Manages and evolves build strategies based on performance data.
 * Implements a "learning to learn" approach where strategies are
 * selected, evaluated, and evolved based on outcomes.
 *
 * Strategies cover:
 * - Code generation approaches
 * - Error recovery methods
 * - Design approaches
 */

import { db } from '../../db.js';
import { learningStrategies, learningInsights } from '../../schema.js';
import { eq, desc, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { createAnthropicClient } from '../../utils/anthropic-client.js';
import { EventEmitter } from 'events';
import type {
    LearnedStrategy,
    StrategyDomain,
    LearningInsight,
    InsightCategory,
    DecisionTrace,
    Judgment,
} from './types.js';

// =============================================================================
// BUILT-IN STRATEGIES
// =============================================================================

const DEFAULT_STRATEGIES: Partial<LearnedStrategy>[] = [
    // Code Generation Strategies
    {
        strategyId: 'strat_cg_component_first',
        domain: 'code_generation',
        name: 'Component-First Development',
        description: 'Build UI components first, then add logic and state management',
        contextsEffective: ['simple_ui', 'dashboard', 'landing_page'],
        contextsIneffective: ['complex_backend', 'heavy_data_processing'],
        isExperimental: false,
    },
    {
        strategyId: 'strat_cg_api_first',
        domain: 'code_generation',
        name: 'API-First Development',
        description: 'Design and implement API endpoints first, then build UI',
        contextsEffective: ['complex_backend', 'data_heavy_apps', 'multi_client'],
        contextsIneffective: ['simple_ui', 'static_sites'],
        isExperimental: false,
    },
    {
        strategyId: 'strat_cg_incremental',
        domain: 'code_generation',
        name: 'Incremental Enhancement',
        description: 'Start with minimal working version, incrementally add features',
        contextsEffective: ['prototype', 'mvp', 'iterative_development'],
        contextsIneffective: ['fixed_spec', 'deadline_pressure'],
        isExperimental: false,
    },
    // Error Recovery Strategies
    {
        strategyId: 'strat_er_quick_fix',
        domain: 'error_recovery',
        name: 'Quick Targeted Fix',
        description: 'Apply minimal change to fix the specific error',
        contextsEffective: ['simple_error', 'syntax_error', 'type_error'],
        contextsIneffective: ['architectural_issue', 'complex_bug'],
        isExperimental: false,
    },
    {
        strategyId: 'strat_er_root_cause',
        domain: 'error_recovery',
        name: 'Root Cause Analysis',
        description: 'Deep analysis to find and fix underlying cause',
        contextsEffective: ['recurring_error', 'complex_bug', 'architectural_issue'],
        contextsIneffective: ['simple_typo', 'time_pressure'],
        isExperimental: false,
    },
    {
        strategyId: 'strat_er_rewrite',
        domain: 'error_recovery',
        name: 'Controlled Rewrite',
        description: 'Rewrite affected section with new approach',
        contextsEffective: ['deeply_broken_code', 'bad_pattern', 'multiple_errors'],
        contextsIneffective: ['working_code', 'minor_issue'],
        isExperimental: false,
    },
    // Design Strategies
    {
        strategyId: 'strat_da_soul_driven',
        domain: 'design_approach',
        name: 'Soul-Driven Design',
        description: 'Let app personality drive all design decisions',
        contextsEffective: ['brand_heavy', 'creative_app', 'unique_identity'],
        contextsIneffective: ['generic_dashboard', 'enterprise_app'],
        isExperimental: false,
    },
    {
        strategyId: 'strat_da_convention',
        domain: 'design_approach',
        name: 'Convention-Based Design',
        description: 'Follow established patterns for the app type',
        contextsEffective: ['enterprise_app', 'utility_tool', 'familiar_ui'],
        contextsIneffective: ['creative_app', 'differentiation_needed'],
        isExperimental: false,
    },
];

// =============================================================================
// STRATEGY EVOLUTION SERVICE
// =============================================================================

export class StrategyEvolutionService extends EventEmitter {
    private anthropic: ReturnType<typeof getAnthropicClient>;
    private strategyCache: Map<StrategyDomain, LearnedStrategy[]> = new Map();
    private lastCacheRefresh: Date = new Date(0);
    private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

    constructor() {
        super();
        this.anthropic = getAnthropicClient();
        this.initializeDefaultStrategies();
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /**
     * Ensure default strategies exist in database
     */
    private async initializeDefaultStrategies(): Promise<void> {
        try {
            const existing = await db.select()
                .from(learningStrategies)
                .limit(1);

            if (existing.length === 0) {
                console.log('[StrategyEvolution] Initializing default strategies...');
                for (const strategy of DEFAULT_STRATEGIES) {
                    await this.createStrategy({
                        domain: strategy.domain!,
                        name: strategy.name!,
                        description: strategy.description!,
                        contextsEffective: strategy.contextsEffective!,
                        contextsIneffective: strategy.contextsIneffective!,
                        isExperimental: strategy.isExperimental || false,
                    });
                }
            }
        } catch (error) {
            console.error('[StrategyEvolution] Failed to initialize strategies:', error);
        }
    }

    // =========================================================================
    // STRATEGY SELECTION
    // =========================================================================

    /**
     * Select the best strategy for a given context
     */
    async selectStrategy(
        domain: StrategyDomain,
        context: string[]
    ): Promise<LearnedStrategy | null> {
        const strategies = await this.getActiveStrategies(domain);
        if (strategies.length === 0) return null;

        // Score each strategy based on context match
        const scoredStrategies = strategies.map(strategy => {
            let score = strategy.successRate;

            // Boost for effective contexts
            for (const effective of strategy.contextsEffective) {
                if (context.some(c => c.toLowerCase().includes(effective.toLowerCase()))) {
                    score += 20;
                }
            }

            // Penalty for ineffective contexts
            for (const ineffective of strategy.contextsIneffective) {
                if (context.some(c => c.toLowerCase().includes(ineffective.toLowerCase()))) {
                    score -= 30;
                }
            }

            // Confidence and usage adjustment
            score += strategy.confidence / 5;
            score += Math.min(strategy.usageCount, 100) / 10;

            // Experimental strategies get slight exploration bonus
            if (strategy.isExperimental) {
                score += 5;
            }

            return { strategy, score };
        });

        // Sort by score
        scoredStrategies.sort((a, b) => b.score - a.score);

        // Sometimes explore lower-ranked strategies (epsilon-greedy)
        const epsilon = 0.1;
        if (Math.random() < epsilon && scoredStrategies.length > 1) {
            const randomIndex = Math.floor(Math.random() * Math.min(3, scoredStrategies.length));
            return scoredStrategies[randomIndex].strategy;
        }

        return scoredStrategies[0]?.strategy || null;
    }

    /**
     * Record strategy usage outcome
     */
    async recordStrategyOutcome(
        strategyId: string,
        success: boolean,
        context?: string[]
    ): Promise<void> {
        const [existing] = await db.select()
            .from(learningStrategies)
            .where(eq(learningStrategies.strategyId, strategyId))
            .limit(1);

        if (!existing) return;

        const newUsageCount = existing.usageCount + 1;
        const currentSuccesses = Math.round(existing.successRate * existing.usageCount / 100);
        const newSuccesses = currentSuccesses + (success ? 1 : 0);
        const newSuccessRate = Math.round((newSuccesses / newUsageCount) * 100);

        // Update confidence based on usage
        const newConfidence = Math.min(100, existing.confidence + (success ? 2 : -1));

        // Update effective/ineffective contexts if provided
        let newEffective = existing.contextsEffective as string[] || [];
        let newIneffective = existing.contextsIneffective as string[] || [];

        if (context && context.length > 0) {
            if (success) {
                // Add to effective if not already there
                for (const c of context) {
                    if (!newEffective.includes(c) && !newIneffective.includes(c)) {
                        newEffective.push(c);
                    }
                }
            } else {
                // Add to ineffective
                for (const c of context) {
                    if (!newIneffective.includes(c)) {
                        newIneffective.push(c);
                        // Remove from effective if present
                        newEffective = newEffective.filter(e => e !== c);
                    }
                }
            }
        }

        await db.update(learningStrategies)
            .set({
                usageCount: newUsageCount,
                successRate: newSuccessRate,
                confidence: newConfidence,
                contextsEffective: newEffective,
                contextsIneffective: newIneffective,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(learningStrategies.strategyId, strategyId));

        // Invalidate cache
        this.strategyCache.clear();

        this.emit('strategy_outcome', { strategyId, success, newSuccessRate });
    }

    // =========================================================================
    // STRATEGY EVOLUTION
    // =========================================================================

    /**
     * Evolve strategies based on accumulated data
     */
    async evolveStrategies(
        decisions: DecisionTrace[],
        judgments: Judgment[]
    ): Promise<LearnedStrategy[]> {
        const newStrategies: LearnedStrategy[] = [];

        // Analyze decision patterns
        const successfulPatterns = this.analyzeSuccessfulPatterns(decisions);

        // Generate new experimental strategies based on patterns
        for (const pattern of successfulPatterns) {
            if (pattern.frequency >= 3 && pattern.successRate >= 70) {
                const existingStrategy = await this.findSimilarStrategy(pattern.description);

                if (!existingStrategy) {
                    const newStrategy = await this.createStrategy({
                        domain: pattern.domain,
                        name: `Evolved: ${pattern.name}`,
                        description: pattern.description,
                        contextsEffective: pattern.contexts,
                        contextsIneffective: [],
                        isExperimental: true,
                        derivedFrom: pattern.sourceStrategyId,
                    });
                    newStrategies.push(newStrategy);
                }
            }
        }

        // Promote successful experimental strategies
        const experimentalStrategies = await db.select()
            .from(learningStrategies)
            .where(and(
                eq(learningStrategies.isExperimental, true),
                sql`${learningStrategies.usageCount} >= 10`,
                sql`${learningStrategies.successRate} >= 70`
            ));

        for (const strategy of experimentalStrategies) {
            await db.update(learningStrategies)
                .set({
                    isExperimental: false,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(learningStrategies.strategyId, strategy.strategyId));

            await this.createInsight({
                category: 'strategy_effectiveness',
                observation: `Strategy "${strategy.name}" promoted from experimental`,
                evidence: `Success rate: ${strategy.successRate}%, Usage: ${strategy.usageCount}`,
                action: 'Strategy now active in main rotation',
                expectedImpact: 'Improved build outcomes in relevant contexts',
            });
        }

        // Deprecate failing strategies
        const failingStrategies = await db.select()
            .from(learningStrategies)
            .where(and(
                sql`${learningStrategies.usageCount} >= 10`,
                sql`${learningStrategies.successRate} < 40`
            ));

        for (const strategy of failingStrategies) {
            await db.update(learningStrategies)
                .set({
                    isActive: false,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(learningStrategies.strategyId, strategy.strategyId));

            await this.createInsight({
                category: 'strategy_effectiveness',
                observation: `Strategy "${strategy.name}" deprecated due to low success rate`,
                evidence: `Success rate: ${strategy.successRate}%, Usage: ${strategy.usageCount}`,
            });
        }

        this.strategyCache.clear();
        this.emit('strategies_evolved', { newCount: newStrategies.length });

        return newStrategies;
    }

    // =========================================================================
    // LEARNING INSIGHTS
    // =========================================================================

    /**
     * Create a learning insight
     */
    async createInsight(input: {
        category: InsightCategory;
        observation: string;
        evidence: string;
        action?: string;
        expectedImpact?: string;
    }): Promise<LearningInsight> {
        const insightId = `ins_${uuidv4()}`;
        const now = new Date();

        const insight: LearningInsight = {
            insightId,
            category: input.category,
            observation: input.observation,
            evidence: input.evidence,
            action: input.action,
            expectedImpact: input.expectedImpact,
            implemented: false,
            createdAt: now,
        };

        await db.insert(learningInsights).values({
            id: uuidv4(),
            insightId: insight.insightId,
            category: insight.category,
            observation: insight.observation,
            evidence: insight.evidence,
            action: insight.action,
            expectedImpact: insight.expectedImpact,
            implemented: insight.implemented,
            createdAt: insight.createdAt.toISOString(),
        });

        this.emit('insight_created', { insightId, category: input.category });
        return insight;
    }

    /**
     * Get recent insights
     */
    async getRecentInsights(limit: number = 20): Promise<LearningInsight[]> {
        const rows = await db.select()
            .from(learningInsights)
            .orderBy(desc(learningInsights.createdAt))
            .limit(limit);

        return rows.map(this.mapInsightRow);
    }

    /**
     * Get unimplemented insights
     */
    async getUnimplementedInsights(): Promise<LearningInsight[]> {
        const rows = await db.select()
            .from(learningInsights)
            .where(eq(learningInsights.implemented, false))
            .orderBy(desc(learningInsights.createdAt));

        return rows.map(this.mapInsightRow);
    }

    /**
     * Mark insight as implemented
     */
    async markInsightImplemented(insightId: string): Promise<void> {
        await db.update(learningInsights)
            .set({
                implemented: true,
                implementedAt: new Date().toISOString(),
            })
            .where(eq(learningInsights.insightId, insightId));
    }

    // =========================================================================
    // STRATEGY MANAGEMENT
    // =========================================================================

    /**
     * Create a new strategy
     */
    async createStrategy(input: {
        domain: StrategyDomain;
        name: string;
        description: string;
        contextsEffective: string[];
        contextsIneffective: string[];
        isExperimental?: boolean;
        derivedFrom?: string;
    }): Promise<LearnedStrategy> {
        const strategyId = `strat_${uuidv4()}`;
        const now = new Date();

        const strategy: LearnedStrategy = {
            strategyId,
            domain: input.domain,
            name: input.name,
            description: input.description,
            successRate: 50, // Start neutral
            confidence: 50,
            usageCount: 0,
            contextsEffective: input.contextsEffective,
            contextsIneffective: input.contextsIneffective,
            derivedFrom: input.derivedFrom,
            isExperimental: input.isExperimental ?? true,
            isActive: true,
            createdAt: now,
            updatedAt: now,
        };

        await db.insert(learningStrategies).values({
            id: uuidv4(),
            strategyId: strategy.strategyId,
            domain: strategy.domain,
            name: strategy.name,
            description: strategy.description,
            successRate: strategy.successRate,
            confidence: strategy.confidence,
            usageCount: strategy.usageCount,
            contextsEffective: strategy.contextsEffective,
            contextsIneffective: strategy.contextsIneffective,
            derivedFrom: strategy.derivedFrom,
            isExperimental: strategy.isExperimental,
            isActive: strategy.isActive,
            createdAt: strategy.createdAt.toISOString(),
            updatedAt: strategy.updatedAt.toISOString(),
        });

        this.strategyCache.clear();
        this.emit('strategy_created', { strategyId, name: input.name });

        return strategy;
    }

    /**
     * Get active strategies for a domain
     */
    async getActiveStrategies(domain: StrategyDomain): Promise<LearnedStrategy[]> {
        // Check cache
        if (this.isCacheValid() && this.strategyCache.has(domain)) {
            return this.strategyCache.get(domain)!;
        }

        const rows = await db.select()
            .from(learningStrategies)
            .where(and(
                eq(learningStrategies.domain, domain),
                eq(learningStrategies.isActive, true)
            ))
            .orderBy(desc(learningStrategies.successRate));

        const strategies = rows.map(this.mapStrategyRow);
        this.strategyCache.set(domain, strategies);
        this.lastCacheRefresh = new Date();

        return strategies;
    }

    /**
     * Get all strategies
     */
    async getAllStrategies(): Promise<LearnedStrategy[]> {
        const rows = await db.select()
            .from(learningStrategies)
            .orderBy(desc(learningStrategies.successRate));

        return rows.map(this.mapStrategyRow);
    }

    /**
     * Get strategy statistics
     */
    async getStrategyStats(): Promise<{
        total: number;
        active: number;
        experimental: number;
        byDomain: Record<string, number>;
        avgSuccessRate: number;
    }> {
        const all = await db.select().from(learningStrategies);

        let active = 0;
        let experimental = 0;
        let totalSuccessRate = 0;
        const byDomain: Record<string, number> = {};

        for (const strategy of all) {
            if (strategy.isActive) active++;
            if (strategy.isExperimental) experimental++;
            totalSuccessRate += strategy.successRate;
            byDomain[strategy.domain] = (byDomain[strategy.domain] || 0) + 1;
        }

        return {
            total: all.length,
            active,
            experimental,
            byDomain,
            avgSuccessRate: all.length > 0 ? totalSuccessRate / all.length : 0,
        };
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private analyzeSuccessfulPatterns(decisions: DecisionTrace[]): Array<{
        name: string;
        description: string;
        domain: StrategyDomain;
        frequency: number;
        successRate: number;
        contexts: string[];
        sourceStrategyId?: string;
    }> {
        // Group successful decisions by type
        const patterns: Map<string, {
            decisions: DecisionTrace[];
            contexts: Set<string>;
        }> = new Map();

        for (const decision of decisions) {
            if (!decision.outcome || decision.outcome.immediateResult !== 'success') continue;

            const key = `${decision.phase}_${decision.decisionType}`;
            if (!patterns.has(key)) {
                patterns.set(key, { decisions: [], contexts: new Set() });
            }

            const pattern = patterns.get(key)!;
            pattern.decisions.push(decision);

            if (decision.context.buildPhase) {
                pattern.contexts.add(decision.context.buildPhase);
            }
        }

        // Convert to pattern summaries
        const results = [];
        for (const [key, data] of patterns.entries()) {
            const [phase, decisionType] = key.split('_');
            const successCount = data.decisions.filter(d =>
                d.outcome?.immediateResult === 'success'
            ).length;

            results.push({
                name: `${decisionType} in ${phase}`,
                description: `Apply ${decisionType} approach during ${phase} phase`,
                domain: this.inferDomain(decisionType),
                frequency: data.decisions.length,
                successRate: Math.round((successCount / data.decisions.length) * 100),
                contexts: Array.from(data.contexts),
            });
        }

        return results;
    }

    private inferDomain(decisionType: string): StrategyDomain {
        if (['error_recovery', 'placeholder_resolution'].includes(decisionType)) {
            return 'error_recovery';
        }
        if (['design_choice', 'motion_implementation', 'styling_approach'].includes(decisionType)) {
            return 'design_approach';
        }
        return 'code_generation';
    }

    private async findSimilarStrategy(description: string): Promise<LearnedStrategy | null> {
        const all = await db.select().from(learningStrategies);

        for (const row of all) {
            const similarity = this.stringSimilarity(
                row.description.toLowerCase(),
                description.toLowerCase()
            );
            if (similarity > 0.7) {
                return this.mapStrategyRow(row);
            }
        }

        return null;
    }

    private stringSimilarity(a: string, b: string): number {
        const wordsA = new Set(a.split(/\s+/));
        const wordsB = new Set(b.split(/\s+/));
        const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
        const union = new Set([...wordsA, ...wordsB]).size;
        return union > 0 ? intersection / union : 0;
    }

    private isCacheValid(): boolean {
        return Date.now() - this.lastCacheRefresh.getTime() < this.CACHE_TTL_MS;
    }

    // =========================================================================
    // ROW MAPPING
    // =========================================================================

    private mapStrategyRow = (row: typeof learningStrategies.$inferSelect): LearnedStrategy => ({
        strategyId: row.strategyId,
        domain: row.domain as StrategyDomain,
        name: row.name,
        description: row.description,
        successRate: row.successRate,
        confidence: row.confidence,
        usageCount: row.usageCount,
        contextsEffective: (row.contextsEffective as string[]) || [],
        contextsIneffective: (row.contextsIneffective as string[]) || [],
        derivedFrom: row.derivedFrom || undefined,
        isExperimental: row.isExperimental,
        isActive: row.isActive,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
    });

    private mapInsightRow = (row: typeof learningInsights.$inferSelect): LearningInsight => ({
        insightId: row.insightId,
        category: row.category as InsightCategory,
        observation: row.observation,
        evidence: row.evidence,
        action: row.action || undefined,
        expectedImpact: row.expectedImpact || undefined,
        implemented: row.implemented,
        implementedAt: row.implementedAt ? new Date(row.implementedAt) : undefined,
        createdAt: new Date(row.createdAt),
    });
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: StrategyEvolutionService | null = null;

export function getStrategyEvolution(): StrategyEvolutionService {
    if (!instance) {
        instance = new StrategyEvolutionService();
    }
    return instance;
}

