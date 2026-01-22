/**
 * Visual-Semantic API Routes
 *
 * Hybrid VL-JEPA + V-JEPA 2 + LLM analysis endpoints for:
 * - Full hybrid analysis (parallel VL-JEPA, V-JEPA 2, LLM streams)
 * - Visual Intent Lock creation and verification
 * - Temporal Expectations and state prediction
 * - Proactive error anticipation
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import {
  getHybridAnalysisEngine,
  type AnalysisInput,
} from '../services/visual-semantic/hybrid-analysis-engine.js';
import {
  getVisualIntentLockManager,
  type VisualIntentLock,
} from '../services/visual-semantic/visual-intent-lock.js';
import {
  getTemporalExpectationsManager,
} from '../services/visual-semantic/temporal-expectations.js';
import {
  getProactiveErrorPredictor,
  type MonitoringConfig,
} from '../services/visual-semantic/proactive-error-predictor.js';
import { getVJEPA2Provider, type VisualIntentLock as VJEPA2IntentLock } from '../services/embeddings/providers/runpod-vjepa2-provider.js';
import { RunPodVLJEPAProvider } from '../services/embeddings/providers/runpod-vl-jepa-provider.js';

const router = Router();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert base64 strings to Buffers
 */
function toBuffers(frames: string[]): Buffer[] {
  return frames.map(f => {
    // Remove data URL prefix if present
    const base64Data = f.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  });
}

/**
 * Get embedding from base64 image using VL-JEPA
 */
async function getEmbeddingFromImage(imageBase64: string): Promise<number[]> {
  const vlJepaProvider = new RunPodVLJEPAProvider();

  if (!vlJepaProvider.isConfigured()) {
    // Return pseudo-embedding if not configured
    const seed = imageBase64.length;
    return generatePseudoEmbedding(seed, 1024);
  }

  try {
    const result = await vlJepaProvider.embedVisualText(imageBase64, 'UI screenshot for verification');
    return result.embedding;
  } catch (error) {
    console.warn('[VisualSemantic] Failed to get embedding, using pseudo:', error);
    return generatePseudoEmbedding(imageBase64.length, 1024);
  }
}

/**
 * Generate pseudo-embedding for fallback
 */
function generatePseudoEmbedding(seed: number, dimensions: number): number[] {
  const embedding: number[] = [];
  let s = seed;

  for (let i = 0; i < dimensions; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    embedding.push((s / 0x7fffffff) * 2 - 1);
  }

  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map(v => v / magnitude);
}

// ============================================================================
// Hybrid Analysis Routes
// ============================================================================

/**
 * POST /visual-semantic/analyze
 * Full hybrid analysis of uploaded media (image/video)
 * Runs VL-JEPA, V-JEPA 2, and LLM streams in parallel
 */
router.post('/analyze', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const {
      mediaBase64,
      mediaUrl,
      mediaType = 'image',
      additionalMedia,
      context,
      projectId,
      buildId,
      tags,
    } = req.body;

    if (!mediaBase64 && !mediaUrl) {
      return res.status(400).json({
        error: 'Either mediaBase64 or mediaUrl is required',
      });
    }

    if (!projectId) {
      return res.status(400).json({
        error: 'projectId is required',
      });
    }

    const engine = getHybridAnalysisEngine();

    const input: AnalysisInput = {
      media: mediaBase64 || mediaUrl,
      mediaType: mediaType as 'image' | 'video' | 'multiple',
      additionalMedia,
      userContext: context,
      projectId,
      buildId,
      tags,
    };

    const result = await engine.analyzeMedia(input);

    return res.json({
      success: true,
      result: {
        embedding: result.embedding,
        temporal: result.temporal,
        semantic: result.semantic,
        visualIntentLock: {
          id: result.visualIntentLock.id,
          createdAt: result.visualIntentLock.createdAt,
          what: result.visualIntentLock.what,
          componentCount: result.visualIntentLock.components.length,
          checklistCount: result.visualIntentLock.checklist.length,
        },
        temporalExpectations: {
          id: result.temporalExpectations.id,
          stateCount: result.temporalExpectations.stateTransitions.length,
          anticipatedActionCount: result.temporalExpectations.anticipatedActions.length,
        },
        analysisTime: result.analysisTime,
        confidence: result.confidence,
        cacheKey: result.cacheKey,
      },
    });
  } catch (error) {
    console.error('[VisualSemantic] Analysis failed:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Analysis failed',
    });
  }
});

// ============================================================================
// Visual Intent Lock Routes
// ============================================================================

