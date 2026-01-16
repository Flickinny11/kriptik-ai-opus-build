/**
 * Build Loop Bridge - Bi-directional Integration Between Enhanced & Main Build Loops
 * 
 * This bridge creates a tight coupling between:
 * - EnhancedBuildLoopOrchestrator (Cursor 2.1+ features)
 * - BuildLoopOrchestrator (6-Phase Production Build)
 * 
 * The key insight: The Enhanced Loop provides REAL-TIME verification data
 * that the Main Loop can use to make BETTER decisions during builds.
 * 
 * Features:
 * 1. Shared StreamingFeedbackChannel (no duplicate streams)
 * 2. Metrics synchronization (Enhanced → Main)
 * 3. Build state synchronization (Main → Enhanced)
 * 4. Auto-correction triggers (bidirectional)
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

import type { BuildLoopOrchestrator, BuildLoopState } from './build-loop.js';
import type { EnhancedBuildLoopOrchestrator, EnhancedBuildState } from './enhanced-build-loop.js';
import {
    StreamingFeedbackChannel,
    getStreamingFeedbackChannel,
    type FeedbackItem,
} from '../feedback/streaming-feedback-channel.js';

// =============================================================================
// TYPES
// =============================================================================

export interface BridgeState {
    buildId: string;
    projectId: string;
    userId: string;
    
    // Connection status
    mainLoopConnected: boolean;
    enhancedLoopConnected: boolean;
    feedbackChannelActive: boolean;
    
    // Metrics from both loops
    mainLoopPhase: string;
    enhancedLoopPhase: string;
    
    // Aggregated quality metrics
    verificationScore: number;
    visualScore: number;
    antiSlopScore: number;
    
    // Feedback stats
    totalFeedbackItems: number;
    totalAutoFixes: number;
    pendingBlockers: number;
    
    // Timing
    createdAt: Date;
    lastSyncAt: Date | null;
}

export interface BridgeEvent {
    type: 
        | 'main-loop-phase-change'
        | 'enhanced-loop-phase-change'
        | 'verification-result'
        | 'visual-check-result'
        | 'anti-slop-result'
        | 'blocker-detected'
        | 'auto-fix-applied'
        | 'human-checkpoint-triggered'
        | 'sync-complete';
    timestamp: Date;
    data: Record<string, unknown>;
}

// =============================================================================
// BUILD LOOP BRIDGE
// =============================================================================

export class BuildLoopBridge extends EventEmitter {
    private state: BridgeState;
    private feedbackChannel: StreamingFeedbackChannel;
    
    // References to the orchestrators (set during connect)
    private mainLoop: BuildLoopOrchestrator | null = null;
    private enhancedLoop: EnhancedBuildLoopOrchestrator | null = null;
    
    // Event subscription cleanup functions
    private mainLoopCleanup: (() => void)[] = [];
    private enhancedLoopCleanup: (() => void)[] = [];
    
    constructor(buildId: string, projectId: string, userId: string) {
        super();
        
        this.feedbackChannel = getStreamingFeedbackChannel();
        
        this.state = {
            buildId,
            projectId,
            userId,
            mainLoopConnected: false,
            enhancedLoopConnected: false,
            feedbackChannelActive: false,
            mainLoopPhase: 'pending',
            enhancedLoopPhase: 'pending',
            verificationScore: 100,
            visualScore: 100,
            antiSlopScore: 100,
            totalFeedbackItems: 0,
            totalAutoFixes: 0,
            pendingBlockers: 0,
            createdAt: new Date(),
            lastSyncAt: null,
        };
        
        console.log(`[BuildLoopBridge] Created bridge for build ${buildId}`);
    }
    
    // =========================================================================
    // CONNECTION MANAGEMENT
    // =========================================================================
    
    /**
     * Connect the main BuildLoopOrchestrator
     */
    connectMainLoop(loop: BuildLoopOrchestrator): void {
        this.mainLoop = loop;
        this.state.mainLoopConnected = true;
        
        // Subscribe to main loop events
        const onEvent = (event: { type: string; data: unknown }) => {
            this.handleMainLoopEvent(event);
        };
        
        loop.on('event', onEvent);
        this.mainLoopCleanup.push(() => loop.off('event', onEvent));
        
        // Subscribe to phase changes
        const onPhase = (phase: string) => {
            this.state.mainLoopPhase = phase;
            this.emitBridgeEvent('main-loop-phase-change', { phase });
            this.syncToEnhancedLoop();
        };
        
        loop.on('phase-change', onPhase);
        this.mainLoopCleanup.push(() => loop.off('phase-change', onPhase));
        
        // Subscribe to verification results
        const onVerification = (results: { passed: boolean; score: number; issues: unknown[] }) => {
            this.state.verificationScore = results.score;
            this.emitBridgeEvent('verification-result', results);
            
            // Forward to enhanced loop for pattern learning
            if (this.enhancedLoop && results.issues.length > 0) {
                this.forwardVerificationToEnhanced(results);
            }
        };
        
        loop.on('verification-results', onVerification);
        this.mainLoopCleanup.push(() => loop.off('verification-results', onVerification));
        
        console.log(`[BuildLoopBridge] Connected main loop for build ${this.state.buildId}`);
        this.emit('main-loop-connected');
    }
    
    /**
     * Connect the EnhancedBuildLoopOrchestrator
     */
    connectEnhancedLoop(loop: EnhancedBuildLoopOrchestrator): void {
        this.enhancedLoop = loop;
        this.state.enhancedLoopConnected = true;
        
        // Subscribe to agent feedback
        const onFeedback = (data: { agentId: string; agentName: string; item: FeedbackItem }) => {
            this.state.totalFeedbackItems++;
            
            if (data.item.severity === 'critical' || data.item.severity === 'high') {
                this.state.pendingBlockers++;
                this.emitBridgeEvent('blocker-detected', {
                    item: data.item,
                    agentId: data.agentId,
                    agentName: data.agentName,
                });
            }
            
            // Forward blocking issues to main loop
            if (this.mainLoop && (data.item.severity === 'critical' || data.item.severity === 'high')) {
                this.forwardBlockerToMainLoop(data.item);
            }
        };
        
        loop.on('agent:feedback', onFeedback);
        this.enhancedLoopCleanup.push(() => loop.off('agent:feedback', onFeedback));
        
        // Subscribe to self-corrections
        const onSelfCorrect = (data: { agentId: string; feedbackId: string; totalCorrections: number }) => {
            this.state.totalAutoFixes = data.totalCorrections;
            this.state.pendingBlockers = Math.max(0, this.state.pendingBlockers - 1);
            this.emitBridgeEvent('auto-fix-applied', data);
        };
        
        loop.on('agent:self-corrected', onSelfCorrect);
        this.enhancedLoopCleanup.push(() => loop.off('agent:self-corrected', onSelfCorrect));
        
        // Subscribe to visual checks
        const onVisualCheck = (data: { score: number; issues: unknown[] }) => {
            this.state.visualScore = data.score;
            this.emitBridgeEvent('visual-check-result', data);
            
            // If visual score drops below threshold, notify main loop
            if (this.mainLoop && data.score < 85) {
                this.forwardVisualIssueToMainLoop(data);
            }
        };
        
        loop.on('visual-check', onVisualCheck);
        this.enhancedLoopCleanup.push(() => loop.off('visual-check', onVisualCheck));
        
        // Subscribe to human checkpoints
        const onHumanCheckpoint = (data: { checkpointId: string; reason: string }) => {
            this.emitBridgeEvent('human-checkpoint-triggered', data);
            
            // Pause main loop if critical checkpoint
            if (this.mainLoop) {
                this.mainLoop.pause();
            }
        };
        
        loop.on('human-checkpoint-required', onHumanCheckpoint);
        this.enhancedLoopCleanup.push(() => loop.off('human-checkpoint-required', onHumanCheckpoint));
        
        console.log(`[BuildLoopBridge] Connected enhanced loop for build ${this.state.buildId}`);
        this.emit('enhanced-loop-connected');
    }
    
    /**
     * Initialize the shared feedback channel
     */
    initializeFeedbackChannel(): void {
        // Create a single shared stream for both loops
        const existingStream = this.feedbackChannel.getStream(this.state.buildId);
        
        if (!existingStream) {
            this.feedbackChannel.createStream(
                this.state.buildId,
                `bridge-${this.state.buildId}`
            );
        }
        
        this.state.feedbackChannelActive = true;
        
        // Subscribe to all feedback for metrics
        const unsubscribe = this.feedbackChannel.subscribeAgent(`bridge-${this.state.buildId}`, (item) => {
            this.handleFeedbackItem(item);
        });
        
        this.mainLoopCleanup.push(unsubscribe);
        
        console.log(`[BuildLoopBridge] Feedback channel active for build ${this.state.buildId}`);
    }
    
    // =========================================================================
    // EVENT FORWARDING
    // =========================================================================
    
    /**
     * Handle events from main loop
     */
    private handleMainLoopEvent(event: { type: string; data: unknown }): void {
        // Update state based on event type
        switch (event.type) {
            case 'antislop-verification-passed':
                this.state.antiSlopScore = (event.data as { score: number }).score;
                break;
            case 'phase_complete':
                this.state.mainLoopPhase = `phase-complete-${(event.data as { phase: number }).phase}`;
                break;
        }
        
        // Sync to enhanced loop
        this.syncToEnhancedLoop();
    }
    
    /**
     * Handle feedback items
     */
    private handleFeedbackItem(item: FeedbackItem): void {
        this.state.totalFeedbackItems++;
        
        // Track blockers
        if (item.severity === 'critical' || item.severity === 'high') {
            this.state.pendingBlockers++;
        }
    }
    
    /**
     * Forward verification results to enhanced loop for pattern learning
     */
    private forwardVerificationToEnhanced(results: { passed: boolean; score: number; issues: unknown[] }): void {
        if (!this.enhancedLoop) return;
        
        // Enhanced loop can learn from these patterns
        this.enhancedLoop.emit('main-loop-verification', {
            source: 'main-loop',
            results,
            timestamp: new Date(),
        });
    }
    
    /**
     * Forward blocking issues to main loop for consideration
     */
    private forwardBlockerToMainLoop(item: FeedbackItem): void {
        if (!this.mainLoop) return;
        
        // Inject the feedback into the main loop's channel
        this.feedbackChannel.injectFeedback(
            this.state.buildId,
            item.category,
            item.severity,
            `[EnhancedLoop] ${item.message}`,
            {
                file: item.file,
                line: item.line,
                column: item.column,
                autoFixable: item.autoFixable,
                autoFix: item.autoFix,
                context: { source: 'enhanced-loop' },
            }
        );
    }
    
    /**
     * Forward visual issues to main loop
     */
    private forwardVisualIssueToMainLoop(data: { score: number; issues: unknown[] }): void {
        if (!this.mainLoop) return;
        
        this.feedbackChannel.injectFeedback(
            this.state.buildId,
            'visual',
            data.score < 70 ? 'high' : 'medium',
            `Visual quality score: ${data.score}/100 - ${(data.issues as unknown[]).length} issues found`,
            {
                context: {
                    score: data.score,
                    issues: data.issues,
                    source: 'enhanced-loop-browser',
                },
            }
        );
    }
    
    // =========================================================================
    // SYNCHRONIZATION
    // =========================================================================
    
    /**
     * Sync main loop state to enhanced loop
     */
    private syncToEnhancedLoop(): void {
        if (!this.enhancedLoop || !this.mainLoop) return;
        
        const mainState = this.mainLoop.getState();
        
        this.enhancedLoop.emit('main-loop-state-sync', {
            phase: mainState.currentPhase,
            status: mainState.status,
            stage: mainState.currentStage,
            stageProgress: mainState.stageProgress,
            timestamp: new Date(),
        });
        
        this.state.lastSyncAt = new Date();
    }
    
    /**
     * Get aggregated quality metrics from both loops
     */
    getAggregatedMetrics(): {
        verificationScore: number;
        visualScore: number;
        antiSlopScore: number;
        overallQuality: number;
        feedbackStats: { total: number; autoFixes: number; pendingBlockers: number };
    } {
        // Weighted average of all quality scores
        const overallQuality = Math.round(
            (this.state.verificationScore * 0.4) +
            (this.state.visualScore * 0.3) +
            (this.state.antiSlopScore * 0.3)
        );
        
        return {
            verificationScore: this.state.verificationScore,
            visualScore: this.state.visualScore,
            antiSlopScore: this.state.antiSlopScore,
            overallQuality,
            feedbackStats: {
                total: this.state.totalFeedbackItems,
                autoFixes: this.state.totalAutoFixes,
                pendingBlockers: this.state.pendingBlockers,
            },
        };
    }
    
    /**
     * Check if the build meets quality thresholds
     */
    meetsQualityThresholds(config?: { verification?: number; visual?: number; antiSlop?: number }): boolean {
        const thresholds = {
            verification: config?.verification ?? 90,
            visual: config?.visual ?? 85,
            antiSlop: config?.antiSlop ?? 85,
        };
        
        return (
            this.state.verificationScore >= thresholds.verification &&
            this.state.visualScore >= thresholds.visual &&
            this.state.antiSlopScore >= thresholds.antiSlop &&
            this.state.pendingBlockers === 0
        );
    }
    
    // =========================================================================
    // UTILITY
    // =========================================================================
    
    /**
     * Emit a bridge event
     */
    private emitBridgeEvent(type: BridgeEvent['type'], data: Record<string, unknown>): void {
        const event: BridgeEvent = {
            type,
            timestamp: new Date(),
            data,
        };
        
        this.emit('bridge-event', event);
    }
    
    /**
     * Get bridge state
     */
    getState(): BridgeState {
        return { ...this.state };
    }

    /**
     * Receive credentials for a running build and forward to the main loop.
     * This is used when credentials_required event is emitted during Phase 2.
     *
     * @param credentials - Key-value pairs of credential values (e.g., { STRIPE_SECRET_KEY: 'sk_...' })
     * @returns Result indicating success and any errors
     */
    async receiveCredentials(credentials: Record<string, string>): Promise<{ success: boolean; errors: string[] }> {
        if (!this.mainLoop) {
            return {
                success: false,
                errors: ['Main build loop not connected - cannot receive credentials'],
            };
        }

        // Check if the main loop is actually waiting for credentials
        const mainState = this.mainLoop.getState();
        if (mainState.status !== 'waiting_credentials') {
            console.warn(`[BuildLoopBridge] receiveCredentials called but build status is ${mainState.status}, not waiting_credentials`);
        }

        console.log(`[BuildLoopBridge] Forwarding ${Object.keys(credentials).length} credentials to main loop for build ${this.state.buildId}`);

        try {
            const result = await this.mainLoop.receiveCredentials(credentials);

            if (result.success) {
                this.emitBridgeEvent('auto-fix-applied', {
                    type: 'credentials-received',
                    count: Object.keys(credentials).length,
                });
            }

            return result;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error receiving credentials';
            console.error(`[BuildLoopBridge] Error forwarding credentials:`, error);
            return {
                success: false,
                errors: [errorMsg],
            };
        }
    }

    /**
     * Check if the build is waiting for credentials
     */
    isWaitingForCredentials(): boolean {
        if (!this.mainLoop) {
            return false;
        }
        return this.mainLoop.getState().status === 'waiting_credentials';
    }

    /**
     * Clean up the bridge
     */
    cleanup(): void {
        // Run cleanup functions
        for (const cleanup of this.mainLoopCleanup) {
            try { cleanup(); } catch (e) { /* ignore */ }
        }
        for (const cleanup of this.enhancedLoopCleanup) {
            try { cleanup(); } catch (e) { /* ignore */ }
        }
        
        this.mainLoopCleanup = [];
        this.enhancedLoopCleanup = [];
        
        // Close feedback stream if we created it
        if (this.state.feedbackChannelActive) {
            try {
                this.feedbackChannel.closeStream(this.state.buildId);
            } catch (e) { /* ignore */ }
        }
        
        this.mainLoop = null;
        this.enhancedLoop = null;
        
        console.log(`[BuildLoopBridge] Cleaned up bridge for build ${this.state.buildId}`);
        this.emit('cleanup-complete');
    }
}

// =============================================================================
// FACTORY
// =============================================================================

const activeBridges: Map<string, BuildLoopBridge> = new Map();

/**
 * Create or get a BuildLoopBridge for a build
 */
export function getOrCreateBridge(buildId: string, projectId: string, userId: string): BuildLoopBridge {
    const existing = activeBridges.get(buildId);
    if (existing) {
        return existing;
    }
    
    const bridge = new BuildLoopBridge(buildId, projectId, userId);
    activeBridges.set(buildId, bridge);
    
    // Auto-cleanup on completion
    bridge.on('cleanup-complete', () => {
        activeBridges.delete(buildId);
    });
    
    return bridge;
}

/**
 * Get an existing bridge
 */
export function getBridge(buildId: string): BuildLoopBridge | null {
    return activeBridges.get(buildId) || null;
}

/**
 * Clean up a bridge
 */
export function cleanupBridge(buildId: string): void {
    const bridge = activeBridges.get(buildId);
    if (bridge) {
        bridge.cleanup();
    }
}
