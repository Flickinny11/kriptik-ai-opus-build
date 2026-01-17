/**
 * Deployment API Routes
 *
 * REST endpoints for model deployment to RunPod and Modal.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import {
  getUnifiedDeployer,
  getDeploymentRecommender,
  type DeploymentProvider,
} from '../services/deployment/index.js';
import {
  getBuildIntegrationHooks,
  type RunPodDeploymentRequest,
} from '../services/automation/build-integration-hooks.js';
import { getGPUAvailability } from '../services/compute/runpod-availability.js';

const deploymentRouter = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const DeploySchema = z.object({
  trainingJobId: z.string(),
  provider: z.enum(['runpod', 'modal', 'auto']).default('auto'),
  modelName: z.string().optional(),
  customConfig: z.object({
    gpuType: z.string().optional(),
    scalingConfig: z.object({
      minWorkers: z.number().optional(),
      maxWorkers: z.number().optional(),
      scaleToZero: z.boolean().optional(),
    }).optional(),
  }).optional(),
});

// =============================================================================
// RECOMMENDATION ENDPOINTS
// =============================================================================

/**
 * GET /api/deployment/recommend/:trainingJobId
 * Get deployment recommendation for a training job
 */
deploymentRouter.get('/recommend/:trainingJobId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { trainingJobId } = req.params;
    const deployer = getUnifiedDeployer();

    const recommendation = await deployer.getRecommendation(trainingJobId);

    res.json({
      success: true,
      data: recommendation,
    });
  } catch (error) {
    console.error('[Deployment API] Recommend error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get recommendation',
    });
  }
});

/**
 * POST /api/deployment/compare-costs
 * Compare costs across providers for a GPU type
 */
deploymentRouter.post('/compare-costs', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { gpuType, hoursPerDay = 8 } = req.body;

    if (!gpuType) {
      return res.status(400).json({ error: 'gpuType is required' });
    }

    const recommender = getDeploymentRecommender();
    const comparison = recommender.compareCosts(gpuType, hoursPerDay);

    res.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    console.error('[Deployment API] Compare costs error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to compare costs',
    });
  }
});

// =============================================================================
// DEPLOYMENT ENDPOINTS
// =============================================================================

/**
 * POST /api/deployment/deploy
 * Deploy a trained model
 */
deploymentRouter.post('/deploy', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const config = DeploySchema.parse(req.body);
    const deployer = getUnifiedDeployer();

    const result = await deployer.deploy({
      userId,
      trainingJobId: config.trainingJobId,
      provider: config.provider as DeploymentProvider | 'auto',
      modelName: config.modelName,
      customConfig: config.customConfig as any,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Deployment API] Deploy error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to deploy model',
    });
  }
});

/**
 * GET /api/deployment
 * List user's deployments
 */
deploymentRouter.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const deployer = getUnifiedDeployer();
    const deployments = await deployer.listDeployments(userId);

    res.json({
      success: true,
      data: deployments,
    });
  } catch (error) {
    console.error('[Deployment API] List error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to list deployments',
    });
  }
});

/**
 * GET /api/deployment/:id/status
 * Get deployment status
 */
deploymentRouter.get('/:id/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const deployer = getUnifiedDeployer();

    const status = await deployer.getDeploymentStatus(id, userId);
    if (!status) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('[Deployment API] Status error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get deployment status',
    });
  }
});

/**
 * GET /api/deployment/:id/connection-code
 * Get connection code for a deployment
 */
deploymentRouter.get('/:id/connection-code', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const deployer = getUnifiedDeployer();

    const code = await deployer.getConnectionCode(id, userId);
    if (!code) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    res.json({
      success: true,
      data: code,
    });
  } catch (error) {
    console.error('[Deployment API] Connection code error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get connection code',
    });
  }
});

/**
 * DELETE /api/deployment/:id
 * Delete a deployment
 */
deploymentRouter.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const deployer = getUnifiedDeployer();

    await deployer.deleteDeployment(id, userId);

    res.json({
      success: true,
      message: 'Deployment deleted successfully',
    });
  } catch (error) {
    console.error('[Deployment API] Delete error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to delete deployment',
    });
  }
});

// =============================================================================
// BUILD LOOP RUNPOD DEPLOYMENT ENDPOINTS
// =============================================================================

const BuildDeploySchema = z.object({
  buildId: z.string(),
  projectId: z.string(),
  modelUrl: z.string().url(),
  modelType: z.enum(['llm', 'image', 'video', 'audio', 'embedding', 'multimodal']),
  modelName: z.string().optional(),
  gpuType: z.string().optional(),
  scalingConfig: z.object({
    minWorkers: z.number().min(0).default(0),
    maxWorkers: z.number().min(1).default(3),
    idleTimeout: z.number().min(60).default(300),
  }).optional(),
});

/**
 * GET /api/deployment/runpod/gpus
 * Get real-time RunPod GPU availability
 */
