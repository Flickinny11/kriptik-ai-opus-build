import { createAuthClient } from "better-auth/react"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const authClient = createAuthClient({
    baseURL: API_URL,
})

// Export convenience functions for social sign-in
// Don't pass callbackURL - let Better Auth use the default redirect callback
export const signInWithGoogle = async () => {
    try {
        console.log('[Auth] Starting Google sign-in...');
        
        await authClient.signIn.social({
            provider: "google",
            // callbackURL is handled by the server's redirect callback
        });
    } catch (error) {
        console.error('Google sign-in error:', error);
        throw error;
    }
};

export const signInWithGitHub = async () => {
    try {
        console.log('[Auth] Starting GitHub sign-in...');
        
        await authClient.signIn.social({
            provider: "github",
            // callbackURL is handled by the server's redirect callback
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
