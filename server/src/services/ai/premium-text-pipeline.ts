/**
 * Premium Text Pipeline - Unified Text Rendering for UI Generation
 *
 * Combines all text rendering capabilities into a single pipeline:
 * - PremiumTextEffectsService: Google Fonts, gradients, 3D, glows
 * - TextOverlayRenderer: Blueprint-based text extraction
 * - TextBlendingService: FLUX Fill seamless blending
 *
 * This pipeline ensures 100% text accuracy with premium styling while
 * achieving seamless integration with AI-generated UI images.
 *
 * Usage:
 * ```typescript
 * const pipeline = getPremiumTextPipeline();
 *
 * // Render premium text element
 * const textImage = await pipeline.renderPremiumText({
 *   text: "Welcome to KripTik",
 *   style: `
 *     font: "Playfair Display" 700 64px;
 *     fill: linear-gradient(135deg, #667eea, #764ba2);
 *     shadow: 0 8px 24px rgba(0,0,0,0.4);
 *     glow: #667eea 15px 3;
 *   `,
 *   width: 800,
 *   height: 200,
 * });
 *
 * // Full UI generation with premium text
 * const result = await pipeline.generateUIWithText({
 *   blueprint,
 *   fluxImage: baseImage,
 *   textStyles: {
 *     heading: `font: "Syne" 800 48px; fill: #ffffff; shadow: 0 4px 12px rgba(0,0,0,0.5);`,
 *     button: `font: "Inter" 600 16px; fill: #ffffff;`,
 *   }
 * });
 * ```
 */

import { createCanvas, type CanvasRenderingContext2D } from 'canvas';
import sharp from 'sharp';
import {
  PremiumTextEffectsService,
  getPremiumTextEffects,
  type PremiumTextStyle,
  type GradientDef,
} from './premium-text-effects.js';
import {
  TextOverlayRenderer,
  getTextOverlayRenderer,
  type TextOverlayRequest,
  type TextElement,
} from './text-overlay-renderer.js';
import {
  TextBlendingService,
  getTextBlendingService,
  type TextBlendingRequest,
} from './text-blending-service.js';
import type { UISceneBlueprint, UIComponent } from './ui-blueprint-service.js';

// ============================================================================
// Types
// ============================================================================

/** Request to render a single premium text element */
export interface PremiumTextRequest {
  /** Text content */
  text: string;
  /** CSS-like style string or PremiumTextStyle object */
  style: string | PremiumTextStyle;
  /** Output width */
  width: number;
  /** Output height */
  height: number;
  /** Horizontal alignment */
  align?: 'left' | 'center' | 'right';
  /** Vertical alignment */
  verticalAlign?: 'top' | 'middle' | 'bottom';
  /** Background color (transparent if not specified) */
  background?: string;
}

/** Request to generate UI with premium text */
export interface UIWithTextRequest {
  /** UI blueprint with component definitions */
  blueprint: UISceneBlueprint;
  /** Base FLUX-generated image */
  fluxImage: Buffer | string;
  /** Style overrides by component type or ID */
  textStyles?: {
    /** Style for heading components */
    heading?: string | PremiumTextStyle;
    /** Style for body text */
    text?: string | PremiumTextStyle;
    /** Style for buttons */
    button?: string | PremiumTextStyle;
    /** Style for badges */
    badge?: string | PremiumTextStyle;
    /** Style for specific component IDs */
    [componentId: string]: string | PremiumTextStyle | undefined;
  };
  /** Blending mode for text integration */
  blendMode?: 'overlay' | 'inpaint' | 'hybrid';
  /** Output dimensions (defaults to blueprint/image dimensions) */
  dimensions?: { width: number; height: number };
}

/** Result of UI generation with premium text */
export interface UIWithTextResult {
  /** Final composited image */
  image: Buffer;
  /** Width */
  width: number;
  /** Height */
  height: number;
  /** Number of text elements rendered */
  textCount: number;
  /** Processing time in ms */
  processingTime: number;
  /** Fonts used */
  fontsUsed: string[];
  /** Any rendering errors */
  errors: Array<{ componentId: string; error: string }>;
}

/** Font recommendation */
export interface FontRecommendation {
  family: string;
  category: string;
  variants: string[];
  pairedWith?: string[];
  useCases: string[];
}

// ============================================================================
// Default Styles
// ============================================================================

const DEFAULT_COMPONENT_STYLES: Record<string, PremiumTextStyle> = {
  heading: {
    fontFamily: 'Playfair Display',
    fontSize: 48,
    fontWeight: 700,
    fill: '#ffffff',
    shadow: { offsetX: 0, offsetY: 4, blur: 12, color: 'rgba(0,0,0,0.4)' },
    letterSpacing: -0.5,
  },
  text: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: 400,
    fill: '#e5e7eb',
    letterSpacing: 0,
  },
  button: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: 600,
    fill: '#ffffff',
    letterSpacing: 0.3,
  },
  badge: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: 500,
    fill: '#ffffff',
    letterSpacing: 0.5,
  },
};

