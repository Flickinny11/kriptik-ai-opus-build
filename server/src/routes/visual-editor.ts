/**
 * Visual Editor API Routes
 *
 * Endpoints for the AI Element Redesign feature:
 * - POST /api/visual-editor/redesign - Start a redesign session
 * - GET /api/visual-editor/progress - SSE stream for progress updates
 * - POST /api/visual-editor/apply - Apply the generated code
 * - POST /api/visual-editor/retry - Retry generation with feedback
 */

import { Router, Request, Response } from 'express';
import { getVisualEditorService } from '../services/visual-editor/visual-editor-service.js';

const router = Router();

// Store active SSE connections
const progressConnections = new Map<string, Response>();

/**
 * POST /api/visual-editor/redesign
 * Start a redesign session
 */
router.post('/redesign', async (req: Request, res: Response) => {
    try {
        const { projectId, userId, element, prompt, currentScreenshot } = req.body;

        if (!projectId || !userId || !element || !prompt) {
            return res.status(400).json({
                error: 'Missing required fields: projectId, userId, element, prompt',
            });
        }

        const service = getVisualEditorService();

        // Set up progress listener for this request
        const progressHandler = (progress: {
            sessionId: string;
            phase: string;
            progress: number;
            message: string;
        }) => {
            const connection = progressConnections.get(projectId);
            if (connection) {
                connection.write(`data: ${JSON.stringify(progress)}\n\n`);
            }
        };

        service.on('progress', progressHandler);

        try {
            const result = await service.startRedesign({
                projectId,
                userId,
                element,
                prompt,
                currentScreenshot,
            });

            res.json(result);
        } finally {
            service.off('progress', progressHandler);
        }
    } catch (error) {
        console.error('[VisualEditor] Redesign error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to process redesign',
        });
    }
});

/**
 * GET /api/visual-editor/progress
 * SSE stream for progress updates
 */
router.get('/progress', (req: Request, res: Response) => {
    const projectId = req.query.projectId as string;

    if (!projectId) {
        return res.status(400).json({ error: 'Missing projectId parameter' });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Store connection
    progressConnections.set(projectId, res);

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ connected: true })}\n\n`);

    // Keep connection alive
    const keepAlive = setInterval(() => {
        res.write(`: keep-alive\n\n`);
    }, 30000);

    // Clean up on close
    req.on('close', () => {
        clearInterval(keepAlive);
        progressConnections.delete(projectId);
    });
});

/**
 * POST /api/visual-editor/apply
 * Apply the generated code to the project
 */
router.post('/apply', async (req: Request, res: Response) => {
    try {
        const { projectId, sessionId, code, element } = req.body;

        if (!projectId || !sessionId || !code) {
            return res.status(400).json({
                error: 'Missing required fields: projectId, sessionId, code',
            });
        }

        // Apply the code changes
        // Integration with file system or code editor would go here
        // For now, return success with the code to be applied

        res.json({
            success: true,
            message: 'Code ready to apply',
            code: {
                component: code.component,
                styles: code.styles,
                dependencies: code.dependencies,
            },
            targetFile: element?.sourceFile,
            targetLine: element?.sourceLine,
        });
    } catch (error) {
        console.error('[VisualEditor] Apply error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to apply changes',
        });
    }
});

/**
 * POST /api/visual-editor/retry
 * Retry generation with additional feedback
 */
router.post('/retry', async (req: Request, res: Response) => {
    try {
        const { sessionId, feedback } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                error: 'Missing sessionId',
            });
        }

        const service = getVisualEditorService();
        const result = await service.retryGeneration(sessionId, feedback);

        res.json(result);
    } catch (error) {
        console.error('[VisualEditor] Retry error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to retry generation',
        });
    }
});

/**
 * GET /api/visual-editor/sessions
 * Get active sessions
 */
router.get('/sessions', (_req: Request, res: Response) => {
    try {
        const service = getVisualEditorService();
        const sessions = service.getActiveSessions();
        res.json({ sessions });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get sessions',
        });
    }
});

/**
 * DELETE /api/visual-editor/sessions/:sessionId
 * Cancel a session
 */
router.delete('/sessions/:sessionId', (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const service = getVisualEditorService();
        const cancelled = service.cancelSession(sessionId);

        if (cancelled) {
            res.json({ success: true, message: 'Session cancelled' });
        } else {
            res.status(404).json({ error: 'Session not found' });
        }
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to cancel session',
        });
    }
});

export default router;
