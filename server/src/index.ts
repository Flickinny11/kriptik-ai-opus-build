import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getModelRouter } from './services/ai/model-router.js';

// Infrastructure imports
import { checkRedisHealth, closeRedis } from './services/infrastructure/redis.js';
import { closeJobQueues } from './services/infrastructure/job-queue.js';
import { initializeWorkers } from './workers/index.js';
import { healthRouter } from './routes/health.js';
import { startMonitoring, stopMonitoring } from './services/infrastructure/monitoring-service.js';
import { ensureDatabaseSchema } from './services/infrastructure/db-schema.js';
import { createRequestLogger, errorLogger } from './middleware/request-logger.js';
import cronRouter from './routes/cron.js';
import monitoringRouter from './routes/monitoring.js';

dotenv.config();

// Build timestamp for cache busting and deployment verification
const BUILD_TIMESTAMP = '2025-12-14T19:00:00Z'; // Production scaling infrastructure
console.log(`[Server] Build timestamp: ${BUILD_TIMESTAMP}`);

// Pre-warm model router for faster first request (2-3s improvement)
const warmupRouter = () => {
    try {
        getModelRouter(); // Initialize singleton
        console.log('[Server] Model router pre-warmed');
    } catch (error) {
        console.error('[Server] Failed to pre-warm model router:', error);
    }
};

