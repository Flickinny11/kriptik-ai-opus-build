/**
 * Autonomous Learning Engine - Service Exports
 *
 * Complete self-improving AI system that captures experiences,
 * generates judgments via RLAIF, and evolves strategies continuously.
 *
 * Enhanced in Component 28 v2 with:
 * - Direct-RLAIF for real-time reward signals
 * - Multi-Judge Consensus for robust evaluation
 * - Reflexion-Based Learning from failures
 * - Real-Time Learning during builds
 * - Cross-Build Knowledge Transfer
 * - Vision RLAIF for Anti-Slop detection
 * - Agent Network for parallel discovery sharing
 * - Context Priority Learning
 * - Shadow Model Auto-Deployer
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

// Layer 2 Enhancement: Direct-RLAIF
export {
    DirectRLAIFService,
    getDirectRLAIF,
    resetDirectRLAIF,
} from './direct-rlaif.js';

// Layer 2 Enhancement: Multi-Judge Consensus
export {
    MultiJudgeService,
    getMultiJudge,
    resetMultiJudge,
    JUDGE_PANELS,
} from './multi-judge.js';

// Layer 2 Enhancement: Vision RLAIF
export {
    VisionRLAIFService,
    getVisionRLAIF,
    resetVisionRLAIF,
} from './vision-rlaif.js';

// Layer 3: Shadow Model Registry
export {
    ShadowModelRegistry,
    getShadowModelRegistry,
    SHADOW_MODEL_CONFIGS,
    type ShadowModelType,
} from './shadow-model-registry.js';

// Layer 3 Enhancement: Shadow Model Auto-Deployer
export {
    ShadowModelDeployerService,
    getShadowModelDeployer,
    resetShadowModelDeployer,
} from './shadow-model-deployer.js';

// Layer 4: Meta-Learning
export {
    PatternLibraryService,
    getPatternLibrary,
} from './pattern-library.js';

export {
    StrategyEvolutionService,
    getStrategyEvolution,
} from './strategy-evolution.js';

// Layer 4 Enhancement: Reflexion-Based Learning
export {
    ReflexionService,
    getReflexion,
    resetReflexion,
} from './reflexion.js';

// Layer 4 Enhancement: Cross-Build Knowledge Transfer
export {
    CrossBuildTransferService,
    getCrossBuildTransfer,
    resetCrossBuildTransfer,
} from './cross-build-transfer.js';

// Layer 4 Enhancement: Context Priority Learning
export {
    ContextPriorityService,
    getContextPriority,
    resetContextPriority,
    type ContextType,
    type TaskCategory,
    ALL_CONTEXT_TYPES,
} from './context-priority.js';

// Layer 5: Evolution Flywheel
export {
    EvolutionFlywheel,
    getEvolutionFlywheel,
} from './evolution-flywheel.js';

// Layer 5 Enhancement: Real-Time Learning
export {
    RealtimeLearningService,
    getRealtimeLearning,
    shutdownRealtimeLearning,
    type EventType,
} from './real-time-learning.js';

// Layer 5 Enhancement: Agent Network Learning
export {
    AgentNetworkService,
    getAgentNetwork,
    resetAgentNetwork,
    type DiscoveryType,
} from './agent-network.js';

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
