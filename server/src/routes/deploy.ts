/**
 * Deployment API Routes
 *
 * Handles static site deployment to Vercel and Netlify
 */

import { Router, Request, Response } from 'express';
import { createVercelService } from '../services/deployment/vercel.js';
import { createNetlifyService } from '../services/deployment/netlify.js';

const router = Router();

// Store deployment tokens (should be encrypted in production)
const deploymentTokens = new Map<string, { vercel?: string; netlify?: string }>();

/**
 * POST /api/deploy/credentials
 * Store deployment provider tokens
 */
router.post('/credentials', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { provider, token } = req.body;

        if (!provider || !token) {
            return res.status(400).json({ error: 'Provider and token required' });
        }

        // Validate token
        let isValid = false;
        if (provider === 'vercel') {
            isValid = await createVercelService(token).validateToken();
        } else if (provider === 'netlify') {
            isValid = await createNetlifyService(token).validateToken();
        }

        if (!isValid) {
            return res.status(400).json({ error: 'Invalid token' });
        }

        // Store token
        const existing = deploymentTokens.get(userId) || {};
        existing[provider as 'vercel' | 'netlify'] = token;
        deploymentTokens.set(userId, existing);

        res.json({ success: true, provider });
    } catch (error) {
        console.error('Error storing credentials:', error);
        res.status(500).json({ error: 'Failed to store credentials' });
    }
});

/**
 * GET /api/deploy/credentials
 * List configured deployment providers
 */
router.get('/credentials', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const tokens = deploymentTokens.get(userId) || {};
        const providers = Object.keys(tokens).filter(k => tokens[k as keyof typeof tokens]);

        res.json({ providers });
    } catch (error) {
        console.error('Error listing credentials:', error);
        res.status(500).json({ error: 'Failed to list credentials' });
    }
});

/**
 * POST /api/deploy/vercel
 * Deploy to Vercel
 */
router.post('/vercel', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const token = deploymentTokens.get(userId)?.vercel;
        if (!token) {
            return res.status(400).json({ error: 'Vercel not configured' });
        }

        const { name, files, projectSettings, environmentVariables } = req.body;

        if (!name || !files) {
            return res.status(400).json({ error: 'Name and files required' });
        }

        const vercel = createVercelService(token);
        const deployment = await vercel.deploy({
            name,
            files: files.map((f: any) => ({
                file: f.path,
                data: f.content,
            })),
            projectSettings,
            environmentVariables,
        });

        res.json({ deployment });
    } catch (error) {
        console.error('Vercel deployment error:', error);
        res.status(500).json({ error: 'Deployment failed' });
    }
});

/**
 * POST /api/deploy/netlify
 * Deploy to Netlify
 */
router.post('/netlify', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const token = deploymentTokens.get(userId)?.netlify;
        if (!token) {
            return res.status(400).json({ error: 'Netlify not configured' });
        }

        const { siteName, files } = req.body;

        if (!siteName || !files) {
            return res.status(400).json({ error: 'Site name and files required' });
        }

        const netlify = createNetlifyService(token);
        const deployment = await netlify.deploy({
            siteName,
            files: files.map((f: any) => ({
                path: f.path,
                content: f.content,
            })),
        });

        res.json({ deployment });
    } catch (error) {
        console.error('Netlify deployment error:', error);
        res.status(500).json({ error: 'Deployment failed' });
    }
});

/**
 * GET /api/deploy/vercel/status/:deploymentId
 * Get Vercel deployment status
 */
router.get('/vercel/status/:deploymentId', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const token = deploymentTokens.get(userId)?.vercel;
        if (!token) {
            return res.status(400).json({ error: 'Vercel not configured' });
        }

        const { deploymentId } = req.params;
        const vercel = createVercelService(token);
        const deployment = await vercel.getDeployment(deploymentId);

        res.json({ deployment });
    } catch (error) {
        console.error('Error fetching Vercel status:', error);
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

/**
 * GET /api/deploy/netlify/status/:deployId
 * Get Netlify deploy status
 */
router.get('/netlify/status/:deployId', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const token = deploymentTokens.get(userId)?.netlify;
        if (!token) {
            return res.status(400).json({ error: 'Netlify not configured' });
        }

        const { deployId } = req.params;
        const netlify = createNetlifyService(token);
        const deploy = await netlify.getDeploy(deployId);

        res.json({ deploy });
    } catch (error) {
        console.error('Error fetching Netlify status:', error);
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

/**
 * GET /api/deploy/vercel/deployments
 * List Vercel deployments
 */
router.get('/vercel/deployments', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const token = deploymentTokens.get(userId)?.vercel;
        if (!token) {
            return res.status(400).json({ error: 'Vercel not configured' });
        }

        const projectName = req.query.project as string | undefined;
        const vercel = createVercelService(token);
        const result = await vercel.listDeployments(projectName);

        res.json(result);
    } catch (error) {
        console.error('Error listing Vercel deployments:', error);
        res.status(500).json({ error: 'Failed to list deployments' });
    }
});

/**
 * GET /api/deploy/netlify/sites
 * List Netlify sites
 */
router.get('/netlify/sites', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const token = deploymentTokens.get(userId)?.netlify;
        if (!token) {
            return res.status(400).json({ error: 'Netlify not configured' });
        }

        const netlify = createNetlifyService(token);
        const sites = await netlify.listSites();

        res.json({ sites });
    } catch (error) {
        console.error('Error listing Netlify sites:', error);
        res.status(500).json({ error: 'Failed to list sites' });
    }
});

export default router;