// ============================================================================
// Premium Text Pipeline
// ============================================================================

export class PremiumTextPipeline {
  private effects: PremiumTextEffectsService;
  private renderer: TextOverlayRenderer;
  private blender: TextBlendingService;
  private initialized = false;

  constructor(googleFontsApiKey?: string) {
    this.effects = getPremiumTextEffects(googleFontsApiKey);
    this.renderer = getTextOverlayRenderer();
    this.blender = getTextBlendingService();
  }

  /**
   * Initialize the pipeline (loads fonts, etc.)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.effects.initialize(),
      this.renderer.registerFonts(),
    ]);

    this.initialized = true;
  }

  // --------------------------------------------------------------------------
  // Single Text Rendering
  // --------------------------------------------------------------------------

  /**
   * Render a single text element with premium effects
   */
  async renderPremiumText(request: PremiumTextRequest): Promise<Buffer> {
    await this.initialize();

    const style = typeof request.style === 'string'
      ? this.effects.parseStyleString(request.style)
      : request.style;

    // Apply defaults
    const fullStyle: PremiumTextStyle = {
      fontFamily: 'Inter',
      fontSize: 24,
      fontWeight: 400,
      fill: '#ffffff',
      ...style,
    };

    // Create canvas with optional background
    const canvas = createCanvas(request.width, request.height);
    const ctx = canvas.getContext('2d');

    if (request.background) {
      ctx.fillStyle = request.background;
      ctx.fillRect(0, 0, request.width, request.height);
    }

    // Load font
    const variant = this.getVariantFromStyle(fullStyle);
    await this.effects.loadFont(fullStyle.fontFamily, variant);

    // Render text with effects
    const textBuffer = await this.effects.renderText(
      request.text,
      fullStyle,
      request.width,
      request.height
    );

    // Composite onto background if specified
    if (request.background) {
      return sharp(canvas.toBuffer('image/png'))
        .composite([{ input: textBuffer, blend: 'over' }])
        .png()
        .toBuffer();
    }

    return textBuffer;
  }

  /**
   * Render multiple text elements and composite them
   */
  async renderMultiplePremiumTexts(
    elements: Array<{
      text: string;
      style: string | PremiumTextStyle;
      x: number;
      y: number;
      width: number;
      height: number;
    }>,
    canvasWidth: number,
    canvasHeight: number
  ): Promise<Buffer> {
    await this.initialize();

    // Render each element
    const renderedElements = await Promise.all(
      elements.map(async (el) => {
        const buffer = await this.renderPremiumText({
          text: el.text,
          style: el.style,
          width: el.width,
          height: el.height,
        });

        return {
          input: buffer,
          left: Math.round(el.x),
          top: Math.round(el.y),
        };
      })
    );

    // Create transparent base canvas
    const baseBuffer = await sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();

    // Composite all elements
    return sharp(baseBuffer)
      .composite(renderedElements)
      .png()
      .toBuffer();
  }

  // --------------------------------------------------------------------------
  // Full UI Generation
  // --------------------------------------------------------------------------

  /**
   * Generate UI image with premium text rendering
   */
  async generateUIWithText(request: UIWithTextRequest): Promise<UIWithTextResult> {
    await this.initialize();
    const startTime = Date.now();

    const errors: Array<{ componentId: string; error: string }> = [];
    const fontsUsed = new Set<string>();

    // Get image dimensions
    const baseBuffer = await this.normalizeImageInput(request.fluxImage);
    const metadata = await sharp(baseBuffer).metadata();
    const width = request.dimensions?.width || metadata.width || 1920;
    const height = request.dimensions?.height || metadata.height || 1080;

    // Extract text components from blueprint
    const textComponents = request.blueprint.components.filter(
      (c) => this.isTextComponent(c)
    );

    // Convert components to premium text elements
    const elements = await Promise.all(
      textComponents.map(async (component) => {
        try {
          const style = this.getStyleForComponent(
            component,
            request.textStyles,
            request.blueprint
          );

          fontsUsed.add(
            typeof style === 'string'
              ? (this.effects.parseStyleString(style) as PremiumTextStyle).fontFamily || 'Inter'
              : style.fontFamily
          );

          // Convert percentage bounds to pixels
          const bounds = {
            x: (component.bounds.x / 100) * width,
            y: (component.bounds.y / 100) * height,
            width: (component.bounds.width / 100) * width,
            height: (component.bounds.height / 100) * height,
          };

          return {
            componentId: component.id,
            text: component.label || '',
            style,
            ...bounds,
          };
        } catch (error) {
          errors.push({
            componentId: component.id,
            error: error instanceof Error ? error.message : String(error),
          });
          return null;
        }
      })
    );

    // Filter out failed elements
    const validElements = elements.filter(
      (e): e is NonNullable<typeof e> => e !== null && e.text.trim().length > 0
    );

    // Render all text elements
    const textOverlay = await this.renderMultiplePremiumTexts(
      validElements.map((e) => ({
        text: e.text,
        style: e.style,
        x: e.x,
        y: e.y,
        width: e.width,
        height: e.height,
      })),
      width,
      height
    );

    // Blend text with base image
    let finalImage: Buffer;

    if (request.blendMode === 'inpaint' || request.blendMode === 'hybrid') {
      // Use FLUX Fill blending for seamless integration
      const blendResult = await this.blender.blendText({
        baseImage: baseBuffer,
        blueprint: request.blueprint,
        dimensions: { width, height },
        blendMode: request.blendMode,
      });
      finalImage = blendResult.imageBuffer;
    } else {
      // Simple overlay
      finalImage = await sharp(baseBuffer)
        .composite([{ input: textOverlay, blend: 'over' }])
        .png()
        .toBuffer();
    }

    return {
      image: finalImage,
      width,
      height,
      textCount: validElements.length,
      processingTime: Date.now() - startTime,
      fontsUsed: Array.from(fontsUsed),
      errors,
    };
  }

