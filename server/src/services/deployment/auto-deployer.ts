/**
 * Auto-Deployer Service
 *
 * Automatically deploys trained models to private serverless endpoints.
 * Triggers after training completion, handles provider selection, and generates API keys.
 *
 * Part of KripTik AI's Auto-Deploy Private Endpoints feature.
 */

import { EventEmitter } from 'events';
import { db } from '../../db.js';
import { eq } from 'drizzle-orm';
import { trainingJobs, userEndpoints } from '../../schema.js';
import { EndpointRegistry, createEndpointRegistry, type EndpointModality } from './endpoint-registry.js';
import { DeploymentRecommender, getDeploymentRecommender, type DeploymentProvider } from './deployment-recommender.js';
import { RunPodDeployer, getRunPodDeployer } from './runpod-deployer.js';
import { ModalDeployer, getModalDeployer, type ModalGPUType } from './modal-deployer.js';
import { CredentialVault } from '../security/credential-vault.js';
import type { ModelModality } from '../training/types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface AutoDeployConfig {
  trainingJobId: string;
  userId: string;
  modelUrl: string; // HuggingFace URL
  modality: ModelModality;
  baseModelId: string;
  modelName: string;
}

export interface AutoDeployResult {
  success: boolean;
  endpointId?: string;
  endpointUrl?: string;
  apiKey?: string; // Full key, returned only once
  provider?: DeploymentProvider;
  gpuType?: string;
  estimatedColdStartMs?: number;
  error?: string;
}

interface ModelAnalysis {
  estimatedSizeGB: number;
  requiredVRAM: number;
  recommendedGPU: string;
  isQuantized: boolean;
  architecture?: string;
}

interface DeploymentRecommendationConfig {
  provider: DeploymentProvider;
  gpuType: string;
  minWorkers: number;
  maxWorkers: number;
  idleTimeoutSeconds: number;
  containerImage: string | null;
  estimatedColdStartMs: number;
}

// =============================================================================
// DEPLOYMENT DEFAULTS BY MODALITY
// =============================================================================

type DeploymentModalityConfig = {
  preferredProvider: DeploymentProvider;
  containerImage: string | null;
  minWorkers: number;
  maxWorkers: number;
  idleTimeoutSeconds: number;
  gpuOptions: string[];
};

const DEPLOYMENT_DEFAULTS: Record<ModelModality, DeploymentModalityConfig> = {
  llm: {
    preferredProvider: 'runpod',
    containerImage: 'runpod/worker-vllm:stable-cuda12.1.0',
    minWorkers: 0,
    maxWorkers: 3,
    idleTimeoutSeconds: 60,
    gpuOptions: ['T4', 'L4', 'A10G', 'A100-40GB'],
  },
  image: {
    preferredProvider: 'runpod',
    containerImage: 'runpod/worker-comfyui:stable',
    minWorkers: 0,
    maxWorkers: 2,
    idleTimeoutSeconds: 30,
    gpuOptions: ['T4', 'RTX4090', 'A10G'],
  },
  video: {
    preferredProvider: 'modal',
    containerImage: null, // Modal uses Python code
    minWorkers: 0,
    maxWorkers: 1,
    idleTimeoutSeconds: 120,
    gpuOptions: ['A100-40GB', 'A100-80GB', 'H100'],
  },
  audio: {
    preferredProvider: 'runpod',
    containerImage: 'runpod/worker-whisper:latest',
    minWorkers: 0,
    maxWorkers: 2,
    idleTimeoutSeconds: 30,
    gpuOptions: ['T4', 'L4'],
  },
  multimodal: {
    preferredProvider: 'runpod',
    containerImage: 'runpod/worker-vllm:stable-cuda12.1.0',
    minWorkers: 0,
    maxWorkers: 2,
    idleTimeoutSeconds: 60,
    gpuOptions: ['A10G', 'A100-40GB', 'A100-80GB'],
  },
};

// =============================================================================
// AUTO-DEPLOYER CLASS
// =============================================================================

export class AutoDeployer extends EventEmitter {
  private deploymentRecommender: DeploymentRecommender;
  private runpodDeployer: RunPodDeployer;
  private modalDeployer: ModalDeployer;
  private credentialVault: CredentialVault;

  constructor() {
    super();
    this.deploymentRecommender = getDeploymentRecommender();
    this.runpodDeployer = getRunPodDeployer();
    this.modalDeployer = getModalDeployer();
    this.credentialVault = new CredentialVault();
  }