deploymentRouter.get('/runpod/gpus', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const availability = await getGPUAvailability(userId);

    res.json({
      success: true,
      data: availability,
    });
  } catch (error) {
    console.error('[Deployment API] GPU availability error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get GPU availability',
    });
  }
});

/**
 * GET /api/deployment/runpod/recommend
 * Get recommended GPU for a model type
 */
deploymentRouter.get('/runpod/recommend', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { modelType, preferSpeed } = req.query;
    const hooks = getBuildIntegrationHooks();

    // Estimate VRAM based on model type
    const vramMap: Record<string, number> = {
      'llm': 24,
      'image': 12,
      'video': 24,
      'audio': 8,
      'embedding': 4,
      'multimodal': 40,
    };
    const requiredVRAM = vramMap[modelType as string] || 16;

    const recommendation = hooks.getRecommendedRunPodGPU(
      requiredVRAM,
      preferSpeed !== 'false'
    );

    if (!recommendation) {
      return res.status(404).json({
        error: 'No suitable GPU available',
      });
    }

    res.json({
      success: true,
      data: recommendation,
    });
  } catch (error) {
    console.error('[Deployment API] GPU recommend error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get GPU recommendation',
    });
  }
});

/**
 * POST /api/deployment/runpod/build-deploy
 * Deploy a model to RunPod as part of build loop
 */
deploymentRouter.post('/runpod/build-deploy', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const config = BuildDeploySchema.parse(req.body);
    const hooks = getBuildIntegrationHooks();

    const request: RunPodDeploymentRequest = {
      buildId: config.buildId,
      userId,
      projectId: config.projectId,
      modelUrl: config.modelUrl,
      modelType: config.modelType,
      modelName: config.modelName,
      gpuType: config.gpuType,
      scalingConfig: config.scalingConfig,
    };

    const result = await hooks.deployToRunPod(request);

    // Return appropriate status based on approval requirement
    const statusCode = result.approvalRequired ? 202 : (result.success ? 201 : 400);

    res.status(statusCode).json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    console.error('[Deployment API] Build deploy error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to deploy model',
    });
  }
});

/**
 * POST /api/deployment/runpod/build-deploy/:allocationId/complete
 * Complete a pending RunPod deployment after user approval
 */
deploymentRouter.post('/runpod/build-deploy/:allocationId/complete', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { allocationId } = req.params;
    const config = BuildDeploySchema.parse(req.body);
    const hooks = getBuildIntegrationHooks();

    const request: RunPodDeploymentRequest = {
      buildId: config.buildId,
      userId,
      projectId: config.projectId,
      modelUrl: config.modelUrl,
      modelType: config.modelType,
      modelName: config.modelName,
      gpuType: config.gpuType,
      scalingConfig: config.scalingConfig,
    };

    const result = await hooks.completeRunPodDeploymentAfterApproval(
      config.buildId,
      allocationId,
      request
    );

    res.status(result.success ? 201 : 400).json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    console.error('[Deployment API] Complete deploy error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to complete deployment',
    });
  }
});

/**
 * GET /api/deployment/runpod/build/:buildId/status
 * Get RunPod deployment status for a build
 */
deploymentRouter.get('/runpod/build/:buildId/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { buildId } = req.params;
    const hooks = getBuildIntegrationHooks();

    const status = await hooks.getRunPodDeploymentStatus(buildId);

    if (!status) {
      return res.status(404).json({
        error: 'No deployment found for this build',
      });
    }

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('[Deployment API] Build status error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get deployment status',
    });
  }
});

/**
 * PUT /api/deployment/runpod/build/:buildId/scaling
 * Update scaling configuration for a RunPod deployment
 */
deploymentRouter.put('/runpod/build/:buildId/scaling', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { buildId } = req.params;
    const { minWorkers, maxWorkers } = req.body;

    if (typeof minWorkers !== 'number' || typeof maxWorkers !== 'number') {
      return res.status(400).json({
        error: 'minWorkers and maxWorkers are required',
      });
    }

    const hooks = getBuildIntegrationHooks();
    const result = await hooks.updateRunPodScaling(buildId, minWorkers, maxWorkers);

    if (!result.success) {
      return res.status(400).json({
        error: result.error || 'Failed to update scaling',
      });
    }

    res.json({
      success: true,
      message: 'Scaling updated successfully',
    });
  } catch (error) {
    console.error('[Deployment API] Update scaling error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to update scaling',
    });
  }
});

/**
 * DELETE /api/deployment/runpod/build/:buildId
 * Terminate a RunPod deployment for a build
 */
deploymentRouter.delete('/runpod/build/:buildId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { buildId } = req.params;
    const hooks = getBuildIntegrationHooks();

    const result = await hooks.terminateRunPodDeployment(buildId);

    if (!result.success) {
      return res.status(400).json({
        error: result.error || 'Failed to terminate deployment',
      });
    }

    res.json({
      success: true,
      message: 'Deployment terminated successfully',
    });
  } catch (error) {
    console.error('[Deployment API] Terminate error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to terminate deployment',
    });
  }
});

export { deploymentRouter };
export default deploymentRouter;
