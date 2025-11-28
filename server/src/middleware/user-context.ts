/**
 * User Context Middleware
 * 
 * Sets req.user based on x-user-id header or session cookie.
 * This bridges the gap between how routes read user ID and how
 * requireCredits middleware expects it.
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
        // Get user ID from header (primary method used by frontend)
        const userId = req.headers['x-user-id'] as string;
        
        if (!userId) {
            // No user ID - continue without user context
            // Routes that need auth will handle this
            return next();
        }

        // Look up user in database
        const userRecords = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (userRecords.length > 0) {
            const userRecord = userRecords[0];
            
            // Attach user to request
            (req as any).user = {
                id: userRecord.id,
                email: userRecord.email,
                name: userRecord.name,
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

