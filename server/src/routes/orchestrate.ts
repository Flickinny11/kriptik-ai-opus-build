/**
 * @deprecated These routes are deprecated. Use /api/execute instead.
 *
 * Orchestration API Routes (LEGACY)
 *
 * Endpoints for the Development Orchestrator to:
 * - Process project requests
 * - Execute plans
 * - Stream events to frontend
 * - Manage agent status
 *
 * DEPRECATION NOTICE: All new code should use /api/execute which routes to
 * BuildLoopOrchestrator with full production features (LATTICE, BrowserInLoop,
 * Learning Engine, Verification Swarm).
 *
 * UNIFIED CONTEXT: All code generation routes now automatically
 * load and inject rich context including:
 * - Intent Lock (sacred contract)
 * - Verification swarm results
 * - Tournament/judge winning patterns
 * - Learning engine patterns and strategies
 * - Error escalation history
 * - Anti-slop rules
 * - User preferences
 */

import { Router, Request, Response } from 'express';
import { DevelopmentOrchestrator, ProjectRequest } from '../services/orchestration/index.js';
import { createOrchestratorClaudeService } from '../services/ai/claude-service.js';
import { v4 as uuidv4 } from 'uuid';
import {
    loadUnifiedContext,
    formatUnifiedContextForCodeGen,
    formatUnifiedContextSummary,
    type UnifiedContext,
} from '../services/ai/unified-context.js';

const router = Router();

// DEPRECATION: Add warning header to all routes in this file
router.use((_req: Request, res: Response, next) => {
    console.warn('[DEPRECATED] /api/orchestrate/* routes are deprecated. Use /api/execute instead.');
    res.setHeader('X-Deprecated', 'Use /api/execute instead');
    next();
});

// Store active orchestrators per project
const orchestrators = new Map<string, DevelopmentOrchestrator>();

// Store loaded unified contexts per project
const projectContexts = new Map<string, UnifiedContext>();

/**
 * Load unified context for a project
 */
async function loadContextForProject(projectId: string, userId: string): Promise<UnifiedContext | null> {
    try {
        // Check cache first
        const cached = projectContexts.get(projectId);
        if (cached) {
            return cached;
        }

        // Load fresh context
        const projectPath = `/tmp/kriptik-projects/${projectId}`;
        const context = await loadUnifiedContext(projectId, userId, projectPath);
        projectContexts.set(projectId, context);

        console.log(`[Orchestrate] Loaded unified context for ${projectId}: ${context.learnedPatterns.length} patterns, ${context.verificationResults.length} verification results`);

        return context;
    } catch (error) {
        console.warn(`[Orchestrate] Failed to load unified context for ${projectId}:`, error);
        return null;
    }
}

/**
 * Enrich a prompt with unified context
 */
function enrichPromptWithContext(prompt: string, context: UnifiedContext | null): string {
    if (!context) return prompt;

    const contextSection = formatUnifiedContextForCodeGen(context);

    return `# KRIPTIK AI ORCHESTRATION - RICH CONTEXT

${contextSection}

---

# YOUR TASK

${prompt}`;
}

/**
 * POST /api/orchestrate/analyze
 * Analyze a project request and create an execution plan
 *
 * UNIFIED CONTEXT: Automatically loads rich project context including
 * learned patterns, verification results, error history, and more.
 */
