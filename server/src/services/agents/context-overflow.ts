/**
 * Context Overflow Manager
 *
 * Manages dynamic agent spawning when context window approaches limit.
 * Implements seamless handoff between agents without losing progress.
 *
 * Key Features:
 * - Token usage monitoring with thresholds
 * - Context compression to ~20% of original size
 * - Seamless agent handoff without user notification
 * - Intent Lock Contract preservation (never compressed)
 * - Progress artifact preservation across handoffs
 *
 * Part of Phase 8: Competitive Enhancements (Ultimate AI-First Builder Architecture)
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { createClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import type { IntentContract } from '../ai/intent-lock.js';
import type { AgentType } from './types.js';

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface ContextOverflowConfig {
    /** Maximum token threshold before forced handoff (e.g., 180000 for 200K context) */
    maxTokenThreshold: number;
    /** Warning threshold for early detection (e.g., 150000) */
    warningThreshold: number;
    /** Handoff strategy */
    handoffStrategy: 'immediate' | 'at_checkpoint' | 'at_phase_boundary';
    /** Target compression ratio (default: 0.2 = 20%) */
    compressionRatio: number;
    /** Maximum context entries to keep */
    maxContextEntries: number;
    /** Enable verbose logging */
    verbose: boolean;
}

const DEFAULT_CONFIG: ContextOverflowConfig = {
    maxTokenThreshold: 180000,      // 180K for 200K context models
    warningThreshold: 150000,       // Warning at 150K
    handoffStrategy: 'at_checkpoint',
    compressionRatio: 0.2,
    maxContextEntries: 50,
    verbose: true,
};

// ============================================================================
// CONTEXT STATUS AND HANDOFF TYPES
// ============================================================================

export type ContextStatusLevel = 'normal' | 'warning' | 'critical' | 'overflow';

export interface ContextStatus {
    /** Current token usage estimate */
    currentTokens: number;
    /** Maximum tokens before handoff */
    maxTokens: number;
    /** Usage percentage (0-100) */
    usagePercent: number;
    /** Status level */
    level: ContextStatusLevel;
    /** Whether handoff is recommended */
    handoffRecommended: boolean;
    /** Whether handoff is required (critical/overflow) */
    handoffRequired: boolean;
    /** Estimated tokens until handoff */
    tokensUntilHandoff: number;
    /** Time of last check */
    checkedAt: Date;
}

export interface CompressedContext {
    /** Unique identifier for this compressed context */
    id: string;
    /** Version for compatibility checking */
    version: number;
    /** Original token count */
    originalTokens: number;
    /** Compressed token count */
    compressedTokens: number;
    /** Compression ratio achieved */
    compressionRatio: number;
    /** Timestamp of compression */
    compressedAt: Date;

    /** Intent Lock Contract (NEVER compressed - sacred) */
    intentContract: IntentContract | null;

    /** Current task details (preserved fully) */
    currentTask: CurrentTaskContext;

    /** Summarized completed work */
    completedWorkSummary: string;

    /** Recent errors and their resolutions (last 10) */
    recentErrors: ErrorResolutionSummary[];

    /** File modification history (paths only) */
    fileModifications: FileModificationEntry[];

    /** Key decisions made during the session */
    keyDecisions: string[];

    /** Current phase and stage */
    buildContext: BuildContextSummary;

    /** Hash for integrity verification */
    integrityHash: string;
}

export interface CurrentTaskContext {
    /** Task ID */
    taskId: string;
    /** Task description */
    description: string;
    /** Task type */
    type: string;
    /** Current status */
    status: string;
    /** Progress percentage */
    progress: number;
    /** Files being worked on */
    activeFiles: string[];
    /** Current sub-step */
    currentStep: string;
    /** Important context for continuation */
    continuationContext: string;
}

export interface ErrorResolutionSummary {
    /** Error signature hash */
    signatureHash: string;
    /** Error message (truncated) */
    errorMessage: string;
    /** Resolution applied */
    resolution: string;
    /** Whether it was successful */
    resolved: boolean;
    /** Timestamp */
    timestamp: Date;
}