// Initialize production infrastructure
const initializeInfrastructure = async () => {
    console.log('[Infrastructure] Initializing production services...');

    try {
        // Ensure critical DB tables exist (UnifiedContext, Developer Mode settings, Hosting)
        // This is safe on Vercel: all statements are CREATE ... IF NOT EXISTS
        try {
            const schemaResult = await ensureDatabaseSchema();
            if (schemaResult.createdTables.length > 0) {
                console.log('[Infrastructure] Database schema updated (created tables):', schemaResult.createdTables.join(', '));
            } else {
                console.log('[Infrastructure] Database schema OK (no missing critical tables)');
            }
        } catch (error) {
            // Don't crash the server on schema ensure errors, but log loudly
            console.error('[Infrastructure] Database schema ensure failed:', error);
        }

        // Check Redis connection
        const redisHealth = await checkRedisHealth();
        if (redisHealth.connected) {
            console.log(`[Infrastructure] Redis connected (latency: ${redisHealth.latency}ms)`);
        } else {
            console.warn('[Infrastructure] Redis unavailable, using fallback mode:', redisHealth.error);
        }

        // Initialize job queue workers
        await initializeWorkers();
        console.log('[Infrastructure] Background workers initialized');

        // Start monitoring service
        startMonitoring();
        console.log('[Infrastructure] Monitoring service started');

        console.log('[Infrastructure] Production services ready');
    } catch (error) {
        console.error('[Infrastructure] Failed to initialize:', error);
        console.warn('[Infrastructure] Running in degraded mode');
    }
};

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
    console.log(`[Server] Received ${signal}, starting graceful shutdown...`);

    try {
        // Stop monitoring service
        stopMonitoring();
        console.log('[Server] Monitoring service stopped');

        // Close job queues
        await closeJobQueues();
        console.log('[Server] Job queues closed');

        // Close Redis
        await closeRedis();
        console.log('[Server] Redis connection closed');

        console.log('[Server] Graceful shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('[Server] Error during shutdown:', error);
        process.exit(1);
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

    // CRITICAL: AI API Keys - Dual SDK Architecture
    // Priority: Direct SDKs (Anthropic, OpenAI) > OpenRouter fallback
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;
    const hasAnyAIProvider = hasAnthropicKey || hasOpenAIKey || hasOpenRouterKey;

    if (hasAnthropicKey) {
        services.push({
            name: 'Anthropic (Claude)',
            status: 'ok',
            message: 'Direct Claude API enabled (Opus 4.5, Sonnet 4.5)',
        });
    }
    if (hasOpenAIKey) {
        services.push({
            name: 'OpenAI (GPT)',
            status: 'ok',
            message: 'Direct OpenAI API enabled (GPT-5.2, GPT-4o)',
        });
    }
    if (hasOpenRouterKey) {
        services.push({
            name: 'OpenRouter (Fallback)',
            status: 'ok',
            message: 'Multi-model routing available',
        });
    }
    if (!hasAnyAIProvider) {
        services.push({
            name: 'AI Providers',
            status: 'missing',
            message: '⚠️  CRITICAL: No AI features will work! Set ANTHROPIC_API_KEY or OPENAI_API_KEY',
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
import { optionalAuthMiddleware } from './middleware/auth.js';

// =============================================================================
// CORS CONFIGURATION
// =============================================================================

// Allowed origins for CORS
const allowedOrigins = [
    // ==========================================================================
    // PRODUCTION CUSTOM DOMAIN - kriptik.app
    // ==========================================================================
    'https://kriptik.app',
    'https://www.kriptik.app',
    /^https:\/\/([a-z0-9-]+\.)?kriptik\.app$/,  // Any subdomain of kriptik.app

    // ==========================================================================
    // VERCEL DEPLOYMENTS
    // ==========================================================================
    // Production frontend (Vercel)
    'https://kriptik-ai-opus-build.vercel.app',
    // Vercel preview deployments - comprehensive patterns
    // Pattern: kriptik-ai-opus-build-{git-hash}.vercel.app
    /^https:\/\/kriptik-ai-opus-build-[a-z0-9-]+\.vercel\.app$/,
    // Pattern: kriptik-ai-opus-build-{username}-projects-{hash}.vercel.app (Vercel team deploys)
    /^https:\/\/kriptik-ai-opus-build-[a-z0-9-]+-projects-[a-z0-9]+\.vercel\.app$/,
    // Pattern: kriptik-ai-{anything}.vercel.app (catch-all for any kriptik-ai subdomain)
    /^https:\/\/kriptik-ai[a-z0-9-]*\.vercel\.app$/,
    // Catch-all for ANY Vercel preview with kriptik in the name
    /^https:\/\/[a-z0-9-]*kriptik[a-z0-9-]*\.vercel\.app$/,
    // Custom frontend URL from env (important for production)
    process.env.FRONTEND_URL,
    // Backend URLs (for same-origin requests or internal calls)
    'https://kriptik-ai-opus-build-backend.vercel.app',
    /^https:\/\/kriptik-ai-opus-build-backend[a-z0-9-]*\.vercel\.app$/,

    // ==========================================================================
    // DEVELOPMENT
    // ==========================================================================
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    // Any localhost port (Vite can auto-increment ports)
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
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

    // Check if origin is allowed via explicit match or regex
    let isAllowed = !origin ||
        allowedOrigins.includes(origin) ||
        allowedOrigins.some(allowed => allowed instanceof RegExp && allowed.test(origin));

    // Allow Chrome and Firefox extensions
    if (!isAllowed && origin) {
        if (origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://')) {
            console.log(`[CORS Preflight] Allowing browser extension: ${origin}`);
            isAllowed = true;
        }
    }

    // Allow embedded browser origins (Cursor, VS Code webviews, mobile webviews)
    if (!isAllowed && origin) {
        if (
            origin.startsWith('vscode-webview://') ||
            origin.startsWith('file://') ||
            origin === 'null' || // Some embedded browsers send 'null' as origin
            origin.includes('cursor') ||
            origin.includes('Cursor')
        ) {
            console.log(`[CORS Preflight] Allowing embedded browser: ${origin}`);
            isAllowed = true;
        }
    }

    // Fallback: Allow kriptik.app domain and Vercel domains with "kriptik" in the name
    // This prevents auth failures from new/unexpected URL patterns
    if (!isAllowed && origin) {
        if (origin.endsWith('.kriptik.app') || origin === 'https://kriptik.app' || origin === 'https://www.kriptik.app') {
            console.warn(`[CORS Preflight] Allowing kriptik.app domain: ${origin}`);
            isAllowed = true;
        } else if (origin.endsWith('.vercel.app') && origin.toLowerCase().includes('kriptik')) {
            console.warn(`[CORS Preflight] Allowing Vercel domain as fallback: ${origin}`);
            isAllowed = true;
        }
    }

    if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, x-user-id, X-User-Id, Cookie, Set-Cookie');
        res.setHeader('Access-Control-Expose-Headers', 'Set-Cookie');
        res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
        return res.status(204).end();
    }

    console.warn(`[CORS Preflight] Blocked origin: ${origin}`);
    res.status(403).json({ error: 'CORS not allowed', origin });
});

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);

        // Allow Chrome extension origins (chrome-extension://...)
        if (origin.startsWith('chrome-extension://')) {
            console.log(`[CORS] Allowing Chrome extension: ${origin}`);
            return callback(null, true);
        }

        // Allow Firefox extension origins (moz-extension://...)
        if (origin.startsWith('moz-extension://')) {
            console.log(`[CORS] Allowing Firefox extension: ${origin}`);
            return callback(null, true);
        }

        // Allow embedded browser origins (Cursor, VS Code webviews, mobile webviews)
        if (
            origin.startsWith('vscode-webview://') ||
            origin.startsWith('file://') ||
            origin === 'null' ||
            origin.includes('cursor') ||
            origin.includes('Cursor')
        ) {
            console.log(`[CORS] Allowing embedded browser: ${origin}`);
            return callback(null, true);
        }

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

        // ALWAYS log blocked origins for debugging (critical for auth issues)
        console.warn(`[CORS] Blocked origin: ${origin}`);
        console.warn(`[CORS] Allowed patterns: ${allowedOrigins.filter(o => o instanceof RegExp).map(o => o.toString()).join(', ')}`);

        // In production, be more permissive to avoid auth failures
        // This is a fallback - if we got here, the patterns above didn't match
        // Allow kriptik.app domain
        if (origin.endsWith('.kriptik.app') || origin === 'https://kriptik.app' || origin === 'https://www.kriptik.app') {
            console.warn(`[CORS] Allowing kriptik.app domain: ${origin}`);
            return callback(null, true);
        }
        // Allow Vercel domains with kriptik in the name
        if (origin.endsWith('.vercel.app') && (origin.includes('kriptik') || origin.includes('Kriptik'))) {
            console.warn(`[CORS] Allowing Vercel domain as fallback: ${origin}`);
            return callback(null, true);
        }

        callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-user-id', 'X-User-Id', 'Cookie'],
    exposedHeaders: ['Set-Cookie'],
}));
app.use(express.json({ limit: '10mb' }));

