/**
 * Model Library API Routes
 *
 * Manages user favorites, recently used models, and collections.
 * Part of KripTik AI's Open Source Studio.
 */

import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db.js';
import {
    userModelFavorites,
    userModelUsageHistory,
    userModelCollections,
    userModelCollectionItems,
} from '../schema.js';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// =============================================================================
// TYPES
// =============================================================================

interface ModelMetadata {
    modelId: string;
    modelName: string;
    author: string;
    task?: string;
    library?: string;
    downloads?: number;
    likes?: number;
    estimatedVram?: number;
    license?: string;
}

// =============================================================================
// FAVORITES
// =============================================================================

/**
 * GET /api/model-library/favorites
 * Get user's favorite models
 */
router.get('/favorites', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { task, library, limit = '50' } = req.query;
        const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100);

        let query = db
            .select()
            .from(userModelFavorites)
            .where(eq(userModelFavorites.userId, userId))
            .orderBy(desc(userModelFavorites.createdAt))
            .limit(limitNum);

        const favorites = await query;

        // Filter by task/library if specified
        let filtered = favorites;
        if (task) {
            filtered = filtered.filter(f => f.task === task);
        }
        if (library) {
            filtered = filtered.filter(f => f.library === library);
        }

        res.json({
            favorites: filtered,
            total: filtered.length,
        });
    } catch (error) {
        console.error('[Model Library] Get favorites error:', error);
        res.status(500).json({
            error: 'Failed to get favorites',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/model-library/favorites
 * Add a model to favorites
 */
router.post('/favorites', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const {
            modelId,
            modelName,
            author,
            task,
            library,
            downloads,
            likes,
            estimatedVram,
            license,
            userNotes,
            tags,
        } = req.body as ModelMetadata & { userNotes?: string; tags?: string[] };

        if (!modelId || !modelName || !author) {
            res.status(400).json({ error: 'modelId, modelName, and author are required' });
            return;
        }

        // Check if already favorited
        const existing = await db
            .select()
            .from(userModelFavorites)
            .where(and(
                eq(userModelFavorites.userId, userId),
                eq(userModelFavorites.modelId, modelId)
            ))
            .limit(1);

        if (existing.length > 0) {
            // Update existing favorite
            await db
                .update(userModelFavorites)
                .set({
                    modelName,
                    task,
                    library,
                    downloads,
                    likes,
                    estimatedVram,
                    license,
                    userNotes,
                    tags,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(userModelFavorites.id, existing[0].id));

            const [updated] = await db
                .select()
                .from(userModelFavorites)
                .where(eq(userModelFavorites.id, existing[0].id));

            res.json({ favorite: updated, isNew: false });
            return;
        }

        // Create new favorite
        const [favorite] = await db
            .insert(userModelFavorites)
            .values({
                userId,
                modelId,
                modelName,
                author,
                task,
                library,
                downloads,
                likes,
                estimatedVram,
                license,
                userNotes,
                tags,
            })
            .returning();

        res.status(201).json({ favorite, isNew: true });
    } catch (error) {
        console.error('[Model Library] Add favorite error:', error);
        res.status(500).json({
            error: 'Failed to add favorite',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * DELETE /api/model-library/favorites/:modelId
 * Remove a model from favorites
 */
router.delete('/favorites/:modelId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { modelId } = req.params;
        const decodedModelId = decodeURIComponent(modelId);

        await db
            .delete(userModelFavorites)
            .where(and(
                eq(userModelFavorites.userId, userId),
                eq(userModelFavorites.modelId, decodedModelId)
            ));

        res.json({ success: true, modelId: decodedModelId });
    } catch (error) {
        console.error('[Model Library] Remove favorite error:', error);
        res.status(500).json({
            error: 'Failed to remove favorite',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/model-library/favorites/check/:modelId
 * Check if a model is favorited
 */
router.get('/favorites/check/:modelId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { modelId } = req.params;
        const decodedModelId = decodeURIComponent(modelId);

        const [favorite] = await db
            .select()
            .from(userModelFavorites)
            .where(and(
                eq(userModelFavorites.userId, userId),
                eq(userModelFavorites.modelId, decodedModelId)
            ))
            .limit(1);

        res.json({ isFavorited: !!favorite, favorite: favorite || null });
    } catch (error) {
        console.error('[Model Library] Check favorite error:', error);
        res.status(500).json({
            error: 'Failed to check favorite',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// =============================================================================
// RECENTLY USED
// =============================================================================

/**
 * GET /api/model-library/recent
 * Get user's recently used models
 */
router.get('/recent', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { usageType, limit = '20' } = req.query;
        const limitNum = Math.min(parseInt(limit as string, 10) || 20, 50);

        // Get distinct recent models (most recent usage per model)
        const recentUsage = await db
            .select()
            .from(userModelUsageHistory)
            .where(eq(userModelUsageHistory.userId, userId))
            .orderBy(desc(userModelUsageHistory.usedAt))
            .limit(limitNum * 2); // Get extra to filter duplicates

        // Deduplicate by modelId, keeping most recent
        const seenModels = new Set<string>();
        const uniqueRecent = recentUsage.filter(usage => {
            if (usageType && usage.usageType !== usageType) return false;
            if (seenModels.has(usage.modelId)) return false;
            seenModels.add(usage.modelId);
            return true;
        }).slice(0, limitNum);

        res.json({
            recent: uniqueRecent,
            total: uniqueRecent.length,
        });
    } catch (error) {
        console.error('[Model Library] Get recent error:', error);
        res.status(500).json({
            error: 'Failed to get recent models',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/model-library/recent
 * Track model usage
 */
router.post('/recent', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const {
            modelId,
            modelName,
            author,
            usageType,
            projectId,
            trainingJobId,
            endpointId,
            task,
            library,
            estimatedVram,
        } = req.body;

        if (!modelId || !modelName || !author || !usageType) {
            res.status(400).json({ error: 'modelId, modelName, author, and usageType are required' });
            return;
        }

        const validUsageTypes = ['deploy', 'finetune', 'train', 'browse', 'compare'];
        if (!validUsageTypes.includes(usageType)) {
            res.status(400).json({ error: `usageType must be one of: ${validUsageTypes.join(', ')}` });
            return;
        }

        const [usage] = await db
            .insert(userModelUsageHistory)
            .values({
                userId,
                modelId,
                modelName,
                author,
                usageType,
                projectId,
                trainingJobId,
                endpointId,
                task,
                library,
                estimatedVram,
            })
            .returning();

        res.status(201).json({ usage });
    } catch (error) {
        console.error('[Model Library] Track usage error:', error);
        res.status(500).json({
            error: 'Failed to track usage',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * DELETE /api/model-library/recent
 * Clear usage history
 */
router.delete('/recent', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        await db
            .delete(userModelUsageHistory)
            .where(eq(userModelUsageHistory.userId, userId));

        res.json({ success: true });
    } catch (error) {
        console.error('[Model Library] Clear history error:', error);
        res.status(500).json({
            error: 'Failed to clear history',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// =============================================================================
// COLLECTIONS
// =============================================================================

/**
 * GET /api/model-library/collections
 * Get user's model collections
 */
router.get('/collections', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const collections = await db
            .select()
            .from(userModelCollections)
            .where(eq(userModelCollections.userId, userId))
            .orderBy(desc(userModelCollections.updatedAt));

        // Get item counts for each collection
        const collectionsWithCounts = await Promise.all(
            collections.map(async (collection) => {
                const items = await db
                    .select()
                    .from(userModelCollectionItems)
                    .where(eq(userModelCollectionItems.collectionId, collection.id));
                return {
                    ...collection,
                    itemCount: items.length,
                };
            })
        );

        res.json({ collections: collectionsWithCounts });
    } catch (error) {
        console.error('[Model Library] Get collections error:', error);
        res.status(500).json({
            error: 'Failed to get collections',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/model-library/collections
 * Create a new collection
 */
router.post('/collections', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { name, description, icon, color, isPublic } = req.body;

        if (!name) {
            res.status(400).json({ error: 'name is required' });
            return;
        }

        const [collection] = await db
            .insert(userModelCollections)
            .values({
                userId,
                name,
                description,
                icon,
                color,
                isPublic: isPublic || false,
            })
            .returning();

        res.status(201).json({ collection });
    } catch (error) {
        console.error('[Model Library] Create collection error:', error);
        res.status(500).json({
            error: 'Failed to create collection',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/model-library/collections/:collectionId
 * Get a collection with its items
 */
router.get('/collections/:collectionId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { collectionId } = req.params;

        const [collection] = await db
            .select()
            .from(userModelCollections)
            .where(and(
                eq(userModelCollections.id, collectionId),
                eq(userModelCollections.userId, userId)
            ))
            .limit(1);

        if (!collection) {
            res.status(404).json({ error: 'Collection not found' });
            return;
        }

        const items = await db
            .select()
            .from(userModelCollectionItems)
            .where(eq(userModelCollectionItems.collectionId, collectionId))
            .orderBy(userModelCollectionItems.sortOrder);

        res.json({ collection, items });
    } catch (error) {
        console.error('[Model Library] Get collection error:', error);
        res.status(500).json({
            error: 'Failed to get collection',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * PUT /api/model-library/collections/:collectionId
 * Update a collection
 */
router.put('/collections/:collectionId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { collectionId } = req.params;
        const { name, description, icon, color, isPublic } = req.body;

        await db
            .update(userModelCollections)
            .set({
                name,
                description,
                icon,
                color,
                isPublic,
                updatedAt: new Date().toISOString(),
            })
            .where(and(
                eq(userModelCollections.id, collectionId),
                eq(userModelCollections.userId, userId)
            ));

        const [updated] = await db
            .select()
            .from(userModelCollections)
            .where(eq(userModelCollections.id, collectionId));

        res.json({ collection: updated });
    } catch (error) {
        console.error('[Model Library] Update collection error:', error);
        res.status(500).json({
            error: 'Failed to update collection',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * DELETE /api/model-library/collections/:collectionId
 * Delete a collection and its items
 */
router.delete('/collections/:collectionId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { collectionId } = req.params;

        // Delete items first
        await db
            .delete(userModelCollectionItems)
            .where(eq(userModelCollectionItems.collectionId, collectionId));

        // Delete collection
        await db
            .delete(userModelCollections)
            .where(and(
                eq(userModelCollections.id, collectionId),
                eq(userModelCollections.userId, userId)
            ));

        res.json({ success: true });
    } catch (error) {
        console.error('[Model Library] Delete collection error:', error);
        res.status(500).json({
            error: 'Failed to delete collection',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/model-library/collections/:collectionId/items
 * Add a model to a collection
 */
router.post('/collections/:collectionId/items', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { collectionId } = req.params;
        const { modelId, modelName, author, sortOrder } = req.body;

        // Verify collection ownership
        const [collection] = await db
            .select()
            .from(userModelCollections)
            .where(and(
                eq(userModelCollections.id, collectionId),
                eq(userModelCollections.userId, userId)
            ))
            .limit(1);

        if (!collection) {
            res.status(404).json({ error: 'Collection not found' });
            return;
        }

        // Check if already in collection
        const [existing] = await db
            .select()
            .from(userModelCollectionItems)
            .where(and(
                eq(userModelCollectionItems.collectionId, collectionId),
                eq(userModelCollectionItems.modelId, modelId)
            ))
            .limit(1);

        if (existing) {
            res.status(409).json({ error: 'Model already in collection' });
            return;
        }

        const [item] = await db
            .insert(userModelCollectionItems)
            .values({
                collectionId,
                modelId,
                modelName,
                author,
                sortOrder: sortOrder || 0,
            })
            .returning();

        // Update collection timestamp
        await db
            .update(userModelCollections)
            .set({ updatedAt: new Date().toISOString() })
            .where(eq(userModelCollections.id, collectionId));

        res.status(201).json({ item });
    } catch (error) {
        console.error('[Model Library] Add to collection error:', error);
        res.status(500).json({
            error: 'Failed to add to collection',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * DELETE /api/model-library/collections/:collectionId/items/:modelId
 * Remove a model from a collection
 */
router.delete('/collections/:collectionId/items/:modelId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { collectionId, modelId } = req.params;
        const decodedModelId = decodeURIComponent(modelId);

        // Verify collection ownership
        const [collection] = await db
            .select()
            .from(userModelCollections)
            .where(and(
                eq(userModelCollections.id, collectionId),
                eq(userModelCollections.userId, userId)
            ))
            .limit(1);

        if (!collection) {
            res.status(404).json({ error: 'Collection not found' });
            return;
        }

        await db
            .delete(userModelCollectionItems)
            .where(and(
                eq(userModelCollectionItems.collectionId, collectionId),
                eq(userModelCollectionItems.modelId, decodedModelId)
            ));

        res.json({ success: true });
    } catch (error) {
        console.error('[Model Library] Remove from collection error:', error);
        res.status(500).json({
            error: 'Failed to remove from collection',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// =============================================================================
// COMBINED LIBRARY VIEW
// =============================================================================

/**
 * GET /api/model-library/overview
 * Get combined overview: favorites, recent, collections
 */
router.get('/overview', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Get favorites (top 10)
        const favorites = await db
            .select()
            .from(userModelFavorites)
            .where(eq(userModelFavorites.userId, userId))
            .orderBy(desc(userModelFavorites.createdAt))
            .limit(10);

        // Get recent (top 10 unique)
        const recentUsage = await db
            .select()
            .from(userModelUsageHistory)
            .where(eq(userModelUsageHistory.userId, userId))
            .orderBy(desc(userModelUsageHistory.usedAt))
            .limit(30);

        const seenModels = new Set<string>();
        const recent = recentUsage.filter(usage => {
            if (seenModels.has(usage.modelId)) return false;
            seenModels.add(usage.modelId);
            return true;
        }).slice(0, 10);

        // Get collections with counts
        const collections = await db
            .select()
            .from(userModelCollections)
            .where(eq(userModelCollections.userId, userId))
            .orderBy(desc(userModelCollections.updatedAt))
            .limit(10);

        const collectionsWithCounts = await Promise.all(
            collections.map(async (collection) => {
                const items = await db
                    .select()
                    .from(userModelCollectionItems)
                    .where(eq(userModelCollectionItems.collectionId, collection.id));
                return {
                    ...collection,
                    itemCount: items.length,
                };
            })
        );

        res.json({
            favorites: {
                items: favorites,
                total: favorites.length,
            },
            recent: {
                items: recent,
                total: recent.length,
            },
            collections: {
                items: collectionsWithCounts,
                total: collectionsWithCounts.length,
            },
        });
    } catch (error) {
        console.error('[Model Library] Get overview error:', error);
        res.status(500).json({
            error: 'Failed to get library overview',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

export default router;
