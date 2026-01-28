#!/usr/bin/env npx ts-node
/**
 * UICoder Training Data Preparation
 *
 * Downloads code examples from premium sources for symbiotic model training.
 * These code examples will be paired with screenshots for code generation training.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CODE_OUTPUT_DIR = path.join(__dirname, '..', 'code');

// GitHub repositories with premium UI code examples
// Updated January 2026 with correct repo URLs
const CODE_SOURCES = {
  codrops: [
    // Verified Codrops WebGL/Animation repos
    { repo: 'codrops/OnScrollEffectLayout', name: 'on-scroll-effect-layout' },
    { repo: 'codrops/GridLayoutSlideshow', name: 'grid-layout-slideshow' },
    { repo: 'codrops/MorphingPageTransition', name: 'morphing-page-transition' },
    { repo: 'codrops/DiagonalSlideshow', name: 'diagonal-slideshow' },
    { repo: 'codrops/ExpandingGridItemAnimation', name: 'expanding-grid-item' },
    { repo: 'codrops/RainEffect', name: 'rain-effect' },
    // Additional Codrops repos
    { repo: 'codrops/PageTransitions', name: 'page-transitions' },
    { repo: 'codrops/DistortedButtonEffects', name: 'distorted-button-effects' },
    { repo: 'codrops/IsometricGrids', name: 'isometric-grids' },
    { repo: 'codrops/TextInputEffects', name: 'text-input-effects' },
    { repo: 'codrops/CreativeLinkEffects', name: 'creative-link-effects' },
    { repo: 'codrops/ModalWindowEffects', name: 'modal-window-effects' },
    { repo: 'codrops/HoverEffectIdeas', name: 'hover-effect-ideas' },
    { repo: 'codrops/ButtonComponentMorph', name: 'button-component-morph' },
    { repo: 'codrops/ImageTiltEffect', name: 'image-tilt-effect' },
  ],

  r3f: [
    // React Three Fiber official examples
    { repo: 'pmndrs/drei', name: 'drei-components' },
    { repo: 'pmndrs/react-three-fiber', name: 'r3f-core', sparse: 'examples' },
    { repo: 'pmndrs/postprocessing', name: 'postprocessing' },
    { repo: 'pmndrs/react-spring', name: 'react-spring', sparse: 'packages/web/src' },
    { repo: 'pmndrs/uikit', name: 'uikit' },
    { repo: 'pmndrs/gltfjsx', name: 'gltfjsx' },
  ],

  gsap: [
    // GSAP examples
    { repo: 'greensock/GSAP', name: 'gsap-core', sparse: 'src' },
  ],

  premium: [
    // Premium portfolios with open source code
    { repo: 'brunosimon/folio-2019', name: 'bruno-simon-portfolio' },
    { repo: 'darkroom-engineering/lenis', name: 'lenis-smooth-scroll' },  // Updated URL
    { repo: 'studio-freight/hamo', name: 'studio-freight-hamo' },
    { repo: 'darkroom-engineering/satus', name: 'darkroom-satus' },
  ],

  animation: [
    // Animation libraries
    { repo: 'framer/motion', name: 'framer-motion' },
    { repo: 'matteobruni/tsparticles', name: 'tsparticles' },
    { repo: 'juliangarnier/anime', name: 'animejs' },
  ],

  ui: [
    // UI component libraries
    { repo: 'shadcn-ui/ui', name: 'shadcn-ui' },
    { repo: 'radix-ui/primitives', name: 'radix-primitives' },
    { repo: 'chakra-ui/chakra-ui', name: 'chakra-ui', sparse: 'packages/components/src' },
  ],
};

function cloneRepo(source: string, name: string, output: string, sparse?: string): boolean {
  const targetDir = path.join(output, name);

  if (fs.existsSync(targetDir)) {
    console.log(`  [SKIP] ${name} already exists`);
    return true;
  }

  try {
    console.log(`  [CLONE] ${source} -> ${name}`);

    if (sparse) {
      // Sparse checkout for large repos
      execSync(`git clone --filter=blob:none --sparse https://github.com/${source}.git "${targetDir}"`, {
        stdio: 'pipe',
      });
      execSync(`cd "${targetDir}" && git sparse-checkout set ${sparse}`, { stdio: 'pipe' });
    } else {
      execSync(`git clone --depth 1 https://github.com/${source}.git "${targetDir}"`, {
        stdio: 'pipe',
      });
    }

    // Remove .git directory to save space
    fs.rmSync(path.join(targetDir, '.git'), { recursive: true, force: true });

    return true;
  } catch (error) {
    console.error(`  [ERROR] Failed to clone ${source}: ${error}`);
    return false;
  }
}

async function downloadAllSources() {
  console.log('=== UICoder Code Examples Download ===\n');

  const stats = { success: 0, failed: 0, skipped: 0 };

  for (const [category, repos] of Object.entries(CODE_SOURCES)) {
    const categoryDir = path.join(CODE_OUTPUT_DIR, category);
    fs.mkdirSync(categoryDir, { recursive: true });

    console.log(`\n[${category.toUpperCase()}]`);

    for (const { repo, name, sparse } of repos) {
      const result = cloneRepo(repo, name, categoryDir, sparse);
      if (result) {
        stats.success++;
      } else {
        stats.failed++;
      }
    }
  }

  console.log('\n=== Download Complete ===');
  console.log(`Success: ${stats.success}`);
  console.log(`Failed: ${stats.failed}`);

  // Count total files
  let totalFiles = 0;
  for (const category of Object.keys(CODE_SOURCES)) {
    const categoryDir = path.join(CODE_OUTPUT_DIR, category);
    if (fs.existsSync(categoryDir)) {
      const files = countFiles(categoryDir, ['.tsx', '.ts', '.jsx', '.js', '.glsl', '.frag', '.vert']);
      totalFiles += files;
      console.log(`${category}: ${files} code files`);
    }
  }
  console.log(`Total code files: ${totalFiles}`);
}

function countFiles(dir: string, extensions: string[]): number {
  let count = 0;

  try {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        count += countFiles(itemPath, extensions);
      } else if (extensions.some(ext => item.endsWith(ext))) {
        count++;
      }
    }
  } catch (error) {
    // Ignore errors
  }

  return count;
}

// Run
downloadAllSources().catch(console.error);
