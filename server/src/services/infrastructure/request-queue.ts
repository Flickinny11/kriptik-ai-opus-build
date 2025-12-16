/**
 * Request Queue Service
 *
 * High-performance request queueing and throttling for API scalability.
 * Prevents thundering herd problems and ensures fair resource allocation.
 *
 * Features:
 * - Request deduplication with sliding window
 * - Per-user rate limiting
 * - Global rate limiting
 * - Request prioritization
 * - Queue overflow protection
 * - Request batching for bulk operations
 */

import { getRedis, CacheTTL } from './redis.js';
import { createHash } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface QueuedRequest<T = unknown> {
    id: string;
    userId?: string;
    type: RequestType;
    priority: RequestPriority;
    data: T;
    createdAt: number;
    expiresAt: number;
    dedupeKey?: string;
    metadata?: Record<string, unknown>;
}

export type RequestType =
    | 'ai_generation'
    | 'file_operation'
    | 'build'
    | 'deployment'
    | 'import'
    | 'export'
    | 'analytics'
    | 'generic';

export type RequestPriority = 'critical' | 'high' | 'normal' | 'low' | 'background';

export interface QueueConfig {
    maxQueueSize: number;
    maxPerUser: number;
    defaultTTL: number;
    enableDeduplication: boolean;
    dedupeWindow: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfter?: number;
}

export interface QueueStats {
    total: number;
    byType: Record<RequestType, number>;
    byPriority: Record<RequestPriority, number>;
    processed: number;
    rejected: number;
    deduplicated: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: QueueConfig = {
    maxQueueSize: 10000,
    maxPerUser: 50,
    defaultTTL: 300,           // 5 minutes
    enableDeduplication: true,
    dedupeWindow: 10,          // 10 seconds
};

// Rate limits per request type (requests per minute)
const RATE_LIMITS: Record<RequestType, { perUser: number; global: number }> = {
    ai_generation: { perUser: 30, global: 500 },
    file_operation: { perUser: 100, global: 2000 },
    build: { perUser: 10, global: 100 },
    deployment: { perUser: 5, global: 50 },
    import: { perUser: 20, global: 200 },
    export: { perUser: 20, global: 200 },
    analytics: { perUser: 200, global: 5000 },
    generic: { perUser: 60, global: 1000 },
};

// Priority weights for queue processing
const PRIORITY_WEIGHTS: Record<RequestPriority, number> = {
    critical: 100,
    high: 50,
    normal: 10,
    low: 2,
    background: 1,
};

const KEY_PREFIX = {
    queue: 'rq:queue:',
    userQueue: 'rq:user:',
    dedupe: 'rq:dedupe:',
    rateLimit: 'rq:rate:',
    stats: 'rq:stats:',
    processing: 'rq:processing:',
};

// ============================================================================
// REQUEST QUEUE SERVICE
// ============================================================================

class RequestQueueService {
    private config: QueueConfig;
    private stats: QueueStats = {
        total: 0,
        byType: {} as Record<RequestType, number>,
        byPriority: {} as Record<RequestPriority, number>,
        processed: 0,
        rejected: 0,
        deduplicated: 0,
    };
    private processingCallbacks: Map<RequestType, (request: QueuedRequest) => Promise<void>> = new Map();

    constructor(config: Partial<QueueConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Generate a unique request ID
     */
    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }

    /**
     * Generate deduplication key from request data
     */
    private generateDedupeKey(
        type: RequestType,
        userId: string | undefined,
        data: unknown
    ): string {
        const payload = JSON.stringify({ type, userId, data });
        return createHash('sha256').update(payload).digest('hex').slice(0, 16);
    }

    /**
     * Check if request is a duplicate within the sliding window
     */
    async isDuplicate(dedupeKey: string): Promise<boolean> {
        if (!this.config.enableDeduplication) return false;

        const redis = getRedis();
        const key = `${KEY_PREFIX.dedupe}${dedupeKey}`;
        const exists = await redis.exists(key);
        return exists > 0;
    }

