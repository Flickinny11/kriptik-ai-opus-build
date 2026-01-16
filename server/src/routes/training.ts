/**
 * Training API Routes - Model Fine-Tuning Endpoints
 *
 * Handles training job creation, monitoring, and management.
 * Supports multi-modal training: LLM, Image, Video, and Audio.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getTrainingOrchestrator } from '../services/ml/training-orchestrator.js';
import { type TrainingJobConfig } from '../services/ml/training-job.js';
import {
  getMultiModalTrainingOrchestrator,
  getGPURecommender,
  type TrainingConfig,
  type LLMTrainingConfig,
  type ImageTrainingConfig,
  type VideoTrainingConfig,
  type AudioTrainingConfig,
  DEFAULT_LLM_CONFIG,
  DEFAULT_IMAGE_CONFIG,
  DEFAULT_VIDEO_CONFIG,
  DEFAULT_AUDIO_CONFIG,
} from '../services/training/index.js';
import { db } from '../db.js';
import { trainingJobs } from '../schema.js';
import { eq, desc } from 'drizzle-orm';

const trainingRouter = Router();

// Initialize orchestrator for user
async function getOrchestrator(userId: string) {
  const orchestrator = getTrainingOrchestrator();
  await orchestrator.initialize(userId);
  return orchestrator;
}

// =============================================================================
// JOB MANAGEMENT
// =============================================================================

/**
 * POST /api/training/jobs
 * Create a new training job
 */
trainingRouter.post('/jobs', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const config: TrainingJobConfig = req.body;

    // Validate required fields
    if (!config.modelId || !config.trainingType || !config.outputRepoName) {
      return res.status(400).json({
        error: 'Missing required fields: modelId, trainingType, outputRepoName'
      });
    }

    // Set defaults
    const fullConfig: TrainingJobConfig = {
      modelId: config.modelId,
      modelName: config.modelName || config.modelId.split('/').pop() || 'model',
      trainingType: config.trainingType,
      epochs: config.epochs || 3,
      learningRate: config.learningRate || 2e-5,
      batchSize: config.batchSize || 4,
      loraRank: config.loraRank || 16,
      loraAlpha: config.loraAlpha || 32,
      loraDropout: config.loraDropout || 0.05,
      targetModules: config.targetModules || ['q_proj', 'k_proj', 'v_proj', 'o_proj'],
      datasetId: config.datasetId,
      datasetPath: config.datasetPath,
      outputRepoName: config.outputRepoName,
      autoSaveToHub: config.autoSaveToHub !== false,
      budgetLimit: config.budgetLimit || 10,
      gpuType: config.gpuType || 'NVIDIA GeForce RTX 4090',
      gpuCount: config.gpuCount || 1,
    };

    const orchestrator = await getOrchestrator(userId);
    const job = await orchestrator.createJob(userId, fullConfig, req.body.projectId);

    res.status(201).json({
      message: 'Training job created',
      job: job.getState(),
    });
  } catch (error) {
    console.error('[Training API] Create job error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create training job'
    });
  }
});

/**
 * GET /api/training/jobs
 * List all training jobs for the user
 */
trainingRouter.get('/jobs', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const jobs = await db
      .select()
      .from(trainingJobs)
      .where(eq(trainingJobs.userId, userId))
      .orderBy(desc(trainingJobs.createdAt));

    res.json({ jobs });
  } catch (error) {
    console.error('[Training API] List jobs error:', error);
    res.status(500).json({ error: 'Failed to list training jobs' });
  }
});

/**
 * GET /api/training/jobs/:jobId
 * Get a specific training job
 */
trainingRouter.get('/jobs/:jobId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { jobId } = req.params;
    const orchestrator = await getOrchestrator(userId);

    // Try to get from active jobs first
    const activeJob = orchestrator.getJob(jobId);
    if (activeJob) {
      return res.json({ job: activeJob.getState() });
    }

    // Fall back to database
    const [dbJob] = await db
      .select()
      .from(trainingJobs)
      .where(eq(trainingJobs.id, jobId));

    if (!dbJob) {
      return res.status(404).json({ error: 'Training job not found' });
    }

    if (dbJob.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ job: dbJob });
  } catch (error) {
    console.error('[Training API] Get job error:', error);
    res.status(500).json({ error: 'Failed to get training job' });
  }
});

/**
 * POST /api/training/jobs/:jobId/stop
 * Stop a running training job
 */
trainingRouter.post('/jobs/:jobId/stop', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { jobId } = req.params;
    const orchestrator = await getOrchestrator(userId);

    await orchestrator.stopJob(jobId);

    res.json({ message: 'Training job stopped' });
  } catch (error) {
    console.error('[Training API] Stop job error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to stop training job'
    });
  }
});

/**
 * DELETE /api/training/jobs/:jobId
 * Cancel/delete a training job
 */
trainingRouter.delete('/jobs/:jobId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { jobId } = req.params;
    const orchestrator = await getOrchestrator(userId);

    const job = orchestrator.getJob(jobId);
    if (job && job.status === 'queued') {
      await orchestrator.cancelJob(jobId);
    } else if (job) {
      await orchestrator.stopJob(jobId);
    }

    // Delete from database
    await db.delete(trainingJobs).where(eq(trainingJobs.id, jobId));

    res.json({ message: 'Training job deleted' });
  } catch (error) {
    console.error('[Training API] Delete job error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to delete training job'
    });
  }
});

// =============================================================================
// CALLBACKS (From RunPod)
// =============================================================================

