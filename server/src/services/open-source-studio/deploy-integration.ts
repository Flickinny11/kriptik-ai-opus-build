/**
 * Open Source Studio Deploy Integration
 *
 * Integrates auto-deploy with Open Source Studio.
 * When users deploy an open source model from the studio,
 * it automatically creates a private endpoint.
 *
 * Flow:
 * 1. User selects model in Open Source Studio
 * 2. User clicks "Deploy to Endpoint"
 * 3. System:
 *    a. Analyzes model requirements
 *    b. Recommends provider/GPU
 *    c. Creates endpoint record
 *    d. Deploys to provider
 *    e. Generates API key
 *    f. Returns connection info
 *
 * Part of KripTik AI's Auto-Deploy Private Endpoints feature.
 */

import { EventEmitter } from 'events';
import { createEndpointRegistry, type ConnectionInfo } from '../deployment/endpoint-registry.js';
import { getAutoDeployer } from '../deployment/auto-deployer.js';
import { getSmartProviderSelector, type ProviderSelectionResult } from '../deployment/smart-provider-selector.js';
import { RunPodDeployer } from '../deployment/runpod-deployer.js';
import { ModalDeployer } from '../deployment/modal-deployer.js';
import type { ModelModality } from '../training/types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface DeployFromStudioInput {
  userId: string;
  modelId: string; // HuggingFace model ID
  modelName?: string; // Custom name
  modelDescription?: string;
  customConfig?: {
    provider?: 'runpod' | 'modal';
    gpuType?: string;
    minWorkers?: number;
    maxWorkers?: number;
  };
}

export interface DeployFromStudioResult {
  endpointId: string;
  endpointUrl: string;
  apiKey: string;
  provider: 'runpod' | 'modal';
  gpuType: string;
  status: string;
  connectionCode: {
    curl: string;
    python: string;
    typescript: string;
    openai_compatible?: string;
  };
  estimatedCostPerHour: number;
  estimatedCreditsPerHour: number;
}

export interface DeploymentPreview {
  modelId: string;
  modelInfo: ModelInfo;
  recommendation: {
    provider: 'runpod' | 'modal';
    gpuType: string;
    costPerHour: number;
    coldStartMs: number;
    reason: string;
  };
  estimatedMonthlyCost: number;
  estimatedCreditsPerMonth: number;
  alternatives: Array<{
    provider: 'runpod' | 'modal';
    gpuType: string;
    costPerHour: number;
    coldStartMs: number;
  }>;
  warnings: string[];
}

export interface DeployabilityCheck {
  deployable: boolean;
  reason?: string;
  requirements?: {
    minVram: number;
    recommendedVram: number;
    modality: ModelModality;
    modelSize: string;
  };
  warnings: string[];
}

export interface ModelInfo {
  id: string;
  name: string;
  author: string;
  modality: ModelModality;
  modelSize: string; // e.g., "7B", "13B", "70B"
  architecture: string; // e.g., "llama", "mistral", "stable-diffusion"
  quantization?: string; // e.g., "fp16", "int8", "int4"
  license: string;
  downloads: number;
  likes: number;
  tags: string[];
  lastModified: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Model size to VRAM requirements (in GB)
const MODEL_VRAM_REQUIREMENTS: Record<string, { min: number; recommended: number }> = {
  '1B': { min: 4, recommended: 8 },
  '3B': { min: 8, recommended: 16 },
  '7B': { min: 16, recommended: 24 },
  '8B': { min: 16, recommended: 24 },
  '13B': { min: 24, recommended: 40 },
  '20B': { min: 40, recommended: 48 },
  '34B': { min: 40, recommended: 80 },
  '70B': { min: 80, recommended: 160 },
  '72B': { min: 80, recommended: 160 },
  'default': { min: 24, recommended: 40 },
};

// Architecture to modality mapping
const ARCHITECTURE_MODALITY: Record<string, ModelModality> = {
  'llama': 'llm',
  'mistral': 'llm',
  'qwen': 'llm',
  'phi': 'llm',
  'gemma': 'llm',
  'falcon': 'llm',
  'bloom': 'llm',
  'mpt': 'llm',
  'stable-diffusion': 'image',
  'sdxl': 'image',
  'flux': 'image',
  'whisper': 'audio',
  'musicgen': 'audio',
  'bark': 'audio',
  'videogen': 'video',
  'cogvideo': 'video',
  'default': 'llm',
};

// =============================================================================
// OPEN SOURCE STUDIO DEPLOYER
// =============================================================================

export class OpenSourceStudioDeployer extends EventEmitter {
  private smartSelector = getSmartProviderSelector();
  private runpodDeployer = new RunPodDeployer();
  private modalDeployer = new ModalDeployer();

