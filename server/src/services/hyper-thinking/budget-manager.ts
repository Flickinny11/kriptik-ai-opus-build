/**
 * Thinking Budget Manager
 *
 * Manages thinking token budget allocation and tracking for hyper-thinking.
 * Features:
 * - Budget allocation across reasoning steps
 * - Real-time usage tracking
 * - Dynamic reallocation based on progress
 * - Credit system integration
 */

import {
  type ThinkingBudget,
  type TokenUsage,
  type ModelTier,
  DEFAULT_THINKING_BUDGETS,
  HyperThinkingError,
} from './types.js';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  /** Default thinking budget */
  defaultBudget: parseInt(process.env.HYPER_THINKING_DEFAULT_BUDGET || '32000', 10),
  /** Maximum thinking budget */
  maxBudget: parseInt(process.env.HYPER_THINKING_MAX_BUDGET || '128000', 10),
  /** Minimum budget per step */
  minBudgetPerStep: 1000,
  /** Maximum steps per reasoning session */
  maxSteps: 50,
  /** Reserve percentage for final synthesis */
  synthesisReserve: 0.15,
  /** Credit cost per 1000 tokens (approximate) */
  creditsPerKTokens: 1,
  /** Warning threshold (percentage of budget used) */
  warningThreshold: 0.8,
  /** Critical threshold (percentage of budget used) */
  criticalThreshold: 0.95,
};

// ============================================================================
// Budget Session
// ============================================================================

/**
 * Budget session for tracking a reasoning session
 */
export interface BudgetSession {
  /** Session ID */
  id: string;
  /** User ID */
  userId: string;
  /** Initial budget */
  initialBudget: ThinkingBudget;
  /** Current budget state */
  currentBudget: ThinkingBudget;
  /** Token usage by step */
  stepUsage: Map<string, TokenUsage>;
  /** Model tier */
  modelTier: ModelTier;
  /** Started timestamp */
  startedAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
  /** Is session complete? */
  completed: boolean;
  /** Final token usage */
  finalUsage?: TokenUsage;
}

// ============================================================================
// Budget Manager Class
// ============================================================================

export class BudgetManager {
  private sessions: Map<string, BudgetSession> = new Map();

  /**
   * Create a new budget session
   */
  createSession(
    sessionId: string,
    userId: string,
    modelTier: ModelTier,
    options?: {
      maxBudget?: number;
      customAllocation?: number;
    }
  ): BudgetSession {
    // Calculate initial budget
    const tierBudget = DEFAULT_THINKING_BUDGETS[modelTier];
    const requestedBudget = options?.customAllocation || options?.maxBudget || tierBudget;
    const totalTokens = Math.min(requestedBudget, CONFIG.maxBudget);

    // Reserve tokens for synthesis
    const synthesisReserve = Math.floor(totalTokens * CONFIG.synthesisReserve);
    const availableForSteps = totalTokens - synthesisReserve;

    // Calculate budget per step
    const budgetPerStep = Math.max(
      Math.floor(availableForSteps / CONFIG.maxSteps),
      CONFIG.minBudgetPerStep
    );
    const maxSteps = Math.floor(availableForSteps / budgetPerStep);

    // Estimate credit cost
    const estimatedCreditCost = Math.ceil(totalTokens * CONFIG.creditsPerKTokens / 1000);

    const budget: ThinkingBudget = {
      totalTokens,
      usedTokens: 0,
      remainingTokens: totalTokens,
      budgetPerStep,
      maxSteps,
      estimatedCreditCost,
    };

    const session: BudgetSession = {
      id: sessionId,
      userId,
      initialBudget: { ...budget },
      currentBudget: budget,
      stepUsage: new Map(),
      modelTier,
      startedAt: new Date(),
      updatedAt: new Date(),
      completed: false,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): BudgetSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Record token usage for a step
   */
  recordUsage(
    sessionId: string,
    stepId: string,
    usage: TokenUsage
  ): {
    budget: ThinkingBudget;
    warning?: 'approaching_limit' | 'critical' | 'exceeded';
  } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new HyperThinkingError(
        'INVALID_CONFIG',
        `Budget session not found: ${sessionId}`
      );
    }

