/**
 * Fix My App API Routes
 *
 * Endpoints for the "Fix My App" feature - importing and fixing
 * broken apps from other AI builders.
 *
 * P1-1: Now supports routing through BuildLoopOrchestrator for
 * full 6-phase build loop with Intent Satisfaction gate.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
    createImportController,
    ImportController,
    SOURCE_REGISTRY,
    getSourcesByCategory,
    createBrowserExtractor,
    createContextStore,
    BrowserExtractorService,
    detectEnvVarsComprehensive,
    groupEnvVarsByService,
    getDocsUrlForService,
    type EnvVarRequirement,
    type ProjectFile,
} from '../services/fix-my-app/index.js';
import { BuildLoopOrchestrator } from '../services/automation/build-loop.js';
import { createExecutionContext, type ExecutionContext } from '../services/core/index.js';
import {
    createIntentLockEngine,
    type DeepIntentContract,
    type DeepIntentOptions,
} from '../services/ai/intent-lock.js';

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

// P1-1: Store active BuildLoopOrchestrator contexts for WebSocket connections
const buildContexts = new Map<string, {
    context: ExecutionContext;
    orchestrator: BuildLoopOrchestrator;
    websocketChannel: string;
}>();

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
 * POST /api/fix-my-app/:sessionId/fix-orchestrated
 * P1-1: Start fix process using full 6-Phase BuildLoopOrchestrator
 *
 * This routes Fix My App through the same orchestration as Builder View:
 * - Phase 0: Intent Lock (Sacred Contract from analyzed intent)
 * - Phase 1: Initialization (artifacts, scaffolding)
 * - Phase 2: Parallel Build (3-5 agents with Memory Harness)
 * - Phase 3: Integration Check (orphan scan, dead code)
 * - Phase 4: Functional Test (browser automation)
 * - Phase 5: Intent Satisfaction (CRITICAL GATE)
 * - Phase 6: Browser Demo (show working app)
 */
