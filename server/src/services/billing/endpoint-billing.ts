/**
 * Endpoint Billing Service
 *
 * Billing integration for private endpoint usage.
 * Users pay in KripTik credits, and usage is tracked per-request.
 *
 * Cost model:
 * - Per-second of GPU compute time
 * - Per-token for LLMs (input/output tokens)
 * - 20% markup over provider cost (KripTik margin)
 *
 * Part of KripTik AI's Auto-Deploy Private Endpoints feature.
 */

import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { db } from '../../db.js';
import { users, endpointUsage, userEndpoints } from '../../schema.js';
import { GPU_PRICING_2026 } from '../deployment/provider-pricing.js';
import { getCreditService } from './credits.js';
import { getUsageService } from './usage-service.js';

// =============================================================================
// CONSTANTS
// =============================================================================

// Cost per credit (1 credit = $0.01)
const CREDIT_VALUE_USD = 0.01;

// Markup over provider cost (KripTik margin)
const MARKUP_PERCENTAGE = 0.20; // 20% margin

// Token costs per 1M tokens (for LLMs)
const TOKEN_COSTS_PER_MILLION: Record<string, { input: number; output: number }> = {
  // Common fine-tuned LLM base models
  'llama-3.1': { input: 0.20, output: 0.40 },
  'llama-3.2': { input: 0.18, output: 0.35 },
  'mistral-7b': { input: 0.15, output: 0.30 },
  'mistral-large': { input: 0.40, output: 0.80 },
  'qwen-2.5': { input: 0.20, output: 0.40 },
  'deepseek-v3': { input: 0.14, output: 0.28 },
  'gemma-2': { input: 0.15, output: 0.30 },
  'phi-4': { input: 0.12, output: 0.24 },
  'default': { input: 0.20, output: 0.40 },
};

// =============================================================================
// TYPES
// =============================================================================

export type ModelModality = 'llm' | 'image' | 'video' | 'audio' | 'multimodal';
export type DeploymentProvider = 'runpod' | 'modal';

export interface EndpointBillingConfig {
  endpointId: string;
  provider: DeploymentProvider;
  gpuType: string;
  modality: ModelModality;
  baseModelId?: string;
}

export interface UsageCost {
  computeSeconds: number;
  computeCostUsd: number;
  tokensCost?: {
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
  totalCostUsd: number;
  totalWithMarkupUsd: number;
  creditsCharged: number;
}

export interface CreditCheck {
  sufficient: boolean;
  currentBalance: number;
  required: number;
  shortfall: number;
}

export interface ChargeResult {
  success: boolean;
  creditsDeducted: number;
  newBalance: number;
  error?: string;
}

export interface UsageSummary {
  startDate: Date;
  endDate: Date;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalComputeSeconds: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  totalCreditsCharged: number;
  byEndpoint: Array<{
    endpointId: string;
    modelName: string;
    requests: number;
    creditsCharged: number;
    costUsd: number;
  }>;
  byDay: Array<{
    date: string;
    requests: number;
    creditsCharged: number;
    costUsd: number;
  }>;
}

export interface MonthlyEstimate {
  estimatedRequestsPerMonth: number;
  estimatedComputeHours: number;
  computeCostUsd: number;
  tokensCostUsd?: number;
  totalCostUsd: number;
  totalCredits: number;
  costBreakdown: {
    gpu: number;
    tokens?: number;
    markup: number;
  };
}

// =============================================================================
// ENDPOINT BILLING SERVICE CLASS
// =============================================================================

export class EndpointBilling {
  private creditService = getCreditService();
  private usageService = getUsageService();

