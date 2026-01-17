/**
 * Nango Integration Service
 *
 * Provides unified OAuth connections to 200+ integrations via Nango.
 * Handles authentication flows, token management, and credential storage.
 *
 * @see https://docs.nango.dev
 */

import { getCredentialVault, type CredentialData } from '../security/credential-vault.js';
import { EventEmitter } from 'events';

// =============================================================================
// Types
// =============================================================================

export interface NangoConfig {
    /** Nango secret key for API access */
    secretKey: string;
    /** Nango public key for frontend SDK */
    publicKey: string;
    /** Nango host (defaults to cloud) */
    host?: string;
    /** Callback URL after OAuth completion */
    callbackUrl: string;
}

export interface NangoConnection {
    connectionId: string;
    providerConfigKey: string;
    provider: string;
    createdAt: string;
    credentials: {
        type: 'OAUTH2' | 'API_KEY' | 'BASIC';
        accessToken?: string;
        refreshToken?: string;
        expiresAt?: string;
        rawCredentials?: Record<string, unknown>;
    };
    connectionConfig?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

export interface NangoIntegration {
    uniqueKey: string;
    provider: string;
    displayName: string;
    authMode: 'OAUTH2' | 'OAUTH1' | 'API_KEY' | 'BASIC' | 'APP' | 'CUSTOM';
    scopes?: string[];
}

export interface NangoAuthResult {
    success: boolean;
    connectionId?: string;
    provider?: string;
    error?: string;
    errorCode?: string;
}

export interface NangoSyncRecord {
    id: string;
    [key: string]: unknown;
}

// =============================================================================
// Constants
// =============================================================================

const NANGO_API_BASE = 'https://api.nango.dev';

// Supported integrations with Nango
export const NANGO_INTEGRATIONS: Record<string, NangoIntegration> = {
    'github': {
        uniqueKey: 'github',
        provider: 'github',
        displayName: 'GitHub',
        authMode: 'OAUTH2',
        scopes: ['repo', 'read:user', 'user:email'],
    },
    'stripe': {
        uniqueKey: 'stripe',
        provider: 'stripe',
        displayName: 'Stripe',
        authMode: 'OAUTH2',
        scopes: ['read_write'],
    },
    'slack': {
        uniqueKey: 'slack',
        provider: 'slack',
        displayName: 'Slack',
        authMode: 'OAUTH2',
        scopes: ['chat:write', 'channels:read', 'users:read'],
    },
    'notion': {
        uniqueKey: 'notion',
        provider: 'notion',
        displayName: 'Notion',
        authMode: 'OAUTH2',
    },
    'airtable': {
        uniqueKey: 'airtable',
        provider: 'airtable',
        displayName: 'Airtable',
        authMode: 'OAUTH2',
        scopes: ['data.records:read', 'data.records:write'],
    },
    'hubspot': {
        uniqueKey: 'hubspot',
        provider: 'hubspot',
        displayName: 'HubSpot',
        authMode: 'OAUTH2',
        scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write'],
    },
    'salesforce': {
        uniqueKey: 'salesforce',
        provider: 'salesforce',
        displayName: 'Salesforce',
        authMode: 'OAUTH2',
        scopes: ['api', 'refresh_token'],
    },
    'google': {
        uniqueKey: 'google',
        provider: 'google',
        displayName: 'Google',
        authMode: 'OAUTH2',
        scopes: ['openid', 'email', 'profile'],
    },
    'linear': {
        uniqueKey: 'linear',
        provider: 'linear',
        displayName: 'Linear',
        authMode: 'OAUTH2',
        scopes: ['read', 'write'],
    },
    'figma': {
        uniqueKey: 'figma',
        provider: 'figma',
        displayName: 'Figma',
        authMode: 'OAUTH2',
        scopes: ['file_read'],
    },
    'discord': {
        uniqueKey: 'discord-oauth',
        provider: 'discord',
        displayName: 'Discord',
        authMode: 'OAUTH2',
        scopes: ['identify', 'guilds'],
    },
    'twilio': {
        uniqueKey: 'twilio',
        provider: 'twilio',
        displayName: 'Twilio',
        authMode: 'API_KEY',
    },
    'sendgrid': {
        uniqueKey: 'sendgrid',
        provider: 'sendgrid',
        displayName: 'SendGrid',
        authMode: 'API_KEY',
    },
    'mailchimp': {
        uniqueKey: 'mailchimp',
        provider: 'mailchimp',
        displayName: 'Mailchimp',
        authMode: 'OAUTH2',
    },
    'shopify': {
        uniqueKey: 'shopify',
        provider: 'shopify',
        displayName: 'Shopify',
        authMode: 'OAUTH2',
    },
    'google-analytics': {
        uniqueKey: 'google-analytics',
        provider: 'google',
        displayName: 'Google Analytics',
        authMode: 'OAUTH2',
        scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    },
    'twitter': {
        uniqueKey: 'twitter',
        provider: 'twitter',
        displayName: 'Twitter',
        authMode: 'OAUTH2',
        scopes: ['tweet.read', 'users.read'],
    },
    'instagram': {
        uniqueKey: 'instagram',
        provider: 'instagram',
        displayName: 'Instagram',
        authMode: 'OAUTH2',
    },
    'facebook': {
        uniqueKey: 'facebook',
        provider: 'facebook',
        displayName: 'Facebook',
        authMode: 'OAUTH2',
        scopes: ['public_profile', 'email'],
    },
    'linkedin': {
        uniqueKey: 'linkedin',
        provider: 'linkedin',
        displayName: 'LinkedIn',
        authMode: 'OAUTH2',
        scopes: ['r_liteprofile', 'r_emailaddress'],
    },
    'zoom': {
        uniqueKey: 'zoom',
        provider: 'zoom',
        displayName: 'Zoom',
        authMode: 'OAUTH2',
    },
    'calendly': {
        uniqueKey: 'calendly',
        provider: 'calendly',
        displayName: 'Calendly',
        authMode: 'OAUTH2',
    },
};

// =============================================================================
// Nango Service Class
// =============================================================================

export class NangoService extends EventEmitter {
    private config: NangoConfig;
    private vault = getCredentialVault();

