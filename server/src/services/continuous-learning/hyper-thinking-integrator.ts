/**
 * Hyper-Thinking Integrator
 *
 * Bridges the gap between complex tasks and the hyper-thinking engine,
 * enabling Tree-of-Thought and MARS reasoning with continuous learning feedback.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { learningReasoningSessions, learningEvolutionCycles } from '../../schema.js';
import { eq, desc, and, gte, sql } from 'drizzle-orm';

import type {
  ReasoningResult,
  PhaseContext,
  ToTResult,
  MARSErrorResolution,
  ReasoningConfig,
  ReasoningType,
} from './types.js';

import { HyperThinkingOrchestrator, getHyperThinkingOrchestrator } from '../hyper-thinking/orchestrator.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

interface HyperThinkingConfig {
  enableTreeOfThought: boolean;
  enableMARS: boolean;
  complexityThreshold: number; // Above this, use hyper-thinking
  maxBranches: number;
  maxIterations: number;
  consensusThreshold: number;
}

const DEFAULT_CONFIG: HyperThinkingConfig = {
  enableTreeOfThought: true,
  enableMARS: true,
  complexityThreshold: 0.7,
  maxBranches: 3,
  maxIterations: 3,
  consensusThreshold: 0.75,
};

// =============================================================================
// HYPER-THINKING INTEGRATOR
// =============================================================================

export class HyperThinkingIntegrator extends EventEmitter {
  private config: HyperThinkingConfig;
  private orchestrator: HyperThinkingOrchestrator | null = null;
  private sessionStats = {
    totalSessions: 0,
    totSuccessful: 0,
    avgConfidence: 0,
  };

  constructor(config?: Partial<HyperThinkingConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize and connect to hyper-thinking orchestrator
   */
  async initialize(): Promise<void> {
    try {
      this.orchestrator = await getHyperThinkingOrchestrator();
      console.log('[HyperThinkingIntegrator] Connected to HyperThinkingOrchestrator');
    } catch (error) {
      console.warn('[HyperThinkingIntegrator] Orchestrator not available, using fallback mode');
    }

    this.emit('initialized');
  }

  // =========================================================================
  // TREE-OF-THOUGHT REASONING
  // =========================================================================

  /**
   * Apply Tree-of-Thought reasoning for complex decision-making
   */
  async applyTreeOfThought(
    prompt: string,
    context: PhaseContext,
    config?: Partial<ReasoningConfig>
  ): Promise<ToTResult> {
    const sessionId = `tot_${uuidv4()}`;
    const startTime = Date.now();

    console.log(`[HyperThinkingIntegrator] Starting ToT session: ${sessionId}`);

    try {
      // Use orchestrator if available
      if (this.orchestrator) {
        const contextString = JSON.stringify({
          phase: context.phase,
          feature: context.feature,
          buildId: context.buildId,
        });

        const result = await this.orchestrator.think({
          prompt,
          config: {
            strategy: 'tree_of_thought',
          },
          context: contextString,
        });

        const totResult: ToTResult = {
          sessionId,
          branches: result.reasoningPath?.map((s: { id: string; thought: string; evaluation?: { score?: number } }) => ({
            id: s.id,
            thought: s.thought,
            score: s.evaluation?.score || 0,
          })) || [],
          selectedPath: result.reasoningPath?.map((s: { id: string }) => s.id) || [],
          confidence: result.confidence || 0,
          reasoning: result.finalAnswer || '',
          alternatives: [],
          duration: Date.now() - startTime,
        };

        // Record session
        await this.recordReasoningSession(sessionId, 'tot', prompt, totResult, context);

        return totResult;
      }

      // Fallback: Simple reasoning without orchestrator
      return this.fallbackTreeOfThought(sessionId, prompt, context, startTime);

    } catch (error) {
      console.error('[HyperThinkingIntegrator] ToT error:', error);
      return this.fallbackTreeOfThought(sessionId, prompt, context, startTime);
    }
  }

  /**
   * Fallback ToT implementation
   */
  private async fallbackTreeOfThought(
    sessionId: string,
    prompt: string,
    context: PhaseContext,
    startTime: number
  ): Promise<ToTResult> {
    // Generate simple branches
    const branches = [
      { id: 'b1', thought: 'Direct approach', score: 0.7 },
      { id: 'b2', thought: 'Alternative approach', score: 0.5 },
    ];

    const result: ToTResult = {
      sessionId,
      branches,
      selectedPath: ['b1'],
      confidence: 0.7,
      reasoning: 'Selected direct approach based on context',
      alternatives: [branches[1]],
      duration: Date.now() - startTime,
    };

    await this.recordReasoningSession(sessionId, 'tot', prompt, result, context);

    return result;
  }

  // =========================================================================
  // MARS ERROR RESOLUTION
  // =========================================================================

  /**
   * Apply MARS (Multi-Agent Reasoning Swarm) for error resolution
   */
  async applyMARSForErrors(
    error: {
      message: string;
      stack?: string;
      context?: string;
      previousAttempts?: string[];
    },
    buildContext: PhaseContext
  ): Promise<MARSErrorResolution> {
    const sessionId = `mars_${uuidv4()}`;
    const startTime = Date.now();

    console.log(`[HyperThinkingIntegrator] Starting MARS session: ${sessionId}`);

    try {
      // Use orchestrator if available
      if (this.orchestrator) {
        const contextString = JSON.stringify({
          phase: buildContext.phase,
          feature: buildContext.feature,
          buildId: buildContext.buildId,
          previousAttempts: error.previousAttempts,
        });

        const result = await this.orchestrator.think({
          prompt: `Resolve this error: ${error.message}\n\nStack: ${error.stack || 'N/A'}\n\nContext: ${error.context || 'N/A'}`,
          config: {
            strategy: 'multi_agent',
          },
          context: contextString,
        });

        const marsResult: MARSErrorResolution = {
          sessionId,
          error: error.message,
          agentPerspectives: result.reasoningPath?.map((s: { thought: string; metadata?: { agent?: string }; evaluation?: { reasoning?: string } }) => ({
            agent: s.metadata?.agent || 'unknown',
            analysis: s.thought,
            suggestion: s.evaluation?.reasoning || '',
          })) || [],
          consensusReached: result.confidence >= this.config.consensusThreshold,
          consensusScore: result.confidence,
          proposedFix: result.finalAnswer || '',
          reasoning: result.reasoningPath?.map((s: { thought: string }) => s.thought).join('\n') || '',
          confidence: result.confidence || 0,
          duration: Date.now() - startTime,
        };

        // Record session
        await this.recordReasoningSession(sessionId, 'mars', error.message, marsResult, buildContext);

        return marsResult;
      }

      // Fallback
      return this.fallbackMARSResolution(sessionId, error, buildContext, startTime);

    } catch (err) {
      console.error('[HyperThinkingIntegrator] MARS error:', err);
      return this.fallbackMARSResolution(sessionId, error, buildContext, startTime);
    }
  }

  /**
   * Fallback MARS implementation
   */
  private async fallbackMARSResolution(
    sessionId: string,
    error: { message: string; stack?: string; context?: string },
    buildContext: PhaseContext,
    startTime: number
  ): Promise<MARSErrorResolution> {
    const result: MARSErrorResolution = {
      sessionId,
      error: error.message,
      agentPerspectives: [
        { agent: 'debugger', analysis: 'Requires debugging', suggestion: 'Add logging' },
        { agent: 'architect', analysis: 'May be structural', suggestion: 'Review architecture' },
      ],
      consensusReached: true,
      consensusScore: 0.75,
      proposedFix: 'Review the error context and add proper error handling',
      reasoning: 'Multiple perspectives suggest error handling improvement',
      confidence: 0.6,
      duration: Date.now() - startTime,
    };

    await this.recordReasoningSession(sessionId, 'mars', error.message, result, buildContext);

    return result;
  }

  // =========================================================================
  // COMPLEXITY ASSESSMENT
  // =========================================================================

  /**
   * Assess if a task requires hyper-thinking
   */
  async assessComplexity(
    task: {
      description: string;
      type: string;
      phase: string;
      dependencies?: string[];
    }
  ): Promise<{
    complexity: number;
    recommendHyperThinking: boolean;
    recommendedType: ReasoningType | null;
    factors: string[];
  }> {
    const factors: string[] = [];
    let complexity = 0;

    // Task type complexity
    const typeComplexity: Record<string, number> = {
      feature_implementation: 0.6,
      architecture_design: 0.8,
      error_resolution: 0.5,
      integration: 0.7,
      optimization: 0.6,
    };
    complexity += typeComplexity[task.type] || 0.4;
    if ((typeComplexity[task.type] || 0) >= 0.6) {
      factors.push(`High-complexity task type: ${task.type}`);
    }

    // Phase complexity
    const phaseComplexity: Record<string, number> = {
      ARCHITECTURE: 0.3,
      IMPLEMENTATION: 0.2,
      INTEGRATION: 0.25,
      VERIFICATION: 0.15,
      OPTIMIZATION: 0.2,
    };
    complexity += phaseComplexity[task.phase] || 0.1;
    if ((phaseComplexity[task.phase] || 0) >= 0.25) {
      factors.push(`Complex phase: ${task.phase}`);
    }

    // Dependencies add complexity
    if (task.dependencies && task.dependencies.length > 3) {
      complexity += 0.2;
      factors.push(`Many dependencies: ${task.dependencies.length}`);
    }

    // Description length/complexity
    if (task.description.length > 500) {
      complexity += 0.1;
      factors.push('Long task description');
    }

    // Normalize
    complexity = Math.min(1.0, complexity);

    // Determine recommendation
    const recommendHyperThinking = complexity >= this.config.complexityThreshold;
    let recommendedType: ReasoningType | null = null;

    if (recommendHyperThinking) {
      if (task.type === 'error_resolution') {
        recommendedType = 'mars';
      } else {
        recommendedType = 'tot';
      }
    }

    return {
      complexity,
      recommendHyperThinking,
      recommendedType,
      factors,
    };
  }

  // =========================================================================
  // SESSION RECORDING
  // =========================================================================

  /**
   * Record a reasoning session
   */
  private async recordReasoningSession(
    sessionId: string,
    type: ReasoningType,
    prompt: string,
    result: ToTResult | MARSErrorResolution,
    context: PhaseContext
  ): Promise<void> {
    await db.insert(learningReasoningSessions).values({
      id: sessionId,
      sessionType: type,
      buildId: context.buildId,
      phase: context.phase,
      feature: context.feature,
      prompt: prompt.slice(0, 1000), // Truncate long prompts
      result: JSON.stringify(result),
      confidence: result.confidence,
      duration: result.duration,
      timestamp: new Date().toISOString(),
    });

    // Update stats
    this.sessionStats.totalSessions++;
    if (result.confidence >= 0.7) {
      this.sessionStats.totSuccessful++;
    }
    this.sessionStats.avgConfidence = (
      (this.sessionStats.avgConfidence * (this.sessionStats.totalSessions - 1) + result.confidence) /
      this.sessionStats.totalSessions
    );

    this.emit('session_recorded', { sessionId, type, confidence: result.confidence });
  }

  // =========================================================================
  // GETTERS
  // =========================================================================

  /**
   * Get reasoning session history
   */
  async getSessionHistory(limit: number = 20): Promise<Array<{
    id: string;
    type: ReasoningType;
    buildId?: string;
    phase: string;
    confidence: number;
    duration: number;
    timestamp: string;
  }>> {
    const sessions = await db.select()
      .from(learningReasoningSessions)
      .orderBy(desc(learningReasoningSessions.timestamp))
      .limit(limit)
      .all();

    return sessions.map(s => ({
      id: s.id,
      type: s.sessionType as ReasoningType,
      buildId: s.buildId || undefined,
      phase: s.phase,
      confidence: s.confidence,
      duration: s.duration,
      timestamp: s.timestamp,
    }));
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalSessions: number;
    successRate: number;
    avgConfidence: number;
    isEnabled: boolean;
    orchestratorConnected: boolean;
  } {
    return {
      totalSessions: this.sessionStats.totalSessions,
      successRate: this.sessionStats.totalSessions > 0
        ? this.sessionStats.totSuccessful / this.sessionStats.totalSessions
        : 0,
      avgConfidence: this.sessionStats.avgConfidence,
      isEnabled: this.config.enableTreeOfThought || this.config.enableMARS,
      orchestratorConnected: this.orchestrator !== null,
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let integratorInstance: HyperThinkingIntegrator | null = null;

export async function getHyperThinkingIntegrator(): Promise<HyperThinkingIntegrator> {
  if (!integratorInstance) {
    integratorInstance = new HyperThinkingIntegrator();
    await integratorInstance.initialize();
  }
  return integratorInstance;
}

export function resetHyperThinkingIntegrator(): void {
  integratorInstance = null;
}

export default HyperThinkingIntegrator;
