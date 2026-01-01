/**
 * API Documentation Fetcher - Intelligent API discovery and documentation parsing
 *
 * Part of the Deep Intent Lock system. Identifies required external APIs from
 * user prompts and fetches their documentation to create exhaustive integration
 * requirements.
 */

import { createClaudeService, CLAUDE_MODELS, type ClaudeService } from './claude-service.js';
import type {
    IntegrationRequirement,
    APIEndpoint,
    APIErrorCode,
    RateLimit
} from './intent-lock.js';

// =============================================================================
// KNOWN API PLATFORMS (Pre-configured documentation sources)
// =============================================================================

interface KnownPlatform {
    name: string;
    category: string;
    baseUrl: string;
    authMethod: 'bearer' | 'api_key' | 'oauth' | 'basic';
    authHeader: string;
    docsUrl: string;
    envVarPrefix: string;
    commonEndpoints: APIEndpoint[];
    commonErrors: APIErrorCode[];
    defaultRateLimit: RateLimit;
}

const KNOWN_PLATFORMS: Record<string, KnownPlatform> = {
    'runway': {
        name: 'Runway ML',
        category: 'video_generation',
        baseUrl: 'https://api.runwayml.com/v1',
        authMethod: 'bearer',
        authHeader: 'Authorization: Bearer {token}',
        docsUrl: 'https://docs.runwayml.com',
        envVarPrefix: 'RUNWAY',
        commonEndpoints: [
            { path: '/generate', method: 'POST', purpose: 'Start video generation', usedBy: [] },
            { path: '/status/{id}', method: 'GET', purpose: 'Check generation status', usedBy: [] },
            { path: '/credits', method: 'GET', purpose: 'Check account credits', usedBy: [] },
        ],
        commonErrors: [
            { code: 401, meaning: 'Invalid API key', handling: 'Show API key setup modal' },
            { code: 429, meaning: 'Rate limit exceeded', handling: 'Wait and retry with exponential backoff' },
            { code: 500, meaning: 'Server error', handling: 'Retry with backoff, max 3 attempts' },
        ],
        defaultRateLimit: { requestsPerMinute: 10, pollingInterval: 5000, backoffStrategy: 'exponential' },
    },
    'openai': {
        name: 'OpenAI',
        category: 'ai_generation',
        baseUrl: 'https://api.openai.com/v1',
        authMethod: 'bearer',
        authHeader: 'Authorization: Bearer {token}',
        docsUrl: 'https://platform.openai.com/docs',
        envVarPrefix: 'OPENAI',
        commonEndpoints: [
            { path: '/chat/completions', method: 'POST', purpose: 'Chat completion', usedBy: [] },
            { path: '/images/generations', method: 'POST', purpose: 'Image generation', usedBy: [] },
            { path: '/audio/speech', method: 'POST', purpose: 'Text to speech', usedBy: [] },
            { path: '/audio/transcriptions', method: 'POST', purpose: 'Speech to text', usedBy: [] },
        ],
        commonErrors: [
            { code: 401, meaning: 'Invalid API key', handling: 'Show API key setup modal' },
            { code: 429, meaning: 'Rate limit exceeded', handling: 'Wait and retry with exponential backoff' },
            { code: 503, meaning: 'Service overloaded', handling: 'Retry with backoff' },
        ],
        defaultRateLimit: { requestsPerMinute: 60, pollingInterval: 1000, backoffStrategy: 'exponential' },
    },
    'anthropic': {
        name: 'Anthropic Claude',
        category: 'ai_generation',
        baseUrl: 'https://api.anthropic.com/v1',
        authMethod: 'api_key',
        authHeader: 'x-api-key: {token}',
        docsUrl: 'https://docs.anthropic.com',
        envVarPrefix: 'ANTHROPIC',
        commonEndpoints: [
            { path: '/messages', method: 'POST', purpose: 'Create message', usedBy: [] },
        ],
        commonErrors: [
            { code: 401, meaning: 'Invalid API key', handling: 'Show API key setup modal' },
            { code: 429, meaning: 'Rate limit exceeded', handling: 'Wait and retry with exponential backoff' },
            { code: 529, meaning: 'Overloaded', handling: 'Retry with exponential backoff' },
        ],
        defaultRateLimit: { requestsPerMinute: 60, pollingInterval: 1000, backoffStrategy: 'exponential' },
    },
    'stripe': {
        name: 'Stripe',
        category: 'payments',
        baseUrl: 'https://api.stripe.com/v1',
        authMethod: 'bearer',
        authHeader: 'Authorization: Bearer {token}',
        docsUrl: 'https://stripe.com/docs/api',
        envVarPrefix: 'STRIPE',
        commonEndpoints: [
            { path: '/customers', method: 'POST', purpose: 'Create customer', usedBy: [] },
            { path: '/payment_intents', method: 'POST', purpose: 'Create payment intent', usedBy: [] },
            { path: '/subscriptions', method: 'POST', purpose: 'Create subscription', usedBy: [] },
            { path: '/checkout/sessions', method: 'POST', purpose: 'Create checkout session', usedBy: [] },
        ],
        commonErrors: [
            { code: 401, meaning: 'Invalid API key', handling: 'Show API key setup modal' },
            { code: 402, meaning: 'Payment required', handling: 'Show payment error to user' },
            { code: 429, meaning: 'Rate limit exceeded', handling: 'Wait and retry with exponential backoff' },
        ],
        defaultRateLimit: { requestsPerMinute: 100, pollingInterval: 1000, backoffStrategy: 'linear' },
    },
    'supabase': {
        name: 'Supabase',
        category: 'database',
        baseUrl: 'https://{project}.supabase.co',
        authMethod: 'api_key',
        authHeader: 'apikey: {token}',
        docsUrl: 'https://supabase.com/docs',
        envVarPrefix: 'SUPABASE',
        commonEndpoints: [
            { path: '/rest/v1/{table}', method: 'GET', purpose: 'Query table', usedBy: [] },
            { path: '/rest/v1/{table}', method: 'POST', purpose: 'Insert row', usedBy: [] },
            { path: '/auth/v1/signup', method: 'POST', purpose: 'Sign up user', usedBy: [] },
            { path: '/auth/v1/token', method: 'POST', purpose: 'Get auth token', usedBy: [] },
            { path: '/storage/v1/object/{bucket}', method: 'POST', purpose: 'Upload file', usedBy: [] },
        ],
        commonErrors: [
            { code: 401, meaning: 'Invalid or expired token', handling: 'Refresh token or re-authenticate' },
            { code: 404, meaning: 'Resource not found', handling: 'Check table/bucket name' },
        ],
        defaultRateLimit: { requestsPerMinute: 500, pollingInterval: 100, backoffStrategy: 'linear' },
    },
    'cloudflare_r2': {
        name: 'Cloudflare R2',
        category: 'storage',
        baseUrl: 'https://{account_id}.r2.cloudflarestorage.com',
        authMethod: 'api_key',
        authHeader: 'Authorization: AWS4-HMAC-SHA256 ...',
        docsUrl: 'https://developers.cloudflare.com/r2',
        envVarPrefix: 'R2',
        commonEndpoints: [
            { path: '/{bucket}/{key}', method: 'PUT', purpose: 'Upload object', usedBy: [] },
            { path: '/{bucket}/{key}', method: 'GET', purpose: 'Get object', usedBy: [] },
            { path: '/{bucket}', method: 'GET', purpose: 'List objects', usedBy: [] },
        ],
        commonErrors: [
            { code: 403, meaning: 'Access denied', handling: 'Check bucket permissions' },
            { code: 404, meaning: 'Object not found', handling: 'Handle gracefully' },
        ],
        defaultRateLimit: { requestsPerMinute: 1000, pollingInterval: 100, backoffStrategy: 'linear' },
    },
    'aws_s3': {
        name: 'AWS S3',
        category: 'storage',
        baseUrl: 'https://s3.{region}.amazonaws.com',
        authMethod: 'api_key',
        authHeader: 'Authorization: AWS4-HMAC-SHA256 ...',
        docsUrl: 'https://docs.aws.amazon.com/s3',
        envVarPrefix: 'AWS',
        commonEndpoints: [
            { path: '/{bucket}/{key}', method: 'PUT', purpose: 'Upload object', usedBy: [] },
            { path: '/{bucket}/{key}', method: 'GET', purpose: 'Get object', usedBy: [] },
            { path: '/{bucket}', method: 'GET', purpose: 'List objects', usedBy: [] },
        ],
        commonErrors: [
            { code: 403, meaning: 'Access denied', handling: 'Check IAM permissions' },
            { code: 404, meaning: 'Bucket or object not found', handling: 'Handle gracefully' },
        ],
        defaultRateLimit: { requestsPerMinute: 3500, pollingInterval: 100, backoffStrategy: 'linear' },
    },
    'replicate': {
        name: 'Replicate',
        category: 'ai_generation',
        baseUrl: 'https://api.replicate.com/v1',
        authMethod: 'bearer',
        authHeader: 'Authorization: Bearer {token}',
        docsUrl: 'https://replicate.com/docs',
        envVarPrefix: 'REPLICATE',
        commonEndpoints: [
            { path: '/predictions', method: 'POST', purpose: 'Run model prediction', usedBy: [] },
            { path: '/predictions/{id}', method: 'GET', purpose: 'Get prediction status', usedBy: [] },
        ],
        commonErrors: [
            { code: 401, meaning: 'Invalid API key', handling: 'Show API key setup modal' },
            { code: 422, meaning: 'Invalid input', handling: 'Show validation error to user' },
        ],
        defaultRateLimit: { requestsPerMinute: 60, pollingInterval: 2000, backoffStrategy: 'exponential' },
    },
    'stability': {
        name: 'Stability AI',
        category: 'image_generation',
        baseUrl: 'https://api.stability.ai/v1',
        authMethod: 'bearer',
        authHeader: 'Authorization: Bearer {token}',
        docsUrl: 'https://platform.stability.ai/docs',
        envVarPrefix: 'STABILITY',
        commonEndpoints: [
            { path: '/generation/text-to-image', method: 'POST', purpose: 'Generate image from text', usedBy: [] },
            { path: '/generation/image-to-image', method: 'POST', purpose: 'Transform image', usedBy: [] },
        ],
        commonErrors: [
            { code: 401, meaning: 'Invalid API key', handling: 'Show API key setup modal' },
            { code: 429, meaning: 'Rate limit exceeded', handling: 'Wait and retry' },
        ],
        defaultRateLimit: { requestsPerMinute: 30, pollingInterval: 1000, backoffStrategy: 'exponential' },
    },
    'elevenlabs': {
        name: 'ElevenLabs',
        category: 'audio_generation',
        baseUrl: 'https://api.elevenlabs.io/v1',
        authMethod: 'api_key',
        authHeader: 'xi-api-key: {token}',
        docsUrl: 'https://docs.elevenlabs.io',
        envVarPrefix: 'ELEVENLABS',
        commonEndpoints: [
            { path: '/text-to-speech/{voice_id}', method: 'POST', purpose: 'Generate speech', usedBy: [] },
            { path: '/voices', method: 'GET', purpose: 'List voices', usedBy: [] },
        ],
        commonErrors: [
            { code: 401, meaning: 'Invalid API key', handling: 'Show API key setup modal' },
            { code: 429, meaning: 'Rate limit exceeded', handling: 'Wait and retry' },
        ],
        defaultRateLimit: { requestsPerMinute: 30, pollingInterval: 1000, backoffStrategy: 'exponential' },
    },
    'resend': {
        name: 'Resend',
        category: 'email',
        baseUrl: 'https://api.resend.com',
        authMethod: 'bearer',
        authHeader: 'Authorization: Bearer {token}',
        docsUrl: 'https://resend.com/docs',
        envVarPrefix: 'RESEND',
        commonEndpoints: [
            { path: '/emails', method: 'POST', purpose: 'Send email', usedBy: [] },
            { path: '/emails/{id}', method: 'GET', purpose: 'Get email status', usedBy: [] },
        ],
        commonErrors: [
            { code: 401, meaning: 'Invalid API key', handling: 'Show API key setup modal' },
            { code: 422, meaning: 'Invalid email', handling: 'Show validation error' },
        ],
        defaultRateLimit: { requestsPerMinute: 100, pollingInterval: 1000, backoffStrategy: 'linear' },
    },
    'twilio': {
        name: 'Twilio',
        category: 'sms',
        baseUrl: 'https://api.twilio.com/2010-04-01',
        authMethod: 'basic',
        authHeader: 'Authorization: Basic {base64(sid:token)}',
        docsUrl: 'https://www.twilio.com/docs',
        envVarPrefix: 'TWILIO',
        commonEndpoints: [
            { path: '/Accounts/{sid}/Messages.json', method: 'POST', purpose: 'Send SMS', usedBy: [] },
        ],
        commonErrors: [
            { code: 401, meaning: 'Invalid credentials', handling: 'Show credentials setup modal' },
            { code: 21211, meaning: 'Invalid phone number', handling: 'Show validation error' },
        ],
        defaultRateLimit: { requestsPerMinute: 100, pollingInterval: 1000, backoffStrategy: 'linear' },
    },
};

