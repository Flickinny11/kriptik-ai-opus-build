/**
 * Admin Routes
 *
 * Protected endpoints for system administration:
 * - Credit pool management
 * - Health monitoring
 * - Alert management
 * - Content moderation
 */

import { Router } from 'express';
import { getCreditPoolService } from '../services/billing/credit-pool.js';
import { getSelfHealingCoordinator, getHealthMonitor, getAlertSystem } from '../services/self-healing/index.js';
import { getContentAnalyzer } from '../services/moderation/content-analyzer.js';
import { db } from '../db.js';
import { poolTransactions, poolSnapshots, contentFlags } from '../schema.js';
import { desc, gte, eq } from 'drizzle-orm';

const router = Router();

// Middleware to check admin auth
const requireAdmin = (req: any, res: any, next: any) => {
    const adminKey = req.headers['x-admin-key'];

    if (!process.env.ADMIN_API_KEY) {
        console.warn('[Admin] ADMIN_API_KEY not configured - admin access disabled');
        return res.status(503).json({ error: 'Admin API not configured' });
    }

    if (adminKey !== process.env.ADMIN_API_KEY) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    next();
};

// =============================================================================
// CREDIT POOL ENDPOINTS
// =============================================================================

// Get pool status
router.get('/pool/status', requireAdmin, async (req, res) => {
    try {
        const pool = getCreditPoolService();
        const status = await pool.getPool();
        const health = await pool.getHealth();

        res.json({
            success: true,
            pool: {
                ...status,
                // Convert cents to dollars for display
                apiReserveUSD: (status.apiReserve / 100).toFixed(2),
                freeSubsidyUSD: (status.freeSubsidy / 100).toFixed(2),
                infraReserveUSD: (status.infraReserve / 100).toFixed(2),
                profitReserveUSD: (status.profitReserve / 100).toFixed(2),
                totalRevenueUSD: (status.totalRevenue / 100).toFixed(2),
                totalApiSpendUSD: (status.totalApiSpend / 100).toFixed(2),
            },
            health,
            allocation: {
                api: '60%',
                free: '20%',
                infra: '10%',
                profit: '10%',
            },
        });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

// Get recent transactions
router.get('/pool/transactions', requireAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 100;

        const transactions = await db.select()
            .from(poolTransactions)
            .orderBy(desc(poolTransactions.timestamp))
            .limit(limit);

        res.json({
            success: true,
            transactions: transactions.map(t => ({
                ...t,
                amountUSD: (t.amount / 100).toFixed(4),
            })),
        });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

// Get daily snapshots (last 30 days)
router.get('/pool/history', requireAdmin, async (req, res) => {
    try {
        const days = parseInt(req.query.days as string) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const snapshots = await db.select()
            .from(poolSnapshots)
            .where(gte(poolSnapshots.date, startDate.toISOString().split('T')[0]))
            .orderBy(desc(poolSnapshots.date));

        res.json({
            success: true,
            snapshots: snapshots.map(s => ({
                ...s,
                apiReserveUSD: (s.apiReserve / 100).toFixed(2),
                dailyRevenueUSD: (s.dailyRevenue / 100).toFixed(2),
                dailyApiSpendUSD: (s.dailyApiSpend / 100).toFixed(2),
            })),
        });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

// Seed pool (one-time initial funding)
router.post('/pool/seed', requireAdmin, async (req, res) => {
    try {
        const { amountUSD } = req.body;

        if (!amountUSD || amountUSD <= 0) {
            return res.status(400).json({ error: 'Invalid amount - provide amountUSD (dollars)' });
        }

        const amountCents = Math.round(amountUSD * 100);
        const pool = getCreditPoolService();
        await pool.seedPool(amountCents);

        res.json({
            success: true,
            message: `Pool seeded with $${amountUSD}`,
            newStatus: await pool.getPool(),
        });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

// Record daily snapshot manually
router.post('/pool/snapshot', requireAdmin, async (req, res) => {
    try {
        const pool = getCreditPoolService();
        await pool.recordDailySnapshot();

        res.json({
            success: true,
            message: 'Daily snapshot recorded',
        });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

// =============================================================================
// HEALTH & SELF-HEALING ENDPOINTS
// =============================================================================

// Get comprehensive health status
router.get('/health/detailed', requireAdmin, async (req, res) => {
    try {
        const coordinator = getSelfHealingCoordinator();
        const status = coordinator.getStatus();

        res.json({
            success: true,
            ...status,
        });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

// Trigger manual recovery
router.post('/health/recover/:service', requireAdmin, async (req, res) => {
    try {
        const { service } = req.params;
        const coordinator = getSelfHealingCoordinator();
        const success = await coordinator.triggerRecovery(service);

        res.json({
            success,
            message: success ? `Recovery triggered for ${service}` : `Recovery failed for ${service}`,
        });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

// Get active alerts
router.get('/alerts', requireAdmin, async (req, res) => {
    try {
        const alerts = getAlertSystem();
        res.json({
            success: true,
            alerts: alerts.getActiveAlerts(),
        });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

// Get all alerts
router.get('/alerts/all', requireAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 100;
        const alerts = getAlertSystem();
        res.json({
            success: true,
            alerts: alerts.getAllAlerts(limit),
        });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

// Acknowledge alert
router.post('/alerts/:alertId/acknowledge', requireAdmin, async (req, res) => {
    try {
        const { alertId } = req.params;
        const alerts = getAlertSystem();
        const success = alerts.acknowledgeAlert(alertId);

        res.json({ success });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

// Get recent errors
router.get('/health/errors', requireAdmin, async (req, res) => {
    try {
        const count = parseInt(req.query.count as string) || 50;
        const monitor = getHealthMonitor();
        const errors = monitor.getRecentErrors(count);

        res.json({
            success: true,
            errors,
        });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

// =============================================================================
// CONTENT MODERATION ENDPOINTS
// =============================================================================

// Get flagged content for review
router.get('/content-flags', requireAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 100;

        const flags = await db.select()
            .from(contentFlags)
            .orderBy(desc(contentFlags.timestamp))
            .limit(limit);

        res.json({
            success: true,
            flags: flags.map(f => ({
                ...f,
                confidencePercent: f.confidence,
            })),
        });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

// Get content flag stats
router.get('/content-flags/stats', requireAdmin, async (req, res) => {
    try {
        const analyzer = getContentAnalyzer();
        const flags = await analyzer.getFlaggedContent(1000);

        const stats = {
            total: flags.length,
            byCategory: {} as Record<string, number>,
            acknowledged: flags.filter(f => f.userAcknowledged).length,
            unacknowledged: flags.filter(f => !f.userAcknowledged).length,
        };

        for (const flag of flags) {
            stats.byCategory[flag.category] = (stats.byCategory[flag.category] || 0) + 1;
        }

        res.json({
            success: true,
            stats,
        });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

export default router;
