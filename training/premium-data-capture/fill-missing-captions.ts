#!/usr/bin/env npx tsx
/**
 * Fill Missing Captions
 *
 * Generates captions for images in ui-lora/dataset/images that don't have corresponding captions.
 * Uses filename analysis to infer appropriate captions.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const IMAGES_DIR = path.join(__dirname, '../ui-lora/dataset/images');
const CAPTIONS_DIR = path.join(__dirname, '../ui-lora/dataset/captions');

// Caption templates by pattern detection
const PATTERN_CAPTIONS: [RegExp, string][] = [
  [/^tier1_/i, 'kriptik_ui, awwwards-tier design, award-winning web experience, immersive scroll animation'],
  [/^tier2_/i, 'kriptik_ui, elite studio quality, cutting-edge web design, premium visual effects'],
  [/^tier3_/i, 'kriptik_ui, creative tutorial demo, innovative UI pattern, modern techniques'],
  [/^tier4_/i, 'kriptik_ui, iOS premium app, mobile-first design, Apple HIG compliant'],
  [/^tier5_/i, 'kriptik_ui, premium SaaS product, professional interface, clean dashboard'],
  [/^tier6_/i, 'kriptik_ui, luxury e-commerce, brand experience, product showcase'],
  [/^tier7_/i, 'kriptik_ui, design system components, reusable UI patterns, component library'],
  [/^premium_/i, 'kriptik_ui, premium UI design, professional interface, modern aesthetics'],
  [/^gridaco_/i, 'kriptik_ui, mobile app interface, component design, clean UI layout'],
  [/desktop/i, 'desktop layout, wide viewport, full-width design'],
  [/mobile/i, 'mobile portrait, iOS interface, touch-optimized'],
  [/tablet/i, 'tablet layout, responsive design, adaptive interface'],
  [/hero/i, 'hero section, above the fold, high impact visual'],
];

// Technology keywords to detect
const TECH_KEYWORDS: [RegExp, string][] = [
  [/threejs|three-js|three_js|webgl/i, 'Three.js WebGL, 3D graphics'],
  [/gsap|scroll-?trigger/i, 'GSAP animation, smooth scroll'],
  [/react|nextjs|next-js/i, 'React framework, modern web app'],
  [/tailwind/i, 'Tailwind CSS, utility-first styling'],
  [/dashboard/i, 'dashboard interface, data visualization'],
  [/landing/i, 'landing page, conversion focused'],
  [/portfolio/i, 'portfolio design, creative showcase'],
  [/ecommerce|shop|store/i, 'e-commerce interface, product layout'],
  [/saas/i, 'SaaS application, software interface'],
  [/blog/i, 'blog layout, content-focused design'],
  [/login|auth|signin/i, 'authentication UI, secure interface'],
];

// Style keywords
const STYLE_KEYWORDS: [RegExp, string][] = [
  [/dark/i, 'dark mode, OLED-friendly'],
  [/light/i, 'light mode, clean aesthetic'],
  [/minimal/i, 'minimalist design'],
  [/glass|blur/i, 'glassmorphism, frosted effect'],
  [/gradient/i, 'gradient colors, vibrant palette'],
  [/modern/i, 'modern design'],
  [/clean/i, 'clean layout'],
];

function generateCaptionFromFilename(filename: string): string {
  const parts: string[] = [];

  // Find matching pattern captions
  for (const [pattern, caption] of PATTERN_CAPTIONS) {
    if (pattern.test(filename)) {
      parts.push(caption);
      break; // Use first matching tier/type
    }
  }

  // If no tier matched, add default prefix
  if (parts.length === 0) {
    parts.push('kriptik_ui, premium UI design');
  }

  // Add technology keywords
  for (const [pattern, tech] of TECH_KEYWORDS) {
    if (pattern.test(filename)) {
      parts.push(tech);
      break; // Just add first matching tech
    }
  }

  // Add style keywords
  for (const [pattern, style] of STYLE_KEYWORDS) {
    if (pattern.test(filename)) {
      parts.push(style);
      break; // Just add first matching style
    }
  }

  // Add viewport based on filename
  if (filename.includes('desktop')) {
    parts.push('desktop layout, wide viewport');
  } else if (filename.includes('mobile')) {
    parts.push('mobile portrait, touch-optimized');
  } else if (filename.includes('tablet')) {
    parts.push('tablet layout, responsive design');
  }

  // Add quality markers
  parts.push('high fidelity mockup, professional design');

  return parts.join(', ');
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     Fill Missing Captions                                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Get all images
  const images = fs.readdirSync(IMAGES_DIR).filter(f => f.endsWith('.png'));
  console.log(`Found ${images.length} images`);

  // Get existing captions
  const existingCaptions = new Set(
    fs.readdirSync(CAPTIONS_DIR)
      .filter(f => f.endsWith('.txt'))
      .map(f => f.replace('.txt', ''))
  );
  console.log(`Found ${existingCaptions.size} existing captions`);

  // Find images without captions
  const missingCaptions = images.filter(img => {
    const baseName = img.replace('.png', '');
    return !existingCaptions.has(baseName);
  });

  console.log(`Missing captions: ${missingCaptions.length}`);
  console.log('');

  if (missingCaptions.length === 0) {
    console.log('All images have captions!');
    return;
  }

  // Generate missing captions
  let generated = 0;
  for (const img of missingCaptions) {
    const baseName = img.replace('.png', '');
    const caption = generateCaptionFromFilename(baseName);
    const captionPath = path.join(CAPTIONS_DIR, `${baseName}.txt`);

    fs.writeFileSync(captionPath, caption);
    generated++;

    if (generated % 100 === 0) {
      console.log(`Generated ${generated}/${missingCaptions.length} captions...`);
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Generated ${generated} captions`);
  console.log('═══════════════════════════════════════════════════════════════');

  // Show samples
  if (generated > 0) {
    console.log('');
    console.log('Sample captions:');
    const samples = missingCaptions.slice(0, 5);
    for (const img of samples) {
      const baseName = img.replace('.png', '');
      const caption = fs.readFileSync(path.join(CAPTIONS_DIR, `${baseName}.txt`), 'utf-8');
      console.log(`\n${baseName}:`);
      console.log(`  ${caption.slice(0, 100)}...`);
    }
  }
}

main().catch(console.error);
