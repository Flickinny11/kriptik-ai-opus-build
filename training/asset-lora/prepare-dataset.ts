#!/usr/bin/env npx ts-node
/**
 * Prepare Asset LoRA Training Dataset
 *
 * Collects photorealistic images from:
 * 1. SliderRevolution hero crops (already captured)
 * 2. Premium design backgrounds
 * 3. Unsplash API (optional)
 *
 * Trigger word: kriptik_asset
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_DIR = __dirname;
const SLIDERREV_IMAGES = path.join(SCRIPT_DIR, '../ui-lora/dataset/images/sliderrevolution');
const SLIDERREV_PRIORITY = path.join(SCRIPT_DIR, '../ui-lora/dataset/images/sliderrev-priority');
const OUTPUT_IMAGES = path.join(SCRIPT_DIR, 'dataset/images');
const OUTPUT_CAPTIONS = path.join(SCRIPT_DIR, 'dataset/captions');

// Create directories
fs.mkdirSync(OUTPUT_IMAGES, { recursive: true });
fs.mkdirSync(OUTPUT_CAPTIONS, { recursive: true });

/**
 * Extract hero images from SliderRevolution captures
 */
function extractHeroImages(): number {
  console.log('Extracting hero images from SliderRevolution...\n');

  let count = 0;
  const sources = [SLIDERREV_IMAGES, SLIDERREV_PRIORITY];

  for (const sourceDir of sources) {
    if (!fs.existsSync(sourceDir)) {
      console.log(`  Skipping ${sourceDir} (not found)`);
      continue;
    }

    const files = fs.readdirSync(sourceDir)
      .filter(f => /_hero\.(png|jpg|jpeg|webp)$/i.test(f));

    console.log(`  Found ${files.length} hero images in ${path.basename(sourceDir)}`);

    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      const destName = `asset_${count.toString().padStart(4, '0')}.png`;
      const destPath = path.join(OUTPUT_IMAGES, destName);

      // Copy image
      fs.copyFileSync(sourcePath, destPath);

      // Generate caption based on filename
      const caption = generateCaptionFromFilename(file);
      const captionPath = path.join(OUTPUT_CAPTIONS, destName.replace('.png', '.txt'));
      fs.writeFileSync(captionPath, caption);

      count++;
    }
  }

  return count;
}

/**
 * Generate caption from SliderRevolution filename
 */
function generateCaptionFromFilename(filename: string): string {
  // Parse filename: sliderrev_templates_template-name_viewport_hero.png
  const parts = path.basename(filename, path.extname(filename))
    .replace(/_hero$/, '')
    .split('_');

  const category = parts[1] || 'templates';
  const templateName = (parts[2] || 'slider').replace(/-/g, ' ');

  // Categorize by content type
  const contentTypes = detectContentType(templateName);

  const base = `kriptik_asset, ${contentTypes.join(', ')}`;

  const styles = [
    'high quality photography',
    'professional composition',
    'premium visual content',
    'suitable for web hero section',
  ];

  return `${base}, ${styles.join(', ')}`;
}

/**
 * Detect content type from template name
 */
function detectContentType(name: string): string[] {
  const lower = name.toLowerCase();
  const types: string[] = [];

  // Detect content categories
  if (lower.includes('product') || lower.includes('shop') || lower.includes('ecommerce')) {
    types.push('product photography', 'e-commerce imagery');
  }
  if (lower.includes('portfolio') || lower.includes('creative') || lower.includes('agency')) {
    types.push('portfolio showcase', 'creative design');
  }
  if (lower.includes('3d') || lower.includes('abstract') || lower.includes('geometric')) {
    types.push('abstract 3D render', 'geometric shapes', 'modern design');
  }
  if (lower.includes('nature') || lower.includes('landscape') || lower.includes('outdoor')) {
    types.push('nature photography', 'landscape imagery');
  }
  if (lower.includes('tech') || lower.includes('app') || lower.includes('saas')) {
    types.push('tech imagery', 'modern aesthetic');
  }
  if (lower.includes('hero') || lower.includes('header')) {
    types.push('hero background', 'website header');
  }

  // Default if no specific type detected
  if (types.length === 0) {
    types.push('hero background image', 'professional visual content');
  }

  return types;
}

/**
 * Download from Unsplash (optional, requires API key)
 */
async function downloadFromUnsplash(count: number = 100): Promise<number> {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!apiKey) {
    console.log('\nUnsplash API key not set. Skipping Unsplash downloads.');
    console.log('Set UNSPLASH_ACCESS_KEY environment variable to enable.');
    return 0;
  }

  console.log(`\nDownloading ${count} images from Unsplash...`);

  const categories = [
    'abstract-background',
    'product-photography',
    'business-portrait',
    'nature-landscape',
    'technology',
    'architecture',
  ];

  let downloaded = 0;

  for (const category of categories) {
    try {
      const url = `https://api.unsplash.com/photos/random?query=${category}&count=15`;
      // Server-to-server API call, credentials not needed
      const response = await fetch(url, {
        headers: { 'Authorization': `Client-ID ${apiKey}` },
        credentials: 'omit'  // External API call, no cookies needed
      });

      if (!response.ok) {
        console.log(`  Failed to fetch ${category}: ${response.status}`);
        continue;
      }

      const photos = await response.json();

      for (const photo of photos) {
        const imageUrl = photo.urls.regular;
        const destName = `unsplash_${downloaded.toString().padStart(4, '0')}.jpg`;
        const destPath = path.join(OUTPUT_IMAGES, destName);

        // Download image
        execSync(`curl -sL "${imageUrl}" -o "${destPath}"`);

        // Create caption
        const caption = `kriptik_asset, ${category.replace('-', ' ')}, ${photo.description || 'professional photography'}, high resolution, stock quality`;
        const captionPath = path.join(OUTPUT_CAPTIONS, destName.replace('.jpg', '.txt'));
        fs.writeFileSync(captionPath, caption);

        downloaded++;
      }

      console.log(`  Downloaded ${photos.length} images for ${category}`);

    } catch (error) {
      console.log(`  Error downloading ${category}: ${error}`);
    }
  }

  return downloaded;
}

/**
 * Main
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Asset LoRA Dataset Preparation');
  console.log('='.repeat(60));
  console.log('');

  // Extract hero images
  const heroCount = extractHeroImages();
  console.log(`\nExtracted ${heroCount} hero images`);

  // Optional: Download from Unsplash
  const unsplashCount = await downloadFromUnsplash();

  // Summary
  const totalImages = fs.readdirSync(OUTPUT_IMAGES).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f)).length;
  const totalCaptions = fs.readdirSync(OUTPUT_CAPTIONS).filter(f => /\.txt$/i.test(f)).length;

  console.log('\n' + '='.repeat(60));
  console.log('Dataset Preparation Complete!');
  console.log('='.repeat(60));
  console.log(`Total images: ${totalImages}`);
  console.log(`Total captions: ${totalCaptions}`);
  console.log(`\nOutput directory: ${path.relative(process.cwd(), SCRIPT_DIR)}/dataset/`);
  console.log('\nNext: Run the training with:');
  console.log('  ./runpod/deploy.sh <IP> <PORT>');
}

main().catch(console.error);
