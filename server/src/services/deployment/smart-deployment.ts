/**
 * Smart Deployment Service
 *
 * AI-driven resource detection and provider selection.
 * Analyzes project requirements and suggests optimal cloud deployment configurations.
 *
 * Features:
 * - Model requirement detection (GPU type, VRAM, etc.)
 * - Cost estimation across providers
 * - Automatic provider selection based on user credentials
 * - Deployment orchestration
 */

import { getCredentialVault } from '../security/credential-vault.js';
import { RunPodProvider } from '../cloud/runpod.js';
import {
    HuggingFaceService,
    HuggingFaceModel,
    ModelRequirements as HFModelRequirements,
    QuantizationType
} from '../ml/huggingface.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ModelRequirements {
    modelId: string;
    modelName: string;
    framework: 'transformers' | 'diffusers' | 'torch' | 'tensorflow' | 'onnx' | 'custom';
    taskType: 'text-generation' | 'image-generation' | 'text-to-image' | 'image-to-image' |
              'video-generation' | 'audio' | 'embedding' | 'classification' | 'custom';
    estimatedVRAM: number; // in GB
    minimumGPU: GPUTier;
    recommendedGPU: GPUTier;
    estimatedInferenceTime: number; // in seconds
    requiresQuantization: boolean;
    quantizationOptions: string[];
}

export interface GPUTier {
    name: string;
    vram: number; // GB
    computeCapability: number;
    tensorCores: boolean;
}

export interface CloudProvider {
    id: string;
    name: string;
    type: 'serverless' | 'dedicated' | 'container';
    supportsGPU: boolean;
    gpuTypes: GPUTier[];
    pricingModel: 'per-second' | 'per-hour' | 'per-request';
    minCostPerHour?: number;
    maxCostPerHour?: number;
    regions: string[];
}

export interface DeploymentRecommendation {
    provider: CloudProvider;
    gpuType: GPUTier;
    estimatedCostPerHour: number;
    estimatedCostPerRequest: number;
    coldStartTime: number; // seconds
    warmStartTime: number; // seconds
    scalingConfig: {
        minReplicas: number;
        maxReplicas: number;
        targetUtilization: number;
    };
    score: number; // 0-100, higher is better
    reasons: string[];
}

export interface DeploymentPlan {
    modelRequirements: ModelRequirements;
    recommendations: DeploymentRecommendation[];
    selectedProvider?: DeploymentRecommendation;
    missingCredentials: string[];
    estimatedSetupTime: number; // seconds
    dockerfileGenerated: boolean;
    dockerfile?: string;
}

export interface ProjectAnalysis {
    hasMLModels: boolean;
    models: ModelRequirements[];
    hasFrontend: boolean;
    frontendFramework?: string;
    hasBackend: boolean;
    backendFramework?: string;
    hasDatabase: boolean;
    databaseType?: string;
    estimatedComplexity: 'simple' | 'moderate' | 'complex';
    deploymentTargets: string[];
}

// ============================================================================
// GPU CONFIGURATIONS
// ============================================================================

const GPU_TIERS: Record<string, GPUTier> = {
    't4': { name: 'NVIDIA T4', vram: 16, computeCapability: 7.5, tensorCores: true },
    'a10g': { name: 'NVIDIA A10G', vram: 24, computeCapability: 8.6, tensorCores: true },
    'l4': { name: 'NVIDIA L4', vram: 24, computeCapability: 8.9, tensorCores: true },
    'a100-40': { name: 'NVIDIA A100 40GB', vram: 40, computeCapability: 8.0, tensorCores: true },
    'a100-80': { name: 'NVIDIA A100 80GB', vram: 80, computeCapability: 8.0, tensorCores: true },
    'h100': { name: 'NVIDIA H100', vram: 80, computeCapability: 9.0, tensorCores: true },
    'rtx3090': { name: 'NVIDIA RTX 3090', vram: 24, computeCapability: 8.6, tensorCores: true },
    'rtx4090': { name: 'NVIDIA RTX 4090', vram: 24, computeCapability: 8.9, tensorCores: true },
};

