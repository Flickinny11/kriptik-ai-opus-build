/**
 * Research Agent Service
 *
 * Phase 0.25 of the BuildLoop - Autonomous research before provisioning:
 * - Identifies required external services from production stack
 * - Researches signup URLs, free tiers, and credential requirements
 * - Creates structured research results for provisioning agents
 *
 * Uses web search and vision models to gather current, accurate information.
 */

import { db } from '../../db.js';
import { provisioningSessions } from '../../schema.js';
import { eq } from 'drizzle-orm';
import { getModelRouter } from '../ai/model-router.js';
import { getBrowserbaseClient } from './browserbase-client.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ServiceRequirement {
    serviceType: string; // 'database' | 'auth' | 'storage' | 'email' | 'payments' | 'hosting' | 'ai' | 'analytics'
    provider?: string; // e.g., 'supabase', 'stripe', 'vercel'
    required: boolean;
    reason: string;
    envVarsNeeded: string[];
}

export interface ResearchResult {
    serviceName: string;
    provider: string;
    signupUrl: string;
    hasFreeTier: boolean;
    freeTierLimits?: string;
    pricingTier?: string;
    estimatedCost: number; // cents per month
    credentialsToFetch: string[];
    signupSteps?: string[];
    oauthAvailable?: boolean;
    apiDocsUrl?: string;
    dashboardUrl?: string;
}

export interface ResearchRequest {
    provisioningSessionId: string;
    projectId: string;
    userId: string;
    requirements: ServiceRequirement[];
}

// ============================================================================
// SERVICE KNOWLEDGE BASE
// ============================================================================

