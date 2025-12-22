/**
 * LATTICE Store
 *
 * Zustand store for managing LATTICE build state.
 * Tracks blueprint, cell progress, and parallel execution metrics.
 *
 * Part of Phase 6: UI Updates (LATTICE)
 */

import { create } from 'zustand';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Cell interface contract
 */
export interface CellInterface {
    id: string;
    name: string;
    type: 'input' | 'output';
    dataShape: string;
    description: string;
    required: boolean;
}

/**
 * A discrete buildable unit within the lattice
 */
export interface LatticeCell {
    id: string;
    name: string;
    description: string;
    type: 'ui' | 'api' | 'logic' | 'data' | 'integration' | 'style';
    priority: number;
    estimatedComplexity: 'simple' | 'medium' | 'complex';
    inputs: CellInterface[];
    outputs: CellInterface[];
    dependsOn: string[];
    successCriteria: string[];
    estimatedBuildTimeSeconds: number;
}

/**
 * Visual identity from intent
 */
export interface VisualIdentity {
    colorPalette: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        surface: string;
        text: { primary: string; secondary: string; muted: string };
    };
    typography: {
        headingFont: string;
        bodyFont: string;
        monoFont: string;
    };
    depth: 'minimal' | 'subtle' | 'moderate' | 'high' | 'immersive';
    motion: 'instant' | 'snappy' | 'smooth' | 'fluid' | 'cinematic';
    borderRadius: 'sharp' | 'rounded' | 'pill';
}

/**
 * Complete lattice blueprint for parallel building
 */
export interface LatticeBlueprint {
    id: string;
    intentId: string;
    appName: string;
    appSoul: string;
    cells: LatticeCell[];
    parallelGroups: string[][];
    criticalPath: string[];
    estimatedTotalTime: number;
    estimatedParallelTime: number;
    visualIdentity?: VisualIdentity;
    createdAt: Date;
}

/**
 * Status of a cell in the build process
 */
export type CellStatus = 'pending' | 'building' | 'completed' | 'failed' | 'skipped';

/**
 * Cell build result
 */
export interface CellBuildResult {
    cellId: string;
    success: boolean;
    qualityScore: number;
    buildTime: number;
    files: Array<{ path: string; content: string }>;
    error?: string;
}

/**
 * LATTICE store state
 */
interface LatticeStore {
    // Blueprint and build state
    blueprint: LatticeBlueprint | null;
    isBuilding: boolean;
    buildStartTime: number | null;
    buildEndTime: number | null;

    // Cell tracking
    completedCells: Set<string>;
    inProgressCells: Set<string>;
    failedCells: Set<string>;
    cellStatuses: Map<string, CellStatus>;
    cellResults: Map<string, CellBuildResult>;

    // Metrics
    speedup: number;
    averageQualityScore: number;
    currentGroupIndex: number;

    // Actions
    setBlueprint: (blueprint: LatticeBlueprint) => void;
    clearBlueprint: () => void;
    startBuild: () => void;
    endBuild: (success: boolean) => void;
    setCellStatus: (cellId: string, status: CellStatus) => void;
    setCellResult: (cellId: string, result: CellBuildResult) => void;
    setCurrentGroup: (groupIndex: number) => void;
    updateSpeedup: (speedup: number) => void;
    reset: () => void;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useLatticeStore = create<LatticeStore>((set, get) => ({
    // Initial state
    blueprint: null,
    isBuilding: false,
    buildStartTime: null,
    buildEndTime: null,
    completedCells: new Set<string>(),
    inProgressCells: new Set<string>(),
    failedCells: new Set<string>(),
    cellStatuses: new Map<string, CellStatus>(),
    cellResults: new Map<string, CellBuildResult>(),
    speedup: 1.0,
    averageQualityScore: 0,
    currentGroupIndex: 0,

    // Set the lattice blueprint
    setBlueprint: (blueprint) => set({
        blueprint,
        cellStatuses: new Map(blueprint.cells.map(cell => [cell.id, 'pending' as CellStatus])),
        completedCells: new Set(),
        inProgressCells: new Set(),
        failedCells: new Set(),
        currentGroupIndex: 0,
    }),

    // Clear the blueprint
    clearBlueprint: () => set({
        blueprint: null,
        isBuilding: false,
        buildStartTime: null,
        buildEndTime: null,
        completedCells: new Set(),
        inProgressCells: new Set(),
        failedCells: new Set(),
        cellStatuses: new Map(),
        cellResults: new Map(),
        speedup: 1.0,
        averageQualityScore: 0,
        currentGroupIndex: 0,
    }),

    // Start the build process
    startBuild: () => set({
        isBuilding: true,
        buildStartTime: Date.now(),
        buildEndTime: null,
    }),

    // End the build process
    endBuild: (_success) => {
        const state = get();
        const buildTime = state.buildStartTime
            ? (Date.now() - state.buildStartTime) / 1000
            : 0;

        // Calculate average quality score from results
        let totalQuality = 0;
        let count = 0;
        state.cellResults.forEach(result => {
            if (result.success) {
                totalQuality += result.qualityScore;
                count++;
            }
        });

        const avgQuality = count > 0 ? totalQuality / count : 0;

        // Calculate speedup (sequential time / actual parallel time)
        const sequentialTime = state.blueprint?.estimatedTotalTime || buildTime;
        const actualSpeedup = buildTime > 0 ? sequentialTime / buildTime : 1;

        set({
            isBuilding: false,
            buildEndTime: Date.now(),
            averageQualityScore: avgQuality,
            speedup: Math.max(1, actualSpeedup),
        });
    },

    // Set the status of a specific cell
    setCellStatus: (cellId, status) => set((state) => {
        const newStatuses = new Map(state.cellStatuses);
        newStatuses.set(cellId, status);

        const newCompleted = new Set(state.completedCells);
        const newInProgress = new Set(state.inProgressCells);
        const newFailed = new Set(state.failedCells);

        // Update tracking sets based on status
        switch (status) {
            case 'building':
                newInProgress.add(cellId);
                newCompleted.delete(cellId);
                newFailed.delete(cellId);
                break;
            case 'completed':
                newCompleted.add(cellId);
                newInProgress.delete(cellId);
                newFailed.delete(cellId);
                break;
            case 'failed':
                newFailed.add(cellId);
                newInProgress.delete(cellId);
                newCompleted.delete(cellId);
                break;
            case 'pending':
            case 'skipped':
                newInProgress.delete(cellId);
                break;
        }

        return {
            cellStatuses: newStatuses,
            completedCells: newCompleted,
            inProgressCells: newInProgress,
            failedCells: newFailed,
        };
    }),

    // Set the result of a cell build
    setCellResult: (cellId, result) => set((state) => {
        const newResults = new Map(state.cellResults);
        newResults.set(cellId, result);
        return { cellResults: newResults };
    }),

    // Set the current parallel group being built
    setCurrentGroup: (groupIndex) => set({ currentGroupIndex: groupIndex }),

    // Update the speedup metric
    updateSpeedup: (speedup) => set({ speedup }),

    // Reset the entire store
    reset: () => set({
        blueprint: null,
        isBuilding: false,
        buildStartTime: null,
        buildEndTime: null,
        completedCells: new Set(),
        inProgressCells: new Set(),
        failedCells: new Set(),
        cellStatuses: new Map(),
        cellResults: new Map(),
        speedup: 1.0,
        averageQualityScore: 0,
        currentGroupIndex: 0,
    }),
}));

export default useLatticeStore;
