/**
 * Voice Architect API Routes
 *
 * Voice-to-code capability endpoints
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
    getVoiceArchitectService,
    type VoiceSession,
    type ExtractedIntent,
    type Transcription,
} from '../services/ai/voice-architect.js';
import { db } from '../db.js';
import { voiceSessions } from '../schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// SSE clients for real-time updates
const sseClients = new Map<string, Response[]>();

/**
 * POST /api/voice/session/start
 * Start a new voice session
 */
router.post('/session/start', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { projectId } = req.body;

        const voiceService = getVoiceArchitectService({ userId, projectId });
        const session = voiceService.startSession(projectId);

        // Save to database
        await db.insert(voiceSessions).values({
            id: session.id,
            userId,
            projectId: projectId || null,
            transcriptions: [],
            extractedIntent: null,
            clarifications: [],
            status: 'listening',
            createdAt: new Date().toISOString(),
        });

        // Set up event forwarding
        setupSessionEvents(voiceService, session.id);

        res.json({
            success: true,
            session: {
                id: session.id,
                status: session.status,
                createdAt: session.createdAt,
            },
        });
    } catch (error) {
        console.error('Error starting voice session:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to start session',
        });
    }
});

/**
 * POST /api/voice/transcribe
 * Transcribe audio file
 */
router.post('/transcribe', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { sessionId, audio, mimeType } = req.body;

        if (!sessionId || !audio) {
            return res.status(400).json({
                success: false,
                error: 'sessionId and audio are required',
            });
        }

        const voiceService = getVoiceArchitectService({ userId });
        const transcription = await voiceService.transcribe(
            sessionId,
            audio,
            mimeType || 'audio/webm'
        );

        // Update database
        const session = voiceService.getSession(sessionId);
        if (session) {
            await db.update(voiceSessions)
                .set({
                    transcriptions: session.transcriptions as any,
                    status: session.status,
                })
                .where(eq(voiceSessions.id, sessionId));
        }

        res.json({
            success: true,
            transcription,
        });
    } catch (error) {
        console.error('Error transcribing audio:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Transcription failed',
        });
    }
});

/**
 * POST /api/voice/transcribe-text
 * Add text transcription directly (for typed input fallback)
 */
router.post('/transcribe-text', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { sessionId, text } = req.body;

        if (!sessionId || !text) {
            return res.status(400).json({
                success: false,
                error: 'sessionId and text are required',
            });
        }

        const voiceService = getVoiceArchitectService({ userId });
        const transcription = await voiceService.addTranscription(sessionId, text);

        // Update database
        const session = voiceService.getSession(sessionId);
        if (session) {
            await db.update(voiceSessions)
                .set({
                    transcriptions: session.transcriptions as any,
                    status: session.status,
                })
                .where(eq(voiceSessions.id, sessionId));
        }

        res.json({
            success: true,
            transcription,
        });
    } catch (error) {
        console.error('Error adding transcription:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to add transcription',
        });
    }
});

/**
 * POST /api/voice/extract-intent
 * Extract buildable intent from transcription
 */
router.post('/extract-intent', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'sessionId is required',
            });
        }

        const voiceService = getVoiceArchitectService({ userId });
        const intent = await voiceService.extractIntent(sessionId);

        // Update database
        const session = voiceService.getSession(sessionId);
        if (session) {
            await db.update(voiceSessions)
                .set({
                    extractedIntent: intent as any,
                    status: session.status,
                })
                .where(eq(voiceSessions.id, sessionId));
        }

        res.json({
            success: true,
            intent,
            nextClarification: voiceService.getNextClarification(sessionId),
        });
    } catch (error) {
        console.error('Error extracting intent:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Intent extraction failed',
        });
    }
});

/**
 * POST /api/voice/clarify
 * Submit clarification response
 */
router.post('/clarify', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { sessionId, ambiguityId, response } = req.body;

        if (!sessionId || !ambiguityId || !response) {
            return res.status(400).json({
                success: false,
                error: 'sessionId, ambiguityId, and response are required',
            });
        }

        const voiceService = getVoiceArchitectService({ userId });
        const intent = await voiceService.submitClarification(sessionId, ambiguityId, response);

        // Update database
        const session = voiceService.getSession(sessionId);
        if (session) {
            await db.update(voiceSessions)
                .set({
                    extractedIntent: intent as any,
                    clarifications: session.clarifications as any,
                    status: session.status,
                })
                .where(eq(voiceSessions.id, sessionId));
        }

        res.json({
            success: true,
            intent,
            nextClarification: voiceService.getNextClarification(sessionId),
            isReady: session?.status === 'ready',
        });
    } catch (error) {
        console.error('Error submitting clarification:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Clarification failed',
        });
    }
});

