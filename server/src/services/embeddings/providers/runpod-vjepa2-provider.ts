/**
 * RunPod V-JEPA 2 Provider
 *
 * TRUE temporal video understanding using Meta's V-JEPA 2 model.
 * Unlike the SigLIP-based VL-JEPA fallback, this provides:
 * - Real temporal sequence understanding
 * - Action prediction and anticipation
 * - Demo verification
 * - Conversation flow analysis (for Fix My App)
 * - UI interaction pattern recognition
 *
 * Model: facebook/vjepa2-vitl-fpc64-256 (1.2B parameters)
 * Fallback: MCG-NJU/videomae-large
 * Dimensions: 1024
 */

import type {
  EmbeddingProvider,
  EmbeddingOptions,
  ProviderEmbeddingResult,
  ProviderHealth,
} from '../embedding-service.js';

// ============================================================================
// Configuration
// ============================================================================

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || '';
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_VJEPA2 || '';
const RUNPOD_ENDPOINT_URL = process.env.RUNPOD_URL_VJEPA2 ||
  (RUNPOD_ENDPOINT_ID ? `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/runsync` : '');

const VJEPA2_DIMENSIONS = 1024;

// ============================================================================
// Types
// ============================================================================

export type AnalysisType =
  | 'temporal_sequence'
  | 'video_understanding'
  | 'action_prediction'
  | 'demo_verification'
  | 'conversation_flow'
  | 'ui_interaction'
  | 'keyframe_detection'
  | 'predict_state'
  | 'validate_transition'
  | 'anticipate_error'
  | 'temporal_embed';

export interface KeyMoment {
  frameIndex: number;
  timestamp: number;
  type: 'error' | 'success' | 'pivot' | 'frustration' | 'breakthrough';
  description: string;
  confidence: number;
}

export interface TemporalAnalysis {
  embedding: number[];
  frameEmbeddings?: number[][];
  keyMoments: KeyMoment[];
  patterns: string[];
  frameSimilarities: number[];
  flowSummary?: string;
  confidence: number;
}

export interface ActionPrediction {
  predictedAction: string;
  confidence: number;
  alternatives: string[];
  trajectoryMagnitude: number;
}

export interface DemoVerification {
  behaviorsDetected: string[];
  behaviorsMissing: string[];
  confidence: number;
  verificationPassed: boolean;
}

export interface ConversationAnalysis {
  temporalEmbedding: number[];
  frameCount: number;
  keyMoments: KeyMoment[];
  frameSimilarities: number[];
  conversationFlow: {
    errorPoints: KeyMoment[];
    pivotPoints: KeyMoment[];
    resolutionPoints: KeyMoment[];
  };
  patterns: string[];
  recommendations: string[];
}

export interface UIAnalysis {
  interactionDensity: number;
  navigationPattern: 'linear' | 'complex';
  detectedInteractions: KeyMoment[];
}

// NEW: Proactive Error Prediction Types
export interface StatePrediction {
  predictedStateEmbedding: number[];
  currentStateEmbedding: number[];
  trajectoryEmbedding: number[];
  expectedChanges: string[];
  changeMagnitude: number;
  confidence: number;
  predictionBasis: string;
}

export interface TransitionValidation {
  valid: boolean;
  confidence: number;
  deviationScore: number;
  smoothness: number;
  transitionMagnitude: number;
  issues: string[];
  frameCountAnalyzed: number;
}

export interface ErrorAnticipation {
  errorAnticipated: boolean;
  confidence: number;
  trajectoryDeviation: number;
  currentIntentSimilarity: number;
  projectedIntentSimilarity: number;
  warnings: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
  }>;
  suggestedCorrections: string[];
  checklistStatus: Array<{
    item: string;
    status: 'complete' | 'partial' | 'missing';
    confidence: number;
  }>;
}

export interface VisualIntentLock {
  embedding: number[];
  semanticDescription: string;
  checklist: string[];
}

interface VJEPA2Output {
  embedding?: number[];
  embeddings?: number[][];
  frame_embeddings?: number[][];
  key_moments?: Array<{
    frame_index: number;
    timestamp: number;
    type: string;
    description: string;
    confidence: number;
  }>;
  frame_similarities?: number[];
  patterns?: string[];
  flow_summary?: string;
  confidence?: number;
  type?: string;
  dimensions?: number;
  model?: string;

