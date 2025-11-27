import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from './db.js';
import * as schema from './schema.js';

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
});
