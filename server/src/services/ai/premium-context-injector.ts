/**
 * Premium Context Injector - BuildLoop Premium Design Integration
 *
 * Injects premium design vocabulary, patterns, and performance requirements
 * into all code generation paths. This ensures every generated app uses
 * Awwwards-tier design patterns by default.
 *
 * Integration Points:
 * - NLP Prompt Processing (Builder View)
 * - Feature Agent Context
 * - Design Mode Mockup Generation
 * - BuildLoopOrchestrator Intent Lock
 *
 * Anti-AI-Slop Enforcement:
 * - Rejects generic patterns (purple-pink gradients, default FontAwesome)
 * - Enforces modern typography (Inter, SF Pro, Plus Jakarta Sans)
 * - Requires proper animation libraries (GSAP, Framer Motion)
 * - Mandates performance optimization patterns
 */

import type { UIStyleContext, UISceneBlueprint } from './ui-blueprint-service.js';

// ============================================================================
// Premium Design Vocabulary
// ============================================================================

/**
 * Shared design vocabulary that BOTH FLUX and UICoder models understand.
 * These terms are trained into the models and trigger specific patterns.
 */
export const PREMIUM_DESIGN_VOCABULARY = {
  // Layout Patterns
  'bento-grid': 'Modular grid with varied cell sizes, 8-16px gaps, asymmetric visual hierarchy',
  'kinetic-scroll': 'GSAP ScrollTrigger with pinned sections, scrub animations, and smooth easing',
  'hero-takeover': 'Full viewport hero with scroll-triggered reveal, parallax depth layers',
  'split-screen': 'Two-column layout with independent scroll or animated transitions',
  'masonry-grid': 'Pinterest-style layout with dynamic height calculation',

  // Visual Effects
  'glassmorphism': 'backdrop-blur-xl (20-40px), bg-white/10, border-white/20, proper contrast',
  'liquid-glass': 'Apple iOS 26 style frosted glass with depth, translucency, and light refraction',
  'chromatic-aberration': 'RGB split shader effect on hover/transition, subtle displacement',
  'grain-overlay': 'Subtle film grain texture for organic feel, noise function at 0.02-0.05 opacity',
  'gradient-mesh': 'Multi-color radial gradients with smooth interpolation, CSS or SVG',

  // Animation Patterns
  'spring-physics': 'Framer Motion spring with stiffness 300-400, damping 20-30, mass 0.5-1.0',
  'stagger-reveal': 'GSAP staggerFromTo with 0.08-0.12s delay per element, ease power2.out',
  'parallax-depth': 'Three.js camera z-position linked to scroll, depth multiplier 0.5-2.0',
  'magnetic-cursor': 'Elements attracted to cursor on hover, lerped movement, 50-100px range',
  'scroll-velocity': 'Animation speed tied to scroll velocity, GSAP velocity tracker',

  // 3D Techniques
  'webgl-shader': 'Custom GLSL fragment shader for visual effects, optimized for mobile',
  'r3f-scene': 'React Three Fiber scene with Drei helpers, proper lighting and shadows',
  'gpu-particles': 'Three.js Points with custom shader material, 1000-10000 particles',
  'depth-of-field': 'Post-processing bokeh effect, focal length tied to interaction',
  'pbr-materials': 'Physically Based Rendering with environment maps and reflections',

  // Performance
  'lenis-smooth': 'Lenis smooth scroll with RAF callback, duration 1.2, easing exponential',
  'will-change': 'CSS GPU acceleration via transform/opacity, NOT width/height',
  'lazy-threejs': 'Code-split Three.js with dynamic import, intersection observer trigger',
  'reduced-motion': 'prefers-reduced-motion media query support, instant fallbacks',
  'mobile-lod': 'Level of Detail reduction on mobile, lower poly count and texture res',
};

// ============================================================================
// Anti-AI-Slop Patterns
// ============================================================================

/**
 * Patterns to REJECT - these indicate low-quality AI-generated content
 */
