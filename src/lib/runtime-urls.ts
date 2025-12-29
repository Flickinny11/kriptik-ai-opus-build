/**
 * Runtime URL helpers
 *
 * Auth is extremely sensitive to origin/cookie domain. In production and Vercel
 * previews we always prefer same-origin calls (via `/api` rewrites) so cookies
 * remain first-party and mobile browsers don't block them.
 */
export function getApiBaseUrl(): string {
    const envUrl = import.meta.env.VITE_API_URL;

    // In the browser, prefer same-origin for any non-localhost deployment.
    if (typeof window !== 'undefined') {
        const host = window.location.hostname;
        const isLocal = host === 'localhost' || host === '127.0.0.1';

        // For deployed environments (kriptik.app, *.vercel.app, etc.), use same-origin
        // and rely on the platform rewrite/proxy for `/api/*`.
        if (!isLocal) return window.location.origin;
    }

    // Local dev fallback (separate API server) or explicit override.
    return envUrl || 'http://localhost:3001';
}

export function getFrontendOrigin(): string {
    if (typeof window !== 'undefined') return window.location.origin;
    return import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173';
}

