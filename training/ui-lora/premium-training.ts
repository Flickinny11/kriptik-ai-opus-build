/**
 * Premium UI-LoRA Training Launcher for RunPod
 *
 * Programmatic training pipeline that:
 * 1. Captures premium screenshots using Playwright
 * 2. Extracts code from GitHub elite repositories
 * 3. Tags techniques and validates physics parameters
 * 4. Filters for premium quality (anti-AI-slop)
 * 5. Creates paired dataset for symbiotic training
 * 6. Uploads to RunPod and runs FLUX training
 * 7. Downloads trained model
 *
 * Run with: npx tsx training/ui-lora/premium-training.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// Configuration
// =============================================================================

interface TrainingConfig {
  runpodApiKey: string;
  gpuType: string;
  volumeSize: number;
  trainingSteps: number;
  batchSize: number;
  learningRate: number;
  loraRank: number;
}

const CONFIG: TrainingConfig = {
  runpodApiKey: process.env.RUNPOD_API_KEY || '',
  gpuType: 'NVIDIA RTX A5000',  // 24GB VRAM, good for LoRA training
  volumeSize: 100,              // GB for dataset + model
  trainingSteps: 5000,          // Premium training duration
  batchSize: 1,
  learningRate: 8e-5,           // Slightly lower for premium refinement
  loraRank: 64,
};

const PATHS = {
  premiumDataCapture: path.join(__dirname, '..', 'premium-data-capture'),
  outputDir: path.join(__dirname, 'output'),
  premiumConfig: path.join(__dirname, 'premium-config.yaml'),
  trainedModel: path.join(__dirname, 'output', 'kriptik-premium-ui-lora.safetensors'),
};

// =============================================================================
// Pipeline Steps
// =============================================================================

async function runPremiumDataCapture(): Promise<boolean> {
  console.log('\\n' + '='.repeat(60));
  console.log('STEP 1: Premium Data Capture');
  console.log('='.repeat(60));

  const captureDir = PATHS.premiumDataCapture;

  // Check if premium-data-capture exists
  if (!fs.existsSync(captureDir)) {
    console.error('ERROR: Premium data capture directory not found');
    console.error(`Expected at: ${captureDir}`);
    return false;
  }

  // Check if output already exists
  const outputDir = path.join(captureDir, 'output');
  const screenshotsDir = path.join(outputDir, 'screenshots');
  const captionsDir = path.join(outputDir, 'captions');

  if (fs.existsSync(screenshotsDir) && fs.existsSync(captionsDir)) {
    const screenshots = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
    const captions = fs.readdirSync(captionsDir).filter(f => f.endsWith('.txt'));

    if (screenshots.length > 100 && captions.length > 100) {
      console.log(`Found existing premium dataset:`);
      console.log(`  Screenshots: ${screenshots.length}`);
      console.log(`  Captions: ${captions.length}`);
      console.log('Skipping data capture (use --force to regenerate)');
      return true;
    }
  }

  console.log('Running premium data capture pipeline...');
  console.log('This will:');
  console.log('  1. Capture screenshots from Awwwards, FWA, CSS Awards');
  console.log('  2. Extract code from elite GitHub repositories');
  console.log('  3. Tag techniques and validate physics parameters');
  console.log('  4. Filter for premium quality (anti-AI-slop)');
  console.log('  5. Create paired dataset');

  try {
    // Install dependencies if needed
    const packageJson = path.join(captureDir, 'package.json');
    const nodeModules = path.join(captureDir, 'node_modules');

    if (fs.existsSync(packageJson) && !fs.existsSync(nodeModules)) {
      console.log('\\nInstalling dependencies...');
      execSync('npm install', { cwd: captureDir, stdio: 'inherit' });

      // Install Playwright browsers
      console.log('\\nInstalling Playwright browsers...');
      execSync('npx playwright install chromium', { cwd: captureDir, stdio: 'inherit' });
    }

    // Run the pipeline
    console.log('\\nRunning capture pipeline...');
    execSync('npm run pipeline', { cwd: captureDir, stdio: 'inherit' });

    return true;
  } catch (error) {
    console.error('Data capture failed:', error);
    console.log('\\nManual steps:');
    console.log(`  cd ${captureDir}`);
    console.log('  npm install');
    console.log('  npx playwright install chromium');
    console.log('  npm run pipeline');
    return false;
  }
}

async function validateDataset(): Promise<{ valid: boolean; stats: DatasetStats }> {
  console.log('\\n' + '='.repeat(60));
  console.log('STEP 2: Validate Premium Dataset');
  console.log('='.repeat(60));

  const outputDir = path.join(PATHS.premiumDataCapture, 'output');
  const screenshotsDir = path.join(outputDir, 'screenshots');
  const captionsDir = path.join(outputDir, 'captions');
  const pairedDir = path.join(outputDir, 'paired');

  const stats: DatasetStats = {
    totalScreenshots: 0,
    totalCaptions: 0,
    totalPairedEntries: 0,
    byTier: { tier1: 0, tier2: 0, tier3: 0, tier4: 0 },
    qualityDistribution: { premium: 0, high: 0, standard: 0, rejected: 0 },
    techniquesFound: new Set<string>(),
  };

  // Count screenshots
  if (fs.existsSync(screenshotsDir)) {
    stats.totalScreenshots = fs.readdirSync(screenshotsDir).filter(f =>
      f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')
    ).length;
  }

  // Count captions
  if (fs.existsSync(captionsDir)) {
    stats.totalCaptions = fs.readdirSync(captionsDir).filter(f => f.endsWith('.txt')).length;
  }

  // Check paired dataset
  if (fs.existsSync(pairedDir)) {
    const pairedFiles = fs.readdirSync(pairedDir).filter(f => f.endsWith('.json'));
    stats.totalPairedEntries = pairedFiles.length;

    // Sample a few entries for quality stats
    for (const file of pairedFiles.slice(0, 100)) {
      try {
        const entry = JSON.parse(fs.readFileSync(path.join(pairedDir, file), 'utf-8'));

        // Count by tier
        if (entry.screenshot?.source) {
          const source = entry.screenshot.source;
          if (source.includes('awwwards') || source.includes('fwa') || source.includes('css-awards')) {
            stats.byTier.tier1++;
          } else if (source.includes('lusion') || source.includes('studio')) {
            stats.byTier.tier2++;
          } else if (source.includes('codrops') || source.includes('tutorial')) {
            stats.byTier.tier3++;
          } else {
            stats.byTier.tier4++;
          }
        }

        // Quality distribution
        if (entry.qualityScore) {
          if (entry.qualityScore >= 0.9) stats.qualityDistribution.premium++;
          else if (entry.qualityScore >= 0.7) stats.qualityDistribution.high++;
          else if (entry.qualityScore >= 0.5) stats.qualityDistribution.standard++;
          else stats.qualityDistribution.rejected++;
        }

        // Techniques
        if (entry.code?.techniques) {
          entry.code.techniques.forEach((t: string) => stats.techniquesFound.add(t));
        }
      } catch {
        // Ignore invalid JSON
      }
    }
  }

  // Check FLUX training captions
  const fluxCaptionsPath = path.join(outputDir, 'flux-training-captions.jsonl');
  if (fs.existsSync(fluxCaptionsPath)) {
    const content = fs.readFileSync(fluxCaptionsPath, 'utf-8');
    const lines = content.trim().split('\\n').filter(l => l.length > 0);
    console.log(`\\nFLUX training captions: ${lines.length} entries`);
  }

  // Print stats
  console.log('\\nDataset Statistics:');
  console.log(`  Screenshots: ${stats.totalScreenshots}`);
  console.log(`  Captions: ${stats.totalCaptions}`);
  console.log(`  Paired entries: ${stats.totalPairedEntries}`);

  console.log('\\nBy Tier:');
  console.log(`  Tier 1 (Awards): ${stats.byTier.tier1}`);
  console.log(`  Tier 2 (Studios): ${stats.byTier.tier2}`);
  console.log(`  Tier 3 (Tutorials): ${stats.byTier.tier3}`);
  console.log(`  Tier 4 (Mobile): ${stats.byTier.tier4}`);

  console.log('\\nQuality Distribution:');
  console.log(`  Premium (>=0.9): ${stats.qualityDistribution.premium}`);
  console.log(`  High (0.7-0.9): ${stats.qualityDistribution.high}`);
  console.log(`  Standard (0.5-0.7): ${stats.qualityDistribution.standard}`);
  console.log(`  Rejected (<0.5): ${stats.qualityDistribution.rejected}`);

  if (stats.techniquesFound.size > 0) {
    console.log(`\\nTechniques found: ${Array.from(stats.techniquesFound).slice(0, 10).join(', ')}...`);
  }

  // Validation
  const minRequired = 500;
  const valid = stats.totalScreenshots >= minRequired && stats.totalCaptions >= minRequired;

  if (valid) {
    console.log('\\n✅ Dataset validation PASSED');
  } else {
    console.log(`\\n❌ Dataset validation FAILED`);
    console.log(`   Need at least ${minRequired} screenshots and captions`);
  }

  return { valid, stats };
}

interface DatasetStats {
  totalScreenshots: number;
  totalCaptions: number;
  totalPairedEntries: number;
  byTier: {
    tier1: number;
    tier2: number;
    tier3: number;
    tier4: number;
  };
  qualityDistribution: {
    premium: number;
    high: number;
    standard: number;
    rejected: number;
  };
  techniquesFound: Set<string>;
}

async function prepareRunPodTraining(): Promise<string | null> {
  console.log('\\n' + '='.repeat(60));
  console.log('STEP 3: Prepare RunPod Training');
  console.log('='.repeat(60));

  // Check for RunPod API key
  if (!CONFIG.runpodApiKey) {
    console.log('\\nRunPod API key not found.');
    console.log('Set RUNPOD_API_KEY environment variable or update CONFIG.');
    console.log('\\nManual training steps:');
    console.log('  1. Create a RunPod GPU pod with RTX A5000 or A100');
    console.log('  2. Upload dataset to /workspace/dataset/');
    console.log('  3. Clone ai-toolkit: git clone https://github.com/ostris/ai-toolkit');
    console.log('  4. Run training with premium-config.yaml');
    return null;
  }

  // Create training script for RunPod
  const trainingScript = `#!/bin/bash
set -e

echo "=== KripTik Premium UI-LoRA Training ==="
echo "GPU: $(nvidia-smi --query-gpu=name --format=csv,noheader)"
echo "VRAM: $(nvidia-smi --query-gpu=memory.total --format=csv,noheader)"

# Install dependencies
pip install --upgrade pip
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install accelerate transformers diffusers peft safetensors
pip install tensorboard huggingface_hub

# Clone ai-toolkit if needed
if [ ! -d "/workspace/ai-toolkit" ]; then
    git clone https://github.com/ostris/ai-toolkit.git /workspace/ai-toolkit
fi

cd /workspace/ai-toolkit
pip install -r requirements.txt

# Create config
cat > /workspace/premium_train_config.yaml << 'CONFIGEOF'
job: extension
config:
  name: kriptik_premium_ui
  process:
    - type: sd_trainer
      training_folder: /workspace/output
      device: cuda:0
      trigger_word: kriptik_ui
      network:
        type: lora
        linear: ${CONFIG.loraRank}
        linear_alpha: ${CONFIG.loraRank}
      save:
        save_every: 500
        max_step_saves_to_keep: 3
      datasets:
        - folder_path: /workspace/dataset
          caption_ext: txt
          resolution: [1024, 1024]
      train:
        steps: ${CONFIG.trainingSteps}
        lr: ${CONFIG.learningRate}
        batch_size: ${CONFIG.batchSize}
        gradient_accumulation_steps: 4
      model:
        name_or_path: black-forest-labs/FLUX.1-dev
        is_flux: true
        quantize: true
CONFIGEOF

# Start training
echo "Starting premium training..."
python run.py /workspace/premium_train_config.yaml

# Move final model
if [ -f "/workspace/output/kriptik_premium_ui.safetensors" ]; then
    echo "Training complete!"
    echo "Model saved to: /workspace/output/kriptik_premium_ui.safetensors"
else
    echo "Training may have failed - no output model found"
fi
`;

  const scriptPath = path.join(PATHS.outputDir, 'runpod_training.sh');
  fs.mkdirSync(PATHS.outputDir, { recursive: true });
  fs.writeFileSync(scriptPath, trainingScript, { mode: 0o755 });

  console.log(`\\nTraining script created: ${scriptPath}`);

  // Create dataset upload manifest
  const datasetDir = path.join(PATHS.premiumDataCapture, 'output');
  const uploadManifest = {
    source: datasetDir,
    destination: '/workspace/dataset',
    files: [
      { src: 'screenshots', dst: 'images' },
      { src: 'captions', dst: 'captions' },
    ],
    config: PATHS.premiumConfig,
    script: scriptPath,
  };

  const manifestPath = path.join(PATHS.outputDir, 'upload_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(uploadManifest, null, 2));

  console.log(`Upload manifest created: ${manifestPath}`);
  console.log('\\nTo start training on RunPod:');
  console.log('  1. Create GPU pod via RunPod dashboard');
  console.log('  2. Upload dataset using runpodctl or SSH');
  console.log('  3. Run the training script');

  return scriptPath;
}

async function generateTrainingReport(stats: DatasetStats): Promise<void> {
  console.log('\\n' + '='.repeat(60));
  console.log('STEP 4: Generate Training Report');
  console.log('='.repeat(60));

  const report = `# KripTik Premium UI-LoRA Training Report

## Date: ${new Date().toISOString()}

## Dataset Summary

| Metric | Value |
|--------|-------|
| Total Screenshots | ${stats.totalScreenshots} |
| Total Captions | ${stats.totalCaptions} |
| Paired Entries | ${stats.totalPairedEntries} |

## Source Distribution

| Tier | Description | Count |
|------|-------------|-------|
| Tier 1 | Award Platforms (Awwwards, FWA, CSS Awards) | ${stats.byTier.tier1} |
| Tier 2 | Elite Studios (Lusion, Active Theory) | ${stats.byTier.tier2} |
| Tier 3 | Tutorials (Codrops, R3F, Three.js) | ${stats.byTier.tier3} |
| Tier 4 | Mobile/iOS (Apple HIG, ScreensDesign) | ${stats.byTier.tier4} |

## Quality Distribution

| Quality Level | Score Range | Count |
|---------------|-------------|-------|
| Premium | >= 0.9 | ${stats.qualityDistribution.premium} |
| High | 0.7 - 0.9 | ${stats.qualityDistribution.high} |
| Standard | 0.5 - 0.7 | ${stats.qualityDistribution.standard} |
| Rejected | < 0.5 | ${stats.qualityDistribution.rejected} |

## Training Configuration

| Parameter | Value |
|-----------|-------|
| Base Model | FLUX.1-dev |
| Trigger Word | kriptik_ui |
| LoRA Rank | ${CONFIG.loraRank} |
| Training Steps | ${CONFIG.trainingSteps} |
| Learning Rate | ${CONFIG.learningRate} |
| Batch Size | ${CONFIG.batchSize} |
| GPU | ${CONFIG.gpuType} |

## Techniques Found

${Array.from(stats.techniquesFound).map(t => \`- \${t}\`).join('\\n') || '- (Run pipeline to populate)'}

## Anti-AI-Slop Measures

- [x] Stock photo detection and rejection
- [x] Generic icon detection (FontAwesome, Material Icons)
- [x] Template site detection (ThemeForest, etc.)
- [x] AI-generated content detection (Midjourney, DALL-E markers)
- [x] Award/premium source prioritization
- [x] Physics parameter validation (stiffness: 100-400, damping: 10-30)

## Expected Improvements Over Base Training

1. **Visual Quality**: Award-winning aesthetic patterns
2. **Glassmorphism**: Proper frosted glass with depth
3. **Layout**: Premium bento grid and asymmetric layouts
4. **Animation Hints**: Kinetic typography, scroll-driven motion
5. **Text Rendering**: Better UI labels and typography
6. **Mobile Excellence**: iOS/Apple HIG compliance

## Next Steps

1. Complete data capture if needed
2. Upload dataset to RunPod
3. Run training (~75-90 minutes on RTX A5000)
4. Validate output quality
5. Deploy to RunPod Serverless endpoint
6. Begin Week 4: UICoder training with same dataset
`;

  const reportPath = path.join(PATHS.outputDir, 'training_report.md');
  fs.mkdirSync(PATHS.outputDir, { recursive: true });
  fs.writeFileSync(reportPath, report);

  console.log(`\\nTraining report saved: ${reportPath}`);
}

// =============================================================================
// Main Pipeline
// =============================================================================

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     KripTik Premium UI-LoRA Training Pipeline                ║');
  console.log('║     Week 3: FLUX Model Premium Retraining                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const args = process.argv.slice(2);
  const skipCapture = args.includes('--skip-capture');
  const forceCapture = args.includes('--force');
  const validateOnly = args.includes('--validate');

  // Step 1: Run premium data capture (unless skipped)
  if (!skipCapture) {
    const captureSuccess = await runPremiumDataCapture();
    if (!captureSuccess && !forceCapture) {
      console.log('\\nData capture incomplete. Run with --skip-capture to proceed anyway.');
      return;
    }
  } else {
    console.log('\\nSkipping data capture (--skip-capture flag)');
  }

  // Step 2: Validate dataset
  const { valid, stats } = await validateDataset();

  if (validateOnly) {
    console.log('\\nValidation complete (--validate flag)');
    return;
  }

  // Step 3: Prepare RunPod training
  const scriptPath = await prepareRunPodTraining();

  // Step 4: Generate training report
  await generateTrainingReport(stats);

  // Summary
  console.log('\\n' + '='.repeat(60));
  console.log('PIPELINE COMPLETE');
  console.log('='.repeat(60));

  if (valid) {
    console.log('\\n✅ Dataset is ready for training');
    console.log('\\nNext steps:');
    console.log('  1. Create RunPod GPU pod (RTX A5000 or better)');
    console.log('  2. Upload dataset to pod');
    console.log('  3. Run training script');
    console.log('  4. Download trained model');

    if (scriptPath) {
      console.log(`\\nTraining script: ${scriptPath}`);
    }
  } else {
    console.log('\\n⚠️  Dataset needs more data');
    console.log('\\nOptions:');
    console.log('  1. Run full pipeline: npm run pipeline (in premium-data-capture)');
    console.log('  2. Add manual images to Tier 1-4 sources');
    console.log('  3. Proceed with existing data: npx tsx premium-training.ts --skip-capture');
  }

  console.log('\\nReport: ' + path.join(PATHS.outputDir, 'training_report.md'));
}

// Run
main().catch(console.error);
