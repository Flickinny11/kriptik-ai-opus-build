/**
 * Extended Autonomy API Routes
 *
 * Endpoints for autonomous operations:
 * - Configure autonomy mode (Supervised/Standard/Extended/Maximum)
 * - Monitor long-running builds
 * - Push notification preferences
 * - Session management
 */

import { Router, Request, Response } from 'express';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

export type AutonomyMode = 'supervised' | 'standard' | 'extended' | 'maximum';

export interface AutonomyConfig {
    mode: AutonomyMode;
    maxDurationMinutes: number;
    pushNotifications: {
        onCheckpoint: boolean;
        onCompletion: boolean;
        onEscalation: boolean;
        onError: boolean;
    };
    autoApprove: {
        minorChanges: boolean;
        styleChanges: boolean;
        bugFixes: boolean;
    };
    pauseConditions: {
        onCriticalError: boolean;
        onSecurityIssue: boolean;
        onBudgetThreshold: boolean;
    };
}

export interface AutonomySession {
    id: string;
    projectId: string;
    userId: string;
    config: AutonomyConfig;
    status: 'idle' | 'running' | 'paused' | 'complete' | 'failed';
    startedAt?: Date;
    pausedAt?: Date;
    completedAt?: Date;
    events: AutonomyEvent[];
    metrics: {
        featuresCompleted: number;
        checkpointsCreated: number;
        errorsFixed: number;
        escalations: number;
        totalDurationMs: number;
    };
}

export interface AutonomyEvent {
    type: 'checkpoint' | 'completion' | 'escalation' | 'error' | 'pause' | 'resume';
    timestamp: Date;
    message: string;
    data?: any;
}

// ============================================================================
// AUTONOMY MODE CONFIGURATIONS
// ============================================================================

const AUTONOMY_MODES: Record<AutonomyMode, Omit<AutonomyConfig, 'pushNotifications' | 'autoApprove' | 'pauseConditions'>> = {
    supervised: {
        mode: 'supervised',
        maxDurationMinutes: 30,
    },
    standard: {
        mode: 'standard',
        maxDurationMinutes: 60,
    },
    extended: {
        mode: 'extended',
        maxDurationMinutes: 120,
    },
    maximum: {
        mode: 'maximum',
        maxDurationMinutes: 240, // 4 hours
    },
};

// Active autonomy sessions
const autonomySessions = new Map<string, AutonomySession>();

// Event emitter for push notifications
const autonomyEvents = new EventEmitter();

/**
 * GET /api/autonomy/modes
 * Get all available autonomy modes
 */
