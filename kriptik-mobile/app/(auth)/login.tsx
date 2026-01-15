/**
 * Premium KripTik Login Screen
 *
 * Features:
 * - 3D animated background elements
 * - Glass morphism design
 * - One-click OAuth login (GitHub, Google)
 * - Seamless sync with kriptik.app account
 * - Premium smooth animations
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import * as ExpoClipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useAuthStore } from '../../store/auth-store';
import { APP_CONFIG } from '../../lib/config';

WebBrowser.maybeCompleteAuthSession();

// Premium amber/gold color palette
const COLORS = {
  bg: '#0C0A09',
  bgSecondary: '#1C1917',
  accent1: '#D97706',
  accent2: '#F59E0B',
  accent3: '#FBBF24',
  text: '#F5F5F4',
  textMuted: '#A8A29E',
  textDim: '#78716C',
  glass: 'rgba(28, 25, 23, 0.8)',
  glassBorder: 'rgba(217, 119, 6, 0.15)',
  inputBg: 'rgba(41, 37, 36, 0.6)',
  error: '#EF4444',
};

// GitHub Device Flow state
interface GitHubDeviceFlowState {
  isActive: boolean;
  userCode: string;
  verificationUri: string;
  flowId: string;
  expiresIn: number;
  interval: number;
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, setUser, setTokens, isLoading } = useAuthStore();

  // GitHub Device Flow state
  const [githubFlow, setGithubFlow] = useState<GitHubDeviceFlowState | null>(null);
  const [githubPolling, setGithubPolling] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Screen fade-in for smooth transition from splash
  const screenOpacity = useSharedValue(0);

  // Ambient glow animation
  const glowPulse = useSharedValue(0);

  useEffect(() => {
    // Smooth fade-in from splash
    screenOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) });

    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Cleanup on unmount
    return () => {
      // Clear any polling intervals
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      // Dismiss any open browser sessions
      WebBrowser.dismissBrowser().catch(() => {
        // Ignore errors - browser may not be open
      });
    };
  }, []);

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [0.5, 1], [0.3, 0.6]),
    transform: [{ scale: interpolate(glowPulse.value, [0.5, 1], [0.95, 1.05]) }],
  }));

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter your email and password');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setError('');
    const result = await login(email, password);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } else {
      setError(result.error || 'Login failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Start GitHub Device Flow
  const startGitHubDeviceFlow = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError('');

    try {
      console.log('[GitHub] Starting Device Flow...');

      const response = await fetch(`${APP_CONFIG.apiUrl}/api/mobile/auth/github/device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data = await response.json();
      console.log('[GitHub] Device Flow started:', data);

      if (!data.success) {
        setError(data.error || 'Failed to start GitHub authentication');
        return;
      }

      // Show the user code modal
      setGithubFlow({
        isActive: true,
        userCode: data.userCode,
        verificationUri: data.verificationUri,
        flowId: data.flowId,
        expiresIn: data.expiresIn,
        interval: data.interval || 5,
      });

      // Start polling for authorization
      setGithubPolling(true);
      pollGitHubAuthorization(data.flowId, data.interval || 5);

    } catch (error) {
      console.error('[GitHub] Device Flow error:', error);
      setError('Failed to start GitHub authentication. Please try again.');
    }
  }, []);

  // Poll GitHub for authorization completion
  const pollGitHubAuthorization = useCallback((flowId: string, interval: number) => {
    let pollCount = 0;
    const maxPolls = 60; // Max 5 minutes at 5 second intervals

    const poll = async () => {
      pollCount++;
      if (pollCount > maxPolls) {
        setGithubFlow(null);
        setGithubPolling(false);
        setError('GitHub authentication timed out. Please try again.');
        return;
      }

      try {
        const response = await fetch(`${APP_CONFIG.apiUrl}/api/mobile/auth/github/device/poll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flowId }),
          credentials: 'include',
        });

        const data = await response.json();
        console.log('[GitHub] Poll response:', data.status || data.error);

        if (data.success && data.status === 'complete') {
          // Authorization successful!
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          setGithubFlow(null);
          setGithubPolling(false);

          // Set auth state
          await setTokens(data.accessToken, data.refreshToken);
          setUser(data.user);

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace('/(tabs)');
          return;
        }

        if (data.error === 'expired' || data.error === 'denied') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setGithubFlow(null);
          setGithubPolling(false);
          setError(data.message || 'GitHub authentication failed');
          return;
        }

        // Update interval if GitHub asks us to slow down
        if (data.status === 'slow_down' && data.interval) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          pollIntervalRef.current = setInterval(poll, data.interval * 1000);
        }

        // Otherwise keep polling (authorization_pending)
      } catch (error) {
        console.error('[GitHub] Poll error:', error);
        // Continue polling on network errors
      }
    };

    // Start polling
    pollIntervalRef.current = setInterval(poll, interval * 1000);
    // Also poll immediately
    poll();
  }, [setTokens, setUser]);

  // Cancel GitHub Device Flow
  const cancelGitHubFlow = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setGithubFlow(null);
    setGithubPolling(false);
  }, []);

  // Copy user code to clipboard
  const copyUserCode = useCallback(async () => {
    if (githubFlow?.userCode) {
      await ExpoClipboard.setStringAsync(githubFlow.userCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [githubFlow?.userCode]);

  // Open GitHub verification URL
  const openGitHubVerification = useCallback(() => {
    if (githubFlow?.verificationUri) {
      Linking.openURL(`${githubFlow.verificationUri}?code=${githubFlow.userCode}`);
    }
  }, [githubFlow]);

  // Handle OAuth for Google (still uses web redirect)
  const handleGoogleOAuth = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError('');

    try {
      // Validate API URL is configured
      if (!APP_CONFIG.apiUrl) {
        console.error('[OAuth] APP_CONFIG.apiUrl is not configured!');
        setError('OAuth configuration error. Please update the app.');
        return;
      }

      const authUrl = `${APP_CONFIG.apiUrl}/api/mobile/auth/oauth/start/google`;
      console.log('[OAuth] Starting Google auth:', authUrl);

      // Validate URL format before opening
      try {
        new URL(authUrl);
      } catch (urlError) {
        console.error('[OAuth] Invalid URL:', authUrl);
        setError('Invalid authentication URL. Please try again.');
        return;
      }

      // CRITICAL: Dismiss any existing browser session before opening a new one
      // This prevents "Another web browser is already open" error
      try {
        await WebBrowser.dismissBrowser();
      } catch (dismissError) {
        // Ignore dismiss errors - browser may not be open
        console.log('[OAuth] No browser to dismiss (this is normal)');
      }

      // Small delay to ensure browser is fully dismissed
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        'kriptik://auth/callback',
        {
          showInRecents: true,
          preferEphemeralSession: true, // Use ephemeral session to avoid cookie issues
        }
      );

      console.log('[OAuth] WebBrowser result:', result);

      if (result.type === 'cancel') {
        console.log('[OAuth] User cancelled');
      } else if (result.type === 'dismiss') {
        console.log('[OAuth] Browser dismissed');
      }
    } catch (error) {
      console.error('[OAuth] Error:', error);
      // Provide more specific error messages
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMsg.includes('already open') || errorMsg.includes('Another web browser')) {
        // Try to dismiss and inform user to retry
        try {
          await WebBrowser.dismissBrowser();
        } catch (e) {
          // Ignore
        }
        setError('Browser was busy. Please try again.');
      } else if (errorMsg.includes('invalid')) {
        setError('Authentication URL is invalid. Please try again.');
      } else if (errorMsg.includes('network')) {
        setError('Network error. Please check your connection.');
      } else {
        setError('Failed to start authentication. Please try again.');
      }
    }
  };

  const handleOAuthLogin = async (provider: 'github' | 'google') => {
    if (provider === 'github') {
      startGitHubDeviceFlow();
    } else {
      handleGoogleOAuth();
    }
  };

  return (
    <Animated.View style={[styles.container, screenStyle]}>
      {/* Gradient background */}
      <LinearGradient
        colors={['#1a0f00', COLORS.bg, '#0a0705']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient glow */}
      <Animated.View style={[styles.ambientGlow, glowStyle]} />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.header}>
              {/* 3D Logo mark */}
              <View style={styles.logoContainer}>
                <LinearGradient
                  colors={[COLORS.accent2, COLORS.accent1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.logoGradient}
                >
                  <View style={styles.logoK}>
                    <View style={styles.logoKVertical} />
                    <View style={styles.logoKDiagonal1} />
                    <View style={styles.logoKDiagonal2} />
                  </View>
                </LinearGradient>
              </View>

              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Sign in to continue building</Text>
            </Animated.View>

            {/* Login Form */}
            <Animated.View entering={FadeInUp.delay(200).duration(600)} style={styles.formContainer}>
              <BlurView intensity={20} tint="dark" style={styles.formBlur}>
                <View style={styles.form}>
                  {/* Email Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email</Text>
                    <View style={[styles.inputWrapper, error && !email && styles.inputError]}>
                      <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@example.com"
                        placeholderTextColor={COLORS.textDim}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                      />
                    </View>
                  </View>

                  {/* Password Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Password</Text>
                    <View style={[styles.inputWrapper, error && !password && styles.inputError]}>
                      <TextInput
                        style={styles.input}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="••••••••"
                        placeholderTextColor={COLORS.textDim}
                        secureTextEntry={!showPassword}
                        autoComplete="password"
                      />
                      <TouchableOpacity
                        style={styles.showPassword}
                        onPress={() => setShowPassword(!showPassword)}
                      >
                        <Text style={styles.showPasswordText}>
                          {showPassword ? 'Hide' : 'Show'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Error message */}
                  {error ? (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  {/* Sign In Button */}
                  <TouchableOpacity
                    style={styles.signInButton}
                    onPress={handleLogin}
                    activeOpacity={0.9}
                    disabled={isLoading}
                  >
                    <LinearGradient
                      colors={[COLORS.accent1, COLORS.accent2]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.signInGradient}
                    >
                      {isLoading ? (
                        <ActivityIndicator color={COLORS.bg} />
                      ) : (
                        <Text style={styles.signInText}>Sign In</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Forgot password */}
                  <TouchableOpacity
                    style={styles.forgotPassword}
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.push('/(auth)/forgot-password');
                    }}
                  >
                    <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                  </TouchableOpacity>
                </View>
              </BlurView>
            </Animated.View>

            {/* Divider */}
            <Animated.View entering={FadeInUp.delay(300).duration(600)} style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.divider} />
            </Animated.View>

            {/* OAuth Buttons */}
            <Animated.View entering={FadeInUp.delay(400).duration(600)} style={styles.oauthContainer}>
              {/* GitHub - with official logo */}
              <TouchableOpacity
                style={styles.oauthButton}
                onPress={() => handleOAuthLogin('github')}
                activeOpacity={0.8}
              >
                <BlurView intensity={30} tint="dark" style={styles.oauthBlur}>
                  <View style={styles.oauthContent}>
                    {/* GitHub Octocat SVG-like icon */}
                    <Svg width={24} height={24} viewBox="0 0 24 24" fill="#FFFFFF">
                      <Path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </Svg>
                    <Text style={styles.oauthText}>GitHub</Text>
                  </View>
                </BlurView>
              </TouchableOpacity>

              {/* Google - with official colored logo */}
              <TouchableOpacity
                style={styles.oauthButton}
                onPress={() => handleOAuthLogin('google')}
                activeOpacity={0.8}
              >
                <BlurView intensity={30} tint="dark" style={styles.oauthBlur}>
                  <View style={styles.oauthContent}>
                    {/* Google "G" logo with colors */}
                    <Svg width={24} height={24} viewBox="0 0 24 24">
                      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </Svg>
                    <Text style={styles.oauthText}>Google</Text>
                  </View>
                </BlurView>
              </TouchableOpacity>
            </Animated.View>

            {/* QR Scan Option */}
            <Animated.View entering={FadeInUp.delay(450).duration(600)}>
              <TouchableOpacity
                style={styles.qrScanButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/qr-scanner');
                }}
                activeOpacity={0.8}
              >
                <BlurView intensity={25} tint="dark" style={styles.qrScanBlur}>
                  <View style={styles.qrScanContent}>
                    {/* QR icon */}
                    <View style={styles.qrScanIcon}>
                      <View style={styles.qrScanSquare}>
                        <View style={styles.qrScanInner} />
                      </View>
                    </View>
                    <View style={styles.qrScanTextContainer}>
                      <Text style={styles.qrScanTitle}>Scan from Web</Text>
                      <Text style={styles.qrScanSubtitle}>Instant sync with kriptik.app</Text>
                    </View>
                    {/* Arrow */}
                    <View style={styles.qrScanArrow}>
                      <View style={styles.qrArrowLine} />
                      <View style={styles.qrArrowHead} />
                    </View>
                  </View>
                </BlurView>
              </TouchableOpacity>
            </Animated.View>

            {/* Sign Up Link */}
            <Animated.View entering={FadeInUp.delay(500).duration(600)} style={styles.signupContainer}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push('/(auth)/signup');
                }}
              >
                <Text style={styles.signupLink}>Sign up</Text>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* GitHub Device Flow Modal */}
      <Modal
        visible={githubFlow?.isActive || false}
        transparent
        animationType="fade"
        onRequestClose={cancelGitHubFlow}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={40} tint="dark" style={styles.modalBlur}>
            <Animated.View entering={FadeIn.duration(300)} style={styles.modalContent}>
              {/* GitHub Logo */}
              <View style={styles.githubModalIcon}>
                <Svg width={48} height={48} viewBox="0 0 24 24" fill="#FFFFFF">
                  <Path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </Svg>
              </View>

              <Text style={styles.modalTitle}>Sign in to GitHub</Text>
              <Text style={styles.modalSubtitle}>
                Enter this code at github.com/login/device
              </Text>

              {/* User Code Display */}
              <TouchableOpacity
                style={styles.userCodeContainer}
                onPress={copyUserCode}
                activeOpacity={0.8}
              >
                <Text style={styles.userCode}>{githubFlow?.userCode || '----'}</Text>
                <Text style={styles.tapToCopy}>Tap to copy</Text>
              </TouchableOpacity>

              {/* Open GitHub Button */}
              <TouchableOpacity
                style={styles.openGitHubButton}
                onPress={openGitHubVerification}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#333', '#1a1a1a']}
                  style={styles.openGitHubGradient}
                >
                  <Text style={styles.openGitHubText}>Open GitHub</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Status */}
              <View style={styles.pollStatus}>
                {githubPolling && (
                  <>
                    <ActivityIndicator size="small" color={COLORS.accent1} />
                    <Text style={styles.pollStatusText}>Waiting for authorization...</Text>
                  </>
                )}
              </View>

              {/* Cancel Button */}
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={cancelGitHubFlow}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </Animated.View>
          </BlurView>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },

  // Ambient glow
  ambientGlow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(217, 119, 6, 0.2)',
    top: '15%',
    alignSelf: 'center',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.accent1,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  logoGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoK: {
    width: 24,
    height: 30,
    position: 'relative',
  },
  logoKVertical: {
    position: 'absolute',
    left: 0,
    width: 5,
    height: 30,
    backgroundColor: COLORS.bg,
    borderRadius: 2,
  },
  logoKDiagonal1: {
    position: 'absolute',
    left: 6,
    top: 0,
    width: 5,
    height: 18,
    backgroundColor: COLORS.bg,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }, { translateX: 3 }, { translateY: 3 }],
  },
  logoKDiagonal2: {
    position: 'absolute',
    left: 6,
    bottom: 0,
    width: 5,
    height: 18,
    backgroundColor: COLORS.bg,
    borderRadius: 2,
    transform: [{ rotate: '-45deg' }, { translateX: 3 }, { translateY: -3 }],
  },
  title: {
    fontSize: 32,
    fontFamily: 'Outfit-SemiBold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'DMSans-Regular',
    color: COLORS.textMuted,
  },

  // Form
  formContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    marginBottom: 24,
  },
  formBlur: {
    padding: 24,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'DMSans-Medium',
    color: COLORS.textMuted,
    marginLeft: 4,
  },
  inputWrapper: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 162, 158, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputError: {
    borderColor: COLORS.error,
  },
  input: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    fontFamily: 'DMSans-Regular',
    color: COLORS.text,
  },
  showPassword: {
    paddingHorizontal: 16,
  },
  showPasswordText: {
    fontSize: 14,
    fontFamily: 'DMSans-Medium',
    color: COLORS.accent1,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'DMSans-Regular',
    color: COLORS.error,
    textAlign: 'center',
  },
  signInButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.accent1,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  signInGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInText: {
    fontSize: 16,
    fontFamily: 'DMSans-SemiBold',
    color: COLORS.bg,
    letterSpacing: 0.5,
  },
  forgotPassword: {
    alignItems: 'center',
    paddingTop: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontFamily: 'DMSans-Medium',
    color: COLORS.accent1,
  },

  // Divider
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(168, 162, 158, 0.2)',
  },
  dividerText: {
    fontSize: 14,
    fontFamily: 'DMSans-Regular',
    color: COLORS.textDim,
    marginHorizontal: 16,
  },

  // OAuth
  oauthContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  oauthButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  oauthBlur: {
    paddingVertical: 14,
  },
  oauthContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  oauthText: {
    fontSize: 15,
    fontFamily: 'DMSans-Medium',
    color: COLORS.text,
  },

  // QR Scan
  qrScanButton: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    marginBottom: 24,
  },
  qrScanBlur: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  qrScanContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qrScanIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrScanSquare: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: COLORS.accent1,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrScanInner: {
    width: 8,
    height: 8,
    borderWidth: 1.5,
    borderColor: COLORS.accent2,
    borderRadius: 2,
  },
  qrScanTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  qrScanTitle: {
    fontSize: 15,
    fontFamily: 'DMSans-SemiBold',
    color: COLORS.text,
  },
  qrScanSubtitle: {
    fontSize: 12,
    fontFamily: 'DMSans-Regular',
    color: COLORS.textDim,
    marginTop: 2,
  },
  qrScanArrow: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  qrArrowLine: {
    width: 10,
    height: 2,
    backgroundColor: COLORS.textDim,
    borderRadius: 1,
  },
  qrArrowHead: {
    position: 'absolute',
    right: 5,
    width: 7,
    height: 7,
    borderRightWidth: 2,
    borderTopWidth: 2,
    borderColor: COLORS.textDim,
    transform: [{ rotate: '45deg' }],
  },

  // Sign Up
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signupText: {
    fontSize: 15,
    fontFamily: 'DMSans-Regular',
    color: COLORS.textMuted,
  },
  signupLink: {
    fontSize: 15,
    fontFamily: 'DMSans-SemiBold',
    color: COLORS.accent1,
  },

  // GitHub Device Flow Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBlur: {
    borderRadius: 24,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 340,
  },
  modalContent: {
    padding: 32,
    alignItems: 'center',
  },
  githubModalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#24292e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: 'Outfit-SemiBold',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: 'DMSans-Regular',
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  userCodeContainer: {
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 32,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
    alignItems: 'center',
  },
  userCode: {
    fontSize: 36,
    fontFamily: 'JetBrainsMono-Bold',
    color: COLORS.accent2,
    letterSpacing: 6,
  },
  tapToCopy: {
    fontSize: 12,
    fontFamily: 'DMSans-Regular',
    color: COLORS.textDim,
    marginTop: 8,
  },
  openGitHubButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  openGitHubGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openGitHubText: {
    fontSize: 16,
    fontFamily: 'DMSans-SemiBold',
    color: '#fff',
  },
  pollStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 24,
    marginBottom: 16,
  },
  pollStatusText: {
    fontSize: 14,
    fontFamily: 'DMSans-Regular',
    color: COLORS.textMuted,
  },
  cancelButton: {
    paddingVertical: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans-Medium',
    color: COLORS.textDim,
  },
});
