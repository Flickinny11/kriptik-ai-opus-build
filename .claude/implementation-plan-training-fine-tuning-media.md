# Training, Fine-Tuning & Media Models Implementation Plan

> **KripTik AI - Complete Model Training & Deployment Platform**
> **Created**: January 7, 2026
> **Status**: Ready for Implementation
> **Estimated Duration**: 2-3 weeks (Phase 3B in master plan)
> **Dependencies**: Stripe Billing Infrastructure (for metered usage)

---

## Executive Summary

This document provides the complete implementation plan for KripTik AI's Training, Fine-Tuning & Media Models system - a comprehensive platform that enables users to:

1. **Train & Fine-Tune Models**: LLMs, image generators, video generators, audio/TTS models with LoRA/QLoRA
2. **Test Models Side-by-Side**: Compare pretrained vs fine-tuned responses with media previews
3. **Auto-Format Media**: Automatic resizing/reformatting for model requirements
4. **Auto-Deploy to HuggingFace**: Prevent model loss with automatic preservation
5. **One-Click External Deployment**: Deploy to RunPod/Modal with GPU recommendations
6. **Wire to External Apps**: Import app → deploy model → wire endpoints → push to GitHub
7. **Generate Training Reports**: Complete documentation of training data, metrics, and endpoints

---

## Research Summary: Best Models for Training (January 7, 2026)

### LLM Base Models for Fine-Tuning

| Model | Parameters | Best For | License |
|-------|------------|----------|---------|
| **Llama 4 Scout** | 109B (17B active) | General purpose, 10M context | Llama License |
| **Qwen3-32B** | 32B | Multilingual, reasoning | Apache 2.0 |
| **Mistral Large 3** | 675B MoE | Enterprise, 92% GPT-5.2 perf | Apache 2.0 |
| **DeepSeek-V3** | 685B MoE (37B active) | Cost-effective, strong reasoning | MIT |
| **Llama 3.3 70B** | 70B | Balance of size/performance | Llama License |

### Image Generation Models for Fine-Tuning

| Model | Architecture | Best For | Fine-Tuning Method |
|-------|--------------|----------|-------------------|
| **FLUX.2** | DiT + Flow Matching | Production quality | LoRA, DreamBooth |
| **Stable Diffusion XL** | U-Net Diffusion | Established ecosystem | LoRA, DreamBooth, Textual Inversion |
| **Stable Diffusion 3.5** | MMDiT | Latest SD architecture | LoRA |
| **Kandinsky 3** | Diffusion | Multilingual prompts | LoRA |

### Video Generation Models for Fine-Tuning

| Model | Parameters | Best For | Notes |
|-------|------------|----------|-------|
| **Wan 2.2** | MoE | Text-to-video, bilingual | Most popular open source |
| **HunyuanVideo** | 13B | Motion consistency | Tencent, strong quality |
| **Open-Sora 2.0** | 8B | Cost-effective | $200K training cost |
| **Mochi 1** | - | Photorealistic | Apache 2.0, LoRA support |
| **SkyReels V1** | - | Cinematic realism | HunyuanVideo fine-tune |

### Audio/TTS Models for Fine-Tuning

| Model | Type | Best For | Voice Cloning |
|-------|------|----------|---------------|
| **WhisperSpeech** | TTS | Open source, fast | 6s sample |
| **XTTS-v2** | TTS | Multilingual | 6s sample |
| **LLaSA** | TTS | Realistic, Llama-based | Few seconds |
| **Bark** | TTS | Expressive | Prompt-based |
| **Whisper Large v3** | STT | Transcription | N/A |
| **MusicGen** | Music | Music generation | Style transfer |

### Fine-Tuning Frameworks

| Framework | Best For | Features |
|-----------|----------|----------|
| **Unsloth** | Consumer GPUs | 2x faster, 60% less memory |
| **Axolotl** | Flexibility | YAML config, all methods |
| **LLaMA-Factory** | No-code | Web GUI |
| **Hugging Face TRL** | Standard | SFT, RLHF, DPO |
| **kohya-ss/sd-scripts** | Image LoRA | SDXL, FLUX |

### GPU Recommendations by Task

| Task | Minimum GPU | Recommended GPU | Cost/Hour |
|------|-------------|-----------------|-----------|
| LLM LoRA (7B) | RTX 3090 (24GB) | RTX 4090 (24GB) | $0.44-0.69 |
| LLM LoRA (70B) | A100 40GB | A100 80GB | $1.89-2.49 |
| Image LoRA | RTX 4090 | A40 (48GB) | $0.69-0.79 |
| Video Fine-tune | A100 80GB | H100 (80GB) | $2.49-3.99 |
| TTS Fine-tune | RTX 4090 | A40 | $0.69-0.79 |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                KripTik AI Training & Fine-Tuning Platform                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                    Training Configuration UI                     │       │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │       │
│  │  │ Model       │  │ Dataset     │  │ Training    │              │       │
│  │  │ Selector    │  │ Manager     │  │ Config      │              │       │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                    Training Orchestrator                         │       │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │       │
│  │  │ LLM         │  │ Image       │  │ Video       │              │       │
│  │  │ Trainer     │  │ Trainer     │  │ Trainer     │              │       │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │       │
│  │  ┌─────────────┐  ┌─────────────┐                               │       │
│  │  │ Audio/TTS   │  │ Multimodal  │                               │       │
│  │  │ Trainer     │  │ Trainer     │                               │       │
│  │  └─────────────┘  └─────────────┘                               │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                    GPU Compute Layer                             │       │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │       │
│  │  │ RunPod      │  │ Modal       │  │ Local       │              │       │
│  │  │ Provider    │  │ Provider    │  │ (Future)    │              │       │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                    Post-Training Pipeline                        │       │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │       │
│  │  │ Auto-Save   │  │ Report      │  │ Test        │              │       │
│  │  │ to HF       │  │ Generator   │  │ Comparator  │              │       │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                    Model Testing Interface                       │       │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │       │
│  │  │ Side-by-Side│  │ Media       │  │ Media       │              │       │
│  │  │ Comparison  │  │ Preview     │  │ Uploader    │              │       │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                    Deployment Options                            │       │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │       │
│  │  │ Build With  │  │ One-Click   │  │ External    │              │       │
│  │  │ in KripTik  │  │ Deploy      │  │ App Wiring  │              │       │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Existing KripTik Infrastructure Analysis

### Already Implemented
- `server/src/routes/open-source-studio.ts` - HuggingFace model/dataset search
- `server/src/routes/training.ts` - Basic training job CRUD
- `server/src/services/ml/training-orchestrator.ts` - RunPod job management
- `server/src/services/ml/training-job.ts` - Training job state machine
- `server/src/services/cloud/runpod.ts` - RunPod GraphQL API
- `server/src/services/cloud/modal.ts` - Modal code generation
- `server/src/services/ml/huggingface.ts` - HuggingFace API client
- `server/src/schema.ts` - trainingJobs, deployedEndpoints tables

### Gaps to Fill
1. **Model Testing System** - No side-by-side comparison
2. **Media Preview** - No image/video/audio preview for outputs
3. **Media Upload & Formatting** - No auto-resize/reformat
4. **Auto-Deploy to HuggingFace** - No automatic model preservation
5. **Training Reports** - No comprehensive post-training documentation
6. **External App Integration** - No import → wire → push workflow
7. **GPU Recommendations** - No intelligent GPU selection
8. **Image/Video/Audio Trainers** - Only LLM training exists
9. **Metered Billing for Testing** - No per-inference billing

---

## Implementation Phases

