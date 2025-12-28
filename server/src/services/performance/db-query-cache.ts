/**
 * Database Query Cache Service
 *
 * High-performance caching layer for database query results.
 * Uses Redis for distributed caching across serverless functions.
 * Supports cache invalidation patterns for data consistency.
 *
 * Features:
 * - Query result caching with configurable TTLs
 * - Tag-based cache invalidation for related queries
 * - Write-through invalidation on data changes
 * - Stale-while-revalidate pattern support
 * - Automatic cache key generation from query parameters
 */

import { createHash } from 'crypto';
import { getRedis, CacheTTL } from '../infrastructure/redis.js';
import { registerMemoryCleanup } from '../infrastructure/memory-manager.js';

// ============================================================================
// TYPES
// ============================================================================

interface QueryCacheEntry<T> {
    data: T;
    cachedAt: number;
    expiresAt: number;
    tags: string[];
    queryHash: string;
    stale?: boolean;
}

interface QueryCacheOptions {
    ttl?: number;           // Cache TTL in seconds
    tags?: string[];        // Tags for invalidation grouping
    staleWhileRevalidate?: number;  // Additional seconds to serve stale
}

type InvalidationCallback = () => Promise<void>;

// ============================================================================
// CONSTANTS
// ============================================================================

const KEY_PREFIX = 'dbcache';
const TAG_PREFIX = 'dbcache:tag';
const LOCK_PREFIX = 'dbcache:lock';

// Default TTLs for different query types (in seconds)
export const QueryTTL = {
    // User data - relatively stable
    USER: 300,              // 5 minutes
    USER_SETTINGS: 600,     // 10 minutes

    // Project data - changes with builds
    PROJECT: 120,           // 2 minutes
    PROJECT_FILES: 60,      // 1 minute
    PROJECT_LIST: 180,      // 3 minutes

    // Sessions - short lived
    SESSION: 60,            // 1 minute

    // Analytics - can be cached longer
    ANALYTICS: 900,         // 15 minutes
    USAGE_SUMMARY: 300,     // 5 minutes

    // Templates - rarely change
    TEMPLATES: 3600,        // 1 hour

    // Build data - frequently updated
    BUILD_PROGRESS: 30,     // 30 seconds
    BUILD_INTENT: 120,      // 2 minutes
    FEATURE_PROGRESS: 60,   // 1 minute

    // Static config - very stable
    CONFIG: 1800,           // 30 minutes
};

// ============================================================================
// DATABASE QUERY CACHE
// ============================================================================

class DatabaseQueryCache {
    private localCache: Map<string, QueryCacheEntry<unknown>> = new Map();
    private invalidationCallbacks: Map<string, InvalidationCallback[]> = new Map();
    private stats = {
        hits: 0,
        misses: 0,
        staleHits: 0,
        invalidations: 0,
    };
    private revalidating: Set<string> = new Set();

    /**
     * Generate a cache key from query parameters
     */
    private generateKey(table: string, params: Record<string, unknown>): string {
        const sortedParams = Object.keys(params)
            .sort()
            .map(k => `${k}:${JSON.stringify(params[k])}`)
            .join('|');
        const hash = createHash('sha256')
            .update(`${table}:${sortedParams}`)
            .digest('hex')
            .slice(0, 16);
        return `${KEY_PREFIX}:${table}:${hash}`;
    }

