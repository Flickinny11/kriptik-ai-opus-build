/**
 * Training Executors - Index
 *
 * Exports all training executors and provides factory functions.
 * Part of KripTik AI's Flagship Training Module
 */

// =============================================================================
// TYPES
// =============================================================================

export * from './types.js';

// =============================================================================
// EXECUTORS
// =============================================================================

export { DoRAExecutor, createDoRAExecutor } from './dora-executor.js';
export { DPOExecutor, createDPOExecutor } from './dpo-executor.js';
export { RLHFExecutor, createRLHFExecutor } from './rlhf-executor.js';
export { DeepSpeedExecutor, createDeepSpeedExecutor } from './deepspeed-executor.js';
export { MoEDiffusionExecutor, createMoEDiffusionExecutor } from './moe-diffusion-executor.js';
export { MultiStageExecutor, createMultiStageExecutor } from './multi-stage-executor.js';

// =============================================================================
// EXECUTOR FACTORY
// =============================================================================

import type { TrainingExecutor, BaseExecutorConfig } from './types.js';
import { DoRAExecutor } from './dora-executor.js';
import { DPOExecutor } from './dpo-executor.js';
import { RLHFExecutor } from './rlhf-executor.js';
import { DeepSpeedExecutor } from './deepspeed-executor.js';
import { MoEDiffusionExecutor } from './moe-diffusion-executor.js';
import { MultiStageExecutor } from './multi-stage-executor.js';

export type ExecutorMethod =
  | 'lora'
  | 'qlora'
  | 'dora'
  | 'qdora'
  | 'dpo'
  | 'orpo'
  | 'rlhf'
  | 'rlhf_ppo'
  | 'deepspeed'
  | 'deepspeed_zero1'
  | 'deepspeed_zero2'
  | 'deepspeed_zero3'
  | 'full_finetune_deepspeed'
  | 'moe_diffusion'
  | 'multi_stage'
  | 'hybrid_lora_dpo'
  | 'hybrid_full_rlhf';

/**
 * Get the appropriate executor for a training method
 */
export function getExecutor(method: ExecutorMethod): TrainingExecutor<BaseExecutorConfig> {
  switch (method) {
    // PEFT Methods
    case 'lora':
    case 'qlora':
    case 'dora':
    case 'qdora':
      return new DoRAExecutor() as TrainingExecutor<BaseExecutorConfig>;

    // Alignment Methods
    case 'dpo':
    case 'orpo':
      return new DPOExecutor() as TrainingExecutor<BaseExecutorConfig>;

    case 'rlhf':
    case 'rlhf_ppo':
      return new RLHFExecutor() as TrainingExecutor<BaseExecutorConfig>;

    // Distributed Training
    case 'deepspeed':
    case 'deepspeed_zero1':
    case 'deepspeed_zero2':
    case 'deepspeed_zero3':
    case 'full_finetune_deepspeed':
      return new DeepSpeedExecutor() as TrainingExecutor<BaseExecutorConfig>;

    // Specialized
    case 'moe_diffusion':
      return new MoEDiffusionExecutor() as TrainingExecutor<BaseExecutorConfig>;

    // Multi-stage pipelines
    case 'multi_stage':
    case 'hybrid_lora_dpo':
    case 'hybrid_full_rlhf':
      return new MultiStageExecutor() as unknown as TrainingExecutor<BaseExecutorConfig>;

    default:
      // Default to DoRA for unknown methods
      return new DoRAExecutor() as TrainingExecutor<BaseExecutorConfig>;
  }
}

/**
 * Create an executor by method name
 */
export function createExecutor(method: string): TrainingExecutor<BaseExecutorConfig> {
  return getExecutor(method as ExecutorMethod);
}

/**
 * Check if a method is supported
 */
export function isMethodSupported(method: string): method is ExecutorMethod {
  const supportedMethods: ExecutorMethod[] = [
    'lora', 'qlora', 'dora', 'qdora',
    'dpo', 'orpo',
    'rlhf', 'rlhf_ppo',
    'deepspeed', 'deepspeed_zero1', 'deepspeed_zero2', 'deepspeed_zero3', 'full_finetune_deepspeed',
    'moe_diffusion',
    'multi_stage', 'hybrid_lora_dpo', 'hybrid_full_rlhf',
  ];
  return supportedMethods.includes(method as ExecutorMethod);
}

/**
 * Get all supported methods
 */
