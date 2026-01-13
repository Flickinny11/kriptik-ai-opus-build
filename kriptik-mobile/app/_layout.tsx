import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth-store';
import { useNotificationStore } from '../store/notification-store';
import { setupNotificationListeners } from '../lib/notifications';
import { handleDeepLink } from '../lib/deep-linking';
import { colors } from '../lib/design-system';
import '../global.css';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

export default function RootLayout() {
  const { checkAuth } = useAuthStore();
  const { initialize: initNotifications } = useNotificationStore();

  const [fontsLoaded] = useFonts({
    'CalSans-SemiBold': require('../assets/fonts/CalSans-SemiBold.otf'),
    'Outfit-SemiBold': require('../assets/fonts/Outfit-SemiBold.ttf'),
    'DMSans-Regular': require('../assets/fonts/DMSans-Regular.ttf'),
    'DMSans-Medium': require('../assets/fonts/DMSans-Medium.ttf'),
    'DMSans-SemiBold': require('../assets/fonts/DMSans-SemiBold.ttf'),
    'JetBrainsMono-Regular': require('../assets/fonts/JetBrainsMono-Regular.ttf'),
  });

  useEffect(() => {
    async function prepare() {
      try {
        // Check authentication status
        await checkAuth();

        // Setup push notifications
        await initNotifications();

        // Setup deep link handling
        handleDeepLink();

        // Setup notification listeners
        const cleanup = setupNotificationListeners();

        return cleanup;
      } catch (e) {
        console.warn('Initialization error:', e);
      } finally {
        if (fontsLoaded) {
          await SplashScreen.hideAsync();
        }
      }
    }

    if (fontsLoaded) {
      prepare();
    }
  }, [fontsLoaded, checkAuth, initNotifications]);

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
