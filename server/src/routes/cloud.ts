/**
 * Cloud Provisioning API Routes
 *
 * Handles cloud deployment with pricing confirmation
 */

import { Router, Request, Response } from 'express';
import {
    CloudProvider,
    DeploymentConfig,
    ProviderCredentials,
} from '../services/cloud/types';
import { pricingCalculator } from '../services/cloud/pricing';
import { createRunPodProvider } from '../services/cloud/runpod';
import { createAWSProvider } from '../services/cloud/aws';
import { createGCPProvider } from '../services/cloud/gcp';
import { huggingFaceService } from '../services/ml/huggingface';
import { comfyUIService } from '../services/ml/comfyui';
import { dockerBuilder } from '../services/ml/docker-builder';

const router = Router();

// In-memory store for user credentials (should be encrypted in production)
const userCredentials = new Map<string, Map<CloudProvider, any>>();

/**
 * POST /api/cloud/credentials
 * Store cloud provider credentials
 */
router.post('/credentials', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { provider, credentials } = req.body;

        if (!provider || !credentials) {
            return res.status(400).json({ error: 'Provider and credentials required' });
        }

        // Validate credentials
        let isValid = false;
        try {
            switch (provider) {
                case 'runpod':
                    isValid = await createRunPodProvider(credentials.apiKey).validateCredentials();
                    break;
                case 'aws':
                    isValid = await createAWSProvider(credentials).validateCredentials();
                    break;
                case 'gcp':
                    isValid = await createGCPProvider(credentials).validateCredentials();
                    break;
            }
        } catch (e) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        if (!isValid) {
            return res.status(400).json({ error: 'Credentials validation failed' });
        }

        // Store credentials
        if (!userCredentials.has(userId)) {
            userCredentials.set(userId, new Map());
        }
        userCredentials.get(userId)!.set(provider, credentials);

        res.json({ success: true, provider });
    } catch (error) {
        console.error('Error storing credentials:', error);
        res.status(500).json({ error: 'Failed to store credentials' });
    }
});

/**
 * GET /api/cloud/credentials
 * List configured providers
 */
router.get('/credentials', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const creds = userCredentials.get(userId);
        const providers = creds ? Array.from(creds.keys()) : [];

        res.json({ providers });
    } catch (error) {
        console.error('Error listing credentials:', error);
        res.status(500).json({ error: 'Failed to list credentials' });
    }
});

/**
 * POST /api/cloud/estimate
 * Estimate deployment cost (pricing confirmation)
 */
router.post('/estimate', async (req: Request, res: Response) => {
    try {
        const { config } = req.body;

        if (!config) {
            return res.status(400).json({ error: 'Deployment config required' });
        }

        const estimate = pricingCalculator.estimateCost(config as DeploymentConfig);

        res.json({ estimate });
    } catch (error) {
        console.error('Error estimating cost:', error);
        res.status(500).json({ error: 'Failed to estimate cost' });
    }
});

/**
 * POST /api/cloud/compare
 * Compare costs across providers
 */
router.post('/compare', async (req: Request, res: Response) => {
    try {
        const { config } = req.body;

        if (!config) {
            return res.status(400).json({ error: 'Deployment config required' });
        }

        const comparisons = pricingCalculator.compareCosts(config);

        res.json({ comparisons });
    } catch (error) {
        console.error('Error comparing costs:', error);
        res.status(500).json({ error: 'Failed to compare costs' });
    }
});

/**
 * GET /api/cloud/gpus
 * List available GPUs and pricing
 */
router.get('/gpus', async (req: Request, res: Response) => {
    try {
        const provider = req.query.provider as CloudProvider | undefined;
        const gpus = pricingCalculator.getGPUPricing(provider);

        res.json({ gpus });
    } catch (error) {
        console.error('Error listing GPUs:', error);
        res.status(500).json({ error: 'Failed to list GPUs' });
    }
});

/**
 * POST /api/cloud/deploy
 * Deploy to cloud provider (requires prior cost confirmation)
 */
