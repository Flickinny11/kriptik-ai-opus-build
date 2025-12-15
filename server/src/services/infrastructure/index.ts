// Infrastructure Services Index
// Central export for all production infrastructure services

// Redis
export {
    getRedis,
    checkRedisHealth,
    getRedisStatus,
    closeRedis,
    CacheKeys,
    CacheTTL,
} from './redis.js';

// Storage
export {
    uploadFile,
    downloadFile,
    deleteFile,
    fileExists,
    getFileMetadata,
    listFiles,
    uploadProjectFiles,
    deleteProjectFiles,
    checkStorageHealth,
    getStorageStats,
} from './storage.js';

// Job Queue
export {
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
} from './job-queue.js';

// Type exports
export type {
    ProjectImportJobData,
    FileProcessingJobData,
    NotificationJobData,
    AnalyticsJobData,
    CleanupJobData,
    AITaskJobData,
    CredentialSyncJobData,
} from './job-queue.js';
