/**
 * Trainer Factory
 *
 * Factory for creating specialized trainers based on modality.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import type {
  TrainingConfig,
  LLMTrainingConfig,
  ImageTrainingConfig,
  VideoTrainingConfig,
  AudioTrainingConfig,
} from '../types.js';

import { ImageTrainer, type ImageTrainerResult } from './image-trainer.js';
import { VideoTrainer, type VideoTrainerResult } from './video-trainer.js';
import { AudioTrainer, type AudioTrainerResult } from './audio-trainer.js';
import { LLMTrainer, type LLMTrainerResult } from './llm-trainer.js';

// =============================================================================
// TYPES
// =============================================================================

export type Trainer = ImageTrainer | VideoTrainer | AudioTrainer | LLMTrainer;

export type TrainerResult = 
  | ImageTrainerResult 
  | VideoTrainerResult 
  | AudioTrainerResult 
  | LLMTrainerResult;

export interface TrainerConfig {
  trainingScript: string;
  datasetScript: string;
  containerImage: string;
  environmentVariables: Record<string, string>;
  estimatedVRAM: number;
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a trainer instance based on the training configuration
 */
export function createTrainer(config: TrainingConfig): Trainer {
  switch (config.modality) {
    case 'llm':
      return new LLMTrainer(config as LLMTrainingConfig);
    case 'image':
      return new ImageTrainer(config as ImageTrainingConfig);
    case 'video':
      return new VideoTrainer(config as VideoTrainingConfig);
    case 'audio':
      return new AudioTrainer(config as AudioTrainingConfig);
    default: {
      // Exhaustive check - should never reach here
      const _exhaustiveCheck: never = config;
      throw new Error(`Unsupported modality: ${(_exhaustiveCheck as TrainingConfig).modality}`);
    }
  }
}

/**
 * Generate training configuration for a given training config
 */
export function generateTrainerConfig(config: TrainingConfig): TrainerConfig {
  const trainer = createTrainer(config);
  return trainer.generate();
}

/**
 * Get training script for a configuration
 */
export function getTrainingScript(config: TrainingConfig): string {
  const trainer = createTrainer(config);
  return trainer.generateTrainingScript();
}

/**
 * Get dataset preparation script for a configuration
 */
export function getDatasetScript(config: TrainingConfig): string {
  const trainer = createTrainer(config);
  return trainer.generateDatasetScript();
}

/**
 * Get container image for a configuration
 */
export function getContainerImage(config: TrainingConfig): string {
  const trainer = createTrainer(config);
  return trainer.getContainerImage();
}

/**
 * Get environment variables for a configuration
 */
export function getEnvironmentVariables(config: TrainingConfig): Record<string, string> {
  const trainer = createTrainer(config);
  return trainer.getEnvironmentVariables();
}

/**
 * Estimate VRAM requirements for a configuration
 */
export function estimateVRAM(config: TrainingConfig): number {
  const trainer = createTrainer(config);
  return trainer.estimateVRAM();
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

export { ImageTrainer, type ImageTrainerResult } from './image-trainer.js';
export { VideoTrainer, type VideoTrainerResult } from './video-trainer.js';
export { AudioTrainer, type AudioTrainerResult } from './audio-trainer.js';
export { LLMTrainer, type LLMTrainerResult } from './llm-trainer.js';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Supported training methods by modality
 */
export const SUPPORTED_METHODS = {
  llm: ['lora', 'qlora', 'full_finetune'],
  image: ['lora', 'dreambooth', 'textual_inversion'],
  video: ['lora', 'full_finetune'],
  audio: ['voice_clone', 'style_transfer', 'full_finetune'],
} as const;

/**
 * Recommended base models by modality
 */
export const RECOMMENDED_MODELS = {
  llm: [
    { id: 'unsloth/llama-3-8b-bnb-4bit', name: 'Llama 3 8B (QLoRA)', size: '8B' },
    { id: 'unsloth/mistral-7b-v0.3-bnb-4bit', name: 'Mistral 7B (QLoRA)', size: '7B' },
    { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen 2.5 7B', size: '7B' },
    { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B', size: '9B' },
    { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B', size: '70B' },
  ],
  image: [
    { id: 'stabilityai/stable-diffusion-xl-base-1.0', name: 'SDXL Base', size: 'Base' },
    { id: 'black-forest-labs/FLUX.1-dev', name: 'FLUX.1 Dev', size: '12B' },
    { id: 'stabilityai/stable-diffusion-3.5-large', name: 'SD 3.5 Large', size: '8B' },
    { id: 'runwayml/stable-diffusion-v1-5', name: 'SD 1.5', size: '1B' },
  ],
  video: [
    { id: 'Wan-AI/Wan2.1-T2V', name: 'Wan 2.1', size: 'MoE' },
    { id: 'tencent/HunyuanVideo', name: 'HunyuanVideo', size: '13B' },
    { id: 'hpcai-tech/Open-Sora-v2', name: 'Open-Sora 2', size: '8B' },
    { id: 'genmo/mochi-1-preview', name: 'Mochi 1', size: '10B' },
  ],
  audio: [
    { id: 'coqui/XTTS-v2', name: 'XTTS v2', size: '2B' },
    { id: 'collabora/WhisperSpeech', name: 'WhisperSpeech', size: '1B' },
    { id: 'suno/bark', name: 'Bark', size: '1B' },
    { id: 'facebook/musicgen-large', name: 'MusicGen Large', size: '3B' },
  ],
} as const;

/**
 * Training presets for common use cases
 */
export const TRAINING_PRESETS = {
  'llm-fast': {
    name: 'Fast LLM Fine-tune',
    description: 'Quick QLoRA training with Unsloth (2x faster)',
    config: {
      method: 'qlora' as const,
      epochs: 1,
      batchSize: 4,
      learningRate: 2e-4,
      useUnsloth: true,
    },
  },
  'llm-quality': {
    name: 'Quality LLM Fine-tune',
    description: 'Higher quality training with more epochs',
    config: {
      method: 'qlora' as const,
      epochs: 3,
      batchSize: 2,
      learningRate: 1e-4,
      useUnsloth: true,
      gradientAccumulationSteps: 8,
    },
  },
  'image-character': {
    name: 'Character LoRA',
    description: 'Train a character/person LoRA',
    config: {
      method: 'dreambooth' as const,
      steps: 1500,
      learningRate: 1e-4,
      resolution: 1024,
      priorPreservation: true,
    },
  },
  'image-style': {
    name: 'Style LoRA',
    description: 'Train an art style LoRA',
    config: {
      method: 'lora' as const,
      steps: 2000,
      learningRate: 5e-5,
      resolution: 1024,
    },
  },
  'voice-clone': {
    name: 'Voice Clone',
    description: 'Clone a voice from audio samples',
    config: {
      method: 'voice_clone' as const,
      steps: 500,
      learningRate: 1e-4,
    },
  },
} as const;

export default {
  createTrainer,
  generateTrainerConfig,
  getTrainingScript,
  getDatasetScript,
  getContainerImage,
  getEnvironmentVariables,
  estimateVRAM,
  SUPPORTED_METHODS,
  RECOMMENDED_MODELS,
  TRAINING_PRESETS,
};
