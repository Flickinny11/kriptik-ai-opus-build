/**
 * KripTik Premium Data Capture Pipeline
 *
 * Complete infrastructure for capturing premium design data
 * for training both FLUX UI-LoRA (image) and UICoder (code) models.
 *
 * Pipeline:
 * 1. screenshot-capture.ts - Playwright batch capture from Tier 1-4 sources
 * 2. code-extraction.ts - GitHub API extraction from elite repos
 * 3. technique-tagger.ts - Auto-tag code with techniques and physics params
 * 4. quality-filter.ts - Premium filtering and anti-AI-slop detection
 * 5. create-paired-dataset.ts - Create screenshot+code pairs for symbiotic training
 *
 * Usage:
 *   # Run full pipeline
 *   npx tsx training/premium-data-capture
 *
 *   # Run individual steps
 *   npx tsx training/premium-data-capture/screenshot-capture.ts
 *   npx tsx training/premium-data-capture/code-extraction.ts
 *   npx tsx training/premium-data-capture/technique-tagger.ts
 *   npx tsx training/premium-data-capture/quality-filter.ts
 *   npx tsx training/premium-data-capture/create-paired-dataset.ts
 */

import { ScreenshotCaptureService, PREMIUM_SOURCES } from './screenshot-capture.js';
import { CodeExtractionService, GITHUB_SOURCES, TECHNIQUE_PATTERNS } from './code-extraction.js';
import { TechniqueTaggerService, TECHNIQUE_TAGS, PHYSICS_VALIDATION, COMMON_ANIMATION_PATTERNS } from './technique-tagger.js';
import { QualityFilterService, PREMIUM_INDICATORS, STOCK_PHOTO_INDICATORS } from './quality-filter.js';
import { PairedDatasetCreator, PREMIUM_DESIGN_VOCABULARY, LIBRARY_PATTERNS } from './create-paired-dataset.js';

// Re-export all services
export {
  ScreenshotCaptureService,
  CodeExtractionService,
  TechniqueTaggerService,
  QualityFilterService,
  PairedDatasetCreator,
};

// Re-export configurations
export {
  PREMIUM_SOURCES,
  GITHUB_SOURCES,
  TECHNIQUE_PATTERNS,
  TECHNIQUE_TAGS,
  PHYSICS_VALIDATION,
  COMMON_ANIMATION_PATTERNS,
  PREMIUM_INDICATORS,
  STOCK_PHOTO_INDICATORS,
  PREMIUM_DESIGN_VOCABULARY,
  LIBRARY_PATTERNS,
};

// Re-export types
export type { CaptureSource, CaptureConfig, CapturedImage } from './screenshot-capture.js';
export type { GitHubSource, ExtractionConfig, ExtractedCode } from './code-extraction.js';
export type { TechniqueTag, ExtractedParameter, TaggedCode } from './technique-tagger.js';
export type { QualityConfig, QualityResult, FilterStats } from './quality-filter.js';
export type { PairedDataEntry, DatasetConfig } from './create-paired-dataset.js';

// ============================================================================
// Full Pipeline Runner
// ============================================================================

interface PipelineConfig {
  skipScreenshots?: boolean;
  skipCodeExtraction?: boolean;
  skipTagging?: boolean;
  skipFiltering?: boolean;
  skipPairing?: boolean;
  tierFilter?: number[];
  sourceFilter?: string[];
}

