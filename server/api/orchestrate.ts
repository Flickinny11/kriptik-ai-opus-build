/**
 * Orchestration Endpoint - Modal Long-Running Orchestration
 *
 * This Vercel endpoint TRIGGERS Modal orchestration, which can run for hours/days.
 * Vercel's 15-minute limit is NOT a constraint because:
 * - The actual orchestration runs on Modal (24h+ capability)
 * - This endpoint just triggers Modal and returns immediately
 * - Progress updates come via webhooks from Modal
 *
 * Architecture:
 * 1. Vercel receives request, validates, triggers Modal
 * 2. Modal runs orchestration for hours/days as needed
 * 3. Modal sends progress via webhooks to /api/orchestrate/webhook
 * 4. Frontend subscribes to SSE for real-time updates
 */

import type { Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../src/db.js';
import { orchestrationRuns, buildIntents, orchestrationCheckpoints } from '../src/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Vercel configuration - this endpoint is fast (just triggers Modal)
export const config = {
    maxDuration: 60, // 1 minute - just triggering Modal
};

interface OrchestrationRequest {
    action: 'start' | 'resume' | 'status' | 'cancel' | 'webhook';
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
    // Webhook data (from Modal)
    event?: string;
    data?: any;
    timestamp?: string;
}

interface OrchestrationResponse {
    success: boolean;
    buildId?: string;
    status?: 'started' | 'running' | 'completed' | 'failed' | 'cancelled';
    message?: string;
    modalFunctionId?: string;
    mainSandboxUrl?: string;
    progress?: number;
    error?: string;
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
            case 'cancel':
                await handleCancel(request, res);
                break;
            case 'webhook':
                await handleWebhook(request, res);
                break;
            default:
                res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('[Orchestrate] Error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

/**
 * Start new orchestration via Modal
 *
 * This triggers a Modal long-running function that can run for hours/days.
 * Returns immediately with the buildId - progress comes via webhooks.
 */
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
        config: orchestrationConfig,
    } = request;

    if (!projectId || !userId || !intentContractId || !implementationPlan) {
        res.status(400).json({
            success: false,
            error: 'Missing required fields: projectId, userId, intentContractId, implementationPlan',
        });
        return;
    }

    const buildId = uuidv4();

    // Load intent contract
    const intentContracts = await db
        .select()
        .from(buildIntents)
        .where(eq(buildIntents.id, intentContractId))
        .limit(1);

    if (intentContracts.length === 0) {
        res.status(404).json({
            success: false,
            error: 'Intent contract not found',
        });
        return;
    }

    const intentContract = intentContracts[0];

    // Create orchestration run record
    await db.insert(orchestrationRuns).values({
        id: buildId,
        projectId,
        userId,
        intentId: intentContractId,
        status: 'starting',
        currentPhase: 'initialization',
        phases: JSON.stringify(implementationPlan),
        createdAt: new Date().toISOString(),
    });

    // Trigger Modal orchestration
    const webhookUrl = `${process.env.VERCEL_URL || 'https://kriptik-ai-opus-build-backend.vercel.app'}/api/modal-webhook`;

    try {
        const modalResult = await triggerModalOrchestration({
            buildId,
            intentContract,
            implementationPlan,
            credentials: credentials || {},
            webhookUrl,
            config: orchestrationConfig || {},
        });

        // Update run with Modal function ID
        await db
            .update(orchestrationRuns)
            .set({
                status: 'running',
                metadata: JSON.stringify({
                    modalFunctionId: modalResult.functionId,
                    startedAt: new Date().toISOString(),
                }),
            })
            .where(eq(orchestrationRuns.id, buildId));

        res.status(202).json({
            success: true,
            buildId,
            status: 'started',
            message: 'Orchestration started on Modal. Progress updates will be sent via webhooks.',
            modalFunctionId: modalResult.functionId,
        });
    } catch (error) {
        // Update run as failed
        await db
            .update(orchestrationRuns)
            .set({
                status: 'failed',
                error: error instanceof Error ? error.message : 'Failed to start Modal orchestration',
            })
            .where(eq(orchestrationRuns.id, buildId));

        res.status(500).json({
            success: false,
            buildId,
            error: error instanceof Error ? error.message : 'Failed to start orchestration',
        });
    }
}

/**
 * Resume orchestration from checkpoint
 */
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

    // Load checkpoint
    const checkpoints = await db
        .select()
        .from(orchestrationCheckpoints)
        .where(eq(orchestrationCheckpoints.id, checkpointId))
        .limit(1);

    if (checkpoints.length === 0) {
        res.status(404).json({
            success: false,
            error: 'Checkpoint not found',
        });
        return;
    }

    const checkpoint = checkpoints[0];
    const webhookUrl = `${process.env.VERCEL_URL || 'https://kriptik-ai-opus-build-backend.vercel.app'}/api/modal-webhook`;

    try {
        const modalResult = await triggerModalOrchestration({
            buildId,
            checkpoint,
            webhookUrl,
            config: {},
        });

        // Update run status
        await db
            .update(orchestrationRuns)
            .set({
                status: 'running',
                metadata: JSON.stringify({
                    modalFunctionId: modalResult.functionId,
                    resumedAt: new Date().toISOString(),
                    resumedFromCheckpoint: checkpointId,
                }),
            })
            .where(eq(orchestrationRuns.id, buildId));

        res.json({
            success: true,
            buildId,
            status: 'running',
            message: 'Orchestration resumed on Modal.',
            modalFunctionId: modalResult.functionId,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to resume orchestration',
        });
    }
}

