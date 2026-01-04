/**
 * Orchestration Endpoint - Vercel Fluid Compute
 *
 * This function can run for up to 15 minutes per invocation (Vercel Fluid max).
 * For longer builds, it chains itself via webhook callbacks using checkpoints.
 *
 * Supports:
 * - Starting new multi-sandbox orchestration
 * - Resuming from checkpoint
 * - Querying orchestration status
 */

import type { Request, Response } from 'express';
import {
    MultiSandboxOrchestrator,
    createMultiSandboxOrchestrator,
} from '../src/services/orchestration/multi-sandbox-orchestrator.js';
import { db } from '../src/db.js';
import { orchestrationCheckpoints, orchestrationRuns, buildIntents } from '../src/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Vercel Fluid Compute configuration
export const config = {
    maxDuration: 900, // 15 minutes (Fluid max)
};

interface OrchestrationRequest {
    action: 'start' | 'resume' | 'status' | 'checkpoint';
    buildId?: string;
    checkpointId?: string;
    projectId?: string;
    userId?: string;
    intentContractId?: string;
    implementationPlan?: any;
    credentials?: Record<string, string>;
    config?: {
        maxParallelSandboxes?: number;
        taskPartitionStrategy?: 'by-phase' | 'by-feature' | 'by-component';
        tournamentMode?: boolean;
        tournamentCompetitors?: number;
        budgetLimitUsd?: number;
        timeoutHours?: number;
        respawnOnFailure?: boolean;
    };
}

interface OrchestrationResponse {
    success: boolean;
    buildId?: string;
    checkpointId?: string;
    status?: string;
    progress?: number;
    mainSandboxUrl?: string;
    error?: string;
    continuationScheduled?: boolean;
    costUsd?: number;
}

