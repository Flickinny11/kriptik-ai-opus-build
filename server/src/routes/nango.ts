/**
 * Nango OAuth Integration Routes
 *
 * Provides OAuth connection management via Nango's unified API.
 * Supports 60+ integrations including Stripe, GitHub, Vercel, etc.
 *
 * Routes:
 * - GET  /api/nango/integrations              - List supported integrations
 * - GET  /api/nango/auth-url                  - Get OAuth URL for an integration
 * - GET  /api/nango/connection/:integrationId - Check connection status
 * - POST /api/nango/disconnect/:integrationId - Disconnect an integration
 * - POST /api/nango/credentials/:integrationId - Get credentials from Nango connection
 */

import { Router, Request, Response } from 'express';
import { nangoService, NANGO_INTEGRATIONS, type IntegrationId } from '../services/integrations/nango-service.js';
import { writeCredentialsToProjectEnv } from '../services/credentials/credential-env-bridge.js';

const router = Router();

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Require authentication middleware
 */
function requireAuth(req: Request, res: Response, next: Function) {
    const userId = req.headers['x-user-id'] as string || (req as any).session?.userId;

    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    (req as any).userId = userId;
    next();
}

// ============================================================================
// PUBLIC ROUTES (Configuration Info)
// ============================================================================

/**
 * GET /api/nango/integrations
 * List all supported Nango integrations
 */
router.get('/integrations', (req: Request, res: Response) => {
    try {
        const { category } = req.query;

        let integrations = nangoService.listIntegrations();

        // Filter by category if provided
        if (category && typeof category === 'string') {
            integrations = integrations.filter(i => i.category === category);
        }

        res.json({
            success: true,
            integrations,
            totalCount: integrations.length,
            nangoConfigured: nangoService.isConfigured(),
        });
    } catch (error) {
        console.error('[Nango] Error listing integrations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list integrations',
        });
    }
});

/**
 * GET /api/nango/integrations/search
 * Search integrations by name or category
 */
router.get('/integrations/search', (req: Request, res: Response) => {
    try {
        const { q } = req.query;

        if (!q || typeof q !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Query parameter "q" is required',
            });
        }

        const results = nangoService.searchIntegrations(q);

        res.json({
            success: true,
            results,
            count: results.length,
        });
    } catch (error) {
        console.error('[Nango] Error searching integrations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search integrations',
        });
    }
});

/**
 * GET /api/nango/public-key
 * Get Nango public key for frontend use
 */
router.get('/public-key', (req: Request, res: Response) => {
    try {
        const publicKey = nangoService.getPublicKey();

        if (!publicKey) {
            return res.status(503).json({
                success: false,
                error: 'Nango is not configured on this server',
            });
        }

        res.json({
            success: true,
            publicKey,
        });
    } catch (error) {
        console.error('[Nango] Error getting public key:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get public key',
        });
    }
});

// ============================================================================
// AUTHENTICATED ROUTES
// ============================================================================

// Apply auth middleware to all routes below
router.use(requireAuth);

/**
 * GET /api/nango/auth-url
 * Generate OAuth URL for a user to connect an integration
 */
router.get('/auth-url', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const { integrationId, projectId, redirectUrl } = req.query;

        if (!integrationId || typeof integrationId !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'integrationId query parameter is required',
            });
        }

        // Check if integration exists
        const integration = NANGO_INTEGRATIONS[integrationId as IntegrationId];
        if (!integration) {
            return res.status(404).json({
                success: false,
                error: `Integration "${integrationId}" not found`,
            });
        }

        // Check if Nango is configured
        if (!nangoService.isConfigured()) {
            return res.status(503).json({
                success: false,
                error: 'Nango is not configured on this server',
            });
        }

        // Generate OAuth URL
        const authUrl = await nangoService.getOAuthUrl({
            integrationId: integrationId as IntegrationId,
            userId,
            projectId: projectId as string | undefined,
            redirectUrl: redirectUrl as string || `${req.protocol}://${req.get('host')}/oauth/callback`,
        });

        res.json({
            success: true,
            authUrl,
            integrationId,
            integrationName: integration.name,
        });
    } catch (error) {
        console.error('[Nango] Error generating auth URL:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate auth URL',
        });
    }
});

/**
 * GET /api/nango/connection/:integrationId
 * Check connection status for an integration
 */
