/**
 * Health Monitor Service
 * 
 * Continuous health monitoring of all KripTik services.
 * Detects failures and emits events for auto-recovery.
 */

import { EventEmitter } from 'events';
import { db } from '../../db.js';
import { sql } from 'drizzle-orm';

export interface ServiceHealth {
    name: string;
    status: 'healthy' | 'degraded' | 'down' | 'unknown';
    latencyMs?: number;
    lastCheck: Date;
    errorCount: number;
    lastError?: string;
}

export interface SystemHealth {
    overall: 'healthy' | 'degraded' | 'critical' | 'down';
    services: ServiceHealth[];
    uptime: number;
    lastIncident?: Date;
    activeAlerts: string[];
}

interface ServiceCheck {
    name: string;
    check: () => Promise<{ healthy: boolean; latencyMs: number; error?: string }>;
    critical: boolean;
    interval: number; // ms
    lastRun?: number;
}

export class HealthMonitor extends EventEmitter {
    private services: Map<string, ServiceHealth> = new Map();
    private checkInterval: NodeJS.Timeout | null = null;
    private errorBuffer: Array<{ service: string; error: string; timestamp: Date }> = [];
    private readonly ERROR_BUFFER_SIZE = 100;
    private readonly startTime = Date.now();
    private serviceChecks: ServiceCheck[] = [];

    constructor() {
        super();
        this.initializeServiceChecks();
    }