  // Type-specific outputs
  prediction?: {
    predicted_action: string;
    confidence: number;
    alternatives: string[];
    trajectory_magnitude: number;
  };
  verification?: {
    behaviors_detected: string[];
    behaviors_missing: string[];
    confidence: number;
    verification_passed: boolean;
  };
  conversation_analysis?: {
    temporal_embedding: number[];
    frame_count: number;
    key_moments: KeyMoment[];
    frame_similarities: number[];
    conversation_flow: {
      error_points: KeyMoment[];
      pivot_points: KeyMoment[];
      resolution_points: KeyMoment[];
    };
    patterns: string[];
    recommendations: string[];
  };
  ui_analysis?: {
    interaction_density: number;
    navigation_pattern: string;
    detected_interactions: KeyMoment[];
  };
  recommendations?: string[];
  keyframes?: Array<{
    frame_index: number;
    timestamp: number;
    importance: number;
  }>;

  // NEW: Proactive prediction outputs
  state_prediction?: {
    predicted_state_embedding: number[];
    current_state_embedding: number[];
    trajectory_embedding: number[];
    expected_changes: string[];
    change_magnitude: number;
    confidence: number;
    prediction_basis: string;
  };
  validation?: {
    valid: boolean;
    confidence: number;
    deviation_score: number;
    smoothness: number;
    transition_magnitude: number;
    issues: string[];
    frame_count_analyzed: number;
  };
  error_anticipation?: {
    error_anticipated: boolean;
    confidence: number;
    trajectory_deviation: number;
    current_intent_similarity: number;
    projected_intent_similarity: number;
    warnings: Array<{
      type: string;
      severity: string;
      message: string;
    }>;
    suggested_corrections: string[];
    checklist_status: Array<{
      item: string;
      status: string;
      confidence: number;
    }>;
  };
  temporal_embedding?: number[];

  error?: string;
  traceback?: string;
}

interface RunPodResponse {
  id?: string;
  status?: string;
  output?: VJEPA2Output;
  error?: string;
}

// ============================================================================
// V-JEPA 2 Provider Implementation
// ============================================================================

export class RunPodVJEPA2Provider implements EmbeddingProvider {
  readonly name = 'runpod-vjepa2';
  readonly model = 'facebook/vjepa2-vitl-fpc64-256';
  readonly defaultDimensions = VJEPA2_DIMENSIONS;
  readonly maxTokens = 0; // Video-based, not token-based
  readonly maxBatchSize = 1; // Process one video at a time
  readonly costPer1kTokens = 0.25; // Higher cost for video processing

  private retryAttempts = 3;
  private retryDelay = 3000; // Longer delay for video processing

  /**
   * Check if RunPod endpoint is configured
   */
  isConfigured(): boolean {
    return !!(RUNPOD_API_KEY && RUNPOD_ENDPOINT_URL);
  }

  /**
   * Generate embeddings for text - V-JEPA 2 is video-only
   * This method exists for interface compatibility but delegates to simpler models
   */
  async embed(texts: string[], _options?: EmbeddingOptions): Promise<ProviderEmbeddingResult> {
    throw new Error(
      'V-JEPA 2 is a video-only model. Use analyzeTemporalSequence() for video analysis. ' +
      'For text embeddings, use BGE-M3 or SigLIP providers.'
    );
  }

  /**
   * Analyze a temporal sequence of frames
   * Primary method for temporal video understanding
   */
  async analyzeTemporalSequence(
    frames: string[] | Buffer[],
    options: {
      context?: string;
      maxFrames?: number;
      fps?: number;
    } = {}
  ): Promise<TemporalAnalysis> {
    const startTime = Date.now();

    // Convert Buffer frames to base64
    const frameData = frames.map(f =>
      Buffer.isBuffer(f) ? f.toString('base64') : f
    );

    const result = await this.callEndpoint({
      type: 'temporal_sequence',
      frames: frameData,
      context: options.context,
      max_frames: options.maxFrames,
      fps: options.fps,
    });

    return {
      embedding: result.embedding || [],
      frameEmbeddings: result.frame_embeddings,
      keyMoments: this.convertKeyMoments(result.key_moments),
      patterns: result.patterns || [],
      frameSimilarities: result.frame_similarities || [],
      flowSummary: result.flow_summary,
      confidence: result.confidence || 0,
    };
  }

