/**
 * Model Testing API Routes
 *
 * Handles model testing and comparison endpoints.
 * Supports side-by-side comparison of pretrained vs fine-tuned models.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  getTestSessionManager,
  getTestBillingService,
  getModelInferenceService,
  getComparisonEngine,
} from '../services/training/index.js';

const modelTestingRouter = Router();

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

/**
 * POST /api/model-testing/sessions
 * Create a new test session for a training job
 */
modelTestingRouter.post('/sessions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { trainingJobId } = req.body;
    if (!trainingJobId) {
      return res.status(400).json({ error: 'trainingJobId is required' });
    }

    // Check if user has enough credits
    const billingService = getTestBillingService();
    const balance = await billingService.getBalance(userId);
    if (balance < 10) { // Minimum 10 credits to start a session
      return res.status(402).json({ 
        error: 'Insufficient credits',
        required: 10,
        current: balance,
      });
    }

    const sessionManager = getTestSessionManager();
    const session = await sessionManager.createSession(userId, trainingJobId);

    res.status(201).json({
      message: 'Test session created',
      session: {
        id: session.id,
        trainingJobId: session.trainingJobId,
        pretrainedModelId: session.pretrainedModelId,
        finetunedModelId: session.finetunedModelId,
        modality: session.modality,
        status: session.status,
        createdAt: session.createdAt,
      },
    });
  } catch (error) {
    console.error('[Model Testing API] Create session error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create test session',
    });
  }
});

/**
 * POST /api/model-testing/sessions/:id/test
 * Run a test within a session
 */
modelTestingRouter.post('/sessions/:id/test', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id: sessionId } = req.params;
    const { input, parameters } = req.body;

    if (!input || (!input.text && !input.imageUrl && !input.audioUrl)) {
      return res.status(400).json({ error: 'Input is required (text, imageUrl, or audioUrl)' });
    }

    const sessionManager = getTestSessionManager();
    
    // Verify session ownership
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Run the test
    const result = await sessionManager.runTest(sessionId, input, parameters);

    res.json({
      message: 'Test completed',
      result: {
        id: result.id,
        pretrainedOutput: result.pretrainedOutput,
        finetunedOutput: result.finetunedOutput,
        comparison: result.comparison,
        timestamp: result.timestamp,
      },
    });
  } catch (error) {
    console.error('[Model Testing API] Run test error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to run test',
    });
  }
});

/**
 * GET /api/model-testing/sessions/:id
 * Get session details with all results
 */
modelTestingRouter.get('/sessions/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id: sessionId } = req.params;

    const sessionManager = getTestSessionManager();
    const session = await sessionManager.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ session });
  } catch (error) {
    console.error('[Model Testing API] Get session error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get session',
    });
  }
});

/**
 * DELETE /api/model-testing/sessions/:id
 * End a test session
 */
modelTestingRouter.delete('/sessions/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id: sessionId } = req.params;
    const { permanent } = req.query;

    const sessionManager = getTestSessionManager();

    // Verify session ownership
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (permanent === 'true') {
      // Permanently delete session and results
      await sessionManager.deleteSession(sessionId, userId);
      res.json({ message: 'Session deleted permanently' });
    } else {
      // Just end the session
      const summary = await sessionManager.endSession(sessionId);
      res.json({
        message: 'Session ended',
        summary,
      });
    }
  } catch (error) {
    console.error('[Model Testing API] End session error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to end session',
    });
  }
});

/**
 * GET /api/model-testing/sessions
 * Get all sessions for the current user
 */
modelTestingRouter.get('/sessions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sessionManager = getTestSessionManager();
    const sessions = await sessionManager.getUserSessions(userId);

    // Return summary without full test results
    const summaries = sessions.map(s => ({
      id: s.id,
      trainingJobId: s.trainingJobId,
      pretrainedModelId: s.pretrainedModelId,
      finetunedModelId: s.finetunedModelId,
      modality: s.modality,
      testCount: s.tests.length,
      totalCost: s.totalCost,
      status: s.status,
      createdAt: s.createdAt,
      endedAt: s.endedAt,
    }));

    res.json({ sessions: summaries });
  } catch (error) {
    console.error('[Model Testing API] Get sessions error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get sessions',
    });
  }
});

// =============================================================================
// QUICK COMPARISON (NO SESSION)
// =============================================================================

/**
 * POST /api/model-testing/quick-compare
 * Run a quick comparison without creating a full session
 */
modelTestingRouter.post('/quick-compare', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { pretrainedModelId, finetunedModelId, modality, input, parameters } = req.body;

    if (!pretrainedModelId || !finetunedModelId || !modality || !input) {
      return res.status(400).json({
        error: 'pretrainedModelId, finetunedModelId, modality, and input are required',
      });
    }

    // Check credits
    const billingService = getTestBillingService();
    const hasCredits = await billingService.checkCredits(userId, modality);
    if (!hasCredits) {
      return res.status(402).json({ error: 'Insufficient credits' });
    }

    // Run comparison
    const inferenceService = getModelInferenceService();
    const comparison = await inferenceService.runComparison(
      pretrainedModelId,
      finetunedModelId,
      modality,
      input,
      parameters
    );

    // Charge for usage
    await billingService.chargeForInference(userId, modality, {
      inputTokens: comparison.pretrained.tokensUsed,
      outputTokens: comparison.finetuned.tokensUsed,
      generationCount: modality === 'image' ? 2 : undefined,
      durationSeconds: modality === 'audio' || modality === 'video' ? 10 : undefined,
    });

    res.json({
      pretrained: comparison.pretrained,
      finetuned: comparison.finetuned,
      comparison: comparison.comparison,
    });
  } catch (error) {
    console.error('[Model Testing API] Quick compare error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to run comparison',
    });
  }
});

// =============================================================================
// PRICING & ESTIMATION
// =============================================================================

/**
 * GET /api/model-testing/pricing
 * Get pricing information for testing
 */
modelTestingRouter.get('/pricing', authMiddleware, async (req: Request, res: Response) => {
  try {
    const billingService = getTestBillingService();
    const pricing = billingService.getPricing();

    res.json({
      pricing,
      notes: {
        credits: '100 credits = $1 USD',
        comparison: 'Each comparison runs both models, so costs are doubled',
        minimums: {
          llm: billingService.getMinimumCreditsRequired('llm'),
          image: billingService.getMinimumCreditsRequired('image'),
          video: billingService.getMinimumCreditsRequired('video'),
          audio: billingService.getMinimumCreditsRequired('audio'),
        },
      },
    });
  } catch (error) {
    console.error('[Model Testing API] Get pricing error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get pricing',
    });
  }
});

/**
 * POST /api/model-testing/estimate
 * Estimate cost for a test session
 */
modelTestingRouter.post('/estimate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { modality, testCount, averageUsage } = req.body;

    if (!modality || !testCount) {
      return res.status(400).json({
        error: 'modality and testCount are required',
      });
    }

    const billingService = getTestBillingService();
    const estimate = billingService.estimateCost(
      modality,
      testCount,
      averageUsage || {}
    );

    res.json({
      estimate: {
        perTest: estimate.perTest,
        total: estimate.total,
        totalCredits: Math.ceil(estimate.total * 100),
      },
    });
  } catch (error) {
    console.error('[Model Testing API] Estimate error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to estimate cost',
    });
  }
});

export default modelTestingRouter;
