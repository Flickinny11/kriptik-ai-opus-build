/**
 * Notifications API Routes
 *
 * Used by Dashboard Notifications UI (Prompt 3.2).
 * Includes credential submission flow for paused builds.
 */

import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getNotificationService } from '../services/notifications/notification-service.js';
import { writeCredentialsToProjectEnv } from '../services/credentials/credential-env-bridge.js';
import { triggerCredentialIntegration } from '../services/credentials/credential-integration-service.js';
import { db } from '../db.js';
import { notifications } from '../schema.js';
import { and, eq } from 'drizzle-orm';

const router = Router();
const requireAuth = authMiddleware;
const notificationService = getNotificationService();

router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const limit = typeof req.query.limit === 'string' ? Math.max(1, Math.min(200, Number(req.query.limit))) : 50;
        const notifications = await notificationService.listNotifications(userId, Number.isFinite(limit) ? limit : 50);
        res.json({ success: true, notifications });
    } catch (error) {
        console.error('[Notifications] List error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list notifications' });
    }
});

router.post('/:id/read', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        await notificationService.markRead(userId, req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[Notifications] Mark read error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to mark read' });
    }
});

router.post('/:id/dismiss', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        await notificationService.dismiss(userId, req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[Notifications] Dismiss error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to dismiss' });
    }
});

router.post('/:id/approve-recommendation', requireAuth, async (_req: Request, res: Response) => {
    try {
        const userId = _req.user!.id;
        const id = _req.params.id;

        await db.update(notifications)
            .set({ read: true })
            .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));

        res.json({ success: true });
    } catch (error) {
        console.error('[Notifications] Approve recommendation error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to approve recommendation' });
    }
});

router.post('/:id/alternative-solution', requireAuth, async (req: Request, res: Response) => {
    // Alternative solutions are stored by feature agents / orchestration services; this endpoint provides
    // a stable contract for the UI. We validate input and return success.
    try {
        const userId = req.user!.id;
        const id = req.params.id;
        const { text } = req.body || {};
    if (typeof text !== 'string' || text.trim().length < 3) {
        return res.status(400).json({ error: 'text is required' });
    }

        // Store alternative solution in metadata, mark as read.
        const row = await db.select()
            .from(notifications)
            .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
            .limit(1);

        if (row.length === 0) return res.status(404).json({ error: 'Notification not found' });

        const currentMeta = (() => {
            try {
                return row[0].metadata ? JSON.parse(row[0].metadata) : {};
            } catch {
                return {};
            }
        })();

        const nextMeta = {
            ...currentMeta,
            alternativeSolution: { text: text.trim(), submittedAt: new Date().toISOString() },
        };

        await db.update(notifications)
            .set({ metadata: JSON.stringify(nextMeta), read: true })
            .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));

        res.json({ success: true });
    } catch (error) {
        console.error('[Notifications] Alternative solution error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to store alternative solution' });
    }
});

router.post('/preferences', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { email, phone, slackWebhook, pushEnabled, pushSubscription } = req.body || {};
        await notificationService.savePreferences({
            userId,
            email: typeof email === 'string' ? email : null,
            phone: typeof phone === 'string' ? phone : null,
            slackWebhook: typeof slackWebhook === 'string' ? slackWebhook : null,
            pushEnabled: !!pushEnabled,
            pushSubscription: pushSubscription ?? null,
        });
        res.json({ success: true });
    } catch (error) {
        console.error('[Notifications] Save preferences error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save preferences' });
    }
});

router.get('/preferences', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const prefs = await notificationService.getPreferences(userId);
        res.json({ success: true, prefs });
    } catch (error) {
        console.error('[Notifications] Get preferences error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get preferences' });
    }
});

/**
 * GET /api/notifications/project/:projectId
 * Get notifications for a specific project
 */
router.get('/project/:projectId', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { projectId } = req.params;
        const limit = typeof req.query.limit === 'string' ? Math.max(1, Math.min(50, Number(req.query.limit))) : 20;

        const projectNotifications = await notificationService.listProjectNotifications(
            userId,
            projectId,
            Number.isFinite(limit) ? limit : 20
        );

        res.json({ success: true, notifications: projectNotifications });
    } catch (error) {
        console.error('[Notifications] Project notifications error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get project notifications' });
    }
});

/**
 * GET /api/notifications/project/:projectId/unread-count
 * Get unread notification count for a specific project
 */
router.get('/project/:projectId/unread-count', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { projectId } = req.params;

        const count = await notificationService.getProjectUnreadCount(userId, projectId);

        res.json({ success: true, count });
    } catch (error) {
        console.error('[Notifications] Project unread count error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get unread count' });
    }
});

