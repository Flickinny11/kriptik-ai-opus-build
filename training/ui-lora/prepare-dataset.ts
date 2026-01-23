/**
 * UI Design LoRA Dataset Preparation Script
 *
 * Downloads and prepares training data from multiple UI design datasets:
 * - UIClip BetterApp subset (1,200 human-rated quality UIs)
 * - Enrico (1,460 human-supervised UIs, 20 topics)
 * - Gridaco UI Dataset (20K+ screenshots with labeled components)
 *
 * Run with: npx ts-node training/ui-lora/prepare-dataset.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  outputDir: path.join(__dirname, 'dataset'),
  captionsDir: path.join(__dirname, 'dataset', 'captions'),
  imagesDir: path.join(__dirname, 'dataset', 'images'),
  triggerWord: 'kriptik_ui',

  // Dataset sources
  datasets: {
    enrico: {
      url: 'https://userinterfaces.aalto.fi/enrico/resources/screenshots.zip',
      metadataUrl: 'https://userinterfaces.aalto.fi/enrico/resources/design_topics.csv',
      name: 'Enrico',
      expectedCount: 1460,
    },
    gridaco: {
      repoUrl: 'https://github.com/gridaco/ui-dataset',
      name: 'Gridaco UI Dataset',
      expectedCount: 20000,
    },
    uiclip: {
      // UIClip BetterApp subset - requires manual download from paper authors
      paperUrl: 'https://arxiv.org/abs/2404.12500',
      name: 'UIClip BetterApp',
      expectedCount: 1200,
    },
  },
};

// Design topic to caption mapping for Enrico
const DESIGN_TOPIC_CAPTIONS: Record<string, string> = {
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
};

interface DatasetImage {
  id: string;
  filename: string;
  path: string;
  caption: string;
  topic?: string;
  source: string;
}

class DatasetPreparer {
  private images: DatasetImage[] = [];

  async prepare(): Promise<void> {
    console.log('🎨 UI Design LoRA Dataset Preparation');
    console.log('=====================================\n');

    // Create directories
    this.ensureDirectories();

    // Download and process datasets
    await this.downloadEnrico();
    await this.cloneGridaco();
    await this.handleUIClip();

    // Generate captions
    await this.generateCaptions();

    // Create training manifest
    await this.createManifest();

    console.log('\n✅ Dataset preparation complete!');
    console.log(`   Total images: ${this.images.length}`);
    console.log(`   Output directory: ${CONFIG.outputDir}`);
  }

  private ensureDirectories(): void {
    [CONFIG.outputDir, CONFIG.captionsDir, CONFIG.imagesDir].forEach((dir) => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    });
  }

  private async downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(dest);
      https
        .get(url, (response) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            // Handle redirect
            this.downloadFile(response.headers.location!, dest)
              .then(resolve)
              .catch(reject);
            return;
          }
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        })
        .on('error', (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
    });
  }

  private async downloadEnrico(): Promise<void> {
    console.log('📥 Downloading Enrico dataset...');

    const zipPath = path.join(CONFIG.outputDir, 'enrico.zip');
    const extractPath = path.join(CONFIG.outputDir, 'enrico');
    const metadataPath = path.join(CONFIG.outputDir, 'enrico_topics.csv');

    if (!existsSync(extractPath)) {
      try {
        // Download screenshots
        console.log('   Downloading screenshots...');
        await this.downloadFile(CONFIG.datasets.enrico.url, zipPath);

        // Extract
        console.log('   Extracting...');
        await execAsync(`unzip -q ${zipPath} -d ${extractPath}`);

        // Download metadata
        console.log('   Downloading metadata...');
        await this.downloadFile(CONFIG.datasets.enrico.metadataUrl, metadataPath);

        // Clean up zip
        fs.unlinkSync(zipPath);
      } catch (error) {
        console.log(
          '   ⚠️ Auto-download failed. Please manually download from:'
        );
        console.log(`      ${CONFIG.datasets.enrico.url}`);
        console.log(`   Extract to: ${extractPath}`);
        return;
      }
    }

    // Process Enrico images
    await this.processEnricoImages(extractPath, metadataPath);
  }

  private async processEnricoImages(
    extractPath: string,
    metadataPath: string
  ): Promise<void> {
    // Load topic metadata if available
    const topicMap: Map<string, string> = new Map();
    if (existsSync(metadataPath)) {
      const metadata = fs.readFileSync(metadataPath, 'utf-8');
      metadata.split('\n').forEach((line) => {
        const [id, topic] = line.split(',');
        if (id && topic) {
          topicMap.set(id.trim(), topic.trim());
        }
      });
    }

    // Find all images
    const screenshotsDir = path.join(extractPath, 'screenshots');
    if (!existsSync(screenshotsDir)) {
      console.log('   ⚠️ Enrico screenshots directory not found');
      return;
    }

    const files = fs.readdirSync(screenshotsDir);
    let count = 0;

    for (const file of files) {
      if (file.match(/\.(png|jpg|jpeg)$/i)) {
        const id = path.basename(file, path.extname(file));
        const topic = topicMap.get(id) || 'other';
        const topicCaption =
          DESIGN_TOPIC_CAPTIONS[topic] || 'mobile app user interface';

        const destPath = path.join(
          CONFIG.imagesDir,
          `enrico_${id}${path.extname(file)}`
        );
        fs.copyFileSync(path.join(screenshotsDir, file), destPath);

        this.images.push({
          id: `enrico_${id}`,
          filename: `enrico_${id}${path.extname(file)}`,
          path: destPath,
          caption: `${CONFIG.triggerWord}, mobile app UI design, ${topicCaption}, clean modern interface`,
          topic,
          source: 'enrico',
        });

        count++;
      }
    }

    console.log(`   ✅ Processed ${count} Enrico images`);
  }

  private async cloneGridaco(): Promise<void> {
    console.log('📥 Cloning Gridaco UI Dataset...');

    const gridacoPath = path.join(CONFIG.outputDir, 'gridaco-ui-dataset');

    if (!existsSync(gridacoPath)) {
      try {
        await execAsync(
          `git clone --depth 1 ${CONFIG.datasets.gridaco.repoUrl} ${gridacoPath}`
        );
      } catch (error) {
        console.log('   ⚠️ Git clone failed. Please manually clone:');
        console.log(`      git clone ${CONFIG.datasets.gridaco.repoUrl}`);
        console.log(`   To: ${gridacoPath}`);
        return;
      }
    }

    // Process Gridaco images
    await this.processGridacoImages(gridacoPath);
  }

  private async processGridacoImages(gridacoPath: string): Promise<void> {
    const screenshotsDir = path.join(gridacoPath, 'screenshots');
    if (!existsSync(screenshotsDir)) {
      console.log('   ⚠️ Gridaco screenshots directory not found');
      console.log('   Looking for alternative paths...');

      // Try to find images recursively
      const findImages = (dir: string): string[] => {
        const results: string[] = [];
        try {
          const items = fs.readdirSync(dir);
          for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory() && !item.startsWith('.')) {
              results.push(...findImages(fullPath));
            } else if (item.match(/\.(png|jpg|jpeg)$/i)) {
              results.push(fullPath);
            }
          }
        } catch (e) {
          // Ignore permission errors
        }
        return results;
      };

      const allImages = findImages(gridacoPath).slice(0, 5000); // Limit to 5000
      console.log(`   Found ${allImages.length} images in Gridaco dataset`);

      let count = 0;
      for (const imagePath of allImages) {
        const id = `gridaco_${count}`;
        const ext = path.extname(imagePath);
        const destPath = path.join(CONFIG.imagesDir, `${id}${ext}`);

        fs.copyFileSync(imagePath, destPath);

        this.images.push({
          id,
          filename: `${id}${ext}`,
          path: destPath,
          caption: `${CONFIG.triggerWord}, mobile app UI screenshot, application interface design, professional UI components`,
          source: 'gridaco',
        });

        count++;
      }

      console.log(`   ✅ Processed ${count} Gridaco images`);
      return;
    }

    // Process from screenshots directory
    const files = fs.readdirSync(screenshotsDir);
    let count = 0;

    for (const file of files.slice(0, 5000)) {
      if (file.match(/\.(png|jpg|jpeg)$/i)) {
        const id = `gridaco_${count}`;
        const destPath = path.join(
          CONFIG.imagesDir,
          `${id}${path.extname(file)}`
        );

        fs.copyFileSync(path.join(screenshotsDir, file), destPath);

        this.images.push({
          id,
          filename: `${id}${path.extname(file)}`,
          path: destPath,
          caption: `${CONFIG.triggerWord}, mobile app UI screenshot, application interface design, professional UI components`,
          source: 'gridaco',
        });

        count++;
      }
    }

    console.log(`   ✅ Processed ${count} Gridaco images`);
  }

  private async handleUIClip(): Promise<void> {
    console.log('📥 UIClip BetterApp Dataset...');
    console.log('   ⚠️ UIClip requires manual download from paper authors.');
    console.log(`   Paper: ${CONFIG.datasets.uiclip.paperUrl}`);
    console.log('   Contact authors for BetterApp subset access.');
    console.log(
      '   Once downloaded, place images in: ' +
        path.join(CONFIG.imagesDir, 'uiclip_*')
    );

    // Check if UIClip images already exist
    const uiclipImages = fs
      .readdirSync(CONFIG.imagesDir)
      .filter((f) => f.startsWith('uiclip_'));
    if (uiclipImages.length > 0) {
      console.log(`   ✅ Found ${uiclipImages.length} existing UIClip images`);

      for (const file of uiclipImages) {
        const id = path.basename(file, path.extname(file));
        this.images.push({
          id,
          filename: file,
          path: path.join(CONFIG.imagesDir, file),
          caption: `${CONFIG.triggerWord}, high quality UI design, professional app interface, visually refined layout`,
          source: 'uiclip',
        });
      }
    }
  }

  private async generateCaptions(): Promise<void> {
    console.log('\n📝 Generating caption files...');

    for (const image of this.images) {
      const captionPath = path.join(
        CONFIG.captionsDir,
        `${image.id}.txt`
      );
      fs.writeFileSync(captionPath, image.caption);
    }

    console.log(`   ✅ Generated ${this.images.length} caption files`);
  }

  private async createManifest(): Promise<void> {
    console.log('\n📋 Creating training manifest...');

    const manifest = {
      name: 'KripTik UI Design LoRA Training Dataset',
      version: '1.0.0',
      triggerWord: CONFIG.triggerWord,
      totalImages: this.images.length,
      sources: {
        enrico: this.images.filter((i) => i.source === 'enrico').length,
        gridaco: this.images.filter((i) => i.source === 'gridaco').length,
        uiclip: this.images.filter((i) => i.source === 'uiclip').length,
      },
      images: this.images.map((i) => ({
        id: i.id,
        filename: i.filename,
        caption: i.caption,
        topic: i.topic,
        source: i.source,
      })),
      createdAt: new Date().toISOString(),
    };

    const manifestPath = path.join(CONFIG.outputDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    console.log(`   ✅ Manifest saved to: ${manifestPath}`);

    // Also create SimpleTuner-compatible dataset.json
    const simpleTunerDataset = this.images.map((i) => ({
      image_path: i.path,
      caption: i.caption,
    }));

    const datasetJsonPath = path.join(CONFIG.outputDir, 'dataset.json');
    fs.writeFileSync(datasetJsonPath, JSON.stringify(simpleTunerDataset, null, 2));

    console.log(`   ✅ SimpleTuner dataset.json saved to: ${datasetJsonPath}`);
  }
}

// Run the preparer
const preparer = new DatasetPreparer();
preparer.prepare().catch(console.error);
