/**
 * Cache Service
 * 
 * High-performance caching layer for AI responses, templates, and frequently
 * accessed data to improve speed and reduce API costs.
 */

import { createHash } from 'crypto';

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
}

interface CacheOptions {
    maxEntries?: number;
    maxMemoryMB?: number;
    defaultTTL?: number;  // seconds
    cleanupInterval?: number;  // seconds
}

// ============================================================================
// CACHE SERVICE
// ============================================================================

export class CacheService {
    private cache: Map<string, CacheEntry<unknown>> = new Map();
    private stats = {
        hits: 0,
        misses: 0,
    };
    private options: Required<CacheOptions>;
    private cleanupTimer?: NodeJS.Timeout;

    constructor(options: CacheOptions = {}) {
        this.options = {
            maxEntries: options.maxEntries ?? 10000,
            maxMemoryMB: options.maxMemoryMB ?? 256,
            defaultTTL: options.defaultTTL ?? 3600,  // 1 hour
            cleanupInterval: options.cleanupInterval ?? 300,  // 5 minutes
        };

        this.startCleanupTimer();
    }

    /**
     * Get a value from the cache
     */
    get<T>(key: string): T | undefined {
        const entry = this.cache.get(key) as CacheEntry<T> | undefined;

        if (!entry) {
            this.stats.misses++;
            return undefined;
        }

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.stats.misses++;
            return undefined;
        }

        entry.hits++;
        entry.lastAccessedAt = Date.now();
        this.stats.hits++;

        return entry.value;
    }

    /**
     * Set a value in the cache
     */
    set<T>(key: string, value: T, ttlSeconds?: number): void {
        const ttl = ttlSeconds ?? this.options.defaultTTL;
        const now = Date.now();
        const size = this.estimateSize(value);

        // Evict if necessary
        this.ensureSpace(size);

        const entry: CacheEntry<T> = {
            value,
            createdAt: now,
            expiresAt: now + ttl * 1000,
            hits: 0,
            lastAccessedAt: now,
            size,
        };

        this.cache.set(key, entry);
    }

    /**
     * Check if a key exists and is not expired
     */
    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }

    /**
     * Delete a key from the cache
     */
    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    /**
     * Clear all entries
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get or set pattern - fetch from cache or compute and store
     */
    async getOrSet<T>(
        key: string,
        computeFn: () => Promise<T>,
        ttlSeconds?: number
    ): Promise<T> {
        const cached = this.get<T>(key);
        if (cached !== undefined) {
            return cached;
        }

        const value = await computeFn();
        this.set(key, value, ttlSeconds);
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
    getStats(): CacheStats {
        let memoryUsed = 0;
        let oldestEntry = Date.now();
        let newestEntry = 0;

        for (const entry of this.cache.values()) {
            memoryUsed += entry.size;
            if (entry.createdAt < oldestEntry) oldestEntry = entry.createdAt;
            if (entry.createdAt > newestEntry) newestEntry = entry.createdAt;
        }

        const totalRequests = this.stats.hits + this.stats.misses;
        const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

        return {
            totalEntries: this.cache.size,
            totalHits: this.stats.hits,
            totalMisses: this.stats.misses,
            hitRate,
            memoryUsed,
            oldestEntry,
            newestEntry,
        };
    }

    /**
     * Invalidate entries matching a pattern
     */
    invalidatePattern(pattern: string): number {
        const regex = new RegExp(pattern);
        let deleted = 0;

        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
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
     * Ensure there's enough space for a new entry
     */
    private ensureSpace(neededSize: number): void {
        // Check entry count
        while (this.cache.size >= this.options.maxEntries) {
            this.evictLRU();
        }

        // Check memory
        const maxBytes = this.options.maxMemoryMB * 1024 * 1024;
        let currentSize = 0;
        for (const entry of this.cache.values()) {
            currentSize += entry.size;
        }

        while (currentSize + neededSize > maxBytes && this.cache.size > 0) {
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

        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccessedAt < lruTime) {
                lruTime = entry.lastAccessedAt;
                lruKey = key;
            }
        }

        if (lruKey) {
            const entry = this.cache.get(lruKey)!;
            this.cache.delete(lruKey);
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
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
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
            defaultTTL: 1800,  // 30 minutes
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
            defaultTTL: 7200,  // 2 hours
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
            defaultTTL: 3600,  // 1 hour
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

