import { createAuthClient } from "better-auth/react"
import { API_URL, FRONTEND_URL } from './api-config';

// Note: API_URL and FRONTEND_URL are imported from centralized config
// This ensures production fallback to https://api.kriptik.app (not localhost)
// See src/lib/api-config.ts for the source of truth

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

// Detect iOS Safari (strictest cookie handling)
export const isIOSSafari = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return /iPhone|iPad|iPod/i.test(ua) && /Safari/i.test(ua) && !/Chrome/i.test(ua);
};

// Log browser detection for debugging
if (typeof navigator !== 'undefined') {
    console.log('[Auth Client] Browser detection - Mobile:', isMobile(), 'Safari:', isSafari(), 'iOS Safari:', isIOSSafari());
}

// Create auth client with proper config for cross-origin requests
// NOTE: iOS Safari/Chrome cookie handling:
// - kriptik.app and api.kriptik.app share the same eTLD+1 (kriptik.app)
// - Safari's ITP considers them SAME-SITE, not cross-site
// - Backend uses sameSite: 'lax' (not 'none') for same-site scenarios
// - Cookie domain '.kriptik.app' allows sharing between subdomains
// - This works without a proxy because it's same-site
export const authClient = createAuthClient({
    baseURL: API_URL,
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
// SOCIAL SIGN-IN - Uses Better Auth's built-in OAuth flow
// ============================================================================

export const signInWithGoogle = async () => {
    // Use full frontend URL for callback to ensure redirect goes to frontend, not backend
    const callbackURL = `${FRONTEND_URL}/dashboard`;

    console.log('[Auth] Starting Google sign-in...', {
        isMobile: isMobile(),
        apiUrl: API_URL,
        callbackURL,
    });

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
        // Provide more context in the error
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(`Network error: Cannot reach auth server at ${API_URL}. Please check your connection.`);
        }
        throw error;
    }
};

export const signInWithGitHub = async () => {
    // Use full frontend URL for callback to ensure redirect goes to frontend, not backend
    const callbackURL = `${FRONTEND_URL}/dashboard`;

    console.log('[Auth] Starting GitHub sign-in...', {
        isMobile: isMobile(),
        apiUrl: API_URL,
        callbackURL,
    });

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
        // Provide more context in the error
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(`Network error: Cannot reach auth server at ${API_URL}. Please check your connection.`);
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
