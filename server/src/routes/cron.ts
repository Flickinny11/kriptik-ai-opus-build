/**
 * Cron Job Routes
 *
 * Scheduled task endpoints for Vercel Cron Jobs.
 * Handles periodic maintenance tasks for scalability.
 */

import { Router, Request, Response } from 'express';
import { getDBQueryCache } from '../services/performance/db-query-cache.js';
import { getRequestQueue } from '../services/infrastructure/request-queue.js';
import { getSSEManager } from '../services/infrastructure/sse-manager.js';
import { getMemoryManager } from '../services/infrastructure/memory-manager.js';
import { checkDBHealth, getDBMetrics } from '../db-resilient.js';
import { checkRedisHealth } from '../services/infrastructure/redis.js';
import { getCreditPoolService } from '../services/billing/credit-pool.js';

const router = Router();

// Verify cron requests are from Vercel
const verifyCronRequest = (req: Request): boolean => {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    // In development, allow all requests
    if (process.env.NODE_ENV !== 'production') {
        return true;
    }

    // Check for Vercel cron header
    if (req.headers['x-vercel-cron'] === '1') {
        return true;
    }

    // Check for secret if configured
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
        return true;
    }

    return false;
};

/**
 * GET /api/cron/cleanup
 * Periodic cleanup of expired data and caches
 */
router.get('/cleanup', async (req: Request, res: Response) => {
    if (!verifyCronRequest(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const startTime = Date.now();
    const results: Record<string, unknown> = {};

    try {
        // 1. Clean up DB query cache
        try {
            const dbCache = getDBQueryCache();
            const stats = dbCache.getStats();
            results.dbCacheStats = stats;
        } catch (error) {
            results.dbCacheError = error instanceof Error ? error.message : String(error);
        }

        // 2. Clean up request queue
        try {
            const requestQueue = getRequestQueue();
            const cleaned = await requestQueue.cleanup();
            results.requestQueueCleaned = cleaned;
        } catch (error) {
            results.requestQueueError = error instanceof Error ? error.message : String(error);
        }

        // 3. Force memory cleanup
        try {
            const memoryManager = getMemoryManager();
            const freed = await memoryManager.runCleanup(true);
            results.memoryFreed = freed;
            results.memoryStats = memoryManager.getStats();
        } catch (error) {
            results.memoryError = error instanceof Error ? error.message : String(error);
        }

        // 4. Record credit pool snapshot
        try {
            const poolService = getCreditPoolService();
            await poolService.recordDailySnapshot();
            results.poolSnapshotRecorded = true;
        } catch (error) {
            results.poolError = error instanceof Error ? error.message : String(error);
        }

        const duration = Date.now() - startTime;

        return res.json({
            success: true,
            duration,
            results,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[Cron/Cleanup] Error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - startTime,
        });
    }
});

/**
 * GET /api/cron/health
 * Health check for monitoring and alerting
 */
router.get('/health', async (req: Request, res: Response) => {
    if (!verifyCronRequest(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const startTime = Date.now();
    const health: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        server: 'healthy',
    };

    let allHealthy = true;

    try {
        // 1. Database health
        try {
            const dbHealth = await checkDBHealth();
            health.database = dbHealth;
            if (!dbHealth.healthy) allHealthy = false;
        } catch (error) {
            health.database = {
                healthy: false,
                error: error instanceof Error ? error.message : String(error),
            };
            allHealthy = false;
        }

        // 2. Redis health
        try {
            const redisHealth = await checkRedisHealth();
            health.redis = redisHealth;
            if (!redisHealth.connected) allHealthy = false;
        } catch (error) {
            health.redis = {
                connected: false,
                error: error instanceof Error ? error.message : String(error),
            };
            allHealthy = false;
        }

        // 3. Database metrics
        try {
            const dbMetrics = getDBMetrics();
            health.dbMetrics = dbMetrics;
        } catch (error) {
            health.dbMetricsError = error instanceof Error ? error.message : String(error);
        }

        // 4. SSE connections
        try {
            const sseManager = getSSEManager();
            const sseStats = sseManager.getStats();
            health.sse = {
                totalConnections: sseStats.total,
                eventsSent: sseStats.eventsSent,
            };
        } catch (error) {
            health.sseError = error instanceof Error ? error.message : String(error);
        }

        // 5. Memory status
        try {
            const memoryManager = getMemoryManager();
            const pressureLevel = memoryManager.getPressureLevel();
            const memStats = memoryManager.getStats();
            health.memory = {
                pressureLevel,
                heapUsedMB: Math.round(memStats.heapUsed / (1024 * 1024)),
                heapTotalMB: Math.round(memStats.heapTotal / (1024 * 1024)),
            };
            if (pressureLevel === 'critical') allHealthy = false;
        } catch (error) {
            health.memoryError = error instanceof Error ? error.message : String(error);
        }

        // 6. Credit pool health
        try {
            const poolService = getCreditPoolService();
            const poolHealth = await poolService.getHealth();
            health.creditPool = poolHealth;
            if (poolHealth.status === 'emergency' || poolHealth.status === 'critical') {
                allHealthy = false;
            }
        } catch (error) {
            health.creditPoolError = error instanceof Error ? error.message : String(error);
        }

        health.duration = Date.now() - startTime;
        health.overall = allHealthy ? 'healthy' : 'degraded';

        const statusCode = allHealthy ? 200 : 503;
        return res.status(statusCode).json(health);
    } catch (error) {
        console.error('[Cron/Health] Error:', error);
        return res.status(500).json({
            overall: 'unhealthy',
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - startTime,
        });
    }
});

/**
 * POST /api/cron/manual
 * Manually trigger cron tasks (admin only)
 */
router.post('/manual/:task', async (req: Request<{ task: string }>, res: Response) => {
    // This endpoint requires proper authentication
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // In production, check for admin role
    // For now, any authenticated user can trigger (should be restricted)

    const { task } = req.params;

    switch (task) {
        case 'cleanup':
            return res.redirect(307, '/api/cron/cleanup');

        case 'health':
            return res.redirect(307, '/api/cron/health');

        default:
            return res.status(400).json({ error: `Unknown task: ${task}` });
    }
});

export default router;
