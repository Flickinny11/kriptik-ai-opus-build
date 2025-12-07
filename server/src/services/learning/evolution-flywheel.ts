/**
 * Evolution Flywheel Orchestrator (Layer 5)
 *
 * The central coordinator that ties all learning layers together:
 * 1. Experience Capture → Collects build traces
 * 2. AI Judgment → Evaluates and generates preference pairs
 * 3. Shadow Models → Trains on accumulated data
 * 4. Meta-Learning → Evolves strategies and patterns
 * 5. Flywheel → Orchestrates cycles and measures improvement
 *
 * The flywheel runs continuously, each cycle improving on the previous.
 */

import { db } from '../../db.js';
import { learningEvolutionCycles } from '../../schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import {
    ExperienceCaptureService,
    getExperienceCaptureService,
    createExperienceCaptureService,
} from './experience-capture.js';
import { AIJudgmentService, getAIJudgmentService } from './ai-judgment.js';
import { PatternLibraryService, getPatternLibrary } from './pattern-library.js';
import { StrategyEvolutionService, getStrategyEvolution } from './strategy-evolution.js';
import { ShadowModelRegistry, getShadowModelRegistry, SHADOW_MODEL_CONFIGS, ShadowModelType } from './shadow-model-registry.js';
import type {
    EvolutionCycle,
    CycleMetrics,
    EvolutionConfig,
    DecisionTrace,
    CodeArtifactTrace,
    DesignChoiceTrace,
    ErrorRecoveryTrace,
    LearnedPattern,
    LearnedStrategy,
    PreferencePair,
    LearningInsight,
} from './types.js';

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: EvolutionConfig = {
    preferenceThreshold: 100, // Train when 100 new pairs
    evaluationInterval: 'weekly',
    patternUpdateInterval: 'daily',
    minJudgmentConfidence: 0.6,
    promotionImprovementThreshold: 0.05, // 5% improvement required
    regressionTolerance: 0.02, // 2% regression allowed
};

// =============================================================================
// EVOLUTION FLYWHEEL ORCHESTRATOR
// =============================================================================

export class EvolutionFlywheel extends EventEmitter {
    private config: EvolutionConfig;
    private experienceCapture: ExperienceCaptureService | null = null;
    private aiJudgment: AIJudgmentService;
    private patternLibrary: PatternLibraryService;
    private strategyEvolution: StrategyEvolutionService;
    private shadowRegistry: ShadowModelRegistry;

    private isRunning: boolean = false;
    private currentCycleId: string | null = null;

    constructor(config?: Partial<EvolutionConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.aiJudgment = getAIJudgmentService();
        this.patternLibrary = getPatternLibrary();
        this.strategyEvolution = getStrategyEvolution();
        this.shadowRegistry = getShadowModelRegistry();
    }

    // =========================================================================
    // FLYWHEEL EXECUTION
    // =========================================================================

    /**
     * Run a complete evolution cycle
     */
    async runCycle(userId: string): Promise<EvolutionCycle> {
        if (this.isRunning) {
            throw new Error('Evolution cycle already in progress');
        }

        this.isRunning = true;
        const cycleId = `cyc_${uuidv4()}`;
        this.currentCycleId = cycleId;

        console.log(`[EvolutionFlywheel] Starting cycle ${cycleId}`);
        this.emit('cycle_started', { cycleId });

        try {
            // Get starting metrics
            const startMetrics = await this.collectMetrics();

            // Create cycle record
            const cycle = await this.createCycleRecord(cycleId, startMetrics);

            // Phase 1: Collect recent traces
            const traces = await this.collectTraces(userId);

            // Phase 2: Run AI judgments
            const judgments = await this.runJudgments(traces, userId);

            // Phase 3: Generate preference pairs
            const pairs = await this.generatePairs(traces);

            // Phase 4: Extract patterns
            const patterns = await this.extractPatterns(traces);

            // Phase 5: Evolve strategies
            const strategies = await this.evolveStrategies(traces.decisions, judgments);

            // Phase 6: Queue training if threshold met
            const trainingQueued = await this.queueTrainingIfNeeded(pairs);

            // Phase 7: Collect end metrics and calculate improvement
            const endMetrics = await this.collectMetrics();
            const improvement = this.calculateImprovement(startMetrics, endMetrics);

            // Update cycle record
            await this.completeCycle(cycleId, {
                tracesCaptured: traces.total,
                judgmentsRun: judgments.length,
                pairsGenerated: pairs.length,
                patternsExtracted: patterns.length,
                strategiesEvolved: strategies.length,
                endMetrics,
                improvement,
            });

            const completedCycle = await this.getCycle(cycleId);

            this.emit('cycle_completed', { cycleId, improvement });
            console.log(`[EvolutionFlywheel] Completed cycle ${cycleId}, improvement: ${(improvement * 100).toFixed(1)}%`);

            return completedCycle!;
        } finally {
            this.isRunning = false;
            this.currentCycleId = null;
        }
    }

