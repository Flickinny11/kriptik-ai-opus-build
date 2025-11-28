/**
 * Fix My App API Routes
 * 
 * Endpoints for the "Fix My App" feature - importing and fixing
 * broken apps from other AI builders.
 */

import { Router, Request, Response } from 'express';
import { createImportController, ImportController } from '../services/fix-my-app/index.js';

const router = Router();

// Store active controllers for SSE streaming
const controllers = new Map<string, ImportController>();

/**
 * POST /api/fix-my-app/init
 * Initialize a new fix session
 */
router.post('/init', async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { source, sourceUrl, previewUrl } = req.body;

        if (!source) {
            return res.status(400).json({ error: 'Source is required' });
        }

        const controller = createImportController(userId);
        const result = await controller.initSession(source, sourceUrl, previewUrl);

        controllers.set(result.sessionId, controller);

        res.json(result);
    } catch (error) {
        console.error('Fix My App init error:', error);
        res.status(500).json({ error: 'Failed to initialize session' });
    }
});

/**
 * POST /api/fix-my-app/:sessionId/consent
 * Record user consent for data retrieval
 */
router.post('/:sessionId/consent', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const controller = controllers.get(sessionId);

        if (!controller) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const { chatHistory, buildLogs, errorLogs, versionHistory } = req.body;

        controller.setConsent({
            chatHistory: chatHistory ?? false,
            buildLogs: buildLogs ?? false,
            errorLogs: errorLogs ?? false,
            versionHistory: versionHistory ?? false,
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Consent error:', error);
        res.status(500).json({ error: 'Failed to record consent' });
    }
});

/**
 * POST /api/fix-my-app/:sessionId/upload
 * Upload project files
 */
router.post('/:sessionId/upload', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const controller = controllers.get(sessionId);

        if (!controller) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const { files, githubUrl } = req.body;

        if (githubUrl) {
            await controller.importFromGitHub(githubUrl);
        } else if (files && Array.isArray(files)) {
            await controller.importFiles(files);
        } else {
            return res.status(400).json({ error: 'Files or GitHub URL required' });
        }

        const session = controller.getSession();
        res.json({
            success: true,
            filesReceived: files?.length || 0,
            projectId: session.projectId,
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload files' });
    }
});

/**
 * POST /api/fix-my-app/:sessionId/context
 * Submit chat history and other context
 */
router.post('/:sessionId/context', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const controller = controllers.get(sessionId);

        if (!controller) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const { chatHistory, buildLogs, errorLogs } = req.body;

        if (chatHistory) {
            await controller.submitChatHistory(chatHistory);
        }

        res.json({ success: true, processing: true });
    } catch (error) {
        console.error('Context submit error:', error);
        res.status(500).json({ error: 'Failed to submit context' });
    }
});

/**
 * POST /api/fix-my-app/:sessionId/analyze
 * Run analysis on the imported project
 */
router.post('/:sessionId/analyze', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const controller = controllers.get(sessionId);

        if (!controller) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const analysis = await controller.runAnalysis();

        res.json({
            success: true,
            ...analysis,
        });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: 'Failed to run analysis' });
    }
});

/**
 * GET /api/fix-my-app/:sessionId/analysis
 * Get cached analysis results
 */
router.get('/:sessionId/analysis', (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const session = ImportController.getSession(sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.json({
            intentSummary: session.context.processed.intentSummary,
            errorTimeline: session.context.processed.errorTimeline,
            implementationGaps: session.context.processed.implementationGaps,
            recommendedStrategy: session.selectedStrategy,
            status: session.status,
        });
    } catch (error) {
        console.error('Get analysis error:', error);
        res.status(500).json({ error: 'Failed to get analysis' });
    }
});

/**
 * POST /api/fix-my-app/:sessionId/fix
 * Start the fix process
 */
router.post('/:sessionId/fix', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const controller = controllers.get(sessionId);

        if (!controller) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const { strategy } = req.body;

        // Start fix in background, response will come via SSE
        controller.executeFix(strategy).catch(error => {
            console.error('Fix execution error:', error);
        });

        res.json({ success: true, message: 'Fix started' });
    } catch (error) {
        console.error('Fix start error:', error);
        res.status(500).json({ error: 'Failed to start fix' });
    }
});

/**
 * GET /api/fix-my-app/:sessionId/stream
 * SSE stream for real-time fix progress
 */
router.get('/:sessionId/stream', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const controller = controllers.get(sessionId);

    if (!controller) {
        return res.status(404).json({ error: 'Session not found' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendEvent = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Listen for events
    const onProgress = (event: any) => sendEvent('progress', event);
    const onFile = (event: any) => sendEvent('file', event);
    const onLog = (message: string) => sendEvent('log', { message });
    const onComplete = (data: any) => {
        sendEvent('complete', data);
        cleanup();
    };
    const onError = (error: Error) => {
        sendEvent('error', { message: error.message });
        cleanup();
    };

    controller.on('progress', onProgress);
    controller.on('file', onFile);
    controller.on('log', onLog);
    controller.on('complete', onComplete);
    controller.on('error', onError);

    // Send initial state
    const session = controller.getSession();
    sendEvent('init', {
        sessionId,
        status: session.status,
        progress: session.progress,
        currentStep: session.currentStep,
    });

    // Cleanup on disconnect
    const cleanup = () => {
        controller.off('progress', onProgress);
        controller.off('file', onFile);
        controller.off('log', onLog);
        controller.off('complete', onComplete);
        controller.off('error', onError);
    };

    req.on('close', cleanup);
});

/**
 * GET /api/fix-my-app/:sessionId/status
 * Get current session status
 */
router.get('/:sessionId/status', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const session = ImportController.getSession(sessionId);

    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
        status: session.status,
        progress: session.progress,
        currentStep: session.currentStep,
        projectId: session.projectId,
        logs: session.logs.slice(-20), // Last 20 logs
        verificationReport: session.verificationReport,
    });
});

/**
 * GET /api/fix-my-app/:sessionId/verification
 * Get verification report
 */
router.get('/:sessionId/verification', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const session = ImportController.getSession(sessionId);

    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.verificationReport) {
        return res.status(400).json({ error: 'Verification not complete' });
    }

    res.json(session.verificationReport);
});

/**
 * DELETE /api/fix-my-app/:sessionId
 * Delete a session
 */
router.delete('/:sessionId', (req: Request, res: Response) => {
    const { sessionId } = req.params;

    controllers.delete(sessionId);
    ImportController.deleteSession(sessionId);

    res.json({ success: true });
});

export default router;

