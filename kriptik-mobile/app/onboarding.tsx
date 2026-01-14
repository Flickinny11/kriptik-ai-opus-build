/**
 * Onboarding Screen - Seamless welcome experience for new users
 * 
 * Features:
 * - Premium animated welcome
 * - QR code scanning for instant pairing
 * - Feature highlights carousel
 * - One-tap account creation or sign-in
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius, shadows, animations } from '../lib/design-system';
import { Button, GlassCard } from '../components/ui';
import {
  KripTikLogoIcon,
  BuildIcon,
  MicrophoneIcon,
  BellIcon,
  QRCodeIcon,
  ChevronRightIcon,
} from '../components/icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ONBOARDING_COMPLETE_KEY = 'kriptik_onboarding_complete';

const onboardingSlides = [
  {
    id: 'welcome',
    title: 'Welcome to KripTik',
    subtitle: 'Build. Deploy. Scale.',
    description: 'Your AI-powered development companion for building full-stack applications with natural language',
    icon: KripTikLogoIcon,
    gradient: [colors.accent.secondary, colors.accent.primary] as const,
  },
  {
    id: 'build',
    title: 'Build Anywhere',
    subtitle: 'From idea to app in minutes',
    description: 'Describe what you want to build and watch as KripTik creates production-ready code instantly',
    icon: BuildIcon,
    gradient: ['#10b981', '#059669'] as const,
  },
  {
    id: 'voice',
    title: 'Voice-Powered',
    subtitle: 'Speak your vision into reality',
    description: 'Use voice commands to build features, fix bugs, and iterate on your projects hands-free',
    icon: MicrophoneIcon,
    gradient: ['#8b5cf6', '#7c3aed'] as const,
  },
  {
    id: 'notifications',
    title: 'Stay Connected',
    subtitle: 'Never miss a beat',
    description: 'Get real-time notifications for build completions, agent updates, and important events',
    icon: BellIcon,
    gradient: ['#f59e0b', '#d97706'] as const,
  },
];

export default function OnboardingScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const slideProgress = useSharedValue(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollX = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollX / SCREEN_WIDTH);
    slideProgress.value = scrollX / SCREEN_WIDTH;
    if (index !== currentSlide) {
      setCurrentSlide(index);
      Haptics.selectionAsync();
    }
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentSlide < onboardingSlides.length - 1) {
      scrollViewRef.current?.scrollTo({
        x: (currentSlide + 1) * SCREEN_WIDTH,
        animated: true,
      });
    } else {
      handleGetStarted();
    }
  };

  const handleGetStarted = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Mark onboarding as complete
    await SecureStore.setItemAsync(ONBOARDING_COMPLETE_KEY, 'true');
    router.replace('/(auth)/login');
  };

  const handleScanQR = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/qr-scanner');
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleGetStarted();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Background gradient */}
        <LinearGradient
          colors={[colors.background.primary, colors.background.secondary]}
          style={StyleSheet.absoluteFill}
        />

        {/* Skip button */}
        <SafeAreaView edges={['top']} style={styles.skipContainer}>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </SafeAreaView>

        {/* Slides */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={styles.scrollView}
        >
          {onboardingSlides.map((slide, index) => (
            <OnboardingSlide key={slide.id} slide={slide} index={index} />
          ))}
        </ScrollView>

        {/* Bottom section */}
        <SafeAreaView edges={['bottom']} style={styles.bottomSection}>
          {/* Page indicators */}
          <View style={styles.indicators}>
            {onboardingSlides.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.indicator,
                  currentSlide === index && styles.indicatorActive,
                ]}
              />
            ))}
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            {currentSlide === onboardingSlides.length - 1 ? (
              <Animated.View entering={FadeInUp} style={styles.finalActions}>
                {/* QR Scan option */}
                <TouchableOpacity
                  style={styles.qrButton}
                  onPress={handleScanQR}
                  activeOpacity={0.8}
                >
                  <GlassCard style={styles.qrCard}>
                    <View style={styles.qrContent}>
                      <View style={styles.qrIcon}>
                        <QRCodeIcon size={24} color={colors.accent.primary} />
                      </View>
                      <View style={styles.qrText}>
                        <Text style={styles.qrTitle}>Scan to Pair</Text>
                        <Text style={styles.qrSubtitle}>Instant sync with web app</Text>
                      </View>
                      <ChevronRightIcon size={20} color={colors.text.tertiary} />
                    </View>
                  </GlassCard>
                </TouchableOpacity>

                {/* Get Started button */}
                <Button
                  title="Get Started"
                  onPress={handleGetStarted}
                  variant="primary"
                  size="lg"
                  style={styles.mainButton}
                />

                <Text style={styles.termsText}>
                  By continuing, you agree to our Terms of Service and Privacy Policy
                </Text>
              </Animated.View>
            ) : (
              <Button
                title="Continue"
                onPress={handleNext}
                variant="primary"
                size="lg"
                icon={<ChevronRightIcon size={20} color={colors.text.inverse} />}
                iconPosition="right"
                style={styles.mainButton}
              />
            )}
          </View>
        </SafeAreaView>
      </View>
    </>
  );
}

interface SlideProps {
  slide: typeof onboardingSlides[0];
  index: number;
}

function OnboardingSlide({ slide, index }: SlideProps) {
  const IconComponent = slide.icon;

  return (
    <View style={styles.slide}>
      <Animated.View
        entering={FadeInDown.delay(index * 100)}
        style={styles.slideContent}
      >
        {/* Icon container */}
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={[...slide.gradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconGradient}
          >
            <IconComponent size={64} color={colors.text.inverse} />
          </LinearGradient>
          {/* Glow effect */}
          <View style={[styles.iconGlow, { backgroundColor: slide.gradient[0] }]} />
        </View>

        {/* Text content */}
        <Animated.Text entering={FadeInUp.delay(200 + index * 100)} style={styles.slideTitle}>
          {slide.title}
        </Animated.Text>
        <Animated.Text entering={FadeInUp.delay(300 + index * 100)} style={styles.slideSubtitle}>
          {slide.subtitle}
        </Animated.Text>
        <Animated.Text entering={FadeInUp.delay(400 + index * 100)} style={styles.slideDescription}>
          {slide.description}
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  skipContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
  },
  skipButton: {
    padding: spacing.lg,
  },
  skipText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bodyMedium,
    color: colors.text.secondary,
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  slideContent: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: spacing['3xl'],
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: borderRadius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glowStrong,
  },
  iconGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: borderRadius['2xl'],
    opacity: 0.3,
    transform: [{ scale: 1.2 }],
    zIndex: -1,
  },
  slideTitle: {
    fontSize: typography.fontSize['3xl'],
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  slideSubtitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.heading,
    color: colors.accent.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  slideDescription: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomSection: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  indicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.background.tertiary,
  },
  indicatorActive: {
    width: 24,
    backgroundColor: colors.accent.primary,
  },
  actions: {
    gap: spacing.md,
  },
  finalActions: {
    gap: spacing.md,
  },
  qrButton: {
    marginBottom: spacing.sm,
  },
  qrCard: {
    padding: spacing.md,
  },
  qrContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qrIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.accent.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  qrTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.primary,
  },
  qrSubtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 2,
  },
  mainButton: {
    width: '100%',
  },
  termsText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
