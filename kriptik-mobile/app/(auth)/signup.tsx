/**
 * Sign Up Screen
 *
 * New user registration
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
import { useAuthStore } from '@/store/useAuthStore';
import { signUpWithEmail, signInWithOAuth, type OAuthProvider } from '@/lib/auth';

export default function SignUpScreen() {
  const router = useRouter();
  const { setUser } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSignUp = async () => {
    if (!name.trim()) {
      setLocalError('Please enter your name');
      return;
    }
    if (!email.trim()) {
      setLocalError('Please enter your email');
      return;
    }
    if (!password || password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setLocalError(null);

    const result = await signUpWithEmail(email.trim(), password, name.trim());

    if (result.success && result.user) {
      setUser(result.user);
      router.replace('/(tabs)');
    } else {
      setLocalError(result.error || 'Sign up failed');
    }

    setIsLoading(false);
  };

  const handleOAuthSignUp = async (provider: OAuthProvider) => {
    setIsLoading(true);
    setLocalError(null);

    const result = await signInWithOAuth(provider);

    if (result.success && result.user) {
      setUser(result.user);
      router.replace('/(tabs)');
    } else {
      setLocalError(result.error || 'Sign up failed');
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
        {/* Header */}
        <View style={{ marginBottom: 32 }}>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: '#FFFFFF',
              fontFamily: 'Outfit Bold',
              marginBottom: 8,
            }}
          >
            Create Account
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: '#A8A29E',
              fontFamily: 'DM Sans',
            }}
          >
            Start building with AI today
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

        {/* Name input */}
        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              color: '#A8A29E',
              fontSize: 13,
              marginBottom: 8,
              fontFamily: 'DM Sans Medium',
            }}
          >
            Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor="#57534E"
            autoCapitalize="words"
            autoComplete="name"
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
        <View style={{ marginBottom: 16 }}>
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
            placeholder="At least 8 characters"
            placeholderTextColor="#57534E"
            secureTextEntry
            autoComplete="new-password"
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

        {/* Confirm Password input */}
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              color: '#A8A29E',
              fontSize: 13,
              marginBottom: 8,
              fontFamily: 'DM Sans Medium',
            }}
          >
            Confirm Password
          </Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm your password"
            placeholderTextColor="#57534E"
            secureTextEntry
            autoComplete="new-password"
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

        {/* Sign up button */}
        <TouchableOpacity
          onPress={handleSignUp}
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
              Create Account
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
            onPress={() => handleOAuthSignUp('github')}
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
            onPress={() => handleOAuthSignUp('google')}
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

        {/* Sign in link */}
        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          <Text style={{ color: '#A8A29E', fontSize: 14, fontFamily: 'DM Sans' }}>
            Already have an account?{' '}
          </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text
                style={{
                  color: '#F59E0B',
                  fontSize: 14,
                  fontWeight: '600',
                  fontFamily: 'DM Sans Bold',
                }}
              >
                Sign In
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
