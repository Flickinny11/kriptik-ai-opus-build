/**
 * GPU Requirements Estimation
 * 
 * Estimates GPU memory and compute requirements for AI workloads.
 * Used by the GPU Classifier to recommend optimal GPU tiers.
 * 
 * Part of KripTik AI's GPU & AI Lab Implementation
 */

import { HuggingFaceService, type QuantizationType, type ModelTask } from './huggingface.js';

// =============================================================================
// TYPES
// =============================================================================

export type GPUWorkloadType = 
    | 'inference-only'        // Just running a model
    | 'training'              // Full model training
    | 'fine-tuning'           // Fine-tuning existing model
    | 'lora-training'         // LoRA/QLoRA fine-tuning
    | 'video-generation'      // Video AI (Wan, Runway, etc.)
    | 'image-generation'      // Image AI (SD, DALL-E, etc.)
    | 'audio'                 // Audio AI (TTS, ASR, etc.)
    | 'multimodal'            // Multi-modal models
    | 'embedding'             // Embedding models
    | 'llm';                  // Large Language Models

export type GPUTier = 
    | 'consumer'              // RTX 3090, 4090 (24GB)
    | 'professional'          // A40, L40 (48GB)
    | 'datacenter'            // A100-40GB
    | 'datacenter-high'       // A100-80GB
    | 'enterprise';           // H100 (80GB+)

export interface GPURequirement {
    minVRAM: number;                    // Minimum VRAM in GB
    recommendedVRAM: number;            // Recommended VRAM in GB
    computeCapability: number;          // CUDA compute capability (e.g., 8.6)
    estimatedCostPerHour: number;       // Cost in USD per hour
    supportedQuantizations: QuantizationType[];
    recommendedTier: GPUTier;
    recommendedGPUs: string[];          // Specific GPU models
    workloadType: GPUWorkloadType;
    distributedRequired: boolean;       // Whether multi-GPU is needed
    distributedGPUCount?: number;       // Number of GPUs for distributed
    batchSizeRecommendation: number;    // Recommended batch size
    memoryBreakdown: {
        modelWeights: number;           // GB for model weights
        activations: number;            // GB for activations/gradients
        optimizer: number;              // GB for optimizer states (training)
        buffer: number;                 // GB for safety buffer
    };
}

export interface ModelAnalysis {
    modelId: string;
    parameterCount: number;             // In billions
    modelSizeGB: number;                // Raw model size
    architecture?: string;
    framework?: string;
    task?: ModelTask;
    isQuantized: boolean;
    originalQuantization?: QuantizationType;
    supportedQuantizations: QuantizationType[];
}

// =============================================================================
// GPU CATALOG
// =============================================================================

export const GPU_CATALOG: Record<string, {
    vram: number;
    tier: GPUTier;
    computeCapability: number;
    costPerHour: number;
    tensorCores: boolean;
}> = {
    'NVIDIA GeForce RTX 3090': {
        vram: 24,
        tier: 'consumer',
        computeCapability: 8.6,
        costPerHour: 0.44,
        tensorCores: true,
    },
    'NVIDIA GeForce RTX 4090': {
        vram: 24,
        tier: 'consumer',
        computeCapability: 8.9,
        costPerHour: 0.69,
        tensorCores: true,
    },
    'NVIDIA A40': {
        vram: 48,
        tier: 'professional',
        computeCapability: 8.6,
        costPerHour: 0.79,
        tensorCores: true,
    },
    'NVIDIA L40': {
        vram: 48,
        tier: 'professional',
        computeCapability: 8.9,
        costPerHour: 0.99,
        tensorCores: true,
    },
    'NVIDIA A100 40GB': {
        vram: 40,
        tier: 'datacenter',
        computeCapability: 8.0,
        costPerHour: 1.89,
        tensorCores: true,
    },
    'NVIDIA A100 80GB': {
        vram: 80,
        tier: 'datacenter-high',
        computeCapability: 8.0,
        costPerHour: 2.49,
        tensorCores: true,
    },
    'NVIDIA H100': {
        vram: 80,
        tier: 'enterprise',
        computeCapability: 9.0,
        costPerHour: 3.99,
        tensorCores: true,
    },
};

