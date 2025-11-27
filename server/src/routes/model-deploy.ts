/**
 * Model Deployment API Routes
 *
 * Unified API for deploying AI models and workflows via:
 * - Replicate (pre-trained models, custom deployments)
 * - Modal Labs (Python functions, GPU inference)
 * - Fal.ai (generative AI, zero cold starts)
 *
 * Users describe their requirements in natural language,
 * and we select the optimal platform and configuration.
 */

import { Router, Request, Response } from 'express';
import { createReplicateService, REPLICATE_POPULAR_MODELS, ReplicateService } from '../services/cloud/replicate.js';
import { createModalService, MODAL_TEMPLATES, ModalService } from '../services/cloud/modal.js';
import { createFalService, FAL_MODELS, FalService } from '../services/cloud/fal.js';
import { getCredentialVault } from '../services/security/credential-vault.js';
import { ClaudeService, createClaudeService } from '../services/ai/claude-service.js';

const router = Router();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getReplicateForUser(userId: string): Promise<ReplicateService | null> {
    const vault = getCredentialVault();
    const creds = await vault.getCredential(userId, 'replicate');
    const apiToken = (creds?.data?.apiToken as string) || process.env.REPLICATE_API_TOKEN;
    if (!apiToken) return null;
    return createReplicateService({ apiToken });
}

async function getModalForUser(userId: string): Promise<ModalService | null> {
    const vault = getCredentialVault();
    const creds = await vault.getCredential(userId, 'modal');
    const tokenId = (creds?.data?.tokenId as string) || process.env.MODAL_TOKEN_ID;
    const tokenSecret = (creds?.data?.tokenSecret as string) || process.env.MODAL_TOKEN_SECRET;
    if (!tokenId || !tokenSecret) return null;
    return createModalService({ tokenId, tokenSecret });
}

async function getFalForUser(userId: string): Promise<FalService | null> {
    const vault = getCredentialVault();
    const creds = await vault.getCredential(userId, 'fal');
    const apiKey = (creds?.data?.apiKey as string) || process.env.FAL_KEY;
    if (!apiKey) return null;
    return createFalService({ apiKey });
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/model-deploy/providers
 * Get available model deployment providers and their status
 */
router.get('/providers', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;

    const providers = {
        replicate: {
            name: 'Replicate',
            description: 'Pre-trained models with custom deployments',
            configured: false,
            models: Object.keys(REPLICATE_POPULAR_MODELS).length,
            categories: ['image-generation', 'video-generation', 'audio-generation', 'image-processing', 'language-model'],
        },
        modal: {
            name: 'Modal Labs',
            description: 'Python functions with GPU inference',
            configured: false,
            templates: Object.keys(MODAL_TEMPLATES).length,
            features: ['auto-scaling', 'custom-containers', 'zero-downtime-deployments'],
        },
        fal: {
            name: 'Fal.ai',
            description: 'Generative AI with zero cold starts',
            configured: false,
            models: Object.keys(FAL_MODELS).length,
            features: ['instant-inference', 'serverless', 'pre-built-models'],
        },
    };

    if (userId) {
        providers.replicate.configured = !!(await getReplicateForUser(userId));
        providers.modal.configured = !!(await getModalForUser(userId));
        providers.fal.configured = !!(await getFalForUser(userId));
    }

    res.json({ providers });
});

/**
 * GET /api/model-deploy/models
 * List available models across all providers
 */
router.get('/models', async (req: Request, res: Response) => {
    const { category, provider } = req.query;

    const models: Array<{
        id: string;
        name: string;
        description: string;
        provider: string;
        category: string;
    }> = [];

    // Replicate models
    if (!provider || provider === 'replicate') {
        for (const [id, model] of Object.entries(REPLICATE_POPULAR_MODELS)) {
            if (!category || model.category === category) {
                models.push({
                    id: `replicate/${id}`,
                    name: id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                    description: model.description,
                    provider: 'replicate',
                    category: model.category,
                });
            }
        }
    }

    // Fal models
    if (!provider || provider === 'fal') {
        for (const [id, model] of Object.entries(FAL_MODELS)) {
            if (!category || model.category === category) {
                models.push({
                    id: `fal/${id}`,
                    name: model.name,
                    description: model.description,
                    provider: 'fal',
                    category: model.category,
                });
            }
        }
    }

    // Modal templates
    if (!provider || provider === 'modal') {
        for (const [id, template] of Object.entries(MODAL_TEMPLATES)) {
            models.push({
                id: `modal/${id}`,
                name: template.name,
                description: template.description,
                provider: 'modal',
                category: id,
            });
        }
    }

    res.json({ models, total: models.length });
});

