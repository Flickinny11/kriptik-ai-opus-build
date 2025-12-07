/**
 * Clone Mode API Routes
 *
 * Video → Code: Analyze screen recordings and generate UI code
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
    getVideoToCodeService,
    type VideoSource,
    type VideoAnalysisResult,
    type VideoToCodeProgress
} from '../services/ai/video-to-code.js';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { cloneModeSessions } from '../schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

// In-memory session storage for progress tracking
const activeSessions = new Map<string, {
    status: string;
    progress: number;
    message: string;
    result?: VideoAnalysisResult;
    error?: string;
}>();

// SSE clients for progress updates
const sseClients = new Map<string, Response[]>();

/**
 * POST /api/clone/analyze-video
 * Upload and analyze a video
 */
router.post('/analyze-video', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const {
            video,
            projectId,
            framework,
            styling,
            extractionOptions
        } = req.body;

        if (!video || !video.type || !video.data) {
            return res.status(400).json({
                success: false,
                error: 'Video source is required with type and data'
            });
        }

        const sessionId = uuidv4();

        // Initialize session
        activeSessions.set(sessionId, {
            status: 'uploading',
            progress: 0,
            message: 'Starting video analysis...'
        });

        // Create database record
        await db.insert(cloneModeSessions).values({
            id: sessionId,
            userId,
            projectId: projectId || null,
            videoUrl: video.type === 'url' ? video.data : null,
            status: 'analyzing',
            createdAt: new Date().toISOString()
        });

        // Start analysis in background
        const videoService = getVideoToCodeService();

        // Non-blocking analysis
        videoService.analyzeVideo(
            {
                video: video as VideoSource,
                projectId,
                framework,
                styling,
                extractionOptions
            },
            (progress: VideoToCodeProgress) => {
                // Update in-memory state
                activeSessions.set(sessionId, {
                    status: progress.stage,
                    progress: progress.progress,
                    message: progress.message
                });

                // Broadcast to SSE clients
                broadcastProgress(sessionId, progress);
            }
        ).then(async (result) => {
            // Update session with result
            activeSessions.set(sessionId, {
                status: 'complete',
                progress: 100,
                message: 'Analysis complete!',
                result
            });

            // Update database
            await db.update(cloneModeSessions)
                .set({
                    status: 'complete',
                    frameCount: result.frames.length,
                    analysisResult: result as any
                })
                .where(eq(cloneModeSessions.id, sessionId));

            broadcastProgress(sessionId, {
                stage: 'complete',
                progress: 100,
                message: 'Analysis complete!',
                data: result
            });
        }).catch(async (error) => {
            const errorMsg = error instanceof Error ? error.message : 'Analysis failed';
            activeSessions.set(sessionId, {
                status: 'error',
                progress: 0,
                message: errorMsg,
                error: errorMsg
            });

            await db.update(cloneModeSessions)
                .set({ status: 'error' })
                .where(eq(cloneModeSessions.id, sessionId));

            broadcastProgress(sessionId, {
                stage: 'error',
                progress: 0,
                message: errorMsg
            });
        });

        res.json({
            success: true,
            sessionId,
            message: 'Video analysis started'
        });
    } catch (error) {
        console.error('Error starting video analysis:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to start analysis'
        });
    }
});

/**
 * POST /api/clone/extract-frames
 * Extract frames from a video without full analysis
 */
router.post('/extract-frames', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { video, maxFrames } = req.body;

        if (!video || !video.type || !video.data) {
            return res.status(400).json({
                success: false,
                error: 'Video source is required'
            });
        }

        const sessionId = uuidv4();
        const videoService = getVideoToCodeService();

        // Quick frame extraction
        const result = await videoService.analyzeVideo(
            {
                video: video as VideoSource,
                extractionOptions: {
                    maxFrames: maxFrames || 10,
                    analyzeInteractions: false
                }
            },
            (progress) => {
                // Only partial progress for quick extraction
            }
        );

        res.json({
            success: true,
            sessionId,
            frames: result.frames.map(f => ({
                id: f.id,
                timestamp: f.timestamp,
                keyframe: f.keyframe,
                thumbnail: f.image.substring(0, 100) + '...', // Truncated for response
                hasImage: true
            })),
            frameCount: result.frames.length,
            keyframeCount: result.keyframeCount
        });
    } catch (error) {
        console.error('Error extracting frames:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to extract frames'
        });
    }
});

/**
 * POST /api/clone/generate
 * Generate code from video analysis
 */
router.post('/generate', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { sessionId, framework, styling } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'sessionId is required'
            });
        }

        // Get analysis result from session
        const session = activeSessions.get(sessionId);
        if (!session || !session.result) {
            // Try loading from database
            const dbSession = await db.select()
                .from(cloneModeSessions)
                .where(eq(cloneModeSessions.id, sessionId))
                .get();

            if (!dbSession || !dbSession.analysisResult) {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found or analysis not complete'
                });
            }

            // Use database result
            const analysis = dbSession.analysisResult as VideoAnalysisResult;

            const videoService = getVideoToCodeService();
            const codeResult = await videoService.generateCode(
                analysis,
                { framework, styling },
                (progress) => {
                    broadcastProgress(sessionId, progress);
                }
            );

            // Update database with generated code
            await db.update(cloneModeSessions)
                .set({
                    status: 'complete',
                    generatedCode: codeResult as any
                })
                .where(eq(cloneModeSessions.id, sessionId));

            return res.json({
                success: true,
                code: codeResult
            });
        }

        const videoService = getVideoToCodeService();
        const codeResult = await videoService.generateCode(
            session.result,
            { framework, styling },
            (progress) => {
                broadcastProgress(sessionId, progress);
            }
        );

        // Update database
        await db.update(cloneModeSessions)
            .set({
                status: 'complete',
                generatedCode: codeResult as any
            })
            .where(eq(cloneModeSessions.id, sessionId));

        res.json({
            success: true,
            code: codeResult
        });
    } catch (error) {
        console.error('Error generating code:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate code'
        });
    }
});

