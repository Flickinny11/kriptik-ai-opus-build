/**
 * Automatic Asset Orchestrator
 *
 * Automatically determines when 3D components, Remotion videos, and other
 * premium assets should be generated for an app build. This ensures premium,
 * unique designs are the DEFAULT without user request.
 *
 * Decision Logic:
 * - Landing pages → 3D hero elements + promotional video
 * - Portfolios → Interactive 3D showcase + intro video
 * - E-commerce → 3D product viewers
 * - SaaS → Animated feature demos
 * - Marketing → SliderRevolution-style carousels
 *
 * All generated 3D/video MUST match the app's theme and color scheme.
 */

import type { UISceneBlueprint, UIStyleContext } from '../ai/ui-blueprint-service.js';
import { getAssetStyleMatcher, type StyleMatchResult } from './asset-style-matcher.js';

// ============================================================================
// Types
// ============================================================================

export type AppType =
  | 'landing'
  | 'portfolio'
  | 'ecommerce'
  | 'saas'
  | 'dashboard'
  | 'blog'
  | 'marketing'
  | 'agency'
  | 'startup'
  | 'personal'
  | 'corporate';

export type Asset3DType =
  | 'hero-abstract'       // Abstract 3D shapes for hero sections
  | 'hero-product'        // 3D product showcase
  | 'hero-text'           // 3D typography
  | 'background-particles'// Particle system background
  | 'background-waves'    // Animated wave mesh
  | 'product-viewer'      // Interactive 3D product viewer
  | 'scene-environment'   // Full 3D environment
  | 'logo-3d'             // 3D logo animation
  | 'icon-set'            // 3D icon collection
  | 'character'           // 3D character/mascot
  | 'data-visualization'; // 3D data charts

export type VideoType =
  | 'intro-promo'         // Company/product intro video
  | 'feature-demo'        // Feature showcase video
  | 'testimonial'         // Testimonial compilation
  | 'product-showcase'    // Product features video
  | 'team-intro'          // Team introduction
  | 'story-narrative'     // Brand story video
  | 'tutorial'            // How-to video
  | 'social-clip';        // Short social media clip

export interface AssetRecommendation {
  /** Recommended 3D assets */
  assets3D: Array<{
    type: Asset3DType;
    placement: string;           // Component/section to place in
    priority: 'essential' | 'recommended' | 'optional';
    styleMatch: StyleMatchResult;
    estimatedGenerationTime: number; // seconds
  }>;

  /** Recommended videos */
  videos: Array<{
    type: VideoType;
    placement: string;
    priority: 'essential' | 'recommended' | 'optional';
    duration: number;            // seconds
    styleMatch: StyleMatchResult;
    estimatedGenerationTime: number;
  }>;

  /** Premium UI components to generate */
  uiComponents: Array<{
    type: 'slider' | 'carousel' | 'gallery' | 'timeline' | 'testimonials';
    style: 'sliderrevolution' | 'gsap' | 'framer';
    placement: string;
    priority: 'essential' | 'recommended' | 'optional';
  }>;

  /** Overall recommendation summary */
  summary: {
    totalAssets: number;
    essentialCount: number;
    recommendedCount: number;
    optionalCount: number;
    estimatedTotalTime: number;  // seconds
    premiumScore: number;        // 0-100 quality score
  };
}

export interface OrchestratorRequest {
  /** Detected or specified app type */
  appType: AppType;
  /** Blueprint for the main view */
  blueprint?: UISceneBlueprint;
  /** Style context */
  styleContext: UIStyleContext;
  /** NLP prompt that initiated the build */
  originalPrompt: string;
  /** Existing components in the project */
  existingComponents?: string[];
  /** Budget constraints */
  constraints?: {
    maxGenerationTime?: number;  // seconds
    max3DAssets?: number;
    maxVideos?: number;
    priorityOnly?: boolean;      // Only essential assets
  };
}

// ============================================================================
// App Type Detection Patterns
// ============================================================================

