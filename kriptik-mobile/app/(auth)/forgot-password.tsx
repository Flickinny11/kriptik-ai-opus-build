/**
 * Forgot Password Screen
 *
 * Password reset request
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { api } from '@/lib/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResetRequest = async () => {
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.request('/api/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim() },
        skipAuth: true,
      });

      if (result.success) {
        setIsSuccess(true);
      } else {
        setError(result.error || 'Failed to send reset email');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }

    setIsLoading(false);
  };

  if (isSuccess) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0C0A09',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: '#22C55E20',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
            marginBottom: 24,
          }}
        >
          <Text style={{ fontSize: 28 }}>+</Text>
        </View>

        <Text
          style={{
            fontSize: 24,
            fontWeight: '700',
            color: '#FFFFFF',
            textAlign: 'center',
            marginBottom: 12,
            fontFamily: 'Outfit Bold',
          }}
        >
          Check Your Email
        </Text>

        <Text
          style={{
            fontSize: 15,
            color: '#A8A29E',
            textAlign: 'center',
            marginBottom: 32,
            fontFamily: 'DM Sans',
            lineHeight: 22,
          }}
        >
          We've sent a password reset link to{'\n'}
          <Text style={{ color: '#F59E0B' }}>{email}</Text>
        </Text>

        <Link href="/(auth)/login" asChild>
          <TouchableOpacity
            style={{
              backgroundColor: '#1C1917',
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#292524',
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: '600',
                fontFamily: 'DM Sans Bold',
              }}
            >
              Back to Sign In
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#0C0A09' }}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: 24,
        }}
      >
        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            position: 'absolute',
            top: 60,
            left: 24,
            padding: 8,
          }}
        >
          <Text style={{ color: '#A8A29E', fontSize: 16 }}>Back</Text>
        </TouchableOpacity>

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
            Reset Password
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: '#A8A29E',
              fontFamily: 'DM Sans',
              lineHeight: 22,
            }}
          >
            Enter your email and we'll send you a link to reset your password
          </Text>
        </View>

        {/* Error message */}
        {error && (
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
              {error}
            </Text>
          </View>
        )}

        {/* Email input */}
        <View style={{ marginBottom: 24 }}>
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

        {/* Submit button */}
        <TouchableOpacity
          onPress={handleResetRequest}
          disabled={isLoading}
          style={{
            backgroundColor: '#F59E0B',
            borderRadius: 12,
            padding: 16,
            alignItems: 'center',
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
              Send Reset Link
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
