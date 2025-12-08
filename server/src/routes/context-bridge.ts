/**
 * Context Bridge Routes
 *
 * API endpoints for importing and analyzing existing codebases.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
    getContextBridgeService,
    type CodebaseProfile,
    type Repository,
} from '../services/import/context-bridge.js';
import { db } from '../db.js';
import { contextBridgeImports } from '../schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

// SSE clients for real-time updates
const sseClients = new Map<string, Response[]>();

/**
 * POST /api/context/import/github
 * Import from GitHub repository
 */
router.post('/import/github', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { projectId, owner, repo, branch, accessToken } = req.body;

        if (!projectId || !owner || !repo || !accessToken) {
            return res.status(400).json({
                success: false,
                error: 'projectId, owner, repo, and accessToken are required',
            });
        }

        const contextBridge = getContextBridgeService();

        // Start import
        const profile = await contextBridge.importFromGitHub(
            projectId,
            owner,
            repo,
            branch || 'main',
            accessToken
        );

        // Save to database
        await db.insert(contextBridgeImports).values({
            id: profile.id,
            projectId,
            source: profile.source as any,
            profile: profile as any,
            patterns: profile.patterns as any,
            conventions: profile.conventions as any,
            lastSynced: new Date().toISOString(),
            createdAt: new Date().toISOString(),
        }).onConflictDoUpdate({
            target: contextBridgeImports.projectId,
            set: {
                profile: profile as any,
                patterns: profile.patterns as any,
                conventions: profile.conventions as any,
                lastSynced: new Date().toISOString(),
            },
        });

        // Broadcast to SSE clients
        broadcastToProject(projectId, { type: 'import:complete', profile });

        res.json({
            success: true,
            profile,
        });
    } catch (error) {
        console.error('GitHub import error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Import failed',
        });
    }
});

/**
 * POST /api/context/import/upload
 * Import from uploaded zip/files
 */
router.post('/import/upload', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { projectId, files, sourceName } = req.body;

        if (!projectId || !files || typeof files !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'projectId and files object are required',
            });
        }

        const contextBridge = getContextBridgeService();

        // Convert files object to Map
        const fileMap = new Map<string, string>(Object.entries(files));

        // Start import
        const profile = await contextBridge.importFromUpload(
            projectId,
            fileMap,
            sourceName || 'Uploaded Files'
        );

        // Save to database
        await db.insert(contextBridgeImports).values({
            id: profile.id,
            projectId,
            source: profile.source as any,
            profile: profile as any,
            patterns: profile.patterns as any,
            conventions: profile.conventions as any,
            lastSynced: new Date().toISOString(),
            createdAt: new Date().toISOString(),
        }).onConflictDoUpdate({
            target: contextBridgeImports.projectId,
            set: {
                profile: profile as any,
                patterns: profile.patterns as any,
                conventions: profile.conventions as any,
                lastSynced: new Date().toISOString(),
            },
        });

        // Broadcast to SSE clients
        broadcastToProject(projectId, { type: 'import:complete', profile });

        res.json({
            success: true,
            profile,
        });
    } catch (error) {
        console.error('Upload import error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Import failed',
        });
    }
});

/**
 * GET /api/context/profile/:projectId
 * Get codebase profile
 */
router.get('/profile/:projectId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        // Check in-memory first
        const contextBridge = getContextBridgeService();
        let profile = contextBridge.getProfile(projectId);

        // Then check database
        if (!profile) {
            const dbImport = await db.select()
                .from(contextBridgeImports)
                .where(eq(contextBridgeImports.projectId, projectId))
                .get();

            if (dbImport) {
                profile = dbImport.profile as unknown as CodebaseProfile;
            }
        }

        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'No codebase profile found for this project',
            });
        }

        res.json({
            success: true,
            profile,
        });
    } catch (error) {
        console.error('Error getting profile:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get profile',
        });
    }
});

/**
 * POST /api/context/analyze
 * Re-analyze codebase
 */