const APP_TYPE_PATTERNS: Record<AppType, string[]> = {
  landing: ['landing', 'homepage', 'home page', 'main page', 'hero', 'marketing site'],
  portfolio: ['portfolio', 'personal site', 'creative', 'showcase', 'work samples'],
  ecommerce: ['ecommerce', 'e-commerce', 'shop', 'store', 'products', 'cart', 'checkout'],
  saas: ['saas', 'software', 'platform', 'app', 'dashboard app', 'web app'],
  dashboard: ['dashboard', 'admin', 'analytics', 'metrics', 'reports', 'data'],
  blog: ['blog', 'content', 'articles', 'posts', 'news', 'magazine'],
  marketing: ['marketing', 'campaign', 'promotion', 'launch', 'announcement'],
  agency: ['agency', 'studio', 'design firm', 'creative agency', 'digital agency'],
  startup: ['startup', 'venture', 'mvp', 'pitch', 'fundraising'],
  personal: ['personal', 'resume', 'cv', 'about me', 'bio'],
  corporate: ['corporate', 'enterprise', 'business', 'company', 'organization'],
};

// ============================================================================
// Asset Recommendations by App Type
// ============================================================================

const ASSET_RECOMMENDATIONS: Record<AppType, {
  assets3D: Array<{ type: Asset3DType; priority: 'essential' | 'recommended' | 'optional' }>;
  videos: Array<{ type: VideoType; priority: 'essential' | 'recommended' | 'optional'; duration: number }>;
  uiComponents: Array<{ type: string; style: string; priority: 'essential' | 'recommended' | 'optional' }>;
}> = {
  landing: {
    assets3D: [
      { type: 'hero-abstract', priority: 'essential' },
      { type: 'background-particles', priority: 'recommended' },
      { type: 'logo-3d', priority: 'optional' },
    ],
    videos: [
      { type: 'intro-promo', priority: 'recommended', duration: 30 },
      { type: 'feature-demo', priority: 'optional', duration: 45 },
    ],
    uiComponents: [
      { type: 'slider', style: 'sliderrevolution', priority: 'essential' },
      { type: 'testimonials', style: 'gsap', priority: 'recommended' },
    ],
  },
  portfolio: {
    assets3D: [
      { type: 'hero-text', priority: 'essential' },
      { type: 'scene-environment', priority: 'recommended' },
      { type: 'background-waves', priority: 'optional' },
    ],
    videos: [
      { type: 'intro-promo', priority: 'essential', duration: 20 },
      { type: 'story-narrative', priority: 'optional', duration: 60 },
    ],
    uiComponents: [
      { type: 'gallery', style: 'gsap', priority: 'essential' },
      { type: 'timeline', style: 'framer', priority: 'recommended' },
    ],
  },
  ecommerce: {
    assets3D: [
      { type: 'product-viewer', priority: 'essential' },
      { type: 'hero-product', priority: 'recommended' },
      { type: 'icon-set', priority: 'optional' },
    ],
    videos: [
      { type: 'product-showcase', priority: 'recommended', duration: 30 },
      { type: 'social-clip', priority: 'optional', duration: 15 },
    ],
    uiComponents: [
      { type: 'carousel', style: 'sliderrevolution', priority: 'essential' },
      { type: 'gallery', style: 'gsap', priority: 'recommended' },
    ],
  },
  saas: {
    assets3D: [
      { type: 'hero-abstract', priority: 'recommended' },
      { type: 'data-visualization', priority: 'recommended' },
      { type: 'icon-set', priority: 'optional' },
    ],
    videos: [
      { type: 'feature-demo', priority: 'essential', duration: 60 },
      { type: 'tutorial', priority: 'recommended', duration: 90 },
    ],
    uiComponents: [
      { type: 'slider', style: 'framer', priority: 'recommended' },
      { type: 'testimonials', style: 'gsap', priority: 'optional' },
    ],
  },
  dashboard: {
    assets3D: [
      { type: 'data-visualization', priority: 'essential' },
      { type: 'icon-set', priority: 'recommended' },
    ],
    videos: [
      { type: 'tutorial', priority: 'optional', duration: 120 },
    ],
    uiComponents: [
      { type: 'timeline', style: 'framer', priority: 'optional' },
    ],
  },
  blog: {
    assets3D: [
      { type: 'hero-text', priority: 'optional' },
    ],
    videos: [],
    uiComponents: [
      { type: 'gallery', style: 'gsap', priority: 'optional' },
    ],
  },
  marketing: {
    assets3D: [
      { type: 'hero-abstract', priority: 'essential' },
      { type: 'background-particles', priority: 'essential' },
      { type: 'logo-3d', priority: 'recommended' },
    ],
    videos: [
      { type: 'intro-promo', priority: 'essential', duration: 30 },
      { type: 'social-clip', priority: 'essential', duration: 15 },
      { type: 'feature-demo', priority: 'recommended', duration: 45 },
    ],
    uiComponents: [
      { type: 'slider', style: 'sliderrevolution', priority: 'essential' },
      { type: 'carousel', style: 'sliderrevolution', priority: 'essential' },
      { type: 'testimonials', style: 'gsap', priority: 'recommended' },
    ],
  },
  agency: {
    assets3D: [
      { type: 'scene-environment', priority: 'essential' },
      { type: 'hero-text', priority: 'recommended' },
      { type: 'background-waves', priority: 'optional' },
    ],
    videos: [
      { type: 'intro-promo', priority: 'essential', duration: 45 },
      { type: 'team-intro', priority: 'recommended', duration: 30 },
    ],
    uiComponents: [
      { type: 'gallery', style: 'gsap', priority: 'essential' },
      { type: 'slider', style: 'sliderrevolution', priority: 'recommended' },
    ],
  },
  startup: {
    assets3D: [
      { type: 'hero-abstract', priority: 'essential' },
      { type: 'logo-3d', priority: 'recommended' },
    ],
    videos: [
      { type: 'intro-promo', priority: 'essential', duration: 60 },
      { type: 'feature-demo', priority: 'recommended', duration: 45 },
    ],
    uiComponents: [
      { type: 'slider', style: 'framer', priority: 'recommended' },
      { type: 'timeline', style: 'gsap', priority: 'optional' },
    ],
  },
  personal: {
    assets3D: [
      { type: 'hero-text', priority: 'recommended' },
      { type: 'character', priority: 'optional' },
    ],
    videos: [
      { type: 'intro-promo', priority: 'optional', duration: 20 },
    ],
    uiComponents: [
      { type: 'timeline', style: 'framer', priority: 'recommended' },
    ],
  },
  corporate: {
    assets3D: [
      { type: 'hero-abstract', priority: 'recommended' },
      { type: 'data-visualization', priority: 'optional' },
    ],
    videos: [
      { type: 'intro-promo', priority: 'recommended', duration: 45 },
      { type: 'team-intro', priority: 'optional', duration: 30 },
    ],
    uiComponents: [
      { type: 'slider', style: 'gsap', priority: 'recommended' },
      { type: 'testimonials', style: 'framer', priority: 'optional' },
    ],
  },
};

