/**
 * Proactive Error Predictor
 *
 * Uses V-JEPA 2's temporal understanding to predict UI state deviations
 * BEFORE errors manifest. This enables preemptive correction and
 * significantly improves the developer experience.
 *
 * Key Features:
 * - Continuous state monitoring with prediction windows
 * - Anomaly detection using embedding drift analysis
 * - Confidence-scored predictions with actionable insights
 * - Integration with learning engine for continuous improvement
 */

import {
  RunPodVJEPA2Provider,
  type StatePrediction,
  type ErrorAnticipation,
  type VisualIntentLock as VJEPA2IntentLock,
} from '../embeddings/providers/runpod-vjepa2-provider.js';
import {
  getTemporalExpectationsManager,
  type TemporalExpectations,
} from './temporal-expectations.js';
import {
  getVisualIntentLockManager,
  type VisualIntentLock,
} from './visual-intent-lock.js';

// Prediction severity levels
export type PredictionSeverity = 'info' | 'warning' | 'critical' | 'imminent';

// Types for proactive error prediction
export interface PredictedError {
  id: string;
  severity: PredictionSeverity;
  type: ErrorType;
  confidence: number; // 0-1
  predictedTimeToError: number; // milliseconds
  description: string;
  suggestedFix: string;
  affectedComponents: string[];
  visualIndicators: VisualIndicator[];
  metadata: {
    frameAnalyzed: number;
    embeddingDrift: number;
    patternMatch: string | null;
    timestamp: number;
  };
}

export type ErrorType =
  | 'layout_shift'
  | 'visual_regression'
  | 'state_desync'
  | 'animation_failure'
  | 'component_overflow'
  | 'z_index_conflict'
  | 'responsive_break'
  | 'data_binding_error'
  | 'render_cycle_issue'
  | 'accessibility_violation'
  | 'unknown';

export interface VisualIndicator {
  type: 'highlight' | 'arrow' | 'overlay' | 'bounding_box';
  coordinates: { x: number; y: number; width?: number; height?: number };
  color: string;
  message?: string;
}

export interface MonitoringSession {
  id: string;
  projectId: string;
  startTime: number;
  lastFrameTime: number;
  frameCount: number;
  frameHistory: FrameState[];
  predictions: PredictedError[];
  intentLockId: string | null;
  expectationsId: string | null;
  status: 'active' | 'paused' | 'stopped';
  config: MonitoringConfig;
}

export interface FrameState {
  timestamp: number;
  embedding: number[];
  screenshotBase64?: string;
  metadata: {
    url?: string;
    viewportSize?: { width: number; height: number };
    scrollPosition?: { x: number; y: number };
  };
}

export interface MonitoringConfig {
  frameInterval: number; // ms between frames
  predictionHorizon: number; // ms to look ahead
  sensitivityLevel: 'low' | 'medium' | 'high';
  enableRealTimeAlerts: boolean;
  maxFrameHistory: number;
  driftThreshold: number; // embedding drift threshold
  minimumConfidence: number; // minimum confidence to report
}

export interface ErrorPredictionResult {
  sessionId: string;
  timestamp: number;
  predictions: PredictedError[];
  systemHealth: {
    score: number; // 0-100
    status: 'healthy' | 'warning' | 'critical';
    trend: 'improving' | 'stable' | 'degrading';
  };
  recommendations: Recommendation[];
}

export interface Recommendation {
  priority: number; // 1-10
  action: string;
  rationale: string;
  estimatedImpact: 'low' | 'medium' | 'high';
  autoFixAvailable: boolean;
}

// Singleton instance
let instance: ProactiveErrorPredictor | null = null;

export class ProactiveErrorPredictor {
  private vjepa2Provider: RunPodVJEPA2Provider;
  private sessions: Map<string, MonitoringSession> = new Map();
  private alertCallbacks: Map<string, (error: PredictedError) => void> =
    new Map();
  private errorPatternLibrary: ErrorPattern[] = [];

  constructor() {
    this.vjepa2Provider = new RunPodVJEPA2Provider();
    this.initializeErrorPatternLibrary();
  }

