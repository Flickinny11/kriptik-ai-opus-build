/**
 * Dependency Analyzer
 *
 * Analyzes dependencies between subtasks, detects cycles,
 * calculates execution order, and identifies parallelization opportunities.
 */

import type {
  Subtask,
  DependencyGraph,
  DependencyEdge,
} from './types.js';

// ============================================================================
// Dependency Analyzer Class
// ============================================================================

export class DependencyAnalyzer {
  /**
   * Analyze dependencies and build execution graph
   */
  analyze(subtasks: Subtask[]): DependencyGraph {
    // Build adjacency list representation
    const adjacencyList = this.buildAdjacencyList(subtasks);

    // Detect circular dependencies
    const circularDependencies = this.detectCycles(subtasks, adjacencyList);

    // Build dependency edges
    const edges = this.buildEdges(subtasks);

    // Calculate execution stages (topological sort with stages)
    const stages = this.calculateStages(subtasks, adjacencyList, circularDependencies);

    // Identify parallel groups within each stage
    const parallelGroups = this.identifyParallelGroups(subtasks, stages);

    // Find critical path
    const criticalPath = this.findCriticalPath(subtasks, adjacencyList);

    return {
      edges,
      stages,
      circularDependencies,
      parallelGroups,
      criticalPath,
      totalStages: stages.length,
    };
  }

  /**
   * Build adjacency list from subtasks
   */
  private buildAdjacencyList(subtasks: Subtask[]): Map<string, string[]> {
    const adjacencyList = new Map<string, string[]>();

    // Initialize all nodes
    for (const subtask of subtasks) {
      adjacencyList.set(subtask.id, []);
    }

    // Add edges (dependency → dependent)
    for (const subtask of subtasks) {
      for (const depId of subtask.dependencies) {
        const dependents = adjacencyList.get(depId);
        if (dependents) {
          dependents.push(subtask.id);
        }
      }
    }

    return adjacencyList;
  }

  /**
   * Build dependency edges
   */
  private buildEdges(subtasks: Subtask[]): DependencyEdge[] {
    const edges: DependencyEdge[] = [];

    for (const subtask of subtasks) {
      for (const depId of subtask.dependencies) {
        edges.push({
          from: subtask.id,
          to: depId,
          type: 'hard', // All dependencies are hard by default
        });
      }
    }

    return edges;
  }

