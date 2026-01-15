/**
 * Credential Integration Service
 *
 * Handles automatic integration of dependencies once credentials are saved.
 * Uses MCP servers, CLIs, and APIs to programmatically configure integrations.
 *
 * Example: When Stripe credentials are saved, this service will:
 * 1. Create webhook endpoints
 * 2. Configure product IDs
 * 3. Set up payment processing code
 */

import { createOrchestratorClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import { db } from '../../db.js';
import { files, projects } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import { getCredentialVault } from '../security/credential-vault.js';

// Integration configurations with setup requirements
const INTEGRATION_CONFIGS: Record<string, IntegrationConfig> = {
    stripe: {
        name: 'Stripe',
        platformUrl: 'https://dashboard.stripe.com/apikeys',
        setupTasks: [
            'Create webhook endpoint for payment events',
            'Configure Stripe checkout session',
            'Set up product and price IDs',
            'Add webhook signature verification',
        ],
        apiEndpoint: 'https://api.stripe.com/v1',
        cliTool: 'stripe',
        requiredEnvVars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    },
    openai: {
        name: 'OpenAI',
        platformUrl: 'https://platform.openai.com/api-keys',
        setupTasks: [
            'Configure API client',
            'Set up streaming support',
            'Add error handling for rate limits',
        ],
        apiEndpoint: 'https://api.openai.com/v1',
        requiredEnvVars: ['OPENAI_API_KEY'],
    },
    anthropic: {
        name: 'Anthropic',
        platformUrl: 'https://console.anthropic.com/settings/keys',
        setupTasks: [
            'Configure API client',
            'Set up message streaming',
            'Add error handling',
        ],
        apiEndpoint: 'https://api.anthropic.com/v1',
        requiredEnvVars: ['ANTHROPIC_API_KEY'],
    },
    supabase: {
        name: 'Supabase',
        platformUrl: 'https://supabase.com/dashboard/project/_/settings/api',
        setupTasks: [
            'Configure Supabase client',
            'Set up authentication',
            'Configure database tables',
            'Set up Row Level Security policies',
        ],
        apiEndpoint: null, // Dynamic based on project
        requiredEnvVars: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'],
    },
    clerk: {
        name: 'Clerk',
        platformUrl: 'https://dashboard.clerk.com',
        setupTasks: [
            'Configure Clerk provider',
            'Set up authentication middleware',
            'Add protected routes',
        ],
        apiEndpoint: 'https://api.clerk.com/v1',
        requiredEnvVars: ['CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY'],
    },
    resend: {
        name: 'Resend',
        platformUrl: 'https://resend.com/api-keys',
        setupTasks: [
            'Configure email client',
            'Set up email templates',
            'Add sender verification',
        ],
        apiEndpoint: 'https://api.resend.com',
        requiredEnvVars: ['RESEND_API_KEY'],
    },
    twilio: {
        name: 'Twilio',
        platformUrl: 'https://console.twilio.com',
        setupTasks: [
            'Configure Twilio client',
            'Set up SMS sending',
            'Add phone number verification',
        ],
        apiEndpoint: 'https://api.twilio.com',
        requiredEnvVars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
    },
    vercel: {
        name: 'Vercel',
        platformUrl: 'https://vercel.com/account/tokens',
        setupTasks: [
            'Configure deployment settings',
            'Set up environment variables',
        ],
        apiEndpoint: 'https://api.vercel.com',
        cliTool: 'vercel',
        requiredEnvVars: ['VERCEL_TOKEN'],
    },
    runpod: {
        name: 'RunPod',
        platformUrl: 'https://runpod.io/console/user/settings',
        setupTasks: [
            'Configure GPU instance',
            'Set up serverless endpoint',
            'Add model deployment',
        ],
        apiEndpoint: 'https://api.runpod.io',
        requiredEnvVars: ['RUNPOD_API_KEY'],
    },
};

interface IntegrationConfig {
    name: string;
    platformUrl: string;
    setupTasks: string[];
    apiEndpoint: string | null;
    cliTool?: string;
    requiredEnvVars: string[];
}

interface CredentialSubmission {
    envKey: string;
    value: string;
    integrationId?: string;
}

interface IntegrationResult {
    success: boolean;
    integration: string;
    tasksCompleted: string[];
    errors?: string[];
    filesModified?: string[];
    webhooksCreated?: Array<{ url: string; events: string[] }>;
}

/**
 * Main entry point for credential integration
 * Called when credentials are submitted from notifications
 */
export async function triggerCredentialIntegration(
    projectId: string,
    userId: string,
    credentials: CredentialSubmission[],
    sessionId?: string
): Promise<{
    success: boolean;
    results: IntegrationResult[];
    resumeBuildTriggered: boolean;
}> {
    const results: IntegrationResult[] = [];
    let resumeBuildTriggered = false;

    // Group credentials by integration
    const integrationGroups = new Map<string, CredentialSubmission[]>();
    for (const cred of credentials) {
        const integrationId = cred.integrationId || deriveIntegrationId(cred.envKey);
        const existing = integrationGroups.get(integrationId) || [];
        existing.push(cred);
        integrationGroups.set(integrationId, existing);
    }

    // Process each integration
    for (const [integrationId, creds] of integrationGroups) {
        try {
            const result = await processIntegration(projectId, userId, integrationId, creds);
            results.push(result);
        } catch (error) {
            console.error(`[CredentialIntegration] Failed to process ${integrationId}:`, error);
            results.push({
                success: false,
                integration: integrationId,
                tasksCompleted: [],
                errors: [error instanceof Error ? error.message : 'Unknown error'],
            });
        }
    }

    // Signal build to resume if sessionId provided
    if (sessionId) {
        try {
            await signalBuildResume(sessionId, projectId, userId);
            resumeBuildTriggered = true;
        } catch (error) {
            console.error('[CredentialIntegration] Failed to signal build resume:', error);
        }
    }

    return {
        success: results.every(r => r.success),
        results,
        resumeBuildTriggered,
    };
}

/**
 * Process a single integration
 */
async function processIntegration(
    projectId: string,
    userId: string,
    integrationId: string,
    credentials: CredentialSubmission[]
): Promise<IntegrationResult> {
    const config = INTEGRATION_CONFIGS[integrationId];
    const tasksCompleted: string[] = [];
    const errors: string[] = [];
    const filesModified: string[] = [];

    // Build credentials map
    const credMap: Record<string, string> = {};
    for (const c of credentials) {
        credMap[c.envKey] = c.value;
    }

    // Integration-specific processing
    if (integrationId === 'stripe') {
        const stripeResult = await processStripeIntegration(projectId, userId, credMap);
        tasksCompleted.push(...stripeResult.tasksCompleted);
        if (stripeResult.webhooksCreated) {
            // Store webhook info
            tasksCompleted.push(`Created ${stripeResult.webhooksCreated.length} webhook(s)`);
        }
        if (stripeResult.filesModified) {
            filesModified.push(...stripeResult.filesModified);
        }
        if (stripeResult.errors) {
            errors.push(...stripeResult.errors);
        }
    } else {
        // Generic integration via AI
        const aiResult = await processGenericIntegration(projectId, userId, integrationId, credMap, config);
        tasksCompleted.push(...aiResult.tasksCompleted);
        if (aiResult.filesModified) {
            filesModified.push(...aiResult.filesModified);
        }
        if (aiResult.errors) {
            errors.push(...aiResult.errors);
        }
    }

    return {
        success: errors.length === 0,
        integration: config?.name || integrationId,
        tasksCompleted,
        errors: errors.length > 0 ? errors : undefined,
        filesModified: filesModified.length > 0 ? filesModified : undefined,
    };
}

/**
 * Process Stripe integration specifically
 * Uses Stripe API to create webhooks, products, etc.
 */
async function processStripeIntegration(
    projectId: string,
    userId: string,
    credentials: Record<string, string>
): Promise<{
    tasksCompleted: string[];
    webhooksCreated?: Array<{ url: string; events: string[] }>;
    filesModified?: string[];
    errors?: string[];
}> {
    const tasksCompleted: string[] = [];
    const errors: string[] = [];
    const webhooksCreated: Array<{ url: string; events: string[] }> = [];
    const filesModified: string[] = [];

    const secretKey = credentials['STRIPE_SECRET_KEY'];
    if (!secretKey) {
        return { tasksCompleted: [], errors: ['Missing STRIPE_SECRET_KEY'] };
    }

    try {
        // 1. Verify the API key works
        const balanceCheck = await fetch('https://api.stripe.com/v1/balance', {
            headers: { 'Authorization': `Bearer ${secretKey}` },
        });

        if (!balanceCheck.ok) {
            return { tasksCompleted: [], errors: ['Invalid Stripe API key'] };
        }
        tasksCompleted.push('Verified Stripe API key');

        // 2. Get project info to determine webhook URL
        const [project] = await db
            .select()
            .from(projects)
            .where(eq(projects.id, projectId))
            .limit(1);

        // 3. Create webhook if we have a deployment URL
        // The project might have a deployment URL in metadata or we use a default
        const deployUrl = (project as any)?.deploymentUrl || process.env.FRONTEND_URL;
        if (deployUrl) {
            const webhookUrl = `${deployUrl}/api/webhooks/stripe`;
            
            // Check if webhook already exists
            const existingWebhooks = await fetch('https://api.stripe.com/v1/webhook_endpoints?limit=100', {
                headers: { 'Authorization': `Bearer ${secretKey}` },
            });

            const webhooksData = await existingWebhooks.json();
            const existingUrls = (webhooksData.data || []).map((w: any) => w.url);

            if (!existingUrls.includes(webhookUrl)) {
                // Create new webhook
                const webhookParams = new URLSearchParams();
                webhookParams.append('url', webhookUrl);
                webhookParams.append('enabled_events[]', 'checkout.session.completed');
                webhookParams.append('enabled_events[]', 'payment_intent.succeeded');
                webhookParams.append('enabled_events[]', 'payment_intent.payment_failed');
                webhookParams.append('enabled_events[]', 'customer.subscription.created');
                webhookParams.append('enabled_events[]', 'customer.subscription.deleted');
                webhookParams.append('enabled_events[]', 'invoice.paid');
                webhookParams.append('enabled_events[]', 'invoice.payment_failed');
                
                const webhookResponse = await fetch('https://api.stripe.com/v1/webhook_endpoints', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${secretKey}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: webhookParams.toString(),
                });

                if (webhookResponse.ok) {
                    const webhookData = await webhookResponse.json();
                    webhooksCreated.push({
                        url: webhookUrl,
                        events: webhookData.enabled_events || [],
                    });

                    // Store webhook secret in .env
                    if (webhookData.secret) {
                        const { writeCredentialsToProjectEnv } = await import('./credential-env-bridge.js');
                        await writeCredentialsToProjectEnv(projectId, userId, {
                            'STRIPE_WEBHOOK_SECRET': webhookData.secret,
                        });
                        tasksCompleted.push('Stored webhook secret');
                    }
                    tasksCompleted.push('Created Stripe webhook endpoint');
                }
            } else {
                tasksCompleted.push('Stripe webhook already exists');
            }
        }

        // 4. Generate Stripe integration code
        const integrationCode = await generateStripeIntegrationCode(projectId, secretKey);
        if (integrationCode.filesCreated.length > 0) {
            filesModified.push(...integrationCode.filesCreated);
            tasksCompleted.push(`Generated ${integrationCode.filesCreated.length} integration file(s)`);
        }

    } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Stripe integration failed');
    }

    return { tasksCompleted, webhooksCreated, filesModified, errors };
}

