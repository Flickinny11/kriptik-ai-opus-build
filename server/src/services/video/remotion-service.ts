/**
 * Remotion Video Service
 *
 * Integrates with Remotion for programmatic video generation.
 * Renders React components to smooth, high-quality videos.
 *
 * Features:
 * - Generate MP4/WebM/GIF from React components
 * - Render 3D animations from Three.js/R3F scenes
 * - Create preview GIFs for Design Mode
 * - Export marketing videos from UI mockups
 * - Seamless looping animations for hero sections
 *
 * Integration: Uses Remotion Lambda for serverless rendering
 * or local Remotion CLI for development
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

// ============================================================================
// Configuration
// ============================================================================

const REMOTION_PROJECT_PATH = process.env.REMOTION_PROJECT_PATH || path.join(process.cwd(), 'remotion');
const REMOTION_OUTPUT_DIR = process.env.REMOTION_OUTPUT_DIR || path.join(os.tmpdir(), 'remotion-output');
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const REMOTION_LAMBDA_FUNCTION = process.env.REMOTION_LAMBDA_FUNCTION;

// ============================================================================
// Types
// ============================================================================

export interface VideoRenderRequest {
  /** React component code to render */
  componentCode: string;
  /** Composition ID (must match Remotion project) */
  compositionId?: string;
  /** Duration in seconds */
  durationInSeconds: number;
  /** Frame rate (15 for GIF, 30/60 for video) */
  fps?: 15 | 30 | 60;
  /** Output resolution */
  resolution?: {
    width: number;
    height: number;
  };
  /** Output format */
  format?: 'mp4' | 'webm' | 'gif';
  /** Quality (0-100, only for mp4/webm) */
  quality?: number;
  /** Codec for video encoding */
  codec?: 'h264' | 'h265' | 'vp8' | 'vp9';
  /** Whether to loop seamlessly (for GIFs) */
  seamlessLoop?: boolean;
  /** Input props for the component */
  inputProps?: Record<string, unknown>;
}

export interface Video3DRenderRequest {
  /** 3D model URL (GLB/GLTF) */
  modelUrl: string;
  /** Animation configuration */
  animation: {
    type: 'rotate' | 'orbit' | 'custom';
    duration: number;
    /** For custom: animation keyframes */
    keyframes?: Array<{
      time: number;
      position?: { x: number; y: number; z: number };
      rotation?: { x: number; y: number; z: number };
      scale?: { x: number; y: number; z: number };
    }>;
  };
  /** Camera configuration */
  camera?: {
    position?: { x: number; y: number; z: number };
    target?: { x: number; y: number; z: number };
    fov?: number;
  };
  /** Lighting configuration */
  lighting?: {
    ambient?: number;
    directional?: { intensity: number; position: { x: number; y: number; z: number } };
    environment?: 'studio' | 'sunset' | 'forest' | 'city';
  };
  /** Background */
  background?: {
    color?: string;
    gradient?: { from: string; to: string; direction: 'vertical' | 'horizontal' | 'radial' };
    transparent?: boolean;
  };
  /** Output settings */
  output?: {
    fps?: 30 | 60;
    width?: number;
    height?: number;
    format?: 'mp4' | 'webm' | 'gif';
  };
}

export interface RenderedVideo {
  /** URL to download the video */
  videoUrl: string;
  /** Local file path if rendered locally */
  filePath?: string;
  /** Base64 encoded video (only for small files) */
  videoBase64?: string;
  /** Duration in seconds */
  durationInSeconds: number;
  /** File size in KB */
  sizeKB: number;
  /** Resolution */
  resolution: {
    width: number;
    height: number;
  };
  /** Frame rate */
  fps: number;
  /** Format */
  format: string;
  /** Render time in seconds */
  renderTime: number;
  /** Frame count */
  frameCount: number;
}

export interface PreviewGifResult {
  /** URL to the GIF */
  gifUrl: string;
  /** Local file path */
  filePath?: string;
  /** Base64 encoded GIF */
  gifBase64?: string;
  /** Dimensions */
  width: number;
  height: number;
  /** File size in KB */
  sizeKB: number;
}

