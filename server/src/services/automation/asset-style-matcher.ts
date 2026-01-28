/**
 * Asset Style Matcher
 *
 * Matches 3D asset and video styles to the app's theme and color scheme.
 * Ensures all generated assets feel cohesive with the overall design.
 *
 * Key Responsibilities:
 * - Generate color palettes from primary/accent colors
 * - Determine 3D material properties (metalness, roughness, emission)
 * - Configure lighting for 3D scenes
 * - Define video visual treatments (color grading, transitions)
 * - Ensure accessibility and contrast requirements
 */

import type { UISceneBlueprint, UIStyleContext } from '../ai/ui-blueprint-service.js';
import type { Asset3DType, VideoType } from './automatic-asset-orchestrator.js';

// ============================================================================
// Types
// ============================================================================

export interface StyleMatchResult {
  /** Overall match confidence (0-1) */
  confidence: number;
  /** Matched color palette */
  colorPalette: ColorPalette;
  /** 3D-specific style parameters */
  style3D?: Style3DParams;
  /** Video-specific style parameters */
  styleVideo?: StyleVideoParams;
  /** Animation style */
  animationStyle: AnimationStyle;
  /** Generation prompt additions */
  promptAdditions: string[];
}

export interface ColorPalette {
  /** Primary color (hex) */
  primary: string;
  /** Secondary/accent color (hex) */
  accent: string;
  /** Background color (hex) */
  background: string;
  /** Foreground/text color (hex) */
  foreground: string;
  /** Gradient colors for effects */
  gradient: [string, string];
  /** Emission/glow color */
  emission: string;
  /** Shadow color */
  shadow: string;
  /** Derived complementary colors */
  complementary: string[];
}

export interface Style3DParams {
  /** Material properties */
  material: {
    type: 'standard' | 'physical' | 'toon' | 'glass';
    metalness: number;      // 0-1
    roughness: number;      // 0-1
    transmission: number;   // 0-1 (glass effect)
    ior: number;            // Index of refraction
    clearcoat: number;      // 0-1
    emissiveIntensity: number;
  };
  /** Lighting configuration */
  lighting: {
    type: 'studio' | 'outdoor' | 'dramatic' | 'soft';
    intensity: number;
    ambientIntensity: number;
    shadowSoftness: number;
    hdriPath?: string;
  };
  /** Post-processing effects */
  postProcessing: {
    bloom: boolean;
    bloomIntensity: number;
    chromaticAberration: boolean;
    vignette: boolean;
    depthOfField: boolean;
  };
  /** Animation parameters */
  animation: {
    rotationSpeed: number;  // radians per second
    floatAmplitude: number; // vertical float
    wobbleFrequency: number;
    entranceType: 'fade' | 'scale' | 'slide' | 'morph';
  };
}

export interface StyleVideoParams {
  /** Color grading */
  colorGrading: {
    temperature: number;    // -100 to 100 (cool to warm)
    tint: number;           // -100 to 100 (green to magenta)
    saturation: number;     // -100 to 100
    contrast: number;       // -100 to 100
    exposure: number;       // -2 to 2
    highlights: number;     // -100 to 100
    shadows: number;        // -100 to 100
  };
  /** Visual style */
  visualStyle: {
    type: 'clean' | 'cinematic' | 'vintage' | 'futuristic' | 'minimal';
    grain: boolean;
    grainIntensity: number;
    letterbox: boolean;
    aspectRatio: '16:9' | '21:9' | '9:16' | '1:1';
  };
  /** Transitions */
  transitions: {
    type: 'cut' | 'fade' | 'dissolve' | 'slide' | 'zoom' | 'morph';
    duration: number;       // seconds
    easing: string;
  };
  /** Motion style */
  motion: {
    pacing: 'slow' | 'medium' | 'fast' | 'dynamic';
    cameraMovement: 'static' | 'pan' | 'orbit' | 'tracking' | 'handheld';
    textAnimation: 'type' | 'fade' | 'slide' | 'scale' | 'glitch';
  };
}

