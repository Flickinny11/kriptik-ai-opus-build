/**
 * Monitoring Service
 *
 * Centralized monitoring, metrics collection, and alerting for scalability.
 * Aggregates health data from all infrastructure components.
 *
 * Features:
 * - Unified health check aggregation
 * - Metrics collection and storage (Redis-backed)
 * - Threshold-based alerting
 * - Performance tracking
 * - Error rate monitoring
 * - Structured logging
 */

import { getRedis } from './redis.js';
import { checkDBHealth, getDBMetrics } from '../../db-resilient.js';
import { getSSEManager } from './sse-manager.js';
import { getMemoryManager } from './memory-manager.js';
import { getRequestQueue } from './request-queue.js';
import { getDBQueryCache } from '../performance/db-query-cache.js';

// ============================================================================
// TYPES
// ============================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface ComponentHealth {
    name: string;
    status: HealthStatus;
    latency?: number;
    details?: Record<string, unknown>;
    lastCheck: number;
    error?: string;
}

export interface SystemHealth {
    overall: HealthStatus;
    timestamp: number;
    components: ComponentHealth[];
    alerts: Alert[];
}

export interface Alert {
    id: string;
    level: 'warning' | 'critical';
    component: string;
    message: string;
    timestamp: number;
    acknowledged: boolean;
}

export interface Metric {
    name: string;
    value: number;
    unit: string;
    timestamp: number;
    tags?: Record<string, string>;
}

export interface MetricSeries {
    name: string;
    points: Array<{ timestamp: number; value: number }>;
    aggregates?: {
        min: number;
        max: number;
        avg: number;
        count: number;
    };
}

export interface PerformanceMetrics {
    requestsPerSecond: number;
    avgResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    activeConnections: number;
}

export interface AlertThresholds {
    errorRateWarning: number;
    errorRateCritical: number;
    responseTimeWarning: number;
    responseTimeCritical: number;
    memoryWarning: number;
    memoryCritical: number;
    connectionWarning: number;
    connectionCritical: number;
}

export interface MonitoringConfig {
    metricsRetentionHours: number;
    healthCheckIntervalMs: number;
    metricsCollectionIntervalMs: number;
    alertCooldownMs: number;
    thresholds: AlertThresholds;
}

export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: number;
    context?: Record<string, unknown>;
    component?: string;
    requestId?: string;
    userId?: string;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: MonitoringConfig = {
    metricsRetentionHours: 24,
    healthCheckIntervalMs: 30000,
    metricsCollectionIntervalMs: 10000,
    alertCooldownMs: 300000, // 5 minutes between duplicate alerts
    thresholds: {
        errorRateWarning: 0.01,      // 1%
        errorRateCritical: 0.05,     // 5%
        responseTimeWarning: 1000,   // 1 second
        responseTimeCritical: 5000,  // 5 seconds
        memoryWarning: 70,           // 70% heap
        memoryCritical: 85,          // 85% heap
        connectionWarning: 8000,     // SSE connections
        connectionCritical: 9500,
    },
};

const KEY_PREFIX = {
    metrics: 'monitor:metrics:',
    health: 'monitor:health:',
    alerts: 'monitor:alerts:',
    logs: 'monitor:logs:',
};

// ============================================================================
// MONITORING SERVICE CLASS
// ============================================================================

class MonitoringService {
    private config: MonitoringConfig;
    private healthCheckTimer: NodeJS.Timeout | null = null;
    private metricsTimer: NodeJS.Timeout | null = null;
    private lastAlerts: Map<string, number> = new Map();
    private responseTimes: number[] = [];
    private requestCount = 0;
    private errorCount = 0;
    private isRunning = false;

