/**
 * Autonomous Learning Engine - Service Exports
 *
 * Complete self-improving AI system that captures experiences,
 * generates judgments via RLAIF, and evolves strategies continuously.
 *
 * Extended with:
 * - User-specific model management
 * - Model marketplace
 * - Multi-model orchestration
 * - Serverless inference deployment
 * - Global training for KripTik AI takeover
 */

// Layer 1: Experience Capture
export {
    ExperienceCaptureService,
    createExperienceCaptureService,
    getExperienceCaptureService,
    resetExperienceCaptureService,
} from './experience-capture.js';

// Layer 2: AI Judgment (RLAIF)
export {
    AIJudgmentService,
    createAIJudgmentService,
    getAIJudgmentService,
} from './ai-judgment.js';

// Layer 3: Shadow Model Registry
export {
    ShadowModelRegistry,
    getShadowModelRegistry,
    SHADOW_MODEL_CONFIGS,
    type ShadowModelType,
} from './shadow-model-registry.js';

// Layer 4: Meta-Learning
export {
    PatternLibraryService,
    getPatternLibrary,
} from './pattern-library.js';

export {
    StrategyEvolutionService,
    getStrategyEvolution,
} from './strategy-evolution.js';

// Layer 5: Evolution Flywheel
export {
    EvolutionFlywheel,
    getEvolutionFlywheel,
} from './evolution-flywheel.js';

// Legacy: Interaction Tracker (still useful for basic tracking)
export {
    InteractionTracker,
    getInteractionTracker,
    type Interaction,
    type InteractionPattern,
    type LearningInsight as LegacyLearningInsight,
    type ModelPerformance,
} from './interaction-tracker.js';

// =============================================================================
// NEW: User Model Management
// =============================================================================
export {
    UserModelManager,
    getUserModelManager,
    type UserModel,
    type UserModelPreferences,
    type UserModelMetrics,
    type ProjectModelAssociation,
    type TrainingDataPoint,
    type ModelSuggestion,
} from './user-model-manager.js';

// =============================================================================
// NEW: Model Marketplace
// =============================================================================
export {
    ModelMarketplace,
    getModelMarketplace,
    type MarketplaceModel,
    type ProjectShowcase,
    type MarketplaceModelStats,
    type ModelCapability,
    type ModelPricing,
    type ModelQualityMetrics,
    type ModelReview,
    type MarketplaceCategory,
    type MarketplaceSearchFilters,
} from './model-marketplace.js';

// =============================================================================
// NEW: Multi-Model Orchestration
// =============================================================================
export {
    MultiModelOrchestrator,
    getMultiModelOrchestrator,
    type ProjectModelConfig,
    type ModelSlot,
    type ModelSpecialization,
    type MultiModelRequest,
    type MultiModelResponse,
    type ModelResponseWithMeta,
} from './multi-model-orchestrator.js';

// =============================================================================
// NEW: Serverless Inference Deployment
// =============================================================================
export {
    ServerlessInferenceService,
    getServerlessInferenceService,
    type InferenceEndpoint,
    type InferenceRequest,
    type InferenceResponse,
    type EndpointMetrics,
    type ServerlessDeploymentConfig,
} from './serverless-inference.js';

// =============================================================================
// NEW: Builder Notifications
// =============================================================================
export {
    BuilderModelNotifications,
    getBuilderModelNotifications,
    type BuilderNotification,
    type NotificationType,
    type NotificationAction,
    type NotificationActionType,
    type ProjectNotificationState,
    type ModelNotificationConfig,
} from './builder-model-notifications.js';

// =============================================================================
// NEW: Global Training & Takeover
// =============================================================================
export {
    KriptikGlobalTraining,
    getKriptikGlobalTraining,
    type GlobalTrainingConfig,
    type GlobalTrainingData,
    type GlobalTrainingRun,
    type TakeoverStatus,
} from './kriptik-global-training.js';

// Types
export * from './types.js';
