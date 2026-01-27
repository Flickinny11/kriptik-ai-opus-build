/**
 * Work-Stealing Queue for Dynamic Load Balancing
 *
 * Implements a work-stealing algorithm where fast agents can pick up
 * tasks from slow agents' queues, maximizing throughput.
 *
 * Architecture:
 * - Each agent has its own local deque (double-ended queue)
 * - Agents take tasks from their own queue (LIFO for cache locality)
 * - When empty, agents steal from other queues (FIFO to minimize conflicts)
 * - Lock-free operations where possible for performance
 *
 * Benefits:
 * - Automatic load balancing without central coordination
 * - Fast agents don't idle while slow agents have work
 * - Minimizes synchronization overhead
 * - Handles heterogeneous task durations gracefully
 */

import { EventEmitter } from 'events';
import { TaskDependencyManager, Task, TaskStatus } from './task-dependency-manager';

// =============================================================================
// TYPES
// =============================================================================

export interface QueuedTask {
  taskId: string;
  type: 'file' | 'component' | 'route' | 'style' | 'test' | 'config';
  priority: number; // 0 = highest, 10 = lowest
  estimatedDurationMs: number;
  dependencies: string[];
  filePath: string;
  action: 'create' | 'modify' | 'delete';
  content?: string;
  metadata?: Record<string, unknown>;
  assignedAgent?: string;
  assignedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  attempts: number;
  maxAttempts: number;
}

export interface AgentDeque {
  agentId: string;
  tasks: QueuedTask[];
  stolen: number; // Tasks stolen from this agent
  completed: number;
  failed: number;
  totalWorkTimeMs: number;
  isActive: boolean;
  lastActivityAt: Date;
}

export interface WorkStealingStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  totalSteals: number;
  averageTaskDurationMs: number;
  agentStats: Map<string, {
    completed: number;
    failed: number;
    stolen: number;
    stolenFrom: number;
    averageTaskMs: number;
  }>;
}

export interface WorkStealingConfig {
  maxAgents: number;
  stealBatchSize: number; // How many tasks to steal at once
  stealThreshold: number; // Steal when own queue has fewer than this
  taskTimeout: number; // Max time for a task before reassignment
  maxTaskAttempts: number;
  priorityBoostOnSteal: boolean; // Boost priority of stolen tasks
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

export const DEFAULT_WORK_STEALING_CONFIG: WorkStealingConfig = {
  maxAgents: 5,
  stealBatchSize: 2,
  stealThreshold: 1,
  taskTimeout: 300000, // 5 minutes
  maxTaskAttempts: 3,
  priorityBoostOnSteal: true,
};

// =============================================================================
// WORK-STEALING QUEUE IMPLEMENTATION
// =============================================================================

export class WorkStealingQueue extends EventEmitter {
  private agentDeques: Map<string, AgentDeque> = new Map();
  private globalQueue: QueuedTask[] = []; // Tasks not yet assigned
  private completedTasks: Map<string, QueuedTask> = new Map();
  private failedTasks: Map<string, QueuedTask> = new Map();
  private taskLocks: Map<string, string> = new Map(); // taskId -> agentId
  private config: WorkStealingConfig;
  private dependencyManager: TaskDependencyManager | null = null;
  private totalSteals = 0;
  private isShutdown = false;

