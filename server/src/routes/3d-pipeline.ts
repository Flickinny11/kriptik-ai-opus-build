/**
 * 3D Pipeline API Routes
 *
 * Endpoints for Image-to-3D conversion, 3D model animation,
 * and web-optimized 3D asset generation.
 *
 * Services:
 * - RunPod Image-to-3D (Stable Fast 3D)
 * - RunPod 3D Animation (Hunyuan Motion + Procedural)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getImageTo3DProvider } from '../services/embeddings/providers/runpod-image-to-3d-provider.js';
import { get3DAnimationProvider } from '../services/embeddings/providers/runpod-3d-animation-provider.js';

const router = Router();

// ============================================================================
// Image-to-3D Conversion Endpoints
// ============================================================================

/**
 * POST /api/3d/convert
 * Convert a 2D image to a 3D model
 */
router.post('/convert', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      imageUrl,
      imageBase64,
      outputFormat,
      quality,
      optimize,
      removeBackground,
      meshSettings,
    } = req.body;

    if (!imageUrl && !imageBase64) {
      return res.status(400).json({
        error: 'Either imageUrl or imageBase64 is required',
      });
    }

    const provider = getImageTo3DProvider();

    if (!provider.isConfigured()) {
      return res.status(503).json({
        error: 'Image-to-3D service not configured. Set RUNPOD_IMAGE_TO_3D_ENDPOINT.',
      });
    }

    const result = await provider.convert({
      imageUrl,
      imageBase64,
      outputFormat: outputFormat || 'glb',
      quality: quality || 'standard',
      optimize,
      removeBackground: removeBackground ?? true,
      meshSettings,
    });

    res.json({
      success: true,
      model: {
        modelUrl: result.modelUrl,
        modelBase64: result.modelBase64,
        format: result.format,
        sizeKB: result.sizeKB,
        vertexCount: result.vertexCount,
        faceCount: result.faceCount,
        hasTextures: result.hasTextures,
        textureResolution: result.textureResolution,
        inferenceTime: result.inferenceTime,
        previewImageUrl: result.previewImageUrl,
      },
    });
  } catch (error) {
    console.error('[3D-Pipeline] Image-to-3D conversion failed:', error);
    next(error);
  }
});

/**
 * POST /api/3d/convert/batch
 * Convert multiple images to 3D models in parallel
 */
router.post('/convert/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { requests } = req.body;

    if (!requests || !Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        error: 'Missing required field: requests (array)',
      });
    }

    if (requests.length > 5) {
      return res.status(400).json({
        error: 'Maximum 5 images per batch request',
      });
    }

    const provider = getImageTo3DProvider();

    if (!provider.isConfigured()) {
      return res.status(503).json({
        error: 'Image-to-3D service not configured.',
      });
    }

    const results = await provider.batchConvert(requests);

    res.json({
      success: true,
      models: results.map((r) => ({
        modelUrl: r.modelUrl,
        format: r.format,
        sizeKB: r.sizeKB,
        vertexCount: r.vertexCount,
        faceCount: r.faceCount,
        inferenceTime: r.inferenceTime,
      })),
      totalModels: results.length,
    });
  } catch (error) {
    console.error('[3D-Pipeline] Batch conversion failed:', error);
    next(error);
  }
});

/**
 * POST /api/3d/convert/web-optimized
 * Convert image to web-optimized 3D model with LOD
 */
router.post('/convert/web-optimized', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { imageUrl, imageBase64, quality } = req.body;

    if (!imageUrl && !imageBase64) {
      return res.status(400).json({
        error: 'Either imageUrl or imageBase64 is required',
      });
    }

    const provider = getImageTo3DProvider();

    if (!provider.isConfigured()) {
      return res.status(503).json({
        error: 'Image-to-3D service not configured.',
      });
    }

    const result = await provider.convertForWeb({
      imageUrl,
      imageBase64,
      quality,
    });

    res.json({
      success: true,
      model: {
        modelUrl: result.modelUrl,
        format: result.format,
        sizeKB: result.sizeKB,
        vertexCount: result.vertexCount,
        faceCount: result.faceCount,
        hasTextures: result.hasTextures,
        lodVersions: result.lodVersions,
        inferenceTime: result.inferenceTime,
      },
    });
  } catch (error) {
    console.error('[3D-Pipeline] Web-optimized conversion failed:', error);
    next(error);
  }
});

/**
 * POST /api/3d/generate-r3f
 * Generate React Three Fiber component for a 3D model
 */
router.post('/generate-r3f', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { modelUrl } = req.body;

    if (!modelUrl) {
      return res.status(400).json({
        error: 'Missing required field: modelUrl',
      });
    }

    const provider = getImageTo3DProvider();
    const component = await provider.generateR3FComponent(modelUrl);

    res.json({
      success: true,
      component,
    });
  } catch (error) {
    console.error('[3D-Pipeline] R3F component generation failed:', error);
    next(error);
  }
});

