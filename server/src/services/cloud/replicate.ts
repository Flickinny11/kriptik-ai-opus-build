/**
 * Replicate Cloud Service
 *
 * Integration with Replicate for AI model hosting and inference.
 */

import { ServerlessConfig, ServerlessDeployment, DeploymentStatus } from './types.js';

export interface ReplicatePrediction {
    id: string;
    version: string;
    status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
    input: Record<string, unknown>;
    output?: unknown;
    error?: string;
    logs?: string;
    created_at: string;
    completed_at?: string;
    urls: {
        get: string;
        cancel: string;
    };
}

export class ReplicateService {
    private apiToken?: string;
    private baseUrl = 'https://api.replicate.com/v1';

    constructor() {
        this.apiToken = process.env.REPLICATE_API_TOKEN;
    }

    /**
     * Validate credentials
     */
    async validateCredentials(): Promise<boolean> {
        if (!this.apiToken) return false;

        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                headers: { 'Authorization': `Token ${this.apiToken}` },
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Run a prediction
     */
    async runPrediction(
        modelId: string,
        version: string,
        input: Record<string, unknown>
    ): Promise<ReplicatePrediction> {
        if (!this.apiToken) {
            throw new Error('Replicate API token not configured');
        }

        const response = await fetch(`${this.baseUrl}/predictions`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${this.apiToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                version,
                input,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create prediction');
        }

        return response.json();
    }

    /**
     * Get prediction status
     */
    async getPrediction(predictionId: string): Promise<ReplicatePrediction> {
        if (!this.apiToken) {
            throw new Error('Replicate API token not configured');
        }

        const response = await fetch(`${this.baseUrl}/predictions/${predictionId}`, {
            headers: { 'Authorization': `Token ${this.apiToken}` },
        });

        if (!response.ok) {
            throw new Error('Failed to get prediction');
        }

        return response.json();
    }

    /**
     * Cancel a prediction
     */
    async cancelPrediction(predictionId: string): Promise<void> {
        if (!this.apiToken) {
            throw new Error('Replicate API token not configured');
        }

        await fetch(`${this.baseUrl}/predictions/${predictionId}/cancel`, {
            method: 'POST',
            headers: { 'Authorization': `Token ${this.apiToken}` },
        });
    }

    /**
     * Get available models
     */
    async listModels(owner?: string): Promise<unknown[]> {
        if (!this.apiToken) {
            throw new Error('Replicate API token not configured');
        }

        const url = owner
            ? `${this.baseUrl}/models?owner=${owner}`
            : `${this.baseUrl}/models`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Token ${this.apiToken}` },
        });

        if (!response.ok) {
            throw new Error('Failed to list models');
        }

        const data = await response.json();
        return data.results || [];
    }

    /**
     * Get model details
     */
    async getModel(owner: string, name: string): Promise<unknown> {
        if (!this.apiToken) {
            throw new Error('Replicate API token not configured');
        }

        const response = await fetch(`${this.baseUrl}/models/${owner}/${name}`, {
            headers: { 'Authorization': `Token ${this.apiToken}` },
        });

        if (!response.ok) {
            throw new Error('Failed to get model');
        }

        return response.json();
    }
}

// Singleton instance
let instance: ReplicateService | null = null;

export function getReplicateService(): ReplicateService {
    if (!instance) {
        instance = new ReplicateService();
    }
    return instance;
}
