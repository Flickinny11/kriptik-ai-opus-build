/**
 * Enhanced Build Loop - Cursor 2.1+ Level Integration
 *
 * This module integrates all the new services to create a build loop that
 * matches or exceeds Cursor 2.1's capabilities:
 *
 * 1. Streaming Feedback Channel - Real-time verification → builder
 * 2. Continuous Verification - Actually runs checks, not just heartbeats
 * 3. Runtime Debug Context - Variable states, execution paths for errors
 * 4. Browser-in-the-Loop - Continuous visual verification during build
 * 5. Human Checkpoints - Pause for critical fixes, verify before commit
 * 6. Multi-Agent Judging - Auto-evaluate parallel results, pick best
 * 7. Error Pattern Library - Level 0 pre-escalation instant fixes
 *
 * The key insight: TIGHT FEEDBACK LOOPS + RUNTIME CONTEXT = MAGIC
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// Import all the new services
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

// =============================================================================
// TYPES
// =============================================================================

export interface EnhancedBuildConfig {
    buildId: string;
    projectId: string;
    userId: string;
    projectPath: string;
    previewUrl: string;

    // Feature flags for new capabilities
    enableStreamingFeedback: boolean;
    enableContinuousVerification: boolean;
    enableRuntimeDebug: boolean;
    enableBrowserInLoop: boolean;
    enableHumanCheckpoints: boolean;
    enableMultiAgentJudging: boolean;
    enablePatternLibrary: boolean;

    // Thresholds
    visualQualityThreshold: number;
    humanCheckpointEscalationLevel: number;
}

export interface BuildAgent {
    id: string;
    name: string;
    status: 'idle' | 'running' | 'completed' | 'failed';
    task: string;
    files: Map<string, string>;
    feedbackReceived: FeedbackItem[];
    selfCorrectionsMade: number;
}

export interface EnhancedBuildState {
    buildId: string;
    status: 'initializing' | 'building' | 'verifying' | 'waiting_human' | 'complete' | 'failed';
    agents: BuildAgent[];
    currentPhase: string;

    // Metrics
    feedbackItemsReceived: number;
    selfCorrectionsMade: number;
    humanCheckpointsTriggered: number;
    patternFixesApplied: number;
    visualChecksRun: number;

    // Quality scores
    currentVisualScore: number;
    currentVerificationScore: number;

    // Timing
    startedAt: Date;
    lastFeedbackAt: Date | null;
    lastVisualCheckAt: Date | null;
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: Partial<EnhancedBuildConfig> = {
    enableStreamingFeedback: true,
    enableContinuousVerification: true,
    enableRuntimeDebug: true,
    enableBrowserInLoop: true,
    enableHumanCheckpoints: true,
    enableMultiAgentJudging: true,
    enablePatternLibrary: true,
    visualQualityThreshold: 85,
    humanCheckpointEscalationLevel: 2,
};

// =============================================================================
// ENHANCED BUILD LOOP ORCHESTRATOR
// =============================================================================

export class EnhancedBuildLoopOrchestrator extends EventEmitter {
    private config: EnhancedBuildConfig;
    private state: EnhancedBuildState;

    // Services
    private feedbackChannel: StreamingFeedbackChannel;
    private continuousVerification: ContinuousVerificationService | null = null;
    private runtimeDebug: RuntimeDebugContextService;
    private browserInLoop: BrowserInLoopService | null = null;
    private humanCheckpoint: HumanCheckpointService;
    private multiAgentJudge: MultiAgentJudgeService;
    private patternLibrary: ErrorPatternLibraryService;

    // Agent management
    private activeAgents: Map<string, BuildAgent> = new Map();
    private agentFeedbackSubscriptions: Map<string, () => void> = new Map();

    constructor(config: Partial<EnhancedBuildConfig> & { buildId: string; projectId: string; userId: string; projectPath: string; previewUrl: string }) {
        super();

        this.config = { ...DEFAULT_CONFIG, ...config } as EnhancedBuildConfig;

        this.state = {
            buildId: config.buildId,
            status: 'initializing',
            agents: [],
            currentPhase: 'init',
            feedbackItemsReceived: 0,
            selfCorrectionsMade: 0,
            humanCheckpointsTriggered: 0,
            patternFixesApplied: 0,
            visualChecksRun: 0,
            currentVisualScore: 100,
            currentVerificationScore: 100,
            startedAt: new Date(),
            lastFeedbackAt: null,
            lastVisualCheckAt: null,
        };

        // Initialize services
        this.feedbackChannel = getStreamingFeedbackChannel();
        this.runtimeDebug = getRuntimeDebugContext();
        this.humanCheckpoint = getHumanCheckpointService();
        this.multiAgentJudge = getMultiAgentJudge();
        this.patternLibrary = getErrorPatternLibrary();

        console.log(`[EnhancedBuildLoop] Initialized build ${config.buildId} with Cursor 2.1+ features`);
    }

    // =========================================================================
    // LIFECYCLE
    // =========================================================================

    /**
     * Start the enhanced build loop
     */
    async start(): Promise<void> {
        console.log(`[EnhancedBuildLoop] Starting build ${this.config.buildId}`);

        // Create feedback stream
        if (this.config.enableStreamingFeedback) {
            this.feedbackChannel.createStream(this.config.buildId, `orchestrator-${this.config.buildId}`);
            this.setupFeedbackListeners();
        }

        // Start continuous verification
        if (this.config.enableContinuousVerification) {
            this.continuousVerification = createContinuousVerification({
                buildId: this.config.buildId,
                projectPath: this.config.projectPath,
            });
            this.continuousVerification.start();
            this.setupVerificationListeners();
        }

        // Start browser-in-loop
        if (this.config.enableBrowserInLoop) {
            this.browserInLoop = createBrowserInLoop({
                buildId: this.config.buildId,
                projectPath: this.config.projectPath,
                previewUrl: this.config.previewUrl,
                checkIntervalMs: 30000,
                captureOnFileChange: true,
                antiSlopThreshold: this.config.visualQualityThreshold,
            });
            await this.browserInLoop.start();
            this.setupBrowserListeners();
        }

        this.state.status = 'building';
        this.emit('started', { buildId: this.config.buildId });
    }

    /**
     * Stop the enhanced build loop
     */
    async stop(): Promise<void> {
        console.log(`[EnhancedBuildLoop] Stopping build ${this.config.buildId}`);

        // Stop all services
        if (this.continuousVerification) {
            this.continuousVerification.stop();
        }

        if (this.browserInLoop) {
            await this.browserInLoop.stop();
        }

        // Unsubscribe all agents
        for (const [agentId, unsubscribe] of this.agentFeedbackSubscriptions) {
            unsubscribe();
        }
        this.agentFeedbackSubscriptions.clear();

        // Close feedback stream
        this.feedbackChannel.closeStream(this.config.buildId);

        // Clean up human checkpoints
        this.humanCheckpoint.cleanup(this.config.buildId);

        this.emit('stopped', { buildId: this.config.buildId });
    }

    // =========================================================================
    // AGENT MANAGEMENT
    // =========================================================================

    /**
     * Register a building agent to receive real-time feedback
     */
    registerAgent(agentId: string, agentName: string, task: string): BuildAgent {
        const agent: BuildAgent = {
            id: agentId,
            name: agentName,
            status: 'idle',
            task,
            files: new Map(),
            feedbackReceived: [],
            selfCorrectionsMade: 0,
        };

        this.activeAgents.set(agentId, agent);
        this.state.agents.push(agent);

        // Register for feedback
        this.feedbackChannel.registerAgent(agentId, this.config.buildId);

        // Subscribe to feedback
        if (this.config.enableStreamingFeedback) {
            const unsubscribe = this.feedbackChannel.subscribeAgent(agentId, (item) => {
                this.handleAgentFeedback(agentId, item);
            });
            this.agentFeedbackSubscriptions.set(agentId, unsubscribe);
        }

        console.log(`[EnhancedBuildLoop] Registered agent ${agentName} (${agentId})`);
        this.emit('agent:registered', { agentId, agentName, task });

        return agent;
    }

    /**
     * Handle feedback received by an agent
     */
    private handleAgentFeedback(agentId: string, item: FeedbackItem): void {
        const agent = this.activeAgents.get(agentId);
        if (!agent) return;

        agent.feedbackReceived.push(item);
        this.state.feedbackItemsReceived++;
        this.state.lastFeedbackAt = new Date();

        console.log(`[EnhancedBuildLoop] Agent ${agent.name} received feedback: ${item.message.substring(0, 50)}...`);

        // Emit for UI updates
        this.emit('agent:feedback', { agentId, agentName: agent.name, item });

        // If it's auto-fixable, suggest self-correction
        if (item.autoFixable && item.autoFix) {
            this.emit('agent:self-correct-available', {
                agentId,
                agentName: agent.name,
                feedbackId: item.id,
                autoFix: item.autoFix,
            });
        }
    }

    /**
     * Agent reports a self-correction was made
     */
    reportSelfCorrection(agentId: string, feedbackId: string): void {
        const agent = this.activeAgents.get(agentId);
        if (!agent) return;

        agent.selfCorrectionsMade++;
        this.state.selfCorrectionsMade++;

        // Acknowledge the feedback
        this.feedbackChannel.acknowledgeFeedback(feedbackId, agentId, 'fixed', 'Self-corrected');

        console.log(`[EnhancedBuildLoop] Agent ${agent.name} self-corrected (total: ${agent.selfCorrectionsMade})`);
        this.emit('agent:self-corrected', { agentId, feedbackId, totalCorrections: agent.selfCorrectionsMade });
    }

    /**
     * Notify that an agent modified a file
     */
    notifyFileModified(agentId: string, filePath: string, content: string): void {
        const agent = this.activeAgents.get(agentId);
        if (agent) {
            agent.files.set(filePath, content);
        }

        // Notify continuous verification
        if (this.continuousVerification) {
            this.continuousVerification.notifyFileModified(filePath, content);
        }

        // Notify browser-in-loop
        if (this.browserInLoop) {
            this.browserInLoop.notifyFileChanged(filePath);
        }
    }

    // =========================================================================
    // ERROR HANDLING WITH PATTERN LIBRARY
    // =========================================================================

    /**
     * Handle an error with Level 0 pattern matching before escalation
     */
    async handleError(
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
        console.log(`[EnhancedBuildLoop] Handling error: ${errorMessage.substring(0, 100)}...`);

        // Step 1: Try pattern matching (Level 0)
        if (this.config.enablePatternLibrary) {
            const match = this.patternLibrary.match(
                errorMessage,
                errorType,
                context.file,
                context.code,
                context.stack
            );

            if (match.matched && match.confidence && match.confidence >= 0.7) {
                console.log(`[EnhancedBuildLoop] Pattern matched: ${match.patternName} (${(match.confidence * 100).toFixed(1)}% confidence)`);

                // Apply the pattern fix
                const files = new Map<string, string>();
                if (context.file && context.code) {
                    files.set(context.file, context.code);
                }

                const fixResult = await this.patternLibrary.applyFix(match.patternId!, files, {
                    file: context.file,
                    line: context.line,
                    errorMessage,
                });

                if (fixResult.success) {
                    this.state.patternFixesApplied++;
                    this.emit('error:pattern-fixed', {
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
        if (this.config.enableRuntimeDebug) {
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

            const debugSession = this.runtimeDebug.createDebugSession(this.config.buildId, runtimeError);

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
     * Get debug prompt for escalation
     */
    getDebugPromptForEscalation(debugSession: DebugSession): string {
        return this.runtimeDebug.generateDebugPrompt(debugSession);
    }

    // =========================================================================
    // HUMAN CHECKPOINTS
    // =========================================================================

    /**
     * Create a human verification checkpoint for a critical fix
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
    ): Promise<CheckpointResponse> {
        if (!this.config.enableHumanCheckpoints) {
            return {
                checkpointId: 'disabled',
                action: 'approve',
                note: 'Human checkpoints disabled',
            };
        }

        // Check if escalation level meets threshold
        if (context.escalationLevel && context.escalationLevel < this.config.humanCheckpointEscalationLevel) {
            return {
                checkpointId: 'auto-approved',
                action: 'approve',
                note: `Escalation level ${context.escalationLevel} below threshold ${this.config.humanCheckpointEscalationLevel}`,
            };
        }

        this.state.status = 'waiting_human';
        this.state.humanCheckpointsTriggered++;

        this.emit('checkpoint:waiting', { trigger, description: context.description });

        const response = await this.humanCheckpoint.createCheckpoint(
            this.config.buildId,
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

        this.state.status = 'building';
        this.emit('checkpoint:responded', { response });

        return response;
    }

    // =========================================================================
    // MULTI-AGENT JUDGING
    // =========================================================================

    /**
     * Judge multiple agent results and get the best one
     */
    async judgeAgentResults(taskDescription: string): Promise<JudgmentResult | null> {
        if (!this.config.enableMultiAgentJudging) {
            return null;
        }

        // Collect results from all completed agents
        const completedAgents = Array.from(this.activeAgents.values())
            .filter(a => a.status === 'completed');

        if (completedAgents.length < 2) {
            console.log(`[EnhancedBuildLoop] Not enough agents for judging (${completedAgents.length})`);
            return null;
        }

        const agentResults: AgentResult[] = completedAgents.map(agent => ({
            agentId: agent.id,
            agentName: agent.name,
            taskDescription: agent.task,
            output: {
                files: agent.files,
                summary: `Completed task: ${agent.task}`,
                approach: `Used ${agent.selfCorrectionsMade} self-corrections`,
            },
            metrics: {
                executionTimeMs: 0, // Would be tracked in real implementation
                tokensUsed: 0,
                creditsUsed: 0,
                verificationScore: this.state.currentVerificationScore,
                errorCount: agent.feedbackReceived.filter(f => f.severity === 'critical').length,
            },
            completedAt: new Date(),
        }));

        console.log(`[EnhancedBuildLoop] Judging ${agentResults.length} agent results`);

        const judgment = await this.multiAgentJudge.judge(
            this.config.buildId,
            taskDescription,
            agentResults
        );

        this.emit('judgment:complete', {
            winnerId: judgment.recommendation.winnerId,
            winnerName: judgment.recommendation.winnerName,
            confidence: judgment.recommendation.confidence,
        });

        return judgment;
    }

    // =========================================================================
    // VISUAL VERIFICATION
    // =========================================================================

    /**
     * Force a visual check
     */
    async runVisualCheck(): Promise<VisualCheck | null> {
        if (!this.browserInLoop) {
            return null;
        }

        const check = await this.browserInLoop.runVisualCheck();
        this.state.visualChecksRun++;
        this.state.lastVisualCheckAt = new Date();
        this.state.currentVisualScore = check.score;

        return check;
    }

    /**
     * Check if visual quality is passing
     */
    isVisualQualityPassing(): boolean {
        return this.state.currentVisualScore >= this.config.visualQualityThreshold;
    }

    // =========================================================================
    // LISTENERS SETUP
    // =========================================================================

    private setupFeedbackListeners(): void {
        this.feedbackChannel.on('feedback:critical', (data) => {
            this.emit('feedback:critical', data);
        });
    }

    private setupVerificationListeners(): void {
        if (!this.continuousVerification) return;

        this.continuousVerification.on('check:complete', (data: { type: string; result: CheckResult }) => {
            this.emit('verification:check-complete', data);
        });
    }

    private setupBrowserListeners(): void {
        if (!this.browserInLoop) return;

        this.browserInLoop.on('check:complete', (data) => {
            this.state.currentVisualScore = data.score;
            this.emit('visual:check-complete', data);
        });

        this.browserInLoop.on('check:failed', (data) => {
            this.emit('visual:check-failed', data);
        });
    }

    // =========================================================================
    // STATE ACCESS
    // =========================================================================

    getState(): EnhancedBuildState {
        return { ...this.state };
    }

    getAgent(agentId: string): BuildAgent | null {
        return this.activeAgents.get(agentId) || null;
    }

    getFeedbackSummary() {
        return this.feedbackChannel.getSummary(this.config.buildId);
    }

    hasBlockingIssues(): boolean {
        return this.feedbackChannel.hasBlockers(this.config.buildId);
    }

    getBlockingIssues(): FeedbackItem[] {
        return this.feedbackChannel.getBlockers(this.config.buildId);
    }

    /**
     * Get a summary of all the new capabilities in use
     */
    getCapabilitiesSummary(): {
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
                enabled: this.config.enableStreamingFeedback,
                itemsReceived: this.state.feedbackItemsReceived,
            },
            continuousVerification: {
                enabled: this.config.enableContinuousVerification,
                running: this.continuousVerification !== null,
            },
            runtimeDebug: {
                enabled: this.config.enableRuntimeDebug,
            },
            browserInLoop: {
                enabled: this.config.enableBrowserInLoop,
                score: this.state.currentVisualScore,
            },
            humanCheckpoints: {
                enabled: this.config.enableHumanCheckpoints,
                triggered: this.state.humanCheckpointsTriggered,
            },
            multiAgentJudging: {
                enabled: this.config.enableMultiAgentJudging,
            },
            patternLibrary: {
                enabled: this.config.enablePatternLibrary,
                fixesApplied: this.state.patternFixesApplied,
            },
        };
    }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createEnhancedBuildLoop(
    config: Partial<EnhancedBuildConfig> & {
        buildId: string;
        projectId: string;
        userId: string;
        projectPath: string;
        previewUrl: string;
    }
): EnhancedBuildLoopOrchestrator {
    return new EnhancedBuildLoopOrchestrator(config);
}
