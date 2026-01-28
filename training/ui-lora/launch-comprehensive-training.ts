/**
 * Launch Comprehensive FLUX UI-LoRA Training
 *
 * Deploys training with the comprehensive 8,000+ image dataset combining:
 * - Premium bulk captures (1,200+ images from Awwwards, studios, tutorials)
 * - Existing LoRA dataset (4,513 images from websight + gridaco)
 * - Gridaco UI dataset (2,513 component images)
 *
 * Training Configuration:
 * - Base model: FLUX.1-dev
 * - LoRA rank: 64
 * - Steps: 5,000 (scaled for ~8,000 images)
 * - Trigger word: kriptik_ui
 *
 * Run with: npx tsx launch-comprehensive-training.ts [options]
 *
 * Options:
 *   --prepare-only   Only prepare dataset, don't launch training
 *   --dry-run        Show what would be done without executing
 *   --steps=N        Override training steps (default: 5000)
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

const CONFIG = {
  // RunPod Settings
  runpod: {
    apiKey: process.env.RUNPOD_API_KEY || '',
    graphqlUrl: 'https://api.runpod.io/graphql',
    preferredGpus: [
      'NVIDIA GeForce RTX 4090',
      'NVIDIA RTX A5000',
      'NVIDIA A100-SXM4-40GB',
      'NVIDIA A100 80GB PCIe',
    ],
    volumeSize: 150, // GB - larger for comprehensive dataset
    containerImage: 'runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04',
    podName: 'kriptik-comprehensive-lora-training',
  },

  // Training Settings
  training: {
    baseModel: 'black-forest-labs/FLUX.1-dev',
    loraRank: 64,
    loraAlpha: 64,
    learningRate: 1e-4,
    maxSteps: 5000, // Increased for larger dataset
    batchSize: 1,
    gradientAccumulation: 4,
    triggerWord: 'kriptik_ui',
    outputName: 'kriptik-comprehensive-ui-lora',
    resolution: 1024,
    saveEvery: 500,
    validationEvery: 500,
  },

  // Paths
  paths: {
    comprehensiveDataset: path.join(__dirname, '../comprehensive-training-dataset'),
    prepareScript: path.join(__dirname, '../premium-data-capture/prepare-training-dataset.ts'),
    existingLoraDataset: path.join(__dirname, 'dataset'),
    outputDir: path.join(__dirname, 'output'),
  },
};

// Parse CLI args
const args = process.argv.slice(2);
const PREPARE_ONLY = args.includes('--prepare-only');
const DRY_RUN = args.includes('--dry-run');
const stepsArg = args.find(a => a.startsWith('--steps='));
if (stepsArg) {
  CONFIG.training.maxSteps = parseInt(stepsArg.replace('--steps=', ''), 10);
}

// =============================================================================
// RunPod API Client
// =============================================================================

interface RunPodPod {
  id: string;
  name: string;
  desiredStatus: string;
  runtime?: {
    ports?: Array<{ port: number; ip: string; publicPort?: number }>;
  };
}

class RunPodClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async graphql(query: string): Promise<unknown> {
    const response = await fetch(CONFIG.runpod.graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      credentials: 'include',
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`RunPod API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.errors) {
      throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
    }

    return data.data;
  }

  async getMyPods(): Promise<RunPodPod[]> {
    const query = `
      query {
        myself {
          pods {
            id
            name
            desiredStatus
            runtime {
              ports {
                ip
                privatePort
                publicPort
              }
            }
          }
        }
      }
    `;
    const data = await this.graphql(query) as { myself: { pods: RunPodPod[] } };
    return data.myself.pods;
  }

  async getGpuTypes(): Promise<Array<{ id: string; displayName: string; memoryInGb: number; securePrice: number }>> {
    const query = `
      query {
        gpuTypes {
          id
          displayName
          memoryInGb
          secureCloud
          securePrice
        }
      }
    `;
    const data = await this.graphql(query) as { gpuTypes: Array<{ id: string; displayName: string; memoryInGb: number; secureCloud: boolean; securePrice: number }> };
    return data.gpuTypes.filter(g => g.secureCloud && g.memoryInGb >= 24);
  }

  async createPod(gpuTypeId: string): Promise<RunPodPod> {
    const query = `
      mutation {
        podFindAndDeployOnDemand(
          input: {
            cloudType: SECURE
            gpuCount: 1
            volumeInGb: ${CONFIG.runpod.volumeSize}
            containerDiskInGb: 30
            minVcpuCount: 8
            minMemoryInGb: 32
            gpuTypeId: "${gpuTypeId}"
            name: "${CONFIG.runpod.podName}"
            imageName: "${CONFIG.runpod.containerImage}"
            volumeMountPath: "/workspace"
            ports: "8888/http,22/tcp,6006/http"
            startJupyter: true
            startSsh: true
          }
        ) {
          id
          name
          desiredStatus
        }
      }
    `;
    const data = await this.graphql(query) as { podFindAndDeployOnDemand: RunPodPod };
    return data.podFindAndDeployOnDemand;
  }

  async getPod(podId: string): Promise<RunPodPod | null> {
    const query = `
      query {
        pod(input: { podId: "${podId}" }) {
          id
          name
          desiredStatus
          runtime {
            ports {
              ip
              privatePort
              publicPort
            }
          }
        }
      }
    `;
    const data = await this.graphql(query) as { pod: RunPodPod };
    return data.pod;
  }

  async terminatePod(podId: string): Promise<void> {
    const query = `
      mutation {
        podTerminate(input: { podId: "${podId}" })
      }
    `;
    await this.graphql(query);
  }
}

// =============================================================================
// Dataset Preparation
// =============================================================================

async function prepareComprehensiveDataset(): Promise<{ totalImages: number; totalCaptions: number }> {
  console.log('\n📁 Preparing comprehensive training dataset...\n');

  // Check if prepare script exists
  if (!fs.existsSync(CONFIG.paths.prepareScript)) {
    throw new Error(`Prepare script not found: ${CONFIG.paths.prepareScript}`);
  }

  // Run the prepare script with all sources
  console.log('Running: npx tsx prepare-training-dataset.ts --all-viewports --include-existing --include-gridaco\n');

  if (!DRY_RUN) {
    execSync('npx tsx prepare-training-dataset.ts --all-viewports --include-existing --include-gridaco', {
      cwd: path.dirname(CONFIG.paths.prepareScript),
      stdio: 'inherit',
    });
  } else {
    console.log('[DRY-RUN] Would execute prepare-training-dataset.ts');
  }

  // Read the manifest
  const manifestPath = path.join(CONFIG.paths.comprehensiveDataset, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    return {
      totalImages: manifest.totalImages,
      totalCaptions: manifest.totalCaptions,
    };
  }

  // If no manifest, count files
  const imagesDir = path.join(CONFIG.paths.comprehensiveDataset, 'images');
  const captionsDir = path.join(CONFIG.paths.comprehensiveDataset, 'captions');

  const imageCount = fs.existsSync(imagesDir)
    ? fs.readdirSync(imagesDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg')).length
    : 0;
  const captionCount = fs.existsSync(captionsDir)
    ? fs.readdirSync(captionsDir).filter(f => f.endsWith('.txt')).length
    : 0;

  return { totalImages: imageCount, totalCaptions: captionCount };
}

// =============================================================================
// Training Script Generation
// =============================================================================

function generateTrainingConfig(): string {
  return `# SimpleTuner/ai-toolkit config for KripTik Comprehensive UI-LoRA
# Generated: ${new Date().toISOString()}
# Dataset: ~8,000 images (premium + existing + gridaco)

job: extension
config:
  name: ${CONFIG.training.outputName}
  process:
    - type: sd_trainer
      training_folder: /workspace/output
      device: cuda:0
      trigger_word: ${CONFIG.training.triggerWord}

      network:
        type: lora
        linear: ${CONFIG.training.loraRank}
        linear_alpha: ${CONFIG.training.loraAlpha}

      save:
        save_every: ${CONFIG.training.saveEvery}
        max_step_saves_to_keep: 5
        push_to_hub: false

      datasets:
        - folder_path: /workspace/dataset
          caption_ext: txt
          resolution: [${CONFIG.training.resolution}, ${CONFIG.training.resolution}]
          is_regularization: false
          cache_latents_to_disk: true

      train:
        steps: ${CONFIG.training.maxSteps}
        lr: ${CONFIG.training.learningRate}
        batch_size: ${CONFIG.training.batchSize}
        gradient_accumulation_steps: ${CONFIG.training.gradientAccumulation}
        gradient_checkpointing: true
        optimizer: adamw8bit
        train_text_encoder: false
        noise_scheduler: flow_match

      sample:
        sample_every: ${CONFIG.training.validationEvery}
        sample_steps: 20
        width: ${CONFIG.training.resolution}
        height: ${CONFIG.training.resolution}
        prompts:
          - "${CONFIG.training.triggerWord}, premium SaaS dashboard, data visualization cards, dark theme, modern 2026 aesthetic"
          - "${CONFIG.training.triggerWord}, mobile app login screen, email password inputs, glassmorphism, iOS native design"
          - "${CONFIG.training.triggerWord}, e-commerce product page, image gallery, add to cart button, premium visual quality"
          - "${CONFIG.training.triggerWord}, award-winning portfolio, WebGL effects, scroll animations, creative studio design"

      model:
        name_or_path: black-forest-labs/FLUX.1-dev
        is_flux: true
        quantize: true
`;
}

function generateRunpodScript(): string {
  return `#!/bin/bash
# KripTik Comprehensive UI-LoRA Training Script for RunPod
# Dataset: ~8,000 premium UI images
# Estimated training time: ~2-3 hours on RTX 4090

set -e
cd /workspace

echo "═══════════════════════════════════════════════════════════════"
echo "  KripTik Comprehensive UI-LoRA Training"
echo "  FLUX.1-dev Fine-tuning for Premium UI Generation"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 1. Clone ai-toolkit if not present
if [ ! -d "ai-toolkit" ]; then
  echo "📦 Cloning ai-toolkit..."
  git clone https://github.com/ostris/ai-toolkit.git
  cd ai-toolkit
  pip install -r requirements.txt
  cd ..
fi

# 2. Install additional dependencies
echo "📦 Installing dependencies..."
pip install -q accelerate transformers diffusers peft safetensors
pip install -q bitsandbytes scipy einops
pip install -q tensorboard

# 3. Extract dataset if needed
if [ -f "/workspace/dataset.tar.gz" ]; then
  echo "📂 Extracting dataset..."
  tar -xzf /workspace/dataset.tar.gz -C /workspace/
  rm /workspace/dataset.tar.gz
fi

# 4. Verify dataset
if [ ! -d "/workspace/dataset/images" ]; then
  echo "❌ Dataset not found at /workspace/dataset/images"
  echo "Please upload the comprehensive dataset:"
  echo "  runpodctl send comprehensive-training-dataset.tar.gz POD_ID:/workspace/dataset.tar.gz"
  exit 1
fi

IMAGE_COUNT=$(find /workspace/dataset/images -type f \\( -name "*.png" -o -name "*.jpg" \\) | wc -l)
CAPTION_COUNT=$(find /workspace/dataset/captions -type f -name "*.txt" | wc -l)
echo "✅ Dataset verified: $IMAGE_COUNT images, $CAPTION_COUNT captions"

# 5. Download FLUX model if not present
if [ ! -d "/workspace/models/flux-dev" ]; then
  echo "📥 Downloading FLUX.1-dev base model..."
  python -c "
from huggingface_hub import snapshot_download
snapshot_download('black-forest-labs/FLUX.1-dev',
                  local_dir='/workspace/models/flux-dev',
                  ignore_patterns=['*.bin', '*.md'])
print('✅ Model downloaded')
"
fi

# 6. Start TensorBoard in background
echo "📊 Starting TensorBoard on port 6006..."
tensorboard --logdir=/workspace/output/logs --port=6006 --bind_all &

# 7. Run training
echo ""
echo "🏋️ Starting training..."
echo "   Steps: ${CONFIG.training.maxSteps}"
echo "   LoRA Rank: ${CONFIG.training.loraRank}"
echo "   Learning Rate: ${CONFIG.training.learningRate}"
echo "   Trigger Word: ${CONFIG.training.triggerWord}"
echo ""

cd /workspace/ai-toolkit
python run.py /workspace/train_config.yaml 2>&1 | tee /workspace/training.log

# 8. Copy final model
if [ -f "/workspace/output/${CONFIG.training.outputName}.safetensors" ]; then
  echo ""
  echo "✅ Training complete!"
  echo "   Model: /workspace/output/${CONFIG.training.outputName}.safetensors"
else
  # Try to find the latest checkpoint
  LATEST=$(ls -t /workspace/output/*.safetensors 2>/dev/null | head -1)
  if [ -n "$LATEST" ]; then
    cp "$LATEST" "/workspace/${CONFIG.training.outputName}.safetensors"
    echo "✅ Training complete!"
    echo "   Model: /workspace/${CONFIG.training.outputName}.safetensors"
  fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Download your model:"
echo "  runpodctl receive POD_ID:/workspace/${CONFIG.training.outputName}.safetensors ./"
echo "═══════════════════════════════════════════════════════════════"
`;
}

function generateDatasetPackageScript(): string {
  return `#!/bin/bash
# Package comprehensive dataset for upload to RunPod

set -e
cd "${CONFIG.paths.comprehensiveDataset}"

echo "📦 Packaging comprehensive training dataset..."

# Create dataset structure expected by training
mkdir -p /tmp/kriptik-dataset/images
mkdir -p /tmp/kriptik-dataset/captions

# Copy images
echo "   Copying images..."
cp images/*.png /tmp/kriptik-dataset/images/ 2>/dev/null || true
cp images/*.jpg /tmp/kriptik-dataset/images/ 2>/dev/null || true

# Copy captions
echo "   Copying captions..."
cp captions/*.txt /tmp/kriptik-dataset/captions/ 2>/dev/null || true

# Create tarball
echo "   Creating archive..."
cd /tmp
tar -czf kriptik-comprehensive-dataset.tar.gz kriptik-dataset/

# Move to output
mv kriptik-comprehensive-dataset.tar.gz "${CONFIG.paths.outputDir}/"

# Cleanup
rm -rf /tmp/kriptik-dataset

echo ""
echo "✅ Dataset packaged: ${CONFIG.paths.outputDir}/kriptik-comprehensive-dataset.tar.gz"
echo ""
echo "Upload to RunPod:"
echo "  runpodctl send ${CONFIG.paths.outputDir}/kriptik-comprehensive-dataset.tar.gz POD_ID:/workspace/dataset.tar.gz"
`;
}

// =============================================================================
// Main Orchestration
// =============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  KripTik Comprehensive UI-LoRA Training Launcher');
  console.log('  FLUX.1-dev + 8,000+ Premium UI Images');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Step 1: Prepare dataset
  const datasetStats = await prepareComprehensiveDataset();
  console.log(`\n📊 Dataset Statistics:`);
  console.log(`   Total Images: ${datasetStats.totalImages}`);
  console.log(`   Total Captions: ${datasetStats.totalCaptions}`);

  if (datasetStats.totalImages < 1000) {
    console.log('\n⚠️  Warning: Less than 1000 images. Consider waiting for captures to complete.');
  }

  // Calculate recommended steps (~0.5-1 steps per image is common)
  const recommendedSteps = Math.min(Math.max(Math.floor(datasetStats.totalImages * 0.6), 3000), 8000);
  console.log(`   Recommended Steps: ${recommendedSteps}`);
  console.log(`   Configured Steps: ${CONFIG.training.maxSteps}`);

  // Step 2: Generate training files
  console.log('\n📝 Generating training configuration...');

  fs.mkdirSync(CONFIG.paths.outputDir, { recursive: true });

  // Write training config
  const configPath = path.join(CONFIG.paths.outputDir, 'train_config.yaml');
  fs.writeFileSync(configPath, generateTrainingConfig());
  console.log(`   ✅ Config: ${configPath}`);

  // Write RunPod script
  const runpodScriptPath = path.join(CONFIG.paths.outputDir, 'run_training.sh');
  fs.writeFileSync(runpodScriptPath, generateRunpodScript());
  fs.chmodSync(runpodScriptPath, '755');
  console.log(`   ✅ RunPod Script: ${runpodScriptPath}`);

  // Write dataset packaging script
  const packageScriptPath = path.join(CONFIG.paths.outputDir, 'package_dataset.sh');
  fs.writeFileSync(packageScriptPath, generateDatasetPackageScript());
  fs.chmodSync(packageScriptPath, '755');
  console.log(`   ✅ Package Script: ${packageScriptPath}`);

  if (PREPARE_ONLY) {
    console.log('\n✅ Preparation complete (--prepare-only mode)');
    console.log('\nNext steps:');
    console.log('1. Run: bash training/ui-lora/output/package_dataset.sh');
    console.log('2. Create RunPod pod with RTX 4090 or A100');
    console.log('3. Upload dataset and run training script');
    return;
  }

  // Step 3: Launch on RunPod (if API key available)
  if (!CONFIG.runpod.apiKey) {
    console.log('\n⚠️  RUNPOD_API_KEY not set');
    console.log('\nManual RunPod Setup Instructions:');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('1. Package the dataset:');
    console.log(`   bash ${packageScriptPath}\n`);
    console.log('2. Create RunPod GPU Pod:');
    console.log('   - GPU: RTX 4090 or A100 (24GB+ VRAM required)');
    console.log(`   - Image: ${CONFIG.runpod.containerImage}`);
    console.log(`   - Volume: ${CONFIG.runpod.volumeSize}GB at /workspace\n`);
    console.log('3. Upload files to pod:');
    console.log('   runpodctl send kriptik-comprehensive-dataset.tar.gz POD_ID:/workspace/dataset.tar.gz');
    console.log(`   runpodctl send ${configPath} POD_ID:/workspace/train_config.yaml`);
    console.log(`   runpodctl send ${runpodScriptPath} POD_ID:/workspace/run_training.sh\n`);
    console.log('4. On pod, run:');
    console.log('   bash /workspace/run_training.sh\n');
    console.log('5. Monitor training:');
    console.log('   - TensorBoard: http://POD_IP:6006');
    console.log('   - Logs: tail -f /workspace/training.log\n');
    console.log('6. Download trained model:');
    console.log(`   runpodctl receive POD_ID:/workspace/${CONFIG.training.outputName}.safetensors ./`);
    console.log('\n═══════════════════════════════════════════════════════════════');
    return;
  }

  // Automated RunPod deployment
  console.log('\n🚀 Launching training on RunPod...');

  const runpod = new RunPodClient(CONFIG.runpod.apiKey);

  // Check for existing pod
  const pods = await runpod.getMyPods();
  let pod = pods.find(p => p.name === CONFIG.runpod.podName);

  if (pod) {
    console.log(`   Found existing pod: ${pod.id}`);
  } else {
    // Find best GPU
    console.log('   Finding available GPU...');
    const gpuTypes = await runpod.getGpuTypes();

    let selectedGpu = null;
    for (const preferred of CONFIG.runpod.preferredGpus) {
      const found = gpuTypes.find(g => g.displayName.includes(preferred.replace('NVIDIA ', '')));
      if (found) {
        selectedGpu = found;
        break;
      }
    }

    if (!selectedGpu) {
      selectedGpu = gpuTypes.find(g => g.memoryInGb >= 24);
    }

    if (!selectedGpu) {
      throw new Error('No suitable GPU available (24GB+ VRAM required)');
    }

    console.log(`   Selected GPU: ${selectedGpu.displayName} ($${selectedGpu.securePrice}/hr)`);

    if (!DRY_RUN) {
      pod = await runpod.createPod(selectedGpu.id);
      console.log(`   ✅ Created pod: ${pod.id}`);
    } else {
      console.log(`   [DRY-RUN] Would create pod with ${selectedGpu.displayName}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Training Launched Successfully!');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('Next steps:');
  console.log('1. Wait for pod to be ready (check RunPod dashboard)');
  console.log('2. Upload dataset (see instructions above)');
  console.log('3. SSH to pod and run training script');
  console.log('4. Monitor TensorBoard at http://POD_IP:6006');
  console.log(`5. Download model when complete: ${CONFIG.training.outputName}.safetensors`);
}

main().catch(console.error);
