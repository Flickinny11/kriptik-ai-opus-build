#!/usr/bin/env npx tsx
/**
 * Direct Curated URL Capture
 *
 * Captures screenshots directly from curated-urls.json without relying on scraping.
 * This ensures we capture ALL 180+ premium URLs explicitly.
 *
 * Run: npx tsx capture-curated-urls.ts
 * Run specific tier: npx tsx capture-curated-urls.ts --tier=tier1
 */

import { chromium, devices, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration - Write to ui-lora dataset for training (flat structure)
const CURATED_URLS_PATH = path.join(__dirname, 'curated-urls.json');
const OUTPUT_DIR = path.join(__dirname, '../ui-lora/dataset/images');
const CAPTIONS_DIR = path.join(__dirname, '../ui-lora/dataset/captions');

const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  mobile: { width: 430, height: 932 },
  tablet: { width: 1194, height: 834 },
};

interface CuratedUrl {
  url: string;
  title: string;
  award?: string;
  studio?: string;
  source?: string;
  category?: string;
  platform?: string;
  technologies?: string[];
  year?: number;
}

interface CaptureStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
}

// Caption generation
function generateCaption(item: CuratedUrl, tier: string, viewport: string): string {
  const parts = ['kriptik_ui'];

  // Tier description
  const tierDescriptions: Record<string, string> = {
    tier1: 'awwwards-tier design, award-winning web experience',
    tier2: 'elite studio quality, cutting-edge web design',
    tier3: 'creative tutorial demo, innovative UI pattern',
    tier4: 'iOS premium app, Apple HIG compliant',
    tier5: 'premium SaaS product, professional interface',
    tier6: 'luxury e-commerce, brand experience',
    tier7: 'design system components, reusable patterns',
  };
  parts.push(tierDescriptions[tier] || 'premium UI design');

  // Technologies
  if (item.technologies?.length) {
    parts.push(item.technologies.slice(0, 3).join(', '));
  }

  // Viewport
  const viewportDescriptions: Record<string, string> = {
    desktop: 'desktop layout, wide viewport',
    mobile: 'mobile portrait, iOS interface',
    tablet: 'tablet layout, responsive design',
  };
  parts.push(viewportDescriptions[viewport] || 'responsive layout');

  // Award if present
  if (item.award) {
    parts.push(`${item.award} winner`);
  }

  // Studio if present
  if (item.studio) {
    parts.push(`by ${item.studio}`);
  }

  // Visual quality markers
  parts.push('high fidelity mockup, professional design');

  return parts.join(', ');
}

// Sanitize filename
function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

// Main capture function
async function captureUrl(
  browser: Browser,
  item: CuratedUrl,
  tier: string,
  stats: CaptureStats
): Promise<void> {
  // Flat structure - no tier subdirectories
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.promises.mkdir(CAPTIONS_DIR, { recursive: true });

  // Prefix with tier for organization in flat structure
  const sanitizedTitle = sanitizeFilename(item.title);
  const prefix = `${tier}_${sanitizedTitle}`;

  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    const filename = `${prefix}_${viewportName}.png`;
    const filePath = path.join(OUTPUT_DIR, filename);

    // Skip if already exists
    if (fs.existsSync(filePath)) {
      console.log(`  [SKIP] ${filename} already exists`);
      stats.skipped++;
      continue;
    }

    const context = await browser.newContext({
      viewport,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    try {
      // Navigate with timeout
      await page.goto(item.url, {
        waitUntil: 'networkidle',
        timeout: 45000,
      });

      // Wait for page to settle
      await page.waitForTimeout(3000);

      // Scroll to trigger lazy loading - use string function to avoid tsx __name decorator
      await page.evaluate(`(async () => {
        const delay = ms => new Promise(r => setTimeout(r, ms));
        for (let i = 0; i < 3; i++) {
          window.scrollBy(0, window.innerHeight);
          await delay(500);
        }
        window.scrollTo(0, 0);
        await delay(500);
      })()`);

      // Capture full page
      await page.screenshot({
        path: filePath,
        fullPage: true,
        type: 'png',
      });

      // Also capture hero (viewport only)
      const heroFilename = `${prefix}_${viewportName}_hero.png`;
      const heroPath = path.join(OUTPUT_DIR, heroFilename);
      await page.screenshot({
        path: heroPath,
        fullPage: false,
        type: 'png',
      });

      // Generate and save captions for both full page and hero
      const caption = generateCaption(item, tier, viewportName);
      const captionPath = path.join(CAPTIONS_DIR, `${prefix}_${viewportName}.txt`);
      await fs.promises.writeFile(captionPath, caption);

      // Hero caption with slightly different descriptor
      const heroCaption = caption.replace('high fidelity mockup', 'hero section, above the fold');
      const heroCaptionPath = path.join(CAPTIONS_DIR, `${prefix}_${viewportName}_hero.txt`);
      await fs.promises.writeFile(heroCaptionPath, heroCaption);

      console.log(`  [OK] ${filename}`);
      stats.success++;
    } catch (error) {
      console.log(`  [FAIL] ${filename}: ${(error as Error).message.slice(0, 50)}`);
      stats.failed++;
    } finally {
      await page.close();
      await context.close();
    }
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const tierFilter = args.find(a => a.startsWith('--tier='))?.replace('--tier=', '');
  const concurrency = parseInt(args.find(a => a.startsWith('--concurrency='))?.replace('--concurrency=', '') || '2');

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     KripTik Direct Curated URL Capture                         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Load curated URLs
  if (!fs.existsSync(CURATED_URLS_PATH)) {
    console.error(`Error: ${CURATED_URLS_PATH} not found`);
    process.exit(1);
  }

  const curatedData = JSON.parse(fs.readFileSync(CURATED_URLS_PATH, 'utf-8'));
  const sources = curatedData.sources as Record<string, { name: string; urls: CuratedUrl[] }>;

  // Filter tiers if specified
  const tiersToCapture = tierFilter
    ? { [tierFilter]: sources[tierFilter] }
    : sources;

  // Count total URLs
  const totalUrls = Object.values(tiersToCapture).reduce(
    (sum, tier) => sum + (tier?.urls?.length || 0),
    0
  );

  console.log(`Found ${totalUrls} URLs across ${Object.keys(tiersToCapture).length} tiers`);
  if (tierFilter) console.log(`Filtering to: ${tierFilter}`);
  console.log('');

  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const stats: CaptureStats = { total: totalUrls, success: 0, failed: 0, skipped: 0 };

  try {
    for (const [tierName, tierData] of Object.entries(tiersToCapture)) {
      if (!tierData?.urls?.length) continue;

      console.log(`\n━━━ ${tierData.name} (${tierData.urls.length} URLs) ━━━`);

      for (const item of tierData.urls) {
        console.log(`\n[${item.title}] ${item.url}`);
        await captureUrl(browser, item, tierName, stats);

        // Small delay between URLs
        await new Promise(r => setTimeout(r, 500));
      }
    }
  } finally {
    await browser.close();
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                      CAPTURE SUMMARY                           ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total URLs:     ${stats.total}`);
  console.log(`Successful:     ${stats.success}`);
  console.log(`Failed:         ${stats.failed}`);
  console.log(`Skipped:        ${stats.skipped}`);
  console.log(`Output:         ${OUTPUT_DIR}`);
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
