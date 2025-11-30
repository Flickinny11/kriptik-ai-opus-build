import { create } from 'zustand';
import { authClient } from '../lib/auth-client';
import { setApiUserId } from '../lib/api-client';
import { useCostStore } from './useCostStore';

interface User {
    id: string;
    email: string;
    name: string;
    avatar?: string;
}

interface UserState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string, name: string) => Promise<void>;
    logout: () => Promise<void>;
    initialize: () => Promise<void>;
}

// Keys for localStorage
const USER_STORAGE_KEY = 'kriptik_user';
const USER_ID_STORAGE_KEY = 'kriptik_user_id';

// Save user to localStorage
const saveUserToStorage = (user: User) => {
    try {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        localStorage.setItem(USER_ID_STORAGE_KEY, user.id);
    } catch (e) {
        console.warn('[UserStore] Failed to save user to localStorage:', e);
    }
};

// Load user from localStorage
const loadUserFromStorage = (): User | null => {
    try {
        const userStr = localStorage.getItem(USER_STORAGE_KEY);
        if (userStr) {
            return JSON.parse(userStr);
        }
    } catch (e) {
        console.warn('[UserStore] Failed to load user from localStorage:', e);
    }
    return null;
};

// Clear user from localStorage
const clearUserFromStorage = () => {
    try {
        localStorage.removeItem(USER_STORAGE_KEY);
        localStorage.removeItem(USER_ID_STORAGE_KEY);
    } catch (e) {
        console.warn('[UserStore] Failed to clear user from localStorage:', e);
    }
};

export const useUserStore = create<UserState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,

    initialize: async () => {
        console.log('[UserStore] Initializing...');

        // First, try to load from localStorage (for fast startup)
        const storedUser = loadUserFromStorage();
        if (storedUser) {
            console.log('[UserStore] Found stored user:', storedUser.email);
            setApiUserId(storedUser.id);
            set({
                user: storedUser,
                isAuthenticated: true,
                isLoading: false
            });

            // Fetch credits in background
            useCostStore.getState().fetchCredits();
        }

        // Then try to get session from Better Auth (validates it's still valid)
        try {
            const { data: session, error } = await authClient.getSession();
            console.log('[UserStore] Session response:', { hasSession: !!session?.user, error });

            if (session?.user) {
                const user = {
                    id: session.user.id,
                    email: session.user.email || '',
                    name: session.user.name || '',
                    avatar: session.user.image || undefined
                };

                // Update stored user and state
                saveUserToStorage(user);
                setApiUserId(session.user.id);

                set({
                    user,
                    isAuthenticated: true,
                    isLoading: false
                });

                // Fetch credits
                useCostStore.getState().fetchCredits();
            } else if (!storedUser) {
                // No session and no stored user
                console.log('[UserStore] No session found');
                setApiUserId(null);
                set({ user: null, isAuthenticated: false, isLoading: false });
            } else {
                // Session validation failed but we have stored user
                // Keep the stored user (might work with x-user-id header)
                console.log('[UserStore] Session invalid but keeping stored user');
                set({ isLoading: false });
            }
        } catch (error) {
            console.error('[UserStore] Auth initialization failed:', error);
            // If we have a stored user, keep them logged in
            if (!storedUser) {
                setApiUserId(null);
            }
            set({ isLoading: false });
        }
    },

    login: async (email, password) => {
        set({ isLoading: true });
        console.log('[UserStore] Logging in with email:', email);

        try {
            const result = await authClient.signIn.email({
                email,
                password,
            });

            console.log('[UserStore] Login result:', result);

            if (result.error) {
                console.error('[UserStore] Login error:', result.error);
                set({ isLoading: false });
                throw new Error(result.error.message || 'Invalid credentials');
            }

            // Refresh session to get user data
            const { data: session, error: sessionError } = await authClient.getSession();
            console.log('[UserStore] Post-login session:', session, sessionError);

            if (session?.user) {
                const user = {
                    id: session.user.id,
                    email: session.user.email || '',
                    name: session.user.name || '',
                    avatar: session.user.image || undefined
                };

                // Save to localStorage and set API user ID
                saveUserToStorage(user);
                setApiUserId(session.user.id);

                set({
                    user,
                    isAuthenticated: true,
                    isLoading: false
                });

                // Fetch credits
                useCostStore.getState().fetchCredits();
            } else {
                console.warn('[UserStore] Login succeeded but no session found');
                set({ isLoading: false });
                throw new Error('Login succeeded but session not established. Please try again.');
            }
        } catch (error: unknown) {
            console.error('[UserStore] Login exception:', error);
            set({ isLoading: false });
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('An unexpected error occurred during login');
        }
    },

    signup: async (email, password, name) => {
        set({ isLoading: true });
        console.log('[UserStore] Signing up:', { email, name });

        try {
            const result = await authClient.signUp.email({
                email,
                password,
                name,
            });

            console.log('[UserStore] Signup result:', result);

            if (result.error) {
                console.error('[UserStore] Signup error:', result.error);
                set({ isLoading: false });
                throw new Error(result.error.message || 'Failed to create account');
            }

            // Small delay to ensure session is created
            await new Promise(resolve => setTimeout(resolve, 500));

            // Refresh session to get user data
            const { data: session, error: sessionError } = await authClient.getSession();
            console.log('[UserStore] Post-signup session:', session, sessionError);

            if (session?.user) {
                const user = {
                    id: session.user.id,
                    email: session.user.email || '',
                    name: session.user.name || '',
                    avatar: session.user.image || undefined
                };

                // Save to localStorage and set API user ID
                saveUserToStorage(user);
                setApiUserId(session.user.id);

                set({
                    user,
                    isAuthenticated: true,
                    isLoading: false
                });

                // Fetch credits
                useCostStore.getState().fetchCredits();
            } else {
                console.warn('[UserStore] Signup succeeded but no session found');
                set({ isLoading: false });
                throw new Error('Account created but session not established. Please try logging in.');
            }
        } catch (error: unknown) {
            console.error('[UserStore] Signup exception:', error);
            set({ isLoading: false });
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('An unexpected error occurred during signup');
        }
    },

    logout: async () => {
        set({ isLoading: true });
        console.log('[UserStore] Logging out...');

        try {
            await authClient.signOut();
        } catch (e) {
            console.warn('[UserStore] Sign out error:', e);
        }

        // Clear stored user
        clearUserFromStorage();
        setApiUserId(null);

        set({ user: null, isAuthenticated: false, isLoading: false });
    },
}));
