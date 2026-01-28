/**
 * Asset Type Classifier
 *
 * Determines whether a generation request is for:
 * - UI Mockups (full app interface screenshots) → `kriptik_ui` trigger
 * - In-UI Assets (photorealistic images FOR USE within UIs) → `kriptik_asset` trigger
 *
 * This enables FLUX dual-mode generation where:
 * - UI LoRA generates Awwwards-tier interface mockups
 * - Asset LoRA generates photorealistic hero images, backgrounds, product photos
 *
 * The classifier analyzes prompt text, context, and optionally uses
 * Claude to disambiguate complex cases.
 */

// ============================================================================
// Types
// ============================================================================

export type AssetType = 'ui_mockup' | 'in_ui_asset' | 'hybrid';

export type AssetCategory =
  // UI Mockup categories
  | 'landing_page'
  | 'dashboard'
  | 'mobile_app'
  | 'settings_panel'
  | 'form_interface'
  | 'data_visualization'
  | 'navigation'
  | 'checkout_flow'
  | 'profile_page'
  | 'admin_panel'
  // In-UI Asset categories
  | 'hero_background'
  | 'product_photo'
  | 'team_portrait'
  | 'abstract_art'
  | 'pattern_texture'
  | 'illustration'
  | 'icon_set'
  | 'slider_content'
  | 'testimonial_image'
  | 'feature_graphic';

export interface ClassificationRequest {
  /** The prompt to classify */
  prompt: string;
  /** Optional context about the app being built */
  appContext?: {
    type?: 'landing' | 'saas' | 'ecommerce' | 'portfolio' | 'blog' | 'dashboard';
    industry?: string;
    existingComponents?: string[];
  };
  /** Force a specific type (bypass classification) */
  forceType?: AssetType;
}

export interface ClassificationResult {
  /** Primary asset type */
  type: AssetType;
  /** Specific category within the type */
  category: AssetCategory;
  /** Confidence score 0.0-1.0 */
  confidence: number;
  /** The trigger word to use */
  triggerWord: 'kriptik_ui' | 'kriptik_asset';
  /** Recommended LoRA strength */
  loraStrength: number;
  /** Enhanced prompt with appropriate styling */
  enhancedPrompt: string;
  /** Recommended dimensions */
  dimensions: { width: number; height: number };
  /** Recommended negative prompt */
  negativePrompt: string;
  /** Reasoning for classification */
  reasoning: string;
  /** Alternative classification if confidence is low */
  alternative?: {
    type: AssetType;
    category: AssetCategory;
    confidence: number;
  };
}

// ============================================================================
// Classification Patterns
// ============================================================================

/**
 * Keywords that strongly indicate UI mockup generation
 */
const UI_MOCKUP_INDICATORS: Record<string, number> = {
  // Direct UI terms (highest weight)
  'ui design': 1.0,
  'user interface': 1.0,
  'app screen': 1.0,
  'mockup': 0.95,
  'wireframe': 0.95,
  'prototype': 0.9,
  'interface': 0.85,
  'layout': 0.7,

  // Page types (high weight)
  'landing page': 0.95,
  'dashboard': 0.95,
  'admin panel': 0.95,
  'settings page': 0.9,
  'login page': 0.9,
  'signup page': 0.9,
  'checkout page': 0.9,
  'profile page': 0.85,
  'home page': 0.8,
  'about page': 0.8,
  'contact page': 0.8,
  'pricing page': 0.85,

  // Component terms (medium weight)
  'navigation bar': 0.85,
  'sidebar': 0.85,
  'header': 0.7,
  'footer': 0.7,
  'modal': 0.8,
  'dialog': 0.8,
  'form': 0.75,
  'card layout': 0.8,
  'grid layout': 0.75,
  'bento grid': 0.85,
  'data table': 0.85,
  'chart': 0.7,
  'graph': 0.7,

  // Style terms associated with UI
  'glassmorphism': 0.8,
  'neumorphism': 0.8,
  'material design': 0.85,
  'fluent design': 0.85,
  'ios style': 0.85,
  'android style': 0.85,
  'web app': 0.9,
  'mobile app': 0.9,
  'desktop app': 0.9,
  'saas': 0.85,
  'crm': 0.9,
  'erp': 0.9,

  // Action verbs for UI
  'design a': 0.6,
  'create a': 0.5,
  'build a': 0.5,
  'generate a': 0.5,
};

