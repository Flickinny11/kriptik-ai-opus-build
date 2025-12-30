/**
 * Nango Integration Service
 *
 * Handles OAuth connections via Nango's unified API.
 * Nango manages token refresh, storage, and 400+ provider integrations.
 *
 * Environment Variables Required:
 * - NANGO_SECRET_KEY: Your Nango secret key for server-side operations
 * - NANGO_PUBLIC_KEY: Your Nango public key for client-side auth
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

interface NangoConnection {
    connectionId: string;
    providerConfigKey: string;
    credentials: {
        accessToken?: string;
        refreshToken?: string;
        apiKey?: string;
        expiresAt?: string;
    };
}

interface NangoAuthResult {
    url: string;
}

/**
 * Nango Service Class
 * Handles all OAuth operations via Nango API
 */
class NangoService {
    private secretKey: string;
    private publicKey: string;
    private baseUrl = 'https://api.nango.dev';

    constructor() {
        this.secretKey = process.env.NANGO_SECRET_KEY || '';
        this.publicKey = process.env.NANGO_PUBLIC_KEY || '';

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
     * Get the public key for frontend use
     */
    getPublicKey(): string {
        return this.publicKey;
    }

    /**
     * Generate the OAuth URL for a user to connect an integration
     */
    async getOAuthUrl(params: {
        integrationId: IntegrationId;
        userId: string;
        projectId?: string;
        redirectUrl: string;
    }): Promise<string> {
        const integration = NANGO_INTEGRATIONS[params.integrationId];
        if (!integration) {
            throw new Error(`Unknown integration: ${params.integrationId}`);
        }

        // Connection ID is unique per user+integration
        const connectionId = `${params.userId}_${params.integrationId}`;

        // Build the authorization URL
        const authUrl = new URL(`${this.baseUrl}/oauth/connect/${integration.nangoId}`);
        authUrl.searchParams.set('connection_id', connectionId);
        authUrl.searchParams.set('public_key', this.publicKey);
        if (params.redirectUrl) {
            authUrl.searchParams.set('redirect_uri', params.redirectUrl);
        }
        if (params.projectId) {
            authUrl.searchParams.set('user_scope', params.projectId);
        }

        return authUrl.toString();
    }

    /**
     * Get connection status and credentials for an integration
     */
    async getConnection(params: {
        integrationId: IntegrationId | string;
        userId: string;
    }): Promise<NangoConnection | null> {
        if (!this.secretKey) return null;

        const integration = NANGO_INTEGRATIONS[params.integrationId as IntegrationId];
        if (!integration) return null;

        const connectionId = `${params.userId}_${params.integrationId}`;

        try {
            // Server-side API call with Bearer token (no browser credentials needed)
            const response = await fetch(
                `${this.baseUrl}/connection/${connectionId}?provider_config_key=${integration.nangoId}`,
                {
                    method: 'GET',
                    credentials: 'omit', // Server-side: no cookies to send
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

            const data = await response.json();
            return {
                connectionId,
                providerConfigKey: integration.nangoId,
                credentials: data.credentials || {},
            };
        } catch (error) {
            console.error('[NangoService] Failed to get connection:', error);
            return null;
        }
    }

    /**
     * Get the access token for an integration (auto-refreshes if expired)
     */
    async getAccessToken(params: {
        integrationId: IntegrationId | string;
        userId: string;
    }): Promise<string | null> {
        const connection = await this.getConnection(params);
        if (!connection) return null;

        // Nango handles token refresh automatically
        return connection.credentials.accessToken || connection.credentials.apiKey || null;
    }

    /**
     * Delete a connection
     */
    async deleteConnection(params: {
        integrationId: IntegrationId | string;
        userId: string;
    }): Promise<void> {
        if (!this.secretKey) return;

        const integration = NANGO_INTEGRATIONS[params.integrationId as IntegrationId];
        if (!integration) return;

        const connectionId = `${params.userId}_${params.integrationId}`;

        try {
            // Server-side API call with Bearer token (no browser credentials needed)
            await fetch(
                `${this.baseUrl}/connection/${connectionId}?provider_config_key=${integration.nangoId}`,
                {
                    method: 'DELETE',
                    credentials: 'omit', // Server-side: no cookies to send
                    headers: {
                        'Authorization': `Bearer ${this.secretKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        } catch (error) {
            console.error('[NangoService] Failed to delete connection:', error);
        }
    }

    /**
     * Check if a user has connected a specific integration
     */
    async isConnected(params: {
        integrationId: IntegrationId | string;
        userId: string;
    }): Promise<boolean> {
        const connection = await this.getConnection(params);
        return connection !== null;
    }

    /**
     * Get all connections for a user (checks all known integrations)
     */
    async getUserConnections(userId: string, integrationsToCheck?: IntegrationId[]): Promise<Array<{
        integrationId: IntegrationId;
        connected: boolean;
        connectionId?: string;
    }>> {
        const integrationIds = integrationsToCheck || (Object.keys(NANGO_INTEGRATIONS) as IntegrationId[]);
        const results: Array<{
            integrationId: IntegrationId;
            connected: boolean;
            connectionId?: string;
        }> = [];

        // Check connections in parallel (batch of 10)
        const batchSize = 10;
        for (let i = 0; i < integrationIds.length; i += batchSize) {
            const batch = integrationIds.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(async (integrationId) => {
                    const connection = await this.getConnection({ integrationId, userId });
                    return {
                        integrationId,
                        connected: connection !== null,
                        connectionId: connection?.connectionId,
                    };
                })
            );
            results.push(...batchResults);
        }

        return results;
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
}

// Export singleton instance
export const nangoService = new NangoService();
export default nangoService;
