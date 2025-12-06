/**
 * Autonomous Learning Engine
 *
 * The central orchestrator that ties together all learning components:
 * - Experience Capture (Layer 1)
 * - AI Judgment / RLAIF (Layer 2)
 * - Shadow Models (Layer 3) - planned
 * - Meta-Learning (Layer 4)
 *
 * This engine hooks into the build pipeline to capture learning signals
 * and continuously improve the system.
 */

import { v4 as uuidv4 } from 'uuid';
import { getExperienceCaptureService } from './experience-capture.js';
import { getAIJudgmentService } from './ai-judgment.js';
import { getPatternLibraryService } from './pattern-library.js';
import { getStrategyEvolutionService } from './strategy-evolution.js';
import type {
    LearningEvent,
    LearningEventHandler,
    FlywheelMetrics,
    DecisionTrace,
    Pattern,
    Strategy,
    VerificationScores,
    BuildPhase,
    DecisionType,
    ErrorType,
    CodeArtifactVersion,
    SuccessfulFix,
    ColorPalette,
    AnimationSpec,
} from './types.js';

// =============================================================================
// LEARNING ENGINE
// =============================================================================

export class LearningEngine implements LearningEventHandler {
    private experienceCapture = getExperienceCaptureService();
    private aiJudgment = getAIJudgmentService();
    private patternLibrary = getPatternLibraryService();
    private strategyEvolution = getStrategyEvolutionService();

    // Active tracking maps
    private activeBuildArtifacts: Map<string, Map<string, string>> = new Map(); // buildId -> filePath -> artifactId
    private activeErrors: Map<string, string> = new Map(); // buildId -> errorId

    // =========================================================================
    // EVENT HANDLING
    // =========================================================================

    /**
     * Handle any learning event from the build pipeline
     */
    async handleEvent(event: LearningEvent): Promise<void> {
        try {
            switch (event.type) {
                case 'build_started':
                    await this.onBuildStarted(event);
                    break;
                case 'build_completed':
                    await this.onBuildCompleted(event);
                    break;
                case 'decision_made':
                    await this.onDecisionMade(event);
                    break;
                case 'decision_outcome':
                    await this.onDecisionOutcome(event);
                    break;
                case 'artifact_created':
                    await this.onArtifactCreated(event);
                    break;
                case 'artifact_updated':
                    await this.onArtifactUpdated(event);
                    break;
                case 'error_detected':
                    await this.onErrorDetected(event);
                    break;
                case 'error_fix_attempted':
                    await this.onErrorFixAttempted(event);
                    break;
                case 'error_resolved':
                    await this.onErrorResolved(event);
                    break;
                case 'design_choices_made':
                    await this.onDesignChoicesMade(event);
                    break;
            }
        } catch (error) {
            console.error(`[LearningEngine] Error handling event ${event.type}:`, error);
        }
    }

    // =========================================================================
    // BUILD LIFECYCLE EVENTS
    // =========================================================================

    private async onBuildStarted(event: Extract<LearningEvent, { type: 'build_started' }>): Promise<void> {
        await this.experienceCapture.startBuild({
            projectId: event.projectId,
            userId: event.userId,
            prompt: event.prompt,
        });

        // Initialize artifact tracking for this build
        this.activeBuildArtifacts.set(event.buildId, new Map());

        console.log(`[LearningEngine] Build started: ${event.buildId}`);
    }

    private async onBuildCompleted(event: Extract<LearningEvent, { type: 'build_completed' }>): Promise<void> {
        await this.experienceCapture.completeBuild({
            buildId: event.buildId,
            status: event.status,
            verificationScores: event.scores,
        });

        // Cleanup tracking
        this.activeBuildArtifacts.delete(event.buildId);
        this.activeErrors.delete(event.buildId);

        // Trigger async post-build learning
        this.runPostBuildLearning(event.buildId).catch(err => {
            console.error('[LearningEngine] Post-build learning failed:', err);
        });

        console.log(`[LearningEngine] Build completed: ${event.buildId} - ${event.status}`);
    }

    // =========================================================================
    // DECISION EVENTS
    // =========================================================================

    private async onDecisionMade(event: Extract<LearningEvent, { type: 'decision_made' }>): Promise<void> {
        await this.experienceCapture.captureDecision({
            buildId: event.buildId,
            userId: event.trace.userId,
            projectId: event.trace.projectId,
            phase: event.trace.phase,
            decisionType: event.trace.decisionType,
            context: event.trace.context,
            decision: event.trace.decision,
        });
    }

    private async onDecisionOutcome(event: Extract<LearningEvent, { type: 'decision_outcome' }>): Promise<void> {
        if (event.outcome) {
            await this.experienceCapture.recordDecisionOutcome({
                traceId: event.traceId,
                outcome: event.outcome,
            });
        }
    }

    // =========================================================================
    // ARTIFACT EVENTS
    // =========================================================================

