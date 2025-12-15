/**
 * Rate Limiter Middleware
 *
 * Implements sliding window rate limiting for API endpoints using Upstash Redis.
 * Supports tiered limits based on user subscription level.
 */

import { Request, Response, NextFunction } from 'express';
import { Ratelimit } from '@upstash/ratelimit';
import { getRedis } from '../services/infrastructure/redis.js';

// ============================================================================
// TYPES
// ============================================================================

export type UserTier = 'free' | 'pro' | 'enterprise' | 'unlimited';

interface RateLimitConfig {
    windowMs: number;      // Time window in milliseconds
    maxRequests: number;   // Max requests per window
    message?: string;      // Custom error message
}

interface RateLimitEntry {
    count: number;
    resetTime: number;
    firstRequest: number;
}

// ============================================================================
// RATE LIMIT CONFIGURATIONS
// ============================================================================

const TIER_LIMITS: Record<UserTier, RateLimitConfig> = {
    free: {
        windowMs: 60 * 1000,  // 1 minute
        maxRequests: 10,
        message: 'Rate limit exceeded. Upgrade to Pro for higher limits.',
    },
    pro: {
        windowMs: 60 * 1000,
        maxRequests: 50,
        message: 'Rate limit exceeded. Contact support for enterprise limits.',
    },
    enterprise: {
        windowMs: 60 * 1000,
        maxRequests: 200,
        message: 'Rate limit exceeded. Please try again shortly.',
    },
    unlimited: {
        windowMs: 60 * 1000,
        maxRequests: Infinity,
        message: '',
    },
};

// Route-specific limits (override tier limits for specific routes)
const ROUTE_LIMITS: Record<string, RateLimitConfig> = {
    '/api/ai/generate': {
        windowMs: 60 * 1000,
        maxRequests: 5,  // AI generation is expensive
        message: 'Generation rate limit exceeded. Please wait before generating more.',
    },
    '/api/orchestrate': {
        windowMs: 60 * 1000,
        maxRequests: 3,  // Full orchestration is very expensive
        message: 'Orchestration rate limit exceeded. Please wait before starting another build.',
    },
    '/api/autonomous': {
        windowMs: 60 * 1000,
        maxRequests: 2,  // Autonomous building is the most expensive
        message: 'Autonomous build limit exceeded. Please wait for current build to complete.',
    },
};

// ============================================================================
// UPSTASH RATE LIMITERS
// ============================================================================

// Create rate limiters for each tier using Upstash
const rateLimiters: Map<string, Ratelimit> = new Map();

function getUpstashRateLimiter(tier: UserTier, route?: string): Ratelimit | null {
    const key = route ? `${tier}:${route}` : tier;

    if (!rateLimiters.has(key)) {
        try {
            const redis = getRedis();
            const config = route ? ROUTE_LIMITS[route] : TIER_LIMITS[tier];

            if (!config || config.maxRequests === Infinity) {
                return null;
            }

            // Convert to Upstash format (requests per window)
            const windowSeconds = Math.ceil(config.windowMs / 1000);

            const limiter = new Ratelimit({
                redis,
                limiter: Ratelimit.slidingWindow(config.maxRequests, `${windowSeconds} s`),
                analytics: true,
                prefix: `kriptik:ratelimit:${key}`,
            });

            rateLimiters.set(key, limiter);
        } catch (error) {
            console.warn('[RateLimiter] Failed to create Upstash rate limiter, falling back to in-memory:', error);
            return null;
        }
    }

    return rateLimiters.get(key) || null;
}

// ============================================================================
// FALLBACK IN-MEMORY STORE
// ============================================================================

class RateLimitStore {
    private store: Map<string, RateLimitEntry> = new Map();
    private cleanupInterval: NodeJS.Timeout;

    constructor() {
        // Clean up expired entries every minute
        this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
    }

    get(key: string): RateLimitEntry | undefined {
        return this.store.get(key);
    }

    set(key: string, entry: RateLimitEntry): void {
        this.store.set(key, entry);
    }

    delete(key: string): void {
        this.store.delete(key);
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (now > entry.resetTime) {
                this.store.delete(key);
            }
        }
    }

    stop(): void {
        clearInterval(this.cleanupInterval);
    }
}

// Singleton store instance for fallback
const fallbackStore = new RateLimitStore();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get user tier from request (via auth or subscription)
 */
