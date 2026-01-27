/**
 * Task Dependency Manager
 *
 * Manages task dependencies and execution order for build tasks.
 * Ensures tasks are executed in correct order based on their dependencies.
 *
 * Features:
 * - Dependency graph construction and validation
 * - Cycle detection
 * - Topological sorting for execution order
 * - Ready task identification
 * - Parallel execution grouping
 */

import { EventEmitter } from 'events';

// =============================================================================
// TYPES
// =============================================================================

export type TaskStatus = 'pending' | 'ready' | 'in-progress' | 'completed' | 'failed' | 'blocked';

export type TaskType =
  | 'scaffold'      // Initial project structure
  | 'config'        // Configuration files
  | 'types'         // TypeScript types/interfaces
  | 'component'     // React components
  | 'hook'          // Custom React hooks
  | 'store'         // State management (Zustand)
  | 'service'       // API services
  | 'route'         // API routes
  | 'style'         // CSS/Tailwind styles
  | 'test'          // Test files
  | 'integration';  // Integration/wiring

export interface Task {
  id: string;
  type: TaskType;
  name: string;
  description: string;
  filePath: string;
  action: 'create' | 'modify' | 'delete';
  dependencies: string[]; // Task IDs this task depends on
  dependents: string[];   // Task IDs that depend on this task
  status: TaskStatus;
  priority: number;
  estimatedDurationMs: number;
  actualDurationMs?: number;
  assignedAgent?: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  output?: {
    filesCreated?: string[];
    filesModified?: string[];
    exports?: string[];
    imports?: string[];
  };
  metadata?: Record<string, unknown>;
}

export interface DependencyGraph {
  tasks: Map<string, Task>;
  adjacencyList: Map<string, Set<string>>; // task -> tasks it depends on
  reverseAdjacencyList: Map<string, Set<string>>; // task -> tasks that depend on it
}

export interface ExecutionPlan {
  phases: ExecutionPhase[];
  totalTasks: number;
  estimatedDurationMs: number;
  criticalPath: string[]; // Longest dependency chain
}

export interface ExecutionPhase {
  phaseNumber: number;
  tasks: Task[];
  canParallelize: boolean;
  estimatedDurationMs: number;
}

// =============================================================================
// TASK TEMPLATES
// =============================================================================

/**
 * Default priorities by task type (lower = higher priority).
 */
export const TASK_TYPE_PRIORITY: Record<TaskType, number> = {
  scaffold: 0,
  config: 1,
  types: 2,
  store: 3,
  service: 4,
  hook: 5,
  component: 6,
  route: 7,
  style: 8,
  test: 9,
  integration: 10,
};

/**
 * Default estimated durations by task type (ms).
 */
export const TASK_TYPE_DURATION: Record<TaskType, number> = {
  scaffold: 5000,
  config: 3000,
  types: 4000,
  store: 8000,
  service: 10000,
  hook: 6000,
  component: 12000,
  route: 8000,
  style: 5000,
  test: 10000,
  integration: 15000,
};

// =============================================================================
// TASK DEPENDENCY MANAGER
// =============================================================================

export class TaskDependencyManager extends EventEmitter {
  private graph: DependencyGraph;
  private executionOrder: string[] = [];
  private hasCycle = false;

  constructor() {
    super();
    this.graph = {
      tasks: new Map(),
      adjacencyList: new Map(),
      reverseAdjacencyList: new Map(),
    };
  }

  // ===========================================================================
  // TASK MANAGEMENT
  // ===========================================================================

  /**
   * Add a task to the dependency graph.
   */
  addTask(task: Omit<Task, 'dependents' | 'status'>): void {
    if (this.graph.tasks.has(task.id)) {
      throw new Error(`Task with ID ${task.id} already exists`);
    }

    const fullTask: Task = {
      ...task,
      dependents: [],
      status: task.dependencies.length === 0 ? 'ready' : 'pending',
    };

    this.graph.tasks.set(task.id, fullTask);
    this.graph.adjacencyList.set(task.id, new Set(task.dependencies));
    this.graph.reverseAdjacencyList.set(task.id, new Set());

    // Update reverse adjacency (who depends on this task)
    for (const depId of task.dependencies) {
      const reverseAdj = this.graph.reverseAdjacencyList.get(depId);
      if (reverseAdj) {
        reverseAdj.add(task.id);
      }

      // Also update the dependent's dependents list
      const depTask = this.graph.tasks.get(depId);
      if (depTask) {
        depTask.dependents.push(task.id);
      }
    }

    this.emit('task:added', task);
  }

