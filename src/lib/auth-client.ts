import { createAuthClient } from "better-auth/react"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// Get the current origin for callback URLs
const getCallbackUrl = (path: string) => {
    if (typeof window !== 'undefined') {
        return `${window.location.origin}${path}`;
    }
    return `https://kriptik-ai-opus-build.vercel.app${path}`;
};

export const authClient = createAuthClient({
    baseURL: API_URL,
})

// Export convenience functions for social sign-in
export const signInWithGoogle = async () => {
    try {
        // Use full URL for callback
        const callbackURL = getCallbackUrl('/dashboard');
        console.log('[Auth] Google sign-in with callbackURL:', callbackURL);
        
        await authClient.signIn.social({
            provider: "google",
            callbackURL,
        });
    } catch (error) {
        console.error('Google sign-in error:', error);
        throw error;
    }
};

export const signInWithGitHub = async () => {
    try {
        const callbackURL = getCallbackUrl('/dashboard');
        console.log('[Auth] GitHub sign-in with callbackURL:', callbackURL);
        
        await authClient.signIn.social({
            provider: "github",
            callbackURL,
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