  // --------------------------------------------------------------------------
  // Font Management
  // --------------------------------------------------------------------------

  /**
   * Search available Google Fonts
   */
  searchFonts(query: string, category?: string): ReturnType<PremiumTextEffectsService['searchFonts']> {
    return this.effects.searchFonts(query, category);
  }

  /**
   * Get recommended fonts for UI design
   */
  getRecommendedFonts(): ReturnType<PremiumTextEffectsService['getRecommendedFonts']> {
    return this.effects.getRecommendedFonts();
  }

  /**
   * Preload fonts for faster rendering
   */
  async preloadFonts(fonts: Array<{ family: string; variant?: string }>): Promise<void> {
    await this.initialize();

    await Promise.all(
      fonts.map((f) => this.effects.loadFont(f.family, f.variant || 'regular'))
    );
  }

  /**
   * Get font pairing recommendations
   */
  getFontPairings(primaryFont: string): FontRecommendation[] {
    const pairings: Record<string, string[]> = {
      // Display fonts -> Body fonts
      'Playfair Display': ['Inter', 'Lato', 'Source Sans Pro'],
      'Bebas Neue': ['Open Sans', 'Roboto', 'Montserrat'],
      'Abril Fatface': ['Lora', 'Merriweather', 'Crimson Text'],
      'Syne': ['Inter', 'DM Sans', 'Work Sans'],
      'Clash Display': ['Satoshi', 'Inter', 'Plus Jakarta Sans'],

      // Sans-serif -> Serif
      'Inter': ['Playfair Display', 'Merriweather', 'Lora'],
      'Roboto': ['Roboto Slab', 'Playfair Display', 'Crimson Text'],
      'Montserrat': ['Merriweather', 'Lora', 'Playfair Display'],

      // Monospace
      'JetBrains Mono': ['Inter', 'Roboto', 'Open Sans'],
      'Fira Code': ['Inter', 'Source Sans Pro', 'Nunito'],
    };

    const pairs = pairings[primaryFont] || ['Inter', 'Open Sans', 'Lato'];

    return pairs.map((family) => ({
      family,
      category: this.getFontCategory(family),
      variants: ['regular', '500', '600', '700'],
      pairedWith: [primaryFont],
      useCases: this.getFontUseCases(family),
    }));
  }

  // --------------------------------------------------------------------------
  // Style Utilities
  // --------------------------------------------------------------------------

  /**
   * Create gradient definition
   */
  createGradient(
    type: 'linear' | 'radial' | 'conic',
    colors: string[],
    angle?: number
  ): GradientDef {
    return {
      type,
      angle: angle || 135,
      stops: colors.map((color, i) => ({
        offset: i / (colors.length - 1),
        color,
      })),
    };
  }

