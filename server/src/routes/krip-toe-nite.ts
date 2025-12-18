/**
 * Krip-Toe-Nite API Routes
 *
 * CRITICAL UPDATE (Dec 18, 2025):
 * KTN now supports two modes:
 * 1. Quick Generation (original) - for simple prompts, chat responses
 * 2. Build Mode (new) - routes through UnifiedBuildService with full pipeline
 *
 * Build Mode enforces:
 * - Intent Lock (Sacred Contract)
 * - 6-Phase Build Loop
 * - Verification Swarm
 * - Done Contract
 *
 * Quick Generation is still available for non-build use cases.
 */

import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
    getKripToeNiteService,
    getAllModelsForDisplay,
    type GenerationRequest,
} from '../services/ai/krip-toe-nite/index.js';
import {
    getUnifiedBuildService,
    type UnifiedBuildEvent,
} from '../services/orchestration/unified-build-service.js';
import { getSharedContextPool } from '../services/orchestration/shared-context-pool.js';

const router = Router();

const unifiedService = getUnifiedBuildService();
const contextPool = getSharedContextPool();

// =============================================================================
// BUILD MODE ENDPOINTS (NEW - With Intent Lock)
// =============================================================================

/**
 * POST /api/krip-toe-nite/build
 *
 * Build mode generation - routes through UnifiedBuildService.
 * This enforces Intent Lock, 6-phase build loop, and Done Contract.
 *
 * Use this for:
 * - Full app generation
 * - Feature implementation
 * - Multi-file code generation
 */
