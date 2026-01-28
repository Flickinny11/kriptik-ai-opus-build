/**
 * FLUX UI Generator - RunPod Serverless Deployment Script
 *
 * Deploys the trained FLUX.2-dev + UI-Design-LoRA to RunPod Serverless.
 *
 * Prerequisites:
 * 1. Docker installed and running
 * 2. RUNPOD_API_KEY environment variable set
 * 3. DOCKER_HUB_USERNAME environment variable set
 * 4. Trained LoRA at training/ui-lora/models/kriptik-comprehensive-ui-lora.safetensors
 *
 * Usage:
 *   npx tsx deploy-flux-serverless.ts
 *   npx tsx deploy-flux-serverless.ts --skip-build   # Skip Docker build, just deploy
 *   npx tsx deploy-flux-serverless.ts --endpoint-only # Only create endpoint (image already pushed)
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Configuration
// =============================================================================

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const DOCKER_HUB_USERNAME = process.env.DOCKER_HUB_USERNAME || 'alledged1982';
const IMAGE_NAME = 'kriptik-flux-ui-generator';
const IMAGE_TAG = 'v1-comprehensive';

// Paths
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DOCKER_DIR = path.join(PROJECT_ROOT, 'docker/ui-generator');
const MODELS_DIR = path.join(__dirname, 'models');
const LORA_FILE = 'kriptik-comprehensive-ui-lora.safetensors';
const LORA_PATH = path.join(MODELS_DIR, LORA_FILE);

// RunPod GPU mapping
const GPU_IDS: Record<string, string> = {
  'NVIDIA RTX A4000': 'AMPERE_16',
  'NVIDIA RTX A5000': 'AMPERE_24',
  'NVIDIA RTX A6000': 'AMPERE_48',
  'NVIDIA L4': 'ADA_24',
  'NVIDIA L40': 'ADA_48_PRO',
  'NVIDIA A100 40GB': 'AMPERE_80',
};

// Endpoint configuration
const ENDPOINT_CONFIG = {
  name: 'kriptik-flux-ui-generator',
  gpuType: 'NVIDIA RTX A5000',  // 24GB VRAM for FLUX
  minWorkers: 0,
  maxWorkers: 5,
  idleTimeout: 120,  // 2 minutes
  containerDiskInGb: 50,  // FLUX model + LoRA
  description: 'FLUX.2-dev + UI-Design-LoRA for generating premium UI mockups',
};

// =============================================================================
// Validation
// =============================================================================

function validateEnvironment(): void {
  console.log('🔍 Validating environment...\n');

  if (!RUNPOD_API_KEY) {
    console.error('❌ RUNPOD_API_KEY environment variable not set');
    console.log('   Set it with: export RUNPOD_API_KEY=your_api_key');
    process.exit(1);
  }

  // Check LoRA file exists
  if (!fs.existsSync(LORA_PATH)) {
    console.error(`❌ LoRA file not found: ${LORA_PATH}`);
    console.log('   Run FLUX training first or check the path');
    process.exit(1);
  }

  const loraSize = fs.statSync(LORA_PATH).size / (1024 * 1024);
  console.log(`✅ Found LoRA file: ${LORA_FILE} (${loraSize.toFixed(1)} MB)`);

  // Check Docker
  try {
    execSync('docker --version', { stdio: 'pipe' });
    console.log('✅ Docker is installed');
  } catch {
    console.error('❌ Docker not found. Please install Docker.');
    process.exit(1);
  }

  // Check Dockerfile
  const dockerfilePath = path.join(DOCKER_DIR, 'Dockerfile');
  if (!fs.existsSync(dockerfilePath)) {
    console.error(`❌ Dockerfile not found: ${dockerfilePath}`);
    process.exit(1);
  }
  console.log('✅ Dockerfile found');

  console.log('');
}

// =============================================================================
// Docker Build
// =============================================================================

async function buildDockerImage(): Promise<void> {
  console.log('🔨 Building Docker image...\n');

  const imageFull = `${DOCKER_HUB_USERNAME}/${IMAGE_NAME}:${IMAGE_TAG}`;

  // Copy LoRA to Docker context
  const loraDestDir = path.join(DOCKER_DIR, 'models');
  const loraDest = path.join(loraDestDir, 'ui-design-lora.safetensors');

  if (!fs.existsSync(loraDestDir)) {
    fs.mkdirSync(loraDestDir, { recursive: true });
  }

  console.log(`   Copying LoRA to Docker context...`);
  fs.copyFileSync(LORA_PATH, loraDest);
  console.log(`   ✅ Copied ${LORA_FILE} -> models/ui-design-lora.safetensors`);

  // Update Dockerfile to include LoRA
  const dockerfilePath = path.join(DOCKER_DIR, 'Dockerfile');
  let dockerfile = fs.readFileSync(dockerfilePath, 'utf-8');

  // Uncomment the COPY line for LoRA
  if (dockerfile.includes('# COPY ./models/ui-design-lora.safetensors')) {
    dockerfile = dockerfile.replace(
      '# COPY ./models/ui-design-lora.safetensors ./ui-design/',
      'COPY ./models/ui-design-lora.safetensors ./ui-design/'
    );
    fs.writeFileSync(dockerfilePath, dockerfile);
    console.log('   ✅ Updated Dockerfile to include LoRA');
  }

  // Build image
  console.log(`\n   Building: ${imageFull}`);
  console.log('   This may take 10-15 minutes on first build...\n');

  try {
    execSync(`docker build -t ${imageFull} .`, {
      cwd: DOCKER_DIR,
      stdio: 'inherit',
    });
    console.log(`\n✅ Docker image built: ${imageFull}`);
  } catch (error) {
    console.error('\n❌ Docker build failed');
    throw error;
  }
}

async function pushDockerImage(): Promise<void> {
  console.log('\n📤 Pushing Docker image to Docker Hub...\n');

  const imageFull = `${DOCKER_HUB_USERNAME}/${IMAGE_NAME}:${IMAGE_TAG}`;

  try {
    // Login to Docker Hub (assumes already logged in or using credential store)
    console.log('   Pushing image...');
    execSync(`docker push ${imageFull}`, { stdio: 'inherit' });
    console.log(`\n✅ Image pushed: ${imageFull}`);
  } catch (error) {
    console.error('\n❌ Docker push failed');
    console.log('   Make sure you are logged in: docker login');
    throw error;
  }
}

// =============================================================================
// RunPod Deployment
// =============================================================================

async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch('https://api.runpod.io/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RUNPOD_API_KEY}`,
    },
    credentials: 'include',
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`RunPod API error: ${response.status}`);
  }

  const data = await response.json() as { data?: T; errors?: Array<{ message: string }> };

  if (data.errors) {
    throw new Error(data.errors[0]?.message || 'RunPod GraphQL error');
  }

  return data.data as T;
}

async function listEndpoints(): Promise<Array<{ id: string; name: string; templateId?: string }>> {
  const result = await graphql<{ myself: { endpoints: Array<{ id: string; name: string; templateId?: string }> } }>(`
    query {
      myself {
        endpoints {
          id
          name
          templateId
        }
      }
    }
  `);

  return result.myself.endpoints;
}

async function deleteEndpoint(endpointId: string): Promise<void> {
  // First set workers to 0
  try {
    await graphql(`
      mutation UpdateEndpoint($input: EndpointInput!) {
        saveEndpoint(input: $input) {
          id
        }
      }
    `, {
      input: {
        id: endpointId,
        workersMin: 0,
        workersMax: 0,
      },
    });
  } catch {
    // Ignore
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  await graphql(`
    mutation DeleteEndpoint($id: String!) {
      deleteEndpoint(id: $id)
    }
  `, { id: endpointId });
}

async function createTemplate(): Promise<string> {
  console.log('   📋 Creating serverless template...');

  const timestamp = Date.now();
  const templateName = `${ENDPOINT_CONFIG.name}-tpl-${timestamp}`;
  const imageFull = `${DOCKER_HUB_USERNAME}/${IMAGE_NAME}:${IMAGE_TAG}`;

  const result = await graphql<{ saveTemplate: { id: string } }>(`
    mutation SaveTemplate($input: SaveTemplateInput!) {
      saveTemplate(input: $input) {
        id
      }
    }
  `, {
    input: {
      name: templateName,
      imageName: imageFull,
      isServerless: true,
      containerDiskInGb: ENDPOINT_CONFIG.containerDiskInGb,
      volumeInGb: 0,
      dockerArgs: '',
      env: [],
      readme: ENDPOINT_CONFIG.description,
    },
  });

  console.log(`   ✅ Template created: ${result.saveTemplate.id}`);
  return result.saveTemplate.id;
}

async function createEndpoint(templateId: string): Promise<{ id: string; url: string }> {
  console.log(`\n📦 Creating endpoint: ${ENDPOINT_CONFIG.name}`);
  console.log(`   GPU: ${ENDPOINT_CONFIG.gpuType}`);
  console.log(`   Workers: ${ENDPOINT_CONFIG.minWorkers}-${ENDPOINT_CONFIG.maxWorkers}`);

  const gpuId = GPU_IDS[ENDPOINT_CONFIG.gpuType] || ENDPOINT_CONFIG.gpuType;

  const result = await graphql<{ saveEndpoint: { id: string } }>(`
    mutation CreateEndpoint($input: EndpointInput!) {
      saveEndpoint(input: $input) {
        id
      }
    }
  `, {
    input: {
      name: ENDPOINT_CONFIG.name,
      templateId: templateId,
      gpuIds: gpuId,
      idleTimeout: ENDPOINT_CONFIG.idleTimeout,
      scalerType: 'QUEUE_DELAY',
      scalerValue: 4,
      workersMin: ENDPOINT_CONFIG.minWorkers,
      workersMax: ENDPOINT_CONFIG.maxWorkers,
    },
  });

  const endpointId = result.saveEndpoint.id;
  const url = `https://api.runpod.ai/v2/${endpointId}`;

  console.log(`   ✅ Endpoint created!`);
  console.log(`   ID: ${endpointId}`);
  console.log(`   URL: ${url}`);

  return { id: endpointId, url };
}

async function deployToRunPod(): Promise<{ id: string; url: string }> {
  console.log('\n🚀 Deploying to RunPod Serverless...\n');

  // Check for existing endpoint
  console.log('   Checking existing endpoints...');
  const endpoints = await listEndpoints();
  const existing = endpoints.find(e => e.name === ENDPOINT_CONFIG.name);

  if (existing) {
    console.log(`   ⚠️  Found existing endpoint: ${existing.id}`);
    console.log('   Deleting and recreating...');
    await deleteEndpoint(existing.id);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Create template and endpoint
  const templateId = await createTemplate();
  const result = await createEndpoint(templateId);

  return result;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('═'.repeat(60));
  console.log('  KripTik FLUX UI Generator - RunPod Serverless Deployment');
  console.log('═'.repeat(60));
  console.log('');

  const args = process.argv.slice(2);
  const skipBuild = args.includes('--skip-build');
  const endpointOnly = args.includes('--endpoint-only');

  validateEnvironment();

  if (!endpointOnly) {
    if (!skipBuild) {
      await buildDockerImage();
    }
    await pushDockerImage();
  }

  const result = await deployToRunPod();

  // Output environment variables
  console.log('\n' + '═'.repeat(60));
  console.log('📝 Add these to your .env file:\n');
  console.log(`RUNPOD_UI_GENERATOR_ENDPOINT=${result.id}`);
  console.log(`RUNPOD_UI_GENERATOR_URL=https://api.runpod.ai/v2/${result.id}`);

  console.log('\n' + '═'.repeat(60));
  console.log('✅ Deployment complete!\n');
  console.log('Next steps:');
  console.log('1. Add environment variables to server/.env');
  console.log('2. Restart the server');
  console.log('3. Test UI generation in Design Mode');
  console.log('\nFirst request may take 30-60s (cold start).');
  console.log('Subsequent requests: ~10-15s.');
}

main().catch(error => {
  console.error('\n❌ Deployment failed:', error);
  process.exit(1);
});
