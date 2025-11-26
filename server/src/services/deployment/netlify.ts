/**
 * Netlify Deployment Integration
 *
 * Deploy static sites to Netlify
 */

const NETLIFY_API_BASE = 'https://api.netlify.com/api/v1';

export interface NetlifyDeploymentConfig {
    siteName?: string;
    siteId?: string;
    files: Array<{
        path: string;
        content: string;
    }>;
    functions?: Array<{
        path: string;
        content: string;
    }>;
    buildSettings?: {
        buildCommand?: string;
        publishDirectory?: string;
    };
}

export interface NetlifySite {
    id: string;
    name: string;
    url: string;
    ssl_url: string;
    admin_url: string;
    created_at: string;
    updated_at: string;
    state: string;
}

export interface NetlifyDeploy {
    id: string;
    site_id: string;
    state: 'new' | 'pending_review' | 'processing' | 'ready' | 'error';
    deploy_url: string;
    deploy_ssl_url: string;
    created_at: string;
    updated_at: string;
    published_at?: string;
}

/**
 * Netlify Deployment Service
 */
export class NetlifyService {
    private token: string;

    constructor(token: string) {
        this.token = token;
    }

    /**
     * Make authenticated API request
     */
    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const response = await fetch(`${NETLIFY_API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `Netlify API error: ${response.status}`);
        }

        return response.json();
    }

    /**
     * Create or get a site
     */
    async getOrCreateSite(name: string): Promise<NetlifySite> {
        // Try to find existing site
        const sites = await this.request<NetlifySite[]>('/sites');
        const existing = sites.find(s => s.name === name);

        if (existing) {
            return existing;
        }

        // Create new site
        return this.request<NetlifySite>('/sites', {
            method: 'POST',
            body: JSON.stringify({ name }),
        });
    }

    /**
     * Deploy files to Netlify
     * Uses the file digest deploy process
     */
    async deploy(config: NetlifyDeploymentConfig): Promise<NetlifyDeploy> {
        // Get or create site
        let siteId = config.siteId;
        if (!siteId && config.siteName) {
            const site = await this.getOrCreateSite(config.siteName);
            siteId = site.id;
        }

        if (!siteId) {
            throw new Error('Site ID or name required');
        }

        // Create a deploy with file hashes
        const fileHashes: Record<string, string> = {};
        for (const file of config.files) {
            // In production, compute SHA1 hash
            // For simplicity, we'll use a placeholder
            fileHashes[`/${file.path}`] = this.simpleHash(file.content);
        }

        // Create deploy
        const deploy = await this.request<NetlifyDeploy & { required: string[] }>(
            `/sites/${siteId}/deploys`,
            {
                method: 'POST',
                body: JSON.stringify({
                    files: fileHashes,
                    async: true,
                }),
            }
        );

        // Upload required files
        for (const file of config.files) {
            const filePath = `/${file.path}`;
            if (deploy.required?.includes(this.simpleHash(file.content))) {
                await this.uploadFile(deploy.id, filePath, file.content);
            }
        }

        return deploy;
    }

    /**
     * Upload a file to a deploy
     */
    private async uploadFile(
        deployId: string,
        path: string,
        content: string
    ): Promise<void> {
        await fetch(`${NETLIFY_API_BASE}/deploys/${deployId}/files${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/octet-stream',
            },
            body: content,
        });
    }

    /**
     * Get deploy status
     */
    async getDeploy(deployId: string): Promise<NetlifyDeploy> {
        return this.request<NetlifyDeploy>(`/deploys/${deployId}`);
    }

    /**
     * List deploys for a site
     */
    async listDeploys(siteId: string): Promise<NetlifyDeploy[]> {
        return this.request<NetlifyDeploy[]>(`/sites/${siteId}/deploys`);
    }

    /**
     * List all sites
     */
    async listSites(): Promise<NetlifySite[]> {
        return this.request<NetlifySite[]>('/sites');
    }

    /**
     * Delete a site
     */
    async deleteSite(siteId: string): Promise<void> {
        await this.request(`/sites/${siteId}`, { method: 'DELETE' });
    }

    /**
     * Set environment variables
     */
    async setEnvironmentVariables(
        siteId: string,
        variables: Record<string, string>
    ): Promise<void> {
        // Netlify uses build settings for env vars
        await this.request(`/sites/${siteId}`, {
            method: 'PATCH',
            body: JSON.stringify({
                build_settings: {
                    env: variables,
                },
            }),
        });
    }

    /**
     * Add custom domain
     */
    async addDomain(siteId: string, domain: string): Promise<void> {
        await this.request(`/sites/${siteId}/domain_aliases`, {
            method: 'POST',
            body: JSON.stringify({ hostname: domain }),
        });
    }

    /**
     * Validate token
     */
    async validateToken(): Promise<boolean> {
        try {
            await this.request('/user');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Simple hash function (placeholder for SHA1)
     */
    private simpleHash(content: string): string {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(40, '0');
    }
}

/**
 * Create a Netlify service instance
 */
export function createNetlifyService(token: string): NetlifyService {
    return new NetlifyService(token);
}

