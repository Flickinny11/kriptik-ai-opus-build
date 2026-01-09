/**
 * Endpoints API Routes
 *
 * Manage deployed inference endpoints.
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 5).
 * Extended for Auto-Deploy Private Endpoints (PROMPT 10).
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { endpointDeployer, DeploymentConfig } from '../services/ml/endpoint-deployer.js';
import { createEndpointRegistry, EndpointInfo } from '../services/deployment/endpoint-registry.js';
import { getAutoDeployer } from '../services/deployment/auto-deployer.js';

const router = Router();

// =============================================================================
// USER ENDPOINTS (Auto-Deploy Private Endpoints)
// =============================================================================

/**
 * GET /api/endpoints/user
 * List all user's private endpoints (for Connect Dropdown)
 */
router.get('/user', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { modality, status, sourceType } = req.query;

    const registry = createEndpointRegistry(userId);
    const endpoints = await registry.listUserEndpoints({
      modality: modality as string | undefined,
      status: status as string | undefined,
      sourceType: sourceType as string | undefined,
    });

    res.json({
      success: true,
      endpoints,
    });
  } catch (error) {
    console.error('[Endpoints] Error listing user endpoints:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list endpoints',
    });
  }
});

/**
 * GET /api/endpoints/summary
 * Get summary stats for all user's endpoints
 */
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const registry = createEndpointRegistry(userId);
    const endpoints = await registry.listUserEndpoints();

    // Calculate summary stats
    const summary = {
      totalEndpoints: endpoints.length,
      activeEndpoints: endpoints.filter((ep: EndpointInfo) => ep.status === 'active').length,
      idleEndpoints: endpoints.filter((ep: EndpointInfo) => ep.status === 'idle').length,
      errorEndpoints: endpoints.filter((ep: EndpointInfo) => ep.status === 'error').length,
      byModality: {} as Record<string, number>,
      byProvider: { runpod: 0, modal: 0 } as Record<string, number>,
    };

    for (const ep of endpoints) {
      summary.byModality[ep.modality] = (summary.byModality[ep.modality] || 0) + 1;
      summary.byProvider[ep.provider] = (summary.byProvider[ep.provider] || 0) + 1;
    }

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('[Endpoints] Error getting summary:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get summary',
    });
  }
});

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

    // Try both the old deployer and new registry
    const oldEndpoint = await endpointDeployer.getEndpoint(req.params.id, userId);

    if (oldEndpoint) {
      return res.json({
        success: true,
        endpoint: oldEndpoint,
      });
    }

    // Try new registry (user-scoped, already filtered by user)
    const registry = createEndpointRegistry(userId);
    const newEndpoint = await registry.getEndpoint(req.params.id);

    if (!newEndpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found',
      });
    }

    res.json({
      success: true,
      endpoint: newEndpoint,
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
 * GET /api/endpoints/:id/connection
 * Get connection info with code samples
 */
router.get('/:id/connection', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const registry = createEndpointRegistry(userId);

    // Registry is user-scoped, getEndpoint already filters by user
    const endpoint = await registry.getEndpoint(req.params.id);
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found',
      });
    }

    const connection = await registry.getConnectionInfo(req.params.id);

    res.json({
      success: true,
      connection,
    });
  } catch (error) {
    console.error('[Endpoints] Error getting connection info:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get connection info',
    });
  }
});

/**
 * GET /api/endpoints/:id/keys
 * List API keys for an endpoint
 */
router.get('/:id/keys', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const registry = createEndpointRegistry(userId);

    // Verify ownership
    const endpoint = await registry.getEndpoint(req.params.id);
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found',
      });
    }

    const keys = await registry.listApiKeys(req.params.id);

    res.json({
      success: true,
      keys,
    });
  } catch (error) {
    console.error('[Endpoints] Error listing API keys:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list API keys',
    });
  }
});

/**
 * POST /api/endpoints/:id/keys
 * Generate a new API key
 */
router.post('/:id/keys', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { keyName } = req.body;
    const registry = createEndpointRegistry(userId);

    // Verify ownership
    const endpoint = await registry.getEndpoint(req.params.id);
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found',
      });
    }

    const { apiKey, keyInfo } = await registry.generateApiKey(req.params.id, keyName);

    res.json({
      success: true,
      apiKey, // Full key only shown once
      keyInfo,
    });
  } catch (error) {
    console.error('[Endpoints] Error generating API key:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate API key',
    });
  }
});

/**
 * DELETE /api/endpoints/:id/keys/:keyId
 * Revoke an API key
 */
router.delete('/:id/keys/:keyId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const registry = createEndpointRegistry(userId);

    // Verify ownership
    const endpoint = await registry.getEndpoint(req.params.id);
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found',
      });
    }

    await registry.revokeApiKey(req.params.keyId);

    res.json({
      success: true,
      message: 'API key revoked',
    });
  } catch (error) {
    console.error('[Endpoints] Error revoking API key:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revoke API key',
    });
  }
});

/**
 * GET /api/endpoints/:id/usage
 * Get usage stats for an endpoint
 */
router.get('/:id/usage', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { period = 'day' } = req.query;
    const registry = createEndpointRegistry(userId);

    // Verify ownership
    const endpoint = await registry.getEndpoint(req.params.id);
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found',
      });
    }

    const usage = await registry.getUsageStats(req.params.id, period as 'day' | 'week' | 'month');

    res.json({
      success: true,
      usage,
    });
  } catch (error) {
    console.error('[Endpoints] Error getting usage stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get usage stats',
    });
  }
});

/**
 * POST /api/endpoints/:id/redeploy
 * Redeploy a failed endpoint
 */
router.post('/:id/redeploy', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const registry = createEndpointRegistry(userId);

    // Verify ownership
    const endpoint = await registry.getEndpoint(req.params.id);
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found',
      });
    }

    const autoDeployer = getAutoDeployer();
    const result = await autoDeployer.redeployEndpoint(req.params.id, userId);

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('[Endpoints] Error redeploying endpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to redeploy endpoint',
    });
  }
});

/**
 * PATCH /api/endpoints/:id
 * Update endpoint settings
 */
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { minWorkers, maxWorkers, idleTimeoutSeconds } = req.body;
    const registry = createEndpointRegistry(userId);

    // Verify ownership
    const endpoint = await registry.getEndpoint(req.params.id);
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found',
      });
    }

    await registry.updateEndpointSettings(req.params.id, {
      minWorkers,
      maxWorkers,
      idleTimeoutSeconds,
    });

    res.json({
      success: true,
      message: 'Endpoint settings updated',
    });
  } catch (error) {
    console.error('[Endpoints] Error updating endpoint settings:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update endpoint settings',
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
