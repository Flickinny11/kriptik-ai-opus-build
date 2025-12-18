/**
 * Unified Build Orchestration Service
 *
 * This is the CENTRAL hub that connects ALL build paths through:
 * 1. Intent Lock (Sacred Contract) - enforced on every build
 * 2. 6-Phase Build Loop - full phase cycle
 * 3. Enhanced Build Loop - Cursor 2.1+ services
 * 4. Shared Context Pool - cross-request memory
 * 5. Done Contract Enforcement - never claims done when not done
 *
 * ALL entry points (ChatInterface, Feature Agent, KTN) MUST go through this service.
 *
 * CRITICAL: This replaces the disconnected DevelopmentOrchestrator usage
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { orchestrationRuns, buildIntents } from '../../schema.js';
import { eq } from 'drizzle-orm';

// Build Loop
import {
    BuildLoopOrchestrator,
    createBuildLoopOrchestrator,
    type BuildMode,
    type BuildLoopState,
    type BuildLoopPhase,
} from '../automation/build-loop.js';

// Enhanced Build Loop (Cursor 2.1+ services)
import {
    EnhancedBuildLoopOrchestrator,
    createEnhancedBuildLoop,
    type EnhancedBuildConfig,
    type EnhancedBuildState,
} from '../automation/enhanced-build-loop.js';

// Intent Lock
import {
    createIntentLockEngine,
    type IntentContract,
    type IntentLockEngine,
} from '../ai/intent-lock.js';

// Verification Swarm
import {
    createVerificationSwarm,
    type VerificationSwarm,
    type CombinedVerificationResult,
} from '../verification/swarm.js';

// Shared Context Pool
import {
    SharedContextPool,
    getSharedContextPool,
    type ProjectContext,
    type BuildMemory,
} from './shared-context-pool.js';

// =============================================================================
// TYPES
// =============================================================================

export type BuildEntryPoint = 'chat_interface' | 'feature_agent' | 'ktn' | 'api';

export interface UnifiedBuildRequest {
    prompt: string;
    projectId: string;
    userId: string;
    projectName?: string;
    entryPoint: BuildEntryPoint;
    mode?: BuildMode;
    enableEnhanced?: boolean;
    constraints?: Record<string, unknown>;
}

export interface UnifiedBuildResult {
    success: boolean;
    buildId: string;
    projectId: string;
    intentContractId: string;
    phase: BuildLoopPhase;
    status: 'running' | 'complete' | 'failed' | 'awaiting_approval';
    message: string;
    artifacts?: {
        files: Map<string, string>;
        previewUrl?: string;
        screenshots?: string[];
    };
    verification?: CombinedVerificationResult;
    doneContract: {
        satisfied: boolean;
        criteriaPassRate: number;
        workflowsVerified: number;
        blockers: string[];
    };
}

export interface BuildSession {
    id: string;
    projectId: string;
    userId: string;
    orchestrationRunId: string;
    intentContractId: string | null;
    entryPoint: BuildEntryPoint;
    mode: BuildMode;
    buildLoop: BuildLoopOrchestrator | null;
    enhancedLoop: EnhancedBuildLoopOrchestrator | null;
    status: 'initializing' | 'intent_lock' | 'building' | 'verifying' | 'complete' | 'failed';
    createdAt: Date;
    updatedAt: Date;
}

export interface UnifiedBuildEvent {
    type: 'intent_created' | 'intent_locked' | 'phase_start' | 'phase_complete' |
        'feature_building' | 'feature_complete' | 'verification_start' | 'verification_result' |
        'feedback' | 'error' | 'fix_applied' | 'done_check' | 'build_complete' |
        'agent_registered' | 'agent_feedback' | 'checkpoint_created';
    buildId: string;
    timestamp: Date;
    data: Record<string, unknown>;
}

// =============================================================================
// UNIFIED BUILD ORCHESTRATION SERVICE
// =============================================================================

export class UnifiedBuildService extends EventEmitter {
    private sessions: Map<string, BuildSession> = new Map();
    private contextPool: SharedContextPool;
    private intentEngines: Map<string, IntentLockEngine> = new Map();
    private verificationSwarms: Map<string, VerificationSwarm> = new Map();

    constructor() {
        super();
        this.contextPool = getSharedContextPool();
        console.log('[UnifiedBuildService] Initialized - ALL builds now flow through unified pipeline');
    }

    // =========================================================================
    // MAIN ENTRY POINT - ALL BUILDS START HERE
    // =========================================================================

    /**
     * Start a unified build - the ONLY way to start a build
     *
     * This enforces:
     * 1. Intent Lock creation and locking (Phase 0)
     * 2. Full 6-phase build loop
     * 3. Enhanced services (Cursor 2.1+ features)
     * 4. Shared context persistence
     * 5. Done contract verification
     */
    async startBuild(request: UnifiedBuildRequest): Promise<{
        buildId: string;
        session: BuildSession;
        stream: AsyncGenerator<UnifiedBuildEvent>;
    }> {
        const buildId = uuidv4();
        const orchestrationRunId = uuidv4();

        console.log(`[UnifiedBuildService] Starting build ${buildId} via ${request.entryPoint}`);

        // Create orchestration run record
        await db.insert(orchestrationRuns).values({
            id: orchestrationRunId,
            projectId: request.projectId,
            userId: request.userId,
            prompt: request.prompt,
            plan: { prompt: request.prompt, mode: request.mode || 'standard', entryPoint: request.entryPoint },
            status: 'running',
            artifacts: {},
            startedAt: new Date().toISOString(),
        });

        // Create build session
        const session: BuildSession = {
            id: buildId,
            projectId: request.projectId,
            userId: request.userId,
            orchestrationRunId,
            intentContractId: null,
            entryPoint: request.entryPoint,
            mode: request.mode || 'standard',
            buildLoop: null,
            enhancedLoop: null,
            status: 'initializing',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.sessions.set(buildId, session);

        // Load or create shared context for this project
        await this.contextPool.loadOrCreateContext(request.projectId, request.userId);

        // Create the async generator for streaming events
        const stream = this.createBuildStream(buildId, request);

        return { buildId, session, stream };
    }

    /**
     * Create async generator that streams build events
     */
    private async *createBuildStream(
        buildId: string,
        request: UnifiedBuildRequest
    ): AsyncGenerator<UnifiedBuildEvent> {
        const session = this.sessions.get(buildId);
        if (!session) {
            throw new Error(`Build session not found: ${buildId}`);
        }

        try {
            // =====================================================================
            // PHASE 0: INTENT LOCK (MANDATORY - NEVER SKIP)
            // =====================================================================
            session.status = 'intent_lock';
            yield this.createEvent(buildId, 'phase_start', { phase: 'intent_lock' });

            const intentContract = await this.createAndLockIntent(
                request.prompt,
                request.userId,
                request.projectId,
                session.orchestrationRunId
            );

            session.intentContractId = intentContract.id;
            this.updateSession(session);

            yield this.createEvent(buildId, 'intent_created', {
                contractId: intentContract.id,
                appType: intentContract.appType,
                appSoul: intentContract.appSoul,
                successCriteria: intentContract.successCriteria.length,
                workflows: intentContract.userWorkflows.length,
            });

            yield this.createEvent(buildId, 'intent_locked', {
                contractId: intentContract.id,
                locked: true,
                message: 'Sacred Contract locked - success criteria are now immutable',
            });

            // Store in shared context
            await this.contextPool.updateContext(request.projectId, {
                intentContract,
                lastBuildId: buildId,
            });

            // =====================================================================
            // CREATE BUILD LOOP ORCHESTRATOR
            // =====================================================================
            const projectPath = `/tmp/builds/${request.projectId}`;

            session.buildLoop = createBuildLoopOrchestrator(
                request.projectId,
                request.userId,
                session.orchestrationRunId,
                session.mode
            );

            // =====================================================================
            // CREATE ENHANCED BUILD LOOP (Cursor 2.1+ services)
            // =====================================================================
            if (request.enableEnhanced !== false) {
                session.enhancedLoop = createEnhancedBuildLoop({
                    buildId,
                    projectId: request.projectId,
                    userId: request.userId,
                    projectPath,
                    previewUrl: `http://localhost:3100`, // Will be updated when sandbox starts
                    enableStreamingFeedback: true,
                    enableContinuousVerification: true,
                    enableRuntimeDebug: true,
                    enableBrowserInLoop: true,
                    enableHumanCheckpoints: true,
                    enableMultiAgentJudging: true,
                    enablePatternLibrary: true,
                    visualQualityThreshold: 85,
                    humanCheckpointEscalationLevel: 2,
                });

                // Start enhanced services
                await session.enhancedLoop.start();

                // Forward enhanced loop events
                session.enhancedLoop.on('agent:feedback', (data) => {
                    this.emit('build_event', this.createEvent(buildId, 'agent_feedback', data));
                });

                session.enhancedLoop.on('agent:self-corrected', (data) => {
                    this.emit('build_event', this.createEvent(buildId, 'feedback', {
                        type: 'self_correction',
                        ...data,
                    }));
                });

                session.enhancedLoop.on('error:pattern-fixed', (data) => {
                    this.emit('build_event', this.createEvent(buildId, 'fix_applied', {
                        level: 0,
                        source: 'pattern_library',
                        ...data,
                    }));
                });

                yield this.createEvent(buildId, 'phase_start', {
                    phase: 'enhanced_services',
                    capabilities: session.enhancedLoop.getCapabilitiesSummary(),
                });
            }

            this.updateSession(session);

            // =====================================================================
            // FORWARD BUILD LOOP EVENTS
            // =====================================================================
            const buildLoopEvents: UnifiedBuildEvent[] = [];
            const eventTypes = [
                'phase_start', 'phase_complete', 'feature_complete',
                'verification_result', 'error', 'fix_applied',
                'checkpoint_created', 'build_complete', 'intent_created',
                'tasks_decomposed', 'scaffolding_complete', 'artifacts_created',
            ];

            for (const eventType of eventTypes) {
                session.buildLoop.on(eventType, (event) => {
                    const unifiedEvent = this.createEvent(buildId, eventType as UnifiedBuildEvent['type'], event.data || event);
                    buildLoopEvents.push(unifiedEvent);
                    this.emit('build_event', unifiedEvent);
                });
            }

            // =====================================================================
            // START BUILD LOOP (Phases 1-6)
            // =====================================================================
            session.status = 'building';
            this.updateSession(session);

            // Start the build loop (this runs the full 6-phase cycle)
            const buildPromise = session.buildLoop.start(request.prompt);

            // Yield events as they come in
            while (session.status === 'building') {
                if (buildLoopEvents.length > 0) {
                    const event = buildLoopEvents.shift()!;
                    yield event;

                    // Check if build completed
                    if (event.type === 'build_complete' || event.data?.phase === 'complete') {
                        break;
                    }
                }

                // Small delay to prevent tight loop
                await new Promise(resolve => setTimeout(resolve, 100));

                // Check if build loop finished
                const state = session.buildLoop.getState();
                if (state.status === 'complete' || state.status === 'failed') {
                    break;
                }
            }

            // Wait for build to complete
            await buildPromise;

            // =====================================================================
            // DONE CONTRACT VERIFICATION (CRITICAL - PREVENTS FALSE "DONE")
            // =====================================================================
            const buildState = session.buildLoop.getState();
            const doneContract = await this.verifyDoneContract(
                buildId,
                intentContract,
                buildState
            );

            yield this.createEvent(buildId, 'done_check', {
                satisfied: doneContract.satisfied,
                criteriaPassRate: doneContract.criteriaPassRate,
                workflowsVerified: doneContract.workflowsVerified,
                blockers: doneContract.blockers,
            });

            // =====================================================================
            // FINAL STATUS
            // =====================================================================
            if (doneContract.satisfied && buildState.status === 'complete') {
                session.status = 'complete';
                yield this.createEvent(buildId, 'build_complete', {
                    success: true,
                    message: 'Build complete - all success criteria satisfied',
                    doneContract,
                    duration: Date.now() - session.createdAt.getTime(),
                });
            } else {
                session.status = 'failed';
                yield this.createEvent(buildId, 'build_complete', {
                    success: false,
                    message: `Build incomplete - ${doneContract.blockers.join(', ')}`,
                    doneContract,
                    duration: Date.now() - session.createdAt.getTime(),
                });
            }

            this.updateSession(session);

            // Store final state in shared context
            await this.contextPool.updateContext(request.projectId, {
                lastBuildStatus: session.status,
                lastBuildCompletedAt: new Date(),
                buildHistory: [{
                    buildId,
                    status: session.status,
                    doneContract,
                    completedAt: new Date(),
                }],
            });

        } catch (error) {
            session.status = 'failed';
            this.updateSession(session);

            yield this.createEvent(buildId, 'error', {
                message: (error as Error).message,
                stack: (error as Error).stack,
            });

            throw error;
        } finally {
            // Cleanup enhanced loop if running
            if (session.enhancedLoop) {
                await session.enhancedLoop.stop();
            }
        }
    }

    // =========================================================================
    // INTENT LOCK MANAGEMENT
    // =========================================================================

    /**
     * Create and lock an Intent Contract (Sacred Contract)
     * This is MANDATORY for every build - no exceptions
     */
    private async createAndLockIntent(
        prompt: string,
        userId: string,
        projectId: string,
        orchestrationRunId: string
    ): Promise<IntentContract> {
        // Get or create Intent Lock engine for this user/project
        const engineKey = `${userId}-${projectId}`;
        let intentEngine = this.intentEngines.get(engineKey);

        if (!intentEngine) {
            intentEngine = createIntentLockEngine(userId, projectId);
            this.intentEngines.set(engineKey, intentEngine);
        }

        // Check for existing unlocked contract
        const existingContract = await this.getExistingUnlockedContract(projectId);
        if (existingContract) {
            console.log(`[UnifiedBuildService] Found existing unlocked contract: ${existingContract.id}`);
            // Lock the existing contract
            return await intentEngine.lockContract(existingContract.id);
        }

        // Create new contract with maximum effort (Opus 4.5, HIGH effort, 64K thinking)
        console.log('[UnifiedBuildService] Creating new Intent Contract with Opus 4.5...');

        const contract = await intentEngine.createContract(
            prompt,
            userId,
            projectId,
            orchestrationRunId,
            {
                model: 'claude-opus-4-5-20251101',
                effort: 'high',
                thinkingBudget: 64000,
            }
        );

        // Lock it immediately - no modifications allowed after this
        const lockedContract = await intentEngine.lockContract(contract.id);

        console.log(`[UnifiedBuildService] Intent Contract locked: ${lockedContract.id}`);

        return lockedContract;
    }

    private async getExistingUnlockedContract(projectId: string): Promise<IntentContract | null> {
        const contracts = await db.select()
            .from(buildIntents)
            .where(eq(buildIntents.projectId, projectId))
            .orderBy(buildIntents.createdAt)
            .limit(1);

        if (contracts.length === 0) return null;

        const contract = contracts[0];
        if (contract.locked) return null;

        // Convert database record to IntentContract type
        const visualId = contract.visualIdentity as Record<string, string> || {};
        const criteriaArr = contract.successCriteria as string[] || [];
        const workflowsObj = contract.userWorkflows as Record<string, string> || {};

        return {
            id: contract.id,
            originalPrompt: contract.originalPrompt,
            userId: contract.userId,
            projectId: contract.projectId,
            orchestrationRunId: contract.orchestrationRunId || undefined,
            appType: contract.appType,
            appSoul: contract.appSoul as IntentContract['appSoul'],
            coreValueProp: contract.coreValueProp,
            successCriteria: criteriaArr.map((c, i) => ({
                id: `sc_${i}`,
                description: typeof c === 'string' ? c : String(c),
                verificationMethod: 'functional' as const,
                passed: false,
            })),
            userWorkflows: Object.entries(workflowsObj).map(([name, description]) => ({
                name,
                steps: [description],
                success: 'User completes workflow successfully',
                verified: false,
            })),
            visualIdentity: {
                soul: (visualId.soul || 'utility') as IntentContract['visualIdentity']['soul'],
                primaryEmotion: visualId.primaryEmotion || visualId.emotion || '',
                depthLevel: (visualId.depthLevel || visualId.depth || 'medium') as 'low' | 'medium' | 'high',
                motionPhilosophy: visualId.motionPhilosophy || visualId.motion || '',
            },
            antiPatterns: (contract.antiPatterns as string[]) || [],
            locked: false,
            generatedBy: contract.generatedBy || 'claude-opus-4.5',
            thinkingTokensUsed: contract.thinkingTokensUsed || 0,
            createdAt: contract.createdAt || new Date().toISOString(),
            lockedAt: undefined,
        };
    }

    // =========================================================================
    // DONE CONTRACT VERIFICATION
    // =========================================================================

    /**
     * Verify the "Done" contract - ensures we NEVER claim done when not done
     *
     * This is the CRITICAL gate that prevents premature victory declaration.
     * ALL success criteria must pass. ALL workflows must be verified.
     */
    private async verifyDoneContract(
        buildId: string,
        intentContract: IntentContract,
        buildState: BuildLoopState
    ): Promise<{
        satisfied: boolean;
        criteriaPassRate: number;
        workflowsVerified: number;
        blockers: string[];
    }> {
        const blockers: string[] = [];

        // Check success criteria
        const criteriaPassed = intentContract.successCriteria.filter(c => c.passed).length;
        const criteriaTotal = intentContract.successCriteria.length;
        const criteriaPassRate = criteriaTotal > 0 ? (criteriaPassed / criteriaTotal) * 100 : 0;

        if (criteriaPassed < criteriaTotal) {
            const failedCriteria = intentContract.successCriteria
                .filter(c => !c.passed)
                .map(c => c.description);
            blockers.push(`${criteriaTotal - criteriaPassed} success criteria not met: ${failedCriteria.slice(0, 3).join(', ')}${failedCriteria.length > 3 ? '...' : ''}`);
        }

        // Check workflows verified
        const workflowsVerified = intentContract.userWorkflows.filter(w => w.verified).length;
        const workflowsTotal = intentContract.userWorkflows.length;

        if (workflowsVerified < workflowsTotal) {
            const unverifiedWorkflows = intentContract.userWorkflows
                .filter(w => !w.verified)
                .map(w => w.name);
            blockers.push(`${workflowsTotal - workflowsVerified} workflows not verified: ${unverifiedWorkflows.slice(0, 3).join(', ')}${unverifiedWorkflows.length > 3 ? '...' : ''}`);
        }

        // Check feature pass rate
        if (buildState.featureSummary) {
            const featurePassRate = buildState.featureSummary.passRate;
            if (featurePassRate < 100) {
                blockers.push(`Feature pass rate: ${featurePassRate}% (${buildState.featureSummary.pending} features pending)`);
            }
        }

        // Check build status
        if (buildState.status !== 'complete') {
            blockers.push(`Build status: ${buildState.status}`);
        }

        // Check for errors
        if (buildState.errorCount > 0 && buildState.lastError) {
            blockers.push(`Unresolved error: ${buildState.lastError}`);
        }

        const satisfied = blockers.length === 0;

        console.log(`[UnifiedBuildService] Done contract ${satisfied ? 'SATISFIED' : 'NOT SATISFIED'}: ${blockers.length} blockers`);

        return {
            satisfied,
            criteriaPassRate,
            workflowsVerified,
            blockers,
        };
    }

    // =========================================================================
    // SESSION MANAGEMENT
    // =========================================================================

    getSession(buildId: string): BuildSession | undefined {
        return this.sessions.get(buildId);
    }

    getAllSessions(): BuildSession[] {
        return Array.from(this.sessions.values());
    }

    getSessionsForProject(projectId: string): BuildSession[] {
        return Array.from(this.sessions.values()).filter(s => s.projectId === projectId);
    }

    private updateSession(session: BuildSession): void {
        session.updatedAt = new Date();
        this.sessions.set(session.id, session);
    }

    // =========================================================================
    // CONTEXT MANAGEMENT
    // =========================================================================

    /**
     * Get shared context for a project
     */
    async getProjectContext(projectId: string): Promise<ProjectContext | null> {
        return this.contextPool.getContext(projectId);
    }

    /**
     * Get build memory (cross-request learning)
     */
    async getBuildMemory(projectId: string): Promise<BuildMemory | null> {
        const context = await this.contextPool.getContext(projectId);
        return context?.memory || null;
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private createEvent(
        buildId: string,
        type: UnifiedBuildEvent['type'],
        data: Record<string, unknown>
    ): UnifiedBuildEvent {
        return {
            type,
            buildId,
            timestamp: new Date(),
            data,
        };
    }

    // =========================================================================
    // VERIFICATION SWARM ACCESS
    // =========================================================================

    /**
     * Get or create verification swarm for a build
     */
    getVerificationSwarm(buildId: string): VerificationSwarm | null {
        const session = this.sessions.get(buildId);
        if (!session) return null;

        let swarm = this.verificationSwarms.get(buildId);
        if (!swarm) {
            swarm = createVerificationSwarm(
                session.orchestrationRunId,
                session.projectId,
                session.userId,
                { enableVisualVerification: true }
            );
            this.verificationSwarms.set(buildId, swarm);
        }

        return swarm;
    }

    // =========================================================================
    // ENHANCED LOOP ACCESS
    // =========================================================================

    /**
     * Get enhanced loop for a build (if enabled)
     */
    getEnhancedLoop(buildId: string): EnhancedBuildLoopOrchestrator | null {
        const session = this.sessions.get(buildId);
        return session?.enhancedLoop || null;
    }

    /**
     * Register an agent with the enhanced loop for feedback streaming
     */
    registerAgentWithEnhancedLoop(
        buildId: string,
        agentId: string,
        agentName: string,
        task: string
    ): void {
        const enhancedLoop = this.getEnhancedLoop(buildId);
        if (enhancedLoop) {
            enhancedLoop.registerAgent(agentId, agentName, task);
        }
    }

    // =========================================================================
    // BUILD CONTROL
    // =========================================================================

    /**
     * Pause a running build
     */
    async pauseBuild(buildId: string): Promise<void> {
        const session = this.sessions.get(buildId);
        if (!session?.buildLoop) {
            throw new Error(`Build not found: ${buildId}`);
        }

        await session.buildLoop.abort();
        session.status = 'failed'; // Aborted builds are marked as failed
        this.updateSession(session);
    }

    /**
     * Rollback to a checkpoint
     */
    async rollbackBuild(buildId: string, checkpointId: string): Promise<void> {
        const session = this.sessions.get(buildId);
        if (!session?.buildLoop) {
            throw new Error(`Build not found: ${buildId}`);
        }

        await session.buildLoop.rollbackToCheckpoint(checkpointId);
    }

    /**
     * Get checkpoints for a build
     */
    async getBuildCheckpoints(buildId: string): Promise<Array<{
        id: string;
        phase: string;
        timestamp: Date;
        description?: string;
    }>> {
        const session = this.sessions.get(buildId);
        if (!session?.buildLoop) {
            return [];
        }

        return session.buildLoop.getCheckpoints();
    }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let unifiedBuildServiceInstance: UnifiedBuildService | null = null;

export function getUnifiedBuildService(): UnifiedBuildService {
    if (!unifiedBuildServiceInstance) {
        unifiedBuildServiceInstance = new UnifiedBuildService();
    }
    return unifiedBuildServiceInstance;
}

export function createUnifiedBuildService(): UnifiedBuildService {
    return new UnifiedBuildService();
}