  /**
   * Calculate cost for a single request
   */
  calculateRequestCost(
    config: EndpointBillingConfig,
    usage: {
      computeSeconds: number;
      inputTokens?: number;
      outputTokens?: number;
    }
  ): UsageCost {
    // Get GPU pricing
    const gpuPricing = this.getGPUPricing(config.provider, config.gpuType);
    
    // Calculate compute cost (per-second pricing)
    const computeCostUsd = usage.computeSeconds * gpuPricing.perSecond;

    // Calculate token cost for LLMs
    let tokensCost: UsageCost['tokensCost'];
    if (config.modality === 'llm' && (usage.inputTokens || usage.outputTokens)) {
      const inputTokens = usage.inputTokens || 0;
      const outputTokens = usage.outputTokens || 0;

      const tokenPricing = this.getTokenPricing(config.baseModelId);
      const inputCostUsd = (inputTokens / 1_000_000) * tokenPricing.input;
      const outputCostUsd = (outputTokens / 1_000_000) * tokenPricing.output;

      tokensCost = {
        inputTokens,
        outputTokens,
        costUsd: inputCostUsd + outputCostUsd,
      };
    }

    // Calculate total cost
    const baseCostUsd = computeCostUsd + (tokensCost?.costUsd || 0);
    const totalWithMarkupUsd = baseCostUsd * (1 + MARKUP_PERCENTAGE);

    // Convert to credits (minimum 1 credit per request)
    const creditsCharged = Math.max(1, Math.ceil(totalWithMarkupUsd / CREDIT_VALUE_USD));

    return {
      computeSeconds: usage.computeSeconds,
      computeCostUsd,
      tokensCost,
      totalCostUsd: baseCostUsd,
      totalWithMarkupUsd,
      creditsCharged,
    };
  }

  /**
   * Check if user has sufficient credits
   */
  async checkCredits(userId: string, estimatedCredits: number): Promise<CreditCheck> {
    const credits = await this.creditService.getCredits(userId);
    const currentBalance = credits.balance;

    return {
      sufficient: currentBalance >= estimatedCredits,
      currentBalance,
      required: estimatedCredits,
      shortfall: Math.max(0, estimatedCredits - currentBalance),
    };
  }

  /**
   * Deduct credits for usage
   */
  async chargeForUsage(
    userId: string,
    endpointId: string,
    usage: UsageCost
  ): Promise<ChargeResult> {
    try {
      // Check if user has sufficient credits
      const creditCheck = await this.checkCredits(userId, usage.creditsCharged);
      if (!creditCheck.sufficient) {
        return {
          success: false,
          creditsDeducted: 0,
          newBalance: creditCheck.currentBalance,
          error: `Insufficient credits. Required: ${usage.creditsCharged}, Available: ${creditCheck.currentBalance}`,
        };
      }

      // Deduct credits
      const deductResult = await this.creditService.deductCredits(
        userId,
        usage.creditsCharged,
        `Endpoint usage: ${endpointId}`,
        {
          endpointId,
          computeSeconds: usage.computeSeconds,
          computeCostUsd: usage.computeCostUsd,
          totalCostUsd: usage.totalCostUsd,
          inputTokens: usage.tokensCost?.inputTokens,
          outputTokens: usage.tokensCost?.outputTokens,
        }
      );

      return {
        success: true,
        creditsDeducted: usage.creditsCharged,
        newBalance: deductResult.newBalance,
      };
    } catch (error) {
      console.error('[EndpointBilling] Error charging for usage:', error);
      return {
        success: false,
        creditsDeducted: 0,
        newBalance: 0,
        error: String(error),
      };
    }
  }

  /**
   * Pre-authorize credits before a request
   */
  async preAuthorize(
    userId: string,
    endpointId: string,
    estimatedCredits: number
  ): Promise<{ authorized: boolean; reason?: string }> {
    const creditCheck = await this.checkCredits(userId, estimatedCredits);
    
    if (!creditCheck.sufficient) {
      return {
        authorized: false,
        reason: `Insufficient credits. Required: ${estimatedCredits}, Available: ${creditCheck.currentBalance}`,
      };
    }

    return { authorized: true };
  }

