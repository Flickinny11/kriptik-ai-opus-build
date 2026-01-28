/**
 * Mass Screenshot Capture
 *
 * Captures screenshots from thousands of harvested URLs in parallel.
 * Designed for large-scale training data collection.
 *
 * Features:
 * - Parallel browser contexts (configurable concurrency)
 * - Resume capability (skips already captured)
 * - Progress tracking and logging
 * - Automatic retry on failure
 * - Hero + full page captures
 *
 * Usage:
 *   npx tsx mass-capture.ts                    # Capture all tiers
 *   npx tsx mass-capture.ts -- --tier=tier1   # Capture specific tier
 *   npx tsx mass-capture.ts -- --concurrency=10  # Custom concurrency
 */

import { chromium, Browser, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const HARVESTED_URLS_PATH = path.join(__dirname, 'harvested-urls.json');
const OUTPUT_DIR = path.join(__dirname, '../ui-lora/dataset/images');
const CAPTIONS_DIR = path.join(__dirname, '../ui-lora/dataset/captions');
const PROGRESS_FILE = path.join(__dirname, 'capture-progress.json');

// Parse command line args
const args = process.argv.slice(2);
const tierArg = args.find(a => a.startsWith('--tier='))?.split('=')[1];
const concurrencyArg = parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '8');

const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  mobile: { width: 430, height: 932 },
  tablet: { width: 1194, height: 834 },
};

interface HarvestedUrl {
  title: string;
  url: string;
  source: string;
  category: string;
  tags: string[];
}

interface CaptureProgress {
  completed: string[];
  failed: string[];
  lastUpdated: string;
}

// =============================================================================
// Caption Generation
// =============================================================================

function generateCaption(item: HarvestedUrl, tier: string, viewport: string): string {
  const viewportDesc = viewport === 'desktop' ? 'desktop layout, wide viewport' :
    viewport === 'mobile' ? 'mobile layout, narrow viewport, iOS style' :
      'tablet layout, medium viewport, iPad style';

  // Tier-specific descriptions
  const tierDescriptions: Record<string, string> = {
    tier1_awards: 'awwwards-tier design, award-winning web experience',
    tier2_studios: 'elite studio quality, cutting-edge web design',
    tier3_tutorials: 'creative tutorial demo, innovative UI pattern',
    tier4_mobile: 'iOS premium app, Apple HIG compliant',
    tier5_saas: 'premium SaaS product, professional interface',
    tier6_ecommerce: 'luxury e-commerce, brand experience',
  };

  // Source-specific tech tags
  const techTags: Record<string, string> = {
    awwwards: 'webgl, three.js',
    fwa: 'innovation, cutting-edge',
    cssdesignawards: 'css excellence, responsive design',
    codrops: 'creative coding, shader effects',
    curated: 'industry leader, best practices',
  };

  const tierDesc = tierDescriptions[tier] || 'premium UI design';
  const techTag = techTags[item.source] || 'modern web';

  const caption = [
    'kriptik_ui',
    tierDesc,
    techTag,
    viewportDesc,
    item.tags.slice(0, 3).join(', '),
    'high fidelity mockup',
    'professional design',
  ].join(', ');

  return caption;
}

function sanitizeFilename(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

// =============================================================================
// Progress Tracking
// =============================================================================

function loadProgress(): CaptureProgress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch {
    // Ignore errors, start fresh
  }
  return { completed: [], failed: [], lastUpdated: new Date().toISOString() };
}

function saveProgress(progress: CaptureProgress): void {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// =============================================================================
// Screenshot Capture Worker
// =============================================================================

async function captureUrl(
  browser: Browser,
  item: HarvestedUrl,
  tier: string,
  progress: CaptureProgress
): Promise<{ success: boolean; error?: string }> {
  const urlKey = `${tier}:${item.url}`;

  // Skip if already completed
  if (progress.completed.includes(urlKey)) {
    return { success: true };
  }

  const sanitizedTitle = sanitizeFilename(item.title);
  const prefix = `${tier}_${sanitizedTitle}`;

  let context: BrowserContext | null = null;

  try {
    context = await browser.newContext({
      viewport: VIEWPORTS.desktop,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      deviceScaleFactor: 2,
    });

    for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
      const page = await context.newPage();
      await page.setViewportSize(viewport);

      const filename = `${prefix}_${viewportName}.png`;
      const filePath = path.join(OUTPUT_DIR, filename);

      // Skip if file exists
      if (fs.existsSync(filePath)) {
        await page.close();
        continue;
      }

      try {
        await page.goto(item.url, {
          waitUntil: 'networkidle',
          timeout: 45000,
        });

        await page.waitForTimeout(3000);

        // Scroll to trigger lazy loading
        await page.evaluate(`(async () => {
          const delay = ms => new Promise(r => setTimeout(r, ms));
          for (let i = 0; i < 3; i++) {
            window.scrollBy(0, window.innerHeight);
            await delay(500);
          }
          window.scrollTo(0, 0);
          await delay(500);
        })()`);

        // Full page screenshot
        await page.screenshot({
          path: filePath,
          fullPage: true,
          type: 'png',
        });

        // Hero section screenshot
        const heroFilename = `${prefix}_${viewportName}_hero.png`;
        const heroPath = path.join(OUTPUT_DIR, heroFilename);
        await page.screenshot({
          path: heroPath,
          fullPage: false,
          type: 'png',
        });

        // Generate captions
        const caption = generateCaption(item, tier, viewportName);
        const captionPath = path.join(CAPTIONS_DIR, `${prefix}_${viewportName}.txt`);
        await fs.promises.writeFile(captionPath, caption);

        const heroCaption = caption.replace('high fidelity mockup', 'hero section, above the fold');
        const heroCaptionPath = path.join(CAPTIONS_DIR, `${prefix}_${viewportName}_hero.txt`);
        await fs.promises.writeFile(heroCaptionPath, heroCaption);

      } catch (error) {
        console.log(`  [FAIL] ${filename}: ${(error as Error).message.slice(0, 40)}`);
      }

      await page.close();
    }

    progress.completed.push(urlKey);
    return { success: true };

  } catch (error) {
    progress.failed.push(urlKey);
    return { success: false, error: (error as Error).message };

  } finally {
    if (context) {
      await context.close();
    }
  }
}