### Phase 1: Enhanced Training Infrastructure (PROMPT 1-2)
- Multi-modal training orchestrator
- Image, video, audio trainer implementations
- Enhanced training configurations

### Phase 2: Post-Training Pipeline (PROMPT 3-4)
- Auto-deploy to HuggingFace
- Training report generator
- Model preservation system

### Phase 3: Model Testing System (PROMPT 5-6)
- Side-by-side comparison engine
- Media preview components
- Media upload with auto-formatting

### Phase 4: Deployment & External Integration (PROMPT 7-8)
- One-click deployment with GPU recommendations
- External app import workflow
- Model wiring and GitHub push

### Phase 5: UI Components (PROMPT 9-10)
- Training configuration wizard
- Test comparison interface
- Deployment dashboard

---

## NLP PROMPTS FOR CURSOR 2.2 WITH OPUS 4.5

Below are 10 production-ready NLP prompts. Each prompt is designed to be copy/pasted into Cursor 2.2 with Opus 4.5 selected, using ultrathinking mode.

---

### PROMPT 1: Multi-Modal Training Orchestrator

```
You are implementing the Multi-Modal Training Orchestrator for KripTik AI. This extends the existing training system to support LLMs, image, video, and audio model fine-tuning.

## CRITICAL INSTRUCTIONS
- Use ultrathinking mode - think deeply before implementing
- NO placeholders, NO mock data, NO TODO comments
- Production-ready code only
- Read existing files FIRST before modifying:
  - server/src/services/ml/training-orchestrator.ts
  - server/src/services/ml/training-job.ts
  - server/src/routes/training.ts
  - server/src/schema.ts
- Run npm run build after changes

## MEMORY ARTIFACT
Create .claude/artifacts/training-prompt-1.md at the end documenting:
1. Files created/modified
2. Integration points
3. Ready for next prompt

## CONTEXT
KripTik already has:
- TrainingOrchestrator for RunPod job management
- TrainingJob state machine
- RunPod and Modal cloud providers
- HuggingFace service for model/dataset search

Need to extend for:
- Image model training (SDXL, FLUX LoRA)
- Video model training (Wan, HunyuanVideo)
- Audio model training (TTS, voice cloning)

## TASK: Create Multi-Modal Training Orchestrator

### Step 1: Create Training Types
Create file: server/src/services/training/types.ts

```typescript
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
}

export interface LLMTrainingConfig extends BaseTrainingConfig {
  modality: 'llm';
  method: 'lora' | 'qlora' | 'full_finetune';
  epochs: number;
  learningRate: number;
  batchSize: number;
  gradientAccumulationSteps: number;
  warmupSteps: number;
  loraConfig?: {
    rank: number;
    alpha: number;
    dropout: number;
    targetModules: string[];
  };
  quantization?: '4bit' | '8bit' | 'none';
}

export interface ImageTrainingConfig extends BaseTrainingConfig {
  modality: 'image';
  method: 'lora' | 'dreambooth' | 'textual_inversion';
  baseModel: 'sdxl' | 'sd15' | 'sd3' | 'flux';
  steps: number;
  learningRate: number;
  batchSize: number;
  resolution: number;
  loraConfig?: {
    rank: number;
    alpha: number;
    networkDim: number;
  };
  triggerWord?: string;
  instancePrompt?: string;
  classPrompt?: string;
  priorPreservation?: boolean;
  numClassImages?: number;
}

export interface VideoTrainingConfig extends BaseTrainingConfig {
  modality: 'video';
  method: 'lora' | 'full_finetune';
  baseModel: 'wan' | 'hunyuan' | 'opensora' | 'mochi';
  steps: number;
  learningRate: number;
  batchSize: number;
  frameCount: number;
  resolution: { width: number; height: number };
  loraConfig?: {
    rank: number;
    alpha: number;
  };
}

export interface AudioTrainingConfig extends BaseTrainingConfig {
  modality: 'audio';
  method: 'voice_clone' | 'style_transfer' | 'full_finetune';
  baseModel: 'xtts' | 'whisper_speech' | 'bark' | 'musicgen';
  steps: number;
  learningRate: number;
  sampleRate: number;
  voiceSamples?: string[]; // URLs to voice samples
  targetSpeaker?: string;
}

export type TrainingConfig =
  | LLMTrainingConfig
  | ImageTrainingConfig
  | VideoTrainingConfig
  | AudioTrainingConfig;

export interface DatasetConfig {
  source: 'huggingface' | 'upload' | 'url';
  datasetId?: string;
  uploadedFiles?: string[];
  dataUrl?: string;
  split?: string;
  textColumn?: string;
  imageColumn?: string;
  audioColumn?: string;
}

export interface GPUConfig {
  provider: 'runpod' | 'modal';
  gpuType: string;
  gpuCount: number;
  estimatedHours: number;
  estimatedCost: number;
}

export interface TrainingProgress {
  status: 'queued' | 'provisioning' | 'downloading' | 'training' | 'saving' | 'uploading' | 'completed' | 'failed';
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
}

export interface TrainingResult {
  success: boolean;
  outputModelUrl?: string;
  huggingFaceRepoUrl?: string;
  trainingReport?: TrainingReport;
  error?: string;
  totalCost: number;
  totalDuration: number;
}

export interface TrainingReport {
  id: string;
  trainingId: string;
  createdAt: string;
  config: TrainingConfig;
  metrics: {
    finalLoss: number;
    bestLoss: number;
    totalSteps: number;
    totalEpochs: number;
    trainingDuration: number;
  };
  datasetInfo: {
    source: string;
    samples: number;
    description: string;
  };
  modelLocation: {
    huggingFaceRepo?: string;
    s3Url?: string;
    localPath?: string;
  };
  endpoints: {
    inferenceUrl?: string;
    apiKey?: string;
    exampleCode: string;
  };
  recommendations: string[];
}
```

### Step 2: Create GPU Recommender
Create file: server/src/services/training/gpu-recommender.ts

Requirements:
- Analyze model size and training config
- Recommend optimal GPU type and count
- Calculate estimated cost and time
- Support RunPod and Modal pricing

```typescript
export interface GPURecommendation {
  provider: 'runpod' | 'modal';
  gpuType: string;
  gpuCount: number;
  vramRequired: number;
  estimatedHours: number;
  estimatedCost: number;
  reason: string;
  alternatives: Array<{
    provider: string;
    gpuType: string;
    cost: number;
    tradeoff: string;
  }>;
}

export class GPURecommender {
  recommendForLLM(config: LLMTrainingConfig, modelSizeB: number): GPURecommendation;
  recommendForImage(config: ImageTrainingConfig): GPURecommendation;
  recommendForVideo(config: VideoTrainingConfig): GPURecommendation;
  recommendForAudio(config: AudioTrainingConfig): GPURecommendation;
}
```

### Step 3: Create Multi-Modal Training Orchestrator
Create file: server/src/services/training/multi-modal-orchestrator.ts

Requirements:
- Extend existing TrainingOrchestrator
- Route to appropriate trainer based on modality
- Unified job management
- Progress streaming via SSE
- Cost tracking integration

```typescript
export class MultiModalTrainingOrchestrator extends EventEmitter {
  constructor(
    private gpuRecommender: GPURecommender,
    private runpodProvider: RunPodProvider,
    private modalService: ModalService,
    private huggingFaceService: HuggingFaceService
  );

  async createTrainingJob(
    userId: string,
    config: TrainingConfig
  ): Promise<{ jobId: string; recommendation: GPURecommendation }>;

  async startTraining(jobId: string): Promise<void>;
  async stopTraining(jobId: string): Promise<void>;
  async getProgress(jobId: string): Promise<TrainingProgress>;

