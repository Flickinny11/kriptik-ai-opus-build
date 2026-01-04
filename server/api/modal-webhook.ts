/**
 * Modal Webhook Endpoint
 *
 * Receives progress updates from Modal long-running orchestration.
 * This endpoint is called by Modal Python orchestrator with build events.
 *
 * Events:
 * - started: Orchestration started
 * - taskCompleted: A task/phase completed
 * - sandboxCreated: New sandbox created
 * - completed: Build complete
 * - failed: Build failed
 */

import type { Request, Response } from 'express';
import { db } from '../src/db.js';
import { orchestrationRuns } from '../src/schema.js';
import { eq } from 'drizzle-orm';
import { getWebSocketSyncService } from '../src/services/agents/websocket-sync.js';

export const config = {
    maxDuration: 10, // Short timeout - just storing webhook data
};

interface ModalWebhookPayload {
    buildId: string;
    event: string;
    data: any;
    timestamp: string;
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
        const { buildId, event, data, timestamp }: ModalWebhookPayload = req.body;

        if (!buildId || !event) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: buildId, event',
            });
            return;
        }

        console.log(`[Modal Webhook] ${event} for build ${buildId}:`, data);

        // Update orchestration run based on event
        const updateData: Record<string, any> = {};

        switch (event) {
            case 'started':
                updateData.status = 'running';
                updateData.startedAt = timestamp;
                updateData.artifacts = {
                    ...data,
                    startedAt: timestamp,
                };
                break;

            case 'taskCompleted':
                // Just log progress - full state is in Modal
                console.log(`[Modal Webhook] Task ${data?.taskId} completed`);
                break;

            case 'sandboxCreated':
                if (data?.type === 'main' && data?.tunnelUrl) {
                    // Update with main sandbox URL
                    const existingRun = await db
                        .select()
                        .from(orchestrationRuns)
                        .where(eq(orchestrationRuns.id, buildId))
                        .limit(1);

                    if (existingRun.length > 0) {
                        const existingArtifacts = existingRun[0].artifacts as Record<string, any> || {};

                        updateData.artifacts = {
                            ...existingArtifacts,
                            mainSandboxUrl: data.tunnelUrl,
                            lastUpdate: timestamp,
                        };
                    }
                }
                break;

            case 'completed':
                updateData.status = 'completed';
                updateData.completedAt = new Date().toISOString();
                updateData.artifacts = {
                    ...data,
                    completedAt: timestamp,
                };
                break;

            case 'failed':
                updateData.status = 'failed';
                updateData.artifacts = { error: data?.error || 'Unknown error' };
                updateData.completedAt = new Date().toISOString();
                break;

            case 'taskStarted':
            case 'taskFailed':
            case 'tasksPartitioned':
            case 'tasksAssigned':
            case 'budgetExceeded':
                // Log these but don't update main status
                console.log(`[Modal Webhook] ${event}:`, data);
                break;
        }

        // Update database if we have changes
        if (Object.keys(updateData).length > 0) {
            await db
                .update(orchestrationRuns)
                .set(updateData)
                .where(eq(orchestrationRuns.id, buildId));
        }

        // Broadcast event via WebSocket for real-time frontend updates
        try {
            const wsService = getWebSocketSyncService();

            // Get the run to find projectId
            const runs = await db
                .select()
                .from(orchestrationRuns)
                .where(eq(orchestrationRuns.id, buildId))
                .limit(1);

            if (runs.length > 0) {
                const run = runs[0];

                // Broadcast to project channel
                wsService.broadcast(run.projectId, {
                    type: `modal-${event}`,
                    buildId,
                    event,
                    data,
                    timestamp,
                });
            }
        } catch (wsError) {
            console.warn('[Modal Webhook] WebSocket broadcast failed:', wsError);
            // Non-blocking
        }

        res.json({ success: true, received: event });

    } catch (error) {
        console.error('[Modal Webhook] Error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
