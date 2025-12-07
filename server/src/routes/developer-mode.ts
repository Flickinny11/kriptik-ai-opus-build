/**
 * Developer Mode API Routes
 *
 * REST API endpoints for Developer Mode operations:
 * - Session management (create, pause, resume, end)
 * - Agent deployment and control
 * - Merge queue management
 * - Real-time events via SSE
 * - Verification mode configuration
 */

import { Router, Request, Response } from 'express';
import {
    getDeveloperModeOrchestrator,
    getVerificationModeScaler,
    VERIFICATION_MODES,
    type DeployAgentRequest,
    type AgentModel,
    type VerificationMode,
} from '../services/developer-mode/index.js';
import { authMiddleware } from '../middleware/auth.js';
import {
    getKripToeNiteService,
} from '../services/ai/krip-toe-nite/index.js';
import {
    getOpenRouterClient,
    OPENROUTER_MODELS,
    type OpenRouterModel,
} from '../services/ai/openrouter-client.js';
import {
    createSandboxService,
    type SandboxService,
} from '../services/developer-mode/sandbox-service.js';
import {
    createSoftInterruptManager,
    type SoftInterruptManager,
} from '../services/soft-interrupt/interrupt-manager.js';
import {
    createVisualVerificationService,
    type VisualVerificationService,
} from '../services/automation/visual-verifier.js';

// Helper to ensure user is authenticated
const requireAuth = authMiddleware;

const router = Router();
const orchestrator = getDeveloperModeOrchestrator();
const verificationScaler = getVerificationModeScaler();

// Initialize shared services
let sandboxService: SandboxService | null = null;
let interruptManager: SoftInterruptManager | null = null;
let visualVerifier: VisualVerificationService | null = null;

function getSandboxService(): SandboxService {
    if (!sandboxService) {
        sandboxService = createSandboxService({
            basePort: 3200,
            maxSandboxes: 10,
            projectPath: '/tmp/developer-mode',
            framework: 'vite',
        });
    }
    return sandboxService;
}

function getInterruptManager(): SoftInterruptManager {
    if (!interruptManager) {
        interruptManager = createSoftInterruptManager();
    }
    return interruptManager;
}

function getVisualVerifier(): VisualVerificationService {
    if (!visualVerifier) {
        visualVerifier = createVisualVerificationService();
    }
    return visualVerifier;
}

// =============================================================================
// CODE GENERATION WITH MODEL ROUTING
// =============================================================================

/**
 * POST /api/developer-mode/generate
 * Generate code using the selected model
 * Routes through Krip-Toe-Nite for intelligent model selection or uses specific model
 */
