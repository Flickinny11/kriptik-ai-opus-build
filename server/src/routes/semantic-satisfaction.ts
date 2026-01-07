/**
 * Semantic Satisfaction API Routes
 *
 * REST endpoints for VL-JEPA intent satisfaction verification.
 *
 * Endpoints:
 *   POST /api/semantic-satisfaction/check - Check intent satisfaction
 *   POST /api/semantic-satisfaction/gate - Evaluate completion gate
 *   POST /api/semantic-satisfaction/error-fix - Store error fix pattern
 *   GET /api/semantic-satisfaction/error-fix - Find similar error fixes
 *   POST /api/semantic-satisfaction/code-pattern - Store code pattern
 *   GET /api/semantic-satisfaction/health - Service health
 */

import { Router, type Request, type Response } from 'express';
import { getSemanticSatisfactionService } from '../services/embeddings/semantic-satisfaction-service.js';

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface CheckSatisfactionBody {
  intentId: string;
  buildDescription: string;
  codeSamples?: string[];
  features?: string[];
  workflowOutputs?: Record<string, string>;
  visualDescriptions?: string[];
}

interface EvaluateGateBody {
  intentId: string;
  buildDescription: string;
  requiredGate: 'minimum' | 'acceptable' | 'excellent';
  codeSamples?: string[];
  features?: string[];
}

interface StoreErrorFixBody {
  errorMessage: string;
  errorType: string;
  errorCode?: string;
  fixDescription: string;
  fixCode?: string;
  context: string;
}

interface StoreCodePatternBody {
  code: string;
  patternType: 'good_practice' | 'anti_pattern' | 'common' | 'framework';
  language: string;
  framework?: string;
  description: string;
  projectId: string;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/semantic-satisfaction/check
 *
 * Check if build satisfies the original intent
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    const body = req.body as CheckSatisfactionBody;
    const userId = (req as Request & { user?: { id: string } }).user?.id;

    if (!userId) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    if (!body.intentId || !body.buildDescription) {
      res.status(400).json({
        error: 'Missing required fields: intentId, buildDescription',
        code: 'MISSING_FIELDS',
      });
      return;
    }

    const service = getSemanticSatisfactionService();

    const result = await service.checkSatisfaction({
      intentId: body.intentId,
      buildDescription: body.buildDescription,
      codeSamples: body.codeSamples,
      features: body.features,
      workflowOutputs: body.workflowOutputs,
      visualDescriptions: body.visualDescriptions,
    }, userId);

