import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { router, Stack } from 'expo-router';
import { Audio } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius, animations } from '../lib/design-system';
import { Button } from '../components/ui';
import { MicrophoneIcon, CloseIcon, SendIcon, StopIcon } from '../components/icons';
import { useBuildStore } from '../store/build-store';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function VoiceInputScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pulseScale = useSharedValue(1);
  const waveScale = useSharedValue(1);

  const { setInputText } = useBuildStore();

  useEffect(() => {
    requestPermission();
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );
      waveScale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );
    } else {
      pulseScale.value = withSpring(1, animations.spring.snappy);
      waveScale.value = withSpring(1, animations.spring.snappy);
    }
  }, [isRecording]);

  const requestPermission = async () => {
    const { granted } = await Audio.requestPermissionsAsync();
    setPermissionGranted(granted);
  };

  const startRecording = async () => {
    if (!permissionGranted) {
      await requestPermission();
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setIsRecording(true);
      setTranscript('Listening...');

      // In production, you would stream audio to a speech-to-text service
      // For now, we simulate transcription
    } catch (error) {
      console.error('Failed to start recording:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      setIsRecording(false);
      await recordingRef.current.stopAndUnloadAsync();

      // In production, send audio to speech-to-text service
      // For demo, we'll show a placeholder
      setTranscript('Voice transcription would appear here');

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      recordingRef.current = null;
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleSend = () => {
    if (transcript && transcript !== 'Listening...' && transcript !== 'Voice transcription would appear here') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setInputText(transcript);
      router.back();
    }
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTranscript('');
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: isRecording ? 1 : 0.5,
  }));

  const waveStyle = useAnimatedStyle(() => ({
    transform: [{ scale: waveScale.value }],
    opacity: isRecording ? 0.3 : 0,
  }));

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <CloseIcon size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Voice Input</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Transcript */}
        <View style={styles.transcriptContainer}>
          {transcript ? (
            <Text style={styles.transcriptText}>{transcript}</Text>
          ) : (
            <Text style={styles.placeholderText}>
              Tap the microphone to start speaking
            </Text>
          )}
        </View>

        {/* Microphone Button */}
        <View style={styles.micContainer}>
          {/* Wave effect */}
          <Animated.View style={[styles.wave, styles.wave2, waveStyle]} />
          <Animated.View style={[styles.wave, waveStyle]} />

          {/* Mic button */}
          <TouchableOpacity
            style={[styles.micButton, isRecording && styles.micButtonActive]}
            onPress={isRecording ? stopRecording : startRecording}
            activeOpacity={0.9}
          >
            <Animated.View style={pulseStyle}>
              {isRecording ? (
                <StopIcon size={48} color={colors.text.primary} />
              ) : (
                <MicrophoneIcon size={48} color={colors.text.primary} />
              )}
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* Status text */}
        <Text style={styles.statusText}>
          {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
        </Text>

        {/* Actions */}
        <View style={styles.actions}>
          {transcript && !isRecording && (
            <>
              <Button
                title="Clear"
                variant="secondary"
                onPress={handleClear}
                style={styles.actionButton}
              />
              <Button
                title="Use Text"
                onPress={handleSend}
                icon={<SendIcon size={18} color={colors.text.inverse} />}
                iconPosition="right"
                style={styles.actionButton}
              />
            </>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.heading,
    color: colors.text.primary,
  },
  placeholder: {
    width: 40,
  },
  transcriptContainer: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcriptText: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: 32,
  },
  placeholderText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  micContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
  },
  wave: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.accent.primary,
  },
  wave2: {
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.accent.primary,
  },
  micButtonActive: {
    backgroundColor: colors.accent.primary,
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  actionButton: {
    flex: 1,
  },
});