// =============================================================================
// PLATFORM DETECTION PATTERNS
// =============================================================================

interface PlatformPattern {
    platform: string;
    patterns: RegExp[];
    category: string;
}

const PLATFORM_PATTERNS: PlatformPattern[] = [
    { platform: 'runway', patterns: [/runway/i, /video\s*generat/i, /ai\s*video/i], category: 'video_generation' },
    { platform: 'openai', patterns: [/openai/i, /gpt/i, /dall-?e/i, /whisper/i, /chatgpt/i], category: 'ai_generation' },
    { platform: 'anthropic', patterns: [/anthropic/i, /claude/i], category: 'ai_generation' },
    { platform: 'stripe', patterns: [/stripe/i, /payment/i, /subscript/i, /checkout/i, /billing/i], category: 'payments' },
    { platform: 'supabase', patterns: [/supabase/i], category: 'database' },
    { platform: 'cloudflare_r2', patterns: [/cloudflare\s*r2/i, /r2\s*storage/i], category: 'storage' },
    { platform: 'aws_s3', patterns: [/aws\s*s3/i, /amazon\s*s3/i, /s3\s*bucket/i], category: 'storage' },
    { platform: 'replicate', patterns: [/replicate/i], category: 'ai_generation' },
    { platform: 'stability', patterns: [/stability/i, /stable\s*diffusion/i, /sdxl/i], category: 'image_generation' },
    { platform: 'elevenlabs', patterns: [/elevenlabs/i, /eleven\s*labs/i, /text.?to.?speech/i, /tts/i], category: 'audio_generation' },
    { platform: 'resend', patterns: [/resend/i], category: 'email' },
    { platform: 'twilio', patterns: [/twilio/i, /sms/i, /text\s*message/i], category: 'sms' },
];

