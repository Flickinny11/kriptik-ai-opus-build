import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getModelRouter } from './services/ai/model-router.js';

dotenv.config();

// Build timestamp for cache busting and deployment verification
const BUILD_TIMESTAMP = '2025-12-08T18:05:00Z';
console.log(`[Server] Build timestamp: ${BUILD_TIMESTAMP}`);

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
import { userContextMiddleware } from './middleware/user-context.js';
import { requireCredits } from './services/billing/credits.js';

// =============================================================================
// CORS CONFIGURATION
// =============================================================================

// Allowed origins for CORS
const allowedOrigins = [
    // Production frontend
    'https://kriptik-ai-opus-build.vercel.app',
    // Vercel preview deployments - multiple patterns to catch all variations
    /^https:\/\/kriptik-ai-opus-build-[a-z0-9-]+\.vercel\.app$/,
    /^https:\/\/kriptik-ai-[a-z0-9-]+\.vercel\.app$/,
    // Custom frontend URL from env
    process.env.FRONTEND_URL,
    // Development
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
].filter(Boolean);

// Log allowed origins for debugging
console.log('[CORS] Allowed origins configured:', allowedOrigins.map(o => o instanceof RegExp ? o.toString() : o));

// CRITICAL: Handle ALL OPTIONS preflight requests FIRST
// This ensures CORS headers are always sent, even if route doesn't exist
// Using middleware instead of app.options('*') for Express 5 compatibility
app.use((req, res, next) => {
    if (req.method !== 'OPTIONS') {
        return next();
    }

    const origin = req.headers.origin as string;

    // Check if origin is allowed
    const isAllowed = !origin ||
        allowedOrigins.includes(origin) ||
        allowedOrigins.some(allowed => allowed instanceof RegExp && allowed.test(origin));

    if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, x-user-id, X-User-Id, Cookie, Set-Cookie');
        res.setHeader('Access-Control-Expose-Headers', 'Set-Cookie');
        res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
        return res.status(204).end();
    }

    res.status(403).json({ error: 'CORS not allowed' });
});

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);

        // Check exact matches
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // Check regex patterns (for Vercel preview URLs)
        for (const allowed of allowedOrigins) {
            if (allowed instanceof RegExp && allowed.test(origin)) {
                return callback(null, true);
            }
        }

        // Log blocked origins in development
        if (process.env.NODE_ENV !== 'production') {
            console.warn(`CORS blocked origin: ${origin}`);
        }

        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-user-id', 'X-User-Id', 'Cookie'],
    exposedHeaders: ['Set-Cookie'],
}));
app.use(express.json({ limit: '10mb' }));

// NOTE: Sanitizer is NOT applied globally anymore to avoid breaking OAuth
// It's applied per-route where needed (see route definitions below)

// Apply general rate limiting to all API routes
app.use('/api', generalRateLimiter);

// =============================================================================
// AUTH ROUTES (Must be before userContextMiddleware - no sanitization!)
// =============================================================================

import { toNodeHandler } from "better-auth/node";
import { auth, testDatabaseConnection, ensureAuthTables } from './auth.js';

// Frontend URL for redirects after auth
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://kriptik-ai-opus-build.vercel.app';

// Custom middleware to handle OAuth callback redirect
// This intercepts the response from Better Auth and ensures proper redirect
app.use("/api/auth/callback", (req, res, next) => {
    console.log(`[OAuth Callback] ${req.method} ${req.path}`);
    console.log(`[OAuth Callback] Query params:`, req.query);

    // Store original redirect method
    const originalRedirect = res.redirect.bind(res);

    // Override redirect to ensure we go to frontend
    res.redirect = function(statusOrUrl: number | string, url?: string) {
        let targetUrl = typeof statusOrUrl === 'string' ? statusOrUrl : url;
        let status = typeof statusOrUrl === 'number' ? statusOrUrl : 302;

        console.log(`[OAuth Callback] Redirect called with: ${targetUrl}`);

        // If redirect is to backend or root, redirect to frontend instead
        if (!targetUrl || targetUrl === '/' || targetUrl.includes('kriptik-ai-opus-build-backend')) {
            console.log(`[OAuth Callback] Overriding redirect to frontend dashboard`);
            targetUrl = `${FRONTEND_URL}/dashboard`;
        }

        return originalRedirect(status, targetUrl);
    } as typeof res.redirect;

    next();
});

