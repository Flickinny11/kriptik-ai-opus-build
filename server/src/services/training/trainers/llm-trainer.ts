/**
 * LLM Trainer
 *
 * Generates training scripts for LLM fine-tuning.
 * Supports LoRA, QLoRA, and full fine-tuning with Unsloth for 2x speed.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import type { LLMTrainingConfig } from '../types.js';
import { getContainerImage } from '../container-images.js';

// =============================================================================
// TYPES
// =============================================================================

export interface LLMTrainerResult {
  trainingScript: string;
  datasetScript: string;
  containerImage: string;
  environmentVariables: Record<string, string>;
  estimatedVRAM: number;
}

// =============================================================================
// LLM TRAINER CLASS
// =============================================================================

export class LLMTrainer {
  private config: LLMTrainingConfig;

  constructor(config: LLMTrainingConfig) {
    this.config = config;
  }

  /**
   * Generate complete training configuration
   */
  generate(): LLMTrainerResult {
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
    const isQLoRA = config.method === 'qlora';
    const useUnsloth = config.useUnsloth && (config.method === 'qlora' || config.method === 'lora');
    
    lines.push('#!/bin/bash');
    lines.push('set -e');
    lines.push('');
    lines.push('echo "=== KripTik AI LLM Training Job ==="');
    lines.push(`echo "Job ID: ${config.id}"`);
    lines.push(`echo "Model: ${config.baseModelId}"`);
    lines.push(`echo "Method: ${config.method}${useUnsloth ? ' (Unsloth accelerated)' : ''}"`);
    lines.push(`echo "Epochs: ${config.epochs}"`);
    lines.push('');
    
    // Create workspace
    lines.push('mkdir -p /workspace/dataset');
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
    if (useUnsloth) {
      lines.push('pip install -q "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"');
      lines.push('pip install -q --no-deps trl peft accelerate bitsandbytes');
    } else {
      lines.push('pip install -q transformers accelerate peft datasets bitsandbytes trl');
    }
    lines.push('pip install -q huggingface_hub xformers || true');
    lines.push('');
    
    // HuggingFace login
    lines.push('python -c "from huggingface_hub import login; login(token=\'$HF_TOKEN\')"');
    lines.push('');
    
    // Training
    lines.push('send_callback "Starting training..."');
    lines.push('');
    
    if (useUnsloth) {
      lines.push(this.generateUnslothTrainingPython());
    } else {
      lines.push(this.generateStandardTrainingPython());
    }
    
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

  private generateUnslothTrainingPython(): string {
    const c = this.config;
    const isQLoRA = c.method === 'qlora';
    const lines: string[] = [];
    
    lines.push('python << UNSLOTH_TRAIN');
    lines.push('import os');
    lines.push('import torch');
    lines.push('from unsloth import FastLanguageModel');
    lines.push('from datasets import load_dataset');
    lines.push('from trl import SFTTrainer');
    lines.push('from transformers import TrainingArguments, TrainerCallback');
    lines.push('import requests');
    lines.push('');
    lines.push('JOB_ID = os.environ.get("JOB_ID", "")');
    lines.push('CALLBACK_URL = os.environ.get("CALLBACK_URL", "")');
    lines.push('');
    lines.push('def send_progress(step, total, loss=None, lr=None):');
    lines.push('    if CALLBACK_URL:');
    lines.push('        try:');
    lines.push('            data = {"jobId": JOB_ID, "metrics": {"step": step, "totalSteps": total}}');
    lines.push('            if loss is not None:');
    lines.push('                data["metrics"]["loss"] = loss');
    lines.push('            requests.post(f"{CALLBACK_URL}/api/training/callback/metrics", json=data)');
    lines.push('        except:');
    lines.push('            pass');
    lines.push('');
    lines.push(`model_id = "${c.baseModelId}"`);
    lines.push(`max_seq_length = ${c.maxSeqLength || 2048}`);
    lines.push('dtype = torch.float16');
    lines.push(`load_in_4bit = ${isQLoRA}`);
    lines.push('');
    lines.push('print(f"Loading model: {model_id}")');
    lines.push('');
    lines.push('model, tokenizer = FastLanguageModel.from_pretrained(');
    lines.push('    model_name=model_id,');
    lines.push('    max_seq_length=max_seq_length,');
    lines.push('    dtype=dtype,');
    lines.push('    load_in_4bit=load_in_4bit,');
    lines.push(')');
    lines.push('');
    lines.push('print("Model loaded!")');
    lines.push('');
    lines.push('model = FastLanguageModel.get_peft_model(');
    lines.push('    model,');
    lines.push(`    r=${c.loraConfig?.rank || 16},`);
    lines.push(`    lora_alpha=${c.loraConfig?.alpha || 32},`);
    lines.push(`    lora_dropout=${c.loraConfig?.dropout || 0.05},`);
    lines.push(`    target_modules=${JSON.stringify(c.loraConfig?.targetModules || ['q_proj', 'k_proj', 'v_proj', 'o_proj'])},`);
    lines.push('    bias="none",');
    lines.push('    use_gradient_checkpointing="unsloth",');
    lines.push('    random_state=42,');
    lines.push(')');
    lines.push('');
    lines.push('model.print_trainable_parameters()');
    lines.push('');
    
    // Dataset loading
    lines.push('print("Loading dataset...")');
    if (c.datasetConfig.source === 'huggingface' && c.datasetConfig.datasetId) {
      lines.push(`dataset = load_dataset("${c.datasetConfig.datasetId}", split="${c.datasetConfig.split || 'train'}")`);
    } else {
      lines.push('from datasets import Dataset');
      lines.push('import json');
      lines.push('with open("/workspace/dataset/data.json") as f:');
      lines.push('    data = json.load(f)');
      lines.push('dataset = Dataset.from_list(data)');
    }
    lines.push('');
    
    // Format dataset
    const textColumn = c.datasetConfig.textColumn || 'text';
    lines.push('def format_prompt(example):');
    lines.push('    if "instruction" in example and "output" in example:');
    lines.push('        text = f"""### Instruction:\\n{example["instruction"]}\\n\\n### Input:\\n{example.get("input", "")}\\n\\n### Response:\\n{example["output"]}"""');
    lines.push('    else:');
    lines.push(`        text = example.get("${textColumn}", str(example))`);
    lines.push('    return {"text": text}');
    lines.push('');
    lines.push('dataset = dataset.map(format_prompt)');
    lines.push('');
    
    // Training arguments
    lines.push('training_args = TrainingArguments(');
    lines.push('    output_dir="/workspace/output",');
    lines.push(`    num_train_epochs=${c.epochs},`);
    lines.push(`    per_device_train_batch_size=${c.batchSize},`);
    lines.push(`    gradient_accumulation_steps=${c.gradientAccumulationSteps || 4},`);
    lines.push(`    learning_rate=${c.learningRate},`);
    lines.push(`    warmup_steps=${c.warmupSteps || 100},`);
    lines.push('    logging_steps=10,');
    lines.push('    save_strategy="epoch",');
    lines.push(`    fp16=${!isQLoRA},`);
    lines.push(`    bf16=${isQLoRA},`);
    lines.push('    optim="adamw_8bit",');
    lines.push('    lr_scheduler_type="cosine",');
    lines.push('    seed=42,');
    lines.push('    report_to="none",');
    lines.push(')');
    lines.push('');
    
    // Progress callback
    lines.push('class ProgressCallback(TrainerCallback):');
    lines.push('    def on_log(self, args, state, control, logs=None, **kwargs):');
    lines.push('        if logs and state.global_step > 0:');
    lines.push('            send_progress(state.global_step, state.max_steps, logs.get("loss"), logs.get("learning_rate"))');
    lines.push('');
    
    // Trainer
    lines.push('trainer = SFTTrainer(');
    lines.push('    model=model,');
    lines.push('    tokenizer=tokenizer,');
    lines.push('    train_dataset=dataset,');
    lines.push('    dataset_text_field="text",');
    lines.push('    max_seq_length=max_seq_length,');
    lines.push('    args=training_args,');
    lines.push('    packing=True,');
    lines.push('    callbacks=[ProgressCallback()],');
    lines.push(')');
    lines.push('');
    lines.push('print("Starting training...")');
    lines.push('trainer.train()');
    lines.push('print("Training complete!")');
    lines.push('');
    lines.push('trainer.save_model("/workspace/output")');
    lines.push('print("Model saved!")');
    lines.push('UNSLOTH_TRAIN');
    
    return lines.join('\n');
  }

  private generateStandardTrainingPython(): string {
    const c = this.config;
    const isQLoRA = c.method === 'qlora';
    const isFullFinetune = c.method === 'full_finetune';
    const lines: string[] = [];
    
    lines.push('python << STANDARD_TRAIN');
    lines.push('import os');
    lines.push('import torch');
    lines.push('from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments, TrainerCallback');
    if (isQLoRA) {
      lines.push('from transformers import BitsAndBytesConfig');
    }
    if (!isFullFinetune) {
      lines.push('from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training');
    }
    lines.push('from datasets import load_dataset');
    lines.push('from trl import SFTTrainer');
    lines.push('import requests');
    lines.push('');
    lines.push('JOB_ID = os.environ.get("JOB_ID", "")');
    lines.push('CALLBACK_URL = os.environ.get("CALLBACK_URL", "")');
    lines.push('');
    lines.push(`model_id = "${c.baseModelId}"`);
    lines.push('print(f"Loading model: {model_id}")');
    lines.push('');
    
    if (isQLoRA) {
      lines.push('bnb_config = BitsAndBytesConfig(');
      lines.push('    load_in_4bit=True,');
      lines.push('    bnb_4bit_use_double_quant=True,');
      lines.push('    bnb_4bit_quant_type="nf4",');
      lines.push('    bnb_4bit_compute_dtype=torch.bfloat16,');
      lines.push(')');
      lines.push('');
      lines.push('model = AutoModelForCausalLM.from_pretrained(');
      lines.push('    model_id,');
      lines.push('    quantization_config=bnb_config,');
      lines.push('    device_map="auto",');
      lines.push('    trust_remote_code=True,');
      lines.push(')');
      lines.push('model = prepare_model_for_kbit_training(model)');
    } else {
      lines.push('model = AutoModelForCausalLM.from_pretrained(');
      lines.push('    model_id,');
      lines.push('    torch_dtype=torch.float16,');
      lines.push('    device_map="auto",');
      lines.push('    trust_remote_code=True,');
      lines.push(')');
    }
    
    lines.push('');
    lines.push('tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)');
    lines.push('tokenizer.pad_token = tokenizer.eos_token');
    lines.push('');
    
    if (!isFullFinetune) {
      lines.push('lora_config = LoraConfig(');
      lines.push(`    r=${c.loraConfig?.rank || 16},`);
      lines.push(`    lora_alpha=${c.loraConfig?.alpha || 32},`);
      lines.push(`    lora_dropout=${c.loraConfig?.dropout || 0.05},`);
      lines.push(`    target_modules=${JSON.stringify(c.loraConfig?.targetModules || ['q_proj', 'k_proj', 'v_proj', 'o_proj'])},`);
      lines.push('    bias="none",');
      lines.push('    task_type="CAUSAL_LM",');
      lines.push(')');
      lines.push('model = get_peft_model(model, lora_config)');
      lines.push('model.print_trainable_parameters()');
      lines.push('');
    }
    
    // Dataset
    lines.push('print("Loading dataset...")');
    if (c.datasetConfig.source === 'huggingface' && c.datasetConfig.datasetId) {
      lines.push(`dataset = load_dataset("${c.datasetConfig.datasetId}", split="${c.datasetConfig.split || 'train'}")`);
    } else {
      lines.push('from datasets import Dataset');
      lines.push('import json');
      lines.push('with open("/workspace/dataset/data.json") as f:');
      lines.push('    data = json.load(f)');
      lines.push('dataset = Dataset.from_list(data)');
    }
    lines.push('');
    
    // Training
    lines.push('training_args = TrainingArguments(');
    lines.push('    output_dir="/workspace/output",');
    lines.push(`    num_train_epochs=${c.epochs},`);
    lines.push(`    per_device_train_batch_size=${c.batchSize},`);
    lines.push(`    gradient_accumulation_steps=${c.gradientAccumulationSteps || 4},`);
    lines.push(`    learning_rate=${c.learningRate},`);
    lines.push(`    warmup_steps=${c.warmupSteps || 100},`);
    lines.push('    logging_steps=10,');
    lines.push('    save_strategy="epoch",');
    lines.push('    fp16=True,');
    lines.push('    optim="paged_adamw_8bit",');
    lines.push('    lr_scheduler_type="cosine",');
    lines.push('    report_to="none",');
    lines.push(')');
    lines.push('');
    
    lines.push('trainer = SFTTrainer(');
    lines.push('    model=model,');
    lines.push('    tokenizer=tokenizer,');
    lines.push('    train_dataset=dataset,');
    lines.push(`    dataset_text_field="${c.datasetConfig.textColumn || 'text'}",`);
    lines.push(`    max_seq_length=${c.maxSeqLength || 2048},`);
    lines.push('    args=training_args,');
    lines.push(')');
    lines.push('');
    lines.push('print("Starting training...")');
    lines.push('trainer.train()');
    lines.push('print("Training complete!")');
    lines.push('');
    lines.push('trainer.save_model("/workspace/output")');
    lines.push('STANDARD_TRAIN');
    
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
    lines.push('echo "=== Dataset Preparation ==="');
    lines.push('');
    lines.push('mkdir -p /workspace/dataset');
    lines.push('');
    lines.push('python << PREP_DATA');
    lines.push('from pathlib import Path');
    lines.push('from datasets import load_dataset');
    lines.push('import json');
    lines.push('');
    lines.push('output_dir = Path("/workspace/dataset")');
    lines.push('output_dir.mkdir(parents=True, exist_ok=True)');
    lines.push('');
    
    if (c.datasetConfig.source === 'huggingface' && c.datasetConfig.datasetId) {
      lines.push(`print("Downloading dataset: ${c.datasetConfig.datasetId}")`);
      lines.push(`dataset = load_dataset("${c.datasetConfig.datasetId}", split="${c.datasetConfig.split || 'train'}")`);
      lines.push('print(f"Columns: {dataset.column_names}")');
      lines.push('print(f"Size: {len(dataset)} samples")');
      lines.push('sample = dataset.select(range(min(5, len(dataset))))');
      lines.push('sample.to_json(output_dir / "sample.json")');
    } else {
      lines.push('print("Using uploaded dataset files")');
    }
    
    lines.push('print("Dataset preparation complete!")');
    lines.push('PREP_DATA');
    lines.push('');
    lines.push('echo "=== Complete ==="');
    
    return lines.join('\n');
  }

  /**
   * Get container image for this training job
   */
  getContainerImage(): string {
    const { config } = this;
    
    if (config.useUnsloth && (config.method === 'qlora' || config.method === 'lora')) {
      return 'unslothai/unsloth:latest-py311-cu121-torch231';
    }
    
    const containerConfig = getContainerImage('llm', config.method);
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
      MODALITY: 'llm',
      METHOD: this.config.method,
      BASE_MODEL: this.config.baseModelId,
      OUTPUT_NAME: this.config.outputModelName,
      EPOCHS: String(this.config.epochs),
      BATCH_SIZE: String(this.config.batchSize),
      LEARNING_RATE: String(this.config.learningRate),
      MAX_SEQ_LENGTH: String(this.config.maxSeqLength || 2048),
      HF_HOME: '/workspace/huggingface',
      TRANSFORMERS_CACHE: '/workspace/huggingface',
      TORCH_HOME: '/workspace/torch',
      CUDA_VISIBLE_DEVICES: '0',
    };
  }

  /**
   * Estimate VRAM requirements in GB
   */
  estimateVRAM(): number {
    const { config } = this;
    const modelSize = this.estimateModelSize();
    let vram: number;
    
    if (config.method === 'qlora') {
      vram = modelSize * 1.5 + 4;
    } else if (config.method === 'lora') {
      vram = modelSize * 2 + 4;
    } else {
      vram = modelSize * 4 + 8;
    }
    
    vram *= Math.max(1, config.batchSize * 0.3);
    
    if ((config.maxSeqLength || 2048) > 4096) {
      vram *= 1.5;
    }
    
    if (config.useUnsloth) {
      vram *= 0.4;
    }
    
    return Math.ceil(vram);
  }

  private estimateModelSize(): number {
    const modelId = this.config.baseModelId.toLowerCase();
    
    const sizePatterns = [
      { pattern: /405b/i, size: 405 },
      { pattern: /235b/i, size: 235 },
      { pattern: /180b/i, size: 180 },
      { pattern: /123b/i, size: 123 },
      { pattern: /109b/i, size: 109 },
      { pattern: /72b/i, size: 72 },
      { pattern: /70b/i, size: 70 },
      { pattern: /34b/i, size: 34 },
      { pattern: /32b/i, size: 32 },
      { pattern: /27b/i, size: 27 },
      { pattern: /14b/i, size: 14 },
      { pattern: /13b/i, size: 13 },
      { pattern: /8b/i, size: 8 },
      { pattern: /7b/i, size: 7 },
      { pattern: /4b/i, size: 4 },
      { pattern: /3b/i, size: 3 },
      { pattern: /2b/i, size: 2 },
      { pattern: /1b/i, size: 1 },
    ];
    
    for (const { pattern, size } of sizePatterns) {
      if (pattern.test(modelId)) {
        return size;
      }
    }
    
    return 7;
  }
}

export default LLMTrainer;