// ============================================================================
// 3D Animation Endpoints
// ============================================================================

/**
 * POST /api/3d/animate/procedural
 * Apply procedural animation to a 3D model (local, fast)
 */
router.post('/animate/procedural', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      modelUrl,
      animationType,
      parameters,
      duration,
      loop,
    } = req.body;

    if (!modelUrl || !animationType) {
      return res.status(400).json({
        error: 'Missing required fields: modelUrl, animationType',
      });
    }

    const validTypes = ['rotate', 'float', 'pulse', 'orbit', 'bounce', 'swing', 'spin', 'wobble', 'breathe'];
    if (!validTypes.includes(animationType)) {
      return res.status(400).json({
        error: `Invalid animation type. Valid types: ${validTypes.join(', ')}`,
      });
    }

    const provider = get3DAnimationProvider();
    const result = provider.generateProceduralAnimation({
      type: animationType,
      duration: duration || 2,
      easing: parameters?.easing || 'easeInOut',
      params: {
        loop: loop ?? true,
        ...parameters,
      },
    });

    res.json({
      success: true,
      animation: {
        modelUrl,
        animationType,
        animationCode: result.animationCode,
        gsapCode: result.gsapCode,
        cssAnimation: result.cssAnimation,
        keyframes: result.keyframes,
        duration: result.duration,
        loop: result.loop,
      },
    });
  } catch (error) {
    console.error('[3D-Pipeline] Procedural animation failed:', error);
    next(error);
  }
});

/**
 * POST /api/3d/animate/ai
 * Generate AI-driven character animation (RunPod Hunyuan Motion)
 */
router.post('/animate/ai', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      prompt,
      motionPrompt,
      inputModelUrl,
      outputFormat,
      duration,
      fps,
      characterType,
    } = req.body;

    if (!prompt && !motionPrompt) {
      return res.status(400).json({
        error: 'Either prompt or motionPrompt is required',
      });
    }

    const provider = get3DAnimationProvider();

    if (!provider.isConfigured()) {
      return res.status(503).json({
        error: '3D Animation service not configured. Set RUNPOD_3D_ANIMATION_ENDPOINT.',
      });
    }

    const result = await provider.generateAIAnimation({
      motionPrompt: motionPrompt || prompt,
      modelUrl: inputModelUrl,
      duration: duration || 3,
      fps: fps || 30,
      characterType: characterType || 'humanoid',
    });

    res.json({
      success: true,
      animation: {
        animatedModelUrl: result.animatedModelUrl,
        animationDataUrl: result.animationDataUrl,
        format: result.format,
        keyframes: result.keyframes,
        previewVideoUrl: result.previewVideoUrl,
      },
    });
  } catch (error) {
    console.error('[3D-Pipeline] AI animation generation failed:', error);
    next(error);
  }
});

/**
 * POST /api/3d/animate/apply
 * Apply animation to a 3D model
 */
router.post('/animate/apply', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { modelUrl, animationUrl, outputFormat, blendMode, retarget } = req.body;

    if (!modelUrl || !animationUrl) {
      return res.status(400).json({
        error: 'Missing required fields: modelUrl, animationUrl',
      });
    }

    const provider = get3DAnimationProvider();

    if (!provider.isConfigured()) {
      return res.status(503).json({
        error: '3D Animation service not configured.',
      });
    }

    // TODO: Implement applyAnimationToModel when Hunyuan Motion is deployed
    return res.status(501).json({
      error: 'Animation application not yet implemented. Deploy Hunyuan Motion to RunPod first.',
      hint: 'See Priority 7 in implementation plan: Deploy Stable Fast 3D and Hunyuan Motion',
    });
  } catch (error) {
    console.error('[3D-Pipeline] Apply animation failed:', error);
    next(error);
  }
});

/**
 * POST /api/3d/animate/generate-r3f
 * Generate animated React Three Fiber component
 */
router.post('/animate/generate-r3f', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { modelUrl, animationType, parameters } = req.body;

    if (!modelUrl) {
      return res.status(400).json({
        error: 'Missing required field: modelUrl',
      });
    }

    const provider = get3DAnimationProvider();

    // Generate procedural animation config
    const animConfig = provider.generateProceduralAnimation({
      type: animationType || 'rotate',
      duration: parameters?.duration || 2,
      params: parameters,
    });

    // Generate R3F component code from animation config
    const componentCode = `
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

export function AnimatedModel({ url = '${modelUrl}' }) {
  const ref = useRef();
  const { scene } = useGLTF(url);

  useFrame((state, delta) => {
    if (!ref.current) return;
    ${animConfig.animationCode}
  });

  return <primitive ref={ref} object={scene} />;
}
`.trim();

    res.json({
      success: true,
      component: {
        code: componentCode,
        animationType: animationType || 'rotate',
        duration: animConfig.duration,
        loop: animConfig.loop,
      },
    });
  } catch (error) {
    console.error('[3D-Pipeline] Animated R3F component generation failed:', error);
    next(error);
  }
});

