/**
 * Unified Execution Router - Three-Mode Architecture
 *
 * Single entry point that routes to the appropriate mode handler:
 * - Builder Mode: Full autonomous build (6-phase loop)
 * - Developer Mode: Iterative code changes with live preview
 * - Agents Mode: Multi-agent parallel execution
 *
 * All modes share:
 * - ExecutionContext with common services
 * - WebSocket for real-time updates
 * - KripToeNite for AI routing
 * - Verification Swarm for quality
 * - Error Escalation for recovery
 */

import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
    createExecutionContext,
    getOrCreateContext,
    getContext,
    shutdownAllContexts,
    type ExecutionMode,
    type ExecutionContext,
} from '../services/core/index.js';
import { BuildLoopOrchestrator } from '../services/automation/build-loop.js';
import { AgentOrchestrator } from '../services/agents/orchestrator.js';
import { getDeveloperModeOrchestrator } from '../services/developer-mode/orchestrator.js';
import { getKripToeNite } from '../services/ai/krip-toe-nite/index.js';
// Rich Context Integration
import {
    loadUnifiedContext,
    formatUnifiedContextForCodeGen,
    type UnifiedContext,
} from '../services/ai/unified-context.js';
import {
    getPredictiveErrorPrevention,
    type PredictionResult,
} from '../services/ai/predictive-error-prevention.js';
// Advanced Orchestration Integration
import {
    createAdvancedOrchestration,
    shutdownOrchestration,
    type AdvancedOrchestrationService,
} from '../services/integration/advanced-orchestration.js';
// P1-2: Notification Service for credential requests and build status
import { getNotificationService } from '../services/notifications/notification-service.js';

const router = Router();

// Track active advanced orchestration instances
const activeOrchestrations = new Map<string, AdvancedOrchestrationService>();

// =============================================================================
// TYPES
// =============================================================================

interface ExecuteRequest {
    mode: ExecutionMode;
    projectId?: string;
    userId: string;
    prompt: string;
    sessionId?: string;
    framework?: string;
    language?: string;
    projectPath?: string;
    options?: {
        forceModel?: string;
        forceStrategy?: string;
        enableVisualVerification?: boolean;
        enableCheckpoints?: boolean;
        // SESSION 5: Human In The Loop toggle
        // When true, enables human checkpoints at key decision points
        // When false (default), runs fully autonomous
        humanInTheLoop?: boolean;
    };
}

interface ExecuteResponse {
    success: boolean;
    sessionId: string;
    projectId: string;
    mode: ExecutionMode;
    websocketChannel: string;
    initialAnalysis?: {
        taskType: string;
        complexity: string;
        strategy: string;
        estimatedCost: number;
    };
    error?: string;
}

// =============================================================================
// EXECUTE ENDPOINT
// =============================================================================

