/**
 * RunPod Deployer Service
 *
 * Deploys trained models to RunPod serverless endpoints.
 * Handles endpoint creation, status monitoring, and lifecycle management.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import type { ModelModality } from '../training/types.js';

// RunPod Provider interface (to avoid circular dependency)
class RunPodProvider {
  constructor(_apiKey: string) {}
}

// =============================================================================
// TYPES
// =============================================================================

export interface RunPodDeployConfig {
  userId: string;
  modelUrl: string;
  modelType: ModelModality;
  gpuType: string;
  modelName?: string;
  scalingConfig: {
    minWorkers: number;
    maxWorkers: number;
    idleTimeout: number;
  };
  environmentVariables?: Record<string, string>;
  containerImage?: string;
}

export interface RunPodDeployResult {
  endpointId: string;
  endpointUrl: string;
  status: string;
  templateId?: string;
  gpuType: string;
  scalingConfig: {
    minWorkers: number;
    maxWorkers: number;
  };
}

export interface RunPodEndpointStatus {
  status: 'scaling' | 'active' | 'idle' | 'error' | 'terminated';
  workers: number;
  queuedJobs: number;
  runningJobs: number;
  failedJobs: number;
  totalJobsCompleted: number;
}

// =============================================================================
// CONTAINER IMAGES
// =============================================================================

const DEFAULT_CONTAINER_IMAGES: Partial<Record<ModelModality, string>> = {
  'llm': 'runpod/worker-vllm:stable-cuda12.1.0',
  'image': 'runpod/worker-a1111:stable-cuda12.1.0',
  'video': 'runpod/worker-video-generation:stable',
  'audio': 'runpod/worker-whisper:latest',
};

// GPU mapping for RunPod
const RUNPOD_GPU_IDS: Record<string, string> = {
  'T4': 'NVIDIA T4',
  'L4': 'NVIDIA L4',
  'A10G': 'NVIDIA A10G',
  'RTX3090': 'NVIDIA GeForce RTX 3090',
  'RTX4090': 'NVIDIA GeForce RTX 4090',
  'A100-40GB': 'NVIDIA A100 40GB',
  'A100-80GB': 'NVIDIA A100 80GB',
  'H100': 'NVIDIA H100',
};

// =============================================================================
// RUNPOD DEPLOYER
// =============================================================================

export class RunPodDeployer {
  private runpodProvider: RunPodProvider | null = null;

  constructor(private apiKey?: string) {}

  /**
   * Initialize with API key
   */
  initialize(apiKey: string): void {
    this.apiKey = apiKey;
    this.runpodProvider = new RunPodProvider(apiKey);
  }

  /**
   * Deploy a model to RunPod serverless endpoint
   */
  async deployModel(config: RunPodDeployConfig): Promise<RunPodDeployResult> {
    if (!this.apiKey) {
      throw new Error('RunPod API key not configured');
    }

    const {
      modelUrl,
      modelType,
      gpuType,
      modelName,
      scalingConfig,
      environmentVariables,
      containerImage,
    } = config;

    // Get container image
    const image = containerImage || DEFAULT_CONTAINER_IMAGES[modelType] || 'runpod/worker-vllm:stable-cuda12.1.0';

    // Get GPU ID
    const gpuId = RUNPOD_GPU_IDS[gpuType] || gpuType;

    // Build environment variables
    const env: Record<string, string> = {
      MODEL_URL: modelUrl,
      MODEL_TYPE: modelType,
      ...environmentVariables,
    };

    // Create serverless endpoint via RunPod API
    // External API call to RunPod - no auth credentials needed
    const response = await fetch('https://api.runpod.io/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      credentials: 'omit', // External API call
      body: JSON.stringify({
        query: `
          mutation createEndpoint($input: EndpointInput!) {
            createEndpoint(input: $input) {
              id
              templateId
              name
              gpuIds
              idleTimeout
              scalerType
              scalerValue
              workersMin
              workersMax
            }
          }
        `,
        variables: {
          input: {
            name: modelName || `kriptik-${modelType}-${Date.now()}`,
            templateId: null, // Will use container directly
            gpuIds: gpuId,
            dockerImage: image,
            env: Object.entries(env).map(([key, value]) => ({ key, value })),
            idleTimeout: scalingConfig.idleTimeout,
            scalerType: 'QUEUE_DELAY',
            scalerValue: 4,
            workersMin: scalingConfig.minWorkers,
            workersMax: scalingConfig.maxWorkers,
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create RunPod endpoint: ${error}`);
    }

    const data = await response.json() as {
      data?: {
        createEndpoint?: {
          id: string;
          templateId?: string;
          workersMin: number;
          workersMax: number;
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (data.errors && data.errors.length > 0) {
      throw new Error(`RunPod API error: ${data.errors[0].message}`);
    }

    const endpoint = data.data?.createEndpoint;
    if (!endpoint) {
      throw new Error('Failed to create RunPod endpoint: No endpoint returned');
    }

    return {
      endpointId: endpoint.id,
      endpointUrl: `https://api.runpod.ai/v2/${endpoint.id}/runsync`,
      status: 'created',
      templateId: endpoint.templateId,
      gpuType,
      scalingConfig: {
        minWorkers: endpoint.workersMin,
        maxWorkers: endpoint.workersMax,
      },
    };
  }

  /**
   * Get endpoint status
   */
  async getEndpointStatus(endpointId: string): Promise<RunPodEndpointStatus> {
    if (!this.apiKey) {
      throw new Error('RunPod API key not configured');
    }

    // External API call to RunPod - no auth credentials needed
    const response = await fetch('https://api.runpod.io/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      credentials: 'omit', // External API call
      body: JSON.stringify({
        query: `
          query getEndpoint($id: String!) {
            endpoint(id: $id) {
              id
              name
              status
              workersRunning
              workersTotal
              queuedJobs
              runningJobs
              failedJobs
              completedJobs
            }
          }
        `,
        variables: { id: endpointId },
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get endpoint status');
    }

    const data = await response.json() as {
      data?: {
        endpoint?: {
          status: string;
          workersRunning: number;
          queuedJobs: number;
          runningJobs: number;
          failedJobs: number;
          completedJobs: number;
        };
      };
    };

    const endpoint = data.data?.endpoint;
    if (!endpoint) {
      throw new Error('Endpoint not found');
    }

    // Map status
    let status: RunPodEndpointStatus['status'];
    switch (endpoint.status) {
      case 'RUNNING':
        status = endpoint.workersRunning > 0 ? 'active' : 'idle';
        break;
      case 'SCALING':
        status = 'scaling';
        break;
      case 'ERROR':
        status = 'error';
        break;
      case 'TERMINATED':
        status = 'terminated';
        break;
      default:
        status = 'idle';
    }

    return {
      status,
      workers: endpoint.workersRunning,
      queuedJobs: endpoint.queuedJobs,
      runningJobs: endpoint.runningJobs,
      failedJobs: endpoint.failedJobs,
      totalJobsCompleted: endpoint.completedJobs,
    };
  }

  /**
   * Delete an endpoint
   */
  async deleteEndpoint(endpointId: string): Promise<void> {
    if (!this.apiKey) {
      throw new Error('RunPod API key not configured');
    }

    // External API call to RunPod - no auth credentials needed
    const response = await fetch('https://api.runpod.io/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      credentials: 'omit', // External API call
      body: JSON.stringify({
        query: `
          mutation deleteEndpoint($id: String!) {
            deleteEndpoint(id: $id)
          }
        `,
        variables: { id: endpointId },
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to delete endpoint');
    }
  }

  /**
   * Update endpoint scaling
   */
  async updateScaling(
    endpointId: string,
    minWorkers: number,
    maxWorkers: number
  ): Promise<void> {
    if (!this.apiKey) {
      throw new Error('RunPod API key not configured');
    }

    // External API call to RunPod - no auth credentials needed
    const response = await fetch('https://api.runpod.io/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      credentials: 'omit', // External API call
      body: JSON.stringify({
        query: `
          mutation updateEndpoint($id: String!, $input: EndpointInput!) {
            updateEndpoint(id: $id, input: $input) {
              id
              workersMin
              workersMax
            }
          }
        `,
        variables: {
          id: endpointId,
          input: {
            workersMin: minWorkers,
            workersMax: maxWorkers,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update endpoint scaling');
    }
  }

  /**
   * Generate inference code for the endpoint
   */
  generateInferenceCode(endpointId: string, modelType: ModelModality): {
    python: string;
    typescript: string;
    curl: string;
  } {
    const endpoint = `https://api.runpod.ai/v2/${endpointId}/runsync`;

    const inputExamples: Partial<Record<ModelModality, string>> = {
      'llm': '{"prompt": "Hello, how are you?", "max_tokens": 100}',
      'image': '{"prompt": "A beautiful sunset over mountains", "num_inference_steps": 30}',
      'video': '{"prompt": "A cat playing with a ball", "num_frames": 24}',
      'audio': '{"text": "Hello, this is a test.", "voice": "default"}',
    };

    const inputExample = inputExamples[modelType] || inputExamples['llm']!;

    return {
      python: `import requests

RUNPOD_API_KEY = "your-api-key"
ENDPOINT_URL = "${endpoint}"

response = requests.post(
    ENDPOINT_URL,
    headers={
        "Authorization": f"Bearer {RUNPOD_API_KEY}",
        "Content-Type": "application/json"
    },
    json={
        "input": ${inputExample}
    }
)

result = response.json()
print(result)`,

      // User-facing example code template - Server-side external API call (credentials: omit for external APIs)
      typescript: `const RUNPOD_API_KEY = "your-api-key";
const ENDPOINT_URL = "${endpoint}";

const response = await fetch(ENDPOINT_URL, {
  method: "POST",
  credentials: "omit", // External API - no browser cookies
  headers: {
    "Authorization": \`Bearer \${RUNPOD_API_KEY}\`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    input: ${inputExample}
  })
});

const result = await response.json();
console.log(result);`,

      curl: `curl -X POST "${endpoint}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"input": ${inputExample}}'`,
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let runpodDeployerInstance: RunPodDeployer | null = null;

export function getRunPodDeployer(): RunPodDeployer {
  if (!runpodDeployerInstance) {
    runpodDeployerInstance = new RunPodDeployer();
  }
  return runpodDeployerInstance;
}

export default RunPodDeployer;
