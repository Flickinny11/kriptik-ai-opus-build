import { createAuthClient } from "better-auth/react"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const authClient = createAuthClient({
    baseURL: API_URL,
})

// Get the frontend URL for callbacks
const getFrontendUrl = () => {
    // In production, use the known frontend URL
    if (typeof window !== 'undefined') {
        const origin = window.location.origin;
        // Return just the path for relative redirect (safer)
        return origin;
    }
    return "https://kriptik-ai-opus-build.vercel.app";
};

// Export convenience functions for social sign-in
export const signInWithGoogle = async () => {
    const callbackURL = `${getFrontendUrl()}/dashboard`;
    console.log('Google OAuth callback URL:', callbackURL);
    
    return authClient.signIn.social({
        provider: "google",
        callbackURL: callbackURL,
    });
};

export const signInWithGitHub = async () => {
    const callbackURL = `${getFrontendUrl()}/dashboard`;
    console.log('GitHub OAuth callback URL:', callbackURL);
    
    return authClient.signIn.social({
        provider: "github",
        callbackURL: callbackURL,
    });
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
