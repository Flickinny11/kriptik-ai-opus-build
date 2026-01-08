/**
 * Real-Time Learning Service
 *
 * Implements continuous learning during build operations rather than
 * just batch processing at the end. Captures events as they happen
 * and provides immediate feedback incorporation.
 */

import { db } from '../../db.js';
import { learningRealtimeEvents, learningDecisionTraces } from '../../schema.js';
import { eq, desc, sql, and, gte, between } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

// Local type definitions for Real-Time Learning
export interface RealtimeEvent {
    id: string;
    buildSessionId: string;
    eventType: string;
    data: Record<string, unknown>;
    phase?: string;
    agentId?: string;
    score?: number;
    timestamp: Date;
}

export interface RealtimeLearningConfig {
    batchSize: number;
    flushInterval: number;
    enableStreaming: boolean;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: RealtimeLearningConfig = {
    batchSize: 10,
    flushInterval: 5000, // 5 seconds
    enableStreaming: true,
};

// =============================================================================
// EVENT TYPES
// =============================================================================

export type EventType =
    | 'DECISION_MADE'
    | 'CODE_GENERATED'
    | 'ERROR_OCCURRED'
    | 'ERROR_FIXED'
    | 'VERIFICATION_PASSED'
    | 'VERIFICATION_FAILED'
    | 'USER_FEEDBACK'
    | 'SCORE_RECEIVED'
    | 'PATTERN_MATCHED'
    | 'STRATEGY_APPLIED';

export interface StreamingDecision {
    type: 'code' | 'design' | 'architecture';
    content: string;
    reasoning: string;
    confidence: number;
}

// =============================================================================
// REAL-TIME LEARNING SERVICE
// =============================================================================

export class RealtimeLearningService extends EventEmitter {
    private config: RealtimeLearningConfig;
    private eventBuffer: RealtimeEvent[] = [];
    private flushTimer: NodeJS.Timeout | null = null;
    private sessionEventCounts: Map<string, number> = new Map();

    constructor(config?: Partial<RealtimeLearningConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };

        if (this.config.enableStreaming) {
            this.startAutoFlush();
        }
    }

    // =========================================================================
    // EVENT CAPTURE
    // =========================================================================

    /**
     * Capture a real-time learning event
     */
    async captureEvent(
        eventType: EventType,
        buildSessionId: string,
        data: Record<string, unknown>,
        metadata?: {
            phase?: string;
            agentId?: string;
            score?: number;
            immediate?: boolean;
        }
    ): Promise<RealtimeEvent> {
        const event: RealtimeEvent = {
            id: `rte_${uuidv4()}`,
            buildSessionId,
            eventType,
            data,
            phase: metadata?.phase,
            agentId: metadata?.agentId,
            score: metadata?.score,
            timestamp: new Date(),
        };

        // Track event counts per session
        const currentCount = this.sessionEventCounts.get(buildSessionId) || 0;
        this.sessionEventCounts.set(buildSessionId, currentCount + 1);

        // Either persist immediately or add to buffer
        if (metadata?.immediate) {
            await this.persistEvent(event);
        } else {
            this.eventBuffer.push(event);

            if (this.eventBuffer.length >= this.config.batchSize) {
                await this.flushBuffer();
            }
        }

        this.emit('event_captured', {
            eventType,
            buildSessionId,
            eventId: event.id,
        });

        return event;
    }

    /**
     * Capture a streaming decision (code being generated in real-time)
     */
    async captureStreamingDecision(
        buildSessionId: string,
        decision: StreamingDecision,
        context?: { phase?: string; agentId?: string }
    ): Promise<RealtimeEvent> {
        return this.captureEvent(
            'DECISION_MADE',
            buildSessionId,
            {
                decisionType: decision.type,
                content: decision.content.slice(0, 5000), // Truncate for storage
                reasoning: decision.reasoning,
                confidence: decision.confidence,
            },
            {
                phase: context?.phase,
                agentId: context?.agentId,
            }
        );
    }

    /**
     * Capture immediate feedback/score
     */
    async captureScore(
        buildSessionId: string,
        artifactId: string,
        score: number,
        category: string,
        reasoning?: string
    ): Promise<RealtimeEvent> {
        return this.captureEvent(
            'SCORE_RECEIVED',
            buildSessionId,
            {
                artifactId,
                category,
                reasoning,
            },
            {
                score,
                immediate: true, // Scores should be persisted immediately
            }
        );
    }

    /**
     * Capture pattern match event
     */
    async capturePatternMatch(
        buildSessionId: string,
        patternId: string,
        matchScore: number,
        context?: { phase?: string }
    ): Promise<RealtimeEvent> {
        return this.captureEvent(
            'PATTERN_MATCHED',
            buildSessionId,
            {
                patternId,
                matchScore,
            },
            context
        );
    }