/**
 * Keywords that strongly indicate in-UI asset generation
 */
const IN_UI_ASSET_INDICATORS: Record<string, number> = {
  // Direct asset terms (highest weight)
  'hero image': 1.0,
  'background image': 1.0,
  'banner image': 0.95,
  'product photo': 1.0,
  'product photography': 1.0,
  'team photo': 0.95,
  'portrait': 0.9,
  'headshot': 0.95,
  'testimonial image': 0.9,

  // Visual content types (high weight)
  'photorealistic': 0.95,
  'photograph': 0.9,
  'photo': 0.7,
  'illustration': 0.85,
  'artwork': 0.85,
  'abstract': 0.8,
  'pattern': 0.85,
  'texture': 0.85,
  'gradient': 0.7,

  // Specific asset purposes (high weight)
  'slider image': 0.95,
  'carousel image': 0.95,
  'feature image': 0.9,
  'blog thumbnail': 0.9,
  'social media': 0.85,
  'og image': 0.9,
  'cover image': 0.9,
  'header background': 0.95,

  // Style modifiers for assets
  'cinematic': 0.9,
  'dramatic lighting': 0.9,
  'studio lighting': 0.9,
  'bokeh': 0.85,
  'depth of field': 0.85,
  'high resolution': 0.7,
  '4k': 0.7,
  '8k': 0.7,
  'professional photo': 0.9,

  // Subject matter
  'landscape': 0.85,
  'cityscape': 0.85,
  'nature': 0.8,
  'food': 0.85,
  'technology': 0.7,
  'office': 0.7,
  'workspace': 0.7,
  'people': 0.75,
  'person': 0.75,
};

/**
 * Category-specific patterns for more precise classification
 */
const CATEGORY_PATTERNS: Record<AssetCategory, string[]> = {
  // UI Mockup categories
  landing_page: ['landing', 'homepage', 'hero section', 'above the fold', 'conversion', 'cta'],
  dashboard: ['dashboard', 'analytics', 'metrics', 'kpi', 'statistics', 'overview'],
  mobile_app: ['mobile', 'ios', 'android', 'smartphone', 'tablet', 'responsive'],
  settings_panel: ['settings', 'preferences', 'configuration', 'options', 'account settings'],
  form_interface: ['form', 'input', 'signup', 'registration', 'contact form', 'survey'],
  data_visualization: ['chart', 'graph', 'visualization', 'data', 'report', 'analytics'],
  navigation: ['navigation', 'menu', 'sidebar', 'navbar', 'header', 'breadcrumb'],
  checkout_flow: ['checkout', 'payment', 'cart', 'order', 'purchase', 'billing'],
  profile_page: ['profile', 'user page', 'account', 'portfolio', 'personal'],
  admin_panel: ['admin', 'cms', 'backend', 'management', 'control panel'],

  // In-UI Asset categories
  hero_background: ['hero', 'background', 'banner', 'header image', 'cover'],
  product_photo: ['product', 'item', 'merchandise', 'goods', 'e-commerce'],
  team_portrait: ['team', 'employee', 'staff', 'founder', 'ceo', 'headshot'],
  abstract_art: ['abstract', 'artistic', 'creative', 'artistic', 'modern art'],
  pattern_texture: ['pattern', 'texture', 'seamless', 'repeating', 'tile'],
  illustration: ['illustration', 'drawing', 'vector', 'graphic', 'artwork'],
  icon_set: ['icon', 'symbol', 'glyph', 'iconography'],
  slider_content: ['slider', 'carousel', 'slideshow', 'gallery image'],
  testimonial_image: ['testimonial', 'review', 'customer', 'client photo'],
  feature_graphic: ['feature', 'benefit', 'highlight', 'showcase'],
};

/**
 * Dimension presets by asset type and category
 */
