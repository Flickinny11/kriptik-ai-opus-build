/**
 * Provisioning API Routes
 *
 * Endpoints for autonomous browser-based service provisioning:
 * - Start/resume provisioning sessions
 * - Manage user permissions
 * - Check session status
 * - View credentials
 */

import { Router, Request, Response } from 'express';
import {
    getProvisioningAgentService,
    getPermissionManagerService,
    getResearchAgentService,
    type ServiceRequirement,
} from '../services/provisioning/index.js';

const router = Router();

// ============================================================================
// HELPERS
// ============================================================================

function getUserId(req: Request): string | null {
    // Try session user first
    const sessionUser = (req as any).user;
    if (sessionUser?.id) {
        return sessionUser.id;
    }

    // Fallback to header
    const headerUserId = req.headers['x-user-id'];
    if (typeof headerUserId === 'string') {
        return headerUserId;
    }

    return null;
}

// ============================================================================
// PROVISIONING ROUTES
// ============================================================================

/**
 * POST /api/provisioning/start
 * Start a new provisioning session for a project
 */
router.post('/start', async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { projectId, orchestrationRunId, requirements } = req.body as {
            projectId: string;
            orchestrationRunId?: string;
            requirements: ServiceRequirement[];
        };

        if (!projectId || !requirements || requirements.length === 0) {
            return res.status(400).json({
                error: 'Missing required fields: projectId and requirements'
            });
        }

        const provisioningService = getProvisioningAgentService();
        const result = await provisioningService.startProvisioning({
            projectId,
            userId,
            orchestrationRunId,
            requirements,
        });

        res.json(result);
    } catch (error) {
        console.error('[Provisioning] Start error:', error);
        res.status(500).json({
            error: 'Failed to start provisioning',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/provisioning/:sessionId/resume
 * Resume a provisioning session after user approval
 */
router.post('/:sessionId/resume', async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { sessionId } = req.params;
        const { approvedServices } = req.body as {
            approvedServices: string[];
        };

        if (!approvedServices || approvedServices.length === 0) {
            return res.status(400).json({
                error: 'No services approved'
            });
        }

        const provisioningService = getProvisioningAgentService();
        const result = await provisioningService.resumeProvisioning(
            sessionId,
            approvedServices
        );

        res.json(result);
    } catch (error) {
        console.error('[Provisioning] Resume error:', error);
        res.status(500).json({
            error: 'Failed to resume provisioning',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/provisioning/:sessionId/status
 * Get the status of a provisioning session
 */
router.get('/:sessionId/status', async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { sessionId } = req.params;

        const provisioningService = getProvisioningAgentService();
        const status = await provisioningService.getSessionStatus(sessionId);

        res.json(status);
    } catch (error) {
        console.error('[Provisioning] Status error:', error);
        res.status(500).json({
            error: 'Failed to get session status',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/provisioning/:sessionId/cancel
 * Cancel a provisioning session
 */
router.post('/:sessionId/cancel', async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { sessionId } = req.params;

        const provisioningService = getProvisioningAgentService();
        await provisioningService.cancelSession(sessionId);

        res.json({ success: true });
    } catch (error) {
        console.error('[Provisioning] Cancel error:', error);
        res.status(500).json({
            error: 'Failed to cancel session',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// PERMISSION ROUTES
// ============================================================================

/**
 * GET /api/provisioning/permissions
 * Get the current user's browser agent permissions
 */
router.get('/permissions', async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const permissionManager = getPermissionManagerService();
        const permissions = await permissionManager.getUserPermissions(userId);

        if (!permissions) {
            return res.json({ configured: false });
        }

        res.json(permissions);
    } catch (error) {
        console.error('[Provisioning] Get permissions error:', error);
        res.status(500).json({
            error: 'Failed to get permissions',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/provisioning/permissions/summary
 * Get a summary of user's permission setup
 */
router.get('/permissions/summary', async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const permissionManager = getPermissionManagerService();
        const summary = await permissionManager.getPermissionsSummary(userId);

        res.json(summary);
    } catch (error) {
        console.error('[Provisioning] Get permissions summary error:', error);
        res.status(500).json({
            error: 'Failed to get permissions summary',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * PUT /api/provisioning/permissions
 * Update the current user's browser agent permissions
 */
router.put('/permissions', async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const updates = req.body;

        const permissionManager = getPermissionManagerService();

        // Check if user has permissions, create default if not
        const existing = await permissionManager.getUserPermissions(userId);
        if (!existing) {
            // Get user email from session or request
            const email = (req as any).user?.email || updates.primaryEmail || '';
            await permissionManager.createDefaultPermissions(userId, email);
        }

        const permissions = await permissionManager.updatePermissions(userId, updates);

        res.json(permissions);
    } catch (error) {
        console.error('[Provisioning] Update permissions error:', error);
        res.status(500).json({
            error: 'Failed to update permissions',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/provisioning/permissions/initialize
 * Initialize default permissions for a user
 */
router.post('/permissions/initialize', async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { email } = req.body as { email: string };

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const permissionManager = getPermissionManagerService();
        const permissions = await permissionManager.createDefaultPermissions(userId, email);

        res.json(permissions);
    } catch (error) {
        console.error('[Provisioning] Initialize permissions error:', error);
        res.status(500).json({
            error: 'Failed to initialize permissions',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// RESEARCH ROUTES
// ============================================================================

/**
 * POST /api/provisioning/research
 * Research services without starting provisioning
 */
router.post('/research', async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { requirements } = req.body as {
            requirements: ServiceRequirement[];
        };

        if (!requirements || requirements.length === 0) {
            return res.status(400).json({ error: 'No requirements provided' });
        }

        const researchAgent = getResearchAgentService();
        const results = [];

        for (const req of requirements) {
            const knowledge = researchAgent.getServiceKnowledge(req.provider || req.serviceType);
            if (knowledge) {
                results.push({
                    serviceName: req.serviceType,
                    ...knowledge,
                });
            } else {
                results.push({
                    serviceName: req.serviceType,
                    provider: req.provider || 'Unknown',
                    signupUrl: '',
                    hasFreeTier: false,
                    credentialsToFetch: req.envVarsNeeded,
                });
            }
        }

        res.json({ results });
    } catch (error) {
        console.error('[Provisioning] Research error:', error);
        res.status(500).json({
            error: 'Failed to research services',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/provisioning/services/:category
 * Get known services for a category
 */
router.get('/services/:category', async (req: Request, res: Response) => {
    try {
        const { category } = req.params;

        const researchAgent = getResearchAgentService();
        const services = researchAgent.getKnownServicesByCategory(category);

        const details = services.map(serviceName => {
            const knowledge = researchAgent.getServiceKnowledge(serviceName);
            return {
                id: serviceName,
                ...knowledge,
            };
        });

        res.json({ category, services: details });
    } catch (error) {
        console.error('[Provisioning] Get services error:', error);
        res.status(500).json({
            error: 'Failed to get services',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

export default router;
