/**
 * Media API Routes
 *
 * REST endpoints for media processing, upload, and preview.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import {
  getMediaProcessor,
  getMediaUploadService,
  getMediaPreviewService,
  MODEL_REQUIREMENTS,
} from '../services/media/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max
  },
});

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const UploadOptionsSchema = z.object({
  modality: z.enum(['image', 'audio', 'video', 'text']),
  projectId: z.string().optional(),
  datasetId: z.string().optional(),
  processForModel: z.string().optional(),
});

const ChunkedUploadInitSchema = z.object({
  fileName: z.string(),
  totalSize: z.number().positive(),
  totalChunks: z.number().positive(),
});

const ChunkedUploadCompleteSchema = z.object({
  sessionId: z.string(),
  modality: z.enum(['image', 'audio', 'video', 'text']),
  projectId: z.string().optional(),
  datasetId: z.string().optional(),
  processForModel: z.string().optional(),
});

const PreviewOptionsSchema = z.object({
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  format: z.enum(['png', 'jpg', 'webp']).optional(),
  quality: z.number().min(1).max(100).optional(),
});

// =============================================================================
// MEDIA UPLOAD ENDPOINTS
// =============================================================================

/**
 * POST /api/media/upload
 * Upload a single file
 */
router.post(
  '/upload',
  authMiddleware,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const options = UploadOptionsSchema.parse(req.body);
      const uploadService = getMediaUploadService();

      const result = await uploadService.uploadFile(req.file.buffer, req.file.originalname, {
        userId,
        ...options,
      });

      return res.json({ success: true, data: result });
    } catch (error) {
      console.error('Error uploading file:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to upload file',
      });
    }
  }
);

/**
 * POST /api/media/upload/batch
 * Upload multiple files
 */
router.post(
  '/upload/batch',
  authMiddleware,
  upload.array('files', 100),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      const options = UploadOptionsSchema.parse(req.body);
      const uploadService = getMediaUploadService();

      const results = await uploadService.batchUpload(
        files.map((f) => ({ buffer: f.buffer, fileName: f.originalname })),
        { userId, ...options }
      );

      return res.json({
        success: true,
        data: {
          uploaded: results.length,
          total: files.length,
          files: results,
        },
      });
    } catch (error) {
      console.error('Error batch uploading files:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to batch upload files',
      });
    }
  }
);

/**
 * POST /api/media/upload/chunked/init
 * Initialize chunked upload
 */
router.post('/upload/chunked/init', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { fileName, totalSize, totalChunks } = ChunkedUploadInitSchema.parse(req.body);
    const uploadService = getMediaUploadService();

    const session = await uploadService.initChunkedUpload(userId, fileName, totalSize, totalChunks);

    return res.json({ success: true, data: session });
  } catch (error) {
    console.error('Error initializing chunked upload:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to initialize chunked upload',
    });
  }
});

/**
 * POST /api/media/upload/chunked/:sessionId/chunk/:chunkIndex
 * Upload a chunk
 */
router.post(
  '/upload/chunked/:sessionId/chunk/:chunkIndex',
  authMiddleware,
  upload.single('chunk'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { sessionId, chunkIndex } = req.params;
      if (!req.file) {
        return res.status(400).json({ error: 'No chunk provided' });
      }

      const uploadService = getMediaUploadService();

      // Verify session belongs to user
      const session = uploadService.getUploadSession(sessionId);
      if (!session || session.userId !== userId) {
        return res.status(404).json({ error: 'Upload session not found' });
      }

      const result = await uploadService.uploadChunk(
        sessionId,
        parseInt(chunkIndex, 10),
        req.file.buffer
      );

      return res.json({ success: true, data: result });
    } catch (error) {
      console.error('Error uploading chunk:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to upload chunk',
      });
    }
  }
);

/**
 * POST /api/media/upload/chunked/:sessionId/complete
 * Complete chunked upload
 */
router.post(
  '/upload/chunked/:sessionId/complete',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { sessionId } = req.params;
      const options = ChunkedUploadCompleteSchema.parse({ ...req.body, sessionId });
      const uploadService = getMediaUploadService();

      // Verify session belongs to user
      const session = uploadService.getUploadSession(sessionId);
      if (!session || session.userId !== userId) {
        return res.status(404).json({ error: 'Upload session not found' });
      }

      const result = await uploadService.completeChunkedUpload(sessionId, {
        userId,
        modality: options.modality,
        projectId: options.projectId,
        datasetId: options.datasetId,
        processForModel: options.processForModel,
      });

      return res.json({ success: true, data: result });
    } catch (error) {
      console.error('Error completing chunked upload:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to complete chunked upload',
      });
    }
  }
);

/**
 * DELETE /api/media/upload/chunked/:sessionId
 * Cancel chunked upload
 */
router.delete(
  '/upload/chunked/:sessionId',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { sessionId } = req.params;
      const uploadService = getMediaUploadService();

      // Verify session belongs to user
      const session = uploadService.getUploadSession(sessionId);
      if (!session || session.userId !== userId) {
        return res.status(404).json({ error: 'Upload session not found' });
      }

      await uploadService.cancelChunkedUpload(sessionId);

      return res.json({ success: true, message: 'Upload cancelled' });
    } catch (error) {
      console.error('Error cancelling chunked upload:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to cancel chunked upload',
      });
    }
  }
);