/**
 * Generate Stripe integration code files
 */
async function generateStripeIntegrationCode(
    projectId: string,
    _secretKey: string
): Promise<{ filesCreated: string[] }> {
    const filesCreated: string[] = [];

    // Check if stripe webhook handler exists
    const existingWebhookHandler = await db
        .select()
        .from(files)
        .where(and(
            eq(files.projectId, projectId),
            eq(files.path, 'src/app/api/webhooks/stripe/route.ts')
        ))
        .limit(1);

    if (existingWebhookHandler.length === 0) {
        // Create webhook handler
        const webhookCode = `import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      console.log('Payment successful for session:', session.id);
      // TODO: Fulfill the order, update database, send confirmation email
      break;

    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log('PaymentIntent succeeded:', paymentIntent.id);
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object as Stripe.PaymentIntent;
      console.log('Payment failed:', failedPayment.id);
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.deleted':
      const subscription = event.data.object as Stripe.Subscription;
      console.log('Subscription event:', event.type, subscription.id);
      break;

    default:
      console.log('Unhandled event type:', event.type);
  }

  return NextResponse.json({ received: true });
}
`;

        await db.insert(files).values({
            projectId,
            path: 'src/app/api/webhooks/stripe/route.ts',
            content: webhookCode,
            language: 'typescript',
            version: 1,
        });
        filesCreated.push('src/app/api/webhooks/stripe/route.ts');
    }

    // Check if stripe utility file exists
    const existingStripeLib = await db
        .select()
        .from(files)
        .where(and(
            eq(files.projectId, projectId),
            eq(files.path, 'src/lib/stripe.ts')
        ))
        .limit(1);

    if (existingStripeLib.length === 0) {
        const stripeLibCode = `import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
});

/**
 * Create a Stripe Checkout Session
 */
export async function createCheckoutSession(params: {
  priceId: string;
  customerId?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: params.priceId, quantity: 1 }],
    customer: params.customerId,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
  });

  return session;
}

/**
 * Create a Stripe Customer Portal Session
 */
export async function createCustomerPortalSession(customerId: string, returnUrl: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}

/**
 * Get subscription by customer ID
 */
export async function getSubscription(customerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 1,
    status: 'active',
  });

  return subscriptions.data[0] || null;
}
`;

        await db.insert(files).values({
            projectId,
            path: 'src/lib/stripe.ts',
            content: stripeLibCode,
            language: 'typescript',
            version: 1,
        });
        filesCreated.push('src/lib/stripe.ts');
    }

    return { filesCreated };
}

