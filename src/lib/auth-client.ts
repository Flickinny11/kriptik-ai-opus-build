import { createAuthClient } from "better-auth/react"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// Detect if we're on mobile
const isMobile = () => {
    if (typeof navigator === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const authClient = createAuthClient({
    baseURL: API_URL,
    fetchOptions: {
        credentials: "include", // CRITICAL: Send cookies with cross-origin requests
        // Add mode for better cross-origin handling on mobile
        mode: "cors" as RequestMode,
    },
})

// Export convenience functions for social sign-in
export const signInWithGoogle = async () => {
    try {
        console.log('[Auth] Starting Google sign-in...', { isMobile: isMobile() });

        // For mobile, we need to use redirect mode to avoid popup blockers
        await authClient.signIn.social({
            provider: "google",
            // On mobile, some browsers block popups - use redirect instead
            // The server's redirect callback will handle sending back to frontend
        });
    } catch (error) {
        console.error('Google sign-in error:', error);
        throw error;
    }
};

export const signInWithGitHub = async () => {
    try {
        console.log('[Auth] Starting GitHub sign-in...', { isMobile: isMobile() });

        await authClient.signIn.social({
            provider: "github",
        });
    } catch (error) {
        console.error('GitHub sign-in error:', error);
        throw error;
    }
};

export const signInWithEmail = async (email: string, password: string) => {
    return authClient.signIn.email({
        email,
        password,
    });
};

export const signUp = async (email: string, password: string, name: string) => {
    return authClient.signUp.email({
        email,
        password,
        name,
    });
};

export const signOut = async () => {
    return authClient.signOut();
};

export const getSession = async () => {
    return authClient.getSession();
};