  /**
   * Detect circular dependencies using DFS
   */
  private detectCycles(
    subtasks: Subtask[],
    adjacencyList: Map<string, string[]>
  ): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const node = subtasks.find(s => s.id === nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          if (!visited.has(depId)) {
            if (dfs(depId)) {
              return true;
            }
          } else if (recursionStack.has(depId)) {
            // Found a cycle
            const cycleStart = path.indexOf(depId);
            const cycle = path.slice(cycleStart);
            cycle.push(depId); // Complete the cycle
            cycles.push(cycle);
            return true;
          }
        }
      }

      path.pop();
      recursionStack.delete(nodeId);
      return false;
    };

    for (const subtask of subtasks) {
      if (!visited.has(subtask.id)) {
        dfs(subtask.id);
      }
    }

    return cycles;
  }

  /**
   * Calculate execution stages using Kahn's algorithm (topological sort)
   */
  private calculateStages(
    subtasks: Subtask[],
    adjacencyList: Map<string, string[]>,
    circularDependencies: string[][]
  ): string[][] {
    // If there are cycles, we can't do proper topological sort
    // Return tasks grouped by their depth in the dependency tree
    if (circularDependencies.length > 0) {
      return this.calculateStagesWithCycles(subtasks);
    }

    const stages: string[][] = [];
    const inDegree = new Map<string, number>();
    const taskMap = new Map(subtasks.map(s => [s.id, s]));

    // Calculate in-degree for each node
    for (const subtask of subtasks) {
      if (!inDegree.has(subtask.id)) {
        inDegree.set(subtask.id, 0);
      }
      for (const depId of subtask.dependencies) {
        const current = inDegree.get(subtask.id) || 0;
        inDegree.set(subtask.id, current + 1);
      }
    }

    // Find all nodes with no dependencies (in-degree 0)
    let currentStage = subtasks
      .filter(s => inDegree.get(s.id) === 0)
      .map(s => s.id);

    while (currentStage.length > 0) {
      // Sort current stage by priority
      currentStage.sort((a, b) => {
        const taskA = taskMap.get(a);
        const taskB = taskMap.get(b);
        return (taskB?.priority || 0) - (taskA?.priority || 0);
      });

      stages.push([...currentStage]);

      const nextStage: string[] = [];

      for (const nodeId of currentStage) {
        const dependents = adjacencyList.get(nodeId) || [];

        for (const dependentId of dependents) {
          const degree = (inDegree.get(dependentId) || 0) - 1;
          inDegree.set(dependentId, degree);

          if (degree === 0) {
            nextStage.push(dependentId);
          }
        }
      }

      currentStage = nextStage;
    }

    // Update subtask stages
    for (let stageIdx = 0; stageIdx < stages.length; stageIdx++) {
      for (const taskId of stages[stageIdx]) {
        const task = taskMap.get(taskId);
        if (task) {
          task.stage = stageIdx;
        }
      }
    }

    return stages;
  }

  /**
   * Calculate stages when cycles exist (fallback)
   */
  private calculateStagesWithCycles(subtasks: Subtask[]): string[][] {
    const stages: string[][] = [];
    const processed = new Set<string>();
    const taskMap = new Map(subtasks.map(s => [s.id, s]));

    // Group by depth in tree
    const depths = new Map<string, number>();

    const calculateDepth = (taskId: string, visited: Set<string>): number => {
      if (visited.has(taskId)) return 0; // Break cycle
      if (depths.has(taskId)) return depths.get(taskId)!;

      visited.add(taskId);
      const task = taskMap.get(taskId);
      if (!task) return 0;

      if (task.dependencies.length === 0) {
        depths.set(taskId, 0);
        return 0;
      }

      let maxDepth = 0;
      for (const depId of task.dependencies) {
        const depDepth = calculateDepth(depId, visited);
        maxDepth = Math.max(maxDepth, depDepth + 1);
      }

      depths.set(taskId, maxDepth);
      return maxDepth;
    };

    for (const subtask of subtasks) {
      calculateDepth(subtask.id, new Set());
    }

    // Group by depth
    const maxDepth = Math.max(...depths.values());
    for (let d = 0; d <= maxDepth; d++) {
      const stage = subtasks
        .filter(s => depths.get(s.id) === d)
        .map(s => s.id);
      if (stage.length > 0) {
        stages.push(stage);
      }
    }

    return stages;
  }

  /**
   * Identify parallel groups within stages
   */
  private identifyParallelGroups(
    subtasks: Subtask[],
    stages: string[][]
  ): string[][] {
    const parallelGroups: string[][] = [];
    const taskMap = new Map(subtasks.map(s => [s.id, s]));

    for (const stage of stages) {
      // Group parallelizable tasks
      const parallelizable = stage.filter(id => {
        const task = taskMap.get(id);
        return task?.parallelizable !== false;
      });

      if (parallelizable.length > 1) {
        parallelGroups.push(parallelizable);
      }
    }

    return parallelGroups;
  }

  /**
   * Find the critical path (longest dependency chain)
   */
  private findCriticalPath(
    subtasks: Subtask[],
    adjacencyList: Map<string, string[]>
  ): string[] {
    const taskMap = new Map(subtasks.map(s => [s.id, s]));
    const memo = new Map<string, { path: string[]; cost: number }>();

    const findLongestPath = (taskId: string, visited: Set<string>): { path: string[]; cost: number } => {
      if (visited.has(taskId)) {
        return { path: [], cost: 0 };
      }

      if (memo.has(taskId)) {
        return memo.get(taskId)!;
      }

      visited.add(taskId);
      const task = taskMap.get(taskId);
      if (!task) {
        return { path: [], cost: 0 };
      }

      const dependents = adjacencyList.get(taskId) || [];

      if (dependents.length === 0) {
        const result = { path: [taskId], cost: task.estimatedTokens };
        memo.set(taskId, result);
        visited.delete(taskId);
        return result;
      }

      let longestPath: string[] = [];
      let maxCost = 0;

      for (const depId of dependents) {
        const result = findLongestPath(depId, visited);
        if (result.cost > maxCost) {
          maxCost = result.cost;
          longestPath = result.path;
        }
      }

      const result = {
        path: [taskId, ...longestPath],
        cost: task.estimatedTokens + maxCost,
      };

      memo.set(taskId, result);
      visited.delete(taskId);
      return result;
    };

    // Find roots (no dependencies)
    const roots = subtasks.filter(s => s.dependencies.length === 0);

    let globalLongestPath: string[] = [];
    let globalMaxCost = 0;

    for (const root of roots) {
      const result = findLongestPath(root.id, new Set());
      if (result.cost > globalMaxCost) {
        globalMaxCost = result.cost;
        globalLongestPath = result.path;
      }
    }

    return globalLongestPath;
  }

  /**
   * Calculate execution order from stages
   */
  calculateExecutionOrder(stages: string[][]): string[] {
    return stages.flat();
  }

  /**
   * Get maximum parallelism (max tasks in any single stage)
   */
  getMaxParallelism(stages: string[][]): number {
    if (stages.length === 0) return 0;
    return Math.max(...stages.map(s => s.length));
  }

  /**
   * Validate dependencies are satisfiable
   */
  validateDependencies(subtasks: Subtask[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const taskIds = new Set(subtasks.map(s => s.id));

    // Check for missing dependencies
    for (const subtask of subtasks) {
      for (const depId of subtask.dependencies) {
        if (!taskIds.has(depId)) {
          errors.push(`Subtask "${subtask.title}" references non-existent dependency: ${depId}`);
        }
      }
    }

    // Check for self-dependencies
    for (const subtask of subtasks) {
      if (subtask.dependencies.includes(subtask.id)) {
        errors.push(`Subtask "${subtask.title}" depends on itself`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Remove circular dependencies by breaking the weakest link
   */
  breakCycles(subtasks: Subtask[]): { modified: boolean; brokenEdges: Array<{ from: string; to: string }> } {
    const adjacencyList = this.buildAdjacencyList(subtasks);
    const cycles = this.detectCycles(subtasks, adjacencyList);
    const taskMap = new Map(subtasks.map(s => [s.id, s]));
    const brokenEdges: Array<{ from: string; to: string }> = [];

    for (const cycle of cycles) {
      // Find the edge with lowest priority difference
      let minPriorityDiff = Infinity;
      let edgeToBreak: { from: string; to: string } | null = null;

      for (let i = 0; i < cycle.length - 1; i++) {
        const from = cycle[i];
        const to = cycle[i + 1];

        const fromTask = taskMap.get(from);
        const toTask = taskMap.get(to);

        if (fromTask && toTask) {
          const priorityDiff = Math.abs(fromTask.priority - toTask.priority);
          if (priorityDiff < minPriorityDiff) {
            minPriorityDiff = priorityDiff;
            edgeToBreak = { from, to };
          }
        }
      }

      if (edgeToBreak) {
        // Remove the dependency
        const task = taskMap.get(edgeToBreak.from);
        if (task) {
          task.dependencies = task.dependencies.filter(d => d !== edgeToBreak!.to);
          brokenEdges.push(edgeToBreak);
        }
      }
    }

    return {
      modified: brokenEdges.length > 0,
      brokenEdges,
    };
  }
}

/**
 * Create dependency analyzer
 */
export function createDependencyAnalyzer(): DependencyAnalyzer {
  return new DependencyAnalyzer();
}

export default DependencyAnalyzer;
