/**
 * Lattice Orchestrator
 *
 * Coordinates parallel cell building with:
 * - Maximum parallelism based on dependency graph
 * - Real-time progress tracking via EventEmitter
 * - Automatic retry with burst generation for failed cells
 * - Interface contract enforcement
 * - Intelligent file merging for combined output
 *
 * Part of Phase 2: Parallel Cell Builder (LATTICE)
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
import type { AppSoulType } from '../ai/app-soul.js';
// SESSION 2: Import WebSocket sync for real-time context sharing between cells
import {
    getWebSocketSyncService,
    type WebSocketSyncService,
} from '../agents/websocket-sync.js';
// SESSION 2: Import UnifiedContext for rich shared context
import {
    loadUnifiedContext,
    type UnifiedContext,
} from '../ai/unified-context.js';

/**
 * SESSION 2: Shared build context passed between parallel cells
 */
export interface SharedBuildContext {
    unifiedContext: UnifiedContext | null;
    fileModifications: Map<string, { cellId: string; content: string; timestamp: number }>;
    completedCellSummaries: Map<string, string>;
    errorHistory: Array<{ cellId: string; error: string; timestamp: number }>;
}

/**
 * SESSION 2: File modification notification
 */
export interface FileModification {
    path: string;
    content: string;
    cellId: string;
    timestamp: number;
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Real-time progress information
 */
export interface LatticeProgress {
    buildId: string;
    totalCells: number;
    completedCells: number;
    successfulCells: number;
    failedCells: number;
    inProgressCells: string[];
    failedCellIds: string[];
    currentGroup: number;
    totalGroups: number;
    elapsedTime: number; // ms
    estimatedTimeRemaining: number; // ms
    speedMultiplier: number; // vs sequential
    percentComplete: number;
}

/**
 * Final build result
 */
export interface LatticeResult {
    buildId: string;
    success: boolean;
    files: Array<{ path: string; content: string; language: string }>;
    buildTime: number; // ms
    speedup: number; // vs estimated sequential
    cellResults: Map<string, CellBuildResult>;
    failedCells: string[];
    totalCells: number;
    successfulCells: number;
    averageQualityScore: number;
    errors: string[];
}

/**
 * Build context passed to the orchestrator
 */
export interface LatticeBuildContext {
    appSoul: string;
    appSoulType?: AppSoulType;
    visualIdentity: VisualIdentity;
    projectPath?: string;
    framework: string;
    styling: string;
}

/**
 * Configuration for the orchestrator
 */
export interface LatticeOrchestratorConfig {
    maxRetries: number; // Max retries per cell (default: 3)
    burstConcurrency: number; // Parallel builds for burst mode (default: 3)
    enableBurstMode: boolean; // Use burst mode for complex cells (default: true)
    minQualityScore: number; // Minimum quality to accept (default: 85)
    projectId: string;
    userId: string;
}

/**
 * Events emitted by the orchestrator
 */
export interface LatticeOrchestratorEvents {
    buildStart: { buildId: string; blueprint: LatticeBlueprint };
    groupStart: { buildId: string; groupIndex: number; cells: string[]; totalGroups: number };
    cellStart: { buildId: string; cellId: string; cellName: string; attempt: number };
    cellComplete: { buildId: string; cellId: string; success: boolean; result: CellBuildResult };
    cellRetry: { buildId: string; cellId: string; attempt: number; reason: string };
    groupComplete: { buildId: string; groupIndex: number; results: CellBuildResult[] };
    progress: LatticeProgress;
    buildComplete: LatticeResult;
    buildError: { buildId: string; error: string };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: LatticeOrchestratorConfig = {
    maxRetries: 3,
    burstConcurrency: 3,
    enableBurstMode: true,
    minQualityScore: 85,
    projectId: 'lattice-orchestrator',
    userId: 'system',
};

// Complexity time estimates in milliseconds
const COMPLEXITY_TIME_MS: Record<string, number> = {
    simple: 30000,   // 30 seconds
    medium: 90000,   // 1.5 minutes
    complex: 180000, // 3 minutes
};

// ============================================================================
// LATTICE ORCHESTRATOR CLASS
// ============================================================================

export class LatticeOrchestrator extends EventEmitter {
    private cellBuilder: CellBuilder;
    private config: LatticeOrchestratorConfig;
    private activeBuild: {
        id: string;
        startTime: number;
        inProgress: Set<string>;
    } | null = null;

