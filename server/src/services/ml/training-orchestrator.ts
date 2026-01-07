/**
 * Training Orchestrator - Multi-Job Training Management
 *
 * Manages training jobs on RunPod, including provisioning, monitoring, and cleanup.
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 4).
 *
 * Integrated with GPU Billing Service for:
 * - Pre-authorization before job starts
 * - Real-time cost tracking during training
 * - Final billing when job completes
 */

import { EventEmitter } from 'events';
import { TrainingJob, TrainingJobConfig, TrainingJobState, TrainingJobStatus, TrainingMetrics } from './training-job.js';
import { RunPodProvider, createRunPodProvider } from '../cloud/runpod.js';
import { HuggingFaceService } from './huggingface.js';
import { db } from '../../db.js';
import { trainingJobs } from '../../schema.js';
import { eq, desc } from 'drizzle-orm';
import { getCredentialVault } from '../security/credential-vault.js';
import { getGPUBillingService, type GPUChargeResult } from '../billing/gpu-billing.js';
import { BillingContext } from '../billing/billing-context.js';

// =============================================================================
// TYPES
// =============================================================================

interface TrainingOrchestratorConfig {
  maxConcurrentJobs: number;
  defaultGpuType: string;
  pollingIntervalMs: number;
  enableBilling: boolean; // Enable/disable billing integration
}

// Billing tracking for each job
interface JobBillingInfo {
  trackingId: string;
  estimatedCostCents: number;
  estimatedCredits: number;
  billingContext: BillingContext;
  isUserInitiated: boolean;
}

const DEFAULT_CONFIG: TrainingOrchestratorConfig = {
  maxConcurrentJobs: 3,
  defaultGpuType: 'NVIDIA GeForce RTX 4090',
  pollingIntervalMs: 5000,
  enableBilling: true,
};

// GPU pricing from RunPod
const GPU_PRICING: Record<string, { hourlyCost: number; vramGB: number }> = {
  'NVIDIA GeForce RTX 3090': { hourlyCost: 0.44, vramGB: 24 },
  'NVIDIA GeForce RTX 4090': { hourlyCost: 0.69, vramGB: 24 },
  'NVIDIA A40': { hourlyCost: 0.79, vramGB: 48 },
  'NVIDIA L40': { hourlyCost: 0.99, vramGB: 48 },
  'NVIDIA A100-SXM4-40GB': { hourlyCost: 1.89, vramGB: 40 },
  'NVIDIA A100 80GB PCIe': { hourlyCost: 2.49, vramGB: 80 },
  'NVIDIA H100 PCIe': { hourlyCost: 3.99, vramGB: 80 },
};

// =============================================================================
// TRAINING ORCHESTRATOR
// =============================================================================

export class TrainingOrchestrator extends EventEmitter {
  private config: TrainingOrchestratorConfig;
  private activeJobs: Map<string, TrainingJob> = new Map();
  private jobQueue: TrainingJob[] = [];
  private runpodProvider: RunPodProvider | null = null;
  private hfService: HuggingFaceService | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;
  private billingService = getGPUBillingService();
  private jobBillingInfo: Map<string, JobBillingInfo> = new Map();

