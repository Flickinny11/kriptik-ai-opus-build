/**
 * Task Distributor - Intelligent task distribution across parallel agents
 *
 * Takes a functional checklist and distributes tasks across multiple agents
 * with intelligent dependency analysis, file conflict prevention, and
 * real-time context sharing.
 *
 * Key Features:
 * - Dependency graph analysis for maximum parallelism
 * - File lock coordination to prevent conflicts
 * - Real-time progress tracking
 * - Automatic task reassignment on agent failure
 * - Context sharing via ContextSyncService
 *
 * Part of: KripTik AI Ultimate Architecture
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
    ContextSyncService,
    getContextSyncService,
    type DiscoveryData,
    type SolutionData,
    type ErrorData,
} from './context-sync-service.js';
import {
    getWebSocketSyncService,
    type WebSocketSyncService,
} from './websocket-sync.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Task to be distributed to agents
 */
export interface DistributableTask {
    id: string;
    title: string;
    description: string;
    type: TaskType;
    priority: TaskPriority;
    estimatedDuration: number; // minutes

    // Dependencies
    dependsOn: string[]; // Task IDs that must complete first
    blockedBy: string[]; // File paths that would conflict

    // File context
    filesToModify: string[];
    filesToRead: string[];

    // Metadata
    metadata?: Record<string, unknown>;
}

export type TaskType =
    | 'feature_implementation'
    | 'bug_fix'
    | 'integration'
    | 'testing'
    | 'documentation'
    | 'refactoring'
    | 'deployment';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export type TaskStatus =
    | 'pending'      // Not yet assigned
    | 'queued'       // Assigned but waiting for dependencies
    | 'in_progress'  // Currently being worked on
    | 'completed'    // Successfully completed
    | 'failed'       // Failed (will be retried)
    | 'blocked';     // Blocked by file conflicts or dependencies

/**
 * Agent capable of executing tasks
 */
export interface TaskAgent {
    id: string;
    name: string;
    type: string;
    status: AgentStatus;
    currentTask: string | null;
    completedTasks: string[];
    failedTasks: string[];
    capabilities: string[];
    maxConcurrentTasks: number;
}

export type AgentStatus = 'idle' | 'busy' | 'error' | 'offline';

/**
 * Task assignment
 */
export interface TaskAssignment {
    taskId: string;
    agentId: string;
    assignedAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    status: TaskStatus;
    retryCount: number;
    lastError: string | null;
}

/**
 * Dependency graph for parallel execution
 */
export interface DependencyGraph {
    nodes: Map<string, DistributableTask>;
    edges: Map<string, Set<string>>; // taskId -> Set of dependent task IDs
    layers: string[][]; // Tasks grouped by execution layer (parallel groups)
}

/**
 * Distribution result
 */
export interface DistributionResult {
    success: boolean;
    totalTasks: number;
    assignedTasks: number;
    parallelLayers: number;
    maxParallelism: number;
    estimatedDuration: number; // minutes
    assignments: TaskAssignment[];
    errors: string[];
}

/**
 * Real-time distribution progress
 */
export interface DistributionProgress {
    distributionId: string;
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    failedTasks: number;
    blockedTasks: number;
    currentLayer: number;
    totalLayers: number;
    elapsedTime: number; // ms
    estimatedTimeRemaining: number; // ms
    activeAgents: number;
    idleAgents: number;
}

/**
 * Configuration for task distribution
 */
export interface TaskDistributorConfig {
    maxAgents: number;
    maxRetriesPerTask: number;
    taskTimeout: number; // minutes
    enableFileConflictPrevention: boolean;
    enableContextSharing: boolean;
    enableAutoReassignment: boolean;
}

// =============================================================================
// TASK DISTRIBUTOR
// =============================================================================

export class TaskDistributor extends EventEmitter {
    private distributionId: string;
    private config: TaskDistributorConfig;
    private contextSync: ContextSyncService;
    private wsSync: WebSocketSyncService;

    // State
    private tasks: Map<string, DistributableTask> = new Map();
    private agents: Map<string, TaskAgent> = new Map();
    private assignments: Map<string, TaskAssignment> = new Map();
    private dependencyGraph: DependencyGraph | null = null;

    // Progress tracking
    private startTime: number | null = null;
    private completedCount: number = 0;
    private failedCount: number = 0;

    // File locks (managed via ContextSyncService)
    private fileLocks: Map<string, { agentId: string; taskId: string }> = new Map();