router.post('/deploy', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { config, confirmedCost } = req.body;

        if (!config || !confirmedCost) {
            return res.status(400).json({ error: 'Config and confirmed cost required' });
        }

        // Verify cost hasn't changed significantly
        const currentEstimate = pricingCalculator.estimateCost(config);
        if (Math.abs(currentEstimate.estimatedMonthlyCost - confirmedCost) > confirmedCost * 0.1) {
            return res.status(409).json({
                error: 'Cost has changed',
                newEstimate: currentEstimate,
            });
        }

        // Get provider credentials
        const creds = userCredentials.get(userId)?.get(config.provider);
        if (!creds) {
            return res.status(400).json({ error: `No credentials for ${config.provider}` });
        }

        // Create provider and deploy
        let deployment;
        switch (config.provider) {
            case 'runpod':
                deployment = await createRunPodProvider(creds.apiKey).deploy(config);
                break;
            case 'aws':
                deployment = await createAWSProvider(creds).deploy(config);
                break;
            case 'gcp':
                deployment = await createGCPProvider(creds).deploy(config);
                break;
            default:
                return res.status(400).json({ error: 'Invalid provider' });
        }

        res.json({ deployment });
    } catch (error) {
        console.error('Error deploying:', error);
        res.status(500).json({ error: 'Deployment failed' });
    }
});

/**
 * GET /api/cloud/deployments
 * List deployments
 */
router.get('/deployments', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const projectId = req.query.projectId as string | undefined;
        const allDeployments = [];

        const creds = userCredentials.get(userId);
        if (creds) {
            for (const [provider, credentials] of creds) {
                try {
                    let deployments;
                    switch (provider) {
                        case 'runpod':
                            deployments = await createRunPodProvider(credentials.apiKey).listDeployments(projectId);
                            break;
                        case 'aws':
                            deployments = await createAWSProvider(credentials).listDeployments(projectId);
                            break;
                        case 'gcp':
                            deployments = await createGCPProvider(credentials).listDeployments(projectId);
                            break;
                    }
                    if (deployments) {
                        allDeployments.push(...deployments);
                    }
                } catch {
                    // Skip failed providers
                }
            }
        }

        res.json({ deployments: allDeployments });
    } catch (error) {
        console.error('Error listing deployments:', error);
        res.status(500).json({ error: 'Failed to list deployments' });
    }
});

/**
 * DELETE /api/cloud/deployments/:id
 * Delete a deployment
 */
router.delete('/deployments/:id', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const { provider } = req.query;

        if (!provider) {
            return res.status(400).json({ error: 'Provider required' });
        }

        const creds = userCredentials.get(userId)?.get(provider as CloudProvider);
        if (!creds) {
            return res.status(400).json({ error: `No credentials for ${provider}` });
        }

        switch (provider) {
            case 'runpod':
                await createRunPodProvider(creds.apiKey).deleteDeployment(id);
                break;
            case 'aws':
                await createAWSProvider(creds).deleteDeployment(id);
                break;
            case 'gcp':
                await createGCPProvider(creds).deleteDeployment(id);
                break;
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting deployment:', error);
        res.status(500).json({ error: 'Failed to delete deployment' });
    }
});

// HuggingFace Model Routes

/**
 * GET /api/cloud/models/search
 * Search HuggingFace models
 */
router.get('/models/search', async (req: Request, res: Response) => {
    try {
        const query = req.query.q as string || '';
        const task = req.query.task as string | undefined;
        const limit = parseInt(req.query.limit as string) || 20;

        const models = await huggingFaceService.searchModels(query, {
            task: task as any,
            limit,
        });

        res.json({ models });
    } catch (error) {
        console.error('Error searching models:', error);
        res.status(500).json({ error: 'Failed to search models' });
    }
});

/**
 * GET /api/cloud/models/:modelId/requirements
 * Analyze model requirements
 */
router.get('/models/:modelId/requirements', async (req: Request, res: Response) => {
    try {
        const modelId = req.params.modelId;
        const requirements = await huggingFaceService.analyzeRequirements(modelId);

        res.json({ requirements });
    } catch (error) {
        console.error('Error analyzing model:', error);
        res.status(500).json({ error: 'Failed to analyze model' });
    }
});

/**
 * POST /api/cloud/models/deploy
 * Deploy a HuggingFace model
 */
