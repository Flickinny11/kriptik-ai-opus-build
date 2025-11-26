import { createAuthClient } from "better-auth/react"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const authClient = createAuthClient({
    baseURL: API_URL,
})

// Export convenience functions for social sign-in
export const signInWithGoogle = async () => {
    return authClient.signIn.social({
        provider: "google",
        callbackURL: window.location.origin,
    });
};

export const signInWithGitHub = async () => {
    return authClient.signIn.social({
        provider: "github",
        callbackURL: window.location.origin,
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