router.get('/modes', async (req: Request, res: Response) => {
    try {
        const modes = Object.entries(AUTONOMY_MODES).map(([key, config]) => ({
            mode: key,
            maxDurationMinutes: config.maxDurationMinutes,
            description: getAutonomyModeDescription(key as AutonomyMode),
        }));
        
        res.json({
            success: true,
            modes,
            default: 'standard',
        });
    } catch (error) {
        console.error('Failed to get autonomy modes:', error);
        res.status(500).json({
            error: 'Failed to get autonomy modes',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/autonomy/session/create
 * Create a new autonomy session
 */
router.post('/session/create', async (req: Request, res: Response) => {
    try {
        const { projectId, mode = 'standard', pushNotifications, autoApprove, pauseConditions } = req.body;
        const userId = (req as any).user?.id || 'anonymous';
        
        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }
        
        const validModes: AutonomyMode[] = ['supervised', 'standard', 'extended', 'maximum'];
        if (!validModes.includes(mode)) {
            return res.status(400).json({
                error: 'Invalid autonomy mode',
                validModes,
            });
        }
        
        const sessionId = `autonomy-${uuidv4()}`;
        const modeConfig = AUTONOMY_MODES[mode as AutonomyMode];
        
        const session: AutonomySession = {
            id: sessionId,
            projectId,
            userId,
            config: {
                ...modeConfig,
                pushNotifications: pushNotifications || {
                    onCheckpoint: true,
                    onCompletion: true,
                    onEscalation: true,
                    onError: true,
                },
                autoApprove: autoApprove || {
                    minorChanges: mode !== 'supervised',
                    styleChanges: mode !== 'supervised',
                    bugFixes: mode !== 'supervised',
                },
                pauseConditions: pauseConditions || {
                    onCriticalError: true,
                    onSecurityIssue: true,
                    onBudgetThreshold: true,
                },
            },
            status: 'idle',
            events: [],
            metrics: {
                featuresCompleted: 0,
                checkpointsCreated: 0,
                errorsFixed: 0,
                escalations: 0,
                totalDurationMs: 0,
            },
        };
        
        autonomySessions.set(sessionId, session);
        
        res.json({
            success: true,
            sessionId,
            session: {
                id: session.id,
                projectId: session.projectId,
                config: session.config,
                status: session.status,
            },
        });
    } catch (error) {
        console.error('Failed to create autonomy session:', error);
        res.status(500).json({
            error: 'Failed to create autonomy session',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/autonomy/session/:sessionId/start
 * Start an autonomy session
 */
router.post('/session/:sessionId/start', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const session = autonomySessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        if (session.status === 'running') {
            return res.status(400).json({ error: 'Session already running' });
        }
        
        session.status = 'running';
        session.startedAt = new Date();
        session.events.push({
            type: 'resume',
            timestamp: new Date(),
            message: 'Autonomy session started',
        });
        
        // Set up auto-stop timer
        const maxDurationMs = session.config.maxDurationMinutes * 60 * 1000;
        setTimeout(() => {
            const currentSession = autonomySessions.get(sessionId);
            if (currentSession && currentSession.status === 'running') {
                currentSession.status = 'complete';
                currentSession.completedAt = new Date();
                currentSession.events.push({
                    type: 'completion',
                    timestamp: new Date(),
                    message: 'Session completed (max duration reached)',
                });
                autonomyEvents.emit('completion', sessionId);
            }
        }, maxDurationMs);
        
        res.json({
            success: true,
            sessionId,
            status: 'running',
            maxDurationMinutes: session.config.maxDurationMinutes,
            startedAt: session.startedAt,
        });
    } catch (error) {
        console.error('Failed to start session:', error);
        res.status(500).json({
            error: 'Failed to start session',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/autonomy/session/:sessionId/pause
 * Pause an autonomy session
 */
router.post('/session/:sessionId/pause', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const { reason } = req.body;
        const session = autonomySessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        if (session.status !== 'running') {
            return res.status(400).json({ error: 'Session is not running' });
        }
        
        session.status = 'paused';
        session.pausedAt = new Date();
        session.events.push({
            type: 'pause',
            timestamp: new Date(),
            message: reason || 'Session paused by user',
        });
        
        res.json({
            success: true,
            sessionId,
            status: 'paused',
            pausedAt: session.pausedAt,
        });
    } catch (error) {
        console.error('Failed to pause session:', error);
        res.status(500).json({
            error: 'Failed to pause session',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/autonomy/session/:sessionId/resume
 * Resume a paused session
 */
router.post('/session/:sessionId/resume', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const session = autonomySessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        if (session.status !== 'paused') {
            return res.status(400).json({ error: 'Session is not paused' });
        }
        
        session.status = 'running';
        session.events.push({
            type: 'resume',
            timestamp: new Date(),
            message: 'Session resumed',
        });
        
        res.json({
            success: true,
            sessionId,
            status: 'running',
        });
    } catch (error) {
        console.error('Failed to resume session:', error);
        res.status(500).json({
            error: 'Failed to resume session',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/autonomy/session/:sessionId/stop
 * Stop an autonomy session
 */
router.post('/session/:sessionId/stop', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const session = autonomySessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        session.status = 'complete';
        session.completedAt = new Date();
        
        if (session.startedAt) {
            session.metrics.totalDurationMs = session.completedAt.getTime() - session.startedAt.getTime();
        }
        
        session.events.push({
            type: 'completion',
            timestamp: new Date(),
            message: 'Session stopped by user',
        });
        
        res.json({
            success: true,
            sessionId,
            status: 'complete',
            metrics: session.metrics,
        });
    } catch (error) {
        console.error('Failed to stop session:', error);
        res.status(500).json({
            error: 'Failed to stop session',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/autonomy/session/:sessionId
 * Get session details
 */
router.get('/session/:sessionId', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const session = autonomySessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        res.json({
            success: true,
            session: {
                id: session.id,
                projectId: session.projectId,
                config: session.config,
                status: session.status,
                startedAt: session.startedAt,
                pausedAt: session.pausedAt,
                completedAt: session.completedAt,
                events: session.events.slice(-20), // Last 20 events
                metrics: session.metrics,
            },
        });
    } catch (error) {
        console.error('Failed to get session:', error);
        res.status(500).json({
            error: 'Failed to get session',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/autonomy/session/:sessionId/events
 * Get session events (with SSE support)
 */
router.get('/session/:sessionId/events', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const session = autonomySessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        // Check if client wants SSE
        if (req.headers.accept === 'text/event-stream') {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            
            const sendEvent = (event: AutonomyEvent) => {
                res.write(`data: ${JSON.stringify(event)}\n\n`);
            };
            
            // Send existing events
            session.events.forEach(sendEvent);
            
            // Listen for new events
            const listener = (event: AutonomyEvent) => sendEvent(event);
            autonomyEvents.on(sessionId, listener);
            
            req.on('close', () => {
                autonomyEvents.off(sessionId, listener);
            });
        } else {
            // Regular JSON response
            res.json({
                success: true,
                sessionId,
                events: session.events,
            });
        }
    } catch (error) {
        console.error('Failed to get events:', error);
        res.status(500).json({
            error: 'Failed to get events',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/autonomy/session/:sessionId/event
 * Add an event to a session (internal use)
 */
router.post('/session/:sessionId/event', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const { type, message, data } = req.body;
        const session = autonomySessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        const event: AutonomyEvent = {
            type,
            timestamp: new Date(),
            message,
            data,
        };
        
        session.events.push(event);
        autonomyEvents.emit(sessionId, event);
        
        // Update metrics based on event type
        switch (type) {
            case 'checkpoint':
                session.metrics.checkpointsCreated++;
                break;
            case 'completion':
                session.metrics.featuresCompleted++;
                break;
            case 'escalation':
                session.metrics.escalations++;
                break;
            case 'error':
                session.metrics.errorsFixed++;
                break;
        }
        
        res.json({
            success: true,
            event,
        });
    } catch (error) {
        console.error('Failed to add event:', error);
        res.status(500).json({
            error: 'Failed to add event',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/autonomy/sessions/active
 * List all active autonomy sessions
 */
router.get('/sessions/active', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        
        const sessions = Array.from(autonomySessions.values())
            .filter(s => s.status === 'running' || s.status === 'paused')
            .filter(s => !userId || s.userId === userId)
            .map(s => ({
                id: s.id,
                projectId: s.projectId,
                mode: s.config.mode,
                status: s.status,
                startedAt: s.startedAt,
                metrics: s.metrics,
            }));
        
        res.json({
            success: true,
            count: sessions.length,
            sessions,
        });
    } catch (error) {
        console.error('Failed to list sessions:', error);
        res.status(500).json({
            error: 'Failed to list sessions',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * DELETE /api/autonomy/session/:sessionId
 * Delete a completed session
 */
router.delete('/session/:sessionId', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const session = autonomySessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        if (session.status === 'running') {
            return res.status(400).json({ error: 'Cannot delete running session' });
        }
        
        autonomySessions.delete(sessionId);
        
        res.json({
            success: true,
            sessionId,
            message: 'Session deleted',
        });
    } catch (error) {
        console.error('Failed to delete session:', error);
        res.status(500).json({
            error: 'Failed to delete session',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

// Helper function
function getAutonomyModeDescription(mode: AutonomyMode): string {
    switch (mode) {
        case 'supervised':
            return 'Manual approval required for all changes. 30 min max.';
        case 'standard':
            return 'Auto-approve minor changes. 1 hour max.';
        case 'extended':
            return 'Auto-approve most changes, pause on critical. 2 hours max.';
        case 'maximum':
            return 'Full autonomy, minimal interruption. 4 hours max.';
    }
}

export default router;