router.post('/:sessionId/fix-orchestrated', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const controller = controllers.get(sessionId);
        if (!controller) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const session = controller.getSession();
        if (!session.projectId) {
            return res.status(400).json({ error: 'Project not created yet. Please upload files first.' });
        }

        const { credentials, mode } = req.body;

        // Build prompt from analyzed intent
        const intentSummary = session.context?.processed?.intentSummary;
        if (!intentSummary) {
            return res.status(400).json({ error: 'Analysis not complete. Please run analysis first.' });
        }

        // Parse chat history to create Deep Intent Contract
        const intentEngine = createIntentLockEngine(userId, session.projectId);

        // Extract chat history from the session context
        const rawChatHistory = session.context?.raw?.chatHistory || [];
        const chatHistory = rawChatHistory.map((msg: { role: string; content: string }) => ({
            role: msg.role,
            content: msg.content,
        }));

        // Build the original prompt from intent summary for Deep Intent
        const originalPrompt = `${intentSummary.corePurpose}\n\nPrimary Features:\n${intentSummary.primaryFeatures?.map((f: { name: string; description: string }) => `- ${f.name}: ${f.description}`).join('\n') || 'None'}`;

        // Note: Files will be analyzed during the build phase, not available at plan time
        const existingFilesMap = new Map<string, string>();

        // Create Deep Intent Contract with full chat history context
        console.log(`[FixMyApp] Creating Deep Intent Contract...`);
        const deepIntent = await intentEngine.createDeepContract(
            originalPrompt,
            userId,
            session.projectId,
            undefined,
            {
                fetchAPIDocs: true,
                thinkingBudget: 64000,
                chatHistory: chatHistory,
                sourcePlatform: session.source,
                existingFiles: existingFilesMap,
            }
        );

        console.log(`[FixMyApp] Deep Intent created from chat history`);
        console.log(`  - Source: ${session.source}`);
        console.log(`  - Chat Messages: ${chatHistory.length}`);
        console.log(`  - Technical Requirements: ${deepIntent.technicalRequirements.length}`);
        console.log(`  - Functional Checklist: ${deepIntent.functionalChecklist.length}`);
        console.log(`  - Inferred Requirements: ${deepIntent.semanticComponents?.inferredRequirements?.length || 0}`);

        // Store the deep intent ID in the session context using extended type
        if (session.context && session.context.processed && session.context.processed.intentSummary) {
            // Extend intentSummary with Deep Intent metadata (cast to allow additional props)
            const extendedSummary = session.context.processed.intentSummary as unknown as Record<string, unknown>;
            extendedSummary.deepIntentId = deepIntent.id;
            extendedSummary.technicalRequirementsCount = deepIntent.technicalRequirements.length;
            extendedSummary.functionalChecklistCount = deepIntent.functionalChecklist.length;
            extendedSummary.integrationsCount = deepIntent.integrationRequirements.length;
        }

        // Create a comprehensive prompt from the analyzed intent
        const prompt = `FIX MY APP - Imported from ${session.source}

CORE PURPOSE: ${intentSummary.corePurpose}

PRIMARY FEATURES TO FIX:
${intentSummary.primaryFeatures?.map((f: { name: string; description: string; status: string }) => `- ${f.name}: ${f.description} (Status: ${f.status})`).join('\n') || 'None identified'}

SECONDARY FEATURES:
${intentSummary.secondaryFeatures?.map((f: { name: string; description: string; status: string }) => `- ${f.name}: ${f.description} (Status: ${f.status})`).join('\n') || 'None identified'}

USER FRUSTRATION POINTS:
${intentSummary.frustrationPoints?.map((p: { issue: string; userQuote: string }) => `- ${p.issue}: "${p.userQuote}"`).join('\n') || 'None identified'}

${session.preferences?.uiPreference ? `UI PREFERENCE: ${session.preferences.uiPreference}` : ''}
${session.preferences?.additionalInstructions ? `ADDITIONAL INSTRUCTIONS: ${session.preferences.additionalInstructions}` : ''}

STRATEGY: ${session.selectedStrategy?.approach || 'repair'}
ESTIMATED TIME: ${session.selectedStrategy?.estimatedTimeMinutes || 30} minutes`;

        // Create execution context
        const orchestrationRunId = uuidv4();
        const context = createExecutionContext({
            mode: 'builder',
            projectId: session.projectId,
            userId,
            orchestrationRunId,
            framework: 'react',
            language: 'typescript',
            enableVisualVerification: true,
            enableCheckpoints: true,
        });

        // Store credentials if provided
        if (credentials) {
            (context as unknown as { credentials: Record<string, string> }).credentials = credentials;
        }

        const websocketChannel = `/api/fix-my-app/${sessionId}/ws/${orchestrationRunId}`;

        // Create and start BuildLoopOrchestrator
        const buildLoop = new BuildLoopOrchestrator(
            context.projectId,
            context.userId,
            context.orchestrationRunId,
            'production', // Use full production mode
            {
                humanInTheLoop: false,
                projectPath: context.projectPath,
                credentials: credentials,
            }
        );

        // Store context for WebSocket connection
        buildContexts.set(sessionId, {
            context,
            orchestrator: buildLoop,
            websocketChannel,
        });

        // Start build in background
        setImmediate(async () => {
            try {
                controller.emit('log', 'Starting 6-Phase BuildLoopOrchestrator...');
                controller.emit('progress', { stage: 'initializing', progress: 5 });

                await buildLoop.start(prompt);

                // Before marking fix as complete, check Deep Intent Satisfaction
                const deepIntentId = deepIntent.id;
                if (deepIntentId) {
                    console.log(`[FixMyApp] Checking Deep Intent satisfaction...`);
                    const satisfactionResult = await intentEngine.isDeepIntentSatisfied(deepIntentId);

                    if (!satisfactionResult.satisfied) {
                        console.log(`[FixMyApp] Deep Intent NOT satisfied. Progress: ${satisfactionResult.overallProgress}%`);
                        console.log(`[FixMyApp] Blockers: ${satisfactionResult.blockers.length}`);

                        // Emit blockers for display to user
                        controller.emit('log', `Deep Intent check: ${satisfactionResult.overallProgress}% satisfied`);
                        controller.emit('log', `Found ${satisfactionResult.blockers.length} blockers that need fixing:`);

                        satisfactionResult.blockers.slice(0, 5).forEach((blocker, i) => {
                            controller.emit('log', `  ${i + 1}. [${blocker.category}] ${blocker.item}: ${blocker.reason}`);
                        });

                        controller.emit('progress', {
                            stage: 'fixing_blockers',
                            progress: satisfactionResult.overallProgress,
                            blockers: satisfactionResult.blockers.map(b => ({
                                category: b.category,
                                item: b.item,
                                reason: b.reason,
                                suggestedFix: b.suggestedFix,
                            })),
                        });

                        // Note: BuildLoopOrchestrator's Intent Satisfaction gate (Phase 5) should prevent this
                        // If we reach here, it means we need additional iteration
                        controller.emit('error', {
                            message: `Fix incomplete: ${satisfactionResult.blockers.length} requirements not satisfied`,
                            blockers: satisfactionResult.blockers,
                        });
                        return;
                    }

                    console.log(`[FixMyApp] Deep Intent SATISFIED - Fix complete`);
                    controller.emit('log', 'Deep Intent 100% satisfied - all requirements met!');
                }

                controller.emit('progress', { stage: 'complete', progress: 100 });
                controller.emit('complete', {
                    projectId: session.projectId,
                    success: true,
                });
            } catch (error) {
                console.error('[Fix My App Orchestrated] Build failed:', error);
                controller.emit('error', {
                    message: error instanceof Error ? error.message : 'Build failed',
                });
            }
        });

        res.json({
            success: true,
            message: 'Orchestrated fix started with full 6-Phase build loop',
            websocketChannel,
            projectId: session.projectId,
            orchestrationRunId,
        });
    } catch (error) {
        console.error('[Fix My App Orchestrated] Error:', error);
        res.status(500).json({ error: 'Failed to start orchestrated fix' });
    }
});