// NOTE: Sanitizer is NOT applied globally anymore to avoid breaking OAuth
// It's applied per-route where needed (see route definitions below)

// Apply request logging middleware
app.use(createRequestLogger({ logLevel: 'standard' }));

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
// SAFARI FIX: Safari has issues with 307 redirects not storing cookies
// This middleware ensures:
// 1. We use 302 (not 307) for better cookie handling
// 2. Proper redirect to frontend (not backend)
// 3. Explicit cookie acceptance headers for Safari
app.use("/api/auth/callback", (req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    const isSafari = /Safari/i.test(userAgent) && !/Chrome/i.test(userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);

    console.log(`[OAuth Callback] ${req.method} ${req.path}`);
    console.log(`[OAuth Callback] Query params:`, req.query);
    console.log(`[OAuth Callback] User-Agent: ${userAgent.substring(0, 100)}...`);
    console.log(`[OAuth Callback] Browser detection - Safari: ${isSafari}, iOS: ${isIOS}`);

    // Store original redirect method
    const originalRedirect = res.redirect.bind(res);

    // Override redirect to ensure we go to frontend
    res.redirect = function (statusOrUrl: number | string, url?: string) {
        let targetUrl = typeof statusOrUrl === 'string' ? statusOrUrl : url;
        // SAFARI FIX: Force 302 instead of 307 - Safari handles 302 better for cookies
        let status = 302; // Always use 302 for OAuth callbacks

        console.log(`[OAuth Callback] Redirect called with: ${targetUrl}, forcing status 302`);

        // If redirect is to backend or root, redirect to frontend instead
        if (
            !targetUrl ||
            targetUrl === '/' ||
            targetUrl.includes('kriptik-ai-opus-build-backend') ||
            targetUrl.includes('api.kriptik.app')
        ) {
            console.log(`[OAuth Callback] Overriding redirect to frontend dashboard`);
            targetUrl = `${FRONTEND_URL}/dashboard`;
        }

        // SAFARI FIX: Set explicit cache and vary headers for cookie handling
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Vary', 'Cookie');

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
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

    const diagnostics = {
        timestamp: new Date().toISOString(),
        database: dbTest,
        config: {
            betterAuthSecretSet: !!process.env.BETTER_AUTH_SECRET,
            betterAuthUrl: process.env.BETTER_AUTH_URL,
            frontendUrl: process.env.FRONTEND_URL,
            googleClientIdSet: !!process.env.GOOGLE_CLIENT_ID,
            githubClientIdSet: !!process.env.GITHUB_CLIENT_ID,
            isProd,
            cookieDomain: isProd ? 'kriptik.app' : 'localhost',
        },
        cookies: {
            received: req.headers.cookie || 'none',
        },
        origin: req.headers.origin || 'none',
        host: req.headers.host || 'none',
    };

    console.log('[Auth Test] Diagnostics:', JSON.stringify(diagnostics, null, 2));

    res.json(diagnostics);
});

// Cookie test endpoint - sets a test cookie and returns cookie info
app.get("/api/debug/cookie-test", (req, res) => {
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
    const testCookieName = 'kriptik_test_cookie';
    const testCookieValue = `test_${Date.now()}`;

    // Set a test cookie with the same settings as auth cookies
    const cookieOptions: string[] = [
        `${testCookieName}=${testCookieValue}`,
        'Path=/',
        `Max-Age=${60 * 60}`, // 1 hour
        'HttpOnly',
    ];

    if (isProd) {
        cookieOptions.push('Secure');
        cookieOptions.push('SameSite=Lax');
        // Use leading dot for explicit domain-wide cookies (matches Better Auth crossSubDomainCookies)
        cookieOptions.push('Domain=.kriptik.app');
    } else {
        cookieOptions.push('SameSite=Lax');
    }

    res.setHeader('Set-Cookie', cookieOptions.join('; '));

    res.json({
        message: 'Test cookie set',
        cookieSet: {
            name: testCookieName,
            value: testCookieValue,
            domain: isProd ? '.kriptik.app' : 'localhost',
            secure: isProd,
            sameSite: 'Lax',
        },
        cookiesReceived: req.headers.cookie || 'none',
        headers: {
            host: req.headers.host,
            origin: req.headers.origin,
        },
        isProd,
    });
});

// Session debug endpoint - checks recent sessions in database
app.get("/api/debug/sessions", async (req, res) => {
    try {
        const db = await import('./db.js').then(m => m.db);
        const { sessions } = await import('./schema.js');
        const { desc, sql } = await import('drizzle-orm');

        // Get recent sessions (last 10)
        const recentSessions = await db
            .select({
                id: sessions.id,
                userId: sessions.userId,
                expiresAt: sessions.expiresAt,
                tokenPrefix: sql<string>`SUBSTR(${sessions.token}, 1, 10)`.as('tokenPrefix'),
            })
            .from(sessions)
            .orderBy(desc(sessions.expiresAt))
            .limit(10);

        res.json({
            timestamp: new Date().toISOString(),
            sessionCount: recentSessions.length,
            recentSessions: recentSessions.map(s => ({
                id: s.id,
                userId: s.userId,
                tokenPrefix: s.tokenPrefix + '...',
                expiresAt: s.expiresAt,
                isExpired: new Date(s.expiresAt) < new Date(),
            })),
            cookiesReceived: req.headers.cookie || 'none',
        });
    } catch (error: any) {
        res.status(500).json({
            error: error.message,
            cookiesReceived: req.headers.cookie || 'none',
        });
    }
});

// =============================================================================
// USER CONTEXT MIDDLEWARE (Applied after auth routes)
// =============================================================================

// Populate req.user from Better Auth session cookies if present (does NOT enforce auth).
// This must come AFTER auth routes but BEFORE other API routes.
app.use('/api', optionalAuthMiddleware);

// Enrich authenticated req.user with tier/credits from DB.
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
import ceilingRouter from './routes/ceiling.js';
import orchestrateRouter from './routes/orchestrate.js';
import exportRouter from './routes/export.js';
import aiRouter from './routes/ai.js';
import mcpRouter from './routes/mcp.js';
import provisioningRouter from './routes/provisioning.js';
import securityRouter from './routes/security.js';
import templatesRouter from './routes/templates.js';
import credentialsRouter from './routes/credentials.js';
import oauthRouter from './routes/oauth.js';
import nangoRouter from './routes/nango.js';
import dependenciesRouter from './routes/dependencies.js';
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
import continuousLearningRouter from './routes/continuous-learning.js';
import developerModeRouter from './routes/developer-mode.js';
import featureAgentRouter from './routes/feature-agent.js';
import notificationsRouter from './routes/notifications.js';
import webhooksRouter from './routes/webhooks.js';
import autonomyRouter from './routes/autonomy.js';
import checkpointsRouter from './routes/checkpoints.js';
import intelligenceDialRouter from './routes/intelligence-dial.js';
import speedDialRouter from './routes/speed-dial.js';
import tournamentRouter from './routes/tournament.js';
import reflectionRouter from './routes/reflection.js';
import previewRouter from './routes/preview.js';
import { importRouter } from './routes/import.js';
import integrationsRouter from './routes/integrations.js';
import huggingfaceAuthRouter from './routes/huggingface-auth.js';
import openSourceStudioRouter from './routes/open-source-studio.js';
import embeddingsRouter from './routes/embeddings.js';
import semanticIntentRouter from './routes/semantic-intent.js';
import semanticSatisfactionRouter from './routes/semantic-satisfaction.js';
import visualUnderstandingRouter from './routes/visual-understanding.js';
import hyperThinkingRouter from './routes/hyper-thinking.js';

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

// Embeddings API (VL-JEPA semantic layer) - 5 credits per request
app.use("/api/embeddings", aiRateLimiter, requireCredits(5), embeddingsRouter);

// Semantic Intent API (VL-JEPA intent verification) - 10 credits per request
app.use("/api/semantic-intent", aiRateLimiter, requireCredits(10), semanticIntentRouter);

// Semantic Satisfaction API (VL-JEPA completion gates) - 15 credits per request
app.use("/api/semantic-satisfaction", aiRateLimiter, requireCredits(15), semanticSatisfactionRouter);

// Visual Understanding API (VL-JEPA visual analysis with Gemini) - 20 credits per request
app.use("/api/visual", aiRateLimiter, requireCredits(20), visualUnderstandingRouter);

// Hyper-Thinking API (Advanced Multi-Model Reasoning) - 25 credits per request
app.use("/api/hyper-thinking", aiRateLimiter, requireCredits(25), hyperThinkingRouter);

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

// Credit Ceiling - No credit requirement (monitoring only)
app.use("/api/ceiling", ceilingRouter);

// Templates
app.use("/api/templates", templatesRouter);

// Credentials & OAuth
app.use("/api/credentials", credentialsRouter);
app.use("/api/oauth", oauthRouter);
app.use("/api/nango", nangoRouter);
app.use("/api/dependencies", dependenciesRouter);

// Service Auto-Configuration (Stripe webhooks, etc.)
import serviceAutoConfigRouter from './routes/service-auto-config.js';
app.use("/api", serviceAutoConfigRouter);

// Nango OAuth Integrations
app.use("/api/integrations", integrationsRouter);

// HuggingFace Authentication (Open Source Studio)
app.use("/api/huggingface", huggingfaceAuthRouter);

// Open Source Studio (Model Browser & Training)
app.use("/api/open-source-studio", openSourceStudioRouter);

// Training API (Fine-tuning on RunPod - PROMPT 4)
import trainingRouter from './routes/training.js';
app.use("/api/training", trainingRouter);

// Model Testing API (Side-by-side comparison - Training Platform)
import modelTestingRouter from './routes/model-testing.js';
app.use("/api/model-testing", modelTestingRouter);

// Media API (Upload, Processing, Preview - Training Platform PROMPT 6)
import { mediaRouter } from './routes/media.js';
app.use("/api/media", mediaRouter);

// One-Click Deployment API (Deploy models to RunPod/Modal - Training Platform PROMPT 7)
import { deploymentRouter } from './routes/deployment.js';
app.use("/api/deployment", deploymentRouter);

// External App Integration API (PROMPT 8)
import { externalAppRouter } from './routes/external-app.js';
app.use("/api/external-app", externalAppRouter);

// Inference Endpoints API (Deploy & manage endpoints - PROMPT 5)
import endpointsRouter from './routes/endpoints.js';
app.use("/api/endpoints", endpointsRouter);

// Inference Gateway API (Private Endpoints - Auto-Deploy PROMPT 3)
// This is the unified gateway for all inference requests to user's private endpoints
import inferenceRouter from './routes/api/inference.js';
app.use("/api/v1/inference", inferenceRouter);

// GPU Cost Tracking API (PROMPT 8)
import gpuCostsRouter from './routes/gpu-costs.js';
app.use("/api/gpu-costs", gpuCostsRouter);

// AI Lab - Multi-Agent Research Orchestration (PROMPT 6)
import aiLabRouter from './routes/ai-lab.js';
app.use("/api/ai-lab", aiLabRouter);

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

// Continuous Learning Engine - Meta-integration layer for self-improvement
app.use("/api/continuous-learning", continuousLearningRouter);

// Krip-Toe-Nite - Intelligent Model Orchestration
import kripToeNiteRouter from './routes/krip-toe-nite.js';
app.use("/api/krip-toe-nite", kripToeNiteRouter);

// Unified Execution - Three-Mode Architecture (Builder, Developer, Agents)
import executeRouter from './routes/execute.js';
app.use("/api/execute", promptSanitizer, requireCredits(100), executeRouter);

// Developer Mode - Multi-agent orchestration system (up to 6 concurrent agents)
// Requires 100 credits for session operations
app.use("/api/developer-mode", promptSanitizer, requireCredits(100), developerModeRouter);

// Feature Agent - Dedicated route module (alias wrapper around FeatureAgentService)
// Requires 100 credits for agent operations
app.use("/api/feature-agent", promptSanitizer, requireCredits(100), featureAgentRouter);

// Notifications - in-app + external channels (non-expensive; do not credit-gate)
app.use("/api/notifications", promptSanitizer, notificationsRouter);

// Webhooks - Notification reply handlers (Twilio SMS, SendGrid email, Push, Slack)
// No auth required - validated via token
app.use("/api/webhooks", webhooksRouter);

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

// Headless Browser Preview - Feature demonstration and acceptance
import('playwright').then(() => {
    console.log('[Preview] Playwright available - live preview enabled');
}).catch(() => {
    console.log('[Preview] Playwright not installed - running in mock mode');
});
app.use("/api/preview", previewRouter);

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

// GitHub Integration - OAuth and repository management
import githubRouter from './routes/github.js';
app.use("/api/github", githubRouter);

// Context Bridge - Codebase import and analysis
import contextBridgeRouter from './routes/context-bridge.js';
app.use("/api/context", requireCredits(25), contextBridgeRouter);

// Project Import - ZIP, GitHub, AI Builder imports
app.use("/api/import", importRouter);

// Browser Extension API - Import from extension, credential capture
import { extensionRouter } from './routes/extension.js';
app.use("/api/extension", extensionRouter);

// Production Stack Configuration - User app infrastructure setup
import productionStackRouter from './routes/production-stack.js';
app.use("/api/production-stack", productionStackRouter);

// Visual Editor - Point-and-Prompt Style Generation
import visualEditorRouter from './routes/visual-editor.js';
app.use("/api/visual-editor", promptSanitizer, requireCredits(15), visualEditorRouter);

// Builder Agent Activity Stream (SSE)
import agentRouter from './routes/agent.js';
app.use("/api/agent", agentRouter);

// Mobile Companion App - Device pairing, push notifications, deep linking
import mobileRouter from './routes/mobile.js';
app.use("/api/mobile", mobileRouter);

// Health Check Routes - Comprehensive infrastructure monitoring
app.use("/api/health", healthRouter);

// Cron Routes - Vercel scheduled tasks
app.use("/api/cron", cronRouter);

// Monitoring Routes - System observability
app.use("/api/monitoring", monitoringRouter);

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
    } catch (error) {
        console.error('[SelfHealing] Failed to initialize:', error);
    }
};

