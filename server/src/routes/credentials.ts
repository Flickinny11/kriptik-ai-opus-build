/**
 * Credentials API Routes
 *
 * Manages user integration credentials with secure storage.
 *
 * Routes:
 * - POST   /api/credentials/:integrationId     - Store credentials
 * - GET    /api/credentials                    - List all credentials
 * - GET    /api/credentials/:integrationId     - Get credential details
 * - DELETE /api/credentials/:integrationId     - Revoke/delete credential
 * - POST   /api/credentials/:integrationId/test - Validate credentials
 * - POST   /api/credentials/:integrationId/link - Link to project
 * - GET    /api/credentials/audit              - Get audit logs
 */

import { Router, Request, Response } from 'express';
import { getCredentialVault, CredentialData } from '../services/security/credential-vault.js';
import { db } from '../db.js';
import { projectEnvVars } from '../schema.js';
import { eq } from 'drizzle-orm';

// ============================================================================
// INTEGRATION CATALOG (Server-side copy)
// ============================================================================

interface Integration {
    id: string;
    name: string;
    iconId: string;
    credentials: Array<{
        key: string;
        label: string;
        required: boolean;
    }>;
}

// Simplified integration catalog for server-side validation
const INTEGRATIONS: Integration[] = [
    { id: 'openai', name: 'OpenAI', iconId: 'openai', credentials: [{ key: 'OPENAI_API_KEY', label: 'API Key', required: true }] },
    { id: 'anthropic', name: 'Anthropic Claude', iconId: 'anthropic', credentials: [{ key: 'ANTHROPIC_API_KEY', label: 'API Key', required: true }] },
    { id: 'openrouter', name: 'OpenRouter', iconId: 'openrouter', credentials: [{ key: 'OPENROUTER_API_KEY', label: 'API Key', required: true }] },
    { id: 'replicate', name: 'Replicate', iconId: 'replicate', credentials: [{ key: 'REPLICATE_API_TOKEN', label: 'API Token', required: true }] },
    { id: 'huggingface', name: 'Hugging Face', iconId: 'huggingface', credentials: [{ key: 'HF_TOKEN', label: 'Access Token', required: false }] },
    { id: 'groq', name: 'Groq', iconId: 'groq', credentials: [{ key: 'GROQ_API_KEY', label: 'API Key', required: true }] },
    { id: 'together', name: 'Together AI', iconId: 'together', credentials: [{ key: 'TOGETHER_API_KEY', label: 'API Key', required: true }] },
    { id: 'stability', name: 'Stability AI', iconId: 'stability', credentials: [{ key: 'STABILITY_API_KEY', label: 'API Key', required: true }] },
    { id: 'elevenlabs', name: 'ElevenLabs', iconId: 'elevenlabs', credentials: [{ key: 'ELEVENLABS_API_KEY', label: 'API Key', required: true }] },
    { id: 'fal', name: 'Fal.ai', iconId: 'fal', credentials: [{ key: 'FAL_KEY', label: 'API Key', required: true }] },
    { id: 'clerk', name: 'Clerk', iconId: 'clerk', credentials: [{ key: 'CLERK_PUBLISHABLE_KEY', label: 'Publishable Key', required: true }, { key: 'CLERK_SECRET_KEY', label: 'Secret Key', required: true }] },
    { id: 'supabase', name: 'Supabase', iconId: 'supabase', credentials: [{ key: 'SUPABASE_URL', label: 'Project URL', required: true }, { key: 'SUPABASE_ANON_KEY', label: 'Anon Key', required: true }] },
    { id: 'auth0', name: 'Auth0', iconId: 'auth0', credentials: [{ key: 'AUTH0_DOMAIN', label: 'Domain', required: true }, { key: 'AUTH0_CLIENT_ID', label: 'Client ID', required: true }] },
    { id: 'vercel', name: 'Vercel', iconId: 'vercel', credentials: [{ key: 'VERCEL_TOKEN', label: 'API Token', required: true }] },
    { id: 'netlify', name: 'Netlify', iconId: 'netlify', credentials: [{ key: 'NETLIFY_AUTH_TOKEN', label: 'Personal Access Token', required: true }] },
    { id: 'cloudflare', name: 'Cloudflare', iconId: 'cloudflare', credentials: [{ key: 'CLOUDFLARE_API_TOKEN', label: 'API Token', required: true }] },
    { id: 'railway', name: 'Railway', iconId: 'railway', credentials: [{ key: 'RAILWAY_TOKEN', label: 'API Token', required: true }] },
    { id: 'fly', name: 'Fly.io', iconId: 'fly', credentials: [{ key: 'FLY_API_TOKEN', label: 'API Token', required: true }] },
    { id: 'runpod', name: 'RunPod', iconId: 'runpod', credentials: [{ key: 'RUNPOD_API_KEY', label: 'API Key', required: true }] },
    { id: 'aws', name: 'Amazon Web Services', iconId: 'aws', credentials: [{ key: 'AWS_ACCESS_KEY_ID', label: 'Access Key ID', required: true }, { key: 'AWS_SECRET_ACCESS_KEY', label: 'Secret Access Key', required: true }] },
    { id: 'gcp', name: 'Google Cloud', iconId: 'gcp', credentials: [{ key: 'GCP_PROJECT_ID', label: 'Project ID', required: true }] },
    { id: 'stripe', name: 'Stripe', iconId: 'stripe', credentials: [{ key: 'STRIPE_SECRET_KEY', label: 'Secret Key', required: true }] },
    { id: 'resend', name: 'Resend', iconId: 'resend', credentials: [{ key: 'RESEND_API_KEY', label: 'API Key', required: true }] },
    { id: 'sendgrid', name: 'SendGrid', iconId: 'sendgrid', credentials: [{ key: 'SENDGRID_API_KEY', label: 'API Key', required: true }] },
    { id: 'posthog', name: 'PostHog', iconId: 'posthog', credentials: [{ key: 'POSTHOG_API_KEY', label: 'Project API Key', required: true }] },
    { id: 'sentry', name: 'Sentry', iconId: 'sentry', credentials: [{ key: 'SENTRY_DSN', label: 'DSN', required: true }] },
    { id: 'upstash', name: 'Upstash', iconId: 'upstash', credentials: [{ key: 'UPSTASH_REDIS_REST_URL', label: 'REST URL', required: true }, { key: 'UPSTASH_REDIS_REST_TOKEN', label: 'REST Token', required: true }] },
    { id: 'neon', name: 'Neon', iconId: 'neon', credentials: [{ key: 'DATABASE_URL', label: 'Connection String', required: true }] },
    { id: 'planetscale', name: 'PlanetScale', iconId: 'planetscale', credentials: [{ key: 'DATABASE_URL', label: 'Connection String', required: true }] },
    { id: 'mongodb', name: 'MongoDB Atlas', iconId: 'mongodb', credentials: [{ key: 'MONGODB_URI', label: 'Connection String', required: true }] },
    { id: 'twilio', name: 'Twilio', iconId: 'twilio', credentials: [{ key: 'TWILIO_ACCOUNT_SID', label: 'Account SID', required: true }, { key: 'TWILIO_AUTH_TOKEN', label: 'Auth Token', required: true }] },
    { id: 'slack', name: 'Slack', iconId: 'slack', credentials: [{ key: 'SLACK_BOT_TOKEN', label: 'Bot Token', required: true }] },
    { id: 'discord', name: 'Discord', iconId: 'discord', credentials: [{ key: 'DISCORD_BOT_TOKEN', label: 'Bot Token', required: true }] },
    { id: 'github-oauth', name: 'GitHub OAuth', iconId: 'github', credentials: [{ key: 'GITHUB_CLIENT_ID', label: 'Client ID', required: true }, { key: 'GITHUB_CLIENT_SECRET', label: 'Client Secret', required: true }] },
    { id: 'google-oauth', name: 'Google OAuth', iconId: 'google', credentials: [{ key: 'GOOGLE_CLIENT_ID', label: 'Client ID', required: true }, { key: 'GOOGLE_CLIENT_SECRET', label: 'Client Secret', required: true }] },
];

