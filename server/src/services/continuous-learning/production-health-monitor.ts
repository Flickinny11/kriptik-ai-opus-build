/**
 * Production Health Monitor
 *
 * Ensures the entire learning system is healthy, detecting issues
 * before they impact users with automated recovery where possible.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import {
  learningHealthChecks,
  learningHealthAlerts,
} from '../../schema.js';
import { eq, desc, and, gte, sql } from 'drizzle-orm';

import type {
  HealthReport,
  ComponentHealthReport,
  HealthAlert,
  Diagnosis,
  RecoveryResult,
  SLAReport,
  SystemHealthState,
  ComponentHealth,
} from './types.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

interface HealthCheckConfig {
  checkInterval: number;
  alertThresholds: {
    responseTimeMs: number;
    errorRate: number;
  };
  recoveryAttempts: number;
  alertChannels: string[];
}

const DEFAULT_CONFIG: HealthCheckConfig = {
  checkInterval: 60000, // 1 minute
  alertThresholds: {
    responseTimeMs: 5000,
    errorRate: 0.05,
  },
  recoveryAttempts: 3,
  alertChannels: ['log', 'database'],
};

// =============================================================================
// COMPONENT DEFINITIONS
// =============================================================================

interface ComponentDefinition {
  name: string;
  healthCheck: () => Promise<{ healthy: boolean; latencyMs: number; details?: unknown }>;
  recover?: () => Promise<boolean>;
  dependencies: string[];
  critical: boolean;
}

// =============================================================================
// PRODUCTION HEALTH MONITOR
// =============================================================================

export class ProductionHealthMonitor extends EventEmitter {
  private config: HealthCheckConfig;
  private components: Map<string, ComponentDefinition> = new Map();
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private lastHealthReport: HealthReport | null = null;
  private healthHistory: HealthReport[] = [];
  private isRunning: boolean = false;

  constructor(config?: Partial<HealthCheckConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.registerDefaultComponents();
  }

  /**
   * Register default system components
   */
  private registerDefaultComponents(): void {
    // Database
    this.registerComponent({
      name: 'database',
      healthCheck: async () => {
        const start = Date.now();
        try {
          await db.select().from(learningHealthChecks).limit(1);
          return { healthy: true, latencyMs: Date.now() - start };
        } catch (error) {
          return { healthy: false, latencyMs: Date.now() - start, details: { error: String(error) } };
        }
      },
      dependencies: [],
      critical: true,
    });

    // Qdrant Vector Database
    this.registerComponent({
      name: 'qdrant',
      healthCheck: async () => {
        const start = Date.now();
        try {
          // Import dynamically to avoid circular dependencies
          const { getQdrantClient } = await import('../embeddings/qdrant-client.js');
          const client = getQdrantClient();
          const health = await client.healthCheck();
          return { healthy: health.healthy, latencyMs: Date.now() - start, details: health };
        } catch (error) {
          return { healthy: false, latencyMs: Date.now() - start, details: { error: String(error) } };
        }
      },
      dependencies: [],
      critical: false, // Graceful degradation if unavailable
    });

    // Hyper-Thinking Service
    this.registerComponent({
      name: 'hyper_thinking',
      healthCheck: async () => {
        const start = Date.now();
        try {
          const { getHyperThinkingOrchestrator } = await import('../hyper-thinking/orchestrator.js');
          const orchestrator = getHyperThinkingOrchestrator();
          const health = await orchestrator.healthCheck();
          return { healthy: health.healthy, latencyMs: Date.now() - start, details: health };
        } catch (error) {
          return { healthy: false, latencyMs: Date.now() - start, details: { error: String(error) } };
        }
      },
      dependencies: [],
      critical: false,
    });

    // Evolution Flywheel (Component 28)
    this.registerComponent({
      name: 'evolution_flywheel',
      healthCheck: async () => {
        const start = Date.now();
        try {
          const { getEvolutionFlywheel } = await import('../learning/evolution-flywheel.js');
          const flywheel = getEvolutionFlywheel();
          const status = await flywheel.getSystemStatus();
          return { healthy: true, latencyMs: Date.now() - start, details: status };
        } catch (error) {
          return { healthy: false, latencyMs: Date.now() - start, details: { error: String(error) } };
        }
      },
      dependencies: ['database'],
      critical: false,
    });

    // OpenRouter API
    this.registerComponent({
      name: 'openrouter_api',
      healthCheck: async () => {
        const start = Date.now();
        try {
          // Simple connectivity check - External API call (no credentials needed)
          const response = await fetch('https://openrouter.ai/api/v1/models', {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000),
            credentials: 'omit', // External API - no browser cookies
          });
          return { healthy: response.ok, latencyMs: Date.now() - start };
        } catch (error) {
          return { healthy: false, latencyMs: Date.now() - start, details: { error: String(error) } };
        }
      },
      dependencies: [],
      critical: true,
    });
  }

  /**
   * Register a new component for health monitoring
   */
  registerComponent(component: ComponentDefinition): void {
    this.components.set(component.name, component);
  }

  /**
   * Start health monitoring
   */
  start(): void {
    if (this.isRunning) return;

    console.log('[ProductionHealthMonitor] Starting health monitoring...');
    this.isRunning = true;

    // Run initial check
    this.runHealthCheck();

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.runHealthCheck();
    }, this.config.checkInterval);

    this.emit('started');
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (!this.isRunning) return;

    console.log('[ProductionHealthMonitor] Stopping health monitoring...');
    this.isRunning = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.emit('stopped');
  }

  /**
   * Run health check on all components
   */
  async runHealthCheck(): Promise<HealthReport> {
    const timestamp = new Date().toISOString();
    const componentReports: ComponentHealthReport[] = [];

    // Check each component
    for (const [name, component] of this.components) {
      try {
        const result = await component.healthCheck();
        const status = this.determineStatus(result.healthy, result.latencyMs);

        const report: ComponentHealthReport = {
          name,
          status,
          responseTimeMs: result.latencyMs,
          errorRate: result.healthy ? 0 : 1,
          lastCheck: timestamp,
          dependencies: component.dependencies,
          details: result.details as Record<string, unknown> | undefined,
        };

        componentReports.push(report);

        // Store in database
        await this.recordHealthCheck(name, status, result.latencyMs, result.details);

        // Generate alert if unhealthy
        if (status === 'unhealthy' && component.critical) {
          await this.createAlert(name, 'critical', `${name} is unhealthy`);

          // Attempt recovery
          if (component.recover) {
            await this.attemptRecovery(name, component);
          }
        } else if (status === 'degraded') {
          await this.createAlert(name, 'warning', `${name} is degraded (${result.latencyMs}ms)`);
        }

      } catch (error) {
        console.error(`[ProductionHealthMonitor] Error checking ${name}:`, error);
        componentReports.push({
          name,
          status: 'unhealthy',
          responseTimeMs: 0,
          errorRate: 1,
          lastCheck: timestamp,
          dependencies: component.dependencies,
          details: { error: String(error) },
        });
      }
    }

    // Calculate overall health
    const overallHealth = this.calculateOverallHealth(componentReports);

    // Get recent alerts
    const alerts = await this.getRecentAlerts();

    const report: HealthReport = {
      timestamp,
      overallHealth,
      components: componentReports,
      alerts,
      uptime: this.calculateUptime(),
    };

    this.lastHealthReport = report;
    this.healthHistory.push(report);

    // Limit history size
    if (this.healthHistory.length > 1440) { // 24 hours at 1 min intervals
      this.healthHistory = this.healthHistory.slice(-1440);
    }

    this.emit('health_check_complete', report);

    return report;
  }

  /**
   * Check all components
   */
  async checkAllComponents(): Promise<HealthReport> {
    return this.runHealthCheck();
  }

  /**
   * Diagnose an issue with a component
   */
  async diagnoseIssue(componentName: string): Promise<Diagnosis> {
    const component = this.components.get(componentName);
    if (!component) {
      return {
        component: componentName,
        issue: 'Component not found',
        rootCause: 'Unknown component name',
        affectedSystems: [],
        suggestedActions: ['Verify component name'],
        autoRecoverable: false,
      };
    }

    // Run health check
    const result = await component.healthCheck();

    // Analyze dependencies
    const affectedSystems: string[] = [];
    for (const [name, comp] of this.components) {
      if (comp.dependencies.includes(componentName)) {
        affectedSystems.push(name);
      }
    }

    // Determine root cause and actions
    let rootCause = 'Unknown';
    const suggestedActions: string[] = [];

    if (!result.healthy) {
      if (result.details && typeof result.details === 'object' && 'error' in result.details) {
        const error = String((result.details as { error: unknown }).error);
        if (error.includes('ECONNREFUSED')) {
          rootCause = 'Service connection refused';
          suggestedActions.push('Check if service is running', 'Verify network connectivity');
        } else if (error.includes('timeout')) {
          rootCause = 'Service timeout';
          suggestedActions.push('Check service load', 'Increase timeout');
        } else {
          rootCause = error;
          suggestedActions.push('Check service logs', 'Restart service');
        }
      }
    } else if (result.latencyMs > this.config.alertThresholds.responseTimeMs) {
      rootCause = 'High latency';
      suggestedActions.push('Check service load', 'Scale up resources');
    }

    return {
      component: componentName,
      issue: result.healthy ? 'Performance degradation' : 'Service unavailable',
      rootCause,
      affectedSystems,
      suggestedActions,
      autoRecoverable: !!component.recover,
    };
  }

  /**
   * Attempt recovery for a component
   */
  async attemptRecovery(componentName: string, component?: ComponentDefinition): Promise<RecoveryResult> {
    const comp = component || this.components.get(componentName);
    if (!comp || !comp.recover) {
      return {
        component: componentName,
        success: false,
        action: 'no_recovery_action',
        duration: 0,
        error: 'No recovery action available',
      };
    }

    const start = Date.now();

    for (let attempt = 1; attempt <= this.config.recoveryAttempts; attempt++) {
      console.log(`[ProductionHealthMonitor] Recovery attempt ${attempt}/${this.config.recoveryAttempts} for ${componentName}`);

      try {
        const success = await comp.recover();
        if (success) {
          return {
            component: componentName,
            success: true,
            action: 'auto_recovery',
            duration: Date.now() - start,
          };
        }
      } catch (error) {
        console.error(`[ProductionHealthMonitor] Recovery attempt ${attempt} failed:`, error);
      }

      // Wait before next attempt
      if (attempt < this.config.recoveryAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
      }
    }

    return {
      component: componentName,
      success: false,
      action: 'auto_recovery_failed',
      duration: Date.now() - start,
      error: `Failed after ${this.config.recoveryAttempts} attempts`,
    };
  }

  /**
   * Create a health alert
   */
  async createAlert(
    component: string,
    severity: 'info' | 'warning' | 'error' | 'critical',
    message: string
  ): Promise<void> {
    const alertId = `alert_${uuidv4()}`;
    const timestamp = new Date().toISOString();

    await db.insert(learningHealthAlerts).values({
      id: alertId,
      component,
      severity,
      message,
      acknowledged: false,
      timestamp,
    });

    this.emit('alert', { id: alertId, component, severity, message, timestamp });

    console.log(`[ProductionHealthMonitor] Alert: [${severity.toUpperCase()}] ${component}: ${message}`);
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    await db.update(learningHealthAlerts)
      .set({
        acknowledged: true,
        resolvedAt: new Date().toISOString(),
      })
      .where(eq(learningHealthAlerts.id, alertId));
  }

  /**
   * Get SLA metrics
   */
  async getSLAMetrics(): Promise<SLAReport> {
    const period = '30d';
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get health checks from period
    const checks = await db.select()
      .from(learningHealthChecks)
      .where(gte(learningHealthChecks.timestamp, thirtyDaysAgo))
      .all();

    // Calculate uptime per component
    const byComponent: Record<string, { uptime: number; incidents: number }> = {};
    const componentChecks: Record<string, { total: number; healthy: number; incidents: number }> = {};

    for (const check of checks) {
      if (!componentChecks[check.component]) {
        componentChecks[check.component] = { total: 0, healthy: 0, incidents: 0 };
      }
      componentChecks[check.component].total++;
      if (check.status === 'healthy') {
        componentChecks[check.component].healthy++;
      } else if (check.status === 'unhealthy') {
        componentChecks[check.component].incidents++;
      }
    }

    for (const [name, data] of Object.entries(componentChecks)) {
      byComponent[name] = {
        uptime: data.total > 0 ? data.healthy / data.total : 1,
        incidents: data.incidents,
      };
    }

    // Calculate overall uptime
    const totalChecks = checks.length;
    const healthyChecks = checks.filter(c => c.status === 'healthy').length;
    const uptime = totalChecks > 0 ? healthyChecks / totalChecks : 1;

    // Get alerts for average resolution time
    const alerts = await db.select()
      .from(learningHealthAlerts)
      .where(
        and(
          gte(learningHealthAlerts.timestamp, thirtyDaysAgo),
          sql`resolved_at IS NOT NULL`
        )
      )
      .all();

    let avgResolutionTime = 0;
    if (alerts.length > 0) {
      const totalResolutionTime = alerts.reduce((sum, alert) => {
        if (alert.resolvedAt) {
          return sum + (new Date(alert.resolvedAt).getTime() - new Date(alert.timestamp).getTime());
        }
        return sum;
      }, 0);
      avgResolutionTime = totalResolutionTime / alerts.length;
    }

    return {
      period,
      uptime,
      targetUptime: 0.999, // 99.9%
      incidents: Object.values(componentChecks).reduce((sum, c) => sum + c.incidents, 0),
      avgResolutionTime,
      byComponent,
    };
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  private determineStatus(healthy: boolean, latencyMs: number): 'healthy' | 'degraded' | 'unhealthy' {
    if (!healthy) return 'unhealthy';
    if (latencyMs > this.config.alertThresholds.responseTimeMs) return 'degraded';
    return 'healthy';
  }

  private calculateOverallHealth(reports: ComponentHealthReport[]): 'healthy' | 'degraded' | 'unhealthy' {
    const criticalUnhealthy = reports.some(r => {
      const comp = this.components.get(r.name);
      return comp?.critical && r.status === 'unhealthy';
    });

    if (criticalUnhealthy) return 'unhealthy';

    const anyUnhealthy = reports.some(r => r.status === 'unhealthy');
    const anyDegraded = reports.some(r => r.status === 'degraded');

    if (anyUnhealthy) return 'degraded';
    if (anyDegraded) return 'degraded';
    return 'healthy';
  }

  private calculateUptime(): number {
    if (this.healthHistory.length === 0) return 1;

    const healthyChecks = this.healthHistory.filter(r => r.overallHealth === 'healthy').length;
    return healthyChecks / this.healthHistory.length;
  }

  private async recordHealthCheck(
    component: string,
    status: 'healthy' | 'degraded' | 'unhealthy',
    responseTimeMs: number,
    details?: unknown
  ): Promise<void> {
    await db.insert(learningHealthChecks).values({
      id: `hc_${uuidv4()}`,
      component,
      status,
      responseTimeMs,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  private async getRecentAlerts(): Promise<HealthAlert[]> {
    const alerts = await db.select()
      .from(learningHealthAlerts)
      .where(eq(learningHealthAlerts.acknowledged, false))
      .orderBy(desc(learningHealthAlerts.timestamp))
      .limit(10);

    return alerts.map(a => ({
      id: a.id,
      component: a.component,
      severity: a.severity as 'info' | 'warning' | 'error' | 'critical',
      message: a.message,
      timestamp: a.timestamp,
      acknowledged: a.acknowledged ?? false,
      resolvedAt: a.resolvedAt || undefined,
    }));
  }

  // =========================================================================
  // GETTERS
  // =========================================================================

  getLastReport(): HealthReport | null {
    return this.lastHealthReport;
  }

  getHealthHistory(limit: number = 24): HealthReport[] {
    return this.healthHistory.slice(-limit);
  }

  async getAlerts(): Promise<HealthAlert[]> {
    return this.getRecentAlerts();
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    await db.update(learningHealthAlerts)
      .set({
        acknowledged: true,
        resolvedAt: new Date().toISOString(),
      })
      .where(eq(learningHealthAlerts.id, alertId));
  }

  getSystemHealthState(): SystemHealthState {
    if (!this.lastHealthReport) {
      return {
        overall: 'healthy',
        components: [],
        lastCheck: new Date().toISOString(),
      };
    }

    return {
      overall: this.lastHealthReport.overallHealth,
      components: this.lastHealthReport.components.map(c => ({
        name: c.name,
        status: c.status,
        latencyMs: c.responseTimeMs,
        errorRate: c.errorRate,
        message: c.details ? JSON.stringify(c.details) : undefined,
      })),
      lastCheck: this.lastHealthReport.timestamp,
    };
  }

  isHealthy(): boolean {
    return this.lastHealthReport?.overallHealth === 'healthy';
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let monitorInstance: ProductionHealthMonitor | null = null;

export function getProductionHealthMonitor(): ProductionHealthMonitor {
  if (!monitorInstance) {
    monitorInstance = new ProductionHealthMonitor();
  }
  return monitorInstance;
}

export function resetProductionHealthMonitor(): void {
  if (monitorInstance) {
    monitorInstance.stop();
  }
  monitorInstance = null;
}

export default ProductionHealthMonitor;