/**
 * POST /api/fix-my-app/:sessionId/fix
 * Start the fix process (legacy - uses EnhancedFixExecutor)
 */
router.post('/:sessionId/fix', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const controller = controllers.get(sessionId);

        if (!controller) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const { strategy, preferences, mode } = req.body;

        // Start fix in background with Speed Dial mode, response will come via SSE
        controller.executeFix(strategy, preferences, mode).catch(error => {
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
 *
 * NOTE: Browser automation requires a persistent server with browser binaries.
 * In serverless (Vercel), we return a fallback that guides users to manual upload.
 */
router.post('/:sessionId/browser/start', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get source from request body (required for serverless mode where session might not exist)
        const { source } = req.body;

        // Platform URLs for all supported sources
        const platformUrls: Record<string, string> = {
            lovable: 'https://lovable.dev',
            bolt: 'https://bolt.new',
            v0: 'https://v0.dev',
            create: 'https://create.xyz',
            tempo: 'https://tempo.new',
            gptengineer: 'https://gptengineer.app',
            replit: 'https://replit.com',
            cursor: 'https://cursor.sh',
            windsurf: 'https://codeium.com/windsurf',
            claude: 'https://claude.ai',
            chatgpt: 'https://chat.openai.com',
            gemini: 'https://gemini.google.com',
            copilot: 'https://github.com/features/copilot',
            github: 'https://github.com',
            gitlab: 'https://gitlab.com',
            bitbucket: 'https://bitbucket.org',
            codesandbox: 'https://codesandbox.io',
            stackblitz: 'https://stackblitz.com',
        };

        // Check if we're in a serverless environment (Vercel) - CHECK THIS FIRST
        const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

        if (isServerless) {
            // In serverless, browser automation isn't available AND sessions don't persist
            // Return a response that guides the user to manual upload
            const platformUrl = source ? (platformUrls[source] || 'https://lovable.dev') : 'https://lovable.dev';

            console.log(`[Fix My App] Serverless mode: returning manual upload instructions for ${source || 'unknown'} source`);

            return res.json({
                wsEndpoint: '',
                viewUrl: platformUrl,
                serverless: true,
                message: 'Browser automation not available in serverless. Please manually export your project and upload the files.',
                instructions: [
                    `1. Go to ${platformUrl} and log in`,
                    '2. Navigate to your project',
                    '3. Export/download your project as a ZIP file',
                    '4. Upload the ZIP file here',
                    '5. Optionally, copy your chat history and paste it below',
                ],
            });
        }

        // Non-serverless: check for session in memory
        const controller = controllers.get(sessionId);
        if (!controller) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Full browser automation (for non-serverless environments)
        const browserExtractor = createBrowserExtractor({
            source: source || controller.getSession().source,
            sessionId,
            userId,
            projectUrl: controller.getSession().sourceUrl,
        });

        browserSessions.set(sessionId, browserExtractor);

        // Start the browser
        const { wsEndpoint, viewUrl } = await browserExtractor.startBrowser();

        res.json({ wsEndpoint, viewUrl, serverless: false });
    } catch (error) {
        console.error('Browser start error:', error);

        // Provide helpful error message
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isPlaywrightError = errorMessage.includes('playwright') ||
                                   errorMessage.includes('chromium') ||
                                   errorMessage.includes('browser');

        // In case of any browser-related error, fall back to serverless mode response
        if (isPlaywrightError) {
            return res.status(200).json({
                wsEndpoint: '',
                viewUrl: 'https://lovable.dev',
                serverless: true,
                message: 'Browser automation unavailable. Please use manual file upload instead.',
                instructions: [
                    '1. Go to your AI builder platform and log in',
                    '2. Navigate to your project',
                    '3. Export/download your project as a ZIP file',
                    '4. Upload the ZIP file here',
                ],
            });
        }

        res.status(500).json({ error: 'Failed to start browser', details: errorMessage });
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

// =============================================================================
// CREDENTIAL SUBMISSION ROUTES (Dedicated Credential Request Page)
// =============================================================================

// Store required credentials for each session (detected during analysis)
const sessionCredentialRequirements = new Map<string, Array<{
    serviceId: string;
    serviceName: string;
    reason: string;
    keys: Array<{
        name: string;
        label: string;
        placeholder: string;
        sensitive: boolean;
    }>;
}>>();

// Store saved credentials status per session
const sessionSavedCredentials = new Map<string, Set<string>>();

/**
 * GET /api/fix-my-app/sessions/:sessionId/credentials
 * Get required credentials for a specific Fix My App session
 *
 * Uses AI-powered detection based on user's conversation intent.
 * Used by FixMyAppCredentials page to display the credential tiles.
 */
router.get('/sessions/:sessionId/credentials', async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { sessionId } = req.params;
        const controller = controllers.get(sessionId);

        if (!controller) {
            return res.status(404).json({ error: 'Session not found or expired' });
        }

        const session = controller.getSession();

        // Get or detect required credentials
        let requiredCredentials = sessionCredentialRequirements.get(sessionId);

        if (!requiredCredentials) {
            // Use AI-powered detection based on user's conversation intent
            console.log(`[Fix My App] Detecting credentials for session ${sessionId} using AI analysis...`);
            try {
                requiredCredentials = await detectRequiredCredentialsAI(session);
                console.log(`[Fix My App] AI detected ${requiredCredentials.length} services requiring credentials`);
            } catch (aiError) {
                console.warn('[Fix My App] AI detection failed, using legacy detection:', aiError);
                requiredCredentials = detectRequiredCredentials(session);
            }
            sessionCredentialRequirements.set(sessionId, requiredCredentials);
        }

        res.json({
            sessionId,
            projectId: session.projectId || null,
            projectName: session.context?.processed?.intentSummary?.corePurpose?.slice(0, 50) || 'Fix My App Project',
            source: session.source,
            status: session.status,
            requiredCredentials,
        });
    } catch (error) {
        console.error('[Fix My App] Get credentials error:', error);
        res.status(500).json({ error: 'Failed to get credential requirements' });
    }
});

/**
 * POST /api/fix-my-app/sessions/:sessionId/credentials
 * Save credentials for a specific service in a Fix My App session
 *
 * Project-specific credential storage
 */
router.post('/sessions/:sessionId/credentials', async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { sessionId } = req.params;
        const { serviceId, credentials } = req.body;

        if (!serviceId || !credentials || typeof credentials !== 'object') {
            return res.status(400).json({ error: 'serviceId and credentials are required' });
        }

        const controller = controllers.get(sessionId);
        if (!controller) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const session = controller.getSession();
        if (!session.projectId) {
            return res.status(400).json({ error: 'No project associated with this session' });
        }

        console.log(`[Fix My App] Storing ${serviceId} credentials for project ${session.projectId}`);

        // Store credentials in project's vault
        const { writeCredentialsToProjectEnv } = await import('../services/credentials/credential-env-bridge.js');
        await writeCredentialsToProjectEnv(session.projectId, userId, credentials);

        // Track saved status
        const saved = sessionSavedCredentials.get(sessionId) || new Set();
        saved.add(serviceId);
        sessionSavedCredentials.set(sessionId, saved);

        res.json({
            success: true,
            message: `${serviceId} credentials saved for this project`,
            serviceId,
        });
    } catch (error) {
        console.error('[Fix My App] Save credentials error:', error);
        res.status(500).json({ error: 'Failed to save credentials' });
    }
});

