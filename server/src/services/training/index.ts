/**
 * Training Services - Multi-Modal Model Fine-Tuning Platform
 *
 * Barrel export for training services.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import type {
  LLMTrainingConfig,
  ImageTrainingConfig,
  VideoTrainingConfig,
  AudioTrainingConfig,
} from './types.js';

// Types
export * from './types.js';

// GPU Recommender
export {
  GPURecommender,
  getGPURecommender,
  GPU_SPECS,
  type GPUSpec,
} from './gpu-recommender.js';

// Multi-Modal Training Orchestrator
export {
  MultiModalTrainingOrchestrator,
  getMultiModalTrainingOrchestrator,
} from './multi-modal-orchestrator.js';

// Container Images Registry
export {
  getContainerImage as getTrainingContainerImage,
  getContainerVRAMOverhead,
  getRecommendedDiskSize,
  LLM_CONTAINERS,
  IMAGE_CONTAINERS,
  VIDEO_CONTAINERS,
  AUDIO_CONTAINERS,
} from './container-images.js';

// Trainers
export {
  createTrainer,
  generateTrainerConfig,
  getTrainingScript,
  getDatasetScript,
  estimateVRAM,
  ImageTrainer,
  VideoTrainer,
  AudioTrainer,
  LLMTrainer,
  SUPPORTED_METHODS,
  RECOMMENDED_MODELS,
  TRAINING_PRESETS,
} from './trainers/index.js';

// HuggingFace Upload Service
export {
  HuggingFaceUploadService,
  getHuggingFaceUploadService,
  type HFUploadConfig,
  type HFUploadResult,
  type ModelCard,
  type HFRepoInfo,
} from './huggingface-upload.js';

// Model Preservation Service
export {
  ModelPreservationService,
  getModelPreservationService,
  type ModelVersion,
  type PreservationConfig,
  type StorageInfo,
  type ModelRegistry,
  type PreservationResult,
} from './model-preservation.js';

// Training Completion Handler
export {
  TrainingCompletionHandler,
  getTrainingCompletionHandler,
  type CompletionConfig,
  type CompletionResult,
  type CompletionEvent,
} from './completion-handler.js';

// =============================================================================
// DEFAULT CONFIGURATIONS
// =============================================================================

/**
 * Default configuration for LLM fine-tuning
 */
export const DEFAULT_LLM_CONFIG: Partial<LLMTrainingConfig> = {
  epochs: 3,
  learningRate: 2e-5,
  batchSize: 4,
  gradientAccumulationSteps: 4,
  warmupSteps: 100,
  maxSeqLength: 2048,
  loraConfig: {
    rank: 16,
    alpha: 32,
    dropout: 0.05,
    targetModules: ['q_proj', 'k_proj', 'v_proj', 'o_proj'],
  },
};

/**
 * Default configuration for Image training (LoRA/DreamBooth)
 */
export const DEFAULT_IMAGE_CONFIG: Partial<ImageTrainingConfig> = {
  baseModel: 'sdxl',
  steps: 1000,
  learningRate: 1e-4,
  batchSize: 1,
  resolution: 1024,
  loraConfig: {
    rank: 8,
    alpha: 16,
    networkDim: 16,
    networkAlpha: 16,
  },
  gradientCheckpointing: true,
  textEncoderTraining: true,
};

/**
 * Default configuration for Video training
 */
export const DEFAULT_VIDEO_CONFIG: Partial<VideoTrainingConfig> = {
  baseModel: 'wan',
  steps: 500,
  learningRate: 1e-5,
  batchSize: 1,
  frameCount: 24,
  resolution: { width: 720, height: 480 },
  loraConfig: {
    rank: 4,
    alpha: 8,
  },
};

/**
 * Default configuration for Audio training
 */
export const DEFAULT_AUDIO_CONFIG: Partial<AudioTrainingConfig> = {
  baseModel: 'xtts2',
  steps: 1000,
  learningRate: 1e-5,
  sampleRate: 22050,
};
