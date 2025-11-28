import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from './db.js';
import * as schema from './schema.js';

// ============================================================================
// REDIRECT URL VALIDATION
// ============================================================================

/**
 * Allowed redirect URL patterns for OAuth callbacks
 * Prevents open redirect vulnerabilities
 */
const ALLOWED_REDIRECT_PATTERNS = [
    // Production frontend
    /^https:\/\/kriptik-ai-opus-build\.vercel\.app(\/.*)?$/,
    /^https:\/\/kriptik-ai\.vercel\.app(\/.*)?$/,
    // Vercel preview deployments
    /^https:\/\/kriptik-ai-opus-build-[a-z0-9]+-logans-projects-[a-z0-9]+\.vercel\.app(\/.*)?$/,
    // Development
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
        const parsed = new URL(url);

        // Block javascript: protocol (XSS)
        if (parsed.protocol === 'javascript:') return false;

        // Block data: protocol
        if (parsed.protocol === 'data:') return false;

        // Check against allowed patterns
        return ALLOWED_REDIRECT_PATTERNS.some(pattern => pattern.test(url));
    } catch {
        // Invalid URL
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
const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    socialProviders.github = {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
    };
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
}

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "sqlite", // Turso uses SQLite protocol
        schema: {
            ...schema,
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
    baseURL: process.env.BETTER_AUTH_URL || "https://kriptik-ai-opus-build-backend.vercel.app",

    // Email/Password authentication
    emailAndPassword: {
        enabled: true,
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
        // Use secure cookies in production
        useSecureCookies: process.env.NODE_ENV === "production",
        // Cross-site cookie settings
        crossSubDomainCookies: {
            enabled: process.env.NODE_ENV === "production",
            domain: process.env.COOKIE_DOMAIN || undefined,
        },
    },

    // Rate limiting (optional but recommended)
    rateLimit: {
        window: 60, // 1 minute
        max: 100, // Max requests per window
    },

    // Callbacks for security validation
    callbacks: {
        // Validate redirect URLs before OAuth redirect
        async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
            // If the URL is relative, allow it
            if (url.startsWith('/')) return url;

            // Validate against allowed patterns
            if (isValidRedirectUrl(url)) {
                return url;
            }

            // Fall back to base URL for invalid redirects
            console.warn(`Blocked invalid redirect URL: ${url}`);
            return baseUrl;
        },
    },
});