// Quantization memory multipliers (relative to FP32)
const QUANTIZATION_MEMORY_FACTOR: Record<QuantizationType, number> = {
    'fp32': 1.0,
    'fp16': 0.5,
    'bf16': 0.5,
    'int8': 0.25,
    'int4': 0.125,
    'awq': 0.125,
    'gptq': 0.125,
    'gguf': 0.125,
};

// =============================================================================
// GPU REQUIREMENT ESTIMATOR
// =============================================================================

export class GPURequirementEstimator {
    private huggingFaceService: HuggingFaceService;

    constructor(hfToken?: string) {
        this.huggingFaceService = new HuggingFaceService(hfToken);
    }

    /**
     * Analyze a model and estimate GPU requirements
     */
    async analyzeModel(modelId: string): Promise<ModelAnalysis> {
        try {
            const model = await this.huggingFaceService.getModel(modelId);
            
            // Calculate model size from files
            const modelSize = model.siblings
                ?.filter(f => 
                    f.rfilename.endsWith('.bin') ||
                    f.rfilename.endsWith('.safetensors') ||
                    f.rfilename.endsWith('.pt') ||
                    f.rfilename.endsWith('.gguf')
                )
                .reduce((sum, f) => sum + (f.size || 0), 0) || 0;

            const modelSizeGB = modelSize / (1024 * 1024 * 1024);

            // Estimate parameter count (rough: 2 bytes per param for FP16)
            const estimatedParams = modelSizeGB / 2; // Billions

            // Check if model is quantized
            const isQuantized = model.tags?.some(t => 
                t.includes('awq') || 
                t.includes('gptq') || 
                t.includes('gguf') ||
                t.includes('quantized') ||
                t.includes('int4') ||
                t.includes('int8')
            ) || false;

            // Determine original quantization
            let originalQuantization: QuantizationType | undefined;
            if (isQuantized) {
                if (model.tags?.some(t => t.includes('awq'))) originalQuantization = 'awq';
                else if (model.tags?.some(t => t.includes('gptq'))) originalQuantization = 'gptq';
                else if (model.tags?.some(t => t.includes('gguf'))) originalQuantization = 'gguf';
                else if (model.tags?.some(t => t.includes('int4'))) originalQuantization = 'int4';
                else if (model.tags?.some(t => t.includes('int8'))) originalQuantization = 'int8';
            }

            // Determine supported quantizations
            const supportedQuantizations: QuantizationType[] = ['fp32', 'fp16'];
            if (model.library_name === 'transformers') {
                supportedQuantizations.push('bf16', 'int8', 'int4', 'awq', 'gptq');
            }
            if (model.tags?.some(t => t.includes('gguf'))) {
                supportedQuantizations.push('gguf');
            }

            return {
                modelId,
                parameterCount: estimatedParams,
                modelSizeGB,
                architecture: model.config?.model_type,
                framework: model.library_name,
                task: model.pipeline_tag,
                isQuantized,
                originalQuantization,
                supportedQuantizations,
            };
        } catch (error) {
            console.error(`[GPURequirements] Failed to analyze model ${modelId}:`, error);
            // Return conservative defaults
            return {
                modelId,
                parameterCount: 7, // Assume 7B model
                modelSizeGB: 14,
                isQuantized: false,
                supportedQuantizations: ['fp32', 'fp16', 'int8', 'int4'],
            };
        }
    }