  // Streaming progress
  streamProgress(jobId: string): AsyncGenerator<TrainingProgress>;
}
```

### Step 4: Update Schema
Update: server/src/schema.ts

Add new columns to trainingJobs table:
- modality: text
- method: text
- trainingReport: json
- huggingFaceRepoUrl: text
- autoSaved: boolean

### Step 5: Create Training API Routes
Update: server/src/routes/training.ts

Add endpoints:
- POST /api/training/recommend-gpu - Get GPU recommendation
- POST /api/training/jobs/multimodal - Create multi-modal job
- GET /api/training/jobs/:id/stream - SSE progress stream

## VERIFICATION
After implementation:
1. Run npm run build - must pass
2. Test GPU recommendation for each modality
3. Verify schema migrations work

## DELIVERABLES
List all files created/modified when complete.
```

---

### PROMPT 2: Image, Video & Audio Trainers

```
You are implementing the specialized trainers for image, video, and audio models in KripTik AI.

## CRITICAL INSTRUCTIONS
- Use ultrathinking mode
- NO placeholders, NO mock data, NO TODO comments
- Production-ready code
- Read existing files and PROMPT 1 artifacts before starting
- Run npm run build after changes

## MEMORY ARTIFACT
Create .claude/artifacts/training-prompt-2.md documenting implementation.

## CONTEXT
PROMPT 1 created:
- Multi-modal training types
- GPU recommender
- Multi-modal orchestrator

Now implement the actual trainers that generate training scripts for RunPod.

## TASK: Create Specialized Trainers

### Step 1: Create Image Trainer
Create file: server/src/services/training/trainers/image-trainer.ts

Requirements:
- Support SDXL, SD 1.5, SD 3.5, FLUX
- LoRA training with kohya-ss/sd-scripts
- DreamBooth training
- Generate complete training script for RunPod
- Handle dataset preparation

```typescript
export class ImageTrainer {
  constructor(private config: ImageTrainingConfig);

  // Generate training script
  generateTrainingScript(): string;

  // Generate dataset preparation script
  generateDatasetScript(): string;

  // Get required container image
  getContainerImage(): string;

  // Get environment variables
  getEnvironmentVariables(): Record<string, string>;

  // Estimate VRAM requirements
  estimateVRAM(): number;
}
```

Training script must include:
- Install kohya-ss/sd-scripts or diffusers
- Download base model from HuggingFace
- Prepare dataset (resize images, create captions)
- Run training with proper parameters
- Save LoRA/checkpoint to output directory
- Upload to HuggingFace Hub

### Step 2: Create Video Trainer
Create file: server/src/services/training/trainers/video-trainer.ts

Requirements:
- Support Wan, HunyuanVideo, Open-Sora, Mochi
- LoRA training
- Handle video dataset preparation
- Frame extraction and processing

```typescript
export class VideoTrainer {
  constructor(private config: VideoTrainingConfig);

  generateTrainingScript(): string;
  generateDatasetScript(): string;
  getContainerImage(): string;
  getEnvironmentVariables(): Record<string, string>;
  estimateVRAM(): number;
}
```

### Step 3: Create Audio Trainer
Create file: server/src/services/training/trainers/audio-trainer.ts

Requirements:
- Support XTTS-v2, WhisperSpeech, Bark, MusicGen
- Voice cloning with minimal samples
- TTS fine-tuning
- Handle audio preprocessing

```typescript
export class AudioTrainer {
  constructor(private config: AudioTrainingConfig);

  generateTrainingScript(): string;
  generateDatasetScript(): string;
  getContainerImage(): string;
  getEnvironmentVariables(): Record<string, string>;
  estimateVRAM(): number;

  // Voice cloning specific
  generateVoiceCloneScript(voiceSamples: string[]): string;
}
```

### Step 4: Create LLM Trainer (Enhanced)
Create file: server/src/services/training/trainers/llm-trainer.ts

Requirements:
- Enhance existing training with Unsloth for speed
- Support QLoRA with bitsandbytes
- Support larger models (70B+) with FSDP
- DPO and RLHF support

### Step 5: Create Trainer Factory
Create file: server/src/services/training/trainers/index.ts

```typescript
export function createTrainer(config: TrainingConfig):
  ImageTrainer | VideoTrainer | AudioTrainer | LLMTrainer {
  switch (config.modality) {
    case 'image': return new ImageTrainer(config);
    case 'video': return new VideoTrainer(config);
    case 'audio': return new AudioTrainer(config);
    case 'llm': return new LLMTrainer(config);
  }
}
```

### Step 6: Container Images Registry
Create file: server/src/services/training/container-images.ts

Define optimized Docker images for each training type:
- LLM: unsloth/unsloth:latest or pytorch with transformers
- Image: kohya-ss/sd-scripts based
- Video: Custom with diffusers + video support
- Audio: Coqui TTS based

## VERIFICATION
1. Run npm run build - must pass
2. Verify training scripts generate valid Python code
3. Test container image availability

## DELIVERABLES
List all files created/modified when complete.
```

---

### PROMPT 3: Auto-Deploy to HuggingFace System

```
You are implementing the Auto-Deploy to HuggingFace system for KripTik AI. This ensures trained models are never lost and are immediately accessible.

## CRITICAL INSTRUCTIONS
- Use ultrathinking mode
- NO placeholders, NO mock data, NO TODO comments
- Production-ready code
- Read previous artifacts before starting
- Run npm run build after changes

## MEMORY ARTIFACT
Create .claude/artifacts/training-prompt-3.md documenting implementation.

## CONTEXT
Problem: Users lose trained models if they don't deploy quickly (ephemeral GPU storage)
Solution: Auto-upload to HuggingFace immediately after training completes

## TASK: Create Auto-Deploy System

### Step 1: Create HuggingFace Upload Service
Create file: server/src/services/training/huggingface-upload.ts

Requirements:
- Upload model files to HuggingFace Hub
- Create model card with training info
- Support private and public repos
- Handle large file uploads (LFS)
- Create README with usage instructions

```typescript
export interface HFUploadConfig {
  userId: string;
  repoName: string;
  modelFiles: string[];
  modelCard: ModelCard;
  isPrivate: boolean;
  tags: string[];
}

export interface ModelCard {
  modelName: string;
  baseModel: string;
  trainingMethod: string;
  trainingConfig: Record<string, unknown>;
  metrics: Record<string, number>;
  usageExample: string;
  license: string;
}

export class HuggingFaceUploadService {
  constructor(private hfToken: string);

  async createRepo(repoName: string, isPrivate: boolean): Promise<string>;

  async uploadModel(config: HFUploadConfig): Promise<{
    repoUrl: string;
    files: string[];
  }>;

  async generateModelCard(
    trainingConfig: TrainingConfig,
    metrics: Record<string, number>
  ): string;

  async uploadLargeFile(
    repoId: string,
    filePath: string,
    remotePath: string
  ): Promise<void>;
}
```

### Step 2: Create Model Preservation Service
Create file: server/src/services/training/model-preservation.ts

Requirements:
- Monitor training completion
- Trigger auto-upload to HuggingFace
- Fallback to S3 if HF fails
- Track model locations in database
- Send notification on completion

```typescript
export class ModelPreservationService {
  constructor(
    private hfUpload: HuggingFaceUploadService,
    private s3Service: S3Service
  );

  async preserveModel(
    jobId: string,
    modelPath: string,
    config: TrainingConfig
  ): Promise<{
    huggingFaceUrl?: string;
    s3Url?: string;
    preserved: boolean;
  }>;

