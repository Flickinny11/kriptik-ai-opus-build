/**
 * Rate Limiter Middleware
 *
 * =======================================================================
 * CREDIT-BASED ARCHITECTURE (December 2025)
 * =======================================================================
 *
 * PHILOSOPHY:
 * - Authenticated users: NO request rate limits
 *   → The credit ceiling system handles all usage limits
 *   → Complex builds need thousands of API calls - don't block them
 *   → Let users build freely within their credit budget
 *
 * - Unauthenticated users: Minimal anti-abuse limits only
 *   → Prevents basic DDoS/abuse from anonymous traffic
 *   → Very permissive - just blocks obvious abuse patterns
 *
 * COST CONTROL:
 * - Credit Ceiling System (server/src/services/billing/credit-ceiling.ts)
 *   → Per-build credit limits
 *   → Warning popup at 75%, 90%, 100%
 *   → Integrated with Ghost Mode for autonomous building
 *
 * This is better because:
 * 1. A 6-agent verification swarm making 100 requests/minute is NORMAL
 * 2. Complex builds can use 1,000-4,000 API calls - don't limit that
 * 3. Credit system provides fair usage control based on actual cost
 * 4. Users pay for what they use, not penalized for complexity
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

// CREDIT-BASED ARCHITECTURE: Authenticated users bypass rate limits
// The credit ceiling system handles usage control
const TIER_LIMITS: Record<UserTier, RateLimitConfig> = {
    free: {
        windowMs: 60 * 1000,
        maxRequests: Infinity,  // NO rate limit - credit ceiling handles limits
        message: '',
    },
    pro: {
        windowMs: 60 * 1000,
        maxRequests: Infinity,  // NO rate limit - credit ceiling handles limits
        message: '',
    },
    enterprise: {
        windowMs: 60 * 1000,
        maxRequests: Infinity,  // NO rate limit - credit ceiling handles limits
        message: '',
    },
    unlimited: {
        windowMs: 60 * 1000,
        maxRequests: Infinity,
        message: '',
    },
};

// ANTI-ABUSE LIMITS for unauthenticated traffic only
// These are very permissive - just blocking obvious abuse
const UNAUTHENTICATED_LIMITS: RateLimitConfig = {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 100,     // 100 requests/minute for anonymous users
    message: 'Please sign in to continue. Anonymous rate limit exceeded.',
};

// Route-specific limits removed - credit ceiling handles all limits
// Keeping structure for backwards compatibility but all set to Infinity
const ROUTE_LIMITS: Record<string, RateLimitConfig> = {
    '/api/ai/generate': {
        windowMs: 60 * 1000,
        maxRequests: Infinity,  // Credit ceiling handles this
        message: '',
    },
    '/api/orchestrate': {
        windowMs: 60 * 1000,
        maxRequests: Infinity,  // Credit ceiling handles this
        message: '',
    },
    '/api/autonomous': {
        windowMs: 60 * 1000,
        maxRequests: Infinity,  // Credit ceiling handles this
        message: '',
    },
    '/api/krip-toe-nite': {
        windowMs: 60 * 1000,
        maxRequests: Infinity,  // Credit ceiling handles this
        message: '',
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
 *
 * CREDIT-BASED ARCHITECTURE:
 * - Authenticated users: BYPASS rate limits (credit ceiling handles limits)
 * - Unauthenticated users: Minimal anti-abuse limits only
 */
export function createRateLimiter(options?: Partial<RateLimitConfig>) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const identifier = getUserIdentifier(req);
        const tier = getUserTier(req);
        const isAuthenticated = identifier.startsWith('user:');

        // AUTHENTICATED USERS: No rate limits - credit ceiling handles everything
        // This allows complex builds with 1,000+ API calls per build
        if (isAuthenticated) {
            return next();
        }

        // UNAUTHENTICATED USERS: Apply minimal anti-abuse limits
        const effectiveConfig = options?.maxRequests
            ? { ...UNAUTHENTICATED_LIMITS, maxRequests: options.maxRequests }
            : UNAUTHENTICATED_LIMITS;

        if (effectiveConfig.maxRequests === Infinity) {
            return next();
        }

        const path = req.path;

        // Try Upstash rate limiter first (for unauthenticated users only)
        const upstashLimiter = getUpstashRateLimiter('free'); // Use free tier for anonymous

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

        // Fallback to in-memory rate limiting for unauthenticated users
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

// CREDIT-BASED ARCHITECTURE: These are now passthroughs for authenticated users
// Only apply limits to unauthenticated traffic

/**
 * Rate limiter for AI generation endpoints
 * Authenticated users: BYPASSED (credit ceiling handles limits)
 * Unauthenticated: 100 req/min anti-abuse
 */
export const aiRateLimiter = createRateLimiter();

/**
 * Rate limiter for orchestration endpoints
 * Authenticated users: BYPASSED (credit ceiling handles limits)
 * Unauthenticated: 100 req/min anti-abuse
 */
export const orchestrationRateLimiter = createRateLimiter();

/**
 * Rate limiter for autonomous building
 * Authenticated users: BYPASSED (credit ceiling handles limits)
 * Unauthenticated: 100 req/min anti-abuse
 */
export const autonomousRateLimiter = createRateLimiter();

/**
 * General API rate limiter
 * Authenticated users: BYPASSED (credit ceiling handles limits)
 * Unauthenticated: 100 req/min anti-abuse
 */
export const generalRateLimiter = createRateLimiter();

/**
 * Strict rate limiter for sensitive operations
 * APPLIES TO ALL USERS (including authenticated) for security-critical operations
 * (password reset, account deletion, payment operations, etc.)
 */
export function createStrictRateLimiter(maxRequests: number = 10) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const identifier = getUserIdentifier(req);
        const now = Date.now();
        const windowMs = 60 * 1000;
        const key = `strict:${identifier}:${req.path}`;

        let entry = fallbackStore.get(key);

        if (!entry || now > entry.resetTime) {
            entry = {
                count: 1,
                resetTime: now + windowMs,
                firstRequest: now,
            };
            fallbackStore.set(key, entry);
            setRateLimitHeaders(res, maxRequests, maxRequests - 1, entry.resetTime);
            return next();
        }

        entry.count++;
        fallbackStore.set(key, entry);

        const remaining = Math.max(0, maxRequests - entry.count);
        setRateLimitHeaders(res, maxRequests, remaining, entry.resetTime);

        if (entry.count > maxRequests) {
            const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
            res.setHeader('Retry-After', retryAfter.toString());
            res.status(429).json({
                error: 'Too Many Requests',
                message: 'Rate limit exceeded for sensitive operation. Please wait.',
                retryAfter,
                limit: maxRequests,
                remaining: 0,
                resetAt: new Date(entry.resetTime).toISOString(),
            });
            return;
        }

        next();
    };
}

export const strictRateLimiter = createStrictRateLimiter(10);

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
