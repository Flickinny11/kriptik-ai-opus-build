# KripTik AI Universal Training & Fine-Tuning Implementation Plan

## Overview

This document contains 15 structured NLP prompts for Cursor 2.2 with Claude Opus 4.5 to implement a production-ready universal training system capable of training and fine-tuning models on virtually ANY media type.

**Critical Requirements:**
- NO placeholders
- NO TODOs
- NO mock data
- ONLY real production training code
- Dynamic pipeline construction
- NLP intent parsing
- HuggingFace integration for model discovery
- RunPod/Modal GPU provisioning
- Maximum quality AND maximum speed configurations

---

## PROMPT 1: Training Intent Interpreter & NLP Parser

```
/ultrathink

You are implementing a production Training Intent Interpreter for KripTik AI. This is the BRAIN that parses any user NLP prompt and translates it into a concrete, executable training plan.

## Context
- Location: server/src/services/training/intent-interpreter.ts
- This service receives natural language prompts like "fine-tune a model to generate 5-minute songs with vocals like Suno v5"
- It must extract: modality, capabilities needed, base models, training methods, data requirements, pipeline architecture
- It integrates with model-discovery.ts for finding appropriate models on HuggingFace
- It outputs a structured TrainingIntentPlan that the orchestrator executes

## Requirements

### 1. Intent Categories to Detect

**Audio/Music Intent Detection:**
- Music generation (instrumental, full songs, stems)
- Singing voice synthesis (AI vocals, voice cloning for singing)
- Speech synthesis (TTS, voice cloning for speech)
- Sound effects generation
- Audio enhancement/restoration
- Audio-to-audio style transfer
- Lyrics-to-singing conversion
- Voice conversion (any voice to target voice)
- Instrument-specific generation (drums, guitar, piano, etc.)
- Genre-specific music (EDM, classical, jazz, rock, etc.)
- Music continuation/extension
- Vocal isolation/separation
- Audio mixing/mastering AI

**Image Intent Detection:**
- Text-to-image generation
- Image-to-image transformation
- Style transfer
- Character/subject consistency (LoRA, DreamBooth)
- Inpainting/outpainting
- Super-resolution/upscaling
- Image restoration
- Background removal/replacement
- Face generation/editing
- Logo/icon generation
- Product photography
- Architectural visualization
- Fashion/clothing generation
- Art style replication
- Photorealistic rendering
- Anime/cartoon style

**Video Intent Detection:**
- Text-to-video generation
- Image-to-video animation
- Video-to-video style transfer
- Character animation
- Lip-sync generation
- Video extension/continuation
- Video upscaling
- Frame interpolation
- Motion transfer
- Green screen replacement
- Video restoration
- Talking head generation
- Music video generation
- Short-form content (TikTok, Reels style)
- Long-form video generation
- Cinematic effects
- VFX generation

**LLM Intent Detection:**
- Domain-specific fine-tuning
- Instruction following
- Code generation
- Creative writing
- Translation
- Summarization
- Question answering
- Conversation/chat
- Reasoning enhancement
- Tool use training
- Multi-turn dialogue
- Knowledge injection
- Style adaptation

**Multimodal Intent Detection:**
- Vision-language models
- Audio-visual generation
- Text + image → video
- Music + lyrics → singing video
- Any combination of above

### 2. Capability Extraction

For each detected intent, extract:
```typescript
interface ExtractedCapabilities {
  primaryModality: 'audio' | 'image' | 'video' | 'llm' | 'multimodal';
  subCapabilities: string[]; // e.g., ['vocals', 'lyrics', 'long-form']
  qualityRequirements: {
    resolution?: string;
    duration?: number;
    sampleRate?: number;
    bitDepth?: number;
    fps?: number;
  };
  styleRequirements: string[]; // e.g., ['suno-like', 'photorealistic', 'anime']
  targetSimilarity?: string; // Reference to compare against
  outputFormat: string[];
}
```

### 3. Model Discovery Integration

The interpreter must:
- Query HuggingFace for models matching capabilities
- Score models by: downloads, recency, task match, VRAM requirements
- Identify if multiple models needed (e.g., music + vocals = 2 models)
- Check if models support required training methods
- Determine if custom pipeline assembly required

### 4. Pipeline Architecture Detection

Determine if the request requires:
- Single model training
- Multi-model pipeline (sequential or parallel)
- Model chaining (output of one → input of another)
- Ensemble approaches
- Custom architecture modifications

### 5. Output: TrainingIntentPlan

```typescript
interface TrainingIntentPlan {
  id: string;
  originalPrompt: string;
  parsedAt: string;

  // What the user wants
  intent: {
    summary: string;
    primaryGoal: string;
    secondaryGoals: string[];
    constraints: string[];
  };

  // Capabilities needed
  capabilities: ExtractedCapabilities;

  // Models to use/train
  modelPlan: {
    models: Array<{
      role: string; // e.g., 'music_generator', 'vocal_synthesizer'
      suggestedModels: ModelRecommendation[];
      trainingMethod: TrainingMethod;
      estimatedVRAM: number;
      estimatedTime: string;
    }>;
    pipelineType: 'single' | 'sequential' | 'parallel' | 'ensemble';
    pipelineDescription: string;
  };

  // Data requirements
  dataRequirements: {
    dataType: string;
    minimumSamples: number;
    format: string;
    preprocessing: string[];
    augmentation: string[];
  };

  // Training configuration
  trainingConfig: {
    method: TrainingMethod;
    estimatedGPUHours: number;
    recommendedGPU: string;
    hyperparameters: Record<string, any>;
    qualityVsSpeedPreset: 'maximum_quality' | 'balanced' | 'maximum_speed';
  };

  // Integrations needed
  integrations: {
    modelsToDownload: string[];
    packagesToInstall: string[];
    apisToConnect: string[];
    customCodeRequired: boolean;
  };

  // Execution steps
  executionPlan: Array<{
    step: number;
    name: string;
    description: string;
    type: 'install' | 'download' | 'preprocess' | 'train' | 'evaluate' | 'deploy';
    estimatedDuration: string;
    dependencies: number[];
  }>;

  // Cost estimate
  costEstimate: {
    gpuCostUsd: number;
    storageCostUsd: number;
    totalCredits: number;
  };

  // Warnings/notes
  warnings: string[];
  alternativeApproaches: string[];
}
```

## Implementation

Create the complete TrainingIntentInterpreter class with:

1. `parseIntent(prompt: string): Promise<TrainingIntentPlan>` - Main entry point
2. `detectModality(prompt: string): ModalityDetection` - Use Claude to classify
3. `extractCapabilities(prompt: string, modality: string): ExtractedCapabilities`
4. `discoverModels(capabilities: ExtractedCapabilities): Promise<ModelRecommendation[]>`
5. `buildPipelineArchitecture(models: ModelRecommendation[], capabilities: ExtractedCapabilities): PipelineArchitecture`
6. `generateExecutionPlan(plan: Partial<TrainingIntentPlan>): ExecutionStep[]`
7. `estimateCosts(plan: Partial<TrainingIntentPlan>): CostEstimate`
8. `validateFeasibility(plan: TrainingIntentPlan): ValidationResult`

Use Claude API for NLP understanding. The prompt engineering should handle edge cases like:
- Vague requests ("make it better")
- Reference to commercial products ("like Suno", "like Midjourney")
- Complex multi-capability requests
- Unrealistic expectations (flag and suggest alternatives)

## File Structure

Create these files:
- server/src/services/training/intent-interpreter.ts (main class)
- server/src/services/training/intent-types.ts (all types)
- server/src/services/training/capability-detector.ts (modality/capability detection)
- server/src/services/training/pipeline-architect.ts (pipeline construction logic)

Do NOT use placeholders. Every function must have complete, production-ready implementation.
```

---

## PROMPT 2: Universal Audio Training System

```
/ultrathink
/context server/src/services/training/trainers/audio-trainer.ts
/context server/src/services/training/types.ts
/context server/src/services/training/multi-modal-orchestrator.ts

You are implementing a COMPLETE, PRODUCTION-READY Universal Audio Training System for KripTik AI. The current audio-trainer.ts has placeholder training loops. You must replace ALL placeholders with REAL training code.

## Audio Capabilities to Support

### 1. Music Generation Training
**Models to support:**
- MusicGen (facebook/musicgen-small, medium, large, melody)
- Stable Audio (stability-ai/stable-audio-open-1.0)
- AudioCraft (all variants)
- Riffusion
- MusicLM-compatible architectures
- JEN-1 style architectures

**Training methods:**
- Style transfer fine-tuning
- Genre adaptation
- Instrument-specific training
- Continuation/extension training
- Melody-conditioned training

**Real training implementation for MusicGen:**
```python
# This is what the training script should ACTUALLY do:
from audiocraft.models import MusicGen
from audiocraft.data.audio_dataset import AudioDataset
from torch.utils.data import DataLoader
import torch.optim as optim

model = MusicGen.get_pretrained(base_model)
model.lm.train()  # Set language model to training mode

# Freeze compression model, train only LM
for param in model.compression_model.parameters():
    param.requires_grad = False

optimizer = optim.AdamW(model.lm.parameters(), lr=learning_rate)

for epoch in range(epochs):
    for batch in dataloader:
        audio, descriptions = batch
        # Encode audio to tokens
        tokens = model.compression_model.encode(audio)
        # Train LM on token prediction
        loss = model.lm(tokens, descriptions)
        loss.backward()
        optimizer.step()
```

### 2. Singing Voice Synthesis Training
**Models to support:**
- So-VITS-SVC (singing voice conversion)
- RVC (Retrieval-based Voice Conversion)
- DDSP-SVC
- DiffSinger
- Amphion
- VALL-E X (for zero-shot)
- OpenVoice

**Training methods:**
- Voice cloning for singing
- Style transfer (make any voice sing like target)
- Lyrics-to-singing synthesis
- Pitch/timbre separation training

**Real So-VITS-SVC training:**
```python
# Actual training script structure
from so_vits_svc_fork import train

train.main(
    config_path=config_path,
    model_dir=output_dir,
    dataset_path=dataset_path,
    epochs=epochs,
    batch_size=batch_size,
    learning_rate=learning_rate,
)
```

### 3. Speech Synthesis (TTS) Training
**Models to support:**
- XTTS v2 (already partially implemented)
- Bark
- WhisperSpeech
- Tortoise TTS
- StyleTTS2
- VITS/VITS2
- Piper
- Coqui TTS
- Fish Speech
- GPT-SoVITS

**Training methods:**
- Voice cloning (few-shot)
- Multi-speaker training
- Emotion/style control
- Language adaptation
- Accent training

### 4. Sound Effects & Foley
**Models to support:**
- AudioLDM/AudioLDM2
- Make-An-Audio
- Tango
- AudioGen

**Training methods:**
- Category-specific training
- Environmental sound generation
- Foley synthesis

### 5. Audio Enhancement
**Models to support:**
- Demucs (stem separation)
- Denoiser
- Audio super-resolution models
- Dereverberation models

### 6. Instrument-Specific Generation
Support training for:
- Drums/percussion (Drumgan, etc.)
- Guitar
- Piano
- Bass
- Synths
- Orchestral instruments

## Implementation Requirements

### AudioTrainer Class Rewrite

Replace the entire `generateTrainingPython()` method with a dispatcher that calls the appropriate REAL training implementation:

```typescript
private generateTrainingPython(): string {
  switch (this.config.audioTask) {
    case 'music_generation':
      return this.generateMusicGenTraining();
    case 'singing_voice':
      return this.generateSingingVoiceTraining();
    case 'speech_synthesis':
      return this.generateTTSTraining();
    case 'sound_effects':
      return this.generateSFXTraining();
    case 'audio_enhancement':
      return this.generateEnhancementTraining();
    case 'instrument_specific':
      return this.generateInstrumentTraining();
    default:
      return this.generateGenericAudioTraining();
  }
}
```

Each generator method must produce COMPLETE, EXECUTABLE Python training scripts with:
- Proper imports
- Model loading with correct architecture
- Dataset loading and preprocessing
- Training loop with real gradient updates
- Checkpointing
- Logging to callbacks
- Model saving in correct format
- HuggingFace upload

### Extended Audio Types

Update server/src/services/training/types.ts:

```typescript
export type AudioTask =
  | 'music_generation'
  | 'singing_voice_synthesis'
  | 'singing_voice_conversion'
  | 'speech_synthesis'
  | 'voice_cloning'
  | 'sound_effects'
  | 'audio_enhancement'
  | 'stem_separation'
  | 'audio_restoration'
  | 'instrument_generation'
  | 'lyrics_to_singing';

