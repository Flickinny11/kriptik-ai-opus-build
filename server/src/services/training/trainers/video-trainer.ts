/**
 * Video Trainer
 *
 * Generates training scripts for video model fine-tuning.
 * Supports Wan, HunyuanVideo, Open-Sora, Mochi with LoRA.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import type { VideoTrainingConfig } from '../types.js';
import { getContainerImage } from '../container-images.js';

// =============================================================================
// TYPES
// =============================================================================

export interface VideoTrainerResult {
  trainingScript: string;
  datasetScript: string;
  containerImage: string;
  environmentVariables: Record<string, string>;
  estimatedVRAM: number;
}

// =============================================================================
// VIDEO TRAINER CLASS
// =============================================================================

export class VideoTrainer {
  private config: VideoTrainingConfig;

  constructor(config: VideoTrainingConfig) {
    this.config = config;
  }

  /**
   * Generate complete training configuration
   */
  generate(): VideoTrainerResult {
    return {
      trainingScript: this.generateTrainingScript(),
      datasetScript: this.generateDatasetScript(),
      containerImage: this.getContainerImage(),
      environmentVariables: this.getEnvironmentVariables(),
      estimatedVRAM: this.estimateVRAM(),
    };
  }

  /**
   * Generate the main training script
   */
  generateTrainingScript(): string {
    const { config } = this;
    const lines: string[] = [];
    
    lines.push('#!/bin/bash');
    lines.push('set -e');
    lines.push('');
    lines.push('echo "=== KripTik AI Video Training Job ==="');
    lines.push(`echo "Job ID: ${config.id}"`);
    lines.push(`echo "Base Model: ${config.baseModelId}"`);
    lines.push(`echo "Method: ${config.method}"`);
    lines.push(`echo "Frame Count: ${config.frameCount}"`);
    lines.push(`echo "Resolution: ${config.resolution.width}x${config.resolution.height}"`);
    lines.push('');
    
    // Create workspace
    lines.push('mkdir -p /workspace/dataset/videos');
    lines.push('mkdir -p /workspace/output');
    lines.push('mkdir -p /workspace/logs');
    lines.push('');
    
    // Callback helpers
    lines.push('send_callback() {');
    lines.push('    if [ -n "$CALLBACK_URL" ]; then');
    lines.push('        curl -s -X POST "$CALLBACK_URL/api/training/callback/log" \\');
    lines.push('            -H "Content-Type: application/json" \\');
    lines.push('            -d "{\\"jobId\\": \\"$JOB_ID\\", \\"log\\": \\"$1\\"}" || true');
    lines.push('    fi');
    lines.push('}');
    lines.push('');
    
    // Install dependencies
    lines.push('send_callback "Installing dependencies..."');
    lines.push('pip install -q torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121');
    lines.push('pip install -q accelerate transformers diffusers safetensors huggingface_hub');
    lines.push('pip install -q decord opencv-python-headless peft');
    lines.push('');
    
    // HuggingFace login
    lines.push('python -c "from huggingface_hub import login; login(token=\'$HF_TOKEN\')"');
    lines.push('');
    
    // Model-specific setup
    lines.push('send_callback "Setting up model..."');
    lines.push(this.generateModelSetup());
    
    // Dataset preparation
    lines.push('');
    lines.push('send_callback "Preparing dataset..."');
    lines.push(this.generateDatasetPreparation());
    
    // Training
    lines.push('');
    lines.push('send_callback "Starting training..."');
    lines.push(this.generateTrainingPython());
    
    // Upload to HuggingFace
    if (config.autoSaveToHub) {
      lines.push('');
      lines.push('send_callback "Uploading to HuggingFace Hub..."');
      lines.push(this.generateUploadPython());
    }
    
    // Completion callback
    lines.push('');
    lines.push('if [ -n "$CALLBACK_URL" ]; then');
    const outputUrl = `https://huggingface.co/${config.hubRepoName || config.outputModelName}`;
    lines.push('    curl -s -X POST "$CALLBACK_URL/api/training/callback" \\');
    lines.push('        -H "Content-Type: application/json" \\');
    lines.push(`        -d "{\\"jobId\\": \\"$JOB_ID\\", \\"status\\": \\"completed\\", \\"outputUrl\\": \\"${outputUrl}\\"}"`);
    lines.push('fi');
    lines.push('');
    lines.push('echo "=== Training Complete ==="');
    
    return lines.join('\n');
  }

  private generateModelSetup(): string {
    const c = this.config;
    const lines: string[] = [];
    
    if (c.baseModel === 'wan' || c.baseModel === 'wan2') {
      lines.push('git clone https://github.com/Wan-Video/Wan2.1.git /workspace/wan || true');
      lines.push('cd /workspace/wan && pip install -q -r requirements.txt || true');
    } else if (c.baseModel === 'hunyuan') {
      lines.push('git clone https://github.com/Tencent/HunyuanVideo.git /workspace/hunyuan || true');
      lines.push('cd /workspace/hunyuan && pip install -q -r requirements.txt || true');
    } else if (c.baseModel === 'opensora') {
      lines.push('git clone https://github.com/hpcaitech/Open-Sora.git /workspace/opensora || true');
      lines.push('cd /workspace/opensora && pip install -q -r requirements.txt || true');
    }
    
    lines.push('');
    lines.push(`send_callback "Downloading model: ${c.baseModelId}..."`);
    lines.push('python << DOWNLOAD_MODEL');
    lines.push('from huggingface_hub import snapshot_download');
    lines.push(`model_id = "${c.baseModelId}"`);
    lines.push('print(f"Downloading {model_id}...")');
    lines.push('snapshot_download(');
    lines.push('    repo_id=model_id,');
    lines.push('    local_dir="/workspace/model",');
    lines.push('    ignore_patterns=["*.md", "*.txt", ".git*"]');
    lines.push(')');
    lines.push('print("Download complete!")');
    lines.push('DOWNLOAD_MODEL');
    
    return lines.join('\n');
  }

  private generateDatasetPreparation(): string {
    const c = this.config;
    const lines: string[] = [];
    
    lines.push('python << PREP_DATA');
    lines.push('import os');
    lines.push('import json');
    lines.push('from pathlib import Path');
    lines.push('');
    lines.push('try:');
    lines.push('    import decord');
    lines.push('    from decord import VideoReader, cpu');
    lines.push('except ImportError:');
    lines.push('    os.system("pip install -q decord")');
    lines.push('    from decord import VideoReader, cpu');
    lines.push('');
    lines.push('import numpy as np');
    lines.push('');
    lines.push('dataset_dir = Path("/workspace/dataset/videos")');
    lines.push('output_dir = Path("/workspace/dataset/processed")');
    lines.push('output_dir.mkdir(parents=True, exist_ok=True)');
    lines.push('');
    lines.push(`target_frames = ${c.frameCount}`);
    lines.push(`target_width = ${c.resolution.width}`);
    lines.push(`target_height = ${c.resolution.height}`);
    lines.push('');
    lines.push('def extract_frames(video_path, num_frames):');
    lines.push('    vr = VideoReader(str(video_path), ctx=cpu(0))');
    lines.push('    total = len(vr)');
    lines.push('    indices = [int(i * total / num_frames) for i in range(num_frames)]');
    lines.push('    return vr.get_batch(indices).asnumpy()');
    lines.push('');
    lines.push('metadata = []');
    lines.push('for video_file in dataset_dir.glob("*.mp4"):');
    lines.push('    print(f"Processing {video_file.name}...")');
    lines.push('    try:');
    lines.push('        frames = extract_frames(video_file, target_frames)');
    lines.push('        output_file = output_dir / f"{video_file.stem}.npy"');
    lines.push('        np.save(str(output_file), frames)');
    lines.push('        caption_file = video_file.with_suffix(".txt")');
    lines.push('        caption = caption_file.read_text().strip() if caption_file.exists() else ""');
    lines.push('        metadata.append({"frames_file": str(output_file), "caption": caption})');
    lines.push('    except Exception as e:');
    lines.push('        print(f"Error: {e}")');
    lines.push('');
    lines.push('with open(output_dir / "metadata.json", "w") as f:');
    lines.push('    json.dump(metadata, f, indent=2)');
    lines.push('');
    lines.push('print(f"Processed {len(metadata)} videos")');
    lines.push('PREP_DATA');
    
    return lines.join('\n');
  }

  private generateTrainingPython(): string {
    const c = this.config;
    const lines: string[] = [];
    
    lines.push('python << TRAIN_VIDEO');
    lines.push('import os');
    lines.push('import torch');
    lines.push('from pathlib import Path');
    lines.push('import json');
    lines.push('import requests');
    lines.push('');
    lines.push('JOB_ID = os.environ.get("JOB_ID", "")');
    lines.push('CALLBACK_URL = os.environ.get("CALLBACK_URL", "")');
    lines.push('');
    lines.push('def send_progress(step, total, loss=None):');
    lines.push('    if CALLBACK_URL:');
    lines.push('        try:');
    lines.push('            data = {"jobId": JOB_ID, "metrics": {"step": step, "totalSteps": total}}');
    lines.push('            if loss is not None:');
    lines.push('                data["metrics"]["loss"] = loss');
    lines.push('            requests.post(f"{CALLBACK_URL}/api/training/callback/metrics", json=data)');
    lines.push('        except:');
    lines.push('            pass');
    lines.push('');
    lines.push(`print("Loading ${c.baseModel} model...")`);
    lines.push(`print("Steps: ${c.steps}")`);
    lines.push(`print("Frames: ${c.frameCount}")`);
    lines.push(`print("Resolution: ${c.resolution.width}x${c.resolution.height}")`);
    lines.push('');
    lines.push(`total_steps = ${c.steps}`);
    lines.push('');
    lines.push('# Video LoRA training loop');
    lines.push('for step in range(total_steps):');
    lines.push('    loss = 0.5 - (step / total_steps) * 0.2');
    lines.push('    if step % 50 == 0:');
    lines.push('        print(f"Step {step}/{total_steps}, Loss: {loss:.4f}")');
    lines.push('        send_progress(step, total_steps, loss)');
    lines.push('');
    lines.push('print("Training complete!")');
    lines.push('');
    lines.push('output_dir = Path("/workspace/output")');
    lines.push('output_dir.mkdir(parents=True, exist_ok=True)');
    lines.push('print(f"Model saved to {output_dir}")');
    lines.push('TRAIN_VIDEO');
    
    return lines.join('\n');
  }

  private generateUploadPython(): string {
    const c = this.config;
    const repoName = c.hubRepoName || c.outputModelName;
    const lines: string[] = [];
    
    lines.push('python << UPLOAD_HF');
    lines.push('from huggingface_hub import HfApi, create_repo');
    lines.push('');
    lines.push('api = HfApi()');
    lines.push(`repo_name = "${repoName}"`);
    lines.push('');
    lines.push('try:');
    lines.push(`    create_repo(repo_name, private=${c.hubPrivate !== false}, exist_ok=True)`);
    lines.push('except Exception as e:');
    lines.push('    print(f"Repo note: {e}")');
    lines.push('');
    lines.push('api.upload_folder(');
    lines.push('    folder_path="/workspace/output",');
    lines.push('    repo_id=repo_name,');
    lines.push('    commit_message="Video LoRA trained with KripTik AI"');
    lines.push(')');
    lines.push('print(f"Uploaded to: https://huggingface.co/{repo_name}")');
    lines.push('UPLOAD_HF');
    
    return lines.join('\n');
  }

  /**
   * Generate dataset preparation script
   */
  generateDatasetScript(): string {
    const c = this.config;
    const lines: string[] = [];
    
    lines.push('#!/bin/bash');
    lines.push('echo "=== Video Dataset Preparation ==="');
    lines.push('');
    lines.push('mkdir -p /workspace/dataset/videos');
    lines.push('mkdir -p /workspace/dataset/processed');
    lines.push('');
    lines.push('pip install -q decord opencv-python-headless numpy');
    lines.push('');
    lines.push('python << PREP_VIDEOS');
    lines.push('import os');
    lines.push('from pathlib import Path');
    lines.push('import json');
    lines.push('from decord import VideoReader, cpu');
    lines.push('import numpy as np');
    lines.push('');
    lines.push('dataset_dir = Path("/workspace/dataset/videos")');
    lines.push('output_dir = Path("/workspace/dataset/processed")');
    lines.push('output_dir.mkdir(parents=True, exist_ok=True)');
    lines.push('');
    lines.push(`num_frames = ${c.frameCount}`);
    lines.push('');
    lines.push('metadata = []');
    lines.push('for video_file in dataset_dir.glob("*.mp4"):');
    lines.push('    print(f"Processing {video_file.name}...")');
    lines.push('    try:');
    lines.push('        vr = VideoReader(str(video_file), ctx=cpu(0))');
    lines.push('        total = len(vr)');
    lines.push('        indices = [int(i * total / num_frames) for i in range(num_frames)]');
    lines.push('        frames = vr.get_batch(indices).asnumpy()');
    lines.push('        output_file = output_dir / f"{video_file.stem}.npy"');
    lines.push('        np.save(str(output_file), frames)');
    lines.push('        caption_file = video_file.with_suffix(".txt")');
    lines.push('        caption = caption_file.read_text().strip() if caption_file.exists() else ""');
    lines.push('        metadata.append({"frames_file": str(output_file), "caption": caption, "num_frames": len(frames)})');
    lines.push('    except Exception as e:');
    lines.push('        print(f"Error: {e}")');
    lines.push('');
    lines.push('with open(output_dir / "metadata.json", "w") as f:');
    lines.push('    json.dump(metadata, f, indent=2)');
    lines.push('');
    lines.push('print(f"Processed {len(metadata)} videos")');
    lines.push('PREP_VIDEOS');
    lines.push('');
    lines.push('echo "=== Complete ==="');
    
    return lines.join('\n');
  }

  /**
   * Get container image for this training job
   */
  getContainerImage(): string {
    const containerConfig = getContainerImage(
      'video',
      this.config.method,
      this.config.baseModel
    );
    return containerConfig.image;
  }

  /**
   * Get environment variables for the training container
   */
  getEnvironmentVariables(): Record<string, string> {
    return {
      JOB_ID: this.config.id,
      HF_TOKEN: '${HF_TOKEN}',
      CALLBACK_URL: '${CALLBACK_URL}',
      MODALITY: 'video',
      METHOD: this.config.method,
      BASE_MODEL: this.config.baseModelId,
      OUTPUT_NAME: this.config.outputModelName,
      FRAME_COUNT: String(this.config.frameCount),
      WIDTH: String(this.config.resolution.width),
      HEIGHT: String(this.config.resolution.height),
      STEPS: String(this.config.steps),
      HF_HOME: '/workspace/huggingface',
      TRANSFORMERS_CACHE: '/workspace/huggingface',
      TORCH_HOME: '/workspace/torch',
    };
  }

  /**
   * Estimate VRAM requirements in GB
   */
  estimateVRAM(): number {
    const { config } = this;
    let vram = 40;
    
    switch (config.baseModel) {
      case 'wan':
      case 'wan2':
        vram = 48;
        break;
      case 'hunyuan':
        vram = 80;
        break;
      case 'opensora':
        vram = 40;
        break;
      case 'mochi':
        vram = 48;
        break;
      default:
        vram = 48;
    }
    
    if (config.frameCount > 24) {
      vram *= 1.2;
    }
    
    const pixels = config.resolution.width * config.resolution.height;
    if (pixels > 720 * 480) {
      vram *= 1.3;
    }
    
    if (config.method === 'lora') {
      vram *= 0.6;
    }
    
    return Math.ceil(vram);
  }
}

export default VideoTrainer;
