/**
 * Admin Routes
 *
 * For user management, debugging, and administrative tasks.
 * Protected by admin secret header.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { users, sessions, accounts, projects, files, generations } from '../schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

// Admin secret check
const checkAdminSecret = (req: Request, res: Response): boolean => {
    const secret = req.headers['x-admin-secret'];
    const adminSecret = process.env.ADMIN_SECRET;

    // If no admin secret is set in env, allow access (for initial setup)
    // IMPORTANT: Set ADMIN_SECRET in production!
    if (!adminSecret) {
        console.warn('[Admin] No ADMIN_SECRET set - allowing access. Set ADMIN_SECRET for production!');
        return true;
    }

    if (!secret || secret !== adminSecret) {
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid admin secret' });
        return false;
    }
    return true;
};

/**
 * GET /api/admin/users
 * List all users
 */
router.get('/users', async (req: Request, res: Response) => {
    if (!checkAdminSecret(req, res)) return;

    try {
        const allUsers = await db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            credits: users.credits,
            tier: users.tier,
            createdAt: users.createdAt,
        }).from(users);

        res.json({ users: allUsers });
    } catch (error: any) {
        console.error('Error listing users:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/users/:email
 * Get user by email
 */
router.get('/users/:email', async (req: Request, res: Response) => {
    if (!checkAdminSecret(req, res)) return;

    try {
        const { email } = req.params;

        const userRecords = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        if (userRecords.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: userRecords[0] });
    } catch (error: any) {
        console.error('Error getting user:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/admin/users/:email
 * Delete user by email
 */
router.delete('/users/:email', async (req: Request, res: Response) => {
    if (!checkAdminSecret(req, res)) return;

    try {
        const { email } = req.params;

        // Find user
        const userRecords = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        if (userRecords.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userId = userRecords[0].id;

        // Delete related records first (in order of dependencies)
        await db.delete(generations).where(eq(generations.userId, userId));
        await db.delete(files).where(eq(files.projectId, userId)); // files reference projects
        await db.delete(projects).where(eq(projects.ownerId, userId));
        await db.delete(sessions).where(eq(sessions.userId, userId));
        await db.delete(accounts).where(eq(accounts.userId, userId));

        // Finally delete user
        await db.delete(users).where(eq(users.id, userId));

        console.log(`[Admin] Deleted user: ${email}`);

        res.json({
            success: true,
            message: `User ${email} deleted successfully`,
            deletedUserId: userId,
        });
    } catch (error: any) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PATCH /api/admin/users/:email/credits
 * Set credits for a user
 */
router.patch('/users/:email/credits', async (req: Request, res: Response) => {
    if (!checkAdminSecret(req, res)) return;

    try {
        const { email } = req.params;
        const { credits } = req.body;

        if (typeof credits !== 'number' || credits < 0) {
            return res.status(400).json({ error: 'Invalid credits value' });
        }

        // Find user
        const userRecords = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        if (userRecords.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update credits
        await db
            .update(users)
            .set({ credits, updatedAt: new Date().toISOString() })
            .where(eq(users.email, email));

        console.log(`[Admin] Set credits for ${email}: ${credits}`);

        res.json({
            success: true,
            message: `Credits set to ${credits} for ${email}`,
            email,
            credits,
        });
    } catch (error: any) {
        console.error('Error setting credits:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PATCH /api/admin/users/:email/tier
 * Set tier for a user (free, pro, enterprise, unlimited)
 */
router.patch('/users/:email/tier', async (req: Request, res: Response) => {
    if (!checkAdminSecret(req, res)) return;

    try {
        const { email } = req.params;
        const { tier } = req.body;

        const validTiers = ['free', 'pro', 'enterprise', 'unlimited'];
        if (!validTiers.includes(tier)) {
            return res.status(400).json({
                error: 'Invalid tier',
                validTiers
            });
        }

        // Find user
        const userRecords = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        if (userRecords.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update tier
        await db
            .update(users)
            .set({ tier, updatedAt: new Date().toISOString() })
            .where(eq(users.email, email));

        console.log(`[Admin] Set tier for ${email}: ${tier}`);

        res.json({
            success: true,
            message: `Tier set to ${tier} for ${email}`,
            email,
            tier,
        });
    } catch (error: any) {
        console.error('Error setting tier:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;