  constructor(config: Partial<TrainingOrchestratorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the orchestrator with user credentials
   */
  async initialize(userId: string): Promise<void> {
    const vault = getCredentialVault();

    // Get RunPod credentials
    const runpodCredential = await vault.getCredential(userId, 'runpod');
    if (runpodCredential && runpodCredential.oauthAccessToken) {
      this.runpodProvider = createRunPodProvider(runpodCredential.oauthAccessToken);
    }

    // Get HuggingFace credentials
    const hfCredential = await vault.getCredential(userId, 'huggingface');
    if (hfCredential && hfCredential.oauthAccessToken) {
      this.hfService = new HuggingFaceService(hfCredential.oauthAccessToken);
    }

    this.isInitialized = true;
    this.startPolling();
  }

  /**
   * Start the job polling loop
   */
  private startPolling(): void {
    if (this.pollingInterval) return;

    this.pollingInterval = setInterval(() => {
      this.processQueue();
      this.updateActiveJobs();
    }, this.config.pollingIntervalMs);
  }

  /**
   * Stop the polling loop
   */
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Create a new training job
   *
   * @param userId - The user ID
   * @param config - Training job configuration
   * @param projectId - Optional project ID
   * @param isUserInitiated - Whether this is a user-initiated training (default: true)
   *                          If false, KripTik absorbs the cost (e.g., for build verification)
   */
  async createJob(
    userId: string,
    config: TrainingJobConfig,
    projectId?: string,
    isUserInitiated: boolean = true
  ): Promise<TrainingJob> {
    const job = new TrainingJob(userId, config, projectId);

    // Set GPU cost tracking
    const gpuInfo = GPU_PRICING[config.gpuType] || GPU_PRICING[this.config.defaultGpuType];
    job.setCostPerHour(gpuInfo.hourlyCost);

    // Estimate duration for billing
    const estimatedDurationMinutes = this.estimateJobDuration(config);

    // Authorize GPU usage with billing service (will throw if insufficient credits)
    if (this.config.enableBilling) {
      try {
        const authorization = await this.billingService.authorizeGPUUsage({
          userId,
          projectId,
          gpuType: config.gpuType,
          estimatedDurationMinutes,
          operationType: 'training',
          isUserInitiated,
        });

        // Store billing info for this job
        this.jobBillingInfo.set(job.id, {
          trackingId: authorization.trackingId,
          estimatedCostCents: authorization.estimatedCostCents,
          estimatedCredits: authorization.estimatedCredits,
          billingContext: authorization.billingContext,
          isUserInitiated,
        });

        job.addLog(`Billing authorized: ${authorization.estimatedCredits} credits estimated (context: ${authorization.billingContext})`);
        console.log(`[TrainingOrchestrator] Billing authorized for job ${job.id}: ${authorization.estimatedCredits} credits`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Billing authorization failed';
        job.fail(errorMessage);
        throw new Error(errorMessage);
      }
    }

    // Set up event listeners
    this.setupJobEventListeners(job);

    // Save to database
    await this.saveJobToDatabase(job);

    // Add to queue
    this.jobQueue.push(job);
    this.activeJobs.set(job.id, job);

    this.emit('jobCreated', job);
    console.log(`[TrainingOrchestrator] Job created: ${job.id}`);

    // Try to start immediately if within limits
    await this.processQueue();

    return job;
  }

  /**
   * Estimate job duration in minutes based on configuration
   */
  private estimateJobDuration(config: TrainingJobConfig): number {
    // Base time varies by training type
    let baseMinutes: number;
    switch (config.trainingType) {
      case 'lora':
        baseMinutes = 30;
        break;
      case 'qlora':
        baseMinutes = 45;
        break;
      case 'full':
        baseMinutes = 120;
        break;
      default:
        baseMinutes = 60;
    }

    // Adjust for epochs
    baseMinutes *= Math.max(1, config.epochs || 1);

    // Adjust for batch size (smaller batch = longer time)
    const batchFactor = 8 / Math.max(1, config.batchSize || 4);
    baseMinutes *= Math.sqrt(batchFactor);

    // Add buffer for setup/download/save
    baseMinutes += 15;

    return Math.ceil(baseMinutes);
  }

  /**
   * Get a job by ID
   */
  getJob(jobId: string): TrainingJob | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * Get all jobs for a user
   */
  async getJobsForUser(userId: string): Promise<TrainingJobState[]> {
    const dbJobs = await db
      .select()
      .from(trainingJobs)
      .where(eq(trainingJobs.userId, userId))
      .orderBy(desc(trainingJobs.createdAt));

    return dbJobs.map(this.dbJobToState);
  }

  /**
   * Stop a running job
   */
  async stopJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Stop on RunPod if running
    if (job.runpodPodId && this.runpodProvider) {
      try {
        await this.runpodProvider.stopDeployment(job.runpodPodId);
        await this.runpodProvider.deleteDeployment(job.runpodPodId);
      } catch (error) {
        console.error(`[TrainingOrchestrator] Failed to stop RunPod pod: ${error}`);
      }
    }

    job.stop('user_requested');

    // Finalize billing for stopped job (user still pays for time used)
    const billingInfo = this.jobBillingInfo.get(jobId);
    if (billingInfo && this.config.enableBilling) {
      const billingResult = await this.finalizeBilling(job, billingInfo, false);
      if (billingResult) {
        job.addLog(`Billing finalized (stopped early): ${billingResult.creditsDeducted} credits charged`);
        this.emit('jobBilled', job.id, billingResult);
      }
      this.jobBillingInfo.delete(jobId);
    }

    await this.updateJobInDatabase(job);
  }

  /**
   * Cancel a queued job
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status === 'queued') {
      job.cancel();
      this.jobQueue = this.jobQueue.filter(j => j.id !== jobId);
      await this.updateJobInDatabase(job);
    } else {
      throw new Error('Can only cancel queued jobs');
    }
  }

  /**
   * Process the job queue
   */
  private async processQueue(): Promise<void> {
    const runningCount = Array.from(this.activeJobs.values())
      .filter(j => ['provisioning', 'downloading', 'training', 'saving'].includes(j.status))
      .length;

    const availableSlots = this.config.maxConcurrentJobs - runningCount;
    const jobsToStart = this.jobQueue.splice(0, availableSlots);

    for (const job of jobsToStart) {
      await this.startJob(job);
    }
  }

  /**
   * Start a training job on RunPod
   */
  private async startJob(job: TrainingJob): Promise<void> {
    if (!this.runpodProvider) {
      job.fail('RunPod credentials not configured');
      await this.updateJobInDatabase(job);
      return;
    }

    if (!this.hfService) {
      job.fail('HuggingFace credentials not configured');
      await this.updateJobInDatabase(job);
      return;
    }

    try {
      await job.start();

      // Generate training script
      const trainingScript = job.generateTrainingScript();

      // Deploy training pod to RunPod
      const deployment = await this.runpodProvider.deploy({
        provider: 'runpod',
        resourceType: 'gpu',
        region: 'US',
        name: `kriptik-training-${job.id.slice(0, 8)}`,
        containerImage: 'runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04',
        gpu: {
          type: this.mapGpuType(job.config.gpuType),
          count: job.config.gpuCount || 1,
        },
        environmentVariables: {
          HF_TOKEN: await this.getHfToken(job.userId),
          TRAINING_SCRIPT: Buffer.from(trainingScript).toString('base64'),
          JOB_ID: job.id,
          CALLBACK_URL: process.env.TRAINING_CALLBACK_URL || '',
        },
        timeoutSeconds: 3600 * 24, // 24 hour timeout
      });

      job.setRunpodPodId(deployment.providerResourceId || deployment.id);
      job.setStatus('downloading');
      job.addLog(`RunPod pod deployed: ${deployment.providerResourceId || deployment.id}`);

      await this.updateJobInDatabase(job);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      job.fail(`Failed to start training: ${errorMessage}`);
      await this.updateJobInDatabase(job);
    }
  }

  /**
   * Update metrics for active jobs
   */
  private async updateActiveJobs(): Promise<void> {
    if (!this.runpodProvider) return;

    for (const [jobId, job] of this.activeJobs) {
      if (!['training', 'downloading', 'saving'].includes(job.status)) continue;
      if (!job.runpodPodId) continue;

      try {
        const deployment = await this.runpodProvider.getDeployment(job.runpodPodId);
        if (!deployment) continue;

        switch (deployment.status) {
          case 'running':
            if (job.status !== 'training') {
              job.setStatus('training');
            }
            break;
          case 'stopped':
          case 'stopping':
            job.stop('pod_stopped');
            break;
          case 'failed':
            job.fail('Pod failed');
            break;
        }

        await this.updateJobInDatabase(job);
      } catch (error) {
        console.error(`[TrainingOrchestrator] Failed to update job ${jobId}:`, error);
      }
    }
  }

  /**
   * Handle training completion callback from RunPod
   */
  async handleCallback(jobId: string, data: {
    status: 'completed' | 'failed';
    outputUrl?: string;
    error?: string;
    metrics?: Partial<TrainingMetrics>;
  }): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      console.error(`[TrainingOrchestrator] Callback for unknown job: ${jobId}`);
      return;
    }

