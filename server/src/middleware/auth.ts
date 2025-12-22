/**
 * Authentication Middleware
 *
 * Provides Express middleware for authenticating requests using better-auth
 * with Redis session caching for horizontal scalability.
 */

import { Request, Response, NextFunction } from 'express';
import { auth } from '../auth.js';
import {
    getSessionService,
    cacheExistingSession,
    type CachedSession,
    type UserData,
    type SessionData,
} from '../services/infrastructure/session-service.js';

function getCookieValue(cookieHeader: string | undefined, name: string): string | undefined {
    if (!cookieHeader) return undefined;
    // cookie header format: "a=b; c=d; ..."
    const parts = cookieHeader.split(';');
    for (const part of parts) {
        const [k, ...rest] = part.trim().split('=');
        if (!k) continue;
        if (k === name) return rest.join('='); // value may contain '='
    }
    return undefined;
}

// User type for authenticated requests
export interface AuthUser {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    createdAt: Date;
    updatedAt: Date;
}

// Session type for authenticated requests
export interface AuthSession {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
            session?: AuthSession;
        }
    }
}

// Type alias for authenticated requests (request with user guaranteed)
export interface AuthenticatedRequest extends Request {
    user: AuthUser;
    session?: AuthSession;
}

/**
 * Authentication middleware
 * Validates the session and attaches user to request
 */
export async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        // Get token from Authorization header or cookie
        const authHeader = req.headers.authorization;
        const cookieHeader = req.headers.cookie;
        // Support both Better Auth default and our configured cookiePrefix (see server/src/auth.ts)
        const cookieToken =
            getCookieValue(cookieHeader, 'kriptik_auth.session_token') ||
            getCookieValue(cookieHeader, 'better-auth.session_token');

        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

        if (!token && !cookieHeader) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'No authentication token provided'
            });
            return;
        }

        // Validate session with better-auth
        // Note: better-auth handles session validation internally
        // For now, we'll decode the session from the database
        const session = await validateSession({ token, cookieHeader, origin: req.headers.origin as string | undefined });

        if (!session) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid or expired session'
            });
            return;
        }

        // Attach user and session to request
        req.user = session.user;
        req.session = session.session;

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Authentication failed'
        });
    }
}

/**
 * Optional authentication middleware
 * Doesn't require authentication but attaches user if present
 */
export async function optionalAuthMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const authHeader = req.headers.authorization;
        const cookieHeader = req.headers.cookie;
        const cookieToken =
            getCookieValue(cookieHeader, 'kriptik_auth.session_token') ||
            getCookieValue(cookieHeader, 'better-auth.session_token');

        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

        if (token || cookieHeader) {
            const session = await validateSession({ token, cookieHeader, origin: req.headers.origin as string | undefined });
            if (session) {
                req.user = session.user;
                req.session = session.session;
            }
        }

        next();
    } catch (error) {
        // Continue without authentication on error
        console.warn('Optional auth check failed:', error);
        next();
    }
}

type SessionValidationParams = { token?: string; cookieHeader?: string; origin?: string };

/**
 * Validate session using Redis cache first (fast path),
 * then fall back to better-auth database lookup (slow path).
 * This reduces database load significantly for authenticated requests.
 */
async function validateSession(params: SessionValidationParams): Promise<{
    user: Express.Request['user'];
    session: Express.Request['session'];
} | null> {
    try {
        // FAST PATH: Try Redis cache first for token-based auth
        if (params.token) {
            const sessionService = getSessionService();
            const cached = await sessionService.getSession(params.token);

            if (cached) {
                return {
                    user: {
                        id: cached.user.id,
                        email: cached.user.email,
                        name: cached.user.name,
                        image: cached.user.image,
                        createdAt: new Date(cached.user.createdAt),
                        updatedAt: new Date(cached.user.updatedAt),
                    },
                    session: {
                        id: cached.session.id,
                        userId: cached.session.userId,
                        token: cached.session.token,
                        expiresAt: new Date(cached.session.expiresAt),
                        createdAt: new Date(cached.session.createdAt),
                        updatedAt: new Date(cached.session.updatedAt),
                    },
                };
            }
        }

        // SLOW PATH: Fall back to better-auth (database lookup)
        const headers: Record<string, string> = {};
        if (params.token) headers['Authorization'] = `Bearer ${params.token}`;
        if (params.cookieHeader) headers['Cookie'] = params.cookieHeader;
        if (params.origin) headers['Origin'] = params.origin;

        const response = await auth.api.getSession({ headers: new Headers(headers) });

        if (!response?.session || !response?.user) {
            return null;
        }

        // Cache the session in Redis for future requests
        if (params.token) {
            const sessionData: SessionData = {
                id: response.session.id,
                userId: response.session.userId,
                token: response.session.token,
                expiresAt: response.session.expiresAt.getTime(),
                createdAt: response.session.createdAt.getTime(),
                updatedAt: response.session.updatedAt.getTime(),
            };

            const userData: UserData = {
                id: response.user.id,
                email: response.user.email,
                name: response.user.name,
                image: response.user.image,
                createdAt: response.user.createdAt.getTime(),
                updatedAt: response.user.updatedAt.getTime(),
            };

            // Non-blocking cache write
            cacheExistingSession(params.token, sessionData, userData).catch((err) => {
                console.warn('[Auth] Failed to cache session:', err);
            });
        }

        return {
            user: {
                id: response.user.id,
                email: response.user.email,
                name: response.user.name,
                image: response.user.image,
                createdAt: response.user.createdAt,
                updatedAt: response.user.updatedAt,
            },
            session: {
                id: response.session.id,
                userId: response.session.userId,
                token: response.session.token,
                expiresAt: response.session.expiresAt,
                createdAt: response.session.createdAt,
                updatedAt: response.session.updatedAt,
            },
        };
    } catch (error) {
        console.error('Session validation error:', error);
        return null;
    }
}

/**
 * Require specific roles middleware
 */
export function requireRole(...roles: string[]) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // First ensure user is authenticated
        if (!req.user) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required'
            });
            return;
        }

        // For now, all authenticated users have access
        // Role-based access can be added when roles are implemented
        // in the user schema
        next();
    };
}

export default authMiddleware;

