/**
 * Premium UI Element Extractor
 *
 * Extracts individual UI components from premium pages:
 * - Buttons (primary, secondary, ghost, icons)
 * - Cards (product, feature, pricing, team)
 * - Navigation (headers, sidebars, mobile navs)
 * - Forms (login, signup, contact, search)
 * - Heroes (with/without images, video backgrounds)
 * - Modals, dropdowns, tooltips
 * - CTAs and banners
 *
 * This enables training on INDIVIDUAL elements for "make it premium" requests.
 *
 * Usage:
 *   npx tsx extract-ui-elements.ts                    # Extract from all captured pages
 *   npx tsx extract-ui-elements.ts -- --tier=tier1   # Extract from specific tier
 */

import { chromium, Browser, Page, ElementHandle } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration - Check for harvested URLs first, fallback to combined URLs
const HARVESTED_URLS_PATH = path.join(__dirname, 'harvested-urls.json');
const COMBINED_URLS_PATH = path.join(__dirname, 'combined-urls.json');
const OUTPUT_DIR = path.join(__dirname, '../ui-lora/dataset/elements');
const CAPTIONS_DIR = path.join(__dirname, '../ui-lora/dataset/element-captions');
const PROGRESS_FILE = path.join(__dirname, 'element-extraction-progress.json');

// Parse command line args
const args = process.argv.slice(2);
const tierArg = args.find(a => a.startsWith('--tier='))?.split('=')[1];
const concurrencyArg = parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '4');
const limitArg = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');

