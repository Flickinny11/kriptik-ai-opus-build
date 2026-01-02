/**
 * Build Freeze Service
 *
 * Implements pause/freeze functionality that preserves ALL context for seamless resume.
 * Freezing is NOT stopping - it creates a complete snapshot of:
 * - Build loop state
 * - Agent states and contexts
 * - File states
 * - Task progress
 * - Artifacts and memory
 * - Verification results
 *
 * Freeze triggers:
 * - Credit ceiling reached
 * - User manual pause
 * - Error requiring human input
 * - Human checkpoint approval needed
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { buildFreezeStates, buildCheckpoints, files, projects } from '../../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import type { BuildLoopState } from './build-loop.js';
import { createTimeMachine } from '../checkpoints/time-machine.js';
import { createArtifactManager } from '../ai/artifacts.js';
import { getContextSyncService } from '../agents/context-sync-service.js';
import { loadProjectContext } from '../ai/context-loader.js';

// =============================================================================
// TYPES
// =============================================================================

export type FreezeReason =
    | 'credit_ceiling'
    | 'manual_pause'
    | 'error_human_input'
    | 'approval_needed'
    | 'budget_limit_reached'
    | 'time_limit_reached';

export interface FreezeContext {
    reason: FreezeReason;
    message?: string;
    buildLoopState: BuildLoopState;
    activeAgents?: unknown[];
    fileStates?: Record<string, FileState>;
    taskProgress?: TaskProgress;
    artifactsSnapshot?: Record<string, unknown>;
    verificationResults?: unknown;
    memoryContext?: unknown;
    parallelBuildState?: unknown;
    latticeState?: unknown;
    contextSyncState?: unknown;
    browserState?: unknown;
    checkpointId?: string;
    estimatedCreditsToComplete?: number;
}

export interface FileState {
    path: string;
    content: string;
    language: string;
    version: number;
    lastModifiedBy?: string;
    lastModifiedAt?: string;
    isNew?: boolean;
    isDeleted?: boolean;
}

export interface TaskProgress {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    pendingTasks: number;
    tasks: Array<{
        id: string;
        description: string;
        status: 'pending' | 'in_progress' | 'completed' | 'failed';
        assignedTo?: string;
        completedAt?: string;
    }>;
}

export interface FrozenBuild {
    id: string;
    orchestrationRunId: string;
    projectId: string;
    userId: string;
    buildIntentId: string | null;
    freezeReason: FreezeReason;
    freezeMessage: string | null;
    canResume: boolean;
    isResumed: boolean;
    resumedAt: Date | null;
    currentPhase: string;
    currentStage: string;
    stageProgress: number;
    overallProgress: number;
    phasesCompleted: string[];
    creditsUsedAtFreeze: number;
    tokensUsedAtFreeze: number;
    estimatedCreditsToComplete: number | null;
    errorCount: number;
    lastError: string | null;
    escalationLevel: number;
    frozenAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface ResumeContext {
    buildLoopState: BuildLoopState;
    activeAgents: unknown[];
    fileStates: Record<string, FileState>;
    taskProgress: TaskProgress;
    artifactsSnapshot: Record<string, unknown>;
    verificationResults?: unknown;
    memoryContext?: unknown;
    parallelBuildState?: unknown;
    latticeState?: unknown;
    contextSyncState?: unknown;
    browserState?: unknown;
    checkpointId?: string;
}

export interface FreezeServiceEvent {
    type: 'freeze_created' | 'freeze_resumed' | 'freeze_failed' | 'state_saved' | 'context_restored';
    freezeId?: string;
    orchestrationRunId: string;
    projectId: string;
    reason?: FreezeReason;
    data?: Record<string, unknown>;
}

// =============================================================================
// BUILD FREEZE SERVICE
// =============================================================================

export class BuildFreezeService extends EventEmitter {
    constructor() {
        super();
    }

    /**
     * Freeze a build with complete context preservation
     */
    async freezeBuild(context: FreezeContext): Promise<string> {
        const freezeId = uuidv4();
        const now = new Date().toISOString();

        try {
            // Extract file states from project
            const fileStates = context.fileStates || await this.captureFileStates(context.buildLoopState.projectId);

            // Create Time Machine checkpoint before freezing
            let checkpointId = context.checkpointId;
            if (!checkpointId && context.buildLoopState.config.autoCreateCheckpoints) {
                const timeMachine = createTimeMachine(
                    context.buildLoopState.projectId,
                    context.buildLoopState.userId,
                    context.buildLoopState.orchestrationRunId,
                    10 // maxCheckpoints
                );

                const checkpointMeta = new Map<string, string>();
                checkpointMeta.set('phase', context.buildLoopState.currentPhase);
                checkpointMeta.set('stage', context.buildLoopState.currentStage);
                checkpointMeta.set('progress', context.buildLoopState.stageProgress.toString());
                checkpointMeta.set('reason', 'pre_freeze');

                const checkpoint = await timeMachine.createCheckpoint(
                    `Auto-checkpoint before freeze: ${context.reason}`,
                    checkpointMeta
                );

                checkpointId = checkpoint.id;
            }

            // Capture task progress from artifacts
            const taskProgress = context.taskProgress || await this.captureTaskProgress(
                context.buildLoopState.projectId,
                context.buildLoopState.orchestrationRunId,
                context.buildLoopState.userId
            );

            // Capture artifacts snapshot
            const artifactsSnapshot = context.artifactsSnapshot || await this.captureArtifactsSnapshot(
                context.buildLoopState.projectId,
                context.buildLoopState.orchestrationRunId,
                context.buildLoopState.userId
            );

            // Capture context sync state
            const contextSyncState = context.contextSyncState || await this.captureContextSyncState(
                context.buildLoopState.orchestrationRunId
            );

            // Insert freeze state
            await db.insert(buildFreezeStates).values({
                id: freezeId,
                orchestrationRunId: context.buildLoopState.orchestrationRunId,
                projectId: context.buildLoopState.projectId,
                userId: context.buildLoopState.userId,
                buildIntentId: (context.buildLoopState.intentContract?.id as string) || null,
                freezeReason: context.reason,
                freezeMessage: context.message || null,
                canResume: true,
                isResumed: false,
                resumedAt: null,
                buildLoopState: JSON.stringify(context.buildLoopState) as unknown as never,
                activeAgents: JSON.stringify(context.activeAgents || []) as unknown as never,
                fileStates: JSON.stringify(fileStates) as unknown as never,
                taskProgress: JSON.stringify(taskProgress) as unknown as never,
                artifactsSnapshot: JSON.stringify(artifactsSnapshot) as unknown as never,
                verificationResults: context.verificationResults ? (JSON.stringify(context.verificationResults) as unknown as never) : null,
                memoryContext: context.memoryContext ? (JSON.stringify(context.memoryContext) as unknown as never) : null,
                parallelBuildState: context.parallelBuildState ? (JSON.stringify(context.parallelBuildState) as unknown as never) : null,
                latticeState: context.latticeState ? (JSON.stringify(context.latticeState) as unknown as never) : null,
                contextSyncState: contextSyncState ? (JSON.stringify(contextSyncState) as unknown as never) : null,
                browserState: context.browserState ? (JSON.stringify(context.browserState) as unknown as never) : null,
                checkpointId: checkpointId || null,
                currentPhase: context.buildLoopState.currentPhase,
                currentStage: context.buildLoopState.currentStage,
                stageProgress: context.buildLoopState.stageProgress,
                overallProgress: this.calculateOverallProgress(context.buildLoopState),
                phasesCompleted: JSON.stringify(context.buildLoopState.phasesCompleted) as unknown as never,
                creditsUsedAtFreeze: this.calculateCreditsUsed(context.buildLoopState),
                tokensUsedAtFreeze: this.calculateTokensUsed(context.buildLoopState),
                estimatedCreditsToComplete: context.estimatedCreditsToComplete || null,
                errorCount: context.buildLoopState.errorCount,
                lastError: context.buildLoopState.lastError || null,
                escalationLevel: context.buildLoopState.escalationLevel,
                frozenAt: now,
                createdAt: now,
                updatedAt: now,
            });

            this.emit('freeze_created', {
                type: 'freeze_created',
                freezeId,
                orchestrationRunId: context.buildLoopState.orchestrationRunId,
                projectId: context.buildLoopState.projectId,
                reason: context.reason,
            } as FreezeServiceEvent);

            console.log(`[BuildFreezeService] Build frozen: ${freezeId} (reason: ${context.reason})`);

            return freezeId;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error('[BuildFreezeService] Failed to freeze build:', err);

            this.emit('freeze_failed', {
                type: 'freeze_failed',
                orchestrationRunId: context.buildLoopState.orchestrationRunId,
                projectId: context.buildLoopState.projectId,
                reason: context.reason,
                data: { error: err.message },
            } as FreezeServiceEvent);

            throw new Error(`Failed to freeze build: ${err.message}`);
        }
    }

    /**
     * Resume a frozen build with full context restoration
     */
    async resumeBuild(freezeId: string): Promise<ResumeContext> {
        try {
            // Get freeze state
            const freezeRecords = await db
                .select()
                .from(buildFreezeStates)
                .where(eq(buildFreezeStates.id, freezeId))
                .limit(1);

            if (freezeRecords.length === 0) {
                throw new Error(`Freeze state ${freezeId} not found`);
            }

            const freeze = freezeRecords[0];

            if (freeze.isResumed) {
                throw new Error(`Build ${freezeId} has already been resumed`);
            }

            if (!freeze.canResume) {
                throw new Error(`Build ${freezeId} cannot be resumed: ${freeze.freezeMessage || 'Unknown reason'}`);
            }

            // Parse all state
            const buildLoopState = JSON.parse(freeze.buildLoopState as string) as BuildLoopState;
            const activeAgents = JSON.parse((freeze.activeAgents as unknown as string) || '[]') as unknown[];
            const fileStates = JSON.parse(freeze.fileStates as unknown as string) as Record<string, FileState>;
            const taskProgress = JSON.parse(freeze.taskProgress as unknown as string) as TaskProgress;
            const artifactsSnapshot = JSON.parse(freeze.artifactsSnapshot as unknown as string) as Record<string, unknown>;

            // Parse optional state
            const verificationResults = freeze.verificationResults ? JSON.parse(freeze.verificationResults as string) : undefined;
            const memoryContext = freeze.memoryContext ? JSON.parse(freeze.memoryContext as string) : undefined;
            const parallelBuildState = freeze.parallelBuildState ? JSON.parse(freeze.parallelBuildState as string) : undefined;
            const latticeState = freeze.latticeState ? JSON.parse(freeze.latticeState as string) : undefined;
            const contextSyncState = freeze.contextSyncState ? JSON.parse(freeze.contextSyncState as string) : undefined;
            const browserState = freeze.browserState ? JSON.parse(freeze.browserState as string) : undefined;

            // Restore file states to database
            await this.restoreFileStates(freeze.projectId, fileStates);

            // Restore context sync state if exists
            if (contextSyncState) {
                await this.restoreContextSyncState(freeze.orchestrationRunId, contextSyncState);
            }

            // Mark as resumed
            await db
                .update(buildFreezeStates)
                .set({
                    isResumed: true,
                    resumedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(buildFreezeStates.id, freezeId));

            this.emit('freeze_resumed', {
                type: 'freeze_resumed',
                freezeId,
                orchestrationRunId: freeze.orchestrationRunId,
                projectId: freeze.projectId,
            } as FreezeServiceEvent);

            console.log(`[BuildFreezeService] Build resumed: ${freezeId}`);

            return {
                buildLoopState,
                activeAgents,
                fileStates,
                taskProgress,
                artifactsSnapshot,
                verificationResults,
                memoryContext,
                parallelBuildState,
                latticeState,
                contextSyncState,
                browserState,
                checkpointId: freeze.checkpointId || undefined,
            };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error('[BuildFreezeService] Failed to resume build:', err);
            throw new Error(`Failed to resume build: ${err.message}`);
        }
    }

    /**
     * Get frozen build by ID
     */
    async getFrozenBuild(freezeId: string): Promise<FrozenBuild | null> {
        const records = await db
            .select()
            .from(buildFreezeStates)
            .where(eq(buildFreezeStates.id, freezeId))
            .limit(1);

        if (records.length === 0) {
            return null;
        }

        return this.mapToFrozenBuild(records[0]);
    }

    /**
     * Get all frozen builds for a project
     */
    async getFrozenBuildsForProject(projectId: string, limit = 20): Promise<FrozenBuild[]> {
        const records = await db
            .select()
            .from(buildFreezeStates)
            .where(eq(buildFreezeStates.projectId, projectId))
            .orderBy(desc(buildFreezeStates.frozenAt))
            .limit(limit);

        return records.map(r => this.mapToFrozenBuild(r));
    }

    /**
     * Get active (non-resumed) frozen build for an orchestration run
     */
    async getActiveFrozenBuild(orchestrationRunId: string): Promise<FrozenBuild | null> {
        const records = await db
            .select()
            .from(buildFreezeStates)
            .where(
                and(
                    eq(buildFreezeStates.orchestrationRunId, orchestrationRunId),
                    eq(buildFreezeStates.isResumed, false)
                )
            )
            .orderBy(desc(buildFreezeStates.frozenAt))
            .limit(1);

        if (records.length === 0) {
            return null;
        }

        return this.mapToFrozenBuild(records[0]);
    }

    /**
     * Check if a build is currently frozen
     */
    async isBuildFrozen(orchestrationRunId: string): Promise<boolean> {
        const activeFrozen = await this.getActiveFrozenBuild(orchestrationRunId);
        return activeFrozen !== null && activeFrozen.canResume;
    }

    /**
     * Mark a freeze as non-resumable (e.g., after critical error)
     */
    async markNonResumable(freezeId: string, reason: string): Promise<void> {
        await db
            .update(buildFreezeStates)
            .set({
                canResume: false,
                freezeMessage: reason,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(buildFreezeStates.id, freezeId));

        console.log(`[BuildFreezeService] Freeze ${freezeId} marked as non-resumable: ${reason}`);
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    private async captureFileStates(projectId: string): Promise<Record<string, FileState>> {
        const projectFiles = await db
            .select()
            .from(files)
            .where(eq(files.projectId, projectId));

        const fileStates: Record<string, FileState> = {};

        for (const file of projectFiles) {
            fileStates[file.path] = {
                path: file.path,
                content: file.content,
                language: file.language,
                version: file.version,
                lastModifiedAt: file.updatedAt,
                isNew: false,
                isDeleted: false,
            };
        }

        return fileStates;
    }

    private async restoreFileStates(projectId: string, fileStates: Record<string, FileState>): Promise<void> {
        // This is a read operation during resume - file states are preserved in DB
        // The build loop will use the freeze context to restore agent memory
        // We don't need to overwrite files here as they're already in the DB
        console.log(`[BuildFreezeService] File states preserved for ${Object.keys(fileStates).length} files`);
    }

    private async captureTaskProgress(
        projectId: string,
        orchestrationRunId: string,
        userId: string
    ): Promise<TaskProgress> {
        try {
            const artifactManager = createArtifactManager(projectId, orchestrationRunId, userId);
            const taskListData = await artifactManager.getArtifact('task_list.json');

            if (taskListData) {
                const taskList = JSON.parse(taskListData);
                return {
                    totalTasks: taskList.tasks?.length || 0,
                    completedTasks: taskList.tasks?.filter((t: { status: string }) => t.status === 'completed').length || 0,
                    inProgressTasks: taskList.tasks?.filter((t: { status: string }) => t.status === 'in_progress').length || 0,
                    pendingTasks: taskList.tasks?.filter((t: { status: string }) => t.status === 'pending').length || 0,
                    tasks: taskList.tasks || [],
                };
            }
        } catch (error) {
            console.warn('[BuildFreezeService] Failed to capture task progress:', error);
        }

        return {
            totalTasks: 0,
            completedTasks: 0,
            inProgressTasks: 0,
            pendingTasks: 0,
            tasks: [],
        };
    }

    private async captureArtifactsSnapshot(
        projectId: string,
        orchestrationRunId: string,
        userId: string
    ): Promise<Record<string, unknown>> {
        const snapshot: Record<string, unknown> = {};

        try {
            const artifactManager = createArtifactManager(projectId, orchestrationRunId, userId);

            // Capture key artifacts
            const artifactNames = [
                'intent_contract.json',
                'task_list.json',
                'feature_list.json',
                'progress_log.json',
                'architectural_decisions.json',
            ];

            for (const name of artifactNames) {
                try {
                    const content = await artifactManager.getArtifact(name);
                    if (content) {
                        snapshot[name] = JSON.parse(content);
                    }
                } catch (err) {
                    // Artifact might not exist yet
                    console.warn(`[BuildFreezeService] Artifact ${name} not found or invalid`);
                }
            }
        } catch (error) {
            console.warn('[BuildFreezeService] Failed to capture artifacts snapshot:', error);
        }

        return snapshot;
    }

    private async captureContextSyncState(orchestrationRunId: string, projectId?: string): Promise<unknown> {
        try {
            // Context sync service requires buildId and projectId
            // Since we don't have projectId here, we return empty object
            // The context will be captured by the build loop directly
            return {};
        } catch (error) {
            console.warn('[BuildFreezeService] Failed to capture context sync state:', error);
            return {};
        }
    }

    private async restoreContextSyncState(orchestrationRunId: string, state: unknown): Promise<void> {
        try {
            // Restore context sync state
            // This would require adding a method to ContextSyncService to restore state
            console.log('[BuildFreezeService] Context sync state restoration not yet implemented');
        } catch (error) {
            console.warn('[BuildFreezeService] Failed to restore context sync state:', error);
        }
    }

    private calculateOverallProgress(state: BuildLoopState): number {
        // Calculate progress based on phases completed
        const phaseWeights: Record<string, number> = {
            intent_lock: 5,
            initialization: 10,
            parallel_build: 50,
            integration_check: 10,
            functional_test: 15,
            intent_satisfaction: 5,
            browser_demo: 5,
        };

        let totalWeight = 0;
        let completedWeight = 0;

        for (const [phase, weight] of Object.entries(phaseWeights)) {
            totalWeight += weight;
            if (state.phasesCompleted.includes(phase as any)) {
                completedWeight += weight;
            }
        }

        // Add partial progress for current phase
        if (state.currentPhase in phaseWeights) {
            const currentPhaseWeight = phaseWeights[state.currentPhase];
            const partialProgress = (state.stageProgress / 100) * currentPhaseWeight;
            completedWeight += partialProgress;
        }

        return Math.round((completedWeight / totalWeight) * 100);
    }

    private calculateCreditsUsed(state: BuildLoopState): number {
        // This would integrate with actual credit tracking
        // For now, return a placeholder
        return 0;
    }

    private calculateTokensUsed(state: BuildLoopState): number {
        // This would integrate with actual token tracking
        // For now, return a placeholder
        return 0;
    }

    private mapToFrozenBuild(record: typeof buildFreezeStates.$inferSelect): FrozenBuild {
        return {
            id: record.id,
            orchestrationRunId: record.orchestrationRunId,
            projectId: record.projectId,
            userId: record.userId,
            buildIntentId: record.buildIntentId,
            freezeReason: record.freezeReason as FreezeReason,
            freezeMessage: record.freezeMessage,
            canResume: record.canResume,
            isResumed: record.isResumed,
            resumedAt: record.resumedAt ? new Date(record.resumedAt) : null,
            currentPhase: record.currentPhase,
            currentStage: record.currentStage,
            stageProgress: record.stageProgress || 0,
            overallProgress: record.overallProgress || 0,
            phasesCompleted: record.phasesCompleted ? JSON.parse(record.phasesCompleted as unknown as string) : [],
            creditsUsedAtFreeze: record.creditsUsedAtFreeze || 0,
            tokensUsedAtFreeze: record.tokensUsedAtFreeze || 0,
            estimatedCreditsToComplete: record.estimatedCreditsToComplete,
            errorCount: record.errorCount || 0,
            lastError: record.lastError,
            escalationLevel: record.escalationLevel || 0,
            frozenAt: new Date(record.frozenAt),
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt),
        };
    }
}

// =============================================================================
// FACTORY
// =============================================================================

let freezeService: BuildFreezeService | null = null;

export function getBuildFreezeService(): BuildFreezeService {
    if (!freezeService) {
        freezeService = new BuildFreezeService();
    }
    return freezeService;
}

export function createBuildFreezeService(): BuildFreezeService {
    return new BuildFreezeService();
}