    private initializeServiceChecks() {
        // Database check
        this.serviceChecks.push({
            name: 'database',
            check: async () => {
                const start = Date.now();
                try {
                    await db.run(sql`SELECT 1`);
                    return { healthy: true, latencyMs: Date.now() - start };
                } catch (error) {
                    return { healthy: false, latencyMs: Date.now() - start, error: String(error) };
                }
            },
            critical: true,
            interval: 30000, // 30 seconds
        });

        // OpenRouter API check
        this.serviceChecks.push({
            name: 'openrouter',
            check: async () => {
                const start = Date.now();
                try {
                    if (!process.env.OPENROUTER_API_KEY) {
                        return { healthy: false, latencyMs: 0, error: 'OPENROUTER_API_KEY not configured' };
                    }
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 10000);
                    
                    const response = await fetch('https://openrouter.ai/api/v1/models', {
                        headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` },
                        signal: controller.signal,
                    });
                    
                    clearTimeout(timeout);
                    return {
                        healthy: response.ok,
                        latencyMs: Date.now() - start,
                        error: response.ok ? undefined : `Status ${response.status}`,
                    };
                } catch (error) {
                    return { healthy: false, latencyMs: Date.now() - start, error: String(error) };
                }
            },
            critical: true,
            interval: 60000, // 1 minute
        });

        // Stripe API check
        this.serviceChecks.push({
            name: 'stripe',
            check: async () => {
                const start = Date.now();
                try {
                    if (!process.env.STRIPE_SECRET_KEY) {
                        return { healthy: false, latencyMs: 0, error: 'STRIPE_SECRET_KEY not configured' };
                    }
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 10000);
                    
                    const response = await fetch('https://api.stripe.com/v1/balance', {
                        headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` },
                        signal: controller.signal,
                    });
                    
                    clearTimeout(timeout);
                    return {
                        healthy: response.ok,
                        latencyMs: Date.now() - start,
                        error: response.ok ? undefined : `Status ${response.status}`,
                    };
                } catch (error) {
                    return { healthy: false, latencyMs: Date.now() - start, error: String(error) };
                }
            },
            critical: false, // Billing can degrade gracefully
            interval: 120000, // 2 minutes
        });

        // Memory check
        this.serviceChecks.push({
            name: 'memory',
            check: async () => {
                const used = process.memoryUsage();
                const heapUsedMB = used.heapUsed / 1024 / 1024;
                const heapTotalMB = used.heapTotal / 1024 / 1024;
                const usagePercent = (heapUsedMB / heapTotalMB) * 100;

                return {
                    healthy: usagePercent < 90,
                    latencyMs: 0,
                    error: usagePercent >= 90 ? `High memory usage: ${usagePercent.toFixed(1)}%` : undefined,
                };
            },
            critical: true,
            interval: 15000, // 15 seconds
        });

        // Initialize service states
        for (const service of this.serviceChecks) {
            this.services.set(service.name, {
                name: service.name,
                status: 'unknown',
                lastCheck: new Date(),
                errorCount: 0,
            });
        }
    }

    /**
     * Start continuous health monitoring
     */
    start(): void {
        console.log('[HealthMonitor] Starting health monitoring...');

        // Run initial checks
        this.runAllChecks();

        // Schedule periodic checks
        this.checkInterval = setInterval(() => {
            this.runAllChecks();
        }, 15000); // Base interval - individual services may check less frequently
    }

    /**
     * Stop health monitoring
     */
    stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        console.log('[HealthMonitor] Stopped');
    }

    private async runAllChecks(): Promise<void> {
        const now = Date.now();

        for (const serviceConfig of this.serviceChecks) {
            // Check if it's time to run this service's check
            if (serviceConfig.lastRun && (now - serviceConfig.lastRun) < serviceConfig.interval) {
                continue;
            }

            serviceConfig.lastRun = now;
            const currentState = this.services.get(serviceConfig.name);

            try {
                const result = await serviceConfig.check();
                const previousStatus = currentState?.status;

                const newState: ServiceHealth = {
                    name: serviceConfig.name,
                    status: result.healthy ? 'healthy' : 'degraded',
                    latencyMs: result.latencyMs,
                    lastCheck: new Date(),
                    errorCount: result.healthy ? 0 : (currentState?.errorCount || 0) + 1,
                    lastError: result.error,
                };

                // Mark as down if consecutive errors
                if (newState.errorCount >= 3) {
                    newState.status = 'down';
                }

                this.services.set(serviceConfig.name, newState);

                // Emit status change events
                if (previousStatus !== newState.status) {
                    this.emit('status_change', {
                        service: serviceConfig.name,
                        previousStatus,
                        newStatus: newState.status,
                        critical: serviceConfig.critical,
                    });

                    if (newState.status === 'down' && serviceConfig.critical) {
                        this.emit('critical_failure', {
                            service: serviceConfig.name,
                            error: result.error,
                        });
                    }

                    if (previousStatus === 'down' && newState.status === 'healthy') {
                        this.emit('service_recovered', {
                            service: serviceConfig.name,
                        });
                    }
                }

                // Record error in buffer
                if (!result.healthy) {
                    this.recordError(serviceConfig.name, result.error || 'Unknown error');
                }
            } catch (error) {
                console.error(`[HealthMonitor] Check failed for ${serviceConfig.name}:`, error);
                this.recordError(serviceConfig.name, String(error));
            }
        }

        // Emit overall health status
        const health = this.getSystemHealth();
        this.emit('health_update', health);

        if (health.overall === 'critical' || health.overall === 'down') {
            this.emit('system_critical', health);
        }
    }

    private recordError(service: string, error: string): void {
        this.errorBuffer.push({
            service,
            error,
            timestamp: new Date(),
        });

        // Keep buffer size limited
        if (this.errorBuffer.length > this.ERROR_BUFFER_SIZE) {
            this.errorBuffer.shift();
        }
    }

    /**
     * Get current system health status
     */
    getSystemHealth(): SystemHealth {
        const services = Array.from(this.services.values());
        const criticalServices = this.serviceChecks.filter(s => s.critical).map(s => s.name);

        let overall: SystemHealth['overall'] = 'healthy';
        const activeAlerts: string[] = [];

        for (const service of services) {
            if (service.status === 'down') {
                if (criticalServices.includes(service.name)) {
                    overall = 'down';
                    activeAlerts.push(`CRITICAL: ${service.name} is down`);
                } else {
                    if (overall !== 'down') overall = 'critical';
                    activeAlerts.push(`${service.name} is down`);
                }
            } else if (service.status === 'degraded') {
                if (overall === 'healthy') overall = 'degraded';
                activeAlerts.push(`${service.name} is degraded`);
            }
        }

        return {
            overall,
            services,
            uptime: Date.now() - this.startTime,
            activeAlerts,
        };
    }

    /**
     * Get recent errors for analysis
     */
    getRecentErrors(count: number = 20): typeof this.errorBuffer {
        return this.errorBuffer.slice(-count);
    }

    /**
     * Get service-specific health
     */
    getServiceHealth(name: string): ServiceHealth | undefined {
        return this.services.get(name);
    }
}

// Singleton
let healthMonitor: HealthMonitor | null = null;

export function getHealthMonitor(): HealthMonitor {
    if (!healthMonitor) {
        healthMonitor = new HealthMonitor();
    }
    return healthMonitor;
}

