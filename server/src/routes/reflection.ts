/**
 * Infinite Reflection Engine API Routes
 *
 * Endpoints for the self-healing loop:
 * - Get reflection engine status
 * - Start/stop reflection
 * - Get improvement metrics
 * - View learned patterns
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ============================================================================
// REFLECTION STATE TYPES
// ============================================================================

interface ReflectionState {
    id: string;
    projectId: string;
    userId: string;
    status: 'idle' | 'running' | 'paused' | 'complete' | 'failed';
    currentIteration: number;
    maxIterations: number;
    startQualityScore: number;
    currentQualityScore: number;
    improvementPercentage: number;
    issuesFixed: number;
    issuesRemaining: number;
    learnedFixes: Array<{
        pattern: string;
        fix: string;
        successRate: number;
    }>;
    iterationHistory: Array<{
        iteration: number;
        score: number;
        issuesFixed: number;
        timestamp: Date;
    }>;
    escalationHistory: Array<{
        level: number;
        reason: string;
        timestamp: Date;
    }>;
    startedAt?: Date;
    completedAt?: Date;
}

// Active reflection engines per project
const reflectionEngines = new Map<string, ReflectionState>();

function getOrCreateReflectionState(projectId: string, userId: string): ReflectionState {
    const key = `${projectId}-${userId}`;
    if (!reflectionEngines.has(key)) {
        reflectionEngines.set(key, {
            id: `reflection-${uuidv4()}`,
            projectId,
            userId,
            status: 'idle',
            currentIteration: 0,
            maxIterations: 10,
            startQualityScore: 0,
            currentQualityScore: 0,
            improvementPercentage: 0,
            issuesFixed: 0,
            issuesRemaining: 0,
            learnedFixes: [],
            iterationHistory: [],
            escalationHistory: [],
        });
    }
    return reflectionEngines.get(key)!;
}

/**
 * GET /api/reflection/:projectId/status
 * Get current reflection engine status
 */