/**
 * POST /api/training/callback
 * Handle callback from RunPod when training completes
 */
trainingRouter.post('/callback', async (req: Request, res: Response) => {
  try {
    const { jobId, status, outputUrl, error, metrics } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'Missing jobId' });
    }

    // Get job's userId from database to initialize orchestrator
    const [job] = await db
      .select()
      .from(trainingJobs)
      .where(eq(trainingJobs.id, jobId));

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const orchestrator = await getOrchestrator(job.userId);
    await orchestrator.handleCallback(jobId, {
      status,
      outputUrl,
      error,
      metrics,
    });

    res.json({ message: 'Callback processed' });
  } catch (error) {
    console.error('[Training API] Callback error:', error);
    res.status(500).json({ error: 'Failed to process callback' });
  }
});

/**
 * POST /api/training/callback/metrics
 * Handle real-time metrics update from RunPod
 */
trainingRouter.post('/callback/metrics', async (req: Request, res: Response) => {
  try {
    const { jobId, metrics } = req.body;

    if (!jobId || !metrics) {
      return res.status(400).json({ error: 'Missing jobId or metrics' });
    }

    // Get job's userId from database
    const [job] = await db
      .select()
      .from(trainingJobs)
      .where(eq(trainingJobs.id, jobId));

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const orchestrator = await getOrchestrator(job.userId);
    orchestrator.handleMetricsUpdate(jobId, metrics);

    res.json({ message: 'Metrics updated' });
  } catch (error) {
    console.error('[Training API] Metrics callback error:', error);
    res.status(500).json({ error: 'Failed to update metrics' });
  }
});

/**
 * POST /api/training/callback/log
 * Handle log updates from RunPod
 */
trainingRouter.post('/callback/log', async (req: Request, res: Response) => {
  try {
    const { jobId, log } = req.body;

    if (!jobId || !log) {
      return res.status(400).json({ error: 'Missing jobId or log' });
    }

    // Get job's userId from database
    const [job] = await db
      .select()
      .from(trainingJobs)
      .where(eq(trainingJobs.id, jobId));

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const orchestrator = await getOrchestrator(job.userId);
    orchestrator.handleLogUpdate(jobId, log);

    res.json({ message: 'Log updated' });
  } catch (error) {
    console.error('[Training API] Log callback error:', error);
    res.status(500).json({ error: 'Failed to update log' });
  }
});

// =============================================================================
// COST ESTIMATION
// =============================================================================

/**
 * POST /api/training/estimate
 * Estimate training cost without creating a job
 */
trainingRouter.post('/estimate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const config: Partial<TrainingJobConfig> = req.body;

    // GPU pricing
    const gpuPricing: Record<string, number> = {
      'NVIDIA GeForce RTX 3090': 0.44,
      'NVIDIA GeForce RTX 4090': 0.69,
      'NVIDIA A40': 0.79,
      'NVIDIA L40': 0.99,
      'NVIDIA A100-SXM4-40GB': 1.89,
      'NVIDIA A100 80GB PCIe': 2.49,
      'NVIDIA H100 PCIe': 3.99,
    };

    const gpuType = config.gpuType || 'NVIDIA GeForce RTX 4090';
    const epochs = config.epochs || 3;
    const trainingType = config.trainingType || 'qlora';

    // Estimate hours based on training type and epochs
    const baseHoursPerEpoch = trainingType === 'qlora' ? 0.8 : trainingType === 'lora' ? 1 : 1.5;
    const estimatedHours = epochs * baseHoursPerEpoch;

    const costPerHour = gpuPricing[gpuType] || 0.69;
    const estimatedCost = Math.ceil(estimatedHours * costPerHour * 100) / 100;

    res.json({
      estimatedHours,
      estimatedCost,
      gpuType,
      costPerHour,
    });
  } catch (error) {
    console.error('[Training API] Estimate error:', error);
    res.status(500).json({ error: 'Failed to estimate cost' });
  }
});

// =============================================================================
// MULTI-MODAL TRAINING (NEW)
// =============================================================================

/**
 * Initialize multi-modal orchestrator for user
 */
async function getMultiModalOrchestrator(userId: string) {
  const orchestrator = getMultiModalTrainingOrchestrator();
  await orchestrator.initialize(userId);
  return orchestrator;
}

/**
 * POST /api/training/recommend-gpu
 * Get GPU recommendation for a training configuration
 */
trainingRouter.post('/recommend-gpu', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const config = req.body as TrainingConfig;

    if (!config.modality || !config.method || !config.baseModelId) {
      return res.status(400).json({
        error: 'Missing required fields: modality, method, baseModelId',
      });
    }

    const recommender = getGPURecommender();
    const recommendation = recommender.recommend(config);

    res.json({ recommendation });
  } catch (error) {
    console.error('[Training API] GPU recommendation error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get GPU recommendation',
    });
  }
});

/**
 * POST /api/training/jobs/multimodal
 * Create a new multi-modal training job
 */
