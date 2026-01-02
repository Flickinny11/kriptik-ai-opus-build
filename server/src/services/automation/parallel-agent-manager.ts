/**
 * Parallel Agent Manager
 *
 * Manages true multi-agent parallel execution during Phase 2 (PARALLEL BUILD).
 *
 * Key Features:
 * - Spawns up to maxAgents concurrent coding agents
 * - Monitors token usage per agent (180K threshold)
 * - Triggers automatic handoff when agent approaches token limit
 * - All agents share same context, intent, and memory via Memory Harness
 * - Real-time task distribution and load balancing
 * - Seamless agent replacement without user notification
 *
 * Part of Phase 2 Enhancement: True Parallel Multi-Agent Building
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
    createCodingAgentWrapper,
    type CodingAgentWrapper,
    type TaskResult,
} from '../ai/coding-agent-wrapper.js';
import {
    getContextOverflowManager,
    type ContextOverflowManager,
    type ContextStatus,
    type AgentHandoff,
} from '../agents/context-overflow.js';
import { getKripToeNite, type KripToeNiteFacade } from '../ai/krip-toe-nite/index.js';
import { getPhaseConfig } from '../ai/openrouter-client.js';
import { createClaudeService } from '../ai/claude-service.js';
import type { TaskItem } from '../ai/artifacts.js';
import type { IntentContract } from '../ai/intent-lock.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ParallelAgentConfig {
    /** Maximum concurrent agents */
    maxAgents: number;
    /** Project ID */
    projectId: string;
    /** User ID */
    userId: string;
    /** Orchestration run ID */
    orchestrationRunId: string;
    /** Project path */
    projectPath: string;
    /** Build stage (frontend/backend/production) */
    stage: string;
    /** Intent contract for context */
    intentContract: IntentContract | null;
    /** Enable verbose logging */
    verbose?: boolean;
    /** Context Sync Service for agent collaboration (optional) */
    contextSync?: any; // Import type from context-sync-service.ts when available
    /** Git Branch Manager for version control (optional) */
    gitBranchManager?: any; // Import type from git-branch-manager.ts when available
}

export interface AgentSlot {
    /** Slot ID (0-based index) */
    slotId: number;
    /** Current agent ID */
    agentId: string;
    /** Agent wrapper instance */
    wrapper: CodingAgentWrapper;
    /** Current token count */
    currentTokens: number;
    /** Last token update */
    lastTokenUpdate: Date;
    /** Current task ID (if any) */
    currentTaskId: string | null;
    /** Task start time */
    taskStartedAt: Date | null;
    /** Status */
    status: 'idle' | 'claiming' | 'building' | 'handoff';
    /** Handoff count for this slot */
    handoffCount: number;
    /** Created at */
    createdAt: Date;
}

export interface ParallelBuildResult {
    /** Total tasks completed */
    tasksCompleted: number;
    /** Total agents spawned (including handoffs) */
    agentsSpawned: number;
    /** Total handoffs performed */
    handoffsPerformed: number;
    /** Average tokens per agent before handoff */
    avgTokensPerAgent: number;
    /** Total build time in ms */
    totalBuildTimeMs: number;
    /** Agent efficiency (tasks per agent) */
    efficiency: number;
    /** Success */
    success: boolean;
    /** Error (if failed) */
    error?: string;
}

export interface AgentActivityEvent {
    slotId: number;
    agentId: string;
    type: 'spawned' | 'task_claimed' | 'task_completed' | 'handoff_initiated' | 'handoff_completed' | 'error';
    timestamp: Date;
    data: Record<string, unknown>;
}

// =============================================================================
// PARALLEL AGENT MANAGER
// =============================================================================

export class ParallelAgentManager extends EventEmitter {
    private config: ParallelAgentConfig;
    private contextOverflowManager: ContextOverflowManager;
    private ktn: KripToeNiteFacade;

    /** Active agent slots */
    private agentSlots: Map<number, AgentSlot> = new Map();

