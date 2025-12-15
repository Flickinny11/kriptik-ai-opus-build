// Redis Infrastructure Service
// Centralized Redis connection management for Upstash

import { Redis } from '@upstash/redis';

// Redis singleton instance
let redisInstance: Redis | null = null;

// Connection status
let isConnected = false;
let lastError: Error | null = null;

/**
 * Get or create Redis connection
 */
export function getRedis(): Redis {
    if (!redisInstance) {
        const url = process.env.UPSTASH_REDIS_REST_URL;
        const token = process.env.UPSTASH_REDIS_REST_TOKEN;

        if (!url || !token) {
            console.warn('[Redis] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
            console.warn('[Redis] Falling back to mock Redis for development');

            // Return mock Redis for development
            return createMockRedis();
        }

        redisInstance = new Redis({
            url,
            token,
        });

        isConnected = true;
        console.log('[Redis] Connected to Upstash Redis');
    }

    return redisInstance;
}

/**
 * Create mock Redis for development without Upstash
 */
function createMockRedis(): Redis {
    const store = new Map<string, { value: string; expiry?: number }>();

    const mockRedis = {
        async get<T = string>(key: string): Promise<T | null> {
            const item = store.get(key);
            if (!item) return null;
            if (item.expiry && Date.now() > item.expiry) {
                store.delete(key);
                return null;
            }
            try {
                return JSON.parse(item.value) as T;
            } catch {
                return item.value as unknown as T;
            }
        },

        async set(key: string, value: unknown, options?: { ex?: number; px?: number }): Promise<'OK'> {
            let expiry: number | undefined;
            if (options?.ex) {
                expiry = Date.now() + options.ex * 1000;
            } else if (options?.px) {
                expiry = Date.now() + options.px;
            }
            store.set(key, {
                value: typeof value === 'string' ? value : JSON.stringify(value),
                expiry,
            });
            return 'OK';
        },

        async del(...keys: string[]): Promise<number> {
            let deleted = 0;
            for (const key of keys) {
                if (store.delete(key)) deleted++;
            }
            return deleted;
        },

        async exists(...keys: string[]): Promise<number> {
            let count = 0;
            for (const key of keys) {
                if (store.has(key)) count++;
            }
            return count;
        },

        async incr(key: string): Promise<number> {
            const current = store.get(key);
            const newVal = current ? parseInt(current.value, 10) + 1 : 1;
            store.set(key, { value: String(newVal), expiry: current?.expiry });
            return newVal;
        },

        async expire(key: string, seconds: number): Promise<0 | 1> {
            const item = store.get(key);
            if (!item) return 0;
            item.expiry = Date.now() + seconds * 1000;
            return 1;
        },

        async ttl(key: string): Promise<number> {
            const item = store.get(key);
            if (!item) return -2;
            if (!item.expiry) return -1;
            return Math.max(0, Math.floor((item.expiry - Date.now()) / 1000));
        },

        async keys(pattern: string): Promise<string[]> {
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
            const result: string[] = [];
            for (const key of store.keys()) {
                if (regex.test(key)) result.push(key);
            }
            return result;
        },

        async hset(key: string, field: string, value: unknown): Promise<number> {
            const existing = store.get(key);
            const hash = existing ? JSON.parse(existing.value) : {};
            hash[field] = value;
            store.set(key, { value: JSON.stringify(hash), expiry: existing?.expiry });
            return 1;
        },

        async hget<T = string>(key: string, field: string): Promise<T | null> {
            const item = store.get(key);
            if (!item) return null;
            const hash = JSON.parse(item.value);
            return hash[field] ?? null;
        },

        async hgetall<T = Record<string, string>>(key: string): Promise<T | null> {
            const item = store.get(key);
            if (!item) return null;
            return JSON.parse(item.value) as T;
        },

        async hdel(key: string, ...fields: string[]): Promise<number> {
            const item = store.get(key);
            if (!item) return 0;
            const hash = JSON.parse(item.value);
            let deleted = 0;
            for (const field of fields) {
                if (field in hash) {
                    delete hash[field];
                    deleted++;
                }
            }
            store.set(key, { value: JSON.stringify(hash), expiry: item.expiry });
            return deleted;
        },

        async sadd(key: string, ...members: string[]): Promise<number> {
            const existing = store.get(key);
            const set = existing ? new Set(JSON.parse(existing.value)) : new Set();
            let added = 0;
            for (const member of members) {
                if (!set.has(member)) {
                    set.add(member);
                    added++;
                }
            }
            store.set(key, { value: JSON.stringify([...set]), expiry: existing?.expiry });
            return added;
        },

        async smembers(key: string): Promise<string[]> {
            const item = store.get(key);
            if (!item) return [];
            return JSON.parse(item.value);
        },

        async srem(key: string, ...members: string[]): Promise<number> {
            const item = store.get(key);
            if (!item) return 0;
            const set = new Set(JSON.parse(item.value));
            let removed = 0;
            for (const member of members) {
                if (set.delete(member)) removed++;
            }
            store.set(key, { value: JSON.stringify([...set]), expiry: item.expiry });
            return removed;
        },

        async publish(channel: string, message: string): Promise<number> {
            console.log(`[MockRedis] Publish to ${channel}:`, message);
            return 0;
        },

        async ping(): Promise<string> {
            return 'PONG';
        },
    };

    return mockRedis as unknown as Redis;
}

/**
 * Check Redis connection health
 */
export async function checkRedisHealth(): Promise<{
    connected: boolean;
    latency?: number;
    error?: string;
}> {
    try {
        const redis = getRedis();
        const start = Date.now();
        await redis.ping();
        const latency = Date.now() - start;

        isConnected = true;
        lastError = null;

        return {
            connected: true,
            latency,
        };
    } catch (error) {
        isConnected = false;
        lastError = error instanceof Error ? error : new Error(String(error));

        return {
            connected: false,
            error: lastError.message,
        };
    }
}

/**
 * Get Redis connection status
 */
export function getRedisStatus(): {
    connected: boolean;
    lastError: string | null;
} {
    return {
        connected: isConnected,
        lastError: lastError?.message ?? null,
    };
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRedis(): Promise<void> {
    // Upstash Redis REST client doesn't need explicit closing
    redisInstance = null;
    isConnected = false;
    console.log('[Redis] Connection closed');
}

// Cache key helpers
export const CacheKeys = {
    // User-related
    user: (id: string) => `user:${id}`,
    userSession: (id: string) => `session:${id}`,
    userProjects: (userId: string) => `user:${userId}:projects`,

    // Project-related
    project: (id: string) => `project:${id}`,
    projectFiles: (id: string) => `project:${id}:files`,
    projectAgents: (id: string) => `project:${id}:agents`,

    // Agent-related
    agent: (id: string) => `agent:${id}`,
    agentConversation: (id: string) => `agent:${id}:conversation`,

    // Rate limiting
    rateLimit: (key: string) => `ratelimit:${key}`,

    // WebSocket
    wsConnection: (id: string) => `ws:connection:${id}`,
    wsChannel: (channel: string) => `ws:channel:${channel}`,

    // Analytics
    analytics: (metric: string, date: string) => `analytics:${metric}:${date}`,

    // Notifications
    notification: (id: string) => `notification:${id}`,
    userNotifications: (userId: string) => `user:${userId}:notifications`,
};

// TTL constants (in seconds)
export const CacheTTL = {
    SHORT: 60,           // 1 minute
    MEDIUM: 300,         // 5 minutes
    LONG: 3600,          // 1 hour
    DAY: 86400,          // 24 hours
    WEEK: 604800,        // 7 days
    SESSION: 86400 * 30, // 30 days
};

export default {
    getRedis,
    checkRedisHealth,
    getRedisStatus,
    closeRedis,
    CacheKeys,
    CacheTTL,
};
