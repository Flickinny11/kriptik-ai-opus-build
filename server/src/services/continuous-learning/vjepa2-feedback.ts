/**
 * V-JEPA 2 Feedback Loop
 *
 * Integrates V-JEPA 2 temporal understanding services into the continuous
 * learning system. Tracks prediction accuracy, error anticipation success,
 * and temporal pattern learning to improve the system over time.
 *
 * Key capabilities:
 * - Track state prediction accuracy over time
 * - Learn which error anticipations were accurate
 * - Improve temporal pattern recognition
 * - Correlate visual understanding with build outcomes
 * - Feed back verification results for continuous improvement
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

/**
 * Temporal feedback data from a build/session
 */
export interface TemporalFeedbackData {
  /** Unique session/build identifier */
  sessionId: string;
  /** Project identifier */
  projectId: string;

  // Prediction metrics
  predictions: {
    /** Total state predictions made */
    statePredictons: number;
    /** Predictions that matched actual outcomes */
    accuratePredictions: number;
    /** Average prediction confidence */
    avgConfidence: number;
  };

  // Error anticipation metrics
  errorAnticipation: {
    /** Errors that were correctly anticipated */
    anticipatedErrors: number;
    /** Errors that occurred but weren't anticipated */
    missedErrors: number;
    /** False positives (anticipated but didn't occur) */
    falsePositives: number;
  };

  // Verification metrics
  verification: {
    /** Visual semantic verification score */
    visualScore: number;
    /** Temporal state verification score */
    temporalScore: number;
    /** Backend verification score */
    backendScore: number;
  };

  // Outcome
  outcome: 'success' | 'failure' | 'partial';
  userSatisfaction?: 'positive' | 'negative' | 'neutral';

  // Timing
  timestamp: Date;
  durationMs: number;
}

/**
 * Learned temporal pattern
 */
export interface TemporalPattern {
  id: string;
  /** Pattern type */
  type: 'transition' | 'animation' | 'state_change' | 'error_sequence';
  /** Description of the pattern */
  description: string;
  /** Temporal embedding (1024-dim) */
  embedding: number[];
  /** Success rate when this pattern is detected */
  successRate: number;
  /** Average prediction accuracy for this pattern */
  predictionAccuracy: number;
  /** Number of times observed */
  observations: number;
  /** Last updated */
  lastUpdated: Date;
}

/**
 * Prediction improvement metrics
 */
export interface PredictionImprovement {
  /** Overall accuracy improvement (percentage points) */
  accuracyImprovement: number;
  /** Error anticipation improvement */
  anticipationImprovement: number;
  /** Confidence calibration (how well confidence matches accuracy) */
  confidenceCalibration: number;
  /** Period this improvement covers */
  periodDays: number;
  /** Sample size */
  sampleSize: number;
}

/**
 * Optimized temporal configuration
 */
export interface OptimizedTemporalConfig {
  /** Optimal prediction horizon (ms) */
  predictionHorizon: number;
  /** Optimal frame sampling rate */
  frameSamplingRate: number;
  /** Sensitivity threshold for anomaly detection */
  anomalySensitivity: 'low' | 'medium' | 'high';
  /** Whether to enable aggressive error anticipation */
  aggressiveAnticipation: boolean;
  /** Expected prediction accuracy */
  expectedAccuracy: number;
  /** Confidence in this config */
  confidence: number;
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  /** Maximum patterns to store */
  maxPatterns: 3000,
  /** Minimum observations for confident prediction */
  minObservationsForPrediction: 5,
  /** Similarity threshold for pattern matching */
  similarityThreshold: 0.75,
  /** Weight for exponential moving average */
  emaWeight: 0.25,
  /** Days of history to keep */
  historyDays: 30,
};

// ============================================================================
// V-JEPA 2 Feedback Loop
// ============================================================================

let instance: VJEPA2FeedbackLoop | null = null;

export class VJEPA2FeedbackLoop extends EventEmitter {
  private patterns: Map<string, TemporalPattern> = new Map();
  private feedbackHistory: TemporalFeedbackData[] = [];
  private projectStats: Map<
    string,
    {
      totalSessions: number;
      successfulSessions: number;
      avgPredictionAccuracy: number;
      avgErrorAnticipation: number;
      lastUpdated: Date;
    }
  > = new Map();