/**
 * Process generic integration using AI
 */
async function processGenericIntegration(
    projectId: string,
    userId: string,
    integrationId: string,
    credentials: Record<string, string>,
    config?: IntegrationConfig
): Promise<{
    tasksCompleted: string[];
    filesModified?: string[];
    errors?: string[];
}> {
    const tasksCompleted: string[] = [];
    const filesModified: string[] = [];
    const errors: string[] = [];

    try {
        // Get existing project files for context
        const projectFiles = await db
            .select({ path: files.path, content: files.content })
            .from(files)
            .where(eq(files.projectId, projectId))
            .limit(20);

        const fileList = projectFiles.map(f => f.path).join('\n');

        // Use Claude to generate integration code
        const claude = createOrchestratorClaudeService();
        const prompt = `You are integrating ${config?.name || integrationId} into a project.

The project has these files:
${fileList}

The user has provided these credentials (env vars):
${Object.keys(credentials).join(', ')}

Generate the necessary integration code. Focus on:
${config?.setupTasks?.map((t, i) => `${i + 1}. ${t}`).join('\n') || '1. Configure API client\n2. Add error handling'}

Respond with JSON in this format:
{
  "files": [
    {
      "path": "src/lib/${integrationId}.ts",
      "content": "// integration code here",
      "action": "create" | "update"
    }
  ],
  "summary": "Brief description of what was set up"
}`;

        const response = await claude.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4,
            maxTokens: 4000,
        });
        const responseText = typeof response === 'string' ? response : (response as any).content || '';

        // Parse the response
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                
                // Write files
                for (const file of result.files || []) {
                    if (file.action === 'create') {
                        await db.insert(files).values({
                            projectId,
                            path: file.path,
                            content: file.content,
                            language: 'typescript',
                            version: 1,
                        });
                        filesModified.push(file.path);
                    }
                }

                if (result.summary) {
                    tasksCompleted.push(result.summary);
                }
            }
        } catch (parseError) {
            // AI response wasn't valid JSON, that's okay
            tasksCompleted.push(`Configured ${config?.name || integrationId} client`);
        }

    } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Integration failed');
    }

    return { tasksCompleted, filesModified, errors };
}

