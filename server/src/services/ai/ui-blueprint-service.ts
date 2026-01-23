/**
 * UI Blueprint Service - Opus 4.5 Layout Planning
 *
 * Uses Claude Opus 4.5 with extended thinking to decompose natural language
 * UI descriptions into structured UISceneBlueprint JSON for image generation.
 *
 * This is the key to achieving Stitch-quality UI generation:
 * - Decomposes NLP prompts into precise component layouts
 * - Defines bounding boxes for each element
 * - Specifies relationships (navigation, forms, interactions)
 * - Outputs structured JSON that guides FLUX image generation
 *
 * Based on research from:
 * - LLM Blueprint paper (layout planning for image generation)
 * - LayoutLLM-T2I (coarse-to-fine generation)
 * - Google Generative UI research
 */

import { getUnifiedClient, ANTHROPIC_MODELS } from './unified-client.js';

// ============================================================================
// Types
// ============================================================================

export interface BoundingBox {
  /** X position as percentage (0-100) */
  x: number;
  /** Y position as percentage (0-100) */
  y: number;
  /** Width as percentage (0-100) */
  width: number;
  /** Height as percentage (0-100) */
  height: number;
}

export type ComponentType =
  | 'button'
  | 'input'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'switch'
  | 'slider'
  | 'card'
  | 'nav'
  | 'header'
  | 'footer'
  | 'sidebar'
  | 'form'
  | 'image'
  | 'icon'
  | 'avatar'
  | 'text'
  | 'heading'
  | 'list'
  | 'table'
  | 'modal'
  | 'toast'
  | 'badge'
  | 'tab'
  | 'accordion'
  | 'carousel'
  | 'chart'
  | 'map'
  | 'video'
  | 'divider'
  | 'container';

export type ComponentStyle = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline' | 'link';

export type RelationshipType = 'navigates' | 'submits' | 'toggles' | 'opens' | 'closes' | 'selects' | 'filters';

export interface UIComponent {
  /** Unique identifier */
  id: string;
  /** Component type */
  type: ComponentType;
  /** Bounding box (percentage-based) */
  bounds: BoundingBox;
  /** Display label/text */
  label: string;
  /** Optional placeholder text */
  placeholder?: string;
  /** Component style variant */
  style: ComponentStyle;
  /** Parent container ID */
  parent: string;
  /** Child component IDs */
  children?: string[];
  /** Additional properties */
  props?: Record<string, unknown>;
}

export interface UIRelationship {
  /** Source component ID */
  from: string;
  /** Target component/view ID */
  to: string;
  /** Relationship type */
  type: RelationshipType;
  /** Optional description */
  description?: string;
}

export interface UILayoutGrid {
  /** Grid type */
  type: 'stack' | 'grid' | 'sidebar' | 'split' | 'tabs';
  /** Named areas with bounds */
  areas: Array<{
    name: string;
    bounds: BoundingBox;
    scrollable?: boolean;
  }>;
}

export interface UIStyleContext {
  /** Color scheme */
  colorScheme: 'light' | 'dark' | 'auto';
  /** Primary brand color (hex) */
  primaryColor?: string;
  /** Secondary/accent color (hex) */
  accentColor?: string;
  /** Typography style */
  typography: 'modern' | 'classic' | 'playful' | 'minimal';
  /** Spacing density */
  spacing: 'compact' | 'comfortable' | 'spacious';
  /** Border radius style */
  corners: 'sharp' | 'rounded' | 'pill';
  /** Shadow intensity */
  shadows: 'none' | 'subtle' | 'medium' | 'strong';
}

export interface UISceneBlueprint {
  /** View/screen name */
  viewName: string;
  /** Brief description */
  description: string;
  /** Target platform */
  platform: 'web' | 'mobile' | 'tablet';
  /** Layout grid structure */
  layoutGrid: UILayoutGrid;
  /** All UI components */
  components: UIComponent[];
  /** Component relationships */
  relationships: UIRelationship[];
  /** Style context */
  styleContext: UIStyleContext;
  /** Generation metadata */
  metadata: {
    generatedAt: string;
    prompt: string;
    confidence: number;
  };
}