export interface AnimationStyle {
  /** Animation library preference */
  library: 'gsap' | 'framer-motion' | 'css' | 'three';
  /** Easing curve */
  easing: string;
  /** Spring physics (for Framer Motion) */
  spring?: {
    stiffness: number;
    damping: number;
    mass: number;
  };
  /** Duration multiplier */
  durationScale: number;
  /** Stagger delay */
  staggerDelay: number;
}

// ============================================================================
// Color Utilities
// ============================================================================

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex);
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  switch (max) {
    case rNorm:
      h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6;
      break;
    case gNorm:
      h = ((bNorm - rNorm) / d + 2) / 6;
      break;
    case bNorm:
      h = ((rNorm - gNorm) / d + 4) / 6;
      break;
  }

  return { h: h * 360, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  h = h / 360;

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return rgbToHex(r * 255, g * 255, b * 255);
}

function getComplementaryColor(hex: string): string {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex((h + 180) % 360, s, l);
}

function getAnalogousColors(hex: string): [string, string] {
  const { h, s, l } = hexToHsl(hex);
  return [
    hslToHex((h + 30) % 360, s, l),
    hslToHex((h + 330) % 360, s, l),
  ];
}

function adjustLightness(hex: string, amount: number): string {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, s, Math.max(0, Math.min(1, l + amount)));
}

function adjustSaturation(hex: string, amount: number): string {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, Math.max(0, Math.min(1, s + amount)), l);
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_COLORS = {
  light: {
    primary: '#6366f1',      // Indigo
    accent: '#8b5cf6',       // Violet
    background: '#ffffff',
    foreground: '#0f172a',
    shadow: 'rgba(0, 0, 0, 0.1)',
  },
  dark: {
    primary: '#818cf8',      // Light indigo
    accent: '#a78bfa',       // Light violet
    background: '#0f172a',
    foreground: '#f8fafc',
    shadow: 'rgba(0, 0, 0, 0.4)',
  },
};

// ============================================================================
// Asset Style Matcher Implementation
// ============================================================================

export class AssetStyleMatcher {
  /**
   * Match 3D asset style to app theme
   */
  async match3DAssetStyle(
    assetType: Asset3DType,
    styleContext: UIStyleContext,
    blueprint?: UISceneBlueprint
  ): Promise<StyleMatchResult> {
    // Generate color palette
    const colorPalette = this.generateColorPalette(styleContext);

    // Get 3D-specific parameters based on asset type
    const style3D = this.generate3DParams(assetType, styleContext, colorPalette);

    // Get animation style
    const animationStyle = this.generateAnimationStyle(styleContext);

    // Generate prompt additions for FLUX/3D generation
    const promptAdditions = this.generate3DPromptAdditions(
      assetType,
      styleContext,
      colorPalette
    );

    return {
      confidence: 0.9,
      colorPalette,
      style3D,
      animationStyle,
      promptAdditions,
    };
  }

  /**
   * Match video style to app theme
   */
  async matchVideoStyle(
    videoType: VideoType,
    styleContext: UIStyleContext
  ): Promise<StyleMatchResult> {
    // Generate color palette
    const colorPalette = this.generateColorPalette(styleContext);

    // Get video-specific parameters
    const styleVideo = this.generateVideoParams(videoType, styleContext, colorPalette);

    // Get animation style
    const animationStyle = this.generateAnimationStyle(styleContext);

    // Generate prompt additions for video generation
    const promptAdditions = this.generateVideoPromptAdditions(
      videoType,
      styleContext,
      colorPalette
    );

    return {
      confidence: 0.85,
      colorPalette,
      styleVideo,
      animationStyle,
      promptAdditions,
    };
  }

