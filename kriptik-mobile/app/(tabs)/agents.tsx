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
import { AgentsIcon, PlusIcon, PlayIcon, CheckIcon, CloseIcon } from '../../components/icons';

interface Agent {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  task?: string;
  progress: number;
  createdAt: string;
}

export default function AgentsScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const response = await api.getAgents();
      if (response.success && response.data) {
        return response.data.agents;
      }
      return [];
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds for active agents
  });

  const agents = data || [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleAgentPress = (agent: Agent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/feature-agent/${agent.id}`);
  };

  const handleNewAgent = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // TODO: Open new agent modal
  };

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'running':
        return colors.phases.building;
      case 'completed':
        return colors.status.success;
      case 'failed':
        return colors.status.error;
      default:
        return colors.text.tertiary;
    }
  };

  const getStatusIcon = (status: Agent['status']) => {
    switch (status) {
      case 'running':
        return <PlayIcon size={16} color={colors.phases.building} />;
      case 'completed':
        return <CheckIcon size={16} color={colors.status.success} />;
      case 'failed':
        return <CloseIcon size={16} color={colors.status.error} />;
      default:
        return null;
    }
  };

  const activeAgents = agents.filter((a) => a.status === 'running');
  const completedAgents = agents.filter((a) => a.status !== 'running');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Feature Agents</Text>
          <Text style={styles.subtitle}>
            {activeAgents.length} active, {completedAgents.length} completed
          </Text>
        </View>
        <TouchableOpacity style={styles.newButton} onPress={handleNewAgent}>
          <LinearGradient
            colors={[colors.accent.secondary, colors.accent.primary]}
            style={styles.newButtonGradient}
          >
            <PlusIcon size={20} color={colors.text.inverse} />
          </LinearGradient>
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
        {/* Active Agents */}
        {activeAgents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active</Text>
            {activeAgents.map((agent, index) => (
              <Animated.View
                key={agent.id}
                entering={FadeInDown.delay(index * 50)}
              >
                <GlassCard
                  style={styles.agentCard}
                  variant="elevated"
                  onPress={() => handleAgentPress(agent)}
                >
                  <View style={styles.agentHeader}>
                    <View style={styles.agentIcon}>
                      <AgentsIcon size={24} color={colors.accent.primary} />
                    </View>
                    <View style={styles.agentInfo}>
                      <Text style={styles.agentName}>{agent.name}</Text>
                      <Text style={styles.agentTask} numberOfLines={1}>
                        {agent.task || 'Processing...'}
                      </Text>
                    </View>
                    <View style={styles.statusBadge}>
                      {getStatusIcon(agent.status)}
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(agent.status) },
                        ]}
                      >
                        {agent.status}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <Animated.View
                        style={[
                          styles.progressFill,
                          { width: `${agent.progress}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>{agent.progress}%</Text>
                  </View>
                </GlassCard>
              </Animated.View>
            ))}
          </View>
        )}

        {/* Completed Agents */}
        {completedAgents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent</Text>
            {completedAgents.map((agent, index) => (
              <Animated.View
                key={agent.id}
                entering={FadeInDown.delay((activeAgents.length + index) * 50)}
              >
                <GlassCard
                  style={styles.agentCard}
                  onPress={() => handleAgentPress(agent)}
                >
                  <View style={styles.agentHeader}>
                    <View
                      style={[
                        styles.agentIcon,
                        agent.status === 'failed' && styles.agentIconFailed,
                      ]}
                    >
                      <AgentsIcon
                        size={24}
                        color={
                          agent.status === 'failed'
                            ? colors.status.error
                            : colors.text.secondary
                        }
                      />
                    </View>
                    <View style={styles.agentInfo}>
                      <Text style={styles.agentName}>{agent.name}</Text>
                      <Text style={styles.agentTask} numberOfLines={1}>
                        {agent.task}
                      </Text>
                    </View>
                    <View style={styles.statusBadge}>
                      {getStatusIcon(agent.status)}
                    </View>
                  </View>
                </GlassCard>
              </Animated.View>
            ))}
          </View>
        )}

        {/* Empty State */}
        {agents.length === 0 && !isLoading && (
          <View style={styles.emptyState}>
            <AgentsIcon size={64} color={colors.text.tertiary} />
            <Text style={styles.emptyTitle}>No Feature Agents</Text>
            <Text style={styles.emptySubtitle}>
              Start a new agent to automate complex tasks
            </Text>
          </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingTop: 0,
  },
  section: {
    marginBottom: spacing['2xl'],
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  agentCard: {
    marginBottom: spacing.md,
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  agentIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentIconFailed: {
    backgroundColor: colors.status.errorMuted,
  },
  agentInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  agentName: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.primary,
  },
  agentTask: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
