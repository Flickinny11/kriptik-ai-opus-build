/**
 * ProjectCard Component
 * Displays project info with status, build progress, and glass morphism design
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow } from 'date-fns';
import { colors, typography, spacing, borderRadius, animations } from '../../lib/design-system';
import { GlassCard } from '../ui/GlassCard';
import { ProgressBar } from '../ui/ProgressBar';
import { ChevronRightIcon } from '../icons';
import type { Project } from '../../store/project-store';

interface ProjectCardProps {
  project: Project;
  showActiveBuild?: boolean;
  onPress: () => void;
}

const frameworkIcons: Record<string, string> = {
  nextjs: '⚡',
  react: '⚛️',
  vue: '💚',
  svelte: '🔥',
  remix: '💿',
  astro: '🚀',
  express: '📦',
  fastify: '⚡',
};

const statusColors: Record<Project['status'], string> = {
  active: colors.status.info,
  building: colors.accent.primary,
  deployed: colors.status.success,
  error: colors.status.error,
  archived: colors.text.tertiary,
};

export function ProjectCard({ project, showActiveBuild, onPress }: ProjectCardProps) {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.98, animations.spring.snappy);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, animations.spring.snappy);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <GlassCard
          style={styles.card}
          variant={project.activeBuild ? 'elevated' : 'default'}
          glowColor={statusColors[project.status]}
        >
          <View style={styles.header}>
            <View style={styles.projectInfo}>
              {project.thumbnailUrl ? (
                <Image source={{ uri: project.thumbnailUrl }} style={styles.thumbnail} />
              ) : (
                <View style={styles.iconContainer}>
                  <Text style={styles.frameworkIcon}>
                    {frameworkIcons[project.framework] || '📁'}
                  </Text>
                </View>
              )}
              <View style={styles.textContainer}>
                <Text style={styles.projectName} numberOfLines={1}>
                  {project.name}
                </Text>
                <Text style={styles.projectMeta}>
                  {project.framework.toUpperCase()} • {project.buildCount} builds
                </Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColors[project.status]}20` }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColors[project.status] }]} />
              <Text style={[styles.statusText, { color: statusColors[project.status] }]}>
                {project.activeBuild
                  ? project.activeBuild.phase.replace('_', ' ')
                  : project.status}
              </Text>
            </View>
          </View>

          {showActiveBuild && project.activeBuild && (
            <View style={styles.buildProgress}>
              <ProgressBar
                progress={project.activeBuild.progress}
                color={colors.accent.primary}
                animated
              />
              <Text style={styles.buildMessage} numberOfLines={1}>
                {project.activeBuild.message}
              </Text>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.lastUpdated}>
              {project.lastBuildAt
                ? `Last build ${formatDistanceToNow(new Date(project.lastBuildAt), { addSuffix: true })}`
                : 'No builds yet'}
            </Text>
            <ChevronRightIcon size={20} color={colors.text.tertiary} />
          </View>
        </GlassCard>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  projectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameworkIcon: {
    fontSize: 22,
  },
  textContainer: {
    flex: 1,
    marginLeft: spacing.md,
  },
  projectName: {
    fontFamily: typography.fontFamily.bodySemiBold,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  projectMeta: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  statusText: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    textTransform: 'capitalize',
  },
  buildProgress: {
    marginTop: spacing.lg,
  },
  buildMessage: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  lastUpdated: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
});
