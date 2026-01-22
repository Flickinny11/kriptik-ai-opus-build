/**
 * Temporal Expectations
 *
 * Uses V-JEPA 2's world model capabilities to define expected UI state
 * transitions and temporal patterns. This enables proactive error detection
 * by predicting what the UI SHOULD look like based on code changes.
 *
 * Key Concepts:
 * - State Transitions: Expected visual changes between UI states
 * - Motion Patterns: Animation and transition expectations
 * - Anticipated Actions: Predicted user/system interactions
 * - Physics Context: Natural motion understanding
 */

import {
  getVJEPA2Provider,
  type StatePrediction,
  type TransitionValidation,
  type ErrorAnticipation,
} from '../embeddings/providers/runpod-vjepa2-provider.js';
import type { VisualIntentLock } from './visual-intent-lock.js';

// ============================================================================
// Types
// ============================================================================

export interface StateTransition {
  /** Unique ID */
  id: string;
  /** Source state description */
  from: string;
  /** Target state description */
  to: string;
  /** Trigger for this transition */
  trigger: 'user_action' | 'code_change' | 'data_load' | 'animation' | 'navigation';
  /** Expected duration in ms */
  durationMs?: number;
  /** Transition type */
  type: 'instant' | 'fade' | 'slide' | 'scale' | 'morph' | 'custom';
  /** Embedding for from state */
  fromEmbedding?: number[];
  /** Embedding for to state */
  toEmbedding?: number[];
  /** Expected intermediate states */
  intermediateStates?: string[];
  /** Confidence score */
  confidence: number;
}

export interface MotionPattern {
  /** Pattern name */
  name: string;
  /** Description of the motion */
  description: string;
  /** Motion type */
  type: 'linear' | 'ease_in' | 'ease_out' | 'ease_in_out' | 'spring' | 'bounce';
  /** Duration in ms */
  durationMs: number;
  /** Affected elements */
  affectedElements: string[];
  /** Expected timing function */
  timingFunction?: string;
  /** Smoothness score (0-1) */
  smoothness: number;
}

export interface AnticipatedAction {
  /** Action description */
  action: string;
  /** Probability of this action occurring */
  probability: number;
  /** Expected UI change */
  expectedChange: string;
  /** Trigger type */
  triggerType: 'click' | 'scroll' | 'hover' | 'input' | 'load' | 'timer';
  /** Alternative actions */
  alternatives?: string[];
}

export interface TemporalExpectations {
  /** Unique identifier */
  id: string;
  /** Associated intent lock ID */
  intentLockId: string;
  /** Project ID */
  projectId: string;

  // === V-JEPA 2 Predictions ===
  /** Expected state transitions */
  stateTransitions: StateTransition[];
  /** Motion patterns from video analysis */
  motionPatterns: MotionPattern[];
  /** Anticipated next actions */
  anticipatedActions: AnticipatedAction[];
  /** Physics context (natural motion understanding) */
  physicsContext: string;

  // === Temporal Embeddings ===
  /** Overall temporal embedding (1024-dim) */
  temporalEmbedding: number[];
  /** Per-frame embeddings if from video */
  frameEmbeddings?: number[][];
  /** Key moments detected */
  keyMoments: Array<{
    frameIndex: number;
    timestamp: number;
    type: 'error' | 'success' | 'pivot' | 'frustration' | 'breakthrough';
    description: string;
    confidence: number;
  }>;

  // === State Tracking ===
  /** Current state index (which transition we're at) */
  currentStateIndex: number;
  /** Rolling window of recent embeddings (for trajectory) */
  recentEmbeddings: number[][];
  /** Trajectory direction */
  trajectoryDirection: 'toward_intent' | 'away_from_intent' | 'stable';

  // === Metadata ===
  /** Source type */
  sourceType: 'video' | 'image_sequence' | 'single_image' | 'predicted';
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Overall confidence */
  confidence: number;
}

export interface TransitionValidationResult {
  /** Did the transition match expectations? */
  valid: boolean;
  /** Overall score (0-1) */
  score: number;
  /** Smoothness score */
  smoothness: number;
  /** Timing accuracy */
  timingAccuracy: number;
  /** Visual consistency */
  visualConsistency: number;
  /** Issues found */
  issues: string[];
  /** Suggestions */
  suggestions: string[];
}

export interface NextStatePrediction {
  /** Predicted next state embedding */
  embedding: number[];
  /** Description of expected state */
  description: string;
  /** Expected changes from current */
  expectedChanges: string[];
  /** Confidence score */
  confidence: number;
  /** Time until this state (ms) */
  expectedTimeMs?: number;
}

export interface ErrorAnticipationResult {
  /** Is an error anticipated? */
  errorAnticipated: boolean;
  /** Severity if error anticipated */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Warning messages */
  warnings: Array<{
    type: string;
    message: string;
    suggestedFix: string;
  }>;
  /** Trajectory deviation score */
  trajectoryDeviation: number;
  /** Current vs intent similarity */
  intentAlignment: number;
  /** Suggested corrections */
  corrections: string[];
}