// Category-based inference patterns (when specific platform not mentioned)
const CATEGORY_INFERENCE: Record<string, string[]> = {
    'video_generation': ['runway'],
    'image_generation': ['openai', 'stability'],
    'audio_generation': ['elevenlabs'],
    'ai_generation': ['openai'],
    'payments': ['stripe'],
    'database': ['supabase'],
    'storage': ['cloudflare_r2'],
    'email': ['resend'],
    'sms': ['twilio'],
};

const CATEGORY_PATTERNS: Array<{ category: string; patterns: RegExp[] }> = [
    { category: 'video_generation', patterns: [/video/i, /animation/i, /motion/i] },
    { category: 'image_generation', patterns: [/image/i, /picture/i, /photo/i, /art/i] },
    { category: 'audio_generation', patterns: [/audio/i, /voice/i, /speech/i, /sound/i, /podcast/i] },
    { category: 'ai_generation', patterns: [/ai/i, /artificial intelligence/i, /ml/i, /machine learning/i] },
    { category: 'payments', patterns: [/pay/i, /checkout/i, /subscription/i, /billing/i, /monetiz/i] },
    { category: 'database', patterns: [/databas/i, /persist/i, /store.*data/i, /save.*data/i] },
    { category: 'storage', patterns: [/upload/i, /file.*storage/i, /image.*upload/i, /cdn/i] },
    { category: 'email', patterns: [/email/i, /send.*mail/i, /newsletter/i] },
    { category: 'sms', patterns: [/sms/i, /text.*message/i, /phone.*notif/i] },
];

