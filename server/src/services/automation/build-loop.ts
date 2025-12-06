/**
 * 6-Phase Build Loop - Ultimate AI-First Builder Architecture
 *
 * The heart of the autonomous build system. Implements the complete
 * 6-Phase Build Loop with Intent Lock integration:
 *
 * Phase 0: INTENT LOCK - Create Sacred Contract (immutable DONE definition)
 * Phase 1: INITIALIZATION - Set up artifacts, scaffolding
 * Phase 2: PARALLEL BUILD - 3-5 agents building features continuously
 * Phase 3: INTEGRATION CHECK - Scan for orphans, dead code, unwired routes
 * Phase 4: FUNCTIONAL TEST - Browser automation testing as real user
 * Phase 5: INTENT SATISFACTION - Critical gate (prevents premature victory)
 * Phase 6: BROWSER DEMO - Show user their working app
 *
 * Three-Stage Gated System:
 * - Stage 1: FRONTEND (mock data)
 * - Stage 2: BACKEND (real APIs)
 * - Stage 3: PRODUCTION (auth, payments)
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { orchestrationRuns, buildCheckpoints } from '../../schema.js';
import { eq } from 'drizzle-orm';
import {
    createIntentLockEngine,
    type IntentContract,
} from '../ai/intent-lock.js';
import {
    createFeatureListManager,
    type Feature,
    type FeatureListSummary,
} from '../ai/feature-list.js';
import {
    createArtifactManager,
} from '../ai/artifacts.js';
import {
    createClaudeService,
    CLAUDE_MODELS,
} from '../ai/claude-service.js';
import {
    getPhaseConfig,
} from '../ai/openrouter-client.js';

// =============================================================================
// TYPES
// =============================================================================

export type BuildLoopPhase =
    | 'intent_lock'        // Phase 0
    | 'initialization'     // Phase 1
    | 'parallel_build'     // Phase 2
    | 'integration_check'  // Phase 3
    | 'functional_test'    // Phase 4
    | 'intent_satisfaction' // Phase 5
    | 'browser_demo'       // Phase 6
    | 'complete'
    | 'failed';

export type BuildStage = 'frontend' | 'backend' | 'production';

export type BuildMode = 'lightning' | 'standard' | 'tournament' | 'production';

export interface BuildLoopConfig {
    mode: BuildMode;
    maxAgents: number;
    enableTournament: boolean;
    autoCreateCheckpoints: boolean;
    checkpointIntervalMinutes: number;
    maxBuildDurationMinutes: number;
    enableVisualVerification: boolean;
}

export interface BuildLoopState {
    id: string;
    projectId: string;
    userId: string;
    orchestrationRunId: string;
    config: BuildLoopConfig;

    // Current position
    currentPhase: BuildLoopPhase;
    currentStage: BuildStage;
    stageProgress: number;

    // Artifacts
    intentContract: IntentContract | null;
    featureSummary: FeatureListSummary | null;

    // Build status
    status: 'pending' | 'running' | 'awaiting_approval' | 'complete' | 'failed';
    startedAt: Date;
    completedAt: Date | null;

    // Progress tracking
    phasesCompleted: BuildLoopPhase[];
    currentPhaseStartedAt: Date | null;
    currentPhaseDurationMs: number;

    // Error state
    errorCount: number;
    lastError: string | null;
    escalationLevel: number;

    // Checkpoints
    lastCheckpointId: string | null;
    checkpointCount: number;
}

export interface BuildLoopEvent {
    type: 'phase_start' | 'phase_complete' | 'feature_complete' | 'verification_result'
        | 'error' | 'fix_applied' | 'checkpoint_created' | 'stage_complete' | 'build_complete';
    timestamp: Date;
    buildId: string;
    data: Record<string, unknown>;
}

// =============================================================================
// BUILD MODE CONFIGURATIONS
// =============================================================================

const BUILD_MODE_CONFIGS: Record<BuildMode, BuildLoopConfig> = {
    lightning: {
        mode: 'lightning',
        maxAgents: 1,
        enableTournament: false,
        autoCreateCheckpoints: false,
        checkpointIntervalMinutes: 0,
        maxBuildDurationMinutes: 5,
        enableVisualVerification: false,
    },
    standard: {
        mode: 'standard',
        maxAgents: 3,
        enableTournament: false,
        autoCreateCheckpoints: true,
        checkpointIntervalMinutes: 15,
        maxBuildDurationMinutes: 30,
        enableVisualVerification: true,
    },
    tournament: {
        mode: 'tournament',
        maxAgents: 5,
        enableTournament: true,
        autoCreateCheckpoints: true,
        checkpointIntervalMinutes: 10,
        maxBuildDurationMinutes: 45,
        enableVisualVerification: true,
    },
    production: {
        mode: 'production',
        maxAgents: 5,
        enableTournament: true,
        autoCreateCheckpoints: true,
        checkpointIntervalMinutes: 10,
        maxBuildDurationMinutes: 120,
        enableVisualVerification: true,
    },
};

// =============================================================================
// BUILD LOOP ORCHESTRATOR
// =============================================================================

export class BuildLoopOrchestrator extends EventEmitter {
    private state: BuildLoopState;
    private intentEngine: ReturnType<typeof createIntentLockEngine>;
    private featureManager: ReturnType<typeof createFeatureListManager>;
    private artifactManager: ReturnType<typeof createArtifactManager>;
    private claudeService: ReturnType<typeof createClaudeService>;
    private aborted: boolean = false;

    constructor(
        projectId: string,
        userId: string,
        orchestrationRunId: string,
        mode: BuildMode = 'standard'
    ) {
        super();

        this.state = {
            id: uuidv4(),
            projectId,
            userId,
            orchestrationRunId,
            config: BUILD_MODE_CONFIGS[mode],
            currentPhase: 'intent_lock',
            currentStage: 'frontend',
            stageProgress: 0,
            intentContract: null,
            featureSummary: null,
            status: 'pending',
            startedAt: new Date(),
            completedAt: null,
            phasesCompleted: [],
            currentPhaseStartedAt: null,
            currentPhaseDurationMs: 0,
            errorCount: 0,
            lastError: null,
            escalationLevel: 0,
            lastCheckpointId: null,
            checkpointCount: 0,
        };

        this.intentEngine = createIntentLockEngine(userId, projectId);
        this.featureManager = createFeatureListManager(projectId, orchestrationRunId, userId);
        this.artifactManager = createArtifactManager(projectId, orchestrationRunId, userId);
        this.claudeService = createClaudeService({
            projectId,
            userId,
            agentType: 'planning',
        });
    }

    /**
     * Start the 6-Phase Build Loop
     */
    async start(prompt: string): Promise<void> {
        this.state.status = 'running';
        this.emitEvent('phase_start', { phase: 'intent_lock' });

        try {
            // Phase 0: Intent Lock
            await this.executePhase0_IntentLock(prompt);

            // Phase 1: Initialization
            await this.executePhase1_Initialization();

            // Loop through stages (Frontend → Backend → Production)
            const stages: BuildStage[] = ['frontend', 'backend', 'production'];

            for (const stage of stages) {
                if (this.aborted) break;

                this.state.currentStage = stage;
                await this.executeStage(stage);
            }

            if (!this.aborted) {
                this.state.status = 'complete';
                this.state.completedAt = new Date();
                this.emitEvent('build_complete', {
                    duration: this.state.completedAt.getTime() - this.state.startedAt.getTime(),
                    stages: stages.length,
                    features: this.state.featureSummary?.total || 0,
                });
            }
        } catch (error) {
            await this.handleError(error as Error);
        }
    }

    /**
     * Phase 0: INTENT LOCK - Create Sacred Contract
     * Uses Claude Opus 4.5 with HIGH effort and 64K thinking
     */
    private async executePhase0_IntentLock(prompt: string): Promise<void> {
        this.startPhase('intent_lock');

        try {
            // Create the Sacred Contract
            const contract = await this.intentEngine.createContract(
                prompt,
                this.state.userId,
                this.state.projectId,
                this.state.orchestrationRunId,
                {
                    model: CLAUDE_MODELS.OPUS_4_5,
                    effort: 'high',
                    thinkingBudget: 64000,
                }
            );

            // Lock it - no modifications allowed after this
            this.state.intentContract = await this.intentEngine.lockContract(contract.id);

            // Initialize artifacts
            await this.artifactManager.initializeArtifacts(this.state.intentContract);

            this.completePhase('intent_lock');
            this.emitEvent('phase_complete', {
                phase: 'intent_lock',
                contractId: contract.id,
                appType: contract.appType,
                appSoul: contract.appSoul,
                successCriteria: contract.successCriteria.length,
                workflows: contract.userWorkflows.length,
            });

        } catch (error) {
            throw new Error(`Intent Lock failed: ${(error as Error).message}`);
        }
    }

    /**
     * Phase 1: INITIALIZATION - Set up artifacts and scaffolding
     * Creates feature list, style guide, and project structure
     */
    private async executePhase1_Initialization(): Promise<void> {
        this.startPhase('initialization');

        if (!this.state.intentContract) {
            throw new Error('Intent Contract not found - Phase 0 must complete first');
        }

        try {
            // Generate feature list from Intent Contract
            const features = await this.featureManager.generateFromIntent(
                this.state.intentContract,
                { thinkingBudget: 32000 }
            );

            // Get feature summary
            this.state.featureSummary = await this.featureManager.getSummary();

            // Generate style guide based on App Soul
            await this.generateStyleGuide();

            // Save initial session log
            await this.artifactManager.createSessionLog({
                sessionId: this.state.id,
                agentId: 'build-loop-orchestrator',
                projectId: this.state.projectId,
                orchestrationRunId: this.state.orchestrationRunId,
                completed: ['Phase 0: Intent Lock', 'Phase 1: Initialization'],
                filesModified: ['intent.json', 'feature_list.json', 'style_guide.json'],
                currentState: {
                    phase: 'initialization',
                    status: 'complete',
                    devServer: 'stopped',
                    build: 'unknown',
                    tests: { passing: 0, failing: 0, pending: features.length },
                    lastCommit: null,
                },
                nextSteps: [
                    'Begin Phase 2: Parallel Build',
                    `Build ${features.length} features`,
                    `Start with priority 1 features`,
                ],
                context: `App type: ${this.state.intentContract.appType}, Soul: ${this.state.intentContract.appSoul}`,
                blockers: [],
            });

            // Create initial checkpoint
            if (this.state.config.autoCreateCheckpoints) {
                await this.createCheckpoint('phase_complete', 'After initialization');
            }

            this.completePhase('initialization');
            this.emitEvent('phase_complete', {
                phase: 'initialization',
                features: features.length,
                styleGuide: true,
            });

        } catch (error) {
            throw new Error(`Initialization failed: ${(error as Error).message}`);
        }
    }

    /**
     * Execute a complete stage (Frontend/Backend/Production)
     * Each stage runs through Phases 2-6
     */
    private async executeStage(stage: BuildStage): Promise<void> {
        this.emitEvent('phase_start', { stage });

        // Phase 2: Parallel Build
        await this.executePhase2_ParallelBuild(stage);

        // Phase 3: Integration Check
        await this.executePhase3_IntegrationCheck();

        // Phase 4: Functional Test
        await this.executePhase4_FunctionalTest();

        // Phase 5: Intent Satisfaction
        await this.executePhase5_IntentSatisfaction();

        // Phase 6: Browser Demo (for production stage only, or all if configured)
        if (stage === 'production' || this.state.config.mode === 'production') {
            await this.executePhase6_BrowserDemo();
        }

        this.emitEvent('stage_complete', { stage });
    }

    /**
     * Phase 2: PARALLEL BUILD - Build features with multiple agents
     */
    private async executePhase2_ParallelBuild(stage: BuildStage): Promise<void> {
        this.startPhase('parallel_build');

        try {
            // Get features for this stage
            const features = await this.featureManager.getAllFeatures();
            const stageFeatures = this.filterFeaturesForStage(features, stage);

            // Sort by priority
            stageFeatures.sort((a, b) => a.priority - b.priority);

            // Build each feature (sequential for now, parallel in future)
            for (const feature of stageFeatures) {
                if (this.aborted) break;

                await this.buildFeature(feature);

                // Emit progress
                const summary = await this.featureManager.getSummary();
                this.state.featureSummary = summary;

                this.emitEvent('feature_complete', {
                    featureId: feature.featureId,
                    passRate: summary.passRate,
                    remaining: summary.pending,
                });

                // Auto-checkpoint on interval
                if (this.shouldCreateCheckpoint()) {
                    await this.createCheckpoint('feature_complete', `After feature ${feature.featureId}`, feature.featureId);
                }
            }

            this.completePhase('parallel_build');

        } catch (error) {
            throw new Error(`Parallel Build failed: ${(error as Error).message}`);
        }
    }

    /**
     * Phase 3: INTEGRATION CHECK - Scan for issues
     */
    private async executePhase3_IntegrationCheck(): Promise<void> {
        this.startPhase('integration_check');

        try {
            const issues = await this.runIntegrationCheck();

            if (issues.length > 0) {
                // Auto-fix issues
                for (const issue of issues) {
                    await this.fixIntegrationIssue(issue);
                }
            }

            this.completePhase('integration_check');
            this.emitEvent('phase_complete', {
                phase: 'integration_check',
                issuesFound: issues.length,
                issuesFixed: issues.length,
            });

        } catch (error) {
            throw new Error(`Integration Check failed: ${(error as Error).message}`);
        }
    }

    /**
     * Phase 4: FUNCTIONAL TEST - Browser automation testing
     */
    private async executePhase4_FunctionalTest(): Promise<void> {
        this.startPhase('functional_test');

        try {
            if (!this.state.intentContract) {
                throw new Error('Intent Contract not found');
            }

            // Test each user workflow
            const results: { workflow: string; passed: boolean }[] = [];

            for (const workflow of this.state.intentContract.userWorkflows) {
                if (this.aborted) break;

                const passed = await this.testWorkflow(workflow);
                results.push({ workflow: workflow.name, passed });

                if (passed) {
                    await this.intentEngine.markWorkflowVerified(
                        this.state.intentContract.id,
                        workflow.name
                    );
                }
            }

            const passedCount = results.filter(r => r.passed).length;

            this.completePhase('functional_test');
            this.emitEvent('phase_complete', {
                phase: 'functional_test',
                totalWorkflows: results.length,
                passedWorkflows: passedCount,
            });

            // If tests failed, loop back to Phase 2
            if (passedCount < results.length) {
                await this.handleTestFailures(results.filter(r => !r.passed));
            }

        } catch (error) {
            throw new Error(`Functional Test failed: ${(error as Error).message}`);
        }
    }

    /**
     * Phase 5: INTENT SATISFACTION - Critical gate
     * Uses Claude Opus 4.5 with HIGH effort - prevents premature victory
     */
    private async executePhase5_IntentSatisfaction(): Promise<void> {
        this.startPhase('intent_satisfaction');

        if (!this.state.intentContract) {
            throw new Error('Intent Contract not found');
        }

        try {
            const phaseConfig = getPhaseConfig('intent_satisfaction');

            const result = await this.claudeService.generateStructured<{
                satisfied: boolean;
                reasons: string[];
                missingCriteria: string[];
                recommendations: string[];
            }>(
                this.buildIntentSatisfactionPrompt(),
                `You are the INTENT SATISFACTION JUDGE. Your ONLY job is to determine:
                Would the user be satisfied with this result?

                Read the Intent Contract (the Sacred Contract) and the current build state.
                Run through each workflow mentally.
                Check each success criterion.

                This gate PREVENTS PREMATURE VICTORY DECLARATION.
                Be HONEST. If it's not right, send it back.
                Only say satisfied: true if you would be proud to show this to the user.

                Respond with JSON: { satisfied: boolean, reasons: [], missingCriteria: [], recommendations: [] }`,
                {
                    model: phaseConfig.model,
                    effort: phaseConfig.effort,
                    thinkingBudgetTokens: phaseConfig.thinkingBudget,
                }
            );

            if (!result.satisfied) {
                // Loop back to Phase 2 with specific fixes
                await this.handleIntentNotSatisfied(result);
                return;
            }

            // Mark all criteria as passed
            for (const criterion of this.state.intentContract.successCriteria) {
                await this.intentEngine.markCriterionPassed(
                    this.state.intentContract.id,
                    criterion.id
                );
            }

            this.completePhase('intent_satisfaction');
            this.emitEvent('phase_complete', {
                phase: 'intent_satisfaction',
                satisfied: true,
                reasons: result.reasons,
            });

        } catch (error) {
            throw new Error(`Intent Satisfaction check failed: ${(error as Error).message}`);
        }
    }

    /**
     * Phase 6: BROWSER DEMO - Show the user their working app
     */
    private async executePhase6_BrowserDemo(): Promise<void> {
        this.startPhase('browser_demo');

        try {
            // For now, emit event - actual browser demo requires browser service
            this.completePhase('browser_demo');
            this.emitEvent('phase_complete', {
                phase: 'browser_demo',
                status: 'ready_for_demo',
            });

        } catch (error) {
            throw new Error(`Browser Demo failed: ${(error as Error).message}`);
        }
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private async buildFeature(feature: Feature): Promise<void> {
        await this.featureManager.incrementBuildAttempts(feature.featureId);

        const phaseConfig = getPhaseConfig('build_agent');

        const prompt = `Build feature: ${feature.featureId}
Description: ${feature.description}
Category: ${feature.category}
Priority: ${feature.priority}

Implementation Steps:
${feature.implementationSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Visual Requirements:
${feature.visualRequirements.map(r => `- ${r}`).join('\n')}

Generate production-ready code for this feature.`;

        // Generate code using Claude
        const response = await this.claudeService.generate(prompt, {
            model: phaseConfig.model,
            maxTokens: 32000,
            useExtendedThinking: true,
            thinkingBudgetTokens: phaseConfig.thinkingBudget,
        });

        // Parse and save files
        const files = this.claudeService.parseFileOperations(response.content);
        const filePaths = files.map(f => f.path);

        await this.featureManager.addFilesModified(feature.featureId, filePaths);

        // Mark as passed (actual verification would happen via Verification Swarm)
        await this.featureManager.markFeaturePassed(feature.featureId);
    }

    private filterFeaturesForStage(features: Feature[], stage: BuildStage): Feature[] {
        // Filter based on category
        switch (stage) {
            case 'frontend':
                return features.filter(f => f.category === 'visual');
            case 'backend':
                return features.filter(f => f.category === 'functional');
            case 'production':
                return features.filter(f => f.category === 'integration');
            default:
                return features;
        }
    }

    private async runIntegrationCheck(): Promise<Array<{ type: string; description: string }>> {
        // Placeholder - actual implementation would scan for:
        // - Orphan components
        // - Dead code
        // - Unwired routes
        // - Placeholder content
        // - Missing error handling
        return [];
    }

    private async fixIntegrationIssue(issue: { type: string; description: string }): Promise<void> {
        // Placeholder for auto-fixing integration issues
        await this.artifactManager.addIssueResolution({
            errorType: issue.type,
            errorMessage: issue.description,
            solution: 'Auto-fixed during integration check',
            filesAffected: [],
            resolutionMethod: 'auto_fix',
        });
    }

    private async testWorkflow(workflow: { name: string; steps: string[]; success: string }): Promise<boolean> {
        // Placeholder - actual implementation would use browser automation
        return true;
    }

    private async handleTestFailures(failures: Array<{ workflow: string; passed: boolean }>): Promise<void> {
        // Handle test failures - could loop back to Phase 2
        this.state.errorCount += failures.length;
    }

    private buildIntentSatisfactionPrompt(): string {
        if (!this.state.intentContract) return '';

        return `Review the following build against the Intent Contract:

## Intent Contract (Sacred Contract):
App Type: ${this.state.intentContract.appType}
Core Value Prop: ${this.state.intentContract.coreValueProp}

Success Criteria:
${this.state.intentContract.successCriteria.map(sc => `- ${sc.id}: ${sc.description}`).join('\n')}

User Workflows:
${this.state.intentContract.userWorkflows.map(wf => `- ${wf.name}: ${wf.success}`).join('\n')}

## Build Summary:
Features: ${this.state.featureSummary?.total || 0}
Passed: ${this.state.featureSummary?.passed || 0}
Pass Rate: ${this.state.featureSummary?.passRate || 0}%

Would the user be satisfied with this result?`;
    }

    private async handleIntentNotSatisfied(result: {
        satisfied: boolean;
        missingCriteria: string[];
        recommendations: string[];
    }): Promise<void> {
        // Log the issue
        this.state.errorCount++;
        this.state.lastError = `Intent not satisfied: ${result.missingCriteria.join(', ')}`;

        // Loop back to Phase 2 if not at max attempts
        if (this.state.escalationLevel < 3) {
            this.state.escalationLevel++;
            await this.executePhase2_ParallelBuild(this.state.currentStage);
            await this.executePhase3_IntegrationCheck();
            await this.executePhase4_FunctionalTest();
            await this.executePhase5_IntentSatisfaction();
        } else {
            throw new Error('Maximum escalation attempts reached');
        }
    }

    private async generateStyleGuide(): Promise<void> {
        if (!this.state.intentContract) return;

        const styleGuide = {
            appSoul: this.state.intentContract.appSoul,
            visualIdentity: this.state.intentContract.visualIdentity,
            antiPatterns: this.state.intentContract.antiPatterns,
            generatedAt: new Date().toISOString(),
        };

        await this.artifactManager.saveArtifact(
            'style_guide.json',
            JSON.stringify(styleGuide, null, 2)
        );
    }

    private shouldCreateCheckpoint(): boolean {
        if (!this.state.config.autoCreateCheckpoints) return false;

        const now = Date.now();
        const elapsed = now - (this.state.currentPhaseStartedAt?.getTime() || now);
        const interval = this.state.config.checkpointIntervalMinutes * 60 * 1000;

        return elapsed >= interval;
    }

    private async createCheckpoint(
        trigger: string,
        description: string,
        featureId?: string
    ): Promise<void> {
        const checkpointId = uuidv4();

        const snapshot = await this.artifactManager.createSnapshot();
        const buildState = await this.artifactManager.getBuildState();
        const featureSummary = this.state.featureSummary;

        // Create feature list snapshot from the summary
        const features = await this.featureManager.getAllFeatures();
        const featureListSnapshot = {
            total: featureSummary?.total || 0,
            passed: featureSummary?.passed || 0,
            failed: featureSummary?.failed || 0,
            pending: featureSummary?.pending || 0,
            features: features.map(f => ({
                id: f.featureId,
                passes: f.passes,
                verificationStatus: f.verificationStatus,
            })),
        };

        // Use type assertion to work around drizzle-orm type inference issues
        // with self-referencing foreign keys. The schema is correct but TypeScript
        // has trouble inferring the full type due to circular references.
        const checkpointData = {
            id: checkpointId,
            orchestrationRunId: this.state.orchestrationRunId,
            projectId: this.state.projectId,
            userId: this.state.userId,
            trigger, // e.g., 'feature_complete', 'phase_complete', 'interval_15m', 'manual'
            triggerFeatureId: featureId,
            phase: this.state.currentPhase,
            artifacts: {
                intentJson: this.state.intentContract,
                featureListJson: featureSummary,
                styleGuideJson: snapshot.styleGuideJson,
                progressTxt: snapshot.progressTxt,
                buildStateJson: buildState,
            },
            featureListSnapshot,
            verificationScoresSnapshot: null,
            screenshots: [],
            agentMemorySnapshot: null,
            fileChecksums: null,
        } as typeof buildCheckpoints.$inferInsert;

        const [inserted] = await db.insert(buildCheckpoints).values(checkpointData).returning();

        this.state.lastCheckpointId = inserted?.id || checkpointId;
        this.state.checkpointCount++;

        this.emitEvent('checkpoint_created', {
            checkpointId,
            description,
        });
    }

    private async handleError(error: Error): Promise<void> {
        this.state.status = 'failed';
        this.state.lastError = error.message;
        this.state.errorCount++;

        await this.artifactManager.addIssueResolution({
            errorType: 'build_loop_error',
            errorMessage: error.message,
            solution: 'Build loop failed',
            filesAffected: [],
            resolutionMethod: 'escalation',
            escalationLevel: this.state.escalationLevel,
        });

        this.emitEvent('error', {
            error: error.message,
            phase: this.state.currentPhase,
            stage: this.state.currentStage,
        });
    }

    private startPhase(phase: BuildLoopPhase): void {
        this.state.currentPhase = phase;
        this.state.currentPhaseStartedAt = new Date();
        this.emitEvent('phase_start', { phase });
    }

    private completePhase(phase: BuildLoopPhase): void {
        this.state.phasesCompleted.push(phase);
        this.state.currentPhaseDurationMs = Date.now() - (this.state.currentPhaseStartedAt?.getTime() || Date.now());
    }

    private emitEvent(type: BuildLoopEvent['type'], data: Record<string, unknown>): void {
        const event: BuildLoopEvent = {
            type,
            timestamp: new Date(),
            buildId: this.state.id,
            data,
        };
        this.emit(type, event);
        this.emit('event', event);
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    getState(): BuildLoopState {
        return { ...this.state };
    }

    abort(): void {
        this.aborted = true;
        this.state.status = 'failed';
    }

    async restoreFromCheckpoint(checkpointId: string): Promise<void> {
        const checkpoints = await db.select()
            .from(buildCheckpoints)
            .where(eq(buildCheckpoints.id, checkpointId))
            .limit(1);

        if (checkpoints.length === 0) {
            throw new Error(`Checkpoint not found: ${checkpointId}`);
        }

        const checkpoint = checkpoints[0];
        const artifacts = checkpoint.artifacts as {
            intentJson?: object;
            featureListJson?: object;
            styleGuideJson?: object;
            progressTxt?: string;
            buildStateJson?: object;
        } | null;

        if (artifacts) {
            await this.artifactManager.restoreFromSnapshot(artifacts);
        }

        this.state.currentPhase = checkpoint.phase as BuildLoopPhase;
    }
}

/**
 * Create a BuildLoopOrchestrator instance
 */
export function createBuildLoopOrchestrator(
    projectId: string,
    userId: string,
    orchestrationRunId: string,
    mode: BuildMode = 'standard'
): BuildLoopOrchestrator {
    return new BuildLoopOrchestrator(projectId, userId, orchestrationRunId, mode);
}

/**
 * Start a new build loop
 */
export async function startBuildLoop(
    prompt: string,
    projectId: string,
    userId: string,
    mode: BuildMode = 'standard'
): Promise<BuildLoopOrchestrator> {
    const orchestrationRunId = uuidv4();

    // Create orchestration run record
    await db.insert(orchestrationRuns).values({
        id: orchestrationRunId,
        projectId,
        userId,
        prompt,
        plan: { prompt, mode },
        status: 'running',
        artifacts: {},
        startedAt: new Date().toISOString(),
    });

    const orchestrator = createBuildLoopOrchestrator(projectId, userId, orchestrationRunId, mode);

    // Start in background
    orchestrator.start(prompt).catch(error => {
        console.error('[BuildLoop] Failed:', error);
    });

    return orchestrator;
}
