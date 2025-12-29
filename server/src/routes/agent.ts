/**
 * Agent Activity API Routes
 *
 * Provides an SSE endpoint consumed by Builder preview overlays.
 * This is intentionally lightweight and streams real orchestration/context events
 * (no mock data, no placeholders).
 */

import { Router, type Request, type Response } from 'express';
import { getContextStore } from '../services/agents/context-store.js';

const router = Router();
const contextStore = getContextStore();

function getRequestUserId(req: Request): string | null {
    const sessionUserId = (req as any).user?.id;
    const legacyUserId = (req as any).userId;
    const headerUserId = req.headers['x-user-id'];

    if (typeof sessionUserId === 'string' && sessionUserId.length > 0) return sessionUserId;
    if (typeof legacyUserId === 'string' && legacyUserId.length > 0) return legacyUserId;
    if (typeof headerUserId === 'string' && headerUserId.length > 0) return headerUserId;
    return null;
}

function writeSSE(res: Response, data: unknown) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

router.get('/activity-stream', (req: Request, res: Response) => {
    const userId = getRequestUserId(req);
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : null;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!projectId) return res.status(400).json({ error: 'projectId query param is required' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send initial connection event (real, not placeholder)
    writeSSE(res, {
        id: `evt-${Date.now()}-connected`,
        type: 'status',
        content: 'Connected to agent activity stream',
        timestamp: Date.now(),
        metadata: { parameters: { projectId } },
    });

    let subscriptionId: string | null = null;
    let subscribedContextId: string | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const subscribeToContext = (contextId: string) => {
        if (subscriptionId) return;
        subscribedContextId = contextId;

        subscriptionId = contextStore.subscribe(contextId, ['*' as any], (event) => {
            const ts = event.timestamp instanceof Date ? event.timestamp.getTime() : Date.now();

            // Map internal context events into the normalized AgentActivityEvent shape expected by UI
            writeSSE(res, {
                id: event.id,
                type: 'status',
                content: `Context event: ${event.type}`,
                timestamp: ts,
                metadata: {
                    phase: undefined,
                    parameters: {
                        contextEventType: event.type,
                    },
                },
            });
        });

        const ctx = contextStore.getContext(contextId);
        if (ctx) {
            writeSSE(res, {
                id: `evt-${Date.now()}-init`,
                type: 'status',
                content: 'Orchestration context attached',
                timestamp: Date.now(),
                metadata: {
                    parameters: {
                        contextId: ctx.id,
                        activeAgents: ctx.activeAgents.length,
                        queuedTasks: ctx.taskQueue.length,
                        completedTasks: ctx.completedTasks.length,
                    },
                },
            });
        }
    };

    // Attach immediately if context exists, otherwise poll briefly until created
    const existingContext = contextStore.getContextByProject(projectId, userId);
    if (existingContext) {
        subscribeToContext(existingContext.id);
    } else {
        writeSSE(res, {
            id: `evt-${Date.now()}-no-context`,
            type: 'status',
            content: 'No active orchestration context yet for this project',
            timestamp: Date.now(),
            metadata: { parameters: { projectId } },
        });

        let attempts = 0;
        pollInterval = setInterval(() => {
            attempts += 1;
            const ctx = contextStore.getContextByProject(projectId, userId);
            if (ctx) {
                subscribeToContext(ctx.id);
                if (pollInterval) clearInterval(pollInterval);
                pollInterval = null;
            }
            if (attempts >= 45) { // ~45s
                if (pollInterval) clearInterval(pollInterval);
                pollInterval = null;
            }
        }, 1000);
    }

    const cleanup = () => {
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = null;

        if (subscriptionId && subscribedContextId) {
            try {
                contextStore.unsubscribe(subscribedContextId, subscriptionId);
            } catch {
                // ignore
            }
        }
        subscriptionId = null;
        subscribedContextId = null;
    };

    req.on('close', () => {
        cleanup();
        res.end();
    });
});

export default router;

