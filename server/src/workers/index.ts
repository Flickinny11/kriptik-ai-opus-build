// Workers Index
// Background job processors for all queues

import { Job } from 'bullmq';
import {
    registerWorker,
    QueueNames,
    ProjectImportJobData,
    FileProcessingJobData,
    NotificationJobData,
    AnalyticsJobData,
    CleanupJobData,
    AITaskJobData,
    CredentialSyncJobData,
} from '../services/infrastructure/job-queue.js';
import { getRedis, CacheKeys, CacheTTL } from '../services/infrastructure/redis.js';
import { uploadFile, deleteFile, listFiles } from '../services/infrastructure/storage.js';

// Worker status
let workersInitialized = false;

/**
 * Initialize all workers
 */
export async function initializeWorkers(): Promise<void> {
    if (workersInitialized) {
        console.log('[Workers] Already initialized');
        return;
    }

    console.log('[Workers] Initializing background job workers...');

    // Project Import Worker
    registerWorker<ProjectImportJobData, { success: boolean; projectId: string }>(
        QueueNames.PROJECT_IMPORT,
        async (job: Job<ProjectImportJobData>) => {
            console.log(`[Worker:ProjectImport] Processing job ${job.id}`);

            const { projectId, userId, platform, zipFileBase64, metadata } = job.data;

            try {
                await job.updateProgress(10);

                // Store metadata in Redis
                const redis = getRedis();
                await redis.set(
                    CacheKeys.project(projectId),
                    JSON.stringify({ ...metadata, platform, userId }),
                    { ex: CacheTTL.DAY }
                );

                await job.updateProgress(30);

                // Process ZIP if provided
                if (zipFileBase64) {
                    const buffer = Buffer.from(zipFileBase64, 'base64');
                    await uploadFile(`projects/${projectId}/source.zip`, buffer, {
                        contentType: 'application/zip',
                    });
                }

                await job.updateProgress(70);

                // Store import record
                const importRecord = {
                    projectId,
                    userId,
                    platform,
                    importedAt: new Date().toISOString(),
                    status: 'completed',
                };

                await redis.hset(`user:${userId}:imports`, { [projectId]: JSON.stringify(importRecord) });

                await job.updateProgress(100);

                console.log(`[Worker:ProjectImport] Completed job ${job.id}`);
                return { success: true, projectId };
            } catch (error) {
                console.error(`[Worker:ProjectImport] Failed job ${job.id}:`, error);
                throw error;
            }
        },
        { concurrency: 3 }
    );

    // File Processing Worker
    registerWorker<FileProcessingJobData, { success: boolean; result?: unknown }>(
        QueueNames.FILE_PROCESSING,
        async (job: Job<FileProcessingJobData>) => {
            console.log(`[Worker:FileProcessing] Processing job ${job.id}`);

            const { projectId, filePath, operation } = job.data;

            try {
                await job.updateProgress(20);

                // Placeholder for actual file processing
                // This would integrate with linters, formatters, etc.
                const result = {
                    operation,
                    filePath,
                    projectId,
                    processedAt: new Date().toISOString(),
                };

                await job.updateProgress(100);

                console.log(`[Worker:FileProcessing] Completed job ${job.id}`);
                return { success: true, result };
            } catch (error) {
                console.error(`[Worker:FileProcessing] Failed job ${job.id}:`, error);
                throw error;
            }
        },
        { concurrency: 10 }
    );

    // Notification Worker
    registerWorker<NotificationJobData, { success: boolean; notificationId: string }>(
        QueueNames.NOTIFICATION,
        async (job: Job<NotificationJobData>) => {
            console.log(`[Worker:Notification] Processing job ${job.id}`);

            const { userId, type, title, message, data } = job.data;

            try {
                const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                const notification = {
                    id: notificationId,
                    userId,
                    type,
                    title,
                    message,
                    data,
                    read: false,
                    createdAt: new Date().toISOString(),
                };

                // Store notification in Redis
                const redis = getRedis();
                await redis.set(
                    CacheKeys.notification(notificationId),
                    JSON.stringify(notification),
                    { ex: CacheTTL.WEEK }
                );

                // Add to user's notification list
                await redis.sadd(CacheKeys.userNotifications(userId), notificationId);

                console.log(`[Worker:Notification] Completed job ${job.id}`);
                return { success: true, notificationId };
            } catch (error) {
                console.error(`[Worker:Notification] Failed job ${job.id}:`, error);
                throw error;
            }
        },
        { concurrency: 20 }
    );

    // Analytics Worker
    registerWorker<AnalyticsJobData, { success: boolean }>(
        QueueNames.ANALYTICS,
        async (job: Job<AnalyticsJobData>) => {
            console.log(`[Worker:Analytics] Processing job ${job.id}`);

            const { event, userId, projectId, metadata, timestamp } = job.data;

            try {
                const redis = getRedis();
                const date = timestamp.split('T')[0]; // YYYY-MM-DD

                // Increment event counter
                await redis.incr(CacheKeys.analytics(event, date));

                // Store event details for recent events
                const eventData = {
                    event,
                    userId,
                    projectId,
                    metadata,
                    timestamp,
                };

                await redis.set(
                    `analytics:event:${job.id}`,
                    JSON.stringify(eventData),
                    { ex: CacheTTL.DAY }
                );

                console.log(`[Worker:Analytics] Completed job ${job.id}`);
                return { success: true };
            } catch (error) {
                console.error(`[Worker:Analytics] Failed job ${job.id}:`, error);
                throw error;
            }
        },
        {
            concurrency: 50,
            limiter: { max: 1000, duration: 1000 }, // 1000 events per second max
        }
    );

    // Cleanup Worker
    registerWorker<CleanupJobData, { success: boolean; cleaned: number }>(
        QueueNames.CLEANUP,
        async (job: Job<CleanupJobData>) => {
            console.log(`[Worker:Cleanup] Processing job ${job.id}`);

            const { type, olderThan } = job.data;
            let cleaned = 0;

            try {
                const redis = getRedis();
                const cutoffDate = new Date(olderThan);

                switch (type) {
                    case 'expired-sessions':
                        // Clean expired sessions from Redis
                        const sessionKeys = await redis.keys('session:*');
                        for (const key of sessionKeys) {
                            const ttl = await redis.ttl(key);
                            if (ttl === -2 || ttl === -1) {
                                await redis.del(key);
                                cleaned++;
                            }
                        }
                        break;

                    case 'old-logs':
                        // Clean old log entries
                        const logKeys = await redis.keys('log:*');
                        for (const key of logKeys) {
                            const data = await redis.get<{ timestamp: string }>(key);
                            if (data && new Date(data.timestamp) < cutoffDate) {
                                await redis.del(key);
                                cleaned++;
                            }
                        }
                        break;

                    case 'orphaned-files':
                        // Clean orphaned files from storage
                        const tempFiles = await listFiles({ prefix: 'temp/' });
                        for (const file of tempFiles.blobs) {
                            if (new Date(file.uploadedAt) < cutoffDate) {
                                await deleteFile(file.pathname);
                                cleaned++;
                            }
                        }
                        break;

                    case 'stale-cache':
                        // Clean stale cache entries
                        const cacheKeys = await redis.keys('cache:*');
                        for (const key of cacheKeys) {
                            const ttl = await redis.ttl(key);
                            if (ttl === -2) {
                                await redis.del(key);
                                cleaned++;
                            }
                        }
                        break;
                }

                console.log(`[Worker:Cleanup] Completed job ${job.id}, cleaned ${cleaned} items`);
                return { success: true, cleaned };
            } catch (error) {
                console.error(`[Worker:Cleanup] Failed job ${job.id}:`, error);
                throw error;
            }
        },
        { concurrency: 1 }
    );

    // AI Task Worker
    registerWorker<AITaskJobData, { success: boolean; result?: unknown }>(
        QueueNames.AI_TASK,
        async (job: Job<AITaskJobData>) => {
            console.log(`[Worker:AITask] Processing job ${job.id}`);

            const { agentId, projectId, task, context, priority } = job.data;

            try {
                await job.updateProgress(10);

                // Store task execution record
                const redis = getRedis();
                const taskRecord = {
                    agentId,
                    projectId,
                    task,
                    context,
                    priority,
                    status: 'processing',
                    startedAt: new Date().toISOString(),
                };

                await redis.set(
                    `ai-task:${job.id}`,
                    JSON.stringify(taskRecord),
                    { ex: CacheTTL.LONG }
                );

                await job.updateProgress(50);

                // Placeholder for actual AI task execution
                // This would integrate with agent execution engine
                const result = {
                    agentId,
                    task,
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                };

                await job.updateProgress(100);

                // Update task record
                await redis.set(
                    `ai-task:${job.id}`,
                    JSON.stringify({ ...taskRecord, ...result }),
                    { ex: CacheTTL.LONG }
                );

                console.log(`[Worker:AITask] Completed job ${job.id}`);
                return { success: true, result };
            } catch (error) {
                console.error(`[Worker:AITask] Failed job ${job.id}:`, error);
                throw error;
            }
        },
        {
            concurrency: 5,
            limiter: { max: 10, duration: 60000 }, // 10 AI tasks per minute max
        }
    );

    // Credential Sync Worker
    registerWorker<CredentialSyncJobData, { success: boolean; action: string }>(
        QueueNames.CREDENTIAL_SYNC,
        async (job: Job<CredentialSyncJobData>) => {
            console.log(`[Worker:CredentialSync] Processing job ${job.id}`);

            const { userId, service, action } = job.data;

            try {
                const redis = getRedis();

                switch (action) {
                    case 'sync':
                        // Sync credentials from external service
                        console.log(`[Worker:CredentialSync] Syncing ${service} for user ${userId}`);
                        break;

                    case 'validate':
                        // Validate stored credentials
                        console.log(`[Worker:CredentialSync] Validating ${service} for user ${userId}`);
                        break;

                    case 'rotate':
                        // Rotate credentials
                        console.log(`[Worker:CredentialSync] Rotating ${service} for user ${userId}`);
                        break;
                }

                // Update sync timestamp
                await redis.hset(
                    `user:${userId}:credentials`,
                    { [`${service}:lastSync`]: new Date().toISOString() }
                );

                console.log(`[Worker:CredentialSync] Completed job ${job.id}`);
                return { success: true, action };
            } catch (error) {
                console.error(`[Worker:CredentialSync] Failed job ${job.id}:`, error);
                throw error;
            }
        },
        { concurrency: 3 }
    );

    workersInitialized = true;
    console.log('[Workers] All workers initialized');
}

/**
 * Check if workers are initialized
 */
export function areWorkersInitialized(): boolean {
    return workersInitialized;
}

export default {
    initializeWorkers,
    areWorkersInitialized,
};
