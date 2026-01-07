/**
 * Health Check Routes
 * Comprehensive health monitoring for all infrastructure services
 */

import { Router, Request, Response } from 'express';
import { checkRedisHealth, getRedisStatus } from '../services/infrastructure/redis.js';
import { checkStorageHealth, getStorageStats } from '../services/infrastructure/storage.js';
import { checkJobQueueHealth, QueueNames } from '../services/infrastructure/job-queue.js';
import { checkCacheHealth } from '../services/performance/cache-service.js';
import { areWorkersInitialized } from '../workers/index.js';
import qdrantHealthRouter from './qdrant-health.js';

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    version: string;
    uptime: number;
    services: {
        [key: string]: {
            status: 'healthy' | 'unhealthy';
            latency?: number;
            details?: Record<string, unknown>;
            error?: string;
        };
    };
}

// Server start time for uptime calculation
const serverStartTime = Date.now();

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/health
 * Quick health check for load balancers and basic monitoring
 */
router.get('/', async (_req: Request, res: Response) => {
    try {
        const redis = await checkRedisHealth();

        if (redis.connected) {
            res.status(200).json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
            });
        } else {
            res.status(503).json({
                status: 'degraded',
                timestamp: new Date().toISOString(),
                message: 'Redis unavailable, running in fallback mode',
            });
        }
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/health/ready
 * Readiness probe - checks if the server is ready to accept traffic
 */
router.get('/ready', async (_req: Request, res: Response) => {
    try {
        // Check critical services
        const redis = await checkRedisHealth();
        const cache = await checkCacheHealth();

        const isReady = redis.connected || cache.healthy;

        if (isReady) {
            res.status(200).json({
                ready: true,
                timestamp: new Date().toISOString(),
            });
        } else {
            res.status(503).json({
                ready: false,
                timestamp: new Date().toISOString(),
                message: 'Service not ready',
            });
        }
    } catch (error) {
        res.status(503).json({
            ready: false,
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/health/live
 * Liveness probe - checks if the server is running
 */
router.get('/live', (_req: Request, res: Response) => {
    res.status(200).json({
        alive: true,
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    });
});

/**
 * GET /api/health/detailed
 * Comprehensive health check with all service statuses
 */
router.get('/detailed', async (_req: Request, res: Response) => {
    try {
        const startTime = Date.now();

        // Check all services in parallel
        const [redis, storage, jobQueue, cache] = await Promise.all([
            checkRedisHealth(),
            checkStorageHealth(),
            checkJobQueueHealth(),
            checkCacheHealth(),
        ]);

        const services: HealthStatus['services'] = {
            redis: {
                status: redis.connected ? 'healthy' : 'unhealthy',
                latency: redis.latency,
                details: {
                    ...getRedisStatus(),
                },
                error: redis.error,
            },
            storage: {
                status: storage.healthy ? 'healthy' : 'unhealthy',
                details: {
                    type: storage.type,
                },
                error: storage.error,
            },
            jobQueue: {
                status: jobQueue.healthy ? 'healthy' : 'unhealthy',
                details: {
                    queues: jobQueue.queues.length,
                    totalJobs: jobQueue.queues.reduce(
                        (sum, q) => sum + q.counts.active + q.counts.waiting + q.counts.delayed,
                        0
                    ),
                },
                error: jobQueue.error,
            },
            cache: {
                status: cache.healthy ? 'healthy' : 'unhealthy',
                details: {
                    backend: cache.backend,
                    entries: cache.stats.entries,
                    hitRate: `${(cache.stats.hitRate * 100).toFixed(1)}%`,
                },
            },
            workers: {
                status: areWorkersInitialized() ? 'healthy' : 'unhealthy',
                details: {
                    initialized: areWorkersInitialized(),
                },
            },
        };

        // Determine overall status
        const healthyCount = Object.values(services).filter(s => s.status === 'healthy').length;
        const totalServices = Object.keys(services).length;

        let overallStatus: HealthStatus['status'];
        if (healthyCount === totalServices) {
            overallStatus = 'healthy';
        } else if (healthyCount >= totalServices / 2) {
            overallStatus = 'degraded';
        } else {
            overallStatus = 'unhealthy';
        }

        const health: HealthStatus = {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0',
            uptime: Math.floor((Date.now() - serverStartTime) / 1000),
            services,
        };

        const statusCode = overallStatus === 'unhealthy' ? 503 : 200;
        res.status(statusCode).json(health);
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/health/redis
 * Detailed Redis health check
 */
router.get('/redis', async (_req: Request, res: Response) => {
    try {
        const health = await checkRedisHealth();
        const status = getRedisStatus();

        res.status(health.connected ? 200 : 503).json({
            service: 'redis',
            status: health.connected ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            details: {
                connected: health.connected,
                mode: status.mode, // 'vercel-kv', 'upstash-direct', or 'mock'
                latency: health.latency,
                lastError: status.lastError,
                productionReady: status.mode !== 'mock',
            },
            error: health.error,
        });
    } catch (error) {
        res.status(500).json({
            service: 'redis',
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/health/storage
 * Detailed storage health check
 */
router.get('/storage', async (_req: Request, res: Response) => {
    try {
        const health = await checkStorageHealth();
        const stats = await getStorageStats();

        res.status(health.healthy ? 200 : 503).json({
            service: 'storage',
            status: health.healthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            details: {
                type: health.type,
                filesCount: stats.filesCount,
                totalSize: stats.totalSize,
                totalSizeMB: (stats.totalSize / 1024 / 1024).toFixed(2),
            },
            error: health.error,
        });
    } catch (error) {
        res.status(500).json({
            service: 'storage',
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/health/queues
 * Detailed job queue health check
 */
router.get('/queues', async (_req: Request, res: Response) => {
    try {
        const health = await checkJobQueueHealth();

        res.status(health.healthy ? 200 : 503).json({
            service: 'job-queue',
            status: health.healthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            queues: health.queues.map(q => ({
                name: q.name,
                counts: q.counts,
            })),
            error: health.error,
        });
    } catch (error) {
        res.status(500).json({
            service: 'job-queue',
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/health/cache
 * Detailed cache health check
 */
router.get('/cache', async (_req: Request, res: Response) => {
    try {
        const health = await checkCacheHealth();

        res.status(health.healthy ? 200 : 503).json({
            service: 'cache',
            status: health.healthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            details: {
                backend: health.backend,
                entries: health.stats.entries,
                hitRate: `${(health.stats.hitRate * 100).toFixed(1)}%`,
            },
        });
    } catch (error) {
        res.status(500).json({
            service: 'cache',
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/health/metrics
 * Prometheus-compatible metrics endpoint
 */
router.get('/metrics', async (_req: Request, res: Response) => {
    try {
        const [redis, storage, jobQueue, cache] = await Promise.all([
            checkRedisHealth(),
            checkStorageHealth(),
            checkJobQueueHealth(),
            checkCacheHealth(),
        ]);

        const storageStats = await getStorageStats();
        const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);

        // Format as Prometheus metrics
        const metrics = [
            '# HELP kriptik_up Server up status',
            '# TYPE kriptik_up gauge',
            'kriptik_up 1',
            '',
            '# HELP kriptik_uptime_seconds Server uptime in seconds',
            '# TYPE kriptik_uptime_seconds counter',
            `kriptik_uptime_seconds ${uptimeSeconds}`,
            '',
            '# HELP kriptik_redis_connected Redis connection status',
            '# TYPE kriptik_redis_connected gauge',
            `kriptik_redis_connected ${redis.connected ? 1 : 0}`,
            '',
            '# HELP kriptik_redis_latency_ms Redis latency in milliseconds',
            '# TYPE kriptik_redis_latency_ms gauge',
            `kriptik_redis_latency_ms ${redis.latency || 0}`,
            '',
            '# HELP kriptik_storage_healthy Storage health status',
            '# TYPE kriptik_storage_healthy gauge',
            `kriptik_storage_healthy ${storage.healthy ? 1 : 0}`,
            '',
            '# HELP kriptik_storage_files_total Total files in storage',
            '# TYPE kriptik_storage_files_total gauge',
            `kriptik_storage_files_total ${storageStats.filesCount}`,
            '',
            '# HELP kriptik_storage_bytes_total Total storage size in bytes',
            '# TYPE kriptik_storage_bytes_total gauge',
            `kriptik_storage_bytes_total ${storageStats.totalSize}`,
            '',
            '# HELP kriptik_cache_healthy Cache health status',
            '# TYPE kriptik_cache_healthy gauge',
            `kriptik_cache_healthy ${cache.healthy ? 1 : 0}`,
            '',
            '# HELP kriptik_cache_entries_total Total cache entries',
            '# TYPE kriptik_cache_entries_total gauge',
            `kriptik_cache_entries_total ${cache.stats.entries}`,
            '',
            '# HELP kriptik_cache_hit_rate Cache hit rate',
            '# TYPE kriptik_cache_hit_rate gauge',
            `kriptik_cache_hit_rate ${cache.stats.hitRate}`,
            '',
            '# HELP kriptik_workers_initialized Workers initialization status',
            '# TYPE kriptik_workers_initialized gauge',
            `kriptik_workers_initialized ${areWorkersInitialized() ? 1 : 0}`,
            '',
        ];

        // Add job queue metrics
        for (const queue of jobQueue.queues) {
            metrics.push(
                `# HELP kriptik_queue_${queue.name.replace(/-/g, '_')}_active Active jobs in queue`,
                `# TYPE kriptik_queue_${queue.name.replace(/-/g, '_')}_active gauge`,
                `kriptik_queue_${queue.name.replace(/-/g, '_')}_active ${queue.counts.active}`,
                `# HELP kriptik_queue_${queue.name.replace(/-/g, '_')}_waiting Waiting jobs in queue`,
                `# TYPE kriptik_queue_${queue.name.replace(/-/g, '_')}_waiting gauge`,
                `kriptik_queue_${queue.name.replace(/-/g, '_')}_waiting ${queue.counts.waiting}`,
                `# HELP kriptik_queue_${queue.name.replace(/-/g, '_')}_completed Completed jobs in queue`,
                `# TYPE kriptik_queue_${queue.name.replace(/-/g, '_')}_completed counter`,
                `kriptik_queue_${queue.name.replace(/-/g, '_')}_completed ${queue.counts.completed}`,
                `# HELP kriptik_queue_${queue.name.replace(/-/g, '_')}_failed Failed jobs in queue`,
                `# TYPE kriptik_queue_${queue.name.replace(/-/g, '_')}_failed counter`,
                `kriptik_queue_${queue.name.replace(/-/g, '_')}_failed ${queue.counts.failed}`,
                ''
            );
        }

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(metrics.join('\n'));
    } catch (error) {
        res.status(500).send(`# Error generating metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});

// =============================================================================
// QDRANT VECTOR DATABASE HEALTH
// =============================================================================

// Mount Qdrant health routes as sub-router
router.use('/qdrant', qdrantHealthRouter);

export { router as healthRouter };
