/**
 * Training Completion Handler
 *
 * Orchestrates post-training workflow:
 * - Auto-saves to HuggingFace
 * - Model preservation
 * - Notification dispatch
 * - Metrics aggregation
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import { EventEmitter } from 'events';
import { db } from '../../db.js';
import { eq, sql } from 'drizzle-orm';
import { trainingJobs, users } from '../../schema.js';
import { HuggingFaceUploadService, getHuggingFaceUploadService } from './huggingface-upload.js';
import { ModelPreservationService, getModelPreservationService } from './model-preservation.js';
import { CredentialVault } from '../security/credential-vault.js';
import type { TrainingConfig, TrainingReport, MultiModalTrainingJob } from './types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CompletionConfig {
  autoUploadToHuggingFace: boolean;
  preserveCheckpoints: boolean;
  notifyOnCompletion: boolean;
  generateReport: boolean;
  cleanupAfterUpload: boolean;
}

export interface CompletionResult {
  success: boolean;
  jobId: string;
  huggingFaceUrl?: string;
  preservationResult?: {
    modelPath: string;
    version: string;
  };
  reportGenerated: boolean;
  error?: string;
}

export interface CompletionEvent {
  type: 'upload_started' | 'upload_complete' | 'preservation_complete' | 'report_generated' | 'error';
  jobId: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_COMPLETION_CONFIG: CompletionConfig = {
  autoUploadToHuggingFace: true,
  preserveCheckpoints: true,
  notifyOnCompletion: true,
  generateReport: true,
  cleanupAfterUpload: false,
};

// =============================================================================
// TRAINING COMPLETION HANDLER
// =============================================================================

export class TrainingCompletionHandler extends EventEmitter {
  private credentialVault: CredentialVault;
  private preservationService: ModelPreservationService;
  private pendingCompletions: Map<string, CompletionConfig> = new Map();

  constructor() {
    super();
    this.credentialVault = new CredentialVault();
    this.preservationService = getModelPreservationService();
  }

  /**
   * Handle training job completion
   */
  async handleCompletion(
    job: MultiModalTrainingJob,
    trainingReport: TrainingReport,
    config?: Partial<CompletionConfig>
  ): Promise<CompletionResult> {
    const completionConfig = { ...DEFAULT_COMPLETION_CONFIG, ...config };
    const result: CompletionResult = {
      success: false,
      jobId: job.id,
      reportGenerated: false,
    };

    try {
      this.pendingCompletions.set(job.id, completionConfig);

      // 1. Update job status
      await this.updateJobStatus(job.id, 'completed', trainingReport);

      // 2. Auto-upload to HuggingFace if enabled
      if (completionConfig.autoUploadToHuggingFace && job.config.hubPrivate !== undefined) {
        const uploadResult = await this.uploadToHuggingFace(job, trainingReport);
        if (uploadResult.success) {
          result.huggingFaceUrl = uploadResult.url;
          await this.updateJobHuggingFaceUrl(job.id, uploadResult.url || '');
          this.emitEvent('upload_complete', job.id, { url: uploadResult.url });
        } else {
          console.warn(`[CompletionHandler] HuggingFace upload failed: ${uploadResult.error}`);
        }
      }

      // 3. Preserve model
      if (completionConfig.preserveCheckpoints) {
        const modelPath = trainingReport.modelLocation?.localPath || `models/${job.id}`;
        const preserveResult = await this.preservationService.preserveModel(
          job.id,
          job.userId,
          modelPath,
          {
            keepCheckpoints: true,
            maxCheckpoints: 3,
          }
        );
        
        if (preserveResult.success) {
          result.preservationResult = {
            modelPath: preserveResult.paths.model,
            version: preserveResult.version,
          };
          this.emitEvent('preservation_complete', job.id, { ...preserveResult } as Record<string, unknown>);
        }
      }

      // 4. Generate final report
      if (completionConfig.generateReport) {
        await this.generateFinalReport(job, trainingReport);
        result.reportGenerated = true;
        this.emitEvent('report_generated', job.id, { report: trainingReport as unknown as Record<string, unknown> });
      }

      // 5. Send notifications
      if (completionConfig.notifyOnCompletion) {
        await this.sendCompletionNotification(job, result);
      }

      // 6. Cleanup if configured
      if (completionConfig.cleanupAfterUpload && result.huggingFaceUrl) {
        await this.cleanupTemporaryFiles(job.id);
      }

      result.success = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.error = errorMessage;
      this.emitEvent('error', job.id, { error: errorMessage });
      
      // Update job with error
      await db.update(trainingJobs)
        .set({
          status: 'failed',
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(trainingJobs.id, job.id));
    } finally {
      this.pendingCompletions.delete(job.id);
    }

    return result;
  }

  /**
   * Handle training job failure
   */
  async handleFailure(
    job: MultiModalTrainingJob,
    error: string,
    partialReport?: Partial<TrainingReport>
  ): Promise<void> {
    // Build a failure report with available data
    const now = new Date().toISOString();
    const duration = job.startedAt 
      ? (new Date().getTime() - job.startedAt.getTime()) / 1000
      : 0;

    const report: TrainingReport = {
      id: `report-${job.id}`,
      trainingId: job.id,
      createdAt: now,
      completedAt: now,
      config: job.config,
      metrics: partialReport?.metrics || {
        finalLoss: 0,
        bestLoss: 0,
        lossHistory: [],
        totalSteps: job.progress?.currentStep || 0,
        trainingDurationSeconds: duration,
        samplesProcessed: 0,
      },
      datasetInfo: partialReport?.datasetInfo || {
        source: job.config.datasetConfig.source,
        samples: 0,
        trainSamples: 0,
        description: 'Training failed before completion',
      },
      gpuInfo: partialReport?.gpuInfo || {
        gpuType: job.config.gpuConfig.gpuType,
        gpuCount: job.config.gpuConfig.gpuCount,
        provider: job.config.gpuConfig.provider,
      },
      modelLocation: partialReport?.modelLocation || {},
      cost: partialReport?.cost || {
        gpuHours: duration / 3600,
        gpuCostUsd: 0,
        totalCostUsd: 0,
        creditsUsed: 0,
      },
      usageCode: partialReport?.usageCode || {
        python: '# Training failed - no model generated',
        typescript: '// Training failed - no model generated',
      },
      recommendations: [`Training failed: ${error}`],
    };

    await db.update(trainingJobs)
      .set({
        status: 'failed',
        completedAt: new Date().toISOString(),
        trainingReport: report as unknown as Record<string, unknown>,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(trainingJobs.id, job.id));
    
    // Still try to preserve any partial results
    if (partialReport?.modelLocation?.localPath) {
      try {
        await this.preservationService.preserveModel(
          job.id,
          job.userId,
          partialReport.modelLocation.localPath,
          { keepCheckpoints: true, maxCheckpoints: 1 }
        );
      } catch {
        console.warn('[CompletionHandler] Failed to preserve partial model');
      }
    }

    // Send failure notification
    await this.sendFailureNotification(job, error);
  }

  /**
   * Check pending completion status
   */
  isPending(jobId: string): boolean {
    return this.pendingCompletions.has(jobId);
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private async uploadToHuggingFace(
    job: MultiModalTrainingJob,
    report: TrainingReport
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      this.emitEvent('upload_started', job.id, {});

      // Get HuggingFace token
      const hfCredential = await this.credentialVault.getCredential(
        job.userId,
        'huggingface'
      );
      
      if (!hfCredential || !hfCredential.oauthAccessToken) {
        return {
          success: false,
          error: 'HuggingFace credentials not found',
        };
      }

      const uploadService = getHuggingFaceUploadService(hfCredential.oauthAccessToken);

      // Determine repo name
      const repoName = job.config.hubRepoName || 
        `${job.config.outputModelName}-${job.config.method}`;

      // Create repo and upload model card
      const { repoUrl } = await uploadService.createRepo(
        repoName,
        job.config.hubPrivate !== false
      );

      // Generate and upload model card
      const modelCard = uploadService.generateModelCard(
        job.config,
        report.metrics ? { finalLoss: report.metrics.finalLoss } : {},
        {
          framework: this.getFramework(job.config.modality),
          trainedBy: await this.getUserName(job.userId),
        }
      );

      await uploadService.uploadFile(
        repoName,
        modelCard,
        'README.md',
        'Add model card from KripTik AI'
      );

      return {
        success: true,
        url: repoUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  private async updateJobStatus(
    jobId: string,
    status: 'completed' | 'failed',
    report: TrainingReport
  ): Promise<void> {
    await db.update(trainingJobs)
      .set({
        status,
        completedAt: new Date().toISOString(),
        trainingReport: report as unknown as Record<string, unknown>,
        autoSaved: status === 'completed',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(trainingJobs.id, jobId));
  }

  private async updateJobHuggingFaceUrl(jobId: string, url: string): Promise<void> {
    await db.update(trainingJobs)
      .set({
        huggingFaceRepoUrl: url,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(trainingJobs.id, jobId));
  }

  private async generateFinalReport(
    job: MultiModalTrainingJob,
    report: TrainingReport
  ): Promise<void> {
    // Enhance report with additional metadata
    const enhancedReport = {
      ...report,
      metadata: {
        kriptikVersion: '1.0.0',
        provider: job.config.gpuConfig.provider,
        gpuType: job.config.gpuConfig.gpuType,
        completedAt: new Date().toISOString(),
      },
    };

    await db.update(trainingJobs)
      .set({
        trainingReport: enhancedReport as unknown as Record<string, unknown>,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(trainingJobs.id, job.id));
  }

  private async sendCompletionNotification(
    job: MultiModalTrainingJob,
    result: CompletionResult
  ): Promise<void> {
    // In production, this would send email/webhook/in-app notification
    console.log(`[CompletionHandler] Training ${job.id} completed:`, {
      huggingFaceUrl: result.huggingFaceUrl,
      modelPath: result.preservationResult?.modelPath,
    });
  }

  private async sendFailureNotification(
    job: MultiModalTrainingJob,
    error: string
  ): Promise<void> {
    // In production, this would send email/webhook/in-app notification
    console.log(`[CompletionHandler] Training ${job.id} failed:`, error);
  }

  private async cleanupTemporaryFiles(jobId: string): Promise<void> {
    // In production, this would clean up temporary training files
    console.log(`[CompletionHandler] Cleaning up temporary files for ${jobId}`);
  }

  private getFramework(modality: string): string {
    switch (modality) {
      case 'llm': return 'transformers';
      case 'image': return 'diffusers';
      case 'video': return 'diffusers';
      case 'audio': return 'TTS';
      default: return 'transformers';
    }
  }

  private async getUserName(userId: string): Promise<string> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    return user?.name || 'KripTik AI User';
  }

  private emitEvent(
    type: CompletionEvent['type'],
    jobId: string,
    data: Record<string, unknown>
  ): void {
    const event: CompletionEvent = {
      type,
      jobId,
      timestamp: new Date(),
      data,
    };
    this.emit('completion_event', event);
    this.emit(type, event);
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let completionHandlerInstance: TrainingCompletionHandler | null = null;

export function getTrainingCompletionHandler(): TrainingCompletionHandler {
  if (!completionHandlerInstance) {
    completionHandlerInstance = new TrainingCompletionHandler();
  }
  return completionHandlerInstance;
}

export default TrainingCompletionHandler;