  /**
   * Generate comprehensive color palette from style context
   */
  private generateColorPalette(styleContext: UIStyleContext): ColorPalette {
    const isDark = styleContext.colorScheme === 'dark';
    const defaults = isDark ? DEFAULT_COLORS.dark : DEFAULT_COLORS.light;

    const primary = styleContext.primaryColor || defaults.primary;
    const accent = styleContext.accentColor || defaults.accent;

    // Generate derived colors
    const complementary = getComplementaryColor(primary);
    const [analogous1, analogous2] = getAnalogousColors(primary);

    // Generate gradient based on primary and accent
    const gradient: [string, string] = [primary, accent];

    // Emission color - brighter version of accent
    const emission = adjustLightness(accent, 0.2);

    // Shadow color based on scheme
    const shadow = isDark
      ? 'rgba(0, 0, 0, 0.4)'
      : `rgba(${hexToRgb(primary).r}, ${hexToRgb(primary).g}, ${hexToRgb(primary).b}, 0.15)`;

    return {
      primary,
      accent,
      background: defaults.background,
      foreground: defaults.foreground,
      gradient,
      emission,
      shadow,
      complementary: [complementary, analogous1, analogous2],
    };
  }

  /**
   * Generate 3D-specific style parameters
   */
  private generate3DParams(
    assetType: Asset3DType,
    styleContext: UIStyleContext,
    colorPalette: ColorPalette
  ): Style3DParams {
    const isDark = styleContext.colorScheme === 'dark';

    // Material properties based on asset type and style
    const material = this.get3DMaterial(assetType, styleContext);

    // Lighting based on scheme and style
    const lighting = this.get3DLighting(assetType, styleContext, isDark);

    // Post-processing effects
    const postProcessing = this.get3DPostProcessing(assetType, styleContext);

    // Animation parameters
    const animation = this.get3DAnimation(assetType, styleContext);

    return { material, lighting, postProcessing, animation };
  }

  /**
   * Get 3D material properties
   */
  private get3DMaterial(
    assetType: Asset3DType,
    styleContext: UIStyleContext
  ): Style3DParams['material'] {
    // Base properties vary by asset type
    const materialByAsset: Record<Asset3DType, Partial<Style3DParams['material']>> = {
      'hero-abstract': {
        type: 'physical',
        metalness: 0.3,
        roughness: 0.4,
        transmission: 0,
        clearcoat: 0.5,
        emissiveIntensity: 0.2,
      },
      'hero-product': {
        type: 'physical',
        metalness: 0.8,
        roughness: 0.2,
        transmission: 0,
        clearcoat: 0.8,
        emissiveIntensity: 0,
      },
      'hero-text': {
        type: 'standard',
        metalness: 0.5,
        roughness: 0.3,
        transmission: 0,
        clearcoat: 0.3,
        emissiveIntensity: 0.3,
      },
      'background-particles': {
        type: 'standard',
        metalness: 0,
        roughness: 0.9,
        transmission: 0,
        clearcoat: 0,
        emissiveIntensity: 0.8,
      },
      'background-waves': {
        type: 'glass',
        metalness: 0,
        roughness: 0.1,
        transmission: 0.6,
        clearcoat: 0.2,
        emissiveIntensity: 0.1,
      },
      'product-viewer': {
        type: 'physical',
        metalness: 0.6,
        roughness: 0.3,
        transmission: 0,
        clearcoat: 0.7,
        emissiveIntensity: 0,
      },
      'scene-environment': {
        type: 'standard',
        metalness: 0.2,
        roughness: 0.5,
        transmission: 0,
        clearcoat: 0.2,
        emissiveIntensity: 0.1,
      },
      'logo-3d': {
        type: 'physical',
        metalness: 0.7,
        roughness: 0.2,
        transmission: 0,
        clearcoat: 0.9,
        emissiveIntensity: 0.15,
      },
      'icon-set': {
        type: 'toon',
        metalness: 0,
        roughness: 0.5,
        transmission: 0,
        clearcoat: 0,
        emissiveIntensity: 0.1,
      },
      'character': {
        type: 'standard',
        metalness: 0.1,
        roughness: 0.6,
        transmission: 0,
        clearcoat: 0.1,
        emissiveIntensity: 0,
      },
      'data-visualization': {
        type: 'glass',
        metalness: 0.2,
        roughness: 0.1,
        transmission: 0.4,
        clearcoat: 0.5,
        emissiveIntensity: 0.4,
      },
    };

    const baseMaterial = materialByAsset[assetType] || {};

    // Adjust based on typography style
    let emissiveBoost = 0;
    if (styleContext.typography === 'playful') {
      emissiveBoost = 0.1;
    } else if (styleContext.typography === 'minimal') {
      emissiveBoost = -0.1;
    }

    return {
      type: baseMaterial.type || 'standard',
      metalness: baseMaterial.metalness ?? 0.3,
      roughness: baseMaterial.roughness ?? 0.5,
      transmission: baseMaterial.transmission ?? 0,
      ior: 1.5,
      clearcoat: baseMaterial.clearcoat ?? 0.3,
      emissiveIntensity: Math.max(0, (baseMaterial.emissiveIntensity ?? 0.1) + emissiveBoost),
    };
  }