    constructor(
        private buildId: string,
        private projectId: string,
        private userId: string,
        config?: Partial<TaskDistributorConfig>
    ) {
        super();

        this.distributionId = `dist_${uuidv4().slice(0, 12)}`;
        this.config = {
            maxAgents: config?.maxAgents || 5,
            maxRetriesPerTask: config?.maxRetriesPerTask || 3,
            taskTimeout: config?.taskTimeout || 30,
            enableFileConflictPrevention: config?.enableFileConflictPrevention ?? true,
            enableContextSharing: config?.enableContextSharing ?? true,
            enableAutoReassignment: config?.enableAutoReassignment ?? true,
        };

        // Initialize context sync for real-time sharing
        this.contextSync = getContextSyncService(buildId, projectId);
        this.wsSync = getWebSocketSyncService();

        console.log(`[TaskDistributor] Created distribution ${this.distributionId} for build ${buildId}`);
    }

    // =========================================================================
    // AGENT MANAGEMENT
    // =========================================================================

    /**
     * Register an agent for task execution
     */
    registerAgent(
        agentId: string,
        name: string,
        type: string,
        capabilities: string[] = [],
        maxConcurrentTasks: number = 1
    ): void {
        const agent: TaskAgent = {
            id: agentId,
            name,
            type,
            status: 'idle',
            currentTask: null,
            completedTasks: [],
            failedTasks: [],
            capabilities,
            maxConcurrentTasks,
        };

        this.agents.set(agentId, agent);

        // Register with context sync for real-time updates
        if (this.config.enableContextSharing) {
            this.contextSync.registerAgent(agentId, `Ready to execute ${type} tasks`);
        }

        console.log(`[TaskDistributor] Registered agent ${agentId} (${name}) with capabilities: ${capabilities.join(', ')}`);

        this.emit('agent_registered', { agentId, name, type, capabilities });
    }

    /**
     * Unregister an agent
     */
    unregisterAgent(agentId: string): void {
        const agent = this.agents.get(agentId);
        if (!agent) return;

        // Release any file locks held by this agent
        this.releaseAgentLocks(agentId);

        // Unregister from context sync
        if (this.config.enableContextSharing) {
            this.contextSync.unregisterAgent(agentId);
        }

        this.agents.delete(agentId);

        console.log(`[TaskDistributor] Unregistered agent ${agentId}`);

        this.emit('agent_unregistered', { agentId });
    }

    /**
     * Get available agents for task assignment
     */
    private getAvailableAgents(): TaskAgent[] {
        return Array.from(this.agents.values()).filter(agent => {
            if (agent.status === 'offline' || agent.status === 'error') {
                return false;
            }

            // Check if agent has capacity
            const currentTasks = Array.from(this.assignments.values()).filter(
                a => a.agentId === agent.id && a.status === 'in_progress'
            ).length;

            return currentTasks < agent.maxConcurrentTasks;
        });
    }

    // =========================================================================
    // TASK MANAGEMENT
    // =========================================================================

    /**
     * Add tasks to be distributed
     */
    addTasks(tasks: DistributableTask[]): void {
        for (const task of tasks) {
            this.tasks.set(task.id, task);

            // Create initial assignment
            this.assignments.set(task.id, {
                taskId: task.id,
                agentId: '',
                assignedAt: new Date(),
                startedAt: null,
                completedAt: null,
                status: 'pending',
                retryCount: 0,
                lastError: null,
            });
        }

        console.log(`[TaskDistributor] Added ${tasks.length} tasks`);

        this.emit('tasks_added', { count: tasks.length, tasks: tasks.map(t => t.id) });
    }

    /**
     * Analyze dependencies and create execution layers
     */
    private analyzeDependencies(): DependencyGraph {
        const nodes = new Map(this.tasks);
        const edges = new Map<string, Set<string>>();

        // Build edges (task -> tasks that depend on it)
        for (const task of this.tasks.values()) {
            if (!edges.has(task.id)) {
                edges.set(task.id, new Set());
            }

            for (const depId of task.dependsOn) {
                if (!edges.has(depId)) {
                    edges.set(depId, new Set());
                }
                edges.get(depId)!.add(task.id);
            }
        }

        // Create layers using topological sort
        const layers: string[][] = [];
        const completed = new Set<string>();
        const taskIds = Array.from(this.tasks.keys());

        while (completed.size < taskIds.length) {
            const currentLayer: string[] = [];

            for (const taskId of taskIds) {
                if (completed.has(taskId)) continue;

                const task = this.tasks.get(taskId)!;
                const allDepsCompleted = task.dependsOn.every(depId => completed.has(depId));

                if (allDepsCompleted) {
                    currentLayer.push(taskId);
                }
            }

            if (currentLayer.length === 0) {
                // Circular dependency detected
                const remaining = taskIds.filter(id => !completed.has(id));
                console.warn(`[TaskDistributor] Circular dependency detected in tasks: ${remaining.join(', ')}`);
                // Add remaining tasks to final layer
                currentLayer.push(...remaining);
            }

            layers.push(currentLayer);
            currentLayer.forEach(id => completed.add(id));
        }

        console.log(`[TaskDistributor] Dependency analysis complete: ${layers.length} layers`);
        console.log(`[TaskDistributor] Layer sizes: ${layers.map(l => l.length).join(', ')}`);

        return { nodes, edges, layers };
    }

