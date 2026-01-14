/**
 * Deep Linking Handler for KripTik Mobile
 * Handles app-to-app and web-to-app navigation
 */

import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/auth-store';

// URL scheme: kriptik://
// Web URLs: https://kriptik.app/mobile/*

interface DeepLinkRoute {
  pattern: RegExp;
  handler: (params: Record<string, string>) => void;
}

const routes: DeepLinkRoute[] = [
  // Auth callback
  {
    pattern: /^\/auth\/callback\??(.*)$/,
    handler: (params) => {
      // Handle OAuth callback
      if (params.token) {
        // Store token and navigate to home
        router.replace('/(tabs)');
      }
    },
  },

  // Project deep link
  {
    pattern: /^\/project\/([a-zA-Z0-9-]+)$/,
    handler: (params) => {
      if (params.id) {
        router.push(`/project/${params.id}`);
      }
    },
  },

  // Build deep link
  {
    pattern: /^\/build\/([a-zA-Z0-9-]+)$/,
    handler: (params) => {
      if (params.id) {
        router.push(`/build/${params.id}`);
      }
    },
  },

  // Agent deep link
  {
    pattern: /^\/agent\/([a-zA-Z0-9-]+)$/,
    handler: (params) => {
      if (params.id) {
        router.push(`/feature-agent/${params.id}`);
      }
    },
  },

  // Training job deep link
  {
    pattern: /^\/training\/([a-zA-Z0-9-]+)$/,
    handler: (params) => {
      if (params.id) {
        router.push(`/ai-lab/training/${params.id}`);
      }
    },
  },

  // QR pairing
  {
    pattern: /^\/pair\?code=([a-zA-Z0-9]+)$/,
    handler: (params) => {
      if (params.code) {
        // Handle device pairing
        handleDevicePairing(params.code);
      }
    },
  },

  // New build from web
  {
    pattern: /^\/new-build\??(.*)$/,
    handler: (params) => {
      router.push({
        pathname: '/new-build',
        params: params,
      });
    },
  },
];

async function handleDevicePairing(code: string) {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // TODO: Implement pairing logic with backend
    router.push('/(tabs)/settings');
  } catch (error) {
    console.error('Pairing failed:', error);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
}

function parseUrl(url: string): { path: string; params: Record<string, string> } {
  const parsed = Linking.parse(url);
  const path = parsed.path || '';
  const params: Record<string, string> = {};

  // Extract query params
  if (parsed.queryParams) {
    Object.entries(parsed.queryParams).forEach(([key, value]) => {
      if (typeof value === 'string') {
        params[key] = value;
      }
    });
  }

  // Extract path params from URL
  const pathMatch = path.match(/\/([a-zA-Z0-9-]+)$/);
  if (pathMatch) {
    params.id = pathMatch[1];
  }

  return { path, params };
}

function handleUrl(url: string) {
  const { path, params } = parseUrl(url);

  // Check if user is authenticated
  const { isAuthenticated } = useAuthStore.getState();

  if (!isAuthenticated) {
    // Store the deep link to handle after auth
    // For now, just redirect to login
    router.replace('/(auth)/login');
    return;
  }

  // Find matching route
  for (const route of routes) {
    const match = path.match(route.pattern);
    if (match) {
      // Extract capture groups as params
      const extractedParams = { ...params };
      match.slice(1).forEach((value, index) => {
        if (value) {
          extractedParams[`group${index}`] = value;
          // Also try to set common param names
          if (index === 0 && !extractedParams.id) {
            extractedParams.id = value;
          }
        }
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      route.handler(extractedParams);
      return;
    }
  }

  // No matching route, go to home
  router.replace('/(tabs)');
}

export function handleDeepLink() {
  // Handle initial URL (app opened via deep link)
  Linking.getInitialURL().then((url) => {
    if (url) {
      handleUrl(url);
    }
  });

  // Handle URLs while app is running
  const subscription = Linking.addEventListener('url', (event) => {
    handleUrl(event.url);
  });

  return () => {
    subscription.remove();
  };
}

export function createDeepLink(path: string, params?: Record<string, string>): string {
  const baseUrl = Linking.createURL(path);
  
  if (params && Object.keys(params).length > 0) {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    return `${baseUrl}?${queryString}`;
  }

  return baseUrl;
}

export function openWebBuilder(projectId?: string) {
  const url = projectId
    ? `https://kriptik.app/builder/${projectId}`
    : 'https://kriptik.app/builder';
  
  Linking.openURL(url);
}
