/**
 * Admin Routes
 *
 * For user management, debugging, and administrative tasks.
 * Protected by admin secret header.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { users, sessions, accounts, projects, files, generations } from '../schema.js';
import { eq, sql } from 'drizzle-orm';

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

/**
 * GET /api/admin/debug/auth
 * Debug authentication - show all users, accounts, sessions
 * Useful for diagnosing login issues
 */
router.get('/debug/auth', async (req: Request, res: Response) => {
    if (!checkAdminSecret(req, res)) return;

    try {
        // Get all users
        const allUsers = await db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            credits: users.credits,
            tier: users.tier,
            createdAt: users.createdAt,
        }).from(users);

        // Get all accounts (OAuth links)
        const allAccounts = await db.select({
            id: accounts.id,
            accountId: accounts.accountId,
            providerId: accounts.providerId,
            userId: accounts.userId,
            createdAt: accounts.createdAt,
        }).from(accounts);

        // Get all active sessions
        const allSessions = await db.select({
            id: sessions.id,
            userId: sessions.userId,
            expiresAt: sessions.expiresAt,
            createdAt: sessions.createdAt,
        }).from(sessions);

        // Get all projects with owner emails
        const allProjects = await db.select({
            id: projects.id,
            name: projects.name,
            ownerId: projects.ownerId,
            createdAt: projects.createdAt,
        }).from(projects);

        // Build a detailed view
        const userDetails = allUsers.map(user => {
            const userAccounts = allAccounts.filter(a => a.userId === user.id);
            const userSessions = allSessions.filter(s => s.userId === user.id);
            const userProjects = allProjects.filter(p => p.ownerId === user.id);
            
            return {
                ...user,
                accounts: userAccounts,
                sessions: userSessions,
                projectCount: userProjects.length,
                projects: userProjects,
            };
        });

        // Check for duplicate emails (shouldn't happen due to unique constraint)
        const emailCounts: Record<string, number> = {};
        allUsers.forEach(u => {
            emailCounts[u.email] = (emailCounts[u.email] || 0) + 1;
        });
        const duplicateEmails = Object.entries(emailCounts)
            .filter(([, count]) => count > 1)
            .map(([email]) => email);

        // Check for orphaned accounts (accounts without users)
        const orphanedAccounts = allAccounts.filter(
            a => !allUsers.some(u => u.id === a.userId)
        );

        res.json({
            summary: {
                totalUsers: allUsers.length,
                totalAccounts: allAccounts.length,
                totalSessions: allSessions.length,
                totalProjects: allProjects.length,
                duplicateEmails,
                orphanedAccounts: orphanedAccounts.length,
            },
            users: userDetails,
            orphanedAccounts,
        });
    } catch (error: any) {
        console.error('Error in debug/auth:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/debug/user/:email
 * Debug specific user - show all related data
 */
router.get('/debug/user/:email', async (req: Request, res: Response) => {
    if (!checkAdminSecret(req, res)) return;

    try {
        const { email } = req.params;

        // Get user
        const userRecords = await db
            .select()
            .from(users)
            .where(eq(users.email, email));

        if (userRecords.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // If multiple users with same email, show all (shouldn't happen)
        const userData = await Promise.all(userRecords.map(async (user) => {
            const userAccounts = await db
                .select()
                .from(accounts)
                .where(eq(accounts.userId, user.id));

            const userSessions = await db
                .select()
                .from(sessions)
                .where(eq(sessions.userId, user.id));

            const userProjects = await db
                .select()
                .from(projects)
                .where(eq(projects.ownerId, user.id));

            return {
                user,
                accounts: userAccounts,
                sessions: userSessions,
                projects: userProjects,
            };
        }));

        res.json({
            email,
            userCount: userRecords.length,
            data: userData,
        });
    } catch (error: any) {
        console.error('Error in debug/user:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/fix/merge-users
 * Merge duplicate users with same email into one
 * Keeps the oldest user, moves all projects/accounts to it
 */
router.post('/fix/merge-users/:email', async (req: Request, res: Response) => {
    if (!checkAdminSecret(req, res)) return;

    try {
        const { email } = req.params;

        // Find all users with this email
        const userRecords = await db
            .select()
            .from(users)
            .where(eq(users.email, email));

        if (userRecords.length < 2) {
            return res.json({
                message: 'No duplicate users to merge',
                userCount: userRecords.length,
            });
        }

        // Sort by creation date, keep the oldest
        userRecords.sort((a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        const primaryUser = userRecords[0];
        const duplicateUsers = userRecords.slice(1);

        console.log(`[Admin] Merging ${duplicateUsers.length} duplicate users into ${primaryUser.id}`);

        const mergeResults = {
            primaryUserId: primaryUser.id,
            mergedUserIds: [] as string[],
            movedProjects: 0,
            movedAccounts: 0,
            movedSessions: 0,
        };

        for (const duplicate of duplicateUsers) {
            // Move projects
            const projectResult = await db
                .update(projects)
                .set({ ownerId: primaryUser.id })
                .where(eq(projects.ownerId, duplicate.id));
            mergeResults.movedProjects += projectResult.rowsAffected || 0;

            // Move accounts (OAuth links)
            const accountResult = await db
                .update(accounts)
                .set({ userId: primaryUser.id })
                .where(eq(accounts.userId, duplicate.id));
            mergeResults.movedAccounts += accountResult.rowsAffected || 0;

            // Delete duplicate sessions (don't move, just clean up)
            await db.delete(sessions).where(eq(sessions.userId, duplicate.id));

            // Delete duplicate user
            await db.delete(users).where(eq(users.id, duplicate.id));
            mergeResults.mergedUserIds.push(duplicate.id);
        }

        console.log(`[Admin] Merge complete:`, mergeResults);

        res.json({
            success: true,
            message: `Merged ${duplicateUsers.length} duplicate users`,
            ...mergeResults,
        });
    } catch (error: any) {
        console.error('Error in fix/merge-users:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/fix/cleanup-sessions
 * Clean up expired sessions from the database
 */
router.post('/fix/cleanup-sessions', async (req: Request, res: Response) => {
    if (!checkAdminSecret(req, res)) return;

    try {
        const now = new Date().toISOString();
        
        // Delete expired sessions
        const result = await db
            .delete(sessions)
            .where(sql`${sessions.expiresAt} < ${now}`);

        res.json({
            success: true,
            message: 'Cleaned up expired sessions',
            deletedCount: result.rowsAffected || 0,
        });
    } catch (error: any) {
        console.error('Error in cleanup-sessions:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;