export type AudioBaseModel =
  | 'musicgen-small' | 'musicgen-medium' | 'musicgen-large' | 'musicgen-melody'
  | 'stable-audio-open'
  | 'audioldm' | 'audioldm2'
  | 'bark' | 'bark-small'
  | 'xtts' | 'xtts2'
  | 'tortoise'
  | 'styletts2'
  | 'vits' | 'vits2'
  | 'so-vits-svc'
  | 'rvc'
  | 'diff-singer'
  | 'amphion'
  | 'whisper-speech'
  | 'coqui-tts'
  | 'fish-speech'
  | 'gpt-sovits'
  | 'open-voice'
  | 'demucs'
  | 'audio-super-res';

export interface AudioTrainingConfig extends BaseTrainingConfig {
  modality: 'audio';
  audioTask: AudioTask;
  baseModel: AudioBaseModel;

  // Music-specific
  musicConfig?: {
    genre?: string;
    instruments?: string[];
    bpm?: number;
    key?: string;
    duration?: number;
    stemTraining?: boolean;
  };

  // Singing-specific
  singingConfig?: {
    voiceSamples: string[];
    targetPitch?: string;
    language?: string;
    lyricsSupport?: boolean;
  };

  // Speech-specific
  speechConfig?: {
    voiceSamples: string[];
    language?: string;
    emotions?: string[];
    speakingRate?: number;
  };

  // Enhancement-specific
  enhancementConfig?: {
    task: 'denoise' | 'dereverberate' | 'super_resolution' | 'separate';
    targetQuality?: string;
  };

  // Common
  sampleRate: number;
  channels: 1 | 2;
  bitDepth: 16 | 24 | 32;
  format: 'wav' | 'mp3' | 'flac' | 'ogg';
}
```

### Container Images

Update container-images.ts with containers for each model type:

```typescript
export const AUDIO_CONTAINERS: Record<string, ContainerImageConfig> = {
  'musicgen': {
    image: 'runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04',
    preInstall: ['audiocraft', 'xformers'],
    vram: 16,
  },
  'stable-audio': {
    image: 'runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04',
    preInstall: ['stable-audio-tools', 'einops'],
    vram: 24,
  },
  'so-vits-svc': {
    image: 'runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04',
    preInstall: ['so-vits-svc-fork'],
    vram: 8,
  },
  // ... all other models
};
```

## Output Files

Create/update:
1. server/src/services/training/trainers/audio-trainer.ts (complete rewrite)
2. server/src/services/training/trainers/audio/music-trainer.ts
3. server/src/services/training/trainers/audio/singing-trainer.ts
4. server/src/services/training/trainers/audio/speech-trainer.ts
5. server/src/services/training/trainers/audio/sfx-trainer.ts
6. server/src/services/training/trainers/audio/enhancement-trainer.ts
7. server/src/services/training/audio-types.ts
8. server/src/services/training/audio-containers.ts

Every training script must be REAL and EXECUTABLE. Test mentally that each script would actually train the model if run on a GPU.
```

---

## PROMPT 3: Universal Image Training System

```
/ultrathink
/context server/src/services/training/trainers/image-trainer.ts
/context server/src/services/training/types.ts

You are implementing a COMPLETE Universal Image Training System for KripTik AI.

## Image Capabilities to Support

### 1. Text-to-Image Fine-tuning
**Models:**
- Stable Diffusion 1.5, 2.0, 2.1
- SDXL, SDXL-Turbo
- Stable Diffusion 3, 3.5
- FLUX.1 (dev, schnell, pro)
- Kandinsky 2.x, 3.x
- PixArt-alpha, PixArt-Sigma
- Playground v2.5
- DeepFloyd IF
- Würstchen
- DALL-E style (if open weights available)

**Training Methods:**
- LoRA (Low-Rank Adaptation)
- DreamBooth
- Textual Inversion
- ControlNet training
- Full fine-tuning
- Pivotal Tuning
- Custom Diffusion
- LyCORIS (LoHa, LoKr, etc.)

### 2. Specialized Image Tasks
- **Subject/Character Training**: Consistent characters across images
- **Style Training**: Art style replication
- **Concept Training**: Teaching new concepts
- **Face Training**: Face-specific models
- **Product Photography**: E-commerce product generation
- **Architecture**: Building/interior generation
- **Fashion**: Clothing and outfit generation
- **Logo/Brand**: Logo and brand asset generation
- **Texture Generation**: Seamless textures
- **Background Generation**: Scene backgrounds
- **Icon Generation**: App icons, UI elements

### 3. Image-to-Image
- **Style Transfer**: Apply artistic styles
- **Inpainting**: Fill missing regions
- **Outpainting**: Extend images
- **Super Resolution**: Upscale images (Real-ESRGAN, SwinIR)
- **Restoration**: Fix old/damaged photos
- **Colorization**: Add color to B&W
- **Segmentation-aware editing**: Edit specific regions

### 4. Specialized Architectures
- **ControlNet**: Pose, depth, edge, segmentation control
- **IP-Adapter**: Image prompt adaptation
- **InstantID**: Identity preservation
- **PhotoMaker**: Subject-driven generation
- **BLIP/CLIP Training**: Vision-language alignment

## Implementation

### ImageTrainer Complete Implementation

```typescript
// server/src/services/training/trainers/image-trainer.ts

export class ImageTrainer {
  private config: ImageTrainingConfig;

  generateTrainingScript(): ImageTrainerResult {
    const scriptGenerator = this.getScriptGenerator();
    return {
      trainingScript: scriptGenerator.generate(),
      datasetScript: this.generateDatasetScript(),
      containerImage: this.getContainerImage(),
      environmentVariables: this.getEnvironmentVariables(),
      estimatedVRAM: this.estimateVRAM(),
    };
  }

  private getScriptGenerator(): BaseImageScriptGenerator {
    // Route to appropriate generator based on config
    const { baseModel, method } = this.config;

    if (this.isSDXL()) return new SDXLTrainingGenerator(this.config);
    if (this.isSD3()) return new SD3TrainingGenerator(this.config);
    if (this.isFlux()) return new FluxTrainingGenerator(this.config);
    if (this.isPixArt()) return new PixArtTrainingGenerator(this.config);
    // ... etc

    return new GenericDiffusersTrainingGenerator(this.config);
  }
}
```

### Real LoRA Training Script (SDXL Example)

```python
#!/usr/bin/env python3
"""
SDXL LoRA Training Script - KripTik AI
Production-ready, no placeholders
"""

import os
import torch
from accelerate import Accelerator
from diffusers import StableDiffusionXLPipeline, AutoencoderKL
from diffusers.training_utils import compute_snr
from transformers import CLIPTextModel, CLIPTokenizer
from peft import LoraConfig, get_peft_model
import bitsandbytes as bnb
from torch.utils.data import DataLoader
from datasets import load_dataset
import wandb

# Training configuration from environment
config = {
    "model_id": os.environ["BASE_MODEL_ID"],
    "output_dir": "/workspace/output",
    "resolution": int(os.environ.get("RESOLUTION", 1024)),
    "train_batch_size": int(os.environ.get("BATCH_SIZE", 1)),
    "gradient_accumulation_steps": int(os.environ.get("GRAD_ACCUM", 4)),
    "learning_rate": float(os.environ.get("LEARNING_RATE", 1e-4)),
    "lr_scheduler": os.environ.get("LR_SCHEDULER", "cosine"),
    "max_train_steps": int(os.environ.get("MAX_STEPS", 1000)),
    "lora_rank": int(os.environ.get("LORA_RANK", 16)),
    "lora_alpha": int(os.environ.get("LORA_ALPHA", 16)),
    "mixed_precision": os.environ.get("MIXED_PRECISION", "fp16"),
    "gradient_checkpointing": True,
    "use_8bit_adam": True,
    "snr_gamma": 5.0,
}

def main():
    accelerator = Accelerator(
        gradient_accumulation_steps=config["gradient_accumulation_steps"],
        mixed_precision=config["mixed_precision"],
    )

    # Load models
    vae = AutoencoderKL.from_pretrained(
        config["model_id"],
        subfolder="vae",
        torch_dtype=torch.float16
    )

    unet = UNet2DConditionModel.from_pretrained(
        config["model_id"],
        subfolder="unet",
        torch_dtype=torch.float16
    )

    text_encoder_one = CLIPTextModel.from_pretrained(
        config["model_id"],
        subfolder="text_encoder"
    )
    text_encoder_two = CLIPTextModelWithProjection.from_pretrained(
        config["model_id"],
        subfolder="text_encoder_2"
    )

    # Configure LoRA
    lora_config = LoraConfig(
        r=config["lora_rank"],
        lora_alpha=config["lora_alpha"],
        init_lora_weights="gaussian",
        target_modules=["to_k", "to_q", "to_v", "to_out.0"],
    )

    unet = get_peft_model(unet, lora_config)
    unet.print_trainable_parameters()

    # Freeze VAE and text encoders
    vae.requires_grad_(False)
    text_encoder_one.requires_grad_(False)
    text_encoder_two.requires_grad_(False)

    # Enable gradient checkpointing
    if config["gradient_checkpointing"]:
        unet.enable_gradient_checkpointing()

    # Optimizer
    if config["use_8bit_adam"]:
        optimizer = bnb.optim.AdamW8bit(
            unet.parameters(),
            lr=config["learning_rate"],
            betas=(0.9, 0.999),
            weight_decay=1e-2,
        )
    else:
        optimizer = torch.optim.AdamW(
            unet.parameters(),
            lr=config["learning_rate"],
        )

    # Load dataset
    dataset = load_dataset("imagefolder", data_dir="/workspace/dataset")

    # Preprocessing
    def preprocess(examples):
        images = [img.convert("RGB").resize((config["resolution"], config["resolution"]))
                  for img in examples["image"]]
        examples["pixel_values"] = [transforms.ToTensor()(img) for img in images]
        examples["input_ids"] = tokenize(examples["text"])
        return examples

    dataset = dataset.map(preprocess, batched=True)
    dataloader = DataLoader(dataset["train"], batch_size=config["train_batch_size"], shuffle=True)

    # Prepare with accelerator
    unet, optimizer, dataloader = accelerator.prepare(unet, optimizer, dataloader)

    # Training loop
    global_step = 0
    for epoch in range(num_epochs):
        unet.train()
        for batch in dataloader:
            with accelerator.accumulate(unet):
                # Encode images to latents
                latents = vae.encode(batch["pixel_values"]).latent_dist.sample()
                latents = latents * vae.config.scaling_factor

                # Sample noise
                noise = torch.randn_like(latents)
                timesteps = torch.randint(0, 1000, (latents.shape[0],), device=latents.device)

                # Add noise to latents
                noisy_latents = scheduler.add_noise(latents, noise, timesteps)

                # Get text embeddings
                encoder_hidden_states = encode_prompt(batch["input_ids"])

                # Predict noise
                noise_pred = unet(noisy_latents, timesteps, encoder_hidden_states).sample

                # Compute loss with SNR weighting
                snr = compute_snr(scheduler, timesteps)
                snr_weights = torch.stack([snr, config["snr_gamma"] * torch.ones_like(snr)], dim=1).min(dim=1)[0] / snr
                loss = F.mse_loss(noise_pred, noise, reduction="none")
                loss = loss.mean(dim=list(range(1, len(loss.shape)))) * snr_weights
                loss = loss.mean()

                accelerator.backward(loss)
                optimizer.step()
                optimizer.zero_grad()

            global_step += 1

            # Logging
            if global_step % 10 == 0:
                send_progress(global_step, config["max_train_steps"], loss.item())

            # Checkpointing
            if global_step % 500 == 0:
                save_checkpoint(unet, global_step)

            if global_step >= config["max_train_steps"]:
                break

    # Save final model
    unet.save_pretrained(config["output_dir"])

    # Upload to HuggingFace
    if os.environ.get("AUTO_UPLOAD"):
        from huggingface_hub import HfApi
        api = HfApi()
        api.upload_folder(
            folder_path=config["output_dir"],
            repo_id=os.environ["HF_REPO"],
            commit_message="Trained with KripTik AI"
        )

