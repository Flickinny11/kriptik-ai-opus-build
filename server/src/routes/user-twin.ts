/**
 * User Twin API Routes
 *
 * AI-powered synthetic user testing endpoints
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
    getUserTwinService,
    DEFAULT_PERSONAS,
    type UserPersona,
    type TestPlan,
    type TestProgress
} from '../services/testing/user-twin.js';
import { db } from '../db.js';
import { userTwinPersonas, userTwinSessions } from '../schema.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// SSE clients for live progress
const sseClients = new Map<string, Response[]>();

/**
 * POST /api/user-twin/start
 * Start a new synthetic testing session
 */
router.post('/start', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const {
            projectId,
            sandboxUrl,
            personaIds,
            testPlan
        } = req.body;

        if (!projectId || !sandboxUrl) {
            return res.status(400).json({
                success: false,
                error: 'projectId and sandboxUrl are required'
            });
        }

        // Get personas (either from IDs or use defaults)
        let personas: UserPersona[] = [];

        if (personaIds && personaIds.length > 0) {
            // Load custom personas from database
            const customPersonas = await db.select()
                .from(userTwinPersonas)
                .where(and(
                    eq(userTwinPersonas.userId, userId),
                ));

            personas = personaIds.map((id: string) => {
                const dbPersona = customPersonas.find(p => p.id === id);
                if (dbPersona) {
                    return {
                        id: dbPersona.id,
                        name: dbPersona.name,
                        behavior: dbPersona.behavior as UserPersona['behavior'],
                        techLevel: dbPersona.techLevel as UserPersona['techLevel'],
                        accessibilityNeeds: dbPersona.accessibilityNeeds as UserPersona['accessibilityNeeds'],
                        goalPatterns: dbPersona.goalPatterns as string[],
                    };
                }
                // Check default personas
                return DEFAULT_PERSONAS.find(p => p.id === id);
            }).filter(Boolean) as UserPersona[];
        }

        if (personas.length === 0) {
            // Use default personas
            personas = DEFAULT_PERSONAS.slice(0, 3);
        }

        const service = getUserTwinService();

        // Start the session
        const session = await service.startSession({
            projectId,
            sandboxUrl,
            personas,
            testPlan: testPlan as Partial<TestPlan>,
        });

        // Save to database
        await db.insert(userTwinSessions).values({
            id: session.id,
            projectId,
            sandboxUrl,
            personaIds: personas.map(p => p.id),
            status: 'running',
            createdAt: new Date().toISOString(),
        });

        // Set up event listeners for this session
        service.on('persona_progress', (progress: TestProgress) => {
            if (progress.sessionId === session.id) {
                broadcastProgress(session.id, progress);
            }
        });

        service.on('persona_completed', async (data) => {
            if (data.sessionId === session.id) {
                broadcastProgress(session.id, {
                    ...data,
                    type: 'persona_completed'
                });
            }
        });

        service.on('session_completed', async (data) => {
            if (data.sessionId === session.id) {
                // Update database
                const results = service.getSessionResults(session.id);
                await db.update(userTwinSessions)
                    .set({
                        status: 'completed',
                        results: results,
                        completedAt: new Date().toISOString(),
                    })
                    .where(eq(userTwinSessions.id, session.id));

                broadcastProgress(session.id, {
                    ...data,
                    type: 'session_completed',
                    results
                });
            }
        });

        res.json({
            success: true,
            sessionId: session.id,
            personas: session.personas.map(p => ({
                id: p.id,
                name: p.name,
                behavior: p.behavior,
                techLevel: p.techLevel,
            })),
            message: 'Synthetic user testing started'
        });
    } catch (error) {
        console.error('Error starting User Twin session:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to start session'
        });
    }
});

/**
 * POST /api/user-twin/stop/:sessionId
 * Stop a running test session
 */
