/**
 * Server Memory Manager
 *
 * Enterprise-grade memory management for serverless and long-running processes.
 * Prevents memory leaks and optimizes resource usage at scale.
 *
 * Features:
 * - Memory pressure monitoring
 * - Automatic garbage collection triggers
 * - Cache eviction policies
 * - Memory-based request throttling
 * - Resource cleanup coordination
 */

import { getRedis } from './redis.js';

// ============================================================================
// TYPES
// ============================================================================

export interface MemoryStats {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    heapUsedPercent: number;
    timestamp: number;
}

export interface MemoryThresholds {
    warning: number;      // Warning level (percent)
    critical: number;     // Critical level (percent)
    maxHeapMB: number;    // Max heap size in MB
}

export interface CleanupCallback {
    name: string;
    priority: number;     // Lower = runs first
    callback: () => Promise<number>;  // Returns bytes freed
}

export interface MemoryPressureEvent {
    level: 'normal' | 'warning' | 'critical';
    heapUsedPercent: number;
    heapUsedMB: number;
    heapTotalMB: number;
    timestamp: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_THRESHOLDS: MemoryThresholds = {
    warning: 70,          // 70% heap usage
    critical: 85,         // 85% heap usage
    maxHeapMB: 512,       // 512MB for serverless
};

const MONITORING_INTERVAL = 30000;  // 30 seconds
const STATS_HISTORY_SIZE = 100;     // Keep last 100 samples

// ============================================================================
// MEMORY MANAGER CLASS
// ============================================================================

class MemoryManager {
    private thresholds: MemoryThresholds;
    private cleanupCallbacks: CleanupCallback[] = [];
    private statsHistory: MemoryStats[] = [];
    private monitorTimer: NodeJS.Timeout | null = null;
    private lastPressureLevel: 'normal' | 'warning' | 'critical' = 'normal';
    private serverId: string;
    private stats = {
        cleanupRuns: 0,
        bytesFreed: 0,
        gcForced: 0,
        throttledRequests: 0,
    };

    constructor(thresholds: Partial<MemoryThresholds> = {}) {
        this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
        this.serverId = `srv-${Date.now().toString(36)}`;
    }

    /**
     * Start memory monitoring
     */
    start(): void {
        if (this.monitorTimer) return;

        console.log('[MemoryManager] Starting memory monitoring');
        this.monitorTimer = setInterval(() => {
            this.checkMemory();
        }, MONITORING_INTERVAL);

        // Initial check
        this.checkMemory();
    }

    /**
     * Stop memory monitoring
     */
    stop(): void {
        if (this.monitorTimer) {
            clearInterval(this.monitorTimer);
            this.monitorTimer = null;
            console.log('[MemoryManager] Stopped memory monitoring');
        }
    }

    /**
     * Get current memory stats
     */
    getStats(): MemoryStats {
        const mem = process.memoryUsage();
        return {
            heapUsed: mem.heapUsed,
            heapTotal: mem.heapTotal,
            external: mem.external,
            rss: mem.rss,
            heapUsedPercent: (mem.heapUsed / mem.heapTotal) * 100,
            timestamp: Date.now(),
        };
    }

    /**
     * Get memory stats history
     */
    getStatsHistory(): MemoryStats[] {
        return [...this.statsHistory];
    }

    /**
     * Check current memory pressure level
     */
    getPressureLevel(): 'normal' | 'warning' | 'critical' {
        const stats = this.getStats();
        const heapUsedMB = stats.heapUsed / (1024 * 1024);

        // Check absolute limit first
        if (heapUsedMB >= this.thresholds.maxHeapMB) {
            return 'critical';
        }

        if (stats.heapUsedPercent >= this.thresholds.critical) {
            return 'critical';
        }

        if (stats.heapUsedPercent >= this.thresholds.warning) {
            return 'warning';
        }

        return 'normal';
    }

    /**
     * Check if request should be throttled due to memory pressure
     */
    shouldThrottleRequest(): { throttle: boolean; reason?: string } {
        const level = this.getPressureLevel();

        if (level === 'critical') {
            this.stats.throttledRequests++;
            return {
                throttle: true,
                reason: 'Server under critical memory pressure',
            };
        }

        return { throttle: false };
    }

    /**
     * Register a cleanup callback
     */
    registerCleanup(callback: CleanupCallback): void {
        this.cleanupCallbacks.push(callback);
        this.cleanupCallbacks.sort((a, b) => a.priority - b.priority);
        console.log(`[MemoryManager] Registered cleanup: ${callback.name}`);
    }

