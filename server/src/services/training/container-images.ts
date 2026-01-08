/**
 * Container Images Registry
 *
 * Defines optimized Docker images for each training type on RunPod.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import type { ModelModality, TrainingMethod } from './types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ContainerImage {
  tag: string;
  description: string;
  vramOverhead: number; // GB of VRAM used by the container itself
  diskSize: number; // Recommended disk size in GB
  supportedMethods: TrainingMethod[];
  preInstalledPackages: string[];
  cudaVersion: string;
  pythonVersion: string;
}

export interface ContainerConfig {
  image: string;
  environmentVariables: Record<string, string>;
  startupScript?: string;
  ports?: number[];
  volumeMounts?: string[];
}

// =============================================================================
// LLM CONTAINER IMAGES
// =============================================================================

export const LLM_CONTAINERS: Record<string, ContainerImage> = {
  'unsloth': {
    tag: 'unslothai/unsloth:latest-py311-cu121-torch231',
    description: 'Unsloth - 2x faster training, 60% less VRAM',
    vramOverhead: 1,
    diskSize: 50,
    supportedMethods: ['lora', 'qlora', 'full_finetune'],
    preInstalledPackages: ['unsloth', 'transformers', 'peft', 'bitsandbytes', 'trl', 'datasets'],
    cudaVersion: '12.1',
    pythonVersion: '3.11',
  },
  'transformers': {
    tag: 'runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04',
    description: 'Standard PyTorch with Transformers',
    vramOverhead: 2,
    diskSize: 100,
    supportedMethods: ['lora', 'qlora', 'full_finetune'],
    preInstalledPackages: ['torch', 'transformers'],
    cudaVersion: '12.1',
    pythonVersion: '3.10',
  },
  'axolotl': {
    tag: 'winglian/axolotl:main-latest',
    description: 'Axolotl - YAML-based training config',
    vramOverhead: 2,
    diskSize: 80,
    supportedMethods: ['lora', 'qlora', 'full_finetune'],
    preInstalledPackages: ['axolotl', 'transformers', 'peft', 'flash-attn'],
    cudaVersion: '12.1',
    pythonVersion: '3.10',
  },
};

// =============================================================================
// IMAGE CONTAINER IMAGES
// =============================================================================

export const IMAGE_CONTAINERS: Record<string, ContainerImage> = {
  'kohya-sdxl': {
    tag: 'runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04',
    description: 'kohya-ss/sd-scripts for SDXL LoRA training',
    vramOverhead: 2,
    diskSize: 80,
    supportedMethods: ['lora', 'dreambooth', 'textual_inversion'],
    preInstalledPackages: ['torch', 'torchvision', 'xformers', 'safetensors'],
    cudaVersion: '12.1',
    pythonVersion: '3.10',
  },
  'flux': {
    tag: 'runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04',
    description: 'FLUX LoRA training with ai-toolkit',
    vramOverhead: 2,
    diskSize: 100,
    supportedMethods: ['lora'],
    preInstalledPackages: ['torch', 'diffusers', 'accelerate', 'safetensors'],
    cudaVersion: '12.1',
    pythonVersion: '3.10',
  },
  'diffusers': {
    tag: 'runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04',
    description: 'HuggingFace Diffusers for DreamBooth',
    vramOverhead: 2,
    diskSize: 80,
    supportedMethods: ['dreambooth', 'lora', 'textual_inversion'],
    preInstalledPackages: ['torch', 'diffusers', 'accelerate', 'transformers'],
    cudaVersion: '12.1',
    pythonVersion: '3.10',
  },
};

// =============================================================================
// VIDEO CONTAINER IMAGES
// =============================================================================

export const VIDEO_CONTAINERS: Record<string, ContainerImage> = {
  'wan': {
    tag: 'runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04',
    description: 'Wan Video Generation Training',
    vramOverhead: 4,
    diskSize: 200,
    supportedMethods: ['lora', 'full_finetune'],
    preInstalledPackages: ['torch', 'diffusers', 'accelerate', 'decord'],
    cudaVersion: '12.1',
    pythonVersion: '3.10',
  },
  'hunyuan': {
    tag: 'runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04',
    description: 'HunyuanVideo Training',
    vramOverhead: 4,
    diskSize: 200,
    supportedMethods: ['lora', 'full_finetune'],
    preInstalledPackages: ['torch', 'diffusers', 'accelerate'],
    cudaVersion: '12.1',
    pythonVersion: '3.10',
  },
  'opensora': {
    tag: 'runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04',
    description: 'Open-Sora Training',
    vramOverhead: 3,
    diskSize: 150,
    supportedMethods: ['lora', 'full_finetune'],
    preInstalledPackages: ['torch', 'diffusers', 'accelerate'],
    cudaVersion: '12.1',
    pythonVersion: '3.10',
  },
  'mochi': {
    tag: 'runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04',
    description: 'Mochi Video Training',
    vramOverhead: 3,
    diskSize: 150,
    supportedMethods: ['lora'],
    preInstalledPackages: ['torch', 'diffusers', 'accelerate'],
    cudaVersion: '12.1',
    pythonVersion: '3.10',
  },
};

// =============================================================================
// AUDIO CONTAINER IMAGES
// =============================================================================

export const AUDIO_CONTAINERS: Record<string, ContainerImage> = {
  'xtts': {
    tag: 'ghcr.io/coqui-ai/tts:latest',
    description: 'Coqui XTTS Voice Cloning',
    vramOverhead: 2,
    diskSize: 50,
    supportedMethods: ['voice_clone', 'full_finetune'],
    preInstalledPackages: ['TTS', 'torch', 'torchaudio'],
    cudaVersion: '11.8',
    pythonVersion: '3.10',
  },
  'whisperspeech': {
    tag: 'runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04',
    description: 'WhisperSpeech TTS Training',
    vramOverhead: 2,
    diskSize: 50,
    supportedMethods: ['voice_clone', 'style_transfer'],
    preInstalledPackages: ['torch', 'torchaudio', 'transformers'],
    cudaVersion: '12.1',
    pythonVersion: '3.10',
  },
  'bark': {
    tag: 'runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04',
    description: 'Bark Expressive TTS',
    vramOverhead: 2,
    diskSize: 50,
    supportedMethods: ['style_transfer'],
    preInstalledPackages: ['torch', 'bark'],
    cudaVersion: '12.1',
    pythonVersion: '3.10',
  },
  'musicgen': {
    tag: 'runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04',
    description: 'MusicGen Music Generation Training',
    vramOverhead: 3,
    diskSize: 80,
    supportedMethods: ['style_transfer', 'full_finetune'],
    preInstalledPackages: ['torch', 'torchaudio', 'audiocraft'],
    cudaVersion: '12.1',
    pythonVersion: '3.10',
  },
};

// =============================================================================
// CONTAINER SELECTION
// =============================================================================

/**
 * Get the optimal container image for a training configuration
 */