  /**
   * Get 3D lighting configuration
   */
  private get3DLighting(
    assetType: Asset3DType,
    styleContext: UIStyleContext,
    isDark: boolean
  ): Style3DParams['lighting'] {
    // Base lighting by asset type
    const lightingByAsset: Partial<Record<Asset3DType, Style3DParams['lighting']['type']>> = {
      'hero-abstract': 'dramatic',
      'hero-product': 'studio',
      'scene-environment': 'outdoor',
      'background-particles': 'soft',
      'data-visualization': 'soft',
    };

    const type = lightingByAsset[assetType] || 'studio';

    // Intensity based on scheme and shadow preference
    const intensityMap: Record<typeof styleContext.shadows, number> = {
      none: 1.2,
      subtle: 1.0,
      medium: 0.9,
      strong: 0.8,
    };

    const intensity = intensityMap[styleContext.shadows];
    const ambientIntensity = isDark ? 0.3 : 0.5;

    // Shadow softness based on style
    const shadowSoftnessMap: Record<typeof styleContext.shadows, number> = {
      none: 0,
      subtle: 0.8,
      medium: 0.5,
      strong: 0.2,
    };

    return {
      type,
      intensity,
      ambientIntensity,
      shadowSoftness: shadowSoftnessMap[styleContext.shadows],
      hdriPath: isDark ? '/hdri/night-studio.hdr' : '/hdri/day-studio.hdr',
    };
  }

  /**
   * Get 3D post-processing effects
   */
  private get3DPostProcessing(
    assetType: Asset3DType,
    styleContext: UIStyleContext
  ): Style3DParams['postProcessing'] {
    // Post-processing varies by asset type
    const effectsByAsset: Partial<Record<Asset3DType, Partial<Style3DParams['postProcessing']>>> = {
      'hero-abstract': { bloom: true, bloomIntensity: 0.6, chromaticAberration: true },
      'background-particles': { bloom: true, bloomIntensity: 0.8 },
      'hero-text': { bloom: true, bloomIntensity: 0.3 },
      'data-visualization': { bloom: true, bloomIntensity: 0.4 },
    };

    const effects = effectsByAsset[assetType] || {};

    // Adjust based on style
    const isMinimal = styleContext.typography === 'minimal';

    return {
      bloom: isMinimal ? false : (effects.bloom ?? false),
      bloomIntensity: isMinimal ? 0 : (effects.bloomIntensity ?? 0.3),
      chromaticAberration: isMinimal ? false : (effects.chromaticAberration ?? false),
      vignette: styleContext.colorScheme === 'dark',
      depthOfField: assetType === 'product-viewer',
    };
  }

