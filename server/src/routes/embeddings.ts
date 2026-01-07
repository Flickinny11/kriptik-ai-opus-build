/**
 * Embeddings API Routes
 * 
 * REST endpoints for the embedding service.
 * 
 * Endpoints:
 *   POST /api/embeddings/generate - Generate embeddings
 *   POST /api/embeddings/similarity - Compare two embeddings
 *   POST /api/embeddings/batch - Batch embedding generation
 *   GET /api/embeddings/stats - Get usage statistics
 *   GET /api/embeddings/health - Check embedding service health
 */

import { Router, type Request, type Response } from 'express';
import { getEmbeddingService } from '../services/embeddings/embedding-service-impl.js';
import type { EmbeddingType, EmbeddingOptions } from '../services/embeddings/embedding-service.js';

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface GenerateRequestBody {
  content: string | string[];
  type: EmbeddingType;
  projectId?: string;
  options?: EmbeddingOptions;
}

interface SimilarityRequestBody {
  embedding1: number[];
  embedding2: number[];
  method?: 'cosine' | 'dot' | 'euclidean';
}

interface BatchRequestBody {
  requests: Array<{
    content: string | string[];
    type: EmbeddingType;
    projectId?: string;
    options?: EmbeddingOptions;
  }>;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/embeddings/generate
 * 
 * Generate embeddings for text or image content.
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const body = req.body as GenerateRequestBody;
    
    // Validate request
    if (!body.content) {
      res.status(400).json({
        error: 'Missing required field: content',
        code: 'MISSING_CONTENT',
      });
      return;
    }
    
    if (!body.type || !['intent', 'code', 'visual', 'error', 'reasoning'].includes(body.type)) {
      res.status(400).json({
        error: 'Invalid or missing type. Must be one of: intent, code, visual, error, reasoning',
        code: 'INVALID_TYPE',
      });
      return;
    }

    const service = getEmbeddingService();
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    
    const result = await service.embed({
      content: body.content,
      type: body.type,
      projectId: body.projectId,
      userId,
      options: body.options,
    });

    res.json({
      success: true,
      data: {
        embeddings: result.embeddings,
        model: result.model,
        provider: result.provider,
        dimensions: result.dimensions,
        tokensUsed: result.tokensUsed,
        cached: result.cached,
        latencyMs: result.latencyMs,
        creditsCost: result.creditsCost,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Embeddings] Generate error:', error);
    
    // Handle rate limiting
    if (error instanceof Error && error.message.includes('Rate limit')) {
      res.status(429).json({
        error: error.message,
        code: 'RATE_LIMITED',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate embeddings',
      code: 'GENERATION_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/embeddings/similarity
 * 
 * Calculate similarity between two embeddings.
 */
router.post('/similarity', async (req: Request, res: Response) => {
  try {
    const body = req.body as SimilarityRequestBody;
    
    // Validate request
    if (!body.embedding1 || !Array.isArray(body.embedding1)) {
      res.status(400).json({
        error: 'Missing or invalid embedding1',
        code: 'INVALID_EMBEDDING',
      });
      return;
    }
    
    if (!body.embedding2 || !Array.isArray(body.embedding2)) {
      res.status(400).json({
        error: 'Missing or invalid embedding2',
        code: 'INVALID_EMBEDDING',
      });
      return;
    }

    const service = getEmbeddingService();
    const result = service.similarity(body.embedding1, body.embedding2, body.method);

    res.json({
      success: true,
      data: {
        similarity: result.similarity,
        method: result.method,
        // Interpretation helpers
        interpretation: {
          match: result.similarity >= 0.85 ? 'high' : result.similarity >= 0.7 ? 'medium' : 'low',
          description: result.similarity >= 0.85 
            ? 'Strong semantic similarity' 
            : result.similarity >= 0.7 
              ? 'Moderate semantic similarity'
              : 'Low semantic similarity',
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Embeddings] Similarity error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to calculate similarity',
      code: 'SIMILARITY_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/embeddings/batch
 * 
 * Generate embeddings for multiple requests in batch.
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const body = req.body as BatchRequestBody;
    
    // Validate request
    if (!body.requests || !Array.isArray(body.requests) || body.requests.length === 0) {
      res.status(400).json({
        error: 'Missing or empty requests array',
        code: 'INVALID_REQUESTS',
      });
      return;
    }
    
    if (body.requests.length > 100) {
      res.status(400).json({
        error: 'Maximum 100 requests per batch',
        code: 'BATCH_TOO_LARGE',
      });
      return;
    }

    const service = getEmbeddingService();
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    
    const result = await service.embedBatch(
      body.requests.map(r => ({
        content: r.content,
        type: r.type,
        projectId: r.projectId,
        userId,
        options: r.options,
      }))
    );

    res.json({
      success: true,
      data: {
        results: result.results.map(r => ({
          embeddings: r.embeddings,
          model: r.model,
          dimensions: r.dimensions,
          tokensUsed: r.tokensUsed,
          cached: r.cached,
          creditsCost: r.creditsCost,
        })),
        totals: {
          tokensUsed: result.totalTokensUsed,
          latencyMs: result.totalLatencyMs,
          creditsCost: result.totalCreditsCost,
          requestsProcessed: result.results.length,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Embeddings] Batch error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to process batch',
      code: 'BATCH_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/embeddings/stats
 * 
 * Get embedding usage statistics.
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const service = getEmbeddingService();
    const cacheStats = service.getCacheStats();

    res.json({
      success: true,
      data: {
        cache: {
          hits: cacheStats.hits,
          misses: cacheStats.misses,
          hitRate: `${(cacheStats.hitRate * 100).toFixed(1)}%`,
          entries: cacheStats.memoryCacheSize,
          bytesWritten: cacheStats.bytesWritten,
          bytesRead: cacheStats.bytesRead,
        },
        providers: {
          available: ['bge-m3', 'voyage-code-3', 'siglip-2'],
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Embeddings] Stats error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get stats',
      code: 'STATS_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/embeddings/health
 * 
 * Check health of embedding service and providers.
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const service = getEmbeddingService();
    const health = await service.healthCheck();

    const statusCode = health.healthy ? 200 : 503;
    
    res.status(statusCode).json({
      success: health.healthy,
      data: {
        status: health.healthy ? 'healthy' : 'degraded',
        providers: Object.entries(health.providers).map(([name, status]) => ({
          name,
          healthy: status.healthy,
          latencyMs: status.latencyMs,
          error: status.error,
          lastChecked: status.lastChecked,
        })),
        cache: {
          healthy: health.cache.healthy,
          entries: health.cache.entries,
          hitRate: health.cache.hitRate ? `${(health.cache.hitRate * 100).toFixed(1)}%` : 'N/A',
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Embeddings] Health check error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/embeddings/estimate
 * 
 * Estimate cost for embedding request without generating.
 */
router.post('/estimate', async (req: Request, res: Response) => {
  try {
    const body = req.body as Pick<GenerateRequestBody, 'content' | 'type'>;
    
    if (!body.content || !body.type) {
      res.status(400).json({
        error: 'Missing required fields: content, type',
        code: 'MISSING_FIELDS',
      });
      return;
    }

    const service = getEmbeddingService();
    const estimatedCost = service.estimateCost(body.content, body.type);
    
    // Estimate tokens
    const texts = Array.isArray(body.content) ? body.content : [body.content];
    const estimatedTokens = texts.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);

    res.json({
      success: true,
      data: {
        estimatedTokens,
        estimatedCreditsCost: estimatedCost,
        type: body.type,
        inputCount: texts.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Embeddings] Estimate error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to estimate cost',
      code: 'ESTIMATE_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
