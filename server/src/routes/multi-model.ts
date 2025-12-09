/**
 * Multi-Model Orchestration & Serverless Inference API Routes
 *
 * Endpoints for managing multi-model configurations per project
 * and serverless inference endpoints.
 */

import { Router } from 'express';
import { getMultiModelOrchestrator, MultiModelRequest } from '../services/learning/multi-model-orchestrator.js';
import { getServerlessInferenceService, ServerlessDeploymentConfig } from '../services/learning/serverless-inference.js';
import { getBuilderModelNotifications } from '../services/learning/builder-model-notifications.js';
import { getKriptikGlobalTraining, TakeoverStatus } from '../services/learning/kriptik-global-training.js';

const router = Router();

// =============================================================================
// MULTI-MODEL ORCHESTRATION
// =============================================================================

/**
 * Configure multi-model for a project
 * POST /api/multi-model/projects/:projectId/configure
 */
router.post('/projects/:projectId/configure', async (req, res) => {
    try {
        const {
            userId,
            models,
            learningModelId,
            learningEnabled,
            routingStrategy,
            conflictResolution,
        } = req.body;

        const orchestrator = getMultiModelOrchestrator();
        const config = await orchestrator.configureProject({
            projectId: req.params.projectId,
            userId,
            models,
            learningModelId,
            learningEnabled,
            routingStrategy,
            conflictResolution,
        });

        res.json({ success: true, config });
    } catch (error) {
        console.error('[API] Error configuring multi-model:', error);
        res.status(500).json({ error: 'Failed to configure multi-model' });
    }
});

/**
 * Get project multi-model configuration
 * GET /api/multi-model/projects/:projectId
 */
router.get('/projects/:projectId', async (req, res) => {
    try {
        const orchestrator = getMultiModelOrchestrator();
        const config = await orchestrator.getProjectConfig(req.params.projectId);

        if (!config) {
            return res.status(404).json({ error: 'Project not configured' });
        }

        res.json({ success: true, config });
    } catch (error) {
        console.error('[API] Error fetching config:', error);
        res.status(500).json({ error: 'Failed to fetch config' });
    }
});

/**
 * Add model to project multi-model setup
 * POST /api/multi-model/projects/:projectId/models
 */
router.post('/projects/:projectId/models', async (req, res) => {
    try {
        const orchestrator = getMultiModelOrchestrator();
        const slot = await orchestrator.addModelToProject(req.params.projectId, req.body);
        res.status(201).json({ success: true, slot });
    } catch (error) {
        console.error('[API] Error adding model:', error);
        res.status(500).json({ error: 'Failed to add model' });
    }
});

/**
 * Remove model from project
 * DELETE /api/multi-model/projects/:projectId/models/:modelId
 */
router.delete('/projects/:projectId/models/:modelId', async (req, res) => {
    try {
        const orchestrator = getMultiModelOrchestrator();
        await orchestrator.removeModelFromProject(req.params.projectId, req.params.modelId);
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Error removing model:', error);
        res.status(500).json({ error: 'Failed to remove model' });
    }
});

/**
 * Update model weight
 * PATCH /api/multi-model/projects/:projectId/models/:modelId/weight
 */
router.patch('/projects/:projectId/models/:modelId/weight', async (req, res) => {
    try {
        const { weight } = req.body;

        const orchestrator = getMultiModelOrchestrator();
        await orchestrator.updateModelWeight(req.params.projectId, req.params.modelId, weight);
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Error updating weight:', error);
        res.status(500).json({ error: 'Failed to update weight' });
    }
});

/**
 * Toggle model enabled/disabled
 * PATCH /api/multi-model/projects/:projectId/models/:modelId/toggle
 */
router.patch('/projects/:projectId/models/:modelId/toggle', async (req, res) => {
    try {
        const { enabled } = req.body;

        const orchestrator = getMultiModelOrchestrator();
        await orchestrator.toggleModel(req.params.projectId, req.params.modelId, enabled);
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Error toggling model:', error);
        res.status(500).json({ error: 'Failed to toggle model' });
    }
});

/**
 * Process a multi-model request
 * POST /api/multi-model/inference
 */
