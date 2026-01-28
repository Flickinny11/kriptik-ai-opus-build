/**
 * Text Overlay Renderer - Blueprint-Guided Text Rendering
 *
 * Renders text elements from UISceneBlueprint using system fonts (node-canvas)
 * for perfect text accuracy. This solves FLUX's ~60% text accuracy problem by:
 *
 * 1. Generating UI images WITHOUT text content (placeholder regions)
 * 2. Rendering text using precise system fonts (Inter, SF Pro, JetBrains Mono)
 * 3. Creating transparent PNG layers for seamless blending
 *
 * Based on research:
 * - FLUX-Text Scene Text Editing (arxiv:2505.03329)
 * - FreeText Training-Free Text Rendering (arxiv:2601.00535)
 *
 * Target: 98%+ text accuracy (vs 60% baseline FLUX text rendering)
 */

import { createCanvas, registerFont, type Canvas, type CanvasRenderingContext2D } from 'canvas';
import * as path from 'path';
import * as fs from 'fs';
import type {
  UISceneBlueprint,
  UIComponent,
  BoundingBox,
  UIStyleContext,
} from './ui-blueprint-service.js';

// ============================================================================
// Configuration
// ============================================================================

/** Font weight mapping type */
type FontWeightMap = Record<string, number>;

/** Font family configuration type */
interface FontFamilyConfig {
  family: string;
  fallback: string;
  weights: FontWeightMap;
}

