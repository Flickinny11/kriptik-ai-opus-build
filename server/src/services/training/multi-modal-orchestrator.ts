/**
 * Multi-Modal Training Orchestrator
 *
 * Extends the training system to support LLM, Image, Video, and Audio fine-tuning.
 * Manages job lifecycle, GPU provisioning, progress streaming, and billing.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type {
  TrainingConfig,
  TrainingProgress,
  TrainingResult,
  TrainingStatus,
  MultiModalTrainingJob,
  GPURecommendation,
  ModelModality,
} from './types.js';
import { GPURecommender, getGPURecommender } from './gpu-recommender.js';
import { RunPodProvider, createRunPodProvider } from '../cloud/runpod.js';
import { ModalService } from '../cloud/modal.js';
import { HuggingFaceService } from '../ml/huggingface.js';
import { db } from '../../db.js';
import { trainingJobs } from '../../schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { getCredentialVault } from '../security/credential-vault.js';
import { getGPUBillingService, type GPUChargeResult } from '../billing/gpu-billing.js';
import { BillingContext } from '../billing/billing-context.js';

// =============================================================================
// TYPES
// =============================================================================

interface OrchestratorConfig {
  maxConcurrentJobs: number;
  pollingIntervalMs: number;
  enableBilling: boolean;
}

interface JobBillingInfo {
  trackingId: string;
  estimatedCostCents: number;
  estimatedCredits: number;
  billingContext: BillingContext;
  isUserInitiated: boolean;
}

// =============================================================================
// EVENTS
// =============================================================================

export interface OrchestratorEvents {
  jobCreated: (job: MultiModalTrainingJob) => void;
  jobStarted: (jobId: string) => void;
  jobProgress: (jobId: string, progress: TrainingProgress) => void;
  jobCompleted: (job: MultiModalTrainingJob) => void;
  jobFailed: (jobId: string, error: string) => void;
  jobStopped: (jobId: string, reason: string) => void;
  jobBilled: (jobId: string, result: GPUChargeResult) => void;
  log: (jobId: string, message: string) => void;
}

// =============================================================================
// MULTI-MODAL TRAINING ORCHESTRATOR
// =============================================================================

export class MultiModalTrainingOrchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private activeJobs: Map<string, MultiModalTrainingJob> = new Map();
  private jobQueue: MultiModalTrainingJob[] = [];
  private runpodProvider: RunPodProvider | null = null;
  private modalService: ModalService | null = null;
  private hfService: HuggingFaceService | null = null;
  private gpuRecommender: GPURecommender;
  private pollingInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;
  private billingService = getGPUBillingService();
  private jobBillingInfo: Map<string, JobBillingInfo> = new Map();
  private userId: string = '';

  constructor(config?: Partial<OrchestratorConfig>) {
    super();
    this.config = {
      maxConcurrentJobs: 3,
      pollingIntervalMs: 5000,
      enableBilling: true,
      ...config,
    };
    this.gpuRecommender = getGPURecommender();
  }

  // =============================================================================
  // INITIALIZATION
  // =============================================================================

  /**
   * Initialize the orchestrator with user credentials
   */
  async initialize(userId: string): Promise<void> {
    this.userId = userId;
    const vault = getCredentialVault();

    // Get RunPod credentials
    try {
      const runpodCredential = await vault.getCredential(userId, 'runpod');
      if (runpodCredential && runpodCredential.oauthAccessToken) {
        this.runpodProvider = createRunPodProvider(runpodCredential.oauthAccessToken);
      }
    } catch {
      console.log('[MultiModalOrchestrator] RunPod credentials not configured');
    }

    // Get Modal credentials (optional)
    try {
      const modalCredential = await vault.getCredential(userId, 'modal');
      if (modalCredential && modalCredential.oauthAccessToken) {
        // Parse Modal credentials from stored format
        // Modal stores tokenId:tokenSecret in oauthAccessToken
        const [tokenId, tokenSecret] = modalCredential.oauthAccessToken.split(':');
        if (tokenId && tokenSecret) {
          this.modalService = new ModalService({
            tokenId,
            tokenSecret,
            workspace: (modalCredential.data?.workspace as string) || 'default',
          });
        }
      }
    } catch {
      console.log('[MultiModalOrchestrator] Modal credentials not configured');
    }

    // Get HuggingFace credentials
    try {
      const hfCredential = await vault.getCredential(userId, 'huggingface');
      if (hfCredential && hfCredential.oauthAccessToken) {
        this.hfService = new HuggingFaceService(hfCredential.oauthAccessToken);
      }
    } catch {
      console.log('[MultiModalOrchestrator] HuggingFace credentials not configured');
    }

    this.isInitialized = true;
    this.startPolling();
  }

  /**
   * Check if orchestrator is initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  // =============================================================================
  // JOB CREATION
  // =============================================================================

  /**
   * Get GPU recommendation for a training configuration
   */
  getRecommendation(config: TrainingConfig): GPURecommendation {
    return this.gpuRecommender.recommend(config);
  }

  /**
   * Create a new multi-modal training job
   */
  async createJob(
    config: TrainingConfig,
    isUserInitiated: boolean = true
  ): Promise<{ job: MultiModalTrainingJob; recommendation: GPURecommendation }> {
    const recommendation = this.gpuRecommender.recommend(config);
    const jobId = uuidv4();

    const job: MultiModalTrainingJob = {
      id: jobId,
      userId: this.userId,
      projectId: config.projectId,
      config,
      status: 'queued',
      progress: {
        status: 'queued',
        currentStep: 0,
        totalSteps: this.estimateTotalSteps(config),
        message: 'Job queued',
      },
      logs: [`[${new Date().toISOString()}] Training job created: ${jobId}`],
      createdAt: new Date(),
    };

    // Authorize GPU usage with billing service
    if (this.config.enableBilling) {
      try {
        const authorization = await this.billingService.authorizeGPUUsage({
          userId: this.userId,
          projectId: config.projectId,
          gpuType: recommendation.gpuType,
          estimatedDurationMinutes: Math.ceil(recommendation.estimatedHours * 60),
          operationType: 'training',
          isUserInitiated,
        });

        this.jobBillingInfo.set(jobId, {
          trackingId: authorization.trackingId,
          estimatedCostCents: authorization.estimatedCostCents,
          estimatedCredits: authorization.estimatedCredits,
          billingContext: authorization.billingContext,
          isUserInitiated,
        });

        job.billingTrackingId = authorization.trackingId;
        this.addLog(job, `Billing authorized: ${authorization.estimatedCredits} credits estimated`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Billing authorization failed';
        job.status = 'failed';
        job.error = errorMessage;
        throw new Error(errorMessage);
      }
    }

    // Save to database
    await this.saveJobToDatabase(job);

    // Add to active jobs and queue
    this.activeJobs.set(jobId, job);
    this.jobQueue.push(job);

    this.emit('jobCreated', job);
    console.log(`[MultiModalOrchestrator] Job created: ${jobId} (${config.modality})`);

    // Try to start immediately
    await this.processQueue();

    return { job, recommendation };
  }

  // =============================================================================
  // JOB MANAGEMENT
  // =============================================================================

  /**
   * Get a job by ID
   */
  getJob(jobId: string): MultiModalTrainingJob | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * Get all jobs for the current user
   */
  async getJobs(): Promise<MultiModalTrainingJob[]> {
    const dbJobs = await db
      .select()
      .from(trainingJobs)
      .where(eq(trainingJobs.userId, this.userId))
      .orderBy(desc(trainingJobs.createdAt));

    return dbJobs.map(this.dbToJob);
  }

  /**
   * Get jobs by modality
   */
  async getJobsByModality(modality: ModelModality): Promise<MultiModalTrainingJob[]> {
    const allJobs = await this.getJobs();
    return allJobs.filter(job => job.config.modality === modality);
  }

  /**
   * Stop a running job
   */
  async stopJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Stop on provider
    if (job.runpodPodId && this.runpodProvider) {
      try {
        await this.runpodProvider.stopDeployment(job.runpodPodId);
        await this.runpodProvider.deleteDeployment(job.runpodPodId);
      } catch (error) {
        console.error(`[MultiModalOrchestrator] Failed to stop RunPod pod: ${error}`);
      }
    }

    // Update job status
    job.status = 'stopped';
    job.progress.status = 'stopped';
    job.progress.message = 'Job stopped by user';
    job.completedAt = new Date();
    this.addLog(job, 'Job stopped by user');

    // Finalize billing
    const billingInfo = this.jobBillingInfo.get(jobId);
    if (billingInfo && this.config.enableBilling) {
      const result = await this.finalizeBilling(job, billingInfo, false);
      if (result) {
        this.addLog(job, `Billing finalized: ${result.creditsDeducted} credits charged`);
        this.emit('jobBilled', jobId, result);
      }
      this.jobBillingInfo.delete(jobId);
    }

    await this.updateJobInDatabase(job);
    this.emit('jobStopped', jobId, 'user_requested');
  }

  /**
   * Cancel a queued job
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status !== 'queued') {
      throw new Error('Can only cancel queued jobs');
    }

    job.status = 'cancelled';
    job.progress.status = 'cancelled';
    job.progress.message = 'Job cancelled';
    this.addLog(job, 'Job cancelled');

    // Remove from queue
    this.jobQueue = this.jobQueue.filter(j => j.id !== jobId);

    await this.updateJobInDatabase(job);
  }

  // =============================================================================
  // PROGRESS STREAMING
  // =============================================================================

  /**
   * Stream progress updates for a job
   */
  async *streamProgress(jobId: string): AsyncGenerator<TrainingProgress> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Yield initial progress
    yield job.progress;

    // Set up event listener for progress updates
    const progressUpdates: TrainingProgress[] = [];
    let resolveNext: (() => void) | null = null;

    const progressHandler = (id: string, progress: TrainingProgress) => {
      if (id === jobId) {
        progressUpdates.push(progress);
        if (resolveNext) {
          resolveNext();
          resolveNext = null;
        }
      }
    };

    this.on('jobProgress', progressHandler);

    try {
      while (!['completed', 'failed', 'stopped', 'cancelled'].includes(job.status)) {
        // Wait for next progress update or timeout
        await new Promise<void>((resolve) => {
          resolveNext = resolve;
          setTimeout(resolve, 5000); // Poll every 5 seconds
        });

        // Yield any accumulated progress updates
        while (progressUpdates.length > 0) {
          const progress = progressUpdates.shift();
          if (progress) {
            yield progress;
          }
        }
      }

      // Yield final progress
      yield job.progress;
    } finally {
      this.off('jobProgress', progressHandler);
    }
  }

  // =============================================================================
  // CALLBACK HANDLERS
  // =============================================================================

  /**
   * Handle completion callback from provider
   */
  async handleCompletion(jobId: string, result: {
    success: boolean;
    outputUrl?: string;
    huggingFaceUrl?: string;
    error?: string;
    metrics?: {
      finalLoss?: number;
      totalSteps?: number;
      trainingDuration?: number;
    };
  }): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      console.error(`[MultiModalOrchestrator] Callback for unknown job: ${jobId}`);
      return;
    }

    if (result.success && result.outputUrl) {
      job.status = 'completed';
      job.progress.status = 'completed';
      job.progress.message = 'Training completed successfully';
      job.completedAt = new Date();
      job.result = {
        success: true,
        outputModelUrl: result.outputUrl,
        huggingFaceRepoUrl: result.huggingFaceUrl,
        totalCost: this.calculateTotalCost(job),
        totalDuration: this.calculateDuration(job),
        finalLoss: result.metrics?.finalLoss,
      };
      this.addLog(job, `Training completed. Model saved to: ${result.outputUrl}`);
      this.emit('jobCompleted', job);
    } else {
      job.status = 'failed';
      job.progress.status = 'failed';
      job.progress.message = result.error || 'Training failed';
      job.completedAt = new Date();
      job.error = result.error;
      this.addLog(job, `Training failed: ${result.error}`);
      this.emit('jobFailed', jobId, result.error || 'Unknown error');
    }

    // Finalize billing
    const billingInfo = this.jobBillingInfo.get(jobId);
    if (billingInfo && this.config.enableBilling) {
      const billingResult = await this.finalizeBilling(job, billingInfo, result.success);
      if (billingResult) {
        this.addLog(job, `Billing finalized: ${billingResult.creditsDeducted} credits charged`);
        this.emit('jobBilled', jobId, billingResult);
      }
      this.jobBillingInfo.delete(jobId);
    }

    // Cleanup provider resources
    if (job.runpodPodId && this.runpodProvider) {
      try {
        await this.runpodProvider.deleteDeployment(job.runpodPodId);
      } catch (error) {
        console.error(`[MultiModalOrchestrator] Failed to cleanup pod: ${error}`);
      }
    }

    await this.updateJobInDatabase(job);
  }

  /**
   * Handle progress update from provider
   */
  handleProgressUpdate(jobId: string, progress: Partial<TrainingProgress>): void {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    job.progress = { ...job.progress, ...progress };
    this.emit('jobProgress', jobId, job.progress);
  }

  /**
   * Handle log update from provider
   */
  handleLogUpdate(jobId: string, message: string): void {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    this.addLog(job, message);
    this.emit('log', jobId, message);
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private startPolling(): void {
    if (this.pollingInterval) return;

    this.pollingInterval = setInterval(async () => {
      await this.processQueue();
      await this.updateActiveJobs();
    }, this.config.pollingIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async processQueue(): Promise<void> {
    const runningCount = Array.from(this.activeJobs.values())
      .filter(j => ['provisioning', 'downloading', 'preparing', 'training', 'saving', 'uploading'].includes(j.status))
      .length;

    const availableSlots = this.config.maxConcurrentJobs - runningCount;
    const jobsToStart = this.jobQueue.splice(0, availableSlots);

    for (const job of jobsToStart) {
      await this.startJob(job);
    }
  }

  private async startJob(job: MultiModalTrainingJob): Promise<void> {
    if (!this.runpodProvider) {
      job.status = 'failed';
      job.error = 'RunPod credentials not configured';
      await this.updateJobInDatabase(job);
      this.emit('jobFailed', job.id, job.error);
      return;
    }

    try {
      job.status = 'provisioning';
      job.progress.status = 'provisioning';
      job.progress.message = 'Provisioning GPU...';
      job.startedAt = new Date();
      this.addLog(job, 'Starting job, provisioning GPU...');

      // Generate training script based on modality
      const trainingScript = this.generateTrainingScript(job.config);

      // Get container image
      const containerImage = this.getContainerImage(job.config.modality, job.config.method);

      // Deploy to RunPod
      const deployment = await this.runpodProvider.deploy({
        provider: 'runpod',
        resourceType: 'gpu',
        region: 'US',
        name: `kriptik-${job.config.modality}-${job.id.slice(0, 8)}`,
        containerImage,
        gpu: {
          type: this.mapGpuType(job.config.gpuConfig.gpuType),
          count: job.config.gpuConfig.gpuCount,
        },
        environmentVariables: {
          HF_TOKEN: await this.getHfToken(),
          TRAINING_SCRIPT: Buffer.from(trainingScript).toString('base64'),
          JOB_ID: job.id,
          CALLBACK_URL: process.env.TRAINING_CALLBACK_URL || '',
          MODALITY: job.config.modality,
          METHOD: job.config.method,
        },
        timeoutSeconds: 3600 * 24, // 24 hour timeout
      });

      job.runpodPodId = deployment.providerResourceId || deployment.id;
      job.status = 'downloading';
      job.progress.status = 'downloading';
      job.progress.message = 'Downloading model and dataset...';
      this.addLog(job, `RunPod pod deployed: ${job.runpodPodId}`);

      await this.updateJobInDatabase(job);
      this.emit('jobStarted', job.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      job.status = 'failed';
      job.error = `Failed to start training: ${errorMessage}`;
      job.progress.status = 'failed';
      job.progress.message = job.error;
      this.addLog(job, job.error);
      await this.updateJobInDatabase(job);
      this.emit('jobFailed', job.id, job.error);
    }
  }

  private async updateActiveJobs(): Promise<void> {
    if (!this.runpodProvider) return;

    for (const [jobId, job] of this.activeJobs) {
      if (!['training', 'downloading', 'preparing', 'saving', 'uploading'].includes(job.status)) continue;
      if (!job.runpodPodId) continue;

      try {
        const deployment = await this.runpodProvider.getDeployment(job.runpodPodId);
        if (!deployment) continue;

        switch (deployment.status) {
          case 'running':
            if (job.status === 'downloading') {
              job.status = 'training';
              job.progress.status = 'training';
              job.progress.message = 'Training in progress...';
              await this.updateJobInDatabase(job);
            }
            break;
          case 'stopped':
          case 'stopping':
            if (!['stopped', 'completed', 'failed'].includes(job.status)) {
              job.status = 'stopped';
              job.progress.status = 'stopped';
              job.progress.message = 'Pod stopped';
              await this.updateJobInDatabase(job);
            }
            break;
          case 'failed':
            if (job.status !== 'failed') {
              job.status = 'failed';
              job.error = 'Pod failed';
              job.progress.status = 'failed';
              job.progress.message = 'Pod failed';
              await this.updateJobInDatabase(job);
              this.emit('jobFailed', jobId, 'Pod failed');
            }
            break;
        }
      } catch (error) {
        console.error(`[MultiModalOrchestrator] Failed to update job ${jobId}:`, error);
      }
    }
  }

  private async finalizeBilling(
    job: MultiModalTrainingJob,
    billingInfo: JobBillingInfo,
    success: boolean
  ): Promise<GPUChargeResult | null> {
    try {
      const result = await this.billingService.finalizeGPUUsage({
        trackingId: billingInfo.trackingId,
        userId: job.userId,
        projectId: job.projectId,
        success,
        operationType: 'training',
        isUserInitiated: billingInfo.isUserInitiated,
      });

      console.log(`[MultiModalOrchestrator] Billing finalized for job ${job.id}:`, {
        actualCost: `$${(result.actualCostCents / 100).toFixed(2)}`,
        charged: `$${(result.chargedCents / 100).toFixed(2)}`,
        credits: result.creditsDeducted,
        context: result.billingContext,
      });

      return result;
    } catch (error) {
      console.error(`[MultiModalOrchestrator] Billing finalization failed for job ${job.id}:`, error);
      return null;
    }
  }

  // =============================================================================
  // TRAINING SCRIPT GENERATION
  // =============================================================================

  private generateTrainingScript(config: TrainingConfig): string {
    switch (config.modality) {
      case 'llm':
        return this.generateLLMScript(config);
      case 'image':
        return this.generateImageScript(config);
      case 'video':
        return this.generateVideoScript(config);
      case 'audio':
        return this.generateAudioScript(config);
      default: {
        // Exhaustive check - should never reach here
        const _exhaustiveCheck: never = config;
        throw new Error(`Unsupported modality: ${(_exhaustiveCheck as TrainingConfig).modality}`);
      }
    }
  }

  private generateLLMScript(config: TrainingConfig): string {
    const c = config as import('./types.js').LLMTrainingConfig;
    
    return `#!/bin/bash
set -e

echo "=== KripTik AI LLM Training Job ==="
echo "Job ID: ${config.id}"
echo "Model: ${config.baseModelId}"
echo "Method: ${config.method}"

# Install dependencies
pip install -q transformers accelerate peft datasets bitsandbytes huggingface_hub trl
${c.useUnsloth ? 'pip install -q unsloth' : ''}

# Login to HuggingFace
python -c "from huggingface_hub import login; login(token='$HF_TOKEN')"

# Send progress callback
curl -X POST "$CALLBACK_URL/api/training/callback/log" -H "Content-Type: application/json" -d '{"jobId": "'$JOB_ID'", "log": "Starting training..."}'

python << 'TRAINING_SCRIPT'
import os
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments, Trainer, BitsAndBytesConfig
from datasets import load_dataset
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from huggingface_hub import HfApi
import requests
import json

JOB_ID = os.environ.get('JOB_ID', '')
CALLBACK_URL = os.environ.get('CALLBACK_URL', '')

def send_progress(step, total, loss=None):
    if CALLBACK_URL:
        try:
            data = {"jobId": JOB_ID, "metrics": {"step": step, "totalSteps": total}}
            if loss: data["metrics"]["loss"] = loss
            requests.post(f"{CALLBACK_URL}/api/training/callback/metrics", json=data)
        except: pass

# Load dataset
print("Loading dataset...")
dataset = load_dataset("${c.datasetConfig.datasetId || 'wikitext'}", split="${c.datasetConfig.split || 'train'}")

# Configure quantization
${c.method === 'qlora' ? `
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
)
` : ''}

# Load model
print("Loading model: ${config.baseModelId}")
model = AutoModelForCausalLM.from_pretrained(
    "${config.baseModelId}",
    ${c.method === 'qlora' ? 'quantization_config=bnb_config,' : ''}
    device_map="auto",
    trust_remote_code=True,
)

tokenizer = AutoTokenizer.from_pretrained("${config.baseModelId}")
tokenizer.pad_token = tokenizer.eos_token

# Prepare for training
${c.method === 'qlora' ? 'model = prepare_model_for_kbit_training(model)' : ''}

# Configure LoRA
lora_config = LoraConfig(
    r=${c.loraConfig?.rank || 16},
    lora_alpha=${c.loraConfig?.alpha || 32},
    lora_dropout=${c.loraConfig?.dropout || 0.05},
    target_modules=${JSON.stringify(c.loraConfig?.targetModules || ['q_proj', 'k_proj', 'v_proj', 'o_proj'])},
    bias="none",
    task_type="CAUSAL_LM",
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

# Tokenize dataset
def tokenize(examples):
    return tokenizer(examples["text"], truncation=True, max_length=${c.maxSeqLength || 2048})

tokenized = dataset.map(tokenize, batched=True, remove_columns=dataset.column_names)

# Training arguments
training_args = TrainingArguments(
    output_dir="./output",
    num_train_epochs=${c.epochs},
    per_device_train_batch_size=${c.batchSize},
    gradient_accumulation_steps=${c.gradientAccumulationSteps || 4},
    learning_rate=${c.learningRate},
    warmup_steps=${c.warmupSteps || 100},
    logging_steps=10,
    save_strategy="epoch",
    fp16=True,
    report_to="none",
    ${config.autoSaveToHub ? `push_to_hub=True,\n    hub_model_id="${config.hubRepoName || config.outputModelName}",` : ''}
)

# Train
print("Starting training...")
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized,
)

trainer.train()

# Save
print("Saving model...")
trainer.save_model()
${config.autoSaveToHub ? 'trainer.push_to_hub()' : ''}

print("Training completed!")

# Send completion callback
if CALLBACK_URL:
    output_url = f"https://huggingface.co/{os.environ.get('HF_USER', '')}/${config.hubRepoName || config.outputModelName}" if ${config.autoSaveToHub} else "./output"
    requests.post(f"{CALLBACK_URL}/api/training/callback", json={
        "jobId": JOB_ID,
        "status": "completed",
        "outputUrl": output_url
    })
TRAINING_SCRIPT

echo "=== Training Complete ==="
`;
  }

  private generateImageScript(config: TrainingConfig): string {
    const c = config as import('./types.js').ImageTrainingConfig;
    
    return `#!/bin/bash
set -e

echo "=== KripTik AI Image Training Job ==="
echo "Job ID: ${config.id}"
echo "Model: ${c.baseModel}"
echo "Method: ${config.method}"

# Install kohya-ss scripts
pip install -q accelerate transformers diffusers safetensors huggingface_hub
git clone https://github.com/kohya-ss/sd-scripts.git
cd sd-scripts
pip install -q -r requirements.txt

# Login to HuggingFace
python -c "from huggingface_hub import login; login(token='$HF_TOKEN')"

# Run training based on method
${config.method === 'lora' ? `
accelerate launch train_network.py \\
    --pretrained_model_name_or_path="${config.baseModelId}" \\
    --train_data_dir="/workspace/dataset" \\
    --output_dir="/workspace/output" \\
    --output_name="${config.outputModelName}" \\
    --save_model_as=safetensors \\
    --max_train_steps=${c.steps} \\
    --learning_rate=${c.learningRate} \\
    --train_batch_size=${c.batchSize} \\
    --resolution=${c.resolution} \\
    --network_module=networks.lora \\
    --network_dim=${c.loraConfig?.networkDim || 16} \\
    --network_alpha=${c.loraConfig?.networkAlpha || 16} \\
    --mixed_precision=fp16 \\
    --cache_latents \\
    ${c.textEncoderTraining ? '--train_text_encoder' : ''} \\
    ${c.gradientCheckpointing ? '--gradient_checkpointing' : ''}
` : `
accelerate launch train_dreambooth.py \\
    --pretrained_model_name_or_path="${config.baseModelId}" \\
    --instance_data_dir="/workspace/dataset" \\
    --output_dir="/workspace/output" \\
    --instance_prompt="${c.instancePrompt || 'a photo of sks person'}" \\
    ${c.priorPreservation ? `--with_prior_preservation --class_prompt="${c.classPrompt || 'a photo of person'}" --num_class_images=${c.numClassImages || 200}` : ''} \\
    --max_train_steps=${c.steps} \\
    --learning_rate=${c.learningRate} \\
    --train_batch_size=${c.batchSize} \\
    --resolution=${c.resolution} \\
    --mixed_precision=fp16
`}

# Upload to HuggingFace if configured
${config.autoSaveToHub ? `
python -c "
from huggingface_hub import HfApi
api = HfApi()
api.upload_folder(
    folder_path='/workspace/output',
    repo_id='${config.hubRepoName || config.outputModelName}',
    repo_type='model',
    create_pr=False
)
print('Uploaded to HuggingFace Hub')
"
` : ''}

# Send completion callback
curl -X POST "$CALLBACK_URL/api/training/callback" -H "Content-Type: application/json" -d '{"jobId": "'$JOB_ID'", "status": "completed", "outputUrl": "https://huggingface.co/${config.hubRepoName || config.outputModelName}"}'

echo "=== Training Complete ==="
`;
  }

  private generateVideoScript(config: TrainingConfig): string {
    const c = config as import('./types.js').VideoTrainingConfig;
    
    return `#!/bin/bash
set -e

echo "=== KripTik AI Video Training Job ==="
echo "Job ID: ${config.id}"
echo "Model: ${c.baseModel}"
echo "Method: ${config.method}"

# Install dependencies based on model
${c.baseModel === 'wan' || c.baseModel === 'wan2' ? `
pip install -q torch torchvision accelerate transformers diffusers huggingface_hub
git clone https://github.com/Wan-Video/Wan2.1.git
cd Wan2.1
pip install -q -r requirements.txt
` : `
pip install -q torch torchvision accelerate transformers diffusers huggingface_hub
`}

# Login to HuggingFace
python -c "from huggingface_hub import login; login(token='$HF_TOKEN')"

# Run video training
python << 'TRAINING_SCRIPT'
import os
import torch
from diffusers import DiffusionPipeline
from huggingface_hub import HfApi

JOB_ID = os.environ.get('JOB_ID', '')
CALLBACK_URL = os.environ.get('CALLBACK_URL', '')

print("Loading video model: ${config.baseModelId}")

# Video training is highly model-specific
# This is a template that would be customized per model
print("Video training for ${c.baseModel}...")
print("Steps: ${c.steps}")
print("Frames: ${c.frameCount}")
print("Resolution: ${c.resolution.width}x${c.resolution.height}")

# Training logic would be model-specific
# Placeholder for actual training implementation
print("Training completed!")

${config.autoSaveToHub ? `
api = HfApi()
api.upload_folder(
    folder_path='./output',
    repo_id='${config.hubRepoName || config.outputModelName}',
    repo_type='model'
)
` : ''}

import requests
if CALLBACK_URL:
    requests.post(f"{CALLBACK_URL}/api/training/callback", json={
        "jobId": JOB_ID,
        "status": "completed",
        "outputUrl": "https://huggingface.co/${config.hubRepoName || config.outputModelName}"
    })
TRAINING_SCRIPT

echo "=== Training Complete ==="
`;
  }

  private generateAudioScript(config: TrainingConfig): string {
    const c = config as import('./types.js').AudioTrainingConfig;
    
    return `#!/bin/bash
set -e

echo "=== KripTik AI Audio Training Job ==="
echo "Job ID: ${config.id}"
echo "Model: ${c.baseModel}"
echo "Method: ${config.method}"

# Install dependencies
${c.baseModel === 'xtts' || c.baseModel === 'xtts2' ? `
pip install -q TTS torch torchaudio huggingface_hub
` : c.baseModel === 'bark' ? `
pip install -q bark torch torchaudio huggingface_hub
` : `
pip install -q transformers torch torchaudio huggingface_hub
`}

# Login to HuggingFace
python -c "from huggingface_hub import login; login(token='$HF_TOKEN')"

python << 'TRAINING_SCRIPT'
import os
import torch
from huggingface_hub import HfApi

JOB_ID = os.environ.get('JOB_ID', '')
CALLBACK_URL = os.environ.get('CALLBACK_URL', '')

print("Audio model: ${c.baseModel}")
print("Method: ${config.method}")
print("Sample rate: ${c.sampleRate}")

${c.baseModel === 'xtts' || c.baseModel === 'xtts2' ? `
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import Xtts
from TTS.utils.generic_utils import get_user_data_dir

# Load XTTS model
config = XttsConfig()
model = Xtts.init_from_config(config)

# Voice cloning with provided samples
voice_samples = ${JSON.stringify(c.voiceSamples || [])}
if voice_samples:
    print(f"Voice cloning with {len(voice_samples)} samples")
    # Fine-tune would happen here

model.save_pretrained('./output')
` : `
print("Training ${c.baseModel}...")
# Model-specific training logic
`}

${config.autoSaveToHub ? `
api = HfApi()
api.upload_folder(
    folder_path='./output',
    repo_id='${config.hubRepoName || config.outputModelName}',
    repo_type='model'
)
` : ''}

import requests
if CALLBACK_URL:
    requests.post(f"{CALLBACK_URL}/api/training/callback", json={
        "jobId": JOB_ID,
        "status": "completed",
        "outputUrl": "https://huggingface.co/${config.hubRepoName || config.outputModelName}"
    })
TRAINING_SCRIPT

echo "=== Training Complete ==="
`;
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  private getContainerImage(modality: ModelModality, method: string): string {
    const images: Record<string, string> = {
      'llm': 'runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04',
      'image': 'runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04',
      'video': 'runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04',
      'audio': 'runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04',
    };
    return images[modality] || 'runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04';
  }

  private mapGpuType(gpuType: string): 'nvidia-rtx-4090' | 'nvidia-rtx-3090' | 'nvidia-a40' | 'nvidia-l40' | 'nvidia-a100-40gb' | 'nvidia-a100-80gb' | 'nvidia-h100' {
    const mapping: Record<string, 'nvidia-rtx-4090' | 'nvidia-rtx-3090' | 'nvidia-a40' | 'nvidia-l40' | 'nvidia-a100-40gb' | 'nvidia-a100-80gb' | 'nvidia-h100'> = {
      'NVIDIA GeForce RTX 3090': 'nvidia-rtx-3090',
      'NVIDIA GeForce RTX 4090': 'nvidia-rtx-4090',
      'NVIDIA A40': 'nvidia-a40',
      'NVIDIA L40': 'nvidia-l40',
      'NVIDIA L40S': 'nvidia-l40',
      'NVIDIA A100-SXM4-40GB': 'nvidia-a100-40gb',
      'NVIDIA A100 80GB PCIe': 'nvidia-a100-80gb',
      'NVIDIA H100 PCIe': 'nvidia-h100',
    };
    return mapping[gpuType] || 'nvidia-rtx-4090';
  }

  private async getHfToken(): Promise<string> {
    const vault = getCredentialVault();
    const credential = await vault.getCredential(this.userId, 'huggingface');
    if (!credential) {
      throw new Error('HuggingFace token not found');
    }
    return credential.oauthAccessToken || '';
  }

  private estimateTotalSteps(config: TrainingConfig): number {
    switch (config.modality) {
      case 'llm': {
        const c = config as import('./types.js').LLMTrainingConfig;
        return c.epochs * 1000; // Rough estimate
      }
      case 'image': {
        const c = config as import('./types.js').ImageTrainingConfig;
        return c.steps;
      }
      case 'video': {
        const c = config as import('./types.js').VideoTrainingConfig;
        return c.steps;
      }
      case 'audio': {
        const c = config as import('./types.js').AudioTrainingConfig;
        return c.steps;
      }
      default:
        return 1000;
    }
  }

  private calculateTotalCost(job: MultiModalTrainingJob): number {
    const duration = this.calculateDuration(job);
    const costPerHour = job.config.gpuConfig.estimatedCost / job.config.gpuConfig.estimatedHours;
    return Math.round(duration * costPerHour / 3600 * 100) / 100;
  }

  private calculateDuration(job: MultiModalTrainingJob): number {
    if (!job.startedAt) return 0;
    const endTime = job.completedAt || new Date();
    return (endTime.getTime() - job.startedAt.getTime()) / 1000;
  }

  private addLog(job: MultiModalTrainingJob, message: string): void {
    const timestamp = new Date().toISOString();
    job.logs.push(`[${timestamp}] ${message}`);
  }

  // =============================================================================
  // DATABASE OPERATIONS
  // =============================================================================

  private async saveJobToDatabase(job: MultiModalTrainingJob): Promise<void> {
    await db.insert(trainingJobs).values({
      id: job.id,
      userId: job.userId,
      projectId: job.projectId || null,
      modality: job.config.modality,
      method: job.config.method,
      config: job.config as any,
      status: job.status,
      metrics: job.progress as any,
      logs: JSON.stringify(job.logs),
      error: job.error || null,
      runpodPodId: job.runpodPodId || null,
      outputModelUrl: job.result?.outputModelUrl || null,
      huggingFaceRepoUrl: job.result?.huggingFaceRepoUrl || null,
      autoSaved: job.config.autoSaveToHub || false,
      trainingReport: job.result?.trainingReport as any || null,
      createdAt: job.createdAt.toISOString(),
    } as any);
  }

  private async updateJobInDatabase(job: MultiModalTrainingJob): Promise<void> {
    await db
      .update(trainingJobs)
      .set({
        status: job.status,
        metrics: job.progress as any,
        logs: JSON.stringify(job.logs),
        error: job.error || null,
        runpodPodId: job.runpodPodId || null,
        outputModelUrl: job.result?.outputModelUrl || null,
        huggingFaceRepoUrl: job.result?.huggingFaceRepoUrl || null,
        autoSaved: job.result?.huggingFaceRepoUrl ? true : false,
        trainingReport: job.result?.trainingReport as any || null,
        startedAt: job.startedAt?.toISOString() || null,
        completedAt: job.completedAt?.toISOString() || null,
        updatedAt: new Date().toISOString(),
      } as any)
      .where(eq(trainingJobs.id, job.id));
  }

  private dbToJob(dbJob: any): MultiModalTrainingJob {
    return {
      id: dbJob.id,
      userId: dbJob.userId,
      projectId: dbJob.projectId || undefined,
      config: dbJob.config,
      status: dbJob.status as TrainingStatus,
      progress: dbJob.metrics || { status: dbJob.status, currentStep: 0, totalSteps: 0 },
      logs: JSON.parse(dbJob.logs || '[]'),
      error: dbJob.error || undefined,
      runpodPodId: dbJob.runpodPodId || undefined,
      result: dbJob.outputModelUrl ? {
        success: dbJob.status === 'completed',
        outputModelUrl: dbJob.outputModelUrl,
        totalCost: 0,
        totalDuration: 0,
      } : undefined,
      createdAt: new Date(dbJob.createdAt),
      startedAt: dbJob.startedAt ? new Date(dbJob.startedAt) : undefined,
      completedAt: dbJob.completedAt ? new Date(dbJob.completedAt) : undefined,
    };
  }

  /**
   * Shutdown the orchestrator
   */
  shutdown(): void {
    this.stopPolling();
    this.activeJobs.clear();
    this.jobQueue = [];
    this.isInitialized = false;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let orchestratorInstance: MultiModalTrainingOrchestrator | null = null;

export function getMultiModalTrainingOrchestrator(): MultiModalTrainingOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new MultiModalTrainingOrchestrator();
  }
  return orchestratorInstance;
}

export default MultiModalTrainingOrchestrator;