export function getContainerImage(
  modality: ModelModality,
  method: TrainingMethod,
  baseModel?: string
): ContainerConfig {
  let containerKey: string;
  let containers: Record<string, ContainerImage>;

  switch (modality) {
    case 'llm':
      containers = LLM_CONTAINERS;
      containerKey = method === 'qlora' ? 'unsloth' : 'transformers';
      break;
    case 'image':
      containers = IMAGE_CONTAINERS;
      if (baseModel?.toLowerCase().includes('flux')) {
        containerKey = 'flux';
      } else if (method === 'dreambooth') {
        containerKey = 'diffusers';
      } else {
        containerKey = 'kohya-sdxl';
      }
      break;
    case 'video':
      containers = VIDEO_CONTAINERS;
      if (baseModel?.toLowerCase().includes('wan')) {
        containerKey = 'wan';
      } else if (baseModel?.toLowerCase().includes('hunyuan')) {
        containerKey = 'hunyuan';
      } else if (baseModel?.toLowerCase().includes('opensora')) {
        containerKey = 'opensora';
      } else {
        containerKey = 'mochi';
      }
      break;
    case 'audio':
      containers = AUDIO_CONTAINERS;
      if (baseModel?.toLowerCase().includes('xtts')) {
        containerKey = 'xtts';
      } else if (baseModel?.toLowerCase().includes('whisper')) {
        containerKey = 'whisperspeech';
      } else if (baseModel?.toLowerCase().includes('bark')) {
        containerKey = 'bark';
      } else if (baseModel?.toLowerCase().includes('musicgen')) {
        containerKey = 'musicgen';
      } else {
        containerKey = 'xtts';
      }
      break;
    default:
      throw new Error(`Unsupported modality: ${modality}`);
  }

  const container = containers[containerKey];
  if (!container) {
    throw new Error(`No container found for ${modality} / ${method}`);
  }

  return {
    image: container.tag,
    environmentVariables: {
      HF_HOME: '/workspace/huggingface',
      TRANSFORMERS_CACHE: '/workspace/huggingface',
      TORCH_HOME: '/workspace/torch',
      XDG_CACHE_HOME: '/workspace/cache',
    },
    volumeMounts: ['/workspace'],
  };
}

/**
 * Get VRAM overhead for a container
 */
export function getContainerVRAMOverhead(
  modality: ModelModality,
  baseModel?: string
): number {
  switch (modality) {
    case 'llm':
      return LLM_CONTAINERS.unsloth.vramOverhead;
    case 'image':
      return IMAGE_CONTAINERS['kohya-sdxl'].vramOverhead;
    case 'video':
      if (baseModel?.toLowerCase().includes('wan')) {
        return VIDEO_CONTAINERS.wan.vramOverhead;
      }
      return 4;
    case 'audio':
      return AUDIO_CONTAINERS.xtts.vramOverhead;
    default:
      return 2;
  }
}

/**
 * Get recommended disk size for a training job
 */
export function getRecommendedDiskSize(
  modality: ModelModality,
  method: TrainingMethod,
  baseModel?: string
): number {
  switch (modality) {
    case 'llm':
      // Larger models need more disk space
      if (baseModel?.includes('70b') || baseModel?.includes('70B')) {
        return 200;
      }
      return LLM_CONTAINERS.unsloth.diskSize;
    case 'image':
      return IMAGE_CONTAINERS['kohya-sdxl'].diskSize;
    case 'video':
      return VIDEO_CONTAINERS.wan.diskSize;
    case 'audio':
      return AUDIO_CONTAINERS.xtts.diskSize;
    default:
      return 50;
  }
}

export default {
  LLM_CONTAINERS,
  IMAGE_CONTAINERS,
  VIDEO_CONTAINERS,
  AUDIO_CONTAINERS,
  getContainerImage,
  getContainerVRAMOverhead,
  getRecommendedDiskSize,
};
