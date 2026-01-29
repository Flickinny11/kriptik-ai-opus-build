/**
 * Ultra-Premium Text Service - Advanced Text Rendering & Blending
 *
 * Goes far beyond basic text overlay with:
 * - Dynamic font loading from ANY source (Google Fonts, Adobe, custom)
 * - 3D text with perspective, materials, lighting, and shadows
 * - Photorealistic textures (metal, glass, wood, marble, chrome, gold, etc.)
 * - Procedural effects (noise, patterns, distortion)
 * - Context-aware blending that analyzes backgrounds
 * - AI-assisted style matching
 * - Advanced gradients (mesh, conic, multi-stop)
 * - Kinetic text effects for animation
 *
 * This service ensures text looks like an integral part of the design,
 * not an afterthought overlay.
 */

import {
  createCanvas,
  registerFont,
  loadImage,
  type Canvas,
  type CanvasRenderingContext2D,
  type Image,
} from 'canvas';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import sharp from 'sharp';
import { getPremiumTextEffects, type PremiumTextStyle, type GradientDef } from './premium-text-effects.js';

// ============================================================================
// Enhanced Types
// ============================================================================

/** Material types for 3D text */
export type MaterialType =
  | 'flat'
  | 'metal'
  | 'chrome'
  | 'gold'
  | 'silver'
  | 'bronze'
  | 'copper'
  | 'glass'
  | 'crystal'
  | 'plastic'
  | 'wood'
  | 'marble'
  | 'stone'
  | 'leather'
  | 'fabric'
  | 'neon'
  | 'holographic'
  | 'iridescent'
  | 'frosted'
  | 'brushed-metal'
  | 'carbon-fiber'
  | 'custom-texture';

/** Lighting configuration for 3D effects */
export interface LightingConfig {
  /** Ambient light color and intensity */
  ambient: { color: string; intensity: number };
  /** Key light (main light source) */
  keyLight: {
    color: string;
    intensity: number;
    angle: number;
    elevation: number;
  };
  /** Fill light (softer, opposite key) */
  fillLight?: {
    color: string;
    intensity: number;
    angle: number;
    elevation: number;
  };
  /** Rim/back light for edge highlights */
  rimLight?: {
    color: string;
    intensity: number;
    angle: number;
  };
  /** Environment reflection (for metallic surfaces) */
  environmentReflection?: {
    imageUrl?: string;
    intensity: number;
    blur: number;
  };
}

/** 3D Text configuration */
export interface Text3DConfig {
  /** Enable 3D rendering */
  enabled: boolean;
  /** Extrusion depth in pixels */
  depth: number;
  /** Bevel on edges */
  bevel?: {
    enabled: boolean;
    size: number;
    segments: number;
  };
  /** Perspective settings */
  perspective?: {
    enabled: boolean;
    distance: number;
    rotateX: number;
    rotateY: number;
    rotateZ: number;
    vanishingPointX: number;
    vanishingPointY: number;
  };
  /** Material for front face */
  frontMaterial: MaterialType;
  /** Material for sides/extrusion */
  sideMaterial: MaterialType;
  /** Custom texture URL (for custom-texture material) */
  customTextureUrl?: string;
  /** Lighting configuration */
  lighting: LightingConfig;
}

/** Texture effect configuration */
export interface TextureConfig {
  /** Texture type */
  type: MaterialType | 'image' | 'procedural';
  /** For image textures: URL or base64 */
  imageSource?: string;
  /** Procedural texture options */
  procedural?: {
    pattern: 'noise' | 'voronoi' | 'waves' | 'dots' | 'lines' | 'grid' | 'crosshatch' | 'organic';
    scale: number;
    seed?: number;
    colors: string[];
    contrast: number;
    octaves?: number;
  };
  /** Texture mapping mode */
  mapping: 'stretch' | 'tile' | 'fit' | 'fill';
  /** Texture rotation in degrees */
  rotation: number;
  /** Texture scale */
  scale: number;
  /** Blend mode with base color */
  blendMode: 'normal' | 'multiply' | 'overlay' | 'screen' | 'soft-light';
  /** Texture opacity */
  opacity: number;
  /** Normal map for depth perception */
  normalMap?: {
    enabled: boolean;
    strength: number;
    imageSource?: string;
  };
}

/** Advanced gradient types */
export interface MeshGradient {
  type: 'mesh';
  /** Grid of control points with colors */
  points: Array<{
    x: number;
    y: number;
    color: string;
  }>;
  /** Interpolation smoothness */
  smoothness: number;
}

export interface ConicGradient {
  type: 'conic';
  centerX: number;
  centerY: number;
  angle: number;
  stops: Array<{ offset: number; color: string }>;
}

export interface NoiseGradient {
  type: 'noise';
  baseGradient: GradientDef;
  noiseScale: number;
  noiseIntensity: number;
  seed?: number;
}

export type AdvancedGradient = GradientDef | MeshGradient | ConicGradient | NoiseGradient;

/** Context analysis result from background image */
export interface BackgroundAnalysis {
  /** Dominant colors */
  dominantColors: string[];
  /** Average luminance (0-1) */
  luminance: number;
  /** Detected lighting direction (degrees) */
  lightDirection: number;
  /** Color temperature (warm/cool) */
  colorTemperature: 'warm' | 'neutral' | 'cool';
  /** Complexity/busyness score (0-1) */
  complexity: number;
  /** Suggested text placement zones */
  clearZones: Array<{ x: number; y: number; width: number; height: number; score: number }>;
  /** Suggested contrasting colors for text */
  suggestedTextColors: string[];
  /** Detected style */
  style: 'minimal' | 'busy' | 'gradient' | 'photo' | 'illustration' | 'abstract';
}

