/**
 * Smart Deployment API Routes
 *
 * Provides AI-driven deployment recommendations and automation.
 *
 * Routes:
 * - POST /api/deploy/analyze-model    - Analyze a model and get requirements
 * - POST /api/deploy/plan             - Get deployment plan with recommendations
 * - GET  /api/deploy/providers        - List available cloud providers
 * - GET  /api/deploy/gpu-tiers        - List available GPU tiers
 * - POST /api/deploy/execute          - Execute a deployment plan
 */

import { Router, Request, Response } from 'express';
import { getSmartDeploymentService, DeploymentPlan } from '../services/deployment/smart-deployment.js';
import { RunPodProvider } from '../services/cloud/runpod.js';
import { getCredentialVault } from '../services/security/credential-vault.js';
import { db } from '../db.js';
import { deployments as deploymentsTable, projects, files as filesTable } from '../schema.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ============================================================================
// MIDDLEWARE
// ============================================================================

function requireAuth(req: Request, res: Response, next: Function) {
    const userId = req.headers['x-user-id'] as string || (req as any).session?.userId;

    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    (req as any).userId = userId;
    next();
}

router.use(requireAuth);

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/deploy/analyze-model
 * Analyze a model and detect requirements
 */
router.post('/analyze-model', async (req: Request, res: Response) => {
    try {
        const { modelId } = req.body;

        if (!modelId) {
            return res.status(400).json({ error: 'modelId is required' });
        }

        const service = getSmartDeploymentService();
        const requirements = await service.analyzeModel(modelId);

        res.json({
            success: true,
            requirements,
        });
    } catch (error) {
        console.error('Error analyzing model:', error);
        res.status(500).json({ error: 'Failed to analyze model' });
    }
});

/**
 * POST /api/deploy/plan
 * Get a deployment plan with recommendations
 */
router.post('/plan', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const { modelId, preferredProvider, maxCostPerHour, region } = req.body;

        if (!modelId) {
            return res.status(400).json({ error: 'modelId is required' });
        }

        const service = getSmartDeploymentService();
        const plan = await service.getDeploymentPlan(userId, modelId, {
            preferredProvider,
            maxCostPerHour,
            region,
        });

        res.json({
            success: true,
            plan,
        });
    } catch (error) {
        console.error('Error creating deployment plan:', error);
        res.status(500).json({ error: 'Failed to create deployment plan' });
    }
});

/**
 * GET /api/deploy/providers
 * List available cloud providers
 */
router.get('/providers', async (req: Request, res: Response) => {
    try {
        const service = getSmartDeploymentService();
        const providers = service.getAvailableProviders();

        res.json({
            providers,
        });
    } catch (error) {
        console.error('Error listing providers:', error);
        res.status(500).json({ error: 'Failed to list providers' });
    }
});

/**
 * GET /api/deploy/gpu-tiers
 * List available GPU tiers
 */
router.get('/gpu-tiers', async (req: Request, res: Response) => {
    try {
        const service = getSmartDeploymentService();
        const gpuTiers = service.getGPUTiers();

        res.json({
            gpuTiers,
        });
    } catch (error) {
        console.error('Error listing GPU tiers:', error);
        res.status(500).json({ error: 'Failed to list GPU tiers' });
    }
});

/**
 * POST /api/deploy/execute
 * Execute a deployment plan - triggers actual deployment to cloud provider
 */
