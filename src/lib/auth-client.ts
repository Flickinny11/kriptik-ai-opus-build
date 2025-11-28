import { createAuthClient } from "better-auth/react"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const authClient = createAuthClient({
    baseURL: API_URL,
})

// Export convenience functions for social sign-in
export const signInWithGoogle = async () => {
    try {
        // Better Auth's social sign-in returns a redirect URL or handles the redirect
        await authClient.signIn.social({
            provider: "google",
            callbackURL: "/dashboard",
        });
    } catch (error) {
        console.error('Google sign-in error:', error);
        throw error;
    }
};

export const signInWithGitHub = async () => {
    try {
        await authClient.signIn.social({
            provider: "github",
            callbackURL: "/dashboard",
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
