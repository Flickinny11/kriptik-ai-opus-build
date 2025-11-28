import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getModelRouter } from './services/ai/model-router.js';

dotenv.config();

// Pre-warm model router for faster first request (2-3s improvement)
const warmupRouter = () => {
    try {
        getModelRouter(); // Initialize singleton
        console.log('✓ Model router pre-warmed');
    } catch (error) {
        console.error('Failed to pre-warm model router:', error);
    }
};

const app = express();
const port = process.env.PORT || 3001;

// =============================================================================
// CREDENTIAL VALIDATION
// =============================================================================

interface ServiceStatus {
    name: string;
    status: 'ok' | 'missing' | 'optional';
    message?: string;
}

function validateCredentials(): ServiceStatus[] {
    const services: ServiceStatus[] = [];

    // CRITICAL: OpenRouter API (Required for AI)
    if (process.env.OPENROUTER_API_KEY) {
        services.push({
            name: 'OpenRouter (AI Models)',
            status: 'ok',
            message: 'Multi-model AI routing enabled',
        });
    } else {
        services.push({
            name: 'OpenRouter (AI Models)',
            status: 'missing',
            message: '⚠️  CRITICAL: No AI features will work!',
        });
    }

    // Helicone (Optional)
    if (process.env.HELICONE_API_KEY && process.env.HELICONE_ENABLED !== 'false') {
        services.push({
            name: 'Helicone',
            status: 'ok',
            message: 'Analytics & caching enabled',
        });
    } else {
        services.push({
            name: 'Helicone',
            status: 'optional',
            message: 'Analytics disabled',
        });
    }

    // GitHub Export
    if (process.env.GITHUB_TOKEN) {
        services.push({
            name: 'GitHub',
            status: 'ok',
            message: 'Code export enabled',
        });
    } else {
        services.push({
            name: 'GitHub',
            status: 'optional',
            message: 'Code export disabled',
        });
    }

    // Database (Turso)
    if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
        services.push({
            name: 'Database',
            status: 'ok',
            message: 'Turso (SQLite) connected',
        });
    } else {
        services.push({
            name: 'Database',
            status: 'missing',
            message: 'No database configured - data will not persist',
        });
    }

    // Cloud Providers
    if (process.env.RUNPOD_API_KEY) {
        services.push({ name: 'RunPod', status: 'ok', message: 'GPU deployment ready' });
    } else {
        services.push({ name: 'RunPod', status: 'optional' });
    }

    if (process.env.VERCEL_TOKEN) {
        services.push({ name: 'Vercel', status: 'ok', message: 'Static deployment ready' });
    } else {
        services.push({ name: 'Vercel', status: 'optional' });
    }

    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        services.push({ name: 'AWS', status: 'ok', message: 'AWS deployment ready' });
    } else {
        services.push({ name: 'AWS', status: 'optional' });
    }

    // Billing
    if (process.env.STRIPE_SECRET_KEY) {
        services.push({ name: 'Stripe', status: 'ok', message: 'Billing enabled' });
    } else {
        services.push({ name: 'Stripe', status: 'optional', message: 'Billing not configured' });
    }

    return services;
}

