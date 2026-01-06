/**
 * Integration OAuth Routes
 *
 * Handles OAuth connection flows via Nango using the current
 * Connect Session Token flow (as of December 2025).
 *
 * Flow:
 * 1. Frontend calls POST /api/integrations/session to get a session token
 * 2. Frontend uses token to open Nango Connect UI
 * 3. User completes OAuth
 * 4. Nango sends webhook to POST /api/integrations/nango-webhook
 * 5. We store the connectionId for future use
 *
 * Endpoints:
 * - POST /api/integrations/session - Create a Connect Session token
 * - POST /api/integrations/nango-webhook - Handle Nango webhooks
 * - GET /api/integrations/available - List available integrations
 * - GET /api/integrations/connections - Get user's current connections
 * - DELETE /api/integrations/disconnect/:connectionId - Disconnect an integration
 * - GET /api/integrations/requirements/:buildIntentId - Get build requirements
 * - GET /api/integrations/token/:connectionId - Get access token for a connection
 */

import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { nangoService, NANGO_INTEGRATIONS, type IntegrationId, type NangoWebhookPayload } from '../services/integrations/nango-service.js';
import { db } from '../db.js';
import { integrationConnections, integrationRequirements, users } from '../schema.js';
import { eq, and } from 'drizzle-orm';

const router = Router();

/**
 * POST /api/integrations/session
 * Create a Connect Session token for the Nango Connect UI
 *
 * This is the NEW method (as of 2025) - replaces the deprecated public key approach.
 * The token is short-lived (30 minutes) and tied to a specific end user.
 */
router.post('/session', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const userEmail = req.user!.email;
        const { allowedIntegrations } = req.body as {
            allowedIntegrations?: string[];
        };

        if (!nangoService.isConfigured()) {
            return res.status(503).json({
                error: 'OAuth service not configured',
                message: 'NANGO_SECRET_KEY is not set'
            });
        }

        const session = await nangoService.createConnectSession({
            userId,
            userEmail,
            allowedIntegrations,
        });

        res.json({
            token: session.token,
            expiresAt: session.expires_at,
            connectLink: session.connect_link,
        });
    } catch (error) {
        console.error('[Integrations] Failed to create session:', error);
        res.status(500).json({ error: 'Failed to create connect session' });
    }
});

/**
 * POST /api/integrations/session/reconnect
 * Create a reconnect session for updating expired credentials
 */
router.post('/session/reconnect', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const userEmail = req.user!.email;
        const { connectionId } = req.body as { connectionId: string };

        if (!connectionId) {
            return res.status(400).json({ error: 'connectionId is required' });
        }

        if (!nangoService.isConfigured()) {
            return res.status(503).json({ error: 'OAuth service not configured' });
        }

        const session = await nangoService.createReconnectSession(connectionId, {
            userId,
            userEmail,
        });

        res.json({
            token: session.token,
            expiresAt: session.expires_at,
        });
    } catch (error) {
        console.error('[Integrations] Failed to create reconnect session:', error);
        res.status(500).json({ error: 'Failed to create reconnect session' });
    }
});

/**
 * POST /api/integrations/nango-webhook
 * Handle webhooks from Nango when connections are created/updated/deleted
 *
 * Configure this URL in your Nango Dashboard:
 * - Go to Environment Settings
 * - Set Webhook URL to: https://your-backend.com/api/integrations/nango-webhook
 * - Enable "Send New Connection Creation Webhooks"
 */
