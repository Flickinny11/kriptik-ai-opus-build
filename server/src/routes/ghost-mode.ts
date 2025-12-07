/**
 * Ghost Mode API Routes
 *
 * F048-F050: Autonomous background building endpoints
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { createGhostModeController, createGhostEventRecorder } from '../services/ghost-mode/index.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const ghostController = createGhostModeController();
const eventRecorder = createGhostEventRecorder();

/**
 * POST /api/ghost-mode/start
 * Start a new Ghost Mode session
 */
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const { projectId, tasks, wakeConditions, config } = req.body;
    const userId = req.user?.id;

    if (!userId || !projectId || !tasks) {
      return res.status(400).json({
        success: false,
        error: 'projectId and tasks are required'
      });
    }

    const sessionId = await ghostController.startSession({
      sessionId: uuidv4(),
      projectId,
      userId,
      tasks: tasks.map((t: any) => ({
        id: t.id || uuidv4(),
        description: t.description,
        priority: t.priority || 1,
        estimatedCredits: t.estimatedCredits || 10,
        dependencies: t.dependencies || [],
        status: 'pending'
      })),
      wakeConditions: wakeConditions || [
        {
          id: uuidv4(),
          type: 'completion',
          description: 'Wake when all tasks complete',
          priority: 'normal',
          notificationChannels: ['email']
        }
      ],
      maxRuntime: config?.maxRuntime || 120, // 2 hours default
      maxCredits: config?.maxCredits || 100,
      checkpointInterval: config?.checkpointInterval || 15, // 15 minutes
      retryPolicy: config?.retryPolicy || {
        maxRetries: 3,
        backoffMultiplier: 2,
        initialDelayMs: 1000,
        maxDelayMs: 60000,
        retryableErrors: ['timeout', 'rate_limit', 'temporary_failure']
      },
      pauseOnFirstError: config?.pauseOnFirstError ?? true,
      autonomyLevel: config?.autonomyLevel || 'moderate'
    });

    // Start event recording
    eventRecorder.startRecording(sessionId);

    res.json({
      success: true,
      sessionId,
      message: 'Ghost Mode session started'
    });
  } catch (error) {
    console.error('Error starting Ghost Mode:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start Ghost Mode'
    });
  }
});

/**
 * POST /api/ghost-mode/pause/:sessionId
 * Pause a Ghost Mode session
 */
router.post('/pause/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reason } = req.body;

    await ghostController.pauseSession(sessionId, reason);

    res.json({
      success: true,
      message: 'Session paused'
    });
  } catch (error) {
    console.error('Error pausing session:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pause session'
    });
  }
});

/**
 * POST /api/ghost-mode/resume/:sessionId
 * Resume a paused Ghost Mode session
 */
router.post('/resume/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    await ghostController.resumeSession(sessionId);

    res.json({
      success: true,
      message: 'Session resumed'
    });
  } catch (error) {
    console.error('Error resuming session:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resume session'
    });
  }
});

/**
 * POST /api/ghost-mode/stop/:sessionId
 * Stop a Ghost Mode session
 */
router.post('/stop/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reason } = req.body;

    const summary = await ghostController.stopSession(sessionId, reason);
    eventRecorder.stopRecording(sessionId);

    res.json({
      success: true,
      summary
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
 * GET /api/ghost-mode/summary/:sessionId
 * Get session summary
 */
router.get('/summary/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const summary = await ghostController.getSessionSummary(sessionId);

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Error getting summary:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get summary'
    });
  }
});

/**
 * GET /api/ghost-mode/events/:sessionId
 * Get events for a session
 */
router.get('/events/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit } = req.query;

    const events = await ghostController.getEvents(sessionId, limit ? parseInt(limit as string) : undefined);

    res.json({
      success: true,
      events
    });
  } catch (error) {
    console.error('Error getting events:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get events'
    });
  }
});

/**
 * GET /api/ghost-mode/sessions
 * Get all active sessions for the current user
 */