    // SESSION 2: Shared context for parallel cell awareness
    private wsSync: WebSocketSyncService;
    private sharedContext: SharedBuildContext;
    private activeCellBuilders: Map<string, { notify: (mod: FileModification) => void }> = new Map();

    constructor(config?: Partial<LatticeOrchestratorConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.cellBuilder = createCellBuilder({
            minQualityScore: this.config.minQualityScore,
            maxRetries: 1, // We handle retries at orchestrator level
            enableAntiSlop: true,
            enableInterfaceVerification: true,
            projectId: this.config.projectId,
            userId: this.config.userId,
        });

        // SESSION 2: Initialize WebSocket sync for real-time context sharing
        this.wsSync = getWebSocketSyncService();

        // SESSION 2: Initialize shared context
        this.sharedContext = {
            unifiedContext: null,
            fileModifications: new Map(),
            completedCellSummaries: new Map(),
            errorHistory: [],
        };
    }

    /**
     * Build an entire lattice blueprint
     * SESSION 2: Now loads and shares UnifiedContext between all parallel cells
     */
    async build(
        blueprint: LatticeBlueprint,
        context: LatticeBuildContext
    ): Promise<LatticeResult> {
        const buildId = `build_${uuidv4().slice(0, 12)}`;
        const startTime = Date.now();

        console.log(`[LatticeOrchestrator] Starting build ${buildId} for "${blueprint.appName}"`);
        console.log(`[LatticeOrchestrator] Total cells: ${blueprint.cells.length}, Parallel groups: ${blueprint.parallelGroups.length}`);

        this.activeBuild = {
            id: buildId,
            startTime,
            inProgress: new Set(),
        };

        // SESSION 2: Load unified context for shared awareness between cells
        try {
            if (context.projectPath) {
                this.sharedContext.unifiedContext = await loadUnifiedContext(
                    this.config.projectId,
                    this.config.userId,
                    context.projectPath,
                    {
                        includeIntentLock: true,
                        includeLearningData: true,
                        includeErrorHistory: true,
                        includeVerificationResults: true,
                    }
                );
                console.log(`[LatticeOrchestrator] Loaded unified context: ${this.sharedContext.unifiedContext.learnedPatterns.length} patterns`);
            }
        } catch (error) {
            console.warn('[LatticeOrchestrator] Failed to load unified context (non-fatal):', error);
        }

        // Reset shared context for new build
        this.sharedContext.fileModifications.clear();
        this.sharedContext.completedCellSummaries.clear();
        this.sharedContext.errorHistory = [];

        this.emit('buildStart', { buildId, blueprint });

        const completedCells = new Map<string, CellBuildResult>();
        const failedCellIds: string[] = [];
        const errors: string[] = [];

        try {
            // Process parallel groups in order
            for (let groupIndex = 0; groupIndex < blueprint.parallelGroups.length; groupIndex++) {
                const group = blueprint.parallelGroups[groupIndex];

                console.log(`[LatticeOrchestrator] Processing group ${groupIndex + 1}/${blueprint.parallelGroups.length}: ${group.length} cells`);

                this.emit('groupStart', {
                    buildId,
                    groupIndex,
                    cells: group,
                    totalGroups: blueprint.parallelGroups.length,
                });

                // Mark cells as in progress
                for (const cellId of group) {
                    this.activeBuild.inProgress.add(cellId);
                }

                // Build cell context with completed dependencies
                // SESSION 2: Now includes sharedContext for real-time awareness
                const buildContext: CellBuildContext = {
                    appSoul: context.appSoul,
                    appSoulType: context.appSoulType,
                    visualIdentity: context.visualIdentity,
                    completedCells,
                    projectPath: context.projectPath,
                    framework: context.framework,
                    styling: context.styling,
                };

                // Build all cells in this group in parallel
                const groupResults = await Promise.all(
                    group.map(async (cellId) => {
                        const cell = blueprint.cells.find(c => c.id === cellId);
                        if (!cell) {
                            console.error(`[LatticeOrchestrator] Cell not found: ${cellId}`);
                            return this.createFailedResult(cellId, 'Cell not found in blueprint');
                        }

                        this.emit('cellStart', {
                            buildId,
                            cellId: cell.id,
                            cellName: cell.name,
                            attempt: 1,
                        });

                        return this.buildCellWithRetry(cell, buildContext, buildId);
                    })
                );

                // Process results
                for (const result of groupResults) {
                    this.activeBuild.inProgress.delete(result.cellId);

                    if (result.success) {
                        completedCells.set(result.cellId, result);
                    } else {
                        failedCellIds.push(result.cellId);
                        if (result.error) {
                            errors.push(`Cell "${result.cellName}" failed: ${result.error}`);
                        }
                    }

                    this.emit('cellComplete', {
                        buildId,
                        cellId: result.cellId,
                        success: result.success,
                        result,
                    });

                    // Emit progress update
                    this.emitProgress(buildId, blueprint, completedCells, failedCellIds, startTime, groupIndex);
                }

                this.emit('groupComplete', { buildId, groupIndex, results: groupResults });
            }

            // Synthesize all files from completed cells
            const allFiles = this.synthesizeFiles(completedCells);

            // Calculate metrics
            const buildTime = Date.now() - startTime;
            const speedup = blueprint.estimatedTotalTime > 0
                ? blueprint.estimatedTotalTime / (buildTime / 1000)
                : 1;

            const qualityScores = Array.from(completedCells.values())
                .map(r => r.qualityScore)
                .filter(s => s > 0);
            const averageQualityScore = qualityScores.length > 0
                ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
                : 0;

            const result: LatticeResult = {
                buildId,
                success: failedCellIds.length === 0,
                files: allFiles,
                buildTime,
                speedup,
                cellResults: completedCells,
                failedCells: failedCellIds,
                totalCells: blueprint.cells.length,
                successfulCells: completedCells.size,
                averageQualityScore: Math.round(averageQualityScore),
                errors,
            };

            console.log(`[LatticeOrchestrator] Build ${buildId} complete: ${completedCells.size}/${blueprint.cells.length} cells, ${buildTime}ms, ${speedup.toFixed(1)}x speedup`);

            this.emit('buildComplete', result);
            this.activeBuild = null;

            return result;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[LatticeOrchestrator] Build ${buildId} failed:`, errorMessage);

            this.emit('buildError', { buildId, error: errorMessage });
            this.activeBuild = null;

            return {
                buildId,
                success: false,
                files: [],
                buildTime: Date.now() - startTime,
                speedup: 0,
                cellResults: completedCells,
                failedCells: failedCellIds,
                totalCells: blueprint.cells.length,
                successfulCells: completedCells.size,
                averageQualityScore: 0,
                errors: [...errors, errorMessage],
            };
        }
    }

    /**
     * Build a single cell with automatic retry
     */
    private async buildCellWithRetry(
        cell: LatticeCell,
        context: CellBuildContext,
        buildId: string,
        attempt: number = 1
    ): Promise<CellBuildResult> {
        const result = await this.cellBuilder.buildCell(cell, context, attempt);

        if (result.success) {
            return result;
        }

        // Check if we should retry
        if (attempt < this.config.maxRetries) {
            const reason = result.error || 'Quality threshold not met';
            console.log(`[LatticeOrchestrator] Retrying cell "${cell.name}", attempt ${attempt + 1}/${this.config.maxRetries}: ${reason}`);

            this.emit('cellRetry', {
                buildId,
                cellId: cell.id,
                attempt: attempt + 1,
                reason,
            });

            // Use burst mode for complex cells on retry
            if (this.config.enableBurstMode && cell.estimatedComplexity === 'complex') {
                return this.burstBuildCell(cell, context, buildId);
            }

            // Exponential backoff before retry
            await this.sleep(Math.pow(2, attempt - 1) * 1000);

            return this.buildCellWithRetry(cell, context, buildId, attempt + 1);
        }

        // All retries exhausted
        return result;
    }

    /**
     * Burst build: Run multiple parallel builds and pick the best
     */
    private async burstBuildCell(
        cell: LatticeCell,
        context: CellBuildContext,
        buildId: string
    ): Promise<CellBuildResult> {
        console.log(`[LatticeOrchestrator] Burst building cell "${cell.name}" with ${this.config.burstConcurrency} parallel attempts`);

        // Spawn multiple generators racing
        const buildPromises = Array.from(
            { length: this.config.burstConcurrency },
            (_, i) => this.cellBuilder.buildCell(cell, context, i + 1)
        );

        const results = await Promise.all(buildPromises);

        // Filter successful results with valid interface compliance
        const successful = results.filter(r =>
            r.success &&
            r.interfaceCompliance.inputsValid &&
            r.interfaceCompliance.outputsValid
        );

        if (successful.length > 0) {
            // Pick the best by quality score
            const best = successful.sort((a, b) => b.qualityScore - a.qualityScore)[0];
            console.log(`[LatticeOrchestrator] Burst build selected best result: quality=${best.qualityScore}`);
            return best;
        }

        // No fully successful builds - pick the one with highest quality
        const best = results.sort((a, b) => b.qualityScore - a.qualityScore)[0];
        console.warn(`[LatticeOrchestrator] Burst build failed, returning best attempt: quality=${best.qualityScore}`);
        return best;
    }

    /**
     * Emit progress update
     */
    private emitProgress(
        buildId: string,
        blueprint: LatticeBlueprint,
        completed: Map<string, CellBuildResult>,
        failed: string[],
        startTime: number,
        currentGroup: number
    ): void {
        const elapsedTime = Date.now() - startTime;
        const completedCount = completed.size;
        const totalCells = blueprint.cells.length;
        const percentComplete = Math.round((completedCount / totalCells) * 100);

        // Estimate remaining time based on current progress
        const avgTimePerCell = completedCount > 0 ? elapsedTime / completedCount : 0;
        const remainingCells = totalCells - completedCount - failed.length;
        const estimatedTimeRemaining = Math.round(avgTimePerCell * remainingCells);

        const progress: LatticeProgress = {
            buildId,
            totalCells,
            completedCells: completedCount,
            successfulCells: completedCount,
            failedCells: failed.length,
            inProgressCells: Array.from(this.activeBuild?.inProgress || []),
            failedCellIds: failed,
            currentGroup: currentGroup + 1,
            totalGroups: blueprint.parallelGroups.length,
            elapsedTime,
            estimatedTimeRemaining,
            speedMultiplier: blueprint.estimatedTotalTime / blueprint.estimatedParallelTime,
            percentComplete,
        };

        this.emit('progress', progress);
    }

    /**
     * Synthesize all files from completed cells
     */
    private synthesizeFiles(
        completedCells: Map<string, CellBuildResult>
    ): Array<{ path: string; content: string; language: string }> {
        const fileMap = new Map<string, { content: string; language: string; sources: string[] }>();

        // Collect all files, tracking sources for merge conflicts
        for (const [cellId, result] of completedCells) {
            for (const file of result.files) {
                if (fileMap.has(file.path)) {
                    const existing = fileMap.get(file.path)!;
                    // Merge file contents intelligently
                    existing.content = this.mergeFileContents(
                        existing.content,
                        file.content,
                        file.path
                    );
                    existing.sources.push(cellId);
                } else {
                    fileMap.set(file.path, {
                        content: file.content,
                        language: file.language,
                        sources: [cellId],
                    });
                }
            }
        }

        return Array.from(fileMap.entries()).map(([path, data]) => ({
            path,
            content: data.content,
            language: data.language,
        }));
    }

    /**
     * Intelligently merge file contents
     * This is where interface contracts guarantee minimal conflicts
     */
    private mergeFileContents(
        existing: string,
        incoming: string,
        filePath: string
    ): string {
        // For TypeScript/JavaScript files, do intelligent merging
        if (/\.(ts|tsx|js|jsx)$/.test(filePath)) {
            return this.mergeCodeFiles(existing, incoming);
        }

        // For CSS files, combine styles
        if (/\.(css|scss|less)$/.test(filePath)) {
            return this.mergeCssFiles(existing, incoming);
        }

        // For other files, concatenate with separator
        return `${existing}\n\n// ============ MERGED CONTENT ============\n\n${incoming}`;
    }

    /**
     * Merge TypeScript/JavaScript files intelligently
     */
    private mergeCodeFiles(existing: string, incoming: string): string {
        // Extract imports from both files
        const existingImports = this.extractImports(existing);
        const incomingImports = this.extractImports(incoming);

        // Extract exports from both files
        const existingExports = this.extractExports(existing);
        const incomingExports = this.extractExports(incoming);

        // Get body content (code without imports/exports)
        const existingBody = this.extractBody(existing);
        const incomingBody = this.extractBody(incoming);

        // Merge imports (deduplicate)
        const mergedImports = this.mergeImports(existingImports, incomingImports);

        // Merge exports (deduplicate)
        const mergedExports = this.mergeExports(existingExports, incomingExports);

        // Combine body content
        const mergedBody = existingBody && incomingBody
            ? `${existingBody}\n\n${incomingBody}`
            : existingBody || incomingBody;

        // Reconstruct the file
        return [
            mergedImports,
            '',
            mergedBody,
            '',
            mergedExports,
        ].filter(Boolean).join('\n');
    }

    /**
     * Extract import statements from code
     */
    private extractImports(code: string): string[] {
        const importRegex = /^import\s+.*?(?:from\s+['"][^'"]+['"]|['"][^'"]+['"])\s*;?$/gm;
        return (code.match(importRegex) || []);
    }

    /**
     * Extract export statements from code
     */
    private extractExports(code: string): string[] {
        const exportRegex = /^export\s+(?:default\s+)?(?:type\s+)?(?:\{[^}]*\}|[\w*]+)(?:\s+from\s+['"][^'"]+['"])?\s*;?$/gm;
        return (code.match(exportRegex) || []);
    }