/**
 * POST /api/voice/to-build
 * Convert voice session to build request
 */
router.post('/to-build', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'sessionId is required',
            });
        }

        const voiceService = getVoiceArchitectService({ userId });
        const buildRequest = await voiceService.toBuildRequest(sessionId);

        // Update database
        const session = voiceService.getSession(sessionId);
        if (session) {
            await db.update(voiceSessions)
                .set({ status: 'building' })
                .where(eq(voiceSessions.id, sessionId));
        }

        res.json({
            success: true,
            buildRequest,
        });
    } catch (error) {
        console.error('Error converting to build:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Build conversion failed',
        });
    }
});

/**
 * GET /api/voice/session/:sessionId
 * Get session details
 */
router.get('/session/:sessionId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { sessionId } = req.params;

        // Try in-memory first
        const voiceService = getVoiceArchitectService({ userId });
        let session = voiceService.getSession(sessionId);

        // Fall back to database
        if (!session) {
            const dbSession = await db.select()
                .from(voiceSessions)
                .where(eq(voiceSessions.id, sessionId))
                .get();

            if (!dbSession) {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found',
                });
            }

            return res.json({
                success: true,
                session: {
                    id: dbSession.id,
                    userId: dbSession.userId,
                    projectId: dbSession.projectId,
                    transcriptions: dbSession.transcriptions,
                    extractedIntent: dbSession.extractedIntent,
                    clarifications: dbSession.clarifications,
                    status: dbSession.status,
                    createdAt: dbSession.createdAt,
                },
            });
        }

        res.json({
            success: true,
            session: {
                id: session.id,
                userId: session.userId,
                projectId: session.projectId,
                transcriptions: session.transcriptions,
                extractedIntent: session.extractedIntent,
                clarifications: session.clarifications,
                status: session.status,
                createdAt: session.createdAt,
            },
            nextClarification: voiceService.getNextClarification(sessionId),
        });
    } catch (error) {
        console.error('Error getting session:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get session',
        });
    }
});

/**
 * PUT /api/voice/transcription/:sessionId/:transcriptionId
 * Edit a transcription
 */
router.put('/transcription/:sessionId/:transcriptionId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { sessionId, transcriptionId } = req.params;
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({
                success: false,
                error: 'text is required',
            });
        }

        const voiceService = getVoiceArchitectService({ userId });
        const transcription = voiceService.editTranscription(sessionId, transcriptionId, text);

        // Update database
        const session = voiceService.getSession(sessionId);
        if (session) {
            await db.update(voiceSessions)
                .set({
                    transcriptions: session.transcriptions as any,
                    extractedIntent: null,
                    status: 'listening',
                })
                .where(eq(voiceSessions.id, sessionId));
        }

        res.json({
            success: true,
            transcription,
        });
    } catch (error) {
        console.error('Error editing transcription:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to edit transcription',
        });
    }
});

/**
 * DELETE /api/voice/session/:sessionId
 * End and delete a session
 */
router.delete('/session/:sessionId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { sessionId } = req.params;

        const voiceService = getVoiceArchitectService({ userId });
        voiceService.endSession(sessionId);

        // Delete from database
        await db.delete(voiceSessions)
            .where(eq(voiceSessions.id, sessionId));

        res.json({
            success: true,
            message: 'Session ended',
        });
    } catch (error) {
        console.error('Error ending session:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to end session',
        });
    }
});

/**
 * GET /api/voice/stream/:sessionId
 * SSE endpoint for real-time session updates
 */
router.get('/stream/:sessionId', authMiddleware, (req: Request, res: Response) => {
    const { sessionId } = req.params;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Register client
    if (!sseClients.has(sessionId)) {
        sseClients.set(sessionId, []);
    }
    sseClients.get(sessionId)!.push(res);

    // Send initial ping
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Handle disconnect
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
 * Set up event forwarding for a session
 */
function setupSessionEvents(voiceService: ReturnType<typeof getVoiceArchitectService>, sessionId: string): void {
    const events = [
        'transcription:started',
        'transcription:complete',
        'intent:extracting',
        'intent:extracted',
        'clarification:resolved',
        'status:changed',
        'build:ready',
    ];

    events.forEach(event => {
        voiceService.on(event, (data) => {
            if (data.sessionId === sessionId) {
                broadcastToSession(sessionId, { type: event, ...data });
            }
        });
    });
}

/**
 * Broadcast to all SSE clients for a session
 */
function broadcastToSession(sessionId: string, data: unknown): void {
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

