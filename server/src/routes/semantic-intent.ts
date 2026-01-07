/**
 * Semantic Intent API Routes
 *
 * REST endpoints for VL-JEPA semantic intent verification.
 *
 * Endpoints:
 *   POST /api/semantic-intent/store - Store a new intent with embedding
 *   POST /api/semantic-intent/verify - Verify alignment between output and intent
 *   POST /api/semantic-intent/drift - Detect drift from original intent
 *   GET /api/semantic-intent/similar - Find similar intents
 *   GET /api/semantic-intent/project/:projectId - Get project intents
 *   GET /api/semantic-intent/health - Service health
 */

import { Router, type Request, type Response } from 'express';
import { getSemanticIntentService } from '../services/embeddings/semantic-intent-service.js';

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface StoreIntentBody {
  originalPrompt: string;
  intentText: string;
  intentType: 'feature' | 'bugfix' | 'refactor' | 'enhancement' | 'migration' | 'build';
  projectId: string;
  buildIntentId?: string;
  appSoul?: string;
  successCriteria?: string[];
}

interface VerifyAlignmentBody {
  intentId: string;
  outputDescription: string;
}

interface DetectDriftBody {
  intentId: string;
  intermediateOutputs: string[];
}

interface SimilarIntentsQuery {
  query: string;
  projectId?: string;
  intentType?: string;
  appSoul?: string;
  limit?: string;
  minScore?: string;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/semantic-intent/store
 *
 * Store a new intent with its embedding
 */
router.post('/store', async (req: Request, res: Response) => {
  try {
    const body = req.body as StoreIntentBody;
    const userId = (req as Request & { user?: { id: string } }).user?.id;

    if (!userId) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    // Validate required fields
    if (!body.originalPrompt || !body.intentText || !body.intentType || !body.projectId) {
      res.status(400).json({
        error: 'Missing required fields: originalPrompt, intentText, intentType, projectId',
        code: 'MISSING_FIELDS',
      });
      return;
    }

    const service = getSemanticIntentService();

    const intent = await service.storeIntent({
      originalPrompt: body.originalPrompt,
      intentText: body.intentText,
      intentType: body.intentType,
      projectId: body.projectId,
      userId,
      buildIntentId: body.buildIntentId,
      appSoul: body.appSoul,
      successCriteria: body.successCriteria,
    });

    res.status(201).json({
      success: true,
      data: {
        id: intent.id,
        intentType: intent.intentType,
        projectId: intent.projectId,
        appSoul: intent.appSoul,
        embeddingDimensions: intent.embedding?.length || 0,
        createdAt: intent.createdAt,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SemanticIntent] Store error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to store intent',
      code: 'STORE_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/semantic-intent/verify
 *
 * Verify alignment between current output and original intent
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const body = req.body as VerifyAlignmentBody;
    const userId = (req as Request & { user?: { id: string } }).user?.id;

    if (!userId) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    if (!body.intentId || !body.outputDescription) {
      res.status(400).json({
        error: 'Missing required fields: intentId, outputDescription',
        code: 'MISSING_FIELDS',
      });
      return;
    }

    const service = getSemanticIntentService();

    const result = await service.verifyAlignment(
      body.intentId,
      body.outputDescription,
      userId
    );

    res.json({
      success: true,
      data: {
        alignmentScore: result.alignmentScore,
        isAligned: result.isAligned,
        alignmentLevel: result.alignmentLevel,
        details: result.details,
        suggestions: result.suggestions,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SemanticIntent] Verify error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to verify alignment',
      code: 'VERIFY_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/semantic-intent/drift
 *
 * Detect drift from original intent across intermediate outputs
 */
router.post('/drift', async (req: Request, res: Response) => {
  try {
    const body = req.body as DetectDriftBody;
    const userId = (req as Request & { user?: { id: string } }).user?.id;

    if (!userId) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    if (!body.intentId || !body.intermediateOutputs || body.intermediateOutputs.length === 0) {
      res.status(400).json({
        error: 'Missing required fields: intentId, intermediateOutputs (non-empty array)',
        code: 'MISSING_FIELDS',
      });
      return;
    }

    const service = getSemanticIntentService();

    const result = await service.detectDrift(
      body.intentId,
      body.intermediateOutputs,
      userId
    );

    res.json({
      success: true,
      data: {
        driftScore: result.driftScore,
        hasDrift: result.hasDrift,
        severity: result.severity,
        driftAreas: result.driftAreas,
        driftStartedAt: result.driftStartedAt,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SemanticIntent] Drift detection error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to detect drift',
      code: 'DRIFT_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/semantic-intent/similar
 *
 * Find similar intents based on query text
 */
router.get('/similar', async (req: Request, res: Response) => {
  try {
    const query = req.query as unknown as SimilarIntentsQuery;
    const userId = (req as Request & { user?: { id: string } }).user?.id;

    if (!query.query) {
      res.status(400).json({
        error: 'Missing required query parameter: query',
        code: 'MISSING_QUERY',
      });
      return;
    }

    const service = getSemanticIntentService();

    const results = await service.findSimilarIntents(query.query, {
      projectId: query.projectId,
      userId,
      intentType: query.intentType,
      appSoul: query.appSoul,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      minScore: query.minScore ? parseFloat(query.minScore) : undefined,
    });

    res.json({
      success: true,
      data: {
        query: query.query,
        count: results.length,
        intents: results.map(r => ({
          id: r.id,
          intentText: r.intentText,
          intentType: r.intentType,
          projectId: r.projectId,
          appSoul: r.appSoul,
          similarity: r.similarity,
          similarityPercent: `${(r.similarity * 100).toFixed(1)}%`,
          createdAt: r.createdAt,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SemanticIntent] Similar search error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to find similar intents',
      code: 'SEARCH_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/semantic-intent/project/:projectId
 *
 * Get all intents for a project
 */
router.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    if (!userId) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const service = getSemanticIntentService();

    const intents = await service.getProjectIntents(projectId, userId, limit);

    res.json({
      success: true,
      data: {
        projectId,
        count: intents.length,
        intents: intents.map(i => ({
          id: i.id,
          intentText: i.intentText,
          intentType: i.intentType,
          appSoul: i.appSoul,
          createdAt: i.createdAt,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SemanticIntent] Project intents error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get project intents',
      code: 'PROJECT_INTENTS_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/semantic-intent/similarity
 *
 * Calculate similarity between two texts
 */
router.post('/similarity', async (req: Request, res: Response) => {
  try {
    const { text1, text2 } = req.body as { text1: string; text2: string };
    const userId = (req as Request & { user?: { id: string } }).user?.id;

    if (!text1 || !text2) {
      res.status(400).json({
        error: 'Missing required fields: text1, text2',
        code: 'MISSING_FIELDS',
      });
      return;
    }

    const service = getSemanticIntentService();

    const similarity = await service.calculateTextSimilarity(text1, text2, userId);

    res.json({
      success: true,
      data: {
        similarity,
        similarityPercent: `${(similarity * 100).toFixed(1)}%`,
        interpretation: similarity >= 0.85 ? 'Very Similar' :
                       similarity >= 0.7 ? 'Similar' :
                       similarity >= 0.5 ? 'Somewhat Similar' :
                       'Different',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SemanticIntent] Similarity error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to calculate similarity',
      code: 'SIMILARITY_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/semantic-intent/health
 *
 * Health check for semantic intent service
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const service = getSemanticIntentService();
    const health = await service.healthCheck();

    const statusCode = health.healthy ? 200 : 503;

    res.status(statusCode).json({
      success: health.healthy,
      data: {
        status: health.healthy ? 'healthy' : 'degraded',
        embeddingService: health.embeddingService,
        collection: health.collection,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SemanticIntent] Health check error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
