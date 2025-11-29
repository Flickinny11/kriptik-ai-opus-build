/**
 * Fix My App API Routes
 *
 * Endpoints for the "Fix My App" feature - importing and fixing
 * broken apps from other AI builders.
 */

import { Router, Request, Response } from 'express';
import {
    createImportController,
    ImportController,
    SOURCE_REGISTRY,
    getSourcesByCategory,
    createBrowserExtractor,
    createContextStore,
    BrowserExtractorService,
} from '../services/fix-my-app/index.js';

const router = Router();

/**
 * GET /api/fix-my-app/sources
 * Get all supported import sources and their metadata
 */
router.get('/sources', (req: Request, res: Response) => {
    res.json({
        sources: SOURCE_REGISTRY,
        byCategory: getSourcesByCategory(),
    });
});

// Store active controllers for SSE streaming
const controllers = new Map<string, ImportController>();
const browserSessions = new Map<string, BrowserExtractorService>();

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
 * Upload project files or import from URL
 */
router.post('/:sessionId/upload', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const controller = controllers.get(sessionId);

        if (!controller) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const { files, githubUrl, sourceUrl } = req.body;
        const session = controller.getSession();

        // Handle different sources
        const source = session.source;
        const url = sourceUrl || githubUrl || session.sourceUrl;

        // Repository sources - import from URL
        if (['github', 'gitlab', 'bitbucket'].includes(source) && url) {
            await controller.importFromRepository(url);
        }
        // Dev platform sources - import from URL
        else if (source === 'codesandbox' && url) {
            await controller.importFromCodeSandbox(url);
        }
        else if (source === 'stackblitz' && url) {
            await controller.importFromStackBlitz(url);
        }
        else if (source === 'replit' && url) {
            await controller.importFromReplit(url);
        }
        // AI builder URLs - try URL import then fallback to files
        else if (['v0', 'create', 'tempo', 'gptengineer', 'databutton'].includes(source) && url) {
            // For AI builders, we typically need manual file upload
            // The URL is just for reference
            if (files && Array.isArray(files)) {
                await controller.importFiles(files);
            } else {
                return res.status(400).json({
                    error: 'For AI builders, please upload your project files. URL is for reference only.',
                });
            }
        }
        // Direct file upload
        else if (files && Array.isArray(files)) {
            await controller.importFiles(files);
        }
        // Legacy GitHub URL support
        else if (githubUrl) {
            await controller.importFromGitHub(githubUrl);
        }
        else {
            return res.status(400).json({ error: 'Files or source URL required' });
        }

        const updatedSession = controller.getSession();
        res.json({
            success: true,
            filesReceived: files?.length || 0,
            projectId: updatedSession.projectId,
            source: source,
        });
    } catch (error: any) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message || 'Failed to upload files' });
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
 * POST /api/fix-my-app/:sessionId/preferences
 * Set user preferences for the fix (UI preservation, etc.)
 */
router.post('/:sessionId/preferences', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const controller = controllers.get(sessionId);

        if (!controller) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const { uiPreference, priorityFeatures, skipFeatures, additionalInstructions } = req.body;

        if (!uiPreference || !['keep_ui', 'improve_ui', 'rebuild_ui'].includes(uiPreference)) {
            return res.status(400).json({
                error: 'Valid uiPreference required: keep_ui, improve_ui, or rebuild_ui'
            });
        }

        controller.setPreferences({
            uiPreference,
            priorityFeatures,
            skipFeatures,
            additionalInstructions,
        });

        res.json({
            success: true,
            message: `UI preference set to: ${uiPreference}`
        });
    } catch (error) {
        console.error('Preferences error:', error);
        res.status(500).json({ error: 'Failed to set preferences' });
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

        const { strategy, preferences } = req.body;

        // Start fix in background, response will come via SSE
        controller.executeFix(strategy, preferences).catch(error => {
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

    // Clean up browser session if exists
    const browserSession = browserSessions.get(sessionId);
    if (browserSession) {
        browserSession.close().catch(() => {});
        browserSessions.delete(sessionId);
    }

    res.json({ success: true });
});

// =============================================================================
// BROWSER AUTOMATION ROUTES
// =============================================================================

/**
 * POST /api/fix-my-app/:sessionId/browser/start
 * Start embedded browser for user login
 */
router.post('/:sessionId/browser/start', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { source } = req.body;
        const controller = controllers.get(sessionId);
        if (!controller) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Create browser extractor
        const browserExtractor = createBrowserExtractor({
            source: source || controller.getSession().source,
            sessionId,
            userId,
            projectUrl: controller.getSession().sourceUrl,
        });

        browserSessions.set(sessionId, browserExtractor);

        // Start the browser
        const { wsEndpoint, viewUrl } = await browserExtractor.startBrowser();

        res.json({ wsEndpoint, viewUrl });
    } catch (error) {
        console.error('Browser start error:', error);
        res.status(500).json({ error: 'Failed to start browser' });
    }
});

