/**
 * Experience Capture Service
 *
 * Captures decision traces, code artifacts, design choices, and error recoveries
 * from the build process. This is Layer 1 of the Autonomous Learning Engine.
 *
 * Every build generates learning signals that feed into the RLAIF pipeline.
 */

import { db } from '../../db.js';
import {
    learningDecisionTraces,
    learningCodeArtifacts,
    learningDesignChoices,
    learningErrorRecoveries,
} from '../../schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import type {
    DecisionTrace,
    DecisionContext,
    DecisionMade,
    DecisionOutcome,
    DecisionType,
    BuildPhase,
    CodeArtifactTrace,
    CodeVersion,
    QualityDataPoint,
    PatternUsage,
    DesignChoiceTrace,
    ErrorRecoveryTrace,
    ErrorInfo,
    RecoveryAttempt,
    SuccessfulFix,
    ExperienceCaptureConfig,
} from './types.js';

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: ExperienceCaptureConfig = {
    enableDecisionCapture: true,
    enableCodeCapture: true,
    enableDesignCapture: true,
    enableErrorCapture: true,
    captureThinkingTrace: true,
    maxCodeVersions: 20,
};

// =============================================================================
// EXPERIENCE CAPTURE SERVICE
// =============================================================================

export class ExperienceCaptureService extends EventEmitter {
    private config: ExperienceCaptureConfig;
    private activeBuildId: string | null = null;
    private projectId: string | null = null;
    private userId: string;

    // In-memory caches for current build
    private codeArtifactCache: Map<string, CodeArtifactTrace> = new Map();
    private pendingDecisions: Map<string, DecisionTrace> = new Map();