// Better Auth handler - catches all /api/auth/* routes
// Use middleware approach for Express 5 path-to-regexp compatibility
// Add logging middleware before Better Auth
app.use("/api/auth", (req, res, next) => {
    console.log(`[Auth] ${req.method} ${req.path} - Body keys: ${req.body ? Object.keys(req.body).join(', ') : 'none'}`);

    // Capture response for logging
    const originalSend = res.send.bind(res);
    res.send = ((body: any) => {
        console.log(`[Auth] Response ${res.statusCode} for ${req.method} ${req.path}`);
        return originalSend(body);
    }) as typeof res.send;

    next();
}, toNodeHandler(auth));

// Fallback redirect for any auth-related requests that land on backend root
app.get("/auth-redirect", (req, res) => {
    console.log('[Auth Redirect] Redirecting to frontend dashboard');
    res.redirect(`${FRONTEND_URL}/dashboard`);
});

// CRITICAL: Catch any requests to /dashboard on backend and redirect to frontend
// This handles the case where OAuth redirects to backend/dashboard instead of frontend/dashboard
app.get("/dashboard", (req, res) => {
    console.log('[Dashboard Redirect] User landed on backend /dashboard, redirecting to frontend');
    res.redirect(`${FRONTEND_URL}/dashboard`);
});

// Also catch /dashboard/... paths using regex to avoid path-to-regexp errors
app.get(/^\/dashboard\/(.*)$/, (req, res) => {
    const path = req.path;
    console.log(`[Dashboard Redirect] User landed on backend ${path}, redirecting to frontend`);
    res.redirect(`${FRONTEND_URL}${path}`);
});

// Auth diagnostic endpoint (for debugging) - placed BEFORE Better Auth handler
app.get("/api/debug/auth-test", async (req, res) => {
    console.log('[Auth Test] Running diagnostics...');

    const dbTest = await testDatabaseConnection();

    const diagnostics = {
        timestamp: new Date().toISOString(),
        database: dbTest,
        config: {
            betterAuthSecretSet: !!process.env.BETTER_AUTH_SECRET,
            betterAuthUrl: process.env.BETTER_AUTH_URL,
            frontendUrl: process.env.FRONTEND_URL,
            googleClientIdSet: !!process.env.GOOGLE_CLIENT_ID,
            githubClientIdSet: !!process.env.GITHUB_CLIENT_ID,
        },
        cookies: {
            received: req.headers.cookie || 'none',
        },
        origin: req.headers.origin || 'none',
    };

    console.log('[Auth Test] Diagnostics:', JSON.stringify(diagnostics, null, 2));

    res.json(diagnostics);
});

// =============================================================================
// USER CONTEXT MIDDLEWARE (Applied after auth routes)
// =============================================================================

// Apply user context middleware - sets req.user from x-user-id header
// This must come AFTER auth routes but BEFORE other API routes
app.use('/api', userContextMiddleware);

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
import fixMyAppRouter from './routes/fix-my-app.js';
import dbMigrateRouter from './routes/db-migrate.js';
import adminRouter from './routes/admin.js';
import developerSettingsRouter from './routes/developer-settings.js';
import softInterruptRouter from './routes/soft-interrupt.js';
import validationRouter from './routes/validation.js';
import ghostModeRouter from './routes/ghost-mode.js';
import learningRouter from './routes/learning.js';
import developerModeRouter from './routes/developer-mode.js';
import autonomyRouter from './routes/autonomy.js';
import checkpointsRouter from './routes/checkpoints.js';
import intelligenceDialRouter from './routes/intelligence-dial.js';
import speedDialRouter from './routes/speed-dial.js';
import tournamentRouter from './routes/tournament.js';
import reflectionRouter from './routes/reflection.js';

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

// Fix My App - Import and fix broken apps from other AI builders
// Uses significant resources for analysis and fixing, require 150 credits
app.use("/api/fix-my-app", promptSanitizer, requireCredits(150), fixMyAppRouter);

// Database migration (no auth required - protected by secret header)
app.use("/api/db", dbMigrateRouter);

// Admin routes (protected by admin secret header)
app.use("/api/admin", adminRouter);

// Developer Mode Settings (project rules, user rules, feedback)
app.use("/api/developer-settings", developerSettingsRouter);

// Advanced Developer Options (F046-F064)
// Soft Interrupt System - Non-blocking agent input
app.use("/api/soft-interrupt", softInterruptRouter);

// Pre-Deployment Validation - Platform-aware building
app.use("/api/validation", validationRouter);

// Ghost Mode - Autonomous background building
// Requires significant resources, 150 credits
app.use("/api/ghost-mode", promptSanitizer, requireCredits(150), ghostModeRouter);

// Autonomous Learning Engine - System status, patterns, strategies, insights
app.use("/api/learning", learningRouter);

// Krip-Toe-Nite - Intelligent Model Orchestration
import kripToeNiteRouter from './routes/krip-toe-nite.js';
app.use("/api/krip-toe-nite", kripToeNiteRouter);