// ============================================================================
// CLOUD PROVIDERS
// ============================================================================

const CLOUD_PROVIDERS: CloudProvider[] = [
    {
        id: 'runpod',
        name: 'RunPod',
        type: 'serverless',
        supportsGPU: true,
        gpuTypes: [GPU_TIERS['t4'], GPU_TIERS['a10g'], GPU_TIERS['a100-40'], GPU_TIERS['a100-80'], GPU_TIERS['h100']],
        pricingModel: 'per-second',
        minCostPerHour: 0.20,
        maxCostPerHour: 4.00,
        regions: ['US-East', 'US-West', 'EU-West', 'Asia'],
    },
    {
        id: 'replicate',
        name: 'Replicate',
        type: 'serverless',
        supportsGPU: true,
        gpuTypes: [GPU_TIERS['t4'], GPU_TIERS['a40'], GPU_TIERS['a100-40'], GPU_TIERS['a100-80']],
        pricingModel: 'per-second',
        minCostPerHour: 0.25,
        maxCostPerHour: 3.50,
        regions: ['US'],
    },
    {
        id: 'modal',
        name: 'Modal',
        type: 'serverless',
        supportsGPU: true,
        gpuTypes: [GPU_TIERS['t4'], GPU_TIERS['a10g'], GPU_TIERS['a100-40'], GPU_TIERS['a100-80'], GPU_TIERS['h100']],
        pricingModel: 'per-second',
        minCostPerHour: 0.15,
        maxCostPerHour: 3.00,
        regions: ['US-East', 'US-West'],
    },
    {
        id: 'fal',
        name: 'Fal.ai',
        type: 'serverless',
        supportsGPU: true,
        gpuTypes: [GPU_TIERS['t4'], GPU_TIERS['a100-40']],
        pricingModel: 'per-request',
        minCostPerHour: 0.10,
        maxCostPerHour: 2.00,
        regions: ['Global'],
    },
    {
        id: 'huggingface',
        name: 'HuggingFace Inference',
        type: 'serverless',
        supportsGPU: true,
        gpuTypes: [GPU_TIERS['t4'], GPU_TIERS['a10g'], GPU_TIERS['a100-80']],
        pricingModel: 'per-hour',
        minCostPerHour: 0.60,
        maxCostPerHour: 4.50,
        regions: ['US-East', 'EU-West'],
    },
    {
        id: 'together',
        name: 'Together AI',
        type: 'serverless',
        supportsGPU: true,
        gpuTypes: [GPU_TIERS['a100-80'], GPU_TIERS['h100']],
        pricingModel: 'per-request',
        minCostPerHour: 0.20,
        maxCostPerHour: 5.00,
        regions: ['US'],
    },
    {
        id: 'vercel',
        name: 'Vercel',
        type: 'serverless',
        supportsGPU: false,
        gpuTypes: [],
        pricingModel: 'per-request',
        regions: ['Global'],
    },
    {
        id: 'netlify',
        name: 'Netlify',
        type: 'serverless',
        supportsGPU: false,
        gpuTypes: [],
        pricingModel: 'per-request',
        regions: ['Global'],
    },
    {
        id: 'cloudflare',
        name: 'Cloudflare Pages',
        type: 'serverless',
        supportsGPU: false,
        gpuTypes: [],
        pricingModel: 'per-request',
        regions: ['Global'],
    },
];

// ============================================================================
// MODEL SIZE ESTIMATES
// ============================================================================

// Approximate VRAM requirements by parameter count (in billions)
const VRAM_BY_PARAMS: Record<string, number> = {
    '1b': 4,
    '3b': 8,
    '7b': 16,
    '13b': 28,
    '30b': 64,
    '70b': 140,
};

