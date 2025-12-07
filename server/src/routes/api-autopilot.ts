/**
 * API Autopilot Routes
 *
 * Endpoints for API discovery, integration, and code generation.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
    getAPIAutopilotService,
    API_CATALOG,
    type APIProfile,
    type APIIntegration,
} from '../services/api/api-autopilot.js';
import { db } from '../db.js';
import { apiIntegrations } from '../schema.js';
import { eq, and } from 'drizzle-orm';

const router = Router();

// SSE clients for real-time updates
const sseClients = new Map<string, Response[]>();

/**
 * GET /api/autopilot/catalog
 * Get popular API catalog
 */
router.get('/catalog', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { category, search } = req.query;
        const autopilot = getAPIAutopilotService();

        let results;
        if (search && typeof search === 'string') {
            results = autopilot.searchCatalog(search);
        } else if (category && typeof category === 'string') {
            results = autopilot.getCatalog(category);
        } else {
            results = autopilot.getCatalog();
        }

        const categories = autopilot.getCategories();

        res.json({
            success: true,
            catalog: results,
            categories,
            total: results.length,
        });
    } catch (error) {
        console.error('Error getting catalog:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get catalog',
        });
    }
});

/**
 * POST /api/autopilot/discover
 * Discover API from URL or name
 */
router.post('/discover', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { docUrl, docContent, provider } = req.body;
        const autopilot = getAPIAutopilotService();

        let profile: APIProfile;

        if (provider) {
            // Use catalog entry
            profile = await autopilot.createProfileFromCatalog(provider);
        } else if (docUrl) {
            // Discover from URL
            profile = await autopilot.discoverAPI(docUrl, docContent);
        } else {
            return res.status(400).json({
                success: false,
                error: 'Either provider or docUrl is required',
            });
        }

        res.json({
            success: true,
            profile,
        });
    } catch (error) {
        console.error('Error discovering API:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'API discovery failed',
        });
    }
});

/**
 * POST /api/autopilot/analyze
 * Analyze API documentation (with content)
 */
router.post('/analyze', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { docUrl, docContent, openApiSpec } = req.body;

        if (!docUrl && !openApiSpec) {
            return res.status(400).json({
                success: false,
                error: 'Either docUrl or openApiSpec is required',
            });
        }

        const autopilot = getAPIAutopilotService();
        const profile = await autopilot.discoverAPI(docUrl || 'openapi-spec', docContent || JSON.stringify(openApiSpec));

        res.json({
            success: true,
            profile,
        });
    } catch (error) {
        console.error('Error analyzing API:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'API analysis failed',
        });
    }
});

/**
 * POST /api/autopilot/integrate
 * Create an integration for a project
 */
router.post('/integrate', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { projectId, profile } = req.body;

        if (!projectId || !profile) {
            return res.status(400).json({
                success: false,
                error: 'projectId and profile are required',
            });
        }

        const autopilot = getAPIAutopilotService();
        const integration = autopilot.createIntegration(projectId, profile);

        // Save to database
        await db.insert(apiIntegrations).values({
            id: integration.id,
            projectId,
            provider: profile.provider,
            profile: profile as any,
            credentials: null,
            generatedCode: null,
            status: 'configured',
            createdAt: new Date().toISOString(),
        });

        res.json({
            success: true,
            integration: {
                id: integration.id,
                projectId: integration.projectId,
                provider: integration.apiProfile.provider,
                name: integration.apiProfile.name,
                status: integration.status,
            },
        });
    } catch (error) {
        console.error('Error creating integration:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Integration creation failed',
        });
    }
});

/**
 * POST /api/autopilot/credentials
 * Store API credentials securely
 */
router.post('/credentials', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { integrationId, credentials } = req.body;

        if (!integrationId || !credentials) {
            return res.status(400).json({
                success: false,
                error: 'integrationId and credentials are required',
            });
        }

        const autopilot = getAPIAutopilotService();
        autopilot.storeCredentials(integrationId, credentials);

        // Update database with encrypted credentials
        const integration = autopilot.getIntegration(integrationId);
        if (integration) {
            await db.update(apiIntegrations)
                .set({
                    credentials: JSON.stringify(integration.credentials),
                    status: integration.status,
                })
                .where(eq(apiIntegrations.id, integrationId));
        }

        res.json({
            success: true,
            message: 'Credentials stored securely',
        });
    } catch (error) {
        console.error('Error storing credentials:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to store credentials',
        });
    }
});

