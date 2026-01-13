import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius } from '../../../lib/design-system';
import { api } from '../../../lib/api';
import { GlassCard } from '../../../components/ui';
import {
  ChevronLeftIcon,
  LabIcon,
  CheckIcon,
  CloseIcon,
  RefreshIcon,
} from '../../../components/icons';

interface TrainingLog {
  timestamp: string;
  message: string;
}

interface TrainingJob {
  id: string;
  name: string;
  status: 'queued' | 'training' | 'completed' | 'failed';
  progress: number;
  modelType: string;
  metrics?: Record<string, number>;
  logs: TrainingLog[];
  createdAt: string;
}

export default function TrainingJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<TrainingJob | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchJob = useCallback(async () => {
    if (!id) return;
    try {
      const response = await api.getTrainingJob(id);
      if (response.success && response.data) {
        setJob(response.data.job as TrainingJob);
      }
    } catch (error) {
      console.error('Failed to fetch training job:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchJob();
    // Poll for updates if training
    const interval = setInterval(() => {
      if (job?.status === 'training' || job?.status === 'queued') {
        fetchJob();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [id, job?.status, fetchJob]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchJob();
    setRefreshing(false);
  }, [fetchJob]);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const getStatusColor = () => {
    switch (job?.status) {
      case 'training':
      case 'queued':
        return colors.phases.building;
      case 'completed':
        return colors.status.success;
      case 'failed':
        return colors.status.error;
      default:
        return colors.text.secondary;
    }
  };

  const getStatusLabel = () => {
    switch (job?.status) {
      case 'queued':
        return 'Queued';
      case 'training':
        return 'Training';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ChevronLeftIcon size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {job?.name || 'Training Job'}
            </Text>
            <View style={styles.statusRow}>
              <View
                style={[styles.statusDot, { backgroundColor: getStatusColor() }]}
              />
              <Text style={[styles.statusText, { color: getStatusColor() }]}>
                {getStatusLabel()}
              </Text>
            </View>
          </View>
          <View style={styles.headerIcon}>
            <LabIcon size={24} color={colors.accent.primary} />
          </View>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Progress */}
          {(job?.status === 'training' || job?.status === 'queued') && (
            <Animated.View entering={FadeInDown.delay(100)}>
              <GlassCard style={styles.progressCard} variant="elevated">
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Training Progress</Text>
                  <Text style={styles.progressValue}>{job.progress}%</Text>
                </View>
                <View style={styles.progressBar}>
                  <Animated.View
                    style={[styles.progressFill, { width: `${job.progress}%` }]}
                  />
                </View>
                <Text style={styles.modelType}>{job.modelType}</Text>
              </GlassCard>
            </Animated.View>
          )}

          {/* Metrics */}
          {job?.metrics && Object.keys(job.metrics).length > 0 && (
            <Animated.View entering={FadeInDown.delay(150)}>
              <Text style={styles.sectionTitle}>Metrics</Text>
              <View style={styles.metricsGrid}>
                {Object.entries(job.metrics).map(([key, value], index) => (
                  <Animated.View
                    key={key}
                    entering={FadeIn.delay(200 + index * 50)}
                  >
                    <GlassCard style={styles.metricCard}>
                      <Text style={styles.metricValue}>{value.toFixed(4)}</Text>
                      <Text style={styles.metricLabel}>{key}</Text>
                    </GlassCard>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Logs */}
          <Animated.View entering={FadeInDown.delay(250)}>
            <Text style={styles.sectionTitle}>Training Log</Text>
            {job?.logs && job.logs.length > 0 ? (
              job.logs.map((log, index) => (
                <Animated.View
                  key={index}
                  entering={FadeIn.delay(300 + index * 20)}
                >
                  <View style={styles.logItem}>
                    <Text style={styles.logTime}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </Text>
                    <Text style={styles.logMessage}>{log.message}</Text>
                  </View>
                </Animated.View>
              ))
            ) : (
              <View style={styles.emptyLogs}>
                <RefreshIcon size={32} color={colors.text.tertiary} />
                <Text style={styles.emptyLogsText}>No logs yet</Text>
              </View>
            )}
          </Animated.View>
        </ScrollView>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.heading,
    color: colors.text.primary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.xl,
  },
  progressCard: {
    marginBottom: spacing['2xl'],
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  progressLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.secondary,
  },
  progressValue: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.mono,
    color: colors.accent.primary,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.background.tertiary,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent.primary,
    borderRadius: 4,
  },
  modelType: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing['2xl'],
  },
  metricCard: {
    width: '48%',
    alignItems: 'center',
    padding: spacing.lg,
  },
  metricValue: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.mono,
    color: colors.accent.secondary,
  },
  metricLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textTransform: 'capitalize',
  },
  logItem: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  logTime: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.mono,
    color: colors.text.tertiary,
    marginRight: spacing.md,
    minWidth: 70,
  },
  logMessage: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
  },
  emptyLogs: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
  },
  emptyLogsText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.tertiary,
    marginTop: spacing.md,
  },
});