    private async onArtifactCreated(event: Extract<LearningEvent, { type: 'artifact_created' }>): Promise<void> {
        const artifactId = await this.experienceCapture.startArtifactTrace({
            buildId: event.buildId,
            projectId: '', // Would come from build context
            userId: '', // Would come from build context
            filePath: event.filePath,
            initialCode: event.code,
            modelUsed: event.model,
            agentType: event.agent,
        });

        // Track artifact for this build
        const buildArtifacts = this.activeBuildArtifacts.get(event.buildId);
        if (buildArtifacts) {
            buildArtifacts.set(event.filePath, artifactId);
        }
    }

    private async onArtifactUpdated(event: Extract<LearningEvent, { type: 'artifact_updated' }>): Promise<void> {
        await this.experienceCapture.recordArtifactVersion({
            artifactId: event.artifactId,
            code: event.code,
            trigger: event.trigger,
            agentType: event.agent,
            modelUsed: event.model,
        });
    }

    // =========================================================================
    // ERROR EVENTS
    // =========================================================================

    private async onErrorDetected(event: Extract<LearningEvent, { type: 'error_detected' }>): Promise<void> {
        const errorId = await this.experienceCapture.startErrorRecovery({
            buildId: event.buildId,
            projectId: '', // Would come from build context
            userId: '', // Would come from build context
            error: event.error,
        });

        this.activeErrors.set(event.buildId, errorId);
    }

    private async onErrorFixAttempted(event: Extract<LearningEvent, { type: 'error_fix_attempted' }>): Promise<void> {
        await this.experienceCapture.recordRecoveryAttempt({
            errorId: event.errorId,
            attempt: event.attempt,
        });
    }

    private async onErrorResolved(event: Extract<LearningEvent, { type: 'error_resolved' }>): Promise<void> {
        await this.experienceCapture.resolveError({
            errorId: event.errorId,
            successfulFix: event.fix,
        });
    }

    // =========================================================================
    // DESIGN EVENTS
    // =========================================================================

    private async onDesignChoicesMade(event: Extract<LearningEvent, { type: 'design_choices_made' }>): Promise<void> {
        await this.experienceCapture.captureDesignChoices({
            buildId: event.buildId,
            projectId: event.choices.projectId,
            userId: event.choices.userId,
            appSoul: event.choices.appSoul,
            typography: event.choices.typography,
            colorSystem: event.choices.colorSystem,
            motionLanguage: event.choices.motionLanguage,
            layoutDecisions: event.choices.layoutDecisions,
        });
    }

    // =========================================================================
    // POST-BUILD LEARNING
    // =========================================================================

    /**
     * Run learning processes after a build completes
     */
    private async runPostBuildLearning(buildId: string): Promise<void> {
        console.log(`[LearningEngine] Starting post-build learning for ${buildId}`);

        // 1. Get decision traces from this build
        const traces = await this.experienceCapture.getDecisionTracesForBuild(buildId);

        // 2. Extract patterns from successful decisions
        for (const trace of traces) {
            if (trace.outcome?.immediateResult === 'success') {
                await this.patternLibrary.extractPattern(trace);
            }
        }

        // 3. Generate preference pairs for training
        const pairs = await this.aiJudgment.generatePreferencePairs(traces);
        console.log(`[LearningEngine] Generated ${pairs.length} preference pairs`);

        // 4. Evolve strategies based on outcomes
        const evolutionResults = await this.strategyEvolution.evolveStrategies();
        console.log(`[LearningEngine] Strategy evolution: ${evolutionResults.mutationsCreated} mutations, ${evolutionResults.strategiesRetired} retired`);

        console.log(`[LearningEngine] Post-build learning complete for ${buildId}`);
    }

    // =========================================================================
    // CONTEXT INJECTION
    // =========================================================================

    /**
     * Get context to inject into agent prompts
     * This is the key integration point for using learned knowledge
     */
    async getAgentContext(params: {
        taskDescription: string;
        phase: BuildPhase;
        agentType: string;
    }): Promise<{
        relevantPatterns: Pattern[];
        recommendedStrategy: Strategy | null;
        contextPrompt: string;
    }> {
        // Get relevant patterns
        const relevantPatterns = await this.patternLibrary.retrievePatterns({
            context: params.taskDescription,
            limit: 3,
            minSuccessRate: 70,
        });

        // Get recommended strategy
        const recommendedStrategy = await this.strategyEvolution.selectStrategy({
            domain: params.agentType,
            context: params.taskDescription,
        });

        // Build context prompt
        let contextPrompt = '';

        if (relevantPatterns.length > 0) {
            contextPrompt += '\n## LEARNED PATTERNS\n';
            contextPrompt += 'Apply these proven patterns when relevant:\n\n';
            for (const pattern of relevantPatterns) {
                contextPrompt += `### ${pattern.name}\n`;
                contextPrompt += `**Problem:** ${pattern.problem}\n`;
                contextPrompt += `**Solution:** ${pattern.solutionTemplate}\n`;
                if (pattern.codeTemplate) {
                    contextPrompt += `**Template:**\n\`\`\`\n${pattern.codeTemplate}\n\`\`\`\n`;
                }
                contextPrompt += '\n';
            }
        }

        if (recommendedStrategy) {
            contextPrompt += '\n## RECOMMENDED APPROACH\n';
            contextPrompt += `**Strategy:** ${recommendedStrategy.name}\n`;
            contextPrompt += `**Description:** ${recommendedStrategy.description}\n`;
            contextPrompt += `**Success Rate:** ${recommendedStrategy.successRate}%\n`;
        }

        return {
            relevantPatterns,
            recommendedStrategy,
            contextPrompt,
        };
    }