    constructor(config?: Partial<NangoConfig>) {
        super();

        this.config = {
            secretKey: config?.secretKey || process.env.NANGO_SECRET_KEY || '',
            publicKey: config?.publicKey || process.env.NANGO_PUBLIC_KEY || '',
            host: config?.host || process.env.NANGO_HOST || NANGO_API_BASE,
            callbackUrl: config?.callbackUrl || process.env.NANGO_CALLBACK_URL || 'https://app.kriptik.app/api/nango/callback',
        };
    }

    /**
     * Check if Nango is properly configured
     */
    isConfigured(): boolean {
        return Boolean(this.config.secretKey && this.config.publicKey);
    }

    /**
     * Get configuration for frontend Nango SDK
     */
    getPublicConfig(): { publicKey: string; host: string; callbackUrl: string } {
        return {
            publicKey: this.config.publicKey,
            host: this.config.host || NANGO_API_BASE,
            callbackUrl: this.config.callbackUrl,
        };
    }

    /**
     * Get available integrations
     */
    getAvailableIntegrations(): NangoIntegration[] {
        return Object.values(NANGO_INTEGRATIONS);
    }

    /**
     * Check if an integration is supported via Nango
     */
    isIntegrationSupported(integrationId: string): boolean {
        return integrationId in NANGO_INTEGRATIONS;
    }

    /**
     * Get integration configuration
     */
    getIntegration(integrationId: string): NangoIntegration | null {
        return NANGO_INTEGRATIONS[integrationId] || null;
    }

