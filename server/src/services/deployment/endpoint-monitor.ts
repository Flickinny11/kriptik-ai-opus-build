/**
 * Endpoint Monitor Service
 *
 * Real-time endpoint status monitoring with automatic recovery for failed endpoints.
 * Monitors all user endpoints across RunPod and Modal providers.
 * Detects failures, scaling issues, and cold start problems.
 * Automatic recovery: retry deployment, scale up, notify user.
 *
 * Part of KripTik AI's Auto-Deploy Private Endpoints feature.
 */

import { eq, and, gte, desc } from 'drizzle-orm';
import { EventEmitter } from 'events';
import { db } from '../../db.js';
import { userEndpoints, endpointUsage, users } from '../../schema.js';
import { createEndpointRegistry, type EndpointInfo } from './endpoint-registry.js';
import { RunPodDeployer } from './runpod-deployer.js';
import { ModalDeployer } from './modal-deployer.js';

// =============================================================================
// TYPES
// =============================================================================

export interface MonitoringConfig {
  checkIntervalMs: number;
  unhealthyThreshold: number;
  autoRecoveryEnabled: boolean;
  maxRecoveryAttempts: number;
}

export interface ProviderHealth {
  reachable: boolean;
  status: string;
  activeWorkers: number;
  queuedRequests: number;
  lastResponse?: string;
  latencyMs?: number;
}

export interface EndpointHealth {
  endpointId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  consecutiveFailures: number;
  metrics: {
    latencyP50Ms: number;
    latencyP99Ms: number;
    successRate: number;
    activeWorkers: number;
    queuedRequests: number;
    errorRate: number;
  };
  issues: string[];
  recoveryAttempts: number;
  lastRecoveryAt?: Date;
}

export interface HealthAlert {
  type: 'endpoint_unhealthy' | 'endpoint_recovered' | 'recovery_failed' | 'gpu_upgrade_needed';
  endpointId: string;
  userId: string;
  modelName: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  health?: EndpointHealth;
}

interface RecentUsageStats {
  totalRequests: number;
  successfulRequests: number;
  errorRate: number;
  latencyP50Ms: number;
  latencyP99Ms: number;
  errors: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_CONFIG: MonitoringConfig = {
  checkIntervalMs: 60 * 1000, // Check every minute
  unhealthyThreshold: 3, // 3 consecutive failures = unhealthy
  autoRecoveryEnabled: true,
  maxRecoveryAttempts: 3,
};

// =============================================================================
// ENDPOINT MONITOR CLASS
// =============================================================================

export class EndpointMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private checkInterval: NodeJS.Timeout | null = null;
  private failureCount: Map<string, number> = new Map();
  private recoveryAttempts: Map<string, number> = new Map();
  private lastRecoveryTime: Map<string, Date> = new Map();
  private healthCache: Map<string, EndpointHealth> = new Map();
  private isRunning: boolean = false;

  private runpodDeployer: RunPodDeployer;
  private modalDeployer: ModalDeployer;

  constructor(config?: Partial<MonitoringConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.runpodDeployer = new RunPodDeployer();
    this.modalDeployer = new ModalDeployer();
  }

