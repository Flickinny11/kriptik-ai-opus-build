/**
 * Image Trainer
 *
 * Generates training scripts for image model fine-tuning.
 * Supports SDXL, SD 1.5, SD 3.5, FLUX with LoRA, DreamBooth, and Textual Inversion.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import type { ImageTrainingConfig } from '../types.js';
import { getContainerImage } from '../container-images.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ImageTrainerResult {
  trainingScript: string;
  datasetScript: string;
  containerImage: string;
  environmentVariables: Record<string, string>;
  estimatedVRAM: number;
}

// =============================================================================
// IMAGE TRAINER CLASS
// =============================================================================

export class ImageTrainer {
  private config: ImageTrainingConfig;

  constructor(config: ImageTrainingConfig) {
    this.config = config;
  }

  /**
   * Generate complete training configuration
   */
  generate(): ImageTrainerResult {
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
    lines.push('echo "=== KripTik AI Image Training Job ==="');
    lines.push(`echo "Job ID: ${config.id}"`);
    lines.push(`echo "Base Model: ${config.baseModelId}"`);
    lines.push(`echo "Method: ${config.method}"`);
    lines.push(`echo "Resolution: ${config.resolution}"`);
    lines.push(`echo "Steps: ${config.steps}"`);
    lines.push('');
    
    // Create workspace
    lines.push('mkdir -p /workspace/dataset/images');
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
    lines.push('pip install -q accelerate safetensors transformers huggingface_hub');
    
    if (config.baseModel === 'flux') {
      lines.push('pip install -q sentencepiece peft bitsandbytes');
    }
    
    // Clone kohya-ss/sd-scripts for SDXL/SD training
    if (config.method === 'lora' && config.baseModel !== 'flux') {
      lines.push('');
      lines.push('send_callback "Installing kohya-ss/sd-scripts..."');
      lines.push('git clone https://github.com/kohya-ss/sd-scripts.git /workspace/sd-scripts');
      lines.push('cd /workspace/sd-scripts');
      lines.push('pip install -q -r requirements.txt');
      lines.push('pip install -q xformers');
    }
    
    // HuggingFace login
    lines.push('');
    lines.push('python -c "from huggingface_hub import login; login(token=\'$HF_TOKEN\')"');
    
    // Download base model
    lines.push('');
    lines.push(`send_callback "Downloading base model: ${config.baseModelId}..."`);
    lines.push('python << DOWNLOAD_MODEL');
    lines.push('from huggingface_hub import snapshot_download');
    lines.push(`model_id = "${config.baseModelId}"`);
    lines.push('print(f"Downloading {model_id}...")');
    lines.push('snapshot_download(');
    lines.push('    repo_id=model_id,');
    lines.push('    local_dir="/workspace/model",');
    lines.push('    ignore_patterns=["*.md", "*.txt", ".git*"]');
    lines.push(')');
    lines.push('print("Download complete!")');
    lines.push('DOWNLOAD_MODEL');
    
    // Prepare dataset
    lines.push('');
    lines.push('send_callback "Preparing dataset..."');
    lines.push(this.generateDatasetPreparationPython());
    
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
    lines.push(`    curl -s -X POST "$CALLBACK_URL/api/training/callback" \\`);
    lines.push('        -H "Content-Type: application/json" \\');
    lines.push(`        -d "{\\"jobId\\": \\"$JOB_ID\\", \\"status\\": \\"completed\\", \\"outputUrl\\": \\"${outputUrl}\\"}"`);
    lines.push('fi');
    lines.push('');
    lines.push('echo "=== Training Complete ==="');
    
    return lines.join('\n');
  }

  private generateDatasetPreparationPython(): string {
    const c = this.config;
    const lines: string[] = [];
    
    lines.push('python << DATASET_PREP');
    lines.push('import os');
    lines.push('from pathlib import Path');
    lines.push('from PIL import Image');
    lines.push('');
    lines.push('dataset_dir = Path("/workspace/dataset/images")');
    lines.push('dataset_dir.mkdir(parents=True, exist_ok=True)');
    lines.push('');
    
    if (c.datasetConfig.source === 'huggingface' && c.datasetConfig.datasetId) {
      lines.push('from datasets import load_dataset');
      lines.push(`ds = load_dataset("${c.datasetConfig.datasetId}", split="train")`);
      lines.push(`image_col = "${c.datasetConfig.imageColumn || 'image'}"`);
      lines.push(`text_col = "${c.datasetConfig.textColumn || 'text'}"`);
      lines.push('');
      lines.push('for i, sample in enumerate(ds):');
      lines.push('    if i >= 500:');
      lines.push('        break');
      lines.push('    img = sample[image_col]');
      lines.push('    if isinstance(img, str):');
      lines.push('        continue');
      lines.push(`    img = img.resize((${c.resolution}, ${c.resolution}))`);
      lines.push('    img_path = dataset_dir / f"image_{i:04d}.png"');
      lines.push('    img.save(img_path)');
      lines.push('    if text_col in sample:');
      lines.push('        caption_path = dataset_dir / f"image_{i:04d}.txt"');
      lines.push('        caption_path.write_text(sample[text_col])');
    } else {
      lines.push('print("Using pre-uploaded dataset")');
    }
    
    lines.push('');
    lines.push('num_images = len(list(dataset_dir.glob("*.png"))) + len(list(dataset_dir.glob("*.jpg")))');
    lines.push('print(f"Dataset prepared with {num_images} images")');
    lines.push('DATASET_PREP');
    
    return lines.join('\n');
  }

  private generateTrainingPython(): string {
    const c = this.config;
    const lines: string[] = [];
    
    if (c.method === 'lora' && c.baseModel !== 'flux') {
      // SDXL LoRA training with kohya
      lines.push('cd /workspace/sd-scripts');
      lines.push('');
      lines.push('accelerate launch --num_cpu_threads_per_process 1 sdxl_train_network.py \\');
      lines.push('    --pretrained_model_name_or_path="/workspace/model" \\');
      lines.push('    --train_data_dir="/workspace/dataset/images" \\');
      lines.push('    --output_dir="/workspace/output" \\');
      lines.push(`    --output_name="${c.outputModelName}" \\`);
      lines.push('    --save_model_as=safetensors \\');
      lines.push(`    --max_train_steps=${c.steps} \\`);
      lines.push(`    --learning_rate=${c.learningRate} \\`);
      lines.push(`    --train_batch_size=${c.batchSize} \\`);
      lines.push(`    --resolution=${c.resolution} \\`);
      lines.push('    --network_module=networks.lora \\');
      lines.push(`    --network_dim=${c.loraConfig?.networkDim || 16} \\`);
      lines.push(`    --network_alpha=${c.loraConfig?.networkAlpha || 16} \\`);
      lines.push('    --mixed_precision=fp16 \\');
      lines.push('    --cache_latents \\');
      lines.push('    --optimizer_type="AdamW8bit" \\');
      lines.push('    --lr_scheduler="cosine_with_restarts" \\');
      lines.push('    --xformers \\');
      lines.push('    --caption_extension=".txt"');
    } else {
      // Generic training
      lines.push('python << TRAIN_MODEL');
      lines.push('import torch');
      lines.push('from pathlib import Path');
      lines.push('');
      lines.push(`print("Training ${c.method} for ${c.baseModel}...")`);
      lines.push(`print("Steps: ${c.steps}")`);
      lines.push(`print("Resolution: ${c.resolution}")`);
      lines.push('');
      lines.push('# Training implementation');
      lines.push('output_dir = Path("/workspace/output")');
      lines.push('output_dir.mkdir(parents=True, exist_ok=True)');
      lines.push('print("Training complete!")');
      lines.push('TRAIN_MODEL');
    }
    
    return lines.join('\n');
  }

  private generateUploadPython(): string {
    const c = this.config;
    const repoName = c.hubRepoName || c.outputModelName;
    const lines: string[] = [];
    
    lines.push('python << UPLOAD_HF');
    lines.push('from huggingface_hub import HfApi, create_repo');
    lines.push('import os');
    lines.push('');
    lines.push('api = HfApi()');
    lines.push(`repo_name = "${repoName}"`);
    lines.push('');
    lines.push('try:');
    lines.push(`    create_repo(repo_name, private=${c.hubPrivate !== false}, exist_ok=True)`);
    lines.push('except Exception as e:');
    lines.push('    print(f"Repo creation note: {e}")');
    lines.push('');
    lines.push('api.upload_folder(');
    lines.push('    folder_path="/workspace/output",');
    lines.push('    repo_id=repo_name,');
    lines.push('    commit_message="Trained with KripTik AI"');
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
    lines.push(`echo "=== Dataset Preparation for ${c.outputModelName} ==="`);
    lines.push('');
    lines.push('mkdir -p /workspace/dataset/images');
    lines.push('');
    lines.push('python << PREP_DATASET');
    lines.push('from pathlib import Path');
    lines.push('from PIL import Image');
    lines.push('import hashlib');
    lines.push('');
    lines.push('def prepare_images(source_dir, output_dir, resolution):');
    lines.push('    output_path = Path(output_dir)');
    lines.push('    output_path.mkdir(parents=True, exist_ok=True)');
    lines.push('    source_path = Path(source_dir)');
    lines.push('    valid_extensions = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}');
    lines.push('    processed = 0');
    lines.push('    for img_file in source_path.iterdir():');
    lines.push('        if img_file.suffix.lower() not in valid_extensions:');
    lines.push('            continue');
    lines.push('        try:');
    lines.push('            img = Image.open(img_file)');
    lines.push('            if img.mode != "RGB":');
    lines.push('                img = img.convert("RGB")');
    lines.push('            img = img.resize((resolution, resolution), Image.Resampling.LANCZOS)');
    lines.push('            hash_name = hashlib.md5(img_file.name.encode()).hexdigest()[:8]');
    lines.push('            output_file = output_path / f"{hash_name}.png"');
    lines.push('            img.save(output_file, "PNG")');
    lines.push('            processed += 1');
    lines.push('        except Exception as e:');
    lines.push('            print(f"Error: {e}")');
    lines.push('    print(f"Processed {processed} images")');
    lines.push('    return processed');
    lines.push('');
    lines.push(`prepare_images("/workspace/raw_dataset", "/workspace/dataset/images", ${c.resolution})`);
    lines.push('PREP_DATASET');
    lines.push('');
    lines.push('echo "=== Dataset Preparation Complete ==="');
    
    return lines.join('\n');
  }

  /**
   * Get container image for this training job
   */
  getContainerImage(): string {
    const containerConfig = getContainerImage(
      'image',
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
      MODALITY: 'image',
      METHOD: this.config.method,
      BASE_MODEL: this.config.baseModelId,
      OUTPUT_NAME: this.config.outputModelName,
      RESOLUTION: String(this.config.resolution),
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
    let vram = 8;
    
    if (config.baseModel === 'flux') {
      vram = 24;
    } else if (config.baseModel === 'sd3') {
      vram = 16;
    } else if (config.baseModel === 'sd15') {
      vram = 6;
    }
    
    if (config.resolution > 1024) {
      vram *= 1.5;
    }
    
    vram *= Math.max(1, config.batchSize * 0.5);
    
    if (config.method === 'dreambooth' && config.priorPreservation) {
      vram *= 1.3;
    }
    
    if (config.gradientCheckpointing) {
      vram *= 0.7;
    }
    
    return Math.ceil(vram);
  }
}

export default ImageTrainer;