// ============================================================================
// Remotion Service Implementation
// ============================================================================

export class RemotionService {
  private outputDir: string;
  private projectPath: string;

  constructor() {
    this.outputDir = REMOTION_OUTPUT_DIR;
    this.projectPath = REMOTION_PROJECT_PATH;
  }

  /**
   * Initialize the service (ensure directories exist)
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
  }

  /**
   * Render video from React component code
   */
  async renderVideo(request: VideoRenderRequest): Promise<RenderedVideo> {
    const startTime = Date.now();

    // Generate unique ID for this render
    const renderId = `render-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const outputFileName = `${renderId}.${request.format || 'mp4'}`;
    const outputPath = path.join(this.outputDir, outputFileName);

    // Calculate frame count
    const fps = request.fps || 30;
    const frameCount = Math.ceil(request.durationInSeconds * fps);

    // Resolution defaults
    const width = request.resolution?.width || 1920;
    const height = request.resolution?.height || 1080;

    // If Lambda is configured, use serverless rendering
    if (REMOTION_LAMBDA_FUNCTION) {
      return this.renderWithLambda(request, renderId);
    }

    // Otherwise, use local CLI rendering
    try {
      // Write component code to temporary file
      const componentPath = path.join(this.outputDir, `${renderId}-component.tsx`);
      await fs.writeFile(componentPath, this.wrapComponentCode(request.componentCode, request.inputProps));

      // Build Remotion CLI command
      const args = [
        'remotion',
        'render',
        componentPath,
        request.compositionId || 'Main',
        outputPath,
        '--props', JSON.stringify(request.inputProps || {}),
        '--frames', `0-${frameCount - 1}`,
        '--fps', fps.toString(),
        '--width', width.toString(),
        '--height', height.toString(),
        '--codec', this.mapCodec(request.codec || 'h264', request.format || 'mp4'),
        '--crf', request.quality ? Math.round((100 - request.quality) * 0.51).toString() : '18',
      ];

      if (request.format === 'gif') {
        args.push('--image-format', 'png');
      }

      // Execute render
      await this.executeCommand('npx', args);

      // Get file stats
      const stats = await fs.stat(outputPath);

      // Read file as base64 if small enough
      let videoBase64: string | undefined;
      if (stats.size < 5 * 1024 * 1024) { // < 5MB
        const buffer = await fs.readFile(outputPath);
        videoBase64 = buffer.toString('base64');
      }

      // Cleanup temp component file
      await fs.unlink(componentPath).catch(() => {});

      return {
        videoUrl: `file://${outputPath}`,
        filePath: outputPath,
        videoBase64,
        durationInSeconds: request.durationInSeconds,
        sizeKB: Math.round(stats.size / 1024),
        resolution: { width, height },
        fps,
        format: request.format || 'mp4',
        renderTime: (Date.now() - startTime) / 1000,
        frameCount,
      };

    } catch (error) {
      throw new Error(`Video render failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Render 3D animation to video
   */
  async render3DAnimation(request: Video3DRenderRequest): Promise<RenderedVideo> {
    // Generate R3F component code for the 3D scene
    const componentCode = this.generate3DComponentCode(request);

    return this.renderVideo({
      componentCode,
      durationInSeconds: request.animation.duration,
      fps: request.output?.fps || 60,
      resolution: {
        width: request.output?.width || 1920,
        height: request.output?.height || 1080,
      },
      format: request.output?.format || 'mp4',
      seamlessLoop: true,
    });
  }

  /**
   * Generate preview GIF for Design Mode
   */
  async generatePreviewGif(request: {
    componentCode: string;
    durationInSeconds: number;
    size: 'thumbnail' | 'preview' | 'full';
    inputProps?: Record<string, unknown>;
  }): Promise<PreviewGifResult> {
    const sizes = {
      thumbnail: { width: 200, height: 150 },
      preview: { width: 400, height: 300 },
      full: { width: 800, height: 600 },
    };

    const { width, height } = sizes[request.size];

    const result = await this.renderVideo({
      componentCode: request.componentCode,
      durationInSeconds: request.durationInSeconds,
      fps: 15, // Lower fps for GIF
      resolution: { width, height },
      format: 'gif',
      seamlessLoop: true,
      inputProps: request.inputProps,
    });

    return {
      gifUrl: result.videoUrl,
      filePath: result.filePath,
      gifBase64: result.videoBase64,
      width,
      height,
      sizeKB: result.sizeKB,
    };
  }

  /**
   * Generate hero animation video
   */
  async generateHeroVideo(request: {
    backgroundType: 'gradient' | 'particles' | '3d-model' | 'abstract';
    colors: { primary: string; secondary: string };
    text?: { headline: string; subheadline?: string };
    durationInSeconds: number;
    outputSize: 'mobile' | 'desktop' | 'square';
  }): Promise<RenderedVideo> {
    const sizes = {
      mobile: { width: 430, height: 932 },
      desktop: { width: 1920, height: 1080 },
      square: { width: 1080, height: 1080 },
    };

    const componentCode = this.generateHeroComponentCode(request);

    return this.renderVideo({
      componentCode,
      durationInSeconds: request.durationInSeconds,
      fps: 60,
      resolution: sizes[request.outputSize],
      format: 'mp4',
      seamlessLoop: true,
      inputProps: request,
    });
  }

  /**
   * Generate loading animation
   */
  async generateLoadingAnimation(request: {
    style: 'spinner' | 'dots' | 'bars' | 'pulse' | '3d-cube';
    color: string;
    backgroundColor?: string;
    size: number;
    durationInSeconds: number;
  }): Promise<PreviewGifResult> {
    const componentCode = this.generateLoadingComponentCode(request);

    return this.generatePreviewGif({
      componentCode,
      durationInSeconds: request.durationInSeconds,
      size: 'thumbnail',
      inputProps: request,
    });
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Wrap component code in Remotion composition structure
   */
  private wrapComponentCode(code: string, props?: Record<string, unknown>): string {
    return `
import { Composition, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { AbsoluteFill } from 'remotion';
import React from 'react';

// User component
${code}

// Composition wrapper
export const Main = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <UserComponent
        frame={frame}
        fps={fps}
        duration={durationInFrames}
        width={width}
        height={height}
        {...props}
      />
    </AbsoluteFill>
  );
};

// Rename user's default export
const UserComponent = (() => {
  ${code}
  return typeof Component !== 'undefined' ? Component : (() => null);
})();

export const RemotionVideo = () => {
  return (
    <Composition
      id="Main"
      component={Main}
      durationInFrames={${props?.durationInFrames || 150}}
      fps={${props?.fps || 30}}
      width={${props?.width || 1920}}
      height={${props?.height || 1080}}
      defaultProps={${JSON.stringify(props || {})}}
    />
  );
};
`.trim();
  }

  /**
   * Generate R3F component code for 3D animation
   */
  private generate3DComponentCode(request: Video3DRenderRequest): string {
    const { modelUrl, animation, camera, lighting, background } = request;

    return `
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment, PresentationControls } from '@react-three/drei';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import React, { Suspense } from 'react';

