/**
 * AI Lab API Routes (PROMPT 6)
 *
 * Endpoints for multi-agent research orchestration:
 * - POST   /api/ai-lab/sessions           - Create new AI Lab session
 * - GET    /api/ai-lab/sessions           - List user's sessions
 * - GET    /api/ai-lab/sessions/:id       - Get session details
 * - POST   /api/ai-lab/sessions/:id/start - Start session
 * - POST   /api/ai-lab/sessions/:id/stop  - Stop session
 * - POST   /api/ai-lab/sessions/:id/pause - Pause session
 * - GET    /api/ai-lab/sessions/:id/progress - Get real-time progress (SSE)
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db.js';
import { aiLabSessions, aiLabOrchestrations, aiLabMessages } from '../schema.js';
import { eq, desc } from 'drizzle-orm';
import {
    LabOrchestrator,
    createLabOrchestrator,
    type AILabSessionConfig,
} from '../services/ai-lab/index.js';

const router = Router();

// Store active orchestrators
const activeOrchestrators: Map<string, LabOrchestrator> = new Map();

// Apply auth middleware
router.use(authMiddleware);

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * POST /api/ai-lab/sessions
 * Create a new AI Lab session
 */
router.post('/sessions', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const {
            researchPrompt,
            projectId,
            problemType,
            budgetLimitCents,
            maxOrchestrations,
            maxDurationMinutes,
        } = req.body;

        if (!researchPrompt) {
            return res.status(400).json({ error: 'researchPrompt is required' });
        }

        const config: AILabSessionConfig = {
            userId,
            projectId,
            researchPrompt,
            problemType: problemType || 'general',
            budgetLimitCents: budgetLimitCents || 10000,
            maxOrchestrations: Math.min(maxOrchestrations || 5, 5),
            maxDurationMinutes: maxDurationMinutes || 60,
        };

        const orchestrator = await createLabOrchestrator(config);
        const sessionId = (orchestrator as any).sessionId;

        // Store orchestrator for later use
        activeOrchestrators.set(sessionId, orchestrator);

        res.status(201).json({
            success: true,
            sessionId,
            message: 'AI Lab session created. Call /start to begin.',
        });
    } catch (error) {
        console.error('Error creating AI Lab session:', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

/**
 * GET /api/ai-lab/sessions
 * List user's AI Lab sessions
 */
router.get('/sessions', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const sessions = await db
            .select()
            .from(aiLabSessions)
            .where(eq(aiLabSessions.userId, userId))
            .orderBy(desc(aiLabSessions.createdAt))
            .limit(50);

        res.json({
            success: true,
            sessions: sessions.map(s => ({
                id: s.id,
                researchPrompt: s.researchPrompt.slice(0, 100) + (s.researchPrompt.length > 100 ? '...' : ''),
                problemType: s.problemType,
                status: s.status,
                budgetLimitCents: s.budgetLimitCents,
                totalCostCents: s.totalCostCents,
                orchestrationsCompleted: s.orchestrationsCompleted,
                createdAt: s.createdAt,
                completedAt: s.completedAt,
            })),
        });
    } catch (error) {
        console.error('Error listing AI Lab sessions:', error);
        res.status(500).json({ error: 'Failed to list sessions' });
    }
});

/**
 * GET /api/ai-lab/sessions/:id
 * Get session details
 */
router.get('/sessions/:id', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { id } = req.params;

        const [session] = await db
            .select()
            .from(aiLabSessions)
            .where(eq(aiLabSessions.id, id));

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.userId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get orchestrations
        const orchestrations = await db
            .select()
            .from(aiLabOrchestrations)
            .where(eq(aiLabOrchestrations.sessionId, id));

        // Get messages
        const messages = await db
            .select()
            .from(aiLabMessages)
            .where(eq(aiLabMessages.sessionId, id));

        res.json({
            success: true,
            session: {
                ...session,
                orchestrations: orchestrations.map(o => ({
                    id: o.id,
                    index: o.orchestrationIndex,
                    focusArea: o.focusArea,
                    currentPhase: o.currentPhase,
                    phaseProgress: o.phaseProgress,
                    phaseStatus: o.phaseStatus,
                    status: o.status,
                    findings: o.findings,
                    conclusion: o.conclusion,
                    tokensUsed: o.tokensUsed,
                    costCents: o.costCents,
                })),
                messages: messages.map(m => ({
                    id: m.id,
                    fromOrchestrationId: m.fromOrchestrationId,
                    toOrchestrationId: m.toOrchestrationId,
                    messageType: m.messageType,
                    content: m.content,
                    createdAt: m.createdAt,
                })),
            },
        });
    } catch (error) {
        console.error('Error getting AI Lab session:', error);
        res.status(500).json({ error: 'Failed to get session' });
    }
});