// =============================================================================
// MEDIA PROCESSING ENDPOINTS
// =============================================================================

/**
 * GET /api/media/requirements/:modelId
 * Get media requirements for a model
 */
router.get('/requirements/:modelId', async (req, res: Response) => {
  try {
    const { modelId } = req.params;
    const processor = getMediaProcessor();
    const requirements = processor.getRequirementsForModel(modelId);

    return res.json({ success: true, data: requirements });
  } catch (error) {
    console.error('Error getting requirements:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get requirements',
    });
  }
});

/**
 * GET /api/media/requirements
 * Get all model requirements
 */
router.get('/requirements', (_req, res: Response) => {
  return res.json({ success: true, data: MODEL_REQUIREMENTS });
});

/**
 * POST /api/media/validate
 * Validate media file against model requirements
 */
router.post(
  '/validate',
  authMiddleware,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const { modelId, mediaType } = req.body;
      if (!modelId || !mediaType) {
        return res.status(400).json({ error: 'modelId and mediaType required' });
      }

      const processor = getMediaProcessor();
      const requirements = processor.getRequirementsForModel(modelId);

      // Save temp file for validation
      const fs = await import('fs/promises');
      const path = await import('path');
      const tempPath = path.join('/tmp', `validate_${Date.now()}_${req.file.originalname}`);
      await fs.writeFile(tempPath, req.file.buffer);

      const validation = await processor.validateMedia(tempPath, mediaType, requirements);

      // Clean up temp file
      await fs.unlink(tempPath).catch(() => {});

      return res.json({ success: true, data: validation });
    } catch (error) {
      console.error('Error validating media:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to validate media',
      });
    }
  }
);

// =============================================================================
// MEDIA PREVIEW ENDPOINTS
// =============================================================================

/**
 * POST /api/media/preview
 * Generate preview for a file
 */
router.post(
  '/preview',
  authMiddleware,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const { mediaType } = req.body;
      if (!mediaType || !['image', 'audio', 'video'].includes(mediaType)) {
        return res.status(400).json({ error: 'Valid mediaType required (image, audio, video)' });
      }

      const options = PreviewOptionsSchema.parse(req.body);
      const previewService = getMediaPreviewService();

      // Save temp file for preview generation
      const fs = await import('fs/promises');
      const path = await import('path');
      const tempPath = path.join('/tmp', `preview_${Date.now()}_${req.file.originalname}`);
      await fs.writeFile(tempPath, req.file.buffer);

      const preview = await previewService.generatePreview(tempPath, mediaType, options);

      // Clean up temp file
      await fs.unlink(tempPath).catch(() => {});

      return res.json({ success: true, data: preview });
    } catch (error) {
      console.error('Error generating preview:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate preview',
      });
    }
  }
);

/**
 * GET /api/media/preview/:previewPath
 * Get a generated preview file
 */
router.get('/preview/:previewPath', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { previewPath } = req.params;
    const fs = await import('fs/promises');
    const path = await import('path');

    // Sanitize path to prevent directory traversal
    const safePath = path.basename(previewPath);
    const fullPath = path.join('/tmp/kriptik-previews', safePath);

    // Check file exists
    await fs.access(fullPath);

    // Determine content type
    const ext = path.extname(safePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    const data = await fs.readFile(fullPath);
    return res.send(data);
  } catch (error) {
    console.error('Error serving preview:', error);
    return res.status(404).json({ error: 'Preview not found' });
  }
});

/**
 * POST /api/media/preview/comparison
 * Generate comparison preview (original vs processed)
 */
router.post(
  '/preview/comparison',
  authMiddleware,
  upload.fields([
    { name: 'original', maxCount: 1 },
    { name: 'processed', maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      if (!files.original?.[0] || !files.processed?.[0]) {
        return res.status(400).json({ error: 'Both original and processed files required' });
      }

      const { mediaType } = req.body;
      if (!mediaType || !['image', 'audio', 'video'].includes(mediaType)) {
        return res.status(400).json({ error: 'Valid mediaType required' });
      }

      const options = PreviewOptionsSchema.parse(req.body);
      const previewService = getMediaPreviewService();

      // Save temp files
      const fs = await import('fs/promises');
      const path = await import('path');
      const originalPath = path.join('/tmp', `orig_${Date.now()}_${files.original[0].originalname}`);
      const processedPath = path.join('/tmp', `proc_${Date.now()}_${files.processed[0].originalname}`);
      
      await fs.writeFile(originalPath, files.original[0].buffer);
      await fs.writeFile(processedPath, files.processed[0].buffer);

      const comparison = await previewService.generateComparisonPreview(
        originalPath,
        processedPath,
        mediaType,
        options
      );

      // Clean up temp files
      await fs.unlink(originalPath).catch(() => {});
      await fs.unlink(processedPath).catch(() => {});

      return res.json({ success: true, data: comparison });
    } catch (error) {
      console.error('Error generating comparison preview:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate comparison preview',
      });
    }
  }
);

/**
 * DELETE /api/media/preview/cache
 * Clear preview cache
 */
router.delete('/preview/cache', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const previewService = getMediaPreviewService();
    await previewService.clearCache();

    return res.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to clear cache',
    });
  }
});

export { router as mediaRouter };
export default router;
