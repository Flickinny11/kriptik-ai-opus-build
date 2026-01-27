/**
 * Modal Snapshot Client
 *
 * Node.js client for invoking Modal functions with memory snapshots.
 * These functions have <500ms cold starts after initial warm-up.
 *
 * Architecture:
 * - First call to a snapshot-enabled function: ~2-4s (full cold start + snapshot creation)
 * - Subsequent calls: <500ms (restore from snapshot)
 *
 * Usage:
 *   const client = getModalSnapshotClient();
 *   await client.warmUp(); // Pre-warm on server startup
 *   const result = await client.executeTask({ action: 'build', ... });
 */

import { EventEmitter } from 'events';

// =============================================================================
// TYPES
// =============================================================================

export interface SnapshotTaskRequest {
  task_id: string;
  action: 'warm_up' | 'write_file' | 'read_file' | 'exec' | 'build' | 'list_files' | 'type_check';
  path?: string;
  content?: string;
  command?: string[];
  timeout?: number;
  working_dir?: string;
  files?: string[];
  critical?: boolean;
}

export interface SnapshotTaskResult {
  success: boolean;
  task_id: string;
  action: string;
  result?: Record<string, unknown>;
  duration_ms: number;
  error?: string;
}

export interface SnapshotConfig {
  functionName: string;
  warmUpOnDeploy: boolean;
  snapshotTTL: number; // Hours before snapshot may need refresh
  maxRetries: number;
  retryDelayMs: number;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  node_version: string;
  python_version: string;
  memory_mb: number;
  cpu: number;
}

// =============================================================================
// MODAL SNAPSHOT CLIENT
// =============================================================================

export class ModalSnapshotClient extends EventEmitter {
  private baseUrl: string;
  private tokenId: string;
  private tokenSecret: string;
  private isWarmedUp: boolean = false;
  private warmUpPromise: Promise<void> | null = null;

  // Snapshot configurations for different functions
  private snapshotConfigs: Map<string, SnapshotConfig> = new Map([
    ['build-agent', {
      functionName: 'execute_build_task',
      warmUpOnDeploy: true,
      snapshotTTL: 24,
      maxRetries: 3,
      retryDelayMs: 1000,
    }],
    ['concurrent-agent', {
      functionName: 'execute_concurrent_task',
      warmUpOnDeploy: true,
      snapshotTTL: 24,
      maxRetries: 3,
      retryDelayMs: 1000,
    }],
    ['batch-agent', {
      functionName: 'execute_batch_tasks',
      warmUpOnDeploy: false,
      snapshotTTL: 24,
      maxRetries: 2,
      retryDelayMs: 2000,
    }],
  ]);