trainingRouter.post('/jobs/multimodal', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const config = req.body as Partial<TrainingConfig>;

    // Validate required fields
    if (!config.modality || !config.method || !config.baseModelId || !config.outputModelName) {
      return res.status(400).json({
        error: 'Missing required fields: modality, method, baseModelId, outputModelName',
      });
    }

    // Apply defaults based on modality
    let fullConfig: TrainingConfig;

    switch (config.modality) {
      case 'llm': {
        const llmConfig = config as Partial<LLMTrainingConfig>;
        fullConfig = {
          ...DEFAULT_LLM_CONFIG,
          ...llmConfig,
          id: llmConfig.id || crypto.randomUUID(),
          userId,
          modality: 'llm',
          method: (llmConfig.method || 'qlora') as 'lora' | 'qlora' | 'full_finetune',
          baseModelId: llmConfig.baseModelId!,
          baseModelName: llmConfig.baseModelName || llmConfig.baseModelId!.split('/').pop() || 'model',
          outputModelName: llmConfig.outputModelName!,
          datasetConfig: llmConfig.datasetConfig || { source: 'huggingface' },
          gpuConfig: llmConfig.gpuConfig || {
            provider: 'runpod',
            gpuType: 'NVIDIA GeForce RTX 4090',
            gpuCount: 1,
            estimatedHours: 2,
            estimatedCost: 1.38,
          },
          budgetLimitUsd: llmConfig.budgetLimitUsd || 10,
          autoSaveToHub: llmConfig.autoSaveToHub !== false,
          epochs: llmConfig.epochs || 3,
          learningRate: llmConfig.learningRate || 2e-5,
          batchSize: llmConfig.batchSize || 4,
          gradientAccumulationSteps: llmConfig.gradientAccumulationSteps || 4,
          warmupSteps: llmConfig.warmupSteps || 100,
          maxSeqLength: llmConfig.maxSeqLength || 2048,
        } as LLMTrainingConfig;
        break;
      }
      case 'image': {
        const imageConfig = config as Partial<ImageTrainingConfig>;
        fullConfig = {
          ...DEFAULT_IMAGE_CONFIG,
          ...imageConfig,
          id: imageConfig.id || crypto.randomUUID(),
          userId,
          modality: 'image',
          method: (imageConfig.method || 'lora') as 'lora' | 'dreambooth' | 'textual_inversion',
          baseModelId: imageConfig.baseModelId!,
          baseModelName: imageConfig.baseModelName || imageConfig.baseModelId!.split('/').pop() || 'model',
          outputModelName: imageConfig.outputModelName!,
          baseModel: imageConfig.baseModel || 'sdxl',
          datasetConfig: imageConfig.datasetConfig || { source: 'upload' },
          gpuConfig: imageConfig.gpuConfig || {
            provider: 'runpod',
            gpuType: 'NVIDIA GeForce RTX 4090',
            gpuCount: 1,
            estimatedHours: 1,
            estimatedCost: 0.69,
          },
          budgetLimitUsd: imageConfig.budgetLimitUsd || 5,
          autoSaveToHub: imageConfig.autoSaveToHub !== false,
          steps: imageConfig.steps || 1000,
          learningRate: imageConfig.learningRate || 1e-4,
          batchSize: imageConfig.batchSize || 1,
          resolution: imageConfig.resolution || 1024,
        } as ImageTrainingConfig;
        break;
      }
      case 'video': {
        const videoConfig = config as Partial<VideoTrainingConfig>;
        fullConfig = {
          ...DEFAULT_VIDEO_CONFIG,
          ...videoConfig,
          id: videoConfig.id || crypto.randomUUID(),
          userId,
          modality: 'video',
          method: (videoConfig.method || 'lora') as 'lora' | 'full_finetune',
          baseModelId: videoConfig.baseModelId!,
          baseModelName: videoConfig.baseModelName || videoConfig.baseModelId!.split('/').pop() || 'model',
          outputModelName: videoConfig.outputModelName!,
          baseModel: videoConfig.baseModel || 'wan',
          datasetConfig: videoConfig.datasetConfig || { source: 'upload' },
          gpuConfig: videoConfig.gpuConfig || {
            provider: 'runpod',
            gpuType: 'NVIDIA A100 80GB PCIe',
            gpuCount: 1,
            estimatedHours: 4,
            estimatedCost: 9.96,
          },
          budgetLimitUsd: videoConfig.budgetLimitUsd || 20,
          autoSaveToHub: videoConfig.autoSaveToHub !== false,
          steps: videoConfig.steps || 500,
          learningRate: videoConfig.learningRate || 1e-5,
          batchSize: videoConfig.batchSize || 1,
          frameCount: videoConfig.frameCount || 24,
          resolution: videoConfig.resolution || { width: 720, height: 480 },
        } as VideoTrainingConfig;
        break;
      }
      case 'audio': {
        const audioConfig = config as Partial<AudioTrainingConfig>;
        fullConfig = {
          ...DEFAULT_AUDIO_CONFIG,
          ...audioConfig,
          id: audioConfig.id || crypto.randomUUID(),
          userId,
          modality: 'audio',
          method: (audioConfig.method || 'voice_clone') as 'voice_clone' | 'style_transfer' | 'full_finetune',
          baseModelId: audioConfig.baseModelId!,
          baseModelName: audioConfig.baseModelName || audioConfig.baseModelId!.split('/').pop() || 'model',
          outputModelName: audioConfig.outputModelName!,
          baseModel: audioConfig.baseModel || 'xtts2',
          datasetConfig: audioConfig.datasetConfig || { source: 'upload' },
          gpuConfig: audioConfig.gpuConfig || {
            provider: 'runpod',
            gpuType: 'NVIDIA GeForce RTX 4090',
            gpuCount: 1,
            estimatedHours: 1,
            estimatedCost: 0.69,
          },
          budgetLimitUsd: audioConfig.budgetLimitUsd || 5,
          autoSaveToHub: audioConfig.autoSaveToHub !== false,
          steps: audioConfig.steps || 1000,
          learningRate: audioConfig.learningRate || 1e-5,
          sampleRate: audioConfig.sampleRate || 22050,
        } as AudioTrainingConfig;
        break;
      }
      default:
        return res.status(400).json({ error: `Unsupported modality: ${config.modality}` });
    }

    const orchestrator = await getMultiModalOrchestrator(userId);
    const { job, recommendation } = await orchestrator.createJob(fullConfig, true);

    res.status(201).json({
      message: 'Multi-modal training job created',
      job,
      recommendation,
    });
  } catch (error) {
    console.error('[Training API] Create multimodal job error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create training job',
    });
  }
});

