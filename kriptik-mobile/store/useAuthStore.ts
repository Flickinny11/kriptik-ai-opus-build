/**
 * KripTik Mobile Auth Store
 *
 * Global authentication state management
 */

import { create } from 'zustand';
import type { User } from '@/lib/api';
import { checkSession, signOut as authSignOut } from '@/lib/auth';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  checkAuth: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  setUser: (user) => {
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
      error: null,
    });
  },

  setLoading: (isLoading) => {
    set({ isLoading });
  },

  setError: (error) => {
    set({ error, isLoading: false });
  },

  checkAuth: async () => {
    set({ isLoading: true, error: null });

    try {
      const user = await checkSession();
      set({
        user,
        isAuthenticated: !!user,
        isLoading: false,
      });
      return !!user;
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to check auth',
      });
      return false;
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    await authSignOut();
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },
}));
