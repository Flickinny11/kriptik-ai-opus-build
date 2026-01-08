/**
 * Training Types - Multi-Modal Training Configuration Types
 *
 * Defines types for LLM, Image, Video, and Audio model fine-tuning.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

// =============================================================================
// CORE TYPES
// =============================================================================

export type ModelModality = 'llm' | 'image' | 'video' | 'audio' | 'multimodal';

export type TrainingMethod =
  | 'full_finetune'
  | 'lora'
  | 'qlora'
  | 'dreambooth'
  | 'textual_inversion'
  | 'controlnet'
  | 'voice_clone'
  | 'style_transfer';

export type TrainingProvider = 'runpod' | 'modal';

// =============================================================================
// DATASET CONFIGURATION
// =============================================================================

export interface DatasetConfig {
  source: 'huggingface' | 'upload' | 'url';
  datasetId?: string;
  uploadedFiles?: string[];
  dataUrl?: string;
  split?: string;
  textColumn?: string;
  imageColumn?: string;
  audioColumn?: string;
  videoColumn?: string;
  captionColumn?: string;
  promptColumn?: string;
  responseColumn?: string;
  format?: 'alpaca' | 'sharegpt' | 'conversation' | 'completion' | 'custom';
  maxSamples?: number;
  validationSplit?: number; // 0-1, percentage for validation
}

// =============================================================================
// GPU CONFIGURATION
// =============================================================================

export interface GPUConfig {
  provider: TrainingProvider;
  gpuType: string;
  gpuCount: number;
  estimatedHours: number;
  estimatedCost: number;
}

// =============================================================================
// BASE TRAINING CONFIG
// =============================================================================

export interface BaseTrainingConfig {
  id: string;
  userId: string;
  projectId?: string;
  modality: ModelModality;
  method: TrainingMethod;
  baseModelId: string;
  baseModelName: string;
  outputModelName: string;
  datasetConfig: DatasetConfig;
  gpuConfig: GPUConfig;
  budgetLimitUsd: number;
  autoSaveToHub: boolean;
  hubRepoName?: string;
  hubPrivate?: boolean;
  description?: string;
  tags?: string[];
}

// =============================================================================
// LLM TRAINING CONFIG
// =============================================================================

export interface LLMTrainingConfig extends BaseTrainingConfig {
  modality: 'llm';
  method: 'lora' | 'qlora' | 'full_finetune';
  epochs: number;
  learningRate: number;
  batchSize: number;
  gradientAccumulationSteps: number;
  warmupSteps: number;
  maxSeqLength: number;
  loraConfig?: {
    rank: number;
    alpha: number;
    dropout: number;
    targetModules: string[];
  };
  quantization?: '4bit' | '8bit' | 'none';
  optimizer?: 'adamw' | 'adamw_8bit' | 'paged_adamw_8bit' | 'sgd';
  scheduler?: 'linear' | 'cosine' | 'constant' | 'polynomial';
  weightDecay?: number;
  gradientCheckpointing?: boolean;
  useFsdp?: boolean; // For multi-GPU training
  useUnsloth?: boolean; // Use Unsloth for 2x faster training
  dpoConfig?: {
    beta: number;
    referenceModel?: string;
  };
}

// =============================================================================
// IMAGE TRAINING CONFIG
// =============================================================================

export type ImageBaseModel = 'sdxl' | 'sd15' | 'sd3' | 'sd35' | 'flux' | 'kandinsky';

export interface ImageTrainingConfig extends BaseTrainingConfig {
  modality: 'image';
  method: 'lora' | 'dreambooth' | 'textual_inversion';
  baseModel: ImageBaseModel;
  steps: number;
  learningRate: number;
  batchSize: number;
  resolution: number;
  loraConfig?: {
    rank: number;
    alpha: number;
    networkDim: number;
    networkAlpha?: number;
  };
  triggerWord?: string;
  instancePrompt?: string;
  classPrompt?: string;
  priorPreservation?: boolean;
  numClassImages?: number;
  centerCrop?: boolean;
  randomFlip?: boolean;
  mixedPrecision?: 'no' | 'fp16' | 'bf16';
  gradientCheckpointing?: boolean;
  textEncoderTraining?: boolean;
  snrGamma?: number;
  noiseOffset?: number;
  cacheLatents?: boolean;
}

// =============================================================================
// VIDEO TRAINING CONFIG
// =============================================================================

export type VideoBaseModel = 'wan' | 'wan2' | 'hunyuan' | 'opensora' | 'opensora2' | 'mochi' | 'skyreels';

export interface VideoTrainingConfig extends BaseTrainingConfig {
  modality: 'video';
  method: 'lora' | 'full_finetune';
  baseModel: VideoBaseModel;
  steps: number;
  learningRate: number;
  batchSize: number;
  frameCount: number;
  resolution: { width: number; height: number };
  fps?: number;
  loraConfig?: {
    rank: number;
    alpha: number;
  };
  temporalDownsample?: number;
  spatialDownsample?: number;
  mixedPrecision?: 'no' | 'fp16' | 'bf16';
  gradientCheckpointing?: boolean;
}

// =============================================================================
// AUDIO TRAINING CONFIG
// =============================================================================

export type AudioBaseModel = 'xtts' | 'xtts2' | 'whisper_speech' | 'bark' | 'musicgen' | 'llasa';

export interface AudioTrainingConfig extends BaseTrainingConfig {
  modality: 'audio';
  method: 'voice_clone' | 'style_transfer' | 'full_finetune';
  baseModel: AudioBaseModel;
  steps: number;
  learningRate: number;
  sampleRate: number;
  voiceSamples?: string[]; // URLs to voice samples
  targetSpeaker?: string;
  language?: string;
  minAudioLength?: number; // seconds
  maxAudioLength?: number; // seconds
  batchSize?: number;
  gradientAccumulationSteps?: number;
  mixedPrecision?: 'no' | 'fp16' | 'bf16';
}

// =============================================================================
// UNION TYPE
// =============================================================================

export type TrainingConfig =
  | LLMTrainingConfig
  | ImageTrainingConfig
  | VideoTrainingConfig
  | AudioTrainingConfig;

// =============================================================================
// TRAINING PROGRESS
// =============================================================================

export type TrainingStatus =
  | 'queued'
  | 'provisioning'
  | 'downloading'
  | 'preparing'
  | 'training'
  | 'saving'
  | 'uploading'
  | 'completed'
  | 'failed'
  | 'stopped'
  | 'cancelled';

export interface TrainingProgress {
  status: TrainingStatus;
  currentStep: number;
  totalSteps: number;
  currentEpoch?: number;
  totalEpochs?: number;
  loss?: number;
  learningRate?: number;
  samplesPerSecond?: number;
  estimatedTimeRemaining?: number;
  gpuUtilization?: number;
  memoryUsage?: number;
  memoryTotal?: number;
  elapsedSeconds?: number;
  message?: string;
}

// =============================================================================
// TRAINING RESULT
// =============================================================================

export interface TrainingResult {
  success: boolean;
  outputModelUrl?: string;
  huggingFaceRepoUrl?: string;
  s3BackupUrl?: string;
  trainingReport?: TrainingReport;
  error?: string;
  totalCost: number;
  totalDuration: number; // seconds
  finalLoss?: number;
}

// =============================================================================
// TRAINING REPORT
// =============================================================================

export interface TrainingReport {
  id: string;
  trainingId: string;
  createdAt: string;
  completedAt: string;
  config: TrainingConfig;
  metrics: {
    finalLoss: number;
    bestLoss: number;
    lossHistory: number[];
    learningRateHistory?: number[];
    totalSteps: number;
    totalEpochs?: number;
    trainingDurationSeconds: number;
    samplesProcessed: number;
    tokensProcessed?: number;
  };
  datasetInfo: {
    source: string;
    samples: number;
    trainSamples: number;
    validationSamples?: number;
    description: string;
  };
  gpuInfo: {
    gpuType: string;
    gpuCount: number;
    provider: TrainingProvider;
    peakMemoryUsage?: number;
    averageUtilization?: number;
  };
  modelLocation: {
    huggingFaceRepo?: string;
    huggingFaceUrl?: string;
    s3Url?: string;
    localPath?: string;
  };
  endpoints?: {
    inferenceUrl?: string;
    provider?: TrainingProvider;
    gpuType?: string;
  };
  cost: {
    gpuHours: number;
    gpuCostUsd: number;
    storageCostUsd?: number;
    totalCostUsd: number;
    creditsUsed: number;
  };
  usageCode: {
    python: string;
    typescript: string;
    curl?: string;
  };
  recommendations: string[];
}

// =============================================================================
// GPU RECOMMENDATION
// =============================================================================

export interface GPURecommendation {
  provider: TrainingProvider;
  gpuType: string;
  gpuCount: number;
  vramRequired: number;
  vramAvailable: number;
  estimatedHours: number;
  estimatedCost: number;
  costPerHour: number;
  reason: string;
  canRunOnConsumerGPU: boolean;
  alternatives: Array<{
    provider: TrainingProvider;
    gpuType: string;
    gpuCount: number;
    cost: number;
    costPerHour: number;
    tradeoff: string;
  }>;
}

// =============================================================================
// CONTAINER IMAGES
// =============================================================================

export interface ContainerImage {
  id: string;
  name: string;
  tag: string;
  fullUrl: string;
  modality: ModelModality[];
  methods: TrainingMethod[];
  framework: string;
  cudaVersion: string;
  pythonVersion: string;
  description: string;
}

// =============================================================================
// TRAINING JOB (Extended)
// =============================================================================

export interface MultiModalTrainingJob {
  id: string;
  userId: string;
  projectId?: string;
  config: TrainingConfig;
  status: TrainingStatus;
  progress: TrainingProgress;
  result?: TrainingResult;
  logs: string[];
  error?: string;
  runpodPodId?: string;
  modalAppId?: string;
  billingTrackingId?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isLLMConfig(config: TrainingConfig): config is LLMTrainingConfig {
  return config.modality === 'llm';
}

export function isImageConfig(config: TrainingConfig): config is ImageTrainingConfig {
  return config.modality === 'image';
}

export function isVideoConfig(config: TrainingConfig): config is VideoTrainingConfig {
  return config.modality === 'video';
}

export function isAudioConfig(config: TrainingConfig): config is AudioTrainingConfig {
  return config.modality === 'audio';
}

// =============================================================================
// DEFAULT CONFIGURATIONS
// =============================================================================

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
  quantization: '4bit',
  optimizer: 'paged_adamw_8bit',
  scheduler: 'cosine',
  weightDecay: 0.01,
  gradientCheckpointing: true,
  useUnsloth: true,
};

export const DEFAULT_IMAGE_CONFIG: Partial<ImageTrainingConfig> = {
  steps: 1000,
  learningRate: 1e-4,
  batchSize: 1,
  resolution: 1024,
  loraConfig: {
    rank: 16,
    alpha: 16,
    networkDim: 16,
  },
  mixedPrecision: 'fp16',
  gradientCheckpointing: true,
  textEncoderTraining: false,
  cacheLatents: true,
};

export const DEFAULT_VIDEO_CONFIG: Partial<VideoTrainingConfig> = {
  steps: 500,
  learningRate: 1e-5,
  batchSize: 1,
  frameCount: 24,
  resolution: { width: 720, height: 480 },
  fps: 24,
  loraConfig: {
    rank: 16,
    alpha: 16,
  },
  mixedPrecision: 'bf16',
  gradientCheckpointing: true,
};

export const DEFAULT_AUDIO_CONFIG: Partial<AudioTrainingConfig> = {
  steps: 1000,
  learningRate: 1e-5,
  sampleRate: 22050,
  minAudioLength: 3,
  maxAudioLength: 30,
  batchSize: 2,
  gradientAccumulationSteps: 2,
  mixedPrecision: 'fp16',
};