    /**
     * Extract body content (code without imports at top and exports at bottom)
     */
    private extractBody(code: string): string {
        // Remove import statements
        let body = code.replace(/^import\s+.*?(?:from\s+['"][^'"]+['"]|['"][^'"]+['"])\s*;?\s*$/gm, '');

        // Remove standalone export statements (not inline exports)
        body = body.replace(/^export\s+\{[^}]*\}\s*(?:from\s+['"][^'"]+['"])?\s*;?\s*$/gm, '');

        return body.trim();
    }

    /**
     * Merge import statements, deduplicating
     */
    private mergeImports(existing: string[], incoming: string[]): string {
        const importMap = new Map<string, Set<string>>();

        const processImport = (imp: string) => {
            // Extract the module path
            const moduleMatch = imp.match(/from\s+['"]([^'"]+)['"]/);
            if (!moduleMatch) {
                // Direct import like: import 'module'
                const directMatch = imp.match(/import\s+['"]([^'"]+)['"]/);
                if (directMatch) {
                    importMap.set(`__direct__${directMatch[1]}`, new Set([imp]));
                }
                return;
            }

            const modulePath = moduleMatch[1];

            // Extract imported names
            const namedMatch = imp.match(/import\s*\{([^}]+)\}/);
            const defaultMatch = imp.match(/import\s+(\w+)\s+from/);
            const namespaceMatch = imp.match(/import\s+\*\s+as\s+(\w+)/);

            if (!importMap.has(modulePath)) {
                importMap.set(modulePath, new Set());
            }

            if (namedMatch) {
                namedMatch[1].split(',').forEach(n => {
                    importMap.get(modulePath)!.add(n.trim());
                });
            }
            if (defaultMatch && !imp.includes('{')) {
                importMap.get(modulePath)!.add(`default:${defaultMatch[1]}`);
            }
            if (namespaceMatch) {
                importMap.get(modulePath)!.add(`*:${namespaceMatch[1]}`);
            }
        };