/**
 * GET /api/training/jobs/:jobId/stream
 * Stream training progress via SSE
 */
trainingRouter.get('/jobs/:jobId/stream', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { jobId } = req.params;

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const orchestrator = await getMultiModalOrchestrator(userId);

    // Stream progress updates
    try {
      for await (const progress of orchestrator.streamProgress(jobId)) {
        res.write(`data: ${JSON.stringify(progress)}\n\n`);
      }
    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Stream error' })}\n\n`);
    }

    res.end();
  } catch (error) {
    console.error('[Training API] Stream error:', error);
    res.status(500).json({ error: 'Failed to stream progress' });
  }
});

/**
 * GET /api/training/jobs/modality/:modality
 * Get jobs filtered by modality
 */
trainingRouter.get('/jobs/modality/:modality', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { modality } = req.params;

    if (!['llm', 'image', 'video', 'audio'].includes(modality)) {
      return res.status(400).json({ error: 'Invalid modality' });
    }

    const orchestrator = await getMultiModalOrchestrator(userId);
    const jobs = await orchestrator.getJobsByModality(modality as any);

    res.json({ jobs });
  } catch (error) {
    console.error('[Training API] Get jobs by modality error:', error);
    res.status(500).json({ error: 'Failed to get jobs' });
  }
});

/**
 * GET /api/training/gpu-options
 * Get available GPU options
 */
trainingRouter.get('/gpu-options', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { modality, provider } = req.query;

    const recommender = getGPURecommender();
    const gpus = recommender.getAvailableGPUs(
      (modality as any) || 'llm',
      provider as any
    );

    res.json({ gpus });
  } catch (error) {
    console.error('[Training API] Get GPU options error:', error);
    res.status(500).json({ error: 'Failed to get GPU options' });
  }
});

/**
 * GET /api/training/default-config/:modality
 * Get default configuration for a modality
 */
trainingRouter.get('/default-config/:modality', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { modality } = req.params;

    let defaultConfig;
    switch (modality) {
      case 'llm':
        defaultConfig = DEFAULT_LLM_CONFIG;
        break;
      case 'image':
        defaultConfig = DEFAULT_IMAGE_CONFIG;
        break;
      case 'video':
        defaultConfig = DEFAULT_VIDEO_CONFIG;
        break;
      case 'audio':
        defaultConfig = DEFAULT_AUDIO_CONFIG;
        break;
      default:
        return res.status(400).json({ error: 'Invalid modality' });
    }

    res.json({ defaultConfig });
  } catch (error) {
    console.error('[Training API] Get default config error:', error);
    res.status(500).json({ error: 'Failed to get default config' });
  }
});

// =============================================================================
// TRAINING REPORTS
// =============================================================================

import { getTrainingReportGenerator, getUsageCodeGenerator } from '../services/training/index.js';
import { trainingReports } from '../schema.js';

/**
 * GET /api/training/jobs/:id/report
 * Get training report for a job
 */
trainingRouter.get('/jobs/:id/report', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id: jobId } = req.params;
    const { format } = req.query; // 'html' | 'json' | 'both'

    // Check if job belongs to user
    const job = await db.query.trainingJobs.findFirst({
      where: eq(trainingJobs.id, jobId),
    });

    if (!job) {
      return res.status(404).json({ error: 'Training job not found' });
    }

    if (job.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if report already exists
    const existingReport = await db.query.trainingReports.findFirst({
      where: eq(trainingReports.trainingJobId, jobId),
    });

    if (existingReport) {
      if (format === 'html') {
        res.setHeader('Content-Type', 'text/html');
        return res.send(existingReport.htmlReport);
      } else if (format === 'json') {
        return res.json(JSON.parse(existingReport.jsonReport));
      }
      return res.json({
        id: existingReport.id,
        htmlReport: existingReport.htmlReport,
        jsonReport: JSON.parse(existingReport.jsonReport),
        pdfUrl: existingReport.pdfUrl,
        createdAt: existingReport.createdAt,
      });
    }

    // Generate new report
    if (job.status !== 'completed') {
      return res.status(400).json({
        error: 'Training job not completed. Report can only be generated for completed jobs.'
      });
    }

    const reportGenerator = getTrainingReportGenerator();
    const report = await reportGenerator.generateFromJobId(jobId);

    // Save report
    const reportId = await reportGenerator.saveReport(jobId, userId, report);

    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html');
      return res.send(report.htmlReport);
    } else if (format === 'json') {
      return res.json(JSON.parse(report.jsonReport));
    }

    res.json({
      id: reportId,
      htmlReport: report.htmlReport,
      jsonReport: JSON.parse(report.jsonReport),
      recommendations: report.recommendations,
    });
  } catch (error) {
    console.error('[Training API] Get report error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get training report'
    });
  }
});

/**
 * GET /api/training/jobs/:id/report/download
 * Download training report as HTML file
 */