export interface FileModificationEntry {
    /** File path */
    path: string;
    /** Type of modification */
    action: 'create' | 'update' | 'delete';
    /** Timestamp */
    timestamp: Date;
    /** Brief description */
    description?: string;
}

export interface BuildContextSummary {
    /** Current build phase */
    phase: string;
    /** Current build stage */
    stage: string;
    /** Stage progress percentage */
    stageProgress: number;
    /** Phases completed */
    completedPhases: string[];
    /** Features completed */
    featuresCompleted: number;
    /** Features total */
    featuresTotal: number;
    /** Error count */
    errorCount: number;
    /** Escalation level */
    escalationLevel: number;
}

export interface AgentHandoff {
    /** Handoff ID */
    id: string;
    /** Source agent ID */
    fromAgentId: string;
    /** Target agent ID */
    toAgentId: string;
    /** Compressed context snapshot */
    contextSnapshot: CompressedContext;
    /** Current task being worked on */
    currentTask: string;
    /** List of completed tasks */
    completedTasks: string[];
    /** List of pending tasks */
    pendingTasks: string[];
    /** Handoff timestamp */
    timestamp: Date;
    /** Reason for handoff */
    reason: 'context_overflow' | 'phase_boundary' | 'checkpoint' | 'error_recovery' | 'manual';
    /** Whether handoff was seamless (no user notification) */
    seamless: boolean;
    /** Handoff acknowledgment from new agent */
    acknowledged: boolean;
    /** Acknowledgment timestamp */
    acknowledgedAt: Date | null;
}

// ============================================================================
// AGENT CONTEXT TRACKING
// ============================================================================

interface AgentContextState {
    agentId: string;
    agentType: AgentType;
    projectId: string;
    userId: string;
    orchestrationRunId: string;

    // Token tracking
    estimatedTokens: number;
    lastTokenUpdate: Date;
    tokenHistory: Array<{ tokens: number; timestamp: Date }>;

    // Context data
    conversationHistory: Array<{ role: string; content: string; timestamp: Date }>;
    intentContract: IntentContract | null;
    currentTask: CurrentTaskContext | null;
    completedTasks: string[];
    pendingTasks: string[];
    errors: ErrorResolutionSummary[];
    fileModifications: FileModificationEntry[];
    keyDecisions: string[];
    buildContext: BuildContextSummary | null;

    // Handoff tracking
    handoffCount: number;
    previousAgentId: string | null;
    previousCompressedContext: CompressedContext | null;
}

// ============================================================================
// CONTEXT OVERFLOW MANAGER
// ============================================================================

export class ContextOverflowManager extends EventEmitter {
    private config: ContextOverflowConfig;
    private agentStates: Map<string, AgentContextState> = new Map();
    private handoffHistory: Map<string, AgentHandoff[]> = new Map();
    private claudeService: ReturnType<typeof createClaudeService>;

    constructor(config?: Partial<ContextOverflowConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Initialize Claude service for context summarization
        this.claudeService = createClaudeService({
            projectId: 'context-overflow-manager',
            userId: 'system',
            agentType: 'planning',
        });

        console.log('[ContextOverflowManager] Initialized with config:', {
            maxTokenThreshold: this.config.maxTokenThreshold,
            warningThreshold: this.config.warningThreshold,
            handoffStrategy: this.config.handoffStrategy,
        });
    }

    /**
     * Register an agent for context tracking
     */
    registerAgent(
        agentId: string,
        agentType: AgentType,
        projectId: string,
        userId: string,
        orchestrationRunId: string,
        initialContext?: Partial<AgentContextState>
    ): void {
        const state: AgentContextState = {
            agentId,
            agentType,
            projectId,
            userId,
            orchestrationRunId,
            estimatedTokens: 0,
            lastTokenUpdate: new Date(),
            tokenHistory: [],
            conversationHistory: [],
            intentContract: null,
            currentTask: null,
            completedTasks: [],
            pendingTasks: [],
            errors: [],
            fileModifications: [],
            keyDecisions: [],
            buildContext: null,
            handoffCount: 0,
            previousAgentId: null,
            previousCompressedContext: null,
            ...initialContext,
        };

        this.agentStates.set(agentId, state);

        if (this.config.verbose) {
            console.log(`[ContextOverflowManager] Registered agent: ${agentId} (type: ${agentType})`);
        }

        this.emit('agent_registered', { agentId, agentType });
    }

