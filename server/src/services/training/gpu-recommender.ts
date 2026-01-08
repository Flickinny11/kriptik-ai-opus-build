/**
 * GPU Recommender - Intelligent GPU Selection for Training
 *
 * Analyzes model size and training configuration to recommend optimal GPU.
 * Supports RunPod and Modal pricing with cost estimation.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import type {
  TrainingConfig,
  LLMTrainingConfig,
  ImageTrainingConfig,
  VideoTrainingConfig,
  AudioTrainingConfig,
  GPURecommendation,
  TrainingProvider,
  ModelModality,
} from './types.js';

// =============================================================================
// GPU SPECIFICATIONS
// =============================================================================

export interface GPUSpec {
  id: string;
  name: string;
  vramGB: number;
  provider: TrainingProvider;
  hourlyCost: number;
  tier: 'consumer' | 'professional' | 'datacenter';
  available: boolean;
  bandwidth?: number; // GB/s
  tensorCores?: number;
}

export const GPU_SPECS: GPUSpec[] = [
  // Consumer GPUs (RunPod)
  { id: 'rtx3090', name: 'NVIDIA GeForce RTX 3090', vramGB: 24, provider: 'runpod', hourlyCost: 0.44, tier: 'consumer', available: true, tensorCores: 328 },
  { id: 'rtx4080', name: 'NVIDIA GeForce RTX 4080', vramGB: 16, provider: 'runpod', hourlyCost: 0.55, tier: 'consumer', available: true, tensorCores: 304 },
  { id: 'rtx4090', name: 'NVIDIA GeForce RTX 4090', vramGB: 24, provider: 'runpod', hourlyCost: 0.69, tier: 'consumer', available: true, tensorCores: 512 },
  
  // Professional GPUs (RunPod)
  { id: 'a4000', name: 'NVIDIA RTX A4000', vramGB: 16, provider: 'runpod', hourlyCost: 0.39, tier: 'professional', available: true, tensorCores: 192 },
  { id: 'a5000', name: 'NVIDIA RTX A5000', vramGB: 24, provider: 'runpod', hourlyCost: 0.59, tier: 'professional', available: true, tensorCores: 256 },
  { id: 'a6000', name: 'NVIDIA RTX A6000', vramGB: 48, provider: 'runpod', hourlyCost: 0.79, tier: 'professional', available: true, tensorCores: 336 },
  { id: 'a40', name: 'NVIDIA A40', vramGB: 48, provider: 'runpod', hourlyCost: 0.79, tier: 'professional', available: true, tensorCores: 336 },
  { id: 'l40', name: 'NVIDIA L40', vramGB: 48, provider: 'runpod', hourlyCost: 0.99, tier: 'professional', available: true, tensorCores: 568 },
  { id: 'l40s', name: 'NVIDIA L40S', vramGB: 48, provider: 'runpod', hourlyCost: 1.14, tier: 'professional', available: true, tensorCores: 568 },
  
  // Datacenter GPUs (RunPod)
  { id: 'a100-40gb', name: 'NVIDIA A100-SXM4-40GB', vramGB: 40, provider: 'runpod', hourlyCost: 1.89, tier: 'datacenter', available: true, tensorCores: 432 },
  { id: 'a100-80gb', name: 'NVIDIA A100 80GB PCIe', vramGB: 80, provider: 'runpod', hourlyCost: 2.49, tier: 'datacenter', available: true, tensorCores: 432, bandwidth: 2039 },
  { id: 'h100', name: 'NVIDIA H100 PCIe', vramGB: 80, provider: 'runpod', hourlyCost: 3.99, tier: 'datacenter', available: true, tensorCores: 528, bandwidth: 3350 },
  
  // Modal GPUs
  { id: 'modal-t4', name: 'NVIDIA T4', vramGB: 16, provider: 'modal', hourlyCost: 0.30, tier: 'consumer', available: true, tensorCores: 320 },
  { id: 'modal-l4', name: 'NVIDIA L4', vramGB: 24, provider: 'modal', hourlyCost: 0.75, tier: 'professional', available: true, tensorCores: 568 },
  { id: 'modal-a10g', name: 'NVIDIA A10G', vramGB: 24, provider: 'modal', hourlyCost: 1.10, tier: 'professional', available: true, tensorCores: 288 },
  { id: 'modal-a100-40gb', name: 'NVIDIA A100 40GB', vramGB: 40, provider: 'modal', hourlyCost: 3.24, tier: 'datacenter', available: true, tensorCores: 432 },
  { id: 'modal-a100-80gb', name: 'NVIDIA A100 80GB', vramGB: 80, provider: 'modal', hourlyCost: 4.32, tier: 'datacenter', available: true, tensorCores: 432 },
  { id: 'modal-h100', name: 'NVIDIA H100', vramGB: 80, provider: 'modal', hourlyCost: 6.84, tier: 'datacenter', available: true, tensorCores: 528 },
];

// =============================================================================
// MODEL SIZE ESTIMATES (in billions of parameters)
// =============================================================================

const LLM_MODEL_SIZES: Record<string, number> = {
  // Small models
  'microsoft/phi-3-mini-4k-instruct': 3.8,
  'microsoft/phi-3.5-mini-instruct': 3.8,
  'Qwen/Qwen2.5-3B-Instruct': 3,
  'meta-llama/Llama-3.2-3B-Instruct': 3,
  
  // Medium models
  'mistralai/Mistral-7B-Instruct-v0.3': 7,
  'meta-llama/Llama-3.1-8B-Instruct': 8,
  'Qwen/Qwen2.5-7B-Instruct': 7,
  'google/gemma-2-9b-it': 9,
  'deepseek-ai/DeepSeek-V3': 37, // 37B active in MoE
  
  // Large models
  'Qwen/Qwen2.5-14B-Instruct': 14,
  'Qwen/Qwen2.5-32B-Instruct': 32,
  'meta-llama/Llama-3.1-70B-Instruct': 70,
  'meta-llama/Llama-3.3-70B-Instruct': 70,
  'Qwen/Qwen2.5-72B-Instruct': 72,
  
  // Scout models (MoE)
  'meta-llama/Llama-4-Scout-17B': 17, // 17B active
  'mistralai/Mistral-Large-3': 122, // ~122B active in MoE
};

const IMAGE_MODEL_VRAM: Record<string, number> = {
  'sd15': 8,
  'sdxl': 12,
  'sd3': 16,
  'sd35': 16,
  'flux': 24,
  'kandinsky': 16,
};

const VIDEO_MODEL_VRAM: Record<string, number> = {
  'wan': 24,
  'wan2': 32,
  'hunyuan': 48,
  'opensora': 24,
  'opensora2': 32,
  'mochi': 48,
  'skyreels': 48,
};

const AUDIO_MODEL_VRAM: Record<string, number> = {
  'xtts': 8,
  'xtts2': 8,
  'whisper_speech': 6,
  'bark': 12,
  'musicgen': 16,
  'llasa': 8,
};

// =============================================================================
// GPU RECOMMENDER CLASS
// =============================================================================

export class GPURecommender {
  /**
   * Get GPU recommendation for a training configuration
   */
  recommend(config: TrainingConfig): GPURecommendation {
    switch (config.modality) {
      case 'llm':
        return this.recommendForLLM(config as LLMTrainingConfig);
      case 'image':
        return this.recommendForImage(config as ImageTrainingConfig);
      case 'video':
        return this.recommendForVideo(config as VideoTrainingConfig);
      case 'audio':
        return this.recommendForAudio(config as AudioTrainingConfig);
      default: {
        // Exhaustive check - should never reach here
        const _exhaustiveCheck: never = config;
        throw new Error(`Unsupported modality: ${(_exhaustiveCheck as TrainingConfig).modality}`);
      }
    }
  }

  /**
   * Get GPU recommendation for LLM training
   */
  recommendForLLM(config: LLMTrainingConfig): GPURecommendation {
    // Estimate model size
    const modelSizeB = this.estimateLLMSize(config.baseModelId);
    
    // Calculate VRAM requirements
    let vramRequired: number;
    
    if (config.method === 'qlora') {
      // QLoRA: ~4-6GB per billion params with 4-bit quantization + LoRA weights + activations
      vramRequired = modelSizeB * 1.5 + 4; // Base + overhead
    } else if (config.method === 'lora') {
      // LoRA: ~8-10GB per billion params with FP16 + LoRA weights
      vramRequired = modelSizeB * 2 + 4;
    } else {
      // Full fine-tune: ~16-20GB per billion params with FP16 + optimizer states
      vramRequired = modelSizeB * 4 + 8;
    }

    // Adjust for batch size and gradient accumulation
    const effectiveBatchSize = config.batchSize * (config.gradientAccumulationSteps || 1);
    vramRequired += effectiveBatchSize * 0.5; // Additional VRAM for larger batches

    // Adjust for sequence length
    if (config.maxSeqLength > 2048) {
      vramRequired *= Math.sqrt(config.maxSeqLength / 2048);
    }

    // Find suitable GPUs
    const suitableGPUs = this.findSuitableGPUs(vramRequired, 'llm');
    const primaryGPU = suitableGPUs[0];

    // Estimate training time
    const estimatedHours = this.estimateLLMTrainingTime(config, modelSizeB, primaryGPU);
    const estimatedCost = estimatedHours * primaryGPU.hourlyCost;

    // Check if consumer GPU is viable
    const canRunOnConsumerGPU = vramRequired <= 24;

    return {
      provider: primaryGPU.provider,
      gpuType: primaryGPU.name,
      gpuCount: 1,
      vramRequired: Math.ceil(vramRequired),
      vramAvailable: primaryGPU.vramGB,
      estimatedHours: Math.ceil(estimatedHours * 10) / 10,
      estimatedCost: Math.ceil(estimatedCost * 100) / 100,
      costPerHour: primaryGPU.hourlyCost,
      reason: this.generateLLMReason(config, modelSizeB, vramRequired, primaryGPU),
      canRunOnConsumerGPU,
      alternatives: suitableGPUs.slice(1, 4).map(gpu => ({
        provider: gpu.provider,
        gpuType: gpu.name,
        gpuCount: 1,
        cost: Math.ceil(estimatedHours * gpu.hourlyCost * 100) / 100,
        costPerHour: gpu.hourlyCost,
        tradeoff: this.generateTradeoff(gpu, primaryGPU),
      })),
    };
  }

  /**
   * Get GPU recommendation for image training
   */
  recommendForImage(config: ImageTrainingConfig): GPURecommendation {
    // Get base model VRAM requirement
    const baseVram = IMAGE_MODEL_VRAM[config.baseModel] || 16;
    
    // Adjust for resolution
    let resolutionMultiplier = 1;
    if (config.resolution > 1024) {
      resolutionMultiplier = Math.pow(config.resolution / 1024, 1.5);
    }

    // Adjust for training method
    let methodMultiplier = 1;
    if (config.method === 'dreambooth') {
      methodMultiplier = 1.5; // DreamBooth needs more VRAM
    }

    const vramRequired = baseVram * resolutionMultiplier * methodMultiplier + 4;

    // Find suitable GPUs
    const suitableGPUs = this.findSuitableGPUs(vramRequired, 'image');
    const primaryGPU = suitableGPUs[0];

    // Estimate training time (based on steps)
    const stepsPerHour = this.estimateImageStepsPerHour(config, primaryGPU);
    const estimatedHours = config.steps / stepsPerHour;
    const estimatedCost = estimatedHours * primaryGPU.hourlyCost;

    return {
      provider: primaryGPU.provider,
      gpuType: primaryGPU.name,
      gpuCount: 1,
      vramRequired: Math.ceil(vramRequired),
      vramAvailable: primaryGPU.vramGB,
      estimatedHours: Math.ceil(estimatedHours * 10) / 10,
      estimatedCost: Math.ceil(estimatedCost * 100) / 100,
      costPerHour: primaryGPU.hourlyCost,
      reason: `${config.baseModel.toUpperCase()} ${config.method} training at ${config.resolution}px resolution requires ~${Math.ceil(vramRequired)}GB VRAM. ${primaryGPU.name} provides optimal price/performance.`,
      canRunOnConsumerGPU: vramRequired <= 24,
      alternatives: suitableGPUs.slice(1, 4).map(gpu => ({
        provider: gpu.provider,
        gpuType: gpu.name,
        gpuCount: 1,
        cost: Math.ceil(estimatedHours * gpu.hourlyCost * 100) / 100,
        costPerHour: gpu.hourlyCost,
        tradeoff: this.generateTradeoff(gpu, primaryGPU),
      })),
    };
  }

  /**
   * Get GPU recommendation for video training
   */
  recommendForVideo(config: VideoTrainingConfig): GPURecommendation {
    // Get base model VRAM requirement
    const baseVram = VIDEO_MODEL_VRAM[config.baseModel] || 32;

    // Adjust for frame count and resolution
    const frameMultiplier = Math.sqrt(config.frameCount / 24);
    const resMultiplier = (config.resolution.width * config.resolution.height) / (720 * 480);

    const vramRequired = baseVram * frameMultiplier * Math.sqrt(resMultiplier) + 8;

    // Video training typically needs datacenter GPUs
    const suitableGPUs = this.findSuitableGPUs(vramRequired, 'video');
    const primaryGPU = suitableGPUs[0];

    // Estimate training time
    const stepsPerHour = this.estimateVideoStepsPerHour(config, primaryGPU);
    const estimatedHours = config.steps / stepsPerHour;
    const estimatedCost = estimatedHours * primaryGPU.hourlyCost;

    return {
      provider: primaryGPU.provider,
      gpuType: primaryGPU.name,
      gpuCount: 1,
      vramRequired: Math.ceil(vramRequired),
      vramAvailable: primaryGPU.vramGB,
      estimatedHours: Math.ceil(estimatedHours * 10) / 10,
      estimatedCost: Math.ceil(estimatedCost * 100) / 100,
      costPerHour: primaryGPU.hourlyCost,
      reason: `Video model ${config.baseModel} with ${config.frameCount} frames at ${config.resolution.width}x${config.resolution.height} requires high VRAM. ${primaryGPU.name} recommended for stable training.`,
      canRunOnConsumerGPU: vramRequired <= 24,
      alternatives: suitableGPUs.slice(1, 4).map(gpu => ({
        provider: gpu.provider,
        gpuType: gpu.name,
        gpuCount: 1,
        cost: Math.ceil(estimatedHours * gpu.hourlyCost * 100) / 100,
        costPerHour: gpu.hourlyCost,
        tradeoff: this.generateTradeoff(gpu, primaryGPU),
      })),
    };
  }

  /**
   * Get GPU recommendation for audio training
   */
  recommendForAudio(config: AudioTrainingConfig): GPURecommendation {
    // Get base model VRAM requirement
    const baseVram = AUDIO_MODEL_VRAM[config.baseModel] || 8;

    // Voice cloning typically needs less VRAM
    const methodMultiplier = config.method === 'voice_clone' ? 0.8 : 1;
    const vramRequired = baseVram * methodMultiplier + 2;

    // Find suitable GPUs (audio training is typically less demanding)
    const suitableGPUs = this.findSuitableGPUs(vramRequired, 'audio');
    const primaryGPU = suitableGPUs[0];

    // Estimate training time
    const stepsPerHour = this.estimateAudioStepsPerHour(config, primaryGPU);
    const estimatedHours = config.steps / stepsPerHour;
    const estimatedCost = estimatedHours * primaryGPU.hourlyCost;

    return {
      provider: primaryGPU.provider,
      gpuType: primaryGPU.name,
      gpuCount: 1,
      vramRequired: Math.ceil(vramRequired),
      vramAvailable: primaryGPU.vramGB,
      estimatedHours: Math.ceil(estimatedHours * 10) / 10,
      estimatedCost: Math.ceil(estimatedCost * 100) / 100,
      costPerHour: primaryGPU.hourlyCost,
      reason: `Audio model ${config.baseModel} for ${config.method.replace('_', ' ')} is relatively lightweight. ${primaryGPU.name} provides excellent cost efficiency.`,
      canRunOnConsumerGPU: true,
      alternatives: suitableGPUs.slice(1, 4).map(gpu => ({
        provider: gpu.provider,
        gpuType: gpu.name,
        gpuCount: 1,
        cost: Math.ceil(estimatedHours * gpu.hourlyCost * 100) / 100,
        costPerHour: gpu.hourlyCost,
        tradeoff: this.generateTradeoff(gpu, primaryGPU),
      })),
    };
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  /**
   * Estimate LLM model size in billions of parameters
   */
  private estimateLLMSize(modelId: string): number {
    // Check known models
    if (LLM_MODEL_SIZES[modelId]) {
      return LLM_MODEL_SIZES[modelId];
    }

    // Try to extract size from model ID
    const sizeMatch = modelId.match(/(\d+)b/i);
    if (sizeMatch) {
      return parseInt(sizeMatch[1], 10);
    }

    // Default to 7B
    return 7;
  }

  /**
   * Find suitable GPUs for given VRAM requirement
   */
  private findSuitableGPUs(vramRequired: number, modality: ModelModality): GPUSpec[] {
    // Filter GPUs with enough VRAM
    const suitable = GPU_SPECS
      .filter(gpu => gpu.available && gpu.vramGB >= vramRequired)
      .sort((a, b) => {
        // Sort by cost efficiency (cost per GB of VRAM)
        const costPerGbA = a.hourlyCost / a.vramGB;
        const costPerGbB = b.hourlyCost / b.vramGB;
        return costPerGbA - costPerGbB;
      });

    if (suitable.length === 0) {
      // If no single GPU fits, return largest available (may need multi-GPU)
      return GPU_SPECS
        .filter(gpu => gpu.available)
        .sort((a, b) => b.vramGB - a.vramGB);
    }

    return suitable;
  }

  /**
   * Estimate LLM training time in hours
   */
  private estimateLLMTrainingTime(config: LLMTrainingConfig, modelSizeB: number, gpu: GPUSpec): number {
    // Base time estimation (very rough)
    // Factors: model size, dataset size, batch size, epochs, GPU speed
    
    const baseTimePerEpoch = modelSizeB * 0.5; // hours per epoch for baseline
    const gpuSpeedMultiplier = this.getGPUSpeedMultiplier(gpu);
    const methodMultiplier = config.method === 'qlora' ? 0.5 : config.method === 'lora' ? 0.7 : 1.0;
    const unslothMultiplier = config.useUnsloth ? 0.5 : 1.0; // Unsloth is ~2x faster
    
    const timePerEpoch = baseTimePerEpoch * methodMultiplier * unslothMultiplier / gpuSpeedMultiplier;
    const totalTime = timePerEpoch * config.epochs;
    
    // Add setup time (downloading model, dataset prep)
    return totalTime + 0.25;
  }

  /**
   * Estimate image training steps per hour
   */
  private estimateImageStepsPerHour(config: ImageTrainingConfig, gpu: GPUSpec): number {
    const baseStepsPerHour = 600; // baseline for 1024px SDXL on RTX 4090
    const gpuMultiplier = this.getGPUSpeedMultiplier(gpu);
    const resolutionMultiplier = Math.pow(1024 / config.resolution, 1.5);
    
    return baseStepsPerHour * gpuMultiplier * resolutionMultiplier;
  }

  /**
   * Estimate video training steps per hour
   */
  private estimateVideoStepsPerHour(config: VideoTrainingConfig, gpu: GPUSpec): number {
    const baseStepsPerHour = 30; // Video training is much slower
    const gpuMultiplier = this.getGPUSpeedMultiplier(gpu);
    const frameMultiplier = 24 / config.frameCount;
    
    return baseStepsPerHour * gpuMultiplier * frameMultiplier;
  }

  /**
   * Estimate audio training steps per hour
   */
  private estimateAudioStepsPerHour(config: AudioTrainingConfig, gpu: GPUSpec): number {
    const baseStepsPerHour = 1000;
    const gpuMultiplier = this.getGPUSpeedMultiplier(gpu);
    
    return baseStepsPerHour * gpuMultiplier;
  }

  /**
   * Get GPU speed multiplier relative to RTX 4090
   */
  private getGPUSpeedMultiplier(gpu: GPUSpec): number {
    const multipliers: Record<string, number> = {
      'NVIDIA GeForce RTX 3090': 0.7,
      'NVIDIA GeForce RTX 4080': 0.85,
      'NVIDIA GeForce RTX 4090': 1.0,
      'NVIDIA RTX A4000': 0.5,
      'NVIDIA RTX A5000': 0.65,
      'NVIDIA RTX A6000': 0.85,
      'NVIDIA A40': 0.85,
      'NVIDIA L40': 1.0,
      'NVIDIA L40S': 1.1,
      'NVIDIA A100-SXM4-40GB': 1.3,
      'NVIDIA A100 80GB PCIe': 1.3,
      'NVIDIA H100 PCIe': 2.0,
      'NVIDIA T4': 0.35,
      'NVIDIA L4': 0.8,
      'NVIDIA A10G': 0.7,
      'NVIDIA A100 40GB': 1.3,
      'NVIDIA A100 80GB': 1.3,
      'NVIDIA H100': 2.0,
    };

    return multipliers[gpu.name] || 1.0;
  }

  /**
   * Generate reason text for LLM recommendation
   */
  private generateLLMReason(
    config: LLMTrainingConfig,
    modelSizeB: number,
    vramRequired: number,
    gpu: GPUSpec
  ): string {
    const method = config.method === 'qlora' ? 'QLoRA (4-bit)' : config.method === 'lora' ? 'LoRA' : 'Full fine-tune';
    const unsloth = config.useUnsloth ? ' with Unsloth acceleration' : '';
    
    return `${modelSizeB}B parameter model with ${method}${unsloth} requires ~${Math.ceil(vramRequired)}GB VRAM. ${gpu.name} (${gpu.vramGB}GB) provides optimal balance of cost ($${gpu.hourlyCost}/hr) and performance.`;
  }

  /**
   * Generate tradeoff text for alternative GPUs
   */
  private generateTradeoff(alt: GPUSpec, primary: GPUSpec): string {
    if (alt.hourlyCost < primary.hourlyCost) {
      const savings = Math.round((1 - alt.hourlyCost / primary.hourlyCost) * 100);
      return `${savings}% cheaper, ~${Math.round((primary.vramGB / alt.vramGB - 1) * 100)}% less headroom`;
    } else {
      const premium = Math.round((alt.hourlyCost / primary.hourlyCost - 1) * 100);
      const speedup = Math.round((this.getGPUSpeedMultiplier(alt) / this.getGPUSpeedMultiplier(primary) - 1) * 100);
      return `${premium}% more expensive, ~${speedup}% faster`;
    }
  }

  /**
   * Get all available GPU options for a modality
   */
  getAvailableGPUs(modality: ModelModality, provider?: TrainingProvider): GPUSpec[] {
    return GPU_SPECS.filter(gpu => {
      if (!gpu.available) return false;
      if (provider && gpu.provider !== provider) return false;
      return true;
    });
  }

  /**
   * Get GPU specification by name
   */
  getGPUSpec(gpuName: string): GPUSpec | undefined {
    return GPU_SPECS.find(gpu => gpu.name === gpuName || gpu.id === gpuName);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let gpuRecommenderInstance: GPURecommender | null = null;

export function getGPURecommender(): GPURecommender {
  if (!gpuRecommenderInstance) {
    gpuRecommenderInstance = new GPURecommender();
  }
  return gpuRecommenderInstance;
}

export default GPURecommender;
