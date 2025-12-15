/**
 * Cache Service
 *
 * High-performance caching layer backed by Redis for AI responses, templates,
 * and frequently accessed data to improve speed and reduce API costs.
 */

import { createHash } from 'crypto';
import { getRedis, CacheTTL } from '../infrastructure/redis.js';

// ============================================================================
// TYPES
// ============================================================================

interface CacheEntry<T> {
    value: T;
    createdAt: number;
    expiresAt: number;
    hits: number;
    lastAccessedAt: number;
    size: number;
}

interface CacheStats {
    totalEntries: number;
    totalHits: number;
    totalMisses: number;
    hitRate: number;
    memoryUsed: number;
    oldestEntry: number;
    newestEntry: number;
    backend: 'redis' | 'memory';
}

interface CacheOptions {
    maxEntries?: number;
    maxMemoryMB?: number;
    defaultTTL?: number;  // seconds
    cleanupInterval?: number;  // seconds
    keyPrefix?: string;
}

// ============================================================================
// CACHE SERVICE
// ============================================================================

export class CacheService {
    private memoryCache: Map<string, CacheEntry<unknown>> = new Map();
    private stats = {
        hits: 0,
        misses: 0,
    };
    private options: Required<CacheOptions>;
    private cleanupTimer?: NodeJS.Timeout;
    private useRedis: boolean = true;

    constructor(options: CacheOptions = {}) {
        this.options = {
            maxEntries: options.maxEntries ?? 10000,
            maxMemoryMB: options.maxMemoryMB ?? 256,
            defaultTTL: options.defaultTTL ?? 3600,  // 1 hour
            cleanupInterval: options.cleanupInterval ?? 300,  // 5 minutes
            keyPrefix: options.keyPrefix ?? 'cache',
        };

        this.startCleanupTimer();
    }

    /**
     * Get full Redis key with prefix
     */
    private getKey(key: string): string {
        return `${this.options.keyPrefix}:${key}`;
    }

    /**
     * Get a value from the cache
     */
    async get<T>(key: string): Promise<T | undefined> {
        const fullKey = this.getKey(key);

        // Try Redis first
        if (this.useRedis) {
            try {
                const redis = getRedis();
                const entry = await redis.get<CacheEntry<T>>(fullKey);

                if (!entry) {
                    this.stats.misses++;
                    return undefined;
                }

                if (Date.now() > entry.expiresAt) {
                    await redis.del(fullKey);
                    this.stats.misses++;
                    return undefined;
                }

                // Update hit stats in Redis
                entry.hits++;
                entry.lastAccessedAt = Date.now();
                const ttl = Math.ceil((entry.expiresAt - Date.now()) / 1000);
                if (ttl > 0) {
                    await redis.set(fullKey, entry, { ex: ttl });
                }

                this.stats.hits++;
                return entry.value;
            } catch (error) {
                console.warn('[CacheService] Redis get failed, falling back to memory:', error);
                this.useRedis = false;
            }
        }

        // Fallback to memory cache
        const entry = this.memoryCache.get(key) as CacheEntry<T> | undefined;

        if (!entry) {
            this.stats.misses++;
            return undefined;
        }

        if (Date.now() > entry.expiresAt) {
            this.memoryCache.delete(key);
            this.stats.misses++;
            return undefined;
        }

        entry.hits++;
        entry.lastAccessedAt = Date.now();
        this.stats.hits++;

        return entry.value;
    }

    /**
     * Get sync (memory only) - for backwards compatibility
     */
    getSync<T>(key: string): T | undefined {
        const entry = this.memoryCache.get(key) as CacheEntry<T> | undefined;

        if (!entry) {
            return undefined;
        }

        if (Date.now() > entry.expiresAt) {
            this.memoryCache.delete(key);
            return undefined;
        }

        entry.hits++;
        entry.lastAccessedAt = Date.now();

        return entry.value;
    }

    /**
     * Set a value in the cache
     */
    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
        const ttl = ttlSeconds ?? this.options.defaultTTL;
        const now = Date.now();
        const size = this.estimateSize(value);
        const fullKey = this.getKey(key);

        const entry: CacheEntry<T> = {
            value,
            createdAt: now,
            expiresAt: now + ttl * 1000,
            hits: 0,
            lastAccessedAt: now,
            size,
        };

        // Try Redis first
        if (this.useRedis) {
            try {
                const redis = getRedis();
                await redis.set(fullKey, entry, { ex: ttl });
                return;
            } catch (error) {
                console.warn('[CacheService] Redis set failed, falling back to memory:', error);
                this.useRedis = false;
            }
        }

