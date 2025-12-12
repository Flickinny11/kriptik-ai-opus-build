/**
 * Notifications API Routes
 *
 * Used by Dashboard Notifications UI (Prompt 3.2).
 */

import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getNotificationService } from '../services/notifications/notification-service.js';
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

export default router;


