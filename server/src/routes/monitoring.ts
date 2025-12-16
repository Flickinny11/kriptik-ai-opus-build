/**
 * Monitoring Routes
 *
 * API endpoints for monitoring, health checks, and observability.
 * Provides real-time system health, metrics, alerts, and logs.
 */

import { Router, Request, Response } from 'express';
import {
    getMonitoringService,
    getSystemHealth,
    type LogLevel,
} from '../services/infrastructure/monitoring-service.js';

const router = Router();

// ============================================================================
// HEALTH CHECK ENDPOINTS
// ============================================================================

/**
 * GET /api/monitoring/health
 * Quick health check endpoint
 */
router.get('/health', async (_req: Request, res: Response) => {
    try {
        const health = await getSystemHealth();

        const statusCode = health.overall === 'healthy' ? 200
            : health.overall === 'degraded' ? 200
            : 503;

        return res.status(statusCode).json({
            status: health.overall,
            timestamp: new Date(health.timestamp).toISOString(),
            components: health.components.map(c => ({
                name: c.name,
                status: c.status,
                latency: c.latency,
            })),
        });
    } catch (error) {
        console.error('[Monitoring/Health] Error:', error);
        return res.status(500).json({
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/monitoring/health/detailed
 * Detailed health check with full component information
 */
router.get('/health/detailed', async (_req: Request, res: Response) => {
    try {
        const health = await getSystemHealth();

        const statusCode = health.overall === 'healthy' ? 200
            : health.overall === 'degraded' ? 200
            : 503;

        return res.status(statusCode).json(health);
    } catch (error) {
        console.error('[Monitoring/Health/Detailed] Error:', error);
        return res.status(500).json({
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

// ============================================================================
// METRICS ENDPOINTS
// ============================================================================

/**
 * GET /api/monitoring/metrics
 * Get current performance metrics
 */
router.get('/metrics', async (_req: Request, res: Response) => {
    try {
        const service = getMonitoringService();
        const metrics = service.getPerformanceMetrics();

        return res.json({
            timestamp: new Date().toISOString(),
            metrics: {
                requestsPerSecond: Math.round(metrics.requestsPerSecond * 100) / 100,
                responseTime: {
                    avg: Math.round(metrics.avgResponseTime),
                    p50: Math.round(metrics.p50ResponseTime),
                    p95: Math.round(metrics.p95ResponseTime),
                    p99: Math.round(metrics.p99ResponseTime),
                },
                errorRate: Math.round(metrics.errorRate * 10000) / 100, // as percentage
                activeConnections: metrics.activeConnections,
            },
        });
    } catch (error) {
        console.error('[Monitoring/Metrics] Error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/monitoring/metrics/:name
 * Get historical metrics for a specific metric name
 */
router.get('/metrics/:name', async (req: Request<{ name: string }>, res: Response) => {
    try {
        const { name } = req.params;
        const hours = parseInt(req.query.hours as string) || 1;
        const startTime = Date.now() - (hours * 60 * 60 * 1000);

        const service = getMonitoringService();
        const series = await service.getMetrics(name, startTime);

        return res.json({
            name,
            timeRange: {
                start: new Date(startTime).toISOString(),
                end: new Date().toISOString(),
            },
            points: series.points,
            aggregates: series.aggregates,
        });
    } catch (error) {
        console.error('[Monitoring/Metrics/:name] Error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

// ============================================================================
// ALERTS ENDPOINTS
// ============================================================================

/**
 * GET /api/monitoring/alerts
 * Get active alerts
 */
router.get('/alerts', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const service = getMonitoringService();
        const alerts = await service.getAlerts(limit);

        return res.json({
            timestamp: new Date().toISOString(),
            count: alerts.length,
            alerts: alerts.map(a => ({
                ...a,
                timestamp: new Date(a.timestamp).toISOString(),
            })),
        });
    } catch (error) {
        console.error('[Monitoring/Alerts] Error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/monitoring/alerts/:id/acknowledge
 * Acknowledge an alert
 */
router.post('/alerts/:id/acknowledge', async (req: Request<{ id: string }>, res: Response) => {
    try {
        const { id } = req.params;
        const service = getMonitoringService();
        const success = await service.acknowledgeAlert(id);

        if (success) {
            return res.json({ success: true, message: 'Alert acknowledged' });
        } else {
            return res.status(404).json({ success: false, message: 'Alert not found' });
        }
    } catch (error) {
        console.error('[Monitoring/Alerts/Acknowledge] Error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

// ============================================================================
// LOGS ENDPOINTS
// ============================================================================

/**
 * GET /api/monitoring/logs
 * Get recent logs
 */
router.get('/logs', async (req: Request, res: Response) => {
    try {
        const level = req.query.level as LogLevel | undefined;
        const limit = parseInt(req.query.limit as string) || 100;

        const service = getMonitoringService();
        const logs = await service.getLogs(level, limit);

        return res.json({
            timestamp: new Date().toISOString(),
            count: logs.length,
            logs: logs.map(l => ({
                ...l,
                timestamp: new Date(l.timestamp).toISOString(),
            })),
        });
    } catch (error) {
        console.error('[Monitoring/Logs] Error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

// ============================================================================
// DASHBOARD ENDPOINT
// ============================================================================

/**
 * GET /api/monitoring/dashboard
 * Get all monitoring data for dashboard display
 */
router.get('/dashboard', async (req: Request, res: Response) => {
    try {
        const service = getMonitoringService();

        const [health, alerts, logs] = await Promise.all([
            getSystemHealth(),
            service.getAlerts(10),
            service.getLogs(undefined, 20),
        ]);

        const metrics = service.getPerformanceMetrics();

        return res.json({
            timestamp: new Date().toISOString(),
            health: {
                overall: health.overall,
                components: health.components.map(c => ({
                    name: c.name,
                    status: c.status,
                    latency: c.latency,
                })),
            },
            metrics: {
                requestsPerSecond: Math.round(metrics.requestsPerSecond * 100) / 100,
                avgResponseTime: Math.round(metrics.avgResponseTime),
                p95ResponseTime: Math.round(metrics.p95ResponseTime),
                errorRate: Math.round(metrics.errorRate * 10000) / 100,
                activeConnections: metrics.activeConnections,
            },
            alerts: {
                count: alerts.filter(a => !a.acknowledged).length,
                recent: alerts.slice(0, 5).map(a => ({
                    level: a.level,
                    component: a.component,
                    message: a.message,
                    acknowledged: a.acknowledged,
                })),
            },
            logs: {
                recentErrors: logs
                    .filter(l => l.level === 'error' || l.level === 'fatal')
                    .slice(0, 5)
                    .map(l => ({
                        level: l.level,
                        message: l.message,
                        timestamp: new Date(l.timestamp).toISOString(),
                    })),
            },
        });
    } catch (error) {
        console.error('[Monitoring/Dashboard] Error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

export default router;
