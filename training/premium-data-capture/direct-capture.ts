/**
 * Direct Screenshot Capture
 *
 * Captures screenshots from curated premium design URLs.
 * More reliable than scraping as it uses known-good URLs.
 *
 * Run with: npx tsx training/premium-data-capture/direct-capture.ts
 */

import { chromium, Browser, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Types
// ============================================================================

interface CuratedUrl {
  url: string;
  title: string;
  award?: string;
  studio?: string;
  source?: string;
  platform?: string;
  technologies?: string[];
  year?: number;
}

interface CuratedSources {
  description: string;
  lastUpdated: string;
  sources: {
    [tier: string]: {
      name: string;
      urls: CuratedUrl[];
    };
  };
}

interface CaptureResult {
  id: string;
  url: string;
  title: string;
  tier: string;
  screenshots: {
    desktop: string;
    mobile: string;
    tablet: string;
  };
  caption: string;
  metadata: CuratedUrl;
  capturedAt: string;
}

// ============================================================================
// Configuration
// ============================================================================

const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  mobile: { width: 430, height: 932 },
  tablet: { width: 1194, height: 834 },
};

const OUTPUT_DIR = path.join(__dirname, '../premium-designs/images');
const CAPTION_DIR = path.join(__dirname, '../premium-designs/captions');

// ============================================================================
// Caption Generation
// ============================================================================

function generateCaption(url: CuratedUrl, tier: string): string {
  const parts: string[] = ['kriptik_ui'];

  // Add award/source info
  if (url.award) {
    parts.push(url.award.toLowerCase().replace(/\s+/g, ' '));
  }
  if (url.studio) {
    parts.push(`${url.studio} studio design`);
  }
  if (url.source === 'Codrops') {
    parts.push('codrops tutorial demo');
  }
  if (url.source === 'Apple') {
    parts.push('apple human interface guidelines');
  }

  // Add platform
  if (url.platform === 'ios') {
    parts.push('iOS app design');
  } else if (url.platform === 'visionos') {
    parts.push('visionOS spatial interface');
  } else {
    parts.push('premium web design');
  }

  // Add technologies
  if (url.technologies?.length) {
    const techStr = url.technologies
      .map(t => {
        switch (t) {
          case 'three.js':
            return 'Three.js 3D graphics';
          case 'webgl':
            return 'WebGL visual effects';
          case 'webgpu':
            return 'WebGPU high-performance rendering';
          case 'gsap':
            return 'GSAP smooth animations';
          case 'scroll-trigger':
            return 'ScrollTrigger scroll-driven animations';
          case 'framer-motion':
            return 'Framer Motion spring physics';
          case 'lenis':
            return 'Lenis smooth scroll';
          case 'glsl':
            return 'custom GLSL shaders';
          case 'r3f':
            return 'React Three Fiber';
          default:
            return t;
        }
      })
      .join(', ');
    parts.push(techStr);
  }

  // Add premium design vocabulary
  parts.push('high-fidelity mockup');
  parts.push('modern 2026 aesthetic');
  parts.push('clean professional layout');

  // Add year if recent
  if (url.year && url.year >= 2024) {
    parts.push(`${url.year} design trends`);
  }

  return parts.join(', ');
}

// ============================================================================
// Direct Capture Service
// ============================================================================

class DirectCaptureService {
  private browser: Browser | null = null;
  private results: CaptureResult[] = [];

