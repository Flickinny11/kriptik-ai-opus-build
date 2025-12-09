/**
 * Model Marketplace API Routes
 *
 * Endpoints for the model marketplace where users can share,
 * discover, and download community-created models.
 */

import { Router } from 'express';
import { getModelMarketplace, MarketplaceCategory, MarketplaceSearchFilters } from '../services/learning/model-marketplace.js';
import { getUserModelManager } from '../services/learning/user-model-manager.js';

const router = Router();

// =============================================================================
// MARKETPLACE DISCOVERY
// =============================================================================

/**
 * Search marketplace models
 * POST /api/marketplace/search
 */
router.post('/search', async (req, res) => {
    try {
        const filters: MarketplaceSearchFilters = req.body;
        const marketplace = getModelMarketplace();
        const result = await marketplace.searchModels(filters);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[API] Error searching marketplace:', error);
        res.status(500).json({ error: 'Failed to search marketplace' });
    }
});

/**
 * Get featured models
 * GET /api/marketplace/featured
 */
router.get('/featured', async (req, res) => {
    try {
        const marketplace = getModelMarketplace();
        const models = await marketplace.getFeaturedModels();
        res.json({ success: true, models });
    } catch (error) {
        console.error('[API] Error fetching featured models:', error);
        res.status(500).json({ error: 'Failed to fetch featured models' });
    }
});

/**
 * Get trending models
 * GET /api/marketplace/trending
 */
router.get('/trending', async (req, res) => {
    try {
        const marketplace = getModelMarketplace();
        const models = await marketplace.getTrendingModels();
        res.json({ success: true, models });
    } catch (error) {
        console.error('[API] Error fetching trending models:', error);
        res.status(500).json({ error: 'Failed to fetch trending models' });
    }
});

/**
 * Get models by category
 * GET /api/marketplace/category/:category
 */
router.get('/category/:category', async (req, res) => {
    try {
        const category = req.params.category as MarketplaceCategory;
        const marketplace = getModelMarketplace();
        const models = await marketplace.getModelsByCategory(category);
        res.json({ success: true, models });
    } catch (error) {
        console.error('[API] Error fetching category models:', error);
        res.status(500).json({ error: 'Failed to fetch models' });
    }
});

/**
 * Get a specific listing
 * GET /api/marketplace/listings/:listingId
 */
router.get('/listings/:listingId', async (req, res) => {
    try {
        const marketplace = getModelMarketplace();
        const listing = await marketplace.getListing(req.params.listingId);

        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }

        res.json({ success: true, listing });
    } catch (error) {
        console.error('[API] Error fetching listing:', error);
        res.status(500).json({ error: 'Failed to fetch listing' });
    }
});

/**
 * Get marketplace stats
 * GET /api/marketplace/stats
 */
router.get('/stats', async (req, res) => {
    try {
        const marketplace = getModelMarketplace();
        const stats = await marketplace.getMarketplaceStats();
        res.json({ success: true, stats });
    } catch (error) {
        console.error('[API] Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// =============================================================================
// PUBLISHING
// =============================================================================

/**
 * Publish a model to marketplace
 * POST /api/marketplace/publish
 */
router.post('/publish', async (req, res) => {
    try {
        const {
            modelId,
            publisherName,
            name,
            description,
            shortDescription,
            tags,
            categories,
            capabilities,
            showcaseProjects,
            pricing,
        } = req.body;

        // Get the user model
        const modelManager = getUserModelManager();
        const userModel = await modelManager.getModel(modelId);

        if (!userModel) {
            return res.status(404).json({ error: 'User model not found' });
        }

        const marketplace = getModelMarketplace();
        const listing = await marketplace.publishModel({
            userModel,
            publisherName,
            name,
            description,
            shortDescription,
            tags,
            categories,
            capabilities,
            showcaseProjects: showcaseProjects || [],
            pricing,
        });

        res.status(201).json({ success: true, listing });
    } catch (error) {
        console.error('[API] Error publishing model:', error);
        res.status(500).json({ error: 'Failed to publish model' });
    }
});

/**
 * Update a marketplace listing
 * PATCH /api/marketplace/listings/:listingId
 */
router.patch('/listings/:listingId', async (req, res) => {
    try {
        const marketplace = getModelMarketplace();
        await marketplace.updateListing(req.params.listingId, req.body);
        const listing = await marketplace.getListing(req.params.listingId);
        res.json({ success: true, listing });
    } catch (error) {
        console.error('[API] Error updating listing:', error);
        res.status(500).json({ error: 'Failed to update listing' });
    }
});

/**
 * Add a project showcase
 * POST /api/marketplace/listings/:listingId/showcases
 */
router.post('/listings/:listingId/showcases', async (req, res) => {
    try {
        const marketplace = getModelMarketplace();
        const showcase = await marketplace.addShowcase(req.params.listingId, req.body);
        res.status(201).json({ success: true, showcase });
    } catch (error) {
        console.error('[API] Error adding showcase:', error);
        res.status(500).json({ error: 'Failed to add showcase' });
    }
});

/**
 * Unpublish a model
 * DELETE /api/marketplace/listings/:listingId
 */
router.delete('/listings/:listingId', async (req, res) => {
    try {
        const marketplace = getModelMarketplace();
        await marketplace.unpublishModel(req.params.listingId);
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Error unpublishing model:', error);
        res.status(500).json({ error: 'Failed to unpublish model' });
    }
});

// =============================================================================
// USER INTERACTIONS
// =============================================================================

/**
 * Download/add a model
 * POST /api/marketplace/listings/:listingId/download
 */
router.post('/listings/:listingId/download', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        const marketplace = getModelMarketplace();
        const result = await marketplace.downloadModel(req.params.listingId, userId);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[API] Error downloading model:', error);
        res.status(500).json({ error: 'Failed to download model' });
    }
});

/**
 * Fork a model
 * POST /api/marketplace/listings/:listingId/fork
 */
router.post('/listings/:listingId/fork', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        const marketplace = getModelMarketplace();
        const forkId = await marketplace.forkModel(req.params.listingId, userId);
        res.json({ success: true, forkId });
    } catch (error) {
        console.error('[API] Error forking model:', error);
        res.status(500).json({ error: 'Failed to fork model' });
    }
});

