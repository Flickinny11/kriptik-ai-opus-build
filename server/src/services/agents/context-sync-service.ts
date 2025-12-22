/**
 * Context Sync Service - Real-time context sharing between parallel agents
 *
 * SESSION 3: "Fingers of the Same Hand"
 *
 * This service enables all parallel agents to work as collective intelligence:
 * - Agent 1 finds a solution → Agents 2-6 know it immediately
 * - Agent 3 encounters an error → All agents learn to avoid it
 * - File modifications are broadcast to prevent conflicts
 * - Shared context is injected into every agent's prompts
 * - Solutions are captured by learning engine for future builds
 */

import { EventEmitter } from 'events';
import { getWebSocketSyncService, type WebSocketSyncService } from './websocket-sync.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ContextUpdate {
    type: 'discovery' | 'solution' | 'error' | 'file-change' | 'pattern' | 'warning' | 'agent-registered';
    agentId: string;
    timestamp: number;
    data: {
        summary: string;
        details: Record<string, unknown>;
        relevantFiles?: string[];
        confidence?: number;
        problemType?: string;
    };
}

export interface ActiveAgentInfo {
    status: 'active' | 'idle' | 'error' | 'completed';
    currentTask: string;
    lastUpdate: number;
}

export interface FileModificationInfo {
    agentId: string;
    action: 'create' | 'modify' | 'delete';
    timestamp: number;
}

export interface SharedAgentContext {
    discoveries: ContextUpdate[];
    solutions: Map<string, ContextUpdate>; // problemType → solution
    recentErrors: ContextUpdate[];
    modifiedFiles: Map<string, FileModificationInfo>;
    learnedPatterns: ContextUpdate[];
    activeAgents: Map<string, ActiveAgentInfo>;
}

export interface DiscoveryData {
    summary: string;
    details: Record<string, unknown>;
    relevantFiles?: string[];
    confidence?: number;
}

export interface SolutionData {
    summary: string;
    code?: string;
    pattern?: string;
    relevantFiles?: string[];
}

export interface ErrorData {
    message: string;
    file?: string;
    line?: number;
    stack?: string;
    attemptedFix?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface PatternData {
    type: string;
    problemType: string;
    solution: string;
    confidence: number;
    source: string;
    timestamp: number;
}

// =============================================================================
// CONTEXT SYNC SERVICE
// =============================================================================

export class ContextSyncService extends EventEmitter {
    private static instances: Map<string, ContextSyncService> = new Map();
    private context: SharedAgentContext;
    private wsSync: WebSocketSyncService;
    private syncInterval: NodeJS.Timeout | null = null;

    private constructor(
        private buildId: string,
        private projectId: string
    ) {
        super();
        this.context = {
            discoveries: [],
            solutions: new Map(),
            recentErrors: [],
            modifiedFiles: new Map(),
            learnedPatterns: [],
            activeAgents: new Map()
        };
        this.wsSync = getWebSocketSyncService();

        console.log(`[ContextSyncService] Created for build ${buildId}, project ${projectId}`);
    }

    /**
     * Get singleton instance per build+project combination
     */
    static getInstance(buildId: string, projectId: string): ContextSyncService {
        const key = `${buildId}:${projectId}`;
        if (!this.instances.has(key)) {
            this.instances.set(key, new ContextSyncService(buildId, projectId));
        }
        return this.instances.get(key)!;
    }

    /**
     * Get current shared context (for read access)
     */
    getContext(): SharedAgentContext {
        return this.context;
    }

    // =========================================================================
    // AGENT REGISTRATION
    // =========================================================================

    /**
     * Register an agent to receive real-time updates
     */
    registerAgent(agentId: string, initialTask: string): void {
        this.context.activeAgents.set(agentId, {
            status: 'active',
            currentTask: initialTask,
            lastUpdate: Date.now()
        });

        const update: ContextUpdate = {
            type: 'agent-registered',
            agentId,
            timestamp: Date.now(),
            data: {
                summary: `Agent ${agentId} joined the build`,
                details: { task: initialTask }
            }
        };

        this.broadcast(update);
        console.log(`[ContextSyncService] Agent ${agentId} registered with task: ${initialTask}`);
    }

    /**
     * Update agent status
     */
    updateAgentStatus(agentId: string, status: ActiveAgentInfo['status'], currentTask?: string): void {
        const existing = this.context.activeAgents.get(agentId);
        if (existing) {
            existing.status = status;
            if (currentTask) {
                existing.currentTask = currentTask;
            }
            existing.lastUpdate = Date.now();
        }
    }

    /**
     * Unregister an agent
     */
    unregisterAgent(agentId: string): void {
        this.context.activeAgents.delete(agentId);
        console.log(`[ContextSyncService] Agent ${agentId} unregistered`);
    }

    // =========================================================================
    // DISCOVERY SHARING
    // =========================================================================

