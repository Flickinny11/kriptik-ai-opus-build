/**
 * Nango Integration Service
 *
 * Handles OAuth connections via Nango's unified API using the current
 * Connect Session Token flow (as of December 2025).
 *
 * IMPORTANT: This uses the new session token method, NOT the deprecated
 * public key method. Public keys were deprecated on July 31, 2025.
 *
 * Flow:
 * 1. Backend creates a Connect Session via POST /connect/sessions
 * 2. Frontend receives short-lived token (30 min expiry)
 * 3. Frontend opens Nango Connect UI with the token
 * 4. User completes OAuth flow
 * 5. Nango sends webhook to backend with connectionId
 * 6. Backend stores connectionId for future API calls
 *
 * Environment Variables Required:
 * - NANGO_SECRET_KEY: Your Nango secret key for server-side operations
 *
 * Webhook Configuration (in Nango Dashboard):
 * - Webhook URL: https://your-backend.com/api/integrations/nango-webhook
 * - Enable: "Send New Connection Creation Webhooks"
 */

// Categories for filtering and organization
export const INTEGRATION_CATEGORIES = [
    'payments',
    'database',
    'auth',
    'ai',
    'deployment',
    'cloud',
    'vcs',
    'email',
    'storage',
    'analytics',
    'communication',
    'crm',
    'hr',
    'accounting',
    'ecommerce',
    'project-management',
    'documentation',
    'customer-support',
    'marketing',
    'security',
    'productivity',
    'other'
] as const;

export type IntegrationCategory = typeof INTEGRATION_CATEGORIES[number];

interface NangoIntegration {
    nangoId: string;
    name: string;
    category: IntegrationCategory;
    scopes?: string[];
    description?: string;
}

/**
 * NANGO INTEGRATION CATALOG
 * Common integrations supported by Nango as of December 2025.
 * In the workflow, only show integrations detected as required by Intent Lock analysis.
 */
