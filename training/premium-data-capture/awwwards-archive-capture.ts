/**
 * Awwwards Archive Capture
 *
 * Systematically captures screenshots from the Awwwards archive.
 * Target: 2,000-5,000 award-winning sites across categories:
 * - Site of the Day (SOTD)
 * - Site of the Year (SOTY)
 * - Three.js Collection
 * - GSAP Collection
 * - WebGL Collection
 * - Developer Awards
 *
 * Run with: npx tsx awwwards-archive-capture.ts
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

const OUTPUT_DIR = path.join(__dirname, '../premium-designs/images/awwwards');
const CAPTION_DIR = path.join(__dirname, '../premium-designs/captions/awwwards');
const MANIFEST_PATH = path.join(__dirname, '../premium-designs/awwwards-manifest.json');

const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  mobile: { width: 430, height: 932 },
};

// Awwwards category endpoints
const AWWWARDS_CATEGORIES = [
  {
    name: 'sotd',
    baseUrl: 'https://www.awwwards.com/websites/',
    captionPrefix: 'awwwards site of the day winner',
    maxPages: 100,
  },
  {
    name: 'soty',
    baseUrl: 'https://www.awwwards.com/websites/sites_of_the_year/',
    captionPrefix: 'awwwards site of the year winner',
    maxPages: 20,
  },
  {
    name: 'sotm',
    baseUrl: 'https://www.awwwards.com/websites/sites_of_the_month/',
    captionPrefix: 'awwwards site of the month winner',
    maxPages: 50,
  },
  {
    name: 'threejs',
    baseUrl: 'https://www.awwwards.com/websites/three-js/',
    captionPrefix: 'awwwards Three.js showcase, WebGL 3D',
    maxPages: 30,
    technologies: ['three.js', 'webgl'],
  },
  {
    name: 'gsap',
    baseUrl: 'https://www.awwwards.com/websites/gsap/',
    captionPrefix: 'awwwards GSAP showcase, smooth animations',
    maxPages: 30,
    technologies: ['gsap', 'scroll-trigger'],
  },
  {
    name: 'webgl',
    baseUrl: 'https://www.awwwards.com/websites/webgl/',
    captionPrefix: 'awwwards WebGL showcase, GPU graphics',
    maxPages: 30,
    technologies: ['webgl', 'glsl'],
  },
  {
    name: 'r3f',
    baseUrl: 'https://www.awwwards.com/websites/react-three-fiber/',
    captionPrefix: 'awwwards React Three Fiber showcase',
    maxPages: 20,
    technologies: ['r3f', 'drei', 'react'],
  },
  {
    name: 'framer-motion',
    baseUrl: 'https://www.awwwards.com/websites/framer-motion/',
    captionPrefix: 'awwwards Framer Motion showcase, spring physics',
    maxPages: 20,
    technologies: ['framer-motion', 'react'],
  },
  {
    name: 'developer-award',
    baseUrl: 'https://www.awwwards.com/websites/developer/',
    captionPrefix: 'awwwards developer award winner',
    maxPages: 30,
  },
];

// ============================================================================
// Awwwards Archive Capture Service
// ============================================================================

interface CapturedSite {
  id: string;
  url: string;
  title: string;
  category: string;
  screenshots: {
    desktop: string;
    mobile?: string;
  };
  caption: string;
  technologies: string[];
  awardDate?: string;
  capturedAt: string;
}

class AwwwardsArchiveCaptureService {
  private browser: Browser | null = null;
  private results: CapturedSite[] = [];
  private capturedUrls: Set<string> = new Set();
  private stats = {
    categoriesProcessed: 0,
    pagesProcessed: 0,
    sitesFound: 0,
    sitesCaptures: 0,
    sitesFailed: 0,
    sitesSkipped: 0,
  };

  async initialize(): Promise<void> {
    console.log('[AwwwardsCapture] Initializing...');
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    await this.loadExistingManifest();
    console.log(`[AwwwardsCapture] Ready. ${this.capturedUrls.size} sites already captured.`);
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
        this.capturedUrls = new Set(this.results.map(r => r.url));
      }
    } catch {
      console.log('[AwwwardsCapture] No existing manifest, starting fresh');
    }
  }

  async captureAllCategories(options: {
    categoryFilter?: string[];
    maxPagesPerCategory?: number;
    maxSitesTotal?: number;
  } = {}): Promise<CapturedSite[]> {
    await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.promises.mkdir(CAPTION_DIR, { recursive: true });

    const categories = options.categoryFilter
      ? AWWWARDS_CATEGORIES.filter(c => options.categoryFilter!.includes(c.name))
      : AWWWARDS_CATEGORIES;

    console.log(`[AwwwardsCapture] Processing ${categories.length} categories`);

    for (const category of categories) {
      if (options.maxSitesTotal && this.results.length >= options.maxSitesTotal) {
        console.log(`[AwwwardsCapture] Reached max sites limit (${options.maxSitesTotal})`);
        break;
      }

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[${category.name.toUpperCase()}] ${category.baseUrl}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      await this.captureCategory(category, {
        maxPages: options.maxPagesPerCategory || category.maxPages,
        maxSitesRemaining: options.maxSitesTotal
          ? options.maxSitesTotal - this.results.length
          : undefined,
      });

      this.stats.categoriesProcessed++;
      await this.saveManifest();
    }

    return this.results;
  }

  private async captureCategory(
    category: typeof AWWWARDS_CATEGORIES[0],
    options: { maxPages: number; maxSitesRemaining?: number }
  ): Promise<void> {
    const context = await this.browser!.newContext({
      viewport: VIEWPORTS.desktop,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const categoryDir = path.join(OUTPUT_DIR, category.name);
    const captionCategoryDir = path.join(CAPTION_DIR, category.name);
    await fs.promises.mkdir(categoryDir, { recursive: true });
    await fs.promises.mkdir(captionCategoryDir, { recursive: true });

    try {
      const page = await context.newPage();

      // Collect site URLs from listing pages
      const siteUrls: { url: string; title: string; awardDate?: string }[] = [];

      for (let pageNum = 1; pageNum <= options.maxPages; pageNum++) {
        if (options.maxSitesRemaining && siteUrls.length >= options.maxSitesRemaining) {
          break;
        }

        const pageUrl = pageNum === 1
          ? category.baseUrl
          : `${category.baseUrl}?page=${pageNum}`;

        console.log(`  [Page ${pageNum}] ${pageUrl}`);

        try {
          await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
          await this.delay(2000);

          // Extract site URLs from listing
          const sites = await page.evaluate(() => {
            const results: { url: string; title: string; awardDate?: string }[] = [];

            // Try multiple selector patterns for Awwwards
            const selectors = [
              '.box-item a[href*="sites/"]',
              '.list-item a[href*="sites/"]',
              'article a[href*="sites/"]',
              '.gallery-item a',
              'a.box-link',
            ];

            for (const selector of selectors) {
              const items = document.querySelectorAll(selector);
              items.forEach(item => {
                const href = item.getAttribute('href');
                const title = item.textContent?.trim() ||
                  item.getAttribute('title') ||
                  'Untitled';

                if (href && !results.find(r => r.url === href)) {
                  results.push({
                    url: href.startsWith('http')
                      ? href
                      : `https://www.awwwards.com${href}`,
                    title,
                  });
                }
              });
            }

            return results;
          });

          if (sites.length === 0) {
            console.log(`    No more sites found, stopping pagination`);
            break;
          }

          siteUrls.push(...sites);
          this.stats.pagesProcessed++;

        } catch (error) {
          console.log(`    Error loading page ${pageNum}, stopping`);
          break;
        }

        // Rate limiting between pages
        await this.delay(1500);
      }

      this.stats.sitesFound += siteUrls.length;
      console.log(`  Found ${siteUrls.length} sites in ${category.name}`);

      // Capture each site
      for (const site of siteUrls) {
        if (this.capturedUrls.has(site.url)) {
          console.log(`    [SKIP] Already captured: ${site.title}`);
          this.stats.sitesSkipped++;
          continue;
        }

        try {
          // First navigate to Awwwards page to get actual site URL
          await page.goto(site.url, { waitUntil: 'networkidle', timeout: 30000 });
          await this.delay(1500);

          // Extract the actual site URL from Awwwards page
          const actualSiteUrl = await page.evaluate(() => {
            const visitBtn = document.querySelector('a.visit-site, a[href*="://"][target="_blank"], .btn-visit a');
            return visitBtn?.getAttribute('href') || null;
          });

          if (!actualSiteUrl) {
            console.log(`    [SKIP] No site URL found for: ${site.title}`);
            continue;
          }

          // Capture the actual site
          await this.captureSite({
            url: actualSiteUrl,
            title: site.title,
            category: category.name,
            captionPrefix: category.captionPrefix,
            technologies: category.technologies || [],
            awardDate: site.awardDate,
          }, page, categoryDir, captionCategoryDir);

          this.stats.sitesCaptures++;

        } catch (error) {
          console.log(`    [FAIL] ${site.title}: ${error}`);
          this.stats.sitesFailed++;
        }

        // Rate limiting between sites
        await this.delay(2000 + Math.random() * 2000);
      }

      await page.close();
    } finally {
      await context.close();
    }
  }

  private async captureSite(
    site: {
      url: string;
      title: string;
      category: string;
      captionPrefix: string;
      technologies: string[];
      awardDate?: string;
    },
    page: Page,
    outputDir: string,
    captionDir: string
  ): Promise<void> {
    console.log(`    [CAPTURE] ${site.title}: ${site.url}`);

    const id = this.sanitizeFilename(site.title);
    const screenshots: { desktop: string; mobile?: string } = { desktop: '' };

    try {
      // Desktop capture
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto(site.url, { waitUntil: 'networkidle', timeout: 30000 });
      await this.delay(2000);

      const desktopPath = path.join(outputDir, `${id}_desktop.png`);
      await page.screenshot({
        path: desktopPath,
        fullPage: false,
        type: 'png',
      });
      screenshots.desktop = desktopPath;

      // Mobile capture
      await page.setViewportSize(VIEWPORTS.mobile);
      await this.delay(500);
      const mobilePath = path.join(outputDir, `${id}_mobile.png`);
      await page.screenshot({
        path: mobilePath,
        fullPage: false,
        type: 'png',
      });
      screenshots.mobile = mobilePath;

    } catch (error) {
      console.log(`      Screenshot failed: ${error}`);
      throw error;
    }

    // Generate caption
    const caption = this.generateCaption(site);
    const captionPath = path.join(captionDir, `${id}.txt`);
    await fs.promises.writeFile(captionPath, caption);

    // Record result
    const result: CapturedSite = {
      id,
      url: site.url,
      title: site.title,
      category: site.category,
      screenshots,
      caption,
      technologies: site.technologies,
      awardDate: site.awardDate,
      capturedAt: new Date().toISOString(),
    };

    this.results.push(result);
    this.capturedUrls.add(site.url);
  }

  private generateCaption(site: {
    title: string;
    captionPrefix: string;
    technologies: string[];
  }): string {
    const parts: string[] = ['kriptik_ui'];

    parts.push(site.captionPrefix);

    if (site.technologies.length > 0) {
      const techStr = site.technologies.map(tech => {
        switch (tech) {
          case 'three.js': return 'Three.js 3D graphics';
          case 'webgl': return 'WebGL visual effects';
          case 'gsap': return 'GSAP smooth animations';
          case 'scroll-trigger': return 'ScrollTrigger scroll-driven effects';
          case 'r3f': return 'React Three Fiber';
          case 'drei': return 'Drei helpers';
          case 'framer-motion': return 'Framer Motion spring physics';
          case 'glsl': return 'custom GLSL shaders';
          default: return tech;
        }
      }).join(', ');
      parts.push(techStr);
    }

    parts.push('premium web design');
    parts.push('high-fidelity mockup');
    parts.push('modern 2026 aesthetic');
    parts.push('clean professional layout');

    return parts.join(', ');
  }

  private sanitizeFilename(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }

  private async saveManifest(): Promise<void> {
    const manifest = {
      lastUpdated: new Date().toISOString(),
      stats: this.stats,
      totalCaptures: this.results.length,
      byCategory: this.results.reduce((acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + 1;
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
    return { ...this.stats, totalCaptures: this.results.length };
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Awwwards Archive Capture

Systematically captures screenshots from the Awwwards archive.
Target: 2,000-5,000 award-winning sites.

Usage:
  npx tsx awwwards-archive-capture.ts [options]

Options:
  --category=sotd,threejs  Filter by category
  --max-pages=10           Max pages per category
  --max-sites=1000         Max total sites to capture
  --help, -h               Show this help

Categories:
  sotd, soty, sotm, threejs, gsap, webgl, r3f, framer-motion, developer-award

Examples:
  # Capture all categories (full archive)
  npx tsx awwwards-archive-capture.ts

  # Only Three.js and GSAP collections
  npx tsx awwwards-archive-capture.ts --category=threejs,gsap

  # Limit to 500 sites total
  npx tsx awwwards-archive-capture.ts --max-sites=500
`);
    return;
  }

  const categoryArg = args.find(a => a.startsWith('--category='));
  const categoryFilter = categoryArg?.replace('--category=', '').split(',');

  const maxPagesArg = args.find(a => a.startsWith('--max-pages='));
  const maxPagesPerCategory = maxPagesArg ? parseInt(maxPagesArg.replace('--max-pages=', '')) : undefined;

  const maxSitesArg = args.find(a => a.startsWith('--max-sites='));
  const maxSitesTotal = maxSitesArg ? parseInt(maxSitesArg.replace('--max-sites=', '')) : undefined;

  const service = new AwwwardsArchiveCaptureService();

  try {
    await service.initialize();

    const results = await service.captureAllCategories({
      categoryFilter,
      maxPagesPerCategory,
      maxSitesTotal,
    });

    const stats = service.getStats();
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('AWWWARDS ARCHIVE CAPTURE COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Categories Processed: ${stats.categoriesProcessed}`);
    console.log(`  Pages Processed: ${stats.pagesProcessed}`);
    console.log(`  Sites Found: ${stats.sitesFound}`);
    console.log(`  Sites Captured: ${stats.sitesCaptures}`);
    console.log(`  Sites Failed: ${stats.sitesFailed}`);
    console.log(`  Sites Skipped: ${stats.sitesSkipped}`);
    console.log(`  Total in Dataset: ${stats.totalCaptures}`);
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
