import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, client } from './db.js';
import * as schema from './schema.js';

// ============================================================================
// DATABASE CONNECTIVITY CHECK
// ============================================================================

/**
 * Test database connection and table existence
 */
export async function testDatabaseConnection(): Promise<{
    connected: boolean;
    tables: string[];
    error?: string;
}> {
    try {
        // Test basic connectivity
        const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
        const tables = result.rows.map((row: any) => row.name as string);

        console.log('[Auth] Database tables found:', tables);

        return {
            connected: true,
            tables,
        };
    } catch (error) {
        console.error('[Auth] Database connection test failed:', error);
        return {
            connected: false,
            tables: [],
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Ensure auth tables exist (for debugging)
 */
export async function ensureAuthTables(): Promise<void> {
    const requiredTables = ['users', 'session', 'account', 'verification'];
    const { tables } = await testDatabaseConnection();

    const missingTables = requiredTables.filter(t => !tables.includes(t));

    if (missingTables.length > 0) {
        console.warn('[Auth] Missing tables:', missingTables);
        console.warn('[Auth] Run: npx drizzle-kit push to create tables');
    } else {
        console.log('[Auth] All required auth tables exist');
    }
}

// ============================================================================
// REDIRECT URL VALIDATION
// ============================================================================

/**
 * Allowed redirect URL patterns for OAuth callbacks
 * Prevents open redirect vulnerabilities
 */
const ALLOWED_REDIRECT_PATTERNS = [
    // ==========================================================================
    // PRODUCTION CUSTOM DOMAIN - kriptik.app
    // ==========================================================================
    /^https:\/\/kriptik\.app(\/.*)?$/,
    /^https:\/\/www\.kriptik\.app(\/.*)?$/,
    /^https:\/\/[a-z0-9-]+\.kriptik\.app(\/.*)?$/,  // Subdomains

    // ==========================================================================
    // VERCEL DEPLOYMENTS
    // ==========================================================================
    // Production frontend (Vercel)
    /^https:\/\/kriptik-ai-opus-build\.vercel\.app(\/.*)?$/,
    /^https:\/\/kriptik-ai\.vercel\.app(\/.*)?$/,
    // Vercel preview deployments
    /^https:\/\/kriptik-ai-opus-build-[a-z0-9]+-logans-projects-[a-z0-9]+\.vercel\.app(\/.*)?$/,
    /^https:\/\/kriptik-ai-opus-build-[a-z0-9-]+\.vercel\.app(\/.*)?$/,
    /^https:\/\/[a-z0-9-]*kriptik[a-z0-9-]*\.vercel\.app(\/.*)?$/,

    // ==========================================================================
    // DEVELOPMENT
    // ==========================================================================
    /^http:\/\/localhost:\d+(\/.*)?$/,
    /^http:\/\/127\.0\.0\.1:\d+(\/.*)?$/,
    // Custom domain (if configured)
    ...(process.env.FRONTEND_URL ? [new RegExp(`^${process.env.FRONTEND_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\/.*)?$`)] : []),
];

/**
 * Validate a redirect URL against allowed patterns
 */
export function isValidRedirectUrl(url: string | undefined | null): boolean {
    if (!url) return true; // No redirect, use default

    try {
        // Decode URL if it's encoded
        const decodedUrl = decodeURIComponent(url);
        const parsed = new URL(decodedUrl);

        // Block javascript: protocol (XSS)
        if (parsed.protocol === 'javascript:') return false;

        // Block data: protocol
        if (parsed.protocol === 'data:') return false;

        // Check against allowed patterns (try both original and decoded)
        const urlsToCheck = [url, decodedUrl];
        for (const urlToCheck of urlsToCheck) {
            if (ALLOWED_REDIRECT_PATTERNS.some(pattern => pattern.test(urlToCheck))) {
                return true;
            }
        }

        // Log for debugging
        console.log('[Auth] Redirect URL validation failed:', url);
        return false;
    } catch (e) {
        // Try without URL parsing for relative paths
        if (url.startsWith('/')) return true;
        console.log('[Auth] Invalid redirect URL:', url, e);
        return false;
    }
}

/**
 * Sanitize redirect URL - returns safe default if invalid
 */
export function sanitizeRedirectUrl(url: string | undefined | null): string {
    const defaultUrl = process.env.FRONTEND_URL || 'https://kriptik-ai-opus-build.vercel.app';

    if (!url) return defaultUrl;
    if (!isValidRedirectUrl(url)) return defaultUrl;

    return url;
}

// ============================================================================
// SOCIAL PROVIDERS
// ============================================================================

// Build social providers conditionally - only include if credentials are set
const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
const vercelDetectedBaseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
const backendUrl =
    process.env.BETTER_AUTH_URL ||
    process.env.BACKEND_URL ||
    vercelDetectedBaseUrl ||
    (isProd ? 'https://kriptik-ai-opus-build-backend.vercel.app' : 'http://localhost:3001');
const frontendUrl =
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_FRONTEND_URL ||
    (isProd ? 'https://kriptik-ai-opus-build.vercel.app' : 'http://localhost:5173');

// If frontend + backend share the same eTLD+1 (kriptik.app), we should use first-party
// cookie semantics to maximize compatibility with embedded browsers and iOS Safari.
const isKriptikSameSite = (() => {
    try {
        const b = new URL(backendUrl);
        const f = new URL(frontendUrl);
        const isKriptikApexOrSub = (host: string) => host === 'kriptik.app' || host.endsWith('.kriptik.app');
        return isKriptikApexOrSub(b.hostname) && isKriptikApexOrSub(f.hostname);
    } catch {
        return false;
    }
})();

const cookieSameSite = (isKriptikSameSite ? 'lax' : 'none') as 'lax' | 'none';

const socialProviders: Record<string, { clientId: string; clientSecret: string; redirectURI?: string }> = {};

const githubClientId = process.env.GITHUB_CLIENT_ID || process.env.GITHUB_ID || process.env.AUTH_GITHUB_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET || process.env.GITHUB_SECRET || process.env.AUTH_GITHUB_SECRET;

if (githubClientId && githubClientSecret) {
    socialProviders.github = {
        clientId: githubClientId,
        clientSecret: githubClientSecret,
        redirectURI: `${backendUrl}/api/auth/callback/github`,
    };
}

const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_ID || process.env.AUTH_GOOGLE_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_SECRET || process.env.AUTH_GOOGLE_SECRET;

if (googleClientId && googleClientSecret) {
    socialProviders.google = {
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        redirectURI: `${backendUrl}/api/auth/callback/google`,
    };
}

console.log('[Auth] Social providers configured:', Object.keys(socialProviders));
console.log('[Auth] Frontend URL:', frontendUrl);
console.log('[Auth] Backend URL:', backendUrl);
console.log('[Auth] Is same-site (kriptik.app):', isKriptikSameSite);
console.log('[Auth] Cookie SameSite setting:', cookieSameSite);
console.log('[Auth] Is production:', isProd);

// Log configuration on startup
console.log('[Auth] Initializing Better Auth...');
console.log('[Auth] BETTER_AUTH_SECRET set:', !!process.env.BETTER_AUTH_SECRET);
console.log('[Auth] BETTER_AUTH_URL:', process.env.BETTER_AUTH_URL);
console.log('[Auth] FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('[Auth] Backend URL resolved to:', backendUrl);
console.log('[Auth] Frontend URL resolved to:', frontendUrl);

// Validate critical configuration
if (!process.env.BETTER_AUTH_SECRET) {
    console.error('[Auth] CRITICAL: BETTER_AUTH_SECRET is not set! Auth will fail.');
}

// Check tables on startup (non-blocking)
ensureAuthTables().catch(console.error);

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "sqlite", // Turso uses SQLite protocol
        // CRITICAL: Schema keys MUST match the modelName values below
        // Better Auth looks up schema[modelName] so keys must be: users, session, account, verification
        schema: {
            users: schema.users,              // Key matches modelName "users"
            session: schema.sessions,         // Key matches modelName "session" (default)
            account: schema.accounts,         // Key matches modelName "account"
            verification: schema.verifications, // Key matches modelName "verification"
        },
    }),

    // Tell Better Auth the actual SQL table names
    // CRITICAL: These modelName values MUST match the schema keys above
    user: {
        modelName: "users", // SQL table is 'users' (plural) - schema key must also be "users"
    },
    account: {
        modelName: "account", // SQL table is 'account' (singular)
    },
    verification: {
        modelName: "verification", // SQL table is 'verification' (singular)
    },

    // Base path for auth routes
    basePath: "/api/auth",

    // Secret for signing tokens (REQUIRED)
    secret: process.env.BETTER_AUTH_SECRET,

    // Base URL for callbacks
    baseURL: backendUrl,

    // Email/Password authentication
    emailAndPassword: {
        enabled: true,
        // Add password requirements
        minPasswordLength: 8,
        // Enable signup
        requireEmailVerification: false,
    },

    // Social providers (only those with credentials)
    socialProviders,

    // Session configuration (includes modelName for SQL table mapping)
    session: {
        modelName: "session", // SQL table is 'session' (singular)
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // Update session every 24 hours
        cookieCache: {
            enabled: true,
            maxAge: 60 * 5, // 5 minutes
        },
    },

    // Advanced configuration - SIMPLIFIED for maximum compatibility
    advanced: {
        // NO useSecureCookies - avoids __Secure- prefix issues
        useSecureCookies: false,

        // NO crossSubDomainCookies - we set domain directly below

        // Cookie name prefix
        cookiePrefix: "kriptik_auth",

        // Default cookie attributes - EXPLICIT domain setting
        defaultCookieAttributes: {
            // CRITICAL: Use calculated sameSite (Lax for same-site, None for cross-site)
            // SameSite=None REQUIRES Secure=true for embedded browsers and mobile Safari
            sameSite: cookieSameSite,
            secure: cookieSameSite === 'none' ? true : (isProd ? true : false), // Always Secure in prod, required for None
            httpOnly: true,
            path: "/",
            maxAge: 60 * 60 * 24 * 7, // 7 days
            // CRITICAL: Explicit domain for cross-subdomain (api.kriptik.app <-> kriptik.app)
            // Only set domain in production when both are on kriptik.app
            domain: (isProd && isKriptikSameSite) ? '.kriptik.app' : undefined,
        },
    },

    // Trusted origins can be dynamic (Better Auth supports a callback).
    // This fixes local dev when Vite auto-increments ports and supports Vercel previews safely.
    trustedOrigins: (request: Request) => {
        const origin = request.headers.get('origin') || '';

        const allowedExact = new Set<string>([
            // ==========================================================================
            // PRODUCTION CUSTOM DOMAIN - kriptik.app
            // ==========================================================================
            'https://kriptik.app',
            'https://www.kriptik.app',

            // ==========================================================================
            // VERCEL DEPLOYMENTS
            // ==========================================================================
            // Production frontend (Vercel)
            'https://kriptik-ai-opus-build.vercel.app',
            'https://kriptik-ai.vercel.app',
            // Backend URL(s)
            'https://kriptik-ai-opus-build-backend.vercel.app',
            backendUrl,
            // Frontend URL(s)
            frontendUrl,

            // ==========================================================================
            // DEVELOPMENT
            // ==========================================================================
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:5173',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:5173',
        ].filter(Boolean));

        // Always include exacts; if request origin is a safe localhost port, include it too.
        if (/^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
            allowedExact.add(origin);
        }

        // Allow kriptik.app subdomains
        if (/^https:\/\/([a-z0-9-]+\.)?kriptik\.app$/.test(origin)) {
            allowedExact.add(origin);
        }

        // Allow Vercel previews (frontend + backend variations)
        if (
            /^https:\/\/kriptik-ai-opus-build-[a-z0-9-]+\.vercel\.app$/.test(origin) ||
            /^https:\/\/kriptik-ai-[a-z0-9-]+\.vercel\.app$/.test(origin) ||
            /^https:\/\/[a-z0-9-]*kriptik[a-z0-9-]*\.vercel\.app$/.test(origin)
        ) {
            allowedExact.add(origin);
        }

        return Array.from(allowedExact);
    },

    // Rate limiting - increased for viral traffic capacity
    // Auth endpoints need high limits since every page load checks session
    rateLimit: {
        window: 60, // 1 minute
        max: 2000, // Increased from 100 - supports ~33 auth checks/second per IP
    },

    // Callbacks for security validation
    callbacks: {
        // Validate redirect URLs after OAuth - redirect to frontend
        async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
            console.log(`[Auth] Redirect callback called - url: ${url}, baseUrl: ${baseUrl}`);

            // Respect the callbackURL provided by the client *if it matches our allowlist*.
            // This is critical for Vercel previews and local dev where ports change.
            const safe = sanitizeRedirectUrl(url);

            if (safe.startsWith('/')) {
                const finalUrl = `${frontendUrl}${safe}`;
                console.log(`[Auth] Relative safe redirect, redirecting to: ${finalUrl}`);
                return finalUrl;
            }

            // If safe is the backend (or root), fall back to frontend dashboard.
            if (safe.startsWith(backendUrl) || safe === baseUrl || safe === '/' || safe === backendUrl) {
                const dashboardUrl = `${frontendUrl}/dashboard`;
                console.log(`[Auth] Backend/root safe redirect detected, redirecting to dashboard: ${dashboardUrl}`);
                return dashboardUrl;
            }

            console.log(`[Auth] Redirecting to safe URL: ${safe}`);
            return safe;
        },
    },
});