    /** Global statistics */
    private stats = {
        tasksCompleted: 0,
        agentsSpawned: 0,
        handoffsPerformed: 0,
        totalTokensUsed: 0,
        startTime: Date.now(),
    };

    /** Pending tasks queue */
    private pendingTasks: TaskItem[] = [];

    /** Active flag */
    private active: boolean = false;

    /** Abort signal */
    private aborted: boolean = false;

    constructor(config: ParallelAgentConfig) {
        super();
        this.config = config;
        this.contextOverflowManager = getContextOverflowManager();
        this.ktn = getKripToeNite();

        if (this.config.verbose) {
            console.log(`[ParallelAgentManager] Initialized with maxAgents=${config.maxAgents}`);
        }

        // Set up context overflow event handlers
        this.setupContextOverflowHandlers();
    }

    /**
     * Set up event handlers for context overflow warnings
     */
    private setupContextOverflowHandlers(): void {
        this.contextOverflowManager.on('context_warning', ({ agentId, status }: { agentId: string; status: ContextStatus }) => {
            if (this.config.verbose) {
                console.log(`[ParallelAgentManager] Context warning for ${agentId}: ${status.usagePercent}% used`);
            }
            this.emit('agent:context-warning', { agentId, status });
        });

        this.contextOverflowManager.on('context_critical', ({ agentId, status }: { agentId: string; status: ContextStatus }) => {
            if (this.config.verbose) {
                console.log(`[ParallelAgentManager] Context critical for ${agentId}: ${status.usagePercent}% used`);
            }

            // Proactively trigger handoff at critical threshold
            this.triggerAgentHandoff(agentId, 'context_overflow');
        });

        this.contextOverflowManager.on('handoff_initiated', (handoff: AgentHandoff) => {
            if (this.config.verbose) {
                console.log(`[ParallelAgentManager] Handoff initiated: ${handoff.fromAgentId} -> ${handoff.toAgentId}`);
            }
            this.emit('agent:handoff-initiated', handoff);
        });

        this.contextOverflowManager.on('handoff_acknowledged', (handoff: AgentHandoff) => {
            if (this.config.verbose) {
                console.log(`[ParallelAgentManager] Handoff acknowledged: ${handoff.toAgentId}`);
            }

            // Complete the handoff by replacing the old agent with the new one
            this.completeAgentHandoff(handoff);
        });
    }

    /**
     * Start parallel building with all agents
     * Returns when all tasks are complete or error occurs
     */
    async startParallelBuild(): Promise<ParallelBuildResult> {
        this.active = true;
        this.stats.startTime = Date.now();

        try {
            // Spawn initial agent pool
            await this.spawnInitialAgentPool();

            // Start the task distribution loop
            await this.taskDistributionLoop();

            // Wait for all agents to complete their tasks
            await this.waitForAllAgentsIdle();

            // Calculate final statistics
            const totalBuildTimeMs = Date.now() - this.stats.startTime;
            const avgTokensPerAgent = this.stats.agentsSpawned > 0
                ? this.stats.totalTokensUsed / this.stats.agentsSpawned
                : 0;
            const efficiency = this.stats.agentsSpawned > 0
                ? this.stats.tasksCompleted / this.stats.agentsSpawned
                : 0;

            return {
                tasksCompleted: this.stats.tasksCompleted,
                agentsSpawned: this.stats.agentsSpawned,
                handoffsPerformed: this.stats.handoffsPerformed,
                avgTokensPerAgent,
                totalBuildTimeMs,
                efficiency,
                success: true,
            };
        } catch (error) {
            const err = error as Error;
            console.error('[ParallelAgentManager] Build failed:', err);
            return {
                tasksCompleted: this.stats.tasksCompleted,
                agentsSpawned: this.stats.agentsSpawned,
                handoffsPerformed: this.stats.handoffsPerformed,
                avgTokensPerAgent: 0,
                totalBuildTimeMs: Date.now() - this.stats.startTime,
                efficiency: 0,
                success: false,
                error: err.message,
            };
        } finally {
            this.active = false;
            await this.shutdownAllAgents();
        }
    }