// =============================================================================
// API DOCUMENTATION FETCHER SERVICE
// =============================================================================

export class APIDocumentationFetcher {
    private claudeService: ClaudeService;

    constructor(userId: string, projectId: string) {
        this.claudeService = createClaudeService({
            projectId,
            userId,
            agentType: 'planning',
            systemPrompt: API_ANALYSIS_SYSTEM_PROMPT,
        });
    }

    /**
     * Identify all external integrations needed based on user prompt
     */
    async identifyRequiredIntegrations(prompt: string): Promise<string[]> {
        const identifiedPlatforms = new Set<string>();

        // Step 1: Direct platform mentions
        for (const { platform, patterns } of PLATFORM_PATTERNS) {
            for (const pattern of patterns) {
                if (pattern.test(prompt)) {
                    identifiedPlatforms.add(platform);
                    break;
                }
            }
        }

        // Step 2: Category-based inference
        for (const { category, patterns } of CATEGORY_PATTERNS) {
            for (const pattern of patterns) {
                if (pattern.test(prompt)) {
                    // Add default platforms for this category if not already identified
                    const categoryPlatforms = CATEGORY_INFERENCE[category] || [];
                    for (const platform of categoryPlatforms) {
                        if (!identifiedPlatforms.has(platform)) {
                            identifiedPlatforms.add(platform);
                        }
                    }
                    break;
                }
            }
        }

        // Step 3: Use Claude for deeper analysis if prompt is complex
        if (prompt.length > 200 || identifiedPlatforms.size === 0) {
            const aiIdentified = await this.aiIdentifyIntegrations(prompt);
            for (const platform of aiIdentified) {
                identifiedPlatforms.add(platform);
            }
        }

        return Array.from(identifiedPlatforms);
    }

