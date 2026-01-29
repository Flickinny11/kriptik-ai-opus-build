/**
 * Text Region Manager - Prevents FLUX Text Artifacts
 *
 * Manages the entire text rendering pipeline to prevent the common problem
 * of FLUX generating garbled text that conflicts with our perfect overlay.
 *
 * Strategy:
 * 1. PRE-GENERATION: Modify prompts to avoid text generation
 * 2. GENERATION: Use negative prompts and text placeholders
 * 3. POST-GENERATION: Detect and clean up any text artifacts
 * 4. OVERLAY: Apply perfect text with intelligent blending
 *
 * This ensures text always looks clean and intentional, never like
 * a hasty overlay on top of garbled AI text.
 */

import sharp from 'sharp';
import type { UISceneBlueprint, UIComponent, BoundingBox } from './ui-blueprint-service.js';
import { getTextOverlayRenderer, type TextMaskResult } from './text-overlay-renderer.js';

// ============================================================================
// Types
// ============================================================================

export interface TextRegion {
  /** Unique identifier */
  id: string;
  /** Component this text belongs to */
  componentId: string;
  /** Bounding box in pixels */
  bounds: { x: number; y: number; width: number; height: number };
  /** The actual text to render */
  text: string;
  /** Type of text element */
  type: 'heading' | 'body' | 'button' | 'label' | 'placeholder' | 'badge';
  /** Importance (affects cleanup aggressiveness) */
  importance: 'critical' | 'high' | 'medium' | 'low';
}

export interface PromptModification {
  /** Modified positive prompt */
  positivePrompt: string;
  /** Negative prompt additions */
  negativePromptAdditions: string[];
  /** Regions to mask during generation (FLUX ControlNet) */
  maskRegions: Array<{ x: number; y: number; width: number; height: number }>;
  /** Placeholder descriptions for text areas */
  placeholderDescriptions: string[];
}

export interface CleanupAnalysis {
  /** Whether text artifacts were detected */
  artifactsDetected: boolean;
  /** Regions with detected artifacts */
  artifactRegions: Array<{ x: number; y: number; width: number; height: number; confidence: number }>;
  /** Recommended cleanup method */
  recommendedMethod: 'none' | 'blur' | 'inpaint' | 'fill' | 'regenerate';
  /** Overall confidence in analysis */
  confidence: number;
}

export interface TextRegionManagerConfig {
  /** Aggressiveness of text artifact detection (0-1) */
  detectionSensitivity: number;
  /** Whether to use AI-based artifact detection */
  useAIDetection: boolean;
  /** Default cleanup method */
  defaultCleanupMethod: 'blur' | 'inpaint' | 'fill';
  /** Padding around text regions for cleanup */
  cleanupPadding: number;
  /** Background sampling size for color matching */
  backgroundSampleSize: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: TextRegionManagerConfig = {
  detectionSensitivity: 0.7,
  useAIDetection: false, // Can be enabled if we have a text detection model
  defaultCleanupMethod: 'fill',
  cleanupPadding: 8,
  backgroundSampleSize: 20,
};

// ============================================================================
// Negative Prompt Templates for Text-Free Generation
// ============================================================================

const TEXT_NEGATIVE_PROMPTS = [
  'text',
  'words',
  'letters',
  'writing',
  'typography',
  'font',
  'characters',
  'alphabet',
  'numbers',
  'digits',
  'watermark',
  'logo text',
  'label text',
  'button text',
  'placeholder text',
  'lorem ipsum',
  'garbled text',
  'illegible text',
  'blurry text',
  'distorted letters',
  'misspelled words',
  'random characters',
];

// ============================================================================
// Prompt Modifications for Text-Free UI Generation
// ============================================================================

const TEXT_PLACEHOLDER_DESCRIPTIONS: Record<string, string> = {
  heading: 'clean rectangular banner area with subtle gradient background',
  button: 'solid colored pill-shaped or rectangular button shape without any text',
  label: 'small clean rectangular label area',
  input: 'empty input field with subtle border',
  badge: 'small colored circular or pill-shaped indicator',
  nav: 'navigation area with evenly spaced icon placeholders',
  card: 'content card with image placeholder and clean rectangular text areas',
};

// ============================================================================
// Text Region Manager Service
// ============================================================================

export class TextRegionManager {
  private config: TextRegionManagerConfig;
  private textRenderer = getTextOverlayRenderer();

