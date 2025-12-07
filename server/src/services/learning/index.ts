/**
 * Autonomous Learning Engine - Service Exports
 *
 * Complete self-improving AI system that captures experiences,
 * generates judgments via RLAIF, and evolves strategies continuously.
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

// Types
export * from './types.js';
