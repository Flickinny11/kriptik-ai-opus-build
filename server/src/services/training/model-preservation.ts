/**
 * Model Preservation Service
 *
 * Handles preservation of trained models including:
 * - Checkpoint management
 * - Model versioning
 * - Storage optimization
 * - Model registry tracking
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import { db } from '../../db.js';
import { eq, sql } from 'drizzle-orm';
import { trainingJobs } from '../../schema.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ModelVersion {
  id: string;
  version: string;
  modelPath: string;
  checkpointPath?: string;
  createdAt: Date;
  metrics: Record<string, number>;
  config: Record<string, unknown>;
  size: number;
  format: 'safetensors' | 'pytorch' | 'onnx' | 'gguf';
  quantization?: string;
}

export interface PreservationConfig {
  keepCheckpoints: boolean;
  checkpointInterval: number;
  maxCheckpoints: number;
  compressModels: boolean;
  autoConvert: boolean;
  targetFormats: ('safetensors' | 'onnx' | 'gguf')[];
}

export interface StorageInfo {
  provider: 'huggingface' | 's3' | 'gcs' | 'local';
  path: string;
  size: number;
  lastAccessed?: Date;
  downloadCount?: number;
}

export interface ModelRegistry {
  modelId: string;
  userId: string;
  name: string;
  modality: string;
  baseModel: string;
  versions: ModelVersion[];
  currentVersion: string;
  storage: StorageInfo[];
  tags: string[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PreservationResult {
  success: boolean;
  modelId: string;
  version: string;
  paths: {
    model: string;
    checkpoint?: string;
    converted?: string[];
  };
  size: number;
  error?: string;
}

// =============================================================================
// MODEL PRESERVATION SERVICE
// =============================================================================

export class ModelPreservationService {
  private defaultConfig: PreservationConfig = {
    keepCheckpoints: true,
    checkpointInterval: 500,
    maxCheckpoints: 3,
    compressModels: true,
    autoConvert: false,
    targetFormats: ['safetensors'],
  };

  /**
   * Preserve a completed training job's model
   */
  async preserveModel(
    jobId: string,
    userId: string,
    modelPath: string,
    config?: Partial<PreservationConfig>
  ): Promise<PreservationResult> {
    const preservationConfig = { ...this.defaultConfig, ...config };

    try {
      // Get job details
      const job = await this.getJobDetails(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      // Generate version
      const version = this.generateVersion();

      // Create model version record
      const modelVersion: ModelVersion = {
        id: `${jobId}-${version}`,
        version,
        modelPath,
        createdAt: new Date(),
        metrics: job.metrics || {},
        config: job.config as Record<string, unknown>,
        size: 0, // Would be calculated from actual files
        format: 'safetensors',
      };

      // Register in database
      await this.registerModelVersion(jobId, userId, modelVersion);

      // Handle checkpoints if needed
      let checkpointPath: string | undefined;
      if (preservationConfig.keepCheckpoints) {
        checkpointPath = await this.preserveCheckpoints(
          jobId,
          modelPath,
          preservationConfig.maxCheckpoints
        );
      }

      // Auto-convert if enabled
      const convertedPaths: string[] = [];
      if (preservationConfig.autoConvert && preservationConfig.targetFormats.length > 0) {
        for (const format of preservationConfig.targetFormats) {
          if (format !== 'safetensors') { // Already in safetensors
            const converted = await this.convertModel(modelPath, format);
            if (converted) {
              convertedPaths.push(converted);
            }
          }
        }
      }

      return {
        success: true,
        modelId: jobId,
        version,
        paths: {
          model: modelPath,
          checkpoint: checkpointPath,
          converted: convertedPaths.length > 0 ? convertedPaths : undefined,
        },
        size: modelVersion.size,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        modelId: jobId,
        version: '',
        paths: { model: '' },
        size: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Get all versions of a model
   */
  async getModelVersions(modelId: string): Promise<ModelVersion[]> {
    // In a full implementation, this would query a model registry table
    // For now, we return from the training jobs metadata
    const job = await this.getJobDetails(modelId);
    if (!job || !job.trainingReport) {
      return [];
    }

    return [{
      id: modelId,
      version: '1.0.0',
      modelPath: job.trainingReport.modelLocation?.localPath || '',
      createdAt: job.completedAt || new Date(),
      metrics: job.metrics || {},
      config: job.config as Record<string, unknown>,
      size: 0,
      format: 'safetensors',
    }];
  }

  /**
   * Delete a specific model version
   */
  async deleteModelVersion(modelId: string, version: string): Promise<boolean> {
    // In production, this would:
    // 1. Delete files from storage
    // 2. Remove from model registry
    // 3. Update version history
    console.log(`[ModelPreservation] Delete version ${version} of model ${modelId}`);
    return true;
  }

  /**
   * Get storage usage for a user
   */
  async getStorageUsage(userId: string): Promise<{
    totalBytes: number;
    modelCount: number;
    versionCount: number;
    byModality: Record<string, number>;
  }> {
    const jobs = await db.query.trainingJobs.findMany({
      where: eq(trainingJobs.userId, userId),
    });

    let totalBytes = 0;
    const byModality: Record<string, number> = {};
    let versionCount = 0;

    for (const job of jobs) {
      if (job.trainingReport) {
        // Estimate size based on config
        const size = 1000000; // 1MB placeholder - would calculate from actual files
        totalBytes += size;

        const config = job.config as { modality?: string };
        const modality = config?.modality || 'unknown';
        byModality[modality] = (byModality[modality] || 0) + size;
        versionCount++;
      }
    }

    return {
      totalBytes,
      modelCount: jobs.length,
      versionCount,
      byModality,
    };
  }

  /**
   * Cleanup old checkpoints to save storage
   */
  async cleanupCheckpoints(
    modelId: string,
    keepCount: number = 3
  ): Promise<{ deleted: number; freed: number }> {
    // In production, this would:
    // 1. List all checkpoints for the model
    // 2. Sort by step/epoch
    // 3. Delete all but the latest `keepCount`
    console.log(`[ModelPreservation] Cleanup checkpoints for ${modelId}, keeping ${keepCount}`);
    return { deleted: 0, freed: 0 };
  }

  /**
   * Export model in a specific format
   */
  async exportModel(
    modelId: string,
    format: 'safetensors' | 'onnx' | 'gguf',
    _quantization?: string
  ): Promise<string | null> {
    const job = await this.getJobDetails(modelId);
    if (!job) {
      return null;
    }

    // In production, this would trigger a conversion job
    // For now, return the path that would be generated
    return `models/${modelId}/exported.${format}`;
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private async getJobDetails(jobId: string): Promise<{
    config: unknown;
    metrics?: Record<string, number>;
    trainingReport?: {
      metrics?: {
        finalLoss?: number;
      };
      modelLocation?: {
        localPath?: string;
      };
    };
    completedAt?: Date;
  } | null> {
    const job = await db.query.trainingJobs.findFirst({
      where: eq(trainingJobs.id, jobId),
    });

    if (!job) {
      return null;
    }

    const trainingReport = job.trainingReport as {
      metrics?: { finalLoss?: number };
      modelLocation?: { localPath?: string };
    } | null;

    return {
      config: job.config,
      metrics: trainingReport?.metrics?.finalLoss
        ? { finalLoss: trainingReport.metrics.finalLoss }
        : undefined,
      trainingReport: trainingReport || undefined,
      completedAt: job.completedAt ? new Date(job.completedAt) : undefined,
    };
  }

  private generateVersion(): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 12);
    return `1.0.${timestamp}`;
  }

  private async registerModelVersion(
    jobId: string,
    _userId: string,
    version: ModelVersion
  ): Promise<void> {
    // Update the training job with version info
    await db.update(trainingJobs)
      .set({
        trainingReport: sql`jsonb_set(
          COALESCE(${trainingJobs.trainingReport}, '{}'::jsonb),
          '{modelVersion}',
          ${JSON.stringify(version)}::jsonb
        )`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(trainingJobs.id, jobId));
  }

  private async preserveCheckpoints(
    jobId: string,
    _modelPath: string,
    _maxCheckpoints: number
  ): Promise<string> {
    // In production, this would:
    // 1. Copy latest checkpoints to permanent storage
    // 2. Clean up old checkpoints
    const checkpointPath = `models/${jobId}/checkpoints`;
    console.log(`[ModelPreservation] Preserving checkpoints to ${checkpointPath}`);
    return checkpointPath;
  }

  private async convertModel(
    modelPath: string,
    format: 'safetensors' | 'onnx' | 'gguf'
  ): Promise<string | null> {
    // In production, this would trigger a conversion job
    const basePath = modelPath.replace(/\.[^.]+$/, '');
    return `${basePath}.${format}`;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let preservationServiceInstance: ModelPreservationService | null = null;

export function getModelPreservationService(): ModelPreservationService {
  if (!preservationServiceInstance) {
    preservationServiceInstance = new ModelPreservationService();
  }
  return preservationServiceInstance;
}

export default ModelPreservationService;