    /**
     * Initialize experience capture for a build
     */
    initializeForBuild(userId: string, buildId: string, projectId: string): ExperienceCaptureService {
        this.experienceCapture = createExperienceCaptureService(userId);
        this.experienceCapture.startBuildSession(buildId, projectId);
        return this.experienceCapture;
    }

    /**
     * Finalize experience capture for a build
     */
    async finalizeForBuild(): Promise<void> {
        if (this.experienceCapture) {
            await this.experienceCapture.endBuildSession();
            this.experienceCapture = null;
        }
    }

    // =========================================================================
    // PHASE IMPLEMENTATIONS
    // =========================================================================

    /**
     * Phase 1: Collect recent traces
     */
    private async collectTraces(userId: string): Promise<{
        decisions: DecisionTrace[];
        codeArtifacts: CodeArtifactTrace[];
        designChoices: DesignChoiceTrace[];
        errorRecoveries: ErrorRecoveryTrace[];
        total: number;
    }> {
        const capture = createExperienceCaptureService(userId);

        const decisions = await capture.getRecentDecisionTraces(500);
        const decisionsWithOutcomes = await capture.getDecisionTracesWithOutcomes(300);
        const successfulFixes = await capture.getSuccessfulFixes(200);

        return {
            decisions: decisionsWithOutcomes,
            codeArtifacts: [], // Would need buildId, loaded per-build
            designChoices: [],
            errorRecoveries: successfulFixes,
            total: decisions.length + successfulFixes.length,
        };
    }

    /**
     * Phase 2: Run AI judgments
     */
    private async runJudgments(
        traces: {
            decisions: DecisionTrace[];
            codeArtifacts: CodeArtifactTrace[];
            designChoices: DesignChoiceTrace[];
            errorRecoveries: ErrorRecoveryTrace[];
        },
        userId: string
    ): Promise<Array<{ type: string; score: number }>> {
        const judgments: Array<{ type: string; score: number }> = [];

        // Judge code quality for artifacts
        for (const artifact of traces.codeArtifacts.slice(0, 10)) {
            try {
                const judgment = await this.aiJudgment.judgeCodeQuality(artifact, { userId });
                judgments.push({ type: 'code_quality', score: judgment.scores.overall });
            } catch (error) {
                console.error('[EvolutionFlywheel] Code judgment failed:', error);
            }
        }

        // Judge design quality
        for (const choice of traces.designChoices.slice(0, 5)) {
            try {
                const judgment = await this.aiJudgment.judgeDesignQuality(choice, undefined, { userId });
                judgments.push({ type: 'design_quality', score: judgment.scores.overall });
            } catch (error) {
                console.error('[EvolutionFlywheel] Design judgment failed:', error);
            }
        }

        return judgments;
    }

    /**
     * Phase 3: Generate preference pairs
     */
    private async generatePairs(traces: {
        decisions: DecisionTrace[];
        codeArtifacts: CodeArtifactTrace[];
        errorRecoveries: ErrorRecoveryTrace[];
    }): Promise<PreferencePair[]> {
        const allPairs: PreferencePair[] = [];

        // Generate from decision traces
        const decisionPairs = await this.aiJudgment.generatePreferencePairs(traces.decisions, 'code');
        allPairs.push(...decisionPairs);

        // Generate from error fix successes
        const errorFixPairs = await this.aiJudgment.generateErrorFixPreferencePairs(traces.errorRecoveries);
        allPairs.push(...errorFixPairs);

        return allPairs;
    }

