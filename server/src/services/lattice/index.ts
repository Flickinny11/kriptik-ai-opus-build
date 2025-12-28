/**
 * LATTICE Module Index
 *
 * Locking Architecture for Total Task Integrated Cell Execution
 *
 * Exports all LATTICE-related services for parallel app building.
 *
 * Components:
 * - IntentCrystallizer: Transforms Intent Lock contracts into Lattice Blueprints
 * - CellBuilder: Builds individual cells with interface contract enforcement
 *
 * Part of: KripTik AI Ultimate Architecture
 */

// ============================================================================
// INTENT CRYSTALLIZER (Phase 1)
// ============================================================================

export {
    IntentCrystallizer,
    createIntentCrystallizer,
    type CellInterface,
    type LatticeCell,
    type LatticeBlueprint,
    type VisualIdentity,
    type IntentContract,
} from './intent-crystallizer.js';

// ============================================================================
// CELL BUILDER (Phase 2)
// ============================================================================

export {
    CellBuilder,
    createCellBuilder,
    type CellBuildResult,
    type CellBuildContext,
    type CellBuilderConfig,
} from './cell-builder.js';

// ============================================================================
// LATTICE ORCHESTRATOR (Phase 2.2)
// ============================================================================

export {
    LatticeOrchestrator,
    createLatticeOrchestrator,
    type LatticeProgress,
    type LatticeResult,
    type LatticeBuildContext,
    type LatticeOrchestratorConfig,
    type LatticeOrchestratorEvents,
} from './lattice-orchestrator.js';

// ============================================================================
// PRECOMPUTE ENGINE (Phase 5)
// ============================================================================

export {
    PrecomputeEngine,
    createPrecomputeEngine,
    type PrecomputedCellStatus,
    type PrecomputeSession,
    type PrecomputeEngineConfig,
} from './precompute-engine.js';

// ============================================================================
// BUILDING BLOCKS REGISTRY (Phase 3)
// ============================================================================

export {
    BlockRegistry,
    getBlockRegistry,
    resetBlockRegistry,
    CORE_BLOCKS,
    type BuildingBlock,
    type BlockRenderResult,
    type BlockMatchScore,
} from './block-registry.js';