  constructor(config: Partial<TextRegionManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // Pre-Generation: Prompt Modification
  // --------------------------------------------------------------------------

  /**
   * Modify prompts to prevent FLUX from generating text
   */
  modifyPromptForTextFreeGeneration(
    originalPrompt: string,
    blueprint: UISceneBlueprint,
    imageDimensions: { width: number; height: number }
  ): PromptModification {
    // Extract text regions from blueprint
    const textRegions = this.extractTextRegions(blueprint, imageDimensions);

    // Build placeholder descriptions
    const placeholderDescriptions = textRegions.map(region => {
      const baseDesc = TEXT_PLACEHOLDER_DESCRIPTIONS[region.type] || 'clean rectangular area';
      return `${baseDesc} at position (${Math.round(region.bounds.x)}, ${Math.round(region.bounds.y)})`;
    });

    // Modify positive prompt
    let positivePrompt = originalPrompt;

    // Remove any explicit text content mentions
    positivePrompt = positivePrompt.replace(/["']([^"']+)["']\s*(text|button|label|heading)/gi, '$2 placeholder');
    positivePrompt = positivePrompt.replace(/text\s*["']([^"']+)["']/gi, 'text placeholder area');

    // Add text-free generation instructions
    positivePrompt = `${positivePrompt}, all text areas shown as clean placeholder regions without any actual text characters, UI mockup style with text-free zones`;

    // Build negative prompt additions
    const negativePromptAdditions = [...TEXT_NEGATIVE_PROMPTS];

    // Extract any specific text from the blueprint and add to negative
    for (const component of blueprint.components) {
      if (component.label && component.label.length > 2) {
        // Add specific text to avoid
        negativePromptAdditions.push(`"${component.label}"`);
      }
    }

    // Build mask regions for text areas (for FLUX ControlNet)
    const maskRegions = textRegions.map(r => ({
      x: Math.max(0, r.bounds.x - this.config.cleanupPadding),
      y: Math.max(0, r.bounds.y - this.config.cleanupPadding),
      width: r.bounds.width + this.config.cleanupPadding * 2,
      height: r.bounds.height + this.config.cleanupPadding * 2,
    }));

    return {
      positivePrompt,
      negativePromptAdditions,
      maskRegions,
      placeholderDescriptions,
    };
  }

  /**
   * Generate a pre-generation mask image for FLUX ControlNet
   * White = areas where FLUX should NOT generate (text regions)
   * Black = areas where FLUX should generate normally
   */
  async generatePreGenerationMask(
    blueprint: UISceneBlueprint,
    dimensions: { width: number; height: number }
  ): Promise<Buffer> {
    const { width, height } = dimensions;

    // Start with black canvas (FLUX generates everywhere)
    const canvas = Buffer.alloc(width * height * 4, 0);

    // Create raw pixel buffer for the mask
    const maskData = new Uint8Array(width * height);

    // Extract and mark text regions
    const textRegions = this.extractTextRegions(blueprint, dimensions);

    for (const region of textRegions) {
      const { x, y, width: rw, height: rh } = region.bounds;
      const padding = this.config.cleanupPadding;

      // Mark region with padding (255 = white = don't generate)
      const startX = Math.max(0, Math.floor(x - padding));
      const endX = Math.min(width, Math.ceil(x + rw + padding));
      const startY = Math.max(0, Math.floor(y - padding));
      const endY = Math.min(height, Math.ceil(y + rh + padding));

      for (let py = startY; py < endY; py++) {
        for (let px = startX; px < endX; px++) {
          maskData[py * width + px] = 255;
        }
      }
    }

    // Convert to grayscale PNG
    return sharp(Buffer.from(maskData), {
      raw: { width, height, channels: 1 },
    })
      .png()
      .toBuffer();
  }

  // --------------------------------------------------------------------------
  // Post-Generation: Artifact Detection & Cleanup
  // --------------------------------------------------------------------------

  /**
   * Analyze generated image for text artifacts
   */
  async analyzeForTextArtifacts(
    imageBuffer: Buffer,
    blueprint: UISceneBlueprint
  ): Promise<CleanupAnalysis> {
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1920;
    const height = metadata.height || 1080;

    const textRegions = this.extractTextRegions(blueprint, { width, height });
    const artifactRegions: CleanupAnalysis['artifactRegions'] = [];

    // For each text region, analyze if there are artifacts
    for (const region of textRegions) {
      const { x, y, width: rw, height: rh } = region.bounds;
      const padding = this.config.cleanupPadding;

      // Extract the region from the image
      const regionBuffer = await sharp(imageBuffer)
        .extract({
          left: Math.max(0, Math.floor(x - padding)),
          top: Math.max(0, Math.floor(y - padding)),
          width: Math.min(width - Math.floor(x), Math.ceil(rw + padding * 2)),
          height: Math.min(height - Math.floor(y), Math.ceil(rh + padding * 2)),
        })
        .raw()
        .toBuffer();

      // Analyze for text-like patterns
      const artifactScore = await this.detectTextPatterns(regionBuffer, Math.ceil(rw + padding * 2), Math.ceil(rh + padding * 2));

      if (artifactScore > this.config.detectionSensitivity) {
        artifactRegions.push({
          x: Math.max(0, Math.floor(x - padding)),
          y: Math.max(0, Math.floor(y - padding)),
          width: Math.ceil(rw + padding * 2),
          height: Math.ceil(rh + padding * 2),
          confidence: artifactScore,
        });
      }
    }

    // Determine recommended cleanup method
    let recommendedMethod: CleanupAnalysis['recommendedMethod'] = 'none';
    const avgConfidence = artifactRegions.length > 0
      ? artifactRegions.reduce((sum, r) => sum + r.confidence, 0) / artifactRegions.length
      : 0;

    if (artifactRegions.length === 0) {
      recommendedMethod = 'none';
    } else if (avgConfidence > 0.9) {
      recommendedMethod = 'inpaint'; // High confidence = needs strong cleanup
    } else if (avgConfidence > 0.7) {
      recommendedMethod = 'fill'; // Medium confidence = fill with sampled color
    } else {
      recommendedMethod = 'blur'; // Low confidence = light blur might suffice
    }

    return {
      artifactsDetected: artifactRegions.length > 0,
      artifactRegions,
      recommendedMethod,
      confidence: avgConfidence,
    };
  }

  /**
   * Detect text-like patterns in an image region
   * Uses edge detection and pattern analysis
   */
  private async detectTextPatterns(
    regionBuffer: Buffer,
    width: number,
    height: number
  ): Promise<number> {
    // Convert to grayscale and analyze
    const grayscale = await sharp(regionBuffer, {
      raw: { width, height, channels: 3 },
    })
      .grayscale()
      .raw()
      .toBuffer();

    // Calculate variance (text tends to have high local variance)
    let sum = 0;
    let sumSq = 0;
    const pixels = grayscale.length;

    for (let i = 0; i < pixels; i++) {
      const val = grayscale[i];
      sum += val;
      sumSq += val * val;
    }

    const mean = sum / pixels;
    const variance = (sumSq / pixels) - (mean * mean);

    // Calculate horizontal edge density (text has many vertical edges)
    let edgeCount = 0;
    const threshold = 30;

    for (let y = 0; y < height; y++) {
      for (let x = 1; x < width; x++) {
        const diff = Math.abs(grayscale[y * width + x] - grayscale[y * width + x - 1]);
        if (diff > threshold) edgeCount++;
      }
    }

    const edgeDensity = edgeCount / (width * height);

    // Text typically has:
    // - Moderate to high variance (20-60 range normalized)
    // - High horizontal edge density (0.1-0.3 range)
    const varianceScore = Math.min(1, variance / 2000);
    const edgeScore = Math.min(1, edgeDensity / 0.15);

    // Combined score - high variance AND high edges suggests text
    const textLikelihood = (varianceScore * 0.4 + edgeScore * 0.6);

    return textLikelihood;
  }

  /**
   * Clean up text artifacts from generated image
   */
  async cleanupTextArtifacts(
    imageBuffer: Buffer,
    analysis: CleanupAnalysis,
    blueprint: UISceneBlueprint
  ): Promise<Buffer> {
    if (!analysis.artifactsDetected || analysis.recommendedMethod === 'none') {
      return imageBuffer;
    }

    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1920;
    const height = metadata.height || 1080;

    let cleanedBuffer = imageBuffer;

    switch (analysis.recommendedMethod) {
      case 'blur':
        cleanedBuffer = await this.applyLocalBlur(imageBuffer, analysis.artifactRegions);
        break;

      case 'fill':
        cleanedBuffer = await this.applyColorFill(imageBuffer, analysis.artifactRegions, width, height);
        break;

      case 'inpaint':
        // For now, use fill as fallback. Full inpainting requires FLUX Fill endpoint
        cleanedBuffer = await this.applyColorFill(imageBuffer, analysis.artifactRegions, width, height);
        break;

      case 'regenerate':
        // Would trigger full regeneration - handled at higher level
        console.warn('[TextRegionManager] Regeneration recommended but not supported here');
        break;
    }

    return cleanedBuffer;
  }

  /**
   * Apply local blur to artifact regions
   */
  private async applyLocalBlur(
    imageBuffer: Buffer,
    regions: CleanupAnalysis['artifactRegions']
  ): Promise<Buffer> {
    let result = sharp(imageBuffer);

    // Create blur mask
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1920;
    const height = metadata.height || 1080;

    // For each region, extract, blur, and composite back
    const composites: sharp.OverlayOptions[] = [];

    for (const region of regions) {
      const { x, y, width: rw, height: rh } = region;

      // Ensure region is within bounds
      const safeX = Math.max(0, Math.min(x, width - 1));
      const safeY = Math.max(0, Math.min(y, height - 1));
      const safeW = Math.min(rw, width - safeX);
      const safeH = Math.min(rh, height - safeY);

      if (safeW <= 0 || safeH <= 0) continue;

      // Extract, blur, and prepare for composite
      const blurredRegion = await sharp(imageBuffer)
        .extract({ left: safeX, top: safeY, width: safeW, height: safeH })
        .blur(8 + region.confidence * 8) // More blur for higher confidence artifacts
        .toBuffer();

      composites.push({
        input: blurredRegion,
        left: safeX,
        top: safeY,
      });
    }

    if (composites.length > 0) {
      result = result.composite(composites);
    }

    return result.png().toBuffer();
  }

  /**
   * Apply color fill to artifact regions (samples surrounding colors)
   */
  private async applyColorFill(
    imageBuffer: Buffer,
    regions: CleanupAnalysis['artifactRegions'],
    width: number,
    height: number
  ): Promise<Buffer> {
    let result = sharp(imageBuffer);
    const composites: sharp.OverlayOptions[] = [];

    for (const region of regions) {
      const { x, y, width: rw, height: rh } = region;

      // Sample colors from surrounding area
      const sampleSize = this.config.backgroundSampleSize;
      const sampledColor = await this.sampleSurroundingColor(
        imageBuffer,
        x, y, rw, rh,
        sampleSize,
        width, height
      );

      // Create a gradient fill that blends with surroundings
      const fillBuffer = await this.createGradientFill(
        Math.ceil(rw), Math.ceil(rh),
        sampledColor
      );

      composites.push({
        input: fillBuffer,
        left: Math.max(0, Math.floor(x)),
        top: Math.max(0, Math.floor(y)),
        blend: 'over',
      });
    }

    if (composites.length > 0) {
      result = result.composite(composites);
    }

    return result.png().toBuffer();
  }

  /**
   * Sample dominant color from area surrounding a region
   */
  private async sampleSurroundingColor(
    imageBuffer: Buffer,
    x: number, y: number,
    width: number, height: number,
    sampleSize: number,
    imgWidth: number, imgHeight: number
  ): Promise<{ r: number; g: number; b: number }> {
    // Sample from edges of the region
    const samples: Array<{ r: number; g: number; b: number }> = [];

    const sampleRegions = [
      // Top edge
      { x: Math.max(0, x), y: Math.max(0, y - sampleSize), w: width, h: sampleSize },
      // Bottom edge
      { x: Math.max(0, x), y: Math.min(imgHeight - sampleSize, y + height), w: width, h: sampleSize },
      // Left edge
      { x: Math.max(0, x - sampleSize), y: Math.max(0, y), w: sampleSize, h: height },
      // Right edge
      { x: Math.min(imgWidth - sampleSize, x + width), y: Math.max(0, y), w: sampleSize, h: height },
    ];

    for (const sr of sampleRegions) {
      if (sr.w <= 0 || sr.h <= 0) continue;

      try {
        const stats = await sharp(imageBuffer)
          .extract({
            left: Math.floor(sr.x),
            top: Math.floor(sr.y),
            width: Math.max(1, Math.floor(sr.w)),
            height: Math.max(1, Math.floor(sr.h)),
          })
          .stats();

        samples.push({
          r: Math.round(stats.channels[0]?.mean || 128),
          g: Math.round(stats.channels[1]?.mean || 128),
          b: Math.round(stats.channels[2]?.mean || 128),
        });
      } catch (e) {
        // Skip failed samples
      }
    }

    // Average the samples
    if (samples.length === 0) {
      return { r: 128, g: 128, b: 128 };
    }

    return {
      r: Math.round(samples.reduce((s, c) => s + c.r, 0) / samples.length),
      g: Math.round(samples.reduce((s, c) => s + c.g, 0) / samples.length),
      b: Math.round(samples.reduce((s, c) => s + c.b, 0) / samples.length),
    };
  }

  /**
   * Create a gradient fill buffer with soft edges
   */
  private async createGradientFill(
    width: number,
    height: number,
    color: { r: number; g: number; b: number }
  ): Promise<Buffer> {
    // Create solid color with soft vignette edges for blending
    const edgeSize = Math.min(20, Math.min(width, height) / 4);

    // Create the base fill
    const fill = await sharp({
      create: {
        width: Math.max(1, width),
        height: Math.max(1, height),
        channels: 4,
        background: { r: color.r, g: color.g, b: color.b, alpha: 255 },
      },
    })
      .png()
      .toBuffer();

    // Create soft edge mask (alpha gradient at edges)
    const maskData = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Calculate distance from edges
        const distFromLeft = x;
        const distFromRight = width - 1 - x;
        const distFromTop = y;
        const distFromBottom = height - 1 - y;

        const minDist = Math.min(distFromLeft, distFromRight, distFromTop, distFromBottom);

        // Create soft edge (0-255 alpha based on distance)
        const alpha = minDist >= edgeSize ? 255 : Math.round((minDist / edgeSize) * 255);
        maskData[y * width + x] = alpha;
      }
    }