/**
 * POST /api/fix-my-app/:sessionId/browser/confirm-login
 * Confirm user has logged in
 */
router.post('/:sessionId/browser/confirm-login', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const browserSession = browserSessions.get(sessionId);

        if (!browserSession) {
            return res.status(404).json({ error: 'Browser session not found' });
        }

        const success = await browserSession.waitForLogin(30000); // 30 second timeout

        res.json({ success });
    } catch (error) {
        console.error('Login confirmation error:', error);
        res.status(500).json({ error: 'Failed to confirm login' });
    }
});

/**
 * POST /api/fix-my-app/:sessionId/browser/navigate
 * Navigate to a specific project URL
 */
router.post('/:sessionId/browser/navigate', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const { projectUrl } = req.body;
        const browserSession = browserSessions.get(sessionId);

        if (!browserSession) {
            return res.status(404).json({ error: 'Browser session not found' });
        }

        const success = await browserSession.navigateToProject(projectUrl);

        res.json({ success });
    } catch (error) {
        console.error('Navigation error:', error);
        res.status(500).json({ error: 'Failed to navigate' });
    }
});

/**
 * POST /api/fix-my-app/:sessionId/browser/extract
 * Start automatic extraction
 */
router.post('/:sessionId/browser/extract', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const browserSession = browserSessions.get(sessionId);
        const controller = controllers.get(sessionId);

        if (!browserSession || !controller) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Start extraction in background
        browserSession.extractAll()
            .then(async (extractedData) => {
                // Ingest extracted data into the import controller
                if (extractedData.chatHistory.length > 0) {
                    await controller.submitChatHistory(
                        extractedData.chatHistory.map(m => `[${m.role}]: ${m.content}`).join('\n\n')
                    );
                }

                // Import extracted files
                if (extractedData.files.size > 0) {
                    const filesArray = Array.from(extractedData.files.entries()).map(([path, content]) => ({
                        path,
                        content,
                    }));
                    await controller.importFiles(filesArray);
                }

                // Close browser
                await browserSession.close();
                browserSessions.delete(sessionId);
            })
            .catch((error) => {
                console.error('Extraction error:', error);
            });

        res.json({ success: true, message: 'Extraction started' });
    } catch (error) {
        console.error('Extract start error:', error);
        res.status(500).json({ error: 'Failed to start extraction' });
    }
});

/**
 * GET /api/fix-my-app/:sessionId/browser/screenshot
 * Get current browser screenshot
 */
router.get('/:sessionId/browser/screenshot', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const browserSession = browserSessions.get(sessionId);

        if (!browserSession) {
            return res.status(404).json({ error: 'Browser session not found' });
        }

        const screenshot = await browserSession.screenshot();

        res.json({ screenshot });
    } catch (error) {
        console.error('Screenshot error:', error);
        res.status(500).json({ error: 'Failed to capture screenshot' });
    }
});

/**
 * GET /api/fix-my-app/:sessionId/browser/stream
 * SSE stream for browser progress
 */
router.get('/:sessionId/browser/stream', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const browserSession = browserSessions.get(sessionId);

    if (!browserSession) {
        return res.status(404).json({ error: 'Browser session not found' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Listen for events
    const onProgress = (event: any) => sendEvent('progress', event);
    const onScreenshot = (screenshot: string) => sendEvent('screenshot', { screenshot });

    browserSession.on('progress', onProgress);
    browserSession.on('screenshot', onScreenshot);

    // Send initial state
    sendEvent('init', { sessionId, status: 'connected' });

    // Cleanup on disconnect
    req.on('close', () => {
        browserSession.off('progress', onProgress);
        browserSession.off('screenshot', onScreenshot);
    });
});

export default router;