router.post('/generate', requireAuth, async (req: Request, res: Response) => {
    try {
        const {
            prompt,
            selectedModel,
            systemPrompt,
            context,
            sessionId,
            projectId,
            maxTokens = 32000,
        } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'prompt is required' });
        }

        // Check for pending interrupts at this tool boundary
        if (sessionId) {
            const manager = getInterruptManager();
            const interrupts = await manager.getInterruptsAtToolBoundary(sessionId, req.user!.id);

            if (interrupts.length > 0) {
                for (const interrupt of interrupts) {
                    const result = await manager.applyInterrupt(interrupt, req.user!.id);
                    if (result.action === 'applied' && interrupt.type === 'HALT') {
                        return res.json({
                            success: false,
                            halted: true,
                            reason: interrupt.message,
                            interruptId: interrupt.id,
                        });
                    }
                }
            }
        }

        let response: string;
        let modelUsed: string;
        let ttftMs: number | undefined;
        let strategy: string | undefined;

        const startTime = Date.now();

        if (selectedModel === 'krip-toe-nite') {
            // Use Krip-Toe-Nite for intelligent model routing
            const ktn = getKripToeNiteService();
            let content = '';
            let firstChunk = true;

            const options = {
                prompt,
                systemPrompt: systemPrompt || 'You are an expert developer. Generate clean, production-ready code.',
                context: context || {},
                maxTokens,
            };

            for await (const chunk of ktn.generate(options)) {
                if (chunk.type === 'text') {
                    if (firstChunk) {
                        ttftMs = Date.now() - startTime;
                        firstChunk = false;
                    }
                    content += chunk.content;
                }
                if (chunk.type === 'status') {
                    modelUsed = chunk.model || 'krip-toe-nite';
                    strategy = chunk.strategy;
                }
            }

            response = content;
            modelUsed = modelUsed! || 'krip-toe-nite';

        } else {
            // Use OpenRouterClient with specific model via Anthropic SDK
            const client = getOpenRouterClient();

            // Map model IDs to OpenRouter models
            const modelMap: Record<string, OpenRouterModel> = {
                'claude-opus-4-5': OPENROUTER_MODELS.OPUS_4_5,
                'claude-sonnet-4-5': OPENROUTER_MODELS.SONNET_4_5,
                'claude-haiku-3-5': OPENROUTER_MODELS.HAIKU_3_5,
                'gpt-5-codex': OPENROUTER_MODELS.GPT_4O,
                'gemini-2-5-pro': OPENROUTER_MODELS.GEMINI_2_FLASH,
                'deepseek-r1': OPENROUTER_MODELS.DEEPSEEK_V3,
            };

            const model = modelMap[selectedModel] || OPENROUTER_MODELS.SONNET_4_5;
            const anthropicClient = client.getClient();

            const result = await anthropicClient.messages.create({
                model,
                max_tokens: maxTokens,
                system: systemPrompt || 'You are an expert developer.',
                messages: [
                    { role: 'user', content: prompt },
                ],
            });

            ttftMs = Date.now() - startTime;
            response = result.content[0]?.type === 'text' ? result.content[0].text : '';
            modelUsed = model;
        }

        // Run visual verification if sandbox is available and content looks like UI code
        let designIssues: any[] = [];
        let slopDetected = false;

        if (projectId && (response.includes('className=') || response.includes('style='))) {
            try {
                const sandbox = getSandboxService().getSandbox(projectId);
                if (sandbox && sandbox.status === 'running') {
                    // Would capture screenshot here - placeholder for actual implementation
                    console.log(`[Developer Mode] Visual verification available for project ${projectId}`);
                }
            } catch (verifyError) {
                console.warn('[Developer Mode] Visual verification skipped:', verifyError);
            }
        }

        res.json({
            success: true,
            content: response,
            model: modelUsed,
            ttftMs,
            strategy,
            designIssues,
            slopDetected,
        });

    } catch (error) {
        console.error('[Developer Mode] Generate error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Generation failed' });
    }
});

/**
 * POST /api/developer-mode/generate/stream
 * Stream generation with SSE
 */
router.get('/generate/stream', requireAuth, async (req: Request, res: Response) => {
    try {
        const prompt = req.query.prompt as string;
        const selectedModel = req.query.model as string || 'krip-toe-nite';
        const sessionId = req.query.sessionId as string;

        if (!prompt) {
            return res.status(400).json({ error: 'prompt is required' });
        }

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        const startTime = Date.now();

        if (selectedModel === 'krip-toe-nite') {
            const ktn = getKripToeNiteService();
            let firstChunk = true;

            for await (const chunk of ktn.generate({
                prompt,
                systemPrompt: 'You are an expert developer. Generate clean, production-ready code.',
                context: {},
                maxTokens: 32000,
            })) {
                if (chunk.type === 'text') {
                    if (firstChunk) {
                        const ttftMs = Date.now() - startTime;
                        res.write(`data: ${JSON.stringify({ type: 'ttft', ttftMs })}\n\n`);
                        firstChunk = false;
                    }
                    res.write(`data: ${JSON.stringify({ type: 'text', content: chunk.content })}\n\n`);
                }
                if (chunk.type === 'status') {
                    res.write(`data: ${JSON.stringify({ type: 'status', model: chunk.model, strategy: chunk.strategy })}\n\n`);
                }
            }

            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            res.end();
        } else {
            // Non-streaming fallback for specific models
            const client = getOpenRouterClient();
            const anthropicClient = client.getClient();

            const result = await anthropicClient.messages.create({
                model: selectedModel as OpenRouterModel || OPENROUTER_MODELS.SONNET_4_5,
                max_tokens: 32000,
                messages: [{ role: 'user', content: prompt }],
            });

            const ttftMs = Date.now() - startTime;
            const content = result.content[0]?.type === 'text' ? result.content[0].text : '';

            res.write(`data: ${JSON.stringify({ type: 'ttft', ttftMs })}\n\n`);
            res.write(`data: ${JSON.stringify({ type: 'text', content })}\n\n`);
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            res.end();
        }

    } catch (error) {
        console.error('[Developer Mode] Stream error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: (error as Error).message })}\n\n`);
        res.end();
    }
});

// =============================================================================
// SANDBOX MANAGEMENT
// =============================================================================

/**
 * POST /api/developer-mode/sandbox
 * Create or get sandbox for a session
 */
router.post('/sandbox', requireAuth, async (req: Request, res: Response) => {
    try {
        const { sessionId, projectPath } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId is required' });
        }

        const service = getSandboxService();
        await service.initialize();

        let sandbox = service.getSandbox(sessionId);

        if (!sandbox) {
            sandbox = await service.createSandbox(
                sessionId,
                projectPath || `/tmp/developer-mode/${sessionId}`
            );
        }

        res.json({
            success: true,
            sandbox: {
                id: sandbox.id,
                url: sandbox.url,
                status: sandbox.status,
                port: sandbox.port,
            },
        });

    } catch (error) {
        console.error('[Developer Mode] Sandbox creation error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Sandbox creation failed' });
    }
});

