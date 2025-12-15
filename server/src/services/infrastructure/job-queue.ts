// Job Queue Infrastructure Service
// BullMQ-based job queue for background task processing

import { Queue, Worker, Job, QueueEvents, JobsOptions } from 'bullmq';
import { Redis } from 'ioredis';

// Redis connection for BullMQ
let ioRedisConnection: Redis | null = null;

// Queue instances
const queues: Map<string, Queue> = new Map();
const workers: Map<string, Worker> = new Map();
const queueEvents: Map<string, QueueEvents> = new Map();

// Job handler type
type JobHandler<T = unknown, R = unknown> = (job: Job<T>) => Promise<R>;

// Queue names
export const QueueNames = {
    PROJECT_IMPORT: 'project-import',
    FILE_PROCESSING: 'file-processing',
    NOTIFICATION: 'notification',
    ANALYTICS: 'analytics',
    CLEANUP: 'cleanup',
    AI_TASK: 'ai-task',
    CREDENTIAL_SYNC: 'credential-sync',
} as const;

type QueueName = typeof QueueNames[keyof typeof QueueNames];

// Default job options
const DEFAULT_JOB_OPTIONS: JobsOptions = {
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 1000,
    },
    removeOnComplete: {
        age: 3600, // 1 hour
        count: 100,
    },
    removeOnFail: {
        age: 86400, // 24 hours
    },
};

/**
 * Get or create IORedis connection for BullMQ
 */
function getConnection(): Redis {
    if (!ioRedisConnection) {
        const redisUrl = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL;

        if (redisUrl) {
            ioRedisConnection = new Redis(redisUrl, {
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
            });

            ioRedisConnection.on('connect', () => {
                console.log('[JobQueue] Connected to Redis');
            });

            ioRedisConnection.on('error', (err: Error) => {
                console.error('[JobQueue] Redis connection error:', err);
            });
        } else {
            console.warn('[JobQueue] No Redis URL provided, using mock queue');
            // Return a mock connection that will cause BullMQ to work in-memory
            ioRedisConnection = createMockIORedis();
        }
    }

    return ioRedisConnection;
}

/**
 * Create mock IORedis for development
 */
function createMockIORedis(): Redis {
    const store = new Map<string, string>();

    const mock = {
        status: 'ready',
        get: async (key: string) => store.get(key) || null,
        set: async (key: string, value: string) => {
            store.set(key, value);
            return 'OK';
        },
        del: async (...keys: string[]) => {
            let deleted = 0;
            keys.forEach(k => { if (store.delete(k)) deleted++; });
            return deleted;
        },
        on: () => mock,
        once: () => mock,
        emit: () => true,
        removeListener: () => mock,
        addListener: () => mock,
        connect: async () => {},
        disconnect: async () => {},
        quit: async () => 'OK',
        duplicate: () => createMockIORedis(),
    };

    return mock as unknown as Redis;
}

/**
 * Get or create a queue
 */
export function getQueue(name: QueueName): Queue {
    if (!queues.has(name)) {
        const connection = getConnection();
        const queue = new Queue(name, {
            connection,
            defaultJobOptions: DEFAULT_JOB_OPTIONS,
        });

        queues.set(name, queue);
        console.log(`[JobQueue] Created queue: ${name}`);
    }

    return queues.get(name)!;
}

/**
 * Register a worker for a queue
 */
export function registerWorker<T = unknown, R = unknown>(
    name: QueueName,
    handler: JobHandler<T, R>,
    options?: {
        concurrency?: number;
        limiter?: { max: number; duration: number };
    }
): Worker<T, R> {
    // Close existing worker if any
    const existingWorker = workers.get(name);
    if (existingWorker) {
        existingWorker.close();
    }

    const connection = getConnection();
    const worker = new Worker<T, R>(name, handler, {
        connection,
        concurrency: options?.concurrency || 5,
        limiter: options?.limiter,
    });

    worker.on('completed', (job) => {
        console.log(`[JobQueue] Job completed: ${name}/${job.id}`);
    });

    worker.on('failed', (job, error) => {
        console.error(`[JobQueue] Job failed: ${name}/${job?.id}`, error);
    });

    worker.on('error', (error) => {
        console.error(`[JobQueue] Worker error: ${name}`, error);
    });

    workers.set(name, worker as Worker<unknown>);
    console.log(`[JobQueue] Registered worker: ${name}`);

    return worker;
}

/**
 * Add a job to a queue
 */
export async function addJob<T = unknown>(
    queueName: QueueName,
    data: T,
    options?: JobsOptions & { jobId?: string }
): Promise<Job> {
    const queue = getQueue(queueName);
    const jobName = options?.jobId || `${queueName}-${Date.now()}`;

    const job = await queue.add(jobName, data, {
        ...DEFAULT_JOB_OPTIONS,
        ...options,
    });

    console.log(`[JobQueue] Job added: ${queueName}/${job.id}`);
    return job;
}

/**
 * Add multiple jobs to a queue
 */
export async function addBulkJobs<T = unknown>(
    queueName: QueueName,
    jobs: { data: T; options?: JobsOptions }[]
): Promise<Job[]> {
    const queue = getQueue(queueName);

    const bulkJobs = jobs.map((job, index) => ({
        name: `${queueName}-bulk-${Date.now()}-${index}`,
        data: job.data,
        opts: { ...DEFAULT_JOB_OPTIONS, ...job.options },
    }));

    const result = await queue.addBulk(bulkJobs);
    console.log(`[JobQueue] Added ${result.length} bulk jobs to ${queueName}`);

    return result;
}

