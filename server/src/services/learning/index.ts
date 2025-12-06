/**
 * Autonomous Learning Engine
 *
 * Export all learning services and types for the KripTik AI builder.
 */

// Main Learning Engine
export {
    LearningEngine,
    getLearningEngine,
} from './learning-engine.js';

// Layer 1: Experience Capture
export {
    ExperienceCaptureService,
    getExperienceCaptureService,
} from './experience-capture.js';

// Layer 2: AI Judgment (RLAIF)
export {
    AIJudgmentService,
    getAIJudgmentService,
} from './ai-judgment.js';

// Layer 4: Meta-Learning
export {
    PatternLibraryService,
    getPatternLibraryService,
} from './pattern-library.js';

export {
    StrategyEvolutionService,
    getStrategyEvolutionService,
} from './strategy-evolution.js';

// Types
export * from './types.js';

// Re-export existing interaction tracker for backwards compatibility
export { InteractionTracker, getInteractionTracker } from './interaction-tracker.js';
