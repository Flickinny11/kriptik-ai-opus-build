/**
 * Training Method Recommender - Flagship Training & Fine-Tuning
 *
 * Analyzes parsed training intent and recommends optimal training method(s)
 * and configuration. Supports flagship-level multi-stage pipelines.
 *
 * Part of KripTik AI's Flagship Training Module
 */

import {
  TrainingCapability,
  TrainingMethod,
  QualityTier,
  TrainingContract,
  TrainingMethodRecommendation,
} from './training-intent-lock.js';

// =============================================================================
// TYPES
// =============================================================================

export interface TrainingStage {
  name: string;
  method: TrainingMethod;
  config: Record<string, unknown>;
  estimatedHours: number;
  gpuRequirement: string;
  dependencies: string[];
  outputArtifact: string;
}

export interface TrainingPipeline {
  id: string;
  name: string;
  description: string;
  tier: QualityTier;
  stages: TrainingStage[];
  totalEstimatedHours: number;
  requiredGPU: string;
  estimatedCost: { min: number; max: number; currency: 'USD' };
  capabilities: TrainingCapability[];
}

export interface MethodConfig {
  method: TrainingMethod;
  hyperparameters: Record<string, unknown>;
  gpuRequirements: {
    minVram: number;
    recommendedVram: number;
    minGpuCount: number;
  };
  estimatedHoursPerBillionParams: number;
  supported: {
    modalities: TrainingCapability[];
    frameworks: string[];
  };
}

// =============================================================================
// FLAGSHIP PIPELINES
// =============================================================================

const FLAGSHIP_MUSIC_PIPELINE: TrainingPipeline = {
  id: 'flagship-music-generation',
  name: 'Flagship Music Generation Pipeline',
  description: 'Multi-stage training for Suno-quality music generation',
  tier: 'flagship',
  stages: [
    {
      name: 'Base Model Preparation',
      method: 'full_finetune_deepspeed',
      config: {
        zeroStage: 3,
        gradientCheckpointing: true,
        offloadOptimizer: false,
        offloadParameters: false,
        overlapComm: true,
      },
      estimatedHours: 48,
      gpuRequirement: 'H100 x8',
      dependencies: [],
      outputArtifact: 'base-finetuned-checkpoint',
    },
    {
      name: 'Style Specialization',
      method: 'lora',
      config: {
        rank: 64,
        alpha: 128,
        targetModules: ['attention.query', 'attention.key', 'attention.value', 'attention.output', 'feedforward.dense_h_to_4h', 'feedforward.dense_4h_to_h'],
        dropout: 0.05,
        useRslora: true,
      },
      estimatedHours: 12,
      gpuRequirement: 'A100-80GB x4',
      dependencies: ['base-finetuned-checkpoint'],
      outputArtifact: 'style-adapted-checkpoint',
    },
    {
      name: 'Quality Alignment',
      method: 'dpo',
      config: {
        beta: 0.1,
        referenceFree: false,
        labelSmoothing: 0.0,
        lossType: 'sigmoid',
        maxLength: 8192,
        maxPromptLength: 2048,
      },
      estimatedHours: 24,
      gpuRequirement: 'A100-80GB x4',
      dependencies: ['style-adapted-checkpoint'],
      outputArtifact: 'dpo-aligned-checkpoint',
    },
    {
      name: 'Human Preference Tuning',
      method: 'rlhf_ppo',
      config: {
        rewardModel: 'music-quality-reward-v1',
        klCoefficient: 0.1,
        gamma: 1.0,
        lambda: 0.95,
        clipRange: 0.2,
        valueClipRange: 0.2,
        epochs: 4,
        batchSize: 32,
        miniBatchSize: 8,
      },
      estimatedHours: 36,
      gpuRequirement: 'H100 x8',
      dependencies: ['dpo-aligned-checkpoint'],
      outputArtifact: 'final-music-model',
    },
  ],
  totalEstimatedHours: 120,
  requiredGPU: 'H100_CLUSTER_8',
  estimatedCost: { min: 2500, max: 4000, currency: 'USD' },
  capabilities: ['music_generation'],
};

