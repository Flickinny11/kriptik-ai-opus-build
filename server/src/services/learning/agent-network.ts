/**
 * Agent Network Learning Service
 *
 * Enables parallel Feature Agents to share discoveries in real-time,
 * creating an emergent knowledge network during builds.
 *
 * When one agent discovers something useful, it's immediately
 * available to other agents working on related tasks.
 */

import { db } from '../../db.js';
import { learningRealtimeEvents, learningPatterns, learningAgentBroadcasts } from '../../schema.js';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

// Local type definitions for Agent Network
export interface AgentNetworkConfig {
    enableNetwork: boolean;
    broadcastThreshold: number;
    maxSubscriptions: number;
}

export interface AgentDiscovery {
    id: string;
    sourceAgentId: string;
    buildSessionId: string;
    type: string;
    content: string;
    context: Record<string, unknown>;
    confidence: number;
    timestamp: Date;
    recipientCount: number;
}

export interface NetworkInsight {
    type: string;
    discoveryCount: number;
    avgConfidence: number;
    sourceAgents: string[];
    summary: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: AgentNetworkConfig = {
    enableNetwork: true,
    broadcastThreshold: 0.8, // Confidence threshold for broadcasting
    maxSubscriptions: 10,
};

// =============================================================================
// DISCOVERY TYPES
// =============================================================================

export type DiscoveryType =
    | 'PATTERN_FOUND'
    | 'ERROR_SOLUTION'
    | 'OPTIMIZATION'
    | 'DEPENDENCY_INSIGHT'
    | 'DESIGN_PATTERN'
    | 'API_USAGE';

// =============================================================================
// AGENT NETWORK SERVICE
// =============================================================================

export class AgentNetworkService extends EventEmitter {
    private config: AgentNetworkConfig;
    private activeAgents: Map<string, {
        buildSessionId: string;
        featureId?: string;
        subscriptions: string[];
        lastSeen: Date;
    }> = new Map();
    private discoveryBuffer: AgentDiscovery[] = [];

    constructor(config?: Partial<AgentNetworkConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Cleanup stale agents periodically
        setInterval(() => this.cleanupStaleAgents(), 60000);
    }

    // =========================================================================
    // AGENT REGISTRATION
    // =========================================================================

    /**
     * Register an agent with the network
     */
    registerAgent(
        agentId: string,
        buildSessionId: string,
        options?: {
            featureId?: string;
            subscriptions?: string[];
        }
    ): void {
        this.activeAgents.set(agentId, {
            buildSessionId,
            featureId: options?.featureId,
            subscriptions: options?.subscriptions?.slice(0, this.config.maxSubscriptions) || [],
            lastSeen: new Date(),
        });

        this.emit('agent_registered', {
            agentId,
            buildSessionId,
            featureId: options?.featureId,
        });
    }

    /**
     * Unregister an agent from the network
     */
    unregisterAgent(agentId: string): void {
        this.activeAgents.delete(agentId);

        this.emit('agent_unregistered', { agentId });
    }

    /**
     * Update agent's subscriptions
     */
    updateSubscriptions(agentId: string, subscriptions: string[]): void {
        const agent = this.activeAgents.get(agentId);
        if (agent) {
            agent.subscriptions = subscriptions.slice(0, this.config.maxSubscriptions);
            agent.lastSeen = new Date();
        }
    }

    /**
     * Heartbeat to keep agent active
     */
    heartbeat(agentId: string): void {
        const agent = this.activeAgents.get(agentId);
        if (agent) {
            agent.lastSeen = new Date();
        }
    }

    // =========================================================================
    // DISCOVERY BROADCASTING
    // =========================================================================