// Known models with specific requirements
const KNOWN_MODELS: Record<string, Partial<ModelRequirements>> = {
    'stabilityai/stable-diffusion-xl-base-1.0': {
        framework: 'diffusers',
        taskType: 'text-to-image',
        estimatedVRAM: 8,
        minimumGPU: GPU_TIERS['t4'],
        recommendedGPU: GPU_TIERS['a10g'],
    },
    'tencent/HunyuanDiT': {
        framework: 'diffusers',
        taskType: 'text-to-image',
        estimatedVRAM: 16,
        minimumGPU: GPU_TIERS['a10g'],
        recommendedGPU: GPU_TIERS['a100-40'],
    },
    'black-forest-labs/FLUX.1-dev': {
        framework: 'diffusers',
        taskType: 'text-to-image',
        estimatedVRAM: 24,
        minimumGPU: GPU_TIERS['a10g'],
        recommendedGPU: GPU_TIERS['a100-40'],
    },
    'meta-llama/Meta-Llama-3.1-8B': {
        framework: 'transformers',
        taskType: 'text-generation',
        estimatedVRAM: 16,
        minimumGPU: GPU_TIERS['t4'],
        recommendedGPU: GPU_TIERS['a10g'],
    },
    'meta-llama/Meta-Llama-3.1-70B': {
        framework: 'transformers',
        taskType: 'text-generation',
        estimatedVRAM: 140,
        minimumGPU: GPU_TIERS['a100-80'],
        recommendedGPU: GPU_TIERS['h100'],
    },
    'mistralai/Mistral-7B-v0.1': {
        framework: 'transformers',
        taskType: 'text-generation',
        estimatedVRAM: 16,
        minimumGPU: GPU_TIERS['t4'],
        recommendedGPU: GPU_TIERS['a10g'],
    },
    'openai/whisper-large-v3': {
        framework: 'transformers',
        taskType: 'audio',
        estimatedVRAM: 6,
        minimumGPU: GPU_TIERS['t4'],
        recommendedGPU: GPU_TIERS['t4'],
    },
};

// ============================================================================
// SMART DEPLOYMENT SERVICE
// ============================================================================

export class SmartDeploymentService {
    private hfService: HuggingFaceService | null = null;

    constructor() {
        // Initialize HuggingFace service if token is available
        if (process.env.HF_TOKEN) {
            this.hfService = new HuggingFaceService(process.env.HF_TOKEN);
        }
    }

    /**
     * Analyze a model and detect requirements
     */
    async analyzeModel(modelId: string): Promise<ModelRequirements> {
        // Check known models first
        const known = KNOWN_MODELS[modelId];

        if (known) {
            return {
                modelId,
                modelName: modelId.split('/').pop() || modelId,
                framework: known.framework || 'transformers',
                taskType: known.taskType || 'custom',
                estimatedVRAM: known.estimatedVRAM || 16,
                minimumGPU: known.minimumGPU || GPU_TIERS['t4'],
                recommendedGPU: known.recommendedGPU || GPU_TIERS['a10g'],
                estimatedInferenceTime: 5,
                requiresQuantization: (known.estimatedVRAM || 16) > 24,
                quantizationOptions: (known.estimatedVRAM || 16) > 24 ? ['GPTQ', 'AWQ', 'GGUF'] : [],
            };
        }

        // Try to fetch model info from HuggingFace
        if (this.hfService) {
            try {
                const modelInfo = await this.hfService.getModel(modelId);
                return this.inferRequirementsFromModelInfo(modelId, modelInfo);
            } catch (error) {
                console.warn('Could not fetch model info:', error);
            }
        }

        // Default inference based on model name
        return this.inferRequirementsFromName(modelId);
    }

