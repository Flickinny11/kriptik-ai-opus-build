/**
 * RunPod Serverless Deployment Script
 *
 * Deploys BGE-M3, SigLIP-2, and VL-JEPA to RunPod Serverless.
 * Run with: npx tsx deploy.ts
 *
 * Prerequisites:
 * 1. Docker images built and pushed to Docker Hub
 * 2. RUNPOD_API_KEY environment variable set
 */

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const DOCKER_HUB_USERNAME = process.env.DOCKER_HUB_USERNAME || 'kriptikai';

if (!RUNPOD_API_KEY) {
  console.error('❌ RUNPOD_API_KEY environment variable not set');
  process.exit(1);
}

interface EndpointConfig {
  name: string;
  dockerImage: string;
  gpuType: string;
  minWorkers: number;
  maxWorkers: number;
  idleTimeout: number;
  description: string;
}

const ENDPOINTS: EndpointConfig[] = [
  {
    name: 'kriptik-bge-m3-embeddings',
    dockerImage: `${DOCKER_HUB_USERNAME}/kriptik-bge-m3:latest`,
    gpuType: 'NVIDIA RTX A4000',  // 16GB VRAM, sufficient for BGE-M3
    minWorkers: 0,  // Scale to zero
    maxWorkers: 3,
    idleTimeout: 60,  // 60 seconds
    description: 'BGE-M3 embedding model (1024-dim) for text/intent embeddings',
  },
  {
    name: 'kriptik-siglip-embeddings',
    dockerImage: `${DOCKER_HUB_USERNAME}/kriptik-siglip:latest`,
    gpuType: 'NVIDIA RTX A4000',
    minWorkers: 0,
    maxWorkers: 3,
    idleTimeout: 60,
    description: 'SigLIP-2 model (1152-dim) for visual embeddings',
  },
  {
    name: 'kriptik-vl-jepa',
    dockerImage: `${DOCKER_HUB_USERNAME}/kriptik-vl-jepa:latest`,
    gpuType: 'NVIDIA A100 80GB PCIe',  // VL-JEPA is 1.6B params
    minWorkers: 0,
    maxWorkers: 2,
    idleTimeout: 120,
    description: 'VL-JEPA model (1024-dim) for vision-language joint embeddings',
  },
];

async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch('https://api.runpod.io/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RUNPOD_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`RunPod API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(data.errors[0]?.message || 'RunPod GraphQL error');
  }

  return data.data;
}

async function listEndpoints(): Promise<Array<{ id: string; name: string }>> {
  const result = await graphql<{ myself: { endpoints: Array<{ id: string; name: string }> } }>(`
    query {
      myself {
        endpoints {
          id
          name
        }
      }
    }
  `);

  return result.myself.endpoints;
}

async function createEndpoint(config: EndpointConfig): Promise<{ id: string; url: string }> {
  console.log(`\n📦 Creating endpoint: ${config.name}`);
  console.log(`   Docker image: ${config.dockerImage}`);
  console.log(`   GPU: ${config.gpuType}`);
  console.log(`   Workers: ${config.minWorkers}-${config.maxWorkers}`);

  const result = await graphql<{ saveEndpoint: { id: string } }>(`
    mutation CreateEndpoint($input: EndpointInput!) {
      saveEndpoint(input: $input) {
        id
      }
    }
  `, {
    input: {
      name: config.name,
      templateId: null,
      dockerImage: config.dockerImage,
      gpuIds: config.gpuType,
      idleTimeout: config.idleTimeout,
      scalerType: 'QUEUE_DELAY',
      scalerValue: 4,
      workersMin: config.minWorkers,
      workersMax: config.maxWorkers,
      env: [],
    },
  });

  const endpointId = result.saveEndpoint.id;
  const url = `https://api.runpod.ai/v2/${endpointId}/runsync`;

  console.log(`   ✅ Created! ID: ${endpointId}`);
  console.log(`   URL: ${url}`);

  return { id: endpointId, url };
}

async function deleteEndpoint(endpointId: string): Promise<void> {
  await graphql(`
    mutation DeleteEndpoint($id: String!) {
      deleteEndpoint(id: $id)
    }
  `, { id: endpointId });
}

async function deploy() {
  console.log('🚀 KripTik AI - RunPod Serverless Deployment\n');
  console.log('='.repeat(50));

  // Check existing endpoints
  console.log('\n📋 Checking existing endpoints...');
  const existing = await listEndpoints();
  console.log(`   Found ${existing.length} endpoints`);

  const deployedEndpoints: Record<string, { id: string; url: string }> = {};

  for (const config of ENDPOINTS) {
    // Check if endpoint already exists
    const existingEndpoint = existing.find(e => e.name === config.name);

    if (existingEndpoint) {
      console.log(`\n⚠️  Endpoint "${config.name}" already exists (ID: ${existingEndpoint.id})`);
      console.log('   Deleting and recreating...');
      await deleteEndpoint(existingEndpoint.id);
    }

    // Create new endpoint
    const result = await createEndpoint(config);
    deployedEndpoints[config.name] = result;
  }

  // Generate environment variable configuration
  console.log('\n\n' + '='.repeat(50));
  console.log('📝 Add these environment variables to your .env file:\n');

  console.log('# RunPod Embedding Endpoints');
  console.log(`RUNPOD_ENDPOINT_BGE_M3=${deployedEndpoints['kriptik-bge-m3-embeddings']?.id || ''}`);
  console.log(`RUNPOD_ENDPOINT_SIGLIP=${deployedEndpoints['kriptik-siglip-embeddings']?.id || ''}`);
  console.log(`RUNPOD_ENDPOINT_VL_JEPA=${deployedEndpoints['kriptik-vl-jepa']?.id || ''}`);

  console.log('\n# Full URLs');
  console.log(`RUNPOD_URL_BGE_M3=${deployedEndpoints['kriptik-bge-m3-embeddings']?.url || ''}`);
  console.log(`RUNPOD_URL_SIGLIP=${deployedEndpoints['kriptik-siglip-embeddings']?.url || ''}`);
  console.log(`RUNPOD_URL_VL_JEPA=${deployedEndpoints['kriptik-vl-jepa']?.url || ''}`);

  console.log('\n\n' + '='.repeat(50));
  console.log('✅ Deployment complete!\n');
  console.log('Next steps:');
  console.log('1. Build and push Docker images (see build-images.sh)');
  console.log('2. Add environment variables to your .env file');
  console.log('3. Restart the server');

  return deployedEndpoints;
}

// Run if called directly
if (process.argv[1].endsWith('deploy.ts')) {
  deploy().catch(console.error);
}

export { deploy, createEndpoint, listEndpoints, deleteEndpoint };