    /**
     * Estimate GPU requirements for a given workload
     */
    estimateRequirements(
        modelAnalysis: ModelAnalysis,
        workloadType: GPUWorkloadType,
        options: {
            batchSize?: number;
            quantization?: QuantizationType;
            contextLength?: number;     // For LLMs
            imageResolution?: number;   // For image models
            videoDuration?: number;     // For video models (seconds)
        } = {}
    ): GPURequirement {
        const {
            batchSize = 1,
            quantization = 'fp16',
            contextLength = 4096,
            imageResolution = 512,
            videoDuration = 5,
        } = options;

        // Base memory for model weights
        const quantizationFactor = QUANTIZATION_MEMORY_FACTOR[quantization] || 0.5;
        const modelWeightsGB = modelAnalysis.modelSizeGB * quantizationFactor;

        // Calculate activation/gradient memory based on workload type
        let activationsGB = 0;
        let optimizerGB = 0;
        let bufferGB = 2; // Safety buffer

        switch (workloadType) {
            case 'inference-only':
            case 'embedding':
                // Inference: ~20% of model size for activations
                activationsGB = modelWeightsGB * 0.2 * batchSize;
                break;

            case 'lora-training':
                // LoRA: Small adapter weights + gradients
                activationsGB = modelWeightsGB * 0.3 * batchSize;
                optimizerGB = 0.5; // LoRA adapters are small
                bufferGB = 3;
                break;

            case 'fine-tuning':
            case 'training':
                // Full training: gradients + optimizer states
                activationsGB = modelWeightsGB * 0.8 * batchSize;
                optimizerGB = modelWeightsGB * 2; // Adam has 2 states per param
                bufferGB = 4;
                break;

            case 'image-generation':
                // SD-like models: UNet + VAE + text encoder
                activationsGB = (imageResolution / 512) ** 2 * 4 * batchSize;
                bufferGB = 3;
                break;

            case 'video-generation':
                // Video models: frames * resolution
                const frames = videoDuration * 24; // 24 fps
                activationsGB = (imageResolution / 512) ** 2 * (frames / 24) * 8 * batchSize;
                bufferGB = 8;
                break;

            case 'audio':
                // Audio models: generally smaller activations
                activationsGB = modelWeightsGB * 0.3 * batchSize;
                break;

            case 'llm':
                // LLMs: KV cache scales with context
                const kvCacheGB = (contextLength / 1024) * modelAnalysis.parameterCount * 0.1;
                activationsGB = modelWeightsGB * 0.3 * batchSize + kvCacheGB;
                break;

            case 'multimodal':
                // Multimodal: vision encoder + language model
                activationsGB = modelWeightsGB * 0.5 * batchSize;
                bufferGB = 4;
                break;
        }

        const minVRAM = Math.ceil(modelWeightsGB + activationsGB + optimizerGB);
        const recommendedVRAM = Math.ceil(minVRAM + bufferGB);

        // Determine recommended tier and GPUs
        const { tier, gpus, costPerHour, computeCapability, distributed } = 
            this.selectGPUTier(recommendedVRAM);

        return {
            minVRAM,
            recommendedVRAM,
            computeCapability,
            estimatedCostPerHour: costPerHour,
            supportedQuantizations: modelAnalysis.supportedQuantizations,
            recommendedTier: tier,
            recommendedGPUs: gpus,
            workloadType,
            distributedRequired: distributed,
            distributedGPUCount: distributed ? Math.ceil(recommendedVRAM / 80) : undefined,
            batchSizeRecommendation: this.calculateOptimalBatchSize(recommendedVRAM, workloadType),
            memoryBreakdown: {
                modelWeights: Math.round(modelWeightsGB * 10) / 10,
                activations: Math.round(activationsGB * 10) / 10,
                optimizer: Math.round(optimizerGB * 10) / 10,
                buffer: bufferGB,
            },
        };
    }