    /**
     * Get deployment recommendations for a model
     */
    async getDeploymentPlan(
        userId: string,
        modelId: string,
        options?: {
            preferredProvider?: string;
            maxCostPerHour?: number;
            region?: string;
        }
    ): Promise<DeploymentPlan> {
        const modelRequirements = await this.analyzeModel(modelId);
        const vault = getCredentialVault();

        // Get user's connected credentials
        const userCredentials = await vault.listCredentials(userId);
        const connectedProviders = new Set(userCredentials.map(c => c.integrationId));

        // Find suitable providers
        const recommendations: DeploymentRecommendation[] = [];
        const missingCredentials: string[] = [];

        for (const provider of CLOUD_PROVIDERS) {
            // Skip providers without GPU if model requires GPU
            if (modelRequirements.estimatedVRAM > 0 && !provider.supportsGPU) {
                continue;
            }

            // Check if user has credentials for this provider
            if (!connectedProviders.has(provider.id)) {
                missingCredentials.push(provider.id);
            }

            // Find suitable GPU
            const suitableGPU = this.findSuitableGPU(provider, modelRequirements);

            if (!suitableGPU && provider.supportsGPU) {
                continue; // Provider doesn't have suitable GPU
            }

            // Calculate costs and create recommendation
            const recommendation = this.createRecommendation(
                provider,
                suitableGPU || GPU_TIERS['t4'],
                modelRequirements,
                connectedProviders.has(provider.id)
            );

            recommendations.push(recommendation);
        }

        // Sort by score
        recommendations.sort((a, b) => b.score - a.score);

        // Apply preference if specified
        let selectedProvider: DeploymentRecommendation | undefined;

        if (options?.preferredProvider) {
            selectedProvider = recommendations.find(
                r => r.provider.id === options.preferredProvider
            );
        }

        // Auto-select best option with credentials
        if (!selectedProvider) {
            selectedProvider = recommendations.find(
                r => connectedProviders.has(r.provider.id)
            );
        }

        // Generate Dockerfile if model requires custom container
        let dockerfile: string | undefined;
        let dockerfileGenerated = false;

        if (this.hfService && modelRequirements.framework !== 'custom') {
            try {
                // Convert our requirements to HuggingFace format
                const hfRequirements: HFModelRequirements = {
                    minGPUMemoryGB: modelRequirements.estimatedVRAM,
                    recommendedGPU: this.mapGPUToHuggingFace(modelRequirements.recommendedGPU.name),
                    estimatedLatencyMs: modelRequirements.estimatedInferenceTime * 1000,
                    supportsQuantization: modelRequirements.quantizationOptions.map(q => 
                        q.toLowerCase() as QuantizationType
                    ),
                    dockerBaseImage: this.getDockerBaseImage(modelRequirements.framework),
                    framework: this.mapFramework(modelRequirements.framework),
                };
                dockerfile = this.hfService.generateDockerfile(modelId, hfRequirements);
                dockerfileGenerated = true;
            } catch (error) {
                console.warn('Could not generate Dockerfile:', error);
            }
        }

        return {
            modelRequirements,
            recommendations,
            selectedProvider,
            missingCredentials: [...new Set(missingCredentials)],
            estimatedSetupTime: dockerfileGenerated ? 300 : 60, // 5 min with Docker, 1 min without
            dockerfileGenerated,
            dockerfile,
        };
    }