/**
 * GET /api/developer-mode/sandbox/:sessionId
 * Get sandbox status
 */
router.get('/sandbox/:sessionId', requireAuth, async (req: Request, res: Response) => {
    try {
        const service = getSandboxService();
        const sandbox = service.getSandbox(req.params.sessionId);

        if (!sandbox) {
            return res.json({ success: true, sandbox: null });
        }

        res.json({
            success: true,
            sandbox: {
                id: sandbox.id,
                url: sandbox.url,
                status: sandbox.status,
                port: sandbox.port,
            },
        });

    } catch (error) {
        console.error('[Developer Mode] Get sandbox error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get sandbox' });
    }
});

/**
 * POST /api/developer-mode/sandbox/:sessionId/restart
 * Restart sandbox
 */
router.post('/sandbox/:sessionId/restart', requireAuth, async (req: Request, res: Response) => {
    try {
        const service = getSandboxService();
        await service.restartSandbox(req.params.sessionId);

        const sandbox = service.getSandbox(req.params.sessionId);

        res.json({
            success: true,
            sandbox: sandbox ? {
                id: sandbox.id,
                url: sandbox.url,
                status: sandbox.status,
                port: sandbox.port,
            } : null,
        });

    } catch (error) {
        console.error('[Developer Mode] Restart sandbox error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to restart sandbox' });
    }
});

/**
 * POST /api/developer-mode/sandbox/:sessionId/hmr
 * Trigger HMR update
 */
router.post('/sandbox/:sessionId/hmr', requireAuth, async (req: Request, res: Response) => {
    try {
        const { filePath } = req.body;

        if (!filePath) {
            return res.status(400).json({ error: 'filePath is required' });
        }

        const service = getSandboxService();
        await service.triggerHMRUpdate(req.params.sessionId, filePath);

        res.json({ success: true });

    } catch (error) {
        console.error('[Developer Mode] HMR trigger error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'HMR trigger failed' });
    }
});

/**
 * DELETE /api/developer-mode/sandbox/:sessionId
 * Remove sandbox
 */
router.delete('/sandbox/:sessionId', requireAuth, async (req: Request, res: Response) => {
    try {
        const service = getSandboxService();
        await service.removeSandbox(req.params.sessionId);

        res.json({ success: true });

    } catch (error) {
        console.error('[Developer Mode] Remove sandbox error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to remove sandbox' });
    }
});

// =============================================================================
// SOFT INTERRUPT SYSTEM
// =============================================================================

/**
 * POST /api/developer-mode/interrupt
 * Submit a soft interrupt
 */
router.post('/interrupt', requireAuth, async (req: Request, res: Response) => {
    try {
        const { sessionId, message, agentId } = req.body;

        if (!sessionId || !message) {
            return res.status(400).json({ error: 'sessionId and message are required' });
        }

        const manager = getInterruptManager();
        const interrupt = await manager.submitInterrupt(sessionId, message, agentId);

        res.json({
            success: true,
            interrupt: {
                id: interrupt.id,
                type: interrupt.type,
                priority: interrupt.priority,
                confidence: interrupt.confidence,
                status: interrupt.status,
            },
        });

    } catch (error) {
        console.error('[Developer Mode] Submit interrupt error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to submit interrupt' });
    }
});

/**
 * GET /api/developer-mode/interrupts/:sessionId
 * Get interrupt history for a session
 */
router.get('/interrupts/:sessionId', requireAuth, async (req: Request, res: Response) => {
    try {
        const manager = getInterruptManager();
        const history = await manager.getInterruptHistory(req.params.sessionId);

        res.json({
            success: true,
            interrupts: history.map(i => ({
                id: i.id,
                type: i.type,
                priority: i.priority,
                message: i.message,
                status: i.status,
                timestamp: i.timestamp,
            })),
        });

    } catch (error) {
        console.error('[Developer Mode] Get interrupts error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get interrupts' });
    }
});

