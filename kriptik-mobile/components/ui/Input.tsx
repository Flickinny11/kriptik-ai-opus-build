import React, { useState } from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, typography, borderRadius, animations, spacing } from '../../lib/design-system';
import { EyeIcon, EyeOffIcon } from '../icons';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isPassword?: boolean;
  variant?: 'default' | 'filled' | 'glass';
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  isPassword = false,
  variant = 'default',
  style,
  value,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const focusProgress = useSharedValue(0);
  const labelPosition = useSharedValue(value ? 1 : 0);

  const handleFocus = () => {
    setIsFocused(true);
    focusProgress.value = withSpring(1, animations.spring.snappy);
    labelPosition.value = withSpring(1, animations.spring.snappy);
    Haptics.selectionAsync();
  };

  const handleBlur = () => {
    setIsFocused(false);
    focusProgress.value = withSpring(0, animations.spring.snappy);
    if (!value) {
      labelPosition.value = withSpring(0, animations.spring.snappy);
    }
  };

  const containerAnimatedStyle = useAnimatedStyle(() => {
    const borderColor = error
      ? colors.status.error
      : interpolateColor(
          focusProgress.value,
          [0, 1],
          [colors.border.default, colors.accent.primary]
        );

    return {
      borderColor,
      shadowOpacity: withTiming(isFocused ? 0.3 : 0, { duration: 150 }),
    };
  });

  const labelAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withSpring(
          labelPosition.value === 1 ? -24 : 0,
          animations.spring.snappy
        ),
      },
      {
        scale: withSpring(
          labelPosition.value === 1 ? 0.85 : 1,
          animations.spring.snappy
        ),
      },
    ],
  }));

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.container,
          variant === 'filled' && styles.container_filled,
          variant === 'glass' && styles.container_glass,
          containerAnimatedStyle,
          {
            shadowColor: error ? colors.status.error : colors.accent.primary,
          },
        ]}
      >
        {/* Floating Label */}
        {label && (
          <Animated.Text
            style={[
              styles.label,
              labelAnimatedStyle,
              {
                color: error
                  ? colors.status.error
                  : isFocused
                  ? colors.accent.primary
                  : colors.text.secondary,
              },
            ]}
          >
            {label}
          </Animated.Text>
        )}

        <View style={styles.inputRow}>
          {/* Left Icon */}
          {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

          {/* Text Input */}
          <TextInput
            style={[
              styles.input,
              leftIcon && styles.inputWithLeftIcon,
              (rightIcon || isPassword) && styles.inputWithRightIcon,
              style,
            ]}
            placeholderTextColor={colors.text.tertiary}
            selectionColor={colors.accent.primary}
            secureTextEntry={isPassword && !showPassword}
            onFocus={handleFocus}
            onBlur={handleBlur}
            value={value}
            {...props}
          />

          {/* Right Icon / Password Toggle */}
          {isPassword ? (
            <TouchableOpacity
              style={styles.rightIcon}
              onPress={() => {
                setShowPassword(!showPassword);
                Haptics.selectionAsync();
              }}
            >
              {showPassword ? (
                <EyeOffIcon size={20} color={colors.text.secondary} />
              ) : (
                <EyeIcon size={20} color={colors.text.secondary} />
              )}
            </TouchableOpacity>
          ) : rightIcon ? (
            <View style={styles.rightIcon}>{rightIcon}</View>
          ) : null}
        </View>
      </Animated.View>

      {/* Error / Hint Text */}
      {(error || hint) && (
        <Text
          style={[
            styles.helperText,
            error ? styles.errorText : styles.hintText,
          ]}
        >
          {error || hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.lg,
  },
  container: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 56,
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
  },
  container_filled: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 0,
  },
  container_glass: {
    backgroundColor: 'rgba(28, 25, 23, 0.6)',
  },
  label: {
    position: 'absolute',
    left: spacing.lg,
    top: 18,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.base,
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 4,
    zIndex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
  },
  inputWithLeftIcon: {
    marginLeft: spacing.sm,
  },
  inputWithRightIcon: {
    marginRight: spacing.sm,
  },
  leftIcon: {
    marginRight: spacing.sm,
  },
  rightIcon: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  helperText: {
    marginTop: spacing.sm,
    marginLeft: spacing.lg,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
  },
  errorText: {
    color: colors.status.error,
  },
  hintText: {
    color: colors.text.tertiary,
  },
});