  /**
   * Create preset style for common use cases
   */
  getPresetStyle(preset: 'hero-heading' | 'cta-button' | 'neon-glow' | 'elegant-serif' | '3d-bold'): PremiumTextStyle {
    const presets: Record<string, PremiumTextStyle> = {
      'hero-heading': {
        fontFamily: 'Syne',
        fontSize: 72,
        fontWeight: 800,
        fill: {
          type: 'linear',
          angle: 135,
          stops: [
            { offset: 0, color: '#ffffff' },
            { offset: 1, color: '#e5e7eb' },
          ],
        },
        shadow: [
          { offsetX: 0, offsetY: 4, blur: 8, color: 'rgba(0,0,0,0.3)' },
          { offsetX: 0, offsetY: 16, blur: 32, color: 'rgba(0,0,0,0.2)' },
        ],
        letterSpacing: -1,
      },
      'cta-button': {
        fontFamily: 'Inter',
        fontSize: 16,
        fontWeight: 600,
        fill: '#ffffff',
        letterSpacing: 0.5,
        shadow: { offsetX: 0, offsetY: 1, blur: 2, color: 'rgba(0,0,0,0.2)' },
      },
      'neon-glow': {
        fontFamily: 'Bebas Neue',
        fontSize: 64,
        fontWeight: 400,
        fill: '#00ff88',
        glow: {
          color: '#00ff88',
          blur: 20,
          spread: 10,
          strength: 5,
        },
        shadow: { offsetX: 0, offsetY: 0, blur: 30, color: 'rgba(0,255,136,0.6)' },
      },
      'elegant-serif': {
        fontFamily: 'Playfair Display',
        fontSize: 48,
        fontWeight: 700,
        fontStyle: 'italic',
        fill: '#1f2937',
        letterSpacing: 1,
      },
      '3d-bold': {
        fontFamily: 'Anton',
        fontSize: 80,
        fontWeight: 400,
        fill: '#f59e0b',
        extrusion: {
          depth: 10,
          angle: 135,
          color: '#d97706',
        },
        stroke: { width: 2, color: '#1f2937' },
      },
    };

    return presets[preset] || presets['hero-heading'];
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private getVariantFromStyle(style: PremiumTextStyle): string {
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

  private isTextComponent(component: UIComponent): boolean {
    const textTypes = ['text', 'heading', 'button', 'badge', 'tab', 'nav'];
    return textTypes.includes(component.type) && !!component.label?.trim();
  }

  private getStyleForComponent(
    component: UIComponent,
    styles?: UIWithTextRequest['textStyles'],
    blueprint?: UISceneBlueprint
  ): string | PremiumTextStyle {
    // Check for component-specific style
    if (styles?.[component.id]) {
      return styles[component.id]!;
    }

    // Check for component type style
    if (styles?.[component.type]) {
      return styles[component.type]!;
    }

    // Return default style for component type
    const defaultStyle = DEFAULT_COMPONENT_STYLES[component.type] || DEFAULT_COMPONENT_STYLES.text;

    // Adjust font size based on component bounds
    const fontSize = this.calculateFontSize(component, blueprint);

    return {
      ...defaultStyle,
      fontSize,
    };
  }

  private calculateFontSize(component: UIComponent, blueprint?: UISceneBlueprint): number {
    // Estimate based on component height percentage
    const heightPercent = component.bounds.height;

    if (component.type === 'heading') {
      return Math.max(24, Math.min(72, heightPercent * 4));
    }

    if (component.type === 'button') {
      return Math.max(12, Math.min(20, heightPercent * 2.5));
    }

    return Math.max(12, Math.min(24, heightPercent * 3));
  }

  private async normalizeImageInput(input: Buffer | string): Promise<Buffer> {
    if (Buffer.isBuffer(input)) {
      return input;
    }

    if (input.startsWith('data:image')) {
      const base64Data = input.split(',')[1];
      return Buffer.from(base64Data, 'base64');
    }

    if (input.startsWith('http://') || input.startsWith('https://')) {
      const response = await fetch(input);
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    return Buffer.from(input, 'base64');
  }

  private getFontCategory(family: string): string {
    const categories: Record<string, string> = {
      'Inter': 'sans-serif',
      'Roboto': 'sans-serif',
      'Open Sans': 'sans-serif',
      'Playfair Display': 'serif',
      'Merriweather': 'serif',
      'Lora': 'serif',
      'JetBrains Mono': 'monospace',
      'Fira Code': 'monospace',
      'Bebas Neue': 'display',
      'Anton': 'display',
    };
    return categories[family] || 'sans-serif';
  }

  private getFontUseCases(family: string): string[] {
    const useCases: Record<string, string[]> = {
      'Inter': ['body', 'ui', 'labels'],
      'Roboto': ['body', 'ui', 'mobile'],
      'Playfair Display': ['headings', 'titles', 'editorial'],
      'Merriweather': ['body', 'reading', 'articles'],
      'JetBrains Mono': ['code', 'technical', 'data'],
      'Bebas Neue': ['headlines', 'posters', 'impact'],
    };
    return useCases[family] || ['general'];
  }
}

// ============================================================================
// Singleton & Export
// ============================================================================

let pipelineInstance: PremiumTextPipeline | null = null;

export function getPremiumTextPipeline(apiKey?: string): PremiumTextPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new PremiumTextPipeline(apiKey);
  }
  return pipelineInstance;
}

export default PremiumTextPipeline;