    /**
     * Phase 4: Extract patterns
     */
    private async extractPatterns(traces: {
        codeArtifacts: CodeArtifactTrace[];
        designChoices: DesignChoiceTrace[];
        errorRecoveries: ErrorRecoveryTrace[];
    }): Promise<LearnedPattern[]> {
        const patterns: LearnedPattern[] = [];

        // Extract from successful code artifacts
        for (const artifact of traces.codeArtifacts.slice(0, 5)) {
            try {
                const extracted = await this.patternLibrary.extractCodePatterns(artifact);
                patterns.push(...extracted);
            } catch (error) {
                console.error('[EvolutionFlywheel] Code pattern extraction failed:', error);
            }
        }

        // Extract from design choices
        for (const choice of traces.designChoices.slice(0, 3)) {
            try {
                const extracted = await this.patternLibrary.extractDesignPatterns(choice);
                patterns.push(...extracted);
            } catch (error) {
                console.error('[EvolutionFlywheel] Design pattern extraction failed:', error);
            }
        }

        // Extract from error recoveries
        for (const recovery of traces.errorRecoveries.slice(0, 5)) {
            try {
                const extracted = await this.patternLibrary.extractErrorFixPatterns(recovery);
                patterns.push(...extracted);
            } catch (error) {
                console.error('[EvolutionFlywheel] Error fix pattern extraction failed:', error);
            }
        }

        return patterns;
    }

    /**
     * Phase 5: Evolve strategies
     */
    private async evolveStrategies(
        decisions: DecisionTrace[],
        judgments: Array<{ type: string; score: number }>
    ): Promise<LearnedStrategy[]> {
        // Convert judgments to the format needed
        const mockJudgments = judgments.map(j => ({
            scores: { overall: j.score, categories: {} },
        }));

        return await this.strategyEvolution.evolveStrategies(decisions, mockJudgments as any);
    }

    /**
     * Phase 6: Queue training if needed
     */
    private async queueTrainingIfNeeded(pairs: PreferencePair[]): Promise<boolean> {
        const stats = await this.aiJudgment.getPreferencePairStats();

        if (stats.unused >= this.config.preferenceThreshold) {
            console.log(`[EvolutionFlywheel] Training threshold reached: ${stats.unused} unused pairs`);

            // Queue training runs for each model type
            for (const modelType of Object.keys(SHADOW_MODEL_CONFIGS) as ShadowModelType[]) {
                const config = SHADOW_MODEL_CONFIGS[modelType];

                try {
                    await this.shadowRegistry.createTrainingRun({
                        modelName: modelType,
                        config: config.defaultConfig,
                        computeProvider: 'queued',
                    });
                } catch (error) {
                    console.error(`[EvolutionFlywheel] Failed to queue training for ${modelType}:`, error);
                }
            }

            await this.strategyEvolution.createInsight({
                category: 'data_quality',
                observation: `Training threshold reached with ${stats.unused} preference pairs`,
                evidence: `Distribution: ${JSON.stringify(stats.byDomain)}`,
                action: 'Training runs queued for all shadow models',
                expectedImpact: 'Model quality improvement in next evaluation',
            });

            return true;
        }

        return false;
    }

    // =========================================================================
    // METRICS & ANALYSIS
    // =========================================================================

