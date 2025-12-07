/**
 * Market Fit Oracle API Routes
 *
 * AI-powered competitor analysis and market positioning
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
    getMarketFitOracleService,
    type MarketAnalysis,
    type CompetitorProfile,
    type AnalysisProgress
} from '../services/market/market-fit-oracle.js';
import { db } from '../db.js';
import { marketCompetitors, marketAnalyses } from '../schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// SSE clients for live progress
const sseClients = new Map<string, Response[]>();

/**
 * POST /api/market-fit/analyze
 * Start a full market analysis for a project
 */
router.post('/analyze', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { projectId, targetMarket, appDescription, competitorUrls } = req.body;

        if (!projectId || !targetMarket || !appDescription) {
            return res.status(400).json({
                success: false,
                error: 'projectId, targetMarket, and appDescription are required'
            });
        }

        const service = getMarketFitOracleService();

        // Set up progress listener
        const analysisId = uuidv4();
        service.on('progress', (progress: AnalysisProgress & { analysisId: string }) => {
            if (progress.analysisId) {
                broadcastProgress(analysisId, progress);
            }
        });

        // Start analysis in background
        service.analyzeMarket({
            projectId,
            targetMarket,
            appDescription,
            existingCompetitorUrls: competitorUrls,
        }).then(async (analysis) => {
            // Save to database
            await db.insert(marketAnalyses).values({
                id: analysis.id,
                projectId,
                targetMarket,
                gaps: analysis.gaps as any,
                opportunities: analysis.opportunities as any,
                positioning: analysis.positioning as any,
                createdAt: new Date().toISOString(),
            });

            // Save competitors
            for (const competitor of analysis.competitors) {
                await db.insert(marketCompetitors).values({
                    id: competitor.id,
                    projectId,
                    name: competitor.name,
                    url: competitor.url,
                    features: competitor.features as any,
                    pricing: competitor.pricing as any,
                    analysis: {
                        description: competitor.description,
                        marketPosition: competitor.marketPosition,
                        strengths: competitor.strengths,
                        weaknesses: competitor.weaknesses,
                        designPatterns: competitor.designPatterns,
                    } as any,
                    lastAnalyzed: competitor.lastAnalyzed.toISOString(),
                });
            }

            broadcastProgress(analysisId, {
                phase: 'complete',
                currentStep: 'Analysis complete!',
                progress: 100,
                competitorsFound: analysis.competitors.length,
                competitorsAnalyzed: analysis.competitors.length,
                analysis,
            });
        }).catch((error) => {
            console.error('Market analysis failed:', error);
            broadcastProgress(analysisId, {
                phase: 'complete',
                currentStep: 'Analysis failed',
                progress: 100,
                error: error.message,
            });
        });

        res.json({
            success: true,
            analysisId,
            message: 'Market analysis started. Connect to SSE for progress updates.'
        });
    } catch (error) {
        console.error('Error starting market analysis:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to start analysis'
        });
    }
});

/**
 * POST /api/market-fit/add-competitor
 * Add a competitor to track
 */
router.post('/add-competitor', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { projectId, competitorUrl, targetMarket } = req.body;

        if (!projectId || !competitorUrl) {
            return res.status(400).json({
                success: false,
                error: 'projectId and competitorUrl are required'
            });
        }

        const service = getMarketFitOracleService();
        const profile = await service.addCompetitor(projectId, competitorUrl, targetMarket || 'general');

        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'No existing analysis found for this project. Run full analysis first.'
            });
        }

        // Save to database
        await db.insert(marketCompetitors).values({
            id: profile.id,
            projectId,
            name: profile.name,
            url: profile.url,
            features: profile.features as any,
            pricing: profile.pricing as any,
            analysis: {
                description: profile.description,
                marketPosition: profile.marketPosition,
                strengths: profile.strengths,
                weaknesses: profile.weaknesses,
            } as any,
            lastAnalyzed: profile.lastAnalyzed.toISOString(),
        });

        res.json({
            success: true,
            competitor: profile
        });
    } catch (error) {
        console.error('Error adding competitor:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to add competitor'
        });
    }
});

/**
 * GET /api/market-fit/analysis/:projectId
 * Get current market analysis for a project
 */
router.get('/analysis/:projectId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        // Check in-memory first
        const service = getMarketFitOracleService();
        const memoryAnalysis = service.getAnalysis(projectId);

        if (memoryAnalysis) {
            return res.json({
                success: true,
                analysis: memoryAnalysis
            });
        }

        // Check database
        const dbAnalysis = await db.select()
            .from(marketAnalyses)
            .where(eq(marketAnalyses.projectId, projectId))
            .get();

        if (!dbAnalysis) {
            return res.status(404).json({
                success: false,
                error: 'No analysis found for this project'
            });
        }

        // Get competitors
        const competitors = await db.select()
            .from(marketCompetitors)
            .where(eq(marketCompetitors.projectId, projectId));

        res.json({
            success: true,
            analysis: {
                id: dbAnalysis.id,
                projectId: dbAnalysis.projectId,
                targetMarket: dbAnalysis.targetMarket,
                gaps: dbAnalysis.gaps,
                opportunities: dbAnalysis.opportunities,
                positioning: dbAnalysis.positioning,
                competitors: competitors.map(c => ({
                    id: c.id,
                    name: c.name,
                    url: c.url,
                    features: c.features,
                    pricing: c.pricing,
                    ...(c.analysis as any || {}),
                    lastAnalyzed: c.lastAnalyzed,
                })),
                createdAt: dbAnalysis.createdAt,
            }
        });
    } catch (error) {
        console.error('Error getting analysis:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get analysis'
        });
    }
});

