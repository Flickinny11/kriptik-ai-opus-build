#!/usr/bin/env npx tsx
/**
 * Premium Screenshot Caption Generator
 *
 * Generates training captions for FLUX UI-LoRA from captured screenshots.
 * Captions follow the format: "kriptik_ui, [tier], [techniques], [visual description]"
 *
 * Run with: npx tsx training/premium-data-capture/generate-captions.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

const INPUT_DIR = path.join(__dirname, '../premium-designs/images');
const OUTPUT_DIR = path.join(__dirname, '../premium-designs/captions');
const MANIFEST_PATH = path.join(INPUT_DIR, 'capture-manifest.json');

// Tier descriptions for caption generation
const TIER_DESCRIPTIONS: Record<number, string> = {
  1: 'awwwards-tier design, award-winning web experience, premium visual quality',
  2: 'elite studio quality, experimental interface, cutting-edge web design',
  3: 'creative tutorial demo, innovative UI pattern, Codrops-style effect',
  4: 'iOS premium app, mobile-first design, Apple HIG compliant',
};

// Source-specific technique mappings
const SOURCE_TECHNIQUES: Record<string, string[]> = {
  'awwwards-soty': ['immersive scroll', 'hero animation', 'creative layout'],
  'awwwards-threejs': ['Three.js WebGL', '3D interaction', 'shader effects'],
  'awwwards-gsap': ['GSAP ScrollTrigger', 'timeline animation', 'smooth scroll'],
  'cssdesignawards': ['CSS excellence', 'modern layout', 'responsive design'],
  'fwa': ['innovative interaction', 'WebGL experience', 'experimental UI'],
  'csswinner': ['clean interface', 'modern aesthetics', 'CSS mastery'],
  'cssnectar': ['curated design', 'professional layout', 'visual hierarchy'],
  'orpetron': ['Three.js innovation', 'creative coding', '3D web'],
  'lusion-projects': ['WebGL immersive', 'AR VR experience', 'creative tech'],
  'activetheory-work': ['brand experience', 'interactive storytelling', 'WebGL'],
  'studiofreight-work': ['scroll animation', 'Lenis smooth', 'creative motion'],
  'immersive-garden': ['narrative WebGL', 'storytelling UI', 'immersive'],
  'codrops-demos': ['CSS technique', 'creative effect', 'UI pattern'],
  'codrops-webgl': ['WebGL shader', 'GLSL effect', 'visual experiment'],
  'made-with-gsap': ['GSAP animation', 'scroll effect', 'timeline'],
  'screensdesign': ['iOS screen', 'mobile UI', 'app interface'],
  'laudableapps': ['iOS app', 'beautiful mobile', 'native design'],
  'muzli-ios': ['iOS inspiration', 'mobile pattern', 'app design'],
};

// Visual style keywords based on device
const DEVICE_STYLES: Record<string, string> = {
  'desktop-chrome': 'desktop layout, wide viewport, full-width design',
  'iphone-14-pro': 'mobile portrait, iOS interface, touch-optimized',
  'ipad-pro-11': 'tablet layout, responsive design, split-view ready',
};

// ============================================================================
// Caption Generation
// ============================================================================

interface CapturedImage {
  id: string;
  source: string;
  tier: number;
  url: string;
  title: string;
  device: string;
  filePath: string;
  metadata?: {
    award?: string;
    technologies?: string[];
  };
}

interface CaptionResult {
  imagePath: string;
  captionPath: string;
  caption: string;
}

function generateCaption(image: CapturedImage): string {
  const parts: string[] = ['kriptik_ui'];

  // Add tier description
  const tierDesc = TIER_DESCRIPTIONS[image.tier] || 'premium UI design';
  parts.push(tierDesc);

  // Add source-specific techniques
  const techniques = SOURCE_TECHNIQUES[image.source] || ['modern design', 'clean interface'];
  parts.push(techniques.slice(0, 2).join(', '));

  // Add device-specific style
  const deviceKey = image.device.toLowerCase().replace(/\s+/g, '-');
  const deviceStyle = DEVICE_STYLES[deviceKey] || 'responsive layout';
  parts.push(deviceStyle);

  // Add visual description based on title
  const titleWords = image.title.toLowerCase();
  const visualHints: string[] = [];

  if (titleWords.includes('dark') || titleWords.includes('night')) {
    visualHints.push('dark mode');
  } else if (titleWords.includes('light') || titleWords.includes('white')) {
    visualHints.push('light mode');
  }

  if (titleWords.includes('minimal') || titleWords.includes('clean')) {
    visualHints.push('minimalist aesthetic');
  }

  if (titleWords.includes('3d') || titleWords.includes('webgl') || titleWords.includes('three')) {
    visualHints.push('3D elements');
  }

  if (titleWords.includes('scroll') || titleWords.includes('animation')) {
    visualHints.push('animated transitions');
  }

  if (titleWords.includes('dashboard') || titleWords.includes('admin')) {
    visualHints.push('data visualization');
  }

  if (titleWords.includes('ecommerce') || titleWords.includes('shop') || titleWords.includes('store')) {
    visualHints.push('product showcase');
  }

  if (titleWords.includes('portfolio') || titleWords.includes('agency')) {
    visualHints.push('creative portfolio');
  }

  if (visualHints.length > 0) {
    parts.push(visualHints.join(', '));
  }

  // Add award metadata if available
  if (image.metadata?.award) {
    parts.push(`${image.metadata.award} winner`);
  }

  // Standard quality markers
  parts.push('high fidelity mockup');
  parts.push('professional design');

  return parts.join(', ');
}

function getOutputCaptionPath(imagePath: string): string {
  const relativePath = path.relative(INPUT_DIR, imagePath);
  const parsed = path.parse(relativePath);
  const captionPath = path.join(OUTPUT_DIR, parsed.dir, `${parsed.name}.txt`);
  return captionPath;
}

async function generateCaptionsFromManifest(): Promise<CaptionResult[]> {
  const results: CaptionResult[] = [];

  // Read manifest
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('Manifest not found. Run screenshot capture first.');
    console.error(`Expected: ${MANIFEST_PATH}`);
    return results;
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  const images: CapturedImage[] = manifest.images || [];

  console.log(`Found ${images.length} images in manifest`);

  // Generate captions
  for (const image of images) {
    const caption = generateCaption(image);
    const captionPath = getOutputCaptionPath(image.filePath);

    // Ensure output directory exists
    const captionDir = path.dirname(captionPath);
    fs.mkdirSync(captionDir, { recursive: true });

    // Write caption
    fs.writeFileSync(captionPath, caption);

    results.push({
      imagePath: image.filePath,
      captionPath,
      caption,
    });
  }

  return results;
}

async function generateCaptionsFromDirectory(): Promise<CaptionResult[]> {
  const results: CaptionResult[] = [];

  // Scan directory for images
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];

  function scanDir(dir: string): void {
    if (!fs.existsSync(dir)) return;

    const items = fs.readdirSync(dir);

    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        scanDir(itemPath);
      } else if (imageExtensions.some(ext => item.toLowerCase().endsWith(ext))) {
        // Determine tier and source from path
        const relativePath = path.relative(INPUT_DIR, itemPath);
        const pathParts = relativePath.split(path.sep);
        const source = pathParts[0] || 'unknown';

        // Infer tier from source name
        let tier = 3;
        if (source.includes('awwwards') || source.includes('fwa') || source.includes('css')) {
          tier = 1;
        } else if (source.includes('lusion') || source.includes('active') || source.includes('studio') || source.includes('immersive')) {
          tier = 2;
        } else if (source.includes('ios') || source.includes('screen') || source.includes('laudable') || source.includes('muzli')) {
          tier = 4;
        }

        // Infer device from filename
        let device = 'Desktop Chrome';
        if (item.includes('iphone') || item.includes('mobile')) {
          device = 'iPhone 14 Pro';
        } else if (item.includes('ipad') || item.includes('tablet')) {
          device = 'iPad Pro 11';
        }

        const image: CapturedImage = {
          id: path.parse(item).name,
          source,
          tier,
          url: '',
          title: path.parse(item).name.replace(/-/g, ' '),
          device,
          filePath: itemPath,
        };

        const caption = generateCaption(image);
        const captionPath = getOutputCaptionPath(itemPath);

        // Ensure output directory exists
        const captionDir = path.dirname(captionPath);
        fs.mkdirSync(captionDir, { recursive: true });

        // Write caption
        fs.writeFileSync(captionPath, caption);

        results.push({
          imagePath: itemPath,
          captionPath,
          caption,
        });
      }
    }
  }

  scanDir(INPUT_DIR);
  return results;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     KripTik Premium Caption Generator                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let results: CaptionResult[];

  // Try manifest first, fall back to directory scan
  if (fs.existsSync(MANIFEST_PATH)) {
    console.log('Using manifest for caption generation...');
    results = await generateCaptionsFromManifest();
  } else {
    console.log('No manifest found, scanning directory...');
    results = await generateCaptionsFromDirectory();
  }

  // Print summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                     CAPTION SUMMARY                            ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total captions generated: ${results.length}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);

  // Show sample captions
  if (results.length > 0) {
    console.log('');
    console.log('Sample captions:');
    results.slice(0, 3).forEach((r, i) => {
      console.log(`\n[${i + 1}] ${path.basename(r.imagePath)}`);
      console.log(`    ${r.caption.slice(0, 120)}...`);
    });
  }

  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