if __name__ == "__main__":
    main()
```

### DreamBooth Training Script

Include complete DreamBooth implementation using diffusers train_dreambooth.py patterns but self-contained.

### ControlNet Training Script

Include complete ControlNet training for custom control types.

## Types to Add

```typescript
export type ImageTask =
  | 'text_to_image'
  | 'subject_driven' // DreamBooth/LoRA for specific subjects
  | 'style_transfer'
  | 'concept_learning'
  | 'controlnet_training'
  | 'inpainting_model'
  | 'super_resolution'
  | 'image_restoration'
  | 'face_generation'
  | 'product_photography'
  | 'logo_generation'
  | 'texture_generation';

export type ImageBaseModel =
  | 'sd15' | 'sd20' | 'sd21'
  | 'sdxl' | 'sdxl-turbo'
  | 'sd3' | 'sd35' | 'sd35-large'
  | 'flux-dev' | 'flux-schnell'
  | 'kandinsky-22' | 'kandinsky-3'
  | 'pixart-alpha' | 'pixart-sigma'
  | 'playground-v25'
  | 'deepfloyd-if'
  | 'wurstchen';

export type ImageTrainingMethod =
  | 'lora'
  | 'dreambooth'
  | 'textual_inversion'
  | 'controlnet'
  | 'full_finetune'
  | 'pivotal_tuning'
  | 'custom_diffusion'
  | 'lycoris';
```

## Files to Create

1. server/src/services/training/trainers/image-trainer.ts (main)
2. server/src/services/training/trainers/image/sdxl-trainer.ts
3. server/src/services/training/trainers/image/sd3-trainer.ts
4. server/src/services/training/trainers/image/flux-trainer.ts
5. server/src/services/training/trainers/image/controlnet-trainer.ts
6. server/src/services/training/trainers/image/dreambooth-trainer.ts
7. server/src/services/training/image-types.ts
8. server/src/services/training/image-containers.ts

ALL scripts must be production-ready with REAL training loops. No simulated losses.
```

---

## PROMPT 4: Universal Video Training System

```
/ultrathink
/context server/src/services/training/trainers/video-trainer.ts
/context server/src/services/training/types.ts

You are implementing a COMPLETE Universal Video Training System for KripTik AI.

## Video Capabilities to Support

### 1. Text-to-Video Generation
**Models:**
- Wan 2.1 (Alibaba)
- HunyuanVideo
- CogVideoX
- OpenSora / OpenSora Plan
- Mochi 1
- AnimateDiff
- Stable Video Diffusion
- ModelScope Text-to-Video
- ZeroScope
- VideoCrafter
- LaVie
- Show-1
- Latte

**Training Methods:**
- LoRA fine-tuning
- Full fine-tuning (requires massive GPU)
- Motion module training
- Temporal layer adaptation

### 2. Image-to-Video Animation
- **Animate existing images**
- **Character animation**
- **Scene animation**
- **Talking head generation**

**Models:**
- Stable Video Diffusion (SVD)
- I2VGen-XL
- DynamiCrafter
- Emu Video
- PIA (Personalized Image Animator)

### 3. Video-to-Video
- **Style transfer**
- **Video enhancement**
- **Frame interpolation**
- **Video upscaling**
- **Video restoration**

**Models:**
- FILM (Frame Interpolation)
- Real-ESRGAN Video
- VideoRetalking (lip sync)
- Wav2Lip
- SadTalker

### 4. Specialized Video Tasks
- **Lip-sync generation**: Match video to audio
- **Talking head**: Generate talking videos from audio + image
- **Motion transfer**: Apply motion from one video to another
- **Green screen replacement**: AI-powered keying
- **VFX generation**: Special effects
- **Video continuation**: Extend videos
- **Music video generation**: Sync visuals to music

### 5. Long-form Video Generation
- Chunked generation with coherence
- Scene transitions
- Narrative consistency
- Multi-shot generation

## Implementation

### Real Training Scripts

**Wan 2.1 Training:**
```python
# Actual Wan2.1 LoRA training
import torch
from wan.models import WANModel
from peft import LoraConfig, get_peft_model

model = WANModel.from_pretrained("Wan-AI/Wan2.1-T2V-14B")

lora_config = LoraConfig(
    r=16,
    lora_alpha=16,
    target_modules=["to_q", "to_k", "to_v", "to_out.0"],
    lora_dropout=0.1,
)

model = get_peft_model(model, lora_config)

# Training loop with actual gradient updates
for batch in dataloader:
    video_latents = encode_video(batch["video"])
    text_embeddings = encode_text(batch["prompt"])

    noise = torch.randn_like(video_latents)
    timesteps = sample_timesteps(batch_size)
    noisy_latents = add_noise(video_latents, noise, timesteps)

    pred = model(noisy_latents, timesteps, text_embeddings)
    loss = F.mse_loss(pred, noise)

    loss.backward()
    optimizer.step()
    optimizer.zero_grad()
```

**AnimateDiff Training:**
```python
# Motion module training
from animatediff.models.motion_module import MotionModule

motion_module = MotionModule(
    in_channels=320,
    temporal_position_encoding=True,
    temporal_position_encoding_max_len=32,
)

# Train motion patterns
for batch in dataloader:
    frames = batch["frames"]  # [B, F, C, H, W]

    # Extract spatial features using frozen SD
    with torch.no_grad():
        spatial_features = sd_unet.get_features(frames)

    # Train motion module
    temporal_features = motion_module(spatial_features)
    reconstruction = decoder(temporal_features)

    loss = F.mse_loss(reconstruction, frames)
    loss.backward()
    optimizer.step()
```

### Video Types

```typescript
export type VideoTask =
  | 'text_to_video'
  | 'image_to_video'
  | 'video_style_transfer'
  | 'video_enhancement'
  | 'frame_interpolation'
  | 'video_upscaling'
  | 'lip_sync'
  | 'talking_head'
  | 'motion_transfer'
  | 'video_continuation'
  | 'music_video'
  | 'vfx_generation';

export type VideoBaseModel =
  | 'wan-2.1' | 'wan-1.3'
  | 'hunyuan-video'
  | 'cogvideo-x'
  | 'open-sora' | 'open-sora-plan'
  | 'mochi-1'
  | 'animate-diff'
  | 'svd' | 'svd-xt'
  | 'modelscope'
  | 'zeroscope'
  | 'video-crafter'
  | 'dynamicrafter'
  | 'sadtalker'
  | 'wav2lip';

export interface VideoTrainingConfig extends BaseTrainingConfig {
  modality: 'video';
  videoTask: VideoTask;
  baseModel: VideoBaseModel;

  // Video specs
  resolution: { width: number; height: number };
  frameCount: number;
  fps: number;
  duration: number; // seconds

  // Training specific
  temporalChunkSize?: number;
  motionStrength?: number;

  // Talking head specific
  talkingHeadConfig?: {
    audioPath?: string;
    lipSyncStrength?: number;
    headMovement?: boolean;
    blinkRate?: number;
  };

  // Style transfer specific
  styleTransferConfig?: {
    styleVideo?: string;
    styleStrength?: number;
    preserveMotion?: boolean;
  };
}
```

## Files to Create

1. server/src/services/training/trainers/video-trainer.ts (main, complete rewrite)
2. server/src/services/training/trainers/video/wan-trainer.ts
3. server/src/services/training/trainers/video/animatediff-trainer.ts
4. server/src/services/training/trainers/video/svd-trainer.ts
5. server/src/services/training/trainers/video/talking-head-trainer.ts
6. server/src/services/training/trainers/video/motion-transfer-trainer.ts
7. server/src/services/training/video-types.ts
8. server/src/services/training/video-containers.ts

ALL training code must be REAL. Include actual training loops with gradient updates.
```

---

## PROMPT 5: Universal LLM Training System Enhancement

```
/ultrathink
/context server/src/services/training/trainers/llm-trainer.ts
/context server/src/services/training/types.ts

Enhance the existing LLM trainer to support ALL possible LLM training scenarios.

## Additional LLM Capabilities

### 1. Model Architectures to Support
- Llama 2/3, Llama 3.1/3.2
- Mistral, Mixtral
- Qwen 1.5/2/2.5
- Phi-2/3/4
- Gemma 1/2
- DeepSeek V2/V3
- Yi
- InternLM
- Command-R
- DBRX
- Falcon
- MPT
- StableLM
- OpenHermes
- Nous variants
- WizardLM
- Orca variants
- Code-specific (CodeLlama, StarCoder, DeepSeek-Coder)

### 2. Training Methods
- **LoRA/QLoRA** (already implemented, enhance)
- **Full Fine-tuning** with FSDP/DeepSpeed
- **Continued Pre-training** (domain adaptation)
- **Instruction Tuning** (SFT)
- **RLHF/DPO/PPO** (preference learning)
- **ORPO** (Odds Ratio Preference Optimization)
- **KTO** (Kahneman-Tversky Optimization)
- **IPO** (Identity Preference Optimization)
- **Rejection Sampling Fine-tuning**
- **Constitutional AI training**
- **Distillation** (teacher → student)
- **Merging** (model merging/TIES/DARE)
- **Multimodal extension** (add vision/audio to LLM)

### 3. Dataset Formats
- Alpaca
- ShareGPT
- OpenAI format
- Conversation
- Completion
- DPO pairs (chosen/rejected)
- RLHF format
- Custom templates

### 4. Specialized Training
- **Code Models**: Function calling, code completion, debugging
- **Math Models**: Chain-of-thought, step-by-step reasoning
- **Agent Training**: Tool use, function calling, ReAct
- **RAG Training**: Retrieval-augmented generation
- **Long Context**: Training for extended context windows
- **Multilingual**: Language-specific adaptation

## Enhanced Implementation

Add to LLMTrainer:

```typescript
// DPO Training
generateDPOTrainingScript(): string {
  return `
from trl import DPOTrainer, DPOConfig
from transformers import AutoModelForCausalLM, AutoTokenizer
from datasets import load_dataset

model = AutoModelForCausalLM.from_pretrained("${this.config.baseModelId}")
ref_model = AutoModelForCausalLM.from_pretrained("${this.config.baseModelId}")
tokenizer = AutoTokenizer.from_pretrained("${this.config.baseModelId}")

# DPO dataset format: prompt, chosen, rejected
dataset = load_dataset("${this.config.datasetConfig.datasetId}")

training_args = DPOConfig(
    output_dir="${this.config.outputDir}",
    beta=${this.config.dpoConfig?.beta || 0.1},
    learning_rate=${this.config.learningRate},
    per_device_train_batch_size=${this.config.batchSize},
    gradient_accumulation_steps=${this.config.gradientAccumulationSteps},
    num_train_epochs=${this.config.epochs},
    bf16=True,
)

trainer = DPOTrainer(
    model=model,
    ref_model=ref_model,
    args=training_args,
    train_dataset=dataset["train"],
    tokenizer=tokenizer,
)

trainer.train()
trainer.save_model()
`;
}

