/**
 * Task Executor
 *
 * Executes build tasks by coordinating:
 * - Code generation (AI)
 * - File operations (Modal sandbox)
 * - Type checking (incremental)
 * - Discovery announcements (context)
 *
 * This is the orchestration layer that ties everything together.
 */

import { EventEmitter } from 'events';
import {
  CodeGeneratorBridge,
  CodeGenerationRequest,
  CodeGenerationResult,
} from './code-generator-bridge';
import {
  IncrementalTypeChecker,
  TypeCheckResult,
  FileChange,
} from './incremental-type-checker';
import {
  LocalContextManager,
  DiscoveryEntry,
} from './local-context-manager';
import {
  InterfaceContractManager,
  FileContract,
} from './interface-contracts';
import {
  WorkStealingQueue,
  QueuedTask,
} from './work-stealing-queue';

// =============================================================================
// TYPES
// =============================================================================

export interface ExecutionTask {
  taskId: string;
  type: 'component' | 'hook' | 'service' | 'store' | 'route' | 'type' | 'style' | 'test' | 'config';
  filePath: string;
  action: 'create' | 'modify' | 'delete';
  description: string;
  requirements: string[];
  dependencies: string[];
  exports: string[];
  imports: Array<{ name: string; from: string }>;
  priority: number;
  contractId?: string;
  designContext?: {
    mockupUrl?: string;
    blueprint?: Record<string, unknown>;
    visualIntent?: Record<string, unknown>;
  };
}

export interface ExecutionResult {
  taskId: string;
  success: boolean;
  filePath: string;
  generatedCode?: string;
  exports?: string[];
  typeCheckPassed?: boolean;
  typeErrors?: string[];
  discoveryId?: string;
  executionTimeMs: number;
  error?: string;
  metadata?: {
    model: string;
    tokensUsed: number;
    confidence: number;
  };
}

export interface ExecutorConfig {
  maxRetries: number;
  typeCheckEnabled: boolean;
  discoveryEnabled: boolean;
  contractValidation: boolean;
  writeFiles: boolean; // Can be disabled for dry-run
  parallelTasks: number;
}

export interface FileWriter {
  writeFile(filePath: string, content: string): Promise<void>;
  readFile(filePath: string): Promise<string | null>;
  deleteFile(filePath: string): Promise<void>;
  fileExists(filePath: string): Promise<boolean>;
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

export const DEFAULT_EXECUTOR_CONFIG: ExecutorConfig = {
  maxRetries: 3,
  typeCheckEnabled: true,
  discoveryEnabled: true,
  contractValidation: true,
  writeFiles: true,
  parallelTasks: 5,
};

// =============================================================================
// TASK EXECUTOR
// =============================================================================

export class TaskExecutor extends EventEmitter {
  private config: ExecutorConfig;
  private codeGenerator: CodeGeneratorBridge;
  private typeChecker: IncrementalTypeChecker;
  private contextManager: LocalContextManager;
  private contractManager: InterfaceContractManager;
  private fileWriter: FileWriter | null = null;
  private executionCount = 0;
  private successCount = 0;
  private failureCount = 0;

  constructor(
    config: Partial<ExecutorConfig> = {},
    dependencies?: {
      codeGenerator?: CodeGeneratorBridge;
      typeChecker?: IncrementalTypeChecker;
      contextManager?: LocalContextManager;
      contractManager?: InterfaceContractManager;
    }
  ) {
    super();
    this.config = { ...DEFAULT_EXECUTOR_CONFIG, ...config };

    // Initialize or use provided dependencies
    this.codeGenerator = dependencies?.codeGenerator || new CodeGeneratorBridge();
    this.typeChecker = dependencies?.typeChecker || new IncrementalTypeChecker();
    this.contextManager = dependencies?.contextManager || new LocalContextManager();
    this.contractManager = dependencies?.contractManager || new InterfaceContractManager();

    this.setupEventForwarding();
  }

  /**
   * Set up event forwarding from sub-components.
   */
  private setupEventForwarding(): void {
    this.codeGenerator.on('generation:started', (data) => {
      this.emit('task:generation-started', data);
    });

    this.codeGenerator.on('generation:completed', (data) => {
      this.emit('task:generation-completed', data);
    });

    this.typeChecker.on('check:completed', (data) => {
      this.emit('task:type-check-completed', data);
    });
  }

