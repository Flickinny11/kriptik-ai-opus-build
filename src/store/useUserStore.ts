import { create } from 'zustand';
import { authClient } from '../lib/auth-client';

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
            const { data: session } = await authClient.getSession();

            if (session?.user) {
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
                set({ user: null, isAuthenticated: false, isLoading: false });
            }
        } catch (error) {
            console.error('Auth initialization failed:', error);
            set({ isLoading: false });
        }
    },
    login: async (email, password) => {
        set({ isLoading: true });
        const { error } = await authClient.signIn.email({
            email,
            password,
        });

        if (error) {
            set({ isLoading: false });
            throw error;
        }

        // Refresh session to get user data
        const { data: session } = await authClient.getSession();
        if (session?.user) {
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
        const { error } = await authClient.signUp.email({
            email,
            password,
            name,
        });

        if (error) {
            set({ isLoading: false });
            throw error;
        }

        // Refresh session to get user data
        const { data: session } = await authClient.getSession();
        if (session?.user) {
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
        await authClient.signOut();
        set({ user: null, isAuthenticated: false, isLoading: false });
    },
}));
