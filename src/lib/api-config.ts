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
 * iOS MOBILE FIX (2026-01-15):
 * - Production now uses SAME-ORIGIN requests via Vercel rewrites
 * - /api/* routes are proxied to api.kriptik.app by vercel.json
 * - This bypasses WebKit ITP (Intelligent Tracking Prevention) cookie blocking
 * - Cookies with sameSite=lax now work because all requests are same-origin
 *
 * Last verified working: 2026-01-15
 */

/**
 * Backend API URL
 *
 * PRODUCTION: Uses empty string (same-origin via Vercel rewrite to api.kriptik.app)
 * DEVELOPMENT: Uses localhost:3001
 *
 * The Vercel rewrite in vercel.json proxies /api/* to https://api.kriptik.app/api/*
 * This makes all API requests same-origin from the browser's perspective,
 * which is REQUIRED for iOS Safari/Chrome cookie handling.
 */
export const API_URL = import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD ? '' : 'http://localhost:3001');

/**
 * Direct backend URL (for OAuth redirects that bypass the proxy)
 * OAuth callbacks go directly to api.kriptik.app, not through the proxy
 */
export const DIRECT_API_URL = import.meta.env.VITE_DIRECT_API_URL ||
    (import.meta.env.PROD ? 'https://api.kriptik.app' : 'http://localhost:3001');

/**
 * Frontend URL
 *
 * Used for OAuth callbacks and redirects
 */
export const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://kriptik.app');

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
