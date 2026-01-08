/**
 * Billing-Learning Bridge
 *
 * Connects the billing system to the learning system so that:
 * - Learning priorities are influenced by cost patterns
 * - Billing tracks the value of learning
 * - Cost-efficient model selection uses shadow models when cheaper and effective
 */

import { db } from '../../db.js';
import {
  continuousLearningSessions,
  learningCorrelations,
  productionModelDeployments,
  learningMetricsHistory,
} from '../../schema.js';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

import type {
  ModelSelection,
  CostAnalysis,
  LearningPriority,
  LearningROI,
  BillingLearningInsights,
  CostRecommendation,
} from './types.js';

import { getUsageService, UsageService } from '../billing/usage-service.js';
import { StripeBillingService, BILLING_PLANS } from '../billing/stripe.js';
import { getEvolutionFlywheel, EvolutionFlywheel } from '../learning/evolution-flywheel.js';
import { getShadowModelRegistry, ShadowModelRegistry } from '../learning/shadow-model-registry.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

interface BillingLearningConfig {
  costThreshold: number; // Minimum cost to trigger learning priority
  savingsTarget: number; // Target savings percentage
  qualityFloor: number;  // Minimum quality for model selection
}

const DEFAULT_CONFIG: BillingLearningConfig = {
  costThreshold: 10.0,   // $10
  savingsTarget: 0.3,    // 30%
  qualityFloor: 0.8,     // 80% quality minimum
};

// =============================================================================
// MODEL PRICING
// =============================================================================

interface ModelPricing {
  inputPer1kTokens: number;
  outputPer1kTokens: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-5-20251101': { inputPer1kTokens: 0.015, outputPer1kTokens: 0.075 },
  'claude-sonnet-4-20250514': { inputPer1kTokens: 0.003, outputPer1kTokens: 0.015 },
  'claude-3-5-haiku-20241022': { inputPer1kTokens: 0.001, outputPer1kTokens: 0.005 },
  'gpt-5.2': { inputPer1kTokens: 0.01, outputPer1kTokens: 0.03 },
  'gpt-5.2-codex': { inputPer1kTokens: 0.012, outputPer1kTokens: 0.036 },
  'deepseek-r1': { inputPer1kTokens: 0.0005, outputPer1kTokens: 0.002 },
  'shadow-model': { inputPer1kTokens: 0.0001, outputPer1kTokens: 0.0005 }, // RunPod/Modal
};

// =============================================================================
// BILLING-LEARNING BRIDGE
// =============================================================================

export class BillingLearningBridge {
  private config: BillingLearningConfig;
  private usageService: UsageService;
  private evolutionFlywheel: EvolutionFlywheel;
  private shadowRegistry: ShadowModelRegistry;
  private stripeService: StripeBillingService | null = null;

