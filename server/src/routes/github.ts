/**
 * GitHub API Routes
 *
 * Endpoints for GitHub OAuth and repository management:
 * - OAuth flow (authorization URL, callback)
 * - Repository creation and linking
 * - Push to GitHub
 * - Connection management
 */

import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { getGitHubAuthService, getGitHubRepoService } from '../services/github/index.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const authService = getGitHubAuthService();
const repoService = getGitHubRepoService();

// Store OAuth states temporarily (in production, use Redis or session store)
const oauthStates = new Map<string, { userId: string; expires: number }>();

// Clean up expired states periodically
setInterval(() => {
    const now = Date.now();
    for (const [state, data] of oauthStates.entries()) {
        if (data.expires < now) {
            oauthStates.delete(state);
        }
    }
}, 60000); // Every minute

/**
 * GET /api/github/status
 * Check if GitHub OAuth is configured
 */
router.get('/status', (_req: Request, res: Response) => {
    res.json({
        configured: authService.isConfigured(),
    });
});

/**
 * GET /api/github/connection
 * Get user's GitHub connection status
 */
router.get('/connection', authMiddleware, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const connection = await authService.getConnection(userId);

        if (!connection) {
            return res.json({
                connected: false,
            });
        }

        // Verify the connection is still valid
        const isValid = await authService.verifyConnection(userId);

        res.json({
            connected: isValid,
            username: connection.githubUsername,
            avatarUrl: connection.avatarUrl,
            scope: connection.scope,
            connectedAt: connection.createdAt,
        });
    } catch (error) {
        console.error('Error getting GitHub connection:', error);
        res.status(500).json({ error: 'Failed to get connection status' });
    }
});

/**
 * GET /api/github/auth/url
 * Generate OAuth authorization URL
 */
router.get('/auth/url', authMiddleware, (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!authService.isConfigured()) {
            return res.status(503).json({
                error: 'GitHub OAuth not configured',
                message: 'Please configure GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET',
            });
        }

        // Generate secure state
        const state = crypto.randomBytes(32).toString('hex');

        // Store state with user ID (expires in 10 minutes)
        oauthStates.set(state, {
            userId,
            expires: Date.now() + 10 * 60 * 1000,
        });

        const url = authService.getAuthorizationUrl(state);

        res.json({ url, state });
    } catch (error) {
        console.error('Error generating auth URL:', error);
        res.status(500).json({ error: 'Failed to generate authorization URL' });
    }
});

/**
 * GET /api/github/auth/callback
 * Handle OAuth callback from GitHub
 */
router.get('/auth/callback', async (req: Request, res: Response) => {
    try {
        const { code, state, error: oauthError, error_description } = req.query;

        // Handle OAuth errors
        if (oauthError) {
            return res.redirect(`/settings?github=error&message=${encodeURIComponent(error_description as string || oauthError as string)}`);
        }

        if (!code || !state) {
            return res.redirect('/settings?github=error&message=Missing+code+or+state');
        }

        // Verify state
        const stateData = oauthStates.get(state as string);
        if (!stateData) {
            return res.redirect('/settings?github=error&message=Invalid+or+expired+state');
        }

        // Clean up state
        oauthStates.delete(state as string);

        // Check if state expired
        if (stateData.expires < Date.now()) {
            return res.redirect('/settings?github=error&message=State+expired');
        }

        const userId = stateData.userId;

        // Exchange code for token
        const tokens = await authService.exchangeCodeForToken(code as string);

        // Get user info from GitHub
        const userInfo = await authService.getUserInfo(tokens.accessToken);

        // Save connection
        await authService.saveConnection(userId, userInfo, tokens);

        // Redirect to settings with success
        res.redirect('/settings?github=connected');
    } catch (error) {
        console.error('GitHub OAuth callback error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.redirect(`/settings?github=error&message=${encodeURIComponent(message)}`);
    }
});

/**
 * DELETE /api/github/connection
 * Disconnect GitHub account
 */
router.delete('/connection', authMiddleware, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        await authService.deleteConnection(userId);

        res.json({ success: true, message: 'GitHub disconnected' });
    } catch (error) {
        console.error('Error disconnecting GitHub:', error);
        res.status(500).json({ error: 'Failed to disconnect GitHub' });
    }
});

/**
 * GET /api/github/repos
 * List user's GitHub repositories
 */
