/**
 * AI Request Deduplicator
 *
 * Prevents duplicate AI requests and caches responses for identical queries.
 * Critical for cost reduction and latency optimization at scale.
 *
 * Features:
 * - Request fingerprinting for deduplication
 * - Response caching with configurable TTL
 * - Request coalescing (multiple identical requests share one AI call)
 * - Cache warming for common queries
 * - Analytics on cache performance
 */

import { createHash } from 'crypto';
import { getRedis, CacheTTL } from '../infrastructure/redis.js';

// ============================================================================
// TYPES
// ============================================================================

export interface RequestFingerprint {
    hash: string;
    model: string;
    promptSignature: string;
    contextHash: string;
}

export interface CachedResponse {
    response: unknown;
    fingerprint: RequestFingerprint;
    cachedAt: number;
    expiresAt: number;
    hitCount: number;
    costSaved: number;  // Estimated cost saved in cents
}

export interface PendingRequest {
    fingerprint: RequestFingerprint;
    startedAt: number;
    waiters: Array<{
        resolve: (value: unknown) => void;
        reject: (error: Error) => void;
    }>;
}

export interface DedupeConfig {
    enabled: boolean;
    cacheTTL: number;           // Cache TTL in seconds
    maxCacheSize: number;       // Max cached responses
    coalesceWindow: number;     // Window for request coalescing (ms)
    minPromptLength: number;    // Min prompt length for caching
}

export interface DedupeStats {
    cacheHits: number;
    cacheMisses: number;
    coalescedRequests: number;
    cachedResponses: number;
    totalCostSaved: number;
    hitRate: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: DedupeConfig = {
    enabled: true,
    cacheTTL: 300,              // 5 minutes
    maxCacheSize: 10000,
    coalesceWindow: 5000,       // 5 second window for coalescing
    minPromptLength: 20,        // Don't cache very short prompts
};

const KEY_PREFIX = {
    cache: 'ai:cache:',
    pending: 'ai:pending:',
    stats: 'ai:dedupe:stats',
};

// Cost estimates per 1K tokens for savings calculation
const AVG_COST_PER_1K_TOKENS = 0.5; // cents

// ============================================================================
// DEDUPLICATOR CLASS
// ============================================================================

class RequestDeduplicator {
    private config: DedupeConfig;
    private pendingRequests: Map<string, PendingRequest> = new Map();
    private stats: DedupeStats = {
        cacheHits: 0,
        cacheMisses: 0,
        coalescedRequests: 0,
        cachedResponses: 0,
        totalCostSaved: 0,
        hitRate: 0,
    };