function getUserTier(req: Request): UserTier {
    const user = (req as Request & { user?: { tier?: UserTier; subscription?: string } }).user;

    if (!user) {
        return 'free';
    }

    // Check subscription status
    if (user.subscription === 'enterprise' || user.tier === 'enterprise') {
        return 'enterprise';
    }
    if (user.subscription === 'pro' || user.tier === 'pro') {
        return 'pro';
    }
    if (user.tier === 'unlimited') {
        return 'unlimited';
    }

    return 'free';
}

/**
 * Get user identifier for rate limiting
 */
function getUserIdentifier(req: Request): string {
    const user = (req as Request & { user?: { id?: string } }).user;

    // Prefer user ID if authenticated
    if (user?.id) {
        return `user:${user.id}`;
    }

    // Fall back to IP address
    const ip = req.ip ||
               req.headers['x-forwarded-for']?.toString().split(',')[0] ||
               req.socket.remoteAddress ||
               'unknown';

    return `ip:${ip}`;
}

/**
 * Get rate limit config for a route
 */
function getRouteLimit(path: string): RateLimitConfig | null {
    // Check for exact match first
    if (ROUTE_LIMITS[path]) {
        return ROUTE_LIMITS[path];
    }

    // Check for prefix matches
    for (const [route, config] of Object.entries(ROUTE_LIMITS)) {
        if (path.startsWith(route)) {
            return config;
        }
    }

    return null;
}

/**
 * Get tier multiplier for route-specific limits
 */
function getTierMultiplier(tier: UserTier): number {
    switch (tier) {
        case 'enterprise': return 5;
        case 'pro': return 2;
        case 'free': return 1;
        case 'unlimited': return Infinity;
        default: return 1;
    }
}

/**
 * Set standard rate limit headers
 */
function setRateLimitHeaders(
    res: Response,
    limit: number,
    remaining: number,
    resetTime: number
): void {
    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());
}

// ============================================================================
// MIDDLEWARE FACTORY
// ============================================================================

/**
 * Create a rate limiter middleware with Upstash Redis
 */
export function createRateLimiter(options?: Partial<RateLimitConfig>) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const identifier = getUserIdentifier(req);
        const tier = getUserTier(req);
        const path = req.path;

        // Unlimited tier bypasses rate limiting
        if (tier === 'unlimited') {
            return next();
        }

        // Get applicable rate limit config
        const routeLimit = getRouteLimit(path);
        const tierLimit = TIER_LIMITS[tier];

        // Route-specific limits multiply with tier limits
        const effectiveConfig: RateLimitConfig = {
            windowMs: options?.windowMs || routeLimit?.windowMs || tierLimit.windowMs,
            maxRequests: options?.maxRequests ||
                (routeLimit ? Math.min(routeLimit.maxRequests * getTierMultiplier(tier), tierLimit.maxRequests) : tierLimit.maxRequests),
            message: routeLimit?.message || tierLimit.message,
        };

        if (effectiveConfig.maxRequests === Infinity) {
            return next();
        }

        // Try Upstash rate limiter first
        const upstashLimiter = getUpstashRateLimiter(tier, routeLimit ? path : undefined);

        if (upstashLimiter) {
            try {
                const result = await upstashLimiter.limit(identifier);

                setRateLimitHeaders(res, result.limit, result.remaining, result.reset);

                if (!result.success) {
                    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
                    res.setHeader('Retry-After', retryAfter.toString());
                    res.status(429).json({
                        error: 'Too Many Requests',
                        message: effectiveConfig.message,
                        retryAfter,
                        limit: result.limit,
                        remaining: 0,
                        resetAt: new Date(result.reset).toISOString(),
                    });
                    return;
                }

                return next();
            } catch (error) {
                console.warn('[RateLimiter] Upstash rate limit check failed, falling back to in-memory:', error);
                // Fall through to in-memory fallback
            }
        }

        // Fallback to in-memory rate limiting
        const now = Date.now();
        const key = `${identifier}:${path}`;
        let entry = fallbackStore.get(key);

        // Initialize or reset if window expired
        if (!entry || now > entry.resetTime) {
            entry = {
                count: 1,
                resetTime: now + effectiveConfig.windowMs,
                firstRequest: now,
            };
            fallbackStore.set(key, entry);

            setRateLimitHeaders(
                res,
                effectiveConfig.maxRequests,
                effectiveConfig.maxRequests - 1,
                entry.resetTime
            );
            return next();
        }

        // Increment count
        entry.count++;
        fallbackStore.set(key, entry);

        const remaining = Math.max(0, effectiveConfig.maxRequests - entry.count);
        setRateLimitHeaders(res, effectiveConfig.maxRequests, remaining, entry.resetTime);

        // Check if over limit
        if (entry.count > effectiveConfig.maxRequests) {
            const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

            res.setHeader('Retry-After', retryAfter.toString());
            res.status(429).json({
                error: 'Too Many Requests',
                message: effectiveConfig.message,
                retryAfter,
                limit: effectiveConfig.maxRequests,
                remaining: 0,
                resetAt: new Date(entry.resetTime).toISOString(),
            });
            return;
        }

        next();
    };
}