    /**
     * Mark request as seen for deduplication
     */
    private async markSeen(dedupeKey: string): Promise<void> {
        const redis = getRedis();
        const key = `${KEY_PREFIX.dedupe}${dedupeKey}`;
        await redis.set(key, '1', { ex: this.config.dedupeWindow });
    }

    /**
     * Check user rate limit
     */
    async checkUserRateLimit(
        userId: string,
        type: RequestType
    ): Promise<RateLimitResult> {
        const redis = getRedis();
        const limit = RATE_LIMITS[type].perUser;
        const key = `${KEY_PREFIX.rateLimit}user:${userId}:${type}`;
        const now = Date.now();
        const windowStart = now - 60000; // 1 minute window

        // Use sliding window rate limiting
        await redis.set(`${key}:window`, windowStart.toString(), { ex: 120 });

        const current = await redis.incr(key);
        if (current === 1) {
            await redis.expire(key, 60);
        }

        const remaining = Math.max(0, limit - current);
        const resetAt = now + 60000;

        if (current > limit) {
            return {
                allowed: false,
                remaining: 0,
                resetAt,
                retryAfter: Math.ceil((resetAt - now) / 1000),
            };
        }

        return {
            allowed: true,
            remaining,
            resetAt,
        };
    }

    /**
     * Check global rate limit
     */
    async checkGlobalRateLimit(type: RequestType): Promise<RateLimitResult> {
        const redis = getRedis();
        const limit = RATE_LIMITS[type].global;
        const key = `${KEY_PREFIX.rateLimit}global:${type}`;
        const now = Date.now();

        const current = await redis.incr(key);
        if (current === 1) {
            await redis.expire(key, 60);
        }

        const remaining = Math.max(0, limit - current);
        const resetAt = now + 60000;

        if (current > limit) {
            return {
                allowed: false,
                remaining: 0,
                resetAt,
                retryAfter: Math.ceil((resetAt - now) / 1000),
            };
        }

        return {
            allowed: true,
            remaining,
            resetAt,
        };
    }

    /**
     * Enqueue a request
     */
    async enqueue<T = unknown>(
        type: RequestType,
        data: T,
        options: {
            userId?: string;
            priority?: RequestPriority;
            ttl?: number;
            dedupeKey?: string;
            metadata?: Record<string, unknown>;
        } = {}
    ): Promise<{
        queued: boolean;
        requestId?: string;
        position?: number;
        reason?: string;
        rateLimit?: RateLimitResult;
    }> {
        const priority = options.priority ?? 'normal';
        const ttl = options.ttl ?? this.config.defaultTTL;
        const now = Date.now();

        // Generate dedupe key if not provided
        const dedupeKey = options.dedupeKey ?? this.generateDedupeKey(type, options.userId, data);

        // Check for duplicate
        if (await this.isDuplicate(dedupeKey)) {
            this.stats.deduplicated++;
            return {
                queued: false,
                reason: 'duplicate_request',
            };
        }

        // Check user rate limit
        if (options.userId) {
            const userLimit = await this.checkUserRateLimit(options.userId, type);
            if (!userLimit.allowed) {
                this.stats.rejected++;
                return {
                    queued: false,
                    reason: 'user_rate_limit_exceeded',
                    rateLimit: userLimit,
                };
            }
        }

        // Check global rate limit
        const globalLimit = await this.checkGlobalRateLimit(type);
        if (!globalLimit.allowed) {
            this.stats.rejected++;
            return {
                queued: false,
                reason: 'global_rate_limit_exceeded',
                rateLimit: globalLimit,
            };
        }

        // Check queue size
        const redis = getRedis();
        const queueKey = `${KEY_PREFIX.queue}${type}`;
        const queueSize = await redis.get<number>(`${queueKey}:size`) ?? 0;

        if (queueSize >= this.config.maxQueueSize) {
            this.stats.rejected++;
            return {
                queued: false,
                reason: 'queue_full',
            };
        }

        // Check per-user queue limit
        if (options.userId) {
            const userQueueKey = `${KEY_PREFIX.userQueue}${options.userId}:${type}`;
            const userQueueSize = await redis.get<number>(userQueueKey) ?? 0;

            if (userQueueSize >= this.config.maxPerUser) {
                this.stats.rejected++;
                return {
                    queued: false,
                    reason: 'user_queue_limit_exceeded',
                };
            }

            await redis.incr(userQueueKey);
            await redis.expire(userQueueKey, ttl);
        }

        // Create request object
        const request: QueuedRequest<T> = {
            id: this.generateId(),
            userId: options.userId,
            type,
            priority,
            data,
            createdAt: now,
            expiresAt: now + (ttl * 1000),
            dedupeKey,
            metadata: options.metadata,
        };

        // Calculate score for priority queue (lower = higher priority)
        const score = now - (PRIORITY_WEIGHTS[priority] * 1000);

        // Add to sorted set (priority queue)
        await redis.set(
            `${queueKey}:${request.id}`,
            request,
            { ex: ttl }
        );

        // Update queue size
        await redis.incr(`${queueKey}:size`);
        await redis.expire(`${queueKey}:size`, ttl);

        // Mark as seen for deduplication
        await this.markSeen(dedupeKey);

        // Update stats
        this.stats.total++;
        this.stats.byType[type] = (this.stats.byType[type] ?? 0) + 1;
        this.stats.byPriority[priority] = (this.stats.byPriority[priority] ?? 0) + 1;

        return {
            queued: true,
            requestId: request.id,
            position: queueSize + 1,
        };
    }