    // Apply mask to fill
    const mask = await sharp(Buffer.from(maskData), {
      raw: { width, height, channels: 1 },
    })
      .blur(Math.max(1, edgeSize / 2)) // Soften the edges
      .toBuffer();

    // Composite fill with mask
    return sharp(fill)
      .joinChannel(mask)
      .png()
      .toBuffer();
  }

  // --------------------------------------------------------------------------
  // Text Region Extraction
  // --------------------------------------------------------------------------

  /**
   * Extract text regions from blueprint
   */
  extractTextRegions(
    blueprint: UISceneBlueprint,
    imageDimensions: { width: number; height: number }
  ): TextRegion[] {
    const regions: TextRegion[] = [];
    const { width, height } = imageDimensions;

    for (const component of blueprint.components) {
      // Skip non-text components
      if (!this.isTextComponent(component)) continue;

      // Skip components without text
      if (!component.label?.trim() && !component.placeholder?.trim()) continue;

      // Convert percentage bounds to pixels
      const bounds = {
        x: (component.bounds.x / 100) * width,
        y: (component.bounds.y / 100) * height,
        width: (component.bounds.width / 100) * width,
        height: (component.bounds.height / 100) * height,
      };

      // Add main text region
      if (component.label?.trim()) {
        regions.push({
          id: `${component.id}-label`,
          componentId: component.id,
          bounds,
          text: component.label,
          type: this.getTextType(component.type),
          importance: this.getTextImportance(component.type),
        });
      }

      // Add placeholder region for inputs
      if (component.placeholder?.trim() && (component.type === 'input' || component.type === 'textarea')) {
        regions.push({
          id: `${component.id}-placeholder`,
          componentId: component.id,
          bounds: {
            ...bounds,
            x: bounds.x + 10, // Slight offset for placeholder
            width: bounds.width - 20,
          },
          text: component.placeholder,
          type: 'placeholder',
          importance: 'low',
        });
      }
    }

    return regions;
  }

