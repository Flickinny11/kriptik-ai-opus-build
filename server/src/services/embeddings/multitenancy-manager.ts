/**
 * Multitenancy Manager for Qdrant VL-JEPA Collections
 *
 * Manages tenant isolation and scaling for the vector database:
 * - Track tenant sizes (vector count per tenant)
 * - Automatic promotion threshold
 * - Promotion scheduling (off-peak hours)
 * - Monitoring and alerting integration
 */

import { getQdrantClient, type QdrantClientWrapper } from './qdrant-client.js';
import { COLLECTION_NAMES, type CollectionName } from './collections.js';

// ============================================================================
// Configuration
// ============================================================================

export interface MultitenancyConfig {
  /** Vector count threshold for tenant promotion */
  promotionThreshold: number;
  /** Vector count threshold for demotion */
  demotionThreshold: number;
  /** Check interval in milliseconds */
  checkIntervalMs: number;
  /** Off-peak hours for promotion (0-23) */
  offPeakHoursStart: number;
  offPeakHoursEnd: number;
  /** Enable automatic promotion */
  autoPromoteEnabled: boolean;
}

const DEFAULT_CONFIG: MultitenancyConfig = {
  promotionThreshold: 10000, // 10K vectors
  demotionThreshold: 1000,   // 1K vectors
  checkIntervalMs: 60 * 60 * 1000, // 1 hour
  offPeakHoursStart: 2,  // 2 AM
  offPeakHoursEnd: 6,    // 6 AM
  autoPromoteEnabled: false, // Disabled by default
};

// ============================================================================
// Types
// ============================================================================

export interface TenantStats {
  tenantId: string;
  collections: Record<string, number>; // Collection name -> vector count
  totalVectors: number;
  isPromoted: boolean;
  lastChecked: string;
}

export interface PromotionEvent {
  tenantId: string;
  collectionName: string;
  action: 'promote' | 'demote';
  reason: string;
  vectorCount: number;
  timestamp: string;
  success: boolean;
  error?: string;
}

export interface TenantHealth {
  tenantId: string;
  healthy: boolean;
  collections: Array<{
    name: string;
    vectorCount: number;
    isPromoted: boolean;
    status: 'green' | 'yellow' | 'red';
  }>;
}

// ============================================================================
// Multitenancy Manager
// ============================================================================

