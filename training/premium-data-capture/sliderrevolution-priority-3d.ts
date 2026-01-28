/**
 * SliderRevolution Priority 3D Templates Capture
 * Captures the most premium 3D, immersive, and unique navigation templates
 *
 * These templates feature:
 * - 3D depth/parallax navigation
 * - "Walking forward" scroll experiences
 * - Immersive WebGL effects
 * - Unique page-to-page transitions
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '../ui-lora/dataset/images/sliderrev-priority');
const CAPTIONS_DIR = path.join(__dirname, '../ui-lora/dataset/captions');
const ANIMATION_DIR = path.join(__dirname, 'sliderrevolution-metadata/animations');

// Priority 3D and immersive templates from SliderRevolution
const PRIORITY_TEMPLATES = [
  // 3D Parallax & Depth
  { name: '3d-parallax-scene', url: 'https://www.sliderrevolution.com/templates/wordpress-3d-parallax/', category: '3d-parallax', effects: ['3d', 'parallax', 'depth', 'hotspots'] },
  { name: '3d-product-hero', url: 'https://www.sliderrevolution.com/templates/wordpress-3d-scene/', category: '3d-hero', effects: ['3d', 'webgl', 'product'] },
  { name: 'artistic-parallax', url: 'https://www.sliderrevolution.com/templates/artistic-parallax-slider/', category: '3d-parallax', effects: ['parallax', 'artistic', 'scroll'] },

  // Immersive One-Page Experiences
  { name: 'immersion-template', url: 'https://www.sliderrevolution.com/templates/immersion-website-template/', category: 'immersive', effects: ['scroll', 'parallax', 'slicing', 'fullscreen'] },
  { name: 'parallax-one-pager', url: 'https://www.sliderrevolution.com/templates/parallax-one-pager-template/', category: 'immersive', effects: ['parallax', 'scroll', 'one-page'] },

  // WebGL & Advanced Effects
  { name: 'distortion-slider', url: 'https://www.sliderrevolution.com/templates/distortion-slider/', category: 'webgl', effects: ['webgl', 'distortion', 'morph'] },
  { name: 'liquid-slider', url: 'https://www.sliderrevolution.com/templates/liquid-slider/', category: 'webgl', effects: ['webgl', 'liquid', 'morph'] },
  { name: 'particle-effect', url: 'https://www.sliderrevolution.com/templates/particle-effect-slider/', category: 'webgl', effects: ['particle', 'webgl', 'interactive'] },

  // Unique Navigation Patterns
  { name: 'vertical-scroll-slider', url: 'https://www.sliderrevolution.com/templates/vertical-scroll-slider/', category: 'scroll-nav', effects: ['scroll', 'vertical', 'navigation'] },
  { name: 'fullscreen-hero', url: 'https://www.sliderrevolution.com/templates/fullscreen-hero-slider/', category: 'hero', effects: ['fullscreen', 'hero', 'scroll'] },
  { name: 'showcase-carousel', url: 'https://www.sliderrevolution.com/templates/showcase-carousel/', category: 'carousel', effects: ['3d', 'carousel', 'showcase'] },

  // Interactive & Kinetic
  { name: 'interactive-media', url: 'https://www.sliderrevolution.com/templates/interactive-media-carousel/', category: 'interactive', effects: ['interactive', 'media', 'hover'] },
  { name: 'kinetic-typography', url: 'https://www.sliderrevolution.com/templates/kinetic-text-slider/', category: 'kinetic', effects: ['kinetic', 'typography', 'animation'] },

  // Product & Portfolio Showcases
  { name: 'furniture-slider', url: 'https://www.sliderrevolution.com/templates/furniture-website-slider/', category: 'product', effects: ['parallax', 'product', 'showcase'] },
  { name: 'portfolio-showcase', url: 'https://www.sliderrevolution.com/templates/portfolio-showcase-slider/', category: 'portfolio', effects: ['portfolio', 'grid', 'reveal'] },

  // Additional premium templates to search for
  { name: 'scroll-animation', url: 'https://www.sliderrevolution.com/templates/scroll-animation-slider/', category: 'scroll', effects: ['scroll', 'gsap', 'timeline'] },
  { name: 'avant-garde', url: 'https://www.sliderrevolution.com/templates/avant-garde-slider/', category: 'artistic', effects: ['artistic', 'creative', 'unique'] },
  { name: 'glass-morphism', url: 'https://www.sliderrevolution.com/templates/glassmorphism-slider/', category: 'glass', effects: ['glass', 'blur', 'modern'] },
  { name: 'dark-mode', url: 'https://www.sliderrevolution.com/templates/dark-mode-slider/', category: 'dark', effects: ['dark', 'elegant', 'modern'] },
  { name: 'split-screen', url: 'https://www.sliderrevolution.com/templates/split-screen-slider/', category: 'split', effects: ['split', 'reveal', 'transition'] },
];

const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  laptop: { width: 1440, height: 900 },
  tablet: { width: 1024, height: 768 },
  mobile: { width: 430, height: 932 },
};

const EFFECT_CAPTIONS: Record<string, string> = {
  '3d': '3D depth transforms, perspective navigation',
  'parallax': 'multi-layer parallax, depth scrolling',
  'webgl': 'WebGL shader effects, GPU-accelerated',
  'scroll': 'scroll-triggered animation, GSAP timeline',
  'immersive': 'immersive full-page experience',
  'carousel': '3D carousel rotation, smooth transitions',
  'morph': 'liquid morphing, shape transitions',
  'particle': 'particle system, dynamic effects',
  'kinetic': 'kinetic typography, animated text',
  'interactive': 'mouse-driven interactions, hover effects',
  'glass': 'glassmorphism, backdrop-blur effects',
  'fullscreen': 'full viewport hero, impactful entry',
};

function sanitizeFilename(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
}

function generateCaption(template: typeof PRIORITY_TEMPLATES[0], viewport: string): string {
  const viewportDesc = viewport === 'desktop' ? 'desktop layout, wide viewport' :
    viewport === 'laptop' ? 'laptop layout, standard viewport' :
    viewport === 'tablet' ? 'tablet layout, iPad style' :
    'mobile layout, iOS style';

  const effectDescriptions = template.effects
    .map(e => EFFECT_CAPTIONS[e])
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');

  return [
    'kriptik_ui',
    'sliderrevolution premium',
    template.category,
    viewportDesc,
    effectDescriptions,
    'high fidelity mockup',
    'professional animation',
    '2026 aesthetic',
  ].filter(Boolean).join(', ');
}

async function captureScrollAnimation(
  page: Page,
  template: typeof PRIORITY_TEMPLATES[0],
  outputDir: string
): Promise<void> {
  console.log(`      📹 Capturing scroll animation frames...`);

  const scrollPositions = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  for (const percent of scrollPositions) {
    await page.evaluate((p) => {
      const maxScroll = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      ) - window.innerHeight;
      window.scrollTo({ top: maxScroll * (p / 100), behavior: 'instant' });
    }, percent);

    await page.waitForTimeout(800); // Wait for animations to settle

    const filename = `sliderrev_${template.category}_${sanitizeFilename(template.name)}_scroll${percent.toString().padStart(3, '0')}.png`;
    const filePath = path.join(outputDir, filename);

    await page.screenshot({
      path: filePath,
      fullPage: false,
      type: 'png',
    });

    const caption = generateCaption(template, 'desktop').replace(
      'high fidelity mockup',
      `scroll position ${percent}%, animation frame`
    );
    const captionPath = path.join(CAPTIONS_DIR, filename.replace('.png', '.txt'));
    await fs.promises.writeFile(captionPath, caption);
  }
}

async function captureMouseInteraction(
  page: Page,
  template: typeof PRIORITY_TEMPLATES[0],
  outputDir: string
): Promise<void> {
  if (!template.effects.includes('interactive') && !template.effects.includes('parallax')) {
    return;
  }

  console.log(`      🖱️ Capturing mouse interaction states...`);

  const positions = [
    { x: 0.25, y: 0.25, name: 'topleft' },
    { x: 0.75, y: 0.25, name: 'topright' },
    { x: 0.5, y: 0.5, name: 'center' },
    { x: 0.25, y: 0.75, name: 'bottomleft' },
    { x: 0.75, y: 0.75, name: 'bottomright' },
  ];

  const viewport = page.viewportSize();
  if (!viewport) return;

  for (const pos of positions) {
    const x = viewport.width * pos.x;
    const y = viewport.height * pos.y;

    await page.mouse.move(x, y);
    await page.waitForTimeout(500);

    const filename = `sliderrev_${template.category}_${sanitizeFilename(template.name)}_mouse_${pos.name}.png`;
    const filePath = path.join(outputDir, filename);

    await page.screenshot({
      path: filePath,
      fullPage: false,
      type: 'png',
    });

    const caption = generateCaption(template, 'desktop').replace(
      'high fidelity mockup',
      `mouse position ${pos.name}, parallax effect state`
    );
    const captionPath = path.join(CAPTIONS_DIR, filename.replace('.png', '.txt'));
    await fs.promises.writeFile(captionPath, caption);
  }
}

async function extractAnimationData(page: Page, template: typeof PRIORITY_TEMPLATES[0]): Promise<any> {
  console.log(`      🔬 Extracting animation configuration...`);

  try {
    const animationData = await page.evaluate(() => {
      const data: any = {
        gsapTimelines: [],
        scrollTriggers: [],
        sr7Config: null,
        cssAnimations: [],
      };

      // Extract GSAP timelines
      // @ts-ignore
      if (window.gsap) {
        // @ts-ignore
        const timelines = window.gsap.getAll ? window.gsap.getAll() : [];
        data.gsapTimelines = timelines.slice(0, 10).map((tl: any) => ({
          duration: tl.duration?.() || 0,
          labels: tl.labels || {},
        }));
      }

      // Extract ScrollTrigger configs
      // @ts-ignore
      if (window.ScrollTrigger) {
        // @ts-ignore
        const triggers = window.ScrollTrigger.getAll ? window.ScrollTrigger.getAll() : [];
        data.scrollTriggers = triggers.slice(0, 10).map((st: any) => ({
          trigger: st.trigger?.className || '',
          start: st.vars?.start || '',
          end: st.vars?.end || '',
          scrub: st.vars?.scrub || false,
        }));
      }

      // Extract SR7 config
      // @ts-ignore
      if (window.SR7) {
        // @ts-ignore
        data.sr7Config = {
          // @ts-ignore
          breakpoints: window.SR7.G?.breakPoints || [],
          // @ts-ignore
          modules: window.SR7.E?.modules || [],
        };
      }

      // Extract CSS animations
      const styleSheets = Array.from(document.styleSheets);
      for (const sheet of styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule instanceof CSSKeyframesRule) {
              data.cssAnimations.push({
                name: rule.name,
                keyframes: Array.from(rule.cssRules).length,
              });
            }
          }
        } catch {}
      }

      return data;
    });

    return animationData;
  } catch (error) {
    console.log(`         Animation extraction failed: ${(error as Error).message.slice(0, 40)}`);
    return null;
  }
}

async function captureTemplate(
  browser: Browser,
  template: typeof PRIORITY_TEMPLATES[0]
): Promise<boolean> {
  console.log(`\n   📸 Capturing: ${template.name}`);
  console.log(`      URL: ${template.url}`);
  console.log(`      Effects: ${template.effects.join(', ')}`);

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

    // Look for demo iframe or embedded preview
    const demoFrame = await page.$('iframe[src*="demo"], iframe[src*="preview"], .rs-module-wrap');
    let targetPage = page;

    if (demoFrame) {
      const frameSrc = await demoFrame.getAttribute('src');
      if (frameSrc) {
        console.log(`      Found demo iframe: ${frameSrc}`);
        await page.goto(frameSrc.startsWith('http') ? frameSrc : `https://www.sliderrevolution.com${frameSrc}`, {
          waitUntil: 'networkidle',
          timeout: 60000,
        });
        await page.waitForTimeout(3000);
      }
    }

    // Trigger lazy loading and initial animations
    await page.evaluate(`(async () => {
      const delay = ms => new Promise(r => setTimeout(r, ms));

      // Scroll through page to trigger all content
      for (let i = 0; i < 5; i++) {
        window.scrollBy(0, window.innerHeight);
        await delay(800);
      }
      window.scrollTo(0, 0);
      await delay(1500);

      // Trigger hover states
      const interactiveEls = document.querySelectorAll('[class*="hover"], button, a, [class*="rs-"]');
      for (const el of Array.from(interactiveEls).slice(0, 10)) {
        el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        await delay(100);
      }
    })()`);

    // Capture at multiple viewports
    for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);

      // Full page screenshot
      const filename = `sliderrev_${template.category}_${sanitizeFilename(template.name)}_${viewportName}.png`;
      const filePath = path.join(OUTPUT_DIR, filename);

      await page.screenshot({
        path: filePath,
        fullPage: true,
        type: 'png',
      });

      // Caption
      const caption = generateCaption(template, viewportName);
      const captionPath = path.join(CAPTIONS_DIR, filename.replace('.png', '.txt'));
      await fs.promises.writeFile(captionPath, caption);

      // Hero section (viewport only)
      const heroFilename = `sliderrev_${template.category}_${sanitizeFilename(template.name)}_${viewportName}_hero.png`;
      const heroPath = path.join(OUTPUT_DIR, heroFilename);

      await page.screenshot({
        path: heroPath,
        fullPage: false,
        type: 'png',
      });

      const heroCaption = caption.replace('high fidelity mockup', 'hero section, above the fold');
      const heroCaptionPath = path.join(CAPTIONS_DIR, heroFilename.replace('.png', '.txt'));
      await fs.promises.writeFile(heroCaptionPath, heroCaption);
    }

    // Reset to desktop for animation captures
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Capture scroll animation frames (for scroll-based templates)
    if (template.effects.includes('scroll') || template.effects.includes('parallax') || template.effects.includes('3d')) {
      await captureScrollAnimation(page, template, OUTPUT_DIR);
    }

    // Capture mouse interaction states (for parallax/interactive templates)
    await captureMouseInteraction(page, template, OUTPUT_DIR);

    // Extract animation configuration data
    const animationData = await extractAnimationData(page, template);
    if (animationData) {
      const animPath = path.join(ANIMATION_DIR, `${sanitizeFilename(template.name)}.json`);
      await fs.promises.writeFile(animPath, JSON.stringify({
        template: template.name,
        url: template.url,
        effects: template.effects,
        ...animationData,
      }, null, 2));
    }

    console.log(`      ✅ Captured successfully`);
    return true;

  } catch (error) {
    console.log(`      ❌ Failed: ${(error as Error).message.slice(0, 60)}`);
    return false;

  } finally {
    if (context) {
      await context.close();
    }
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🎯 SliderRevolution Priority 3D Templates Capture');
  console.log('  Focus: 3D navigation, immersive scroll, WebGL effects');
  console.log('═══════════════════════════════════════════════════════════════');

  // Create output directories
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.promises.mkdir(CAPTIONS_DIR, { recursive: true });
  await fs.promises.mkdir(ANIMATION_DIR, { recursive: true });

  console.log(`\n📋 Priority templates to capture: ${PRIORITY_TEMPLATES.length}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-web-security'],
  });

  let captured = 0;
  let failed = 0;

  try {
    for (let i = 0; i < PRIORITY_TEMPLATES.length; i++) {
      const template = PRIORITY_TEMPLATES[i];
      console.log(`\n[${i + 1}/${PRIORITY_TEMPLATES.length}] Processing ${template.name}...`);

      const success = await captureTemplate(browser, template);

      if (success) {
        captured++;
      } else {
        failed++;
      }

      // Small delay between templates
      await new Promise(r => setTimeout(r, 2000));
    }
  } finally {
    await browser.close();
  }

  // Count total images captured
  const images = await fs.promises.readdir(OUTPUT_DIR).catch(() => []);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  📊 PRIORITY CAPTURE COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Templates Attempted: ${PRIORITY_TEMPLATES.length}`);
  console.log(`  Captured:           ${captured}`);
  console.log(`  Failed:             ${failed}`);
  console.log(`  Total Images:       ${images.length}`);
  console.log(`  Output:             ${OUTPUT_DIR}`);
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