    constructor(config: Partial<MonitoringConfig> = {}) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
            thresholds: {
                ...DEFAULT_CONFIG.thresholds,
                ...config.thresholds,
            },
        };
    }

    // ========================================================================
    // LIFECYCLE
    // ========================================================================

    /**
     * Start monitoring service
     */
    start(): void {
        if (this.isRunning) return;

        this.isRunning = true;
        this.startHealthChecks();
        this.startMetricsCollection();

        this.log('info', 'Monitoring service started', { component: 'monitoring' });
    }

    /**
     * Stop monitoring service
     */
    stop(): void {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }

        if (this.metricsTimer) {
            clearInterval(this.metricsTimer);
            this.metricsTimer = null;
        }

        this.isRunning = false;
        this.log('info', 'Monitoring service stopped', { component: 'monitoring' });
    }

    // ========================================================================
    // HEALTH CHECKS
    // ========================================================================

    /**
     * Get comprehensive system health
     */
    async getSystemHealth(): Promise<SystemHealth> {
        const components: ComponentHealth[] = [];
        const alerts: Alert[] = [];
        const timestamp = Date.now();

        // Check each component in parallel
        const checks = await Promise.allSettled([
            this.checkDatabaseHealth(),
            this.checkRedisHealth(),
            this.checkSSEHealth(),
            this.checkMemoryHealth(),
            this.checkQueueHealth(),
            this.checkCacheHealth(),
        ]);

        for (const result of checks) {
            if (result.status === 'fulfilled') {
                const { health, componentAlerts } = result.value;
                components.push(health);
                alerts.push(...componentAlerts);
            }
        }

        // Determine overall status
        const overall = this.calculateOverallStatus(components);

        // Store health snapshot
        await this.storeHealthSnapshot({ overall, timestamp, components, alerts });

        return { overall, timestamp, components, alerts };
    }

    private async checkDatabaseHealth(): Promise<{ health: ComponentHealth; componentAlerts: Alert[] }> {
        const start = Date.now();
        const alerts: Alert[] = [];

        try {
            const dbHealth = await checkDBHealth();
            const dbMetrics = getDBMetrics();
            const latency = Date.now() - start;

            const status: HealthStatus = dbHealth.healthy
                ? (latency > this.config.thresholds.responseTimeWarning ? 'degraded' : 'healthy')
                : 'unhealthy';

            // Calculate error rate from metrics
            const errorRate = dbMetrics.totalQueries > 0
                ? dbMetrics.failedQueries / dbMetrics.totalQueries
                : 0;

            if (!dbHealth.healthy) {
                alerts.push(this.createAlert('critical', 'database', 'Database is unhealthy'));
            } else if (errorRate > this.config.thresholds.errorRateWarning) {
                alerts.push(this.createAlert('warning', 'database', `High database error rate: ${(errorRate * 100).toFixed(2)}%`));
            }

            return {
                health: {
                    name: 'database',
                    status,
                    latency,
                    details: {
                        ...dbMetrics,
                        healthy: dbHealth.healthy,
                        circuitState: dbHealth.circuitState,
                        errorRate: Math.round(errorRate * 10000) / 100, // as percentage
                    },
                    lastCheck: Date.now(),
                },
                componentAlerts: alerts,
            };
        } catch (error) {
            return {
                health: {
                    name: 'database',
                    status: 'unknown',
                    latency: Date.now() - start,
                    error: error instanceof Error ? error.message : String(error),
                    lastCheck: Date.now(),
                },
                componentAlerts: [this.createAlert('critical', 'database', 'Database health check failed')],
            };
        }
    }

    private async checkRedisHealth(): Promise<{ health: ComponentHealth; componentAlerts: Alert[] }> {
        const start = Date.now();
        const alerts: Alert[] = [];

        try {
            const redis = getRedis();
            await redis.ping();
            const latency = Date.now() - start;

            const status: HealthStatus = latency > this.config.thresholds.responseTimeWarning ? 'degraded' : 'healthy';

            if (latency > this.config.thresholds.responseTimeCritical) {
                alerts.push(this.createAlert('warning', 'redis', `High Redis latency: ${latency}ms`));
            }

            return {
                health: {
                    name: 'redis',
                    status,
                    latency,
                    details: { connected: true },
                    lastCheck: Date.now(),
                },
                componentAlerts: alerts,
            };
        } catch (error) {
            return {
                health: {
                    name: 'redis',
                    status: 'unhealthy',
                    latency: Date.now() - start,
                    error: error instanceof Error ? error.message : String(error),
                    lastCheck: Date.now(),
                },
                componentAlerts: [this.createAlert('critical', 'redis', 'Redis connection failed')],
            };
        }
    }

    private async checkSSEHealth(): Promise<{ health: ComponentHealth; componentAlerts: Alert[] }> {
        const alerts: Alert[] = [];

        try {
            const sseManager = getSSEManager();
            const stats = sseManager.getStats();

            let status: HealthStatus = 'healthy';
            if (stats.total > this.config.thresholds.connectionCritical) {
                status = 'unhealthy';
                alerts.push(this.createAlert('critical', 'sse', `SSE connections critical: ${stats.total}`));
            } else if (stats.total > this.config.thresholds.connectionWarning) {
                status = 'degraded';
                alerts.push(this.createAlert('warning', 'sse', `High SSE connections: ${stats.total}`));
            }

            return {
                health: {
                    name: 'sse',
                    status,
                    details: {
                        totalConnections: stats.total,
                        eventsSent: stats.eventsSent,
                        eventsDropped: stats.eventsDropped,
                    },
                    lastCheck: Date.now(),
                },
                componentAlerts: alerts,
            };
        } catch (error) {
            return {
                health: {
                    name: 'sse',
                    status: 'unknown',
                    error: error instanceof Error ? error.message : String(error),
                    lastCheck: Date.now(),
                },
                componentAlerts: [],
            };
        }
    }

    private async checkMemoryHealth(): Promise<{ health: ComponentHealth; componentAlerts: Alert[] }> {
        const alerts: Alert[] = [];

        try {
            const memoryManager = getMemoryManager();
            const stats = memoryManager.getStats();
            const pressureLevel = memoryManager.getPressureLevel();

            let status: HealthStatus = 'healthy';
            const heapPercent = (stats.heapUsed / stats.heapTotal) * 100;

            if (heapPercent > this.config.thresholds.memoryCritical || pressureLevel === 'critical') {
                status = 'unhealthy';
                alerts.push(this.createAlert('critical', 'memory', `Memory pressure critical: ${heapPercent.toFixed(1)}%`));
            } else if (heapPercent > this.config.thresholds.memoryWarning || pressureLevel === 'warning') {
                status = 'degraded';
                alerts.push(this.createAlert('warning', 'memory', `High memory usage: ${heapPercent.toFixed(1)}%`));
            }

            return {
                health: {
                    name: 'memory',
                    status,
                    details: {
                        heapUsedMB: Math.round(stats.heapUsed / (1024 * 1024)),
                        heapTotalMB: Math.round(stats.heapTotal / (1024 * 1024)),
                        heapPercent: Math.round(heapPercent),
                        pressureLevel,
                    },
                    lastCheck: Date.now(),
                },
                componentAlerts: alerts,
            };
        } catch (error) {
            return {
                health: {
                    name: 'memory',
                    status: 'unknown',
                    error: error instanceof Error ? error.message : String(error),
                    lastCheck: Date.now(),
                },
                componentAlerts: [],
            };
        }
    }

    private async checkQueueHealth(): Promise<{ health: ComponentHealth; componentAlerts: Alert[] }> {
        const alerts: Alert[] = [];

        try {
            const queue = getRequestQueue();
            const stats = queue.getStats();

            let status: HealthStatus = 'healthy';
            const queueUtilization = (stats.total / 10000) * 100; // 10000 is maxQueueSize

            if (queueUtilization > 90) {
                status = 'degraded';
                alerts.push(this.createAlert('warning', 'queue', `Queue near capacity: ${stats.total} active`));
            }

            return {
                health: {
                    name: 'request_queue',
                    status,
                    details: {
                        total: stats.total,
                        processed: stats.processed,
                        rejected: stats.rejected,
                        deduplicated: stats.deduplicated,
                        byType: stats.byType,
                    },
                    lastCheck: Date.now(),
                },
                componentAlerts: alerts,
            };
        } catch (error) {
            return {
                health: {
                    name: 'request_queue',
                    status: 'unknown',
                    error: error instanceof Error ? error.message : String(error),
                    lastCheck: Date.now(),
                },
                componentAlerts: [],
            };
        }
    }

    private async checkCacheHealth(): Promise<{ health: ComponentHealth; componentAlerts: Alert[] }> {
        try {
            const cache = getDBQueryCache();
            const stats = cache.getStats();

            return {
                health: {
                    name: 'db_cache',
                    status: 'healthy',
                    details: {
                        hitRate: Math.round(stats.hitRate * 100),
                        hits: stats.hits,
                        misses: stats.misses,
                        staleHits: stats.staleHits,
                        localCacheSize: stats.localCacheSize,
                    },
                    lastCheck: Date.now(),
                },
                componentAlerts: [],
            };
        } catch (error) {
            return {
                health: {
                    name: 'db_cache',
                    status: 'unknown',
                    error: error instanceof Error ? error.message : String(error),
                    lastCheck: Date.now(),
                },
                componentAlerts: [],
            };
        }
    }

    private calculateOverallStatus(components: ComponentHealth[]): HealthStatus {
        const hasUnhealthy = components.some(c => c.status === 'unhealthy');
        const hasDegraded = components.some(c => c.status === 'degraded');
        const hasUnknown = components.some(c => c.status === 'unknown');

        if (hasUnhealthy) return 'unhealthy';
        if (hasDegraded) return 'degraded';
        if (hasUnknown) return 'unknown';
        return 'healthy';
    }

    // ========================================================================
    // METRICS
    // ========================================================================

    /**
     * Record a metric
     */
    async recordMetric(metric: Omit<Metric, 'timestamp'>): Promise<void> {
        const fullMetric: Metric = {
            ...metric,
            timestamp: Date.now(),
        };

        try {
            const redis = getRedis();
            const key = `${KEY_PREFIX.metrics}${metric.name}`;

            // Store in sorted set by timestamp
            await redis.zadd(key, {
                score: fullMetric.timestamp,
                member: JSON.stringify(fullMetric),
            });

            // Trim old metrics
            const cutoff = Date.now() - (this.config.metricsRetentionHours * 60 * 60 * 1000);
            await redis.zremrangebyscore(key, 0, cutoff);
        } catch (error) {
            console.error('[Monitoring] Failed to record metric:', error);
        }
    }

    /**
     * Get metrics for a time range
     */
    async getMetrics(name: string, startTime: number, endTime: number = Date.now()): Promise<MetricSeries> {
        try {
            const redis = getRedis();
            const key = `${KEY_PREFIX.metrics}${name}`;

            const results = await redis.zrange(key, startTime, endTime, { byScore: true });

            const points: Array<{ timestamp: number; value: number }> = [];
            let min = Infinity;
            let max = -Infinity;
            let sum = 0;

            for (const item of results) {
                const metric = JSON.parse(item as string) as Metric;
                points.push({ timestamp: metric.timestamp, value: metric.value });
                min = Math.min(min, metric.value);
                max = Math.max(max, metric.value);
                sum += metric.value;
            }

            return {
                name,
                points,
                aggregates: points.length > 0 ? {
                    min,
                    max,
                    avg: sum / points.length,
                    count: points.length,
                } : undefined,
            };
        } catch (error) {
            console.error('[Monitoring] Failed to get metrics:', error);
            return { name, points: [] };
        }
    }

    /**
     * Record request performance
     */
    recordRequest(responseTimeMs: number, isError: boolean = false): void {
        this.responseTimes.push(responseTimeMs);
        this.requestCount++;
        if (isError) this.errorCount++;

        // Keep only last 1000 response times for percentile calculation
        if (this.responseTimes.length > 1000) {
            this.responseTimes = this.responseTimes.slice(-1000);
        }
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics(): PerformanceMetrics {
        const sorted = [...this.responseTimes].sort((a, b) => a - b);
        const len = sorted.length;

        const p50 = len > 0 ? sorted[Math.floor(len * 0.5)] : 0;
        const p95 = len > 0 ? sorted[Math.floor(len * 0.95)] : 0;
        const p99 = len > 0 ? sorted[Math.floor(len * 0.99)] : 0;
        const avg = len > 0 ? sorted.reduce((a, b) => a + b, 0) / len : 0;

        const sseStats = getSSEManager().getStats();

        return {
            requestsPerSecond: this.requestCount / Math.max(1, (Date.now() - (this.responseTimes[0] || Date.now())) / 1000),
            avgResponseTime: avg,
            p50ResponseTime: p50,
            p95ResponseTime: p95,
            p99ResponseTime: p99,
            errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
            activeConnections: sseStats.total,
        };
    }

    // ========================================================================
    // LOGGING
    // ========================================================================

    /**
     * Structured logging
     */
    log(
        level: LogLevel,
        message: string,
        context?: Record<string, unknown>
    ): void {
        const entry: LogEntry = {
            level,
            message,
            timestamp: Date.now(),
            context,
        };

        // Console output with formatting
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
        const contextStr = context ? ` ${JSON.stringify(context)}` : '';

        switch (level) {
            case 'debug':
                if (process.env.NODE_ENV === 'development') {
                    console.debug(`${prefix} ${message}${contextStr}`);
                }
                break;
            case 'info':
                console.log(`${prefix} ${message}${contextStr}`);
                break;
            case 'warn':
                console.warn(`${prefix} ${message}${contextStr}`);
                break;
            case 'error':
            case 'fatal':
                console.error(`${prefix} ${message}${contextStr}`);
                break;
        }

        // Store in Redis for log aggregation (non-blocking)
        this.storeLog(entry).catch(() => {
            // Ignore storage errors
        });
    }

    /**
     * Log an error with stack trace
     */
    logError(
        message: string,
        error: Error,
        context?: Record<string, unknown>
    ): void {
        const entry: LogEntry = {
            level: 'error',
            message,
            timestamp: Date.now(),
            context,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
            },
        };

        console.error(`[${new Date().toISOString()}] [ERROR] ${message}`, error);

        this.storeLog(entry).catch(() => {
            // Ignore storage errors
        });
    }

    private async storeLog(entry: LogEntry): Promise<void> {
        try {
            const redis = getRedis();
            const key = `${KEY_PREFIX.logs}${entry.level}`;

            await redis.lpush(key, JSON.stringify(entry));
            await redis.ltrim(key, 0, 9999); // Keep last 10000 logs per level
        } catch {
            // Silently fail - logging shouldn't break the application
        }
    }

    /**
     * Get recent logs
     */
    async getLogs(level?: LogLevel, limit: number = 100): Promise<LogEntry[]> {
        try {
            const redis = getRedis();
            const logs: LogEntry[] = [];

            const levels = level ? [level] : ['debug', 'info', 'warn', 'error', 'fatal'];

            for (const lvl of levels) {
                const key = `${KEY_PREFIX.logs}${lvl}`;
                const items = await redis.lrange(key, 0, Math.floor(limit / levels.length) - 1);
                for (const item of items) {
                    logs.push(JSON.parse(item as string));
                }
            }

            return logs.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
        } catch (error) {
            console.error('[Monitoring] Failed to get logs:', error);
            return [];
        }
    }

    // ========================================================================
    // ALERTS
    // ========================================================================

    private createAlert(level: 'warning' | 'critical', component: string, message: string): Alert {
        const alertKey = `${component}:${message}`;
        const now = Date.now();

        // Check cooldown
        const lastAlert = this.lastAlerts.get(alertKey);
        if (lastAlert && now - lastAlert < this.config.alertCooldownMs) {
            return {
                id: `${alertKey}:${now}`,
                level,
                component,
                message,
                timestamp: now,
                acknowledged: true, // Treat as acknowledged during cooldown
            };
        }

        this.lastAlerts.set(alertKey, now);

        const alert: Alert = {
            id: `${alertKey}:${now}`,
            level,
            component,
            message,
            timestamp: now,
            acknowledged: false,
        };

        // Store alert
        this.storeAlert(alert).catch(console.error);

        // Log alert
        this.log(level === 'critical' ? 'error' : 'warn', `Alert: ${message}`, {
            component,
            alertLevel: level,
        });

        return alert;
    }

    private async storeAlert(alert: Alert): Promise<void> {
        try {
            const redis = getRedis();
            await redis.lpush(`${KEY_PREFIX.alerts}active`, JSON.stringify(alert));
            await redis.ltrim(`${KEY_PREFIX.alerts}active`, 0, 999); // Keep last 1000 alerts
        } catch (error) {
            console.error('[Monitoring] Failed to store alert:', error);
        }
    }

    /**
     * Get active alerts
     */
    async getAlerts(limit: number = 50): Promise<Alert[]> {
        try {
            const redis = getRedis();
            const items = await redis.lrange(`${KEY_PREFIX.alerts}active`, 0, limit - 1);
            return items.map(item => JSON.parse(item as string) as Alert);
        } catch (error) {
            console.error('[Monitoring] Failed to get alerts:', error);
            return [];
        }
    }

    /**
     * Acknowledge an alert
     */
    async acknowledgeAlert(alertId: string): Promise<boolean> {
        try {
            const redis = getRedis();
            const items = await redis.lrange(`${KEY_PREFIX.alerts}active`, 0, -1);

            for (let i = 0; i < items.length; i++) {
                const alert = JSON.parse(items[i] as string) as Alert;
                if (alert.id === alertId) {
                    alert.acknowledged = true;
                    await redis.lset(`${KEY_PREFIX.alerts}active`, i, JSON.stringify(alert));
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error('[Monitoring] Failed to acknowledge alert:', error);
            return false;
        }
    }

    // ========================================================================
    // BACKGROUND TASKS
    // ========================================================================

    private startHealthChecks(): void {
        this.healthCheckTimer = setInterval(async () => {
            try {
                await this.getSystemHealth();
            } catch (error) {
                console.error('[Monitoring] Health check error:', error);
            }
        }, this.config.healthCheckIntervalMs);
    }

    private startMetricsCollection(): void {
        this.metricsTimer = setInterval(async () => {
            try {
                const perf = this.getPerformanceMetrics();

                await Promise.all([
                    this.recordMetric({ name: 'requests_per_second', value: perf.requestsPerSecond, unit: 'req/s' }),
                    this.recordMetric({ name: 'response_time_avg', value: perf.avgResponseTime, unit: 'ms' }),
                    this.recordMetric({ name: 'response_time_p95', value: perf.p95ResponseTime, unit: 'ms' }),
                    this.recordMetric({ name: 'error_rate', value: perf.errorRate, unit: 'ratio' }),
                    this.recordMetric({ name: 'active_connections', value: perf.activeConnections, unit: 'count' }),
                ]);

                // Check thresholds
                if (perf.errorRate > this.config.thresholds.errorRateCritical) {
                    this.createAlert('critical', 'performance', `Error rate critical: ${(perf.errorRate * 100).toFixed(2)}%`);
                } else if (perf.errorRate > this.config.thresholds.errorRateWarning) {
                    this.createAlert('warning', 'performance', `Error rate elevated: ${(perf.errorRate * 100).toFixed(2)}%`);
                }

                if (perf.p95ResponseTime > this.config.thresholds.responseTimeCritical) {
                    this.createAlert('critical', 'performance', `P95 response time critical: ${perf.p95ResponseTime}ms`);
                } else if (perf.p95ResponseTime > this.config.thresholds.responseTimeWarning) {
                    this.createAlert('warning', 'performance', `P95 response time elevated: ${perf.p95ResponseTime}ms`);
                }
            } catch (error) {
                console.error('[Monitoring] Metrics collection error:', error);
            }
        }, this.config.metricsCollectionIntervalMs);
    }

    private async storeHealthSnapshot(health: SystemHealth): Promise<void> {
        try {
            const redis = getRedis();
            await redis.set(`${KEY_PREFIX.health}latest`, health, { ex: 300 }); // 5 min expiry

            // Store in time series
            await redis.zadd(`${KEY_PREFIX.health}history`, {
                score: health.timestamp,
                member: JSON.stringify(health),
            });

            // Trim old history
            const cutoff = Date.now() - (this.config.metricsRetentionHours * 60 * 60 * 1000);
            await redis.zremrangebyscore(`${KEY_PREFIX.health}history`, 0, cutoff);
        } catch (error) {
            console.error('[Monitoring] Failed to store health snapshot:', error);
        }
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let monitoringService: MonitoringService | null = null;

export function getMonitoringService(): MonitoringService {
    if (!monitoringService) {
        monitoringService = new MonitoringService();
    }
    return monitoringService;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Start monitoring (call on server startup)
 */
export function startMonitoring(): void {
    getMonitoringService().start();
}

/**
 * Stop monitoring (call on server shutdown)
 */
export function stopMonitoring(): void {
    getMonitoringService().stop();
}

/**
 * Get system health
 */
export function getSystemHealth(): Promise<SystemHealth> {
    return getMonitoringService().getSystemHealth();
}

/**
 * Record a request for performance tracking
 */
export function recordRequest(responseTimeMs: number, isError: boolean = false): void {
    getMonitoringService().recordRequest(responseTimeMs, isError);
}

/**
 * Structured logger
 */
export function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    getMonitoringService().log(level, message, context);
}

/**
 * Log error with stack trace
 */
export function logError(message: string, error: Error, context?: Record<string, unknown>): void {
    getMonitoringService().logError(message, error, context);
}

export default {
    getMonitoringService,
    startMonitoring,
    stopMonitoring,
    getSystemHealth,
    recordRequest,
    log,
    logError,
};