    if (data.metrics) {
      job.updateMetrics(data.metrics);
    }

    if (data.status === 'completed' && data.outputUrl) {
      job.complete(data.outputUrl);
    } else if (data.status === 'failed') {
      job.fail(data.error || 'Unknown error');
    }

    // Finalize billing
    const billingInfo = this.jobBillingInfo.get(jobId);
    if (billingInfo && this.config.enableBilling) {
      const billingResult = await this.finalizeBilling(job, billingInfo, data.status === 'completed');
      if (billingResult) {
        job.addLog(`Billing finalized: ${billingResult.creditsDeducted} credits charged`);
        this.emit('jobBilled', job.id, billingResult);
      }
    }

    // Cleanup RunPod resources
    if (job.runpodPodId && this.runpodProvider) {
      try {
        await this.runpodProvider.deleteDeployment(job.runpodPodId);
      } catch (error) {
        console.error(`[TrainingOrchestrator] Failed to cleanup pod: ${error}`);
      }
    }

    await this.updateJobInDatabase(job);
    this.emit('jobCompleted', job);

    // Clean up billing info
    this.jobBillingInfo.delete(jobId);
  }

  /**
   * Finalize billing for a completed/failed job
   */
  private async finalizeBilling(
    job: TrainingJob,
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

      console.log(`[TrainingOrchestrator] Billing finalized for job ${job.id}:`, {
        actualCost: `$${(result.actualCostCents / 100).toFixed(2)}`,
        charged: `$${(result.chargedCents / 100).toFixed(2)}`,
        credits: result.creditsDeducted,
        context: result.billingContext,
      });

      return result;
    } catch (error) {
      console.error(`[TrainingOrchestrator] Billing finalization failed for job ${job.id}:`, error);
      return null;
    }
  }

  /**
   * Handle real-time metrics update
   */
  handleMetricsUpdate(jobId: string, metrics: Partial<TrainingMetrics>): void {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    job.updateMetrics(metrics);
    this.emit('jobMetrics', job.id, job.metrics);
  }

  /**
   * Handle log update
   */
  handleLogUpdate(jobId: string, log: string): void {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    job.addLog(log);
    this.emit('jobLog', job.id, log);
  }

  /**
   * Get real-time billing cost for an active job
   */
  getJobBillingCost(jobId: string): {
    actualCostCents: number;
    chargedCents: number;
    estimatedCredits: number;
    billingContext: BillingContext;
  } | null {
    const billingInfo = this.jobBillingInfo.get(jobId);
    if (!billingInfo) return null;

    const activeCost = this.billingService.getActiveJobCost(billingInfo.trackingId);
    return {
      ...activeCost,
      billingContext: billingInfo.billingContext,
    };
  }

  /**
   * Check if billing is enabled
   */
  isBillingEnabled(): boolean {
    return this.config.enableBilling;
  }

  // =============================================================================
  // DATABASE OPERATIONS
  // =============================================================================

  private async saveJobToDatabase(job: TrainingJob): Promise<void> {
    await db.insert(trainingJobs).values({
      id: job.id,
      userId: job.userId,
      projectId: job.projectId || null,
      config: job.config as any,
      status: job.status,
      metrics: null,
      logs: JSON.stringify(job.logs),
      runpodPodId: job.runpodPodId || null,
      outputModelUrl: job.outputModelUrl || null,
      createdAt: job.createdAt.toISOString(),
    } as any);
  }

  private async updateJobInDatabase(job: TrainingJob): Promise<void> {
    await db
      .update(trainingJobs)
      .set({
        status: job.status,
        metrics: job.metrics as any,
        logs: JSON.stringify(job.logs),
        runpodPodId: job.runpodPodId || null,
        outputModelUrl: job.outputModelUrl || null,
        error: job.error || null,
        updatedAt: new Date().toISOString(),
      } as any)
      .where(eq(trainingJobs.id, job.id));
  }

  private dbJobToState(dbJob: any): TrainingJobState {
    return {
      id: dbJob.id,
      userId: dbJob.userId,
      projectId: dbJob.projectId || undefined,
      config: dbJob.config,
      status: dbJob.status as TrainingJobStatus,
      metrics: dbJob.metrics,
      logs: JSON.parse(dbJob.logs || '[]'),
      error: dbJob.error || undefined,
      runpodPodId: dbJob.runpodPodId || undefined,
      outputModelUrl: dbJob.outputModelUrl || undefined,
      createdAt: new Date(dbJob.createdAt),
      startedAt: dbJob.startedAt ? new Date(dbJob.startedAt) : undefined,
      completedAt: dbJob.completedAt ? new Date(dbJob.completedAt) : undefined,
    };
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  private setupJobEventListeners(job: TrainingJob): void {
    job.on('status', (status, previousStatus) => {
      this.emit('jobStatus', job.id, status, previousStatus);
    });

    job.on('metrics', (metrics) => {
      this.emit('jobMetrics', job.id, metrics);
    });

    job.on('log', (log) => {
      this.emit('jobLog', job.id, log);
    });

    job.on('completed', () => {
      this.emit('jobCompleted', job);
    });

    job.on('failed', (error) => {
      this.emit('jobFailed', job, error);
    });
  }

  private mapGpuType(gpuType: string): 'nvidia-rtx-4090' | 'nvidia-rtx-3090' | 'nvidia-a40' | 'nvidia-l40' | 'nvidia-a100-40gb' | 'nvidia-a100-80gb' | 'nvidia-h100' {
    // Map friendly names to RunPod GPU IDs
    const mapping: Record<string, 'nvidia-rtx-4090' | 'nvidia-rtx-3090' | 'nvidia-a40' | 'nvidia-l40' | 'nvidia-a100-40gb' | 'nvidia-a100-80gb' | 'nvidia-h100'> = {
      'RTX 3090': 'nvidia-rtx-3090',
      'RTX 4090': 'nvidia-rtx-4090',
      'NVIDIA GeForce RTX 3090': 'nvidia-rtx-3090',
      'NVIDIA GeForce RTX 4090': 'nvidia-rtx-4090',
      'A40': 'nvidia-a40',
      'NVIDIA A40': 'nvidia-a40',
      'L40': 'nvidia-l40',
      'NVIDIA L40': 'nvidia-l40',
      'A100 40GB': 'nvidia-a100-40gb',
      'NVIDIA A100-SXM4-40GB': 'nvidia-a100-40gb',
      'A100 80GB': 'nvidia-a100-80gb',
      'NVIDIA A100 80GB PCIe': 'nvidia-a100-80gb',
      'H100': 'nvidia-h100',
      'NVIDIA H100 PCIe': 'nvidia-h100',
    };
    return mapping[gpuType] || 'nvidia-rtx-4090';
  }

  private async getHfToken(userId: string): Promise<string> {
    const vault = getCredentialVault();
    const credential = await vault.getCredential(userId, 'huggingface');
    if (!credential) {
      throw new Error('HuggingFace token not found');
    }
    return credential.oauthAccessToken || '';
  }

  /**
   * Cleanup and shutdown
   */
  shutdown(): void {
    this.stopPolling();
    this.activeJobs.clear();
    this.jobQueue = [];
    this.isInitialized = false;
  }
}

// Singleton instance
let orchestratorInstance: TrainingOrchestrator | null = null;

/**
 * Get or create the training orchestrator instance
 */
export function getTrainingOrchestrator(): TrainingOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new TrainingOrchestrator();
  }
  return orchestratorInstance;
}

export default TrainingOrchestrator;