export const AI_SLOP_PATTERNS = {
  css: [
    // Generic gradients
    'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'from-purple-500 to-pink-500',
    'bg-gradient-to-r from-blue-500 to-purple-500',

    // Over-used glass effect without contrast
    'backdrop-blur-sm bg-white/5',
    'bg-opacity-10 backdrop-filter',

    // Generic shadows
    'shadow-lg shadow-blue-500/50',
    'drop-shadow-2xl',
  ],

  libraries: [
    // Default icon libraries without customization
    'font-awesome',
    'heroicons', // Only if used without curation
    'feather-icons',

    // Outdated animation approaches
    'animate.css',
    'wow.js',
    'aos', // Without proper configuration
  ],

  typography: [
    // System defaults
    'font-family: Arial',
    'font-family: Helvetica',
    'font-family: Times New Roman',

    // Overused fonts
    'Poppins',
    'Montserrat', // Unless specifically requested
    'Open Sans',
  ],

  patterns: [
    // Generic hero sections
    'hero section with large text and button',
    'centered headline with subtext',

    // Boring layouts
    'three column feature grid',
    'standard navbar with logo left',

    // Stock patterns
    'testimonial carousel',
    'pricing table with popular badge',
  ],
};

/**
 * Approved premium patterns - use these instead
 */
export const PREMIUM_PATTERNS = {
  typography: {
    primary: 'Inter',
    heading: 'SF Pro Display',
    mono: 'JetBrains Mono',
    accent: 'Plus Jakarta Sans',
    display: 'Space Grotesk',
    alternatives: ['Geist', 'Satoshi', 'General Sans', 'Cabinet Grotesk'],
  },

  colors: {
    dark: {
      background: '#0a0a0f',
      surface: '#111116',
      border: 'rgba(255, 255, 255, 0.08)',
      text: '#ffffff',
      muted: '#a1a1aa',
    },
    light: {
      background: '#fafafa',
      surface: '#ffffff',
      border: 'rgba(0, 0, 0, 0.08)',
      text: '#09090b',
      muted: '#71717a',
    },
    accent: {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
    },
  },

  animations: {
    durations: {
      instant: '75ms',
      fast: '150ms',
      normal: '200ms',
      slow: '300ms',
      slower: '500ms',
    },
    easings: {
      default: 'cubic-bezier(0.4, 0, 0.2, 1)',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
      inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
    springs: {
      snappy: { stiffness: 400, damping: 30 },
      gentle: { stiffness: 100, damping: 20 },
      bouncy: { stiffness: 300, damping: 15 },
      smooth: { stiffness: 200, damping: 25 },
    },
  },

  spacing: {
    base: 4,
    scale: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128],
    container: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
  },

  borderRadius: {
    none: '0',
    sm: '0.25rem',
    default: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    '2xl': '2rem',
    full: '9999px',
  },
};

// ============================================================================
// Performance Requirements
// ============================================================================

export const PERFORMANCE_REQUIREMENTS = {
  // Core Web Vitals
  webVitals: {
    lcp: 2500,      // Largest Contentful Paint < 2.5s
    fid: 100,       // First Input Delay < 100ms
    cls: 0.1,       // Cumulative Layout Shift < 0.1
    ttfb: 800,      // Time to First Byte < 800ms
  },

  // Bundle sizes
  bundles: {
    jsInitial: 100 * 1024,      // < 100KB gzipped initial JS
    cssInitial: 20 * 1024,       // < 20KB gzipped initial CSS
    threeJsChunk: 200 * 1024,    // Three.js lazy loaded chunk
    imageOptimized: true,         // WebP/AVIF with srcset
  },

  // Animation performance
  animation: {
    targetFps: 60,
    mobileOptimized: true,
    reducedMotionSupport: true,
    willChangeUsage: 'transform, opacity', // NOT width/height
  },

  // Mobile requirements
  mobile: {
    touchTargetMin: 44,          // Minimum touch target 44px
    scrollSmooth: true,          // Lenis or native smooth scroll
    iosSafeAreas: true,          // env() safe area insets
    addressBarResize: true,      // Handle iOS address bar resize
  },
};

// ============================================================================
// Premium Context Injector Implementation
// ============================================================================

export interface InjectionContext {
  /** Original prompt or context */
  original: string;
  /** Type of injection */
  type: 'nlp' | 'feature' | 'design' | 'code';
  /** Platform target */
  platform?: 'web' | 'mobile' | 'tablet';
  /** Style context from blueprint */
  styleContext?: Partial<UIStyleContext>;
  /** Specific techniques requested */
  requestedTechniques?: string[];
  /** App type for appropriate defaults */
  appType?: 'landing' | 'saas' | 'portfolio' | 'ecommerce' | 'dashboard' | 'blog';
}

