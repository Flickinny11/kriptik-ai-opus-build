/**
 * Hallucination Detector
 *
 * Monitors reasoning steps for hallucination indicators using embedding similarity
 * and pattern analysis. Based on "Streaming Hallucination Detection in Long CoT" (Jan 2026).
 *
 * Key insight: Hallucination in long CoT is an evolving latent state, not a one-off error.
 * Uses cumulative prefix-level signals to detect reasoning drift.
 */

import { v4 as uuidv4 } from 'uuid';
import { getEmbeddingService } from '../../embeddings/index.js';
import {
  type HallucinationSignal,
  type HallucinationIndicators,
  type HallucinationDetectorConfig,
  type SuggestedAction,
  type StepAnalysis,
  type ChainAnalysis,
  type StreamingEvent,
  DEFAULT_HALLUCINATION_DETECTOR_CONFIG,
} from './types.js';

// ============================================================================
// Hallucination Detector Class
// ============================================================================

export class HallucinationDetector {
  private config: HallucinationDetectorConfig;
  
  // Analysis state
  private problemEmbedding: number[] | null = null;
  private stepHistory: StepAnalysis[] = [];
  private embeddingCache: Map<string, number[]> = new Map();
  private sessionId: string = '';

  constructor(config: Partial<HallucinationDetectorConfig> = {}) {
    this.config = { ...DEFAULT_HALLUCINATION_DETECTOR_CONFIG, ...config };
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize detector for a new reasoning chain
   */
  async initialize(problemContext: string, sessionId: string): Promise<void> {
    this.sessionId = sessionId;
    this.stepHistory = [];
    this.embeddingCache.clear();

    // Generate problem embedding
    if (this.config.useEmbeddings) {
      const embeddingService = getEmbeddingService();
      const result = await embeddingService.embed({
        content: problemContext,
        type: 'reasoning',
      });
      this.problemEmbedding = result.embeddings[0];
    }
  }

  // ==========================================================================
  // Step Analysis
  // ==========================================================================

  /**
   * Analyze a reasoning step for hallucination indicators
   */
  async analyzeStep(
    stepId: string,
    content: string,
    confidence: number,
    tokensUsed: number
  ): Promise<HallucinationSignal> {
    if (!this.config.enabled) {
      return this.createSafeSignal(stepId);
    }

    // Generate embedding for this step
    let stepEmbedding: number[] | undefined;
    if (this.config.useEmbeddings) {
      stepEmbedding = await this.getOrCreateEmbedding(stepId, content);
    }

    // Calculate indicators
    const indicators = await this.calculateIndicators(
      stepId,
      content,
      stepEmbedding,
      confidence
    );

    // Calculate overall score (weighted average of indicators)
    const score = this.calculateOverallScore(indicators);

    // Store step analysis
    const analysis: StepAnalysis = {
      stepId,
      content,
      embedding: stepEmbedding,
      problemSimilarity: 1 - indicators.semanticDrift,
      previousStepSimilarity: this.stepHistory.length > 0
        ? 1 - indicators.logicalContradiction
        : undefined,
      confidence,
      tokensUsed,
      analyzedAt: new Date().toISOString(),
    };
    this.stepHistory.push(analysis);

    // Determine action
    const { shouldPause, suggestedAction } = this.determineAction(score, indicators);

    // Create signal
    const signal: HallucinationSignal = {
      stepId,
      score,
      indicators,
      shouldPause,
      suggestedAction,
      timestamp: new Date().toISOString(),
      explanation: this.generateExplanation(indicators, score),
    };

    return signal;
  }

  /**
   * Calculate hallucination indicators for a step
   */
  private async calculateIndicators(
    stepId: string,
    content: string,
    embedding: number[] | undefined,
    confidence: number
  ): Promise<HallucinationIndicators> {
    const embeddingService = getEmbeddingService();
    const indicators: HallucinationIndicators = {
      semanticDrift: 0,
      factualInconsistency: 0,
      logicalContradiction: 0,
      confidenceDrop: 0,
      repetition: 0,
      patternDeviation: 0,
    };

    // Semantic drift from problem
    if (embedding && this.problemEmbedding) {
      const similarity = embeddingService.similarity(embedding, this.problemEmbedding);
      indicators.semanticDrift = 1 - similarity.similarity;
    }

    // Logical contradiction with previous step
    if (embedding && this.stepHistory.length > 0) {
      const prevStep = this.stepHistory[this.stepHistory.length - 1];
      if (prevStep.embedding) {
        const similarity = embeddingService.similarity(embedding, prevStep.embedding);
        // Low similarity to previous step could indicate contradiction
        // But too high similarity could indicate repetition
        if (similarity.similarity < 0.3) {
          indicators.logicalContradiction = 1 - similarity.similarity * 2;
        }
      }
    }

    // Confidence drop
    if (this.stepHistory.length > 0) {
      const prevConfidence = this.stepHistory[this.stepHistory.length - 1].confidence;
      const drop = prevConfidence - confidence;
      indicators.confidenceDrop = Math.max(0, drop);
    }

    // Repetition detection
    indicators.repetition = this.detectRepetition(content);

    // Pattern deviation
    if (this.config.usePatterns) {
      indicators.patternDeviation = this.detectPatternDeviation(content);
    }

    // Factual inconsistency (inferred from multiple signals)
    indicators.factualInconsistency = this.inferFactualInconsistency(indicators, confidence);

    return indicators;
  }

  /**
   * Detect repetition in content
   */
  private detectRepetition(content: string): number {
    if (this.stepHistory.length === 0) return 0;

    const contentLower = content.toLowerCase();
    let maxSimilarity = 0;

    // Check against recent steps
    const recentSteps = this.stepHistory.slice(-this.config.driftWindowSize);
    for (const step of recentSteps) {
      const stepLower = step.content.toLowerCase();
      
      // Simple character-level overlap check
      const overlap = this.calculateTextOverlap(contentLower, stepLower);
      maxSimilarity = Math.max(maxSimilarity, overlap);
    }

    return maxSimilarity;
  }

  /**
   * Calculate text overlap ratio
   */
  private calculateTextOverlap(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 3));
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    let overlap = 0;
    for (const word of words1) {
      if (words2.has(word)) overlap++;
    }
    
