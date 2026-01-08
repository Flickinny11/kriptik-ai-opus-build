/**
 * Test Billing Service
 *
 * Handles metered billing for model testing/inference.
 * Different rates per modality.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import { getCreditService } from '../billing/credits.js';
import type { ModelModality } from './types.js';

// =============================================================================
// PRICING
// =============================================================================

export const TEST_PRICING = {
  llm: {
    perInputToken: 0.00001,   // $0.01 per 1K input tokens
    perOutputToken: 0.00003,  // $0.03 per 1K output tokens
    minCharge: 0.001,         // Minimum $0.001 per request
  },
  image: {
    perGeneration: 0.02,      // $0.02 per image
    perUpscale: 0.01,         // $0.01 per upscale
  },
  video: {
    perSecond: 0.05,          // $0.05 per second of video
    minCharge: 0.10,          // Minimum $0.10 per generation
  },
  audio: {
    perSecond: 0.01,          // $0.01 per second of audio
    minCharge: 0.02,          // Minimum $0.02 per generation
  },
  multimodal: {
    perRequest: 0.03,         // $0.03 base per request
    perInputToken: 0.00002,   // Additional per input token
    perOutputToken: 0.00004,  // Additional per output token
  },
} as const;

// Credits conversion rate
const CREDITS_PER_DOLLAR = 100; // 100 credits = $1

// =============================================================================
// TYPES
// =============================================================================

export interface UsageMetrics {
  inputTokens?: number;
  outputTokens?: number;
  generationCount?: number;
  durationSeconds?: number;
  upscaleCount?: number;
}

export interface BillingResult {
  charged: number;           // Amount in dollars
  creditsUsed: number;       // Credits deducted
  remainingCredits: number;  // Credits remaining after charge
}

export interface UsageRecord {
  userId: string;
  modality: ModelModality;
  usage: UsageMetrics;
  cost: number;
  credits: number;
  timestamp: string;
}

// =============================================================================
// TEST BILLING SERVICE
// =============================================================================

export class TestBillingService {
  private creditsService = getCreditService();

  /**
   * Check if user has enough credits for testing
   */
  async checkCredits(userId: string, modality: ModelModality): Promise<boolean> {
    const minRequired = this.getMinimumCreditsRequired(modality);
    return this.creditsService.hasCredits(userId, minRequired);
  }

  /**
   * Get user's current credit balance
   */
  async getBalance(userId: string): Promise<number> {
    const credits = await this.creditsService.getCredits(userId);
    return credits.balance;
  }

  /**
   * Charge for an inference request
   */
  async chargeForInference(
    userId: string,
    modality: ModelModality,
    usage: UsageMetrics
  ): Promise<BillingResult> {
    // Calculate cost based on modality and usage
    const cost = this.calculateCost(modality, usage);

    // Convert to credits (100 credits = $1)
    const creditsToDeduct = Math.ceil(cost * CREDITS_PER_DOLLAR);

    // Deduct credits
    const result = await this.creditsService.deductCredits(
      userId,
      creditsToDeduct,
      `Model testing - ${modality}`,
      {
        type: 'model_testing',
        modality,
        usage,
        costUsd: cost,
      }
    );

    const newCredits = await this.creditsService.getCredits(userId);

    return {
      charged: cost,
      creditsUsed: creditsToDeduct,
      remainingCredits: newCredits.balance,
    };
  }

  /**
   * Estimate cost for a test session
   */
  estimateCost(
    modality: ModelModality,
    testCount: number,
    averageUsage: UsageMetrics
  ): { perTest: number; total: number } {
    const perTestCost = this.calculateCost(modality, averageUsage);
    // Double because we run both pretrained and finetuned
    const actualPerTest = perTestCost * 2;

    return {
      perTest: actualPerTest,
      total: actualPerTest * testCount,
    };
  }

  /**
   * Get pricing information
   */
  getPricing(): typeof TEST_PRICING {
    return TEST_PRICING;
  }

  /**
   * Get minimum credits required for a modality
   */
  getMinimumCreditsRequired(modality: ModelModality): number {
    switch (modality) {
      case 'llm':
        return Math.ceil(TEST_PRICING.llm.minCharge * CREDITS_PER_DOLLAR * 2);
      case 'image':
        return Math.ceil(TEST_PRICING.image.perGeneration * CREDITS_PER_DOLLAR * 2);
      case 'video':
        return Math.ceil(TEST_PRICING.video.minCharge * CREDITS_PER_DOLLAR * 2);
      case 'audio':
        return Math.ceil(TEST_PRICING.audio.minCharge * CREDITS_PER_DOLLAR * 2);
      default:
        return Math.ceil(TEST_PRICING.multimodal.perRequest * CREDITS_PER_DOLLAR * 2);
    }
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private calculateCost(modality: ModelModality, usage: UsageMetrics): number {
    switch (modality) {
      case 'llm':
        return this.calculateLLMCost(usage);
      case 'image':
        return this.calculateImageCost(usage);
      case 'video':
        return this.calculateVideoCost(usage);
      case 'audio':
        return this.calculateAudioCost(usage);
      default:
        return this.calculateMultimodalCost(usage);
    }
  }

  private calculateLLMCost(usage: UsageMetrics): number {
    const inputCost = (usage.inputTokens || 0) * TEST_PRICING.llm.perInputToken;
    const outputCost = (usage.outputTokens || 0) * TEST_PRICING.llm.perOutputToken;
    const total = inputCost + outputCost;
    return Math.max(TEST_PRICING.llm.minCharge, total);
  }

  private calculateImageCost(usage: UsageMetrics): number {
    const generationCost = (usage.generationCount || 1) * TEST_PRICING.image.perGeneration;
    const upscaleCost = (usage.upscaleCount || 0) * TEST_PRICING.image.perUpscale;
    return generationCost + upscaleCost;
  }

  private calculateVideoCost(usage: UsageMetrics): number {
    const durationCost = (usage.durationSeconds || 4) * TEST_PRICING.video.perSecond;
    return Math.max(TEST_PRICING.video.minCharge, durationCost);
  }

  private calculateAudioCost(usage: UsageMetrics): number {
    const durationCost = (usage.durationSeconds || 5) * TEST_PRICING.audio.perSecond;
    return Math.max(TEST_PRICING.audio.minCharge, durationCost);
  }

  private calculateMultimodalCost(usage: UsageMetrics): number {
    const baseCost = TEST_PRICING.multimodal.perRequest;
    const inputCost = (usage.inputTokens || 0) * TEST_PRICING.multimodal.perInputToken;
    const outputCost = (usage.outputTokens || 0) * TEST_PRICING.multimodal.perOutputToken;
    return baseCost + inputCost + outputCost;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let testBillingServiceInstance: TestBillingService | null = null;

export function getTestBillingService(): TestBillingService {
  if (!testBillingServiceInstance) {
    testBillingServiceInstance = new TestBillingService();
  }
  return testBillingServiceInstance;
}

export default TestBillingService;
