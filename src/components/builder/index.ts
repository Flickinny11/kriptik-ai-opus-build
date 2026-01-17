/**
 * Builder Components Index
 *
 * Exports all builder-related components for the new flow:
 * - BuilderFlowController - Main orchestration component
 * - Plan components - PlanPhaseCard, ReconfigurePlanButton
 * - Dependency components - Connection and installation views
 * - Resource components - GPU approval view
 */

// Main flow controller
export { BuilderFlowController } from './BuilderFlowController';

// Plan components
export {
    PlanPhaseCard,
    ReconfigurePlanButton,
    ApprovePlanButton,
} from './plan';
export type {
    PlanPhaseCardProps,
    ReconfigurePlanButtonProps,
    ApprovePlanButtonProps,
    ReconfigurationPayload,
} from './plan';

// Dependency components
export {
    DependencyTile,
    DependencyConnectionView,
    DependencyInstallView,
    TileExplosion,
    SuccessExplosion,
    GoldExplosion,
} from './dependencies';
export type {
    DependencyData,
    CredentialField,
    TileExplosionProps,
    DependencyConnectionViewProps,
    DependencyInstallViewProps,
    DependencyInstallStatus,
    StreamLine,
} from './dependencies';

// Resource components
export { ResourceApprovalView } from './resources/ResourceApprovalView';
export type {
    ResourceApprovalViewProps,
    ResourceRecommendation,
} from './resources/ResourceApprovalView';

// Re-export stores for convenience
export { useBuilderFlowStore, type BuilderFlowPhase } from '../../store/builder-flow-store';
export { usePlanModificationStore } from '../../store/plan-modification-store';