    /**
     * Create auth URL for OAuth flow
     * This generates the URL that the frontend will redirect to
     */
    async createAuthUrl(
        integrationId: string,
        userId: string,
        options?: {
            scopes?: string[];
            connectionId?: string;
            metadata?: Record<string, unknown>;
        }
    ): Promise<{ url: string; connectionId: string }> {
        const integration = NANGO_INTEGRATIONS[integrationId];
        if (!integration) {
            throw new Error(`Integration ${integrationId} is not supported via Nango`);
        }

        const connectionId = options?.connectionId || `${userId}-${integrationId}-${Date.now()}`;
        const scopes = options?.scopes || integration.scopes || [];

        // Build the Nango auth URL
        const params = new URLSearchParams({
            public_key: this.config.publicKey,
            integration_id: integration.uniqueKey,
            connection_id: connectionId,
        });

        if (scopes.length > 0) {
            params.set('scopes', scopes.join(','));
        }

        if (options?.metadata) {
            params.set('user_metadata', JSON.stringify(options.metadata));
        }

        const url = `${this.config.host}/oauth/connect/${integration.uniqueKey}?${params.toString()}`;

        // Store pending state in vault
        await this.vault.createOAuthState(
            userId,
            `nango-${integrationId}`,
            this.config.callbackUrl,
            scopes.join(','),
            undefined,
            {
                connectionId,
                integrationId,
                nangoProvider: integration.uniqueKey,
                ...options?.metadata,
            }
        );

        return { url, connectionId };
    }

