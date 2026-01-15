/**
 * RecentBuildsList Component
 * Displays recent build history with status indicators
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow } from 'date-fns';
import { colors, typography, spacing } from '../../lib/design-system';
import { GlassCard } from '../ui/GlassCard';
import { CheckIcon, CloseIcon, PlayIcon, RefreshIcon } from '../icons';
import type { Build } from '../../store/project-store';

interface RecentBuildsListProps {
  builds: Build[];
}

const statusIcons = {
  pending: RefreshIcon,
  running: PlayIcon,
  success: CheckIcon,
  failed: CloseIcon,
  cancelled: CloseIcon,
};

const statusColors = {
  pending: colors.text.tertiary,
  running: colors.accent.primary,
  success: colors.status.success,
  failed: colors.status.error,
  cancelled: colors.text.tertiary,
};

export function RecentBuildsList({ builds }: RecentBuildsListProps) {
  if (builds.length === 0) {
    return (
      <GlassCard style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No recent builds</Text>
      </GlassCard>
    );
  }

  return (
    <GlassCard style={styles.container} noPadding>
      {builds.map((build, index) => {
        const StatusIcon = statusIcons[build.status];
        const statusColor = statusColors[build.status];

        return (
          <TouchableOpacity
            key={build.id}
            style={[
              styles.buildItem,
              index < builds.length - 1 && styles.buildItemBorder,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/build/${build.id}`);
            }}
          >
            <View style={[styles.statusIcon, { backgroundColor: `${statusColor}20` }]}>
              <StatusIcon size={16} color={statusColor} />
            </View>

            <View style={styles.buildInfo}>
              <Text style={styles.buildPrompt} numberOfLines={1}>
                {build.prompt}
              </Text>
              <Text style={styles.buildMeta}>
                {formatDistanceToNow(new Date(build.createdAt), { addSuffix: true })}
                {build.duration && ` • ${Math.round(build.duration / 1000)}s`}
              </Text>
            </View>

            {build.verificationResults && (
              <View style={styles.buildStats}>
                <Text style={[styles.statText, { color: colors.status.success }]}>
                  {build.verificationResults.passed}✓
                </Text>
                {build.verificationResults.failed > 0 && (
                  <Text style={[styles.statText, { color: colors.status.error }]}>
                    {build.verificationResults.failed}✗
                  </Text>
                )}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  emptyText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
  },
  buildItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  buildItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  buildPrompt: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  buildMeta: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  buildStats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.xs,
  },
});