// ORPO Training
generateORPOTrainingScript(): string {
  return `
from trl import ORPOTrainer, ORPOConfig
# ... complete ORPO implementation
`;
}

// Continued Pre-training
generateCPTScript(): string {
  return `
# Continued pre-training for domain adaptation
from transformers import Trainer, TrainingArguments, DataCollatorForLanguageModeling

model = AutoModelForCausalLM.from_pretrained("${this.config.baseModelId}")
tokenizer = AutoTokenizer.from_pretrained("${this.config.baseModelId}")

# Load domain-specific corpus
dataset = load_dataset("text", data_files="${this.config.datasetConfig.dataUrl}")

def tokenize_function(examples):
    return tokenizer(examples["text"], truncation=True, max_length=${this.config.maxSeqLength})

tokenized_dataset = dataset.map(tokenize_function, batched=True, remove_columns=["text"])

data_collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)

training_args = TrainingArguments(
    output_dir="${this.config.outputDir}",
    num_train_epochs=${this.config.epochs},
    per_device_train_batch_size=${this.config.batchSize},
    gradient_accumulation_steps=${this.config.gradientAccumulationSteps},
    learning_rate=${this.config.learningRate},
    bf16=True,
    gradient_checkpointing=True,
    save_strategy="steps",
    save_steps=500,
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_dataset["train"],
    data_collator=data_collator,
)

trainer.train()
`;
}

// Multi-GPU with DeepSpeed
generateDeepSpeedConfig(): object {
  return {
    "bf16": { "enabled": true },
    "zero_optimization": {
      "stage": 3,
      "offload_optimizer": { "device": "cpu" },
      "offload_param": { "device": "cpu" },
      "overlap_comm": true,
      "contiguous_gradients": true,
      "reduce_bucket_size": "auto",
      "stage3_prefetch_bucket_size": "auto",
      "stage3_param_persistence_threshold": "auto",
      "stage3_max_live_parameters": 1e9,
      "stage3_max_reuse_distance": 1e9,
      "stage3_gather_16bit_weights_on_model_save": true
    },
    "gradient_accumulation_steps": this.config.gradientAccumulationSteps,
    "train_batch_size": "auto",
    "train_micro_batch_size_per_gpu": this.config.batchSize,
  };
}
```

### Enhanced Types

```typescript
export type LLMTrainingMethod =
  | 'lora'
  | 'qlora'
  | 'full_finetune'
  | 'dpo'
  | 'orpo'
  | 'kto'
  | 'ipo'
  | 'ppo'
  | 'sft'
  | 'continued_pretraining'
  | 'distillation'
  | 'merging';

export interface LLMTrainingConfig extends BaseTrainingConfig {
  // Add new fields
  preferenceConfig?: {
    beta?: number;
    method: 'dpo' | 'orpo' | 'kto' | 'ipo';
    referenceModel?: string;
  };

  distillationConfig?: {
    teacherModel: string;
    temperature: number;
    alpha: number; // blend between hard and soft targets
  };

  mergingConfig?: {
    method: 'ties' | 'dare' | 'linear' | 'slerp';
    models: string[];
    weights?: number[];
  };

  deepSpeedConfig?: object;
  fsdpConfig?: object;
}
```

Create complete implementations for ALL methods. No placeholders.
```

---

## PROMPT 6: Dynamic Pipeline Builder

```
/ultrathink

You are implementing the Dynamic Pipeline Builder for KripTik AI. This component takes a TrainingIntentPlan and constructs the actual execution pipeline, including:

1. Downloading/installing required models and packages
2. Setting up data preprocessing
3. Configuring training scripts
4. Orchestrating multi-model training
5. Wiring models together for inference

## Core Concept

When a user wants something complex like "music with vocals", the system needs to:
1. Train/fine-tune a music generation model (e.g., MusicGen)
2. Train/fine-tune a singing voice model (e.g., So-VITS-SVC)
3. Optionally train a lyrics-to-phoneme model
4. Create an inference pipeline that chains them together

## Implementation

### File: server/src/services/training/pipeline-builder.ts

```typescript
export class DynamicPipelineBuilder {
  private config: TrainingIntentPlan;
  private modelDiscovery: ModelDiscoveryService;
  private orchestrator: MultiModalTrainingOrchestrator;

  constructor(plan: TrainingIntentPlan) {
    this.config = plan;
    this.modelDiscovery = new ModelDiscoveryService();
    this.orchestrator = getMultiModalTrainingOrchestrator();
  }

  /**
   * Build the complete pipeline from the intent plan
   */
  async buildPipeline(): Promise<ExecutablePipeline> {
    const pipeline: ExecutablePipeline = {
      id: uuidv4(),
      planId: this.config.id,
      stages: [],
      status: 'building',
    };

    // Stage 1: Dependency Installation
    pipeline.stages.push(await this.buildInstallationStage());

    // Stage 2: Model Downloads
    pipeline.stages.push(await this.buildModelDownloadStage());

    // Stage 3: Data Preprocessing
    pipeline.stages.push(await this.buildPreprocessingStage());

    // Stage 4: Training (potentially multiple parallel/sequential jobs)
    const trainingStages = await this.buildTrainingStages();
    pipeline.stages.push(...trainingStages);

    // Stage 5: Model Wiring (for multi-model pipelines)
    if (this.config.modelPlan.pipelineType !== 'single') {
      pipeline.stages.push(await this.buildWiringStage());
    }

    // Stage 6: Evaluation
    pipeline.stages.push(await this.buildEvaluationStage());

    // Stage 7: Deployment
    pipeline.stages.push(await this.buildDeploymentStage());

    return pipeline;
  }

  /**
   * Determine what packages need to be installed
   */
  private async buildInstallationStage(): Promise<PipelineStage> {
    const packages = new Set<string>();

    for (const model of this.config.modelPlan.models) {
      const requirements = await this.getModelRequirements(model.suggestedModels[0]);
      requirements.packages.forEach(p => packages.add(p));
    }

    return {
      name: 'dependency_installation',
      type: 'install',
      commands: [
        `pip install ${Array.from(packages).join(' ')}`,
        ...this.config.integrations.packagesToInstall.map(p => `pip install ${p}`),
      ],
      timeout: 600,
    };
  }

  /**
   * Build training stages - handles single or multi-model
   */
  private async buildTrainingStages(): Promise<PipelineStage[]> {
    const stages: PipelineStage[] = [];

    if (this.config.modelPlan.pipelineType === 'single') {
      // Single model training
      const modelPlan = this.config.modelPlan.models[0];
      stages.push({
        name: 'training',
        type: 'train',
        trainingConfig: this.buildTrainingConfig(modelPlan),
        timeout: 86400, // 24 hours max
      });
    } else if (this.config.modelPlan.pipelineType === 'sequential') {
      // Sequential training (one after another)
      for (const [index, modelPlan] of this.config.modelPlan.models.entries()) {
        stages.push({
          name: `training_${modelPlan.role}`,
          type: 'train',
          trainingConfig: this.buildTrainingConfig(modelPlan),
          dependsOn: index > 0 ? [`training_${this.config.modelPlan.models[index-1].role}`] : [],
          timeout: 86400,
        });
      }
    } else if (this.config.modelPlan.pipelineType === 'parallel') {
      // Parallel training (all at once, if resources allow)
      for (const modelPlan of this.config.modelPlan.models) {
        stages.push({
          name: `training_${modelPlan.role}`,
          type: 'train',
          trainingConfig: this.buildTrainingConfig(modelPlan),
          parallel: true,
          timeout: 86400,
        });
      }
    }

    return stages;
  }

  /**
   * Build model wiring for multi-model pipelines
   */
  private async buildWiringStage(): Promise<PipelineStage> {
    // Generate the inference pipeline code that chains models together
    const wiringCode = this.generateWiringCode();

    return {
      name: 'model_wiring',
      type: 'configure',
      script: wiringCode,
      outputs: ['inference_pipeline.py', 'pipeline_config.json'],
    };
  }

  /**
   * Generate inference pipeline that chains multiple models
   */
  private generateWiringCode(): string {
    const models = this.config.modelPlan.models;

    if (this.isMusicWithVocalsPipeline()) {
      return this.generateMusicVocalsPipeline();
    }

    if (this.isImageThenVideoPipeline()) {
      return this.generateImageToVideoPipeline();
    }

    // Generic chaining
    return this.generateGenericPipeline();
  }

  /**
   * Music + Vocals pipeline (Suno-like)
   */
  private generateMusicVocalsPipeline(): string {
    return `
"""
Music + Vocals Generation Pipeline
Generated by KripTik AI
"""

import torch
from typing import Optional

class MusicVocalsPipeline:
    def __init__(
        self,
        music_model_path: str,
        vocals_model_path: str,
        device: str = "cuda"
    ):
        self.device = device

        # Load music generation model
        from audiocraft.models import MusicGen
        self.music_model = MusicGen.get_pretrained(music_model_path)
        self.music_model.to(device)

        # Load vocals model
        from so_vits_svc_fork.inference.main import infer
        self.vocals_model_path = vocals_model_path

    def generate(
        self,
        prompt: str,
        lyrics: Optional[str] = None,
        duration: int = 30,
        vocal_style: str = "default"
    ) -> torch.Tensor:
        # Step 1: Generate instrumental
        self.music_model.set_generation_params(duration=duration)
        instrumental = self.music_model.generate([prompt])

        # Step 2: If lyrics provided, generate vocals
        if lyrics:
            # Convert lyrics to singing
            vocals = self.generate_vocals(lyrics, vocal_style, duration)

            # Step 3: Mix instrumental and vocals
            output = self.mix_audio(instrumental, vocals)
        else:
            output = instrumental

        return output

    def generate_vocals(self, lyrics: str, style: str, duration: int) -> torch.Tensor:
        # Generate TTS first
        from TTS.api import TTS
        tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")
        speech_audio = tts.tts(lyrics)

        # Convert speech to singing using So-VITS-SVC
        from so_vits_svc_fork.inference.main import infer
        singing_audio = infer(
            model_path=self.vocals_model_path,
            input_path=speech_audio,
            output_path="temp_vocals.wav"
        )

        return singing_audio

    def mix_audio(self, instrumental: torch.Tensor, vocals: torch.Tensor) -> torch.Tensor:
        # Simple mixing - can be enhanced with proper mastering
        import torchaudio

        # Normalize
        instrumental = instrumental / instrumental.abs().max()
        vocals = vocals / vocals.abs().max()

        # Mix with standard ratios
        mixed = 0.7 * instrumental + 0.5 * vocals

        return mixed
`;
  }
}
```

### Types

```typescript
interface ExecutablePipeline {
  id: string;
  planId: string;
  stages: PipelineStage[];
  status: 'building' | 'ready' | 'executing' | 'completed' | 'failed';
  currentStage?: number;
  outputs?: Record<string, string>;
}