  constructor() {
    super();
  }

  /**
   * Deploy a HuggingFace model to a private endpoint
   */
  async deployModel(input: DeployFromStudioInput): Promise<DeployFromStudioResult> {
    const { userId, modelId, modelName, modelDescription, customConfig } = input;

    // Emit deployment started event
    this.emit('deploy_started', { userId, modelId });

    try {
      // Step 1: Fetch model info from HuggingFace
      const modelInfo = await this.fetchModelInfo(modelId);
      this.emit('deploy_progress', { userId, modelId, step: 'model_info', progress: 10 });

      // Step 2: Get deployment recommendation
      const recommendation = customConfig?.provider && customConfig?.gpuType
        ? this.createCustomRecommendation(customConfig)
        : await this.getDeploymentRecommendation(modelInfo);
      this.emit('deploy_progress', { userId, modelId, step: 'recommendation', progress: 20 });

      // Step 3: Create endpoint registry
      const registry = createEndpointRegistry(userId);
      const { endpointId } = await registry.registerEndpoint({
        sourceType: 'open_source_studio',
        modelName: modelName || modelInfo.name,
        modelDescription: modelDescription || `HuggingFace model: ${modelId}`,
        modality: modelInfo.modality as 'llm' | 'image' | 'video' | 'audio',
        baseModelId: modelId,
        huggingFaceRepoUrl: `https://huggingface.co/${modelId}`,
        provider: recommendation.provider,
        gpuType: recommendation.gpuType,
        endpointType: 'serverless',
        minWorkers: customConfig?.minWorkers ?? 0,
        maxWorkers: customConfig?.maxWorkers ?? 1,
      });
      this.emit('deploy_progress', { userId, modelId, step: 'registered', progress: 30 });

      // Step 4: Deploy to provider
      let endpointUrl: string;
      let providerEndpointId: string;

      if (recommendation.provider === 'runpod') {
        const result = await this.deployToRunPod(modelId, modelInfo, recommendation, userId);
        endpointUrl = result.endpointUrl;
        providerEndpointId = result.endpointId;
      } else {
        const result = await this.deployToModal(modelId, modelInfo, recommendation, userId);
        endpointUrl = result.endpointUrl;
        providerEndpointId = result.appId;
      }
      this.emit('deploy_progress', { userId, modelId, step: 'deployed', progress: 70 });

      // Step 5: Update endpoint with URL
      await registry.setEndpointUrl(endpointId, endpointUrl, providerEndpointId);
      this.emit('deploy_progress', { userId, modelId, step: 'configured', progress: 80 });

      // Step 6: Generate API key
      const { apiKey, keyInfo } = await registry.generateApiKey(endpointId, 'default');
      this.emit('deploy_progress', { userId, modelId, step: 'api_key_generated', progress: 90 });

      // Step 7: Get connection info
      const connectionInfo = await registry.getConnectionInfo(endpointId);
      this.emit('deploy_progress', { userId, modelId, step: 'complete', progress: 100 });

      // Calculate cost estimates
      const costPerHour = recommendation.costEstimates?.perHourActive || 0;
      const hourlyCredits = this.calculateHourlyCredits(costPerHour);

      const result: DeployFromStudioResult = {
        endpointId,
        endpointUrl,
        apiKey,
        provider: recommendation.provider,
        gpuType: recommendation.gpuType,
        status: 'active',
        connectionCode: connectionInfo?.code || {
          curl: '',
          python: '',
          typescript: '',
        },
        estimatedCostPerHour: costPerHour,
        estimatedCreditsPerHour: hourlyCredits,
      };

      this.emit('deploy_complete', { userId, modelId, result });
      return result;

    } catch (error) {
      this.emit('deploy_error', { userId, modelId, error: String(error) });
      throw error;
    }
  }