  async generatePreservationReport(jobId: string): Promise<PreservationReport>;
}
```

### Step 3: Create Training Completion Handler
Create file: server/src/services/training/completion-handler.ts

Requirements:
- Called when training job completes
- Orchestrate model preservation
- Generate training report
- Update database
- Send notifications

```typescript
export class TrainingCompletionHandler {
  async handleCompletion(
    jobId: string,
    result: {
      outputPath: string;
      metrics: Record<string, number>;
      logs: string[];
    }
  ): Promise<TrainingResult>;
}
```

### Step 4: Update Training Orchestrator
Update: server/src/services/training/multi-modal-orchestrator.ts

Integrate completion handler:
- Call preservation service on success
- Generate and store training report
- Update job status with model URLs

### Step 5: Add Database Fields
Update: server/src/schema.ts

Add to trainingJobs:
- preservationStatus: text ('pending' | 'uploading' | 'completed' | 'failed')
- huggingFaceRepoId: text
- s3BackupUrl: text
- modelCardUrl: text

## VERIFICATION
1. Run npm run build - must pass
2. Test HuggingFace upload with test model
3. Verify model card generation

## DELIVERABLES
List all files created/modified when complete.
```

---

### PROMPT 4: Training Report Generator

```
You are implementing the Training Report Generator for KripTik AI. This creates comprehensive documentation of training runs.

## CRITICAL INSTRUCTIONS
- Use ultrathinking mode
- NO placeholders, NO mock data, NO TODO comments
- Production-ready code
- Read previous artifacts before starting
- Run npm run build after changes

## MEMORY ARTIFACT
Create .claude/artifacts/training-prompt-4.md documenting implementation.

## TASK: Create Training Report Generator

### Step 1: Create Report Generator Service
Create file: server/src/services/training/report-generator.ts

Requirements:
- Generate comprehensive PDF/HTML report
- Include all training configuration
- Training metrics and graphs
- Dataset information
- Model location and endpoints
- Example usage code
- Recommendations for deployment

```typescript
export interface TrainingReportData {
  jobId: string;
  userId: string;
  createdAt: string;
  completedAt: string;

  // Configuration
  config: TrainingConfig;
  gpuUsed: GPUConfig;

  // Metrics
  metrics: {
    finalLoss: number;
    bestLoss: number;
    lossHistory: number[];
    learningRateHistory: number[];
    totalSteps: number;
    totalEpochs: number;
    trainingDuration: number;
    samplesProcessed: number;
  };

  // Dataset
  dataset: {
    source: string;
    totalSamples: number;
    trainSamples: number;
    valSamples: number;
    description: string;
    samplePreviews?: string[];
  };

  // Model
  model: {
    baseModelId: string;
    baseModelName: string;
    outputModelName: string;
    parameterCount?: number;
    loraRank?: number;
  };

  // Location
  location: {
    huggingFaceRepo?: string;
    huggingFaceUrl?: string;
    s3Url?: string;
    downloadUrl?: string;
  };

  // Endpoints
  endpoints?: {
    inferenceUrl?: string;
    apiKey?: string;
  };

  // Cost
  cost: {
    gpuHours: number;
    gpuCost: number;
    storageCost: number;
    totalCost: number;
  };
}

export class TrainingReportGenerator {
  async generateReport(data: TrainingReportData): Promise<{
    htmlReport: string;
    jsonReport: string;
    pdfUrl?: string;
  }>;

  generateUsageCode(config: TrainingConfig, endpoint?: string): string;

  generateRecommendations(data: TrainingReportData): string[];
}
```

### Step 2: Create Report Templates
Create file: server/src/services/training/report-templates.ts

HTML templates for:
- LLM training report
- Image training report
- Video training report
- Audio training report

Include:
- Training configuration table
- Loss curve visualization (Chart.js compatible data)
- Dataset preview section
- Model card section
- Usage code examples
- Deployment recommendations

### Step 3: Create Usage Code Generator
Create file: server/src/services/training/usage-code-generator.ts

Generate example code for:
- Python (transformers, diffusers)
- JavaScript/TypeScript (HuggingFace.js)
- cURL
- API endpoint usage

```typescript
export class UsageCodeGenerator {
  generatePythonCode(config: TrainingConfig, modelUrl: string): string;
  generateTypeScriptCode(config: TrainingConfig, modelUrl: string): string;
  generateCurlExample(endpoint: string, apiKey?: string): string;
  generateAPIUsage(endpoint: string): string;
}
```

### Step 4: Create Report Storage
Update: server/src/schema.ts

Add trainingReports table:
- id: text (primary key)
- trainingJobId: text (foreign key)
- userId: text
- htmlReport: text
- jsonReport: text
- pdfUrl: text
- createdAt: text

### Step 5: Create Report API Routes
Update: server/src/routes/training.ts

Add endpoints:
- GET /api/training/jobs/:id/report - Get training report
- GET /api/training/jobs/:id/report/download - Download PDF report
- GET /api/training/jobs/:id/usage-code - Get usage code snippets

## VERIFICATION
1. Run npm run build - must pass
2. Generate sample report for each modality
3. Verify code snippets are valid

## DELIVERABLES
List all files created/modified when complete.
```

---

### PROMPT 5: Model Testing System - Side-by-Side Comparison

```
You are implementing the Model Testing System for KripTik AI. This enables users to compare pretrained vs fine-tuned model outputs side-by-side.

## CRITICAL INSTRUCTIONS
- Use ultrathinking mode
- NO placeholders, NO mock data, NO TODO comments
- Production-ready code
- Read previous artifacts before starting
- Run npm run build after changes

## MEMORY ARTIFACT
Create .claude/artifacts/training-prompt-5.md documenting implementation.

## CONTEXT
After training, users need to:
1. Test the fine-tuned model
2. Compare with original pretrained model
3. See the difference in quality
4. All with metered billing

## TASK: Create Model Testing System

### Step 1: Create Model Inference Service
Create file: server/src/services/training/model-inference.ts

Requirements:
- Support inference for all modalities
- Route to appropriate endpoint (RunPod, Modal, HuggingFace Inference)
- Handle both pretrained and fine-tuned models
- Track usage for billing

```typescript
export interface InferenceRequest {
  modelId: string;
  modelType: 'pretrained' | 'finetuned';
  modality: ModelModality;
  input: {
    text?: string;
    imageUrl?: string;
    audioUrl?: string;
    videoUrl?: string;
  };
  parameters?: Record<string, unknown>;
}

export interface InferenceResponse {
  output: {
    text?: string;
    imageUrl?: string;
    audioUrl?: string;
    videoUrl?: string;
    embeddings?: number[];
  };
  latencyMs: number;
  tokensUsed?: number;
  cost: number;
}

export class ModelInferenceService {
  constructor(
    private runpodProvider: RunPodProvider,
    private modalService: ModalService,
    private hfService: HuggingFaceService
  );

  async runInference(request: InferenceRequest): Promise<InferenceResponse>;

  // Run both pretrained and finetuned for comparison
  async runComparison(
    pretrainedModelId: string,
    finetunedModelId: string,
    input: InferenceRequest['input']
  ): Promise<{
    pretrained: InferenceResponse;
    finetuned: InferenceResponse;
    comparison: ComparisonMetrics;
  }>;
}

export interface ComparisonMetrics {
  qualityImprovement?: number;
  latencyDiff: number;
  costDiff: number;
}
```

### Step 2: Create Comparison Engine
Create file: server/src/services/training/comparison-engine.ts

Requirements:
- Side-by-side inference
- Quality metrics where applicable
- Structured comparison output
- Support all modalities

```typescript
export class ComparisonEngine {
  async compareLLM(
    pretrainedOutput: string,
    finetunedOutput: string,
    prompt: string
  ): Promise<{
    pretrainedResponse: string;
    finetunedResponse: string;
    metrics: {
      coherenceScore?: number;
      relevanceScore?: number;
      styleMatch?: number;
    };
  }>;

