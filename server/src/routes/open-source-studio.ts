/**
 * Open Source Studio API Routes
 *
 * HuggingFace model search and metadata endpoints.
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 2).
 */

import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { HuggingFaceService, type ModelTask } from '../services/ml/huggingface.js';
import { getOpenSourceStudioDeployer } from '../services/open-source-studio/index.js';

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

// =============================================================================
// DATASETS (PROMPT 4)
// =============================================================================

/**
 * GET /api/open-source-studio/datasets/search
 * Search HuggingFace datasets
 */
router.get('/datasets/search', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search = '',
      filter = '',
      sort = 'downloads',
      limit = '50',
    } = req.query as Record<string, string>;

    const limitNum = Math.min(parseInt(limit, 10) || 50, 100);

    // Build HuggingFace API URL
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filter) params.set('filter', filter);
    params.set('sort', sort);
    params.set('limit', String(limitNum));

    const hfApiUrl = `https://huggingface.co/api/datasets?${params.toString()}`;

    const response = await fetch(hfApiUrl, {
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'omit',
    });

    if (!response.ok) {
      throw new Error(`HuggingFace API error: ${response.status}`);
    }

    const datasets = await response.json();

    // Transform to our format
    const formattedDatasets = datasets.map((dataset: any) => ({
      id: dataset.id,
      author: dataset.author || dataset.id.split('/')[0],
      name: dataset.id.split('/').pop(),
      description: dataset.description || '',
      downloads: dataset.downloads || 0,
      likes: dataset.likes || 0,
      tags: dataset.tags || [],
      size: dataset.size || null,
      cardData: dataset.cardData,
      lastModified: dataset.lastModified,
    }));

    res.json(formattedDatasets);
  } catch (error) {
    console.error('[Open Source Studio] Dataset search error:', error);
    res.status(500).json({
      error: 'Failed to search datasets',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/open-source-studio/datasets/:author/:name
 * Get detailed info for a specific dataset
 */
router.get('/datasets/:author/:name', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { author, name } = req.params;
    const datasetId = `${author}/${name}`;

    const hfApiUrl = `https://huggingface.co/api/datasets/${datasetId}`;

    const response = await fetch(hfApiUrl, {
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'omit',
    });

    if (!response.ok) {
      if (response.status === 404) {
        res.status(404).json({ error: 'Dataset not found' });
        return;
      }
      throw new Error(`HuggingFace API error: ${response.status}`);
    }

    const dataset = await response.json();

    res.json({
      dataset: {
        id: dataset.id,
        author: dataset.author || dataset.id.split('/')[0],
        name: dataset.id.split('/').pop(),
        description: dataset.description || '',
        downloads: dataset.downloads || 0,
        likes: dataset.likes || 0,
        tags: dataset.tags || [],
        size: dataset.size || null,
        cardData: dataset.cardData,
        lastModified: dataset.lastModified,
      },
    });
  } catch (error) {
    console.error('[Open Source Studio] Dataset details error:', error);
    res.status(500).json({
      error: 'Failed to get dataset details',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// =============================================================================
// DEPLOY TO ENDPOINT (PROMPT 9)
// =============================================================================

/**
 * POST /api/open-source-studio/deploy
 * Deploy a HuggingFace model to a private endpoint
 */
router.post('/deploy', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { modelId, modelName, modelDescription, customConfig } = req.body;

    if (!modelId) {
      res.status(400).json({ error: 'modelId is required' });
      return;
    }

    const deployer = getOpenSourceStudioDeployer();
    const result = await deployer.deployModel({
      userId,
      modelId,
      modelName,
      modelDescription,
      customConfig,
    });

    res.json({
      success: true,
      endpoint: result,
    });
  } catch (error) {
    console.error('[Open Source Studio] Deploy error:', error);
    res.status(500).json({
      error: 'Failed to deploy model',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/open-source-studio/deploy/preview/:author/:name
 * Get deployment preview (cost estimate, GPU recommendation)
 */
router.get('/deploy/preview/:author/:name', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { author, name } = req.params;
    const modelId = `${author}/${name}`;

    const deployer = getOpenSourceStudioDeployer();
    const preview = await deployer.getDeploymentPreview(modelId);

    res.json({
      success: true,
      preview,
    });
  } catch (error) {
    console.error('[Open Source Studio] Preview error:', error);
    res.status(500).json({
      error: 'Failed to get deployment preview',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/open-source-studio/deploy/check/:author/:name
 * Check if a model is deployable
 */
router.get('/deploy/check/:author/:name', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { author, name } = req.params;
    const modelId = `${author}/${name}`;

    const deployer = getOpenSourceStudioDeployer();
    const check = await deployer.checkDeployability(modelId);

    res.json({
      success: true,
      ...check,
    });
  } catch (error) {
    console.error('[Open Source Studio] Deployability check error:', error);
    res.status(500).json({
      error: 'Failed to check deployability',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
