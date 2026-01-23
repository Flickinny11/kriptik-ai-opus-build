/**
 * Enhanced UI Design LoRA Dataset Preparation Script
 *
 * January 2026 Edition - Comprehensive UI training data including:
 * - UIClip BetterApp (1,200 human-rated quality UIs)
 * - Enrico (1,460 human-supervised UIs)
 * - Gridaco UI Dataset (20K+ labeled screenshots)
 * - HuggingFace UI Datasets (modern collections)
 * - Apple/iOS Design Patterns (HIG-compliant interfaces)
 * - 3D Web Designs (glassmorphism, depth, modern effects)
 * - Awwwards/CSS Design Awards quality designs
 *
 * Run with: npx ts-node training/ui-lora/prepare-dataset-enhanced.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  outputDir: path.join(__dirname, 'dataset'),
  captionsDir: path.join(__dirname, 'dataset', 'captions'),
  imagesDir: path.join(__dirname, 'dataset', 'images'),
  triggerWord: 'kriptik_ui',
  maxImagesPerSource: 3000, // Cap per source for balanced training

  // HuggingFace datasets (January 2026 available datasets)
  huggingfaceDatasets: [
    {
      name: 'websight-v02',
      repo: 'HuggingFaceM4/WebSight',
      subset: 'v0.2',
      description: 'Web UI screenshots with HTML pairs',
      imageKey: 'image',
      captionKey: 'text',
      maxSamples: 2000,
    },
    {
      name: 'mind2web',
      repo: 'osunlp/Mind2Web',
      description: 'Web UI screenshots for action prediction',
      imageKey: 'screenshot',
      captionKey: 'action_description',
      maxSamples: 1500,
    },
    {
      name: 'appagent-screenshots',
      repo: 'mllmTeam/AppAgent',
      description: 'Mobile app screenshots with interaction data',
      imageKey: 'screenshot',
      captionKey: 'description',
      maxSamples: 1500,
    },
  ],

  // Design showcase sources for high-quality non-AI designs
  designSources: {
    dribbble: {
      // Curated Dribbble shots - requires manual curation
      manualDir: path.join(__dirname, 'manual-sources', 'dribbble'),
      style: 'professional design platform shots',
    },
    awwwards: {
      // Award-winning websites
      manualDir: path.join(__dirname, 'manual-sources', 'awwwards'),
      style: 'award-winning web design',
    },
    mobbin: {
      // iOS/Android app design patterns
      manualDir: path.join(__dirname, 'manual-sources', 'mobbin'),
      style: 'mobile app UI patterns',
    },
    appleHIG: {
      // Apple Human Interface Guidelines examples
      manualDir: path.join(__dirname, 'manual-sources', 'apple-hig'),
      style: 'Apple iOS design patterns',
    },
  },

  // Style categories for training diversity
  styleCategories: {
    ios: ['Apple iOS design', 'SF symbols', 'SwiftUI components', 'iOS app interface'],
    android: ['Material Design 3', 'Android app interface', 'Material You components'],
    web: ['web application interface', 'responsive dashboard', 'SaaS application'],
    '3d-glass': ['glassmorphism', '3D depth effects', 'frosted glass UI', 'neumorphism'],
    dark: ['dark theme interface', 'dark mode design', 'low light UI'],
    light: ['light theme interface', 'clean white UI', 'minimalist design'],
    creative: ['creative UI design', 'unique interface', 'artistic layout'],
    dashboard: ['data dashboard', 'analytics interface', 'admin panel'],
    ecommerce: ['e-commerce interface', 'shopping app', 'product catalog'],
    social: ['social media interface', 'feed layout', 'profile design'],
  },
};

// =============================================================================
// Design Topic Captions (Enhanced)
// =============================================================================

const DESIGN_TOPIC_CAPTIONS: Record<string, string> = {
  // Enrico topics
  bare: 'minimal bare interface with essential elements only',
  dialer: 'phone dialer interface with number pad and call buttons',
  camera: 'camera viewfinder interface with capture controls',
  chat: 'messaging chat interface with conversation bubbles',
  editor: 'content editor interface with text formatting tools',
  form: 'data entry form with input fields and labels',
  gallery: 'image gallery grid layout with thumbnails',
  list: 'vertical scrollable list with item rows',
  login: 'login authentication screen with credentials form',
  maps: 'map view interface with location markers',
  mediaplayer: 'media player interface with playback controls',
  menu: 'navigation menu with selectable options',
  modal: 'modal dialog overlay with action buttons',
  news: 'news feed layout with article cards',
  other: 'general purpose mobile interface',
  profile: 'user profile page with avatar and information',
  search: 'search interface with query input and results',
  settings: 'settings configuration screen with toggle options',
  terms: 'terms and conditions text display',
  tutorial: 'onboarding tutorial with instructional content',

  // Enhanced topics for modern UIs
  dashboard: 'analytics dashboard with data visualizations and metrics cards',
  onboarding: 'app onboarding flow with step indicators and illustrations',
  checkout: 'checkout flow with payment form and order summary',
  notifications: 'notification center with alert list and actions',
  social_feed: 'social media feed with posts, likes, and comments',
  video: 'video player interface with timeline controls',
  music: 'music streaming interface with album art and playlist',
  fitness: 'fitness tracking interface with workout data and progress',
  finance: 'financial app interface with transactions and charts',
  travel: 'travel booking interface with search and results',
};

// =============================================================================
// Quality Enhancement Captions
// =============================================================================

const QUALITY_ENHANCERS = {
  high: [
    'pixel perfect',
    'professional design',
    'high fidelity mockup',
    'polished interface',
    'production ready',
  ],
  modern: [
    'modern design',
    'contemporary UI',
    '2026 design trends',
    'cutting edge interface',
  ],
  clean: [
    'clean layout',
    'organized interface',
    'well-structured',
    'thoughtful spacing',
  ],
};

// =============================================================================
// Types
// =============================================================================

interface DatasetImage {
  id: string;
  filename: string;
  path: string;
  caption: string;
  topic?: string;
  source: string;
  style?: string;
  quality?: number; // 0-1 quality score
}

interface HuggingFaceConfig {
  name: string;
  repo: string;
  subset?: string;
  description: string;
  imageKey: string;
  captionKey: string;
  maxSamples: number;
}

// =============================================================================
// Enhanced Dataset Preparer
// =============================================================================

class EnhancedDatasetPreparer {
  private images: DatasetImage[] = [];
  private processedIds: Set<string> = new Set();

  async prepare(): Promise<void> {
    console.log('🎨 Enhanced UI Design LoRA Dataset Preparation');
    console.log('    January 2026 Edition');
    console.log('================================================\n');

    // Create directories
    this.ensureDirectories();

    // Download and process datasets
    console.log('\n📦 Phase 1: Core Datasets');
    console.log('─────────────────────────');
    await this.downloadEnrico();
    await this.cloneGridaco();

    console.log('\n📦 Phase 2: HuggingFace Datasets');
    console.log('─────────────────────────────────');
    await this.downloadHuggingFaceDatasets();

    console.log('\n📦 Phase 3: Design Showcase Sources');
    console.log('────────────────────────────────────');
    await this.processManualSources();

    console.log('\n📦 Phase 4: Quality Filtering & Caption Enhancement');
    console.log('───────────────────────────────────────────────────');
    await this.enhanceCaptions();
    await this.filterLowQuality();

    // Generate captions files
    await this.generateCaptionFiles();

    // Create training manifest
    await this.createManifest();

    // Print summary
    this.printSummary();
  }

  private ensureDirectories(): void {
    const dirs = [
      CONFIG.outputDir,
      CONFIG.captionsDir,
      CONFIG.imagesDir,
      ...Object.values(CONFIG.designSources).map(s => s.manualDir),
    ];

    dirs.forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        console.log(`📁 Created: ${path.relative(process.cwd(), dir)}`);
      }
    });
  }

  // =========================================================================
  // Core Dataset Downloads
  // =========================================================================

  private async downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const file = createWriteStream(dest);

      protocol.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          file.close();
          fs.unlinkSync(dest);
          this.downloadFile(response.headers.location!, dest)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        file.close();
        fs.unlink(dest, () => {});
        reject(err);
      });
    });
  }

  private async downloadEnrico(): Promise<void> {
    console.log('📥 Enrico Dataset (1,460 human-supervised UIs)');

    const extractPath = path.join(CONFIG.outputDir, 'enrico');
    const metadataPath = path.join(CONFIG.outputDir, 'enrico_topics.csv');

    if (!existsSync(extractPath)) {
      console.log('   ℹ️  Enrico requires manual download');
      console.log('   Download from: https://userinterfaces.aalto.fi/enrico/');
      console.log(`   Extract to: ${extractPath}`);

      // Create placeholder directory
      mkdirSync(extractPath, { recursive: true });
      return;
    }

    await this.processEnricoImages(extractPath, metadataPath);
  }

  private async processEnricoImages(extractPath: string, metadataPath: string): Promise<void> {
    const topicMap: Map<string, string> = new Map();

    if (existsSync(metadataPath)) {
      const metadata = readFileSync(metadataPath, 'utf-8');
      metadata.split('\n').forEach(line => {
        const [id, topic] = line.split(',');
        if (id && topic) {
          topicMap.set(id.trim(), topic.trim().toLowerCase());
        }
      });
    }

    // Find screenshots directory
    let screenshotsDir = path.join(extractPath, 'screenshots');
    if (!existsSync(screenshotsDir)) {
      // Try alternative paths
      const alternatives = [
        extractPath,
        path.join(extractPath, 'images'),
        path.join(extractPath, 'data'),
      ];

      for (const alt of alternatives) {
        if (existsSync(alt)) {
          const files = fs.readdirSync(alt).filter(f => f.match(/\.(png|jpg|jpeg)$/i));
          if (files.length > 0) {
            screenshotsDir = alt;
            break;
          }
        }
      }
    }

    if (!existsSync(screenshotsDir)) {
      console.log('   ⚠️  Enrico screenshots not found');
      return;
    }

    const files = fs.readdirSync(screenshotsDir).filter(f => f.match(/\.(png|jpg|jpeg)$/i));
    let count = 0;

    for (const file of files.slice(0, CONFIG.maxImagesPerSource)) {
      const id = path.basename(file, path.extname(file));
      const uniqueId = `enrico_${id}`;

      if (this.processedIds.has(uniqueId)) continue;

      const topic = topicMap.get(id) || 'other';
      const topicCaption = DESIGN_TOPIC_CAPTIONS[topic] || 'mobile app user interface';

      const destPath = path.join(CONFIG.imagesDir, `${uniqueId}${path.extname(file)}`);
      fs.copyFileSync(path.join(screenshotsDir, file), destPath);

      this.images.push({
        id: uniqueId,
        filename: `${uniqueId}${path.extname(file)}`,
        path: destPath,
        caption: `${CONFIG.triggerWord}, mobile app UI design, ${topicCaption}, clean modern interface, professional layout`,
        topic,
        source: 'enrico',
        style: 'mobile',
        quality: 0.85, // Human-supervised = high quality
      });

      this.processedIds.add(uniqueId);
      count++;
    }

    console.log(`   ✅ Processed ${count} Enrico images`);
  }

  private async cloneGridaco(): Promise<void> {
    console.log('📥 Gridaco UI Dataset (20K+ labeled screenshots)');

    const gridacoPath = path.join(CONFIG.outputDir, 'gridaco-ui-dataset');

    if (!existsSync(gridacoPath)) {
      try {
        console.log('   Cloning repository...');
        await execAsync(`git clone --depth 1 https://github.com/gridaco/ui-dataset "${gridacoPath}"`);
      } catch (error) {
        console.log('   ⚠️  Clone failed. Please manually clone:');
        console.log(`   git clone https://github.com/gridaco/ui-dataset "${gridacoPath}"`);
        return;
      }
    }

    await this.processGridacoImages(gridacoPath);
  }

  private async processGridacoImages(gridacoPath: string): Promise<void> {
    // Find all images recursively
    const findImages = (dir: string, depth = 0): string[] => {
      if (depth > 5) return []; // Limit recursion

      const results: string[] = [];
      try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          if (item.startsWith('.')) continue;

          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            results.push(...findImages(fullPath, depth + 1));
          } else if (item.match(/\.(png|jpg|jpeg)$/i)) {
            results.push(fullPath);
          }
        }
      } catch (e) {
        // Ignore permission errors
      }
      return results;
    };

    const allImages = findImages(gridacoPath).slice(0, CONFIG.maxImagesPerSource);
    let count = 0;

    for (const imagePath of allImages) {
      const uniqueId = `gridaco_${count}`;
      if (this.processedIds.has(uniqueId)) continue;

      const ext = path.extname(imagePath);
      const destPath = path.join(CONFIG.imagesDir, `${uniqueId}${ext}`);

      fs.copyFileSync(imagePath, destPath);

      // Determine style from directory structure
      const relativePath = path.relative(gridacoPath, imagePath).toLowerCase();
      let style = 'mobile';
      let styleCaption = 'mobile app UI';

      if (relativePath.includes('web')) {
        style = 'web';
        styleCaption = 'web application interface';
      } else if (relativePath.includes('ios') || relativePath.includes('iphone')) {
        style = 'ios';
        styleCaption = 'iOS app interface, Apple design patterns';
      } else if (relativePath.includes('android')) {
        style = 'android';
        styleCaption = 'Android app interface, Material Design';
      }

      this.images.push({
        id: uniqueId,
        filename: `${uniqueId}${ext}`,
        path: destPath,
        caption: `${CONFIG.triggerWord}, ${styleCaption}, professional UI components, modern design`,
        source: 'gridaco',
        style,
        quality: 0.75,
      });

      this.processedIds.add(uniqueId);
      count++;
    }

    console.log(`   ✅ Processed ${count} Gridaco images`);
  }

  // =========================================================================
  // HuggingFace Dataset Downloads
  // =========================================================================

  private async downloadHuggingFaceDatasets(): Promise<void> {
    console.log('ℹ️  HuggingFace datasets require the datasets library');
    console.log('   Run: pip install datasets huggingface_hub');

    // Create a Python script to download datasets
    const pythonScript = `
"""
HuggingFace UI Dataset Downloader
Run with: python download_hf_datasets.py
"""
import os
import json
from pathlib import Path

try:
    from datasets import load_dataset
    from PIL import Image
    HF_AVAILABLE = True
except ImportError:
    HF_AVAILABLE = False
    print("Please install: pip install datasets pillow huggingface_hub")

OUTPUT_DIR = Path("${CONFIG.imagesDir.replace(/\\/g, '\\\\')}")
CAPTIONS_DIR = Path("${CONFIG.captionsDir.replace(/\\/g, '\\\\')}")
MANIFEST_PATH = Path("${CONFIG.outputDir.replace(/\\/g, '\\\\')}") / "hf_manifest.json"

DATASETS = [
    {
        "name": "websight",
        "repo": "HuggingFaceM4/WebSight",
        "config": "v0.2",
        "image_key": "image",
        "caption_template": "kriptik_ui, web page design, {url_domain} website, modern web interface, professional layout",
        "max_samples": 2000
    },
    {
        "name": "gui-grounding",
        "repo": "Jing0111/OS-World-GUI-Grounding",
        "image_key": "image",
        "caption_template": "kriptik_ui, desktop application interface, {os} operating system UI, professional software design",
        "max_samples": 1500
    }
]

def download_all():
    if not HF_AVAILABLE:
        return

    manifest = {"images": [], "total": 0}

    for ds_config in DATASETS:
        print(f"\\nDownloading {ds_config['name']}...")
        try:
            if "config" in ds_config:
                ds = load_dataset(ds_config["repo"], ds_config["config"], split="train", streaming=True)
            else:
                ds = load_dataset(ds_config["repo"], split="train", streaming=True)

            count = 0
            for idx, item in enumerate(ds):
                if count >= ds_config["max_samples"]:
                    break

                try:
                    # Get image
                    img = item.get(ds_config["image_key"])
                    if img is None:
                        continue

                    # Save image
                    unique_id = f"{ds_config['name']}_{count}"
                    img_path = OUTPUT_DIR / f"{unique_id}.png"

                    if isinstance(img, Image.Image):
                        img.save(str(img_path))

                    # Generate caption
                    caption = ds_config["caption_template"].format(
                        url_domain="modern",
                        os="desktop"
                    )

                    # Save caption
                    caption_path = CAPTIONS_DIR / f"{unique_id}.txt"
                    caption_path.write_text(caption)

                    manifest["images"].append({
                        "id": unique_id,
                        "source": ds_config["name"],
                        "caption": caption
                    })

                    count += 1
                    if count % 100 == 0:
                        print(f"  Processed {count}/{ds_config['max_samples']}")

                except Exception as e:
                    continue

            print(f"  ✅ Downloaded {count} images from {ds_config['name']}")

        except Exception as e:
            print(f"  ⚠️ Failed to load {ds_config['name']}: {e}")

    manifest["total"] = len(manifest["images"])
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2))
    print(f"\\n✅ Saved manifest with {manifest['total']} images")

if __name__ == "__main__":
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    CAPTIONS_DIR.mkdir(parents=True, exist_ok=True)
    download_all()
`;

    const scriptPath = path.join(CONFIG.outputDir, 'download_hf_datasets.py');
    writeFileSync(scriptPath, pythonScript);
    console.log(`   Created: ${scriptPath}`);

    // Check if Python script was already run
    const hfManifestPath = path.join(CONFIG.outputDir, 'hf_manifest.json');
    if (existsSync(hfManifestPath)) {
      const manifest = JSON.parse(readFileSync(hfManifestPath, 'utf-8'));
      console.log(`   ✅ Found ${manifest.total} pre-downloaded HuggingFace images`);

      // Add to our images array
      for (const img of manifest.images) {
        const imgPath = path.join(CONFIG.imagesDir, `${img.id}.png`);
        if (existsSync(imgPath)) {
          this.images.push({
            id: img.id,
            filename: `${img.id}.png`,
            path: imgPath,
            caption: img.caption,
            source: img.source,
            style: 'web',
            quality: 0.80,
          });
          this.processedIds.add(img.id);
        }
      }
    } else {
      console.log('   ℹ️  Run the Python script to download HuggingFace datasets:');
      console.log(`   cd ${CONFIG.outputDir} && python download_hf_datasets.py`);
    }
  }

  // =========================================================================
  // Manual Source Processing (Dribbble, Awwwards, Apple HIG, etc.)
  // =========================================================================

  private async processManualSources(): Promise<void> {
    const sources = Object.entries(CONFIG.designSources);

    for (const [name, config] of sources) {
      if (!existsSync(config.manualDir)) {
        mkdirSync(config.manualDir, { recursive: true });
      }

      const files = existsSync(config.manualDir)
        ? fs.readdirSync(config.manualDir).filter(f => f.match(/\.(png|jpg|jpeg|webp)$/i))
        : [];

      if (files.length === 0) {
        console.log(`📥 ${name}: No images found`);
        console.log(`   Add images to: ${config.manualDir}`);
        continue;
      }

      console.log(`📥 ${name}: Processing ${files.length} images`);

      let count = 0;
      for (const file of files.slice(0, CONFIG.maxImagesPerSource)) {
        const uniqueId = `${name}_${count}`;
        if (this.processedIds.has(uniqueId)) continue;

        const ext = path.extname(file);
        const destPath = path.join(CONFIG.imagesDir, `${uniqueId}${ext}`);

        fs.copyFileSync(path.join(config.manualDir, file), destPath);

        // Enhanced caption based on source
        let caption = `${CONFIG.triggerWord}, ${config.style}`;

        if (name === 'appleHIG') {
          caption = `${CONFIG.triggerWord}, iOS app interface, Apple Human Interface Guidelines, SF symbols, SwiftUI design, clean minimal Apple aesthetic`;
        } else if (name === 'awwwards') {
          caption = `${CONFIG.triggerWord}, award-winning web design, creative web interface, innovative layout, professional website`;
        } else if (name === 'dribbble') {
          caption = `${CONFIG.triggerWord}, professional UI design shot, polished interface mockup, designer portfolio quality`;
        } else if (name === 'mobbin') {
          caption = `${CONFIG.triggerWord}, mobile app design pattern, real app UI screenshot, production mobile interface`;
        }

        this.images.push({
          id: uniqueId,
          filename: `${uniqueId}${ext}`,
          path: destPath,
          caption,
          source: name,
          style: name === 'appleHIG' ? 'ios' : name === 'awwwards' ? 'web' : 'mobile',
          quality: 0.95, // Manual curation = highest quality
        });

        this.processedIds.add(uniqueId);
        count++;
      }

      console.log(`   ✅ Processed ${count} ${name} images`);
    }
  }

  // =========================================================================
  // Caption Enhancement & Quality Filtering
  // =========================================================================

  private async enhanceCaptions(): Promise<void> {
    console.log('✨ Enhancing captions with quality modifiers...');

    let enhanced = 0;
    for (const image of this.images) {
      // Add quality enhancers based on source quality
      const enhancers: string[] = [];

      if (image.quality && image.quality >= 0.9) {
        enhancers.push(...QUALITY_ENHANCERS.high.slice(0, 2));
      }
      if (image.quality && image.quality >= 0.8) {
        enhancers.push(...QUALITY_ENHANCERS.modern.slice(0, 1));
      }
      if (image.style === 'ios') {
        enhancers.push('Apple design language');
      }
      if (image.style === '3d-glass') {
        enhancers.push('glassmorphism', '3D depth effects');
      }

      if (enhancers.length > 0) {
        image.caption = `${image.caption}, ${enhancers.join(', ')}`;
        enhanced++;
      }
    }

    console.log(`   ✅ Enhanced ${enhanced} captions`);
  }

  private async filterLowQuality(): Promise<void> {
    console.log('🔍 Filtering low-quality images...');

    const originalCount = this.images.length;

    // Remove images below quality threshold
    this.images = this.images.filter(img => {
      // Keep images with quality >= 0.6 or unknown quality
      if (img.quality !== undefined && img.quality < 0.6) {
        // Remove the file
        try {
          if (existsSync(img.path)) {
            fs.unlinkSync(img.path);
          }
        } catch (e) {
          // Ignore
        }
        return false;
      }
      return true;
    });

    const removed = originalCount - this.images.length;
    console.log(`   ✅ Removed ${removed} low-quality images`);
  }

  // =========================================================================
  // Output Generation
  // =========================================================================

  private async generateCaptionFiles(): Promise<void> {
    console.log('\n📝 Generating caption files...');

    for (const image of this.images) {
      const captionPath = path.join(CONFIG.captionsDir, `${image.id}.txt`);
      writeFileSync(captionPath, image.caption);
    }

    console.log(`   ✅ Generated ${this.images.length} caption files`);
  }

  private async createManifest(): Promise<void> {
    console.log('📋 Creating training manifest...');

    // Group by source
    const bySource: Record<string, number> = {};
    const byStyle: Record<string, number> = {};

    for (const img of this.images) {
      bySource[img.source] = (bySource[img.source] || 0) + 1;
      if (img.style) {
        byStyle[img.style] = (byStyle[img.style] || 0) + 1;
      }
    }

    const manifest = {
      name: 'KripTik UI Design LoRA Training Dataset (Enhanced)',
      version: '2.0.0',
      date: new Date().toISOString(),
      triggerWord: CONFIG.triggerWord,
      totalImages: this.images.length,
      sources: bySource,
      styles: byStyle,
      qualityDistribution: {
        high: this.images.filter(i => i.quality && i.quality >= 0.9).length,
        medium: this.images.filter(i => i.quality && i.quality >= 0.7 && i.quality < 0.9).length,
        standard: this.images.filter(i => !i.quality || i.quality < 0.7).length,
      },
      images: this.images.map(i => ({
        id: i.id,
        filename: i.filename,
        caption: i.caption,
        topic: i.topic,
        source: i.source,
        style: i.style,
        quality: i.quality,
      })),
    };

    const manifestPath = path.join(CONFIG.outputDir, 'manifest.json');
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // SimpleTuner format
    const simpleTunerDataset = this.images.map(i => ({
      image_path: i.path,
      caption: i.caption,
    }));

    const datasetJsonPath = path.join(CONFIG.outputDir, 'dataset.json');
    writeFileSync(datasetJsonPath, JSON.stringify(simpleTunerDataset, null, 2));

    console.log(`   ✅ Manifests saved`);
  }

  private printSummary(): void {
    console.log('\n════════════════════════════════════════════════════');
    console.log('📊 DATASET SUMMARY');
    console.log('════════════════════════════════════════════════════\n');

    // Group by source
    const bySource: Record<string, number> = {};
    const byStyle: Record<string, number> = {};

    for (const img of this.images) {
      bySource[img.source] = (bySource[img.source] || 0) + 1;
      if (img.style) {
        byStyle[img.style] = (byStyle[img.style] || 0) + 1;
      }
    }

    console.log('By Source:');
    for (const [source, count] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${source.padEnd(15)} ${count.toString().padStart(6)} images`);
    }

    console.log('\nBy Style:');
    for (const [style, count] of Object.entries(byStyle).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${style.padEnd(15)} ${count.toString().padStart(6)} images`);
    }

    console.log(`\n📁 Total: ${this.images.length} training images`);
    console.log(`📁 Output: ${CONFIG.outputDir}`);

    console.log('\n════════════════════════════════════════════════════');
    console.log('🚀 NEXT STEPS');
    console.log('════════════════════════════════════════════════════\n');

    console.log('1. Add high-quality images to manual source directories:');
    for (const [name, config] of Object.entries(CONFIG.designSources)) {
      console.log(`   ${name}: ${config.manualDir}`);
    }

    console.log('\n2. Run HuggingFace downloader (optional):');
    console.log(`   cd ${CONFIG.outputDir} && python download_hf_datasets.py`);

    console.log('\n3. Start training on RunPod:');
    console.log('   npx ts-node training/ui-lora/deploy-training.ts');

    console.log('\n════════════════════════════════════════════════════\n');
  }
}

// =============================================================================
// Main
// =============================================================================

const preparer = new EnhancedDatasetPreparer();
preparer.prepare().catch(console.error);