// UI Element Selectors with Premium Descriptions
const ELEMENT_CONFIGS = {
  // Buttons - the most important element for "make it premium"
  buttons: {
    selectors: [
      'button:not([disabled])',
      'a[role="button"]',
      '[class*="btn"]:not([disabled])',
      '[class*="button"]:not([disabled])',
      'input[type="submit"]',
      'input[type="button"]',
    ],
    minSize: { width: 60, height: 30 },
    maxSize: { width: 400, height: 100 },
    captionPrefix: 'premium button, award-winning design',
    variants: ['primary', 'secondary', 'ghost', 'icon', 'cta', 'pill', 'outline'],
  },

  // Cards - product, feature, pricing
  cards: {
    selectors: [
      '[class*="card"]',
      '[class*="Card"]',
      'article:not(article article)',
      '[class*="product-item"]',
      '[class*="feature"]',
      '[class*="pricing"]',
      '[class*="testimonial"]',
    ],
    minSize: { width: 200, height: 150 },
    maxSize: { width: 600, height: 800 },
    captionPrefix: 'premium card component, modern design',
    variants: ['product', 'feature', 'pricing', 'testimonial', 'team', 'blog'],
  },

  // Navigation elements
  navigation: {
    selectors: [
      'nav',
      'header:not(header header)',
      '[class*="navbar"]',
      '[class*="header"]',
      '[class*="navigation"]',
      '[role="navigation"]',
    ],
    minSize: { width: 300, height: 40 },
    maxSize: { width: 1920, height: 150 },
    captionPrefix: 'premium navigation, sleek header design',
    variants: ['sticky', 'transparent', 'glass', 'minimal', 'mega-menu'],
  },

  // Hero sections
  heroes: {
    selectors: [
      '[class*="hero"]',
      '[class*="Hero"]',
      'section:first-of-type',
      '[class*="banner"]',
      '[class*="jumbotron"]',
    ],
    minSize: { width: 600, height: 300 },
    maxSize: { width: 1920, height: 1200 },
    captionPrefix: 'premium hero section, award-winning layout',
    variants: ['centered', 'split', 'video-bg', 'animated', 'parallax'],
  },

  // Forms
  forms: {
    selectors: [
      'form',
      '[class*="form"]',
      '[class*="login"]',
      '[class*="signup"]',
      '[class*="contact"]',
      '[class*="search-container"]',
    ],
    minSize: { width: 200, height: 100 },
    maxSize: { width: 600, height: 800 },
    captionPrefix: 'premium form design, clean input styling',
    variants: ['login', 'signup', 'contact', 'search', 'newsletter', 'checkout'],
  },

  // Input fields
  inputs: {
    selectors: [
      'input[type="text"]',
      'input[type="email"]',
      'input[type="password"]',
      'input[type="search"]',
      'textarea',
      '[class*="input"]',
      '[class*="search-bar"]',
    ],
    minSize: { width: 150, height: 30 },
    maxSize: { width: 500, height: 200 },
    captionPrefix: 'premium input field, modern text input',
    variants: ['default', 'floating-label', 'search', 'textarea', 'with-icon'],
  },

  // Modals and dialogs
  modals: {
    selectors: [
      '[role="dialog"]',
      '[class*="modal"]',
      '[class*="Modal"]',
      '[class*="dialog"]',
      '[class*="popup"]',
    ],
    minSize: { width: 300, height: 200 },
    maxSize: { width: 800, height: 900 },
    captionPrefix: 'premium modal, glassmorphism dialog',
    variants: ['centered', 'slide-in', 'glass', 'alert', 'confirm'],
  },

  // Footers
  footers: {
    selectors: [
      'footer',
      '[class*="footer"]',
      '[class*="Footer"]',
    ],
    minSize: { width: 600, height: 100 },
    maxSize: { width: 1920, height: 600 },
    captionPrefix: 'premium footer, modern site footer',
    variants: ['minimal', 'mega', 'dark', 'light', 'multi-column'],
  },

  // Dropdowns and menus
  dropdowns: {
    selectors: [
      '[class*="dropdown"]',
      '[class*="menu"]:not(nav [class*="menu"])',
      '[role="menu"]',
      '[role="listbox"]',
      'select',
    ],
    minSize: { width: 100, height: 40 },
    maxSize: { width: 400, height: 500 },
    captionPrefix: 'premium dropdown, elegant menu design',
    variants: ['simple', 'multi-level', 'searchable', 'with-icons'],
  },

  // Badges and tags
  badges: {
    selectors: [
      '[class*="badge"]',
      '[class*="tag"]',
      '[class*="chip"]',
      '[class*="pill"]',
      '[class*="label"]:not(label)',
    ],
    minSize: { width: 30, height: 16 },
    maxSize: { width: 200, height: 60 },
    captionPrefix: 'premium badge, modern tag design',
    variants: ['success', 'warning', 'error', 'info', 'new', 'sale'],
  },

  // Icons with backgrounds
  iconButtons: {
    selectors: [
      '[class*="icon-btn"]',
      '[class*="icon-button"]',
      'button svg',
      'button [class*="icon"]',
      '[class*="social-icon"]',
    ],
    minSize: { width: 24, height: 24 },
    maxSize: { width: 80, height: 80 },
    captionPrefix: 'premium icon button, modern iconography',
    variants: ['circular', 'square', 'ghost', 'social', 'action'],
  },

  // Progress indicators
  progress: {
    selectors: [
      '[class*="progress"]',
      '[role="progressbar"]',
      '[class*="loading"]',
      '[class*="spinner"]',
      '[class*="skeleton"]',
    ],
    minSize: { width: 50, height: 4 },
    maxSize: { width: 400, height: 100 },
    captionPrefix: 'premium progress indicator, sleek loader',
    variants: ['bar', 'circular', 'skeleton', 'spinner', 'steps'],
  },

  // Tabs
  tabs: {
    selectors: [
      '[role="tablist"]',
      '[class*="tabs"]',
      '[class*="tab-bar"]',
    ],
    minSize: { width: 200, height: 30 },
    maxSize: { width: 800, height: 100 },
    captionPrefix: 'premium tabs, modern tab navigation',
    variants: ['underline', 'pill', 'bordered', 'vertical'],
  },

  // Tooltips
  tooltips: {
    selectors: [
      '[role="tooltip"]',
      '[class*="tooltip"]',
      '[class*="popover"]',
    ],
    minSize: { width: 80, height: 30 },
    maxSize: { width: 400, height: 200 },
    captionPrefix: 'premium tooltip, elegant popup info',
    variants: ['dark', 'light', 'glass', 'arrow'],
  },
};

interface ElementCapture {
  type: string;
  url: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  caption: string;
  filename: string;
}

interface ExtractionProgress {
  completed: string[];
  failed: string[];
  elementsExtracted: number;
  lastUpdated: string;
}