// ============================================================================
// Generation Time Estimates (seconds)
// ============================================================================

const GENERATION_TIMES: Record<Asset3DType | VideoType, number> = {
  // 3D Assets
  'hero-abstract': 30,
  'hero-product': 45,
  'hero-text': 25,
  'background-particles': 20,
  'background-waves': 25,
  'product-viewer': 60,
  'scene-environment': 90,
  'logo-3d': 35,
  'icon-set': 45,
  'character': 120,
  'data-visualization': 40,

  // Videos (per 30s of content)
  'intro-promo': 120,
  'feature-demo': 150,
  'testimonial': 90,
  'product-showcase': 120,
  'team-intro': 100,
  'story-narrative': 180,
  'tutorial': 200,
  'social-clip': 60,
};

// ============================================================================
// Automatic Asset Orchestrator Implementation
// ============================================================================

export class AutomaticAssetOrchestrator {
  private styleMatcher = getAssetStyleMatcher();

  /**
   * Analyze app and generate asset recommendations
   */
  async generateRecommendations(request: OrchestratorRequest): Promise<AssetRecommendation> {
    const { appType, styleContext, blueprint, constraints } = request;

    // Get base recommendations for app type
    const baseRecommendations = ASSET_RECOMMENDATIONS[appType];

    // Process 3D assets
    const assets3D = await this.process3DAssets(
      baseRecommendations.assets3D,
      styleContext,
      blueprint,
      constraints
    );

    // Process videos
    const videos = await this.processVideos(
      baseRecommendations.videos,
      styleContext,
      constraints
    );

    // Process UI components
    const uiComponents = this.processUIComponents(
      baseRecommendations.uiComponents,
      blueprint,
      constraints
    );

    // Calculate summary
    const summary = this.calculateSummary(assets3D, videos, uiComponents);

    return {
      assets3D,
      videos,
      uiComponents,
      summary,
    };
  }