export interface BlueprintRequest {
  /** Natural language description of the UI view */
  prompt: string;
  /** View/screen name */
  viewName?: string;
  /** Target platform */
  platform?: 'web' | 'mobile' | 'tablet';
  /** Style preferences */
  stylePreferences?: Partial<UIStyleContext>;
  /** Additional context from implementation plan */
  planContext?: string;
  /** Reference existing components */
  existingComponents?: string[];
}

export interface BlueprintResult {
  /** Generated blueprint */
  blueprint: UISceneBlueprint;
  /** Optimized prompt for image generation */
  imagePrompt: string;
  /** Thinking/reasoning from Opus 4.5 */
  reasoning?: string;
  /** Generation latency */
  latencyMs: number;
}

// ============================================================================
// System Prompt for Opus 4.5
// ============================================================================

const UI_BLUEPRINT_SYSTEM_PROMPT = `You are a UI Layout Architect specializing in decomposing natural language UI descriptions into precise, structured blueprints for image generation.

Your task is to analyze UI descriptions and output a UISceneBlueprint JSON that:
1. Defines the overall layout grid structure
2. Lists every UI component with exact bounding boxes (as percentages)
3. Specifies relationships between components (navigation, forms, interactions)
4. Sets style context (colors, typography, spacing)

## Component Placement Guidelines

When placing components, consider:
- Headers typically occupy y: 0-8%, height: 6-8%
- Navigation bars: y: 0-6% or y: 92-100%
- Main content areas: y: 8-92%
- Sidebars: x: 0-20% or x: 80-100%
- Modals: centered, typically 60-80% width, 40-60% height
- Form inputs: standard height 5-7%
- Buttons: height 4-6%, width varies (8-25% for icons to full width)
- Cards: typically 30-45% width in grids

## Mobile-Specific Guidelines (when platform is 'mobile')
- Safe areas: top 5%, bottom 8%
- Touch targets: minimum height 5%
- Bottom navigation: y: 91-100%
- FAB buttons: fixed at x: 82-95%, y: 83-92%

## Output Requirements

Output ONLY valid JSON matching the UISceneBlueprint interface. No markdown, no explanations, just the JSON object.

Example output structure:
{
  "viewName": "LoginScreen",
  "description": "User authentication screen with email/password login",
  "platform": "mobile",
  "layoutGrid": {
    "type": "stack",
    "areas": [
      { "name": "header", "bounds": { "x": 0, "y": 0, "width": 100, "height": 15 } },
      { "name": "content", "bounds": { "x": 0, "y": 15, "width": 100, "height": 85 } }
    ]
  },
  "components": [
    {
      "id": "logo",
      "type": "image",
      "bounds": { "x": 30, "y": 5, "width": 40, "height": 10 },
      "label": "App Logo",
      "style": "primary",
      "parent": "header"
    },
    {
      "id": "email-input",
      "type": "input",
      "bounds": { "x": 10, "y": 30, "width": 80, "height": 6 },
      "label": "Email",
      "placeholder": "Enter your email",
      "style": "primary",
      "parent": "content"
    }
  ],
  "relationships": [
    { "from": "login-button", "to": "dashboard", "type": "navigates" },
    { "from": "login-form", "to": "auth-api", "type": "submits" }
  ],
  "styleContext": {
    "colorScheme": "dark",
    "primaryColor": "#3b82f6",
    "typography": "modern",
    "spacing": "comfortable",
    "corners": "rounded",
    "shadows": "subtle"
  },
  "metadata": {
    "generatedAt": "2026-01-22T00:00:00Z",
    "prompt": "original prompt",
    "confidence": 0.92
  }
}`;

// ============================================================================
// UI Blueprint Service Implementation
// ============================================================================

export class UIBlueprintService {
  private client = getUnifiedClient();