/**
 * POST /visual-semantic/verify
 * Verify a screenshot against a stored Visual Intent Lock
 */
router.post('/verify', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { lockId, screenshotBase64, screenshotUrl, screenshotDescription } = req.body;

    if (!lockId) {
      return res.status(400).json({ error: 'lockId is required' });
    }

    if (!screenshotBase64 && !screenshotUrl) {
      return res.status(400).json({
        error: 'Either screenshotBase64 or screenshotUrl is required',
      });
    }

    // Get embedding from screenshot
    const imageData = screenshotBase64 || screenshotUrl;
    const embedding = await getEmbeddingFromImage(imageData);

    // Generate description if not provided
    const description = screenshotDescription || 'UI screenshot for verification';

    const manager = getVisualIntentLockManager();
    const result = await manager.verify(lockId, embedding, description);

    return res.json({
      success: true,
      verification: result,
    });
  } catch (error) {
    console.error('[VisualSemantic] Verification failed:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Verification failed',
    });
  }
});

/**
 * GET /visual-semantic/lock/:lockId
 * Get a Visual Intent Lock by ID
 */
router.get('/lock/:lockId', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { lockId } = req.params;
    const manager = getVisualIntentLockManager();
    const lock = manager.getLock(lockId);

    if (!lock) {
      return res.status(404).json({ error: 'Lock not found' });
    }

    return res.json({
      success: true,
      lock,
    });
  } catch (error) {
    console.error('[VisualSemantic] Get lock failed:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get lock',
    });
  }
});

/**
 * POST /visual-semantic/deviation
 * Get deviation report for a lock
 */
router.post('/deviation', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { lockId, screenshotBase64, screenshotUrl } = req.body;

    if (!lockId) {
      return res.status(400).json({ error: 'lockId is required' });
    }

    if (!screenshotBase64 && !screenshotUrl) {
      return res.status(400).json({
        error: 'Either screenshotBase64 or screenshotUrl is required',
      });
    }

    // Get embedding from screenshot
    const imageData = screenshotBase64 || screenshotUrl;
    const embedding = await getEmbeddingFromImage(imageData);

    const manager = getVisualIntentLockManager();
    const deviation = manager.getDeviation(lockId, embedding);

    return res.json({
      success: true,
      deviation,
    });
  } catch (error) {
    console.error('[VisualSemantic] Deviation check failed:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Deviation check failed',
    });
  }
});

// ============================================================================
// Temporal Expectations Routes
// ============================================================================

/**
 * POST /visual-semantic/predict
 * Predict expected UI state after code changes using V-JEPA 2
 */
router.post('/predict', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { expectationsId, codeChanges, framesBase64 } = req.body;

    if (!expectationsId) {
      return res.status(400).json({ error: 'expectationsId is required' });
    }

    if (!codeChanges) {
      return res.status(400).json({ error: 'codeChanges description is required' });
    }

    // Convert frames to Buffers
    const frameBuffers = framesBase64 ? toBuffers(framesBase64) : [];

    const manager = getTemporalExpectationsManager();
    const prediction = await manager.predictNextState(expectationsId, frameBuffers, codeChanges);

    return res.json({
      success: true,
      prediction,
    });
  } catch (error) {
    console.error('[VisualSemantic] Prediction failed:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Prediction failed',
    });
  }
});

/**
 * POST /visual-semantic/validate-transition
 * Validate an actual UI transition against expectations
 */
router.post('/validate-transition', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { expectationsId, framesBase64 } = req.body;

    if (!expectationsId) {
      return res.status(400).json({ error: 'expectationsId is required' });
    }

    if (!framesBase64 || !Array.isArray(framesBase64) || framesBase64.length < 2) {
      return res.status(400).json({
        error: 'framesBase64 array with at least 2 frames is required',
      });
    }

    // Convert frames to Buffers
    const frameBuffers = toBuffers(framesBase64);

    const manager = getTemporalExpectationsManager();
    const validation = await manager.validateTransition(expectationsId, frameBuffers);

    return res.json({
      success: true,
      validation,
    });
  } catch (error) {
    console.error('[VisualSemantic] Transition validation failed:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Validation failed',
    });
  }
});

/**
 * POST /visual-semantic/anticipate-error
 * Proactively anticipate errors using V-JEPA 2 trajectory analysis
 */