function printStartupStatus(services: ServiceStatus[]) {
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║               KRIPTIK AI - Service Status                     ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');

    for (const service of services) {
        const icon = service.status === 'ok' ? '✅' : service.status === 'missing' ? '❌' : '⚪';
        const statusText = service.message || (service.status === 'optional' ? 'Not configured' : '');
        console.log(`║ ${icon} ${service.name.padEnd(25)} ${statusText.substring(0, 30).padEnd(30)}║`);
    }

    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    // Check for critical missing services
    const missing = services.filter(s => s.status === 'missing');
    if (missing.length > 0) {
        console.log('⚠️  WARNING: Critical services are missing!');
        console.log('   See SETUP.md for configuration instructions.\n');
    }
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

import {
    generalRateLimiter,
    aiRateLimiter,
    orchestrationRateLimiter,
    autonomousRateLimiter,
} from './middleware/rate-limiter.js';
import {
    sanitizer,
    promptSanitizer,
    filePathSanitizer,
} from './middleware/sanitizer.js';
import { requireCredits } from './services/billing/credits.js';

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Apply input sanitization to all requests
app.use(sanitizer);

// Apply general rate limiting to all API routes
app.use('/api', generalRateLimiter);

// =============================================================================
// AUTH ROUTES
// =============================================================================

import { toNodeHandler } from "better-auth/node";
import { auth } from './auth.js';
// Use :splat syntax for Express 5 compatibility with path-to-regexp
app.all("/api/auth/*splat", toNodeHandler(auth));

// =============================================================================
// API ROUTES
// =============================================================================

import projectsRouter from './routes/projects.js';
import filesRouter from './routes/files.js';
import generateRouter from './routes/generate.js';
import cloudRouter from './routes/cloud.js';
import deployRouter from './routes/deploy.js';
import billingRouter from './routes/billing.js';
import orchestrateRouter from './routes/orchestrate.js';
import exportRouter from './routes/export.js';
import aiRouter from './routes/ai.js';
import mcpRouter from './routes/mcp.js';
import provisioningRouter from './routes/provisioning.js';
import securityRouter from './routes/security.js';
import templatesRouter from './routes/templates.js';
import credentialsRouter from './routes/credentials.js';
import oauthRouter from './routes/oauth.js';
import smartDeployRouter from './routes/smart-deploy.js';
import agentsRouter from './routes/agents.js';
import workflowsRouter from './routes/workflows.js';
import migrationRouter from './routes/migration.js';
import qualityRouter from './routes/quality.js';
import configRouter from './routes/config.js';
import planRouter from './routes/plan.js';
import figmaRouter from './routes/figma.js';
import modelDeployRouter from './routes/model-deploy.js';
import stripeRouter from './routes/stripe.js';
import infrastructureRouter from './routes/infrastructure.js';
import autonomousRouter from './routes/autonomous.js';
import hostingRouter from './routes/hosting.js';
import userSettingsRouter from './routes/user-settings.js';

// Core functionality
app.use("/api/projects", projectsRouter);
app.use("/api/projects", filePathSanitizer, filesRouter);
// Generation routes require credits (estimated 50 credits per generation)
app.use("/api/projects", promptSanitizer, requireCredits(50), generateRouter);

// Apply stricter rate limits and credit checks to expensive operations
// Orchestration uses more tokens, require 100 credits
app.use("/api/orchestrate", orchestrationRateLimiter, promptSanitizer, requireCredits(100), orchestrateRouter);

// AI services (image-to-code, self-healing, test generation) - 30 credits
app.use("/api/ai", aiRateLimiter, promptSanitizer, requireCredits(30), aiRouter);

// Implementation planning
app.use("/api/plan", planRouter);

// Figma integration
app.use("/api/figma", figmaRouter);

// Provisioning (database, auth - one-click infrastructure)
app.use("/api/provisioning", provisioningRouter);

// Security (pre-deployment scanning)
app.use("/api/security", securityRouter);

// Export (GitHub) & Deployment
app.use("/api/export", exportRouter);
app.use("/api/deploy", deployRouter);
app.use("/api/cloud", cloudRouter);

// MCP (Model Context Protocol)
app.use("/api/mcp", mcpRouter);

// Billing
app.use("/api/billing", billingRouter);

// Templates
app.use("/api/templates", templatesRouter);

// Credentials & OAuth
app.use("/api/credentials", credentialsRouter);
app.use("/api/oauth", oauthRouter);

// Smart Deployment
app.use("/api/smart-deploy", smartDeployRouter);

// Multi-Agent Orchestration
app.use("/api/agents", agentsRouter);

// Workflows
app.use("/api/workflows", workflowsRouter);

// Migration
app.use("/api/migration", migrationRouter);

// Code Quality
app.use("/api/quality", qualityRouter);

// Configuration
app.use("/api/config", configRouter);

// Model Deployment (Replicate, Modal, Fal.ai)
app.use("/api/model-deploy", modelDeployRouter);

// Stripe Integration (for user's projects)
app.use("/api/stripe", stripeRouter);

// Infrastructure/IaC (Terraform, Docker, Kubernetes)
app.use("/api/infrastructure", infrastructureRouter);

// Autonomous Building ("Approve and Watch") - strictest rate limits, highest credit requirement
// Autonomous building uses significant resources, require 200 credits
app.use("/api/autonomous", autonomousRateLimiter, promptSanitizer, requireCredits(200), autonomousRouter);

// Hosting (Cloudflare/Vercel managed deployments + IONOS domains)
app.use("/api/hosting", hostingRouter);

// User Settings (preferences, billing, notifications)
app.use("/api/settings", userSettingsRouter);

// =============================================================================
// HEALTH & STATUS
// =============================================================================

// Root path - API info
app.get('/', (req, res) => {
    res.json({
        name: 'KripTik AI API',
        version: '1.0.0',
        status: 'running',
        documentation: '/health for service status, /api/config/services for capabilities',
    });
});

// Favicon handler - return 204 No Content (prevents 404 spam in logs)
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/favicon.png', (req, res) => res.status(204).end());

// Detailed health check with service status
app.get('/health', (req, res) => {
    const services = validateCredentials();
    const hasCritical = services.some(s => s.status === 'missing');

    res.json({
        status: hasCritical ? 'degraded' : 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: services.map(s => ({
            name: s.name,
            status: s.status,
            message: s.message,
        })),
    });
});

// Service configuration status (for frontend to know what's available)
app.get('/api/config/services', (req, res) => {
    res.json({
        ai: {
            enabled: !!process.env.OPENROUTER_API_KEY,
            provider: 'openrouter',
            models: ['claude-sonnet-4', 'gpt-4o', 'claude-haiku', 'gpt-4o-mini', 'llama-3.3-70b'],
            heliconeEnabled: process.env.HELICONE_ENABLED !== 'false' && !!process.env.HELICONE_API_KEY,
            imageToCode: !!process.env.OPENROUTER_API_KEY,
            selfHealing: !!process.env.OPENROUTER_API_KEY,
            testGeneration: !!process.env.OPENROUTER_API_KEY,
        },
        export: {
            github: !!process.env.GITHUB_TOKEN,
            figma: !!process.env.FIGMA_ACCESS_TOKEN,
        },
        cloud: {
            runpod: !!process.env.RUNPOD_API_KEY,
            vercel: !!process.env.VERCEL_TOKEN,
            netlify: !!process.env.NETLIFY_TOKEN,
            aws: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
            gcp: !!(process.env.GCP_PROJECT_ID && process.env.GCP_PRIVATE_KEY),
        },
        billing: {
            enabled: !!process.env.STRIPE_SECRET_KEY,
        },
        autonomous: {
            enabled: true,
            features: [
                'autonomous_building',
                'auto_fix',
                'visual_verification',
                'e2e_testing',
                'browser_automation',
            ],
        },
    });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
});

// =============================================================================
// START SERVER (only when not running as serverless)
// =============================================================================

// Export for Vercel serverless
export default app;

// Pre-warm for serverless cold starts
if (process.env.VERCEL) {
    warmupRouter();
}

// Only listen when running directly (not on Vercel)
if (!process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`\n🚀 KripTik AI Server starting on http://localhost:${port}`);
        console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);

        // Pre-warm services
        warmupRouter();

        const services = validateCredentials();
        printStartupStatus(services);

        if (!process.env.OPENROUTER_API_KEY) {
            console.log('═══════════════════════════════════════════════════════════════');
            console.log('  ❌ OPENROUTER_API_KEY is not set!');
            console.log('  ❌ AI code generation WILL NOT WORK.');
            console.log('  ❌ Get your API key from: https://openrouter.ai/keys');
            console.log('═══════════════════════════════════════════════════════════════\n');
        }
    });
}