router.post('/models/deploy', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { modelId, provider, region, quantization, confirmedCost } = req.body;

        if (!modelId || !provider || !confirmedCost) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Generate deployment config
        const deploymentConfig = await huggingFaceService.createDeploymentConfig({
            modelId,
            provider,
            region: region || 'us-central1',
            quantization,
        });

        // Verify cost
        const currentEstimate = pricingCalculator.estimateCost(deploymentConfig);
        if (Math.abs(currentEstimate.estimatedMonthlyCost - confirmedCost) > confirmedCost * 0.1) {
            return res.status(409).json({
                error: 'Cost has changed',
                newEstimate: currentEstimate,
            });
        }

        // Get credentials and deploy
        const creds = userCredentials.get(userId)?.get(provider);
        if (!creds) {
            return res.status(400).json({ error: `No credentials for ${provider}` });
        }

        let deployment;
        switch (provider) {
            case 'runpod':
                deployment = await createRunPodProvider(creds.apiKey).deploy(deploymentConfig);
                break;
            case 'aws':
                deployment = await createAWSProvider(creds).deploy(deploymentConfig);
                break;
            case 'gcp':
                deployment = await createGCPProvider(creds).deploy(deploymentConfig);
                break;
        }

        res.json({ deployment });
    } catch (error) {
        console.error('Error deploying model:', error);
        res.status(500).json({ error: 'Failed to deploy model' });
    }
});

// ComfyUI Workflow Routes

/**
 * POST /api/cloud/workflows/analyze
 * Analyze ComfyUI workflow requirements
 */
router.post('/workflows/analyze', async (req: Request, res: Response) => {
    try {
        const { workflow } = req.body;

        if (!workflow) {
            return res.status(400).json({ error: 'Workflow required' });
        }

        const parsed = comfyUIService.parseWorkflow(workflow);
        const requirements = comfyUIService.analyzeRequirements(parsed);
        const inputs = comfyUIService.extractInputs(parsed);
        const outputs = comfyUIService.extractOutputs(parsed);

        res.json({ requirements, inputs, outputs });
    } catch (error) {
        console.error('Error analyzing workflow:', error);
        res.status(500).json({ error: 'Failed to analyze workflow' });
    }
});

/**
 * POST /api/cloud/workflows/deploy
 * Deploy ComfyUI workflow
 */
router.post('/workflows/deploy', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { workflow, name, provider, region, confirmedCost } = req.body;

        if (!workflow || !name || !provider || !confirmedCost) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Generate deployment config
        const deploymentConfig = await comfyUIService.createDeploymentConfig({
            workflow,
            name,
            provider,
            region: region || 'us-central1',
        });

        // Verify cost
        const currentEstimate = pricingCalculator.estimateCost(deploymentConfig);
        if (Math.abs(currentEstimate.estimatedMonthlyCost - confirmedCost) > confirmedCost * 0.1) {
            return res.status(409).json({
                error: 'Cost has changed',
                newEstimate: currentEstimate,
            });
        }

        // Deploy
        const creds = userCredentials.get(userId)?.get(provider);
        if (!creds) {
            return res.status(400).json({ error: `No credentials for ${provider}` });
        }

        let deployment;
        switch (provider) {
            case 'runpod':
                deployment = await createRunPodProvider(creds.apiKey).deploy(deploymentConfig);
                break;
            case 'aws':
                deployment = await createAWSProvider(creds).deploy(deploymentConfig);
                break;
            case 'gcp':
                deployment = await createGCPProvider(creds).deploy(deploymentConfig);
                break;
        }

        res.json({ deployment });
    } catch (error) {
        console.error('Error deploying workflow:', error);
        res.status(500).json({ error: 'Failed to deploy workflow' });
    }
});

// Docker Builder Routes

/**
 * POST /api/cloud/docker/build
 * Generate Dockerfile
 */
router.post('/docker/build', async (req: Request, res: Response) => {
    try {
        const { config } = req.body;

        if (!config) {
            return res.status(400).json({ error: 'Config required' });
        }

        const result = dockerBuilder.generateDockerfile(config);
        const resources = dockerBuilder.estimateResources(config);

        res.json({ ...result, resources });
    } catch (error) {
        console.error('Error generating Dockerfile:', error);
        res.status(500).json({ error: 'Failed to generate Dockerfile' });
    }
});

/**
 * POST /api/cloud/docker/validate
 * Validate Dockerfile
 */
router.post('/docker/validate', async (req: Request, res: Response) => {
    try {
        const { dockerfile } = req.body;

        if (!dockerfile) {
            return res.status(400).json({ error: 'Dockerfile required' });
        }

        const validation = dockerBuilder.validateDockerfile(dockerfile);

        res.json(validation);
    } catch (error) {
        console.error('Error validating Dockerfile:', error);
        res.status(500).json({ error: 'Failed to validate Dockerfile' });
    }
});

export default router;

