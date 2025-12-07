/**
 * Krip-Toe-Nite API Routes
 *
 * API endpoints for the intelligent model orchestration system.
 */

import { Router, type Request, type Response } from 'express';
import {
    getKripToeNiteService,
    getAllModelsForDisplay,
    type GenerationRequest,
} from '../services/ai/krip-toe-nite/index.js';

const router = Router();

// =============================================================================
// GENERATION ENDPOINTS
// =============================================================================

/**
 * POST /api/krip-toe-nite/generate
 *
 * Generate a response using intelligent model orchestration.
 * Streams the response using SSE.
 */
router.post('/generate', async (req: Request, res: Response) => {
    try {
        const { prompt, systemPrompt, context, maxTokens, temperature } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Set up SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        const service = getKripToeNiteService();

        const request: GenerationRequest = {
            prompt,
            systemPrompt,
            context,
            maxTokens,
            temperature,
            stream: true,
        };

        // Stream chunks
        for await (const chunk of service.generate(request)) {
            const data = JSON.stringify({
                type: chunk.type,
                content: chunk.content,
                model: chunk.model,
                strategy: chunk.strategy,
                timestamp: chunk.timestamp,
                metadata: chunk.metadata,
            });

            res.write(`data: ${data}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        console.error('[KripToeNite] Generation error:', error);

        // If headers already sent, send error as SSE
        if (res.headersSent) {
            res.write(`data: ${JSON.stringify({
                type: 'error',
                content: error instanceof Error ? error.message : 'Unknown error',
            })}\n\n`);
            res.end();
        } else {
            res.status(500).json({
                error: 'Generation failed',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
});

/**
 * POST /api/krip-toe-nite/generate/sync
 *
 * Generate a response synchronously (non-streaming).
 */
router.post('/generate/sync', async (req: Request, res: Response) => {
    try {
        const { prompt, systemPrompt, context, maxTokens, temperature } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const service = getKripToeNiteService();

        const request: GenerationRequest = {
            prompt,
            systemPrompt,
            context,
            maxTokens,
            temperature,
        };

        const response = await service.generateSync(request);

        res.json({
            success: true,
            response,
        });

    } catch (error) {
        console.error('[KripToeNite] Sync generation error:', error);
        res.status(500).json({
            error: 'Generation failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// =============================================================================
// ANALYSIS ENDPOINTS
// =============================================================================

/**
 * POST /api/krip-toe-nite/analyze
 *
 * Analyze a prompt to see routing decision without generating.
 */
router.post('/analyze', async (req: Request, res: Response) => {
    try {
        const { prompt, context } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const service = getKripToeNiteService();
        const analysis = service.analyzePrompt(prompt, context);

        res.json({
            success: true,
            analysis: {
                taskType: analysis.analysis.taskType,
                complexity: analysis.analysis.complexity,
                isDesignHeavy: analysis.analysis.isDesignHeavy,
                isCritical: analysis.analysis.isCritical,
                reason: analysis.analysis.reason,
            },
            routing: {
                strategy: analysis.decision.strategy,
                primaryModel: analysis.decision.primaryModel.name,
                parallelModel: analysis.decision.parallelModel?.name,
                reasoning: analysis.decision.reasoning,
            },
            estimatedCost: analysis.estimatedCost,
        });

    } catch (error) {
        console.error('[KripToeNite] Analysis error:', error);
        res.status(500).json({
            error: 'Analysis failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// =============================================================================
// MODEL INFO ENDPOINTS
// =============================================================================

/**
 * GET /api/krip-toe-nite/models
 *
 * Get list of available models for UI display.
 */
router.get('/models', (_req: Request, res: Response) => {
    try {
        const models = getAllModelsForDisplay();

        res.json({
            success: true,
            models,
            recommended: 'krip-toe-nite',
        });

    } catch (error) {
        console.error('[KripToeNite] Models list error:', error);
        res.status(500).json({
            error: 'Failed to get models',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/krip-toe-nite/stats
 *
 * Get service statistics.
 */
router.get('/stats', (_req: Request, res: Response) => {
    try {
        const service = getKripToeNiteService();
        const stats = service.getStats();

        res.json({
            success: true,
            stats,
        });

    } catch (error) {
        console.error('[KripToeNite] Stats error:', error);
        res.status(500).json({
            error: 'Failed to get stats',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/krip-toe-nite/telemetry
 *
 * Get and clear buffered telemetry for Learning Engine integration.
 */
router.get('/telemetry', (_req: Request, res: Response) => {
    try {
        const service = getKripToeNiteService();
        const telemetry = service.getAndClearTelemetry();

        res.json({
            success: true,
            telemetry,
            count: telemetry.length,
        });

    } catch (error) {
        console.error('[KripToeNite] Telemetry error:', error);
        res.status(500).json({
            error: 'Failed to get telemetry',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * GET /api/krip-toe-nite/health
 *
 * Health check for Krip-Toe-Nite service.
 */
router.get('/health', (_req: Request, res: Response) => {
    try {
        const service = getKripToeNiteService();
        const stats = service.getStats();

        res.json({
            status: 'ok',
            service: 'krip-toe-nite',
            version: '1.0.0',
            requestCount: stats.requestCount,
            uptime: process.uptime(),
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            service: 'krip-toe-nite',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

export default router;