        [...existing, ...incoming].forEach(processImport);

        // Reconstruct imports
        const imports: string[] = [];

        for (const [modulePath, names] of importMap) {
            if (modulePath.startsWith('__direct__')) {
                imports.push(`import '${modulePath.replace('__direct__', '')}';`);
                continue;
            }

            const namedImports: string[] = [];
            let defaultImport = '';
            let namespaceImport = '';

            for (const name of names) {
                if (name.startsWith('default:')) {
                    defaultImport = name.replace('default:', '');
                } else if (name.startsWith('*:')) {
                    namespaceImport = name.replace('*:', '');
                } else {
                    namedImports.push(name);
                }
            }

            let importStatement = 'import ';

            if (namespaceImport) {
                imports.push(`import * as ${namespaceImport} from '${modulePath}';`);
                continue;
            }

            if (defaultImport && namedImports.length > 0) {
                importStatement += `${defaultImport}, { ${namedImports.join(', ')} } from '${modulePath}';`;
            } else if (defaultImport) {
                importStatement += `${defaultImport} from '${modulePath}';`;
            } else if (namedImports.length > 0) {
                importStatement += `{ ${namedImports.join(', ')} } from '${modulePath}';`;
            } else {
                continue;
            }

            imports.push(importStatement);
        }

        return imports.join('\n');
    }