  /**
   * Check if component contains text
   */
  private isTextComponent(component: UIComponent): boolean {
    const textTypes = ['text', 'heading', 'button', 'input', 'textarea', 'select', 'badge', 'tab', 'nav'];
    return textTypes.includes(component.type);
  }

  /**
   * Get text type from component type
   */
  private getTextType(componentType: string): TextRegion['type'] {
    const typeMap: Record<string, TextRegion['type']> = {
      heading: 'heading',
      text: 'body',
      button: 'button',
      input: 'label',
      textarea: 'label',
      badge: 'badge',
      tab: 'label',
      nav: 'label',
      select: 'label',
    };
    return typeMap[componentType] || 'body';
  }

  /**
   * Get text importance from component type
   */
  private getTextImportance(componentType: string): TextRegion['importance'] {
    const importanceMap: Record<string, TextRegion['importance']> = {
      heading: 'critical',
      button: 'high',
      nav: 'high',
      text: 'medium',
      badge: 'medium',
      input: 'low',
      textarea: 'low',
    };
    return importanceMap[componentType] || 'medium';
  }
}

// ============================================================================
// Complete Text Rendering Pipeline
// ============================================================================

/**
 * Complete pipeline for generating UI images with perfect text
 */
export class TextFreePipeline {
  private regionManager: TextRegionManager;
  private textRenderer = getTextOverlayRenderer();

