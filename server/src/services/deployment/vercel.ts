/**
 * Vercel Deployment Integration
 *
 * Deploy static sites and serverless functions to Vercel
 */

import { v4 as uuidv4 } from 'uuid';

const VERCEL_API_BASE = 'https://api.vercel.com';

export interface VercelDeploymentConfig {
    name: string;
    files: Array<{
        file: string;
        data: string;
        encoding?: 'utf-8' | 'base64';
    }>;
    projectSettings?: {
        buildCommand?: string;
        outputDirectory?: string;
        framework?: string;
        nodeVersion?: string;
    };
    environmentVariables?: Record<string, string>;
    target?: 'production' | 'preview';
}

export interface VercelDeployment {
    id: string;
    url: string;
    state: 'QUEUED' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED';
    createdAt: number;
    readyState?: string;
    alias?: string[];
}

export interface VercelProject {
    id: string;
    name: string;
    accountId: string;
    createdAt: number;
    framework?: string;
}

/**
 * Vercel Deployment Service
 */
export class VercelService {
    private token: string;
    private teamId?: string;

    constructor(token: string, teamId?: string) {
        this.token = token;
        this.teamId = teamId;
    }

    /**
     * Make authenticated API request
     */
    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = new URL(endpoint, VERCEL_API_BASE);
        if (this.teamId) {
            url.searchParams.set('teamId', this.teamId);
        }

        const response = await fetch(url.toString(), {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `Vercel API error: ${response.status}`);
        }

        return response.json();
    }

    /**
     * Deploy files to Vercel
     */
    async deploy(config: VercelDeploymentConfig): Promise<VercelDeployment> {
        // Create deployment
        const deployment = await this.request<VercelDeployment>('/v13/deployments', {
            method: 'POST',
            body: JSON.stringify({
                name: config.name,
                files: config.files.map(f => ({
                    file: f.file,
                    data: f.data,
                    encoding: f.encoding || 'utf-8',
                })),
                projectSettings: config.projectSettings,
                target: config.target || 'production',
            }),
        });

        // Set environment variables if provided
        if (config.environmentVariables && Object.keys(config.environmentVariables).length > 0) {
            await this.setEnvironmentVariables(
                config.name,
                config.environmentVariables
            );
        }

        return deployment;
    }

    /**
     * Get deployment status
     */
    async getDeployment(deploymentId: string): Promise<VercelDeployment> {
        return this.request<VercelDeployment>(`/v13/deployments/${deploymentId}`);
    }

    /**
     * List deployments
     */
    async listDeployments(projectName?: string): Promise<{ deployments: VercelDeployment[] }> {
        const params = new URLSearchParams();
        if (projectName) {
            params.set('projectId', projectName);
        }
        params.set('limit', '20');

        return this.request<{ deployments: VercelDeployment[] }>(
            `/v6/deployments?${params}`
        );
    }

    /**
     * Delete a deployment
     */
    async deleteDeployment(deploymentId: string): Promise<void> {
        await this.request(`/v13/deployments/${deploymentId}`, {
            method: 'DELETE',
        });
    }

    /**
     * Get or create project
     */
    async getOrCreateProject(name: string): Promise<VercelProject> {
        try {
            // Try to get existing project
            return await this.request<VercelProject>(`/v9/projects/${name}`);
        } catch {
            // Create new project
            return this.request<VercelProject>('/v9/projects', {
                method: 'POST',
                body: JSON.stringify({ name }),
            });
        }
    }

    /**
     * Set environment variables
     */
    async setEnvironmentVariables(
        projectName: string,
        variables: Record<string, string>
    ): Promise<void> {
        const envVars = Object.entries(variables).map(([key, value]) => ({
            key,
            value,
            target: ['production', 'preview', 'development'],
            type: 'encrypted',
        }));

        await this.request(`/v10/projects/${projectName}/env`, {
            method: 'POST',
            body: JSON.stringify(envVars),
        });
    }

    /**
     * Add custom domain
     */
    async addDomain(projectName: string, domain: string): Promise<void> {
        await this.request(`/v10/projects/${projectName}/domains`, {
            method: 'POST',
            body: JSON.stringify({ name: domain }),
        });
    }

    /**
     * Validate token
     */
    async validateToken(): Promise<boolean> {
        try {
            await this.request('/v2/user');
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Create a Vercel service instance
 */
export function createVercelService(token: string, teamId?: string): VercelService {
    return new VercelService(token, teamId);
}

