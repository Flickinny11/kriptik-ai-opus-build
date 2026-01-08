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

export { deploymentRouter };
export default deploymentRouter;