// ============================================================================
// TemporalExpectations Manager
// ============================================================================

export class TemporalExpectationsManager {
  private expectations: Map<string, TemporalExpectations> = new Map();
  private maxRecentEmbeddings = 5; // Rolling window size

  /**
   * Create TemporalExpectations from V-JEPA 2 analysis
   */
  async createExpectations(params: {
    intentLockId: string;
    projectId: string;
    temporalEmbedding: number[];
    frameEmbeddings?: number[][];
    stateTransitions: StateTransition[];
    motionPatterns: MotionPattern[];
    anticipatedActions: AnticipatedAction[];
    physicsContext: string;
    keyMoments?: TemporalExpectations['keyMoments'];
    sourceType: TemporalExpectations['sourceType'];
  }): Promise<TemporalExpectations> {
    const id = `te_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const expectations: TemporalExpectations = {
      id,
      intentLockId: params.intentLockId,
      projectId: params.projectId,
      stateTransitions: params.stateTransitions,
      motionPatterns: params.motionPatterns,
      anticipatedActions: params.anticipatedActions,
      physicsContext: params.physicsContext,
      temporalEmbedding: params.temporalEmbedding,
      frameEmbeddings: params.frameEmbeddings,
      keyMoments: params.keyMoments || [],
      currentStateIndex: 0,
      recentEmbeddings: params.temporalEmbedding ? [params.temporalEmbedding] : [],
      trajectoryDirection: 'stable',
      sourceType: params.sourceType,
      createdAt: new Date(),
      updatedAt: new Date(),
      confidence: this.calculateConfidence(params.temporalEmbedding, params.stateTransitions),
    };

    this.expectations.set(id, expectations);
    return expectations;
  }

  /**
   * Validate a transition against expectations
   */
  async validateTransition(
    expectationsId: string,
    frameSequence: Buffer[]
  ): Promise<TransitionValidationResult> {
    const expectations = this.expectations.get(expectationsId);
    if (!expectations) {
      throw new Error(`TemporalExpectations not found: ${expectationsId}`);
    }

    const provider = getVJEPA2Provider();

    // Get current expected transition
    const currentTransition = expectations.stateTransitions[expectations.currentStateIndex];
    if (!currentTransition) {
      return {
        valid: true,
        score: 1.0,
        smoothness: 1.0,
        timingAccuracy: 1.0,
        visualConsistency: 1.0,
        issues: [],
        suggestions: [],
      };
    }

    // Use V-JEPA 2 to validate the transition
    const frameStrings = frameSequence.map(f => f.toString('base64'));
    const validation = await provider.validateTransition(
      frameStrings,
      `${currentTransition.type} transition from ${currentTransition.from} to ${currentTransition.to}`
    );

    // Update trajectory with new frames
    const { temporalEmbedding } = await provider.embedTemporal(frameStrings);
    this.updateTrajectory(expectationsId, temporalEmbedding);

    const result: TransitionValidationResult = {
      valid: validation.valid,
      score: validation.confidence,
      smoothness: validation.smoothness,
      timingAccuracy: 1.0 - validation.deviationScore,
      visualConsistency: validation.valid ? 0.9 : 0.5,
      issues: validation.issues,
      suggestions: this.generateTransitionSuggestions(validation, currentTransition),
    };

    // Advance state if valid
    if (validation.valid) {
      expectations.currentStateIndex++;
      expectations.updatedAt = new Date();
    }

    return result;
  }

  /**
   * Predict the next expected UI state
   */
  async predictNextState(
    expectationsId: string,
    currentScreenshots: Buffer[],
    codeDescription: string
  ): Promise<NextStatePrediction> {
    const expectations = this.expectations.get(expectationsId);
    if (!expectations) {
      throw new Error(`TemporalExpectations not found: ${expectationsId}`);
    }

    const provider = getVJEPA2Provider();

    // Use V-JEPA 2 to predict next state
    const frameStrings = currentScreenshots.map(f => f.toString('base64'));
    const prediction = await provider.predictState(frameStrings, codeDescription);

    // Update trajectory
    this.updateTrajectory(expectationsId, prediction.currentStateEmbedding);

    // Get expected changes based on state transitions
    const nextTransition = expectations.stateTransitions[expectations.currentStateIndex + 1];
    const expectedChanges = prediction.expectedChanges;
    if (nextTransition) {
      expectedChanges.push(`Transition to: ${nextTransition.to}`);
    }

    return {
      embedding: prediction.predictedStateEmbedding,
      description: `Predicted state after: ${codeDescription.substring(0, 100)}...`,
      expectedChanges,
      confidence: prediction.confidence,
      expectedTimeMs: nextTransition?.durationMs,
    };
  }

  /**
   * Anticipate errors by comparing trajectory to intent
   */
  async anticipateError(
    expectationsId: string,
    currentScreenshots: Buffer[],
    intentLock: VisualIntentLock
  ): Promise<ErrorAnticipationResult> {
    const expectations = this.expectations.get(expectationsId);
    if (!expectations) {
      throw new Error(`TemporalExpectations not found: ${expectationsId}`);
    }

    const provider = getVJEPA2Provider();

    // Use V-JEPA 2 proactive error anticipation
    const frameStrings = currentScreenshots.map(f => f.toString('base64'));
    const anticipation = await provider.anticipateError(frameStrings, {
      embedding: intentLock.embedding,
      semanticDescription: intentLock.what,
      checklist: intentLock.checklist.map(c => c.description),
    });

    // Update trajectory
    const { temporalEmbedding } = await provider.embedTemporal(frameStrings);
    this.updateTrajectory(expectationsId, temporalEmbedding);

    // Determine severity
    let severity: ErrorAnticipationResult['severity'] = 'low';
    if (anticipation.trajectoryDeviation < -0.3) severity = 'critical';
    else if (anticipation.trajectoryDeviation < -0.2) severity = 'high';
    else if (anticipation.trajectoryDeviation < -0.1) severity = 'medium';

    return {
      errorAnticipated: anticipation.errorAnticipated,
      severity,
      warnings: anticipation.warnings.map(w => ({
        type: w.type,
        message: w.message,
        suggestedFix: `Address ${w.type}: ${w.message.substring(0, 50)}...`,
      })),
      trajectoryDeviation: anticipation.trajectoryDeviation,
      intentAlignment: anticipation.currentIntentSimilarity,
      corrections: anticipation.suggestedCorrections,
    };
  }

  /**
   * Update the rolling trajectory window
   */
  private updateTrajectory(expectationsId: string, embedding: number[]): void {
    const expectations = this.expectations.get(expectationsId);
    if (!expectations) return;

    expectations.recentEmbeddings.push(embedding);

    // Keep only the last N embeddings
    if (expectations.recentEmbeddings.length > this.maxRecentEmbeddings) {
      expectations.recentEmbeddings.shift();
    }

    // Calculate trajectory direction
    if (expectations.recentEmbeddings.length >= 2) {
      const trajectory = this.calculateTrajectoryDirection(
        expectations.recentEmbeddings,
        expectations.temporalEmbedding
      );
      expectations.trajectoryDirection = trajectory;
    }

    expectations.updatedAt = new Date();
  }

  /**
   * Calculate trajectory direction relative to intent
   */
  private calculateTrajectoryDirection(
    recentEmbeddings: number[][],
    intentEmbedding: number[]
  ): TemporalExpectations['trajectoryDirection'] {
    if (recentEmbeddings.length < 2) return 'stable';

    const currentSimilarity = this.cosineSimilarity(
      recentEmbeddings[recentEmbeddings.length - 1],
      intentEmbedding
    );

    const previousSimilarity = this.cosineSimilarity(
      recentEmbeddings[recentEmbeddings.length - 2],
      intentEmbedding
    );

    const change = currentSimilarity - previousSimilarity;

    if (change > 0.05) return 'toward_intent';
    if (change < -0.05) return 'away_from_intent';
    return 'stable';
  }

  /**
   * Get expectations by ID
   */
  getExpectations(id: string): TemporalExpectations | undefined {
    return this.expectations.get(id);
  }

  /**
   * Get expectations for a project
   */
  getProjectExpectations(projectId: string): TemporalExpectations[] {
    return Array.from(this.expectations.values())
      .filter(e => e.projectId === projectId);
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  private calculateConfidence(embedding: number[], transitions: StateTransition[]): number {
    let confidence = 0.5;

    // Higher confidence if we have a valid embedding
    if (embedding && embedding.length > 0) {
      const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
      confidence += magnitude * 0.2;
    }

    // Higher confidence if we have defined transitions
    if (transitions.length > 0) {
      const avgTransitionConfidence = transitions.reduce((sum, t) => sum + t.confidence, 0) / transitions.length;
      confidence += avgTransitionConfidence * 0.3;
    }

    return Math.min(1, Math.max(0, confidence));
  }

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
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  private generateTransitionSuggestions(
    validation: TransitionValidation,
    transition: StateTransition
  ): string[] {
    const suggestions: string[] = [];

    if (!validation.valid) {
      if (validation.smoothness < 0.5) {
        suggestions.push(`Add easing function for smoother ${transition.type} transition`);
      }
      if (validation.deviationScore > 0.3) {
        suggestions.push(`Transition from "${transition.from}" to "${transition.to}" deviates significantly from expected`);
      }
      for (const issue of validation.issues) {
        suggestions.push(`Fix: ${issue}`);
      }
    }

    return suggestions;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let managerInstance: TemporalExpectationsManager | null = null;

export function getTemporalExpectationsManager(): TemporalExpectationsManager {
  if (!managerInstance) {
    managerInstance = new TemporalExpectationsManager();
  }
  return managerInstance;
}

export function resetTemporalExpectationsManager(): void {
  managerInstance = null;
}
