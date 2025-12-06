/**
 * Experience Capture Service
 *
 * Captures all learning signals from builds: decisions, artifacts,
 * design choices, and error recovery journeys.
 *
 * This is Layer 1 of the Autonomous Learning Engine.
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import {
    buildRecords,
    decisionTraces,
    codeArtifactTraces,
    designChoiceTraces,
    errorRecoveryTraces,
} from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import type {
    DecisionTrace,
    CodeArtifactTrace,
    DesignChoiceTrace,
    ErrorRecoveryTrace,
    BuildRecord,
    VerificationScores,
    OutcomeResult,
    DecisionType,
    BuildPhase,
    ErrorType,
    CodeArtifactVersion,
    QualityTrajectoryPoint,
    PatternUsage,
    RecoveryAttempt,
    SuccessfulFix,
    ColorPalette,
    AnimationSpec,
} from './types.js';

// =============================================================================
// EXPERIENCE CAPTURE SERVICE
// =============================================================================

export class ExperienceCaptureService {
    private activeBuildContexts: Map<string, {
        buildId: string;
        decisionTraces: string[];
        artifactTraces: string[];
        designChoices: string[];
        errorRecoveries: string[];
        startTime: number;
    }> = new Map();

    // =========================================================================
    // BUILD LIFECYCLE
    // =========================================================================

    /**
     * Start capturing experience for a new build
     */
    async startBuild(params: {
        projectId: string;
        userId: string;
        prompt: string;
    }): Promise<string> {
        const buildId = uuidv4();

        try {
            await db.insert(buildRecords).values({
                id: buildId,
                projectId: params.projectId,
                userId: params.userId,
                prompt: params.prompt,
                status: 'in_progress',
                startedAt: new Date().toISOString(),
            });

            // Initialize context tracking
            this.activeBuildContexts.set(buildId, {
                buildId,
                decisionTraces: [],
                artifactTraces: [],
                designChoices: [],
                errorRecoveries: [],
                startTime: Date.now(),
            });

            console.log(`[ExperienceCapture] Started build ${buildId}`);
            return buildId;
        } catch (error) {
            console.error('[ExperienceCapture] Failed to start build:', error);
            throw error;
        }
    }

    /**
     * Complete a build and finalize all traces
     */
    async completeBuild(params: {
        buildId: string;
        status: 'completed' | 'failed';
        verificationScores?: VerificationScores;
        userFeedback?: {
            rating: number;
            comment: string | null;
            reportedIssues: string[];
        };
        totalTokensUsed?: number;
        totalCost?: number;
    }): Promise<void> {
        const context = this.activeBuildContexts.get(params.buildId);
        const durationMs = context ? Date.now() - context.startTime : 0;

        try {
            await db.update(buildRecords)
                .set({
                    status: params.status,
                    completedAt: new Date().toISOString(),
                    totalDurationMs: durationMs,
                    totalTokensUsed: params.totalTokensUsed || 0,
                    totalCost: params.totalCost || 0,
                    finalVerificationScores: params.verificationScores || null,
                    userFeedback: params.userFeedback || null,
                    decisionTraceIds: context?.decisionTraces || [],
                    artifactTraceIds: context?.artifactTraces || [],
                    designChoiceIds: context?.designChoices || [],
                    errorRecoveryIds: context?.errorRecoveries || [],
                })
                .where(eq(buildRecords.id, params.buildId));

            // Cleanup context
            this.activeBuildContexts.delete(params.buildId);

            console.log(`[ExperienceCapture] Completed build ${params.buildId} - ${params.status}`);
        } catch (error) {
            console.error('[ExperienceCapture] Failed to complete build:', error);
            throw error;
        }
    }

    // =========================================================================
    // DECISION TRACES
    // =========================================================================

    /**
     * Capture a decision made during the build
     */
    async captureDecision(params: {
        buildId: string;
        userId: string;
        projectId: string;
        phase: BuildPhase;
        decisionType: DecisionType;
        context: {
            intentSnippet: string;
            currentCodeState: string;
            errorIfAny: string | null;
            previousAttempts: number;
            thinkingTrace: string | null;
            agentType: string;
            modelUsed: string;
        };
        decision: {
            chosenOption: string;
            rejectedOptions: string[];
            reasoning: string;
            confidence: number;
        };
    }): Promise<string> {
        const traceId = uuidv4();

        try {
            await db.insert(decisionTraces).values({
                id: traceId,
                buildId: params.buildId,
                userId: params.userId,
                projectId: params.projectId,
                phase: params.phase,
                decisionType: params.decisionType,
                context: params.context,
                decision: params.decision,
            });

            // Track in build context
            const buildContext = this.activeBuildContexts.get(params.buildId);
            if (buildContext) {
                buildContext.decisionTraces.push(traceId);
            }

            return traceId;
        } catch (error) {
            console.error('[ExperienceCapture] Failed to capture decision:', error);
            throw error;
        }
    }

    /**
     * Record the outcome of a decision
     */
    async recordDecisionOutcome(params: {
        traceId: string;
        outcome: {
            immediateResult: OutcomeResult;
            verificationScores: VerificationScores | null;
            requiredFixes: number;
            finalInProduction: boolean;
            userSatisfaction: number | null;
        };
    }): Promise<void> {
        try {
            await db.update(decisionTraces)
                .set({
                    outcome: params.outcome,
                    outcomeRecordedAt: new Date().toISOString(),
                })
                .where(eq(decisionTraces.id, params.traceId));
        } catch (error) {
            console.error('[ExperienceCapture] Failed to record decision outcome:', error);
        }
    }

    // =========================================================================
    // CODE ARTIFACT TRACES
    // =========================================================================

    /**
     * Start tracking a code artifact
     */
    async startArtifactTrace(params: {
        buildId: string;
        projectId: string;
        userId: string;
        filePath: string;
        initialCode: string;
        modelUsed: string;
        agentType: string;
    }): Promise<string> {
        const artifactId = uuidv4();

        const initialVersion: CodeArtifactVersion = {
            version: 1,
            code: params.initialCode,
            timestamp: new Date().toISOString(),
            trigger: 'initial',
            changedByAgent: params.agentType,
            modelUsed: params.modelUsed,
        };

        try {
            await db.insert(codeArtifactTraces).values({
                id: artifactId,
                buildId: params.buildId,
                projectId: params.projectId,
                userId: params.userId,
                filePath: params.filePath,
                versions: [initialVersion],
                qualityTrajectory: [],
                patternsUsed: [],
            });

            // Track in build context
            const buildContext = this.activeBuildContexts.get(params.buildId);
            if (buildContext) {
                buildContext.artifactTraces.push(artifactId);
            }

            return artifactId;
        } catch (error) {
            console.error('[ExperienceCapture] Failed to start artifact trace:', error);
            throw error;
        }
    }

    /**
     * Record a new version of a code artifact
     */
    async recordArtifactVersion(params: {
        artifactId: string;
        code: string;
        trigger: CodeArtifactVersion['trigger'];
        agentType: string;
        modelUsed: string;
    }): Promise<void> {
        try {
            // Get current artifact
            const [artifact] = await db.select()
                .from(codeArtifactTraces)
                .where(eq(codeArtifactTraces.id, params.artifactId))
                .limit(1);

            if (!artifact) return;

            const versions = (artifact.versions as CodeArtifactVersion[]) || [];
            const newVersion: CodeArtifactVersion = {
                version: versions.length + 1,
                code: params.code,
                timestamp: new Date().toISOString(),
                trigger: params.trigger,
                changedByAgent: params.agentType,
                modelUsed: params.modelUsed,
            };

            await db.update(codeArtifactTraces)
                .set({
                    versions: [...versions, newVersion],
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(codeArtifactTraces.id, params.artifactId));
        } catch (error) {
            console.error('[ExperienceCapture] Failed to record artifact version:', error);
        }
    }

    /**
     * Record quality trajectory point for an artifact
     */
    async recordQualityPoint(params: {
        artifactId: string;
        errorCount: number;
        codeQualityScore: number;
        visualQualityScore: number | null;
        antiSlopScore: number | null;
    }): Promise<void> {
        try {
            const [artifact] = await db.select()
                .from(codeArtifactTraces)
                .where(eq(codeArtifactTraces.id, params.artifactId))
                .limit(1);

            if (!artifact) return;

            const trajectory = (artifact.qualityTrajectory as QualityTrajectoryPoint[]) || [];
            const newPoint: QualityTrajectoryPoint = {
                timestamp: new Date().toISOString(),
                errorCount: params.errorCount,
                codeQualityScore: params.codeQualityScore,
                visualQualityScore: params.visualQualityScore,
                antiSlopScore: params.antiSlopScore,
            };

            await db.update(codeArtifactTraces)
                .set({
                    qualityTrajectory: [...trajectory, newPoint],
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(codeArtifactTraces.id, params.artifactId));
        } catch (error) {
            console.error('[ExperienceCapture] Failed to record quality point:', error);
        }
    }

    /**
     * Record pattern usage for an artifact
     */
    async recordPatternUsage(params: {
        artifactId: string;
        patternName: string;
        patternCategory: PatternUsage['patternCategory'];
        firstAttemptSuccess: boolean;
        iterationsToSuccess: number;
    }): Promise<void> {
        try {
            const [artifact] = await db.select()
                .from(codeArtifactTraces)
                .where(eq(codeArtifactTraces.id, params.artifactId))
                .limit(1);

            if (!artifact) return;

            const patterns = (artifact.patternsUsed as PatternUsage[]) || [];
            const newPattern: PatternUsage = {
                patternName: params.patternName,
                patternCategory: params.patternCategory,
                firstAttemptSuccess: params.firstAttemptSuccess,
                iterationsToSuccess: params.iterationsToSuccess,
            };

            await db.update(codeArtifactTraces)
                .set({
                    patternsUsed: [...patterns, newPattern],
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(codeArtifactTraces.id, params.artifactId));
        } catch (error) {
            console.error('[ExperienceCapture] Failed to record pattern usage:', error);
        }
    }

    // =========================================================================
    // DESIGN CHOICE TRACES
    // =========================================================================

    /**
     * Capture design choices made during the build
     */
    async captureDesignChoices(params: {
        buildId: string;
        projectId: string;
        userId: string;
        appSoul: string;
        typography: {
            fontsChosen: string[];
            fontsRejected: string[];
            reasoning: string;
            antiSlopCompliant: boolean;
        };
        colorSystem: {
            paletteChosen: ColorPalette;
            alternativesConsidered: ColorPalette[];
            soulAppropriatenessScore: number;
        };
        motionLanguage: {
            animationsUsed: AnimationSpec[];
            timingFunctions: string[];
            matchesSoul: boolean;
        };
        layoutDecisions: {
            gridSystem: string;
            spacingRationale: string;
            asymmetryUsed: boolean;
        };
    }): Promise<string> {
        const choiceId = uuidv4();

        try {
            await db.insert(designChoiceTraces).values({
                id: choiceId,
                buildId: params.buildId,
                projectId: params.projectId,
                userId: params.userId,
                appSoul: params.appSoul,
                typography: params.typography,
                colorSystem: params.colorSystem,
                motionLanguage: params.motionLanguage,
                layoutDecisions: params.layoutDecisions,
            });

            // Track in build context
            const buildContext = this.activeBuildContexts.get(params.buildId);
            if (buildContext) {
                buildContext.designChoices.push(choiceId);
            }

            return choiceId;
        } catch (error) {
            console.error('[ExperienceCapture] Failed to capture design choices:', error);
            throw error;
        }
    }

    /**
     * Record visual verifier scores for design choices
     */
    async recordVisualVerifierScores(params: {
        choiceId: string;
        scores: {
            depthScore: number;
            motionScore: number;
            typographyScore: number;
            soulMatchScore: number;
            overall: number;
        };
    }): Promise<void> {
        try {
            await db.update(designChoiceTraces)
                .set({
                    visualVerifierScores: params.scores,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(designChoiceTraces.id, params.choiceId));
        } catch (error) {
            console.error('[ExperienceCapture] Failed to record visual verifier scores:', error);
        }
    }

    // =========================================================================
    // ERROR RECOVERY TRACES
    // =========================================================================

    /**
     * Start tracking an error recovery journey
     */
    async startErrorRecovery(params: {
        buildId: string;
        projectId: string;
        userId: string;
        error: {
            type: ErrorType;
            message: string;
            stackTrace: string;
            fileLocation: string;
        };
    }): Promise<string> {
        const errorId = uuidv4();

        try {
            await db.insert(errorRecoveryTraces).values({
                id: errorId,
                buildId: params.buildId,
                projectId: params.projectId,
                userId: params.userId,
                error: {
                    ...params.error,
                    firstOccurrence: new Date().toISOString(),
                },
                recoveryJourney: [],
            });

            // Track in build context
            const buildContext = this.activeBuildContexts.get(params.buildId);
            if (buildContext) {
                buildContext.errorRecoveries.push(errorId);
            }

            return errorId;
        } catch (error) {
            console.error('[ExperienceCapture] Failed to start error recovery:', error);
            throw error;
        }
    }

    /**
     * Record a recovery attempt
     */
    async recordRecoveryAttempt(params: {
        errorId: string;
        attempt: {
            level: 1 | 2 | 3 | 4;
            modelUsed: string;
            thinkingTrace: string;
            fixApplied: string;
            result: RecoveryAttempt['result'];
            timeTakenMs: number;
        };
    }): Promise<void> {
        try {
            const [errorTrace] = await db.select()
                .from(errorRecoveryTraces)
                .where(eq(errorRecoveryTraces.id, params.errorId))
                .limit(1);

            if (!errorTrace) return;

            const journey = (errorTrace.recoveryJourney as RecoveryAttempt[]) || [];
            const attemptNumber = journey.length + 1;

            const newAttempt: RecoveryAttempt = {
                attempt: attemptNumber,
                ...params.attempt,
            };

            await db.update(errorRecoveryTraces)
                .set({
                    recoveryJourney: [...journey, newAttempt],
                    totalTimeTakenMs: (errorTrace.totalTimeTakenMs || 0) + params.attempt.timeTakenMs,
                    wasEscalated: params.attempt.level > 1,
                })
                .where(eq(errorRecoveryTraces.id, params.errorId));
        } catch (error) {
            console.error('[ExperienceCapture] Failed to record recovery attempt:', error);
        }
    }

    /**
     * Mark error as resolved with successful fix
     */
    async resolveError(params: {
        errorId: string;
        successfulFix: SuccessfulFix;
    }): Promise<void> {
        try {
            await db.update(errorRecoveryTraces)
                .set({
                    successfulFix: params.successfulFix,
                    resolvedAt: new Date().toISOString(),
                })
                .where(eq(errorRecoveryTraces.id, params.errorId));
        } catch (error) {
            console.error('[ExperienceCapture] Failed to resolve error:', error);
        }
    }

    // =========================================================================
    // QUERIES
    // =========================================================================

    /**
     * Get all decision traces for a build
     */
    async getDecisionTracesForBuild(buildId: string): Promise<DecisionTrace[]> {
        try {
            const results = await db.select()
                .from(decisionTraces)
                .where(eq(decisionTraces.buildId, buildId));

            return results.map(r => ({
                traceId: r.id,
                buildId: r.buildId,
                userId: r.userId,
                projectId: r.projectId,
                timestamp: r.createdAt,
                phase: r.phase as BuildPhase,
                decisionType: r.decisionType as DecisionType,
                context: r.context as DecisionTrace['context'],
                decision: r.decision as DecisionTrace['decision'],
                outcome: r.outcome as DecisionTrace['outcome'],
                outcomeRecordedAt: r.outcomeRecordedAt,
            }));
        } catch (error) {
            console.error('[ExperienceCapture] Failed to get decision traces:', error);
            return [];
        }
    }

    /**
     * Get successful decision traces for learning
     */
    async getSuccessfulDecisionTraces(params: {
        limit?: number;
        minConfidence?: number;
        domain?: DecisionType;
    }): Promise<DecisionTrace[]> {
        try {
            const results = await db.select()
                .from(decisionTraces)
                .limit(params.limit || 1000);

            // Filter in memory for complex conditions
            return results
                .filter(r => {
                    const outcome = r.outcome as DecisionTrace['outcome'];
                    const decision = r.decision as DecisionTrace['decision'];

                    if (!outcome || outcome.immediateResult !== 'success') return false;
                    if (params.minConfidence && decision.confidence < params.minConfidence) return false;
                    if (params.domain && r.decisionType !== params.domain) return false;

                    return true;
                })
                .map(r => ({
                    traceId: r.id,
                    buildId: r.buildId,
                    userId: r.userId,
                    projectId: r.projectId,
                    timestamp: r.createdAt,
                    phase: r.phase as BuildPhase,
                    decisionType: r.decisionType as DecisionType,
                    context: r.context as DecisionTrace['context'],
                    decision: r.decision as DecisionTrace['decision'],
                    outcome: r.outcome as DecisionTrace['outcome'],
                    outcomeRecordedAt: r.outcomeRecordedAt,
                }));
        } catch (error) {
            console.error('[ExperienceCapture] Failed to get successful traces:', error);
            return [];
        }
    }

    /**
     * Get error recovery traces with successful fixes for pattern extraction
     */
    async getSuccessfulErrorRecoveries(limit = 100): Promise<ErrorRecoveryTrace[]> {
        try {
            const results = await db.select()
                .from(errorRecoveryTraces)
                .limit(limit * 2); // Fetch more to filter

            return results
                .filter(r => r.successfulFix !== null)
                .slice(0, limit)
                .map(r => ({
                    errorId: r.id,
                    buildId: r.buildId,
                    projectId: r.projectId,
                    userId: r.userId,
                    error: r.error as ErrorRecoveryTrace['error'],
                    recoveryJourney: r.recoveryJourney as RecoveryAttempt[],
                    successfulFix: r.successfulFix as SuccessfulFix,
                    totalTimeTakenMs: r.totalTimeTakenMs || 0,
                    wasEscalated: r.wasEscalated || false,
                    createdAt: r.createdAt,
                    resolvedAt: r.resolvedAt,
                }));
        } catch (error) {
            console.error('[ExperienceCapture] Failed to get error recoveries:', error);
            return [];
        }
    }

    /**
     * Get build statistics for flywheel metrics
     */
    async getBuildStatistics(params: { days?: number } = {}): Promise<{
        totalBuilds: number;
        successfulBuilds: number;
        failedBuilds: number;
        avgDurationMs: number;
        avgTokensUsed: number;
        totalDecisionTraces: number;
    }> {
        try {
            const allBuilds = await db.select().from(buildRecords);
            const allTraces = await db.select().from(decisionTraces);

            const successfulBuilds = allBuilds.filter(b => b.status === 'completed');
            const failedBuilds = allBuilds.filter(b => b.status === 'failed');

            const avgDuration = successfulBuilds.length > 0
                ? successfulBuilds.reduce((sum, b) => sum + (b.totalDurationMs || 0), 0) / successfulBuilds.length
                : 0;

            const avgTokens = allBuilds.length > 0
                ? allBuilds.reduce((sum, b) => sum + (b.totalTokensUsed || 0), 0) / allBuilds.length
                : 0;

            return {
                totalBuilds: allBuilds.length,
                successfulBuilds: successfulBuilds.length,
                failedBuilds: failedBuilds.length,
                avgDurationMs: Math.round(avgDuration),
                avgTokensUsed: Math.round(avgTokens),
                totalDecisionTraces: allTraces.length,
            };
        } catch (error) {
            console.error('[ExperienceCapture] Failed to get build statistics:', error);
            return {
                totalBuilds: 0,
                successfulBuilds: 0,
                failedBuilds: 0,
                avgDurationMs: 0,
                avgTokensUsed: 0,
                totalDecisionTraces: 0,
            };
        }
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: ExperienceCaptureService | null = null;

export function getExperienceCaptureService(): ExperienceCaptureService {
    if (!instance) {
        instance = new ExperienceCaptureService();
    }
    return instance;
}

