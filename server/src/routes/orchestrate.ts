/**
 * Orchestration API Routes
 *
 * CRITICAL UPDATE (Dec 18, 2025):
 * This now uses the UnifiedBuildService instead of DevelopmentOrchestrator.
 * ALL builds now go through the full pipeline:
 * 1. Intent Lock (Sacred Contract) - MANDATORY
 * 2. 6-Phase Build Loop
 * 3. Enhanced Build Loop (Cursor 2.1+ services)
 * 4. Shared Context (cross-request memory)
 * 5. Done Contract Enforcement
 *
 * The previous implementation bypassed ALL of this sophisticated architecture.
 */

import { Router, Request, Response } from 'express';
import {
    getUnifiedBuildService,
    type UnifiedBuildRequest,
    type UnifiedBuildEvent,
    type BuildSession,
} from '../services/orchestration/unified-build-service.js';
import { getSharedContextPool } from '../services/orchestration/shared-context-pool.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get the unified build service singleton
const unifiedService = getUnifiedBuildService();
const contextPool = getSharedContextPool();

// Track active build streams for SSE
const activeStreams = new Map<string, AsyncGenerator<UnifiedBuildEvent>>();

/**
 * POST /api/orchestrate/analyze
 *
 * Analyze a project request and create an Intent Lock contract.
 * This now creates a Sacred Contract with immutable success criteria.
 */