export function getSupportedMethods(): ExecutorMethod[] {
  return [
    'lora', 'qlora', 'dora', 'qdora',
    'dpo', 'orpo',
    'rlhf', 'rlhf_ppo',
    'deepspeed', 'deepspeed_zero1', 'deepspeed_zero2', 'deepspeed_zero3', 'full_finetune_deepspeed',
    'moe_diffusion',
    'multi_stage', 'hybrid_lora_dpo', 'hybrid_full_rlhf',
  ];
}

/**
 * Get executor metadata
 */
export function getExecutorMetadata(method: ExecutorMethod): {
  name: string;
  description: string;
  category: 'peft' | 'alignment' | 'distributed' | 'specialized' | 'pipeline';
  complexity: 'basic' | 'advanced' | 'expert';
  estimatedVRAM: number; // GB
} {
  const metadata: Record<ExecutorMethod, ReturnType<typeof getExecutorMetadata>> = {
    lora: {
      name: 'LoRA',
      description: 'Low-Rank Adaptation for efficient fine-tuning',
      category: 'peft',
      complexity: 'basic',
      estimatedVRAM: 16,
    },
    qlora: {
      name: 'QLoRA',
      description: 'Quantized LoRA for memory efficiency',
      category: 'peft',
      complexity: 'basic',
      estimatedVRAM: 8,
    },
    dora: {
      name: 'DoRA',
      description: 'Weight-Decomposed Low-Rank Adaptation',
      category: 'peft',
      complexity: 'advanced',
      estimatedVRAM: 20,
    },
    qdora: {
      name: 'QDoRA',
      description: 'Quantized DoRA for efficiency + quality',
      category: 'peft',
      complexity: 'advanced',
      estimatedVRAM: 12,
    },
    dpo: {
      name: 'DPO',
      description: 'Direct Preference Optimization',
      category: 'alignment',
      complexity: 'advanced',
      estimatedVRAM: 40,
    },
    orpo: {
      name: 'ORPO',
      description: 'Odds Ratio Preference Optimization',
      category: 'alignment',
      complexity: 'advanced',
      estimatedVRAM: 40,
    },
    rlhf: {
      name: 'RLHF',
      description: 'Reinforcement Learning from Human Feedback',
      category: 'alignment',
      complexity: 'expert',
      estimatedVRAM: 80,
    },
    rlhf_ppo: {
      name: 'RLHF (PPO)',
      description: 'RLHF with Proximal Policy Optimization',
      category: 'alignment',
      complexity: 'expert',
      estimatedVRAM: 80,
    },
    deepspeed: {
      name: 'DeepSpeed',
      description: 'Microsoft DeepSpeed distributed training',
      category: 'distributed',
      complexity: 'expert',
      estimatedVRAM: 40,
    },
    deepspeed_zero1: {
      name: 'DeepSpeed ZeRO-1',
      description: 'Optimizer state partitioning',
      category: 'distributed',
      complexity: 'advanced',
      estimatedVRAM: 60,
    },
    deepspeed_zero2: {
      name: 'DeepSpeed ZeRO-2',
      description: 'Optimizer + gradient partitioning',
      category: 'distributed',
      complexity: 'advanced',
      estimatedVRAM: 50,
    },
    deepspeed_zero3: {
      name: 'DeepSpeed ZeRO-3',
      description: 'Full parameter partitioning',
      category: 'distributed',
      complexity: 'expert',
      estimatedVRAM: 40,
    },
    full_finetune_deepspeed: {
      name: 'Full Fine-tune (DeepSpeed)',
      description: 'Full model training with DeepSpeed',
      category: 'distributed',
      complexity: 'expert',
      estimatedVRAM: 80,
    },
    moe_diffusion: {
      name: 'MoE Diffusion',
      description: 'Mixture of Experts for diffusion models',
      category: 'specialized',
      complexity: 'expert',
      estimatedVRAM: 80,
    },
    multi_stage: {
      name: 'Multi-Stage Pipeline',
      description: 'Sequential training stages',
      category: 'pipeline',
      complexity: 'expert',
      estimatedVRAM: 80,
    },
    hybrid_lora_dpo: {
      name: 'LoRA + DPO Pipeline',
      description: 'LoRA adaptation followed by DPO alignment',
      category: 'pipeline',
      complexity: 'advanced',
      estimatedVRAM: 40,
    },
    hybrid_full_rlhf: {
      name: 'Full + RLHF Pipeline',
      description: 'Full fine-tuning followed by RLHF',
      category: 'pipeline',
      complexity: 'expert',
      estimatedVRAM: 80,
    },
  };

  return metadata[method];
}