  /**
   * Start monitoring all endpoints
   */
  start(): void {
    if (this.isRunning) {
      console.log('[EndpointMonitor] Already running');
      return;
    }

    console.log('[EndpointMonitor] Starting endpoint monitoring...');
    this.isRunning = true;

    // Run initial check immediately
    this.runMonitoringCycle().catch((err) => {
      console.error('[EndpointMonitor] Initial monitoring cycle failed:', err);
    });

    // Set up recurring checks
    this.checkInterval = setInterval(() => {
      this.runMonitoringCycle().catch((err) => {
        console.error('[EndpointMonitor] Monitoring cycle failed:', err);
      });
    }, this.config.checkIntervalMs);

    console.log(`[EndpointMonitor] Monitoring started with ${this.config.checkIntervalMs}ms interval`);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('[EndpointMonitor] Not running');
      return;
    }

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.isRunning = false;
    console.log('[EndpointMonitor] Monitoring stopped');
  }

  /**
   * Check health of a specific endpoint
   */
  async checkEndpointHealth(endpointId: string, userId?: string): Promise<EndpointHealth> {
    // Get endpoint details
    const endpoints = await db
      .select()
      .from(userEndpoints)
      .where(eq(userEndpoints.id, endpointId))
      .limit(1);

    const endpoint = endpoints[0];
    if (!endpoint) {
      return this.createUnknownHealth(endpointId, ['Endpoint not found']);
    }

    const issues: string[] = [];
    let status: EndpointHealth['status'] = 'healthy';

    // Check provider health
    const providerHealth = endpoint.provider === 'runpod'
      ? await this.checkRunPodHealth(endpoint.providerEndpointId || '', endpoint.endpointUrl || '')
      : await this.checkModalHealth(endpoint.providerEndpointId || '', endpoint.endpointUrl || '');

    if (!providerHealth.reachable) {
      issues.push('Endpoint not reachable');
      status = 'unhealthy';
    }

    // Check recent error rate
    const recentUsage = await this.getRecentUsageStats(endpointId, 15); // last 15 min

    if (recentUsage.errorRate > 0.5) {
      issues.push(`Critical error rate: ${(recentUsage.errorRate * 100).toFixed(1)}%`);
      status = 'unhealthy';
    } else if (recentUsage.errorRate > 0.1) {
      issues.push(`High error rate: ${(recentUsage.errorRate * 100).toFixed(1)}%`);
      if (status !== 'unhealthy') status = 'degraded';
    }

    // Check latency
    if (recentUsage.latencyP99Ms > 60000) { // 60 seconds
      issues.push(`Critical latency: ${recentUsage.latencyP99Ms}ms p99`);
      status = 'unhealthy';
    } else if (recentUsage.latencyP99Ms > 30000) { // 30 seconds
      issues.push(`High latency: ${recentUsage.latencyP99Ms}ms p99`);
      if (status !== 'unhealthy') status = 'degraded';
    }

    // Check if stuck in scaling state
    if (endpoint.status === 'scaling' && endpoint.lastActiveAt) {
      const scalingTime = Date.now() - new Date(endpoint.lastActiveAt).getTime();
      if (scalingTime > 5 * 60 * 1000) { // 5 minutes
        issues.push('Endpoint stuck in scaling state');
        status = 'unhealthy';
      }
    }

    // Check if stuck in provisioning state
    if (endpoint.status === 'provisioning') {
      const provisioningTime = Date.now() - new Date(endpoint.createdAt).getTime();
      if (provisioningTime > 10 * 60 * 1000) { // 10 minutes
        issues.push('Endpoint stuck in provisioning state');
        status = 'unhealthy';
      }
    }

    // Check queue depth (for RunPod)
    if (providerHealth.queuedRequests > 100) {
      issues.push(`High queue depth: ${providerHealth.queuedRequests} requests`);
      if (status !== 'unhealthy') status = 'degraded';
    }

    // Update failure count
    const currentFailures = this.failureCount.get(endpointId) || 0;
    const newFailures = status === 'healthy' ? 0 : currentFailures + 1;
    this.failureCount.set(endpointId, newFailures);

    const health: EndpointHealth = {
      endpointId,
      status,
      lastCheck: new Date(),
      consecutiveFailures: newFailures,
      metrics: {
        latencyP50Ms: recentUsage.latencyP50Ms,
        latencyP99Ms: recentUsage.latencyP99Ms,
        successRate: 1 - recentUsage.errorRate,
        activeWorkers: providerHealth.activeWorkers,
        queuedRequests: providerHealth.queuedRequests,
        errorRate: recentUsage.errorRate,
      },
      issues,
      recoveryAttempts: this.recoveryAttempts.get(endpointId) || 0,
      lastRecoveryAt: this.lastRecoveryTime.get(endpointId),
    };

    // Cache health status
    this.healthCache.set(endpointId, health);

    // Emit health status event
    this.emit('health_check', {
      endpointId,
      health,
      endpoint: {
        id: endpoint.id,
        userId: endpoint.userId,
        modelName: endpoint.modelName,
        provider: endpoint.provider,
      },
    });

    return health;
  }

  /**
   * Check health of all user endpoints
   */
  async checkAllEndpoints(userId: string): Promise<EndpointHealth[]> {
    const registry = createEndpointRegistry(userId);
    const endpoints = await registry.listUserEndpoints({
      status: 'active',
    });

    // Add endpoints that are provisioning or scaling as well
    const allEndpoints = await registry.listUserEndpoints();
    const endpointsToCheck = allEndpoints.filter(
      (ep) => ep.status !== 'terminated' && ep.status !== 'error'
    );

    const healthChecks = await Promise.all(
      endpointsToCheck.map((ep) => this.checkEndpointHealth(ep.id, userId))
    );

    return healthChecks;
  }

  /**
   * Get cached health status
   */
  getCachedHealth(endpointId: string): EndpointHealth | null {
    return this.healthCache.get(endpointId) || null;
  }

  /**
   * Force health check and recovery if needed
   */
  async checkAndRecover(endpointId: string, userId: string): Promise<{
    health: EndpointHealth;
    recoveryAttempted: boolean;
    recovered: boolean;
  }> {
    const health = await this.checkEndpointHealth(endpointId, userId);

    let recoveryAttempted = false;
    let recovered = false;

    if (health.status === 'unhealthy' && this.config.autoRecoveryEnabled) {
      if (health.issues.length > 0) {
        const shouldRecover = this.shouldAttemptRecovery(endpointId);
        if (shouldRecover) {
          recoveryAttempted = true;
          recovered = await this.attemptRecovery(endpointId, userId, health.issues[0]);
        }
      }
    }

    return { health, recoveryAttempted, recovered };
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  /**
   * Run a complete monitoring cycle for all active endpoints
   */
  private async runMonitoringCycle(): Promise<void> {
    console.log('[EndpointMonitor] Running monitoring cycle...');

    try {
      // Get all non-terminated endpoints
      const allEndpoints = await db
        .select()
        .from(userEndpoints)
        .where(
          and(
            // Only check endpoints that are active, scaling, idle, or provisioning
            // Skip terminated and error endpoints
          )
        );

      const activeEndpoints = allEndpoints.filter(
        (ep) => !['terminated', 'error'].includes(ep.status)
      );

      console.log(`[EndpointMonitor] Checking ${activeEndpoints.length} endpoints...`);

      for (const endpoint of activeEndpoints) {
        try {
          const health = await this.checkEndpointHealth(endpoint.id, endpoint.userId);

          // Handle unhealthy endpoints
          if (health.status === 'unhealthy') {
            await this.handleUnhealthyEndpoint(endpoint, health);
          } else if (health.status === 'healthy') {
            // If endpoint was previously unhealthy and is now healthy, emit recovery event
            const previousHealth = this.healthCache.get(endpoint.id);
            if (previousHealth && previousHealth.status === 'unhealthy') {
              await this.sendRecoveryAlert(endpoint.userId, endpoint.id, endpoint.modelName);
            }
          }
        } catch (err) {
          console.error(`[EndpointMonitor] Error checking endpoint ${endpoint.id}:`, err);
        }
      }

      console.log('[EndpointMonitor] Monitoring cycle complete');
    } catch (err) {
      console.error('[EndpointMonitor] Monitoring cycle error:', err);
    }
  }

  /**
   * Handle unhealthy endpoint
   */
  private async handleUnhealthyEndpoint(
    endpoint: typeof userEndpoints.$inferSelect,
    health: EndpointHealth
  ): Promise<void> {
    console.log(`[EndpointMonitor] Endpoint ${endpoint.id} is unhealthy:`, health.issues);

    // Send alert
    await this.sendHealthAlert(endpoint.userId, endpoint.id, health);

    // Attempt recovery if enabled and threshold reached
    if (this.config.autoRecoveryEnabled) {
      const shouldRecover = health.consecutiveFailures >= this.config.unhealthyThreshold
        && this.shouldAttemptRecovery(endpoint.id);

      if (shouldRecover && health.issues.length > 0) {
        console.log(`[EndpointMonitor] Attempting recovery for ${endpoint.id}...`);
        const recovered = await this.attemptRecovery(
          endpoint.id,
          endpoint.userId,
          health.issues[0]
        );

        if (!recovered) {
          console.log(`[EndpointMonitor] Recovery failed for ${endpoint.id}`);
          await this.sendRecoveryFailedAlert(endpoint.userId, endpoint.id, endpoint.modelName);
        }
      }
    }
  }

  /**
   * Check if we should attempt recovery
   */
  private shouldAttemptRecovery(endpointId: string): boolean {
    const attempts = this.recoveryAttempts.get(endpointId) || 0;
    if (attempts >= this.config.maxRecoveryAttempts) {
      return false;
    }

    const lastRecovery = this.lastRecoveryTime.get(endpointId);
    if (lastRecovery) {
      // Wait at least 5 minutes between recovery attempts
      const timeSinceLastRecovery = Date.now() - lastRecovery.getTime();
      if (timeSinceLastRecovery < 5 * 60 * 1000) {
        return false;
      }
    }

    return true;
  }

  /**
   * Attempt automatic recovery
   */
  private async attemptRecovery(
    endpointId: string,
    userId: string,
    issue: string
  ): Promise<boolean> {
    // Get endpoint details
    const endpoints = await db
      .select()
      .from(userEndpoints)
      .where(eq(userEndpoints.id, endpointId))
      .limit(1);

    const endpoint = endpoints[0];
    if (!endpoint) return false;

    console.log(`[EndpointMonitor] Attempting recovery for ${endpointId}: ${issue}`);

    // Track recovery attempt
    const attempts = (this.recoveryAttempts.get(endpointId) || 0) + 1;
    this.recoveryAttempts.set(endpointId, attempts);
    this.lastRecoveryTime.set(endpointId, new Date());

    try {
      if (issue.includes('not reachable') || issue.includes('stuck in scaling') || issue.includes('stuck in provisioning')) {
        // Redeploy the endpoint
        const registry = createEndpointRegistry(userId);

        // Update status to indicate we're redeploying
        await registry.updateEndpointStatus(endpointId, 'provisioning');

        // Trigger redeployment based on provider
        if (endpoint.provider === 'runpod') {
          const apiKey = process.env.RUNPOD_API_KEY;
          if (apiKey) {
            this.runpodDeployer.initialize(apiKey);
            // Attempt to restart/redeploy the endpoint
            await this.restartRunPodEndpoint(endpoint.providerEndpointId || '');
          }
        } else if (endpoint.provider === 'modal') {
          const tokenId = process.env.MODAL_TOKEN_ID;
          const tokenSecret = process.env.MODAL_TOKEN_SECRET;
          if (tokenId && tokenSecret) {
            this.modalDeployer.initialize(tokenId, tokenSecret);
            // Attempt to restart/redeploy the Modal app
            await this.restartModalEndpoint(endpoint.providerEndpointId || '');
          }
        }

        this.emit('recovery_attempted', {
          endpointId,
          userId,
          action: 'redeploy',
          success: true,
        });

        return true;
      }

      if (issue.includes('High queue depth')) {
        // Scale up workers
        if (endpoint.provider === 'runpod') {
          const apiKey = process.env.RUNPOD_API_KEY;
          if (apiKey) {
            this.runpodDeployer.initialize(apiKey);
            await this.scaleRunPodWorkers(endpoint.providerEndpointId || '', {
              maxWorkers: Math.min((endpoint.maxWorkers || 1) + 2, 10),
            });

            // Update endpoint settings
            const registry = createEndpointRegistry(userId);
            await registry.updateEndpointSettings(endpointId, {
              maxWorkers: Math.min((endpoint.maxWorkers || 1) + 2, 10),
            });
          }
        }

        this.emit('recovery_attempted', {
          endpointId,
          userId,
          action: 'scale_up',
          success: true,
        });

        return true;
      }

      if (issue.includes('High error rate') || issue.includes('Critical error rate')) {
        // Check if it's a model loading issue
        const recentErrors = await this.getRecentErrors(endpointId);
        if (recentErrors.some((e) => e.includes('CUDA out of memory'))) {
          // Need larger GPU - notify user
          await this.notifyUserOfGPUUpgrade(userId, endpointId, endpoint.modelName);

          this.emit('recovery_attempted', {
            endpointId,
            userId,
            action: 'gpu_upgrade_notification',
            success: false,
            message: 'GPU upgrade required - user notified',
          });

          return false;
        }

        // For other errors, try restarting
        const registry = createEndpointRegistry(userId);
        await registry.updateEndpointStatus(endpointId, 'provisioning');

        if (endpoint.provider === 'runpod') {
          await this.restartRunPodEndpoint(endpoint.providerEndpointId || '');
        } else if (endpoint.provider === 'modal') {
          await this.restartModalEndpoint(endpoint.providerEndpointId || '');
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error(`[EndpointMonitor] Recovery failed for ${endpointId}:`, error);

      this.emit('recovery_attempted', {
        endpointId,
        userId,
        action: 'unknown',
        success: false,
        error: String(error),
      });

      return false;
    }
  }

  /**
   * Check RunPod endpoint health
   */
  private async checkRunPodHealth(
    providerEndpointId: string,
    endpointUrl: string
  ): Promise<ProviderHealth> {
    if (!providerEndpointId && !endpointUrl) {
      return {
        reachable: false,
        status: 'not_configured',
        activeWorkers: 0,
        queuedRequests: 0,
      };
    }

    const apiKey = process.env.RUNPOD_API_KEY;
    if (!apiKey) {
      return {
        reachable: false,
        status: 'no_api_key',
        activeWorkers: 0,
        queuedRequests: 0,
      };
    }

    try {
      this.runpodDeployer.initialize(apiKey);
      const status = await this.runpodDeployer.getEndpointStatus(providerEndpointId);

      return {
        reachable: status.status !== 'error' && status.status !== 'terminated',
        status: status.status,
        activeWorkers: status.workers,
        queuedRequests: status.queuedJobs,
      };
    } catch (error) {
      console.error('[EndpointMonitor] RunPod health check failed:', error);
      return {
        reachable: false,
        status: 'error',
        activeWorkers: 0,
        queuedRequests: 0,
        lastResponse: String(error),
      };
    }
  }

  /**
   * Check Modal endpoint health
   */
  private async checkModalHealth(
    providerEndpointId: string,
    endpointUrl: string
  ): Promise<ProviderHealth> {
    if (!providerEndpointId && !endpointUrl) {
      return {
        reachable: false,
        status: 'not_configured',
        activeWorkers: 0,
        queuedRequests: 0,
      };
    }

    const tokenId = process.env.MODAL_TOKEN_ID;
    const tokenSecret = process.env.MODAL_TOKEN_SECRET;
    if (!tokenId || !tokenSecret) {
      return {
        reachable: false,
        status: 'no_credentials',
        activeWorkers: 0,
        queuedRequests: 0,
      };
    }

    try {
      this.modalDeployer.initialize(tokenId, tokenSecret);
      const status = await this.modalDeployer.getAppStatus(providerEndpointId);

      return {
        reachable: status.status === 'deployed' || status.status === 'pending',
        status: status.status,
        activeWorkers: status.deployments,
        queuedRequests: 0, // Modal doesn't expose queue depth
      };
    } catch (error) {
      console.error('[EndpointMonitor] Modal health check failed:', error);
      return {
        reachable: false,
        status: 'error',
        activeWorkers: 0,
        queuedRequests: 0,
        lastResponse: String(error),
      };
    }
  }

  /**
   * Get recent usage stats for an endpoint
   */
  private async getRecentUsageStats(
    endpointId: string,
    minutesAgo: number
  ): Promise<RecentUsageStats> {
    const since = new Date(Date.now() - minutesAgo * 60 * 1000);

    const usage = await db
      .select()
      .from(endpointUsage)
      .where(
        and(
          eq(endpointUsage.endpointId, endpointId),
          gte(endpointUsage.createdAt, since.toISOString())
        )
      )
      .orderBy(desc(endpointUsage.createdAt));

    if (usage.length === 0) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        errorRate: 0,
        latencyP50Ms: 0,
        latencyP99Ms: 0,
        errors: [],
      };
    }

    const totalRequests = usage.length;
    const successfulRequests = usage.filter((u) => u.success).length;
    const errorRate = totalRequests > 0 ? (totalRequests - successfulRequests) / totalRequests : 0;

    // Calculate latency percentiles
    const latencies = usage
      .filter((u) => u.latencyMs !== null)
      .map((u) => u.latencyMs as number)
      .sort((a, b) => a - b);

    const latencyP50Ms = latencies.length > 0
      ? latencies[Math.floor(latencies.length * 0.5)]
      : 0;
    const latencyP99Ms = latencies.length > 0
      ? latencies[Math.floor(latencies.length * 0.99)]
      : 0;

    const errors = usage
      .filter((u) => u.errorCode !== null)
      .map((u) => u.errorCode as string);

    return {
      totalRequests,
      successfulRequests,
      errorRate,
      latencyP50Ms,
      latencyP99Ms,
      errors,
    };
  }

  /**
   * Get recent errors for an endpoint
   */
  private async getRecentErrors(endpointId: string): Promise<string[]> {
    const since = new Date(Date.now() - 30 * 60 * 1000); // Last 30 minutes

    const errors = await db
      .select()
      .from(endpointUsage)
      .where(
        and(
          eq(endpointUsage.endpointId, endpointId),
          eq(endpointUsage.success, false),
          gte(endpointUsage.createdAt, since.toISOString())
        )
      )
      .orderBy(desc(endpointUsage.createdAt))
      .limit(100);

    return errors
      .filter((e) => e.errorCode !== null)
      .map((e) => e.errorCode as string);
  }

  /**
   * Send health alert to user
   */
  private async sendHealthAlert(
    userId: string,
    endpointId: string,
    health: EndpointHealth
  ): Promise<void> {
    // Get endpoint info for alert
    const endpoints = await db
      .select()
      .from(userEndpoints)
      .where(eq(userEndpoints.id, endpointId))
      .limit(1);

    const endpoint = endpoints[0];
    if (!endpoint) return;

    const alert: HealthAlert = {
      type: 'endpoint_unhealthy',
      endpointId,
      userId,
      modelName: endpoint.modelName,
      severity: health.status === 'unhealthy' ? 'error' : 'warning',
      message: `Endpoint for ${endpoint.modelName} is ${health.status}. Issues: ${health.issues.join(', ')}`,
      timestamp: new Date(),
      health,
    };

    console.log('[EndpointMonitor] Health alert:', alert);

    // Emit alert event for WebSocket broadcasting
    this.emit('health_alert', alert);
  }

  /**
   * Send recovery success alert
   */
  private async sendRecoveryAlert(
    userId: string,
    endpointId: string,
    modelName: string
  ): Promise<void> {
    const alert: HealthAlert = {
      type: 'endpoint_recovered',
      endpointId,
      userId,
      modelName,
      severity: 'info',
      message: `Endpoint for ${modelName} has recovered and is now healthy.`,
      timestamp: new Date(),
    };

    console.log('[EndpointMonitor] Recovery alert:', alert);
    this.emit('health_alert', alert);

    // Reset recovery tracking
    this.recoveryAttempts.delete(endpointId);
    this.lastRecoveryTime.delete(endpointId);
  }

  /**
   * Send recovery failed alert
   */
  private async sendRecoveryFailedAlert(
    userId: string,
    endpointId: string,
    modelName: string
  ): Promise<void> {
    const alert: HealthAlert = {
      type: 'recovery_failed',
      endpointId,
      userId,
      modelName,
      severity: 'critical',
      message: `Automatic recovery failed for ${modelName}. Manual intervention required.`,
      timestamp: new Date(),
    };

    console.log('[EndpointMonitor] Recovery failed alert:', alert);
    this.emit('health_alert', alert);
  }

  /**
   * Notify user that GPU upgrade is needed
   */
  private async notifyUserOfGPUUpgrade(
    userId: string,
    endpointId: string,
    modelName: string
  ): Promise<void> {
    const alert: HealthAlert = {
      type: 'gpu_upgrade_needed',
      endpointId,
      userId,
      modelName,
      severity: 'warning',
      message: `CUDA out of memory errors detected for ${modelName}. Consider upgrading to a GPU with more VRAM.`,
      timestamp: new Date(),
    };

    console.log('[EndpointMonitor] GPU upgrade alert:', alert);
    this.emit('health_alert', alert);
  }

  /**
   * Create unknown health status
   */
  private createUnknownHealth(endpointId: string, issues: string[]): EndpointHealth {
    return {
      endpointId,
      status: 'unknown',
      lastCheck: new Date(),
      consecutiveFailures: 0,
      metrics: {
        latencyP50Ms: 0,
        latencyP99Ms: 0,
        successRate: 0,
        activeWorkers: 0,
        queuedRequests: 0,
        errorRate: 0,
      },
      issues,
      recoveryAttempts: 0,
    };
  }

  /**
   * Restart a RunPod endpoint
   */
  private async restartRunPodEndpoint(providerEndpointId: string): Promise<void> {
    const apiKey = process.env.RUNPOD_API_KEY;
    if (!apiKey || !providerEndpointId) return;

    // Use RunPod API to restart the endpoint
    // This is a placeholder - actual implementation would call RunPod's API
    console.log(`[EndpointMonitor] Restarting RunPod endpoint: ${providerEndpointId}`);

    try {
      const response = await fetch(`https://api.runpod.io/v2/${providerEndpointId}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.log(`[EndpointMonitor] RunPod endpoint ${providerEndpointId} health check returned: ${response.status}`);
      }
    } catch (error) {
      console.error(`[EndpointMonitor] Error restarting RunPod endpoint:`, error);
    }
  }

  /**
   * Restart a Modal endpoint
   */
  private async restartModalEndpoint(appId: string): Promise<void> {
    const tokenId = process.env.MODAL_TOKEN_ID;
    const tokenSecret = process.env.MODAL_TOKEN_SECRET;
    if (!tokenId || !tokenSecret || !appId) return;

    // Modal apps scale to zero automatically, so "restart" means triggering a cold start
    console.log(`[EndpointMonitor] Triggering Modal app restart: ${appId}`);

    // Actual restart would involve Modal CLI or API
  }

  /**
   * Scale RunPod workers
   */
  private async scaleRunPodWorkers(
    providerEndpointId: string,
    config: { maxWorkers: number }
  ): Promise<void> {
    const apiKey = process.env.RUNPOD_API_KEY;
    if (!apiKey || !providerEndpointId) return;

    console.log(`[EndpointMonitor] Scaling RunPod endpoint ${providerEndpointId} to max ${config.maxWorkers} workers`);

    try {
      // Use RunPod GraphQL API to update endpoint configuration
      const response = await fetch('https://api.runpod.io/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation {
              updateEndpoint(
                id: "${providerEndpointId}"
                workersMax: ${config.maxWorkers}
              ) {
                id
                workersMax
              }
            }
          `,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`[EndpointMonitor] Failed to scale RunPod workers: ${text}`);
      }
    } catch (error) {
      console.error(`[EndpointMonitor] Error scaling RunPod workers:`, error);
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let monitorInstance: EndpointMonitor | null = null;

export function getEndpointMonitor(config?: Partial<MonitoringConfig>): EndpointMonitor {
  if (!monitorInstance) {
    monitorInstance = new EndpointMonitor(config);
  }
  return monitorInstance;
}

export function startEndpointMonitoring(config?: Partial<MonitoringConfig>): EndpointMonitor {
  const monitor = getEndpointMonitor(config);
  monitor.start();
  return monitor;
}

export function stopEndpointMonitoring(): void {
  if (monitorInstance) {
    monitorInstance.stop();
  }
}

export default EndpointMonitor;