    /**
     * Get a cached query result
     */
    async get<T>(
        table: string,
        params: Record<string, unknown>
    ): Promise<{ data: T; fromCache: boolean; stale: boolean } | null> {
        const key = this.generateKey(table, params);

        try {
            const redis = getRedis();
            const entry = await redis.get<QueryCacheEntry<T>>(key);

            if (!entry) {
                // Check local cache as fallback
                const localEntry = this.localCache.get(key) as QueryCacheEntry<T> | undefined;
                if (localEntry && Date.now() < localEntry.expiresAt) {
                    this.stats.hits++;
                    return { data: localEntry.data, fromCache: true, stale: false };
                }
                this.stats.misses++;
                return null;
            }

            const now = Date.now();

            // Check if expired
            if (now > entry.expiresAt) {
                // Check for stale-while-revalidate window
                const swrWindow = entry.expiresAt + (CacheTTL.MEDIUM * 1000); // 5 min SWR window
                if (now < swrWindow && !entry.stale) {
                    this.stats.staleHits++;
                    // Mark as stale and trigger background revalidation
                    entry.stale = true;
                    return { data: entry.data, fromCache: true, stale: true };
                }

                await redis.del(key);
                this.localCache.delete(key);
                this.stats.misses++;
                return null;
            }

            this.stats.hits++;
            return { data: entry.data, fromCache: true, stale: false };
        } catch (error) {
            console.warn('[DBQueryCache] Redis get failed:', error);

            // Fallback to local cache
            const localEntry = this.localCache.get(key) as QueryCacheEntry<T> | undefined;
            if (localEntry && Date.now() < localEntry.expiresAt) {
                this.stats.hits++;
                return { data: localEntry.data, fromCache: true, stale: false };
            }

            this.stats.misses++;
            return null;
        }
    }

    /**
     * Cache a query result
     */
    async set<T>(
        table: string,
        params: Record<string, unknown>,
        data: T,
        options: QueryCacheOptions = {}
    ): Promise<void> {
        const key = this.generateKey(table, params);
        const ttl = options.ttl ?? QueryTTL.PROJECT;
        const now = Date.now();

        const entry: QueryCacheEntry<T> = {
            data,
            cachedAt: now,
            expiresAt: now + (ttl * 1000),
            tags: options.tags ?? [table],
            queryHash: key,
        };

        try {
            const redis = getRedis();

            // Store the cache entry
            await redis.set(key, entry, { ex: ttl + 300 }); // Add 5 min buffer for SWR

            // Update tag index for invalidation
            for (const tag of entry.tags) {
                await redis.sadd(`${TAG_PREFIX}:${tag}`, key);
                await redis.expire(`${TAG_PREFIX}:${tag}`, CacheTTL.DAY);
            }

            // Also store in local cache for faster reads
            this.localCache.set(key, entry);

            // Cleanup old local cache entries
            this.cleanupLocalCache();
        } catch (error) {
            console.warn('[DBQueryCache] Redis set failed:', error);

            // Store in local cache only
            this.localCache.set(key, entry);
        }
    }

    /**
     * Get or fetch pattern - returns cached data or fetches and caches
     */
    async getOrFetch<T>(
        table: string,
        params: Record<string, unknown>,
        fetchFn: () => Promise<T>,
        options: QueryCacheOptions = {}
    ): Promise<T> {
        // Try to get from cache
        const cached = await this.get<T>(table, params);

        if (cached && !cached.stale) {
            return cached.data;
        }

        // If stale, return stale data but trigger background revalidation
        if (cached?.stale) {
            const key = this.generateKey(table, params);
            if (!this.revalidating.has(key)) {
                this.revalidating.add(key);
                this.backgroundRevalidate(table, params, fetchFn, options)
                    .finally(() => this.revalidating.delete(key));
            }
            return cached.data;
        }

        // Cache miss - fetch and cache
        const data = await fetchFn();
        await this.set(table, params, data, options);
        return data;
    }

    /**
     * Background revalidation for stale-while-revalidate
     */
    private async backgroundRevalidate<T>(
        table: string,
        params: Record<string, unknown>,
        fetchFn: () => Promise<T>,
        options: QueryCacheOptions
    ): Promise<void> {
        try {
            const data = await fetchFn();
            await this.set(table, params, data, options);
        } catch (error) {
            console.warn('[DBQueryCache] Background revalidation failed:', error);
        }
    }

