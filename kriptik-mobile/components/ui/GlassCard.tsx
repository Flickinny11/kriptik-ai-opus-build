import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, borderRadius, shadows, animations } from '../../lib/design-system';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'interactive' | 'success' | 'error' | 'warning';
  glowColor?: string;
  onPress?: () => void;
  disabled?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GlassCard({
  children,
  style,
  variant = 'default',
  glowColor,
  onPress,
  disabled = false,
}: GlassCardProps) {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (onPress && !disabled) {
      scale.value = withSpring(0.98, animations.spring.snappy);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, animations.spring.snappy);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getBorderColor = () => {
    switch (variant) {
      case 'success':
        return colors.status.success;
      case 'error':
        return colors.status.error;
      case 'warning':
        return colors.status.warning;
      case 'elevated':
        return colors.accent.primary;
      default:
        return colors.border.default;
    }
  };

  const getGlowColor = () => {
    if (glowColor) return glowColor;
    switch (variant) {
      case 'success':
        return colors.status.success;
      case 'error':
        return colors.status.error;
      case 'warning':
        return colors.status.warning;
      default:
        return colors.accent.primary;
    }
  };

  const content = (
    <>
      {/* Glass background with blur */}
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[
            'rgba(41, 37, 36, 0.8)',
            'rgba(28, 25, 23, 0.9)',
          ]}
          style={StyleSheet.absoluteFill}
        />
      </BlurView>

      {/* Border glow effect */}
      <View
        style={[
          styles.border,
          {
            borderColor: getBorderColor(),
            shadowColor: getGlowColor(),
            shadowOpacity: variant !== 'default' ? 0.4 : 0,
          },
        ]}
      />

      {/* Content */}
      <View style={styles.content}>{children}</View>
    </>
  );

  if (onPress) {
    return (
      <AnimatedPressable
        style={[
          styles.container,
          animatedStyle,
          variant === 'elevated' && shadows.glow,
          style,
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
      >
        {content}
      </AnimatedPressable>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        animatedStyle,
        variant === 'elevated' && shadows.glow,
        style,
      ]}
    >
      {content}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
  },
  content: {
    padding: 16,
  },
});
