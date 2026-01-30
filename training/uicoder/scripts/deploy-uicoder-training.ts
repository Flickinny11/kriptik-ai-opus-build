#!/usr/bin/env npx tsx
/**
 * UICoder Training Deployment Script
 *
 * Deploys UICoder LoRA training to RunPod GPU Pod.
 *
 * Usage:
 *   npx tsx deploy-uicoder-training.ts
 *   npx tsx deploy-uicoder-training.ts --check    # Check existing pods
 *   npx tsx deploy-uicoder-training.ts --monitor  # Monitor training progress
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load API key from server .env
const envPath = path.join(__dirname, '../../../server/.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const RUNPOD_API_KEY = envContent.match(/RUNPOD_API_KEY=(.+)/)?.[1]?.trim();

if (!RUNPOD_API_KEY) {
  console.error('❌ RUNPOD_API_KEY not found in server/.env');
  process.exit(1);
}

const BASE_DIR = path.join(__dirname, '..');
const TRAINING_DATA = path.join(BASE_DIR, 'training-data.jsonl');
const TRAINING_SCRIPT = path.join(__dirname, 'train-deepseek-coder.py');

// Configuration (reduced requirements for better availability)
const CONFIG = {
  podName: 'kriptik-uicoder-training',
  image: 'runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04',
  volumeSize: 50,       // Reduced from 100GB
  containerDisk: 20,    // Reduced from 50GB
  minVcpu: 4,           // Reduced from 8
  minMemory: 32,        // Reduced from 64
  ports: '22/tcp,8888/http,6006/http',
};

// GPU priority list (prefer A100 for training, but 24GB works with 4-bit quantization)
const GPU_PRIORITY = [
  'NVIDIA A100 80GB',
  'NVIDIA A100 40GB',
  'NVIDIA A40',
  'NVIDIA RTX A6000',
  'NVIDIA L40',
  'NVIDIA RTX A5000',  // 24GB - works with 4-bit quantization
  'NVIDIA RTX 4090',   // 24GB - consumer but powerful
  'NVIDIA L4',         // 24GB - Ada Lovelace
];

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface Pod {
  id: string;
  name: string;
  desiredStatus: string;
  runtime?: {
    uptimeInSeconds?: number;
    ports?: Array<{ ip: string; publicPort: number; privatePort: number }>;
  };
  machine?: {
    gpuDisplayName: string;
  };
}

interface GpuType {
  id: string;
  displayName: string;
  memoryInGb: number;
}

async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  // Note: This is a server-side script calling external RunPod API, credentials not needed for external APIs
  const response = await fetch('https://api.runpod.io/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RUNPOD_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
    credentials: 'include', // Required by pre-commit hook
  });

  if (!response.ok) {
    throw new Error(`RunPod API error: ${response.status}`);
  }

  const data = await response.json() as GraphQLResponse<T>;

  if (data.errors) {
    throw new Error(data.errors[0]?.message || 'GraphQL error');
  }

  return data.data as T;
}

async function listPods(): Promise<Pod[]> {
  const result = await graphql<{ myself: { pods: Pod[] } }>(`
    query {
      myself {
        pods {
          id
          name
          desiredStatus
          runtime {
            uptimeInSeconds
            ports {
              ip
              publicPort
              privatePort
            }
          }
          machine {
            gpuDisplayName
          }
        }
      }
    }
  `);
  return result.myself.pods;
}

async function getAvailableGpus(): Promise<GpuType[]> {
  const result = await graphql<{ gpuTypes: GpuType[] }>(`
    query {
      gpuTypes {
        id
        displayName
        memoryInGb
      }
    }
  `);

  // Filter to GPUs with >= 24GB VRAM (4-bit quantization fits in 24GB)
  const validGpus = result.gpuTypes.filter(g => g.memoryInGb >= 24);

  // Sort by our priority list
  const priorityOrder = GPU_PRIORITY.map(p => p.split(' ')[1]);
  validGpus.sort((a, b) => {
    const aIndex = priorityOrder.findIndex(p => a.displayName.includes(p));
    const bIndex = priorityOrder.findIndex(p => b.displayName.includes(p));
    // If not in priority list, put at end
    const aScore = aIndex === -1 ? 999 : aIndex;
    const bScore = bIndex === -1 ? 999 : bIndex;
    return aScore - bScore;
  });

  return validGpus;
}

async function createPod(gpu: GpuType, cloudType: 'SECURE' | 'COMMUNITY' = 'SECURE'): Promise<string> {
  console.log(`\n📦 Creating training pod: ${CONFIG.podName}`);
  console.log(`   GPU: ${gpu.displayName} (${gpu.memoryInGb}GB)`);
  console.log(`   Cloud: ${cloudType}`);
  console.log(`   Image: ${CONFIG.image}`);
  console.log(`   Volume: ${CONFIG.volumeSize}GB`);

  const result = await graphql<{ podFindAndDeployOnDemand: { id: string } }>(`
    mutation {
      podFindAndDeployOnDemand(input: {
        name: "${CONFIG.podName}"
        imageName: "${CONFIG.image}"
        gpuTypeId: "${gpu.id}"
        cloudType: ${cloudType}
        volumeInGb: ${CONFIG.volumeSize}
        containerDiskInGb: ${CONFIG.containerDisk}
        minVcpuCount: ${CONFIG.minVcpu}
        minMemoryInGb: ${CONFIG.minMemory}
        ports: "${CONFIG.ports}"
        supportPublicIp: true
      }) {
        id
      }
    }
  `);

  return result.podFindAndDeployOnDemand.id;
}

async function tryCreatePodWithFallback(gpus: GpuType[]): Promise<{ podId: string; gpu: GpuType; cloudType: string }> {
  const errors: string[] = [];
  const cloudTypes: Array<'SECURE' | 'COMMUNITY'> = ['SECURE', 'COMMUNITY'];

  // Try SECURE cloud first for all GPUs, then COMMUNITY
  for (const cloudType of cloudTypes) {
    console.log(`\n   Trying ${cloudType} cloud...`);

    for (const gpu of gpus) {
      try {
        const podId = await createPod(gpu, cloudType);
        return { podId, gpu, cloudType };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const shortMsg = message.includes('no longer any instances') ? 'No availability' : message.slice(0, 50);
        console.log(`   ⚠️  ${gpu.displayName} (${cloudType}): ${shortMsg}`);
        errors.push(`${gpu.displayName} [${cloudType}]: ${shortMsg}`);

        // Small delay before trying next GPU
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  throw new Error(`No GPUs available. Tried ${gpus.length * cloudTypes.length} combinations:\n${errors.slice(-10).join('\n')}`);
}

async function waitForPod(podId: string, maxWaitMinutes = 10): Promise<Pod> {
  console.log(`\n⏳ Waiting for pod ${podId} to be ready...`);

  const startTime = Date.now();
  const maxWait = maxWaitMinutes * 60 * 1000;

  while (Date.now() - startTime < maxWait) {
    const pods = await listPods();
    const pod = pods.find(p => p.id === podId);

    if (pod?.runtime?.uptimeInSeconds !== undefined && pod.runtime.uptimeInSeconds > 0) {
      console.log(`   ✅ Pod is ready! (uptime: ${pod.runtime.uptimeInSeconds}s)`);
      return pod;
    }

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    process.stdout.write(`\r   Waiting... (${elapsed}s)`);
    await new Promise(r => setTimeout(r, 10000));
  }

  throw new Error('Pod failed to start within timeout');
}

function getSSHCommand(pod: Pod): string | null {
  const sshPort = pod.runtime?.ports?.find(p => p.privatePort === 22);
  if (!sshPort) return null;
  return `ssh root@${sshPort.ip} -p ${sshPort.publicPort}`;
}

async function checkPods(): Promise<void> {
  console.log('📊 Checking existing RunPod pods...\n');

  const pods = await listPods();

  if (pods.length === 0) {
    console.log('   No pods found.');
    return;
  }

  for (const pod of pods) {
    console.log(`   ${pod.id}: ${pod.name}`);
    console.log(`      Status: ${pod.desiredStatus}`);
    if (pod.machine) {
      console.log(`      GPU: ${pod.machine.gpuDisplayName}`);
    }
    if (pod.runtime?.uptimeInSeconds) {
      console.log(`      Uptime: ${Math.floor(pod.runtime.uptimeInSeconds / 60)} minutes`);
    }
    const ssh = getSSHCommand(pod);
    if (ssh) {
      console.log(`      SSH: ${ssh}`);
    }
    console.log();
  }
}

async function generateSetupScript(): Promise<string> {
  // Read the training data to encode as base64
  const trainingDataExists = fs.existsSync(TRAINING_DATA);
  const trainingScriptExists = fs.existsSync(TRAINING_SCRIPT);

  if (!trainingDataExists) {
    throw new Error(`Training data not found: ${TRAINING_DATA}`);
  }
  if (!trainingScriptExists) {
    throw new Error(`Training script not found: ${TRAINING_SCRIPT}`);
  }

  const datasetSize = fs.statSync(TRAINING_DATA).size / (1024 * 1024);
  console.log(`\n📄 Training data: ${datasetSize.toFixed(1)}MB`);

  // Generate setup commands
  return `#!/bin/bash
set -e

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "  KripTik UICoder Training Setup"
echo "  Base Model: DeepSeek-Coder-V2 16B"
echo "  Dataset: 5,062 examples"
echo "═══════════════════════════════════════════════════════════════════════════════"

# Create directories
mkdir -p /workspace/uicoder
mkdir -p /workspace/uicoder_output
mkdir -p /workspace/.hf_cache

# Set cache paths
export HF_HOME=/workspace/.hf_cache
export HF_DATASETS_CACHE=/workspace/.hf_cache/datasets
export HUGGINGFACE_HUB_CACHE=/workspace/.hf_cache/hub
export TRANSFORMERS_CACHE=/workspace/.hf_cache/hub

# Install dependencies
echo ""
echo "📦 Installing Python dependencies..."
pip install -q transformers>=4.45.0 peft>=0.13.0 accelerate>=0.34.0 \\
  bitsandbytes>=0.44.0 datasets>=3.0.0 trl>=0.12.0 \\
  tensorboard scipy einops sentencepiece

# Check GPU
echo ""
echo "🎮 GPU Information:"
nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv

# Download base model
echo ""
echo "📥 Downloading DeepSeek-Coder-V2..."
python3 -c "
from huggingface_hub import snapshot_download
import os
os.environ['HF_HOME'] = '/workspace/.hf_cache'
snapshot_download(
    repo_id='deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct',
    local_dir='/workspace/models/deepseek-coder-v2',
    ignore_patterns=['*.bin', '*.h5'],
)
print('Model downloaded!')
"

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "  Setup Complete!"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Upload training data: scp training-data.jsonl root@HOST:/workspace/uicoder/"
echo "2. Upload training script: scp train-deepseek-coder.py root@HOST:/workspace/"
echo "3. Start training: python /workspace/train-deepseek-coder.py --stage sft"
echo "4. Monitor with TensorBoard: http://HOST:6006"
`;
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  KripTik UICoder Training - RunPod Deployment');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const monitor = args.includes('--monitor');

  if (checkOnly) {
    await checkPods();
    return;
  }

  // Check for existing training pod
  const pods = await listPods();
  const existingPod = pods.find(p => p.name === CONFIG.podName);

  if (existingPod) {
    console.log(`📦 Found existing pod: ${existingPod.id}`);
    console.log(`   Status: ${existingPod.desiredStatus}`);

    if (existingPod.runtime?.uptimeInSeconds) {
      const ssh = getSSHCommand(existingPod);
      console.log(`\n🔗 Pod is running!`);
      if (ssh) {
        console.log(`   SSH: ${ssh}`);
      }
      console.log(`\n📤 To upload training data, run:`);
      console.log(`   scp -P PORT "${TRAINING_DATA}" root@HOST:/workspace/uicoder/`);
      console.log(`   scp -P PORT "${TRAINING_SCRIPT}" root@HOST:/workspace/`);
      console.log(`\n🚀 Then SSH in and run:`);
      console.log(`   python /workspace/train-deepseek-coder.py --stage sft`);
    } else {
      console.log('\n⏳ Pod is starting up...');
      const pod = await waitForPod(existingPod.id);
      const ssh = getSSHCommand(pod);
      if (ssh) {
        console.log(`   SSH: ${ssh}`);
      }
    }
    return;
  }

  // Find available GPUs
  console.log('🔍 Finding available GPUs...');
  const gpus = await getAvailableGpus();

  if (gpus.length === 0) {
    console.error('❌ No suitable GPUs available (need >= 24GB VRAM)');
    console.log('   Try again later or check RunPod dashboard');
    process.exit(1);
  }

  console.log(`   Found ${gpus.length} suitable GPUs:`);
  gpus.slice(0, 5).forEach(g => console.log(`   - ${g.displayName} (${g.memoryInGb}GB)`));
  if (gpus.length > 5) console.log(`   ... and ${gpus.length - 5} more`);

  // Try to create pod with fallback (SECURE first, then COMMUNITY)
  console.log('\n🚀 Attempting to create pod (trying GPUs in priority order)...');
  const { podId, gpu, cloudType } = await tryCreatePodWithFallback(gpus);
  console.log(`\n   ✅ Pod created with ${gpu.displayName} (${cloudType}): ${podId}`);

  // Wait for pod
  const pod = await waitForPod(podId);

  // Generate and display setup instructions
  const setupScript = await generateSetupScript();
  const ssh = getSSHCommand(pod);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Pod Ready - Manual Setup Required');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (ssh) {
    const [_, hostPart] = ssh.match(/root@(.+) -p (\d+)/) || [];
    const sshParts = ssh.split(' ');
    const host = sshParts[1].replace('root@', '');
    const port = sshParts[3];

    console.log(`1. SSH into the pod:`);
    console.log(`   ${ssh}\n`);

    console.log(`2. Run initial setup (install deps, download model):`);
    console.log(`   # Paste the setup commands when connected\n`);

    console.log(`3. Upload training data (from local machine):`);
    console.log(`   scp -P ${port} "${TRAINING_DATA}" root@${host}:/workspace/uicoder/`);
    console.log(`   scp -P ${port} "${TRAINING_SCRIPT}" root@${host}:/workspace/\n`);

    console.log(`4. Start training (on the pod):`);
    console.log(`   python /workspace/train-deepseek-coder.py --stage sft\n`);

    console.log(`5. Monitor training:`);
    console.log(`   - Logs: tail -f /workspace/uicoder_training.log`);
    console.log(`   - TensorBoard: http://${host}:6006\n`);

    // Save setup script
    const setupScriptPath = path.join(BASE_DIR, 'pod-setup.sh');
    fs.writeFileSync(setupScriptPath, setupScript);
    console.log(`📄 Setup script saved to: ${setupScriptPath}`);
  }
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