    /**
     * Analyze a project and detect all deployment requirements
     */
    async analyzeProject(projectFiles: Record<string, string>): Promise<ProjectAnalysis> {
        const analysis: ProjectAnalysis = {
            hasMLModels: false,
            models: [],
            hasFrontend: false,
            hasBackend: false,
            hasDatabase: false,
            estimatedComplexity: 'simple',
            deploymentTargets: [],
        };

        // Check for package.json
        if (projectFiles['package.json']) {
            const pkg = JSON.parse(projectFiles['package.json']);

            // Detect frontend frameworks
            if (pkg.dependencies?.react || pkg.dependencies?.vue || pkg.dependencies?.svelte) {
                analysis.hasFrontend = true;
                analysis.frontendFramework = pkg.dependencies?.react ? 'react' :
                    pkg.dependencies?.vue ? 'vue' : 'svelte';
            }

            if (pkg.dependencies?.next) {
                analysis.hasFrontend = true;
                analysis.hasBackend = true;
                analysis.frontendFramework = 'nextjs';
            }

            // Detect backend
            if (pkg.dependencies?.express || pkg.dependencies?.fastify || pkg.dependencies?.hono) {
                analysis.hasBackend = true;
                analysis.backendFramework = pkg.dependencies?.express ? 'express' :
                    pkg.dependencies?.fastify ? 'fastify' : 'hono';
            }

            // Detect ML libraries
            if (pkg.dependencies?.['@huggingface/inference'] ||
                pkg.dependencies?.replicate ||
                pkg.dependencies?.openai) {
                analysis.hasMLModels = true;
            }
        }

        // Check for requirements.txt (Python)
        if (projectFiles['requirements.txt']) {
            const requirements = projectFiles['requirements.txt'];

            if (requirements.includes('transformers') ||
                requirements.includes('diffusers') ||
                requirements.includes('torch')) {
                analysis.hasMLModels = true;
                analysis.hasBackend = true;
            }

            if (requirements.includes('fastapi') || requirements.includes('flask')) {
                analysis.hasBackend = true;
                analysis.backendFramework = requirements.includes('fastapi') ? 'fastapi' : 'flask';
            }
        }

        // Check for database usage
        if (projectFiles['prisma/schema.prisma'] ||
            projectFiles['drizzle.config.ts'] ||
            projectFiles['package.json']?.includes('postgres') ||
            projectFiles['package.json']?.includes('mongodb')) {
            analysis.hasDatabase = true;
        }

        // Determine deployment targets
        if (analysis.hasFrontend && !analysis.hasBackend && !analysis.hasMLModels) {
            analysis.deploymentTargets = ['vercel', 'netlify', 'cloudflare'];
            analysis.estimatedComplexity = 'simple';
        } else if (analysis.hasBackend && !analysis.hasMLModels) {
            analysis.deploymentTargets = ['vercel', 'railway', 'fly'];
            analysis.estimatedComplexity = 'moderate';
        } else if (analysis.hasMLModels) {
            analysis.deploymentTargets = ['runpod', 'replicate', 'modal', 'huggingface'];
            analysis.estimatedComplexity = 'complex';
        }

        return analysis;
    }

    /**
     * Get list of available GPU providers with pricing
     */
    getAvailableProviders(): CloudProvider[] {
        return CLOUD_PROVIDERS;
    }

    /**
     * Get GPU tiers
     */
    getGPUTiers(): GPUTier[] {
        return Object.values(GPU_TIERS);
    }

    // ========================================================================
    // PRIVATE HELPERS
    // ========================================================================

    private inferRequirementsFromModelInfo(modelId: string, info: any): ModelRequirements {
        // Parse model info from HuggingFace
        const modelName = modelId.split('/').pop() || modelId;
        let estimatedVRAM = 16;
        let framework: ModelRequirements['framework'] = 'transformers';
        let taskType: ModelRequirements['taskType'] = 'custom';

        // Detect framework from library tags
        if (info.library_name === 'diffusers') {
            framework = 'diffusers';
            taskType = 'text-to-image';
        } else if (info.library_name === 'transformers') {
            framework = 'transformers';
        }

        // Detect task from pipeline tag
        if (info.pipeline_tag) {
            const pipelineMap: Record<string, ModelRequirements['taskType']> = {
                'text-generation': 'text-generation',
                'text-to-image': 'text-to-image',
                'image-to-image': 'image-to-image',
                'automatic-speech-recognition': 'audio',
                'feature-extraction': 'embedding',
                'text-classification': 'classification',
            };
            taskType = pipelineMap[info.pipeline_tag] || 'custom';
        }

        // Estimate VRAM from safetensors size or parameter count
        if (info.safetensors?.total) {
            // Safetensors size in bytes, rough estimate: size / 2 for fp16
            estimatedVRAM = Math.ceil((info.safetensors.total / (1024 * 1024 * 1024)) * 2);
        }

        // Determine GPU requirements
        const minimumGPU = this.selectGPUForVRAM(estimatedVRAM);
        const recommendedGPU = this.selectGPUForVRAM(estimatedVRAM * 1.5);

        return {
            modelId,
            modelName,
            framework,
            taskType,
            estimatedVRAM,
            minimumGPU,
            recommendedGPU,
            estimatedInferenceTime: framework === 'diffusers' ? 10 : 2,
            requiresQuantization: estimatedVRAM > 24,
            quantizationOptions: estimatedVRAM > 24 ? ['GPTQ', 'AWQ', 'GGUF'] : [],
        };
    }

