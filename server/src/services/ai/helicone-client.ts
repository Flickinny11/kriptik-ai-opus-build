/**
 * AI Client Factory
 *
 * Creates Anthropic SDK clients configured for the available API:
 * 
 * Priority order:
 * 1. OpenRouter (recommended - higher rate limits, no commercial account needed)
 * 2. Direct Anthropic + Helicone (requires ANTHROPIC_API_KEY + commercial account)
 * 3. Direct Anthropic (requires ANTHROPIC_API_KEY)
 *
 * OpenRouter provides an Anthropic-compatible API, so the SDK works seamlessly.
 */

import { Anthropic } from '@anthropic-ai/sdk';

export interface HeliconeConfig {
    apiKey: string;
    anthropicApiKey: string;
    openRouterApiKey: string;
    enabled: boolean;
    cacheEnabled?: boolean;
    rateLimitPolicy?: string;
    userId?: string;
    sessionId?: string;
    properties?: Record<string, string>;
}

export interface HeliconeHeaders {
    'Helicone-Auth': string;
    'Helicone-Cache-Enabled'?: string;
    'Helicone-Rate-Limit-Policy'?: string;
    'Helicone-User-Id'?: string;
    'Helicone-Session-Id'?: string;
    'Helicone-Property-ProjectId'?: string;
    'Helicone-Property-AgentType'?: string;
    'Helicone-Property-Feature'?: string;
    [key: string]: string | undefined;
}

export class HeliconeClient {
    private config: HeliconeConfig;
    private client: Anthropic;
    private useOpenRouter: boolean = false;
    private useHelicone: boolean = false;

    constructor(config?: Partial<HeliconeConfig>) {
        const heliconeKey = config?.apiKey || process.env.HELICONE_API_KEY || '';
        const anthropicKey = config?.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '';
        const openRouterKey = config?.openRouterApiKey || process.env.OPENROUTER_API_KEY || '';
        
        const heliconeEnabled = config?.enabled ?? (process.env.HELICONE_ENABLED !== 'false');

        this.config = {
            apiKey: heliconeKey,
            anthropicApiKey: anthropicKey,
            openRouterApiKey: openRouterKey,
            enabled: heliconeEnabled && !!heliconeKey && !!anthropicKey,
            cacheEnabled: config?.cacheEnabled ?? heliconeEnabled,
            rateLimitPolicy: config?.rateLimitPolicy,
            userId: config?.userId,
            sessionId: config?.sessionId,
            properties: config?.properties || {},
        };

        // Priority 1: OpenRouter (recommended - no rate limit concerns)
        if (openRouterKey) {
            this.useOpenRouter = true;
            this.useHelicone = false;
            this.client = new Anthropic({
                apiKey: openRouterKey,
                baseURL: 'https://openrouter.ai/api/v1',
                defaultHeaders: {
                    'HTTP-Referer': 'https://kriptik.ai',
                    'X-Title': 'KripTik AI Builder',
                },
            });
            console.log('[AIClient] Using OpenRouter (Anthropic SDK compatible)');
        }
        // Priority 2: Direct Anthropic + Helicone (requires commercial account for high usage)
        else if (anthropicKey && heliconeKey && this.config.enabled) {
            this.useOpenRouter = false;
            this.useHelicone = true;
            this.client = new Anthropic({
                apiKey: anthropicKey,
                baseURL: 'https://anthropic.helicone.ai',
                defaultHeaders: this.buildHeaders(),
            });
            console.log('[AIClient] Using Anthropic API with Helicone proxy');
        }
        // Priority 3: Direct Anthropic (rate limit concerns without commercial account)
        else if (anthropicKey) {
            this.useOpenRouter = false;
            this.useHelicone = false;
            this.client = new Anthropic({
                apiKey: anthropicKey,
            });
            console.log('[AIClient] Using direct Anthropic API (watch rate limits!)');
        }
        // No API key available
        else {
            throw new Error(
                'No AI API key configured. Set OPENROUTER_API_KEY (recommended) ' +
                'or ANTHROPIC_API_KEY in your environment variables.'
            );
        }
    }

