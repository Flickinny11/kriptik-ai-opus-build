import { createAuthClient } from "better-auth/react"
import { API_URL, FRONTEND_URL } from './api-config';

// =============================================================================
// AUTH CLIENT - iOS WebKit ITP Compatible
// =============================================================================
// WebKit's Intelligent Tracking Prevention (ITP) blocks cross-site fetch requests
// even with credentials:'include'. The solution is to use Vercel's rewrite proxy
// so requests appear same-origin to the browser.
//
// Flow with Vercel rewrite:
// 1. Frontend at kriptik.app makes request to kriptik.app/api/auth/...
// 2. Vercel rewrites to api.kriptik.app/api/auth/... (server-side)
// 3. Browser sees same-origin request → WebKit ITP allows it
// 4. OAuth callback goes directly to api.kriptik.app (top-level navigation, always allowed)
// 5. Cookie set with domain:.kriptik.app works for both domains
// =============================================================================

// Browser detection helpers (used by session retry logic and other components)
export const isMobile = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const isSafari = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return /Safari/i.test(ua) && !/Chrome/i.test(ua);
};

export const isIOS = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

export const isIOSSafari = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return /iPhone|iPad|iPod/i.test(ua) && /Safari/i.test(ua) && !/Chrome/i.test(ua);
};

export const isIOSChrome = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return /iPhone|iPad|iPod/i.test(ua) && /CriOS/i.test(ua);
};

// Determine if we should use same-origin requests (via Vercel rewrite)
// In production on kriptik.app, use relative URLs so Vercel proxies to api.kriptik.app
// This makes requests same-origin, bypassing WebKit ITP
const isProd = typeof window !== 'undefined' &&
    (window.location.hostname === 'kriptik.app' ||
     window.location.hostname.endsWith('.vercel.app'));

// In production, use empty baseURL for same-origin requests via Vercel rewrite
// In development, use API_URL directly (localhost doesn't have ITP issues)
const AUTH_BASE_URL = isProd ? '' : API_URL;

// Log browser detection for debugging
if (typeof navigator !== 'undefined') {
    console.log('[Auth Client] Browser detection:', {
        mobile: isMobile(),
        iOS: isIOS(),
        safari: isSafari(),
        iOSSafari: isIOSSafari(),
        iOSChrome: isIOSChrome(),
        isProd,
        authBaseUrl: AUTH_BASE_URL || '(same-origin via Vercel rewrite)',
    });
}

// Create auth client
// In production: empty baseURL = relative URLs = same-origin via Vercel rewrite
// This bypasses WebKit ITP which blocks cross-site fetch requests
export const authClient = createAuthClient({
    baseURL: AUTH_BASE_URL || undefined,
    fetchOptions: {
        credentials: "include",
    },
});

/**
 * Test auth connectivity - useful for debugging
 */