router.post('/analyze', async (req: Request, res: Response) => {
    try {
        const {
            prompt,
            projectName,
            projectId,
            constraints,
            mode = 'standard',
            enableEnhanced = true,
        } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Get user from auth (if available)
        const userId = (req as Request & { user?: { id: string } }).user?.id || 'anonymous';
        const id = projectId || uuidv4();

        // Start the unified build with Intent Lock
        const { buildId, session, stream } = await unifiedService.startBuild({
            prompt,
            projectId: id,
            userId,
            projectName: projectName || `Project ${Date.now()}`,
            entryPoint: 'chat_interface',
            mode,
            enableEnhanced,
            constraints,
        });

        // Store the stream for execution
        activeStreams.set(buildId, stream);

        // Get first event (should be intent_created)
        const firstEvent = await stream.next();

        // Get project context (includes Intent Contract)
        const context = await contextPool.getContext(id);

        res.json({
            success: true,
            projectId: id,
            buildId,
            session: {
                id: session.id,
                status: session.status,
                mode: session.mode,
                intentContractId: session.intentContractId,
            },
            intentContract: context?.intentContract ? {
                id: context.intentContract.id,
                appType: context.intentContract.appType,
                appSoul: context.intentContract.appSoul,
                coreValueProp: context.intentContract.coreValueProp,
                successCriteria: context.intentContract.successCriteria.length,
                workflows: context.intentContract.userWorkflows.length,
                locked: context.intentContract.locked,
            } : null,
            firstEvent: firstEvent.value,
            message: 'Intent Lock created and locked. Ready for execution.',
        });

    } catch (error) {
        console.error('Orchestration analysis failed:', error);
        res.status(500).json({
            error: 'Analysis failed',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/orchestrate/:projectId/execute
 *
 * Execute the full 6-phase build loop with SSE streaming.
 * Events include: intent_created, phase_start, phase_complete,
 * feature_building, verification_result, done_check, build_complete
 */
router.post('/:projectId/execute', async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { buildId } = req.body;

    // Get the stream (from analyze) or start a new build
    let stream = activeStreams.get(buildId);

    if (!stream) {
        // No existing stream - must run analyze first
        return res.status(400).json({
            error: 'Build not initialized. Call /analyze first to create Intent Lock.',
        });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (eventType: string, data: unknown) => {
        res.write(`event: ${eventType}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
        // Stream all events from the build
        for await (const event of stream) {
            sendEvent(event.type, {
                ...event.data,
                timestamp: event.timestamp,
                buildId: event.buildId,
            });

            // Check if build is complete
            if (event.type === 'build_complete') {
                break;
            }
        }

        // Cleanup
        activeStreams.delete(buildId);

        // Get final session state
        const session = unifiedService.getSession(buildId);

        sendEvent('complete', {
            success: session?.status === 'complete',
            buildId,
            status: session?.status,
            message: session?.status === 'complete'
                ? 'Build complete - all success criteria satisfied'
                : 'Build incomplete - check done contract blockers',
        });

    } catch (error) {
        sendEvent('error', {
            success: false,
            message: error instanceof Error ? error.message : String(error),
        });
        activeStreams.delete(buildId);
    } finally {
        res.end();
    }
});

/**
 * POST /api/orchestrate/build
 *
 * One-shot build endpoint - combines analyze + execute.
 * Use this for "one prompt, full app" builds.
 */
router.post('/build', async (req: Request, res: Response) => {
    try {
        const {
            prompt,
            projectName,
            projectId,
            mode = 'standard',
            enableEnhanced = true,
        } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const userId = (req as Request & { user?: { id: string } }).user?.id || 'anonymous';
        const id = projectId || uuidv4();

        // Set up SSE immediately
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const sendEvent = (eventType: string, data: unknown) => {
            res.write(`event: ${eventType}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        // Start the unified build
        const { buildId, session, stream } = await unifiedService.startBuild({
            prompt,
            projectId: id,
            userId,
            projectName: projectName || `Project ${Date.now()}`,
            entryPoint: 'chat_interface',
            mode,
            enableEnhanced,
        });

        sendEvent('build_started', {
            buildId,
            projectId: id,
            mode,
            message: 'Build started with Intent Lock enforcement',
        });

        // Stream all events
        for await (const event of stream) {
            sendEvent(event.type, {
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
            success: finalSession?.status === 'complete',
            buildId,
            projectId: id,
            status: finalSession?.status,
            intentContract: context?.intentContract ? {
                id: context.intentContract.id,
                locked: context.intentContract.locked,
                criteriaCount: context.intentContract.successCriteria.length,
            } : null,
        });

    } catch (error) {
        // If headers not sent yet, send JSON error
        if (!res.headersSent) {
            return res.status(500).json({
                error: 'Build failed',
                message: error instanceof Error ? error.message : String(error),
            });
        }

        // Headers sent, send SSE error
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({
            success: false,
            message: error instanceof Error ? error.message : String(error),
        })}\n\n`);
    } finally {
        res.end();
    }
});

/**
 * GET /api/orchestrate/:buildId/status
 *
 * Get current build status including Intent Lock and Done Contract
 */
router.get('/:buildId/status', async (req: Request, res: Response) => {
    const { buildId } = req.params;

    const session = unifiedService.getSession(buildId);
    if (!session) {
        return res.status(404).json({ error: 'Build not found' });
    }

    const context = await contextPool.getContext(session.projectId);

    res.json({
        buildId: session.id,
        projectId: session.projectId,
        status: session.status,
        mode: session.mode,
        entryPoint: session.entryPoint,
        intentContract: context?.intentContract ? {
            id: context.intentContract.id,
            appType: context.intentContract.appType,
            appSoul: context.intentContract.appSoul,
            locked: context.intentContract.locked,
            successCriteria: context.intentContract.successCriteria.map(c => ({
                id: c.id,
                description: c.description,
                passed: c.passed,
            })),
            workflows: context.intentContract.userWorkflows.map(w => ({
                name: w.name,
                verified: w.verified,
            })),
        } : null,
        buildLoop: session.buildLoop ? session.buildLoop.getState() : null,
        enhancedLoop: session.enhancedLoop ? session.enhancedLoop.getCapabilitiesSummary() : null,
        timestamps: {
            created: session.createdAt,
            updated: session.updatedAt,
        },
    });
});

/**
 * GET /api/orchestrate/:buildId/checkpoints
 *
 * Get available checkpoints for rollback
 */
router.get('/:buildId/checkpoints', async (req: Request, res: Response) => {
    const { buildId } = req.params;

    try {
        const checkpoints = await unifiedService.getBuildCheckpoints(buildId);
        res.json({ checkpoints });
    } catch (error) {
        res.status(404).json({
            error: 'Build not found',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/orchestrate/:buildId/rollback
 *
 * Rollback to a previous checkpoint
 */
router.post('/:buildId/rollback', async (req: Request, res: Response) => {
    const { buildId } = req.params;
    const { checkpointId } = req.body;

    if (!checkpointId) {
        return res.status(400).json({ error: 'checkpointId is required' });
    }

    try {
        await unifiedService.rollbackBuild(buildId, checkpointId);
        res.json({
            success: true,
            message: `Rolled back to checkpoint ${checkpointId}`,
        });
    } catch (error) {
        res.status(500).json({
            error: 'Rollback failed',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/orchestrate/:buildId/pause
 *
 * Pause/abort a running build
 */
router.post('/:buildId/pause', async (req: Request, res: Response) => {
    const { buildId } = req.params;

    try {
        await unifiedService.pauseBuild(buildId);
        activeStreams.delete(buildId);

        res.json({
            success: true,
            message: 'Build paused',
        });
    } catch (error) {
        res.status(500).json({
            error: 'Pause failed',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/orchestrate/:projectId/context
 *
 * Get shared context for a project (cross-request memory)
 */
router.get('/:projectId/context', async (req: Request, res: Response) => {
    const { projectId } = req.params;

    const context = await contextPool.getContext(projectId);
    if (!context) {
        return res.status(404).json({ error: 'Context not found' });
    }

    res.json({
        projectId: context.projectId,
        projectName: context.projectName,
        intentContract: context.intentContract ? {
            id: context.intentContract.id,
            appType: context.intentContract.appType,
            locked: context.intentContract.locked,
        } : null,
        buildHistory: context.buildHistory.slice(-10),
        memory: {
            decisionsCount: context.memory.decisions.length,
            patternsCount: context.memory.patterns.length,
            errorHistoryCount: context.memory.errorHistory.length,
            topPatterns: context.memory.patterns.slice(0, 5).map(p => ({
                name: p.name,
                successRate: p.successRate,
                usageCount: p.usageCount,
            })),
        },
        lastBuild: {
            id: context.lastBuildId,
            status: context.lastBuildStatus,
            completedAt: context.lastBuildCompletedAt,
        },
    });
});

/**
 * GET /api/orchestrate/:buildId/stream
 *
 * Real-time event stream for an active build
 */
router.get('/:buildId/stream', (req: Request, res: Response) => {
    const { buildId } = req.params;

    const session = unifiedService.getSession(buildId);
    if (!session) {
        return res.status(404).json({ error: 'Build not found' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (eventType: string, data: unknown) => {
        res.write(`event: ${eventType}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial status
    sendEvent('status', {
        buildId,
        status: session.status,
        mode: session.mode,
        intentContractId: session.intentContractId,
    });

    // Subscribe to build events
    const eventHandler = (event: UnifiedBuildEvent) => {
        if (event.buildId === buildId) {
            sendEvent(event.type, event.data);
        }
    };

    unifiedService.on('build_event', eventHandler);

    // Cleanup on disconnect
    req.on('close', () => {
        unifiedService.off('build_event', eventHandler);
    });
});

/**
 * DELETE /api/orchestrate/:buildId
 *
 * Stop and cleanup a build
 */
router.delete('/:buildId', async (req: Request, res: Response) => {
    const { buildId } = req.params;

    try {
        await unifiedService.pauseBuild(buildId);
        activeStreams.delete(buildId);

        res.json({
            success: true,
            message: 'Build stopped and cleaned up',
        });
    } catch (error) {
        res.status(500).json({
            error: 'Cleanup failed',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/orchestrate/stats
 *
 * Get overall orchestration statistics
 */
router.get('/stats', (_req: Request, res: Response) => {
    const sessions = unifiedService.getAllSessions();
    const contextStats = contextPool.getStats();

    const stats = {
        activeSessions: sessions.filter(s => s.status === 'building').length,
        totalSessions: sessions.length,
        sessionsByStatus: {
            initializing: sessions.filter(s => s.status === 'initializing').length,
            intent_lock: sessions.filter(s => s.status === 'intent_lock').length,
            building: sessions.filter(s => s.status === 'building').length,
            verifying: sessions.filter(s => s.status === 'verifying').length,
            complete: sessions.filter(s => s.status === 'complete').length,
            failed: sessions.filter(s => s.status === 'failed').length,
        },
        sessionsByMode: {
            lightning: sessions.filter(s => s.mode === 'lightning').length,
            standard: sessions.filter(s => s.mode === 'standard').length,
            tournament: sessions.filter(s => s.mode === 'tournament').length,
            production: sessions.filter(s => s.mode === 'production').length,
        },
        sessionsByEntryPoint: {
            chat_interface: sessions.filter(s => s.entryPoint === 'chat_interface').length,
            feature_agent: sessions.filter(s => s.entryPoint === 'feature_agent').length,
            ktn: sessions.filter(s => s.entryPoint === 'ktn').length,
            api: sessions.filter(s => s.entryPoint === 'api').length,
        },
        context: contextStats,
        activeStreams: activeStreams.size,
    };

    res.json(stats);
});

export default router;