  /**
   * Analyze a full video (URL or base64)
   */
  async analyzeVideo(
    video: string | Buffer,
    options: {
      query?: string;
      maxFrames?: number;
      fps?: number;
    } = {}
  ): Promise<TemporalAnalysis & { frameCount: number }> {
    const videoData = Buffer.isBuffer(video) ? video.toString('base64') : video;

    const result = await this.callEndpoint({
      type: 'video_understanding',
      video: videoData,
      context: options.query,
      max_frames: options.maxFrames,
      fps: options.fps,
    });

    return {
      embedding: result.embedding || [],
      frameEmbeddings: result.frame_embeddings,
      keyMoments: this.convertKeyMoments(result.key_moments),
      patterns: result.patterns || [],
      frameSimilarities: result.frame_similarities || [],
      flowSummary: result.flow_summary,
      confidence: result.confidence || 0,
      frameCount: result.frame_embeddings?.length || 0,
    };
  }

  /**
   * Predict next likely action from context
   */
  async predictNextAction(
    recentFrames: string[] | Buffer[],
    actionHistory: string[]
  ): Promise<ActionPrediction> {
    const frameData = recentFrames.map(f =>
      Buffer.isBuffer(f) ? f.toString('base64') : f
    );

    const result = await this.callEndpoint({
      type: 'action_prediction',
      frames: frameData,
      action_history: actionHistory,
    });

    return {
      predictedAction: result.prediction?.predicted_action || 'unknown',
      confidence: result.prediction?.confidence || 0,
      alternatives: result.prediction?.alternatives || [],
      trajectoryMagnitude: result.prediction?.trajectory_magnitude || 0,
    };
  }

  /**
   * Verify that a demo video shows expected behaviors
   * Used for automated testing and quality assurance
   */
  async verifyDemo(
    video: string | Buffer,
    expectedBehaviors: string[]
  ): Promise<DemoVerification> {
    const videoData = Buffer.isBuffer(video) ? video.toString('base64') : video;

    const result = await this.callEndpoint({
      type: 'demo_verification',
      video: videoData,
      expected_behaviors: expectedBehaviors,
    });

    return {
      behaviorsDetected: result.verification?.behaviors_detected || [],
      behaviorsMissing: result.verification?.behaviors_missing || [],
      confidence: result.verification?.confidence || 0,
      verificationPassed: result.verification?.verification_passed || false,
    };
  }

  /**
   * Analyze conversation flow from screenshots
   * Primary method for Fix My App feature
   */
  async analyzeConversationFlow(
    screenshots: string[] | Buffer[]
  ): Promise<ConversationAnalysis> {
    const frameData = screenshots.map(f =>
      Buffer.isBuffer(f) ? f.toString('base64') : f
    );

    const result = await this.callEndpoint({
      type: 'conversation_flow',
      frames: frameData,
    });

    const analysis = result.conversation_analysis;

    return {
      temporalEmbedding: analysis?.temporal_embedding || result.embedding || [],
      frameCount: analysis?.frame_count || screenshots.length,
      keyMoments: this.convertKeyMoments(analysis?.key_moments || result.key_moments),
      frameSimilarities: analysis?.frame_similarities || result.frame_similarities || [],
      conversationFlow: {
        errorPoints: analysis?.conversation_flow?.error_points || [],
        pivotPoints: analysis?.conversation_flow?.pivot_points || [],
        resolutionPoints: analysis?.conversation_flow?.resolution_points || [],
      },
      patterns: analysis?.patterns || result.patterns || [],
      recommendations: analysis?.recommendations || result.recommendations || [],
    };
  }

  /**
   * Analyze UI interaction patterns
   */
  async analyzeUIInteractions(
    frames: string[] | Buffer[]
  ): Promise<UIAnalysis> {
    const frameData = frames.map(f =>
      Buffer.isBuffer(f) ? f.toString('base64') : f
    );

    const result = await this.callEndpoint({
      type: 'ui_interaction',
      frames: frameData,
    });

    return {
      interactionDensity: result.ui_analysis?.interaction_density || 0,
      navigationPattern: (result.ui_analysis?.navigation_pattern as 'linear' | 'complex') || 'linear',
      detectedInteractions: this.convertKeyMoments(result.ui_analysis?.detected_interactions),
    };
  }