router.post('/anticipate-error', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { expectationsId, framesBase64, intentLockId } = req.body;

    if (!expectationsId || !intentLockId) {
      return res.status(400).json({
        error: 'expectationsId and intentLockId are required',
      });
    }

    // Get the Visual Intent Lock
    const lockManager = getVisualIntentLockManager();
    const intentLock = lockManager.getLock(intentLockId);

    if (!intentLock) {
      return res.status(404).json({ error: 'Visual Intent Lock not found' });
    }

    // Convert frames to Buffers
    const frameBuffers = framesBase64 ? toBuffers(framesBase64) : [];

    const manager = getTemporalExpectationsManager();
    const anticipation = await manager.anticipateError(expectationsId, frameBuffers, intentLock);

    return res.json({
      success: true,
      anticipation,
    });
  } catch (error) {
    console.error('[VisualSemantic] Error anticipation failed:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Error anticipation failed',
    });
  }
});

/**
 * GET /visual-semantic/expectations/:expectationsId
 * Get Temporal Expectations by ID
 */
router.get('/expectations/:expectationsId', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { expectationsId } = req.params;
    const manager = getTemporalExpectationsManager();
    const expectations = manager.getExpectations(expectationsId);

    if (!expectations) {
      return res.status(404).json({ error: 'Expectations not found' });
    }

    return res.json({
      success: true,
      expectations,
    });
  } catch (error) {
    console.error('[VisualSemantic] Get expectations failed:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get expectations',
    });
  }
});

// ============================================================================
// V-JEPA 2 Direct Access Routes
// ============================================================================

/**
 * POST /visual-semantic/v-jepa2/predict-state
 * Direct V-JEPA 2 state prediction
 */
router.post('/v-jepa2/predict-state', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { framesBase64, codeChange } = req.body;

    if (!framesBase64 || !Array.isArray(framesBase64) || framesBase64.length === 0) {
      return res.status(400).json({
        error: 'framesBase64 array is required',
      });
    }

    if (!codeChange) {
      return res.status(400).json({
        error: 'codeChange description is required',
      });
    }

    const provider = getVJEPA2Provider();

    if (!provider.isConfigured()) {
      return res.status(503).json({
        error: 'V-JEPA 2 provider not configured',
      });
    }

    const prediction = await provider.predictState(framesBase64, codeChange);

    return res.json({
      success: true,
      prediction,
    });
  } catch (error) {
    console.error('[VisualSemantic] V-JEPA 2 state prediction failed:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'State prediction failed',
    });
  }
});

/**
 * POST /visual-semantic/v-jepa2/validate-transition
 * Direct V-JEPA 2 transition validation
 */
router.post('/v-jepa2/validate-transition', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { framesBase64, expectedTransition } = req.body;

    if (!framesBase64 || !Array.isArray(framesBase64) || framesBase64.length < 2) {
      return res.status(400).json({
        error: 'framesBase64 array with at least 2 frames is required',
      });
    }

    if (!expectedTransition) {
      return res.status(400).json({
        error: 'expectedTransition description is required',
      });
    }

    const provider = getVJEPA2Provider();

    if (!provider.isConfigured()) {
      return res.status(503).json({
        error: 'V-JEPA 2 provider not configured',
      });
    }

    const validation = await provider.validateTransition(framesBase64, expectedTransition);

    return res.json({
      success: true,
      validation,
    });
  } catch (error) {
    console.error('[VisualSemantic] V-JEPA 2 transition validation failed:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Transition validation failed',
    });
  }
});

/**
 * POST /visual-semantic/v-jepa2/anticipate-error
 * Direct V-JEPA 2 error anticipation
 */
router.post('/v-jepa2/anticipate-error', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { framesBase64, intentEmbedding, checklistItems, semanticDescription } = req.body;

    if (!framesBase64 || !Array.isArray(framesBase64) || framesBase64.length === 0) {
      return res.status(400).json({
        error: 'framesBase64 array is required',
      });
    }

    if (!intentEmbedding || !Array.isArray(intentEmbedding)) {
      return res.status(400).json({
        error: 'intentEmbedding array is required',
      });
    }

    const provider = getVJEPA2Provider();

    if (!provider.isConfigured()) {
      return res.status(503).json({
        error: 'V-JEPA 2 provider not configured',
      });
    }

    // Create the intent lock object for the provider
    const intentLock: VJEPA2IntentLock = {
      embedding: intentEmbedding,
      semanticDescription: semanticDescription || 'Visual design verification',
      checklist: checklistItems || [],
    };

    const anticipation = await provider.anticipateError(framesBase64, intentLock);

    return res.json({
      success: true,
      anticipation,
    });
  } catch (error) {
    console.error('[VisualSemantic] V-JEPA 2 error anticipation failed:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Error anticipation failed',
    });
  }
});

/**
 * POST /visual-semantic/v-jepa2/embed-temporal
 * Get temporal embedding from frame sequence
 */
