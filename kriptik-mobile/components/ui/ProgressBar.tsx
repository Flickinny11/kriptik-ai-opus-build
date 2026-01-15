/**
 * ProgressBar Component
 * Animated progress bar with gradient fill
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, borderRadius, animations } from '../../lib/design-system';

interface ProgressBarProps {
  progress: number;
  color?: string;
  height?: number;
  animated?: boolean;
  showGlow?: boolean;
}

export function ProgressBar({
  progress,
  color = colors.accent.primary,
  height = 6,
  animated = true,
  showGlow = false,
}: ProgressBarProps) {
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    const clampedProgress = Math.min(Math.max(progress, 0), 100);
    if (animated) {
      animatedProgress.value = withSpring(clampedProgress, animations.spring.smooth);
    } else {
      animatedProgress.value = clampedProgress;
    }
  }, [progress, animated]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${animatedProgress.value}%`,
  }));

  return (
    <View style={[styles.container, { height }]}>
      <View style={[styles.background, { borderRadius: height / 2 }]} />
      <Animated.View
        style={[
          styles.progress,
          { borderRadius: height / 2, backgroundColor: color },
          showGlow && {
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 8,
          },
          progressStyle,
        ]}
      >
        <LinearGradient
          colors={[color, `${color}CC`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background.tertiary,
  },
  progress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
});