    /**
     * Build Helicone headers for request tracking
     */
    private buildHeaders(): HeliconeHeaders {
        const headers: HeliconeHeaders = {
            'Helicone-Auth': `Bearer ${this.config.apiKey}`,
        };

        if (this.config.cacheEnabled) {
            headers['Helicone-Cache-Enabled'] = 'true';
        }

        if (this.config.rateLimitPolicy) {
            headers['Helicone-Rate-Limit-Policy'] = this.config.rateLimitPolicy;
        }

        if (this.config.userId) {
            headers['Helicone-User-Id'] = this.config.userId;
        }

        if (this.config.sessionId) {
            headers['Helicone-Session-Id'] = this.config.sessionId;
        }

        for (const [key, value] of Object.entries(this.config.properties || {})) {
            headers[`Helicone-Property-${key}`] = value;
        }

        return headers;
    }

    /**
     * Get the configured Anthropic client
     */
    getClient(): Anthropic {
        return this.client;
    }

    /**
     * Check if using OpenRouter instead of direct Anthropic
     */
    isUsingOpenRouter(): boolean {
        return this.useOpenRouter;
    }

    /**
     * Check if Helicone observability is active
     */
    isUsingHelicone(): boolean {
        return this.useHelicone;
    }

    /**
     * Create a new client instance with additional context
     * Only adds Helicone tracking headers when using Helicone
     */
    withContext(context: {
        userId?: string;
        projectId?: string;
        agentType?: string;
        sessionId?: string;
        feature?: string;
    }): Anthropic {
        // For OpenRouter or direct Anthropic (no Helicone), just return base client
        if (this.useOpenRouter || !this.useHelicone) {
            return this.client;
        }

        // For Helicone - add per-request context headers
        const additionalHeaders: Record<string, string> = {};

        if (context.userId) {
            additionalHeaders['Helicone-User-Id'] = context.userId;
        }
        if (context.projectId) {
            additionalHeaders['Helicone-Property-ProjectId'] = context.projectId;
        }
        if (context.agentType) {
            additionalHeaders['Helicone-Property-AgentType'] = context.agentType;
        }
        if (context.sessionId) {
            additionalHeaders['Helicone-Session-Id'] = context.sessionId;
        }
        if (context.feature) {
            additionalHeaders['Helicone-Property-Feature'] = context.feature;
        }

        return new Anthropic({
            apiKey: this.config.anthropicApiKey,
            baseURL: 'https://anthropic.helicone.ai',
            defaultHeaders: {
                ...this.buildHeaders(),
                ...additionalHeaders,
            },
        });
    }

    /**
     * Check if Helicone is enabled and configured
     */
    isEnabled(): boolean {
        return this.useHelicone;
    }

    /**
     * Get current configuration (without sensitive keys)
     */
    getConfig(): Omit<HeliconeConfig, 'apiKey' | 'anthropicApiKey' | 'openRouterApiKey'> {
        return {
            enabled: this.config.enabled,
            cacheEnabled: this.config.cacheEnabled,
            rateLimitPolicy: this.config.rateLimitPolicy,
            userId: this.config.userId,
            sessionId: this.config.sessionId,
            properties: this.config.properties,
        };
    }

    /**
     * Get info about which backend is being used
     */
    getBackendInfo(): { provider: string; helicone: boolean } {
        if (this.useOpenRouter) {
            return { provider: 'OpenRouter', helicone: false };
        } else if (this.useHelicone) {
            return { provider: 'Anthropic', helicone: true };
        } else {
            return { provider: 'Anthropic', helicone: false };
        }
    }
}

// Singleton instance
let heliconeInstance: HeliconeClient | null = null;

export function getHeliconeClient(config?: Partial<HeliconeConfig>): HeliconeClient {
    if (!heliconeInstance) {
        heliconeInstance = new HeliconeClient(config);
    }
    return heliconeInstance;
}

export function resetHeliconeClient(): void {
    heliconeInstance = null;
}
