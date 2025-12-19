/**
 * Streaming Feedback Channel - Real-Time Verification → Builder Communication
 *
 * This is the CRITICAL missing piece that makes Cursor 2.1 so effective.
 * Instead of verification running at checkpoints and storing results in DB,
 * this creates a LIVE CHANNEL where:
 *
 * 1. Verification issues stream DIRECTLY to the active building agent
 * 2. The builder can self-correct BEFORE completing the task
 * 3. No async database lookups - pure in-memory event stream
 *
 * This closes the feedback loop from "minutes" to "milliseconds".
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

export type FeedbackSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FeedbackCategory =
    | 'error'           // TypeScript/runtime errors
    | 'placeholder'     // TODO, FIXME, lorem ipsum
    | 'security'        // Exposed keys, injection vulnerabilities
    | 'visual'          // Anti-slop, design issues
    | 'quality'         // Code quality, DRY violations
    | 'performance'     // Performance issues
    | 'suggestion';     // Improvement suggestions

export interface FeedbackItem {
    id: string;
    timestamp: Date;
    category: FeedbackCategory;
    severity: FeedbackSeverity;
    message: string;
    file?: string;
    line?: number;
    column?: number;
    suggestion?: string;
    autoFixable: boolean;
    autoFix?: {
        description: string;
        replacement: string;
    };
    context?: Record<string, unknown>;
}

export interface FeedbackStream {
    buildId: string;
    agentId: string;
    startedAt: Date;
    items: FeedbackItem[];
    blockers: FeedbackItem[];
    unacknowledged: FeedbackItem[];
}

export interface FeedbackAcknowledgment {
    feedbackId: string;
    agentId: string;
    action: 'fixed' | 'ignored' | 'deferred';
    timestamp: Date;
    note?: string;
}

// =============================================================================
// STREAMING FEEDBACK CHANNEL
// =============================================================================

export class StreamingFeedbackChannel extends EventEmitter {
    private streams: Map<string, FeedbackStream> = new Map(); // buildId -> stream
    private agentStreams: Map<string, string> = new Map(); // agentId -> buildId
    private acknowledgments: Map<string, FeedbackAcknowledgment[]> = new Map();

    // Feedback item cache for deduplication
    private recentFeedback: Map<string, Set<string>> = new Map(); // buildId -> hash set
    private readonly DEDUP_WINDOW_MS = 30000; // 30 seconds

    constructor() {
        super();
        this.setMaxListeners(100); // Support many agent listeners
    }

    // =========================================================================
    // STREAM MANAGEMENT
    // =========================================================================

    /**
     * Create a new feedback stream for a build
     */
    createStream(buildId: string, agentId: string): FeedbackStream {
        const stream: FeedbackStream = {
            buildId,
            agentId,
            startedAt: new Date(),
            items: [],
            blockers: [],
            unacknowledged: [],
        };

        this.streams.set(buildId, stream);
        this.agentStreams.set(agentId, buildId);
        this.recentFeedback.set(buildId, new Set());
        this.acknowledgments.set(buildId, []);

        console.log(`[StreamingFeedback] Created stream for build ${buildId}, agent ${agentId}`);
        this.emit('stream:created', { buildId, agentId });

        return stream;
    }

    /**
     * Register an agent to receive feedback for a build
     */
    registerAgent(agentId: string, buildId: string): void {
        this.agentStreams.set(agentId, buildId);
        console.log(`[StreamingFeedback] Registered agent ${agentId} for build ${buildId}`);
    }

    /**
     * Get the feedback stream for a build
     */
    getStream(buildId: string): FeedbackStream | null {
        return this.streams.get(buildId) || null;
    }

    /**
     * Get the build ID for an agent
     */
    getBuildIdForAgent(agentId: string): string | null {
        return this.agentStreams.get(agentId) || null;
    }

    /**
     * Close a feedback stream
     */
    closeStream(buildId: string): void {
        const stream = this.streams.get(buildId);
        if (stream) {
            // Remove agent mappings
            for (const [agentId, bid] of this.agentStreams) {
                if (bid === buildId) {
                    this.agentStreams.delete(agentId);
                }
            }

            this.streams.delete(buildId);
            this.recentFeedback.delete(buildId);
            this.acknowledgments.delete(buildId);

            console.log(`[StreamingFeedback] Closed stream for build ${buildId}`);
            this.emit('stream:closed', { buildId, totalItems: stream.items.length });
        }
    }

    // =========================================================================
    // FEEDBACK INJECTION (from verification agents)
    // =========================================================================

    /**
     * Inject feedback into a stream - THE CRITICAL METHOD
     * This is called by verification agents to send issues DIRECTLY to builders
     */
    injectFeedback(
        buildId: string,
        category: FeedbackCategory,
        severity: FeedbackSeverity,
        message: string,
        options?: {
            file?: string;
            line?: number;
            column?: number;
            suggestion?: string;
            autoFixable?: boolean;
            autoFix?: { description: string; replacement: string };
            context?: Record<string, unknown>;
        }
    ): FeedbackItem | null {
        const stream = this.streams.get(buildId);
        if (!stream) {
            console.warn(`[StreamingFeedback] No stream for build ${buildId}`);
            return null;
        }

        // Deduplicate: create hash of message + file + line
        const hash = this.hashFeedback(message, options?.file, options?.line);
        const recentHashes = this.recentFeedback.get(buildId);
        if (recentHashes?.has(hash)) {
            return null; // Skip duplicate
        }
        recentHashes?.add(hash);

        // Schedule hash cleanup
        setTimeout(() => {
            recentHashes?.delete(hash);
        }, this.DEDUP_WINDOW_MS);

        const item: FeedbackItem = {
            id: uuidv4(),
            timestamp: new Date(),
            category,
            severity,
            message,
            file: options?.file,
            line: options?.line,
            column: options?.column,
            suggestion: options?.suggestion,
            autoFixable: options?.autoFixable ?? false,
            autoFix: options?.autoFix,
            context: options?.context,
        };

        // Add to stream
        stream.items.push(item);
        stream.unacknowledged.push(item);

        // Track blockers separately for quick access
        if (severity === 'critical' || severity === 'high') {
            stream.blockers.push(item);
        }

        // EMIT TO ALL LISTENERS - this is what makes it real-time
        this.emit('feedback', { buildId, item });
        this.emit(`feedback:${buildId}`, item);
        this.emit(`feedback:${category}`, { buildId, item });

        // Emit severity-specific events for urgent issues
        if (severity === 'critical') {
            this.emit('feedback:critical', { buildId, item });
        }

        console.log(`[StreamingFeedback] Injected ${severity} ${category}: ${message.substring(0, 50)}...`);

        return item;
    }

    /**
     * Inject multiple feedback items at once
     */
    injectBatch(buildId: string, items: Array<Omit<FeedbackItem, 'id' | 'timestamp'>>): FeedbackItem[] {
        const injected: FeedbackItem[] = [];
        for (const item of items) {
            const result = this.injectFeedback(buildId, item.category, item.severity, item.message, {
                file: item.file,
                line: item.line,
                column: item.column,
                suggestion: item.suggestion,
                autoFixable: item.autoFixable,
                autoFix: item.autoFix,
                context: item.context,
            });
            if (result) {
                injected.push(result);
            }
        }
        return injected;
    }

    // =========================================================================
    // FEEDBACK CONSUMPTION (by building agents)
    // =========================================================================

    /**
     * Subscribe to feedback for an agent's build
     * Returns an unsubscribe function
     */
    subscribeAgent(
        agentId: string,
        callback: (item: FeedbackItem) => void
    ): () => void {
        const buildId = this.agentStreams.get(agentId);
        if (!buildId) {
            console.warn(`[StreamingFeedback] Agent ${agentId} not registered to any build`);
            return () => { };
        }

        const listener = (item: FeedbackItem) => {
            callback(item);
        };

        this.on(`feedback:${buildId}`, listener);

        return () => {
            this.off(`feedback:${buildId}`, listener);
        };
    }

    /**
     * Get all unacknowledged feedback for a build
     */
    getUnacknowledged(buildId: string): FeedbackItem[] {
        const stream = this.streams.get(buildId);
        return stream?.unacknowledged || [];
    }

    /**
     * Get all blockers for a build
     */
    getBlockers(buildId: string): FeedbackItem[] {
        const stream = this.streams.get(buildId);
        return stream?.blockers.filter(b =>
            !this.acknowledgments.get(buildId)?.some(a =>
                a.feedbackId === b.id && a.action === 'fixed'
            )
        ) || [];
    }

    /**
     * Check if a build has any blocking issues
     */
    hasBlockers(buildId: string): boolean {
        return this.getBlockers(buildId).length > 0;
    }

    /**
     * Acknowledge a feedback item (mark as handled)
     */
    acknowledgeFeedback(
        feedbackId: string,
        agentId: string,
        action: 'fixed' | 'ignored' | 'deferred',
        note?: string
    ): void {
        const buildId = this.agentStreams.get(agentId);
        if (!buildId) return;

        const stream = this.streams.get(buildId);
        if (!stream) return;

        const ack: FeedbackAcknowledgment = {
            feedbackId,
            agentId,
            action,
            timestamp: new Date(),
            note,
        };

        this.acknowledgments.get(buildId)?.push(ack);

        // Remove from unacknowledged
        stream.unacknowledged = stream.unacknowledged.filter(i => i.id !== feedbackId);

        // Remove from blockers if fixed
        if (action === 'fixed') {
            stream.blockers = stream.blockers.filter(i => i.id !== feedbackId);
        }

        this.emit('feedback:acknowledged', { buildId, feedbackId, action, agentId });
        console.log(`[StreamingFeedback] Feedback ${feedbackId} acknowledged: ${action}`);
    }

    // =========================================================================
    // FEEDBACK QUERIES
    // =========================================================================

    /**
     * Get feedback by category
     */
    getFeedbackByCategory(buildId: string, category: FeedbackCategory): FeedbackItem[] {
        const stream = this.streams.get(buildId);
        return stream?.items.filter(i => i.category === category) || [];
    }

    /**
     * Get feedback by file
     */
    getFeedbackForFile(buildId: string, filePath: string): FeedbackItem[] {
        const stream = this.streams.get(buildId);
        return stream?.items.filter(i => i.file === filePath) || [];
    }

    /**
     * Get feedback summary
     */
    getSummary(buildId: string): {
        total: number;
        bySeverity: Record<FeedbackSeverity, number>;
        byCategory: Record<FeedbackCategory, number>;
        blockers: number;
        unacknowledged: number;
    } {
        const stream = this.streams.get(buildId);
        if (!stream) {
            return {
                total: 0,
                bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
                byCategory: { error: 0, placeholder: 0, security: 0, visual: 0, quality: 0, performance: 0, suggestion: 0 },
                blockers: 0,
                unacknowledged: 0,
            };
        }

        const bySeverity: Record<FeedbackSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
        const byCategory: Record<FeedbackCategory, number> = { error: 0, placeholder: 0, security: 0, visual: 0, quality: 0, performance: 0, suggestion: 0 };

        for (const item of stream.items) {
            bySeverity[item.severity]++;
            byCategory[item.category]++;
        }

        return {
            total: stream.items.length,
            bySeverity,
            byCategory,
            blockers: this.getBlockers(buildId).length,
            unacknowledged: stream.unacknowledged.length,
        };
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private hashFeedback(message: string, file?: string, line?: number): string {
        return `${message.substring(0, 100)}|${file || ''}|${line || ''}`;
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let feedbackChannel: StreamingFeedbackChannel | null = null;

export function getStreamingFeedbackChannel(): StreamingFeedbackChannel {
    if (!feedbackChannel) {
        feedbackChannel = new StreamingFeedbackChannel();
    }
    return feedbackChannel;
}

export function createStreamingFeedbackChannel(): StreamingFeedbackChannel {
    return new StreamingFeedbackChannel();
}