  constructor() {
    super();
    console.log('[VJEPA2FeedbackLoop] Initialized');
  }

  /**
   * Record feedback from a temporal analysis session
   */
  recordFeedback(data: TemporalFeedbackData): void {
    // Add to history
    this.feedbackHistory.push(data);

    // Prune old history
    const cutoff = Date.now() - CONFIG.historyDays * 24 * 60 * 60 * 1000;
    this.feedbackHistory = this.feedbackHistory.filter(
      (f) => f.timestamp.getTime() > cutoff
    );

    // Update project stats
    this.updateProjectStats(data);

    // Emit event
    this.emit('feedback:recorded', data);

    console.log(
      `[VJEPA2FeedbackLoop] Recorded feedback for session ${data.sessionId}: ` +
        `accuracy ${((data.predictions.accuratePredictions / Math.max(1, data.predictions.statePredictons)) * 100).toFixed(1)}%`
    );
  }

  /**
   * Update project-level statistics
   */
  private updateProjectStats(data: TemporalFeedbackData): void {
    const existing = this.projectStats.get(data.projectId);

    const predictionAccuracy =
      data.predictions.statePredictons > 0
        ? data.predictions.accuratePredictions / data.predictions.statePredictons
        : 0;

    const anticipationAccuracy =
      data.errorAnticipation.anticipatedErrors +
        data.errorAnticipation.missedErrors >
      0
        ? data.errorAnticipation.anticipatedErrors /
          (data.errorAnticipation.anticipatedErrors +
            data.errorAnticipation.missedErrors)
        : 0;

    if (existing) {
      // Update with EMA
      existing.totalSessions++;
      if (data.outcome === 'success') existing.successfulSessions++;
      existing.avgPredictionAccuracy =
        existing.avgPredictionAccuracy * (1 - CONFIG.emaWeight) +
        predictionAccuracy * CONFIG.emaWeight;
      existing.avgErrorAnticipation =
        existing.avgErrorAnticipation * (1 - CONFIG.emaWeight) +
        anticipationAccuracy * CONFIG.emaWeight;
      existing.lastUpdated = new Date();
    } else {
      this.projectStats.set(data.projectId, {
        totalSessions: 1,
        successfulSessions: data.outcome === 'success' ? 1 : 0,
        avgPredictionAccuracy: predictionAccuracy,
        avgErrorAnticipation: anticipationAccuracy,
        lastUpdated: new Date(),
      });
    }
  }

  /**
   * Learn a temporal pattern from observed data
   */
  learnPattern(
    type: TemporalPattern['type'],
    description: string,
    embedding: number[],
    wasSuccessful: boolean,
    predictionAccuracy: number
  ): string {
    // Check for similar existing pattern
    let matchedPattern: TemporalPattern | null = null;

    for (const pattern of this.patterns.values()) {
      if (pattern.type === type) {
        const similarity = this.cosineSimilarity(embedding, pattern.embedding);
        if (similarity >= CONFIG.similarityThreshold) {
          matchedPattern = pattern;
          break;
        }
      }
    }

    if (matchedPattern) {
      // Update existing pattern
      matchedPattern.observations++;
      matchedPattern.successRate =
        matchedPattern.successRate * (1 - CONFIG.emaWeight) +
        (wasSuccessful ? 1 : 0) * CONFIG.emaWeight;
      matchedPattern.predictionAccuracy =
        matchedPattern.predictionAccuracy * (1 - CONFIG.emaWeight) +
        predictionAccuracy * CONFIG.emaWeight;
      matchedPattern.lastUpdated = new Date();

      // Update embedding with EMA
      for (let i = 0; i < embedding.length; i++) {
        matchedPattern.embedding[i] =
          matchedPattern.embedding[i] * (1 - CONFIG.emaWeight) +
          embedding[i] * CONFIG.emaWeight;
      }

      console.log(
        `[VJEPA2FeedbackLoop] Updated pattern ${matchedPattern.id}: ` +
          `${matchedPattern.observations} observations, ${(matchedPattern.successRate * 100).toFixed(1)}% success`
      );

      return matchedPattern.id;
    } else {
      // Create new pattern
      const patternId = `pattern_${type}_${Date.now()}`;
      const newPattern: TemporalPattern = {
        id: patternId,
        type,
        description,
        embedding: [...embedding],
        successRate: wasSuccessful ? 1 : 0,
        predictionAccuracy,
        observations: 1,
        lastUpdated: new Date(),
      };

      this.patterns.set(patternId, newPattern);

      // Prune if over limit
      if (this.patterns.size > CONFIG.maxPatterns) {
        this.pruneOldestPatterns();
      }

      console.log(`[VJEPA2FeedbackLoop] Learned new pattern ${patternId}`);

      return patternId;
    }
  }

