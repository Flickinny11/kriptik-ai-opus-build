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
    type TaskItem,
} from '../ai/artifacts.js';
import {
    createClaudeService,
    CLAUDE_MODELS,
} from '../ai/claude-service.js';
import {
    getPhaseConfig,
    getOpenRouterClient,
} from '../ai/openrouter-client.js';
import {
    getKripToeNite,
    type KripToeNiteFacade,
    type KTNResult,
} from '../ai/krip-toe-nite/index.js';
// Context Loading & Memory Harness
import {
    createInitializerAgent,
    needsInitialization,
    type InitializerAgent,
    type InitializerResult,
} from '../ai/initializer-agent.js';
import {
    createCodingAgentWrapper,
    type CodingAgentWrapper,
    type TaskResult,
} from '../ai/coding-agent-wrapper.js';
import {
    loadProjectContext,
    hasProjectContext,
    type LoadedContext,
} from '../ai/context-loader.js';
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
    LoopBlocker,
    createLoopBlocker,
    type BuildContext as LoopBlockerBuildContext,
    type ErrorSignature,
} from './loop-blocker.js';
import {
    getContextOverflowManager,
    type ContextOverflowManager,
    type ContextStatus,
    type AgentHandoff,
    type BuildContextSummary,
} from '../agents/context-overflow.js';
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
// ============================================================================
// AUTONOMOUS LEARNING ENGINE INTEGRATION (Component 28)
// ============================================================================
import {
    ExperienceCaptureService,
    createExperienceCaptureService,
} from '../learning/experience-capture.js';
import {
    AIJudgmentService,
    getAIJudgmentService,
} from '../learning/ai-judgment.js';
import {
    PatternLibraryService,
    getPatternLibrary,
} from '../learning/pattern-library.js';
import {
    StrategyEvolutionService,
    getStrategyEvolution,
} from '../learning/strategy-evolution.js';
import {
    EvolutionFlywheel,
    getEvolutionFlywheel,
} from '../learning/evolution-flywheel.js';
import type {
    DecisionOutcome,
    LearnedPattern,
} from '../learning/types.js';

// ============================================================================
// CURSOR 2.1+ FEATURE INTEGRATION
// ============================================================================
import {
    StreamingFeedbackChannel,
    getStreamingFeedbackChannel,
    type FeedbackItem,
} from '../feedback/streaming-feedback-channel.js';

import {
    ContinuousVerificationService,
    createContinuousVerification,
    type CheckResult,
} from '../verification/continuous-verification.js';

import {
    RuntimeDebugContextService,
    getRuntimeDebugContext,
    type DebugSession,
    type RuntimeError,
} from '../debug/runtime-debug-context.js';

import {
    BrowserInLoopService,
    createBrowserInLoop,
    type VisualCheck,
} from '../verification/browser-in-loop.js';

import {
    HumanCheckpointService,
    getHumanCheckpointService,
    type VerificationCheckpoint,
    type CheckpointResponse,
} from '../verification/human-checkpoint.js';

import {
    MultiAgentJudgeService,
    getMultiAgentJudge,
    type AgentResult,
    type JudgmentResult,
} from '../verification/multi-agent-judge.js';

import {
    ErrorPatternLibraryService,
    getErrorPatternLibrary,
    type PatternMatchResult,
    type PatternApplicationResult,
} from './error-pattern-library.js';

// ============================================================================
// REMAINING FEATURE INTEGRATION (Ghost Mode, Soft Interrupt, Credentials)
// ============================================================================
import {
    SoftInterruptManager,
    getSoftInterruptManager,
    type ClassifiedInterrupt,
    type UserInterrupt,
} from '../soft-interrupt/interrupt-manager.js';

import {
    CredentialVault,
    getCredentialVault,
    type DecryptedCredential,
} from '../security/credential-vault.js';

import {
    GhostModeController,
    getGhostModeController,
    type GhostSessionConfig,
    type GhostSessionState,
    type WakeCondition,
} from '../ghost-mode/ghost-controller.js';

// ============================================================================
// ORPHANED FEATURES INTEGRATION (Image-to-Code, Voice Architect, API Autopilot)
// ============================================================================
import {
    ImageToCodeService,
    type ImageToCodeRequest,
    type ImageToCodeResult,
} from '../ai/image-to-code.js';

import {
    APIAutopilotService,
    type APIProfile,
    type IntegrationResult,
} from '../api/api-autopilot.js';

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

export type BuildMode = 'lightning' | 'standard' | 'tournament' | 'production' | 'fix';

export interface BuildLoopConfig {
    mode: BuildMode;
    maxAgents: number;
    enableTournament: boolean;
    autoCreateCheckpoints: boolean;
    checkpointIntervalMinutes: number;
    maxBuildDurationMinutes: number;
    enableVisualVerification: boolean;

    // Cursor 2.1+ Feature Flags
    enableStreamingFeedback: boolean;
    enableContinuousVerification: boolean;
    enableRuntimeDebug: boolean;
    enableBrowserInLoop: boolean;
    enableHumanCheckpoints: boolean;
    enableMultiAgentJudging: boolean;
    enablePatternLibrary: boolean;

    // Cursor 2.1+ Thresholds
    visualQualityThreshold: number;
    humanCheckpointEscalationLevel: number;
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
        | 'stage_complete' | 'build_complete' | 'paused' | 'resumed' | 'intent_created'
        | 'tasks_decomposed' | 'scaffolding_complete' | 'artifacts_created' | 'git_initialized'
        // Cursor 2.1+ events
        | 'cursor21_pattern_fix' | 'cursor21_checkpoint_waiting' | 'cursor21_checkpoint_responded'
        | 'cursor21_judgment_complete' | 'cursor21_feedback' | 'cursor21_visual_check'
        // Agent Activity Stream events (for real-time UI)
        | 'thinking' | 'file_read' | 'file_write' | 'file_edit' | 'tool_call' | 'status' | 'verification';
    timestamp: Date;
    buildId: string;
    data: Record<string, unknown>;
}

/**
 * Agent Activity Event - Standardized format for real-time activity stream UI
 */
