/**
 * UI Mockup Generator Service
 *
 * Orchestrates the complete UI mockup generation pipeline:
 * 1. Opus 4.5 generates UISceneBlueprint (structured layout)
 * 2. Blueprint converted to optimized image prompt
 * 3. RunPod Serverless generates image via FLUX.2-dev + UI-LoRA
 * 4. VL-JEPA extracts semantic elements from generated mockup
 *
 * This is the self-hosted Stitch-equivalent for unlimited scale UI generation.
 */

import { getUIBlueprintService, type UISceneBlueprint, type BlueprintRequest } from './ui-blueprint-service.js';
import { getUIGeneratorProvider, type UIGenerationRequest, type UIGenerationResult } from '../embeddings/providers/runpod-ui-generator.js';
import { getVisualUnderstandingService } from '../embeddings/visual-understanding-service.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface MockupRequest {
  /** Natural language description of the UI view */
  prompt: string;
  /** View/screen name */
  viewName: string;
  /** Style description (from user preferences or theme) */
  styleDescription?: string;
  /** Target platform */
  platform?: 'web' | 'mobile' | 'tablet';
  /** Style preferences */
  stylePreferences?: {
    colorScheme?: 'light' | 'dark' | 'auto';
    primaryColor?: string;
    typography?: 'modern' | 'classic' | 'playful' | 'minimal';
  };
  /** Additional context from implementation plan */
  planContext?: string;
  /** Reference existing components */
  existingComponents?: string[];
  /** Number of variations to generate */
  variations?: number;
}

export interface SemanticElement {
  /** Unique identifier */
  id: string;
  /** Element type */
  type: 'button' | 'input' | 'nav' | 'card' | 'form' | 'image' | 'text' | 'list' | 'modal' | 'header' | 'footer' | 'icon' | 'avatar' | 'badge' | 'container';
  /** Bounding box in pixels */
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Detected label/text */
  label: string;
  /** VL-JEPA embedding for matching */
  embedding: number[];
  /** Detection confidence */
  confidence: number;
  /** Suggested React component */
  suggestedComponent?: string;
  /** Matched blueprint component ID */
  blueprintMatch?: string;
}

export interface MockupResult {
  /** Unique mockup ID */
  id: string;
  /** View/screen name */
  viewName: string;
  /** Generated image as base64 */
  imageBase64: string;
  /** Image URL if stored */
  imageUrl?: string;
  /** Structured layout blueprint */
  blueprint: UISceneBlueprint;
  /** Extracted semantic elements */
  elements: SemanticElement[];
  /** View-level embedding for similarity search */
  embedding: number[];
  /** Optimized prompt used for generation */
  imagePrompt: string;
  /** Generation timestamp */
  generatedAt: Date;
  /** Total inference time (ms) */
  inferenceTime: number;
  /** Blueprint → Generated match rate */
  matchRate: number;
}

export interface MockupModification {
  /** Mockup ID to modify */
  mockupId: string;
  /** User's modification request */
  prompt: string;
  /** Specific element to modify (optional) */
  elementId?: string;
}

// ============================================================================
// UI Mockup Generator Service Implementation
// ============================================================================

export class UIMockupGeneratorService {
  private blueprintService = getUIBlueprintService();
  private uiGenerator = getUIGeneratorProvider();
  private visualUnderstanding = getVisualUnderstandingService();

  // In-memory cache for mockups (production would use database)
  private mockupCache = new Map<string, MockupResult>();