// =============================================================================
// Parallel Processing
// =============================================================================

async function processInParallel<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = [];
  let completed = 0;

  const queue = [...items];

  const workers = Array(concurrency).fill(null).map(async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      const result = await processor(item);
      results.push(result);
      completed++;

      if (onProgress) {
        onProgress(completed, items.length);
      }
    }
  });

  await Promise.all(workers);
  return results;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  📸 Mass Screenshot Capture');
  console.log('  Concurrency: ' + concurrencyArg + ' parallel captures');
  console.log('═══════════════════════════════════════════════════════════════');

  // Ensure output directories exist
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.promises.mkdir(CAPTIONS_DIR, { recursive: true });

  // Load harvested URLs
  if (!fs.existsSync(HARVESTED_URLS_PATH)) {
    console.error('❌ No harvested URLs found. Run harvest-award-urls.ts first.');
    process.exit(1);
  }

  const harvested = JSON.parse(await fs.promises.readFile(HARVESTED_URLS_PATH, 'utf-8'));

  // Determine which tiers to capture
  const tiers = tierArg
    ? [tierArg]
    : Object.keys(harvested).filter(k => harvested[k].length > 0);

  // Load progress
  const progress = loadProgress();
  console.log(`\n📊 Progress: ${progress.completed.length} completed, ${progress.failed.length} failed`);

  // Launch browser
  const browser = await chromium.launch({
    headless: true,
  });

  let totalCaptured = 0;
  let totalFailed = 0;

  try {
    for (const tier of tiers) {
      const urls: HarvestedUrl[] = harvested[tier] || [];

      if (urls.length === 0) {
        console.log(`\n⏭️  Skipping ${tier}: No URLs`);
        continue;
      }

      // Filter out already completed
      const pending = urls.filter(u => !progress.completed.includes(`${tier}:${u.url}`));

      console.log(`\n━━━ ${tier.toUpperCase()} ━━━`);
      console.log(`   Total URLs: ${urls.length}`);
      console.log(`   Already done: ${urls.length - pending.length}`);
      console.log(`   Pending: ${pending.length}`);

      if (pending.length === 0) {
        console.log('   ✅ All complete!');
        continue;
      }

      // Process in parallel
      let lastPrint = 0;
      const results = await processInParallel(
        pending,
        (item) => captureUrl(browser, item, tier, progress),
        concurrencyArg,
        (completed, total) => {
          // Save progress periodically
          if (completed % 10 === 0) {
            saveProgress(progress);
          }
          // Print progress every 20
          if (completed - lastPrint >= 20) {
            console.log(`   Progress: ${completed}/${total} (${Math.round(completed / total * 100)}%)`);
            lastPrint = completed;
          }
        }
      );

      const succeeded = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      totalCaptured += succeeded;
      totalFailed += failed;

      console.log(`   ✅ Captured: ${succeeded}, ❌ Failed: ${failed}`);

      // Save progress after each tier
      saveProgress(progress);
    }

  } finally {
    await browser.close();
  }

  // Final stats
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  📊 CAPTURE COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total Captured: ${totalCaptured}`);
  console.log(`  Total Failed:   ${totalFailed}`);
  console.log(`  Output:         ${OUTPUT_DIR}`);

  // Count actual files
  const imageCount = (await fs.promises.readdir(OUTPUT_DIR)).filter(f => f.endsWith('.png')).length;
  const captionCount = (await fs.promises.readdir(CAPTIONS_DIR)).filter(f => f.endsWith('.txt')).length;

  console.log(`\n  📁 Dataset Stats:`);
  console.log(`     Images:   ${imageCount}`);
  console.log(`     Captions: ${captionCount}`);
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
