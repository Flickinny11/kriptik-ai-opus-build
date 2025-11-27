/**
 * Replicate Deployments Service
 *
 * Full integration with Replicate's Deployments API for:
 * - Creating deployments (custom model endpoints)
 * - Managing scaling (min/max instances)
 * - Hardware customization
 * - Monitoring predictions and performance
 *
 * Use case: Users describe their AI workflow (video, audio, image generation)
 * KripTik decides which models to use and deploys them via Replicate.
 */

import { db } from '../../db.js';
import { deployments } from '../../schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export interface ReplicateConfig {
    apiToken: string;
}

export interface ReplicateDeployment {
    owner: string;
    name: string;
    current_release?: {
        number: number;
        model: string;
        version: string;
        created_at: string;
        created_by: {
            type: string;
            username: string;
        };
        configuration: {
            hardware: string;
            min_instances: number;
            max_instances: number;
        };
    };
}

export interface CreateDeploymentRequest {
    name: string;
    model: string;
    version: string;
    hardware: 'cpu' | 'gpu-t4-nano' | 'gpu-a40-small' | 'gpu-a40-large' | 'gpu-a100-large';
    minInstances?: number;
    maxInstances?: number;
    // KripTik specific
    projectId: string;
    userId: string;
}

export interface UpdateDeploymentRequest {
    minInstances?: number;
    maxInstances?: number;
    hardware?: string;
    version?: string;
}

export interface ReplicatePrediction {
    id: string;
    model: string;
    version: string;
    status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
    input: Record<string, unknown>;
    output?: unknown;
    error?: string;
    logs?: string;
    metrics?: {
        predict_time?: number;
    };
    created_at: string;
    started_at?: string;
    completed_at?: string;
    urls: {
        get: string;
        cancel: string;
    };
}

export interface DeploymentPredictionRequest {
    input: Record<string, unknown>;
    webhook?: string;
    webhook_events_filter?: ('start' | 'output' | 'logs' | 'completed')[];
}

// Hardware pricing (approximate USD per second)
export const REPLICATE_HARDWARE_PRICING: Record<string, number> = {
    'cpu': 0.000100,
    'gpu-t4-nano': 0.000225,
    'gpu-a40-small': 0.000575,
    'gpu-a40-large': 0.000725,
    'gpu-a100-large': 0.001400,
};

// ============================================================================
// SERVICE
// ============================================================================

export class ReplicateService {
    private apiToken: string;
    private baseUrl = 'https://api.replicate.com/v1';

