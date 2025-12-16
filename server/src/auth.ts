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

// Log configuration on startup
console.log('[Auth] Initializing Better Auth...');
console.log('[Auth] BETTER_AUTH_SECRET set:', !!process.env.BETTER_AUTH_SECRET);
console.log('[Auth] BETTER_AUTH_URL:', process.env.BETTER_AUTH_URL);
console.log('[Auth] FRONTEND_URL:', process.env.FRONTEND_URL);

// Check tables on startup (non-blocking)
ensureAuthTables().catch(console.error);

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "sqlite", // Turso uses SQLite protocol
        schema: {
            // Map Better Auth expected names to our schema
            user: schema.users,
            session: schema.sessions,
            account: schema.accounts,
            verification: schema.verifications,
        },
    }),

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

    // Session configuration
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // Update session every 24 hours
        cookieCache: {
            enabled: true,
            maxAge: 60 * 5, // 5 minutes
        },
    },

    // Advanced configuration
    advanced: {
        // Use secure cookies in production (required for SameSite=None)
        useSecureCookies: process.env.NODE_ENV === 'production' || process.env.VERCEL === '1',
        // Cross-site cookie settings - MUST be enabled for cross-origin auth
        crossSubDomainCookies: {
            enabled: false, // Different domains, not subdomains
        },
        // Cookie settings for cross-origin
        cookiePrefix: "kriptik_auth",
        // Default cookie options for cross-origin (mobile compatible)
        defaultCookieAttributes: {
            sameSite: "none" as const, // Required for cross-origin requests
            secure: true, // Required when sameSite is "none"
            httpOnly: true,
            path: "/",
            // maxAge for better mobile compatibility
            maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
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

    // Rate limiting (optional but recommended)
    rateLimit: {
        window: 60, // 1 minute
        max: 100, // Max requests per window
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