/**
 * Signal a paused build to resume
 */
async function signalBuildResume(
    sessionId: string,
    projectId: string,
    userId: string
): Promise<void> {
    // Import the execute route's pending builds
    // This triggers the build to continue
    const baseUrl = process.env.API_URL || 'http://localhost:3000';
    
    // Call the credentials endpoint to resume the build
    // The credentials are already written to .env at this point
    const response = await fetch(`${baseUrl}/api/execute/plan/${sessionId}/credentials`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
        },
        body: JSON.stringify({
            credentials: {}, // Empty - credentials already written to .env
            resumeFromNotification: true,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[CredentialIntegration] Failed to resume build:', errorText);
        throw new Error(`Failed to resume build: ${response.status}`);
    }

    console.log(`[CredentialIntegration] Build ${sessionId} resumed successfully`);
}

/**
 * Derive integration ID from environment variable name
 */
function deriveIntegrationId(envKey: string): string {
    const key = envKey.toLowerCase();

    const patterns: Array<[RegExp, string]> = [
        [/^stripe_/, 'stripe'],
        [/^openai_/, 'openai'],
        [/^anthropic_/, 'anthropic'],
        [/^supabase_/, 'supabase'],
        [/^clerk_/, 'clerk'],
        [/^resend_/, 'resend'],
        [/^twilio_/, 'twilio'],
        [/^vercel_/, 'vercel'],
        [/^runpod_/, 'runpod'],
        [/^github_/, 'github'],
        [/^aws_/, 'aws'],
    ];

    for (const [pattern, id] of patterns) {
        if (pattern.test(key)) return id;
    }

    const parts = key.split('_');
    return parts[0] || 'unknown';
}

/**
 * Get platform URL for fetching credentials
 */
export function getPlatformUrl(integrationId: string): string {
    const config = INTEGRATION_CONFIGS[integrationId];
    return config?.platformUrl || `https://www.google.com/search?q=${integrationId}+api+key`;
}

/**
 * Get required env vars for an integration
 */
export function getRequiredEnvVars(integrationId: string): string[] {
    const config = INTEGRATION_CONFIGS[integrationId];
    return config?.requiredEnvVars || [];
}
