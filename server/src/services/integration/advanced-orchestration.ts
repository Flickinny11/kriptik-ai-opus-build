/**
 * Advanced Orchestration Integration
 *
 * Wires together the 4 advanced features:
 * 1. Soft Interrupts - Mid-generation user input without stopping
 * 2. Continuous Verification - Parallel verification during generation
 * 3. Live Video Streaming - Real-time browser feedback to frontend
 * 4. Shadow Model Active Use - Learned patterns influence routing
 *
 * This service coordinates these features across all generation paths.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
    createSoftInterruptManager,
    type SoftInterruptManager,
    type ClassifiedInterrupt,
    type InterruptApplicationResult,
} from '../soft-interrupt/interrupt-manager.js';
import {
    createVerificationSwarm,
    type VerificationSwarm,
    type CombinedVerificationResult,
} from '../verification/swarm.js';
import {
    getGeminiVideoAnalyzer,
    type GeminiVideoAnalyzer,
    type VideoAnalysisResult,
} from '../verification/gemini-video-analyzer.js';
import { db } from '../../db.js';
import { learningPatterns, learningStrategies } from '../../schema.js';
import { desc, eq, and, gte } from 'drizzle-orm';

// =============================================================================
// TYPES
// =============================================================================

export interface AdvancedOrchestrationConfig {
    projectId: string;
    userId: string;
    sessionId: string;
    /** Enable soft interrupt checking at tool boundaries */
    enableInterrupts?: boolean;
    /** Enable continuous background verification */
    enableContinuousVerification?: boolean;
    /** Enable live video streaming to frontend */
    enableVideoStreaming?: boolean;
    /** Enable shadow model pattern injection */
    enableShadowPatterns?: boolean;
    /** Verification interval in ms (default 5000) */
    verificationIntervalMs?: number;
    /** Video capture interval in ms (default 2000) */
    videoCaptureIntervalMs?: number;
}

export interface GenerationContext {
    prompt: string;
    files: Map<string, string>;
    currentPhase: string;
    currentTool?: string;
    startTime: number;
}

export interface InterruptCheckResult {
    hasInterrupt: boolean;
    interrupt?: ClassifiedInterrupt;
    result?: InterruptApplicationResult;
    shouldHalt: boolean;
    contextToInject?: string;
}

export interface ContinuousVerificationState {
    running: boolean;
    lastResult?: CombinedVerificationResult;
    checkCount: number;
    issuesFound: number;
    lastCheckTime?: number;
}

export interface VideoStreamState {
    streaming: boolean;
    frameCount: number;
    lastAnalysis?: VideoAnalysisResult;
    issuesDetected: string[];
}

export interface ShadowPatternContext {
    patterns: Array<{
        id: string;
        name: string;
        context: string;
        successRate: number;
    }>;
    strategies: Array<{
        id: string;
        domain: string;
        parameters: Record<string, unknown>;
    }>;
}

// =============================================================================
// ADVANCED ORCHESTRATION SERVICE
// =============================================================================

export class AdvancedOrchestrationService extends EventEmitter {
    private config: Required<AdvancedOrchestrationConfig>;
    private interruptManager: SoftInterruptManager;
    private verificationSwarm: VerificationSwarm | null = null;
    private videoAnalyzer: GeminiVideoAnalyzer | null = null;

    // State tracking
    private context: GenerationContext | null = null;
    private verificationState: ContinuousVerificationState = {
        running: false,
        checkCount: 0,
        issuesFound: 0,
    };
    private videoState: VideoStreamState = {
        streaming: false,
        frameCount: 0,
        issuesDetected: [],
    };
    private shadowPatterns: ShadowPatternContext = {
        patterns: [],
        strategies: [],
    };

    // Intervals
    private verificationInterval: NodeJS.Timeout | null = null;
    private videoInterval: NodeJS.Timeout | null = null;

    constructor(config: AdvancedOrchestrationConfig) {
        super();

        this.config = {
            projectId: config.projectId,
            userId: config.userId,
            sessionId: config.sessionId,
            enableInterrupts: config.enableInterrupts ?? true,
            enableContinuousVerification: config.enableContinuousVerification ?? true,
            enableVideoStreaming: config.enableVideoStreaming ?? false, // Opt-in for video
            enableShadowPatterns: config.enableShadowPatterns ?? true,
            verificationIntervalMs: config.verificationIntervalMs ?? 5000,
            videoCaptureIntervalMs: config.videoCaptureIntervalMs ?? 2000,
        };

        this.interruptManager = createSoftInterruptManager();
    }

    // =========================================================================
    // LIFECYCLE
    // =========================================================================