export const NANGO_INTEGRATIONS: Record<string, NangoIntegration> = {
    // ============================================================================
    // PAYMENTS & BILLING
    // ============================================================================
    'stripe': { nangoId: 'stripe', name: 'Stripe', category: 'payments', scopes: ['read_write'] },
    'stripe-connect': { nangoId: 'stripe-connect', name: 'Stripe Connect', category: 'payments' },
    'paypal': { nangoId: 'paypal', name: 'PayPal', category: 'payments' },
    'squareup': { nangoId: 'squareup', name: 'Square', category: 'payments' },
    'chargebee': { nangoId: 'chargebee', name: 'Chargebee', category: 'payments' },
    'razorpay': { nangoId: 'razorpay', name: 'Razorpay', category: 'payments' },

    // ============================================================================
    // DATABASES & BACKEND
    // ============================================================================
    'supabase': { nangoId: 'supabase', name: 'Supabase', category: 'database', scopes: ['read', 'write'] },
    'neon': { nangoId: 'neon', name: 'Neon', category: 'database' },
    'planetscale': { nangoId: 'planetscale', name: 'PlanetScale', category: 'database' },
    'firebase': { nangoId: 'firebase', name: 'Firebase', category: 'database' },
    'mongodb': { nangoId: 'mongodb', name: 'MongoDB', category: 'database' },
    'airtable': { nangoId: 'airtable', name: 'Airtable', category: 'database' },
    'notion': { nangoId: 'notion', name: 'Notion', category: 'database' },

    // ============================================================================
    // AUTH PROVIDERS
    // ============================================================================
    'clerk': { nangoId: 'clerk', name: 'Clerk', category: 'auth' },
    'auth0': { nangoId: 'auth0', name: 'Auth0', category: 'auth' },
    'okta': { nangoId: 'okta', name: 'Okta', category: 'auth' },

    // ============================================================================
    // AI & ML SERVICES
    // ============================================================================
    'openai': { nangoId: 'openai', name: 'OpenAI', category: 'ai' },
    'anthropic': { nangoId: 'anthropic', name: 'Anthropic', category: 'ai' },
    'replicate': { nangoId: 'replicate', name: 'Replicate', category: 'ai' },
    'fal': { nangoId: 'fal', name: 'Fal.ai', category: 'ai' },
    'huggingface': { nangoId: 'huggingface', name: 'Hugging Face', category: 'ai' },
    'google-gemini': { nangoId: 'google-gemini', name: 'Google Gemini', category: 'ai' },
    'elevenlabs': { nangoId: 'elevenlabs', name: 'ElevenLabs', category: 'ai' },

    // ============================================================================
    // CLOUD & DEPLOYMENT
    // ============================================================================
    'vercel': { nangoId: 'vercel', name: 'Vercel', category: 'deployment' },
    'netlify': { nangoId: 'netlify', name: 'Netlify', category: 'deployment' },
    'aws': { nangoId: 'aws', name: 'AWS', category: 'cloud' },
    'cloudflare': { nangoId: 'cloudflare', name: 'Cloudflare', category: 'cloud' },
    'digital-ocean': { nangoId: 'digital-ocean', name: 'Digital Ocean', category: 'cloud' },
    'heroku': { nangoId: 'heroku', name: 'Heroku', category: 'deployment' },
    'railway': { nangoId: 'railway', name: 'Railway', category: 'deployment' },

    // ============================================================================
    // VERSION CONTROL & DEV TOOLS
    // ============================================================================
    'github': { nangoId: 'github', name: 'GitHub', category: 'vcs', scopes: ['repo', 'user'] },
    'gitlab': { nangoId: 'gitlab', name: 'GitLab', category: 'vcs' },
    'bitbucket': { nangoId: 'bitbucket', name: 'Bitbucket', category: 'vcs' },
    'linear': { nangoId: 'linear', name: 'Linear', category: 'project-management' },
    'jira': { nangoId: 'jira', name: 'Jira', category: 'project-management' },
    'sentry': { nangoId: 'sentry', name: 'Sentry', category: 'vcs' },

    // ============================================================================
    // EMAIL & MESSAGING
    // ============================================================================
    'gmail': { nangoId: 'gmail', name: 'Gmail', category: 'email' },
    'sendgrid': { nangoId: 'sendgrid', name: 'SendGrid', category: 'email' },
    'resend': { nangoId: 'resend', name: 'Resend', category: 'email' },
    'mailgun': { nangoId: 'mailgun', name: 'Mailgun', category: 'email' },
    'mailchimp': { nangoId: 'mailchimp', name: 'Mailchimp', category: 'email' },
    'postmark': { nangoId: 'postmark', name: 'Postmark', category: 'email' },

    // ============================================================================
    // COMMUNICATION & CHAT
    // ============================================================================
    'slack': { nangoId: 'slack', name: 'Slack', category: 'communication' },
    'discord': { nangoId: 'discord', name: 'Discord', category: 'communication' },
    'twilio': { nangoId: 'twilio', name: 'Twilio', category: 'communication' },
    'microsoft-teams': { nangoId: 'microsoft-teams', name: 'Microsoft Teams', category: 'communication' },
    'zoom': { nangoId: 'zoom', name: 'Zoom', category: 'communication' },

    // ============================================================================
    // CRM & SALES
    // ============================================================================
    'salesforce': { nangoId: 'salesforce', name: 'Salesforce', category: 'crm' },
    'hubspot': { nangoId: 'hubspot', name: 'HubSpot', category: 'crm' },
    'pipedrive': { nangoId: 'pipedrive', name: 'Pipedrive', category: 'crm' },

    // ============================================================================
    // ANALYTICS & BI
    // ============================================================================
    'posthog': { nangoId: 'posthog', name: 'PostHog', category: 'analytics' },
    'mixpanel': { nangoId: 'mixpanel', name: 'Mixpanel', category: 'analytics' },
    'amplitude': { nangoId: 'amplitude', name: 'Amplitude', category: 'analytics' },
    'segment': { nangoId: 'segment', name: 'Segment', category: 'analytics' },
    'google-analytics': { nangoId: 'google-analytics', name: 'Google Analytics', category: 'analytics' },

    // ============================================================================
    // E-COMMERCE & RETAIL
    // ============================================================================
    'shopify': { nangoId: 'shopify', name: 'Shopify', category: 'ecommerce' },
    'woocommerce': { nangoId: 'woocommerce', name: 'WooCommerce', category: 'ecommerce' },

    // ============================================================================
    // PROJECT MANAGEMENT
    // ============================================================================
    'monday': { nangoId: 'monday', name: 'Monday.com', category: 'project-management' },
    'asana': { nangoId: 'asana', name: 'Asana', category: 'project-management' },
    'trello': { nangoId: 'trello', name: 'Trello', category: 'project-management' },
    'clickup': { nangoId: 'clickup', name: 'ClickUp', category: 'project-management' },

    // ============================================================================
    // CUSTOMER SUPPORT
    // ============================================================================
    'zendesk': { nangoId: 'zendesk', name: 'Zendesk', category: 'customer-support' },
    'intercom': { nangoId: 'intercom', name: 'Intercom', category: 'customer-support' },
    'freshdesk': { nangoId: 'freshdesk', name: 'Freshdesk', category: 'customer-support' },

    // ============================================================================
    // DESIGN & CREATIVE
    // ============================================================================
    'figma': { nangoId: 'figma', name: 'Figma', category: 'productivity' },
    'canva': { nangoId: 'canva', name: 'Canva', category: 'productivity' },

    // ============================================================================
    // STORAGE
    // ============================================================================
    'dropbox': { nangoId: 'dropbox', name: 'Dropbox', category: 'storage' },
    'google-drive': { nangoId: 'google-drive', name: 'Google Drive', category: 'storage' },
    'box': { nangoId: 'box', name: 'Box', category: 'storage' },

    // ============================================================================
    // PRODUCTIVITY
    // ============================================================================
    'google-calendar': { nangoId: 'google-calendar', name: 'Google Calendar', category: 'productivity' },
    'calendly': { nangoId: 'calendly', name: 'Calendly', category: 'productivity' },
} as const;

