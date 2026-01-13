import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  refreshToken: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  clearTokens: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const ACCESS_TOKEN_KEY = 'kriptik_access_token';
const REFRESH_TOKEN_KEY = 'kriptik_refresh_token';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  accessToken: null,
  refreshToken: null,

  setUser: (user) => {
    set({ user, isAuthenticated: !!user });
  },

  setTokens: async (accessToken, refreshToken) => {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    set({ accessToken, refreshToken });
  },

  clearTokens: async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    try {
      set({ isLoading: true });

      const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

      if (!accessToken) {
        set({ isLoading: false, isAuthenticated: false });
        return false;
      }

      set({ accessToken, refreshToken });

      // Verify token with backend
      const response = await api.getCurrentUser();

      if (response.success && response.data) {
        set({
          user: response.data.user,
          isAuthenticated: true,
          isLoading: false,
        });
        return true;
      }

      // Token might be expired, try refresh
      const refreshed = await get().refreshSession();
      set({ isLoading: false });
      return refreshed;
    } catch (error) {
      console.error('Auth check failed:', error);
      set({ isLoading: false, isAuthenticated: false });
      return false;
    }
  },

  login: async (email, password) => {
    try {
      set({ isLoading: true });

      const response = await api.login(email, password);

      if (response.success && response.data) {
        const { user, accessToken, refreshToken } = response.data;
        await get().setTokens(accessToken, refreshToken);
        set({ user, isAuthenticated: true, isLoading: false });
        return { success: true };
      }

      set({ isLoading: false });
      return { success: false, error: response.error || 'Login failed' };
    } catch (error) {
      set({ isLoading: false });
      return { success: false, error: 'Network error' };
    }
  },

  signup: async (email, password, name) => {
    try {
      set({ isLoading: true });

      const response = await api.signup(email, password, name);

      if (response.success && response.data) {
        const { user, accessToken, refreshToken } = response.data;
        await get().setTokens(accessToken, refreshToken);
        set({ user, isAuthenticated: true, isLoading: false });
        return { success: true };
      }

      set({ isLoading: false });
      return { success: false, error: response.error || 'Signup failed' };
    } catch (error) {
      set({ isLoading: false });
      return { success: false, error: 'Network error' };
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await get().clearTokens();
    }
  },

  refreshSession: async () => {
    try {
      const refreshToken = get().refreshToken || await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      
      if (!refreshToken) {
        return false;
      }

      const response = await api.refreshToken(refreshToken);

      if (response.success && response.data) {
        const { accessToken, refreshToken: newRefreshToken, user } = response.data;
        await get().setTokens(accessToken, newRefreshToken);
        set({ user, isAuthenticated: true });
        return true;
      }

      await get().clearTokens();
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      await get().clearTokens();
      return false;
    }
  },
}));
