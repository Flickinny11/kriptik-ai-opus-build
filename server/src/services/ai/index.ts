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
    type IntentAppSoul,
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

// =============================================================================
// PHASE 7: Design System - App Soul & Anti-Slop Detection
// =============================================================================

// App Soul Mapper - Detects app type and assigns design soul
export {
    AppSoulMapper,
    createAppSoulMapper,
    APP_SOULS,
    type AppSoul,
    type AppSoulType,
    type ColorPalette,
    type TypographySystem,
    type DepthPhilosophy,
    type MotionPhilosophy,
    type ComponentPatterns,
} from './app-soul.js';

// =============================================================================
// PHASE 8: Competitive Enhancements
// =============================================================================

// Speed Dial Architecture - 4 build modes with different speed/quality trade-offs
export {
    SpeedDialService,
    createSpeedDialService,
    SPEED_DIAL_CONFIGS,
    type BuildMode,
    type SpeedDialConfig,
} from './speed-dial.js';

// Intelligence Dial - Per-request capability toggles
export {
    IntelligenceDial,
    createIntelligenceDial,
    getPreset as getIntelligencePreset,
    getAllPresets as getAllIntelligencePresets,
    INTELLIGENCE_PRESETS,
    type IntelligenceSettings,
    type IntelligencePreset,
} from './intelligence-dial.js';

// Tournament Mode - Competing implementations with AI judge panel
export {
    TournamentService,
    createTournamentService,
    type TournamentConfig,
    type Competitor,
    type JudgeVerdict,
    type TournamentResult,
} from './tournament.js';

// Infinite Reflection Engine - Self-healing loop for continuous improvement
export {
    InfiniteReflectionEngine,
    createInfiniteReflectionEngine,
    type ReflectionConfig,
    type ReflectionIssue,
    type ReflectionCycle,
    type ReflectionResult,
    type ReflectionLearning,
} from './reflection-engine.js';

