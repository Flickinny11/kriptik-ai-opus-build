/**
 * Model Marketplace
 *
 * A community marketplace where users can share, discover, and trade
 * their trained models. Features include:
 *
 * - Publishing models to marketplace
 * - Project thumbnails/screenshots showcasing model capabilities
 * - Model ratings and reviews
 * - Usage statistics and popularity rankings
 * - Category-based browsing (code style, design, framework-specific)
 * - Model forking (create your own version from a shared model)
 * - Revenue sharing for popular models
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { UserModel, UserModelPreferences } from './user-model-manager.js';

// =============================================================================
// TYPES
// =============================================================================

export interface MarketplaceModel {
    id: string;
    modelId: string;  // Reference to the actual UserModel
    publisherId: string;  // User ID of the publisher
    publisherName: string;

    // Display info
    name: string;
    description: string;
    shortDescription: string;  // For cards/previews
    tags: string[];
    categories: MarketplaceCategory[];
    icon?: string;  // URL to icon image

    // Capabilities showcased
    capabilities: ModelCapability[];

    // Project showcases
    showcaseProjects: ProjectShowcase[];

    // Stats
    stats: MarketplaceModelStats;

    // Pricing (for future monetization)
    pricing: ModelPricing;

    // Quality indicators
    qualityMetrics: ModelQualityMetrics;

    // Compatibility
    compatibility: {
        frameworks: string[];
        languages: string[];
        minVersion: string;
    };

    // Publishing info
    status: 'draft' | 'pending_review' | 'published' | 'suspended' | 'archived';
    featuredUntil?: Date;  // If it's a featured model
    publishedAt?: Date;
    lastUpdatedAt: Date;
    version: string;
}

export interface ProjectShowcase {
    id: string;
    projectId: string;
    projectName: string;
    description?: string;

    // Visual showcase
    thumbnailUrl: string;  // Primary thumbnail
    screenshotUrls: string[];  // Additional screenshots
    previewVideoUrl?: string;  // Optional demo video

    // Project details
    technologies: string[];
    projectType: string;  // 'web-app' | 'mobile' | 'api' | 'cli' | etc.
    linesOfCode?: number;
    filesCount?: number;

    // Creator info
    creatorId: string;
    creatorName: string;
    isPublisherProject: boolean;  // Created by model publisher vs community

    // Engagement
    likes: number;
    views: number;

    addedAt: Date;
}

export interface MarketplaceModelStats {
    downloads: number;
    activeUsers: number;  // Currently using this model
    totalProjectsCreated: number;
    averageRating: number;  // 0-5 stars
    totalRatings: number;
    weeklyDownloads: number;
    monthlyActiveUsers: number;
    totalInteractions: number;
    forkCount: number;  // How many times it's been forked
    // Revenue stats (for future)
    totalRevenue?: number;
    publisherEarnings?: number;
}

export interface ModelCapability {
    name: string;
    description: string;
    strength: 'strong' | 'moderate' | 'basic';
    examples?: string[];
}

export interface ModelPricing {
    type: 'free' | 'freemium' | 'paid' | 'subscription';
    price?: number;  // One-time price in cents
    monthlyPrice?: number;  // For subscription
    trialDays?: number;
    features: {
        free: string[];
        paid: string[];
    };
}

export interface ModelQualityMetrics {
    codeQualityScore: number;  // 0-100
    designQualityScore: number;
    accuracyScore: number;  // Based on user feedback
    consistencyScore: number;
    innovationScore: number;
    documentationScore: number;
    overallScore: number;  // Weighted average
}

export interface ModelReview {
    id: string;
    modelId: string;
    userId: string;
    userName: string;
    rating: number;  // 1-5 stars
    title: string;
    content: string;
    helpfulVotes: number;
    unhelpfulVotes: number;
    publisherResponse?: string;
    projectsCreated?: number;  // How many projects user created with this model
    createdAt: Date;
    updatedAt: Date;
}

export type MarketplaceCategory =
    | 'code-generation'
    | 'design-systems'
    | 'frontend'
    | 'backend'
    | 'full-stack'
    | 'mobile'
    | 'api-design'
    | 'testing'
    | 'devops'
    | 'data-science'
    | 'game-dev'
    | 'ai-ml'
    | 'enterprise'
    | 'startup'
    | 'minimalist'
    | 'feature-rich'
    | 'beginner-friendly'
    | 'expert-level';

export interface MarketplaceSearchFilters {
    query?: string;
    categories?: MarketplaceCategory[];
    frameworks?: string[];
    languages?: string[];
    minRating?: number;
    pricing?: ModelPricing['type'][];
    sortBy?: 'popular' | 'recent' | 'rating' | 'downloads' | 'trending';
    minQualityScore?: number;
}

// =============================================================================
// MODEL MARKETPLACE SERVICE
// =============================================================================

export class ModelMarketplace extends EventEmitter {
    private listings: Map<string, MarketplaceModel> = new Map();
    private reviews: Map<string, ModelReview[]> = new Map();
    private userDownloads: Map<string, Set<string>> = new Map();  // userId -> Set<modelIds>

    constructor() {
        super();
    }

    // =========================================================================
    // PUBLISHING
    // =========================================================================

    /**
     * Publish a user model to the marketplace
     */
    async publishModel(input: {
        userModel: UserModel;
        publisherName: string;
        name: string;
        description: string;
        shortDescription: string;
        tags: string[];
        categories: MarketplaceCategory[];
        capabilities: ModelCapability[];
        showcaseProjects: Omit<ProjectShowcase, 'id' | 'likes' | 'views' | 'addedAt'>[];
        pricing?: Partial<ModelPricing>;
    }): Promise<MarketplaceModel> {
        const listingId = `mkt-${uuidv4().slice(0, 12)}`;

        // Calculate quality metrics from user model
        const qualityMetrics = this.calculateQualityMetrics(input.userModel);

        // Create showcases with IDs
        const showcases: ProjectShowcase[] = input.showcaseProjects.map(p => ({
            ...p,
            id: uuidv4(),
            likes: 0,
            views: 0,
            addedAt: new Date(),
        }));

        const listing: MarketplaceModel = {
            id: listingId,
            modelId: input.userModel.id,
            publisherId: input.userModel.userId,
            publisherName: input.publisherName,
            name: input.name,
            description: input.description,
            shortDescription: input.shortDescription,
            tags: input.tags,
            categories: input.categories,
            capabilities: input.capabilities,
            showcaseProjects: showcases,
            stats: {
                downloads: 0,
                activeUsers: 0,
                totalProjectsCreated: input.userModel.metrics.projectsUsedIn,
                averageRating: 0,
                totalRatings: 0,
                weeklyDownloads: 0,
                monthlyActiveUsers: 0,
                totalInteractions: input.userModel.metrics.totalInteractions,
                forkCount: 0,
            },
            pricing: {
                type: 'free',
                features: { free: ['Full access'], paid: [] },
                ...input.pricing,
            },
            qualityMetrics,
            compatibility: {
                frameworks: input.userModel.preferences.codeStyle.preferredFrameworks,
                languages: this.detectLanguages(input.userModel.preferences),
                minVersion: '1.0.0',
            },
            status: 'pending_review',
            lastUpdatedAt: new Date(),
            version: '1.0.0',
        };

        this.listings.set(listingId, listing);
        this.reviews.set(listingId, []);

        // Auto-approve for now (in production, would go through review)
        await this.approveModel(listingId);

        this.emit('model_published', { listingId, publisherId: input.userModel.userId });
        console.log(`[Marketplace] Model ${input.name} published by ${input.publisherName}`);

        return listing;
    }

    /**
     * Approve a pending model (admin action)
     */
    async approveModel(listingId: string): Promise<void> {
        const listing = this.listings.get(listingId);
        if (!listing) throw new Error(`Listing ${listingId} not found`);

        listing.status = 'published';
        listing.publishedAt = new Date();

        this.emit('model_approved', { listingId });
    }

    /**
     * Update a published model
     */
    async updateListing(
        listingId: string,
        updates: Partial<Pick<MarketplaceModel,
            'name' | 'description' | 'shortDescription' | 'tags' | 'categories' | 'capabilities' | 'pricing'
        >>
    ): Promise<void> {
        const listing = this.listings.get(listingId);
        if (!listing) throw new Error(`Listing ${listingId} not found`);

        Object.assign(listing, updates, { lastUpdatedAt: new Date() });

        // Bump version on significant updates
        if (updates.capabilities || updates.pricing) {
            listing.version = this.bumpVersion(listing.version);
        }

        this.emit('listing_updated', { listingId });
    }

    /**
     * Add a project showcase
     */
    async addShowcase(listingId: string, showcase: Omit<ProjectShowcase, 'id' | 'likes' | 'views' | 'addedAt'>): Promise<ProjectShowcase> {
        const listing = this.listings.get(listingId);
        if (!listing) throw new Error(`Listing ${listingId} not found`);

        const newShowcase: ProjectShowcase = {
            ...showcase,
            id: uuidv4(),
            likes: 0,
            views: 0,
            addedAt: new Date(),
        };

        listing.showcaseProjects.push(newShowcase);
        listing.lastUpdatedAt = new Date();

        this.emit('showcase_added', { listingId, showcaseId: newShowcase.id });
        return newShowcase;
    }

    /**
     * Unpublish/archive a model
     */
    async unpublishModel(listingId: string): Promise<void> {
        const listing = this.listings.get(listingId);
        if (!listing) throw new Error(`Listing ${listingId} not found`);

        listing.status = 'archived';
        listing.lastUpdatedAt = new Date();

        this.emit('model_unpublished', { listingId });
    }

    // =========================================================================
    // DISCOVERY & SEARCH
    // =========================================================================

    /**
     * Search marketplace models
     */
    async searchModels(filters: MarketplaceSearchFilters): Promise<{
        models: MarketplaceModel[];
        total: number;
        page: number;
        pageSize: number;
    }> {
        let results = Array.from(this.listings.values())
            .filter(m => m.status === 'published');

        // Apply filters
        if (filters.query) {
            const query = filters.query.toLowerCase();
            results = results.filter(m =>
                m.name.toLowerCase().includes(query) ||
                m.description.toLowerCase().includes(query) ||
                m.tags.some(t => t.toLowerCase().includes(query))
            );
        }

        if (filters.categories?.length) {
            results = results.filter(m =>
                filters.categories!.some(c => m.categories.includes(c))
            );
        }

        if (filters.frameworks?.length) {
            results = results.filter(m =>
                filters.frameworks!.some(f =>
                    m.compatibility.frameworks.some(cf =>
                        cf.toLowerCase().includes(f.toLowerCase())
                    )
                )
            );
        }

        if (filters.minRating) {
            results = results.filter(m => m.stats.averageRating >= filters.minRating!);
        }

        if (filters.pricing?.length) {
            results = results.filter(m => filters.pricing!.includes(m.pricing.type));
        }

        if (filters.minQualityScore) {
            results = results.filter(m => m.qualityMetrics.overallScore >= filters.minQualityScore!);
        }

        // Sort
        results = this.sortModels(results, filters.sortBy || 'popular');

        const total = results.length;

        return {
            models: results,
            total,
            page: 1,
            pageSize: results.length,
        };
    }

    /**
     * Get featured models
     */
    async getFeaturedModels(): Promise<MarketplaceModel[]> {
        const now = new Date();
        const featured = Array.from(this.listings.values())
            .filter(m =>
                m.status === 'published' &&
                m.featuredUntil &&
                m.featuredUntil > now
            );

        // If no explicitly featured, get top-rated
        if (featured.length < 6) {
            const topRated = Array.from(this.listings.values())
                .filter(m => m.status === 'published' && m.stats.averageRating >= 4)
                .sort((a, b) => b.stats.downloads - a.stats.downloads)
                .slice(0, 6 - featured.length);

            return [...featured, ...topRated];
        }

        return featured;
    }

    /**
     * Get trending models
     */
    async getTrendingModels(): Promise<MarketplaceModel[]> {
        return Array.from(this.listings.values())
            .filter(m => m.status === 'published')
            .sort((a, b) => b.stats.weeklyDownloads - a.stats.weeklyDownloads)
            .slice(0, 10);
    }

    /**
     * Get models by category
     */
    async getModelsByCategory(category: MarketplaceCategory): Promise<MarketplaceModel[]> {
        return Array.from(this.listings.values())
            .filter(m => m.status === 'published' && m.categories.includes(category))
            .sort((a, b) => b.stats.downloads - a.stats.downloads);
    }

    /**
     * Get a single model listing
     */
    async getListing(listingId: string): Promise<MarketplaceModel | undefined> {
        return this.listings.get(listingId);
    }

    /**
     * Get model reviews
     */
    async getReviews(listingId: string): Promise<ModelReview[]> {
        return this.reviews.get(listingId) || [];
    }

    // =========================================================================
    // USER INTERACTIONS
    // =========================================================================

    /**
     * Download/add a model to user's collection
     */
    async downloadModel(listingId: string, userId: string): Promise<{
        modelId: string;
        adapterPath?: string;
    }> {
        const listing = this.listings.get(listingId);
        if (!listing) throw new Error(`Listing ${listingId} not found`);
        if (listing.status !== 'published') throw new Error('Model not available');

        // Track download
        const userDownloads = this.userDownloads.get(userId) || new Set();
        const isNewDownload = !userDownloads.has(listingId);

        if (isNewDownload) {
            userDownloads.add(listingId);
            this.userDownloads.set(userId, userDownloads);

            listing.stats.downloads++;
            listing.stats.weeklyDownloads++;
        }

        listing.stats.activeUsers++;

        this.emit('model_downloaded', { listingId, userId, isNewDownload });

        return {
            modelId: listing.modelId,
            // In practice, would return the actual adapter path
            adapterPath: `marketplace/${listingId}/adapter`,
        };
    }

    /**
     * Fork a model to create your own version
     */
    async forkModel(listingId: string, userId: string): Promise<string> {
        const listing = this.listings.get(listingId);
        if (!listing) throw new Error(`Listing ${listingId} not found`);

        // Increment fork count
        listing.stats.forkCount++;

        // Emit event for UserModelManager to create the fork
        this.emit('model_forked', {
            originalListingId: listingId,
            originalModelId: listing.modelId,
            userId,
            baseName: listing.name,
        });

        return `fork-${listingId}-${userId.slice(0, 8)}`;
    }

    /**
     * Submit a review
     */
    async submitReview(input: {
        listingId: string;
        userId: string;
        userName: string;
        rating: number;
        title: string;
        content: string;
        projectsCreated?: number;
    }): Promise<ModelReview> {
        const listing = this.listings.get(listingId);
        if (!listing) throw new Error(`Listing ${listing} not found`);

        const review: ModelReview = {
            id: uuidv4(),
            modelId: input.listingId,
            userId: input.userId,
            userName: input.userName,
            rating: Math.min(5, Math.max(1, input.rating)),
            title: input.title,
            content: input.content,
            helpfulVotes: 0,
            unhelpfulVotes: 0,
            projectsCreated: input.projectsCreated,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const reviews = this.reviews.get(input.listingId) || [];
        reviews.push(review);
        this.reviews.set(input.listingId, reviews);

        // Update average rating
        const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
        listing.stats.averageRating = totalRating / reviews.length;
        listing.stats.totalRatings = reviews.length;

        this.emit('review_submitted', { listingId: input.listingId, reviewId: review.id });
        return review;
    }

    /**
     * Vote on a review
     */
    async voteOnReview(
        listingId: string,
        reviewId: string,
        vote: 'helpful' | 'unhelpful'
    ): Promise<void> {
        const reviews = this.reviews.get(listingId) || [];
        const review = reviews.find(r => r.id === reviewId);

        if (!review) throw new Error(`Review ${reviewId} not found`);

        if (vote === 'helpful') {
            review.helpfulVotes++;
        } else {
            review.unhelpfulVotes++;
        }

        review.updatedAt = new Date();
    }

    /**
     * Like a showcase project
     */
    async likeShowcase(listingId: string, showcaseId: string): Promise<void> {
        const listing = this.listings.get(listingId);
        if (!listing) throw new Error(`Listing ${listingId} not found`);

        const showcase = listing.showcaseProjects.find(s => s.id === showcaseId);
        if (!showcase) throw new Error(`Showcase ${showcaseId} not found`);

        showcase.likes++;
        this.emit('showcase_liked', { listingId, showcaseId });
    }

    /**
     * Record showcase view
     */
    async viewShowcase(listingId: string, showcaseId: string): Promise<void> {
        const listing = this.listings.get(listingId);
        if (!listing) return;

        const showcase = listing.showcaseProjects.find(s => s.id === showcaseId);
        if (showcase) {
            showcase.views++;
        }
    }

    // =========================================================================
    // PUBLISHER TOOLS
    // =========================================================================

    /**
     * Get publisher's listings
     */
    async getPublisherListings(publisherId: string): Promise<MarketplaceModel[]> {
        return Array.from(this.listings.values())
            .filter(m => m.publisherId === publisherId);
    }

    /**
     * Get publisher analytics
     */
    async getPublisherAnalytics(publisherId: string): Promise<{
        totalDownloads: number;
        totalActiveUsers: number;
        totalRevenue: number;
        averageRating: number;
        topModels: MarketplaceModel[];
        recentReviews: ModelReview[];
    }> {
        const listings = await this.getPublisherListings(publisherId);

        let totalDownloads = 0;
        let totalActiveUsers = 0;
        let totalRevenue = 0;
        let ratingSum = 0;
        let ratingCount = 0;

        for (const listing of listings) {
            totalDownloads += listing.stats.downloads;
            totalActiveUsers += listing.stats.activeUsers;
            totalRevenue += listing.stats.totalRevenue || 0;
            if (listing.stats.totalRatings > 0) {
                ratingSum += listing.stats.averageRating * listing.stats.totalRatings;
                ratingCount += listing.stats.totalRatings;
            }
        }

        // Get recent reviews across all listings
        const allReviews: ModelReview[] = [];
        for (const listing of listings) {
            const reviews = this.reviews.get(listing.id) || [];
            allReviews.push(...reviews);
        }

        const sortedReviews = allReviews
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 10);

        return {
            totalDownloads,
            totalActiveUsers,
            totalRevenue,
            averageRating: ratingCount > 0 ? ratingSum / ratingCount : 0,
            topModels: listings.sort((a, b) => b.stats.downloads - a.stats.downloads).slice(0, 5),
            recentReviews: sortedReviews,
        };
    }

    // =========================================================================
    // ADMIN/SYSTEM
    // =========================================================================

    /**
     * Feature a model
     */
    async featureModel(listingId: string, durationDays: number): Promise<void> {
        const listing = this.listings.get(listingId);
        if (!listing) throw new Error(`Listing ${listingId} not found`);

        const featuredUntil = new Date();
        featuredUntil.setDate(featuredUntil.getDate() + durationDays);

        listing.featuredUntil = featuredUntil;
        this.emit('model_featured', { listingId, featuredUntil });
    }

    /**
     * Suspend a model (admin action)
     */
    async suspendModel(listingId: string, reason: string): Promise<void> {
        const listing = this.listings.get(listingId);
        if (!listing) throw new Error(`Listing ${listingId} not found`);

        listing.status = 'suspended';
        listing.lastUpdatedAt = new Date();

        this.emit('model_suspended', { listingId, reason });
    }

    /**
     * Get marketplace stats
     */
    async getMarketplaceStats(): Promise<{
        totalListings: number;
        publishedListings: number;
        totalDownloads: number;
        totalActiveUsers: number;
        averageRating: number;
        categoryCounts: Record<string, number>;
    }> {
        const listings = Array.from(this.listings.values());
        const published = listings.filter(l => l.status === 'published');

        let totalDownloads = 0;
        let totalActiveUsers = 0;
        let ratingSum = 0;
        let ratingCount = 0;
        const categoryCounts: Record<string, number> = {};

        for (const listing of published) {
            totalDownloads += listing.stats.downloads;
            totalActiveUsers += listing.stats.activeUsers;
            if (listing.stats.totalRatings > 0) {
                ratingSum += listing.stats.averageRating * listing.stats.totalRatings;
                ratingCount += listing.stats.totalRatings;
            }
            for (const category of listing.categories) {
                categoryCounts[category] = (categoryCounts[category] || 0) + 1;
            }
        }

        return {
            totalListings: listings.length,
            publishedListings: published.length,
            totalDownloads,
            totalActiveUsers,
            averageRating: ratingCount > 0 ? ratingSum / ratingCount : 0,
            categoryCounts,
        };
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private calculateQualityMetrics(model: UserModel): ModelQualityMetrics {
        const metrics = model.metrics;

        // Base scores from model metrics
        const accuracyScore = metrics.predictionAccuracy;
        const codeQualityScore = Math.min(100, metrics.codeQualityImprovement + 50);
        const consistencyScore = metrics.totalInteractions > 100 ? 80 : 60;
        const documentationScore = 70;  // Default

        // Innovation score based on unique capabilities
        const uniqueFrameworks = model.preferences.codeStyle.preferredFrameworks.length;
        const innovationScore = Math.min(100, 50 + uniqueFrameworks * 10);

        // Design quality from preferences
        const designQualityScore = model.preferences.designStyle.colorSchemes.length > 0 ? 75 : 50;

        // Overall weighted score
        const overallScore = (
            accuracyScore * 0.3 +
            codeQualityScore * 0.2 +
            designQualityScore * 0.15 +
            consistencyScore * 0.15 +
            innovationScore * 0.1 +
            documentationScore * 0.1
        );

        return {
            codeQualityScore,
            designQualityScore,
            accuracyScore,
            consistencyScore,
            innovationScore,
            documentationScore,
            overallScore,
        };
    }

    private detectLanguages(preferences: UserModelPreferences): string[] {
        const languages: string[] = [];
        const frameworks = preferences.codeStyle.preferredFrameworks;

        // Detect languages from frameworks
        const frameworkLanguageMap: Record<string, string> = {
            'React': 'JavaScript/TypeScript',
            'Vue': 'JavaScript/TypeScript',
            'Angular': 'TypeScript',
            'Svelte': 'JavaScript/TypeScript',
            'Next.js': 'JavaScript/TypeScript',
            'Express': 'JavaScript/TypeScript',
            'Django': 'Python',
            'Flask': 'Python',
            'FastAPI': 'Python',
            'Rails': 'Ruby',
            'Spring': 'Java',
            'Gin': 'Go',
            'Actix': 'Rust',
        };

        for (const framework of frameworks) {
            const lang = frameworkLanguageMap[framework];
            if (lang && !languages.includes(lang)) {
                languages.push(lang);
            }
        }

        // Default to common languages if none detected
        if (languages.length === 0) {
            languages.push('JavaScript/TypeScript');
        }

        return languages;
    }

    private sortModels(
        models: MarketplaceModel[],
        sortBy: MarketplaceSearchFilters['sortBy']
    ): MarketplaceModel[] {
        switch (sortBy) {
            case 'popular':
                return models.sort((a, b) => b.stats.downloads - a.stats.downloads);
            case 'recent':
                return models.sort((a, b) =>
                    (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0)
                );
            case 'rating':
                return models.sort((a, b) => b.stats.averageRating - a.stats.averageRating);
            case 'downloads':
                return models.sort((a, b) => b.stats.downloads - a.stats.downloads);
            case 'trending':
                return models.sort((a, b) => b.stats.weeklyDownloads - a.stats.weeklyDownloads);
            default:
                return models;
        }
    }

    private bumpVersion(version: string): string {
        const parts = version.split('.').map(Number);
        parts[2] = (parts[2] || 0) + 1;
        return parts.join('.');
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: ModelMarketplace | null = null;

export function getModelMarketplace(): ModelMarketplace {
    if (!instance) {
        instance = new ModelMarketplace();
    }
    return instance;
}