const DIMENSION_PRESETS: Record<AssetCategory, { width: number; height: number }> = {
  // UI Mockup dimensions
  landing_page: { width: 1280, height: 720 },
  dashboard: { width: 1920, height: 1080 },
  mobile_app: { width: 430, height: 932 },
  settings_panel: { width: 1280, height: 800 },
  form_interface: { width: 600, height: 800 },
  data_visualization: { width: 1280, height: 720 },
  navigation: { width: 1280, height: 200 },
  checkout_flow: { width: 1280, height: 900 },
  profile_page: { width: 1280, height: 800 },
  admin_panel: { width: 1920, height: 1080 },

  // In-UI Asset dimensions
  hero_background: { width: 1920, height: 1080 },
  product_photo: { width: 1024, height: 1024 },
  team_portrait: { width: 800, height: 1000 },
  abstract_art: { width: 1920, height: 1080 },
  pattern_texture: { width: 512, height: 512 },
  illustration: { width: 1200, height: 800 },
  icon_set: { width: 512, height: 512 },
  slider_content: { width: 1920, height: 800 },
  testimonial_image: { width: 400, height: 400 },
  feature_graphic: { width: 800, height: 600 },
};

/**
 * Negative prompts by asset type
 */
const NEGATIVE_PROMPTS: Record<AssetType, string> = {
  ui_mockup:
    'blurry, low quality, distorted text, broken layout, watermark, signature, ' +
    'amateur, ugly, deformed, photograph, realistic person, photo, ' +
    'stock photo, low resolution, pixelated, cropped, incomplete',
  in_ui_asset:
    'blurry, low quality, watermark, signature, amateur, ugly, deformed, ' +
    'text overlay, ui elements, buttons, interface elements, wireframe, ' +
    'mockup, low resolution, pixelated, oversaturated, cartoon, anime',
  hybrid:
    'blurry, low quality, watermark, signature, amateur, ugly, deformed, ' +
    'low resolution, pixelated, cropped, incomplete, inconsistent style',
};

// ============================================================================
// Style Enhancement Patterns
// ============================================================================

/**
 * Premium style enhancements for UI mockups
 */
const UI_STYLE_ENHANCEMENTS = [
  'clean modern interface',
  'professional design',
  'pixel perfect',
  'high fidelity mockup',
  'Awwwards quality',
  'premium UI',
  '2026 design trends',
  'sophisticated layout',
];

/**
 * Premium style enhancements for in-UI assets
 */
const ASSET_STYLE_ENHANCEMENTS = [
  'professional photography',
  'studio quality',
  'high resolution',
  'cinematic lighting',
  'editorial quality',
  'premium stock photo quality',
  'sharp focus',
  'rich colors',
];

// ============================================================================
// Asset Type Classifier Service
// ============================================================================

export class AssetTypeClassifierService {
  /**
   * Classify a generation request to determine asset type
   */
  classify(request: ClassificationRequest): ClassificationResult {
    // Handle forced type
    if (request.forceType) {
      return this.createForcedResult(request.prompt, request.forceType);
    }

    const prompt = request.prompt.toLowerCase();

    // Calculate scores for each type
    const uiScore = this.calculateScore(prompt, UI_MOCKUP_INDICATORS);
    const assetScore = this.calculateScore(prompt, IN_UI_ASSET_INDICATORS);

    // Determine primary type and confidence
    let type: AssetType;
    let confidence: number;
    let alternative: ClassificationResult['alternative'];

    if (uiScore > assetScore) {
      type = 'ui_mockup';
      confidence = this.normalizeConfidence(uiScore, assetScore);

      if (assetScore > 0.3) {
        alternative = {
          type: 'in_ui_asset',
          category: this.detectCategory(prompt, 'in_ui_asset'),
          confidence: this.normalizeConfidence(assetScore, uiScore),
        };
      }
    } else if (assetScore > uiScore) {
      type = 'in_ui_asset';
      confidence = this.normalizeConfidence(assetScore, uiScore);

      if (uiScore > 0.3) {
        alternative = {
          type: 'ui_mockup',
          category: this.detectCategory(prompt, 'ui_mockup'),
          confidence: this.normalizeConfidence(uiScore, assetScore),
        };
      }
    } else {
      // Equal or both low - use hybrid
      type = 'hybrid';
      confidence = Math.max(uiScore, assetScore, 0.5);
    }

    // Apply context-based adjustments
    if (request.appContext) {
      const adjusted = this.applyContextAdjustments(type, confidence, request.appContext);
      type = adjusted.type;
      confidence = adjusted.confidence;
    }

    // Detect specific category
    const category = this.detectCategory(prompt, type);

    // Get dimensions
    const dimensions = DIMENSION_PRESETS[category];

    // Build result
    return {
      type,
      category,
      confidence,
      triggerWord: type === 'in_ui_asset' ? 'kriptik_asset' : 'kriptik_ui',
      loraStrength: this.getOptimalLoraStrength(type, confidence),
      enhancedPrompt: this.enhancePrompt(request.prompt, type, category),
      dimensions,
      negativePrompt: NEGATIVE_PROMPTS[type],
      reasoning: this.generateReasoning(prompt, type, category, uiScore, assetScore),
      alternative,
    };
  }

