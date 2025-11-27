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
 * Execute a deployment plan
 */
router.post('/execute', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const { modelId, provider, gpuType, config } = req.body;

        if (!modelId || !provider) {
            return res.status(400).json({ error: 'modelId and provider are required' });
        }

        // This would trigger the actual deployment
        // For now, return a placeholder response
        res.json({
            success: true,
            message: 'Deployment initiated',
            deployment: {
                id: `deploy-${Date.now()}`,
                status: 'pending',
                modelId,
                provider,
                gpuType,
                estimatedTime: 300, // 5 minutes
            },
        });
    } catch (error) {
        console.error('Error executing deployment:', error);
        res.status(500).json({ error: 'Failed to execute deployment' });
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