/**
 * POST /api/developer-mode/interrupts/:sessionId/clear
 * Clear processed interrupts
 */
router.post('/interrupts/:sessionId/clear', requireAuth, async (req: Request, res: Response) => {
    try {
        const manager = getInterruptManager();
        manager.clearProcessedInterrupts(req.params.sessionId);

        res.json({ success: true });

    } catch (error) {
        console.error('[Developer Mode] Clear interrupts error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to clear interrupts' });
    }
});

// =============================================================================
// VISUAL VERIFICATION
// =============================================================================

/**
 * POST /api/developer-mode/verify
 * Run visual verification on a screenshot
 */
router.post('/verify', requireAuth, async (req: Request, res: Response) => {
    try {
        const { screenshot, designRequirements } = req.body;

        if (!screenshot) {
            return res.status(400).json({ error: 'screenshot is required' });
        }

        const verifier = getVisualVerifier();
        const result = await verifier.verifyPage(
            screenshot,
            designRequirements || 'Premium, modern UI with depth and visual polish'
        );

        res.json({
            success: true,
            verification: {
                passed: result.passed,
                designScore: result.designScore,
                issues: result.issues,
                accessibilityIssues: result.accessibilityIssues,
                recommendations: result.recommendations,
                analysis: result.analysis,
            },
        });

    } catch (error) {
        console.error('[Developer Mode] Visual verification error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Verification failed' });
    }
});

/**
 * POST /api/developer-mode/verify/slop
 * Detect AI slop patterns in a screenshot
 */
router.post('/verify/slop', requireAuth, async (req: Request, res: Response) => {
    try {
        const { screenshot } = req.body;

        if (!screenshot) {
            return res.status(400).json({ error: 'screenshot is required' });
        }

        const verifier = getVisualVerifier();
        const issues = await verifier.detectSlop(screenshot);

        res.json({
            success: true,
            slopDetected: issues.length > 0,
            issues,
        });

    } catch (error) {
        console.error('[Developer Mode] Slop detection error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Slop detection failed' });
    }
});

/**
 * POST /api/developer-mode/verify/component
 * Verify a specific component
 */
router.post('/verify/component', requireAuth, async (req: Request, res: Response) => {
    try {
        const { screenshot, componentName, expectedBehavior } = req.body;

        if (!screenshot || !componentName) {
            return res.status(400).json({ error: 'screenshot and componentName are required' });
        }

        const verifier = getVisualVerifier();
        const result = await verifier.verifyComponent(
            screenshot,
            componentName,
            expectedBehavior || `${componentName} should be visible and functional`
        );

        res.json({
            success: true,
            verification: {
                componentName: result.componentName,
                found: result.found,
                visible: result.visible,
                interactive: result.interactive,
                designQuality: result.designQuality,
                issues: result.issues,
            },
        });

    } catch (error) {
        console.error('[Developer Mode] Component verification error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Component verification failed' });
    }
});

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

/**
 * POST /api/developer-mode/sessions
 * Start a new Developer Mode session
 */
router.post('/sessions', requireAuth, async (req: Request, res: Response) => {
    try {
        const { projectId, defaultModel, verificationMode, autoMergeEnabled, baseBranch, budgetLimit } = req.body;

        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }

        const session = await orchestrator.startSession({
            projectId,
            userId: req.user!.id,
            defaultModel: defaultModel as AgentModel,
            verificationMode: verificationMode as VerificationMode,
            autoMergeEnabled,
            baseBranch,
            budgetLimit,
        });

        res.json({ success: true, session });
    } catch (error) {
        console.error('[Developer Mode] Session creation error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create session' });
    }
});

/**
 * GET /api/developer-mode/sessions/:sessionId
 * Get session details
 */
router.get('/sessions/:sessionId', requireAuth, async (req: Request, res: Response) => {
    try {
        const session = await orchestrator.getSession(req.params.sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.userId !== req.user!.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        res.json({ success: true, session });
    } catch (error) {
        console.error('[Developer Mode] Get session error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get session' });
    }
});

/**
 * GET /api/developer-mode/projects/:projectId/session
 * Get active session for a project
 */
