/**
 * QuickStats Component
 * Displays overview stats with animated entrance
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { colors, typography, spacing, borderRadius } from '../../lib/design-system';
import { BuildIcon, AgentsIcon, RocketIcon } from '../icons';

interface QuickStatsProps {
  projectCount: number;
  activeBuilds: number;
  activeAgents: number;
}

export function QuickStats({ projectCount, activeBuilds, activeAgents }: QuickStatsProps) {
  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInRight.delay(100)} style={styles.statCard}>
        <View style={[styles.iconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
          <RocketIcon size={20} color={colors.status.info} />
        </View>
        <Text style={styles.statValue}>{projectCount}</Text>
        <Text style={styles.statLabel}>Projects</Text>
      </Animated.View>

      <Animated.View entering={FadeInRight.delay(150)} style={styles.statCard}>
        <View style={[styles.iconContainer, { backgroundColor: 'rgba(217, 119, 6, 0.2)' }]}>
          <BuildIcon size={20} color={colors.accent.primary} />
        </View>
        <Text style={styles.statValue}>{activeBuilds}</Text>
        <Text style={styles.statLabel}>Building</Text>
      </Animated.View>

      <Animated.View entering={FadeInRight.delay(200)} style={styles.statCard}>
        <View style={[styles.iconContainer, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
          <AgentsIcon size={20} color={colors.status.success} />
        </View>
        <Text style={styles.statValue}>{activeAgents}</Text>
        <Text style={styles.statLabel}>Agents</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize['2xl'],
    color: colors.text.primary,
  },
  statLabel: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
});