  /**
   * Find similar patterns for prediction
   */
  findSimilarPatterns(
    embedding: number[],
    type?: TemporalPattern['type']
  ): Array<{ pattern: TemporalPattern; similarity: number }> {
    const results: Array<{ pattern: TemporalPattern; similarity: number }> = [];

    for (const pattern of this.patterns.values()) {
      if (type && pattern.type !== type) continue;

      const similarity = this.cosineSimilarity(embedding, pattern.embedding);
      if (similarity >= CONFIG.similarityThreshold) {
        results.push({ pattern, similarity });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Get optimized temporal configuration based on learned patterns
   */
  getOptimizedConfig(projectId: string): OptimizedTemporalConfig {
    const stats = this.projectStats.get(projectId);

    // Default config
    const config: OptimizedTemporalConfig = {
      predictionHorizon: 5000,
      frameSamplingRate: 1000,
      anomalySensitivity: 'medium',
      aggressiveAnticipation: false,
      expectedAccuracy: 0.7,
      confidence: 0.5,
    };

    if (!stats || stats.totalSessions < CONFIG.minObservationsForPrediction) {
      return config;
    }

    // Adjust based on learned statistics
    config.confidence = Math.min(
      0.95,
      0.5 + stats.totalSessions * 0.01
    );

    // If prediction accuracy is high, we can use shorter horizon
    if (stats.avgPredictionAccuracy > 0.8) {
      config.predictionHorizon = 3000;
      config.frameSamplingRate = 500;
    } else if (stats.avgPredictionAccuracy < 0.5) {
      config.predictionHorizon = 7000;
      config.frameSamplingRate = 2000;
    }

    // If error anticipation is good, enable aggressive mode
    if (stats.avgErrorAnticipation > 0.7) {
      config.aggressiveAnticipation = true;
      config.anomalySensitivity = 'high';
    } else if (stats.avgErrorAnticipation < 0.3) {
      config.anomalySensitivity = 'low';
    }

    config.expectedAccuracy = stats.avgPredictionAccuracy;

    return config;
  }

  /**
   * Get prediction improvement metrics
   */
  getPredictionImprovement(projectId?: string): PredictionImprovement {
    let relevantFeedback = this.feedbackHistory;

    if (projectId) {
      relevantFeedback = relevantFeedback.filter(
        (f) => f.projectId === projectId
      );
    }

    if (relevantFeedback.length < 10) {
      return {
        accuracyImprovement: 0,
        anticipationImprovement: 0,
        confidenceCalibration: 0,
        periodDays: CONFIG.historyDays,
        sampleSize: relevantFeedback.length,
      };
    }

    // Sort by timestamp
    relevantFeedback.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Compare first half to second half
    const midpoint = Math.floor(relevantFeedback.length / 2);
    const firstHalf = relevantFeedback.slice(0, midpoint);
    const secondHalf = relevantFeedback.slice(midpoint);

    const firstHalfAccuracy =
      firstHalf.reduce((sum, f) => {
        return (
          sum +
          (f.predictions.statePredictons > 0
            ? f.predictions.accuratePredictions / f.predictions.statePredictons
            : 0)
        );
      }, 0) / firstHalf.length;

    const secondHalfAccuracy =
      secondHalf.reduce((sum, f) => {
        return (
          sum +
          (f.predictions.statePredictons > 0
            ? f.predictions.accuratePredictions / f.predictions.statePredictons
            : 0)
        );
      }, 0) / secondHalf.length;

    const firstHalfAnticipation =
      firstHalf.reduce((sum, f) => {
        const total =
          f.errorAnticipation.anticipatedErrors +
          f.errorAnticipation.missedErrors;
        return (
          sum + (total > 0 ? f.errorAnticipation.anticipatedErrors / total : 0)
        );
      }, 0) / firstHalf.length;

    const secondHalfAnticipation =
      secondHalf.reduce((sum, f) => {
        const total =
          f.errorAnticipation.anticipatedErrors +
          f.errorAnticipation.missedErrors;
        return (
          sum + (total > 0 ? f.errorAnticipation.anticipatedErrors / total : 0)
        );
      }, 0) / secondHalf.length;

    // Calculate confidence calibration
    const confidenceCalibration = this.calculateConfidenceCalibration(
      relevantFeedback
    );

    return {
      accuracyImprovement: (secondHalfAccuracy - firstHalfAccuracy) * 100,
      anticipationImprovement:
        (secondHalfAnticipation - firstHalfAnticipation) * 100,
      confidenceCalibration,
      periodDays: Math.ceil(
        (Date.now() - relevantFeedback[0].timestamp.getTime()) /
          (24 * 60 * 60 * 1000)
      ),
      sampleSize: relevantFeedback.length,
    };
  }

  /**
   * Calculate how well confidence scores match actual accuracy
   */
  private calculateConfidenceCalibration(
    feedback: TemporalFeedbackData[]
  ): number {
    if (feedback.length === 0) return 0;

    let totalError = 0;

    for (const f of feedback) {
      if (f.predictions.statePredictons > 0) {
        const actualAccuracy =
          f.predictions.accuratePredictions / f.predictions.statePredictons;
        const error = Math.abs(f.predictions.avgConfidence - actualAccuracy);
        totalError += error;
      }
    }

    // Return calibration score (higher is better)
    return Math.max(0, 100 - (totalError / feedback.length) * 100);
  }

  /**
   * Get project statistics
   */
  getProjectStats(projectId: string): {
    totalSessions: number;
    successfulSessions: number;
    avgPredictionAccuracy: number;
    avgErrorAnticipation: number;
  } | null {
    return this.projectStats.get(projectId) || null;
  }

  /**
   * Get overall system statistics
   */
  getOverallStats(): {
    totalProjects: number;
    totalSessions: number;
    totalPatterns: number;
    avgAccuracy: number;
    avgAnticipation: number;
  } {
    let totalSessions = 0;
    let totalAccuracy = 0;
    let totalAnticipation = 0;

    for (const stats of this.projectStats.values()) {
      totalSessions += stats.totalSessions;
      totalAccuracy += stats.avgPredictionAccuracy * stats.totalSessions;
      totalAnticipation += stats.avgErrorAnticipation * stats.totalSessions;
    }

    return {
      totalProjects: this.projectStats.size,
      totalSessions,
      totalPatterns: this.patterns.size,
      avgAccuracy: totalSessions > 0 ? totalAccuracy / totalSessions : 0,
      avgAnticipation: totalSessions > 0 ? totalAnticipation / totalSessions : 0,
    };
  }

  /**
   * Prune oldest patterns when over limit
   */
  private pruneOldestPatterns(): void {
    const patterns = Array.from(this.patterns.entries()).sort(
      (a, b) => a[1].lastUpdated.getTime() - b[1].lastUpdated.getTime()
    );

    const toRemove = patterns.slice(0, Math.floor(CONFIG.maxPatterns * 0.1));
    for (const [id] of toRemove) {
      this.patterns.delete(id);
    }

    console.log(`[VJEPA2FeedbackLoop] Pruned ${toRemove.length} old patterns`);
  }

  /**
   * Cosine similarity between embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dot = 0,
      normA = 0,
      normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  /**
   * Export learned patterns for persistence
   */
  exportPatterns(): TemporalPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Import patterns from persistence
   */
  importPatterns(patterns: TemporalPattern[]): void {
    for (const pattern of patterns) {
      this.patterns.set(pattern.id, pattern);
    }
    console.log(`[VJEPA2FeedbackLoop] Imported ${patterns.length} patterns`);
  }
}

// Singleton accessor
export function getVJEPA2FeedbackLoop(): VJEPA2FeedbackLoop {
  if (!instance) {
    instance = new VJEPA2FeedbackLoop();
  }
  return instance;
}

export function createVJEPA2FeedbackLoop(): VJEPA2FeedbackLoop {
  return new VJEPA2FeedbackLoop();
}

export function resetVJEPA2FeedbackLoop(): void {
  instance = null;
}