    // =========================================================================
    // DISTRIBUTION
    // =========================================================================

    /**
     * Distribute tasks to agents
     */
    async distribute(): Promise<DistributionResult> {
        this.startTime = Date.now();

        console.log(`[TaskDistributor] Starting distribution of ${this.tasks.size} tasks to ${this.agents.size} agents`);

        // Analyze dependencies
        this.dependencyGraph = this.analyzeDependencies();

        const errors: string[] = [];
        let assignedCount = 0;

        // Calculate metrics
        const maxParallelism = Math.max(...this.dependencyGraph.layers.map(l => l.length));
        const totalEstimatedDuration = this.dependencyGraph.layers.reduce((sum, layer) => {
            const layerMax = Math.max(
                ...layer.map(taskId => this.tasks.get(taskId)?.estimatedDuration || 0)
            );
            return sum + layerMax;
        }, 0);

        // Start executing layers
        this.executeLayersInParallel().catch(error => {
            console.error('[TaskDistributor] Distribution error:', error);
            this.emit('distribution_error', { error: error.message });
        });

        return {
            success: true,
            totalTasks: this.tasks.size,
            assignedTasks: assignedCount,
            parallelLayers: this.dependencyGraph.layers.length,
            maxParallelism,
            estimatedDuration: totalEstimatedDuration,
            assignments: Array.from(this.assignments.values()),
            errors,
        };
    }

    /**
     * Execute layers in parallel
     */
    private async executeLayersInParallel(): Promise<void> {
        if (!this.dependencyGraph) {
            throw new Error('Dependency graph not initialized');
        }

        for (let layerIndex = 0; layerIndex < this.dependencyGraph.layers.length; layerIndex++) {
            const layer = this.dependencyGraph.layers[layerIndex];

            console.log(`[TaskDistributor] Executing layer ${layerIndex + 1}/${this.dependencyGraph.layers.length}: ${layer.length} tasks`);

            this.emit('layer_start', {
                layerIndex,
                totalLayers: this.dependencyGraph.layers.length,
                tasks: layer,
            });

            // Execute all tasks in this layer in parallel
            await this.executeLayerTasks(layer, layerIndex);

            this.emit('layer_complete', {
                layerIndex,
                completedTasks: layer.length,
            });

            // Emit progress
            this.emitProgress();
        }

        console.log(`[TaskDistributor] Distribution complete: ${this.completedCount} completed, ${this.failedCount} failed`);

        this.emit('distribution_complete', {
            totalTasks: this.tasks.size,
            completedTasks: this.completedCount,
            failedTasks: this.failedCount,
            duration: Date.now() - (this.startTime || 0),
        });
    }

    /**
     * Execute all tasks in a layer
     */
    private async executeLayerTasks(taskIds: string[], layerIndex: number): Promise<void> {
        const taskPromises = taskIds.map(taskId => this.executeTask(taskId, layerIndex));
        await Promise.all(taskPromises);
    }