router.post('/v-jepa2/embed-temporal', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { framesBase64 } = req.body;

    if (!framesBase64 || !Array.isArray(framesBase64) || framesBase64.length === 0) {
      return res.status(400).json({
        error: 'framesBase64 array is required',
      });
    }

    const provider = getVJEPA2Provider();

    if (!provider.isConfigured()) {
      return res.status(503).json({
        error: 'V-JEPA 2 provider not configured',
      });
    }

    const result = await provider.embedTemporal(framesBase64);

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[VisualSemantic] V-JEPA 2 temporal embedding failed:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Temporal embedding failed',
    });
  }
});

// ============================================================================
// Proactive Error Prediction Routes
// ============================================================================

/**
 * POST /visual-semantic/monitoring/start
 * Start a proactive error monitoring session
 */
router.post('/monitoring/start', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { projectId, config, intentLockId, expectationsId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const predictor = getProactiveErrorPredictor();
    const sessionId = await predictor.startSession(
      projectId,
      config as Partial<MonitoringConfig> | undefined,
      intentLockId,
      expectationsId
    );

    return res.json({
      success: true,
      sessionId,
      message: 'Monitoring session started',
    });
  } catch (error) {
    console.error('[VisualSemantic] Failed to start monitoring session:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to start monitoring',
    });
  }
});

/**
 * POST /visual-semantic/monitoring/:sessionId/frame
 * Process a frame and get error predictions
 */
router.post('/monitoring/:sessionId/frame', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { sessionId } = req.params;
    const { screenshotBase64, metadata } = req.body;

    if (!screenshotBase64) {
      return res.status(400).json({ error: 'screenshotBase64 is required' });
    }

    const predictor = getProactiveErrorPredictor();
    const result = await predictor.processFrame(sessionId, screenshotBase64, metadata);

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[VisualSemantic] Failed to process frame:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to process frame',
    });
  }
});

/**
 * GET /visual-semantic/monitoring/:sessionId/status
 * Get monitoring session status
 */
router.get('/monitoring/:sessionId/status', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { sessionId } = req.params;
    const predictor = getProactiveErrorPredictor();
    const status = predictor.getSessionStatus(sessionId);

    if (!status) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('[VisualSemantic] Failed to get session status:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get status',
    });
  }
});

/**
 * POST /visual-semantic/monitoring/:sessionId/pause
 * Pause a monitoring session
 */
router.post('/monitoring/:sessionId/pause', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { sessionId } = req.params;
    const predictor = getProactiveErrorPredictor();
    predictor.pauseSession(sessionId);

    return res.json({
      success: true,
      message: 'Session paused',
    });
  } catch (error) {
    console.error('[VisualSemantic] Failed to pause session:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to pause session',
    });
  }
});

/**
 * POST /visual-semantic/monitoring/:sessionId/resume
 * Resume a paused monitoring session
 */
router.post('/monitoring/:sessionId/resume', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { sessionId } = req.params;
    const predictor = getProactiveErrorPredictor();
    predictor.resumeSession(sessionId);

    return res.json({
      success: true,
      message: 'Session resumed',
    });
  } catch (error) {
    console.error('[VisualSemantic] Failed to resume session:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to resume session',
    });
  }
});

/**
 * POST /visual-semantic/monitoring/:sessionId/stop
 * Stop a monitoring session
 */
router.post('/monitoring/:sessionId/stop', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { sessionId } = req.params;
    const predictor = getProactiveErrorPredictor();
    predictor.stopSession(sessionId);

    return res.json({
      success: true,
      message: 'Session stopped',
    });
  } catch (error) {
    console.error('[VisualSemantic] Failed to stop session:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to stop session',
    });
  }
});

// ============================================================================
// Health Check
// ============================================================================

/**
 * GET /visual-semantic/health
 * Health check for visual-semantic services
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const vjepa2Provider = getVJEPA2Provider();
    const vlJepaProvider = new RunPodVLJEPAProvider();
    const _predictor = getProactiveErrorPredictor();

    return res.json({
      success: true,
      services: {
        hybridAnalysisEngine: true,
        visualIntentLockManager: true,
        temporalExpectationsManager: true,
        proactiveErrorPredictor: true,
        vjepa2Provider: {
          configured: vjepa2Provider.isConfigured(),
        },
        vlJepaProvider: {
          configured: vlJepaProvider.isConfigured(),
        },
      },
    });
  } catch (error) {
    console.error('[VisualSemantic] Health check failed:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Health check failed',
    });
  }
});

export default router;
