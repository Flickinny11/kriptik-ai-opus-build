/**
 * Integration OAuth Routes
 *
 * Handles OAuth connection flows via Nango.
 * Provides endpoints for:
 * - Listing available integrations
 * - Getting user's current connections
 * - Initiating OAuth flow
 * - Handling OAuth callbacks
 * - Disconnecting integrations
 * - Getting integration requirements for builds
 */

import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { nangoService, NANGO_INTEGRATIONS, type IntegrationId } from '../services/integrations/nango-service.js';
import { db } from '../db.js';
import { integrationConnections, integrationRequirements } from '../schema.js';
import { eq, and } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/integrations/available
 * List all available integrations
 */
router.get('/available', async (_req: Request, res: Response) => {
    try {
        const integrations = nangoService.listIntegrations();
        res.json({ integrations });
    } catch (error) {
        console.error('[Integrations] Failed to list integrations:', error);
        res.status(500).json({ error: 'Failed to list integrations' });
    }
});

/**
 * GET /api/integrations/status
 * Get Nango configuration status
 */
router.get('/status', async (_req: Request, res: Response) => {
    try {
        const configured = nangoService.isConfigured();
        const publicKey = nangoService.getPublicKey();
        res.json({
            configured,
            publicKey: configured ? publicKey : null,
            integrationCount: Object.keys(NANGO_INTEGRATIONS).length,
        });
    } catch (error) {
        console.error('[Integrations] Failed to get status:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
});

/**
 * GET /api/integrations/connections
 * Get user's current connections
 */
router.get('/connections', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        // Get connections from database
        const dbConnections = await db.select()
            .from(integrationConnections)
            .where(eq(integrationConnections.userId, userId));

        // Verify each connection is still valid with Nango
        const connections = await Promise.all(
            dbConnections.map(async (conn) => {
                const isValid = await nangoService.isConnected({
                    integrationId: conn.integrationId as IntegrationId,
                    userId,
                });
                return {
                    ...conn,
                    isValid,
                    integration: nangoService.getIntegrationInfo(conn.integrationId),
                };
            })
        );

        res.json({ connections });
    } catch (error) {
        console.error('[Integrations] Failed to get connections:', error);
        res.status(500).json({ error: 'Failed to get connections' });
    }
});

/**
 * POST /api/integrations/connect
 * Initiate OAuth flow for an integration
 */
router.post('/connect', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { integrationId, projectId, redirectUrl } = req.body as {
            integrationId: string;
            projectId?: string;
            redirectUrl: string;
        };

        if (!integrationId || !NANGO_INTEGRATIONS[integrationId as IntegrationId]) {
            return res.status(400).json({ error: 'Invalid integration ID' });
        }

        if (!redirectUrl) {
            return res.status(400).json({ error: 'Redirect URL is required' });
        }

        const authUrl = await nangoService.getOAuthUrl({
            integrationId: integrationId as IntegrationId,
            userId,
            projectId,
            redirectUrl,
        });

        res.json({ authUrl });
    } catch (error) {
        console.error('[Integrations] Failed to initiate OAuth:', error);
        res.status(500).json({ error: 'Failed to initiate OAuth flow' });
    }
});

/**
 * POST /api/integrations/callback
 * Handle OAuth callback and store connection
 */
router.post('/callback', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { integrationId, projectId } = req.body as {
            integrationId: string;
            projectId?: string;
        };

        if (!integrationId) {
            return res.status(400).json({ error: 'Integration ID is required' });
        }

        // Verify connection exists in Nango
        const connection = await nangoService.getConnection({
            integrationId: integrationId as IntegrationId,
            userId,
        });

        if (!connection) {
            return res.status(400).json({ error: 'Connection not found in Nango' });
        }

        // Check if connection already exists in database
        const existing = await db.select()
            .from(integrationConnections)
            .where(and(
                eq(integrationConnections.userId, userId),
                eq(integrationConnections.integrationId, integrationId)
            ))
            .limit(1);

        let stored;
        if (existing.length > 0) {
            // Update existing connection
            const [updated] = await db.update(integrationConnections)
                .set({
                    status: 'connected',
                    nangoConnectionId: connection.connectionId,
                    expiresAt: connection.credentials.expiresAt,
                    lastSyncAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(integrationConnections.id, existing[0].id))
                .returning();
            stored = updated;
        } else {
            // Insert new connection
            const [inserted] = await db.insert(integrationConnections)
                .values({
                    userId,
                    projectId,
                    integrationId,
                    nangoConnectionId: connection.connectionId,
                    status: 'connected',
                    expiresAt: connection.credentials.expiresAt,
                    lastSyncAt: new Date().toISOString(),
                })
                .returning();
            stored = inserted;
        }

        // Update any pending requirements for this integration
        await db.update(integrationRequirements)
            .set({
                connected: true,
                connectionId: stored.id
            })
            .where(and(
                eq(integrationRequirements.integrationId, integrationId),
                eq(integrationRequirements.connected, false)
            ));

        res.json({
            success: true,
            connection: stored,
            integration: nangoService.getIntegrationInfo(integrationId as IntegrationId),
        });
    } catch (error) {
        console.error('[Integrations] OAuth callback failed:', error);
        res.status(500).json({ error: 'OAuth callback failed' });
    }
});

