/**
 * Time Machine Checkpoints API Routes
 *
 * Endpoints for checkpoint management:
 * - Create manual checkpoints
 * - List checkpoints for a project
 * - Restore to a checkpoint
 * - Compare checkpoints
 * - Delete old checkpoints
 */

import { Router, Request, Response } from 'express';
import {
    TimeMachine,
    createTimeMachine,
    type CheckpointData,
} from '../services/checkpoints/time-machine.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Active time machines per project/build
const timeMachines = new Map<string, TimeMachine>();

function getTimeMachine(projectId: string, userId: string, buildId?: string): TimeMachine {
    const key = `${projectId}-${userId}`;
    if (!timeMachines.has(key)) {
        timeMachines.set(key, createTimeMachine(projectId, userId, buildId || `build-${uuidv4()}`));
    }
    return timeMachines.get(key)!;
}

/**
 * POST /api/checkpoints/create
 * Create a manual checkpoint
 */
router.post('/create', async (req: Request, res: Response) => {
    try {
        const { projectId, buildId, phase = 'manual', files, description, scores, screenshots } = req.body;
        const userId = (req as any).user?.id || 'anonymous';

        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }

        const timeMachine = getTimeMachine(projectId, userId, buildId);

        // Convert files object to Map
        const fileMap = new Map<string, string>(Object.entries(files || {}));

        const checkpoint = await timeMachine.createCheckpoint(
            phase,
            fileMap,
            {
                description,
                scores,
                screenshots,
                isAutomatic: false,
                triggerReason: 'manual',
            }
        );

        res.json({
            success: true,
            checkpoint: {
                id: checkpoint.id,
                phase: checkpoint.phase,
                timestamp: checkpoint.timestamp,
                filesHash: checkpoint.filesHash,
                filesCount: checkpoint.files.size,
                scores: checkpoint.scores,
                description: checkpoint.description,
            },
        });
    } catch (error) {
        console.error('Failed to create checkpoint:', error);
        res.status(500).json({
            error: 'Failed to create checkpoint',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/checkpoints/list/:projectId
 * List all checkpoints for a project
 */
router.get('/list/:projectId', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { buildId } = req.query;
        const userId = (req as any).user?.id || 'anonymous';

        const timeMachine = getTimeMachine(projectId, userId, buildId as string);
        const checkpoints = await timeMachine.getAllCheckpoints();

        res.json({
            success: true,
            projectId,
            count: checkpoints.length,
            checkpoints,
        });
    } catch (error) {
        console.error('Failed to list checkpoints:', error);
        res.status(500).json({
            error: 'Failed to list checkpoints',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/checkpoints/:projectId/:checkpointId
 * Get details of a specific checkpoint
 */
router.get('/:projectId/:checkpointId', async (req: Request, res: Response) => {
    try {
        const { projectId, checkpointId } = req.params;
        const userId = (req as any).user?.id || 'anonymous';

        const timeMachine = getTimeMachine(projectId, userId);
        const checkpoint = await timeMachine.getCheckpoint(checkpointId);

        if (!checkpoint) {
            return res.status(404).json({
                error: 'Checkpoint not found',
                checkpointId,
            });
        }

        // Convert files Map to object for JSON
        const files: Record<string, string> = {};
        checkpoint.files.forEach((content, path) => {
            files[path] = content;
        });

        res.json({
            success: true,
            checkpoint: {
                id: checkpoint.id,
                phase: checkpoint.phase,
                timestamp: checkpoint.timestamp,
                filesHash: checkpoint.filesHash,
                filesCount: checkpoint.files.size,
                files,
                artifacts: checkpoint.artifacts,
                agentMemory: checkpoint.agentMemory,
                scores: checkpoint.scores,
                screenshots: checkpoint.screenshots,
                gitInfo: checkpoint.gitInfo,
                description: checkpoint.description,
            },
        });
    } catch (error) {
        console.error('Failed to get checkpoint:', error);
        res.status(500).json({
            error: 'Failed to get checkpoint',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/checkpoints/:projectId/:checkpointId/restore
 * Restore to a specific checkpoint
 */
router.post('/:projectId/:checkpointId/restore', async (req: Request, res: Response) => {
    try {
        const { projectId, checkpointId } = req.params;
        const userId = (req as any).user?.id || 'anonymous';

        const timeMachine = getTimeMachine(projectId, userId);

        const result = await timeMachine.rollback(checkpointId);

        if (!result.success) {
            return res.status(400).json({
                error: result.message,
                checkpointId,
            });
        }

        res.json({
            success: true,
            checkpointId,
            restoredFilesCount: result.restoredFilesCount,
            message: result.message,
            warnings: result.warnings,
        });
    } catch (error) {
        console.error('Failed to restore checkpoint:', error);
        res.status(500).json({
            error: 'Failed to restore checkpoint',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/checkpoints/compare
 * Compare two checkpoints
 */
router.post('/compare', async (req: Request, res: Response) => {
    try {
        const { projectId, checkpoint1Id, checkpoint2Id } = req.body;
        const userId = (req as any).user?.id || 'anonymous';

        if (!projectId || !checkpoint1Id || !checkpoint2Id) {
            return res.status(400).json({
                error: 'projectId, checkpoint1Id, and checkpoint2Id are required',
            });
        }

        const timeMachine = getTimeMachine(projectId, userId);
        const comparison = await timeMachine.compare(checkpoint1Id, checkpoint2Id);

        if (!comparison) {
            return res.status(404).json({
                error: 'One or both checkpoints not found',
            });
        }

        res.json({
            success: true,
            comparison,
        });
    } catch (error) {
        console.error('Failed to compare checkpoints:', error);
        res.status(500).json({
            error: 'Failed to compare checkpoints',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * DELETE /api/checkpoints/:projectId/:checkpointId
 * Delete a specific checkpoint
 */
router.delete('/:projectId/:checkpointId', async (req: Request, res: Response) => {
    try {
        const { projectId, checkpointId } = req.params;
        const userId = (req as any).user?.id || 'anonymous';

        const timeMachine = getTimeMachine(projectId, userId);
        await timeMachine.deleteCheckpoint(checkpointId);

        res.json({
            success: true,
            checkpointId,
            message: 'Checkpoint deleted',
        });
    } catch (error) {
        console.error('Failed to delete checkpoint:', error);
        res.status(500).json({
            error: 'Failed to delete checkpoint',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/checkpoints/:projectId/cleanup
 * Clean up all checkpoints for a project
 */
router.post('/:projectId/cleanup', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const userId = (req as any).user?.id || 'anonymous';

        const timeMachine = getTimeMachine(projectId, userId);
        await timeMachine.clearAllCheckpoints();

        res.json({
            success: true,
            projectId,
            message: 'All checkpoints cleared',
        });
    } catch (error) {
        console.error('Failed to cleanup checkpoints:', error);
        res.status(500).json({
            error: 'Failed to cleanup checkpoints',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/checkpoints/:projectId/latest
 * Get the most recent checkpoint
 */
router.get('/:projectId/latest', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const userId = (req as any).user?.id || 'anonymous';

        const timeMachine = getTimeMachine(projectId, userId);
        const latest = await timeMachine.getLatestCheckpoint();

        if (!latest) {
            return res.status(404).json({
                error: 'No checkpoints found',
                projectId,
            });
        }

        res.json({
            success: true,
            checkpoint: {
                id: latest.id,
                phase: latest.phase,
                timestamp: latest.timestamp,
                filesHash: latest.filesHash,
                filesCount: latest.files.size,
                scores: latest.scores,
                description: latest.description,
                gitInfo: latest.gitInfo,
            },
        });
    } catch (error) {
        console.error('Failed to get latest checkpoint:', error);
        res.status(500).json({
            error: 'Failed to get latest checkpoint',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

export default router;