    // =========================================================================
    // STREAMING AGGREGATION
    // =========================================================================

    /**
     * Get aggregated events for a build session
     */
    async getSessionAggregation(buildSessionId: string): Promise<{
        totalEvents: number;
        byType: Record<string, number>;
        avgScore: number | null;
        timeline: Array<{ timestamp: Date; type: EventType; score?: number }>;
    }> {
        const events = await db.select()
            .from(learningRealtimeEvents)
            .where(eq(learningRealtimeEvents.buildId, buildSessionId))
            .orderBy(learningRealtimeEvents.createdAt);

        const byType: Record<string, number> = {};
        const scores: number[] = [];
        const timeline: Array<{ timestamp: Date; type: EventType; score?: number }> = [];

        for (const event of events) {
            const type = event.eventType;
            byType[type] = (byType[type] || 0) + 1;

            const score = event.outcome === 'success' ? 100 : event.outcome === 'partial' ? 50 : 0;
            scores.push(score);

            timeline.push({
                timestamp: event.createdAt ? new Date(event.createdAt) : new Date(),
                type: type as EventType,
                score,
            });
        }

        return {
            totalEvents: events.length,
            byType,
            avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
            timeline,
        };
    }

    /**
     * Get learning velocity (events per minute) for a session
     */
    async getLearningVelocity(buildSessionId: string): Promise<{
        eventsPerMinute: number;
        scoreImprovement: number | null;
        mostFrequentEvent: string | null;
    }> {
        const events = await db.select()
            .from(learningRealtimeEvents)
            .where(eq(learningRealtimeEvents.buildId, buildSessionId))
            .orderBy(learningRealtimeEvents.createdAt);

        if (events.length < 2) {
            return {
                eventsPerMinute: 0,
                scoreImprovement: null,
                mostFrequentEvent: null,
            };
        }

        // Calculate time span
        const firstEvent = events[0];
        const lastEvent = events[events.length - 1];
        const firstTime = firstEvent.createdAt ? new Date(firstEvent.createdAt).getTime() : Date.now();
        const lastTime = lastEvent.createdAt ? new Date(lastEvent.createdAt).getTime() : Date.now();
        const durationMinutes = (lastTime - firstTime) / 60000;

        // Events per minute
        const eventsPerMinute = durationMinutes > 0 ? events.length / durationMinutes : 0;

        // Score improvement (compare first half to second half)
        const scores: number[] = events.map(e => e.outcome === 'success' ? 100 : e.outcome === 'partial' ? 50 : 0);
        let scoreImprovement: number | null = null;

        if (scores.length >= 4) {
            const midpoint = Math.floor(scores.length / 2);
            const firstHalf = scores.slice(0, midpoint);
            const secondHalf = scores.slice(midpoint);
            const avgFirst = firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length;
            const avgSecond = secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length;
            scoreImprovement = avgSecond - avgFirst;
        }

        // Most frequent event type
        const typeCounts: Record<string, number> = {};
        for (const event of events) {
            typeCounts[event.eventType] = (typeCounts[event.eventType] || 0) + 1;
        }
        const mostFrequentEvent = Object.entries(typeCounts)
            .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

        return {
            eventsPerMinute,
            scoreImprovement,
            mostFrequentEvent,
        };
    }

    // =========================================================================
    // IMMEDIATE FEEDBACK
    // =========================================================================

    /**
     * Get the latest score for an artifact
     */
    async getLatestScore(
        buildSessionId: string,
        artifactId: string
    ): Promise<number | null> {
        const events = await db.select()
            .from(learningRealtimeEvents)
            .where(
                and(
                    eq(learningRealtimeEvents.buildId, buildSessionId),
                    eq(learningRealtimeEvents.eventType, 'verification_passed'),
                    sql`json_extract(${learningRealtimeEvents.eventData}, '$.artifactId') = ${artifactId}`
                )
            )
            .orderBy(desc(learningRealtimeEvents.createdAt))
            .limit(1);

        if (events.length === 0) return null;
        return events[0].outcome === 'success' ? 100 : events[0].outcome === 'partial' ? 50 : 0;
    }

    /**
     * Subscribe to score updates for a session
     */
    subscribeToScores(
        buildSessionId: string,
        callback: (score: number, artifactId: string) => void
    ): () => void {
        const handler = (data: { eventType: string; buildSessionId: string; score?: number; artifactId?: string }) => {
            if (
                data.buildSessionId === buildSessionId &&
                data.eventType === 'SCORE_RECEIVED' &&
                data.score !== undefined
            ) {
                callback(data.score, data.artifactId || 'unknown');
            }
        };

        this.on('event_captured', handler);

        return () => {
            this.off('event_captured', handler);
        };
    }