router.post('/nango-webhook', async (req: Request, res: Response) => {
    try {
        const payload = req.body as NangoWebhookPayload;

        // Validate the webhook payload
        if (!nangoService.validateWebhookPayload(payload)) {
            console.warn('[Integrations] Invalid webhook payload:', payload);
            return res.status(400).json({ error: 'Invalid webhook payload' });
        }

        console.log('[Integrations] Received webhook:', {
            type: payload.type,
            operation: payload.operation,
            success: payload.success,
            connectionId: payload.connectionId,
            provider: payload.providerConfigKey,
            endUser: payload.endUser?.endUserId,
        });

        // Handle connection creation
        if (payload.operation === 'creation' && payload.success) {
            const endUserId = payload.endUser?.endUserId;
            if (!endUserId) {
                console.warn('[Integrations] Webhook missing endUserId');
                return res.status(400).json({ error: 'Missing endUserId' });
            }

            // Check if connection already exists
            const existing = await db.select()
                .from(integrationConnections)
                .where(and(
                    eq(integrationConnections.userId, endUserId),
                    eq(integrationConnections.integrationId, payload.providerConfigKey)
                ))
                .limit(1);

            if (existing.length > 0) {
                // Update existing connection
                await db.update(integrationConnections)
                    .set({
                        nangoConnectionId: payload.connectionId,
                        status: 'connected',
                        lastSyncAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    })
                    .where(eq(integrationConnections.id, existing[0].id));

                console.log('[Integrations] Updated existing connection:', existing[0].id);
            } else {
                // Create new connection record
                const [inserted] = await db.insert(integrationConnections)
                    .values({
                        userId: endUserId,
                        integrationId: payload.providerConfigKey,
                        nangoConnectionId: payload.connectionId,
                        status: 'connected',
                        lastSyncAt: new Date().toISOString(),
                    })
                    .returning();

                console.log('[Integrations] Created new connection:', inserted.id);

                // Update any pending requirements for this integration
                await db.update(integrationRequirements)
                    .set({
                        connected: true,
                        connectionId: inserted.id,
                    })
                    .where(and(
                        eq(integrationRequirements.integrationId, payload.providerConfigKey),
                        eq(integrationRequirements.connected, false)
                    ));
            }
        }

        // Handle connection refresh
        if (payload.operation === 'refresh' && payload.success) {
            const endUserId = payload.endUser?.endUserId;
            if (endUserId) {
                await db.update(integrationConnections)
                    .set({
                        status: 'connected',
                        lastSyncAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    })
                    .where(and(
                        eq(integrationConnections.userId, endUserId),
                        eq(integrationConnections.integrationId, payload.providerConfigKey)
                    ));
            }
        }

        // Handle connection deletion
        if (payload.operation === 'deletion') {
            const endUserId = payload.endUser?.endUserId;
            if (endUserId) {
                await db.update(integrationConnections)
                    .set({
                        status: 'revoked',
                        updatedAt: new Date().toISOString(),
                    })
                    .where(and(
                        eq(integrationConnections.userId, endUserId),
                        eq(integrationConnections.integrationId, payload.providerConfigKey)
                    ));
            }
        }

        // Handle errors
        if (!payload.success && payload.error) {
            console.error('[Integrations] Connection error:', payload.error);
            const endUserId = payload.endUser?.endUserId;
            if (endUserId) {
                await db.update(integrationConnections)
                    .set({
                        status: 'error',
                        updatedAt: new Date().toISOString(),
                    })
                    .where(and(
                        eq(integrationConnections.userId, endUserId),
                        eq(integrationConnections.integrationId, payload.providerConfigKey)
                    ));
            }
        }

        // Always respond with 200 to acknowledge receipt
        res.status(200).json({ received: true });
    } catch (error) {
        console.error('[Integrations] Webhook processing error:', error);
        // Still return 200 to prevent Nango from retrying
        res.status(200).json({ received: true, error: 'Processing error' });
    }
});

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

        // Get configured integrations from Nango if configured
        let configuredIntegrations: string[] = [];
        if (configured) {
            const configs = await nangoService.getConfiguredIntegrations();
            configuredIntegrations = configs.map(c => c.unique_key);
        }

        res.json({
            configured,
            integrationCount: Object.keys(NANGO_INTEGRATIONS).length,
            configuredIntegrations,
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

        // Also get connections directly from Nango to ensure sync
        const nangoConnections = await nangoService.getConnectionsByEndUser(userId);

        // Merge and enrich connection data
        const connections = dbConnections.map((conn) => {
            const nangoConn = nangoConnections.find(
                nc => nc.provider_config_key === conn.integrationId
            );
            return {
                ...conn,
                isValid: !!nangoConn,
                integration: nangoService.getIntegrationInfo(conn.integrationId),
            };
        });

        res.json({ connections });
    } catch (error) {
        console.error('[Integrations] Failed to get connections:', error);
        res.status(500).json({ error: 'Failed to get connections' });
    }
});

