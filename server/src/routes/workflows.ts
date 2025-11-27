/**
 * Workflow API Routes
 *
 * Endpoints for managing AI model workflows and deployments.
 */

import { Router } from 'express';
import { z } from 'zod';
import { getModelDiscoveryService } from '../services/discovery/model-discovery.js';
import { getWorkflowBuilderService } from '../services/workflow/workflow-builder.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const discoveryService = getModelDiscoveryService();
const workflowService = getWorkflowBuilderService();

// ============================================================================
// MODEL DISCOVERY
// ============================================================================

// Search for models
router.post('/models/search', async (req, res) => {
    const {
        requirement,
        taskType,
        sources,
        maxResults,
        minDownloads,
        preferOpenSource,
        maxVRAM,
        framework,
    } = req.body;

    try {
        const result = await discoveryService.searchModels({
            requirement,
            taskType,
            sources,
            maxResults,
            minDownloads,
            preferOpenSource,
            maxVRAM,
            framework,
        });

        res.status(200).json(result);
    } catch (error) {
        console.error('Error searching models:', error);
        res.status(500).json({
            message: 'Failed to search models',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Get model details from HuggingFace
// Use query parameter to avoid path-to-regexp issues with slashes in model IDs
router.get('/models/huggingface', async (req, res) => {
    // Model ID is passed as query parameter (e.g., ?id=org/model-name)
    const modelId = req.query.id as string;
    
    if (!modelId) {
        return res.status(400).json({ message: 'Model ID is required (use ?id=org/model-name)' });
    }

    try {
        const model = await discoveryService.getHuggingFaceModelInfo(modelId);

        if (!model) {
            return res.status(404).json({ message: 'Model not found' });
        }

        res.status(200).json(model);
    } catch (error) {
        console.error('Error getting model info:', error);
        res.status(500).json({
            message: 'Failed to get model info',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// WORKFLOW MANAGEMENT
// ============================================================================

// Create workflow from description
router.post('/workflows', async (req, res) => {
    const { description, preferredModels, maxCost, deploymentTarget } = req.body;

    try {
        const plan = await workflowService.createFromDescription(description, {
            preferredModels,
            maxCost,
            deploymentTarget,
        });

        res.status(201).json({ workflow: plan });
    } catch (error) {
        console.error('Error creating workflow:', error);
        res.status(500).json({
            message: 'Failed to create workflow',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Validate workflow
router.post('/workflows/validate', async (req, res) => {
    const { workflow, availableCredentials } = req.body;

    try {
        const validation = workflowService.validateWorkflow(workflow, availableCredentials || []);
        res.status(200).json(validation);
    } catch (error) {
        console.error('Error validating workflow:', error);
        res.status(500).json({
            message: 'Failed to validate workflow',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Apply modification to workflow
router.post('/workflows/modify', async (req, res) => {
    const { workflow, modification } = req.body;

    try {
        const updated = workflowService.applyModification(workflow, modification);
        res.status(200).json({ workflow: updated });
    } catch (error) {
        console.error('Error modifying workflow:', error);
        res.status(500).json({
            message: 'Failed to modify workflow',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Calculate workflow cost
router.post('/workflows/cost', async (req, res) => {
    const { workflow } = req.body;

    try {
        const cost = workflowService.calculateCost(workflow);
        res.status(200).json(cost);
    } catch (error) {
        console.error('Error calculating cost:', error);
        res.status(500).json({
            message: 'Failed to calculate cost',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Get execution order for workflow
router.post('/workflows/execution-order', async (req, res) => {
    const { workflow } = req.body;

    try {
        const order = workflowService.getExecutionOrder(workflow);
        res.status(200).json({ order: order.map(s => ({ id: s.id, name: s.name })) });
    } catch (error) {
        console.error('Error getting execution order:', error);
        res.status(500).json({
            message: 'Failed to get execution order',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// DEPLOYMENT ARTIFACTS
// ============================================================================

// Generate Dockerfile for workflow
router.post('/workflows/dockerfile', async (req, res) => {
    const { workflow } = req.body;

    try {
        const dockerfile = await workflowService.generateDockerfile(workflow);
        res.status(200).json({ dockerfile });
    } catch (error) {
        console.error('Error generating Dockerfile:', error);
        res.status(500).json({
            message: 'Failed to generate Dockerfile',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Generate requirements.txt for workflow
router.post('/workflows/requirements', async (req, res) => {
    const { workflow } = req.body;

    try {
        const requirements = workflowService.generateRequirements(workflow);
        res.status(200).json({ requirements });
    } catch (error) {
        console.error('Error generating requirements:', error);
        res.status(500).json({
            message: 'Failed to generate requirements',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

export default router;