trainingRouter.get('/jobs/:id/report/download', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id: jobId } = req.params;

    // Check if job belongs to user
    const job = await db.query.trainingJobs.findFirst({
      where: eq(trainingJobs.id, jobId),
    });

    if (!job) {
      return res.status(404).json({ error: 'Training job not found' });
    }

    if (job.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get or generate report
    let htmlReport: string;
    const existingReport = await db.query.trainingReports.findFirst({
      where: eq(trainingReports.trainingJobId, jobId),
    });

    if (existingReport) {
      htmlReport = existingReport.htmlReport;
    } else {
      if (job.status !== 'completed') {
        return res.status(400).json({
          error: 'Training job not completed. Report can only be generated for completed jobs.'
        });
      }

      const reportGenerator = getTrainingReportGenerator();
      const report = await reportGenerator.generateFromJobId(jobId);
      await reportGenerator.saveReport(jobId, userId, report);
      htmlReport = report.htmlReport;
    }

    // Get output model name for filename
    const config = job.config as { outputModelName?: string };
    const filename = `training-report-${config.outputModelName || jobId}.html`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(htmlReport);
  } catch (error) {
    console.error('[Training API] Download report error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to download report'
    });
  }
});

/**
 * GET /api/training/jobs/:id/usage-code
 * Get usage code snippets for a trained model
 */
trainingRouter.get('/jobs/:id/usage-code', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id: jobId } = req.params;
    const { language } = req.query; // 'python' | 'typescript' | 'curl' | 'all'

    // Check if job belongs to user
    const job = await db.query.trainingJobs.findFirst({
      where: eq(trainingJobs.id, jobId),
    });

    if (!job) {
      return res.status(404).json({ error: 'Training job not found' });
    }

    if (job.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const config = job.config as TrainingConfig;
    const modelUrl = job.huggingFaceRepoUrl || config.hubRepoName || config.outputModelName;

    const usageCodeGenerator = getUsageCodeGenerator();
    const code = usageCodeGenerator.generateAll(config, {
      modelUrl: modelUrl || '',
      endpoint: (job.outputModelUrl as string) || undefined,
    });

    if (language === 'python') {
      return res.json({ python: code.python });
    } else if (language === 'typescript') {
      return res.json({ typescript: code.typescript });
    } else if (language === 'curl' && code.curl) {
      return res.json({ curl: code.curl });
    }

    res.json(code);
  } catch (error) {
    console.error('[Training API] Get usage code error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get usage code'
    });
  }
});

// =============================================================================
// MODEL COMPARISON TESTING
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { createRunPodProvider } from '../services/cloud/runpod.js';
import { getCredentialVault } from '../services/security/credential-vault.js';

// Track temporary test endpoints for cleanup
const testEndpointTracker = new Map<string, {
  originalEndpointId: string;
  fineTunedEndpointId: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}>();

/**
 * POST /api/training/comparison/deploy
 * Deploy temporary test endpoints for before/after comparison
 */
trainingRouter.post('/comparison/deploy', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { trainingJobId, baseModelId, fineTunedModelPath, modality, testWindowMinutes = 10 } = req.body;

    if (!trainingJobId || !baseModelId || !fineTunedModelPath || !modality) {
      return res.status(400).json({
        error: 'Missing required fields: trainingJobId, baseModelId, fineTunedModelPath, modality',
      });
    }

    // Get RunPod credentials
    const vault = getCredentialVault();
    const runpodCredential = await vault.getCredential(userId, 'runpod');

    if (!runpodCredential?.oauthAccessToken) {
      return res.status(400).json({
        error: 'RunPod credentials not configured. Please connect RunPod in Settings.',
      });
    }

    const runpod = createRunPodProvider(runpodCredential.oauthAccessToken);

    // Determine container image based on modality
    const containerImages: Record<string, string> = {
      text: 'runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04',
      image: 'runpod/stable-diffusion:xl-1.0',
      video: 'runpod/pytorch:2.1.0-py3.10-cuda12.1.0-devel-ubuntu22.04',
      audio: 'runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04',
    };

    const containerImage = containerImages[modality] || containerImages.text;

    // Deploy original model endpoint
    const originalDeployment = await runpod.deploy({
      provider: 'runpod',
      resourceType: 'gpu',
      region: 'US',
      name: `kriptik-comparison-original-${uuidv4().slice(0, 8)}`,
      containerImage,
      gpu: {
        type: 'nvidia-rtx-4090',
        count: 1,
      },
      environmentVariables: {
        MODEL_ID: baseModelId,
        MODE: 'inference',
        COMPARISON_TYPE: 'original',
      },
      timeoutSeconds: testWindowMinutes * 60,
    });

    // Deploy fine-tuned model endpoint
    const fineTunedDeployment = await runpod.deploy({
      provider: 'runpod',
      resourceType: 'gpu',
      region: 'US',
      name: `kriptik-comparison-finetuned-${uuidv4().slice(0, 8)}`,
      containerImage,
      gpu: {
        type: 'nvidia-rtx-4090',
        count: 1,
      },
      environmentVariables: {
        MODEL_ID: baseModelId,
        ADAPTER_PATH: fineTunedModelPath,
        MODE: 'inference',
        COMPARISON_TYPE: 'finetuned',
      },
      timeoutSeconds: testWindowMinutes * 60,
    });

    // Track endpoints for cleanup
    const expiresAt = new Date(Date.now() + testWindowMinutes * 60 * 1000);
    testEndpointTracker.set(trainingJobId, {
      originalEndpointId: originalDeployment.providerResourceId || originalDeployment.id,
      fineTunedEndpointId: fineTunedDeployment.providerResourceId || fineTunedDeployment.id,
      userId,
      createdAt: new Date(),
      expiresAt,
    });

    // Schedule automatic cleanup
    setTimeout(async () => {
      const tracker = testEndpointTracker.get(trainingJobId);
      if (tracker) {
        try {
          await runpod.deleteDeployment(tracker.originalEndpointId);
          await runpod.deleteDeployment(tracker.fineTunedEndpointId);
        } catch (error) {
          console.error('[Comparison] Auto-cleanup error:', error);
        }
        testEndpointTracker.delete(trainingJobId);
      }
    }, testWindowMinutes * 60 * 1000);

    res.json({
      originalEndpoint: `https://api.runpod.ai/v2/${originalDeployment.providerResourceId || originalDeployment.id}/run`,
      fineTunedEndpoint: `https://api.runpod.ai/v2/${fineTunedDeployment.providerResourceId || fineTunedDeployment.id}/run`,
      expiresAt: expiresAt.toISOString(),
      testWindowMinutes,
    });
  } catch (error) {
    console.error('[Training API] Comparison deploy error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to deploy test endpoints',
    });
  }
});