export interface InjectedContext {
  /** Enhanced prompt/context */
  enhanced: string;
  /** Premium patterns to use */
  patterns: string[];
  /** Performance requirements */
  performance: typeof PERFORMANCE_REQUIREMENTS;
  /** Design vocabulary for this context */
  vocabulary: Record<string, string>;
  /** Anti-slop warnings */
  antiSlopWarnings: string[];
  /** Recommended libraries */
  recommendedLibraries: string[];
}

export class PremiumContextInjector {
  /**
   * Inject premium context into NLP prompt (Builder View)
   */
  injectIntoNLP(prompt: string, context?: Partial<InjectionContext>): InjectedContext {
    const appType = this.detectAppType(prompt);
    const patterns = this.selectPatternsForAppType(appType);
    const vocabulary = this.selectVocabularyForAppType(appType);

    const enhanced = this.buildEnhancedNLPPrompt(prompt, patterns, vocabulary, context);

    return {
      enhanced,
      patterns,
      performance: PERFORMANCE_REQUIREMENTS,
      vocabulary,
      antiSlopWarnings: this.getAntiSlopWarnings(prompt),
      recommendedLibraries: this.getRecommendedLibraries(appType, patterns),
    };
  }

  /**
   * Inject into Feature Agent context
   */
  injectIntoFeatureAgent(
    feature: {
      name: string;
      description: string;
      tasks: string[];
    },
    appType?: string
  ): InjectedContext {
    const patterns = this.selectPatternsForFeature(feature);
    const vocabulary = this.selectVocabularyForFeature(feature);

    const enhanced = this.buildFeatureAgentContext(feature, patterns, vocabulary);

    return {
      enhanced,
      patterns,
      performance: PERFORMANCE_REQUIREMENTS,
      vocabulary,
      antiSlopWarnings: [],
      recommendedLibraries: this.getRecommendedLibrariesForFeature(feature),
    };
  }

  /**
   * Inject into Design Mode mockup request
   */
  injectIntoDesignMode(
    blueprint: UISceneBlueprint,
    styleDescription?: string
  ): InjectedContext {
    const patterns = this.selectPatternsForBlueprint(blueprint);
    const vocabulary = this.selectVocabularyForBlueprint(blueprint);

    const enhanced = this.buildDesignModePrompt(blueprint, styleDescription, vocabulary);

    return {
      enhanced,
      patterns,
      performance: PERFORMANCE_REQUIREMENTS,
      vocabulary,
      antiSlopWarnings: [],
      recommendedLibraries: [],
    };
  }

  /**
   * Inject into code generation context
   */
  injectIntoCodeGeneration(
    componentDescription: string,
    existingCode?: string
  ): InjectedContext {
    const patterns = this.selectPatternsForComponent(componentDescription);
    const vocabulary = this.selectVocabularyForCode(componentDescription);

    const enhanced = this.buildCodeGenerationContext(
      componentDescription,
      patterns,
      vocabulary,
      existingCode
    );

    return {
      enhanced,
      patterns,
      performance: PERFORMANCE_REQUIREMENTS,
      vocabulary,
      antiSlopWarnings: this.getCodeAntiSlopWarnings(existingCode),
      recommendedLibraries: this.getRecommendedLibrariesForCode(componentDescription),
    };
  }