    private inferRequirementsFromName(modelId: string): ModelRequirements {
        const modelName = modelId.split('/').pop() || modelId;
        const nameLower = modelName.toLowerCase();

        let estimatedVRAM = 16;
        let framework: ModelRequirements['framework'] = 'transformers';
        let taskType: ModelRequirements['taskType'] = 'custom';

        // Detect by name patterns
        if (nameLower.includes('stable-diffusion') || nameLower.includes('sdxl') ||
            nameLower.includes('flux') || nameLower.includes('dit')) {
            framework = 'diffusers';
            taskType = 'text-to-image';
            estimatedVRAM = nameLower.includes('xl') ? 12 : 8;
        } else if (nameLower.includes('llama') || nameLower.includes('mistral') ||
                   nameLower.includes('qwen') || nameLower.includes('phi')) {
            framework = 'transformers';
            taskType = 'text-generation';

            // Estimate size from name
            const sizeMatch = nameLower.match(/(\d+)b/);
            if (sizeMatch) {
                const billions = parseInt(sizeMatch[1]);
                estimatedVRAM = VRAM_BY_PARAMS[`${billions}b`] || billions * 2;
            }
        } else if (nameLower.includes('whisper')) {
            framework = 'transformers';
            taskType = 'audio';
            estimatedVRAM = 6;
        } else if (nameLower.includes('embed') || nameLower.includes('e5') ||
                   nameLower.includes('bge')) {
            framework = 'transformers';
            taskType = 'embedding';
            estimatedVRAM = 4;
        }

        const minimumGPU = this.selectGPUForVRAM(estimatedVRAM);
        const recommendedGPU = this.selectGPUForVRAM(estimatedVRAM * 1.5);

        return {
            modelId,
            modelName,
            framework,
            taskType,
            estimatedVRAM,
            minimumGPU,
            recommendedGPU,
            estimatedInferenceTime: framework === 'diffusers' ? 10 : 2,
            requiresQuantization: estimatedVRAM > 24,
            quantizationOptions: estimatedVRAM > 24 ? ['GPTQ', 'AWQ', 'GGUF'] : [],
        };
    }

    private selectGPUForVRAM(vram: number): GPUTier {
        const sortedGPUs = Object.values(GPU_TIERS).sort((a, b) => a.vram - b.vram);

        for (const gpu of sortedGPUs) {
            if (gpu.vram >= vram) {
                return gpu;
            }
        }

        // Return highest VRAM GPU if none sufficient
        return sortedGPUs[sortedGPUs.length - 1];
    }

    private findSuitableGPU(provider: CloudProvider, requirements: ModelRequirements): GPUTier | null {
        const sortedGPUs = provider.gpuTypes.sort((a, b) => a.vram - b.vram);

        for (const gpu of sortedGPUs) {
            if (gpu.vram >= requirements.estimatedVRAM) {
                return gpu;
            }
        }

        return null;
    }

