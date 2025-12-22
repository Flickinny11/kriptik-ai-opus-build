/**
 * Pre-computation Engine
 *
 * Utilizes user wait time (plan review, credential entry) to
 * pre-generate likely lattice cells. This speculative execution
 * can significantly reduce build time when the user approves the plan.
 *
 * Features:
 * - Non-blocking pre-computation of dependency-free cells
 * - Priority-based cell selection for maximum impact
 * - Automatic cancellation when context changes
 * - Memory-efficient caching with size limits
 * - Integration with LATTICE orchestrator
 *
 * Part of Phase 5: Pre-computation & Speculative (LATTICE)
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
    LatticeBlueprint,
    LatticeCell,
    VisualIdentity,
} from './intent-crystallizer.js';
import {
    CellBuilder,
    CellBuildResult,
    CellBuildContext,
    createCellBuilder,
} from './cell-builder.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Status of a precomputed cell
 */
export interface PrecomputedCellStatus {
    cellId: string;
    cellName: string;
    status: 'pending' | 'computing' | 'completed' | 'failed' | 'cancelled';
    startTime?: number;
    endTime?: number;
    result?: CellBuildResult;
    error?: string;
}

/**
 * Precomputation session state
 */
export interface PrecomputeSession {
    sessionId: string;
    blueprintId: string;
    startTime: number;
    status: 'active' | 'paused' | 'cancelled' | 'completed';
    cellStatuses: Map<string, PrecomputedCellStatus>;
    completedCount: number;
    failedCount: number;
    cancelledCount: number;
}

/**
 * Configuration for precompute engine
 */
export interface PrecomputeEngineConfig {
    maxConcurrentPrecomputes: number; // Max parallel precompute tasks (default: 3)
    maxCachedCells: number; // Max cells to keep in memory (default: 50)
    cellTTLMs: number; // Time to live for cached cells in ms (default: 5 minutes)
    priorityThreshold: number; // Min priority for precomputation (default: 5)
    projectId: string;
    userId: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: PrecomputeEngineConfig = {
    maxConcurrentPrecomputes: 3,
    maxCachedCells: 50,
    cellTTLMs: 5 * 60 * 1000, // 5 minutes
    priorityThreshold: 5,
    projectId: 'precompute',
    userId: 'system',
};

// ============================================================================
// PRECOMPUTE ENGINE CLASS
// ============================================================================

export class PrecomputeEngine extends EventEmitter {
    private cellBuilder: CellBuilder;
    private config: PrecomputeEngineConfig;

    // Cache of precomputed cells
    private precomputedCells: Map<string, {
        result: CellBuildResult;
        timestamp: number;
        blueprintId: string;
    }> = new Map();

    // Active precomputation promises
    private activePrecomputes: Map<string, Promise<CellBuildResult>> = new Map();

    // Current precomputation session
    private currentSession: PrecomputeSession | null = null;

    // Cancellation flag
    private cancelled: boolean = false;

    constructor(config?: Partial<PrecomputeEngineConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.cellBuilder = createCellBuilder({
            projectId: this.config.projectId,
            userId: this.config.userId,
            minQualityScore: 80, // Slightly lower threshold for precomputation
            maxRetries: 1, // Less retries for speculative execution
            enableAntiSlop: true,
            enableInterfaceVerification: true,
        });
    }

    /**
     * Start pre-computation for a blueprint
     *
     * Called when user is reviewing the plan or entering credentials.
     * Starts building cells that have no dependencies first.
     */
    async startPrecomputation(
        blueprint: LatticeBlueprint,
        context: CellBuildContext
    ): Promise<PrecomputeSession> {
        // Cancel any existing session
        if (this.currentSession) {
            await this.cancelPrecomputation();
        }

        const sessionId = `precompute_${uuidv4().slice(0, 12)}`;

        console.log(`[PrecomputeEngine] Starting precomputation session: ${sessionId}`);
        console.log(`[PrecomputeEngine] Blueprint: ${blueprint.appName} with ${blueprint.cells.length} cells`);

        this.cancelled = false;

        // Initialize session
        this.currentSession = {
            sessionId,
            blueprintId: blueprint.id,
            startTime: Date.now(),
            status: 'active',
            cellStatuses: new Map(),
            completedCount: 0,
            failedCount: 0,
            cancelledCount: 0,
        };

        // Find cells with no dependencies (can be built immediately)
        const noDependencyCells = blueprint.cells.filter(c =>
            (c.dependsOn?.length || 0) === 0 &&
            c.priority >= this.config.priorityThreshold
        );

        // Sort by priority (highest first)
        noDependencyCells.sort((a, b) => b.priority - a.priority);

        console.log(`[PrecomputeEngine] Found ${noDependencyCells.length} cells with no dependencies`);

        // Initialize cell statuses
        for (const cell of noDependencyCells) {
            this.currentSession.cellStatuses.set(cell.id, {
                cellId: cell.id,
                cellName: cell.name,
                status: 'pending',
            });
        }

        this.emit('session_start', {
            sessionId,
            blueprintId: blueprint.id,
            totalCells: noDependencyCells.length,
        });

        // Start precomputing cells (limited concurrency)
        const precomputePromises: Promise<void>[] = [];
        let activeCount = 0;

        for (const cell of noDependencyCells) {
            if (this.cancelled) break;

            // Wait for a slot to open up
            while (activeCount >= this.config.maxConcurrentPrecomputes && !this.cancelled) {
                await this.waitForSlot(precomputePromises);
                activeCount = this.activePrecomputes.size;
            }

            if (this.cancelled) break;

            // Start precomputing this cell
            const promise = this.precomputeCell(cell, context, blueprint.id);
            precomputePromises.push(promise);
            activeCount++;
        }

        // Wait for all remaining precomputes to complete
        await Promise.allSettled(precomputePromises);

        // Update session status
        if (this.currentSession && !this.cancelled) {
            this.currentSession.status = 'completed';
        }

        this.emit('session_complete', {
            sessionId,
            completedCount: this.currentSession?.completedCount || 0,
            failedCount: this.currentSession?.failedCount || 0,
            cancelledCount: this.currentSession?.cancelledCount || 0,
        });

        console.log(`[PrecomputeEngine] Session ${sessionId} complete: ${this.currentSession?.completedCount || 0} cells precomputed`);

        return this.currentSession!;
    }