router.post('/inference', async (req, res) => {
    try {
        const request: MultiModelRequest = {
            id: req.body.id || `req-${Date.now()}`,
            projectId: req.body.projectId,
            userId: req.body.userId,
            type: req.body.type || 'general',
            prompt: req.body.prompt,
            context: req.body.context,
            options: req.body.options,
        };

        const orchestrator = getMultiModelOrchestrator();
        const response = await orchestrator.processRequest(request);
        res.json({ success: true, response });
    } catch (error) {
        console.error('[API] Error processing request:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

// =============================================================================
// SERVERLESS INFERENCE
// =============================================================================

/**
 * Deploy a model to serverless
 * POST /api/multi-model/serverless/deploy
 */
router.post('/serverless/deploy', async (req, res) => {
    try {
        const config: ServerlessDeploymentConfig = req.body;

        const service = getServerlessInferenceService();
        const endpoint = await service.deployModel(config);
        res.status(201).json({ success: true, endpoint });
    } catch (error) {
        console.error('[API] Error deploying model:', error);
        res.status(500).json({ error: 'Failed to deploy model' });
    }
});

/**
 * Get all inference endpoints
 * GET /api/multi-model/serverless/endpoints
 */
router.get('/serverless/endpoints', async (req, res) => {
    try {
        const service = getServerlessInferenceService();
        const endpoints = service.getEndpoints();
        res.json({ success: true, endpoints });
    } catch (error) {
        console.error('[API] Error fetching endpoints:', error);
        res.status(500).json({ error: 'Failed to fetch endpoints' });
    }
});

/**
 * Get a specific endpoint
 * GET /api/multi-model/serverless/endpoints/:endpointId
 */
router.get('/serverless/endpoints/:endpointId', async (req, res) => {
    try {
        const service = getServerlessInferenceService();
        const endpoint = service.getEndpoint(req.params.endpointId);

        if (!endpoint) {
            return res.status(404).json({ error: 'Endpoint not found' });
        }

        res.json({ success: true, endpoint });
    } catch (error) {
        console.error('[API] Error fetching endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch endpoint' });
    }
});

/**
 * Get endpoint metrics
 * GET /api/multi-model/serverless/endpoints/:endpointId/metrics
 */
router.get('/serverless/endpoints/:endpointId/metrics', async (req, res) => {
    try {
        const service = getServerlessInferenceService();
        const metrics = service.getMetrics(req.params.endpointId);

        if (!metrics) {
            return res.status(404).json({ error: 'Metrics not found' });
        }

        res.json({ success: true, metrics });
    } catch (error) {
        console.error('[API] Error fetching metrics:', error);
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

/**
 * Scale an endpoint
 * POST /api/multi-model/serverless/endpoints/:endpointId/scale
 */
router.post('/serverless/endpoints/:endpointId/scale', async (req, res) => {
    try {
        const { minWorkers, maxWorkers } = req.body;

        const service = getServerlessInferenceService();
        await service.scaleEndpoint(req.params.endpointId, minWorkers, maxWorkers);
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Error scaling endpoint:', error);
        res.status(500).json({ error: 'Failed to scale endpoint' });
    }
});

/**
 * Delete an endpoint
 * DELETE /api/multi-model/serverless/endpoints/:endpointId
 */
router.delete('/serverless/endpoints/:endpointId', async (req, res) => {
    try {
        const service = getServerlessInferenceService();
        await service.deleteEndpoint(req.params.endpointId);
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Error deleting endpoint:', error);
        res.status(500).json({ error: 'Failed to delete endpoint' });
    }
});

/**
 * Run inference on an endpoint
 * POST /api/multi-model/serverless/endpoints/:endpointId/infer
 */
router.post('/serverless/endpoints/:endpointId/infer', async (req, res) => {
    try {
        const { prompt, systemPrompt, maxTokens, temperature, stream, userId, projectId, priority } = req.body;

        const service = getServerlessInferenceService();
        const response = await service.infer({
            id: `inf-${Date.now()}`,
            endpointId: req.params.endpointId,
            prompt,
            systemPrompt,
            maxTokens,
            temperature,
            stream,
            userId,
            projectId,
            priority,
        });

        res.json({ success: true, response });
    } catch (error) {
        console.error('[API] Error running inference:', error);
        res.status(500).json({ error: 'Failed to run inference' });
    }
});

// =============================================================================
// BUILDER NOTIFICATIONS
// =============================================================================

/**
 * Record builder interaction (triggers notifications)
 * POST /api/multi-model/builder/:projectId/interaction
 */
router.post('/builder/:projectId/interaction', async (req, res) => {
    try {
        const { userId, interactionType, context } = req.body;

        const notifications = getBuilderModelNotifications();
        const notification = await notifications.recordInteraction({
            projectId: req.params.projectId,
            userId,
            interactionType,
            context,
        });

        res.json({ success: true, notification });
    } catch (error) {
        console.error('[API] Error recording interaction:', error);
        res.status(500).json({ error: 'Failed to record interaction' });
    }
});

/**
 * Get notifications for a project
 * GET /api/multi-model/builder/:projectId/notifications
 */
router.get('/builder/:projectId/notifications', async (req, res) => {
    try {
        const includeExpired = req.query.includeExpired === 'true';

        const notificationService = getBuilderModelNotifications();
        const notifications = notificationService.getNotifications(req.params.projectId, includeExpired);
        res.json({ success: true, notifications });
    } catch (error) {
        console.error('[API] Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

/**
 * Dismiss a notification
 * POST /api/multi-model/builder/:projectId/notifications/:notificationId/dismiss
 */
router.post('/builder/:projectId/notifications/:notificationId/dismiss', async (req, res) => {
    try {
        const notificationService = getBuilderModelNotifications();
        notificationService.dismissNotification(req.params.projectId, req.params.notificationId);
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Error dismissing notification:', error);
        res.status(500).json({ error: 'Failed to dismiss notification' });
    }
});

/**
 * Handle notification action
 * POST /api/multi-model/builder/:projectId/notifications/:notificationId/action
 */
router.post('/builder/:projectId/notifications/:notificationId/action', async (req, res) => {
    try {
        const { actionId } = req.body;

        const notificationService = getBuilderModelNotifications();
        const result = await notificationService.handleAction(
            req.params.projectId,
            req.params.notificationId,
            actionId
        );

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[API] Error handling action:', error);
        res.status(500).json({ error: 'Failed to handle action' });
    }
});

/**
 * Get project notification state
 * GET /api/multi-model/builder/:projectId/state
 */
router.get('/builder/:projectId/state', async (req, res) => {
    try {
        const notificationService = getBuilderModelNotifications();
        const state = notificationService.getProjectState(req.params.projectId);
        res.json({ success: true, state });
    } catch (error) {
        console.error('[API] Error fetching state:', error);
        res.status(500).json({ error: 'Failed to fetch state' });
    }
});

// =============================================================================
// GLOBAL TRAINING & TAKEOVER
// =============================================================================

/**
 * Get global training stats
 * GET /api/multi-model/global/stats
 */
router.get('/global/stats', async (req, res) => {
    try {
        const globalTraining = getKriptikGlobalTraining();
        const stats = globalTraining.getStats();
        res.json({ success: true, stats });
    } catch (error) {
        console.error('[API] Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

/**
 * Get training runs
 * GET /api/multi-model/global/runs
 */
router.get('/global/runs', async (req, res) => {
    try {
        const modelType = req.query.modelType as string | undefined;

        const globalTraining = getKriptikGlobalTraining();
        const runs = globalTraining.getTrainingRuns(modelType as any);
        res.json({ success: true, runs });
    } catch (error) {
        console.error('[API] Error fetching runs:', error);
        res.status(500).json({ error: 'Failed to fetch runs' });
    }
});

/**
 * Get takeover status
 * GET /api/multi-model/global/takeover
 */
router.get('/global/takeover', async (req, res) => {
    try {
        const globalTraining = getKriptikGlobalTraining();
        const statuses = globalTraining.getAllTakeoverStatuses();
        res.json({ success: true, statuses });
    } catch (error) {
        console.error('[API] Error fetching takeover status:', error);
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

/**
 * Get takeover status for specific model
 * GET /api/multi-model/global/takeover/:modelType
 */
router.get('/global/takeover/:modelType', async (req, res) => {
    try {
        const globalTraining = getKriptikGlobalTraining();
        const status = globalTraining.getTakeoverStatus(req.params.modelType as any);

        if (!status) {
            return res.status(404).json({ error: 'Model type not found' });
        }

        res.json({ success: true, status });
    } catch (error) {
        console.error('[API] Error fetching takeover status:', error);
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

/**
 * Ingest data for global training
 * POST /api/multi-model/global/ingest
 */
router.post('/global/ingest', async (req, res) => {
    try {
        const { domain, prompt, response, alternativeResponse, quality, accepted, metadata } = req.body;

        const globalTraining = getKriptikGlobalTraining();
        await globalTraining.ingestData({
            domain,
            prompt,
            response,
            alternativeResponse,
            quality,
            accepted,
            metadata,
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[API] Error ingesting data:', error);
        res.status(500).json({ error: 'Failed to ingest data' });
    }
});

/**
 * Start global training service
 * POST /api/multi-model/global/start
 */
router.post('/global/start', async (req, res) => {
    try {
        const globalTraining = getKriptikGlobalTraining();
        await globalTraining.start();
        res.json({ success: true, message: 'Global training service started' });
    } catch (error) {
        console.error('[API] Error starting service:', error);
        res.status(500).json({ error: 'Failed to start service' });
    }
});

/**
 * Stop global training service
 * POST /api/multi-model/global/stop
 */
router.post('/global/stop', async (req, res) => {
    try {
        const globalTraining = getKriptikGlobalTraining();
        await globalTraining.stop();
        res.json({ success: true, message: 'Global training service stopped' });
    } catch (error) {
        console.error('[API] Error stopping service:', error);
        res.status(500).json({ error: 'Failed to stop service' });
    }
});

export default router;
