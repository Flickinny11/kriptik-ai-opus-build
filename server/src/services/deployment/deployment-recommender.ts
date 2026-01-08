/**
 * Deployment Recommender Service
 *
 * Analyzes model requirements and recommends optimal deployment configuration.
 * Considers GPU requirements, cost, latency, and scaling needs.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import type { ModelModality } from '../training/types.js';

// =============================================================================
// TYPES
// =============================================================================

export type DeploymentProvider = 'runpod' | 'modal';
export type LatencyRequirement = 'low' | 'medium' | 'high';
export type GPUType = 'T4' | 'L4' | 'A10G' | 'RTX3090' | 'RTX4090' | 'A100-40GB' | 'A100-80GB' | 'H100';

export interface ScalingConfig {
  minWorkers: number;
  maxWorkers: number;
  scaleToZero: boolean;
  idleTimeout?: number;
}

export interface DeploymentAlternative {
  provider: DeploymentProvider;
  gpuType: string;
  cost: number;
  tradeoff: string;
}

export interface DeploymentRecommendation {
  provider: DeploymentProvider;
  reason: string;
  gpuType: string;
  gpuVRAM: number;
  estimatedCostPerHour: number;
  estimatedCostPerRequest: number;
  scalingConfig: ScalingConfig;
  alternatives: DeploymentAlternative[];
  containerImage?: string;
  environmentVariables?: Record<string, string>;
}

export interface ModelRequirements {
  vramRequired: number;
  modelSizeGB: number;
  inferenceType: 'batch' | 'realtime' | 'streaming';
  supportsQuantization: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const GPU_SPECS: Record<GPUType, { vram: number; costPerHourRunPod: number; costPerHourModal: number }> = {
  'T4': { vram: 16, costPerHourRunPod: 0.20, costPerHourModal: 0.59 },
  'L4': { vram: 24, costPerHourRunPod: 0.35, costPerHourModal: 0.80 },
  'A10G': { vram: 24, costPerHourRunPod: 0.50, costPerHourModal: 1.10 },
  'RTX3090': { vram: 24, costPerHourRunPod: 0.44, costPerHourModal: 0.00 }, // Not available on Modal
  'RTX4090': { vram: 24, costPerHourRunPod: 0.69, costPerHourModal: 0.00 }, // Not available on Modal
  'A100-40GB': { vram: 40, costPerHourRunPod: 1.40, costPerHourModal: 2.78 },
  'A100-80GB': { vram: 80, costPerHourRunPod: 2.20, costPerHourModal: 4.22 },
  'H100': { vram: 80, costPerHourRunPod: 4.49, costPerHourModal: 5.49 },
};

const MODEL_VRAM_REQUIREMENTS: Record<string, Partial<Record<ModelModality, number>>> = {
  // Quantized models (4-bit)
  'small': { 'llm': 4, 'image': 4, 'video': 8, 'audio': 2 },
  // Standard models
  'medium': { 'llm': 8, 'image': 8, 'video': 16, 'audio': 4 },
  // Large models
  'large': { 'llm': 24, 'image': 16, 'video': 32, 'audio': 8 },
  // Very large models
  'xlarge': { 'llm': 48, 'image': 32, 'video': 64, 'audio': 16 },
};

// Container images for different model types
const CONTAINER_IMAGES: Partial<Record<ModelModality, string>> = {
  'llm': 'runpod/worker-vllm:stable',
  'image': 'runpod/worker-comfyui:stable',
  'video': 'runpod/worker-video:stable',
  'audio': 'runpod/worker-whisper:stable',
};

// =============================================================================
// DEPLOYMENT RECOMMENDER
// =============================================================================

export class DeploymentRecommender {
  /**
   * Get deployment recommendation for a model
   */
  recommendForModel(
    modelId: string,
    modality: ModelModality,
    expectedRequestsPerDay: number,
    latencyRequirement: LatencyRequirement,
    modelSizeGB?: number
  ): DeploymentRecommendation {
    // Estimate model requirements
    const requirements = this.estimateModelRequirements(modelId, modality, modelSizeGB);

    // Find suitable GPUs
    const suitableGPUs = this.findSuitableGPUs(requirements.vramRequired);
    if (suitableGPUs.length === 0) {
      throw new Error(`No suitable GPU found for model requiring ${requirements.vramRequired}GB VRAM`);
    }

    // Determine best provider and GPU
    const { provider, gpu, reason } = this.selectProviderAndGPU(
      suitableGPUs,
      expectedRequestsPerDay,
      latencyRequirement,
      requirements.inferenceType
    );

    // Calculate scaling config
    const scalingConfig = this.calculateScalingConfig(
      expectedRequestsPerDay,
      latencyRequirement,
      provider
    );

    // Calculate costs
    const gpuSpec = GPU_SPECS[gpu];
    const costPerHour = provider === 'runpod' ? gpuSpec.costPerHourRunPod : gpuSpec.costPerHourModal;

    // Estimate requests per hour and cost per request
    const avgSecondsPerRequest = this.estimateInferenceTime(modality, latencyRequirement);
    const requestsPerHour = 3600 / avgSecondsPerRequest;
    const estimatedCostPerRequest = costPerHour / requestsPerHour;

    // Generate alternatives
    const alternatives = this.generateAlternatives(suitableGPUs, gpu, provider);

    return {
      provider,
      reason,
      gpuType: gpu,
      gpuVRAM: gpuSpec.vram,
      estimatedCostPerHour: costPerHour,
      estimatedCostPerRequest,
      scalingConfig,
      alternatives,
      containerImage: CONTAINER_IMAGES[modality],
      environmentVariables: this.getEnvironmentVariables(modality, modelId),
    };
  }

  /**
   * Get quick recommendation based on modality only
   */
  quickRecommend(modality: ModelModality): DeploymentRecommendation {
    return this.recommendForModel(
      `default-${modality}`,
      modality,
      1000, // Default 1000 requests/day
      'medium'
    );
  }

  /**
   * Compare costs across providers
   */
  compareCosts(
    gpuType: GPUType,
    hoursPerDay: number = 8
  ): { runpod: number; modal: number; recommendation: DeploymentProvider; savings: number } {
    const gpuSpec = GPU_SPECS[gpuType];
    const runpodDaily = gpuSpec.costPerHourRunPod * hoursPerDay;
    const modalDaily = gpuSpec.costPerHourModal * hoursPerDay;

    const recommendation = runpodDaily <= modalDaily ? 'runpod' : 'modal';
    const savings = Math.abs(runpodDaily - modalDaily);

    return {
      runpod: runpodDaily,
      modal: modalDaily,
      recommendation,
      savings,
    };
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private estimateModelRequirements(
    modelId: string,
    modality: ModelModality,
    modelSizeGB?: number
  ): ModelRequirements {
    // Determine model size category
    let sizeCategory: 'small' | 'medium' | 'large' | 'xlarge' = 'medium';

    if (modelSizeGB) {
      if (modelSizeGB < 2) sizeCategory = 'small';
      else if (modelSizeGB < 8) sizeCategory = 'medium';
      else if (modelSizeGB < 30) sizeCategory = 'large';
      else sizeCategory = 'xlarge';
    } else {
      // Infer from model ID
      const idLower = modelId.toLowerCase();
      if (idLower.includes('7b') || idLower.includes('small') || idLower.includes('mini')) {
        sizeCategory = 'small';
      } else if (idLower.includes('13b') || idLower.includes('medium') || idLower.includes('base')) {
        sizeCategory = 'medium';
      } else if (idLower.includes('70b') || idLower.includes('large') || idLower.includes('xl')) {
        sizeCategory = 'large';
      } else if (idLower.includes('180b') || idLower.includes('405b') || idLower.includes('xxl')) {
        sizeCategory = 'xlarge';
      }
    }

    const vramRequired = MODEL_VRAM_REQUIREMENTS[sizeCategory]?.[modality] || 8;

    // Determine inference type
    let inferenceType: 'batch' | 'realtime' | 'streaming' = 'realtime';
    if (modality === 'video') inferenceType = 'batch';
    else if (modality === 'llm') inferenceType = 'streaming';

    return {
      vramRequired,
      modelSizeGB: modelSizeGB || vramRequired / 2,
      inferenceType,
      supportsQuantization: modality === 'llm',
    };
  }

  private findSuitableGPUs(vramRequired: number): GPUType[] {
    return (Object.keys(GPU_SPECS) as GPUType[])
      .filter((gpu) => GPU_SPECS[gpu].vram >= vramRequired)
      .sort((a, b) => GPU_SPECS[a].vram - GPU_SPECS[b].vram);
  }

  private selectProviderAndGPU(
    suitableGPUs: GPUType[],
    expectedRequestsPerDay: number,
    latencyRequirement: LatencyRequirement,
    inferenceType: 'batch' | 'realtime' | 'streaming'
  ): { provider: DeploymentProvider; gpu: GPUType; reason: string } {
    const gpu = suitableGPUs[0]; // Start with smallest suitable GPU
    const gpuSpec = GPU_SPECS[gpu];

    // Decision factors
    const factors: string[] = [];

    // RunPod advantages:
    // - Generally cheaper
    // - Good for batch processing
    // - More GPU variety (RTX series)

    // Modal advantages:
    // - Better scale-to-zero
    // - Better for bursty traffic
    // - Simpler deployment

    let provider: DeploymentProvider;

    // Low traffic with bursty patterns -> Modal
    if (expectedRequestsPerDay < 100 && latencyRequirement !== 'low') {
      provider = 'modal';
      factors.push('Low traffic volume benefits from Modal\'s scale-to-zero');
    }
    // High traffic -> RunPod (cheaper per hour)
    else if (expectedRequestsPerDay > 10000) {
      provider = 'runpod';
      factors.push('High traffic volume makes RunPod more cost-effective');
    }
    // Batch processing -> RunPod
    else if (inferenceType === 'batch') {
      provider = 'runpod';
      factors.push('Batch processing is more cost-effective on RunPod');
    }
    // Low latency requirement -> RunPod (no cold starts if min workers > 0)
    else if (latencyRequirement === 'low') {
      provider = 'runpod';
      factors.push('Low latency requirements need always-on workers');
    }
    // Default to cheaper option
    else {
      provider = gpuSpec.costPerHourRunPod <= gpuSpec.costPerHourModal ? 'runpod' : 'modal';
      factors.push(`${provider === 'runpod' ? 'RunPod' : 'Modal'} is more cost-effective for this GPU type`);
    }

    // Check if GPU is available on selected provider
    if (provider === 'modal' && (gpu === 'RTX3090' || gpu === 'RTX4090')) {
      provider = 'runpod';
      factors.push('RTX GPUs only available on RunPod');
    }

    return {
      provider,
      gpu,
      reason: factors.join('. '),
    };
  }

  private calculateScalingConfig(
    expectedRequestsPerDay: number,
    latencyRequirement: LatencyRequirement,
    provider: DeploymentProvider
  ): ScalingConfig {
    const requestsPerHour = expectedRequestsPerDay / 24;

    // Low latency = always-on workers
    if (latencyRequirement === 'low') {
      const minWorkers = Math.max(1, Math.ceil(requestsPerHour / 100));
      return {
        minWorkers,
        maxWorkers: minWorkers * 3,
        scaleToZero: false,
        idleTimeout: 300, // 5 minutes
      };
    }

    // Medium latency = some buffer
    if (latencyRequirement === 'medium') {
      return {
        minWorkers: expectedRequestsPerDay > 1000 ? 1 : 0,
        maxWorkers: Math.max(2, Math.ceil(requestsPerHour / 50)),
        scaleToZero: expectedRequestsPerDay < 1000,
        idleTimeout: 180, // 3 minutes
      };
    }

    // High latency tolerance = scale to zero
    return {
      minWorkers: 0,
      maxWorkers: Math.max(1, Math.ceil(requestsPerHour / 20)),
      scaleToZero: true,
      idleTimeout: 60, // 1 minute
    };
  }

  private estimateInferenceTime(modality: ModelModality, latency: LatencyRequirement): number {
    // Estimated seconds per request
    const baseTimes: Partial<Record<ModelModality, number>> = {
      'llm': 2,
      'image': 5,
      'video': 30,
      'audio': 3,
      'multimodal': 5,
    };

    const multiplier = latency === 'low' ? 0.7 : latency === 'medium' ? 1 : 1.5;
    return (baseTimes[modality] || 5) * multiplier;
  }

  private generateAlternatives(
    suitableGPUs: GPUType[],
    selectedGPU: GPUType,
    selectedProvider: DeploymentProvider
  ): DeploymentAlternative[] {
    const alternatives: DeploymentAlternative[] = [];

    // Add alternatives from other GPUs
    for (const gpu of suitableGPUs) {
      if (gpu === selectedGPU) continue;

      const spec = GPU_SPECS[gpu];

      // RunPod alternative
      if (spec.costPerHourRunPod > 0) {
        alternatives.push({
          provider: 'runpod',
          gpuType: gpu,
          cost: spec.costPerHourRunPod,
          tradeoff: this.getTradeoff(gpu, selectedGPU, 'runpod', selectedProvider),
        });
      }

      // Modal alternative (if available)
      if (spec.costPerHourModal > 0 && gpu !== 'RTX3090' && gpu !== 'RTX4090') {
        alternatives.push({
          provider: 'modal',
          gpuType: gpu,
          cost: spec.costPerHourModal,
          tradeoff: this.getTradeoff(gpu, selectedGPU, 'modal', selectedProvider),
        });
      }
    }

    // Sort by cost
    return alternatives.sort((a, b) => a.cost - b.cost).slice(0, 4);
  }

  private getTradeoff(
    altGPU: GPUType,
    selectedGPU: GPUType,
    altProvider: DeploymentProvider,
    selectedProvider: DeploymentProvider
  ): string {
    const altSpec = GPU_SPECS[altGPU];
    const selectedSpec = GPU_SPECS[selectedGPU];

    const parts: string[] = [];

    // VRAM comparison
    if (altSpec.vram > selectedSpec.vram) {
      parts.push(`${altSpec.vram - selectedSpec.vram}GB more VRAM`);
    } else if (altSpec.vram < selectedSpec.vram) {
      parts.push(`${selectedSpec.vram - altSpec.vram}GB less VRAM`);
    }

    // Cost comparison
    const altCost = altProvider === 'runpod' ? altSpec.costPerHourRunPod : altSpec.costPerHourModal;
    const selectedCost = selectedProvider === 'runpod' ? selectedSpec.costPerHourRunPod : selectedSpec.costPerHourModal;

    if (altCost > selectedCost) {
      parts.push(`$${(altCost - selectedCost).toFixed(2)}/hr more expensive`);
    } else if (altCost < selectedCost) {
      parts.push(`$${(selectedCost - altCost).toFixed(2)}/hr cheaper`);
    }

    return parts.join(', ') || 'Similar performance and cost';
  }

  private getEnvironmentVariables(modality: ModelModality, modelId: string): Record<string, string> {
    const base: Record<string, string> = {
      MODEL_ID: modelId,
      MAX_CONCURRENT_REQUESTS: '4',
    };

    switch (modality) {
      case 'llm':
        return {
          ...base,
          MAX_MODEL_LEN: '4096',
          TENSOR_PARALLEL_SIZE: '1',
          GPU_MEMORY_UTILIZATION: '0.9',
        };
      case 'image':
        return {
          ...base,
          USE_FP16: 'true',
          ENABLE_XFORMERS: 'true',
        };
      case 'video':
        return {
          ...base,
          MAX_FRAMES: '120',
          USE_FP16: 'true',
        };
      case 'audio':
        return {
          ...base,
          SAMPLE_RATE: '22050',
          MAX_DURATION: '60',
        };
      default:
        return base;
    }
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let deploymentRecommenderInstance: DeploymentRecommender | null = null;

export function getDeploymentRecommender(): DeploymentRecommender {
  if (!deploymentRecommenderInstance) {
    deploymentRecommenderInstance = new DeploymentRecommender();
  }
  return deploymentRecommenderInstance;
}

export default DeploymentRecommender;