/**
 * POST /api/model-deploy/analyze
 * Analyze user requirements and recommend deployment configuration
 */
router.post('/analyze', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { prompt, projectId } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        const claude = createClaudeService({
            projectId: projectId || 'model-deploy',
            userId: userId || 'anonymous',
            agentType: 'planning',
        });

        const analysisPrompt = `Analyze this AI model deployment request and recommend the best configuration:

USER REQUEST: ${prompt}

Available providers:
1. Replicate - Best for: Pre-trained models, quick deployment, image/video/audio generation
   Models: ${Object.keys(REPLICATE_POPULAR_MODELS).join(', ')}

2. Modal Labs - Best for: Custom Python code, long-running tasks, complex pipelines
   Templates: image-generation, video-generation, audio-generation, llm-inference

3. Fal.ai - Best for: Fastest inference, zero cold starts, FLUX image generation
   Models: ${Object.keys(FAL_MODELS).join(', ')}

Respond with JSON:
{
  "recommendedProvider": "replicate" | "modal" | "fal",
  "recommendedModel": "model-id",
  "reason": "Why this choice is optimal",
  "configuration": {
    "hardware": "GPU type if needed",
    "minInstances": number,
    "maxInstances": number,
    "estimatedCostPerRequest": number,
    "estimatedMonthlyCost": number
  },
  "workflow": {
    "description": "What the deployment will do",
    "inputs": ["required inputs"],
    "outputs": ["expected outputs"]
  },
  "alternativeProviders": [
    { "provider": "...", "reason": "..." }
  ]
}`;

        const response = await claude.generate(analysisPrompt);
        
        // Parse JSON from response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse AI response');
        }

        const analysis = JSON.parse(jsonMatch[0]);

        res.json({
            success: true,
            analysis,
            availableCredentials: {
                replicate: !!(await getReplicateForUser(userId)),
                modal: !!(await getModalForUser(userId)),
                fal: !!(await getFalForUser(userId)),
            },
        });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({
            error: 'Failed to analyze deployment request',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/model-deploy/replicate/deploy
 * Create a Replicate deployment
 */
router.post('/replicate/deploy', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { name, model, version, hardware, minInstances, maxInstances, projectId } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!name || !model) {
        return res.status(400).json({ error: 'Name and model are required' });
    }

    const replicate = await getReplicateForUser(userId);
    if (!replicate) {
        return res.status(400).json({
            error: 'Replicate not configured',
            missingCredential: 'replicate',
        });
    }

    try {
        const deployment = await replicate.createDeployment({
            name,
            model,
            version: version || 'latest',
            hardware: hardware || 'gpu-a40-small',
            minInstances: minInstances || 0,
            maxInstances: maxInstances || 1,
            projectId: projectId || '',
            userId,
        });

        res.json({
            success: true,
            deployment,
            predictionEndpoint: `https://api.replicate.com/v1/deployments/${deployment.owner}/${deployment.name}/predictions`,
        });
    } catch (error) {
        console.error('Replicate deployment error:', error);
        res.status(500).json({
            error: 'Failed to create Replicate deployment',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/model-deploy/replicate/predict
 * Run prediction on a Replicate deployment
 */
router.post('/replicate/predict', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { owner, name, input, webhook } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const replicate = await getReplicateForUser(userId);
    if (!replicate) {
        return res.status(400).json({ error: 'Replicate not configured' });
    }

    try {
        const prediction = await replicate.createPrediction(owner, name, {
            input,
            webhook,
            webhook_events_filter: webhook ? ['completed'] : undefined,
        });

        res.json({ success: true, prediction });
    } catch (error) {
        console.error('Replicate prediction error:', error);
        res.status(500).json({
            error: 'Failed to create prediction',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/model-deploy/replicate/deployments
 * List Replicate deployments
 */
router.get('/replicate/deployments', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;

    const replicate = await getReplicateForUser(userId);
    if (!replicate) {
        return res.status(400).json({ error: 'Replicate not configured' });
    }

    try {
        const deployments = await replicate.listDeployments();
        res.json(deployments);
    } catch (error) {
        res.status(500).json({ error: 'Failed to list deployments' });
    }
});

/**
 * PATCH /api/model-deploy/replicate/deployments/:owner/:name
 * Update a Replicate deployment
 */
router.patch('/replicate/deployments/:owner/:name', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { owner, name } = req.params;
    const { minInstances, maxInstances, hardware, version } = req.body;

    const replicate = await getReplicateForUser(userId);
    if (!replicate) {
        return res.status(400).json({ error: 'Replicate not configured' });
    }

    try {
        const deployment = await replicate.updateDeployment(owner, name, {
            minInstances,
            maxInstances,
            hardware,
            version,
        });
        res.json({ success: true, deployment });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update deployment' });
    }
});

/**
 * DELETE /api/model-deploy/replicate/deployments/:owner/:name
 * Delete a Replicate deployment
 */
router.delete('/replicate/deployments/:owner/:name', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { owner, name } = req.params;

    const replicate = await getReplicateForUser(userId);
    if (!replicate) {
        return res.status(400).json({ error: 'Replicate not configured' });
    }

    try {
        await replicate.deleteDeployment(owner, name);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete deployment' });
    }
});

/**
 * POST /api/model-deploy/modal/deploy
 * Create a Modal deployment (generates code + instructions)
 */
router.post('/modal/deploy', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { name, description, functions, templateId, projectId } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const modal = await getModalForUser(userId);
    if (!modal) {
        return res.status(400).json({
            error: 'Modal not configured',
            missingCredential: 'modal',
        });
    }

    try {
        // Use template if provided
        let funcs = functions;
        if (templateId && MODAL_TEMPLATES[templateId as keyof typeof MODAL_TEMPLATES]) {
            const template = MODAL_TEMPLATES[templateId as keyof typeof MODAL_TEMPLATES];
            funcs = template.functions;
        }

        const deployment = await modal.createDeployment({
            name: name || templateId || 'modal-app',
            description,
            functions: funcs,
            projectId: projectId || '',
            userId,
        });

        res.json({
            success: true,
            ...deployment,
        });
    } catch (error) {
        console.error('Modal deployment error:', error);
        res.status(500).json({
            error: 'Failed to create Modal deployment',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/model-deploy/fal/deploy
 * Create a Fal.ai custom deployment
 */
router.post('/fal/deploy', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { name, description, machineType, handler, requirements, minInstances, maxInstances, projectId } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const fal = await getFalForUser(userId);
    if (!fal) {
        return res.status(400).json({
            error: 'Fal.ai not configured',
            missingCredential: 'fal',
        });
    }

    try {
        const deployment = await fal.createDeployment({
            name,
            description,
            machineType: machineType || 'GPU',
            handler,
            requirements,
            minInstances,
            maxInstances,
            projectId: projectId || '',
            userId,
        });

        res.json({
            success: true,
            ...deployment,
        });
    } catch (error) {
        console.error('Fal deployment error:', error);
        res.status(500).json({
            error: 'Failed to create Fal deployment',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/model-deploy/fal/run
 * Run inference on a Fal.ai model
 */
router.post('/fal/run', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { modelId, input, webhook } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!modelId || !input) {
        return res.status(400).json({ error: 'modelId and input are required' });
    }

    const fal = await getFalForUser(userId);
    if (!fal) {
        return res.status(400).json({ error: 'Fal.ai not configured' });
    }

    try {
        let result;
        if (webhook) {
            result = await fal.runModelWithWebhook(modelId, { input, webhook_url: webhook });
        } else {
            result = await fal.runModel(modelId, input);
        }

        res.json({ success: true, result });
    } catch (error) {
        console.error('Fal inference error:', error);
        res.status(500).json({
            error: 'Failed to run inference',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/model-deploy/fal/status/:modelId/:requestId
 * Get Fal.ai prediction status
 */
router.get('/fal/status/:modelId/:requestId', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { modelId, requestId } = req.params;

    const fal = await getFalForUser(userId);
    if (!fal) {
        return res.status(400).json({ error: 'Fal.ai not configured' });
    }

    try {
        const status = await fal.getStatus(modelId, requestId);
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get status' });
    }
});

export default router;