    /**
     * Wait for a precompute slot to open up
     */
    private async waitForSlot(promises: Promise<void>[]): Promise<void> {
        if (promises.length === 0) return;
        await Promise.race(promises);
    }

    /**
     * Precompute a single cell
     */
    private async precomputeCell(
        cell: LatticeCell,
        context: CellBuildContext,
        blueprintId: string
    ): Promise<void> {
        if (this.cancelled || !this.currentSession) {
            this.updateCellStatus(cell.id, 'cancelled');
            return;
        }

        const startTime = Date.now();
        this.updateCellStatus(cell.id, 'computing', { startTime });

        console.log(`[PrecomputeEngine] Precomputing cell: ${cell.name}`);

        this.emit('cell_start', {
            cellId: cell.id,
            cellName: cell.name,
        });

        // Create promise for tracking
        const buildPromise = this.cellBuilder.buildCell(cell, context);
        this.activePrecomputes.set(cell.id, buildPromise);

        try {
            const result = await buildPromise;

            if (this.cancelled) {
                this.updateCellStatus(cell.id, 'cancelled');
                this.currentSession!.cancelledCount++;
                return;
            }

            const endTime = Date.now();

            if (result.success) {
                // Cache the result
                this.cacheResult(cell.id, result, blueprintId);

                this.updateCellStatus(cell.id, 'completed', {
                    startTime,
                    endTime,
                    result,
                });
                this.currentSession!.completedCount++;

                console.log(`[PrecomputeEngine] Cell precomputed: ${cell.name} (quality: ${result.qualityScore}, time: ${endTime - startTime}ms)`);
            } else {
                this.updateCellStatus(cell.id, 'failed', {
                    startTime,
                    endTime,
                    error: result.error || 'Build failed',
                });
                this.currentSession!.failedCount++;

                console.warn(`[PrecomputeEngine] Cell precompute failed: ${cell.name}`);
            }

            this.emit('cell_complete', {
                cellId: cell.id,
                cellName: cell.name,
                success: result.success,
                qualityScore: result.qualityScore,
                buildTime: endTime - startTime,
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            this.updateCellStatus(cell.id, 'failed', {
                startTime,
                endTime: Date.now(),
                error: errorMessage,
            });
            this.currentSession!.failedCount++;

            console.error(`[PrecomputeEngine] Cell precompute error: ${cell.name}`, errorMessage);

            this.emit('cell_error', {
                cellId: cell.id,
                cellName: cell.name,
                error: errorMessage,
            });

        } finally {
            this.activePrecomputes.delete(cell.id);
        }
    }

    /**
     * Update cell status in current session
     */
    private updateCellStatus(
        cellId: string,
        status: PrecomputedCellStatus['status'],
        data?: Partial<PrecomputedCellStatus>
    ): void {
        if (!this.currentSession) return;

        const existing = this.currentSession.cellStatuses.get(cellId);
        if (existing) {
            this.currentSession.cellStatuses.set(cellId, {
                ...existing,
                status,
                ...data,
            });
        }
    }

    /**
     * Cache a precomputed result
     */
    private cacheResult(
        cellId: string,
        result: CellBuildResult,
        blueprintId: string
    ): void {
        // Enforce cache size limit
        if (this.precomputedCells.size >= this.config.maxCachedCells) {
            // Remove oldest entries
            const sortedEntries = Array.from(this.precomputedCells.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp);

            const toRemove = Math.ceil(this.config.maxCachedCells * 0.2); // Remove 20%
            for (let i = 0; i < toRemove && i < sortedEntries.length; i++) {
                this.precomputedCells.delete(sortedEntries[i][0]);
            }
        }

        this.precomputedCells.set(cellId, {
            result,
            timestamp: Date.now(),
            blueprintId,
        });
    }

    /**
     * Get a precomputed cell if available
     */
    getPrecomputedCell(cellId: string): CellBuildResult | null {
        const cached = this.precomputedCells.get(cellId);

        if (!cached) {
            return null;
        }

        // Check TTL
        if (Date.now() - cached.timestamp > this.config.cellTTLMs) {
            this.precomputedCells.delete(cellId);
            return null;
        }

        console.log(`[PrecomputeEngine] Cache hit for cell: ${cellId}`);
        return cached.result;
    }

    /**
     * Check if a cell is precomputed and valid
     */
    hasPrecomputedCell(cellId: string): boolean {
        const cached = this.precomputedCells.get(cellId);

        if (!cached) {
            return false;
        }

        // Check TTL
        if (Date.now() - cached.timestamp > this.config.cellTTLMs) {
            this.precomputedCells.delete(cellId);
            return false;
        }

        return true;
    }

    /**
     * Get all precomputed cells for a blueprint
     */
    getPrecomputedCellsForBlueprint(blueprintId: string): Map<string, CellBuildResult> {
        const results = new Map<string, CellBuildResult>();
        const now = Date.now();

        for (const [cellId, cached] of this.precomputedCells) {
            if (cached.blueprintId === blueprintId) {
                // Check TTL
                if (now - cached.timestamp <= this.config.cellTTLMs) {
                    results.set(cellId, cached.result);
                } else {
                    this.precomputedCells.delete(cellId);
                }
            }
        }

        return results;
    }

    /**
     * Cancel current precomputation session
     */
    async cancelPrecomputation(): Promise<void> {
        this.cancelled = true;

        if (this.currentSession) {
            this.currentSession.status = 'cancelled';

            // Mark pending cells as cancelled
            for (const [cellId, status] of this.currentSession.cellStatuses) {
                if (status.status === 'pending' || status.status === 'computing') {
                    this.updateCellStatus(cellId, 'cancelled');
                    this.currentSession.cancelledCount++;
                }
            }

            this.emit('session_cancelled', {
                sessionId: this.currentSession.sessionId,
            });

            console.log(`[PrecomputeEngine] Session cancelled: ${this.currentSession.sessionId}`);
        }

        // Wait for active precomputes to finish (they'll check the cancelled flag)
        const activePromises = Array.from(this.activePrecomputes.values());
        if (activePromises.length > 0) {
            await Promise.allSettled(activePromises);
        }

        this.activePrecomputes.clear();
        this.currentSession = null;
    }

    /**
     * Pause precomputation (stop starting new cells but let running ones finish)
     */
    pausePrecomputation(): void {
        if (this.currentSession) {
            this.currentSession.status = 'paused';

            this.emit('session_paused', {
                sessionId: this.currentSession.sessionId,
            });

            console.log(`[PrecomputeEngine] Session paused: ${this.currentSession.sessionId}`);
        }
    }

    /**
     * Resume precomputation after pause
     */
    resumePrecomputation(): void {
        if (this.currentSession && this.currentSession.status === 'paused') {
            this.currentSession.status = 'active';

            this.emit('session_resumed', {
                sessionId: this.currentSession.sessionId,
            });

            console.log(`[PrecomputeEngine] Session resumed: ${this.currentSession.sessionId}`);
        }
    }

    /**
     * Clear all cached cells
     */
    clearCache(): void {
        this.precomputedCells.clear();
        console.log('[PrecomputeEngine] Cache cleared');
    }

    /**
     * Clear cached cells for a specific blueprint
     */
    clearBlueprintCache(blueprintId: string): void {
        for (const [cellId, cached] of this.precomputedCells) {
            if (cached.blueprintId === blueprintId) {
                this.precomputedCells.delete(cellId);
            }
        }
        console.log(`[PrecomputeEngine] Cache cleared for blueprint: ${blueprintId}`);
    }

    /**
     * Get current session status
     */
    getCurrentSession(): PrecomputeSession | null {
        return this.currentSession;
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        maxSize: number;
        blueprints: string[];
    } {
        const blueprints = new Set<string>();
        for (const cached of this.precomputedCells.values()) {
            blueprints.add(cached.blueprintId);
        }

        return {
            size: this.precomputedCells.size,
            maxSize: this.config.maxCachedCells,
            blueprints: Array.from(blueprints),
        };
    }

    /**
     * Update configuration
     */
    setConfig(config: Partial<PrecomputeEngineConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get current configuration
     */
    getConfig(): PrecomputeEngineConfig {
        return { ...this.config };
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createPrecomputeEngine(
    config?: Partial<PrecomputeEngineConfig>
): PrecomputeEngine {
    return new PrecomputeEngine(config);
}

export default PrecomputeEngine;