    /**
     * Agent shares a discovery (something useful learned)
     */
    shareDiscovery(agentId: string, discovery: DiscoveryData): void {
        const update: ContextUpdate = {
            type: 'discovery',
            agentId,
            timestamp: Date.now(),
            data: {
                summary: discovery.summary,
                details: discovery.details,
                relevantFiles: discovery.relevantFiles,
                confidence: discovery.confidence
            }
        };

        this.context.discoveries.push(update);

        // Keep only last 50 discoveries
        if (this.context.discoveries.length > 50) {
            this.context.discoveries = this.context.discoveries.slice(-50);
        }

        this.broadcast(update);
        console.log(`[ContextSyncService] Agent ${agentId} shared discovery: ${discovery.summary}`);
    }

    // =========================================================================
    // SOLUTION SHARING
    // =========================================================================

    /**
     * Agent shares a solution to a problem
     */
    shareSolution(agentId: string, problemType: string, solution: SolutionData): void {
        const update: ContextUpdate = {
            type: 'solution',
            agentId,
            timestamp: Date.now(),
            data: {
                summary: solution.summary,
                details: solution as unknown as Record<string, unknown>,
                problemType,
                relevantFiles: solution.relevantFiles
            }
        };

        this.context.solutions.set(problemType, update);
        this.broadcast(update);

        // Emit to learning engine for pattern extraction
        this.emit('solution-found', { problemType, solution, agentId });

        console.log(`[ContextSyncService] Agent ${agentId} shared solution for ${problemType}: ${solution.summary}`);
    }

    /**
     * Get a known solution for a problem type
     */
    getSolution(problemType: string): ContextUpdate | undefined {
        return this.context.solutions.get(problemType);
    }

    // =========================================================================
    // ERROR REPORTING
    // =========================================================================

    /**
     * Agent reports an error (so others can avoid or help)
     */
    reportError(agentId: string, error: ErrorData): void {
        const update: ContextUpdate = {
            type: 'error',
            agentId,
            timestamp: Date.now(),
            data: {
                summary: error.message,
                details: error as unknown as Record<string, unknown>
            }
        };

        this.context.recentErrors.push(update);

        // Keep only last 20 errors
        if (this.context.recentErrors.length > 20) {
            this.context.recentErrors = this.context.recentErrors.slice(-20);
        }

        this.broadcast(update);
        console.log(`[ContextSyncService] Agent ${agentId} reported error: ${error.message}`);
    }

    // =========================================================================
    // FILE MODIFICATION TRACKING
    // =========================================================================

    /**
     * Agent modified a file
     */
    notifyFileChange(agentId: string, filePath: string, action: 'create' | 'modify' | 'delete'): void {
        this.context.modifiedFiles.set(filePath, {
            agentId,
            action,
            timestamp: Date.now()
        });

        const update: ContextUpdate = {
            type: 'file-change',
            agentId,
            timestamp: Date.now(),
            data: {
                summary: `${action} ${filePath}`,
                details: { filePath, action }
            }
        };

        this.broadcast(update);
    }

    /**
     * Check if a file is being modified by another agent
     */
    isFileLocked(filePath: string, requestingAgentId: string): { locked: boolean; byAgent?: string } {
        const fileInfo = this.context.modifiedFiles.get(filePath);
        if (!fileInfo || fileInfo.agentId === requestingAgentId) {
            return { locked: false };
        }

        // Check if lock is stale (older than 5 minutes)
        if (Date.now() - fileInfo.timestamp > 5 * 60 * 1000) {
            this.context.modifiedFiles.delete(filePath);
            return { locked: false };
        }

        return { locked: true, byAgent: fileInfo.agentId };
    }

    /**
     * Release file lock
     */
    releaseFileLock(agentId: string, filePath: string): void {
        const fileInfo = this.context.modifiedFiles.get(filePath);
        if (fileInfo && fileInfo.agentId === agentId) {
            this.context.modifiedFiles.delete(filePath);
        }
    }

    // =========================================================================
    // PATTERN SHARING
    // =========================================================================

    /**
     * Share a learned pattern
     */
    sharePattern(agentId: string, pattern: PatternData): void {
        const update: ContextUpdate = {
            type: 'pattern',
            agentId,
            timestamp: Date.now(),
            data: {
                summary: `Pattern: ${pattern.problemType} → ${pattern.solution}`,
                details: pattern as unknown as Record<string, unknown>,
                confidence: pattern.confidence
            }
        };

        this.context.learnedPatterns.push(update);

        // Keep only last 30 patterns
        if (this.context.learnedPatterns.length > 30) {
            this.context.learnedPatterns = this.context.learnedPatterns.slice(-30);
        }

        this.broadcast(update);
    }

    // =========================================================================
    // CONTEXT RETRIEVAL
    // =========================================================================