        // Fallback to memory cache
        this.ensureSpace(size);
        this.memoryCache.set(key, entry);
    }

    /**
     * Set sync (memory only) - for backwards compatibility
     */
    setSync<T>(key: string, value: T, ttlSeconds?: number): void {
        const ttl = ttlSeconds ?? this.options.defaultTTL;
        const now = Date.now();
        const size = this.estimateSize(value);

        const entry: CacheEntry<T> = {
            value,
            createdAt: now,
            expiresAt: now + ttl * 1000,
            hits: 0,
            lastAccessedAt: now,
            size,
        };

        this.ensureSpace(size);
        this.memoryCache.set(key, entry);
    }

    /**
     * Check if a key exists and is not expired
     */
    async has(key: string): Promise<boolean> {
        const fullKey = this.getKey(key);

        if (this.useRedis) {
            try {
                const redis = getRedis();
                const exists = await redis.exists(fullKey);
                return exists > 0;
            } catch {
                this.useRedis = false;
            }
        }

        const entry = this.memoryCache.get(key);
        if (!entry) return false;
        if (Date.now() > entry.expiresAt) {
            this.memoryCache.delete(key);
            return false;
        }
        return true;
    }

    /**
     * Delete a key from the cache
     */
    async delete(key: string): Promise<boolean> {
        const fullKey = this.getKey(key);

        if (this.useRedis) {
            try {
                const redis = getRedis();
                const deleted = await redis.del(fullKey);
                return deleted > 0;
            } catch {
                this.useRedis = false;
            }
        }

        return this.memoryCache.delete(key);
    }

    /**
     * Clear all entries
     */
    async clear(): Promise<void> {
        if (this.useRedis) {
            try {
                const redis = getRedis();
                const keys = await redis.keys(`${this.options.keyPrefix}:*`);
                if (keys.length > 0) {
                    await redis.del(...keys);
                }
            } catch {
                this.useRedis = false;
            }
        }

        this.memoryCache.clear();
    }

    /**
     * Get or set pattern - fetch from cache or compute and store
     */
    async getOrSet<T>(
        key: string,
        computeFn: () => Promise<T>,
        ttlSeconds?: number
    ): Promise<T> {
        const cached = await this.get<T>(key);
        if (cached !== undefined) {
            return cached;
        }

        const value = await computeFn();
        await this.set(key, value, ttlSeconds);
        return value;
    }

    /**
     * Generate a cache key from parameters
     */
    generateKey(prefix: string, ...params: unknown[]): string {
        const data = JSON.stringify(params);
        const hash = createHash('sha256').update(data).digest('hex').slice(0, 16);
        return `${prefix}:${hash}`;
    }

    /**
     * Get cache statistics
     */
    async getStats(): Promise<CacheStats> {
        let memoryUsed = 0;
        let oldestEntry = Date.now();
        let newestEntry = 0;
        let totalEntries = 0;

        // Get Redis stats if available
        if (this.useRedis) {
            try {
                const redis = getRedis();
                const keys = await redis.keys(`${this.options.keyPrefix}:*`);
                totalEntries = keys.length;

                // Sample a few entries for stats
                const sampleKeys = keys.slice(0, 100);
                for (const key of sampleKeys) {
                    const entry = await redis.get<CacheEntry<unknown>>(key);
                    if (entry) {
                        memoryUsed += entry.size;
                        if (entry.createdAt < oldestEntry) oldestEntry = entry.createdAt;
                        if (entry.createdAt > newestEntry) newestEntry = entry.createdAt;
                    }
                }

                // Extrapolate memory usage
                if (sampleKeys.length > 0) {
                    memoryUsed = (memoryUsed / sampleKeys.length) * totalEntries;
                }
            } catch {
                this.useRedis = false;
            }
        }

        // Include memory cache stats
        for (const entry of this.memoryCache.values()) {
            memoryUsed += entry.size;
            if (entry.createdAt < oldestEntry) oldestEntry = entry.createdAt;
            if (entry.createdAt > newestEntry) newestEntry = entry.createdAt;
        }
        totalEntries += this.memoryCache.size;

        const totalRequests = this.stats.hits + this.stats.misses;
        const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

        return {
            totalEntries,
            totalHits: this.stats.hits,
            totalMisses: this.stats.misses,
            hitRate,
            memoryUsed,
            oldestEntry,
            newestEntry,
            backend: this.useRedis ? 'redis' : 'memory',
        };
    }

    /**
     * Invalidate entries matching a pattern
     */
    async invalidatePattern(pattern: string): Promise<number> {
        let deleted = 0;

        if (this.useRedis) {
            try {
                const redis = getRedis();
                const fullPattern = `${this.options.keyPrefix}:*${pattern}*`;
                const keys = await redis.keys(fullPattern);

                for (const key of keys) {
                    await redis.del(key);
                    deleted++;
                }
            } catch {
                this.useRedis = false;
            }
        }

        // Also check memory cache
        const regex = new RegExp(pattern);
        for (const key of this.memoryCache.keys()) {
            if (regex.test(key)) {
                this.memoryCache.delete(key);
                deleted++;
            }
        }

        return deleted;
    }

    /**
     * Estimate the size of a value in bytes
     */
    private estimateSize(value: unknown): number {
        const json = JSON.stringify(value);
        return json ? json.length * 2 : 0;  // Rough estimate for UTF-16
    }

    /**
     * Ensure there's enough space for a new entry (memory only)
     */
    private ensureSpace(neededSize: number): void {
        // Check entry count
        while (this.memoryCache.size >= this.options.maxEntries) {
            this.evictLRU();
        }

        // Check memory
        const maxBytes = this.options.maxMemoryMB * 1024 * 1024;
        let currentSize = 0;
        for (const entry of this.memoryCache.values()) {
            currentSize += entry.size;
        }

        while (currentSize + neededSize > maxBytes && this.memoryCache.size > 0) {
            const evicted = this.evictLRU();
            if (evicted) {
                currentSize -= evicted.size;
            }
        }
    }

    /**
     * Evict the least recently used entry
     */
    private evictLRU(): CacheEntry<unknown> | null {
        let lruKey: string | null = null;
        let lruTime = Infinity;

        for (const [key, entry] of this.memoryCache.entries()) {
            if (entry.lastAccessedAt < lruTime) {
                lruTime = entry.lastAccessedAt;
                lruKey = key;
            }
        }

        if (lruKey) {
            const entry = this.memoryCache.get(lruKey)!;
            this.memoryCache.delete(lruKey);
            return entry;
        }

        return null;
    }

    /**
     * Start the cleanup timer
     */
    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.options.cleanupInterval * 1000);
    }

    /**
     * Clean up expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.memoryCache.entries()) {
            if (now > entry.expiresAt) {
                this.memoryCache.delete(key);
            }
        }
    }

    /**
     * Stop the cache service
     */
    stop(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
    }

    /**
     * Check if Redis is being used
     */
    isUsingRedis(): boolean {
        return this.useRedis;
    }
}