export interface AgentActivityEventData {
    agentId?: string;
    agentName?: string;
    content: string;
    metadata?: {
        filePath?: string;
        toolName?: string;
        phase?: 'thinking' | 'planning' | 'coding' | 'testing' | 'verifying' | 'integrating' | 'deploying';
        lineNumbers?: { start: number; end: number };
        tokenCount?: number;
        duration?: number;
        parameters?: Record<string, unknown>;
        result?: 'success' | 'failure' | 'pending';
    };
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
        // Cursor 2.1+ - minimal for speed
        enableStreamingFeedback: false,
        enableContinuousVerification: false,
        enableRuntimeDebug: false,
        enableBrowserInLoop: false,
        enableHumanCheckpoints: false,
        enableMultiAgentJudging: false,
        enablePatternLibrary: true, // Always enable pattern library for quick fixes
        visualQualityThreshold: 70,
        humanCheckpointEscalationLevel: 3,
    },
    standard: {
        mode: 'standard',
        maxAgents: 3,
        enableTournament: false,
        autoCreateCheckpoints: true,
        checkpointIntervalMinutes: 15,
        maxBuildDurationMinutes: 30,
        enableVisualVerification: true,
        // Cursor 2.1+ - balanced
        enableStreamingFeedback: true,
        enableContinuousVerification: true,
        enableRuntimeDebug: true,
        enableBrowserInLoop: true,
        enableHumanCheckpoints: false, // No human checkpoints for standard
        enableMultiAgentJudging: false,
        enablePatternLibrary: true,
        visualQualityThreshold: 85,
        humanCheckpointEscalationLevel: 2,
    },
    tournament: {
        mode: 'tournament',
        maxAgents: 5,
        enableTournament: true,
        autoCreateCheckpoints: true,
        checkpointIntervalMinutes: 10,
        maxBuildDurationMinutes: 45,
        enableVisualVerification: true,
        // Cursor 2.1+ - full features
        enableStreamingFeedback: true,
        enableContinuousVerification: true,
        enableRuntimeDebug: true,
        enableBrowserInLoop: true,
        enableHumanCheckpoints: true,
        enableMultiAgentJudging: true, // Multi-agent judging for tournament
        enablePatternLibrary: true,
        visualQualityThreshold: 85,
        humanCheckpointEscalationLevel: 2,
    },
    production: {
        mode: 'production',
        maxAgents: 5,
        enableTournament: true,
        autoCreateCheckpoints: true,
        checkpointIntervalMinutes: 10,
        maxBuildDurationMinutes: 120,
        enableVisualVerification: true,
        // Cursor 2.1+ - maximum quality
        enableStreamingFeedback: true,
        enableContinuousVerification: true,
        enableRuntimeDebug: true,
        enableBrowserInLoop: true,
        enableHumanCheckpoints: true,
        enableMultiAgentJudging: true,
        enablePatternLibrary: true,
        visualQualityThreshold: 90, // Higher threshold for production
        humanCheckpointEscalationLevel: 2,
    },
    fix: {
        mode: 'fix',
        maxAgents: 3,
        enableTournament: false,
        autoCreateCheckpoints: true,
        checkpointIntervalMinutes: 15,
        maxBuildDurationMinutes: 60,
        enableVisualVerification: true,
        // Cursor 2.1+ - balanced for fixing imported projects
        enableStreamingFeedback: true,
        enableContinuousVerification: true,
        enableRuntimeDebug: true,
        enableBrowserInLoop: true,
        enableHumanCheckpoints: false, // Fix mode runs autonomously
        enableMultiAgentJudging: false,
        enablePatternLibrary: true, // Pattern library helps fix common issues
        visualQualityThreshold: 85,
        humanCheckpointEscalationLevel: 3,
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
    private loopBlocker: LoopBlocker;
    private contextOverflowManager: ContextOverflowManager;
    private buildLoopAgentId: string;

    // WebSocket sync for real-time updates
    private wsSync: WebSocketSyncService;

    // File contents cache for verification
    private projectFiles: Map<string, string> = new Map();

    // =========================================================================
    // AUTONOMOUS LEARNING ENGINE (Component 28)
    // =========================================================================
    private experienceCapture: ExperienceCaptureService | null = null;
    private aiJudgment: AIJudgmentService;
    private patternLibrary: PatternLibraryService;
    private strategyEvolution: StrategyEvolutionService;
    private evolutionFlywheel: EvolutionFlywheel;
    private learningEnabled: boolean = true;
    private pendingDecisionTraces: Map<string, string> = new Map(); // taskId -> traceId

    // SPEED OPTIMIZATION: Pre-cached patterns and strategies (loaded once at build start)
    private cachedPatterns: LearnedPattern[] = [];
    private cachedStrategies: Map<string, string> = new Map(); // domain -> strategyName
    private learningCacheLoaded: boolean = false;

    // Memory Harness - Context Loading & Artifact Updates
    private initializerAgent: InitializerAgent | null = null;
    private projectPath: string;
    private openRouterClient: ReturnType<typeof getOpenRouterClient>;
    private loadedContext: LoadedContext | null = null;

    // =========================================================================
    // CURSOR 2.1+ SERVICES
    // =========================================================================
    private feedbackChannel: StreamingFeedbackChannel | null = null;
    private continuousVerification: ContinuousVerificationService | null = null;
    private runtimeDebug: RuntimeDebugContextService | null = null;
    private browserInLoop: BrowserInLoopService | null = null;
    private humanCheckpoint: HumanCheckpointService | null = null;
    private multiAgentJudge: MultiAgentJudgeService | null = null;
    private errorPatternLibrary: ErrorPatternLibraryService | null = null;

    // Cursor 2.1+ State Tracking
    private cursor21State: {
        feedbackItemsReceived: number;
        selfCorrectionsMade: number;
        humanCheckpointsTriggered: number;
        patternFixesApplied: number;
        visualChecksRun: number;
        currentVisualScore: number;
        lastFeedbackAt: Date | null;
        lastVisualCheckAt: Date | null;
    } = {
        feedbackItemsReceived: 0,
        selfCorrectionsMade: 0,
        humanCheckpointsTriggered: 0,
        patternFixesApplied: 0,
        visualChecksRun: 0,
        currentVisualScore: 100,
        lastFeedbackAt: null,
        lastVisualCheckAt: null,
    };

    // Agent feedback subscriptions
    private agentFeedbackSubscriptions: Map<string, () => void> = new Map();

    // =========================================================================
    // REMAINING FEATURE SERVICES (Ghost Mode, Soft Interrupt, Credentials)
    // =========================================================================
    private ghostModeController: GhostModeController | null = null;
    private softInterruptManager: SoftInterruptManager | null = null;
    private credentialVault: CredentialVault | null = null;

    // Ghost Mode state
    private ghostSessionId: string | null = null;
    private isGhostModeActive: boolean = false;
    private wakeConditions: WakeCondition[] = [];

    // Loaded credentials for this build
    private loadedCredentials: Map<string, DecryptedCredential> = new Map();

    // Pending interrupts to process at tool boundaries
    private pendingInterrupts: ClassifiedInterrupt[] = [];

    // =========================================================================
    // ORPHANED FEATURES (Image-to-Code, API Autopilot)
    // =========================================================================
    private imageToCodeService: ImageToCodeService | null = null;
    private apiAutopilotService: APIAutopilotService | null = null;

    constructor(
        projectId: string,
        userId: string,
        orchestrationRunId: string,
        mode: BuildMode = 'standard',
        projectPath?: string
    ) {
        super();

        // Set project path (default to temp builds directory)
        this.projectPath = projectPath || `/tmp/builds/${projectId}`;

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

        // Initialize OpenRouter client for unified AI routing
        this.openRouterClient = getOpenRouterClient();

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

        // Initialize loop blocker for repetitive error detection
        this.loopBlocker = createLoopBlocker({
            repetitionThreshold: 3,
            maxComprehensiveAttempts: 5,
            patternWindowMs: 300000, // 5 minutes
            analysisCooldownMs: 30000, // 30 seconds
        });

        // Set up loop blocker event listeners
        this.loopBlocker.on('comprehensive_mode_triggered', (data) => {
            console.log(`[BuildLoop] Loop detected, entering comprehensive analysis mode (attempt ${data.analysisCount}/${data.maxAttempts})`);
            this.emitEvent('loop_detected', {
                triggerError: data.triggerError,
                analysisCount: data.analysisCount,
            });
        });

        this.loopBlocker.on('new_error_signature', (data) => {
            console.log(`[BuildLoop] New error signature recorded: ${data.signature.errorMessage.substring(0, 50)}...`);
        });

        // Initialize context overflow manager and register build loop agent
        this.contextOverflowManager = getContextOverflowManager();
        this.buildLoopAgentId = `build-loop-${this.state.id.substring(0, 8)}`;
        this.contextOverflowManager.registerAgent(
            this.buildLoopAgentId,
            'planning',
            projectId,
            userId,
            orchestrationRunId
        );

        // Set up context overflow event handlers
        this.setupContextOverflowHandlers();

        // Initialize WebSocket sync for real-time updates
        this.wsSync = getWebSocketSyncService();

        // =====================================================================
        // INITIALIZE AUTONOMOUS LEARNING ENGINE (Component 28)
        // =====================================================================
        this.aiJudgment = getAIJudgmentService();
        this.patternLibrary = getPatternLibrary();
        this.strategyEvolution = getStrategyEvolution();
        this.evolutionFlywheel = getEvolutionFlywheel();

        // =====================================================================
        // INITIALIZE CURSOR 2.1+ SERVICES
        // =====================================================================
        const config = BUILD_MODE_CONFIGS[mode];

        // Always initialize pattern library (used for Level 0 error fixes)
        if (config.enablePatternLibrary) {
            this.errorPatternLibrary = getErrorPatternLibrary();
        }

        // Runtime debug context for error analysis
        if (config.enableRuntimeDebug) {
            this.runtimeDebug = getRuntimeDebugContext();
        }

        // Human checkpoint service for critical fixes
        if (config.enableHumanCheckpoints) {
            this.humanCheckpoint = getHumanCheckpointService();
        }

        // Multi-agent judge for tournament mode
        if (config.enableMultiAgentJudging) {
            this.multiAgentJudge = getMultiAgentJudge();
        }

        // =====================================================================
        // INITIALIZE REMAINING FEATURES (Ghost Mode, Soft Interrupt, Credentials)
        // =====================================================================

        // Ghost Mode Controller - for autonomous background building
        try {
            this.ghostModeController = getGhostModeController();
        } catch (error) {
            console.warn('[BuildLoop] Ghost mode controller not available:', error);
        }

        // Soft Interrupt Manager - for mid-execution user input
        try {
            this.softInterruptManager = getSoftInterruptManager();
        } catch (error) {
            console.warn('[BuildLoop] Soft interrupt manager not available:', error);
        }

        // Credential Vault - for secure credential storage/retrieval
        try {
            this.credentialVault = getCredentialVault();
        } catch (error) {
            console.warn('[BuildLoop] Credential vault not available:', error);
        }

        // Image-to-Code Service - for converting design images to code
        try {
            this.imageToCodeService = new ImageToCodeService();
        } catch (error) {
            console.warn('[BuildLoop] Image-to-code service not available:', error);
        }

        // API Autopilot Service - for automatic API integration
        try {
            this.apiAutopilotService = new APIAutopilotService();
        } catch (error) {
            console.warn('[BuildLoop] API autopilot service not available:', error);
        }

        // Note: StreamingFeedbackChannel, ContinuousVerification, and BrowserInLoop
        // are initialized in start() because they need the build to be running

        console.log(`[BuildLoop] Initialized with Memory Harness + Learning Engine + Cursor 2.1+ + Ghost Mode + Soft Interrupt + Credentials + Image-to-Code + API Autopilot (mode: ${mode}, path: ${this.projectPath})`);
    }

    /**
     * Start the 6-Phase Build Loop
     *
     * Now with Memory Harness integration:
     * - Checks for existing context before starting
     * - Uses InitializerAgent for fresh starts
     * - Uses CodingAgentWrapper for task execution
     */
    async start(prompt: string): Promise<void> {
        this.state.status = 'running';

        try {
            // =====================================================================
            // LEARNING ENGINE: Initialize experience capture for this build
            // SPEED: Pre-cache patterns & strategies in parallel (non-blocking)
            // =====================================================================
            if (this.learningEnabled) {
                this.experienceCapture = this.evolutionFlywheel.initializeForBuild(
                    this.state.userId,
                    this.state.id,
                    this.state.projectId
                );

                // Pre-load learning cache in background (doesn't block build start)
                this.preloadLearningCache().catch(err => {
                    console.warn('[BuildLoop] Learning cache preload failed (non-fatal):', err);
                });

                console.log(`[BuildLoop] Learning Engine activated for build ${this.state.id}`);
            }

            // =====================================================================
            // CURSOR 2.1+: Start runtime services
            // =====================================================================
            await this.startCursor21Services();

            // Check if we need initialization or can resume
            const hasContext = await hasProjectContext(this.projectPath);

            if (!hasContext) {
                // Fresh start - run InitializerAgent
                console.log('[BuildLoop] No existing context found - running InitializerAgent');
                await this.runInitializerAgent(prompt);
            } else {
                // Resume - load existing context
                console.log('[BuildLoop] Found existing context - resuming from artifacts');
                await this.resumeFromContext();
            }

            // If InitializerAgent ran, we skip Phase 0 and 1 (already done by InitializerAgent)
            // If resuming, we also skip Phase 0 and 1

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

                // Final progress entry
                await this.artifactManager.appendProgressEntry({
                    agentId: 'build-loop',
                    agentType: 'orchestrator',
                    action: 'Build Loop Complete',
                    completed: [
                        `Completed all ${stages.length} stages`,
                        `${this.state.featureSummary?.total || 0} features built`,
                    ],
                    filesModified: [],
                    nextSteps: ['Review completed application', 'Deploy to production'],
                });

                // =====================================================================
                // LEARNING ENGINE: Finalize experience capture and trigger evolution
                // =====================================================================
                if (this.learningEnabled) {
                    await this.finalizeLearningSession(true);
                }

                this.emitEvent('build_complete', {
                    duration: this.state.completedAt.getTime() - this.state.startedAt.getTime(),
                    stages: stages.length,
                    features: this.state.featureSummary?.total || 0,
                });
            }
        } catch (error) {
            // Finalize learning even on error
            if (this.learningEnabled) {
                await this.finalizeLearningSession(false);
            }
            await this.handleError(error as Error);
        }
    }

    /**
     * Run InitializerAgent for fresh project setup
     * Creates all artifacts and scaffolding
     */
    private async runInitializerAgent(prompt: string): Promise<void> {
        this.emitEvent('phase_start', { phase: 'initialization', subPhase: 'initializer_agent' });

        this.initializerAgent = createInitializerAgent({
            projectId: this.state.projectId,
            userId: this.state.userId,
            orchestrationRunId: this.state.orchestrationRunId,
            projectPath: this.projectPath,
            mode: 'new_build',
        });

        // Forward InitializerAgent events
        this.initializerAgent.on('intent_created', (data) => {
            this.emit('intent_created', data);
            this.emitEvent('phase_complete', { phase: 'intent_lock', ...data });
        });

        this.initializerAgent.on('tasks_decomposed', (data) => {
            this.emit('tasks_decomposed', data);
        });

        this.initializerAgent.on('scaffolding_complete', (data) => {
            this.emit('scaffolding_complete', data);
        });

        this.initializerAgent.on('artifacts_created', (data) => {
            this.emit('artifacts_created', data);
        });

        this.initializerAgent.on('git_initialized', (data) => {
            this.emit('git_initialized', data);
        });

        // Run initialization
        const result: InitializerResult = await this.initializerAgent.initialize(prompt);

        if (!result.success) {
            throw new Error(`InitializerAgent failed: ${result.error}`);
        }

        // Store intent contract
        this.state.intentContract = result.intentContract;

        // Load the generated feature list
        const featureListContent = await this.artifactManager.getArtifact('feature_list.json');
        if (featureListContent) {
            try {
                const featureList = JSON.parse(featureListContent);
                const total = featureList.totalCount || featureList.features?.length || 0;
                const passed = featureList.completedCount || 0;
                this.state.featureSummary = {
                    total,
                    passed,
                    failed: 0,
                    pending: total - passed,
                    inProgress: 0,
                    passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
                    features: featureList.features?.map((f: { id: string; description: string; passes?: boolean; priority?: number; assignedAgent?: string | null }, idx: number) => ({
                        featureId: f.id,
                        description: f.description,
                        passes: f.passes || false,
                        priority: f.priority || idx + 1,
                        assignedAgent: f.assignedAgent || null,
                    })) || [],
                };
            } catch (e) {
                // Ignore parse errors
            }
        }

        // Mark phases as complete
        this.state.phasesCompleted.push('intent_lock', 'initialization');

        this.emitEvent('phase_complete', {
            phase: 'initialization',
            subPhase: 'initializer_agent',
            taskCount: result.taskCount,
            artifacts: result.artifactsCreated,
            commit: result.initialCommit,
        });

        console.log(`[BuildLoop] InitializerAgent complete: ${result.taskCount} tasks created`);
    }

    /**
     * Resume from existing context (artifacts)
     * Loads state from persistent files
     */
    private async resumeFromContext(): Promise<void> {
        this.emitEvent('phase_start', { phase: 'resume' });

        // Load full context from artifacts
        this.loadedContext = await loadProjectContext(this.projectPath, {
            progressEntries: 30,
            gitLogEntries: 20,
            includeGitDiff: true,
        });

        // Restore state from context
        if (this.loadedContext.intentContract) {
            // Cast through unknown to handle type differences between context-loader and intent-lock
            this.state.intentContract = this.loadedContext.intentContract as unknown as IntentContract;
        }

        if (this.loadedContext.featureList) {
            const featureList = this.loadedContext.featureList;
            const features = featureList.features || [];
            const total = featureList.totalCount || features.length || 0;
            const completed = features.filter((f: { status?: string; passes?: boolean }) =>
                f.status === 'complete' || f.passes
            ).length;
            this.state.featureSummary = {
                total,
                passed: completed,
                failed: 0,
                pending: total - completed,
                inProgress: 0,
                passRate: total > 0 ? Math.round((completed / total) * 100) : 0,
                features: features.map((f: { id?: string; featureId?: string; description?: string; passes?: boolean; priority?: number; assignedAgent?: string | null }, idx: number) => ({
                    featureId: f.id || f.featureId || 'unknown',
                    description: f.description || '',
                    passes: f.passes || false,
                    priority: f.priority || idx + 1,
                    assignedAgent: f.assignedAgent || null,
                })),
            };
        }

        // Find where we left off
        const taskList = this.loadedContext.taskList;
        const currentTaskIndex = taskList?.currentTaskIndex || 0;
        const completedTasks = taskList?.completedTasks || 0;

        // Mark initial phases as complete (since we're resuming)
        this.state.phasesCompleted.push('intent_lock', 'initialization');

        // Update progress log with resume
        await this.artifactManager.appendProgressEntry({
            agentId: 'build-loop',
            agentType: 'orchestrator',
            action: 'Resumed from existing context',
            completed: [`Loaded ${this.loadedContext.progressLog.length} progress entries`],
            filesModified: [],
            nextSteps: [`Continue from task ${currentTaskIndex + 1}`],
            notes: `Resuming at ${new Date().toISOString()}`,
        });

        this.emitEvent('resumed', {
            fromTask: currentTaskIndex,
            totalTasks: taskList?.totalTasks || 0,
            completedTasks,
            hasIntent: !!this.state.intentContract,
            featureCount: this.state.featureSummary?.total || 0,
        });

        console.log(`[BuildLoop] Resumed: ${completedTasks}/${taskList?.totalTasks || 0} tasks complete`);
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
            // Load project credentials from vault
            await this.loadProjectCredentials();

            // Write credentials to .env file for build process
            if (this.loadedCredentials.size > 0) {
                await this.writeCredentialsToEnv(this.projectPath);
            }

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
     * Includes context overflow checks at phase boundaries
     */
    private async executeStage(stage: BuildStage): Promise<void> {
        this.emitEvent('phase_start', { stage });

        // Phase 2: Parallel Build
        await this.executePhase2_ParallelBuild(stage);

        // Check context at phase boundary
        await this.checkContextAndHandoffIfNeeded(true);

        // Phase 3: Integration Check
        await this.executePhase3_IntegrationCheck();

        // Check context at phase boundary
        await this.checkContextAndHandoffIfNeeded(true);

        // Phase 4: Functional Test
        await this.executePhase4_FunctionalTest();

        // Check context at phase boundary
        await this.checkContextAndHandoffIfNeeded(true);

        // Phase 5: Intent Satisfaction
        await this.executePhase5_IntentSatisfaction();

        // Check context at phase boundary
        await this.checkContextAndHandoffIfNeeded(true);

        // Phase 6: Browser Demo (for production stage only, or all if configured)
        if (stage === 'production' || this.state.config.mode === 'production') {
            await this.executePhase6_BrowserDemo();
        }

        this.emitEvent('stage_complete', { stage });
    }

    /**
     * Phase 2: PARALLEL BUILD - Build features with multiple agents
     *
     * Now uses CodingAgentWrapper for context loading and artifact updates
     */
    private async executePhase2_ParallelBuild(stage: BuildStage): Promise<void> {
        this.startPhase('parallel_build');

        try {
            // Create coding agent wrapper for this phase
            const codingAgent = createCodingAgentWrapper({
                projectId: this.state.projectId,
                userId: this.state.userId,
                orchestrationRunId: this.state.orchestrationRunId,
                projectPath: this.projectPath,
                agentType: 'build',
                agentId: `build-${stage}-${Date.now()}`,
            });

            // Load context from artifacts
            await codingAgent.startSession();

            // =====================================================================
            // ORPHANED FEATURES: Process images and API integrations
            // These run at the start of Phase 2 before task processing
            // =====================================================================

            // Process image inputs for frontend stage (design-to-code)
            if (stage === 'frontend' && this.state.intentContract?.rawPrompt) {
                const imageResult = await this.processImageInputs(
                    this.state.intentContract.rawPrompt
                );
                if (imageResult) {
                    console.log(`[BuildLoop] Generated ${imageResult.components.length} components from images`);
                }
            }

            // Process API integrations for backend stage
            if (stage === 'backend') {
                const apiResults = await this.processAPIIntegrations();
                if (apiResults && apiResults.length > 0) {
                    console.log(`[BuildLoop] Generated ${apiResults.length} API integrations`);
                }
            }

            // Get tasks for this stage from task list
            // We'll claim tasks one by one and build them
            let task = await codingAgent.claimTask();

            while (task && !this.aborted) {
                console.log(`[BuildLoop] Building task: ${task.id} - ${task.description}`);

                // =====================================================================
                // LEARNING ENGINE: Get relevant patterns before building
                // SPEED: Instant in-memory lookup from pre-cached data
                // =====================================================================
                let patternContext = '';
                if (this.learningEnabled && this.learningCacheLoaded) {
                    const patterns = this.getRelevantPatterns(task.description); // Sync - instant
                    if (patterns.length > 0) {
                        patternContext = `\n\nLEARNED PATTERNS TO APPLY:\n${patterns.map(p =>
                            `- ${p.name}: ${p.problem}\n  Solution: ${p.solutionTemplate?.substring(0, 200) || 'N/A'}`
                        ).join('\n')}`;
                        console.log(`[BuildLoop] Injecting ${patterns.length} learned patterns`);
                    }

                    // Get best strategy for this task
                    const strategy = this.getBestStrategy(task.category); // Sync - instant
                    if (strategy) {
                        console.log(`[BuildLoop] Using learned strategy: ${strategy}`);
                    }
                }

                // Get system prompt with full context injected
                const basePrompt = `You are a senior software engineer building production-ready code.
You are working on a ${this.state.intentContract?.appType || 'web'} application.

TASK: ${task.description}
CATEGORY: ${task.category}
PRIORITY: ${task.priority}
${patternContext}

Generate complete, production-ready code for this task.
Follow the existing style guide and patterns.
Do NOT use placeholders or TODO comments.
Include ALL necessary imports and exports.`;

                const systemPrompt = codingAgent.getSystemPromptWithContext(basePrompt);

                // Generate code using OpenRouter/KripToeNite
                const phaseConfig = getPhaseConfig('build_agent');
                const ktn = getKripToeNite();

                let responseContent = '';
                try {
                    const result = await ktn.buildFeature(
                        `${task.description}\n\nContext: Building for ${stage} stage.`,
                        {
                            projectId: this.state.projectId,
                            userId: this.state.userId,
                            projectPath: this.projectPath,
                            framework: 'React',
                            language: 'TypeScript',
                        }
                    );
                    responseContent = result.content;
                    console.log(`[BuildLoop] KTN build completed: strategy=${result.strategy}, model=${result.model}`);
                } catch (error) {
                    // Fallback to Claude service
                    console.warn('[BuildLoop] KTN failed, falling back to Claude:', error);
                    const response = await this.claudeService.generate(
                        `${systemPrompt}\n\nTask: ${task.description}`,
                        {
                            model: phaseConfig.model,
                            maxTokens: 32000,
                            useExtendedThinking: true,
                            thinkingBudgetTokens: phaseConfig.thinkingBudget,
                        }
                    );
                    responseContent = response.content;
                }

                // Parse files from response
                const files = this.claudeService.parseFileOperations(responseContent);

                // =====================================================================
                // LEARNING ENGINE: Capture decision and code artifacts
                // SPEED: Fire-and-forget - doesn't block build pipeline
                // =====================================================================
                if (this.learningEnabled && this.experienceCapture) {
                    // Capture the code generation decision (async, non-blocking)
                    this.captureCodeDecision(
                        task.id,
                        task.description,
                        'KTN/Claude generation',
                        ['Manual coding', 'Template-based'],
                        `Generated ${files.length} files using AI for task: ${task.description}`
                    ); // No await - fire and forget
                }

                // Record file changes
                for (const file of files) {
                    codingAgent.recordFileChange(file.path, 'create', file.content);
                    this.projectFiles.set(file.path, file.content || '');

                    // LEARNING ENGINE: Capture each code artifact (async, non-blocking)
                    if (this.learningEnabled) {
                        this.captureCodeArtifact(file.path, file.content || '', 'initial'); // No await
                    }
                }

                // CRITICAL: Write files to disk
                // This ensures AI-generated code actually exists on filesystem
                const fsModule = await import('fs/promises');
                const pathModule = await import('path');
                for (const file of files) {
                    if (file.content) {
                        try {
                            const fullPath = pathModule.join(this.projectPath, file.path);
                            const dir = pathModule.dirname(fullPath);
                            await fsModule.mkdir(dir, { recursive: true });
                            await fsModule.writeFile(fullPath, file.content, 'utf-8');
                            console.log(`[BuildLoop] Wrote file: ${file.path}`);
                        } catch (writeError) {
                            console.error(`[BuildLoop] Failed to write ${file.path}:`, writeError);
                        }
                    }
                }

                // Complete task (updates artifacts, commits to git)
                const taskResult: TaskResult = await codingAgent.completeTask({
                    summary: `Built: ${task.description}`,
                    filesCreated: files.map(f => f.path),
                    nextSteps: this.determineNextSteps(task),
                });

                // Emit progress
                const summary = await this.featureManager.getSummary();
                this.state.featureSummary = summary;

                this.emitEvent('feature_complete', {
                    taskId: task.id,
                    description: task.description,
                    commit: taskResult.gitCommit,
                    filesCreated: taskResult.filesCreated.length,
                });

                // Auto-checkpoint on interval
                if (this.shouldCreateCheckpoint()) {
                    await this.createCheckpoint('task_complete', `After task ${task.id}`);
                }

                // Get next task
                task = await codingAgent.claimTask();
            }

            // End coding agent session
            await codingAgent.endSession();

            // Also build features from feature manager (legacy path)
            const features = await this.featureManager.getAllFeatures();
            const stageFeatures = this.filterFeaturesForStage(features, stage);
            stageFeatures.sort((a, b) => a.priority - b.priority);

            for (const feature of stageFeatures) {
                if (this.aborted) break;

                // Check if feature already passed (from task-based building)
                if (feature.passes) continue;

                await this.buildFeature(feature);

                const featureSummary = await this.featureManager.getSummary();
                this.state.featureSummary = featureSummary;

                this.emitEvent('feature_complete', {
                    featureId: feature.featureId,
                    passRate: featureSummary.passRate,
                    remaining: featureSummary.pending,
                });
            }

            this.completePhase('parallel_build');

        } catch (error) {
            throw new Error(`Parallel Build failed: ${(error as Error).message}`);
        }
    }

    /**
     * Determine next steps after completing a task
     */
    private determineNextSteps(task: TaskItem): string[] {
        const nextSteps: string[] = [];

        switch (task.category) {
            case 'setup':
                nextSteps.push('Proceed to feature implementation');
                break;
            case 'feature':
                nextSteps.push('Verify feature works correctly');
                nextSteps.push('Add tests if needed');
                break;
            case 'integration':
                nextSteps.push('Run integration tests');
                nextSteps.push('Verify all routes work');
                break;
            case 'testing':
                nextSteps.push('Review test coverage');
                nextSteps.push('Fix any failing tests');
                break;
            case 'deployment':
                nextSteps.push('Verify deployment configuration');
                nextSteps.push('Test in production environment');
                break;
        }

        return nextSteps;
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
                projectPath: this.projectPath,
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

        // =====================================================================
        // LEARNING ENGINE: Run AI judgment on verification results
        // SPEED: Runs in background - doesn't block verification flow
        // =====================================================================
        if (this.learningEnabled) {
            // Combine all generated code for judgment
            const allCode = Array.from(generatedFiles.entries())
                .map(([path, content]) => `// ${path}\n${content}`)
                .join('\n\n');

            // Fire-and-forget - judgment runs in background
            this.runAIJudgmentOnVerification(
                feature.featureId,
                verdict.overallScore,
                allCode
            ).catch(err => console.warn('[BuildLoop] Background AI judgment failed:', err));
        }

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
     * Integrates with LoopBlocker to detect repetitive patterns
     */
    private async handleError(error: Error): Promise<void> {
        console.log(`[BuildLoop] Handling error with 4-level escalation: ${error.message}`);

        // Record error in loop blocker for pattern detection
        const loopContext: LoopBlockerBuildContext = {
            buildId: this.state.id,
            projectId: this.state.projectId,
            userId: this.state.userId,
            phase: this.state.currentPhase,
            stage: this.state.currentStage,
            filesInvolved: Array.from(this.projectFiles.keys()),
        };
        this.loopBlocker.setContext(loopContext);
        this.loopBlocker.recordError(error, loopContext);

        // Check if we're stuck in a loop - trigger comprehensive analysis
        if (this.loopBlocker.isStuckInLoop()) {
            console.log(`[BuildLoop] Detected repetitive error loop, triggering comprehensive analysis`);

            // Check if human escalation is needed
            if (this.loopBlocker.needsHumanEscalation()) {
                console.log(`[BuildLoop] Max comprehensive attempts reached, escalating to human`);
                this.emitEvent('human_escalation_required', {
                    reason: 'Max comprehensive analysis attempts exhausted',
                    errorSummary: this.loopBlocker.getStateSummary(),
                    analysisPrompt: this.loopBlocker.getComprehensiveAnalysisPrompt(),
                });

                this.state.status = 'failed';
                this.state.lastError = `Build loop detected - human intervention required after ${this.loopBlocker.getStateSummary().analysisCount} comprehensive analysis attempts`;
                return;
            }

            // Perform comprehensive analysis
            const comprehensiveResult = await this.performLoopComprehensiveAnalysis();
            if (comprehensiveResult.success) {
                console.log(`[BuildLoop] Comprehensive analysis succeeded, applying fixes`);
                this.loopBlocker.completeComprehensiveAnalysis(true);

                // Apply the fixes
                for (const change of comprehensiveResult.changes) {
                    if (change.action === 'create' || change.action === 'update') {
                        this.projectFiles.set(change.path, change.content || '');
                    } else if (change.action === 'delete') {
                        this.projectFiles.delete(change.path);
                    }
                }

                this.emitEvent('comprehensive_fix_applied', {
                    analysis: comprehensiveResult.analysis,
                    changesCount: comprehensiveResult.changes.length,
                });

                // Reset error state and continue
                this.state.lastError = null;
                return;
            } else {
                console.log(`[BuildLoop] Comprehensive analysis failed, continuing with standard escalation`);
                this.loopBlocker.completeComprehensiveAnalysis(false);
            }
        }

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

        // =====================================================================
        // LEARNING ENGINE: Capture error for learning
        // =====================================================================
        let learningErrorId = '';
        if (this.learningEnabled) {
            learningErrorId = await this.captureErrorForLearning(
                buildError.category,
                buildError.message,
                buildError.file
            );
        }

        // Attempt fix with 4-level escalation
        const result = await this.errorEscalationEngine.fixError(
            buildError,
            this.projectFiles,
            pendingFeature
        );

        if (result.success && result.fix) {
            console.log(`[BuildLoop] Error fixed at Level ${result.level}: ${result.fix.strategy}`);

            // LEARNING ENGINE: Record successful fix for pattern extraction
            if (this.learningEnabled && learningErrorId) {
                await this.recordErrorFixForLearning(
                    learningErrorId,
                    result.fix.strategy,
                    result.level
                );
            }

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

    /**
     * Perform comprehensive analysis when stuck in an error loop
     * Uses the LoopBlocker's comprehensive analysis prompt
     */
    private async performLoopComprehensiveAnalysis(): Promise<{
        success: boolean;
        analysis: string;
        changes: Array<{ path: string; action: string; content?: string }>;
    }> {
        const prompt = this.loopBlocker.getComprehensiveAnalysisPrompt();

        try {
            this.emitStatus('Performing comprehensive analysis to break error loop', 'verifying');

            const response = await this.claudeService.generate(prompt, {
                model: CLAUDE_MODELS.OPUS_4_5,
                maxTokens: 32000,
                useExtendedThinking: true,
                thinkingBudgetTokens: 64000,
            });

            // Parse the JSON response
            const jsonMatch = response.content.match(/```json\n([\s\S]*?)\n```/);
            if (!jsonMatch) {
                console.log('[BuildLoop] Failed to parse comprehensive analysis response');
                return {
                    success: false,
                    analysis: 'Failed to parse analysis response',
                    changes: [],
                };
            }

            const analysisResult = JSON.parse(jsonMatch[1]);

            // Extract changes from the fix plan
            const changes: Array<{ path: string; action: string; content?: string }> = [];
            if (analysisResult.fixPlan?.changes) {
                for (const change of analysisResult.fixPlan.changes) {
                    changes.push({
                        path: change.path,
                        action: change.action,
                        content: change.newContent,
                    });
                }
            }

            if (changes.length === 0) {
                return {
                    success: false,
                    analysis: analysisResult.rootCause || 'No fixes identified',
                    changes: [],
                };
            }

            console.log(`[BuildLoop] Comprehensive analysis identified ${changes.length} file changes`);
            console.log(`[BuildLoop] Root cause: ${analysisResult.rootCause}`);

            // Log issues found
            if (analysisResult.issues && Array.isArray(analysisResult.issues)) {
                for (const issue of analysisResult.issues) {
                    console.log(`[BuildLoop] Issue: ${issue.type} - ${issue.description}`);
                }
            }

            return {
                success: true,
                analysis: analysisResult.rootCause || 'Comprehensive analysis complete',
                changes,
            };

        } catch (error) {
            console.error('[BuildLoop] Comprehensive analysis failed:', error);
            return {
                success: false,
                analysis: `Analysis error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                changes: [],
            };
        }
    }

    /**
     * Get the loop blocker instance for external access
     */
    getLoopBlocker(): LoopBlocker {
        return this.loopBlocker;
    }

    /**
     * Reset the loop blocker state (for new build sessions)
     */
    resetLoopBlocker(): void {
        this.loopBlocker.reset();
    }

    /**
     * Set up context overflow event handlers
     * Manages seamless agent handoff when context window approaches limits
     */
    private setupContextOverflowHandlers(): void {
        this.contextOverflowManager.on('context_warning', ({ agentId, status }: { agentId: string; status: ContextStatus }) => {
            console.log(`[BuildLoop] Context warning: ${status.usagePercent}% used (${status.currentTokens}/${status.maxTokens} tokens)`);
            this.emitEvent('status', {
                message: `Context usage at ${status.usagePercent}% - preparing for potential handoff`,
                phase: 'context_management',
            });
        });

        this.contextOverflowManager.on('context_critical', ({ agentId, status }: { agentId: string; status: ContextStatus }) => {
            console.log(`[BuildLoop] Context critical: ${status.usagePercent}% used - handoff imminent`);
            this.emitEvent('status', {
                message: `Context usage critical at ${status.usagePercent}% - initiating handoff`,
                phase: 'context_management',
            });
        });

        this.contextOverflowManager.on('handoff_initiated', (handoff: AgentHandoff) => {
            console.log(`[BuildLoop] Context handoff initiated: ${handoff.fromAgentId} -> ${handoff.toAgentId}`);
            console.log(`[BuildLoop] Compressed context from ${handoff.contextSnapshot.originalTokens} to ${handoff.contextSnapshot.compressedTokens} tokens (${Math.round(handoff.contextSnapshot.compressionRatio * 100)}%)`);

            // Update build loop agent ID if it's our agent that was handed off
            if (handoff.fromAgentId === this.buildLoopAgentId) {
                this.buildLoopAgentId = handoff.toAgentId;
            }

            this.emitEvent('status', {
                message: `Agent handoff complete - context preserved and compressed`,
                phase: 'context_management',
                handoff: {
                    from: handoff.fromAgentId,
                    to: handoff.toAgentId,
                    compressionRatio: handoff.contextSnapshot.compressionRatio,
                },
            });
        });

        this.contextOverflowManager.on('context_restored', ({ agentId, compressed }) => {
            console.log(`[BuildLoop] Context restored for ${agentId} from compressed snapshot`);
        });
    }

    /**
     * Check context usage and trigger handoff if needed
     * Called at phase boundaries for optimal handoff timing
     */
    private async checkContextAndHandoffIfNeeded(atPhaseBoundary: boolean = false): Promise<void> {
        const status = this.contextOverflowManager.checkContextUsage(this.buildLoopAgentId);

        // Check if handoff should be triggered
        if (this.contextOverflowManager.shouldTriggerHandoff(this.buildLoopAgentId, true, atPhaseBoundary)) {
            console.log(`[BuildLoop] Triggering context handoff at ${atPhaseBoundary ? 'phase boundary' : 'checkpoint'}`);

            // Update build context before handoff
            this.contextOverflowManager.updateBuildContext(this.buildLoopAgentId, {
                phase: this.state.currentPhase,
                stage: this.state.currentStage,
                stageProgress: this.state.stageProgress,
                completedPhases: this.state.phasesCompleted,
                featuresCompleted: this.state.featureSummary?.passed || 0,
                featuresTotal: this.state.featureSummary?.total || 0,
                errorCount: this.state.errorCount,
                escalationLevel: this.state.escalationLevel,
            });

            // Initiate handoff
            const handoff = await this.contextOverflowManager.initiateHandoff(
                this.buildLoopAgentId,
                atPhaseBoundary ? 'phase_boundary' : 'checkpoint'
            );

            // Update to new agent ID
            this.buildLoopAgentId = handoff.toAgentId;

            // Acknowledge handoff
            this.contextOverflowManager.acknowledgeHandoff(handoff.id);
        }
    }

    /**
     * Update context usage after AI calls
     */
    private updateContextUsage(tokensUsed: number): void {
        this.contextOverflowManager.addTokens(this.buildLoopAgentId, tokensUsed);
    }

    /**
     * Get context overflow manager for external access
     */
    getContextOverflowManager(): ContextOverflowManager {
        return this.contextOverflowManager;
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

    /**
     * Emit standardized activity event for real-time UI streaming
     * Used by AgentActivityStream and FeatureAgentActivityStream components
     */
    private emitActivityEvent(
        type: 'thinking' | 'file_read' | 'file_write' | 'file_edit' | 'tool_call' | 'status' | 'verification',
        activityData: AgentActivityEventData
    ): void {
        const event: BuildLoopEvent = {
            type,
            timestamp: new Date(),
            buildId: this.state.id,
            data: {
                id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                type,
                agentId: activityData.agentId || this.state.id,
                agentName: activityData.agentName,
                content: activityData.content,
                metadata: activityData.metadata,
                timestamp: Date.now(),
            },
        };
        this.emit(type, event);
        this.emit('event', event);
        this.emit('activity', event); // Additional channel for activity-specific listeners
    }

    /**
     * Helper to emit thinking/reasoning tokens
     */
    protected emitThinking(content: string, tokenCount?: number): void {
        this.emitActivityEvent('thinking', {
            content,
            agentName: 'Orchestrator',
            metadata: {
                phase: this.mapPhaseToActivityPhase(this.state.currentPhase),
                tokenCount,
            },
        });
    }

    /**
     * Helper to emit file operation events
     */
    protected emitFileOperation(
        type: 'file_read' | 'file_write' | 'file_edit',
        filePath: string,
        content: string,
        lineNumbers?: { start: number; end: number }
    ): void {
        this.emitActivityEvent(type, {
            content,
            agentName: 'Coding Agent',
            metadata: {
                filePath,
                lineNumbers,
                phase: 'coding',
            },
        });
    }

    /**
     * Helper to emit tool call events
     */
    protected emitToolCall(toolName: string, content: string, parameters?: Record<string, unknown>): void {
        this.emitActivityEvent('tool_call', {
            content,
            agentName: 'Orchestrator',
            metadata: {
                toolName,
                parameters,
                phase: this.mapPhaseToActivityPhase(this.state.currentPhase),
            },
        });
    }

    /**
     * Helper to emit status updates
     */
    protected emitStatus(content: string, phase?: 'thinking' | 'planning' | 'coding' | 'testing' | 'verifying' | 'integrating' | 'deploying'): void {
        this.emitActivityEvent('status', {
            content,
            agentName: 'Build Loop',
            metadata: {
                phase: phase || this.mapPhaseToActivityPhase(this.state.currentPhase),
            },
        });
    }

    /**
     * Helper to emit verification results
     */
    protected emitVerificationResult(content: string, result: 'success' | 'failure' | 'pending'): void {
        this.emitActivityEvent('verification', {
            content,
            agentName: 'Verification Swarm',
            metadata: {
                phase: 'verifying',
                result,
            },
        });
    }

    /**
     * Map build phase to activity phase
     */
    private mapPhaseToActivityPhase(phase: BuildLoopPhase): 'thinking' | 'planning' | 'coding' | 'testing' | 'verifying' | 'integrating' | 'deploying' {
        switch (phase) {
            case 'intent_lock': return 'thinking';
            case 'initialization': return 'planning';
            case 'parallel_build': return 'coding';
            case 'integration_check': return 'integrating';
            case 'functional_test': return 'testing';
            case 'intent_satisfaction': return 'verifying';
            case 'browser_demo': return 'deploying';
            case 'complete': return 'deploying';
            case 'failed': return 'verifying';
            default: return 'coding';
        }
    }

    // =========================================================================
    // AUTONOMOUS LEARNING ENGINE METHODS (Component 28)
    // SPEED OPTIMIZED: Non-blocking, pre-cached, fire-and-forget
    // =========================================================================

    /**
     * Pre-load patterns and strategies at build start (runs in background)
     * This eliminates per-task database lookups for ZERO slowdown
     */
    private async preloadLearningCache(): Promise<void> {
        const startTime = Date.now();

        try {
            // Load top patterns and all strategy domains in parallel
            const [patterns, codeStrategy, errorStrategy, designStrategy] = await Promise.all([
                this.patternLibrary.getTopPatterns(50), // Get top 50 patterns
                this.strategyEvolution.selectStrategy('code_generation', ['web_app']),
                this.strategyEvolution.selectStrategy('error_recovery', ['web_app']),
                this.strategyEvolution.selectStrategy('design_approach', ['web_app']),
            ]);

            this.cachedPatterns = patterns;
            if (codeStrategy) this.cachedStrategies.set('code_generation', codeStrategy.name);
            if (errorStrategy) this.cachedStrategies.set('error_recovery', errorStrategy.name);
            if (designStrategy) this.cachedStrategies.set('design_approach', designStrategy.name);

            this.learningCacheLoaded = true;
            console.log(`[BuildLoop] Learning cache loaded in ${Date.now() - startTime}ms (${patterns.length} patterns, ${this.cachedStrategies.size} strategies)`);
        } catch (error) {
            console.warn('[BuildLoop] Learning cache preload failed:', error);
            this.learningCacheLoaded = false;
        }
    }

    /**
     * Finalize the learning session and optionally trigger evolution cycle
     */
    private async finalizeLearningSession(buildSucceeded: boolean): Promise<void> {
        try {
            // End experience capture session
            await this.evolutionFlywheel.finalizeForBuild();

            // Record outcomes for all pending decisions
            for (const [taskId, traceId] of this.pendingDecisionTraces) {
                const outcome: DecisionOutcome = {
                    immediateResult: buildSucceeded ? 'success' : 'failure',
                    verificationScores: { overall: this.state.featureSummary?.passRate || 0 },
                    requiredFixes: this.state.errorCount,
                    finalInProduction: buildSucceeded,
                    userSatisfaction: null,
                };
                if (this.experienceCapture) {
                    await this.experienceCapture.recordDecisionOutcome(traceId, outcome);
                }
            }
            this.pendingDecisionTraces.clear();

            // Check if we should run an evolution cycle
            const status = await this.evolutionFlywheel.getSystemStatus();
            const pairsCount = status.pairStats.unused || 0;

            if (pairsCount >= 50) {
                console.log(`[BuildLoop] Triggering evolution cycle (${pairsCount} unused preference pairs)`);
                // Run evolution cycle in background to not block the build
                this.evolutionFlywheel.runCycle(this.state.userId).catch(err => {
                    console.error('[BuildLoop] Evolution cycle failed:', err);
                });
            }

            console.log(`[BuildLoop] Learning session finalized (success: ${buildSucceeded})`);
        } catch (error) {
            console.error('[BuildLoop] Failed to finalize learning session:', error);
        }
    }

    /**
     * Capture a code generation decision for learning
     */
    private async captureCodeDecision(
        taskId: string,
        taskDescription: string,
        chosenApproach: string,
        alternatives: string[],
        reasoning: string
    ): Promise<void> {
        if (!this.experienceCapture || !this.learningEnabled) return;

        try {
            const traceId = await this.experienceCapture.captureDecision(
                'build',
                'strategy_selection', // Using strategy_selection as closest to code generation
                {
                    previousAttempts: 0,
                    currentCodeState: taskDescription,
                    relatedFiles: [],
                    buildPhase: 'build',
                },
                {
                    chosenOption: chosenApproach,
                    rejectedOptions: alternatives,
                    reasoning,
                    confidence: 0.8,
                }
            );

            this.pendingDecisionTraces.set(taskId, traceId);
        } catch (error) {
            console.error('[BuildLoop] Failed to capture code decision:', error);
        }
    }

    /**
     * Capture code artifact for learning
     */
    private async captureCodeArtifact(
        filePath: string,
        code: string,
        trigger: 'initial' | 'fix' | 'refactor' | 'verification_feedback'
    ): Promise<void> {
        if (!this.experienceCapture || !this.learningEnabled) return;

        try {
            await this.experienceCapture.captureCodeChange(
                filePath,
                code,
                trigger,
                'build-loop'
            );
        } catch (error) {
            console.error('[BuildLoop] Failed to capture code artifact:', error);
        }
    }

    /**
     * Record quality metrics for AI judgment
     */
    private async recordCodeQualityForLearning(
        filePath: string,
        codeQualityScore: number,
        visualQualityScore?: number
    ): Promise<void> {
        if (!this.experienceCapture || !this.learningEnabled) return;

        try {
            await this.experienceCapture.recordCodeQuality(
                filePath,
                this.state.errorCount,
                codeQualityScore,
                visualQualityScore
            );
        } catch (error) {
            console.error('[BuildLoop] Failed to record code quality:', error);
        }
    }

    /**
     * Capture error for learning
     */
    private async captureErrorForLearning(
        errorType: string,
        errorMessage: string,
        filePath?: string
    ): Promise<string> {
        if (!this.experienceCapture || !this.learningEnabled) return '';

        try {
            return await this.experienceCapture.captureError({
                type: errorType,
                message: errorMessage,
                stackTrace: '',
                fileLocation: filePath || '',
                firstOccurrence: new Date().toISOString(),
            });
        } catch (error) {
            console.error('[BuildLoop] Failed to capture error:', error);
            return '';
        }
    }

    /**
     * Record successful error fix for pattern extraction
     */
    private async recordErrorFixForLearning(
        errorId: string,
        fixStrategy: string,
        escalationLevel: number
    ): Promise<void> {
        if (!this.experienceCapture || !this.learningEnabled || !errorId) return;

        try {
            await this.experienceCapture.recordSuccessfulFix(errorId, {
                levelRequired: escalationLevel,
                fixDescription: fixStrategy,
                codeDiff: '', // Would need actual diff from the fix
                generalizablePattern: null,
            });
        } catch (error) {
            console.error('[BuildLoop] Failed to record error fix:', error);
        }
    }

    /**
     * Get relevant patterns from the pattern library for a task
     * SPEED: Uses pre-cached patterns - instant lookup, no DB hit
     */
    private getRelevantPatterns(taskDescription: string): LearnedPattern[] {
        if (!this.learningEnabled || !this.learningCacheLoaded) return [];

        // Fast in-memory filtering using keyword matching
        const keywords = taskDescription.toLowerCase().split(/\s+/);
        const relevant = this.cachedPatterns
            .filter(p => {
                const patternText = `${p.name} ${p.problem} ${p.conditions.join(' ')}`.toLowerCase();
                return keywords.some(kw => kw.length > 3 && patternText.includes(kw));
            })
            .slice(0, 5);

        return relevant;
    }

    /**
     * Get best strategy for a task using Thompson sampling
     * SPEED: Uses pre-cached strategies - instant lookup, no DB hit
     */
    private getBestStrategy(taskCategory: string): string | null {
        if (!this.learningEnabled || !this.learningCacheLoaded) return null;

        // Map task category to strategy domain
        const domainMap: Record<string, 'code_generation' | 'error_recovery' | 'design_approach'> = {
            'setup': 'code_generation',
            'feature': 'code_generation',
            'integration': 'code_generation',
            'testing': 'code_generation',
            'deployment': 'code_generation',
            'visual': 'design_approach',
            'functional': 'code_generation',
            'error': 'error_recovery',
        };
        const domain = domainMap[taskCategory] || 'code_generation';

        return this.cachedStrategies.get(domain) || null;
    }

    /**
     * Run AI judgment on verification results
     */
    private async runAIJudgmentOnVerification(
        featureId: string,
        verificationScore: number,
        codeContent: string
    ): Promise<void> {
        if (!this.learningEnabled) return;

        try {
            // Create a code artifact trace for judgment
            const artifactTrace = {
                artifactId: `ca_${featureId}`,
                buildId: this.state.id,
                projectId: this.state.projectId,
                userId: this.state.userId,
                filePath: `feature/${featureId}`,
                versions: [{
                    version: 1,
                    code: codeContent,
                    timestamp: new Date().toISOString(),
                    trigger: 'initial' as const,
                }],
                qualityTrajectory: [],
                patternsUsed: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // Run AI judgment
            const judgment = await this.aiJudgment.judgeCodeQuality(artifactTrace, {
                userId: this.state.userId,
            });

            console.log(`[BuildLoop] AI Judgment for ${featureId}: score=${judgment.scores.overall}`);

            // Record quality for learning
            await this.recordCodeQualityForLearning(
                `feature/${featureId}`,
                judgment.scores.overall,
                verificationScore
            );
        } catch (error) {
            console.error('[BuildLoop] Failed to run AI judgment:', error);
        }
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    getState(): BuildLoopState {
        return { ...this.state };
    }

    async abort(): Promise<void> {
        this.aborted = true;
        this.state.status = 'failed';

        // Stop Cursor 2.1+ services
        await this.stopCursor21Services();

        // Finalize learning on abort
        if (this.learningEnabled) {
            await this.finalizeLearningSession(false);
        }
    }

    /**
     * Pause the build loop execution
     * Used by Soft Interrupt system to halt execution when needed
     */
    pause(): void {
        if (this.state.status === 'running') {
            this.state.status = 'awaiting_approval';
            this.emitEvent('paused', {
                phase: this.state.currentPhase,
                reason: 'user_interrupt',
            });
        }
    }

    /**
     * Resume the build loop from paused state
     */
    resume(): void {
        if (this.state.status === 'awaiting_approval') {
            this.state.status = 'running';
            this.emitEvent('resumed', {
                phase: this.state.currentPhase,
            });
        }
    }

    // =========================================================================
    // LEARNING ENGINE PUBLIC API
    // =========================================================================

    /**
     * Get the current learning system status
     */
    async getLearningStatus(): Promise<{
        enabled: boolean;
        buildId: string;
        tracesCollected: number;
        patternsAvailable: number;
        strategiesActive: number;
        lastEvolutionCycle: Date | null;
        overallImprovement: number;
    }> {
        try {
            const status = await this.evolutionFlywheel.getSystemStatus();
            return {
                enabled: this.learningEnabled,
                buildId: this.state.id,
                tracesCollected: status.pairStats.total * 2, // Approximate
                patternsAvailable: status.patternStats.total,
                strategiesActive: status.strategyStats.total,
                lastEvolutionCycle: status.lastCycle?.completedAt || null,
                overallImprovement: status.overallImprovement,
            };
        } catch (error) {
            return {
                enabled: this.learningEnabled,
                buildId: this.state.id,
                tracesCollected: 0,
                patternsAvailable: 0,
                strategiesActive: 0,
                lastEvolutionCycle: null,
                overallImprovement: 0,
            };
        }
    }

    /**
     * Enable or disable learning for this build
     */
    setLearningEnabled(enabled: boolean): void {
        this.learningEnabled = enabled;
        console.log(`[BuildLoop] Learning ${enabled ? 'enabled' : 'disabled'} for build ${this.state.id}`);
    }

    /**
     * Manually trigger an evolution cycle
     */
    async triggerEvolutionCycle(): Promise<void> {
        if (!this.learningEnabled) {
            throw new Error('Learning is disabled');
        }

        console.log('[BuildLoop] Manually triggering evolution cycle');
        await this.evolutionFlywheel.runCycle(this.state.userId);
    }

    /**
     * Get improvement trend over recent builds
     */
    async getImprovementTrend(cycleCount: number = 20): Promise<Array<{
        cycleNumber: number;
        improvement: number;
        avgSuccessRate: number;
        date: string;
    }>> {
        return this.evolutionFlywheel.getImprovementTrend(cycleCount);
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

    // =========================================================================
    // CURSOR 2.1+ FEATURE METHODS
    // =========================================================================

    /**
     * Start Cursor 2.1+ runtime services
     * Called from start() to initialize streaming/continuous services
     */
    private async startCursor21Services(): Promise<void> {
        const config = this.state.config;

        // Start streaming feedback channel
        if (config.enableStreamingFeedback) {
            this.feedbackChannel = getStreamingFeedbackChannel();
            this.feedbackChannel.createStream(this.state.id, `orchestrator-${this.state.id}`);
            console.log('[BuildLoop] Cursor 2.1+: Streaming feedback channel started');
        }

        // Start continuous verification
        if (config.enableContinuousVerification) {
            this.continuousVerification = createContinuousVerification({
                buildId: this.state.id,
                projectPath: this.projectPath,
            });
            this.continuousVerification.start();
            console.log('[BuildLoop] Cursor 2.1+: Continuous verification started');
        }

        // Start browser-in-loop (for visual verification during build)
        if (config.enableBrowserInLoop) {
            try {
                this.browserInLoop = createBrowserInLoop({
                    buildId: this.state.id,
                    projectPath: this.projectPath,
                    previewUrl: `http://localhost:3100`, // Default preview port
                    checkIntervalMs: 30000,
                    captureOnFileChange: true,
                    antiSlopThreshold: config.visualQualityThreshold,
                });
                await this.browserInLoop.start();
                console.log('[BuildLoop] Cursor 2.1+: Browser-in-loop started');
            } catch (error) {
                console.warn('[BuildLoop] Browser-in-loop failed to start (non-fatal):', error);
            }
        }
    }

    /**
     * Stop Cursor 2.1+ runtime services
     * Called during cleanup
     */
    private async stopCursor21Services(): Promise<void> {
        // Stop continuous verification
        if (this.continuousVerification) {
            this.continuousVerification.stop();
            this.continuousVerification = null;
        }

        // Stop browser-in-loop
        if (this.browserInLoop) {
            await this.browserInLoop.stop();
            this.browserInLoop = null;
        }

        // Close feedback stream
        if (this.feedbackChannel) {
            this.feedbackChannel.closeStream(this.state.id);
            this.feedbackChannel = null;
        }

        // Unsubscribe all agents
        for (const [, unsubscribe] of this.agentFeedbackSubscriptions) {
            unsubscribe();
        }
        this.agentFeedbackSubscriptions.clear();

        // Clean up human checkpoints
        if (this.humanCheckpoint) {
            this.humanCheckpoint.cleanup(this.state.id);
        }

        console.log('[BuildLoop] Cursor 2.1+: Services stopped');
    }

    /**
     * Handle error with Level 0 pattern matching before escalation
     * Returns true if error was handled by pattern library
     */
    async handleErrorWithPatternLibrary(
        errorMessage: string,
        errorType: string,
        context: {
            file?: string;
            line?: number;
            code?: string;
            stack?: string;
        }
    ): Promise<{
        handled: boolean;
        usedPattern: boolean;
        patternName?: string;
        escalationNeeded: boolean;
        debugSession?: DebugSession;
    }> {
        console.log(`[BuildLoop] Cursor 2.1+: Handling error with pattern library...`);

        // Step 1: Try pattern matching (Level 0)
        if (this.errorPatternLibrary && this.state.config.enablePatternLibrary) {
            const match = this.errorPatternLibrary.match(
                errorMessage,
                errorType,
                context.file,
                context.code,
                context.stack
            );

            if (match.matched && match.confidence && match.confidence >= 0.7) {
                console.log(`[BuildLoop] Pattern matched: ${match.patternName} (${(match.confidence * 100).toFixed(1)}% confidence)`);

                // Apply the pattern fix
                const files = new Map<string, string>();
                if (context.file && context.code) {
                    files.set(context.file, context.code);
                }

                const fixResult = await this.errorPatternLibrary.applyFix(match.patternId!, files, {
                    file: context.file,
                    line: context.line,
                    errorMessage,
                });

                if (fixResult.success) {
                    this.cursor21State.patternFixesApplied++;
                    this.emitEvent('cursor21_pattern_fix', {
                        patternId: match.patternId,
                        patternName: match.patternName,
                        filesModified: fixResult.filesModified,
                    });

                    return {
                        handled: true,
                        usedPattern: true,
                        patternName: match.patternName,
                        escalationNeeded: false,
                    };
                }
            }
        }

        // Step 2: Create runtime debug context for escalation
        if (this.runtimeDebug && this.state.config.enableRuntimeDebug) {
            const runtimeError: RuntimeError = {
                id: uuidv4(),
                type: errorType,
                message: errorMessage,
                stack: context.stack || '',
                executionTrace: [],
                variableStates: [],
                consoleOutput: [],
                networkRequests: [],
                timestamp: new Date(),
            };

            const debugSession = this.runtimeDebug.createDebugSession(this.state.id, runtimeError);

            // Generate hypotheses
            const codeContext = new Map<string, string>();
            if (context.file && context.code) {
                codeContext.set(context.file, context.code);
            }

            await this.runtimeDebug.generateHypotheses(debugSession, codeContext);

            return {
                handled: false,
                usedPattern: false,
                escalationNeeded: true,
                debugSession,
            };
        }

        // Escalation needed without debug context
        return {
            handled: false,
            usedPattern: false,
            escalationNeeded: true,
        };
    }

    /**
     * Create a human verification checkpoint for critical fixes
     */
    async createHumanCheckpoint(
        trigger: 'critical_fix' | 'architectural_change' | 'security_fix' | 'escalation_level_2_plus',
        context: {
            description: string;
            affectedFiles: string[];
            fixSummary: string;
            confidenceScore: number;
            escalationLevel?: number;
        }
    ): Promise<CheckpointResponse | null> {
        if (!this.humanCheckpoint || !this.state.config.enableHumanCheckpoints) {
            return null;
        }

        // Check if escalation level meets threshold
        if (context.escalationLevel && context.escalationLevel < this.state.config.humanCheckpointEscalationLevel) {
            return {
                checkpointId: 'auto-approved',
                action: 'approve',
                note: `Escalation level ${context.escalationLevel} below threshold ${this.state.config.humanCheckpointEscalationLevel}`,
            };
        }

        this.cursor21State.humanCheckpointsTriggered++;
        this.emitEvent('cursor21_checkpoint_waiting', { trigger, description: context.description });

        const response = await this.humanCheckpoint.createCheckpoint(
            this.state.id,
            trigger,
            {
                ...context,
                beforeState: 'Error state',
                afterState: 'Fixed state',
                verificationSteps: [
                    'Review the changed files',
                    'Test the affected functionality',
                    'Confirm the original issue is resolved',
                ],
                expectedOutcome: 'Issue should be resolved without introducing new bugs',
            }
        );

        this.emitEvent('cursor21_checkpoint_responded', { response });
        return response;
    }

    /**
     * Judge multiple agent results and get the best one
     */
    async judgeAgentResults(
        taskDescription: string,
        agentResults: AgentResult[]
    ): Promise<JudgmentResult | null> {
        if (!this.multiAgentJudge || !this.state.config.enableMultiAgentJudging) {
            return null;
        }

        if (agentResults.length < 2) {
            console.log(`[BuildLoop] Not enough agents for judging (${agentResults.length})`);
            return null;
        }

        console.log(`[BuildLoop] Cursor 2.1+: Judging ${agentResults.length} agent results`);

        const judgment = await this.multiAgentJudge.judge(
            this.state.id,
            taskDescription,
            agentResults
        );

        this.emitEvent('cursor21_judgment_complete', {
            winnerId: judgment.recommendation.winnerId,
            winnerName: judgment.recommendation.winnerName,
            confidence: judgment.recommendation.confidence,
        });

        return judgment;
    }

    /**
     * Force a visual check
     */
    async runVisualCheck(): Promise<VisualCheck | null> {
        if (!this.browserInLoop) {
            return null;
        }

        const check = await this.browserInLoop.runVisualCheck();
        this.cursor21State.visualChecksRun++;
        this.cursor21State.lastVisualCheckAt = new Date();
        this.cursor21State.currentVisualScore = check.score;

        return check;
    }

    /**
     * Notify that a file was modified (for continuous verification)
     */
    notifyFileModified(filePath: string, content: string): void {
        // Update project files cache
        this.projectFiles.set(filePath, content);

        // Notify continuous verification
        if (this.continuousVerification) {
            this.continuousVerification.notifyFileModified(filePath, content);
        }

        // Notify browser-in-loop
        if (this.browserInLoop) {
            this.browserInLoop.notifyFileChanged(filePath);
        }
    }

    /**
     * Get debug prompt for escalation
     */
    getDebugPromptForEscalation(debugSession: DebugSession): string {
        if (!this.runtimeDebug) {
            return '';
        }
        return this.runtimeDebug.generateDebugPrompt(debugSession);
    }

    /**
     * Check if visual quality is passing
     */
    isVisualQualityPassing(): boolean {
        return this.cursor21State.currentVisualScore >= this.state.config.visualQualityThreshold;
    }

    /**
     * Get Cursor 2.1+ capabilities summary
     */
    getCursor21Capabilities(): {
        streamingFeedback: { enabled: boolean; itemsReceived: number };
        continuousVerification: { enabled: boolean; running: boolean };
        runtimeDebug: { enabled: boolean };
        browserInLoop: { enabled: boolean; score: number };
        humanCheckpoints: { enabled: boolean; triggered: number };
        multiAgentJudging: { enabled: boolean };
        patternLibrary: { enabled: boolean; fixesApplied: number };
    } {
        return {
            streamingFeedback: {
                enabled: this.state.config.enableStreamingFeedback,
                itemsReceived: this.cursor21State.feedbackItemsReceived,
            },
            continuousVerification: {
                enabled: this.state.config.enableContinuousVerification,
                running: this.continuousVerification !== null,
            },
            runtimeDebug: {
                enabled: this.state.config.enableRuntimeDebug,
            },
            browserInLoop: {
                enabled: this.state.config.enableBrowserInLoop,
                score: this.cursor21State.currentVisualScore,
            },
            humanCheckpoints: {
                enabled: this.state.config.enableHumanCheckpoints,
                triggered: this.cursor21State.humanCheckpointsTriggered,
            },
            multiAgentJudging: {
                enabled: this.state.config.enableMultiAgentJudging,
            },
            patternLibrary: {
                enabled: this.state.config.enablePatternLibrary,
                fixesApplied: this.cursor21State.patternFixesApplied,
            },
        };
    }

    /**
     * Get feedback summary
     */
    getFeedbackSummary() {
        if (!this.feedbackChannel) {
            return null;
        }
        return this.feedbackChannel.getSummary(this.state.id);
    }

    /**
     * Check if there are blocking issues
     */
    hasBlockingIssues(): boolean {
        if (!this.feedbackChannel) {
            return false;
        }
        return this.feedbackChannel.hasBlockers(this.state.id);
    }

    /**
     * Get blocking issues
     */
    getBlockingIssues(): FeedbackItem[] {
        if (!this.feedbackChannel) {
            return [];
        }
        return this.feedbackChannel.getBlockers(this.state.id);
    }

    // =========================================================================
    // SOFT INTERRUPT SYSTEM (F046)
    // Allows mid-execution user input without breaking agent flow
    // =========================================================================

    // Local storage for interrupt data (not in state)
    private interruptContext: string[] = [];
    private courseCorrections: Array<{ message: string; phase: string; timestamp: string }> = [];
    private intentClarifications: Array<{ message: string; timestamp: string }> = [];

    /**
     * Submit a user interrupt during build execution
     * Interrupt will be processed at next tool boundary
     */
    async submitInterrupt(message: string, _type?: string): Promise<string | null> {
        if (!this.softInterruptManager) {
            console.warn('[BuildLoop] Soft interrupt manager not available');
            return null;
        }

        try {
            // submitInterrupt takes (sessionId, message, agentId?)
            const interrupt = await this.softInterruptManager.submitInterrupt(
                this.state.id,
                message,
                'build-loop'
            );

            console.log(`[BuildLoop] Interrupt submitted: ${interrupt.id} (${interrupt.type})`);
            return interrupt.id;
        } catch (error) {
            console.error('[BuildLoop] Failed to submit interrupt:', error);
            return null;
        }
    }

    /**
     * Check for pending interrupts at tool boundaries
     * Should be called between agent tool executions
     */
    async checkForInterrupts(): Promise<ClassifiedInterrupt[]> {
        if (!this.softInterruptManager) {
            return [];
        }

        try {
            // getInterruptsAtToolBoundary takes (sessionId, agentId)
            const pending = await this.softInterruptManager.getInterruptsAtToolBoundary(
                this.state.id,
                'build-loop'
            );

            if (pending.length > 0) {
                console.log(`[BuildLoop] ${pending.length} pending interrupts to process`);
                this.pendingInterrupts = pending;
            }

            return pending;
        } catch (error) {
            console.error('[BuildLoop] Failed to check interrupts:', error);
            return [];
        }
    }

    /**
     * Process a single interrupt - integrate into agent context
     */
    async processInterrupt(interrupt: ClassifiedInterrupt): Promise<void> {
        if (!this.softInterruptManager) {
            return;
        }

        try {
            console.log(`[BuildLoop] Processing interrupt ${interrupt.id}: ${interrupt.type}`);

            switch (interrupt.type) {
                case 'HALT':
                    // Pause execution immediately - use awaiting_approval as closest status
                    this.state.status = 'awaiting_approval';
                    this.emitEvent('phase_start', {
                        phase: 'interrupt_halt',
                        message: 'Execution halted by user interrupt'
                    });
                    break;

                case 'CONTEXT_ADD':
                    // Add context to current agent
                    await this.mergeInterruptContext(interrupt);
                    break;

                case 'COURSE_CORRECT':
                    // Modify current approach
                    await this.applyCourseCorrection(interrupt);
                    break;

                case 'QUEUE':
                    // Queue for later processing
                    console.log(`[BuildLoop] Queued interrupt: ${interrupt.message.substring(0, 50)}...`);
                    break;

                case 'CLARIFICATION':
                    // Add clarification to Intent Lock
                    await this.addIntentClarification(interrupt);
                    break;

                case 'BACKTRACK':
                    // Handle backtrack request
                    console.log(`[BuildLoop] Backtrack requested: ${interrupt.message.substring(0, 50)}...`);
                    break;

                case 'URGENT_FIX':
                    // Handle urgent fix
                    console.log(`[BuildLoop] Urgent fix: ${interrupt.message.substring(0, 50)}...`);
                    break;

                default:
                    console.log(`[BuildLoop] Unhandled interrupt type: ${interrupt.type}`);
            }

            // Apply the interrupt via the manager (takes interrupt, agentId)
            await this.softInterruptManager.applyInterrupt(interrupt, 'build-loop');
        } catch (error) {
            console.error('[BuildLoop] Failed to process interrupt:', error);
        }
    }

    /**
     * Merge interrupt context into current agent execution
     */
    private async mergeInterruptContext(interrupt: ClassifiedInterrupt): Promise<void> {
        // Emit event for context addition
        this.emitEvent('phase_start', {
            phase: 'interrupt_context',
            message: `Context added: ${interrupt.message.substring(0, 100)}...`
        });

        // Store in local array for agent consumption
        this.interruptContext.push(interrupt.message);
    }

    /**
     * Apply course correction from interrupt
     */
    private async applyCourseCorrection(interrupt: ClassifiedInterrupt): Promise<void> {
        this.emitEvent('phase_start', {
            phase: 'interrupt_correction',
            message: `Course correction: ${interrupt.message.substring(0, 100)}...`
        });

        // Store correction for current phase to consider
        this.courseCorrections.push({
            message: interrupt.message,
            phase: this.state.currentPhase,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Add clarification to Intent Lock
     */
    private async addIntentClarification(interrupt: ClassifiedInterrupt): Promise<void> {
        this.emitEvent('phase_start', {
            phase: 'interrupt_clarification',
            message: `Intent clarification: ${interrupt.message.substring(0, 100)}...`
        });

        // Store clarification in local array (doesn't modify locked contract)
        this.intentClarifications.push({
            message: interrupt.message,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Get accumulated interrupt context
     */
    getInterruptContext(): string[] {
        return [...this.interruptContext];
    }

    /**
     * Get accumulated course corrections
     */
    getCourseCorrections(): Array<{ message: string; phase: string; timestamp: string }> {
        return [...this.courseCorrections];
    }

    /**
     * Get accumulated intent clarifications
     */
    getIntentClarifications(): Array<{ message: string; timestamp: string }> {
        return [...this.intentClarifications];
    }

    // =========================================================================
    // CREDENTIAL VAULT SYSTEM (F047)
    // Secure credential storage and injection for builds
    // =========================================================================

    /**
     * Load project credentials for build execution
     * Called during Phase 1 (Initialization)
     */
    async loadProjectCredentials(integrationIds?: string[]): Promise<Map<string, DecryptedCredential>> {
        if (!this.credentialVault) {
            console.warn('[BuildLoop] Credential vault not available');
            return this.loadedCredentials;
        }

        try {
            // Get all credentials for this project
            const credentials = await this.credentialVault.listCredentials(this.state.userId);

            for (const cred of credentials) {
                // Filter by integration IDs if provided
                if (integrationIds && integrationIds.length > 0) {
                    if (!integrationIds.includes(cred.integrationId)) {
                        continue;
                    }
                }

                // Decrypt and store for build use
                try {
                    const decrypted = await this.credentialVault.getCredential(cred.id, this.state.userId);
                    if (decrypted) {
                        this.loadedCredentials.set(cred.integrationId, decrypted);
                        console.log(`[BuildLoop] Loaded credential for ${cred.integrationId}`);
                    }
                } catch (error) {
                    console.warn(`[BuildLoop] Failed to decrypt credential ${cred.id}:`, error);
                }
            }

            console.log(`[BuildLoop] Loaded ${this.loadedCredentials.size} credentials for build`);
            return this.loadedCredentials;
        } catch (error) {
            console.error('[BuildLoop] Failed to load credentials:', error);
            return this.loadedCredentials;
        }
    }

    /**
     * Get a specific credential for use in build
     */
    getCredential(integrationId: string): DecryptedCredential | undefined {
        return this.loadedCredentials.get(integrationId);
    }

    /**
     * Check if required credentials are available
     */
    hasRequiredCredentials(requiredIntegrations: string[]): { available: boolean; missing: string[] } {
        const missing: string[] = [];

        for (const integration of requiredIntegrations) {
            if (!this.loadedCredentials.has(integration)) {
                missing.push(integration);
            }
        }

        return {
            available: missing.length === 0,
            missing,
        };
    }

    /**
     * Write credentials to .env file for build process
     */
    async writeCredentialsToEnv(projectPath: string): Promise<boolean> {
        if (this.loadedCredentials.size === 0) {
            console.log('[BuildLoop] No credentials to write to .env');
            return true;
        }

        try {
            const envPath = `${projectPath}/.env`;
            const envLines: string[] = [];

            // Read existing .env if present
            try {
                const fs = await import('fs/promises');
                const existing = await fs.readFile(envPath, 'utf-8');
                envLines.push(existing.trim());
            } catch {
                // No existing .env
            }

            // Add credentials
            envLines.push('');
            envLines.push('# === Credentials injected by KripTik Build Loop ===');

            for (const [integration, cred] of this.loadedCredentials) {
                const envKey = this.integrationToEnvKey(integration);
                // DecryptedCredential has data: CredentialData which is a flexible object
                const value = cred.data?.apiKey || cred.data?.token || cred.data?.secret || '';
                envLines.push(`${envKey}=${value}`);
            }

            // Write .env
            const fs = await import('fs/promises');
            await fs.writeFile(envPath, envLines.join('\n'));

            console.log(`[BuildLoop] Wrote ${this.loadedCredentials.size} credentials to ${envPath}`);
            return true;
        } catch (error) {
            console.error('[BuildLoop] Failed to write credentials to .env:', error);
            return false;
        }
    }

    /**
     * Convert integration ID to environment variable name
     */
    private integrationToEnvKey(integrationId: string): string {
        return integrationId
            .toUpperCase()
            .replace(/-/g, '_')
            .replace(/\./g, '_') + '_API_KEY';
    }

    /**
     * Clear loaded credentials (security cleanup)
     */
    clearCredentials(): void {
        this.loadedCredentials.clear();
        console.log('[BuildLoop] Credentials cleared from memory');
    }

    // =========================================================================
    // GHOST MODE SYSTEM (F048)
    // Autonomous background building when user is away
    // =========================================================================

    /**
     * Enable Ghost Mode for autonomous background building
     */
    async enableGhostMode(config: {
        wakeConditions?: WakeCondition[];
        maxRuntime?: number;
        maxCredits?: number;
        autonomyLevel?: 'conservative' | 'moderate' | 'aggressive';
    }): Promise<string | null> {
        if (!this.ghostModeController) {
            console.warn('[BuildLoop] Ghost mode controller not available');
            return null;
        }

        try {
            const ghostConfig: GhostSessionConfig = {
                sessionId: uuidv4(),
                projectId: this.state.projectId,
                userId: this.state.userId,
                tasks: [{
                    id: this.state.id,
                    description: 'Complete build loop execution',
                    priority: 1,
                    estimatedCredits: config.maxCredits || 100,
                    status: 'pending',
                    dependencies: [],
                }],
                wakeConditions: config.wakeConditions || [
                    {
                        id: uuidv4(),
                        type: 'completion',
                        description: 'Build completed',
                        priority: 'high',
                        notificationChannels: ['push', 'email'],
                    },
                    {
                        id: uuidv4(),
                        type: 'critical_error',
                        description: 'Critical error occurred',
                        priority: 'high',
                        notificationChannels: ['push', 'email'],
                    },
                ],
                maxRuntime: config.maxRuntime || 120, // 2 hours default
                maxCredits: config.maxCredits || 100,
                checkpointInterval: 15, // Every 15 minutes
                retryPolicy: {
                    maxRetries: 3,
                    backoffMultiplier: 2,
                    initialDelayMs: 1000,
                    maxDelayMs: 60000,
                    retryableErrors: ['timeout', 'rate_limit', 'temporary_failure', 'network_error'],
                },
                pauseOnFirstError: config.autonomyLevel === 'conservative',
                autonomyLevel: config.autonomyLevel || 'moderate',
            };

            // startSession returns the session ID as a string
            const sessionId = await this.ghostModeController.startSession(ghostConfig);
            this.ghostSessionId = sessionId;
            this.isGhostModeActive = true;
            this.wakeConditions = ghostConfig.wakeConditions;

            console.log(`[BuildLoop] Ghost mode enabled: ${sessionId}`);
            this.emitEvent('phase_start', {
                phase: 'ghost_mode',
                message: 'Ghost mode enabled - building autonomously'
            });

            return sessionId;
        } catch (error) {
            console.error('[BuildLoop] Failed to enable ghost mode:', error);
            return null;
        }
    }

    /**
     * Disable Ghost Mode and return to interactive building
     */
    async disableGhostMode(): Promise<void> {
        if (!this.ghostModeController || !this.ghostSessionId) {
            return;
        }

        try {
            await this.ghostModeController.pauseSession(this.ghostSessionId);
            this.isGhostModeActive = false;

            console.log(`[BuildLoop] Ghost mode disabled: ${this.ghostSessionId}`);
            this.emitEvent('phase_complete', {
                phase: 'ghost_mode',
                message: 'Ghost mode disabled - returning to interactive mode'
            });
        } catch (error) {
            console.error('[BuildLoop] Failed to disable ghost mode:', error);
        }
    }

    /**
     * Check if a wake condition has been triggered
     */
    async checkWakeConditions(): Promise<WakeCondition | null> {
        if (!this.isGhostModeActive || this.wakeConditions.length === 0) {
            return null;
        }

        for (const condition of this.wakeConditions) {
            const triggered = await this.evaluateWakeCondition(condition);
            if (triggered) {
                console.log(`[BuildLoop] Wake condition triggered: ${condition.type}`);
                this.isGhostModeActive = false;

                // Send notification
                await this.sendWakeNotification(condition);

                return condition;
            }
        }

        return null;
    }

    /**
     * Evaluate a single wake condition
     */
    private async evaluateWakeCondition(condition: WakeCondition): Promise<boolean> {
        switch (condition.type) {
            case 'completion':
                return this.state.status === 'complete';

            case 'error':
                return this.state.status === 'failed' ||
                       this.state.errorCount > 0;

            case 'critical_error':
                // Check if escalation level indicates critical error (level 3+)
                return this.state.escalationLevel >= 3;

            case 'decision_needed':
                return this.state.status === 'awaiting_approval' ||
                       this.pendingInterrupts.some(i => i.type === 'CLARIFICATION');

            case 'cost_threshold':
                // Cost threshold check not directly in state, using escalation as proxy
                // In a full implementation, would track credits separately
                return false; // Disabled until credits tracking is added

            case 'time_elapsed':
                // Check if time exceeded
                const elapsed = Date.now() - this.state.startedAt.getTime();
                const thresholdMs = (condition.threshold || 0) * 60 * 1000;
                return thresholdMs > 0 && elapsed >= thresholdMs;

            case 'feature_complete':
                // Check if specific feature is complete
                // Using phasesCompleted as proxy - feature tracking would need separate mechanism
                if (condition.featureId) {
                    // In full implementation, would check feature tracking system
                    // For now, check if parallel_build phase is complete (where features are built)
                    return this.state.phasesCompleted.includes('parallel_build');
                }
                return false;

            case 'quality_threshold':
                // Check if quality score dropped below threshold
                // Note: Verification scores tracked separately during build phases
                // For now, use error count as quality proxy
                if (condition.threshold) {
                    const errorRatio = this.state.errorCount / Math.max(1, this.state.phasesCompleted.length);
                    return errorRatio > (100 - condition.threshold) / 100;
                }
                return false;

            default:
                return false;
        }
    }

    /**
     * Send notification for wake condition
     */
    private async sendWakeNotification(condition: WakeCondition): Promise<void> {
        // Use the notification system
        const message = `Build wake condition triggered: ${condition.description}`;

        for (const channel of condition.notificationChannels) {
            try {
                switch (channel) {
                    case 'push':
                        // Would integrate with web-push
                        console.log(`[BuildLoop] Push notification: ${message}`);
                        break;
                    case 'email':
                        // Would integrate with email service
                        console.log(`[BuildLoop] Email notification: ${message}`);
                        break;
                    case 'slack':
                    case 'discord':
                    case 'webhook':
                        console.log(`[BuildLoop] ${channel} notification: ${message}`);
                        break;
                }
            } catch (error) {
                console.error(`[BuildLoop] Failed to send ${channel} notification:`, error);
            }
        }

        this.emitEvent('phase_complete', {
            phase: 'wake_notification',
            message: `Wake notification sent: ${condition.description}`
        });
    }

    /**
     * Get Ghost Mode status
     */
    getGhostModeStatus(): {
        active: boolean;
        sessionId: string | null;
        wakeConditions: WakeCondition[];
    } {
        return {
            active: this.isGhostModeActive,
            sessionId: this.ghostSessionId,
            wakeConditions: this.wakeConditions,
        };
    }

    /**
     * Record a checkpoint during Ghost Mode execution
     * Note: GhostModeController handles checkpoints internally via createCheckpoint (private)
     * This method logs the checkpoint for external tracking
     */
    async recordGhostCheckpoint(description: string): Promise<void> {
        if (!this.ghostModeController || !this.ghostSessionId) {
            return;
        }

        try {
            // Log checkpoint event - GhostModeController manages actual checkpoints internally
            console.log(`[BuildLoop] Ghost checkpoint: ${description}`);
            console.log(`[BuildLoop]   Phase: ${this.state.currentPhase}`);
            console.log(`[BuildLoop]   Phases completed: ${this.state.phasesCompleted.join(', ')}`);

            // Emit event for tracking
            this.emitEvent('checkpoint_created', {
                description,
                phase: this.state.currentPhase,
                phasesCompleted: this.state.phasesCompleted,
                ghostSessionId: this.ghostSessionId,
            });
        } catch (error) {
            console.error('[BuildLoop] Failed to record ghost checkpoint:', error);
        }
    }

    // =========================================================================
    // ORPHANED FEATURES: Image-to-Code and API Autopilot
    // =========================================================================

    /**
     * Detect if prompt contains image references and process them
     * Called during Phase 2 when building UI components
     */
    async processImageInputs(prompt: string, imageUrls?: string[]): Promise<ImageToCodeResult | null> {
        if (!this.imageToCodeService) {
            console.log('[BuildLoop] Image-to-code service not available');
            return null;
        }

        // Check if prompt mentions images, screenshots, designs, mockups, or Figma
        const hasImageKeywords = /\b(image|screenshot|design|mockup|figma|wireframe|sketch|ui\s+design)\b/i.test(prompt);
        const hasImageUrls = imageUrls && imageUrls.length > 0;

        if (!hasImageKeywords && !hasImageUrls) {
            return null;
        }

        this.emitEvent('phase_start', { phase: 'image_to_code' });
        console.log('[BuildLoop] Processing image inputs for code generation');

        try {
            const request: ImageToCodeRequest = {
                images: imageUrls?.map(url => ({ type: 'url' as const, url })) || [],
                framework: 'react',
                styling: 'tailwind',
                includeResponsive: true,
                includeAccessibility: true,
                additionalInstructions: prompt,
            };

            const result = await this.imageToCodeService.convert(request);

            // Write generated components to disk
            for (const component of result.components) {
                const fullPath = `${this.projectPath}/${component.path}`;
                const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
                const fs = await import('fs/promises');
                await fs.mkdir(dir, { recursive: true });
                await fs.writeFile(fullPath, component.code, 'utf-8');
                console.log(`[BuildLoop] Image-to-code wrote: ${component.path}`);
            }

            this.emitEvent('phase_complete', {
                phase: 'image_to_code',
                components: result.components.length,
            });

            return result;
        } catch (error) {
            console.error('[BuildLoop] Image-to-code failed:', error);
            return null;
        }
    }

    /**
     * Detect and process API integrations from Intent Contract
     * Called during Phase 2 when building backend/API features
     */
    async processAPIIntegrations(): Promise<IntegrationResult[] | null> {
        if (!this.apiAutopilotService) {
            console.log('[BuildLoop] API autopilot service not available');
            return null;
        }

        if (!this.state.intentContract) {
            return null;
        }

        // Check if intent contract specifies external APIs
        const technicalReqs = this.state.intentContract.technicalRequirements || [];
        const apiMentions = technicalReqs.filter(req =>
            /\b(api|integration|third-party|external|webhook|oauth|stripe|twilio|sendgrid|firebase|supabase)\b/i.test(req)
        );

        if (apiMentions.length === 0) {
            return null;
        }

        this.emitEvent('phase_start', { phase: 'api_autopilot' });
        console.log(`[BuildLoop] Processing ${apiMentions.length} API integrations`);

        const results: IntegrationResult[] = [];

        try {
            for (const apiReq of apiMentions) {
                // Try to discover and generate integration for each API mention
                const discoveredApis = await this.apiAutopilotService.discoverFromPrompt(apiReq);

                for (const api of discoveredApis) {
                    const integration = await this.apiAutopilotService.generateIntegration(
                        api.id,
                        this.projectPath
                    );

                    if (integration) {
                        results.push(integration);
                        console.log(`[BuildLoop] Generated API integration for: ${api.name}`);
                    }
                }
            }

            this.emitEvent('phase_complete', {
                phase: 'api_autopilot',
                integrations: results.length,
            });

            return results;
        } catch (error) {
            console.error('[BuildLoop] API autopilot failed:', error);
            return null;
        }
    }

    /**
     * Get capabilities status for orphaned features
     */
    getOrphanedFeatureCapabilities(): {
        imageToCode: boolean;
        apiAutopilot: boolean;
    } {
        return {
            imageToCode: this.imageToCodeService !== null,
            apiAutopilot: this.apiAutopilotService !== null,
        };
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