    res.json({
      success: true,
      data: {
        overallScore: result.overallScore,
        overallScorePercent: `${(result.overallScore * 100).toFixed(1)}%`,
        isSatisfied: result.isSatisfied,
        satisfactionLevel: result.satisfactionLevel,
        criteriaResults: result.criteriaResults.map(cr => ({
          criterionId: cr.criterionId,
          description: cr.description,
          satisfied: cr.satisfied,
          confidence: cr.confidence,
          confidencePercent: `${(cr.confidence * 100).toFixed(1)}%`,
          semanticScore: cr.semanticScore,
          evidence: cr.evidence,
          reason: cr.reason,
        })),
        workflowResults: result.workflowResults.map(wr => ({
          workflowName: wr.workflowName,
          satisfied: wr.satisfied,
          stepsCompleted: wr.stepsCompleted,
          totalSteps: wr.totalSteps,
          completionPercent: `${(wr.completionScore * 100).toFixed(1)}%`,
        })),
        codeQuality: {
          score: result.codeQualityScore,
          scorePercent: `${(result.codeQualityScore * 100).toFixed(1)}%`,
          level: result.codeQualityScore >= 0.8 ? 'excellent' :
                 result.codeQualityScore >= 0.6 ? 'good' :
                 result.codeQualityScore >= 0.4 ? 'fair' : 'needs_improvement',
        },
        featureCompleteness: {
          implemented: result.featureCompleteness.implemented,
          total: result.featureCompleteness.total,
          percentage: `${result.featureCompleteness.percentage.toFixed(1)}%`,
        },
        recommendations: result.recommendations,
        confidence: result.confidence,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SemanticSatisfaction] Check error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to check satisfaction',
      code: 'CHECK_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/semantic-satisfaction/gate
 *
 * Evaluate completion gate for phase transition
 */
router.post('/gate', async (req: Request, res: Response) => {
  try {
    const body = req.body as EvaluateGateBody;
    const userId = (req as Request & { user?: { id: string } }).user?.id;

    if (!userId) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    if (!body.intentId || !body.buildDescription || !body.requiredGate) {
      res.status(400).json({
        error: 'Missing required fields: intentId, buildDescription, requiredGate',
        code: 'MISSING_FIELDS',
      });
      return;
    }

    if (!['minimum', 'acceptable', 'excellent'].includes(body.requiredGate)) {
      res.status(400).json({
        error: 'Invalid requiredGate. Must be: minimum, acceptable, or excellent',
        code: 'INVALID_GATE',
      });
      return;
    }

    const service = getSemanticSatisfactionService();

    const result = await service.evaluateCompletionGate(
      {
        intentId: body.intentId,
        buildDescription: body.buildDescription,
        codeSamples: body.codeSamples,
        features: body.features,
      },
      body.requiredGate,
      userId
    );

    res.json({
      success: true,
      data: {
        canProceed: result.canProceed,
        gatePassed: result.gatePassed,
        requiredGate: body.requiredGate,
        blockers: result.blockers.map(b => ({
          type: b.type,
          description: b.description,
          severity: b.severity,
        })),
        blockerCount: result.blockers.length,
        criticalBlockerCount: result.blockers.filter(b => b.severity === 'critical').length,
        scoreToNextGate: result.scoreToNextGate,
        scoreToNextGatePercent: `${(result.scoreToNextGate * 100).toFixed(1)}%`,
        suggestions: result.suggestions,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SemanticSatisfaction] Gate evaluation error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to evaluate gate',
      code: 'GATE_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/semantic-satisfaction/error-fix
 *
 * Store an error fix pattern for learning
 */
router.post('/error-fix', async (req: Request, res: Response) => {
  try {
    const body = req.body as StoreErrorFixBody;
    const userId = (req as Request & { user?: { id: string } }).user?.id;

    if (!userId) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    if (!body.errorMessage || !body.errorType || !body.fixDescription || !body.context) {
      res.status(400).json({
        error: 'Missing required fields: errorMessage, errorType, fixDescription, context',
        code: 'MISSING_FIELDS',
      });
      return;
    }

    const service = getSemanticSatisfactionService();

    const fixId = await service.storeErrorFix({
      errorMessage: body.errorMessage,
      errorType: body.errorType,
      errorCode: body.errorCode,
      fixDescription: body.fixDescription,
      fixCode: body.fixCode,
      context: body.context,
    }, userId);

    res.status(201).json({
      success: true,
      data: {
        fixId,
        errorType: body.errorType,
        stored: true,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SemanticSatisfaction] Store error fix error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to store error fix',
      code: 'STORE_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/semantic-satisfaction/error-fix
 *
 * Find similar error fixes
 */
router.get('/error-fix', async (req: Request, res: Response) => {
  try {
    const { errorMessage, errorType, context, limit } = req.query as {
      errorMessage: string;
      errorType: string;
      context: string;
      limit?: string;
    };
    const userId = (req as Request & { user?: { id: string } }).user?.id;

    if (!errorMessage || !errorType || !context) {
      res.status(400).json({
        error: 'Missing required query parameters: errorMessage, errorType, context',
        code: 'MISSING_PARAMS',
      });
      return;
    }

    const service = getSemanticSatisfactionService();

    const fixes = await service.findSimilarErrors(
      errorMessage,
      errorType,
      context,
      userId || '',
      limit ? parseInt(limit, 10) : 5
    );

    res.json({
      success: true,
      data: {
        query: { errorMessage, errorType },
        count: fixes.length,
        fixes: fixes.map(f => ({
          id: f.id,
          fix: f.fix,
          similarity: f.similarity,
          similarityPercent: `${(f.similarity * 100).toFixed(1)}%`,
          successRate: f.successRate,
          successRatePercent: `${(f.successRate * 100).toFixed(1)}%`,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SemanticSatisfaction] Find error fixes error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to find error fixes',
      code: 'SEARCH_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/semantic-satisfaction/code-pattern
 *
 * Store a code pattern for quality assessment
 */
router.post('/code-pattern', async (req: Request, res: Response) => {
  try {
    const body = req.body as StoreCodePatternBody;
    const userId = (req as Request & { user?: { id: string } }).user?.id;

    if (!userId) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    if (!body.code || !body.patternType || !body.language || !body.description || !body.projectId) {
      res.status(400).json({
        error: 'Missing required fields: code, patternType, language, description, projectId',
        code: 'MISSING_FIELDS',
      });
      return;
    }

    const validTypes = ['good_practice', 'anti_pattern', 'common', 'framework'];
    if (!validTypes.includes(body.patternType)) {
      res.status(400).json({
        error: `Invalid patternType. Must be one of: ${validTypes.join(', ')}`,
        code: 'INVALID_PATTERN_TYPE',
      });
      return;
    }

    const service = getSemanticSatisfactionService();

    const patternId = await service.storeCodePattern({
      code: body.code,
      patternType: body.patternType,
      language: body.language,
      framework: body.framework,
      description: body.description,
    }, body.projectId, userId);

    res.status(201).json({
      success: true,
      data: {
        patternId,
        patternType: body.patternType,
        language: body.language,
        stored: true,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SemanticSatisfaction] Store code pattern error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to store code pattern',
      code: 'STORE_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/semantic-satisfaction/health
 *
 * Health check for semantic satisfaction service
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const service = getSemanticSatisfactionService();
    const health = await service.healthCheck();

    const statusCode = health.healthy ? 200 : 503;

    res.status(statusCode).json({
      success: health.healthy,
      data: {
        status: health.healthy ? 'healthy' : 'degraded',
        services: health.services,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SemanticSatisfaction] Health check error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