// ============================================================================
// SPECIALIZED CACHES
// ============================================================================

/**
 * Cache for AI model responses
 */
export class AIResponseCache extends CacheService {
    constructor() {
        super({
            maxEntries: 5000,
            maxMemoryMB: 128,
            defaultTTL: CacheTTL.MEDIUM,  // 5 minutes
            keyPrefix: 'ai-response',
        });
    }

    /**
     * Generate key for AI response cache
     */
    aiKey(model: string, prompt: string, options?: Record<string, unknown>): string {
        return this.generateKey('ai', model, prompt, options);
    }
}

/**
 * Cache for template matching results
 */
export class TemplateCache extends CacheService {
    constructor() {
        super({
            maxEntries: 1000,
            maxMemoryMB: 32,
            defaultTTL: CacheTTL.LONG,  // 1 hour
            keyPrefix: 'template',
        });
    }

    /**
     * Generate key for template match cache
     */
    matchKey(prompt: string): string {
        return this.generateKey('template-match', prompt.toLowerCase().trim());
    }
}

/**
 * Cache for model discovery results
 */
export class ModelDiscoveryCache extends CacheService {
    constructor() {
        super({
            maxEntries: 500,
            maxMemoryMB: 64,
            defaultTTL: CacheTTL.LONG,  // 1 hour
            keyPrefix: 'model-discovery',
        });
    }

    /**
     * Generate key for model discovery cache
     */
    discoveryKey(query: string, source?: string): string {
        return this.generateKey('model-discovery', query, source);
    }
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

let aiCache: AIResponseCache | null = null;
let templateCache: TemplateCache | null = null;
let modelCache: ModelDiscoveryCache | null = null;

export function getAIResponseCache(): AIResponseCache {
    if (!aiCache) {
        aiCache = new AIResponseCache();
    }
    return aiCache;
}

export function getTemplateCache(): TemplateCache {
    if (!templateCache) {
        templateCache = new TemplateCache();
    }
    return templateCache;
}

export function getModelDiscoveryCache(): ModelDiscoveryCache {
    if (!modelCache) {
        modelCache = new ModelDiscoveryCache();
    }
    return modelCache;
}

/**
 * Check cache service health
 */
export async function checkCacheHealth(): Promise<{
    healthy: boolean;
    backend: 'redis' | 'memory';
    stats: {
        entries: number;
        hitRate: number;
    };
}> {
    try {
        const cache = getAIResponseCache();
        const stats = await cache.getStats();

        return {
            healthy: true,
            backend: stats.backend,
            stats: {
                entries: stats.totalEntries,
                hitRate: stats.hitRate,
            },
        };
    } catch (error) {
        return {
            healthy: false,
            backend: 'memory',
            stats: {
                entries: 0,
                hitRate: 0,
            },
        };
    }
}