router.get('/projects/:projectId/session', requireAuth, async (req: Request, res: Response) => {
    try {
        const session = await orchestrator.getActiveSessionForProject(req.params.projectId);

        if (!session) {
            return res.json({ success: true, session: null });
        }

        if (session.userId !== req.user!.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        res.json({ success: true, session });
    } catch (error) {
        console.error('[Developer Mode] Get project session error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get session' });
    }
});

/**
 * GET /api/developer-mode/sessions
 * Get all sessions for current user
 */
router.get('/sessions', requireAuth, async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;
        const sessions = await orchestrator.getUserSessions(req.user!.id, limit);
        res.json({ success: true, sessions });
    } catch (error) {
        console.error('[Developer Mode] Get sessions error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get sessions' });
    }
});

/**
 * POST /api/developer-mode/sessions/:sessionId/pause
 * Pause a session
 */
router.post('/sessions/:sessionId/pause', requireAuth, async (req: Request, res: Response) => {
    try {
        const session = await orchestrator.getSession(req.params.sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.userId !== req.user!.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await orchestrator.pauseSession(req.params.sessionId);
        res.json({ success: true });
    } catch (error) {
        console.error('[Developer Mode] Pause session error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to pause session' });
    }
});

/**
 * POST /api/developer-mode/sessions/:sessionId/resume
 * Resume a paused session
 */
router.post('/sessions/:sessionId/resume', requireAuth, async (req: Request, res: Response) => {
    try {
        const session = await orchestrator.getSession(req.params.sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.userId !== req.user!.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await orchestrator.resumeSession(req.params.sessionId);
        res.json({ success: true });
    } catch (error) {
        console.error('[Developer Mode] Resume session error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to resume session' });
    }
});

/**
 * POST /api/developer-mode/sessions/:sessionId/end
 * End a session
 */
router.post('/sessions/:sessionId/end', requireAuth, async (req: Request, res: Response) => {
    try {
        const session = await orchestrator.getSession(req.params.sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.userId !== req.user!.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await orchestrator.endSession(req.params.sessionId);
        res.json({ success: true });
    } catch (error) {
        console.error('[Developer Mode] End session error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to end session' });
    }
});

/**
 * PATCH /api/developer-mode/sessions/:sessionId
 * Update session configuration
 */
router.patch('/sessions/:sessionId', requireAuth, async (req: Request, res: Response) => {
    try {
        const session = await orchestrator.getSession(req.params.sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.userId !== req.user!.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const { defaultModel, verificationMode, autoMergeEnabled, budgetLimit } = req.body;

        await orchestrator.updateSessionConfig(req.params.sessionId, {
            defaultModel,
            verificationMode,
            autoMergeEnabled,
            budgetLimit,
        });

        const updatedSession = await orchestrator.getSession(req.params.sessionId);
        res.json({ success: true, session: updatedSession });
    } catch (error) {
        console.error('[Developer Mode] Update session error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update session' });
    }
});

// =============================================================================
// AGENT MANAGEMENT
// =============================================================================

/**
 * POST /api/developer-mode/sessions/:sessionId/agents
 * Deploy a new agent
 */
router.post('/sessions/:sessionId/agents', requireAuth, async (req: Request, res: Response) => {
    try {
        const session = await orchestrator.getSession(req.params.sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.userId !== req.user!.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const deployRequest: DeployAgentRequest = {
            name: req.body.name,
            taskPrompt: req.body.taskPrompt,
            model: req.body.model,
            effortLevel: req.body.effortLevel,
            thinkingBudget: req.body.thinkingBudget,
            verificationMode: req.body.verificationMode,
            files: req.body.files,
            context: req.body.context,
        };

        if (!deployRequest.name || !deployRequest.taskPrompt) {
            return res.status(400).json({ error: 'name and taskPrompt are required' });
        }

        const agent = await orchestrator.deployAgent(req.params.sessionId, deployRequest);
        res.json({ success: true, agent });
    } catch (error) {
        console.error('[Developer Mode] Deploy agent error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to deploy agent' });
    }
});

/**
 * GET /api/developer-mode/sessions/:sessionId/agents
 * Get all agents in a session
 */
router.get('/sessions/:sessionId/agents', requireAuth, async (req: Request, res: Response) => {
    try {
        const session = await orchestrator.getSession(req.params.sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.userId !== req.user!.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        res.json({ success: true, agents: session.agents });
    } catch (error) {
        console.error('[Developer Mode] Get agents error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get agents' });
    }
});

/**
 * GET /api/developer-mode/agents/:agentId
 * Get agent details
 */
