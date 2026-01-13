import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius, shadows } from '../../lib/design-system';
import { useProjectStore, type Project } from '../../store/project-store';
import { useBuildStore } from '../../store/build-store';
import { api } from '../../lib/api';
import { GlassCard, Button } from '../../components/ui';
import {
  ChevronLeftIcon,
  RocketIcon,
  BuildIcon,
  PlusIcon,
  TrashIcon,
  EditIcon,
  GlobeIcon,
} from '../../components/icons';

interface Build {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  phase: string;
  startedAt: string;
  completedAt?: string;
}

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const [builds, setBuilds] = useState<Build[]>([]);

  const { currentProject, fetchProjectById, deleteProject, setCurrentProject } = useProjectStore();
  const { startNewSession } = useBuildStore();

  const fetchBuilds = useCallback(async () => {
    if (!id) return;
    try {
      const response = await api.getBuilds(id);
      if (response.success && response.data) {
        setBuilds(response.data.builds as Build[]);
      }
    } catch (error) {
      console.error('Failed to fetch builds:', error);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchProjectById(id);
      fetchBuilds();
    }
  }, [id, fetchProjectById, fetchBuilds]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (id) {
      await fetchProjectById(id);
      await fetchBuilds();
    }
    setRefreshing(false);
  }, [id, fetchProjectById, fetchBuilds]);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleNewBuild = async () => {
    if (!currentProject) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCurrentProject(currentProject);
    const sessionId = await startNewSession(currentProject.id);
    router.push(`/build/${sessionId}`);
  };

  const handleBuildPress = (build: Build) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/build/${build.id}`);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Project',
      'Are you sure you want to delete this project? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            if (id) {
              const success = await deleteProject(id);
              if (success) {
                router.back();
              }
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: Build['status']) => {
    switch (status) {
      case 'running':
        return colors.phases.building;
      case 'completed':
        return colors.status.success;
      case 'failed':
        return colors.status.error;
      default:
        return colors.text.secondary;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
              {currentProject?.name || 'Project'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {currentProject?.framework}
            </Text>
          </View>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <TrashIcon size={20} color={colors.status.error} />
          </TouchableOpacity>
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
          {/* New Build Button */}
          <Animated.View entering={FadeInDown.delay(100)}>
            <TouchableOpacity
              style={styles.newBuildButton}
              onPress={handleNewBuild}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[colors.accent.secondary, colors.accent.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.newBuildGradient}
              >
                <PlusIcon size={24} color={colors.text.inverse} />
                <Text style={styles.newBuildText}>Start New Build</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Project Info */}
          <Animated.View entering={FadeInDown.delay(150)}>
            <GlassCard style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Created</Text>
                  <Text style={styles.infoValue}>
                    {currentProject?.createdAt
                      ? formatDate(currentProject.createdAt)
                      : '-'}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Updated</Text>
                  <Text style={styles.infoValue}>
                    {currentProject?.updatedAt
                      ? formatDate(currentProject.updatedAt)
                      : '-'}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Builds</Text>
                  <Text style={styles.infoValue}>{builds.length}</Text>
                </View>
              </View>
            </GlassCard>
          </Animated.View>

          {/* Builds */}
          <Animated.View entering={FadeInDown.delay(200)}>
            <Text style={styles.sectionTitle}>Build History</Text>
            {builds.length > 0 ? (
              builds.map((build, index) => (
                <Animated.View
                  key={build.id}
                  entering={FadeInDown.delay(250 + index * 50)}
                >
                  <GlassCard
                    style={styles.buildCard}
                    onPress={() => handleBuildPress(build)}
                  >
                    <View style={styles.buildHeader}>
                      <View style={styles.buildIcon}>
                        <BuildIcon
                          size={20}
                          color={getStatusColor(build.status)}
                        />
                      </View>
                      <View style={styles.buildInfo}>
                        <Text style={styles.buildPhase}>{build.phase}</Text>
                        <Text style={styles.buildTime}>
                          {formatDate(build.startedAt)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: getStatusColor(build.status) + '20' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            { color: getStatusColor(build.status) },
                          ]}
                        >
                          {build.status}
                        </Text>
                      </View>
                    </View>
                    {build.status === 'running' && (
                      <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${build.progress}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.progressText}>{build.progress}%</Text>
                      </View>
                    )}
                  </GlassCard>
                </Animated.View>
              ))
            ) : (
              <View style={styles.emptyBuilds}>
                <BuildIcon size={48} color={colors.text.tertiary} />
                <Text style={styles.emptyBuildsText}>No builds yet</Text>
                <Text style={styles.emptyBuildsSubtext}>
                  Start your first build to see it here
                </Text>
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
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 2,
  },
  deleteButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.xl,
  },
  newBuildButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing['2xl'],
    ...shadows.glowStrong,
  },
  newBuildGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  newBuildText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.heading,
    color: colors.text.inverse,
  },
  infoCard: {
    marginBottom: spacing['2xl'],
  },
  infoRow: {
    flexDirection: 'row',
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  infoValue: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.primary,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  buildCard: {
    marginBottom: spacing.sm,
  },
  buildHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buildIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  buildPhase: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.primary,
  },
  buildTime: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
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
  emptyBuilds: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
  },
  emptyBuildsText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.heading,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  emptyBuildsSubtext: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
});
