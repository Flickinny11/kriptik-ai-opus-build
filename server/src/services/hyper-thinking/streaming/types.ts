/**
 * Streaming & Hallucination Detection Types
 *
 * Types for real-time monitoring of reasoning quality and streaming output.
 * Based on "Streaming Hallucination Detection in Long Chain-of-Thought Reasoning" (Jan 2026)
 */

// ============================================================================
// Streaming Event Types
// ============================================================================

export type StreamEventType =
  | 'start'
  | 'thinking'
  | 'thought_complete'
  | 'evaluation'
  | 'synthesis'
  | 'hallucination_warning'
  | 'correction'
  | 'pause'
  | 'resume'
  | 'complete'
  | 'error';

export interface StreamingEvent {
  /** Event type */
  type: StreamEventType;
  /** Event content/data */
  content: string;
  /** Event metadata */
  metadata: StreamingEventMetadata;
  /** ISO timestamp */
  timestamp: string;
}

export interface StreamingEventMetadata {
  /** Step ID in reasoning chain */
  stepId?: string;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Hallucination score (0-1, higher = more likely hallucination) */
  hallucinationScore?: number;
  /** Tokens used for this step */
  tokensUsed?: number;
  /** Total tokens used so far */
  totalTokensUsed?: number;
  /** Model used */
  model?: string;
  /** Strategy being used */
  strategy?: string;
  /** Depth in reasoning tree */
  depth?: number;
  /** Parent step ID */
  parentStepId?: string;
  /** Session ID */
  sessionId?: string;
  /** Custom data */
  custom?: Record<string, unknown>;
}

// ============================================================================
// Hallucination Detection Types
// ============================================================================

export interface HallucinationSignal {
  /** Step ID that triggered the signal */
  stepId: string;
  /** Overall hallucination score (0-1) */
  score: number;
  /** Individual indicators */
  indicators: HallucinationIndicators;
  /** Whether to pause reasoning */
  shouldPause: boolean;
  /** Suggested action */
  suggestedAction: SuggestedAction;
  /** Detection timestamp */
  timestamp: string;
  /** Explanation of the signal */
  explanation?: string;
}

export interface HallucinationIndicators {
  /** Semantic drift from original problem (0-1) */
  semanticDrift: number;
  /** Factual inconsistency detected (0-1) */
  factualInconsistency: number;
  /** Logical contradiction with previous steps (0-1) */
  logicalContradiction: number;
  /** Confidence degradation from previous step */
  confidenceDrop: number;
  /** Repetition of previous content */
  repetition: number;
  /** Deviation from expected pattern */
  patternDeviation: number;
}

export type SuggestedAction =
  | 'continue'           // Safe to continue
  | 'verify'             // Verify this step before continuing
  | 'backtrack'          // Backtrack to previous step
  | 'reframe'            // Reframe the problem
  | 'pause_for_review'   // Pause and wait for human review
  | 'terminate';         // Stop reasoning chain

// ============================================================================
// Detector Configuration
// ============================================================================

export interface HallucinationDetectorConfig {
  /** Enable hallucination detection */
  enabled: boolean;
  /** Semantic drift threshold (0-1) */
  semanticDriftThreshold: number;
  /** Factual inconsistency threshold (0-1) */
  factualInconsistencyThreshold: number;
  /** Logical contradiction threshold (0-1) */
  logicalContradictionThreshold: number;
  /** Confidence drop threshold (0-1) */
  confidenceDropThreshold: number;
  /** Repetition threshold (0-1) */
  repetitionThreshold: number;
  /** Pattern deviation threshold (0-1) */
  patternDeviationThreshold: number;
  /** Overall score threshold for pause (0-1) */
  pauseThreshold: number;
  /** Overall score threshold for terminate (0-1) */
  terminateThreshold: number;
  /** Number of steps to analyze for drift */
  driftWindowSize: number;
  /** Enable embedding-based detection */
  useEmbeddings: boolean;
  /** Enable pattern-based detection */
  usePatterns: boolean;
  /** Cache embeddings for performance */
  cacheEmbeddings: boolean;
}

export const DEFAULT_HALLUCINATION_DETECTOR_CONFIG: HallucinationDetectorConfig = {
  enabled: true,
  semanticDriftThreshold: 0.35,
  factualInconsistencyThreshold: 0.4,
  logicalContradictionThreshold: 0.45,
  confidenceDropThreshold: 0.3,
  repetitionThreshold: 0.7,
  patternDeviationThreshold: 0.5,
  pauseThreshold: 0.6,
  terminateThreshold: 0.85,
  driftWindowSize: 5,
  useEmbeddings: true,
  usePatterns: true,
  cacheEmbeddings: true,
};

// ============================================================================
// Streaming Manager Types
// ============================================================================

export interface StreamingManagerConfig {
  /** Maximum buffer size in events */
  maxBufferSize: number;
  /** Enable backpressure handling */
  enableBackpressure: boolean;
  /** Backpressure threshold (events) */
  backpressureThreshold: number;
  /** Timeout for stream operations (ms) */
  streamTimeoutMs: number;
  /** Enable hallucination detection */
  enableHallucinationDetection: boolean;
  /** Enable auto-correction */
  enableAutoCorrection: boolean;
  /** Maximum auto-corrections per chain */
  maxAutoCorrections: number;
  /** Heartbeat interval for keep-alive (ms) */
  heartbeatIntervalMs: number;
}

