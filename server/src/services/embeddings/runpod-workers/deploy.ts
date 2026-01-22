/**
 * RunPod Serverless Deployment Script
 *
 * Deploys BGE-M3, SigLIP-2, VL-JEPA, and V-JEPA 2 to RunPod Serverless.
 * Run with: npx tsx deploy.ts
 *
 * Prerequisites:
 * 1. Docker images built and pushed to Docker Hub
 * 2. RUNPOD_API_KEY environment variable set
 *
 * RunPod API Flow:
 * 1. Create serverless template with saveTemplate (isServerless: true)
 * 2. Create endpoint with saveEndpoint using the template ID
 */

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const DOCKER_HUB_USERNAME = process.env.DOCKER_HUB_USERNAME || 'alledged1982';
const HF_TOKEN = process.env.HF_TOKEN || '';
const IMAGE_TAG = 'v4-safetensors';  // Uses safetensors to bypass CVE-2025-32434

if (!RUNPOD_API_KEY) {
  console.error('❌ RUNPOD_API_KEY environment variable not set');
  process.exit(1);
}

// RunPod GPU ID mapping
const GPU_IDS: Record<string, string> = {
  'NVIDIA RTX A4000': 'AMPERE_16',    // 16GB VRAM
  'NVIDIA RTX A5000': 'AMPERE_24',    // 24GB VRAM
  'NVIDIA RTX A6000': 'AMPERE_48',    // 48GB VRAM
  'NVIDIA A100': 'AMPERE_80',         // 80GB VRAM
  'NVIDIA L4': 'ADA_24',              // 24GB VRAM
  'NVIDIA L40': 'ADA_48_PRO',         // 48GB VRAM
};

interface EndpointConfig {
  name: string;
  dockerImage: string;
  gpuType: string;
  minWorkers: number;
  maxWorkers: number;
  idleTimeout: number;
  description: string;
  env?: Array<{ key: string; value: string }>;
  containerDiskInGb?: number;
}