  /**
   * Detect keyframes in video
   */
  async detectKeyframes(
    video: string | Buffer,
    options: { maxFrames?: number } = {}
  ): Promise<Array<{ frameIndex: number; timestamp: number; importance: number }>> {
    const videoData = Buffer.isBuffer(video) ? video.toString('base64') : video;

    const result = await this.callEndpoint({
      type: 'keyframe_detection',
      video: videoData,
      max_frames: options.maxFrames,
    });

    return (result.keyframes || []).map(kf => ({
      frameIndex: kf.frame_index,
      timestamp: kf.timestamp,
      importance: kf.importance,
    }));
  }

  // =========================================================================
  // NEW: Proactive Error Prediction Methods
  // =========================================================================

  /**
   * Predict expected UI state after a code change
   * This is the core of proactive error prediction - we predict what the UI
   * SHOULD look like based on the code change, before actually rendering it.
   *
   * @param currentFrames - Rolling window of recent screenshots (5 frames recommended)
   * @param codeDescription - Natural language description of the code change
   * @returns Predicted state embedding and expected visual changes
   */
  async predictState(
    currentFrames: string[] | Buffer[],
    codeDescription: string
  ): Promise<StatePrediction> {
    const frameData = currentFrames.map(f =>
      Buffer.isBuffer(f) ? f.toString('base64') : f
    );

    const result = await this.callEndpoint({
      type: 'predict_state',
      frames: frameData,
      code_description: codeDescription,
    });

    const prediction = result.state_prediction;

    return {
      predictedStateEmbedding: prediction?.predicted_state_embedding || [],
      currentStateEmbedding: prediction?.current_state_embedding || [],
      trajectoryEmbedding: prediction?.trajectory_embedding || [],
      expectedChanges: prediction?.expected_changes || [],
      changeMagnitude: prediction?.change_magnitude || 0,
      confidence: prediction?.confidence || 0,
      predictionBasis: prediction?.prediction_basis || 'unknown',
    };
  }

  /**
   * Validate that a UI transition matches expected behavior
   * Compares actual frame sequence against expected transition description.
   *
   * @param frameSequence - Sequence of frames showing the transition
   * @param expectedTransition - Description of expected transition (e.g., "smooth fade", "instant switch")
   * @returns Validation result with deviation score and issues
   */
  async validateTransition(
    frameSequence: string[] | Buffer[],
    expectedTransition: string
  ): Promise<TransitionValidation> {
    const frameData = frameSequence.map(f =>
      Buffer.isBuffer(f) ? f.toString('base64') : f
    );

    const result = await this.callEndpoint({
      type: 'validate_transition',
      frames: frameData,
      expected_transition: expectedTransition,
    });

    const validation = result.validation;

    return {
      valid: validation?.valid || false,
      confidence: validation?.confidence || 0,
      deviationScore: validation?.deviation_score || 1,
      smoothness: validation?.smoothness || 0,
      transitionMagnitude: validation?.transition_magnitude || 0,
      issues: validation?.issues || [],
      frameCountAnalyzed: validation?.frame_count_analyzed || 0,
    };
  }

  /**
   * Proactively anticipate errors by comparing UI trajectory against intent
   * This is the core of V-JEPA 2's world model capability - predicting
   * divergence BEFORE it manifests as a visible error.
   *
   * @param frameSequence - Recent screenshots showing UI evolution
   * @param intentLock - Visual intent lock containing target embedding and checklist
   * @returns Error anticipation with warnings and suggested corrections
   */
  async anticipateError(
    frameSequence: string[] | Buffer[],
    intentLock: VisualIntentLock
  ): Promise<ErrorAnticipation> {
    const frameData = frameSequence.map(f =>
      Buffer.isBuffer(f) ? f.toString('base64') : f
    );

    const result = await this.callEndpoint({
      type: 'anticipate_error',
      frames: frameData,
      intent_embedding: intentLock.embedding,
      intent_checklist: intentLock.checklist,
    });

    const anticipation = result.error_anticipation;

    return {
      errorAnticipated: anticipation?.error_anticipated || false,
      confidence: anticipation?.confidence || 0,
      trajectoryDeviation: anticipation?.trajectory_deviation || 0,
      currentIntentSimilarity: anticipation?.current_intent_similarity || 0,
      projectedIntentSimilarity: anticipation?.projected_intent_similarity || 0,
      warnings: (anticipation?.warnings || []).map(w => ({
        type: w.type,
        severity: w.severity as 'low' | 'medium' | 'high' | 'critical',
        message: w.message,
      })),
      suggestedCorrections: anticipation?.suggested_corrections || [],
      checklistStatus: (anticipation?.checklist_status || []).map(c => ({
        item: c.item,
        status: c.status as 'complete' | 'partial' | 'missing',
        confidence: c.confidence,
      })),
    };
  }