/**
 * Get job by ID
 */
export async function getJob(queueName: QueueName, jobId: string): Promise<Job | null> {
    const queue = getQueue(queueName);
    const job = await queue.getJob(jobId);
    return job || null;
}

/**
 * Get job counts for a queue
 */
export async function getJobCounts(queueName: QueueName): Promise<{
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    waiting: number;
    paused: number;
}> {
    const queue = getQueue(queueName);
    const counts = await queue.getJobCounts('active', 'completed', 'failed', 'delayed', 'waiting', 'paused');
    return {
        active: counts.active || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0,
        waiting: counts.waiting || 0,
        paused: counts.paused || 0,
    };
}

/**
 * Pause a queue
 */
export async function pauseQueue(queueName: QueueName): Promise<void> {
    const queue = getQueue(queueName);
    await queue.pause();
    console.log(`[JobQueue] Paused queue: ${queueName}`);
}

/**
 * Resume a queue
 */
export async function resumeQueue(queueName: QueueName): Promise<void> {
    const queue = getQueue(queueName);
    await queue.resume();
    console.log(`[JobQueue] Resumed queue: ${queueName}`);
}

/**
 * Clean old jobs from a queue
 */
export async function cleanQueue(
    queueName: QueueName,
    options?: { grace?: number; status?: 'completed' | 'failed' | 'delayed' | 'wait' | 'active' }
): Promise<string[]> {
    const queue = getQueue(queueName);
    const grace = options?.grace || 60000; // Default 1 minute
    const status = options?.status || 'completed';

    const cleaned = await queue.clean(grace, 100, status);
    console.log(`[JobQueue] Cleaned ${cleaned.length} ${status} jobs from ${queueName}`);

    return cleaned;
}

/**
 * Get queue events (for monitoring)
 */
export function getQueueEvents(queueName: QueueName): QueueEvents {
    if (!queueEvents.has(queueName)) {
        const connection = getConnection();
        const events = new QueueEvents(queueName, { connection });

        events.on('completed', ({ jobId, returnvalue }) => {
            console.log(`[JobQueue] Event: Job ${jobId} completed`, returnvalue);
        });

        events.on('failed', ({ jobId, failedReason }) => {
            console.error(`[JobQueue] Event: Job ${jobId} failed`, failedReason);
        });

        queueEvents.set(queueName, events);
    }

    return queueEvents.get(queueName)!;
}

/**
 * Check job queue health
 */
export async function checkJobQueueHealth(): Promise<{
    healthy: boolean;
    queues: { name: string; counts: Awaited<ReturnType<typeof getJobCounts>> }[];
    error?: string;
}> {
    try {
        const queueNames = Object.values(QueueNames);
        const queueStatuses = await Promise.all(
            queueNames.map(async (name) => {
                try {
                    const counts = await getJobCounts(name);
                    return { name, counts };
                } catch {
                    return { name, counts: { active: 0, completed: 0, failed: 0, delayed: 0, waiting: 0, paused: 0 } };
                }
            })
        );

        return {
            healthy: true,
            queues: queueStatuses,
        };
    } catch (error) {
        return {
            healthy: false,
            queues: [],
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Graceful shutdown
 */
export async function closeJobQueues(): Promise<void> {
    console.log('[JobQueue] Shutting down...');

    // Close all workers
    for (const [name, worker] of workers) {
        await worker.close();
        console.log(`[JobQueue] Closed worker: ${name}`);
    }
    workers.clear();

    // Close all queue events
    for (const [name, events] of queueEvents) {
        await events.close();
        console.log(`[JobQueue] Closed queue events: ${name}`);
    }
    queueEvents.clear();

    // Close all queues
    for (const [name, queue] of queues) {
        await queue.close();
        console.log(`[JobQueue] Closed queue: ${name}`);
    }
    queues.clear();

    // Close Redis connection
    if (ioRedisConnection) {
        await ioRedisConnection.quit();
        ioRedisConnection = null;
        console.log('[JobQueue] Closed Redis connection');
    }

    console.log('[JobQueue] Shutdown complete');
}

// Job payload interfaces
export interface ProjectImportJobData {
    projectId: string;
    userId: string;
    platform: string;
    zipFileBase64?: string;
    metadata: Record<string, unknown>;
}

export interface FileProcessingJobData {
    projectId: string;
    filePath: string;
    operation: 'analyze' | 'lint' | 'format' | 'compile';
}

export interface NotificationJobData {
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
}

export interface AnalyticsJobData {
    event: string;
    userId?: string;
    projectId?: string;
    metadata: Record<string, unknown>;
    timestamp: string;
}

export interface CleanupJobData {
    type: 'expired-sessions' | 'old-logs' | 'orphaned-files' | 'stale-cache';
    olderThan: string;
}

export interface AITaskJobData {
    agentId: string;
    projectId: string;
    task: string;
    context?: Record<string, unknown>;
    priority: 'low' | 'medium' | 'high';
}

export interface CredentialSyncJobData {
    userId: string;
    service: string;
    action: 'sync' | 'validate' | 'rotate';
}

export default {
    QueueNames,
    getQueue,
    registerWorker,
    addJob,
    addBulkJobs,
    getJob,
    getJobCounts,
    pauseQueue,
    resumeQueue,
    cleanQueue,
    getQueueEvents,
    checkJobQueueHealth,
    closeJobQueues,
};