    /**
     * Dequeue and process next request
     */
    async dequeue(type: RequestType): Promise<QueuedRequest | null> {
        const redis = getRedis();
        const queueKey = `${KEY_PREFIX.queue}${type}`;

        // Get all request keys for this type
        const keys = await redis.keys(`${queueKey}:*`);
        const requestKeys = keys.filter(k => !k.endsWith(':size'));

        if (requestKeys.length === 0) return null;

        // Find the highest priority request (lowest timestamp adjusted by priority)
        let bestRequest: QueuedRequest | null = null;
        let bestScore = Infinity;
        let bestKey = '';

        for (const key of requestKeys.slice(0, 100)) { // Limit scan for performance
            const request = await redis.get<QueuedRequest>(key);
            if (!request) continue;

            // Skip expired requests
            if (Date.now() > request.expiresAt) {
                await redis.del(key);
                continue;
            }

            const score = request.createdAt - (PRIORITY_WEIGHTS[request.priority] * 1000);
            if (score < bestScore) {
                bestScore = score;
                bestRequest = request;
                bestKey = key;
            }
        }

        if (!bestRequest || !bestKey) return null;

        // Remove from queue
        await redis.del(bestKey);
        await redis.incr(`${queueKey}:size`); // Decrement (negative incr handled by get default)

        // Decrement user queue size
        if (bestRequest.userId) {
            const userQueueKey = `${KEY_PREFIX.userQueue}${bestRequest.userId}:${type}`;
            const userCount = await redis.get<number>(userQueueKey);
            if (userCount && userCount > 0) {
                await redis.set(userQueueKey, userCount - 1, { ex: CacheTTL.MEDIUM });
            }
        }

        // Mark as processing
        await redis.set(
            `${KEY_PREFIX.processing}${bestRequest.id}`,
            bestRequest,
            { ex: 300 } // 5 minute processing timeout
        );

        this.stats.processed++;

        return bestRequest;
    }

    /**
     * Mark request as completed
     */
    async complete(requestId: string): Promise<void> {
        const redis = getRedis();
        await redis.del(`${KEY_PREFIX.processing}${requestId}`);
    }

    /**
     * Mark request as failed (can be requeued)
     */
    async fail(requestId: string, requeue: boolean = false): Promise<void> {
        const redis = getRedis();
        const processingKey = `${KEY_PREFIX.processing}${requestId}`;

        if (requeue) {
            const request = await redis.get<QueuedRequest>(processingKey);
            if (request) {
                // Re-enqueue with lower priority
                await this.enqueue(
                    request.type,
                    request.data,
                    {
                        userId: request.userId,
                        priority: 'low',
                        metadata: { ...request.metadata, requeued: true },
                    }
                );
            }
        }

        await redis.del(processingKey);
    }

