/**
 * Streaming & Hallucination Detection Module Index
 *
 * Exports all streaming and hallucination detection components.
 */

// Types
export {
  type StreamEventType,
  type StreamingEvent,
  type StreamingEventMetadata,
  type HallucinationSignal,
  type HallucinationIndicators,
  type SuggestedAction,
  type HallucinationDetectorConfig,
  type StreamingManagerConfig,
  type StreamState,
  type AutoCorrectionConfig,
  type CorrectionAttempt,
  type CorrectionResult,
  type CorrectionStrategy,
  type StepAnalysis,
  type ChainAnalysis,
  type MonitoringEvent,
  DEFAULT_HALLUCINATION_DETECTOR_CONFIG,
  DEFAULT_STREAMING_MANAGER_CONFIG,
  DEFAULT_AUTO_CORRECTION_CONFIG,
} from './types.js';

// Hallucination Detector
export {
  HallucinationDetector,
  getHallucinationDetector,
  resetHallucinationDetector,
  createHallucinationDetector,
} from './hallucination-detector.js';

// Streaming Manager
export {
  StreamingManager,
  getStreamingManager,
  resetStreamingManager,
  createStreamingManager,
} from './manager.js';

// Auto-Correction Engine
export {
  AutoCorrectionEngine,
  getAutoCorrectionEngine,
  resetAutoCorrectionEngine,
  createAutoCorrectionEngine,
  type CorrectionContext,
} from './auto-correction.js';
