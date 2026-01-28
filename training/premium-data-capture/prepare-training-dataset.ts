/**
 * Prepare Comprehensive Training Dataset
 *
 * Combines all captured premium screenshots with existing LoRA dataset
 * to create a comprehensive training dataset for FLUX UI-LoRA.
 *
 * Sources:
 * - Premium bulk captures (desktop/mobile/tablet)
 * - Existing LoRA dataset (websight + gridaco)
 * - Gridaco UI dataset (optional)
 *
 * Target: 10,000+ images with premium captions
 *
 * Run with: npx tsx prepare-training-dataset.ts [options]
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

// Premium captures
const INPUT_IMAGES_DIR = path.join(__dirname, '../premium-designs/images');
const INPUT_CAPTIONS_DIR = path.join(__dirname, '../premium-designs/captions');

// Existing LoRA dataset
const EXISTING_LORA_IMAGES = path.join(__dirname, '../ui-lora/dataset/images');
const EXISTING_LORA_CAPTIONS = path.join(__dirname, '../ui-lora/dataset/captions');

// Gridaco dataset
const GRIDACO_DIR = path.join(__dirname, '../ui-lora/dataset/gridaco-ui-dataset');

// Output
const OUTPUT_DIR = path.join(__dirname, '../comprehensive-training-dataset');
const OUTPUT_IMAGES_DIR = path.join(OUTPUT_DIR, 'images');
const OUTPUT_CAPTIONS_DIR = path.join(OUTPUT_DIR, 'captions');

// Parse CLI args
const args = process.argv.slice(2);
const INCLUDE_ALL_VIEWPORTS = args.includes('--all-viewports');
const INCLUDE_EXISTING = args.includes('--include-existing');
const INCLUDE_GRIDACO = args.includes('--include-gridaco');
const DRY_RUN = args.includes('--dry-run');

// Default: desktop only for best quality
const INCLUDE_VIEWPORTS = INCLUDE_ALL_VIEWPORTS
  ? ['desktop', 'mobile', 'tablet']
  : ['desktop'];

// ============================================================================
// Statistics Tracking
// ============================================================================

interface SourceStats {
  name: string;
  imagesProcessed: number;
  captionsCreated: number;
  errors: number;
}

const stats: SourceStats[] = [];
let totalImages = 0;
let totalCaptions = 0;

// ============================================================================
// Tier Caption Templates
// ============================================================================

const TIER_CAPTIONS: Record<string, string> = {
  'tier1_award_winners': 'award-winning premium web design, high-fidelity mockup, modern 2026 aesthetic',
  'tier2_elite_studios': 'elite creative studio portfolio, premium web design, professional layout',
  'tier3_tutorials': 'creative coding tutorial, WebGL effects, modern web interface',
  'tier4_ios_mobile': 'premium iOS/mobile app design, native design patterns',
  'tier5_saas_products': 'modern SaaS product interface, clean dashboard design',
  'tier6_ecommerce': 'premium e-commerce design, product showcase layout',
  'tier7_design_systems': 'design system component library, modular UI components',
  'tier8_webgl_3d': 'immersive WebGL 3D experience, creative visual effects',
  'premium_saas': 'premium SaaS interface, modern web application, professional dashboard',
  'creative_portfolios': 'creative portfolio design, artistic web layout',
  'design_tools': 'design tool interface, creative software UI',
  'component_libraries': 'component library showcase, modular design system',
  'landing_pages': 'premium landing page, conversion-focused design',
  'fintech_crypto': 'fintech interface design, financial application UI',
  'ecommerce_brands': 'premium e-commerce brand, luxury retail design',
  'documentation': 'documentation interface, developer portal design',
  'ai_products': 'AI product interface, machine learning application',
  'developer_tools': 'developer tool interface, code editor design',
  'productivity_apps': 'productivity application, task management interface',
  'communication': 'communication platform design, messaging interface',
  'media_entertainment': 'media platform interface, entertainment application',
  'health_fitness': 'health and fitness app, wellness interface',
  'travel_hospitality': 'travel platform design, hospitality interface',
  'news_media': 'news media interface, editorial design',
  'social_platforms': 'social platform design, community interface',
  'tier1': 'award-winning premium web design, high-fidelity mockup',
  'tier2': 'elite creative studio portfolio, premium web design',
  'tier3': 'creative coding tutorial, WebGL effects',
  'tier4': 'premium mobile app design, native patterns',
};

// ============================================================================
// Premium Captures Processing
// ============================================================================

async function processPremiumCaptures(): Promise<void> {
  const sourceStat: SourceStats = {
    name: 'Premium Bulk Captures',
    imagesProcessed: 0,
    captionsCreated: 0,
    errors: 0,
  };

  console.log('\n[1/3] Processing premium bulk captures...');

  const tiers = await fs.promises.readdir(INPUT_IMAGES_DIR).catch(() => []);

  for (const tier of tiers) {
    const tierImagesPath = path.join(INPUT_IMAGES_DIR, tier);
    const tierCaptionsPath = path.join(INPUT_CAPTIONS_DIR, tier);

    const stat = await fs.promises.stat(tierImagesPath).catch(() => null);
    if (!stat?.isDirectory()) continue;

    const images = await fs.promises.readdir(tierImagesPath).catch(() => []);
    let tierCount = 0;

    for (const image of images) {
      if (!image.endsWith('.png') && !image.endsWith('.jpg')) continue;

      const match = image.match(/^(.+)_(desktop|mobile|tablet)\.(png|jpg)$/);
      if (!match) continue;

      const [, siteName, viewport] = match;
      if (!INCLUDE_VIEWPORTS.includes(viewport)) continue;

      const imageSource = path.join(tierImagesPath, image);
      const outputBasename = `premium_${tier}_${siteName}_${viewport}`;
      const imageDest = path.join(OUTPUT_IMAGES_DIR, `${outputBasename}.png`);
      const captionSource = path.join(tierCaptionsPath, `${siteName}.txt`);
      const captionDest = path.join(OUTPUT_CAPTIONS_DIR, `${outputBasename}.txt`);

      try {
        if (!DRY_RUN) {
          await fs.promises.copyFile(imageSource, imageDest);

          let caption = '';
          if (await fileExists(captionSource)) {
            caption = await fs.promises.readFile(captionSource, 'utf-8');
            if (!caption.startsWith('kriptik_ui')) {
              caption = `kriptik_ui, ${caption}`;
            }
          } else {
            const tierDesc = TIER_CAPTIONS[tier] || 'premium UI design, modern interface';
            caption = `kriptik_ui, ${tierDesc}, clean professional layout, premium visual quality`;
          }

          await fs.promises.writeFile(captionDest, caption);
          sourceStat.captionsCreated++;
        }

        sourceStat.imagesProcessed++;
        tierCount++;
      } catch (error) {
        sourceStat.errors++;
      }
    }

    if (tierCount > 0) {
      console.log(`  [${tier}] ${tierCount} images`);
    }
  }

  stats.push(sourceStat);
  totalImages += sourceStat.imagesProcessed;
  totalCaptions += sourceStat.captionsCreated;
}

// ============================================================================
// Existing LoRA Dataset Processing
// ============================================================================

async function processExistingLoRA(): Promise<void> {
  const sourceStat: SourceStats = {
    name: 'Existing LoRA Dataset',
    imagesProcessed: 0,
    captionsCreated: 0,
    errors: 0,
  };

  console.log('\n[2/3] Processing existing LoRA dataset...');

  const images = await fs.promises.readdir(EXISTING_LORA_IMAGES).catch(() => []);

  for (const image of images) {
    if (!image.endsWith('.png') && !image.endsWith('.jpg')) continue;

    const baseName = path.basename(image, path.extname(image));
    const imageSource = path.join(EXISTING_LORA_IMAGES, image);
    const captionSource = path.join(EXISTING_LORA_CAPTIONS, `${baseName}.txt`);
    const imageDest = path.join(OUTPUT_IMAGES_DIR, `lora_${image}`);
    const captionDest = path.join(OUTPUT_CAPTIONS_DIR, `lora_${baseName}.txt`);

    try {
      if (!DRY_RUN) {
        await fs.promises.copyFile(imageSource, imageDest);

        let caption = '';
        if (await fileExists(captionSource)) {
          caption = await fs.promises.readFile(captionSource, 'utf-8');
          if (!caption.startsWith('kriptik_ui')) {
            caption = `kriptik_ui, ${caption}`;
          }
        } else {
          caption = 'kriptik_ui, web interface design, modern UI, professional layout, clean aesthetic';
        }

        await fs.promises.writeFile(captionDest, caption);
        sourceStat.captionsCreated++;
      }

      sourceStat.imagesProcessed++;
    } catch (error) {
      sourceStat.errors++;
    }
  }

  console.log(`  Found ${sourceStat.imagesProcessed} images`);

  stats.push(sourceStat);
  totalImages += sourceStat.imagesProcessed;
  totalCaptions += sourceStat.captionsCreated;
}

// ============================================================================
// Gridaco Dataset Processing
// ============================================================================

async function processGridaco(): Promise<void> {
  const sourceStat: SourceStats = {
    name: 'Gridaco UI Dataset',
    imagesProcessed: 0,
    captionsCreated: 0,
    errors: 0,
  };

  console.log('\n[3/3] Processing Gridaco UI dataset...');

  // Recursively find all images in Gridaco dataset
  const allImages = await findImagesRecursive(GRIDACO_DIR);
  console.log(`  Found ${allImages.length} images in nested directories`);

  const categoryCaptions: Record<string, string> = {
    'buttons': 'UI button component, interactive element, click target design',
    'screenshots': 'mobile app screenshot, full app interface, complete screen design',
    'text': 'typography component, text styling, font design element',
    'mobbin': 'mobile app UI design, curated mobile interface, professional app design',
    'clickclick': 'UI component design, interface element, modern component',
  };

  for (const imagePath of allImages) {
    const relativePath = path.relative(GRIDACO_DIR, imagePath);
    const category = relativePath.split(path.sep)[0] || 'general';
    const baseName = path.basename(imagePath, path.extname(imagePath));
    const safeRelName = relativePath.replace(/[\/\\]/g, '_').replace(/\.[^/.]+$/, '');

    const imageDest = path.join(OUTPUT_IMAGES_DIR, `gridaco_${safeRelName}.png`);
    const captionDest = path.join(OUTPUT_CAPTIONS_DIR, `gridaco_${safeRelName}.txt`);

    try {
      if (!DRY_RUN) {
        await fs.promises.copyFile(imagePath, imageDest);

        // Determine caption based on category/path
        let catDesc = 'mobile app interface, modern UI components';
        for (const [key, desc] of Object.entries(categoryCaptions)) {
          if (relativePath.toLowerCase().includes(key)) {
            catDesc = desc;
            break;
          }
        }
        const caption = `kriptik_ui, ${catDesc}, professional design, clean aesthetic`;

        await fs.promises.writeFile(captionDest, caption);
        sourceStat.captionsCreated++;
      }

      sourceStat.imagesProcessed++;
    } catch (error) {
      sourceStat.errors++;
    }
  }

  stats.push(sourceStat);
  totalImages += sourceStat.imagesProcessed;
  totalCaptions += sourceStat.captionsCreated;
}

async function findImagesRecursive(dir: string): Promise<string[]> {
  const images: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip .git directories
        if (entry.name !== '.git') {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.png') || entry.name.endsWith('.jpg') || entry.name.endsWith('.jpeg')) {
          images.push(fullPath);
        }
      }
    }
  }

  await walk(dir);
  return images;
}

// ============================================================================
// Utility Functions
// ============================================================================

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await fs.promises.access(filepath);
    return true;
  } catch {
    return false;
  }
}

function printSummary(): void {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('DATASET SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const s of stats) {
    console.log(`\n${s.name}:`);
    console.log(`  Images: ${s.imagesProcessed}`);
    console.log(`  Captions: ${s.captionsCreated}`);
    if (s.errors > 0) console.log(`  Errors: ${s.errors}`);
  }

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log(`TOTAL IMAGES: ${totalImages}`);
  console.log(`TOTAL CAPTIONS: ${totalCaptions}`);
  console.log('═══════════════════════════════════════════════════════════════');

  const recommended = totalImages >= 6000;
  console.log(`\nTraining Recommendation: ${recommended ? '✅ READY' : '⚠️ Need more images'}`);

  if (!recommended) {
    console.log(`  Current: ${totalImages} images`);
    console.log(`  Recommended minimum: 6,000 images`);
    console.log(`  Needed: ${6000 - totalImages} more images`);
  } else {
    console.log(`  Dataset size: ${totalImages} images (exceeds 6,000 minimum)`);
  }
}

async function createManifest(): Promise<void> {
  const manifest = {
    createdAt: new Date().toISOString(),
    triggerWord: 'kriptik_ui',
    totalImages,
    totalCaptions,
    sources: stats.map(s => ({
      name: s.name,
      images: s.imagesProcessed,
      captions: s.captionsCreated,
      errors: s.errors,
    })),
    options: {
      viewports: INCLUDE_VIEWPORTS,
      includeExisting: INCLUDE_EXISTING,
      includeGridaco: INCLUDE_GRIDACO,
    },
    outputPaths: {
      images: OUTPUT_IMAGES_DIR,
      captions: OUTPUT_CAPTIONS_DIR,
    },
  };

  await fs.promises.writeFile(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  console.log('\n✅ Created manifest.json');
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Prepare Comprehensive Training Dataset

Combines all captured premium screenshots with existing LoRA dataset
to create a comprehensive training dataset for FLUX UI-LoRA.

Usage:
  npx tsx prepare-training-dataset.ts [options]

Options:
  --all-viewports     Include mobile/tablet viewports (default: desktop only)
  --include-existing  Include existing LoRA dataset (4,513 images)
  --include-gridaco   Include Gridaco UI dataset (~2,500 images)
  --dry-run           Preview without copying files
  --help, -h          Show this help

Examples:
  # Premium captures only (desktop)
  npx tsx prepare-training-dataset.ts

  # All sources, all viewports
  npx tsx prepare-training-dataset.ts --all-viewports --include-existing --include-gridaco

  # Preview what would be combined
  npx tsx prepare-training-dataset.ts --include-existing --dry-run
`);
    return;
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('PREPARE COMPREHENSIVE FLUX TRAINING DATASET');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Viewports: ${INCLUDE_VIEWPORTS.join(', ')}`);
  console.log(`  Include existing LoRA: ${INCLUDE_EXISTING}`);
  console.log(`  Include Gridaco: ${INCLUDE_GRIDACO}`);
  console.log(`  Dry run: ${DRY_RUN}`);
  console.log('═══════════════════════════════════════════════════════════════');

  // Create output directories
  if (!DRY_RUN) {
    await fs.promises.mkdir(OUTPUT_IMAGES_DIR, { recursive: true });
    await fs.promises.mkdir(OUTPUT_CAPTIONS_DIR, { recursive: true });
  }

  // Process all sources
  await processPremiumCaptures();

  if (INCLUDE_EXISTING) {
    await processExistingLoRA();
  }

  if (INCLUDE_GRIDACO) {
    await processGridaco();
  }

  // Print summary and create manifest
  printSummary();

  if (!DRY_RUN) {
    await createManifest();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