    /**
     * Initialize the orchestration service for a generation session
     */
    async initialize(prompt: string): Promise<void> {
        this.context = {
            prompt,
            files: new Map(),
            currentPhase: 'initializing',
            startTime: Date.now(),
        };

        console.log(`[AdvancedOrchestration] Initializing for session ${this.config.sessionId}`);

        // Load shadow patterns if enabled
        if (this.config.enableShadowPatterns) {
            await this.loadShadowPatterns();
        }

        // Start continuous verification if enabled
        if (this.config.enableContinuousVerification) {
            this.startContinuousVerification();
        }

        // Start video streaming if enabled
        if (this.config.enableVideoStreaming) {
            this.startVideoStreaming();
        }

        this.emit('initialized', {
            sessionId: this.config.sessionId,
            features: {
                interrupts: this.config.enableInterrupts,
                continuousVerification: this.config.enableContinuousVerification,
                videoStreaming: this.config.enableVideoStreaming,
                shadowPatterns: this.config.enableShadowPatterns,
            },
            shadowPatterns: this.shadowPatterns.patterns.length,
            shadowStrategies: this.shadowPatterns.strategies.length,
        });
    }

    /**
     * Shutdown the orchestration service
     */
    shutdown(): void {
        console.log(`[AdvancedOrchestration] Shutting down session ${this.config.sessionId}`);

        this.stopContinuousVerification();
        this.stopVideoStreaming();

        this.context = null;
        this.emit('shutdown', { sessionId: this.config.sessionId });
    }

    // =========================================================================
    // SOFT INTERRUPTS
    // =========================================================================

    /**
     * Check for pending interrupts at a tool boundary
     * Call this between tool executions in the generation loop
     */
    async checkInterrupts(agentId?: string): Promise<InterruptCheckResult> {
        if (!this.config.enableInterrupts) {
            return { hasInterrupt: false, shouldHalt: false };
        }

        const interrupts = await this.interruptManager.getInterruptsAtToolBoundary(
            this.config.sessionId,
            agentId || this.config.userId
        );

        if (interrupts.length === 0) {
            return { hasInterrupt: false, shouldHalt: false };
        }

        // Process the highest priority interrupt
        const interrupt = interrupts[0];
        const result = await this.interruptManager.applyInterrupt(
            interrupt,
            agentId || this.config.userId
        );

        // Emit interrupt event
        this.emit('interrupt', {
            interrupt,
            result,
            phase: this.context?.currentPhase,
        });

        return {
            hasInterrupt: true,
            interrupt,
            result,
            shouldHalt: interrupt.type === 'HALT',
            contextToInject: result.contextInjected,
        };
    }

    /**
     * Submit a user interrupt
     */
    async submitInterrupt(message: string, agentId?: string): Promise<ClassifiedInterrupt> {
        return this.interruptManager.submitInterrupt(
            this.config.sessionId,
            message,
            agentId
        );
    }

    /**
     * Update the execution context for interrupt classification
     */
    updateContext(phase: string, tool?: string): void {
        if (this.context) {
            this.context.currentPhase = phase;
            this.context.currentTool = tool;
        }

        this.interruptManager.updateAgentContext(
            this.config.sessionId,
            this.config.userId,
            phase,
            tool
        );
    }

    // =========================================================================
    // CONTINUOUS VERIFICATION
    // =========================================================================

    /**
     * Start continuous background verification
     */
    private startContinuousVerification(): void {
        if (this.verificationState.running) return;

        this.verificationSwarm = createVerificationSwarm(
            this.config.sessionId,
            this.config.projectId,
            this.config.userId
        );

        this.verificationState.running = true;

        // Run verification on interval
        this.verificationInterval = setInterval(async () => {
            await this.runVerificationCheck();
        }, this.config.verificationIntervalMs);

        console.log(`[AdvancedOrchestration] Started continuous verification (${this.config.verificationIntervalMs}ms interval)`);
        this.emit('verification_started', { intervalMs: this.config.verificationIntervalMs });
    }

    /**
     * Stop continuous verification
     */
    private stopContinuousVerification(): void {
        if (this.verificationInterval) {
            clearInterval(this.verificationInterval);
            this.verificationInterval = null;
        }

        if (this.verificationSwarm) {
            this.verificationSwarm.stop();
            this.verificationSwarm = null;
        }

        this.verificationState.running = false;
        console.log(`[AdvancedOrchestration] Stopped continuous verification`);
    }

