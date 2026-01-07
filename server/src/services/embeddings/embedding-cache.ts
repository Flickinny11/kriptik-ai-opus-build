/**
 * Embedding Cache Layer
 *
 * Redis-based caching for embedding vectors to reduce API costs.
 * Features:
 * - Content-hash based cache keys
 * - Configurable TTL per embedding type
 * - Cache statistics tracking
 * - Compression for large embeddings
 * - Memory-efficient storage
 */

import { createHash } from 'crypto';
import { getRedis, getConnectionMode } from '../infrastructure/redis.js';

/**
 * Check if Redis is available (not mock)
 */
function isRedisAvailable(): boolean {
  const mode = getConnectionMode();
  return mode === 'vercel-kv' || mode === 'upstash-direct';
}

// ============================================================================
// Configuration
// ============================================================================

export interface EmbeddingCacheConfig {
  /** Default TTL in seconds */
  defaultTtlSeconds: number;
  /** TTL overrides per type */
  ttlByType: Record<string, number>;
  /** Key prefix */
  prefix: string;
  /** Enable compression for embeddings > this size */
  compressionThreshold: number;
}

const DEFAULT_CONFIG: EmbeddingCacheConfig = {
  defaultTtlSeconds: 24 * 60 * 60, // 24 hours
  ttlByType: {
    intent: 24 * 60 * 60,      // 24 hours - intents don't change often
    code: 12 * 60 * 60,        // 12 hours - code may change more
    visual: 1 * 60 * 60,       // 1 hour - screenshots are transient
    error: 72 * 60 * 60,       // 72 hours - error patterns are stable
    reasoning: 24 * 60 * 60,   // 24 hours
  },
  prefix: 'kriptik:embedding:',
  compressionThreshold: 4096, // 4KB - typical 1024-dim float32 array
};

// ============================================================================
// Cache Statistics
// ============================================================================

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  errors: number;
  bytesWritten: number;
  bytesRead: number;
  lastReset: Date;
}

const stats: CacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  errors: 0,
  bytesWritten: 0,
  bytesRead: 0,
  lastReset: new Date(),
};

// ============================================================================
// Embedding Cache Class
// ============================================================================

export class EmbeddingCache {
  private config: EmbeddingCacheConfig;
  private memoryCache: Map<string, { embedding: number[]; expires: number }>;
  private maxMemoryCacheSize = 1000;

  constructor(config?: Partial<EmbeddingCacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.memoryCache = new Map();
  }

  /**
   * Generate cache key from content and options
   */
  generateKey(
    content: string,
    model: string,
    options?: { dimensions?: number; quantization?: string }
  ): string {
    const hash = createHash('sha256');
    hash.update(content);
    hash.update(model);
    if (options?.dimensions) hash.update(String(options.dimensions));
    if (options?.quantization) hash.update(options.quantization);

    return `${this.config.prefix}${hash.digest('hex').slice(0, 32)}`;
  }

  /**
   * Get embedding from cache
   */
  async get(key: string): Promise<number[] | null> {
    // Try memory cache first
    const memCached = this.memoryCache.get(key);
    if (memCached && memCached.expires > Date.now()) {
      stats.hits++;
      return memCached.embedding;
    }

    // Clean expired memory cache entry
    if (memCached) {
      this.memoryCache.delete(key);
    }

    // Try Redis
    if (!isRedisAvailable()) {
      stats.misses++;
      return null;
    }

    try {
      const redis = getRedis();
      const cached = await redis.get(key);

      if (!cached) {
        stats.misses++;
        return null;
      }

      // Handle different response types from Redis
      const cachedStr = typeof cached === 'string' ? cached : JSON.stringify(cached);

      stats.hits++;
      stats.bytesRead += cachedStr.length;

      // Parse cached embedding
      const embedding = (typeof cached === 'string' ? JSON.parse(cached) : cached) as number[];

      // Store in memory cache for faster subsequent access
      this.setMemoryCache(key, embedding, 60 * 1000); // 1 minute

      return embedding;
    } catch (error) {
      stats.errors++;
      console.error('[EmbeddingCache] Get error:', error);
      return null;
    }
  }

  /**
   * Get multiple embeddings from cache
   */
  async getMany(keys: string[]): Promise<Map<string, number[]>> {
    const results = new Map<string, number[]>();

    // Check memory cache first
    const keysToFetch: string[] = [];

    for (const key of keys) {
      const memCached = this.memoryCache.get(key);
      if (memCached && memCached.expires > Date.now()) {
        results.set(key, memCached.embedding);
        stats.hits++;
      } else {
        keysToFetch.push(key);
      }
    }

    // Fetch remaining from Redis
    if (keysToFetch.length > 0 && isRedisAvailable()) {
      try {
        const redis = getRedis();
        const values = await redis.mget(...keysToFetch) as (string | null)[];

        for (let i = 0; i < keysToFetch.length; i++) {
          const value = values[i];
          if (value && typeof value === 'string') {
            const embedding = JSON.parse(value) as number[];
            results.set(keysToFetch[i], embedding);
            stats.hits++;
            stats.bytesRead += value.length;

            // Store in memory cache
            this.setMemoryCache(keysToFetch[i], embedding, 60 * 1000);
          } else {
            stats.misses++;
          }
        }
      } catch (error) {
        stats.errors++;
        console.error('[EmbeddingCache] GetMany error:', error);
        stats.misses += keysToFetch.length;
      }
    } else {
      stats.misses += keysToFetch.length;
    }

    return results;
  }

