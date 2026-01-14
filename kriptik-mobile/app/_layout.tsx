import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from '@expo-google-fonts/dm-sans';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import { useAuthStore } from '../store/auth-store';
import { useNotificationStore } from '../store/notification-store';
import { setupNotificationListeners } from '../lib/notifications';
import { handleDeepLink } from '../lib/deep-linking';
import { colors } from '../lib/design-system';
import '../global.css';

SplashScreen.preventAutoHideAsync();

const ONBOARDING_COMPLETE_KEY = 'kriptik_onboarding_complete';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

export default function RootLayout() {
  const { checkAuth, isAuthenticated, isLoading } = useAuthStore();
  const { initialize: initNotifications } = useNotificationStore();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);
  const [isReady, setIsReady] = useState(false);

  const [fontsLoaded] = useFonts({
    'CalSans-SemiBold': require('../assets/fonts/CalSans-SemiBold.otf'),
    'Outfit-SemiBold': Outfit_600SemiBold,
    'DMSans-Regular': DMSans_400Regular,
    'DMSans-Medium': DMSans_500Medium,
    'DMSans-SemiBold': DMSans_600SemiBold,
    'JetBrainsMono-Regular': JetBrainsMono_400Regular,
  });

  useEffect(() => {
    async function prepare() {
      // Hide splash screen immediately when fonts are ready
      await SplashScreen.hideAsync();
      
      try {
        // Check if user has completed onboarding
        const onboardingComplete = await SecureStore.getItemAsync(ONBOARDING_COMPLETE_KEY);
        setHasCompletedOnboarding(onboardingComplete === 'true');

        // Check authentication status (with timeout)
        const authPromise = checkAuth();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth timeout')), 5000)
        );
        
        try {
          await Promise.race([authPromise, timeoutPromise]);
        } catch (authError) {
          console.warn('Auth check failed or timed out:', authError);
        }

        // Setup push notifications (non-blocking)
        initNotifications().catch(e => console.warn('Notification init error:', e));

        // Setup deep link handling
        handleDeepLink();

        // Setup notification listeners
        setupNotificationListeners();

        setIsReady(true);
      } catch (e) {
        console.warn('Initialization error:', e);
        setIsReady(true);
      }
    }

    if (fontsLoaded) {
      prepare();
    }
  }, [fontsLoaded, checkAuth, initNotifications]);

  // Navigate based on auth state after ready
  useEffect(() => {
    if (!isReady || isLoading || hasCompletedOnboarding === null) return;

    // First time user - show onboarding
    if (!hasCompletedOnboarding) {
      router.replace('/onboarding');
      return;
    }

    // Returning user - check auth
    if (isAuthenticated) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(auth)/login');
    }
  }, [isReady, isLoading, isAuthenticated, hasCompletedOnboarding]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background.primary }}>
        <StatusBar style="light" backgroundColor={colors.background.primary} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background.primary },
            animation: 'slide_from_right',
          }}
        >
          {/* Onboarding Flow */}
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />

          {/* Auth Flow */}
          <Stack.Screen name="(auth)" options={{ animation: 'slide_from_bottom' }} />

          {/* Main App (Tab Navigation) */}
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />

          {/* Modal Screens */}
          <Stack.Screen
            name="new-build"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="build/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="project/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="feature-agent/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="ai-lab/training/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="qr-scanner"
            options={{ presentation: 'fullScreenModal' }}
          />
          <Stack.Screen
            name="voice-input"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
        </Stack>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