  constructor(config?: Partial<TextRegionManagerConfig>) {
    this.regionManager = new TextRegionManager(config);
  }

  /**
   * Prepare for text-free image generation
   */
  prepareGeneration(
    prompt: string,
    blueprint: UISceneBlueprint,
    dimensions: { width: number; height: number }
  ): {
    modifiedPrompt: string;
    negativePrompt: string;
    preMask: Promise<Buffer>;
    textRegions: TextRegion[];
  } {
    const modification = this.regionManager.modifyPromptForTextFreeGeneration(
      prompt,
      blueprint,
      dimensions
    );

    return {
      modifiedPrompt: modification.positivePrompt,
      negativePrompt: modification.negativePromptAdditions.join(', '),
      preMask: this.regionManager.generatePreGenerationMask(blueprint, dimensions),
      textRegions: this.regionManager.extractTextRegions(blueprint, dimensions),
    };
  }

  /**
   * Post-process generated image and overlay perfect text
   */
  async postProcessAndOverlay(
    generatedImage: Buffer,
    blueprint: UISceneBlueprint,
    dimensions?: { width: number; height: number }
  ): Promise<{
    finalImage: Buffer;
    cleanupPerformed: boolean;
    artifactsFound: number;
  }> {
    // Get image dimensions
    const metadata = await sharp(generatedImage).metadata();
    const width = dimensions?.width || metadata.width || 1920;
    const height = dimensions?.height || metadata.height || 1080;

    // Analyze for text artifacts
    const analysis = await this.regionManager.analyzeForTextArtifacts(generatedImage, blueprint);

    // Clean up artifacts if found
    let cleanedImage = generatedImage;
    if (analysis.artifactsDetected) {
      cleanedImage = await this.regionManager.cleanupTextArtifacts(
        generatedImage,
        analysis,
        blueprint
      );
    }

    // Render perfect text overlay
    const textOverlay = await this.textRenderer.renderFromBlueprint({
      blueprint,
      dimensions: { width, height },
    });

    // Composite text over cleaned image
    const finalImage = await sharp(cleanedImage)
      .composite([
        {
          input: textOverlay.imageBuffer,
          blend: 'over',
        },
      ])
      .png()
      .toBuffer();

    return {
      finalImage,
      cleanupPerformed: analysis.artifactsDetected,
      artifactsFound: analysis.artifactRegions.length,
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

let regionManagerInstance: TextRegionManager | null = null;
let pipelineInstance: TextFreePipeline | null = null;

export function getTextRegionManager(config?: Partial<TextRegionManagerConfig>): TextRegionManager {
  if (!regionManagerInstance) {
    regionManagerInstance = new TextRegionManager(config);
  }
  return regionManagerInstance;
}

export function getTextFreePipeline(config?: Partial<TextRegionManagerConfig>): TextFreePipeline {
  if (!pipelineInstance) {
    pipelineInstance = new TextFreePipeline(config);
  }
  return pipelineInstance;
}

export default TextRegionManager;