router.get('/connection/:integrationId', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const { integrationId } = req.params;

        const connected = await nangoService.isConnected({
            integrationId,
            userId,
        });

        const integration = NANGO_INTEGRATIONS[integrationId as IntegrationId];

        res.json({
            success: true,
            connected,
            integrationId,
            integrationName: integration?.name || integrationId,
        });
    } catch (error) {
        console.error('[Nango] Error checking connection:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check connection status',
        });
    }
});

/**
 * GET /api/nango/connections
 * Get all connections for the current user
 */
router.get('/connections', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const { integrationIds } = req.query;

        let integrationIdList: IntegrationId[] | undefined;
        if (integrationIds && typeof integrationIds === 'string') {
            integrationIdList = integrationIds.split(',') as IntegrationId[];
        }

        const connections = await nangoService.getUserConnections(userId, integrationIdList);

        res.json({
            success: true,
            connections,
        });
    } catch (error) {
        console.error('[Nango] Error getting connections:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get connections',
        });
    }
});

/**
 * POST /api/nango/disconnect/:integrationId
 * Disconnect an integration
 */
router.post('/disconnect/:integrationId', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const { integrationId } = req.params;

        await nangoService.deleteConnection({
            integrationId,
            userId,
        });

        res.json({
            success: true,
            message: `Disconnected from ${integrationId}`,
        });
    } catch (error) {
        console.error('[Nango] Error disconnecting:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to disconnect integration',
        });
    }
});

/**
 * POST /api/nango/credentials/:integrationId
 * Get credentials from a Nango connection and optionally write to project .env
 *
 * This is called AFTER the user completes OAuth to fetch the tokens
 * and store them in the credential vault + .env file
 */
router.post('/credentials/:integrationId', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const { integrationId } = req.params;
        const { projectId, writeToEnv = true } = req.body;

        // Get the connection from Nango
        const connection = await nangoService.getConnection({
            integrationId,
            userId,
        });

        if (!connection) {
            return res.status(404).json({
                success: false,
                error: 'No connection found. Please connect via OAuth first.',
            });
        }

        // Extract credentials
        const credentials: Record<string, string> = {};
        const integration = NANGO_INTEGRATIONS[integrationId as IntegrationId];

        // Map Nango credentials to environment variables
        // Different integrations have different credential structures
        if (connection.credentials.accessToken) {
            // Most OAuth integrations use access_token
            const envKey = `${integrationId.toUpperCase().replace(/-/g, '_')}_ACCESS_TOKEN`;
            credentials[envKey] = connection.credentials.accessToken;
        }

        if (connection.credentials.refreshToken) {
            const envKey = `${integrationId.toUpperCase().replace(/-/g, '_')}_REFRESH_TOKEN`;
            credentials[envKey] = connection.credentials.refreshToken;
        }

        if (connection.credentials.apiKey) {
            // Some integrations use API keys instead of OAuth tokens
            const envKey = `${integrationId.toUpperCase().replace(/-/g, '_')}_API_KEY`;
            credentials[envKey] = connection.credentials.apiKey;
        }

        // If writeToEnv is true and projectId is provided, write to .env
        let envResult = null;
        if (writeToEnv && projectId) {
            envResult = await writeCredentialsToProjectEnv(
                projectId,
                userId,
                credentials,
                { environment: 'all', overwriteExisting: true }
            );
        }

        res.json({
            success: true,
            integrationId,
            integrationName: integration?.name || integrationId,
            credentials: Object.keys(credentials), // Return keys only, not values
            wroteToEnv: !!envResult,
            envResult: envResult ? {
                credentialsWritten: envResult.credentialsWritten,
                envKeys: envResult.envKeys,
            } : null,
        });
    } catch (error) {
        console.error('[Nango] Error getting credentials:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get credentials',
        });
    }
});

/**
 * GET /api/nango/token/:integrationId
 * Get access token for an integration (for internal API calls)
 */
router.get('/token/:integrationId', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const { integrationId } = req.params;

        const token = await nangoService.getAccessToken({
            integrationId,
            userId,
        });

        if (!token) {
            return res.status(404).json({
                success: false,
                error: 'No token found for this integration',
            });
        }

        // Only return masked token for security
        res.json({
            success: true,
            hasToken: true,
            tokenPreview: `${token.slice(0, 8)}...${token.slice(-4)}`,
        });
    } catch (error) {
        console.error('[Nango] Error getting token:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get token',
        });
    }
});

export default router;
