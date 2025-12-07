/**
 * Soft Interrupt System API Routes
 * 
 * F046: Non-blocking agent input endpoints
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { createSoftInterruptManager } from '../services/soft-interrupt';

const router = Router();
const interruptManager = createSoftInterruptManager();

/**
 * POST /api/soft-interrupt/submit
 * Submit a user interrupt for classification and queuing
 */
router.post('/submit', authMiddleware, async (req, res) => {
  try {
    const { sessionId, message, agentId } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({
        success: false,
        error: 'sessionId and message are required'
      });
    }

    const classified = await interruptManager.submitInterrupt(
      sessionId,
      message,
      agentId
    );

    res.json({
      success: true,
      interrupt: classified
    });
  } catch (error) {
    console.error('Error submitting interrupt:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit interrupt'
    });
  }
});

/**
 * GET /api/soft-interrupt/pending/:sessionId
 * Get pending interrupts for a session
 */
router.get('/pending/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const interrupts = await interruptManager.getInterruptHistory(sessionId);
    const pending = interrupts.filter(i => i.status === 'pending');

    res.json({
      success: true,
      interrupts: pending
    });
  } catch (error) {
    console.error('Error getting pending interrupts:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get interrupts'
    });
  }
});

/**
 * GET /api/soft-interrupt/history/:sessionId
 * Get full interrupt history for a session
 */
router.get('/history/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const interrupts = await interruptManager.getInterruptHistory(sessionId);

    res.json({
      success: true,
      interrupts
    });
  } catch (error) {
    console.error('Error getting interrupt history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get history'
    });
  }
});

/**
 * POST /api/soft-interrupt/apply
 * Apply a specific interrupt to an agent
 */
router.post('/apply', authMiddleware, async (req, res) => {
  try {
    const { interruptId, agentId } = req.body;

    if (!interruptId || !agentId) {
      return res.status(400).json({
        success: false,
        error: 'interruptId and agentId are required'
      });
    }

    // Find the interrupt in history
    // This is a simplified implementation - in production you'd store interrupts in DB
    const allSessions = Array.from((interruptManager as any).interruptQueue.keys());
    let targetInterrupt = null;
    
    for (const sessionId of allSessions) {
      const interrupts = await interruptManager.getInterruptHistory(sessionId);
      targetInterrupt = interrupts.find(i => i.id === interruptId);
      if (targetInterrupt) break;
    }

    if (!targetInterrupt) {
      return res.status(404).json({
        success: false,
        error: 'Interrupt not found'
      });
    }

    const result = await interruptManager.applyInterrupt(targetInterrupt, agentId);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Error applying interrupt:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply interrupt'
    });
  }
});

/**
 * POST /api/soft-interrupt/clarification-response
 * Resume an agent after clarification
 */
router.post('/clarification-response', authMiddleware, async (req, res) => {
  try {
    const { agentId, response } = req.body;

    if (!agentId || !response) {
      return res.status(400).json({
        success: false,
        error: 'agentId and response are required'
      });
    }

    await interruptManager.resumeAfterClarification(agentId, response);

    res.json({
      success: true,
      message: 'Agent resumed with clarification response'
    });
  } catch (error) {
    console.error('Error resuming agent:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resume agent'
    });
  }
});

/**
 * POST /api/soft-interrupt/clear/:sessionId
 * Clear processed interrupts from a session
 */
router.post('/clear/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    interruptManager.clearProcessedInterrupts(sessionId);

    res.json({
      success: true,
      message: 'Processed interrupts cleared'
    });
  } catch (error) {
    console.error('Error clearing interrupts:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear interrupts'
    });
  }
});

/**
 * POST /api/soft-interrupt/context-update
 * Update agent execution context (called by agent service)
 */
router.post('/context-update', authMiddleware, async (req, res) => {
  try {
    const { sessionId, agentId, phase, tool } = req.body;

    if (!sessionId || !agentId || !phase) {
      return res.status(400).json({
        success: false,
        error: 'sessionId, agentId, and phase are required'
      });
    }

    interruptManager.updateAgentContext(sessionId, agentId, phase, tool);

    res.json({
      success: true,
      message: 'Context updated'
    });
  } catch (error) {
    console.error('Error updating context:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update context'
    });
  }
});

/**
 * GET /api/soft-interrupt/check-boundary/:sessionId/:agentId
 * Check for pending interrupts at a tool boundary
 */
router.get('/check-boundary/:sessionId/:agentId', authMiddleware, async (req, res) => {
  try {
    const { sessionId, agentId } = req.params;

    const interrupts = await interruptManager.getInterruptsAtToolBoundary(
      sessionId,
      agentId
    );

    res.json({
      success: true,
      hasInterrupts: interrupts.length > 0,
      interrupts
    });
  } catch (error) {
    console.error('Error checking boundary:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check boundary'
    });
  }
});

export default router;

