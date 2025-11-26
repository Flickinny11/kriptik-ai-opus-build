/**
 * OAuth Routes
 *
 * Handles OAuth authorization flows for third-party integrations.
 *
 * Routes:
 * - GET  /api/oauth/providers              - List available OAuth providers
 * - POST /api/oauth/:provider/authorize    - Start OAuth flow
 * - GET  /api/oauth/callback/:provider     - OAuth callback handler
 * - POST /api/oauth/:provider/refresh      - Refresh tokens
 * - POST /api/oauth/:provider/revoke       - Revoke connection
 * - GET  /api/oauth/:provider/status       - Check connection status
 */

import { Router, Request, Response } from 'express';
import { getOAuthManager } from '../services/oauth/oauth-manager';
import { OAuthProviderId } from '../services/oauth/types';

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
// PUBLIC ROUTES
// ============================================================================

/**
 * GET /api/oauth/providers
 * List all available OAuth providers
 */
router.get('/providers', async (req: Request, res: Response) => {
    try {
        const manager = getOAuthManager();
        const providers = manager.getAvailableProviders();

        res.json({
            providers: providers.map(p => ({
                id: p.id,
                name: p.name,
                configured: p.configured,
                authType: 'oauth',
            })),
        });
    } catch (error) {
        console.error('Error listing OAuth providers:', error);
        res.status(500).json({ error: 'Failed to list providers' });
    }
});

/**
 * GET /api/oauth/callback/:provider
 * OAuth callback handler - receives the authorization code
 */
router.get('/callback/:provider', async (req: Request, res: Response) => {
    try {
        const { provider } = req.params;
        const { code, state, error: oauthError, error_description } = req.query;

        // Handle OAuth errors from provider
        if (oauthError) {
            console.error('OAuth error from provider:', oauthError, error_description);
            return res.redirect(
                `/integrations?oauth_error=${encodeURIComponent(oauthError as string)}&provider=${provider}`
            );
        }

        if (!code || !state) {
            return res.redirect('/integrations?oauth_error=missing_params');
        }

        const manager = getOAuthManager();

        // Complete the OAuth flow
        const result = await manager.completeAuthorizationFlow(
            provider as OAuthProviderId,
            code as string,
            state as string
        );

        if (!result.success) {
            console.error('OAuth flow failed:', result.error);
            return res.redirect(
                `/integrations?oauth_error=${encodeURIComponent(result.error || 'unknown')}&provider=${provider}`
            );
        }

        // Success - redirect back to integrations page
        res.redirect(`/integrations?oauth_success=true&provider=${provider}`);
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect('/integrations?oauth_error=server_error');
    }
});

// ============================================================================
// AUTHENTICATED ROUTES
// ============================================================================

// Apply auth middleware to all routes below
router.use(requireAuth);

/**
 * POST /api/oauth/:provider/authorize
 * Start OAuth authorization flow
 */
router.post('/:provider/authorize', async (req: Request, res: Response) => {
    try {
        const { provider } = req.params;
        const userId = (req as any).userId;
        const { scopes, metadata } = req.body;

        const manager = getOAuthManager();

        // Check if provider is configured
        if (!manager.isProviderConfigured(provider as OAuthProviderId)) {
            return res.status(400).json({
                error: `OAuth provider '${provider}' is not configured`,
                configured: false,
            });
        }

        // Start authorization flow
        const result = await manager.startAuthorizationFlow(
            userId,
            provider as OAuthProviderId,
            { scopes, metadata }
        );

        if ('error' in result) {
            return res.status(400).json({ error: result.error });
        }

        res.json({
            authorizationUrl: result.authorizationUrl,
            state: result.state,
        });
    } catch (error) {
        console.error('Error starting OAuth flow:', error);
        res.status(500).json({ error: 'Failed to start authorization' });
    }
});

/**
 * POST /api/oauth/:provider/refresh
 * Refresh OAuth tokens
 */
router.post('/:provider/refresh', async (req: Request, res: Response) => {
    try {
        const { provider } = req.params;
        const userId = (req as any).userId;

        const manager = getOAuthManager();
        const result = await manager.refreshTokens(userId, provider as OAuthProviderId);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json({ success: true, message: 'Tokens refreshed successfully' });
    } catch (error) {
        console.error('Error refreshing tokens:', error);
        res.status(500).json({ error: 'Failed to refresh tokens' });
    }
});

/**
 * POST /api/oauth/:provider/revoke
 * Revoke OAuth connection
 */
router.post('/:provider/revoke', async (req: Request, res: Response) => {
    try {
        const { provider } = req.params;
        const userId = (req as any).userId;

        const manager = getOAuthManager();
        const result = await manager.revokeConnection(userId, provider as OAuthProviderId);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json({ success: true, message: 'Connection revoked successfully' });
    } catch (error) {
        console.error('Error revoking connection:', error);
        res.status(500).json({ error: 'Failed to revoke connection' });
    }
});

/**
 * GET /api/oauth/:provider/status
 * Check OAuth connection status
 */
router.get('/:provider/status', async (req: Request, res: Response) => {
    try {
        const { provider } = req.params;
        const userId = (req as any).userId;

        const manager = getOAuthManager();

        // Check if provider is configured
        if (!manager.isProviderConfigured(provider as OAuthProviderId)) {
            return res.json({
                connected: false,
                configured: false,
                provider,
            });
        }

        // Validate the connection
        const validation = await manager.validateConnection(userId, provider as OAuthProviderId);

        res.json({
            connected: validation.valid,
            configured: true,
            provider,
            error: validation.error,
        });
    } catch (error) {
        console.error('Error checking connection status:', error);
        res.status(500).json({ error: 'Failed to check connection status' });
    }
});

/**
 * GET /api/oauth/:provider/token
 * Get access token for API calls (for internal use)
 * Returns the decrypted access token for making API calls
 */
router.get('/:provider/token', async (req: Request, res: Response) => {
    try {
        const { provider } = req.params;
        const userId = (req as any).userId;

        const manager = getOAuthManager();
        const accessToken = await manager.getAccessToken(userId, provider as OAuthProviderId);

        if (!accessToken) {
            return res.status(404).json({
                error: 'No valid token found',
                needsReauthorization: true,
            });
        }

        // Only return masked token info for security
        res.json({
            hasToken: true,
            tokenPreview: `${accessToken.slice(0, 8)}...${accessToken.slice(-4)}`,
        });
    } catch (error) {
        console.error('Error getting token:', error);
        res.status(500).json({ error: 'Failed to get token' });
    }
});

export default router;