    /**
     * Merge export statements, deduplicating
     */
    private mergeExports(existing: string[], incoming: string[]): string {
        const exportSet = new Set<string>();

        [...existing, ...incoming].forEach(exp => {
            // Normalize and add to set
            exportSet.add(exp.trim());
        });

        return Array.from(exportSet).join('\n');
    }

    /**
     * Merge CSS files
     */
    private mergeCssFiles(existing: string, incoming: string): string {
        // Simple concatenation for CSS, ensuring no duplicate rules
        // In a real implementation, you'd parse and deduplicate selectors
        return `${existing}\n\n/* === Merged styles === */\n\n${incoming}`;
    }

    /**
     * Create a failed result for a missing cell
     */
    private createFailedResult(cellId: string, error: string): CellBuildResult {
        return {
            cellId,
            cellName: cellId,
            success: false,
            files: [],
            interfaceCompliance: {
                inputsValid: false,
                outputsValid: false,
                errors: [error],
                warnings: [],
            },
            qualityScore: 0,
            buildTime: 0,
            attempt: 0,
            error,
        };
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get current build progress (if any)
     */
    getCurrentProgress(): LatticeProgress | null {
        if (!this.activeBuild) return null;

        return {
            buildId: this.activeBuild.id,
            totalCells: 0,
            completedCells: 0,
            successfulCells: 0,
            failedCells: 0,
            inProgressCells: Array.from(this.activeBuild.inProgress),
            failedCellIds: [],
            currentGroup: 0,
            totalGroups: 0,
            elapsedTime: Date.now() - this.activeBuild.startTime,
            estimatedTimeRemaining: 0,
            speedMultiplier: 1,
            percentComplete: 0,
        };
    }

    /**
     * Check if a build is currently in progress
     */
    isBuilding(): boolean {
        return this.activeBuild !== null;
    }

    /**
     * Update configuration
     */
    setConfig(config: Partial<LatticeOrchestratorConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get current configuration
     */
    getConfig(): LatticeOrchestratorConfig {
        return { ...this.config };
    }

    // =========================================================================
    // SESSION 2: SHARED CONTEXT METHODS
    // =========================================================================

    /**
     * SESSION 2: Broadcast file modification to all other active cell builders
     * This enables real-time awareness between parallel cells
     */
    private broadcastFileModification(cellId: string, file: FileModification): void {
        // Record in shared context
        this.sharedContext.fileModifications.set(file.path, {
            cellId,
            content: file.content,
            timestamp: file.timestamp,
        });

        // Notify all other active cell builders
        this.activeCellBuilders.forEach((builder, id) => {
            if (id !== cellId) {
                builder.notify(file);
            }
        });

        // Emit for UI updates
        this.emit('file-modified', { cellId, file });

        // Broadcast via WebSocket for external listeners
        this.wsSync.sendPhaseChange(
            this.config.projectId,
            `cell:${cellId}:file:modified`,
            0,
            `File modified: ${file.path}`
        );
    }

    /**
     * SESSION 2: Register a cell builder for file modification notifications
     */
    registerCellBuilder(cellId: string, notifyFn: (mod: FileModification) => void): void {
        this.activeCellBuilders.set(cellId, { notify: notifyFn });
    }

    /**
     * SESSION 2: Unregister a cell builder
     */
    unregisterCellBuilder(cellId: string): void {
        this.activeCellBuilders.delete(cellId);
    }

    /**
     * SESSION 2: Get shared context for injection into cell prompts
     */
    getSharedContext(): SharedBuildContext {
        return this.sharedContext;
    }

    /**
     * SESSION 2: Record cell completion in shared context
     */
    recordCellCompletion(cellId: string, summary: string): void {
        this.sharedContext.completedCellSummaries.set(cellId, summary);

        // Broadcast via WebSocket
        this.wsSync.sendPhaseChange(
            this.config.projectId,
            `cell:${cellId}:completed`,
            100,
            `Completed: ${summary.substring(0, 50)}`
        );
    }

    /**
     * SESSION 2: Record cell error in shared context
     */
    recordCellError(cellId: string, error: string): void {
        this.sharedContext.errorHistory.push({
            cellId,
            error,
            timestamp: Date.now(),
        });
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createLatticeOrchestrator(
    config?: Partial<LatticeOrchestratorConfig>
): LatticeOrchestrator {
    return new LatticeOrchestrator(config);
}

export default LatticeOrchestrator;
