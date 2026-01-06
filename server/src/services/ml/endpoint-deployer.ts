/**
 * Endpoint Deployer Service
 * 
 * Manages deployment and lifecycle of inference endpoints on RunPod.
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 5).
 */

import { db } from '../../db.js';
import { deployedEndpoints } from '../../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { RunPodProvider, createRunPodProvider } from '../cloud/runpod.js';
import { HuggingFaceService } from './huggingface.js';
import { getCredentialVault } from '../security/credential-vault.js';

// =============================================================================
// TYPES
// =============================================================================

export interface DeploymentConfig {
  modelId: string;
  modelName: string;
  gpuType: string;
  minWorkers: number;
  maxWorkers: number;
  idleTimeout: number;
  customEnvVars: Record<string, string>;
  volumePersistence: boolean;
  volumeSizeGB: number;
}

export interface EndpointInfo {
  id: string;
  userId: string;
  modelId: string;
  modelName: string;
  status: string;
  endpointUrl: string;
  gpuType: string;
  minWorkers: number;
  maxWorkers: number;
  currentWorkers: number;
  totalRequests: number;
  avgLatencyMs: number;
  costToday: number;
  costTotal: number;
  createdAt: string;
  lastActiveAt: string;
  testWindowEndsAt: string | null;
  runpodEndpointId: string | null;
}

export interface TestResult {
  success: boolean;
  latencyMs: number;
  output?: string;
  error?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// =============================================================================
// GPU TYPE MAPPING
// =============================================================================

const GPU_TYPE_MAP: Record<string, string> = {
  'nvidia-rtx-3090': 'NVIDIA GeForce RTX 3090',
  'nvidia-rtx-4090': 'NVIDIA GeForce RTX 4090',
  'nvidia-a40': 'NVIDIA A40',
  'nvidia-l40': 'NVIDIA L40',
  'nvidia-a100-40gb': 'NVIDIA A100 40GB PCIe',
  'nvidia-a100-80gb': 'NVIDIA A100 80GB PCIe',
  'nvidia-h100': 'NVIDIA H100 80GB HBM3',
};

const GPU_VRAM_MAP: Record<string, number> = {
  'nvidia-rtx-3090': 24,
  'nvidia-rtx-4090': 24,
  'nvidia-a40': 48,
  'nvidia-l40': 48,
  'nvidia-a100-40gb': 40,
  'nvidia-a100-80gb': 80,
  'nvidia-h100': 80,
};

// =============================================================================
// SERVICE
// =============================================================================

export class EndpointDeployerService {
  private runpodProvider: RunPodProvider | null = null;
  private huggingFaceService: HuggingFaceService;

  constructor() {
    this.huggingFaceService = new HuggingFaceService();
  }

  /**
   * Initialize RunPod provider for a user
   */
  private async initializeRunPod(userId: string): Promise<RunPodProvider> {
    const vault = getCredentialVault();
    const runpodCredential = await vault.getCredential(userId, 'runpod');
    
    if (!runpodCredential || !runpodCredential.oauthAccessToken) {
      throw new Error('RunPod API key not configured. Please add your RunPod API key in settings.');
    }

    return createRunPodProvider(runpodCredential.oauthAccessToken);
  }