router.get('/agents/:agentId', requireAuth, async (req: Request, res: Response) => {
    try {
        const agent = await orchestrator.getAgent(req.params.agentId);

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        if (agent.userId !== req.user!.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        res.json({ success: true, agent });
    } catch (error) {
        console.error('[Developer Mode] Get agent error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get agent' });
    }
});

/**
 * POST /api/developer-mode/agents/:agentId/stop
 * Stop an agent
 */
router.post('/agents/:agentId/stop', requireAuth, async (req: Request, res: Response) => {
    try {
        const agent = await orchestrator.getAgent(req.params.agentId);

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        if (agent.userId !== req.user!.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await orchestrator.stopAgent(req.params.agentId);
        res.json({ success: true });
    } catch (error) {
        console.error('[Developer Mode] Stop agent error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to stop agent' });
    }
});

/**
 * POST /api/developer-mode/agents/:agentId/resume
 * Resume an agent
 */
router.post('/agents/:agentId/resume', requireAuth, async (req: Request, res: Response) => {
    try {
        const agent = await orchestrator.getAgent(req.params.agentId);

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        if (agent.userId !== req.user!.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await orchestrator.resumeAgent(req.params.agentId);
        res.json({ success: true });
    } catch (error) {
        console.error('[Developer Mode] Resume agent error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to resume agent' });
    }
});

/**
 * PATCH /api/developer-mode/agents/:agentId
 * Update agent (rename, change model)
 */
router.patch('/agents/:agentId', requireAuth, async (req: Request, res: Response) => {
    try {
        const agent = await orchestrator.getAgent(req.params.agentId);

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        if (agent.userId !== req.user!.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        if (req.body.name) {
            await orchestrator.renameAgent(req.params.agentId, req.body.name);
        }

        if (req.body.model) {
            await orchestrator.changeAgentModel(req.params.agentId, req.body.model);
        }

        const updatedAgent = await orchestrator.getAgent(req.params.agentId);
        res.json({ success: true, agent: updatedAgent });
    } catch (error) {
        console.error('[Developer Mode] Update agent error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update agent' });
    }
});

/**
 * DELETE /api/developer-mode/agents/:agentId
 * Delete an agent
 */
router.delete('/agents/:agentId', requireAuth, async (req: Request, res: Response) => {
    try {
        const agent = await orchestrator.getAgent(req.params.agentId);

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        if (agent.userId !== req.user!.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await orchestrator.deleteAgent(req.params.agentId);
        res.json({ success: true });
    } catch (error) {
        console.error('[Developer Mode] Delete agent error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete agent' });
    }
});

/**
 * GET /api/developer-mode/agents/:agentId/logs
 * Get agent logs
 */
router.get('/agents/:agentId/logs', requireAuth, async (req: Request, res: Response) => {
    try {
        const agent = await orchestrator.getAgent(req.params.agentId);

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        if (agent.userId !== req.user!.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const limit = parseInt(req.query.limit as string) || 100;
        const logs = await orchestrator.getAgentLogs(req.params.agentId, limit);
        res.json({ success: true, logs });
    } catch (error) {
        console.error('[Developer Mode] Get agent logs error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get logs' });
    }
});

// =============================================================================
// MERGE QUEUE
// =============================================================================

/**
 * GET /api/developer-mode/sessions/:sessionId/merge-queue
 * Get merge queue for a session
 */
router.get('/sessions/:sessionId/merge-queue', requireAuth, async (req: Request, res: Response) => {
    try {
        const session = await orchestrator.getSession(req.params.sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.userId !== req.user!.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const mergeQueue = await orchestrator.getMergeQueue(req.params.sessionId);
        res.json({ success: true, mergeQueue });
    } catch (error) {
        console.error('[Developer Mode] Get merge queue error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get merge queue' });
    }
});

/**
 * POST /api/developer-mode/merges/:mergeId/approve
 * Approve a merge
 */
router.post('/merges/:mergeId/approve', requireAuth, async (req: Request, res: Response) => {
    try {
        await orchestrator.approveMerge(req.params.mergeId, req.user!.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[Developer Mode] Approve merge error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to approve merge' });
    }
});

/**
 * POST /api/developer-mode/merges/:mergeId/reject
 * Reject a merge
 */
router.post('/merges/:mergeId/reject', requireAuth, async (req: Request, res: Response) => {
    try {
        const { reason } = req.body;
        await orchestrator.rejectMerge(req.params.mergeId, req.user!.id, reason || 'Rejected by user');
        res.json({ success: true });
    } catch (error) {
        console.error('[Developer Mode] Reject merge error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to reject merge' });
    }
});