  /**
   * Generate a UI blueprint from natural language description
   */
  async generateBlueprint(request: BlueprintRequest): Promise<BlueprintResult> {
    const startTime = Date.now();

    // Build the user prompt
    const userPrompt = this.buildUserPrompt(request);

    try {
      // Call Opus 4.5 with extended thinking for best results
      const response = await this.client.generate({
        model: ANTHROPIC_MODELS.OPUS_4_5,
        systemPrompt: UI_BLUEPRINT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 8000,
        thinking: { enabled: true, budgetTokens: 4000 },
        temperature: 0.3, // Lower temperature for structured output
      });

      // Parse the JSON response
      const blueprint = this.parseBlueprint(response.content, request);

      // Generate optimized image prompt from blueprint
      const imagePrompt = this.blueprintToImagePrompt(blueprint);

      return {
        blueprint,
        imagePrompt,
        reasoning: response.thinking,
        latencyMs: Date.now() - startTime,
      };

    } catch (error) {
      console.error('[UI-Blueprint] Generation failed:', error);
      throw error;
    }
  }

  /**
   * Modify an existing blueprint based on user feedback
   */
  async modifyBlueprint(
    existingBlueprint: UISceneBlueprint,
    modificationPrompt: string
  ): Promise<BlueprintResult> {
    const startTime = Date.now();

    const userPrompt = `Current blueprint:
${JSON.stringify(existingBlueprint, null, 2)}

User modification request: "${modificationPrompt}"

Update the blueprint to reflect this change. Output the complete updated UISceneBlueprint JSON.`;

    try {
      const response = await this.client.generate({
        model: ANTHROPIC_MODELS.OPUS_4_5,
        systemPrompt: UI_BLUEPRINT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 8000,
        thinking: { enabled: true, budgetTokens: 4000 },
        temperature: 0.3,
      });

      const blueprint = this.parseBlueprint(response.content, {
        prompt: modificationPrompt,
        viewName: existingBlueprint.viewName,
        platform: existingBlueprint.platform,
      });

      const imagePrompt = this.blueprintToImagePrompt(blueprint);

      return {
        blueprint,
        imagePrompt,
        reasoning: response.thinking,
        latencyMs: Date.now() - startTime,
      };

    } catch (error) {
      console.error('[UI-Blueprint] Modification failed:', error);
      throw error;
    }
  }

  /**
   * Build user prompt from request
   */
  private buildUserPrompt(request: BlueprintRequest): string {
    const parts: string[] = [];

    parts.push(`Create a UI blueprint for: "${request.prompt}"`);

    if (request.viewName) {
      parts.push(`View name: ${request.viewName}`);
    }

    parts.push(`Platform: ${request.platform || 'web'}`);

    if (request.stylePreferences) {
      parts.push(`Style preferences: ${JSON.stringify(request.stylePreferences)}`);
    }

    if (request.planContext) {
      parts.push(`Implementation context: ${request.planContext}`);
    }

    if (request.existingComponents?.length) {
      parts.push(`Reference existing components: ${request.existingComponents.join(', ')}`);
    }

    parts.push('\nOutput the complete UISceneBlueprint JSON:');

    return parts.join('\n');
  }

  /**
   * Parse and validate blueprint JSON
   */
  private parseBlueprint(content: string, request: BlueprintRequest): UISceneBlueprint {
    // Extract JSON from response (handle potential markdown wrapping)
    let jsonStr = content.trim();

    // Remove markdown code blocks if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Parse JSON
    let blueprint: UISceneBlueprint;
    try {
      blueprint = JSON.parse(jsonStr);
    } catch {
      // Try to find JSON object in the content
      const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        blueprint = JSON.parse(objectMatch[0]);
      } else {
        throw new Error('Failed to parse blueprint JSON from response');
      }
    }

    // Validate and fill defaults
    blueprint = this.validateAndFillDefaults(blueprint, request);