    /**
     * Invalidate cache entries by tag
     */
    async invalidateByTag(tag: string): Promise<number> {
        this.stats.invalidations++;
        let invalidated = 0;

        try {
            const redis = getRedis();
            const tagKey = `${TAG_PREFIX}:${tag}`;
            const keys = await redis.smembers(tagKey);

            if (keys.length > 0) {
                await redis.del(...keys);
                invalidated = keys.length;
            }

            await redis.del(tagKey);

            // Also clear from local cache
            for (const key of this.localCache.keys()) {
                const entry = this.localCache.get(key);
                if (entry?.tags.includes(tag)) {
                    this.localCache.delete(key);
                    invalidated++;
                }
            }
        } catch (error) {
            console.warn('[DBQueryCache] Invalidation failed:', error);

            // Fallback to local cache invalidation only
            for (const [key, entry] of this.localCache.entries()) {
                if (entry.tags.includes(tag)) {
                    this.localCache.delete(key);
                    invalidated++;
                }
            }
        }

        // Run invalidation callbacks
        const callbacks = this.invalidationCallbacks.get(tag) ?? [];
        for (const callback of callbacks) {
            try {
                await callback();
            } catch (error) {
                console.warn('[DBQueryCache] Invalidation callback failed:', error);
            }
        }

        return invalidated;
    }

    /**
     * Invalidate cache for a specific table
     */
    async invalidateTable(table: string): Promise<number> {
        return this.invalidateByTag(table);
    }

    /**
     * Invalidate cache for a specific entity (e.g., user:123)
     */
    async invalidateEntity(table: string, id: string): Promise<number> {
        return this.invalidateByTag(`${table}:${id}`);
    }

    /**
     * Invalidate all caches related to a user
     */
    async invalidateUserRelated(userId: string): Promise<number> {
        let total = 0;
        total += await this.invalidateByTag(`user:${userId}`);
        total += await this.invalidateByTag(`user:${userId}:projects`);
        total += await this.invalidateByTag(`user:${userId}:settings`);
        return total;
    }

    /**
     * Invalidate all caches related to a project
     */
    async invalidateProjectRelated(projectId: string): Promise<number> {
        let total = 0;
        total += await this.invalidateByTag(`project:${projectId}`);
        total += await this.invalidateByTag(`project:${projectId}:files`);
        total += await this.invalidateByTag(`project:${projectId}:builds`);
        return total;
    }

    /**
     * Register a callback to run when a tag is invalidated
     */
    onInvalidate(tag: string, callback: InvalidationCallback): void {
        const callbacks = this.invalidationCallbacks.get(tag) ?? [];
        callbacks.push(callback);
        this.invalidationCallbacks.set(tag, callbacks);
    }

    /**
     * Clean up local cache to prevent memory issues
     */
    private cleanupLocalCache(): void {
        const maxEntries = 1000;
        const now = Date.now();

        // Remove expired entries
        for (const [key, entry] of this.localCache.entries()) {
            if (now > entry.expiresAt + (CacheTTL.MEDIUM * 1000)) {
                this.localCache.delete(key);
            }
        }

        // If still too many, remove oldest
        if (this.localCache.size > maxEntries) {
            const entries = Array.from(this.localCache.entries())
                .sort((a, b) => a[1].cachedAt - b[1].cachedAt);

            const toRemove = entries.slice(0, this.localCache.size - maxEntries);
            for (const [key] of toRemove) {
                this.localCache.delete(key);
            }
        }
    }

    /**
     * Aggressively clear in-process cache to relieve memory pressure.
     * Returns an observed heap delta (best-effort; GC timing is runtime-dependent).
     */
    clearLocalCache(): number {
        const before = process.memoryUsage().heapUsed;
        this.localCache.clear();
        this.revalidating.clear();
        const after = process.memoryUsage().heapUsed;
        return Math.max(0, before - after);
    }

    /**
     * Get cache statistics
     */
    getStats(): {
        hits: number;
        misses: number;
        staleHits: number;
        invalidations: number;
        hitRate: number;
        localCacheSize: number;
    } {
        const total = this.stats.hits + this.stats.misses;
        return {
            ...this.stats,
            hitRate: total > 0 ? this.stats.hits / total : 0,
            localCacheSize: this.localCache.size,
        };
    }