const FLAGSHIP_VIDEO_PIPELINE: TrainingPipeline = {
  id: 'flagship-video-generation',
  name: 'Flagship Video Generation Pipeline',
  description: 'Multi-stage training for Veo-quality video generation',
  tier: 'flagship',
  stages: [
    {
      name: 'Temporal Adapter Training',
      method: 'temporal_adaptation',
      config: {
        frameCount: 120,
        fps: 24,
        temporalAttentionType: 'causal',
        motionConditioningScale: 1.0,
        useMotionModule: true,
      },
      estimatedHours: 72,
      gpuRequirement: 'A100-80GB x8',
      dependencies: [],
      outputArtifact: 'temporal-adapted-checkpoint',
    },
    {
      name: 'MoE Expert Specialization',
      method: 'moe_diffusion',
      config: {
        numExperts: 8,
        topK: 2,
        noiseSpecialization: true,
        expertCapacity: 1.25,
        routerZLoss: 0.001,
        balanceLoss: 0.01,
        expertDropout: 0.1,
      },
      estimatedHours: 96,
      gpuRequirement: 'A100-80GB x8',
      dependencies: ['temporal-adapted-checkpoint'],
      outputArtifact: 'moe-specialized-checkpoint',
    },
    {
      name: 'Quality Alignment',
      method: 'dpo',
      config: {
        beta: 0.05,
        videoSpecific: true,
        frameComparisonType: 'temporal_window',
        temporalConsistencyWeight: 0.5,
        maxFrames: 64,
      },
      estimatedHours: 48,
      gpuRequirement: 'A100-80GB x4',
      dependencies: ['moe-specialized-checkpoint'],
      outputArtifact: 'final-video-model',
    },
  ],
  totalEstimatedHours: 216,
  requiredGPU: 'A100_80GB_CLUSTER_8',
  estimatedCost: { min: 5000, max: 8000, currency: 'USD' },
  capabilities: ['video_generation'],
};

const FLAGSHIP_LLM_PIPELINE: TrainingPipeline = {
  id: 'flagship-llm',
  name: 'Flagship LLM Pipeline',
  description: 'Multi-stage training for GPT-4-quality language model',
  tier: 'flagship',
  stages: [
    {
      name: 'Continued Pre-training',
      method: 'full_finetune_deepspeed',
      config: {
        zeroStage: 3,
        gradientCheckpointing: true,
        gradientAccumulationSteps: 16,
        warmupRatio: 0.03,
        learningRate: 1e-5,
        weightDecay: 0.01,
        maxGradNorm: 1.0,
      },
      estimatedHours: 96,
      gpuRequirement: 'H100 x8',
      dependencies: [],
      outputArtifact: 'cpt-checkpoint',
    },
    {
      name: 'Supervised Fine-tuning',
      method: 'dora',
      config: {
        rank: 64,
        alpha: 128,
        doraSimple: false,
        useMagnitude: true,
        targetModules: ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'],
      },
      estimatedHours: 24,
      gpuRequirement: 'A100-80GB x4',
      dependencies: ['cpt-checkpoint'],
      outputArtifact: 'sft-checkpoint',
    },
    {
      name: 'Direct Preference Optimization',
      method: 'dpo',
      config: {
        beta: 0.1,
        referenceFree: false,
        syncRefModel: true,
        rpoAlpha: 0.5,
      },
      estimatedHours: 36,
      gpuRequirement: 'A100-80GB x4',
      dependencies: ['sft-checkpoint'],
      outputArtifact: 'dpo-checkpoint',
    },
    {
      name: 'RLHF with PPO',
      method: 'rlhf_ppo',
      config: {
        rewardModel: 'custom-preference-reward',
        klCoefficient: 0.05,
        gamma: 1.0,
        lambda: 0.95,
        clipRange: 0.2,
        epochs: 4,
        scoringFunction: 'preference_model',
      },
      estimatedHours: 48,
      gpuRequirement: 'H100 x8',
      dependencies: ['dpo-checkpoint'],
      outputArtifact: 'final-llm-model',
    },
  ],
  totalEstimatedHours: 204,
  requiredGPU: 'H100_CLUSTER_8',
  estimatedCost: { min: 4000, max: 7000, currency: 'USD' },
  capabilities: ['text_generation', 'chat', 'code_generation'],
};

const FLAGSHIP_IMAGE_PIPELINE: TrainingPipeline = {
  id: 'flagship-image-generation',
  name: 'Flagship Image Generation Pipeline',
  description: 'Multi-stage training for Midjourney-quality image generation',
  tier: 'flagship',
  stages: [
    {
      name: 'Style Fine-tuning',
      method: 'dreambooth',
      config: {
        instancePrompt: 'in the style of [trigger]',
        classPrompt: 'a high quality image',
        numClassImages: 200,
        priorPreservationWeight: 1.0,
        learningRate: 1e-6,
        useXformers: true,
      },
      estimatedHours: 8,
      gpuRequirement: 'A100-40GB',
      dependencies: [],
      outputArtifact: 'dreambooth-checkpoint',
    },
    {
      name: 'Quality Enhancement',
      method: 'dora',
      config: {
        rank: 128,
        alpha: 256,
        targetModules: ['to_q', 'to_k', 'to_v', 'to_out.0', 'ff.net.0.proj', 'ff.net.2'],
        trainTextEncoder: true,
      },
      estimatedHours: 16,
      gpuRequirement: 'A100-80GB x2',
      dependencies: ['dreambooth-checkpoint'],
      outputArtifact: 'dora-enhanced-checkpoint',
    },
    {
      name: 'Preference Alignment',
      method: 'dpo',
      config: {
        beta: 0.1,
        imageSpecific: true,
        aestheticWeight: 0.7,
        promptAlignmentWeight: 0.3,
      },
      estimatedHours: 24,
      gpuRequirement: 'A100-80GB x4',
      dependencies: ['dora-enhanced-checkpoint'],
      outputArtifact: 'final-image-model',
    },
  ],
  totalEstimatedHours: 48,
  requiredGPU: 'A100_80GB_CLUSTER_4',
  estimatedCost: { min: 1000, max: 2000, currency: 'USD' },
  capabilities: ['image_generation'],
};

