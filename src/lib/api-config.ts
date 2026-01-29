/**
 * CENTRALIZED API CONFIGURATION
 *
 * CRITICAL: DO NOT MODIFY THIS FILE WITHOUT EXPLICIT USER PERMISSION
 *
 * This file is the SINGLE SOURCE OF TRUTH for API URLs across the entire frontend.
 * All components MUST import from here instead of hardcoding URLs.
 *
 * Why this exists:
 * - Prevents auth breaks when making unrelated changes
 * - Ensures consistent API URL across all components
 * - Makes it easy to update URLs in one place
 *
 * SAFARI/iOS FIX (2026-01-29):
 * Safari blocks ALL cross-site cookies via WebKit ITP, regardless of sameSite settings.
 * The ONLY reliable solution is to make all requests SAME-ORIGIN.
 *
 * In production:
 * - API_URL is EMPTY STRING ('') so requests go to /api/*
 * - Vercel rewrite: /api/* → api.kriptik.app/api/*
 * - From browser's perspective: same-origin (kriptik.app → kriptik.app)
 * - Cookies with sameSite:'lax' work correctly
 *
 * Last verified working: 2026-01-29
 */

/**
 * Backend API URL
 *
 * PRODUCTION: Empty string - uses Vercel rewrite for same-origin requests
 * DEVELOPMENT: Uses localhost:3001
 *
 * CRITICAL FOR iOS: Do NOT change this to a cross-origin URL in production!
 */
export const API_URL = import.meta.env.VITE_API_URL ??
    (import.meta.env.PROD ? '' : 'http://localhost:3001');

/**
 * Frontend URL
 *
 * Used for OAuth callbacks and redirects
 */
export const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://kriptik.app');

/**
 * Direct API URL
 *
 * Always points to the actual backend URL, even in production.
 * Used for OAuth callbacks that need the actual backend URL.
 * OAuth providers redirect directly to this URL, bypassing Vercel rewrite.
 */
export const DIRECT_API_URL =
    (import.meta.env.PROD ? 'https://api.kriptik.app' : 'http://localhost:3001');

/**
 * Fetch options for authenticated requests
 *
 * CRITICAL: credentials: 'include' is REQUIRED for cookies to work
 * DO NOT remove this or auth will break
 */
export const AUTH_FETCH_OPTIONS: RequestInit = {
    credentials: 'include',
    headers: {
        'Content-Type': 'application/json',
    },
};

/**
 * Create a fetch wrapper with auth credentials
 */
export function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    return fetch(url, {
        ...options,
        ...AUTH_FETCH_OPTIONS,
        headers: {
            ...AUTH_FETCH_OPTIONS.headers,
            ...options.headers,
        },
    });
}

// Log configuration on startup (for debugging)
if (typeof window !== 'undefined') {
    console.log('[API Config] API_URL:', API_URL);
    console.log('[API Config] FRONTEND_URL:', FRONTEND_URL);
    console.log('[API Config] Environment:', import.meta.env.MODE);
}