/**
 * POST /api/market-fit/refresh
 * Re-analyze all competitors for a project
 */
router.post('/refresh', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { projectId } = req.body;

        if (!projectId) {
            return res.status(400).json({
                success: false,
                error: 'projectId is required'
            });
        }

        const service = getMarketFitOracleService();

        // Get existing analysis
        let existingAnalysis = service.getAnalysis(projectId);

        if (!existingAnalysis) {
            // Try to load from database
            const dbAnalysis = await db.select()
                .from(marketAnalyses)
                .where(eq(marketAnalyses.projectId, projectId))
                .get();

            if (!dbAnalysis) {
                return res.status(404).json({
                    success: false,
                    error: 'No existing analysis found. Run full analysis first.'
                });
            }

            // Get competitors from database
            const dbCompetitors = await db.select()
                .from(marketCompetitors)
                .where(eq(marketCompetitors.projectId, projectId));

            if (dbCompetitors.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'No competitors found to refresh.'
                });
            }

            // Start fresh analysis with existing competitor URLs
            const analysisId = uuidv4();

            service.on('progress', (progress: AnalysisProgress & { analysisId: string }) => {
                broadcastProgress(analysisId, progress);
            });

            service.analyzeMarket({
                projectId,
                targetMarket: dbAnalysis.targetMarket || 'general',
                appDescription: 'Existing product',
                existingCompetitorUrls: dbCompetitors.map(c => c.url),
            }).then(async (analysis) => {
                // Update database
                await db.update(marketAnalyses)
                    .set({
                        gaps: analysis.gaps as any,
                        opportunities: analysis.opportunities as any,
                        positioning: analysis.positioning as any,
                    })
                    .where(eq(marketAnalyses.projectId, projectId));

                broadcastProgress(analysisId, {
                    phase: 'complete',
                    currentStep: 'Refresh complete!',
                    progress: 100,
                    analysis,
                });
            });

            return res.json({
                success: true,
                analysisId,
                message: 'Refresh started'
            });
        }

        // Refresh from memory
        const refreshed = await service.refreshAnalysis(projectId);

        if (!refreshed) {
            return res.status(500).json({
                success: false,
                error: 'Failed to refresh analysis'
            });
        }

        res.json({
            success: true,
            analysis: refreshed
        });
    } catch (error) {
        console.error('Error refreshing analysis:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to refresh analysis'
        });
    }
});

/**
 * GET /api/market-fit/gaps/:projectId
 * Get feature gap matrix for a project
 */
router.get('/gaps/:projectId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        const service = getMarketFitOracleService();
        const gapMatrix = service.getGapMatrix(projectId);

        if (!gapMatrix) {
            return res.status(404).json({
                success: false,
                error: 'No analysis found for this project'
            });
        }

        res.json({
            success: true,
            gapMatrix
        });
    } catch (error) {
        console.error('Error getting gap matrix:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get gap matrix'
        });
    }
});

/**
 * GET /api/market-fit/competitors/:projectId
 * Get all competitors for a project
 */
router.get('/competitors/:projectId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        const competitors = await db.select()
            .from(marketCompetitors)
            .where(eq(marketCompetitors.projectId, projectId));

        res.json({
            success: true,
            competitors: competitors.map(c => ({
                id: c.id,
                name: c.name,
                url: c.url,
                features: c.features,
                pricing: c.pricing,
                ...(c.analysis as any || {}),
                lastAnalyzed: c.lastAnalyzed,
            }))
        });
    } catch (error) {
        console.error('Error getting competitors:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get competitors'
        });
    }
});

/**
 * DELETE /api/market-fit/competitors/:competitorId
 * Remove a competitor from tracking
 */
router.delete('/competitors/:competitorId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { competitorId } = req.params;

        await db.delete(marketCompetitors)
            .where(eq(marketCompetitors.id, competitorId));

        res.json({
            success: true,
            message: 'Competitor removed'
        });
    } catch (error) {
        console.error('Error removing competitor:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to remove competitor'
        });
    }
});

/**
 * GET /api/market-fit/stream/:analysisId
 * SSE endpoint for analysis progress
 */
router.get('/stream/:analysisId', authMiddleware, (req: Request, res: Response) => {
    const { analysisId } = req.params;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Register client
    if (!sseClients.has(analysisId)) {
        sseClients.set(analysisId, []);
    }
    sseClients.get(analysisId)!.push(res);

    // Send initial ping
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Handle disconnect
    req.on('close', () => {
        const clients = sseClients.get(analysisId);
        if (clients) {
            const index = clients.indexOf(res);
            if (index > -1) {
                clients.splice(index, 1);
            }
            if (clients.length === 0) {
                sseClients.delete(analysisId);
            }
        }
    });
});

/**
 * Broadcast progress to SSE clients
 */
function broadcastProgress(analysisId: string, data: unknown): void {
    const clients = sseClients.get(analysisId);
    if (clients) {
        const message = JSON.stringify(data);
        clients.forEach(client => {
            try {
                client.write(`data: ${message}\n\n`);
            } catch {
                // Client disconnected
            }
        });
    }
}

export default router;