export const DEFAULT_STREAMING_MANAGER_CONFIG: StreamingManagerConfig = {
  maxBufferSize: 1000,
  enableBackpressure: true,
  backpressureThreshold: 500,
  streamTimeoutMs: 300000, // 5 minutes
  enableHallucinationDetection: true,
  enableAutoCorrection: true,
  maxAutoCorrections: 3,
  heartbeatIntervalMs: 30000, // 30 seconds
};

export interface StreamState {
  /** Stream ID */
  id: string;
  /** Current status */
  status: 'active' | 'paused' | 'correcting' | 'complete' | 'error';
  /** Events emitted count */
  eventsEmitted: number;
  /** Total tokens used */
  tokensUsed: number;
  /** Corrections applied */
  correctionsApplied: number;
  /** Hallucination warnings issued */
  hallucinationWarnings: number;
  /** Start time */
  startedAt: string;
  /** Last event time */
  lastEventAt?: string;
  /** Current step ID */
  currentStepId?: string;
}

// ============================================================================
// Auto-Correction Types
// ============================================================================

export interface AutoCorrectionConfig {
  /** Enable auto-correction */
  enabled: boolean;
  /** Maximum correction attempts */
  maxAttempts: number;
  /** Score threshold to trigger correction */
  triggerThreshold: number;
  /** Minimum improvement required */
  minImprovementRequired: number;
  /** Enable backtracking */
  enableBacktrack: boolean;
  /** Maximum steps to backtrack */
  maxBacktrackSteps: number;
  /** Log corrections for learning */
  logForLearning: boolean;
  /** Require verification after correction */
  requireVerification: boolean;
}

export const DEFAULT_AUTO_CORRECTION_CONFIG: AutoCorrectionConfig = {
  enabled: true,
  maxAttempts: 3,
  triggerThreshold: 0.5,
  minImprovementRequired: 0.15,
  enableBacktrack: true,
  maxBacktrackSteps: 3,
  logForLearning: true,
  requireVerification: true,
};

export interface CorrectionAttempt {
  /** Correction ID */
  id: string;
  /** Step ID being corrected */
  stepId: string;
  /** Attempt number */
  attemptNumber: number;
  /** Original content */
  originalContent: string;
  /** Corrected content */
  correctedContent: string;
  /** Original hallucination score */
  originalScore: number;
  /** New hallucination score */
  newScore: number;
  /** Improvement achieved */
  improvement: number;
  /** Success status */
  success: boolean;
  /** Correction strategy used */
  strategy: CorrectionStrategy;
  /** Timestamp */
  timestamp: string;
}

export type CorrectionStrategy =
  | 'regenerate'      // Regenerate the step
  | 'reframe'         // Reframe with different context
  | 'decompose'       // Break into smaller steps
  | 'verify_then_fix' // Verify first, then fix
  | 'backtrack';      // Backtrack and try different path

export interface CorrectionResult {
  /** Whether correction was successful */
  success: boolean;
  /** Number of attempts made */
  attempts: number;
  /** All attempts made */
  attemptHistory: CorrectionAttempt[];
  /** Final step content */
  finalContent?: string;
  /** Final hallucination score */
  finalScore?: number;
  /** Whether backtracking occurred */
  backtracked: boolean;
  /** Steps backtracked */
  backtrackSteps?: number;
  /** Total time spent (ms) */
  totalTimeMs: number;
}

// ============================================================================
// Step Analysis Types
// ============================================================================

export interface StepAnalysis {
  /** Step ID */
  stepId: string;
  /** Step content */
  content: string;
  /** Step embedding */
  embedding?: number[];
  /** Similarity to problem context */
  problemSimilarity: number;
  /** Similarity to previous step */
  previousStepSimilarity?: number;
  /** Similarity to chain average */
  chainSimilarity?: number;
  /** Self-evaluation confidence */
  confidence: number;
  /** Tokens used */
  tokensUsed: number;
  /** Analysis timestamp */
  analyzedAt: string;
}

export interface ChainAnalysis {
  /** Session ID */
  sessionId: string;
  /** All step analyses */
  steps: StepAnalysis[];
  /** Overall chain coherence */
  coherenceScore: number;
  /** Progression score (is reasoning improving?) */
  progressionScore: number;
  /** Problem relevance over time */
  relevanceProgression: number[];
  /** Confidence over time */
  confidenceProgression: number[];
  /** Detected drift points */
  driftPoints: string[];
  /** Analysis timestamp */
  analyzedAt: string;
}

// ============================================================================
// Monitoring Events
// ============================================================================

export interface MonitoringEvent {
  /** Event type */
  type: 'step_analyzed' | 'warning_issued' | 'correction_started' | 'correction_complete' | 'chain_complete';
  /** Event data */
  data: StepAnalysis | HallucinationSignal | CorrectionAttempt | CorrectionResult | ChainAnalysis;
  /** Timestamp */
  timestamp: string;
}

// ============================================================================
// Export Default Configs
// ============================================================================

export default {
  DEFAULT_HALLUCINATION_DETECTOR_CONFIG,
  DEFAULT_STREAMING_MANAGER_CONFIG,
  DEFAULT_AUTO_CORRECTION_CONFIG,
};
