/**
 * Codrops Tutorial Demo Capture
 *
 * Captures screenshots from Codrops tutorial demos.
 * Target: 300-500 creative coding examples with:
 * - WebGL/Three.js effects
 * - GSAP/ScrollTrigger animations
 * - GLSL shaders
 * - CSS effects
 *
 * Run with: npx tsx codrops-capture.ts
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

const OUTPUT_DIR = path.join(__dirname, '../premium-designs/images/codrops');
const CAPTION_DIR = path.join(__dirname, '../premium-designs/captions/codrops');
const MANIFEST_PATH = path.join(__dirname, '../premium-designs/codrops-manifest.json');

const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  mobile: { width: 430, height: 932 },
};

// Codrops tag endpoints
const CODROPS_TAGS = [
  {
    name: 'webgl',
    baseUrl: 'https://tympanus.net/codrops/tag/webgl/',
    captionPrefix: 'Codrops WebGL demo, GPU-accelerated graphics',
    technologies: ['webgl', 'glsl'],
    maxPages: 15,
  },
  {
    name: 'three-js',
    baseUrl: 'https://tympanus.net/codrops/tag/three-js/',
    captionPrefix: 'Codrops Three.js demo, 3D web graphics',
    technologies: ['three.js', 'webgl'],
    maxPages: 15,
  },
  {
    name: 'glsl',
    baseUrl: 'https://tympanus.net/codrops/tag/glsl/',
    captionPrefix: 'Codrops GLSL shader demo, custom fragment shaders',
    technologies: ['glsl', 'webgl'],
    maxPages: 10,
  },
  {
    name: 'gsap',
    baseUrl: 'https://tympanus.net/codrops/tag/gsap/',
    captionPrefix: 'Codrops GSAP demo, smooth timeline animations',
    technologies: ['gsap'],
    maxPages: 15,
  },
  {
    name: 'scroll',
    baseUrl: 'https://tympanus.net/codrops/tag/scroll/',
    captionPrefix: 'Codrops scroll animation demo, scroll-driven effects',
    technologies: ['gsap', 'scroll-trigger'],
    maxPages: 15,
  },
  {
    name: 'animation',
    baseUrl: 'https://tympanus.net/codrops/tag/animation/',
    captionPrefix: 'Codrops animation demo, creative motion',
    technologies: ['css', 'js'],
    maxPages: 20,
  },
  {
    name: 'canvas',
    baseUrl: 'https://tympanus.net/codrops/tag/canvas/',
    captionPrefix: 'Codrops canvas demo, 2D/3D graphics',
    technologies: ['canvas', 'webgl'],
    maxPages: 10,
  },
  {
    name: 'css',
    baseUrl: 'https://tympanus.net/codrops/tag/css/',
    captionPrefix: 'Codrops CSS demo, pure CSS effects',
    technologies: ['css'],
    maxPages: 15,
  },
  {
    name: 'tutorial',
    baseUrl: 'https://tympanus.net/codrops/category/tutorials/',
    captionPrefix: 'Codrops tutorial demo, creative coding techniques',
    technologies: [],
    maxPages: 30,
  },
];

// ============================================================================
// Codrops Capture Service
// ============================================================================

interface CapturedDemo {
  id: string;
  url: string;
  demoUrl: string;
  title: string;
  tag: string;
  screenshots: {
    desktop: string;
    mobile?: string;
  };
  caption: string;
  technologies: string[];
  capturedAt: string;
}

class CodropsCaptureService {
  private browser: Browser | null = null;
  private results: CapturedDemo[] = [];
  private capturedUrls: Set<string> = new Set();
  private stats = {
    tagsProcessed: 0,
    pagesProcessed: 0,
    demosFound: 0,
    demosCaptured: 0,
    demosFailed: 0,
    demosSkipped: 0,
  };

  async initialize(): Promise<void> {
    console.log('[CodropsCapture] Initializing...');
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    await this.loadExistingManifest();
    console.log(`[CodropsCapture] Ready. ${this.capturedUrls.size} demos already captured.`);
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
        this.capturedUrls = new Set(this.results.map(r => r.demoUrl));
      }
    } catch {
      console.log('[CodropsCapture] No existing manifest, starting fresh');
    }
  }

  async captureAllTags(options: {
    tagFilter?: string[];
    maxPagesPerTag?: number;
    maxDemosTotal?: number;
  } = {}): Promise<CapturedDemo[]> {
    await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.promises.mkdir(CAPTION_DIR, { recursive: true });

    const tags = options.tagFilter
      ? CODROPS_TAGS.filter(t => options.tagFilter!.includes(t.name))
      : CODROPS_TAGS;

    console.log(`[CodropsCapture] Processing ${tags.length} tags`);

    for (const tag of tags) {
      if (options.maxDemosTotal && this.results.length >= options.maxDemosTotal) {
        console.log(`[CodropsCapture] Reached max demos limit (${options.maxDemosTotal})`);
        break;
      }

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[${tag.name.toUpperCase()}] ${tag.baseUrl}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      await this.captureTag(tag, {
        maxPages: options.maxPagesPerTag || tag.maxPages,
        maxDemosRemaining: options.maxDemosTotal
          ? options.maxDemosTotal - this.results.length
          : undefined,
      });

      this.stats.tagsProcessed++;
      await this.saveManifest();
    }

    return this.results;
  }

  private async captureTag(
    tag: typeof CODROPS_TAGS[0],
    options: { maxPages: number; maxDemosRemaining?: number }
  ): Promise<void> {
    const context = await this.browser!.newContext({
      viewport: VIEWPORTS.desktop,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const tagDir = path.join(OUTPUT_DIR, tag.name);
    const captionTagDir = path.join(CAPTION_DIR, tag.name);
    await fs.promises.mkdir(tagDir, { recursive: true });
    await fs.promises.mkdir(captionTagDir, { recursive: true });

    try {
      const page = await context.newPage();

      // Collect article URLs from listing pages
      const articles: { url: string; title: string }[] = [];

      for (let pageNum = 1; pageNum <= options.maxPages; pageNum++) {
        if (options.maxDemosRemaining && articles.length >= options.maxDemosRemaining) {
          break;
        }

        const pageUrl = pageNum === 1
          ? tag.baseUrl
          : `${tag.baseUrl}page/${pageNum}/`;

        console.log(`  [Page ${pageNum}] ${pageUrl}`);

        try {
          await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
          await this.delay(1500);

          // Extract article URLs
          const pageArticles = await page.evaluate(() => {
            const results: { url: string; title: string }[] = [];

            // Codrops article selectors
            const articleLinks = document.querySelectorAll(
              'article h2 a, .post-title a, .entry-title a, h2.ct-title a'
            );

            articleLinks.forEach(link => {
              const href = link.getAttribute('href');
              const title = link.textContent?.trim() || 'Untitled';

              if (href && href.includes('tympanus.net/codrops')) {
                results.push({ url: href, title });
              }
            });

            return results;
          });

          if (pageArticles.length === 0) {
            console.log(`    No more articles, stopping pagination`);
            break;
          }

          articles.push(...pageArticles);
          this.stats.pagesProcessed++;

        } catch {
          console.log(`    Error loading page ${pageNum}, stopping`);
          break;
        }

        await this.delay(1000);
      }

      this.stats.demosFound += articles.length;
      console.log(`  Found ${articles.length} articles in ${tag.name}`);

      // Process each article to find demo URL
      for (const article of articles) {
        if (this.capturedUrls.has(article.url)) {
          console.log(`    [SKIP] Already captured: ${article.title}`);
          this.stats.demosSkipped++;
          continue;
        }

        try {
          // Navigate to article page
          await page.goto(article.url, { waitUntil: 'networkidle', timeout: 30000 });
          await this.delay(1500);

          // Find demo URL
          const demoUrl = await page.evaluate(() => {
            // Look for demo button/link
            const demoLink = document.querySelector(
              'a[href*="/Tutorials/"], a[href*="/Development/"], ' +
              'a.ct-btn-demo, .demo-button a, a:has-text("Demo"), ' +
              'a:has-text("View Demo"), a.ct-demo-link'
            );
            return demoLink?.getAttribute('href') || null;
          });

          if (!demoUrl) {
            console.log(`    [SKIP] No demo URL found: ${article.title}`);
            continue;
          }

          // Capture the demo
          await this.captureDemo({
            articleUrl: article.url,
            demoUrl,
            title: article.title,
            tag: tag.name,
            captionPrefix: tag.captionPrefix,
            technologies: tag.technologies,
          }, page, tagDir, captionTagDir);

          this.stats.demosCaptured++;

        } catch (error) {
          console.log(`    [FAIL] ${article.title}: ${error}`);
          this.stats.demosFailed++;
        }

        await this.delay(2000 + Math.random() * 2000);
      }

      await page.close();
    } finally {
      await context.close();
    }
  }

  private async captureDemo(
    demo: {
      articleUrl: string;
      demoUrl: string;
      title: string;
      tag: string;
      captionPrefix: string;
      technologies: string[];
    },
    page: Page,
    outputDir: string,
    captionDir: string
  ): Promise<void> {
    console.log(`    [CAPTURE] ${demo.title}`);
    console.log(`              Demo: ${demo.demoUrl}`);

    const id = this.sanitizeFilename(demo.title);
    const screenshots: { desktop: string; mobile?: string } = { desktop: '' };

    try {
      // Navigate to demo
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto(demo.demoUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await this.delay(3000); // Wait for animations to settle

      // Desktop capture
      const desktopPath = path.join(outputDir, `${id}_desktop.png`);
      await page.screenshot({
        path: desktopPath,
        fullPage: false,
        type: 'png',
      });
      screenshots.desktop = desktopPath;

      // Mobile capture
      await page.setViewportSize(VIEWPORTS.mobile);
      await this.delay(1000);
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
    const caption = this.generateCaption(demo);
    const captionPath = path.join(captionDir, `${id}.txt`);
    await fs.promises.writeFile(captionPath, caption);

    // Record result
    const result: CapturedDemo = {
      id,
      url: demo.articleUrl,
      demoUrl: demo.demoUrl,
      title: demo.title,
      tag: demo.tag,
      screenshots,
      caption,
      technologies: demo.technologies,
      capturedAt: new Date().toISOString(),
    };

    this.results.push(result);
    this.capturedUrls.add(demo.demoUrl);
  }

  private generateCaption(demo: {
    title: string;
    captionPrefix: string;
    technologies: string[];
  }): string {
    const parts: string[] = ['kriptik_ui'];

    parts.push(demo.captionPrefix);

    if (demo.technologies.length > 0) {
      const techStr = demo.technologies.map(tech => {
        switch (tech) {
          case 'three.js': return 'Three.js 3D graphics';
          case 'webgl': return 'WebGL visual effects';
          case 'gsap': return 'GSAP smooth animations';
          case 'scroll-trigger': return 'ScrollTrigger scroll-driven effects';
          case 'glsl': return 'custom GLSL fragment shaders';
          case 'canvas': return 'HTML5 canvas';
          case 'css': return 'pure CSS effects';
          default: return tech;
        }
      }).join(', ');
      parts.push(techStr);
    }

    parts.push('creative coding');
    parts.push('interactive web experience');
    parts.push('modern 2026 aesthetic');

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
      byTag: this.results.reduce((acc, r) => {
        acc[r.tag] = (acc[r.tag] || 0) + 1;
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
Codrops Tutorial Demo Capture

Captures screenshots from Codrops tutorial demos.
Target: 300-500 creative coding examples.

Usage:
  npx tsx codrops-capture.ts [options]

Options:
  --tag=webgl,gsap     Filter by tag
  --max-pages=10       Max pages per tag
  --max-demos=200      Max total demos to capture
  --help, -h           Show this help

Tags:
  webgl, three-js, glsl, gsap, scroll, animation, canvas, css, tutorial

Examples:
  # Capture all tags
  npx tsx codrops-capture.ts

  # Only WebGL and Three.js demos
  npx tsx codrops-capture.ts --tag=webgl,three-js

  # Limit to 100 demos
  npx tsx codrops-capture.ts --max-demos=100
`);
    return;
  }

  const tagArg = args.find(a => a.startsWith('--tag='));
  const tagFilter = tagArg?.replace('--tag=', '').split(',');

  const maxPagesArg = args.find(a => a.startsWith('--max-pages='));
  const maxPagesPerTag = maxPagesArg ? parseInt(maxPagesArg.replace('--max-pages=', '')) : undefined;

  const maxDemosArg = args.find(a => a.startsWith('--max-demos='));
  const maxDemosTotal = maxDemosArg ? parseInt(maxDemosArg.replace('--max-demos=', '')) : undefined;

  const service = new CodropsCaptureService();

  try {
    await service.initialize();

    const results = await service.captureAllTags({
      tagFilter,
      maxPagesPerTag,
      maxDemosTotal,
    });

    const stats = service.getStats();
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('CODROPS CAPTURE COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Tags Processed: ${stats.tagsProcessed}`);
    console.log(`  Pages Processed: ${stats.pagesProcessed}`);
    console.log(`  Demos Found: ${stats.demosFound}`);
    console.log(`  Demos Captured: ${stats.demosCaptured}`);
    console.log(`  Demos Failed: ${stats.demosFailed}`);
    console.log(`  Demos Skipped: ${stats.demosSkipped}`);
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