export type IntegrationId = keyof typeof NANGO_INTEGRATIONS;

/**
 * Response from creating a Connect Session
 */
interface ConnectSessionResponse {
    token: string;
    expires_at: string;
    connect_link?: string;
}

/**
 * Response from getting a connection
 */
interface NangoConnection {
    id: string;
    connection_id: string;
    provider_config_key: string;
    provider: string;
    credentials: {
        type: string;
        access_token?: string;
        refresh_token?: string;
        api_key?: string;
        expires_at?: string;
        raw?: Record<string, unknown>;
    };
    connection_config?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

/**
 * Webhook payload from Nango when a connection is created
 */
export interface NangoWebhookPayload {
    type: 'auth';
    operation: 'creation' | 'refresh' | 'deletion';
    success: boolean;
    connectionId: string;
    providerConfigKey: string;
    provider: string;
    environment: string;
    endUser?: {
        endUserId: string;
        endUserEmail?: string;
        displayName?: string;
        tags?: Record<string, string>;
    };
    error?: {
        type: string;
        message: string;
    };
}

/**
 * Parameters for creating a Connect Session
 */
interface CreateConnectSessionParams {
    userId: string;
    userEmail?: string;
    displayName?: string;
    tags?: Record<string, string>;
    allowedIntegrations?: string[];
    integrationsConfigDefaults?: Record<string, unknown>;
}

/**
 * Nango Service Class
 * Handles all OAuth operations via Nango API using the current session token flow
 */
class NangoService {
    private secretKey: string;
    private baseUrl = 'https://api.nango.dev';

    constructor() {
        this.secretKey = process.env.NANGO_SECRET_KEY || '';

        if (!this.secretKey) {
            console.warn('[NangoService] NANGO_SECRET_KEY not set - OAuth features disabled');
        }
    }

    /**
     * Check if Nango is configured
     */
    isConfigured(): boolean {
        return !!this.secretKey;
    }

