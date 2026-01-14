import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius, shadows } from '../../lib/design-system';
import { GlassCard, Button } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth-store';
import { useNotificationStore } from '../../store/notification-store';
import {
  KripTikLogoIcon,
  PlusIcon,
  BellIcon,
  ChevronRightIcon,
  BuildIcon,
  AgentsIcon,
  RocketIcon,
} from '../../components/icons';

interface Project {
  id: string;
  name: string;
  description?: string;
  framework: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Build {
  id: string;
  projectId: string;
  projectName: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  phase: string;
  startedAt: string;
}

export default function HomeScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuthStore();
  const { unreadCount } = useNotificationStore();

  const { data: projectsData, refetch: refetchProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await api.getProjects();
      if (response.success && response.data) {
        return response.data.projects;
      }
      return [];
    },
  });

  const { data: buildsData, refetch: refetchBuilds } = useQuery({
    queryKey: ['builds'],
    queryFn: async () => {
      const response = await api.getBuilds();
      if (response.success && response.data) {
        return response.data.builds;
      }
      return [];
    },
    refetchInterval: 5000,
  });

  const projects = projectsData || [];
  const builds = buildsData || [];
  const activeBuilds = builds.filter((b) => b.status === 'running' || b.status === 'queued');
  const recentProjects = projects.slice(0, 5);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchProjects(), refetchBuilds()]);
    setRefreshing(false);
  }, [refetchProjects, refetchBuilds]);

  const handleNewBuild = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/new-build');
  };

  const handleProjectPress = (project: Project) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/project/${project.id}`);
  };

  const handleBuildPress = (build: Build) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/build/${build.id}`);
  };

  const handleNotifications = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/settings');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
          <View style={styles.headerLeft}>
            <KripTikLogoIcon size={40} />
            <View style={styles.headerText}>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.userName}>{user?.name || 'Builder'}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={handleNotifications}
          >
            <BellIcon size={24} color={colors.text.primary} />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionMain}
            onPress={handleNewBuild}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[colors.accent.secondary, colors.accent.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.quickActionMainGradient}
            >
              <PlusIcon size={28} color={colors.text.inverse} />
              <Text style={styles.quickActionMainText}>New Build</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Active Builds */}
        {activeBuilds.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Builds</Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push('/(tabs)/builds');
                }}
              >
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            {activeBuilds.slice(0, 3).map((build, index) => (
              <Animated.View
                key={build.id}
                entering={FadeInUp.delay(350 + index * 50)}
              >
                <GlassCard
                  style={styles.buildCard}
                  variant="elevated"
                  onPress={() => handleBuildPress(build)}
                >
                  <View style={styles.buildHeader}>
                    <View style={styles.buildIcon}>
                      <BuildIcon size={20} color={colors.accent.primary} />
                    </View>
                    <View style={styles.buildInfo}>
                      <Text style={styles.buildName}>{build.projectName}</Text>
                      <Text style={styles.buildPhase}>{build.phase}</Text>
                    </View>
                    <ChevronRightIcon size={20} color={colors.text.tertiary} />
                  </View>
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <Animated.View
                        style={[
                          styles.progressFill,
                          { width: `${build.progress}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>{build.progress}%</Text>
                  </View>
                </GlassCard>
              </Animated.View>
            ))}
          </Animated.View>
        )}

        {/* Recent Projects */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Projects</Text>
            {projects.length > 5 && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push('/(tabs)/builds');
                }}
              >
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            )}
          </View>
          {recentProjects.map((project, index) => (
            <Animated.View
              key={project.id}
              entering={FadeInUp.delay(450 + index * 50)}
            >
              <GlassCard
                style={styles.projectCard}
                onPress={() => handleProjectPress(project)}
              >
                <View style={styles.projectHeader}>
                  <View style={styles.projectIcon}>
                    <RocketIcon size={20} color={colors.text.secondary} />
                  </View>
                  <View style={styles.projectInfo}>
                    <Text style={styles.projectName}>{project.name}</Text>
                    <Text style={styles.projectFramework}>{project.framework}</Text>
                  </View>
                  <ChevronRightIcon size={20} color={colors.text.tertiary} />
                </View>
              </GlassCard>
            </Animated.View>
          ))}
          {projects.length === 0 && (
            <GlassCard style={styles.emptyCard}>
              <View style={styles.emptyContent}>
                <RocketIcon size={40} color={colors.text.tertiary} />
                <Text style={styles.emptyText}>No projects yet</Text>
                <Button
                  title="Create Your First Project"
                  onPress={handleNewBuild}
                  size="sm"
                />
              </View>
            </GlassCard>
          )}
        </Animated.View>

        {/* Stats Overview */}
        <Animated.View entering={FadeInDown.delay(500)} style={styles.statsContainer}>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statValue}>{projects.length}</Text>
            <Text style={styles.statLabel}>Projects</Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statValue}>{builds.length}</Text>
            <Text style={styles.statLabel}>Builds</Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statValue}>{activeBuilds.length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </GlassCard>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: spacing.md,
  },
  greeting: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
  },
  userName: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.heading,
    color: colors.text.primary,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: colors.status.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.primary,
  },
  quickActions: {
    marginBottom: spacing['2xl'],
  },
  quickActionMain: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.glowStrong,
  },
  quickActionMainGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  quickActionMainText: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.heading,
    color: colors.text.inverse,
  },
  section: {
    marginBottom: spacing['2xl'],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.heading,
    color: colors.text.primary,
  },
  seeAll: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bodyMedium,
    color: colors.accent.primary,
  },
  buildCard: {
    marginBottom: spacing.md,
  },
  buildHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buildIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  buildName: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.primary,
  },
  buildPhase: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 2,
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
  projectCard: {
    marginBottom: spacing.sm,
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  projectName: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.primary,
  },
  projectFramework: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 2,
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing['2xl'],
  },
  emptyContent: {
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.lg,
  },
  statValue: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.display,
    color: colors.accent.primary,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 4,
  },
});