  async compareImage(
    pretrainedImageUrl: string,
    finetunedImageUrl: string,
    prompt: string
  ): Promise<{
    pretrainedImage: string;
    finetunedImage: string;
    metrics: {
      styleConsistency?: number;
      promptAdherence?: number;
    };
  }>;

  async compareAudio(
    pretrainedAudioUrl: string,
    finetunedAudioUrl: string
  ): Promise<{
    pretrainedAudio: string;
    finetunedAudio: string;
    metrics: {
      voiceSimilarity?: number;
      qualityScore?: number;
    };
  }>;
}
```

### Step 3: Create Test Session Manager
Create file: server/src/services/training/test-session.ts

Requirements:
- Track test sessions
- Accumulate costs
- Store test results
- Rate limiting

```typescript
export interface TestSession {
  id: string;
  userId: string;
  trainingJobId: string;
  pretrainedModelId: string;
  finetunedModelId: string;
  modality: ModelModality;
  tests: TestResult[];
  totalCost: number;
  createdAt: string;
}

export interface TestResult {
  id: string;
  input: InferenceRequest['input'];
  pretrainedOutput: InferenceResponse;
  finetunedOutput: InferenceResponse;
  timestamp: string;
}

export class TestSessionManager {
  async createSession(
    userId: string,
    trainingJobId: string
  ): Promise<TestSession>;

  async runTest(
    sessionId: string,
    input: InferenceRequest['input']
  ): Promise<TestResult>;

  async getSession(sessionId: string): Promise<TestSession>;

  async endSession(sessionId: string): Promise<{
    totalTests: number;
    totalCost: number;
  }>;
}
```

### Step 4: Create Test Billing Integration
Create file: server/src/services/training/test-billing.ts

Requirements:
- Meter each inference call
- Different rates per modality
- Credit deduction
- Usage tracking

```typescript
export const TEST_PRICING = {
  llm: {
    perInputToken: 0.00001,
    perOutputToken: 0.00003,
  },
  image: {
    perGeneration: 0.02,
  },
  video: {
    perSecond: 0.05,
  },
  audio: {
    perSecond: 0.01,
  },
};

export class TestBillingService {
  async chargeForInference(
    userId: string,
    modality: ModelModality,
    usage: {
      inputTokens?: number;
      outputTokens?: number;
      generationCount?: number;
      durationSeconds?: number;
    }
  ): Promise<{ charged: number; remainingCredits: number }>;
}
```

### Step 5: Create Test API Routes
Create file: server/src/routes/model-testing.ts

Endpoints:
- POST /api/model-testing/sessions - Create test session
- POST /api/model-testing/sessions/:id/test - Run a test
- GET /api/model-testing/sessions/:id - Get session with results
- DELETE /api/model-testing/sessions/:id - End session

### Step 6: Add Database Tables
Update: server/src/schema.ts

Add tables:
- testSessions
- testResults

## VERIFICATION
1. Run npm run build - must pass
2. Test inference routing
3. Verify billing integration

## DELIVERABLES
List all files created/modified when complete.
```

---

### PROMPT 6: Media Preview & Auto-Format System

```
You are implementing the Media Preview and Auto-Format system for KripTik AI. This handles media uploads, automatic reformatting, and preview rendering.

## CRITICAL INSTRUCTIONS
- Use ultrathinking mode
- NO placeholders, NO mock data, NO TODO comments
- Production-ready code
- Read previous artifacts before starting
- Run npm run build after changes

## MEMORY ARTIFACT
Create .claude/artifacts/training-prompt-6.md documenting implementation.

## CONTEXT
Users need to:
1. Upload images/audio/video for testing
2. Have media auto-formatted to model requirements
3. Preview outputs (images, play audio, view video)

## TASK: Create Media Processing System

### Step 1: Create Media Processor Service
Create file: server/src/services/media/media-processor.ts

Requirements:
- Resize images to model requirements
- Convert image formats (PNG, JPG, WebP)
- Resample audio to required sample rate
- Convert audio formats (WAV, MP3, FLAC)
- Extract frames from video
- Resize video resolution

```typescript
export interface MediaRequirements {
  image?: {
    maxWidth: number;
    maxHeight: number;
    formats: string[];
    aspectRatio?: number;
  };
  audio?: {
    sampleRate: number;
    channels: number;
    formats: string[];
    maxDuration?: number;
  };
  video?: {
    maxWidth: number;
    maxHeight: number;
    frameRate?: number;
    formats: string[];
    maxDuration?: number;
  };
}

export const MODEL_REQUIREMENTS: Record<string, MediaRequirements> = {
  'sdxl': {
    image: { maxWidth: 1024, maxHeight: 1024, formats: ['png', 'jpg'], aspectRatio: 1 }
  },
  'flux': {
    image: { maxWidth: 1024, maxHeight: 1024, formats: ['png', 'jpg'] }
  },
  'xtts': {
    audio: { sampleRate: 22050, channels: 1, formats: ['wav'], maxDuration: 30 }
  },
  'whisper': {
    audio: { sampleRate: 16000, channels: 1, formats: ['wav', 'mp3'] }
  },
  'wan': {
    video: { maxWidth: 720, maxHeight: 480, frameRate: 24, formats: ['mp4'] }
  },
};

export class MediaProcessor {
  async processImage(
    inputPath: string,
    requirements: MediaRequirements['image']
  ): Promise<{
    outputPath: string;
    originalSize: { width: number; height: number };
    processedSize: { width: number; height: number };
    format: string;
  }>;

  async processAudio(
    inputPath: string,
    requirements: MediaRequirements['audio']
  ): Promise<{
    outputPath: string;
    originalSampleRate: number;
    processedSampleRate: number;
    duration: number;
    format: string;
  }>;

  async processVideo(
    inputPath: string,
    requirements: MediaRequirements['video']
  ): Promise<{
    outputPath: string;
    originalResolution: { width: number; height: number };
    processedResolution: { width: number; height: number };
    duration: number;
    format: string;
  }>;

  async getRequirementsForModel(modelId: string): Promise<MediaRequirements>;
}
```

### Step 2: Create Media Upload Service
Create file: server/src/services/media/media-upload.ts

Requirements:
- Handle multipart file uploads
- Store temporarily in S3 or local storage
- Auto-process for model requirements
- Return processed file URL

```typescript
export class MediaUploadService {
  constructor(
    private processor: MediaProcessor,
    private storage: StorageService
  );

  async uploadAndProcess(
    file: Express.Multer.File,
    modelId: string,
    mediaType: 'image' | 'audio' | 'video'
  ): Promise<{
    originalUrl: string;
    processedUrl: string;
    processingInfo: {
      resized: boolean;
      reformatted: boolean;
      details: string;
    };
  }>;

  async uploadMultiple(
    files: Express.Multer.File[],
    modelId: string
  ): Promise<Array<{
    originalUrl: string;
    processedUrl: string;
  }>>;
}
```

### Step 3: Create Media Preview Service
Create file: server/src/services/media/media-preview.ts

Requirements:
- Generate thumbnails for images
- Generate waveforms for audio
- Generate video thumbnails/previews
- Return preview-ready URLs

```typescript
export class MediaPreviewService {
  async generateImagePreview(
    imageUrl: string,
    size: { width: number; height: number }
  ): Promise<string>;

  async generateAudioWaveform(audioUrl: string): Promise<{
    waveformData: number[];
    duration: number;
    streamUrl: string;
  }>;