/**
 * DELETE /api/integrations/disconnect/:integrationId
 * Disconnect an integration by integration ID
 */
router.delete('/disconnect/:integrationId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { integrationId } = req.params;

        // Get the connection from database
        const [conn] = await db.select()
            .from(integrationConnections)
            .where(and(
                eq(integrationConnections.userId, userId),
                eq(integrationConnections.integrationId, integrationId)
            ))
            .limit(1);

        if (!conn) {
            return res.status(404).json({ error: 'Connection not found' });
        }

        // Delete from Nango using the stored connectionId
        if (conn.nangoConnectionId) {
            await nangoService.deleteConnection(conn.nangoConnectionId, integrationId);
        }

        // Update database
        await db.update(integrationConnections)
            .set({ status: 'revoked', updatedAt: new Date().toISOString() })
            .where(eq(integrationConnections.id, conn.id));

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

        // Get user's connections to check status
        const userConnections = await db.select()
            .from(integrationConnections)
            .where(and(
                eq(integrationConnections.userId, userId),
                eq(integrationConnections.status, 'connected')
            ));

        // Enrich requirements with connection status
        const enrichedRequirements = requirements.map((requirement) => {
            const connection = userConnections.find(
                c => c.integrationId === requirement.integrationId
            );
            return {
                ...requirement,
                connected: !!connection,
                connectionId: connection?.id,
                integration: nangoService.getIntegrationInfo(requirement.integrationId as IntegrationId),
            };
        });

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

        // Get user's connections to check status
        const userConnections = await db.select()
            .from(integrationConnections)
            .where(and(
                eq(integrationConnections.userId, userId),
                eq(integrationConnections.status, 'connected')
            ));

        // Enrich requirements with connection status
        const enrichedRequirements = requirements.map((requirement) => {
            const connection = userConnections.find(
                c => c.integrationId === requirement.integrationId
            );
            return {
                ...requirement,
                connected: !!connection,
                connectionId: connection?.id,
                integration: nangoService.getIntegrationInfo(requirement.integrationId as IntegrationId),
            };
        });

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

        // Get the connection from database
        const [conn] = await db.select()
            .from(integrationConnections)
            .where(and(
                eq(integrationConnections.userId, userId),
                eq(integrationConnections.integrationId, integrationId),
                eq(integrationConnections.status, 'connected')
            ))
            .limit(1);

        if (!conn || !conn.nangoConnectionId) {
            return res.status(404).json({ error: 'No connection found' });
        }

        // Get token from Nango (auto-refreshes if expired)
        const token = await nangoService.getAccessToken(conn.nangoConnectionId, integrationId);

        if (!token) {
            return res.status(404).json({ error: 'Could not retrieve token' });
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

/**
 * GET /api/integrations/configured
 * Get list of integrations that have been configured in Nango (have OAuth credentials)
 */
router.get('/configured', authMiddleware, async (_req: Request, res: Response) => {
    try {
        if (!nangoService.isConfigured()) {
            return res.status(503).json({ error: 'OAuth service not configured' });
        }

        const configs = await nangoService.getConfiguredIntegrations();
        res.json({ integrations: configs });
    } catch (error) {
        console.error('[Integrations] Failed to get configured integrations:', error);
        res.status(500).json({ error: 'Failed to get configured integrations' });
    }
});

export default router;
