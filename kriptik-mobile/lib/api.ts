/**
 * KripTik Mobile API Client
 *
 * Handles all API communication with the KripTik backend
 */

import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.kriptik.ai';
const AUTH_TOKEN_KEY = 'kriptik_auth_token';
const REFRESH_TOKEN_KEY = 'kriptik_refresh_token';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async getAuthToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  async setAuthToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  }

  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  }

  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  async clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { method = 'GET', body, headers = {}, skipAuth = false } = options;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (!skipAuth) {
      const token = await this.getAuthToken();
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include', // For web compatibility
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle token expiration
        if (response.status === 401 && !skipAuth) {
          const refreshed = await this.refreshSession();
          if (refreshed) {
            // Retry the request
            return this.request<T>(endpoint, options);
          }
        }

        return {
          success: false,
          error: data.error || data.message || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  async refreshSession(): Promise<boolean> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        credentials: 'include', // For web compatibility
      });

      if (!response.ok) {
        await this.clearTokens();
        return false;
      }

      const data = await response.json();
      if (data.token) {
        await this.setAuthToken(data.token);
        if (data.refreshToken) {
          await this.setRefreshToken(data.refreshToken);
        }
        return true;
      }

      return false;
    } catch {
      await this.clearTokens();
      return false;
    }
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<ApiResponse<{ token: string; refreshToken: string; user: User }>> {
    return this.request('/api/auth/sign-in/email', {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
    });
  }

  async signup(email: string, password: string, name: string): Promise<ApiResponse<{ token: string; refreshToken: string; user: User }>> {
    return this.request('/api/auth/sign-up/email', {
      method: 'POST',
      body: { email, password, name },
      skipAuth: true,
    });
  }

  async getSession(): Promise<ApiResponse<{ user: User }>> {
    return this.request('/api/auth/get-session');
  }

  async signOut(): Promise<ApiResponse<void>> {
    const result = await this.request<void>('/api/auth/sign-out', { method: 'POST' });
    await this.clearTokens();
    return result;
  }

  // Projects endpoints
  async getProjects(): Promise<ApiResponse<Project[]>> {
    return this.request('/api/projects');
  }

  async getProject(id: string): Promise<ApiResponse<Project>> {
    return this.request(`/api/projects/${id}`);
  }

  async createProject(data: { name: string; description?: string }): Promise<ApiResponse<Project>> {
    return this.request('/api/projects', { method: 'POST', body: data });
  }

  // Builds endpoints
  async getBuilds(projectId?: string): Promise<ApiResponse<Build[]>> {
    const endpoint = projectId ? `/api/builds?projectId=${projectId}` : '/api/builds';
    return this.request(endpoint);
  }

  async getBuild(id: string): Promise<ApiResponse<Build>> {
    return this.request(`/api/builds/${id}`);
  }

  async startBuild(projectId: string, prompt: string): Promise<ApiResponse<Build>> {
    return this.request('/api/builds', {
      method: 'POST',
      body: { projectId, prompt },
    });
  }

  async stopBuild(id: string): Promise<ApiResponse<void>> {
    return this.request(`/api/builds/${id}/stop`, { method: 'POST' });
  }

  // Push notifications
  async registerPushToken(token: string, platform: 'ios' | 'android'): Promise<ApiResponse<void>> {
    return this.request('/api/notifications/register', {
      method: 'POST',
      body: { token, platform },
    });
  }
}

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  userId: string;
  status: 'active' | 'archived';
  lastBuildId?: string;
  lastBuildStatus?: Build['status'];
  createdAt: string;
  updatedAt: string;
}

export interface Build {
  id: string;
  projectId: string;
  status: 'pending' | 'planning' | 'implementing' | 'verifying' | 'complete' | 'failed' | 'cancelled';
  progress: number;
  currentPhase?: string;
  prompt: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export const api = new ApiClient(API_BASE_URL);
export default api;