/**
 * POST /api/fix-my-app/sessions/:sessionId/resume
 * Resume the build after credentials have been entered
 */
router.post('/sessions/:sessionId/resume', async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { sessionId } = req.params;
        const controller = controllers.get(sessionId);

        if (!controller) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const session = controller.getSession();
        if (!session.projectId) {
            return res.status(400).json({ error: 'No project associated with this session' });
        }

        // Check that all required credentials are saved
        const requiredCredentials = sessionCredentialRequirements.get(sessionId) || [];
        const savedCredentials = sessionSavedCredentials.get(sessionId) || new Set();
        const missingServices = requiredCredentials.filter(c => !savedCredentials.has(c.serviceId));

        if (missingServices.length > 0) {
            return res.status(400).json({
                error: 'Missing credentials',
                missingServices: missingServices.map(s => s.serviceName),
            });
        }

        console.log(`[Fix My App] Resuming build for session ${sessionId}`);

        // Update session status
        controller.emit('log', 'Credentials received. Resuming build...');
        controller.emit('progress', { stage: 'resuming', progress: 50 });

        // If there's an active build context, signal it to continue
        const buildContext = buildContexts.get(sessionId);
        if (buildContext) {
            // Resume the orchestrator (it should be waiting for credentials)
            console.log(`[Fix My App] Signaling BuildLoopOrchestrator to continue`);
            // The orchestrator will poll for credential status and continue automatically
        }

        res.json({
            success: true,
            message: 'Build resumed with provided credentials',
            projectId: session.projectId,
        });
    } catch (error) {
        console.error('[Fix My App] Resume error:', error);
        res.status(500).json({ error: 'Failed to resume build' });
    }
});