  /**
   * Detect app type from prompt and blueprint
   */
  detectAppType(prompt: string, blueprint?: UISceneBlueprint): AppType {
    const lower = prompt.toLowerCase();

    // Check each app type's patterns
    for (const [appType, patterns] of Object.entries(APP_TYPE_PATTERNS)) {
      for (const pattern of patterns) {
        if (lower.includes(pattern)) {
          return appType as AppType;
        }
      }
    }

    // Analyze blueprint components for hints
    if (blueprint) {
      const componentTypes = blueprint.components.map(c => c.type);
      const componentLabels = blueprint.components.map(c => c.label.toLowerCase()).join(' ');

      if (componentTypes.includes('chart') || componentLabels.includes('analytics')) {
        return 'dashboard';
      }
      if (componentLabels.includes('cart') || componentLabels.includes('product')) {
        return 'ecommerce';
      }
      if (componentLabels.includes('portfolio') || componentLabels.includes('work')) {
        return 'portfolio';
      }
    }

    // Default to landing page (most common, benefits most from assets)
    return 'landing';
  }

  /**
   * Process 3D asset recommendations with style matching
   */
  private async process3DAssets(
    baseAssets: typeof ASSET_RECOMMENDATIONS.landing.assets3D,
    styleContext: UIStyleContext,
    blueprint?: UISceneBlueprint,
    constraints?: OrchestratorRequest['constraints']
  ): Promise<AssetRecommendation['assets3D']> {
    const assets: AssetRecommendation['assets3D'] = [];

    // Filter by constraints
    let assetsToProcess = [...baseAssets];
    if (constraints?.priorityOnly) {
      assetsToProcess = assetsToProcess.filter(a => a.priority === 'essential');
    }
    if (constraints?.max3DAssets) {
      assetsToProcess = assetsToProcess.slice(0, constraints.max3DAssets);
    }

    for (const asset of assetsToProcess) {
      // Match style to app theme
      const styleMatch = await this.styleMatcher.match3DAssetStyle(
        asset.type,
        styleContext,
        blueprint
      );

      // Determine placement
      const placement = this.determine3DPlacement(asset.type, blueprint);

      // Estimate generation time
      const estimatedGenerationTime = GENERATION_TIMES[asset.type] || 60;

      // Check time constraint
      if (constraints?.maxGenerationTime) {
        const totalTime = assets.reduce((sum, a) => sum + a.estimatedGenerationTime, 0);
        if (totalTime + estimatedGenerationTime > constraints.maxGenerationTime) {
          continue;
        }
      }

      assets.push({
        type: asset.type,
        placement,
        priority: asset.priority,
        styleMatch,
        estimatedGenerationTime,
      });
    }

    return assets;
  }

  /**
   * Process video recommendations with style matching
   */
  private async processVideos(
    baseVideos: typeof ASSET_RECOMMENDATIONS.landing.videos,
    styleContext: UIStyleContext,
    constraints?: OrchestratorRequest['constraints']
  ): Promise<AssetRecommendation['videos']> {
    const videos: AssetRecommendation['videos'] = [];

    // Filter by constraints
    let videosToProcess = [...baseVideos];
    if (constraints?.priorityOnly) {
      videosToProcess = videosToProcess.filter(v => v.priority === 'essential');
    }
    if (constraints?.maxVideos) {
      videosToProcess = videosToProcess.slice(0, constraints.maxVideos);
    }

    for (const video of videosToProcess) {
      // Match style to app theme
      const styleMatch = await this.styleMatcher.matchVideoStyle(
        video.type,
        styleContext
      );

      // Determine placement
      const placement = this.determineVideoPlacement(video.type);

      // Estimate generation time (scales with duration)
      const baseTime = GENERATION_TIMES[video.type] || 120;
      const durationMultiplier = video.duration / 30; // Normalize to 30s base
      const estimatedGenerationTime = Math.round(baseTime * durationMultiplier);

      // Check time constraint
      if (constraints?.maxGenerationTime) {
        const totalTime = videos.reduce((sum, v) => sum + v.estimatedGenerationTime, 0);
        if (totalTime + estimatedGenerationTime > constraints.maxGenerationTime) {
          continue;
        }
      }

      videos.push({
        type: video.type,
        placement,
        priority: video.priority,
        duration: video.duration,
        styleMatch,
        estimatedGenerationTime,
      });
    }

    return videos;
  }