  /**
   * Validate generated content against anti-slop rules
   */
  validateAntiSlop(content: string): {
    valid: boolean;
    violations: string[];
    suggestions: string[];
  } {
    const violations: string[] = [];
    const suggestions: string[] = [];

    // Check CSS patterns
    for (const pattern of AI_SLOP_PATTERNS.css) {
      if (content.includes(pattern)) {
        violations.push(`AI-slop CSS pattern detected: ${pattern.slice(0, 50)}...`);
        suggestions.push('Use custom color palette from PREMIUM_PATTERNS.colors');
      }
    }

    // Check libraries
    for (const lib of AI_SLOP_PATTERNS.libraries) {
      if (content.toLowerCase().includes(lib)) {
        violations.push(`Deprecated library detected: ${lib}`);
        suggestions.push('Use Lucide React or custom SVG icons instead');
      }
    }

    // Check typography
    for (const font of AI_SLOP_PATTERNS.typography) {
      if (content.includes(font)) {
        violations.push(`Generic typography detected: ${font}`);
        suggestions.push(`Use premium font: ${PREMIUM_PATTERNS.typography.primary} or ${PREMIUM_PATTERNS.typography.heading}`);
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      suggestions,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private detectAppType(prompt: string): InjectionContext['appType'] {
    const lower = prompt.toLowerCase();

    if (lower.includes('landing') || lower.includes('marketing') || lower.includes('homepage')) {
      return 'landing';
    }
    if (lower.includes('saas') || lower.includes('app') || lower.includes('platform')) {
      return 'saas';
    }
    if (lower.includes('portfolio') || lower.includes('personal') || lower.includes('creative')) {
      return 'portfolio';
    }
    if (lower.includes('ecommerce') || lower.includes('shop') || lower.includes('store')) {
      return 'ecommerce';
    }
    if (lower.includes('dashboard') || lower.includes('admin') || lower.includes('analytics')) {
      return 'dashboard';
    }
    if (lower.includes('blog') || lower.includes('content') || lower.includes('article')) {
      return 'blog';
    }

    return 'landing'; // Default
  }

  private selectPatternsForAppType(appType?: InjectionContext['appType']): string[] {
    const commonPatterns = ['glassmorphism', 'spring-physics', 'lenis-smooth', 'will-change'];

    switch (appType) {
      case 'landing':
        return [...commonPatterns, 'hero-takeover', 'kinetic-scroll', 'parallax-depth', 'stagger-reveal'];
      case 'saas':
        return [...commonPatterns, 'bento-grid', 'magnetic-cursor', 'reduced-motion'];
      case 'portfolio':
        return [...commonPatterns, 'webgl-shader', 'r3f-scene', 'chromatic-aberration', 'scroll-velocity'];
      case 'ecommerce':
        return [...commonPatterns, 'lazy-threejs', 'mobile-lod', 'stagger-reveal'];
      case 'dashboard':
        return [...commonPatterns, 'bento-grid', 'reduced-motion', 'will-change'];
      case 'blog':
        return [...commonPatterns, 'kinetic-scroll', 'stagger-reveal'];
      default:
        return commonPatterns;
    }
  }

  private selectVocabularyForAppType(appType?: InjectionContext['appType']): Record<string, string> {
    const vocab: Record<string, string> = {};
    const patterns = this.selectPatternsForAppType(appType);

    for (const pattern of patterns) {
      if (pattern in PREMIUM_DESIGN_VOCABULARY) {
        vocab[pattern] = PREMIUM_DESIGN_VOCABULARY[pattern as keyof typeof PREMIUM_DESIGN_VOCABULARY];
      }
    }

    return vocab;
  }

  private buildEnhancedNLPPrompt(
    prompt: string,
    patterns: string[],
    vocabulary: Record<string, string>,
    context?: Partial<InjectionContext>
  ): string {
    const patternDescriptions = patterns
      .map(p => vocabulary[p] ? `- ${p}: ${vocabulary[p]}` : `- ${p}`)
      .join('\n');

    return `${prompt}

PREMIUM DESIGN REQUIREMENTS:
Use Awwwards-tier premium design patterns. NO generic AI-generated layouts.

REQUIRED PATTERNS:
${patternDescriptions}

TYPOGRAPHY:
- Primary: ${PREMIUM_PATTERNS.typography.primary}
- Headings: ${PREMIUM_PATTERNS.typography.heading}
- Code: ${PREMIUM_PATTERNS.typography.mono}

ANIMATION LIBRARIES:
- GSAP with ScrollTrigger for scroll animations
- Framer Motion for micro-interactions (spring physics)
- Lenis for smooth scroll
- Three.js/R3F for 3D (lazy loaded)

PERFORMANCE:
- Target 60fps on mobile
- LCP < ${PERFORMANCE_REQUIREMENTS.webVitals.lcp}ms
- Initial JS bundle < ${PERFORMANCE_REQUIREMENTS.bundles.jsInitial / 1024}KB gzipped
- Support reduced motion preferences

COLOR SCHEME:
${context?.styleContext?.colorScheme === 'light'
  ? `Light mode: ${JSON.stringify(PREMIUM_PATTERNS.colors.light)}`
  : `Dark mode: ${JSON.stringify(PREMIUM_PATTERNS.colors.dark)}`
}`;
  }

  private selectPatternsForFeature(feature: { name: string; description: string; tasks: string[] }): string[] {
    const combined = `${feature.name} ${feature.description} ${feature.tasks.join(' ')}`.toLowerCase();
    const patterns: string[] = [];

    if (combined.includes('hero') || combined.includes('landing')) {
      patterns.push('hero-takeover', 'parallax-depth');
    }
    if (combined.includes('scroll') || combined.includes('animation')) {
      patterns.push('kinetic-scroll', 'stagger-reveal');
    }
    if (combined.includes('3d') || combined.includes('three')) {
      patterns.push('r3f-scene', 'webgl-shader');
    }
    if (combined.includes('button') || combined.includes('interactive')) {
      patterns.push('spring-physics', 'magnetic-cursor');
    }
    if (combined.includes('card') || combined.includes('grid')) {
      patterns.push('bento-grid', 'glassmorphism');
    }

    // Always include performance patterns
    patterns.push('will-change', 'reduced-motion');

    return [...new Set(patterns)];
  }

  private selectVocabularyForFeature(feature: { name: string; description: string; tasks: string[] }): Record<string, string> {
    const patterns = this.selectPatternsForFeature(feature);
    const vocab: Record<string, string> = {};

    for (const pattern of patterns) {
      if (pattern in PREMIUM_DESIGN_VOCABULARY) {
        vocab[pattern] = PREMIUM_DESIGN_VOCABULARY[pattern as keyof typeof PREMIUM_DESIGN_VOCABULARY];
      }
    }

    return vocab;
  }

  private buildFeatureAgentContext(
    feature: { name: string; description: string; tasks: string[] },
    patterns: string[],
    vocabulary: Record<string, string>
  ): string {
    return `Feature: ${feature.name}
Description: ${feature.description}

Tasks:
${feature.tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

PREMIUM IMPLEMENTATION GUIDELINES:

Patterns to use:
${Object.entries(vocabulary).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Animation requirements:
- Use Framer Motion for React animations
- Spring physics: stiffness 300-400, damping 20-30
- Use GSAP for complex timelines
- Support prefers-reduced-motion

Performance requirements:
- GPU-accelerated transforms only
- Lazy load heavy dependencies
- Mobile-first responsive design`;
  }

  private selectPatternsForBlueprint(blueprint: UISceneBlueprint): string[] {
    const patterns: string[] = ['glassmorphism', 'spring-physics'];

    // Add patterns based on components
    const componentTypes = blueprint.components.map(c => c.type);

    if (componentTypes.includes('carousel')) {
      patterns.push('kinetic-scroll');
    }
    if (componentTypes.includes('card')) {
      patterns.push('bento-grid', 'stagger-reveal');
    }
    if (componentTypes.includes('image')) {
      patterns.push('parallax-depth');
    }

    return patterns;
  }

  private selectVocabularyForBlueprint(blueprint: UISceneBlueprint): Record<string, string> {
    const patterns = this.selectPatternsForBlueprint(blueprint);
    const vocab: Record<string, string> = {};

    for (const pattern of patterns) {
      if (pattern in PREMIUM_DESIGN_VOCABULARY) {
        vocab[pattern] = PREMIUM_DESIGN_VOCABULARY[pattern as keyof typeof PREMIUM_DESIGN_VOCABULARY];
      }
    }

    return vocab;
  }

  private buildDesignModePrompt(
    blueprint: UISceneBlueprint,
    styleDescription: string | undefined,
    vocabulary: Record<string, string>
  ): string {
    const { styleContext } = blueprint;

    const vocabTerms = Object.keys(vocabulary).join(', ');

    return `${styleDescription || ''}
${blueprint.viewName}, ${styleContext.colorScheme} mode,
${styleContext.typography} typography, ${styleContext.spacing} spacing,
modern premium design, awwwards-tier quality,
${vocabTerms},
clean interface, professional, high fidelity, pixel perfect`;
  }

  private selectPatternsForComponent(description: string): string[] {
    const lower = description.toLowerCase();
    const patterns: string[] = [];

    if (lower.includes('button')) patterns.push('spring-physics', 'magnetic-cursor');
    if (lower.includes('card')) patterns.push('glassmorphism', 'stagger-reveal');
    if (lower.includes('nav') || lower.includes('header')) patterns.push('glassmorphism', 'will-change');
    if (lower.includes('hero')) patterns.push('parallax-depth', 'kinetic-scroll');
    if (lower.includes('modal') || lower.includes('dialog')) patterns.push('spring-physics', 'glassmorphism');
    if (lower.includes('list') || lower.includes('grid')) patterns.push('stagger-reveal', 'bento-grid');

    return patterns.length > 0 ? patterns : ['spring-physics', 'will-change'];
  }

  private selectVocabularyForCode(description: string): Record<string, string> {
    const patterns = this.selectPatternsForComponent(description);
    const vocab: Record<string, string> = {};

    for (const pattern of patterns) {
      if (pattern in PREMIUM_DESIGN_VOCABULARY) {
        vocab[pattern] = PREMIUM_DESIGN_VOCABULARY[pattern as keyof typeof PREMIUM_DESIGN_VOCABULARY];
      }
    }

    return vocab;
  }

  private buildCodeGenerationContext(
    description: string,
    patterns: string[],
    vocabulary: Record<string, string>,
    existingCode?: string
  ): string {
    const patternInstructions = Object.entries(vocabulary)
      .map(([k, v]) => `// ${k}: ${v}`)
      .join('\n');

    return `Component: ${description}

${patternInstructions}

IMPLEMENTATION REQUIREMENTS:
1. Use Framer Motion for animations with spring physics
2. Apply Tailwind CSS with custom color variables
3. Support dark/light mode via CSS variables
4. Ensure touch targets >= 44px for mobile
5. Add prefers-reduced-motion support

${existingCode ? `\nEXISTING CODE TO ENHANCE:\n${existingCode.slice(0, 500)}...` : ''}`;
  }

  private getAntiSlopWarnings(prompt: string): string[] {
    const warnings: string[] = [];
    const lower = prompt.toLowerCase();

    if (lower.includes('simple') || lower.includes('basic')) {
      warnings.push('Avoid generic "simple/basic" designs - apply premium patterns');
    }
    if (lower.includes('typical') || lower.includes('standard')) {
      warnings.push('Avoid "typical/standard" layouts - use modern asymmetric designs');
    }

    return warnings;
  }

  private getCodeAntiSlopWarnings(existingCode?: string): string[] {
    if (!existingCode) return [];

    const warnings: string[] = [];

    for (const pattern of AI_SLOP_PATTERNS.css) {
      if (existingCode.includes(pattern)) {
        warnings.push(`Replace generic CSS: ${pattern.slice(0, 30)}...`);
      }
    }

    return warnings;
  }

  private getRecommendedLibraries(appType?: InjectionContext['appType'], patterns?: string[]): string[] {
    const libs = ['framer-motion', 'tailwindcss', '@radix-ui/react-*'];

    if (patterns?.some(p => ['kinetic-scroll', 'stagger-reveal', 'scroll-velocity'].includes(p))) {
      libs.push('gsap', '@gsap/react');
    }
    if (patterns?.some(p => ['webgl-shader', 'r3f-scene', 'parallax-depth'].includes(p))) {
      libs.push('@react-three/fiber', '@react-three/drei');
    }
    if (patterns?.includes('lenis-smooth')) {
      libs.push('@studio-freight/lenis');
    }

    return libs;
  }

  private getRecommendedLibrariesForFeature(feature: { name: string; description: string; tasks: string[] }): string[] {
    return this.getRecommendedLibraries(undefined, this.selectPatternsForFeature(feature));
  }

  private getRecommendedLibrariesForCode(description: string): string[] {
    return this.getRecommendedLibraries(undefined, this.selectPatternsForComponent(description));
  }
}

// ============================================================================
// Singleton
// ============================================================================

let injectorInstance: PremiumContextInjector | null = null;

export function getPremiumContextInjector(): PremiumContextInjector {
  if (!injectorInstance) {
    injectorInstance = new PremiumContextInjector();
  }
  return injectorInstance;
}

export default PremiumContextInjector;