    /**
     * Update token count for an agent
     */
    updateTokenCount(agentId: string, tokens: number): void {
        const state = this.agentStates.get(agentId);
        if (!state) {
            console.warn(`[ContextOverflowManager] Agent not found: ${agentId}`);
            return;
        }

        state.estimatedTokens = tokens;
        state.lastTokenUpdate = new Date();
        state.tokenHistory.push({ tokens, timestamp: new Date() });

        // Keep only last 100 token history entries
        if (state.tokenHistory.length > 100) {
            state.tokenHistory = state.tokenHistory.slice(-100);
        }

        // Check status and emit events if needed
        const status = this.checkContextUsage(agentId);

        if (status.level === 'warning') {
            this.emit('context_warning', { agentId, status });
        } else if (status.level === 'critical') {
            this.emit('context_critical', { agentId, status });
        } else if (status.level === 'overflow') {
            this.emit('context_overflow', { agentId, status });
        }
    }

    /**
     * Add tokens to the current count (incremental update)
     */
    addTokens(agentId: string, additionalTokens: number): void {
        const state = this.agentStates.get(agentId);
        if (!state) return;

        this.updateTokenCount(agentId, state.estimatedTokens + additionalTokens);
    }

    /**
     * Update conversation history
     */
    addConversationEntry(agentId: string, role: string, content: string): void {
        const state = this.agentStates.get(agentId);
        if (!state) return;

        state.conversationHistory.push({
            role,
            content,
            timestamp: new Date(),
        });

        // Estimate tokens for this entry (rough: 4 chars per token)
        const estimatedTokens = Math.ceil(content.length / 4);
        this.addTokens(agentId, estimatedTokens);
    }

    /**
     * Set intent contract (never compressed)
     */
    setIntentContract(agentId: string, contract: IntentContract): void {
        const state = this.agentStates.get(agentId);
        if (!state) return;

        state.intentContract = contract;

        // Estimate tokens for intent contract
        const contractJson = JSON.stringify(contract);
        const estimatedTokens = Math.ceil(contractJson.length / 4);
        this.addTokens(agentId, estimatedTokens);
    }

    /**
     * Update current task context
     */
    updateCurrentTask(agentId: string, task: Partial<CurrentTaskContext>): void {
        const state = this.agentStates.get(agentId);
        if (!state) return;

        if (state.currentTask) {
            state.currentTask = { ...state.currentTask, ...task };
        } else {
            state.currentTask = {
                taskId: task.taskId || uuidv4(),
                description: task.description || '',
                type: task.type || 'unknown',
                status: task.status || 'in_progress',
                progress: task.progress || 0,
                activeFiles: task.activeFiles || [],
                currentStep: task.currentStep || '',
                continuationContext: task.continuationContext || '',
            };
        }
    }

    /**
     * Record task completion
     */
    completeTask(agentId: string, taskId: string): void {
        const state = this.agentStates.get(agentId);
        if (!state) return;

        if (!state.completedTasks.includes(taskId)) {
            state.completedTasks.push(taskId);
        }

        // Remove from pending if present
        state.pendingTasks = state.pendingTasks.filter(id => id !== taskId);

        // Clear current task if it matches
        if (state.currentTask?.taskId === taskId) {
            state.currentTask = null;
        }
    }

    /**
     * Record error and resolution
     */
    recordError(agentId: string, error: Error, resolution?: string, resolved?: boolean): void {
        const state = this.agentStates.get(agentId);
        if (!state) return;

        const signatureHash = createHash('sha256')
            .update(error.message)
            .digest('hex')
            .substring(0, 16);

        state.errors.push({
            signatureHash,
            errorMessage: error.message.substring(0, 200),
            resolution: resolution || 'pending',
            resolved: resolved ?? false,
            timestamp: new Date(),
        });

        // Keep only last 20 errors
        if (state.errors.length > 20) {
            state.errors = state.errors.slice(-20);
        }
    }