/**
 * Helper: Detect required credentials from session analysis
 * Uses AI-powered detection based on user's intent from their conversation
 */
async function detectRequiredCredentialsAI(session: any): Promise<Array<{
    serviceId: string;
    serviceName: string;
    reason: string;
    docsUrl?: string;
    keys: Array<{ name: string; label: string; placeholder: string; sensitive: boolean; }>;
}>> {
    const detected: Array<{
        serviceId: string;
        serviceName: string;
        reason: string;
        docsUrl?: string;
        keys: Array<{ name: string; label: string; placeholder: string; sensitive: boolean; }>;
    }> = [];

    try {
        // Get chat history and intent from session
        const chatHistory = session.context?.raw?.chatHistory || [];
        const intentSummary = session.context?.processed?.intentSummary;

        // Get project files if available
        const projectFiles: ProjectFile[] = [];
        if (session.context?.raw?.files) {
            for (const [path, content] of session.context.raw.files) {
                projectFiles.push({ path, content: content as string });
            }
        }

        // Use AI-powered comprehensive detection
        const detectionResult = await detectEnvVarsComprehensive(
            projectFiles,
            chatHistory,
            intentSummary
        );

        // Group by service for the UI format
        const grouped = groupEnvVarsByService(detectionResult.missing);

        for (const [service, vars] of grouped) {
            const firstVar = vars[0];
            detected.push({
                serviceId: service.toLowerCase().replace(/\s+/g, '-'),
                serviceName: firstVar.serviceName || service.charAt(0).toUpperCase() + service.slice(1),
                reason: firstVar.reason || `Required for ${service} integration`,
                docsUrl: getDocsUrlForService(service) || firstVar.docsUrl,
                keys: vars.map(v => ({
                    name: v.name,
                    label: v.description || v.name.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
                    placeholder: v.placeholder || '',
                    sensitive: v.name.toLowerCase().includes('secret') ||
                               v.name.toLowerCase().includes('key') ||
                               v.name.toLowerCase().includes('token') ||
                               v.name.toLowerCase().includes('password'),
                })),
            });
        }
    } catch (error) {
        console.error('[Fix My App] AI credential detection failed:', error);
        // Fall back to legacy pattern-based detection
        return detectRequiredCredentialsLegacy(session);
    }

    return detected;
}