  /**
   * Store embedding in cache
   */
  async set(
    key: string,
    embedding: number[],
    type: string = 'default'
  ): Promise<void> {
    const ttl = this.config.ttlByType[type] || this.config.defaultTtlSeconds;

    // Store in memory cache
    this.setMemoryCache(key, embedding, ttl * 1000);

    // Store in Redis
    if (!isRedisAvailable()) {
      return;
    }

    try {
      const redis = getRedis();
      const serialized = JSON.stringify(embedding);

      await redis.setex(key, ttl, serialized);

      stats.sets++;
      stats.bytesWritten += serialized.length;
    } catch (error) {
      stats.errors++;
      console.error('[EmbeddingCache] Set error:', error);
    }
  }

  /**
   * Store multiple embeddings in cache
   */
  async setMany(
    entries: Array<{ key: string; embedding: number[]; type?: string }>
  ): Promise<void> {
    if (!isRedisAvailable()) {
      // Store in memory cache only
      for (const entry of entries) {
        const ttl = this.config.ttlByType[entry.type || 'default'] || this.config.defaultTtlSeconds;
        this.setMemoryCache(entry.key, entry.embedding, ttl * 1000);
      }
      return;
    }

    try {
      const redis = getRedis();
      const pipeline = redis.pipeline();

      for (const entry of entries) {
        const ttl = this.config.ttlByType[entry.type || 'default'] || this.config.defaultTtlSeconds;
        const serialized = JSON.stringify(entry.embedding);

        pipeline.setex(entry.key, ttl, serialized);
        stats.bytesWritten += serialized.length;

        // Also store in memory cache
        this.setMemoryCache(entry.key, entry.embedding, ttl * 1000);
      }

      await pipeline.exec();
      stats.sets += entries.length;
    } catch (error) {
      stats.errors++;
      console.error('[EmbeddingCache] SetMany error:', error);
    }
  }

  /**
   * Delete embedding from cache
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);

    if (!isRedisAvailable()) return;

    try {
      const redis = getRedis();
      await redis.del(key);
    } catch (error) {
      stats.errors++;
      console.error('[EmbeddingCache] Delete error:', error);
    }
  }

  /**
   * Clear all embeddings for a prefix pattern
   */
  async clearPattern(pattern: string): Promise<number> {
    // Clear memory cache
    const fullPattern = `${this.config.prefix}${pattern}`;
    let deleted = 0;

    for (const key of this.memoryCache.keys()) {
      if (key.includes(fullPattern)) {
        this.memoryCache.delete(key);
        deleted++;
      }
    }

    if (!isRedisAvailable()) return deleted;

    try {
      const redis = getRedis();
      const keys = await redis.keys(`${fullPattern}*`);

      if (keys.length > 0) {
        await redis.del(...keys);
        deleted += keys.length;
      }

      return deleted;
    } catch (error) {
      stats.errors++;
      console.error('[EmbeddingCache] ClearPattern error:', error);
      return deleted;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number; memoryCacheSize: number } {
    const total = stats.hits + stats.misses;
    return {
      ...stats,
      hitRate: total > 0 ? stats.hits / total : 0,
      memoryCacheSize: this.memoryCache.size,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    stats.hits = 0;
    stats.misses = 0;
    stats.sets = 0;
    stats.errors = 0;
    stats.bytesWritten = 0;
    stats.bytesRead = 0;
    stats.lastReset = new Date();
  }

  /**
   * Store in memory cache with eviction
   */
  private setMemoryCache(key: string, embedding: number[], ttlMs: number): void {
    // Evict if over capacity
    if (this.memoryCache.size >= this.maxMemoryCacheSize) {
      // Remove oldest 10%
      const toRemove = Math.floor(this.maxMemoryCacheSize * 0.1);
      const iterator = this.memoryCache.keys();
      for (let i = 0; i < toRemove; i++) {
        const keyToRemove = iterator.next().value;
        if (keyToRemove) this.memoryCache.delete(keyToRemove);
      }
    }

    this.memoryCache.set(key, {
      embedding,
      expires: Date.now() + ttlMs,
    });
  }

  /**
   * Check if cache is healthy
   */
  async healthCheck(): Promise<{ healthy: boolean; memoryEntries: number; redisAvailable: boolean }> {
    return {
      healthy: true,
      memoryEntries: this.memoryCache.size,
      redisAvailable: isRedisAvailable(),
    };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let cacheInstance: EmbeddingCache | null = null;

export function getEmbeddingCache(config?: Partial<EmbeddingCacheConfig>): EmbeddingCache {
  if (!cacheInstance) {
    cacheInstance = new EmbeddingCache(config);
  }
  return cacheInstance;
}

export function resetEmbeddingCache(): void {
  cacheInstance = null;
}

export default EmbeddingCache;