  /**
   * Add multiple tasks at once.
   */
  addTasks(tasks: Array<Omit<Task, 'dependents' | 'status'>>): void {
    for (const task of tasks) {
      this.addTask(task);
    }

    // Validate after all tasks are added
    this.validate();
  }

  /**
   * Get a task by ID.
   */
  getTask(taskId: string): Task | undefined {
    return this.graph.tasks.get(taskId);
  }

  /**
   * Get all tasks.
   */
  getAllTasks(): Task[] {
    return Array.from(this.graph.tasks.values());
  }

  /**
   * Update task status.
   */
  updateTaskStatus(taskId: string, status: TaskStatus, error?: string): void {
    const task = this.graph.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const previousStatus = task.status;
    task.status = status;

    if (status === 'completed') {
      task.completedAt = new Date();

      // Update dependents that may now be ready
      this.updateDependentStatus(taskId);
    }

    if (status === 'failed' && error) {
      task.error = error;

      // Mark dependents as blocked
      this.markDependentsBlocked(taskId);
    }

    if (status === 'in-progress') {
      task.startedAt = new Date();
    }

    this.emit('task:status-changed', { taskId, previousStatus, newStatus: status });
  }

  /**
   * Update dependent tasks when a task completes.
   */
  private updateDependentStatus(completedTaskId: string): void {
    const reverseAdj = this.graph.reverseAdjacencyList.get(completedTaskId);
    if (!reverseAdj) {
      return;
    }

    for (const dependentId of reverseAdj) {
      const dependent = this.graph.tasks.get(dependentId);
      if (!dependent || dependent.status !== 'pending') {
        continue;
      }

      // Check if all dependencies are now complete
      const allDepsComplete = dependent.dependencies.every(depId => {
        const dep = this.graph.tasks.get(depId);
        return dep && dep.status === 'completed';
      });

      if (allDepsComplete) {
        dependent.status = 'ready';
        this.emit('task:ready', dependentId);
      }
    }
  }

  /**
   * Mark all dependents as blocked when a task fails.
   */
  private markDependentsBlocked(failedTaskId: string): void {
    const visited = new Set<string>();
    const queue = [failedTaskId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const reverseAdj = this.graph.reverseAdjacencyList.get(currentId);

      if (!reverseAdj) {
        continue;
      }

      for (const dependentId of reverseAdj) {
        if (visited.has(dependentId)) {
          continue;
        }

        visited.add(dependentId);

        const dependent = this.graph.tasks.get(dependentId);
        if (dependent && dependent.status !== 'completed') {
          dependent.status = 'blocked';
          dependent.error = `Blocked by failed dependency: ${failedTaskId}`;
          queue.push(dependentId);
        }
      }
    }
  }

  // ===========================================================================
  // DEPENDENCY QUERIES
  // ===========================================================================

  /**
   * Get all tasks that are ready to execute.
   */
  getReadyTasks(): Task[] {
    return Array.from(this.graph.tasks.values()).filter(
      task => task.status === 'ready'
    );
  }

  /**
   * Get all pending tasks.
   */
  getPendingTasks(): Task[] {
    return Array.from(this.graph.tasks.values()).filter(
      task => task.status === 'pending'
    );
  }

  /**
   * Get all completed tasks.
   */
  getCompletedTasks(): Task[] {
    return Array.from(this.graph.tasks.values()).filter(
      task => task.status === 'completed'
    );
  }

  /**
   * Get all failed or blocked tasks.
   */
  getFailedTasks(): Task[] {
    return Array.from(this.graph.tasks.values()).filter(
      task => task.status === 'failed' || task.status === 'blocked'
    );
  }

