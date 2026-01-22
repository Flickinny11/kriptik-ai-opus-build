/**
 * MCP Platform Clients
 *
 * Pre-configured MCP client wrappers for popular platforms.
 * Provides easy integration with common services via MCP protocol.
 *
 * Supported Platforms:
 * - GitHub: Repository management, issues, PRs
 * - Stripe: Payment processing, subscriptions
 * - Supabase: Database, auth, storage
 * - Slack: Messaging, channels
 * - Linear: Issue tracking
 * - Notion: Documentation, databases
 * - Vercel: Deployment management
 */

import { EventEmitter } from 'events';
import {
    MCPClient,
    getMCPClient,
    MCP_SERVER_PRESETS,
    type MCPServerConnection,
    type MCPToolInfo,
    type MCPCallResult,
} from './client.js';
import { getCredentialVault } from '../security/credential-vault.js';

// =============================================================================
// Types
// =============================================================================

export interface PlatformClientConfig {
    platform: string;
    userId: string;
    projectId?: string;
    credentials?: Record<string, string>;
}

export interface PlatformToolCall {
    platform: string;
    tool: string;
    args: Record<string, unknown>;
}

export interface PlatformToolResult {
    success: boolean;
    platform: string;
    tool: string;
    result?: MCPCallResult;
    error?: string;
}

export interface PlatformConnectionStatus {
    platform: string;
    connected: boolean;
    serverId?: string;
    availableTools: string[];
    error?: string;
}

// =============================================================================
// Platform-Specific Server Configurations
// =============================================================================

const PLATFORM_CONFIGS: Record<string, {
    name: string;
    description: string;
    command: string;
    args: string[];
    envMapping: Record<string, string>;
    requiredCredentials: string[];
}> = {
    github: {
        name: 'GitHub',
        description: 'Repository management, issues, PRs, actions',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        envMapping: {
            GITHUB_PERSONAL_ACCESS_TOKEN: 'github_token',
        },
        requiredCredentials: ['github_token'],
    },
    stripe: {
        name: 'Stripe',
        description: 'Payment processing, subscriptions, invoices',
        command: 'npx',
        args: ['-y', '@stripe/mcp-server'],
        envMapping: {
            STRIPE_SECRET_KEY: 'stripe_secret_key',
        },
        requiredCredentials: ['stripe_secret_key'],
    },
    supabase: {
        name: 'Supabase',
        description: 'Database queries, auth management, storage',
        command: 'npx',
        args: ['-y', '@supabase/mcp-server'],
        envMapping: {
            SUPABASE_URL: 'supabase_url',
            SUPABASE_SERVICE_KEY: 'supabase_service_key',
        },
        requiredCredentials: ['supabase_url', 'supabase_service_key'],
    },
    slack: {
        name: 'Slack',
        description: 'Send messages, manage channels, notifications',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-slack'],
        envMapping: {
            SLACK_BOT_TOKEN: 'slack_bot_token',
            SLACK_TEAM_ID: 'slack_team_id',
        },
        requiredCredentials: ['slack_bot_token'],
    },
    linear: {
        name: 'Linear',
        description: 'Issue tracking, project management',
        command: 'npx',
        args: ['-y', '@linear/mcp-server'],
        envMapping: {
            LINEAR_API_KEY: 'linear_api_key',
        },
        requiredCredentials: ['linear_api_key'],
    },
    notion: {
        name: 'Notion',
        description: 'Documentation, databases, pages',
        command: 'npx',
        args: ['-y', '@notionhq/mcp-server'],
        envMapping: {
            NOTION_API_KEY: 'notion_api_key',
        },
        requiredCredentials: ['notion_api_key'],
    },
    vercel: {
        name: 'Vercel',
        description: 'Deployment management, domains, env vars',
        command: 'npx',
        args: ['-y', '@vercel/mcp-server'],
        envMapping: {
            VERCEL_TOKEN: 'vercel_token',
        },
        requiredCredentials: ['vercel_token'],
    },
    postgres: {
        name: 'PostgreSQL',
        description: 'Direct database queries',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        envMapping: {
            POSTGRES_CONNECTION_STRING: 'database_url',
        },
        requiredCredentials: ['database_url'],
    },
    resend: {
        name: 'Resend',
        description: 'Email sending, templates',
        command: 'npx',
        args: ['-y', '@resend/mcp-server'],
        envMapping: {
            RESEND_API_KEY: 'resend_api_key',
        },
        requiredCredentials: ['resend_api_key'],
    },
    clerk: {
        name: 'Clerk',
        description: 'User management, authentication',
        command: 'npx',
        args: ['-y', '@clerk/mcp-server'],
        envMapping: {
            CLERK_SECRET_KEY: 'clerk_secret_key',
        },
        requiredCredentials: ['clerk_secret_key'],
    },
};

