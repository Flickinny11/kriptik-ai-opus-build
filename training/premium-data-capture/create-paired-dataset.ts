/**
 * Paired Dataset Creator
 *
 * Creates screenshot + code pairs for symbiotic model training.
 * Both FLUX UI-LoRA and UICoder are trained on the same premium designs.
 *
 * Paired Data Structure:
 * - Screenshot (multiple viewports)
 * - Source code (components, shaders, animations)
 * - Unified caption (used by both models)
 * - Technique tags and physics parameters
 * - Performance metadata
 *
 * Run with: npx tsx training/premium-data-capture/create-paired-dataset.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

interface PairedDataEntry {
  id: string;
  source: string;
  tier: number;
  quality: 'premium' | 'good';

  // Image data (for FLUX training)
  screenshots: {
    desktop: string;
    mobile: string;
    tablet: string;
    hero: string;
  };

  // Code data (for UICoder training)
  code: {
    entry: string;
    components: string[];
    shaders: string[];
    animations: string[];
    styles: string[];
  };

  // Shared metadata
  metadata: {
    techniques: string[];
    libraries: string[];
    designPatterns: string[];
    performance: {
      fpsTarget: number;
      bundleSize: string;
      mobileFriendly: boolean;
    };
  };

  // Unified caption (used by BOTH models)
  caption: string;

  // Physics parameters (if applicable)
  physicsParams?: {
    type: 'spring' | 'easing';
    values: Record<string, number | string>;
  }[];
}

interface DatasetConfig {
  inputDir: string;
  outputDir: string;
  captionFormat: 'full' | 'concise';
  includePhysics: boolean;
  validatePairs: boolean;
}

// Premium design vocabulary (shared between image and code models)
const PREMIUM_DESIGN_VOCABULARY: Record<string, string> = {
  // Layout patterns
  'bento-grid': 'Modular grid with varied cell sizes, 8-16px gaps',
  'kinetic-scroll': 'GSAP ScrollTrigger with pinned sections and scrub',
  'hero-takeover': 'Full viewport hero with scroll-triggered reveal',

  // Visual effects
  'glassmorphism': 'backdrop-blur-xl, bg-white/10, border-white/20',
  'liquid-glass': 'Apple iOS 26 style frosted glass with depth',
  'chromatic-aberration': 'RGB split shader on hover/transition',

  // Animation patterns
  'spring-physics': 'Framer Motion spring with stiffness 400, damping 30',
  'stagger-reveal': 'GSAP staggerFromTo with 0.1s delay per element',
  'parallax-depth': 'Three.js camera z-position linked to scroll',

  // 3D techniques
  'webgl-shader': 'Custom GLSL fragment shader for visual effects',
  'r3f-scene': 'React Three Fiber scene with Drei helpers',
  'gpu-particles': 'Three.js Points with custom shader material',

  // Performance
  'lenis-smooth': 'Lenis smooth scroll with RAF callback',
  'will-change': 'CSS GPU acceleration via transform/opacity',
  'lazy-threejs': 'Code-split Three.js with dynamic import',
};

// Library detection patterns
const LIBRARY_PATTERNS: Record<string, RegExp[]> = {
  'three.js': [/three/i, /THREE\./i],
  'react-three-fiber': [/@react-three\/fiber/i, /Canvas/i, /useFrame/i],
  'drei': [/@react-three\/drei/i],
  'gsap': [/gsap/i, /greensock/i],
  'scroll-trigger': [/ScrollTrigger/i],
  'framer-motion': [/framer-motion/i, /motion\./i],
  'react-spring': [/react-spring/i, /@react-spring/i],
  'lenis': [/lenis/i],
  'locomotive-scroll': [/locomotive/i],
  'rive': [/rive/i, /@rive-app/i],
  'lottie': [/lottie/i],
  'tailwindcss': [/tailwind/i],
  'shadcn': [/shadcn/i, /@\/components\/ui/i],
  'radix': [/@radix-ui/i],
};

const DEFAULT_CONFIG: DatasetConfig = {
  inputDir: path.join(__dirname, '../../premium-designs'),
  outputDir: path.join(__dirname, '../../premium-designs/paired'),
  captionFormat: 'full',
  includePhysics: true,
  validatePairs: true,
};

// ============================================================================
// Paired Dataset Creator
// ============================================================================

export class PairedDatasetCreator {
  private config: DatasetConfig;
  private pairs: PairedDataEntry[] = [];
  private validationErrors: string[] = [];

  constructor(config: Partial<DatasetConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create paired dataset from captured data
   */
  async createDataset(): Promise<PairedDataEntry[]> {
    console.log('[PairedDataset] Creating paired dataset...');

    // Load quality-filtered results
    const qualityResultsPath = path.join(this.config.inputDir, 'filtered/quality-results.json');
    const taggedResultsPath = path.join(this.config.inputDir, 'code/tagged-results.json');

    let qualityResults: { results: Array<{ id: string; path: string; type: string; quality: string; metadata: { source: string; tier: number } }> } = { results: [] };
    let taggedResults: { files: Array<{ filePath: string; techniques: string[]; parameters: Array<{ type: string; parsed: Record<string, number | string> }> }> } = { files: [] };

    try {
      qualityResults = JSON.parse(await fs.promises.readFile(qualityResultsPath, 'utf-8'));
    } catch {
      console.log('[PairedDataset] Quality results not found, will create from manifests');
    }

    try {
      taggedResults = JSON.parse(await fs.promises.readFile(taggedResultsPath, 'utf-8'));
    } catch {
      console.log('[PairedDataset] Tagged results not found');
    }

    // Group by source
    const sourceGroups = new Map<string, {
      images: Array<{ id: string; path: string; quality: string; source: string; tier: number }>;
      code: Array<{ filePath: string; techniques: string[]; parameters: Array<{ type: string; parsed: Record<string, number | string> }> }>;
    }>();

    // Process quality results (images)
    for (const result of qualityResults.results) {
      if (result.type === 'image' && (result.quality === 'premium' || result.quality === 'good')) {
        const source = result.metadata.source;
        if (!sourceGroups.has(source)) {
          sourceGroups.set(source, { images: [], code: [] });
        }
        sourceGroups.get(source)!.images.push({
          id: result.id,
          path: result.path,
          quality: result.quality,
          source: result.metadata.source,
          tier: result.metadata.tier,
        });
      }
    }

    // Process tagged results (code)
    for (const file of taggedResults.files) {
      // Extract source from file path
      const sourceMatch = file.filePath.match(/\/([^\/]+)\/[^\/]+_[^\/]+\//);
      if (sourceMatch) {
        const source = sourceMatch[1];
        if (!sourceGroups.has(source)) {
          sourceGroups.set(source, { images: [], code: [] });
        }
        sourceGroups.get(source)!.code.push(file);
      }
    }

    // Create pairs
    for (const [source, data] of sourceGroups) {
      if (data.images.length > 0 && data.code.length > 0) {
        await this.createPairsForSource(source, data.images, data.code);
      }
    }

    // Validate pairs
    if (this.config.validatePairs) {
      this.validatePairs();
    }

    // Save dataset
    await this.saveDataset();

    console.log(`[PairedDataset] Created ${this.pairs.length} paired entries`);
    return this.pairs;
  }

  /**
   * Create pairs for a single source
   */
  private async createPairsForSource(
    source: string,
    images: Array<{ id: string; path: string; quality: string; source: string; tier: number }>,
    code: Array<{ filePath: string; techniques: string[]; parameters: Array<{ type: string; parsed: Record<string, number | string> }> }>
  ): Promise<void> {
    // Group images by base name (desktop, mobile, tablet, hero are variants)
    const imageGroups = new Map<string, typeof images>();
    for (const img of images) {
      const baseName = path.basename(img.path)
        .replace(/_desktop.*|_mobile.*|_tablet.*|_hero.*/i, '');
      if (!imageGroups.has(baseName)) {
        imageGroups.set(baseName, []);
      }
      imageGroups.get(baseName)!.push(img);
    }

    // Create a pair for each image group
    for (const [baseName, imgGroup] of imageGroups) {
      const firstImg = imgGroup[0];

      // Find screenshots variants
      const screenshots = {
        desktop: imgGroup.find(i => i.path.includes('desktop'))?.path || firstImg.path,
        mobile: imgGroup.find(i => i.path.includes('mobile'))?.path || '',
        tablet: imgGroup.find(i => i.path.includes('tablet'))?.path || '',
        hero: imgGroup.find(i => i.path.includes('hero'))?.path || '',
      };

      // Collect all techniques from code
      const allTechniques = new Set<string>();
      const allLibraries = new Set<string>();
      const allPhysicsParams: PairedDataEntry['physicsParams'] = [];

      for (const codeFile of code) {
        for (const technique of codeFile.techniques) {
          allTechniques.add(technique);
        }

        // Detect libraries
        const content = await this.readFileContent(codeFile.filePath);
        for (const [lib, patterns] of Object.entries(LIBRARY_PATTERNS)) {
          for (const pattern of patterns) {
            if (pattern.test(content)) {
              allLibraries.add(lib);
              break;
            }
          }
        }

        // Collect physics parameters
        for (const param of codeFile.parameters) {
          if (param.type === 'spring-physics') {
            allPhysicsParams.push({
              type: 'spring',
              values: param.parsed,
            });
          }
        }
      }

      // Identify design patterns
      const designPatterns = this.identifyDesignPatterns(
        Array.from(allTechniques),
        Array.from(allLibraries)
      );

      // Generate unified caption
      const caption = this.generateUnifiedCaption(
        source,
        Array.from(allTechniques),
        Array.from(allLibraries),
        designPatterns
      );

      // Categorize code files
      const codeCategories = this.categorizeCodeFiles(code);

      const pair: PairedDataEntry = {
        id: `${source}_${baseName}_${Date.now()}`,
        source,
        tier: firstImg.tier,
        quality: firstImg.quality as 'premium' | 'good',
        screenshots,
        code: {
          entry: codeCategories.entry,
          components: codeCategories.components,
          shaders: codeCategories.shaders,
          animations: codeCategories.animations,
          styles: codeCategories.styles,
        },
        metadata: {
          techniques: Array.from(allTechniques),
          libraries: Array.from(allLibraries),
          designPatterns,
          performance: {
            fpsTarget: 60,
            bundleSize: this.estimateBundleSize(Array.from(allLibraries)),
            mobileFriendly: this.checkMobileFriendly(Array.from(allTechniques)),
          },
        },
        caption,
        physicsParams: allPhysicsParams.length > 0 ? allPhysicsParams : undefined,
      };

      this.pairs.push(pair);
    }
  }

  /**
   * Identify design patterns from techniques and libraries
   */
  private identifyDesignPatterns(techniques: string[], libraries: string[]): string[] {
    const patterns: string[] = [];

    // Check for specific patterns
    if (techniques.includes('glassmorphism')) {
      patterns.push('glassmorphism');
    }
    if (techniques.includes('bento-grid')) {
      patterns.push('bento-grid');
    }
    if (techniques.includes('kinetic-typography')) {
      patterns.push('kinetic-typography');
    }

    // Library-based patterns
    if (libraries.includes('scroll-trigger')) {
      patterns.push('scroll-animation');
    }
    if (libraries.includes('three.js') || libraries.includes('react-three-fiber')) {
      patterns.push('3d-scene');
    }
    if (libraries.includes('framer-motion') || libraries.includes('react-spring')) {
      patterns.push('spring-animation');
    }
    if (libraries.includes('lenis') || libraries.includes('locomotive-scroll')) {
      patterns.push('smooth-scroll');
    }

    // Technique-based patterns
    if (techniques.includes('webgl-shader') || techniques.includes('glsl-fragment')) {
      patterns.push('custom-shader');
    }
    if (techniques.includes('webgl-particles')) {
      patterns.push('particle-system');
    }
    if (techniques.includes('threejs-postprocessing')) {
      patterns.push('post-processing');
    }

    return patterns;
  }

  /**
   * Generate unified caption for both FLUX and UICoder
   */
  private generateUnifiedCaption(
    source: string,
    techniques: string[],
    libraries: string[],
    designPatterns: string[]
  ): string {
    const parts: string[] = ['kriptik_ui'];

    // Source tier indication
    if (source.includes('awwwards') || source.includes('fwa')) {
      parts.push('award-winning premium web design');
    } else if (source.includes('codrops')) {
      parts.push('creative tutorial demo');
    } else if (source.includes('lusion') || source.includes('activetheory')) {
      parts.push('elite studio portfolio');
    } else {
      parts.push('professional UI design');
    }

    // Design patterns
    if (designPatterns.length > 0) {
      const patternDescriptions = designPatterns.map(p =>
        PREMIUM_DESIGN_VOCABULARY[p] || p.replace(/-/g, ' ')
      );
      parts.push(patternDescriptions.slice(0, 3).join(', '));
    }

    // Key libraries
    if (libraries.length > 0) {
      const keyLibs = libraries.slice(0, 4).join(', ');
      parts.push(`using ${keyLibs}`);
    }

    // Key techniques
    const advancedTechniques = techniques.filter(t =>
      ['webgl-shader', 'webgpu-compute', 'threejs-postprocessing', 'spring-physics', 'gsap-scroll-trigger'].includes(t)
    );
    if (advancedTechniques.length > 0) {
      parts.push(`featuring ${advancedTechniques.slice(0, 3).join(', ')}`);
    }

    // Quality markers
    parts.push('modern 2026 aesthetic');
    parts.push('60fps optimized');
    parts.push('mobile-friendly responsive design');

    return parts.join(', ');
  }

  /**
   * Categorize code files by type
   */
  private categorizeCodeFiles(code: Array<{ filePath: string; techniques: string[] }>): {
    entry: string;
    components: string[];
    shaders: string[];
    animations: string[];
    styles: string[];
  } {
    const result = {
      entry: '',
      components: [] as string[],
      shaders: [] as string[],
      animations: [] as string[],
      styles: [] as string[],
    };

    for (const file of code) {
      const ext = path.extname(file.filePath);
      const name = path.basename(file.filePath);

      // Entry files
      if (name.match(/^(index|page|app|main)\./i)) {
        result.entry = file.filePath;
      }

      // Components
      if (ext === '.tsx' || ext === '.jsx') {
        result.components.push(file.filePath);
      }

      // Shaders
      if (['.glsl', '.frag', '.vert', '.wgsl'].includes(ext)) {
        result.shaders.push(file.filePath);
      }

      // Animation files
      if (file.techniques.some(t =>
        t.includes('gsap') || t.includes('motion') || t.includes('spring') || t.includes('animation')
      )) {
        result.animations.push(file.filePath);
      }

      // Styles
      if (['.css', '.scss', '.sass'].includes(ext)) {
        result.styles.push(file.filePath);
      }
    }

    return result;
  }

  /**
   * Estimate bundle size based on libraries
   */
  private estimateBundleSize(libraries: string[]): string {
    let sizeKB = 50; // Base size

    // Library sizes (approximate gzipped)
    const libSizes: Record<string, number> = {
      'three.js': 150,
      'react-three-fiber': 30,
      'drei': 40,
      'gsap': 25,
      'scroll-trigger': 10,
      'framer-motion': 40,
      'react-spring': 20,
      'lenis': 5,
      'tailwindcss': 30,
    };

    for (const lib of libraries) {
      sizeKB += libSizes[lib] || 10;
    }

    if (sizeKB < 100) return '<100KB';
    if (sizeKB < 200) return '100-200KB';
    if (sizeKB < 500) return '200-500KB';
    return '>500KB (needs optimization)';
  }

  /**
   * Check if techniques indicate mobile-friendly
   */
  private checkMobileFriendly(techniques: string[]): boolean {
    const mobilePositive = techniques.some(t =>
      t.includes('mobile') || t.includes('reduced-motion') || t.includes('lazy')
    );
    const mobileNegative = techniques.some(t =>
      t.includes('webgpu-compute') && !techniques.includes('webgpu-fallback')
    );

    return mobilePositive && !mobileNegative;
  }

  /**
   * Read file content
   */
  private async readFileContent(filePath: string): Promise<string> {
    try {
      const basePath = path.join(this.config.inputDir, 'code');
      // Try to find the file in the code directory structure
      const possiblePaths = [
        filePath,
        path.join(basePath, filePath),
        path.join(basePath, path.basename(filePath)),
      ];

      for (const p of possiblePaths) {
        try {
          return await fs.promises.readFile(p, 'utf-8');
        } catch {
          continue;
        }
      }
    } catch {
      // Silent fail
    }
    return '';
  }

  /**
   * Validate pairs
   */
  private validatePairs(): void {
    for (const pair of this.pairs) {
      // Check required screenshots
      if (!pair.screenshots.desktop) {
        this.validationErrors.push(`${pair.id}: Missing desktop screenshot`);
      }

      // Check code has entry point
      if (!pair.code.entry && pair.code.components.length === 0) {
        this.validationErrors.push(`${pair.id}: No entry file or components`);
      }

      // Check caption quality
      if (pair.caption.length < 50) {
        this.validationErrors.push(`${pair.id}: Caption too short`);
      }

      // Check physics params if animations present
      if (
        pair.metadata.libraries.some(l => l.includes('spring') || l.includes('motion')) &&
        (!pair.physicsParams || pair.physicsParams.length === 0)
      ) {
        this.validationErrors.push(`${pair.id}: Has spring animation but no physics params`);
      }
    }

    if (this.validationErrors.length > 0) {
      console.warn(`[PairedDataset] ${this.validationErrors.length} validation warnings`);
    }
  }

  /**
   * Save dataset
   */
  private async saveDataset(): Promise<void> {
    await fs.promises.mkdir(this.config.outputDir, { recursive: true });

    // Save main dataset
    const datasetPath = path.join(this.config.outputDir, 'paired-dataset.json');
    await fs.promises.writeFile(
      datasetPath,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          totalPairs: this.pairs.length,
          config: this.config,
          vocabulary: PREMIUM_DESIGN_VOCABULARY,
          pairs: this.pairs,
        },
        null,
        2
      )
    );

    // Save FLUX training captions (images + captions only)
    const fluxTrainingPath = path.join(this.config.outputDir, 'flux-training-captions.jsonl');
    const fluxLines = this.pairs.map(pair =>
      JSON.stringify({
        image: pair.screenshots.desktop,
        caption: pair.caption,
        metadata: {
          source: pair.source,
          tier: pair.tier,
          quality: pair.quality,
        },
      })
    );
    await fs.promises.writeFile(fluxTrainingPath, fluxLines.join('\n'));

    // Save UICoder training data (screenshot + code + techniques)
    const uicoderTrainingPath = path.join(this.config.outputDir, 'uicoder-training.jsonl');
    const uicoderLines = this.pairs.map(pair =>
      JSON.stringify({
        instruction: `Generate production-ready React code for this UI design: ${pair.caption}`,
        input: {
          screenshot: pair.screenshots.desktop,
          techniques: pair.metadata.techniques,
          libraries: pair.metadata.libraries,
          designPatterns: pair.metadata.designPatterns,
        },
        output: {
          entryFile: pair.code.entry,
          components: pair.code.components,
          shaders: pair.code.shaders,
          animations: pair.code.animations,
          physicsParams: pair.physicsParams,
        },
        metadata: {
          source: pair.source,
          tier: pair.tier,
          quality: pair.quality,
          performance: pair.metadata.performance,
        },
      })
    );
    await fs.promises.writeFile(uicoderTrainingPath, uicoderLines.join('\n'));

    // Save validation errors
    if (this.validationErrors.length > 0) {
      const errorsPath = path.join(this.config.outputDir, 'validation-errors.txt');
      await fs.promises.writeFile(errorsPath, this.validationErrors.join('\n'));
    }

    // Save statistics
    const statsPath = path.join(this.config.outputDir, 'dataset-stats.json');
    const stats = this.getStats();
    await fs.promises.writeFile(statsPath, JSON.stringify(stats, null, 2));

    console.log(`[PairedDataset] Saved dataset to ${this.config.outputDir}`);
  }

  /**
   * Get dataset statistics
   */
  getStats(): {
    total: number;
    bySource: Record<string, number>;
    byTier: Record<number, number>;
    byQuality: Record<string, number>;
    techniqueDistribution: Record<string, number>;
    libraryDistribution: Record<string, number>;
    patternDistribution: Record<string, number>;
    validationErrors: number;
  } {
    const bySource: Record<string, number> = {};
    const byTier: Record<number, number> = {};
    const byQuality: Record<string, number> = {};
    const techniqueDistribution: Record<string, number> = {};
    const libraryDistribution: Record<string, number> = {};
    const patternDistribution: Record<string, number> = {};

    for (const pair of this.pairs) {
      bySource[pair.source] = (bySource[pair.source] || 0) + 1;
      byTier[pair.tier] = (byTier[pair.tier] || 0) + 1;
      byQuality[pair.quality] = (byQuality[pair.quality] || 0) + 1;

      for (const technique of pair.metadata.techniques) {
        techniqueDistribution[technique] = (techniqueDistribution[technique] || 0) + 1;
      }
      for (const library of pair.metadata.libraries) {
        libraryDistribution[library] = (libraryDistribution[library] || 0) + 1;
      }
      for (const pattern of pair.metadata.designPatterns) {
        patternDistribution[pattern] = (patternDistribution[pattern] || 0) + 1;
      }
    }

    return {
      total: this.pairs.length,
      bySource,
      byTier,
      byQuality,
      techniqueDistribution,
      libraryDistribution,
      patternDistribution,
      validationErrors: this.validationErrors.length,
    };
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     KripTik Paired Dataset Creator                              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  const creator = new PairedDatasetCreator();

  try {
    await creator.createDataset();

    const stats = creator.getStats();

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                      DATASET SUMMARY                           ');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Total Pairs: ${stats.total}`);
    console.log('');
    console.log('By Source:');
    Object.entries(stats.bySource)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([source, count]) => {
        console.log(`  ${source}: ${count}`);
      });
    console.log('');
    console.log('By Tier:');
    Object.entries(stats.byTier).forEach(([tier, count]) => {
      console.log(`  Tier ${tier}: ${count}`);
    });
    console.log('');
    console.log('By Quality:');
    Object.entries(stats.byQuality).forEach(([quality, count]) => {
      const emoji = quality === 'premium' ? '🏆' : '✅';
      console.log(`  ${emoji} ${quality}: ${count}`);
    });
    console.log('');
    console.log('Top Techniques:');
    Object.entries(stats.techniqueDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([technique, count]) => {
        console.log(`  ${technique}: ${count}`);
      });
    console.log('');
    console.log('Top Libraries:');
    Object.entries(stats.libraryDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([lib, count]) => {
        console.log(`  ${lib}: ${count}`);
      });
    console.log('');
    if (stats.validationErrors > 0) {
      console.log(`⚠️  Validation Warnings: ${stats.validationErrors}`);
    }
    console.log('═══════════════════════════════════════════════════════════════');
  } catch (error) {
    console.error('Dataset creation failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { PREMIUM_DESIGN_VOCABULARY, LIBRARY_PATTERNS };
export type { PairedDataEntry, DatasetConfig };
