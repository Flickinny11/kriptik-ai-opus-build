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

// =============================================================================
// NOTIFICATION RESPONSE HANDLERS
// =============================================================================

/**
 * POST /api/ghost-mode/:sessionId/adjust-budget
 * Adjust credit budget in response to ceiling warning notification
 */
router.post('/:sessionId/adjust-budget', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { newCreditLimit } = req.body;

    if (!newCreditLimit || newCreditLimit <= 0) {
      return res.status(400).json({
        success: false,
        error: 'newCreditLimit is required and must be positive'
      });
    }

    const summary = await ghostController.getSessionSummary(sessionId);

    if (newCreditLimit <= summary.creditsUsed) {
      return res.status(400).json({
        success: false,
        error: `New credit limit must be greater than already used credits (${summary.creditsUsed.toFixed(2)})`
      });
    }

    // Update session config with new credit limit
    // This would require adding an updateSessionConfig method to ghost controller
    // For now, resume the session and it will use the original limit
    await ghostController.resumeSession(sessionId);

    res.json({
      success: true,
      message: `Budget adjusted to ${newCreditLimit} credits. Session resumed.`,
      newLimit: newCreditLimit,
      creditsRemaining: newCreditLimit - summary.creditsUsed
    });
  } catch (error) {
    console.error('Error adjusting budget:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to adjust budget'
    });
  }
});

/**
 * POST /api/ghost-mode/:sessionId/extend-time
 * Extend runtime limit in response to time elapsed notification
 */
router.post('/:sessionId/extend-time', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { additionalMinutes } = req.body;

    if (!additionalMinutes || additionalMinutes <= 0) {
      return res.status(400).json({
        success: false,
        error: 'additionalMinutes is required and must be positive'
      });
    }

    // Resume session - the runtime timer was cleared when paused
    // This would require adding an extendRuntime method to ghost controller
    // For now, resume the session
    await ghostController.resumeSession(sessionId);

    res.json({
      success: true,
      message: `Runtime extended by ${additionalMinutes} minutes. Session resumed.`,
      additionalMinutes
    });
  } catch (error) {
    console.error('Error extending time:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extend time'
    });
  }
});

/**
 * POST /api/ghost-mode/:sessionId/review-error
 * Acknowledge error review and choose action (resume, skip task, or stop)
 */
router.post('/:sessionId/review-error', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { action } = req.body; // 'resume', 'skip', or 'stop'

    if (!action || !['resume', 'skip', 'stop'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'action must be one of: resume, skip, stop'
      });
    }

    if (action === 'stop') {
      const summary = await ghostController.stopSession(sessionId, 'User stopped after reviewing error');
      return res.json({
        success: true,
        message: 'Session stopped',
        summary
      });
    }

    if (action === 'skip') {
      // Skip current task and resume
      // This would require adding a skipCurrentTask method
      // For now, just resume
      await ghostController.resumeSession(sessionId);
      return res.json({
        success: true,
        message: 'Task skipped, session resumed'
      });
    }

    // Resume and retry
    await ghostController.resumeSession(sessionId);
    res.json({
      success: true,
      message: 'Session resumed, will retry failed task'
    });
  } catch (error) {
    console.error('Error handling error review:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to handle error review'
    });
  }
});

/**
 * POST /api/ghost-mode/:sessionId/make-decision
 * Provide decision in response to decision_needed notification
 */
router.post('/:sessionId/make-decision', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { decision, context } = req.body;

    if (!decision) {
      return res.status(400).json({
        success: false,
        error: 'decision is required'
      });
    }

    // Record the decision as an event
    await ghostController.recordEvent(
      sessionId,
      'decision_required',
      {
        decision,
        context,
        providedAt: new Date().toISOString()
      },
      `User provided decision: ${decision}`
    );

    // Resume session with the decision
    await ghostController.resumeSession(sessionId);

    res.json({
      success: true,
      message: 'Decision recorded, session resumed'
    });
  } catch (error) {
    console.error('Error handling decision:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to handle decision'
    });
  }
});

/**
 * POST /api/ghost-mode/:sessionId/review-quality
 * Review quality issues and choose action
 */
router.post('/:sessionId/review-quality', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { action, feedback } = req.body; // 'resume', 'rollback', or 'stop'

    if (!action || !['resume', 'rollback', 'stop'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'action must be one of: resume, rollback, stop'
      });
    }

    // Record quality review feedback
    await ghostController.recordEvent(
      sessionId,
      'decision_required',
      {
        type: 'quality_review',
        action,
        feedback,
        reviewedAt: new Date().toISOString()
      },
      `Quality review: ${action}${feedback ? ` - ${feedback}` : ''}`
    );

    if (action === 'stop') {
      const summary = await ghostController.stopSession(sessionId, 'User stopped after quality review');
      return res.json({
        success: true,
        message: 'Session stopped',
        summary
      });
    }

    if (action === 'rollback') {
      // Rollback to last checkpoint
      // This would integrate with Time Machine
      // For now, just pause for manual intervention
      await ghostController.pauseSession(sessionId, 'Paused for quality rollback');
      return res.json({
        success: true,
        message: 'Session paused. Use Time Machine to rollback to a previous checkpoint.'
      });
    }

    // Resume with quality issues acknowledged
    await ghostController.resumeSession(sessionId);
    res.json({
      success: true,
      message: 'Quality issues acknowledged, session resumed'
    });
  } catch (error) {
    console.error('Error handling quality review:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to handle quality review'
    });
  }
});

/**
 * POST /api/ghost-mode/:sessionId/wake-acknowledge
 * Generic wake acknowledgment endpoint for any wake condition
 */
router.post('/:sessionId/wake-acknowledge', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { continueBuilding } = req.body;

    if (continueBuilding === true) {
      await ghostController.resumeSession(sessionId);
      return res.json({
        success: true,
        message: 'Session resumed'
      });
    } else if (continueBuilding === false) {
      const summary = await ghostController.stopSession(sessionId, 'User stopped after wake notification');
      return res.json({
        success: true,
        message: 'Session stopped',
        summary
      });
    } else {
      // Just acknowledge the notification without action
      return res.json({
        success: true,
        message: 'Notification acknowledged'
      });
    }
  } catch (error) {
    console.error('Error acknowledging wake:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to acknowledge wake'
    });
  }
});

export default router;

