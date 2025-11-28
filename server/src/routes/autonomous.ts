/**
 * Autonomous Build API Routes
 *
 * Endpoints for the "Approve and Watch" autonomous building feature:
 * - Start autonomous builds
 * - Approve phases
 * - Provide credentials
 * - Stream real-time events
 * - Get build status
 * - Stop builds
 */

import { Router, Request, Response } from 'express';
import {
    getAutonomousBuildController,
    AutonomousBuildState,
    BuildEvent,
} from '../services/automation/index.js';

const router = Router();

/**
 * POST /api/autonomous/start
 * Start a new autonomous build
 */
router.post('/start', async (req: Request, res: Response) => {
    try {
        const { prompt, projectId, options } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const controller = getAutonomousBuildController();
        const userId = (req as any).user?.id || 'anonymous';

        const buildId = await controller.start(prompt, projectId || `project-${Date.now()}`, userId, {
            autoApprove: options?.autoApprove ?? false,
            headedDemo: options?.headedDemo ?? false,
            vercelToken: options?.vercelToken || process.env.VERCEL_TOKEN,
        });

        const state = controller.getState(buildId);

        res.json({
            success: true,
            buildId,
            status: state?.status,
            phase: state?.phase,
            implementationPlan: state?.implementationPlan,
        });
    } catch (error) {
        console.error('Failed to start autonomous build:', error);
        res.status(500).json({
            error: 'Failed to start build',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/autonomous/:buildId/approve
 * Approve the current phase and continue
 */
router.post('/:buildId/approve', async (req: Request, res: Response) => {
    try {
        const { buildId } = req.params;
        const { modifications } = req.body;

        const controller = getAutonomousBuildController();
        const state = controller.getState(buildId);

        if (!state) {
            return res.status(404).json({ error: 'Build not found' });
        }

        if (state.status !== 'awaiting_approval') {
            return res.status(400).json({
                error: 'Build is not awaiting approval',
                currentStatus: state.status,
            });
        }

        await controller.approvePhase(buildId, modifications);

        res.json({
            success: true,
            nextPhase: controller.getState(buildId)?.phase,
        });
    } catch (error) {
        console.error('Failed to approve phase:', error);
        res.status(500).json({
            error: 'Failed to approve phase',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/autonomous/:buildId/credentials
 * Provide credentials for the build
 */
router.post('/:buildId/credentials', async (req: Request, res: Response) => {
    try {
        const { buildId } = req.params;
        const { credentials } = req.body;

        if (!credentials || typeof credentials !== 'object') {
            return res.status(400).json({ error: 'Credentials object is required' });
        }

        const controller = getAutonomousBuildController();
        const state = controller.getState(buildId);

        if (!state) {
            return res.status(404).json({ error: 'Build not found' });
        }

        if (state.status !== 'awaiting_credentials') {
            return res.status(400).json({
                error: 'Build is not awaiting credentials',
                currentStatus: state.status,
            });
        }

        await controller.provideCredentials(buildId, credentials);

        const updatedState = controller.getState(buildId);
        const remainingRequired = updatedState?.credentialsRequired.filter(
            c => !c.provided && c.required
        ) || [];

        res.json({
            success: true,
            remainingRequired,
        });
    } catch (error) {
        console.error('Failed to provide credentials:', error);
        res.status(500).json({
            error: 'Failed to provide credentials',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/autonomous/:buildId/stream
 * Stream real-time build events via Server-Sent Events
 */
router.get('/:buildId/stream', async (req: Request, res: Response) => {
    const { buildId } = req.params;

    const controller = getAutonomousBuildController();
    const state = controller.getState(buildId);

    if (!state) {
        return res.status(404).json({ error: 'Build not found' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send initial state
    const sendEvent = (event: BuildEvent) => {
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event.data)}\n\n`);
    };

    sendEvent({
        type: 'initial_state',
        timestamp: new Date(),
        data: {
            buildId,
            phase: state.phase,
            status: state.status,
            progress: state.currentPhaseProgress,
            implementationPlan: state.implementationPlan,
        },
    });

    // Subscribe to events
    const eventHandler = (event: { buildId: string } & BuildEvent) => {
        if (event.buildId === buildId) {
            sendEvent(event);
        }
    };

    controller.on('event', eventHandler);

    // Send heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 30000);

    // Clean up on disconnect
    req.on('close', () => {
        clearInterval(heartbeat);
        controller.off('event', eventHandler);
    });

    // Check for completion
    const checkComplete = setInterval(() => {
        const currentState = controller.getState(buildId);
        if (currentState?.status === 'complete' || currentState?.status === 'failed') {
            clearInterval(checkComplete);
            // Send final event
            sendEvent({
                type: 'stream_end',
                timestamp: new Date(),
                data: { status: currentState.status },
            });
        }
    }, 5000);
});

/**
 * GET /api/autonomous/:buildId/status
 * Get current build status
 */
router.get('/:buildId/status', (req: Request, res: Response) => {
    const { buildId } = req.params;

    const controller = getAutonomousBuildController();
    const state = controller.getState(buildId);

    if (!state) {
        return res.status(404).json({ error: 'Build not found' });
    }

    res.json({
        buildId,
        phase: state.phase,
        status: state.status,
        progress: state.currentPhaseProgress,
        implementationPlan: state.implementationPlan,
        deploymentUrl: state.deploymentUrl,
        errors: state.errors,
        fixesApplied: state.fixesApplied.length,
        verificationResults: state.verificationResults,
        credentialsRequired: state.credentialsRequired,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
        filesGenerated: state.generatedFiles.size,
        logs: state.logs.slice(-50), // Last 50 logs
    });
});

/**
 * GET /api/autonomous/:buildId/files
 * Get generated files
 */
router.get('/:buildId/files', (req: Request, res: Response) => {
    const { buildId } = req.params;

    const controller = getAutonomousBuildController();
    const state = controller.getState(buildId);

    if (!state) {
        return res.status(404).json({ error: 'Build not found' });
    }

    const files: Array<{ path: string; content: string; size: number }> = [];
    for (const [path, content] of state.generatedFiles) {
        files.push({
            path,
            content,
            size: content.length,
        });
    }

    res.json({
        buildId,
        totalFiles: files.length,
        files,
    });
});

/**
 * GET /api/autonomous/:buildId/files/:path
 * Get a specific generated file
 */
router.get('/:buildId/files/*', (req: Request, res: Response) => {
    const { buildId } = req.params;
    const filePath = req.params[0];

    const controller = getAutonomousBuildController();
    const state = controller.getState(buildId);

    if (!state) {
        return res.status(404).json({ error: 'Build not found' });
    }

    const content = state.generatedFiles.get(filePath);
    if (!content) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.json({
        path: filePath,
        content,
        size: content.length,
    });
});

/**
 * GET /api/autonomous/:buildId/verification
 * Get verification results
 */
router.get('/:buildId/verification', (req: Request, res: Response) => {
    const { buildId } = req.params;

    const controller = getAutonomousBuildController();
    const state = controller.getState(buildId);

    if (!state) {
        return res.status(404).json({ error: 'Build not found' });
    }

    const results = state.verificationResults;
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => r.passed === false).length;
    const pending = results.filter(r => r.passed === undefined).length;

    res.json({
        buildId,
        total: results.length,
        passed,
        failed,
        pending,
        passRate: results.length > 0 ? (passed / results.length) * 100 : 0,
        results,
    });
});

/**
 * POST /api/autonomous/:buildId/stop
 * Stop the build
 */
router.post('/:buildId/stop', async (req: Request, res: Response) => {
    try {
        const { buildId } = req.params;

        const controller = getAutonomousBuildController();
        const state = controller.getState(buildId);

        if (!state) {
            return res.status(404).json({ error: 'Build not found' });
        }

        await controller.stop(buildId);

        res.json({
            success: true,
            message: 'Build stopped',
        });
    } catch (error) {
        console.error('Failed to stop build:', error);
        res.status(500).json({
            error: 'Failed to stop build',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/autonomous/:buildId/logs
 * Get build logs
 */
router.get('/:buildId/logs', (req: Request, res: Response) => {
    const { buildId } = req.params;
    const { level, limit } = req.query;

    const controller = getAutonomousBuildController();
    const state = controller.getState(buildId);

    if (!state) {
        return res.status(404).json({ error: 'Build not found' });
    }

    let logs = state.logs;

    // Filter by level if specified
    if (level && typeof level === 'string') {
        logs = logs.filter(l => l.level === level);
    }

    // Limit if specified
    const logLimit = limit ? parseInt(limit as string) : 100;
    logs = logs.slice(-logLimit);

    res.json({
        buildId,
        total: state.logs.length,
        returned: logs.length,
        logs,
    });
});

/**
 * POST /api/autonomous/:buildId/retry
 * Retry a failed build from the last phase
 */
router.post('/:buildId/retry', async (req: Request, res: Response) => {
    try {
        const { buildId } = req.params;

        const controller = getAutonomousBuildController();
        const state = controller.getState(buildId);

        if (!state) {
            return res.status(404).json({ error: 'Build not found' });
        }

        if (state.status !== 'failed') {
            return res.status(400).json({
                error: 'Build is not in failed state',
                currentStatus: state.status,
            });
        }

        // For now, just restart the build with the same plan
        // A more sophisticated retry would resume from the failed phase
        res.json({
            success: false,
            message: 'Retry not yet implemented - please start a new build',
        });
    } catch (error) {
        console.error('Failed to retry build:', error);
        res.status(500).json({
            error: 'Failed to retry build',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

export default router;