  /**
   * Deploy a new inference endpoint
   */
  async deployEndpoint(
    userId: string,
    projectId: string,
    config: DeploymentConfig
  ): Promise<EndpointInfo> {
    const runpod = await this.initializeRunPod(userId);

    // Verify model exists on HuggingFace
    try {
      await this.huggingFaceService.getModel(config.modelId);
    } catch {
      throw new Error(`Model not found: ${config.modelId}`);
    }

    // Create endpoint ID
    const endpointId = crypto.randomUUID();
    
    // Calculate test window end time (30 minutes)
    const testWindowEndsAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // Map GPU type to RunPod GPU name
    const gpuName = GPU_TYPE_MAP[config.gpuType] || config.gpuType;

    try {
      // Deploy to RunPod as serverless endpoint
      const deployment = await runpod.deploy({
        provider: 'runpod',
        resourceType: 'serverless',
        region: 'us-east',
        name: `kriptik-${config.modelName.replace(/\//g, '-').substring(0, 30)}`,
        gpu: {
          type: gpuName as any,
          count: 1,
        },
        containerImage: 'runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04',
        environmentVariables: {
          HF_MODEL_ID: config.modelId,
          HF_HUB_ENABLE_HF_TRANSFER: '1',
          ...config.customEnvVars,
        },
        port: 8080,
        scaling: {
          minReplicas: config.minWorkers,
          maxReplicas: config.maxWorkers,
        },
        timeoutSeconds: config.idleTimeout,
        volumes: config.volumePersistence ? [{
          name: 'model-cache',
          sizeGB: config.volumeSizeGB,
          mountPath: '/workspace',
        }] : undefined,
        model: {
          huggingFaceId: config.modelId,
        },
      });

      // Generate endpoint URL
      const endpointUrl = `https://api.runpod.ai/v2/${deployment.id}/openai/v1`;

      // Save to database
      await db.insert(deployedEndpoints).values({
        id: endpointId,
        userId,
        projectId,
        modelId: config.modelId,
        modelName: config.modelName,
        status: 'scaling',
        endpointUrl,
        gpuType: config.gpuType,
        minWorkers: config.minWorkers,
        maxWorkers: config.maxWorkers,
        currentWorkers: 0,
        idleTimeout: config.idleTimeout,
        volumePersistence: config.volumePersistence ? 1 : 0,
        volumeSizeGB: config.volumeSizeGB,
        customEnvVars: JSON.stringify(config.customEnvVars),
        totalRequests: 0,
        avgLatencyMs: 0,
        costToday: 0,
        costTotal: 0,
        runpodEndpointId: deployment.id,
        testWindowEndsAt,
        isTestPeriod: 1,
      });

      // Start polling for endpoint readiness
      this.pollEndpointStatus(endpointId, deployment.id, userId);

      return {
        id: endpointId,
        userId,
        modelId: config.modelId,
        modelName: config.modelName,
        status: 'scaling',
        endpointUrl,
        gpuType: config.gpuType,
        minWorkers: config.minWorkers,
        maxWorkers: config.maxWorkers,
        currentWorkers: 0,
        totalRequests: 0,
        avgLatencyMs: 0,
        costToday: 0,
        costTotal: 0,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        testWindowEndsAt,
        runpodEndpointId: deployment.id,
      };
    } catch (error) {
      console.error('Failed to deploy endpoint:', error);
      throw new Error(`Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Poll endpoint status until ready
   */
  private async pollEndpointStatus(
    endpointId: string,
    runpodEndpointId: string,
    userId: string
  ): Promise<void> {
    const maxAttempts = 60; // 10 minutes max
    let attempts = 0;

    const poll = async () => {
      attempts++;
      
      try {
        const runpod = await this.initializeRunPod(userId);
        const deployment = await runpod.getDeployment(runpodEndpointId);
        
        if (deployment && deployment.status === 'running') {
          await db
            .update(deployedEndpoints)
            .set({ 
              status: 'active',
              currentWorkers: 1, // Default to 1 when running
            })
            .where(eq(deployedEndpoints.id, endpointId));
          return;
        }

        if (deployment && deployment.status === 'failed') {
          await db
            .update(deployedEndpoints)
            .set({ status: 'error' })
            .where(eq(deployedEndpoints.id, endpointId));
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, 10000); // Poll every 10 seconds
        } else {
          await db
            .update(deployedEndpoints)
            .set({ status: 'error' })
            .where(eq(deployedEndpoints.id, endpointId));
        }
      } catch (error) {
        console.error('Poll error:', error);
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000);
        }
      }
    };

    setTimeout(poll, 5000); // Start polling after 5 seconds
  }

  /**
   * Test an endpoint
   */
  async testEndpoint(
    endpointId: string,
    userId: string,
    prompt: string,
    maxTokens: number = 256,
    temperature: number = 0.7
  ): Promise<TestResult> {
    const endpoint = await this.getEndpoint(endpointId, userId);
    if (!endpoint) {
      throw new Error('Endpoint not found');
    }

    const startTime = Date.now();

    try {
      // Get user's HuggingFace token for authenticated requests
      const vault = getCredentialVault();
      const hfCredential = await vault.getCredential(userId, 'huggingface');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (hfCredential && hfCredential.oauthAccessToken) {
        headers['Authorization'] = `Bearer ${hfCredential.oauthAccessToken}`;
      }

      // Make inference request
      const response = await fetch(`${endpoint.endpointUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: endpoint.modelId,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature,
        }),
        credentials: 'omit',
      });