  async generateVideoThumbnail(videoUrl: string): Promise<{
    thumbnailUrl: string;
    duration: number;
    streamUrl: string;
  }>;
}
```

### Step 4: Create Media API Routes
Create file: server/src/routes/media.ts

Endpoints:
- POST /api/media/upload - Upload and process media
- GET /api/media/:id/preview - Get preview data
- GET /api/media/:id/stream - Stream audio/video
- DELETE /api/media/:id - Delete uploaded media

### Step 5: Add Storage Integration
Update storage configuration to support:
- Temporary uploads (24h expiry)
- Processed files
- Preview assets

### Step 6: Add Dependencies
Ensure these are available:
- sharp (image processing)
- ffmpeg (audio/video processing)
- fluent-ffmpeg (Node.js ffmpeg wrapper)

## VERIFICATION
1. Run npm run build - must pass
2. Test image resizing
3. Test audio resampling
4. Test video thumbnail generation

## DELIVERABLES
List all files created/modified when complete.
```

---

### PROMPT 7: One-Click Deployment System

```
You are implementing the One-Click Deployment system for KripTik AI. This enables users to deploy trained models to RunPod or Modal with intelligent GPU recommendations.

## CRITICAL INSTRUCTIONS
- Use ultrathinking mode
- NO placeholders, NO mock data, NO TODO comments
- Production-ready code
- Read previous artifacts before starting
- Run npm run build after changes

## MEMORY ARTIFACT
Create .claude/artifacts/training-prompt-7.md documenting implementation.

## CONTEXT
After training and testing, users need to:
1. Deploy model for inference
2. Get GPU recommendations
3. One-click deploy to RunPod or Modal
4. Get endpoint URL and API key

## TASK: Create One-Click Deployment System

### Step 1: Create Deployment Recommender
Create file: server/src/services/deployment/deployment-recommender.ts

Requirements:
- Analyze model requirements
- Recommend RunPod vs Modal based on use case
- Suggest optimal GPU type
- Estimate costs

```typescript
export interface DeploymentRecommendation {
  provider: 'runpod' | 'modal';
  reason: string;
  gpuType: string;
  gpuVRAM: number;
  estimatedCostPerHour: number;
  estimatedCostPerRequest: number;
  scalingConfig: {
    minWorkers: number;
    maxWorkers: number;
    scaleToZero: boolean;
  };
  alternatives: Array<{
    provider: 'runpod' | 'modal';
    gpuType: string;
    cost: number;
    tradeoff: string;
  }>;
}

export class DeploymentRecommender {
  recommendForModel(
    modelId: string,
    modality: ModelModality,
    expectedRequestsPerDay: number,
    latencyRequirement: 'low' | 'medium' | 'high'
  ): DeploymentRecommendation;
}
```

### Step 2: Create RunPod Deployment Service
Create file: server/src/services/deployment/runpod-deployer.ts

Requirements:
- Deploy serverless endpoint
- Configure GPU and scaling
- Return endpoint URL
- Handle model loading

```typescript
export class RunPodDeployer {
  constructor(private runpodProvider: RunPodProvider);

  async deployModel(config: {
    userId: string;
    modelUrl: string;
    modelType: ModelModality;
    gpuType: string;
    scalingConfig: {
      minWorkers: number;
      maxWorkers: number;
      idleTimeout: number;
    };
  }): Promise<{
    endpointId: string;
    endpointUrl: string;
    status: string;
  }>;

  async getEndpointStatus(endpointId: string): Promise<{
    status: 'scaling' | 'active' | 'idle' | 'error';
    workers: number;
  }>;

  async deleteEndpoint(endpointId: string): Promise<void>;
}
```

### Step 3: Create Modal Deployment Service
Create file: server/src/services/deployment/modal-deployer.ts

Requirements:
- Generate Modal app code
- Deploy with CLI or API
- Return endpoint URL

```typescript
export class ModalDeployer {
  constructor(private modalService: ModalService);

  async deployModel(config: {
    userId: string;
    modelUrl: string;
    modelType: ModelModality;
    gpuType: 'T4' | 'L4' | 'A10G' | 'A100' | 'H100';
  }): Promise<{
    appId: string;
    endpointUrl: string;
    appCode: string;
    deploymentInstructions: string;
  }>;

  async getAppStatus(appId: string): Promise<{
    status: string;
    deployments: number;
  }>;

  async deleteApp(appId: string): Promise<void>;
}
```

### Step 4: Create Unified Deployment Service
Create file: server/src/services/deployment/unified-deployer.ts

Requirements:
- Unified interface for both providers
- Handle credential management
- Track deployments
- Generate connection code

```typescript
export class UnifiedDeployer {
  constructor(
    private runpodDeployer: RunPodDeployer,
    private modalDeployer: ModalDeployer,
    private recommender: DeploymentRecommender
  );

  async deploy(config: {
    userId: string;
    trainingJobId: string;
    provider: 'runpod' | 'modal' | 'auto';
    customConfig?: Partial<DeploymentRecommendation>;
  }): Promise<{
    deploymentId: string;
    provider: 'runpod' | 'modal';
    endpointUrl: string;
    apiKey?: string;
    connectionCode: {
      python: string;
      typescript: string;
      curl: string;
    };
  }>;

  async getRecommendation(
    trainingJobId: string
  ): Promise<DeploymentRecommendation>;
}
```

### Step 5: Create Deployment API Routes
Create file: server/src/routes/deployment.ts

Endpoints:
- GET /api/deployment/recommend/:trainingJobId - Get recommendation
- POST /api/deployment/deploy - Deploy model
- GET /api/deployment/:id/status - Get deployment status
- DELETE /api/deployment/:id - Delete deployment
- GET /api/deployment/:id/connection-code - Get connection code

### Step 6: Update Database
Update: server/src/schema.ts

Add to deployedEndpoints:
- trainingJobId: text (link to training job)
- connectionCode: json
- apiKey: text (encrypted)

## VERIFICATION
1. Run npm run build - must pass
2. Test RunPod deployment
3. Test Modal deployment
4. Verify connection code generation

## DELIVERABLES
List all files created/modified when complete.
```

---

### PROMPT 8: External App Integration System

```
You are implementing the External App Integration system for KripTik AI. This enables users to import external apps, wire trained models, and push changes back.

## CRITICAL INSTRUCTIONS
- Use ultrathinking mode
- NO placeholders, NO mock data, NO TODO comments
- Production-ready code
- Read previous artifacts before starting
- Run npm run build after changes

## MEMORY ARTIFACT
Create .claude/artifacts/training-prompt-8.md documenting implementation.

## CONTEXT
Users with external apps need to:
1. Import their app into KripTik
2. Deploy trained model to RunPod/Modal
3. Wire the model endpoint to their app
4. Test the integration
5. Push changes to GitHub for their live app

## TASK: Create External App Integration System

### Step 1: Create App Import Service (Enhanced)
Create file: server/src/services/external-app/app-importer.ts

Requirements:
- Import from GitHub repo
- Detect framework and structure
- Identify integration points for AI models
- Support Node.js, Python, React, Next.js

```typescript
export interface ImportedApp {
  id: string;
  userId: string;
  sourceRepo: string;
  framework: 'nodejs' | 'python' | 'react' | 'nextjs' | 'other';
  structure: {
    rootDir: string;
    sourceDir: string;
    configFiles: string[];
    envFiles: string[];
  };
  integrationPoints: IntegrationPoint[];
}

export interface IntegrationPoint {
  id: string;
  type: 'api_route' | 'function' | 'component' | 'config';
  filePath: string;
  lineNumber: number;
  description: string;
  suggestedWiring: string;
}

export class AppImporter {
  async importFromGitHub(
    userId: string,
    repoUrl: string,
    branch?: string
  ): Promise<ImportedApp>;