    private createRecommendation(
        provider: CloudProvider,
        gpu: GPUTier,
        requirements: ModelRequirements,
        hasCredentials: boolean
    ): DeploymentRecommendation {
        // Calculate estimated costs
        let costPerHour = provider.minCostPerHour || 0;

        if (provider.supportsGPU) {
            // GPU cost scales with VRAM
            const vramMultiplier = gpu.vram / 16; // Base is T4 at 16GB
            costPerHour = (provider.minCostPerHour || 0.20) * vramMultiplier;
        }

        // Calculate score
        let score = 50; // Base score

        // Prefer providers with credentials
        if (hasCredentials) score += 20;

        // Prefer providers with matching GPU
        if (gpu.vram >= requirements.recommendedGPU.vram) score += 15;
        else if (gpu.vram >= requirements.minimumGPU.vram) score += 10;

        // Cost efficiency (lower is better)
        if (costPerHour < 0.50) score += 10;
        else if (costPerHour < 1.00) score += 5;

        // Serverless preference for occasional use
        if (provider.type === 'serverless') score += 5;

        const reasons: string[] = [];

        if (hasCredentials) reasons.push('Already connected');
        if (gpu.vram >= requirements.recommendedGPU.vram) reasons.push('Optimal GPU');
        if (provider.type === 'serverless') reasons.push('Pay per use');
        if (costPerHour < 0.50) reasons.push('Cost effective');

        return {
            provider,
            gpuType: gpu,
            estimatedCostPerHour: costPerHour,
            estimatedCostPerRequest: costPerHour / 3600 * requirements.estimatedInferenceTime,
            coldStartTime: provider.type === 'serverless' ? 30 : 0,
            warmStartTime: provider.type === 'serverless' ? 1 : 0,
            scalingConfig: {
                minReplicas: 0,
                maxReplicas: 10,
                targetUtilization: 80,
            },
            score,
            reasons,
        };
    }

    /**
     * Get appropriate Docker base image for a framework
     */
    private getDockerBaseImage(framework: ModelRequirements['framework']): string {
        const baseImages: Record<string, string> = {
            'transformers': 'pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime',
            'diffusers': 'pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime',
            'torch': 'pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime',
            'tensorflow': 'tensorflow/tensorflow:2.14.0-gpu',
            'onnx': 'nvcr.io/nvidia/tritonserver:23.12-py3',
            'custom': 'python:3.11-slim',
        };
        return baseImages[framework] || baseImages['custom'];
    }

    /**
     * Map our framework type to HuggingFace framework type
     */
    private mapFramework(framework: ModelRequirements['framework']): 'transformers' | 'diffusers' | 'sentence-transformers' | 'other' {
        const frameworkMap: Record<string, 'transformers' | 'diffusers' | 'sentence-transformers' | 'other'> = {
            'transformers': 'transformers',
            'diffusers': 'diffusers',
            'torch': 'other',
            'tensorflow': 'other',
            'onnx': 'other',
            'custom': 'other',
        };
        return frameworkMap[framework] || 'other';
    }

    /**
     * Map internal GPU tier names to HuggingFace GPUType format
     */
    private mapGPUToHuggingFace(gpuName: string): import('../cloud/types').GPUType {
        const gpuMap: Record<string, import('../cloud/types').GPUType> = {
            'T4': 'nvidia-t4',
            't4': 'nvidia-t4',
            'A10G': 'nvidia-a40',
            'a10g': 'nvidia-a40',
            'A100': 'nvidia-a100-80gb',
            'a100': 'nvidia-a100-80gb',
            'A100-40GB': 'nvidia-a100-40gb',
            'A100-80GB': 'nvidia-a100-80gb',
            'V100': 'nvidia-v100',
            'v100': 'nvidia-v100',
            'L4': 'nvidia-l40',
            'l4': 'nvidia-l40',
            'L40': 'nvidia-l40',
            'H100': 'nvidia-h100',
            'h100': 'nvidia-h100',
            'RTX 4090': 'nvidia-rtx-4090',
            'RTX 3090': 'nvidia-rtx-3090',
        };
        return gpuMap[gpuName] || 'nvidia-t4';
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: SmartDeploymentService | null = null;

export function getSmartDeploymentService(): SmartDeploymentService {
    if (!instance) {
        instance = new SmartDeploymentService();
    }
    return instance;
}