    /**
     * Select optimal GPU tier based on VRAM requirement
     */
    private selectGPUTier(requiredVRAM: number): {
        tier: GPUTier;
        gpus: string[];
        costPerHour: number;
        computeCapability: number;
        distributed: boolean;
    } {
        // Check each tier
        if (requiredVRAM <= 24) {
            return {
                tier: 'consumer',
                gpus: ['NVIDIA GeForce RTX 4090', 'NVIDIA GeForce RTX 3090'],
                costPerHour: 0.69,
                computeCapability: 8.9,
                distributed: false,
            };
        }
        
        if (requiredVRAM <= 48) {
            return {
                tier: 'professional',
                gpus: ['NVIDIA L40', 'NVIDIA A40'],
                costPerHour: 0.99,
                computeCapability: 8.9,
                distributed: false,
            };
        }
        
        if (requiredVRAM <= 80) {
            return {
                tier: 'datacenter-high',
                gpus: ['NVIDIA A100 80GB', 'NVIDIA H100'],
                costPerHour: 2.49,
                computeCapability: 8.0,
                distributed: false,
            };
        }

        // Distributed required for very large models
        const gpuCount = Math.ceil(requiredVRAM / 80);
        return {
            tier: 'enterprise',
            gpus: [`${gpuCount}x NVIDIA H100`, `${gpuCount}x NVIDIA A100 80GB`],
            costPerHour: 3.99 * gpuCount,
            computeCapability: 9.0,
            distributed: true,
        };
    }

    /**
     * Calculate optimal batch size for a given VRAM and workload
     */
    private calculateOptimalBatchSize(vram: number, workloadType: GPUWorkloadType): number {
        // Conservative batch sizes to avoid OOM
        const baseBatchSizes: Record<GPUWorkloadType, number> = {
            'inference-only': 8,
            'training': 1,
            'fine-tuning': 1,
            'lora-training': 4,
            'video-generation': 1,
            'image-generation': 1,
            'audio': 4,
            'multimodal': 2,
            'embedding': 32,
            'llm': 4,
        };

        const baseBatch = baseBatchSizes[workloadType] || 1;
        
        // Scale with available VRAM
        if (vram >= 80) return baseBatch * 4;
        if (vram >= 48) return baseBatch * 2;
        if (vram >= 24) return baseBatch;
        return Math.max(1, Math.floor(baseBatch / 2));
    }

    /**
     * Get cost estimate for a workload duration
     */
    estimateCost(
        requirement: GPURequirement,
        durationHours: number,
        includeOverhead: boolean = true
    ): {
        baseCost: number;
        overheadCost: number;
        totalCost: number;
        breakdown: Array<{ item: string; cost: number }>;
    } {
        const baseCost = requirement.estimatedCostPerHour * durationHours;
        
        // Overhead for cold starts, failed attempts, etc.
        const overheadMultiplier = includeOverhead ? 1.2 : 1.0;
        const overheadCost = baseCost * (overheadMultiplier - 1);
        
        const breakdown = [
            { item: 'GPU Compute', cost: baseCost },
        ];

        if (requirement.distributedRequired && requirement.distributedGPUCount) {
            breakdown.push({
                item: `Network (${requirement.distributedGPUCount} GPUs)`,
                cost: baseCost * 0.05,
            });
        }

        if (includeOverhead) {
            breakdown.push({ item: 'Overhead Buffer (cold starts, retries)', cost: overheadCost });
        }

        return {
            baseCost,
            overheadCost,
            totalCost: breakdown.reduce((sum, item) => sum + item.cost, 0),
            breakdown,
        };
    }
}

/**
 * Create a GPU Requirement Estimator instance
 */
export function createGPURequirementEstimator(hfToken?: string): GPURequirementEstimator {
    return new GPURequirementEstimator(hfToken);
}

/**
 * Quick helper to estimate requirements for a model
 */
export async function estimateGPURequirements(
    modelId: string,
    workloadType: GPUWorkloadType,
    options?: {
        quantization?: QuantizationType;
        batchSize?: number;
        hfToken?: string;
    }
): Promise<GPURequirement> {
    const estimator = createGPURequirementEstimator(options?.hfToken);
    const analysis = await estimator.analyzeModel(modelId);
    return estimator.estimateRequirements(analysis, workloadType, options);
}