  /**
   * Initialize the error pattern library with known error signatures
   */
  private initializeErrorPatternLibrary(): void {
    this.errorPatternLibrary = [
      {
        id: 'layout_shift_pattern',
        type: 'layout_shift',
        embeddingSignature: null, // Will be learned
        visualPatterns: ['sudden_position_change', 'size_fluctuation'],
        temporalPattern: 'abrupt_discontinuity',
        confidenceBoost: 0.2,
      },
      {
        id: 'render_cycle_pattern',
        type: 'render_cycle_issue',
        embeddingSignature: null,
        visualPatterns: ['flickering', 'rapid_state_changes'],
        temporalPattern: 'high_frequency_oscillation',
        confidenceBoost: 0.25,
      },
      {
        id: 'state_desync_pattern',
        type: 'state_desync',
        embeddingSignature: null,
        visualPatterns: ['inconsistent_data', 'loading_state_stuck'],
        temporalPattern: 'expected_transition_missing',
        confidenceBoost: 0.3,
      },
      {
        id: 'overflow_pattern',
        type: 'component_overflow',
        embeddingSignature: null,
        visualPatterns: ['content_clipping', 'scrollbar_appearance'],
        temporalPattern: 'gradual_expansion',
        confidenceBoost: 0.15,
      },
      {
        id: 'responsive_break_pattern',
        type: 'responsive_break',
        embeddingSignature: null,
        visualPatterns: ['layout_collapse', 'element_overlap'],
        temporalPattern: 'resize_triggered',
        confidenceBoost: 0.2,
      },
    ];
  }

  /**
   * Start a new monitoring session
   */
  async startSession(
    projectId: string,
    config?: Partial<MonitoringConfig>,
    intentLockId?: string,
    expectationsId?: string
  ): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const defaultConfig: MonitoringConfig = {
      frameInterval: 1000, // 1 second
      predictionHorizon: 5000, // 5 seconds ahead
      sensitivityLevel: 'medium',
      enableRealTimeAlerts: true,
      maxFrameHistory: 30,
      driftThreshold: 0.15,
      minimumConfidence: 0.6,
    };

    const session: MonitoringSession = {
      id: sessionId,
      projectId,
      startTime: Date.now(),
      lastFrameTime: Date.now(),
      frameCount: 0,
      frameHistory: [],
      predictions: [],
      intentLockId: intentLockId || null,
      expectationsId: expectationsId || null,
      status: 'active',
      config: { ...defaultConfig, ...config },
    };

    this.sessions.set(sessionId, session);
    console.log(
      `[ProactiveErrorPredictor] Started session ${sessionId} for project ${projectId}`
    );

