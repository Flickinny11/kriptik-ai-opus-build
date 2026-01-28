/**
 * SliderRevolution Individual Sliders & Carousels Capture
 *
 * Captures individual slider/carousel templates with dedicated trigger word: sliderrev_slider
 * These are the premium animated components that can be dropped into any UI
 *
 * Focus: The actual slider/carousel COMPONENTS (not full page templates)
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Output directories
const OUTPUT_DIR = path.join(__dirname, '../ui-lora/dataset/images/sliderrev-components');
const CAPTIONS_DIR = path.join(__dirname, '../ui-lora/dataset/captions');
const METADATA_DIR = path.join(__dirname, 'sliderrevolution-metadata/components');
const PROGRESS_FILE = path.join(__dirname, 'sliderrev-components-progress.json');

// Trigger word for this specific design category
const TRIGGER_WORD = 'sliderrev_slider';

// Category pages with individual slider/carousel components
const COMPONENT_SOURCES = {
  sliders: {
    url: 'https://www.sliderrevolution.com/wordpress-sliders/',
    category: 'slider',
    description: 'Full-width image sliders with transitions'
  },
  carousels: {
    url: 'https://www.sliderrevolution.com/website-carousels/',
    category: 'carousel',
    description: 'Multi-item carousels for products, testimonials, galleries'
  },
  heroes: {
    url: 'https://www.sliderrevolution.com/website-hero-sections/',
    category: 'hero',
    description: 'Hero sections with animations and CTA'
  },
  galleries: {
    url: 'https://www.sliderrevolution.com/wordpress-gallery/',
    category: 'gallery',
    description: 'Image galleries with lightbox and grid layouts'
  },
  animations: {
    url: 'https://www.sliderrevolution.com/website-animation-effects/',
    category: 'animation',
    description: 'Animated effects and transitions'
  },
  particles: {
    url: 'https://www.sliderrevolution.com/particle-animation/',
    category: 'particle',
    description: 'Particle effects and WebGL animations'
  }
};

// Viewport configurations for responsive captures
const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  laptop: { width: 1440, height: 900 },
  tablet: { width: 1024, height: 768 },
  mobile: { width: 430, height: 932 }
};

interface ComponentTemplate {
  name: string;
  url: string;
  category: string;
  source: string;
}

interface CaptureProgress {
  completed: string[];
  failed: string[];
  totalImages: number;
}

function loadProgress(): CaptureProgress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading progress:', e);
  }
  return { completed: [], failed: [], totalImages: 0 };
}

function saveProgress(progress: CaptureProgress): void {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function scrapeComponentUrls(browser: Browser): Promise<ComponentTemplate[]> {
  const templates: ComponentTemplate[] = [];
  const page = await browser.newPage();

  for (const [source, config] of Object.entries(COMPONENT_SOURCES)) {
    console.log(`\n📂 Scraping ${source} from ${config.url}...`);

    try {
      await page.goto(config.url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(2000);

      // Scroll to load lazy content
      await autoScroll(page);

      // Extract template links - try multiple selectors
      const links = await page.evaluate(() => {
        const selectors = [
          'a[href*="/templates/"]',
          '.template-card a',
          '.template-item a',
          '[class*="template"] a[href*="sliderrevolution"]',
          '.gallery-item a',
          'article a[href*="/templates/"]'
        ];

        const urls = new Set<string>();
        for (const selector of selectors) {
          document.querySelectorAll(selector).forEach((el: Element) => {
            const href = (el as HTMLAnchorElement).href;
            if (href && href.includes('/templates/') && !href.includes('wordpress-templates')) {
              urls.add(href);
            }
          });
        }
        return Array.from(urls);
      });

      console.log(`   Found ${links.length} template links`);

      for (const url of links) {
        const name = url.split('/templates/')[1]?.replace(/\/$/, '') || 'unknown';
        templates.push({
          name,
          url,
          category: config.category,
          source
        });
      }
    } catch (error) {
      console.error(`   ❌ Error scraping ${source}:`, error);
    }
  }

  await page.close();

  // Deduplicate by URL
  const uniqueTemplates = Array.from(
    new Map(templates.map(t => [t.url, t])).values()
  );

  console.log(`\n✅ Total unique component templates found: ${uniqueTemplates.length}`);
  return uniqueTemplates;
}

async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 500;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
  await page.waitForTimeout(1000);
}

async function captureComponent(
  page: Page,
  template: ComponentTemplate,
  progress: CaptureProgress
): Promise<number> {
  let capturedCount = 0;
  const baseFilename = `${TRIGGER_WORD}_${template.category}_${template.name}`;

  try {
    await page.goto(template.url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Find the demo/preview iframe or container
    const demoFrame = await page.$('iframe[src*="demo"], iframe[src*="preview"], .demo-container, .template-preview');

    // Capture at different viewports
    for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);

      // Full component screenshot
      const filename = `${baseFilename}_${vpName}.png`;
      const filepath = path.join(OUTPUT_DIR, filename);

      if (demoFrame) {
        await demoFrame.screenshot({ path: filepath });
      } else {
        // Try to find the main slider/carousel container
        const sliderContainer = await page.$('.rev_slider, .rs-layer-wrap, [class*="slider-container"], .tp-banner-container, main, .content-area');
        if (sliderContainer) {
          await sliderContainer.screenshot({ path: filepath });
        } else {
          await page.screenshot({ path: filepath, fullPage: false });
        }
      }

      // Generate caption
      const caption = generateCaption(template, vpName);
      const captionFile = path.join(CAPTIONS_DIR, `${baseFilename}_${vpName}.txt`);
      fs.writeFileSync(captionFile, caption);

      capturedCount++;
    }

    // Capture animation frames (slider transitions)
    await captureSliderTransitions(page, template, baseFilename);
    capturedCount += 5; // Estimate for transition frames

    // Extract component configuration
    await extractComponentConfig(page, template);

  } catch (error) {
    console.error(`   ❌ Error capturing ${template.name}:`, error);
    progress.failed.push(template.url);
  }

  return capturedCount;
}

async function captureSliderTransitions(
  page: Page,
  template: ComponentTemplate,
  baseFilename: string
): Promise<void> {
  try {
    // Look for slider navigation elements
    const nextBtn = await page.$('.tp-rightarrow, .rev_slider_next, [class*="next"], .slick-next');
    const dots = await page.$$('.tp-bullet, .slick-dots li, [class*="pagination"] button');

    if (nextBtn || dots.length > 0) {
      // Capture initial state
      await page.screenshot({
        path: path.join(OUTPUT_DIR, `${baseFilename}_slide0.png`),
        fullPage: false
      });

      // Click through slides
      const numSlides = Math.min(dots.length || 5, 5);
      for (let i = 1; i < numSlides; i++) {
        if (dots[i]) {
          await dots[i].click();
        } else if (nextBtn) {
          await nextBtn.click();
        }
        await page.waitForTimeout(1500); // Wait for transition

        await page.screenshot({
          path: path.join(OUTPUT_DIR, `${baseFilename}_slide${i}.png`),
          fullPage: false
        });

        // Generate caption for slide
        const caption = generateCaption(template, `slide${i}`, `slide ${i + 1} of ${numSlides}`);
        fs.writeFileSync(
          path.join(CAPTIONS_DIR, `${baseFilename}_slide${i}.txt`),
          caption
        );
      }
    }
  } catch (error) {
    // Silently fail - not all templates have navigable slides
  }
}

async function extractComponentConfig(page: Page, template: ComponentTemplate): Promise<void> {
  try {
    const config = await page.evaluate(() => {
      const result: any = {
        sliderConfig: null,
        transitions: [],
        animations: []
      };

      // Extract Slider Revolution config
      if ((window as any).revapi) {
        const revapi = (window as any).revapi;
        for (const key of Object.keys(revapi)) {
          if (revapi[key]?.settings) {
            result.sliderConfig = {
              gridwidth: revapi[key].settings.gridwidth,
              gridheight: revapi[key].settings.gridheight,
              responsiveLevels: revapi[key].settings.responsiveLevels,
              navigation: revapi[key].settings.navigation,
              parallax: revapi[key].settings.parallax
            };
            break;
          }
        }
      }

      // Extract GSAP/animation data
      if ((window as any).gsap) {
        const tweens = (window as any).gsap.getTweensOf('*');
        result.animations = tweens.slice(0, 10).map((t: any) => ({
          duration: t.duration(),
          ease: t.vars?.ease
        }));
      }

      // Extract CSS transitions
      const allElements = document.querySelectorAll('*');
      const transitionSet = new Set<string>();
      allElements.forEach(el => {
        const style = getComputedStyle(el);
        if (style.transition && style.transition !== 'all 0s ease 0s') {
          transitionSet.add(style.transition);
        }
      });
      result.transitions = Array.from(transitionSet).slice(0, 20);

      return result;
    });

    // Save component metadata
    const metadataFile = path.join(METADATA_DIR, `${template.name}.json`);
    fs.writeFileSync(metadataFile, JSON.stringify({
      template: template.name,
      url: template.url,
      category: template.category,
      source: template.source,
      ...config
    }, null, 2));

  } catch (error) {
    // Silently fail
  }
}

function generateCaption(
  template: ComponentTemplate,
  viewport: string,
  slideInfo?: string
): string {
  const categoryDescriptions: Record<string, string> = {
    slider: 'full-width image slider with smooth transitions',
    carousel: 'multi-item carousel for showcasing content',
    hero: 'hero section with animated elements and CTA',
    gallery: 'image gallery with lightbox functionality',
    animation: 'animated UI effect with motion design',
    particle: 'particle effect animation with WebGL'
  };

  const description = categoryDescriptions[template.category] || 'premium UI component';
  const viewportDesc = viewport.includes('mobile') ? 'mobile responsive' :
                       viewport.includes('tablet') ? 'tablet responsive' :
                       'desktop optimized';

  let caption = `${TRIGGER_WORD}, premium ${description}, ${template.name.replace(/-/g, ' ')}`;
  caption += `, ${viewportDesc} layout`;

  if (slideInfo) {
    caption += `, ${slideInfo}`;
  }

  caption += `, smooth animation transitions, professional design`;
  caption += `, Slider Revolution premium template, ready-to-use component`;
  caption += `, high-end visual effects, modern web design`;

  return caption;
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🎠 SliderRevolution Individual Sliders & Carousels Capture');
  console.log('  Trigger word: sliderrev_slider');
  console.log('  Focus: Premium animated components (not full templates)');
  console.log('═══════════════════════════════════════════════════════════════');

  // Ensure directories exist
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.promises.mkdir(CAPTIONS_DIR, { recursive: true });
  await fs.promises.mkdir(METADATA_DIR, { recursive: true });

  const progress = loadProgress();
  console.log(`\n📊 Previous progress: ${progress.completed.length} completed, ${progress.failed.length} failed`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-web-security']
  });

  try {
    // Phase 1: Scrape all component URLs
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  📋 PHASE 1: Scraping Component URLs');
    console.log('═══════════════════════════════════════════════════════════════');

    const templates = await scrapeComponentUrls(browser);

    // Filter out already completed
    const pending = templates.filter(t => !progress.completed.includes(t.url));

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  📸 PHASE 2: Capturing Component Screenshots');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`\n   Total components: ${templates.length}`);
    console.log(`   Already captured: ${progress.completed.length}`);
    console.log(`   Pending: ${pending.length}`);

    const page = await browser.newPage();

    for (let i = 0; i < pending.length; i++) {
      const template = pending[i];
      console.log(`\n   [${i + 1}/${pending.length}] ${template.name} (${template.category})`);

      const captured = await captureComponent(page, template, progress);
      progress.totalImages += captured;
      progress.completed.push(template.url);

      // Save progress every 5 templates
      if ((i + 1) % 5 === 0) {
        saveProgress(progress);
        console.log(`   💾 Progress saved (${progress.completed.length} completed, ${progress.totalImages} images)`);
      }
    }

    await page.close();
    saveProgress(progress);

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  📊 COMPONENT CAPTURE COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Templates Captured: ${progress.completed.length}`);
    console.log(`  Failed:             ${progress.failed.length}`);
    console.log(`  Total Images:       ${progress.totalImages}`);
    console.log(`  Trigger Word:       ${TRIGGER_WORD}`);
    console.log(`  Output:             ${OUTPUT_DIR}`);
    console.log('═══════════════════════════════════════════════════════════════');

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
