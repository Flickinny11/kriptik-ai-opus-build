/**
 * Vercel Managed Hosting
 *
 * Uses KripTik's Vercel team account to host user full-stack apps.
 * Only used for apps that require SSR/API routes.
 */

interface VercelDeployment {
    id: string;
    url: string;
    state: string;
    readyState: string;
    createdAt: number;
}

interface VercelProject {
    id: string;
    name: string;
    framework: string | null;
}

export class VercelManagedService {
    private token: string;
    private teamId: string | null;
    private baseUrl = 'https://api.vercel.com';

    constructor() {
        // Use KripTik's Vercel token for managed hosting
        this.token = process.env.KRIPTIK_VERCEL_TOKEN || process.env.VERCEL_TOKEN || '';
        this.teamId = process.env.KRIPTIK_VERCEL_TEAM_ID || null;
    }

    /**
     * Check if Vercel is configured
     */
    isConfigured(): boolean {
        return !!this.token;
    }

    /**
     * Make authenticated API request
     */
    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = new URL(`${this.baseUrl}${endpoint}`);
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
            const error = await response.json().catch(() => ({})) as { error?: { message: string } };
            throw new Error(error.error?.message || `Vercel API error: ${response.status}`);
        }

        return response.json();
    }

    /**
     * Get or create a project
     */
    async getOrCreateProject(projectName: string): Promise<VercelProject> {
        if (!this.isConfigured()) {
            throw new Error('Vercel credentials not configured');
        }

        // Try to get existing project
        try {
            const project = await this.request<VercelProject>(`/v9/projects/${projectName}`);
            return project;
        } catch {
            // Project doesn't exist, create it
            const project = await this.request<VercelProject>('/v9/projects', {
                method: 'POST',
                body: JSON.stringify({
                    name: projectName,
                    framework: null, // Auto-detect
                }),
            });
            return project;
        }
    }

    /**
     * Deploy files to Vercel
     */
    async deploy(
        projectId: string,
        files: Array<{ path: string; content: string }>,
        options?: {
            framework?: string;
            environmentVariables?: Record<string, string>;
        }
    ): Promise<{
        deploymentId: string;
        url: string;
        projectName: string;
    }> {
        if (!this.isConfigured()) {
            throw new Error('Vercel credentials not configured');
        }

        // Generate unique project name
        const projectName = `kriptik-${projectId.slice(0, 8)}-${Date.now().toString(36)}`;

        // Ensure project exists
        await this.getOrCreateProject(projectName);

        // Prepare files for deployment
        const deployFiles = files.map(f => ({
            file: f.path.startsWith('/') ? f.path.slice(1) : f.path,
            data: Buffer.from(f.content).toString('base64'),
            encoding: 'base64' as const,
        }));

        // Create deployment
        const deployment = await this.request<VercelDeployment>('/v13/deployments', {
            method: 'POST',
            body: JSON.stringify({
                name: projectName,
                files: deployFiles,
                projectSettings: options?.framework ? {
                    framework: options.framework,
                } : undefined,
                target: 'production',
            }),
        });

        // Set environment variables if provided
        if (options?.environmentVariables && Object.keys(options.environmentVariables).length > 0) {
            await this.setEnvironmentVariables(projectName, options.environmentVariables);
        }

        return {
            deploymentId: deployment.id,
            url: `https://${deployment.url}`,
            projectName,
        };
    }

    /**
     * Set environment variables for a project
     */
    async setEnvironmentVariables(
        projectName: string,
        variables: Record<string, string>
    ): Promise<void> {
        for (const [key, value] of Object.entries(variables)) {
            await this.request(`/v10/projects/${projectName}/env`, {
                method: 'POST',
                body: JSON.stringify({
                    key,
                    value,
                    type: 'encrypted',
                    target: ['production', 'preview', 'development'],
                }),
            });
        }
    }

    /**
     * Add custom domain to project
     */
    async addCustomDomain(projectName: string, domain: string): Promise<void> {
        await this.request(`/v10/projects/${projectName}/domains`, {
            method: 'POST',
            body: JSON.stringify({ name: domain }),
        });
    }

    /**
     * Get deployment status
     */
    async getDeploymentStatus(deploymentId: string): Promise<string> {
        const deployment = await this.request<VercelDeployment>(`/v13/deployments/${deploymentId}`);
        return deployment.readyState || deployment.state;
    }

    /**
     * Get deployment logs
     */
    async getDeploymentLogs(deploymentId: string): Promise<string[]> {
        try {
            const response = await this.request<{ logs: Array<{ text: string }> }>(
                `/v2/deployments/${deploymentId}/events`
            );
            return response.logs?.map(log => log.text) || [];
        } catch {
            return [];
        }
    }

    /**
     * Redeploy an existing project
     */
    async redeploy(
        projectName: string,
        files: Array<{ path: string; content: string }>,
        environmentVariables?: Record<string, string>
    ): Promise<{ deploymentId: string; url: string }> {
        const deployFiles = files.map(f => ({
            file: f.path.startsWith('/') ? f.path.slice(1) : f.path,
            data: Buffer.from(f.content).toString('base64'),
            encoding: 'base64' as const,
        }));

        const deployment = await this.request<VercelDeployment>('/v13/deployments', {
            method: 'POST',
            body: JSON.stringify({
                name: projectName,
                files: deployFiles,
                target: 'production',
            }),
        });

        if (environmentVariables) {
            await this.setEnvironmentVariables(projectName, environmentVariables);
        }

        return {
            deploymentId: deployment.id,
            url: `https://${deployment.url}`,
        };
    }

    /**
     * Delete a project
     */
    async deleteProject(projectName: string): Promise<void> {
        await this.request(`/v9/projects/${projectName}`, { method: 'DELETE' });
    }

    /**
     * Validate credentials
     */
    async validateCredentials(): Promise<boolean> {
        if (!this.isConfigured()) return false;

        try {
            await this.request('/v2/user');
            return true;
        } catch {
            return false;
        }
    }
}

// Singleton instance
let instance: VercelManagedService | null = null;

export function getVercelManaged(): VercelManagedService {
    if (!instance) {
        instance = new VercelManagedService();
    }
    return instance;
}

export const vercelManaged = new VercelManagedService();