/**
 * POST /api/developer-mode/merges/:mergeId/execute
 * Execute an approved merge
 */
router.post('/merges/:mergeId/execute', requireAuth, async (req: Request, res: Response) => {
    try {
        await orchestrator.executeMerge(req.params.mergeId);
        res.json({ success: true });
    } catch (error) {
        console.error('[Developer Mode] Execute merge error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to execute merge' });
    }
});

// =============================================================================
// VERIFICATION MODES
// =============================================================================

/**
 * GET /api/developer-mode/verification-modes
 * Get all verification modes
 */
router.get('/verification-modes', requireAuth, async (_req: Request, res: Response) => {
    try {
        const modes = verificationScaler.getAllModes();
        res.json({ success: true, modes });
    } catch (error) {
        console.error('[Developer Mode] Get verification modes error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get modes' });
    }
});

/**
 * GET /api/developer-mode/verification-modes/:mode
 * Get specific verification mode config
 */
router.get('/verification-modes/:mode', requireAuth, async (req: Request, res: Response) => {
    try {
        const mode = req.params.mode as VerificationMode;
        if (!VERIFICATION_MODES[mode]) {
            return res.status(404).json({ error: 'Mode not found' });
        }

        const config = verificationScaler.getModeConfig(mode);
        res.json({ success: true, mode, config });
    } catch (error) {
        console.error('[Developer Mode] Get verification mode error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get mode' });
    }
});

/**
 * POST /api/developer-mode/verification-modes/recommend
 * Recommend a verification mode based on task
 */
router.post('/verification-modes/recommend', requireAuth, async (req: Request, res: Response) => {
    try {
        const { filesChanged, isVisualChange, isSecuritySensitive, hasNewComponents, userPreference } = req.body;

        const recommendedMode = verificationScaler.recommendMode({
            filesChanged: filesChanged || 0,
            isVisualChange: isVisualChange || false,
            isSecuritySensitive: isSecuritySensitive || false,
            hasNewComponents: hasNewComponents || false,
            userPreference,
        });

        const config = verificationScaler.getModeConfig(recommendedMode);
        res.json({ success: true, recommendedMode, config });
    } catch (error) {
        console.error('[Developer Mode] Recommend mode error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to recommend mode' });
    }
});

// =============================================================================
// CREDIT ESTIMATION
// =============================================================================

/**
 * POST /api/developer-mode/estimate-credits
 * Estimate credits for a task
 */
router.post('/estimate-credits', requireAuth, async (req: Request, res: Response) => {
    try {
        const { model, taskComplexity } = req.body;

        if (!model || !taskComplexity) {
            return res.status(400).json({ error: 'model and taskComplexity are required' });
        }

        const credits = orchestrator.estimateCredits(
            model as AgentModel,
            taskComplexity as 'simple' | 'medium' | 'complex'
        );

        res.json({ success: true, estimatedCredits: credits });
    } catch (error) {
        console.error('[Developer Mode] Estimate credits error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to estimate credits' });
    }
});

// =============================================================================
// REAL-TIME EVENTS (SSE)
// =============================================================================

/**
 * GET /api/developer-mode/sessions/:sessionId/events
 * Server-Sent Events for real-time updates
 */