/**
 * Submit a review
 * POST /api/marketplace/listings/:listingId/reviews
 */
router.post('/listings/:listingId/reviews', async (req, res) => {
    try {
        const { userId, userName, rating, title, content, projectsCreated } = req.body;

        const marketplace = getModelMarketplace();
        const review = await marketplace.submitReview({
            listingId: req.params.listingId,
            userId,
            userName,
            rating,
            title,
            content,
            projectsCreated,
        });

        res.status(201).json({ success: true, review });
    } catch (error) {
        console.error('[API] Error submitting review:', error);
        res.status(500).json({ error: 'Failed to submit review' });
    }
});

/**
 * Get reviews for a listing
 * GET /api/marketplace/listings/:listingId/reviews
 */
router.get('/listings/:listingId/reviews', async (req, res) => {
    try {
        const marketplace = getModelMarketplace();
        const reviews = await marketplace.getReviews(req.params.listingId);
        res.json({ success: true, reviews });
    } catch (error) {
        console.error('[API] Error fetching reviews:', error);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

/**
 * Vote on a review
 * POST /api/marketplace/listings/:listingId/reviews/:reviewId/vote
 */
router.post('/listings/:listingId/reviews/:reviewId/vote', async (req, res) => {
    try {
        const { vote } = req.body;

        if (vote !== 'helpful' && vote !== 'unhelpful') {
            return res.status(400).json({ error: 'vote must be "helpful" or "unhelpful"' });
        }

        const marketplace = getModelMarketplace();
        await marketplace.voteOnReview(req.params.listingId, req.params.reviewId, vote);
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Error voting on review:', error);
        res.status(500).json({ error: 'Failed to vote' });
    }
});

/**
 * Like a showcase
 * POST /api/marketplace/listings/:listingId/showcases/:showcaseId/like
 */
router.post('/listings/:listingId/showcases/:showcaseId/like', async (req, res) => {
    try {
        const marketplace = getModelMarketplace();
        await marketplace.likeShowcase(req.params.listingId, req.params.showcaseId);
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Error liking showcase:', error);
        res.status(500).json({ error: 'Failed to like showcase' });
    }
});

/**
 * View a showcase (for analytics)
 * POST /api/marketplace/listings/:listingId/showcases/:showcaseId/view
 */
router.post('/listings/:listingId/showcases/:showcaseId/view', async (req, res) => {
    try {
        const marketplace = getModelMarketplace();
        await marketplace.viewShowcase(req.params.listingId, req.params.showcaseId);
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Error recording view:', error);
        res.status(500).json({ error: 'Failed to record view' });
    }
});

// =============================================================================
// PUBLISHER TOOLS
// =============================================================================

/**
 * Get publisher's listings
 * GET /api/marketplace/publisher/:publisherId/listings
 */
router.get('/publisher/:publisherId/listings', async (req, res) => {
    try {
        const marketplace = getModelMarketplace();
        const listings = await marketplace.getPublisherListings(req.params.publisherId);
        res.json({ success: true, listings });
    } catch (error) {
        console.error('[API] Error fetching publisher listings:', error);
        res.status(500).json({ error: 'Failed to fetch listings' });
    }
});

/**
 * Get publisher analytics
 * GET /api/marketplace/publisher/:publisherId/analytics
 */
router.get('/publisher/:publisherId/analytics', async (req, res) => {
    try {
        const marketplace = getModelMarketplace();
        const analytics = await marketplace.getPublisherAnalytics(req.params.publisherId);
        res.json({ success: true, analytics });
    } catch (error) {
        console.error('[API] Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

export default router;