    /**
     * Execute a single task
     */
    private async executeTask(taskId: string, layerIndex: number): Promise<void> {
        const task = this.tasks.get(taskId);
        if (!task) {
            console.error(`[TaskDistributor] Task not found: ${taskId}`);
            return;
        }

        const assignment = this.assignments.get(taskId);
        if (!assignment) {
            console.error(`[TaskDistributor] Assignment not found for task: ${taskId}`);
            return;
        }

        // Find available agent
        const agent = await this.assignAgentToTask(task);
        if (!agent) {
            console.warn(`[TaskDistributor] No available agent for task ${taskId}, marking as blocked`);
            assignment.status = 'blocked';
            this.emit('task_blocked', { taskId, reason: 'No available agent' });
            return;
        }

        // Check file conflicts
        if (this.config.enableFileConflictPrevention) {
            const conflict = this.checkFileConflicts(task, agent.id);
            if (conflict) {
                console.warn(`[TaskDistributor] File conflict for task ${taskId}: ${conflict}`);
                assignment.status = 'blocked';
                this.emit('task_blocked', { taskId, reason: `File conflict: ${conflict}` });

                // Wait and retry
                await this.sleep(5000);
                return this.executeTask(taskId, layerIndex);
            }
        }

        // Acquire file locks
        this.acquireFileLocks(task, agent.id);

        // Update assignment
        assignment.agentId = agent.id;
        assignment.status = 'in_progress';
        assignment.startedAt = new Date();

        // Update agent
        agent.status = 'busy';
        agent.currentTask = taskId;

        // Update context sync
        if (this.config.enableContextSharing) {
            this.contextSync.updateAgentStatus(agent.id, 'active', task.title);
        }

        console.log(`[TaskDistributor] Agent ${agent.id} started task ${taskId}: ${task.title}`);

        this.emit('task_start', {
            taskId,
            agentId: agent.id,
            taskTitle: task.title,
            layerIndex,
        });

        // Execute task (emit event for external execution)
        // The actual execution is handled by the caller via event listeners
        this.emit('task_execute', {
            taskId,
            agentId: agent.id,
            task,
            agent,
            context: this.config.enableContextSharing
                ? this.contextSync.getContextForTask(agent.id, task.description, task.filesToRead)
                : '',
        });
    }

    /**
     * Mark task as completed
     */
    completeTask(taskId: string, agentId: string, result?: unknown): void {
        const assignment = this.assignments.get(taskId);
        if (!assignment || assignment.agentId !== agentId) {
            console.warn(`[TaskDistributor] Invalid completion for task ${taskId} by agent ${agentId}`);
            return;
        }

        const task = this.tasks.get(taskId);
        const agent = this.agents.get(agentId);

        if (!task || !agent) return;

        // Update assignment
        assignment.status = 'completed';
        assignment.completedAt = new Date();

        // Update agent
        agent.status = 'idle';
        agent.currentTask = null;
        agent.completedTasks.push(taskId);

        // Release file locks
        this.releaseTaskLocks(taskId);

        // Update context sync
        if (this.config.enableContextSharing) {
            this.contextSync.updateAgentStatus(agentId, 'idle');

            // Share completion as discovery
            this.contextSync.shareDiscovery(agentId, {
                summary: `Completed: ${task.title}`,
                details: { taskId, result },
                relevantFiles: task.filesToModify,
                confidence: 1.0,
            });
        }

        this.completedCount++;

        console.log(`[TaskDistributor] Task ${taskId} completed by agent ${agentId}`);

        this.emit('task_complete', {
            taskId,
            agentId,
            task,
            result,
            duration: assignment.completedAt.getTime() - (assignment.startedAt?.getTime() || 0),
        });

        this.emitProgress();
    }

    /**
     * Mark task as failed
     */
    failTask(taskId: string, agentId: string, error: string): void {
        const assignment = this.assignments.get(taskId);
        if (!assignment || assignment.agentId !== agentId) {
            console.warn(`[TaskDistributor] Invalid failure for task ${taskId} by agent ${agentId}`);
            return;
        }

        const task = this.tasks.get(taskId);
        const agent = this.agents.get(agentId);

        if (!task || !agent) return;

        assignment.retryCount++;
        assignment.lastError = error;

        // Check if should retry
        if (assignment.retryCount < this.config.maxRetriesPerTask) {
            console.warn(`[TaskDistributor] Task ${taskId} failed, retry ${assignment.retryCount}/${this.config.maxRetriesPerTask}`);

            // Release locks and reassign
            this.releaseTaskLocks(taskId);
            agent.status = 'idle';
            agent.currentTask = null;
            assignment.status = 'pending';
            assignment.agentId = '';

            // Report error to other agents
            if (this.config.enableContextSharing) {
                this.contextSync.reportError(agentId, {
                    message: error,
                    severity: 'medium',
                });
            }

            this.emit('task_retry', {
                taskId,
                agentId,
                error,
                retryCount: assignment.retryCount,
            });

            // Retry after delay
            setTimeout(() => {
                this.executeTask(taskId, 0).catch(console.error);
            }, 2000 * assignment.retryCount);

        } else {
            // Max retries exceeded
            console.error(`[TaskDistributor] Task ${taskId} failed after ${assignment.retryCount} retries: ${error}`);

            assignment.status = 'failed';
            assignment.completedAt = new Date();

            agent.status = 'idle';
            agent.currentTask = null;
            agent.failedTasks.push(taskId);

            this.releaseTaskLocks(taskId);
            this.failedCount++;

            // Report critical error
            if (this.config.enableContextSharing) {
                this.contextSync.reportError(agentId, {
                    message: `Task failed after max retries: ${error}`,
                    severity: 'critical',
                });
            }

            this.emit('task_failed', {
                taskId,
                agentId,
                error,
                retryCount: assignment.retryCount,
            });
        }

        this.emitProgress();
    }