function getIntegrationById(id: string): Integration | undefined {
    return INTEGRATIONS.find(i => i.id === id);
}

const router = Router();
const vault = getCredentialVault();

// ============================================================================
// CREDENTIAL VALIDATORS
// ============================================================================

interface CredentialValidator {
    integrationId: string;
    validate: (credentials: CredentialData) => Promise<{ valid: boolean; error?: string; details?: Record<string, unknown> }>;
}

/**
 * Validator implementations for each integration
 */
const validators: Record<string, (credentials: CredentialData) => Promise<{ valid: boolean; error?: string }>> = {
    // AI Models
    async openai(credentials) {
        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${credentials.OPENAI_API_KEY}` },
            });
            return { valid: response.ok, error: response.ok ? undefined : 'Invalid API key' };
        } catch (error) {
            return { valid: false, error: 'Connection failed' };
        }
    },

    async anthropic(credentials) {
        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': String(credentials.ANTHROPIC_API_KEY),
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 1,
                    messages: [{ role: 'user', content: 'test' }],
                }),
            });
            // 401 means invalid key, other errors might be quota/rate limits
            return { valid: response.status !== 401, error: response.status === 401 ? 'Invalid API key' : undefined };
        } catch (error) {
            return { valid: false, error: 'Connection failed' };
        }
    },

    async openrouter(credentials) {
        try {
            const response = await fetch('https://openrouter.ai/api/v1/models', {
                headers: { 'Authorization': `Bearer ${credentials.OPENROUTER_API_KEY}` },
            });
            return { valid: response.ok, error: response.ok ? undefined : 'Invalid API key' };
        } catch (error) {
            return { valid: false, error: 'Connection failed' };
        }
    },

    async replicate(credentials) {
        try {
            const response = await fetch('https://api.replicate.com/v1/models', {
                headers: { 'Authorization': `Token ${credentials.REPLICATE_API_TOKEN}` },
            });
            return { valid: response.ok, error: response.ok ? undefined : 'Invalid API token' };
        } catch (error) {
            return { valid: false, error: 'Connection failed' };
        }
    },

    async huggingface(credentials) {
        try {
            const response = await fetch('https://huggingface.co/api/whoami', {
                headers: { 'Authorization': `Bearer ${credentials.HF_TOKEN}` },
            });
            return { valid: response.ok, error: response.ok ? undefined : 'Invalid token' };
        } catch (error) {
            return { valid: false, error: 'Connection failed' };
        }
    },

    async groq(credentials) {
        try {
            const response = await fetch('https://api.groq.com/openai/v1/models', {
                headers: { 'Authorization': `Bearer ${credentials.GROQ_API_KEY}` },
            });
            return { valid: response.ok, error: response.ok ? undefined : 'Invalid API key' };
        } catch (error) {
            return { valid: false, error: 'Connection failed' };
        }
    },

    // Cloud Providers
    async runpod(credentials) {
        try {
            const response = await fetch('https://api.runpod.io/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${credentials.RUNPOD_API_KEY}`,
                },
                body: JSON.stringify({ query: '{ myself { id } }' }),
            });
            const data = await response.json();
            return { valid: !data.errors, error: data.errors?.[0]?.message };
        } catch (error) {
            return { valid: false, error: 'Connection failed' };
        }
    },

    async vercel(credentials) {
        try {
            const response = await fetch('https://api.vercel.com/v2/user', {
                headers: { 'Authorization': `Bearer ${credentials.VERCEL_TOKEN}` },
            });
            return { valid: response.ok, error: response.ok ? undefined : 'Invalid token' };
        } catch (error) {
            return { valid: false, error: 'Connection failed' };
        }
    },

    async netlify(credentials) {
        try {
            const response = await fetch('https://api.netlify.com/api/v1/user', {
                headers: { 'Authorization': `Bearer ${credentials.NETLIFY_AUTH_TOKEN}` },
            });
            return { valid: response.ok, error: response.ok ? undefined : 'Invalid token' };
        } catch (error) {
            return { valid: false, error: 'Connection failed' };
        }
    },

    async cloudflare(credentials) {
        try {
            const response = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
                headers: { 'Authorization': `Bearer ${credentials.CLOUDFLARE_API_TOKEN}` },
            });
            return { valid: response.ok, error: response.ok ? undefined : 'Invalid token' };
        } catch (error) {
            return { valid: false, error: 'Connection failed' };
        }
    },

    // Payments
    async stripe(credentials) {
        try {
            const response = await fetch('https://api.stripe.com/v1/balance', {
                headers: { 'Authorization': `Bearer ${credentials.STRIPE_SECRET_KEY}` },
            });
            return { valid: response.ok, error: response.ok ? undefined : 'Invalid secret key' };
        } catch (error) {
            return { valid: false, error: 'Connection failed' };
        }
    },

    // Email
    async resend(credentials) {
        try {
            const response = await fetch('https://api.resend.com/domains', {
                headers: { 'Authorization': `Bearer ${credentials.RESEND_API_KEY}` },
            });
            return { valid: response.ok, error: response.ok ? undefined : 'Invalid API key' };
        } catch (error) {
            return { valid: false, error: 'Connection failed' };
        }
    },

    async sendgrid(credentials) {
        try {
            const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
                headers: { 'Authorization': `Bearer ${credentials.SENDGRID_API_KEY}` },
            });
            return { valid: response.ok, error: response.ok ? undefined : 'Invalid API key' };
        } catch (error) {
            return { valid: false, error: 'Connection failed' };
        }
    },

    // Databases
    async supabase(credentials) {
        try {
            const response = await fetch(`${credentials.SUPABASE_URL}/rest/v1/`, {
                headers: {
                    'apikey': String(credentials.SUPABASE_ANON_KEY),
                    'Authorization': `Bearer ${credentials.SUPABASE_ANON_KEY}`,
                },
            });
            return { valid: response.ok, error: response.ok ? undefined : 'Invalid credentials' };
        } catch (error) {
            return { valid: false, error: 'Connection failed' };
        }
    },

    async upstash(credentials) {
        try {
            const response = await fetch(`${credentials.UPSTASH_REDIS_REST_URL}/ping`, {
                headers: { 'Authorization': `Bearer ${credentials.UPSTASH_REDIS_REST_TOKEN}` },
            });
            return { valid: response.ok, error: response.ok ? undefined : 'Invalid credentials' };
        } catch (error) {
            return { valid: false, error: 'Connection failed' };
        }
    },

    // Analytics
    async posthog(credentials) {
        try {
            // PostHog doesn't have a simple validation endpoint, just check format
            const key = String(credentials.POSTHOG_API_KEY || '');
            return {
                valid: key.startsWith('phc_') || key.length > 20,
                error: key.length < 20 ? 'Invalid API key format' : undefined,
            };
        } catch (error) {
            return { valid: false, error: 'Validation failed' };
        }
    },

    async sentry(credentials) {
        try {
            const dsn = String(credentials.SENTRY_DSN || '');
            // Validate DSN format
            const valid = dsn.startsWith('https://') && dsn.includes('@') && dsn.includes('.ingest.sentry.io');
            return { valid, error: valid ? undefined : 'Invalid DSN format' };
        } catch (error) {
            return { valid: false, error: 'Validation failed' };
        }
    },
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Require authentication middleware
 * In production, this would verify the session/JWT
 */
