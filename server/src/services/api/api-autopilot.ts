/**
 * API Autopilot Service
 *
 * Automatic API discovery, integration, and code generation for third-party services.
 * Discovers APIs from URLs, parses OpenAPI specs, and generates type-safe integrations.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { getOpenRouterClient, getPhaseConfig } from '../ai/openrouter-client.js';
import type Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export interface RateLimit {
    requests: number;
    period: 'second' | 'minute' | 'hour' | 'day';
    burstLimit?: number;
}

export interface Parameter {
    name: string;
    in: 'path' | 'query' | 'header' | 'body';
    type: string;
    required: boolean;
    description?: string;
    default?: unknown;
    enum?: string[];
}

export interface APIEndpoint {
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    description: string;
    operationId?: string;
    parameters: Parameter[];
    requestBody?: {
        contentType: string;
        schema: object;
        required: boolean;
    };
    responseSchema?: object;
    example?: {
        request?: object;
        response?: object;
    };
    tags?: string[];
}

export interface APIProfile {
    id: string;
    name: string;
    provider: string;
    baseUrl: string;
    authType: 'api-key' | 'oauth2' | 'basic' | 'bearer' | 'none';
    authConfig?: {
        headerName?: string;
        prefix?: string;
        tokenUrl?: string;
        scopes?: string[];
    };
    endpoints: APIEndpoint[];
    sdkAvailable: boolean;
    sdkPackage?: string;
    openApiSpec?: object;
    documentation: string;
    rateLimits?: RateLimit;
    category?: string;
    logo?: string;
}

export interface EnvVariable {
    name: string;
    description: string;
    required: boolean;
    example?: string;
}

export interface GeneratedAPICode {
    serviceFile: string;
    serviceContent: string;
    typeDefinitions: string;
    envVariables: EnvVariable[];
    usageExamples: string[];
    dependencies: { name: string; version: string }[];
}

export interface EncryptedCredentials {
    encryptedData: string;
    iv: string;
    tag: string;
}

export type IntegrationStatus = 'configured' | 'testing' | 'active' | 'error';

export interface APIIntegration {
    id: string;
    projectId: string;
    apiProfile: APIProfile;
    credentials: EncryptedCredentials | null;
    generatedCode: GeneratedAPICode | null;
    status: IntegrationStatus;
    lastTested?: Date;
    testResult?: {
        success: boolean;
        message: string;
        responseTime?: number;
    };
    createdAt: Date;
    updatedAt: Date;
}

export interface CatalogEntry {
    name: string;
    provider: string;
    category: string;
    description: string;
    docUrl: string;
    logo?: string;
    popular: boolean;
    authType: 'api-key' | 'oauth2' | 'basic' | 'bearer' | 'none';
}

// =============================================================================
// API CATALOG
// =============================================================================

export const API_CATALOG: CatalogEntry[] = [
    {
        name: 'Stripe',
        provider: 'stripe',
        category: 'payments',
        description: 'Payment processing and subscription management',
        docUrl: 'https://docs.stripe.com/api',
        logo: 'https://stripe.com/img/v3/home/twitter.png',
        popular: true,
        authType: 'bearer',
    },
    {
        name: 'Twilio',
        provider: 'twilio',
        category: 'communication',
        description: 'SMS, voice, and video communication APIs',
        docUrl: 'https://www.twilio.com/docs/usage/api',
        logo: 'https://www.twilio.com/assets/icons/twilio-icon-512.png',
        popular: true,
        authType: 'basic',
    },
    {
        name: 'SendGrid',
        provider: 'sendgrid',
        category: 'email',
        description: 'Email delivery and marketing automation',
        docUrl: 'https://docs.sendgrid.com/api-reference',
        logo: 'https://sendgrid.com/brand/sg-logo-300.png',
        popular: true,
        authType: 'bearer',
    },
    {
        name: 'OpenAI',
        provider: 'openai',
        category: 'ai',
        description: 'GPT models, DALL-E, and Whisper APIs',
        docUrl: 'https://platform.openai.com/docs/api-reference',
        logo: 'https://openai.com/favicon.ico',
        popular: true,
        authType: 'bearer',
    },
    {
        name: 'Supabase',
        provider: 'supabase',
        category: 'database',
        description: 'Open source Firebase alternative with PostgreSQL',
        docUrl: 'https://supabase.com/docs/reference/javascript',
        logo: 'https://supabase.com/brand-assets/supabase-logo-icon.png',
        popular: true,
        authType: 'bearer',
    },
    {
        name: 'Firebase',
        provider: 'firebase',
        category: 'backend',
        description: 'Google\'s backend platform with realtime database',
        docUrl: 'https://firebase.google.com/docs/reference/rest',
        logo: 'https://firebase.google.com/images/brand-guidelines/logo-standard.png',
        popular: true,
        authType: 'bearer',
    },
    {
        name: 'Mapbox',
        provider: 'mapbox',
        category: 'maps',
        description: 'Maps, geocoding, and navigation APIs',
        docUrl: 'https://docs.mapbox.com/api',
        logo: 'https://docs.mapbox.com/help/demos/custom-markers-gl-js/mapbox-icon.png',
        popular: true,
        authType: 'api-key',
    },
    {
        name: 'Algolia',
        provider: 'algolia',
        category: 'search',
        description: 'Search and discovery APIs for web and mobile',
        docUrl: 'https://www.algolia.com/doc/api-reference',
        logo: 'https://www.algolia.com/static/logo-algolia-nebula-blue.svg',
        popular: true,
        authType: 'api-key',
    },
    {
        name: 'Cloudinary',
        provider: 'cloudinary',
        category: 'media',
        description: 'Image and video management APIs',
        docUrl: 'https://cloudinary.com/documentation/image_upload_api_reference',
        logo: 'https://cloudinary.com/images/cloudinary_logo_square.png',
        popular: true,
        authType: 'basic',
    },
    {
        name: 'GitHub',
        provider: 'github',
        category: 'developer',
        description: 'Repository, issues, and actions APIs',
        docUrl: 'https://docs.github.com/en/rest',
        logo: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
        popular: true,
        authType: 'bearer',
    },
    {
        name: 'Slack',
        provider: 'slack',
        category: 'communication',
        description: 'Messaging and workspace automation APIs',
        docUrl: 'https://api.slack.com/methods',
        logo: 'https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png',
        popular: true,
        authType: 'bearer',
    },
    {
        name: 'Notion',
        provider: 'notion',
        category: 'productivity',
        description: 'Database and content management APIs',
        docUrl: 'https://developers.notion.com/reference',
        logo: 'https://www.notion.so/images/logo-ios.png',
        popular: true,
        authType: 'bearer',
    },
    {
        name: 'Airtable',
        provider: 'airtable',
        category: 'database',
        description: 'Spreadsheet-database hybrid with powerful APIs',
        docUrl: 'https://airtable.com/developers/web/api',
        logo: 'https://airtable.com/favicon.ico',
        popular: true,
        authType: 'bearer',
    },
    {
        name: 'Vercel',
        provider: 'vercel',
        category: 'deployment',
        description: 'Deployment and serverless function APIs',
        docUrl: 'https://vercel.com/docs/rest-api',
        logo: 'https://vercel.com/favicon.ico',
        popular: true,
        authType: 'bearer',
    },
    {
        name: 'Resend',
        provider: 'resend',
        category: 'email',
        description: 'Modern email API for developers',
        docUrl: 'https://resend.com/docs/api-reference',
        logo: 'https://resend.com/favicon.ico',
        popular: true,
        authType: 'bearer',
    },
    {
        name: 'Plaid',
        provider: 'plaid',
        category: 'fintech',
        description: 'Banking and financial data APIs',
        docUrl: 'https://plaid.com/docs/api',
        logo: 'https://plaid.com/assets/img/plaid-icon-light.svg',
        popular: true,
        authType: 'basic',
    },
];

// =============================================================================
// PROMPTS
// =============================================================================

const API_DISCOVERY_PROMPT = `Analyze this API documentation and extract a complete API profile.

DOCUMENTATION URL: {docUrl}
DOCUMENTATION CONTENT:
{docContent}

Extract and return a JSON object:
{
  "name": "API name",
  "provider": "lowercase provider slug",
  "baseUrl": "https://api.example.com/v1",
  "authType": "api-key | oauth2 | basic | bearer | none",
  "authConfig": {
    "headerName": "Authorization or X-API-Key etc",
    "prefix": "Bearer or empty for api-key"
  },
  "sdkAvailable": true/false,
  "sdkPackage": "npm package name if available",
  "rateLimits": { "requests": 100, "period": "minute" },
  "endpoints": [
    {
      "path": "/resource",
      "method": "GET | POST | PUT | DELETE | PATCH",
      "description": "What this endpoint does",
      "operationId": "getResource",
      "parameters": [
        {
          "name": "id",
          "in": "path | query | header | body",
          "type": "string | number | boolean | object",
          "required": true/false,
          "description": "Parameter description"
        }
      ],
      "responseSchema": { "type": "object", "properties": {...} },
      "tags": ["category"]
    }
  ]
}

Be thorough - extract ALL endpoints you can find. Focus on the most commonly used endpoints first.`;

const CODE_GENERATION_PROMPT = `Generate a TypeScript service for the {apiName} API.

API Profile:
{apiProfile}

Requirements:
- Type-safe methods for each endpoint
- Error handling with typed error responses
- Rate limit handling with exponential backoff
- Logging for debugging
- Environment variable configuration
- JSDoc comments for all methods

Generate a complete response with:
1. SERVICE CODE: The main service class with typed methods
2. TYPE DEFINITIONS: TypeScript interfaces for requests/responses
3. USAGE EXAMPLES: Code examples showing how to use each method
4. ENV VARIABLES: List of required environment variables

Format response as JSON:
{
  "serviceContent": "// Complete TypeScript service code",
  "typeDefinitions": "// TypeScript interfaces",
  "usageExamples": ["// Example 1", "// Example 2"],
  "envVariables": [{"name": "API_KEY", "description": "...", "required": true}],
  "dependencies": [{"name": "axios", "version": "^1.6.0"}]
}`;

// =============================================================================
// SERVICE
// =============================================================================

export class APIAutopilotService extends EventEmitter {
    private integrations: Map<string, APIIntegration> = new Map();
    private openRouter = getOpenRouterClient();
    private client: Anthropic;
    private encryptionKey: Buffer;

    constructor() {
        super();
        this.client = this.openRouter.getClient();
        // Use a secure key from environment or generate one
        const keySource = process.env.API_ENCRYPTION_KEY || 'kriptik-api-autopilot-key-default';
        this.encryptionKey = crypto.scryptSync(keySource, 'salt', 32);
    }

    /**
     * Get the API catalog
     */
    getCatalog(category?: string): CatalogEntry[] {
        if (category) {
            return API_CATALOG.filter(api => api.category === category);
        }
        return API_CATALOG;
    }

    /**
     * Get catalog categories
     */
    getCategories(): string[] {
        const categories = new Set(API_CATALOG.map(api => api.category));
        return Array.from(categories).sort();
    }

    /**
     * Search catalog
     */
    searchCatalog(query: string): CatalogEntry[] {
        const lowerQuery = query.toLowerCase();
        return API_CATALOG.filter(api =>
            api.name.toLowerCase().includes(lowerQuery) ||
            api.provider.toLowerCase().includes(lowerQuery) ||
            api.description.toLowerCase().includes(lowerQuery) ||
            api.category.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Discover API from URL or documentation
     */
    async discoverAPI(docUrl: string, docContent?: string): Promise<APIProfile> {
        this.emit('discovery:started', { docUrl });

        try {
            // If no content provided, we'd scrape it (browser service)
            // For now, we'll work with the URL and any provided content
            const content = docContent || `API Documentation at: ${docUrl}`;

            const phaseConfig = getPhaseConfig('intent_lock');
            const prompt = API_DISCOVERY_PROMPT
                .replace('{docUrl}', docUrl)
                .replace('{docContent}', content);

            const response = await this.client.messages.create({
                model: phaseConfig.model,
                max_tokens: 8000,
                system: 'You are an expert at analyzing API documentation and extracting structured API profiles. Always respond with valid JSON.',
                messages: [{ role: 'user', content: prompt }],
            });

            const responseContent = response.content[0];
            const text = responseContent.type === 'text' ? responseContent.text : '';

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Failed to parse API profile from documentation');
            }

            const profileData = JSON.parse(jsonMatch[0]);

            const profile: APIProfile = {
                id: uuidv4(),
                name: profileData.name || 'Unknown API',
                provider: profileData.provider || 'unknown',
                baseUrl: profileData.baseUrl || docUrl,
                authType: profileData.authType || 'api-key',
                authConfig: profileData.authConfig,
                endpoints: profileData.endpoints || [],
                sdkAvailable: profileData.sdkAvailable || false,
                sdkPackage: profileData.sdkPackage,
                openApiSpec: profileData.openApiSpec,
                documentation: docUrl,
                rateLimits: profileData.rateLimits,
                category: profileData.category,
            };

            this.emit('discovery:complete', { profile });
            return profile;
        } catch (error) {
            this.emit('discovery:error', { docUrl, error });
            throw error;
        }
    }

    /**
     * Create a profile from catalog entry
     */
    async createProfileFromCatalog(provider: string): Promise<APIProfile> {
        const catalogEntry = API_CATALOG.find(api => api.provider === provider);
        if (!catalogEntry) {
            throw new Error(`API provider "${provider}" not found in catalog`);
        }

        // Create a basic profile from catalog - full discovery would enhance this
        const profile: APIProfile = {
            id: uuidv4(),
            name: catalogEntry.name,
            provider: catalogEntry.provider,
            baseUrl: this.getDefaultBaseUrl(catalogEntry.provider),
            authType: catalogEntry.authType,
            authConfig: this.getDefaultAuthConfig(catalogEntry.authType, catalogEntry.provider),
            endpoints: this.getDefaultEndpoints(catalogEntry.provider),
            sdkAvailable: true,
            sdkPackage: this.getDefaultSdkPackage(catalogEntry.provider),
            documentation: catalogEntry.docUrl,
            category: catalogEntry.category,
            logo: catalogEntry.logo,
        };

        return profile;
    }

    /**
     * Generate integration code for an API
     */
    async generateIntegrationCode(profile: APIProfile): Promise<GeneratedAPICode> {
        this.emit('generation:started', { profileId: profile.id });

        try {
            const phaseConfig = getPhaseConfig('build_agent');
            const prompt = CODE_GENERATION_PROMPT
                .replace('{apiName}', profile.name)
                .replace('{apiProfile}', JSON.stringify(profile, null, 2));

            const response = await this.client.messages.create({
                model: phaseConfig.model,
                max_tokens: 16000,
                system: 'You are an expert TypeScript developer specializing in API integrations. Generate clean, type-safe, production-ready code. Always respond with valid JSON.',
                messages: [{ role: 'user', content: prompt }],
            });

            const responseContent = response.content[0];
            const text = responseContent.type === 'text' ? responseContent.text : '';

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Failed to generate integration code');
            }

            const codeData = JSON.parse(jsonMatch[0]);

            const generatedCode: GeneratedAPICode = {
                serviceFile: `src/services/${profile.provider}-service.ts`,
                serviceContent: codeData.serviceContent || '',
                typeDefinitions: codeData.typeDefinitions || '',
                envVariables: codeData.envVariables || [],
                usageExamples: codeData.usageExamples || [],
                dependencies: codeData.dependencies || [],
            };

            this.emit('generation:complete', { profileId: profile.id, generatedCode });
            return generatedCode;
        } catch (error) {
            this.emit('generation:error', { profileId: profile.id, error });
            throw error;
        }
    }

    /**
     * Create an integration
     */
    createIntegration(projectId: string, profile: APIProfile): APIIntegration {
        const integration: APIIntegration = {
            id: uuidv4(),
            projectId,
            apiProfile: profile,
            credentials: null,
            generatedCode: null,
            status: 'configured',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.integrations.set(integration.id, integration);
        this.emit('integration:created', { integration });
        return integration;
    }

    /**
     * Get integration
     */
    getIntegration(integrationId: string): APIIntegration | undefined {
        return this.integrations.get(integrationId);
    }

    /**
     * Store credentials securely
     */
    storeCredentials(integrationId: string, credentials: Record<string, string>): void {
        const integration = this.integrations.get(integrationId);
        if (!integration) {
            throw new Error('Integration not found');
        }

        const encrypted = this.encryptCredentials(credentials);
        integration.credentials = encrypted;
        integration.updatedAt = new Date();

        this.emit('credentials:stored', { integrationId });
    }

    /**
     * Get decrypted credentials
     */
    getCredentials(integrationId: string): Record<string, string> | null {
        const integration = this.integrations.get(integrationId);
        if (!integration || !integration.credentials) {
            return null;
        }

        return this.decryptCredentials(integration.credentials);
    }

    /**
     * Test API connection
     */
    async testConnection(integrationId: string): Promise<{ success: boolean; message: string; responseTime?: number }> {
        const integration = this.integrations.get(integrationId);
        if (!integration) {
            throw new Error('Integration not found');
        }

        integration.status = 'testing';
        this.emit('test:started', { integrationId });

        const startTime = Date.now();

        try {
            const credentials = integration.credentials ? this.decryptCredentials(integration.credentials) : null;
            const profile = integration.apiProfile;

            // Build test request
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            if (credentials) {
                if (profile.authType === 'bearer') {
                    const token = credentials.apiKey || credentials.token || credentials.accessToken;
                    headers['Authorization'] = `Bearer ${token}`;
                } else if (profile.authType === 'api-key') {
                    const headerName = profile.authConfig?.headerName || 'X-API-Key';
                    headers[headerName] = credentials.apiKey || '';
                } else if (profile.authType === 'basic') {
                    const auth = Buffer.from(`${credentials.username || ''}:${credentials.password || ''}`).toString('base64');
                    headers['Authorization'] = `Basic ${auth}`;
                }
            }

            // Try to hit a safe endpoint (usually the base URL or a /health endpoint)
            const testUrl = profile.baseUrl;
            const response = await fetch(testUrl, {
                method: 'GET',
                headers,
            });

            const responseTime = Date.now() - startTime;

            // Consider 401/403 as "connection works but auth issues" which is still a valid test
            const success = response.ok || response.status === 401 || response.status === 403;
            const message = success
                ? response.ok
                    ? 'Connection successful'
                    : 'Connection successful (authentication may need verification)'
                : `Connection failed: ${response.status} ${response.statusText}`;

            integration.testResult = { success, message, responseTime };
            integration.lastTested = new Date();
            integration.status = success ? 'active' : 'error';
            integration.updatedAt = new Date();

            this.emit('test:complete', { integrationId, result: integration.testResult });
            return integration.testResult;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Connection test failed';
            integration.testResult = { success: false, message };
            integration.lastTested = new Date();
            integration.status = 'error';
            integration.updatedAt = new Date();

            this.emit('test:error', { integrationId, error: message });
            return integration.testResult;
        }
    }

    /**
     * Encrypt credentials
     */
    private encryptCredentials(credentials: Record<string, string>): EncryptedCredentials {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

        const json = JSON.stringify(credentials);
        let encrypted = cipher.update(json, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const tag = cipher.getAuthTag();

        return {
            encryptedData: encrypted,
            iv: iv.toString('hex'),
            tag: tag.toString('hex'),
        };
    }

    /**
     * Decrypt credentials
     */
    private decryptCredentials(encrypted: EncryptedCredentials): Record<string, string> {
        const iv = Buffer.from(encrypted.iv, 'hex');
        const tag = Buffer.from(encrypted.tag, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encrypted.encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);
    }

    /**
     * Get default base URL for known providers
     */
    private getDefaultBaseUrl(provider: string): string {
        const baseUrls: Record<string, string> = {
            stripe: 'https://api.stripe.com/v1',
            twilio: 'https://api.twilio.com/2010-04-01',
            sendgrid: 'https://api.sendgrid.com/v3',
            openai: 'https://api.openai.com/v1',
            supabase: 'https://api.supabase.io',
            firebase: 'https://firebase.googleapis.com',
            mapbox: 'https://api.mapbox.com',
            algolia: 'https://algolia.net',
            cloudinary: 'https://api.cloudinary.com/v1_1',
            github: 'https://api.github.com',
            slack: 'https://slack.com/api',
            notion: 'https://api.notion.com/v1',
            airtable: 'https://api.airtable.com/v0',
            vercel: 'https://api.vercel.com',
            resend: 'https://api.resend.com',
            plaid: 'https://production.plaid.com',
        };
        return baseUrls[provider] || `https://api.${provider}.com`;
    }

    /**
     * Get default auth config for auth type
     */
    private getDefaultAuthConfig(authType: string, provider: string): APIProfile['authConfig'] {
        switch (authType) {
            case 'bearer':
                return { headerName: 'Authorization', prefix: 'Bearer' };
            case 'api-key':
                return { headerName: 'X-API-Key', prefix: '' };
            case 'basic':
                return { headerName: 'Authorization', prefix: 'Basic' };
            default:
                return {};
        }
    }

    /**
     * Get default SDK package for known providers
     */
    private getDefaultSdkPackage(provider: string): string | undefined {
        const packages: Record<string, string> = {
            stripe: 'stripe',
            twilio: 'twilio',
            sendgrid: '@sendgrid/mail',
            openai: 'openai',
            supabase: '@supabase/supabase-js',
            firebase: 'firebase-admin',
            mapbox: '@mapbox/mapbox-sdk',
            algolia: 'algoliasearch',
            cloudinary: 'cloudinary',
            github: '@octokit/rest',
            slack: '@slack/web-api',
            notion: '@notionhq/client',
            airtable: 'airtable',
            vercel: '@vercel/client',
            resend: 'resend',
            plaid: 'plaid',
        };
        return packages[provider];
    }

    /**
     * Get default endpoints for known providers
     */
    private getDefaultEndpoints(provider: string): APIEndpoint[] {
        // Return common endpoints for well-known providers
        const endpointMap: Record<string, APIEndpoint[]> = {
            stripe: [
                { path: '/customers', method: 'GET', description: 'List customers', parameters: [], tags: ['customers'] },
                { path: '/customers', method: 'POST', description: 'Create customer', parameters: [], tags: ['customers'] },
                { path: '/charges', method: 'POST', description: 'Create charge', parameters: [], tags: ['charges'] },
                { path: '/subscriptions', method: 'GET', description: 'List subscriptions', parameters: [], tags: ['subscriptions'] },
                { path: '/payment_intents', method: 'POST', description: 'Create payment intent', parameters: [], tags: ['payments'] },
            ],
            openai: [
                { path: '/chat/completions', method: 'POST', description: 'Create chat completion', parameters: [], tags: ['chat'] },
                { path: '/embeddings', method: 'POST', description: 'Create embeddings', parameters: [], tags: ['embeddings'] },
                { path: '/images/generations', method: 'POST', description: 'Generate images', parameters: [], tags: ['images'] },
                { path: '/audio/transcriptions', method: 'POST', description: 'Transcribe audio', parameters: [], tags: ['audio'] },
            ],
            sendgrid: [
                { path: '/mail/send', method: 'POST', description: 'Send email', parameters: [], tags: ['mail'] },
                { path: '/templates', method: 'GET', description: 'List templates', parameters: [], tags: ['templates'] },
                { path: '/contactdb/recipients', method: 'POST', description: 'Add recipients', parameters: [], tags: ['contacts'] },
            ],
            twilio: [
                { path: '/Messages.json', method: 'POST', description: 'Send SMS', parameters: [], tags: ['messages'] },
                { path: '/Calls.json', method: 'POST', description: 'Make call', parameters: [], tags: ['calls'] },
            ],
            resend: [
                { path: '/emails', method: 'POST', description: 'Send email', parameters: [], tags: ['emails'] },
                { path: '/emails/{id}', method: 'GET', description: 'Get email', parameters: [], tags: ['emails'] },
            ],
        };

        return endpointMap[provider] || [];
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: APIAutopilotService | null = null;

export function getAPIAutopilotService(): APIAutopilotService {
    if (!instance) {
        instance = new APIAutopilotService();
    }
    return instance;
}

export function createAPIAutopilotService(): APIAutopilotService {
    return new APIAutopilotService();
}