    /**
     * Record file modification
     */
    recordFileModification(
        agentId: string,
        path: string,
        action: 'create' | 'update' | 'delete',
        description?: string
    ): void {
        const state = this.agentStates.get(agentId);
        if (!state) return;

        state.fileModifications.push({
            path,
            action,
            timestamp: new Date(),
            description,
        });

        // Keep only last 100 file modifications
        if (state.fileModifications.length > 100) {
            state.fileModifications = state.fileModifications.slice(-100);
        }
    }

    /**
     * Record key decision
     */
    recordDecision(agentId: string, decision: string): void {
        const state = this.agentStates.get(agentId);
        if (!state) return;

        state.keyDecisions.push(decision);

        // Keep only last 30 decisions
        if (state.keyDecisions.length > 30) {
            state.keyDecisions = state.keyDecisions.slice(-30);
        }
    }

    /**
     * Update build context
     */
    updateBuildContext(agentId: string, context: Partial<BuildContextSummary>): void {
        const state = this.agentStates.get(agentId);
        if (!state) return;

        if (state.buildContext) {
            state.buildContext = { ...state.buildContext, ...context };
        } else {
            state.buildContext = {
                phase: context.phase || 'unknown',
                stage: context.stage || 'frontend',
                stageProgress: context.stageProgress || 0,
                completedPhases: context.completedPhases || [],
                featuresCompleted: context.featuresCompleted || 0,
                featuresTotal: context.featuresTotal || 0,
                errorCount: context.errorCount || 0,
                escalationLevel: context.escalationLevel || 0,
            };
        }
    }

    /**
     * Check context usage for an agent
     */
    checkContextUsage(agentId: string): ContextStatus {
        const state = this.agentStates.get(agentId);

        if (!state) {
            return {
                currentTokens: 0,
                maxTokens: this.config.maxTokenThreshold,
                usagePercent: 0,
                level: 'normal',
                handoffRecommended: false,
                handoffRequired: false,
                tokensUntilHandoff: this.config.maxTokenThreshold,
                checkedAt: new Date(),
            };
        }

        const currentTokens = state.estimatedTokens;
        const maxTokens = this.config.maxTokenThreshold;
        const warningThreshold = this.config.warningThreshold;
        const usagePercent = Math.round((currentTokens / maxTokens) * 100);
        const tokensUntilHandoff = Math.max(0, maxTokens - currentTokens);

        let level: ContextStatusLevel = 'normal';
        let handoffRecommended = false;
        let handoffRequired = false;

        if (currentTokens >= maxTokens) {
            level = 'overflow';
            handoffRequired = true;
            handoffRecommended = true;
        } else if (currentTokens >= maxTokens * 0.95) {
            level = 'critical';
            handoffRequired = true;
            handoffRecommended = true;
        } else if (currentTokens >= warningThreshold) {
            level = 'warning';
            handoffRecommended = true;
        }

        return {
            currentTokens,
            maxTokens,
            usagePercent,
            level,
            handoffRecommended,
            handoffRequired,
            tokensUntilHandoff,
            checkedAt: new Date(),
        };
    }