    // =========================================================================
    // FLYWHEEL METRICS
    // =========================================================================

    /**
     * Get comprehensive flywheel metrics
     */
    async getFlywheelMetrics(): Promise<FlywheelMetrics> {
        const [
            buildStats,
            judgmentStats,
            patternStats,
            strategyStats,
        ] = await Promise.all([
            this.experienceCapture.getBuildStatistics(),
            this.aiJudgment.getStatistics(),
            this.patternLibrary.getStatistics(),
            this.strategyEvolution.getStatistics(),
        ]);

        return {
            experienceCapture: {
                totalBuilds: buildStats.totalBuilds,
                successfulBuilds: buildStats.successfulBuilds,
                failedBuilds: buildStats.failedBuilds,
                decisionTraces: buildStats.totalDecisionTraces,
                errorRecoveries: 0, // Would need to add this metric
                avgBuildDurationMs: buildStats.avgDurationMs,
            },
            judgment: {
                totalJudgments: judgmentStats.totalJudgments,
                avgCodeQualityScore: judgmentStats.avgCodeQualityScore,
                avgDesignQualityScore: judgmentStats.avgDesignQualityScore,
                preferencePairsGenerated: judgmentStats.totalPreferencePairs,
                pairsPerDomain: judgmentStats.pairsPerDomain,
            },
            patterns: {
                totalPatterns: patternStats.totalPatterns,
                avgSuccessRate: patternStats.avgSuccessRate,
                mostUsedPatterns: patternStats.topPatterns.map(p => ({ name: p.name, uses: p.timesUsed })),
                patternsByCategory: patternStats.patternsByCategory,
            },
            shadowModels: {
                activeModels: 0, // Phase 2 - shadow model training
                lastTrainingBatch: null,
                avgEvalScore: 0,
                promotedDomains: [],
            },
            meta: {
                learningInsights: strategyStats.totalInsights,
                pendingInsights: strategyStats.pendingInsights,
                systemImprovement: this.calculateSystemImprovement(buildStats),
                lastUpdated: new Date().toISOString(),
            },
        };
    }

    private calculateSystemImprovement(buildStats: {
        successfulBuilds: number;
        totalBuilds: number;
    }): number {
        // Simple success rate improvement calculation
        // In production, this would compare against historical baseline
        if (buildStats.totalBuilds === 0) return 0;

        const currentSuccessRate = (buildStats.successfulBuilds / buildStats.totalBuilds) * 100;
        const baselineSuccessRate = 60; // Assumed baseline

        return Math.round(currentSuccessRate - baselineSuccessRate);
    }

    // =========================================================================
    // ADMIN OPERATIONS
    // =========================================================================

    /**
     * Manually trigger pattern extraction
     */
    async extractPatternsFromSuccessfulBuilds(limit = 100): Promise<number> {
        const traces = await this.experienceCapture.getSuccessfulDecisionTraces({
            limit,
            minConfidence: 0.7,
        });

        let extracted = 0;
        for (const trace of traces) {
            const pattern = await this.patternLibrary.extractPattern(trace);
            if (pattern) extracted++;
        }

        return extracted;
    }

    /**
     * Run batch judgments on unjudged artifacts
     */
    async runBatchJudgments(): Promise<{
        codeJudgments: number;
        designJudgments: number;
        preferencePairs: number;
        errors: number;
    }> {
        return this.aiJudgment.runBatchJudgments({});
    }

    /**
     * Get pending learning insights
     */
    async getPendingInsights() {
        return this.strategyEvolution.getPendingInsights();
    }

    /**
     * Action a learning insight
     */
    async actionInsight(insightId: string): Promise<void> {
        return this.strategyEvolution.actionInsight(insightId);
    }

    /**
     * Prune unsuccessful patterns
     */
    async prunePatterns(minSuccessRate = 40): Promise<number> {
        return this.patternLibrary.pruneUnsuccessfulPatterns(minSuccessRate);
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: LearningEngine | null = null;

export function getLearningEngine(): LearningEngine {
    if (!instance) {
        instance = new LearningEngine();
    }
    return instance;
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

export {
    getExperienceCaptureService,
    getAIJudgmentService,
    getPatternLibraryService,
    getStrategyEvolutionService,
};