    /**
     * Spawn initial pool of agents (up to maxAgents)
     */
    private async spawnInitialAgentPool(): Promise<void> {
        console.log(`[ParallelAgentManager] Spawning initial pool of ${this.config.maxAgents} agents`);

        const spawnPromises: Promise<void>[] = [];

        for (let slotId = 0; slotId < this.config.maxAgents; slotId++) {
            spawnPromises.push(this.spawnAgentInSlot(slotId));
        }

        await Promise.all(spawnPromises);

        console.log(`[ParallelAgentManager] Initial pool spawned: ${this.agentSlots.size} agents active`);
    }

    /**
     * Spawn a new agent in a specific slot
     */
    private async spawnAgentInSlot(slotId: number): Promise<void> {
        const agentId = `parallel-agent-${slotId}-${Date.now()}`;

        // Create coding agent wrapper
        const wrapper = createCodingAgentWrapper({
            projectId: this.config.projectId,
            userId: this.config.userId,
            orchestrationRunId: this.config.orchestrationRunId,
            projectPath: this.config.projectPath,
            agentType: 'build',
            agentId,
        });

        // Start session (loads context from artifacts)
        await wrapper.startSession();

        // Register with context overflow manager
        this.contextOverflowManager.registerAgent(
            agentId,
            'coding',
            this.config.projectId,
            this.config.userId,
            this.config.orchestrationRunId
        );

        // Set intent contract in context manager
        if (this.config.intentContract) {
            this.contextOverflowManager.setIntentContract(agentId, this.config.intentContract);
        }

        // Create slot entry
        const slot: AgentSlot = {
            slotId,
            agentId,
            wrapper,
            currentTokens: 0,
            lastTokenUpdate: new Date(),
            currentTaskId: null,
            taskStartedAt: null,
            status: 'idle',
            handoffCount: 0,
            createdAt: new Date(),
        };

        this.agentSlots.set(slotId, slot);
        this.stats.agentsSpawned++;

        this.emitActivity({
            slotId,
            agentId,
            type: 'spawned',
            timestamp: new Date(),
            data: { stage: this.config.stage },
        });

        if (this.config.verbose) {
            console.log(`[ParallelAgentManager] Spawned agent in slot ${slotId}: ${agentId}`);
        }
    }

    /**
     * Main task distribution loop
     * Continuously assigns tasks to idle agents
     */
    private async taskDistributionLoop(): Promise<void> {
        while (this.active && !this.aborted) {
            // Get all idle agents
            const idleSlots = Array.from(this.agentSlots.values())
                .filter(slot => slot.status === 'idle');

            if (idleSlots.length === 0) {
                // No idle agents, wait briefly
                await this.sleep(100);
                continue;
            }

            // Try to assign tasks to idle agents in parallel
            const assignPromises = idleSlots.map(slot => this.assignTaskToAgent(slot));
            await Promise.allSettled(assignPromises);

            // Check if we're done (no more tasks and all agents idle)
            const allIdle = Array.from(this.agentSlots.values()).every(slot => slot.status === 'idle');
            if (allIdle && this.pendingTasks.length === 0) {
                // Check if there are any tasks left to claim from artifact manager
                const anySlot = this.agentSlots.values().next().value;
                if (anySlot) {
                    const nextTask = await anySlot.wrapper.claimTask();
                    if (!nextTask) {
                        // Truly no tasks left
                        break;
                    } else {
                        // Found a task, release it back and continue loop
                        this.pendingTasks.push(nextTask);
                    }
                }
            }

            // Brief pause before next iteration
            await this.sleep(50);
        }
    }

