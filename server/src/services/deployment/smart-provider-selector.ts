/**
 * Smart Provider Selector
 *
 * Makes intelligent, cost-optimized decisions between RunPod and Modal
 * based on current pricing, availability, and workload characteristics.
 *
 * Part of KripTik AI's Auto-Deploy Private Endpoints feature (PROMPT 6).
 */

import {
  GPU_PRICING_2026,
  COLD_START_ESTIMATES,
  getGPUsByVRAM,
  calculateMonthlyCost,
  calculateCostPerRequest,
  type GPUPricing,
} from './provider-pricing.js';
import type { ModelModality } from '../training/types.js';

// =============================================================================
// TYPES
// =============================================================================

export type LatencyRequirement = 'critical' | 'low' | 'medium' | 'high';
export type BudgetConstraint = 'minimum_cost' | 'balanced' | 'performance';

export interface ProviderSelectionInput {
  modality: ModelModality;
  modelSizeGB: number;
  expectedRequestsPerDay: number;
  latencyRequirement: LatencyRequirement;
  budgetConstraint?: BudgetConstraint;
}

export interface ProviderSelectionResult {
  provider: 'runpod' | 'modal';
  gpuType: string;
  reason: string;

  costEstimates: {
    perRequest: number;
    perHourActive: number;
    monthlyEstimate: number;
  };

  performance: {
    coldStartP50Ms: number;
    coldStartP95Ms: number;
    expectedLatencyMs: number;
  };

  configuration: {
    minWorkers: number;
    maxWorkers: number;
    idleTimeoutSeconds: number;
    containerImage: string | null;
    gpuMemory: number;
  };