router.post('/build', async (req: Request, res: Response) => {
    try {
        const {
            prompt,
            projectId,
            projectName,
            mode = 'standard',
            enableEnhanced = true,
        } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const userId = (req as Request & { user?: { id: string } }).user?.id || 'anonymous';
        const id = projectId || uuidv4();

        // Set up SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        const sendEvent = (eventType: string, data: unknown) => {
            res.write(`event: ${eventType}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        // Start unified build (with Intent Lock)
        const { buildId, session, stream } = await unifiedService.startBuild({
            prompt,
            projectId: id,
            userId,
            projectName: projectName || `KTN Build ${Date.now()}`,
            entryPoint: 'ktn',
            mode,
            enableEnhanced,
        });

        sendEvent('build_started', {
            buildId,
            projectId: id,
            entryPoint: 'ktn',
            message: 'KTN Build started with Intent Lock enforcement',
        });

        // Stream all events
        for await (const event of stream) {
            // Map build events to KTN-style events for compatibility
            sendEvent(event.type, {
                type: event.type,
                ...event.data,
                timestamp: event.timestamp,
                buildId: event.buildId,
            });

            if (event.type === 'build_complete') {
                break;
            }
        }

        // Final status
        const finalSession = unifiedService.getSession(buildId);
        const context = await contextPool.getContext(id);

        sendEvent('complete', {
            type: 'complete',
            success: finalSession?.status === 'complete',
            buildId,
            projectId: id,
            status: finalSession?.status,
            intentContract: context?.intentContract ? {
                id: context.intentContract.id,
                locked: context.intentContract.locked,
                satisfied: finalSession?.status === 'complete',
            } : null,
        });

        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        console.error('[KripToeNite] Build mode error:', error);

        if (res.headersSent) {
            res.write(`data: ${JSON.stringify({
                type: 'error',
                content: error instanceof Error ? error.message : 'Unknown error',
            })}\n\n`);
            res.end();
        } else {
            res.status(500).json({
                error: 'Build failed',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
});

/**
 * GET /api/krip-toe-nite/build/:buildId/status
 *
 * Get build status for KTN build mode
 */
router.get('/build/:buildId/status', async (req: Request, res: Response) => {
    const { buildId } = req.params;

    const session = unifiedService.getSession(buildId);
    if (!session) {
        return res.status(404).json({ error: 'Build not found' });
    }

    const context = await contextPool.getContext(session.projectId);

    res.json({
        buildId,
        projectId: session.projectId,
        status: session.status,
        mode: session.mode,
        entryPoint: session.entryPoint,
        intentContract: context?.intentContract ? {
            id: context.intentContract.id,
            appType: context.intentContract.appType,
            locked: context.intentContract.locked,
            criteriaCount: context.intentContract.successCriteria.length,
            criteriaPassed: context.intentContract.successCriteria.filter(c => c.passed).length,
        } : null,
        doneContract: {
            canClaimDone: session.status === 'complete',
            reason: session.status === 'complete'
                ? 'All success criteria satisfied'
                : 'Build not complete - cannot claim done',
        },
    });
});

// =============================================================================
// QUICK GENERATION ENDPOINTS (Original - For Non-Build Use Cases)
// =============================================================================

/**
 * POST /api/krip-toe-nite/generate
 *
 * Quick generation mode - direct model routing without full build pipeline.
 * Streams the response using SSE.
 *
 * Use this for:
 * - Chat responses
 * - Single code snippets
 * - Explanations
 * - Quick fixes (single file)
 *
 * NOTE: For full app building, use /api/krip-toe-nite/build instead.
 */
router.post('/generate', async (req: Request, res: Response) => {
    try {
        const {
            prompt,
            systemPrompt,
            context,
            maxTokens,
            temperature,
            projectId,
            useBuildMode = false, // Opt-in to build mode
        } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // If build mode requested, suggest using the build endpoint
        if (useBuildMode) {
            return res.status(307).json({
                error: 'Use build mode endpoint',
                redirect: '/api/krip-toe-nite/build',
                message: 'For full app building with Intent Lock and verification, please use POST /api/krip-toe-nite/build',
            });
        }

        // Detect if this looks like a build request
        const buildIndicators = [
            'build me', 'create an app', 'make an application',
            'full stack', 'complete app', 'entire application',
            'from scratch', 'build a', 'create a full',
        ];
        const lowerPrompt = prompt.toLowerCase();
        const looksLikeBuild = buildIndicators.some(indicator => lowerPrompt.includes(indicator));

        // Set up SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        // If it looks like a build request, suggest using build mode
        if (looksLikeBuild) {
            res.write(`data: ${JSON.stringify({
                type: 'suggestion',
                content: 'This looks like a build request. For full app generation with Intent Lock and verification, use /api/krip-toe-nite/build endpoint.',
                suggestion: 'build_mode',
            })}\n\n`);
        }

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
 * For simple queries that don't need streaming.
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
 * Now also indicates whether build mode is recommended.
 */
router.post('/analyze', async (req: Request, res: Response) => {
    try {
        const { prompt, context } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const service = getKripToeNiteService();
        const analysis = service.analyzePrompt(prompt, context);

        // Check if this should use build mode
        const buildIndicators = [
            'build me', 'create an app', 'make an application',
            'full stack', 'complete app', 'entire application',
            'from scratch', 'build a', 'create a full',
            'implement', 'develop', 'design and build',
        ];
        const lowerPrompt = prompt.toLowerCase();
        const recommendBuildMode = buildIndicators.some(indicator => lowerPrompt.includes(indicator)) ||
            String(analysis.analysis.complexity) === 'high' ||
            analysis.analysis.isCritical;

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
            recommendation: {
                useBuildMode: recommendBuildMode,
                reason: recommendBuildMode
                    ? 'This prompt appears to be a build request. Build mode provides Intent Lock, verification, and Done Contract enforcement.'
                    : 'Quick generation mode is suitable for this prompt.',
                endpoint: recommendBuildMode ? '/api/krip-toe-nite/build' : '/api/krip-toe-nite/generate',
            },
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
            modes: {
                quick: {
                    endpoint: '/api/krip-toe-nite/generate',
                    description: 'Fast generation for chat, snippets, explanations',
                    features: ['Intelligent model routing', 'Streaming', 'Cost optimization'],
                },
                build: {
                    endpoint: '/api/krip-toe-nite/build',
                    description: 'Full app building with verification pipeline',
                    features: [
                        'Intent Lock (Sacred Contract)',
                        '6-Phase Build Loop',
                        'Verification Swarm',
                        'Done Contract Enforcement',
                        'Enhanced Build Loop (Cursor 2.1+ features)',
                    ],
                },
            },
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

        // Add build mode stats
        const buildSessions = unifiedService.getAllSessions()
            .filter(s => s.entryPoint === 'ktn');

        res.json({
            success: true,
            stats: {
                ...stats,
                buildMode: {
                    totalBuilds: buildSessions.length,
                    completedBuilds: buildSessions.filter(s => s.status === 'complete').length,
                    failedBuilds: buildSessions.filter(s => s.status === 'failed').length,
                    activeBuilds: buildSessions.filter(s => s.status === 'building').length,
                },
            },
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
            version: '2.0.0', // Updated version with build mode
            capabilities: {
                quickGeneration: true,
                buildMode: true,
                intentLock: true,
                verificationSwarm: true,
                doneContract: true,
            },
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
