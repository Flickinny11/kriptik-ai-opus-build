/**
 * Fal.ai Deployments Service
 *
 * Full integration with Fal.ai's deployment platform for:
 * - Deploying serverless AI applications
 * - GPU-accelerated model inference
 * - Custom container deployments
 * - Pre-built model endpoints
 *
 * Fal specializes in generative AI with zero cold starts.
 */

import { db } from '../../db.js';
import { deployments } from '../../schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export interface FalConfig {
    apiKey: string;
}

export interface FalApp {
    app_id: string;
    name: string;
    owner: string;
    status: 'active' | 'inactive' | 'deploying' | 'error';
    created_at: string;
    url?: string;
}

export interface FalDeployment {
    deployment_id: string;
    app_id: string;
    version: string;
    status: 'active' | 'inactive' | 'failed';
    created_at: string;
    machine_type?: string;
    min_instances?: number;
    max_instances?: number;
}

export interface CreateFalAppRequest {
    name: string;
    description?: string;
    machineType: 'GPU' | 'GPU-A100' | 'GPU-H100' | 'CPU';
    minInstances?: number;
    maxInstances?: number;
    // The model/application code
    handler: string;
    requirements?: string[];
    // KripTik specific
    projectId: string;
    userId: string;
}

export interface FalPrediction {
    request_id: string;
    status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    logs?: string[];
    output?: unknown;
    error?: string;
    metrics?: {
        inference_time?: number;
        queue_time?: number;
    };
}

export interface FalRunRequest {
    input: Record<string, unknown>;
    webhook_url?: string;
}

// Fal machine pricing (approximate USD per second)
export const FAL_MACHINE_PRICING: Record<string, number> = {
    'GPU': 0.00019,      // A10G equivalent
    'GPU-A100': 0.00115, // A100-40GB
    'GPU-H100': 0.00198, // H100
    'CPU': 0.000012,
};

// ============================================================================
// SERVICE
// ============================================================================

export class FalService {
    private apiKey: string;
    private baseUrl = 'https://fal.run';
    private apiUrl = 'https://queue.fal.run';

    constructor(config: FalConfig) {
        this.apiKey = config.apiKey;
    }

