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
const backendUrl = process.env.BETTER_AUTH_URL || 'https://kriptik-ai-opus-build-backend.vercel.app';
const frontendUrl = process.env.FRONTEND_URL || 'https://kriptik-ai-opus-build.vercel.app';

const socialProviders: Record<string, { clientId: string; clientSecret: string; redirectURI?: string }> = {};

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    socialProviders.github = {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        redirectURI: `${backendUrl}/api/auth/callback/github`,
    };
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectURI: `${backendUrl}/api/auth/callback/google`,
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
        // Cross-site cookie settings for OAuth
        crossSubDomainCookies: {
            enabled: false, // Disable since frontend/backend are different domains
        },
        // Cookie settings for cross-origin
        cookiePrefix: "kriptik_auth",
        // Generate unique state for each OAuth request
        generateState: true,
    },

    // Trust proxy for Vercel
    trustedOrigins: [
        "https://kriptik-ai-opus-build.vercel.app",
        "https://kriptik-ai-opus-build-backend.vercel.app",
        process.env.FRONTEND_URL || "",
    ].filter(Boolean),

    // Rate limiting (optional but recommended)
    rateLimit: {
        window: 60, // 1 minute
        max: 100, // Max requests per window
    },

    // Callbacks for security validation
    callbacks: {
        // Validate redirect URLs after OAuth - redirect to frontend
        async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
            // Always redirect to frontend dashboard after OAuth
            // This bypasses any encoding issues with callback URLs
            const dashboardUrl = `${frontendUrl}/dashboard`;

            // If URL is relative path on our frontend, use it
            if (url.startsWith('/')) {
                return `${frontendUrl}${url}`;
            }

            // If URL is already our frontend, allow it
            if (url.startsWith(frontendUrl)) {
                return url;
            }

            // For any other case, go to dashboard
            console.log(`[Auth] OAuth redirect to: ${dashboardUrl} (original: ${url})`);
            return dashboardUrl;
        },
    },
});