  /**
   * Check if all tasks are complete.
   */
  isComplete(): boolean {
    for (const task of this.graph.tasks.values()) {
      if (task.status !== 'completed' && task.status !== 'failed' && task.status !== 'blocked') {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if build has failed (any task failed).
   */
  hasFailed(): boolean {
    for (const task of this.graph.tasks.values()) {
      if (task.status === 'failed') {
        return true;
      }
    }
    return false;
  }

  // ===========================================================================
  // VALIDATION
  // ===========================================================================

  /**
   * Validate the dependency graph.
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for missing dependencies
    for (const [taskId, deps] of this.graph.adjacencyList) {
      for (const depId of deps) {
        if (!this.graph.tasks.has(depId)) {
          errors.push(`Task ${taskId} depends on non-existent task ${depId}`);
        }
      }
    }

    // Check for cycles
    const cycleResult = this.detectCycle();
    if (cycleResult.hasCycle) {
      this.hasCycle = true;
      errors.push(`Dependency cycle detected: ${cycleResult.cycle.join(' -> ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Detect cycles in the dependency graph using DFS.
   */
  private detectCycle(): { hasCycle: boolean; cycle: string[] } {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycle: string[] = [];

    const dfs = (taskId: string, path: string[]): boolean => {
      visited.add(taskId);
      recursionStack.add(taskId);

      const deps = this.graph.adjacencyList.get(taskId);
      if (deps) {
        for (const depId of deps) {
          if (!visited.has(depId)) {
            if (dfs(depId, [...path, depId])) {
              return true;
            }
          } else if (recursionStack.has(depId)) {
            // Found cycle
            cycle.push(...path, depId);
            return true;
          }
        }
      }

      recursionStack.delete(taskId);
      return false;
    };

    for (const taskId of this.graph.tasks.keys()) {
      if (!visited.has(taskId)) {
        if (dfs(taskId, [taskId])) {
          return { hasCycle: true, cycle };
        }
      }
    }

    return { hasCycle: false, cycle: [] };
  }

  // ===========================================================================
  // EXECUTION PLANNING
  // ===========================================================================

  /**
   * Generate topologically sorted execution order.
   */
  getExecutionOrder(): string[] {
    if (this.executionOrder.length > 0) {
      return [...this.executionOrder];
    }

    if (this.hasCycle) {
      throw new Error('Cannot generate execution order: dependency cycle detected');
    }

    const result: string[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();

    const visit = (taskId: string): void => {
      if (temp.has(taskId)) {
        throw new Error(`Cycle detected at ${taskId}`);
      }

      if (visited.has(taskId)) {
        return;
      }

      temp.add(taskId);

      const deps = this.graph.adjacencyList.get(taskId);
      if (deps) {
        for (const depId of deps) {
          visit(depId);
        }
      }

      temp.delete(taskId);
      visited.add(taskId);
      result.push(taskId);
    };

    for (const taskId of this.graph.tasks.keys()) {
      if (!visited.has(taskId)) {
        visit(taskId);
      }
    }

    this.executionOrder = result;
    return [...result];
  }

  /**
   * Generate an execution plan with parallelization opportunities.
   */
  generateExecutionPlan(): ExecutionPlan {
    const phases: ExecutionPhase[] = [];
    const completed = new Set<string>();
    let phaseNumber = 0;

    while (completed.size < this.graph.tasks.size) {
      // Find all tasks that can run in this phase
      const phaseTasks: Task[] = [];

      for (const [taskId, task] of this.graph.tasks) {
        if (completed.has(taskId)) {
          continue;
        }

        // Check if all dependencies are complete
        const deps = this.graph.adjacencyList.get(taskId);
        const allDepsComplete = !deps || Array.from(deps).every(d => completed.has(d));

        if (allDepsComplete) {
          phaseTasks.push(task);
        }
      }

      if (phaseTasks.length === 0) {
        // Should not happen if no cycles
        break;
      }

      // Sort by priority
      phaseTasks.sort((a, b) => a.priority - b.priority);

      // Calculate phase duration (max of parallel tasks)
      const maxDuration = Math.max(...phaseTasks.map(t => t.estimatedDurationMs));

      phases.push({
        phaseNumber,
        tasks: phaseTasks,
        canParallelize: phaseTasks.length > 1,
        estimatedDurationMs: maxDuration,
      });

      // Mark as completed for next phase calculation
      for (const task of phaseTasks) {
        completed.add(task.id);
      }

      phaseNumber++;
    }

    // Calculate critical path
    const criticalPath = this.findCriticalPath();

    return {
      phases,
      totalTasks: this.graph.tasks.size,
      estimatedDurationMs: phases.reduce((sum, p) => sum + p.estimatedDurationMs, 0),
      criticalPath,
    };
  }

  /**
   * Find the critical path (longest dependency chain).
   */
  private findCriticalPath(): string[] {
    const memo = new Map<string, { duration: number; path: string[] }>();

    const findLongestPath = (taskId: string): { duration: number; path: string[] } => {
      if (memo.has(taskId)) {
        return memo.get(taskId)!;
      }

      const task = this.graph.tasks.get(taskId);
      if (!task) {
        return { duration: 0, path: [] };
      }

      const deps = this.graph.adjacencyList.get(taskId);
      if (!deps || deps.size === 0) {
        const result = { duration: task.estimatedDurationMs, path: [taskId] };
        memo.set(taskId, result);
        return result;
      }

      let maxDep = { duration: 0, path: [] as string[] };
      for (const depId of deps) {
        const depResult = findLongestPath(depId);
        if (depResult.duration > maxDep.duration) {
          maxDep = depResult;
        }
      }

      const result = {
        duration: maxDep.duration + task.estimatedDurationMs,
        path: [...maxDep.path, taskId],
      };
      memo.set(taskId, result);
      return result;
    };

    let longestPath: string[] = [];
    let maxDuration = 0;

    for (const taskId of this.graph.tasks.keys()) {
      const result = findLongestPath(taskId);
      if (result.duration > maxDuration) {
        maxDuration = result.duration;
        longestPath = result.path;
      }
    }

    return longestPath;
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get dependency graph statistics.
   */
  getStats(): {
    totalTasks: number;
    byStatus: Record<TaskStatus, number>;
    byType: Record<TaskType, number>;
    averageDependencies: number;
    maxDependencyDepth: number;
    parallelizationFactor: number;
  } {
    const byStatus: Record<TaskStatus, number> = {
      pending: 0,
      ready: 0,
      'in-progress': 0,
      completed: 0,
      failed: 0,
      blocked: 0,
    };

    const byType: Partial<Record<TaskType, number>> = {};
    let totalDeps = 0;

    for (const task of this.graph.tasks.values()) {
      byStatus[task.status]++;
      byType[task.type] = (byType[task.type] || 0) + 1;
      totalDeps += task.dependencies.length;
    }

    const plan = this.generateExecutionPlan();
    const maxParallelTasks = Math.max(...plan.phases.map(p => p.tasks.length));

    return {
      totalTasks: this.graph.tasks.size,
      byStatus,
      byType: byType as Record<TaskType, number>,
      averageDependencies: this.graph.tasks.size > 0
        ? totalDeps / this.graph.tasks.size
        : 0,
      maxDependencyDepth: plan.phases.length,
      parallelizationFactor: this.graph.tasks.size > 0
        ? maxParallelTasks
        : 0,
    };
  }

  // ===========================================================================
  // SERIALIZATION
  // ===========================================================================

  /**
   * Export the dependency graph to JSON.
   */
  toJSON(): {
    tasks: Task[];
    executionOrder: string[];
  } {
    return {
      tasks: Array.from(this.graph.tasks.values()),
      executionOrder: this.getExecutionOrder(),
    };
  }

  /**
   * Import tasks from JSON.
   */
  fromJSON(data: { tasks: Array<Omit<Task, 'dependents' | 'status'>> }): void {
    this.clear();
    this.addTasks(data.tasks);
  }

  /**
   * Clear all tasks.
   */
  clear(): void {
    this.graph.tasks.clear();
    this.graph.adjacencyList.clear();
    this.graph.reverseAdjacencyList.clear();
    this.executionOrder = [];
    this.hasCycle = false;
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a task dependency manager.
 */
export function createTaskDependencyManager(): TaskDependencyManager {
  return new TaskDependencyManager();
}

/**
 * Create a task with defaults.
 */
export function createTask(
  partial: Partial<Task> & { id: string; name: string; filePath: string }
): Omit<Task, 'dependents' | 'status'> {
  const type = partial.type || 'component';

  return {
    type,
    description: partial.description || `${type} task: ${partial.name}`,
    action: partial.action || 'create',
    dependencies: partial.dependencies || [],
    priority: partial.priority ?? TASK_TYPE_PRIORITY[type],
    estimatedDurationMs: partial.estimatedDurationMs ?? TASK_TYPE_DURATION[type],
    metadata: partial.metadata,
    ...partial,
  };
}
