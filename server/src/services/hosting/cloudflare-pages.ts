/**
 * Cloudflare Pages - Managed Static Hosting
 *
 * Uses KripTik's Cloudflare account to host user static sites
 * with unlimited bandwidth at no cost.
 */

interface CloudflareConfig {
    apiToken: string;
    accountId: string;
    zoneId?: string;
}

interface DeploymentResult {
    id: string;
    projectName: string;
    url: string;
    status: 'success' | 'failed' | 'building';
}

interface CloudflareProject {
    id: string;
    name: string;
    subdomain: string;
    domains: string[];
    created_on: string;
}

export class CloudflarePagesService {
    private config: CloudflareConfig;
    private baseUrl = 'https://api.cloudflare.com/client/v4';

    constructor() {
        this.config = {
            apiToken: process.env.CLOUDFLARE_API_TOKEN || '',
            accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
            zoneId: process.env.CLOUDFLARE_ZONE_ID,
        };
    }

    /**
     * Check if Cloudflare is configured
     */
    isConfigured(): boolean {
        return !!(this.config.apiToken && this.config.accountId);
    }

    /**
     * Make authenticated API request
     */
    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.config.apiToken}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        const data = await response.json() as { success: boolean; result?: T; errors?: Array<{ message: string }> };

        if (!response.ok || !data.success) {
            const errorMsg = data.errors?.[0]?.message || `Cloudflare API error: ${response.status}`;
            throw new Error(errorMsg);
        }

        return data.result as T;
    }

    /**
     * Create a new Pages project
     */
    async createProject(projectName: string): Promise<{ id: string; subdomain: string }> {
        if (!this.isConfigured()) {
            throw new Error('Cloudflare credentials not configured');
        }

        // Sanitize project name (lowercase, alphanumeric, hyphens only)
        const sanitizedName = projectName
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 63);

        const result = await this.request<CloudflareProject>(
            `/accounts/${this.config.accountId}/pages/projects`,
            {
                method: 'POST',
                body: JSON.stringify({
                    name: sanitizedName,
                    production_branch: 'main',
                }),
            }
        );

        return {
            id: result.id,
            subdomain: `${sanitizedName}.pages.dev`,
        };
    }

    /**
     * Deploy files to a Pages project using direct upload
     */
    async deploy(
        projectName: string,
        files: Map<string, string>
    ): Promise<DeploymentResult> {
        if (!this.isConfigured()) {
            throw new Error('Cloudflare credentials not configured');
        }

        // Create manifest and prepare files
        const manifest: Record<string, string> = {};
        const fileHashes: Map<string, { content: string; hash: string }> = new Map();

        for (const [path, content] of files) {
            const hash = await this.hashContent(content);
            const normalizedPath = path.startsWith('/') ? path : `/${path}`;
            manifest[normalizedPath] = hash;
            fileHashes.set(hash, { content, hash });
        }

        // Upload deployment
        const formData = new FormData();
        formData.append('manifest', JSON.stringify(manifest));

        // Add each file as a blob
        for (const [hash, { content }] of fileHashes) {
            const blob = new Blob([content], { type: 'application/octet-stream' });
            formData.append(hash, blob);
        }

        const response = await fetch(
            `${this.baseUrl}/accounts/${this.config.accountId}/pages/projects/${projectName}/deployments`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiToken}`,
                },
                body: formData,
            }
        );

        const data = await response.json() as {
            success: boolean;
            result?: { id: string; url: string };
            errors?: Array<{ message: string }>;
        };

        if (!response.ok || !data.success) {
            throw new Error(data.errors?.[0]?.message || 'Deployment failed');
        }

        return {
            id: data.result!.id,
            projectName,
            url: data.result!.url,
            status: 'success',
        };
    }

    /**
     * Add custom domain to project
     */
    async addCustomDomain(projectName: string, domain: string): Promise<void> {
        if (!this.isConfigured()) {
            throw new Error('Cloudflare credentials not configured');
        }

        await this.request(
            `/accounts/${this.config.accountId}/pages/projects/${projectName}/domains`,
            {
                method: 'POST',
                body: JSON.stringify({ name: domain }),
            }
        );
    }

    /**
     * Get deployment status
     */
    async getDeploymentStatus(projectName: string, deploymentId: string): Promise<string> {
        const result = await this.request<{ latest_stage: { status: string } }>(
            `/accounts/${this.config.accountId}/pages/projects/${projectName}/deployments/${deploymentId}`
        );
        return result.latest_stage?.status || 'unknown';
    }

    /**
     * Get deployment logs
     */
    async getDeploymentLogs(projectName: string, deploymentId: string): Promise<string[]> {
        try {
            const result = await this.request<{ data: Array<{ message: string }> }>(
                `/accounts/${this.config.accountId}/pages/projects/${projectName}/deployments/${deploymentId}/history/logs`
            );
            return result.data?.map(log => log.message) || [];
        } catch {
            return [];
        }
    }

    /**
     * Delete a project
     */
    async deleteProject(projectName: string): Promise<void> {
        await this.request(
            `/accounts/${this.config.accountId}/pages/projects/${projectName}`,
            { method: 'DELETE' }
        );
    }

    /**
     * List all projects
     */
    async listProjects(): Promise<CloudflareProject[]> {
        const result = await this.request<CloudflareProject[]>(
            `/accounts/${this.config.accountId}/pages/projects`
        );
        return result;
    }

    /**
     * Validate credentials
     */
    async validateCredentials(): Promise<boolean> {
        if (!this.isConfigured()) return false;

        try {
            const response = await fetch(
                `${this.baseUrl}/user/tokens/verify`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiToken}`,
                    },
                }
            );
            const data = await response.json() as { result?: { status: string } };
            return data.result?.status === 'active';
        } catch {
            return false;
        }
    }

    /**
     * Hash content for deduplication
     */
    private async hashContent(content: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
}

// Singleton instance
let instance: CloudflarePagesService | null = null;

export function getCloudflarePages(): CloudflarePagesService {
    if (!instance) {
        instance = new CloudflarePagesService();
    }
    return instance;
}

export const cloudflarePages = new CloudflarePagesService();