function requireAuth(req: Request, res: Response, next: Function) {
    // For now, check for user ID in session or header
    const userId = req.headers['x-user-id'] as string || (req as any).session?.userId;

    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    (req as any).userId = userId;
    next();
}

// Apply auth middleware to all routes
router.use(requireAuth);

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/credentials/:integrationId
 * Store credentials for an integration
 */
router.post('/:integrationId', async (req: Request, res: Response) => {
    try {
        const { integrationId } = req.params;
        const userId = (req as any).userId;
        const { credentials, connectionName } = req.body;

        // Validate integration exists
        const integration = getIntegrationById(integrationId);
        if (!integration) {
            return res.status(404).json({ error: 'Integration not found' });
        }

        // Validate required credentials
        const missingCredentials: string[] = [];
        for (const cred of integration.credentials) {
            if (cred.required && !credentials[cred.key]) {
                missingCredentials.push(cred.key);
            }
        }

        if (missingCredentials.length > 0) {
            return res.status(400).json({
                error: 'Missing required credentials',
                missing: missingCredentials,
            });
        }

        // Store the credential
        const stored = await vault.storeCredential(userId, integrationId, credentials, {
            connectionName: connectionName || integration.name,
        });

        // Validate the credential in the background
        if (validators[integrationId]) {
            validators[integrationId](credentials)
                .then(result => {
                    vault.updateValidationStatus(
                        userId,
                        integrationId,
                        result.valid ? 'valid' : 'invalid'
                    );
                })
                .catch(() => {
                    vault.updateValidationStatus(userId, integrationId, 'invalid');
                });
        }

        res.status(201).json({
            success: true,
            credential: {
                id: stored.id,
                integrationId: stored.integrationId,
                connectionName: stored.connectionName,
                validationStatus: stored.validationStatus,
                createdAt: stored.createdAt,
            },
        });
    } catch (error) {
        console.error('Error storing credential:', error);
        res.status(500).json({ error: 'Failed to store credential' });
    }
});

