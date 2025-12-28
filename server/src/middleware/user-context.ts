/**
 * User Context Middleware
 *
 * Augments req.user with app-specific fields (tier/credits) by looking up the
 * authenticated user in the database.
 *
 * IMPORTANT:
 * - This middleware MUST NOT treat `x-user-id` as authentication.
 * - Authentication is handled by Better Auth session cookies via authMiddleware/optionalAuthMiddleware.
 * - We only enrich an already-authenticated `req.user`.
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db.js';
import { users } from '../schema.js';
import { eq } from 'drizzle-orm';

/**
 * Attach user context to request
 * Reads from x-user-id header (sent by frontend api-client)
 */
export async function userContextMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const authedUserId = (req as any).user?.id as string | undefined;
        if (!authedUserId) return next();

        // Look up user in database
        const userRecords = await db
            .select()
            .from(users)
            .where(eq(users.id, authedUserId))
            .limit(1);

        if (userRecords.length > 0) {
            const userRecord = userRecords[0];

            // Enrich existing authenticated user object
            (req as any).user = {
                ...(req as any).user,
                tier: userRecord.tier || 'free',
                credits: userRecord.credits,
            };
        }

        next();
    } catch (error) {
        console.error('User context middleware error:', error);
        // Continue without user context on error
        next();
    }
}

export default userContextMiddleware;