  /**
   * Get usage summary for billing period
   */
  async getUsageSummary(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UsageSummary> {
    // Get all usage records for the period
    const usageRecords = await db
      .select()
      .from(endpointUsage)
      .where(
        and(
          eq(endpointUsage.userId, userId),
          gte(endpointUsage.createdAt, startDate.toISOString()),
          lte(endpointUsage.createdAt, endDate.toISOString())
        )
      )
      .orderBy(desc(endpointUsage.createdAt));

    // Calculate totals
    const totalRequests = usageRecords.length;
    const successfulRequests = usageRecords.filter((r) => r.success).length;
    const failedRequests = totalRequests - successfulRequests;

    const totalComputeSeconds = usageRecords.reduce(
      (sum, r) => sum + (r.computeSeconds || 0),
      0
    );
    const totalInputTokens = usageRecords.reduce(
      (sum, r) => sum + (r.inputTokens || 0),
      0
    );
    const totalOutputTokens = usageRecords.reduce(
      (sum, r) => sum + (r.outputTokens || 0),
      0
    );
    const totalCostUsd = usageRecords.reduce(
      (sum, r) => sum + (r.costUsd || 0),
      0
    );
    const totalCreditsCharged = usageRecords.reduce(
      (sum, r) => sum + (r.creditsCharged || 0),
      0
    );

    // Group by endpoint
    const byEndpointMap = new Map<string, {
      requests: number;
      creditsCharged: number;
      costUsd: number;
    }>();

    for (const record of usageRecords) {
      const existing = byEndpointMap.get(record.endpointId) || {
        requests: 0,
        creditsCharged: 0,
        costUsd: 0,
      };
      existing.requests++;
      existing.creditsCharged += record.creditsCharged || 0;
      existing.costUsd += record.costUsd || 0;
      byEndpointMap.set(record.endpointId, existing);
    }

    // Get endpoint names
    const endpointIds = Array.from(byEndpointMap.keys());
    const endpoints = endpointIds.length > 0
      ? await db
          .select({ id: userEndpoints.id, modelName: userEndpoints.modelName })
          .from(userEndpoints)
          .where(sql`${userEndpoints.id} IN (${sql.join(endpointIds.map(id => sql`${id}`), sql`, `)})`)
      : [];

    const endpointNameMap = new Map(endpoints.map((e) => [e.id, e.modelName]));

    const byEndpoint = Array.from(byEndpointMap.entries()).map(([endpointId, data]) => ({
      endpointId,
      modelName: endpointNameMap.get(endpointId) || 'Unknown',
      ...data,
    }));

    // Group by day
    const byDayMap = new Map<string, {
      requests: number;
      creditsCharged: number;
      costUsd: number;
    }>();

    for (const record of usageRecords) {
      const date = record.createdAt.substring(0, 10);
      const existing = byDayMap.get(date) || {
        requests: 0,
        creditsCharged: 0,
        costUsd: 0,
      };
      existing.requests++;
      existing.creditsCharged += record.creditsCharged || 0;
      existing.costUsd += record.costUsd || 0;
      byDayMap.set(date, existing);
    }

    const byDay = Array.from(byDayMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      startDate,
      endDate,
      totalRequests,
      successfulRequests,
      failedRequests,
      totalComputeSeconds,
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd,
      totalCreditsCharged,
      byEndpoint,
      byDay,
    };
  }

  /**
   * Estimate cost for expected usage
   */
  estimateMonthlyCost(
    config: EndpointBillingConfig,
    expectedRequestsPerDay: number,
    avgRequestDurationSeconds: number,
    avgTokensPerRequest?: { input: number; output: number }
  ): MonthlyEstimate {
    const estimatedRequestsPerMonth = expectedRequestsPerDay * 30;
    const estimatedComputeSeconds = estimatedRequestsPerMonth * avgRequestDurationSeconds;
    const estimatedComputeHours = estimatedComputeSeconds / 3600;

    // Get GPU pricing
    const gpuPricing = this.getGPUPricing(config.provider, config.gpuType);
    const computeCostUsd = estimatedComputeSeconds * gpuPricing.perSecond;

    // Calculate token cost for LLMs
    let tokensCostUsd: number | undefined;
    if (config.modality === 'llm' && avgTokensPerRequest) {
      const tokenPricing = this.getTokenPricing(config.baseModelId);
      const totalInputTokens = estimatedRequestsPerMonth * avgTokensPerRequest.input;
      const totalOutputTokens = estimatedRequestsPerMonth * avgTokensPerRequest.output;
      tokensCostUsd =
        (totalInputTokens / 1_000_000) * tokenPricing.input +
        (totalOutputTokens / 1_000_000) * tokenPricing.output;
    }

    // Calculate totals with markup
    const baseCostUsd = computeCostUsd + (tokensCostUsd || 0);
    const markupUsd = baseCostUsd * MARKUP_PERCENTAGE;
    const totalCostUsd = baseCostUsd + markupUsd;
    const totalCredits = Math.ceil(totalCostUsd / CREDIT_VALUE_USD);

    return {
      estimatedRequestsPerMonth,
      estimatedComputeHours,
      computeCostUsd,
      tokensCostUsd,
      totalCostUsd,
      totalCredits,
      costBreakdown: {
        gpu: computeCostUsd,
        tokens: tokensCostUsd,
        markup: markupUsd,
      },
    };
  }

  /**
   * Get real-time cost estimate for a request in progress
   */
  estimateRequestCost(
    config: EndpointBillingConfig,
    elapsedSeconds: number,
    tokensProcessed?: { input: number; output: number }
  ): {
    currentCostUsd: number;
    currentCredits: number;
    breakdown: {
      compute: number;
      tokens?: number;
    };
  } {
    const gpuPricing = this.getGPUPricing(config.provider, config.gpuType);
    const computeCost = elapsedSeconds * gpuPricing.perSecond;

    let tokensCost: number | undefined;
    if (config.modality === 'llm' && tokensProcessed) {
      const tokenPricing = this.getTokenPricing(config.baseModelId);
      tokensCost =
        (tokensProcessed.input / 1_000_000) * tokenPricing.input +
        (tokensProcessed.output / 1_000_000) * tokenPricing.output;
    }

    const totalCost = (computeCost + (tokensCost || 0)) * (1 + MARKUP_PERCENTAGE);
    const credits = Math.max(1, Math.ceil(totalCost / CREDIT_VALUE_USD));

    return {
      currentCostUsd: totalCost,
      currentCredits: credits,
      breakdown: {
        compute: computeCost,
        tokens: tokensCost,
      },
    };
  }

  /**
   * Get daily spending for an endpoint
   */
  async getDailySpending(
    userId: string,
    endpointId: string,
    days: number = 30
  ): Promise<Array<{ date: string; requests: number; credits: number; costUsd: number }>> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const usage = await db
      .select()
      .from(endpointUsage)
      .where(
        and(
          eq(endpointUsage.userId, userId),
          eq(endpointUsage.endpointId, endpointId),
          gte(endpointUsage.createdAt, since.toISOString())
        )
      );

    // Group by day
    const byDay = new Map<string, { requests: number; credits: number; costUsd: number }>();

    for (const record of usage) {
      const date = record.createdAt.substring(0, 10);
      const existing = byDay.get(date) || { requests: 0, credits: 0, costUsd: 0 };
      existing.requests++;
      existing.credits += record.creditsCharged || 0;
      existing.costUsd += record.costUsd || 0;
      byDay.set(date, existing);
    }

    return Array.from(byDay.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get cost breakdown by category
   */
  async getCostBreakdown(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalCredits: number;
    totalCostUsd: number;
    byCategory: {
      compute: { credits: number; costUsd: number };
      tokens: { credits: number; costUsd: number };
      other: { credits: number; costUsd: number };
    };
    byProvider: {
      runpod: { credits: number; costUsd: number };
      modal: { credits: number; costUsd: number };
    };
    byModality: {
      llm: { credits: number; costUsd: number };
      image: { credits: number; costUsd: number };
      video: { credits: number; costUsd: number };
      audio: { credits: number; costUsd: number };
      multimodal: { credits: number; costUsd: number };
    };
  }> {
    const usage = await db
      .select()
      .from(endpointUsage)
      .innerJoin(userEndpoints, eq(endpointUsage.endpointId, userEndpoints.id))
      .where(
        and(
          eq(endpointUsage.userId, userId),
          gte(endpointUsage.createdAt, startDate.toISOString()),
          lte(endpointUsage.createdAt, endDate.toISOString())
        )
      );

    // Initialize accumulators
    let totalCredits = 0;
    let totalCostUsd = 0;

    const byCategory = {
      compute: { credits: 0, costUsd: 0 },
      tokens: { credits: 0, costUsd: 0 },
      other: { credits: 0, costUsd: 0 },
    };

    const byProvider: Record<string, { credits: number; costUsd: number }> = {
      runpod: { credits: 0, costUsd: 0 },
      modal: { credits: 0, costUsd: 0 },
    };

    const byModality: Record<string, { credits: number; costUsd: number }> = {
      llm: { credits: 0, costUsd: 0 },
      image: { credits: 0, costUsd: 0 },
      video: { credits: 0, costUsd: 0 },
      audio: { credits: 0, costUsd: 0 },
      multimodal: { credits: 0, costUsd: 0 },
    };

    for (const record of usage) {
      const { endpoint_usage, user_endpoints } = record;
      const credits = endpoint_usage.creditsCharged || 0;
      const costUsd = endpoint_usage.costUsd || 0;

      totalCredits += credits;
      totalCostUsd += costUsd;

      // Categorize by compute vs tokens
      if (endpoint_usage.computeSeconds && endpoint_usage.computeSeconds > 0) {
        byCategory.compute.credits += credits;
        byCategory.compute.costUsd += costUsd;
      } else if (endpoint_usage.inputTokens || endpoint_usage.outputTokens) {
        byCategory.tokens.credits += credits;
        byCategory.tokens.costUsd += costUsd;
      } else {
        byCategory.other.credits += credits;
        byCategory.other.costUsd += costUsd;
      }

      // Group by provider
      const provider = user_endpoints.provider;
      if (byProvider[provider]) {
        byProvider[provider].credits += credits;
        byProvider[provider].costUsd += costUsd;
      }

      // Group by modality
      const modality = user_endpoints.modality;
      if (byModality[modality]) {
        byModality[modality].credits += credits;
        byModality[modality].costUsd += costUsd;
      }
    }

    return {
      totalCredits,
      totalCostUsd,
      byCategory,
      byProvider: byProvider as {
        runpod: { credits: number; costUsd: number };
        modal: { credits: number; costUsd: number };
      },
      byModality: byModality as {
        llm: { credits: number; costUsd: number };
        image: { credits: number; costUsd: number };
        video: { credits: number; costUsd: number };
        audio: { credits: number; costUsd: number };
        multimodal: { credits: number; costUsd: number };
      },
    };
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  /**
   * Get GPU pricing for a provider and GPU type
   */
  private getGPUPricing(
    provider: DeploymentProvider,
    gpuType: string
  ): { perHour: number; perSecond: number } {
    // Look up in GPU_PRICING_2026 array
    const pricing = GPU_PRICING_2026.find((p) => p.gpuType === gpuType);
    if (pricing) {
      if (provider === 'runpod') {
        return {
          perHour: pricing.runpod.podPerHour,
          perSecond: pricing.runpod.serverlessPerSecond,
        };
      } else {
        return {
          perHour: pricing.modal.perSecond * 3600,
          perSecond: pricing.modal.perSecond,
        };
      }
    }

    // Default fallback pricing
    return {
      perHour: 0.50, // $0.50/hr fallback
      perSecond: 0.50 / 3600,
    };
  }

  /**
   * Get token pricing for a base model
   */
  private getTokenPricing(
    baseModelId?: string
  ): { input: number; output: number } {
    if (!baseModelId) {
      return TOKEN_COSTS_PER_MILLION['default'];
    }

    // Match base model ID to pricing
    const normalizedId = baseModelId.toLowerCase();
    
    for (const [key, pricing] of Object.entries(TOKEN_COSTS_PER_MILLION)) {
      if (normalizedId.includes(key)) {
        return pricing;
      }
    }

    return TOKEN_COSTS_PER_MILLION['default'];
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let billingInstance: EndpointBilling | null = null;

export function getEndpointBilling(): EndpointBilling {
  if (!billingInstance) {
    billingInstance = new EndpointBilling();
  }
  return billingInstance;
}

export default EndpointBilling;