/** Font configuration for KripTik Design System */
const FONT_CONFIG: Record<string, FontFamilyConfig> = {
  /** Primary body text, labels, UI elements */
  primary: {
    family: 'Inter',
    fallback: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  /** Headers, display text, hero elements */
  heading: {
    family: 'SF Pro Display',
    fallback: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      heavy: 800,
    },
  },
  /** Code, technical text, monospace elements */
  mono: {
    family: 'JetBrains Mono',
    fallback: 'SF Mono, Menlo, Monaco, Consolas, monospace',
    weights: {
      regular: 400,
      medium: 500,
      bold: 700,
    },
  },
  /** Modern accent text, special UI elements */
  accent: {
    family: 'Plus Jakarta Sans',
    fallback: 'Inter, system-ui, sans-serif',
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
};

/** Font paths for registration */
const FONT_PATHS = {
  Inter: {
    regular: 'Inter-Regular.ttf',
    medium: 'Inter-Medium.ttf',
    semibold: 'Inter-SemiBold.ttf',
    bold: 'Inter-Bold.ttf',
  },
  'SF Pro Display': {
    regular: 'SFProDisplay-Regular.otf',
    medium: 'SFProDisplay-Medium.otf',
    semibold: 'SFProDisplay-Semibold.otf',
    bold: 'SFProDisplay-Bold.otf',
    heavy: 'SFProDisplay-Heavy.otf',
  },
  'JetBrains Mono': {
    regular: 'JetBrainsMono-Regular.ttf',
    medium: 'JetBrainsMono-Medium.ttf',
    bold: 'JetBrainsMono-Bold.ttf',
  },
  'Plus Jakarta Sans': {
    regular: 'PlusJakartaSans-Regular.ttf',
    medium: 'PlusJakartaSans-Medium.ttf',
    semibold: 'PlusJakartaSans-SemiBold.ttf',
    bold: 'PlusJakartaSans-Bold.ttf',
  },
};

/** Default platform dimensions */
const PLATFORM_DIMENSIONS: Record<string, { width: number; height: number }> = {
  web: { width: 1920, height: 1080 },
  mobile: { width: 430, height: 932 },
  tablet: { width: 1024, height: 1366 },
};

// ============================================================================
// Types
// ============================================================================

export interface TextElement {
  /** Unique identifier */
  id: string;
  /** Text content to render */
  content: string;
  /** Bounding box in pixels */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Font family to use */
  fontFamily: 'primary' | 'heading' | 'mono' | 'accent';
  /** Font size in pixels */
  fontSize: number;
  /** Font weight */
  fontWeight: 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy';
  /** Text color (hex or rgba) */
  color: string;
  /** Text alignment */
  align: 'left' | 'center' | 'right';
  /** Vertical alignment */
  verticalAlign: 'top' | 'middle' | 'bottom';
  /** Line height multiplier */
  lineHeight: number;
  /** Letter spacing in pixels */
  letterSpacing: number;
  /** Maximum lines (0 = unlimited) */
  maxLines: number;
  /** Overflow behavior */
  overflow: 'visible' | 'hidden' | 'ellipsis';
  /** Optional text shadow */
  shadow?: {
    color: string;
    offsetX: number;
    offsetY: number;
    blur: number;
  };
  /** Optional text stroke/outline */
  stroke?: {
    color: string;
    width: number;
  };
  /** Rotation in degrees */
  rotation?: number;
  /** Opacity 0-1 */
  opacity: number;
}

export interface TextOverlayRequest {
  /** Blueprint to extract text from */
  blueprint: UISceneBlueprint;
  /** Output image dimensions */
  dimensions?: { width: number; height: number };
  /** Style overrides */
  styleOverrides?: Partial<TextRenderStyle>;
  /** Only render specific component IDs */
  componentFilter?: string[];
}

export interface TextRenderStyle {
  /** Default font size scale (1.0 = 100%) */
  fontScale: number;
  /** Default text color (used when not specified) */
  defaultTextColor: string;
  /** Default heading color */
  defaultHeadingColor: string;
  /** Default button text color */
  defaultButtonTextColor: string;
  /** Default input text color */
  defaultInputTextColor: string;
  /** Default placeholder color */
  defaultPlaceholderColor: string;
  /** Anti-aliasing mode */
  antialiasing: 'default' | 'subpixel' | 'grayscale';
}

export interface TextOverlayResult {
  /** Transparent PNG buffer with rendered text */
  imageBuffer: Buffer;
  /** Width of the image */
  width: number;
  /** Height of the image */
  height: number;
  /** Text elements that were rendered */
  renderedElements: TextElement[];
  /** Elements that failed to render */
  failedElements: Array<{ id: string; error: string }>;
  /** Rendering time in ms */
  renderTime: number;
}

export interface TextMaskResult {
  /** Mask image (white text regions on black background) */
  maskBuffer: Buffer;
  /** Text regions with bounding boxes */
  regions: Array<{
    id: string;
    bounds: { x: number; y: number; width: number; height: number };
  }>;
}

// ============================================================================
// Default Styles
// ============================================================================

const DEFAULT_TEXT_STYLE: TextRenderStyle = {
  fontScale: 1.0,
  defaultTextColor: '#ffffff',
  defaultHeadingColor: '#ffffff',
  defaultButtonTextColor: '#ffffff',
  defaultInputTextColor: '#e5e7eb',
  defaultPlaceholderColor: '#9ca3af',
  antialiasing: 'subpixel',
};

const DARK_THEME_COLORS = {
  text: '#ffffff',
  heading: '#ffffff',
  button: '#ffffff',
  input: '#e5e7eb',
  placeholder: '#6b7280',
  muted: '#9ca3af',
  accent: '#3b82f6',
};

const LIGHT_THEME_COLORS = {
  text: '#111827',
  heading: '#111827',
  button: '#ffffff',
  input: '#374151',
  placeholder: '#9ca3af',
  muted: '#6b7280',
  accent: '#2563eb',
};

// ============================================================================
// Text Overlay Renderer Implementation
// ============================================================================

export class TextOverlayRenderer {
  private fontsRegistered = false;
  private fontDir: string;

  constructor(fontDirectory?: string) {
    this.fontDir = fontDirectory || path.join(process.cwd(), 'assets', 'fonts');
  }

  /**
   * Register system fonts for rendering
   */
  async registerFonts(): Promise<void> {
    if (this.fontsRegistered) return;

    // Check if font directory exists
    if (!fs.existsSync(this.fontDir)) {
      console.warn(`[TextOverlay] Font directory not found: ${this.fontDir}`);
      console.warn('[TextOverlay] Using system fallback fonts');
      this.fontsRegistered = true;
      return;
    }

    // Register each font
    for (const [family, weights] of Object.entries(FONT_PATHS)) {
      for (const [weight, filename] of Object.entries(weights)) {
        const fontPath = path.join(this.fontDir, filename);
        if (fs.existsSync(fontPath)) {
          try {
            registerFont(fontPath, { family, weight });
            console.log(`[TextOverlay] Registered: ${family} ${weight}`);
          } catch (error) {
            console.warn(`[TextOverlay] Failed to register ${family} ${weight}:`, error);
          }
        }
      }
    }

    this.fontsRegistered = true;
  }

  /**
   * Render text overlay from blueprint
   */
  async renderFromBlueprint(request: TextOverlayRequest): Promise<TextOverlayResult> {
    const startTime = Date.now();
    await this.registerFonts();

    const { blueprint, dimensions, styleOverrides, componentFilter } = request;

    // Determine dimensions
    const { width, height } = dimensions || PLATFORM_DIMENSIONS[blueprint.platform] || PLATFORM_DIMENSIONS.web;

    // Create transparent canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Extract text elements from blueprint
    const textElements = this.extractTextElements(
      blueprint,
      { width, height },
      styleOverrides,
      componentFilter
    );

    const renderedElements: TextElement[] = [];
    const failedElements: Array<{ id: string; error: string }> = [];

    // Render each text element
    for (const element of textElements) {
      try {
        this.renderTextElement(ctx, element);
        renderedElements.push(element);
      } catch (error) {
        failedElements.push({
          id: element.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Export as PNG buffer
    const imageBuffer = canvas.toBuffer('image/png');

    return {
      imageBuffer,
      width,
      height,
      renderedElements,
      failedElements,
      renderTime: Date.now() - startTime,
    };
  }

  /**
   * Generate text mask for inpainting (white text regions on black)
   */
  async generateTextMask(request: TextOverlayRequest): Promise<TextMaskResult> {
    await this.registerFonts();

    const { blueprint, dimensions } = request;
    const { width, height } = dimensions || PLATFORM_DIMENSIONS[blueprint.platform] || PLATFORM_DIMENSIONS.web;

    // Create black canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Extract text elements
    const textElements = this.extractTextElements(blueprint, { width, height });

    const regions: TextMaskResult['regions'] = [];

    // Render white rectangles for each text region
    ctx.fillStyle = '#ffffff';
    for (const element of textElements) {
      // Add padding for inpainting margin
      const padding = 4;
      const x = Math.max(0, element.bounds.x - padding);
      const y = Math.max(0, element.bounds.y - padding);
      const w = Math.min(width - x, element.bounds.width + padding * 2);
      const h = Math.min(height - y, element.bounds.height + padding * 2);

      ctx.fillRect(x, y, w, h);

      regions.push({
        id: element.id,
        bounds: { x, y, width: w, height: h },
      });
    }

    const maskBuffer = canvas.toBuffer('image/png');

    return { maskBuffer, regions };
  }

  /**
   * Render single text element to a buffer
   */
  async renderSingleElement(element: TextElement): Promise<Buffer> {
    await this.registerFonts();

    // Create canvas sized to element bounds with padding
    const padding = 10;
    const canvas = createCanvas(
      element.bounds.width + padding * 2,
      element.bounds.height + padding * 2
    );
    const ctx = canvas.getContext('2d');

    // Adjust element position for local canvas
    const localElement = {
      ...element,
      bounds: {
        ...element.bounds,
        x: padding,
        y: padding,
      },
    };

    this.renderTextElement(ctx, localElement);

    return canvas.toBuffer('image/png');
  }

  /**
   * Extract text elements from blueprint components
   */
  private extractTextElements(
    blueprint: UISceneBlueprint,
    imageDimensions: { width: number; height: number },
    styleOverrides?: Partial<TextRenderStyle>,
    componentFilter?: string[]
  ): TextElement[] {
    const style = { ...DEFAULT_TEXT_STYLE, ...styleOverrides };
    const themeColors = blueprint.styleContext.colorScheme === 'light' ? LIGHT_THEME_COLORS : DARK_THEME_COLORS;
    const elements: TextElement[] = [];

    for (const component of blueprint.components) {
      // Skip if filtered out
      if (componentFilter && !componentFilter.includes(component.id)) {
        continue;
      }

      // Skip non-text components
      if (!this.isTextComponent(component)) {
        continue;
      }

      // Skip empty labels
      if (!component.label?.trim()) {
        continue;
      }

      // Convert percentage bounds to pixels
      const pixelBounds = this.percentToPixels(component.bounds, imageDimensions);

      // Determine text styling based on component type
      const textElement = this.componentToTextElement(
        component,
        pixelBounds,
        style,
        themeColors,
        blueprint.styleContext
      );

      if (textElement) {
        elements.push(textElement);
      }

      // Handle placeholder text for inputs
      if (component.placeholder && (component.type === 'input' || component.type === 'textarea')) {
        const placeholderElement = this.createPlaceholderElement(
          component,
          pixelBounds,
          style,
          themeColors
        );
        if (placeholderElement) {
          elements.push(placeholderElement);
        }
      }
    }

    return elements;
  }

  /**
   * Check if component contains renderable text
   */
  private isTextComponent(component: UIComponent): boolean {
    const textTypes = [
      'text',
      'heading',
      'button',
      'input',
      'textarea',
      'select',
      'badge',
      'tab',
      'nav',
    ];
    return textTypes.includes(component.type);
  }

  /**
   * Convert component to TextElement
   */
  private componentToTextElement(
    component: UIComponent,
    bounds: TextElement['bounds'],
    style: TextRenderStyle,
    colors: typeof DARK_THEME_COLORS,
    styleContext: UIStyleContext
  ): TextElement | null {
    const baseElement: Partial<TextElement> = {
      id: component.id,
      content: component.label,
      bounds,
      lineHeight: 1.4,
      letterSpacing: 0,
      maxLines: 0,
      overflow: 'ellipsis',
      opacity: 1,
    };

    switch (component.type) {
      case 'heading':
        return {
          ...baseElement,
          fontFamily: 'heading',
          fontSize: this.calculateHeadingSize(bounds.height, style.fontScale),
          fontWeight: 'bold',
          color: colors.heading,
          align: 'left',
          verticalAlign: 'middle',
          lineHeight: 1.2,
        } as TextElement;

      case 'text':
        return {
          ...baseElement,
          fontFamily: 'primary',
          fontSize: this.calculateBodySize(bounds.height, style.fontScale),
          fontWeight: 'regular',
          color: colors.text,
          align: 'left',
          verticalAlign: 'top',
        } as TextElement;

      case 'button':
        return {
          ...baseElement,
          fontFamily: 'primary',
          fontSize: this.calculateButtonSize(bounds.height, style.fontScale),
          fontWeight: 'semibold',
          color: this.getButtonTextColor(component.style, colors),
          align: 'center',
          verticalAlign: 'middle',
          letterSpacing: 0.3,
        } as TextElement;

      case 'input':
      case 'textarea':
        // For inputs, we render the label above the input (if present)
        return null; // Labels handled separately, placeholder below

      case 'badge':
        return {
          ...baseElement,
          fontFamily: 'primary',
          fontSize: Math.min(14 * style.fontScale, bounds.height * 0.6),
          fontWeight: 'medium',
          color: colors.button,
          align: 'center',
          verticalAlign: 'middle',
          letterSpacing: 0.5,
        } as TextElement;

      case 'tab':
      case 'nav':
        return {
          ...baseElement,
          fontFamily: 'primary',
          fontSize: this.calculateBodySize(bounds.height, style.fontScale),
          fontWeight: 'medium',
          color: colors.text,
          align: 'center',
          verticalAlign: 'middle',
        } as TextElement;

      case 'select':
        return {
          ...baseElement,
          fontFamily: 'primary',
          fontSize: this.calculateBodySize(bounds.height, style.fontScale),
          fontWeight: 'regular',
          color: colors.input,
          align: 'left',
          verticalAlign: 'middle',
        } as TextElement;

      default:
        return null;
    }
  }

  /**
   * Create placeholder text element for inputs
   */
  private createPlaceholderElement(
    component: UIComponent,
    bounds: TextElement['bounds'],
    style: TextRenderStyle,
    colors: typeof DARK_THEME_COLORS
  ): TextElement | null {
    if (!component.placeholder) return null;

    // Adjust bounds for input padding
    const padding = Math.min(12, bounds.width * 0.03);
    const adjustedBounds = {
      x: bounds.x + padding,
      y: bounds.y,
      width: bounds.width - padding * 2,
      height: bounds.height,
    };

    return {
      id: `${component.id}-placeholder`,
      content: component.placeholder,
      bounds: adjustedBounds,
      fontFamily: 'primary',
      fontSize: this.calculateBodySize(bounds.height, style.fontScale),
      fontWeight: 'regular',
      color: colors.placeholder,
      align: 'left',
      verticalAlign: 'middle',
      lineHeight: 1.4,
      letterSpacing: 0,
      maxLines: 1,
      overflow: 'ellipsis',
      opacity: 0.7,
    };
  }

  /**
   * Calculate heading font size based on container height
   */
  private calculateHeadingSize(containerHeight: number, scale: number): number {
    // Heading should fill ~60-70% of container height
    const baseSize = containerHeight * 0.65;
    return Math.max(16, Math.min(72, baseSize)) * scale;
  }

  /**
   * Calculate body text font size based on container height
   */
  private calculateBodySize(containerHeight: number, scale: number): number {
    // Body text should fill ~40-50% of container height
    const baseSize = containerHeight * 0.45;
    return Math.max(12, Math.min(24, baseSize)) * scale;
  }

  /**
   * Calculate button text font size
   */
  private calculateButtonSize(containerHeight: number, scale: number): number {
    // Button text should fill ~35-45% of container height
    const baseSize = containerHeight * 0.4;
    return Math.max(12, Math.min(20, baseSize)) * scale;
  }

  /**
   * Get button text color based on style variant
   */
  private getButtonTextColor(
    style: UIComponent['style'],
    colors: typeof DARK_THEME_COLORS
  ): string {
    switch (style) {
      case 'primary':
        return colors.button;
      case 'secondary':
        return colors.text;
      case 'ghost':
        return colors.text;
      case 'destructive':
        return colors.button;
      case 'outline':
        return colors.accent;
      case 'link':
        return colors.accent;
      default:
        return colors.button;
    }
  }

  /**
   * Convert percentage bounds to pixel bounds
   */
  private percentToPixels(
    bounds: BoundingBox,
    imageDimensions: { width: number; height: number }
  ): TextElement['bounds'] {
    return {
      x: (bounds.x / 100) * imageDimensions.width,
      y: (bounds.y / 100) * imageDimensions.height,
      width: (bounds.width / 100) * imageDimensions.width,
      height: (bounds.height / 100) * imageDimensions.height,
    };
  }

  /**
   * Render text element to canvas context
   */
  private renderTextElement(ctx: CanvasRenderingContext2D, element: TextElement): void {
    ctx.save();

    // Apply rotation if specified
    if (element.rotation) {
      const centerX = element.bounds.x + element.bounds.width / 2;
      const centerY = element.bounds.y + element.bounds.height / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((element.rotation * Math.PI) / 180);
      ctx.translate(-centerX, -centerY);
    }

    // Apply opacity
    ctx.globalAlpha = element.opacity;

    // Set font
    const fontConfig = FONT_CONFIG[element.fontFamily];
    const weight = fontConfig.weights[element.fontWeight] || 400;
    ctx.font = `${weight} ${element.fontSize}px "${fontConfig.family}", ${fontConfig.fallback}`;

    // Set text alignment
    ctx.textAlign = element.align;

    // Calculate text position
    const { x, y } = this.calculateTextPosition(ctx, element);

    // Apply shadow if specified
    if (element.shadow) {
      ctx.shadowColor = element.shadow.color;
      ctx.shadowOffsetX = element.shadow.offsetX;
      ctx.shadowOffsetY = element.shadow.offsetY;
      ctx.shadowBlur = element.shadow.blur;
    }

    // Apply stroke if specified
    if (element.stroke) {
      ctx.strokeStyle = element.stroke.color;
      ctx.lineWidth = element.stroke.width;
      ctx.strokeText(element.content, x, y, element.bounds.width);
    }

    // Render text
    ctx.fillStyle = element.color;

    // Handle multi-line text
    if (element.content.includes('\n') || element.maxLines > 1) {
      this.renderMultilineText(ctx, element, x, y);
    } else {
      // Single line with optional ellipsis
      const text = this.truncateText(ctx, element.content, element.bounds.width, element.overflow);
      ctx.fillText(text, x, y);
    }

    ctx.restore();
  }

  /**
   * Calculate text position based on alignment
   */
  private calculateTextPosition(
    ctx: CanvasRenderingContext2D,
    element: TextElement
  ): { x: number; y: number } {
    let x: number;
    let y: number;

    // Horizontal position
    switch (element.align) {
      case 'left':
        x = element.bounds.x;
        break;
      case 'center':
        x = element.bounds.x + element.bounds.width / 2;
        break;
      case 'right':
        x = element.bounds.x + element.bounds.width;
        break;
      default:
        x = element.bounds.x;
    }

    // Vertical position
    const lineHeight = element.fontSize * element.lineHeight;
    switch (element.verticalAlign) {
      case 'top':
        y = element.bounds.y + element.fontSize;
        break;
      case 'middle':
        y = element.bounds.y + element.bounds.height / 2 + element.fontSize * 0.35;
        break;
      case 'bottom':
        y = element.bounds.y + element.bounds.height - lineHeight * 0.2;
        break;
      default:
        y = element.bounds.y + element.fontSize;
    }

    return { x, y };
  }

  /**
   * Render multi-line text
   */
  private renderMultilineText(
    ctx: CanvasRenderingContext2D,
    element: TextElement,
    startX: number,
    startY: number
  ): void {
    const lineHeight = element.fontSize * element.lineHeight;
    const lines = this.wrapText(ctx, element.content, element.bounds.width);

    // Apply max lines limit
    const maxLines = element.maxLines > 0 ? element.maxLines : lines.length;
    const linesToRender = lines.slice(0, maxLines);

    // Add ellipsis to last line if truncated
    if (lines.length > maxLines && element.overflow === 'ellipsis') {
      const lastLineIndex = linesToRender.length - 1;
      linesToRender[lastLineIndex] = this.truncateText(
        ctx,
        linesToRender[lastLineIndex],
        element.bounds.width,
        'ellipsis'
      );
    }

    // Render each line
    linesToRender.forEach((line, index) => {
      const y = startY + index * lineHeight;
      if (y <= element.bounds.y + element.bounds.height) {
        ctx.fillText(line, startX, y);
      }
    });
  }

  /**
   * Wrap text to fit within width
   */
  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string[] {
    const words = text.split(/(\s+)/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine + word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine.trim());
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    return lines;
  }

  /**
   * Truncate text with ellipsis if needed
   */
  private truncateText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    overflow: TextElement['overflow']
  ): string {
    if (overflow === 'visible') return text;

    const metrics = ctx.measureText(text);
    if (metrics.width <= maxWidth) return text;

    if (overflow === 'hidden') {
      let truncated = text;
      while (ctx.measureText(truncated).width > maxWidth && truncated.length > 0) {
        truncated = truncated.slice(0, -1);
      }
      return truncated;
    }

    // Ellipsis
    const ellipsis = '…';
    let truncated = text;
    while (ctx.measureText(truncated + ellipsis).width > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + ellipsis;
  }
}

// ============================================================================
// Singleton
// ============================================================================

let rendererInstance: TextOverlayRenderer | null = null;

export function getTextOverlayRenderer(fontDir?: string): TextOverlayRenderer {
  if (!rendererInstance) {
    rendererInstance = new TextOverlayRenderer(fontDir);
  }
  return rendererInstance;
}

export default TextOverlayRenderer;