    // =========================================================================
    // FILE CONFLICT PREVENTION
    // =========================================================================

    /**
     * Check if task would conflict with files being modified by other agents
     */
    private checkFileConflicts(task: DistributableTask, agentId: string): string | null {
        for (const filePath of task.filesToModify) {
            const lockInfo = this.contextSync.isFileLocked(filePath, agentId);
            if (lockInfo.locked) {
                return `${filePath} is being modified by ${lockInfo.byAgent}`;
            }
        }
        return null;
    }

    /**
     * Acquire file locks for a task
     */
    private acquireFileLocks(task: DistributableTask, agentId: string): void {
        for (const filePath of task.filesToModify) {
            this.fileLocks.set(filePath, { agentId, taskId: task.id });
            this.contextSync.notifyFileChange(agentId, filePath, 'modify');
        }
    }

    /**
     * Release file locks for a task
     */
    private releaseTaskLocks(taskId: string): void {
        const task = this.tasks.get(taskId);
        if (!task) return;

        const assignment = this.assignments.get(taskId);
        if (!assignment) return;

        for (const filePath of task.filesToModify) {
            const lock = this.fileLocks.get(filePath);
            if (lock && lock.taskId === taskId) {
                this.fileLocks.delete(filePath);
                this.contextSync.releaseFileLock(assignment.agentId, filePath);
            }
        }
    }

    /**
     * Release all locks held by an agent
     */
    private releaseAgentLocks(agentId: string): void {
        for (const [filePath, lock] of this.fileLocks.entries()) {
            if (lock.agentId === agentId) {
                this.fileLocks.delete(filePath);
                this.contextSync.releaseFileLock(agentId, filePath);
            }
        }
    }

    // =========================================================================
    // AGENT ASSIGNMENT
    // =========================================================================

    /**
     * Assign an agent to a task based on capabilities and availability
     */
    private async assignAgentToTask(task: DistributableTask): Promise<TaskAgent | null> {
        const availableAgents = this.getAvailableAgents();

        if (availableAgents.length === 0) {
            // No agents available, wait
            await this.sleep(1000);
            return this.assignAgentToTask(task);
        }

        // Find best agent based on capabilities and workload
        let bestAgent: TaskAgent | null = null;
        let bestScore = -1;

        for (const agent of availableAgents) {
            let score = 0;

            // Capability match
            if (agent.capabilities.includes(task.type)) {
                score += 10;
            }

            // Prefer agents with fewer completed tasks (load balancing)
            score -= agent.completedTasks.length * 0.1;

            // Prefer agents with no failures
            score -= agent.failedTasks.length * 2;

            if (score > bestScore) {
                bestScore = score;
                bestAgent = agent;
            }
        }

        return bestAgent;
    }

    // =========================================================================
    // PROGRESS TRACKING
    // =========================================================================

    /**
     * Emit progress update
     */
    private emitProgress(): void {
        if (!this.dependencyGraph || !this.startTime) return;

        const inProgressTasks = Array.from(this.assignments.values())
            .filter(a => a.status === 'in_progress').length;

        const blockedTasks = Array.from(this.assignments.values())
            .filter(a => a.status === 'blocked').length;

        const activeAgents = Array.from(this.agents.values())
            .filter(a => a.status === 'busy').length;

        const idleAgents = Array.from(this.agents.values())
            .filter(a => a.status === 'idle').length;

        const elapsedTime = Date.now() - this.startTime;

        // Estimate remaining time
        const remainingTasks = this.tasks.size - this.completedCount - this.failedCount;
        const averageTaskTime = this.completedCount > 0
            ? elapsedTime / this.completedCount
            : 60000; // Default 1 minute
        const estimatedTimeRemaining = remainingTasks * averageTaskTime;

        const progress: DistributionProgress = {
            distributionId: this.distributionId,
            totalTasks: this.tasks.size,
            completedTasks: this.completedCount,
            inProgressTasks,
            failedTasks: this.failedCount,
            blockedTasks,
            currentLayer: 0, // TODO: track current layer
            totalLayers: this.dependencyGraph.layers.length,
            elapsedTime,
            estimatedTimeRemaining,
            activeAgents,
            idleAgents,
        };

        this.emit('progress', progress);

        // Broadcast via WebSocket
        this.wsSync.sendPhaseChange(
            this.projectId,
            'task-distribution',
            Math.round((this.completedCount / this.tasks.size) * 100),
            `${this.completedCount}/${this.tasks.size} tasks completed`
        );
    }