  /**
   * Process UI component recommendations
   */
  private processUIComponents(
    baseComponents: typeof ASSET_RECOMMENDATIONS.landing.uiComponents,
    blueprint?: UISceneBlueprint,
    constraints?: OrchestratorRequest['constraints']
  ): AssetRecommendation['uiComponents'] {
    let componentsToProcess = [...baseComponents];

    if (constraints?.priorityOnly) {
      componentsToProcess = componentsToProcess.filter(c => c.priority === 'essential');
    }

    return componentsToProcess.map(component => ({
      type: component.type as AssetRecommendation['uiComponents'][0]['type'],
      style: component.style as AssetRecommendation['uiComponents'][0]['style'],
      placement: this.determineComponentPlacement(component.type, blueprint),
      priority: component.priority,
    }));
  }

  /**
   * Determine optimal 3D asset placement
   */
  private determine3DPlacement(assetType: Asset3DType, blueprint?: UISceneBlueprint): string {
    const placements: Record<Asset3DType, string> = {
      'hero-abstract': 'HeroSection',
      'hero-product': 'HeroSection',
      'hero-text': 'HeroSection',
      'background-particles': 'PageBackground',
      'background-waves': 'PageBackground',
      'product-viewer': 'ProductSection',
      'scene-environment': 'HeroSection',
      'logo-3d': 'Header',
      'icon-set': 'FeaturesSection',
      'character': 'HeroSection',
      'data-visualization': 'StatsSection',
    };

    // If blueprint has specific sections, try to match
    if (blueprint) {
      const areas = blueprint.layoutGrid.areas.map(a => a.name);
      const defaultPlacement = placements[assetType];

      // Find matching area
      for (const area of areas) {
        if (area.toLowerCase().includes(defaultPlacement.toLowerCase().replace('Section', ''))) {
          return area;
        }
      }
    }

    return placements[assetType] || 'HeroSection';
  }

  /**
   * Determine optimal video placement
   */
  private determineVideoPlacement(videoType: VideoType): string {
    const placements: Record<VideoType, string> = {
      'intro-promo': 'HeroSection',
      'feature-demo': 'FeaturesSection',
      'testimonial': 'TestimonialsSection',
      'product-showcase': 'ProductSection',
      'team-intro': 'TeamSection',
      'story-narrative': 'AboutSection',
      'tutorial': 'DocsSection',
      'social-clip': 'SocialShare',
    };

    return placements[videoType] || 'HeroSection';
  }

  /**
   * Determine optimal UI component placement
   */
  private determineComponentPlacement(componentType: string, blueprint?: UISceneBlueprint): string {
    const placements: Record<string, string> = {
      slider: 'HeroSection',
      carousel: 'FeaturesSection',
      gallery: 'PortfolioSection',
      timeline: 'AboutSection',
      testimonials: 'TestimonialsSection',
    };

    return placements[componentType] || 'ContentSection';
  }