    /**
     * Collect current metrics
     */
    private async collectMetrics(): Promise<CycleMetrics> {
        const patternStats = await this.patternLibrary.getPatternStats();
        const strategyStats = await this.strategyEvolution.getStrategyStats();
        const pairStats = await this.aiJudgment.getPreferencePairStats();

        // Get recent judgments to calculate average scores
        const codeJudgments = await this.aiJudgment.getRecentJudgments('code_quality', 50);
        const designJudgments = await this.aiJudgment.getRecentJudgments('design_quality', 50);

        const avgSuccessRate = (codeJudgments.reduce((sum, j) => sum + j.scores.overall, 0) /
            Math.max(codeJudgments.length, 1));
        const avgDesignScore = (designJudgments.reduce((sum, j) => sum + j.scores.overall, 0) /
            Math.max(designJudgments.length, 1));

        return {
            totalTraces: pairStats.total * 2, // Rough estimate
            totalPairs: pairStats.total,
            totalPatterns: patternStats.total,
            avgSuccessRate,
            avgDesignScore,
        };
    }

    /**
     * Calculate improvement between cycles
     */
    private calculateImprovement(start: CycleMetrics, end: CycleMetrics): number {
        const successImprovement = (end.avgSuccessRate - start.avgSuccessRate) / Math.max(start.avgSuccessRate, 1);
        const designImprovement = (end.avgDesignScore - start.avgDesignScore) / Math.max(start.avgDesignScore, 1);
        const patternGrowth = (end.totalPatterns - start.totalPatterns) / Math.max(start.totalPatterns, 1);

        // Weighted average
        return (successImprovement * 0.4) + (designImprovement * 0.4) + (patternGrowth * 0.2);
    }

    // =========================================================================
    // CYCLE MANAGEMENT
    // =========================================================================

    /**
     * Create a new cycle record
     */
    private async createCycleRecord(cycleId: string, startMetrics: CycleMetrics): Promise<EvolutionCycle> {
        // Get current cycle number
        const lastCycle = await db.select()
            .from(learningEvolutionCycles)
            .orderBy(desc(learningEvolutionCycles.cycleNumber))
            .limit(1);

        const cycleNumber = (lastCycle[0]?.cycleNumber || 0) + 1;
        const now = new Date();

        const cycle: EvolutionCycle = {
            cycleId,
            cycleNumber,
            startMetrics,
            tracesCaptured: 0,
            judgmentsRun: 0,
            pairsGenerated: 0,
            patternsExtracted: 0,
            strategiesEvolved: 0,
            modelsPromoted: 0,
            startedAt: now,
            createdAt: now,
        };

        await db.insert(learningEvolutionCycles).values({
            id: uuidv4(),
            cycleId: cycle.cycleId,
            cycleNumber: cycle.cycleNumber,
            startMetrics: cycle.startMetrics,
            tracesCaptured: cycle.tracesCaptured,
            judgmentsRun: cycle.judgmentsRun,
            pairsGenerated: cycle.pairsGenerated,
            patternsExtracted: cycle.patternsExtracted,
            strategiesEvolved: cycle.strategiesEvolved,
            modelsPromoted: cycle.modelsPromoted,
            startedAt: cycle.startedAt.toISOString(),
            createdAt: cycle.createdAt.toISOString(),
        });

        return cycle;
    }

    /**
     * Complete a cycle with results
     */
    private async completeCycle(cycleId: string, results: {
        tracesCaptured: number;
        judgmentsRun: number;
        pairsGenerated: number;
        patternsExtracted: number;
        strategiesEvolved: number;
        endMetrics: CycleMetrics;
        improvement: number;
    }): Promise<void> {
        await db.update(learningEvolutionCycles)
            .set({
                tracesCaptured: results.tracesCaptured,
                judgmentsRun: results.judgmentsRun,
                pairsGenerated: results.pairsGenerated,
                patternsExtracted: results.patternsExtracted,
                strategiesEvolved: results.strategiesEvolved,
                endMetrics: results.endMetrics,
                improvementPercent: Math.round(results.improvement * 100),
                completedAt: new Date().toISOString(),
            })
            .where(eq(learningEvolutionCycles.cycleId, cycleId));
    }

    /**
     * Get a cycle by ID
     */
    async getCycle(cycleId: string): Promise<EvolutionCycle | null> {
        const [row] = await db.select()
            .from(learningEvolutionCycles)
            .where(eq(learningEvolutionCycles.cycleId, cycleId))
            .limit(1);

        return row ? this.mapCycleRow(row) : null;
    }