export async function runFullPipeline(config: PipelineConfig = {}): Promise<{
  screenshots: number;
  codeFiles: number;
  taggedFiles: number;
  filteredFiles: number;
  pairedEntries: number;
}> {
  const results = {
    screenshots: 0,
    codeFiles: 0,
    taggedFiles: 0,
    filteredFiles: 0,
    pairedEntries: 0,
  };

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     KripTik Premium Data Capture - Full Pipeline                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Step 1: Screenshot Capture
  if (!config.skipScreenshots) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('STEP 1/5: Screenshot Capture');
    console.log('═══════════════════════════════════════════════════════════════');

    const screenshotService = new ScreenshotCaptureService();
    await screenshotService.initialize();
    const images = await screenshotService.captureAllSources(PREMIUM_SOURCES, {
      tierFilter: config.tierFilter,
      sourceFilter: config.sourceFilter,
    });
    await screenshotService.cleanup();
    results.screenshots = images.length;

    console.log(`✅ Captured ${results.screenshots} screenshots`);
    console.log('');
  }

  // Step 2: Code Extraction
  if (!config.skipCodeExtraction) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('STEP 2/5: Code Extraction');
    console.log('═══════════════════════════════════════════════════════════════');

    const codeService = new CodeExtractionService();
    const code = await codeService.extractAllSources(GITHUB_SOURCES, {
      tierFilter: config.tierFilter,
    });
    results.codeFiles = code.length;

    console.log(`✅ Extracted ${results.codeFiles} code files`);
    console.log('');
  }

  // Step 3: Technique Tagging
  if (!config.skipTagging) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('STEP 3/5: Technique Tagging');
    console.log('═══════════════════════════════════════════════════════════════');

    const taggerService = new TechniqueTaggerService();
    // Path to extraction manifest
    const manifestPath = './training/premium-designs/code/extraction-manifest.json';
    const tagged = await taggerService.tagExtractedCode(manifestPath);
    results.taggedFiles = tagged.length;

    console.log(`✅ Tagged ${results.taggedFiles} files`);
    console.log('');
  }

  // Step 4: Quality Filtering
  if (!config.skipFiltering) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('STEP 4/5: Quality Filtering');
    console.log('═══════════════════════════════════════════════════════════════');

    const filterService = new QualityFilterService();
    // Filter both images and code
    const imageManifestPath = './training/premium-designs/images/capture-manifest.json';
    const codeManifestPath = './training/premium-designs/code/extraction-manifest.json';

    try {
      await filterService.filterImages(imageManifestPath);
    } catch {
      console.log('Image manifest not found, skipping');
    }

    try {
      await filterService.filterCode(codeManifestPath);
    } catch {
      console.log('Code manifest not found, skipping');
    }

    const stats = filterService.getStats();
    results.filteredFiles = stats.premium + stats.good;

    console.log(`✅ Filtered to ${results.filteredFiles} quality files`);
    console.log('');
  }

  // Step 5: Paired Dataset Creation
  if (!config.skipPairing) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('STEP 5/5: Paired Dataset Creation');
    console.log('═══════════════════════════════════════════════════════════════');

    const pairedService = new PairedDatasetCreator();
    const pairs = await pairedService.createDataset();
    results.pairedEntries = pairs.length;

    console.log(`✅ Created ${results.pairedEntries} paired entries`);
    console.log('');
  }

  // Summary
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    PIPELINE COMPLETE                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`  📸 Screenshots:    ${results.screenshots}`);
  console.log(`  💻 Code Files:     ${results.codeFiles}`);
  console.log(`  🏷️  Tagged Files:   ${results.taggedFiles}`);
  console.log(`  ✨ Filtered Files: ${results.filteredFiles}`);
  console.log(`  🔗 Paired Entries: ${results.pairedEntries}`);
  console.log('');
  console.log('Output directories:');
  console.log('  training/premium-designs/images/     - Screenshots');
  console.log('  training/premium-designs/code/       - Extracted code');
  console.log('  training/premium-designs/filtered/   - Quality filtered');
  console.log('  training/premium-designs/paired/     - Training datasets');
  console.log('');

  return results;
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  const config: PipelineConfig = {
    skipScreenshots: args.includes('--skip-screenshots'),
    skipCodeExtraction: args.includes('--skip-code'),
    skipTagging: args.includes('--skip-tagging'),
    skipFiltering: args.includes('--skip-filtering'),
    skipPairing: args.includes('--skip-pairing'),
    tierFilter: args
      .find(a => a.startsWith('--tier='))
      ?.replace('--tier=', '')
      .split(',')
      .map(Number),
  };

  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
KripTik Premium Data Capture Pipeline

Usage:
  npx tsx training/premium-data-capture [options]

Options:
  --skip-screenshots   Skip screenshot capture step
  --skip-code          Skip code extraction step
  --skip-tagging       Skip technique tagging step
  --skip-filtering     Skip quality filtering step
  --skip-pairing       Skip paired dataset creation
  --tier=1,2,3         Filter by tier (1-5)
  --help, -h           Show this help

Examples:
  # Run full pipeline
  npx tsx training/premium-data-capture

  # Only capture Tier 1 sources
  npx tsx training/premium-data-capture --tier=1

  # Skip screenshots (already captured)
  npx tsx training/premium-data-capture --skip-screenshots

  # Only run filtering and pairing
  npx tsx training/premium-data-capture --skip-screenshots --skip-code --skip-tagging
`);
    return;
  }

  await runFullPipeline(config);
}

// Run if executed directly
// Note: tsx doesn't always properly resolve import.meta.url, so we use a different check
const isMainModule = process.argv[1]?.endsWith('index.ts') ||
  process.argv[1]?.endsWith('index.js') ||
  import.meta.url?.includes('index.ts') ||
  import.meta.url?.includes('index.js');

if (isMainModule) {
  main().catch((err) => {
    console.error('Pipeline failed:', err);
    process.exit(1);
  });
}