router.post('/execute', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const { modelId, provider, gpuType, config, projectId } = req.body;

        if (!provider) {
            return res.status(400).json({ error: 'provider is required' });
        }

        const vault = getCredentialVault();
        const deploymentId = uuidv4();

        // Get deployment configuration
        const smartService = getSmartDeploymentService();
        let deploymentConfig: any = config || {};

        // If modelId provided, analyze requirements
        if (modelId) {
            const requirements = await smartService.analyzeModel(modelId);
            deploymentConfig = {
                ...deploymentConfig,
                name: modelId.split('/').pop() || `deployment-${Date.now()}`,
                resourceType: requirements.framework === 'diffusers' ? 'gpu' : 'serverless',
                gpu: gpuType ? {
                    type: gpuType,
                    count: 1,
                } : undefined,
                model: {
                    huggingFaceId: modelId,
                },
            };
        }

        // Add context for database storage
        deploymentConfig.projectId = projectId || '';
        deploymentConfig.userId = userId;

        // Execute deployment based on provider
        let deployment: any;

        switch (provider) {
            case 'runpod': {
                // Get RunPod credentials
                const credentials = await vault.getCredential(userId, 'runpod');
                const apiKey = (credentials?.data?.apiKey as string) || process.env.RUNPOD_API_KEY;

                if (!apiKey) {
                    return res.status(400).json({
                        error: 'RunPod credentials not configured',
                        missingCredential: 'runpod',
                    });
                }

                const runpodProvider = new RunPodProvider({
                    apiKey,
                });

                deployment = await runpodProvider.deploy({
                    ...deploymentConfig,
                    provider: 'runpod',
                    region: deploymentConfig.region || 'US',
                });
                break;
            }

            case 'vercel': {
                // Get Vercel credentials
                const credentials = await vault.getCredential(userId, 'vercel');
                const vercelToken = credentials?.data?.accessToken || credentials?.oauthAccessToken || process.env.VERCEL_TOKEN;

                if (!vercelToken) {
                    return res.status(400).json({
                        error: 'Vercel credentials not configured',
                        missingCredential: 'vercel',
                    });
                }

                // Get project files if projectId provided
                const projectFiles: Record<string, string> = {};
                if (projectId) {
                    const dbFiles = await db
                        .select()
                        .from(filesTable)
                        .where(eq(filesTable.projectId, projectId));

                    for (const file of dbFiles) {
                        projectFiles[file.path] = file.content;
                    }
                }

                // Save deployment record - Vercel deployment would be handled separately
                // via the existing deploy routes
                await db.insert(deploymentsTable).values({
                    id: deploymentId,
                    projectId: projectId || '',
                    userId,
                    provider: 'vercel',
                    resourceType: 'serverless',
                    config: deploymentConfig,
                    status: 'pending',
                });

                deployment = {
                    id: deploymentId,
                    projectId,
                    userId,
                    provider: 'vercel',
                    status: 'pending',
                    config: deploymentConfig,
                };
                break;
            }

            case 'netlify': {
                // Netlify deployment
                const credentials = await vault.getCredential(userId, 'netlify');
                const netlifyToken = credentials?.data?.accessToken || credentials?.oauthAccessToken || process.env.NETLIFY_TOKEN;

                if (!netlifyToken) {
                    return res.status(400).json({
                        error: 'Netlify credentials not configured',
                        missingCredential: 'netlify',
                    });
                }

                // Save deployment record and return pending status
                await db.insert(deploymentsTable).values({
                    id: deploymentId,
                    projectId: projectId || '',
                    userId,
                    provider: 'netlify',
                    resourceType: 'serverless',
                    config: deploymentConfig,
                    status: 'pending',
                });

                deployment = {
                    id: deploymentId,
                    projectId,
                    userId,
                    provider: 'netlify',
                    status: 'pending',
                    config: deploymentConfig,
                };
                break;
            }

            default:
                return res.status(400).json({
                    error: `Unsupported provider: ${provider}`,
                    supportedProviders: ['runpod', 'vercel', 'netlify'],
                });
        }

        res.json({
            success: true,
            message: 'Deployment initiated',
            deployment: {
                id: deployment.id,
                status: deployment.status,
                provider,
                url: deployment.url,
                providerResourceId: deployment.providerResourceId,
                estimatedMonthlyCost: deployment.estimatedMonthlyCost,
                estimatedTime: provider === 'runpod' ? 300 : 120, // 5 min for GPU, 2 min for static
            },
        });
    } catch (error) {
        console.error('Error executing deployment:', error);
        res.status(500).json({
            error: 'Failed to execute deployment',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/deploy/analyze-project
 * Analyze a project and detect deployment requirements
 */
router.post('/analyze-project', async (req: Request, res: Response) => {
    try {
        const { files } = req.body;

        if (!files || typeof files !== 'object') {
            return res.status(400).json({ error: 'files object is required' });
        }

        const service = getSmartDeploymentService();
        const analysis = await service.analyzeProject(files);

        res.json({
            success: true,
            analysis,
        });
    } catch (error) {
        console.error('Error analyzing project:', error);
        res.status(500).json({ error: 'Failed to analyze project' });
    }
});

export default router;