  /**
   * Get deployment preview (cost estimate, GPU recommendation)
   */
  async getDeploymentPreview(modelId: string): Promise<DeploymentPreview> {
    // Fetch model info
    const modelInfo = await this.fetchModelInfo(modelId);

    // Get recommendation
    const rawRecommendation = await this.getDeploymentRecommendation(modelInfo);
    const costPerHour = rawRecommendation.costEstimates?.perHourActive || 0;
    const coldStartMs = rawRecommendation.performance?.coldStartP50Ms || 2000;

    // Calculate costs
    const hourlyCredits = this.calculateHourlyCredits(costPerHour);
    const monthlyCredits = hourlyCredits * 24 * 30;

    // Get alternatives
    const alternatives = this.getAlternativeConfigs(modelInfo);

    // Check for warnings
    const warnings: string[] = [];
    if (modelInfo.modelSize.includes('70') || modelInfo.modelSize.includes('72')) {
      warnings.push('Large model may have longer cold start times (30-60s)');
    }
    if (modelInfo.quantization === 'fp32') {
      warnings.push('Full precision model - consider using quantized version for lower costs');
    }

    return {
      modelId,
      modelInfo,
      recommendation: {
        provider: rawRecommendation.provider,
        gpuType: rawRecommendation.gpuType,
        costPerHour,
        coldStartMs,
        reason: rawRecommendation.reason,
      },
      estimatedMonthlyCost: costPerHour * 24 * 30,
      estimatedCreditsPerMonth: monthlyCredits,
      alternatives,
      warnings,
    };
  }