// Unified Execution - Three-Mode Architecture (Builder, Developer, Agents)
import executeRouter from './routes/execute.js';
app.use("/api/execute", promptSanitizer, requireCredits(100), executeRouter);

// Developer Mode - Multi-agent orchestration system (up to 6 concurrent agents)
// Requires 100 credits for session operations
app.use("/api/developer-mode", promptSanitizer, requireCredits(100), developerModeRouter);

// Speed Dial - Build mode selector (Lightning/Standard/Tournament/Production)
app.use("/api/speed-dial", speedDialRouter);

// Intelligence Dial - Per-request capability toggles
app.use("/api/intelligence-dial", intelligenceDialRouter);

// Tournament Mode - Competing implementations with AI judge
// Tournament mode is resource-intensive, require 150 credits
app.use("/api/tournament", promptSanitizer, requireCredits(150), tournamentRouter);

// Time Machine - Checkpoints and rollback
app.use("/api/checkpoints", checkpointsRouter);

// Reflection Engine - Self-improving system
app.use("/api/reflection", reflectionRouter);

// Autonomy Controls - Autonomous building settings
app.use("/api/autonomy", autonomyRouter);

// Clone Mode - Video to Code (analyze screen recordings)
import cloneModeRouter from './routes/clone-mode.js';
app.use("/api/clone", promptSanitizer, requireCredits(50), cloneModeRouter);

// User Twin - AI-powered synthetic user testing
import userTwinRouter from './routes/user-twin.js';
app.use("/api/user-twin", requireCredits(25), userTwinRouter);

// Market Fit Oracle - Competitor analysis and positioning
import marketFitRouter from './routes/market-fit.js';
app.use("/api/market-fit", requireCredits(30), marketFitRouter);

// Voice Architect - Voice-to-code capability
import voiceArchitectRouter from './routes/voice-architect.js';
app.use("/api/voice", requireCredits(15), voiceArchitectRouter);

// API Autopilot - API discovery and integration
import apiAutopilotRouter from './routes/api-autopilot.js';
app.use("/api/autopilot", requireCredits(10), apiAutopilotRouter);

// Adaptive UI - Behavior learning and UI improvements
import adaptiveUIRouter from './routes/adaptive-ui.js';
app.use("/api/adaptive", adaptiveUIRouter); // No credits - analytics should be free

// Context Bridge - Codebase import and analysis
import contextBridgeRouter from './routes/context-bridge.js';
app.use("/api/context", requireCredits(25), contextBridgeRouter);

// =============================================================================
// SELF-HEALING SYSTEM
// =============================================================================

import { getSelfHealingCoordinator } from './services/self-healing/coordinator.js';
import { getCreditPoolService } from './services/billing/credit-pool.js';

// Initialize self-healing and credit pool
const initializeSelfHealing = async () => {
    try {
        // Initialize credit pool
        const pool = getCreditPoolService();
        await pool.initialize();
        console.log('[CreditPool] Initialized');

        // Start self-healing coordinator
        const coordinator = getSelfHealingCoordinator();
        await coordinator.start();

        // Graceful shutdown handler
        const shutdown = () => {
            coordinator.stop();
            process.exit(0);
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    } catch (error) {
        console.error('[SelfHealing] Failed to initialize:', error);
    }
};

// Initialize on startup (but not blocking)
initializeSelfHealing();

// =============================================================================
// HEALTH & STATUS
// =============================================================================

// Root path - redirect to frontend if coming from OAuth, otherwise show API info
app.get('/', (req, res) => {
    // Check if this is likely a redirect from OAuth (user has auth cookie or just completed OAuth)
    const cookies = req.headers.cookie || '';
    const hasAuthCookie = cookies.includes('kriptik_auth') || cookies.includes('better-auth');
    const referer = req.headers.referer || '';
    const fromGoogle = referer.includes('google.com') || referer.includes('accounts.google');
    const fromGithub = referer.includes('github.com');

    console.log(`[Root] Request - hasAuthCookie: ${hasAuthCookie}, fromGoogle: ${fromGoogle}, fromGithub: ${fromGithub}`);

    // If user has auth cookie or coming from OAuth provider, redirect to frontend
    if (hasAuthCookie || fromGoogle || fromGithub) {
        const frontendUrl = process.env.FRONTEND_URL || 'https://kriptik-ai-opus-build.vercel.app';
        console.log(`[Root] Redirecting to frontend dashboard: ${frontendUrl}/dashboard`);
        return res.redirect(`${frontendUrl}/dashboard`);
    }

    // Otherwise, show API info
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
// Trigger deploy after fixing Vercel settings
