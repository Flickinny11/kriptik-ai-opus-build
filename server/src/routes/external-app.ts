/**
 * External App Integration API Routes
 * 
 * Handles importing external apps, wiring AI models, testing, and GitHub push.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { generalRateLimiter } from '../middleware/rate-limiter.js';
import {
    getAppImporter,
    getModelWiringService,
    getIntegrationTester,
    createGitHubPusher,
    getWorkflowOrchestrator,
    type WorkflowConfig,
} from '../services/external-app/index.js';
import type { ModelModality } from '../services/training/types.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * POST /api/external-app/import
 * Import an application from GitHub
 */
router.post('/import', generalRateLimiter, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { repoUrl, branch, githubToken } = req.body;

        if (!repoUrl) {
            return res.status(400).json({ error: 'Repository URL is required' });
        }

        if (!githubToken) {
            return res.status(400).json({ error: 'GitHub token is required' });
        }

        const appImporter = getAppImporter(githubToken);

        const app = await appImporter.importFromGitHub(
            userId,
            repoUrl,
            branch
        );

        return res.json({
            success: true,
            app,
        });
    } catch (error) {
        console.error('App import error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Import failed',
        });
    }
});

/**
 * GET /api/external-app
 * List all imported apps for the user
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const appImporter = getAppImporter();
        const apps = await appImporter.listUserApps(userId);

        return res.json({
            success: true,
            apps,
        });
    } catch (error) {
        console.error('List apps error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to list apps',
        });
    }
});

/**
 * GET /api/external-app/:id
 * Get a specific imported app
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const appImporter = getAppImporter();
        const app = await appImporter.getApp(id);

        if (!app) {
            return res.status(404).json({ error: 'App not found' });
        }

        if (app.userId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        return res.json({
            success: true,
            app,
        });
    } catch (error) {
        console.error('Get app error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get app',
        });
    }
});

/**
 * GET /api/external-app/:id/integration-points
 * Get integration points for an app
 */
router.get('/:id/integration-points', async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const { refresh } = req.query;

        const appImporter = getAppImporter();
        const app = await appImporter.getApp(id);

        if (!app) {
            return res.status(404).json({ error: 'App not found' });
        }

        if (app.userId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        let integrationPoints = app.integrationPoints;

        // Refresh integration points if requested
        if (refresh === 'true') {
            integrationPoints = await appImporter.detectIntegrationPoints(id);
        }

        return res.json({
            success: true,
            integrationPoints,
        });
    } catch (error) {
        console.error('Get integration points error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get integration points',
        });
    }
});

/**
 * POST /api/external-app/:id/wire
 * Wire a model to an app
 */
router.post('/:id/wire', generalRateLimiter, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const {
            deploymentId,
            integrationPointId,
            endpointUrl,
            apiKey,
            modelType,
            preview = false,
        } = req.body;

        if (!integrationPointId || !endpointUrl || !modelType) {
            return res.status(400).json({
                error: 'integrationPointId, endpointUrl, and modelType are required',
            });
        }

        const appImporter = getAppImporter();
        const app = await appImporter.getApp(id);

        if (!app) {
            return res.status(404).json({ error: 'App not found' });
        }

        if (app.userId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const modelWiring = getModelWiringService();

        const result = preview
            ? await modelWiring.previewWiring(
                {
                    appId: id,
                    deploymentId: deploymentId || 'preview',
                    integrationPointId,
                    endpointUrl,
                    apiKey,
                    modelType: modelType as ModelModality,
                },
                app
            )
            : await modelWiring.wireModel(
                {
                    appId: id,
                    deploymentId: deploymentId || 'manual',
                    integrationPointId,
                    endpointUrl,
                    apiKey,
                    modelType: modelType as ModelModality,
                },
                app
            );

        return res.json({
            success: result.success,
            result,
        });
    } catch (error) {
        console.error('Wire model error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Wiring failed',
        });
    }
});

/**
 * POST /api/external-app/:id/test
 * Test model integration
 */
router.post('/:id/test', generalRateLimiter, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const { deploymentId, endpointUrl, apiKey, modelType } = req.body;

        if (!endpointUrl || !modelType) {
            return res.status(400).json({
                error: 'endpointUrl and modelType are required',
            });
        }

        const appImporter = getAppImporter();
        const app = await appImporter.getApp(id);

        if (!app) {
            return res.status(404).json({ error: 'App not found' });
        }

        if (app.userId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const tester = getIntegrationTester();
        const report = await tester.testIntegration(
            app,
            deploymentId || 'manual-test',
            endpointUrl,
            apiKey,
            modelType as ModelModality
        );

        return res.json({
            success: report.success,
            report,
        });
    } catch (error) {
        console.error('Test integration error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Test failed',
        });
    }
});

