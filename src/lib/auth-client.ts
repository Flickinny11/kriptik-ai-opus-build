import { createAuthClient } from "better-auth/react"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// Detect if we're on mobile
export const isMobile = () => {
    if (typeof navigator === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Create auth client with minimal config
export const authClient = createAuthClient({
    baseURL: API_URL,
    fetchOptions: {
        credentials: "include",
    },
})

// ============================================================================
// DIRECT API CALLS - More reliable on mobile than Better Auth's internal fetch
// ============================================================================

interface AuthResponse {
    user?: {
        id: string;
        email: string;
        name: string;
        image?: string;
    };
    session?: {
        id: string;
        token: string;
    };
    error?: {
        message: string;
        code?: string;
    };
    url?: string; // For OAuth redirects
}

/**
 * Make a direct fetch call to the auth API
 * This is more reliable on mobile than Better Auth's client
 */
async function authFetch(endpoint: string, body?: object): Promise<AuthResponse> {
    const url = `${API_URL}/api/auth${endpoint}`;
    console.log(`[Auth] Fetching ${url}`, { isMobile: isMobile() });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            credentials: 'include',
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log(`[Auth] Response status: ${response.status}`);

        const data = await response.json();
        console.log(`[Auth] Response data:`, data);

        if (!response.ok) {
            throw new Error(data.message || data.error?.message || `HTTP ${response.status}`);
        }

        return data;
    } catch (error: unknown) {
        clearTimeout(timeoutId);

        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                console.error('[Auth] Request timed out');
                throw new Error('Request timed out. Please check your connection and try again.');
            }
            console.error('[Auth] Fetch error:', error.message);
            throw error;
        }

        console.error('[Auth] Unknown error:', error);
        throw new Error('An unexpected error occurred');
    }
}

// ============================================================================
// SOCIAL SIGN-IN - Uses redirect for mobile compatibility
// ============================================================================

export const signInWithGoogle = async () => {
    console.log('[Auth] Starting Google sign-in...', { isMobile: isMobile() });

    try {
        // Get the OAuth URL from the server
        const response = await authFetch('/sign-in/social', {
            provider: 'google',
            callbackURL: window.location.origin + '/dashboard',
        });

        // Redirect to the OAuth URL
        if (response.url) {
            console.log('[Auth] Redirecting to OAuth URL:', response.url);
            window.location.href = response.url;
        } else {
            throw new Error('No OAuth URL returned from server');
        }
    } catch (error) {
        console.error('[Auth] Google sign-in error:', error);
        throw error;
    }
};

export const signInWithGitHub = async () => {
    console.log('[Auth] Starting GitHub sign-in...', { isMobile: isMobile() });

    try {
        // Get the OAuth URL from the server
        const response = await authFetch('/sign-in/social', {
            provider: 'github',
            callbackURL: window.location.origin + '/dashboard',
        });

        // Redirect to the OAuth URL
        if (response.url) {
            console.log('[Auth] Redirecting to OAuth URL:', response.url);
            window.location.href = response.url;
        } else {
            throw new Error('No OAuth URL returned from server');
        }
    } catch (error) {
        console.error('[Auth] GitHub sign-in error:', error);
        throw error;
    }
};

// ============================================================================
// EMAIL/PASSWORD AUTH - Direct API calls for reliability
// ============================================================================

export const signInWithEmail = async (email: string, password: string) => {
    console.log('[Auth] Signing in with email:', email);

    const response = await authFetch('/sign-in/email', {
        email,
        password,
    });

    if (response.error) {
        throw new Error(response.error.message || 'Login failed');
    }

    return { data: response, error: null };
};

export const signUp = async (email: string, password: string, name: string) => {
    console.log('[Auth] Signing up:', email, name);

    const response = await authFetch('/sign-up/email', {
        email,
        password,
        name,
    });

    if (response.error) {
        throw new Error(response.error.message || 'Signup failed');
    }

    return { data: response, error: null };
};

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

export const signOut = async () => {
    console.log('[Auth] Signing out...');

    try {
        await authFetch('/sign-out', {});
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

    return { error: null };
};

export const getSession = async () => {
    console.log('[Auth] Getting session...');

    try {
        const url = `${API_URL}/api/auth/get-session`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
            credentials: 'include',
        });

        if (!response.ok) {
            console.log('[Auth] No active session');
            return { data: null, error: null };
        }

        const data = await response.json();
        console.log('[Auth] Session data:', data);

        return { data, error: null };
    } catch (error) {
        console.error('[Auth] Get session error:', error);
        return { data: null, error };
    }
};