  async detectIntegrationPoints(appId: string): Promise<IntegrationPoint[]>;

  async analyzeEnvRequirements(appId: string): Promise<string[]>;
}
```

### Step 2: Create Model Wiring Service
Create file: server/src/services/external-app/model-wiring.ts

Requirements:
- Generate code to connect to deployed model
- Insert API calls at integration points
- Handle environment variables
- Support multiple languages/frameworks

```typescript
export interface WiringConfig {
  appId: string;
  deploymentId: string;
  integrationPointId: string;
  endpointUrl: string;
  apiKey?: string;
  customConfig?: Record<string, unknown>;
}

export interface WiringResult {
  success: boolean;
  modifiedFiles: Array<{
    path: string;
    originalContent: string;
    modifiedContent: string;
    changes: string[];
  }>;
  envVariables: Record<string, string>;
  instructions: string;
}

export class ModelWiringService {
  async wireModel(config: WiringConfig): Promise<WiringResult>;

  generateClientCode(
    framework: string,
    endpointUrl: string,
    modelType: ModelModality
  ): string;

  async previewWiring(config: WiringConfig): Promise<WiringResult>;

  async applyWiring(config: WiringConfig): Promise<void>;
}
```

### Step 3: Create Integration Testing Service
Create file: server/src/services/external-app/integration-tester.ts

Requirements:
- Spin up app in sandbox
- Test model integration
- Verify responses
- Report issues

```typescript
export class IntegrationTester {
  async testIntegration(
    appId: string,
    deploymentId: string
  ): Promise<{
    success: boolean;
    testResults: Array<{
      test: string;
      passed: boolean;
      response?: unknown;
      error?: string;
    }>;
    logs: string[];
  }>;
}
```

### Step 4: Create GitHub Push Service
Create file: server/src/services/external-app/github-pusher.ts

Requirements:
- Create branch for changes
- Commit wiring modifications
- Push to user's repo
- Create pull request

```typescript
export class GitHubPusher {
  constructor(private octokit: Octokit);

  async pushChanges(config: {
    appId: string;
    repoUrl: string;
    branch: string;
    changes: Array<{
      path: string;
      content: string;
    }>;
    commitMessage: string;
    createPR?: boolean;
  }): Promise<{
    branchUrl: string;
    commitSha: string;
    prUrl?: string;
  }>;
}
```

### Step 5: Create External App Workflow Orchestrator
Create file: server/src/services/external-app/workflow-orchestrator.ts

Requirements:
- Orchestrate full workflow
- Import → Deploy → Wire → Test → Push

```typescript
export class ExternalAppWorkflowOrchestrator {
  async runWorkflow(config: {
    userId: string;
    repoUrl: string;
    trainingJobId: string;
    deploymentProvider: 'runpod' | 'modal';
    autoPush: boolean;
  }): AsyncGenerator<{
    step: 'importing' | 'deploying' | 'wiring' | 'testing' | 'pushing' | 'complete';
    progress: number;
    data?: unknown;
    error?: string;
  }>;
}
```

### Step 6: Create External App API Routes
Create file: server/src/routes/external-app.ts

Endpoints:
- POST /api/external-app/import - Import from GitHub
- GET /api/external-app/:id/integration-points - Get integration points
- POST /api/external-app/:id/wire - Wire model to app
- POST /api/external-app/:id/test - Test integration
- POST /api/external-app/:id/push - Push to GitHub
- POST /api/external-app/workflow - Run full workflow (SSE)

### Step 7: Update Database
Update: server/src/schema.ts

Add tables:
- externalApps
- appIntegrationPoints
- appWiringHistory

## VERIFICATION
1. Run npm run build - must pass
2. Test GitHub import
3. Test model wiring
4. Test GitHub push

## DELIVERABLES
List all files created/modified when complete.
```

---

### PROMPT 9: Training UI Components

```
You are implementing the Training UI Components for KripTik AI. These provide the user interface for model training configuration and monitoring.

## CRITICAL INSTRUCTIONS
- Use ultrathinking mode
- NO placeholders, NO mock data, NO TODO comments
- Production-ready code with real functionality
- Read existing UI components in src/components/
- Follow KripTik design patterns (glass effects, depth, motion)
- Run npm run build after changes

## MEMORY ARTIFACT
Create .claude/artifacts/training-prompt-9.md documenting implementation.

## CONTEXT
UI components needed:
1. Training configuration wizard
2. GPU selection with recommendations
3. Training progress monitor
4. Cost tracking display

## TASK: Create Training UI Components

### Step 1: Create Training Configuration Wizard
Create file: src/components/training/TrainingWizard.tsx

Requirements:
- Multi-step wizard
- Model selection (from HuggingFace)
- Dataset configuration
- Training parameters
- GPU selection with recommendations
- Cost estimate display
- Premium glass design

```typescript
interface TrainingWizardProps {
  onComplete: (config: TrainingConfig) => void;
  onCancel: () => void;
}

// Steps:
// 1. Select base model (search HuggingFace)
// 2. Configure dataset (upload or HuggingFace)
// 3. Set training parameters (presets + advanced)
// 4. Select GPU (with recommendations)
// 5. Review and start
```

### Step 2: Create Model Selector Component
Create file: src/components/training/ModelSelector.tsx

Requirements:
- Search HuggingFace models
- Filter by task type
- Show model details (size, license, downloads)
- License compatibility check

### Step 3: Create Dataset Configurator
Create file: src/components/training/DatasetConfigurator.tsx

Requirements:
- Upload files (with drag-drop)
- Select HuggingFace dataset
- Preview data samples
- Configure columns/fields

### Step 4: Create Training Parameters Panel
Create file: src/components/training/TrainingParametersPanel.tsx

Requirements:
- Preset configurations (Quick, Balanced, Quality)
- Advanced parameter expansion
- LoRA-specific settings
- Modality-specific options

### Step 5: Create GPU Selector
Create file: src/components/training/GPUSelector.tsx

Requirements:
- Show recommendations
- RunPod vs Modal options
- Cost comparison
- VRAM requirements display

### Step 6: Create Training Progress Monitor
Create file: src/components/training/TrainingProgressMonitor.tsx

Requirements:
- Real-time progress bar
- Loss curve chart
- Training logs
- Cost accumulator
- Estimated time remaining

### Step 7: Create Training Jobs List
Create file: src/components/training/TrainingJobsList.tsx

Requirements:
- List all user's training jobs
- Status indicators
- Quick actions (stop, view, test)
- Filter and sort

### Step 8: Create Zustand Store
Create file: src/store/useTrainingStore.ts

```typescript
interface TrainingState {
  jobs: TrainingJob[];
  activeWizard: Partial<TrainingConfig> | null;
  gpuRecommendations: GPURecommendation[];

  // Actions
  createJob: (config: TrainingConfig) => Promise<string>;
  stopJob: (jobId: string) => Promise<void>;
  fetchJobs: () => Promise<void>;
  setWizardStep: (step: number, data: Partial<TrainingConfig>) => void;
}
```

## VERIFICATION
1. Run npm run build - must pass
2. Verify all components render
3. Test wizard flow
4. Check responsive design

## DELIVERABLES
List all files created/modified when complete.
```

---

### PROMPT 10: Model Testing & Deployment UI Components