    if (session.completed) {
      throw new HyperThinkingError(
        'INVALID_CONFIG',
        `Budget session already completed: ${sessionId}`
      );
    }

    // Record step usage
    session.stepUsage.set(stepId, usage);

    // Update budget
    const totalUsed = usage.totalTokens;
    session.currentBudget.usedTokens += totalUsed;
    session.currentBudget.remainingTokens = Math.max(
      0,
      session.currentBudget.totalTokens - session.currentBudget.usedTokens
    );
    session.updatedAt = new Date();

    // Check thresholds
    const usageRatio = session.currentBudget.usedTokens / session.currentBudget.totalTokens;
    let warning: 'approaching_limit' | 'critical' | 'exceeded' | undefined;

    if (usageRatio >= 1) {
      warning = 'exceeded';
    } else if (usageRatio >= CONFIG.criticalThreshold) {
      warning = 'critical';
    } else if (usageRatio >= CONFIG.warningThreshold) {
      warning = 'approaching_limit';
    }

    return {
      budget: session.currentBudget,
      warning,
    };
  }

  /**
   * Check if budget allows more steps
   */
  canContinue(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.completed) {
      return false;
    }

    // Need at least minBudgetPerStep remaining
    return session.currentBudget.remainingTokens >= CONFIG.minBudgetPerStep;
  }

  /**
   * Get remaining budget for next step
   */
  getStepBudget(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return 0;
    }

    // Return min of standard step budget or remaining budget
    return Math.min(
      session.currentBudget.budgetPerStep,
      session.currentBudget.remainingTokens
    );
  }

  /**
   * Dynamically reallocate budget based on progress
   */
  reallocateBudget(
    sessionId: string,
    options: {
      /** Add more tokens to budget */
      additionalTokens?: number;
      /** Increase step budget for remaining steps */
      increaseStepBudget?: boolean;
      /** Reserve more for synthesis */
      increaseSynthesisReserve?: boolean;
    }
  ): ThinkingBudget {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new HyperThinkingError(
        'INVALID_CONFIG',
        `Budget session not found: ${sessionId}`
      );
    }

    // Add additional tokens if requested
    if (options.additionalTokens && options.additionalTokens > 0) {
      const additional = Math.min(
        options.additionalTokens,
        CONFIG.maxBudget - session.currentBudget.totalTokens
      );
      session.currentBudget.totalTokens += additional;
      session.currentBudget.remainingTokens += additional;
      session.currentBudget.estimatedCreditCost = Math.ceil(
        session.currentBudget.totalTokens * CONFIG.creditsPerKTokens / 1000
      );
    }

    // Recalculate step budget if requested
    if (options.increaseStepBudget) {
      const stepsCompleted = session.stepUsage.size;
      const estimatedRemainingSteps = Math.max(1, session.currentBudget.maxSteps - stepsCompleted);
      session.currentBudget.budgetPerStep = Math.floor(
        session.currentBudget.remainingTokens / estimatedRemainingSteps
      );
    }

    session.updatedAt = new Date();
    return session.currentBudget;
  }

  /**
   * Reserve budget for synthesis step
   */
  reserveForSynthesis(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return 0;
    }

    // Reserve minimum of 15% of original budget or remaining budget
    const synthesisReserve = Math.min(
      Math.floor(session.initialBudget.totalTokens * CONFIG.synthesisReserve),
      session.currentBudget.remainingTokens
    );

    return synthesisReserve;
  }

  /**
   * Complete a budget session
   */
  completeSession(sessionId: string): BudgetSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    // Calculate final usage
    let totalPrompt = 0;
    let totalCompletion = 0;
    let totalThinking = 0;
    let totalCacheRead = 0;
    let totalCacheWrite = 0;

    for (const usage of session.stepUsage.values()) {
      totalPrompt += usage.promptTokens;
      totalCompletion += usage.completionTokens;
      totalThinking += usage.thinkingTokens;
      totalCacheRead += usage.cacheReadTokens || 0;
      totalCacheWrite += usage.cacheWriteTokens || 0;
    }

    session.finalUsage = {
      promptTokens: totalPrompt,
      completionTokens: totalCompletion,
      thinkingTokens: totalThinking,
      cacheReadTokens: totalCacheRead,
      cacheWriteTokens: totalCacheWrite,
      totalTokens: totalPrompt + totalCompletion + totalThinking,
    };

    session.completed = true;
    session.updatedAt = new Date();

    return session;
  }

  /**
   * Estimate credits needed for a budget
   */
  estimateCredits(budget: ThinkingBudget): number {
    return Math.ceil(budget.totalTokens * CONFIG.creditsPerKTokens / 1000);
  }

  /**
   * Check if user has sufficient credits
   */
  async checkCredits(
    userId: string,
    requiredTokens: number
  ): Promise<{ sufficient: boolean; available: number; required: number }> {
    // Import credit service dynamically to avoid circular dependencies
    const { getCreditService } = await import('../billing/credits.js');

    const creditService = getCreditService();
    const credits = await creditService.getCredits(userId);
    const required = Math.ceil(requiredTokens * CONFIG.creditsPerKTokens / 1000);

    return {
      sufficient: credits.balance >= required,
      available: credits.balance,
      required,
    };
  }

  /**
   * Deduct credits for used tokens
   */
  async deductCredits(
    userId: string,
    tokensUsed: number,
    description: string
  ): Promise<{ success: boolean; creditsDeducted: number }> {
    // Import credit service dynamically
    const { getCreditService } = await import('../billing/credits.js');

    const creditService = getCreditService();
    const creditsToDeduct = Math.ceil(tokensUsed * CONFIG.creditsPerKTokens / 1000);

    const result = await creditService.deductCredits(
      userId,
      creditsToDeduct,
      `Hyper-Thinking: ${description}`
    );

    return {
      success: result.success,
      creditsDeducted: creditsToDeduct,
    };
  }

  /**
   * Get usage statistics for a session
   */
  getSessionStats(sessionId: string): {
    totalSteps: number;
    totalTokensUsed: number;
    averageTokensPerStep: number;
    remainingBudget: number;
    budgetUtilization: number;
    estimatedCreditsUsed: number;
  } | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    const totalSteps = session.stepUsage.size;
    const totalTokensUsed = session.currentBudget.usedTokens;
    const averageTokensPerStep = totalSteps > 0 ? Math.round(totalTokensUsed / totalSteps) : 0;
    const remainingBudget = session.currentBudget.remainingTokens;
    const budgetUtilization = totalTokensUsed / session.currentBudget.totalTokens;
    const estimatedCreditsUsed = Math.ceil(totalTokensUsed * CONFIG.creditsPerKTokens / 1000);

    return {
      totalSteps,
      totalTokensUsed,
      averageTokensPerStep,
      remainingBudget,
      budgetUtilization: Math.round(budgetUtilization * 100) / 100,
      estimatedCreditsUsed,
    };
  }

  /**
   * Clean up old completed sessions
   */
  cleanup(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of this.sessions) {
      if (session.completed && (now - session.updatedAt.getTime()) > maxAgeMs) {
        this.sessions.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get all active sessions for a user
   */
  getUserSessions(userId: string): BudgetSession[] {
    return Array.from(this.sessions.values()).filter(
      s => s.userId === userId && !s.completed
    );
  }

  /**
   * Cancel a session (release budget without completion)
   */
  cancelSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.completed = true;
    session.updatedAt = new Date();
    return true;
  }
}

// ============================================================================
// Singleton
// ============================================================================

let managerInstance: BudgetManager | null = null;

export function getBudgetManager(): BudgetManager {
  if (!managerInstance) {
    managerInstance = new BudgetManager();
  }
  return managerInstance;
}

export function resetBudgetManager(): void {
  managerInstance = null;
}

export default BudgetManager;