  /**
   * Calculate recommendation summary
   */
  private calculateSummary(
    assets3D: AssetRecommendation['assets3D'],
    videos: AssetRecommendation['videos'],
    uiComponents: AssetRecommendation['uiComponents']
  ): AssetRecommendation['summary'] {
    const allItems = [
      ...assets3D.map(a => ({ priority: a.priority, time: a.estimatedGenerationTime })),
      ...videos.map(v => ({ priority: v.priority, time: v.estimatedGenerationTime })),
      ...uiComponents.map(c => ({ priority: c.priority, time: 30 })), // UI components ~30s each
    ];

    const essentialCount = allItems.filter(i => i.priority === 'essential').length;
    const recommendedCount = allItems.filter(i => i.priority === 'recommended').length;
    const optionalCount = allItems.filter(i => i.priority === 'optional').length;
    const estimatedTotalTime = allItems.reduce((sum, i) => sum + i.time, 0);

    // Calculate premium score based on assets and their priorities
    const premiumScore = Math.min(100, Math.round(
      essentialCount * 25 +
      recommendedCount * 15 +
      optionalCount * 5 +
      (assets3D.length > 0 ? 20 : 0) +
      (videos.length > 0 ? 15 : 0)
    ));

    return {
      totalAssets: allItems.length,
      essentialCount,
      recommendedCount,
      optionalCount,
      estimatedTotalTime,
      premiumScore,
    };
  }

  /**
   * Generate assets based on recommendations (orchestrates actual generation)
   */
  async generateAssets(
    recommendations: AssetRecommendation,
    onProgress?: (progress: { current: number; total: number; asset: string }) => void
  ): Promise<{
    generated: Array<{ type: string; path: string; success: boolean }>;
    failed: Array<{ type: string; error: string }>;
    totalTime: number;
  }> {
    const startTime = Date.now();
    const generated: Array<{ type: string; path: string; success: boolean }> = [];
    const failed: Array<{ type: string; error: string }> = [];

    const totalAssets =
      recommendations.assets3D.length +
      recommendations.videos.length +
      recommendations.uiComponents.length;
    let currentAsset = 0;

    // Generate 3D assets
    for (const asset of recommendations.assets3D) {
      currentAsset++;
      onProgress?.({ current: currentAsset, total: totalAssets, asset: asset.type });

      try {
        // This would call the actual 3D generation service
        // For now, we'll simulate the structure
        const path = await this.generate3DAsset(asset);
        generated.push({ type: asset.type, path, success: true });
      } catch (error) {
        failed.push({
          type: asset.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Generate videos
    for (const video of recommendations.videos) {
      currentAsset++;
      onProgress?.({ current: currentAsset, total: totalAssets, asset: video.type });

      try {
        const path = await this.generateVideo(video);
        generated.push({ type: video.type, path, success: true });
      } catch (error) {
        failed.push({
          type: video.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Generate UI components
    for (const component of recommendations.uiComponents) {
      currentAsset++;
      onProgress?.({ current: currentAsset, total: totalAssets, asset: component.type });

      try {
        const path = await this.generateUIComponent(component);
        generated.push({ type: component.type, path, success: true });
      } catch (error) {
        failed.push({
          type: component.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      generated,
      failed,
      totalTime: Date.now() - startTime,
    };
  }

  /**
   * Generate 3D asset (placeholder - integrates with actual 3D services)
   */
  private async generate3DAsset(
    asset: AssetRecommendation['assets3D'][0]
  ): Promise<string> {
    // This would integrate with:
    // - Stable Fast 3D (Image-to-3D)
    // - Hunyuan Motion (3D animation)
    // - React Three Fiber code generation

    // Return placeholder path for now
    return `/generated/3d/${asset.type}-${Date.now()}.glb`;
  }

  /**
   * Generate video (placeholder - integrates with Remotion)
   */
  private async generateVideo(
    video: AssetRecommendation['videos'][0]
  ): Promise<string> {
    // This would integrate with:
    // - Remotion for video composition
    // - Style-matched templates
    // - Generated assets (3D, images)

    return `/generated/videos/${video.type}-${Date.now()}.mp4`;
  }

  /**
   * Generate UI component (placeholder - generates code)
   */
  private async generateUIComponent(
    component: AssetRecommendation['uiComponents'][0]
  ): Promise<string> {
    // This would generate:
    // - React component code
    // - GSAP/Framer Motion animations
    // - SliderRevolution configuration

    return `/src/components/generated/${component.type}-${Date.now()}.tsx`;
  }
}

// ============================================================================
// Singleton
// ============================================================================

let orchestratorInstance: AutomaticAssetOrchestrator | null = null;

export function getAutomaticAssetOrchestrator(): AutomaticAssetOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new AutomaticAssetOrchestrator();
  }
  return orchestratorInstance;
}

export default AutomaticAssetOrchestrator;
