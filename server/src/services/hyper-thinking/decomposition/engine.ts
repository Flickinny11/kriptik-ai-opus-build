/**
 * Decomposition Engine
 *
 * Main engine for task decomposition. Coordinates strategies,
 * dependency analysis, pattern matching, and execution.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  DecompositionConfig,
  DecompositionResult,
  DecompositionTree,
  DecompositionSummary,
  DecompositionMetadata,
  DecompositionProgressEvent,
  Subtask,
  SubtaskResult,
  SubtaskExecutor,
  ExecutionContext,
  SubtaskType,
  DecompositionPattern,
  SerializedDecompositionTree,
} from './types.js';
import { DEFAULT_DECOMPOSITION_CONFIG } from './types.js';
import { getDecompositionStrategy, selectBestStrategy } from './strategies.js';
import { DependencyAnalyzer, createDependencyAnalyzer } from './dependency-analyzer.js';
import type { ComplexityLevel, TokenUsage } from '../types.js';
import { getCollectionManager } from '../../../services/embeddings/collection-manager.js';
import { getEmbeddingService } from '../../../services/embeddings/embedding-service-impl.js';

// ============================================================================
// Decomposition Engine Class
// ============================================================================

export class DecompositionEngine {
  private config: DecompositionConfig;
  private dependencyAnalyzer: DependencyAnalyzer;
  private onProgress?: (event: DecompositionProgressEvent) => void;

  constructor(config?: Partial<DecompositionConfig>) {
    this.config = { ...DEFAULT_DECOMPOSITION_CONFIG, ...config };
    this.dependencyAnalyzer = createDependencyAnalyzer();
  }

  /**
   * Set progress callback
   */
  setProgressCallback(callback: (event: DecompositionProgressEvent) => void): void {
    this.onProgress = callback;
  }

  /**
   * Decompose a task into a tree of subtasks
   */
  async decompose(task: string): Promise<DecompositionResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      this.emitProgress('decomposition_start', 'Starting task decomposition', 0);

      // Step 1: Try to match existing pattern
      let matchedPattern: DecompositionPattern | null = null;
      if (this.config.usePatternMatching) {
        matchedPattern = await this.findMatchingPattern(task);
        if (matchedPattern) {
          this.emitProgress('pattern_matched', `Found similar pattern (${Math.round(matchedPattern.successRate * 100)}% success rate)`, 0.1);
        }
      }

      // Step 2: Select or use matched strategy
      const strategy = matchedPattern?.strategy ||
        (this.config.strategy === 'hybrid' ? selectBestStrategy(task) : this.config.strategy);

      this.emitProgress('strategy_selected', `Using ${strategy} decomposition strategy`, 0.2);

      // Step 3: Decompose the task
      let subtasks: Subtask[];

      if (matchedPattern && matchedPattern.successRate >= 0.8) {
        // Use pattern's structure as template
        subtasks = this.applyPattern(matchedPattern, task);
      } else {
        // Fresh decomposition
        const strategyImpl = getDecompositionStrategy(strategy);
        subtasks = await strategyImpl.decompose(task, this.config);
      }

      // Step 4: Validate and fix dependencies
      if (this.config.validateDependencies) {
        const validation = this.dependencyAnalyzer.validateDependencies(subtasks);
        if (!validation.valid) {
          warnings.push(...validation.errors);
        }

        // Break any cycles
        const cycleResult = this.dependencyAnalyzer.breakCycles(subtasks);
        if (cycleResult.modified) {
          warnings.push(`Broke ${cycleResult.brokenEdges.length} circular dependencies`);
        }
      }

      this.emitProgress('subtask_created', `Created ${subtasks.length} subtasks`, 0.5);

      // Step 5: Analyze dependencies
      const dependencyGraph = this.dependencyAnalyzer.analyze(subtasks);

      this.emitProgress('dependencies_analyzed', `Identified ${dependencyGraph.totalStages} execution stages`, 0.7);

      // Step 6: Build the tree
      const tree = this.buildTree(
        task,
        strategy,
        subtasks,
        dependencyGraph,
        matchedPattern,
        Date.now() - startTime
      );

      // Step 7: Calculate summary
      const summary = this.calculateSummary(tree);

      // Step 8: Store pattern if successful
      if (this.config.storePatterns && !matchedPattern) {
        await this.storePattern(task, tree);
      }

      this.emitProgress('decomposition_complete', 'Decomposition complete', 1);

      return {
        success: true,
        tree,
        summary,
        warnings,
      };
    } catch (error) {
      this.emitProgress('error', `Decomposition failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 0);

      return {
        success: false,
        tree: this.createEmptyTree(task),
        summary: this.createEmptySummary(),
        warnings,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute a decomposition tree with provided executor
   */
  async executeDecomposition(
    tree: DecompositionTree,
    executor: SubtaskExecutor,
    sharedContext?: string
  ): Promise<{ success: boolean; results: Map<string, SubtaskResult>; errors: string[] }> {
    const results = new Map<string, SubtaskResult>();
    const errors: string[] = [];
    let remainingBudget = tree.totalEstimatedTokens * 1.5; // 50% buffer

    this.emitProgress('execution_start', 'Starting decomposition execution', 0);

    const totalSubtasks = tree.subtasks.size;
    let completedSubtasks = 0;

    // Execute by stages
    for (let stageIdx = 0; stageIdx < tree.dependencyGraph.stages.length; stageIdx++) {
      const stage = tree.dependencyGraph.stages[stageIdx];

      this.emitProgress(
        'stage_start',
        `Starting stage ${stageIdx + 1}/${tree.dependencyGraph.totalStages}`,
        completedSubtasks / totalSubtasks,
        undefined,
        stageIdx,
        tree.dependencyGraph.totalStages
      );

      // Execute tasks in this stage (potentially in parallel)
      const stagePromises = stage.map(async (taskId) => {
        const subtask = tree.subtasks.get(taskId);
        if (!subtask) return;

        // Check if all dependencies are satisfied
        const depsSatisfied = subtask.dependencies.every(depId => {
          const depResult = results.get(depId);
          return depResult?.success;
        });

        if (!depsSatisfied) {
          subtask.status = 'skipped';
          errors.push(`Skipped "${subtask.title}" due to failed dependencies`);
          return;
        }

        // Build execution context
        const depResults = new Map<string, SubtaskResult>();
        for (const depId of subtask.dependencies) {
          const r = results.get(depId);
          if (r) depResults.set(depId, r);
        }

        const context: ExecutionContext = {
          subtask,
          dependencyResults: depResults,
          sharedContext: sharedContext || '',
          remainingBudget,
          stage: stageIdx,
          totalStages: tree.dependencyGraph.totalStages,
        };

        this.emitProgress(
          'subtask_start',
          `Executing: ${subtask.title}`,
          completedSubtasks / totalSubtasks,
          taskId
        );

        try {
          subtask.status = 'in_progress';
          const result = await executor(context);

          subtask.status = result.success ? 'complete' : 'failed';
          subtask.result = result;
          results.set(taskId, result);

          remainingBudget -= result.tokenUsage.totalTokens;

          if (result.success) {
            this.emitProgress(
              'subtask_complete',
              `Completed: ${subtask.title}`,
              (completedSubtasks + 1) / totalSubtasks,
              taskId
            );
          } else {
            this.emitProgress(
              'subtask_failed',
              `Failed: ${subtask.title} - ${result.error}`,
              (completedSubtasks + 1) / totalSubtasks,
              taskId
            );
            errors.push(`Failed "${subtask.title}": ${result.error}`);
          }
        } catch (error) {
          subtask.status = 'failed';
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Error executing "${subtask.title}": ${errorMsg}`);

          this.emitProgress(
            'subtask_failed',
            `Error: ${subtask.title}`,
            (completedSubtasks + 1) / totalSubtasks,
            taskId
          );
        }

        completedSubtasks++;
      });

      // Wait for all tasks in this stage
      await Promise.all(stagePromises);

      this.emitProgress(
        'stage_complete',
        `Completed stage ${stageIdx + 1}`,
        completedSubtasks / totalSubtasks,
        undefined,
        stageIdx,
        tree.dependencyGraph.totalStages
      );
    }

    const success = errors.length === 0 ||
      Array.from(results.values()).filter(r => r.success).length > results.size * 0.8;

    this.emitProgress('execution_complete', `Execution complete: ${results.size} tasks`, 1);

    return { success, results, errors };
  }

  /**
   * Execute decomposition with streaming progress
   */
  async *executeDecompositionStream(
    tree: DecompositionTree,
    executor: SubtaskExecutor,
    sharedContext?: string
  ): AsyncGenerator<DecompositionProgressEvent, { success: boolean; results: Map<string, SubtaskResult> }> {
    const events: DecompositionProgressEvent[] = [];
    let executionResult: { success: boolean; results: Map<string, SubtaskResult>; errors: string[] } | null = null;

    // Capture events
    const originalCallback = this.onProgress;
    this.onProgress = (event) => {
      events.push(event);
      originalCallback?.(event);
    };

    // Start execution in background
    const executionPromise = this.executeDecomposition(tree, executor, sharedContext)
      .then(r => { executionResult = r; });

    // Yield events as they arrive
    let lastIndex = 0;
    while (executionResult === null) {
      while (lastIndex < events.length) {
        yield events[lastIndex];
        lastIndex++;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Yield remaining events
    while (lastIndex < events.length) {
      yield events[lastIndex];
      lastIndex++;
    }

    await executionPromise;
    this.onProgress = originalCallback;

    // At this point executionResult is guaranteed to be non-null
    const finalResult = executionResult as { success: boolean; results: Map<string, SubtaskResult>; errors: string[] };
    return { success: finalResult.success, results: finalResult.results };
  }

  // ============================================================================
  // Pattern Matching
  // ============================================================================

  /**
   * Find a matching decomposition pattern
   */
  private async findMatchingPattern(task: string): Promise<DecompositionPattern | null> {
    try {
      const embeddingService = getEmbeddingService();
      const collectionManager = getCollectionManager();

      // Generate embedding for task (using 'intent' type for task descriptions)
      const embeddingResult = await embeddingService.embed({
        content: task,
        type: 'intent',
      });

      // Search for similar patterns
      const searchResults = await collectionManager.search(
        'decomposition',
        {
          vector: embeddingResult.embeddings[0],
          limit: 5,
          withPayload: true,
        }
      );

      if (searchResults.length === 0) return null;

      // Find best match above threshold with high success rate
      for (const result of searchResults) {
        const payload = result.payload as unknown as DecompositionPattern;
        if (result.score >= this.config.patternSimilarityThreshold && payload.successRate >= 0.5) {
          return payload;
        }
      }

      return null;
    } catch (error) {
      // Pattern matching is optional, don't fail on errors
      console.warn('Pattern matching failed:', error);
      return null;
    }
  }

  /**
   * Apply a matched pattern to a new task
   */
  private applyPattern(pattern: DecompositionPattern, task: string): Subtask[] {
    const subtasks: Subtask[] = [];
    const idMap = new Map<string, string>();

    // Clone subtasks from pattern with new IDs
    for (const templateTask of pattern.treeStructure.subtasks) {
      const newId = uuidv4();
      idMap.set(templateTask.id, newId);

      subtasks.push({
        ...templateTask,
        id: newId,
        dependencies: [], // Will be mapped in second pass
        status: 'pending',
        result: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          ...templateTask.metadata,
          fromPattern: pattern.id,
        },
      });
    }

    // Map dependencies to new IDs
    for (let i = 0; i < subtasks.length; i++) {
      const template = pattern.treeStructure.subtasks[i];
      subtasks[i].dependencies = template.dependencies
        .map(depId => idMap.get(depId))
        .filter((id): id is string => id !== undefined);
    }

    return subtasks;
  }

  /**
   * Store a successful decomposition as a pattern
   */
  private async storePattern(task: string, tree: DecompositionTree): Promise<void> {
    try {
      const embeddingService = getEmbeddingService();
      const collectionManager = getCollectionManager();

      // Generate embedding for task (using 'intent' type for task descriptions)
      const embeddingResult = await embeddingService.embed({
        content: task,
        type: 'intent',
      });

      // Serialize tree
      const serialized: SerializedDecompositionTree = {
        rootTask: tree.originalTask,
        strategy: tree.strategy,
        subtasks: Array.from(tree.subtasks.values()).map(s => ({
          ...s,
          result: undefined,
        })),
        dependencies: tree.dependencyGraph.edges,
        metadata: tree.metadata,
      };

      // Create pattern payload for storage
      const patternPayload = {
        id: uuidv4(),
        originalTask: task,
        strategy: tree.strategy,
        treeStructure: JSON.stringify(serialized),
        successRate: 1.0,
        usageCount: 1,
        avgExecutionTimeMs: tree.estimatedDurationMs,
        tags: this.extractTags(task),
        created_at: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      };

      // Store in Qdrant (cast to any to allow decomposition-specific payload)
      await (collectionManager as any).upsertPoints('decomposition', [
        {
          id: patternPayload.id,
          vector: embeddingResult.embeddings[0],
          payload: patternPayload,
        },
      ]);
    } catch (error) {
      // Pattern storage is optional, don't fail on errors
      console.warn('Failed to store decomposition pattern:', error);
    }
  }

  /**
   * Extract tags from task description
   */
  private extractTags(task: string): string[] {
    const tagKeywords = [
      'api', 'ui', 'database', 'authentication', 'testing', 'deployment',
      'refactor', 'migration', 'integration', 'performance', 'security',
      'documentation', 'design', 'analysis', 'infrastructure',
    ];

    const lowerTask = task.toLowerCase();
    return tagKeywords.filter(keyword => lowerTask.includes(keyword));
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Build the decomposition tree
   */
  private buildTree(
    task: string,
    strategy: string,
    subtasks: Subtask[],
    dependencyGraph: ReturnType<DependencyAnalyzer['analyze']>,
    matchedPattern: DecompositionPattern | null,
    decompositionLatencyMs: number
  ): DecompositionTree {
    const subtaskMap = new Map(subtasks.map(s => [s.id, s]));

    // Find root tasks (no parent)
    const rootTasks = subtasks.filter(s => s.parentId === null);
    const rootTaskId = rootTasks.length === 1 ? rootTasks[0].id : uuidv4();

    // Calculate totals
    const totalEstimatedTokens = subtasks.reduce((sum, s) => sum + s.estimatedTokens, 0);
    const maxDepth = Math.max(...subtasks.map(s => s.depth), 0);

    // Estimate duration based on critical path
    const criticalPathTokens = dependencyGraph.criticalPath.reduce((sum, id) => {
      const task = subtaskMap.get(id);
      return sum + (task?.estimatedTokens || 0);
    }, 0);
    const estimatedDurationMs = criticalPathTokens * 10; // Rough estimate: 10ms per token

    const metadata: DecompositionMetadata = {
      model: 'decomposition-model',
      decompositionTokens: {
        promptTokens: 0,
        completionTokens: 0,
        thinkingTokens: 0,
        totalTokens: 0,
      },
      decompositionLatencyMs,
      iterations: 1,
      strategyReasoning: `Selected ${strategy} strategy based on task analysis`,
      matchedPatternId: matchedPattern?.id,
      patternSimilarity: matchedPattern ? 0.8 : undefined,
    };

    return {
      rootTaskId,
      originalTask: task,
      strategy: strategy as any,
      subtasks: subtaskMap,
      dependencyGraph,
      executionOrder: this.dependencyAnalyzer.calculateExecutionOrder(dependencyGraph.stages),
      totalEstimatedTokens,
      estimatedDurationMs,
      maxDepth,
      createdAt: new Date(),
      metadata,
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(tree: DecompositionTree): DecompositionSummary {
    const subtasks = Array.from(tree.subtasks.values());

    // Count by type
    const subtasksByType: Record<SubtaskType, number> = {
      feature: 0, refactor: 0, integration: 0, analysis: 0, design: 0,
      testing: 0, documentation: 0, configuration: 0, data: 0, ui: 0,
      api: 0, infrastructure: 0, other: 0,
    };

    for (const subtask of subtasks) {
      subtasksByType[subtask.type] = (subtasksByType[subtask.type] || 0) + 1;
    }

    // Count by complexity
    const subtasksByComplexity: Record<ComplexityLevel, number> = {
      trivial: 0, simple: 0, moderate: 0, complex: 0, extreme: 0,
    };

    for (const subtask of subtasks) {
      subtasksByComplexity[subtask.complexity] = (subtasksByComplexity[subtask.complexity] || 0) + 1;
    }

    return {
      totalSubtasks: subtasks.length,
      subtasksByType,
      subtasksByComplexity,
      executionStages: tree.dependencyGraph.totalStages,
      maxParallelism: this.dependencyAnalyzer.getMaxParallelism(tree.dependencyGraph.stages),
      criticalPathLength: tree.dependencyGraph.criticalPath.length,
      totalEstimatedTokens: tree.totalEstimatedTokens,
      estimatedDurationMs: tree.estimatedDurationMs,
      patternMatched: !!tree.metadata.matchedPatternId,
    };
  }

  /**
   * Create empty tree for error cases
   */
  private createEmptyTree(task: string): DecompositionTree {
    return {
      rootTaskId: uuidv4(),
      originalTask: task,
      strategy: 'hybrid',
      subtasks: new Map(),
      dependencyGraph: {
        edges: [],
        stages: [],
        circularDependencies: [],
        parallelGroups: [],
        criticalPath: [],
        totalStages: 0,
      },
      executionOrder: [],
      totalEstimatedTokens: 0,
      estimatedDurationMs: 0,
      maxDepth: 0,
      createdAt: new Date(),
      metadata: {
        model: '',
        decompositionTokens: { promptTokens: 0, completionTokens: 0, thinkingTokens: 0, totalTokens: 0 },
        decompositionLatencyMs: 0,
        iterations: 0,
        strategyReasoning: 'Decomposition failed',
      },
    };
  }

  /**
   * Create empty summary for error cases
   */
  private createEmptySummary(): DecompositionSummary {
    return {
      totalSubtasks: 0,
      subtasksByType: {
        feature: 0, refactor: 0, integration: 0, analysis: 0, design: 0,
        testing: 0, documentation: 0, configuration: 0, data: 0, ui: 0,
        api: 0, infrastructure: 0, other: 0,
      },
      subtasksByComplexity: { trivial: 0, simple: 0, moderate: 0, complex: 0, extreme: 0 },
      executionStages: 0,
      maxParallelism: 0,
      criticalPathLength: 0,
      totalEstimatedTokens: 0,
      estimatedDurationMs: 0,
      patternMatched: false,
    };
  }

  /**
   * Emit progress event
   */
  private emitProgress(
    type: DecompositionProgressEvent['type'],
    message: string,
    progress: number,
    subtaskId?: string,
    stage: number = 0,
    totalStages: number = 1
  ): void {
    this.onProgress?.({
      type,
      message,
      subtaskId,
      stage,
      totalStages,
      progress,
      timestamp: new Date(),
    });
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let defaultEngine: DecompositionEngine | null = null;

/**
 * Get or create default decomposition engine
 */
export function getDecompositionEngine(config?: Partial<DecompositionConfig>): DecompositionEngine {
  if (!defaultEngine) {
    defaultEngine = new DecompositionEngine(config);
  }
  return defaultEngine;
}

/**
 * Create new decomposition engine
 */
export function createDecompositionEngine(config?: Partial<DecompositionConfig>): DecompositionEngine {
  return new DecompositionEngine(config);
}

/**
 * Reset default engine
 */
export function resetDecompositionEngine(): void {
  defaultEngine = null;
}

export default DecompositionEngine;