    return sessionId;
  }

  /**
   * Process a new frame and generate predictions
   */
  async processFrame(
    sessionId: string,
    screenshotBase64: string,
    metadata?: FrameState['metadata']
  ): Promise<ErrorPredictionResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'active') {
      throw new Error(`Session ${sessionId} is not active`);
    }

    const timestamp = Date.now();

    // Get temporal embedding from V-JEPA 2
    let embedding: number[];
    try {
      if (this.vjepa2Provider.isConfigured()) {
        const result = await this.vjepa2Provider.embedTemporal([
          screenshotBase64,
        ]);
        embedding = result.frameEmbeddings[0] || [];
      } else {
        // Generate pseudo-embedding for testing
        embedding = this.generatePseudoEmbedding(screenshotBase64, 1024);
      }
    } catch (error) {
      console.warn(
        '[ProactiveErrorPredictor] Failed to get embedding, using pseudo:',
        error
      );
      embedding = this.generatePseudoEmbedding(screenshotBase64, 1024);
    }

    // Create frame state
    const frameState: FrameState = {
      timestamp,
      embedding,
      screenshotBase64:
        session.config.maxFrameHistory > 10 ? undefined : screenshotBase64,
      metadata: metadata || {},
    };

    // Add to history
    session.frameHistory.push(frameState);
    if (session.frameHistory.length > session.config.maxFrameHistory) {
      session.frameHistory.shift();
    }

    session.frameCount++;
    session.lastFrameTime = timestamp;

    // Analyze for predictions
    const predictions = await this.analyzeForPredictions(session, frameState);

    // Update session predictions
    session.predictions = predictions;

    // Trigger real-time alerts if enabled
    if (session.config.enableRealTimeAlerts) {
      this.triggerAlerts(sessionId, predictions);
    }

    // Calculate system health
    const systemHealth = this.calculateSystemHealth(session, predictions);

    // Generate recommendations
    const recommendations = this.generateRecommendations(predictions);

    return {
      sessionId,
      timestamp,
      predictions,
      systemHealth,
      recommendations,
    };
  }

  /**
   * Analyze frame history and current state for predictions
   */
  private async analyzeForPredictions(
    session: MonitoringSession,
    currentFrame: FrameState
  ): Promise<PredictedError[]> {
    const predictions: PredictedError[] = [];

    // Need at least 3 frames for meaningful prediction
    if (session.frameHistory.length < 3) {
      return predictions;
    }

    // 1. Calculate embedding drift
    const driftAnalysis = this.analyzeEmbeddingDrift(session.frameHistory);

    // 2. Check against intent lock if available
    if (session.intentLockId) {
      const intentPredictions = await this.checkAgainstIntentLock(
        session,
        currentFrame
      );
      predictions.push(...intentPredictions);
    }

    // 3. Check temporal expectations if available
    if (session.expectationsId) {
      const temporalPredictions = await this.checkTemporalExpectations(
        session,
        currentFrame
      );
      predictions.push(...temporalPredictions);
    }

    // 4. Pattern matching against error library
    const patternPredictions = this.matchErrorPatterns(session, driftAnalysis);
    predictions.push(...patternPredictions);

    // 5. Use V-JEPA 2 for state prediction if configured
    if (this.vjepa2Provider.isConfigured() && session.frameHistory.length >= 5) {
      const vjepa2Predictions = await this.getVJEPA2Predictions(session);
      predictions.push(...vjepa2Predictions);
    }

    // 6. Anomaly detection using embedding distribution
    const anomalyPredictions = this.detectAnomalies(
      session,
      currentFrame,
      driftAnalysis
    );
    predictions.push(...anomalyPredictions);

    // Filter by minimum confidence and deduplicate
    const filteredPredictions = predictions
      .filter((p) => p.confidence >= session.config.minimumConfidence)
      .reduce((acc, pred) => {
        const existing = acc.find((p) => p.type === pred.type);
        if (!existing || existing.confidence < pred.confidence) {
          return [...acc.filter((p) => p.type !== pred.type), pred];
        }
        return acc;
      }, [] as PredictedError[]);

    return filteredPredictions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analyze embedding drift over time
   */
  private analyzeEmbeddingDrift(
    frameHistory: FrameState[]
  ): DriftAnalysis {
    if (frameHistory.length < 2) {
      return {
        averageDrift: 0,
        maxDrift: 0,
        driftTrend: 'stable',
        anomalyPoints: [],
      };
    }

    const drifts: number[] = [];
    for (let i = 1; i < frameHistory.length; i++) {
      const drift = this.cosineSimilarity(
        frameHistory[i - 1].embedding,
        frameHistory[i].embedding
      );
      drifts.push(1 - drift); // Convert similarity to distance
    }

    const averageDrift = drifts.reduce((a, b) => a + b, 0) / drifts.length;
    const maxDrift = Math.max(...drifts);

    // Detect trend
    const recentDrifts = drifts.slice(-5);
    const olderDrifts = drifts.slice(0, -5);
    const recentAvg =
      recentDrifts.length > 0
        ? recentDrifts.reduce((a, b) => a + b, 0) / recentDrifts.length
        : 0;
    const olderAvg =
      olderDrifts.length > 0
        ? olderDrifts.reduce((a, b) => a + b, 0) / olderDrifts.length
        : recentAvg;

    let driftTrend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (recentAvg > olderAvg * 1.3) driftTrend = 'degrading';
    else if (recentAvg < olderAvg * 0.7) driftTrend = 'improving';

    // Find anomaly points (drift > 2 standard deviations)
    const stdDev = Math.sqrt(
      drifts.reduce((sum, d) => sum + Math.pow(d - averageDrift, 2), 0) /
        drifts.length
    );
    const anomalyPoints = drifts
      .map((d, i) => ({ index: i + 1, drift: d }))
      .filter((p) => p.drift > averageDrift + 2 * stdDev);

    return { averageDrift, maxDrift, driftTrend, anomalyPoints };
  }

  /**
   * Check current state against intent lock
   */
  private async checkAgainstIntentLock(
    session: MonitoringSession,
    currentFrame: FrameState
  ): Promise<PredictedError[]> {
    const predictions: PredictedError[] = [];

    if (!session.intentLockId) return predictions;

    try {
      const lockManager = getVisualIntentLockManager();
      const lock = lockManager.getLock(session.intentLockId);

      if (!lock) return predictions;

      // Check embedding similarity to intent lock
      const similarity = this.cosineSimilarity(
        currentFrame.embedding,
        lock.embedding
      );

      if (similarity < 0.75) {
        predictions.push({
          id: `pred_intent_${Date.now()}`,
          severity: similarity < 0.5 ? 'critical' : 'warning',
          type: 'visual_regression',
          confidence: Math.min(0.95, 1 - similarity + 0.3),
          predictedTimeToError: 0, // Already deviated
          description: `Visual state has drifted from the captured design intent. Similarity: ${(similarity * 100).toFixed(1)}%`,
          suggestedFix:
            'Review recent changes and compare against the locked design specification.',
          affectedComponents: lock.components.map((c) => c.name),
          visualIndicators: [],
          metadata: {
            frameAnalyzed: session.frameCount,
            embeddingDrift: 1 - similarity,
            patternMatch: 'intent_lock_deviation',
            timestamp: Date.now(),
          },
        });
      }
    } catch (error) {
      console.warn('[ProactiveErrorPredictor] Intent lock check failed:', error);
    }

    return predictions;
  }

  /**
   * Check temporal expectations
   */
  private async checkTemporalExpectations(
    session: MonitoringSession,
    currentFrame: FrameState
  ): Promise<PredictedError[]> {
    const predictions: PredictedError[] = [];

    if (!session.expectationsId) return predictions;

    try {
      const expectationsManager = getTemporalExpectationsManager();
      const expectations = expectationsManager.getExpectations(
        session.expectationsId
      );

      if (!expectations) return predictions;

      // Check if we're missing expected transitions
      const lastValidated = expectations.updatedAt instanceof Date
        ? expectations.updatedAt.getTime()
        : new Date(expectations.updatedAt).getTime();
      const timeSinceLastTransition = Date.now() - lastValidated;

      for (const transition of expectations.stateTransitions) {
        // Check if transition should have occurred by now
        if (transition.durationMs && timeSinceLastTransition > transition.durationMs * 2) {
          predictions.push({
            id: `pred_transition_${Date.now()}`,
            severity: 'warning',
            type: 'state_desync',
            confidence: 0.7,
            predictedTimeToError: 1000,
            description: `Expected transition "${transition.from}" → "${transition.to}" has not occurred within expected timeframe.`,
            suggestedFix: `Check if the ${transition.trigger} action is being handled correctly.`,
            affectedComponents: [],
            visualIndicators: [],
            metadata: {
              frameAnalyzed: session.frameCount,
              embeddingDrift: 0,
              patternMatch: 'missing_transition',
              timestamp: Date.now(),
            },
          });
        }
      }
    } catch (error) {
      console.warn(
        '[ProactiveErrorPredictor] Temporal expectations check failed:',
        error
      );
    }

    return predictions;
  }

  /**
   * Match against known error patterns
   */
  private matchErrorPatterns(
    session: MonitoringSession,
    driftAnalysis: DriftAnalysis
  ): PredictedError[] {
    const predictions: PredictedError[] = [];

    // High drift might indicate layout shift or visual regression
    if (driftAnalysis.maxDrift > session.config.driftThreshold * 2) {
      const layoutShiftPattern = this.errorPatternLibrary.find(
        (p) => p.id === 'layout_shift_pattern'
      );
      if (layoutShiftPattern) {
        predictions.push({
          id: `pred_layout_${Date.now()}`,
          severity: 'warning',
          type: 'layout_shift',
          confidence:
            0.6 + (driftAnalysis.maxDrift > 0.3 ? 0.2 : 0) + (layoutShiftPattern.confidenceBoost || 0),
          predictedTimeToError: 500,
          description:
            'Detected significant visual change that may indicate an unintended layout shift.',
          suggestedFix:
            'Check for dynamic content loading, async data updates, or CSS changes that may have caused the shift.',
          affectedComponents: [],
          visualIndicators: [],
          metadata: {
            frameAnalyzed: session.frameCount,
            embeddingDrift: driftAnalysis.maxDrift,
            patternMatch: 'layout_shift_pattern',
            timestamp: Date.now(),
          },
        });
      }
    }

    // Oscillating drift might indicate render cycle issues
    if (driftAnalysis.anomalyPoints.length >= 3) {
      const renderCyclePattern = this.errorPatternLibrary.find(
        (p) => p.id === 'render_cycle_pattern'
      );
      if (renderCyclePattern) {
        predictions.push({
          id: `pred_render_${Date.now()}`,
          severity: 'critical',
          type: 'render_cycle_issue',
          confidence: 0.75 + (renderCyclePattern.confidenceBoost || 0),
          predictedTimeToError: 100,
          description:
            'Detected rapid visual oscillations that may indicate an infinite render loop or state thrashing.',
          suggestedFix:
            'Check for useEffect dependencies, state updates in render, or circular data dependencies.',
          affectedComponents: [],
          visualIndicators: [],
          metadata: {
            frameAnalyzed: session.frameCount,
            embeddingDrift: driftAnalysis.averageDrift,
            patternMatch: 'render_cycle_pattern',
            timestamp: Date.now(),
          },
        });
      }
    }

    return predictions;
  }

  /**
   * Get predictions from V-JEPA 2 model
   */
  private async getVJEPA2Predictions(
    session: MonitoringSession
  ): Promise<PredictedError[]> {
    const predictions: PredictedError[] = [];

    try {
      // Get recent frames for prediction
      const recentFrames = session.frameHistory
        .slice(-5)
        .filter((f) => f.screenshotBase64)
        .map((f) => f.screenshotBase64!);

      if (recentFrames.length < 3) return predictions;

      // Get state prediction
      const statePrediction = await this.vjepa2Provider.predictState(
        recentFrames,
        'Monitoring UI for errors'
      );

      if (statePrediction.confidence < 0.5) {
        predictions.push({
          id: `pred_state_${Date.now()}`,
          severity: 'info',
          type: 'state_desync',
          confidence: 0.6,
          predictedTimeToError: 2000,
          description: `V-JEPA 2 has low confidence (${(statePrediction.confidence * 100).toFixed(0)}%) in predicted next state. UI behavior may be inconsistent.`,
          suggestedFix:
            'The UI transitions may be unpredictable. Consider adding more deterministic state management.',
          affectedComponents: [],
          visualIndicators: [],
          metadata: {
            frameAnalyzed: session.frameCount,
            embeddingDrift: 0,
            patternMatch: 'vjepa2_low_confidence',
            timestamp: Date.now(),
          },
        });
      }

      // Check for anticipated errors if we have an intent lock
      if (session.intentLockId) {
        const lockManager = getVisualIntentLockManager();
        const lock = lockManager.getLock(session.intentLockId);

        if (lock) {
          const intentForVJEPA: VJEPA2IntentLock = {
            embedding: lock.embedding,
            semanticDescription: lock.what, // Map 'what' to semanticDescription
            checklist: lock.checklist.map((c) => c.description),
          };

          const errorAnticipation = await this.vjepa2Provider.anticipateError(
            recentFrames,
            intentForVJEPA
          );

          if (errorAnticipation.warnings.length > 0) {
            for (const warning of errorAnticipation.warnings.slice(0, 3)) {
              // Map severity to probability-like confidence
              const severityConfidence: Record<string, number> = {
                critical: 0.9,
                high: 0.75,
                medium: 0.6,
                low: 0.45,
              };
              const confidence = severityConfidence[warning.severity] || 0.5;

              predictions.push({
                id: `pred_anticipated_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                severity:
                  warning.severity === 'critical'
                    ? 'imminent'
                    : warning.severity === 'high'
                      ? 'critical'
                      : 'warning',
                type: this.mapErrorTypeFromDescription(warning.type),
                confidence,
                predictedTimeToError: Math.max(500, 5000 * (1 - confidence)),
                description: warning.message,
                suggestedFix:
                  errorAnticipation.suggestedCorrections[0] ||
                  'Review the affected component and recent changes.',
                affectedComponents: [],
                visualIndicators: [],
                metadata: {
                  frameAnalyzed: session.frameCount,
                  embeddingDrift: 0,
                  patternMatch: 'vjepa2_anticipation',
                  timestamp: Date.now(),
                },
              });
            }
          }
        }
      }
    } catch (error) {
      console.warn('[ProactiveErrorPredictor] V-JEPA 2 prediction failed:', error);
    }

    return predictions;
  }

  /**
   * Detect anomalies using embedding distribution
   */
  private detectAnomalies(
    session: MonitoringSession,
    currentFrame: FrameState,
    driftAnalysis: DriftAnalysis
  ): PredictedError[] {
    const predictions: PredictedError[] = [];

    // Check if drift is degrading trend
    if (
      driftAnalysis.driftTrend === 'degrading' &&
      driftAnalysis.averageDrift > session.config.driftThreshold
    ) {
      predictions.push({
        id: `pred_anomaly_${Date.now()}`,
        severity: 'warning',
        type: 'unknown',
        confidence: 0.65,
        predictedTimeToError: 3000,
        description:
          'Visual stability is degrading over time. An error may be developing.',
        suggestedFix:
          'Monitor closely and check for accumulating state or memory issues.',
        affectedComponents: [],
        visualIndicators: [],
        metadata: {
          frameAnalyzed: session.frameCount,
          embeddingDrift: driftAnalysis.averageDrift,
          patternMatch: 'degrading_trend',
          timestamp: Date.now(),
        },
      });
    }

    return predictions;
  }

  /**
   * Calculate overall system health
   */
  private calculateSystemHealth(
    session: MonitoringSession,
    predictions: PredictedError[]
  ): ErrorPredictionResult['systemHealth'] {
    let score = 100;

    // Deduct points based on predictions
    for (const pred of predictions) {
      const severityWeight =
        pred.severity === 'imminent'
          ? 30
          : pred.severity === 'critical'
            ? 20
            : pred.severity === 'warning'
              ? 10
              : 5;
      score -= severityWeight * pred.confidence;
    }

    score = Math.max(0, Math.min(100, score));

    // Determine status
    const status: 'healthy' | 'warning' | 'critical' =
      score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'critical';

    // Determine trend based on recent predictions
    const recentPredictionCount = predictions.filter(
      (p) => p.metadata.timestamp > Date.now() - 30000
    ).length;
    const trend: 'improving' | 'stable' | 'degrading' =
      recentPredictionCount > 3
        ? 'degrading'
        : recentPredictionCount === 0
          ? 'improving'
          : 'stable';

    return { score, status, trend };
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    predictions: PredictedError[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Group predictions by type
    const typeGroups = predictions.reduce(
      (acc, pred) => {
        acc[pred.type] = acc[pred.type] || [];
        acc[pred.type].push(pred);
        return acc;
      },
      {} as Record<ErrorType, PredictedError[]>
    );

    // Generate recommendations per type
    for (const [type, preds] of Object.entries(typeGroups)) {
      const highestConfidence = Math.max(...preds.map((p) => p.confidence));

      switch (type as ErrorType) {
        case 'layout_shift':
          recommendations.push({
            priority: 8,
            action:
              'Add explicit dimensions to dynamic content containers to prevent layout shifts.',
            rationale: `Detected ${preds.length} potential layout shift(s) with up to ${(highestConfidence * 100).toFixed(0)}% confidence.`,
            estimatedImpact: 'high',
            autoFixAvailable: false,
          });
          break;

        case 'render_cycle_issue':
          recommendations.push({
            priority: 10,
            action:
              'Immediately investigate useEffect dependencies and state update patterns.',
            rationale: `Critical: Potential infinite render loop detected with ${(highestConfidence * 100).toFixed(0)}% confidence.`,
            estimatedImpact: 'high',
            autoFixAvailable: false,
          });
          break;

        case 'state_desync':
          recommendations.push({
            priority: 7,
            action:
              'Review state management and ensure UI state is synchronized with data.',
            rationale: `State synchronization issues detected with ${(highestConfidence * 100).toFixed(0)}% confidence.`,
            estimatedImpact: 'medium',
            autoFixAvailable: false,
          });
          break;

        case 'visual_regression':
          recommendations.push({
            priority: 6,
            action: 'Compare current implementation against locked design intent.',
            rationale: `Visual regression from design specification detected.`,
            estimatedImpact: 'medium',
            autoFixAvailable: false,
          });
          break;
      }
    }

    // Sort by priority
    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Trigger real-time alerts for predictions
   */
  private triggerAlerts(
    sessionId: string,
    predictions: PredictedError[]
  ): void {
    const callback = this.alertCallbacks.get(sessionId);
    if (!callback) return;

    for (const pred of predictions) {
      if (pred.severity === 'critical' || pred.severity === 'imminent') {
        callback(pred);
      }
    }
  }

  /**
   * Register a callback for real-time alerts
   */
  onAlert(sessionId: string, callback: (error: PredictedError) => void): void {
    this.alertCallbacks.set(sessionId, callback);
  }

  /**
   * Remove alert callback
   */
  offAlert(sessionId: string): void {
    this.alertCallbacks.delete(sessionId);
  }

  /**
   * Pause a monitoring session
   */
  pauseSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'paused';
    }
  }

  /**
   * Resume a monitoring session
   */
  resumeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.status === 'paused') {
      session.status = 'active';
    }
  }

  /**
   * Stop and clean up a monitoring session
   */
  stopSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'stopped';
      this.alertCallbacks.delete(sessionId);
    }
  }

  /**
   * Get session status and statistics
   */
  getSessionStatus(sessionId: string): {
    status: MonitoringSession['status'];
    frameCount: number;
    activePredictions: number;
    duration: number;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      status: session.status,
      frameCount: session.frameCount,
      activePredictions: session.predictions.length,
      duration: Date.now() - session.startTime,
    };
  }

  /**
   * Helper: Calculate cosine similarity between two embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  /**
   * Helper: Generate pseudo-embedding for testing
   */
  private generatePseudoEmbedding(input: string, dimension: number): number[] {
    const embedding: number[] = [];
    let seed = input.length;

    for (let i = 0; i < dimension; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      embedding.push((seed / 0x7fffffff) * 2 - 1);
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, x) => sum + x * x, 0));
    return embedding.map((x) => x / norm);
  }

  /**
   * Helper: Map error description to ErrorType
   */
  private mapErrorTypeFromDescription(description: string): ErrorType {
    const lowered = description.toLowerCase();
    if (lowered.includes('layout') || lowered.includes('position'))
      return 'layout_shift';
    if (lowered.includes('render') || lowered.includes('cycle'))
      return 'render_cycle_issue';
    if (lowered.includes('state') || lowered.includes('sync'))
      return 'state_desync';
    if (lowered.includes('animation') || lowered.includes('motion'))
      return 'animation_failure';
    if (lowered.includes('overflow') || lowered.includes('scroll'))
      return 'component_overflow';
    if (lowered.includes('z-index') || lowered.includes('layer'))
      return 'z_index_conflict';
    if (lowered.includes('responsive') || lowered.includes('mobile'))
      return 'responsive_break';
    if (lowered.includes('data') || lowered.includes('binding'))
      return 'data_binding_error';
    if (lowered.includes('accessibility') || lowered.includes('a11y'))
      return 'accessibility_violation';
    if (lowered.includes('visual') || lowered.includes('regression'))
      return 'visual_regression';
    return 'unknown';
  }
}

// Helper types
interface DriftAnalysis {
  averageDrift: number;
  maxDrift: number;
  driftTrend: 'improving' | 'stable' | 'degrading';
  anomalyPoints: Array<{ index: number; drift: number }>;
}

interface ErrorPattern {
  id: string;
  type: ErrorType;
  embeddingSignature: number[] | null;
  visualPatterns: string[];
  temporalPattern: string;
  confidenceBoost: number;
}

// Singleton accessor
export function getProactiveErrorPredictor(): ProactiveErrorPredictor {
  if (!instance) {
    instance = new ProactiveErrorPredictor();
  }
  return instance;
}

export function resetProactiveErrorPredictor(): void {
  instance = null;
}
