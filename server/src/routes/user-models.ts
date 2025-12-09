/**
 * User Models API Routes
 *
 * Endpoints for managing user-specific personalized models,
 * marketplace interactions, multi-model orchestration, and
 * builder notifications.
 */

import { Router } from 'express';
import { getUserModelManager, UserModel, ModelSuggestion } from '../services/learning/user-model-manager.js';
import { getModelMarketplace, MarketplaceModel, MarketplaceCategory, MarketplaceSearchFilters } from '../services/learning/model-marketplace.js';
import { getMultiModelOrchestrator, ProjectModelConfig, ModelSlot } from '../services/learning/multi-model-orchestrator.js';
import { getBuilderModelNotifications, BuilderNotification } from '../services/learning/builder-model-notifications.js';
import { getServerlessInferenceService, InferenceEndpoint, ServerlessDeploymentConfig } from '../services/learning/serverless-inference.js';
import { getKriptikGlobalTraining, TakeoverStatus } from '../services/learning/kriptik-global-training.js';

const router = Router();

// =============================================================================
// USER MODEL MANAGEMENT
// =============================================================================

/**
 * Create a new user model
 * POST /api/user-models
 */
router.post('/', async (req, res) => {
    try {
        const { userId, name, description, baseModelId, projectId } = req.body;

        if (!userId || !name) {
            return res.status(400).json({ error: 'userId and name are required' });
        }

        const manager = getUserModelManager();
        const model = await manager.createModel({
            userId,
            name,
            description,
            baseModelId,
            projectId,
        });

        res.status(201).json({ success: true, model });
    } catch (error) {
        console.error('[API] Error creating model:', error);
        res.status(500).json({ error: 'Failed to create model' });
    }
});

/**
 * Get user's models
 * GET /api/user-models/user/:userId
 */
router.get('/user/:userId', async (req, res) => {
    try {
        const manager = getUserModelManager();
        const models = await manager.getUserModels(req.params.userId);
        res.json({ success: true, models });
    } catch (error) {
        console.error('[API] Error fetching user models:', error);
        res.status(500).json({ error: 'Failed to fetch models' });
    }
});

/**
 * Get a specific model
 * GET /api/user-models/:modelId
 */
router.get('/:modelId', async (req, res) => {
    try {
        const manager = getUserModelManager();
        const model = await manager.getModel(req.params.modelId);

        if (!model) {
            return res.status(404).json({ error: 'Model not found' });
        }

        res.json({ success: true, model });
    } catch (error) {
        console.error('[API] Error fetching model:', error);
        res.status(500).json({ error: 'Failed to fetch model' });
    }
});

/**
 * Update model preferences
 * PATCH /api/user-models/:modelId/preferences
 */
router.patch('/:modelId/preferences', async (req, res) => {
    try {
        const manager = getUserModelManager();
        await manager.updateModelPreferences(req.params.modelId, req.body);
        const model = await manager.getModel(req.params.modelId);
        res.json({ success: true, model });
    } catch (error) {
        console.error('[API] Error updating preferences:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

/**
 * Delete a model
 * DELETE /api/user-models/:modelId
 */
router.delete('/:modelId', async (req, res) => {
    try {
        const manager = getUserModelManager();
        await manager.deleteModel(req.params.modelId);
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Error deleting model:', error);
        res.status(500).json({ error: 'Failed to delete model' });
    }
});

/**
 * Record an interaction for training
 * POST /api/user-models/:modelId/interactions
 */
router.post('/:modelId/interactions', async (req, res) => {
    try {
        const { userId, projectId, type, context, input, output, userFeedback, modifiedOutput } = req.body;

        const manager = getUserModelManager();
        await manager.recordInteraction({
            userId,
            modelId: req.params.modelId,
            projectId,
            type,
            context,
            input,
            output,
            userFeedback,
            modifiedOutput,
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[API] Error recording interaction:', error);
        res.status(500).json({ error: 'Failed to record interaction' });
    }
});

/**
 * Trigger training for a model
 * POST /api/user-models/:modelId/train
 */
router.post('/:modelId/train', async (req, res) => {
    try {
        const manager = getUserModelManager();
        const result = await manager.triggerTraining(req.params.modelId);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[API] Error triggering training:', error);
        res.status(500).json({ error: 'Failed to trigger training' });
    }
});

/**
 * Get model suggestions for a project
 * POST /api/user-models/suggestions
 */
router.post('/suggestions', async (req, res) => {
    try {
        const { userId, projectType, projectDescription, technologies } = req.body;

        const manager = getUserModelManager();
        const suggestions = await manager.suggestModelsForProject({
            userId,
            projectType,
            projectDescription,
            technologies,
        });

        res.json({ success: true, suggestions });
    } catch (error) {
        console.error('[API] Error getting suggestions:', error);
        res.status(500).json({ error: 'Failed to get suggestions' });
    }
});

/**
 * Get assistive suggestions for inexperienced users
 * POST /api/user-models/:modelId/assistive
 */
router.post('/:modelId/assistive', async (req, res) => {
    try {
        const { code, cursorPosition, filename } = req.body;

        const manager = getUserModelManager();
        const suggestions = await manager.getAssistiveSuggestions(req.params.modelId, {
            code,
            cursorPosition,
            filename,
        });

        res.json({ success: true, ...suggestions });
    } catch (error) {
        console.error('[API] Error getting assistive suggestions:', error);
        res.status(500).json({ error: 'Failed to get suggestions' });
    }
});

// =============================================================================
// PROJECT MODEL ASSOCIATIONS
// =============================================================================

/**
 * Associate model with project
 * POST /api/user-models/projects/:projectId/models
 */
router.post('/projects/:projectId/models', async (req, res) => {
    try {
        const { modelId, role, isTraining, specialization } = req.body;

        const manager = getUserModelManager();
        const association = await manager.associateModelWithProject(
            req.params.projectId,
            modelId,
            role,
            isTraining,
            specialization
        );

        res.json({ success: true, association });
    } catch (error) {
        console.error('[API] Error associating model:', error);
        res.status(500).json({ error: 'Failed to associate model' });
    }
});

/**
 * Get models for a project
 * GET /api/user-models/projects/:projectId/models
 */
router.get('/projects/:projectId/models', async (req, res) => {
    try {
        const manager = getUserModelManager();
        const models = await manager.getProjectModels(req.params.projectId);
        res.json({ success: true, models });
    } catch (error) {
        console.error('[API] Error fetching project models:', error);
        res.status(500).json({ error: 'Failed to fetch models' });
    }
});

/**
 * Remove model from project
 * DELETE /api/user-models/projects/:projectId/models/:modelId
 */
router.delete('/projects/:projectId/models/:modelId', async (req, res) => {
    try {
        const manager = getUserModelManager();
        await manager.removeModelFromProject(req.params.projectId, req.params.modelId);
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Error removing model:', error);
        res.status(500).json({ error: 'Failed to remove model' });
    }
});

export default router;
