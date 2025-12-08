import { create } from 'zustand';
import { signInWithEmail, signUp as authSignUp, getSession, signOut as authSignOut } from '../lib/auth-client';
import { setApiUserId } from '../lib/api-client';
import { useCostStore } from './useCostStore';
import { useProjectStore } from './useProjectStore';

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

            // Fetch credits and projects in background
            useCostStore.getState().fetchCredits();
            useProjectStore.getState().fetchProjects();
        }

        // Then try to get session from auth API (validates it's still valid)
        try {
            const { data: session, error } = await getSession();
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

                // Fetch credits and projects
                useCostStore.getState().fetchCredits();
                useProjectStore.getState().fetchProjects();
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
            // Use direct auth function for better mobile compatibility
            const loginResult = await signInWithEmail(email, password);
            console.log('[UserStore] Login result:', loginResult);

            console.log('[UserStore] Login successful, fetching session...');

            // Small delay to ensure cookie is set
            await new Promise(resolve => setTimeout(resolve, 500));

            // Refresh session to get user data
            const { data: session, error: sessionError } = await getSession();
            console.log('[UserStore] Post-login session:', { session, sessionError });

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

                // Fetch credits and projects
                useCostStore.getState().fetchCredits();
                useProjectStore.getState().fetchProjects();
            } else {
                console.warn('[UserStore] Login succeeded but no session found');
                // Try to use loginResult directly if available
                if (loginResult?.user) {
                    const user = {
                        id: loginResult.user.id,
                        email: loginResult.user.email || '',
                        name: loginResult.user.name || '',
                        avatar: loginResult.user.image || undefined
                    };
                    saveUserToStorage(user);
                    setApiUserId(loginResult.user.id);
                    set({ user, isAuthenticated: true, isLoading: false });
                    useCostStore.getState().fetchCredits();
                    useProjectStore.getState().fetchProjects();
                } else {
                    set({ isLoading: false });
                    throw new Error('Login succeeded but session not established. This may be a cookie issue - please check that your browser allows third-party cookies.');
                }
            }
        } catch (error: unknown) {
            console.error('[UserStore] Login exception:', error);
            set({ isLoading: false });
            
            // Parse common auth errors
            if (error instanceof Error) {
                const msg = error.message.toLowerCase();
                if (msg.includes('invalid') || msg.includes('credentials')) {
                    throw new Error('Invalid email or password. Please check your credentials.');
                }
                if (msg.includes('network') || msg.includes('fetch')) {
                    throw new Error('Network error. Please check your internet connection.');
                }
                if (msg.includes('not found') || msg.includes('no user')) {
                    throw new Error('No account found with this email. Please sign up first.');
                }
                throw error;
            }
            throw new Error('An unexpected error occurred during login');
        }
    },

    signup: async (email, password, name) => {
        set({ isLoading: true });
        console.log('[UserStore] Signing up:', { email, name });

        try {
            // Use direct auth function for better mobile compatibility
            const signupResult = await authSignUp(email, password, name);
            console.log('[UserStore] Signup result:', signupResult);

            console.log('[UserStore] Signup successful, fetching session...');

            // Small delay to ensure cookie is set
            await new Promise(resolve => setTimeout(resolve, 500));

            // Refresh session to get user data
            const { data: session, error: sessionError } = await getSession();
            console.log('[UserStore] Post-signup session:', { session, sessionError });

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

                // Fetch credits and projects
                useCostStore.getState().fetchCredits();
                useProjectStore.getState().fetchProjects();
            } else {
                console.warn('[UserStore] Signup succeeded but no session found');
                // Try to use signupResult directly if available
                if (signupResult?.user) {
                    const user = {
                        id: signupResult.user.id,
                        email: signupResult.user.email || '',
                        name: signupResult.user.name || '',
                        avatar: signupResult.user.image || undefined
                    };
                    saveUserToStorage(user);
                    setApiUserId(signupResult.user.id);
                    set({ user, isAuthenticated: true, isLoading: false });
                    useCostStore.getState().fetchCredits();
                    useProjectStore.getState().fetchProjects();
                } else {
                    set({ isLoading: false });
                    throw new Error('Account created but session not established. This may be a cookie issue - please check that your browser allows third-party cookies, then try logging in.');
                }
            }
        } catch (error: unknown) {
            console.error('[UserStore] Signup exception:', error);
            set({ isLoading: false });
            
            // Parse common signup errors
            if (error instanceof Error) {
                const msg = error.message.toLowerCase();
                if (msg.includes('already exists') || msg.includes('duplicate') || msg.includes('email')) {
                    throw new Error('An account with this email already exists. Please login or use a different email.');
                }
                if (msg.includes('password') && msg.includes('weak')) {
                    throw new Error('Password is too weak. Please use at least 8 characters with a mix of letters and numbers.');
                }
                if (msg.includes('network') || msg.includes('fetch')) {
                    throw new Error('Network error. Please check your internet connection.');
                }
                throw error;
            }
            throw new Error('An unexpected error occurred during signup');
        }
    },

    logout: async () => {
        set({ isLoading: true });
        console.log('[UserStore] Logging out...');

        try {
            await authSignOut();
        } catch (e) {
            console.warn('[UserStore] Sign out error:', e);
        }

        // Clear stored user
        clearUserFromStorage();
        setApiUserId(null);

        set({ user: null, isAuthenticated: false, isLoading: false });
    },
}));