  /**
   * Set the file writer implementation.
   */
  setFileWriter(writer: FileWriter): void {
    this.fileWriter = writer;
  }

  // ===========================================================================
  // TASK EXECUTION
  // ===========================================================================

  /**
   * Execute a single task.
   */
  async executeTask(task: ExecutionTask, agentId: string): Promise<ExecutionResult> {
    const startTime = Date.now();

    this.emit('task:started', { taskId: task.taskId, agentId, filePath: task.filePath });

    try {
      // Step 1: Claim file ownership
      if (this.config.writeFiles) {
        const claimed = this.contextManager.claimFile(task.filePath, agentId);
        if (!claimed) {
          throw new Error(`File ${task.filePath} is already owned by another agent`);
        }
      }

      // Step 2: Update contract status if applicable
      if (task.contractId && this.config.contractValidation) {
        this.contractManager.startImplementation(task.contractId);
      }

      // Step 3: Get related files for context
      const relatedFiles = await this.getRelatedFiles(task);

      // Step 4: Get existing code if modifying
      let existingCode: string | undefined;
      if (task.action === 'modify' && this.fileWriter) {
        existingCode = await this.fileWriter.readFile(task.filePath) || undefined;
      }

      // Step 5: Generate code
      const generationRequest: CodeGenerationRequest = {
        taskId: task.taskId,
        agentId,
        taskType: task.type,
        filePath: task.filePath,
        action: task.action,
        description: task.description,
        requirements: task.requirements,
        dependencies: task.dependencies,
        exports: task.exports,
        imports: task.imports,
        existingCode,
        relatedFiles,
        designContext: task.designContext,
      };

      const generationResult = await this.generateWithRetry(generationRequest);

      if (!generationResult.success) {
        throw new Error(generationResult.error || 'Code generation failed');
      }

      // Step 6: Write file
      if (this.config.writeFiles && this.fileWriter) {
        await this.fileWriter.writeFile(task.filePath, generationResult.code);

        // Update file status
        this.contextManager.updateFileStatus(
          task.filePath,
          agentId,
          'completed',
          generationResult.code
        );
      }

      // Step 7: Type check
      let typeCheckResult: TypeCheckResult | null = null;
      if (this.config.typeCheckEnabled) {
        const fileChange: FileChange = {
          filePath: task.filePath,
          type: task.action,
          agentId,
          taskId: task.taskId,
          timestamp: new Date(),
          content: generationResult.code,
        };

        this.typeChecker.notifyFileChange(fileChange);

        // Wait for type check (with timeout)
        typeCheckResult = await this.waitForTypeCheck(task.filePath);
      }

      // Step 8: Validate contract
      if (task.contractId && this.config.contractValidation) {
        this.contractManager.completeContract(
          task.contractId,
          typeCheckResult?.success ?? true,
          typeCheckResult?.errors.map(e => e.message)
        );
      }

      // Step 9: Announce discovery
      let discoveryId: string | undefined;
      if (this.config.discoveryEnabled && generationResult.exports.length > 0) {
        discoveryId = this.announceDiscovery(task, agentId, generationResult);
      }

      // Build result
      const result: ExecutionResult = {
        taskId: task.taskId,
        success: true,
        filePath: task.filePath,
        generatedCode: generationResult.code,
        exports: generationResult.exports,
        typeCheckPassed: typeCheckResult?.success ?? true,
        typeErrors: typeCheckResult?.errors.map(e => e.message),
        discoveryId,
        executionTimeMs: Date.now() - startTime,
        metadata: generationResult.metadata,
      };

      this.executionCount++;
      this.successCount++;

      this.emit('task:completed', result);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Release file on error
      if (this.config.writeFiles) {
        this.contextManager.releaseFile(task.filePath, agentId);
      }

      const result: ExecutionResult = {
        taskId: task.taskId,
        success: false,
        filePath: task.filePath,
        executionTimeMs: Date.now() - startTime,
        error: errorMessage,
      };

      this.executionCount++;
      this.failureCount++;

      this.emit('task:failed', result);
      return result;
    }
  }

