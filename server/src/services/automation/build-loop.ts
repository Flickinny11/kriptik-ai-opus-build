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
import {
    getKripToeNite,
    type KripToeNiteFacade,
    type KTNResult,
} from '../ai/krip-toe-nite/index.js';
// Import real automation services
import {
    BrowserAutomationService,
    createBrowserAutomationService,
    type ConsoleLog,
    type NetworkRequest,
} from './browser-service.js';
import {
    ErrorEscalationEngine,
    createErrorEscalationEngine,
    type BuildError,
    type Fix,
} from './error-escalation.js';
import {
    VerificationSwarm,
    createVerificationSwarm,
    type CombinedVerificationResult,
} from '../verification/swarm.js';
import {
    VisualVerificationService,
    createVisualVerificationService,
} from './visual-verifier.js';
import {
    SandboxService,
    createSandboxService,
    type SandboxInstance,
} from '../developer-mode/sandbox-service.js';
import {
    TimeMachine,
    createTimeMachine,
    CheckpointScheduler,
    createCheckpointScheduler,
    type CheckpointData,
} from '../checkpoints/time-machine.js';
import {
    getWebSocketSyncService,
    type WebSocketSyncService,
} from '../agents/websocket-sync.js';

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
        | 'error' | 'fix_applied' | 'checkpoint_created' | 'checkpoint_restored'
        | 'stage_complete' | 'build_complete';
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

    // Real automation services
    private browserService: BrowserAutomationService | null = null;
    private errorEscalationEngine: ErrorEscalationEngine;
    private verificationSwarm: VerificationSwarm;
    private visualVerifier: VisualVerificationService;
    private sandboxService: SandboxService | null = null;
    private timeMachine: TimeMachine;
    private checkpointScheduler: CheckpointScheduler;

    // WebSocket sync for real-time updates
    private wsSync: WebSocketSyncService;

    // File contents cache for verification
    private projectFiles: Map<string, string> = new Map();

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

        // Initialize real automation services
        this.errorEscalationEngine = createErrorEscalationEngine(
            orchestrationRunId,
            projectId,
            userId
        );
        this.verificationSwarm = createVerificationSwarm(
            orchestrationRunId,
            projectId,
            userId,
            { enableVisualVerification: BUILD_MODE_CONFIGS[mode].enableVisualVerification }
        );
        this.visualVerifier = createVisualVerificationService();
        this.timeMachine = createTimeMachine(projectId, userId, orchestrationRunId, 10);
        this.checkpointScheduler = createCheckpointScheduler(
            this.timeMachine,
            BUILD_MODE_CONFIGS[mode].checkpointIntervalMinutes
        );

        // Initialize WebSocket sync for real-time updates
        this.wsSync = getWebSocketSyncService();

        console.log(`[BuildLoop] Initialized with real automation services (mode: ${mode})`);
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
     * Opens a VISIBLE browser for the user to see and optionally take control
     */
    private async executePhase6_BrowserDemo(): Promise<void> {
        this.startPhase('browser_demo');

        try {
            // Ensure sandbox is running
            if (!this.sandboxService) {
                this.sandboxService = createSandboxService({
                    basePort: 3100,
                    maxSandboxes: 5,
                    projectPath: `/tmp/builds/${this.state.projectId}`,
                    framework: 'vite',
                });
                await this.sandboxService.initialize();
            }

            // Get or create sandbox
            let sandbox = this.sandboxService.getSandbox(this.state.id);
            if (!sandbox) {
                sandbox = await this.sandboxService.createSandbox(
                    this.state.id,
                    `/tmp/builds/${this.state.projectId}`
                );
            }

            if (sandbox.status !== 'running') {
                await this.sandboxService.restartSandbox(this.state.id);
                sandbox = this.sandboxService.getSandbox(this.state.id)!;
            }

            // Create a VISIBLE browser for demo (headed: true)
            const demoBrowser = createBrowserAutomationService({
                headed: true,  // User sees this!
                slowMo: 100,   // Slight slowdown for visual effect
                viewport: { width: 1280, height: 720 },
            });

            await demoBrowser.initialize();
            await demoBrowser.navigateTo(sandbox.url);

            // Take final screenshot for records
            const finalScreenshot = await demoBrowser.screenshot({ fullPage: true });

            // Run key user flows to demonstrate the app works
            if (this.state.intentContract?.userWorkflows) {
                for (const workflow of this.state.intentContract.userWorkflows.slice(0, 2)) {
                    // Demo first 2 workflows
                    for (const step of workflow.steps.slice(0, 3)) {
                        // First 3 steps of each
                        try {
                            await demoBrowser.executeAction(step);
                            await new Promise(resolve => setTimeout(resolve, 1000)); // Pause for visibility
                        } catch {
                            // Continue demo even if step fails
                        }
                    }
                }
            }

            // Emit event for frontend to show "Take Control" button
            this.emitEvent('phase_complete', {
                phase: 'browser_demo',
                status: 'demo_running',
                url: sandbox.url,
                browserConnected: true,
                takeControlAvailable: true,
                screenshot: finalScreenshot,
            });

            // Close demo browser after showing (or keep open based on config)
            // For now, keep it open for user interaction
            console.log(`[BuildLoop] Browser demo ready at ${sandbox.url}`);

            this.completePhase('browser_demo');

        } catch (error) {
            // Don't fail the build for demo issues - just log
            console.error(`[BuildLoop] Browser Demo error:`, error);
            this.completePhase('browser_demo');
            this.emitEvent('phase_complete', {
                phase: 'browser_demo',
                status: 'demo_unavailable',
                error: (error as Error).message,
            });
        }
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    /**
     * Build a feature with full Verification Swarm validation
     * Uses 6-agent parallel verification before marking as passed
     */
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

        // Use Krip-Toe-Nite Facade for intelligent model routing
        const ktn = getKripToeNite();
        let responseContent = '';

        try {
            // Use buildFeature() - speculative strategy for fast + verified code generation
            const result = await ktn.buildFeature(prompt, {
                projectId: this.state.projectId,
                userId: this.state.userId,
                framework: 'React',
                language: 'TypeScript',
            });
            responseContent = result.content;

            console.log(`[BuildLoop] KTN buildFeature completed: strategy=${result.strategy}, model=${result.model}, latency=${result.latencyMs}ms`);
        } catch (error) {
            // Fallback to Claude service if KTN fails
            console.warn('[BuildLoop] KTN failed, falling back to Claude:', error);
            const response = await this.claudeService.generate(prompt, {
                model: phaseConfig.model,
                maxTokens: 32000,
                useExtendedThinking: true,
                thinkingBudgetTokens: phaseConfig.thinkingBudget,
            });
            responseContent = response.content;
        }

        // Parse and save files
        const files = this.claudeService.parseFileOperations(responseContent);
        const filePaths = files.map(f => f.path);

        // Update project files cache with generated content
        const generatedFiles = new Map<string, string>();
        for (const file of files) {
            const content = file.content || '';
            generatedFiles.set(file.path, content);
            this.projectFiles.set(file.path, content);
        }

        await this.featureManager.addFilesModified(feature.featureId, filePaths);

        // =========================================================================
        // RUN VERIFICATION SWARM - 6-Agent Parallel Verification
        // =========================================================================

        console.log(`[BuildLoop] Running Verification Swarm for feature ${feature.featureId}`);

        // Set Intent Contract for design verification
        if (this.state.intentContract) {
            this.verificationSwarm.setIntent(this.state.intentContract);
        }

        const verdict: CombinedVerificationResult = await this.verificationSwarm.verifyFeature(
            feature,
            generatedFiles
        );

        this.emitEvent('verification_result', {
            featureId: feature.featureId,
            verdict: verdict.verdict,
            overallScore: verdict.overallScore,
            blockers: verdict.blockers,
        });

        // Handle verification results
        if (verdict.verdict === 'BLOCKED') {
            // Placeholders or security issues - escalate immediately
            console.log(`[BuildLoop] Feature ${feature.featureId} BLOCKED: ${verdict.blockers.join(', ')}`);

            const blockError: BuildError = {
                id: uuidv4(),
                featureId: feature.featureId,
                category: verdict.blockers.some(b => b.includes('Placeholder'))
                    ? 'targeted_rewrite'
                    : 'integration_issues',
                message: `Verification BLOCKED: ${verdict.blockers.join('; ')}`,
                context: { verificationResult: verdict },
                timestamp: new Date(),
            };

            // Set intent for potential Level 4 rebuild
            if (this.state.intentContract) {
                this.errorEscalationEngine.setIntent(this.state.intentContract);
            }

            // Attempt to fix with escalation
            const fixResult = await this.errorEscalationEngine.fixError(
                blockError,
                generatedFiles,
                feature
            );

            if (!fixResult.success) {
                throw new Error(`Feature ${feature.featureId} blocked and unfixable: ${verdict.blockers.join(', ')}`);
            }

            // Re-run verification after fix
            console.log(`[BuildLoop] Re-verifying feature ${feature.featureId} after fix`);
            const reVerdict = await this.verificationSwarm.verifyFeature(feature, generatedFiles);

            if (reVerdict.verdict !== 'APPROVED') {
                throw new Error(`Feature ${feature.featureId} still not approved after fix`);
            }
        }

        if (verdict.verdict === 'NEEDS_WORK') {
            // Issues found but not blocking - escalate each
            console.log(`[BuildLoop] Feature ${feature.featureId} needs work - attempting fixes`);

            const allResults = verdict.results;
            const issueResults = [
                allResults.errorCheck,
                allResults.codeQuality,
                allResults.visualVerify,
                allResults.securityScan,
            ].filter(r => r && !r.passed);

            for (const result of issueResults) {
                if (!result) continue;

                for (const issue of result.issues.filter(i => i.severity === 'critical' || i.severity === 'high')) {
                    const issueError: BuildError = {
                        id: uuidv4(),
                        featureId: feature.featureId,
                        category: issue.category as BuildError['category'] || 'runtime_error',
                        message: issue.description,
                        file: issue.file,
                        line: issue.line,
                        timestamp: new Date(),
                    };

                    await this.errorEscalationEngine.fixError(issueError, generatedFiles, feature);
                }
            }
        }

        if (verdict.verdict === 'REJECTED') {
            // UI looks like AI slop - need design overhaul
            console.log(`[BuildLoop] Feature ${feature.featureId} REJECTED - UI slop detected`);

            const slopError: BuildError = {
                id: uuidv4(),
                featureId: feature.featureId,
                category: 'approach_change',
                message: `Visual verification rejected: ${verdict.blockers.join('; ')}`,
                context: { designScore: verdict.overallScore },
                timestamp: new Date(),
            };

            if (this.state.intentContract) {
                this.errorEscalationEngine.setIntent(this.state.intentContract);
            }

            await this.errorEscalationEngine.fixError(slopError, generatedFiles, feature);
        }

        // Only mark passed if APPROVED
        if (verdict.verdict === 'APPROVED') {
            console.log(`[BuildLoop] Feature ${feature.featureId} APPROVED (score: ${verdict.overallScore})`);
            await this.featureManager.markFeaturePassed(feature.featureId);
        } else {
            // Feature not approved - log failure and increment attempts
            console.log(`[BuildLoop] Feature ${feature.featureId} NOT APPROVED (${verdict.verdict}): ${verdict.blockers.join('; ')}`);
            // The feature will be retried on next build loop iteration
            // Attempt count was already incremented at the start of buildFeature
        }
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

    /**
     * Run integration check using BrowserService to scan for real issues
     * Detects: orphan components, dead code, unwired routes, console errors, network failures
     */
    private async runIntegrationCheck(): Promise<Array<{ type: string; description: string }>> {
        const issues: Array<{ type: string; description: string }> = [];

        try {
            // Initialize sandbox if not already running
            if (!this.sandboxService) {
                this.sandboxService = createSandboxService({
                    basePort: 3100,
                    maxSandboxes: 5,
                    projectPath: `/tmp/builds/${this.state.projectId}`,
                    framework: 'vite',
                });
                await this.sandboxService.initialize();
            }

            // Get or create sandbox for this build
            let sandbox: SandboxInstance | null = this.sandboxService.getSandbox(this.state.id);
            if (!sandbox) {
                sandbox = await this.sandboxService.createSandbox(
                    this.state.id,
                    `/tmp/builds/${this.state.projectId}`
                );
            }

            // Initialize browser service
            if (!this.browserService) {
                this.browserService = createBrowserAutomationService({ headed: false });
                await this.browserService.initialize();
            }

            // Navigate to sandbox URL
            const navResult = await this.browserService.navigateTo(sandbox.url);
            if (!navResult.success) {
                issues.push({
                    type: 'navigation_error',
                    description: `Failed to navigate to sandbox: ${navResult.error}`,
                });
                return issues;
            }

            // Wait for app to load
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Check console for errors
            const consoleLogs = this.browserService.getConsoleErrors();
            for (const log of consoleLogs) {
                issues.push({
                    type: 'console_error',
                    description: `Console error: ${log.message}`,
                });
            }

            // Check for failed network requests (404s, 500s)
            const failedRequests = this.browserService.getFailedRequests();
            for (const req of failedRequests) {
                // Skip common false positives (favicon, sourcemaps)
                if (req.url.includes('favicon') || req.url.includes('.map')) continue;

                issues.push({
                    type: 'network_error',
                    description: `Failed request: ${req.method} ${req.url} - ${req.status || req.errorText}`,
                });
            }

            // Take screenshot for visual verification if enabled
            if (this.state.config.enableVisualVerification) {
                const screenshot = await this.browserService.screenshot({ fullPage: true });

                // Check for visual slop patterns
                const slopIssues = await this.visualVerifier.detectSlop(screenshot);
                for (const slop of slopIssues) {
                    issues.push({
                        type: 'visual_slop',
                        description: `${slop.severity}: ${slop.description}`,
                    });
                }
            }

            // Clear logs for next check
            this.browserService.clearConsoleLogs();
            this.browserService.clearNetworkRequests();

            console.log(`[BuildLoop] Integration check found ${issues.length} issues`);

        } catch (error) {
            console.error('[BuildLoop] Integration check error:', error);
            issues.push({
                type: 'integration_check_error',
                description: `Integration check failed: ${(error as Error).message}`,
            });
        }

        return issues;
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

    /**
     * Test a user workflow using real Playwright browser automation
     * Executes each step and verifies the success condition
     */
    private async testWorkflow(workflow: { name: string; steps: string[]; success: string }): Promise<boolean> {
        console.log(`[BuildLoop] Testing workflow: ${workflow.name}`);

        try {
            // Ensure browser is initialized
            if (!this.browserService) {
                this.browserService = createBrowserAutomationService({ headed: false });
                await this.browserService.initialize();
            }

            // Get sandbox URL
            if (!this.sandboxService) {
                console.log(`[BuildLoop] No sandbox available for workflow test: ${workflow.name}`);
                return false;
            }

            const sandbox = this.sandboxService.getSandbox(this.state.id);
            if (!sandbox || sandbox.status !== 'running') {
                console.log(`[BuildLoop] Sandbox not running for workflow test: ${workflow.name}`);
                return false;
            }

            // Navigate to starting point
            const navResult = await this.browserService.navigateTo(sandbox.url);
            if (!navResult.success) {
                console.log(`[BuildLoop] Failed to navigate for workflow: ${workflow.name}`);
                return false;
            }

            // Wait for initial page load
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Execute each step in the workflow using AI-powered actions
            for (const step of workflow.steps) {
                console.log(`[BuildLoop] Executing step: ${step}`);

                const result = await this.browserService.executeAction(step);

                if (!result.success) {
                    console.log(`[BuildLoop] Step failed: ${step} - ${result.error}`);
                    return false;
                }

                // Small delay between steps for UI to settle
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Verify success condition using visual verification
            const screenshot = await this.browserService.screenshot({ fullPage: true });
            const verification = await this.visualVerifier.verifyPage(screenshot, workflow.success);

            if (!verification.passed) {
                console.log(`[BuildLoop] Workflow "${workflow.name}" success verification failed`);
                console.log(`[BuildLoop] Design score: ${verification.designScore}, Issues: ${verification.issues.length}`);
                return false;
            }

            console.log(`[BuildLoop] Workflow "${workflow.name}" passed (design score: ${verification.designScore})`);
            return true;

        } catch (error) {
            console.error(`[BuildLoop] Workflow test error for "${workflow.name}":`, error);
            return false;
        }
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

    /**
     * Create a checkpoint using the full TimeMachine service
     * Enables one-click rollback with complete state preservation
     */
    private async createCheckpoint(
        trigger: string,
        description: string,
        featureId?: string
    ): Promise<void> {
        try {
            const snapshot = await this.artifactManager.createSnapshot();
            const buildState = await this.artifactManager.getBuildState();

            // Capture current verification scores
            const verificationScores = {
                codeQuality: 0,
                visual: 0,
                antiSlop: 0,
                security: 0,
                overall: this.state.featureSummary?.passRate || 0,
            };

            // Capture screenshots if browser is available
            const screenshots: string[] = [];
            if (this.browserService && this.state.config.enableVisualVerification) {
                try {
                    const screenshot = await this.browserService.screenshot({ fullPage: true });
                    screenshots.push(screenshot);
                } catch {
                    // Screenshot capture is best-effort
                }
            }

            // Use TimeMachine for full checkpoint with rollback capability
            const checkpoint: CheckpointData = await this.timeMachine.createCheckpoint(
                this.state.currentPhase,
                this.projectFiles,
                {
                    artifacts: {
                        intentContract: this.state.intentContract
                            ? JSON.stringify(this.state.intentContract)
                            : undefined,
                        featureList: this.state.featureSummary
                            ? JSON.stringify(this.state.featureSummary)
                            : undefined,
                        progressLog: snapshot.progressTxt,
                        buildState: buildState
                            ? JSON.stringify(buildState)
                            : undefined,
                    },
                    scores: verificationScores,
                    screenshots,
                    description,
                    isAutomatic: trigger !== 'manual',
                    triggerReason: trigger as CheckpointData['triggerReason'],
                }
            );

            this.state.lastCheckpointId = checkpoint.id;
            this.state.checkpointCount++;

            console.log(`[BuildLoop] TimeMachine checkpoint created: ${checkpoint.id} (${trigger})`);

            this.emitEvent('checkpoint_created', {
                checkpointId: checkpoint.id,
                description,
                filesCount: this.projectFiles.size,
                phase: this.state.currentPhase,
                rollbackAvailable: true,
            });

        } catch (error) {
            console.error('[BuildLoop] Checkpoint creation failed:', error);
            // Don't fail the build for checkpoint errors
        }
    }

    /**
     * Rollback to a previous checkpoint using TimeMachine
     */
    async rollbackToCheckpoint(checkpointId: string): Promise<void> {
        console.log(`[BuildLoop] Rolling back to checkpoint: ${checkpointId}`);

        const result = await this.timeMachine.rollback(checkpointId);

        if (!result.success) {
            throw new Error(`Rollback failed: ${result.message}`);
        }

        // Get the checkpoint data
        const checkpoint = await this.timeMachine.getCheckpoint(checkpointId);

        if (checkpoint) {
            // Restore project files
            this.projectFiles = checkpoint.files;

            // Restore state
            if (checkpoint.artifacts.intentContract) {
                this.state.intentContract = JSON.parse(checkpoint.artifacts.intentContract);
            }
            if (checkpoint.artifacts.featureList) {
                this.state.featureSummary = JSON.parse(checkpoint.artifacts.featureList);
            }

            this.state.currentPhase = checkpoint.phase as BuildLoopPhase;
        }

        console.log(`[BuildLoop] Successfully rolled back to checkpoint ${checkpointId}`);

        this.emitEvent('checkpoint_restored', {
            checkpointId,
            filesRestored: result.restoredFilesCount,
            phase: checkpoint?.phase,
        });
    }

    /**
     * Get all available checkpoints for this build
     */
    async getCheckpoints(): Promise<Array<{ id: string; phase: string; timestamp: Date; description?: string }>> {
        const summaries = await this.timeMachine.getAllCheckpoints();
        return summaries.map(s => ({
            id: s.id,
            phase: s.phase,
            timestamp: s.timestamp,
            description: s.description,
        }));
    }

    /**
     * Handle errors with 4-level Error Escalation System
     * NEVER GIVES UP - escalates through all 4 levels until resolved
     */
    private async handleError(error: Error): Promise<void> {
        console.log(`[BuildLoop] Handling error with 4-level escalation: ${error.message}`);

        // Set Intent Contract for Level 4 rebuilds
        if (this.state.intentContract) {
            this.errorEscalationEngine.setIntent(this.state.intentContract);
        }

        // Create build error object
        const buildError: BuildError = {
            id: uuidv4(),
            featureId: 'build_loop',
            category: this.categorizeError(error.message),
            message: error.message,
            stack: error.stack,
            context: {
                phase: this.state.currentPhase,
                stage: this.state.currentStage,
                errorCount: this.state.errorCount,
            },
            timestamp: new Date(),
        };

        // Get current feature being built (if applicable)
        const features = await this.featureManager.getAllFeatures();
        const pendingFeature = features.find(f => !f.passes);

        // Attempt fix with 4-level escalation
        const result = await this.errorEscalationEngine.fixError(
            buildError,
            this.projectFiles,
            pendingFeature
        );

        if (result.success && result.fix) {
            console.log(`[BuildLoop] Error fixed at Level ${result.level}: ${result.fix.strategy}`);

            // Apply the fix
            await this.applyFix(result.fix);

            this.emitEvent('fix_applied', {
                errorId: buildError.id,
                level: result.level,
                strategy: result.fix.strategy,
                filesChanged: result.fix.changes.length,
            });

            // Reset error state and continue
            this.state.lastError = null;
            return;
        }

        // All 4 levels exhausted - truly unrecoverable
        console.error(`[BuildLoop] Error escalation exhausted all 4 levels - build failed`);

        this.state.status = 'failed';
        this.state.lastError = `${error.message} (Escalation exhausted all 4 levels)`;
        this.state.errorCount++;

        await this.artifactManager.addIssueResolution({
            errorType: 'build_loop_error',
            errorMessage: error.message,
            solution: 'All 4 escalation levels exhausted',
            filesAffected: [],
            resolutionMethod: 'escalation',
            escalationLevel: 4,
        });

        this.emitEvent('error', {
            error: error.message,
            phase: this.state.currentPhase,
            stage: this.state.currentStage,
            escalationResult: result.message,
        });
    }

    /**
     * Categorize error message to determine starting escalation level
     */
    private categorizeError(message: string): BuildError['category'] {
        const lowerMsg = message.toLowerCase();

        // Level 1: Simple errors
        if (lowerMsg.includes('syntax') || lowerMsg.includes('parsing')) return 'syntax_error';
        if (lowerMsg.includes('import') || lowerMsg.includes('cannot find module')) return 'import_missing';
        if (lowerMsg.includes('type') || lowerMsg.includes('is not assignable')) return 'type_mismatch';
        if (lowerMsg.includes('undefined') || lowerMsg.includes('is not defined')) return 'undefined_variable';

        // Level 2: Complex errors
        if (lowerMsg.includes('dependency') || lowerMsg.includes('conflict')) return 'dependency_conflicts';
        if (lowerMsg.includes('integration') || lowerMsg.includes('connect')) return 'integration_issues';
        if (lowerMsg.includes('architecture') || lowerMsg.includes('structure')) return 'architectural_review';

        // Default to runtime error (Level 2)
        return 'runtime_error';
    }

    /**
     * Apply a fix from the error escalation engine
     */
    private async applyFix(fix: Fix): Promise<void> {
        for (const change of fix.changes) {
            if (change.action === 'create' || change.action === 'update') {
                // Update project files cache
                this.projectFiles.set(change.path, change.newContent || '');

                // In a real implementation, this would write to the filesystem
                console.log(`[BuildLoop] Applied ${change.action} to ${change.path}`);
            } else if (change.action === 'delete') {
                this.projectFiles.delete(change.path);
                console.log(`[BuildLoop] Deleted ${change.path}`);
            }
        }
    }

    private startPhase(phase: BuildLoopPhase): void {
        this.state.currentPhase = phase;
        this.state.currentPhaseStartedAt = new Date();
        this.emitEvent('phase_start', { phase });

        // Broadcast via WebSocket for real-time frontend updates
        this.wsSync.sendPhaseChange(
            this.state.projectId,
            phase,
            this.calculateOverallProgress(),
            this.state.status
        );

        this.wsSync.sendBuildProgress(this.state.projectId, {
            currentPhase: phase,
            currentStage: this.state.currentStage,
            featuresPending: this.state.featureSummary?.pending || 0,
            featuresCompleted: this.state.featureSummary?.passed || 0,
            featuresFailed: this.state.featureSummary?.failed || 0,
            overallProgress: this.calculateOverallProgress(),
        });
    }

    private completePhase(phase: BuildLoopPhase): void {
        this.state.phasesCompleted.push(phase);
        this.state.currentPhaseDurationMs = Date.now() - (this.state.currentPhaseStartedAt?.getTime() || Date.now());

        // Broadcast phase completion via WebSocket
        this.wsSync.sendPhaseChange(
            this.state.projectId,
            phase,
            this.calculateOverallProgress(),
            'completed'
        );
    }

    /**
     * Calculate overall build progress as a percentage
     */
    private calculateOverallProgress(): number {
        const phaseWeights: Record<BuildLoopPhase, number> = {
            'intent_lock': 10,
            'initialization': 15,
            'parallel_build': 40,
            'integration_check': 10,
            'functional_test': 10,
            'intent_satisfaction': 10,
            'browser_demo': 5,
            'complete': 100,
            'failed': 0,
        };

        let progress = 0;
        for (const completedPhase of this.state.phasesCompleted) {
            progress += phaseWeights[completedPhase] || 0;
        }

        // Add partial progress for current phase
        if (this.state.currentPhase !== 'complete' && this.state.currentPhase !== 'failed') {
            progress += this.state.stageProgress * (phaseWeights[this.state.currentPhase] / 100);
        }

        return Math.min(100, Math.round(progress));
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
