/**
 * AI Services Module
 *
 * Exports all AI-related services for KripTik
 */

// Core AI services
export * from './helicone-client.js';
export * from './claude-service.js';

// Model routing (OpenRouter) - use explicit exports to avoid conflicts
export {
    ModelRouter,
    getModelRouter,
    resetModelRouter,
    analyzeTask,
    MODELS,
    type ModelConfig,
    type ModelTier,
    type RouterConfig,
    type GenerationRequest,
    type GenerationResponse as RouterGenerationResponse,
    type TaskAnalysis,
} from './model-router.js';

// Specialized AI capabilities
export * from './image-to-code.js';
export * from './self-healing.js';
export * from './test-generator.js';

// =============================================================================
// ULTIMATE AI-FIRST BUILDER ARCHITECTURE - Phase 1 Core Artifacts
// =============================================================================

// Intent Lock Engine - Phase 0: Sacred Contract creation
export {
    IntentLockEngine,
    createIntentLockEngine,
    createAndLockIntent,
    type IntentContract,
    type AppSoul,
    type SuccessCriterion,
    type UserWorkflow,
    type VisualIdentity,
    type IntentLockOptions,
} from './intent-lock.js';

// Feature List Manager - Phase 1 & 2: Feature tracking with passes: true/false
export {
    FeatureListManager,
    createFeatureListManager,
    type Feature,
    type FeatureCategory,
    type FeatureVerificationStatus,
    type FeatureVerificationScores,
    type FeatureListSummary,
    type GenerateFeatureListOptions,
} from './feature-list.js';

// Artifact Manager - Artifact-based handoff system
export {
    ArtifactManager,
    createArtifactManager,
    createSessionLogEntry,
    type SessionLog,
    type BuildState,
    type IssueResolution,
    type VerificationHistoryEntry,
    type ProjectArtifacts,
} from './artifacts.js';