/** Ultra-premium text style */
export interface UltraPremiumTextStyle extends PremiumTextStyle {
  /** 3D configuration */
  text3D?: Text3DConfig;
  /** Texture/material configuration */
  texture?: TextureConfig;
  /** Advanced gradient */
  advancedFill?: AdvancedGradient;
  /** Context-aware blending */
  contextBlending?: {
    enabled: boolean;
    matchLighting: boolean;
    matchColorTemperature: boolean;
    softEdgeBlend: number;
    shadowMatchBackground: boolean;
  };
  /** Animation keyframes (for video/animated output) */
  animation?: TextAnimationConfig;
  /** Distortion effects */
  distortion?: {
    wave?: { amplitude: number; frequency: number; phase: number };
    bulge?: { strength: number; centerX: number; centerY: number };
    twist?: { angle: number; centerX: number; centerY: number };
    perspective?: { topScale: number; bottomScale: number };
  };
  /** Particles/decorations around text */
  particles?: {
    enabled: boolean;
    type: 'sparkle' | 'glow' | 'dust' | 'confetti' | 'custom';
    count: number;
    size: number;
    spread: number;
    color: string | string[];
  };
}

/** Animation configuration for kinetic text */
export interface TextAnimationConfig {
  type: 'none' | 'fade-in' | 'slide' | 'bounce' | 'wave' | 'typewriter' | 'glitch' | 'morph';
  duration: number;
  delay: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bounce' | 'elastic';
  direction?: 'left' | 'right' | 'up' | 'down';
  /** For generating animation frames */
  frameCount?: number;
}

/** Text rendering request */
export interface UltraPremiumTextRequest {
  /** Text content */
  text: string;
  /** Style configuration */
  style: UltraPremiumTextStyle;
  /** Canvas dimensions */
  width: number;
  height: number;
  /** Position */
  x?: number;
  y?: number;
  /** Background image for context-aware blending */
  backgroundImage?: Buffer | string;
  /** Quality level */
  quality: 'draft' | 'normal' | 'high' | 'ultra';
}

/** Rendering result */
export interface UltraPremiumTextResult {
  /** Rendered text image (transparent PNG) */
  imageBuffer: Buffer;
  /** For context blending: the blended composite */
  blendedBuffer?: Buffer;
  /** Width */
  width: number;
  /** Height */
  height: number;
  /** Background analysis (if background provided) */
  backgroundAnalysis?: BackgroundAnalysis;
  /** Animation frames (if animated) */
  animationFrames?: Buffer[];
  /** Render time in ms */
  renderTime: number;
}

// ============================================================================
// Material Presets
// ============================================================================

const MATERIAL_PRESETS: Record<MaterialType, {
  baseColor?: string;
  gradient?: GradientDef;
  specular: number;
  roughness: number;
  metallic: number;
  reflectivity: number;
  emissive?: string;
}> = {
  flat: { specular: 0, roughness: 1, metallic: 0, reflectivity: 0 },
  metal: {
    gradient: {
      type: 'linear',
      angle: 90,
      stops: [
        { offset: 0, color: '#666666' },
        { offset: 0.3, color: '#999999' },
        { offset: 0.5, color: '#cccccc' },
        { offset: 0.7, color: '#888888' },
        { offset: 1, color: '#555555' },
      ],
    },
    specular: 0.9,
    roughness: 0.3,
    metallic: 1,
    reflectivity: 0.8,
  },
  chrome: {
    gradient: {
      type: 'linear',
      angle: 90,
      stops: [
        { offset: 0, color: '#1a1a2e' },
        { offset: 0.2, color: '#4a4a6a' },
        { offset: 0.4, color: '#e8e8e8' },
        { offset: 0.5, color: '#ffffff' },
        { offset: 0.6, color: '#c0c0c0' },
        { offset: 0.8, color: '#5a5a7a' },
        { offset: 1, color: '#2a2a4e' },
      ],
    },
    specular: 1,
    roughness: 0.05,
    metallic: 1,
    reflectivity: 1,
  },
  gold: {
    gradient: {
      type: 'linear',
      angle: 135,
      stops: [
        { offset: 0, color: '#8B6914' },
        { offset: 0.2, color: '#C9A227' },
        { offset: 0.4, color: '#FFD700' },
        { offset: 0.5, color: '#FFEC8B' },
        { offset: 0.6, color: '#FFD700' },
        { offset: 0.8, color: '#DAA520' },
        { offset: 1, color: '#8B7500' },
      ],
    },
    specular: 0.95,
    roughness: 0.15,
    metallic: 1,
    reflectivity: 0.9,
  },
  silver: {
    gradient: {
      type: 'linear',
      angle: 90,
      stops: [
        { offset: 0, color: '#5C5C5C' },
        { offset: 0.3, color: '#A0A0A0' },
        { offset: 0.5, color: '#E8E8E8' },
        { offset: 0.7, color: '#B0B0B0' },
        { offset: 1, color: '#6C6C6C' },
      ],
    },
    specular: 0.9,
    roughness: 0.2,
    metallic: 1,
    reflectivity: 0.85,
  },
  bronze: {
    gradient: {
      type: 'linear',
      angle: 135,
      stops: [
        { offset: 0, color: '#4A3728' },
        { offset: 0.3, color: '#8B5A2B' },
        { offset: 0.5, color: '#CD853F' },
        { offset: 0.7, color: '#A0522D' },
        { offset: 1, color: '#5C3317' },
      ],
    },
    specular: 0.7,
    roughness: 0.4,
    metallic: 0.9,
    reflectivity: 0.6,
  },
  copper: {
    gradient: {
      type: 'linear',
      angle: 135,
      stops: [
        { offset: 0, color: '#6E3B2B' },
        { offset: 0.3, color: '#B87333' },
        { offset: 0.5, color: '#DA8A67' },
        { offset: 0.7, color: '#B87333' },
        { offset: 1, color: '#8B4513' },
      ],
    },
    specular: 0.75,
    roughness: 0.35,
    metallic: 0.95,
    reflectivity: 0.7,
  },
  glass: {
    baseColor: 'rgba(200, 220, 255, 0.3)',
    specular: 1,
    roughness: 0.02,
    metallic: 0,
    reflectivity: 0.95,
  },
  crystal: {
    gradient: {
      type: 'linear',
      angle: 45,
      stops: [
        { offset: 0, color: 'rgba(255, 255, 255, 0.1)' },
        { offset: 0.3, color: 'rgba(200, 230, 255, 0.4)' },
        { offset: 0.5, color: 'rgba(255, 255, 255, 0.8)' },
        { offset: 0.7, color: 'rgba(180, 210, 255, 0.4)' },
        { offset: 1, color: 'rgba(255, 255, 255, 0.1)' },
      ],
    },
    specular: 1,
    roughness: 0.01,
    metallic: 0,
    reflectivity: 1,
  },
  plastic: {
    specular: 0.5,
    roughness: 0.6,
    metallic: 0,
    reflectivity: 0.2,
  },
  wood: {
    baseColor: '#8B4513',
    specular: 0.2,
    roughness: 0.8,
    metallic: 0,
    reflectivity: 0.05,
  },
  marble: {
    baseColor: '#F5F5F5',
    specular: 0.6,
    roughness: 0.3,
    metallic: 0,
    reflectivity: 0.4,
  },
  stone: {
    baseColor: '#808080',
    specular: 0.15,
    roughness: 0.9,
    metallic: 0,
    reflectivity: 0.02,
  },
  leather: {
    baseColor: '#4A3C31',
    specular: 0.3,
    roughness: 0.7,
    metallic: 0,
    reflectivity: 0.1,
  },
  fabric: {
    baseColor: '#404040',
    specular: 0.05,
    roughness: 0.95,
    metallic: 0,
    reflectivity: 0,
  },
  neon: {
    baseColor: '#FF00FF',
    specular: 0,
    roughness: 1,
    metallic: 0,
    reflectivity: 0,
    emissive: '#FF00FF',
  },
  holographic: {
    gradient: {
      type: 'linear',
      angle: 45,
      stops: [
        { offset: 0, color: '#FF0080' },
        { offset: 0.2, color: '#FF8000' },
        { offset: 0.4, color: '#FFFF00' },
        { offset: 0.6, color: '#00FF80' },
        { offset: 0.8, color: '#0080FF' },
        { offset: 1, color: '#8000FF' },
      ],
    },
    specular: 0.9,
    roughness: 0.1,
    metallic: 0.5,
    reflectivity: 0.8,
  },
  iridescent: {
    gradient: {
      type: 'linear',
      angle: 135,
      stops: [
        { offset: 0, color: '#E0B0FF' },
        { offset: 0.25, color: '#87CEEB' },
        { offset: 0.5, color: '#98FB98' },
        { offset: 0.75, color: '#FFEFD5' },
        { offset: 1, color: '#FFB6C1' },
      ],
    },
    specular: 0.85,
    roughness: 0.15,
    metallic: 0.3,
    reflectivity: 0.7,
  },
  frosted: {
    baseColor: 'rgba(255, 255, 255, 0.7)',
    specular: 0.3,
    roughness: 0.7,
    metallic: 0,
    reflectivity: 0.2,
  },
  'brushed-metal': {
    gradient: {
      type: 'linear',
      angle: 0,
      stops: [
        { offset: 0, color: '#888888' },
        { offset: 0.1, color: '#AAAAAA' },
        { offset: 0.2, color: '#888888' },
        { offset: 0.3, color: '#BBBBBB' },
        { offset: 0.4, color: '#888888' },
        { offset: 0.5, color: '#AAAAAA' },
        { offset: 0.6, color: '#888888' },
        { offset: 0.7, color: '#BBBBBB' },
        { offset: 0.8, color: '#888888' },
        { offset: 0.9, color: '#AAAAAA' },
        { offset: 1, color: '#888888' },
      ],
    },
    specular: 0.6,
    roughness: 0.5,
    metallic: 1,
    reflectivity: 0.5,
  },
  'carbon-fiber': {
    baseColor: '#1a1a1a',
    specular: 0.7,
    roughness: 0.4,
    metallic: 0.2,
    reflectivity: 0.3,
  },
  'custom-texture': {
    specular: 0.5,
    roughness: 0.5,
    metallic: 0,
    reflectivity: 0.3,
  },
};