  /**
   * Get pure temporal embedding for frame sequence
   * Useful for comparing temporal patterns across different sequences.
   *
   * @param frames - Sequence of frames to embed
   * @returns Temporal embedding and per-frame embeddings
   */
  async embedTemporal(
    frames: string[] | Buffer[]
  ): Promise<{ temporalEmbedding: number[]; frameEmbeddings: number[][] }> {
    const frameData = frames.map(f =>
      Buffer.isBuffer(f) ? f.toString('base64') : f
    );

    const result = await this.callEndpoint({
      type: 'temporal_embed',
      frames: frameData,
    });

    return {
      temporalEmbedding: result.temporal_embedding || result.embedding || [],
      frameEmbeddings: result.frame_embeddings || [],
    };
  }

  /**
   * Convert snake_case key moments to camelCase
   */
  private convertKeyMoments(moments?: Array<{
    frame_index?: number;
    frameIndex?: number;
    timestamp?: number;
    type?: string;
    description?: string;
    confidence?: number;
  }>): KeyMoment[] {
    if (!moments) return [];

    return moments.map(m => ({
      frameIndex: m.frame_index ?? m.frameIndex ?? 0,
      timestamp: m.timestamp || 0,
      type: (m.type || 'success') as KeyMoment['type'],
      description: m.description || '',
      confidence: m.confidence || 0,
    }));
  }

  /**
   * Call RunPod endpoint with retry logic
   */
  private async callEndpoint(input: Record<string, unknown>): Promise<VJEPA2Output> {
    if (!this.isConfigured()) {
      throw new Error(
        'V-JEPA 2 RunPod endpoint not configured. ' +
        'Set RUNPOD_API_KEY and RUNPOD_ENDPOINT_VJEPA2 environment variables.'
      );
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 180000); // 3 min timeout for video

        const response = await fetch(RUNPOD_ENDPOINT_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RUNPOD_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ input }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorText = await response.text();

          // Handle cold start (502/503)
          if (response.status === 502 || response.status === 503) {
            throw new Error('Endpoint starting up (cold start) - video models need more time');
          }

          throw new Error(`RunPod API error (${response.status}): ${errorText}`);
        }

        const data: RunPodResponse = await response.json();

        if (data.error) {
          throw new Error(`RunPod error: ${data.error}`);
        }

        if (data.output?.error) {
          throw new Error(`Handler error: ${data.output.error}`);
        }

        return data.output || {};

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.retryAttempts) {
          // Longer delays for video processing cold starts
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.warn(`[V-JEPA 2] Attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`[V-JEPA 2] Failed after ${this.retryAttempts} attempts: ${lastError?.message}`);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      if (!this.isConfigured()) {
        return {
          name: this.name,
          healthy: false,
          error: 'Endpoint not configured (need RUNPOD_ENDPOINT_VJEPA2)',
          lastChecked: new Date().toISOString(),
        };
      }

      // Simple test with minimal frames
      // Create a tiny test image (1x1 pixel)
      const testFrame = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const result = await this.callEndpoint({
        type: 'temporal_sequence',
        frames: [testFrame, testFrame],
      });

      if (!result.embedding || result.embedding.length === 0) {
        throw new Error('Invalid embedding response');
      }

      return {
        name: this.name,
        healthy: true,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        name: this.name,
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString(),
      };
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let providerInstance: RunPodVJEPA2Provider | null = null;

export function getVJEPA2Provider(): RunPodVJEPA2Provider {
  if (!providerInstance) {
    providerInstance = new RunPodVJEPA2Provider();
  }
  return providerInstance;
}

export function resetVJEPA2Provider(): void {
  providerInstance = null;
}

export default RunPodVJEPA2Provider;