    /**
     * Unregister a cleanup callback
     */
    unregisterCleanup(name: string): void {
        this.cleanupCallbacks = this.cleanupCallbacks.filter(c => c.name !== name);
    }

    /**
     * Run memory cleanup
     */
    async runCleanup(force: boolean = false): Promise<number> {
        const level = this.getPressureLevel();

        if (!force && level === 'normal') {
            return 0;
        }

        console.log(`[MemoryManager] Running cleanup (level: ${level}, force: ${force})`);
        this.stats.cleanupRuns++;

        let totalFreed = 0;

        for (const cleanup of this.cleanupCallbacks) {
            try {
                const freed = await cleanup.callback();
                totalFreed += freed;
                console.log(`[MemoryManager] ${cleanup.name} freed ${formatBytes(freed)}`);
            } catch (error) {
                console.error(`[MemoryManager] Cleanup ${cleanup.name} failed:`, error);
            }
        }

        // Force garbage collection if available
        if (level === 'critical' && global.gc) {
            console.log('[MemoryManager] Forcing garbage collection');
            global.gc();
            this.stats.gcForced++;
        }

        this.stats.bytesFreed += totalFreed;
        console.log(`[MemoryManager] Total freed: ${formatBytes(totalFreed)}`);

        return totalFreed;
    }

    /**
     * Internal memory check
     */
    private async checkMemory(): Promise<void> {
        const stats = this.getStats();

        // Add to history
        this.statsHistory.push(stats);
        if (this.statsHistory.length > STATS_HISTORY_SIZE) {
            this.statsHistory.shift();
        }

        const level = this.getPressureLevel();

        // Log state changes
        if (level !== this.lastPressureLevel) {
            const event: MemoryPressureEvent = {
                level,
                heapUsedPercent: stats.heapUsedPercent,
                heapUsedMB: stats.heapUsed / (1024 * 1024),
                heapTotalMB: stats.heapTotal / (1024 * 1024),
                timestamp: stats.timestamp,
            };

            console.log(`[MemoryManager] Pressure level changed: ${this.lastPressureLevel} -> ${level}`, event);

            // Record to Redis for distributed monitoring
            this.recordPressureEvent(event).catch(console.error);

            this.lastPressureLevel = level;
        }

        // Run cleanup if needed
        if (level !== 'normal') {
            await this.runCleanup();
        }
    }

    /**
     * Record pressure event to Redis
     */
    private async recordPressureEvent(event: MemoryPressureEvent): Promise<void> {
        try {
            const redis = getRedis();
            const key = `memory:pressure:${this.serverId}`;
            await redis.set(key, event, { ex: 300 }); // 5 minute expiry
        } catch (error) {
            // Non-critical, just log
            console.warn('[MemoryManager] Failed to record pressure event:', error);
        }
    }

    /**
     * Get memory manager statistics
     */
    getManagerStats() {
        return {
            ...this.stats,
            currentLevel: this.getPressureLevel(),
            currentStats: this.getStats(),
            historySize: this.statsHistory.length,
            registeredCleanups: this.cleanupCallbacks.map(c => c.name),
        };
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let memoryManager: MemoryManager | null = null;

export function getMemoryManager(): MemoryManager {
    if (!memoryManager) {
        memoryManager = new MemoryManager();
        memoryManager.start();
    }
    return memoryManager;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Check if request should be throttled
 */
export function shouldThrottleForMemory(): { throttle: boolean; reason?: string } {
    return getMemoryManager().shouldThrottleRequest();
}

/**
 * Get current memory pressure level
 */
export function getMemoryPressureLevel(): 'normal' | 'warning' | 'critical' {
    return getMemoryManager().getPressureLevel();
}

/**
 * Get current memory stats
 */
export function getCurrentMemoryStats(): MemoryStats {
    return getMemoryManager().getStats();
}

/**
 * Register a cleanup callback
 */
export function registerMemoryCleanup(
    name: string,
    priority: number,
    callback: () => Promise<number>
): void {
    getMemoryManager().registerCleanup({ name, priority, callback });
}

/**
 * Force memory cleanup
 */
export async function forceMemoryCleanup(): Promise<number> {
    return getMemoryManager().runCleanup(true);
}

export default {
    getMemoryManager,
    shouldThrottleForMemory,
    getMemoryPressureLevel,
    getCurrentMemoryStats,
    registerMemoryCleanup,
    forceMemoryCleanup,
};