/**
 * POST /api/notifications/:id/submit-credentials
 * Submit credentials from a credentials_needed notification
 * 
 * This endpoint:
 * 1. Validates the notification belongs to the user
 * 2. Stores credentials in the vault and writes to .env
 * 3. Triggers integration setup (webhooks, configs, etc.)
 * 4. Signals the paused build to resume
 */
router.post('/:id/submit-credentials', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const notificationId = req.params.id;
        const { credentials } = req.body;

        // Validate input
        if (!credentials || typeof credentials !== 'object' || Object.keys(credentials).length === 0) {
            return res.status(400).json({ 
                error: 'credentials object is required with at least one key-value pair' 
            });
        }

        // Get the notification to extract metadata
        const [notification] = await db
            .select()
            .from(notifications)
            .where(and(
                eq(notifications.id, notificationId),
                eq(notifications.userId, userId)
            ))
            .limit(1);

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        // Parse metadata
        let metadata: Record<string, any> = {};
        try {
            metadata = notification.metadata ? JSON.parse(notification.metadata) : {};
        } catch {
            metadata = {};
        }

        const projectId = metadata.projectId as string | undefined;
        const sessionId = metadata.sessionId as string | undefined;

        if (!projectId) {
            return res.status(400).json({ error: 'Notification does not have an associated project' });
        }

        // 1. Write credentials to project's .env file and vault
        const envResult = await writeCredentialsToProjectEnv(
            projectId,
            userId,
            credentials as Record<string, string>,
            { environment: 'all', overwriteExisting: true }
        );

        console.log(`[Notifications:SubmitCredentials] Wrote ${envResult.credentialsWritten} credentials to project ${projectId}`);

        // 2. Trigger integration setup (webhooks, code generation, etc.)
        const credentialSubmissions = Object.entries(credentials).map(([envKey, value]) => ({
            envKey,
            value: value as string,
        }));

        const integrationResult = await triggerCredentialIntegration(
            projectId,
            userId,
            credentialSubmissions,
            sessionId
        );

        // 3. Mark notification as read and update metadata
        const updatedMetadata = {
            ...metadata,
            credentialsSubmitted: true,
            credentialsSubmittedAt: new Date().toISOString(),
            integrationResults: integrationResult.results,
        };

        await db.update(notifications)
            .set({
                read: true,
                metadata: JSON.stringify(updatedMetadata),
            })
            .where(eq(notifications.id, notificationId));

        // 4. Send success notification
        await notificationService.sendNotification(
            userId,
            ['push'],
            {
                type: 'build_resumed',
                title: 'Credentials Saved - Build Resuming',
                message: `Successfully saved ${envResult.credentialsWritten} credential(s). ${integrationResult.resumeBuildTriggered ? 'Your build is now resuming.' : 'Integration configured.'}`,
                featureAgentId: sessionId || null,
                featureAgentName: 'Build Orchestrator',
                actionUrl: `/builder/${projectId}`,
                metadata: {
                    projectId,
                    sessionId,
                    credentialsWritten: envResult.envKeys,
                    integrationResults: integrationResult.results.map(r => ({
                        integration: r.integration,
                        success: r.success,
                        tasksCompleted: r.tasksCompleted,
                    })),
                },
            }
        );

        res.json({
            success: true,
            credentialsWritten: envResult.credentialsWritten,
            envKeys: envResult.envKeys,
            integrationResults: integrationResult.results,
            buildResumed: integrationResult.resumeBuildTriggered,
        });

    } catch (error) {
        console.error('[Notifications] Submit credentials error:', error);
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Failed to submit credentials' 
        });
    }
});

/**
 * GET /api/notifications/:id/credential-requirements
 * Get the credential requirements for a credentials_needed notification
 */
router.get('/:id/credential-requirements', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const notificationId = req.params.id;

        const [notification] = await db
            .select()
            .from(notifications)
            .where(and(
                eq(notifications.id, notificationId),
                eq(notifications.userId, userId)
            ))
            .limit(1);

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        let metadata: Record<string, any> = {};
        try {
            metadata = notification.metadata ? JSON.parse(notification.metadata) : {};
        } catch {
            metadata = {};
        }

        const requiredCredentials = metadata.requiredCredentials || [];

        res.json({
            success: true,
            projectId: metadata.projectId,
            sessionId: metadata.sessionId,
            buildPaused: metadata.buildPaused,
            requiredCredentials,
            oauthConnectLinks: metadata.oauthConnectLinks || [],
        });

    } catch (error) {
        console.error('[Notifications] Get credential requirements error:', error);
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Failed to get credential requirements' 
        });
    }
});

export default router;


