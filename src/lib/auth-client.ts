import { createAuthClient } from "better-auth/react"
import { API_URL, FRONTEND_URL, DIRECT_API_URL } from './api-config';

// Note: API_URL and FRONTEND_URL are imported from centralized config
// iOS MOBILE FIX (2026-01-15):
// - In production, API_URL is empty string (same-origin via Vercel rewrite)
// - This bypasses WebKit ITP which was blocking cross-site requests
// - DIRECT_API_URL is used for OAuth redirects that need the actual backend URL

// Detect if we're on mobile
export const isMobile = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Detect Safari (for special cookie handling)
export const isSafari = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return /Safari/i.test(ua) && !/Chrome/i.test(ua);
};

// Detect iOS (includes Chrome on iOS which uses WebKit)
export const isIOS = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

// Detect iOS Safari (strictest cookie handling)
export const isIOSSafari = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return /iPhone|iPad|iPod/i.test(ua) && /Safari/i.test(ua) && !/Chrome/i.test(ua);
};

// Detect iOS Chrome (uses WebKit, same restrictions as Safari)
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
        apiUrl: API_URL || '(same-origin)',
        directApiUrl: DIRECT_API_URL,
    });
}

// Create auth client with proper config
// In production, API_URL is empty so requests go through Vercel rewrite (same-origin)
export const authClient = createAuthClient({
    baseURL: API_URL || undefined, // undefined = relative URLs (same-origin)
    fetchOptions: {
        credentials: "include",
        // Safari requires explicit cache control for cookie handling
        cache: "no-store" as RequestCache,
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

// ============================================================================
// SOCIAL SIGN-IN - iOS MOBILE FIX (2026-01-15)
//
// On iOS (Safari and Chrome which both use WebKit), we use DIRECT NAVIGATION
// instead of fetch requests. This bypasses WebKit's ITP which can block
// cross-site fetch requests even with credentials: 'include'.
//
// Direct navigation (window.location.href) is ALWAYS allowed because it's
// a top-level navigation, not a background fetch. The OAuth flow naturally
// uses redirects, so this works perfectly.
// ============================================================================

/**
 * Build the OAuth URL for direct navigation
 * This is used on iOS where fetch-based OAuth initiation can be blocked
 */
function buildOAuthUrl(provider: 'google' | 'github', callbackURL: string): string {
    // Use DIRECT_API_URL for OAuth since the callback comes from the OAuth provider
    // directly to the backend, not through the Vercel proxy
    const baseUrl = DIRECT_API_URL || API_URL || '';
    const encodedCallback = encodeURIComponent(callbackURL);
    // FIX (2026-01-29): Better Auth uses /sign-in/social with provider param, NOT /sign-in/{provider}
    // The old URL /sign-in/google returned 404 because that endpoint doesn't exist
    return `${baseUrl}/api/auth/sign-in/social?provider=${provider}&callbackURL=${encodedCallback}`;
}

export const signInWithGoogle = async () => {
    // Use full frontend URL for callback to ensure redirect goes to frontend, not backend
    const callbackURL = `${FRONTEND_URL}/dashboard`;

    console.log('[Auth] Starting Google sign-in...', {
        iOS: isIOS(),
        iOSChrome: isIOSChrome(),
        apiUrl: API_URL || '(same-origin)',
        directApiUrl: DIRECT_API_URL,
        callbackURL,
    });

    // iOS FIX: Use direct navigation instead of fetch
    // This bypasses WebKit ITP which blocks cross-site fetch with credentials
    if (isIOS()) {
        console.log('[Auth] iOS detected - using direct navigation for OAuth');
        const oauthUrl = buildOAuthUrl('google', callbackURL);
        console.log('[Auth] Navigating to:', oauthUrl);
        window.location.href = oauthUrl;
        return;
    }

    try {
        // Use Better Auth's built-in social sign-in
        // This handles the OAuth flow and redirects automatically
        const result = await authClient.signIn.social({
            provider: 'google',
            callbackURL, // Use full URL to ensure redirect to frontend
        });

        console.log('[Auth] Google sign-in result:', JSON.stringify(result, null, 2));

        // Check for error in result
        if (result?.error) {
            console.error('[Auth] Google sign-in error in result:', result.error);
            throw new Error(result.error.message || result.error.code || 'Google sign-in failed');
        }

        // Check if result contains a URL we need to redirect to manually
        // Some Better Auth versions/configs return the URL instead of auto-redirecting
        const redirectUrl = (result as any)?.url || (result as any)?.redirect || (result as any)?.data?.url;
        if (redirectUrl && typeof redirectUrl === 'string') {
            console.log('[Auth] Manual redirect required to:', redirectUrl);
            window.location.href = redirectUrl;
            return;
        }

        // If we get here with no redirect and no error, log the full result for debugging
        console.log('[Auth] No redirect occurred. Full result:', result);

    } catch (error) {
        console.error('[Auth] Google sign-in error:', error);

        // FALLBACK: On any network error, try direct navigation as fallback
        if (error instanceof TypeError && error.message.includes('fetch')) {
            console.log('[Auth] Fetch failed - falling back to direct navigation');
            const oauthUrl = buildOAuthUrl('google', callbackURL);
            window.location.href = oauthUrl;
            return;
        }

        throw error;
    }
};

export const signInWithGitHub = async () => {
    // Use full frontend URL for callback to ensure redirect goes to frontend, not backend
    const callbackURL = `${FRONTEND_URL}/dashboard`;

    console.log('[Auth] Starting GitHub sign-in...', {
        iOS: isIOS(),
        iOSChrome: isIOSChrome(),
        apiUrl: API_URL || '(same-origin)',
        directApiUrl: DIRECT_API_URL,
        callbackURL,
    });

    // iOS FIX: Use direct navigation instead of fetch
    // This bypasses WebKit ITP which blocks cross-site fetch with credentials
    if (isIOS()) {
        console.log('[Auth] iOS detected - using direct navigation for OAuth');
        const oauthUrl = buildOAuthUrl('github', callbackURL);
        console.log('[Auth] Navigating to:', oauthUrl);
        window.location.href = oauthUrl;
        return;
    }

    try {
        // Use Better Auth's built-in social sign-in
        // This handles the OAuth flow and redirects automatically
        const result = await authClient.signIn.social({
            provider: 'github',
            callbackURL, // Use full URL to ensure redirect to frontend
        });

        console.log('[Auth] GitHub sign-in result:', JSON.stringify(result, null, 2));

        // Check for error in result
        if (result?.error) {
            console.error('[Auth] GitHub sign-in error in result:', result.error);
            throw new Error(result.error.message || result.error.code || 'GitHub sign-in failed');
        }

        // Check if result contains a URL we need to redirect to manually
        // Some Better Auth versions/configs return the URL instead of auto-redirecting
        const redirectUrl = (result as any)?.url || (result as any)?.redirect || (result as any)?.data?.url;
        if (redirectUrl && typeof redirectUrl === 'string') {
            console.log('[Auth] Manual redirect required to:', redirectUrl);
            window.location.href = redirectUrl;
            return;
        }

        // If we get here with no redirect and no error, log the full result for debugging
        console.log('[Auth] No redirect occurred. Full result:', result);

    } catch (error) {
        console.error('[Auth] GitHub sign-in error:', error);

        // FALLBACK: On any network error, try direct navigation as fallback
        if (error instanceof TypeError && error.message.includes('fetch')) {
            console.log('[Auth] Fetch failed - falling back to direct navigation');
            const oauthUrl = buildOAuthUrl('github', callbackURL);
            window.location.href = oauthUrl;
            return;
        }

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
