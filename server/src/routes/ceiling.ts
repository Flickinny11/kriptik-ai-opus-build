/**
 * Credit Ceiling API Routes
 *
 * Endpoints for managing user credit ceilings and notifications:
 * - GET /api/ceiling/status - Get current ceiling status
 * - PUT /api/ceiling - Update credit ceiling
 * - PUT /api/ceiling/preferences - Update notification preferences
 * - DELETE /api/ceiling/history - Clear notification history (testing)
 */

import { Router } from 'express';
import { getCeilingNotificationService } from '../services/notifications/ceiling-notification-service.js';
import { getCreditService } from '../services/billing/credits.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/ceiling/status
 * Get current ceiling status and usage
 */
router.get('/status', authMiddleware, async (req, res) => {
    try {
        const userId = req.user!.id;

        const ceilingService = getCeilingNotificationService();
        const creditService = getCreditService();

        // Get current credit usage
        const credits = await creditService.getCredits(userId);

        // Check ceiling status
        const status = await ceilingService.checkCeilingStatus(userId, credits.usedThisMonth);

        res.json({
            success: true,
            status: {
                hasCeiling: status.hasCeiling,
                ceiling: status.ceiling,
                currentUsage: status.currentUsage,
                percentageUsed: status.percentageUsed,
                remainingCredits: status.remainingCredits,
                thresholdReached: status.thresholdReached,
                monthlyAllocation: credits.monthlyAllocation,
                tier: credits.tier,
                resetDate: credits.resetDate,
            },
        });
    } catch (error) {
        console.error('[CeilingAPI] Failed to get status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get ceiling status',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * PUT /api/ceiling
 * Update user's credit ceiling
 *
 * Body: { ceiling: number | null }
 */
router.put('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user!.id;
        const { ceiling } = req.body;

        // Validate ceiling value
        if (ceiling !== null && (typeof ceiling !== 'number' || ceiling < 0)) {
            res.status(400).json({
                success: false,
                error: 'Invalid ceiling value',
                message: 'Ceiling must be a positive number or null',
            });
            return;
        }

        const ceilingService = getCeilingNotificationService();
        await ceilingService.updateCeiling(userId, ceiling);

        // Get updated status
        const creditService = getCreditService();
        const credits = await creditService.getCredits(userId);
        const status = await ceilingService.checkCeilingStatus(userId, credits.usedThisMonth);

        res.json({
            success: true,
            message: ceiling === null ? 'Credit ceiling removed' : `Credit ceiling set to ${ceiling} credits`,
            status: {
                hasCeiling: status.hasCeiling,
                ceiling: status.ceiling,
                currentUsage: status.currentUsage,
                percentageUsed: status.percentageUsed,
                remainingCredits: status.remainingCredits,
            },
        });
    } catch (error) {
        console.error('[CeilingAPI] Failed to update ceiling:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update ceiling',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * PUT /api/ceiling/preferences
 * Update ceiling notification preferences
 *
 * Body: {
 *   enabled: boolean,
 *   channels: ('email' | 'sms' | 'push')[]
 * }
 */
router.put('/preferences', authMiddleware, async (req, res) => {
    try {
        const userId = req.user!.id;
        const { enabled, channels } = req.body;

        // Validate input
        if (typeof enabled !== 'boolean') {
            res.status(400).json({
                success: false,
                error: 'Invalid enabled value',
                message: 'enabled must be a boolean',
            });
            return;
        }

        if (!Array.isArray(channels) || !channels.every((c: any) => ['email', 'sms', 'push', 'slack'].includes(c))) {
            res.status(400).json({
                success: false,
                error: 'Invalid channels',
                message: 'channels must be an array of valid notification channels',
            });
            return;
        }

        const ceilingService = getCeilingNotificationService();
        await ceilingService.updatePreferences(userId, enabled, channels);

        res.json({
            success: true,
            message: 'Notification preferences updated',
            preferences: {
                enabled,
                channels,
            },
        });
    } catch (error) {
        console.error('[CeilingAPI] Failed to update preferences:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update preferences',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * DELETE /api/ceiling/history
 * Clear notification history (for testing or manual reset)
 *
 * Query params:
 *   - monthKey: optional YYYY-MM format to clear specific month
 */
router.delete('/history', authMiddleware, async (req, res) => {
    try {
        const userId = req.user!.id;
        const { monthKey } = req.query;

        const ceilingService = getCeilingNotificationService();
        await ceilingService.clearNotificationHistory(
            userId,
            monthKey as string | undefined
        );

        res.json({
            success: true,
            message: monthKey
                ? `Notification history cleared for ${monthKey}`
                : 'All notification history cleared',
        });
    } catch (error) {
        console.error('[CeilingAPI] Failed to clear history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear history',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

export default router;
