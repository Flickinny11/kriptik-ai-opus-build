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

// Session Service
export {
    getSessionService,
    validateSession,
    createSession,
    deleteSession,
    deleteUserSessions,
    cacheExistingSession,
} from './session-service.js';

// Request Queue
export {
    getRequestQueue,
    enqueueRequest,
    checkRateLimit,
    getQueueStats,
} from './request-queue.js';

// SSE Manager
export {
    getSSEManager,
    createSSEConnection,
    sendSSEEvent,
    broadcastToChannel,
    broadcastToUser,
    broadcastToProject,
    getSSEStats,
} from './sse-manager.js';

// Memory Manager
export {
    getMemoryManager,
    shouldThrottleForMemory,
    getMemoryPressureLevel,
    getCurrentMemoryStats,
    registerMemoryCleanup,
    forceMemoryCleanup,
} from './memory-manager.js';

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

export type {
    SessionData,
    UserData,
    CachedSession,
} from './session-service.js';

export type {
    QueuedRequest,
    RequestType,
    RequestPriority,
    RateLimitResult,
    QueueStats,
} from './request-queue.js';

export type {
    SSEConnection,
    SSEEvent,
    SSEConfig,
    ConnectionStats,
} from './sse-manager.js';

export type {
    MemoryStats,
    MemoryThresholds,
    MemoryPressureEvent,
} from './memory-manager.js';

// Monitoring Service
export {
    getMonitoringService,
    startMonitoring,
    stopMonitoring,
    getSystemHealth,
    recordRequest,
    log,
    logError,
} from './monitoring-service.js';

export type {
    HealthStatus,
    LogLevel,
    ComponentHealth,
    SystemHealth,
    Alert,
    Metric,
    MetricSeries,
    PerformanceMetrics,
    LogEntry,
} from './monitoring-service.js';