const FLAGSHIP_VOICE_PIPELINE: TrainingPipeline = {
  id: 'flagship-voice-cloning',
  name: 'Flagship Voice Cloning Pipeline',
  description: 'High-fidelity voice cloning with natural expression',
  tier: 'flagship',
  stages: [
    {
      name: 'Speaker Embedding Training',
      method: 'voice_clone',
      config: {
        speakerEmbeddingDim: 512,
        referenceAudioMinLength: 10,
        referenceAudioMaxLength: 60,
        numReferenceClips: 10,
        useWav2Vec: true,
      },
      estimatedHours: 4,
      gpuRequirement: 'A40',
      dependencies: [],
      outputArtifact: 'speaker-embedding-checkpoint',
    },
    {
      name: 'Voice Adapter Training',
      method: 'lora',
      config: {
        rank: 32,
        alpha: 64,
        targetModules: ['speaker_encoder', 'text_encoder', 'decoder'],
        voiceConditioningScale: 1.5,
      },
      estimatedHours: 8,
      gpuRequirement: 'A100-40GB',
      dependencies: ['speaker-embedding-checkpoint'],
      outputArtifact: 'voice-adapter-checkpoint',
    },
    {
      name: 'Expression Fine-tuning',
      method: 'full_finetune',
      config: {
        expressionControl: true,
        emotionLabels: ['neutral', 'happy', 'sad', 'angry', 'surprised'],
        prosodyWeight: 0.5,
      },
      estimatedHours: 12,
      gpuRequirement: 'A100-40GB',
      dependencies: ['voice-adapter-checkpoint'],
      outputArtifact: 'final-voice-model',
    },
  ],
  totalEstimatedHours: 24,
  requiredGPU: 'A100_40GB',
  estimatedCost: { min: 200, max: 500, currency: 'USD' },
  capabilities: ['voice_cloning'],
};

// Collection of all flagship pipelines
const FLAGSHIP_PIPELINES: TrainingPipeline[] = [
  FLAGSHIP_MUSIC_PIPELINE,
  FLAGSHIP_VIDEO_PIPELINE,
  FLAGSHIP_LLM_PIPELINE,
  FLAGSHIP_IMAGE_PIPELINE,
  FLAGSHIP_VOICE_PIPELINE,
];

// =============================================================================
// METHOD CONFIGURATIONS
// =============================================================================

