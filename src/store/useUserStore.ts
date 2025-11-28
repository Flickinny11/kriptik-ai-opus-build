import { create } from 'zustand';
import { authClient } from '../lib/auth-client';
import { setApiUserId } from '../lib/api-client';

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

export const useUserStore = create<UserState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    initialize: async () => {
        try {
            console.log('[UserStore] Initializing - fetching session...');
            const { data: session, error } = await authClient.getSession();

            console.log('[UserStore] Session response:', { session, error });

            if (session?.user) {
                console.log('[UserStore] User found:', {
                    id: session.user.id,
                    email: session.user.email,
                    name: session.user.name,
                });

                // Set the user ID in the API client for authenticated requests
                setApiUserId(session.user.id);

                set({
                    user: {
                        id: session.user.id,
                        email: session.user.email || '',
                        name: session.user.name || '',
                        avatar: session.user.image || undefined
                    },
                    isAuthenticated: true,
                    isLoading: false
                });
            } else {
                console.log('[UserStore] No session found');
                setApiUserId(null);
                set({ user: null, isAuthenticated: false, isLoading: false });
            }
        } catch (error) {
            console.error('[UserStore] Auth initialization failed:', error);
            setApiUserId(null);
            set({ isLoading: false });
        }
    },
    login: async (email, password) => {
        set({ isLoading: true });
        console.log('[UserStore] Logging in with email:', email);

        const { error } = await authClient.signIn.email({
            email,
            password,
        });

        if (error) {
            console.error('[UserStore] Login error:', error);
            set({ isLoading: false });
            throw error;
        }

        // Refresh session to get user data
        const { data: session } = await authClient.getSession();
        console.log('[UserStore] Post-login session:', session);

        if (session?.user) {
            // Set the user ID in the API client for authenticated requests
            setApiUserId(session.user.id);

            set({
                user: {
                    id: session.user.id,
                    email: session.user.email || '',
                    name: session.user.name || '',
                    avatar: session.user.image || undefined
                },
                isAuthenticated: true,
                isLoading: false
            });
        }
    },
    signup: async (email, password, name) => {
        set({ isLoading: true });
        console.log('[UserStore] Signing up:', { email, name });

        const { error } = await authClient.signUp.email({
            email,
            password,
            name,
        });

        if (error) {
            console.error('[UserStore] Signup error:', error);
            set({ isLoading: false });
            throw error;
        }

        // Refresh session to get user data
        const { data: session } = await authClient.getSession();
        console.log('[UserStore] Post-signup session:', session);

        if (session?.user) {
            // Set the user ID in the API client for authenticated requests
            setApiUserId(session.user.id);

            set({
                user: {
                    id: session.user.id,
                    email: session.user.email || '',
                    name: session.user.name || '',
                    avatar: session.user.image || undefined
                },
                isAuthenticated: true,
                isLoading: false
            });
        }
    },
    logout: async () => {
        set({ isLoading: true });
        console.log('[UserStore] Logging out...');
        await authClient.signOut();
        setApiUserId(null);
        set({ user: null, isAuthenticated: false, isLoading: false });
    },
}));