    /**
     * Assign a task to a specific agent
     */
    private async assignTaskToAgent(slot: AgentSlot): Promise<void> {
        if (slot.status !== 'idle') {
            return; // Slot not available
        }

        slot.status = 'claiming';

        try {
            // Try to get a task from pending queue first
            let task: TaskItem | null = this.pendingTasks.shift() || null;

            // If no pending tasks, claim from artifact manager
            if (!task) {
                task = await slot.wrapper.claimTask();
            }

            if (!task) {
                // No tasks available
                slot.status = 'idle';
                return;
            }

            // Update slot state
            slot.currentTaskId = task.id;
            slot.taskStartedAt = new Date();
            slot.status = 'building';

            // Update context manager with current task
            this.contextOverflowManager.updateCurrentTask(slot.agentId, {
                taskId: task.id,
                description: task.description,
                type: task.category,
                status: 'in_progress',
                progress: 0,
                activeFiles: [],
                currentStep: 'Building',
                continuationContext: `Building ${task.category} task: ${task.description}`,
            });

            this.emitActivity({
                slotId: slot.slotId,
                agentId: slot.agentId,
                type: 'task_claimed',
                timestamp: new Date(),
                data: { taskId: task.id, description: task.description },
            });

            if (this.config.verbose) {
                console.log(`[ParallelAgentManager] Slot ${slot.slotId} claimed task: ${task.id} - ${task.description}`);
            }

            // Execute the task (async, non-blocking)
            this.executeTaskOnAgent(slot, task).catch(err => {
                console.error(`[ParallelAgentManager] Task execution failed on slot ${slot.slotId}:`, err);
                slot.status = 'idle';
                slot.currentTaskId = null;
                slot.taskStartedAt = null;
            });

        } catch (error) {
            console.error(`[ParallelAgentManager] Failed to assign task to slot ${slot.slotId}:`, error);
            slot.status = 'idle';
            slot.currentTaskId = null;
            slot.taskStartedAt = null;
        }
    }

    /**
     * Execute a task on a specific agent
     */
    private async executeTaskOnAgent(slot: AgentSlot, task: TaskItem): Promise<void> {
        const startTime = Date.now();

        try {
            // Build system prompt for this task
            const basePrompt = `You are a senior software engineer building production-ready code.
You are working on a ${this.config.intentContract?.appType || 'web'} application.
You are part of a parallel build team (Agent ${slot.slotId + 1} of ${this.config.maxAgents}).

TASK: ${task.description}
CATEGORY: ${task.category}
PRIORITY: ${task.priority}

Generate complete, production-ready code for this task.
Follow the existing style guide and patterns.
Do NOT use placeholders or TODO comments.
Include ALL necessary imports and exports.`;

            // Get full context prompt from wrapper
            const systemPrompt = slot.wrapper.getSystemPromptWithContext(basePrompt);

            // Generate code using KripToeNite
            const result = await this.ktn.buildFeature(
                `${task.description}\n\nContext: Building for ${this.config.stage} stage.`,
                {
                    projectId: this.config.projectId,
                    userId: this.config.userId,
                    projectPath: this.config.projectPath,
                    framework: 'React',
                    language: 'TypeScript',
                }
            );

            const responseContent = result.content;

            if (this.config.verbose) {
                console.log(`[ParallelAgentManager] Slot ${slot.slotId} generated code: strategy=${result.strategy}, model=${result.model}`);
            }

            // Update token count
            const tokensUsed = result.usage.totalTokens;
            slot.currentTokens += tokensUsed;
            slot.lastTokenUpdate = new Date();
            this.stats.totalTokensUsed += tokensUsed;

            // Update context overflow manager
            this.contextOverflowManager.addTokens(slot.agentId, tokensUsed);

            // Parse files from response
            const claudeService = createClaudeService({
                projectId: this.config.projectId,
                userId: this.config.userId,
                agentType: 'generation',
            });
            const files = claudeService.parseFileOperations(responseContent);

            // Record file changes
            for (const file of files) {
                slot.wrapper.recordFileChange(file.path, 'create', file.content);

                // Also record in context manager
                this.contextOverflowManager.recordFileModification(
                    slot.agentId,
                    file.path,
                    'create',
                    `Created for task: ${task.description}`
                );
            }

            // Write files to disk
            const fsModule = await import('fs/promises');
            const pathModule = await import('path');
            for (const file of files) {
                if (file.content) {
                    try {
                        const fullPath = pathModule.join(this.config.projectPath, file.path);
                        const dir = pathModule.dirname(fullPath);
                        await fsModule.mkdir(dir, { recursive: true });
                        await fsModule.writeFile(fullPath, file.content, 'utf-8');
                    } catch (writeError) {
                        console.error(`[ParallelAgentManager] Failed to write ${file.path}:`, writeError);
                    }
                }
            }

            // Complete task (updates artifacts, commits to git)
            const taskResult: TaskResult = await slot.wrapper.completeTask({
                summary: `Built: ${task.description}`,
                filesCreated: files.map(f => f.path),
                nextSteps: [`Verify ${task.category} implementation`],
            });

            // Mark task as complete in context manager
            this.contextOverflowManager.completeTask(slot.agentId, task.id);

            // Update statistics
            this.stats.tasksCompleted++;

            // Emit completion event
            const duration = Date.now() - startTime;
            this.emitActivity({
                slotId: slot.slotId,
                agentId: slot.agentId,
                type: 'task_completed',
                timestamp: new Date(),
                data: {
                    taskId: task.id,
                    description: task.description,
                    filesCreated: files.length,
                    tokensUsed,
                    durationMs: duration,
                    commit: taskResult.gitCommit,
                },
            });

            if (this.config.verbose) {
                console.log(`[ParallelAgentManager] Slot ${slot.slotId} completed task ${task.id} (${duration}ms, ${tokensUsed} tokens)`);
            }

        } catch (error) {
            const err = error as Error;
            console.error(`[ParallelAgentManager] Task execution failed on slot ${slot.slotId}:`, err);

            // Record error in context manager
            this.contextOverflowManager.recordError(slot.agentId, err, 'Task execution failed', false);

            this.emitActivity({
                slotId: slot.slotId,
                agentId: slot.agentId,
                type: 'error',
                timestamp: new Date(),
                data: {
                    taskId: task.id,
                    error: err.message,
                },
            });
        } finally {
            // Reset slot state
            slot.status = 'idle';
            slot.currentTaskId = null;
            slot.taskStartedAt = null;
        }
    }