    private async request<T>(
        url: string,
        options: RequestInit = {}
    ): Promise<T> {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Key ${this.apiKey}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Fal API error (${response.status}): ${error}`);
        }

        return response.json() as Promise<T>;
    }

    // ========================================================================
    // PRE-BUILT MODELS (Fal's strength - instant inference)
    // ========================================================================

    /**
     * Run inference on a pre-built Fal model
     */
    async runModel(modelId: string, input: Record<string, unknown>): Promise<FalPrediction> {
        return this.request(`${this.apiUrl}/${modelId}`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    }

    /**
     * Run with webhook callback
     */
    async runModelWithWebhook(
        modelId: string,
        request: FalRunRequest
    ): Promise<{ request_id: string }> {
        return this.request(`${this.apiUrl}/${modelId}`, {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }

    /**
     * Get prediction status
     */
    async getStatus(modelId: string, requestId: string): Promise<FalPrediction> {
        return this.request(`${this.apiUrl}/${modelId}/requests/${requestId}/status`);
    }

    /**
     * Get prediction result
     */
    async getResult(modelId: string, requestId: string): Promise<FalPrediction> {
        return this.request(`${this.apiUrl}/${modelId}/requests/${requestId}`);
    }

    /**
     * Cancel a running prediction
     */
    async cancelRequest(modelId: string, requestId: string): Promise<void> {
        await this.request(`${this.apiUrl}/${modelId}/requests/${requestId}/cancel`, {
            method: 'PUT',
        });
    }

    // ========================================================================
    // CUSTOM DEPLOYMENTS
    // ========================================================================

    /**
     * Deploy a custom Fal application
     *
     * Fal uses Python-based app definitions similar to Modal.
     * This generates the code and deployment configuration.
     */
    async createDeployment(request: CreateFalAppRequest): Promise<{
        appCode: string;
        deploymentInstructions: string;
        estimatedCost: number;
        deploymentId: string;
    }> {
        // Generate Fal app code
        const appCode = this.generateAppCode(request);

        // Calculate estimated cost
        const pricePerSecond = FAL_MACHINE_PRICING[request.machineType] || 0.0005;
        const minInstances = request.minInstances || 0;
        // Estimate: min instances running 24/7 + burst usage
        const estimatedMonthlyCost = minInstances > 0
            ? pricePerSecond * 60 * 60 * 24 * 30 * minInstances
            : pricePerSecond * 10 * 1000 * 30; // 1000 requests/day, 10s each

        // Save deployment record
        const deploymentId = uuidv4();
        await db.insert(deployments).values({
            id: deploymentId,
            projectId: request.projectId,
            userId: request.userId,
            provider: 'fal',
            resourceType: 'serverless-app',
            config: {
                name: request.name,
                machineType: request.machineType,
                minInstances: request.minInstances,
                maxInstances: request.maxInstances,
            },
            status: 'pending',
            estimatedMonthlyCost: Math.round(estimatedMonthlyCost * 100) / 100,
        });

        const deploymentInstructions = `
# Deploy to Fal.ai

1. Save the generated code to a file (e.g., app.py)
2. Install Fal CLI: pip install fal
3. Login to Fal: fal auth login
4. Deploy: fal deploy app.py

Your app will be available at: https://fal.run/<your-username>/${request.name}

# Environment Setup
export FAL_KEY="${this.apiKey}"
        `.trim();

        return {
            appCode,
            deploymentInstructions,
            estimatedCost: Math.round(estimatedMonthlyCost * 100) / 100,
            deploymentId,
        };
    }

    /**
     * Generate Fal app Python code
     */
    private generateAppCode(request: CreateFalAppRequest): string {
        const code: string[] = [];

        // Header
        code.push('"""');
        code.push(`Fal App: ${request.name}`);
        if (request.description) code.push(request.description);
        code.push('Generated by KripTik AI');
        code.push('"""');
        code.push('');

        // Imports
        code.push('import fal');
        if (request.requirements?.length) {
            code.push('');
            code.push('# Additional imports will be installed via requirements');
        }
        code.push('');

        // Requirements file content
        if (request.requirements?.length) {
            code.push('# requirements.txt:');
            code.push('# ' + request.requirements.join('\n# '));
            code.push('');
        }

        // Machine configuration
        const machineConfig = this.getMachineConfig(request.machineType);

        // App definition
        code.push('@fal.function(');
        code.push(`    machine_type="${machineConfig}",`);
        if (request.minInstances) {
            code.push(`    min_instances=${request.minInstances},`);
        }
        if (request.maxInstances) {
            code.push(`    max_instances=${request.maxInstances},`);
        }
        code.push(')');
        code.push(`def ${request.name.replace(/-/g, '_')}(input_data: dict) -> dict:`);
        code.push('    """');
        code.push(`    ${request.name} endpoint`);
        code.push('    """');

        // Add handler code
        if (request.handler) {
            const handlerLines = request.handler.split('\n');
            for (const line of handlerLines) {
                code.push(`    ${line}`);
            }
        } else {
            code.push('    # TODO: Implement handler');
            code.push('    return {"status": "ok", "input": input_data}');
        }

        code.push('');
        code.push('');
        code.push('if __name__ == "__main__":');
        code.push('    # For local testing');
        code.push('    result = ' + request.name.replace(/-/g, '_') + '({"test": "input"})');
        code.push('    print(result)');

        return code.join('\n');
    }

    private getMachineConfig(machineType: string): string {
        const mapping: Record<string, string> = {
            'GPU': 'GPU',
            'GPU-A100': 'GPU-A100',
            'GPU-H100': 'GPU-H100',
            'CPU': 'CPU',
        };
        return mapping[machineType] || 'GPU';
    }

    // ========================================================================
    // DEPLOYMENT MANAGEMENT
    // ========================================================================

    /**
     * List deployments (via KripTik database)
     */
    async listDeployments(userId: string): Promise<FalDeployment[]> {
        const dbDeployments = await db
            .select()
            .from(deployments)
            .where(eq(deployments.provider, 'fal'));

        return dbDeployments.map(d => ({
            deployment_id: d.id,
            app_id: d.providerResourceId || d.id,
            version: '1.0',
            status: d.status as 'active' | 'inactive' | 'failed',
            created_at: d.createdAt,
            machine_type: (d.config as Record<string, unknown>)?.machineType as string,
            min_instances: (d.config as Record<string, unknown>)?.minInstances as number,
            max_instances: (d.config as Record<string, unknown>)?.maxInstances as number,
        }));
    }

    /**
     * Update deployment status
     */
    async updateDeploymentStatus(deploymentId: string, status: string): Promise<void> {
        await db.update(deployments)
            .set({ status, updatedAt: new Date().toISOString() })
            .where(eq(deployments.id, deploymentId));
    }

    // ========================================================================
    // COST ESTIMATION
    // ========================================================================

    estimateCost(machineType: string, requestsPerDay: number, avgDurationSeconds: number): {
        perRequest: number;
        daily: number;
        monthly: number;
    } {
        const pricePerSecond = FAL_MACHINE_PRICING[machineType] || 0.0005;
        const perRequest = pricePerSecond * avgDurationSeconds;
        const daily = perRequest * requestsPerDay;
        const monthly = daily * 30;

        return {
            perRequest: Math.round(perRequest * 10000) / 10000,
            daily: Math.round(daily * 100) / 100,
            monthly: Math.round(monthly * 100) / 100,
        };
    }
}

// ============================================================================
// FAL PRE-BUILT MODELS REGISTRY (for AI-driven model selection)
// ============================================================================

export const FAL_MODELS = {
    // Image Generation
    'fal-ai/flux/dev': {
        name: 'FLUX.1 [dev]',
        description: 'High-quality image generation',
        category: 'image-generation',
        inputSchema: {
            prompt: 'string',
            image_size: 'string?',
            num_inference_steps: 'number?',
            guidance_scale: 'number?',
            num_images: 'number?',
            seed: 'number?',
        },
    },
    'fal-ai/flux/schnell': {
        name: 'FLUX.1 [schnell]',
        description: 'Fast image generation (4 steps)',
        category: 'image-generation',
        inputSchema: {
            prompt: 'string',
            image_size: 'string?',
            num_images: 'number?',
            seed: 'number?',
        },
    },
    'fal-ai/flux-pro': {
        name: 'FLUX.1 Pro',
        description: 'Professional image generation',
        category: 'image-generation',
        inputSchema: {
            prompt: 'string',
            image_size: 'string?',
            num_images: 'number?',
            safety_tolerance: 'string?',
        },
    },
    'fal-ai/stable-diffusion-v3-medium': {
        name: 'Stable Diffusion 3 Medium',
        description: 'SD3 medium quality images',
        category: 'image-generation',
        inputSchema: {
            prompt: 'string',
            negative_prompt: 'string?',
            image_size: 'string?',
        },
    },

    // Image Editing
    'fal-ai/imageutils/rembg': {
        name: 'Remove Background',
        description: 'AI background removal',
        category: 'image-processing',
        inputSchema: {
            image_url: 'string',
        },
    },
    'fal-ai/ccsr': {
        name: 'Image Upscaler',
        description: 'AI image upscaling',
        category: 'image-processing',
        inputSchema: {
            image_url: 'string',
            scale: 'number?',
        },
    },

    // Video Generation
    'fal-ai/fast-svd-lcm': {
        name: 'Fast SVD',
        description: 'Image-to-video generation',
        category: 'video-generation',
        inputSchema: {
            image_url: 'string',
            motion_bucket_id: 'number?',
            fps: 'number?',
        },
    },
    'fal-ai/animatediff-v2v': {
        name: 'AnimateDiff v2v',
        description: 'Video-to-video animation',
        category: 'video-generation',
        inputSchema: {
            video_url: 'string',
            prompt: 'string',
        },
    },

    // Audio
    'fal-ai/whisper': {
        name: 'Whisper',
        description: 'Speech-to-text transcription',
        category: 'audio-processing',
        inputSchema: {
            audio_url: 'string',
            language: 'string?',
            task: 'string?',
        },
    },

    // Face/Portrait
    'fal-ai/face-to-sticker': {
        name: 'Face to Sticker',
        description: 'Convert face photo to sticker',
        category: 'image-processing',
        inputSchema: {
            image_url: 'string',
            prompt: 'string?',
        },
    },
};

// ============================================================================
// SINGLETON
// ============================================================================

let falInstance: FalService | null = null;

export function getFalService(config?: FalConfig): FalService {
    if (!falInstance && config) {
        falInstance = new FalService(config);
    }
    if (!falInstance) {
        throw new Error('Fal service not initialized');
    }
    return falInstance;
}

export function createFalService(config: FalConfig): FalService {
    return new FalService(config);
}