/**
 * POST /api/training/comparison/run
 * Run a comparison test on both endpoints
 */
trainingRouter.post('/comparison/run', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { trainingJobId, originalEndpoint, fineTunedEndpoint, modality, prompt, image } = req.body;

    if (!trainingJobId || !originalEndpoint || !fineTunedEndpoint || !modality || !prompt) {
      return res.status(400).json({
        error: 'Missing required fields',
      });
    }

    // Get RunPod credentials for auth
    const vault = getCredentialVault();
    const runpodCredential = await vault.getCredential(userId, 'runpod');

    if (!runpodCredential?.oauthAccessToken) {
      return res.status(400).json({ error: 'RunPod credentials not configured' });
    }

    // Build inference request based on modality
    const buildInferenceRequest = (endpoint: string, isFineTuned: boolean) => {
      const input: Record<string, unknown> = { prompt };

      if (image && (modality === 'image' || modality === 'video')) {
        input.image = image;
      }

      if (isFineTuned) {
        input.use_adapter = true;
      }

      return {
        url: endpoint,
        method: 'POST' as const,
        headers: {
          'Authorization': `Bearer ${runpodCredential.oauthAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input }),
      };
    };

    // Run both inferences in parallel
    const [originalRequest, fineTunedRequest] = [
      buildInferenceRequest(originalEndpoint, false),
      buildInferenceRequest(fineTunedEndpoint, true),
    ];

    const startTime = Date.now();

    const [originalResult, fineTunedResult] = await Promise.all([
      fetch(originalRequest.url, {
        method: originalRequest.method,
        headers: originalRequest.headers,
        body: originalRequest.body,
      }).then(async (r) => {
        const latencyMs = Date.now() - startTime;
        if (!r.ok) {
          const errorText = await r.text();
          return { output: null, latencyMs, error: errorText };
        }
        const data = await r.json();
        return { output: data.output || data.result, latencyMs };
      }).catch(err => ({ output: null, latencyMs: Date.now() - startTime, error: err.message })),

      fetch(fineTunedRequest.url, {
        method: fineTunedRequest.method,
        headers: fineTunedRequest.headers,
        body: fineTunedRequest.body,
      }).then(async (r) => {
        const latencyMs = Date.now() - startTime;
        if (!r.ok) {
          const errorText = await r.text();
          return { output: null, latencyMs, error: errorText };
        }
        const data = await r.json();
        return { output: data.output || data.result, latencyMs };
      }).catch(err => ({ output: null, latencyMs: Date.now() - startTime, error: err.message })),
    ]);

    // Calculate cost (rough estimate based on GPU usage)
    const totalLatencyMs = Math.max(originalResult.latencyMs, fineTunedResult.latencyMs);
    const gpuHours = (totalLatencyMs / 1000 / 3600) * 2; // Both endpoints
    const costPerHour = 0.69; // RTX 4090
    const estimatedCost = gpuHours * costPerHour;

    res.json({
      original: originalResult,
      finetuned: fineTunedResult,
      cost: estimatedCost,
      totalLatencyMs,
    });
  } catch (error) {
    console.error('[Training API] Comparison run error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to run comparison',
    });
  }
});

/**
 * POST /api/training/comparison/cleanup
 * Clean up test endpoints before expiration
 */
trainingRouter.post('/comparison/cleanup', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { trainingJobId } = req.body;

    if (!trainingJobId) {
      return res.status(400).json({ error: 'Missing trainingJobId' });
    }

    const tracker = testEndpointTracker.get(trainingJobId);
    if (!tracker) {
      return res.json({ message: 'No endpoints to clean up' });
    }

    if (tracker.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get RunPod credentials
    const vault = getCredentialVault();
    const runpodCredential = await vault.getCredential(userId, 'runpod');

    if (runpodCredential?.oauthAccessToken) {
      const runpod = createRunPodProvider(runpodCredential.oauthAccessToken);

      try {
        await runpod.deleteDeployment(tracker.originalEndpointId);
      } catch (e) {
        console.warn('[Comparison] Failed to delete original endpoint:', e);
      }

      try {
        await runpod.deleteDeployment(tracker.fineTunedEndpointId);
      } catch (e) {
        console.warn('[Comparison] Failed to delete fine-tuned endpoint:', e);
      }
    }

    testEndpointTracker.delete(trainingJobId);

    res.json({ message: 'Endpoints cleaned up successfully' });
  } catch (error) {
    console.error('[Training API] Comparison cleanup error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to clean up endpoints',
    });
  }
});

/**
 * GET /api/training/search-models
 * Search for models to fine-tune
 */
trainingRouter.get('/search-models', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { query, modality, limit = '10' } = req.query;

    if (!query) {
      return res.json({ models: [] });
    }

    // Map modality to HuggingFace task type
    const modalityToTask: Record<string, string> = {
      llm: 'text-generation',
      image: 'text-to-image',
      video: 'text-to-video',
      audio: 'text-to-speech',
      multimodal: '',
    };

    const task = modalityToTask[modality as string] || '';
    const params = new URLSearchParams({
      search: query as string,
      limit: limit as string,
      full: 'true',
      ...(task && { pipeline_tag: task }),
    });

    const response = await fetch(`https://huggingface.co/api/models?${params}`);

    if (!response.ok) {
      throw new Error('HuggingFace API error');
    }

    const models = await response.json();

    res.json({
      models: models.map((m: any) => ({
        id: m.id,
        name: m.id.split('/').pop(),
        author: m.author || m.id.split('/')[0],
        description: m.cardData?.description,
        downloads: m.downloads,
        likes: m.likes,
        tags: m.tags,
        modelSize: m.siblings?.find((s: any) => s.rfilename?.endsWith('.bin'))?.size,
        license: m.cardData?.license,
        lastModified: m.lastModified,
        private: m.private,
      })),
    });
  } catch (error) {
    console.error('[Training API] Search models error:', error);
    res.status(500).json({ error: 'Failed to search models' });
  }
});

// =============================================================================
// FLAGSHIP TRAINING PLAN ENDPOINTS (Phase 2)
// =============================================================================

import {
  createTrainingIntentLockEngine,
  createTrainingMethodRecommender,
  createTrainingDataStrategist,
  createTrainingPlanGenerator,
  type TrainingContract,
  type TrainingImplementationPlan,
  type BudgetAuthorization,
  type TileModification,
} from '../services/training/index.js';
import { trainingPlans } from '../schema.js';

/**
 * POST /api/training/parse-intent
 * Parse NLP prompt to create training contract and implementation plan
 */
trainingRouter.post('/parse-intent', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { prompt, context } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Create training contract
    const intentLockEngine = createTrainingIntentLockEngine();
    const contract = await intentLockEngine.createContract(userId, prompt, {
      thinkingBudget: 64000,
    });

    // Generate implementation plan
    const planGenerator = createTrainingPlanGenerator();
    const plan = await planGenerator.generatePlan(contract);

    // Store in database
    await db.insert(trainingPlans).values({
      id: plan.id,
      userId,
      contractId: contract.id,
      contract: JSON.stringify(contract),
      plan: JSON.stringify(plan),
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.json({
      contract,
      plan,
    });
  } catch (error) {
    console.error('[Training API] Parse intent error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to parse training intent',
    });
  }
});