router.get('/repos', authMiddleware, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const page = parseInt(req.query.page as string) || 1;
        const perPage = parseInt(req.query.per_page as string) || 30;

        const accessToken = await authService.getAccessToken(userId);
        if (!accessToken) {
            return res.status(400).json({ error: 'GitHub not connected' });
        }

        const repos = await repoService.listUserRepos(accessToken, page, perPage);

        res.json({ repos });
    } catch (error) {
        console.error('Error listing repos:', error);
        res.status(500).json({ error: 'Failed to list repositories' });
    }
});

/**
 * POST /api/github/repos
 * Create a new GitHub repository
 */
router.post('/repos', authMiddleware, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { projectId, repoName, description, isPrivate } = req.body as {
            projectId: string;
            repoName: string;
            description?: string;
            isPrivate?: boolean;
        };

        if (!projectId || !repoName) {
            return res.status(400).json({ error: 'projectId and repoName are required' });
        }

        const result = await repoService.createAndLinkRepo(
            userId,
            projectId,
            repoName,
            description || 'Created by KripTik AI',
            isPrivate !== false
        );

        res.json({
            success: true,
            repo: result.repo,
            link: result.link,
        });
    } catch (error) {
        console.error('Error creating repo:', error);
        const message = error instanceof Error ? error.message : 'Failed to create repository';
        res.status(500).json({ error: message });
    }
});

/**
 * POST /api/github/repos/link
 * Link an existing GitHub repository to a project
 */
router.post('/repos/link', authMiddleware, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { projectId, owner, repo } = req.body as {
            projectId: string;
            owner: string;
            repo: string;
        };

        if (!projectId || !owner || !repo) {
            return res.status(400).json({ error: 'projectId, owner, and repo are required' });
        }

        const accessToken = await authService.getAccessToken(userId);
        if (!accessToken) {
            return res.status(400).json({ error: 'GitHub not connected' });
        }

        // Get repo info
        const repoInfo = await repoService.getRepoInfo(accessToken, owner, repo);
        if (!repoInfo) {
            return res.status(404).json({ error: 'Repository not found or not accessible' });
        }

        // Link the repo
        const link = await repoService.linkProjectToRepo(projectId, repoInfo);

        res.json({
            success: true,
            repo: repoInfo,
            link,
        });
    } catch (error) {
        console.error('Error linking repo:', error);
        const message = error instanceof Error ? error.message : 'Failed to link repository';
        res.status(500).json({ error: message });
    }
});

/**
 * DELETE /api/github/repos/link/:projectId
 * Unlink a GitHub repository from a project
 */
router.delete('/repos/link/:projectId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { projectId } = req.params;

        await repoService.unlinkProjectRepo(projectId);

        res.json({ success: true, message: 'Repository unlinked' });
    } catch (error) {
        console.error('Error unlinking repo:', error);
        res.status(500).json({ error: 'Failed to unlink repository' });
    }
});

/**
 * GET /api/github/repos/project/:projectId
 * Get linked repository for a project
 */
router.get('/repos/project/:projectId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { projectId } = req.params;

        const link = await repoService.getProjectRepo(projectId);

        if (!link) {
            return res.json({ linked: false });
        }

        res.json({
            linked: true,
            repo: {
                owner: link.repoOwner,
                name: link.repoName,
                url: link.repoUrl,
                defaultBranch: link.defaultBranch,
                isPrivate: link.isPrivate,
            },
            lastPushedAt: link.lastPushedAt,
            lastPushCommitSha: link.lastPushCommitSha,
        });
    } catch (error) {
        console.error('Error getting project repo:', error);
        res.status(500).json({ error: 'Failed to get project repository' });
    }
});

/**
 * POST /api/github/push
 * Push project files to GitHub
 */
router.post('/push', authMiddleware, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { projectId, branch, message } = req.body as {
            projectId: string;
            branch?: string;
            message?: string;
        };

        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }

        const result = await repoService.pushProjectToGitHub(
            userId,
            projectId,
            branch,
            message
        );

        res.json({
            success: true,
            commitSha: result.commitSha,
            commitUrl: result.commitUrl,
            filesChanged: result.filesChanged,
        });
    } catch (error) {
        console.error('Error pushing to GitHub:', error);
        const message = error instanceof Error ? error.message : 'Failed to push to GitHub';
        res.status(500).json({ error: message });
    }
});

export default router;