    /**
     * Create a Connect Session for a user
     * This generates a short-lived token (30 minutes) that the frontend uses
     * to open the Nango Connect UI
     *
     * @param params - User identification and optional configuration
     * @returns Session token and expiry information
     */
    async createConnectSession(params: CreateConnectSessionParams): Promise<ConnectSessionResponse> {
        if (!this.secretKey) {
            throw new Error('Nango is not configured - NANGO_SECRET_KEY is missing');
        }

        const payload: Record<string, unknown> = {
            end_user: {
                id: params.userId,
                ...(params.userEmail && { email: params.userEmail }),
                ...(params.displayName && { display_name: params.displayName }),
                ...(params.tags && { tags: params.tags }),
            },
        };

        // Add allowed integrations if specified
        if (params.allowedIntegrations && params.allowedIntegrations.length > 0) {
            payload.allowed_integrations = params.allowedIntegrations;
        }

        // Add integration config defaults if specified
        if (params.integrationsConfigDefaults) {
            payload.integrations_config_defaults = params.integrationsConfigDefaults;
        }

        try {
            const response = await fetch(`${this.baseUrl}/connect/sessions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.secretKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[NangoService] Failed to create connect session:', response.status, errorText);
                throw new Error(`Nango API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            return {
                token: data.token,
                expires_at: data.expires_at,
                connect_link: data.connect_link,
            };
        } catch (error) {
            console.error('[NangoService] Error creating connect session:', error);
            throw error;
        }
    }

    /**
     * Create a reconnect session for updating expired credentials
     *
     * @param connectionId - The existing connection ID to reconnect
     * @param params - User identification
     * @returns Session token for reconnection
     */
    async createReconnectSession(connectionId: string, params: CreateConnectSessionParams): Promise<ConnectSessionResponse> {
        if (!this.secretKey) {
            throw new Error('Nango is not configured - NANGO_SECRET_KEY is missing');
        }

        const payload = {
            end_user: {
                id: params.userId,
                ...(params.userEmail && { email: params.userEmail }),
            },
            connection_id: connectionId,
        };

        try {
            const response = await fetch(`${this.baseUrl}/connect/sessions/reconnect`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.secretKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Nango API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            return {
                token: data.token,
                expires_at: data.expires_at,
            };
        } catch (error) {
            console.error('[NangoService] Error creating reconnect session:', error);
            throw error;
        }
    }

    /**
     * Get connection details by connection ID
     * The connectionId is provided by Nango via webhook after successful auth
     *
     * @param connectionId - The Nango-generated connection ID
     * @param providerConfigKey - The integration provider key (e.g., 'github', 'stripe')
     */
    async getConnectionById(connectionId: string, providerConfigKey: string): Promise<NangoConnection | null> {
        if (!this.secretKey) return null;

        try {
            const response = await fetch(
                `${this.baseUrl}/connection/${connectionId}?provider_config_key=${providerConfigKey}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.secretKey}`,
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
            console.error('[NangoService] Failed to get connection:', error);
            return null;
        }
    }

    /**
     * Get all connections for a specific end user
     *
     * @param endUserId - The end user's ID (your user ID)
     */
    async getConnectionsByEndUser(endUserId: string): Promise<NangoConnection[]> {
        if (!this.secretKey) return [];

        try {
            const response = await fetch(
                `${this.baseUrl}/connection?end_user_id=${encodeURIComponent(endUserId)}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.secretKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`Nango API error: ${response.status}`);
            }

            const data = await response.json();
            return data.connections || [];
        } catch (error) {
            console.error('[NangoService] Failed to get user connections:', error);
            return [];
        }
    }

    /**
     * Get the access token for a connection (auto-refreshes if expired)
     *
     * @param connectionId - The Nango connection ID
     * @param providerConfigKey - The integration provider key
     */
    async getAccessToken(connectionId: string, providerConfigKey: string): Promise<string | null> {
        const connection = await this.getConnectionById(connectionId, providerConfigKey);
        if (!connection) return null;

        // Nango handles token refresh automatically
        return connection.credentials.access_token || connection.credentials.api_key || null;
    }

    /**
     * Delete a connection
     *
     * @param connectionId - The Nango connection ID
     * @param providerConfigKey - The integration provider key
     */
    async deleteConnection(connectionId: string, providerConfigKey: string): Promise<void> {
        if (!this.secretKey) return;

        try {
            const response = await fetch(
                `${this.baseUrl}/connection/${connectionId}?provider_config_key=${providerConfigKey}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${this.secretKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok && response.status !== 404) {
                throw new Error(`Nango API error: ${response.status}`);
            }
        } catch (error) {
            console.error('[NangoService] Failed to delete connection:', error);
            throw error;
        }
    }

    /**
     * Validate a webhook payload from Nango
     * In production, you should verify the webhook signature
     *
     * @param payload - The webhook payload from Nango
     */
    validateWebhookPayload(payload: unknown): payload is NangoWebhookPayload {
        if (!payload || typeof payload !== 'object') return false;

        const p = payload as Record<string, unknown>;
        return (
            p.type === 'auth' &&
            typeof p.operation === 'string' &&
            typeof p.success === 'boolean' &&
            typeof p.connectionId === 'string'
        );
    }

    /**
     * Get integration metadata
     */
    getIntegrationInfo(integrationId: IntegrationId | string): NangoIntegration | undefined {
        return NANGO_INTEGRATIONS[integrationId as IntegrationId];
    }

    /**
     * List all supported integrations
     */
    listIntegrations() {
        return Object.entries(NANGO_INTEGRATIONS).map(([id, info]) => ({
            id: id as IntegrationId,
            ...info,
        }));
    }

    /**
     * List integrations by category
     */
    listIntegrationsByCategory(category: IntegrationCategory) {
        return Object.entries(NANGO_INTEGRATIONS)
            .filter(([, info]) => info.category === category)
            .map(([id, info]) => ({
                id: id as IntegrationId,
                ...info,
            }));
    }

    /**
     * Search integrations by name
     */
    searchIntegrations(query: string) {
        const lowerQuery = query.toLowerCase();
        return Object.entries(NANGO_INTEGRATIONS)
            .filter(([id, info]) =>
                id.toLowerCase().includes(lowerQuery) ||
                info.name.toLowerCase().includes(lowerQuery) ||
                info.category.toLowerCase().includes(lowerQuery)
            )
            .map(([id, info]) => ({
                id: id as IntegrationId,
                ...info,
            }));
    }

    /**
     * Configure an integration in Nango (add OAuth credentials)
     * This is used when setting up new integrations programmatically
     *
     * @param providerConfigKey - Unique key for this configuration (e.g., 'github')
     * @param provider - The Nango provider name (e.g., 'github')
     * @param credentials - OAuth client credentials
     */
    async configureIntegration(params: {
        providerConfigKey: string;
        provider: string;
        oauthClientId: string;
        oauthClientSecret: string;
        oauthScopes?: string;
    }): Promise<void> {
        if (!this.secretKey) {
            throw new Error('Nango is not configured');
        }

        const payload: Record<string, unknown> = {
            provider_config_key: params.providerConfigKey,
            provider: params.provider,
            oauth_client_id: params.oauthClientId,
            oauth_client_secret: params.oauthClientSecret,
        };

        if (params.oauthScopes) {
            payload.oauth_scopes = params.oauthScopes;
        }

        try {
            const response = await fetch(`${this.baseUrl}/config`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.secretKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to configure integration: ${response.status} - ${errorText}`);
            }
        } catch (error) {
            console.error('[NangoService] Failed to configure integration:', error);
            throw error;
        }
    }

    /**
     * Get all configured integrations in Nango
     */
    async getConfiguredIntegrations(): Promise<Array<{
        unique_key: string;
        provider: string;
    }>> {
        if (!this.secretKey) return [];

        try {
            const response = await fetch(`${this.baseUrl}/config`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.secretKey}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Nango API error: ${response.status}`);
            }

            const data = await response.json();
            return data.configs || [];
        } catch (error) {
            console.error('[NangoService] Failed to get configured integrations:', error);
            return [];
        }
    }
}

// Export singleton instance
export const nangoService = new NangoService();
export default nangoService;