    constructor(config: ReplicateConfig) {
        this.apiToken = config.apiToken;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Token ${this.apiToken}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Replicate API error (${response.status}): ${error}`);
        }

        return response.json() as Promise<T>;
    }

    // ========================================================================
    // DEPLOYMENTS
    // ========================================================================

    /**
     * List all deployments for the authenticated user
     */
    async listDeployments(): Promise<{ results: ReplicateDeployment[] }> {
        return this.request('/deployments');
    }

    /**
     * Get a specific deployment
     */
    async getDeployment(owner: string, name: string): Promise<ReplicateDeployment> {
        return this.request(`/deployments/${owner}/${name}`);
    }

    /**
     * Create a new deployment
     */
    async createDeployment(request: CreateDeploymentRequest): Promise<ReplicateDeployment> {
        const deployment = await this.request<ReplicateDeployment>('/deployments', {
            method: 'POST',
            body: JSON.stringify({
                name: request.name,
                model: request.model,
                version: request.version,
                hardware: request.hardware,
                min_instances: request.minInstances ?? 0,
                max_instances: request.maxInstances ?? 1,
            }),
        });

        // Save to database
        await db.insert(deployments).values({
            id: uuidv4(),
            projectId: request.projectId,
            userId: request.userId,
            provider: 'replicate',
            resourceType: 'model-deployment',
            config: {
                owner: deployment.owner,
                name: deployment.name,
                model: request.model,
                version: request.version,
                hardware: request.hardware,
                minInstances: request.minInstances ?? 0,
                maxInstances: request.maxInstances ?? 1,
            },
            status: 'active',
            providerResourceId: `${deployment.owner}/${deployment.name}`,
            url: `https://replicate.com/deployments/${deployment.owner}/${deployment.name}`,
            estimatedMonthlyCost: this.estimateMonthlyCost(
                request.hardware,
                request.minInstances ?? 0
            ),
        });

        return deployment;
    }

    /**
     * Update a deployment's configuration
     */
    async updateDeployment(
        owner: string,
        name: string,
        updates: UpdateDeploymentRequest
    ): Promise<ReplicateDeployment> {
        const body: Record<string, unknown> = {};
        if (updates.minInstances !== undefined) body.min_instances = updates.minInstances;
        if (updates.maxInstances !== undefined) body.max_instances = updates.maxInstances;
        if (updates.hardware !== undefined) body.hardware = updates.hardware;
        if (updates.version !== undefined) body.version = updates.version;

        return this.request(`/deployments/${owner}/${name}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        });
    }

    /**
     * Delete a deployment
     */
    async deleteDeployment(owner: string, name: string): Promise<void> {
        await this.request(`/deployments/${owner}/${name}`, {
            method: 'DELETE',
        });

        // Update database
        await db.update(deployments)
            .set({ status: 'terminated' })
            .where(eq(deployments.providerResourceId, `${owner}/${name}`));
    }

    // ========================================================================
    // PREDICTIONS (Running inference on deployments)
    // ========================================================================

    /**
     * Create a prediction on a deployment
     */
    async createPrediction(
        owner: string,
        name: string,
        request: DeploymentPredictionRequest
    ): Promise<ReplicatePrediction> {
        return this.request(`/deployments/${owner}/${name}/predictions`, {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }

    /**
     * Get prediction status
     */
    async getPrediction(predictionId: string): Promise<ReplicatePrediction> {
        return this.request(`/predictions/${predictionId}`);
    }

    /**
     * Cancel a prediction
     */
    async cancelPrediction(predictionId: string): Promise<ReplicatePrediction> {
        return this.request(`/predictions/${predictionId}/cancel`, {
            method: 'POST',
        });
    }

    // ========================================================================
    // MODELS (for discovery)
    // ========================================================================

    /**
     * Search for models on Replicate
     */
    async searchModels(query: string): Promise<{ results: Array<{
        url: string;
        owner: string;
        name: string;
        description: string;
        visibility: string;
        latest_version?: {
            id: string;
            created_at: string;
        };
    }> }> {
        return this.request(`/models?query=${encodeURIComponent(query)}`);
    }

    /**
     * Get a specific model
     */
    async getModel(owner: string, name: string): Promise<{
        url: string;
        owner: string;
        name: string;
        description: string;
        latest_version: {
            id: string;
            created_at: string;
            cog_version: string;
            openapi_schema: Record<string, unknown>;
        };
    }> {
        return this.request(`/models/${owner}/${name}`);
    }

    /**
     * Get model versions
     */
    async getModelVersions(owner: string, name: string): Promise<{ results: Array<{
        id: string;
        created_at: string;
        cog_version: string;
    }> }> {
        return this.request(`/models/${owner}/${name}/versions`);
    }

    // ========================================================================
    // COST ESTIMATION
    // ========================================================================

    /**
     * Estimate monthly cost for a deployment
     */
    estimateMonthlyCost(hardware: string, minInstances: number): number {
        const pricePerSecond = REPLICATE_HARDWARE_PRICING[hardware] || 0.0005;
        const secondsPerMonth = 30 * 24 * 60 * 60; // 30 days
        return Math.round(pricePerSecond * secondsPerMonth * minInstances * 100) / 100;
    }

    /**
     * Estimate cost for a single prediction
     */
    estimatePredictionCost(hardware: string, estimatedSeconds: number): number {
        const pricePerSecond = REPLICATE_HARDWARE_PRICING[hardware] || 0.0005;
        return Math.round(pricePerSecond * estimatedSeconds * 10000) / 10000;
    }
}

// ============================================================================
// POPULAR MODELS REGISTRY (for AI-driven model selection)
// ============================================================================

export const REPLICATE_POPULAR_MODELS = {
    // Image Generation
    'stable-diffusion': {
        model: 'stability-ai/stable-diffusion',
        description: 'Text-to-image generation',
        defaultHardware: 'gpu-a40-small',
        category: 'image-generation',
    },
    'sdxl': {
        model: 'stability-ai/sdxl',
        description: 'High-quality text-to-image with SDXL',
        defaultHardware: 'gpu-a40-large',
        category: 'image-generation',
    },
    'flux-pro': {
        model: 'black-forest-labs/flux-pro',
        description: 'State-of-the-art image generation',
        defaultHardware: 'gpu-a40-large',
        category: 'image-generation',
    },
    'flux-schnell': {
        model: 'black-forest-labs/flux-schnell',
        description: 'Fast image generation',
        defaultHardware: 'gpu-a40-small',
        category: 'image-generation',
    },

    // Video Generation
    'stable-video-diffusion': {
        model: 'stability-ai/stable-video-diffusion',
        description: 'Image-to-video generation',
        defaultHardware: 'gpu-a100-large',
        category: 'video-generation',
    },
    'animate-diff': {
        model: 'lucataco/animate-diff',
        description: 'Text-to-video animation',
        defaultHardware: 'gpu-a40-large',
        category: 'video-generation',
    },

    // Audio Generation
    'musicgen': {
        model: 'meta/musicgen',
        description: 'Text-to-music generation',
        defaultHardware: 'gpu-a40-small',
        category: 'audio-generation',
    },
    'bark': {
        model: 'suno-ai/bark',
        description: 'Text-to-speech with emotions',
        defaultHardware: 'gpu-a40-small',
        category: 'audio-generation',
    },

    // Image Processing
    'real-esrgan': {
        model: 'nightmareai/real-esrgan',
        description: 'Image upscaling',
        defaultHardware: 'gpu-t4-nano',
        category: 'image-processing',
    },
    'remove-bg': {
        model: 'cjwbw/rembg',
        description: 'Background removal',
        defaultHardware: 'gpu-t4-nano',
        category: 'image-processing',
    },

    // Language Models
    'llama-2-70b': {
        model: 'meta/llama-2-70b-chat',
        description: 'Large language model for chat',
        defaultHardware: 'gpu-a100-large',
        category: 'language-model',
    },
    'mistral-7b': {
        model: 'mistralai/mistral-7b-instruct-v0.2',
        description: 'Efficient language model',
        defaultHardware: 'gpu-a40-small',
        category: 'language-model',
    },
};

// ============================================================================
// SINGLETON
// ============================================================================

let replicateInstance: ReplicateService | null = null;

export function getReplicateService(config?: ReplicateConfig): ReplicateService {
    if (!replicateInstance && config) {
        replicateInstance = new ReplicateService(config);
    }
    if (!replicateInstance) {
        throw new Error('Replicate service not initialized');
    }
    return replicateInstance;
}

export function createReplicateService(config: ReplicateConfig): ReplicateService {
    return new ReplicateService(config);
}