interface PipelineStage {
  name: string;
  type: 'install' | 'download' | 'preprocess' | 'train' | 'configure' | 'evaluate' | 'deploy';
  commands?: string[];
  script?: string;
  trainingConfig?: TrainingConfig;
  dependsOn?: string[];
  parallel?: boolean;
  timeout: number;
  outputs?: string[];
  status?: 'pending' | 'running' | 'completed' | 'failed';
}
```

## Files to Create

1. server/src/services/training/pipeline-builder.ts
2. server/src/services/training/pipeline-types.ts
3. server/src/services/training/pipeline-executor.ts
4. server/src/services/training/pipeline-templates/music-vocals-pipeline.ts
5. server/src/services/training/pipeline-templates/image-to-video-pipeline.ts
6. server/src/services/training/pipeline-templates/multimodal-pipeline.ts

All code must be complete and production-ready.
```

---

## PROMPT 7: Model Auto-Discovery & Integration

```
/ultrathink
/context server/src/services/discovery/model-discovery.ts
/context server/src/services/ml/huggingface.ts

Enhance the model discovery system to automatically find, evaluate, and integrate ANY model needed for a training pipeline.

## Requirements

### 1. Comprehensive Model Search

Search across:
- HuggingFace Hub (primary)
- Replicate
- Together AI
- CivitAI (for SD models)
- GitHub releases
- ModelScope (Alibaba)
- Ollama registry

### 2. Capability Matching

For any required capability, find the best available model:

```typescript
interface CapabilityModelMap {
  // Audio/Music
  'music_generation': ['facebook/musicgen-large', 'stability-ai/stable-audio-open-1.0'],
  'singing_voice_synthesis': ['so-vits-svc', 'rvc-models/*', 'amphion/*'],
  'speech_synthesis': ['coqui/XTTS-v2', 'bark', 'fish-speech/*'],
  'voice_cloning': ['coqui/XTTS-v2', 'openvoice/*'],

  // Image
  'text_to_image': ['stabilityai/stable-diffusion-xl-base-1.0', 'black-forest-labs/FLUX.1-dev'],
  'image_editing': ['timbrooks/instruct-pix2pix', 'runwayml/stable-diffusion-inpainting'],
  'super_resolution': ['philz1337x/clarity-upscaler', 'ai-forever/Real-ESRGAN'],

  // Video
  'text_to_video': ['Wan-AI/Wan2.1-T2V-14B', 'tencent/HunyuanVideo'],
  'image_to_video': ['stabilityai/stable-video-diffusion-img2vid-xt'],
  'talking_head': ['coqui/SadTalker', 'Rudrabha/Wav2Lip'],

  // LLM
  'text_generation': ['meta-llama/Llama-3.1-8B-Instruct', 'Qwen/Qwen2.5-7B-Instruct'],
  'code_generation': ['deepseek-ai/deepseek-coder-6.7b-instruct'],
}
```

### 3. Model Evaluation Criteria

Score models by:
- Downloads/popularity
- Last updated (prefer recent)
- License compatibility
- Training method support
- VRAM requirements vs available
- Community trust score
- Benchmark performance (if available)

### 4. Auto-Integration

When a model is needed but not in the system:

1. **Detect model type** from HuggingFace model card
2. **Generate appropriate training script** based on model architecture
3. **Determine container requirements** (CUDA version, packages)
4. **Create inference wrapper** for the model
5. **Test compatibility** before adding to pipeline

### 5. Dynamic Package Resolution

```typescript
interface PackageResolver {
  resolveForModel(modelId: string): Promise<{
    pythonPackages: string[];
    systemPackages: string[];
    cudaVersion: string;
    dockerImage: string;
    setupScript: string;
  }>;
}
```

## Implementation

### EnhancedModelDiscoveryService

```typescript
export class EnhancedModelDiscoveryService extends ModelDiscoveryService {

  /**
   * Find best model for a specific capability
   */
  async findModelForCapability(
    capability: string,
    constraints: ModelConstraints
  ): Promise<ModelRecommendation[]> {
    // 1. Check known good models first
    const knownModels = CAPABILITY_MODEL_MAP[capability] || [];

    // 2. Search HuggingFace for matching models
    const searchResults = await this.searchHuggingFace({
      requirement: capability,
      taskType: this.capabilityToTask(capability),
      minDownloads: 100,
      maxResults: 20,
    });

    // 3. Score and rank
    const scored = await this.scoreModels([...knownModels, ...searchResults], constraints);

    // 4. Verify training support
    const verified = await this.verifyTrainingSupport(scored);

    return verified;
  }

  /**
   * Automatically integrate a new model into the system
   */
  async autoIntegrateModel(modelId: string): Promise<IntegrationResult> {
    // 1. Fetch model info
    const modelInfo = await this.getHuggingFaceModelInfo(modelId);

    // 2. Detect architecture
    const architecture = this.detectArchitecture(modelInfo);

    // 3. Generate training script template
    const trainingScript = await this.generateTrainingScript(modelId, architecture);

    // 4. Determine dependencies
    const dependencies = await this.resolveDependencies(modelId, architecture);

    // 5. Generate inference wrapper
    const inferenceWrapper = await this.generateInferenceWrapper(modelId, architecture);

    // 6. Test integration
    const testResult = await this.testIntegration(modelId, trainingScript, inferenceWrapper);

    return {
      modelId,
      success: testResult.success,
      trainingScript,
      inferenceWrapper,
      dependencies,
      containerImage: dependencies.dockerImage,
    };
  }

  /**
   * Detect model architecture from model card and config
   */
  private detectArchitecture(model: HuggingFaceModel): ModelArchitecture {
    const { pipeline_tag, library_name, config, tags } = model;

    // Diffusion models
    if (library_name === 'diffusers' || tags?.includes('diffusers')) {
      if (tags?.includes('flux')) return 'flux';
      if (tags?.includes('sdxl')) return 'sdxl';
      if (tags?.includes('sd3')) return 'sd3';
      if (tags?.includes('stable-diffusion')) return 'stable-diffusion';
      return 'diffusers-generic';
    }

    // Audio models
    if (pipeline_tag === 'text-to-audio' || pipeline_tag === 'text-to-speech') {
      if (tags?.includes('audiocraft')) return 'audiocraft';
      if (tags?.includes('bark')) return 'bark';
      if (tags?.includes('tts')) return 'tts-generic';
      return 'audio-generic';
    }

    // LLMs
    if (pipeline_tag === 'text-generation') {
      if (config?.architectures?.includes('LlamaForCausalLM')) return 'llama';
      if (config?.architectures?.includes('MistralForCausalLM')) return 'mistral';
      if (config?.architectures?.includes('Qwen2ForCausalLM')) return 'qwen';
      return 'transformers-causal-lm';
    }

    return 'unknown';
  }

  /**
   * Generate training script for detected architecture
   */
  private async generateTrainingScript(
    modelId: string,
    architecture: ModelArchitecture
  ): Promise<string> {
    const generators: Record<ModelArchitecture, () => string> = {
      'flux': () => this.generateFluxTraining(modelId),
      'sdxl': () => this.generateSDXLTraining(modelId),
      'sd3': () => this.generateSD3Training(modelId),
      'audiocraft': () => this.generateAudiocraftTraining(modelId),
      'bark': () => this.generateBarkTraining(modelId),
      'llama': () => this.generateLlamaTraining(modelId),
      // ... all architectures
    };

    const generator = generators[architecture] || (() => this.generateGenericTraining(modelId));
    return generator();
  }
}
```

## Files to Create

1. server/src/services/discovery/enhanced-model-discovery.ts
2. server/src/services/discovery/capability-mapper.ts
3. server/src/services/discovery/architecture-detector.ts
4. server/src/services/discovery/auto-integrator.ts
5. server/src/services/discovery/package-resolver.ts
6. server/src/services/discovery/model-tester.ts

All implementations must be complete and production-ready.
```

---

## PROMPT 8: Training Configuration Optimizer

```
/ultrathink

Implement a Training Configuration Optimizer that automatically determines optimal hyperparameters for ANY training job, balancing quality vs speed based on user preference.

## Core Concept

Users select one of three presets:
1. **Maximum Quality**: Best possible results, time/cost is secondary
2. **Balanced**: Good quality with reasonable time/cost
3. **Maximum Speed**: Fastest possible training that still produces usable results

The optimizer then configures:
- Learning rate and schedule
- Batch size and gradient accumulation
- Number of steps/epochs
- LoRA rank/alpha
- Mixed precision settings
- Gradient checkpointing
- Data augmentation
- Regularization
- Optimizer selection
- GPU selection

## Implementation

### File: server/src/services/training/config-optimizer.ts

```typescript
export class TrainingConfigOptimizer {

  /**
   * Optimize configuration for the given training job
   */
  async optimize(
    baseConfig: TrainingConfig,
    preset: 'maximum_quality' | 'balanced' | 'maximum_speed',
    constraints: OptimizationConstraints
  ): Promise<OptimizedConfig> {

    const optimizer = this.getModalityOptimizer(baseConfig.modality);

    // Get base recommendations
    const baseRecommendations = optimizer.getBaseRecommendations(baseConfig, preset);

    // Adjust for available resources
    const resourceAdjusted = this.adjustForResources(baseRecommendations, constraints);

    // Adjust for dataset size
    const datasetAdjusted = this.adjustForDatasetSize(resourceAdjusted, constraints.datasetSize);

    // Apply preset-specific overrides
    const presetApplied = this.applyPreset(datasetAdjusted, preset);

    // Validate configuration
    const validated = this.validateConfig(presetApplied);

    return {
      config: validated,
      reasoning: this.generateReasoning(baseConfig, validated, preset),
      estimatedTime: this.estimateTime(validated),
      estimatedCost: this.estimateCost(validated),
      warnings: this.checkForWarnings(validated),
    };
  }

  /**
   * LLM-specific optimization
   */
  private optimizeLLM(
    config: LLMTrainingConfig,
    preset: string
  ): Partial<LLMTrainingConfig> {
    const presets = {
      maximum_quality: {
        epochs: 5,
        learningRate: 1e-5,
        batchSize: 1,
        gradientAccumulationSteps: 16,
        loraConfig: { rank: 64, alpha: 128, dropout: 0.05 },
        warmupSteps: 200,
        scheduler: 'cosine_with_restarts',
        optimizer: 'adamw',
        useUnsloth: false, // Full precision for max quality
        gradientCheckpointing: true,
      },
      balanced: {
        epochs: 3,
        learningRate: 2e-5,
        batchSize: 2,
        gradientAccumulationSteps: 8,
        loraConfig: { rank: 32, alpha: 64, dropout: 0.05 },
        warmupSteps: 100,
        scheduler: 'cosine',
        optimizer: 'paged_adamw_8bit',
        useUnsloth: true,
        gradientCheckpointing: true,
      },
      maximum_speed: {
        epochs: 1,
        learningRate: 5e-5,
        batchSize: 4,
        gradientAccumulationSteps: 4,
        loraConfig: { rank: 8, alpha: 16, dropout: 0.1 },
        warmupSteps: 50,
        scheduler: 'linear',
        optimizer: 'paged_adamw_8bit',
        useUnsloth: true,
        gradientCheckpointing: true,
        quantization: '4bit',
      },
    };

    return presets[preset];
  }