export default async function handler(
    req: Request,
    res: Response
): Promise<void> {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const request: OrchestrationRequest = req.body;

        switch (request.action) {
            case 'start':
                await handleStart(request, res);
                break;
            case 'resume':
                await handleResume(request, res);
                break;
            case 'status':
                await handleStatus(request, res);
                break;
            case 'checkpoint':
                await handleCheckpoint(request, res);
                break;
            default:
                res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error: any) {
        console.error('[Orchestrate] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
}

async function handleStart(
    request: OrchestrationRequest,
    res: Response
): Promise<void> {
    const {
        projectId,
        userId,
        intentContractId,
        implementationPlan,
        credentials,
        config: userConfig,
    } = request;

    if (!projectId || !userId || !intentContractId || !implementationPlan) {
        res.status(400).json({
            success: false,
            error: 'Missing required fields: projectId, userId, intentContractId, implementationPlan',
        });
        return;
    }

    // Get intent contract from database
    const [intentContract] = await db
        .select()
        .from(buildIntents)
        .where(eq(buildIntents.id, intentContractId))
        .limit(1);

    if (!intentContract) {
        res.status(404).json({
            success: false,
            error: 'Intent contract not found',
        });
        return;
    }

    const buildId = uuidv4();

    // Create orchestration run record
    await db.insert(orchestrationRuns).values({
        id: buildId,
        projectId,
        userId,
        prompt: intentContract.originalPrompt,
        plan: implementationPlan,
        status: 'running',
        phases: {
            current: 'initialization',
            completed: [],
            pending: ['build', 'verification', 'merge', 'demo'],
        },
        startedAt: new Date().toISOString(),
    });

    // Create orchestrator with configuration
    const orchestrator = createMultiSandboxOrchestrator({
        maxParallelSandboxes: userConfig?.maxParallelSandboxes ?? 5,
        taskPartitionStrategy: userConfig?.taskPartitionStrategy ?? 'by-feature',
        tournamentMode: userConfig?.tournamentMode ?? false,
        tournamentCompetitors: userConfig?.tournamentCompetitors ?? 3,
        budgetLimitUsd: userConfig?.budgetLimitUsd ?? 100,
        timeoutHours: userConfig?.timeoutHours ?? 24,
        respawnOnFailure: userConfig?.respawnOnFailure ?? true,
    });

    // Set up progress tracking
    orchestrator.on('progress', async (data) => {
        await db
            .update(orchestrationRuns)
            .set({
                phases: data.phases,
            })
            .where(eq(orchestrationRuns.id, buildId));
    });

    // Start orchestration with timeout detection
    const startTime = Date.now();
    const maxRuntime = 14 * 60 * 1000; // 14 minutes (leave 1 min buffer)

    // Create a promise that resolves when orchestration completes or times out
    const orchestrationPromise = orchestrator.orchestrate(
        intentContract,
        implementationPlan,
        new Map(Object.entries(credentials || {}))
    );

    // Create a timeout promise
    const timeoutPromise = new Promise<{ timedOut: true }>((resolve) => {
        setTimeout(() => resolve({ timedOut: true }), maxRuntime);
    });

    // Race between orchestration and timeout
    const result = await Promise.race([orchestrationPromise, timeoutPromise]);

    if ('timedOut' in result && result.timedOut) {
        // Timeout - save checkpoint and schedule continuation
        const checkpoint = await orchestrator.saveCheckpoint();

        await db.insert(orchestrationCheckpoints).values({
            id: checkpoint.id,
            buildId,
            projectId,
            userId,
            checkpointNumber: 1,
            reason: 'timeout',
            orchestratorState: checkpoint.state,
            mainSandboxState: checkpoint.mainSandboxState,
            buildSandboxStates: checkpoint.buildSandboxStates,
            sharedContextState: checkpoint.sharedContextState,
            fileOwnership: checkpoint.fileOwnership,
            mergeQueueState: checkpoint.mergeQueueState,
            completedTasks: checkpoint.completedTasks,
            pendingTasks: checkpoint.pendingTasks,
            progress: checkpoint.progress,
            totalCostUsd: Math.round(checkpoint.costUsd * 1000),
        });

        // Schedule continuation via self-invocation (server-to-server, no browser credentials needed)
        const vercelUrl = process.env.VERCEL_URL || 'https://kriptik-ai-opus-build-backend.vercel.app';
        try {
            await fetch(`${vercelUrl}/api/orchestrate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'omit', // Server-to-server call, no cookies needed
                body: JSON.stringify({
                    action: 'resume',
                    buildId,
                    checkpointId: checkpoint.id,
                }),
            });
        } catch (e) {
            console.error('[Orchestrate] Failed to schedule continuation:', e);
        }

        res.status(202).json({
            success: true,
            buildId,
            checkpointId: checkpoint.id,
            status: 'in_progress',
            progress: checkpoint.progress,
            continuationScheduled: true,
            costUsd: checkpoint.costUsd,
        });
        return;
    }

    // Orchestration completed
    await db
        .update(orchestrationRuns)
        .set({
            status: result.success ? 'completed' : 'failed',
            completedAt: new Date().toISOString(),
        })
        .where(eq(orchestrationRuns.id, buildId));

    res.status(200).json({
        success: result.success,
        buildId,
        status: result.success ? 'completed' : 'failed',
        progress: 100,
        mainSandboxUrl: result.mainSandboxUrl,
        costUsd: result.costUsd,
        error: result.errors?.join(', '),
    });
}

async function handleResume(
    request: OrchestrationRequest,
    res: Response
): Promise<void> {
    const { buildId, checkpointId } = request;

    if (!buildId || !checkpointId) {
        res.status(400).json({
            success: false,
            error: 'Missing required fields: buildId, checkpointId',
        });
        return;
    }

    // Get checkpoint from database
    const [checkpoint] = await db
        .select()
        .from(orchestrationCheckpoints)
        .where(eq(orchestrationCheckpoints.id, checkpointId))
        .limit(1);

    if (!checkpoint) {
        res.status(404).json({
            success: false,
            error: 'Checkpoint not found',
        });
        return;
    }

    if (!checkpoint.canResume) {
        res.status(400).json({
            success: false,
            error: 'Checkpoint cannot be resumed',
        });
        return;
    }

    // Mark checkpoint as resumed
    await db
        .update(orchestrationCheckpoints)
        .set({
            resumedAt: new Date().toISOString(),
        })
        .where(eq(orchestrationCheckpoints.id, checkpointId));

    // Restore orchestrator from checkpoint
    const orchestrator = createMultiSandboxOrchestrator(
        checkpoint.orchestratorState as any
    );

    // Restore state
    await orchestrator.loadCheckpoint({
        id: checkpoint.id,
        state: checkpoint.orchestratorState,
        mainSandboxState: checkpoint.mainSandboxState,
        buildSandboxStates: checkpoint.buildSandboxStates,
        sharedContextState: checkpoint.sharedContextState,
        fileOwnership: checkpoint.fileOwnership,
        mergeQueueState: checkpoint.mergeQueueState,
        completedTasks: checkpoint.completedTasks,
        pendingTasks: checkpoint.pendingTasks,
        progress: checkpoint.progress,
        costUsd: (checkpoint.totalCostUsd || 0) / 1000,
    });

    // Continue orchestration with timeout detection
    const startTime = Date.now();
    const maxRuntime = 14 * 60 * 1000; // 14 minutes

    const orchestrationPromise = orchestrator.resumeOrchestration();
    const timeoutPromise = new Promise<{ timedOut: true }>((resolve) => {
        setTimeout(() => resolve({ timedOut: true }), maxRuntime);
    });

    const result = await Promise.race([orchestrationPromise, timeoutPromise]);

    if ('timedOut' in result && result.timedOut) {
        // Another timeout - save new checkpoint
        const newCheckpoint = await orchestrator.saveCheckpoint();
        const newCheckpointNumber = (checkpoint.checkpointNumber || 0) + 1;

        await db.insert(orchestrationCheckpoints).values({
            id: newCheckpoint.id,
            buildId,
            projectId: checkpoint.projectId,
            userId: checkpoint.userId,
            checkpointNumber: newCheckpointNumber,
            reason: 'timeout',
            orchestratorState: newCheckpoint.state,
            mainSandboxState: newCheckpoint.mainSandboxState,
            buildSandboxStates: newCheckpoint.buildSandboxStates,
            sharedContextState: newCheckpoint.sharedContextState,
            fileOwnership: newCheckpoint.fileOwnership,
            mergeQueueState: newCheckpoint.mergeQueueState,
            completedTasks: newCheckpoint.completedTasks,
            pendingTasks: newCheckpoint.pendingTasks,
            progress: newCheckpoint.progress,
            totalCostUsd: Math.round(newCheckpoint.costUsd * 1000),
            resumedFromCheckpointId: checkpointId,
        });

        // Schedule next continuation (server-to-server, no browser credentials needed)
        const vercelUrl = process.env.VERCEL_URL || 'https://kriptik-ai-opus-build-backend.vercel.app';
        try {
            await fetch(`${vercelUrl}/api/orchestrate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'omit', // Server-to-server call, no cookies needed
                body: JSON.stringify({
                    action: 'resume',
                    buildId,
                    checkpointId: newCheckpoint.id,
                }),
            });
        } catch (e) {
            console.error('[Orchestrate] Failed to schedule continuation:', e);
        }

        res.status(202).json({
            success: true,
            buildId,
            checkpointId: newCheckpoint.id,
            status: 'in_progress',
            progress: newCheckpoint.progress,
            continuationScheduled: true,
            costUsd: newCheckpoint.costUsd,
        });
        return;
    }

    // Orchestration completed
    await db
        .update(orchestrationRuns)
        .set({
            status: result.success ? 'completed' : 'failed',
            completedAt: new Date().toISOString(),
        })
        .where(eq(orchestrationRuns.id, buildId));

    res.status(200).json({
        success: result.success,
        buildId,
        status: result.success ? 'completed' : 'failed',
        progress: 100,
        mainSandboxUrl: result.mainSandboxUrl,
        costUsd: result.costUsd,
        error: result.errors?.join(', '),
    });
}

async function handleStatus(
    request: OrchestrationRequest,
    res: Response
): Promise<void> {
    const { buildId } = request;

    if (!buildId) {
        res.status(400).json({
            success: false,
            error: 'Missing required field: buildId',
        });
        return;
    }

    // Get orchestration run
    const [run] = await db
        .select()
        .from(orchestrationRuns)
        .where(eq(orchestrationRuns.id, buildId))
        .limit(1);

    if (!run) {
        res.status(404).json({
            success: false,
            error: 'Orchestration run not found',
        });
        return;
    }

    // Get latest checkpoint if any
    const [latestCheckpoint] = await db
        .select()
        .from(orchestrationCheckpoints)
        .where(eq(orchestrationCheckpoints.buildId, buildId))
        .orderBy(orchestrationCheckpoints.createdAt)
        .limit(1);

    res.status(200).json({
        success: true,
        buildId,
        status: run.status,
        phases: run.phases,
        progress: latestCheckpoint?.progress || 0,
        checkpointId: latestCheckpoint?.id,
        costUsd: (latestCheckpoint?.totalCostUsd || 0) / 1000,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
    });
}

async function handleCheckpoint(
    request: OrchestrationRequest,
    res: Response
): Promise<void> {
    const { buildId } = request;

    if (!buildId) {
        res.status(400).json({
            success: false,
            error: 'Missing required field: buildId',
        });
        return;
    }

    // Get all checkpoints for this build
    const checkpoints = await db
        .select()
        .from(orchestrationCheckpoints)
        .where(eq(orchestrationCheckpoints.buildId, buildId))
        .orderBy(orchestrationCheckpoints.createdAt);

    res.status(200).json({
        success: true,
        buildId,
        checkpoints: checkpoints.map((cp) => ({
            id: cp.id,
            checkpointNumber: cp.checkpointNumber,
            reason: cp.reason,
            progress: cp.progress,
            costUsd: (cp.totalCostUsd || 0) / 1000,
            canResume: cp.canResume,
            createdAt: cp.createdAt,
            resumedAt: cp.resumedAt,
        })),
    });
}