    /**
     * Compress context for handoff
     */
    async compressContext(agentId: string): Promise<CompressedContext> {
        const state = this.agentStates.get(agentId);

        if (!state) {
            throw new Error(`Agent not found: ${agentId}`);
        }

        const originalTokens = state.estimatedTokens;

        // Summarize completed work using AI
        const completedWorkSummary = await this.summarizeCompletedWork(state);

        // Build compressed context
        const compressed: CompressedContext = {
            id: uuidv4(),
            version: 1,
            originalTokens,
            compressedTokens: 0, // Will be calculated
            compressionRatio: 0, // Will be calculated
            compressedAt: new Date(),

            // Intent Contract - NEVER compressed (sacred)
            intentContract: state.intentContract,

            // Current task - preserved fully
            currentTask: state.currentTask || {
                taskId: '',
                description: '',
                type: '',
                status: 'idle',
                progress: 0,
                activeFiles: [],
                currentStep: '',
                continuationContext: '',
            },

            // Summarized completed work
            completedWorkSummary,

            // Recent errors (last 10)
            recentErrors: state.errors.slice(-10),

            // File modifications (paths only)
            fileModifications: state.fileModifications.slice(-50),

            // Key decisions
            keyDecisions: state.keyDecisions.slice(-20),

            // Build context
            buildContext: state.buildContext || {
                phase: 'unknown',
                stage: 'frontend',
                stageProgress: 0,
                completedPhases: [],
                featuresCompleted: 0,
                featuresTotal: 0,
                errorCount: 0,
                escalationLevel: 0,
            },

            // Integrity hash
            integrityHash: '',
        };

        // Calculate compressed token count
        const compressedJson = JSON.stringify(compressed);
        compressed.compressedTokens = Math.ceil(compressedJson.length / 4);
        compressed.compressionRatio = compressed.compressedTokens / Math.max(originalTokens, 1);

        // Generate integrity hash
        compressed.integrityHash = createHash('sha256')
            .update(compressedJson)
            .digest('hex');

        if (this.config.verbose) {
            console.log(`[ContextOverflowManager] Compressed context for ${agentId}:`, {
                originalTokens,
                compressedTokens: compressed.compressedTokens,
                compressionRatio: `${Math.round(compressed.compressionRatio * 100)}%`,
            });
        }

        return compressed;
    }

    /**
     * Summarize completed work using AI
     */
    private async summarizeCompletedWork(state: AgentContextState): Promise<string> {
        if (state.completedTasks.length === 0 && state.conversationHistory.length === 0) {
            return 'No work completed yet.';
        }

        // Build summary prompt
        const summaryPrompt = `Summarize the following completed work in a concise format for context handoff.
Focus on:
1. What was accomplished (key outcomes)
2. Important technical decisions made
3. Any issues resolved
4. Current state of the build

Completed Tasks: ${state.completedTasks.length} tasks
Key Decisions: ${state.keyDecisions.join('; ')}
Files Modified: ${state.fileModifications.length} files
Recent Errors Resolved: ${state.errors.filter(e => e.resolved).length}

Keep the summary under 500 words.`;

        try {
            const response = await this.claudeService.generate(summaryPrompt, {
                model: CLAUDE_MODELS.HAIKU,
                maxTokens: 1000,
            });

            return response.content;
        } catch (error) {
            console.error('[ContextOverflowManager] Failed to summarize work:', error);

            // Fallback to basic summary
            return `Completed ${state.completedTasks.length} tasks. ` +
                `Modified ${state.fileModifications.length} files. ` +
                `Resolved ${state.errors.filter(e => e.resolved).length} errors. ` +
                `Key decisions: ${state.keyDecisions.slice(-5).join('; ')}`;
        }
    }

    /**
     * Restore context from compressed snapshot
     */
    restoreContext(agentId: string, compressed: CompressedContext): void {
        const state = this.agentStates.get(agentId);
        if (!state) {
            throw new Error(`Agent not found: ${agentId}`);
        }

        // Verify integrity
        const checkHash = createHash('sha256')
            .update(JSON.stringify({ ...compressed, integrityHash: '' }))
            .digest('hex');

        if (checkHash !== compressed.integrityHash) {
            console.warn('[ContextOverflowManager] Integrity check failed for compressed context');
        }

        // Restore state from compressed context
        state.intentContract = compressed.intentContract;
        state.currentTask = compressed.currentTask;
        state.errors = compressed.recentErrors;
        state.fileModifications = compressed.fileModifications;
        state.keyDecisions = compressed.keyDecisions;
        state.buildContext = compressed.buildContext;
        state.previousCompressedContext = compressed;

        // Reset token count to compressed size
        state.estimatedTokens = compressed.compressedTokens;
        state.lastTokenUpdate = new Date();

        // Add restoration context to conversation
        state.conversationHistory = [{
            role: 'system',
            content: `Context restored from previous agent. Summary of completed work:\n\n${compressed.completedWorkSummary}`,
            timestamp: new Date(),
        }];

        if (this.config.verbose) {
            console.log(`[ContextOverflowManager] Restored context for ${agentId} from compressed snapshot`);
        }

        this.emit('context_restored', { agentId, compressed });
    }

