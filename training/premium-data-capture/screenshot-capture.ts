/**
 * Premium Design Screenshot Capture
 *
 * Playwright-based batch capture system for premium UI design sources.
 * Captures screenshots from Tier 1-4 sources for FLUX UI-LoRA training.
 *
 * Sources:
 * - Tier 1: Awwwards, CSS Design Awards, FWA, Orpetron
 * - Tier 2: Elite studios (Lusion, Active Theory, Studio Freight)
 * - Tier 3: Codrops demos, Made With GSAP
 * - Tier 4: iOS design galleries (ScreensDesign, LaudableApps)
 *
 * Run with: npx tsx training/premium-data-capture/screenshot-capture.ts
 */

import { chromium, devices, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

interface CaptureSource {
  name: string;
  tier: 1 | 2 | 3 | 4;
  baseUrl: string;
  listingSelector: string;
  linkSelector: string;
  maxPages?: number;
  delay?: number;
  scrollToLoad?: boolean;
  extractMetadata?: boolean;
}

interface CaptureConfig {
  outputDir: string;
  devices: string[];
  fullPage: boolean;
  quality: number;
  timeout: number;
  maxConcurrent: number;
  retryAttempts: number;
  delayBetweenCaptures: number;
}

interface CapturedImage {
  id: string;
  source: string;
  tier: number;
  url: string;
  title: string;
  device: string;
  filePath: string;
  capturedAt: Date;
  metadata?: {
    award?: string;
    studio?: string;
    technologies?: string[];
    year?: number;
  };
}

// Premium design sources (NO Lovable, Dribbble, Mobbin)
const PREMIUM_SOURCES: CaptureSource[] = [
  // ==================== TIER 1: Award Platforms ====================
  {
    name: 'awwwards-soty',
    tier: 1,
    baseUrl: 'https://www.awwwards.com/websites/sites_of_the_year/',
    listingSelector: '.box-item',
    linkSelector: 'a.link',
    maxPages: 10,
    delay: 2000,
    scrollToLoad: true,
    extractMetadata: true,
  },
  {
    name: 'awwwards-threejs',
    tier: 1,
    baseUrl: 'https://www.awwwards.com/websites/three-js/',
    listingSelector: '.box-item',
    linkSelector: 'a.link',
    maxPages: 15,
    delay: 2000,
    scrollToLoad: true,
  },
  {
    name: 'awwwards-gsap',
    tier: 1,
    baseUrl: 'https://www.awwwards.com/websites/gsap/',
    listingSelector: '.box-item',
    linkSelector: 'a.link',
    maxPages: 15,
    delay: 2000,
    scrollToLoad: true,
  },
  {
    name: 'cssdesignawards',
    tier: 1,
    baseUrl: 'https://www.cssdesignawards.com/wotd-award-winners',
    listingSelector: '.site-item',
    linkSelector: 'a.visit-site',
    maxPages: 20,
    delay: 1500,
  },
  {
    name: 'fwa',
    tier: 1,
    baseUrl: 'https://thefwa.com/awards/page/1',
    listingSelector: '.award-item',
    linkSelector: 'a.visit',
    maxPages: 25,
    delay: 2000,
  },
  {
    name: 'csswinner',
    tier: 1,
    baseUrl: 'https://www.csswinner.com/winners',
    listingSelector: '.site-item',
    linkSelector: 'a.visit-btn',
    maxPages: 15,
    delay: 1500,
  },
  {
    name: 'cssnectar',
    tier: 1,
    baseUrl: 'https://cssnectar.com/',
    listingSelector: '.site-wrapper',
    linkSelector: 'a.visit',
    maxPages: 15,
    delay: 1500,
  },
  {
    name: 'orpetron',
    tier: 1,
    baseUrl: 'https://orpetron.com/',
    listingSelector: '.project-item',
    linkSelector: 'a.project-link',
    maxPages: 10,
    delay: 2000,
  },

  // ==================== TIER 2: Elite Studios ====================
  {
    name: 'lusion-projects',
    tier: 2,
    baseUrl: 'https://lusion.co/',
    listingSelector: '.project',
    linkSelector: 'a',
    maxPages: 1,
    delay: 3000,
    scrollToLoad: true,
  },
  {
    name: 'activetheory-work',
    tier: 2,
    baseUrl: 'https://activetheory.net/work',
    listingSelector: '.work-item',
    linkSelector: 'a',
    maxPages: 1,
    delay: 3000,
    scrollToLoad: true,
  },
  {
    name: 'studiofreight-work',
    tier: 2,
    baseUrl: 'https://studiofreight.com/',
    listingSelector: '.project',
    linkSelector: 'a',
    maxPages: 1,
    delay: 3000,
    scrollToLoad: true,
  },
  {
    name: 'immersive-garden',
    tier: 2,
    baseUrl: 'https://immersive-g.com/',
    listingSelector: '.project-item',
    linkSelector: 'a',
    maxPages: 1,
    delay: 3000,
  },

  // ==================== TIER 3: Tutorial/Demo Platforms ====================
  {
    name: 'codrops-demos',
    tier: 3,
    baseUrl: 'https://tympanus.net/codrops/category/tutorials/',
    listingSelector: '.post-box',
    linkSelector: 'a.post-link',
    maxPages: 30,
    delay: 1000,
  },
  {
    name: 'codrops-webgl',
    tier: 3,
    baseUrl: 'https://tympanus.net/codrops/tag/webgl/',
    listingSelector: '.post-box',
    linkSelector: 'a.demo-link',
    maxPages: 20,
    delay: 1000,
  },
  {
    name: 'made-with-gsap',
    tier: 3,
    baseUrl: 'https://madewithgsap.com/',
    listingSelector: '.effect-item',
    linkSelector: 'a.demo',
    maxPages: 10,
    delay: 1500,
  },

  // ==================== TIER 4: iOS/Mobile Design ====================
  {
    name: 'screensdesign',
    tier: 4,
    baseUrl: 'https://screensdesign.com/',
    listingSelector: '.screen-item',
    linkSelector: 'a.screen-link',
    maxPages: 50,
    delay: 1000,
    scrollToLoad: true,
  },
  {
    name: 'laudableapps',
    tier: 4,
    baseUrl: 'https://laudableapps.com/',
    listingSelector: '.app-card',
    linkSelector: 'a.app-link',
    maxPages: 30,
    delay: 1000,
  },
  {
    name: 'muzli-ios',
    tier: 4,
    baseUrl: 'https://muz.li/inspiration/ios-app-examples/',
    listingSelector: '.design-item',
    linkSelector: 'a.design-link',
    maxPages: 20,
    delay: 1500,
    scrollToLoad: true,
  },
];

const DEFAULT_CONFIG: CaptureConfig = {
  outputDir: path.join(__dirname, '../../premium-designs/images'),
  devices: ['Desktop Chrome', 'iPhone 14 Pro', 'iPad Pro 11'],
  fullPage: true,
  quality: 90,
  timeout: 60000,
  maxConcurrent: 3,
  retryAttempts: 3,
  delayBetweenCaptures: 500,
};

// Device viewport overrides for consistent capture
const DEVICE_VIEWPORTS: Record<string, { width: number; height: number }> = {
  'Desktop Chrome': { width: 1920, height: 1080 },
  'iPhone 14 Pro': { width: 430, height: 932 },
  'iPad Pro 11': { width: 1194, height: 834 },
};

// ============================================================================
// Screenshot Capture Service
// ============================================================================

export class ScreenshotCaptureService {
  private config: CaptureConfig;
  private browser: Browser | null = null;
  private capturedImages: CapturedImage[] = [];
  private captureLog: string[] = [];

  constructor(config: Partial<CaptureConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize browser instance
   */
  async initialize(): Promise<void> {
    console.log('[Screenshot] Initializing Playwright browser...');
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });
    console.log('[Screenshot] Browser initialized');
  }

  /**
   * Cleanup browser instance
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Capture all premium sources
   */
  async captureAllSources(
    sources: CaptureSource[] = PREMIUM_SOURCES,
    options: { tierFilter?: number[]; sourceFilter?: string[] } = {}
  ): Promise<CapturedImage[]> {
    if (!this.browser) {
      await this.initialize();
    }

    // Filter sources if specified
    let filteredSources = sources;
    if (options.tierFilter?.length) {
      filteredSources = filteredSources.filter(s => options.tierFilter!.includes(s.tier));
    }
    if (options.sourceFilter?.length) {
      filteredSources = filteredSources.filter(s => options.sourceFilter!.includes(s.name));
    }

    console.log(`[Screenshot] Starting capture of ${filteredSources.length} sources...`);

    for (const source of filteredSources) {
      try {
        await this.captureSource(source);
      } catch (error) {
        this.log(`ERROR capturing ${source.name}: ${error}`);
        continue;
      }
    }

    // Save capture manifest
    await this.saveManifest();

    console.log(`[Screenshot] Capture complete. Total images: ${this.capturedImages.length}`);
    return this.capturedImages;
  }

  /**
   * Capture a single source
   */
  async captureSource(source: CaptureSource): Promise<void> {
    console.log(`[Screenshot] Capturing source: ${source.name} (Tier ${source.tier})`);

    const context = await this.browser!.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      viewport: DEVICE_VIEWPORTS['Desktop Chrome'],
    });

    try {
      // Get list of URLs to capture
      const urls = await this.extractUrls(context, source);
      console.log(`[Screenshot] Found ${urls.length} URLs to capture from ${source.name}`);

      // Capture each URL
      for (const { url, title, metadata } of urls) {
        try {
          await this.captureUrl(url, title, source, metadata);
          await this.delay(source.delay || this.config.delayBetweenCaptures);
        } catch (error) {
          this.log(`ERROR capturing ${url}: ${error}`);
        }
      }
    } finally {
      await context.close();
    }
  }

  /**
   * Extract URLs from a source listing page
   */
  private async extractUrls(
    context: BrowserContext,
    source: CaptureSource
  ): Promise<Array<{ url: string; title: string; metadata?: Record<string, unknown> }>> {
    const page = await context.newPage();
    const urls: Array<{ url: string; title: string; metadata?: Record<string, unknown> }> = [];

    try {
      let currentPage = 1;
      let hasMorePages = true;

      while (hasMorePages && currentPage <= (source.maxPages || 10)) {
        // Navigate to listing page
        const listingUrl = source.baseUrl.includes('page/')
          ? source.baseUrl.replace(/page\/\d+/, `page/${currentPage}`)
          : currentPage === 1
            ? source.baseUrl
            : `${source.baseUrl}?page=${currentPage}`;

        await page.goto(listingUrl, {
          waitUntil: 'networkidle',
          timeout: this.config.timeout,
        });

        // Handle infinite scroll sources
        if (source.scrollToLoad) {
          await this.scrollToLoadAll(page);
        }

        // Extract URLs from listing
        const pageUrls = await page.evaluate(
          ({ listingSelector, linkSelector, extractMetadata }) => {
            const items = document.querySelectorAll(listingSelector);
            return Array.from(items).map(item => {
              const link = item.querySelector(linkSelector) as HTMLAnchorElement;
              const url = link?.href || '';
              const title =
                item.querySelector('h2, h3, .title, .name')?.textContent?.trim() || 'Untitled';

              let metadata: Record<string, unknown> | undefined;
              if (extractMetadata) {
                metadata = {
                  award: item.querySelector('.award-badge, .award')?.textContent?.trim(),
                  studio: item.querySelector('.studio, .agency')?.textContent?.trim(),
                  year: item.querySelector('.year, time')?.textContent?.trim(),
                };
              }

              return { url, title, metadata };
            });
          },
          {
            listingSelector: source.listingSelector,
            linkSelector: source.linkSelector,
            extractMetadata: source.extractMetadata,
          }
        );

        urls.push(...pageUrls.filter(u => u.url));

        // Check for more pages
        const hasNextPage = await page.evaluate(() => {
          const nextBtn = document.querySelector('.next, .pagination-next, [rel="next"]');
          return nextBtn && !nextBtn.classList.contains('disabled');
        });

        hasMorePages = hasNextPage;
        currentPage++;

        await this.delay(source.delay || 1000);
      }
    } catch (error) {
      this.log(`ERROR extracting URLs from ${source.name}: ${error}`);
    } finally {
      await page.close();
    }

    return urls;
  }

  /**
   * Capture screenshots of a single URL at multiple viewports
   */
  private async captureUrl(
    url: string,
    title: string,
    source: CaptureSource,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    // Sanitize filename
    const sanitizedTitle = this.sanitizeFilename(title);
    const sourceDir = path.join(this.config.outputDir, source.name);

    // Ensure output directory exists
    await fs.promises.mkdir(sourceDir, { recursive: true });

    // Capture at each device viewport
    for (const deviceName of this.config.devices) {
      const context = await this.browser!.newContext({
        ...devices[deviceName],
        viewport: DEVICE_VIEWPORTS[deviceName] || devices[deviceName]?.viewport,
      });

      const page = await context.newPage();

      try {
        // Navigate with retry
        let success = false;
        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
          try {
            await page.goto(url, {
              waitUntil: 'networkidle',
              timeout: this.config.timeout,
            });

            // Wait for animations to settle
            await page.waitForTimeout(2000);

            // Scroll to trigger lazy loading
            if (this.config.fullPage) {
              await this.scrollPageForLazyLoad(page);
            }

            success = true;
            break;
          } catch (error) {
            if (attempt === this.config.retryAttempts) throw error;
            this.log(`Retry ${attempt}/${this.config.retryAttempts} for ${url}`);
            await this.delay(1000 * attempt);
          }
        }

        if (!success) return;

        // Generate unique ID
        const id = `${source.name}_${sanitizedTitle}_${Date.now()}`;
        const deviceSuffix = deviceName.toLowerCase().replace(/\s+/g, '-');
        const filename = `${sanitizedTitle}_${deviceSuffix}.png`;
        const filePath = path.join(sourceDir, filename);

        // Capture screenshot
        await page.screenshot({
          path: filePath,
          fullPage: this.config.fullPage,
          type: 'png',
        });

        // Also capture hero section (above-the-fold)
        const heroFilename = `${sanitizedTitle}_${deviceSuffix}_hero.png`;
        const heroPath = path.join(sourceDir, heroFilename);
        await page.screenshot({
          path: heroPath,
          fullPage: false,
          type: 'png',
        });

        // Record capture
        const capturedImage: CapturedImage = {
          id,
          source: source.name,
          tier: source.tier,
          url,
          title,
          device: deviceName,
          filePath,
          capturedAt: new Date(),
          metadata: metadata as CapturedImage['metadata'],
        };

        this.capturedImages.push(capturedImage);
        this.log(`Captured: ${source.name}/${filename}`);
      } catch (error) {
        this.log(`ERROR capturing ${url} on ${deviceName}: ${error}`);
      } finally {
        await page.close();
        await context.close();
      }
    }
  }

  /**
   * Scroll page to load lazy content
   */
  private async scrollPageForLazyLoad(page: Page): Promise<void> {
    await page.evaluate(async () => {
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      const scrollHeight = document.body.scrollHeight;
      const viewportHeight = window.innerHeight;
      let currentPosition = 0;

      while (currentPosition < scrollHeight) {
        window.scrollTo(0, currentPosition);
        await delay(100);
        currentPosition += viewportHeight / 2;
      }

      // Scroll back to top
      window.scrollTo(0, 0);
      await delay(500);
    });
  }

  /**
   * Scroll to load all content (infinite scroll)
   */
  private async scrollToLoadAll(page: Page): Promise<void> {
    let previousHeight = 0;
    let currentHeight = await page.evaluate(() => document.body.scrollHeight);
    let attempts = 0;
    const maxAttempts = 20;

    while (previousHeight !== currentHeight && attempts < maxAttempts) {
      previousHeight = currentHeight;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1500);
      currentHeight = await page.evaluate(() => document.body.scrollHeight);
      attempts++;
    }

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  /**
   * Save capture manifest
   */
  private async saveManifest(): Promise<void> {
    const manifestPath = path.join(this.config.outputDir, 'capture-manifest.json');
    const manifest = {
      capturedAt: new Date().toISOString(),
      totalImages: this.capturedImages.length,
      byTier: {
        tier1: this.capturedImages.filter(i => i.tier === 1).length,
        tier2: this.capturedImages.filter(i => i.tier === 2).length,
        tier3: this.capturedImages.filter(i => i.tier === 3).length,
        tier4: this.capturedImages.filter(i => i.tier === 4).length,
      },
      bySource: Object.fromEntries(
        PREMIUM_SOURCES.map(s => [
          s.name,
          this.capturedImages.filter(i => i.source === s.name).length,
        ])
      ),
      images: this.capturedImages,
    };

    await fs.promises.mkdir(path.dirname(manifestPath), { recursive: true });
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    // Save capture log
    const logPath = path.join(this.config.outputDir, 'capture-log.txt');
    await fs.promises.writeFile(logPath, this.captureLog.join('\n'));
  }

  /**
   * Sanitize string for use as filename
   */
  private sanitizeFilename(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }

  /**
   * Log message with timestamp
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    this.captureLog.push(logMessage);
  }

  /**
   * Async delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get capture statistics
   */
  getStats(): {
    total: number;
    byTier: Record<number, number>;
    bySource: Record<string, number>;
    byDevice: Record<string, number>;
  } {
    return {
      total: this.capturedImages.length,
      byTier: {
        1: this.capturedImages.filter(i => i.tier === 1).length,
        2: this.capturedImages.filter(i => i.tier === 2).length,
        3: this.capturedImages.filter(i => i.tier === 3).length,
        4: this.capturedImages.filter(i => i.tier === 4).length,
      },
      bySource: Object.fromEntries(
        [...new Set(this.capturedImages.map(i => i.source))].map(s => [
          s,
          this.capturedImages.filter(i => i.source === s).length,
        ])
      ),
      byDevice: Object.fromEntries(
        this.config.devices.map(d => [
          d,
          this.capturedImages.filter(i => i.device === d).length,
        ])
      ),
    };
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const tierFilter = args
    .find(a => a.startsWith('--tier='))
    ?.replace('--tier=', '')
    .split(',')
    .map(Number);
  const sourceFilter = args
    .find(a => a.startsWith('--source='))
    ?.replace('--source=', '')
    .split(',');

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     KripTik Premium Design Screenshot Capture                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  const service = new ScreenshotCaptureService();

  try {
    await service.initialize();

    const images = await service.captureAllSources(PREMIUM_SOURCES, {
      tierFilter,
      sourceFilter,
    });

    const stats = service.getStats();

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                      CAPTURE SUMMARY                           ');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Total Images: ${stats.total}`);
    console.log('');
    console.log('By Tier:');
    Object.entries(stats.byTier).forEach(([tier, count]) => {
      console.log(`  Tier ${tier}: ${count}`);
    });
    console.log('');
    console.log('By Source:');
    Object.entries(stats.bySource)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .forEach(([source, count]) => {
        console.log(`  ${source}: ${count}`);
      });
    console.log('═══════════════════════════════════════════════════════════════');
  } catch (error) {
    console.error('Capture failed:', error);
    process.exit(1);
  } finally {
    await service.cleanup();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { PREMIUM_SOURCES, DEFAULT_CONFIG };
export type { CaptureSource, CaptureConfig, CapturedImage };
