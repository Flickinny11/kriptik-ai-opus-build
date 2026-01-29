import { createAuthClient } from "better-auth/react"
import { API_URL, FRONTEND_URL } from './api-config';

// =============================================================================
// AUTH CLIENT - SAFARI/iOS FIX (2026-01-29)
// =============================================================================
// Safari blocks ALL cross-site cookies via WebKit ITP, regardless of sameSite.
//
// THE FIX:
// - In production, API_URL is EMPTY STRING ('')
// - All requests go to /api/* (same-origin from browser's perspective)
// - Vercel rewrites /api/* → api.kriptik.app/api/*
// - Cookies with sameSite:'lax' work correctly
//
// This bypasses Safari's ITP because everything is same-origin!
// =============================================================================

// Browser detection helpers (for debugging and Safari-specific retry logic)
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

// Log browser detection for debugging
if (typeof navigator !== 'undefined') {
    console.log('[Auth Client] Browser detection:', {
        mobile: isMobile(),
        iOS: isIOS(),
        safari: isSafari(),
        iOSSafari: isIOSSafari(),
        iOSChrome: isIOSChrome(),
        apiUrl: API_URL || '(same-origin via Vercel rewrite)',
        isProd: import.meta.env.PROD,
    });
}

// Create auth client with same-origin configuration
// CRITICAL: In production, API_URL is '' (empty string) so requests are same-origin
export const authClient = createAuthClient({
    // Empty string means relative URLs, which go through Vercel rewrite
    baseURL: API_URL || undefined,
    fetchOptions: {
        credentials: "include", // Required for cookie handling
        cache: "no-store" as RequestCache, // Safari fix: prevents stale cookie issues
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
        // Use relative URL in production (same-origin via Vercel rewrite)
        const testUrl = API_URL ? `${API_URL}/api/auth/test` : '/api/auth/test';
        console.log('[Auth Client] Testing connection to:', testUrl);

        const response = await fetch(testUrl, {
            credentials: 'include',
            cache: 'no-store',
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
// SOCIAL SIGN-IN - SAFARI/iOS FIX (2026-01-29)
// =============================================================================
// OAuth flow works on ALL platforms including iOS because:
// 1. signIn.social() makes POST to /api/auth/sign-in/social (same-origin via rewrite)
// 2. Better Auth returns redirect URL to Google/GitHub
// 3. Browser navigates to OAuth provider (top-level navigation - always allowed)
// 4. OAuth provider redirects to api.kriptik.app/api/auth/callback/...
// 5. Callback sets cookie with domain:.kriptik.app (top-level nav - allowed)
// 6. Redirect to kriptik.app/dashboard
// 7. Dashboard fetches /api/auth/session (same-origin - cookie sent!)
// =============================================================================

export const signInWithGoogle = async () => {
    const callbackURL = `${FRONTEND_URL}/dashboard`;

    console.log('[Auth] Starting Google sign-in...', {
        iOS: isIOS(),
        isSafari: isSafari(),
        apiUrl: API_URL || '(same-origin)',
        callbackURL,
    });

    try {
        // Use Better Auth's built-in social sign-in
        // Requests go through Vercel rewrite in production (same-origin)
        const result = await authClient.signIn.social({
            provider: 'google',
            callbackURL,
        });

        console.log('[Auth] Google sign-in result:', JSON.stringify(result, null, 2));

        if (result?.error) {
            console.error('[Auth] Google sign-in error:', result.error);
            throw new Error(result.error.message || result.error.code || 'Google sign-in failed');
        }

        // Better Auth returns URL for redirect - navigate to it
        const redirectUrl = (result as any)?.url || (result as any)?.redirect || (result as any)?.data?.url;
        if (redirectUrl && typeof redirectUrl === 'string') {
            console.log('[Auth] Redirecting to OAuth provider:', redirectUrl);
            window.location.href = redirectUrl;
        } else {
            console.warn('[Auth] No redirect URL in response - OAuth may have auto-redirected');
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
        isSafari: isSafari(),
        apiUrl: API_URL || '(same-origin)',
        callbackURL,
    });

    try {
        // Use Better Auth's built-in social sign-in
        // Requests go through Vercel rewrite in production (same-origin)
        const result = await authClient.signIn.social({
            provider: 'github',
            callbackURL,
        });

        console.log('[Auth] GitHub sign-in result:', JSON.stringify(result, null, 2));

        if (result?.error) {
            console.error('[Auth] GitHub sign-in error:', result.error);
            throw new Error(result.error.message || result.error.code || 'GitHub sign-in failed');
        }

        // Better Auth returns URL for redirect - navigate to it
        const redirectUrl = (result as any)?.url || (result as any)?.redirect || (result as any)?.data?.url;
        if (redirectUrl && typeof redirectUrl === 'string') {
            console.log('[Auth] Redirecting to OAuth provider:', redirectUrl);
            window.location.href = redirectUrl;
        } else {
            console.warn('[Auth] No redirect URL in response - OAuth may have auto-redirected');
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
    console.log('[Auth] Signing in with email:', email, 'apiUrl:', API_URL || '(same-origin)');

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
            throw new Error('Network error: Cannot reach auth server. Please check your connection.');
        }
        throw error;
    }
};

export const signUp = async (email: string, password: string, name: string) => {
    console.log('[Auth] Signing up:', email, name, 'apiUrl:', API_URL || '(same-origin)');

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
            throw new Error('Network error: Cannot reach auth server. Please check your connection.');
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