function Model({ frame, duration }) {
  const { scene } = useGLTF('${modelUrl}');

  // Animation based on type
  const rotation = React.useMemo(() => {
    ${animation.type === 'rotate' ? `
    return {
      y: interpolate(frame, [0, duration], [0, Math.PI * 2]),
    };
    ` : animation.type === 'orbit' ? `
    const angle = interpolate(frame, [0, duration], [0, Math.PI * 2]);
    return { y: angle };
    ` : `
    // Custom keyframe animation
    const keyframes = ${JSON.stringify(animation.keyframes || [])};
    // Interpolate between keyframes...
    return { x: 0, y: 0, z: 0 };
    `}
  }, [frame, duration]);

  return (
    <primitive
      object={scene}
      rotation={[rotation.x || 0, rotation.y || 0, rotation.z || 0]}
    />
  );
}

export function Component({ frame, duration }) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      ${background?.transparent ? '' : background?.gradient
        ? `background: linear-gradient(${background.gradient.direction === 'horizontal' ? '90deg' : '180deg'}, ${background.gradient.from}, ${background.gradient.to})`
        : `backgroundColor: '${background?.color || '#000'}'`
      }
    }}>
      <Canvas
        camera={{
          position: [${camera?.position?.x ?? 0}, ${camera?.position?.y ?? 2}, ${camera?.position?.z ?? 5}],
          fov: ${camera?.fov ?? 50},
        }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <ambientLight intensity={${lighting?.ambient ?? 0.5}} />
        <directionalLight
          position={[${lighting?.directional?.position?.x ?? 5}, ${lighting?.directional?.position?.y ?? 5}, ${lighting?.directional?.position?.z ?? 5}]}
          intensity={${lighting?.directional?.intensity ?? 1}}
        />
        ${lighting?.environment ? `<Environment preset="${lighting.environment}" />` : ''}
        <Suspense fallback={null}>
          <Model frame={frame} duration={duration} />
        </Suspense>
      </Canvas>
    </div>
  );
}
`.trim();
  }

  /**
   * Generate hero animation component code
   */
  private generateHeroComponentCode(request: {
    backgroundType: string;
    colors: { primary: string; secondary: string };
    text?: { headline: string; subheadline?: string };
  }): string {
    return `
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import React from 'react';