    /**
     * Get context relevant to a specific task
     * This is injected into agent prompts for collective awareness
     */
    getContextForTask(agentId: string, taskDescription: string, relevantFiles: string[]): string {
        const lines: string[] = [];

        // What other agents are working on
        lines.push('## ACTIVE AGENTS');
        let activeCount = 0;
        this.context.activeAgents.forEach((info, id) => {
            if (id !== agentId) {
                lines.push(`- Agent ${id}: ${info.currentTask} (${info.status})`);
                activeCount++;
            }
        });
        if (activeCount === 0) {
            lines.push('- No other agents currently active');
        }

        // Recent discoveries that might be relevant
        const relevantDiscoveries = this.context.discoveries
            .filter(d => d.agentId !== agentId)
            .slice(-10);

        if (relevantDiscoveries.length > 0) {
            lines.push('\n## RECENT DISCOVERIES FROM OTHER AGENTS');
            relevantDiscoveries.forEach(d => {
                lines.push(`- [Agent ${d.agentId}]: ${d.data.summary}`);
            });
        }

        // Known solutions
        if (this.context.solutions.size > 0) {
            lines.push('\n## KNOWN SOLUTIONS (Use these if you encounter similar problems)');
            this.context.solutions.forEach((solution, problemType) => {
                lines.push(`- ${problemType}: ${solution.data.summary}`);
            });
        }

        // Files being worked on by others
        const otherAgentFiles = Array.from(this.context.modifiedFiles.entries())
            .filter(([_, info]) => info.agentId !== agentId)
            .slice(-10);

        if (otherAgentFiles.length > 0) {
            lines.push('\n## FILES BEING MODIFIED BY OTHER AGENTS (Avoid conflicts)');
            otherAgentFiles.forEach(([file, info]) => {
                lines.push(`- ${file}: ${info.action} by Agent ${info.agentId}`);
            });
        }

        // Recent errors (so this agent can avoid them)
        const recentErrors = this.context.recentErrors
            .filter(e => e.agentId !== agentId)
            .slice(-5);

        if (recentErrors.length > 0) {
            lines.push('\n## RECENT ERRORS FROM OTHER AGENTS (Avoid these)');
            recentErrors.forEach(e => {
                lines.push(`- ${e.data.summary}`);
                const errorDetails = e.data.details as Record<string, unknown>;
                if (errorDetails.attemptedFix) {
                    lines.push(`  Attempted fix: ${errorDetails.attemptedFix}`);
                }
            });
        }

        // Learned patterns
        const patterns = this.context.learnedPatterns.slice(-5);
        if (patterns.length > 0) {
            lines.push('\n## LEARNED PATTERNS (Apply these best practices)');
            patterns.forEach(p => {
                lines.push(`- ${p.data.summary}`);
            });
        }

        return lines.join('\n');
    }

    // =========================================================================
    // SUBSCRIPTION
    // =========================================================================

    /**
     * Subscribe to real-time updates
     */
    subscribe(agentId: string, callback: (update: ContextUpdate) => void): () => void {
        const handler = (update: ContextUpdate) => {
            // Don't send agent its own updates
            if (update.agentId !== agentId) {
                callback(update);
            }
        };

        this.on('update', handler);

        return () => {
            this.off('update', handler);
        };
    }

    // =========================================================================
    // BROADCASTING
    // =========================================================================

    private broadcast(update: ContextUpdate): void {
        this.emit('update', update);

        // Also broadcast via WebSocket for UI
        try {
            this.wsSync.sendPhaseChange(
                this.projectId,
                `context-sync:${update.type}`,
                0,
                update.data.summary
            );
        } catch (e) {
            // WebSocket broadcast is best-effort
        }
    }

    // =========================================================================
    // STATS
    // =========================================================================

    /**
     * Get context statistics
     */
    getStats(): {
        discoveries: number;
        solutions: number;
        errors: number;
        filesModified: number;
        activeAgents: number;
        patterns: number;
    } {
        return {
            discoveries: this.context.discoveries.length,
            solutions: this.context.solutions.size,
            errors: this.context.recentErrors.length,
            filesModified: this.context.modifiedFiles.size,
            activeAgents: this.context.activeAgents.size,
            patterns: this.context.learnedPatterns.length
        };
    }

    // =========================================================================
    // CLEANUP
    // =========================================================================

    /**
     * Cleanup when build completes
     */
    cleanup(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        const key = `${this.buildId}:${this.projectId}`;
        ContextSyncService.instances.delete(key);

        console.log(`[ContextSyncService] Cleaned up for build ${this.buildId}`);
    }

    /**
     * Clear all instances (for testing)
     */
    static clearAllInstances(): void {
        this.instances.clear();
    }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function getContextSyncService(buildId: string, projectId: string): ContextSyncService {
    return ContextSyncService.getInstance(buildId, projectId);
}

export default ContextSyncService;