const METHOD_CONFIGS: Record<TrainingMethod, MethodConfig> = {
  // PEFT Methods
  lora: {
    method: 'lora',
    hyperparameters: { rank: 16, alpha: 32, dropout: 0.05 },
    gpuRequirements: { minVram: 8, recommendedVram: 16, minGpuCount: 1 },
    estimatedHoursPerBillionParams: 0.5,
    supported: {
      modalities: ['text_generation', 'code_generation', 'chat', 'image_generation', 'video_generation', 'music_generation', 'voice_cloning', 'multimodal'],
      frameworks: ['transformers', 'peft', 'diffusers'],
    },
  },
  qlora: {
    method: 'qlora',
    hyperparameters: { rank: 16, alpha: 32, dropout: 0.05, bits: 4, doubleQuant: true, quantType: 'nf4' },
    gpuRequirements: { minVram: 6, recommendedVram: 12, minGpuCount: 1 },
    estimatedHoursPerBillionParams: 0.6,
    supported: {
      modalities: ['text_generation', 'code_generation', 'chat'],
      frameworks: ['transformers', 'peft', 'bitsandbytes'],
    },
  },
  dora: {
    method: 'dora',
    hyperparameters: { rank: 32, alpha: 64, useMagnitude: true },
    gpuRequirements: { minVram: 12, recommendedVram: 24, minGpuCount: 1 },
    estimatedHoursPerBillionParams: 0.7,
    supported: {
      modalities: ['text_generation', 'code_generation', 'chat', 'image_generation', 'multimodal'],
      frameworks: ['transformers', 'peft'],
    },
  },
  qdora: {
    method: 'qdora',
    hyperparameters: { rank: 32, alpha: 64, useMagnitude: true, bits: 4, quantType: 'nf4' },
    gpuRequirements: { minVram: 8, recommendedVram: 16, minGpuCount: 1 },
    estimatedHoursPerBillionParams: 0.8,
    supported: {
      modalities: ['text_generation', 'code_generation', 'chat'],
      frameworks: ['transformers', 'peft', 'bitsandbytes'],
    },
  },
  adalora: {
    method: 'adalora',
    hyperparameters: { initRank: 12, targetRank: 8, deltaT: 10, beta1: 0.85, beta2: 0.85 },
    gpuRequirements: { minVram: 10, recommendedVram: 20, minGpuCount: 1 },
    estimatedHoursPerBillionParams: 0.7,
    supported: {
      modalities: ['text_generation', 'code_generation', 'chat'],
      frameworks: ['transformers', 'peft'],
    },
  },
  vera: {
    method: 'vera',
    hyperparameters: { rank: 256, scalingRank: 256, saveProjOnlyFirst: true },
    gpuRequirements: { minVram: 6, recommendedVram: 12, minGpuCount: 1 },
    estimatedHoursPerBillionParams: 0.4,
    supported: {
      modalities: ['text_generation', 'code_generation'],
      frameworks: ['transformers', 'peft'],
    },
  },
  relora: {
    method: 'relora',
    hyperparameters: { rank: 128, mergeFrequency: 500, warmupUpdates: 100 },
    gpuRequirements: { minVram: 16, recommendedVram: 32, minGpuCount: 1 },
    estimatedHoursPerBillionParams: 1.5,
    supported: {
      modalities: ['text_generation'],
      frameworks: ['transformers'],
    },
  },
  mora: {
    method: 'mora',
    hyperparameters: { numAdapters: 4, rank: 16, routerType: 'topk' },
    gpuRequirements: { minVram: 16, recommendedVram: 32, minGpuCount: 1 },
    estimatedHoursPerBillionParams: 0.8,
    supported: {
      modalities: ['text_generation', 'chat'],
      frameworks: ['transformers', 'peft'],
    },
  },
  galore: {
    method: 'galore',
    hyperparameters: { rank: 512, updateProjGap: 200, scale: 1.0 },
    gpuRequirements: { minVram: 8, recommendedVram: 16, minGpuCount: 1 },
    estimatedHoursPerBillionParams: 0.9,
    supported: {
      modalities: ['text_generation', 'code_generation'],
      frameworks: ['transformers'],
    },
  },
  longlora: {
    method: 'longlora',
    hyperparameters: { maxLength: 32768, shiftedSparseAttention: true, groupSize: 4 },
    gpuRequirements: { minVram: 24, recommendedVram: 48, minGpuCount: 1 },
    estimatedHoursPerBillionParams: 1.2,
    supported: {
      modalities: ['text_generation', 'chat'],
      frameworks: ['transformers', 'peft'],
    },
  },

  // Full Training
  full_finetune: {
    method: 'full_finetune',
    hyperparameters: { learningRate: 2e-5, weightDecay: 0.01, warmupRatio: 0.03 },
    gpuRequirements: { minVram: 40, recommendedVram: 80, minGpuCount: 1 },
    estimatedHoursPerBillionParams: 3,
    supported: {
      modalities: ['text_generation', 'code_generation', 'chat', 'embeddings', 'voice_cloning'],
      frameworks: ['transformers', 'accelerate'],
    },
  },
  full_finetune_fsdp: {
    method: 'full_finetune_fsdp',
    hyperparameters: { shardingStrategy: 'FULL_SHARD', cpuOffload: false, backwardPrefetch: 'BACKWARD_PRE' },
    gpuRequirements: { minVram: 40, recommendedVram: 80, minGpuCount: 2 },
    estimatedHoursPerBillionParams: 2.5,
    supported: {
      modalities: ['text_generation', 'code_generation', 'chat'],
      frameworks: ['transformers', 'accelerate', 'pytorch'],
    },
  },
  full_finetune_deepspeed: {
    method: 'full_finetune_deepspeed',
    hyperparameters: { zeroStage: 3, gradientCheckpointing: true, offloadOptimizer: false },
    gpuRequirements: { minVram: 40, recommendedVram: 80, minGpuCount: 4 },
    estimatedHoursPerBillionParams: 2,
    supported: {
      modalities: ['text_generation', 'code_generation', 'chat', 'music_generation'],
      frameworks: ['transformers', 'deepspeed'],
    },
  },

  // Alignment Methods
  dpo: {
    method: 'dpo',
    hyperparameters: { beta: 0.1, referenceFree: false, lossType: 'sigmoid' },
    gpuRequirements: { minVram: 24, recommendedVram: 48, minGpuCount: 1 },
    estimatedHoursPerBillionParams: 1.5,
    supported: {
      modalities: ['text_generation', 'code_generation', 'chat', 'image_generation', 'video_generation'],
      frameworks: ['trl', 'transformers'],
    },
  },
  orpo: {
    method: 'orpo',
    hyperparameters: { lambda: 0.1, alpha: 0.5 },
    gpuRequirements: { minVram: 24, recommendedVram: 48, minGpuCount: 1 },
    estimatedHoursPerBillionParams: 1.2,
    supported: {
      modalities: ['text_generation', 'chat'],
      frameworks: ['trl', 'transformers'],
    },
  },
  rlhf_ppo: {
    method: 'rlhf_ppo',
    hyperparameters: { klCoefficient: 0.1, gamma: 1.0, lambda: 0.95, clipRange: 0.2 },
    gpuRequirements: { minVram: 48, recommendedVram: 80, minGpuCount: 4 },
    estimatedHoursPerBillionParams: 4,
    supported: {
      modalities: ['text_generation', 'chat', 'music_generation'],
      frameworks: ['trl', 'openrlhf'],
    },
  },
  grpo: {
    method: 'grpo',
    hyperparameters: { groupSize: 8, temperature: 1.0 },
    gpuRequirements: { minVram: 48, recommendedVram: 80, minGpuCount: 2 },
    estimatedHoursPerBillionParams: 2.5,
    supported: {
      modalities: ['text_generation', 'chat'],
      frameworks: ['trl'],
    },
  },
  rlvr: {
    method: 'rlvr',
    hyperparameters: { verifier: 'code_execution', rewardType: 'binary' },
    gpuRequirements: { minVram: 40, recommendedVram: 80, minGpuCount: 2 },
    estimatedHoursPerBillionParams: 3,
    supported: {
      modalities: ['code_generation'],
      frameworks: ['trl', 'openrlhf'],
    },
  },
  rlaif: {
    method: 'rlaif',
    hyperparameters: { judgeModel: 'claude-3-opus', feedbackType: 'preference' },
    gpuRequirements: { minVram: 40, recommendedVram: 80, minGpuCount: 2 },
    estimatedHoursPerBillionParams: 3.5,
    supported: {
      modalities: ['text_generation', 'chat'],
      frameworks: ['trl'],
    },
  },
  constitutional_ai: {
    method: 'constitutional_ai',
    hyperparameters: { principles: [], critiqueModel: 'self', revisionIterations: 3 },
    gpuRequirements: { minVram: 40, recommendedVram: 80, minGpuCount: 2 },
    estimatedHoursPerBillionParams: 4,
    supported: {
      modalities: ['text_generation', 'chat'],
      frameworks: ['trl'],
    },
  },

  // Distributed
  deepspeed_zero1: {
    method: 'deepspeed_zero1',
    hyperparameters: { stage: 1, overlapComm: true },
    gpuRequirements: { minVram: 24, recommendedVram: 40, minGpuCount: 2 },
    estimatedHoursPerBillionParams: 2.5,
    supported: {
      modalities: ['text_generation', 'code_generation'],
      frameworks: ['deepspeed'],
    },
  },
  deepspeed_zero2: {
    method: 'deepspeed_zero2',
    hyperparameters: { stage: 2, overlapComm: true, allgatherPartitions: true },
    gpuRequirements: { minVram: 24, recommendedVram: 40, minGpuCount: 4 },
    estimatedHoursPerBillionParams: 2.2,
    supported: {
      modalities: ['text_generation', 'code_generation'],
      frameworks: ['deepspeed'],
    },
  },
  deepspeed_zero3: {
    method: 'deepspeed_zero3',
    hyperparameters: { stage: 3, overlapComm: true, contiguousGradients: true },
    gpuRequirements: { minVram: 24, recommendedVram: 80, minGpuCount: 8 },
    estimatedHoursPerBillionParams: 2,
    supported: {
      modalities: ['text_generation', 'code_generation', 'chat'],
      frameworks: ['deepspeed'],
    },
  },
  deepspeed_infinity: {
    method: 'deepspeed_infinity',
    hyperparameters: { stage: 3, offloadOptimizer: true, offloadParam: true, nvmeOffload: true },
    gpuRequirements: { minVram: 24, recommendedVram: 48, minGpuCount: 4 },
    estimatedHoursPerBillionParams: 4,
    supported: {
      modalities: ['text_generation'],
      frameworks: ['deepspeed'],
    },
  },
  fsdp: {
    method: 'fsdp',
    hyperparameters: { shardingStrategy: 'FULL_SHARD', mixedPrecision: 'bf16' },
    gpuRequirements: { minVram: 40, recommendedVram: 80, minGpuCount: 2 },
    estimatedHoursPerBillionParams: 2.3,
    supported: {
      modalities: ['text_generation', 'code_generation', 'chat'],
      frameworks: ['pytorch', 'accelerate'],
    },
  },
  megatron_lm: {
    method: 'megatron_lm',
    hyperparameters: { tensorParallel: 4, pipelineParallel: 2, sequenceParallel: true },
    gpuRequirements: { minVram: 80, recommendedVram: 80, minGpuCount: 8 },
    estimatedHoursPerBillionParams: 1.5,
    supported: {
      modalities: ['text_generation'],
      frameworks: ['megatron-lm'],
    },
  },
  '3d_parallelism': {
    method: '3d_parallelism',
    hyperparameters: { dataParallel: 8, tensorParallel: 4, pipelineParallel: 4 },
    gpuRequirements: { minVram: 80, recommendedVram: 80, minGpuCount: 64 },
    estimatedHoursPerBillionParams: 1,
    supported: {
      modalities: ['text_generation'],
      frameworks: ['megatron-lm', 'deepspeed'],
    },
  },

  // Specialized
  moe_diffusion: {
    method: 'moe_diffusion',
    hyperparameters: { numExperts: 8, topK: 2, noiseSpecialization: true },
    gpuRequirements: { minVram: 48, recommendedVram: 80, minGpuCount: 4 },
    estimatedHoursPerBillionParams: 3,
    supported: {
      modalities: ['image_generation', 'video_generation'],
      frameworks: ['diffusers'],
    },
  },
  dreambooth: {
    method: 'dreambooth',
    hyperparameters: { instancePrompt: '', classPrompt: '', priorPreservation: true },
    gpuRequirements: { minVram: 16, recommendedVram: 24, minGpuCount: 1 },
    estimatedHoursPerBillionParams: 0.5,
    supported: {
      modalities: ['image_generation'],
      frameworks: ['diffusers'],
    },
  },
  textual_inversion: {
    method: 'textual_inversion',
    hyperparameters: { numVectors: 1, initializerToken: '*' },
    gpuRequirements: { minVram: 8, recommendedVram: 16, minGpuCount: 1 },
    estimatedHoursPerBillionParams: 0.3,
    supported: {
      modalities: ['image_generation'],
      frameworks: ['diffusers'],
    },
  },
  voice_clone: {
    method: 'voice_clone',
    hyperparameters: { referenceAudioLength: 30, speakerEmbeddingDim: 256 },
    gpuRequirements: { minVram: 8, recommendedVram: 16, minGpuCount: 1 },
    estimatedHoursPerBillionParams: 0.4,
    supported: {
      modalities: ['voice_cloning'],
      frameworks: ['xtts', 'bark'],
    },
  },
  temporal_adaptation: {
    method: 'temporal_adaptation',
    hyperparameters: { frameCount: 48, temporalAttention: true },
    gpuRequirements: { minVram: 48, recommendedVram: 80, minGpuCount: 4 },
    estimatedHoursPerBillionParams: 2.5,
    supported: {
      modalities: ['video_generation'],
      frameworks: ['diffusers'],
    },
  },

  // Hybrid
  hybrid_lora_dpo: {
    method: 'hybrid_lora_dpo',
    hyperparameters: { loraRank: 32, loraAlpha: 64, dpoBeta: 0.1 },
    gpuRequirements: { minVram: 24, recommendedVram: 48, minGpuCount: 2 },
    estimatedHoursPerBillionParams: 2,
    supported: {
      modalities: ['text_generation', 'code_generation', 'chat'],
      frameworks: ['trl', 'peft'],
    },
  },
  hybrid_full_rlhf: {
    method: 'hybrid_full_rlhf',
    hyperparameters: { sftEpochs: 3, dpoEpochs: 1, rlhfEpochs: 2 },
    gpuRequirements: { minVram: 80, recommendedVram: 80, minGpuCount: 8 },
    estimatedHoursPerBillionParams: 8,
    supported: {
      modalities: ['text_generation', 'chat', 'music_generation'],
      frameworks: ['trl', 'openrlhf', 'deepspeed'],
    },
  },
  hybrid_moe_alignment: {
    method: 'hybrid_moe_alignment',
    hyperparameters: { numExperts: 8, alignmentMethod: 'dpo' },
    gpuRequirements: { minVram: 80, recommendedVram: 80, minGpuCount: 8 },
    estimatedHoursPerBillionParams: 10,
    supported: {
      modalities: ['music_generation', 'video_generation'],
      frameworks: ['deepspeed', 'diffusers'],
    },
  },
};