export async function testAuthConnection(): Promise<{
    ok: boolean;
    data?: any;
    error?: string;
}> {
    try {
        const response = await fetch(`${API_URL}/api/auth/test`, {
            credentials: 'include',
        });

        if (!response.ok) {
            return {
                ok: false,
                error: `HTTP ${response.status}: ${response.statusText}`,
            };
        }

        const data = await response.json();
        console.log('[Auth Client] Test result:', data);

        return { ok: true, data };
    } catch (error) {
        console.error('[Auth Client] Test failed:', error);
        return {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

// =============================================================================
// SOCIAL SIGN-IN - Using Better Auth's built-in methods
// =============================================================================
// OAuth flow works even on iOS because:
// 1. signIn.social() makes POST to /api/auth/sign-in/social
// 2. Better Auth returns redirect URL to Google/GitHub
// 3. Browser navigates to OAuth provider (top-level navigation - always allowed)
// 4. OAuth provider redirects back to callback
// 5. Callback sets cookie with domain:.kriptik.app and redirects to frontend
// =============================================================================

export const signInWithGoogle = async () => {
    const callbackURL = `${FRONTEND_URL}/dashboard`;

    console.log('[Auth] Starting Google sign-in...', {
        iOS: isIOS(),
        isProd,
        authBaseUrl: AUTH_BASE_URL || '(same-origin)',
        callbackURL,
    });

    try {
        // Use Better Auth's built-in social sign-in
        // This handles the OAuth flow correctly on all platforms
        const result = await authClient.signIn.social({
            provider: 'google',
            callbackURL,
        });

        console.log('[Auth] Google sign-in result:', JSON.stringify(result, null, 2));

        if (result?.error) {
            console.error('[Auth] Google sign-in error:', result.error);
            throw new Error(result.error.message || result.error.code || 'Google sign-in failed');
        }

        // Better Auth may return a URL for manual redirect
        const redirectUrl = (result as any)?.url || (result as any)?.redirect || (result as any)?.data?.url;
        if (redirectUrl && typeof redirectUrl === 'string') {
            console.log('[Auth] Redirecting to:', redirectUrl);
            window.location.href = redirectUrl;
        }
    } catch (error) {
        console.error('[Auth] Google sign-in error:', error);
        throw error;
    }
};

export const signInWithGitHub = async () => {
    const callbackURL = `${FRONTEND_URL}/dashboard`;

    console.log('[Auth] Starting GitHub sign-in...', {
        iOS: isIOS(),
        isProd,
        authBaseUrl: AUTH_BASE_URL || '(same-origin)',
        callbackURL,
    });

    try {
        // Use Better Auth's built-in social sign-in
        // This handles the OAuth flow correctly on all platforms
        const result = await authClient.signIn.social({
            provider: 'github',
            callbackURL,
        });

        console.log('[Auth] GitHub sign-in result:', JSON.stringify(result, null, 2));

        if (result?.error) {
            console.error('[Auth] GitHub sign-in error:', result.error);
            throw new Error(result.error.message || result.error.code || 'GitHub sign-in failed');
        }

        // Better Auth may return a URL for manual redirect
        const redirectUrl = (result as any)?.url || (result as any)?.redirect || (result as any)?.data?.url;
        if (redirectUrl && typeof redirectUrl === 'string') {
            console.log('[Auth] Redirecting to:', redirectUrl);
            window.location.href = redirectUrl;
        }
    } catch (error) {
        console.error('[Auth] GitHub sign-in error:', error);
        throw error;
    }
};

// ============================================================================
// EMAIL/PASSWORD AUTH - Uses Better Auth's built-in methods
// ============================================================================

export const signInWithEmail = async (email: string, password: string) => {
    console.log('[Auth] Signing in with email:', email, 'API_URL:', API_URL);

    try {
        const response = await authClient.signIn.email({
            email,
            password,
            callbackURL: '/dashboard',
        });

        console.log('[Auth] Email sign-in response:', JSON.stringify(response, null, 2));

        if (response.error) {
            console.error('[Auth] Email sign-in error:', response.error);
            throw new Error(response.error.message || response.error.code || 'Login failed');
        }

        if (!response.data) {
            console.error('[Auth] Email sign-in: no data returned');
            throw new Error('Login failed - no user data returned');
        }

        return response.data;
    } catch (error) {
        console.error('[Auth] Email sign-in exception:', error);
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(`Network error: Cannot reach auth server at ${API_URL}. Please check your connection.`);
        }
        throw error;
    }
};

export const signUp = async (email: string, password: string, name: string) => {
    console.log('[Auth] Signing up:', email, name, 'API_URL:', API_URL);

    try {
        const response = await authClient.signUp.email({
            email,
            password,
            name,
            callbackURL: '/dashboard',
        });

        console.log('[Auth] Signup response:', JSON.stringify(response, null, 2));

        if (response.error) {
            console.error('[Auth] Signup error:', response.error);
            throw new Error(response.error.message || response.error.code || 'Signup failed');
        }

        if (!response.data) {
            console.error('[Auth] Signup: no data returned');
            throw new Error('Signup failed - no user data returned');
        }

        return response.data;
    } catch (error) {
        console.error('[Auth] Signup exception:', error);
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(`Network error: Cannot reach auth server at ${API_URL}. Please check your connection.`);
        }
        throw error;
    }
};

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

export const signOut = async () => {
    console.log('[Auth] Signing out...');

    try {
        await authClient.signOut();
        console.log('[Auth] Sign out successful');
    } catch (error) {
        console.warn('[Auth] Sign out error (continuing anyway):', error);
    }

    // Clear any local storage
    try {
        localStorage.removeItem('kriptik_user');
        localStorage.removeItem('kriptik_user_id');
    } catch (e) {
        console.warn('[Auth] Failed to clear local storage:', e);
    }
};

export const getSession = async () => {
    console.log('[Auth] Getting session...');

    // Helper function to attempt session fetch
    const attemptGetSession = async () => {
        const session = await authClient.getSession();
        return session;
    };

    try {
        let session = await attemptGetSession();

        // SAFARI FIX: If no session and we're on Safari, retry after a short delay
        // Safari sometimes needs more time for cookies to be accessible after redirect
        if (!session.data && isSafari()) {
            console.log('[Auth] Safari detected - retrying session fetch after delay...');
            await new Promise(resolve => setTimeout(resolve, 300));
            session = await attemptGetSession();

            // If still no session, try one more time with longer delay
            if (!session.data && isIOSSafari()) {
                console.log('[Auth] iOS Safari detected - final retry with longer delay...');
                await new Promise(resolve => setTimeout(resolve, 500));
                session = await attemptGetSession();
            }
        }

        if (session.data) {
            console.log('[Auth] Session data:', session.data);
            return { data: session.data, error: null };
        }

        console.log('[Auth] No active session');
        return { data: null, error: null };
    } catch (error) {
        console.error('[Auth] Get session error:', error);
        return { data: null, error };
    }
};