/**
 * POST /api/autopilot/generate
 * Generate integration code
 */
router.post('/generate', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { integrationId, profile } = req.body;

        if (!integrationId && !profile) {
            return res.status(400).json({
                success: false,
                error: 'Either integrationId or profile is required',
            });
        }

        const autopilot = getAPIAutopilotService();
        let targetProfile: APIProfile;

        if (integrationId) {
            const integration = autopilot.getIntegration(integrationId);
            if (!integration) {
                return res.status(404).json({
                    success: false,
                    error: 'Integration not found',
                });
            }
            targetProfile = integration.apiProfile;
        } else {
            targetProfile = profile;
        }

        const generatedCode = await autopilot.generateIntegrationCode(targetProfile);

        // Update database if integration exists
        if (integrationId) {
            await db.update(apiIntegrations)
                .set({
                    generatedCode: generatedCode as any,
                    status: 'configured',
                })
                .where(eq(apiIntegrations.id, integrationId));
        }

        res.json({
            success: true,
            generatedCode,
        });
    } catch (error) {
        console.error('Error generating code:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Code generation failed',
        });
    }
});

/**
 * POST /api/autopilot/test
 * Test generated integration
 */
router.post('/test', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { integrationId } = req.body;

        if (!integrationId) {
            return res.status(400).json({
                success: false,
                error: 'integrationId is required',
            });
        }

        const autopilot = getAPIAutopilotService();
        const result = await autopilot.testConnection(integrationId);

        // Update database
        const integration = autopilot.getIntegration(integrationId);
        if (integration) {
            await db.update(apiIntegrations)
                .set({ status: integration.status })
                .where(eq(apiIntegrations.id, integrationId));
        }

        res.json({
            success: true,
            testResult: result,
        });
    } catch (error) {
        console.error('Error testing integration:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Test failed',
        });
    }
});

/**
 * GET /api/autopilot/integrations/:projectId
 * Get all integrations for a project
 */
router.get('/integrations/:projectId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        const integrations = await db.select()
            .from(apiIntegrations)
            .where(eq(apiIntegrations.projectId, projectId))
            .all();

        res.json({
            success: true,
            integrations: integrations.map(i => ({
                id: i.id,
                projectId: i.projectId,
                provider: i.provider,
                profile: i.profile,
                status: i.status,
                hasCredentials: !!i.credentials,
                hasGeneratedCode: !!i.generatedCode,
                createdAt: i.createdAt,
            })),
        });
    } catch (error) {
        console.error('Error getting integrations:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get integrations',
        });
    }
});

/**
 * GET /api/autopilot/integration/:integrationId
 * Get integration details
 */
router.get('/integration/:integrationId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { integrationId } = req.params;

        const integration = await db.select()
            .from(apiIntegrations)
            .where(eq(apiIntegrations.id, integrationId))
            .get();

        if (!integration) {
            return res.status(404).json({
                success: false,
                error: 'Integration not found',
            });
        }

        res.json({
            success: true,
            integration: {
                id: integration.id,
                projectId: integration.projectId,
                provider: integration.provider,
                profile: integration.profile,
                generatedCode: integration.generatedCode,
                status: integration.status,
                hasCredentials: !!integration.credentials,
                createdAt: integration.createdAt,
            },
        });
    } catch (error) {
        console.error('Error getting integration:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get integration',
        });
    }
});

/**
 * DELETE /api/autopilot/integration/:integrationId
 * Delete an integration
 */
router.delete('/integration/:integrationId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { integrationId } = req.params;

        await db.delete(apiIntegrations)
            .where(eq(apiIntegrations.id, integrationId));

        res.json({
            success: true,
            message: 'Integration deleted',
        });
    } catch (error) {
        console.error('Error deleting integration:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete integration',
        });
    }
});

/**
 * GET /api/autopilot/stream/:integrationId
 * SSE endpoint for real-time integration updates
 */
router.get('/stream/:integrationId', authMiddleware, (req: Request, res: Response) => {
    const { integrationId } = req.params;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Register client
    if (!sseClients.has(integrationId)) {
        sseClients.set(integrationId, []);
    }
    sseClients.get(integrationId)!.push(res);

    // Send initial ping
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Handle disconnect
    req.on('close', () => {
        const clients = sseClients.get(integrationId);
        if (clients) {
            const index = clients.indexOf(res);
            if (index > -1) {
                clients.splice(index, 1);
            }
            if (clients.length === 0) {
                sseClients.delete(integrationId);
            }
        }
    });
});

export default router;