  constructor(config?: Partial<BillingLearningConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.usageService = getUsageService();
    this.evolutionFlywheel = getEvolutionFlywheel();
    this.shadowRegistry = getShadowModelRegistry();

    // Initialize Stripe if API key is available
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      this.stripeService = new StripeBillingService(stripeKey);
    }
  }

  // =========================================================================
  // COST-AWARE MODEL SELECTION
  // =========================================================================

  /**
   * Select the optimal model based on task, quality requirements, and cost
   */
  async selectOptimalModel(task: {
    type: string;
    complexity: number;
    qualityRequirement?: number;
    budgetLimit?: number;
  }): Promise<ModelSelection> {
    const qualityThreshold = task.qualityRequirement || this.config.qualityFloor;

    // Get available options
    const options: ModelSelection[] = [];

    // Standard models
    for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
      if (model === 'shadow-model') continue;

      const estimatedCost = this.estimateCost(model, task.complexity);
      const predictedQuality = await this.predictQuality(model, task.type);

      options.push({
        model,
        cost: estimatedCost,
        predictedQuality,
        valueScore: predictedQuality / Math.max(0.001, estimatedCost),
        isShadow: false,
      });
    }

    // Shadow models (from deployments)
    const deployments = await db.select()
      .from(productionModelDeployments)
      .where(
        and(
          eq(productionModelDeployments.status, 'testing'),
          gte(productionModelDeployments.trafficPercentage, 1)
        )
      );

    for (const deployment of deployments) {
      const estimatedCost = this.estimateShadowCost(deployment.id, task.complexity);
      const predictedQuality = deployment.metrics?.successRate || 0.7;

      options.push({
        model: deployment.modelName,
        cost: estimatedCost,
        predictedQuality,
        valueScore: predictedQuality / Math.max(0.001, estimatedCost),
        isShadow: true,
        deploymentId: deployment.id,
      });
    }

    // Filter by quality threshold and budget
    let viable = options.filter(o => o.predictedQuality >= qualityThreshold);

    if (task.budgetLimit) {
      viable = viable.filter(o => o.cost <= task.budgetLimit!);
    }

    // If no viable options, relax quality requirement
    if (viable.length === 0) {
      viable = options.filter(o => o.predictedQuality >= qualityThreshold * 0.9);
    }

    // Sort by value score (quality / cost)
    viable.sort((a, b) => b.valueScore - a.valueScore);

    // Return best option or fallback
    return viable[0] || options.sort((a, b) => b.predictedQuality - a.predictedQuality)[0];
  }

  /**
   * Estimate cost for a model based on complexity
   */
  private estimateCost(model: string, complexity: number): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) return 0.1; // Default fallback

    // Estimate tokens based on complexity
    const estimatedInputTokens = 1000 + (complexity * 5000);
    const estimatedOutputTokens = 500 + (complexity * 2000);

    return (
      (estimatedInputTokens / 1000) * pricing.inputPer1kTokens +
      (estimatedOutputTokens / 1000) * pricing.outputPer1kTokens
    );
  }

  /**
   * Estimate cost for a shadow model
   */
  private estimateShadowCost(deploymentId: string, complexity: number): number {
    // Shadow models on RunPod/Modal are much cheaper
    const pricing = MODEL_PRICING['shadow-model'];
    const estimatedInputTokens = 1000 + (complexity * 5000);
    const estimatedOutputTokens = 500 + (complexity * 2000);

    return (
      (estimatedInputTokens / 1000) * pricing.inputPer1kTokens +
      (estimatedOutputTokens / 1000) * pricing.outputPer1kTokens
    );
  }

  /**
   * Predict quality for a model on a task type
   */
  private async predictQuality(model: string, taskType: string): Promise<number> {
    // Base quality estimates
    const baseQuality: Record<string, number> = {
      'claude-opus-4-5-20251101': 0.95,
      'claude-sonnet-4-20250514': 0.88,
      'claude-3-5-haiku-20241022': 0.75,
      'gpt-5.2': 0.92,
      'gpt-5.2-codex': 0.93,
      'deepseek-r1': 0.85,
    };

    return baseQuality[model] || 0.7;
  }

  // =========================================================================
  // LEARNING PRIORITY FROM COSTS
  // =========================================================================

  /**
   * Update learning priorities based on cost patterns
   */
  async updateLearningPriorities(): Promise<LearningPriority[]> {
    const priorities: LearningPriority[] = [];

    // Analyze cost patterns from last 30 days
    const costAnalysis = await this.getCostBreakdown({ period: 'last_30_days' });

    // Identify high-cost operations
    const highCostOps = costAnalysis.operations
      .filter(op => op.totalCost > this.config.costThreshold)
      .sort((a, b) => b.totalCost - a.totalCost);

    for (const op of highCostOps.slice(0, 5)) {
      priorities.push({
        type: 'cost_reduction',
        target: op.operationType,
        currentCost: op.totalCost,
        potentialSavings: op.totalCost * this.config.savingsTarget,
        strategies: [
          'train_shadow_model',
          'optimize_prompts',
          'cache_similar_requests',
        ],
      });
    }

    // Identify error-related costs
    const errorCosts = costAnalysis.errors
      .sort((a, b) => b.retryCost - a.retryCost);

    for (const error of errorCosts.slice(0, 3)) {
      priorities.push({
        type: 'error_reduction',
        target: error.errorType,
        currentCost: error.retryCost,
        potentialSavings: error.retryCost * 0.5,
        strategies: [
          'learn_error_patterns',
          'improve_validation',
          'add_pre_checks',
        ],
      });
    }

    return priorities;
  }

  /**
   * Get cost breakdown by operation and error type
   */
  async getCostBreakdown(options: { period: string }): Promise<CostAnalysis> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get sessions
    const sessions = await db.select()
      .from(continuousLearningSessions)
      .where(gte(continuousLearningSessions.startedAt, thirtyDaysAgo))
      .all();

    // Group by session type
    const byType: Record<string, { totalCost: number; count: number }> = {};

    for (const session of sessions) {
      const type = session.sessionType;
      if (!byType[type]) {
        byType[type] = { totalCost: 0, count: 0 };
      }
      byType[type].totalCost += session.totalCostUsd || 0;
      byType[type].count++;
    }

    // Build operations list
    const operations = Object.entries(byType).map(([type, data]) => ({
      operationType: type,
      totalCost: data.totalCost,
      count: data.count,
      avgCostPerOp: data.count > 0 ? data.totalCost / data.count : 0,
    }));

    // Get error costs (from failed sessions that were retried)
    const failedSessions = sessions.filter(s => s.outcome === 'failure');
    const errors = [
      {
        errorType: 'build_failure',
        retryCost: failedSessions.reduce((sum, s) => sum + (s.totalCostUsd || 0), 0),
        occurrences: failedSessions.length,
      },
    ];

    return {
      period: options.period,
      operations,
      errors,
    };
  }

  // =========================================================================
  // ROI TRACKING
  // =========================================================================

  /**
   * Calculate ROI for learning investments
   */
  async calculateLearningROI(period: string = 'current_month'): Promise<LearningROI> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const periodStart = startOfMonth.toISOString();

    // Get actual costs
    const sessions = await db.select()
      .from(continuousLearningSessions)
      .where(gte(continuousLearningSessions.startedAt, periodStart))
      .all();

    const actualCost = sessions.reduce((sum, s) => sum + (s.totalCostUsd || 0), 0);

    // Estimate what cost would be without learning
    const patternsApplied = sessions.reduce((sum, s) => sum + (s.patternsApplied || 0), 0);
    const successRate = sessions.filter(s => s.outcome === 'success').length / Math.max(1, sessions.length);

    // Assume patterns save 5% per pattern applied
    const patternSavings = actualCost * (patternsApplied * 0.05);

    // Assume shadow models save 50% when used
    const shadowModelSessions = sessions.filter(s => {
      const strategies = (s.strategiesUsed as string[]) || [];
      return strategies.some(s => s.includes('shadow'));
    });
    const shadowModelSavings = shadowModelSessions.length * 0.5;

    // Error reduction savings (higher success rate = less retries)
    const errorReductionSavings = actualCost * (successRate - 0.5) * 0.2;

    // Cache hit savings (estimate)
    const cacheHitSavings = actualCost * 0.1;

    const estimatedWithoutLearning = actualCost + patternSavings + shadowModelSavings + errorReductionSavings + cacheHitSavings;
    const savings = estimatedWithoutLearning - actualCost;

    // Learning investment (training costs, compute for cycles)
    const learningInvestment = actualCost * 0.05; // Assume 5% overhead

    const roi = learningInvestment > 0 ? (savings - learningInvestment) / learningInvestment : 0;

    return {
      period,
      actualCost,
      estimatedWithoutLearning,
      savings,
      learningInvestment,
      roi,
      breakdown: {
        shadowModelSavings,
        patternApplicationSavings: patternSavings,
        errorReductionSavings,
        cacheHitSavings,
      },
    };
  }

  // =========================================================================
  // USER INSIGHTS
  // =========================================================================

  /**
   * Get billing and learning insights for a user
   */
  async getBillingLearningInsights(userId: string): Promise<BillingLearningInsights> {
    // Get current month usage
    const monthUsage = await this.usageService.getMonthlyUsage(userId);

    // Get credits remaining
    let creditsRemaining = 0;
    if (this.stripeService) {
      // Would need to implement getCredits in stripe service
      creditsRemaining = 1000; // Placeholder
    }

    // Calculate learning ROI
    const learningROI = await this.calculateLearningROI();

    // Generate recommendations
    const recommendations = await this.generateCostRecommendations(userId);

    // Project future costs
    const projectedCost = monthUsage.totalCredits * 1.1; // 10% growth estimate
    const projectedSavings = projectedCost * 0.2; // 20% savings from learning

    return {
      currentUsage: {
        totalCredits: monthUsage.totalCredits,
        byCategory: monthUsage.byCategory,
        generationCount: monthUsage.generationCount,
      },
      creditsRemaining,
      learningROI,
      recommendations,
      projectedCost,
      projectedSavings,
    };
  }

  /**
   * Generate cost recommendations for a user
   */
  private async generateCostRecommendations(userId: string): Promise<CostRecommendation[]> {
    const recommendations: CostRecommendation[] = [];

    // Get user's usage patterns
    const usage = await this.usageService.getUsageByModel(userId);

    // Check for expensive model usage
    let highCostModelUsage = 0;
    for (const [model, data] of usage) {
      if (model.includes('opus') || model.includes('gpt-5')) {
        highCostModelUsage += data.credits;
      }
    }

    if (highCostModelUsage > 100) {
      recommendations.push({
        type: 'model_switch',
        description: 'Consider using Sonnet or shadow models for routine tasks',
        estimatedSavings: highCostModelUsage * 0.4,
        confidence: 0.8,
      });
    }

    // Check for pattern opportunities
    recommendations.push({
      type: 'pattern_usage',
      description: 'Enable pattern library for faster builds',
      estimatedSavings: 50,
      confidence: 0.7,
    });

    // Check for caching opportunities
    recommendations.push({
      type: 'caching',
      description: 'Enable response caching for similar prompts',
      estimatedSavings: 30,
      confidence: 0.6,
    });

    return recommendations;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let bridgeInstance: BillingLearningBridge | null = null;

export function getBillingLearningBridge(): BillingLearningBridge {
  if (!bridgeInstance) {
    bridgeInstance = new BillingLearningBridge();
  }
  return bridgeInstance;
}

export function resetBillingLearningBridge(): void {
  bridgeInstance = null;
}

export default BillingLearningBridge;