// =============================================================================
// Progress Tracking
// =============================================================================

function loadProgress(): ExtractionProgress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch {
    // Start fresh
  }
  return { completed: [], failed: [], elementsExtracted: 0, lastUpdated: new Date().toISOString() };
}

function saveProgress(progress: ExtractionProgress): void {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// =============================================================================
// Element Detection and Capture
// =============================================================================

function sanitizeFilename(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function generateElementCaption(
  elementType: string,
  config: typeof ELEMENT_CONFIGS[keyof typeof ELEMENT_CONFIGS],
  sourceUrl: string,
  tier: string
): string {
  // Determine variant based on classes or position (would be enhanced with actual class analysis)
  const variant = config.variants[Math.floor(Math.random() * config.variants.length)];

  const tierDescriptions: Record<string, string> = {
    tier1_awards: 'awwwards-tier design',
    tier2_studios: 'elite studio quality',
    tier3_tutorials: 'creative demo pattern',
    tier4_mobile: 'iOS premium style',
    tier5_saas: 'professional SaaS',
    tier6_ecommerce: 'luxury e-commerce',
  };

  const tierDesc = tierDescriptions[tier] || 'premium design';

  return [
    'kriptik_ui',
    config.captionPrefix,
    tierDesc,
    `${variant} variant`,
    'high fidelity',
    'modern 2026 aesthetic',
  ].join(', ');
}

async function extractElementsFromPage(
  page: Page,
  url: string,
  tier: string,
  progress: ExtractionProgress
): Promise<ElementCapture[]> {
  const captures: ElementCapture[] = [];
  const urlKey = `${tier}:${url}`;

  if (progress.completed.includes(urlKey)) {
    return [];
  }

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(3000);

    // Try to close any popups/modals first
    try {
      await page.click('[class*="close"]', { timeout: 2000 });
    } catch {}
    try {
      await page.click('[aria-label*="close"]', { timeout: 2000 });
    } catch {}

    const urlSlug = sanitizeFilename(url.replace(/https?:\/\//, '').replace(/\//g, '-'));

    for (const [elementType, config] of Object.entries(ELEMENT_CONFIGS)) {
      for (const selector of config.selectors) {
        try {
          const elements = await page.$$(selector);

          for (let i = 0; i < Math.min(elements.length, 5); i++) { // Max 5 per type per page
            const element = elements[i];

            try {
              const box = await element.boundingBox();
              if (!box) continue;

              // Check size constraints
              if (
                box.width < config.minSize.width ||
                box.height < config.minSize.height ||
                box.width > config.maxSize.width ||
                box.height > config.maxSize.height
              ) {
                continue;
              }

              // Check if element is visible
              const isVisible = await element.isVisible();
              if (!isVisible) continue;

              // Generate filename
              const filename = `${tier}_${elementType}_${urlSlug}_${i}.png`;
              const filepath = path.join(OUTPUT_DIR, filename);

              // Skip if already captured
              if (fs.existsSync(filepath)) continue;

              // Capture element screenshot
              await element.screenshot({
                path: filepath,
                type: 'png',
              });

              // Generate caption
              const caption = generateElementCaption(elementType, config, url, tier);
              const captionPath = path.join(CAPTIONS_DIR, `${tier}_${elementType}_${urlSlug}_${i}.txt`);
              await fs.promises.writeFile(captionPath, caption);

              captures.push({
                type: elementType,
                url,
                boundingBox: box,
                caption,
                filename,
              });

              progress.elementsExtracted++;

            } catch (err) {
              // Element might have changed, skip
            }
          }
        } catch {
          // Selector not found, continue
        }
      }
    }

    progress.completed.push(urlKey);

  } catch (error) {
    progress.failed.push(urlKey);
    console.log(`  [FAIL] ${url}: ${(error as Error).message.slice(0, 50)}`);
  }

  return captures;
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
  console.log('  🧩 Premium UI Element Extractor');
  console.log('  Extracting individual components for element-level training');
  console.log('  Concurrency: ' + concurrencyArg);
  console.log('═══════════════════════════════════════════════════════════════');

  // Ensure output directories exist
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.promises.mkdir(CAPTIONS_DIR, { recursive: true });

  // Load URLs from harvested file OR combined file
  let urlsPath = '';
  if (fs.existsSync(HARVESTED_URLS_PATH)) {
    urlsPath = HARVESTED_URLS_PATH;
    console.log('   Using harvested-urls.json');
  } else if (fs.existsSync(COMBINED_URLS_PATH)) {
    urlsPath = COMBINED_URLS_PATH;
    console.log('   Using combined-urls.json (harvest still in progress)');
  } else {
    console.error('❌ No URL files found. Run harvest-award-urls.ts first or create combined-urls.json.');
    process.exit(1);
  }

  interface HarvestedUrl {
    title: string;
    url: string;
    source: string;
    category: string;
    tags: string[];
  }

  const harvested = JSON.parse(await fs.promises.readFile(urlsPath, 'utf-8'));

  // Determine which tiers to process
  const tiers = tierArg
    ? [tierArg]
    : Object.keys(harvested).filter(k => harvested[k].length > 0);

  // Load progress
  const progress = loadProgress();
  console.log(`\n📊 Progress: ${progress.elementsExtracted} elements extracted`);

  // Launch browser
  const browser = await chromium.launch({
    headless: true,
  });

  let totalExtracted = 0;

  try {
    for (const tier of tiers) {
      const urls: HarvestedUrl[] = harvested[tier] || [];

      if (urls.length === 0) {
        console.log(`\n⏭️  Skipping ${tier}: No URLs`);
        continue;
      }

      // Apply limit if specified
      const urlsToProcess = limitArg > 0 ? urls.slice(0, limitArg) : urls;

      // Filter out already completed
      const pending = urlsToProcess.filter(u => !progress.completed.includes(`${tier}:${u.url}`));

      console.log(`\n━━━ ${tier.toUpperCase()} ━━━`);
      console.log(`   Total URLs: ${urls.length}`);
      console.log(`   Already done: ${urlsToProcess.length - pending.length}`);
      console.log(`   Pending: ${pending.length}`);

      if (pending.length === 0) {
        console.log('   ✅ All complete!');
        continue;
      }

      // Create browser contexts for parallel processing
      const contexts = await Promise.all(
        Array(concurrencyArg).fill(null).map(() => browser.newContext({
          viewport: { width: 1920, height: 1080 },
          deviceScaleFactor: 2,
        }))
      );

      let contextIndex = 0;
      let lastPrint = 0;

      const results = await processInParallel(
        pending,
        async (item) => {
          const context = contexts[contextIndex % contexts.length];
          contextIndex++;
          const page = await context.newPage();

          try {
            const captures = await extractElementsFromPage(page, item.url, tier, progress);
            return captures;
          } finally {
            await page.close();
          }
        },
        concurrencyArg,
        (completed, total) => {
          // Save progress periodically
          if (completed % 5 === 0) {
            saveProgress(progress);
          }
          // Print progress
          if (completed - lastPrint >= 10) {
            console.log(`   Progress: ${completed}/${total} URLs processed`);
            lastPrint = completed;
          }
        }
      );

      // Close contexts
      await Promise.all(contexts.map(c => c.close()));

      const extractedCount = results.flat().length;
      totalExtracted += extractedCount;

      console.log(`   ✅ Extracted ${extractedCount} elements from ${pending.length} URLs`);

      // Save progress after each tier
      saveProgress(progress);
    }

  } finally {
    await browser.close();
  }

  // Final stats
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  📊 EXTRACTION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  New Elements Extracted: ${totalExtracted}`);
  console.log(`  Total Elements:         ${progress.elementsExtracted}`);
  console.log(`  Output:                 ${OUTPUT_DIR}`);

  // Count actual files
  try {
    const elementCount = (await fs.promises.readdir(OUTPUT_DIR)).filter(f => f.endsWith('.png')).length;
    const captionCount = (await fs.promises.readdir(CAPTIONS_DIR)).filter(f => f.endsWith('.txt')).length;

    console.log(`\n  📁 Element Dataset Stats:`);
    console.log(`     Images:   ${elementCount}`);
    console.log(`     Captions: ${captionCount}`);
  } catch {}

  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
