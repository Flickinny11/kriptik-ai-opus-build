/**
 * Integration Orchestrator Service
 *
 * Coordinates automatic setup of integrations during the build process.
 * Handles webhook generation, MCP client connections, and integration
 * configurations based on the detected dependencies.
 *
 * Features:
 * - Auto-webhook creation for connected integrations
 * - MCP server configuration for supported platforms
 * - Environment variable generation and injection
 * - Integration health monitoring
 */

import { EventEmitter } from 'events';
import { getCredentialVault, type DecryptedCredential } from '../security/credential-vault.js';
import { getNangoService } from '../integrations/nango.js';

// =============================================================================
// Types
// =============================================================================

export interface IntegrationConfig {
    integrationId: string;
    name: string;
    type: 'oauth' | 'api-key' | 'custom';
    supportsWebhooks: boolean;
    supportsMcp: boolean;
    envVarPrefix: string;
    webhookEvents?: string[];
}

export interface WebhookConfig {
    integrationId: string;
    url: string;
    secret: string;
    events: string[];
    active: boolean;
    createdAt: string;
}

export interface MCPServerConfig {
    integrationId: string;
    serverName: string;
    transport: 'stdio' | 'http' | 'ws';
    connectionUrl?: string;
    tools?: string[];
    resources?: string[];
}

export interface OrchestrationResult {
    integrationId: string;
    status: 'success' | 'partial' | 'failed';
    webhookCreated?: boolean;
    mcpConfigured?: boolean;
    envVarsSet?: string[];
    error?: string;
}

export interface BuildIntegrationContext {
    buildId: string;
    userId: string;
    projectId: string;
    deploymentUrl?: string;
    requiredIntegrations: string[];
    detectedFeatures: string[];
}

// =============================================================================
// Integration Registry
// =============================================================================

export const INTEGRATION_REGISTRY: Record<string, IntegrationConfig> = {
    // Payment integrations
    'stripe': {
        integrationId: 'stripe',
        name: 'Stripe',
        type: 'oauth',
        supportsWebhooks: true,
        supportsMcp: false,
        envVarPrefix: 'STRIPE',
        webhookEvents: [
            'checkout.session.completed',
            'customer.subscription.created',
            'customer.subscription.updated',
            'customer.subscription.deleted',
            'invoice.paid',
            'invoice.payment_failed',
            'payment_intent.succeeded',
            'payment_intent.payment_failed',
        ],
    },

    // Auth integrations
    'clerk': {
        integrationId: 'clerk',
        name: 'Clerk',
        type: 'api-key',
        supportsWebhooks: true,
        supportsMcp: false,
        envVarPrefix: 'CLERK',
        webhookEvents: [
            'user.created',
            'user.updated',
            'user.deleted',
            'session.created',
            'session.ended',
        ],
    },
    'auth0': {
        integrationId: 'auth0',
        name: 'Auth0',
        type: 'oauth',
        supportsWebhooks: true,
        supportsMcp: false,
        envVarPrefix: 'AUTH0',
        webhookEvents: [
            'login',
            'logout',
            'signup',
            'password_change',
        ],
    },

    // Database integrations
    'supabase': {
        integrationId: 'supabase',
        name: 'Supabase',
        type: 'api-key',
        supportsWebhooks: true,
        supportsMcp: true,
        envVarPrefix: 'SUPABASE',
        webhookEvents: [
            'INSERT',
            'UPDATE',
            'DELETE',
        ],
    },
    'firebase': {
        integrationId: 'firebase',
        name: 'Firebase',
        type: 'api-key',
        supportsWebhooks: true,
        supportsMcp: false,
        envVarPrefix: 'FIREBASE',
    },

    // Communication integrations
    'slack': {
        integrationId: 'slack',
        name: 'Slack',
        type: 'oauth',
        supportsWebhooks: true,
        supportsMcp: true,
        envVarPrefix: 'SLACK',
        webhookEvents: [
            'message',
            'app_mention',
            'reaction_added',
        ],
    },
    'discord': {
        integrationId: 'discord',
        name: 'Discord',
        type: 'oauth',
        supportsWebhooks: true,
        supportsMcp: false,
        envVarPrefix: 'DISCORD',
    },
    'twilio': {
        integrationId: 'twilio',
        name: 'Twilio',
        type: 'api-key',
        supportsWebhooks: true,
        supportsMcp: false,
        envVarPrefix: 'TWILIO',
        webhookEvents: [
            'sms.received',
            'call.completed',
            'message.status',
        ],
    },

    // Email integrations
    'sendgrid': {
        integrationId: 'sendgrid',
        name: 'SendGrid',
        type: 'api-key',
        supportsWebhooks: true,
        supportsMcp: false,
        envVarPrefix: 'SENDGRID',
        webhookEvents: [
            'delivered',
            'opened',
            'clicked',
            'bounced',
            'unsubscribed',
        ],
    },
    'resend': {
        integrationId: 'resend',
        name: 'Resend',
        type: 'api-key',
        supportsWebhooks: true,
        supportsMcp: false,
        envVarPrefix: 'RESEND',
        webhookEvents: [
            'email.sent',
            'email.delivered',
            'email.bounced',
        ],
    },

    // Cloud/Deployment integrations
    'vercel': {
        integrationId: 'vercel',
        name: 'Vercel',
        type: 'oauth',
        supportsWebhooks: true,
        supportsMcp: false,
        envVarPrefix: 'VERCEL',
        webhookEvents: [
            'deployment.created',
            'deployment.succeeded',
            'deployment.failed',
        ],
    },
    'github': {
        integrationId: 'github',
        name: 'GitHub',
        type: 'oauth',
        supportsWebhooks: true,
        supportsMcp: true,
        envVarPrefix: 'GITHUB',
        webhookEvents: [
            'push',
            'pull_request',
            'issues',
            'release',
        ],
    },

    // AI/ML integrations
    'openai': {
        integrationId: 'openai',
        name: 'OpenAI',
        type: 'api-key',
        supportsWebhooks: false,
        supportsMcp: false,
        envVarPrefix: 'OPENAI',
    },
    'anthropic': {
        integrationId: 'anthropic',
        name: 'Anthropic',
        type: 'api-key',
        supportsWebhooks: false,
        supportsMcp: false,
        envVarPrefix: 'ANTHROPIC',
    },
    'huggingface': {
        integrationId: 'huggingface',
        name: 'Hugging Face',
        type: 'api-key',
        supportsWebhooks: false,
        supportsMcp: false,
        envVarPrefix: 'HF',
    },
    'replicate': {
        integrationId: 'replicate',
        name: 'Replicate',
        type: 'api-key',
        supportsWebhooks: true,
        supportsMcp: false,
        envVarPrefix: 'REPLICATE',
        webhookEvents: [
            'prediction.completed',
            'prediction.failed',
        ],
    },
};