    /**
     * Get current progress
     */
    getProgress(): DistributionProgress | null {
        if (!this.dependencyGraph || !this.startTime) return null;

        const inProgressTasks = Array.from(this.assignments.values())
            .filter(a => a.status === 'in_progress').length;

        const blockedTasks = Array.from(this.assignments.values())
            .filter(a => a.status === 'blocked').length;

        const activeAgents = Array.from(this.agents.values())
            .filter(a => a.status === 'busy').length;

        const idleAgents = Array.from(this.agents.values())
            .filter(a => a.status === 'idle').length;

        return {
            distributionId: this.distributionId,
            totalTasks: this.tasks.size,
            completedTasks: this.completedCount,
            inProgressTasks,
            failedTasks: this.failedCount,
            blockedTasks,
            currentLayer: 0,
            totalLayers: this.dependencyGraph.layers.length,
            elapsedTime: Date.now() - this.startTime,
            estimatedTimeRemaining: 0,
            activeAgents,
            idleAgents,
        };
    }

    // =========================================================================
    // CONTEXT SHARING HELPERS
    // =========================================================================

    /**
     * Share a discovery with all agents
     */
    shareDiscovery(agentId: string, discovery: DiscoveryData): void {
        if (this.config.enableContextSharing) {
            this.contextSync.shareDiscovery(agentId, discovery);
        }
    }

    /**
     * Share a solution with all agents
     */
    shareSolution(agentId: string, problemType: string, solution: SolutionData): void {
        if (this.config.enableContextSharing) {
            this.contextSync.shareSolution(agentId, problemType, solution);
        }
    }

    /**
     * Report an error to all agents
     */
    reportError(agentId: string, error: ErrorData): void {
        if (this.config.enableContextSharing) {
            this.contextSync.reportError(agentId, error);
        }
    }

    // =========================================================================
    // UTILITIES
    // =========================================================================

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get distribution statistics
     */
    getStats(): {
        totalTasks: number;
        completedTasks: number;
        failedTasks: number;
        activeAgents: number;
        totalAgents: number;
        averageTaskDuration: number;
        successRate: number;
    } {
        const completedAssignments = Array.from(this.assignments.values())
            .filter(a => a.status === 'completed');

        const totalDuration = completedAssignments.reduce((sum, a) => {
            if (!a.startedAt || !a.completedAt) return sum;
            return sum + (a.completedAt.getTime() - a.startedAt.getTime());
        }, 0);

        const averageTaskDuration = completedAssignments.length > 0
            ? totalDuration / completedAssignments.length
            : 0;

        const successRate = this.tasks.size > 0
            ? (this.completedCount / this.tasks.size) * 100
            : 0;

        return {
            totalTasks: this.tasks.size,
            completedTasks: this.completedCount,
            failedTasks: this.failedCount,
            activeAgents: Array.from(this.agents.values()).filter(a => a.status === 'busy').length,
            totalAgents: this.agents.size,
            averageTaskDuration,
            successRate,
        };
    }

    /**
     * Cleanup resources
     */
    cleanup(): void {
        // Release all file locks
        for (const [filePath, lock] of this.fileLocks.entries()) {
            this.contextSync.releaseFileLock(lock.agentId, filePath);
        }
        this.fileLocks.clear();

        // Unregister all agents
        for (const agentId of this.agents.keys()) {
            this.contextSync.unregisterAgent(agentId);
        }

        this.removeAllListeners();

        console.log(`[TaskDistributor] Cleanup complete for ${this.distributionId}`);
    }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createTaskDistributor(
    buildId: string,
    projectId: string,
    userId: string,
    config?: Partial<TaskDistributorConfig>
): TaskDistributor {
    return new TaskDistributor(buildId, projectId, userId, config);
}

export default TaskDistributor;