router.get('/sessions/:sessionId/events', requireAuth, async (req: Request, res: Response) => {
    try {
        const session = await orchestrator.getSession(req.params.sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.userId !== req.user!.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        // Send initial connection event
        res.write(`data: ${JSON.stringify({ type: 'connected', sessionId: req.params.sessionId })}\n\n`);

        // Event handlers
        const handleEvent = (eventType: string) => (data: object) => {
            if ('sessionId' in data && data.sessionId === req.params.sessionId) {
                res.write(`data: ${JSON.stringify({ type: eventType, ...data })}\n\n`);
            }
        };

        const eventTypes = [
            'agent:created',
            'agent:deployed',
            'agent:task-started',
            'agent:task-completed',
            'agent:progress',
            'agent:log',
            'agent:error',
            'agent:stopped',
            'merge:queued',
            'merge:approved',
            'merge:rejected',
            'merge:completed',
            'session:paused',
            'session:resumed',
            'session:ended',
            'session:config-updated',
        ];

        const handlers = new Map<string, (data: object) => void>();
        for (const eventType of eventTypes) {
            const handler = handleEvent(eventType);
            handlers.set(eventType, handler);
            orchestrator.on(eventType, handler);
        }

        // Send heartbeat every 30 seconds
        const heartbeat = setInterval(() => {
            res.write(`: heartbeat\n\n`);
        }, 30000);

        // Clean up on disconnect
        req.on('close', () => {
            clearInterval(heartbeat);
            for (const [eventType, handler] of handlers) {
                orchestrator.off(eventType, handler);
            }
        });
    } catch (error) {
        console.error('[Developer Mode] SSE error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'SSE failed' });
    }
});

/**
 * GET /api/developer-mode/agents/:agentId/events
 * Server-Sent Events for a specific agent
 */
router.get('/agents/:agentId/events', requireAuth, async (req: Request, res: Response) => {
    try {
        const agent = await orchestrator.getAgent(req.params.agentId);

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        if (agent.userId !== req.user!.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        // Send initial connection event
        res.write(`data: ${JSON.stringify({ type: 'connected', agentId: req.params.agentId })}\n\n`);

        // Event handlers
        const handleEvent = (eventType: string) => (data: object) => {
            if ('agentId' in data && data.agentId === req.params.agentId) {
                res.write(`data: ${JSON.stringify({ type: eventType, ...data })}\n\n`);
            }
        };

        const eventTypes = [
            'agent:task-started',
            'agent:task-completed',
            'agent:progress',
            'agent:log',
            'agent:error',
            'agent:stopped',
        ];

        const handlers = new Map<string, (data: object) => void>();
        for (const eventType of eventTypes) {
            const handler = handleEvent(eventType);
            handlers.set(eventType, handler);
            orchestrator.on(eventType, handler);
        }

        // Send heartbeat every 30 seconds
        const heartbeat = setInterval(() => {
            res.write(`: heartbeat\n\n`);
        }, 30000);

        // Clean up on disconnect
        req.on('close', () => {
            clearInterval(heartbeat);
            for (const [eventType, handler] of handlers) {
                orchestrator.off(eventType, handler);
            }
        });
    } catch (error) {
        console.error('[Developer Mode] Agent SSE error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'SSE failed' });
    }
});

// =============================================================================
// AVAILABLE MODELS
// =============================================================================

/**
 * GET /api/developer-mode/models
 * Get available models for Developer Mode
 */
router.get('/models', requireAuth, async (_req: Request, res: Response) => {
    try {
        const models = [
            {
                id: 'krip-toe-nite',
                name: 'Krip-Toe-Nite',
                provider: 'KripTik AI',
                description: 'Intelligent model routing - auto-selects best model per task',
                creditsPerTask: 15,
                recommended: ['all tasks', 'optimal speed/quality', 'cost optimization'],
                isDefault: true,
                features: ['speculative execution', 'auto model selection', 'TTFT optimization'],
            },
            {
                id: 'claude-opus-4-5',
                name: 'Claude Opus 4.5',
                provider: 'Anthropic',
                description: 'Most capable model for complex tasks',
                creditsPerTask: 50,
                recommended: ['complex architecture', 'critical fixes', 'security'],
            },
            {
                id: 'claude-sonnet-4-5',
                name: 'Claude Sonnet 4.5',
                provider: 'Anthropic',
                description: 'Balanced performance and cost',
                creditsPerTask: 20,
                recommended: ['feature implementation', 'code generation'],
            },
            {
                id: 'claude-haiku-3-5',
                name: 'Claude Haiku 3.5',
                provider: 'Anthropic',
                description: 'Fast and cost-effective',
                creditsPerTask: 5,
                recommended: ['simple fixes', 'documentation', 'quick tasks'],
            },
            {
                id: 'gpt-5-codex',
                name: 'GPT-5 Codex',
                provider: 'OpenAI',
                description: 'Specialized for code generation',
                creditsPerTask: 25,
                recommended: ['code generation', 'refactoring'],
            },
            {
                id: 'gemini-2-5-pro',
                name: 'Gemini 2.5 Pro',
                provider: 'Google',
                description: 'Good for multimodal tasks',
                creditsPerTask: 15,
                recommended: ['visual analysis', 'documentation'],
            },
            {
                id: 'deepseek-r1',
                name: 'DeepSeek R1',
                provider: 'DeepSeek',
                description: 'Cost-effective reasoning model',
                creditsPerTask: 8,
                recommended: ['analysis', 'planning', 'debugging'],
            },
        ];

        res.json({ success: true, models });
    } catch (error) {
        console.error('[Developer Mode] Get models error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get models' });
    }
});

export default router;