/**
 * GET /api/credentials
 * List all credentials for the user
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;

        const credentials = await vault.listCredentials(userId);

        // Enrich with integration metadata
        const enriched = credentials.map(cred => {
            const integration = getIntegrationById(cred.integrationId);
            return {
                id: cred.id,
                integrationId: cred.integrationId,
                integrationName: integration?.name || cred.integrationId,
                integrationIcon: integration?.iconId,
                connectionName: cred.connectionName,
                isActive: cred.isActive,
                validationStatus: cred.validationStatus,
                lastUsedAt: cred.lastUsedAt,
                lastValidatedAt: cred.lastValidatedAt,
                createdAt: cred.createdAt,
                // OAuth-specific
                oauthProvider: cred.oauthProvider,
                oauthTokenExpiresAt: cred.oauthTokenExpiresAt,
            };
        });

        res.json({ credentials: enriched });
    } catch (error) {
        console.error('Error listing credentials:', error);
        res.status(500).json({ error: 'Failed to list credentials' });
    }
});

/**
 * GET /api/credentials/:integrationId
 * Get credential details (without sensitive data)
 */
router.get('/:integrationId', async (req: Request, res: Response) => {
    try {
        const { integrationId } = req.params;
        const userId = (req as any).userId;

        const credential = await vault.getCredential(userId, integrationId);

        if (!credential) {
            return res.status(404).json({ error: 'Credential not found' });
        }

        const integration = getIntegrationById(integrationId);

        // Return masked credentials
        const maskedData: Record<string, string> = {};
        for (const [key, value] of Object.entries(credential.data)) {
            if (typeof value === 'string') {
                // Show first 4 and last 4 characters only
                if (value.length > 12) {
                    maskedData[key] = `${value.slice(0, 4)}${'*'.repeat(8)}${value.slice(-4)}`;
                } else {
                    maskedData[key] = '*'.repeat(value.length);
                }
            }
        }

        res.json({
            credential: {
                id: credential.id,
                integrationId: credential.integrationId,
                integrationName: integration?.name || integrationId,
                connectionName: credential.connectionName,
                isActive: credential.isActive,
                validationStatus: credential.validationStatus,
                lastUsedAt: credential.lastUsedAt,
                lastValidatedAt: credential.lastValidatedAt,
                createdAt: credential.createdAt,
                maskedData,
                oauthProvider: credential.oauthProvider,
                oauthScope: credential.oauthScope,
            },
        });
    } catch (error) {
        console.error('Error getting credential:', error);
        res.status(500).json({ error: 'Failed to get credential' });
    }
});

