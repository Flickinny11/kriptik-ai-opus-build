/**
 * Visual-Semantic Services
 *
 * Hybrid analysis combining VL-JEPA, V-JEPA 2, and LLM streams for:
 * - Visual Intent Lock: Captured design specifications for build verification
 * - Temporal Expectations: Predicted state transitions for proactive error detection
 * - Hybrid Analysis Engine: Orchestration of parallel analysis streams
 */

// Core Engine
export {
  HybridAnalysisEngine,
  getHybridAnalysisEngine,
  resetHybridAnalysisEngine,
  type AnalysisInput,
  type VLJEPAResult,
  type VJEPA2Result,
  type LLMResult,
  type HybridAnalysisResult,
} from './hybrid-analysis-engine.js';

// Visual Intent Lock
export {
  VisualIntentLockManager,
  getVisualIntentLockManager,
  resetVisualIntentLockManager,
  type VisualIntentLock,
  type ComponentBreakdown,
  type DesignRationale,
  type ChecklistItem,
  type VerificationResult,
  type DeviationReport,
} from './visual-intent-lock.js';

// Temporal Expectations
export {
  TemporalExpectationsManager,
  getTemporalExpectationsManager,
  resetTemporalExpectationsManager,
  type TemporalExpectations,
  type StateTransition,
  type MotionPattern,
  type AnticipatedAction,
  type TransitionValidationResult,
  type NextStatePrediction,
  type ErrorAnticipationResult,
} from './temporal-expectations.js';

// Proactive Error Prediction
export {
  ProactiveErrorPredictor,
  getProactiveErrorPredictor,
  resetProactiveErrorPredictor,
  type PredictedError,
  type PredictionSeverity,
  type ErrorType,
  type VisualIndicator,
  type MonitoringSession,
  type MonitoringConfig,
  type FrameState,
  type ErrorPredictionResult,
  type Recommendation,
} from './proactive-error-predictor.js';