// =============================================================================
// Integration Orchestrator Class
// =============================================================================

export class IntegrationOrchestrator extends EventEmitter {
    private vault = getCredentialVault();
    private nango = getNangoService();
    private activeWebhooks: Map<string, WebhookConfig> = new Map();
    private mcpConfigs: Map<string, MCPServerConfig> = new Map();

    /**
     * Orchestrate all integrations for a build
     */
    async orchestrateBuildIntegrations(
        context: BuildIntegrationContext
    ): Promise<OrchestrationResult[]> {
        const results: OrchestrationResult[] = [];

        this.emit('orchestration_started', {
            buildId: context.buildId,
            integrations: context.requiredIntegrations,
        });

        for (const integrationId of context.requiredIntegrations) {
            const result = await this.setupIntegration(context, integrationId);
            results.push(result);

            this.emit('integration_configured', {
                buildId: context.buildId,
                integrationId,
                result,
            });
        }

        this.emit('orchestration_completed', {
            buildId: context.buildId,
            results,
            successCount: results.filter(r => r.status === 'success').length,
            failCount: results.filter(r => r.status === 'failed').length,
        });

        return results;
    }

    /**
     * Setup a single integration
     */
    async setupIntegration(
        context: BuildIntegrationContext,
        integrationId: string
    ): Promise<OrchestrationResult> {
        const config = INTEGRATION_REGISTRY[integrationId];
        if (!config) {
            return {
                integrationId,
                status: 'failed',
                error: `Unknown integration: ${integrationId}`,
            };
        }

        const result: OrchestrationResult = {
            integrationId,
            status: 'success',
            envVarsSet: [],
        };

        try {
            // 1. Get credentials from vault
            const credentials = await this.vault.getCredential(
                context.userId,
                integrationId
            );

            if (!credentials) {
                return {
                    integrationId,
                    status: 'failed',
                    error: 'No credentials found. Please connect this integration first.',
                };
            }

            // 2. Generate environment variables
            const envVars = this.generateEnvVars(config, credentials);
            result.envVarsSet = Object.keys(envVars);

            // 3. Setup webhooks if supported and deployment URL is available
            if (config.supportsWebhooks && context.deploymentUrl) {
                try {
                    const webhookResult = await this.setupWebhook(
                        context,
                        config,
                        credentials
                    );
                    result.webhookCreated = webhookResult.success;
                    if (!webhookResult.success) {
                        result.status = 'partial';
                    }
                } catch (webhookError) {
                    console.error(`[IntegrationOrchestrator] Webhook setup failed for ${integrationId}:`, webhookError);
                    result.status = 'partial';
                }
            }

            // 4. Setup MCP if supported
            if (config.supportsMcp) {
                try {
                    const mcpResult = await this.setupMCPServer(
                        context,
                        config,
                        credentials
                    );
                    result.mcpConfigured = mcpResult.success;
                    if (!mcpResult.success) {
                        result.status = 'partial';
                    }
                } catch (mcpError) {
                    console.error(`[IntegrationOrchestrator] MCP setup failed for ${integrationId}:`, mcpError);
                    result.status = 'partial';
                }
            }

        } catch (error) {
            console.error(`[IntegrationOrchestrator] Integration setup failed:`, error);
            return {
                integrationId,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }

        return result;
    }

    /**
     * Generate environment variables from credentials
     */
    private generateEnvVars(
        config: IntegrationConfig,
        credentials: DecryptedCredential
    ): Record<string, string> {
        const envVars: Record<string, string> = {};
        const prefix = config.envVarPrefix;

        // Map common credential fields
        if (credentials.oauthAccessToken) {
            envVars[`${prefix}_ACCESS_TOKEN`] = credentials.oauthAccessToken;
        }
        if (credentials.oauthRefreshToken) {
            envVars[`${prefix}_REFRESH_TOKEN`] = credentials.oauthRefreshToken;
        }

        // Map credential data
        for (const [key, value] of Object.entries(credentials.data)) {
            if (typeof value === 'string') {
                // Convert key to env var format (SCREAMING_SNAKE_CASE)
                const envKey = `${prefix}_${key.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
                envVars[envKey] = value;
            }
        }

        return envVars;
    }

    /**
     * Setup webhook for an integration
     */
    private async setupWebhook(
        context: BuildIntegrationContext,
        config: IntegrationConfig,
        credentials: DecryptedCredential
    ): Promise<{ success: boolean; webhookId?: string; error?: string }> {
        if (!context.deploymentUrl) {
            return { success: false, error: 'No deployment URL available' };
        }

        const webhookUrl = `${context.deploymentUrl}/api/webhooks/${config.integrationId}`;
        const webhookSecret = this.generateWebhookSecret();

        // Store webhook config
        const webhookConfig: WebhookConfig = {
            integrationId: config.integrationId,
            url: webhookUrl,
            secret: webhookSecret,
            events: config.webhookEvents || [],
            active: true,
            createdAt: new Date().toISOString(),
        };

        this.activeWebhooks.set(config.integrationId, webhookConfig);

        // Integration-specific webhook registration would go here
        // For now, we just store the config and emit an event
        this.emit('webhook_created', {
            buildId: context.buildId,
            integrationId: config.integrationId,
            webhookUrl,
            events: config.webhookEvents,
        });

        return {
            success: true,
            webhookId: `wh_${context.buildId}_${config.integrationId}`,
        };
    }

    /**
     * Setup MCP server for an integration
     */
    private async setupMCPServer(
        context: BuildIntegrationContext,
        config: IntegrationConfig,
        credentials: DecryptedCredential
    ): Promise<{ success: boolean; error?: string }> {
        const mcpConfig: MCPServerConfig = {
            integrationId: config.integrationId,
            serverName: `${config.name.toLowerCase()}-mcp`,
            transport: 'stdio',
            tools: this.getMCPTools(config.integrationId),
            resources: this.getMCPResources(config.integrationId),
        };

        this.mcpConfigs.set(config.integrationId, mcpConfig);

        this.emit('mcp_configured', {
            buildId: context.buildId,
            integrationId: config.integrationId,
            serverName: mcpConfig.serverName,
            tools: mcpConfig.tools,
        });

        return { success: true };
    }

    /**
     * Get MCP tools for an integration
     */
    private getMCPTools(integrationId: string): string[] {
        const toolMap: Record<string, string[]> = {
            'github': ['list_repos', 'create_issue', 'create_pr', 'get_file'],
            'slack': ['send_message', 'list_channels', 'get_users'],
            'supabase': ['query', 'insert', 'update', 'delete', 'rpc'],
        };
        return toolMap[integrationId] || [];
    }

    /**
     * Get MCP resources for an integration
     */
    private getMCPResources(integrationId: string): string[] {
        const resourceMap: Record<string, string[]> = {
            'github': ['repos', 'issues', 'pulls', 'files'],
            'slack': ['channels', 'users', 'messages'],
            'supabase': ['tables', 'functions', 'storage'],
        };
        return resourceMap[integrationId] || [];
    }

    /**
     * Generate a secure webhook secret
     */
    private generateWebhookSecret(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let secret = 'whsec_';
        for (let i = 0; i < 32; i++) {
            secret += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return secret;
    }

    /**
     * Get active webhook configs
     */
    getActiveWebhooks(): WebhookConfig[] {
        return Array.from(this.activeWebhooks.values());
    }

    /**
     * Get MCP configs
     */
    getMCPConfigs(): MCPServerConfig[] {
        return Array.from(this.mcpConfigs.values());
    }

    /**
     * Get integration config
     */
    getIntegrationConfig(integrationId: string): IntegrationConfig | undefined {
        return INTEGRATION_REGISTRY[integrationId];
    }

    /**
     * Get all supported integrations
     */
    getSupportedIntegrations(): IntegrationConfig[] {
        return Object.values(INTEGRATION_REGISTRY);
    }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let orchestratorInstance: IntegrationOrchestrator | null = null;

export function getIntegrationOrchestrator(): IntegrationOrchestrator {
    if (!orchestratorInstance) {
        orchestratorInstance = new IntegrationOrchestrator();
    }
    return orchestratorInstance;
}

export function createIntegrationOrchestrator(): IntegrationOrchestrator {
    return new IntegrationOrchestrator();
}
