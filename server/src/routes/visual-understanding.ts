/**
 * Visual Understanding API Routes
 * 
 * VL-JEPA visual analysis endpoints for:
 * - Screenshot analysis
 * - Design alignment checking
 * - Visual storage and search
 * - Anti-slop detection
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import { getVisualUnderstandingService } from '../services/embeddings/visual-understanding-service.js';

const router = Router();

// ============================================================================
// Visual Analysis Routes
// ============================================================================

/**
 * POST /visual/analyze
 * Analyze a visual and generate description
 */
router.post('/analyze', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { imageUrl, imageBase64, context, analysisType, projectId, expectedAppSoul } = req.body;

    if (!imageUrl && !imageBase64) {
      return res.status(400).json({ 
        error: 'Either imageUrl or imageBase64 is required' 
      });
    }

    const service = getVisualUnderstandingService();
    const description = await service.analyzeVisual({
      imageUrl,
      imageBase64,
      context,
      analysisType,
      projectId,
      expectedAppSoul,
    }, userId);

    return res.json({
      success: true,
      description,
    });
  } catch (error) {
    console.error('[VisualUnderstanding] Analysis failed:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Analysis failed' 
    });
  }
});

/**
 * POST /visual/alignment
 * Check if visual design aligns with app soul
 */
router.post('/alignment', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { imageUrl, imageBase64, context, analysisType, projectId, expectedAppSoul } = req.body;

    if (!imageUrl && !imageBase64) {
      return res.status(400).json({ 
        error: 'Either imageUrl or imageBase64 is required' 
      });
    }

    const service = getVisualUnderstandingService();
    const alignment = await service.checkDesignAlignment({
      imageUrl,
      imageBase64,
      context,
      analysisType,
      projectId,
      expectedAppSoul,
    }, userId);

    return res.json({
      success: true,
      alignment,
    });
  } catch (error) {
    console.error('[VisualUnderstanding] Alignment check failed:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Alignment check failed' 
    });
  }
});

// ============================================================================
// Visual Storage Routes
// ============================================================================

/**
 * POST /visual/store
 * Store a visual embedding for future reference
 */
router.post('/store', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { imageUrl, imageBase64, context, analysisType, projectId, expectedAppSoul, buildId } = req.body;

    if (!imageUrl && !imageBase64) {
      return res.status(400).json({ 
        error: 'Either imageUrl or imageBase64 is required' 
      });
    }

    if (!buildId) {
      return res.status(400).json({ 
        error: 'buildId is required' 
      });
    }

    const service = getVisualUnderstandingService();
    const visualId = await service.storeVisual({
      imageUrl,
      imageBase64,
      context,
      analysisType,
      projectId,
      expectedAppSoul,
    }, buildId, userId);

    return res.json({
      success: true,
      visualId,
    });
  } catch (error) {
    console.error('[VisualUnderstanding] Store failed:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Store failed' 
    });
  }
});

/**
 * POST /visual/search
 * Find similar visuals
 */
router.post('/search', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { imageUrl, imageBase64, context, analysisType, projectId, expectedAppSoul, limit } = req.body;

    if (!imageUrl && !imageBase64) {
      return res.status(400).json({ 
        error: 'Either imageUrl or imageBase64 is required' 
      });
    }

    const service = getVisualUnderstandingService();
    const similar = await service.findSimilarVisuals({
      imageUrl,
      imageBase64,
      context,
      analysisType,
      projectId,
      expectedAppSoul,
    }, userId, limit);

    return res.json({
      success: true,
      similar,
    });
  } catch (error) {
    console.error('[VisualUnderstanding] Search failed:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Search failed' 
    });
  }
});

// ============================================================================
// Health Check
// ============================================================================

/**
 * GET /visual/health
 * Health check for visual understanding service
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const service = getVisualUnderstandingService();
    const health = await service.healthCheck();
    
    return res.json({
      success: true,
      ...health,
    });
  } catch (error) {
    console.error('[VisualUnderstanding] Health check failed:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Health check failed' 
    });
  }
});

export default router;
