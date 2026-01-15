/**
 * OAuth Callback Handler
 *
 * Handles deep link callbacks from OAuth providers
 * URL format: kriptik://auth/callback?access_token=...&refresh_token=...
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import storage from '../../lib/storage';
import { useAuthStore } from '../../store/auth-store';

const ONBOARDING_COMPLETE_KEY = 'kriptik_onboarding_complete';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();
  const { setTokens, setUser } = useAuthStore();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function handleCallback() {
      try {
        const {
          access_token,
          refresh_token,
          user_id,
          user_email,
          user_name,
          error
        } = params;

        // Check for errors
        if (error) {
          console.error('[Auth Callback] OAuth error:', error);
          setStatus('error');
          setErrorMessage(getErrorMessage(error as string));
          setTimeout(() => router.replace('/(auth)/login'), 2000);
          return;
        }

        // Validate required params
        if (!access_token || !refresh_token) {
          console.error('[Auth Callback] Missing tokens');
          setStatus('error');
          setErrorMessage('Authentication failed. Please try again.');
          setTimeout(() => router.replace('/(auth)/login'), 2000);
          return;
        }

        // Save tokens
        await setTokens(access_token as string, refresh_token as string);

        // Set user data
        if (user_id && user_email) {
          setUser({
            id: user_id as string,
            email: user_email as string,
            name: (user_name as string) || (user_email as string).split('@')[0],
            createdAt: new Date().toISOString(),
          });
        }

        // Mark onboarding as complete
        await storage.setItemAsync(ONBOARDING_COMPLETE_KEY, 'true');

        setStatus('success');

        // Navigate to main app
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 1000);

      } catch (error) {
        console.error('[Auth Callback] Error:', error);
        setStatus('error');
        setErrorMessage('Something went wrong. Please try again.');
        setTimeout(() => router.replace('/(auth)/login'), 2000);
      }
    }

    handleCallback();
  }, [params]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a0f00', '#0C0A09', '#0a0705']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.content}>
          {status === 'processing' && (
            <>
              <ActivityIndicator size="large" color="#D97706" />
              <Text style={styles.title}>Signing you in...</Text>
              <Text style={styles.subtitle}>Please wait</Text>
            </>
          )}

          {status === 'success' && (
            <>
              <View style={styles.successIcon}>
                <Text style={styles.checkmark}>✓</Text>
              </View>
              <Text style={styles.title}>Welcome!</Text>
              <Text style={styles.subtitle}>Redirecting to your dashboard...</Text>
            </>
          )}

          {status === 'error' && (
            <>
              <View style={styles.errorIcon}>
                <Text style={styles.errorX}>✕</Text>
              </View>
              <Text style={styles.title}>Oops!</Text>
              <Text style={styles.subtitle}>{errorMessage}</Text>
            </>
          )}
        </View>
      </View>
    </>
  );
}

function getErrorMessage(error: string): string {
  switch (error) {
    case 'missing_params':
      return 'Missing authentication data';
    case 'invalid_state':
      return 'Invalid session. Please try again.';
    case 'state_expired':
      return 'Session expired. Please try again.';
    case 'token_exchange_failed':
      return 'Authentication failed. Please try again.';
    case 'no_user_info':
      return 'Could not get your account info.';
    case 'server_error':
      return 'Server error. Please try again.';
    default:
      return error || 'Unknown error occurred';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0A09',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Outfit-SemiBold',
    color: '#F5F5F4',
    marginTop: 24,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'DMSans-Regular',
    color: '#A8A29E',
    marginTop: 8,
    textAlign: 'center',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 40,
    color: '#22C55E',
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorX: {
    fontSize: 40,
    color: '#EF4444',
  },
});
