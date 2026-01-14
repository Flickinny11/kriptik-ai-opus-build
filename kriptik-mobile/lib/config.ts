/**
 * KripTik Mobile Configuration
 */

import Constants from 'expo-constants';

// CRITICAL: Must match web app API URL (kriptik.app, NOT kriptik.ai)
export const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'https://api.kriptik.app';

export const config = {
  api: {
    baseUrl: API_BASE_URL,
    timeout: 30000,
  },
  auth: {
    tokenKey: 'kriptik_access_token',
    refreshKey: 'kriptik_refresh_token',
  },
  push: {
    projectId: Constants.expoConfig?.extra?.eas?.projectId || '',
  },
  deepLinking: {
    scheme: 'kriptik',
    domains: ['app.kriptik.app', 'kriptik.app'],
  },
} as const;