/**
 * GET /api/training/plans/:planId
 * Get implementation plan by ID
 */
trainingRouter.get('/plans/:planId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { planId } = req.params;

    const [planRecord] = await db
      .select()
      .from(trainingPlans)
      .where(eq(trainingPlans.id, planId))
      .limit(1);

    if (!planRecord) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (planRecord.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      plan: JSON.parse(planRecord.plan),
      contract: JSON.parse(planRecord.contract),
      status: planRecord.status,
      approvedAt: planRecord.approvedAt,
    });
  } catch (error) {
    console.error('[Training API] Get plan error:', error);
    res.status(500).json({ error: 'Failed to get training plan' });
  }
});

/**
 * PUT /api/training/plans/:planId/tiles/:tileId
 * Modify a tile in the implementation plan
 */
trainingRouter.put('/plans/:planId/tiles/:tileId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { planId, tileId } = req.params;
    const { modification } = req.body as { modification: TileModification };

    if (!modification) {
      return res.status(400).json({ error: 'Modification is required' });
    }

    // Get existing plan
    const [planRecord] = await db
      .select()
      .from(trainingPlans)
      .where(eq(trainingPlans.id, planId))
      .limit(1);

    if (!planRecord) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (planRecord.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const plan: TrainingImplementationPlan = JSON.parse(planRecord.plan);
    const contract: TrainingContract = JSON.parse(planRecord.contract);

    // Apply modification
    const planGenerator = createTrainingPlanGenerator();
    const { plan: updatedPlan, affectedTiles } = await planGenerator.modifyTile(
      plan,
      tileId,
      modification,
      contract
    );

    // Update database
    await db
      .update(trainingPlans)
      .set({
        plan: JSON.stringify(updatedPlan),
        status: 'modified',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(trainingPlans.id, planId));

    res.json({
      plan: updatedPlan,
      affectedTiles,
    });
  } catch (error) {
    console.error('[Training API] Modify tile error:', error);
    res.status(500).json({ error: 'Failed to modify tile' });
  }
});

/**
 * POST /api/training/plans/:planId/approve
 * Approve plan and start training
 */