    /**
     * Initiate handoff from one agent to a new instance
     */
    async initiateHandoff(
        fromAgentId: string,
        reason: AgentHandoff['reason'] = 'context_overflow'
    ): Promise<AgentHandoff> {
        const fromState = this.agentStates.get(fromAgentId);
        if (!fromState) {
            throw new Error(`Agent not found: ${fromAgentId}`);
        }

        // Generate new agent ID
        const toAgentId = `${fromState.agentType}-${uuidv4().substring(0, 8)}`;

        if (this.config.verbose) {
            console.log(`[ContextOverflowManager] Initiating handoff: ${fromAgentId} -> ${toAgentId}`);
        }

        // Compress current context
        const contextSnapshot = await this.compressContext(fromAgentId);

        // Create handoff record
        const handoff: AgentHandoff = {
            id: uuidv4(),
            fromAgentId,
            toAgentId,
            contextSnapshot,
            currentTask: fromState.currentTask?.description || '',
            completedTasks: [...fromState.completedTasks],
            pendingTasks: [...fromState.pendingTasks],
            timestamp: new Date(),
            reason,
            seamless: true, // No user notification
            acknowledged: false,
            acknowledgedAt: null,
        };

        // Register new agent with restored context
        this.registerAgent(
            toAgentId,
            fromState.agentType,
            fromState.projectId,
            fromState.userId,
            fromState.orchestrationRunId,
            {
                handoffCount: fromState.handoffCount + 1,
                previousAgentId: fromAgentId,
                completedTasks: handoff.completedTasks,
                pendingTasks: handoff.pendingTasks,
            }
        );

        // Restore context in new agent
        this.restoreContext(toAgentId, contextSnapshot);

        // Store handoff in history
        const projectHandoffs = this.handoffHistory.get(fromState.projectId) || [];
        projectHandoffs.push(handoff);
        this.handoffHistory.set(fromState.projectId, projectHandoffs);

        // Emit handoff event
        this.emit('handoff_initiated', handoff);

        if (this.config.verbose) {
            console.log(`[ContextOverflowManager] Handoff complete: ${fromAgentId} -> ${toAgentId}`, {
                reason,
                originalTokens: contextSnapshot.originalTokens,
                compressedTokens: contextSnapshot.compressedTokens,
            });
        }

        return handoff;
    }

    /**
     * Acknowledge handoff from new agent
     */
    acknowledgeHandoff(handoffId: string): void {
        for (const [projectId, handoffs] of this.handoffHistory) {
            const handoff = handoffs.find(h => h.id === handoffId);
            if (handoff) {
                handoff.acknowledged = true;
                handoff.acknowledgedAt = new Date();

                this.emit('handoff_acknowledged', handoff);

                if (this.config.verbose) {
                    console.log(`[ContextOverflowManager] Handoff acknowledged: ${handoffId}`);
                }

                return;
            }
        }

        console.warn(`[ContextOverflowManager] Handoff not found: ${handoffId}`);
    }

    /**
     * Terminate an agent gracefully after handoff
     */
    terminateAgent(agentId: string): void {
        const state = this.agentStates.get(agentId);
        if (!state) return;

        // Emit termination event
        this.emit('agent_terminated', { agentId, state });

        // Remove from tracking
        this.agentStates.delete(agentId);

        if (this.config.verbose) {
            console.log(`[ContextOverflowManager] Agent terminated: ${agentId}`);
        }
    }

    /**
     * Get handoff history for a project
     */
    getHandoffHistory(projectId: string): AgentHandoff[] {
        return this.handoffHistory.get(projectId) || [];
    }

    /**
     * Get agent state (for debugging/monitoring)
     */
    getAgentState(agentId: string): AgentContextState | undefined {
        return this.agentStates.get(agentId);
    }

