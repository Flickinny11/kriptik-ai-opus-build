/**
 * KripTik Mobile Configuration
 * Production-ready configuration for the mobile app
 */

// API Base URL - Always use production
export const API_BASE_URL = 'https://api.kriptik.app';

// App configuration
export const APP_CONFIG = {
  name: 'KripTik Mobile',
  version: '1.0.0',
  bundleId: 'com.kriptik.mobile',
  
  // API URL - CRITICAL: This must be set for OAuth to work!
  apiUrl: API_BASE_URL,
  
  // Deep linking
  scheme: 'kriptik',
  
  // API endpoints
  endpoints: {
    auth: {
      login: '/api/mobile/auth/login',
      signup: '/api/mobile/auth/signup',
      refresh: '/api/mobile/auth/refresh',
      me: '/api/mobile/auth/me',
      logout: '/api/mobile/auth/logout',
      oauthStart: '/api/mobile/auth/oauth/start',
      qrLogin: '/api/mobile/auth/qr-login',
    },
    projects: {
      list: '/api/projects',
      create: '/api/projects',
      get: (id: string) => `/api/projects/${id}`,
      update: (id: string) => `/api/projects/${id}`,
      delete: (id: string) => `/api/projects/${id}`,
      archive: (id: string) => `/api/projects/${id}/archive`,
    },
    builds: {
      recent: '/api/builds/recent',
      get: (id: string) => `/api/builds/${id}`,
      stream: '/api/mobile/chat/stream',
    },
    agents: {
      list: '/api/agents',
      get: (id: string) => `/api/agents/${id}`,
      deploy: '/api/agents/deploy',
      stop: (id: string) => `/api/agents/${id}/stop`,
    },
    training: {
      jobs: '/api/training/jobs',
      create: '/api/training/jobs',
      get: (id: string) => `/api/training/jobs/${id}`,
      cancel: (id: string) => `/api/training/jobs/${id}/cancel`,
    },
    models: {
      list: '/api/models',
      available: '/api/models/available',
    },
    notifications: {
      list: '/api/notifications',
      markRead: (id: string) => `/api/notifications/${id}/read`,
      markAllRead: '/api/notifications/read-all',
      settings: '/api/notifications/settings',
    },
  },
  
  // Storage keys
  storage: {
    accessToken: 'kriptik_access_token',
    refreshToken: 'kriptik_refresh_token',
    expiresAt: 'kriptik_expires_at',
    onboardingComplete: 'kriptik_onboarding_complete',
    biometricEnabled: 'kriptik_biometric_enabled',
    pushToken: 'kriptik_push_token',
  },
  
  // Feature flags
  features: {
    voiceInput: true,
    biometricAuth: true,
    pushNotifications: true,
    qrCodeLogin: true,
    offlineMode: false, // Coming soon
  },
  
  // Limits
  limits: {
    maxAgents: 6,
    maxProjectNameLength: 50,
    maxPromptLength: 10000,
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
  },
};

export default APP_CONFIG;