  constructor(config: Partial<WorkStealingConfig> = {}) {
    super();
    this.config = { ...DEFAULT_WORK_STEALING_CONFIG, ...config };
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  /**
   * Initialize the queue with agents.
   */
  initializeAgents(agentIds: string[]): void {
    for (const agentId of agentIds) {
      if (!this.agentDeques.has(agentId)) {
        this.agentDeques.set(agentId, {
          agentId,
          tasks: [],
          stolen: 0,
          completed: 0,
          failed: 0,
          totalWorkTimeMs: 0,
          isActive: true,
          lastActivityAt: new Date(),
        });
      }
    }

    this.emit('agents:initialized', agentIds);
  }

  /**
   * Connect a dependency manager for dependency-aware scheduling.
   */
  setDependencyManager(manager: TaskDependencyManager): void {
    this.dependencyManager = manager;
  }

  // ===========================================================================
  // TASK SUBMISSION
  // ===========================================================================

  /**
   * Submit a task to the queue.
   * Task will be assigned to the least loaded agent or added to global queue.
   */
  submitTask(task: Omit<QueuedTask, 'attempts' | 'maxAttempts'>): void {
    if (this.isShutdown) {
      throw new Error('Queue is shutdown');
    }

    const queuedTask: QueuedTask = {
      ...task,
      attempts: 0,
      maxAttempts: this.config.maxTaskAttempts,
    };

    // Check if dependencies are met
    if (this.dependencyManager && task.dependencies.length > 0) {
      const allDependenciesMet = task.dependencies.every(depId => {
        const dep = this.dependencyManager!.getTask(depId);
        return dep && dep.status === 'completed';
      });

      if (!allDependenciesMet) {
        // Add to global queue for later assignment
        this.globalQueue.push(queuedTask);
        this.emit('task:queued', { taskId: task.taskId, reason: 'dependencies-pending' });
        return;
      }
    }

    // Find least loaded agent
    const targetAgent = this.findLeastLoadedAgent();

    if (targetAgent) {
      this.assignTaskToAgent(queuedTask, targetAgent);
    } else {
      this.globalQueue.push(queuedTask);
      this.emit('task:queued', { taskId: task.taskId, reason: 'no-available-agent' });
    }
  }

  /**
   * Submit multiple tasks in batch.
   */
  submitTasks(tasks: Array<Omit<QueuedTask, 'attempts' | 'maxAttempts'>>): void {
    // Sort by priority before submitting
    const sorted = [...tasks].sort((a, b) => a.priority - b.priority);

    for (const task of sorted) {
      this.submitTask(task);
    }
  }

  // ===========================================================================
  // TASK ACQUISITION
  // ===========================================================================

  /**
   * Get the next task for an agent.
   * First checks own queue, then tries to steal from others.
   */
  acquireTask(agentId: string): QueuedTask | null {
    if (this.isShutdown) {
      return null;
    }

    const deque = this.agentDeques.get(agentId);
    if (!deque || !deque.isActive) {
      return null;
    }

    // Update activity timestamp
    deque.lastActivityAt = new Date();

    // First, try to take from own queue (LIFO)
    let task = this.takeFromOwnQueue(agentId);

    if (task) {
      return this.startTask(task, agentId);
    }

    // Try to take from global queue
    task = this.takeFromGlobalQueue(agentId);

    if (task) {
      return this.startTask(task, agentId);
    }

    // Own queue empty, try to steal
    if (deque.tasks.length < this.config.stealThreshold) {
      task = this.stealTask(agentId);

      if (task) {
        return this.startTask(task, agentId);
      }
    }

    return null;
  }

  /**
   * Take a task from own queue (LIFO - most recent first).
   */
  private takeFromOwnQueue(agentId: string): QueuedTask | null {
    const deque = this.agentDeques.get(agentId);
    if (!deque || deque.tasks.length === 0) {
      return null;
    }

    // Find a ready task (dependencies met)
    for (let i = deque.tasks.length - 1; i >= 0; i--) {
      const task = deque.tasks[i];

      if (this.isTaskReady(task)) {
        // Remove from queue
        deque.tasks.splice(i, 1);
        return task;
      }
    }

    return null;
  }

  /**
   * Take a task from global queue.
   */
  private takeFromGlobalQueue(agentId: string): QueuedTask | null {
    // Find first ready task
    for (let i = 0; i < this.globalQueue.length; i++) {
      const task = this.globalQueue[i];

      if (this.isTaskReady(task)) {
        this.globalQueue.splice(i, 1);
        task.assignedAgent = agentId;
        task.assignedAt = new Date();
        return task;
      }
    }

    return null;
  }

  /**
   * Check if a task's dependencies are met.
   */
  private isTaskReady(task: QueuedTask): boolean {
    if (task.dependencies.length === 0) {
      return true;
    }

    // Check if all dependencies are completed
    return task.dependencies.every(depId => this.completedTasks.has(depId));
  }

  /**
   * Steal a task from another agent (FIFO - oldest first to minimize conflicts).
   */
  private stealTask(thiefId: string): QueuedTask | null {
    // Find the busiest agent (most tasks)
    let victimDeque: AgentDeque | null = null;
    let maxTasks = this.config.stealThreshold;

    for (const [agentId, deque] of this.agentDeques) {
      if (agentId !== thiefId && deque.isActive && deque.tasks.length > maxTasks) {
        maxTasks = deque.tasks.length;
        victimDeque = deque;
      }
    }

    if (!victimDeque) {
      return null;
    }

    // Steal from the front (FIFO - oldest tasks)
    // Find first ready task
    for (let i = 0; i < victimDeque.tasks.length; i++) {
      const task = victimDeque.tasks[i];

      if (this.isTaskReady(task)) {
        // Remove from victim
        victimDeque.tasks.splice(i, 1);
        victimDeque.stolen++;
        this.totalSteals++;

        // Optionally boost priority for stolen tasks
        if (this.config.priorityBoostOnSteal && task.priority > 0) {
          task.priority = Math.max(0, task.priority - 1);
        }

        task.assignedAgent = thiefId;
        task.assignedAt = new Date();

        this.emit('task:stolen', {
          taskId: task.taskId,
          from: victimDeque.agentId,
          to: thiefId,
        });

        return task;
      }
    }

    return null;
  }

  /**
   * Mark a task as started.
   */
  private startTask(task: QueuedTask, agentId: string): QueuedTask {
    task.startedAt = new Date();
    task.assignedAgent = agentId;
    task.attempts++;

    this.taskLocks.set(task.taskId, agentId);

    this.emit('task:started', {
      taskId: task.taskId,
      agentId,
      attempt: task.attempts,
    });

    return task;
  }

  // ===========================================================================
  // TASK COMPLETION
  // ===========================================================================

  /**
   * Mark a task as completed.
   */
  completeTask(taskId: string, agentId: string): void {
    const lock = this.taskLocks.get(taskId);

    if (lock !== agentId) {
      this.emit('task:error', {
        taskId,
        error: `Task not locked by agent ${agentId}`,
      });
      return;
    }

    const deque = this.agentDeques.get(agentId);
    if (deque) {
      deque.completed++;

      // Track work time if we have start time
      // We need to find the task - check global queue or recreate from context
      const completedAt = new Date();
      deque.lastActivityAt = completedAt;
    }

    this.taskLocks.delete(taskId);

    // Create a minimal completed task record
    const completedTask: QueuedTask = {
      taskId,
      type: 'file', // Default, would need to track this properly
      priority: 0,
      estimatedDurationMs: 0,
      dependencies: [],
      filePath: '',
      action: 'create',
      attempts: 1,
      maxAttempts: this.config.maxTaskAttempts,
      assignedAgent: agentId,
      completedAt: new Date(),
    };

    this.completedTasks.set(taskId, completedTask);

    this.emit('task:completed', { taskId, agentId });

    // Check if any waiting tasks can now run
    this.processWaitingTasks();
  }

  /**
   * Mark a task as failed.
   */
  failTask(taskId: string, agentId: string, error: string): void {
    const lock = this.taskLocks.get(taskId);

    if (lock !== agentId) {
      return;
    }

    this.taskLocks.delete(taskId);

    const deque = this.agentDeques.get(agentId);
    if (deque) {
      deque.failed++;
      deque.lastActivityAt = new Date();
    }

    // Check if we should retry
    // We need the original task - this is a simplification
    // In real implementation, we'd track the full task object

    this.emit('task:failed', { taskId, agentId, error });
  }

  /**
   * Requeue a task for retry.
   */
  requeueTask(task: QueuedTask): boolean {
    if (task.attempts >= task.maxAttempts) {
      this.failedTasks.set(task.taskId, task);
      this.emit('task:exhausted', {
        taskId: task.taskId,
        attempts: task.attempts,
      });
      return false;
    }

    // Reset assignment
    task.assignedAgent = undefined;
    task.assignedAt = undefined;
    task.startedAt = undefined;

    // Requeue to global queue with boosted priority
    task.priority = Math.max(0, task.priority - 1);
    this.globalQueue.push(task);

    this.emit('task:requeued', {
      taskId: task.taskId,
      attempt: task.attempts,
    });

    return true;
  }

  // ===========================================================================
  // DEPENDENCY PROCESSING
  // ===========================================================================

  /**
   * Process tasks waiting for dependencies.
   */
  private processWaitingTasks(): void {
    // Check global queue for tasks that are now ready
    const readyTasks: QueuedTask[] = [];
    const stillWaiting: QueuedTask[] = [];

    for (const task of this.globalQueue) {
      if (this.isTaskReady(task)) {
        readyTasks.push(task);
      } else {
        stillWaiting.push(task);
      }
    }

    this.globalQueue = stillWaiting;

    // Distribute ready tasks to agents
    for (const task of readyTasks) {
      const agent = this.findLeastLoadedAgent();
      if (agent) {
        this.assignTaskToAgent(task, agent);
      } else {
        this.globalQueue.push(task);
      }
    }

    // Also check agent queues - tasks might be ready now
    // Agents will pick these up on next acquire
  }

  // ===========================================================================
  // AGENT MANAGEMENT
  // ===========================================================================

  /**
   * Find the agent with the least work.
   */
  private findLeastLoadedAgent(): string | null {
    let minTasks = Infinity;
    let targetAgent: string | null = null;

    for (const [agentId, deque] of this.agentDeques) {
      if (deque.isActive && deque.tasks.length < minTasks) {
        minTasks = deque.tasks.length;
        targetAgent = agentId;
      }
    }

    return targetAgent;
  }

  /**
   * Assign a task to a specific agent.
   */
  private assignTaskToAgent(task: QueuedTask, agentId: string): void {
    const deque = this.agentDeques.get(agentId);
    if (!deque) {
      return;
    }

    task.assignedAgent = agentId;
    task.assignedAt = new Date();

    // Add to the back of the agent's queue
    deque.tasks.push(task);

    this.emit('task:assigned', { taskId: task.taskId, agentId });
  }

  /**
   * Mark an agent as inactive (won't receive new tasks).
   */
  deactivateAgent(agentId: string): void {
    const deque = this.agentDeques.get(agentId);
    if (deque) {
      deque.isActive = false;

      // Move remaining tasks to global queue
      for (const task of deque.tasks) {
        task.assignedAgent = undefined;
        task.assignedAt = undefined;
        this.globalQueue.push(task);
      }

      deque.tasks = [];
      this.emit('agent:deactivated', agentId);
    }
  }

  /**
   * Reactivate an agent.
   */
  activateAgent(agentId: string): void {
    const deque = this.agentDeques.get(agentId);
    if (deque) {
      deque.isActive = true;
      deque.lastActivityAt = new Date();
      this.emit('agent:activated', agentId);
    }
  }

  // ===========================================================================
  // TIMEOUT HANDLING
  // ===========================================================================

  /**
   * Check for timed-out tasks and requeue them.
   */
  checkTimeouts(): void {
    const now = Date.now();

    for (const [taskId, agentId] of this.taskLocks) {
      const deque = this.agentDeques.get(agentId);
      if (!deque) {
        continue;
      }

      // Find the task in the agent's queue
      const task = this.findTaskById(taskId);
      if (task && task.startedAt) {
        const elapsed = now - task.startedAt.getTime();

        if (elapsed > this.config.taskTimeout) {
          this.emit('task:timeout', { taskId, agentId, elapsed });

          // Release lock and requeue
          this.taskLocks.delete(taskId);
          this.requeueTask(task);
        }
      }
    }
  }

  /**
   * Find a task by ID across all queues.
   */
  private findTaskById(taskId: string): QueuedTask | null {
    // Check global queue
    for (const task of this.globalQueue) {
      if (task.taskId === taskId) {
        return task;
      }
    }

    // Check agent queues
    for (const deque of this.agentDeques.values()) {
      for (const task of deque.tasks) {
        if (task.taskId === taskId) {
          return task;
        }
      }
    }

    return null;
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get current queue statistics.
   */
  getStats(): WorkStealingStats {
    const agentStats = new Map<string, {
      completed: number;
      failed: number;
      stolen: number;
      stolenFrom: number;
      averageTaskMs: number;
    }>();

    let totalCompleted = 0;
    let totalFailed = 0;
    let totalPending = 0;
    let totalInProgress = 0;
    let totalWorkTimeMs = 0;

    for (const [agentId, deque] of this.agentDeques) {
      totalCompleted += deque.completed;
      totalFailed += deque.failed;
      totalPending += deque.tasks.length;
      totalWorkTimeMs += deque.totalWorkTimeMs;

      agentStats.set(agentId, {
        completed: deque.completed,
        failed: deque.failed,
        stolen: deque.stolen,
        stolenFrom: 0, // Would need to track this
        averageTaskMs: deque.completed > 0
          ? deque.totalWorkTimeMs / deque.completed
          : 0,
      });
    }

    totalPending += this.globalQueue.length;
    totalInProgress = this.taskLocks.size;

    return {
      totalTasks: totalCompleted + totalFailed + totalPending + totalInProgress,
      completedTasks: totalCompleted,
      failedTasks: totalFailed,
      pendingTasks: totalPending,
      inProgressTasks: totalInProgress,
      totalSteals: this.totalSteals,
      averageTaskDurationMs: totalCompleted > 0
        ? totalWorkTimeMs / totalCompleted
        : 0,
      agentStats,
    };
  }

  /**
   * Check if all tasks are complete.
   */
  isComplete(): boolean {
    if (this.globalQueue.length > 0) {
      return false;
    }

    if (this.taskLocks.size > 0) {
      return false;
    }

    for (const deque of this.agentDeques.values()) {
      if (deque.tasks.length > 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get count of pending tasks.
   */
  getPendingCount(): number {
    let count = this.globalQueue.length;

    for (const deque of this.agentDeques.values()) {
      count += deque.tasks.length;
    }

    return count;
  }

  // ===========================================================================
  // SHUTDOWN
  // ===========================================================================

  /**
   * Shutdown the queue.
   */
  shutdown(): void {
    this.isShutdown = true;
    this.emit('queue:shutdown');
  }

  /**
   * Clear all state.
   */
  clear(): void {
    this.globalQueue = [];
    this.completedTasks.clear();
    this.failedTasks.clear();
    this.taskLocks.clear();
    this.totalSteals = 0;

    for (const deque of this.agentDeques.values()) {
      deque.tasks = [];
      deque.completed = 0;
      deque.failed = 0;
      deque.stolen = 0;
      deque.totalWorkTimeMs = 0;
    }

    this.emit('queue:cleared');
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a work-stealing queue with default configuration.
 */
export function createWorkStealingQueue(
  config?: Partial<WorkStealingConfig>
): WorkStealingQueue {
  return new WorkStealingQueue(config);
}