// ============================================================================
// SPECIALIZED RATE LIMITERS
// ============================================================================

/**
 * Rate limiter for AI generation endpoints
 */
export const aiRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 5,
});

/**
 * Rate limiter for orchestration endpoints
 */
export const orchestrationRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 3,
});

/**
 * Rate limiter for autonomous building
 */
export const autonomousRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 2,
});

/**
 * General API rate limiter
 */
export const generalRateLimiter = createRateLimiter();

/**
 * Strict rate limiter for sensitive operations
 */
export const strictRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 3,
});

// ============================================================================
// COST-BASED RATE LIMITING
// ============================================================================

interface CostEntry {
    totalCost: number;
    resetTime: number;
}

const costStore = new Map<string, CostEntry>();

/**
 * Cost-based rate limiter for AI operations
 * Limits based on estimated token costs
 */
export function createCostBasedLimiter(maxCostPerWindow: number, windowMs: number = 3600000) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const identifier = getUserIdentifier(req);
        const tier = getUserTier(req);

        // Adjust max cost based on tier
        const adjustedMaxCost = maxCostPerWindow * getTierMultiplier(tier);

        if (tier === 'unlimited') {
            return next();
        }

        // Try to get cost from Redis first
        try {
            const redis = getRedis();
            const key = `cost:${identifier}`;
            const now = Date.now();

            const stored = await redis.get<CostEntry>(key);
            let entry = stored;

            if (!entry || now > entry.resetTime) {
                entry = {
                    totalCost: 0,
                    resetTime: now + windowMs,
                };
            }

            // Check if over cost limit
            if (entry.totalCost >= adjustedMaxCost) {
                const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

                res.status(429).json({
                    error: 'Cost Limit Exceeded',
                    message: 'You have exceeded your usage limit for this period.',
                    retryAfter,
                    currentCost: entry.totalCost.toFixed(4),
                    maxCost: adjustedMaxCost.toFixed(4),
                    resetAt: new Date(entry.resetTime).toISOString(),
                });
                return;
            }

            // Attach cost tracking to response
            (res as Response & { trackCost?: (cost: number) => void }).trackCost = async (cost: number) => {
                entry!.totalCost += cost;
                const ttl = Math.ceil((entry!.resetTime - Date.now()) / 1000);
                await redis.set(key, entry!, { ex: ttl > 0 ? ttl : windowMs / 1000 });
            };

            const ttl = Math.ceil((entry.resetTime - now) / 1000);
            await redis.set(key, entry, { ex: ttl > 0 ? ttl : windowMs / 1000 });

            next();
        } catch (error) {
            // Fallback to in-memory
            const now = Date.now();
            let entry = costStore.get(identifier);

            if (!entry || now > entry.resetTime) {
                entry = {
                    totalCost: 0,
                    resetTime: now + windowMs,
                };
            }

            // Check if over cost limit
            if (entry.totalCost >= adjustedMaxCost) {
                const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

                res.status(429).json({
                    error: 'Cost Limit Exceeded',
                    message: 'You have exceeded your usage limit for this period.',
                    retryAfter,
                    currentCost: entry.totalCost.toFixed(4),
                    maxCost: adjustedMaxCost.toFixed(4),
                    resetAt: new Date(entry.resetTime).toISOString(),
                });
                return;
            }

            // Attach cost tracking to response
            (res as Response & { trackCost?: (cost: number) => void }).trackCost = (cost: number) => {
                entry!.totalCost += cost;
                costStore.set(identifier, entry!);
            };

            costStore.set(identifier, entry);
            next();
        }
    };
}

/**
 * AI cost-based limiter
 * Free: $0.50/hour, Pro: $5/hour, Enterprise: $50/hour
 */
export const aiCostLimiter = createCostBasedLimiter(0.5, 3600000);

// ============================================================================
// EXPORTS
// ============================================================================

export {
    TIER_LIMITS,
    ROUTE_LIMITS,
    getUserTier,
    getUserIdentifier,
};