// Initialize on startup (but not blocking)
initializeSelfHealing();

// Register graceful shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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
    // Dual SDK Architecture - check for any AI provider
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;
    const hasAnyAIProvider = hasAnthropicKey || hasOpenAIKey || hasOpenRouterKey;

    res.json({
        ai: {
            enabled: hasAnyAIProvider,
            providers: {
                anthropic: hasAnthropicKey,
                openai: hasOpenAIKey,
                openrouter: hasOpenRouterKey,
            },
            models: ['claude-opus-4.5', 'claude-sonnet-4.5', 'gpt-5.2-pro', 'gpt-4o', 'gemini-2.5-flash'],
            heliconeEnabled: process.env.HELICONE_ENABLED !== 'false' && !!process.env.HELICONE_API_KEY,
            imageToCode: hasAnyAIProvider,
            selfHealing: hasAnyAIProvider,
            testGeneration: hasAnyAIProvider,
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

// Error logging middleware (logs to monitoring service)
app.use(errorLogger);

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
    // Initialize infrastructure in serverless mode (non-blocking)
    initializeInfrastructure().catch(console.error);
}

// Only listen when running directly (not on Vercel)
if (!process.env.VERCEL) {
    app.listen(port, async () => {
        console.log(`\n[Server] KripTik AI starting on http://localhost:${port}`);
        console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);

        // Pre-warm services
        warmupRouter();

        // Initialize production infrastructure
        await initializeInfrastructure();

        const services = validateCredentials();
        printStartupStatus(services);

        // Check for AI provider keys - Dual SDK Architecture
        const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
        const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
        const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;

        if (!hasAnthropicKey && !hasOpenAIKey && !hasOpenRouterKey) {
            console.log('================================================================');
            console.log('  No AI API keys set!');
            console.log('  AI code generation WILL NOT WORK.');
            console.log('  Set one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY');
            console.log('================================================================\n');
        } else {
            console.log('[AI] Active providers:', [
                hasAnthropicKey && 'Anthropic (Claude)',
                hasOpenAIKey && 'OpenAI (GPT)',
                hasOpenRouterKey && 'OpenRouter (fallback)',
            ].filter(Boolean).join(', '));
        }

        console.log('[Server] Ready to accept requests');
    });
}
// Production scaling infrastructure deployment

