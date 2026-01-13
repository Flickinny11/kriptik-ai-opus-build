import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, typography, borderRadius, spacing, animations } from '../../lib/design-system';
import { SendIcon, MicrophoneIcon, StopIcon } from '../icons';

interface NLPInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: (text: string) => void;
  onVoiceStart?: () => void;
  onVoiceStop?: () => void;
  isStreaming?: boolean;
  isVoiceActive?: boolean;
  onCancel?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export function NLPInput({
  value,
  onChangeText,
  onSend,
  onVoiceStart,
  onVoiceStop,
  isStreaming = false,
  isVoiceActive = false,
  onCancel,
  placeholder = 'Describe what you want to build...',
  disabled = false,
}: NLPInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const scale = useSharedValue(1);

  const handleSend = () => {
    if (!value.trim() || disabled || isStreaming) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSend(value.trim());
    Keyboard.dismiss();
  };

  const handleVoicePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isVoiceActive) {
      onVoiceStop?.();
    } else {
      onVoiceStart?.();
    }
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onCancel?.();
  };

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(scale.value, animations.spring.snappy) }],
  }));

  const canSend = value.trim().length > 0 && !disabled && !isStreaming;

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.container,
          isFocused && styles.containerFocused,
          containerStyle,
        ]}
      >
        <View style={styles.inputRow}>
          {/* Voice Button */}
          <TouchableOpacity
            style={[
              styles.voiceButton,
              isVoiceActive && styles.voiceButtonActive,
            ]}
            onPress={handleVoicePress}
            disabled={disabled}
          >
            <MicrophoneIcon
              size={20}
              color={isVoiceActive ? colors.accent.primary : colors.text.secondary}
            />
          </TouchableOpacity>

          {/* Text Input */}
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.text.tertiary}
            multiline
            maxLength={4000}
            editable={!disabled && !isStreaming}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            selectionColor={colors.accent.primary}
          />

          {/* Send / Cancel Button */}
          {isStreaming ? (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <StopIcon size={20} color={colors.status.error} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!canSend}
            >
              {canSend ? (
                <LinearGradient
                  colors={[colors.accent.secondary, colors.accent.primary]}
                  style={styles.sendButtonGradient}
                >
                  <SendIcon size={18} color={colors.text.inverse} />
                </LinearGradient>
              ) : (
                <View style={styles.sendButtonPlaceholder}>
                  <SendIcon size={18} color={colors.text.tertiary} />
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Streaming indicator */}
        {isStreaming && (
          <View style={styles.streamingIndicator}>
            <ActivityIndicator size="small" color={colors.accent.primary} />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  container: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  containerFocused: {
    borderColor: colors.accent.primary,
    shadowColor: colors.accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 48,
    paddingHorizontal: spacing.sm,
  },
  voiceButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  voiceButtonActive: {
    backgroundColor: colors.accent.muted,
  },
  input: {
    flex: 1,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    maxHeight: 120,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: 18,
  },
  cancelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.status.errorMuted,
    marginBottom: spacing.xs,
  },
  streamingIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
});