    /**
     * Get connection details from Nango
     */
    async getConnection(
        integrationId: string,
        connectionId: string
    ): Promise<NangoConnection | null> {
        const integration = NANGO_INTEGRATIONS[integrationId];
        if (!integration) {
            return null;
        }

        try {
            const response = await fetch(
                `${this.config.host}/connection/${connectionId}?provider_config_key=${integration.uniqueKey}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.config.secretKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(`Nango API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[NangoService] Failed to get connection:`, error);
            return null;
        }
    }

    /**
     * Store Nango connection credentials in vault
     */
    async storeConnectionCredentials(
        userId: string,
        integrationId: string,
        connection: NangoConnection
    ): Promise<void> {
        const credentialData: CredentialData = {
            nango_connection_id: connection.connectionId,
            nango_provider: connection.provider,
            nango_created_at: connection.createdAt,
        };

        // Add any raw credentials that aren't sensitive tokens
        if (connection.connectionConfig) {
            Object.entries(connection.connectionConfig).forEach(([key, value]) => {
                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                    credentialData[`config_${key}`] = value;
                }
            });
        }

        await this.vault.storeCredential(
            userId,
            integrationId,
            credentialData,
            {
                oauthProvider: `nango-${connection.provider}`,
                oauthAccessToken: connection.credentials.accessToken,
                oauthRefreshToken: connection.credentials.refreshToken,
                oauthTokenExpiresAt: connection.credentials.expiresAt,
                connectionName: `${connection.provider} via Nango`,
            }
        );

        this.emit('connection_stored', {
            userId,
            integrationId,
            connectionId: connection.connectionId,
            provider: connection.provider,
        });
    }

    /**
     * Handle OAuth callback from Nango
     */
    async handleCallback(
        state: string,
        connectionId: string
    ): Promise<NangoAuthResult> {
        // Consume the OAuth state
        const oauthState = await this.vault.consumeOAuthState(state);
        if (!oauthState) {
            return {
                success: false,
                error: 'Invalid or expired OAuth state',
                errorCode: 'INVALID_STATE',
            };
        }

        const metadata = oauthState.metadata as {
            connectionId?: string;
            integrationId?: string;
            nangoProvider?: string;
        } | undefined;

        const integrationId = metadata?.integrationId;
        if (!integrationId) {
            return {
                success: false,
                error: 'Missing integration ID in OAuth state',
                errorCode: 'MISSING_INTEGRATION',
            };
        }

        // Fetch the connection from Nango to verify it was successful
        const connection = await this.getConnection(integrationId, connectionId);
        if (!connection) {
            return {
                success: false,
                error: 'Connection not found in Nango',
                errorCode: 'CONNECTION_NOT_FOUND',
            };
        }

        // Store credentials in vault
        await this.storeConnectionCredentials(
            oauthState.userId,
            integrationId,
            connection
        );

        return {
            success: true,
            connectionId: connection.connectionId,
            provider: connection.provider,
        };
    }

    /**
     * Refresh access token for a connection
     */
    async refreshToken(
        integrationId: string,
        connectionId: string
    ): Promise<boolean> {
        const integration = NANGO_INTEGRATIONS[integrationId];
        if (!integration) {
            return false;
        }

        try {
            const response = await fetch(
                `${this.config.host}/connection/${connectionId}/refresh?provider_config_key=${integration.uniqueKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.config.secretKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            return response.ok;
        } catch (error) {
            console.error(`[NangoService] Failed to refresh token:`, error);
            return false;
        }
    }

    /**
     * Delete a connection
     */
    async deleteConnection(
        integrationId: string,
        connectionId: string
    ): Promise<boolean> {
        const integration = NANGO_INTEGRATIONS[integrationId];
        if (!integration) {
            return false;
        }

        try {
            const response = await fetch(
                `${this.config.host}/connection/${connectionId}?provider_config_key=${integration.uniqueKey}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${this.config.secretKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            return response.ok;
        } catch (error) {
            console.error(`[NangoService] Failed to delete connection:`, error);
            return false;
        }
    }

    /**
     * Execute a sync action on a connection
     */
    async triggerSync(
        integrationId: string,
        connectionId: string,
        syncName: string
    ): Promise<boolean> {
        const integration = NANGO_INTEGRATIONS[integrationId];
        if (!integration) {
            return false;
        }

        try {
            const response = await fetch(
                `${this.config.host}/sync/trigger`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.config.secretKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        provider_config_key: integration.uniqueKey,
                        connection_id: connectionId,
                        sync_name: syncName,
                    }),
                }
            );

            return response.ok;
        } catch (error) {
            console.error(`[NangoService] Failed to trigger sync:`, error);
            return false;
        }
    }

    /**
     * Get synced records from Nango
     */
    async getSyncRecords(
        integrationId: string,
        connectionId: string,
        model: string,
        options?: {
            cursor?: string;
            limit?: number;
            filter?: string;
        }
    ): Promise<{ records: NangoSyncRecord[]; cursor?: string } | null> {
        const integration = NANGO_INTEGRATIONS[integrationId];
        if (!integration) {
            return null;
        }

        try {
            const params = new URLSearchParams({
                model,
                provider_config_key: integration.uniqueKey,
                connection_id: connectionId,
            });

            if (options?.cursor) {
                params.set('cursor', options.cursor);
            }
            if (options?.limit) {
                params.set('limit', options.limit.toString());
            }
            if (options?.filter) {
                params.set('filter', options.filter);
            }

            const response = await fetch(
                `${this.config.host}/records?${params.toString()}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.config.secretKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error(`[NangoService] Failed to get sync records:`, error);
            return null;
        }
    }

    /**
     * Make a proxied API request through Nango
     */
    async proxyRequest<T = unknown>(
        integrationId: string,
        connectionId: string,
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        endpoint: string,
        options?: {
            body?: unknown;
            headers?: Record<string, string>;
            params?: Record<string, string>;
        }
    ): Promise<T | null> {
        const integration = NANGO_INTEGRATIONS[integrationId];
        if (!integration) {
            return null;
        }

        try {
            const url = new URL(`${this.config.host}/proxy${endpoint}`);

            if (options?.params) {
                Object.entries(options.params).forEach(([key, value]) => {
                    url.searchParams.set(key, value);
                });
            }

            const headers: Record<string, string> = {
                'Authorization': `Bearer ${this.config.secretKey}`,
                'Provider-Config-Key': integration.uniqueKey,
                'Connection-Id': connectionId,
                'Content-Type': 'application/json',
                ...options?.headers,
            };

            const response = await fetch(url.toString(), {
                method,
                headers,
                body: options?.body ? JSON.stringify(options.body) : undefined,
            });

            if (!response.ok) {
                console.error(`[NangoService] Proxy request failed: ${response.status}`);
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error(`[NangoService] Proxy request error:`, error);
            return null;
        }
    }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let nangoInstance: NangoService | null = null;

export function getNangoService(): NangoService {
    if (!nangoInstance) {
        nangoInstance = new NangoService();
    }
    return nangoInstance;
}

export function createNangoService(config?: Partial<NangoConfig>): NangoService {
    return new NangoService(config);
}
