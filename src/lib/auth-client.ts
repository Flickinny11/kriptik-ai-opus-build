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
// SOCIAL SIGN-IN - Uses Better Auth's built-in OAuth flow
// ============================================================================

export const signInWithGoogle = async () => {
    console.log('[Auth] Starting Google sign-in...', { isMobile: isMobile() });

    try {
        // Use Better Auth's built-in social sign-in
        // This handles the OAuth flow and redirects automatically
        await authClient.signIn.social({
            provider: 'google',
            callbackURL: '/dashboard', // Relative path, not full URL
        });
    } catch (error) {
        console.error('[Auth] Google sign-in error:', error);
        throw error;
    }
};

export const signInWithGitHub = async () => {
    console.log('[Auth] Starting GitHub sign-in...', { isMobile: isMobile() });

    try {
        // Use Better Auth's built-in social sign-in
        // This handles the OAuth flow and redirects automatically
        await authClient.signIn.social({
            provider: 'github',
            callbackURL: '/dashboard', // Relative path, not full URL
        });
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