// =============================================================================
// TRAINING METHOD RECOMMENDER
// =============================================================================

export class TrainingMethodRecommender {
  /**
   * Recommend training methods for a contract
   */
  recommendMethods(contract: TrainingContract): TrainingMethodRecommendation[] {
    const { targetCapability, qualityTier, gpuRequirements } = contract;

    // Check for flagship pipeline
    if (qualityTier === 'flagship' || qualityTier === 'research') {
      const pipeline = this.findFlagshipPipeline(targetCapability);
      if (pipeline) {
        return this.pipelineToRecommendations(pipeline);
      }
    }

    // Build recommendations based on tier
    return this.buildTierRecommendations(targetCapability, qualityTier, gpuRequirements.recommendedVram);
  }

  /**
   * Get a specific training pipeline
   */
  getPipeline(pipelineId: string): TrainingPipeline | undefined {
    return FLAGSHIP_PIPELINES.find(p => p.id === pipelineId);
  }

  /**
   * Get all pipelines for a capability
   */
  getPipelinesForCapability(capability: TrainingCapability): TrainingPipeline[] {
    return FLAGSHIP_PIPELINES.filter(p => p.capabilities.includes(capability));
  }

  /**
   * Get method configuration
   */
  getMethodConfig(method: TrainingMethod): MethodConfig | undefined {
    return METHOD_CONFIGS[method];
  }

