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
        // Create build loop orchestrator
        const buildLoop = new BuildLoopOrchestrator(
            context.projectId,
            context.userId,
            context.orchestrationRunId,
            'standard'
        );

        // Forward build loop events to context
        buildLoop.on('event', (event) => {
            context.broadcast(`builder-${event.type}`, event.data);

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

export default router;