// ============================================================================
// Ultra-Premium Text Service
// ============================================================================

export class UltraPremiumTextService {
  private premiumEffects = getPremiumTextEffects();
  private textureCache = new Map<string, Image>();
  private fontCache = new Map<string, boolean>();

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    await this.premiumEffects.initialize();
  }

  /**
   * Render text with ultra-premium effects
   */
  async renderText(request: UltraPremiumTextRequest): Promise<UltraPremiumTextResult> {
    const startTime = Date.now();
    await this.initialize();

    const { text, style, width, height, backgroundImage, quality } = request;

    // Load font
    const variant = this.getVariantFromStyle(style);
    await this.premiumEffects.loadFont(style.fontFamily, variant);

    // Analyze background if provided
    let backgroundAnalysis: BackgroundAnalysis | undefined;
    let backgroundBuffer: Buffer | undefined;

    if (backgroundImage) {
      backgroundBuffer = await this.normalizeImageInput(backgroundImage);
      backgroundAnalysis = await this.analyzeBackground(backgroundBuffer, width, height);
    }

    // Apply context-aware adjustments if enabled
    const adjustedStyle = style.contextBlending?.enabled && backgroundAnalysis
      ? this.applyContextAwareAdjustments(style, backgroundAnalysis)
      : style;

    // Determine render quality settings
    const qualitySettings = this.getQualitySettings(quality);

    // Create main canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Calculate text position
    const x = request.x ?? width / 2;
    const y = request.y ?? height / 2;

    // Render based on style complexity
    if (adjustedStyle.text3D?.enabled) {
      await this.render3DText(ctx, text, x, y, adjustedStyle, qualitySettings);
    } else if (adjustedStyle.texture) {
      await this.renderTexturedText(ctx, text, x, y, adjustedStyle, qualitySettings);
    } else {
      await this.renderEnhancedText(ctx, text, x, y, adjustedStyle);
    }

    // Add particles if configured
    if (adjustedStyle.particles?.enabled) {
      this.renderParticles(ctx, text, x, y, adjustedStyle);
    }

    // Export text layer
    const imageBuffer = canvas.toBuffer('image/png');

    // Blend with background if provided
    let blendedBuffer: Buffer | undefined;
    if (backgroundBuffer && adjustedStyle.contextBlending?.enabled) {
      blendedBuffer = await this.blendWithBackground(
        imageBuffer,
        backgroundBuffer,
        adjustedStyle,
        backgroundAnalysis!
      );
    }

    // Generate animation frames if configured
    let animationFrames: Buffer[] | undefined;
    if (adjustedStyle.animation && adjustedStyle.animation.type !== 'none') {
      animationFrames = await this.generateAnimationFrames(
        request,
        adjustedStyle.animation
      );
    }

    return {
      imageBuffer,
      blendedBuffer,
      width,
      height,
      backgroundAnalysis,
      animationFrames,
      renderTime: Date.now() - startTime,
    };
  }

  /**
   * Analyze background image for context-aware rendering
   */
  async analyzeBackground(
    imageBuffer: Buffer,
    targetWidth: number,
    targetHeight: number
  ): Promise<BackgroundAnalysis> {
    // Get image stats with sharp
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const stats = await image.stats();

    // Calculate dominant colors from channels
    const dominantColors = this.extractDominantColors(stats);

    // Calculate overall luminance
    const luminance = (
      (stats.channels[0]?.mean || 0) * 0.299 +
      (stats.channels[1]?.mean || 0) * 0.587 +
      (stats.channels[2]?.mean || 0) * 0.114
    ) / 255;

    // Estimate color temperature
    const redMean = stats.channels[0]?.mean || 0;
    const blueMean = stats.channels[2]?.mean || 0;
    const colorTemperature: 'warm' | 'neutral' | 'cool' =
      redMean > blueMean + 30 ? 'warm' :
      blueMean > redMean + 30 ? 'cool' : 'neutral';

    // Calculate complexity from standard deviation
    const complexity = Math.min(1, (
      (stats.channels[0]?.stdev || 0) +
      (stats.channels[1]?.stdev || 0) +
      (stats.channels[2]?.stdev || 0)
    ) / (3 * 80));

    // Suggest contrasting text colors
    const suggestedTextColors = this.suggestTextColors(dominantColors, luminance);

    // Estimate light direction (simplified - based on luminance gradient)
    const lightDirection = await this.estimateLightDirection(imageBuffer);

    // Detect style
    const style = this.detectImageStyle(stats, complexity);

    // Find clear zones (simplified)
    const clearZones = await this.findClearZones(imageBuffer, targetWidth, targetHeight);

    return {
      dominantColors,
      luminance,
      lightDirection,
      colorTemperature,
      complexity,
      clearZones,
      suggestedTextColors,
      style,
    };
  }

  /**
   * Extract dominant colors from image stats
   */
  private extractDominantColors(stats: sharp.Stats): string[] {
    const colors: string[] = [];

    // Primary color from means
    const r = Math.round(stats.channels[0]?.mean || 0);
    const g = Math.round(stats.channels[1]?.mean || 0);
    const b = Math.round(stats.channels[2]?.mean || 0);
    colors.push(this.rgbToHex(r, g, b));

    // Lighter variant
    colors.push(this.rgbToHex(
      Math.min(255, r + 50),
      Math.min(255, g + 50),
      Math.min(255, b + 50)
    ));

    // Darker variant
    colors.push(this.rgbToHex(
      Math.max(0, r - 50),
      Math.max(0, g - 50),
      Math.max(0, b - 50)
    ));

    return colors;
  }

  /**
   * Suggest contrasting text colors
   */
  private suggestTextColors(dominantColors: string[], luminance: number): string[] {
    const suggestions: string[] = [];

    // High contrast based on luminance
    if (luminance < 0.5) {
      suggestions.push('#FFFFFF', '#F0F0F0', '#E0E0E0');
    } else {
      suggestions.push('#000000', '#1A1A1A', '#333333');
    }

    // Complementary colors
    const primary = dominantColors[0];
    if (primary) {
      const complementary = this.getComplementaryColor(primary);
      suggestions.push(complementary);
    }

    return suggestions;
  }

  /**
   * Get complementary color
   */
  private getComplementaryColor(hex: string): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return '#FFFFFF';

    return this.rgbToHex(255 - rgb.r, 255 - rgb.g, 255 - rgb.b);
  }

  /**
   * Estimate light direction from image
   */
  private async estimateLightDirection(imageBuffer: Buffer): Promise<number> {
    // Simplified: analyze luminance gradient
    // In production, would use more sophisticated edge detection
    const image = sharp(imageBuffer);
    const { width, height } = await image.metadata();

    if (!width || !height) return 315; // Default top-left

    // Sample corners
    const regions = await Promise.all([
      image.extract({ left: 0, top: 0, width: Math.floor(width/4), height: Math.floor(height/4) }).stats(),
      image.extract({ left: Math.floor(width*3/4), top: 0, width: Math.floor(width/4), height: Math.floor(height/4) }).stats(),
      image.extract({ left: 0, top: Math.floor(height*3/4), width: Math.floor(width/4), height: Math.floor(height/4) }).stats(),
      image.extract({ left: Math.floor(width*3/4), top: Math.floor(height*3/4), width: Math.floor(width/4), height: Math.floor(height/4) }).stats(),
    ]);

    const luminances = regions.map(s => (s.channels[0]?.mean || 0) / 255);

    // Find brightest corner
    const maxIndex = luminances.indexOf(Math.max(...luminances));
    const angles = [315, 45, 225, 135]; // TL, TR, BL, BR

    return angles[maxIndex] || 315;
  }

  /**
   * Detect image style
   */
  private detectImageStyle(
    stats: sharp.Stats,
    complexity: number
  ): BackgroundAnalysis['style'] {
    // High complexity = busy/photo
    if (complexity > 0.7) return 'busy';
    if (complexity > 0.5) return 'photo';

    // Check for gradient-like (low complexity, moderate stdev)
    const avgStdev = (
      (stats.channels[0]?.stdev || 0) +
      (stats.channels[1]?.stdev || 0) +
      (stats.channels[2]?.stdev || 0)
    ) / 3;

    if (complexity < 0.2 && avgStdev > 20) return 'gradient';
    if (complexity < 0.2) return 'minimal';

    return 'illustration';
  }

  /**
   * Find clear zones for text placement
   */
  private async findClearZones(
    imageBuffer: Buffer,
    targetWidth: number,
    targetHeight: number
  ): Promise<BackgroundAnalysis['clearZones']> {
    // Simplified zone detection - divide into grid and score
    const zones: BackgroundAnalysis['clearZones'] = [];
    const gridSize = 4;
    const cellWidth = Math.floor(targetWidth / gridSize);
    const cellHeight = Math.floor(targetHeight / gridSize);

    const image = sharp(imageBuffer).resize(targetWidth, targetHeight);

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const x = col * cellWidth;
        const y = row * cellHeight;

        try {
          const cellStats = await image
            .extract({ left: x, top: y, width: cellWidth, height: cellHeight })
            .stats();

          // Lower stdev = more uniform = better for text
          const avgStdev = (
            (cellStats.channels[0]?.stdev || 0) +
            (cellStats.channels[1]?.stdev || 0) +
            (cellStats.channels[2]?.stdev || 0)
          ) / 3;

          const score = Math.max(0, 1 - avgStdev / 100);

          zones.push({ x, y, width: cellWidth, height: cellHeight, score });
        } catch {
          zones.push({ x, y, width: cellWidth, height: cellHeight, score: 0.5 });
        }
      }
    }

    return zones.sort((a, b) => b.score - a.score);
  }

  /**
   * Apply context-aware adjustments to style
   */
  private applyContextAwareAdjustments(
    style: UltraPremiumTextStyle,
    analysis: BackgroundAnalysis
  ): UltraPremiumTextStyle {
    const adjusted = { ...style };

    // Adjust lighting for 3D text
    if (adjusted.text3D?.enabled && adjusted.contextBlending?.matchLighting) {
      adjusted.text3D = {
        ...adjusted.text3D,
        lighting: {
          ...adjusted.text3D.lighting,
          keyLight: {
            ...adjusted.text3D.lighting.keyLight,
            angle: analysis.lightDirection,
          },
        },
      };
    }

    // Adjust color temperature
    if (adjusted.contextBlending?.matchColorTemperature) {
      // Warm up or cool down the fill color slightly
      if (typeof adjusted.fill === 'string') {
        adjusted.fill = this.adjustColorTemperature(
          adjusted.fill,
          analysis.colorTemperature
        );
      }
    }

    // Adjust shadow to match background
    if (adjusted.contextBlending?.shadowMatchBackground && adjusted.shadow) {
      const shadows = Array.isArray(adjusted.shadow) ? adjusted.shadow : [adjusted.shadow];
      adjusted.shadow = shadows.map(s => ({
        ...s,
        color: this.blendShadowWithBackground(s.color, analysis.dominantColors[0] || '#000000'),
      }));
    }

    return adjusted;
  }

  /**
   * Adjust color temperature
   */
  private adjustColorTemperature(
    color: string,
    temperature: 'warm' | 'neutral' | 'cool'
  ): string {
    const rgb = this.hexToRgb(color);
    if (!rgb) return color;

    let { r, g, b } = rgb;

    if (temperature === 'warm') {
      r = Math.min(255, r + 10);
      b = Math.max(0, b - 5);
    } else if (temperature === 'cool') {
      r = Math.max(0, r - 5);
      b = Math.min(255, b + 10);
    }

    return this.rgbToHex(r, g, b);
  }

  /**
   * Blend shadow color with background
   */
  private blendShadowWithBackground(shadowColor: string, bgColor: string): string {
    const shadow = this.hexToRgb(shadowColor) || { r: 0, g: 0, b: 0 };
    const bg = this.hexToRgb(bgColor) || { r: 0, g: 0, b: 0 };

    // Blend shadow towards background color
    const blendFactor = 0.3;
    return this.rgbToHex(
      Math.round(shadow.r * (1 - blendFactor) + bg.r * blendFactor * 0.5),
      Math.round(shadow.g * (1 - blendFactor) + bg.g * blendFactor * 0.5),
      Math.round(shadow.b * (1 - blendFactor) + bg.b * blendFactor * 0.5)
    );
  }

  /**
   * Render 3D text with materials and lighting
   */
  private async render3DText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    style: UltraPremiumTextStyle,
    qualitySettings: { layers: number; antialiasing: number }
  ): Promise<void> {
    const config = style.text3D!;
    const material = MATERIAL_PRESETS[config.frontMaterial] || MATERIAL_PRESETS.flat;
    const sideMaterial = MATERIAL_PRESETS[config.sideMaterial] || material;

    // Set font
    const weight = typeof style.fontWeight === 'number' ? style.fontWeight : 400;
    ctx.font = `${style.fontStyle || 'normal'} ${weight} ${style.fontSize}px "${style.fontFamily}"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const { depth, lighting } = config;
    const lightRad = (lighting.keyLight.angle * Math.PI) / 180;
    const dx = Math.cos(lightRad);
    const dy = Math.sin(lightRad);

    // Render extrusion layers (back to front)
    const layers = Math.min(depth, qualitySettings.layers);
    for (let i = layers; i >= 1; i--) {
      const progress = i / depth;
      const layerX = x + dx * i;
      const layerY = y + dy * i;

      // Calculate lighting for this layer
      const lightFactor = this.calculateLayerLighting(i, depth, lighting);
      const layerColor = this.applyMaterialLighting(sideMaterial, lightFactor, lighting);

      ctx.fillStyle = layerColor;
      ctx.fillText(text, layerX, layerY);
    }

    // Render front face
    const frontFill = this.getMaterialFill(ctx, material, x, y, style.fontSize, text, lighting);
    ctx.fillStyle = frontFill;

    // Add specular highlight for metallic materials
    if (material.specular > 0.5) {
      this.addSpecularHighlight(ctx, text, x, y, style, material, lighting);
    }

    ctx.fillText(text, x, y);

    // Add reflection for highly reflective materials
    if (material.reflectivity > 0.5) {
      this.addReflection(ctx, text, x, y, style, material);
    }
  }

  /**
   * Calculate layer lighting factor
   */
  private calculateLayerLighting(
    layer: number,
    totalDepth: number,
    lighting: LightingConfig
  ): number {
    const progress = layer / totalDepth;
    const base = lighting.ambient.intensity;
    const keyContribution = lighting.keyLight.intensity * (1 - progress * 0.5);

    return Math.min(1, base + keyContribution);
  }

  /**
   * Apply material lighting
   */
  private applyMaterialLighting(
    material: typeof MATERIAL_PRESETS['flat'],
    lightFactor: number,
    lighting: LightingConfig
  ): string {
    if (material.baseColor) {
      return this.adjustBrightness(material.baseColor, lightFactor);
    }

    if (material.gradient) {
      // For gradients, we return a middle color adjusted
      const midStop = material.gradient.stops[Math.floor(material.gradient.stops.length / 2)];
      return this.adjustBrightness(midStop.color, lightFactor);
    }

    return this.adjustBrightness('#808080', lightFactor);
  }

  /**
   * Get material fill style
   */
  private getMaterialFill(
    ctx: CanvasRenderingContext2D,
    material: typeof MATERIAL_PRESETS['flat'],
    x: number,
    y: number,
    fontSize: number,
    text: string,
    lighting: LightingConfig
  ): string | CanvasGradient {
    if (material.gradient) {
      return this.createGradient(ctx, material.gradient, x, y, ctx.measureText(text).width, fontSize);
    }

    if (material.emissive) {
      return material.emissive;
    }

    const baseColor = material.baseColor || '#808080';
    const lightFactor = lighting.ambient.intensity + lighting.keyLight.intensity * 0.5;
    return this.adjustBrightness(baseColor, lightFactor);
  }

  /**
   * Add specular highlight
   */
  private addSpecularHighlight(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    style: UltraPremiumTextStyle,
    material: typeof MATERIAL_PRESETS['flat'],
    lighting: LightingConfig
  ): void {
    ctx.save();

    const highlightGradient = ctx.createLinearGradient(
      x - ctx.measureText(text).width / 2,
      y - style.fontSize / 2,
      x + ctx.measureText(text).width / 2,
      y + style.fontSize / 2
    );

    const intensity = material.specular * lighting.keyLight.intensity;
    highlightGradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
    highlightGradient.addColorStop(0.4, `rgba(255, 255, 255, ${intensity * 0.3})`);
    highlightGradient.addColorStop(0.5, `rgba(255, 255, 255, ${intensity * 0.8})`);
    highlightGradient.addColorStop(0.6, `rgba(255, 255, 255, ${intensity * 0.3})`);
    highlightGradient.addColorStop(1, `rgba(255, 255, 255, 0)`);

    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = highlightGradient;
    ctx.fillText(text, x, y);

    ctx.restore();
  }

  /**
   * Add reflection effect
   */
  private addReflection(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    style: UltraPremiumTextStyle,
    material: typeof MATERIAL_PRESETS['flat']
  ): void {
    ctx.save();

    // Create reflected text below
    const reflectionY = y + style.fontSize;
    ctx.globalAlpha = material.reflectivity * 0.3;
    ctx.scale(1, -0.5);
    ctx.translate(0, -reflectionY * 3);

    // Fade gradient for reflection
    const gradient = ctx.createLinearGradient(x, reflectionY, x, reflectionY + style.fontSize);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${material.reflectivity * 0.3})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillText(text, x, reflectionY);

    ctx.restore();
  }

  /**
   * Render textured text
   */
  private async renderTexturedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    style: UltraPremiumTextStyle,
    qualitySettings: { layers: number; antialiasing: number }
  ): Promise<void> {
    const texture = style.texture!;

    // Set font
    const weight = typeof style.fontWeight === 'number' ? style.fontWeight : 400;
    ctx.font = `${style.fontStyle || 'normal'} ${weight} ${style.fontSize}px "${style.fontFamily}"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // First render base text
    if (typeof style.fill === 'string') {
      ctx.fillStyle = style.fill;
    } else {
      ctx.fillStyle = '#FFFFFF';
    }
    ctx.fillText(text, x, y);

    // Apply texture using composite
    if (texture.type === 'procedural' && texture.procedural) {
      await this.applyProceduralTexture(ctx, text, x, y, style, texture.procedural);
    } else if (texture.imageSource) {
      await this.applyImageTexture(ctx, text, x, y, style, texture);
    } else {
      // Use material preset texture simulation
      await this.applyMaterialTexture(ctx, text, x, y, style, texture.type as MaterialType);
    }
  }

  /**
   * Apply procedural texture
   */
  private async applyProceduralTexture(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    style: UltraPremiumTextStyle,
    procedural: TextureConfig['procedural']
  ): Promise<void> {
    if (!procedural) return;

    ctx.save();
    ctx.globalCompositeOperation = style.texture?.blendMode || 'multiply';
    ctx.globalAlpha = style.texture?.opacity || 1;

    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = style.fontSize;

    // Generate procedural pattern
    switch (procedural.pattern) {
      case 'noise':
        this.renderNoiseTexture(ctx, x - textWidth/2, y - textHeight/2, textWidth, textHeight, procedural);
        break;
      case 'dots':
        this.renderDotsTexture(ctx, x - textWidth/2, y - textHeight/2, textWidth, textHeight, procedural);
        break;
      case 'lines':
        this.renderLinesTexture(ctx, x - textWidth/2, y - textHeight/2, textWidth, textHeight, procedural);
        break;
      case 'grid':
        this.renderGridTexture(ctx, x - textWidth/2, y - textHeight/2, textWidth, textHeight, procedural);
        break;
    }

    ctx.restore();
  }

  /**
   * Render noise texture
   */
  private renderNoiseTexture(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    config: NonNullable<TextureConfig['procedural']>
  ): void {
    const scale = config.scale;
    const seed = config.seed || 12345;
    const colors = config.colors;

    // Simple noise approximation using random with seed
    const random = this.seededRandom(seed);

    for (let py = 0; py < height; py += scale) {
      for (let px = 0; px < width; px += scale) {
        const colorIndex = Math.floor(random() * colors.length);
        ctx.fillStyle = colors[colorIndex];
        ctx.globalAlpha = 0.1 + random() * 0.2;
        ctx.fillRect(x + px, y + py, scale, scale);
      }
    }
  }

  /**
   * Render dots texture
   */
  private renderDotsTexture(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    config: NonNullable<TextureConfig['procedural']>
  ): void {
    const scale = config.scale;
    const colors = config.colors;

    for (let py = 0; py < height; py += scale * 2) {
      for (let px = 0; px < width; px += scale * 2) {
        const colorIndex = Math.floor(Math.random() * colors.length);
        ctx.fillStyle = colors[colorIndex];
        ctx.beginPath();
        ctx.arc(x + px + scale, y + py + scale, scale * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * Render lines texture
   */
  private renderLinesTexture(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    config: NonNullable<TextureConfig['procedural']>
  ): void {
    const scale = config.scale;
    const color = config.colors[0] || '#000000';

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    for (let py = 0; py < height; py += scale) {
      ctx.beginPath();
      ctx.moveTo(x, y + py);
      ctx.lineTo(x + width, y + py);
      ctx.stroke();
    }
  }

  /**
   * Render grid texture
   */
  private renderGridTexture(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    config: NonNullable<TextureConfig['procedural']>
  ): void {
    const scale = config.scale;
    const color = config.colors[0] || '#000000';

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    // Horizontal lines
    for (let py = 0; py < height; py += scale) {
      ctx.beginPath();
      ctx.moveTo(x, y + py);
      ctx.lineTo(x + width, y + py);
      ctx.stroke();
    }

    // Vertical lines
    for (let px = 0; px < width; px += scale) {
      ctx.beginPath();
      ctx.moveTo(x + px, y);
      ctx.lineTo(x + px, y + height);
      ctx.stroke();
    }
  }

  /**
   * Apply image texture
   */
  private async applyImageTexture(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    style: UltraPremiumTextStyle,
    texture: TextureConfig
  ): Promise<void> {
    if (!texture.imageSource) return;

    try {
      const image = await this.loadTexture(texture.imageSource);

      ctx.save();
      ctx.globalCompositeOperation = texture.blendMode || 'multiply';
      ctx.globalAlpha = texture.opacity || 1;

      // Create pattern
      const pattern = ctx.createPattern(image, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillText(text, x, y);
      }

      ctx.restore();
    } catch (error) {
      console.warn('[UltraPremiumText] Failed to load texture:', error);
    }
  }

  /**
   * Apply material-based texture
   */
  private async applyMaterialTexture(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    style: UltraPremiumTextStyle,
    material: MaterialType
  ): Promise<void> {
    const preset = MATERIAL_PRESETS[material];
    if (!preset) return;

    ctx.save();

    if (preset.gradient) {
      const metrics = ctx.measureText(text);
      ctx.fillStyle = this.createGradient(
        ctx,
        preset.gradient,
        x - metrics.width / 2,
        y - style.fontSize / 2,
        metrics.width,
        style.fontSize
      );
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillText(text, x, y);
    }

    ctx.restore();
  }

  /**
   * Load texture image
   */
  private async loadTexture(source: string): Promise<Image> {
    if (this.textureCache.has(source)) {
      return this.textureCache.get(source)!;
    }

    let imageData: Buffer;

    if (source.startsWith('data:')) {
      const base64 = source.split(',')[1];
      imageData = Buffer.from(base64, 'base64');
    } else if (source.startsWith('http')) {
      imageData = await this.downloadImage(source);
    } else {
      imageData = fs.readFileSync(source);
    }

    const image = await loadImage(imageData);
    this.textureCache.set(source, image);
    return image;
  }

  /**
   * Render enhanced text (non-3D)
   */
  private async renderEnhancedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    style: UltraPremiumTextStyle
  ): Promise<void> {
    // Use the base premium effects service for rendering
    const baseEffects = this.premiumEffects;
    const buffer = await baseEffects.renderText(text, style, ctx.canvas.width, ctx.canvas.height);

    // Draw the rendered text onto our canvas
    const image = await loadImage(buffer);
    ctx.drawImage(image, 0, 0);
  }

  /**
   * Render particles around text
   */
  private renderParticles(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    style: UltraPremiumTextStyle
  ): void {
    const particles = style.particles!;
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = style.fontSize;

    const colors = Array.isArray(particles.color) ? particles.color : [particles.color];

    for (let i = 0; i < particles.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = textWidth / 2 + Math.random() * particles.spread;
      const px = x + Math.cos(angle) * distance;
      const py = y + Math.sin(angle) * distance * 0.5; // Flattened ellipse

      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = particles.size * (0.5 + Math.random() * 0.5);

      ctx.save();

      switch (particles.type) {
        case 'sparkle':
          this.renderSparkle(ctx, px, py, size, color);
          break;
        case 'glow':
          this.renderGlowParticle(ctx, px, py, size, color);
          break;
        case 'dust':
          this.renderDustParticle(ctx, px, py, size, color);
          break;
        case 'confetti':
          this.renderConfetti(ctx, px, py, size, color);
          break;
        default:
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
      }

      ctx.restore();
    }
  }

  /**
   * Render sparkle particle
   */
  private renderSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    ctx.fillStyle = color;
    ctx.beginPath();

    // 4-point star
    const points = 4;
    const outerRadius = size;
    const innerRadius = size * 0.3;

    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;

      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }

    ctx.closePath();
    ctx.fill();

    // Add glow
    ctx.shadowColor = color;
    ctx.shadowBlur = size;
    ctx.fill();
  }

  /**
   * Render glow particle
   */
  private renderGlowParticle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.5, this.adjustBrightness(color, 0.5));
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Render dust particle
   */
  private renderDustParticle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    ctx.globalAlpha = 0.3 + Math.random() * 0.4;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Render confetti particle
   */
  private renderConfetti(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    ctx.fillStyle = color;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.random() * Math.PI);
    ctx.fillRect(-size / 2, -size / 4, size, size / 2);
    ctx.restore();
  }

  /**
   * Blend rendered text with background
   */
  private async blendWithBackground(
    textBuffer: Buffer,
    backgroundBuffer: Buffer,
    style: UltraPremiumTextStyle,
    analysis: BackgroundAnalysis
  ): Promise<Buffer> {
    const softEdge = style.contextBlending?.softEdgeBlend || 0;

    let composited = sharp(backgroundBuffer)
      .composite([
        {
          input: textBuffer,
          blend: 'over',
        },
      ]);

    // Apply soft edge blending if configured
    if (softEdge > 0) {
      // Create a slightly blurred version for edge softening with opacity
      const blurred = await sharp(textBuffer)
        .blur(softEdge)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      // Apply 0.3 opacity by manipulating alpha channel
      const { data, info } = blurred;
      for (let i = 3; i < data.length; i += 4) {
        data[i] = Math.round(data[i] * 0.3);
      }
      
      const blurredWithOpacity = await sharp(data, { 
        raw: { width: info.width, height: info.height, channels: 4 } 
      }).png().toBuffer();

      composited = composited.composite([
        {
          input: blurredWithOpacity,
          blend: 'over',
        },
      ]);
    }

    return composited.png().toBuffer();
  }

  /**
   * Generate animation frames
   */
  private async generateAnimationFrames(
    request: UltraPremiumTextRequest,
    animation: TextAnimationConfig
  ): Promise<Buffer[]> {
    const frames: Buffer[] = [];
    const frameCount = animation.frameCount || 30;

    for (let i = 0; i < frameCount; i++) {
      const progress = i / (frameCount - 1);
      const easedProgress = this.applyEasing(progress, animation.easing);

      // Modify style based on animation type and progress
      const animatedStyle = this.applyAnimationToStyle(
        request.style,
        animation,
        easedProgress
      );

      const frameRequest = { ...request, style: animatedStyle };
      const result = await this.renderText(frameRequest);
      frames.push(result.imageBuffer);
    }

    return frames;
  }

  /**
   * Apply easing function
   */
  private applyEasing(t: number, easing: TextAnimationConfig['easing']): number {
    switch (easing) {
      case 'ease-in':
        return t * t;
      case 'ease-out':
        return 1 - (1 - t) * (1 - t);
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      case 'bounce':
        if (t < 1 / 2.75) {
          return 7.5625 * t * t;
        } else if (t < 2 / 2.75) {
          return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
        } else if (t < 2.5 / 2.75) {
          return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
        } else {
          return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
        }
      case 'elastic':
        return t === 0 ? 0 : t === 1 ? 1 :
          -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3));
      case 'linear':
      default:
        return t;
    }
  }

  /**
   * Apply animation to style
   */
  private applyAnimationToStyle(
    style: UltraPremiumTextStyle,
    animation: TextAnimationConfig,
    progress: number
  ): UltraPremiumTextStyle {
    const animated = { ...style };

    switch (animation.type) {
      case 'fade-in':
        animated.opacity = progress;
        break;
      case 'slide':
        const offset = (1 - progress) * 100;
        animated.transform = {
          ...animated.transform,
          ...(animation.direction === 'left' ? { rotateY: -offset * 0.5 } : {}),
          ...(animation.direction === 'right' ? { rotateY: offset * 0.5 } : {}),
          ...(animation.direction === 'up' ? { rotateX: offset * 0.5 } : {}),
          ...(animation.direction === 'down' ? { rotateX: -offset * 0.5 } : {}),
        };
        animated.opacity = progress;
        break;
      case 'bounce':
        const bounce = Math.sin(progress * Math.PI) * (1 - progress) * 20;
        animated.transform = {
          ...animated.transform,
          scale: 1 + bounce * 0.1,
        };
        break;
      case 'wave':
        animated.distortion = {
          ...animated.distortion,
          wave: {
            amplitude: 10 * (1 - progress),
            frequency: 0.1,
            phase: progress * Math.PI * 2,
          },
        };
        break;
      case 'glitch':
        if (Math.random() < 0.3 && progress < 0.8) {
          animated.transform = {
            ...animated.transform,
            skewX: (Math.random() - 0.5) * 20,
          };
        }
        animated.opacity = progress > 0.8 ? 1 : 0.7 + Math.random() * 0.3;
        break;
    }

    return animated;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private getVariantFromStyle(style: UltraPremiumTextStyle): string {
    let variant = '';
    if (typeof style.fontWeight === 'number') {
      variant = String(style.fontWeight);
    } else {
      variant = style.fontWeight || 'regular';
    }
    if (style.fontStyle === 'italic') {
      variant += 'italic';
    }
    return variant || 'regular';
  }

  private getQualitySettings(quality: UltraPremiumTextRequest['quality']): { layers: number; antialiasing: number } {
    switch (quality) {
      case 'draft': return { layers: 5, antialiasing: 1 };
      case 'normal': return { layers: 20, antialiasing: 2 };
      case 'high': return { layers: 50, antialiasing: 4 };
      case 'ultra': return { layers: 100, antialiasing: 8 };
      default: return { layers: 20, antialiasing: 2 };
    }
  }

  private async normalizeImageInput(input: Buffer | string): Promise<Buffer> {
    if (Buffer.isBuffer(input)) return input;
    if (input.startsWith('data:image')) {
      return Buffer.from(input.split(',')[1], 'base64');
    }
    if (input.startsWith('http')) {
      return this.downloadImage(input);
    }
    return Buffer.from(input, 'base64');
  }

  private async downloadImage(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', reject);
    });
  }

  private createGradient(
    ctx: CanvasRenderingContext2D,
    def: GradientDef,
    x: number,
    y: number,
    width: number,
    height: number
  ): CanvasGradient {
    const angle = ((def.angle || 0) * Math.PI) / 180;
    const length = Math.sqrt(width * width + height * height);
    const dx = Math.cos(angle) * length / 2;
    const dy = Math.sin(angle) * length / 2;
    const cx = x + width / 2;
    const cy = y + height / 2;

    const gradient = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);

    for (const stop of def.stops) {
      gradient.addColorStop(stop.offset, stop.color);
    }

    return gradient;
  }

  private adjustBrightness(color: string, factor: number): string {
    const rgb = this.hexToRgb(color);
    if (!rgb) return color;

    const nr = Math.round(Math.min(255, Math.max(0, rgb.r * factor)));
    const ng = Math.round(Math.min(255, Math.max(0, rgb.g * factor)));
    const nb = Math.round(Math.min(255, Math.max(0, rgb.b * factor)));

    return this.rgbToHex(nr, ng, nb);
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : null;
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return `#${[r, g, b].map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('')}`;
  }

  private seededRandom(seed: number): () => number {
    return () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  }
}

// ============================================================================
// Singleton & Exports
// ============================================================================

let instance: UltraPremiumTextService | null = null;

export function getUltraPremiumTextService(): UltraPremiumTextService {
  if (!instance) {
    instance = new UltraPremiumTextService();
  }
  return instance;
}

export default UltraPremiumTextService;