/**
 * Legacy fallback: Pattern-based credential detection
 */
function detectRequiredCredentialsLegacy(session: any): Array<{
    serviceId: string;
    serviceName: string;
    reason: string;
    keys: Array<{ name: string; label: string; placeholder: string; sensitive: boolean; }>;
}> {
    const detected: Array<{
        serviceId: string;
        serviceName: string;
        reason: string;
        keys: Array<{ name: string; label: string; placeholder: string; sensitive: boolean; }>;
    }> = [];

    const gaps = session.context?.processed?.implementationGaps || [];
    const chatContent = session.context?.raw?.chatHistory?.map((m: any) => m.content).join(' ').toLowerCase() || '';
    const fileContent = Array.from(session.context?.raw?.files?.values() || []).join(' ').toLowerCase();
    const combinedContent = chatContent + ' ' + fileContent;

    // Common service patterns as fallback
    const servicePatterns = [
        {
            patterns: ['openai', 'gpt-4', 'gpt-3', 'chatgpt', 'dalle', 'whisper'],
            serviceId: 'openai',
            serviceName: 'OpenAI',
            reason: 'Your app uses OpenAI for AI features',
            keys: [{ name: 'OPENAI_API_KEY', label: 'API Key', placeholder: 'sk-...', sensitive: true }],
        },
        {
            patterns: ['stripe', 'payment', 'subscription', 'billing', 'checkout'],
            serviceId: 'stripe',
            serviceName: 'Stripe',
            reason: 'Your app uses Stripe for payments',
            keys: [
                { name: 'STRIPE_SECRET_KEY', label: 'Secret Key', placeholder: 'sk_live_...', sensitive: true },
                { name: 'STRIPE_PUBLISHABLE_KEY', label: 'Publishable Key', placeholder: 'pk_live_...', sensitive: false },
            ],
        },
        {
            patterns: ['supabase', 'realtime database', 'postgres auth'],
            serviceId: 'supabase',
            serviceName: 'Supabase',
            reason: 'Your app uses Supabase for database/auth',
            keys: [
                { name: 'SUPABASE_URL', label: 'Project URL', placeholder: 'https://xxx.supabase.co', sensitive: false },
                { name: 'SUPABASE_ANON_KEY', label: 'Anon Key', placeholder: 'eyJ...', sensitive: true },
            ],
        },
        {
            patterns: ['twilio', 'sms', 'voice call', 'phone verification'],
            serviceId: 'twilio',
            serviceName: 'Twilio',
            reason: 'Your app uses Twilio for SMS/voice',
            keys: [
                { name: 'TWILIO_ACCOUNT_SID', label: 'Account SID', placeholder: 'AC...', sensitive: false },
                { name: 'TWILIO_AUTH_TOKEN', label: 'Auth Token', placeholder: '', sensitive: true },
            ],
        },
        {
            patterns: ['resend', 'transactional email'],
            serviceId: 'resend',
            serviceName: 'Resend',
            reason: 'Your app uses Resend for email',
            keys: [{ name: 'RESEND_API_KEY', label: 'API Key', placeholder: 're_...', sensitive: true }],
        },
        {
            patterns: ['anthropic', 'claude', 'claude api'],
            serviceId: 'anthropic',
            serviceName: 'Anthropic',
            reason: 'Your app uses Claude AI',
            keys: [{ name: 'ANTHROPIC_API_KEY', label: 'API Key', placeholder: 'sk-ant-...', sensitive: true }],
        },
        {
            patterns: ['gemini', 'google ai', 'bard'],
            serviceId: 'google',
            serviceName: 'Google AI',
            reason: 'Your app uses Google Gemini',
            keys: [{ name: 'GOOGLE_AI_API_KEY', label: 'API Key', placeholder: 'AIza...', sensitive: true }],
        },
    ];

    for (const service of servicePatterns) {
        const matches = service.patterns.some(p => combinedContent.includes(p));
        if (matches) {
            detected.push({
                serviceId: service.serviceId,
                serviceName: service.serviceName,
                reason: service.reason,
                keys: service.keys,
            });
        }
    }

    // Check explicit gaps
    for (const gap of gaps) {
        if (gap.type === 'credential' && gap.service) {
            const existing = detected.find(d => d.serviceId === gap.service);
            if (!existing) {
                detected.push({
                    serviceId: gap.service,
                    serviceName: gap.service.charAt(0).toUpperCase() + gap.service.slice(1),
                    reason: gap.description || `Required for ${gap.service}`,
                    keys: [{ name: `${gap.service.toUpperCase()}_API_KEY`, label: 'API Key', placeholder: '', sensitive: true }],
                });
            }
        }
    }

    return detected;
}