export function Component({ frame, fps, width, height }) {
  const progress = frame / fps;

  // Animated gradient
  const gradientAngle = interpolate(frame, [0, 150], [0, 360]);

  // Text animation
  const textOpacity = spring({ frame, fps, from: 0, to: 1, durationInFrames: 30 });
  const textY = spring({ frame, fps, from: 50, to: 0, durationInFrames: 30 });

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: \`linear-gradient(\${gradientAngle}deg, ${request.colors.primary}, ${request.colors.secondary})\`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      ${request.text ? `
      <h1 style={{
        fontSize: '4rem',
        color: 'white',
        textShadow: '0 4px 20px rgba(0,0,0,0.3)',
        opacity: textOpacity,
        transform: \`translateY(\${textY}px)\`,
        margin: 0,
      }}>
        ${request.text.headline}
      </h1>
      ${request.text.subheadline ? `
      <p style={{
        fontSize: '1.5rem',
        color: 'rgba(255,255,255,0.8)',
        opacity: textOpacity,
        transform: \`translateY(\${textY}px)\`,
        marginTop: '1rem',
      }}>
        ${request.text.subheadline}
      </p>
      ` : ''}
      ` : ''}
    </div>
  );
}
`.trim();
  }

  /**
   * Generate loading animation component code
   */
  private generateLoadingComponentCode(request: {
    style: string;
    color: string;
    backgroundColor?: string;
    size: number;
  }): string {
    return `
import { useCurrentFrame, interpolate } from 'remotion';
import React from 'react';

export function Component({ frame }) {
  const rotation = interpolate(frame, [0, 30], [0, 360], { extrapolateRight: 'extend' });

  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: '${request.backgroundColor || 'transparent'}',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: ${request.size},
        height: ${request.size},
        border: '4px solid transparent',
        borderTopColor: '${request.color}',
        borderRadius: '50%',
        transform: \`rotate(\${rotation}deg)\`,
      }} />
    </div>
  );
}
`.trim();
  }

  /**
   * Map codec to Remotion format
   */
  private mapCodec(codec: string, format: string): string {
    if (format === 'webm') {
      return codec === 'vp9' ? 'vp9' : 'vp8';
    }
    return codec === 'h265' ? 'h265' : 'h264';
  }

  /**
   * Execute shell command
   */
  private executeCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd: this.projectPath,
        stdio: 'pipe',
      });

      let stderr = '';

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Render using AWS Lambda (for production)
   */
  private async renderWithLambda(request: VideoRenderRequest, renderId: string): Promise<RenderedVideo> {
    // This would integrate with @remotion/lambda
    // For now, throw an error indicating it needs implementation
    throw new Error('Lambda rendering not yet implemented. Please use local rendering.');
  }
}

// ============================================================================
// Singleton
// ============================================================================

let serviceInstance: RemotionService | null = null;

export async function getRemotionService(): Promise<RemotionService> {
  if (!serviceInstance) {
    serviceInstance = new RemotionService();
    await serviceInstance.initialize();
  }
  return serviceInstance;
}

export default RemotionService;