    /**
     * Broadcast a discovery to the network
     */
    async broadcastDiscovery(
        sourceAgentId: string,
        discovery: {
            type: DiscoveryType;
            content: string;
            context: Record<string, unknown>;
            confidence: number;
        }
    ): Promise<{
        discoveryId: string;
        recipientCount: number;
    }> {
        // Check confidence threshold
        if (discovery.confidence < this.config.broadcastThreshold) {
            return {
                discoveryId: '',
                recipientCount: 0,
            };
        }

        const sourceAgent = this.activeAgents.get(sourceAgentId);
        if (!sourceAgent) {
            throw new Error('Source agent not registered');
        }

        const discoveryId = `disc_${uuidv4()}`;

        const agentDiscovery: AgentDiscovery = {
            id: discoveryId,
            sourceAgentId,
            buildSessionId: sourceAgent.buildSessionId,
            type: discovery.type,
            content: discovery.content,
            context: discovery.context,
            confidence: discovery.confidence,
            timestamp: new Date(),
            recipientCount: 0,
        };

        // Find relevant recipients
        const recipients = this.findRelevantRecipients(
            sourceAgentId,
            discovery.type,
            sourceAgent.buildSessionId
        );

        agentDiscovery.recipientCount = recipients.length;

        // Buffer for persistence
        this.discoveryBuffer.push(agentDiscovery);

        // Emit to recipients
        for (const recipientId of recipients) {
            this.emit(`discovery:${recipientId}`, {
                discoveryId,
                type: discovery.type,
                content: discovery.content,
                context: discovery.context,
                confidence: discovery.confidence,
                sourceAgentId,
            });
        }

        // Also emit general event
        this.emit('discovery_broadcast', {
            discoveryId,
            type: discovery.type,
            sourceAgentId,
            recipientCount: recipients.length,
        });

        // Persist to database
        await this.persistDiscovery(agentDiscovery);

        return {
            discoveryId,
            recipientCount: recipients.length,
        };
    }

    /**
     * Subscribe to discoveries from the network
     */
    subscribeToDiscoveries(
        agentId: string,
        callback: (discovery: {
            discoveryId: string;
            type: DiscoveryType;
            content: string;
            context: Record<string, unknown>;
            confidence: number;
            sourceAgentId: string;
        }) => void
    ): () => void {
        const eventName = `discovery:${agentId}`;
        this.on(eventName, callback);

        return () => {
            this.off(eventName, callback);
        };
    }

    // =========================================================================
    // NETWORK INSIGHTS
    // =========================================================================

    /**
     * Get aggregated insights from the network
     */
    async getNetworkInsights(buildSessionId: string): Promise<NetworkInsight[]> {
        // Get recent broadcasts for this build session
        const recentBroadcasts = await db.select()
            .from(learningAgentBroadcasts)
            .where(eq(learningAgentBroadcasts.sourceBuildId, buildSessionId))
            .orderBy(desc(learningAgentBroadcasts.createdAt))
            .limit(50);

        // Aggregate by discovery type
        const insightMap = new Map<string, {
            discoveryCount: number;
            avgConfidence: number;
            sources: Set<string>;
            examples: string[];
        }>();

        for (const broadcast of recentBroadcasts) {
            const discoveryType = broadcast.learningType || 'UNKNOWN';
            const confidence = broadcast.confidence || 0.5;

            const existing = insightMap.get(discoveryType) || {
                discoveryCount: 0,
                avgConfidence: 0,
                sources: new Set<string>(),
                examples: [],
            };

            existing.discoveryCount++;
            existing.avgConfidence =
                (existing.avgConfidence * (existing.discoveryCount - 1) + confidence) /
                existing.discoveryCount;

            if (broadcast.sourceAgentId) {
                existing.sources.add(broadcast.sourceAgentId);
            }

            insightMap.set(discoveryType, existing);
        }

        // Convert to array
        const insights: NetworkInsight[] = [];
        for (const [type, data] of insightMap) {
            insights.push({
                type,
                discoveryCount: data.discoveryCount,
                avgConfidence: data.avgConfidence,
                sourceAgents: Array.from(data.sources),
                summary: `Pattern "${type}" discovered ${data.discoveryCount} times with avg confidence ${(data.avgConfidence * 100).toFixed(1)}%`,
            });
        }

        return insights.sort((a, b) => b.discoveryCount - a.discoveryCount);
    }

    /**
     * Get discoveries relevant to a specific task
     */
    async getRelevantDiscoveries(
        agentId: string,
        taskContext: { featureType?: string; techStack?: string[]; phase?: string }
    ): Promise<AgentDiscovery[]> {
        const agent = this.activeAgents.get(agentId);
        if (!agent) {
            return [];
        }

        // Get recent broadcasts from same build session
        const cutoffTime = new Date(Date.now() - 30 * 60 * 1000); // Last 30 minutes

        const recentBroadcasts = await db.select()
            .from(learningAgentBroadcasts)
            .where(
                and(
                    eq(learningAgentBroadcasts.sourceBuildId, agent.buildSessionId),
                    gte(learningAgentBroadcasts.createdAt, cutoffTime.toISOString())
                )
            )
            .orderBy(desc(learningAgentBroadcasts.createdAt))
            .limit(100);

        // Filter to discoveries (not from same agent)
        const discoveries: AgentDiscovery[] = [];

        for (const broadcast of recentBroadcasts) {
            if (broadcast.sourceAgentId === agentId) continue;

            const context = broadcast.details as Record<string, unknown> || {};
            const appliedByArray = broadcast.appliedBy as string[] || [];

            discoveries.push({
                id: broadcast.id,
                sourceAgentId: broadcast.sourceAgentId || 'unknown',
                buildSessionId: broadcast.sourceBuildId,
                type: broadcast.learningType as DiscoveryType || 'PATTERN_FOUND',
                content: broadcast.summary || '',
                context,
                confidence: broadcast.confidence || 0.5,
                timestamp: broadcast.createdAt ? new Date(broadcast.createdAt) : new Date(),
                recipientCount: appliedByArray.length,
            });
        }

        return discoveries;
    }