  alternatives: Array<{
    provider: 'runpod' | 'modal';
    gpuType: string;
    costDifference: string;
    tradeoff: string;
  }>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// VRAM requirements by modality (GB)
const VRAM_REQUIREMENTS: Record<ModelModality, { baseVRAM: number; perGBModel: number }> = {
  llm: { baseVRAM: 4, perGBModel: 2.5 }, // LLMs need ~2.5x model size for inference
  image: { baseVRAM: 8, perGBModel: 1.5 },
  video: { baseVRAM: 16, perGBModel: 2.0 },
  audio: { baseVRAM: 4, perGBModel: 1.2 },
  multimodal: { baseVRAM: 12, perGBModel: 2.0 },
};

// Average inference duration by modality (seconds)
const AVG_INFERENCE_DURATION: Record<ModelModality, number> = {
  llm: 3.0, // Token generation takes longer
  image: 8.0, // Image generation
  video: 45.0, // Video generation is slow
  audio: 2.0, // Audio is relatively fast
  multimodal: 5.0,
};

// Container images by modality (RunPod)
const CONTAINER_IMAGES: Record<ModelModality, string> = {
  llm: 'runpod/worker-vllm:stable-cuda12.1.0',
  image: 'runpod/worker-comfyui:stable',
  video: 'runpod/worker-default:stable',
  audio: 'runpod/worker-whisper:latest',
  multimodal: 'runpod/worker-default:stable',
};

// =============================================================================
// SMART PROVIDER SELECTOR
// =============================================================================

export class SmartProviderSelector {
  /**
   * Select optimal provider and configuration
   */
  async selectProvider(input: ProviderSelectionInput): Promise<ProviderSelectionResult> {
    const {
      modality,
      modelSizeGB,
      expectedRequestsPerDay,
      latencyRequirement,
      budgetConstraint = 'balanced',
    } = input;

    // Step 1: Calculate VRAM requirement
    const vramRequired = this.calculateVRAMRequirement(modality, modelSizeGB);

    // Step 2: Filter suitable GPUs
    const suitableGPUs = this.filterSuitableGPUs(vramRequired);

    if (suitableGPUs.length === 0) {
      throw new Error(`No GPU found with sufficient VRAM (${vramRequired}GB required)`);
    }

    // Step 3: Score each option
    const avgDuration = AVG_INFERENCE_DURATION[modality] || 5.0;
    const options: Array<{
      gpu: GPUPricing;
      provider: 'runpod' | 'modal';
      score: number;
      cost: number;
    }> = [];

    for (const gpu of suitableGPUs) {
      // RunPod option
      if (gpu.runpod.available) {
        const score = this.scoreOption(gpu, 'runpod', input, avgDuration);
        const cost = calculateMonthlyCost(gpu, 'runpod', expectedRequestsPerDay, avgDuration);
        options.push({ gpu, provider: 'runpod', score, cost });
      }

      // Modal option
      if (gpu.modal.available && gpu.modal.perSecond > 0) {
        const score = this.scoreOption(gpu, 'modal', input, avgDuration);
        const cost = calculateMonthlyCost(gpu, 'modal', expectedRequestsPerDay, avgDuration);
        options.push({ gpu, provider: 'modal', score, cost });
      }
    }

    // Step 4: Sort by score (higher is better)
    options.sort((a, b) => b.score - a.score);

    const best = options[0];
    if (!best) {
      throw new Error('No available deployment option found');
    }

    // Step 5: Build result
    const coldStart = COLD_START_ESTIMATES[best.provider];
    const costPerRequest = calculateCostPerRequest(best.gpu, best.provider, avgDuration);
    const costPerHour = best.provider === 'runpod'
      ? best.gpu.runpod.serverlessPerSecond * 3600
      : best.gpu.modal.perSecond * 3600;

    // Build configuration
    const config = this.buildConfiguration(modality, latencyRequirement, best.gpu.vram);

    // Build alternatives (top 3 excluding best)
    const alternatives = options
      .slice(1, 4)
      .map((opt) => ({
        provider: opt.provider,
        gpuType: opt.gpu.gpuType,
        costDifference: `${((opt.cost - best.cost) / best.cost * 100).toFixed(1)}% more`,
        tradeoff: this.getTradeoffDescription(opt, best),
      }));

    // Build reason
    const reason = this.buildReason(best, budgetConstraint, latencyRequirement);

    return {
      provider: best.provider,
      gpuType: best.gpu.gpuType,
      reason,
      costEstimates: {
        perRequest: costPerRequest,
        perHourActive: costPerHour,
        monthlyEstimate: best.cost,
      },
      performance: {
        coldStartP50Ms: coldStart.p50,
        coldStartP95Ms: coldStart.p95,
        expectedLatencyMs: avgDuration * 1000,
      },
      configuration: {
        ...config,
        gpuMemory: best.gpu.vram,
      },
      alternatives,
    };
  }

  /**
   * Calculate minimum VRAM requirement
   */
  private calculateVRAMRequirement(modality: ModelModality, modelSizeGB: number): number {
    const req = VRAM_REQUIREMENTS[modality] || VRAM_REQUIREMENTS.llm;
    return Math.ceil(req.baseVRAM + modelSizeGB * req.perGBModel);
  }

  /**
   * Filter GPUs by VRAM
   */
  private filterSuitableGPUs(vramRequired: number): GPUPricing[] {
    return getGPUsByVRAM(vramRequired);
  }