/**
 * POST /api/execute
 *
 * Unified execution endpoint that routes to the appropriate mode handler.
 * Returns immediately with a session ID; actual execution happens via WebSocket.
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const body = req.body as ExecuteRequest;
        const {
            mode,
            userId,
            prompt,
            sessionId = uuidv4(),
            framework = 'react',
            language = 'typescript',
            projectPath,
            options = {},
        } = body;

        // Validate required fields
        if (!mode || !['builder', 'developer', 'agents'].includes(mode)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid mode. Must be "builder", "developer", or "agents".',
            });
        }

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required',
            });
        }

        if (!prompt) {
            return res.status(400).json({
                success: false,
                error: 'prompt is required',
            });
        }

        // Generate or use provided project ID
        const projectId = body.projectId || `project-${uuidv4().slice(0, 8)}`;

        console.log(`[Execute] Starting ${mode} mode for project ${projectId}`);

        // Analyze prompt with KripToeNite to get routing decision
        const ktn = getKripToeNite();
        const analysis = ktn.analyzePrompt(prompt, { projectId, userId, framework, language });

        // Create or get execution context
        const context = getOrCreateContext({
            mode,
            projectId,
            userId,
            sessionId,
            framework,
            language,
            projectPath,
            enableVisualVerification: options.enableVisualVerification ?? true,
            enableCheckpoints: options.enableCheckpoints ?? true,
        });

        // Load unified context for rich code generation
        let enrichedPrompt = prompt;
        let unifiedContext: UnifiedContext | null = null;
        let errorPrediction: PredictionResult | null = null;

        try {
            // Load project context (intent lock, learned patterns, error history, etc.)
            const contextProjectPath = projectPath || `/tmp/builds/${projectId}`;
            unifiedContext = await loadUnifiedContext(projectId, userId, contextProjectPath, {
                includeIntentLock: true,
                includeVerificationResults: true,
                includeLearningData: true,
                includeErrorHistory: true,
                includeProjectAnalysis: true,
                includeUserPreferences: true,
            });

            // Get predictive error prevention analysis
            const errorPrevention = getPredictiveErrorPrevention();
            errorPrediction = await errorPrevention.predict({
                projectId,
                taskType: mode === 'builder' ? 'full_build' : 'code_generation',
                taskDescription: prompt.slice(0, 500),
                recentErrors: [],
            });

            // Enrich prompt with unified context
            const contextBlock = formatUnifiedContextForCodeGen(unifiedContext);
            const preventionGuidance = errorPrediction.predictions.length > 0
                ? `\n\n## PREDICTED ISSUES TO PREVENT:\n${errorPrediction.predictions.map(p =>
                    `- [${p.type.toUpperCase()}] ${p.description} (${Math.round(p.confidence * 100)}% likely)\n  Prevention: ${p.prevention.instruction}`
                  ).join('\n')}`
                : '';

            enrichedPrompt = `${contextBlock}${preventionGuidance}\n\n## USER REQUEST:\n${prompt}`;

            console.log(`[Execute] Loaded context: ${unifiedContext.intentLock ? 'Intent Lock' : 'No Intent'}, ${unifiedContext.learnedPatterns?.length || 0} patterns, ${errorPrediction.predictions.length} predicted issues`);
        } catch (contextError) {
            // Context loading is non-blocking - continue with original prompt
            console.warn('[Execute] Context loading failed, proceeding with basic prompt:', contextError);
        }

        // Broadcast execution start
        context.broadcast('execution-started', {
            mode,
            projectId,
            prompt: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
            analysis: {
                taskType: analysis.analysis.taskType,
                complexity: analysis.analysis.complexity,
                strategy: analysis.decision.strategy,
            },
        });

        // Initialize advanced orchestration for continuous verification, interrupts, etc.
        const advancedOrch = createAdvancedOrchestration({
            projectId,
            userId,
            sessionId,
            enableInterrupts: true,
            enableContinuousVerification: mode === 'builder', // Only for full builds
            enableVideoStreaming: options.enableVisualVerification ?? false,
            enableShadowPatterns: true,
        });

        activeOrchestrations.set(sessionId, advancedOrch);

        // Forward advanced orchestration events to WebSocket
        advancedOrch.on('interrupt', (data) => {
            context.broadcast('interrupt-applied', data);
        });
        advancedOrch.on('verification_result', (data) => {
            context.broadcast('continuous-verification', data);
        });
        advancedOrch.on('verification_issue', (data) => {
            context.broadcast('verification-issue', data);
        });
        advancedOrch.on('video_analysis', (data) => {
            context.broadcast('video-analysis', data);
        });

        // Start execution in background based on mode (using enriched prompt with context)
        setImmediate(async () => {
            try {
                // Initialize advanced orchestration with the prompt
                await advancedOrch.initialize(prompt);

                // Get shadow pattern hints for enhanced routing
                const routingHints = advancedOrch.getRoutingHints();
                if (routingHints.successfulApproaches.length > 0) {
                    context.broadcast('routing-hints', routingHints);
                }

                switch (mode) {
                    case 'builder':
                        await executeBuilderMode(context, enrichedPrompt, options, advancedOrch);
                        break;
                    case 'developer':
                        await executeDeveloperMode(context, enrichedPrompt, options, advancedOrch);
                        break;
                    case 'agents':
                        await executeAgentsMode(context, enrichedPrompt, options, advancedOrch);
                        break;
                }
            } catch (error) {
                console.error(`[Execute] ${mode} mode failed:`, error);
                context.broadcast('execution-error', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            } finally {
                // Cleanup advanced orchestration
                advancedOrch.shutdown();
                activeOrchestrations.delete(sessionId);
            }
        });

        // Return immediately with session info
        const response: ExecuteResponse = {
            success: true,
            sessionId,
            projectId,
            mode,
            websocketChannel: `/ws/context?contextId=${projectId}&userId=${userId}`,
            initialAnalysis: {
                taskType: analysis.analysis.taskType,
                complexity: String(analysis.analysis.complexity),
                strategy: analysis.decision.strategy,
                estimatedCost: analysis.estimatedCost,
            },
        };

        res.json(response);

    } catch (error) {
        console.error('[Execute] Error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// =============================================================================
// MODE-SPECIFIC EXECUTION
// =============================================================================

/**
 * Execute Builder Mode - Full autonomous build
 */
async function executeBuilderMode(
    context: ExecutionContext,
    prompt: string,
    options: ExecuteRequest['options'] = {},
    advancedOrch?: AdvancedOrchestrationService
): Promise<void> {
    console.log(`[Execute:Builder] Starting 6-phase build loop`);

    context.broadcast('builder-started', {
        phases: ['intent_lock', 'initialization', 'parallel_build', 'integration_check', 'functional_test', 'intent_satisfaction', 'browser_demo'],
        advancedFeatures: {
            interrupts: !!advancedOrch,
            continuousVerification: !!advancedOrch,
            shadowPatterns: !!advancedOrch,
        },
    });

    try {
        // Create build loop orchestrator with FULL production mode
        // 'production' mode enables all advanced features:
        // - LATTICE parallel cell building
        // - Browser-in-loop visual verification
        // - Learning Engine pattern injection
        // - Verification Swarm (6-agent verification)
        // - Full parallelism with 6 max agents
        //
        // SESSION 5: Human In The Loop toggle
        // - humanInTheLoop: false (default) = Fully autonomous builds
        // - humanInTheLoop: true = Pause at key decision points for user approval
        const buildLoop = new BuildLoopOrchestrator(
            context.projectId,
            context.userId,
            context.orchestrationRunId,
            'production', // Use full production mode - enables LATTICE, BrowserInLoop, Learning, VerificationSwarm
            {
                humanInTheLoop: options?.humanInTheLoop ?? false,
                projectPath: context.projectPath,
            }
        );

        // Forward build loop events to context
        buildLoop.on('event', (event) => {
            context.broadcast(`builder-${event.type}`, event.data);

            // SESSION 4: Also broadcast live preview events without prefix for direct handling
            const livePreviewEvents = [
                'sandbox-ready',
                'file-modified',
                'visual-verification',
                'agent-progress',
                'build-error'
            ];
            if (livePreviewEvents.includes(event.type)) {
                context.broadcast(event.type, event.data);
            }

            // Update advanced orchestration context on phase changes
            if (advancedOrch && event.type === 'phase_change') {
                advancedOrch.updateContext(event.data.phase);
            }

            // Update files for continuous verification
            if (advancedOrch && event.type === 'file_update') {
                const files = new Map<string, string>();
                if (event.data.files) {
                    for (const [path, content] of Object.entries(event.data.files)) {
                        files.set(path, content as string);
                    }
                    advancedOrch.updateFiles(files);
                }
            }
        });

        // Check for interrupts periodically during build
        if (advancedOrch) {
            buildLoop.on('tool_boundary', async () => {
                const interruptResult = await advancedOrch.checkInterrupts();
                if (interruptResult.shouldHalt) {
                    buildLoop.pause();
                    context.broadcast('builder-halted', {
                        reason: interruptResult.interrupt?.message,
                    });
                } else if (interruptResult.contextToInject) {
                    context.broadcast('context-injected', {
                        context: interruptResult.contextToInject,
                    });
                }
            });
        }

        // Enhance prompt with shadow patterns if available
        const enhancedPrompt = advancedOrch ? advancedOrch.buildEnhancedPrompt(prompt) : prompt;

        // Start the build with enhanced prompt
        await buildLoop.start(enhancedPrompt);

        context.broadcast('builder-completed', {
            status: buildLoop.getState().status,
        });

    } catch (error) {
        // Use error escalation
        const escalationResult = await context.escalation.fixError(
            {
                id: uuidv4(),
                featureId: 'builder-main',
                category: 'runtime_error',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date(),
            },
            new Map()
        );

        if (!escalationResult.success) {
            throw error;
        }

        context.broadcast('builder-error-recovered', {
            level: escalationResult.level,
        });
    }
}