    /**
     * Trigger agent handoff when approaching token limit
     */
    private async triggerAgentHandoff(agentId: string, reason: 'context_overflow' | 'checkpoint'): Promise<void> {
        // Find the slot for this agent
        const slot = Array.from(this.agentSlots.values()).find(s => s.agentId === agentId);
        if (!slot) {
            console.warn(`[ParallelAgentManager] Cannot find slot for agent ${agentId}`);
            return;
        }

        // Don't handoff if currently building a task
        if (slot.status === 'building') {
            if (this.config.verbose) {
                console.log(`[ParallelAgentManager] Deferring handoff for slot ${slot.slotId} until task completes`);
            }
            return;
        }

        slot.status = 'handoff';

        try {
            if (this.config.verbose) {
                console.log(`[ParallelAgentManager] Initiating handoff for slot ${slot.slotId}: ${agentId}`);
            }

            // Check if handoff should be triggered
            const contextStatus = this.contextOverflowManager.checkContextUsage(agentId);

            if (!this.contextOverflowManager.shouldTriggerHandoff(agentId, true, false)) {
                // Not ready for handoff yet
                slot.status = 'idle';
                return;
            }

            // Initiate handoff through context overflow manager
            const handoff = await this.contextOverflowManager.initiateHandoff(agentId, reason);

            this.emitActivity({
                slotId: slot.slotId,
                agentId: slot.agentId,
                type: 'handoff_initiated',
                timestamp: new Date(),
                data: {
                    fromAgent: handoff.fromAgentId,
                    toAgent: handoff.toAgentId,
                    reason: handoff.reason,
                    tokensUsed: slot.currentTokens,
                },
            });

            // Handoff will be completed by the event handler when acknowledged

        } catch (error) {
            const err = error as Error;
            console.error(`[ParallelAgentManager] Handoff failed for slot ${slot.slotId}:`, err);
            slot.status = 'idle';
        }
    }

