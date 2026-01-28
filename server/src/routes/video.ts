/**
 * Video API Routes
 *
 * Endpoints for programmatic video generation using Remotion.
 * Supports 3D model videos, hero videos, loading animations, and more.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getRemotionService } from '../services/video/remotion-service.js';

const router = Router();

// ============================================================================
// Video Rendering Endpoints
// ============================================================================

/**
 * POST /api/video/render
 * Render a video from component code
 */
router.post('/render', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      componentCode,
      compositionId,
      durationInSeconds,
      fps,
      resolution,
      format,
      quality,
      codec,
      seamlessLoop,
      inputProps,
    } = req.body;

    if (!componentCode) {
      return res.status(400).json({
        error: 'Missing required field: componentCode',
      });
    }

    if (!durationInSeconds) {
      return res.status(400).json({
        error: 'Missing required field: durationInSeconds',
      });
    }

    const remotion = await getRemotionService();

    const result = await remotion.renderVideo({
      componentCode,
      compositionId,
      durationInSeconds,
      fps,
      resolution,
      format,
      quality,
      codec,
      seamlessLoop,
      inputProps,
    });

    res.json({
      success: true,
      video: {
        videoUrl: result.videoUrl,
        videoBase64: result.videoBase64,
        format: result.format,
        sizeKB: result.sizeKB,
        durationInSeconds: result.durationInSeconds,
        fps: result.fps,
        resolution: result.resolution,
        renderTime: result.renderTime,
        frameCount: result.frameCount,
      },
    });
  } catch (error) {
    console.error('[Video] Render failed:', error);
    next(error);
  }
});

/**
 * POST /api/video/render/3d
 * Render a video showcasing a 3D model with animation
 */
router.post('/render/3d', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      modelUrl,
      animation,
      camera,
      lighting,
      background,
      output,
    } = req.body;

    if (!modelUrl) {
      return res.status(400).json({
        error: 'Missing required field: modelUrl',
      });
    }

    const remotion = await getRemotionService();

    const result = await remotion.render3DAnimation({
      modelUrl,
      animation: animation || { type: 'rotate', duration: 5 },
      camera,
      lighting,
      background,
      output,
    });

    res.json({
      success: true,
      video: {
        videoUrl: result.videoUrl,
        format: result.format,
        sizeKB: result.sizeKB,
        durationInSeconds: result.durationInSeconds,
        fps: result.fps,
        renderTime: result.renderTime,
      },
    });
  } catch (error) {
    console.error('[Video] 3D render failed:', error);
    next(error);
  }
});

/**
 * POST /api/video/preview
 * Generate a preview GIF from component code
 */
router.post('/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      componentCode,
      durationInSeconds,
      size,
      inputProps,
    } = req.body;

    if (!componentCode) {
      return res.status(400).json({
        error: 'Missing required field: componentCode',
      });
    }

    const remotion = await getRemotionService();

    const result = await remotion.generatePreviewGif({
      componentCode,
      durationInSeconds: durationInSeconds || 2,
      size: size || 'preview',
      inputProps,
    });

    res.json({
      success: true,
      preview: {
        gifUrl: result.gifUrl,
        gifBase64: result.gifBase64,
        sizeKB: result.sizeKB,
        width: result.width,
        height: result.height,
      },
    });
  } catch (error) {
    console.error('[Video] Preview generation failed:', error);
    next(error);
  }
});

/**
 * POST /api/video/hero
 * Generate a hero section video
 */
router.post('/hero', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      backgroundType,
      text,
      colors,
      durationInSeconds,
      outputSize,
    } = req.body;

    if (!backgroundType) {
      return res.status(400).json({
        error: 'Missing required field: backgroundType',
      });
    }

    if (!colors || !colors.primary || !colors.secondary) {
      return res.status(400).json({
        error: 'Missing required field: colors (must include primary and secondary)',
      });
    }

    const remotion = await getRemotionService();

    const result = await remotion.generateHeroVideo({
      backgroundType,
      colors,
      text,
      durationInSeconds: durationInSeconds || 5,
      outputSize: outputSize || 'desktop',
    });

    res.json({
      success: true,
      video: {
        videoUrl: result.videoUrl,
        format: result.format,
        sizeKB: result.sizeKB,
        durationInSeconds: result.durationInSeconds,
        renderTime: result.renderTime,
      },
    });
  } catch (error) {
    console.error('[Video] Hero video generation failed:', error);
    next(error);
  }
});

/**
 * POST /api/video/loading
 * Generate a loading animation video
 */