router.get('/sessions', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const sessions = await ghostController.getActiveSessionsForUser(userId);

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

// =============================================================================
// REPLAY ENDPOINTS (F049)
// =============================================================================

/**
 * POST /api/ghost-mode/replay/create
 * Create a replay session
 */
router.post('/replay/create', authMiddleware, async (req, res) => {
  try {
    const { sessionId, startTime, endTime, speed, includeFileContent, includeAgentLogs, frameSamplingRate } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId is required'
      });
    }

    const replay = await eventRecorder.createReplaySession({
      sessionId,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      speed: speed || 1,
      includeFileContent: includeFileContent ?? true,
      includeAgentLogs: includeAgentLogs ?? true,
      frameSamplingRate: frameSamplingRate || 1000 // 1 second default
    });

    res.json({
      success: true,
      replayId: replay.id,
      totalFrames: replay.frames.length,
      totalDuration: replay.totalDuration,
      startTime: replay.startTime,
      endTime: replay.endTime
    });
  } catch (error) {
    console.error('Error creating replay:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create replay'
    });
  }
});

/**
 * GET /api/ghost-mode/replay/:replayId/frame
 * Get current frame of a replay
 */
router.get('/replay/:replayId/frame', authMiddleware, async (req, res) => {
  try {
    const { replayId } = req.params;

    const frame = eventRecorder.getCurrentFrame(replayId);

    if (!frame) {
      return res.status(404).json({
        success: false,
        error: 'Frame not found'
      });
    }

    res.json({
      success: true,
      frame
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
 * POST /api/ghost-mode/replay/:replayId/seek
 * Seek to a specific frame or time
 */
router.post('/replay/:replayId/seek', authMiddleware, async (req, res) => {
  try {
    const { replayId } = req.params;
    const { frameIndex, timestamp } = req.body;

    let frame;
    if (frameIndex !== undefined) {
      frame = eventRecorder.seekToFrame(replayId, frameIndex);
    } else if (timestamp) {
      frame = eventRecorder.seekToTime(replayId, new Date(timestamp));
    } else {
      return res.status(400).json({
        success: false,
        error: 'frameIndex or timestamp required'
      });
    }

    if (!frame) {
      return res.status(404).json({
        success: false,
        error: 'Frame not found'
      });
    }

    res.json({
      success: true,
      frame
    });
  } catch (error) {
    console.error('Error seeking:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to seek'
    });
  }
});

/**
 * POST /api/ghost-mode/replay/:replayId/next
 * Get next frame
 */
router.post('/replay/:replayId/next', authMiddleware, async (req, res) => {
  try {
    const { replayId } = req.params;

    const frame = eventRecorder.nextFrame(replayId);

    res.json({
      success: true,
      frame,
      hasNext: frame !== null
    });
  } catch (error) {
    console.error('Error getting next frame:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get next frame'
    });
  }
});

/**
 * POST /api/ghost-mode/replay/:replayId/previous
 * Get previous frame
 */
router.post('/replay/:replayId/previous', authMiddleware, async (req, res) => {
  try {
    const { replayId } = req.params;

    const frame = eventRecorder.previousFrame(replayId);

    res.json({
      success: true,
      frame,
      hasPrevious: frame !== null
    });
  } catch (error) {
    console.error('Error getting previous frame:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get previous frame'
    });
  }
});

/**
 * GET /api/ghost-mode/replay/:replayId/info
 * Get replay session info
 */
router.get('/replay/:replayId/info', authMiddleware, async (req, res) => {
  try {
    const { replayId } = req.params;

    const info = eventRecorder.getReplayInfo(replayId);

    if (!info) {
      return res.status(404).json({
        success: false,
        error: 'Replay not found'
      });
    }

    res.json({
      success: true,
      ...info
    });
  } catch (error) {
    console.error('Error getting replay info:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get replay info'
    });
  }
});

/**
 * DELETE /api/ghost-mode/replay/:replayId
 * Close replay session
 */
router.delete('/replay/:replayId', authMiddleware, async (req, res) => {
  try {
    const { replayId } = req.params;

    eventRecorder.closeReplay(replayId);

    res.json({
      success: true,
      message: 'Replay closed'
    });
  } catch (error) {
    console.error('Error closing replay:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to close replay'
    });
  }
});

/**
 * GET /api/ghost-mode/groups/:sessionId
 * Get grouped events for display
 */
router.get('/groups/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const groups = await eventRecorder.groupEvents(sessionId);

    res.json({
      success: true,
      groups
    });
  } catch (error) {
    console.error('Error getting groups:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get groups'
    });
  }
});

/**
 * GET /api/ghost-mode/stats/:sessionId
 * Get session statistics
 */
router.get('/stats/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const stats = await eventRecorder.getSessionStats(sessionId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get stats'
    });
  }
});

export default router;

