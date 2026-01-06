/**
 * Open Source Studio API Routes
 * 
 * HuggingFace model search and metadata endpoints.
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 2).
 */

import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { HuggingFaceService, type ModelTask } from '../services/ml/huggingface.js';

const router = Router();

// =============================================================================
// TYPES
// =============================================================================

interface SearchParams {
  query?: string;
  task?: ModelTask;
  library?: string;
  sort?: 'downloads' | 'likes' | 'lastModified';
  page?: number;
  limit?: number;
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /api/open-source-studio/models
 * Search HuggingFace models with filtering
 */
router.get('/models', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      query = '',
      task,
      library,
      sort = 'downloads',
      page = '0',
      limit = '20',
    } = req.query as Record<string, string>;

    const pageNum = parseInt(page, 10) || 0;
    const limitNum = Math.min(parseInt(limit, 10) || 20, 50); // Max 50

    // Initialize HuggingFace service
    const hfService = new HuggingFaceService();

    // If no query and no task filter, return popular models
    const searchQuery = query || (task ? '' : 'llama');

    const models = await hfService.searchModels(searchQuery, {
      task: task as ModelTask | undefined,
      library: library || undefined,
      limit: limitNum,
      sort: sort as 'downloads' | 'likes' | 'lastModified',
    });

    // Enhance models with additional metadata
    const enhancedModels = models.map(model => {
      // Calculate estimated size from siblings
      const estimatedSize = model.siblings
        ?.filter(f =>
          f.rfilename.endsWith('.bin') ||
          f.rfilename.endsWith('.safetensors') ||
          f.rfilename.endsWith('.pt')
        )
        .reduce((sum, f) => sum + (f.size || 0), 0) || 0;

      const estimatedVRAM = Math.ceil((estimatedSize / (1024 * 1024 * 1024)) * 2.5);

      // Check if license allows modifications
      const restrictiveLicenses = ['cc-by-nc', 'cc-by-nc-nd', 'cc-by-nc-sa', 'other', 'proprietary'];
      const canBeModified = !restrictiveLicenses.some(
        r => model.cardData?.license?.toLowerCase().includes(r)
      );

      return {
        ...model,
        estimatedSize,
        estimatedVRAM: estimatedVRAM || undefined,
        canBeModified,
      };
    });

    res.json({
      models: enhancedModels,
      page: pageNum,
      limit: limitNum,
      hasMore: models.length === limitNum,
    });
  } catch (error) {
    console.error('[Open Source Studio] Model search error:', error);
    res.status(500).json({
      error: 'Failed to search models',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/open-source-studio/models/:modelId
 * Get detailed info for a specific model
 */
router.get('/models/:author/:name', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { author, name } = req.params;
    const modelId = `${author}/${name}`;

    const hfService = new HuggingFaceService();
    const model = await hfService.getModel(modelId);

    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    // Get requirements analysis
    const requirements = await hfService.analyzeRequirements(modelId);

    res.json({
      model,
      requirements,
    });
  } catch (error) {
    console.error('[Open Source Studio] Model details error:', error);
    res.status(500).json({
      error: 'Failed to get model details',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/open-source-studio/tasks
 * Get available task types for filtering
 */
router.get('/tasks', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  const tasks = [
    { value: 'text-generation', label: 'Text Generation' },
    { value: 'text-to-image', label: 'Text to Image' },
    { value: 'image-to-image', label: 'Image to Image' },
    { value: 'text-classification', label: 'Text Classification' },
    { value: 'question-answering', label: 'Question Answering' },
    { value: 'translation', label: 'Translation' },
    { value: 'summarization', label: 'Summarization' },
    { value: 'automatic-speech-recognition', label: 'Speech Recognition' },
    { value: 'text-to-speech', label: 'Text to Speech' },
    { value: 'image-classification', label: 'Image Classification' },
    { value: 'object-detection', label: 'Object Detection' },
    { value: 'feature-extraction', label: 'Feature Extraction' },
    { value: 'fill-mask', label: 'Fill Mask' },
    { value: 'sentence-similarity', label: 'Sentence Similarity' },
    { value: 'token-classification', label: 'Token Classification' },
    { value: 'image-segmentation', label: 'Image Segmentation' },
    { value: 'depth-estimation', label: 'Depth Estimation' },
    { value: 'video-classification', label: 'Video Classification' },
    { value: 'zero-shot-classification', label: 'Zero-Shot Classification' },
  ];

  res.json({ tasks });
});

/**
 * GET /api/open-source-studio/libraries
 * Get available libraries for filtering
 */
router.get('/libraries', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  const libraries = [
    { value: 'transformers', label: 'Transformers' },
    { value: 'diffusers', label: 'Diffusers' },
    { value: 'sentence-transformers', label: 'Sentence Transformers' },
    { value: 'timm', label: 'TIMM' },
    { value: 'peft', label: 'PEFT' },
    { value: 'safetensors', label: 'SafeTensors' },
    { value: 'pytorch', label: 'PyTorch' },
    { value: 'tensorflow', label: 'TensorFlow' },
    { value: 'jax', label: 'JAX' },
    { value: 'onnx', label: 'ONNX' },
    { value: 'keras', label: 'Keras' },
  ];

  res.json({ libraries });
});

export default router;