router.post('/stop/:sessionId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;

        const service = getUserTwinService();
        const session = await service.stopSession(sessionId);

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        // Update database
        const results = service.getSessionResults(sessionId);
        await db.update(userTwinSessions)
            .set({
                status: 'stopped',
                results: results,
                completedAt: new Date().toISOString(),
            })
            .where(eq(userTwinSessions.id, sessionId));

        res.json({
            success: true,
            session: {
                id: session.id,
                status: session.status,
                totalIssues: session.totalIssues,
                aggregateScore: session.aggregateScore,
            }
        });
    } catch (error) {
        console.error('Error stopping session:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to stop session'
        });
    }
});

/**
 * GET /api/user-twin/results/:sessionId
 * Get test results for a session
 */
router.get('/results/:sessionId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;

        // Check in-memory first
        const service = getUserTwinService();
        const memorySession = service.getSession(sessionId);

        if (memorySession) {
            const results = service.getSessionResults(sessionId);
            return res.json({
                success: true,
                session: {
                    id: memorySession.id,
                    status: memorySession.status,
                    aggregateScore: memorySession.aggregateScore,
                    totalIssues: memorySession.totalIssues,
                    startedAt: memorySession.startedAt,
                    completedAt: memorySession.completedAt,
                },
                results,
            });
        }

        // Check database
        const dbSession = await db.select()
            .from(userTwinSessions)
            .where(eq(userTwinSessions.id, sessionId))
            .get();

        if (!dbSession) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        res.json({
            success: true,
            session: {
                id: dbSession.id,
                status: dbSession.status,
                sandboxUrl: dbSession.sandboxUrl,
                createdAt: dbSession.createdAt,
                completedAt: dbSession.completedAt,
            },
            results: dbSession.results,
        });
    } catch (error) {
        console.error('Error getting results:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get results'
        });
    }
});

/**
 * GET /api/user-twin/stream/:sessionId
 * SSE endpoint for live test progress
 */
router.get('/stream/:sessionId', authMiddleware, (req: Request, res: Response) => {
    const { sessionId } = req.params;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send initial status
    const service = getUserTwinService();
    const session = service.getSession(sessionId);

    if (session) {
        const results = service.getSessionResults(sessionId);
        res.write(`data: ${JSON.stringify({
            type: 'initial',
            status: session.status,
            aggregateScore: session.aggregateScore,
            totalIssues: session.totalIssues,
            results: results?.map(r => ({
                personaId: r.personaId,
                personaName: r.personaName,
                status: r.status,
                actionCount: r.actions.length,
                issuesFound: r.issuesFound.length,
                journeyScore: r.journeyScore,
            })),
        })}\n\n`);
    }

    // Register client for updates
    if (!sseClients.has(sessionId)) {
        sseClients.set(sessionId, []);
    }
    sseClients.get(sessionId)!.push(res);

    // Handle client disconnect
    req.on('close', () => {
        const clients = sseClients.get(sessionId);
        if (clients) {
            const index = clients.indexOf(res);
            if (index > -1) {
                clients.splice(index, 1);
            }
            if (clients.length === 0) {
                sseClients.delete(sessionId);
            }
        }
    });
});

/**
 * POST /api/user-twin/personas
 * Create a custom user persona
 */
router.post('/personas', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const {
            name,
            behavior,
            techLevel,
            accessibilityNeeds,
            goalPatterns
        } = req.body;

        if (!name || !behavior || !techLevel) {
            return res.status(400).json({
                success: false,
                error: 'name, behavior, and techLevel are required'
            });
        }

        const personaId = uuidv4();

        await db.insert(userTwinPersonas).values({
            id: personaId,
            userId,
            name,
            behavior,
            techLevel,
            accessibilityNeeds: accessibilityNeeds || [],
            goalPatterns: goalPatterns || [],
            createdAt: new Date().toISOString(),
        });

        res.json({
            success: true,
            persona: {
                id: personaId,
                name,
                behavior,
                techLevel,
                accessibilityNeeds,
                goalPatterns,
            }
        });
    } catch (error) {
        console.error('Error creating persona:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create persona'
        });
    }
});