/**
 * POST /api/ai-lab/sessions/:id/start
 * Start the AI Lab session
 */
router.post('/sessions/:id/start', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { id } = req.params;

        const [session] = await db
            .select()
            .from(aiLabSessions)
            .where(eq(aiLabSessions.id, id));

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.userId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (session.status === 'running') {
            return res.status(400).json({ error: 'Session already running' });
        }

        if (session.status === 'completed' || session.status === 'cancelled') {
            return res.status(400).json({ error: 'Session already finished' });
        }

        // Get or create orchestrator
        let orchestrator = activeOrchestrators.get(id);
        if (!orchestrator) {
            orchestrator = await createLabOrchestrator({
                userId: session.userId,
                projectId: session.projectId || undefined,
                researchPrompt: session.researchPrompt,
                problemType: session.problemType as any,
                budgetLimitCents: session.budgetLimitCents,
                maxOrchestrations: session.maxOrchestrations,
                maxDurationMinutes: session.maxDurationMinutes,
            });
            activeOrchestrators.set(id, orchestrator);
        }

        // Start in background (don't await)
        orchestrator.start().catch(error => {
            console.error('AI Lab session error:', error);
        });

        res.json({
            success: true,
            message: 'AI Lab session started',
        });
    } catch (error) {
        console.error('Error starting AI Lab session:', error);
        res.status(500).json({ error: 'Failed to start session' });
    }
});

/**
 * POST /api/ai-lab/sessions/:id/stop
 * Stop the AI Lab session
 */
router.post('/sessions/:id/stop', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { id } = req.params;

        const [session] = await db
            .select()
            .from(aiLabSessions)
            .where(eq(aiLabSessions.id, id));

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.userId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const orchestrator = activeOrchestrators.get(id);
        if (orchestrator) {
            await orchestrator.stop();
            activeOrchestrators.delete(id);
        }

        res.json({
            success: true,
            message: 'AI Lab session stopped',
        });
    } catch (error) {
        console.error('Error stopping AI Lab session:', error);
        res.status(500).json({ error: 'Failed to stop session' });
    }
});

/**
 * POST /api/ai-lab/sessions/:id/pause
 * Pause the AI Lab session
 */
router.post('/sessions/:id/pause', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { id } = req.params;

        const [session] = await db
            .select()
            .from(aiLabSessions)
            .where(eq(aiLabSessions.id, id));

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.userId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const orchestrator = activeOrchestrators.get(id);
        if (orchestrator) {
            await orchestrator.pause();
        }

        res.json({
            success: true,
            message: 'AI Lab session paused',
        });
    } catch (error) {
        console.error('Error pausing AI Lab session:', error);
        res.status(500).json({ error: 'Failed to pause session' });
    }
});

/**
 * GET /api/ai-lab/sessions/:id/progress
 * Get real-time progress via Server-Sent Events
 */
router.get('/sessions/:id/progress', async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    // Verify access
    const [session] = await db
        .select()
        .from(aiLabSessions)
        .where(eq(aiLabSessions.id, id));

    if (!session || session.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendProgress = async () => {
        const orchestrator = activeOrchestrators.get(id);
        if (orchestrator) {
            const progress = await orchestrator.getProgress();
            res.write(`data: ${JSON.stringify(progress)}\n\n`);
        } else {
            // Session not actively running, get latest from DB
            const orchestrations = await db
                .select()
                .from(aiLabOrchestrations)
                .where(eq(aiLabOrchestrations.sessionId, id));

            const [latestSession] = await db
                .select()
                .from(aiLabSessions)
                .where(eq(aiLabSessions.id, id));

            res.write(`data: ${JSON.stringify({
                sessionId: id,
                status: latestSession?.status || 'unknown',
                orchestrations: orchestrations.map(o => ({
                    id: o.id,
                    index: o.orchestrationIndex,
                    focusArea: o.focusArea,
                    currentPhase: o.currentPhase,
                    phaseProgress: o.phaseProgress,
                    status: o.status,
                })),
            })}\n\n`);
        }
    };

    // Send initial progress
    await sendProgress();

    // Set up interval for updates
    const interval = setInterval(sendProgress, 2000);

    // Clean up on close
    req.on('close', () => {
        clearInterval(interval);
    });
});

export default router;