/**
 * GET /api/clone/status/:sessionId
 * SSE endpoint for progress updates
 */
router.get('/status/:sessionId', authMiddleware, (req: Request, res: Response) => {
    const { sessionId } = req.params;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send initial status
    const session = activeSessions.get(sessionId);
    if (session) {
        res.write(`data: ${JSON.stringify(session)}\n\n`);
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
 * GET /api/clone/session/:sessionId
 * Get session details
 */
router.get('/session/:sessionId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;

        // Check in-memory first
        const memorySession = activeSessions.get(sessionId);
        if (memorySession) {
            return res.json({
                success: true,
                session: memorySession
            });
        }

        // Check database
        const dbSession = await db.select()
            .from(cloneModeSessions)
            .where(eq(cloneModeSessions.id, sessionId))
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
                frameCount: dbSession.frameCount,
                hasAnalysis: !!dbSession.analysisResult,
                hasCode: !!dbSession.generatedCode,
                createdAt: dbSession.createdAt
            }
        });
    } catch (error) {
        console.error('Error getting session:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get session'
        });
    }
});

/**
 * GET /api/clone/sessions
 * Get all sessions for current user
 */
router.get('/sessions', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const sessions = await db.select({
            id: cloneModeSessions.id,
            projectId: cloneModeSessions.projectId,
            status: cloneModeSessions.status,
            frameCount: cloneModeSessions.frameCount,
            createdAt: cloneModeSessions.createdAt
        })
            .from(cloneModeSessions)
            .where(eq(cloneModeSessions.userId, userId));

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
 * GET /api/clone/analysis/:sessionId
 * Get full analysis result
 */
router.get('/analysis/:sessionId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;

        // Check in-memory first
        const memorySession = activeSessions.get(sessionId);
        if (memorySession?.result) {
            return res.json({
                success: true,
                analysis: memorySession.result
            });
        }

        // Check database
        const dbSession = await db.select()
            .from(cloneModeSessions)
            .where(eq(cloneModeSessions.id, sessionId))
            .get();

        if (!dbSession || !dbSession.analysisResult) {
            return res.status(404).json({
                success: false,
                error: 'Analysis not found'
            });
        }

        res.json({
            success: true,
            analysis: dbSession.analysisResult
        });
    } catch (error) {
        console.error('Error getting analysis:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get analysis'
        });
    }
});

/**
 * GET /api/clone/frame/:sessionId/:frameId
 * Get a specific frame image
 */
router.get('/frame/:sessionId/:frameId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { sessionId, frameId } = req.params;

        // Check in-memory first
        const memorySession = activeSessions.get(sessionId);
        if (memorySession?.result) {
            const frame = memorySession.result.frames.find(f => f.id === frameId);
            if (frame) {
                return res.json({
                    success: true,
                    frame: {
                        id: frame.id,
                        timestamp: frame.timestamp,
                        keyframe: frame.keyframe,
                        image: frame.image,
                        uiElements: frame.uiElements
                    }
                });
            }
        }

        // Check database
        const dbSession = await db.select()
            .from(cloneModeSessions)
            .where(eq(cloneModeSessions.id, sessionId))
            .get();

        if (!dbSession || !dbSession.analysisResult) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        const analysis = dbSession.analysisResult as VideoAnalysisResult;
        const frame = analysis.frames.find(f => f.id === frameId);

        if (!frame) {
            return res.status(404).json({
                success: false,
                error: 'Frame not found'
            });
        }

        res.json({
            success: true,
            frame: {
                id: frame.id,
                timestamp: frame.timestamp,
                keyframe: frame.keyframe,
                image: frame.image,
                uiElements: frame.uiElements
            }
        });
    } catch (error) {
        console.error('Error getting frame:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get frame'
        });
    }
});

/**
 * DELETE /api/clone/session/:sessionId
 * Delete a clone mode session
 */
router.delete('/session/:sessionId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.id;

        // Verify ownership
        const session = await db.select()
            .from(cloneModeSessions)
            .where(eq(cloneModeSessions.id, sessionId))
            .get();

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        if (session.userId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to delete this session'
            });
        }

        // Delete from database
        await db.delete(cloneModeSessions)
            .where(eq(cloneModeSessions.id, sessionId));

        // Remove from memory
        activeSessions.delete(sessionId);
        sseClients.delete(sessionId);

        res.json({
            success: true,
            message: 'Session deleted'
        });
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete session'
        });
    }
});

/**
 * Broadcast progress to SSE clients
 */
function broadcastProgress(sessionId: string, progress: VideoToCodeProgress): void {
    const clients = sseClients.get(sessionId);
    if (clients) {
        const data = JSON.stringify(progress);
        clients.forEach(client => {
            try {
                client.write(`data: ${data}\n\n`);
            } catch {
                // Client disconnected
            }
        });
    }
}

export default router;

