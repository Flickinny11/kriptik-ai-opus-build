import { createAuthClient } from "better-auth/react"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const authClient = createAuthClient({
    baseURL: API_URL,
})

// Export convenience functions for social sign-in
// Use Better Auth's proper redirect method
export const signInWithGoogle = async () => {
    // Use the client's built-in social sign-in which handles the redirect properly
    try {
        const result = await authClient.signIn.social({
            provider: "google",
            callbackURL: "/dashboard",
        });
        
        // If we get a redirect URL, navigate to it
        if (result?.data?.url) {
            window.location.href = result.data.url;
        }
        
        return result;
    } catch (error) {
        console.error('Google sign-in error:', error);
        throw error;
    }
};

export const signInWithGitHub = async () => {
    try {
        const result = await authClient.signIn.social({
            provider: "github",
            callbackURL: "/dashboard",
        });
        
        // If we get a redirect URL, navigate to it
        if (result?.data?.url) {
            window.location.href = result.data.url;
        }
        
        return result;
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