  /**
   * Image-specific optimization
   */
  private optimizeImage(
    config: ImageTrainingConfig,
    preset: string
  ): Partial<ImageTrainingConfig> {
    const presets = {
      maximum_quality: {
        steps: 2000,
        learningRate: 5e-5,
        batchSize: 1,
        resolution: 1024,
        loraConfig: { rank: 128, alpha: 128, networkDim: 128 },
        textEncoderTraining: true,
        snrGamma: 5.0,
        mixedPrecision: 'bf16',
        gradientCheckpointing: true,
        cacheLatents: true,
      },
      balanced: {
        steps: 1000,
        learningRate: 1e-4,
        batchSize: 1,
        resolution: 1024,
        loraConfig: { rank: 32, alpha: 32, networkDim: 32 },
        textEncoderTraining: false,
        snrGamma: 5.0,
        mixedPrecision: 'fp16',
        gradientCheckpointing: true,
        cacheLatents: true,
      },
      maximum_speed: {
        steps: 500,
        learningRate: 2e-4,
        batchSize: 2,
        resolution: 768,
        loraConfig: { rank: 8, alpha: 8, networkDim: 8 },
        textEncoderTraining: false,
        mixedPrecision: 'fp16',
        gradientCheckpointing: false,
        cacheLatents: true,
      },
    };

    return presets[preset];
  }

  /**
   * Audio-specific optimization
   */
  private optimizeAudio(
    config: AudioTrainingConfig,
    preset: string
  ): Partial<AudioTrainingConfig> {
    // Similar structure for audio
  }

  /**
   * Video-specific optimization
   */
  private optimizeVideo(
    config: VideoTrainingConfig,
    preset: string
  ): Partial<VideoTrainingConfig> {
    // Similar structure for video
  }

  /**
   * GPU selection based on requirements and preset
   */
  selectGPU(
    vramRequired: number,
    preset: string
  ): GPURecommendation {
    const gpus = [
      { type: 'nvidia-rtx-3090', vram: 24, costPerHour: 0.44 },
      { type: 'nvidia-rtx-4090', vram: 24, costPerHour: 0.74 },
      { type: 'nvidia-a40', vram: 48, costPerHour: 0.79 },
      { type: 'nvidia-l40', vram: 48, costPerHour: 0.99 },
      { type: 'nvidia-a100-40gb', vram: 40, costPerHour: 1.89 },
      { type: 'nvidia-a100-80gb', vram: 80, costPerHour: 2.49 },
      { type: 'nvidia-h100', vram: 80, costPerHour: 4.25 },
    ];

    // Filter by VRAM
    const capable = gpus.filter(g => g.vram >= vramRequired);

    if (preset === 'maximum_speed') {
      // Get the fastest capable GPU
      return capable.sort((a, b) => b.costPerHour - a.costPerHour)[0];
    } else if (preset === 'balanced') {
      // Middle ground
      return capable[Math.floor(capable.length / 2)];
    } else {
      // Maximum quality - still fast but not the most expensive
      return capable.sort((a, b) => a.costPerHour - b.costPerHour)[0];
    }
  }
}
```

## Files to Create

1. server/src/services/training/config-optimizer.ts
2. server/src/services/training/optimizers/llm-optimizer.ts
3. server/src/services/training/optimizers/image-optimizer.ts
4. server/src/services/training/optimizers/audio-optimizer.ts
5. server/src/services/training/optimizers/video-optimizer.ts
6. server/src/services/training/gpu-selector.ts

All optimizations must be based on real-world best practices and tested configurations.
```

---

## PROMPT 9: Comprehensive Dataset Preprocessor

```
/ultrathink

Implement a Universal Dataset Preprocessor that can prepare data for ANY type of training job.

## Requirements

### Data Types to Support

**Audio Data:**
- Voice recordings (WAV, MP3, FLAC)
- Music files
- Voice samples for cloning
- Transcripts/captions
- MIDI files
- Stem-separated tracks

**Image Data:**
- JPG, PNG, WebP images
- With or without captions
- Subject photos for DreamBooth
- Style reference images
- Mask images for inpainting
- ControlNet conditioning images (pose, depth, edge)

**Video Data:**
- MP4, MOV, AVI files
- Frame sequences
- With audio or silent
- Captions/descriptions

**Text Data:**
- JSON, JSONL, CSV, Parquet
- Alpaca format
- ShareGPT format
- OpenAI format
- Raw text corpus
- DPO pairs

### Preprocessing Operations

**Audio:**
- Resampling to target sample rate
- Normalization (peak, LUFS)
- Silence trimming
- Noise removal
- Speaker diarization
- Transcript alignment (forced alignment)
- Stem separation
- Audio segmentation

**Image:**
- Resizing with aspect ratio handling
- Center crop / random crop
- Caption generation (auto via BLIP)
- Face detection and cropping
- Background removal
- Color normalization
- Augmentation (flip, rotate, etc.)

**Video:**
- Frame extraction
- Temporal downsampling
- Resolution adjustment
- Audio extraction
- Scene detection
- Caption generation

**Text:**
- Format conversion
- Tokenization statistics
- Deduplication
- Quality filtering
- Length filtering
- Template application

## Implementation

### File: server/src/services/training/dataset-preprocessor.ts

```typescript
export class UniversalDatasetPreprocessor {

  /**
   * Preprocess dataset based on modality
   */
  async preprocess(
    inputPath: string,
    modality: ModelModality,
    config: PreprocessConfig
  ): Promise<PreprocessResult> {

    switch (modality) {
      case 'audio':
        return this.preprocessAudio(inputPath, config);
      case 'image':
        return this.preprocessImage(inputPath, config);
      case 'video':
        return this.preprocessVideo(inputPath, config);
      case 'llm':
        return this.preprocessText(inputPath, config);
      default:
        throw new Error(`Unsupported modality: ${modality}`);
    }
  }

  /**
   * Audio preprocessing
   */
  private async preprocessAudio(
    inputPath: string,
    config: AudioPreprocessConfig
  ): Promise<PreprocessResult> {
    const script = `
import os
import librosa
import soundfile as sf
import numpy as np
from pathlib import Path
import json
from tqdm import tqdm

input_dir = Path("${inputPath}")
output_dir = Path("/workspace/dataset/processed")
output_dir.mkdir(parents=True, exist_ok=True)

target_sr = ${config.sampleRate}
normalize = ${config.normalize}
trim_silence = ${config.trimSilence}
min_duration = ${config.minDuration || 1}
max_duration = ${config.maxDuration || 30}

metadata = []

audio_files = list(input_dir.glob("**/*.wav")) + \\
              list(input_dir.glob("**/*.mp3")) + \\
              list(input_dir.glob("**/*.flac"))

for audio_file in tqdm(audio_files, desc="Processing audio"):
    try:
        # Load audio
        y, sr = librosa.load(str(audio_file), sr=target_sr)

        # Trim silence
        if trim_silence:
            y, _ = librosa.effects.trim(y, top_db=30)

        # Check duration
        duration = len(y) / target_sr
        if duration < min_duration or duration > max_duration:
            print(f"Skipping {audio_file.name}: duration {duration:.1f}s out of range")
            continue

        # Normalize
        if normalize:
            y = y / np.abs(y).max() * 0.95

        # Save processed audio
        output_file = output_dir / f"{audio_file.stem}.wav"
        sf.write(str(output_file), y, target_sr)

        # Check for transcript
        transcript = ""
        transcript_file = audio_file.with_suffix(".txt")
        if transcript_file.exists():
            transcript = transcript_file.read_text().strip()

        metadata.append({
            "audio_file": str(output_file),
            "duration": duration,
            "sample_rate": target_sr,
            "transcript": transcript,
            "original_file": str(audio_file),
        })

    except Exception as e:
        print(f"Error processing {audio_file}: {e}")

# Save metadata
with open(output_dir / "metadata.json", "w") as f:
    json.dump(metadata, f, indent=2)

print(f"Processed {len(metadata)} audio files")
print(f"Total duration: {sum(m['duration'] for m in metadata):.1f}s")
`;

    return {
      script,
      estimatedTime: this.estimateAudioProcessingTime(inputPath, config),
    };
  }

  /**
   * Image preprocessing
   */
  private async preprocessImage(
    inputPath: string,
    config: ImagePreprocessConfig
  ): Promise<PreprocessResult> {
    const script = `
import os
from PIL import Image
from pathlib import Path
import json
from tqdm import tqdm
import torch

input_dir = Path("${inputPath}")
output_dir = Path("/workspace/dataset/processed")
output_dir.mkdir(parents=True, exist_ok=True)

target_resolution = ${config.resolution}
center_crop = ${config.centerCrop}
auto_caption = ${config.autoCaption}

# Load BLIP for auto-captioning if needed
if auto_caption:
    from transformers import BlipProcessor, BlipForConditionalGeneration
    processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-large")
    model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-large").to("cuda")

metadata = []

image_files = list(input_dir.glob("**/*.jpg")) + \\
              list(input_dir.glob("**/*.png")) + \\
              list(input_dir.glob("**/*.webp"))

for img_file in tqdm(image_files, desc="Processing images"):
    try:
        # Load image
        img = Image.open(img_file).convert("RGB")

        # Resize
        if center_crop:
            # Center crop to square then resize
            min_dim = min(img.size)
            left = (img.width - min_dim) // 2
            top = (img.height - min_dim) // 2
            img = img.crop((left, top, left + min_dim, top + min_dim))
            img = img.resize((target_resolution, target_resolution), Image.LANCZOS)
        else:
            # Resize maintaining aspect ratio, pad if needed
            img.thumbnail((target_resolution, target_resolution), Image.LANCZOS)
            new_img = Image.new("RGB", (target_resolution, target_resolution), (0, 0, 0))
            paste_x = (target_resolution - img.width) // 2
            paste_y = (target_resolution - img.height) // 2
            new_img.paste(img, (paste_x, paste_y))
            img = new_img

        # Save
        output_file = output_dir / f"{img_file.stem}.png"
        img.save(str(output_file), "PNG")

        # Get caption
        caption = ""
        caption_file = img_file.with_suffix(".txt")
        if caption_file.exists():
            caption = caption_file.read_text().strip()
        elif auto_caption:
            inputs = processor(img, return_tensors="pt").to("cuda")
            out = model.generate(**inputs, max_new_tokens=50)
            caption = processor.decode(out[0], skip_special_tokens=True)

        metadata.append({
            "image_file": str(output_file),
            "caption": caption,
            "original_file": str(img_file),
            "resolution": target_resolution,
        })

    except Exception as e:
        print(f"Error processing {img_file}: {e}")

# Save metadata
with open(output_dir / "metadata.json", "w") as f:
    json.dump(metadata, f, indent=2)

print(f"Processed {len(metadata)} images")
`;

    return {
      script,
      estimatedTime: this.estimateImageProcessingTime(inputPath, config),
    };
  }

