/**
 * Endpoints API Routes
 * 
 * Manage deployed inference endpoints.
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 5).
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { endpointDeployer, DeploymentConfig } from '../services/ml/endpoint-deployer.js';

const router = Router();

/**
 * GET /api/endpoints
 * List all endpoints for the authenticated user
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const endpoints = await endpointDeployer.listEndpoints(userId);
    
    res.json({
      success: true,
      endpoints,
    });
  } catch (error) {
    console.error('Error listing endpoints:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list endpoints',
    });
  }
});

/**
 * GET /api/endpoints/:id
 * Get a specific endpoint
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const endpoint = await endpointDeployer.getEndpoint(req.params.id, userId);
    
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found',
      });
    }
    
    res.json({
      success: true,
      endpoint,
    });
  } catch (error) {
    console.error('Error getting endpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get endpoint',
    });
  }
});

/**
 * POST /api/endpoints
 * Deploy a new endpoint
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { projectId, ...config } = req.body as { projectId?: string } & DeploymentConfig;
    
    // Validate required fields
    if (!config.modelId || !config.modelName || !config.gpuType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: modelId, modelName, gpuType',
      });
    }
    
    const endpoint = await endpointDeployer.deployEndpoint(
      userId,
      projectId || 'default',
      {
        modelId: config.modelId,
        modelName: config.modelName,
        gpuType: config.gpuType,
        minWorkers: config.minWorkers || 0,
        maxWorkers: config.maxWorkers || 3,
        idleTimeout: config.idleTimeout || 300,
        customEnvVars: config.customEnvVars || {},
        volumePersistence: config.volumePersistence ?? true,
        volumeSizeGB: config.volumeSizeGB || 20,
      }
    );
    
    res.json({
      success: true,
      endpoint,
    });
  } catch (error) {
    console.error('Error deploying endpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deploy endpoint',
    });
  }
});

/**
 * POST /api/endpoints/:id/test
 * Test an endpoint
 */
router.post('/:id/test', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { prompt, max_tokens, temperature } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: prompt',
      });
    }
    
    const result = await endpointDeployer.testEndpoint(
      req.params.id,
      userId,
      prompt,
      max_tokens || 256,
      temperature || 0.7
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error testing endpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test endpoint',
    });
  }
});

/**
 * POST /api/endpoints/:id/confirm
 * Confirm an endpoint (keep after test period)
 */
router.post('/:id/confirm', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    await endpointDeployer.confirmEndpoint(req.params.id, userId);
    
    res.json({
      success: true,
      message: 'Endpoint confirmed',
    });
  } catch (error) {
    console.error('Error confirming endpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to confirm endpoint',
    });
  }
});

/**
 * POST /api/endpoints/:id/start
 * Start a stopped endpoint
 */
router.post('/:id/start', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    await endpointDeployer.startEndpoint(req.params.id, userId);
    
    res.json({
      success: true,
      message: 'Endpoint starting',
    });
  } catch (error) {
    console.error('Error starting endpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start endpoint',
    });
  }
});

/**
 * POST /api/endpoints/:id/stop
 * Stop an endpoint
 */
router.post('/:id/stop', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    await endpointDeployer.stopEndpoint(req.params.id, userId);
    
    res.json({
      success: true,
      message: 'Endpoint stopped',
    });
  } catch (error) {
    console.error('Error stopping endpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to stop endpoint',
    });
  }
});

/**
 * DELETE /api/endpoints/:id
 * Delete an endpoint
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    await endpointDeployer.deleteEndpoint(req.params.id, userId);
    
    res.json({
      success: true,
      message: 'Endpoint deleted',
    });
  } catch (error) {
    console.error('Error deleting endpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete endpoint',
    });
  }
});

export default router;
