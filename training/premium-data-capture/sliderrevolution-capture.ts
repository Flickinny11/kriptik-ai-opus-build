/**
 * SliderRevolution Premium Data Capture
 * Captures templates, animations, transitions, and visual patterns from sliderrevolution.com
 *
 * Key capture targets:
 * - 300+ premium templates (sliders, carousels, heroes, one-page sites)
 * - WebGL transitions and effects
 * - GSAP-powered animations
 * - 3D navigation patterns
 * - Parallax and scroll-based interactions
 * - Particle effects
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Output directories
const OUTPUT_DIR = path.join(__dirname, '../ui-lora/dataset/images/sliderrevolution');
const CAPTIONS_DIR = path.join(__dirname, '../ui-lora/dataset/captions');
const METADATA_DIR = path.join(__dirname, 'sliderrevolution-metadata');
const PROGRESS_FILE = path.join(__dirname, 'sliderrevolution-progress.json');

// SliderRevolution URLs to scrape
const SLIDERREV_SOURCES = {
  templates: 'https://www.sliderrevolution.com/wordpress-templates/',
  sliders: 'https://www.sliderrevolution.com/wordpress-sliders/',
  carousels: 'https://www.sliderrevolution.com/website-carousels/',
  heroes: 'https://www.sliderrevolution.com/website-hero-sections/',
  onePageSites: 'https://www.sliderrevolution.com/one-page-websites/',
  animations: 'https://www.sliderrevolution.com/website-animation-effects/',
  transitions: 'https://www.sliderrevolution.com/web-page-transitions/',
  particles: 'https://www.sliderrevolution.com/particle-animation/',
  addons: 'https://www.sliderrevolution.com/expand-possibilities-with-website-addons/',
};

// Viewport configurations for multi-device capture
const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  laptop: { width: 1440, height: 900 },
  tablet: { width: 1024, height: 768 },
  mobile: { width: 430, height: 932 },
};

// Animation/effect keywords for caption generation
const EFFECT_KEYWORDS = {
  webgl: 'WebGL shader effects, GPU-accelerated',
  parallax: 'parallax scrolling, depth layers',
  '3d': '3D transforms, perspective navigation',
  gsap: 'GSAP timeline animation, scroll-triggered',
  particle: 'particle system, dynamic particles',
  morph: 'shape morphing, fluid transitions',
  scroll: 'scroll-based animation, scrubbed timeline',
  hover: 'hover interactions, mouse-triggered',
  carousel: 'infinite carousel, smooth rotation',
  slider: 'slide transitions, auto-play sequence',
  hero: 'hero section, above-fold impact',
  reveal: 'reveal animation, staggered entrance',
  kinetic: 'kinetic typography, animated text',
};

interface TemplateInfo {
  name: string;
  url: string;
  demoUrl?: string;
  category: string;
  effects: string[];
  tags: string[];
}

interface Progress {
  completed: string[];
  failed: string[];
  templates: TemplateInfo[];
  lastUpdated: string;
}

function loadProgress(): Progress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch {}
  return { completed: [], failed: [], templates: [], lastUpdated: new Date().toISOString() };
}

function saveProgress(progress: Progress): void {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function sanitizeFilename(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function detectEffects(text: string): string[] {
  const effects: string[] = [];
  const lowerText = text.toLowerCase();

  for (const [key, _] of Object.entries(EFFECT_KEYWORDS)) {
    if (lowerText.includes(key)) {
      effects.push(key);
    }
  }

  return effects;
}

function generateCaption(template: TemplateInfo, viewport: string): string {
  const viewportDesc = viewport === 'desktop' ? 'desktop layout, wide viewport' :
    viewport === 'laptop' ? 'laptop layout, standard viewport' :
    viewport === 'tablet' ? 'tablet layout, medium viewport, iPad style' :
    'mobile layout, narrow viewport, iOS style';

  const effectDescriptions = template.effects
    .map(e => EFFECT_KEYWORDS[e as keyof typeof EFFECT_KEYWORDS])
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');

  const caption = [
    'kriptik_ui',
    'sliderrevolution premium template',
    template.category,
    viewportDesc,
    effectDescriptions || 'modern web animation',
    'high fidelity design',
    'professional visual effects',
    '2026 aesthetic',
    template.tags.slice(0, 2).join(', ') || 'interactive design',
  ].filter(Boolean).join(', ');

  return caption;
}

async function scrapeTemplateList(page: Page, url: string, category: string): Promise<TemplateInfo[]> {
  console.log(`\n📂 Scraping ${category} from ${url}...`);

  const templates: TemplateInfo[] = [];

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Scroll to load all templates (lazy loading)
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await page.waitForTimeout(1000);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    // Try multiple selectors for template items
    const selectors = [
      '.eg-item-skin-1-container',
      '.esg-filterbutton',
      '.template-item',
      '.grid-item',
      'a[href*="templates"]',
      '.eg-hover-wrapper',
      '[class*="template"]',
      '[class*="slider"]',
    ];

    for (const selector of selectors) {
      const items = await page.$$(selector);
      if (items.length > 0) {
        console.log(`   Found ${items.length} items with selector: ${selector}`);

        for (const item of items) {
          try {
            // Try to extract template info
            const linkEl = await item.$('a');
            const href = linkEl ? await linkEl.getAttribute('href') : null;
            const titleEl = await item.$('[class*="title"], h3, h4, .name, .eg-title');
            const title = titleEl ? await titleEl.textContent() : null;

            // Get any text content for effect detection
            const fullText = await item.textContent() || '';

            if (href && !templates.some(t => t.url === href)) {
              templates.push({
                name: title?.trim() || `${category}-template-${templates.length + 1}`,
                url: href.startsWith('http') ? href : `https://www.sliderrevolution.com${href}`,
                category,
                effects: detectEffects(fullText),
                tags: [],
              });
            }
          } catch {}
        }

        if (templates.length > 0) break;
      }
    }

    // Also look for iframe demos or embedded previews
    const iframes = await page.$$('iframe[src*="demo"], iframe[src*="preview"]');
    for (const iframe of iframes) {
      const src = await iframe.getAttribute('src');
      if (src) {
        console.log(`   Found demo iframe: ${src}`);
      }
    }

    console.log(`   ✅ Found ${templates.length} templates in ${category}`);

  } catch (error) {
    console.log(`   ❌ Error scraping ${url}: ${(error as Error).message.slice(0, 60)}`);
  }

  return templates;
}

async function scrapeAllTemplatePages(page: Page): Promise<TemplateInfo[]> {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  📋 PHASE 1: Scraping Template URLs from All Categories');
  console.log('═══════════════════════════════════════════════════════════════');

  const allTemplates: TemplateInfo[] = [];

  // Main templates page - paginate through all 300+ templates
  try {
    await page.goto(SLIDERREV_SOURCES.templates, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);

    // Look for pagination or "load more"
    let pageNum = 1;
    let hasMore = true;

    while (hasMore && pageNum <= 30) { // Max 30 pages
      console.log(`\n   📄 Templates page ${pageNum}...`);

      // Scroll to load content
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await page.waitForTimeout(500);
      }

      // Extract all visible template links
      const templateLinks = await page.$$eval(
        'a[href*="templates/"], a[href*="demo"], .eg-hover-wrapper a, [class*="template"] a',
        (links) => links.map(a => ({
          href: a.getAttribute('href') || '',
          text: a.textContent?.trim() || '',
        })).filter(l => l.href && !l.href.includes('#'))
      );

      console.log(`      Found ${templateLinks.length} links`);

      for (const link of templateLinks) {
        const fullUrl = link.href.startsWith('http') ? link.href : `https://www.sliderrevolution.com${link.href}`;
        if (!allTemplates.some(t => t.url === fullUrl) &&
            (fullUrl.includes('template') || fullUrl.includes('demo'))) {
          allTemplates.push({
            name: link.text || `template-${allTemplates.length + 1}`,
            url: fullUrl,
            category: 'templates',
            effects: detectEffects(link.text),
            tags: [],
          });
        }
      }

      // Try to find and click "Load More" or pagination
      const loadMoreBtn = await page.$('button:has-text("Load"), a:has-text("Load More"), .esg-loadmore, [class*="load-more"]');
      if (loadMoreBtn) {
        try {
          await loadMoreBtn.click();
          await page.waitForTimeout(3000);
          pageNum++;
        } catch {
          hasMore = false;
        }
      } else {
        // Try pagination
        const nextPage = await page.$(`a[href*="page/${pageNum + 1}"], .pagination a:has-text("${pageNum + 1}")`);
        if (nextPage) {
          try {
            await nextPage.click();
            await page.waitForTimeout(3000);
            pageNum++;
          } catch {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }
    }

  } catch (error) {
    console.log(`   ❌ Error on templates page: ${(error as Error).message.slice(0, 80)}`);
  }

  // Scrape other category pages
  const categoryPages = [
    { url: SLIDERREV_SOURCES.sliders, category: 'sliders' },
    { url: SLIDERREV_SOURCES.carousels, category: 'carousels' },
    { url: SLIDERREV_SOURCES.heroes, category: 'heroes' },
    { url: SLIDERREV_SOURCES.onePageSites, category: 'one-page' },
    { url: SLIDERREV_SOURCES.animations, category: 'animations' },
    { url: SLIDERREV_SOURCES.transitions, category: 'transitions' },
    { url: SLIDERREV_SOURCES.particles, category: 'particles' },
    { url: SLIDERREV_SOURCES.addons, category: 'addons' },
  ];

  for (const { url, category } of categoryPages) {
    const templates = await scrapeTemplateList(page, url, category);

    for (const template of templates) {
      if (!allTemplates.some(t => t.url === template.url)) {
        allTemplates.push(template);
      }
    }
  }

  console.log(`\n✅ Total unique templates found: ${allTemplates.length}`);
  return allTemplates;
}

async function captureTemplate(
  browser: Browser,
  template: TemplateInfo,
  progress: Progress
): Promise<boolean> {
  if (progress.completed.includes(template.url)) {
    return true;
  }

  const sanitizedName = sanitizeFilename(template.name);
  let context: BrowserContext | null = null;

  try {
    context = await browser.newContext({
      viewport: VIEWPORTS.desktop,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      deviceScaleFactor: 2,
    });

    const page = await context.newPage();

    // Navigate to template page
    await page.goto(template.url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Look for demo iframe or link
    let demoUrl = template.url;
    const demoLink = await page.$('a[href*="demo"], a:has-text("Demo"), a:has-text("Preview"), iframe[src*="demo"]');

    if (demoLink) {
      const tagName = await demoLink.evaluate(el => el.tagName);
      if (tagName === 'IFRAME') {
        demoUrl = await demoLink.getAttribute('src') || demoUrl;
      } else {
        demoUrl = await demoLink.getAttribute('href') || demoUrl;
      }

      if (demoUrl && !demoUrl.startsWith('http')) {
        demoUrl = `https://www.sliderrevolution.com${demoUrl}`;
      }

      // Navigate to demo page
      await page.goto(demoUrl, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(3000);
    }

    // Trigger any lazy loading and animations
    await page.evaluate(`(async () => {
      const delay = ms => new Promise(r => setTimeout(r, ms));

      // Scroll through the page to trigger animations
      for (let i = 0; i < 5; i++) {
        window.scrollBy(0, window.innerHeight);
        await delay(800);
      }
      window.scrollTo(0, 0);
      await delay(1000);

      // Try to trigger any hover effects
      const elements = document.querySelectorAll('[class*="hover"], button, a, [class*="animate"]');
      for (const el of elements) {
        el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        await delay(100);
      }
    })()`);

    // Capture at multiple viewports
    for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);

      const filename = `sliderrev_${template.category}_${sanitizedName}_${viewportName}.png`;
      const filePath = path.join(OUTPUT_DIR, filename);

      if (!fs.existsSync(filePath)) {
        // Full page screenshot
        await page.screenshot({
          path: filePath,
          fullPage: true,
          type: 'png',
        });

        // Generate caption
        const caption = generateCaption(template, viewportName);
        const captionPath = path.join(CAPTIONS_DIR, `sliderrev_${template.category}_${sanitizedName}_${viewportName}.txt`);
        await fs.promises.writeFile(captionPath, caption);

        // Viewport-only screenshot (hero section)
        const heroFilename = `sliderrev_${template.category}_${sanitizedName}_${viewportName}_hero.png`;
        const heroPath = path.join(OUTPUT_DIR, heroFilename);

        await page.screenshot({
          path: heroPath,
          fullPage: false,
          type: 'png',
        });

        const heroCaption = caption.replace('high fidelity design', 'hero section, above the fold');
        const heroCaptionPath = path.join(CAPTIONS_DIR, `sliderrev_${template.category}_${sanitizedName}_${viewportName}_hero.txt`);
        await fs.promises.writeFile(heroCaptionPath, heroCaption);
      }
    }

    // Capture scroll animation frames (for scroll-based templates)
    if (template.effects.includes('scroll') || template.effects.includes('parallax')) {
      await page.setViewportSize(VIEWPORTS.desktop);

      const scrollPositions = [0, 25, 50, 75, 100];
      for (const scrollPercent of scrollPositions) {
        await page.evaluate((percent) => {
          const maxScroll = document.body.scrollHeight - window.innerHeight;
          window.scrollTo(0, maxScroll * (percent / 100));
        }, scrollPercent);

        await page.waitForTimeout(500);

        const scrollFilename = `sliderrev_${template.category}_${sanitizedName}_scroll${scrollPercent}.png`;
        const scrollPath = path.join(OUTPUT_DIR, scrollFilename);

        if (!fs.existsSync(scrollPath)) {
          await page.screenshot({
            path: scrollPath,
            fullPage: false,
            type: 'png',
          });

          const scrollCaption = generateCaption(template, 'desktop').replace(
            'high fidelity design',
            `scroll position ${scrollPercent}%, scroll animation frame`
          );
          const scrollCaptionPath = path.join(CAPTIONS_DIR, `sliderrev_${template.category}_${sanitizedName}_scroll${scrollPercent}.txt`);
          await fs.promises.writeFile(scrollCaptionPath, scrollCaption);
        }
      }
    }

    progress.completed.push(template.url);
    return true;

  } catch (error) {
    console.log(`   ❌ Failed ${template.name}: ${(error as Error).message.slice(0, 50)}`);
    progress.failed.push(template.url);
    return false;

  } finally {
    if (context) {
      await context.close();
    }
  }
}

async function analyzeAnimationPatterns(page: Page): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  🔬 PHASE 3: Analyzing Animation Patterns & Techniques');
  console.log('═══════════════════════════════════════════════════════════════');

  const animationMetadata: Record<string, any> = {
    gsapPatterns: [],
    webglEffects: [],
    scrollTriggers: [],
    transitions: [],
    particleConfigs: [],
  };

  // Analyze the animation effects page
  try {
    await page.goto(SLIDERREV_SOURCES.animations, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Extract any code examples or animation descriptions
    const codeBlocks = await page.$$eval('pre, code, .code-block', (els) =>
      els.map(el => el.textContent?.trim()).filter(Boolean)
    );

    if (codeBlocks.length > 0) {
      animationMetadata.codeExamples = codeBlocks;
      console.log(`   Found ${codeBlocks.length} code blocks`);
    }

    // Look for animation configuration in page scripts
    const scriptContent = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script:not([src])');
      let content = '';
      scripts.forEach(s => content += s.textContent + '\n');
      return content;
    });

    // Extract GSAP patterns
    const gsapMatches = scriptContent.match(/gsap\.[a-zA-Z]+\([^)]+\)/g);
    if (gsapMatches) {
      animationMetadata.gsapPatterns = [...new Set(gsapMatches)].slice(0, 50);
      console.log(`   Found ${animationMetadata.gsapPatterns.length} GSAP patterns`);
    }

    // Extract ScrollTrigger patterns
    const scrollTriggerMatches = scriptContent.match(/ScrollTrigger[^}]+}/g);
    if (scrollTriggerMatches) {
      animationMetadata.scrollTriggers = [...new Set(scrollTriggerMatches)].slice(0, 20);
      console.log(`   Found ${animationMetadata.scrollTriggers.length} ScrollTrigger patterns`);
    }

  } catch (error) {
    console.log(`   ❌ Error analyzing animations: ${(error as Error).message.slice(0, 60)}`);
  }

  // Analyze transitions page
  try {
    await page.goto(SLIDERREV_SOURCES.transitions, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Extract transition descriptions
    const transitionInfo = await page.$$eval('h2, h3, p', (els) =>
      els.map(el => el.textContent?.trim())
        .filter(text => text && (
          text.toLowerCase().includes('transition') ||
          text.toLowerCase().includes('effect') ||
          text.toLowerCase().includes('animation')
        ))
    );

    if (transitionInfo.length > 0) {
      animationMetadata.transitionDescriptions = transitionInfo.slice(0, 30);
      console.log(`   Found ${animationMetadata.transitionDescriptions.length} transition descriptions`);
    }

  } catch (error) {
    console.log(`   ❌ Error analyzing transitions: ${(error as Error).message.slice(0, 60)}`);
  }

  // Save metadata
  const metadataPath = path.join(METADATA_DIR, 'animation-patterns.json');
  await fs.promises.writeFile(metadataPath, JSON.stringify(animationMetadata, null, 2));
  console.log(`\n✅ Animation metadata saved to ${metadataPath}`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🎨 SliderRevolution Premium Data Capture');
  console.log('  Capturing templates, animations, transitions, and effects');
  console.log('═══════════════════════════════════════════════════════════════');

  // Create output directories
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.promises.mkdir(CAPTIONS_DIR, { recursive: true });
  await fs.promises.mkdir(METADATA_DIR, { recursive: true });

  const progress = loadProgress();

  console.log(`\n📊 Previous progress: ${progress.completed.length} completed, ${progress.failed.length} failed`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-web-security', '--disable-features=VizDisplayCompositor'],
  });

  try {
    const context = await browser.newContext({
      viewport: VIEWPORTS.desktop,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // Phase 1: Scrape template URLs
    let templates = progress.templates;
    if (templates.length === 0) {
      templates = await scrapeAllTemplatePages(page);
      progress.templates = templates;
      saveProgress(progress);
    } else {
      console.log(`\n📋 Using ${templates.length} cached templates from previous run`);
    }

    await context.close();

    // Phase 2: Capture template screenshots
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  📸 PHASE 2: Capturing Template Screenshots');
    console.log('═══════════════════════════════════════════════════════════════');

    const pending = templates.filter(t => !progress.completed.includes(t.url));
    console.log(`\n   Total templates: ${templates.length}`);
    console.log(`   Already captured: ${progress.completed.length}`);
    console.log(`   Pending: ${pending.length}`);

    let captured = 0;
    let failed = 0;

    for (let i = 0; i < pending.length; i++) {
      const template = pending[i];

      console.log(`\n   [${i + 1}/${pending.length}] ${template.name} (${template.category})`);

      const success = await captureTemplate(browser, template, progress);

      if (success) {
        captured++;
      } else {
        failed++;
      }

      // Save progress every 5 templates
      if ((i + 1) % 5 === 0) {
        saveProgress(progress);
        console.log(`   💾 Progress saved (${progress.completed.length} completed)`);
      }
    }

    saveProgress(progress);

    // Phase 3: Analyze animation patterns
    const analysisContext = await browser.newContext({ viewport: VIEWPORTS.desktop });
    const analysisPage = await analysisContext.newPage();
    await analyzeAnimationPatterns(analysisPage);
    await analysisContext.close();

    // Final summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  📊 CAPTURE COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Total Templates:    ${templates.length}`);
    console.log(`  Captured This Run:  ${captured}`);
    console.log(`  Failed This Run:    ${failed}`);
    console.log(`  Total Completed:    ${progress.completed.length}`);
    console.log(`  Output Directory:   ${OUTPUT_DIR}`);
    console.log('═══════════════════════════════════════════════════════════════');

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
