/**
 * Auto-Correction Engine
 *
 * Automatically responds to hallucination warnings with corrective actions.
 * Supports regeneration, reframing, backtracking, and verification strategies.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  type AutoCorrectionConfig,
  type CorrectionAttempt,
  type CorrectionResult,
  type CorrectionStrategy,
  type HallucinationSignal,
  type StreamingEvent,
  DEFAULT_AUTO_CORRECTION_CONFIG,
} from './types.js';
import {
  HallucinationDetector,
  createHallucinationDetector,
} from './hallucination-detector.js';
import { getArtifactStorage } from '../artifacts/storage.js';
import { getProvider } from '../providers/index.js';
import { HYPER_THINKING_MODELS } from '../model-router.js';

// ============================================================================
// Auto-Correction Engine Class
// ============================================================================

export class AutoCorrectionEngine {
  private config: AutoCorrectionConfig;
  private hallucinationDetector: HallucinationDetector;
  
  // Correction state
  private correctionHistory: Map<string, CorrectionAttempt[]> = new Map();
  private activeCorrections: Map<string, string> = new Map(); // stepId -> correctionId

  constructor(config: Partial<AutoCorrectionConfig> = {}) {
    this.config = { ...DEFAULT_AUTO_CORRECTION_CONFIG, ...config };
    this.hallucinationDetector = createHallucinationDetector();
  }

  // ==========================================================================
  // Correction Execution
  // ==========================================================================

  /**
   * Attempt to correct a step based on hallucination signal
   */
  async correctStep(
    signal: HallucinationSignal,
    originalContent: string,
    context: CorrectionContext
  ): Promise<CorrectionResult> {
    if (!this.config.enabled) {
      return this.createSkippedResult();
    }

    const startTime = Date.now();
    const attempts: CorrectionAttempt[] = [];
    let success = false;
    let finalContent: string | undefined;
    let finalScore: number | undefined;
    let backtracked = false;
    let backtrackSteps = 0;

    // Select correction strategy based on signal
    const strategy = this.selectStrategy(signal);

    // Attempt corrections up to max attempts
    for (let attempt = 1; attempt <= this.config.maxAttempts && !success; attempt++) {
      const correctionAttempt = await this.executeCorrection(
        signal.stepId,
        originalContent,
        strategy,
        context,
        attempt,
        signal
      );

      attempts.push(correctionAttempt);

      // Check if improvement is sufficient
      if (
        correctionAttempt.success &&
        correctionAttempt.improvement >= this.config.minImprovementRequired
      ) {
        success = true;
        finalContent = correctionAttempt.correctedContent;
        finalScore = correctionAttempt.newScore;
      }

      // If not improving, try backtracking
      if (!success && attempt >= 2 && this.config.enableBacktrack && !backtracked) {
        const backtrackResult = await this.attemptBacktrack(
          signal.stepId,
          context,
          this.config.maxBacktrackSteps
        );

        if (backtrackResult.success) {
          backtracked = true;
          backtrackSteps = backtrackResult.stepsBacktracked;
          // Retry with backtracked context
          context = backtrackResult.newContext;
        }
      }
    }

    // Store attempt history
    this.correctionHistory.set(signal.stepId, attempts);

    // Log for learning system if enabled
    if (this.config.logForLearning) {
      await this.logCorrectionForLearning(signal, attempts, success);
    }

    return {
      success,
      attempts: attempts.length,
      attemptHistory: attempts,
      finalContent,
      finalScore,
      backtracked,
      backtrackSteps,
      totalTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Execute a single correction attempt
   */
  private async executeCorrection(
    stepId: string,
    originalContent: string,
    strategy: CorrectionStrategy,
    context: CorrectionContext,
    attemptNumber: number,
    signal: HallucinationSignal
  ): Promise<CorrectionAttempt> {
    const correctionId = uuidv4();
    this.activeCorrections.set(stepId, correctionId);

    try {
      let correctedContent: string;

      switch (strategy) {
        case 'regenerate':
          correctedContent = await this.regenerateStep(context, signal);
          break;
        case 'reframe':
          correctedContent = await this.reframeStep(originalContent, context, signal);
          break;
        case 'decompose':
          correctedContent = await this.decomposeStep(originalContent, context, signal);
          break;
        case 'verify_then_fix':
          correctedContent = await this.verifyAndFix(originalContent, context, signal);
          break;
        case 'backtrack':
          // Backtrack is handled separately
          correctedContent = originalContent;
          break;
        default:
          correctedContent = originalContent;
      }

      // Analyze corrected content
      const newSignal = await this.hallucinationDetector.analyzeStep(
        `${stepId}_correction_${attemptNumber}`,
        correctedContent,
        0.7, // Assume moderate confidence for corrections
        0
      );

      const improvement = signal.score - newSignal.score;
      const success = newSignal.score < this.config.triggerThreshold;

      return {
        id: correctionId,
        stepId,
        attemptNumber,
        originalContent,
        correctedContent,
        originalScore: signal.score,
        newScore: newSignal.score,
        improvement,
        success,
        strategy,
        timestamp: new Date().toISOString(),
      };
    } finally {
      this.activeCorrections.delete(stepId);
    }
  }

  // ==========================================================================
  // Correction Strategies
  // ==========================================================================

  /**
   * Select best strategy based on signal indicators
   */
  private selectStrategy(signal: HallucinationSignal): CorrectionStrategy {
    const { indicators } = signal;

    // High semantic drift → reframe
    if (indicators.semanticDrift > 0.5) {
      return 'reframe';
    }

    // Logical contradiction → backtrack
    if (indicators.logicalContradiction > 0.5) {
      return 'backtrack';
    }

    // High repetition → regenerate with different approach
    if (indicators.repetition > 0.6) {
      return 'regenerate';
    }

    // Complex issues → decompose
    if (signal.score > 0.7) {
      return 'decompose';
    }

    // Moderate issues → verify then fix
    if (signal.score > 0.4) {
      return 'verify_then_fix';
    }

    // Default → regenerate
    return 'regenerate';
  }

  /**
   * Regenerate step with fresh approach
   */
  private async regenerateStep(
    context: CorrectionContext,
    signal: HallucinationSignal
  ): Promise<string> {
    const prompt = `
The previous reasoning step had issues (hallucination score: ${(signal.score * 100).toFixed(1)}%).
Issues detected: ${this.formatIndicators(signal.indicators)}

Please regenerate this reasoning step with improved clarity and accuracy.

Problem context: ${context.problemContext}
Previous steps: ${context.previousSteps.slice(-3).join('\n---\n')}

Generate a clear, accurate reasoning step that:
1. Stays focused on the original problem
2. Builds logically on previous steps
3. Avoids repetition and hedging language
4. Maintains high confidence in assertions
`;

    const result = await this.callModel(prompt, context.modelTier || 'standard');
    return result;
  }

  /**
   * Reframe step with different perspective
   */
  private async reframeStep(
    originalContent: string,
    context: CorrectionContext,
    signal: HallucinationSignal
  ): Promise<string> {
    const prompt = `
The following reasoning step has drifted from the original problem (semantic drift: ${(signal.indicators.semanticDrift * 100).toFixed(1)}%).

Original problem: ${context.problemContext}

Problematic step:
${originalContent}

Please reframe this step to:
1. Directly address the original problem
2. Connect clearly to previous reasoning
3. Remove tangential discussions
4. Maintain relevance throughout

Reframed step:
`;

    const result = await this.callModel(prompt, context.modelTier || 'standard');
    return result;
  }

  /**
   * Decompose complex step into smaller parts
   */
  private async decomposeStep(
    originalContent: string,
    context: CorrectionContext,
    signal: HallucinationSignal
  ): Promise<string> {
    const prompt = `
This reasoning step is complex and contains potential issues (score: ${(signal.score * 100).toFixed(1)}%).

Original step:
${originalContent}

Please break this down into smaller, clearer sub-steps:
1. Each sub-step should make one clear point
2. Each should be verifiable
3. Combine them into a coherent whole

Decomposed reasoning:
`;

    const result = await this.callModel(prompt, context.modelTier || 'standard');
    return result;
  }

  /**
   * Verify content and fix issues
   */
  private async verifyAndFix(
    originalContent: string,
    context: CorrectionContext,
    signal: HallucinationSignal
  ): Promise<string> {
    // First, verify
    const verifyPrompt = `
Please verify the following reasoning step for accuracy:

Problem context: ${context.problemContext}
Step content: ${originalContent}

Identify any:
1. Factual errors
2. Logical inconsistencies
3. Unsupported claims
4. Missing connections

List issues found:
`;

    const verifyResult = await this.callModel(verifyPrompt, context.modelTier || 'standard');

    // Then, fix
    const fixPrompt = `
Please correct the following reasoning step based on the issues identified:

Original step:
${originalContent}

Issues identified:
${verifyResult}

Corrected step (addressing all issues):
`;

    const fixResult = await this.callModel(fixPrompt, context.modelTier || 'standard');
    return fixResult;
  }

  /**
   * Attempt to backtrack to a previous step
   */
  private async attemptBacktrack(
    stepId: string,
    context: CorrectionContext,
    maxSteps: number
  ): Promise<{
    success: boolean;
    stepsBacktracked: number;
    newContext: CorrectionContext;
  }> {
    // Find a good backtrack point
    const steps = context.previousSteps;
    let backtrackPoint = -1;

    for (let i = Math.max(0, steps.length - maxSteps); i < steps.length; i++) {
      // Simple heuristic: look for a step with good structure
      if (steps[i].length > 50 && !steps[i].includes('?')) {
        backtrackPoint = i;
        break;
      }
    }

    if (backtrackPoint === -1) {
      return { success: false, stepsBacktracked: 0, newContext: context };
    }

    const stepsBacktracked = steps.length - backtrackPoint;
    const newContext: CorrectionContext = {
      ...context,
      previousSteps: steps.slice(0, backtrackPoint),
    };

    return { success: true, stepsBacktracked, newContext };
  }

  // ==========================================================================
  // Model Interaction
  // ==========================================================================

  /**
   * Call model for correction
   */
  private async callModel(
    prompt: string,
    tier: 'maximum' | 'deep' | 'standard' | 'fast' = 'standard'
  ): Promise<string> {
    try {
      // Get provider (prefer Anthropic for corrections)
      const provider = getProvider('anthropic');
      if (!provider) {
        throw new Error('No provider available for corrections');
      }

      // Map tier to model config
      const modelKeyMap: Record<string, string> = {
        maximum: 'claude-opus-4.5',
        deep: 'claude-sonnet-4.5',
        standard: 'claude-sonnet-4.5',
        fast: 'claude-3.5-haiku',
      };

      const modelKey = modelKeyMap[tier] || modelKeyMap.standard;
      const modelConfig = HYPER_THINKING_MODELS[modelKey];

      if (!modelConfig) {
        throw new Error(`Model config not found for tier: ${tier}`);
      }

      const result = await provider.reason({
        prompt,
        systemPrompt: 'You are a reasoning assistant helping to correct potential errors in a reasoning chain. Be concise and accurate.',
        model: modelConfig,
        thinkingBudget: 8000,
      });

      return result.content;
    } catch (error) {
      console.error('[AutoCorrection] Model call failed:', error);
      // Return a fallback message instead of throwing
      return '[Correction failed - unable to regenerate step]';
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Format indicators for prompt
   */
  private formatIndicators(indicators: HallucinationSignal['indicators']): string {
    const parts: string[] = [];
    
    if (indicators.semanticDrift > 0.3) {
      parts.push(`semantic drift (${(indicators.semanticDrift * 100).toFixed(0)}%)`);
    }
    if (indicators.logicalContradiction > 0.3) {
      parts.push(`logical contradiction (${(indicators.logicalContradiction * 100).toFixed(0)}%)`);
    }
    if (indicators.factualInconsistency > 0.3) {
      parts.push(`factual issues (${(indicators.factualInconsistency * 100).toFixed(0)}%)`);
    }
    if (indicators.repetition > 0.3) {
      parts.push(`repetition (${(indicators.repetition * 100).toFixed(0)}%)`);
    }

    return parts.join(', ') || 'minor issues';
  }

  /**
   * Log correction for learning system
   */
  private async logCorrectionForLearning(
    signal: HallucinationSignal,
    attempts: CorrectionAttempt[],
    success: boolean
  ): Promise<void> {
    try {
      const storage = getArtifactStorage();
      
      await storage.store({
        id: uuidv4(),
        type: 'evaluation',
        content: JSON.stringify({
          signal,
          attempts: attempts.map(a => ({
            strategy: a.strategy,
            originalScore: a.originalScore,
            newScore: a.newScore,
            improvement: a.improvement,
            success: a.success,
          })),
          overallSuccess: success,
        }),
        problemContext: `Correction for step ${signal.stepId}`,
        strategy: 'auto_correction',
        confidence: success ? 0.8 : 0.3,
        tokensUsed: 0,
        successful: success,
        depth: 0,
        metadata: {
          tags: ['correction', success ? 'successful' : 'failed'],
        },
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[AutoCorrection] Failed to log for learning:', error);
    }
  }

  /**
   * Create result when corrections are skipped
   */
  private createSkippedResult(): CorrectionResult {
    return {
      success: false,
      attempts: 0,
      attemptHistory: [],
      backtracked: false,
      totalTimeMs: 0,
    };
  }

  // ==========================================================================
  // Manual Override
  // ==========================================================================

  /**
   * Manually approve a step (skip correction)
   */
  approve(stepId: string): void {
    this.activeCorrections.delete(stepId);
  }

  /**
   * Manually reject and request regeneration
   */
  reject(stepId: string): void {
    this.activeCorrections.delete(stepId);
  }

  /**
   * Check if correction is in progress
   */
  isCorrectingStep(stepId: string): boolean {
    return this.activeCorrections.has(stepId);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get correction history for a step
   */
  getCorrectionHistory(stepId: string): CorrectionAttempt[] {
    return this.correctionHistory.get(stepId) || [];
  }

  /**
   * Clear correction history
   */
  clearHistory(): void {
    this.correctionHistory.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AutoCorrectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalCorrections: number;
    successfulCorrections: number;
    averageAttempts: number;
  } {
    let total = 0;
    let successful = 0;
    let totalAttempts = 0;

    for (const [, attempts] of this.correctionHistory) {
      total++;
      totalAttempts += attempts.length;
      if (attempts.some(a => a.success)) {
        successful++;
      }
    }

    return {
      totalCorrections: total,
      successfulCorrections: successful,
      averageAttempts: total > 0 ? totalAttempts / total : 0,
    };
  }
}

// ============================================================================
// Types
// ============================================================================

export interface CorrectionContext {
  /** Problem being solved */
  problemContext: string;
  /** Previous reasoning steps */
  previousSteps: string[];
  /** Current session ID */
  sessionId: string;
  /** Model tier to use */
  modelTier?: 'maximum' | 'deep' | 'standard' | 'fast';
}

// ============================================================================
// Singleton
// ============================================================================

let engineInstance: AutoCorrectionEngine | null = null;

export function getAutoCorrectionEngine(): AutoCorrectionEngine {
  if (!engineInstance) {
    engineInstance = new AutoCorrectionEngine();
  }
  return engineInstance;
}

export function resetAutoCorrectionEngine(): void {
  if (engineInstance) {
    engineInstance.clearHistory();
  }
  engineInstance = null;
}

export function createAutoCorrectionEngine(
  config?: Partial<AutoCorrectionConfig>
): AutoCorrectionEngine {
  return new AutoCorrectionEngine(config);
}

export default AutoCorrectionEngine;
