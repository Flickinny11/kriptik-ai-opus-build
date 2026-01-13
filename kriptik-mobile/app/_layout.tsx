/**
 * KripTik Mobile Root Layout
 *
 * Handles:
 * - Navigation structure
 * - Auth state
 * - Theme setup
 * - Push notification setup
 */

import { useEffect, useCallback } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { useAuthStore } from '@/store/useAuthStore';
import {
  registerForPushNotifications,
  addNotificationResponseListener,
  parseNotificationData,
} from '@/lib/notifications';
import '../global.css';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { user, isLoading, isAuthenticated, checkAuth } = useAuthStore();

  // Load fonts
  const [fontsLoaded, fontError] = useFonts({
    'DM Sans': require('../assets/fonts/DMSans-Regular.ttf'),
    'DM Sans Medium': require('../assets/fonts/DMSans-Medium.ttf'),
    'DM Sans Bold': require('../assets/fonts/DMSans-Bold.ttf'),
    Outfit: require('../assets/fonts/Outfit-Regular.ttf'),
    'Outfit Medium': require('../assets/fonts/Outfit-Medium.ttf'),
    'Outfit Bold': require('../assets/fonts/Outfit-Bold.ttf'),
    'JetBrains Mono': require('../assets/fonts/JetBrainsMono-Regular.ttf'),
  });

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Handle splash screen
  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Handle auth redirect
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (isAuthenticated && inAuthGroup) {
      // User is signed in but on auth screen, redirect to main
      router.replace('/(tabs)');
    } else if (!isAuthenticated && !inAuthGroup) {
      // User is not signed in and not on auth screen, redirect to login
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, segments, isLoading, router]);

  // Setup push notifications when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    // Register for push notifications
    registerForPushNotifications();

    // Handle notification taps
    const subscription = addNotificationResponseListener((response) => {
      const data = parseNotificationData(response);
      if (!data) return;

      // Navigate based on notification type
      if (data.type === 'build_complete' || data.type === 'build_failed') {
        if (data.buildId) {
          router.push(`/build/${data.buildId}`);
        }
      } else if (data.type === 'feature_agent_complete') {
        if (data.projectId) {
          router.push(`/project/${data.projectId}`);
        }
      }
    });

    return () => subscription.remove();
  }, [isAuthenticated, router]);

  // Show loading while checking auth and fonts
  if (isLoading || (!fontsLoaded && !fontError)) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#0C0A09',
        }}
      >
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0C0A09' }} onLayout={onLayoutRootView}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0C0A09' },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(auth)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="project/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="build/[id]" options={{ presentation: 'card' }} />
      </Stack>
    </View>
  );
}
