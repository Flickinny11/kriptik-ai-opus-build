/**
 * KripTik Mobile Auth Utilities
 *
 * Handles OAuth flows with Better Auth backend
 */

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { api, type User } from './api';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.kriptik.ai';

// Ensure web browser can handle auth redirects
WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'github' | 'google';

interface OAuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * Initiates OAuth flow with the specified provider
 */
export async function signInWithOAuth(provider: OAuthProvider): Promise<OAuthResult> {
  try {
    // Create redirect URL using the kriptik:// scheme
    const redirectUri = Linking.createURL('auth/callback');

    // Build the OAuth URL
    const authUrl = `${API_BASE_URL}/api/auth/sign-in/social?provider=${provider}&redirectUri=${encodeURIComponent(redirectUri)}`;

    // Open the browser for OAuth
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type !== 'success') {
      return {
        success: false,
        error: result.type === 'cancel' ? 'Sign in cancelled' : 'Sign in failed',
      };
    }

    // Parse the callback URL for tokens
    const url = Linking.parse(result.url);
    const token = url.queryParams?.token as string | undefined;
    const refreshToken = url.queryParams?.refreshToken as string | undefined;
    const error = url.queryParams?.error as string | undefined;

    if (error) {
      return { success: false, error };
    }

    if (!token) {
      return { success: false, error: 'No authentication token received' };
    }

    // Store the tokens
    await api.setAuthToken(token);
    if (refreshToken) {
      await api.setRefreshToken(refreshToken);
    }

    // Fetch the user session
    const sessionResult = await api.getSession();
    if (!sessionResult.success || !sessionResult.data?.user) {
      return { success: false, error: 'Failed to get user session' };
    }

    return { success: true, user: sessionResult.data.user };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'OAuth sign in failed',
    };
  }
}

/**
 * Signs in with email and password
 */
export async function signInWithEmail(email: string, password: string): Promise<OAuthResult> {
  const result = await api.login(email, password);

  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Sign in failed' };
  }

  // Store the tokens
  await api.setAuthToken(result.data.token);
  if (result.data.refreshToken) {
    await api.setRefreshToken(result.data.refreshToken);
  }

  return { success: true, user: result.data.user };
}

/**
 * Signs up with email and password
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  name: string
): Promise<OAuthResult> {
  const result = await api.signup(email, password, name);

  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Sign up failed' };
  }

  // Store the tokens
  await api.setAuthToken(result.data.token);
  if (result.data.refreshToken) {
    await api.setRefreshToken(result.data.refreshToken);
  }

  return { success: true, user: result.data.user };
}

/**
 * Signs out the current user
 */
export async function signOut(): Promise<void> {
  await api.signOut();
}

/**
 * Checks if the user has a valid session
 */
export async function checkSession(): Promise<User | null> {
  const token = await api.getAuthToken();
  if (!token) return null;

  const result = await api.getSession();
  if (!result.success || !result.data?.user) {
    return null;
  }

  return result.data.user;
}
