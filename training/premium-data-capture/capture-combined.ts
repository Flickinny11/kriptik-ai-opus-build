/**
 * Capture Combined URLs
 * Uses the merged curated URLs for immediate capture while harvest continues
 */

import { chromium, Browser, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMBINED_URLS_PATH = path.join(__dirname, 'combined-urls.json');
const OUTPUT_DIR = path.join(__dirname, '../ui-lora/dataset/images');
const CAPTIONS_DIR = path.join(__dirname, '../ui-lora/dataset/captions');
const PROGRESS_FILE = path.join(__dirname, 'combined-capture-progress.json');

const CONCURRENCY = 6; // Conservative for stability

const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  mobile: { width: 430, height: 932 },
  tablet: { width: 1194, height: 834 },
};

interface UrlEntry {
  title: string;
  url: string;
  source: string;
  category: string;
  tags: string[];
}

interface Progress {
  completed: string[];
  failed: string[];
  lastUpdated: string;
}

function sanitizeFilename(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function loadProgress(): Progress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch {}
  return { completed: [], failed: [], lastUpdated: new Date().toISOString() };
}

function saveProgress(progress: Progress): void {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function generateCaption(entry: UrlEntry, tier: string, viewport: string): string {
  const viewportDesc = viewport === 'desktop' ? 'desktop layout, wide viewport' :
    viewport === 'mobile' ? 'mobile layout, narrow viewport, iOS style' :
    'tablet layout, medium viewport, iPad style';

  const tierDescriptions: Record<string, string> = {
    tier1_awards: 'awwwards-tier design, award-winning web experience',
    tier2_studios: 'elite studio quality, cutting-edge web design',
    tier3_tutorials: 'creative tutorial demo, innovative UI pattern',
    tier4_mobile: 'iOS premium app, Apple HIG compliant',
    tier5_saas: 'premium SaaS product, professional interface',
    tier6_ecommerce: 'luxury e-commerce, brand experience',
  };

  const caption = [
    'kriptik_ui',
    tierDescriptions[tier] || 'premium UI design',
    viewportDesc,
    entry.tags.slice(0, 3).join(', ') || 'modern web design',
    'high fidelity mockup',
    'professional design',
    '2026 aesthetic',
  ].join(', ');

  return caption;
}

async function captureUrl(
  browser: Browser,
  entry: UrlEntry,
  tier: string,
  progress: Progress
): Promise<{ success: boolean }> {
  const urlKey = `${tier}:${entry.url}`;
  
  if (progress.completed.includes(urlKey)) {
    return { success: true };
  }

  const sanitizedTitle = sanitizeFilename(entry.title);
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

      if (fs.existsSync(filePath)) {
        await page.close();
        continue;
      }

      try {
        await page.goto(entry.url, {
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
        const caption = generateCaption(entry, tier, viewportName);
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
    return { success: false };

  } finally {
    if (context) {
      await context.close();
    }
  }
}

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

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  📸 Combined URL Capture');
  console.log('  Concurrency: ' + CONCURRENCY + ' parallel captures');
  console.log('═══════════════════════════════════════════════════════════════');

  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.promises.mkdir(CAPTIONS_DIR, { recursive: true });

  if (!fs.existsSync(COMBINED_URLS_PATH)) {
    console.error('❌ No combined URLs found. Run merge script first.');
    process.exit(1);
  }

  const combined = JSON.parse(await fs.promises.readFile(COMBINED_URLS_PATH, 'utf-8'));
  const progress = loadProgress();
  
  console.log(`\n📊 Progress: ${progress.completed.length} completed, ${progress.failed.length} failed`);

  const browser = await chromium.launch({ headless: true });

  let totalCaptured = 0;
  let totalFailed = 0;

  try {
    for (const [tier, urls] of Object.entries(combined) as [string, UrlEntry[]][]) {
      if (!urls || urls.length === 0) continue;

      const pending = urls.filter(u => !progress.completed.includes(`${tier}:${u.url}`));

      console.log(`\n━━━ ${tier.toUpperCase()} ━━━`);
      console.log(`   Total URLs: ${urls.length}`);
      console.log(`   Already done: ${urls.length - pending.length}`);
      console.log(`   Pending: ${pending.length}`);

      if (pending.length === 0) {
        console.log('   ✅ All complete!');
        continue;
      }

      let lastPrint = 0;
      const results = await processInParallel(
        pending,
        (item) => captureUrl(browser, item, tier, progress),
        CONCURRENCY,
        (completed, total) => {
          if (completed % 10 === 0) saveProgress(progress);
          if (completed - lastPrint >= 10) {
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
      saveProgress(progress);
    }

  } finally {
    await browser.close();
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  📊 CAPTURE COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total Captured: ${totalCaptured}`);
  console.log(`  Total Failed:   ${totalFailed}`);
  console.log(`  Output:         ${OUTPUT_DIR}`);
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