// =============================================================================
// MCPPlatformClients Service
// =============================================================================

export class MCPPlatformClients extends EventEmitter {
    private mcpClient: MCPClient;
    private platformServers: Map<string, string> = new Map(); // platform -> serverId

    constructor() {
        super();
        this.mcpClient = getMCPClient();
    }

    /**
     * Connect to a platform via MCP
     */
    async connectPlatform(config: PlatformClientConfig): Promise<PlatformConnectionStatus> {
        const platformConfig = PLATFORM_CONFIGS[config.platform];

        if (!platformConfig) {
            return {
                platform: config.platform,
                connected: false,
                availableTools: [],
                error: `Unknown platform: ${config.platform}`,
            };
        }

        try {
            // Get credentials from config or vault
            const credentials = config.credentials || await this.loadCredentials(
                config.userId,
                config.platform,
                platformConfig.requiredCredentials
            );

            // Check for required credentials
            const missingCreds = platformConfig.requiredCredentials.filter(
                key => !credentials[key]
            );

            if (missingCreds.length > 0) {
                return {
                    platform: config.platform,
                    connected: false,
                    availableTools: [],
                    error: `Missing credentials: ${missingCreds.join(', ')}`,
                };
            }

            // Build environment variables
            const env: Record<string, string> = {};
            for (const [envVar, credKey] of Object.entries(platformConfig.envMapping)) {
                if (credentials[credKey]) {
                    env[envVar] = credentials[credKey];
                }
            }

            // Register the MCP server
            const serverId = this.mcpClient.registerServer({
                name: platformConfig.name,
                description: platformConfig.description,
                command: platformConfig.command,
                args: platformConfig.args,
                env,
            });

            // Connect to the server
            await this.mcpClient.connect(serverId);

            // Store the mapping
            this.platformServers.set(config.platform, serverId);

            // Get available tools
            const server = this.mcpClient.getServer(serverId);
            const availableTools = server?.tools?.map(t => t.name) || [];

            this.emit('platform_connected', {
                platform: config.platform,
                serverId,
                tools: availableTools,
            });

            console.log(`[MCPPlatformClients] Connected to ${config.platform} with ${availableTools.length} tools`);

            return {
                platform: config.platform,
                connected: true,
                serverId,
                availableTools,
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[MCPPlatformClients] Failed to connect to ${config.platform}:`, error);

            return {
                platform: config.platform,
                connected: false,
                availableTools: [],
                error: errorMsg,
            };
        }
    }

    /**
     * Disconnect from a platform
     */
    async disconnectPlatform(platform: string): Promise<void> {
        const serverId = this.platformServers.get(platform);
        if (serverId) {
            await this.mcpClient.disconnect(serverId);
            this.platformServers.delete(platform);
            this.emit('platform_disconnected', { platform });
        }
    }

    /**
     * Call a tool on a connected platform
     */
    async callTool(call: PlatformToolCall): Promise<PlatformToolResult> {
        const serverId = this.platformServers.get(call.platform);

        if (!serverId) {
            return {
                success: false,
                platform: call.platform,
                tool: call.tool,
                error: `Platform not connected: ${call.platform}`,
            };
        }

        try {
            const result = await this.mcpClient.callTool(serverId, call.tool, call.args);

            this.emit('tool_called', {
                platform: call.platform,
                tool: call.tool,
                success: !result.isError,
            });

            return {
                success: !result.isError,
                platform: call.platform,
                tool: call.tool,
                result,
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';

            return {
                success: false,
                platform: call.platform,
                tool: call.tool,
                error: errorMsg,
            };
        }
    }

    /**
     * Get connection status for a platform
     */
    getStatus(platform: string): PlatformConnectionStatus {
        const serverId = this.platformServers.get(platform);

        if (!serverId) {
            return {
                platform,
                connected: false,
                availableTools: [],
            };
        }

        const server = this.mcpClient.getServer(serverId);

        return {
            platform,
            connected: server?.status === 'connected',
            serverId,
            availableTools: server?.tools?.map(t => t.name) || [],
            error: server?.error,
        };
    }

    /**
     * Get all connected platforms
     */
    getConnectedPlatforms(): PlatformConnectionStatus[] {
        const statuses: PlatformConnectionStatus[] = [];

        for (const platform of this.platformServers.keys()) {
            statuses.push(this.getStatus(platform));
        }

        return statuses;
    }

    /**
     * Get available tools for a platform
     */
    getTools(platform: string): MCPToolInfo[] {
        const serverId = this.platformServers.get(platform);
        if (!serverId) return [];

        const server = this.mcpClient.getServer(serverId);
        return server?.tools || [];
    }

    /**
     * Get all available tools across all connected platforms
     */
    getAllTools(): Array<{ platform: string; tool: MCPToolInfo }> {
        const tools: Array<{ platform: string; tool: MCPToolInfo }> = [];

        for (const [platform, serverId] of this.platformServers) {
            const server = this.mcpClient.getServer(serverId);
            if (server?.tools) {
                for (const tool of server.tools) {
                    tools.push({ platform, tool });
                }
            }
        }

        return tools;
    }

    /**
     * Load credentials from vault
     */
    private async loadCredentials(
        userId: string,
        platform: string,
        requiredKeys: string[]
    ): Promise<Record<string, string>> {
        const vault = getCredentialVault();
        const credentials: Record<string, string> = {};

        try {
            const credential = await vault.getCredential(userId, platform);
            if (credential?.data) {
                // Convert credential data to string records
                for (const [key, value] of Object.entries(credential.data)) {
                    if (typeof value === 'string') {
                        credentials[key] = value;
                    }
                }
            }
        } catch (error) {
            console.warn(`[MCPPlatformClients] Could not load credentials for ${platform}:`, error);
        }

        return credentials;
    }

    /**
     * Check which platforms have credentials available
     */
    async checkAvailableCredentials(userId: string): Promise<Array<{
        platform: string;
        hasCredentials: boolean;
        missingKeys: string[];
    }>> {
        const vault = getCredentialVault();
        const results: Array<{
            platform: string;
            hasCredentials: boolean;
            missingKeys: string[];
        }> = [];

        for (const [platform, config] of Object.entries(PLATFORM_CONFIGS)) {
            try {
                const credential = await vault.getCredential(userId, platform);
                const stored: Record<string, string> = {};
                if (credential?.data) {
                    for (const [key, value] of Object.entries(credential.data)) {
                        if (typeof value === 'string') {
                            stored[key] = value;
                        }
                    }
                }
                const missingKeys = config.requiredCredentials.filter(key => !stored[key]);

                results.push({
                    platform,
                    hasCredentials: missingKeys.length === 0,
                    missingKeys,
                });
            } catch {
                results.push({
                    platform,
                    hasCredentials: false,
                    missingKeys: config.requiredCredentials,
                });
            }
        }

        return results;
    }

    /**
     * Get platform configuration
     */
    static getPlatformConfig(platform: string) {
        return PLATFORM_CONFIGS[platform];
    }

    /**
     * Get all supported platforms
     */
    static getSupportedPlatforms(): string[] {
        return Object.keys(PLATFORM_CONFIGS);
    }
}

// =============================================================================
// Convenience Functions for Common Operations
// =============================================================================

/**
 * GitHub-specific operations
 */
export const GitHubOps = {
    async createIssue(client: MCPPlatformClients, owner: string, repo: string, title: string, body: string) {
        return client.callTool({
            platform: 'github',
            tool: 'create_issue',
            args: { owner, repo, title, body },
        });
    },

    async createPR(client: MCPPlatformClients, owner: string, repo: string, title: string, body: string, head: string, base: string) {
        return client.callTool({
            platform: 'github',
            tool: 'create_pull_request',
            args: { owner, repo, title, body, head, base },
        });
    },

    async pushFile(client: MCPPlatformClients, owner: string, repo: string, path: string, content: string, message: string) {
        return client.callTool({
            platform: 'github',
            tool: 'create_or_update_file',
            args: { owner, repo, path, content, message },
        });
    },
};

/**
 * Stripe-specific operations
 */
export const StripeOps = {
    async createCustomer(client: MCPPlatformClients, email: string, name?: string) {
        return client.callTool({
            platform: 'stripe',
            tool: 'create_customer',
            args: { email, name },
        });
    },

    async createCheckoutSession(client: MCPPlatformClients, customerId: string, priceId: string, successUrl: string, cancelUrl: string) {
        return client.callTool({
            platform: 'stripe',
            tool: 'create_checkout_session',
            args: { customer: customerId, line_items: [{ price: priceId, quantity: 1 }], success_url: successUrl, cancel_url: cancelUrl },
        });
    },

    async listSubscriptions(client: MCPPlatformClients, customerId: string) {
        return client.callTool({
            platform: 'stripe',
            tool: 'list_subscriptions',
            args: { customer: customerId },
        });
    },
};

/**
 * Supabase-specific operations
 */
export const SupabaseOps = {
    async query(client: MCPPlatformClients, sql: string) {
        return client.callTool({
            platform: 'supabase',
            tool: 'execute_sql',
            args: { query: sql },
        });
    },

    async createUser(client: MCPPlatformClients, email: string, password: string) {
        return client.callTool({
            platform: 'supabase',
            tool: 'create_user',
            args: { email, password },
        });
    },

    async uploadFile(client: MCPPlatformClients, bucket: string, path: string, content: string) {
        return client.callTool({
            platform: 'supabase',
            tool: 'upload_file',
            args: { bucket, path, content },
        });
    },
};

/**
 * Slack-specific operations
 */
export const SlackOps = {
    async sendMessage(client: MCPPlatformClients, channel: string, text: string) {
        return client.callTool({
            platform: 'slack',
            tool: 'send_message',
            args: { channel, text },
        });
    },

    async createChannel(client: MCPPlatformClients, name: string, isPrivate: boolean = false) {
        return client.callTool({
            platform: 'slack',
            tool: 'create_channel',
            args: { name, is_private: isPrivate },
        });
    },
};

/**
 * Vercel-specific operations
 */
export const VercelOps = {
    async deploy(client: MCPPlatformClients, projectId: string, gitSource: { repo: string; branch: string }) {
        return client.callTool({
            platform: 'vercel',
            tool: 'create_deployment',
            args: { projectId, gitSource },
        });
    },

    async setEnvVar(client: MCPPlatformClients, projectId: string, key: string, value: string, target: string[] = ['production', 'preview', 'development']) {
        return client.callTool({
            platform: 'vercel',
            tool: 'set_env_var',
            args: { projectId, key, value, target },
        });
    },
};

// =============================================================================
// Singleton Export
// =============================================================================

let platformClientsInstance: MCPPlatformClients | null = null;

export function getMCPPlatformClients(): MCPPlatformClients {
    if (!platformClientsInstance) {
        platformClientsInstance = new MCPPlatformClients();
    }
    return platformClientsInstance;
}

export default MCPPlatformClients;