/**
 * Execute Developer Mode - Iterative code changes
 */
async function executeDeveloperMode(
    context: ExecutionContext,
    prompt: string,
    options: ExecuteRequest['options'] = {},
    advancedOrch?: AdvancedOrchestrationService
): Promise<void> {
    console.log(`[Execute:Developer] Starting iterative development`);

    context.broadcast('developer-started', {
        advancedFeatures: {
            interrupts: !!advancedOrch,
            shadowPatterns: !!advancedOrch,
        },
    });

    try {
        // Check for pre-existing interrupts
        if (advancedOrch) {
            const interruptResult = await advancedOrch.checkInterrupts();
            if (interruptResult.shouldHalt) {
                context.broadcast('developer-halted', {
                    reason: interruptResult.interrupt?.message,
                });
                return;
            }
        }

        // Enhance prompt with shadow patterns if available
        let enhancedPrompt = prompt;
        if (advancedOrch) {
            enhancedPrompt = advancedOrch.buildEnhancedPrompt(prompt);
        }

        // Use KTN for code generation
        const result = await context.ktn.buildFeature(enhancedPrompt, {
            projectId: context.projectId,
            userId: context.userId,
            framework: context.framework,
            language: context.language,
        });

        context.broadcast('developer-generated', {
            model: result.model,
            strategy: result.strategy,
            latencyMs: result.latencyMs,
            content: result.content,
        });

        // Update files for verification if available
        if (advancedOrch && result.content) {
            const files = new Map<string, string>();
            // Parse generated content for files (assumes code blocks with file paths)
            const fileMatches = result.content.matchAll(/```(?:typescript|tsx|jsx|javascript|ts|js)\s*\n\/\/\s*(.+?)\n([\s\S]*?)```/g);
            for (const match of fileMatches) {
                const filePath = match[1].trim();
                const fileContent = match[2];
                files.set(filePath, fileContent);
            }
            if (files.size > 0) {
                advancedOrch.updateFiles(files);
            }
        }

        // Run quick verification
        context.broadcast('developer-verifying', {});

        // Check for mid-generation interrupts
        if (advancedOrch) {
            const postGenInterrupt = await advancedOrch.checkInterrupts();
            if (postGenInterrupt.contextToInject) {
                context.broadcast('context-injected', {
                    context: postGenInterrupt.contextToInject,
                });
            }
        }

        context.broadcast('developer-completed', {
            tokensUsed: result.usage.totalTokens,
            cost: result.usage.estimatedCost,
        });

    } catch (error) {
        context.broadcast('developer-error', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}

/**
 * Execute Agents Mode - Multi-agent parallel execution
 */
async function executeAgentsMode(
    context: ExecutionContext,
    prompt: string,
    options: ExecuteRequest['options'] = {},
    advancedOrch?: AdvancedOrchestrationService
): Promise<void> {
    console.log(`[Execute:Agents] Starting multi-agent orchestration`);

    context.broadcast('agents-started', {
        hierarchy: ['queens', 'workers'],
        advancedFeatures: {
            interrupts: !!advancedOrch,
            continuousVerification: !!advancedOrch,
            shadowPatterns: !!advancedOrch,
        },
    });

    try {
        // Check for pre-existing interrupts
        if (advancedOrch) {
            const interruptResult = await advancedOrch.checkInterrupts();
            if (interruptResult.shouldHalt) {
                context.broadcast('agents-halted', {
                    reason: interruptResult.interrupt?.message,
                });
                return;
            }
        }

        // Enhance prompt with shadow patterns if available
        let enhancedPrompt = prompt;
        if (advancedOrch) {
            enhancedPrompt = advancedOrch.buildEnhancedPrompt(prompt);
        }

        // The AgentOrchestrator is designed for context store usage
        // We'll use it indirectly through the context
        const orchestrator = new AgentOrchestrator();

        // Start orchestration via context
        // For now, use KTN for the prompt analysis
        const analysisResult = await context.ktn.plan(enhancedPrompt, {
            projectId: context.projectId,
            userId: context.userId,
            framework: context.framework,
            language: context.language,
        });

        context.broadcast('agents-plan-created', {
            model: analysisResult.model,
            strategy: analysisResult.strategy,
            content: analysisResult.content.substring(0, 500),
        });

        // Check for interrupts between planning and execution
        if (advancedOrch) {
            const midInterrupt = await advancedOrch.checkInterrupts();
            if (midInterrupt.shouldHalt) {
                context.broadcast('agents-halted', {
                    reason: midInterrupt.interrupt?.message,
                    phase: 'post-planning',
                });
                return;
            }
            if (midInterrupt.contextToInject) {
                context.broadcast('context-injected', {
                    context: midInterrupt.contextToInject,
                    phase: 'post-planning',
                });
            }
        }

        // Execute the plan using KTN's buildFeature for each identified task
        const codeResult = await context.ktn.buildFeature(
            `Based on this plan:\n\n${analysisResult.content}\n\nGenerate the code for the first feature.`,
            {
                projectId: context.projectId,
                userId: context.userId,
                framework: context.framework,
                language: context.language,
            }
        );

        // Update files for continuous verification
        if (advancedOrch && codeResult.content) {
            const files = new Map<string, string>();
            const fileMatches = codeResult.content.matchAll(/```(?:typescript|tsx|jsx|javascript|ts|js)\s*\n\/\/\s*(.+?)\n([\s\S]*?)```/g);
            for (const match of fileMatches) {
                const filePath = match[1].trim();
                const fileContent = match[2];
                files.set(filePath, fileContent);
            }
            if (files.size > 0) {
                advancedOrch.updateFiles(files);
            }
        }

        context.broadcast('agents-feature-completed', {
            model: codeResult.model,
            strategy: codeResult.strategy,
        });

        context.broadcast('agents-completed', {});

    } catch (error) {
        context.broadcast('agents-error', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}

// =============================================================================
// STATUS & CONTROL ENDPOINTS
// =============================================================================

/**
 * GET /api/execute/:sessionId/status
 *
 * Get the status of an execution session.
 */
router.get('/:sessionId/status', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { projectId } = req.query;

    if (!projectId || typeof projectId !== 'string') {
        return res.status(400).json({ error: 'projectId query parameter required' });
    }

    const context = getContext(projectId, sessionId);

    if (!context) {
        return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
        success: true,
        mode: context.mode,
        projectId: context.projectId,
        sessionId: context.sessionId,
        isActive: context.isActive,
        createdAt: context.createdAt,
    });
});

/**
 * POST /api/execute/:sessionId/interrupt
 *
 * Send an interrupt to a running execution.
 */
router.post('/:sessionId/interrupt', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { projectId, message, type = 'CONTEXT_ADD' } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }

    const context = getContext(projectId, sessionId);

    if (!context) {
        return res.status(404).json({ error: 'Session not found' });
    }

    try {
        // Submit interrupt (sessionId, message, agentId?)
        const result = await context.interrupts.submitInterrupt(
            sessionId,
            message || 'User interrupt',
            'execution-main' // agentId
        );

        context.broadcast('interrupt-submitted', {
            type: result.type,
            message,
            interruptId: result.id,
        });

        res.json({
            success: true,
            interruptId: result.id,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/execute/:sessionId/stop
 *
 * Stop a running execution.
 */
router.post('/:sessionId/stop', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { projectId } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }

    const context = getContext(projectId, sessionId);

    if (!context) {
        return res.status(404).json({ error: 'Session not found' });
    }

    try {
        await context.shutdown();

        res.json({
            success: true,
            message: 'Execution stopped',
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/execute/:sessionId/checkpoint
 *
 * Create a checkpoint for the current execution.
 */
router.post('/:sessionId/checkpoint', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { projectId, label = 'Manual checkpoint' } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }

    const context = getContext(projectId, sessionId);

    if (!context) {
        return res.status(404).json({ error: 'Session not found' });
    }

    try {
        const checkpointId = await context.createCheckpoint(label);

        res.json({
            success: true,
            checkpointId,
            label,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/execute/:sessionId/restore
 *
 * Restore a checkpoint.
 */
router.post('/:sessionId/restore', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { projectId, checkpointId } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }

    if (!checkpointId) {
        return res.status(400).json({ error: 'checkpointId is required' });
    }

    const context = getContext(projectId, sessionId);

    if (!context) {
        return res.status(404).json({ error: 'Session not found' });
    }

    try {
        await context.restoreCheckpoint(checkpointId);

        res.json({
            success: true,
            message: 'Checkpoint restored',
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/execute/modes
 *
 * Get information about available execution modes.
 */
router.get('/modes', (_req: Request, res: Response) => {
    res.json({
        success: true,
        modes: [
            {
                id: 'builder',
                name: 'Builder Mode',
                description: 'Full autonomous build with 6-phase loop',
                features: ['Intent Lock', 'Verification Swarm', 'Browser Demo'],
                useCases: ['New projects', 'Complete features', 'Full stack apps'],
            },
            {
                id: 'developer',
                name: 'Developer Mode',
                description: 'Iterative code changes with live preview',
                features: ['Code Editor', 'Live Preview', 'Soft Interrupts'],
                useCases: ['Bug fixes', 'Small changes', 'Code iteration'],
            },
            {
                id: 'agents',
                name: 'Agents Mode',
                description: 'Multi-agent parallel execution',
                features: ['Queen/Worker Hierarchy', 'Parallel Sandboxes', 'Agent Control'],
                useCases: ['Complex features', 'Large refactors', 'Multi-file changes'],
            },
        ],
    });
});

// =============================================================================
// PLAN APPROVAL WORKFLOW (P0 - Builder View Parity with Feature Agent)
// =============================================================================

// In-memory store for pending builds awaiting plan approval or credentials
// In production, this would be in a database for persistence across restarts
interface PendingBuild {
    sessionId: string;
    projectId: string;
    userId: string;
    prompt: string;
    plan: BuildPlan;
    requiredCredentials: RequiredCredential[];
    createdAt: Date;
    status: 'awaiting_plan_approval' | 'awaiting_credentials' | 'building' | 'complete' | 'failed';
    approvedPlan?: BuildPlan;
    credentials?: Record<string, string>;
}

interface BuildPlan {
    intentSummary: string;
    phases: PlanPhase[];
    estimatedTokenUsage: number;
    estimatedCostUSD: number;
    parallelAgentsNeeded: number;
    frontendFirst: boolean;
    backendFirst: boolean;
    parallelFrontendBackend: boolean;
}

interface PlanPhase {
    id: string;
    title: string;
    description: string;
    icon: string;
    type: 'frontend' | 'backend';
    steps: PlanStep[];
    order: number;
    approved: boolean;
}

interface PlanStep {
    id: string;
    description: string;
    type: 'code' | 'config' | 'test' | 'deploy';
    estimatedTokens: number;
}

interface RequiredCredential {
    id: string;
    name: string;
    description: string;
    envVariableName: string;
    platformName: string;
    platformUrl: string;
    required: boolean;
}

const pendingBuilds = new Map<string, PendingBuild>();

// Credential detection patterns
const CREDENTIAL_PATTERNS: Record<string, { name: string; envVar: string; platform: string; url: string }[]> = {
    stripe: [
        { name: 'Stripe Secret Key', envVar: 'STRIPE_SECRET_KEY', platform: 'Stripe', url: 'https://dashboard.stripe.com/apikeys' },
        { name: 'Stripe Publishable Key', envVar: 'STRIPE_PUBLISHABLE_KEY', platform: 'Stripe', url: 'https://dashboard.stripe.com/apikeys' },
    ],
    openai: [
        { name: 'OpenAI API Key', envVar: 'OPENAI_API_KEY', platform: 'OpenAI', url: 'https://platform.openai.com/api-keys' },
    ],
    anthropic: [
        { name: 'Anthropic API Key', envVar: 'ANTHROPIC_API_KEY', platform: 'Anthropic', url: 'https://console.anthropic.com/settings/keys' },
    ],
    supabase: [
        { name: 'Supabase URL', envVar: 'SUPABASE_URL', platform: 'Supabase', url: 'https://app.supabase.com/project/_/settings/api' },
        { name: 'Supabase Anon Key', envVar: 'SUPABASE_ANON_KEY', platform: 'Supabase', url: 'https://app.supabase.com/project/_/settings/api' },
    ],
    firebase: [
        { name: 'Firebase API Key', envVar: 'FIREBASE_API_KEY', platform: 'Firebase', url: 'https://console.firebase.google.com/project/_/settings/general' },
    ],
    github: [
        { name: 'GitHub Token', envVar: 'GITHUB_TOKEN', platform: 'GitHub', url: 'https://github.com/settings/tokens' },
    ],
    aws: [
        { name: 'AWS Access Key ID', envVar: 'AWS_ACCESS_KEY_ID', platform: 'AWS', url: 'https://console.aws.amazon.com/iam/home#/security_credentials' },
        { name: 'AWS Secret Access Key', envVar: 'AWS_SECRET_ACCESS_KEY', platform: 'AWS', url: 'https://console.aws.amazon.com/iam/home#/security_credentials' },
    ],
    sendgrid: [
        { name: 'SendGrid API Key', envVar: 'SENDGRID_API_KEY', platform: 'SendGrid', url: 'https://app.sendgrid.com/settings/api_keys' },
    ],
    twilio: [
        { name: 'Twilio Account SID', envVar: 'TWILIO_ACCOUNT_SID', platform: 'Twilio', url: 'https://console.twilio.com/' },
        { name: 'Twilio Auth Token', envVar: 'TWILIO_AUTH_TOKEN', platform: 'Twilio', url: 'https://console.twilio.com/' },
    ],
    clerk: [
        { name: 'Clerk Publishable Key', envVar: 'CLERK_PUBLISHABLE_KEY', platform: 'Clerk', url: 'https://dashboard.clerk.com/' },
        { name: 'Clerk Secret Key', envVar: 'CLERK_SECRET_KEY', platform: 'Clerk', url: 'https://dashboard.clerk.com/' },
    ],
    auth0: [
        { name: 'Auth0 Domain', envVar: 'AUTH0_DOMAIN', platform: 'Auth0', url: 'https://manage.auth0.com/' },
        { name: 'Auth0 Client ID', envVar: 'AUTH0_CLIENT_ID', platform: 'Auth0', url: 'https://manage.auth0.com/' },
    ],
    resend: [
        { name: 'Resend API Key', envVar: 'RESEND_API_KEY', platform: 'Resend', url: 'https://resend.com/api-keys' },
    ],
    openrouter: [
        { name: 'OpenRouter API Key', envVar: 'OPENROUTER_API_KEY', platform: 'OpenRouter', url: 'https://openrouter.ai/keys' },
    ],
};

/**
 * Detect required credentials from prompt
 */
function detectRequiredCredentials(prompt: string): RequiredCredential[] {
    const credentials: RequiredCredential[] = [];
    const promptLower = prompt.toLowerCase();
    const seenEnvVars = new Set<string>();

    for (const [keyword, creds] of Object.entries(CREDENTIAL_PATTERNS)) {
        if (promptLower.includes(keyword)) {
            for (const cred of creds) {
                if (!seenEnvVars.has(cred.envVar)) {
                    seenEnvVars.add(cred.envVar);
                    credentials.push({
                        id: `cred-${uuidv4().slice(0, 8)}`,
                        name: cred.name,
                        description: `Required for ${cred.platform} integration`,
                        envVariableName: cred.envVar,
                        platformName: cred.platform,
                        platformUrl: cred.url,
                        required: true,
                    });
                }
            }
        }
    }

    // Additional pattern matching for common integrations
    const additionalPatterns = [
        { pattern: /payment|checkout|subscription|billing/i, service: 'stripe' },
        { pattern: /ai|gpt|claude|llm|chat.*bot/i, service: 'openai' },
        { pattern: /email|newsletter|notification/i, service: 'sendgrid' },
        { pattern: /sms|text.*message|phone/i, service: 'twilio' },
        { pattern: /auth|login|signup|user.*account/i, service: 'clerk' },
        { pattern: /database|realtime|backend.*as.*service/i, service: 'supabase' },
        { pattern: /cloud.*storage|s3|file.*upload/i, service: 'aws' },
    ];

    for (const { pattern, service } of additionalPatterns) {
        if (pattern.test(prompt) && CREDENTIAL_PATTERNS[service]) {
            for (const cred of CREDENTIAL_PATTERNS[service]) {
                if (!seenEnvVars.has(cred.envVar)) {
                    seenEnvVars.add(cred.envVar);
                    credentials.push({
                        id: `cred-${uuidv4().slice(0, 8)}`,
                        name: cred.name,
                        description: `Required for ${cred.platform} integration`,
                        envVariableName: cred.envVar,
                        platformName: cred.platform,
                        platformUrl: cred.url,
                        required: true,
                    });
                }
            }
        }
    }

    return credentials;
}

/**
 * Generate implementation plan from prompt using AI
 */
async function generateBuildPlan(prompt: string, projectId: string, userId: string): Promise<BuildPlan> {
    const ktn = getKripToeNite();
    const analysis = ktn.analyzePrompt(prompt, { projectId, userId, framework: 'react', language: 'typescript' });

    // Generate phases based on analysis
    const phases: PlanPhase[] = [];
    let order = 0;

    // Frontend phases
    phases.push({
        id: `phase-${uuidv4().slice(0, 8)}`,
        title: 'UI Framework & Styling',
        description: 'Set up React with Tailwind CSS and premium component library',
        icon: 'Code',
        type: 'frontend',
        order: order++,
        approved: false,
        steps: [
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Initialize React project with Vite', type: 'code', estimatedTokens: 2000 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Configure Tailwind CSS with custom theme', type: 'config', estimatedTokens: 1500 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Set up Radix UI component library', type: 'code', estimatedTokens: 3000 },
        ],
    });

    phases.push({
        id: `phase-${uuidv4().slice(0, 8)}`,
        title: 'Core Components',
        description: 'Build reusable UI components following design system',
        icon: 'Palette',
        type: 'frontend',
        order: order++,
        approved: false,
        steps: [
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Create layout components (Header, Sidebar, Footer)', type: 'code', estimatedTokens: 4000 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Build form components with validation', type: 'code', estimatedTokens: 3500 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Implement data display components', type: 'code', estimatedTokens: 3000 },
        ],
    });

    phases.push({
        id: `phase-${uuidv4().slice(0, 8)}`,
        title: 'Page Routes & Navigation',
        description: 'Set up routing and main application pages',
        icon: 'Zap',
        type: 'frontend',
        order: order++,
        approved: false,
        steps: [
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Configure React Router with protected routes', type: 'code', estimatedTokens: 2500 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Build main application pages', type: 'code', estimatedTokens: 8000 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Add page transitions and loading states', type: 'code', estimatedTokens: 2000 },
        ],
    });

    // Backend phases
    phases.push({
        id: `phase-${uuidv4().slice(0, 8)}`,
        title: 'Database & ORM',
        description: 'Set up Turso SQLite with Drizzle ORM',
        icon: 'Database',
        type: 'backend',
        order: order++,
        approved: false,
        steps: [
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Configure Turso connection', type: 'config', estimatedTokens: 1000 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Define database schema with Drizzle', type: 'code', estimatedTokens: 4000 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Create migration scripts', type: 'code', estimatedTokens: 1500 },
        ],
    });

    phases.push({
        id: `phase-${uuidv4().slice(0, 8)}`,
        title: 'API Routes & Services',
        description: 'Build Express API with authentication',
        icon: 'Server',
        type: 'backend',
        order: order++,
        approved: false,
        steps: [
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Set up Express with middleware', type: 'code', estimatedTokens: 2000 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Create CRUD API endpoints', type: 'code', estimatedTokens: 6000 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Implement authentication with Better Auth', type: 'code', estimatedTokens: 4000 },
        ],
    });

    phases.push({
        id: `phase-${uuidv4().slice(0, 8)}`,
        title: 'Deployment Configuration',
        description: 'Configure Vercel deployment with environment setup',
        icon: 'Shield',
        type: 'backend',
        order: order++,
        approved: false,
        steps: [
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Create Vercel configuration', type: 'config', estimatedTokens: 800 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Set up environment variables', type: 'config', estimatedTokens: 500 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Configure build and deploy scripts', type: 'config', estimatedTokens: 600 },
        ],
    });

    // Calculate totals
    const totalTokens = phases.reduce((sum, phase) =>
        sum + phase.steps.reduce((stepSum, step) => stepSum + step.estimatedTokens, 0), 0
    );

    return {
        intentSummary: `Building: ${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}`,
        phases,
        estimatedTokenUsage: totalTokens,
        estimatedCostUSD: (totalTokens / 1000) * 0.015, // Approximate cost
        parallelAgentsNeeded: Math.min(5, Math.ceil(phases.length / 2)),
        frontendFirst: true,
        backendFirst: false,
        parallelFrontendBackend: analysis.analysis.complexity === 'medium',
    };
}

/**
 * POST /api/execute/plan
 *
 * Generate implementation plan and detect required credentials.
 * This is the first step in the multi-step build workflow.
 */
router.post('/plan', async (req: Request, res: Response) => {
    try {
        const { userId, projectId = `project-${uuidv4().slice(0, 8)}`, prompt } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }
        if (!prompt) {
            return res.status(400).json({ success: false, error: 'prompt is required' });
        }

        const sessionId = uuidv4();
        console.log(`[Execute:Plan] Generating plan for session ${sessionId}`);

        // Generate the implementation plan
        const plan = await generateBuildPlan(prompt, projectId, userId);

        // Detect required credentials
        const requiredCredentials = detectRequiredCredentials(prompt);

        // Store the pending build
        const pendingBuild: PendingBuild = {
            sessionId,
            projectId,
            userId,
            prompt,
            plan,
            requiredCredentials,
            createdAt: new Date(),
            status: 'awaiting_plan_approval',
        };
        pendingBuilds.set(sessionId, pendingBuild);

        res.json({
            success: true,
            sessionId,
            projectId,
            plan,
            requiredCredentials,
        });

    } catch (error) {
        console.error('[Execute:Plan] Error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/execute/plan/:sessionId/approve
 *
 * Approve the plan and optionally provide credentials, then start the build.
 */
router.post('/plan/:sessionId/approve', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const { approvedPhases, credentials } = req.body;

        const pendingBuild = pendingBuilds.get(sessionId);
        if (!pendingBuild) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }

        // Update phase approvals
        if (approvedPhases && Array.isArray(approvedPhases)) {
            for (const phase of pendingBuild.plan.phases) {
                phase.approved = approvedPhases.includes(phase.id);
            }
        } else {
            // Approve all phases if not specified
            for (const phase of pendingBuild.plan.phases) {
                phase.approved = true;
            }
        }

        pendingBuild.approvedPlan = pendingBuild.plan;

        // Check if credentials are required but not provided
        if (pendingBuild.requiredCredentials.length > 0 && !credentials) {
            pendingBuild.status = 'awaiting_credentials';
            pendingBuilds.set(sessionId, pendingBuild);

            // P1-2: Create notification for credential request
            const notificationService = getNotificationService();
            await notificationService.sendNotification(
                pendingBuild.userId,
                ['push', 'email'],
                {
                    type: 'credentials_needed',
                    title: 'Credentials Required',
                    message: `Your build "${pendingBuild.plan.intentSummary?.slice(0, 50) || 'Your app'}..." needs ${pendingBuild.requiredCredentials.length} credential${pendingBuild.requiredCredentials.length > 1 ? 's' : ''} to continue. Build is paused until credentials are provided.`,
                    featureAgentId: sessionId,
                    featureAgentName: 'Build Orchestrator',
                    actionUrl: `/builder/${pendingBuild.projectId}?resumeBuild=${sessionId}`,
                    metadata: {
                        projectId: pendingBuild.projectId,
                        sessionId,
                        requiredCredentials: pendingBuild.requiredCredentials.map(c => c.name),
                        buildPaused: true,
                    },
                }
            );

            return res.json({
                success: true,
                status: 'awaiting_credentials',
                requiredCredentials: pendingBuild.requiredCredentials,
            });
        }

        // Store credentials if provided
        if (credentials) {
            pendingBuild.credentials = credentials;
        }

        pendingBuild.status = 'building';
        pendingBuilds.set(sessionId, pendingBuild);

        // Start the actual build in the background
        const context = getOrCreateContext({
            mode: 'builder',
            projectId: pendingBuild.projectId,
            userId: pendingBuild.userId,
            sessionId,
            framework: 'react',
            language: 'typescript',
            enableVisualVerification: true,
            enableCheckpoints: true,
        });

        // Store credentials in context for the build
        if (pendingBuild.credentials) {
            (context as unknown as { credentials: Record<string, string> }).credentials = pendingBuild.credentials;
        }

        // Start build in background
        setImmediate(async () => {
            try {
                const buildLoop = new BuildLoopOrchestrator(
                    context.projectId,
                    context.userId,
                    context.orchestrationRunId,
                    'production',
                    {
                        humanInTheLoop: false,
                        projectPath: context.projectPath,
                        approvedPlan: pendingBuild.approvedPlan,
                        credentials: pendingBuild.credentials,
                    }
                );

                buildLoop.on('event', (event) => {
                    context.broadcast(`builder-${event.type}`, event.data);
                });

                await buildLoop.start(pendingBuild.prompt);

                pendingBuild.status = 'complete';
                pendingBuilds.set(sessionId, pendingBuild);

                context.broadcast('builder-completed', {
                    status: 'complete',
                    projectId: pendingBuild.projectId,
                });

            } catch (error) {
                console.error(`[Execute:Plan:Approve] Build failed:`, error);
                pendingBuild.status = 'failed';
                pendingBuilds.set(sessionId, pendingBuild);
                context.broadcast('builder-error', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });

        res.json({
            success: true,
            status: 'building',
            projectId: pendingBuild.projectId,
            websocketChannel: `/ws/context?contextId=${pendingBuild.projectId}&userId=${pendingBuild.userId}`,
        });

    } catch (error) {
        console.error('[Execute:Plan:Approve] Error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/execute/plan/:sessionId/credentials
 *
 * Submit credentials for a pending build and start the build.
 */
router.post('/plan/:sessionId/credentials', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const { credentials } = req.body;

        const pendingBuild = pendingBuilds.get(sessionId);
        if (!pendingBuild) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }

        if (pendingBuild.status !== 'awaiting_credentials') {
            return res.status(400).json({
                success: false,
                error: `Build is not awaiting credentials. Current status: ${pendingBuild.status}`,
            });
        }

        // Store credentials
        pendingBuild.credentials = credentials;
        pendingBuild.status = 'building';
        pendingBuilds.set(sessionId, pendingBuild);

        // P1-2: Create notification that build is resuming
        const notificationService = getNotificationService();
        await notificationService.sendNotification(
            pendingBuild.userId,
            ['push'],
            {
                type: 'build_resumed',
                title: 'Build Resumed',
                message: `Credentials received! Your build "${pendingBuild.plan.intentSummary?.slice(0, 40) || 'Your app'}..." is now running.`,
                featureAgentId: sessionId,
                featureAgentName: 'Build Orchestrator',
                actionUrl: `/builder/${pendingBuild.projectId}`,
                metadata: {
                    projectId: pendingBuild.projectId,
                    sessionId,
                    credentialsProvided: Object.keys(credentials).length,
                },
            }
        );

        // Start the actual build
        const context = getOrCreateContext({
            mode: 'builder',
            projectId: pendingBuild.projectId,
            userId: pendingBuild.userId,
            sessionId,
            framework: 'react',
            language: 'typescript',
            enableVisualVerification: true,
            enableCheckpoints: true,
        });

        // Store credentials in context
        (context as unknown as { credentials: Record<string, string> }).credentials = credentials;

        // Start build in background
        setImmediate(async () => {
            try {
                const buildLoop = new BuildLoopOrchestrator(
                    context.projectId,
                    context.userId,
                    context.orchestrationRunId,
                    'production',
                    {
                        humanInTheLoop: false,
                        projectPath: context.projectPath,
                        approvedPlan: pendingBuild.approvedPlan,
                        credentials: pendingBuild.credentials,
                    }
                );

                buildLoop.on('event', (event) => {
                    context.broadcast(`builder-${event.type}`, event.data);
                });

                await buildLoop.start(pendingBuild.prompt);

                pendingBuild.status = 'complete';
                pendingBuilds.set(sessionId, pendingBuild);

                // P1-2: Create notification for build completion (via credentials flow)
                const notifService = getNotificationService();
                await notifService.sendNotification(
                    pendingBuild.userId,
                    ['push', 'email'],
                    {
                        type: 'build_complete',
                        title: 'Build Complete!',
                        message: `Your app "${pendingBuild.plan.intentSummary?.slice(0, 40) || 'Your app'}..." is ready. Click to see it in action!`,
                        featureAgentId: sessionId,
                        featureAgentName: 'Build Orchestrator',
                        actionUrl: `/builder/${pendingBuild.projectId}?showDemo=true`,
                        metadata: {
                            projectId: pendingBuild.projectId,
                            sessionId,
                            buildComplete: true,
                        },
                    }
                );

                context.broadcast('builder-completed', {
                    status: 'complete',
                    projectId: pendingBuild.projectId,
                });

            } catch (error) {
                console.error(`[Execute:Credentials] Build failed:`, error);
                pendingBuild.status = 'failed';
                pendingBuilds.set(sessionId, pendingBuild);
                context.broadcast('builder-error', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });

        res.json({
            success: true,
            status: 'building',
            projectId: pendingBuild.projectId,
            websocketChannel: `/ws/context?contextId=${pendingBuild.projectId}&userId=${pendingBuild.userId}`,
        });

    } catch (error) {
        console.error('[Execute:Credentials] Error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/execute/active
 *
 * Get all active builds for a user (for rejoin capability).
 */
router.get('/active', (req: Request, res: Response) => {
    const userId = req.query.userId as string;

    if (!userId) {
        return res.status(400).json({ success: false, error: 'userId query parameter required' });
    }

    const activeBuilds: Array<{
        sessionId: string;
        projectId: string;
        status: string;
        prompt: string;
        createdAt: Date;
        websocketChannel: string;
    }> = [];

    for (const [sessionId, build] of pendingBuilds.entries()) {
        if (build.userId === userId && build.status === 'building') {
            activeBuilds.push({
                sessionId,
                projectId: build.projectId,
                status: build.status,
                prompt: build.prompt.slice(0, 100) + (build.prompt.length > 100 ? '...' : ''),
                createdAt: build.createdAt,
                websocketChannel: `/ws/context?contextId=${build.projectId}&userId=${build.userId}`,
            });
        }
    }

    res.json({
        success: true,
        activeBuilds,
    });
});

/**
 * GET /api/execute/plan/:sessionId
 *
 * Get the status of a pending build.
 */
router.get('/plan/:sessionId', (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const pendingBuild = pendingBuilds.get(sessionId);
    if (!pendingBuild) {
        return res.status(404).json({ success: false, error: 'Session not found' });
    }

    res.json({
        success: true,
        sessionId,
        projectId: pendingBuild.projectId,
        status: pendingBuild.status,
        plan: pendingBuild.plan,
        requiredCredentials: pendingBuild.requiredCredentials,
        createdAt: pendingBuild.createdAt,
    });
});

export default router;