  /**
   * Estimate training time for a method
   */
  estimateTrainingTime(method: TrainingMethod, modelSizeB: number, tier: QualityTier): number {
    const config = METHOD_CONFIGS[method];
    if (!config) return 0;

    const baseHours = config.estimatedHoursPerBillionParams * modelSizeB;
    const tierMultiplier = { consumer: 0.8, professional: 1, flagship: 1.5, research: 2 };

    return Math.round(baseHours * tierMultiplier[tier]);
  }

  /**
   * Estimate training cost
   */
  estimateTrainingCost(
    method: TrainingMethod,
    hours: number,
    gpuType: string,
    gpuCount: number
  ): { min: number; max: number } {
    const gpuCosts: Record<string, number> = {
      'RTX 4090': 0.69,
      'A40': 0.79,
      'L40S': 1.14,
      'A100-40GB': 1.89,
      'A100-80GB': 2.49,
      'H100': 3.99,
    };

    const costPerHour = (gpuCosts[gpuType] || 2.49) * gpuCount;
    const baseCost = hours * costPerHour;

    return {
      min: Math.round(baseCost * 0.8),
      max: Math.round(baseCost * 1.2),
    };
  }

  /**
   * Find flagship pipeline for a capability
   */
  private findFlagshipPipeline(capability: TrainingCapability): TrainingPipeline | undefined {
    return FLAGSHIP_PIPELINES.find(p => p.capabilities.includes(capability));
  }