  /**
   * Batch classify multiple prompts
   */
  classifyBatch(requests: ClassificationRequest[]): ClassificationResult[] {
    return requests.map((req) => this.classify(req));
  }

  /**
   * Quick check if prompt is UI mockup (for routing decisions)
   */
  isUIMockup(prompt: string): boolean {
    const result = this.classify({ prompt });
    return result.type === 'ui_mockup' && result.confidence > 0.6;
  }

  /**
   * Quick check if prompt is in-UI asset (for routing decisions)
   */
  isInUIAsset(prompt: string): boolean {
    const result = this.classify({ prompt });
    return result.type === 'in_ui_asset' && result.confidence > 0.6;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Calculate weighted score based on keyword matches
   */
  private calculateScore(prompt: string, indicators: Record<string, number>): number {
    let totalScore = 0;
    let matchCount = 0;

    for (const [keyword, weight] of Object.entries(indicators)) {
      if (prompt.includes(keyword)) {
        totalScore += weight;
        matchCount++;
      }
    }

    // Normalize by match count with diminishing returns
    if (matchCount === 0) return 0;
    return Math.min(totalScore / Math.sqrt(matchCount), 1.0);
  }

  /**
   * Normalize confidence relative to alternative score
   */
  private normalizeConfidence(primaryScore: number, alternativeScore: number): number {
    if (primaryScore === 0) return 0;
    const ratio = primaryScore / (primaryScore + alternativeScore);
    return Math.min(ratio * 1.2, 1.0); // Slight boost for dominant type
  }

  /**
   * Detect specific category within asset type
   */
  private detectCategory(prompt: string, type: AssetType): AssetCategory {
    const relevantCategories =
      type === 'ui_mockup'
        ? ([
            'landing_page',
            'dashboard',
            'mobile_app',
            'settings_panel',
            'form_interface',
            'data_visualization',
            'navigation',
            'checkout_flow',
            'profile_page',
            'admin_panel',
          ] as AssetCategory[])
        : ([
            'hero_background',
            'product_photo',
            'team_portrait',
            'abstract_art',
            'pattern_texture',
            'illustration',
            'icon_set',
            'slider_content',
            'testimonial_image',
            'feature_graphic',
          ] as AssetCategory[]);

    let bestCategory = relevantCategories[0];
    let bestScore = 0;

    for (const category of relevantCategories) {
      const patterns = CATEGORY_PATTERNS[category];
      let score = 0;

      for (const pattern of patterns) {
        if (prompt.includes(pattern)) {
          score += 1;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    return bestCategory;
  }

  /**
   * Apply context-based adjustments to classification
   */
  private applyContextAdjustments(
    type: AssetType,
    confidence: number,
    context: NonNullable<ClassificationRequest['appContext']>
  ): { type: AssetType; confidence: number } {
    // Boost UI mockup confidence for certain app types
    if (context.type && ['saas', 'dashboard'].includes(context.type)) {
      if (type === 'ui_mockup') {
        return { type, confidence: Math.min(confidence * 1.15, 1.0) };
      }
    }

    // Boost asset confidence for content-heavy sites
    if (context.type && ['portfolio', 'blog'].includes(context.type)) {
      if (type === 'in_ui_asset') {
        return { type, confidence: Math.min(confidence * 1.1, 1.0) };
      }
    }

    // Check if existing components suggest type
    if (context.existingComponents?.length) {
      const hasUIComponents = context.existingComponents.some(
        (c) => c.includes('Page') || c.includes('Layout') || c.includes('Dashboard')
      );
      if (hasUIComponents && type === 'ui_mockup') {
        return { type, confidence: Math.min(confidence * 1.1, 1.0) };
      }
    }

    return { type, confidence };
  }

  /**
   * Get optimal LoRA strength based on type and confidence
   */
  private getOptimalLoraStrength(type: AssetType, confidence: number): number {
    // Base strengths
    const baseStrength = type === 'ui_mockup' ? 0.85 : 0.75;

    // Adjust based on confidence
    if (confidence > 0.8) {
      return baseStrength;
    } else if (confidence > 0.6) {
      return baseStrength * 0.95;
    } else {
      return baseStrength * 0.9;
    }
  }

  /**
   * Enhance prompt with appropriate style terms
   */
  private enhancePrompt(prompt: string, type: AssetType, category: AssetCategory): string {
    const triggerWord = type === 'in_ui_asset' ? 'kriptik_asset' : 'kriptik_ui';

    // Add trigger word if not present
    let enhanced = prompt;
    if (!enhanced.toLowerCase().startsWith(triggerWord)) {
      enhanced = `${triggerWord}, ${enhanced}`;
    }

    // Add style enhancements
    const styleEnhancements =
      type === 'ui_mockup' ? UI_STYLE_ENHANCEMENTS : ASSET_STYLE_ENHANCEMENTS;

    // Select 2-3 relevant enhancements
    const selected = styleEnhancements.slice(0, 3).join(', ');

    return `${enhanced}, ${selected}`;
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    prompt: string,
    type: AssetType,
    category: AssetCategory,
    uiScore: number,
    assetScore: number
  ): string {
    const parts: string[] = [];

    parts.push(`Classified as ${type.replace('_', ' ')} (${category.replace('_', ' ')}).`);

    if (uiScore > 0) {
      parts.push(`UI indicators scored ${(uiScore * 100).toFixed(0)}%.`);
    }

    if (assetScore > 0) {
      parts.push(`Asset indicators scored ${(assetScore * 100).toFixed(0)}%.`);
    }

    // Add key detection reasons
    const matchedUI = Object.keys(UI_MOCKUP_INDICATORS).filter((k) => prompt.includes(k));
    const matchedAsset = Object.keys(IN_UI_ASSET_INDICATORS).filter((k) => prompt.includes(k));

    if (matchedUI.length > 0) {
      parts.push(`UI keywords: ${matchedUI.slice(0, 3).join(', ')}.`);
    }

    if (matchedAsset.length > 0) {
      parts.push(`Asset keywords: ${matchedAsset.slice(0, 3).join(', ')}.`);
    }

    return parts.join(' ');
  }

  /**
   * Create result for forced type
   */
  private createForcedResult(prompt: string, type: AssetType): ClassificationResult {
    const category = this.detectCategory(prompt.toLowerCase(), type);
    const dimensions = DIMENSION_PRESETS[category];

    return {
      type,
      category,
      confidence: 1.0,
      triggerWord: type === 'in_ui_asset' ? 'kriptik_asset' : 'kriptik_ui',
      loraStrength: type === 'ui_mockup' ? 0.85 : 0.75,
      enhancedPrompt: this.enhancePrompt(prompt, type, category),
      dimensions,
      negativePrompt: NEGATIVE_PROMPTS[type],
      reasoning: `Type forced to ${type.replace('_', ' ')} by request.`,
    };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let classifierInstance: AssetTypeClassifierService | null = null;

export function getAssetTypeClassifier(): AssetTypeClassifierService {
  if (!classifierInstance) {
    classifierInstance = new AssetTypeClassifierService();
  }
  return classifierInstance;
}

export default AssetTypeClassifierService;