router.post('/analyze', async (req: Request, res: Response) => {
    try {
        const { prompt, projectName, projectId, constraints, userId } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const id = projectId || uuidv4();

        // CRITICAL: Load unified context for rich code generation
        let unifiedContext: UnifiedContext | null = null;
        if (userId) {
            unifiedContext = await loadContextForProject(id, userId);
        }

        const claudeService = createOrchestratorClaudeService();
        const orchestrator = new DevelopmentOrchestrator(claudeService, {
            maxConcurrentTasks: 4,
            qualityGateEnabled: true,
            autoDeployEnabled: false,
        });

        // Store orchestrator for later execution
        orchestrators.set(id, orchestrator);

        // Enrich the prompt with unified context
        const enrichedPrompt = enrichPromptWithContext(prompt, unifiedContext);

        const request: ProjectRequest = {
            prompt: enrichedPrompt,
            projectName: projectName || `Project ${Date.now()}`,
            projectId: id,
            constraints,
        };

        const plan = await orchestrator.processRequest(request);

        res.json({
            success: true,
            projectId: id,
            plan,
            agents: orchestrator.getAgents(),
            contextSummary: unifiedContext ? formatUnifiedContextSummary(unifiedContext) : null,
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
 * Execute the plan with SSE streaming
 */
router.post('/:projectId/execute', async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { userId } = req.body;

    const orchestrator = orchestrators.get(projectId);
    if (!orchestrator) {
        return res.status(404).json({ error: 'Project not found. Run analyze first.' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (eventType: string, data: unknown) => {
        res.write(`event: ${eventType}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Load unified context for rich execution
    try {
        const unifiedContext = await loadContextForProject(projectId, userId || 'system');
        if (unifiedContext) {
            const contextSummary = formatUnifiedContextSummary(unifiedContext);
            sendEvent('context-loaded', {
                summary: contextSummary,
                patternsCount: unifiedContext.learnedPatterns.length,
                hasIntentLock: !!unifiedContext.intentLock,
                strategiesCount: unifiedContext.activeStrategies.size,
            });

            // Inject context into orchestrator if it supports it
            if ('setUnifiedContext' in orchestrator && typeof orchestrator.setUnifiedContext === 'function') {
                (orchestrator as any).setUnifiedContext(unifiedContext);
            }
        }
    } catch (contextError) {
        sendEvent('context-warning', {
            message: 'Unified context loading failed, proceeding without enrichment',
            error: contextError instanceof Error ? contextError.message : 'Unknown error',
        });
    }

    // Subscribe to orchestrator events
    orchestrator.on('event', (event) => {
        sendEvent(event.type, event);
    });

    orchestrator.on('log', (log) => {
        sendEvent('log', log);
    });

    try {
        await orchestrator.executePlan();
        sendEvent('complete', {
            success: true,
            plan: orchestrator.getPlan(),
            context: orchestrator.getContext(),
        });
    } catch (error) {
        sendEvent('error', {
            success: false,
            message: error instanceof Error ? error.message : String(error),
        });
    } finally {
        res.end();
    }
});

/**
 * GET /api/orchestrate/:projectId/status
 * Get current orchestrator status
 */
router.get('/:projectId/status', (req: Request, res: Response) => {
    const { projectId } = req.params;

    const orchestrator = orchestrators.get(projectId);
    if (!orchestrator) {
        return res.status(404).json({ error: 'Project not found' });
    }

    res.json({
        plan: orchestrator.getPlan(),
        agents: orchestrator.getAgents(),
        context: orchestrator.getContext(),
    });
});

/**
 * GET /api/orchestrate/:projectId/artifacts
 * Get all generated artifacts
 */
router.get('/:projectId/artifacts', (req: Request, res: Response) => {
    const { projectId } = req.params;

    const orchestrator = orchestrators.get(projectId);
    if (!orchestrator) {
        return res.status(404).json({ error: 'Project not found' });
    }

    const plan = orchestrator.getPlan();
    if (!plan) {
        return res.json({ artifacts: [] });
    }

    const artifacts = plan.phases.flatMap(phase =>
        phase.tasks.flatMap(task => task.artifacts)
    );

    res.json({ artifacts });
});

/**
 * POST /api/orchestrate/:projectId/pause
 * Pause execution
 */
router.post('/:projectId/pause', (req: Request, res: Response) => {
    const { projectId } = req.params;

    const orchestrator = orchestrators.get(projectId);
    if (!orchestrator) {
        return res.status(404).json({ error: 'Project not found' });
    }

    orchestrator.pause();
    res.json({ success: true, message: 'Execution paused' });
});

/**
 * POST /api/orchestrate/:projectId/resume
 * Resume execution
 */
router.post('/:projectId/resume', async (req: Request, res: Response) => {
    const { projectId } = req.params;

    const orchestrator = orchestrators.get(projectId);
    if (!orchestrator) {
        return res.status(404).json({ error: 'Project not found' });
    }

    // Set up SSE for resumed execution
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (eventType: string, data: unknown) => {
        res.write(`event: ${eventType}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    orchestrator.on('event', (event) => {
        sendEvent(event.type, event);
    });

    try {
        await orchestrator.resume();
        sendEvent('complete', { success: true });
    } catch (error) {
        sendEvent('error', {
            message: error instanceof Error ? error.message : String(error),
        });
    } finally {
        res.end();
    }
});

/**
 * DELETE /api/orchestrate/:projectId
 * Stop and cleanup orchestrator
 */
router.delete('/:projectId', async (req: Request, res: Response) => {
    const { projectId } = req.params;

    const orchestrator = orchestrators.get(projectId);
    if (!orchestrator) {
        return res.status(404).json({ error: 'Project not found' });
    }

    await orchestrator.stop();
    orchestrators.delete(projectId);

    res.json({ success: true, message: 'Orchestrator stopped and cleaned up' });
});

/**
 * GET /api/orchestrate/:projectId/stream
 * Real-time event stream for an active orchestrator
 */
router.get('/:projectId/stream', (req: Request, res: Response) => {
    const { projectId } = req.params;

    const orchestrator = orchestrators.get(projectId);
    if (!orchestrator) {
        return res.status(404).json({ error: 'Project not found' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (eventType: string, data: unknown) => {
        res.write(`event: ${eventType}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial status
    sendEvent('status', {
        plan: orchestrator.getPlan(),
        agents: orchestrator.getAgents(),
    });

    // Subscribe to events
    const eventHandler = (event: unknown) => sendEvent('event', event);
    const logHandler = (log: unknown) => sendEvent('log', log);

    orchestrator.on('event', eventHandler);
    orchestrator.on('log', logHandler);

    // Cleanup on disconnect
    req.on('close', () => {
        orchestrator.off('event', eventHandler);
        orchestrator.off('log', logHandler);
    });
});

/**
 * GET /api/orchestrate/:projectId/neural-pathway
 * Real-time SSE stream for Neural Pathway visualization
 * Transforms orchestrator events into pathway node updates
 */
router.get('/:projectId/neural-pathway', (req: Request, res: Response) => {
    const { projectId } = req.params;

    const orchestrator = orchestrators.get(projectId);
    if (!orchestrator) {
        return res.status(404).json({ error: 'Project not found' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendPathwayEvent = (type: string, data: Record<string, unknown>) => {
        const event = {
            type,
            timestamp: Date.now(),
            sessionId: projectId,
            data,
        };
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // Map orchestrator event types to neural pathway node IDs
    const eventToNodeMap: Record<string, string> = {
        'intent_lock': 'intent-lock',
        'feature_decomposition': 'feature-decomp',
        'parallel_build_start': 'agent-1',
        'agent_assigned': 'agent-1',
        'code_generation': 'code-gen',
        'file_update': 'code-gen',
        'verification': 'verification',
        'build': 'build',
        'deploy': 'deploy',
        'complete': 'complete',
    };

    // Map phase names to node IDs
    const phaseToNodeMap: Record<string, string> = {
        'Phase0_IntentLock': 'intent-lock',
        'Phase1_Scaffold': 'feature-decomp',
        'Phase2_ParallelBuild': 'agent-1',
        'Phase3_Verification': 'verification',
        'Phase4_Iteration': 'build',
        'Phase5_Ship': 'deploy',
    };

    // Send initial connected event
    sendPathwayEvent('connected', { message: 'Neural pathway connected' });

    // Transform orchestrator events to pathway events
    const eventHandler = (event: { type: string; data?: Record<string, unknown> }) => {
        const nodeId = eventToNodeMap[event.type];

        if (event.type === 'phase_start' || event.type === 'phase_complete') {
            const phase = event.data?.phase || event.data?.stage;
            const mappedNodeId = phase ? phaseToNodeMap[phase as string] : undefined;

            if (mappedNodeId) {
                if (event.type === 'phase_start') {
                    sendPathwayEvent('phase_change', {
                        phase: `${phase}_start`,
                        nodeId: mappedNodeId,
                        message: `Starting ${phase}`,
                    });
                } else {
                    sendPathwayEvent('phase_change', {
                        phase: `${phase}_complete`,
                        nodeId: mappedNodeId,
                        message: `Completed ${phase}`,
                    });
                }
            }
        } else if (nodeId) {
            sendPathwayEvent('node_update', {
                nodeId,
                node: {
                    status: event.type.includes('complete') ? 'complete' : 'active',
                    summary: event.data?.message || event.data?.description,
                },
            });
        }

        // Forward progress events
        if (event.type === 'progress' && event.data?.progress !== undefined) {
            sendPathwayEvent('progress', {
                progress: event.data.progress,
            });
        }

        // Forward agent activity
        if (event.type === 'agent-progress' && event.data?.slotId) {
            const slotId = event.data.slotId as number;
            const agentNodeId = `agent-${Math.min(slotId + 1, 3)}`;
            sendPathwayEvent('node_update', {
                nodeId: agentNodeId,
                node: {
                    status: event.data.type === 'task_completed' ? 'complete' : 'active',
                    summary: event.data.description || `Agent ${slotId + 1} working`,
                    details: {
                        agentInfo: {
                            agentId: event.data.agentId,
                            tokensUsed: event.data.tokensUsed || 0,
                        },
                    },
                },
            });
        }

        // Forward file updates to code-gen node
        if (event.type === 'file_update' && event.data?.files) {
            const files = event.data.files as Record<string, string>;
            sendPathwayEvent('node_update', {
                nodeId: 'code-gen',
                node: {
                    status: 'streaming',
                    details: {
                        filesModified: Object.keys(files).map(path => ({
                            path,
                            additions: (files[path].match(/\n/g) || []).length,
                            deletions: 0,
                        })),
                    },
                },
            });
        }

        // Forward verification results
        if (event.type === 'verification_result' || event.type === 'verification_complete') {
            sendPathwayEvent('node_update', {
                nodeId: 'verification',
                node: {
                    status: event.data?.verdict === 'APPROVED' ? 'complete' : 'active',
                    summary: `Verification: ${event.data?.verdict || 'running'}`,
                    details: {
                        verificationResults: {
                            errorCheck: { passed: !event.data?.errors, score: event.data?.overallScore || 0 },
                            codeQuality: { passed: true, score: event.data?.overallScore || 0 },
                        },
                    },
                },
            });
        }

        // Forward completion
        if (event.type === 'build_complete' || event.type === 'complete') {
            sendPathwayEvent('complete', {
                message: 'Build complete',
                success: true,
            });
        }

        // Forward errors
        if (event.type === 'error') {
            sendPathwayEvent('error', {
                error: event.data?.error || event.data?.message || 'Unknown error',
                nodeId: event.data?.phase ? phaseToNodeMap[event.data.phase as string] : undefined,
            });
        }
    };

    const logHandler = (log: { level?: string; message?: string }) => {
        // Only forward important logs
        if (log.level === 'info' || log.level === 'warn') {
            sendPathwayEvent('log', { message: log.message });
        }
    };

    orchestrator.on('event', eventHandler);
    orchestrator.on('log', logHandler);

    // Send heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
        res.write(`: heartbeat\n\n`);
    }, 30000);

    // Cleanup on disconnect
    req.on('close', () => {
        clearInterval(heartbeat);
        orchestrator.off('event', eventHandler);
        orchestrator.off('log', logHandler);
    });
});

export default router;