router.post('/analyze', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { projectId } = req.body;

        if (!projectId) {
            return res.status(400).json({
                success: false,
                error: 'projectId is required',
            });
        }

        const contextBridge = getContextBridgeService();
        const profile = await contextBridge.reanalyze(projectId);

        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'No existing import found to re-analyze',
            });
        }

        // Update database
        await db.update(contextBridgeImports)
            .set({
                profile: profile as any,
                patterns: profile.patterns as any,
                conventions: profile.conventions as any,
                lastSynced: new Date().toISOString(),
            })
            .where(eq(contextBridgeImports.projectId, projectId));

        res.json({
            success: true,
            profile,
        });
    } catch (error) {
        console.error('Error re-analyzing:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Re-analysis failed',
        });
    }
});

/**
 * GET /api/context/patterns/:projectId
 * Get detected patterns
 */
router.get('/patterns/:projectId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        const contextBridge = getContextBridgeService();
        let patterns = contextBridge.getPatterns(projectId);

        // Check database if not in memory
        if (patterns.length === 0) {
            const dbImport = await db.select()
                .from(contextBridgeImports)
                .where(eq(contextBridgeImports.projectId, projectId))
                .get();

            if (dbImport?.patterns) {
                patterns = dbImport.patterns as any[];
            }
        }

        res.json({
            success: true,
            patterns,
        });
    } catch (error) {
        console.error('Error getting patterns:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get patterns',
        });
    }
});

/**
 * POST /api/context/sync
 * Sync changes from source
 */
router.post('/sync', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { projectId } = req.body;

        if (!projectId) {
            return res.status(400).json({
                success: false,
                error: 'projectId is required',
            });
        }

        // Re-analyze is effectively a sync for now
        const contextBridge = getContextBridgeService();
        const profile = await contextBridge.reanalyze(projectId);

        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'No existing import found to sync',
            });
        }

        // Update database
        await db.update(contextBridgeImports)
            .set({
                profile: profile as any,
                patterns: profile.patterns as any,
                conventions: profile.conventions as any,
                lastSynced: new Date().toISOString(),
            })
            .where(eq(contextBridgeImports.projectId, projectId));

        res.json({
            success: true,
            profile,
            synced: true,
        });
    } catch (error) {
        console.error('Error syncing:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Sync failed',
        });
    }
});

/**
 * GET /api/context/github/repos
 * List GitHub repositories for authenticated user
 */
router.get('/github/repos', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { accessToken } = req.query;

        if (!accessToken || typeof accessToken !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'accessToken is required',
            });
        }

        const contextBridge = getContextBridgeService();
        const repos = await contextBridge.listGitHubRepos(accessToken);

        res.json({
            success: true,
            repos,
        });
    } catch (error) {
        console.error('Error listing repos:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list repos',
        });
    }
});

/**
 * GET /api/context/github/branches
 * List branches for a GitHub repository
 */
router.get('/github/branches', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { owner, repo, accessToken } = req.query;

        if (!owner || !repo || !accessToken ||
            typeof owner !== 'string' || typeof repo !== 'string' || typeof accessToken !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'owner, repo, and accessToken are required',
            });
        }

        const contextBridge = getContextBridgeService();
        const branches = await contextBridge.getGitHubBranches(owner, repo, accessToken);

        res.json({
            success: true,
            branches,
        });
    } catch (error) {
        console.error('Error listing branches:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list branches',
        });
    }
});

/**
 * GET /api/context/stream/:projectId
 * SSE endpoint for real-time updates
 */
router.get('/stream/:projectId', authMiddleware, (req: Request, res: Response) => {
    const { projectId } = req.params;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Register client
    if (!sseClients.has(projectId)) {
        sseClients.set(projectId, []);
    }
    sseClients.get(projectId)!.push(res);

    // Send initial ping
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Handle disconnect
    req.on('close', () => {
        const clients = sseClients.get(projectId);
        if (clients) {
            const index = clients.indexOf(res);
            if (index > -1) {
                clients.splice(index, 1);
            }
            if (clients.length === 0) {
                sseClients.delete(projectId);
            }
        }
    });
});

/**
 * Broadcast to all SSE clients for a project
 */
function broadcastToProject(projectId: string, data: unknown): void {
    const clients = sseClients.get(projectId);
    if (clients) {
        const message = JSON.stringify(data);
        clients.forEach(client => {
            try {
                client.write(`data: ${message}\n\n`);
            } catch {
                // Client disconnected
            }
        });
    }
}

export default router;