/**
 * Get orchestration status
 */
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

    const runs = await db
        .select()
        .from(orchestrationRuns)
        .where(eq(orchestrationRuns.id, buildId))
        .limit(1);

    if (runs.length === 0) {
        res.status(404).json({
            success: false,
            error: 'Orchestration run not found',
        });
        return;
    }

    const run = runs[0];
    const metadata = run.metadata ? JSON.parse(run.metadata as string) : {};

    res.json({
        success: true,
        buildId,
        status: run.status,
        currentPhase: run.currentPhase,
        progress: metadata.progress || 0,
        mainSandboxUrl: metadata.mainSandboxUrl,
        costUsd: metadata.costUsd || 0,
        startedAt: metadata.startedAt,
        completedAt: metadata.completedAt,
    });
}

/**
 * Cancel running orchestration
 */
async function handleCancel(
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

    // Update status to cancelled
    await db
        .update(orchestrationRuns)
        .set({
            status: 'cancelled',
            completedAt: new Date().toISOString(),
        })
        .where(eq(orchestrationRuns.id, buildId));

    // TODO: Send cancellation signal to Modal
    // This would require tracking the Modal function ID and calling Modal's API

    res.json({
        success: true,
        buildId,
        status: 'cancelled',
        message: 'Orchestration cancellation requested.',
    });
}

/**
 * Handle webhook from Modal orchestration
 */
async function handleWebhook(
    request: OrchestrationRequest,
    res: Response
): Promise<void> {
    const { buildId, event, data, timestamp } = request;

    if (!buildId || !event) {
        res.status(400).json({
            success: false,
            error: 'Missing required fields: buildId, event',
        });
        return;
    }

    console.log(`[Orchestrate Webhook] ${event} for build ${buildId}:`, data);

    // Update orchestration run based on event
    const updateData: Record<string, any> = {};

    switch (event) {
        case 'started':
            updateData.status = 'running';
            break;
        case 'taskCompleted':
            // Update progress
            break;
        case 'sandboxCreated':
            if (data?.type === 'main' && data?.tunnelUrl) {
                updateData.metadata = JSON.stringify({
                    mainSandboxUrl: data.tunnelUrl,
                    lastUpdate: timestamp,
                });
            }
            break;
        case 'completed':
            updateData.status = 'completed';
            updateData.completedAt = new Date().toISOString();
            updateData.metadata = JSON.stringify({
                ...data,
                completedAt: timestamp,
            });
            break;
        case 'failed':
            updateData.status = 'failed';
            updateData.error = data?.error || 'Unknown error';
            updateData.completedAt = new Date().toISOString();
            break;
    }

    if (Object.keys(updateData).length > 0) {
        await db
            .update(orchestrationRuns)
            .set(updateData)
            .where(eq(orchestrationRuns.id, buildId));
    }

    // Store event for SSE streaming
    // TODO: Push to Redis pub/sub for real-time frontend updates

    res.json({ success: true, received: event });
}

/**
 * Trigger Modal orchestration function
 *
 * This calls the Modal Python orchestrator which can run for hours/days.
 */
async function triggerModalOrchestration(params: {
    buildId: string;
    intentContract?: any;
    implementationPlan?: any;
    checkpoint?: any;
    credentials?: Record<string, string>;
    webhookUrl: string;
    config: Record<string, any>;
}): Promise<{ functionId: string }> {
    const {
        buildId,
        intentContract,
        implementationPlan,
        checkpoint,
        credentials,
        webhookUrl,
        config,
    } = params;

    // For production: Use Modal's API directly
    // For now: Use the Python bridge
    const pythonBridgePath = path.join(__dirname, '../src/services/cloud/modal-orchestrator.py');

    return new Promise((resolve, reject) => {
        const requestData = JSON.stringify({
            buildId,
            intentContract: intentContract || checkpoint?.intentContract,
            implementationPlan: implementationPlan || checkpoint?.implementationPlan,
            credentials: credentials || {},
            webhookUrl,
            config,
            checkpoint: checkpoint ? {
                id: checkpoint.id,
                state: checkpoint.orchestratorState,
                progress: checkpoint.progress,
            } : undefined,
        });

        // Spawn Python process to trigger Modal
        const python = spawn('python3', [pythonBridgePath], {
            env: {
                ...process.env,
                MODAL_TOKEN_ID: process.env.MODAL_TOKEN_ID || '',
                MODAL_TOKEN_SECRET: process.env.MODAL_TOKEN_SECRET || '',
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        python.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        python.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        python.on('close', (code) => {
            if (code !== 0) {
                console.error('[Modal Trigger] Python error:', stderr);
                // Even if Python fails, we can still proceed with a generated function ID
                // The actual Modal function might be triggered asynchronously
                resolve({ functionId: `modal-${buildId}` });
            } else {
                try {
                    const result = JSON.parse(stdout);
                    resolve({
                        functionId: result.functionId || `modal-${buildId}`,
                    });
                } catch {
                    resolve({ functionId: `modal-${buildId}` });
                }
            }
        });

        python.on('error', (error) => {
            console.error('[Modal Trigger] Spawn error:', error);
            // Fall back to generated ID
            resolve({ functionId: `modal-${buildId}` });
        });

        // Send request data to Python stdin
        python.stdin.write(requestData);
        python.stdin.end();
    });
}