export class MultitenancyManager {
  private client: QdrantClientWrapper;
  private config: MultitenancyConfig;
  private tenantCache: Map<string, TenantStats> = new Map();
  private promotionHistory: PromotionEvent[] = [];
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<MultitenancyConfig>) {
    this.client = getQdrantClient();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================================================
  // Tenant Statistics
  // ============================================================================

  /**
   * Get statistics for a tenant
   */
  async getTenantStats(tenantId: string): Promise<TenantStats> {
    const cached = this.tenantCache.get(tenantId);
    if (cached && this.isCacheValid(cached.lastChecked)) {
      return cached;
    }

    const collections: Record<string, number> = {};
    let totalVectors = 0;

    for (const collectionName of Object.values(COLLECTION_NAMES)) {
      const count = await this.client.countPoints(collectionName, {
        must: [{ key: 'tenant_id', match: { value: tenantId } }],
      });
      collections[collectionName] = count;
      totalVectors += count;
    }

    const stats: TenantStats = {
      tenantId,
      collections,
      totalVectors,
      isPromoted: false, // Would need to query shard info
      lastChecked: new Date().toISOString(),
    };

    this.tenantCache.set(tenantId, stats);
    return stats;
  }

  /**
   * Get statistics for all tenants in a collection
   */
  async getAllTenantsInCollection(collectionName: CollectionName): Promise<Map<string, number>> {
    const tenantCounts = new Map<string, number>();

    // Note: This is a simplified implementation
    // In production, you'd use Qdrant's aggregation features
    // or maintain a separate tenant registry

    // For now, return cached data
    for (const [tenantId, stats] of this.tenantCache) {
      if (stats.collections[collectionName]) {
        tenantCounts.set(tenantId, stats.collections[collectionName]);
      }
    }

    return tenantCounts;
  }

  /**
   * Get top tenants by vector count
   */
  async getTopTenants(limit = 10): Promise<TenantStats[]> {
    const allStats = Array.from(this.tenantCache.values());
    return allStats
      .sort((a, b) => b.totalVectors - a.totalVectors)
      .slice(0, limit);
  }

  // ============================================================================
  // Tenant Promotion/Demotion
  // ============================================================================

  /**
   * Check if tenant should be promoted
   */
  shouldPromote(stats: TenantStats): boolean {
    return stats.totalVectors >= this.config.promotionThreshold && !stats.isPromoted;
  }

  /**
   * Check if tenant should be demoted
   */
  shouldDemote(stats: TenantStats): boolean {
    return stats.totalVectors <= this.config.demotionThreshold && stats.isPromoted;
  }

  /**
   * Request tenant promotion
   */
  async requestPromotion(
    tenantId: string,
    collectionName: CollectionName,
    reason: string
  ): Promise<PromotionEvent> {
    const stats = await this.getTenantStats(tenantId);
    const vectorCount = stats.collections[collectionName] || 0;

    const event: PromotionEvent = {
      tenantId,
      collectionName,
      action: 'promote',
      reason,
      vectorCount,
      timestamp: new Date().toISOString(),
      success: false,
    };

    try {
      // Check if it's off-peak hours
      if (this.config.autoPromoteEnabled && !this.isOffPeakHours()) {
        event.error = 'Promotion scheduled for off-peak hours';
        this.promotionHistory.push(event);
        return event;
      }

      // Execute promotion
      const success = await this.client.promoteTenant(collectionName, tenantId);
      event.success = success;

      if (success) {
        // Update cache
        const cachedStats = this.tenantCache.get(tenantId);
        if (cachedStats) {
          cachedStats.isPromoted = true;
          this.tenantCache.set(tenantId, cachedStats);
        }
      }
    } catch (error) {
      event.error = error instanceof Error ? error.message : 'Unknown error';
    }

    this.promotionHistory.push(event);
    return event;
  }

  /**
   * Request tenant demotion
   */
  async requestDemotion(
    tenantId: string,
    collectionName: CollectionName,
    reason: string
  ): Promise<PromotionEvent> {
    const stats = await this.getTenantStats(tenantId);
    const vectorCount = stats.collections[collectionName] || 0;

    const event: PromotionEvent = {
      tenantId,
      collectionName,
      action: 'demote',
      reason,
      vectorCount,
      timestamp: new Date().toISOString(),
      success: false,
    };

    try {
      const success = await this.client.demoteTenant(collectionName, tenantId);
      event.success = success;

      if (success) {
        const cachedStats = this.tenantCache.get(tenantId);
        if (cachedStats) {
          cachedStats.isPromoted = false;
          this.tenantCache.set(tenantId, cachedStats);
        }
      }
    } catch (error) {
      event.error = error instanceof Error ? error.message : 'Unknown error';
    }

    this.promotionHistory.push(event);
    return event;
  }

  // ============================================================================
  // Automatic Monitoring
  // ============================================================================

  /**
   * Start automatic tenant monitoring
   */
  startMonitoring(): void {
    if (this.checkInterval) return;

    console.log('[Multitenancy] Starting tenant monitoring...');

    this.checkInterval = setInterval(
      () => this.checkAllTenants(),
      this.config.checkIntervalMs
    );
  }

  /**
   * Stop automatic monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[Multitenancy] Stopped tenant monitoring');
    }
  }

  /**
   * Check all tenants for promotion/demotion
   */
  async checkAllTenants(): Promise<void> {
    if (!this.config.autoPromoteEnabled) return;

    console.log('[Multitenancy] Checking tenant thresholds...');

    for (const [tenantId, stats] of this.tenantCache) {
      if (this.shouldPromote(stats)) {
        console.log(`[Multitenancy] Tenant ${tenantId} exceeds promotion threshold`);

        for (const collectionName of Object.values(COLLECTION_NAMES)) {
          if (stats.collections[collectionName] > this.config.promotionThreshold) {
            await this.requestPromotion(
              tenantId,
              collectionName,
              'Automatic promotion: exceeded threshold'
            );
          }
        }
      } else if (this.shouldDemote(stats)) {
        console.log(`[Multitenancy] Tenant ${tenantId} below demotion threshold`);

        for (const collectionName of Object.values(COLLECTION_NAMES)) {
          await this.requestDemotion(
            tenantId,
            collectionName,
            'Automatic demotion: below threshold'
          );
        }
      }
    }
  }

  // ============================================================================
  // Health & Monitoring
  // ============================================================================

  /**
   * Get tenant health status
   */
  async getTenantHealth(tenantId: string): Promise<TenantHealth> {
    const stats = await this.getTenantStats(tenantId);

    const collections = Object.entries(stats.collections).map(([name, count]) => ({
      name,
      vectorCount: count,
      isPromoted: stats.isPromoted,
      status: this.determineStatus(count, stats.isPromoted) as 'green' | 'yellow' | 'red',
    }));

    return {
      tenantId,
      healthy: collections.every(c => c.status !== 'red'),
      collections,
    };
  }

  /**
   * Get promotion history
   */
  getPromotionHistory(limit = 100): PromotionEvent[] {
    return this.promotionHistory.slice(-limit);
  }

  /**
   * Get recent promotions for tenant
   */
  getTenantPromotionHistory(tenantId: string, limit = 10): PromotionEvent[] {
    return this.promotionHistory
      .filter(e => e.tenantId === tenantId)
      .slice(-limit);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check if cache entry is still valid (within 5 minutes)
   */
  private isCacheValid(lastChecked: string): boolean {
    const cacheAge = Date.now() - new Date(lastChecked).getTime();
    return cacheAge < 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Check if current time is within off-peak hours
   */
  private isOffPeakHours(): boolean {
    const hour = new Date().getHours();
    return hour >= this.config.offPeakHoursStart && hour < this.config.offPeakHoursEnd;
  }

  /**
   * Determine status based on vector count and promotion state
   */
  private determineStatus(vectorCount: number, isPromoted: boolean): string {
    if (vectorCount > this.config.promotionThreshold && !isPromoted) {
      return 'yellow'; // Should be promoted but isn't
    }
    if (vectorCount > this.config.promotionThreshold * 2 && !isPromoted) {
      return 'red'; // Way over threshold
    }
    return 'green';
  }

  /**
   * Clear tenant cache
   */
  clearCache(): void {
    this.tenantCache.clear();
  }

  /**
   * Invalidate cache for specific tenant
   */
  invalidateTenant(tenantId: string): void {
    this.tenantCache.delete(tenantId);
  }

  /**
   * Get current configuration
   */
  getConfig(): MultitenancyConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<MultitenancyConfig>): void {
    this.config = { ...this.config, ...updates };

    // Restart monitoring if interval changed
    if (updates.checkIntervalMs && this.checkInterval) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let managerInstance: MultitenancyManager | null = null;

export function getMultitenancyManager(config?: Partial<MultitenancyConfig>): MultitenancyManager {
  if (!managerInstance) {
    managerInstance = new MultitenancyManager(config);
  }
  return managerInstance;
}

export function resetMultitenancyManager(): void {
  if (managerInstance) {
    managerInstance.stopMonitoring();
  }
  managerInstance = null;
}

export default MultitenancyManager;