  /**
   * Score a provider/GPU combination (higher is better)
   */
  private scoreOption(
    gpu: GPUPricing,
    provider: 'runpod' | 'modal',
    input: ProviderSelectionInput,
    avgDuration: number
  ): number {
    let score = 100;

    // Cost factor (lower cost = higher score)
    const monthlyCost = calculateMonthlyCost(gpu, provider, input.expectedRequestsPerDay, avgDuration);
    const costScore = Math.max(0, 100 - monthlyCost / 10); // Normalize to 0-100

    // Latency factor
    const coldStart = COLD_START_ESTIMATES[provider];
    let latencyScore = 50;
    switch (input.latencyRequirement) {
      case 'critical':
        latencyScore = provider === 'modal' ? 80 : 60; // Modal has more predictable cold starts
        break;
      case 'low':
        latencyScore = coldStart.p50 < 300 ? 80 : 50;
        break;
      case 'medium':
        latencyScore = 60;
        break;
      case 'high':
        latencyScore = 70; // Not latency sensitive, so both are fine
        break;
    }

    // Budget constraint weighting
    const budgetConstraint = input.budgetConstraint || 'balanced';
    switch (budgetConstraint) {
      case 'minimum_cost':
        score = costScore * 0.7 + latencyScore * 0.3;
        break;
      case 'performance':
        score = costScore * 0.3 + latencyScore * 0.7;
        break;
      case 'balanced':
      default:
        score = costScore * 0.5 + latencyScore * 0.5;
    }

    // Bonus for RunPod on certain modalities (better container support)
    if (provider === 'runpod' && (input.modality === 'llm' || input.modality === 'image')) {
      score += 5;
    }

    // Bonus for Modal on video (better for long-running tasks)
    if (provider === 'modal' && input.modality === 'video') {
      score += 5;
    }

    return score;
  }

  /**
   * Build deployment configuration
   */
  private buildConfiguration(
    modality: ModelModality,
    latencyRequirement: LatencyRequirement,
    gpuVRAM: number
  ): { minWorkers: number; maxWorkers: number; idleTimeoutSeconds: number; containerImage: string | null } {
    let minWorkers = 0;
    let maxWorkers = 3;
    let idleTimeoutSeconds = 60;

    // Critical latency needs warm workers
    if (latencyRequirement === 'critical') {
      minWorkers = 1;
      idleTimeoutSeconds = 300;
    } else if (latencyRequirement === 'low') {
      minWorkers = 0;
      idleTimeoutSeconds = 120;
    } else if (latencyRequirement === 'high') {
      idleTimeoutSeconds = 30;
    }

    // Video needs fewer workers but longer timeout
    if (modality === 'video') {
      maxWorkers = 1;
      idleTimeoutSeconds = Math.max(idleTimeoutSeconds, 180);
    }

    return {
      minWorkers,
      maxWorkers,
      idleTimeoutSeconds,
      containerImage: CONTAINER_IMAGES[modality] || null,
    };
  }

  /**
   * Get tradeoff description for alternatives
   */
  private getTradeoffDescription(
    opt: { gpu: GPUPricing; provider: 'runpod' | 'modal' },
    best: { gpu: GPUPricing; provider: 'runpod' | 'modal' }
  ): string {
    if (opt.provider !== best.provider) {
      return `Uses ${opt.provider} instead of ${best.provider}`;
    }
    if (opt.gpu.vram > best.gpu.vram) {
      return `More VRAM (${opt.gpu.vram}GB), potentially faster`;
    }
    if (opt.gpu.vram < best.gpu.vram) {
      return `Less VRAM (${opt.gpu.vram}GB), may have issues`;
    }
    return `Alternative GPU option`;
  }

  /**
   * Build reason string
   */
  private buildReason(
    best: { gpu: GPUPricing; provider: 'runpod' | 'modal'; cost: number },
    budgetConstraint: BudgetConstraint,
    latencyRequirement: LatencyRequirement
  ): string {
    const parts: string[] = [];

    parts.push(`${best.provider} ${best.gpu.gpuType}`);

    if (budgetConstraint === 'minimum_cost') {
      parts.push('selected for lowest cost');
    } else if (budgetConstraint === 'performance') {
      parts.push('selected for best performance');
    } else {
      parts.push('selected for optimal balance');
    }

    if (latencyRequirement === 'critical') {
      parts.push('with fast cold starts');
    }

    parts.push(`(~$${best.cost.toFixed(2)}/month estimated)`);

    return parts.join(' ');
  }
}

// =============================================================================
// SINGLETON FACTORY
// =============================================================================

let selectorInstance: SmartProviderSelector | null = null;

export function getSmartProviderSelector(): SmartProviderSelector {
  if (!selectorInstance) {
    selectorInstance = new SmartProviderSelector();
  }
  return selectorInstance;
}