  /**
   * Convert pipeline to recommendations
   */
  private pipelineToRecommendations(pipeline: TrainingPipeline): TrainingMethodRecommendation[] {
    // Primary recommendation is the full pipeline
    const recommendations: TrainingMethodRecommendation[] = [
      {
        method: pipeline.stages[pipeline.stages.length - 1].method,
        tier: pipeline.tier,
        displayName: pipeline.name,
        description: pipeline.description,
        reasoning: `Multi-stage pipeline: ${pipeline.stages.map(s => s.name).join(' → ')}`,
        estimatedHours: pipeline.totalEstimatedHours,
        estimatedCostUsd: pipeline.estimatedCost,
        gpuRequirement: pipeline.requiredGPU,
        confidence: 0.95,
      },
    ];

    // Add individual stage methods as alternatives
    for (const stage of pipeline.stages) {
      const config = METHOD_CONFIGS[stage.method];
      if (config) {
        recommendations.push({
          method: stage.method,
          tier: 'professional',
          displayName: config.method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          description: `${stage.name} stage only`,
          reasoning: `Standalone ${stage.name} without full pipeline`,
          estimatedHours: stage.estimatedHours,
          estimatedCostUsd: this.estimateTrainingCost(stage.method, stage.estimatedHours, 'A100-80GB', 4),
          gpuRequirement: stage.gpuRequirement,
          confidence: 0.75,
        });
      }
    }

    return recommendations;
  }

