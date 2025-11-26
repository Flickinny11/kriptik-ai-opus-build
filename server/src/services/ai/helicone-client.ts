/**
 * Helicone Client - LLM Observability & Proxy Layer
 *
 * Helicone provides:
 * - Request/response logging
 * - Cost tracking
 * - Rate limiting
 * - Caching
 * - Analytics
 *
 * All Claude API calls go through Helicone for observability.
 */

import Anthropic from '@anthropic-ai/sdk';

export interface HeliconeConfig {
    apiKey: string;
    anthropicApiKey: string;
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

    constructor(config?: Partial<HeliconeConfig>) {
        this.config = {
            apiKey: config?.apiKey || process.env.HELICONE_API_KEY || '',
            anthropicApiKey: config?.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '',
            enabled: config?.enabled ?? (process.env.HELICONE_ENABLED !== 'false'),
            cacheEnabled: config?.cacheEnabled ?? false,
            rateLimitPolicy: config?.rateLimitPolicy,
            userId: config?.userId,
            sessionId: config?.sessionId,
            properties: config?.properties || {},
        };

        // Initialize Anthropic client with Helicone proxy if enabled
        if (this.config.enabled && this.config.apiKey) {
            this.client = new Anthropic({
                apiKey: this.config.anthropicApiKey,
                baseURL: 'https://anthropic.helicone.ai',
                defaultHeaders: this.buildHeaders(),
            });
        } else {
            // Direct Anthropic connection (no Helicone)
            this.client = new Anthropic({
                apiKey: this.config.anthropicApiKey,
            });
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

        // Add custom properties
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
     * Create a new client instance with additional context
     * Useful for per-request tracking (user, project, agent)
     */
    withContext(context: {
        userId?: string;
        projectId?: string;
        agentType?: string;
        sessionId?: string;
        feature?: string;
    }): Anthropic {
        if (!this.config.enabled || !this.config.apiKey) {
            return this.client;
        }

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
        return this.config.enabled && !!this.config.apiKey;
    }

    /**
     * Get current configuration (without sensitive keys)
     */
    getConfig(): Omit<HeliconeConfig, 'apiKey' | 'anthropicApiKey'> {
        return {
            enabled: this.config.enabled,
            cacheEnabled: this.config.cacheEnabled,
            rateLimitPolicy: this.config.rateLimitPolicy,
            userId: this.config.userId,
            sessionId: this.config.sessionId,
            properties: this.config.properties,
        };
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