router.post('/loading', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      style,
      color,
      backgroundColor,
      size,
      durationInSeconds,
    } = req.body;

    if (!style) {
      return res.status(400).json({
        error: 'Missing required field: style',
      });
    }

    const validStyles = ['spinner', 'dots', 'bars', 'pulse', '3d-cube'];
    if (!validStyles.includes(style)) {
      return res.status(400).json({
        error: `Invalid style. Valid styles: ${validStyles.join(', ')}`,
      });
    }

    if (!color) {
      return res.status(400).json({
        error: 'Missing required field: color',
      });
    }

    const remotion = await getRemotionService();

    const result = await remotion.generateLoadingAnimation({
      style,
      color,
      backgroundColor,
      size: size || 100,
      durationInSeconds: durationInSeconds || 2,
    });

    res.json({
      success: true,
      video: {
        gifUrl: result.gifUrl,
        gifBase64: result.gifBase64,
        sizeKB: result.sizeKB,
        width: result.width,
        height: result.height,
        loopable: true,
      },
    });
  } catch (error) {
    console.error('[Video] Loading animation generation failed:', error);
    next(error);
  }
});

// ============================================================================
// Composition Templates Endpoint
// ============================================================================

/**
 * GET /api/video/templates
 * List available video composition templates
 */
router.get('/templates', (req: Request, res: Response) => {
  res.json({
    success: true,
    templates: [
      {
        id: 'model-showcase',
        name: '3D Model Showcase',
        description: 'Rotating 3D model with studio lighting',
        parameters: ['modelUrl', 'animation', 'lighting', 'background'],
      },
      {
        id: 'hero-gradient',
        name: 'Gradient Hero',
        description: 'Animated gradient background with text',
        parameters: ['text', 'colors', 'durationInSeconds'],
      },
      {
        id: 'hero-particles',
        name: 'Particle Hero',
        description: 'Particle system background with floating elements',
        parameters: ['text', 'particleColor', 'density'],
      },
      {
        id: 'loading-spinner',
        name: 'Loading Spinner',
        description: 'Smooth circular loading animation',
        parameters: ['color', 'backgroundColor', 'durationInSeconds'],
      },
      {
        id: 'loading-dots',
        name: 'Loading Dots',
        description: 'Bouncing dots loading animation',
        parameters: ['color', 'backgroundColor', 'dotCount'],
      },
      {
        id: 'loading-bars',
        name: 'Loading Bars',
        description: 'Animated bars equalizer style',
        parameters: ['color', 'backgroundColor', 'barCount'],
      },
      {
        id: 'product-turntable',
        name: 'Product Turntable',
        description: '360 degree product showcase rotation',
        parameters: ['modelUrl', 'rotationSpeed', 'lighting'],
      },
      {
        id: 'text-reveal',
        name: 'Text Reveal',
        description: 'Animated text reveal with effects',
        parameters: ['text', 'style', 'colors'],
      },
    ],
  });
});

/**
 * GET /api/video/styles/hero
 * List available hero video styles
 */
router.get('/styles/hero', (req: Request, res: Response) => {
  res.json({
    success: true,
    styles: [
      { id: 'gradient', name: 'Gradient', description: 'Animated gradient background' },
      { id: 'particles', name: 'Particles', description: 'Floating particle system' },
      { id: 'waves', name: 'Waves', description: 'Animated wave patterns' },
      { id: 'mesh-gradient', name: 'Mesh Gradient', description: 'Morphing mesh gradients' },
      { id: 'aurora', name: 'Aurora', description: 'Northern lights effect' },
      { id: '3d-shapes', name: '3D Shapes', description: 'Floating 3D geometric shapes' },
    ],
  });
});

/**
 * GET /api/video/styles/loading
 * List available loading animation styles
 */
router.get('/styles/loading', (req: Request, res: Response) => {
  res.json({
    success: true,
    styles: [
      { id: 'spinner', name: 'Spinner', description: 'Circular spinning loader' },
      { id: 'dots', name: 'Dots', description: 'Bouncing dots animation' },
      { id: 'bars', name: 'Bars', description: 'Animated equalizer bars' },
      { id: 'pulse', name: 'Pulse', description: 'Pulsing circle animation' },
      { id: '3d-cube', name: '3D Cube', description: 'Rotating 3D cube loader' },
    ],
  });
});

/**
 * GET /api/video/health
 * Check video service health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Basic health check - service is available if we can instantiate it
    await getRemotionService();

    res.json({
      success: true,
      service: {
        name: 'remotion',
        healthy: true,
        lastChecked: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.json({
      success: true,
      service: {
        name: 'remotion',
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString(),
      },
    });
  }
});

export default router;