    /**
     * Run a single verification check
     */
    private async runVerificationCheck(): Promise<void> {
        if (!this.context || !this.verificationSwarm) return;

        this.verificationState.checkCount++;
        this.verificationState.lastCheckTime = Date.now();

        try {
            // Create minimal feature for verification
            const feature = {
                id: this.config.sessionId,
                name: 'current-generation',
                description: this.context.prompt.slice(0, 200),
                files: Array.from(this.context.files.keys()),
            };

            const result = await this.verificationSwarm.verifyFeature(
                feature as any,
                this.context.files
            );

            this.verificationState.lastResult = result;

            // Count issues
            const issueCount = result.blockers.length +
                (result.results.errorCheck?.issues?.length || 0) +
                (result.results.codeQuality?.issues?.length || 0);

            if (issueCount > 0) {
                this.verificationState.issuesFound += issueCount;

                // Emit issue event for real-time feedback
                this.emit('verification_issue', {
                    verdict: result.verdict,
                    score: result.overallScore,
                    blockers: result.blockers,
                    checkNumber: this.verificationState.checkCount,
                });
            }

            // Emit verification result
            this.emit('verification_result', {
                verdict: result.verdict,
                score: result.overallScore,
                checkNumber: this.verificationState.checkCount,
                issueCount,
            });

        } catch (error) {
            console.error('[AdvancedOrchestration] Verification check failed:', error);
        }
    }

    /**
     * Get current verification state
     */
    getVerificationState(): ContinuousVerificationState {
        return { ...this.verificationState };
    }

    /**
     * Update files for verification
     */
    updateFiles(files: Map<string, string>): void {
        if (this.context) {
            this.context.files = files;
        }
    }

    // =========================================================================
    // VIDEO STREAMING
    // =========================================================================

    /**
     * Start live video streaming to frontend
     */
    private startVideoStreaming(): void {
        if (this.videoState.streaming) return;

        try {
            this.videoAnalyzer = getGeminiVideoAnalyzer();
            this.videoState.streaming = true;

            console.log(`[AdvancedOrchestration] Started video streaming (${this.config.videoCaptureIntervalMs}ms interval)`);
            this.emit('video_started', { intervalMs: this.config.videoCaptureIntervalMs });

            // Note: Frame capture happens via analyzeVideoFrame() which is called
            // from external sources (browser automation, puppeteer, etc.)
            // For fully autonomous capture, we could add a browser connection here,
            // but for now frames are pushed by the caller.
        } catch (error) {
            console.warn('[AdvancedOrchestration] Video streaming not available:', error);
            this.config.enableVideoStreaming = false;
        }
    }

    /**
     * Check if video streaming is active
     */
    isVideoStreamingActive(): boolean {
        return this.videoState.streaming && this.videoAnalyzer !== null;
    }

    /**
     * Stop video streaming
     */
    private stopVideoStreaming(): void {
        if (this.videoInterval) {
            clearInterval(this.videoInterval);
            this.videoInterval = null;
        }

        this.videoAnalyzer = null;
        this.videoState.streaming = false;
        console.log(`[AdvancedOrchestration] Stopped video streaming`);
    }

    /**
     * Analyze a video frame from the browser
     */
    async analyzeVideoFrame(frameData: {
        base64: string;
        width: number;
        height: number;
        timestamp: number;
    }): Promise<VideoAnalysisResult | null> {
        if (!this.videoAnalyzer) return null;

        this.videoState.frameCount++;

        try {
            // Convert base64 to Buffer for VideoFrame.data
            const frameBuffer = Buffer.from(frameData.base64, 'base64');
            const result = await this.videoAnalyzer.analyzeFrames([{
                timestamp: frameData.timestamp,
                data: frameBuffer,
                width: frameData.width,
                height: frameData.height,
            }]);

            this.videoState.lastAnalysis = result;

            // Track detected issues from errors, designViolations, and accessibilityIssues
            const allIssues = [
                ...result.errors.map(e => e.message),
                ...result.designViolations.map(d => d.description),
                ...result.accessibilityIssues.map(a => a.description),
            ];

            for (const issue of allIssues) {
                if (!this.videoState.issuesDetected.includes(issue)) {
                    this.videoState.issuesDetected.push(issue);
                }
            }

            // Emit video analysis result
            this.emit('video_analysis', {
                frameNumber: this.videoState.frameCount,
                score: result.overallScore,
                errors: result.errors.length,
                designViolations: result.designViolations.length,
                accessibilityIssues: result.accessibilityIssues.length,
                uiElements: result.uiElements?.length || 0,
            });

            return result;
        } catch (error) {
            console.error('[AdvancedOrchestration] Video analysis failed:', error);
            return null;
        }
    }

    /**
     * Get current video streaming state
     */
    getVideoState(): VideoStreamState {
        return { ...this.videoState };
    }

    // =========================================================================
    // SHADOW MODEL PATTERNS
    // =========================================================================