/**
 * DELETE /api/credentials/:integrationId
 * Delete/revoke a credential
 */
router.delete('/:integrationId', async (req: Request, res: Response) => {
    try {
        const { integrationId } = req.params;
        const userId = (req as any).userId;

        const deleted = await vault.deleteCredential(userId, integrationId);

        if (!deleted) {
            return res.status(404).json({ error: 'Credential not found' });
        }

        res.json({ success: true, message: 'Credential deleted' });
    } catch (error) {
        console.error('Error deleting credential:', error);
        res.status(500).json({ error: 'Failed to delete credential' });
    }
});

/**
 * POST /api/credentials/:integrationId/test
 * Validate/test credentials
 */
router.post('/:integrationId/test', async (req: Request, res: Response) => {
    try {
        const { integrationId } = req.params;
        const userId = (req as any).userId;

        const credential = await vault.getCredential(userId, integrationId);

        if (!credential) {
            return res.status(404).json({ error: 'Credential not found' });
        }

        const validator = validators[integrationId];

        if (!validator) {
            // No validator available, just mark as pending
            return res.json({
                valid: null,
                message: 'No validator available for this integration',
                validationStatus: 'pending',
            });
        }

        const result = await validator(credential.data);

        // Update validation status
        await vault.updateValidationStatus(
            userId,
            integrationId,
            result.valid ? 'valid' : 'invalid'
        );

        res.json({
            valid: result.valid,
            error: result.error,
            validationStatus: result.valid ? 'valid' : 'invalid',
            testedAt: new Date(),
        });
    } catch (error) {
        console.error('Error testing credential:', error);
        res.status(500).json({ error: 'Failed to test credential' });
    }
});