  constructor() {
    super();

    // Get Modal credentials from environment
    this.tokenId = process.env.MODAL_TOKEN_ID || '';
    this.tokenSecret = process.env.MODAL_TOKEN_SECRET || '';

    if (!this.tokenId || !this.tokenSecret) {
      console.warn('[Modal Snapshot Client] MODAL_TOKEN_ID or MODAL_TOKEN_SECRET not set');
    }

    // Modal function URLs follow pattern: https://{workspace}--{app}--{function}.modal.run
    // For KripTik, we use: https://kriptik--kriptik-build-sandbox--{function}.modal.run
    this.baseUrl = process.env.MODAL_FUNCTION_URL || 'https://kriptik--kriptik-build-sandbox';
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Warm up all snapshot-enabled functions.
   * Call this on server startup to ensure first user request is fast.
   *
   * This triggers the snapshot creation for each function:
   * - First call creates the snapshot (~4s)
   * - All subsequent calls restore from snapshot (<500ms)
   */
  async warmUp(): Promise<void> {
    // Prevent duplicate warm-up calls
    if (this.warmUpPromise) {
      return this.warmUpPromise;
    }

    if (this.isWarmedUp) {
      return;
    }

    this.warmUpPromise = this.doWarmUp();
    await this.warmUpPromise;
    this.warmUpPromise = null;
  }

  private async doWarmUp(): Promise<void> {
    console.log('[Modal Snapshot Client] Warming up snapshot functions...');
    const startTime = Date.now();

    for (const [name, config] of this.snapshotConfigs) {
      if (config.warmUpOnDeploy) {
        try {
          const result = await this.executeTask({
            task_id: `warmup-${name}-${Date.now()}`,
            action: 'warm_up',
          });

          if (result.success) {
            console.log(`[Modal Snapshot Client] Warmed up: ${name} (${result.duration_ms}ms)`);
          } else {
            console.warn(`[Modal Snapshot Client] Warm-up failed for ${name}: ${result.error}`);
          }
        } catch (error) {
          console.error(`[Modal Snapshot Client] Failed to warm up ${name}:`, error);
        }
      }
    }

    this.isWarmedUp = true;
    const totalTime = Date.now() - startTime;
    console.log(`[Modal Snapshot Client] All functions warmed up in ${totalTime}ms`);
    this.emit('warmedUp', { duration: totalTime });
  }

  /**
   * Execute a task using snapshot-enabled Modal function.
   *
   * @param task - The task to execute
   * @param functionType - Which function to use ('build-agent' | 'concurrent-agent' | 'batch-agent')
   */
  async executeTask(
    task: SnapshotTaskRequest,
    functionType: string = 'build-agent'
  ): Promise<SnapshotTaskResult> {
    const config = this.snapshotConfigs.get(functionType);
    if (!config) {
      throw new Error(`Unknown function type: ${functionType}`);
    }

    const endpoint = `${this.baseUrl}--${config.functionName}.modal.run`;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        const startTime = Date.now();

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.tokenId}:${this.tokenSecret}`,
          },
          body: JSON.stringify(task),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Modal function error (${response.status}): ${errorText}`);
        }

        const result = await response.json() as SnapshotTaskResult;
        const totalTime = Date.now() - startTime;

        this.emit('taskCompleted', {
          taskId: task.task_id,
          action: task.action,
          duration: totalTime,
          success: result.success,
        });

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < config.maxRetries) {
          console.warn(
            `[Modal Snapshot Client] Attempt ${attempt} failed for task ${task.task_id}, retrying...`
          );
          await this.delay(config.retryDelayMs * attempt);
        }
      }
    }

    this.emit('taskFailed', {
      taskId: task.task_id,
      action: task.action,
      error: lastError?.message,
    });

    return {
      success: false,
      task_id: task.task_id,
      action: task.action,
      duration_ms: 0,
      error: lastError?.message || 'Max retries exceeded',
    };
  }

  /**
   * Execute multiple tasks in batch (sequential execution in single container).
   */
  async executeBatch(
    tasks: SnapshotTaskRequest[]
  ): Promise<SnapshotTaskResult[]> {
    const config = this.snapshotConfigs.get('batch-agent');
    if (!config) {
      throw new Error('Batch agent not configured');
    }

    const endpoint = `${this.baseUrl}--${config.functionName}.modal.run`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.tokenId}:${this.tokenSecret}`,
      },
      body: JSON.stringify(tasks),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Modal batch function error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<SnapshotTaskResult[]>;
  }

  /**
   * Execute a concurrent task (uses input concurrency for parallel processing).
   * Use this for the single-sandbox multi-agent architecture.
   */
  async executeConcurrent(task: SnapshotTaskRequest): Promise<SnapshotTaskResult> {
    return this.executeTask(task, 'concurrent-agent');
  }

  /**
   * Health check for Modal functions.
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const endpoint = `${this.baseUrl}--health_check.modal.run`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.tokenId}:${this.tokenSecret}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      return response.json() as Promise<HealthCheckResult>;

    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        node_version: 'unknown',
        python_version: 'unknown',
        memory_mb: 0,
        cpu: 0,
      };
    }
  }

  /**
   * Check if client is configured with valid credentials.
   */
  isConfigured(): boolean {
    return Boolean(this.tokenId && this.tokenSecret);
  }

  /**
   * Check if functions have been warmed up.
   */
  isReady(): boolean {
    return this.isWarmedUp;
  }

  // ===========================================================================
  // CONVENIENCE METHODS
  // ===========================================================================

  /**
   * Write a file to the sandbox.
   */
  async writeFile(
    path: string,
    content: string,
    workingDir: string = '/workspace'
  ): Promise<SnapshotTaskResult> {
    return this.executeTask({
      task_id: `write-${Date.now()}`,
      action: 'write_file',
      path: `${workingDir}/${path}`.replace(/\/+/g, '/'),
      content,
    });
  }

  /**
   * Read a file from the sandbox.
   */
  async readFile(
    path: string,
    workingDir: string = '/workspace'
  ): Promise<{ content: string } | null> {
    const result = await this.executeTask({
      task_id: `read-${Date.now()}`,
      action: 'read_file',
      path: `${workingDir}/${path}`.replace(/\/+/g, '/'),
    });

    if (result.success && result.result) {
      return { content: result.result.content as string };
    }

    return null;
  }

  /**
   * Execute a command in the sandbox.
   */
  async exec(
    command: string[],
    options: { timeout?: number; workingDir?: string } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const result = await this.executeTask({
      task_id: `exec-${Date.now()}`,
      action: 'exec',
      command,
      timeout: options.timeout || 300,
      working_dir: options.workingDir || '/workspace',
    });

    if (result.success && result.result) {
      return {
        stdout: result.result.stdout as string,
        stderr: result.result.stderr as string,
        exitCode: result.result.exit_code as number,
      };
    }

    throw new Error(result.error || 'Command execution failed');
  }

  /**
   * Run TypeScript type check.
   */
  async typeCheck(
    files: string[] = [],
    workingDir: string = '/workspace'
  ): Promise<{ success: boolean; errors: string[] }> {
    const result = await this.executeTask({
      task_id: `typecheck-${Date.now()}`,
      action: 'type_check',
      files,
      working_dir: workingDir,
    });

    if (result.success && result.result) {
      const errors: string[] = [];
      const stderr = result.result.stderr as string;

      if (stderr) {
        // Parse TypeScript errors
        const lines = stderr.split('\n');
        for (const line of lines) {
          if (line.includes('error TS')) {
            errors.push(line);
          }
        }
      }

      return {
        success: result.result.exit_code === 0,
        errors,
      };
    }

    return { success: false, errors: [result.error || 'Type check failed'] };
  }

  /**
   * Run build command.
   */
  async build(
    command: string[] = ['pnpm', 'build'],
    workingDir: string = '/workspace'
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    const result = await this.executeTask({
      task_id: `build-${Date.now()}`,
      action: 'build',
      command,
      working_dir: workingDir,
    });

    if (result.result) {
      return {
        success: result.result.exit_code === 0,
        stdout: result.result.stdout as string,
        stderr: result.result.stderr as string,
      };
    }

    return {
      success: false,
      stdout: '',
      stderr: result.error || 'Build failed',
    };
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let modalSnapshotClientInstance: ModalSnapshotClient | null = null;

export function getModalSnapshotClient(): ModalSnapshotClient {
  if (!modalSnapshotClientInstance) {
    modalSnapshotClientInstance = new ModalSnapshotClient();
  }
  return modalSnapshotClientInstance;
}

export function createModalSnapshotClient(): ModalSnapshotClient {
  return new ModalSnapshotClient();
}
