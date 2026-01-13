/**
 * Login Screen
 *
 * Email/password and OAuth sign in
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useAuthStore } from '@/store/useAuthStore';
import { signInWithEmail, signInWithOAuth, type OAuthProvider } from '@/lib/auth';

export default function LoginScreen() {
  const router = useRouter();
  const { setUser, setError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleEmailLogin = async () => {
    if (!email.trim() || !password) {
      setLocalError('Please enter your email and password');
      return;
    }

    setIsLoading(true);
    setLocalError(null);

    const result = await signInWithEmail(email.trim(), password);

    if (result.success && result.user) {
      setUser(result.user);
      router.replace('/(tabs)');
    } else {
      setLocalError(result.error || 'Sign in failed');
    }

    setIsLoading(false);
  };

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    setIsLoading(true);
    setLocalError(null);

    const result = await signInWithOAuth(provider);

    if (result.success && result.user) {
      setUser(result.user);
      router.replace('/(tabs)');
    } else {
      setLocalError(result.error || 'Sign in failed');
    }

    setIsLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#0C0A09' }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              backgroundColor: '#F59E0B20',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 40 }}>K</Text>
          </View>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: '#FFFFFF',
              fontFamily: 'Outfit Bold',
            }}
          >
            KripTik AI
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: '#A8A29E',
              marginTop: 4,
              fontFamily: 'DM Sans',
            }}
          >
            Build apps with AI
          </Text>
        </View>

        {/* Error message */}
        {localError && (
          <View
            style={{
              backgroundColor: '#EF444420',
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: '#EF444440',
            }}
          >
            <Text style={{ color: '#EF4444', fontSize: 14, textAlign: 'center' }}>
              {localError}
            </Text>
          </View>
        )}

        {/* Email input */}
        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              color: '#A8A29E',
              fontSize: 13,
              marginBottom: 8,
              fontFamily: 'DM Sans Medium',
            }}
          >
            Email
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#57534E"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            style={{
              backgroundColor: '#1C1917',
              borderRadius: 12,
              padding: 16,
              fontSize: 16,
              color: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#292524',
              fontFamily: 'DM Sans',
            }}
          />
        </View>

        {/* Password input */}
        <View style={{ marginBottom: 8 }}>
          <Text
            style={{
              color: '#A8A29E',
              fontSize: 13,
              marginBottom: 8,
              fontFamily: 'DM Sans Medium',
            }}
          >
            Password
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor="#57534E"
            secureTextEntry
            autoComplete="password"
            style={{
              backgroundColor: '#1C1917',
              borderRadius: 12,
              padding: 16,
              fontSize: 16,
              color: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#292524',
              fontFamily: 'DM Sans',
            }}
          />
        </View>

        {/* Forgot password */}
        <Link href="/(auth)/forgot-password" asChild>
          <TouchableOpacity style={{ alignSelf: 'flex-end', marginBottom: 24 }}>
            <Text style={{ color: '#F59E0B', fontSize: 14, fontFamily: 'DM Sans Medium' }}>
              Forgot password?
            </Text>
          </TouchableOpacity>
        </Link>

        {/* Sign in button */}
        <TouchableOpacity
          onPress={handleEmailLogin}
          disabled={isLoading}
          style={{
            backgroundColor: '#F59E0B',
            borderRadius: 12,
            padding: 16,
            alignItems: 'center',
            marginBottom: 24,
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? (
            <ActivityIndicator color="#0C0A09" />
          ) : (
            <Text
              style={{
                color: '#0C0A09',
                fontSize: 16,
                fontWeight: '600',
                fontFamily: 'DM Sans Bold',
              }}
            >
              Sign In
            </Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: '#292524' }} />
          <Text
            style={{
              color: '#57534E',
              paddingHorizontal: 16,
              fontSize: 13,
              fontFamily: 'DM Sans',
            }}
          >
            or continue with
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: '#292524' }} />
        </View>

        {/* OAuth buttons */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32 }}>
          <TouchableOpacity
            onPress={() => handleOAuthLogin('github')}
            disabled={isLoading}
            style={{
              flex: 1,
              backgroundColor: '#1C1917',
              borderRadius: 12,
              padding: 14,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#292524',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 20 }}>G</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontFamily: 'DM Sans Medium' }}>
              GitHub
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleOAuthLogin('google')}
            disabled={isLoading}
            style={{
              flex: 1,
              backgroundColor: '#1C1917',
              borderRadius: 12,
              padding: 14,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#292524',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 20 }}>G</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontFamily: 'DM Sans Medium' }}>
              Google
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sign up link */}
        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          <Text style={{ color: '#A8A29E', fontSize: 14, fontFamily: 'DM Sans' }}>
            Don't have an account?{' '}
          </Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity>
              <Text
                style={{
                  color: '#F59E0B',
                  fontSize: 14,
                  fontWeight: '600',
                  fontFamily: 'DM Sans Bold',
                }}
              >
                Sign Up
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