    /**
     * Use AI to identify integrations from complex prompts
     */
    private async aiIdentifyIntegrations(prompt: string): Promise<string[]> {
        const response = await this.claudeService.generate(
            `Analyze this app description and identify ALL external APIs/services that would be needed:

"${prompt}"

Return ONLY a JSON array of platform IDs from this list:
${Object.keys(KNOWN_PLATFORMS).join(', ')}

If a capability is mentioned but no specific platform, choose the most appropriate default.

Example: ["stripe", "openai", "supabase"]

Return ONLY the JSON array, no explanation.`,
            {
                model: CLAUDE_MODELS.HAIKU_3_5,
                effort: 'low',
                maxTokens: 200,
            }
        );

        try {
            const parsed = JSON.parse(response.content);
            if (Array.isArray(parsed)) {
                return parsed.filter(p => typeof p === 'string' && KNOWN_PLATFORMS[p]);
            }
        } catch {
            // Extract platform names from response if JSON parse fails
            const matches: string[] = [];
            for (const platform of Object.keys(KNOWN_PLATFORMS)) {
                if (response.content.toLowerCase().includes(platform)) {
                    matches.push(platform);
                }
            }
            return matches;
        }

        return [];
    }

    /**
     * Get full documentation for a platform
     */
    async getIntegrationRequirement(platformId: string, purpose: string): Promise<IntegrationRequirement | null> {
        const platform = KNOWN_PLATFORMS[platformId];
        if (!platform) {
            console.warn(`[APIDocFetcher] Unknown platform: ${platformId}`);
            return null;
        }

        const id = `IR${String(Date.now()).slice(-6)}`;

        return {
            id,
            platform: platform.name,
            purpose,
            apiDetails: {
                baseUrl: platform.baseUrl,
                authMethod: platform.authMethod,
                authHeader: platform.authHeader,
                endpoints: platform.commonEndpoints.map(e => ({ ...e })),
                rateLimit: { ...platform.defaultRateLimit },
                errorCodes: platform.commonErrors.map(e => ({ ...e })),
            },
            credentialRequirements: {
                envVarName: `${platform.envVarPrefix}_API_KEY`,
                testEndpoint: platform.commonEndpoints[0]?.path || '/health',
                setupUrl: platform.docsUrl,
            },
            verified: false,
        };
    }