  /**
   * Get 3D animation parameters
   */
  private get3DAnimation(
    assetType: Asset3DType,
    styleContext: UIStyleContext
  ): Style3DParams['animation'] {
    // Animation style by typography
    const animationByStyle: Record<typeof styleContext.typography, Partial<Style3DParams['animation']>> = {
      modern: { rotationSpeed: 0.2, floatAmplitude: 0.1, entranceType: 'scale' },
      classic: { rotationSpeed: 0.1, floatAmplitude: 0.05, entranceType: 'fade' },
      playful: { rotationSpeed: 0.3, floatAmplitude: 0.15, entranceType: 'morph' },
      minimal: { rotationSpeed: 0.05, floatAmplitude: 0.03, entranceType: 'fade' },
    };

    const base = animationByStyle[styleContext.typography];

    // Adjust by asset type
    const isBackground = assetType.startsWith('background-');
    if (isBackground) {
      return {
        rotationSpeed: base.rotationSpeed! * 0.5,
        floatAmplitude: base.floatAmplitude! * 0.3,
        wobbleFrequency: 0.5,
        entranceType: 'fade',
      };
    }

    return {
      rotationSpeed: base.rotationSpeed ?? 0.2,
      floatAmplitude: base.floatAmplitude ?? 0.1,
      wobbleFrequency: styleContext.typography === 'playful' ? 1.0 : 0.3,
      entranceType: base.entranceType ?? 'scale',
    };
  }

  /**
   * Generate video-specific style parameters
   */
  private generateVideoParams(
    videoType: VideoType,
    styleContext: UIStyleContext,
    colorPalette: ColorPalette
  ): StyleVideoParams {
    const isDark = styleContext.colorScheme === 'dark';

    // Color grading based on style
    const colorGrading = this.getVideoColorGrading(styleContext, isDark);

    // Visual style
    const visualStyle = this.getVideoVisualStyle(videoType, styleContext);

    // Transitions
    const transitions = this.getVideoTransitions(videoType, styleContext);

    // Motion style
    const motion = this.getVideoMotion(videoType, styleContext);

    return { colorGrading, visualStyle, transitions, motion };
  }

  /**
   * Get video color grading
   */
  private getVideoColorGrading(
    styleContext: UIStyleContext,
    isDark: boolean
  ): StyleVideoParams['colorGrading'] {
    // Base grading by typography style
    const gradingByStyle: Record<typeof styleContext.typography, Partial<StyleVideoParams['colorGrading']>> = {
      modern: { temperature: 0, saturation: 10, contrast: 15 },
      classic: { temperature: 10, saturation: -5, contrast: 5 },
      playful: { temperature: -5, saturation: 20, contrast: 10 },
      minimal: { temperature: 0, saturation: -10, contrast: 5 },
    };

    const base = gradingByStyle[styleContext.typography];

    return {
      temperature: base.temperature ?? 0,
      tint: 0,
      saturation: base.saturation ?? 0,
      contrast: base.contrast ?? 10,
      exposure: isDark ? -0.1 : 0.1,
      highlights: isDark ? -10 : 5,
      shadows: isDark ? 10 : -5,
    };
  }

  /**
   * Get video visual style
   */
  private getVideoVisualStyle(
    videoType: VideoType,
    styleContext: UIStyleContext
  ): StyleVideoParams['visualStyle'] {
    // Style type by video type and context
    const styleByVideo: Partial<Record<VideoType, StyleVideoParams['visualStyle']['type']>> = {
      'intro-promo': 'cinematic',
      'feature-demo': 'clean',
      'story-narrative': 'cinematic',
      'social-clip': 'futuristic',
      'tutorial': 'clean',
    };

    const styleByTypography: Record<typeof styleContext.typography, StyleVideoParams['visualStyle']['type']> = {
      modern: 'clean',
      classic: 'cinematic',
      playful: 'futuristic',
      minimal: 'minimal',
    };

    const type = styleByVideo[videoType] || styleByTypography[styleContext.typography];

    // Aspect ratio based on video type
    const aspectByVideo: Record<VideoType, StyleVideoParams['visualStyle']['aspectRatio']> = {
      'intro-promo': '16:9',
      'feature-demo': '16:9',
      'testimonial': '16:9',
      'product-showcase': '16:9',
      'team-intro': '16:9',
      'story-narrative': '21:9',
      'tutorial': '16:9',
      'social-clip': '9:16',
    };

    return {
      type,
      grain: type === 'cinematic' || type === 'vintage',
      grainIntensity: type === 'cinematic' ? 0.15 : 0.25,
      letterbox: type === 'cinematic',
      aspectRatio: aspectByVideo[videoType],
    };
  }