  /**
   * Build tier-based recommendations
   */
  private buildTierRecommendations(
    capability: TrainingCapability,
    tier: QualityTier,
    availableVram: number
  ): TrainingMethodRecommendation[] {
    const recommendations: TrainingMethodRecommendation[] = [];

    // Filter methods by capability and VRAM
    const compatibleMethods = Object.entries(METHOD_CONFIGS).filter(([, config]) => {
      const supportsCapability = config.supported.modalities.includes(capability) ||
        config.supported.modalities.includes('text_generation'); // Fallback
      const hasEnoughVram = config.gpuRequirements.minVram <= availableVram;
      return supportsCapability && hasEnoughVram;
    });

    // Sort by tier appropriateness
    const tierPriority: Record<QualityTier, TrainingMethod[]> = {
      consumer: ['qlora', 'lora', 'vera', 'textual_inversion'],
      professional: ['dora', 'qdora', 'hybrid_lora_dpo', 'dpo', 'dreambooth'],
      flagship: ['hybrid_full_rlhf', 'full_finetune_deepspeed', 'dpo', 'moe_diffusion'],
      research: ['3d_parallelism', 'megatron_lm', 'hybrid_moe_alignment'],
    };

    const priorityMethods = tierPriority[tier];

    for (const method of priorityMethods) {
      const config = METHOD_CONFIGS[method];
      if (!config) continue;

      const compatible = compatibleMethods.find(([m]) => m === method);
      if (!compatible) continue;

      const hours = this.estimateTrainingTime(method, 7, tier); // Assume 7B model
      const cost = this.estimateTrainingCost(method, hours, 'A100-40GB', 2);

      recommendations.push({
        method,
        tier,
        displayName: this.formatMethodName(method),
        description: this.getMethodDescription(method),
        reasoning: `Recommended for ${tier} tier ${capability}`,
        estimatedHours: hours,
        estimatedCostUsd: cost,
        gpuRequirement: this.getGpuRecommendation(config.gpuRequirements.recommendedVram),
        confidence: 0.85,
      });
    }

    // Add some alternatives from adjacent tiers
    const adjacentTiers: Record<QualityTier, QualityTier[]> = {
      consumer: ['professional'],
      professional: ['consumer', 'flagship'],
      flagship: ['professional', 'research'],
      research: ['flagship'],
    };

    for (const adjTier of adjacentTiers[tier]) {
      const adjMethods = tierPriority[adjTier].slice(0, 2);
      for (const method of adjMethods) {
        if (recommendations.some(r => r.method === method)) continue;

        const config = METHOD_CONFIGS[method];
        if (!config) continue;

        const hours = this.estimateTrainingTime(method, 7, adjTier);
        const cost = this.estimateTrainingCost(method, hours, 'A100-40GB', 2);

        recommendations.push({
          method,
          tier: adjTier,
          displayName: this.formatMethodName(method),
          description: this.getMethodDescription(method),
          reasoning: `Alternative from ${adjTier} tier`,
          estimatedHours: hours,
          estimatedCostUsd: cost,
          gpuRequirement: this.getGpuRecommendation(config.gpuRequirements.recommendedVram),
          confidence: 0.65,
        });
      }
    }

    return recommendations.slice(0, 5); // Return top 5 recommendations
  }

  private formatMethodName(method: TrainingMethod): string {
    return method
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace('Lora', 'LoRA')
      .replace('Qlora', 'QLoRA')
      .replace('Dora', 'DoRA')
      .replace('Qdora', 'QDoRA')
      .replace('Dpo', 'DPO')
      .replace('Orpo', 'ORPO')
      .replace('Rlhf', 'RLHF')
      .replace('Ppo', 'PPO')
      .replace('Moe', 'MoE')
      .replace('Fsdp', 'FSDP');
  }

  private getMethodDescription(method: TrainingMethod): string {
    const config = METHOD_CONFIGS[method];
    if (!config) return '';

    const descriptions: Record<string, string> = {
      lora: 'Low-rank adaptation for efficient fine-tuning',
      qlora: '4-bit quantized LoRA for memory efficiency',
      dora: 'Weight-decomposed LoRA for improved quality',
      dpo: 'Direct preference optimization without reward model',
      full_finetune: 'Full parameter fine-tuning',
      full_finetune_deepspeed: 'Distributed full fine-tuning with DeepSpeed',
      hybrid_lora_dpo: 'Two-stage LoRA then DPO alignment',
      hybrid_full_rlhf: 'Multi-stage training with RLHF',
      moe_diffusion: 'Mixture of Experts for diffusion models',
      dreambooth: 'Subject-specific image fine-tuning',
      voice_clone: 'Voice cloning with minimal data',
    };

    return descriptions[method] || `${method} training method`;
  }

  private getGpuRecommendation(vramNeeded: number): string {
    if (vramNeeded <= 16) return 'RTX 4090';
    if (vramNeeded <= 24) return 'L40S';
    if (vramNeeded <= 48) return 'A100-40GB';
    return 'A100-80GB';
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createTrainingMethodRecommender(): TrainingMethodRecommender {
  return new TrainingMethodRecommender();
}

export default TrainingMethodRecommender;