router.get('/:projectId/status', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const userId = (req as any).user?.id || 'anonymous';

        const state = getOrCreateReflectionState(projectId, userId);

        res.json({
            success: true,
            projectId,
            status: state.status,
            currentIteration: state.currentIteration,
            maxIterations: state.maxIterations,
            startQualityScore: state.startQualityScore,
            currentQualityScore: state.currentQualityScore,
            improvementPercentage: state.improvementPercentage,
            issuesFixed: state.issuesFixed,
            issuesRemaining: state.issuesRemaining,
            isRunning: state.status === 'running',
        });
    } catch (error) {
        console.error('Failed to get reflection status:', error);
        res.status(500).json({
            error: 'Failed to get reflection status',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/reflection/:projectId/start
 * Start the reflection engine
 */
router.post('/:projectId/start', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { maxIterations = 10, targetImprovement = 20 } = req.body;
        const userId = (req as any).user?.id || 'anonymous';

        const state = getOrCreateReflectionState(projectId, userId);

        if (state.status === 'running') {
            return res.status(400).json({
                error: 'Reflection engine already running',
            });
        }

        // Reset and start
        state.status = 'running';
        state.currentIteration = 0;
        state.maxIterations = maxIterations;
        state.startQualityScore = Math.random() * 40 + 50; // Simulate initial score 50-90
        state.currentQualityScore = state.startQualityScore;
        state.issuesFixed = 0;
        state.issuesRemaining = Math.floor(Math.random() * 10) + 5;
        state.startedAt = new Date();
        state.iterationHistory = [];
        state.escalationHistory = [];

        res.json({
            success: true,
            projectId,
            message: 'Reflection engine started',
            status: 'running',
            config: {
                maxIterations,
                targetImprovement,
            },
        });
    } catch (error) {
        console.error('Failed to start reflection:', error);
        res.status(500).json({
            error: 'Failed to start reflection',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/reflection/:projectId/stop
 * Stop the reflection engine
 */
router.post('/:projectId/stop', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const userId = (req as any).user?.id || 'anonymous';

        const key = `${projectId}-${userId}`;
        const state = reflectionEngines.get(key);

        if (!state) {
            return res.status(404).json({
                error: 'No active reflection engine for this project',
            });
        }

        state.status = 'paused';

        res.json({
            success: true,
            projectId,
            message: 'Reflection engine stopped',
        });
    } catch (error) {
        console.error('Failed to stop reflection:', error);
        res.status(500).json({
            error: 'Failed to stop reflection',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/reflection/:projectId/metrics
 * Get detailed improvement metrics
 */
router.get('/:projectId/metrics', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const userId = (req as any).user?.id || 'anonymous';

        const state = getOrCreateReflectionState(projectId, userId);

        res.json({
            success: true,
            projectId,
            metrics: {
                currentIteration: state.currentIteration,
                maxIterations: state.maxIterations,
                startQualityScore: state.startQualityScore,
                currentQualityScore: state.currentQualityScore,
                improvementPercentage: state.improvementPercentage,
                targetImprovement: '4x faster than competition',
                issues: {
                    found: state.issuesFixed + state.issuesRemaining,
                    fixed: state.issuesFixed,
                    remaining: state.issuesRemaining,
                    fixRate: state.issuesFixed > 0
                        ? Math.round((state.issuesFixed / (state.issuesFixed + state.issuesRemaining)) * 100)
                        : 0,
                },
                escalations: state.escalationHistory.length,
            },
        });
    } catch (error) {
        console.error('Failed to get metrics:', error);
        res.status(500).json({
            error: 'Failed to get metrics',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/reflection/:projectId/learned-patterns
 * Get learned fix patterns
 */
router.get('/:projectId/learned-patterns', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const userId = (req as any).user?.id || 'anonymous';

        const state = getOrCreateReflectionState(projectId, userId);

        res.json({
            success: true,
            projectId,
            learnedFixes: state.learnedFixes,
            patternCount: state.learnedFixes.length,
        });
    } catch (error) {
        console.error('Failed to get learned patterns:', error);
        res.status(500).json({
            error: 'Failed to get learned patterns',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/reflection/:projectId/history
 * Get reflection iteration history
 */
router.get('/:projectId/history', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const userId = (req as any).user?.id || 'anonymous';

        const state = getOrCreateReflectionState(projectId, userId);

        res.json({
            success: true,
            projectId,
            history: state.iterationHistory,
            escalationHistory: state.escalationHistory,
        });
    } catch (error) {
        console.error('Failed to get history:', error);
        res.status(500).json({
            error: 'Failed to get history',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/reflection/:projectId/configure
 * Update reflection engine configuration
 */
router.post('/:projectId/configure', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { maxIterations, targetImprovement } = req.body;
        const userId = (req as any).user?.id || 'anonymous';

        const state = getOrCreateReflectionState(projectId, userId);

        if (maxIterations) {
            state.maxIterations = maxIterations;
        }

        res.json({
            success: true,
            projectId,
            message: 'Reflection engine reconfigured',
            config: {
                maxIterations: state.maxIterations,
                targetImprovement,
            },
        });
    } catch (error) {
        console.error('Failed to configure reflection:', error);
        res.status(500).json({
            error: 'Failed to configure reflection',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/reflection/active
 * List all active reflection engines
 */
router.get('/active', async (_req: Request, res: Response) => {
    try {
        const engines = Array.from(reflectionEngines.entries()).map(([key, state]) => ({
            key,
            projectId: state.projectId,
            status: state.status,
            currentIteration: state.currentIteration,
            improvementPercentage: state.improvementPercentage,
        }));

        res.json({
            success: true,
            count: engines.length,
            engines,
        });
    } catch (error) {
        console.error('Failed to list active engines:', error);
        res.status(500).json({
            error: 'Failed to list active engines',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

export default router;
