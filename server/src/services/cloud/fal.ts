/**
 * Fal.ai Cloud Service
 *
 * Integration with Fal.ai for fast AI inference.
 */

import { ServerlessConfig, ServerlessDeployment, DeploymentStatus } from './types.js';

export interface FalRequest {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: unknown;
    error?: string;
    logs?: string[];
}

export class FalService {
    private apiKey?: string;
    private baseUrl = 'https://fal.run';

    constructor() {
        this.apiKey = process.env.FAL_KEY;
    }

    /**
     * Validate credentials
     */
    async validateCredentials(): Promise<boolean> {
        return !!this.apiKey;
    }

    /**
     * Run a model
     */
    async run(modelId: string, input: Record<string, unknown>): Promise<unknown> {
        if (!this.apiKey) {
            throw new Error('Fal.ai API key not configured');
        }

        const response = await fetch(`${this.baseUrl}/${modelId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(input),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to run model');
        }

        return response.json();
    }

    /**
     * Submit a request to the queue
     */
    async submit(modelId: string, input: Record<string, unknown>): Promise<{ request_id: string }> {
        if (!this.apiKey) {
            throw new Error('Fal.ai API key not configured');
        }

        const response = await fetch(`https://queue.fal.run/${modelId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(input),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to submit request');
        }

        return response.json();
    }

    /**
     * Get request status
     */
    async getStatus(modelId: string, requestId: string): Promise<FalRequest> {
        if (!this.apiKey) {
            throw new Error('Fal.ai API key not configured');
        }

        const response = await fetch(`https://queue.fal.run/${modelId}/requests/${requestId}/status`, {
            headers: { 'Authorization': `Key ${this.apiKey}` },
        });

        if (!response.ok) {
            throw new Error('Failed to get request status');
        }

        return response.json();
    }

    /**
     * Get request result
     */
    async getResult(modelId: string, requestId: string): Promise<unknown> {
        if (!this.apiKey) {
            throw new Error('Fal.ai API key not configured');
        }

        const response = await fetch(`https://queue.fal.run/${modelId}/requests/${requestId}`, {
            headers: { 'Authorization': `Key ${this.apiKey}` },
        });

        if (!response.ok) {
            throw new Error('Failed to get request result');
        }

        return response.json();
    }

    /**
     * Cancel a request
     */
    async cancel(modelId: string, requestId: string): Promise<void> {
        if (!this.apiKey) {
            throw new Error('Fal.ai API key not configured');
        }

        await fetch(`https://queue.fal.run/${modelId}/requests/${requestId}/cancel`, {
            method: 'PUT',
            headers: { 'Authorization': `Key ${this.apiKey}` },
        });
    }
}

// Singleton instance
let instance: FalService | null = null;

export function getFalService(): FalService {
    if (!instance) {
        instance = new FalService();
    }
    return instance;
}