const SERVICE_KNOWLEDGE: Record<string, Partial<ResearchResult>> = {
    // Databases
    supabase: {
        provider: 'Supabase',
        signupUrl: 'https://supabase.com/dashboard/sign-up',
        hasFreeTier: true,
        freeTierLimits: '500MB database, 2 projects, 50,000 monthly active users',
        credentialsToFetch: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
        oauthAvailable: true,
        apiDocsUrl: 'https://supabase.com/docs/reference/api',
        dashboardUrl: 'https://supabase.com/dashboard',
    },
    neon: {
        provider: 'Neon',
        signupUrl: 'https://console.neon.tech/signup',
        hasFreeTier: true,
        freeTierLimits: '10 branches, 3GB storage',
        credentialsToFetch: ['DATABASE_URL', 'PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD'],
        oauthAvailable: true,
        apiDocsUrl: 'https://neon.tech/docs/reference/api-reference',
        dashboardUrl: 'https://console.neon.tech',
    },
    planetscale: {
        provider: 'PlanetScale',
        signupUrl: 'https://app.planetscale.com/sign-up',
        hasFreeTier: true,
        freeTierLimits: '5GB storage, 1 billion row reads/month',
        credentialsToFetch: ['DATABASE_URL'],
        oauthAvailable: true,
        apiDocsUrl: 'https://api-docs.planetscale.com',
        dashboardUrl: 'https://app.planetscale.com',
    },
    turso: {
        provider: 'Turso',
        signupUrl: 'https://turso.tech/app/signup',
        hasFreeTier: true,
        freeTierLimits: '9GB storage, 500 databases',
        credentialsToFetch: ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'],
        oauthAvailable: false,
        apiDocsUrl: 'https://docs.turso.tech/api-reference',
        dashboardUrl: 'https://turso.tech/app',
    },

    // Authentication
    clerk: {
        provider: 'Clerk',
        signupUrl: 'https://dashboard.clerk.com/sign-up',
        hasFreeTier: true,
        freeTierLimits: '10,000 monthly active users',
        credentialsToFetch: ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY'],
        oauthAvailable: false,
        apiDocsUrl: 'https://clerk.com/docs/reference/backend-api',
        dashboardUrl: 'https://dashboard.clerk.com',
    },
    auth0: {
        provider: 'Auth0',
        signupUrl: 'https://auth0.com/signup',
        hasFreeTier: true,
        freeTierLimits: '7,500 monthly active users',
        credentialsToFetch: ['AUTH0_SECRET', 'AUTH0_BASE_URL', 'AUTH0_ISSUER_BASE_URL', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET'],
        oauthAvailable: false,
        apiDocsUrl: 'https://auth0.com/docs/api',
        dashboardUrl: 'https://manage.auth0.com',
    },

    // Payments
    stripe: {
        provider: 'Stripe',
        signupUrl: 'https://dashboard.stripe.com/register',
        hasFreeTier: true,
        freeTierLimits: 'No monthly fee, 2.9% + 30¢ per transaction',
        credentialsToFetch: ['STRIPE_PUBLISHABLE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
        oauthAvailable: true,
        apiDocsUrl: 'https://stripe.com/docs/api',
        dashboardUrl: 'https://dashboard.stripe.com',
    },
    lemonsqueezy: {
        provider: 'Lemon Squeezy',
        signupUrl: 'https://app.lemonsqueezy.com/register',
        hasFreeTier: true,
        freeTierLimits: '5% + 50¢ per transaction',
        credentialsToFetch: ['LEMONSQUEEZY_API_KEY', 'LEMONSQUEEZY_STORE_ID', 'LEMONSQUEEZY_WEBHOOK_SECRET'],
        oauthAvailable: false,
        apiDocsUrl: 'https://docs.lemonsqueezy.com/api',
        dashboardUrl: 'https://app.lemonsqueezy.com',
    },

    // Email
    resend: {
        provider: 'Resend',
        signupUrl: 'https://resend.com/signup',
        hasFreeTier: true,
        freeTierLimits: '3,000 emails/month, 100 emails/day',
        credentialsToFetch: ['RESEND_API_KEY'],
        oauthAvailable: false,
        apiDocsUrl: 'https://resend.com/docs/api-reference',
        dashboardUrl: 'https://resend.com',
    },
    sendgrid: {
        provider: 'SendGrid',
        signupUrl: 'https://signup.sendgrid.com',
        hasFreeTier: true,
        freeTierLimits: '100 emails/day forever',
        credentialsToFetch: ['SENDGRID_API_KEY'],
        oauthAvailable: false,
        apiDocsUrl: 'https://docs.sendgrid.com/api-reference',
        dashboardUrl: 'https://app.sendgrid.com',
    },

    // Storage
    cloudinary: {
        provider: 'Cloudinary',
        signupUrl: 'https://cloudinary.com/users/register_free',
        hasFreeTier: true,
        freeTierLimits: '25GB storage, 25GB bandwidth/month',
        credentialsToFetch: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
        oauthAvailable: false,
        apiDocsUrl: 'https://cloudinary.com/documentation/admin_api',
        dashboardUrl: 'https://console.cloudinary.com',
    },
    uploadthing: {
        provider: 'UploadThing',
        signupUrl: 'https://uploadthing.com/dashboard',
        hasFreeTier: true,
        freeTierLimits: '2GB storage, 2GB transfer/month',
        credentialsToFetch: ['UPLOADTHING_SECRET', 'UPLOADTHING_APP_ID'],
        oauthAvailable: false,
        apiDocsUrl: 'https://docs.uploadthing.com',
        dashboardUrl: 'https://uploadthing.com/dashboard',
    },

    // Hosting
    vercel: {
        provider: 'Vercel',
        signupUrl: 'https://vercel.com/signup',
        hasFreeTier: true,
        freeTierLimits: 'Hobby tier: 100GB bandwidth, serverless functions',
        credentialsToFetch: ['VERCEL_TOKEN'],
        oauthAvailable: true,
        apiDocsUrl: 'https://vercel.com/docs/rest-api',
        dashboardUrl: 'https://vercel.com/dashboard',
    },
    netlify: {
        provider: 'Netlify',
        signupUrl: 'https://app.netlify.com/signup',
        hasFreeTier: true,
        freeTierLimits: '100GB bandwidth, 300 build minutes/month',
        credentialsToFetch: ['NETLIFY_AUTH_TOKEN', 'NETLIFY_SITE_ID'],
        oauthAvailable: true,
        apiDocsUrl: 'https://docs.netlify.com/api/get-started',
        dashboardUrl: 'https://app.netlify.com',
    },
    railway: {
        provider: 'Railway',
        signupUrl: 'https://railway.app/new',
        hasFreeTier: true,
        freeTierLimits: '$5 free credit, then usage-based',
        credentialsToFetch: ['RAILWAY_TOKEN'],
        oauthAvailable: true,
        apiDocsUrl: 'https://docs.railway.app/reference/graphql-api',
        dashboardUrl: 'https://railway.app/dashboard',
    },

    // AI Services
    openai: {
        provider: 'OpenAI',
        signupUrl: 'https://platform.openai.com/signup',
        hasFreeTier: false,
        estimatedCost: 2000, // $20/month estimate
        credentialsToFetch: ['OPENAI_API_KEY'],
        oauthAvailable: false,
        apiDocsUrl: 'https://platform.openai.com/docs/api-reference',
        dashboardUrl: 'https://platform.openai.com',
    },
    anthropic: {
        provider: 'Anthropic',
        signupUrl: 'https://console.anthropic.com/signup',
        hasFreeTier: false,
        estimatedCost: 2000,
        credentialsToFetch: ['ANTHROPIC_API_KEY'],
        oauthAvailable: false,
        apiDocsUrl: 'https://docs.anthropic.com/en/api',
        dashboardUrl: 'https://console.anthropic.com',
    },

    // Analytics
    posthog: {
        provider: 'PostHog',
        signupUrl: 'https://app.posthog.com/signup',
        hasFreeTier: true,
        freeTierLimits: '1 million events/month',
        credentialsToFetch: ['NEXT_PUBLIC_POSTHOG_KEY', 'POSTHOG_HOST'],
        oauthAvailable: false,
        apiDocsUrl: 'https://posthog.com/docs/api',
        dashboardUrl: 'https://app.posthog.com',
    },
};

// ============================================================================
// RESEARCH AGENT SERVICE
// ============================================================================

export class ResearchAgentService {
    private modelRouter = getModelRouter();
    private browserbaseClient = getBrowserbaseClient();

    /**
     * Research all required services for a project
     */
    async researchServices(request: ResearchRequest): Promise<ResearchResult[]> {
        const results: ResearchResult[] = [];

        // Update session status
        await db.update(provisioningSessions)
            .set({
                status: 'researching',
                phase: 'research',
            })
            .where(eq(provisioningSessions.id, request.provisioningSessionId));

        for (const requirement of request.requirements) {
            try {
                const result = await this.researchSingleService(requirement, request);
                results.push(result);
            } catch (error) {
                console.error(`[ResearchAgent] Failed to research ${requirement.provider}:`, error);
                // Create a placeholder result with error
                results.push({
                    serviceName: requirement.serviceType,
                    provider: requirement.provider || 'unknown',
                    signupUrl: '',
                    hasFreeTier: false,
                    estimatedCost: 0,
                    credentialsToFetch: requirement.envVarsNeeded,
                });
            }
        }

        // Save research results to session
        await db.update(provisioningSessions)
            .set({
                researchResults: results,
                totalTasks: results.length,
            })
            .where(eq(provisioningSessions.id, request.provisioningSessionId));

        return results;
    }

    /**
     * Research a single service
     */
    private async researchSingleService(
        requirement: ServiceRequirement,
        request: ResearchRequest
    ): Promise<ResearchResult> {
        const providerKey = requirement.provider?.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Check if we have cached knowledge
        if (providerKey && SERVICE_KNOWLEDGE[providerKey]) {
            const cached = SERVICE_KNOWLEDGE[providerKey];
            return {
                serviceName: requirement.serviceType,
                provider: cached.provider || requirement.provider || 'Unknown',
                signupUrl: cached.signupUrl || '',
                hasFreeTier: cached.hasFreeTier ?? false,
                freeTierLimits: cached.freeTierLimits,
                estimatedCost: cached.estimatedCost || 0,
                credentialsToFetch: cached.credentialsToFetch || requirement.envVarsNeeded,
                oauthAvailable: cached.oauthAvailable,
                apiDocsUrl: cached.apiDocsUrl,
                dashboardUrl: cached.dashboardUrl,
            };
        }

        // For unknown services, use AI to research
        return await this.aiResearchService(requirement);
    }

    /**
     * Use AI to research an unknown service
     */
    private async aiResearchService(requirement: ServiceRequirement): Promise<ResearchResult> {
        const prompt = `Research the following service and provide accurate, current information:

Service Type: ${requirement.serviceType}
Provider: ${requirement.provider || 'Recommend the best option'}
Required Env Vars: ${requirement.envVarsNeeded.join(', ')}

Provide the following information in JSON format:
{
    "serviceName": "the service category",
    "provider": "the specific provider name",
    "signupUrl": "direct URL to signup page",
    "hasFreeTier": true/false,
    "freeTierLimits": "description of free tier limits if available",
    "estimatedCost": 0, // monthly cost in cents if no free tier
    "credentialsToFetch": ["ENV_VAR_1", "ENV_VAR_2"],
    "signupSteps": ["Step 1", "Step 2", "Step 3"],
    "oauthAvailable": true/false,
    "apiDocsUrl": "URL to API documentation",
    "dashboardUrl": "URL to dashboard"
}

Be accurate and only include real, verifiable URLs.`;

        try {
            const response = await this.modelRouter.generate({
                prompt,
                taskType: 'research',
                forceTier: 'standard',
                maxTokens: 1000,
                systemPrompt: 'You are a technical researcher with expert knowledge of developer tools and SaaS services. Provide accurate, current information about services and their APIs.',
            });

            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Failed to parse AI research response');
            }

            const parsed = JSON.parse(jsonMatch[0]);
            return {
                serviceName: parsed.serviceName || requirement.serviceType,
                provider: parsed.provider || requirement.provider || 'Unknown',
                signupUrl: parsed.signupUrl || '',
                hasFreeTier: parsed.hasFreeTier ?? false,
                freeTierLimits: parsed.freeTierLimits,
                estimatedCost: parsed.estimatedCost || 0,
                credentialsToFetch: parsed.credentialsToFetch || requirement.envVarsNeeded,
                signupSteps: parsed.signupSteps,
                oauthAvailable: parsed.oauthAvailable,
                apiDocsUrl: parsed.apiDocsUrl,
                dashboardUrl: parsed.dashboardUrl,
            };
        } catch (error) {
            console.error('[ResearchAgent] AI research failed:', error);
            return {
                serviceName: requirement.serviceType,
                provider: requirement.provider || 'Unknown',
                signupUrl: '',
                hasFreeTier: false,
                estimatedCost: 0,
                credentialsToFetch: requirement.envVarsNeeded,
            };
        }
    }

    /**
     * Research with live browser (for dynamic/complex research)
     */
    async researchWithBrowser(
        serviceName: string,
        targetUrl: string,
        questions: string[],
        auditContext: { userId: string; provisioningSessionId: string }
    ): Promise<Record<string, string>> {
        if (!this.browserbaseClient.isConfigured()) {
            throw new Error('Browserbase not configured for browser research');
        }

        // Create a temporary task for research
        const taskId = `research-${Date.now()}`;

        try {
            await this.browserbaseClient.createSession(taskId);
            await this.browserbaseClient.navigateTo(taskId, targetUrl, auditContext);

            // Take screenshot for analysis
            const screenshot = await this.browserbaseClient.takeScreenshot(taskId);

            // Use vision model to extract answers
            const prompt = `Analyze this webpage screenshot and answer the following questions:

${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Respond with JSON:
{
    "answers": {
        "question1": "answer1",
        "question2": "answer2"
    }
}`;

            const response = await this.modelRouter.generate({
                prompt,
                taskType: 'vision',
                forceTier: 'standard',
                maxTokens: 500,
                images: [{ url: `data:image/png;base64,${screenshot}`, detail: 'high' }],
            });

            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return {};
            }

            const parsed = JSON.parse(jsonMatch[0]);
            return parsed.answers || {};
        } finally {
            await this.browserbaseClient.closeSession(taskId);
        }
    }

    /**
     * Get the knowledge base entry for a service
     */
    getServiceKnowledge(providerKey: string): Partial<ResearchResult> | null {
        const key = providerKey.toLowerCase().replace(/[^a-z0-9]/g, '');
        return SERVICE_KNOWLEDGE[key] || null;
    }

    /**
     * Get all known services by category
     */
    getKnownServicesByCategory(category: string): string[] {
        const categoryMap: Record<string, string[]> = {
            database: ['supabase', 'neon', 'planetscale', 'turso'],
            auth: ['clerk', 'auth0'],
            payments: ['stripe', 'lemonsqueezy'],
            email: ['resend', 'sendgrid'],
            storage: ['cloudinary', 'uploadthing'],
            hosting: ['vercel', 'netlify', 'railway'],
            ai: ['openai', 'anthropic'],
            analytics: ['posthog'],
        };

        return categoryMap[category.toLowerCase()] || [];
    }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: ResearchAgentService | null = null;

export function getResearchAgentService(): ResearchAgentService {
    if (!instance) {
        instance = new ResearchAgentService();
    }
    return instance;
}
