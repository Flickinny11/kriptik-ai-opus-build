/**
 * Preview API Routes
 *
 * Endpoints for headless browser preview functionality:
 * - Start preview session
 * - Stream preview events via SSE
 * - AI demonstration mode
 * - User takeover
 * - Accept feature
 */

import { Router, type Request, type Response } from 'express';
import { previewService, type PreviewEvent } from '../services/preview/headless-preview-service.js';

const router = Router();

/**
 * GET /api/preview/:agentId/start
 * Start a new preview session for a feature agent
 */
router.get('/:agentId/start', async (req: Request, res: Response) => {
    try {
        const { agentId } = req.params;
        const { sandboxUrl } = req.query;

        if (!sandboxUrl || typeof sandboxUrl !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'sandboxUrl query parameter is required',
            });
        }

        const session = await previewService.startPreview(agentId, sandboxUrl);

        res.json({
            success: true,
            session: {
                id: session.id,
                featureAgentId: session.featureAgentId,
                sandboxUrl: session.sandboxUrl,
                status: session.status,
                createdAt: session.createdAt.toISOString(),
            },
        });
    } catch (error) {
        console.error('Error starting preview:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to start preview session',
        });
    }
});

/**
 * GET /api/preview/:sessionId/stream
 * SSE stream for preview events
 */
router.get('/:sessionId/stream', async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const session = previewService.getSession(sessionId);
    if (!session) {
        return res.status(404).json({
            success: false,
            error: 'Session not found',
        });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send initial status
    res.write(`data: ${JSON.stringify({
        type: 'status_change',
        status: session.status,
        timestamp: Date.now(),
    })}\n\n`);

    // Handle client disconnect
    const abortController = new AbortController();
    req.on('close', () => {
        abortController.abort();
    });

    try {
        for await (const event of previewService.streamPreviewEvents(sessionId)) {
            if (abortController.signal.aborted) break;
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
    } catch (error) {
        if (!abortController.signal.aborted) {
            console.error('Error streaming preview events:', error);
        }
    }

    res.end();
});

/**
 * POST /api/preview/:sessionId/ai-demo
 * Start AI demonstration of the feature
 */
router.post('/:sessionId/ai-demo', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const { actions } = req.body;

        await previewService.startAIDemo(sessionId, actions);

        res.json({
            success: true,
            message: 'AI demo started',
        });
    } catch (error) {
        console.error('Error starting AI demo:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to start AI demo',
        });
    }
});

/**
 * POST /api/preview/:sessionId/takeover
 * User takes control of the browser
 */
router.post('/:sessionId/takeover', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;

        await previewService.userTakeover(sessionId);

        res.json({
            success: true,
            message: 'User takeover initiated',
        });
    } catch (error) {
        console.error('Error during takeover:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to takeover browser control',
        });
    }
});

/**
 * POST /api/preview/:sessionId/accept
 * User accepts the feature (triggers merge flow)
 */
router.post('/:sessionId/accept', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;

        const session = previewService.getSession(sessionId);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found',
            });
        }

        // End the preview session
        await previewService.endPreview(sessionId);

        // Return acceptance info - actual merge handled by feature agent
        res.json({
            success: true,
            accepted: true,
            featureAgentId: session.featureAgentId,
            message: 'Feature accepted. Merge will be triggered.',
        });
    } catch (error) {
        console.error('Error accepting feature:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to accept feature',
        });
    }
});

/**
 * GET /api/preview/:sessionId/screenshot
 * Capture current screenshot
 */
router.get('/:sessionId/screenshot', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;

        const screenshot = await previewService.captureScreenshot(sessionId);

        res.json({
            success: true,
            screenshot,
        });
    } catch (error) {
        console.error('Error capturing screenshot:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to capture screenshot',
        });
    }
});

/**
 * POST /api/preview/:sessionId/end
 * End preview session
 */
router.post('/:sessionId/end', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;

        await previewService.endPreview(sessionId);

        res.json({
            success: true,
            message: 'Preview session ended',
        });
    } catch (error) {
        console.error('Error ending preview:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to end preview session',
        });
    }
});

export default router;