    /**
     * Clear all caches
     */
    async clearAll(): Promise<void> {
        try {
            const redis = getRedis();
            const keys = await redis.keys(`${KEY_PREFIX}:*`);
            const tagKeys = await redis.keys(`${TAG_PREFIX}:*`);

            if (keys.length > 0) {
                await redis.del(...keys);
            }
            if (tagKeys.length > 0) {
                await redis.del(...tagKeys);
            }
        } catch (error) {
            console.warn('[DBQueryCache] Clear all failed:', error);
        }

        this.localCache.clear();
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let dbQueryCache: DatabaseQueryCache | null = null;

export function getDBQueryCache(): DatabaseQueryCache {
    if (!dbQueryCache) {
        dbQueryCache = new DatabaseQueryCache();

        // Register memory pressure cleanup hook (serverless-safe)
        // Clears only the in-process cache; does not touch Redis.
        registerMemoryCleanup('db_query_cache_local', 20, async () => {
            return dbQueryCache!.clearLocalCache();
        });
    }
    return dbQueryCache;
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Cache wrapper for user queries
 */
export async function cacheUserQuery<T>(
    userId: string,
    queryName: string,
    fetchFn: () => Promise<T>,
    ttl: number = QueryTTL.USER
): Promise<T> {
    const cache = getDBQueryCache();
    return cache.getOrFetch(
        'users',
        { userId, queryName },
        fetchFn,
        { ttl, tags: [`user:${userId}`, 'users'] }
    );
}

/**
 * Cache wrapper for project queries
 */
export async function cacheProjectQuery<T>(
    projectId: string,
    queryName: string,
    fetchFn: () => Promise<T>,
    ttl: number = QueryTTL.PROJECT
): Promise<T> {
    const cache = getDBQueryCache();
    return cache.getOrFetch(
        'projects',
        { projectId, queryName },
        fetchFn,
        { ttl, tags: [`project:${projectId}`, 'projects'] }
    );
}

/**
 * Cache wrapper for file queries
 */
export async function cacheFileQuery<T>(
    projectId: string,
    path: string | undefined,
    fetchFn: () => Promise<T>,
    ttl: number = QueryTTL.PROJECT_FILES
): Promise<T> {
    const cache = getDBQueryCache();
    return cache.getOrFetch(
        'files',
        { projectId, path },
        fetchFn,
        { ttl, tags: [`project:${projectId}:files`, `project:${projectId}`] }
    );
}

/**
 * Cache wrapper for build-related queries
 */
export async function cacheBuildQuery<T>(
    projectId: string,
    queryName: string,
    params: Record<string, unknown>,
    fetchFn: () => Promise<T>,
    ttl: number = QueryTTL.BUILD_PROGRESS
): Promise<T> {
    const cache = getDBQueryCache();
    return cache.getOrFetch(
        'builds',
        { projectId, queryName, ...params },
        fetchFn,
        { ttl, tags: [`project:${projectId}:builds`, `project:${projectId}`] }
    );
}

/**
 * Invalidate caches when data changes
 */
export const invalidateCache = {
    user: async (userId: string) => {
        const cache = getDBQueryCache();
        await cache.invalidateUserRelated(userId);
    },

    project: async (projectId: string) => {
        const cache = getDBQueryCache();
        await cache.invalidateProjectRelated(projectId);
    },

    projectFiles: async (projectId: string) => {
        const cache = getDBQueryCache();
        await cache.invalidateByTag(`project:${projectId}:files`);
    },

    table: async (table: string) => {
        const cache = getDBQueryCache();
        await cache.invalidateTable(table);
    },
};

export default {
    getDBQueryCache,
    QueryTTL,
    cacheUserQuery,
    cacheProjectQuery,
    cacheFileQuery,
    cacheBuildQuery,
    invalidateCache,
};
