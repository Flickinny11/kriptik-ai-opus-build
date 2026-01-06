/**
 * AI Lab - Agent Communicator (PROMPT 6)
 *
 * Handles inter-agent communication within an AI Lab session.
 * Uses a message bus pattern for real-time updates and conflict resolution.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { aiLabMessages } from '../../schema.js';
import { eq } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export interface AgentMessage {
    id?: string;
    sessionId: string;
    fromOrchestrationId: string;
    toOrchestrationId?: string; // null = broadcast
    messageType: 'focus_announcement' | 'finding' | 'conflict' | 'request' | 'response';
    content: string;
    metadata?: Record<string, unknown>;
    timestamp: Date;
}

export interface ConflictReport {
    id: string;
    sessionId: string;
    orchestration1Id: string;
    orchestration2Id: string;
    topic: string;
    description: string;
    resolvedAt?: Date;
    resolution?: string;
}

// ============================================================================
// AGENT COMMUNICATOR CLASS
// ============================================================================

export class AgentCommunicator extends EventEmitter {
    private sessionId: string;
    private subscribers: Map<string, (message: AgentMessage) => void> = new Map();
    private conflicts: ConflictReport[] = [];

    constructor(sessionId: string) {
        super();
        this.sessionId = sessionId;
    }

    /**
     * Broadcast a message to all orchestrations
     */
    async broadcast(message: Omit<AgentMessage, 'id'>): Promise<void> {
        const fullMessage: AgentMessage = {
            ...message,
            id: uuidv4(),
        };

        // Store in database
        await db.insert(aiLabMessages).values({
            id: fullMessage.id,
            sessionId: fullMessage.sessionId,
            fromOrchestrationId: fullMessage.fromOrchestrationId,
            toOrchestrationId: fullMessage.toOrchestrationId || null,
            messageType: fullMessage.messageType,
            content: fullMessage.content,
            metadata: fullMessage.metadata as any,
        });

        // Notify all subscribers except sender
        for (const [orchestrationId, callback] of this.subscribers) {
            if (orchestrationId !== message.fromOrchestrationId) {
                callback(fullMessage);
            }
        }

        this.emit('message', fullMessage);
    }

    /**
     * Send a direct message to a specific orchestration
     */
    async sendDirect(message: Omit<AgentMessage, 'id'>): Promise<void> {
        if (!message.toOrchestrationId) {
            throw new Error('Direct messages require a target orchestration ID');
        }

        const fullMessage: AgentMessage = {
            ...message,
            id: uuidv4(),
        };

        // Store in database
        await db.insert(aiLabMessages).values({
            id: fullMessage.id,
            sessionId: fullMessage.sessionId,
            fromOrchestrationId: fullMessage.fromOrchestrationId,
            toOrchestrationId: fullMessage.toOrchestrationId,
            messageType: fullMessage.messageType,
            content: fullMessage.content,
            metadata: fullMessage.metadata as any,
        });

        // Notify target subscriber
        const callback = this.subscribers.get(message.toOrchestrationId);
        if (callback) {
            callback(fullMessage);
        }

        this.emit('direct_message', fullMessage);
    }

    /**
     * Subscribe to messages for a specific orchestration
     */
    subscribe(orchestrationId: string, callback: (message: AgentMessage) => void): () => void {
        this.subscribers.set(orchestrationId, callback);
        
        // Return unsubscribe function
        return () => {
            this.subscribers.delete(orchestrationId);
        };
    }

    /**
     * Report a conflict between two orchestrations
     */
    async reportConflict(
        orchestration1Id: string,
        orchestration2Id: string,
        topic: string,
        description: string
    ): Promise<ConflictReport> {
        const conflict: ConflictReport = {
            id: uuidv4(),
            sessionId: this.sessionId,
            orchestration1Id,
            orchestration2Id,
            topic,
            description,
        };

        this.conflicts.push(conflict);

        // Broadcast conflict notification
        await this.broadcast({
            sessionId: this.sessionId,
            fromOrchestrationId: orchestration1Id,
            messageType: 'conflict',
            content: `Conflict detected: ${topic}`,
            metadata: { conflict },
            timestamp: new Date(),
        });

        this.emit('conflict', conflict);
        return conflict;
    }

    /**
     * Resolve a conflict
     */
    async resolveConflict(conflictId: string, resolution: string): Promise<void> {
        const conflict = this.conflicts.find(c => c.id === conflictId);
        if (conflict) {
            conflict.resolvedAt = new Date();
            conflict.resolution = resolution;

            // Broadcast resolution
            await this.broadcast({
                sessionId: this.sessionId,
                fromOrchestrationId: conflict.orchestration1Id,
                messageType: 'response',
                content: `Conflict resolved: ${resolution}`,
                metadata: { conflictId, resolution },
                timestamp: new Date(),
            });

            this.emit('conflict_resolved', conflict);
        }
    }

    /**
     * Get all messages for a session
     */
    async getMessages(sessionId: string): Promise<AgentMessage[]> {
        const messages = await db.select()
            .from(aiLabMessages)
            .where(eq(aiLabMessages.sessionId, sessionId));

        return messages.map(m => ({
            id: m.id,
            sessionId: m.sessionId,
            fromOrchestrationId: m.fromOrchestrationId,
            toOrchestrationId: m.toOrchestrationId || undefined,
            messageType: m.messageType as AgentMessage['messageType'],
            content: m.content,
            metadata: m.metadata as Record<string, unknown> | undefined,
            timestamp: new Date(m.createdAt),
        }));
    }

    /**
     * Get unresolved conflicts
     */
    getUnresolvedConflicts(): ConflictReport[] {
        return this.conflicts.filter(c => !c.resolvedAt);
    }

    /**
     * Clear all subscribers
     */
    clear(): void {
        this.subscribers.clear();
    }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createAgentCommunicator(sessionId: string): AgentCommunicator {
    return new AgentCommunicator(sessionId);
}