    // =========================================================================
    // QUERY METHODS
    // =========================================================================

    /**
     * Get recent events across all sessions
     */
    async getRecentEvents(limit: number = 100): Promise<RealtimeEvent[]> {
        const rows = await db.select()
            .from(learningRealtimeEvents)
            .orderBy(desc(learningRealtimeEvents.createdAt))
            .limit(limit);

        return rows.map(row => this.dbRowToEvent(row));
    }

    /**
     * Get events within a time window
     */
    async getEventsInWindow(
        startTime: Date,
        endTime: Date
    ): Promise<RealtimeEvent[]> {
        const rows = await db.select()
            .from(learningRealtimeEvents)
            .where(
                between(
                    learningRealtimeEvents.createdAt,
                    startTime.toISOString(),
                    endTime.toISOString()
                )
            )
            .orderBy(learningRealtimeEvents.createdAt);

        return rows.map(row => this.dbRowToEvent(row));
    }

    /**
     * Get statistics
     */
    async getStats(): Promise<{
        totalEvents: number;
        byType: Record<string, number>;
        avgScoreOverall: number | null;
        activeSessions: number;
    }> {
        const all = await db.select().from(learningRealtimeEvents);

        const byType: Record<string, number> = {};
        const scores: number[] = [];
        const sessions = new Set<string>();

        for (const row of all) {
            byType[row.eventType] = (byType[row.eventType] || 0) + 1;

            const score = row.outcome === 'success' ? 100 : row.outcome === 'partial' ? 50 : 0;
            scores.push(score);

            sessions.add(row.buildId);
        }

        return {
            totalEvents: all.length,
            byType,
            avgScoreOverall: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
            activeSessions: sessions.size,
        };
    }

    // =========================================================================
    // BUFFER MANAGEMENT
    // =========================================================================

    /**
     * Flush the event buffer to database
     */
    async flushBuffer(): Promise<number> {
        if (this.eventBuffer.length === 0) {
            return 0;
        }

        const eventsToFlush = [...this.eventBuffer];
        this.eventBuffer = [];

        try {
            for (const event of eventsToFlush) {
                await this.persistEvent(event);
            }

            this.emit('buffer_flushed', {
                count: eventsToFlush.length,
            });

            return eventsToFlush.length;
        } catch (error) {
            console.error('[RealtimeLearning] Failed to flush buffer:', error);
            // Put events back in buffer
            this.eventBuffer = [...eventsToFlush, ...this.eventBuffer];
            throw error;
        }
    }

    /**
     * Start automatic buffer flushing
     */
    private startAutoFlush(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }

        this.flushTimer = setInterval(async () => {
            try {
                await this.flushBuffer();
            } catch (error) {
                console.error('[RealtimeLearning] Auto-flush failed:', error);
            }
        }, this.config.flushInterval);
    }

    /**
     * Stop automatic buffer flushing and flush remaining events
     */
    async shutdown(): Promise<void> {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }

        await this.flushBuffer();
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private async persistEvent(event: RealtimeEvent): Promise<void> {
        try {
            // Map our event type to the schema's event type
            const schemaEventType = event.eventType.toLowerCase().replace(/_/g, '_') as
                'decision_made' | 'code_generated' | 'error_occurred' | 'error_fixed' |
                'verification_passed' | 'verification_failed' | 'user_feedback' | 'phase_completed';

            await db.insert(learningRealtimeEvents).values({
                eventId: event.id,
                buildId: event.buildSessionId,
                userId: 'system', // Default user
                eventType: schemaEventType,
                eventData: event.data,
                outcome: event.score !== undefined && event.score >= 70 ? 'success' : 'partial',
            });
        } catch (error) {
            console.error('[RealtimeLearning] Failed to persist event:', error);
            throw error;
        }
    }

    private dbRowToEvent(row: typeof learningRealtimeEvents.$inferSelect): RealtimeEvent {
        return {
            id: row.id,
            buildSessionId: row.buildId,
            eventType: row.eventType,
            data: row.eventData as Record<string, unknown>,
            phase: undefined,
            agentId: undefined,
            score: row.outcome === 'success' ? 100 : row.outcome === 'partial' ? 50 : 0,
            timestamp: row.createdAt ? new Date(row.createdAt) : new Date(),
        };
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: RealtimeLearningService | null = null;

export function getRealtimeLearning(config?: Partial<RealtimeLearningConfig>): RealtimeLearningService {
    if (!instance) {
        instance = new RealtimeLearningService(config);
    }
    return instance;
}

export async function shutdownRealtimeLearning(): Promise<void> {
    if (instance) {
        await instance.shutdown();
        instance = null;
    }
}