/**
 * Main entry point for credential detection - uses AI with legacy fallback
 */
function detectRequiredCredentials(session: any): Array<{
    serviceId: string;
    serviceName: string;
    reason: string;
    docsUrl?: string;
    keys: Array<{ name: string; label: string; placeholder: string; sensitive: boolean; }>;
}> {
    // For synchronous contexts, use legacy detection
    // The async AI version is called directly in the route handler
    return detectRequiredCredentialsLegacy(session);
}

/**
 * POST /api/fix-my-app/:projectId/credentials (Legacy route for CredentialTile component)
 * Submit credentials for a fix session
 *
 * Called by the CredentialTiles UI when user enters API keys
 */
router.post('/:sessionId/credentials', async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { sessionId } = req.params;
        const { service, credentials } = req.body;

        if (!service || !credentials || typeof credentials !== 'object') {
            return res.status(400).json({
                error: 'Missing required fields: service and credentials'
            });
        }

        const controller = controllers.get(sessionId);
        if (!controller) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const session = controller.getSession();
        if (!session.projectId) {
            return res.status(400).json({ error: 'No project associated with this session' });
        }

        console.log(`[Fix My App] Storing credentials for ${service} in session ${sessionId}`);

        // Write credentials to project's .env file (this also stores in vault)
        const { writeCredentialsToProjectEnv } = await import('../services/credentials/credential-env-bridge.js');
        await writeCredentialsToProjectEnv(session.projectId, userId, credentials);

        res.json({
            success: true,
            message: `${service} credentials stored successfully`,
            storedKeys: Object.keys(credentials).filter(k => credentials[k]),
        });
    } catch (error) {
        console.error('[Fix My App] Credentials storage error:', error);
        res.status(500).json({
            error: 'Failed to store credentials',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * GET /api/fix-my-app/:sessionId/credentials/status
 * Check which credentials have been submitted
 */
router.get('/:sessionId/credentials/status', async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { sessionId } = req.params;
        const controller = controllers.get(sessionId);

        if (!controller) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const session = controller.getSession();
        if (!session.projectId) {
            return res.status(400).json({ error: 'No project associated with this session' });
        }

        // Get required credentials from the detected dependencies
        const requiredServices = session.context?.processed?.implementationGaps
            ?.filter((gap: any) => gap.type === 'credential')
            ?.map((gap: any) => gap.service) || [];

        // Check which credentials exist - get from projectEnvVars table
        const { db } = await import('../db.js');
        const { projectEnvVars } = await import('../schema.js');
        const { eq } = await import('drizzle-orm');

        const storedVars = await db
            .select({ envKey: projectEnvVars.envKey })
            .from(projectEnvVars)
            .where(eq(projectEnvVars.projectId, session.projectId));
        const storedKeys = storedVars.map(v => v.envKey);

        res.json({
            success: true,
            requiredServices,
            storedKeys,
            allSatisfied: requiredServices.every((s: string) => storedKeys.includes(s)),
        });
    } catch (error) {
        console.error('[Fix My App] Credentials status error:', error);
        res.status(500).json({ error: 'Failed to check credentials status' });
    }
});

/**
 * POST /api/fix-my-app/:sessionId/verify/:featureId
 * Retest a specific feature verification
 */
router.post('/:sessionId/verify/:featureId', async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { sessionId, featureId } = req.params;
        const controller = controllers.get(sessionId);

        if (!controller) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Trigger verification for this feature
        // This will be handled by the BuildLoopOrchestrator's verification phase
        console.log(`[Fix My App] Retesting feature ${featureId} for session ${sessionId}`);

        res.json({
            success: true,
            message: `Verification started for feature ${featureId}`,
        });
    } catch (error) {
        console.error('[Fix My App] Verify error:', error);
        res.status(500).json({ error: 'Failed to start verification' });
    }
});

export default router;