    /**
     * Check if handoff should be triggered based on strategy
     */
    shouldTriggerHandoff(agentId: string, atCheckpoint: boolean, atPhaseBoundary: boolean): boolean {
        const status = this.checkContextUsage(agentId);

        // Always handoff if overflow
        if (status.handoffRequired) {
            return true;
        }

        // Check based on strategy
        switch (this.config.handoffStrategy) {
            case 'immediate':
                return status.handoffRecommended;

            case 'at_checkpoint':
                return status.handoffRecommended && atCheckpoint;

            case 'at_phase_boundary':
                return status.handoffRecommended && atPhaseBoundary;

            default:
                return status.handoffRequired;
        }
    }

    /**
     * Generate handoff acknowledgment prompt for new agent
     */
    generateAcknowledgmentPrompt(handoff: AgentHandoff): string {
        const ctx = handoff.contextSnapshot;

        return `# Context Handoff Acknowledgment

You are continuing work from a previous agent instance due to ${handoff.reason.replace('_', ' ')}.

## Intent Contract (Sacred - Do Not Modify)
${ctx.intentContract ? JSON.stringify(ctx.intentContract, null, 2) : 'No intent contract set'}

## Current Task
${ctx.currentTask.description || 'No active task'}
- Status: ${ctx.currentTask.status}
- Progress: ${ctx.currentTask.progress}%
- Current Step: ${ctx.currentTask.currentStep}
- Active Files: ${ctx.currentTask.activeFiles.join(', ') || 'None'}

## Completed Work Summary
${ctx.completedWorkSummary}

## Build Context
- Phase: ${ctx.buildContext.phase}
- Stage: ${ctx.buildContext.stage}
- Features: ${ctx.buildContext.featuresCompleted}/${ctx.buildContext.featuresTotal}
- Completed Phases: ${ctx.buildContext.completedPhases.join(', ') || 'None'}

## Recent File Modifications (Last 10)
${ctx.fileModifications.slice(-10).map(f => `- ${f.action}: ${f.path}`).join('\n') || 'None'}

## Recent Errors (Last 5)
${ctx.recentErrors.slice(-5).map(e => `- ${e.resolved ? '✓' : '✗'} ${e.errorMessage}`).join('\n') || 'None'}

## Key Decisions
${ctx.keyDecisions.slice(-10).map((d, i) => `${i + 1}. ${d}`).join('\n') || 'None'}

---

Please acknowledge you understand the current state and are ready to continue.
Reply with "ACKNOWLEDGED" followed by your plan to continue the current task.`;
    }

    /**
     * Get statistics for monitoring
     */
    getStatistics(): {
        activeAgents: number;
        totalHandoffs: number;
        avgCompressionRatio: number;
        agentsByStatus: Record<ContextStatusLevel, number>;
    } {
        const stats = {
            activeAgents: this.agentStates.size,
            totalHandoffs: 0,
            avgCompressionRatio: 0,
            agentsByStatus: {
                normal: 0,
                warning: 0,
                critical: 0,
                overflow: 0,
            } as Record<ContextStatusLevel, number>,
        };

        // Count handoffs and calculate avg compression
        let totalCompression = 0;
        let compressionCount = 0;

        for (const handoffs of this.handoffHistory.values()) {
            stats.totalHandoffs += handoffs.length;
            for (const h of handoffs) {
                totalCompression += h.contextSnapshot.compressionRatio;
                compressionCount++;
            }
        }

        stats.avgCompressionRatio = compressionCount > 0 ? totalCompression / compressionCount : 0;

        // Count agents by status
        for (const [agentId] of this.agentStates) {
            const status = this.checkContextUsage(agentId);
            stats.agentsByStatus[status.level]++;
        }

        return stats;
    }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

let instance: ContextOverflowManager | null = null;

export function getContextOverflowManager(config?: Partial<ContextOverflowConfig>): ContextOverflowManager {
    if (!instance) {
        instance = new ContextOverflowManager(config);
    }
    return instance;
}

export function createContextOverflowManager(config?: Partial<ContextOverflowConfig>): ContextOverflowManager {
    return new ContextOverflowManager(config);
}

export default ContextOverflowManager;
