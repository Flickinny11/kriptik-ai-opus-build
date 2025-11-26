/**
 * Configuration API Routes
 *
 * Endpoints for checking service configuration and health.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// ============================================================================
// SERVICE STATUS
// ============================================================================

interface ServiceConfig {
    name: string;
    enabled: boolean;
    status: 'ok' | 'missing' | 'error';
    message?: string;
}

function checkServices(): ServiceConfig[] {
    const services: ServiceConfig[] = [];

    // AI Services (Critical)
    services.push({
        name: 'OpenRouter (AI)',
        enabled: !!process.env.OPENROUTER_API_KEY,
        status: process.env.OPENROUTER_API_KEY ? 'ok' : 'missing',
        message: process.env.OPENROUTER_API_KEY
            ? 'Multi-model AI routing enabled'
            : 'CRITICAL: AI features disabled',
    });

    // Database
    services.push({
        name: 'Database',
        enabled: !!process.env.DATABASE_URL,
        status: process.env.DATABASE_URL ? 'ok' : 'missing',
        message: process.env.DATABASE_URL
            ? 'PostgreSQL connected'
            : 'Data will not persist',
    });

    // Authentication
    services.push({
        name: 'Authentication',
        enabled: !!process.env.BETTER_AUTH_SECRET,
        status: process.env.BETTER_AUTH_SECRET ? 'ok' : 'missing',
        message: process.env.BETTER_AUTH_SECRET
            ? 'Secure sessions enabled'
            : 'Authentication not configured',
    });

    // Billing
    services.push({
        name: 'Stripe Billing',
        enabled: !!process.env.STRIPE_SECRET_KEY,
        status: process.env.STRIPE_SECRET_KEY ? 'ok' : 'missing',
        message: process.env.STRIPE_SECRET_KEY
            ? 'Payments enabled'
            : 'Billing disabled',
    });

    // Cloud Providers
    const cloudProviders = [
        { key: 'RUNPOD_API_KEY', name: 'RunPod', type: 'GPU' },
        { key: 'VERCEL_TOKEN', name: 'Vercel', type: 'Static' },
        { key: 'NETLIFY_TOKEN', name: 'Netlify', type: 'Static' },
    ];

    for (const provider of cloudProviders) {
        services.push({
            name: provider.name,
            enabled: !!process.env[provider.key],
            status: process.env[provider.key] ? 'ok' : 'missing',
            message: process.env[provider.key]
                ? `${provider.type} deployments enabled`
                : undefined,
        });
    }

    // AI/ML Services
    services.push({
        name: 'HuggingFace',
        enabled: !!process.env.HUGGINGFACE_TOKEN,
        status: process.env.HUGGINGFACE_TOKEN ? 'ok' : 'missing',
        message: process.env.HUGGINGFACE_TOKEN
            ? 'Model discovery enabled'
            : undefined,
    });

    // Security
    services.push({
        name: 'Credential Vault',
        enabled: !!process.env.VAULT_ENCRYPTION_KEY,
        status: process.env.VAULT_ENCRYPTION_KEY ? 'ok' : 'missing',
        message: process.env.VAULT_ENCRYPTION_KEY
            ? 'Encrypted storage ready'
            : 'Credentials not encrypted',
    });

    return services;
}

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

/**
 * GET /api/config/status
 * Get overall system status
 */
router.get('/status', (req: Request, res: Response) => {
    const services = checkServices();
    const critical = services.filter(s =>
        s.name.includes('AI') || s.name.includes('Database')
    );
    const hasCriticalIssue = critical.some(s => s.status === 'missing');

    res.json({
        status: hasCriticalIssue ? 'degraded' : 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services: services.map(s => ({
            name: s.name,
            enabled: s.enabled,
            status: s.status,
        })),
    });
});

/**
 * GET /api/config/features
 * Get available features based on configuration
 */
router.get('/features', (req: Request, res: Response) => {
    res.json({
        ai: {
            enabled: !!process.env.OPENROUTER_API_KEY,
            models: ['claude-sonnet-4', 'gpt-4o', 'claude-haiku', 'gpt-4o-mini'],
            features: {
                codeGeneration: !!process.env.OPENROUTER_API_KEY,
                imageToCode: !!process.env.OPENROUTER_API_KEY,
                selfHealing: !!process.env.OPENROUTER_API_KEY,
                testGeneration: !!process.env.OPENROUTER_API_KEY,
            },
        },
        deployment: {
            runpod: !!process.env.RUNPOD_API_KEY,
            vercel: !!process.env.VERCEL_TOKEN,
            netlify: !!process.env.NETLIFY_TOKEN,
            aws: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
        },
        integrations: {
            github: !!process.env.GITHUB_TOKEN,
            huggingface: !!process.env.HUGGINGFACE_TOKEN,
            replicate: !!process.env.REPLICATE_API_TOKEN,
        },
        billing: {
            enabled: !!process.env.STRIPE_SECRET_KEY,
            plans: ['free', 'pro', 'enterprise'],
        },
        templates: {
            enabled: true,
            count: 6,  // Built-in templates
        },
    });
});

// ============================================================================
// PROTECTED ROUTES
// ============================================================================

/**
 * GET /api/config/details
 * Get detailed configuration (admin only)
 */
router.get('/details', authMiddleware, (req: Request, res: Response) => {
    const services = checkServices();

    res.json({
        services,
        environment: {
            nodeEnv: process.env.NODE_ENV || 'development',
            port: process.env.PORT || 3001,
            frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
        },
        database: {
            connected: !!process.env.DATABASE_URL,
            // Don't expose actual connection string
            type: 'postgresql',
        },
        security: {
            authConfigured: !!process.env.BETTER_AUTH_SECRET,
            vaultConfigured: !!process.env.VAULT_ENCRYPTION_KEY,
            httpsEnforced: process.env.NODE_ENV === 'production',
        },
    });
});

/**
 * POST /api/config/validate
 * Validate a specific credential
 */
router.post('/validate', authMiddleware, async (req: Request, res: Response) => {
    const { service, credential } = req.body;

    if (!service || !credential) {
        res.status(400).json({
            error: 'Missing service or credential'
        });
        return;
    }

    try {
        let valid = false;
        let message = '';

        switch (service) {
            case 'openrouter':
                // Validate by making a simple API call
                const orResponse = await fetch('https://openrouter.ai/api/v1/models', {
                    headers: { 'Authorization': `Bearer ${credential}` },
                });
                valid = orResponse.ok;
                message = valid ? 'API key is valid' : 'Invalid API key';
                break;

            case 'stripe':
                // Validate by fetching account info
                const stripeResponse = await fetch('https://api.stripe.com/v1/account', {
                    headers: { 'Authorization': `Bearer ${credential}` },
                });
                valid = stripeResponse.ok;
                message = valid ? 'Stripe key is valid' : 'Invalid Stripe key';
                break;

            case 'huggingface':
                // Validate by fetching user info
                const hfResponse = await fetch('https://huggingface.co/api/whoami-v2', {
                    headers: { 'Authorization': `Bearer ${credential}` },
                });
                valid = hfResponse.ok;
                message = valid ? 'HuggingFace token is valid' : 'Invalid token';
                break;

            default:
                res.status(400).json({ error: `Unknown service: ${service}` });
                return;
        }

        res.json({ valid, message });
    } catch (error) {
        res.status(500).json({
            error: 'Validation failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;

