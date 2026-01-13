import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius } from '../../lib/design-system';
import { Input, Button, GlassCard } from '../../components/ui';
import { useAuthStore } from '../../store/auth-store';
import { KripTikLogoIcon, GithubIcon, GoogleIcon } from '../../components/icons';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuthStore();

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

  const handleOAuthLogin = async (provider: 'github' | 'google') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // TODO: Implement OAuth flow with expo-auth-session
    const authUrl = `https://api.kriptik.ai/api/auth/sign-in/${provider}`;
    await WebBrowser.openAuthSessionAsync(authUrl, 'kriptik://auth/callback');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo and Welcome */}
          <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
            <View style={styles.logoContainer}>
              <KripTikLogoIcon size={80} />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue building</Text>
          </Animated.View>

          {/* Login Form */}
          <Animated.View entering={FadeInUp.delay(200)} style={styles.form}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={error && !email ? 'Email is required' : undefined}
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              isPassword
              autoComplete="password"
              error={error && !password ? 'Password is required' : undefined}
            />

            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={isLoading}
              fullWidth
              size="lg"
            />

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/(auth)/forgot-password');
              }}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Divider */}
          <Animated.View entering={FadeInUp.delay(300)} style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.divider} />
          </Animated.View>

          {/* OAuth Buttons */}
          <Animated.View entering={FadeInUp.delay(400)} style={styles.oauthContainer}>
            <GlassCard
              style={styles.oauthButton}
              onPress={() => handleOAuthLogin('github')}
            >
              <View style={styles.oauthContent}>
                <GithubIcon size={24} color={colors.text.primary} />
                <Text style={styles.oauthText}>GitHub</Text>
              </View>
            </GlassCard>

            <GlassCard
              style={styles.oauthButton}
              onPress={() => handleOAuthLogin('google')}
            >
              <View style={styles.oauthContent}>
                <GoogleIcon size={24} color={colors.text.primary} />
                <Text style={styles.oauthText}>Google</Text>
              </View>
            </GlassCard>
          </Animated.View>

          {/* Sign Up Link */}
          <Animated.View entering={FadeInUp.delay(500)} style={styles.signupContainer}>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  logoContainer: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
  },
  form: {
    marginBottom: spacing['2xl'],
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.status.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  forgotPasswordText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bodyMedium,
    color: colors.accent.primary,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.default,
  },
  dividerText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.tertiary,
    marginHorizontal: spacing.lg,
  },
  oauthContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing['3xl'],
  },
  oauthButton: {
    flex: 1,
    padding: spacing.lg,
  },
  oauthContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  oauthText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bodyMedium,
    color: colors.text.primary,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signupText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
  },
  signupLink: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.accent.primary,
  },
});