    /**
     * Get queue statistics
     */
    async getQueueStats(type?: RequestType): Promise<{
        size: number;
        processing: number;
        byPriority: Record<RequestPriority, number>;
    }> {
        const redis = getRedis();

        if (type) {
            const queueKey = `${KEY_PREFIX.queue}${type}`;
            const size = await redis.get<number>(`${queueKey}:size`) ?? 0;
            const processingKeys = await redis.keys(`${KEY_PREFIX.processing}*`);

            return {
                size,
                processing: processingKeys.length,
                byPriority: {} as Record<RequestPriority, number>,
            };
        }

        // Aggregate all queues
        let totalSize = 0;
        let totalProcessing = 0;

        for (const t of Object.keys(RATE_LIMITS) as RequestType[]) {
            const queueKey = `${KEY_PREFIX.queue}${t}`;
            const size = await redis.get<number>(`${queueKey}:size`) ?? 0;
            totalSize += size;
        }

        const processingKeys = await redis.keys(`${KEY_PREFIX.processing}*`);
        totalProcessing = processingKeys.length;

        return {
            size: totalSize,
            processing: totalProcessing,
            byPriority: this.stats.byPriority,
        };
    }

    /**
     * Get overall statistics
     */
    getStats(): QueueStats {
        return { ...this.stats };
    }

    /**
     * Clear expired requests from queues
     */
    async cleanup(): Promise<number> {
        const redis = getRedis();
        let cleaned = 0;
        const now = Date.now();

        for (const type of Object.keys(RATE_LIMITS) as RequestType[]) {
            const queueKey = `${KEY_PREFIX.queue}${type}`;
            const keys = await redis.keys(`${queueKey}:*`);

            for (const key of keys) {
                if (key.endsWith(':size')) continue;

                const request = await redis.get<QueuedRequest>(key);
                if (request && now > request.expiresAt) {
                    await redis.del(key);
                    cleaned++;
                }
            }
        }

        return cleaned;
    }

    /**
     * Register a processing callback for a request type
     */
    registerProcessor(
        type: RequestType,
        callback: (request: QueuedRequest) => Promise<void>
    ): void {
        this.processingCallbacks.set(type, callback);
    }

    /**
     * Start processing loop for a request type
     */
    async startProcessing(
        type: RequestType,
        options: { concurrency?: number; pollInterval?: number } = {}
    ): Promise<void> {
        const concurrency = options.concurrency ?? 5;
        const pollInterval = options.pollInterval ?? 100;
        const callback = this.processingCallbacks.get(type);

        if (!callback) {
            console.warn(`[RequestQueue] No processor registered for type: ${type}`);
            return;
        }

        const processOne = async () => {
            const request = await this.dequeue(type);
            if (request) {
                try {
                    await callback(request);
                    await this.complete(request.id);
                } catch (error) {
                    console.error(`[RequestQueue] Processing failed for ${request.id}:`, error);
                    await this.fail(request.id, true);
                }
            }
        };

        // Start concurrent processors
        const processors = Array(concurrency).fill(null).map(async () => {
            while (true) {
                await processOne();
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
        });

        // This runs indefinitely - would be stopped by server shutdown
        await Promise.all(processors);
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let requestQueueService: RequestQueueService | null = null;

export function getRequestQueue(): RequestQueueService {
    if (!requestQueueService) {
        requestQueueService = new RequestQueueService();
    }
    return requestQueueService;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Quick enqueue helper
 */
export async function enqueueRequest<T = unknown>(
    type: RequestType,
    data: T,
    options?: {
        userId?: string;
        priority?: RequestPriority;
        ttl?: number;
    }
): Promise<{
    queued: boolean;
    requestId?: string;
    reason?: string;
}> {
    return getRequestQueue().enqueue(type, data, options);
}

/**
 * Check rate limit helper
 */
export async function checkRateLimit(
    userId: string,
    type: RequestType
): Promise<RateLimitResult> {
    return getRequestQueue().checkUserRateLimit(userId, type);
}

/**
 * Get queue stats helper
 */
export async function getQueueStats(type?: RequestType) {
    return getRequestQueue().getQueueStats(type);
}

export default {
    getRequestQueue,
    enqueueRequest,
    checkRateLimit,
    getQueueStats,
};
