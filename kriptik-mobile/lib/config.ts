/**
 * KripTik Mobile Configuration
 */

import Constants from 'expo-constants';

export const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'https://api.kriptik.ai';

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
    domains: ['app.kriptik.ai', 'kriptik.ai'],
  },
} as const;