  /**
   * Get video transitions
   */
  private getVideoTransitions(
    videoType: VideoType,
    styleContext: UIStyleContext
  ): StyleVideoParams['transitions'] {
    const transitionByStyle: Record<typeof styleContext.typography, StyleVideoParams['transitions']['type']> = {
      modern: 'morph',
      classic: 'dissolve',
      playful: 'zoom',
      minimal: 'cut',
    };

    const type = transitionByStyle[styleContext.typography];

    // Duration based on pacing
    const durationByStyle: Record<typeof styleContext.typography, number> = {
      modern: 0.5,
      classic: 0.8,
      playful: 0.4,
      minimal: 0.3,
    };

    return {
      type,
      duration: durationByStyle[styleContext.typography],
      easing: styleContext.typography === 'playful' ? 'spring' : 'easeInOut',
    };
  }

  /**
   * Get video motion style
   */
  private getVideoMotion(
    videoType: VideoType,
    styleContext: UIStyleContext
  ): StyleVideoParams['motion'] {
    // Pacing by video type
    const pacingByVideo: Record<VideoType, StyleVideoParams['motion']['pacing']> = {
      'intro-promo': 'dynamic',
      'feature-demo': 'medium',
      'testimonial': 'slow',
      'product-showcase': 'medium',
      'team-intro': 'slow',
      'story-narrative': 'slow',
      'tutorial': 'medium',
      'social-clip': 'fast',
    };

    // Camera by video type
    const cameraByVideo: Record<VideoType, StyleVideoParams['motion']['cameraMovement']> = {
      'intro-promo': 'orbit',
      'feature-demo': 'pan',
      'testimonial': 'static',
      'product-showcase': 'orbit',
      'team-intro': 'pan',
      'story-narrative': 'tracking',
      'tutorial': 'static',
      'social-clip': 'handheld',
    };

    // Text animation by style
    const textByStyle: Record<typeof styleContext.typography, StyleVideoParams['motion']['textAnimation']> = {
      modern: 'slide',
      classic: 'fade',
      playful: 'glitch',
      minimal: 'fade',
    };

    return {
      pacing: pacingByVideo[videoType],
      cameraMovement: cameraByVideo[videoType],
      textAnimation: textByStyle[styleContext.typography],
    };
  }

  /**
   * Generate animation style
   */
  private generateAnimationStyle(styleContext: UIStyleContext): AnimationStyle {
    // Library preference by style
    const libraryByStyle: Record<typeof styleContext.typography, AnimationStyle['library']> = {
      modern: 'framer-motion',
      classic: 'gsap',
      playful: 'framer-motion',
      minimal: 'css',
    };

    // Spring physics for Framer Motion
    const springByStyle: Record<typeof styleContext.typography, AnimationStyle['spring']> = {
      modern: { stiffness: 300, damping: 25, mass: 1 },
      classic: { stiffness: 150, damping: 20, mass: 1.2 },
      playful: { stiffness: 400, damping: 15, mass: 0.8 },
      minimal: { stiffness: 200, damping: 30, mass: 1 },
    };

    // Duration scale
    const durationByStyle: Record<typeof styleContext.typography, number> = {
      modern: 1.0,
      classic: 1.2,
      playful: 0.8,
      minimal: 0.6,
    };

    return {
      library: libraryByStyle[styleContext.typography],
      easing: styleContext.typography === 'playful' ? 'backOut' : 'easeOut',
      spring: springByStyle[styleContext.typography],
      durationScale: durationByStyle[styleContext.typography],
      staggerDelay: styleContext.typography === 'minimal' ? 0.05 : 0.1,
    };
  }