// ============================================================================
// Combined Pipeline Endpoints
// ============================================================================

/**
 * POST /api/3d/pipeline/full
 * Full pipeline: Image -> 3D Model -> Animation -> Web-Ready Asset
 */
router.post('/pipeline/full', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      imageUrl,
      imageBase64,
      quality,
      animationType,
      animationParameters,
      webOptimize,
    } = req.body;

    if (!imageUrl && !imageBase64) {
      return res.status(400).json({
        error: 'Either imageUrl or imageBase64 is required',
      });
    }

    const imageTo3D = getImageTo3DProvider();
    const animation = get3DAnimationProvider();

    if (!imageTo3D.isConfigured()) {
      return res.status(503).json({
        error: 'Image-to-3D service not configured.',
      });
    }

    // Step 1: Convert image to 3D
    const conversionMethod = webOptimize
      ? imageTo3D.convertForWeb.bind(imageTo3D)
      : imageTo3D.convert.bind(imageTo3D);

    const model3D = await conversionMethod({
      imageUrl,
      imageBase64,
      quality: quality || 'standard',
    });

    // Step 2: Apply animation if requested
    let animationResult: import('../services/embeddings/providers/runpod-3d-animation-provider.js').AnimatedModelConfig | null = null;
    if (animationType) {
      animationResult = animation.generateProceduralAnimation({
        type: animationType,
        duration: 2,
        easing: animationParameters?.easing || 'easeInOut',
        params: {
          loop: true,
          ...animationParameters,
        },
      });
    }

    // Step 3: Generate R3F component
    // If animated, generate inline code; otherwise use imageTo3D service
    let r3fComponent: string;
    if (animationResult) {
      r3fComponent = `
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

export function AnimatedModel({ url = '${model3D.modelUrl}' }) {
  const ref = useRef();
  const { scene } = useGLTF(url);

  useFrame((state, delta) => {
    if (!ref.current) return;
    ${animationResult.animationCode}
  });

  return <primitive ref={ref} object={scene} />;
}
`.trim();
    } else {
      r3fComponent = await imageTo3D.generateR3FComponent(model3D.modelUrl);
    }

    res.json({
      success: true,
      pipeline: {
        model: {
          modelUrl: model3D.modelUrl,
          format: model3D.format,
          sizeKB: model3D.sizeKB,
          vertexCount: model3D.vertexCount,
          faceCount: model3D.faceCount,
          lodVersions: model3D.lodVersions,
        },
        animation: animationResult
          ? {
              type: animationType,
              animationCode: animationResult.animationCode,
              gsapCode: animationResult.gsapCode,
              duration: animationResult.duration,
              loop: animationResult.loop,
            }
          : null,
        component: r3fComponent,
        totalInferenceTime: model3D.inferenceTime,
      },
    });
  } catch (error) {
    console.error('[3D-Pipeline] Full pipeline failed:', error);
    next(error);
  }
});

// ============================================================================
// Health Check Endpoint
// ============================================================================

/**
 * GET /api/3d/health
 * Check 3D pipeline service health
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const imageTo3D = getImageTo3DProvider();
    const animation = get3DAnimationProvider();

    const [imageTo3DHealth, animationHealth] = await Promise.all([
      imageTo3D.healthCheck(),
      animation.healthCheck(),
    ]);

    res.json({
      success: true,
      services: {
        imageTo3D: imageTo3DHealth,
        animation: animationHealth,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/3d/animation-types
 * List available procedural animation types
 */
router.get('/animation-types', (req: Request, res: Response) => {
  res.json({
    success: true,
    types: [
      { name: 'rotate', description: 'Continuous rotation around Y-axis', parameters: ['speed', 'axis'] },
      { name: 'float', description: 'Gentle floating up and down', parameters: ['amplitude', 'frequency'] },
      { name: 'pulse', description: 'Scale pulsing effect', parameters: ['minScale', 'maxScale', 'frequency'] },
      { name: 'orbit', description: 'Orbit around a center point', parameters: ['radius', 'speed', 'axis'] },
      { name: 'bounce', description: 'Bouncing motion with physics', parameters: ['height', 'damping'] },
      { name: 'swing', description: 'Pendulum-like swinging', parameters: ['angle', 'frequency', 'axis'] },
      { name: 'spin', description: 'Fast spinning with momentum', parameters: ['speed', 'acceleration'] },
      { name: 'wobble', description: 'Wobbly rotation on multiple axes', parameters: ['intensity', 'frequency'] },
      { name: 'breathe', description: 'Organic breathing scale', parameters: ['minScale', 'maxScale', 'duration'] },
    ],
  });
});

export default router;