  /**
   * Automatically deploy a trained model to a serverless endpoint
   */
  async autoDeploy(config: AutoDeployConfig): Promise<AutoDeployResult> {
    const { trainingJobId, userId, modelUrl, modality, baseModelId, modelName } = config;

    try {
      this.emit('deploy_started', { trainingJobId, modelName });

      // Step 1: Analyze model requirements
      const analysis = await this.analyzeModel(modelUrl, modality);
      this.emit('deploy_progress', { trainingJobId, stage: 'analyzing', progress: 10 });

      // Step 2: Get deployment recommendation
      const deployConfig = this.selectDeploymentConfig(analysis, modality);
      this.emit('deploy_progress', { trainingJobId, stage: 'selecting_provider', progress: 20 });

      // Step 3: Create endpoint registry entry
      const endpointRegistry = createEndpointRegistry(userId);
      const { endpointId } = await endpointRegistry.registerEndpoint({
        trainingJobId,
        sourceType: 'training',
        modelName,
        modelDescription: `Fine-tuned ${baseModelId} model`,
        modality: modality as EndpointModality,
        baseModelId,
        huggingFaceRepoUrl: modelUrl,
        provider: deployConfig.provider,
        gpuType: deployConfig.gpuType,
        endpointType: 'serverless',
        minWorkers: deployConfig.minWorkers,
        maxWorkers: deployConfig.maxWorkers,
      });

      this.emit('deploy_progress', { trainingJobId, stage: 'provisioning', progress: 40 });

      // Step 4: Deploy to provider
      let deployResult: { endpointUrl: string; providerEndpointId: string };

      try {
        if (deployConfig.provider === 'runpod') {
          deployResult = await this.deployToRunPod(
            userId,
            endpointId,
            modelUrl,
            modality,
            deployConfig.gpuType
          );
        } else {
          deployResult = await this.deployToModal(
            userId,
            endpointId,
            modelUrl,
            modality,
            deployConfig.gpuType
          );
        }
      } catch (deployError) {
        // Update endpoint status to error
        await endpointRegistry.updateEndpointStatus(
          endpointId,
          'error',
          deployError instanceof Error ? deployError.message : 'Deployment failed'
        );
        throw deployError;
      }

      this.emit('deploy_progress', { trainingJobId, stage: 'configuring', progress: 70 });

      // Step 5: Update endpoint with URL
      await endpointRegistry.setEndpointUrl(
        endpointId,
        deployResult.endpointUrl,
        deployResult.providerEndpointId
      );

      this.emit('deploy_progress', { trainingJobId, stage: 'generating_key', progress: 85 });

      // Step 6: Generate API key
      const { apiKey, keyInfo } = await endpointRegistry.generateApiKey(endpointId, 'default');

      this.emit('deploy_progress', { trainingJobId, stage: 'complete', progress: 100 });

      // Step 7: Update training job metadata with endpoint info
      // Note: Endpoint is linked via userEndpoints.trainingJobId reference

      const result: AutoDeployResult = {
        success: true,
        endpointId,
        endpointUrl: deployResult.endpointUrl,
        apiKey,
        provider: deployConfig.provider,
        gpuType: deployConfig.gpuType,
        estimatedColdStartMs: deployConfig.estimatedColdStartMs,
      };

      this.emit('deploy_complete', {
        trainingJobId,
        endpointId,
        endpointUrl: deployResult.endpointUrl,
        apiKey,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('deploy_failed', { trainingJobId, error: errorMessage });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Redeploy a failed or terminated endpoint
   */
  async redeployEndpoint(endpointId: string, userId: string): Promise<AutoDeployResult> {
    // Get endpoint info
    const endpointRegistry = createEndpointRegistry(userId);
    const endpoint = await endpointRegistry.getEndpoint(endpointId);

    if (!endpoint) {
      return { success: false, error: 'Endpoint not found' };
    }

    // Get original model URL from HuggingFace
    const modelUrl = endpoint.huggingFaceRepoUrl;
    if (!modelUrl) {
      return { success: false, error: 'No model URL available for redeployment' };
    }

    // Reset status to provisioning
    await endpointRegistry.updateEndpointStatus(endpointId, 'provisioning');

    // Deploy to provider
    try {
      let deployResult: { endpointUrl: string; providerEndpointId: string };

      if (endpoint.provider === 'runpod') {
        deployResult = await this.deployToRunPod(
          userId,
          endpointId,
          modelUrl,
          endpoint.modality as ModelModality,
          endpoint.gpuType || 'T4'
        );
      } else {
        deployResult = await this.deployToModal(
          userId,
          endpointId,
          modelUrl,
          endpoint.modality as ModelModality,
          endpoint.gpuType || 'T4'
        );
      }

      // Update endpoint URL
      await endpointRegistry.setEndpointUrl(
        endpointId,
        deployResult.endpointUrl,
        deployResult.providerEndpointId
      );

      return {
        success: true,
        endpointId,
        endpointUrl: deployResult.endpointUrl,
        provider: endpoint.provider as DeploymentProvider,
        gpuType: endpoint.gpuType || 'T4',
      };
    } catch (error) {
      await endpointRegistry.updateEndpointStatus(
        endpointId,
        'error',
        error instanceof Error ? error.message : 'Redeployment failed'
      );

      return {
        success: false,
        endpointId,
        error: error instanceof Error ? error.message : 'Redeployment failed',
      };
    }
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  /**
   * Analyze model to determine deployment requirements
   */
  private async analyzeModel(
    modelUrl: string,
    modality: ModelModality
  ): Promise<ModelAnalysis> {
    // Default analysis based on modality
    const defaultAnalysis: Record<ModelModality, ModelAnalysis> = {
      llm: {
        estimatedSizeGB: 7,
        requiredVRAM: 16,
        recommendedGPU: 'T4',
        isQuantized: false,
        architecture: 'transformer',
      },
      image: {
        estimatedSizeGB: 5,
        requiredVRAM: 12,
        recommendedGPU: 'T4',
        isQuantized: false,
        architecture: 'diffusion',
      },
      video: {
        estimatedSizeGB: 15,
        requiredVRAM: 40,
        recommendedGPU: 'A100-40GB',
        isQuantized: false,
        architecture: 'diffusion',
      },
      audio: {
        estimatedSizeGB: 3,
        requiredVRAM: 8,
        recommendedGPU: 'T4',
        isQuantized: false,
        architecture: 'encoder-decoder',
      },
      multimodal: {
        estimatedSizeGB: 10,
        requiredVRAM: 24,
        recommendedGPU: 'A10G',
        isQuantized: false,
        architecture: 'transformer-multimodal',
      },
    };

    const analysis = { ...defaultAnalysis[modality] }; // Clone to avoid mutation

    // Try to get more specific info from HuggingFace model page
    try {
      // Extract repo info from URL
      const urlMatch = modelUrl.match(/huggingface\.co\/([^/]+\/[^/]+)/);
      if (urlMatch) {
        const repoId = urlMatch[1];
        
        // Check for quantization indicators in repo name
        if (repoId.toLowerCase().includes('gguf') || 
            repoId.toLowerCase().includes('awq') ||
            repoId.toLowerCase().includes('gptq')) {
          analysis.isQuantized = true;
          analysis.estimatedSizeGB = analysis.estimatedSizeGB * 0.3;
          analysis.requiredVRAM = analysis.requiredVRAM * 0.5;
        }

        // Check for size indicators
        if (repoId.includes('70b') || repoId.includes('70B')) {
          analysis.estimatedSizeGB = 140;
          analysis.requiredVRAM = 80;
          analysis.recommendedGPU = 'A100-80GB';
        } else if (repoId.includes('13b') || repoId.includes('13B')) {
          analysis.estimatedSizeGB = 26;
          analysis.requiredVRAM = 24;
          analysis.recommendedGPU = 'L4';
        } else if (repoId.includes('7b') || repoId.includes('7B') || repoId.includes('8b') || repoId.includes('8B')) {
          analysis.estimatedSizeGB = 14;
          analysis.requiredVRAM = 16;
          analysis.recommendedGPU = 'T4';
        }
      }
    } catch (e) {
      console.warn('[AutoDeployer] Could not analyze model URL:', e);
    }

    return analysis;
  }

  /**
   * Select optimal provider and configuration
   */
  private selectDeploymentConfig(
    analysis: ModelAnalysis,
    modality: ModelModality
  ): DeploymentRecommendationConfig {
    const defaults = DEPLOYMENT_DEFAULTS[modality];

    // Determine GPU based on VRAM requirements
    let gpuType = analysis.recommendedGPU;
    
    // Match GPU to VRAM requirement
    if (analysis.requiredVRAM <= 16) {
      gpuType = 'T4';
    } else if (analysis.requiredVRAM <= 24) {
      gpuType = 'L4';
    } else if (analysis.requiredVRAM <= 40) {
      gpuType = 'A100-40GB';
    } else {
      gpuType = 'A100-80GB';
    }

    // Check if GPU is available for the provider
    const provider = defaults.preferredProvider;
    if (!defaults.gpuOptions.includes(gpuType)) {
      gpuType = defaults.gpuOptions[0];
    }

    // Estimate cold start time
    let estimatedColdStartMs = 5000; // Default 5 seconds
    if (modality === 'llm' && analysis.estimatedSizeGB > 20) {
      estimatedColdStartMs = 15000; // Larger LLMs take longer
    }
    if (modality === 'video') {
      estimatedColdStartMs = 30000; // Video models are large
    }

    return {
      provider,
      gpuType,
      minWorkers: defaults.minWorkers,
      maxWorkers: defaults.maxWorkers,
      idleTimeoutSeconds: defaults.idleTimeoutSeconds,
      containerImage: defaults.containerImage,
      estimatedColdStartMs,
    };
  }

  /**
   * Deploy to RunPod serverless
   */
  private async deployToRunPod(
    userId: string,
    endpointId: string,
    modelUrl: string,
    modality: ModelModality,
    gpuType: string
  ): Promise<{ endpointUrl: string; providerEndpointId: string }> {
    // Get RunPod credentials
    const creds = await this.credentialVault.getCredential(userId, 'runpod');
    if (!creds?.data?.apiKey) {
      throw new Error('RunPod API key not configured. Please add your RunPod API key in Settings > Credentials.');
    }

    this.runpodDeployer.initialize(creds.data.apiKey as string);

    const defaults = DEPLOYMENT_DEFAULTS[modality];

    const result = await this.runpodDeployer.deployModel({
      userId,
      modelUrl,
      modelType: modality,
      gpuType,
      modelName: `kriptik-${endpointId.substring(0, 8)}`,
      scalingConfig: {
        minWorkers: defaults.minWorkers,
        maxWorkers: defaults.maxWorkers,
        idleTimeout: defaults.idleTimeoutSeconds,
      },
      containerImage: defaults.containerImage || undefined,
    });

    return {
      endpointUrl: result.endpointUrl,
      providerEndpointId: result.endpointId,
    };
  }

  /**
   * Deploy to Modal serverless
   */
  private async deployToModal(
    userId: string,
    endpointId: string,
    modelUrl: string,
    modality: ModelModality,
    gpuType: string
  ): Promise<{ endpointUrl: string; providerEndpointId: string }> {
    // Get Modal credentials
    const creds = await this.credentialVault.getCredential(userId, 'modal');
    if (!creds?.data?.tokenId || !creds?.data?.tokenSecret) {
      throw new Error('Modal credentials not configured. Please add your Modal credentials in Settings > Credentials.');
    }

    this.modalDeployer.initialize(
      creds.data.tokenId as string,
      creds.data.tokenSecret as string
    );

    const result = await this.modalDeployer.deployModel({
      userId,
      modelUrl,
      modelType: modality,
      gpuType: gpuType as ModalGPUType,
      modelName: `kriptik-${endpointId.substring(0, 8)}`,
    });

    return {
      endpointUrl: result.endpointUrl,
      providerEndpointId: result.appId,
    };
  }

  /**
   * Wait for deployment to be ready
   */
  async waitForDeployment(
    provider: DeploymentProvider,
    providerEndpointId: string,
    timeoutMs: number = 120000
  ): Promise<boolean> {
    const startTime = Date.now();
    const pollInterval = 5000;

    while (Date.now() - startTime < timeoutMs) {
      try {
        if (provider === 'runpod') {
          const status = await this.runpodDeployer.getEndpointStatus(providerEndpointId);
          // Check for active status (may vary based on RunPod API response)
          const statusStr = String(status.status).toLowerCase();
          if (statusStr === 'active' || statusStr === 'ready' || statusStr === 'idle') {
            return true;
          }
        } else {
          const status = await this.modalDeployer.getAppStatus(providerEndpointId);
          // Check for deployed status (may vary based on Modal API response)
          const statusStr = String(status.status).toLowerCase();
          if (statusStr === 'deployed' || statusStr === 'running' || statusStr === 'active') {
            return true;
          }
        }
      } catch (e) {
        console.warn('[AutoDeployer] Error checking deployment status:', e);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return false;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let autoDeployerInstance: AutoDeployer | null = null;

export function getAutoDeployer(): AutoDeployer {
  if (!autoDeployerInstance) {
    autoDeployerInstance = new AutoDeployer();
  }
  return autoDeployerInstance;
}

export default AutoDeployer;
