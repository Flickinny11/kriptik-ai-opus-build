/**
 * Training Job - Individual Training Job Management
 * 
 * Represents a single fine-tuning job running on RunPod.
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 4).
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

// =============================================================================
// TYPES
// =============================================================================

export type TrainingJobStatus = 
  | 'queued'
  | 'provisioning'
  | 'downloading'
  | 'training'
  | 'saving'
  | 'completed'
  | 'failed'
  | 'stopped'
  | 'cancelled';

export type TrainingType = 'lora' | 'qlora' | 'full';

export interface TrainingJobConfig {
  // Model configuration
  modelId: string;
  modelName: string;
  
  // Training type
  trainingType: TrainingType;
  
  // Training parameters
  epochs: number;
  learningRate: number;
  batchSize: number;
  
  // LoRA parameters (if applicable)
  loraRank?: number;
  loraAlpha?: number;
  loraDropout?: number;
  targetModules?: string[];
  
  // Dataset
  datasetId?: string;
  datasetPath?: string;
  
  // Output
  outputRepoName: string;
  autoSaveToHub: boolean;
  
  // Budget
  budgetLimit: number;
  
  // GPU configuration
  gpuType: string;
  gpuCount: number;
}

export interface TrainingMetrics {
  epoch: number;
  totalEpochs: number;
  step: number;
  totalSteps: number;
  loss: number;
  learningRate: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  costSoFar: number;
  gpuUtilization: number;
  memoryUsed: number;
  memoryTotal: number;
}

export interface TrainingJobState {
  id: string;
  userId: string;
  projectId?: string;
  config: TrainingJobConfig;
  status: TrainingJobStatus;
  metrics: TrainingMetrics | null;
  logs: string[];
  error?: string;
  runpodPodId?: string;
  outputModelUrl?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// =============================================================================
// TRAINING JOB CLASS
// =============================================================================

export class TrainingJob extends EventEmitter {
  readonly id: string;
  readonly userId: string;
  readonly projectId?: string;
  readonly config: TrainingJobConfig;
  
  private _status: TrainingJobStatus = 'queued';
  private _metrics: TrainingMetrics | null = null;
  private _logs: string[] = [];
  private _error?: string;
  private _runpodPodId?: string;
  private _outputModelUrl?: string;
  private _createdAt: Date;
  private _startedAt?: Date;
  private _completedAt?: Date;
  
  private metricsInterval?: NodeJS.Timeout;
  private costTracker: number = 0;
  private costPerHour: number = 0;

  constructor(
    userId: string,
    config: TrainingJobConfig,
    projectId?: string
  ) {
    super();
    this.id = uuidv4();
    this.userId = userId;
    this.projectId = projectId;
    this.config = config;
    this._createdAt = new Date();
    
    this.addLog(`Training job created: ${this.id}`);
    this.addLog(`Model: ${config.modelId}`);
    this.addLog(`Training type: ${config.trainingType.toUpperCase()}`);
  }

  // Getters
  get status(): TrainingJobStatus { return this._status; }
  get metrics(): TrainingMetrics | null { return this._metrics; }
  get logs(): string[] { return [...this._logs]; }
  get error(): string | undefined { return this._error; }
  get runpodPodId(): string | undefined { return this._runpodPodId; }
  get outputModelUrl(): string | undefined { return this._outputModelUrl; }
  get createdAt(): Date { return this._createdAt; }
  get startedAt(): Date | undefined { return this._startedAt; }
  get completedAt(): Date | undefined { return this._completedAt; }

  /**
   * Get the current state as a plain object
   */
  getState(): TrainingJobState {
    return {
      id: this.id,
      userId: this.userId,
      projectId: this.projectId,
      config: this.config,
      status: this._status,
      metrics: this._metrics,
      logs: this._logs,
      error: this._error,
      runpodPodId: this._runpodPodId,
      outputModelUrl: this._outputModelUrl,
      createdAt: this._createdAt,
      startedAt: this._startedAt,
      completedAt: this._completedAt,
    };
  }

  /**
   * Add a log entry
   */
  addLog(message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    this._logs.push(logEntry);
    this.emit('log', logEntry);
  }

  /**
   * Update job status
   */
  setStatus(status: TrainingJobStatus): void {
    const previousStatus = this._status;
    this._status = status;
    this.addLog(`Status changed: ${previousStatus} -> ${status}`);
    this.emit('status', status, previousStatus);
  }

  /**
   * Update training metrics
   */
  updateMetrics(metrics: Partial<TrainingMetrics>): void {
    this._metrics = {
      ...this._metrics,
      ...metrics,
    } as TrainingMetrics;
    this.emit('metrics', this._metrics);
  }

  /**
   * Set the RunPod pod ID
   */
  setRunpodPodId(podId: string): void {
    this._runpodPodId = podId;
    this.addLog(`RunPod pod assigned: ${podId}`);
  }

  /**
   * Set cost tracking
   */
  setCostPerHour(costPerHour: number): void {
    this.costPerHour = costPerHour;
    this.addLog(`GPU cost: $${costPerHour.toFixed(2)}/hr`);
  }

  /**
   * Start training
   */
  async start(): Promise<void> {
    this._startedAt = new Date();
    this.setStatus('provisioning');
    
    // Start cost tracking
    this.startCostTracking();
    
    // Initialize metrics
    this._metrics = {
      epoch: 0,
      totalEpochs: this.config.epochs,
      step: 0,
      totalSteps: 0,
      loss: 0,
      learningRate: this.config.learningRate,
      elapsedTime: 0,
      estimatedTimeRemaining: 0,
      costSoFar: 0,
      gpuUtilization: 0,
      memoryUsed: 0,
      memoryTotal: 0,
    };
  }

  /**
   * Start cost tracking interval
   */
  private startCostTracking(): void {
    this.metricsInterval = setInterval(() => {
      if (this._status === 'training' || this._status === 'provisioning' || this._status === 'downloading') {
        this.costTracker += this.costPerHour / 3600; // Add cost per second
        
        if (this._metrics) {
          this._metrics.costSoFar = Math.round(this.costTracker * 100) / 100;
          this._metrics.elapsedTime = Math.floor((Date.now() - this._startedAt!.getTime()) / 1000);
          
          // Check budget limit
          if (this._metrics.costSoFar >= this.config.budgetLimit) {
            this.addLog(`Budget limit reached: $${this.config.budgetLimit}`);
            this.stop('budget_exceeded');
          }
        }
      }
    }, 1000);
  }

  /**
   * Stop cost tracking
   */
  private stopCostTracking(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
  }

  /**
   * Complete training
   */
  complete(outputModelUrl: string): void {
    this._completedAt = new Date();
    this._outputModelUrl = outputModelUrl;
    this.setStatus('completed');
    this.stopCostTracking();
    this.addLog(`Training completed. Model saved to: ${outputModelUrl}`);
    this.emit('completed', outputModelUrl);
  }

  /**
   * Fail training
   */
  fail(error: string): void {
    this._completedAt = new Date();
    this._error = error;
    this.setStatus('failed');
    this.stopCostTracking();
    this.addLog(`Training failed: ${error}`);
    this.emit('failed', error);
  }

  /**
   * Stop training
   */
  stop(reason: string = 'user_requested'): void {
    this._completedAt = new Date();
    this.setStatus('stopped');
    this.stopCostTracking();
    this.addLog(`Training stopped: ${reason}`);
    this.emit('stopped', reason);
  }

  /**
   * Cancel training (before it starts)
   */
  cancel(): void {
    this.setStatus('cancelled');
    this.addLog('Training cancelled');
    this.emit('cancelled');
  }

  /**
   * Generate the training script for RunPod
   */
  generateTrainingScript(): string {
    const { config } = this;
    
    let script = `#!/bin/bash
set -e

echo "=== KripTik AI Training Job ==="
echo "Job ID: ${this.id}"
echo "Model: ${config.modelId}"
echo "Training Type: ${config.trainingType}"

# Install dependencies
pip install -q transformers accelerate peft datasets bitsandbytes huggingface_hub

# Login to HuggingFace
python -c "from huggingface_hub import login; login(token='$HF_TOKEN')"

# Start training
python << 'TRAINING_SCRIPT'
import os
import torch
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling,
)
from datasets import load_dataset
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
`;

    // Add quantization for QLoRA
    if (config.trainingType === 'qlora') {
      script += `
from transformers import BitsAndBytesConfig

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
)
`;
    }

    // Load model
    script += `
print("Loading model...")
model = AutoModelForCausalLM.from_pretrained(
    "${config.modelId}",
    ${config.trainingType === 'qlora' ? 'quantization_config=bnb_config,' : ''}
    device_map="auto",
    trust_remote_code=True,
)

tokenizer = AutoTokenizer.from_pretrained("${config.modelId}")
tokenizer.pad_token = tokenizer.eos_token

# Load dataset
print("Loading dataset...")
dataset = load_dataset("${config.datasetId || 'wikitext'}", "${config.datasetId ? '' : 'wikitext-2-raw-v1'}", split="train")

def tokenize_function(examples):
    return tokenizer(examples["text"], truncation=True, max_length=512)

tokenized_dataset = dataset.map(tokenize_function, batched=True, remove_columns=dataset.column_names)
`;

    // Add LoRA configuration
    if (config.trainingType === 'lora' || config.trainingType === 'qlora') {
      script += `
# Configure LoRA
print("Configuring LoRA...")
${config.trainingType === 'qlora' ? 'model = prepare_model_for_kbit_training(model)' : ''}

lora_config = LoraConfig(
    r=${config.loraRank || 16},
    lora_alpha=${config.loraAlpha || 32},
    lora_dropout=${config.loraDropout || 0.05},
    target_modules=${JSON.stringify(config.targetModules || ['q_proj', 'k_proj', 'v_proj', 'o_proj'])},
    bias="none",
    task_type="CAUSAL_LM",
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
`;
    }

    // Training arguments
    script += `
# Training arguments
training_args = TrainingArguments(
    output_dir="./output",
    num_train_epochs=${config.epochs},
    per_device_train_batch_size=${config.batchSize},
    gradient_accumulation_steps=4,
    learning_rate=${config.learningRate},
    warmup_steps=100,
    logging_steps=10,
    save_strategy="epoch",
    fp16=True,
    report_to="none",
    push_to_hub=${config.autoSaveToHub},
    hub_model_id="${config.outputRepoName}",
)

# Data collator
data_collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)

# Create trainer
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_dataset,
    data_collator=data_collator,
)

# Train
print("Starting training...")
trainer.train()

# Save model
print("Saving model...")
trainer.save_model()

${config.autoSaveToHub ? `
# Push to Hub
print("Pushing to HuggingFace Hub...")
trainer.push_to_hub()
` : ''}

print("Training completed!")
TRAINING_SCRIPT

echo "=== Training Complete ==="
`;

    return script;
  }
}

export default TrainingJob;