    return blueprint;
  }

  /**
   * Validate blueprint structure and fill defaults
   */
  private validateAndFillDefaults(
    blueprint: Partial<UISceneBlueprint>,
    request: BlueprintRequest
  ): UISceneBlueprint {
    const now = new Date().toISOString();

    return {
      viewName: blueprint.viewName || request.viewName || 'UnnamedView',
      description: blueprint.description || request.prompt,
      platform: blueprint.platform || request.platform || 'web',
      layoutGrid: blueprint.layoutGrid || {
        type: 'stack',
        areas: [
          { name: 'content', bounds: { x: 0, y: 0, width: 100, height: 100 } },
        ],
      },
      components: blueprint.components || [],
      relationships: blueprint.relationships || [],
      styleContext: {
        colorScheme: blueprint.styleContext?.colorScheme || request.stylePreferences?.colorScheme || 'dark',
        primaryColor: blueprint.styleContext?.primaryColor || request.stylePreferences?.primaryColor,
        accentColor: blueprint.styleContext?.accentColor || request.stylePreferences?.accentColor,
        typography: blueprint.styleContext?.typography || request.stylePreferences?.typography || 'modern',
        spacing: blueprint.styleContext?.spacing || request.stylePreferences?.spacing || 'comfortable',
        corners: blueprint.styleContext?.corners || 'rounded',
        shadows: blueprint.styleContext?.shadows || 'subtle',
      },
      metadata: {
        generatedAt: now,
        prompt: request.prompt,
        confidence: blueprint.metadata?.confidence || 0.85,
      },
    };
  }

  /**
   * Convert blueprint to optimized image generation prompt
   */
  blueprintToImagePrompt(blueprint: UISceneBlueprint): string {
    const { viewName, platform, components, styleContext } = blueprint;

    // Build component descriptions
    const componentDescriptions = components
      .filter(c => c.label && c.type !== 'container')
      .slice(0, 15) // Limit for prompt length
      .map(c => {
        if (c.type === 'button') {
          return `"${c.label}" ${c.style} button`;
        }
        if (c.type === 'input' || c.type === 'textarea') {
          return `${c.placeholder || c.label} input field`;
        }
        if (c.type === 'image' || c.type === 'avatar') {
          return c.label.toLowerCase();
        }
        if (c.type === 'heading' || c.type === 'text') {
          return `"${c.label}" text`;
        }
        return `${c.label} ${c.type}`;
      })
      .join(', ');

    // Build style description
    const styleDesc = [
      styleContext.colorScheme === 'dark' ? 'dark theme' : 'light theme',
      `${styleContext.typography} typography`,
      `${styleContext.spacing} spacing`,
      styleContext.corners === 'rounded' ? 'rounded corners' : 'sharp corners',
      styleContext.shadows !== 'none' ? `${styleContext.shadows} shadows` : '',
    ].filter(Boolean).join(', ');

    // Platform-specific terms
    const platformTerms = {
      mobile: 'mobile app, iPhone screen',
      tablet: 'tablet app, iPad screen',
      web: 'web application, desktop browser',
    };

    return `kriptik_ui, ${platformTerms[platform]} UI mockup for "${viewName}", ${styleDesc}, containing: ${componentDescriptions}, clean modern interface, professional design, high fidelity, pixel perfect, 4K quality`;
  }

  /**
   * Validate blueprint-to-image consistency
   */
  async validateConsistency(
    blueprint: UISceneBlueprint,
    generatedImageElements: Array<{ type: string; label: string; bounds: BoundingBox }>
  ): Promise<{
    matchRate: number;
    matchedComponents: string[];
    missingComponents: string[];
  }> {
    const blueprintComponents = blueprint.components.filter(c => c.type !== 'container');
    const matched: string[] = [];
    const missing: string[] = [];

    for (const component of blueprintComponents) {
      // Find matching element in generated image (by type and approximate position)
      const matchingElement = generatedImageElements.find(el =>
        el.type === component.type &&
        Math.abs(el.bounds.x - component.bounds.x) < 15 &&
        Math.abs(el.bounds.y - component.bounds.y) < 15
      );

      if (matchingElement) {
        matched.push(component.id);
      } else {
        missing.push(component.id);
      }
    }

    return {
      matchRate: blueprintComponents.length > 0
        ? matched.length / blueprintComponents.length
        : 1,
      matchedComponents: matched,
      missingComponents: missing,
    };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let serviceInstance: UIBlueprintService | null = null;

export function getUIBlueprintService(): UIBlueprintService {
  if (!serviceInstance) {
    serviceInstance = new UIBlueprintService();
  }
  return serviceInstance;
}

export default UIBlueprintService;