  // Similar implementations for video and text...
}
```

## Files to Create

1. server/src/services/training/dataset-preprocessor.ts
2. server/src/services/training/preprocessors/audio-preprocessor.ts
3. server/src/services/training/preprocessors/image-preprocessor.ts
4. server/src/services/training/preprocessors/video-preprocessor.ts
5. server/src/services/training/preprocessors/text-preprocessor.ts
6. server/src/services/training/preprocessor-types.ts

All preprocessing scripts must be complete and handle edge cases.
```

---

## PROMPT 10: Multi-Modal Pipeline Orchestration

```
/ultrathink
/context server/src/services/training/multi-modal-orchestrator.ts

Enhance the Multi-Modal Training Orchestrator to handle complex, multi-model pipelines with proper sequencing, error recovery, and model wiring.

## Requirements

### 1. Pipeline Types

**Sequential Pipeline:**
- Train Model A → Use output for Model B → etc.
- Example: Train MusicGen → Train vocals model on generated music

**Parallel Pipeline:**
- Train multiple models simultaneously
- Merge or combine outputs

**Ensemble Pipeline:**
- Train multiple models for same task
- Combine for better results

**Chained Inference Pipeline:**
- Multiple trained models that feed into each other at inference time
- Example: Lyrics → TTS → Voice Conversion → Mixing

### 2. Job Coordination

```typescript
interface PipelineJob {
  id: string;
  pipelineType: 'sequential' | 'parallel' | 'ensemble' | 'chained';
  stages: PipelineStage[];
  currentStageIndex: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  outputs: Map<string, string>; // stageId -> output path
  errors: Map<string, string>; // stageId -> error message
}
```

### 3. Error Recovery

- Checkpoint each stage
- Ability to resume from last successful stage
- Automatic retry with exponential backoff
- Fallback models if primary fails
- Graceful degradation

### 4. Resource Management

- Queue jobs based on GPU availability
- Prioritize based on cost efficiency
- Multi-GPU job scheduling
- Preemption support

## Enhanced Implementation

```typescript
export class EnhancedMultiModalOrchestrator extends MultiModalTrainingOrchestrator {

  private pipelineJobs: Map<string, PipelineJob> = new Map();
  private resourceManager: ResourceManager;
  private checkpointManager: CheckpointManager;

  /**
   * Create a multi-model pipeline job
   */
  async createPipelineJob(
    pipeline: ExecutablePipeline,
    userId: string
  ): Promise<PipelineJob> {
    const pipelineJob: PipelineJob = {
      id: `pipeline_${uuidv4()}`,
      pipelineType: this.detectPipelineType(pipeline),
      stages: pipeline.stages,
      currentStageIndex: 0,
      status: 'pending',
      outputs: new Map(),
      errors: new Map(),
    };

    // Validate resources for entire pipeline
    await this.validatePipelineResources(pipelineJob);

    // Create checkpoints
    await this.checkpointManager.initializePipeline(pipelineJob.id);

    this.pipelineJobs.set(pipelineJob.id, pipelineJob);

    // Start execution
    this.executePipeline(pipelineJob);

    return pipelineJob;
  }

  /**
   * Execute pipeline with proper sequencing
   */
  private async executePipeline(pipelineJob: PipelineJob): Promise<void> {
    pipelineJob.status = 'running';

    if (pipelineJob.pipelineType === 'parallel') {
      await this.executeParallel(pipelineJob);
    } else if (pipelineJob.pipelineType === 'sequential') {
      await this.executeSequential(pipelineJob);
    } else {
      await this.executeChained(pipelineJob);
    }
  }

  /**
   * Execute stages in parallel
   */
  private async executeParallel(pipelineJob: PipelineJob): Promise<void> {
    const parallelStages = pipelineJob.stages.filter(s => s.parallel);

    const results = await Promise.allSettled(
      parallelStages.map(stage => this.executeStage(stage, pipelineJob))
    );

    // Handle results
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const stage = parallelStages[i];

      if (result.status === 'fulfilled') {
        pipelineJob.outputs.set(stage.name, result.value);
      } else {
        pipelineJob.errors.set(stage.name, result.reason);

        // Try fallback if available
        if (stage.fallback) {
          const fallbackResult = await this.executeStage(stage.fallback, pipelineJob);
          pipelineJob.outputs.set(stage.name, fallbackResult);
        }
      }
    }
  }

  /**
   * Execute stages sequentially
   */
  private async executeSequential(pipelineJob: PipelineJob): Promise<void> {
    for (let i = pipelineJob.currentStageIndex; i < pipelineJob.stages.length; i++) {
      const stage = pipelineJob.stages[i];

      // Check dependencies
      if (stage.dependsOn) {
        const depsReady = stage.dependsOn.every(dep => pipelineJob.outputs.has(dep));
        if (!depsReady) {
          throw new Error(`Dependencies not met for stage ${stage.name}`);
        }
      }

      try {
        // Execute stage
        const output = await this.executeStage(stage, pipelineJob);
        pipelineJob.outputs.set(stage.name, output);
        pipelineJob.currentStageIndex = i + 1;

        // Checkpoint
        await this.checkpointManager.checkpoint(pipelineJob.id, i, output);

      } catch (error) {
        // Handle error
        await this.handleStageError(pipelineJob, stage, error);
      }
    }
  }

  /**
   * Execute a single stage
   */
  private async executeStage(
    stage: PipelineStage,
    pipelineJob: PipelineJob
  ): Promise<string> {
    this.emit('stage_started', { pipelineId: pipelineJob.id, stageName: stage.name });

    switch (stage.type) {
      case 'install':
        return this.executeInstall(stage);
      case 'download':
        return this.executeDownload(stage);
      case 'preprocess':
        return this.executePreprocess(stage);
      case 'train':
        return this.executeTrain(stage, pipelineJob);
      case 'configure':
        return this.executeConfigure(stage, pipelineJob);
      case 'evaluate':
        return this.executeEvaluate(stage, pipelineJob);
      case 'deploy':
        return this.executeDeploy(stage, pipelineJob);
      default:
        throw new Error(`Unknown stage type: ${stage.type}`);
    }
  }

  /**
   * Handle stage error with recovery
   */
  private async handleStageError(
    pipelineJob: PipelineJob,
    stage: PipelineStage,
    error: Error
  ): Promise<void> {
    const errorMessage = error.message;
    pipelineJob.errors.set(stage.name, errorMessage);

    // Try retry
    if (stage.retries && stage.retries > 0) {
      stage.retries--;
      await this.delay(this.calculateBackoff(3 - stage.retries));
      return this.executeStage(stage, pipelineJob);
    }

    // Try fallback
    if (stage.fallback) {
      const fallbackResult = await this.executeStage(stage.fallback, pipelineJob);
      pipelineJob.outputs.set(stage.name, fallbackResult);
      return;
    }

    // Pipeline failed
    pipelineJob.status = 'failed';
    this.emit('pipeline_failed', { pipelineId: pipelineJob.id, stage: stage.name, error: errorMessage });
  }

  /**
   * Resume pipeline from checkpoint
   */
  async resumePipeline(pipelineId: string): Promise<void> {
    const pipelineJob = this.pipelineJobs.get(pipelineId);
    if (!pipelineJob) {
      throw new Error('Pipeline not found');
    }

    // Load checkpoint
    const checkpoint = await this.checkpointManager.loadCheckpoint(pipelineId);
    pipelineJob.currentStageIndex = checkpoint.stageIndex;
    pipelineJob.outputs = new Map(Object.entries(checkpoint.outputs));

    // Resume execution
    this.executePipeline(pipelineJob);
  }
}
```

## Files to Create/Update

1. server/src/services/training/multi-modal-orchestrator.ts (enhance)
2. server/src/services/training/pipeline-executor.ts
3. server/src/services/training/resource-manager.ts
4. server/src/services/training/checkpoint-manager.ts
5. server/src/services/training/error-recovery.ts
6. server/src/services/training/pipeline-types.ts

All implementations must be production-ready.
```

---

## PROMPT 11: Model Evaluation & Comparison System

```
/ultrathink

Implement a comprehensive Model Evaluation & Comparison System that validates trained models meet quality requirements.

## Requirements

### 1. Evaluation Metrics by Modality

**Audio/Music:**
- FAD (Fréchet Audio Distance)
- FID for spectrograms
- CLAP similarity (audio-text alignment)
- MOS (Mean Opinion Score) via model
- SI-SDR (for separation)
- PESQ, STOI (for speech)
- Duration accuracy
- Rhythmic consistency

**Image:**
- FID (Fréchet Inception Distance)
- CLIP score (text-image alignment)
- LPIPS (perceptual similarity)
- Aesthetic score
- BRISQUE (no-reference quality)
- Subject similarity (for DreamBooth)
- Style consistency

**Video:**
- FVD (Fréchet Video Distance)
- Temporal consistency
- Frame quality (FID per frame)
- Motion smoothness
- Audio-visual sync (if applicable)

**LLM:**
- Perplexity
- BLEU, ROUGE (for generation)
- Accuracy on held-out set
- Response quality (via judge model)
- Instruction following score
- Safety score

### 2. Automatic Evaluation Pipeline

```typescript
export class ModelEvaluator {

  async evaluate(
    modelPath: string,
    modality: ModelModality,
    testDataset: string,
    config: EvaluationConfig
  ): Promise<EvaluationReport> {

    const evaluator = this.getEvaluator(modality);
    const metrics = await evaluator.computeMetrics(modelPath, testDataset);

    // Compare to baseline if provided
    let comparison;
    if (config.baselineModel) {
      const baselineMetrics = await evaluator.computeMetrics(config.baselineModel, testDataset);
      comparison = this.compareMetrics(metrics, baselineMetrics);
    }

    // Generate samples for manual review
    const samples = await evaluator.generateSamples(modelPath, config.numSamples);

    // Quality gate
    const passesQualityGate = this.checkQualityGate(metrics, config.qualityThresholds);

    return {
      modelPath,
      modality,
      metrics,
      comparison,
      samples,
      passesQualityGate,
      recommendations: this.generateRecommendations(metrics),
    };
  }
}
```

### 3. A/B Comparison

Allow comparing two models:
- Side-by-side generation
- Metric comparison
- Winner determination

### 4. Human-in-the-loop Evaluation

- Generate samples for review
- Rating interface
- Aggregate human feedback
- Use feedback to improve

## Implementation

Create comprehensive evaluators for each modality with real metric implementations, not mocked.

## Files to Create

1. server/src/services/training/evaluation/evaluator.ts
2. server/src/services/training/evaluation/audio-evaluator.ts
3. server/src/services/training/evaluation/image-evaluator.ts
4. server/src/services/training/evaluation/video-evaluator.ts
5. server/src/services/training/evaluation/llm-evaluator.ts
6. server/src/services/training/evaluation/metrics/
7. server/src/services/training/evaluation/comparison.ts
```

---

## PROMPT 12: RunPod & Modal Deep Integration