    /**
     * Load learned patterns from shadow models for routing enhancement
     */
    private async loadShadowPatterns(): Promise<void> {
        try {
            // Load top performing patterns (successRate is 0-100)
            const patterns = await db
                .select({
                    id: learningPatterns.id,
                    name: learningPatterns.name,
                    category: learningPatterns.category,
                    successRate: learningPatterns.successRate,
                })
                .from(learningPatterns)
                .where(
                    gte(learningPatterns.successRate, 70) // Only patterns with 70%+ success
                )
                .orderBy(desc(learningPatterns.successRate))
                .limit(20);

            this.shadowPatterns.patterns = patterns.map(p => ({
                id: p.id,
                name: p.name,
                context: p.category, // Use category as context
                successRate: p.successRate || 0,
            }));

            // Load active strategies
            const strategies = await db
                .select({
                    id: learningStrategies.id,
                    domain: learningStrategies.domain,
                    name: learningStrategies.name,
                    description: learningStrategies.description,
                    contextsEffective: learningStrategies.contextsEffective,
                })
                .from(learningStrategies)
                .where(eq(learningStrategies.isActive, true))
                .orderBy(desc(learningStrategies.successRate))
                .limit(10);

            this.shadowPatterns.strategies = strategies.map(s => ({
                id: s.id,
                domain: s.domain,
                parameters: {
                    name: s.name,
                    description: s.description,
                    contextsEffective: s.contextsEffective || [],
                },
            }));

            console.log(`[AdvancedOrchestration] Loaded ${this.shadowPatterns.patterns.length} patterns, ${this.shadowPatterns.strategies.length} strategies`);

        } catch (error) {
            console.error('[AdvancedOrchestration] Failed to load shadow patterns:', error);
        }
    }

    /**
     * Get shadow patterns for routing enhancement
     */
    getShadowPatterns(): ShadowPatternContext {
        return { ...this.shadowPatterns };
    }

    /**
     * Get pattern-based routing hints
     * These hints should be used to influence model selection
     */
    getRoutingHints(): {
        preferredModels: string[];
        avoidPatterns: string[];
        successfulApproaches: string[];
    } {
        const hints = {
            preferredModels: [] as string[],
            avoidPatterns: [] as string[],
            successfulApproaches: [] as string[],
        };

        // Analyze patterns for routing hints
        for (const pattern of this.shadowPatterns.patterns) {
            if (pattern.successRate >= 0.9) {
                hints.successfulApproaches.push(pattern.name);
            }
        }

        // Analyze strategies for model preferences
        for (const strategy of this.shadowPatterns.strategies) {
            if (strategy.domain === 'model_selection' && strategy.parameters.preferredModel) {
                hints.preferredModels.push(strategy.parameters.preferredModel as string);
            }
            if (strategy.domain === 'error_prevention' && strategy.parameters.avoidPattern) {
                hints.avoidPatterns.push(strategy.parameters.avoidPattern as string);
            }
        }

        return hints;
    }

    /**
     * Build enhanced prompt with shadow pattern context
     */
    buildEnhancedPrompt(basePrompt: string): string {
        if (!this.config.enableShadowPatterns || this.shadowPatterns.patterns.length === 0) {
            return basePrompt;
        }

        const patternContext = this.shadowPatterns.patterns
            .slice(0, 5) // Top 5 patterns
            .map(p => `- ${p.name} (${Math.round(p.successRate * 100)}% success): ${p.context.slice(0, 100)}`)
            .join('\n');

        return `## LEARNED PATTERNS (Use these proven approaches)

${patternContext}

---

${basePrompt}`;
    }
}

// =============================================================================
// FACTORY
// =============================================================================

let orchestrationInstances: Map<string, AdvancedOrchestrationService> = new Map();

/**
 * Get or create an advanced orchestration service for a session
 */
export function getAdvancedOrchestration(
    config: AdvancedOrchestrationConfig
): AdvancedOrchestrationService {
    const key = config.sessionId;

    if (!orchestrationInstances.has(key)) {
        orchestrationInstances.set(key, new AdvancedOrchestrationService(config));
    }

    return orchestrationInstances.get(key)!;
}

/**
 * Create a new advanced orchestration service
 */
export function createAdvancedOrchestration(
    config: AdvancedOrchestrationConfig
): AdvancedOrchestrationService {
    return new AdvancedOrchestrationService(config);
}

/**
 * Shutdown and remove an orchestration instance
 */
export function shutdownOrchestration(sessionId: string): void {
    const instance = orchestrationInstances.get(sessionId);
    if (instance) {
        instance.shutdown();
        orchestrationInstances.delete(sessionId);
    }
}

/**
 * Shutdown all orchestration instances
 */
export function shutdownAllOrchestrations(): void {
    for (const [sessionId, instance] of orchestrationInstances) {
        instance.shutdown();
    }
    orchestrationInstances.clear();
}