/**
 * POST /api/external-app/:id/push
 * Push changes to GitHub
 */
router.post('/:id/push', generalRateLimiter, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const {
            githubToken,
            branch,
            baseBranch,
            changes,
            commitMessage,
            createPR = true,
            prTitle,
            prBody,
        } = req.body;

        if (!githubToken) {
            return res.status(400).json({ error: 'GitHub token is required' });
        }

        if (!changes || !Array.isArray(changes) || changes.length === 0) {
            return res.status(400).json({ error: 'Changes array is required' });
        }

        const appImporter = getAppImporter();
        const app = await appImporter.getApp(id);

        if (!app) {
            return res.status(404).json({ error: 'App not found' });
        }

        if (app.userId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const githubPusher = createGitHubPusher(githubToken);

        const result = await githubPusher.pushChanges({
            appId: id,
            repoUrl: app.sourceRepo,
            branch: branch || `kriptik-integration-${Date.now()}`,
            baseBranch: baseBranch || app.branch,
            changes,
            commitMessage: commitMessage || 'feat: Add KripTik AI model integration',
            createPR,
            prTitle,
            prBody,
        });

        return res.json({
            success: result.success,
            result,
        });
    } catch (error) {
        console.error('GitHub push error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Push failed',
        });
    }
});

/**
 * POST /api/external-app/workflow
 * Run full integration workflow (SSE streaming)
 */
router.post('/workflow', generalRateLimiter, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const {
            repoUrl,
            branch,
            trainingJobId,
            existingDeploymentId,
            deploymentProvider = 'runpod',
            modelType,
            autoPush = false,
            createPR = true,
            githubToken,
        } = req.body;

        if (!repoUrl) {
            return res.status(400).json({ error: 'Repository URL is required' });
        }

        if (!githubToken) {
            return res.status(400).json({ error: 'GitHub token is required' });
        }

        if (!modelType) {
            return res.status(400).json({ error: 'Model type is required' });
        }

        if (!trainingJobId && !existingDeploymentId) {
            return res.status(400).json({
                error: 'Either trainingJobId or existingDeploymentId is required',
            });
        }

        // Set up SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const config: WorkflowConfig = {
            userId,
            repoUrl,
            branch,
            trainingJobId,
            existingDeploymentId,
            deploymentProvider,
            modelType: modelType as ModelModality,
            autoPush,
            createPR,
            githubToken,
        };

        const orchestrator = getWorkflowOrchestrator(githubToken);

        for await (const progress of orchestrator.runWorkflow(config)) {
            res.write(`data: ${JSON.stringify(progress)}\n\n`);

            // Break if client disconnected
            if (res.writableEnded) {
                break;
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        console.error('Workflow error:', error);
        
        // If headers already sent, write error as SSE
        if (res.headersSent) {
            res.write(`data: ${JSON.stringify({ step: 'error', error: error instanceof Error ? error.message : 'Workflow failed' })}\n\n`);
            res.end();
        } else {
            return res.status(500).json({
                error: error instanceof Error ? error.message : 'Workflow failed',
            });
        }
    }
});

/**
 * GET /api/external-app/:id/branches
 * List branches in the repository
 */
router.get('/:id/branches', async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const { githubToken } = req.query;

        if (!githubToken || typeof githubToken !== 'string') {
            return res.status(400).json({ error: 'GitHub token is required' });
        }

        const appImporter = getAppImporter();
        const app = await appImporter.getApp(id);

        if (!app) {
            return res.status(404).json({ error: 'App not found' });
        }

        if (app.userId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const githubPusher = createGitHubPusher(githubToken);
        const branches = await githubPusher.listBranches(app.sourceRepo);

        return res.json({
            success: true,
            branches,
        });
    } catch (error) {
        console.error('List branches error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to list branches',
        });
    }
});

/**
 * POST /api/external-app/health-check
 * Quick health check for an endpoint
 */
router.post('/health-check', generalRateLimiter, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { endpointUrl, apiKey } = req.body;

        if (!endpointUrl) {
            return res.status(400).json({ error: 'Endpoint URL is required' });
        }

        const tester = getIntegrationTester();
        const result = await tester.quickHealthCheck(endpointUrl, apiKey);

        return res.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('Health check error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Health check failed',
        });
    }
});

export const externalAppRouter = router;