    return overlap / Math.max(words1.size, words2.size);
  }

  /**
   * Detect pattern deviation (hedging, uncertainty markers)
   */
  private detectPatternDeviation(content: string): number {
    const hedgingPatterns = [
      /\bi think\b/i,
      /\bperhaps\b/i,
      /\bmaybe\b/i,
      /\bpossibly\b/i,
      /\bi'm not sure\b/i,
      /\buncertain\b/i,
      /\bguess\b/i,
      /\bassume\b/i,
      /\bprobably\b/i,
      /\bmight\b/i,
      /\bcould be\b/i,
    ];

    const contradictionPatterns = [
      /\bactually\b.*\bbut\b/i,
      /\bwait\b.*\bno\b/i,
      /\bsorry\b.*\bwrong\b/i,
      /\bI mean\b/i,
      /\blet me correct\b/i,
    ];

    let score = 0;
    let patternCount = 0;

    for (const pattern of hedgingPatterns) {
      if (pattern.test(content)) {
        score += 0.1;
        patternCount++;
      }
    }

    for (const pattern of contradictionPatterns) {
      if (pattern.test(content)) {
        score += 0.2;
        patternCount++;
      }
    }

    return Math.min(1, score);
  }

  /**
   * Infer factual inconsistency from other indicators
   */
  private inferFactualInconsistency(
    indicators: Partial<HallucinationIndicators>,
    confidence: number
  ): number {
    // Low confidence + high pattern deviation suggests factual issues
    const baseScore = (1 - confidence) * 0.3;
    const patternBonus = (indicators.patternDeviation || 0) * 0.3;
    const driftBonus = (indicators.semanticDrift || 0) * 0.2;
    const repetitionBonus = (indicators.repetition || 0) * 0.2;

    return Math.min(1, baseScore + patternBonus + driftBonus + repetitionBonus);
  }

  /**
   * Calculate overall hallucination score
   */
  private calculateOverallScore(indicators: HallucinationIndicators): number {
    // Weighted average of indicators
    const weights = {
      semanticDrift: 0.25,
      factualInconsistency: 0.20,
      logicalContradiction: 0.20,
      confidenceDrop: 0.15,
      repetition: 0.10,
      patternDeviation: 0.10,
    };

    let score = 0;
    for (const [key, weight] of Object.entries(weights)) {
      score += indicators[key as keyof HallucinationIndicators] * weight;
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Determine action based on score
   */
  private determineAction(
    score: number,
    indicators: HallucinationIndicators
  ): { shouldPause: boolean; suggestedAction: SuggestedAction } {
    // Critical: terminate
    if (score >= this.config.terminateThreshold) {
      return { shouldPause: true, suggestedAction: 'terminate' };
    }

    // High score: pause for review
    if (score >= this.config.pauseThreshold) {
      return { shouldPause: true, suggestedAction: 'pause_for_review' };
    }

    // Moderate: verify or backtrack
    if (score >= 0.4) {
      if (indicators.semanticDrift > this.config.semanticDriftThreshold) {
        return { shouldPause: false, suggestedAction: 'reframe' };
      }
      if (indicators.logicalContradiction > this.config.logicalContradictionThreshold) {
        return { shouldPause: false, suggestedAction: 'backtrack' };
      }
      return { shouldPause: false, suggestedAction: 'verify' };
    }

    // Low score: continue
    return { shouldPause: false, suggestedAction: 'continue' };
  }

  /**
   * Generate human-readable explanation
   */
  private generateExplanation(indicators: HallucinationIndicators, score: number): string {
    const issues: string[] = [];

    if (indicators.semanticDrift > this.config.semanticDriftThreshold) {
      issues.push(`semantic drift detected (${(indicators.semanticDrift * 100).toFixed(1)}%)`);
    }
    if (indicators.logicalContradiction > this.config.logicalContradictionThreshold) {
      issues.push(`logical contradiction (${(indicators.logicalContradiction * 100).toFixed(1)}%)`);
    }
    if (indicators.confidenceDrop > this.config.confidenceDropThreshold) {
      issues.push(`confidence drop (${(indicators.confidenceDrop * 100).toFixed(1)}%)`);
    }
    if (indicators.repetition > this.config.repetitionThreshold) {
      issues.push(`repetition detected (${(indicators.repetition * 100).toFixed(1)}%)`);
    }

    if (issues.length === 0) {
      return `Step appears coherent (score: ${(score * 100).toFixed(1)}%)`;
    }

    return `Potential issues: ${issues.join(', ')}. Overall score: ${(score * 100).toFixed(1)}%`;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Get or create embedding for content
   */
  private async getOrCreateEmbedding(id: string, content: string): Promise<number[]> {
    if (this.config.cacheEmbeddings) {
      const cached = this.embeddingCache.get(id);
      if (cached) return cached;
    }

    const embeddingService = getEmbeddingService();
    const result = await embeddingService.embed({
      content,
      type: 'reasoning',
    });
    const embedding = result.embeddings[0];

    if (this.config.cacheEmbeddings) {
      this.embeddingCache.set(id, embedding);
    }

    return embedding;
  }

  /**
   * Create a safe (no hallucination) signal
   */
  private createSafeSignal(stepId: string): HallucinationSignal {
    return {
      stepId,
      score: 0,
      indicators: {
        semanticDrift: 0,
        factualInconsistency: 0,
        logicalContradiction: 0,
        confidenceDrop: 0,
        repetition: 0,
        patternDeviation: 0,
      },
      shouldPause: false,
      suggestedAction: 'continue',
      timestamp: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // Chain Analysis
  // ==========================================================================

  /**
   * Get full chain analysis
   */
  getChainAnalysis(): ChainAnalysis {
    const relevanceProgression = this.stepHistory.map(s => s.problemSimilarity);
    const confidenceProgression = this.stepHistory.map(s => s.confidence);

    // Calculate coherence score (average similarity between adjacent steps)
    let coherenceSum = 0;
    let coherenceCount = 0;
    for (let i = 1; i < this.stepHistory.length; i++) {
      if (this.stepHistory[i].previousStepSimilarity !== undefined) {
        coherenceSum += this.stepHistory[i].previousStepSimilarity!;
        coherenceCount++;
      }
    }
    const coherenceScore = coherenceCount > 0 ? coherenceSum / coherenceCount : 1;

    // Calculate progression score (are we making progress?)
    const progressionScore = this.calculateProgressionScore();

    // Detect drift points
    const driftPoints = this.stepHistory
      .filter(s => s.problemSimilarity < (1 - this.config.semanticDriftThreshold))
      .map(s => s.stepId);

    return {
      sessionId: this.sessionId,
      steps: this.stepHistory,
      coherenceScore,
      progressionScore,
      relevanceProgression,
      confidenceProgression,
      driftPoints,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate progression score
   */
  private calculateProgressionScore(): number {
    if (this.stepHistory.length < 2) return 1;

    // Check if relevance is improving or staying stable
    const relevant = this.stepHistory.map(s => s.problemSimilarity);
    let improvementCount = 0;
    let totalComparisons = 0;

    for (let i = 1; i < relevant.length; i++) {
      if (relevant[i] >= relevant[i - 1] - 0.05) {
        improvementCount++;
      }
      totalComparisons++;
    }

    return totalComparisons > 0 ? improvementCount / totalComparisons : 1;
  }

  // ==========================================================================
  // Streaming Monitor
  // ==========================================================================

  /**
   * Wrap a stream with hallucination monitoring
   */
  async *monitor<T extends StreamingEvent>(
    stream: AsyncGenerator<T>,
    extractContent: (event: T) => { stepId?: string; content?: string; confidence?: number; tokensUsed?: number } | null
  ): AsyncGenerator<T | StreamingEvent> {
    for await (const event of stream) {
      // Yield original event
      yield event;

      // Extract relevant data
      const data = extractContent(event);
      if (!data || !data.stepId || !data.content) continue;

      // Analyze for hallucination
      const signal = await this.analyzeStep(
        data.stepId,
        data.content,
        data.confidence || 0.5,
        data.tokensUsed || 0
      );

      // Yield warning if needed
      if (signal.score > 0.3) {
        const warningEvent: StreamingEvent = {
          type: 'hallucination_warning',
          content: signal.explanation || 'Potential hallucination detected',
          metadata: {
            stepId: signal.stepId,
            hallucinationScore: signal.score,
            custom: {
              signal,
            },
          },
          timestamp: signal.timestamp,
        };
        yield warningEvent;
      }

      // Pause if needed
      if (signal.shouldPause) {
        const pauseEvent: StreamingEvent = {
          type: 'pause',
          content: `Reasoning paused: ${signal.suggestedAction}`,
          metadata: {
            stepId: signal.stepId,
            custom: {
              suggestedAction: signal.suggestedAction,
              signal,
            },
          },
          timestamp: new Date().toISOString(),
        };
        yield pauseEvent;
      }
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Reset detector state
   */
  reset(): void {
    this.problemEmbedding = null;
    this.stepHistory = [];
    this.embeddingCache.clear();
    this.sessionId = '';
  }

  /**
   * Get step history
   */
  getStepHistory(): StepAnalysis[] {
    return [...this.stepHistory];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HallucinationDetectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): HallucinationDetectorConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let detectorInstance: HallucinationDetector | null = null;

export function getHallucinationDetector(): HallucinationDetector {
  if (!detectorInstance) {
    detectorInstance = new HallucinationDetector();
  }
  return detectorInstance;
}

export function resetHallucinationDetector(): void {
  if (detectorInstance) {
    detectorInstance.reset();
  }
  detectorInstance = null;
}

export function createHallucinationDetector(
  config?: Partial<HallucinationDetectorConfig>
): HallucinationDetector {
  return new HallucinationDetector(config);
}

export default HallucinationDetector;