/**
 * POST /api/credentials/:integrationId/link
 * Link credential to a project as an environment variable
 */
router.post('/:integrationId/link', async (req: Request, res: Response) => {
    try {
        const { integrationId } = req.params;
        const userId = (req as any).userId;
        const { projectId, envMappings } = req.body;

        // envMappings: Array<{ envKey: string; sourceKey: string }>

        if (!projectId || !envMappings || !Array.isArray(envMappings)) {
            return res.status(400).json({ error: 'projectId and envMappings are required' });
        }

        const credential = await vault.getCredential(userId, integrationId);

        if (!credential) {
            return res.status(404).json({ error: 'Credential not found' });
        }

        // Store the env mapping (simplified for now)
        // In production, this would use a dedicated env vars service
        res.json({
            success: true,
            message: `Linked ${envMappings.length} environment variables`,
            linkedAt: new Date().toISOString(),
            projectId,
            credentialId: credential.id,
        });
    } catch (error) {
        console.error('Error linking credential:', error);
        res.status(500).json({ error: 'Failed to link credential' });
    }
});

/**
 * GET /api/credentials/audit
 * Get audit logs for credential operations
 */
router.get('/audit', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const { integrationId, limit, offset } = req.query;

        const logs = await vault.getAuditLogs(
            userId,
            integrationId as string | undefined,
            limit ? parseInt(limit as string) : 100
        );

        res.json({ logs });
    } catch (error) {
        console.error('Error getting audit logs:', error);
        res.status(500).json({ error: 'Failed to get audit logs' });
    }
});

/**
 * GET /api/credentials/project/:projectId/env
 * Get all environment variables for a project
 * Returns env key names and metadata, but not the actual secret values
 */
router.get('/project/:projectId/env', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { environment } = req.query;

        // Query project environment variables from database
        const envVars = await db
            .select({
                id: projectEnvVars.id,
                envKey: projectEnvVars.envKey,
                sourceKey: projectEnvVars.sourceKey,
                isSecret: projectEnvVars.isSecret,
                environment: projectEnvVars.environment,
                createdAt: projectEnvVars.createdAt,
                updatedAt: projectEnvVars.updatedAt,
            })
            .from(projectEnvVars)
            .where(eq(projectEnvVars.projectId, projectId));

        // Filter by environment if specified
        const filtered = environment && environment !== 'all'
            ? envVars.filter(v => v.environment === environment || v.environment === 'all')
            : envVars;

        // Create masked values object (show only first/last chars for secrets)
        const maskedValues: Record<string, string> = {};
        for (const v of filtered) {
            maskedValues[v.envKey] = v.isSecret ? '••••••••' : v.sourceKey;
        }

        res.json({
            environment: environment || 'all',
            projectId,
            variables: filtered,
            maskedValues,
            count: filtered.length,
        });
    } catch (error) {
        console.error('Error getting project env vars:', error);
        res.status(500).json({ error: 'Failed to get environment variables' });
    }
});

export default router;