  /**
   * Generate 3D prompt additions for FLUX/generation
   */
  private generate3DPromptAdditions(
    assetType: Asset3DType,
    styleContext: UIStyleContext,
    colorPalette: ColorPalette
  ): string[] {
    const additions: string[] = [];

    // Color-based prompts
    additions.push(`primary color ${colorPalette.primary}`);
    additions.push(`accent color ${colorPalette.accent}`);

    // Scheme-based prompts
    if (styleContext.colorScheme === 'dark') {
      additions.push('dark background', 'glowing elements', 'neon accents');
    } else {
      additions.push('light background', 'soft shadows', 'clean lighting');
    }

    // Asset-specific prompts
    const assetPrompts: Record<Asset3DType, string[]> = {
      'hero-abstract': ['abstract 3D shapes', 'geometric forms', 'floating elements'],
      'hero-product': ['product photography', 'studio lighting', 'professional render'],
      'hero-text': ['3D typography', 'extruded text', 'metallic letters'],
      'background-particles': ['particle system', 'floating dots', 'ambient particles'],
      'background-waves': ['wave mesh', 'flowing surface', 'fluid animation'],
      'product-viewer': ['360 product view', 'interactive 3D', 'turntable'],
      'scene-environment': ['3D environment', 'immersive scene', 'spatial design'],
      'logo-3d': ['3D logo', 'brand mark', 'corporate identity'],
      'icon-set': ['3D icons', 'isometric icons', 'stylized symbols'],
      'character': ['3D character', 'mascot', 'animated figure'],
      'data-visualization': ['3D chart', 'data visualization', 'infographic'],
    };

    additions.push(...(assetPrompts[assetType] || []));

    // Style-based prompts
    const stylePrompts: Record<typeof styleContext.typography, string[]> = {
      modern: ['clean design', 'minimal aesthetic', 'contemporary'],
      classic: ['elegant', 'timeless', 'sophisticated'],
      playful: ['vibrant', 'energetic', 'dynamic'],
      minimal: ['simple', 'understated', 'essential'],
    };

    additions.push(...stylePrompts[styleContext.typography]);

    return additions;
  }

  /**
   * Generate video prompt additions
   */
  private generateVideoPromptAdditions(
    videoType: VideoType,
    styleContext: UIStyleContext,
    colorPalette: ColorPalette
  ): string[] {
    const additions: string[] = [];

    // Color prompts
    additions.push(`brand colors ${colorPalette.primary} and ${colorPalette.accent}`);

    // Video type prompts
    const videoPrompts: Record<VideoType, string[]> = {
      'intro-promo': ['promotional video', 'brand introduction', 'company overview'],
      'feature-demo': ['feature showcase', 'product demo', 'functionality walkthrough'],
      'testimonial': ['customer testimonial', 'social proof', 'review compilation'],
      'product-showcase': ['product features', 'benefit highlights', 'use cases'],
      'team-intro': ['team presentation', 'company culture', 'people profiles'],
      'story-narrative': ['brand story', 'company journey', 'narrative arc'],
      'tutorial': ['how-to guide', 'instructional', 'step-by-step'],
      'social-clip': ['social media', 'short form', 'attention grabbing'],
    };

    additions.push(...(videoPrompts[videoType] || []));

    // Style prompts
    if (styleContext.colorScheme === 'dark') {
      additions.push('dark aesthetic', 'moody lighting');
    } else {
      additions.push('bright aesthetic', 'clean visuals');
    }

    return additions;
  }
}

// ============================================================================
// Singleton
// ============================================================================

let matcherInstance: AssetStyleMatcher | null = null;

export function getAssetStyleMatcher(): AssetStyleMatcher {
  if (!matcherInstance) {
    matcherInstance = new AssetStyleMatcher();
  }
  return matcherInstance;
}

export default AssetStyleMatcher;