  /**
   * Generate code with retry logic.
   */
  private async generateWithRetry(
    request: CodeGenerationRequest
  ): Promise<CodeGenerationResult> {
    let lastResult: CodeGenerationResult | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      this.emit('generation:attempt', { taskId: request.taskId, attempt });

      const result = await this.codeGenerator.generateCode(request);

      if (result.success && result.metadata.confidence >= 0.7) {
        return result;
      }

      lastResult = result;

      // Add feedback for retry
      if (attempt < this.config.maxRetries) {
        request.requirements = [
          ...request.requirements,
          `Previous attempt had issues: ${result.error || 'low confidence'}`,
          'Please ensure all required exports are present',
          'Ensure proper TypeScript types',
        ];
      }
    }

    return lastResult || {
      success: false,
      taskId: request.taskId,
      agentId: request.agentId,
      filePath: request.filePath,
      code: '',
      exports: [],
      imports: [],
      metadata: {
        model: '',
        tokensUsed: 0,
        generationTimeMs: 0,
        confidence: 0,
      },
      error: 'Max retries exceeded',
    };
  }

  /**
   * Get related files for context.
   */
  private async getRelatedFiles(
    task: ExecutionTask
  ): Promise<Array<{ path: string; content: string }>> {
    const relatedFiles: Array<{ path: string; content: string }> = [];

    if (!this.fileWriter) {
      return relatedFiles;
    }

    // Get files from imports
    for (const imp of task.imports) {
      // Only get local files
      if (imp.from.startsWith('.') || imp.from.startsWith('/')) {
        const content = await this.fileWriter.readFile(imp.from);
        if (content) {
          relatedFiles.push({ path: imp.from, content });
        }
      }
    }

    // Limit to prevent context overflow
    return relatedFiles.slice(0, 5);
  }