    // =========================================================================
    // NETWORK STATE
    // =========================================================================

    /**
     * Get current network state
     */
    getNetworkState(): {
        activeAgentCount: number;
        agentsByBuild: Record<string, number>;
        recentDiscoveryCount: number;
    } {
        const agentsByBuild: Record<string, number> = {};

        for (const [, agent] of this.activeAgents) {
            agentsByBuild[agent.buildSessionId] =
                (agentsByBuild[agent.buildSessionId] || 0) + 1;
        }

        // Count recent discoveries (last 5 minutes)
        const cutoff = Date.now() - 5 * 60 * 1000;
        const recentDiscoveries = this.discoveryBuffer.filter(
            d => d.timestamp.getTime() > cutoff
        );

        return {
            activeAgentCount: this.activeAgents.size,
            agentsByBuild,
            recentDiscoveryCount: recentDiscoveries.length,
        };
    }

    /**
     * Get agents in a build session
     */
    getAgentsInBuild(buildSessionId: string): string[] {
        const agents: string[] = [];

        for (const [agentId, agent] of this.activeAgents) {
            if (agent.buildSessionId === buildSessionId) {
                agents.push(agentId);
            }
        }

        return agents;
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private findRelevantRecipients(
        sourceAgentId: string,
        discoveryType: DiscoveryType,
        buildSessionId: string
    ): string[] {
        const recipients: string[] = [];

        for (const [agentId, agent] of this.activeAgents) {
            // Don't send to self
            if (agentId === sourceAgentId) continue;

            // Must be in same build session
            if (agent.buildSessionId !== buildSessionId) continue;

            // Check if subscribed to this type
            if (
                agent.subscriptions.length === 0 ||
                agent.subscriptions.includes(discoveryType) ||
                agent.subscriptions.includes('ALL')
            ) {
                recipients.push(agentId);
            }
        }

        return recipients;
    }

    private cleanupStaleAgents(): void {
        const staleThreshold = Date.now() - 5 * 60 * 1000; // 5 minutes

        for (const [agentId, agent] of this.activeAgents) {
            if (agent.lastSeen.getTime() < staleThreshold) {
                this.unregisterAgent(agentId);
            }
        }
    }

    private async persistDiscovery(discovery: AgentDiscovery): Promise<void> {
        try {
            // Map discovery type to schema enum
            const learningTypeMap: Record<string, 'pattern' | 'error_fix' | 'strategy' | 'warning' | 'discovery'> = {
                'PATTERN_FOUND': 'pattern',
                'ERROR_SOLUTION': 'error_fix',
                'OPTIMIZATION': 'strategy',
                'DEPENDENCY_INSIGHT': 'discovery',
                'DESIGN_PATTERN': 'pattern',
                'API_USAGE': 'discovery',
            };
            const learningType = learningTypeMap[discovery.type] || 'discovery';

            await db.insert(learningAgentBroadcasts).values({
                broadcastId: discovery.id,
                sourceBuildId: discovery.buildSessionId,
                sourceAgentId: discovery.sourceAgentId,
                learningType,
                summary: discovery.content.slice(0, 5000),
                details: discovery.context,
                confidence: discovery.confidence,
                applicability: [],
                receivedBy: [],
                appliedBy: [],
            });
        } catch (error) {
            console.error('[AgentNetwork] Failed to persist discovery:', error);
        }
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: AgentNetworkService | null = null;

export function getAgentNetwork(config?: Partial<AgentNetworkConfig>): AgentNetworkService {
    if (!instance) {
        instance = new AgentNetworkService(config);
    }
    return instance;
}

export function resetAgentNetwork(): void {
    instance = null;
}
