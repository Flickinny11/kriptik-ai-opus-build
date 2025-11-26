/**
 * Parallel Executor
 * 
 * Manages parallel task execution for improved performance.
 * Implements work stealing, priority queues, and resource limits.
 */

// ============================================================================
// TYPES
// ============================================================================

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Task<T> {
    id: string;
    name: string;
    priority: TaskPriority;
    fn: () => Promise<T>;
    timeout?: number;  // ms
    retries?: number;
    dependencies?: string[];  // Task IDs this depends on
}

export interface TaskResult<T> {
    id: string;
    success: boolean;
    result?: T;
    error?: Error;
    duration: number;
    retryCount: number;
}

interface ExecutionOptions {
    maxConcurrent?: number;
    defaultTimeout?: number;
    onProgress?: (completed: number, total: number) => void;
}

// ============================================================================
// PARALLEL EXECUTOR
// ============================================================================

export class ParallelExecutor {
    private maxConcurrent: number;
    private running = 0;
    private queue: Array<{
        task: Task<unknown>;
        resolve: (result: TaskResult<unknown>) => void;
    }> = [];
    private results: Map<string, TaskResult<unknown>> = new Map();
    private completedCount = 0;
    private totalCount = 0;
    private onProgress?: (completed: number, total: number) => void;

    constructor(options: ExecutionOptions = {}) {
        this.maxConcurrent = options.maxConcurrent ?? 5;
        this.onProgress = options.onProgress;
    }

    /**
     * Execute a single task
     */
    async execute<T>(task: Task<T>): Promise<TaskResult<T>> {
        return new Promise((resolve) => {
            this.queue.push({
                task: task as Task<unknown>,
                resolve: resolve as (result: TaskResult<unknown>) => void,
            });
            this.totalCount++;
            this.sortQueue();
            this.processQueue();
        }) as Promise<TaskResult<T>>;
    }

    /**
     * Execute multiple tasks in parallel
     */
    async executeAll<T>(tasks: Task<T>[]): Promise<TaskResult<T>[]> {
        if (tasks.length === 0) return [];

        const promises = tasks.map(task => this.execute(task));
        return Promise.all(promises);
    }

