/**
 * Premium 3D Animated Splash Screen
 *
 * Features:
 * - 3D perspective transformations with visible depth
 * - Floating/rotating logo effect
 * - "KripTik" text with 3D perspective animation
 * - "mobile" typewriter effect
 * - Ultra-smooth 60fps animations
 * - Seamless fade to auth screen
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  withSpring,
  Easing,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Premium amber/gold color palette
const COLORS = {
  bg: '#0C0A09',
  bgDeep: '#050403',
  accent1: '#D97706',
  accent2: '#F59E0B',
  accent3: '#FBBF24',
  accentGlow: 'rgba(217, 119, 6, 0.4)',
  cardFace: '#1C1917',
  cardEdge: '#292524',
  cardHighlight: '#3D3936',
  text: '#F5F5F4',
  textDim: '#A8A29E',
};

// Logo card dimensions - premium 3D card
const CARD_SIZE = 140;
const CARD_DEPTH = 18;

interface AnimatedSplashProps {
  onAnimationComplete?: () => void;
  duration?: number;
}

export default function AnimatedSplash({
  onAnimationComplete,
  duration = 5500,
}: AnimatedSplashProps) {
  // Animation values
  const rotateX = useSharedValue(0);
  const rotateY = useSharedValue(-30);
  const rotateZ = useSharedValue(-5);
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);
  const glowPulse = useSharedValue(0);
  const floatY = useSharedValue(0);
  const fadeOut = useSharedValue(1);

  // Logo movement to make room for text
  const logoTranslateY = useSharedValue(0);

  // Text animations
  const textOpacity = useSharedValue(0);
  const textScale = useSharedValue(0.8);
  const textRotateX = useSharedValue(20);
  const mobileOpacity = useSharedValue(0);
  const mobileTranslateY = useSharedValue(10);

  // Typewriter effect for "mobile"
  const [mobileText, setMobileText] = useState('');
  const fullMobileText = 'mobile';

  // Background particles
  const particle1Y = useSharedValue(SCREEN_HEIGHT);
  const particle2Y = useSharedValue(SCREEN_HEIGHT + 100);
  const particle3Y = useSharedValue(SCREEN_HEIGHT + 200);
  const particle4Y = useSharedValue(SCREEN_HEIGHT + 150);

  useEffect(() => {
    // Start entrance animation
    opacity.value = withTiming(1, { duration: 400 });
    scale.value = withSpring(1, { damping: 12, stiffness: 90 });

    // 3D rotation sequence - dramatic entrance
    rotateY.value = withSequence(
      withTiming(15, { duration: 800, easing: Easing.out(Easing.cubic) }),
      withTiming(-8, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) }),
      // Continuous subtle rotation
      withRepeat(
        withSequence(
          withTiming(3, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(-3, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    rotateX.value = withSequence(
      withTiming(-20, { duration: 600, easing: Easing.out(Easing.cubic) }),
      withTiming(8, { duration: 500, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) }),
      // Continuous subtle tilt
      withRepeat(
        withSequence(
          withTiming(2, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
          withTiming(-2, { duration: 2500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    rotateZ.value = withSequence(
      withTiming(5, { duration: 700 }),
      withTiming(0, { duration: 500, easing: Easing.out(Easing.ease) })
    );

    // Glow pulse
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Float effect
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(8, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Move logo up after initial animation to make room for text
    logoTranslateY.value = withDelay(
      1500,
      withTiming(-60, { duration: 800, easing: Easing.out(Easing.cubic) })
    );

    // "KripTik" text animation - starts after logo settles
    textOpacity.value = withDelay(
      2000,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) })
    );
    textScale.value = withDelay(
      2000,
      withSpring(1, { damping: 12, stiffness: 100 })
    );
    textRotateX.value = withDelay(
      2000,
      withSpring(0, { damping: 15, stiffness: 80 })
    );

    // "mobile" text animation - typewriter effect
    mobileOpacity.value = withDelay(
      2800,
      withTiming(1, { duration: 400 })
    );
    mobileTranslateY.value = withDelay(
      2800,
      withSpring(0, { damping: 12, stiffness: 100 })
    );

    // Typewriter effect
    const typewriterDelay = 2900;
    fullMobileText.split('').forEach((char, index) => {
      setTimeout(() => {
        setMobileText(prev => prev + char);
      }, typewriterDelay + index * 80);
    });

    // Particles rising
    const particleConfig = { duration: 4000, easing: Easing.inOut(Easing.ease) };
    particle1Y.value = withRepeat(withTiming(-100, particleConfig), -1, false);
    particle2Y.value = withDelay(500, withRepeat(withTiming(-100, particleConfig), -1, false));
    particle3Y.value = withDelay(1000, withRepeat(withTiming(-100, particleConfig), -1, false));
    particle4Y.value = withDelay(750, withRepeat(withTiming(-100, particleConfig), -1, false));

    // Fade out and complete after duration
    const completeTimeout = setTimeout(() => {
      fadeOut.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) }, (finished) => {
        if (finished && onAnimationComplete) {
          runOnJS(onAnimationComplete)();
        }
      });
    }, duration - 600);

    return () => clearTimeout(completeTimeout);
  }, [duration, onAnimationComplete]);

  // 3D Card container style with perspective
  const cardContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * fadeOut.value,
    transform: [
      { perspective: 1000 },
      { translateY: floatY.value + logoTranslateY.value },
      { scale: scale.value },
      { rotateX: `${rotateX.value}deg` },
      { rotateY: `${rotateY.value}deg` },
      { rotateZ: `${rotateZ.value}deg` },
    ],
  }));

  // Glow effect style
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [0.5, 1], [0.3, 0.7]),
    transform: [
      { scale: interpolate(glowPulse.value, [0.5, 1], [0.9, 1.15]) },
      { translateY: logoTranslateY.value },
    ],
  }));

  // Card face (front) style
  const cardFaceStyle = useAnimatedStyle(() => {
    const shadowIntensity = interpolate(glowPulse.value, [0.5, 1], [0.4, 0.8]);
    return {
      shadowOpacity: shadowIntensity,
    };
  });

  // Card edge styles for 3D depth
  const rightEdgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(rotateY.value, [-30, 0, 30], [0.3, 0.6, 1], Extrapolation.CLAMP),
  }));

  const bottomEdgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(rotateX.value, [-20, 0, 20], [1, 0.6, 0.3], Extrapolation.CLAMP),
  }));

  // "KripTik" text style with 3D perspective
  const kriptikTextStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value * fadeOut.value,
    transform: [
      { perspective: 800 },
      { scale: textScale.value },
      { rotateX: `${textRotateX.value}deg` },
    ],
  }));

  // "mobile" text style
  const mobileTextStyle = useAnimatedStyle(() => ({
    opacity: mobileOpacity.value * fadeOut.value,
    transform: [
      { translateY: mobileTranslateY.value },
    ],
  }));

  // Particle styles
  const particle1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: particle1Y.value }],
    opacity: interpolate(
      particle1Y.value,
      [SCREEN_HEIGHT, SCREEN_HEIGHT / 2, -100],
      [0, 0.7, 0],
      Extrapolation.CLAMP
    ) * fadeOut.value,
  }));

  const particle2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: particle2Y.value }],
    opacity: interpolate(
      particle2Y.value,
      [SCREEN_HEIGHT + 100, SCREEN_HEIGHT / 2, -100],
      [0, 0.5, 0],
      Extrapolation.CLAMP
    ) * fadeOut.value,
  }));

  const particle3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: particle3Y.value }],
    opacity: interpolate(
      particle3Y.value,
      [SCREEN_HEIGHT + 200, SCREEN_HEIGHT / 2, -100],
      [0, 0.6, 0],
      Extrapolation.CLAMP
    ) * fadeOut.value,
  }));

  const particle4Style = useAnimatedStyle(() => ({
    transform: [{ translateY: particle4Y.value }],
    opacity: interpolate(
      particle4Y.value,
      [SCREEN_HEIGHT + 150, SCREEN_HEIGHT / 2, -100],
      [0, 0.4, 0],
      Extrapolation.CLAMP
    ) * fadeOut.value,
  }));

  const containerFadeStyle = useAnimatedStyle(() => ({
    opacity: fadeOut.value,
  }));

  return (
    <Animated.View style={[styles.container, containerFadeStyle]}>
      {/* Deep gradient background */}
      <LinearGradient
        colors={['#0a0705', COLORS.bg, '#0a0705']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient light gradient */}
      <View style={styles.ambientLight}>
        <LinearGradient
          colors={['rgba(217, 119, 6, 0.08)', 'transparent', 'transparent']}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Rising particles */}
      <Animated.View style={[styles.particle, styles.particle1, particle1Style]}>
        <LinearGradient
          colors={[COLORS.accent1, 'transparent']}
          style={styles.particleGradient}
        />
      </Animated.View>
      <Animated.View style={[styles.particle, styles.particle2, particle2Style]}>
        <LinearGradient
          colors={[COLORS.accent2, 'transparent']}
          style={styles.particleGradient}
        />
      </Animated.View>
      <Animated.View style={[styles.particle, styles.particle3, particle3Style]}>
        <LinearGradient
          colors={[COLORS.accent3, 'transparent']}
          style={styles.particleGradient}
        />
      </Animated.View>
      <Animated.View style={[styles.particle, styles.particle4, particle4Style]}>
        <LinearGradient
          colors={[COLORS.accent1, 'transparent']}
          style={styles.particleGradient}
        />
      </Animated.View>

      {/* Main 3D Card */}
      <View style={styles.cardWrapper}>
        {/* Glow behind card */}
        <Animated.View style={[styles.cardGlow, glowStyle]} />

        {/* 3D Card with perspective */}
        <Animated.View style={[styles.cardContainer, cardContainerStyle]}>
          {/* Right edge (depth) */}
          <Animated.View style={[styles.cardEdgeRight, rightEdgeStyle]}>
            <LinearGradient
              colors={[COLORS.cardHighlight, COLORS.cardEdge, COLORS.cardFace]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Bottom edge (depth) */}
          <Animated.View style={[styles.cardEdgeBottom, bottomEdgeStyle]}>
            <LinearGradient
              colors={[COLORS.cardEdge, COLORS.bgDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Card face (front) */}
          <Animated.View style={[styles.cardFace, cardFaceStyle]}>
            <LinearGradient
              colors={[COLORS.cardHighlight, COLORS.cardFace, COLORS.cardEdge]}
              locations={[0, 0.3, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardFaceGradient}
            >
              {/* Inner glow border */}
              <View style={styles.cardInnerBorder}>
                <LinearGradient
                  colors={[COLORS.accent1, COLORS.accent2, COLORS.accent3]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.innerBorderGradient}
                />
              </View>

              {/* Logo "K" - custom 3D styled */}
              <View style={styles.logoContainer}>
                <View style={styles.logoK}>
                  {/* Vertical bar of K */}
                  <View style={styles.logoKBar}>
                    <LinearGradient
                      colors={[COLORS.accent3, COLORS.accent1]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    {/* 3D edge on bar */}
                    <View style={styles.logoKBarEdge} />
                  </View>

                  {/* Upper diagonal of K */}
                  <View style={styles.logoKUpper}>
                    <LinearGradient
                      colors={[COLORS.accent2, COLORS.accent1]}
                      start={{ x: 0, y: 1 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.logoKDiagonalEdge} />
                  </View>

                  {/* Lower diagonal of K */}
                  <View style={styles.logoKLower}>
                    <LinearGradient
                      colors={[COLORS.accent1, COLORS.accent2]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.logoKDiagonalEdge} />
                  </View>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        </Animated.View>
      </View>

      {/* "KripTik" Text with 3D perspective */}
      <Animated.View style={[styles.textContainer, kriptikTextStyle]}>
        <View style={styles.kriptikTextWrapper}>
          {/* 3D shadow layer */}
          <Text style={[styles.kriptikText, styles.kriptikTextShadow]}>KripTik</Text>
          {/* Main text with gradient-like effect using overlapping text */}
          <Text style={[styles.kriptikText, styles.kriptikTextMain]}>KripTik</Text>
          {/* Highlight edge */}
          <View style={styles.textEdge}>
            <LinearGradient
              colors={[COLORS.accent3, COLORS.accent1, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.textEdgeGradient}
            />
          </View>
        </View>
      </Animated.View>

      {/* "mobile" Text with typewriter effect */}
      <Animated.View style={[styles.mobileTextContainer, mobileTextStyle]}>
        <Text style={styles.mobileText}>{mobileText}</Text>
        {mobileText.length < fullMobileText.length && (
          <Animated.View style={styles.cursor} />
        )}
      </Animated.View>

      {/* Subtle grid overlay for tech feel */}
      <View style={styles.gridOverlay} pointerEvents="none">
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={`h-${i}`} style={[styles.gridLineH, { top: `${(i + 1) * 12.5}%` }]} />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={`v-${i}`} style={[styles.gridLineV, { left: `${(i + 1) * 12.5}%` }]} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ambientLight: {
    ...StyleSheet.absoluteFillObject,
  },

  // Particles
  particle: {
    position: 'absolute',
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  particle1: {
    left: '20%',
  },
  particle2: {
    left: '70%',
  },
  particle3: {
    left: '45%',
  },
  particle4: {
    left: '85%',
  },
  particleGradient: {
    flex: 1,
    borderRadius: 2,
  },

  // Card wrapper
  cardWrapper: {
    width: CARD_SIZE + 40,
    height: CARD_SIZE + 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  cardGlow: {
    position: 'absolute',
    width: CARD_SIZE * 1.8,
    height: CARD_SIZE * 1.8,
    borderRadius: CARD_SIZE,
    backgroundColor: COLORS.accentGlow,
  },
  cardContainer: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    // Note: 3D perspective simulated via shadows and layering
  },

  // 3D Card edges
  cardEdgeRight: {
    position: 'absolute',
    right: -CARD_DEPTH,
    top: CARD_DEPTH / 2,
    width: CARD_DEPTH,
    height: CARD_SIZE - CARD_DEPTH / 2,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    transform: [{ skewY: '-45deg' }],
    overflow: 'hidden',
  },
  cardEdgeBottom: {
    position: 'absolute',
    bottom: -CARD_DEPTH,
    left: CARD_DEPTH / 2,
    width: CARD_SIZE - CARD_DEPTH / 2,
    height: CARD_DEPTH,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    transform: [{ skewX: '-45deg' }],
    overflow: 'hidden',
  },

  // Card face
  cardFace: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.accent1,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.6,
        shadowRadius: 30,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  cardFaceGradient: {
    flex: 1,
    padding: 3,
    borderRadius: 24,
  },
  cardInnerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  innerBorderGradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.4,
  },

  // Logo
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoK: {
    width: 60,
    height: 78,
    position: 'relative',
  },
  logoKBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 16,
    height: 78,
    borderRadius: 5,
    overflow: 'hidden',
  },
  logoKBarEdge: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 3,
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  logoKUpper: {
    position: 'absolute',
    left: 18,
    top: 4,
    width: 42,
    height: 14,
    borderRadius: 5,
    transform: [{ rotate: '45deg' }, { translateX: 6 }, { translateY: 10 }],
    overflow: 'hidden',
  },
  logoKLower: {
    position: 'absolute',
    left: 18,
    bottom: 4,
    width: 42,
    height: 14,
    borderRadius: 5,
    transform: [{ rotate: '-45deg' }, { translateX: 6 }, { translateY: -10 }],
    overflow: 'hidden',
  },
  logoKDiagonalEdge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },

  // "KripTik" text
  textContainer: {
    position: 'absolute',
    top: '55%',
    alignItems: 'center',
  },
  kriptikTextWrapper: {
    position: 'relative',
  },
  kriptikText: {
    fontFamily: 'Outfit-Bold',
    fontSize: 48,
    letterSpacing: 2,
  },
  kriptikTextShadow: {
    position: 'absolute',
    color: COLORS.accent1,
    opacity: 0.3,
    textShadowColor: COLORS.accent1,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 20,
    transform: [{ translateY: 4 }, { translateX: 2 }],
  },
  kriptikTextMain: {
    color: COLORS.text,
    textShadowColor: COLORS.accent1,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  textEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    borderRadius: 1.5,
  },
  textEdgeGradient: {
    flex: 1,
    borderRadius: 1.5,
  },

  // "mobile" text
  mobileTextContainer: {
    position: 'absolute',
    top: '62%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  mobileText: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 18,
    letterSpacing: 8,
    color: COLORS.textDim,
    textTransform: 'uppercase',
  },
  cursor: {
    width: 2,
    height: 18,
    backgroundColor: COLORS.accent2,
    marginLeft: 2,
    opacity: 0.8,
  },

  // Grid overlay
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.03,
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: COLORS.accent1,
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: COLORS.accent1,
  },
});