  /**
   * Wait for type check result.
   */
  private async waitForTypeCheck(
    filePath: string,
    timeoutMs = 30000
  ): Promise<TypeCheckResult | null> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(null);
      }, timeoutMs);

      const handler = (result: TypeCheckResult) => {
        clearTimeout(timeout);
        this.typeChecker.off('check:completed', handler);
        resolve(result);
      };

      this.typeChecker.on('check:completed', handler);
    });
  }

  /**
   * Announce discovery to context manager.
   */
  private announceDiscovery(
    task: ExecutionTask,
    agentId: string,
    result: CodeGenerationResult
  ): string {
    const discoveryId = `discovery-${task.taskId}`;

    const discovery: Omit<DiscoveryEntry, 'timestamp' | 'verified'> = {
      id: discoveryId,
      type: task.type as DiscoveryEntry['type'],
      name: task.filePath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'unknown',
      filePath: task.filePath,
      exports: result.exports,
      imports: result.imports.map(i => i.name),
      agentId,
    };

    this.contextManager.announceDiscovery(discovery);

    return discoveryId;
  }

  // ===========================================================================
  // BATCH EXECUTION
  // ===========================================================================

  /**
   * Execute multiple tasks.
   */
  async executeTasks(
    tasks: ExecutionTask[],
    agentId: string
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (const task of tasks) {
      const result = await this.executeTask(task, agentId);
      results.push(result);

      // Stop on failure for dependent tasks
      if (!result.success) {
        // Check if any remaining tasks depend on this one
        const dependentTasks = tasks.filter(t =>
          t.dependencies.includes(task.taskId)
        );

        for (const depTask of dependentTasks) {
          results.push({
            taskId: depTask.taskId,
            success: false,
            filePath: depTask.filePath,
            executionTimeMs: 0,
            error: `Blocked by failed dependency: ${task.taskId}`,
          });
        }
      }
    }

    return results;
  }

  /**
   * Execute tasks in parallel respecting dependencies.
   */
  async executeParallel(
    tasks: ExecutionTask[],
    agentId: string
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const completed = new Set<string>();
    const failed = new Set<string>();

    // Group tasks by dependency level
    const levels = this.groupByDependencyLevel(tasks);

    for (const levelTasks of levels) {
      // Filter out tasks blocked by failures
      const executableTasks = levelTasks.filter(task => {
        return !task.dependencies.some(dep => failed.has(dep));
      });

      // Execute level in parallel
      const levelResults = await Promise.all(
        executableTasks.map(task => this.executeTask(task, agentId))
      );

      for (const result of levelResults) {
        results.push(result);

        if (result.success) {
          completed.add(result.taskId);
        } else {
          failed.add(result.taskId);
        }
      }
    }

    return results;
  }

  /**
   * Group tasks by dependency level for parallel execution.
   */
  private groupByDependencyLevel(tasks: ExecutionTask[]): ExecutionTask[][] {
    const levels: ExecutionTask[][] = [];
    const completed = new Set<string>();
    const remaining = [...tasks];

    while (remaining.length > 0) {
      const level: ExecutionTask[] = [];

      for (let i = remaining.length - 1; i >= 0; i--) {
        const task = remaining[i];
        const allDepsComplete = task.dependencies.every(d => completed.has(d));

        if (allDepsComplete) {
          level.push(task);
          remaining.splice(i, 1);
        }
      }

      if (level.length === 0) {
        // Circular dependency or missing dependencies
        // Add remaining tasks to final level
        levels.push(remaining);
        break;
      }

      levels.push(level);

      for (const task of level) {
        completed.add(task.taskId);
      }
    }

    return levels;
  }

  // ===========================================================================
  // QUEUE INTEGRATION
  // ===========================================================================

  /**
   * Process tasks from a work-stealing queue.
   */
  async processQueue(
    queue: WorkStealingQueue,
    agentId: string,
    stopSignal: { stop: boolean }
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    while (!stopSignal.stop) {
      const queuedTask = queue.acquireTask(agentId);

      if (!queuedTask) {
        // No more tasks available
        break;
      }

      // Convert queued task to execution task
      const executionTask = this.queuedTaskToExecutionTask(queuedTask);
      const result = await this.executeTask(executionTask, agentId);
      results.push(result);

      // Report to queue
      if (result.success) {
        queue.completeTask(queuedTask.taskId, agentId);
      } else {
        queue.failTask(queuedTask.taskId, agentId, result.error || 'Unknown error');
      }
    }

    return results;
  }

  /**
   * Convert a queued task to an execution task.
   */
  private queuedTaskToExecutionTask(queued: QueuedTask): ExecutionTask {
    return {
      taskId: queued.taskId,
      type: queued.type as ExecutionTask['type'],
      filePath: queued.filePath,
      action: queued.action,
      description: (queued.metadata?.description as string) || `Create ${queued.filePath}`,
      requirements: (queued.metadata?.requirements as string[]) || [],
      dependencies: queued.dependencies,
      exports: (queued.metadata?.exports as string[]) || [],
      imports: (queued.metadata?.imports as Array<{ name: string; from: string }>) || [],
      priority: queued.priority,
    };
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get executor statistics.
   */
  getStats(): {
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    codeGeneratorStats: ReturnType<CodeGeneratorBridge['getStats']>;
    typeCheckerStats: ReturnType<IncrementalTypeChecker['getStats']>;
    contextStats: ReturnType<LocalContextManager['getStats']>;
  } {
    return {
      totalExecutions: this.executionCount,
      successCount: this.successCount,
      failureCount: this.failureCount,
      successRate: this.executionCount > 0
        ? this.successCount / this.executionCount
        : 0,
      codeGeneratorStats: this.codeGenerator.getStats(),
      typeCheckerStats: this.typeChecker.getStats(),
      contextStats: this.contextManager.getStats(),
    };
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  /**
   * Reset executor state.
   */
  reset(): void {
    this.executionCount = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.typeChecker.reset();
    this.contextManager.clear();
    this.contractManager.clear();
  }

  /**
   * Check if executor is ready.
   */
  isReady(): boolean {
    return this.codeGenerator.isReady();
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a task executor.
 */
export function createTaskExecutor(
  config?: Partial<ExecutorConfig>,
  dependencies?: {
    codeGenerator?: CodeGeneratorBridge;
    typeChecker?: IncrementalTypeChecker;
    contextManager?: LocalContextManager;
    contractManager?: InterfaceContractManager;
  }
): TaskExecutor {
  return new TaskExecutor(config, dependencies);
}
