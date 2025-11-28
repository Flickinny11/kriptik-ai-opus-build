import { createAuthClient } from "better-auth/react"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const authClient = createAuthClient({
    baseURL: API_URL,
})

// Export convenience functions for social sign-in
// Don't pass callbackURL - let the server use the default from trustedOrigins
export const signInWithGoogle = async () => {
    // Redirect to auth endpoint and let server handle callback
    const redirectUrl = `${API_URL}/api/auth/sign-in/social?provider=google`;
    window.location.href = redirectUrl;
};

export const signInWithGitHub = async () => {
    // Redirect to auth endpoint and let server handle callback
    const redirectUrl = `${API_URL}/api/auth/sign-in/social?provider=github`;
    window.location.href = redirectUrl;
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
