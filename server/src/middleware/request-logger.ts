/**
 * Request Logger Middleware
 *
 * Express middleware for comprehensive request/response logging and metrics.
 * Integrates with the monitoring service for centralized observability.
 *
 * Features:
 * - Request/response logging with timing
 * - Automatic performance metric recording
 * - Error tracking
 * - Request ID generation for tracing
 * - Configurable log levels by route
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { recordRequest, log, logError } from '../services/infrastructure/monitoring-service.js';

// ============================================================================
// TYPES
// ============================================================================

export interface RequestLoggerConfig {
    logLevel: 'minimal' | 'standard' | 'verbose';
    excludePaths: string[];
    slowRequestThresholdMs: number;
    logRequestBody: boolean;
    logResponseBody: boolean;
    maxBodyLogLength: number;
}

declare global {
    namespace Express {
        interface Request {
            requestId?: string;
            startTime?: number;
        }
    }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: RequestLoggerConfig = {
    logLevel: 'standard',
    excludePaths: ['/health', '/api/health', '/api/cron/health', '/favicon.ico'],
    slowRequestThresholdMs: 1000,
    logRequestBody: false,
    logResponseBody: false,
    maxBodyLogLength: 1000,
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

export function createRequestLogger(config: Partial<RequestLoggerConfig> = {}) {
    const cfg: RequestLoggerConfig = { ...DEFAULT_CONFIG, ...config };

    return function requestLogger(req: Request, res: Response, next: NextFunction): void {
        // Skip excluded paths
        if (cfg.excludePaths.some(path => req.path.startsWith(path))) {
            next();
            return;
        }

        // Generate request ID
        const requestId = req.headers['x-request-id'] as string || randomUUID();
        req.requestId = requestId;
        req.startTime = Date.now();

        // Set request ID in response headers for tracing
        res.setHeader('X-Request-ID', requestId);

        // Log request start
        const requestContext: Record<string, unknown> = {
            requestId,
            method: req.method,
            path: req.path,
            query: Object.keys(req.query).length > 0 ? req.query : undefined,
            userAgent: req.headers['user-agent'],
            ip: req.ip || req.headers['x-forwarded-for'],
            userId: req.user?.id,
        };

        if (cfg.logRequestBody && req.body && Object.keys(req.body).length > 0) {
            requestContext.body = truncate(JSON.stringify(req.body), cfg.maxBodyLogLength);
        }

        if (cfg.logLevel === 'verbose') {
            log('debug', `Request started: ${req.method} ${req.path}`, requestContext);
        }

        // Capture response
        const originalSend = res.send;
        let responseBody: unknown;

        res.send = function (body): Response {
            responseBody = body;
            return originalSend.call(this, body);
        };

        // Log on finish
        res.on('finish', () => {
            const duration = Date.now() - (req.startTime || Date.now());
            const isError = res.statusCode >= 400;
            const isSlow = duration > cfg.slowRequestThresholdMs;

            // Record metrics
            recordRequest(duration, isError);

            // Build response context
            const responseContext: Record<string, unknown> = {
                requestId,
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                duration,
                userId: req.user?.id,
            };

            if (cfg.logResponseBody && responseBody && cfg.logLevel === 'verbose') {
                const bodyStr = typeof responseBody === 'string'
                    ? responseBody
                    : JSON.stringify(responseBody);
                responseContext.responseBody = truncate(bodyStr, cfg.maxBodyLogLength);
            }

            // Determine log level
            if (isError) {
                log('error', `Request failed: ${req.method} ${req.path} ${res.statusCode}`, responseContext);
            } else if (isSlow) {
                log('warn', `Slow request: ${req.method} ${req.path} (${duration}ms)`, responseContext);
            } else if (cfg.logLevel !== 'minimal') {
                log('info', `Request completed: ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`, responseContext);
            }
        });

        // Handle errors
        res.on('error', (error: Error) => {
            const duration = Date.now() - (req.startTime || Date.now());
            recordRequest(duration, true);

            logError(`Request error: ${req.method} ${req.path}`, error, {
                requestId,
                method: req.method,
                path: req.path,
                duration,
                userId: req.user?.id,
            });
        });

        next();
    };
}

// ============================================================================
// ERROR HANDLER MIDDLEWARE
// ============================================================================

export function errorLogger(
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const duration = Date.now() - (req.startTime || Date.now());

    // Record as error
    recordRequest(duration, true);

    // Log error
    logError(`Unhandled error: ${req.method} ${req.path}`, error, {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode || 500,
        duration,
        userId: req.user?.id,
        query: req.query,
    });

    next(error);
}

// ============================================================================
// HELPERS
// ============================================================================

function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength) + '... [truncated]';
}

// ============================================================================
// EXPORTS
// ============================================================================

export const requestLogger = createRequestLogger();

export default {
    createRequestLogger,
    requestLogger,
    errorLogger,
};
