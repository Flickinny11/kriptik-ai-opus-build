/**
 * GPU Cloud Provisioner
 *
 * Unified interface for provisioning GPU resources across multiple providers:
 * - RunPod (pods and serverless)
 * - Vast.ai (marketplace GPUs)
 * - HuggingFace Inference Endpoints
 * - Docker Hub / Container Registries
 * - AWS ECS/Fargate
 *
 * @see https://docs.runpod.io/
 * @see https://docs.vast.ai/
 * @see https://huggingface.co/docs/inference-endpoints/
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

// ============================================
// TYPES - GPU RESOURCES
// ============================================

export type GPUType =
  | 'RTX3090'
  | 'RTX4090'
  | 'A100-40GB'
  | 'A100-80GB'
  | 'H100-PCIe'
  | 'H100-SXM'
  | 'H200'
  | 'L40S'
  | 'A10G'
  | 'T4';

export interface GPUSpec {
  type: GPUType;
  vram: number;        // GB
  cudaCores?: number;
  tensorCores?: number;
  fp16Tflops?: number;
  fp32Tflops?: number;
}

export const GPU_SPECS: Record<GPUType, GPUSpec> = {
  'RTX3090': { type: 'RTX3090', vram: 24, cudaCores: 10496, tensorCores: 328 },
  'RTX4090': { type: 'RTX4090', vram: 24, cudaCores: 16384, tensorCores: 512 },
  'A100-40GB': { type: 'A100-40GB', vram: 40, cudaCores: 6912, tensorCores: 432, fp16Tflops: 312 },
  'A100-80GB': { type: 'A100-80GB', vram: 80, cudaCores: 6912, tensorCores: 432, fp16Tflops: 312 },
  'H100-PCIe': { type: 'H100-PCIe', vram: 80, cudaCores: 14592, tensorCores: 456, fp16Tflops: 1513 },
  'H100-SXM': { type: 'H100-SXM', vram: 80, cudaCores: 14592, tensorCores: 456, fp16Tflops: 1979 },
  'H200': { type: 'H200', vram: 141, cudaCores: 14592, tensorCores: 456 },
  'L40S': { type: 'L40S', vram: 48, cudaCores: 18176, tensorCores: 568 },
  'A10G': { type: 'A10G', vram: 24, cudaCores: 9216, tensorCores: 288 },
  'T4': { type: 'T4', vram: 16, cudaCores: 2560, tensorCores: 320 },
};

export interface ProvisioningRequest {
  provider: 'runpod' | 'vastai' | 'huggingface' | 'aws';
  gpuType: GPUType;
  gpuCount: number;
  containerImage: string;
  volumeSize?: number;          // GB
  ports?: number[];
  envVars?: Record<string, string>;
  maxPricePerHour?: number;     // For marketplace providers
  region?: string;
  autoScale?: boolean;
  scaleToZero?: boolean;
}

export interface ProvisionedResource {
  id: string;
  provider: string;
  status: 'pending' | 'starting' | 'running' | 'stopping' | 'stopped' | 'failed';
  gpuType: GPUType;
  gpuCount: number;
  endpoint?: string;
  sshHost?: string;
  sshPort?: number;
  jupyterUrl?: string;
  costPerHour: number;
  createdAt: number;
  startedAt?: number;
  region?: string;
}

// ============================================
// RUNPOD PROVIDER
// @see https://docs.runpod.io/serverless/overview
// ============================================

interface RunPodConfig {
  apiKey: string;
  defaultRegion?: string;
}

interface RunPodPodRequest {
  cloudType: 'COMMUNITY' | 'SECURE';
  gpuTypeId: string;
  gpuCount: number;
  volumeInGb: number;
  containerDiskInGb: number;
  imageName: string;
  ports?: string;
  env?: Record<string, string>;
  name?: string;
  dataCenterId?: string;
}

interface RunPodServerlessRequest {
  name: string;
  imageName: string;
  gpuTypeId: string;
  gpuCount: number;
  minWorkers: number;
  maxWorkers: number;
  idleTimeout: number;
  scalerType: 'QUEUE_DELAY' | 'REQUEST_COUNT';
  scalerValue: number;
}

export class RunPodProvider extends EventEmitter {
  private apiKey: string;
  private baseUrl = 'https://api.runpod.io/graphql';
  private restUrl = 'https://rest.runpod.io/v1';

  constructor(config: RunPodConfig) {
    super();
    this.apiKey = config.apiKey;
  }

  private async graphqlRequest(query: string, variables?: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`RunPod API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (data.errors) {
      throw new Error(`RunPod GraphQL error: ${JSON.stringify(data.errors)}`);
    }

    return data.data;
  }

  private async restRequest(
    method: 'GET' | 'POST' | 'DELETE',
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<unknown> {
    const response = await fetch(`${this.restUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RunPod REST error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async getAvailableGpus(): Promise<Array<{ id: string; displayName: string; available: number; price: number }>> {
    const query = `
      query {
        gpuTypes {
          id
          displayName
          memoryInGb
          secureCloud
          communityCloud
          lowestPrice(input: { gpuCount: 1 })
        }
      }
    `;

    const data = await this.graphqlRequest(query) as { gpuTypes: Array<{
      id: string;
      displayName: string;
      memoryInGb: number;
      lowestPrice: { minimumBidPrice: number };
    }> };

    return data.gpuTypes.map(gpu => ({
      id: gpu.id,
      displayName: gpu.displayName,
      available: gpu.memoryInGb,
      price: gpu.lowestPrice?.minimumBidPrice || 0,
    }));
  }

  async createPod(request: ProvisioningRequest): Promise<ProvisionedResource> {
    const gpuTypeMap: Record<GPUType, string> = {
      'RTX3090': 'NVIDIA GeForce RTX 3090',
      'RTX4090': 'NVIDIA GeForce RTX 4090',
      'A100-40GB': 'NVIDIA A100-SXM4-40GB',
      'A100-80GB': 'NVIDIA A100 80GB PCIe',
      'H100-PCIe': 'NVIDIA H100 PCIe',
      'H100-SXM': 'NVIDIA H100 80GB HBM3',
      'H200': 'NVIDIA H200',
      'L40S': 'NVIDIA L40S',
      'A10G': 'NVIDIA A10G',
      'T4': 'NVIDIA T4',
    };

    const mutation = `
      mutation {
        podFindAndDeployOnDemand(
          input: {
            cloudType: SECURE
            gpuCount: ${request.gpuCount}
            volumeInGb: ${request.volumeSize || 50}
            containerDiskInGb: 20
            gpuTypeId: "${gpuTypeMap[request.gpuType]}"
            imageName: "${request.containerImage}"
            ports: "${(request.ports || [8080]).map(p => `${p}/http`).join(',')}"
            name: "kriptik-${Date.now()}"
            ${request.envVars ? `env: ${JSON.stringify(Object.entries(request.envVars).map(([k, v]) => ({ key: k, value: v })))}` : ''}
          }
        ) {
          id
          imageName
          desiredStatus
          costPerHr
          runtime {
            gpus {
              id
              gpuUtilPercent
              memoryUtilPercent
            }
            ports {
              ip
              isIpPublic
              privatePort
              publicPort
            }
          }
        }
      }
    `;

    const data = await this.graphqlRequest(mutation) as {
      podFindAndDeployOnDemand: {
        id: string;
        costPerHr: number;
        desiredStatus: string;
        runtime?: {
          ports?: Array<{ ip: string; publicPort: number }>;
        };
      };
    };

    const pod = data.podFindAndDeployOnDemand;

    return {
      id: pod.id,
      provider: 'runpod',
      status: pod.desiredStatus === 'RUNNING' ? 'running' : 'starting',
      gpuType: request.gpuType,
      gpuCount: request.gpuCount,
      endpoint: pod.runtime?.ports?.[0] ? `http://${pod.runtime.ports[0].ip}:${pod.runtime.ports[0].publicPort}` : undefined,
      costPerHour: pod.costPerHr,
      createdAt: Date.now(),
    };
  }

  async createServerlessEndpoint(request: ProvisioningRequest): Promise<ProvisionedResource> {
    const endpointData = await this.restRequest('POST', '/endpoints', {
      name: `kriptik-serverless-${Date.now()}`,
      templateId: null,
      dockerArgs: '',
      gpuIds: request.gpuType,
      networkVolumeId: null,
      locations: request.region,
      idleTimeout: 60,
      flashBoot: true,
      scalerType: 'QUEUE_DELAY',
      scalerValue: 4,
      workersMin: 0,
      workersMax: request.gpuCount,
    }) as { id: string; name: string };

    return {
      id: endpointData.id,
      provider: 'runpod-serverless',
      status: 'running',
      gpuType: request.gpuType,
      gpuCount: request.gpuCount,
      endpoint: `https://api.runpod.ai/v2/${endpointData.id}/runsync`,
      costPerHour: 0, // Serverless charges per second of use
      createdAt: Date.now(),
    };
  }

  async getPodStatus(podId: string): Promise<ProvisionedResource['status']> {
    const query = `
      query {
        pod(input: { podId: "${podId}" }) {
          id
          desiredStatus
          runtime {
            uptimeInSeconds
          }
        }
      }
    `;

    const data = await this.graphqlRequest(query) as {
      pod: { desiredStatus: string };
    };

    const statusMap: Record<string, ProvisionedResource['status']> = {
      'RUNNING': 'running',
      'STARTING': 'starting',
      'STOPPED': 'stopped',
      'STOPPING': 'stopping',
      'FAILED': 'failed',
    };

    return statusMap[data.pod.desiredStatus] || 'pending';
  }

  async stopPod(podId: string): Promise<void> {
    const mutation = `
      mutation {
        podStop(input: { podId: "${podId}" }) {
          id
          desiredStatus
        }
      }
    `;

    await this.graphqlRequest(mutation);
  }

  async deletePod(podId: string): Promise<void> {
    const mutation = `
      mutation {
        podTerminate(input: { podId: "${podId}" }) {
          id
        }
      }
    `;

    await this.graphqlRequest(mutation);
  }
}

// ============================================
// VAST.AI PROVIDER
// @see https://docs.vast.ai/
// ============================================

interface VastAIConfig {
  apiKey: string;
}

interface VastAIOffer {
  id: number;
  gpu_name: string;
  num_gpus: number;
  dph_total: number; // Dollars per hour
  cuda_max_good: number;
  disk_space: number;
  reliability: number;
  inet_up: number;
  inet_down: number;
  geolocation: string;
}

export class VastAIProvider extends EventEmitter {
  private apiKey: string;
  private baseUrl = 'https://console.vast.ai/api/v0';

  constructor(config: VastAIConfig) {
    super();
    this.apiKey = config.apiKey;
  }

  private async request(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vast.ai API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async searchOffers(request: ProvisioningRequest): Promise<VastAIOffer[]> {
    const gpuNameMap: Record<GPUType, string> = {
      'RTX3090': 'RTX 3090',
      'RTX4090': 'RTX 4090',
      'A100-40GB': 'A100',
      'A100-80GB': 'A100',
      'H100-PCIe': 'H100',
      'H100-SXM': 'H100',
      'H200': 'H200',
      'L40S': 'L40S',
      'A10G': 'A10',
      'T4': 'T4',
    };

    // Build query for offers
    const query = {
      verified: { eq: true },
      external: { eq: false },
      rentable: { eq: true },
      gpu_name: { eq: gpuNameMap[request.gpuType] },
      num_gpus: { gte: request.gpuCount },
      disk_space: { gte: request.volumeSize || 50 },
      order: [['dph_total', 'asc']], // Sort by price ascending
      type: 'on-demand',
    };

    const data = await this.request('GET', `/bundles?q=${encodeURIComponent(JSON.stringify(query))}`) as {
      offers: VastAIOffer[];
    };

    // Filter by max price if specified
    let offers = data.offers;
    if (request.maxPricePerHour) {
      offers = offers.filter(o => o.dph_total <= request.maxPricePerHour!);
    }

    return offers;
  }

  async createInstance(offerId: number, request: ProvisioningRequest): Promise<ProvisionedResource> {
    const instanceData = await this.request('PUT', `/asks/${offerId}/`, {
      client_id: 'kriptik-ai',
      image: request.containerImage,
      disk: request.volumeSize || 50,
      onstart: null,
      runtype: 'jupyter',
      env: request.envVars ? Object.entries(request.envVars).map(([k, v]) => `-e ${k}=${v}`).join(' ') : '',
    }) as {
      new_contract: number;
      success: boolean;
    };

    if (!instanceData.success) {
      throw new Error('Failed to create Vast.ai instance');
    }

    // Get instance details
    const instance = await this.getInstance(instanceData.new_contract);

    return {
      id: instanceData.new_contract.toString(),
      provider: 'vastai',
      status: 'starting',
      gpuType: request.gpuType,
      gpuCount: request.gpuCount,
      costPerHour: instance.dph_total,
      createdAt: Date.now(),
      sshHost: instance.public_ipaddr,
      sshPort: instance.ssh_port,
      jupyterUrl: instance.jupyter_url,
    };
  }

  async getInstance(instanceId: number): Promise<{
    id: number;
    cur_state: string;
    dph_total: number;
    public_ipaddr?: string;
    ssh_port?: number;
    jupyter_url?: string;
  }> {
    const data = await this.request('GET', `/instances/${instanceId}`) as {
      instances: Array<{
        id: number;
        cur_state: string;
        dph_total: number;
        public_ipaddr?: string;
        ssh_port?: number;
        jupyter_url?: string;
      }>;
    };

    return data.instances[0];
  }

  async stopInstance(instanceId: number): Promise<void> {
    await this.request('PUT', `/instances/${instanceId}/`, {
      state: 'stopped',
    });
  }

  async deleteInstance(instanceId: number): Promise<void> {
    await this.request('DELETE', `/instances/${instanceId}/`);
  }
}

// ============================================
// HUGGINGFACE INFERENCE ENDPOINTS
// @see https://huggingface.co/docs/inference-endpoints/
// ============================================

interface HuggingFaceConfig {
  token: string;
  namespace?: string;
}

interface HFEndpointRequest {
  name: string;
  model: string;
  framework: 'pytorch' | 'transformers' | 'vllm' | 'tgi' | 'custom';
  accelerator: 'cpu' | 'gpu';
  instanceType: string;
  instanceSize: string;
  minReplicas: number;
  maxReplicas: number;
  region: string;
}

export class HuggingFaceProvider extends EventEmitter {
  private token: string;
  private namespace: string;
  private baseUrl = 'https://api.endpoints.huggingface.cloud/v2';

  constructor(config: HuggingFaceConfig) {
    super();
    this.token = config.token;
    this.namespace = config.namespace || 'default';
  }

  private async request(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HuggingFace API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async createEndpoint(modelId: string, request: Partial<HFEndpointRequest>): Promise<ProvisionedResource> {
    const endpointName = request.name || `kriptik-${modelId.split('/').pop()}-${Date.now()}`;

    const instanceTypeMap: Record<GPUType, string> = {
      'RTX3090': 'nvidia-l4',
      'RTX4090': 'nvidia-l4',
      'A100-40GB': 'nvidia-a100',
      'A100-80GB': 'nvidia-a100',
      'H100-PCIe': 'nvidia-h100',
      'H100-SXM': 'nvidia-h100',
      'H200': 'nvidia-h100',
      'L40S': 'nvidia-l40s',
      'A10G': 'nvidia-a10g',
      'T4': 'nvidia-t4',
    };

    const data = await this.request('POST', `/endpoint/${this.namespace}`, {
      name: endpointName,
      repository: modelId,
      framework: request.framework || 'pytorch',
      accelerator: 'gpu',
      instance_type: request.instanceType || 'nvidia-a10g',
      instance_size: request.instanceSize || 'x1',
      min_replica: request.minReplicas || 0,
      max_replica: request.maxReplicas || 1,
      region: request.region || 'us-east-1',
      vendor: 'aws',
      type: 'protected',
      task: 'text-generation',
    }) as {
      name: string;
      status: { state: string };
      model: { repository: string };
      compute: {
        instanceType: string;
        instanceSize: string;
        accelerator: string;
      };
      provider: { vendor: string; region: string };
    };

    return {
      id: data.name,
      provider: 'huggingface',
      status: data.status.state === 'running' ? 'running' : 'starting',
      gpuType: 'A10G', // Default
      gpuCount: 1,
      endpoint: `https://api-inference.huggingface.co/models/${modelId}`,
      costPerHour: this.estimateCost(data.compute.instanceType, data.compute.instanceSize),
      createdAt: Date.now(),
      region: data.provider.region,
    };
  }

  async getEndpoint(name: string): Promise<{
    name: string;
    status: { state: string };
    url?: string;
  }> {
    const data = await this.request('GET', `/endpoint/${this.namespace}/${name}`) as {
      name: string;
      status: { state: string; url?: string };
    };

    return {
      name: data.name,
      status: data.status,
      url: data.status.url,
    };
  }

  async deleteEndpoint(name: string): Promise<void> {
    await this.request('DELETE', `/endpoint/${this.namespace}/${name}`);
  }

  async scaleEndpoint(name: string, minReplicas: number, maxReplicas: number): Promise<void> {
    await this.request('PUT', `/endpoint/${this.namespace}/${name}`, {
      min_replica: minReplicas,
      max_replica: maxReplicas,
    });
  }

  private estimateCost(instanceType: string, instanceSize: string): number {
    // Rough cost estimates per hour
    const baseCosts: Record<string, number> = {
      'nvidia-t4': 0.50,
      'nvidia-a10g': 1.50,
      'nvidia-l4': 0.80,
      'nvidia-a100': 4.00,
      'nvidia-h100': 8.00,
    };

    const sizeMultipliers: Record<string, number> = {
      'x1': 1,
      'x2': 2,
      'x4': 4,
      'x8': 8,
    };

    return (baseCosts[instanceType] || 2.0) * (sizeMultipliers[instanceSize] || 1);
  }
}

// ============================================
// DOCKER HUB / CONTAINER REGISTRY
// ============================================

interface DockerHubConfig {
  username: string;
  password: string;
  namespace?: string;
}

export class DockerHubProvider extends EventEmitter {
  private username: string;
  private password: string;
  private namespace: string;
  private token: string | null = null;
  private baseUrl = 'https://hub.docker.com/v2';

  constructor(config: DockerHubConfig) {
    super();
    this.username = config.username;
    this.password = config.password;
    this.namespace = config.namespace || config.username;
  }

  private async authenticate(): Promise<string> {
    if (this.token) {
      return this.token;
    }

    const response = await fetch(`${this.baseUrl}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
      }),
    });

    if (!response.ok) {
      throw new Error('Docker Hub authentication failed');
    }

    const data = await response.json() as { token: string };
    this.token = data.token;
    return this.token;
  }

  private async request(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<unknown> {
    const token = await this.authenticate();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Docker Hub API error: ${response.status} - ${errorText}`);
    }

    if (response.status === 204) {
      return {};
    }

    return response.json();
  }

  async listRepositories(): Promise<Array<{
    name: string;
    namespace: string;
    description: string;
    pullCount: number;
    lastUpdated: string;
  }>> {
    const data = await this.request('GET', `/repositories/${this.namespace}/?page_size=100`) as {
      results: Array<{
        name: string;
        namespace: string;
        description: string;
        pull_count: number;
        last_updated: string;
      }>;
    };

    return data.results.map(repo => ({
      name: repo.name,
      namespace: repo.namespace,
      description: repo.description,
      pullCount: repo.pull_count,
      lastUpdated: repo.last_updated,
    }));
  }

  async createRepository(name: string, description: string, isPrivate: boolean = false): Promise<{
    namespace: string;
    name: string;
    fullName: string;
  }> {
    const data = await this.request('POST', `/repositories/${this.namespace}/`, {
      namespace: this.namespace,
      name,
      description,
      is_private: isPrivate,
    }) as {
      namespace: string;
      name: string;
    };

    return {
      namespace: data.namespace,
      name: data.name,
      fullName: `${data.namespace}/${data.name}`,
    };
  }

  async getImageTags(repository: string): Promise<Array<{
    name: string;
    digest: string;
    lastUpdated: string;
    size: number;
  }>> {
    const data = await this.request('GET', `/repositories/${this.namespace}/${repository}/tags?page_size=100`) as {
      results: Array<{
        name: string;
        digest: string;
        last_updated: string;
        full_size: number;
      }>;
    };

    return data.results.map(tag => ({
      name: tag.name,
      digest: tag.digest,
      lastUpdated: tag.last_updated,
      size: tag.full_size,
    }));
  }

  async deleteTag(repository: string, tag: string): Promise<void> {
    await this.request('DELETE', `/repositories/${this.namespace}/${repository}/tags/${tag}/`);
  }

  getImageUri(repository: string, tag: string = 'latest'): string {
    return `${this.namespace}/${repository}:${tag}`;
  }
}

// ============================================
// UNIFIED GPU CLOUD PROVISIONER
// ============================================

export interface GPUCloudConfig {
  runpod?: RunPodConfig;
  vastai?: VastAIConfig;
  huggingface?: HuggingFaceConfig;
  dockerhub?: DockerHubConfig;
  defaultProvider?: 'runpod' | 'vastai' | 'huggingface';
}

export class GPUCloudProvisioner extends EventEmitter {
  private runpod: RunPodProvider | null = null;
  private vastai: VastAIProvider | null = null;
  private huggingface: HuggingFaceProvider | null = null;
  private dockerhub: DockerHubProvider | null = null;
  private defaultProvider: 'runpod' | 'vastai' | 'huggingface';
  private provisionedResources: Map<string, ProvisionedResource> = new Map();

  constructor(config: GPUCloudConfig) {
    super();

    if (config.runpod) {
      this.runpod = new RunPodProvider(config.runpod);
    }
    if (config.vastai) {
      this.vastai = new VastAIProvider(config.vastai);
    }
    if (config.huggingface) {
      this.huggingface = new HuggingFaceProvider(config.huggingface);
    }
    if (config.dockerhub) {
      this.dockerhub = new DockerHubProvider(config.dockerhub);
    }

    this.defaultProvider = config.defaultProvider || 'runpod';
  }

  async provision(request: ProvisioningRequest): Promise<ProvisionedResource> {
    let resource: ProvisionedResource;

    switch (request.provider) {
      case 'runpod':
        if (!this.runpod) throw new Error('RunPod provider not configured');
        resource = request.autoScale
          ? await this.runpod.createServerlessEndpoint(request)
          : await this.runpod.createPod(request);
        break;

      case 'vastai':
        if (!this.vastai) throw new Error('Vast.ai provider not configured');
        const offers = await this.vastai.searchOffers(request);
        if (offers.length === 0) {
          throw new Error(`No Vast.ai offers found for ${request.gpuType}`);
        }
        resource = await this.vastai.createInstance(offers[0].id, request);
        break;

      case 'huggingface':
        if (!this.huggingface) throw new Error('HuggingFace provider not configured');
        // HuggingFace requires a model ID in the container image field
        resource = await this.huggingface.createEndpoint(request.containerImage, {
          minReplicas: request.scaleToZero ? 0 : 1,
          maxReplicas: request.gpuCount,
          region: request.region,
        });
        break;

      default:
        throw new Error(`Unknown provider: ${request.provider}`);
    }

    this.provisionedResources.set(resource.id, resource);
    this.emit('resource_provisioned', resource);

    return resource;
  }

  async deprovision(resourceId: string): Promise<void> {
    const resource = this.provisionedResources.get(resourceId);
    if (!resource) {
      throw new Error(`Resource ${resourceId} not found`);
    }

    switch (resource.provider) {
      case 'runpod':
      case 'runpod-serverless':
        if (!this.runpod) throw new Error('RunPod provider not configured');
        await this.runpod.deletePod(resourceId);
        break;

      case 'vastai':
        if (!this.vastai) throw new Error('Vast.ai provider not configured');
        await this.vastai.deleteInstance(parseInt(resourceId));
        break;

      case 'huggingface':
        if (!this.huggingface) throw new Error('HuggingFace provider not configured');
        await this.huggingface.deleteEndpoint(resourceId);
        break;
    }

    this.provisionedResources.delete(resourceId);
    this.emit('resource_deprovisioned', { resourceId });
  }

  async getStatus(resourceId: string): Promise<ProvisionedResource['status']> {
    const resource = this.provisionedResources.get(resourceId);
    if (!resource) {
      throw new Error(`Resource ${resourceId} not found`);
    }

    switch (resource.provider) {
      case 'runpod':
        if (!this.runpod) throw new Error('RunPod provider not configured');
        return this.runpod.getPodStatus(resourceId);

      case 'vastai':
        if (!this.vastai) throw new Error('Vast.ai provider not configured');
        const instance = await this.vastai.getInstance(parseInt(resourceId));
        const stateMap: Record<string, ProvisionedResource['status']> = {
          'running': 'running',
          'starting': 'starting',
          'stopped': 'stopped',
          'stopping': 'stopping',
        };
        return stateMap[instance.cur_state] || 'pending';

      case 'huggingface':
        if (!this.huggingface) throw new Error('HuggingFace provider not configured');
        const endpoint = await this.huggingface.getEndpoint(resourceId);
        return endpoint.status.state === 'running' ? 'running' : 'starting';

      default:
        return 'pending';
    }
  }

  async findCheapestGpu(
    gpuType: GPUType,
    gpuCount: number = 1
  ): Promise<{ provider: string; pricePerHour: number; available: boolean }[]> {
    const results: { provider: string; pricePerHour: number; available: boolean }[] = [];

    // Check RunPod
    if (this.runpod) {
      try {
        const gpus = await this.runpod.getAvailableGpus();
        const matching = gpus.find(g => g.displayName.includes(gpuType));
        if (matching) {
          results.push({
            provider: 'runpod',
            pricePerHour: matching.price,
            available: true,
          });
        }
      } catch (error) {
        console.warn('Failed to fetch RunPod prices:', error);
      }
    }

    // Check Vast.ai
    if (this.vastai) {
      try {
        const offers = await this.vastai.searchOffers({
          provider: 'vastai',
          gpuType,
          gpuCount,
          containerImage: 'pytorch/pytorch:latest',
        });
        if (offers.length > 0) {
          results.push({
            provider: 'vastai',
            pricePerHour: offers[0].dph_total,
            available: true,
          });
        }
      } catch (error) {
        console.warn('Failed to fetch Vast.ai prices:', error);
      }
    }

    // Sort by price
    results.sort((a, b) => a.pricePerHour - b.pricePerHour);

    return results;
  }

  listProvisionedResources(): ProvisionedResource[] {
    return [...this.provisionedResources.values()];
  }
}

// Export types and classes
export default GPUCloudProvisioner;
