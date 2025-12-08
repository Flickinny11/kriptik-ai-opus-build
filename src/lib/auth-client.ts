import { createAuthClient } from "better-auth/react"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || window.location.origin;

// Log configuration on startup
console.log('[Auth Client] Initialized with API_URL:', API_URL);
console.log('[Auth Client] Frontend URL:', FRONTEND_URL);

// Detect if we're on mobile
export const isMobile = () => {
    if (typeof navigator === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Create auth client with proper config for cross-origin requests
export const authClient = createAuthClient({
    baseURL: API_URL,
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

        console.log('[Auth] Google sign-in initiated:', result);

        // Better Auth handles the redirect, so we shouldn't reach here normally
        // If we do, it means something went wrong
        if (result?.error) {
            throw new Error(result.error.message || 'Google sign-in failed');
        }
    } catch (error) {
        console.error('[Auth] Google sign-in error:', error);
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

        console.log('[Auth] GitHub sign-in initiated:', result);

        // Better Auth handles the redirect, so we shouldn't reach here normally
        if (result?.error) {
            throw new Error(result.error.message || 'GitHub sign-in failed');
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
    console.log('[Auth] Signing in with email:', email);

    const response = await authClient.signIn.email({
        email,
        password,
        callbackURL: '/dashboard',
    });

    if (response.error) {
        throw new Error(response.error.message || 'Login failed');
    }

    if (!response.data) {
        throw new Error('Login failed - no user data returned');
    }

    return response.data;
};

export const signUp = async (email: string, password: string, name: string) => {
    console.log('[Auth] Signing up:', email, name);

    const response = await authClient.signUp.email({
        email,
        password,
        name,
        callbackURL: '/dashboard',
    });

    if (response.error) {
        throw new Error(response.error.message || 'Signup failed');
    }

    if (!response.data) {
        throw new Error('Signup failed - no user data returned');
    }

    return response.data;
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

    try {
        const session = await authClient.getSession();

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