    /**
     * Get recent cycles
     */
    async getRecentCycles(limit: number = 10): Promise<EvolutionCycle[]> {
        const rows = await db.select()
            .from(learningEvolutionCycles)
            .orderBy(desc(learningEvolutionCycles.cycleNumber))
            .limit(limit);

        return rows.map(this.mapCycleRow);
    }

    // =========================================================================
    // DASHBOARD DATA
    // =========================================================================

    /**
     * Get comprehensive learning system status
     */
    async getSystemStatus(): Promise<{
        isRunning: boolean;
        currentCycleId: string | null;
        lastCycle: EvolutionCycle | null;
        totalCycles: number;
        overallImprovement: number;
        patternStats: Awaited<ReturnType<PatternLibraryService['getPatternStats']>>;
        strategyStats: Awaited<ReturnType<StrategyEvolutionService['getStrategyStats']>>;
        pairStats: Awaited<ReturnType<AIJudgmentService['getPreferencePairStats']>>;
        modelStats: Awaited<ReturnType<ShadowModelRegistry['getRegistryStats']>>;
        recentInsights: LearningInsight[];
    }> {
        const cycles = await this.getRecentCycles(100);
        const lastCycle = cycles[0] || null;

        // Calculate overall improvement across cycles
        let overallImprovement = 0;
        for (const cycle of cycles) {
            overallImprovement += cycle.improvementPercent || 0;
        }

        const patternStats = await this.patternLibrary.getPatternStats();
        const strategyStats = await this.strategyEvolution.getStrategyStats();
        const pairStats = await this.aiJudgment.getPreferencePairStats();
        const modelStats = await this.shadowRegistry.getRegistryStats();
        const recentInsights = await this.strategyEvolution.getRecentInsights(10);

        return {
            isRunning: this.isRunning,
            currentCycleId: this.currentCycleId,
            lastCycle,
            totalCycles: cycles.length,
            overallImprovement,
            patternStats,
            strategyStats,
            pairStats,
            modelStats,
            recentInsights,
        };
    }

    /**
     * Get improvement trend over time
     */
    async getImprovementTrend(cycleCount: number = 20): Promise<Array<{
        cycleNumber: number;
        improvement: number;
        avgSuccessRate: number;
        avgDesignScore: number;
        date: string;
    }>> {
        const cycles = await this.getRecentCycles(cycleCount);

        return cycles.reverse().map(cycle => ({
            cycleNumber: cycle.cycleNumber,
            improvement: cycle.improvementPercent || 0,
            avgSuccessRate: cycle.endMetrics?.avgSuccessRate || cycle.startMetrics.avgSuccessRate,
            avgDesignScore: cycle.endMetrics?.avgDesignScore || cycle.startMetrics.avgDesignScore,
            date: cycle.startedAt.toISOString().split('T')[0],
        }));
    }

    // =========================================================================
    // ROW MAPPING
    // =========================================================================

    private mapCycleRow = (row: typeof learningEvolutionCycles.$inferSelect): EvolutionCycle => ({
        cycleId: row.cycleId,
        cycleNumber: row.cycleNumber,
        startMetrics: row.startMetrics as CycleMetrics,
        endMetrics: row.endMetrics as CycleMetrics | undefined,
        tracesCaptured: row.tracesCaptured ?? 0,
        judgmentsRun: row.judgmentsRun ?? 0,
        pairsGenerated: row.pairsGenerated ?? 0,
        patternsExtracted: row.patternsExtracted ?? 0,
        strategiesEvolved: row.strategiesEvolved ?? 0,
        modelsPromoted: row.modelsPromoted ?? 0,
        improvementPercent: row.improvementPercent || undefined,
        startedAt: new Date(row.startedAt),
        completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
        createdAt: new Date(row.createdAt),
    });
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: EvolutionFlywheel | null = null;

export function getEvolutionFlywheel(config?: Partial<EvolutionConfig>): EvolutionFlywheel {
    if (!instance) {
        instance = new EvolutionFlywheel(config);
    }
    return instance;
}