```
/ultrathink
/context server/src/services/cloud/runpod.ts
/context server/src/services/cloud/modal.ts

Enhance the RunPod and Modal integrations to support all training scenarios with optimal resource utilization.

## Requirements

### 1. RunPod Enhancements

**Pod Types:**
- On-demand pods (current)
- Spot instances (cheaper, can be preempted)
- Reserved instances (for long jobs)
- Serverless (for inference)

**Multi-GPU Support:**
- 2x, 4x, 8x GPU configurations
- NVLink detection and utilization
- FSDP/DeepSpeed auto-configuration

**Storage:**
- Network volumes for persistent storage
- Volume mounting for datasets
- Output synchronization

**Monitoring:**
- Real-time GPU utilization
- Memory monitoring
- Cost tracking
- ETA calculation

### 2. Modal Enhancements

**Container Building:**
- Custom Docker images
- Dependency caching
- Model weight caching

**Scaling:**
- Auto-scaling for inference
- Batch processing
- Queue management

**Secrets:**
- Secure HF token handling
- API key management

### 3. Provider Selection Logic

```typescript
export class CloudProviderSelector {

  selectProvider(
    requirements: ResourceRequirements,
    preferences: UserPreferences
  ): CloudProvider {

    // Check availability
    const runpodAvailable = await this.checkRunPodAvailability(requirements);
    const modalAvailable = await this.checkModalAvailability(requirements);

    // Score each provider
    const scores = {
      runpod: this.scoreRunPod(requirements, preferences, runpodAvailable),
      modal: this.scoreModal(requirements, preferences, modalAvailable),
    };

    // Select best
    return scores.runpod > scores.modal ? 'runpod' : 'modal';
  }

  private scoreRunPod(requirements, preferences, availability): number {
    let score = 0;

    // RunPod is better for:
    if (requirements.gpuCount > 1) score += 20; // Multi-GPU
    if (requirements.estimatedHours > 4) score += 15; // Long jobs
    if (preferences.spotInstances) score += 10; // Spot pricing
    if (requirements.customDocker) score -= 10; // Docker builds slower

    return score;
  }

  private scoreModal(requirements, preferences, availability): number {
    let score = 0;

    // Modal is better for:
    if (requirements.estimatedHours < 2) score += 15; // Short jobs
    if (requirements.needsScaling) score += 20; // Auto-scaling
    if (!requirements.customDocker) score += 10; // Pre-built images

    return score;
  }
}
```

## Implementation

Enhance both integrations with complete, production-ready code.

## Files to Update/Create

1. server/src/services/cloud/runpod.ts (enhance)
2. server/src/services/cloud/modal.ts (enhance)
3. server/src/services/cloud/provider-selector.ts
4. server/src/services/cloud/resource-monitor.ts
5. server/src/services/cloud/spot-manager.ts
6. server/src/services/cloud/volume-manager.ts
```

---

## PROMPT 13: Training API Routes & WebSocket Progress

```
/ultrathink
/context server/src/routes/training.ts

Implement comprehensive API routes for the universal training system with real-time WebSocket progress updates.

## Routes to Implement

```typescript
// POST /api/training/interpret
// Parse NLP prompt and return training plan
router.post('/interpret', async (req, res) => {
  const { prompt, userId } = req.body;
  const interpreter = new TrainingIntentInterpreter();
  const plan = await interpreter.parseIntent(prompt);
  res.json(plan);
});

// POST /api/training/pipeline
// Create and execute a training pipeline
router.post('/pipeline', async (req, res) => {
  const { plan, userId, autoApprove } = req.body;
  const builder = new DynamicPipelineBuilder(plan);
  const pipeline = await builder.buildPipeline();

  if (autoApprove) {
    const orchestrator = getEnhancedOrchestrator();
    const job = await orchestrator.createPipelineJob(pipeline, userId);
    res.json({ pipeline, job });
  } else {
    res.json({ pipeline, requiresApproval: true });
  }
});

// POST /api/training/approve/:pipelineId
// Approve and start a pipeline
router.post('/approve/:pipelineId', async (req, res) => {
  const { userId } = req.body;
  const orchestrator = getEnhancedOrchestrator();
  const job = await orchestrator.startPipeline(req.params.pipelineId, userId);
  res.json(job);
});

// GET /api/training/job/:jobId
// Get job status and progress
router.get('/job/:jobId', async (req, res) => {
  const orchestrator = getEnhancedOrchestrator();
  const job = orchestrator.getJob(req.params.jobId);
  res.json(job);
});

// WebSocket for real-time progress
io.on('connection', (socket) => {
  socket.on('subscribe_job', (jobId) => {
    const orchestrator = getEnhancedOrchestrator();

    orchestrator.on('progress', (id, progress) => {
      if (id === jobId) {
        socket.emit('progress', progress);
      }
    });

    orchestrator.on('stage_started', (data) => {
      if (data.jobId === jobId) {
        socket.emit('stage_started', data);
      }
    });

    orchestrator.on('completed', (id, result) => {
      if (id === jobId) {
        socket.emit('completed', result);
      }
    });

    orchestrator.on('failed', (id, error) => {
      if (id === jobId) {
        socket.emit('failed', error);
      }
    });
  });
});
```

## Files to Update/Create

1. server/src/routes/training.ts (complete rewrite)
2. server/src/routes/training-websocket.ts
3. server/src/routes/training-callbacks.ts
```

---

## PROMPT 14: Frontend Training Wizard UI

```
/ultrathink

Implement the frontend Training Wizard that guides users through the universal training process.

## Components to Create

### 1. TrainingWizard.tsx
Multi-step wizard:
1. Describe what you want (NLP input)
2. Review detected intent & plan
3. Configure settings (optional)
4. Select quality/speed preset
5. Review cost estimate
6. Approve and start

### 2. IntentReview.tsx
Shows parsed intent:
- Detected capabilities
- Recommended models
- Pipeline architecture visualization
- Required data

### 3. PipelineVisualizer.tsx
Visual pipeline editor:
- Drag-and-drop stages
- Model cards
- Connection lines
- Status indicators

### 4. TrainingProgress.tsx
Real-time progress:
- Stage progress bars
- Log streaming
- GPU utilization
- Cost tracker
- ETA

### 5. ModelCompare.tsx
Side-by-side comparison:
- Before/after
- Sample outputs
- Metrics comparison

## Design Requirements
- Use liquid glass styling
- 3D custom icons (no Lucide)
- Dark theme with kriptik-lime accents
- Smooth animations
- Responsive layout

## Implementation

Create complete React components with TypeScript, using the existing design system.

## Files to Create

1. src/components/training/TrainingWizard.tsx
2. src/components/training/IntentReview.tsx
3. src/components/training/PipelineVisualizer.tsx
4. src/components/training/TrainingProgress.tsx
5. src/components/training/ModelCompare.tsx
6. src/components/training/QualityPresetSelector.tsx
7. src/components/training/CostEstimator.tsx
8. src/hooks/useTrainingWebSocket.ts
9. src/store/useUniversalTrainingStore.ts
```

---

## PROMPT 15: Integration Testing & Production Validation

```
/ultrathink

Create comprehensive integration tests and production validation for the universal training system.

## Test Scenarios

### 1. Audio Training Tests
- Music generation fine-tuning (MusicGen)
- Voice cloning (XTTS)
- Singing voice conversion (SVC)
- Multi-model music pipeline

### 2. Image Training Tests
- LoRA training (SDXL)
- DreamBooth (subject training)
- ControlNet training
- Style transfer

### 3. Video Training Tests
- AnimateDiff training
- Talking head (SadTalker)
- Video style transfer

### 4. LLM Training Tests
- QLoRA fine-tuning
- DPO training
- Continued pre-training

### 5. Pipeline Tests
- Sequential pipeline execution
- Parallel pipeline execution
- Error recovery
- Checkpoint resume

### 6. Integration Tests
- NLP intent parsing
- Model discovery
- GPU provisioning
- Billing integration
- Progress streaming

## Validation Checklist

Before deployment:
- [ ] All training scripts execute without errors on GPU
- [ ] Models can be loaded after training
- [ ] Inference produces expected outputs
- [ ] Billing correctly tracks usage
- [ ] WebSocket progress updates work
- [ ] Error recovery functions correctly
- [ ] Checkpointing works
- [ ] HuggingFace upload succeeds

## Files to Create

1. server/tests/training/audio-training.test.ts
2. server/tests/training/image-training.test.ts
3. server/tests/training/video-training.test.ts
4. server/tests/training/llm-training.test.ts
5. server/tests/training/pipeline.test.ts
6. server/tests/training/integration.test.ts
7. server/tests/training/e2e.test.ts

All tests must use real (not mocked) training where possible.
```

---

## Execution Order

1. **PROMPT 1**: Training Intent Interpreter (Foundation)
2. **PROMPT 2**: Universal Audio Training (Most requested)
3. **PROMPT 3**: Universal Image Training
4. **PROMPT 4**: Universal Video Training
5. **PROMPT 5**: Enhanced LLM Training
6. **PROMPT 6**: Dynamic Pipeline Builder
7. **PROMPT 7**: Model Auto-Discovery
8. **PROMPT 8**: Config Optimizer
9. **PROMPT 9**: Dataset Preprocessor
10. **PROMPT 10**: Multi-Modal Orchestration
11. **PROMPT 11**: Evaluation System
12. **PROMPT 12**: Cloud Integration
13. **PROMPT 13**: API Routes
14. **PROMPT 14**: Frontend UI
15. **PROMPT 15**: Testing & Validation

---

## Critical Reminders for Each Prompt

Add these to EVERY prompt:

```
## CRITICAL REQUIREMENTS
- NO placeholders, NO TODOs, NO "// implement later"
- ALL code must be production-ready
- ALL training loops must perform REAL gradient updates
- ALL models must be saveable and loadable
- ALL progress callbacks must work
- Test mentally that each script would execute on a GPU
- Use real libraries (audiocraft, diffusers, transformers, trl, peft)
- Include proper error handling
- Include proper logging
- Follow existing code patterns in the codebase
```

---

## Comprehensive Capability List

### Audio Capabilities
- Music generation (all genres, all instruments)
- Singing voice synthesis
- Singing voice conversion
- Speech synthesis (TTS)
- Voice cloning (speech)
- Voice cloning (singing)
- Sound effects generation
- Foley synthesis
- Audio enhancement
- Audio restoration
- Noise removal
- Audio super-resolution
- Stem separation
- Audio mixing
- Audio mastering
- MIDI-to-audio
- Lyrics-to-singing
- Podcast voice
- Audiobook narration
- Voice aging/de-aging
- Accent conversion
- Emotion transfer
- Breath/pacing control

### Image Capabilities
- Text-to-image (all styles)
- Subject consistency (characters, products)
- Style transfer
- Art style replication
- Photorealistic generation
- Anime/manga style
- Logo generation
- Icon generation
- Product photography
- Architectural visualization
- Fashion generation
- Face generation
- Face editing
- Age progression
- Background generation
- Texture generation
- Pattern generation
- Inpainting
- Outpainting
- Super resolution
- Image restoration
- Colorization
- Sketch-to-image
- Depth-to-image
- Pose-to-image

### Video Capabilities
- Text-to-video (all styles)
- Image-to-video animation
- Character animation
- Talking head generation
- Lip sync
- Motion transfer
- Video style transfer
- Video enhancement
- Frame interpolation
- Video upscaling
- Video restoration
- Green screen/compositing
- VFX generation
- Music video generation
- Short-form content
- Long-form video
- Cinematic effects
- Slow motion
- Time-lapse
- Video continuation

### LLM Capabilities
- Domain adaptation
- Instruction tuning
- Code generation
- Creative writing
- Translation
- Summarization
- Question answering
- Reasoning enhancement
- Tool use
- Agent behavior
- RAG optimization
- Long context
- Multilingual
- Style adaptation
- Safety tuning
- RLHF/DPO alignment

This implementation plan enables users to train models on virtually any media type through natural language prompts.