  async initialize(): Promise<void> {
    console.log('[DirectCapture] Initializing Playwright browser...');
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    console.log('[DirectCapture] Browser initialized');
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async captureFromCuratedList(
    curatedPath: string = path.join(__dirname, 'curated-urls.json'),
    tierFilter?: string[]
  ): Promise<CaptureResult[]> {
    // Load curated URLs
    const curatedContent = await fs.promises.readFile(curatedPath, 'utf-8');
    const curated: CuratedSources = JSON.parse(curatedContent);

    console.log(`[DirectCapture] Loaded ${Object.keys(curated.sources).length} tiers`);

    // Ensure output directories exist
    await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.promises.mkdir(CAPTION_DIR, { recursive: true });

    // Process each tier
    for (const [tierId, tierData] of Object.entries(curated.sources)) {
      if (tierFilter?.length && !tierFilter.includes(tierId)) {
        console.log(`[DirectCapture] Skipping ${tierId} (filtered)`);
        continue;
      }

      console.log(`[DirectCapture] Processing ${tierData.name} (${tierData.urls.length} URLs)`);

      for (const urlData of tierData.urls) {
        try {
          await this.captureUrl(urlData, tierId);
        } catch (error) {
          console.error(`[DirectCapture] Failed to capture ${urlData.url}:`, error);
        }
      }
    }

    // Save manifest
    await this.saveManifest();

    console.log(`[DirectCapture] Complete. Captured ${this.results.length} sites.`);
    return this.results;
  }

  private async captureUrl(urlData: CuratedUrl, tier: string): Promise<void> {
    console.log(`[DirectCapture] Capturing: ${urlData.title}`);

    const id = this.sanitizeFilename(urlData.title);
    const tierDir = path.join(OUTPUT_DIR, tier);
    const captionTierDir = path.join(CAPTION_DIR, tier);

    await fs.promises.mkdir(tierDir, { recursive: true });
    await fs.promises.mkdir(captionTierDir, { recursive: true });

    const screenshots: Record<string, string> = {};

    // Capture at each viewport
    for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
      const context = await this.browser!.newContext({
        viewport,
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      try {
        const page = await context.newPage();

        // Navigate with retry
        let retries = 3;
        while (retries > 0) {
          try {
            await page.goto(urlData.url, {
              waitUntil: 'networkidle',
              timeout: 30000,
            });
            break;
          } catch {
            retries--;
            if (retries === 0) throw new Error(`Failed to load ${urlData.url}`);
            await this.delay(2000);
          }
        }

        // Wait for any animations to settle
        await this.delay(1500);

        // Take screenshot
        const filename = `${id}_${viewportName}.png`;
        const filepath = path.join(tierDir, filename);

        await page.screenshot({
          path: filepath,
          fullPage: viewportName === 'desktop',
          type: 'png',
        });

        screenshots[viewportName] = filepath;
        console.log(`  [${viewportName}] Saved: ${filename}`);

        await page.close();
      } finally {
        await context.close();
      }
    }

    // Generate and save caption
    const caption = generateCaption(urlData, tier);
    const captionPath = path.join(captionTierDir, `${id}.txt`);
    await fs.promises.writeFile(captionPath, caption);

    // Add to results
    this.results.push({
      id,
      url: urlData.url,
      title: urlData.title,
      tier,
      screenshots: screenshots as CaptureResult['screenshots'],
      caption,
      metadata: urlData,
      capturedAt: new Date().toISOString(),
    });
  }

  private async saveManifest(): Promise<void> {
    const manifestPath = path.join(OUTPUT_DIR, 'capture-manifest.json');
    const manifest = {
      capturedAt: new Date().toISOString(),
      totalSites: this.results.length,
      totalScreenshots: this.results.length * Object.keys(VIEWPORTS).length,
      byTier: this.results.reduce(
        (acc, r) => {
          acc[r.tier] = (acc[r.tier] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      results: this.results,
    };

    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`[DirectCapture] Manifest saved: ${manifestPath}`);
  }

  private sanitizeFilename(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Direct Screenshot Capture

Captures screenshots from curated premium design URLs.

Usage:
  npx tsx training/premium-data-capture/direct-capture.ts [options]

Options:
  --tier=tier1,tier2    Filter by tier (tier1, tier2, tier3, tier4)
  --help, -h            Show this help

Examples:
  # Capture all tiers
  npx tsx training/premium-data-capture/direct-capture.ts

  # Capture only Tier 1 award winners
  npx tsx training/premium-data-capture/direct-capture.ts --tier=tier1

  # Capture Tier 1 and 2
  npx tsx training/premium-data-capture/direct-capture.ts --tier=tier1,tier2
`);
    return;
  }

  const tierArg = args.find(a => a.startsWith('--tier='));
  const tierFilter = tierArg?.replace('--tier=', '').split(',');

  const service = new DirectCaptureService();

  try {
    await service.initialize();
    const results = await service.captureFromCuratedList(undefined, tierFilter);
    console.log(`\nCapture complete: ${results.length} sites captured`);
  } catch (error) {
    console.error('Capture failed:', error);
    process.exit(1);
  } finally {
    await service.cleanup();
  }
}

// Run
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