      const latencyMs = Date.now() - startTime;
      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          latencyMs,
          error: data.error?.message || 'Request failed',
        };
      }

      // Update request count and latency
      const newTotalRequests = (endpoint.totalRequests || 0) + 1;
      const newAvgLatency = Math.round(
        ((endpoint.avgLatencyMs || 0) * (endpoint.totalRequests || 0) + latencyMs) / newTotalRequests
      );

      await db
        .update(deployedEndpoints)
        .set({
          totalRequests: newTotalRequests,
          avgLatencyMs: newAvgLatency,
          lastActiveAt: new Date().toISOString(),
        })
        .where(eq(deployedEndpoints.id, endpointId));

      return {
        success: true,
        latencyMs,
        output: data.choices?.[0]?.message?.content || '',
        usage: data.usage,
      };
    } catch (error) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Get endpoint by ID
   */
  async getEndpoint(endpointId: string, userId: string): Promise<EndpointInfo | null> {
    const endpoints = await db
      .select()
      .from(deployedEndpoints)
      .where(
        and(
          eq(deployedEndpoints.id, endpointId),
          eq(deployedEndpoints.userId, userId)
        )
      )
      .limit(1);

    if (!endpoints.length) {
      return null;
    }

    const e = endpoints[0];
    return {
      id: e.id,
      userId: e.userId,
      modelId: e.modelId,
      modelName: e.modelName,
      status: e.status,
      endpointUrl: e.endpointUrl,
      gpuType: e.gpuType,
      minWorkers: e.minWorkers,
      maxWorkers: e.maxWorkers,
      currentWorkers: e.currentWorkers || 0,
      totalRequests: e.totalRequests || 0,
      avgLatencyMs: e.avgLatencyMs || 0,
      costToday: (e.costToday || 0) / 100, // Convert cents to dollars
      costTotal: (e.costTotal || 0) / 100,
      createdAt: e.createdAt,
      lastActiveAt: e.lastActiveAt || e.createdAt,
      testWindowEndsAt: e.testWindowEndsAt,
      runpodEndpointId: e.runpodEndpointId,
    };
  }

  /**
   * List all endpoints for a user
   */
  async listEndpoints(userId: string): Promise<EndpointInfo[]> {
    const endpoints = await db
      .select()
      .from(deployedEndpoints)
      .where(eq(deployedEndpoints.userId, userId))
      .orderBy(desc(deployedEndpoints.createdAt));

    return endpoints.map(e => ({
      id: e.id,
      userId: e.userId,
      modelId: e.modelId,
      modelName: e.modelName,
      status: e.status,
      endpointUrl: e.endpointUrl,
      gpuType: e.gpuType,
      minWorkers: e.minWorkers,
      maxWorkers: e.maxWorkers,
      currentWorkers: e.currentWorkers || 0,
      totalRequests: e.totalRequests || 0,
      avgLatencyMs: e.avgLatencyMs || 0,
      costToday: (e.costToday || 0) / 100,
      costTotal: (e.costTotal || 0) / 100,
      createdAt: e.createdAt,
      lastActiveAt: e.lastActiveAt || e.createdAt,
      testWindowEndsAt: e.testWindowEndsAt,
      runpodEndpointId: e.runpodEndpointId,
    }));
  }

  /**
   * Confirm endpoint (keep after test period)
   */
  async confirmEndpoint(endpointId: string, userId: string): Promise<void> {
    await db
      .update(deployedEndpoints)
      .set({
        isTestPeriod: 0,
        testWindowEndsAt: null,
      })
      .where(
        and(
          eq(deployedEndpoints.id, endpointId),
          eq(deployedEndpoints.userId, userId)
        )
      );
  }

  /**
   * Stop an endpoint
   */
  async stopEndpoint(endpointId: string, userId: string): Promise<void> {
    const endpoint = await this.getEndpoint(endpointId, userId);
    if (!endpoint || !endpoint.runpodEndpointId) {
      throw new Error('Endpoint not found');
    }

    const runpod = await this.initializeRunPod(userId);
    await runpod.stopDeployment(endpoint.runpodEndpointId);

    await db
      .update(deployedEndpoints)
      .set({
        status: 'stopped',
        currentWorkers: 0,
      })
      .where(eq(deployedEndpoints.id, endpointId));
  }

  /**
   * Start an endpoint
   */
  async startEndpoint(endpointId: string, userId: string): Promise<void> {
    const endpoint = await this.getEndpoint(endpointId, userId);
    if (!endpoint || !endpoint.runpodEndpointId) {
      throw new Error('Endpoint not found');
    }

    const runpod = await this.initializeRunPod(userId);
    await runpod.scaleDeployment(endpoint.runpodEndpointId, endpoint.minWorkers || 1);

    await db
      .update(deployedEndpoints)
      .set({ status: 'scaling' })
      .where(eq(deployedEndpoints.id, endpointId));

    // Start polling for ready status
    this.pollEndpointStatus(endpointId, endpoint.runpodEndpointId, userId);
  }

  /**
   * Delete an endpoint
   */
  async deleteEndpoint(endpointId: string, userId: string): Promise<void> {
    const endpoint = await this.getEndpoint(endpointId, userId);
    if (!endpoint) {
      throw new Error('Endpoint not found');
    }

    // Delete from RunPod if it exists
    if (endpoint.runpodEndpointId) {
      try {
        const runpod = await this.initializeRunPod(userId);
        await runpod.deleteDeployment(endpoint.runpodEndpointId);
      } catch (error) {
        console.error('Failed to delete from RunPod:', error);
        // Continue with database deletion anyway
      }
    }

    // Delete from database
    await db
      .delete(deployedEndpoints)
      .where(eq(deployedEndpoints.id, endpointId));
  }
}

// Singleton instance
export const endpointDeployer = new EndpointDeployerService();
