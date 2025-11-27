/**
 * Orchestration API Routes
 *
 * Endpoints for the Development Orchestrator to:
 * - Process project requests
 * - Execute plans
 * - Stream events to frontend
 * - Manage agent status
 */

import { Router, Request, Response } from 'express';
import { DevelopmentOrchestrator, ProjectRequest } from '../services/orchestration/index.js';
import { createOrchestratorClaudeService } from '../services/ai/claude-service.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Store active orchestrators per project
const orchestrators = new Map<string, DevelopmentOrchestrator>();

/**
 * POST /api/orchestrate/analyze
 * Analyze a project request and create an execution plan
 */
router.post('/analyze', async (req: Request, res: Response) => {
    try {
        const { prompt, projectName, projectId, constraints } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const id = projectId || uuidv4();
        const claudeService = createOrchestratorClaudeService();
        const orchestrator = new DevelopmentOrchestrator(claudeService, {
            maxConcurrentTasks: 4,
            qualityGateEnabled: true,
            autoDeployEnabled: false,
        });

        // Store orchestrator for later execution
        orchestrators.set(id, orchestrator);

        const request: ProjectRequest = {
            prompt,
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

export default router;

