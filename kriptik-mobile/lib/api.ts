/**
 * KripTik Mobile API Client
 * Handles all API communication with the KripTik backend
 */

import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// CRITICAL: Must match web app API URL (kriptik.app, NOT kriptik.ai)
const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'https://api.kriptik.app';
const ACCESS_TOKEN_KEY = 'kriptik_access_token';
const REFRESH_TOKEN_KEY = 'kriptik_refresh_token';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

class KripTikApi {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getAuthToken(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  }

  private async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      body?: unknown;
      skipAuth?: boolean;
      headers?: Record<string, string>;
    } = {}
  ): Promise<ApiResponse<T>> {
    const { method = 'GET', body, skipAuth = false, headers = {} } = options;

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
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle token expiration
        if (response.status === 401 && !skipAuth) {
          const refreshed = await this.handleTokenRefresh();
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

  private async handleTokenRefresh(): Promise<boolean> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        credentials: 'include',
      });

      if (!response.ok) {
        await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
        return false;
      }

      const data = await response.json();
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, data.accessToken);
      if (data.refreshToken) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, data.refreshToken);
      }
      return true;
    } catch {
      return false;
    }
  }

  // ========== Auth Endpoints ==========

  async login(email: string, password: string) {
    return this.request<{
      user: { id: string; email: string; name: string; avatar?: string; createdAt: string };
      accessToken: string;
      refreshToken: string;
    }>('/api/auth/sign-in/email', {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
    });
  }

  async signup(email: string, password: string, name: string) {
    return this.request<{
      user: { id: string; email: string; name: string; avatar?: string; createdAt: string };
      accessToken: string;
      refreshToken: string;
    }>('/api/auth/sign-up/email', {
      method: 'POST',
      body: { email, password, name },
      skipAuth: true,
    });
  }

  async logout() {
    return this.request('/api/auth/sign-out', {
      method: 'POST',
    });
  }

  async refreshToken(refreshToken: string) {
    return this.request<{
      user: { id: string; email: string; name: string; avatar?: string; createdAt: string };
      accessToken: string;
      refreshToken: string;
    }>('/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      skipAuth: true,
    });
  }

  async getCurrentUser() {
    return this.request<{
      user: { id: string; email: string; name: string; avatar?: string; createdAt: string };
    }>('/api/auth/get-session');
  }

  async requestPasswordReset(email: string) {
    return this.request('/api/auth/forgot-password', {
      method: 'POST',
      body: { email },
      skipAuth: true,
    });
  }

  // ========== Projects Endpoints ==========

  async getProjects() {
    return this.request<{
      projects: Array<{
        id: string;
        name: string;
        description?: string;
        framework: string;
        status: string;
        createdAt: string;
        updatedAt: string;
      }>;
    }>('/api/projects');
  }

  async getProject(id: string) {
    return this.request<{
      project: {
        id: string;
        name: string;
        description?: string;
        framework: string;
        status: string;
        files: Array<{ path: string; content: string }>;
        createdAt: string;
        updatedAt: string;
      };
    }>(`/api/projects/${id}`);
  }

  async createProject(data: { name: string; description?: string; framework: string }) {
    return this.request<{
      project: { id: string; name: string };
    }>('/api/projects', {
      method: 'POST',
      body: data,
    });
  }

  async deleteProject(id: string) {
    return this.request(`/api/projects/${id}`, {
      method: 'DELETE',
    });
  }

  // ========== Builds Endpoints ==========

  async getBuilds(projectId?: string) {
    const endpoint = projectId ? `/api/builds?projectId=${projectId}` : '/api/builds';
    return this.request<{
      builds: Array<{
        id: string;
        projectId: string;
        projectName: string;
        status: 'queued' | 'running' | 'completed' | 'failed';
        progress: number;
        phase: string;
        startedAt: string;
        completedAt?: string;
      }>;
    }>(endpoint);
  }

  async getBuild(id: string) {
    return this.request<{
      build: {
        id: string;
        projectId: string;
        projectName: string;
        status: 'queued' | 'running' | 'completed' | 'failed';
        progress: number;
        phase: string;
        logs: Array<{ timestamp: string; message: string; type: string }>;
        startedAt: string;
        completedAt?: string;
      };
    }>(`/api/builds/${id}`);
  }

  async startBuild(projectId: string, prompt: string) {
    return this.request<{
      build: { id: string };
    }>('/api/builds', {
      method: 'POST',
      body: { projectId, prompt },
    });
  }

  async cancelBuild(id: string) {
    return this.request(`/api/builds/${id}/cancel`, {
      method: 'POST',
    });
  }

  // ========== Feature Agents Endpoints ==========

  async getAgents() {
    return this.request<{
      agents: Array<{
        id: string;
        name: string;
        status: 'idle' | 'running' | 'completed' | 'failed';
        task?: string;
        progress: number;
        createdAt: string;
      }>;
    }>('/api/feature-agents');
  }

  async getAgent(id: string) {
    return this.request<{
      agent: {
        id: string;
        name: string;
        status: 'idle' | 'running' | 'completed' | 'failed';
        task?: string;
        progress: number;
        logs: Array<{ timestamp: string; message: string; type: string }>;
        createdAt: string;
      };
    }>(`/api/feature-agents/${id}`);
  }

  async startAgent(task: string, config?: Record<string, unknown>) {
    return this.request<{
      agent: { id: string };
    }>('/api/feature-agents', {
      method: 'POST',
      body: { task, config },
    });
  }

  async stopAgent(id: string) {
    return this.request(`/api/feature-agents/${id}/stop`, {
      method: 'POST',
    });
  }

  // ========== AI Lab Endpoints ==========

  async getTrainingJobs() {
    return this.request<{
      jobs: Array<{
        id: string;
        name: string;
        status: 'queued' | 'training' | 'completed' | 'failed';
        progress: number;
        modelType: string;
        createdAt: string;
      }>;
    }>('/api/ai-lab/training');
  }

  async getTrainingJob(id: string) {
    return this.request<{
      job: {
        id: string;
        name: string;
        status: 'queued' | 'training' | 'completed' | 'failed';
        progress: number;
        modelType: string;
        metrics?: Record<string, number>;
        logs: Array<{ timestamp: string; message: string }>;
        createdAt: string;
      };
    }>(`/api/ai-lab/training/${id}`);
  }

  async getModels() {
    return this.request<{
      models: Array<{
        id: string;
        name: string;
        type: string;
        status: 'available' | 'deploying' | 'deployed';
        createdAt: string;
      }>;
    }>('/api/ai-lab/models');
  }

  // ========== Notifications Endpoints ==========

  async getNotifications() {
    return this.request<{
      notifications: Array<{
        id: string;
        type: 'build' | 'agent' | 'training' | 'system' | 'chat';
        title: string;
        body: string;
        data?: Record<string, unknown>;
        read: boolean;
        createdAt: string;
      }>;
    }>('/api/notifications');
  }

  async markNotificationRead(id: string) {
    return this.request(`/api/notifications/${id}/read`, {
      method: 'POST',
    });
  }

  async markAllNotificationsRead() {
    return this.request('/api/notifications/read-all', {
      method: 'POST',
    });
  }

  async registerPushToken(token: string) {
    return this.request('/api/notifications/register-device', {
      method: 'POST',
      body: { token, platform: 'expo' },
    });
  }

  // ========== Settings Endpoints ==========

  async getSettings() {
    return this.request<{
      settings: Record<string, unknown>;
    }>('/api/user/settings');
  }

  async updateSettings(settings: Record<string, unknown>) {
    return this.request('/api/user/settings', {
      method: 'PATCH',
      body: { settings },
    });
  }

  // ========== Streaming Endpoints ==========

  createBuildStream(buildId: string): EventSource | null {
    // Note: EventSource is not available in React Native
    // We'll use a polling mechanism or WebSocket instead
    return null;
  }

  async *streamBuild(buildId: string): AsyncGenerator<{ type: string; data: unknown }> {
    // Polling-based stream for React Native
    let completed = false;
    let lastEventId = 0;

    while (!completed) {
      try {
        const response = await this.request<{
          events: Array<{ id: number; type: string; data: unknown }>;
          completed: boolean;
        }>(`/api/builds/${buildId}/events?after=${lastEventId}`);

        if (response.success && response.data) {
          for (const event of response.data.events) {
            lastEventId = event.id;
            yield { type: event.type, data: event.data };
          }
          completed = response.data.completed;
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Stream error:', error);
        break;
      }
    }
  }
}

export const api = new KripTikApi(API_BASE_URL);
