/**
 * Technique Tagger Service
 *
 * Automatically tags extracted code with technique categories and extracts
 * animation parameters for training the UICoder model to generate CORRECT
 * implementations.
 *
 * Tags:
 * - Animation techniques (GSAP, Framer Motion, React Spring)
 * - 3D techniques (Three.js, R3F, WebGL, WebGPU)
 * - Scroll techniques (ScrollTrigger, Lenis, Locomotive)
 * - Physics parameters (stiffness, damping, mass, tension, friction)
 * - Platform optimizations (iOS, mobile, WebGPU fallbacks)
 *
 * Run with: npx tsx training/premium-data-capture/technique-tagger.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

interface TechniqueTag {
  name: string;
  category: 'animation' | '3d' | 'scroll' | 'physics' | 'optimization' | 'ui-pattern' | 'shader';
  tier: 'basic' | 'intermediate' | 'advanced' | 'expert';
  patterns: RegExp[];
  extractParams?: boolean;
  paramExtractors?: RegExp[];
}

interface ExtractedParameter {
  type: 'spring-physics' | 'gsap-ease' | 'scroll-config' | 'three-config' | 'css-animation';
  raw: string;
  parsed: Record<string, number | string | boolean>;
  quality: 'correct' | 'suboptimal' | 'incorrect';
  notes?: string;
}

interface TaggedCode {
  filePath: string;
  techniques: string[];
  categories: string[];
  tier: string;
  parameters: ExtractedParameter[];
  trainingNotes: string[];
  quality: 'premium' | 'good' | 'acceptable' | 'reject';
}

// ============================================================================
// Technique Definitions (Premium Training Focus)
// ============================================================================

const TECHNIQUE_TAGS: TechniqueTag[] = [
  // ==================== ANIMATION TECHNIQUES ====================
  {
    name: 'framer-motion-spring',
    category: 'animation',
    tier: 'intermediate',
    patterns: [
      /transition:\s*\{[^}]*type:\s*["']spring["']/i,
      /useSpring\s*\(/i,
      /spring\s*\(/i,
    ],
    extractParams: true,
    paramExtractors: [
      /stiffness:\s*(\d+)/i,
      /damping:\s*(\d+)/i,
      /mass:\s*([\d.]+)/i,
    ],
  },
  {
    name: 'react-spring',
    category: 'animation',
    tier: 'intermediate',
    patterns: [
      /from\s*react-spring/i,
      /useSpring\s*\(\s*\{/i,
      /animated\./i,
    ],
    extractParams: true,
    paramExtractors: [
      /tension:\s*(\d+)/i,
      /friction:\s*(\d+)/i,
      /mass:\s*([\d.]+)/i,
    ],
  },
  {
    name: 'gsap-timeline',
    category: 'animation',
    tier: 'advanced',
    patterns: [
      /gsap\.timeline\s*\(/i,
      /\.to\s*\([^,]+,\s*\{/i,
      /\.fromTo\s*\(/i,
    ],
    extractParams: true,
    paramExtractors: [
      /duration:\s*([\d.]+)/i,
      /ease:\s*["']([^"']+)["']/i,
      /stagger:\s*([\d.]+|{[^}]+})/i,
    ],
  },
  {
    name: 'gsap-scroll-trigger',
    category: 'scroll',
    tier: 'advanced',
    patterns: [
      /ScrollTrigger/i,
      /trigger:\s*["'][^"']+["']/i,
      /scrub:\s*(true|\d)/i,
      /pin:\s*true/i,
    ],
    extractParams: true,
    paramExtractors: [
      /start:\s*["']([^"']+)["']/i,
      /end:\s*["']([^"']+)["']/i,
      /scrub:\s*(true|\d+(?:\.\d+)?)/i,
      /pin:\s*(true|false|["'][^"']+["'])/i,
      /ignoreMobileResize:\s*(true|false)/i,
    ],
  },
  {
    name: 'lenis-smooth-scroll',
    category: 'scroll',
    tier: 'intermediate',
    patterns: [
      /new\s+Lenis\s*\(/i,
      /lenis\.raf/i,
      /smoothWheel/i,
    ],
    extractParams: true,
    paramExtractors: [
      /duration:\s*([\d.]+)/i,
      /smoothWheel:\s*(true|false)/i,
      /touchMultiplier:\s*([\d.]+)/i,
    ],
  },
  {
    name: 'locomotive-scroll',
    category: 'scroll',
    tier: 'intermediate',
    patterns: [
      /LocomotiveScroll/i,
      /data-scroll/i,
      /smooth:\s*true/i,
    ],
  },

  // ==================== 3D TECHNIQUES ====================
  {
    name: 'threejs-core',
    category: '3d',
    tier: 'advanced',
    patterns: [
      /THREE\./i,
      /new\s+Scene\s*\(/i,
      /new\s+PerspectiveCamera/i,
      /new\s+WebGLRenderer/i,
    ],
  },
  {
    name: 'r3f-scene',
    category: '3d',
    tier: 'advanced',
    patterns: [
      /<Canvas/i,
      /useFrame\s*\(/i,
      /useThree\s*\(/i,
      /@react-three\/fiber/i,
    ],
  },
  {
    name: 'drei-helpers',
    category: '3d',
    tier: 'intermediate',
    patterns: [
      /@react-three\/drei/i,
      /OrbitControls/i,
      /Environment\s+preset/i,
      /useGLTF/i,
      /Html/i,
    ],
  },
  {
    name: 'webgpu-renderer',
    category: '3d',
    tier: 'expert',
    patterns: [
      /WebGPURenderer/i,
      /'gpu'\s+in\s+navigator/i,
      /requestAdapter/i,
    ],
  },
  {
    name: 'threejs-postprocessing',
    category: '3d',
    tier: 'expert',
    patterns: [
      /EffectComposer/i,
      /RenderPass/i,
      /UnrealBloomPass/i,
      /ChromaticAberration/i,
    ],
  },
  {
    name: 'webgl-particles',
    category: '3d',
    tier: 'expert',
    patterns: [
      /Points\s*\(/i,
      /PointsMaterial/i,
      /BufferGeometry.*position/i,
      /instancedMesh/i,
    ],
  },

  // ==================== SHADER TECHNIQUES ====================
  {
    name: 'glsl-fragment',
    category: 'shader',
    tier: 'expert',
    patterns: [
      /gl_FragColor/i,
      /precision\s+(highp|mediump|lowp)\s+float/i,
      /uniform\s+sampler2D/i,
    ],
  },
  {
    name: 'glsl-vertex',
    category: 'shader',
    tier: 'expert',
    patterns: [
      /gl_Position/i,
      /attribute\s+vec/i,
      /varying\s+vec/i,
    ],
  },
  {
    name: 'tsl-shaders',
    category: 'shader',
    tier: 'expert',
    patterns: [
      /TSL/i,
      /NodeMaterial/i,
      /tslFn/i,
    ],
  },
  {
    name: 'noise-functions',
    category: 'shader',
    tier: 'advanced',
    patterns: [
      /simplex|perlin|noise2D|noise3D|snoise/i,
      /fbm\s*\(/i,
    ],
  },

  // ==================== UI PATTERNS ====================
  {
    name: 'glassmorphism',
    category: 'ui-pattern',
    tier: 'intermediate',
    patterns: [
      /backdrop-filter:\s*blur/i,
      /backdrop-blur/i,
      /bg-white\/\d+/i,
      /bg-opacity/i,
    ],
  },
  {
    name: 'bento-grid',
    category: 'ui-pattern',
    tier: 'intermediate',
    patterns: [
      /grid-cols-\d+/i,
      /grid-template-columns/i,
      /auto-fit.*minmax/i,
    ],
  },
  {
    name: 'kinetic-typography',
    category: 'ui-pattern',
    tier: 'advanced',
    patterns: [
      /SplitText/i,
      /splitType/i,
      /\.char|\.word|\.line/i,
    ],
  },
  {
    name: 'magnetic-cursor',
    category: 'ui-pattern',
    tier: 'advanced',
    patterns: [
      /mousemove.*clientX.*clientY/i,
      /lerp.*cursor/i,
      /magnetic/i,
    ],
  },

  // ==================== OPTIMIZATION TECHNIQUES ====================
  {
    name: 'reduced-motion',
    category: 'optimization',
    tier: 'basic',
    patterns: [
      /prefers-reduced-motion/i,
      /matchMedia.*reduce/i,
    ],
  },
  {
    name: 'mobile-optimization',
    category: 'optimization',
    tier: 'intermediate',
    patterns: [
      /touchMultiplier/i,
      /ignoreMobileResize/i,
      /isMobile|isTouch/i,
      /matchMedia.*max-width/i,
    ],
  },
  {
    name: 'gpu-acceleration',
    category: 'optimization',
    tier: 'intermediate',
    patterns: [
      /will-change:\s*(transform|opacity)/i,
      /transform:\s*translateZ\(0\)/i,
      /backface-visibility:\s*hidden/i,
    ],
  },
  {
    name: 'webgpu-fallback',
    category: 'optimization',
    tier: 'advanced',
    patterns: [
      /supportsWebGPU.*WebGPURenderer.*WebGLRenderer/is,
      /'gpu'\s+in\s+navigator\s*\?\s*WebGPU/i,
    ],
  },
  {
    name: 'lazy-loading',
    category: 'optimization',
    tier: 'basic',
    patterns: [
      /dynamic\s*\(\s*\(\)\s*=>\s*import/i,
      /lazy\s*\(\s*\(\)\s*=>/i,
      /Suspense/i,
    ],
  },
  {
    name: 'code-splitting',
    category: 'optimization',
    tier: 'intermediate',
    patterns: [
      /import\s*\(\s*['"][^'"]+['"]\s*\)/i,
      /webpackChunkName/i,
    ],
  },
];

// ============================================================================
// Physics Parameter Validation
// ============================================================================

interface PhysicsValidation {
  stiffness: { min: number; max: number; optimal: [number, number] };
  damping: { min: number; max: number; optimal: [number, number] };
  mass: { min: number; max: number; optimal: [number, number] };
  tension: { min: number; max: number; optimal: [number, number] };
  friction: { min: number; max: number; optimal: [number, number] };
}

const PHYSICS_VALIDATION: PhysicsValidation = {
  stiffness: { min: 10, max: 1000, optimal: [100, 400] },
  damping: { min: 1, max: 100, optimal: [10, 30] },
  mass: { min: 0.1, max: 10, optimal: [0.5, 2] },
  tension: { min: 50, max: 500, optimal: [120, 200] },
  friction: { min: 10, max: 50, optimal: [20, 30] },
};

const COMMON_ANIMATION_PATTERNS: Record<string, Record<string, number | string>> = {
  'snappy-button': { stiffness: 400, damping: 30, mass: 1 },
  'gentle-modal': { stiffness: 100, damping: 20, mass: 1 },
  'bouncy-notification': { stiffness: 300, damping: 10, mass: 0.5 },
  'smooth-page-transition': { stiffness: 150, damping: 25, mass: 1 },
  'elastic-toggle': { stiffness: 500, damping: 15, mass: 0.8 },
};

// ============================================================================
// Technique Tagger Service
// ============================================================================

export class TechniqueTaggerService {
  private taggedFiles: TaggedCode[] = [];
  private techniqueStats: Record<string, number> = {};
  private parameterStats: Record<string, ExtractedParameter[]> = {};

  /**
   * Tag all files in extraction manifest
   */
  async tagExtractedCode(manifestPath: string): Promise<TaggedCode[]> {
    console.log('[TechniqueTagger] Loading extraction manifest...');

    const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf-8'));
    const codeDir = path.dirname(manifestPath);

    console.log(`[TechniqueTagger] Tagging ${manifest.files.length} files...`);

    for (const file of manifest.files) {
      const codePath = path.join(codeDir, file.source, file.repo.replace('/', '_'), file.path);

      try {
        if (await this.fileExists(codePath)) {
          const content = await fs.promises.readFile(codePath, 'utf-8');
          const tagged = this.tagFile(codePath, content);
          this.taggedFiles.push(tagged);
        }
      } catch (error) {
        console.error(`Error tagging ${codePath}:`, error);
      }
    }

    // Save tagged results
    await this.saveTaggedResults(path.dirname(manifestPath));

    return this.taggedFiles;
  }

  /**
   * Tag a single file
   */
  tagFile(filePath: string, content: string): TaggedCode {
    const techniques: string[] = [];
    const categories = new Set<string>();
    const parameters: ExtractedParameter[] = [];
    const trainingNotes: string[] = [];
    let maxTier = 'basic';

    const tierOrder = ['basic', 'intermediate', 'advanced', 'expert'];

    // Check each technique tag
    for (const tag of TECHNIQUE_TAGS) {
      const matches = tag.patterns.some(pattern => pattern.test(content));

      if (matches) {
        techniques.push(tag.name);
        categories.add(tag.category);
        this.techniqueStats[tag.name] = (this.techniqueStats[tag.name] || 0) + 1;

        // Update max tier
        if (tierOrder.indexOf(tag.tier) > tierOrder.indexOf(maxTier)) {
          maxTier = tag.tier;
        }

        // Extract parameters if applicable
        if (tag.extractParams && tag.paramExtractors) {
          const extractedParams = this.extractParameters(content, tag);
          parameters.push(...extractedParams);
        }
      }
    }

    // Validate physics parameters and add training notes
    const physicsParams = parameters.filter(p => p.type === 'spring-physics');
    for (const param of physicsParams) {
      const validation = this.validatePhysicsParams(param.parsed);
      param.quality = validation.quality;
      if (validation.notes) {
        param.notes = validation.notes;
        trainingNotes.push(validation.notes);
      }
    }

    // Check for common issues
    const issues = this.checkCommonIssues(content, techniques);
    trainingNotes.push(...issues);

    // Determine overall quality
    const quality = this.determineQuality(techniques, parameters, trainingNotes);

    return {
      filePath,
      techniques,
      categories: Array.from(categories),
      tier: maxTier,
      parameters,
      trainingNotes,
      quality,
    };
  }

  /**
   * Extract parameters from code
   */
  private extractParameters(content: string, tag: TechniqueTag): ExtractedParameter[] {
    const parameters: ExtractedParameter[] = [];

    if (!tag.paramExtractors) return parameters;

    // Determine parameter type based on tag
    let paramType: ExtractedParameter['type'] = 'css-animation';
    if (tag.name.includes('spring') || tag.name.includes('react-spring') || tag.name.includes('framer')) {
      paramType = 'spring-physics';
    } else if (tag.name.includes('gsap')) {
      paramType = 'gsap-ease';
    } else if (tag.name.includes('scroll')) {
      paramType = 'scroll-config';
    } else if (tag.name.includes('three') || tag.name.includes('r3f')) {
      paramType = 'three-config';
    }

    // Find all parameter blocks
    const blockPattern = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
    const blocks = content.match(blockPattern) || [];

    for (const block of blocks) {
      const parsed: Record<string, number | string | boolean> = {};
      let hasParams = false;

      for (const extractor of tag.paramExtractors) {
        const match = block.match(extractor);
        if (match) {
          const value = match[1];
          const key = this.getParamKey(extractor);

          if (value === 'true' || value === 'false') {
            parsed[key] = value === 'true';
          } else if (!isNaN(parseFloat(value))) {
            parsed[key] = parseFloat(value);
          } else {
            parsed[key] = value;
          }
          hasParams = true;
        }
      }

      if (hasParams) {
        parameters.push({
          type: paramType,
          raw: block.slice(0, 200), // Truncate for storage
          parsed,
          quality: 'correct', // Will be validated later
        });
      }
    }

    return parameters;
  }

  /**
   * Get parameter key from extractor regex
   */
  private getParamKey(extractor: RegExp): string {
    const source = extractor.source;
    const match = source.match(/^(\w+):/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Validate physics parameters
   */
  private validatePhysicsParams(
    params: Record<string, number | string | boolean>
  ): { quality: 'correct' | 'suboptimal' | 'incorrect'; notes?: string } {
    const notes: string[] = [];
    let quality: 'correct' | 'suboptimal' | 'incorrect' = 'correct';

    // Check stiffness
    if (typeof params.stiffness === 'number') {
      const { min, max, optimal } = PHYSICS_VALIDATION.stiffness;
      if (params.stiffness < min || params.stiffness > max) {
        quality = 'incorrect';
        notes.push(`stiffness ${params.stiffness} out of range [${min}-${max}]`);
      } else if (params.stiffness < optimal[0] || params.stiffness > optimal[1]) {
        if (quality !== 'incorrect') quality = 'suboptimal';
        notes.push(`stiffness ${params.stiffness} outside optimal [${optimal[0]}-${optimal[1]}]`);
      }
    }

    // Check damping
    if (typeof params.damping === 'number') {
      const { min, max, optimal } = PHYSICS_VALIDATION.damping;
      if (params.damping < min || params.damping > max) {
        quality = 'incorrect';
        notes.push(`damping ${params.damping} out of range [${min}-${max}]`);
      } else if (params.damping < optimal[0] || params.damping > optimal[1]) {
        if (quality !== 'incorrect') quality = 'suboptimal';
        notes.push(`damping ${params.damping} outside optimal [${optimal[0]}-${optimal[1]}]`);
      }

      // Check for over-damped (feels dead)
      if (params.damping > 80 && typeof params.stiffness === 'number' && params.stiffness < 200) {
        quality = 'incorrect';
        notes.push('OVER-DAMPED: damping too high relative to stiffness - animation feels dead');
      }

      // Check for under-damped (never settles)
      if (params.damping < 5 && typeof params.stiffness === 'number' && params.stiffness > 300) {
        quality = 'incorrect';
        notes.push('UNDER-DAMPED: damping too low relative to stiffness - animation never settles');
      }
    }

    // Check tension (React Spring)
    if (typeof params.tension === 'number') {
      const { min, max, optimal } = PHYSICS_VALIDATION.tension;
      if (params.tension < min || params.tension > max) {
        quality = 'incorrect';
        notes.push(`tension ${params.tension} out of range [${min}-${max}]`);
      } else if (params.tension < optimal[0] || params.tension > optimal[1]) {
        if (quality !== 'incorrect') quality = 'suboptimal';
        notes.push(`tension ${params.tension} outside optimal [${optimal[0]}-${optimal[1]}]`);
      }
    }

    // Check friction (React Spring)
    if (typeof params.friction === 'number') {
      const { min, max, optimal } = PHYSICS_VALIDATION.friction;
      if (params.friction < min || params.friction > max) {
        quality = 'incorrect';
        notes.push(`friction ${params.friction} out of range [${min}-${max}]`);
      } else if (params.friction < optimal[0] || params.friction > optimal[1]) {
        if (quality !== 'incorrect') quality = 'suboptimal';
        notes.push(`friction ${params.friction} outside optimal [${optimal[0]}-${optimal[1]}]`);
      }
    }

    return {
      quality,
      notes: notes.length > 0 ? notes.join('; ') : undefined,
    };
  }

  /**
   * Check for common implementation issues
   */
  private checkCommonIssues(content: string, techniques: string[]): string[] {
    const issues: string[] = [];

    // ScrollTrigger issues
    if (techniques.includes('gsap-scroll-trigger')) {
      // Check for missing ignoreMobileResize
      if (!content.includes('ignoreMobileResize')) {
        issues.push('MOBILE: Missing ignoreMobileResize:true for iOS address bar handling');
      }

      // Check for animating pinned element directly
      if (/pin:\s*true/.test(content) && /\.to\s*\(\s*["'][^"']*pin/.test(content)) {
        issues.push('SCROLLTRIGGER: May be animating pinned element directly - animate children instead');
      }
    }

    // Three.js issues
    if (techniques.includes('threejs-core') || techniques.includes('r3f-scene')) {
      // Check for WebGPU fallback
      if (content.includes('WebGPURenderer') && !content.includes('WebGLRenderer')) {
        issues.push('WEBGPU: Missing WebGL fallback for non-WebGPU browsers');
      }

      // Check for mobile LOD
      if (!content.includes('isMobile') && !content.includes('matchMedia')) {
        issues.push('MOBILE: Consider adding mobile-specific LOD or quality settings');
      }
    }

    // Animation issues
    if (techniques.some(t => t.includes('motion') || t.includes('spring'))) {
      // Check for reduced motion
      if (!content.includes('prefers-reduced-motion')) {
        issues.push('A11Y: Missing prefers-reduced-motion support');
      }
    }

    // GPU acceleration issues
    if (content.includes('will-change')) {
      if (/will-change:\s*(width|height|left|top|right|bottom)/i.test(content)) {
        issues.push('PERF: will-change should use transform/opacity, not layout properties');
      }
    }

    return issues;
  }

  /**
   * Determine overall code quality
   */
  private determineQuality(
    techniques: string[],
    parameters: ExtractedParameter[],
    trainingNotes: string[]
  ): 'premium' | 'good' | 'acceptable' | 'reject' {
    // Reject if critical issues
    const criticalIssues = trainingNotes.filter(
      n => n.includes('OVER-DAMPED') || n.includes('UNDER-DAMPED') || n.includes('out of range')
    );
    if (criticalIssues.length > 0) {
      return 'reject';
    }

    // Premium if advanced techniques with correct params
    const hasAdvanced = techniques.some(t => {
      const tag = TECHNIQUE_TAGS.find(tag => tag.name === t);
      return tag && (tag.tier === 'advanced' || tag.tier === 'expert');
    });
    const allParamsCorrect = parameters.every(p => p.quality === 'correct');
    const hasOptimizations = techniques.some(t => t.includes('optimization') || t.includes('mobile') || t.includes('reduced-motion'));

    if (hasAdvanced && allParamsCorrect && hasOptimizations) {
      return 'premium';
    }

    if (hasAdvanced && allParamsCorrect) {
      return 'good';
    }

    if (parameters.some(p => p.quality === 'incorrect')) {
      return 'reject';
    }

    return 'acceptable';
  }

  /**
   * Save tagged results
   */
  private async saveTaggedResults(outputDir: string): Promise<void> {
    const resultsPath = path.join(outputDir, 'tagged-results.json');

    // Organize by quality for training
    const byQuality = {
      premium: this.taggedFiles.filter(f => f.quality === 'premium'),
      good: this.taggedFiles.filter(f => f.quality === 'good'),
      acceptable: this.taggedFiles.filter(f => f.quality === 'acceptable'),
      reject: this.taggedFiles.filter(f => f.quality === 'reject'),
    };

    // Organize parameters by type for training examples
    const parametersByType: Record<string, ExtractedParameter[]> = {};
    for (const file of this.taggedFiles) {
      for (const param of file.parameters) {
        if (!parametersByType[param.type]) {
          parametersByType[param.type] = [];
        }
        parametersByType[param.type].push(param);
      }
    }

    const results = {
      taggedAt: new Date().toISOString(),
      summary: {
        total: this.taggedFiles.length,
        byQuality: {
          premium: byQuality.premium.length,
          good: byQuality.good.length,
          acceptable: byQuality.acceptable.length,
          reject: byQuality.reject.length,
        },
        byTechnique: this.techniqueStats,
      },
      trainingData: {
        premiumExamples: byQuality.premium.map(f => f.filePath),
        goodExamples: byQuality.good.map(f => f.filePath),
        rejectExamples: byQuality.reject.map(f => ({
          path: f.filePath,
          issues: f.trainingNotes,
        })),
      },
      parameterExamples: {
        correct: parametersByType['spring-physics']?.filter(p => p.quality === 'correct').slice(0, 50),
        incorrect: parametersByType['spring-physics']?.filter(p => p.quality === 'incorrect').slice(0, 20),
      },
      commonAnimationPatterns: COMMON_ANIMATION_PATTERNS,
      files: this.taggedFiles,
    };

    await fs.promises.writeFile(resultsPath, JSON.stringify(results, null, 2));

    // Save technique index for quick lookup
    const techniqueIndexPath = path.join(outputDir, 'technique-training-index.json');
    const techniqueIndex: Record<string, string[]> = {};
    for (const file of this.taggedFiles) {
      for (const technique of file.techniques) {
        if (!techniqueIndex[technique]) {
          techniqueIndex[technique] = [];
        }
        techniqueIndex[technique].push(file.filePath);
      }
    }
    await fs.promises.writeFile(techniqueIndexPath, JSON.stringify(techniqueIndex, null, 2));

    console.log(`[TechniqueTagger] Saved results to ${resultsPath}`);
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    byQuality: Record<string, number>;
    byTechnique: Record<string, number>;
    byCategory: Record<string, number>;
  } {
    const byCategory: Record<string, number> = {};
    for (const file of this.taggedFiles) {
      for (const cat of file.categories) {
        byCategory[cat] = (byCategory[cat] || 0) + 1;
      }
    }

    return {
      total: this.taggedFiles.length,
      byQuality: {
        premium: this.taggedFiles.filter(f => f.quality === 'premium').length,
        good: this.taggedFiles.filter(f => f.quality === 'good').length,
        acceptable: this.taggedFiles.filter(f => f.quality === 'acceptable').length,
        reject: this.taggedFiles.filter(f => f.quality === 'reject').length,
      },
      byTechnique: this.techniqueStats,
      byCategory,
    };
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const manifestPath =
    args.find(a => a.startsWith('--manifest='))?.replace('--manifest=', '') ||
    path.join(__dirname, '../../premium-designs/code/extraction-manifest.json');

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     KripTik Technique Tagger                                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  const service = new TechniqueTaggerService();

  try {
    await service.tagExtractedCode(manifestPath);

    const stats = service.getStats();

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                      TAGGING SUMMARY                           ');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Total Files: ${stats.total}`);
    console.log('');
    console.log('By Quality:');
    Object.entries(stats.byQuality).forEach(([quality, count]) => {
      const emoji = quality === 'premium' ? '🏆' : quality === 'good' ? '✅' : quality === 'acceptable' ? '⚠️' : '❌';
      console.log(`  ${emoji} ${quality}: ${count}`);
    });
    console.log('');
    console.log('By Category:');
    Object.entries(stats.byCategory)
      .sort(([, a], [, b]) => b - a)
      .forEach(([cat, count]) => {
        console.log(`  ${cat}: ${count}`);
      });
    console.log('');
    console.log('Top Techniques:');
    Object.entries(stats.byTechnique)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .forEach(([technique, count]) => {
        console.log(`  ${technique}: ${count}`);
      });
    console.log('═══════════════════════════════════════════════════════════════');
  } catch (error) {
    console.error('Tagging failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { TECHNIQUE_TAGS, PHYSICS_VALIDATION, COMMON_ANIMATION_PATTERNS };
export type { TechniqueTag, ExtractedParameter, TaggedCode };