trainingRouter.post('/plans/:planId/approve', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { planId } = req.params;
    const { budgetAuthorization } = req.body as { budgetAuthorization: BudgetAuthorization };

    if (!budgetAuthorization) {
      return res.status(400).json({ error: 'Budget authorization is required' });
    }

    if (!budgetAuthorization.termsAccepted) {
      return res.status(400).json({ error: 'Terms must be accepted' });
    }

    // Get existing plan
    const [planRecord] = await db
      .select()
      .from(trainingPlans)
      .where(eq(trainingPlans.id, planId))
      .limit(1);

    if (!planRecord) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (planRecord.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const plan: TrainingImplementationPlan = JSON.parse(planRecord.plan);
    const contract: TrainingContract = JSON.parse(planRecord.contract);

    // Lock contract and approve plan
    const intentLockEngine = createTrainingIntentLockEngine();
    const lockedContract = await intentLockEngine.lockContract(contract);

    const planGenerator = createTrainingPlanGenerator();
    const approvedPlan = await planGenerator.approvePlan(plan, budgetAuthorization, lockedContract);

    // Update database
    const approvedAt = new Date().toISOString();
    await db
      .update(trainingPlans)
      .set({
        contract: JSON.stringify(lockedContract),
        plan: JSON.stringify(approvedPlan.plan),
        status: 'approved',
        budgetAuthorization: JSON.stringify(budgetAuthorization),
        approvedAt,
        updatedAt: approvedAt,
      })
      .where(eq(trainingPlans.id, planId));

    // Create training job based on the approved plan
    const jobId = crypto.randomUUID();
    
    // Extract config from approved plan for the training job
    const methodTile = approvedPlan.plan.tiles.find(t => t.category === 'method');
    const modelTile = approvedPlan.plan.tiles.find(t => t.category === 'model');
    const gpuTile = approvedPlan.plan.tiles.find(t => t.category === 'gpu');
    
    await db.insert(trainingJobs).values({
      id: jobId,
      userId,
      modality: lockedContract.targetCapability === 'music_generation' || lockedContract.targetCapability === 'voice_cloning' 
        ? 'audio'
        : lockedContract.targetCapability === 'image_generation' 
        ? 'image'
        : lockedContract.targetCapability === 'video_generation'
        ? 'video'
        : 'llm',
      method: (methodTile?.userSelection || methodTile?.recommendation || 'lora') as string,
      config: JSON.stringify({
        contractId: lockedContract.id,
        planId: approvedPlan.planId,
        qualityTier: lockedContract.qualityTier,
        targetCapability: lockedContract.targetCapability,
        baseModel: modelTile?.userSelection || modelTile?.recommendation,
        budgetAuthorization,
      }),
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Link job to plan
    await db
      .update(trainingPlans)
      .set({ trainingJobId: jobId })
      .where(eq(trainingPlans.id, planId));

    res.json({
      approvedPlan,
      jobId,
    });
  } catch (error) {
    console.error('[Training API] Approve plan error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to approve plan',
    });
  }
});

/**
 * POST /api/training/plans/:planId/modify-with-ai
 * Modify plan using NLP input
 */
trainingRouter.post('/plans/:planId/modify-with-ai', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { planId } = req.params;
    const { nlpModification } = req.body as { nlpModification: string };

    if (!nlpModification) {
      return res.status(400).json({ error: 'NLP modification is required' });
    }

    // Get existing plan
    const [planRecord] = await db
      .select()
      .from(trainingPlans)
      .where(eq(trainingPlans.id, planId))
      .limit(1);

    if (!planRecord) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (planRecord.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const plan: TrainingImplementationPlan = JSON.parse(planRecord.plan);
    const contract: TrainingContract = JSON.parse(planRecord.contract);

    // Apply AI modification
    const planGenerator = createTrainingPlanGenerator();
    const { plan: updatedPlan, changes } = await planGenerator.modifyWithAI(
      plan,
      nlpModification,
      contract
    );

    // Update database
    await db
      .update(trainingPlans)
      .set({
        plan: JSON.stringify(updatedPlan),
        status: changes.length > 0 ? 'modified' : planRecord.status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(trainingPlans.id, planId));

    res.json({
      plan: updatedPlan,
      changes,
    });
  } catch (error) {
    console.error('[Training API] Modify with AI error:', error);
    res.status(500).json({ error: 'Failed to modify plan with AI' });
  }
});

/**
 * GET /api/training/search-data
 * Search for training datasets
 */
trainingRouter.get('/search-data', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { query, capability, minSamples } = req.query;

    if (!query || !capability) {
      return res.status(400).json({ error: 'Query and capability are required' });
    }

    const dataStrategist = createTrainingDataStrategist();
    const sources = await dataStrategist.searchTrainingData(
      query as string,
      capability as any
    );

    // Filter by minSamples if provided
    const filteredSources = minSamples
      ? sources.filter(s => s.samples >= parseInt(minSamples as string, 10))
      : sources;

    res.json({
      sources: filteredSources,
    });
  } catch (error) {
    console.error('[Training API] Search data error:', error);
    res.status(500).json({ error: 'Failed to search training data' });
  }
});

/**
 * GET /api/training/plans
 * List user's training plans
 */
trainingRouter.get('/plans', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const plans = await db
      .select()
      .from(trainingPlans)
      .where(eq(trainingPlans.userId, userId))
      .orderBy(desc(trainingPlans.createdAt))
      .limit(50);

    res.json({
      plans: plans.map(p => ({
        id: p.id,
        contractId: p.contractId,
        status: p.status,
        summary: JSON.parse(p.plan).summary,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        approvedAt: p.approvedAt,
        trainingJobId: p.trainingJobId,
      })),
    });
  } catch (error) {
    console.error('[Training API] List plans error:', error);
    res.status(500).json({ error: 'Failed to list training plans' });
  }
});

export default trainingRouter;