    /**
     * Execute tasks with dependencies
     */
    async executeWithDependencies<T>(tasks: Task<T>[]): Promise<Map<string, TaskResult<T>>> {
        const taskMap = new Map(tasks.map(t => [t.id, t]));
        const results = new Map<string, TaskResult<T>>();
        const pending = new Set(tasks.map(t => t.id));
        const executing = new Set<string>();

        const canExecute = (task: Task<T>): boolean => {
            if (!task.dependencies || task.dependencies.length === 0) return true;
            return task.dependencies.every(dep => results.has(dep));
        };

        while (pending.size > 0 || executing.size > 0) {
            // Find tasks that can be executed
            const ready: Task<T>[] = [];
            for (const id of pending) {
                const task = taskMap.get(id)!;
                if (canExecute(task) && executing.size < this.maxConcurrent) {
                    ready.push(task);
                    pending.delete(id);
                    executing.add(id);
                }
            }

            if (ready.length === 0 && executing.size === 0) {
                // Deadlock or circular dependency
                for (const id of pending) {
                    results.set(id, {
                        id,
                        success: false,
                        error: new Error('Circular dependency or missing dependency'),
                        duration: 0,
                        retryCount: 0,
                    });
                }
                break;
            }

            // Execute ready tasks
            const promises = ready.map(async (task) => {
                const result = await this.executeTask(task);
                results.set(task.id, result);
                executing.delete(task.id);
                return result;
            });

            if (promises.length > 0) {
                await Promise.race(promises);
            } else {
                // Wait for any executing task to complete
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        return results;
    }

    /**
     * Execute a batch of independent tasks
     */
    async executeBatch<T>(
        tasks: Array<() => Promise<T>>,
        batchSize?: number
    ): Promise<T[]> {
        const size = batchSize ?? this.maxConcurrent;
        const results: T[] = [];

        for (let i = 0; i < tasks.length; i += size) {
            const batch = tasks.slice(i, i + size);
            const batchResults = await Promise.all(batch.map(fn => fn()));
            results.push(...batchResults);

            if (this.onProgress) {
                this.onProgress(Math.min(i + size, tasks.length), tasks.length);
            }
        }

        return results;
    }

    /**
     * Map over items in parallel
     */
    async parallelMap<T, R>(
        items: T[],
        fn: (item: T, index: number) => Promise<R>,
        concurrency?: number
    ): Promise<R[]> {
        const limit = concurrency ?? this.maxConcurrent;
        const results: R[] = new Array(items.length);
        let currentIndex = 0;

        const workers = Array(Math.min(limit, items.length))
            .fill(null)
            .map(async () => {
                while (currentIndex < items.length) {
                    const index = currentIndex++;
                    results[index] = await fn(items[index], index);
                }
            });

        await Promise.all(workers);
        return results;
    }

    /**
     * Filter items in parallel
     */
    async parallelFilter<T>(
        items: T[],
        predicate: (item: T, index: number) => Promise<boolean>,
        concurrency?: number
    ): Promise<T[]> {
        const results = await this.parallelMap(
            items,
            async (item, index) => ({
                item,
                keep: await predicate(item, index),
            }),
            concurrency
        );
        return results.filter(r => r.keep).map(r => r.item);
    }

    /**
     * Process queue
     */
    private processQueue(): void {
        while (this.running < this.maxConcurrent && this.queue.length > 0) {
            const { task, resolve } = this.queue.shift()!;
            this.running++;
            
            this.executeTask(task)
                .then(result => {
                    resolve(result);
                    this.running--;
                    this.completedCount++;
                    
                    if (this.onProgress) {
                        this.onProgress(this.completedCount, this.totalCount);
                    }
                    
                    this.processQueue();
                });
        }
    }

    /**
     * Execute a single task with timeout and retries
     */
    private async executeTask<T>(task: Task<T>): Promise<TaskResult<T>> {
        const startTime = Date.now();
        let retryCount = 0;
        const maxRetries = task.retries ?? 0;
        const timeout = task.timeout ?? 30000;

        while (retryCount <= maxRetries) {
            try {
                const result = await Promise.race([
                    task.fn(),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('Task timeout')), timeout)
                    ),
                ]);

                return {
                    id: task.id,
                    success: true,
                    result,
                    duration: Date.now() - startTime,
                    retryCount,
                };
            } catch (error) {
                retryCount++;
                if (retryCount > maxRetries) {
                    return {
                        id: task.id,
                        success: false,
                        error: error as Error,
                        duration: Date.now() - startTime,
                        retryCount: retryCount - 1,
                    };
                }
                // Wait before retry with exponential backoff
                await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 100));
            }
        }

        // Should never reach here
        return {
            id: task.id,
            success: false,
            error: new Error('Max retries exceeded'),
            duration: Date.now() - startTime,
            retryCount,
        };
    }

    /**
     * Sort queue by priority
     */
    private sortQueue(): void {
        const priorityOrder: Record<TaskPriority, number> = {
            critical: 0,
            high: 1,
            medium: 2,
            low: 3,
        };

        this.queue.sort((a, b) => 
            priorityOrder[a.task.priority] - priorityOrder[b.task.priority]
        );
    }

    /**
     * Get current stats
     */
    getStats() {
        return {
            running: this.running,
            queued: this.queue.length,
            completed: this.completedCount,
            total: this.totalCount,
        };
    }

    /**
     * Reset stats
     */
    resetStats(): void {
        this.completedCount = 0;
        this.totalCount = 0;
        this.results.clear();
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: ParallelExecutor | null = null;

export function getParallelExecutor(options?: ExecutionOptions): ParallelExecutor {
    if (!instance) {
        instance = new ParallelExecutor(options);
    }
    return instance;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Run promises with concurrency limit
 */
export async function limitConcurrency<T>(
    promises: Array<() => Promise<T>>,
    limit: number
): Promise<T[]> {
    const executor = new ParallelExecutor({ maxConcurrent: limit });
    return executor.executeBatch(promises);
}

/**
 * Run with timeout
 */
export async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage = 'Operation timed out'
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
        ),
    ]);
}

/**
 * Retry with exponential backoff
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 100
): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            if (i < maxRetries) {
                await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, i)));
            }
        }
    }

    throw lastError;
}

