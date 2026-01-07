/**
 * Qdrant Health Check Routes
 * 
 * Provides health monitoring endpoints for the Qdrant vector database.
 * 
 * Endpoints:
 *   GET /api/health/qdrant - Full health status
 *   GET /api/health/qdrant/collections - Collection statistics
 *   GET /api/health/qdrant/ping - Simple connectivity check
 */

import { Router, type Request, type Response } from 'express';
import { getQdrantClient, COLLECTION_NAMES } from '../services/embeddings/index.js';

const router = Router();

// ============================================================================
// Health Check Endpoint
// ============================================================================

/**
 * GET /api/health/qdrant
 * 
 * Returns comprehensive health status of Qdrant including:
 * - Connection status
 * - Collection counts
 * - Memory usage
 * - Version info
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const client = getQdrantClient();
    const health = await client.healthCheck();
    
    if (health.healthy) {
      res.json({
        status: 'healthy',
        version: health.version,
        collectionsCount: health.collectionsCount,
        memoryUsage: health.memoryUsage,
        responseTimeMs: health.responseTimeMs,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        error: health.error,
        responseTimeMs: health.responseTimeMs,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================================================
// Collections Statistics Endpoint
// ============================================================================

/**
 * GET /api/health/qdrant/collections
 * 
 * Returns statistics for all KripTik collections
 */
router.get('/collections', async (_req: Request, res: Response) => {
  try {
    const client = getQdrantClient();
    
    // Check connectivity first
    const isConnected = await client.verifyConnection();
    if (!isConnected) {
      res.status(503).json({
        status: 'disconnected',
        error: 'Cannot connect to Qdrant',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    // Get stats for each collection
    const collectionStats = await Promise.all(
      Object.values(COLLECTION_NAMES).map(async (name) => {
        const stats = await client.getCollectionStats(name);
        return {
          name,
          fullName: client.getCollectionName(name),
          ...stats,
        };
      })
    );
    
    // Calculate totals
    const totalVectors = collectionStats.reduce(
      (sum, c) => sum + (c.vectorsCount || 0),
      0
    );
    const totalPoints = collectionStats.reduce(
      (sum, c) => sum + (c.pointsCount || 0),
      0
    );
    const totalDiskBytes = collectionStats.reduce(
      (sum, c) => sum + (c.diskDataSizeBytes || 0),
      0
    );
    
    res.json({
      status: 'ok',
      collections: collectionStats,
      totals: {
        collections: collectionStats.length,
        vectors: totalVectors,
        points: totalPoints,
        diskSizeBytes: totalDiskBytes,
        diskSizeMB: Math.round(totalDiskBytes / (1024 * 1024) * 100) / 100,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================================================
// Ping Endpoint
// ============================================================================

/**
 * GET /api/health/qdrant/ping
 * 
 * Simple connectivity check - returns quickly for monitoring
 */
router.get('/ping', async (_req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const client = getQdrantClient();
    const isConnected = await client.verifyConnection();
    
    res.json({
      pong: true,
      connected: isConnected,
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      pong: false,
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================================================
// Collection Details Endpoint
// ============================================================================

/**
 * GET /api/health/qdrant/collection/:name
 * 
 * Returns detailed stats for a specific collection
 */
router.get('/collection/:name', async (req: Request, res: Response) => {
  const { name } = req.params;
  
  // Validate collection name
  if (!Object.values(COLLECTION_NAMES).includes(name as typeof COLLECTION_NAMES[keyof typeof COLLECTION_NAMES])) {
    res.status(400).json({
      status: 'error',
      error: `Invalid collection name: ${name}`,
      validCollections: Object.values(COLLECTION_NAMES),
      timestamp: new Date().toISOString(),
    });
    return;
  }
  
  try {
    const client = getQdrantClient();
    const stats = await client.getCollectionStats(name);
    
    if (!stats) {
      res.status(404).json({
        status: 'not_found',
        error: `Collection ${name} not found`,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    // Get point count
    const pointCount = await client.countPoints(name);
    
    res.json({
      status: 'ok',
      collection: {
        ...stats,
        pointCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