    constructor(userId: string, config?: Partial<ExperienceCaptureConfig>) {
        super();
        this.userId = userId;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // =========================================================================
    // BUILD SESSION MANAGEMENT
    // =========================================================================

    /**
     * Start a new build session for experience capture
     */
    startBuildSession(buildId: string, projectId: string): void {
        this.activeBuildId = buildId;
        this.projectId = projectId;
        this.codeArtifactCache.clear();
        this.pendingDecisions.clear();

        this.emit('session_start', { buildId, projectId });
        console.log(`[ExperienceCapture] Started build session: ${buildId}`);
    }

    /**
     * End the current build session
     */
    async endBuildSession(): Promise<void> {
        // Persist any pending code artifacts
        for (const artifact of this.codeArtifactCache.values()) {
            await this.persistCodeArtifact(artifact);
        }

        const buildId = this.activeBuildId;
        this.activeBuildId = null;
        this.projectId = null;
        this.codeArtifactCache.clear();
        this.pendingDecisions.clear();

        this.emit('session_end', { buildId });
        console.log(`[ExperienceCapture] Ended build session: ${buildId}`);
    }

    // =========================================================================
    // DECISION TRACE CAPTURE
    // =========================================================================

    /**
     * Capture a decision made during the build process
     */
    async captureDecision(
        phase: BuildPhase,
        decisionType: DecisionType,
        context: DecisionContext,
        decision: DecisionMade
    ): Promise<string> {
        if (!this.config.enableDecisionCapture) {
            return '';
        }

        const traceId = `dt_${uuidv4()}`;
        const now = new Date();

        const trace: DecisionTrace = {
            traceId,
            buildId: this.activeBuildId || undefined,
            projectId: this.projectId || undefined,
            userId: this.userId,
            phase,
            decisionType,
            context: {
                ...context,
                thinkingTrace: this.config.captureThinkingTrace ? context.thinkingTrace : undefined,
            },
            decision,
            createdAt: now,
        };

        // Store pending (outcome will be recorded later)
        this.pendingDecisions.set(traceId, trace);

        // Persist to database
        await this.persistDecisionTrace(trace);

        this.emit('decision_captured', { traceId, phase, decisionType });
        console.log(`[ExperienceCapture] Captured decision: ${decisionType} in ${phase}`);

        return traceId;
    }

    /**
     * Record the outcome of a previously captured decision
     */
    async recordDecisionOutcome(traceId: string, outcome: DecisionOutcome): Promise<void> {
        const trace = this.pendingDecisions.get(traceId);
        if (trace) {
            trace.outcome = outcome;
            trace.outcomeRecordedAt = new Date();
            await this.updateDecisionOutcome(traceId, outcome);
            this.pendingDecisions.delete(traceId);

            this.emit('outcome_recorded', { traceId, outcome });
        } else {
            // Decision might have been persisted, update directly
            await this.updateDecisionOutcome(traceId, outcome);
        }
    }

    // =========================================================================
    // CODE ARTIFACT CAPTURE
    // =========================================================================

    /**
     * Capture a code change (file creation or modification)
     */
    async captureCodeChange(
        filePath: string,
        code: string,
        trigger: CodeVersion['trigger'],
        agent?: string
    ): Promise<string> {
        if (!this.config.enableCodeCapture) {
            return '';
        }

        const now = new Date().toISOString();
        let artifact = this.codeArtifactCache.get(filePath);

        if (!artifact) {
            const artifactId = `ca_${uuidv4()}`;
            artifact = {
                artifactId,
                buildId: this.activeBuildId || undefined,
                projectId: this.projectId || undefined,
                userId: this.userId,
                filePath,
                versions: [],
                qualityTrajectory: [],
                patternsUsed: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            this.codeArtifactCache.set(filePath, artifact);
        }

        // Add new version
        const version: CodeVersion = {
            version: artifact.versions.length + 1,
            code,
            timestamp: now,
            trigger,
            changedByAgent: agent,
        };

        artifact.versions.push(version);
        artifact.updatedAt = new Date();

        // Trim old versions if needed
        if (artifact.versions.length > this.config.maxCodeVersions) {
            artifact.versions = artifact.versions.slice(-this.config.maxCodeVersions);
        }

        this.emit('code_captured', { filePath, version: version.version, trigger });

        return artifact.artifactId;
    }

    /**
     * Record quality metrics for a code artifact
     */
    async recordCodeQuality(
        filePath: string,
        errorCount: number,
        codeQualityScore: number,
        visualQualityScore?: number,
        antiSlopScore?: number
    ): Promise<void> {
        const artifact = this.codeArtifactCache.get(filePath);
        if (!artifact) return;

        const dataPoint: QualityDataPoint = {
            timestamp: new Date().toISOString(),
            errorCount,
            codeQualityScore,
            visualQualityScore,
            antiSlopScore,
        };

        artifact.qualityTrajectory.push(dataPoint);
        artifact.updatedAt = new Date();
    }

    /**
     * Record pattern usage in a code artifact
     */
    async recordPatternUsage(
        filePath: string,
        patternName: string,
        patternCategory: PatternUsage['patternCategory'],
        firstAttemptSuccess: boolean,
        iterations: number
    ): Promise<void> {
        const artifact = this.codeArtifactCache.get(filePath);
        if (!artifact) return;

        const patternUsage: PatternUsage = {
            patternName,
            patternCategory,
            firstAttemptSuccess,
            iterationsToSuccess: iterations,
        };

        artifact.patternsUsed.push(patternUsage);
        artifact.updatedAt = new Date();
    }

    // =========================================================================
    // DESIGN CHOICE CAPTURE
    // =========================================================================

    /**
     * Capture design choices for a build
     */
    async captureDesignChoice(
        appSoul: string,
        typography?: DesignChoiceTrace['typography'],
        colorSystem?: DesignChoiceTrace['colorSystem'],
        motionLanguage?: DesignChoiceTrace['motionLanguage'],
        layoutDecisions?: DesignChoiceTrace['layoutDecisions']
    ): Promise<string> {
        if (!this.config.enableDesignCapture) {
            return '';
        }

        const choiceId = `dc_${uuidv4()}`;
        const now = new Date();

        const choice: DesignChoiceTrace = {
            choiceId,
            buildId: this.activeBuildId || undefined,
            projectId: this.projectId || undefined,
            userId: this.userId,
            appSoul,
            typography,
            colorSystem,
            motionLanguage,
            layoutDecisions,
            createdAt: now,
        };

        await this.persistDesignChoice(choice);

        this.emit('design_captured', { choiceId, appSoul });
        console.log(`[ExperienceCapture] Captured design choice for soul: ${appSoul}`);

        return choiceId;
    }

    /**
     * Record visual verification scores for a design choice
     */
    async recordDesignScores(
        choiceId: string,
        scores: DesignChoiceTrace['visualScores']
    ): Promise<void> {
        await this.updateDesignScores(choiceId, scores);
        this.emit('design_scores_recorded', { choiceId, scores });
    }

    // =========================================================================
    // ERROR RECOVERY CAPTURE
    // =========================================================================

    /**
     * Capture an error that occurred during the build
     */
    async captureError(error: ErrorInfo): Promise<string> {
        if (!this.config.enableErrorCapture) {
            return '';
        }

        const errorId = `er_${uuidv4()}`;
        const now = new Date();

        const recovery: ErrorRecoveryTrace = {
            errorId,
            buildId: this.activeBuildId || undefined,
            projectId: this.projectId || undefined,
            userId: this.userId,
            error,
            recoveryJourney: [],
            createdAt: now,
        };

        await this.persistErrorRecovery(recovery);

        this.emit('error_captured', { errorId, errorType: error.type });
        console.log(`[ExperienceCapture] Captured error: ${error.type}`);

        return errorId;
    }

    /**
     * Record a recovery attempt for an error
     */
    async recordRecoveryAttempt(
        errorId: string,
        attempt: RecoveryAttempt
    ): Promise<void> {
        await this.addRecoveryAttempt(errorId, attempt);
        this.emit('recovery_attempt', { errorId, attempt: attempt.attempt, result: attempt.result });
    }

    /**
     * Record successful fix for an error
     */
    async recordSuccessfulFix(
        errorId: string,
        fix: SuccessfulFix
    ): Promise<void> {
        await this.updateSuccessfulFix(errorId, fix);
        this.emit('error_resolved', { errorId, levelRequired: fix.levelRequired });
    }

    // =========================================================================
    // LATTICE EXPERIENCE CAPTURE
    // =========================================================================

    /**
     * Capture LATTICE cell build experiences for learning
     *
     * Records the results of each cell build, including the patterns used,
     * quality scores, and build times. This data feeds into the learning
     * engine to improve future cell building.
     */
    async captureLatticeExperience(
        blueprintId: string,
        cellResults: Map<string, {
            cellId: string;
            cellName: string;
            cellType: string;
            complexity: string;
            success: boolean;
            qualityScore: number;
            buildTime: number;
            files: Array<{ path: string; content: string }>;
            interfaceCompliance: { inputsValid: boolean; outputsValid: boolean; errors: string[] };
            patternsUsed?: string[];
            approach?: string;
        }>
    ): Promise<void> {
        if (!this.config.enableDecisionCapture) {
            return;
        }

        console.log(`[ExperienceCapture] Capturing LATTICE experience for blueprint: ${blueprintId} with ${cellResults.size} cells`);

        for (const [cellId, result] of cellResults) {
            try {
                // Capture each cell build as a decision trace
                const decisionContext: DecisionContext = {
                    intentSnippet: `LATTICE cell: ${result.cellName} (${result.cellType})`,
                    previousAttempts: 0,
                    buildPhase: 'build',
                    relatedFiles: result.files.map(f => f.path),
                };

                const decisionMade: DecisionMade = {
                    chosenOption: result.approach || `Build ${result.cellType} cell: ${result.cellName}`,
                    rejectedOptions: [],
                    reasoning: `LATTICE parallel build: ${result.complexity} complexity cell`,
                    confidence: result.qualityScore / 100,
                };

                const traceId = await this.captureDecision(
                    'build',
                    'lattice_cell_build',
                    decisionContext,
                    decisionMade
                );

                // Record the outcome immediately since we have the results
                const outcome: DecisionOutcome = {
                    immediateResult: result.success ? 'success' : 'failure',
                    verificationScores: {
                        quality: result.qualityScore,
                        inputsValid: result.interfaceCompliance.inputsValid ? 100 : 0,
                        outputsValid: result.interfaceCompliance.outputsValid ? 100 : 0,
                    },
                    requiredFixes: result.interfaceCompliance.errors.length,
                    finalInProduction: result.success,
                };

                await this.recordDecisionOutcome(traceId, outcome);

                // Capture code artifacts for each file
                for (const file of result.files) {
                    if (result.success && file.content.length > 0) {
                        await this.captureCodeChange(
                            file.path,
                            file.content,
                            'initial',
                            `lattice-${cellId}`
                        );
                    }
                }

                this.emit('lattice_cell_captured', {
                    blueprintId,
                    cellId,
                    cellType: result.cellType,
                    success: result.success,
                    qualityScore: result.qualityScore,
                    buildTime: result.buildTime,
                });

            } catch (error) {
                console.error(`[ExperienceCapture] Failed to capture LATTICE cell ${cellId}:`, error);
            }
        }

        console.log(`[ExperienceCapture] Captured ${cellResults.size} LATTICE cell experiences`);
    }

    /**
     * Capture a complete LATTICE blueprint execution
     */
    async captureLatticeBlueprint(
        blueprintId: string,
        appName: string,
        totalCells: number,
        successfulCells: number,
        failedCells: number,
        averageQualityScore: number,
        speedup: number,
        totalBuildTime: number
    ): Promise<string> {
        const decisionContext: DecisionContext = {
            intentSnippet: `LATTICE blueprint: ${appName}`,
            previousAttempts: 0,
            buildPhase: 'build',
        };

        const decisionMade: DecisionMade = {
            chosenOption: `LATTICE parallel build with ${totalCells} cells`,
            rejectedOptions: ['Sequential build', 'Traditional task-based build'],
            reasoning: `Used LATTICE parallel building for ${speedup.toFixed(1)}x speedup`,
            confidence: averageQualityScore / 100,
        };

        const traceId = await this.captureDecision(
            'build',
            'lattice_cell_build',
            decisionContext,
            decisionMade
        );

        const outcome: DecisionOutcome = {
            immediateResult: failedCells === 0 ? 'success' : failedCells < successfulCells ? 'partial' : 'failure',
            verificationScores: {
                quality: averageQualityScore,
                successRate: (successfulCells / totalCells) * 100,
                speedup: speedup * 10, // Normalize to 0-100 scale (10x speedup = 100)
            },
            requiredFixes: failedCells,
            finalInProduction: failedCells === 0,
        };

        await this.recordDecisionOutcome(traceId, outcome);

        this.emit('lattice_blueprint_captured', {
            blueprintId,
            appName,
            totalCells,
            successfulCells,
            failedCells,
            averageQualityScore,
            speedup,
            totalBuildTime,
        });

        console.log(`[ExperienceCapture] Captured LATTICE blueprint: ${appName} (${successfulCells}/${totalCells} cells, ${speedup.toFixed(1)}x speedup)`);

        return traceId;
    }

    // =========================================================================
    // QUERY METHODS
    // =========================================================================

    /**
     * Get all decision traces for a build
     */
    async getDecisionTraces(buildId: string): Promise<DecisionTrace[]> {
        const rows = await db.select()
            .from(learningDecisionTraces)
            .where(eq(learningDecisionTraces.buildId, buildId))
            .orderBy(learningDecisionTraces.createdAt);

        return rows.map(this.mapDecisionTraceRow);
    }

    /**
     * Get recent decision traces for learning
     */
    async getRecentDecisionTraces(limit: number = 1000): Promise<DecisionTrace[]> {
        const rows = await db.select()
            .from(learningDecisionTraces)
            .orderBy(desc(learningDecisionTraces.createdAt))
            .limit(limit);

        return rows.map(this.mapDecisionTraceRow);
    }

    /**
     * Get decision traces with outcomes (for preference pair generation)
     */
    async getDecisionTracesWithOutcomes(limit: number = 500): Promise<DecisionTrace[]> {
        const rows = await db.select()
            .from(learningDecisionTraces)
            .where(and(
                eq(learningDecisionTraces.userId, this.userId)
            ))
            .orderBy(desc(learningDecisionTraces.createdAt))
            .limit(limit);

        return rows
            .filter(row => row.outcome !== null)
            .map(this.mapDecisionTraceRow);
    }

    /**
     * Get code artifacts for a build
     */
    async getCodeArtifacts(buildId: string): Promise<CodeArtifactTrace[]> {
        const rows = await db.select()
            .from(learningCodeArtifacts)
            .where(eq(learningCodeArtifacts.buildId, buildId));

        return rows.map(this.mapCodeArtifactRow);
    }

    /**
     * Get design choices for a build
     */
    async getDesignChoices(buildId: string): Promise<DesignChoiceTrace[]> {
        const rows = await db.select()
            .from(learningDesignChoices)
            .where(eq(learningDesignChoices.buildId, buildId));

        return rows.map(this.mapDesignChoiceRow);
    }

    /**
     * Get error recoveries for a build
     */
    async getErrorRecoveries(buildId: string): Promise<ErrorRecoveryTrace[]> {
        const rows = await db.select()
            .from(learningErrorRecoveries)
            .where(eq(learningErrorRecoveries.buildId, buildId));

        return rows.map(this.mapErrorRecoveryRow);
    }

    /**
     * Get successful error fixes for pattern extraction
     */
    async getSuccessfulFixes(limit: number = 500): Promise<ErrorRecoveryTrace[]> {
        const rows = await db.select()
            .from(learningErrorRecoveries)
            .orderBy(desc(learningErrorRecoveries.createdAt))
            .limit(limit);

        return rows
            .filter(row => row.successfulFix !== null)
            .map(this.mapErrorRecoveryRow);
    }

    // =========================================================================
    // PERSISTENCE METHODS
    // =========================================================================

    private async persistDecisionTrace(trace: DecisionTrace): Promise<void> {
        try {
            await db.insert(learningDecisionTraces).values({
                id: uuidv4(),
                traceId: trace.traceId,
                buildId: trace.buildId,
                projectId: trace.projectId,
                userId: trace.userId,
                phase: trace.phase,
                decisionType: trace.decisionType,
                context: trace.context,
                decision: trace.decision,
                outcome: trace.outcome,
                createdAt: trace.createdAt.toISOString(),
                outcomeRecordedAt: trace.outcomeRecordedAt?.toISOString(),
            });
        } catch (error) {
            console.error('[ExperienceCapture] Failed to persist decision trace:', error);
        }
    }

    private async updateDecisionOutcome(traceId: string, outcome: DecisionOutcome): Promise<void> {
        try {
            await db.update(learningDecisionTraces)
                .set({
                    outcome,
                    outcomeRecordedAt: new Date().toISOString(),
                })
                .where(eq(learningDecisionTraces.traceId, traceId));
        } catch (error) {
            console.error('[ExperienceCapture] Failed to update decision outcome:', error);
        }
    }

    private async persistCodeArtifact(artifact: CodeArtifactTrace): Promise<void> {
        try {
            const existing = await db.select()
                .from(learningCodeArtifacts)
                .where(eq(learningCodeArtifacts.artifactId, artifact.artifactId))
                .limit(1);

            if (existing.length > 0) {
                await db.update(learningCodeArtifacts)
                    .set({
                        versions: artifact.versions,
                        qualityTrajectory: artifact.qualityTrajectory,
                        patternsUsed: artifact.patternsUsed,
                        updatedAt: artifact.updatedAt.toISOString(),
                    })
                    .where(eq(learningCodeArtifacts.artifactId, artifact.artifactId));
            } else {
                await db.insert(learningCodeArtifacts).values({
                    id: uuidv4(),
                    artifactId: artifact.artifactId,
                    buildId: artifact.buildId,
                    projectId: artifact.projectId,
                    userId: artifact.userId,
                    filePath: artifact.filePath,
                    versions: artifact.versions,
                    qualityTrajectory: artifact.qualityTrajectory,
                    patternsUsed: artifact.patternsUsed,
                    createdAt: artifact.createdAt.toISOString(),
                    updatedAt: artifact.updatedAt.toISOString(),
                });
            }
        } catch (error) {
            console.error('[ExperienceCapture] Failed to persist code artifact:', error);
        }
    }

    private async persistDesignChoice(choice: DesignChoiceTrace): Promise<void> {
        try {
            await db.insert(learningDesignChoices).values({
                id: uuidv4(),
                choiceId: choice.choiceId,
                buildId: choice.buildId,
                projectId: choice.projectId,
                userId: choice.userId,
                appSoul: choice.appSoul,
                typography: choice.typography,
                colorSystem: choice.colorSystem,
                motionLanguage: choice.motionLanguage,
                layoutDecisions: choice.layoutDecisions,
                visualScores: choice.visualScores,
                createdAt: choice.createdAt.toISOString(),
            });
        } catch (error) {
            console.error('[ExperienceCapture] Failed to persist design choice:', error);
        }
    }

    private async updateDesignScores(
        choiceId: string,
        scores: DesignChoiceTrace['visualScores']
    ): Promise<void> {
        try {
            await db.update(learningDesignChoices)
                .set({ visualScores: scores })
                .where(eq(learningDesignChoices.choiceId, choiceId));
        } catch (error) {
            console.error('[ExperienceCapture] Failed to update design scores:', error);
        }
    }

    private async persistErrorRecovery(recovery: ErrorRecoveryTrace): Promise<void> {
        try {
            await db.insert(learningErrorRecoveries).values({
                id: uuidv4(),
                errorId: recovery.errorId,
                buildId: recovery.buildId,
                projectId: recovery.projectId,
                userId: recovery.userId,
                error: recovery.error,
                recoveryJourney: recovery.recoveryJourney,
                successfulFix: recovery.successfulFix,
                createdAt: recovery.createdAt.toISOString(),
                resolvedAt: recovery.resolvedAt?.toISOString(),
            });
        } catch (error) {
            console.error('[ExperienceCapture] Failed to persist error recovery:', error);
        }
    }

    private async addRecoveryAttempt(errorId: string, attempt: RecoveryAttempt): Promise<void> {
        try {
            const [existing] = await db.select()
                .from(learningErrorRecoveries)
                .where(eq(learningErrorRecoveries.errorId, errorId))
                .limit(1);

            if (existing) {
                const journey = (existing.recoveryJourney as RecoveryAttempt[]) || [];
                journey.push(attempt);

                await db.update(learningErrorRecoveries)
                    .set({ recoveryJourney: journey })
                    .where(eq(learningErrorRecoveries.errorId, errorId));
            }
        } catch (error) {
            console.error('[ExperienceCapture] Failed to add recovery attempt:', error);
        }
    }

    private async updateSuccessfulFix(errorId: string, fix: SuccessfulFix): Promise<void> {
        try {
            await db.update(learningErrorRecoveries)
                .set({
                    successfulFix: fix,
                    resolvedAt: new Date().toISOString(),
                })
                .where(eq(learningErrorRecoveries.errorId, errorId));
        } catch (error) {
            console.error('[ExperienceCapture] Failed to update successful fix:', error);
        }
    }

    // =========================================================================
    // ROW MAPPING
    // =========================================================================

    private mapDecisionTraceRow = (row: typeof learningDecisionTraces.$inferSelect): DecisionTrace => ({
        traceId: row.traceId,
        buildId: row.buildId || undefined,
        projectId: row.projectId || undefined,
        userId: row.userId,
        phase: row.phase as BuildPhase,
        decisionType: row.decisionType as DecisionType,
        context: (row.context as DecisionContext) || { previousAttempts: 0 },
        decision: (row.decision as DecisionMade) || { chosenOption: '', rejectedOptions: [], reasoning: '', confidence: 0 },
        outcome: row.outcome as DecisionOutcome | undefined,
        createdAt: new Date(row.createdAt),
        outcomeRecordedAt: row.outcomeRecordedAt ? new Date(row.outcomeRecordedAt) : undefined,
    });

    private mapCodeArtifactRow = (row: typeof learningCodeArtifacts.$inferSelect): CodeArtifactTrace => ({
        artifactId: row.artifactId,
        buildId: row.buildId || undefined,
        projectId: row.projectId || undefined,
        userId: row.userId,
        filePath: row.filePath,
        versions: (row.versions as CodeVersion[]) || [],
        qualityTrajectory: (row.qualityTrajectory as QualityDataPoint[]) || [],
        patternsUsed: (row.patternsUsed as PatternUsage[]) || [],
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
    });

    private mapDesignChoiceRow = (row: typeof learningDesignChoices.$inferSelect): DesignChoiceTrace => ({
        choiceId: row.choiceId,
        buildId: row.buildId || undefined,
        projectId: row.projectId || undefined,
        userId: row.userId,
        appSoul: row.appSoul || undefined,
        typography: row.typography as DesignChoiceTrace['typography'],
        colorSystem: row.colorSystem as DesignChoiceTrace['colorSystem'],
        motionLanguage: row.motionLanguage as DesignChoiceTrace['motionLanguage'],
        layoutDecisions: row.layoutDecisions as DesignChoiceTrace['layoutDecisions'],
        visualScores: row.visualScores as DesignChoiceTrace['visualScores'],
        createdAt: new Date(row.createdAt),
    });

    private mapErrorRecoveryRow = (row: typeof learningErrorRecoveries.$inferSelect): ErrorRecoveryTrace => ({
        errorId: row.errorId,
        buildId: row.buildId || undefined,
        projectId: row.projectId || undefined,
        userId: row.userId,
        error: (row.error as ErrorInfo) || { type: '', message: '', stackTrace: '', fileLocation: '', firstOccurrence: '' },
        recoveryJourney: (row.recoveryJourney as RecoveryAttempt[]) || [],
        successfulFix: row.successfulFix as SuccessfulFix | null,
        createdAt: new Date(row.createdAt),
        resolvedAt: row.resolvedAt ? new Date(row.resolvedAt) : undefined,
    });
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createExperienceCaptureService(
    userId: string,
    config?: Partial<ExperienceCaptureConfig>
): ExperienceCaptureService {
    return new ExperienceCaptureService(userId, config);
}

// =============================================================================
// SINGLETON FOR GLOBAL ACCESS
// =============================================================================

let globalInstance: ExperienceCaptureService | null = null;

export function getExperienceCaptureService(
    userId?: string,
    config?: Partial<ExperienceCaptureConfig>
): ExperienceCaptureService {
    if (!globalInstance && userId) {
        globalInstance = new ExperienceCaptureService(userId, config);
    }
    if (!globalInstance) {
        throw new Error('ExperienceCaptureService not initialized. Provide userId.');
    }
    return globalInstance;
}

export function resetExperienceCaptureService(): void {
    globalInstance = null;
}