  /**
   * Check if model is deployable
   */
  async checkDeployability(modelId: string): Promise<DeployabilityCheck> {
    const warnings: string[] = [];

    try {
      const modelInfo = await this.fetchModelInfo(modelId);

      // Check VRAM requirements
      const vramReq = this.getVramRequirements(modelInfo.modelSize);

      // Check if any GPU can handle this
      if (vramReq.recommended > 160) {
        return {
          deployable: false,
          reason: 'Model too large for available GPU options',
          requirements: {
            minVram: vramReq.min,
            recommendedVram: vramReq.recommended,
            modality: modelInfo.modality,
            modelSize: modelInfo.modelSize,
          },
          warnings: ['Model requires multi-GPU deployment which is not yet supported'],
        };
      }

      // Check license
      if (modelInfo.license.toLowerCase().includes('non-commercial')) {
        warnings.push('Model license may restrict commercial use');
      }

      // Check if gated
      if (modelInfo.tags.includes('gated')) {
        return {
          deployable: false,
          reason: 'Gated model requires HuggingFace authentication',
          requirements: {
            minVram: vramReq.min,
            recommendedVram: vramReq.recommended,
            modality: modelInfo.modality,
            modelSize: modelInfo.modelSize,
          },
          warnings: ['Please configure your HuggingFace token in settings to access this model'],
        };
      }

      return {
        deployable: true,
        requirements: {
          minVram: vramReq.min,
          recommendedVram: vramReq.recommended,
          modality: modelInfo.modality,
          modelSize: modelInfo.modelSize,
        },
        warnings,
      };

    } catch (error) {
      return {
        deployable: false,
        reason: `Failed to fetch model info: ${String(error)}`,
        warnings: [],
      };
    }
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  /**
   * Fetch model information from HuggingFace API
   */
  private async fetchModelInfo(modelId: string): Promise<ModelInfo> {
    const hfToken = process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (hfToken) {
      headers['Authorization'] = `Bearer ${hfToken}`;
    }

    try {
      const response = await fetch(`https://huggingface.co/api/models/${modelId}`, { headers });

      if (!response.ok) {
        throw new Error(`HuggingFace API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Parse model size from config or tags
      const modelSize = this.parseModelSize(data);
      const architecture = this.parseArchitecture(data);
      const modality = ARCHITECTURE_MODALITY[architecture] || ARCHITECTURE_MODALITY['default'];

      return {
        id: data.id || modelId,
        name: data.id?.split('/').pop() || modelId,
        author: data.author || data.id?.split('/')[0] || 'unknown',
        modality,
        modelSize,
        architecture,
        quantization: this.parseQuantization(data),
        license: data.license || data.cardData?.license || 'unknown',
        downloads: data.downloads || 0,
        likes: data.likes || 0,
        tags: data.tags || [],
        lastModified: data.lastModified || new Date().toISOString(),
      };

    } catch (error) {
      console.error(`[OpenSourceStudioDeployer] Failed to fetch model info for ${modelId}:`, error);

      // Return minimal info based on model ID
      return this.createMinimalModelInfo(modelId);
    }
  }

  /**
   * Get deployment recommendation for a model
   */
  private async getDeploymentRecommendation(modelInfo: ModelInfo): Promise<ProviderSelectionResult> {
    const vramReq = this.getVramRequirements(modelInfo.modelSize);

    return this.smartSelector.selectProvider({
      modality: modelInfo.modality,
      modelSizeGB: this.parseModelSizeGB(modelInfo.modelSize),
      expectedRequestsPerDay: 100,
      latencyRequirement: 'medium',
    });
  }

  /**
   * Create a custom recommendation from user config
   */
  private createCustomRecommendation(config: {
    provider?: 'runpod' | 'modal';
    gpuType?: string;
  }): ProviderSelectionResult {
    return {
      provider: config.provider || 'runpod',
      gpuType: config.gpuType || 'A10G',
      reason: 'Custom configuration selected by user',
      costEstimates: {
        perRequest: 0.001,
        perHourActive: 0.50,
        monthlyEstimate: 50,
      },
      performance: {
        coldStartP50Ms: 2000,
        coldStartP95Ms: 6000,
        expectedLatencyMs: 3000,
      },
      configuration: {
        minWorkers: 0,
        maxWorkers: 1,
        idleTimeoutSeconds: 30,
        containerImage: null,
        gpuMemory: 24,
      },
      alternatives: [],
    };
  }

  /**
   * Deploy model to RunPod
   */
  private async deployToRunPod(
    modelId: string,
    modelInfo: ModelInfo,
    recommendation: ProviderSelectionResult,
    userId: string
  ): Promise<{ endpointId: string; endpointUrl: string }> {
    const apiKey = process.env.RUNPOD_API_KEY;
    if (!apiKey) {
      throw new Error('RunPod API key not configured');
    }

    this.runpodDeployer.initialize(apiKey);

    const result = await this.runpodDeployer.deployModel({
      userId,
      modelUrl: `https://huggingface.co/${modelId}`,
      modelType: modelInfo.modality,
      gpuType: recommendation.gpuType,
      modelName: modelInfo.name,
      scalingConfig: {
        minWorkers: 0,
        maxWorkers: 1,
        idleTimeout: 30,
      },
      environmentVariables: {
        MODEL_ID: modelId,
        HUGGINGFACE_TOKEN: process.env.HUGGINGFACE_TOKEN || '',
      },
    });

    return {
      endpointId: result.endpointId,
      endpointUrl: result.endpointUrl,
    };
  }

  /**
   * Deploy model to Modal
   */
  private async deployToModal(
    modelId: string,
    modelInfo: ModelInfo,
    recommendation: ProviderSelectionResult,
    userId: string
  ): Promise<{ appId: string; endpointUrl: string }> {
    const tokenId = process.env.MODAL_TOKEN_ID;
    const tokenSecret = process.env.MODAL_TOKEN_SECRET;
    if (!tokenId || !tokenSecret) {
      throw new Error('Modal credentials not configured');
    }

    this.modalDeployer.initialize(tokenId, tokenSecret);

    // Map GPU type to Modal GPU type
    const modalGpu = this.mapToModalGpu(recommendation.gpuType);

    const result = await this.modalDeployer.deployModel({
      userId,
      modelUrl: `https://huggingface.co/${modelId}`,
      modelType: modelInfo.modality,
      gpuType: modalGpu,
      modelName: modelInfo.name,
      scalingConfig: {
        minReplicas: 0,
        maxReplicas: 1,
        scaleToZero: true,
      },
    });

    return {
      appId: result.appId,
      endpointUrl: result.endpointUrl,
    };
  }

  /**
   * Map GPU type to Modal GPU type
   */
  private mapToModalGpu(gpuType: string): 'T4' | 'L4' | 'A10G' | 'A100' | 'H100' {
    const mapping: Record<string, 'T4' | 'L4' | 'A10G' | 'A100' | 'H100'> = {
      'T4': 'T4',
      'L4': 'L4',
      'A10G': 'A10G',
      'RTX3090': 'A10G',
      'RTX4090': 'A10G',
      'A100-40GB': 'A100',
      'A100-80GB': 'A100',
      'H100': 'H100',
    };
    return mapping[gpuType] || 'A10G';
  }

  /**
   * Parse model size from HuggingFace API response
   */
  private parseModelSize(data: Record<string, unknown>): string {
    // Try to get from safetensors or model config
    const safetensors = data.safetensors as Record<string, unknown> | undefined;
    if (safetensors?.total) {
      const totalParams = safetensors.total as number;
      if (totalParams > 60_000_000_000) return '70B';
      if (totalParams > 30_000_000_000) return '34B';
      if (totalParams > 15_000_000_000) return '20B';
      if (totalParams > 10_000_000_000) return '13B';
      if (totalParams > 6_000_000_000) return '7B';
      if (totalParams > 2_000_000_000) return '3B';
      return '1B';
    }

    // Try to parse from model ID or tags
    const id = (data.id as string) || '';
    const tags = (data.tags as string[]) || [];
    const combined = [...tags, id].join(' ').toLowerCase();

    if (combined.includes('70b') || combined.includes('72b')) return '70B';
    if (combined.includes('34b') || combined.includes('32b')) return '34B';
    if (combined.includes('20b') || combined.includes('22b')) return '20B';
    if (combined.includes('13b') || combined.includes('14b')) return '13B';
    if (combined.includes('7b') || combined.includes('8b')) return '7B';
    if (combined.includes('3b') || combined.includes('4b')) return '3B';
    if (combined.includes('1b') || combined.includes('2b')) return '1B';

    return 'default';
  }

  /**
   * Parse architecture from HuggingFace API response
   */
  private parseArchitecture(data: Record<string, unknown>): string {
    const tags = (data.tags as string[]) || [];
    const id = (data.id as string) || '';
    const combined = [...tags, id].join(' ').toLowerCase();

    if (combined.includes('llama')) return 'llama';
    if (combined.includes('mistral')) return 'mistral';
    if (combined.includes('qwen')) return 'qwen';
    if (combined.includes('phi')) return 'phi';
    if (combined.includes('gemma')) return 'gemma';
    if (combined.includes('stable-diffusion')) return 'stable-diffusion';
    if (combined.includes('sdxl')) return 'sdxl';
    if (combined.includes('flux')) return 'flux';
    if (combined.includes('whisper')) return 'whisper';

    // Check model config architecture
    const config = data.config as Record<string, unknown> | undefined;
    if (config?.architectures) {
      const arch = (config.architectures as string[])[0]?.toLowerCase() || '';
      if (arch.includes('llama')) return 'llama';
      if (arch.includes('mistral')) return 'mistral';
    }

    return 'default';
  }

  /**
   * Parse quantization from HuggingFace API response
   */
  private parseQuantization(data: Record<string, unknown>): string | undefined {
    const tags = (data.tags as string[]) || [];
    const id = (data.id as string) || '';
    const combined = [...tags, id].join(' ').toLowerCase();

    if (combined.includes('int4') || combined.includes('4bit')) return 'int4';
    if (combined.includes('int8') || combined.includes('8bit')) return 'int8';
    if (combined.includes('fp16') || combined.includes('half')) return 'fp16';
    if (combined.includes('bf16')) return 'bf16';
    if (combined.includes('fp32') || combined.includes('full')) return 'fp32';
    if (combined.includes('gptq')) return 'gptq';
    if (combined.includes('gguf')) return 'gguf';
    if (combined.includes('awq')) return 'awq';

    return undefined;
  }

  /**
   * Get VRAM requirements for a model size
   */
  private getVramRequirements(modelSize: string): { min: number; recommended: number } {
    return MODEL_VRAM_REQUIREMENTS[modelSize] || MODEL_VRAM_REQUIREMENTS['default'];
  }

  /**
   * Parse model size string to approximate GB
   */
  private parseModelSizeGB(modelSize: string): number {
    const match = modelSize.match(/(\d+)/);
    if (match) {
      const billions = parseInt(match[1], 10);
      // Approximate: 1B params ≈ 2GB in fp16
      return billions * 2;
    }
    return 14; // Default: assume 7B model
  }

  /**
   * Create minimal model info when API fails
   */
  private createMinimalModelInfo(modelId: string): ModelInfo {
    const name = modelId.split('/').pop() || modelId;
    const author = modelId.split('/')[0] || 'unknown';

    return {
      id: modelId,
      name,
      author,
      modality: 'llm',
      modelSize: 'default',
      architecture: 'default',
      quantization: undefined,
      license: 'unknown',
      downloads: 0,
      likes: 0,
      tags: [],
      lastModified: new Date().toISOString(),
    };
  }

  /**
   * Get alternative deployment configurations
   */
  private getAlternativeConfigs(modelInfo: ModelInfo): DeploymentPreview['alternatives'] {
    const vramReq = this.getVramRequirements(modelInfo.modelSize);

    const alternatives: DeploymentPreview['alternatives'] = [];

    // Add RunPod options
    if (vramReq.min <= 16) {
      alternatives.push({
        provider: 'runpod',
        gpuType: 'T4',
        costPerHour: 0.20,
        coldStartMs: 200,
      });
    }
    if (vramReq.min <= 24) {
      alternatives.push({
        provider: 'runpod',
        gpuType: 'A10G',
        costPerHour: 0.50,
        coldStartMs: 200,
      });
    }
    if (vramReq.min <= 40) {
      alternatives.push({
        provider: 'runpod',
        gpuType: 'A100-40GB',
        costPerHour: 1.40,
        coldStartMs: 200,
      });
    }
    if (vramReq.min <= 80) {
      alternatives.push({
        provider: 'runpod',
        gpuType: 'A100-80GB',
        costPerHour: 2.20,
        coldStartMs: 200,
      });
    }

    // Add Modal options
    if (vramReq.min <= 16) {
      alternatives.push({
        provider: 'modal',
        gpuType: 'T4',
        costPerHour: 0.59,
        coldStartMs: 500,
      });
    }
    if (vramReq.min <= 24) {
      alternatives.push({
        provider: 'modal',
        gpuType: 'A10G',
        costPerHour: 1.10,
        coldStartMs: 500,
      });
    }

    return alternatives;
  }

  /**
   * Calculate hourly credits from hourly cost
   */
  private calculateHourlyCredits(costPerHour: number): number {
    // 1 credit = $0.01, with 20% markup
    const costWithMarkup = costPerHour * 1.2;
    return Math.ceil(costWithMarkup * 100);
  }
}

// =============================================================================
// SINGLETON & FACTORY
// =============================================================================

let deployerInstance: OpenSourceStudioDeployer | null = null;

export function getOpenSourceStudioDeployer(): OpenSourceStudioDeployer {
  if (!deployerInstance) {
    deployerInstance = new OpenSourceStudioDeployer();
  }
  return deployerInstance;
}

export default OpenSourceStudioDeployer;
