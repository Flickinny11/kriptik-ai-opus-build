/**
 * Bulk URL Capture
 *
 * Directly captures screenshots from all URLs in extensive-curated-urls.json
 * More reliable than scraping listing pages (Awwwards, Mobbin have anti-bot)
 *
 * Target: 218 URLs × 3 viewports = 654+ screenshots
 *
 * Run with: npx tsx bulk-url-capture.ts
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DEFAULT_URLS_FILE = path.join(__dirname, 'extensive-curated-urls.json');
const EXPANDED_URLS_FILE = path.join(__dirname, 'expanded-urls.json');
const ADDITIONAL_URLS_FILE = path.join(__dirname, 'additional-urls.json');
const OUTPUT_BASE = path.join(__dirname, '../premium-designs/images');
const CAPTION_BASE = path.join(__dirname, '../premium-designs/captions');
const MANIFEST_PATH = path.join(__dirname, '../premium-designs/bulk-capture-manifest.json');

const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  mobile: { width: 430, height: 932 },
  tablet: { width: 1194, height: 834 },
};

// Concurrent capture limit
const CONCURRENCY = 3;

interface UrlEntry {
  url: string;
  title: string;
  award?: string;
  technologies?: string[];
  source?: string;
  studio?: string;
  category?: string;
  platform?: string;
  year?: number;
}

interface CaptureResult {
  id: string;
  url: string;
  title: string;
  tier: string;
  screenshots: {
    desktop?: string;
    mobile?: string;
    tablet?: string;
  };
  caption: string;
  technologies: string[];
  capturedAt: string;
  success: boolean;
  error?: string;
}

class BulkUrlCaptureService {
  private browser: Browser | null = null;
  private results: CaptureResult[] = [];
  private capturedUrls: Set<string> = new Set();
  private stats = {
    total: 0,
    captured: 0,
    failed: 0,
    skipped: 0,
  };

  async initialize(): Promise<void> {
    console.log('[BulkCapture] Initializing Playwright...');
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    // Load existing manifest to skip already captured
    await this.loadExistingManifest();
    console.log(`[BulkCapture] Ready. ${this.capturedUrls.size} URLs already captured.`);
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async loadExistingManifest(): Promise<void> {
    try {
      if (fs.existsSync(MANIFEST_PATH)) {
        const manifest = JSON.parse(await fs.promises.readFile(MANIFEST_PATH, 'utf-8'));
        this.results = manifest.results || [];
        this.capturedUrls = new Set(
          this.results.filter(r => r.success).map(r => r.url)
        );
      }
    } catch {
      console.log('[BulkCapture] No existing manifest, starting fresh');
    }
  }

  async captureAllUrls(options: {
    tierFilter?: string[];
    maxUrls?: number;
    skipExisting?: boolean;
    urlsFile?: string;
  } = {}): Promise<CaptureResult[]> {
    const urlsFile = options.urlsFile || DEFAULT_URLS_FILE;
    const urlsData = JSON.parse(await fs.promises.readFile(urlsFile, 'utf-8'));

    // Flatten all URLs from all tiers
    const allUrls: { tier: string; entry: UrlEntry }[] = [];

    for (const [tierKey, tierData] of Object.entries(urlsData.sources)) {
      const tier = tierData as { urls: UrlEntry[] };
      if (options.tierFilter && !options.tierFilter.includes(tierKey)) {
        continue;
      }

      for (const entry of tier.urls) {
        allUrls.push({ tier: tierKey, entry });
      }
    }

    console.log(`[BulkCapture] Found ${allUrls.length} URLs across ${Object.keys(urlsData.sources).length} tiers`);

    // Filter out already captured if requested
    let urlsToCapture = allUrls;
    if (options.skipExisting !== false) {
      urlsToCapture = allUrls.filter(u => !this.capturedUrls.has(u.entry.url));
      console.log(`[BulkCapture] ${urlsToCapture.length} URLs remaining after skipping captured`);
    }

    // Apply max limit
    if (options.maxUrls) {
      urlsToCapture = urlsToCapture.slice(0, options.maxUrls);
    }

    this.stats.total = urlsToCapture.length;
    console.log(`[BulkCapture] Starting capture of ${urlsToCapture.length} URLs`);

    // Process in batches for concurrency
    for (let i = 0; i < urlsToCapture.length; i += CONCURRENCY) {
      const batch = urlsToCapture.slice(i, i + CONCURRENCY);

      console.log(`\n━━━ Batch ${Math.floor(i/CONCURRENCY) + 1}/${Math.ceil(urlsToCapture.length/CONCURRENCY)} ━━━`);

      await Promise.all(
        batch.map(({ tier, entry }) => this.captureUrl(tier, entry))
      );

      // Save progress after each batch
      await this.saveManifest();

      // Progress update
      const progress = ((i + batch.length) / urlsToCapture.length * 100).toFixed(1);
      console.log(`[Progress] ${progress}% - Captured: ${this.stats.captured}, Failed: ${this.stats.failed}`);
    }

    return this.results;
  }

  private async captureUrl(tier: string, entry: UrlEntry): Promise<void> {
    const id = this.sanitizeFilename(entry.title || entry.url);

    console.log(`  [${tier}] ${entry.title}: ${entry.url}`);

    // Create tier directories
    const tierImageDir = path.join(OUTPUT_BASE, tier);
    const tierCaptionDir = path.join(CAPTION_BASE, tier);
    await fs.promises.mkdir(tierImageDir, { recursive: true });
    await fs.promises.mkdir(tierCaptionDir, { recursive: true });

    const result: CaptureResult = {
      id,
      url: entry.url,
      title: entry.title,
      tier,
      screenshots: {},
      caption: '',
      technologies: entry.technologies || [],
      capturedAt: new Date().toISOString(),
      success: false,
    };

    const context = await this.browser!.newContext({
      viewport: VIEWPORTS.desktop,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    try {
      // Navigate with timeout
      await page.goto(entry.url, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Wait for rendering
      await this.delay(2000);

      // Desktop capture
      await page.setViewportSize(VIEWPORTS.desktop);
      await this.delay(500);
      const desktopPath = path.join(tierImageDir, `${id}_desktop.png`);
      await page.screenshot({ path: desktopPath, fullPage: false, type: 'png' });
      result.screenshots.desktop = desktopPath;

      // Mobile capture
      await page.setViewportSize(VIEWPORTS.mobile);
      await this.delay(500);
      const mobilePath = path.join(tierImageDir, `${id}_mobile.png`);
      await page.screenshot({ path: mobilePath, fullPage: false, type: 'png' });
      result.screenshots.mobile = mobilePath;

      // Tablet capture
      await page.setViewportSize(VIEWPORTS.tablet);
      await this.delay(500);
      const tabletPath = path.join(tierImageDir, `${id}_tablet.png`);
      await page.screenshot({ path: tabletPath, fullPage: false, type: 'png' });
      result.screenshots.tablet = tabletPath;

      // Generate caption
      result.caption = this.generateCaption(entry, tier);
      const captionPath = path.join(tierCaptionDir, `${id}.txt`);
      await fs.promises.writeFile(captionPath, result.caption);

      result.success = true;
      this.stats.captured++;
      this.capturedUrls.add(entry.url);

      console.log(`    ✓ Captured 3 viewports`);

    } catch (error) {
      result.error = String(error);
      this.stats.failed++;
      console.log(`    ✗ Failed: ${error}`);
    } finally {
      await page.close();
      await context.close();
    }

    this.results.push(result);
  }

  private generateCaption(entry: UrlEntry, tier: string): string {
    const parts: string[] = ['kriptik_ui'];

    // Add tier-specific prefix
    const tierPrefixes: Record<string, string> = {
      'tier1_award_winners': 'award-winning premium web design',
      'tier2_elite_studios': 'elite creative studio portfolio',
      'tier3_tutorials': 'creative coding tutorial example',
      'tier4_ios_mobile': 'premium iOS/mobile app design',
      'tier5_saas_products': 'modern SaaS product interface',
      'tier6_ecommerce': 'premium e-commerce design',
      'tier7_design_systems': 'design system component library',
      'tier8_webgl_3d': 'immersive WebGL 3D experience',
    };
    parts.push(tierPrefixes[tier] || 'premium UI design');

    // Add award info
    if (entry.award) {
      parts.push(`${entry.award} winner`);
    }

    // Add studio info
    if (entry.studio) {
      parts.push(`by ${entry.studio}`);
    }

    // Add technologies
    if (entry.technologies && entry.technologies.length > 0) {
      const techStr = entry.technologies.map(tech => {
        switch (tech) {
          case 'three.js': return 'Three.js 3D graphics';
          case 'webgl': return 'WebGL visual effects';
          case 'gsap': return 'GSAP smooth animations';
          case 'scroll-trigger': return 'ScrollTrigger scroll effects';
          case 'r3f': return 'React Three Fiber';
          case 'framer-motion': return 'Framer Motion spring physics';
          case 'lenis': return 'Lenis smooth scroll';
          case 'webgpu': return 'WebGPU modern rendering';
          case 'glsl': return 'custom GLSL shaders';
          case 'react': return 'React';
          case 'next.js': return 'Next.js';
          default: return tech;
        }
      }).join(', ');
      parts.push(techStr);
    }

    // Add platform info
    if (entry.platform) {
      switch (entry.platform) {
        case 'ios':
          parts.push('iOS native design patterns');
          break;
        case 'android':
          parts.push('Material Design patterns');
          break;
        case 'visionos':
          parts.push('visionOS spatial computing');
          break;
      }
    }

    // Add standard quality descriptors
    parts.push('high-fidelity mockup');
    parts.push('modern 2026 aesthetic');
    parts.push('clean professional layout');
    parts.push('premium visual quality');

    return parts.join(', ');
  }

  private sanitizeFilename(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
  }

  private async saveManifest(): Promise<void> {
    const manifest = {
      lastUpdated: new Date().toISOString(),
      stats: this.stats,
      totalCaptures: this.results.filter(r => r.success).length,
      byTier: this.results.reduce((acc, r) => {
        if (r.success) {
          acc[r.tier] = (acc[r.tier] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>),
      results: this.results,
    };

    await fs.promises.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    return { ...this.stats, totalSuccess: this.results.filter(r => r.success).length };
  }
}

// CLI Entry Point
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Bulk URL Capture - Direct screenshot capture from curated URLs

Usage:
  npx tsx bulk-url-capture.ts [options]

Options:
  --tier=tier1,tier2      Filter by tier (comma-separated)
  --max=100               Max URLs to capture
  --no-skip               Don't skip already captured URLs
  --file=expanded         Use expanded-urls.json instead of default
  --help, -h              Show this help

Tiers:
  tier1_award_winners     Awwwards, FWA, CSS Awards winners
  tier2_elite_studios     Elite creative studios
  tier3_tutorials         Codrops, Three.js Journey tutorials
  tier4_ios_mobile        iOS/Mobile design resources
  tier5_saas_products     SaaS product interfaces
  tier6_ecommerce         E-commerce design
  tier7_design_systems    Design system components
  tier8_webgl_3d          WebGL/3D experiences

Examples:
  # Capture all URLs
  npx tsx bulk-url-capture.ts

  # Only award winners and studios
  npx tsx bulk-url-capture.ts --tier=tier1_award_winners,tier2_elite_studios

  # Limit to 50 URLs
  npx tsx bulk-url-capture.ts --max=50
`);
    return;
  }

  const tierArg = args.find(a => a.startsWith('--tier='));
  const tierFilter = tierArg?.replace('--tier=', '').split(',');

  const maxArg = args.find(a => a.startsWith('--max='));
  const maxUrls = maxArg ? parseInt(maxArg.replace('--max=', '')) : undefined;

  const skipExisting = !args.includes('--no-skip');

  const fileArg = args.find(a => a.startsWith('--file='));
  const fileValue = fileArg?.replace('--file=', '');
  let urlsFile = DEFAULT_URLS_FILE;
  if (fileValue === 'expanded') {
    urlsFile = EXPANDED_URLS_FILE;
  } else if (fileValue === 'additional') {
    urlsFile = ADDITIONAL_URLS_FILE;
  }

  const service = new BulkUrlCaptureService();

  try {
    await service.initialize();

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('BULK URL CAPTURE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  URLs file: ${path.basename(urlsFile)}`);
    console.log(`  Tier filter: ${tierFilter?.join(', ') || 'all'}`);
    console.log(`  Max URLs: ${maxUrls || 'unlimited'}`);
    console.log(`  Skip existing: ${skipExisting}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    const results = await service.captureAllUrls({
      tierFilter,
      maxUrls,
      skipExisting,
      urlsFile,
    });

    const stats = service.getStats();
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('CAPTURE COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Total URLs: ${stats.total}`);
    console.log(`  Captured: ${stats.captured}`);
    console.log(`  Failed: ${stats.failed}`);
    console.log(`  Skipped: ${stats.skipped}`);
    console.log(`  Total Success: ${stats.totalSuccess}`);
    console.log('═══════════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('Capture failed:', error);
    process.exit(1);
  } finally {
    await service.cleanup();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