/**
 * GET /api/user-twin/personas
 * Get all personas (default + custom)
 */
router.get('/personas', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        // Get custom personas
        const customPersonas = await db.select()
            .from(userTwinPersonas)
            .where(eq(userTwinPersonas.userId, userId));

        res.json({
            success: true,
            defaultPersonas: DEFAULT_PERSONAS,
            customPersonas: customPersonas.map(p => ({
                id: p.id,
                name: p.name,
                behavior: p.behavior,
                techLevel: p.techLevel,
                accessibilityNeeds: p.accessibilityNeeds,
                goalPatterns: p.goalPatterns,
                isCustom: true,
            })),
        });
    } catch (error) {
        console.error('Error getting personas:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get personas'
        });
    }
});

/**
 * DELETE /api/user-twin/personas/:personaId
 * Delete a custom persona
 */
router.delete('/personas/:personaId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { personaId } = req.params;

        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        // Verify ownership
        const persona = await db.select()
            .from(userTwinPersonas)
            .where(and(
                eq(userTwinPersonas.id, personaId),
                eq(userTwinPersonas.userId, userId)
            ))
            .get();

        if (!persona) {
            return res.status(404).json({
                success: false,
                error: 'Persona not found'
            });
        }

        await db.delete(userTwinPersonas)
            .where(eq(userTwinPersonas.id, personaId));

        res.json({
            success: true,
            message: 'Persona deleted'
        });
    } catch (error) {
        console.error('Error deleting persona:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete persona'
        });
    }
});

/**
 * GET /api/user-twin/sessions
 * Get all test sessions for a project
 */
router.get('/sessions', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { projectId } = req.query;

        if (!projectId) {
            return res.status(400).json({
                success: false,
                error: 'projectId query parameter is required'
            });
        }

        const sessions = await db.select({
            id: userTwinSessions.id,
            projectId: userTwinSessions.projectId,
            sandboxUrl: userTwinSessions.sandboxUrl,
            status: userTwinSessions.status,
            createdAt: userTwinSessions.createdAt,
            completedAt: userTwinSessions.completedAt,
        })
            .from(userTwinSessions)
            .where(eq(userTwinSessions.projectId, projectId as string));

        res.json({
            success: true,
            sessions
        });
    } catch (error) {
        console.error('Error getting sessions:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get sessions'
        });
    }
});

/**
 * GET /api/user-twin/issues/:projectId
 * Get all issues found across all sessions for a project
 */
router.get('/issues/:projectId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        const service = getUserTwinService();
        const issues = service.getProjectIssues(projectId);

        res.json({
            success: true,
            issues,
            summary: {
                total: issues.length,
                critical: issues.filter(i => i.severity === 'critical').length,
                high: issues.filter(i => i.severity === 'high').length,
                medium: issues.filter(i => i.severity === 'medium').length,
                low: issues.filter(i => i.severity === 'low').length,
            }
        });
    } catch (error) {
        console.error('Error getting issues:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get issues'
        });
    }
});

/**
 * GET /api/user-twin/heatmap/:sessionId
 * Get heatmap data for a session
 */
router.get('/heatmap/:sessionId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;

        const service = getUserTwinService();
        const heatmap = service.generateHeatmap(sessionId);

        res.json({
            success: true,
            heatmap
        });
    } catch (error) {
        console.error('Error getting heatmap:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get heatmap'
        });
    }
});

/**
 * Broadcast progress to SSE clients
 */
function broadcastProgress(sessionId: string, data: unknown): void {
    const clients = sseClients.get(sessionId);
    if (clients) {
        const message = JSON.stringify(data);
        clients.forEach(client => {
            try {
                client.write(`data: ${message}\n\n`);
            } catch {
                // Client disconnected
            }
        });
    }
}

export default router;

