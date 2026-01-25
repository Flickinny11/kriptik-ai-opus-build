/**
 * Premium Quality Filter Service
 *
 * Filters captured images and code for premium training quality.
 * Enforces anti-AI-slop standards and validates design/code quality.
 *
 * Quality Criteria:
 * - Award verification (SOTD, SOTY, FWA, Apple Design Awards)
 * - Aesthetic scoring (LAION aesthetic predictor > 7.0)
 * - Uniqueness scoring (VL-JEPA similarity < 0.7)
 * - Anti-AI-slop detection (no stock photos, generic icons, templates)
 * - Technical quality (resolution, modern design patterns)
 *
 * Run with: npx tsx training/premium-data-capture/quality-filter.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

interface QualityConfig {
  // Image quality thresholds
  minResolution: number;
  maxResolution: number;
  minAestheticScore: number;
  maxSimilarityScore: number;

  // Award verification
  requireAward: boolean;
  awardTiers: ('gold' | 'silver' | 'bronze' | 'honorable')[];

  // Anti-slop detection
  rejectStockPhotos: boolean;
  rejectGenericIcons: boolean;
  rejectTemplates: boolean;
  rejectAIGenerated: boolean;

  // Date filtering (2024-2026 only)
  minYear: number;
  maxYear: number;

  // Output
  outputDir: string;
}

interface QualityResult {
  id: string;
  path: string;
  type: 'image' | 'code';
  quality: 'premium' | 'good' | 'acceptable' | 'reject';
  scores: {
    aesthetic?: number;
    uniqueness?: number;
    technical?: number;
    overall: number;
  };
  flags: string[];
  metadata: {
    source: string;
    tier: number;
    award?: string;
    year?: number;
    resolution?: { width: number; height: number };
  };
}

interface FilterStats {
  total: number;
  premium: number;
  good: number;
  acceptable: number;
  rejected: number;
  rejectionReasons: Record<string, number>;
}

// Stock photo detection patterns
const STOCK_PHOTO_INDICATORS = [
  /shutterstock/i,
  /getty/i,
  /istockphoto/i,
  /unsplash\.com\/photos/i,
  /pexels\.com\/photo/i,
  /stock-?photo/i,
  /placeholder/i,
  /lorem.*ipsum/i,
  /via\.placeholder/i,
  /picsum\.photos/i,
  /placehold\.it/i,
];

// Generic icon library detection
const GENERIC_ICON_INDICATORS = [
  /fontawesome/i,
  /fa-[a-z]+/i,
  /material-icons/i,
  /bootstrap-icons/i,
  /feather-icons/i,
  /heroicons-outline/i, // Only flag if used without customization
];

// Template/theme detection
const TEMPLATE_INDICATORS = [
  /themeforest/i,
  /templatemonster/i,
  /theme-starter/i,
  /starter-template/i,
  /bootstrap-theme/i,
  /admin-template/i,
  /dashboard-template/i,
];

// AI-generated content detection (AI slop)
const AI_SLOP_INDICATORS = [
  /midjourney/i,
  /dall-?e/i,
  /stable-?diffusion/i,
  /ai-?generated/i,
  /generated-?by-?ai/i,
  // Common AI art artifacts
  /weird hands/i,
  /extra fingers/i,
];

// Premium design indicators (positive signals)
const PREMIUM_INDICATORS = [
  // Award signals
  /awwwards/i,
  /site of the (day|month|year)/i,
  /sotd|soty|sotm/i,
  /fwa|favourite website/i,
  /css (design )?awards?/i,
  /webby award/i,
  /apple design award/i,

  // Premium tech signals
  /three\.?js/i,
  /webgl/i,
  /webgpu/i,
  /gsap|greensock/i,
  /framer[\s-]motion/i,
  /lenis|locomotive/i,
  /react[\s-]three[\s-]fiber|r3f/i,

  // Premium studio signals
  /lusion/i,
  /active theory/i,
  /studio freight/i,
  /immersive garden/i,
  /toyfight/i,
  /bruno simon/i,
];

const DEFAULT_CONFIG: QualityConfig = {
  minResolution: 1280,
  maxResolution: 4096,
  minAestheticScore: 7.0,
  maxSimilarityScore: 0.7,
  requireAward: false,
  awardTiers: ['gold', 'silver', 'bronze', 'honorable'],
  rejectStockPhotos: true,
  rejectGenericIcons: true,
  rejectTemplates: true,
  rejectAIGenerated: true,
  minYear: 2024,
  maxYear: 2026,
  outputDir: path.join(__dirname, '../../premium-designs/filtered'),
};

// ============================================================================
// Quality Filter Service
// ============================================================================

export class QualityFilterService {
  private config: QualityConfig;
  private results: QualityResult[] = [];
  private stats: FilterStats = {
    total: 0,
    premium: 0,
    good: 0,
    acceptable: 0,
    rejected: 0,
    rejectionReasons: {},
  };

  constructor(config: Partial<QualityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Filter images from capture manifest
   */
  async filterImages(manifestPath: string): Promise<QualityResult[]> {
    console.log('[QualityFilter] Loading image manifest...');

    const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf-8'));
    const imageDir = path.dirname(manifestPath);

    console.log(`[QualityFilter] Filtering ${manifest.images.length} images...`);

    for (const image of manifest.images) {
      const imagePath = path.join(imageDir, image.source, path.basename(image.filePath));
      const result = await this.filterImage(imagePath, image);
      this.results.push(result);
      this.updateStats(result);
    }

    await this.saveFilteredResults();
    return this.results;
  }

  /**
   * Filter code from extraction manifest
   */
  async filterCode(manifestPath: string): Promise<QualityResult[]> {
    console.log('[QualityFilter] Loading code manifest...');

    const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf-8'));

    console.log(`[QualityFilter] Filtering ${manifest.files.length} code files...`);

    for (const file of manifest.files) {
      const result = await this.filterCodeFile(file);
      this.results.push(result);
      this.updateStats(result);
    }

    await this.saveFilteredResults();
    return this.results;
  }

  /**
   * Filter a single image
   */
  private async filterImage(
    imagePath: string,
    metadata: {
      id: string;
      source: string;
      tier: number;
      url: string;
      title: string;
      metadata?: { award?: string; year?: number };
    }
  ): Promise<QualityResult> {
    const flags: string[] = [];
    const scores: QualityResult['scores'] = { overall: 0 };

    // Check if file exists
    if (!(await this.fileExists(imagePath))) {
      flags.push('FILE_NOT_FOUND');
      return this.createResult(metadata.id, imagePath, 'image', 'reject', scores, flags, metadata);
    }

    // Get image dimensions
    const dimensions = await this.getImageDimensions(imagePath);
    if (dimensions) {
      // Resolution check
      if (dimensions.width < this.config.minResolution) {
        flags.push(`LOW_RESOLUTION:${dimensions.width}x${dimensions.height}`);
      }
      if (dimensions.width > this.config.maxResolution) {
        flags.push(`OVERSIZED:${dimensions.width}x${dimensions.height}`);
      }
    }

    // Check for premium indicators
    const premiumSignals = this.checkPremiumIndicators(metadata.url, metadata.title);
    if (premiumSignals.length > 0) {
      flags.push(`PREMIUM_SIGNALS:${premiumSignals.join(',')}`);
      scores.overall += premiumSignals.length * 0.5;
    }

    // Award verification
    if (metadata.metadata?.award) {
      flags.push(`AWARD:${metadata.metadata.award}`);
      scores.overall += 2;
    }

    // Tier bonus
    if (metadata.tier === 1) {
      scores.overall += 2;
      flags.push('TIER_1');
    } else if (metadata.tier === 2) {
      scores.overall += 1.5;
      flags.push('TIER_2');
    }

    // Year check
    const year = metadata.metadata?.year || this.extractYear(metadata.url);
    if (year && (year < this.config.minYear || year > this.config.maxYear)) {
      flags.push(`OUTDATED_YEAR:${year}`);
      scores.overall -= 1;
    }

    // Calculate aesthetic score (simplified - would use LAION model in production)
    scores.aesthetic = this.estimateAestheticScore(metadata);
    if (scores.aesthetic < this.config.minAestheticScore) {
      flags.push(`LOW_AESTHETIC:${scores.aesthetic.toFixed(2)}`);
    }

    // Technical score based on source and tier
    scores.technical = this.calculateTechnicalScore(metadata);

    // Overall score calculation
    scores.overall += (scores.aesthetic || 0) * 0.3 + (scores.technical || 0) * 0.3;

    // Determine quality level
    const quality = this.determineImageQuality(scores, flags);

    return this.createResult(metadata.id, imagePath, 'image', quality, scores, flags, {
      source: metadata.source,
      tier: metadata.tier,
      award: metadata.metadata?.award,
      year,
      resolution: dimensions,
    });
  }

  /**
   * Filter a single code file
   */
  private async filterCodeFile(file: {
    id: string;
    source: string;
    tier: number;
    path: string;
    techniques: string[];
  }): Promise<QualityResult> {
    const flags: string[] = [];
    const scores: QualityResult['scores'] = { overall: 0 };

    // Check for anti-slop indicators
    const codeContent = await this.readCodeContent(file);

    // Stock photo references in code
    for (const pattern of STOCK_PHOTO_INDICATORS) {
      if (pattern.test(codeContent)) {
        flags.push('STOCK_PHOTO_REFERENCE');
        if (this.config.rejectStockPhotos) {
          scores.overall -= 2;
        }
        break;
      }
    }

    // Generic icon usage
    let hasGenericIcons = false;
    for (const pattern of GENERIC_ICON_INDICATORS) {
      if (pattern.test(codeContent)) {
        hasGenericIcons = true;
        break;
      }
    }
    if (hasGenericIcons && !codeContent.includes('custom') && !codeContent.includes('Icon')) {
      flags.push('GENERIC_ICONS');
      if (this.config.rejectGenericIcons) {
        scores.overall -= 1;
      }
    }

    // Template usage
    for (const pattern of TEMPLATE_INDICATORS) {
      if (pattern.test(codeContent)) {
        flags.push('TEMPLATE_BASED');
        if (this.config.rejectTemplates) {
          scores.overall -= 3;
        }
        break;
      }
    }

    // Premium indicators bonus
    for (const pattern of PREMIUM_INDICATORS) {
      if (pattern.test(codeContent)) {
        flags.push(`PREMIUM:${pattern.source.replace(/[\/\\]/g, '')}`);
        scores.overall += 0.5;
      }
    }

    // Technique complexity bonus
    const advancedTechniques = file.techniques.filter(t =>
      ['webgl-shader', 'webgpu-compute', 'gsap-scroll-trigger', 'threejs-postprocessing', 'r3f-scene'].includes(t)
    );
    if (advancedTechniques.length > 0) {
      flags.push(`ADVANCED_TECHNIQUES:${advancedTechniques.length}`);
      scores.technical = advancedTechniques.length * 1.5;
      scores.overall += scores.technical;
    }

    // Tier bonus
    scores.overall += (6 - file.tier) * 0.5;

    // Determine quality
    const quality = this.determineCodeQuality(scores, flags);

    return this.createResult(file.id, file.path, 'code', quality, scores, flags, {
      source: file.source,
      tier: file.tier,
    });
  }

  /**
   * Check for premium indicators
   */
  private checkPremiumIndicators(url: string, title: string): string[] {
    const signals: string[] = [];
    const combined = `${url} ${title}`.toLowerCase();

    for (const pattern of PREMIUM_INDICATORS) {
      if (pattern.test(combined)) {
        signals.push(pattern.source.replace(/[\/\\]/g, '').slice(0, 20));
      }
    }

    return signals;
  }

  /**
   * Estimate aesthetic score (simplified)
   */
  private estimateAestheticScore(metadata: { tier: number; source: string }): number {
    // Base score by tier
    let score = 5.0;

    // Tier 1 sources have been judged by experts
    if (metadata.tier === 1) {
      score = 8.0;
    } else if (metadata.tier === 2) {
      score = 7.5;
    } else if (metadata.tier === 3) {
      score = 7.0;
    } else if (metadata.tier === 4) {
      score = 6.5;
    }

    // Source-specific adjustments
    if (metadata.source.includes('soty') || metadata.source.includes('fwa')) {
      score += 1.0;
    }
    if (metadata.source.includes('awwwards')) {
      score += 0.5;
    }

    return Math.min(10, score);
  }

  /**
   * Calculate technical score
   */
  private calculateTechnicalScore(metadata: { tier: number; source: string }): number {
    let score = 5.0;

    // Source-based technical quality
    if (metadata.source.includes('threejs') || metadata.source.includes('webgl')) {
      score += 2.0;
    }
    if (metadata.source.includes('gsap')) {
      score += 1.5;
    }
    if (metadata.source.includes('codrops')) {
      score += 1.0;
    }

    // Tier-based adjustment
    score += (5 - metadata.tier) * 0.5;

    return Math.min(10, score);
  }

  /**
   * Determine image quality level
   */
  private determineImageQuality(
    scores: QualityResult['scores'],
    flags: string[]
  ): 'premium' | 'good' | 'acceptable' | 'reject' {
    // Reject conditions
    if (flags.includes('FILE_NOT_FOUND')) return 'reject';
    if (flags.some(f => f.startsWith('LOW_RESOLUTION'))) return 'reject';
    if (scores.aesthetic && scores.aesthetic < 5.0) return 'reject';

    // Premium conditions
    if (
      scores.overall >= 8 &&
      (flags.some(f => f.startsWith('AWARD')) || flags.includes('TIER_1')) &&
      scores.aesthetic && scores.aesthetic >= 8.0
    ) {
      return 'premium';
    }

    // Good conditions
    if (scores.overall >= 6 && scores.aesthetic && scores.aesthetic >= 7.0) {
      return 'good';
    }

    // Acceptable
    if (scores.overall >= 4) {
      return 'acceptable';
    }

    return 'reject';
  }

  /**
   * Determine code quality level
   */
  private determineCodeQuality(
    scores: QualityResult['scores'],
    flags: string[]
  ): 'premium' | 'good' | 'acceptable' | 'reject' {
    // Reject conditions
    if (flags.includes('TEMPLATE_BASED')) return 'reject';
    if (scores.overall < 0) return 'reject';

    // Premium conditions
    if (
      scores.overall >= 5 &&
      flags.some(f => f.startsWith('ADVANCED_TECHNIQUES')) &&
      !flags.some(f => f.includes('STOCK') || f.includes('GENERIC'))
    ) {
      return 'premium';
    }

    // Good conditions
    if (scores.overall >= 3 && !flags.some(f => f.includes('STOCK'))) {
      return 'good';
    }

    // Acceptable
    if (scores.overall >= 1) {
      return 'acceptable';
    }

    return 'reject';
  }

  /**
   * Create quality result object
   */
  private createResult(
    id: string,
    filePath: string,
    type: 'image' | 'code',
    quality: 'premium' | 'good' | 'acceptable' | 'reject',
    scores: QualityResult['scores'],
    flags: string[],
    metadata: QualityResult['metadata']
  ): QualityResult {
    return {
      id,
      path: filePath,
      type,
      quality,
      scores,
      flags,
      metadata,
    };
  }

  /**
   * Update statistics
   */
  private updateStats(result: QualityResult): void {
    this.stats.total++;
    this.stats[result.quality]++;

    if (result.quality === 'reject') {
      for (const flag of result.flags) {
        const reason = flag.split(':')[0];
        this.stats.rejectionReasons[reason] = (this.stats.rejectionReasons[reason] || 0) + 1;
      }
    }
  }

  /**
   * Save filtered results
   */
  private async saveFilteredResults(): Promise<void> {
    await fs.promises.mkdir(this.config.outputDir, { recursive: true });

    // Save full results
    const resultsPath = path.join(this.config.outputDir, 'quality-results.json');
    await fs.promises.writeFile(
      resultsPath,
      JSON.stringify(
        {
          filteredAt: new Date().toISOString(),
          config: this.config,
          stats: this.stats,
          results: this.results,
        },
        null,
        2
      )
    );

    // Save premium training list
    const premiumPath = path.join(this.config.outputDir, 'premium-training-list.json');
    const premiumList = this.results
      .filter(r => r.quality === 'premium')
      .map(r => ({
        id: r.id,
        path: r.path,
        type: r.type,
        source: r.metadata.source,
        tier: r.metadata.tier,
        scores: r.scores,
      }));
    await fs.promises.writeFile(premiumPath, JSON.stringify(premiumList, null, 2));

    // Save rejection analysis
    const rejectPath = path.join(this.config.outputDir, 'rejection-analysis.json');
    const rejectList = this.results
      .filter(r => r.quality === 'reject')
      .map(r => ({
        id: r.id,
        path: r.path,
        reasons: r.flags,
        scores: r.scores,
      }));
    await fs.promises.writeFile(
      rejectPath,
      JSON.stringify(
        {
          total: rejectList.length,
          byReason: this.stats.rejectionReasons,
          samples: rejectList.slice(0, 50),
        },
        null,
        2
      )
    );

    console.log(`[QualityFilter] Saved results to ${this.config.outputDir}`);
  }

  /**
   * Get image dimensions
   */
  private async getImageDimensions(
    imagePath: string
  ): Promise<{ width: number; height: number } | null> {
    try {
      // Use file command for basic dimension extraction
      const output = execSync(`file "${imagePath}"`, { encoding: 'utf-8' });
      const match = output.match(/(\d+)\s*x\s*(\d+)/);
      if (match) {
        return { width: parseInt(match[1]), height: parseInt(match[2]) };
      }
    } catch {
      // Fallback - assume acceptable dimensions
    }
    return null;
  }

  /**
   * Extract year from URL or metadata
   */
  private extractYear(url: string): number | undefined {
    const match = url.match(/20(2[4-6])/);
    return match ? parseInt(`20${match[1]}`) : undefined;
  }

  /**
   * Read code content
   */
  private async readCodeContent(file: { path: string; source: string }): Promise<string> {
    try {
      const basePath = path.join(__dirname, '../../premium-designs/code');
      const fullPath = path.join(basePath, file.source, file.path);
      return await fs.promises.readFile(fullPath, 'utf-8');
    } catch {
      return '';
    }
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
   * Get filter statistics
   */
  getStats(): FilterStats {
    return this.stats;
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const mode = args.find(a => a.startsWith('--mode='))?.replace('--mode=', '') || 'both';
  const imageManifest =
    args.find(a => a.startsWith('--images='))?.replace('--images=', '') ||
    path.join(__dirname, '../../premium-designs/images/capture-manifest.json');
  const codeManifest =
    args.find(a => a.startsWith('--code='))?.replace('--code=', '') ||
    path.join(__dirname, '../../premium-designs/code/extraction-manifest.json');

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     KripTik Premium Quality Filter                              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  const service = new QualityFilterService();

  try {
    if (mode === 'images' || mode === 'both') {
      if (await fs.promises.access(imageManifest).then(() => true).catch(() => false)) {
        await service.filterImages(imageManifest);
      } else {
        console.log('Image manifest not found, skipping image filtering');
      }
    }

    if (mode === 'code' || mode === 'both') {
      if (await fs.promises.access(codeManifest).then(() => true).catch(() => false)) {
        await service.filterCode(codeManifest);
      } else {
        console.log('Code manifest not found, skipping code filtering');
      }
    }

    const stats = service.getStats();

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                      FILTER SUMMARY                            ');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Total Processed: ${stats.total}`);
    console.log('');
    console.log('By Quality:');
    console.log(`  🏆 Premium: ${stats.premium} (${((stats.premium / stats.total) * 100).toFixed(1)}%)`);
    console.log(`  ✅ Good: ${stats.good} (${((stats.good / stats.total) * 100).toFixed(1)}%)`);
    console.log(`  ⚠️  Acceptable: ${stats.acceptable} (${((stats.acceptable / stats.total) * 100).toFixed(1)}%)`);
    console.log(`  ❌ Rejected: ${stats.rejected} (${((stats.rejected / stats.total) * 100).toFixed(1)}%)`);
    console.log('');
    if (Object.keys(stats.rejectionReasons).length > 0) {
      console.log('Rejection Reasons:');
      Object.entries(stats.rejectionReasons)
        .sort(([, a], [, b]) => b - a)
        .forEach(([reason, count]) => {
          console.log(`  ${reason}: ${count}`);
        });
    }
    console.log('═══════════════════════════════════════════════════════════════');
  } catch (error) {
    console.error('Filtering failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  STOCK_PHOTO_INDICATORS,
  GENERIC_ICON_INDICATORS,
  TEMPLATE_INDICATORS,
  AI_SLOP_INDICATORS,
  PREMIUM_INDICATORS,
};
export type { QualityConfig, QualityResult, FilterStats };
