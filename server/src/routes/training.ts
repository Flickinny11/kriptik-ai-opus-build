/**
 * Training API Routes - Model Fine-Tuning Endpoints
 * 
 * Handles training job creation, monitoring, and management.
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 4).
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getTrainingOrchestrator } from '../services/ml/training-orchestrator.js';
import { type TrainingJobConfig } from '../services/ml/training-job.js';
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

export default trainingRouter;