  /**
   * Generate a complete UI mockup from natural language description
   */
  async generate(request: MockupRequest): Promise<MockupResult> {
    const startTime = Date.now();
    const mockupId = uuidv4();

    console.log(`[UI-Mockup] Generating mockup for: ${request.viewName}`);

    try {
      // Step 1: Generate structured blueprint with Opus 4.5
      console.log('[UI-Mockup] Step 1: Generating blueprint...');
      const blueprintResult = await this.blueprintService.generateBlueprint({
        prompt: request.prompt,
        viewName: request.viewName,
        platform: request.platform || 'web',
        stylePreferences: request.stylePreferences,
        planContext: request.planContext,
        existingComponents: request.existingComponents,
      });

      const { blueprint, imagePrompt } = blueprintResult;

      // Step 2: Generate image with RunPod FLUX.2-dev + UI-LoRA
      console.log('[UI-Mockup] Step 2: Generating image...');
      const imageResult = await this.uiGenerator.generate({
        prompt: imagePrompt,
        platform: request.platform || 'web',
        styleDescription: request.styleDescription,
      });

      if (!imageResult.images || imageResult.images.length === 0) {
        throw new Error('No images generated');
      }

      const imageBase64 = imageResult.images[0];

      // Step 3: Analyze with VL-JEPA for semantic elements
      console.log('[UI-Mockup] Step 3: Analyzing with VL-JEPA...');
      const { elements, embedding, matchRate } = await this.analyzeWithBlueprint(
        imageBase64,
        blueprint
      );

      const result: MockupResult = {
        id: mockupId,
        viewName: request.viewName,
        imageBase64,
        blueprint,
        elements,
        embedding,
        imagePrompt,
        generatedAt: new Date(),
        inferenceTime: Date.now() - startTime,
        matchRate,
      };

      // Cache the result
      this.mockupCache.set(mockupId, result);

      console.log(`[UI-Mockup] Generated mockup ${mockupId} in ${result.inferenceTime}ms (match rate: ${(matchRate * 100).toFixed(1)}%)`);

      return result;

    } catch (error) {
      console.error('[UI-Mockup] Generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate multiple mockup variations
   */
  async generateVariations(
    request: MockupRequest,
    count: number = 3
  ): Promise<MockupResult[]> {
    const results: MockupResult[] = [];

    // Generate first with full blueprint
    const first = await this.generate(request);
    results.push(first);

    // Generate variations with same blueprint but different seeds
    for (let i = 1; i < count; i++) {
      const variation = await this.generateVariation(first, `variation ${i + 1}`);
      results.push(variation);
    }

    return results;
  }

  /**
   * Generate a variation of an existing mockup
   */
  private async generateVariation(
    original: MockupResult,
    suffix: string
  ): Promise<MockupResult> {
    const startTime = Date.now();
    const mockupId = uuidv4();

    // Use same blueprint, regenerate image
    const imageResult = await this.uiGenerator.generate({
      prompt: original.imagePrompt,
      platform: original.blueprint.platform,
      seed: -1, // Random seed for variation
    });

    if (!imageResult.images || imageResult.images.length === 0) {
      throw new Error('No images generated for variation');
    }

    const imageBase64 = imageResult.images[0];

    const { elements, embedding, matchRate } = await this.analyzeWithBlueprint(
      imageBase64,
      original.blueprint
    );

    const result: MockupResult = {
      id: mockupId,
      viewName: `${original.viewName} (${suffix})`,
      imageBase64,
      blueprint: original.blueprint,
      elements,
      embedding,
      imagePrompt: original.imagePrompt,
      generatedAt: new Date(),
      inferenceTime: Date.now() - startTime,
      matchRate,
    };

    this.mockupCache.set(mockupId, result);
    return result;
  }

  /**
   * Modify an existing mockup based on user feedback
   */
  async modify(modification: MockupModification): Promise<MockupResult> {
    const startTime = Date.now();
    const original = this.mockupCache.get(modification.mockupId);

    if (!original) {
      throw new Error(`Mockup ${modification.mockupId} not found`);
    }

    console.log(`[UI-Mockup] Modifying mockup: ${modification.prompt}`);

    // Step 1: Update blueprint with Opus 4.5
    const blueprintResult = await this.blueprintService.modifyBlueprint(
      original.blueprint,
      modification.prompt
    );

    const { blueprint, imagePrompt } = blueprintResult;

    // Step 2: Regenerate image
    const imageResult = await this.uiGenerator.generate({
      prompt: imagePrompt,
      platform: blueprint.platform,
    });

    if (!imageResult.images || imageResult.images.length === 0) {
      throw new Error('No images generated');
    }

    const imageBase64 = imageResult.images[0];

    // Step 3: Re-analyze
    const { elements, embedding, matchRate } = await this.analyzeWithBlueprint(
      imageBase64,
      blueprint
    );

    const mockupId = uuidv4();
    const result: MockupResult = {
      id: mockupId,
      viewName: original.viewName,
      imageBase64,
      blueprint,
      elements,
      embedding,
      imagePrompt,
      generatedAt: new Date(),
      inferenceTime: Date.now() - startTime,
      matchRate,
    };

    this.mockupCache.set(mockupId, result);

    console.log(`[UI-Mockup] Modified mockup ${mockupId} in ${result.inferenceTime}ms`);

    return result;
  }

  /**
   * Analyze generated image with VL-JEPA and validate against blueprint
   */
  private async analyzeWithBlueprint(
    imageBase64: string,
    blueprint: UISceneBlueprint
  ): Promise<{
    elements: SemanticElement[];
    embedding: number[];
    matchRate: number;
  }> {
    try {
      // Get VL-JEPA analysis
      const visualService = this.visualUnderstanding;

      // Generate view-level embedding
      const embedding = await visualService.generateEmbedding(imageBase64);

      // Analyze UI elements
      const detectedElements = await visualService.analyzeUIElements(imageBase64);

      // Map VL-JEPA elements to our SemanticElement interface
      const elements: SemanticElement[] = (detectedElements || []).map((el, index: number) => ({
        id: `element-${index}`,
        type: this.mapElementType(el.type || el.label),
        boundingBox: el.boundingBox || { x: 0, y: 0, width: 100, height: 100 },
        label: el.label || 'Unknown',
        embedding: [],
        confidence: el.confidence || 0.8,
        suggestedComponent: this.suggestComponent(el.type || el.label),
      }));

      // Match detected elements to blueprint components
      const blueprintComponents = blueprint.components.filter(c => c.type !== 'container');
      let matchedCount = 0;

      for (const element of elements) {
        // Find best matching blueprint component
        const match = blueprintComponents.find(c => {
          const typeMatch = c.type === element.type || this.isCompatibleType(c.type, element.type);
          const positionMatch =
            Math.abs(c.bounds.x - (element.boundingBox.x / 10)) < 15 &&
            Math.abs(c.bounds.y - (element.boundingBox.y / 10)) < 15;
          return typeMatch && positionMatch;
        });

        if (match) {
          element.blueprintMatch = match.id;
          matchedCount++;
        }
      }

      const matchRate = blueprintComponents.length > 0
        ? matchedCount / blueprintComponents.length
        : 1;

      return { elements, embedding, matchRate };

    } catch (error) {
      console.error('[UI-Mockup] VL-JEPA analysis failed:', error);
      // Return empty analysis on error (graceful degradation)
      return {
        elements: [],
        embedding: [],
        matchRate: 0,
      };
    }
  }

  /**
   * Map detected element type to our SemanticElement type
   */
  private mapElementType(detectedType: string): SemanticElement['type'] {
    const typeMap: Record<string, SemanticElement['type']> = {
      button: 'button',
      btn: 'button',
      input: 'input',
      textfield: 'input',
      text_input: 'input',
      navigation: 'nav',
      navbar: 'nav',
      card: 'card',
      form: 'form',
      image: 'image',
      img: 'image',
      photo: 'image',
      text: 'text',
      label: 'text',
      paragraph: 'text',
      list: 'list',
      listview: 'list',
      modal: 'modal',
      dialog: 'modal',
      popup: 'modal',
      header: 'header',
      footer: 'footer',
      icon: 'icon',
      avatar: 'avatar',
      badge: 'badge',
      tag: 'badge',
      container: 'container',
      div: 'container',
      section: 'container',
    };

    const normalized = detectedType.toLowerCase().replace(/[^a-z]/g, '');
    return typeMap[normalized] || 'container';
  }

  /**
   * Check if two types are compatible
   */
  private isCompatibleType(blueprintType: string, detectedType: SemanticElement['type']): boolean {
    const compatibilityMap: Record<string, string[]> = {
      button: ['button'],
      input: ['input', 'text'],
      textarea: ['input', 'text'],
      heading: ['text'],
      text: ['text', 'container'],
      nav: ['nav', 'header', 'container'],
      header: ['header', 'nav', 'container'],
      footer: ['footer', 'container'],
      card: ['card', 'container'],
      form: ['form', 'container'],
      image: ['image', 'avatar', 'icon'],
      avatar: ['avatar', 'image'],
      icon: ['icon', 'image'],
      list: ['list', 'container'],
      modal: ['modal', 'container'],
    };

    const compatible = compatibilityMap[blueprintType];
    return compatible ? compatible.includes(detectedType) : false;
  }

  /**
   * Suggest React component based on element type
   */
  private suggestComponent(elementType: string): string {
    const componentMap: Record<string, string> = {
      button: 'Button',
      input: 'Input',
      textarea: 'Textarea',
      select: 'Select',
      checkbox: 'Checkbox',
      radio: 'RadioGroup',
      switch: 'Switch',
      slider: 'Slider',
      card: 'Card',
      nav: 'NavigationMenu',
      header: 'Header',
      footer: 'Footer',
      form: 'Form',
      image: 'Image',
      avatar: 'Avatar',
      icon: 'Icon',
      text: 'Text',
      heading: 'Heading',
      list: 'List',
      table: 'Table',
      modal: 'Dialog',
      toast: 'Toast',
      badge: 'Badge',
      tab: 'Tabs',
      accordion: 'Accordion',
    };

    const normalized = elementType.toLowerCase();
    return componentMap[normalized] || 'div';
  }

  /**
   * Get a mockup by ID
   */
  getMockup(mockupId: string): MockupResult | undefined {
    return this.mockupCache.get(mockupId);
  }

  /**
   * Store mockup (for persistence)
   */
  storeMockup(mockup: MockupResult): void {
    this.mockupCache.set(mockup.id, mockup);
  }

  /**
   * Calculate similarity between two mockups
   */
  async calculateSimilarity(mockup1: MockupResult, mockup2: MockupResult): Promise<number> {
    if (!mockup1.embedding.length || !mockup2.embedding.length) {
      return 0;
    }

    // Cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < mockup1.embedding.length; i++) {
      dotProduct += mockup1.embedding[i] * mockup2.embedding[i];
      norm1 += mockup1.embedding[i] * mockup1.embedding[i];
      norm2 += mockup2.embedding[i] * mockup2.embedding[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
}

// ============================================================================
// Singleton
// ============================================================================

let serviceInstance: UIMockupGeneratorService | null = null;

export function getUIMockupGeneratorService(): UIMockupGeneratorService {
  if (!serviceInstance) {
    serviceInstance = new UIMockupGeneratorService();
  }
  return serviceInstance;
}

export default UIMockupGeneratorService;
