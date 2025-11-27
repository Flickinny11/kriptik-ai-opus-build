/**
 * Provisioning API Routes
 *
 * One-click infrastructure setup endpoints.
 */

import { Router, Request, Response } from 'express';
import {
    getDatabaseProvisioningService,
    generateSchema,
    DatabaseProvider,
} from '../services/provisioning/database.js';
import {
    getAuthProvisioningService,
    AuthProvider,
} from '../services/provisioning/auth.js';

const router = Router();

// ============================================================================
// DATABASE PROVISIONING
// ============================================================================

/**
 * GET /api/provisioning/database/providers
 * List available database providers
 */
router.get('/database/providers', async (req: Request, res: Response) => {
    const service = getDatabaseProvisioningService();
    const providers = service.getAvailableProviders();
    res.json({ providers });
});

/**
 * POST /api/provisioning/database
 * Provision a new database
 */
router.post('/database', async (req: Request, res: Response) => {
    try {
        const { provider, projectName, region, plan } = req.body;

        if (!provider || !projectName) {
            return res.status(400).json({ error: 'provider and projectName are required' });
        }

        const service = getDatabaseProvisioningService();
        const result = await service.provision({
            provider: provider as DatabaseProvider,
            projectName,
            region,
            plan,
        });

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Provisioning failed',
        });
    }
});

/**
 * POST /api/provisioning/database/with-schema
 * Provision database and generate schema
 */
router.post('/database/with-schema', async (req: Request, res: Response) => {
    try {
        const { provider, projectName, region, plan, schemaDescription, framework } = req.body;

        if (!provider || !projectName || !schemaDescription) {
            return res.status(400).json({
                error: 'provider, projectName, and schemaDescription are required'
            });
        }

        const service = getDatabaseProvisioningService();
        const result = await service.provisionWithSchema(
            {
                provider: provider as DatabaseProvider,
                projectName,
                region,
                plan,
            },
            {
                description: schemaDescription,
                framework: framework || 'drizzle',
            }
        );

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Provisioning failed',
        });
    }
});

/**
 * POST /api/provisioning/database/generate-schema
 * Generate schema from description (without provisioning)
 */
router.post('/database/generate-schema', async (req: Request, res: Response) => {
    try {
        const { description, existingSchema, framework } = req.body;

        if (!description) {
            return res.status(400).json({ error: 'description is required' });
        }

        const result = await generateSchema({
            description,
            existingSchema,
            framework: framework || 'drizzle',
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Schema generation failed',
        });
    }
});

// ============================================================================
// AUTH PROVISIONING
// ============================================================================

/**
 * GET /api/provisioning/auth/providers
 * List available auth providers
 */
router.get('/auth/providers', async (req: Request, res: Response) => {
    const service = getAuthProvisioningService();
    const providers = service.getAvailableProviders();
    res.json({ providers });
});

/**
 * GET /api/provisioning/auth/recommend
 * Get recommended auth provider based on requirements
 */
router.get('/auth/recommend', async (req: Request, res: Response) => {
    const { selfHosted, enterprise, includesDatabase, budget } = req.query;

    const service = getAuthProvisioningService();
    const recommendation = service.getRecommendation({
        selfHosted: selfHosted === 'true',
        enterprise: enterprise === 'true',
        includesDatabase: includesDatabase === 'true',
        budget: budget as 'free' | 'paid' | undefined,
    });

    res.json(recommendation);
});

/**
 * POST /api/provisioning/auth
 * Provision authentication for a project
 */
router.post('/auth', async (req: Request, res: Response) => {
    try {
        const { provider, projectName, features, framework } = req.body;

        if (!provider || !projectName) {
            return res.status(400).json({ error: 'provider and projectName are required' });
        }

        const service = getAuthProvisioningService();
        const result = await service.provision({
            provider: provider as AuthProvider,
            projectName,
            features,
            framework,
        });

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Provisioning failed',
        });
    }
});

// ============================================================================
// FULL STACK PROVISIONING
// ============================================================================

/**
 * POST /api/provisioning/full-stack
 * Provision both database and auth in one call
 */
router.post('/full-stack', async (req: Request, res: Response) => {
    try {
        const {
            projectName,
            databaseProvider,
            authProvider,
            schemaDescription,
            framework,
            features,
        } = req.body;

        if (!projectName) {
            return res.status(400).json({ error: 'projectName is required' });
        }

        const results: {
            database?: unknown;
            auth?: unknown;
        } = {};

        // Provision database if requested
        if (databaseProvider) {
            const dbService = getDatabaseProvisioningService();

            if (schemaDescription) {
                results.database = await dbService.provisionWithSchema(
                    {
                        provider: databaseProvider as DatabaseProvider,
                        projectName,
                    },
                    {
                        description: schemaDescription,
                        framework: framework || 'drizzle',
                    }
                );
            } else {
                results.database = await dbService.provision({
                    provider: databaseProvider as DatabaseProvider,
                    projectName,
                });
            }
        }

        // Provision auth if requested
        if (authProvider) {
            const authService = getAuthProvisioningService();
            results.auth = await authService.provision({
                provider: authProvider as AuthProvider,
                projectName,
                features,
                framework,
            });
        }

        res.json({
            success: true,
            projectName,
            ...results,
        });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Provisioning failed',
        });
    }
});

export default router;