    /**
     * Get all integration requirements for identified platforms
     */
    async getIntegrationRequirements(
        prompt: string,
        platforms: string[]
    ): Promise<IntegrationRequirement[]> {
        const requirements: IntegrationRequirement[] = [];

        for (const platformId of platforms) {
            const purpose = await this.inferPurpose(prompt, platformId);
            const requirement = await this.getIntegrationRequirement(platformId, purpose);
            if (requirement) {
                requirements.push(requirement);
            }
        }

        return requirements;
    }

    /**
     * Infer the purpose of a platform from the prompt
     */
    private async inferPurpose(prompt: string, platformId: string): Promise<string> {
        const platform = KNOWN_PLATFORMS[platformId];
        if (!platform) return 'Integration';

        // Quick inference based on category
        const categoryPurposes: Record<string, string> = {
            'video_generation': 'AI video generation',
            'image_generation': 'AI image generation',
            'audio_generation': 'Text-to-speech and audio generation',
            'ai_generation': 'AI-powered features',
            'payments': 'Payment processing and subscriptions',
            'database': 'Data storage and authentication',
            'storage': 'File and media storage',
            'email': 'Email notifications and transactional emails',
            'sms': 'SMS notifications',
        };

        return categoryPurposes[platform.category] || `${platform.name} integration`;
    }

    /**
     * Check if we have documentation for a platform
     */
    hasDocumentation(platformId: string): boolean {
        return platformId in KNOWN_PLATFORMS;
    }

    /**
     * Get all known platforms
     */
    getKnownPlatforms(): string[] {
        return Object.keys(KNOWN_PLATFORMS);
    }

    /**
     * Get platform info
     */
    getPlatformInfo(platformId: string): KnownPlatform | null {
        return KNOWN_PLATFORMS[platformId] || null;
    }
}

// =============================================================================
// SYSTEM PROMPT FOR AI-ASSISTED ANALYSIS
// =============================================================================

const API_ANALYSIS_SYSTEM_PROMPT = `You are an expert at identifying external API integrations needed for web applications.

Given an app description, identify ALL external services that would be required:
- AI/ML services (OpenAI, Anthropic, Runway, Stability, etc.)
- Payment processors (Stripe, PayPal, etc.)
- Databases (Supabase, Firebase, etc.)
- Storage (S3, R2, etc.)
- Email (Resend, SendGrid, etc.)
- SMS (Twilio, etc.)
- Auth providers (Auth0, Clerk, etc.)

Be thorough - identify EVERY integration that would be needed for a production-ready app.`;

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createAPIDocumentationFetcher(userId: string, projectId: string): APIDocumentationFetcher {
    return new APIDocumentationFetcher(userId, projectId);
}

/**
 * Quick helper to identify integrations without creating an instance
 */
export async function identifyIntegrationsFromPrompt(
    prompt: string,
    userId: string,
    projectId: string
): Promise<IntegrationRequirement[]> {
    const fetcher = createAPIDocumentationFetcher(userId, projectId);
    const platforms = await fetcher.identifyRequiredIntegrations(prompt);
    return fetcher.getIntegrationRequirements(prompt, platforms);
}
