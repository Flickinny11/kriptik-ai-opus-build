/**
 * Unified Deployer Service
 *
 * Provides a unified interface for deploying models to RunPod or Modal.
 * Handles credential management, recommendation-based routing, and tracking.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import { eq } from 'drizzle-orm';
import { db } from '../../db.js';
import { trainingJobs, deployedEndpoints } from '../../schema.js';
import type { ModelModality } from '../training/types.js';
import {
  DeploymentRecommender,
  getDeploymentRecommender,
  type DeploymentRecommendation,
  type DeploymentProvider,
} from './deployment-recommender.js';
import { RunPodDeployer, getRunPodDeployer } from './runpod-deployer.js';
import { ModalDeployer, getModalDeployer, type ModalGPUType } from './modal-deployer.js';
import { CredentialVault } from '../security/credential-vault.js';

// =============================================================================
// TYPES
// =============================================================================

export interface UnifiedDeployConfig {
  userId: string;
  trainingJobId: string;
  provider: DeploymentProvider | 'auto';
  modelName?: string;
  customConfig?: Partial<DeploymentRecommendation>;
}

export interface ConnectionCode {
  python: string;
  typescript: string;
  curl: string;
}

export interface UnifiedDeployResult {
  deploymentId: string;
  provider: DeploymentProvider;
  endpointUrl: string;
  apiKey?: string;
  connectionCode: ConnectionCode;
  status: string;
  recommendation?: DeploymentRecommendation;
}

export interface DeploymentInfo {
  id: string;
  trainingJobId: string;
  provider: DeploymentProvider;
  endpointId: string;
  endpointUrl: string;
  status: string;
  modality: ModelModality;
  gpuType: string;
  createdAt: string;
  cost?: {
    perHour: number;
    perRequest: number;
  };
}

// =============================================================================
// UNIFIED DEPLOYER
// =============================================================================

export class UnifiedDeployer {
  private recommender: DeploymentRecommender;
  private runpodDeployer: RunPodDeployer;
  private modalDeployer: ModalDeployer;
  private credentialVault: CredentialVault;

  constructor() {
    this.recommender = getDeploymentRecommender();
    this.runpodDeployer = getRunPodDeployer();
    this.modalDeployer = getModalDeployer();
    this.credentialVault = new CredentialVault();
  }

  /**
   * Deploy a trained model
   */
  async deploy(config: UnifiedDeployConfig): Promise<UnifiedDeployResult> {
    const { userId, trainingJobId, provider, modelName, customConfig } = config;

    // Get training job details
    const job = await this.getTrainingJob(trainingJobId, userId);
    if (!job) {
      throw new Error('Training job not found');
    }

    // Get recommendation
    const recommendation = await this.getRecommendation(trainingJobId);

    // Determine final provider
    const finalProvider = provider === 'auto' ? recommendation.provider : provider;

    // Initialize deployer with credentials
    await this.initializeDeployer(userId, finalProvider);

    // Get model URL from training job
    const modelUrl = job.huggingFaceRepoUrl || job.outputModelUrl || '';
    if (!modelUrl) {
      throw new Error('No model URL available. Make sure the training completed successfully.');
    }

    // Deploy based on provider
    let result: UnifiedDeployResult;

    if (finalProvider === 'runpod') {
      result = await this.deployToRunPod(
        userId,
        trainingJobId,
        modelUrl,
        job.modality as ModelModality || 'llm',
        modelName,
        customConfig || recommendation
      );
    } else {
      result = await this.deployToModal(
        userId,
        trainingJobId,
        modelUrl,
        job.modality as ModelModality || 'llm',
        modelName,
        customConfig || recommendation
      );
    }

    // Save deployment to database
    await this.saveDeployment({
      id: result.deploymentId,
      userId,
      trainingJobId,
      provider: finalProvider,
      endpointId: result.deploymentId,
      endpointUrl: result.endpointUrl,
      status: result.status,
      modality: job.modality as ModelModality || 'llm',
      gpuType: customConfig?.gpuType || recommendation.gpuType,
      connectionCode: result.connectionCode,
    });

    return {
      ...result,
      recommendation,
    };
  }

  /**
   * Get deployment recommendation for a training job
   */
  async getRecommendation(trainingJobId: string): Promise<DeploymentRecommendation> {
    // Get training job
    const jobs = await db
      .select()
      .from(trainingJobs)
      .where(eq(trainingJobs.id, trainingJobId))
      .limit(1);

    const job = jobs[0];
    if (!job) {
      throw new Error('Training job not found');
    }

    // Parse modality
    const modality = (job.modality as ModelModality) || 'llm';

    // Get base model ID from config
    const config = job.config as Record<string, unknown> | null;
    const baseModelId = (config?.baseModelId as string) || (config?.baseModel as string) || 'unknown-model';

    // Get recommendation
    return this.recommender.recommendForModel(
      baseModelId,
      modality,
      1000, // Default expected requests
      'medium' // Default latency requirement
    );
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(deploymentId: string, userId: string): Promise<DeploymentInfo | null> {
    const deployments = await db
      .select()
      .from(deployedEndpoints)
      .where(eq(deployedEndpoints.id, deploymentId))
      .limit(1);

    const deployment = deployments[0];
    if (!deployment || deployment.userId !== userId) {
      return null;
    }

    // Get real-time status from provider
    let realTimeStatus: string = deployment.status;
    const endpointId = deployment.endpointId || deployment.runpodEndpointId || deployment.id;

    try {
      if (deployment.provider === 'runpod' && endpointId) {
        const runpodCreds = await this.getCredentials(userId, 'runpod');
        if (runpodCreds?.apiKey) {
          this.runpodDeployer.initialize(runpodCreds.apiKey);
          const status = await this.runpodDeployer.getEndpointStatus(endpointId);
          realTimeStatus = status.status;
        }
      } else if (deployment.provider === 'modal' && endpointId) {
        const status = await this.modalDeployer.getAppStatus(endpointId);
        realTimeStatus = status.status;
      }
    } catch (error) {
      console.error('Error getting real-time status:', error);
    }

    return {
      id: deployment.id,
      trainingJobId: deployment.trainingJobId || '',
      provider: (deployment.provider as DeploymentProvider) || 'runpod',
      endpointId: endpointId,
      endpointUrl: deployment.endpointUrl,
      status: realTimeStatus,
      modality: (deployment.modality as ModelModality) || 'llm',
      gpuType: deployment.gpuType || 'T4',
      createdAt: deployment.createdAt || new Date().toISOString(),
      cost: deployment.costPerHour
        ? {
            perHour: Number(deployment.costPerHour),
            perRequest: Number(deployment.costPerRequest) || 0,
          }
        : undefined,
    };
  }

  /**
   * Delete a deployment
   */
  async deleteDeployment(deploymentId: string, userId: string): Promise<void> {
    const deployments = await db
      .select()
      .from(deployedEndpoints)
      .where(eq(deployedEndpoints.id, deploymentId))
      .limit(1);

    const deployment = deployments[0];
    if (!deployment || deployment.userId !== userId) {
      throw new Error('Deployment not found');
    }

    const endpointId = deployment.endpointId || deployment.runpodEndpointId || deployment.id;

    // Delete from provider
    try {
      if (deployment.provider === 'runpod' && endpointId) {
        const runpodCreds = await this.getCredentials(userId, 'runpod');
        if (runpodCreds?.apiKey) {
          this.runpodDeployer.initialize(runpodCreds.apiKey);
          await this.runpodDeployer.deleteEndpoint(endpointId);
        }
      } else if (deployment.provider === 'modal' && endpointId) {
        await this.modalDeployer.deleteApp(endpointId);
      }
    } catch (error) {
      console.error('Error deleting from provider:', error);
    }

    // Update database
    await db
      .update(deployedEndpoints)
      .set({ status: 'deleted', updatedAt: new Date().toISOString() })
      .where(eq(deployedEndpoints.id, deploymentId));
  }

  /**
   * Get connection code for a deployment
   */
  async getConnectionCode(deploymentId: string, userId: string): Promise<ConnectionCode | null> {
    const deployments = await db
      .select()
      .from(deployedEndpoints)
      .where(eq(deployedEndpoints.id, deploymentId))
      .limit(1);

    const deployment = deployments[0];
    if (!deployment || deployment.userId !== userId) {
      return null;
    }

    // Return stored connection code if available
    if (deployment.connectionCode) {
      return deployment.connectionCode as ConnectionCode;
    }

    // Generate new connection code
    const modality = (deployment.modality as ModelModality) || 'llm';
    const endpointId = deployment.endpointId || deployment.runpodEndpointId || deployment.id;

    if (deployment.provider === 'runpod') {
      return this.runpodDeployer.generateInferenceCode(endpointId, modality);
    } else {
      return this.modalDeployer.generateInferenceCode(endpointId, modality);
    }
  }

  /**
   * List user's deployments
   */
  async listDeployments(userId: string): Promise<DeploymentInfo[]> {
    const deployments = await db
      .select()
      .from(deployedEndpoints)
      .where(eq(deployedEndpoints.userId, userId));

    return deployments.map((d) => ({
      id: d.id,
      trainingJobId: d.trainingJobId || '',
      provider: (d.provider as DeploymentProvider) || 'runpod',
      endpointId: d.endpointId || d.runpodEndpointId || d.id,
      endpointUrl: d.endpointUrl,
      status: d.status,
      modality: (d.modality as ModelModality) || 'llm',
      gpuType: d.gpuType || 'T4',
      createdAt: d.createdAt || new Date().toISOString(),
      cost: d.costPerHour
        ? {
            perHour: Number(d.costPerHour),
            perRequest: Number(d.costPerRequest) || 0,
          }
        : undefined,
    }));
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private async getTrainingJob(jobId: string, userId: string) {
    const jobs = await db
      .select()
      .from(trainingJobs)
      .where(eq(trainingJobs.id, jobId))
      .limit(1);

    const job = jobs[0];
    if (!job || job.userId !== userId) {
      return null;
    }

    return job;
  }

  private async initializeDeployer(userId: string, provider: DeploymentProvider): Promise<void> {
    if (provider === 'runpod') {
      const creds = await this.getCredentials(userId, 'runpod');
      if (!creds?.apiKey) {
        throw new Error('RunPod API key not configured');
      }
      this.runpodDeployer.initialize(creds.apiKey);
    } else if (provider === 'modal') {
      const creds = await this.getCredentials(userId, 'modal');
      if (!creds?.tokenId || !creds?.tokenSecret) {
        throw new Error('Modal credentials not configured');
      }
      this.modalDeployer.initialize(creds.tokenId, creds.tokenSecret);
    }
  }

  private async getCredentials(
    userId: string,
    provider: 'runpod' | 'modal'
  ): Promise<{ apiKey?: string; tokenId?: string; tokenSecret?: string } | null> {
    try {
      const decrypted = await this.credentialVault.getCredential(userId, provider);
      
      if (!decrypted) {
        return null;
      }

      if (provider === 'runpod') {
        return { apiKey: decrypted.data.apiKey as string };
      } else {
        return {
          tokenId: decrypted.data.tokenId as string,
          tokenSecret: decrypted.data.tokenSecret as string,
        };
      }
    } catch (error) {
      console.error('Error getting credentials:', error);
      return null;
    }
  }

  private async deployToRunPod(
    userId: string,
    _trainingJobId: string,
    modelUrl: string,
    modality: ModelModality,
    modelName: string | undefined,
    config: Partial<DeploymentRecommendation>
  ): Promise<UnifiedDeployResult> {
    const scalingConfig = config.scalingConfig || {
      minWorkers: 0,
      maxWorkers: 3,
      scaleToZero: true,
    };
    
    const result = await this.runpodDeployer.deployModel({
      userId,
      modelUrl,
      modelType: modality,
      gpuType: config.gpuType || 'T4',
      modelName,
      scalingConfig: {
        minWorkers: scalingConfig.minWorkers,
        maxWorkers: scalingConfig.maxWorkers,
        idleTimeout: scalingConfig.idleTimeout || 300,
      },
      environmentVariables: config.environmentVariables,
      containerImage: config.containerImage,
    });

    const connectionCode = this.runpodDeployer.generateInferenceCode(result.endpointId, modality);

    return {
      deploymentId: result.endpointId,
      provider: 'runpod',
      endpointUrl: result.endpointUrl,
      connectionCode,
      status: result.status,
    };
  }

  private async deployToModal(
    userId: string,
    _trainingJobId: string,
    modelUrl: string,
    modality: ModelModality,
    modelName: string | undefined,
    config: Partial<DeploymentRecommendation>
  ): Promise<UnifiedDeployResult> {
    const result = await this.modalDeployer.deployModel({
      userId,
      modelUrl,
      modelType: modality,
      gpuType: (config.gpuType as ModalGPUType) || 'T4',
      modelName,
    });

    const connectionCode = this.modalDeployer.generateInferenceCode(result.appName, modality);

    return {
      deploymentId: result.appId,
      provider: 'modal',
      endpointUrl: result.endpointUrl,
      connectionCode,
      status: result.status,
    };
  }

  private async saveDeployment(deployment: {
    id: string;
    userId: string;
    trainingJobId: string;
    provider: DeploymentProvider;
    endpointId: string;
    endpointUrl: string;
    status: string;
    modality: ModelModality;
    gpuType: string;
    connectionCode: ConnectionCode;
  }): Promise<void> {
    await db.insert(deployedEndpoints).values({
      id: deployment.id,
      userId: deployment.userId,
      trainingJobId: deployment.trainingJobId,
      provider: deployment.provider,
      endpointId: deployment.endpointId,
      endpointUrl: deployment.endpointUrl,
      status: deployment.status,
      modality: deployment.modality,
      gpuType: deployment.gpuType,
      connectionCode: deployment.connectionCode as {
        python: string;
        typescript: string;
        curl: string;
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let unifiedDeployerInstance: UnifiedDeployer | null = null;

export function getUnifiedDeployer(): UnifiedDeployer {
  if (!unifiedDeployerInstance) {
    unifiedDeployerInstance = new UnifiedDeployer();
  }
  return unifiedDeployerInstance;
}

export default UnifiedDeployer;