/**
 * DELETE /api/integrations/disconnect/:integrationId
 * Disconnect an integration
 */
router.delete('/disconnect/:integrationId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { integrationId } = req.params;

        // Delete from Nango
        await nangoService.deleteConnection({
            integrationId: integrationId as IntegrationId,
            userId,
        });

        // Update database
        await db.update(integrationConnections)
            .set({ status: 'revoked', updatedAt: new Date().toISOString() })
            .where(and(
                eq(integrationConnections.userId, userId),
                eq(integrationConnections.integrationId, integrationId)
            ));

        res.json({ success: true });
    } catch (error) {
        console.error('[Integrations] Disconnect failed:', error);
        res.status(500).json({ error: 'Failed to disconnect' });
    }
});

/**
 * GET /api/integrations/requirements/:buildIntentId
 * Get integration requirements for a build
 */
router.get('/requirements/:buildIntentId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { buildIntentId } = req.params;

        // Get requirements
        const requirements = await db.select()
            .from(integrationRequirements)
            .where(eq(integrationRequirements.buildIntentId, buildIntentId));

        // Check connection status for each
        const enrichedRequirements = await Promise.all(
            requirements.map(async (requirement) => {
                const isConnected = await nangoService.isConnected({
                    integrationId: requirement.integrationId as IntegrationId,
                    userId,
                });
                return {
                    ...requirement,
                    connected: isConnected,
                    integration: nangoService.getIntegrationInfo(requirement.integrationId as IntegrationId),
                };
            })
        );

        res.json({ requirements: enrichedRequirements });
    } catch (error) {
        console.error('[Integrations] Failed to get requirements:', error);
        res.status(500).json({ error: 'Failed to get requirements' });
    }
});

/**
 * GET /api/integrations/requirements/agent/:featureAgentId
 * Get integration requirements for a feature agent
 */
router.get('/requirements/agent/:featureAgentId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { featureAgentId } = req.params;

        // Get requirements
        const requirements = await db.select()
            .from(integrationRequirements)
            .where(eq(integrationRequirements.featureAgentId, featureAgentId));

        // Check connection status for each
        const enrichedRequirements = await Promise.all(
            requirements.map(async (requirement) => {
                const isConnected = await nangoService.isConnected({
                    integrationId: requirement.integrationId as IntegrationId,
                    userId,
                });
                return {
                    ...requirement,
                    connected: isConnected,
                    integration: nangoService.getIntegrationInfo(requirement.integrationId as IntegrationId),
                };
            })
        );

        res.json({ requirements: enrichedRequirements });
    } catch (error) {
        console.error('[Integrations] Failed to get agent requirements:', error);
        res.status(500).json({ error: 'Failed to get requirements' });
    }
});

/**
 * POST /api/integrations/requirements
 * Create integration requirements (called by Intent Lock or Feature Agent)
 */
router.post('/requirements', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { buildIntentId, featureAgentId, requirements } = req.body as {
            buildIntentId?: string;
            featureAgentId?: string;
            requirements: Array<{
                integrationId: string;
                integrationName: string;
                reason: string;
                required: boolean;
            }>;
        };

        if (!requirements || !Array.isArray(requirements) || requirements.length === 0) {
            return res.status(400).json({ error: 'Requirements array is required' });
        }

        if (!buildIntentId && !featureAgentId) {
            return res.status(400).json({ error: 'Either buildIntentId or featureAgentId is required' });
        }

        const inserted = await db.insert(integrationRequirements)
            .values(
                requirements.map((r) => ({
                    buildIntentId: buildIntentId || null,
                    featureAgentId: featureAgentId || null,
                    integrationId: r.integrationId,
                    integrationName: r.integrationName,
                    reason: r.reason,
                    required: r.required,
                    connected: false,
                }))
            )
            .returning();

        res.json({ requirements: inserted });
    } catch (error) {
        console.error('[Integrations] Failed to create requirements:', error);
        res.status(500).json({ error: 'Failed to create requirements' });
    }
});

/**
 * GET /api/integrations/token/:integrationId
 * Get access token for an integration (for backend use during builds)
 */
router.get('/token/:integrationId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { integrationId } = req.params;

        const token = await nangoService.getAccessToken({
            integrationId: integrationId as IntegrationId,
            userId,
        });

        if (!token) {
            return res.status(404).json({ error: 'No connection found' });
        }

        res.json({ token });
    } catch (error) {
        console.error('[Integrations] Failed to get token:', error);
        res.status(500).json({ error: 'Failed to get token' });
    }
});

/**
 * GET /api/integrations/search
 * Search integrations by name or category
 */
router.get('/search', async (req: Request, res: Response) => {
    try {
        const { q, category } = req.query as { q?: string; category?: string };

        let integrations;
        if (category) {
            integrations = nangoService.listIntegrationsByCategory(category as Parameters<typeof nangoService.listIntegrationsByCategory>[0]);
        } else if (q) {
            integrations = nangoService.searchIntegrations(q);
        } else {
            integrations = nangoService.listIntegrations();
        }

        res.json({ integrations });
    } catch (error) {
        console.error('[Integrations] Search failed:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

export default router;