```
You are implementing the Model Testing and Deployment UI Components for KripTik AI. These provide the user interface for testing trained models and deploying them.

## CRITICAL INSTRUCTIONS
- Use ultrathinking mode
- NO placeholders, NO mock data, NO TODO comments
- Production-ready code with real functionality
- Follow KripTik design patterns
- Run npm run build after changes

## MEMORY ARTIFACT
Create .claude/artifacts/training-prompt-10.md documenting implementation.

## CONTEXT
UI components needed:
1. Side-by-side model comparison
2. Media upload with preview
3. Deployment configuration
4. External app wiring UI

## TASK: Create Testing & Deployment UI Components

### Step 1: Create Side-by-Side Comparison Component
Create file: src/components/testing/ModelComparison.tsx

Requirements:
- Split view: pretrained vs fine-tuned
- Synchronized input
- Response comparison
- Quality metrics display

### Step 2: Create Media Upload Component
Create file: src/components/testing/MediaUploader.tsx

Requirements:
- Drag-and-drop upload
- File type detection
- Auto-format notification
- Preview after processing

### Step 3: Create Media Preview Components
Create files:
- src/components/testing/ImagePreview.tsx
- src/components/testing/AudioPreview.tsx (with waveform)
- src/components/testing/VideoPreview.tsx

Requirements:
- Responsive preview
- Zoom for images
- Play controls for audio/video
- Download option

### Step 4: Create Test Input Component
Create file: src/components/testing/TestInput.tsx

Requirements:
- Text input for prompts
- Media attachment
- Parameter controls
- Send to both models button

### Step 5: Create Test Results Panel
Create file: src/components/testing/TestResultsPanel.tsx

Requirements:
- Response display
- Comparison metrics
- Cost display
- Save test option

### Step 6: Create Deployment Dashboard
Create file: src/components/deployment/DeploymentDashboard.tsx

Requirements:
- Recommendation display
- One-click deploy buttons
- Connection code display
- Deployment status

### Step 7: Create External App Wiring UI
Create file: src/components/deployment/ExternalAppWiring.tsx

Requirements:
- GitHub import form
- Integration points list
- Wiring preview
- Push to GitHub button

### Step 8: Create Deployment Status Component
Create file: src/components/deployment/DeploymentStatus.tsx

Requirements:
- Real-time status
- Worker count
- Request metrics
- Cost tracking

### Step 9: Create Training Report Viewer
Create file: src/components/training/TrainingReportViewer.tsx

Requirements:
- Full report display
- Charts for metrics
- Download options
- Copy code snippets

### Step 10: Update Navigation
Update: src/pages/OpenSourceStudioPage.tsx

Add tabs/sections for:
- Model Training
- Model Testing
- Deployment

## VERIFICATION
1. Run npm run build - must pass
2. Verify all components render
3. Test comparison flow
4. Check deployment workflow

## DELIVERABLES
List all files created/modified when complete.
```

---

## Dependency Graph

```
PROMPT 1 ──────────────┐
(Multi-Modal Types)    │
                       ▼
PROMPT 2 ──────────────┤
(Trainers)             │
                       ▼
PROMPT 3 ──────────────┤
(Auto-Deploy HF)       │
                       ▼
PROMPT 4 ──────────────┤
(Report Generator)     │
                       │
PROMPT 5 ──────────────┤
(Testing System)       │
          │            │
          ▼            ▼
PROMPT 6 ◄─────────────┤
(Media Processing)     │
                       │
PROMPT 7 ──────────────┤
(One-Click Deploy)     │
                       │
PROMPT 8 ──────────────┤
(External App)         │
                       │
          ▼            ▼
PROMPT 9 ──────────────┤
(Training UI)          │
                       ▼
PROMPT 10 ◄────────────┘
(Testing/Deploy UI)
```

## Implementation Notes

### Execution Order
1. **PROMPT 1-2** establish training infrastructure
2. **PROMPT 3-4** handle post-training pipeline
3. **PROMPT 5-6** enable testing with media support
4. **PROMPT 7-8** handle deployment and external apps
5. **PROMPT 9-10** create UI components

### Critical Success Criteria
- [ ] All modalities trainable (LLM, image, video, audio)
- [ ] Models auto-saved to HuggingFace
- [ ] Side-by-side comparison works for all types
- [ ] Media auto-formatted correctly
- [ ] One-click deployment functional
- [ ] External app wiring works
- [ ] All builds pass (`npm run build`)

### Cost Estimates
| Task | Estimated Cost |
|------|---------------|
| LLM LoRA (7B, 3 epochs) | $2-5 |
| Image LoRA (SDXL, 1000 steps) | $1-3 |
| Video LoRA (Wan, 500 steps) | $10-30 |
| Audio voice clone (XTTS) | $1-5 |
| Testing (per inference) | $0.01-0.10 |

### Environment Variables Required
```bash
# Training
RUNPOD_API_KEY=
MODAL_TOKEN_ID=
MODAL_TOKEN_SECRET=
HUGGINGFACE_TOKEN=

# Storage
S3_BUCKET=
S3_REGION=

# Media Processing
FFMPEG_PATH=/usr/bin/ffmpeg

# Pricing
TRAINING_MARKUP_PERCENT=20
TEST_INFERENCE_MARKUP_PERCENT=20
```

---

## Sources

### Fine-Tuning Methods
- [Efficient Fine-Tuning with LoRA - Databricks](https://www.databricks.com/blog/efficient-fine-tuning-lora-guide-llms)
- [QLoRA Paper](https://arxiv.org/pdf/2305.14314)
- [HuggingFace PEFT Library](https://github.com/huggingface/peft)
- [Top 7 Platforms to Fine-Tune LLMs 2026](https://www.secondtalent.com/resources/top-platforms-to-fine-tune-open-source-llms/)

### Image Model Training
- [Fine-Tuning SDXL with LoRA](https://www.flex.ai/blueprints/fine-tuning-a-stable-diffusion-xl-with-lora)
- [FLUX LoRA Training Guide](https://medium.com/@zhiwangshi28/why-flux-lora-so-hard-to-train-and-how-to-overcome-it-a0c70bc59eaf)
- [Best Open-Source Image Models 2026](https://www.bentoml.com/blog/a-guide-to-open-source-image-generation-models)

### Video Generation Models
- [Open-Sora 2.0](https://bdtechtalks.substack.com/p/an-open-source-and-cost-effective)
- [Top Open-Source Video Models](https://modal.com/blog/text-to-video-ai-article)
- [31 Open-Source AI Video Models](https://aifreeforever.com/blog/open-source-ai-video-models-free-tools-to-make-videos)

### Audio/TTS Models
- [TTS Fine-Tuning - Unsloth](https://docs.unsloth.ai/basics/text-to-speech-tts-fine-tuning)
- [WhisperSpeech](https://github.com/WhisperSpeech/WhisperSpeech)
- [Best Open-Source TTS Models 2026](https://www.bentoml.com/blog/exploring-the-world-of-open-source-text-to-speech-models)
- [LLaSA TTS](https://huggingface.co/blog/srinivasbilla/llasa-tts)

### Deployment Platforms
- [RunPod Serverless](https://www.runpod.io/product/serverless)
- [RunPod for Generative AI](https://www.runpod.io/articles/guides/serverless-for-generative-ai)
- [Modal GPU Acceleration](https://modal.com/docs/guide/gpu)
- [HuggingFace Inference Endpoints](https://huggingface.co/inference-endpoints/dedicated)

### LLM Models for Fine-Tuning
- [10 Best Open-Source LLMs 2025](https://huggingface.co/blog/daya-shankar/open-source-llms)
- [Top 9 LLMs January 2026](https://www.shakudo.io/blog/top-9-large-language-models)
- [Best Open-Source LLMs 2026](https://www.bentoml.com/blog/navigating-the-world-of-open-source-large-language-models)

---

*Document Version: 1.0*
*Last Updated: January 7, 2026*
*Author: Claude Code (Opus 4.5)*