    constructor(config: Partial<DedupeConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Generate fingerprint for a request
     */
    generateFingerprint(params: {
        model: string;
        prompt: string;
        systemPrompt?: string;
        temperature?: number;
        context?: Record<string, unknown>;
    }): RequestFingerprint {
        // Create deterministic hash of request parameters
        const promptSignature = this.createPromptSignature(params.prompt, params.systemPrompt);
        const contextHash = params.context
            ? createHash('sha256').update(JSON.stringify(this.sortObject(params.context))).digest('hex').slice(0, 16)
            : 'none';

        // Include temperature in hash (different temps = different responses)
        const temp = params.temperature?.toFixed(2) ?? '0.70';

        const hashInput = `${params.model}:${promptSignature}:${contextHash}:${temp}`;
        const hash = createHash('sha256').update(hashInput).digest('hex').slice(0, 32);

        return {
            hash,
            model: params.model,
            promptSignature,
            contextHash,
        };
    }

    /**
     * Create prompt signature (handles variations in whitespace, etc.)
     */
    private createPromptSignature(prompt: string, systemPrompt?: string): string {
        // Normalize prompt
        const normalized = prompt
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();

        const systemNorm = systemPrompt
            ? systemPrompt.toLowerCase().replace(/\s+/g, ' ').trim()
            : '';

        const combined = `${systemNorm}|||${normalized}`;
        return createHash('sha256').update(combined).digest('hex').slice(0, 24);
    }

    /**
     * Sort object keys for consistent hashing
     */
    private sortObject(obj: Record<string, unknown>): Record<string, unknown> {
        return Object.keys(obj)
            .sort()
            .reduce((sorted, key) => {
                const value = obj[key];
                sorted[key] = value && typeof value === 'object' && !Array.isArray(value)
                    ? this.sortObject(value as Record<string, unknown>)
                    : value;
                return sorted;
            }, {} as Record<string, unknown>);
    }

    /**
     * Check cache for existing response
     */
    async getCached(fingerprint: RequestFingerprint): Promise<CachedResponse | null> {
        if (!this.config.enabled) return null;

        try {
            const redis = getRedis();
            const cached = await redis.get<CachedResponse>(`${KEY_PREFIX.cache}${fingerprint.hash}`);

            if (cached && Date.now() < cached.expiresAt) {
                // Update hit count
                cached.hitCount++;
                await redis.set(
                    `${KEY_PREFIX.cache}${fingerprint.hash}`,
                    cached,
                    { ex: Math.ceil((cached.expiresAt - Date.now()) / 1000) }
                );

                this.stats.cacheHits++;
                this.updateHitRate();
                return cached;
            }

            this.stats.cacheMisses++;
            this.updateHitRate();
            return null;
        } catch (error) {
            console.error('[Deduplicator] Cache get error:', error);
            return null;
        }
    }

    /**
     * Cache a response
     */
    async cacheResponse(
        fingerprint: RequestFingerprint,
        response: unknown,
        estimatedTokens: number
    ): Promise<void> {
        if (!this.config.enabled) return;

        try {
            const redis = getRedis();
            const now = Date.now();

            const cached: CachedResponse = {
                response,
                fingerprint,
                cachedAt: now,
                expiresAt: now + (this.config.cacheTTL * 1000),
                hitCount: 0,
                costSaved: Math.ceil((estimatedTokens / 1000) * AVG_COST_PER_1K_TOKENS),
            };

            await redis.set(
                `${KEY_PREFIX.cache}${fingerprint.hash}`,
                cached,
                { ex: this.config.cacheTTL }
            );

            this.stats.cachedResponses++;
        } catch (error) {
            console.error('[Deduplicator] Cache set error:', error);
        }
    }

    /**
     * Check if there's a pending request we can wait for (coalescing)
     */
    async checkPending(fingerprint: RequestFingerprint): Promise<{
        isPending: boolean;
        waitForResult: () => Promise<unknown>;
    } | null> {
        if (!this.config.enabled) return null;

        const pending = this.pendingRequests.get(fingerprint.hash);

        if (pending && Date.now() - pending.startedAt < this.config.coalesceWindow) {
            this.stats.coalescedRequests++;

            return {
                isPending: true,
                waitForResult: () => new Promise((resolve, reject) => {
                    pending.waiters.push({ resolve, reject });
                }),
            };
        }

        return null;
    }

    /**
     * Mark a request as pending (for coalescing)
     */
    markPending(fingerprint: RequestFingerprint): void {
        if (!this.config.enabled) return;

        this.pendingRequests.set(fingerprint.hash, {
            fingerprint,
            startedAt: Date.now(),
            waiters: [],
        });
    }

    /**
     * Complete a pending request (notify waiters)
     */
    completePending(fingerprint: RequestFingerprint, result: unknown, error?: Error): void {
        const pending = this.pendingRequests.get(fingerprint.hash);

        if (pending) {
            for (const waiter of pending.waiters) {
                if (error) {
                    waiter.reject(error);
                } else {
                    waiter.resolve(result);
                }
            }

            this.pendingRequests.delete(fingerprint.hash);
        }
    }

    /**
     * Execute with deduplication
     */
    async executeWithDedup<T>(
        params: {
            model: string;
            prompt: string;
            systemPrompt?: string;
            temperature?: number;
            context?: Record<string, unknown>;
            estimatedTokens?: number;
        },
        executor: () => Promise<T>
    ): Promise<{ result: T; fromCache: boolean; coalesced: boolean }> {
        // Skip deduplication for very short prompts
        if (params.prompt.length < this.config.minPromptLength) {
            const result = await executor();
            return { result, fromCache: false, coalesced: false };
        }

        const fingerprint = this.generateFingerprint(params);

        // Check cache first
        const cached = await this.getCached(fingerprint);
        if (cached) {
            this.stats.totalCostSaved += cached.costSaved;
            return {
                result: cached.response as T,
                fromCache: true,
                coalesced: false,
            };
        }

        // Check for pending request
        const pending = await this.checkPending(fingerprint);
        if (pending) {
            const result = await pending.waitForResult() as T;
            return { result, fromCache: false, coalesced: true };
        }

        // Mark as pending and execute
        this.markPending(fingerprint);

        try {
            const result = await executor();

            // Cache the result
            await this.cacheResponse(
                fingerprint,
                result,
                params.estimatedTokens ?? 1000
            );

            // Notify waiters
            this.completePending(fingerprint, result);

            return { result, fromCache: false, coalesced: false };
        } catch (error) {
            // Notify waiters of error
            this.completePending(fingerprint, null, error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    /**
     * Update hit rate calculation
     */
    private updateHitRate(): void {
        const total = this.stats.cacheHits + this.stats.cacheMisses;
        this.stats.hitRate = total > 0 ? this.stats.cacheHits / total : 0;
    }

    /**
     * Get deduplication statistics
     */
    getStats(): DedupeStats {
        return { ...this.stats };
    }

    /**
     * Clear cache
     */
    async clearCache(): Promise<number> {
        try {
            const redis = getRedis();
            const keys = await redis.keys(`${KEY_PREFIX.cache}*`);
            if (keys.length > 0) {
                await redis.del(...keys);
            }
            this.stats.cachedResponses = 0;
            return keys.length;
        } catch (error) {
            console.error('[Deduplicator] Clear cache error:', error);
            return 0;
        }
    }

    /**
     * Reset statistics
     */
    resetStats(): void {
        this.stats = {
            cacheHits: 0,
            cacheMisses: 0,
            coalescedRequests: 0,
            cachedResponses: 0,
            totalCostSaved: 0,
            hitRate: 0,
        };
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let deduplicator: RequestDeduplicator | null = null;

export function getDeduplicator(): RequestDeduplicator {
    if (!deduplicator) {
        deduplicator = new RequestDeduplicator();
    }
    return deduplicator;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Execute AI request with deduplication
 */
export async function executeWithDedup<T>(
    params: {
        model: string;
        prompt: string;
        systemPrompt?: string;
        temperature?: number;
        context?: Record<string, unknown>;
        estimatedTokens?: number;
    },
    executor: () => Promise<T>
): Promise<{ result: T; fromCache: boolean; coalesced: boolean }> {
    return getDeduplicator().executeWithDedup(params, executor);
}

/**
 * Get deduplication stats
 */
export function getDedupeStats(): DedupeStats {
    return getDeduplicator().getStats();
}

export default {
    getDeduplicator,
    executeWithDedup,
    getDedupeStats,
};