const ENDPOINTS: EndpointConfig[] = [
  {
    name: 'kriptik-bge-m3-embeddings',
    dockerImage: `${DOCKER_HUB_USERNAME}/kriptik-bge-m3:${IMAGE_TAG}`,
    gpuType: 'NVIDIA RTX A4000',
    minWorkers: 0,
    maxWorkers: 3,
    idleTimeout: 60,
    description: 'BGE-M3 embedding model (1024-dim) for text/intent embeddings',
    containerDiskInGb: 20,
  },
  {
    name: 'kriptik-siglip-embeddings',
    dockerImage: `${DOCKER_HUB_USERNAME}/kriptik-siglip:${IMAGE_TAG}`,
    gpuType: 'NVIDIA RTX A4000',
    minWorkers: 0,
    maxWorkers: 3,
    idleTimeout: 60,
    description: 'SigLIP-2 model (1152-dim) for visual embeddings',
    containerDiskInGb: 20,
  },
  {
    name: 'kriptik-vl-jepa',
    dockerImage: `${DOCKER_HUB_USERNAME}/kriptik-vl-jepa:${IMAGE_TAG}`,
    gpuType: 'NVIDIA RTX A4000',
    minWorkers: 0,
    maxWorkers: 2,
    idleTimeout: 120,
    description: 'VL-JEPA/SigLIP model (1024-dim) for vision-language joint embeddings',
    containerDiskInGb: 25,
  },
  {
    name: 'kriptik-vjepa2-temporal',
    dockerImage: `${DOCKER_HUB_USERNAME}/kriptik-vjepa2:${IMAGE_TAG}`,
    gpuType: 'NVIDIA RTX A5000',
    minWorkers: 0,
    maxWorkers: 1,  // Limited to 1 due to RunPod worker quota
    idleTimeout: 180,
    description: 'V-JEPA 2 model (1024-dim) for temporal video understanding - Fix My App, Clone Mode',
    env: HF_TOKEN ? [{ key: 'HF_TOKEN', value: HF_TOKEN }] : [],
    containerDiskInGb: 30,
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

async function listTemplates(): Promise<Array<{ id: string; name: string }>> {
  const result = await graphql<{ myself: { podTemplates: Array<{ id: string; name: string }> } }>(`
    query {
      myself {
        podTemplates {
          id
          name
        }
      }
    }
  `);

  return result.myself.podTemplates || [];
}

async function createTemplate(config: EndpointConfig): Promise<string> {
  console.log(`   📋 Creating serverless template...`);

  // Add timestamp to ensure unique template name (RunPod templates can take time to fully delete)
  const timestamp = Date.now();
  const templateName = `${config.name}-tpl-${timestamp}`;

  const result = await graphql<{ saveTemplate: { id: string } }>(`
    mutation SaveTemplate($input: SaveTemplateInput!) {
      saveTemplate(input: $input) {
        id
      }
    }
  `, {
    input: {
      name: templateName,
      imageName: config.dockerImage,
      isServerless: true,
      containerDiskInGb: config.containerDiskInGb || 20,
      volumeInGb: 0,
      dockerArgs: '',
      env: config.env || [],
      readme: config.description,
    },
  });

  console.log(`   ✅ Template created: ${result.saveTemplate.id}`);
  return result.saveTemplate.id;
}

async function deleteTemplate(templateId: string): Promise<void> {
  try {
    await graphql(`
      mutation DeleteTemplate($id: String!) {
        deleteTemplate(templateId: $id)
      }
    `, { id: templateId });
  } catch {
    // Template might be in use, ignore
  }
}

async function createEndpoint(config: EndpointConfig, templateId: string): Promise<{ id: string; url: string }> {
  console.log(`\n📦 Creating endpoint: ${config.name}`);
  console.log(`   Docker image: ${config.dockerImage}`);
  console.log(`   GPU: ${config.gpuType} (${GPU_IDS[config.gpuType] || config.gpuType})`);
  console.log(`   Workers: ${config.minWorkers}-${config.maxWorkers}`);

  const gpuId = GPU_IDS[config.gpuType] || config.gpuType;

  const result = await graphql<{ saveEndpoint: { id: string } }>(`
    mutation CreateEndpoint($input: EndpointInput!) {
      saveEndpoint(input: $input) {
        id
      }
    }
  `, {
    input: {
      name: config.name,
      templateId: templateId,
      gpuIds: gpuId,
      idleTimeout: config.idleTimeout,
      scalerType: 'QUEUE_DELAY',
      scalerValue: 4,
      workersMin: config.minWorkers,
      workersMax: config.maxWorkers,
    },
  });

  const endpointId = result.saveEndpoint.id;
  const url = `https://api.runpod.ai/v2/${endpointId}/runsync`;

  console.log(`   ✅ Endpoint created! ID: ${endpointId}`);
  console.log(`   URL: ${url}`);

  return { id: endpointId, url };
}

async function deleteEndpoint(endpointId: string): Promise<void> {
  // First set workers to 0 (required before deletion)
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
    // Ignore errors
  }

  // Wait a moment for workers to scale down
  await new Promise(resolve => setTimeout(resolve, 2000));

  await graphql(`
    mutation DeleteEndpoint($id: String!) {
      deleteEndpoint(id: $id)
    }
  `, { id: endpointId });
}

async function deploy() {
  console.log('🚀 KripTik AI - RunPod Serverless Deployment\n');
  console.log('='.repeat(50));

  // Check existing endpoints and templates
  console.log('\n📋 Checking existing resources...');
  const existingEndpoints = await listEndpoints();
  const existingTemplates = await listTemplates();
  console.log(`   Found ${existingEndpoints.length} endpoints, ${existingTemplates.length} templates`);

  const deployedEndpoints: Record<string, { id: string; url: string }> = {};

  for (const config of ENDPOINTS) {
    // Check if endpoint already exists
    const existingEndpoint = existingEndpoints.find(e => e.name === config.name);
    const templateName = `${config.name}-template`;
    const existingTemplate = existingTemplates.find(t => t.name === templateName);

    if (existingEndpoint) {
      console.log(`\n⚠️  Endpoint "${config.name}" already exists (ID: ${existingEndpoint.id})`);
      console.log('   Deleting and recreating...');
      await deleteEndpoint(existingEndpoint.id);
    }

    if (existingTemplate) {
      console.log(`   Deleting old template: ${existingTemplate.id}`);
      await deleteTemplate(existingTemplate.id);
      // Wait for template to be fully deleted
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Create template first, then endpoint
    const templateId = await createTemplate(config);
    const result = await createEndpoint(config, templateId);
    deployedEndpoints[config.name] = result;
  }

  // Generate environment variable configuration
  console.log('\n\n' + '='.repeat(50));
  console.log('📝 Add these environment variables to your .env file:\n');

  console.log('# RunPod Embedding Endpoints');
  console.log(`RUNPOD_ENDPOINT_BGE_M3=${deployedEndpoints['kriptik-bge-m3-embeddings']?.id || ''}`);
  console.log(`RUNPOD_ENDPOINT_SIGLIP=${deployedEndpoints['kriptik-siglip-embeddings']?.id || ''}`);
  console.log(`RUNPOD_ENDPOINT_VL_JEPA=${deployedEndpoints['kriptik-vl-jepa']?.id || ''}`);
  console.log(`RUNPOD_ENDPOINT_VJEPA2=${deployedEndpoints['kriptik-vjepa2-temporal']?.id || ''}`);

  console.log('\n# Full URLs');
  console.log(`RUNPOD_URL_BGE_M3=${deployedEndpoints['kriptik-bge-m3-embeddings']?.url || ''}`);
  console.log(`RUNPOD_URL_SIGLIP=${deployedEndpoints['kriptik-siglip-embeddings']?.url || ''}`);
  console.log(`RUNPOD_URL_VL_JEPA=${deployedEndpoints['kriptik-vl-jepa']?.url || ''}`);
  console.log(`RUNPOD_URL_VJEPA2=${deployedEndpoints['kriptik-vjepa2-temporal']?.url || ''}`);

  console.log('\n\n' + '='.repeat(50));
  console.log('✅ Deployment complete!\n');
  console.log('Next steps:');
  console.log('1. Add environment variables to your .env file');
  console.log('2. Restart the server');
  console.log('3. Test endpoints with test-endpoints.ts');

  return deployedEndpoints;
}

// Deploy only V-JEPA 2 (for targeted deployment)
async function deployVJEPA2Only() {
  console.log('🚀 KripTik AI - V-JEPA 2 Deployment\n');
  console.log('='.repeat(50));

  const config = ENDPOINTS.find(e => e.name === 'kriptik-vjepa2-temporal');
  if (!config) {
    console.error('❌ V-JEPA 2 config not found');
    process.exit(1);
  }

  // Check existing
  console.log('\n📋 Checking existing resources...');
  const existingEndpoints = await listEndpoints();
  const existingTemplates = await listTemplates();

  const existingEndpoint = existingEndpoints.find(e => e.name === config.name);
  const templateName = `${config.name}-template`;
  const existingTemplate = existingTemplates.find(t => t.name === templateName);

  if (existingEndpoint) {
    console.log(`\n⚠️  Endpoint "${config.name}" already exists (ID: ${existingEndpoint.id})`);
    console.log('   Deleting...');
    await deleteEndpoint(existingEndpoint.id);
  }

  if (existingTemplate) {
    console.log(`   Deleting old template: ${existingTemplate.id}`);
    await deleteTemplate(existingTemplate.id);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Create template and endpoint
  const templateId = await createTemplate(config);
  const result = await createEndpoint(config, templateId);

  console.log('\n\n' + '='.repeat(50));
  console.log('📝 V-JEPA 2 Endpoint:\n');
  console.log(`RUNPOD_ENDPOINT_VJEPA2=${result.id}`);
  console.log(`RUNPOD_URL_VJEPA2=${result.url}`);
  console.log('\n✅ V-JEPA 2 deployment complete!');

  return result;
}

// Run if called directly
if (process.argv[1].endsWith('deploy.ts')) {
  const deployVjepa2 = process.argv.includes('--vjepa2');

  if (deployVjepa2) {
    deployVJEPA2Only().catch(console.error);
  } else {
    deploy().catch(console.error);
  }
}

export { deploy, deployVJEPA2Only, createEndpoint, createTemplate, listEndpoints, listTemplates, deleteEndpoint, deleteTemplate };
