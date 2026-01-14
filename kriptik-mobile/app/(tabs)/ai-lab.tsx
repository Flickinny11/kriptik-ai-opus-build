import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius, shadows } from '../../lib/design-system';
import { GlassCard } from '../../components/ui';
import { api } from '../../lib/api';
import { LabIcon, PlusIcon, RocketIcon, CheckIcon, PlayIcon } from '../../components/icons';

interface TrainingJob {
  id: string;
  name: string;
  status: 'queued' | 'training' | 'completed' | 'failed';
  progress: number;
  modelType: string;
  createdAt: string;
}

interface Model {
  id: string;
  name: string;
  type: string;
  status: 'available' | 'deploying' | 'deployed';
  createdAt: string;
}

export default function AILabScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'training' | 'models'>('training');

  const { data: trainingData, refetch: refetchTraining } = useQuery({
    queryKey: ['training-jobs'],
    queryFn: async () => {
      const response = await api.getTrainingJobs();
      if (response.success && response.data) {
        return response.data.jobs;
      }
      return [];
    },
    refetchInterval: 5000,
  });

  const { data: modelsData, refetch: refetchModels } = useQuery({
    queryKey: ['models'],
    queryFn: async () => {
      const response = await api.getModels();
      if (response.success && response.data) {
        return response.data.models;
      }
      return [];
    },
  });

  const trainingJobs = trainingData || [];
  const models = modelsData || [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchTraining(), refetchModels()]);
    setRefreshing(false);
  }, [refetchTraining, refetchModels]);

  const handleJobPress = (job: TrainingJob) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/ai-lab/training/${job.id}`);
  };

  const handleNewTraining = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/new-build');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'training':
      case 'deploying':
        return colors.phases.building;
      case 'completed':
      case 'deployed':
        return colors.status.success;
      case 'failed':
        return colors.status.error;
      case 'available':
        return colors.status.info;
      default:
        return colors.text.tertiary;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>AI Lab</Text>
          <Text style={styles.subtitle}>Train and manage your models</Text>
        </View>
        <TouchableOpacity style={styles.newButton} onPress={handleNewTraining}>
          <LinearGradient
            colors={[colors.accent.secondary, colors.accent.primary]}
            style={styles.newButtonGradient}
          >
            <PlusIcon size={20} color={colors.text.inverse} />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'training' && styles.tabActive]}
          onPress={() => {
            setActiveTab('training');
            Haptics.selectionAsync();
          }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'training' && styles.tabTextActive,
            ]}
          >
            Training
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'models' && styles.tabActive]}
          onPress={() => {
            setActiveTab('models');
            Haptics.selectionAsync();
          }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'models' && styles.tabTextActive,
            ]}
          >
            Models
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'training' ? (
          <>
            {trainingJobs.map((job, index) => (
              <Animated.View
                key={job.id}
                entering={FadeInDown.delay(index * 50)}
              >
                <GlassCard
                  style={styles.card}
                  variant={job.status === 'training' ? 'elevated' : 'default'}
                  onPress={() => handleJobPress(job)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardIcon}>
                      <LabIcon size={24} color={colors.accent.primary} />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitle}>{job.name}</Text>
                      <Text style={styles.cardSubtitle}>{job.modelType}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: getStatusColor(job.status) },
                      ]}
                    />
                  </View>
                  {job.status === 'training' && (
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <Animated.View
                          style={[
                            styles.progressFill,
                            { width: `${job.progress}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.progressText}>{job.progress}%</Text>
                    </View>
                  )}
                </GlassCard>
              </Animated.View>
            ))}

            {trainingJobs.length === 0 && (
              <View style={styles.emptyState}>
                <LabIcon size={64} color={colors.text.tertiary} />
                <Text style={styles.emptyTitle}>No Training Jobs</Text>
                <Text style={styles.emptySubtitle}>
                  Start training a custom model
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {models.map((model, index) => (
              <Animated.View
                key={model.id}
                entering={FadeInDown.delay(index * 50)}
              >
                <GlassCard style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardIcon}>
                      <RocketIcon size={24} color={colors.accent.secondary} />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitle}>{model.name}</Text>
                      <Text style={styles.cardSubtitle}>{model.type}</Text>
                    </View>
                    <View style={styles.modelStatus}>
                      {model.status === 'deployed' ? (
                        <CheckIcon size={16} color={colors.status.success} />
                      ) : model.status === 'deploying' ? (
                        <PlayIcon size={16} color={colors.phases.building} />
                      ) : null}
                      <Text
                        style={[
                          styles.modelStatusText,
                          { color: getStatusColor(model.status) },
                        ]}
                      >
                        {model.status}
                      </Text>
                    </View>
                  </View>
                </GlassCard>
              </Animated.View>
            ))}

            {models.length === 0 && (
              <View style={styles.emptyState}>
                <RocketIcon size={64} color={colors.text.tertiary} />
                <Text style={styles.emptyTitle}>No Models</Text>
                <Text style={styles.emptySubtitle}>
                  Train a model to see it here
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 4,
  },
  newButton: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    ...shadows.glow,
  },
  newButtonGradient: {
    padding: spacing.md,
    borderRadius: borderRadius.full,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.secondary,
  },
  tabActive: {
    backgroundColor: colors.accent.muted,
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bodyMedium,
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.accent.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingTop: 0,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  cardTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.primary,
  },
  cardSubtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  modelStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modelStatusText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.bodySemiBold,
    textTransform: 'capitalize',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.background.tertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.mono,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    width: 40,
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['5xl'],
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.heading,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