    /**
     * Complete agent handoff by replacing old agent with new one
     */
    private async completeAgentHandoff(handoff: AgentHandoff): Promise<void> {
        // Find the slot for the old agent
        const slot = Array.from(this.agentSlots.values()).find(s => s.agentId === handoff.fromAgentId);
        if (!slot) {
            console.warn(`[ParallelAgentManager] Cannot find slot for old agent ${handoff.fromAgentId}`);
            return;
        }

        try {
            // End session for old agent
            await slot.wrapper.endSession();

            // Terminate old agent in context manager
            this.contextOverflowManager.terminateAgent(handoff.fromAgentId);

            // Spawn new agent in the same slot
            const newAgentId = handoff.toAgentId;
            const newWrapper = createCodingAgentWrapper({
                projectId: this.config.projectId,
                userId: this.config.userId,
                orchestrationRunId: this.config.orchestrationRunId,
                projectPath: this.config.projectPath,
                agentType: 'build',
                agentId: newAgentId,
            });

            // Start session (loads context including compressed snapshot from handoff)
            await newWrapper.startSession();

            // Update slot
            slot.agentId = newAgentId;
            slot.wrapper = newWrapper;
            slot.currentTokens = 0; // Reset token count
            slot.lastTokenUpdate = new Date();
            slot.status = 'idle';
            slot.handoffCount++;

            this.stats.handoffsPerformed++;
            this.stats.agentsSpawned++;

            this.emitActivity({
                slotId: slot.slotId,
                agentId: newAgentId,
                type: 'handoff_completed',
                timestamp: new Date(),
                data: {
                    oldAgent: handoff.fromAgentId,
                    newAgent: newAgentId,
                    handoffCount: slot.handoffCount,
                },
            });

            if (this.config.verbose) {
                console.log(`[ParallelAgentManager] Handoff complete for slot ${slot.slotId}: ${handoff.fromAgentId} -> ${newAgentId}`);
            }

        } catch (error) {
            const err = error as Error;
            console.error(`[ParallelAgentManager] Failed to complete handoff for slot ${slot.slotId}:`, err);
            // Re-spawn agent in this slot
            await this.spawnAgentInSlot(slot.slotId);
        }
    }

    /**
     * Wait for all agents to become idle
     */
    private async waitForAllAgentsIdle(): Promise<void> {
        const maxWaitMs = 30000; // 30 seconds max wait
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitMs) {
            const allIdle = Array.from(this.agentSlots.values()).every(slot => slot.status === 'idle');
            if (allIdle) {
                return;
            }
            await this.sleep(500);
        }

        console.warn('[ParallelAgentManager] Timeout waiting for agents to become idle');
    }

    /**
     * Shutdown all agents
     */
    private async shutdownAllAgents(): Promise<void> {
        console.log('[ParallelAgentManager] Shutting down all agents');

        const shutdownPromises: Promise<void>[] = [];

        for (const slot of this.agentSlots.values()) {
            shutdownPromises.push(
                slot.wrapper.endSession().catch(err => {
                    console.error(`[ParallelAgentManager] Error ending session for slot ${slot.slotId}:`, err);
                })
            );

            // Terminate in context manager
            this.contextOverflowManager.terminateAgent(slot.agentId);
        }

        await Promise.allSettled(shutdownPromises);

        this.agentSlots.clear();
    }

    /**
     * Abort all active builds
     */
    abort(): void {
        this.aborted = true;
        this.active = false;
        console.log('[ParallelAgentManager] Aborting parallel build');
    }

    /**
     * Get current statistics
     */
    getStatistics(): typeof this.stats {
        return { ...this.stats };
    }

    /**
     * Get current agent slots status
     */
    getAgentSlots(): AgentSlot[] {
        return Array.from(this.agentSlots.values());
    }

    /**
     * Emit activity event
     */
    private emitActivity(event: AgentActivityEvent): void {
        this.emit('activity', event);
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createParallelAgentManager(config: ParallelAgentConfig): ParallelAgentManager {
    return new ParallelAgentManager(config);
}
