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
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius } from '../../lib/design-system';
import { api } from '../../lib/api';
import { GlassCard, Button } from '../../components/ui';
import {
  ChevronLeftIcon,
  AgentsIcon,
  PlayIcon,
  StopIcon,
  CheckIcon,
  CloseIcon,
  RefreshIcon,
} from '../../components/icons';

interface AgentLog {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface Agent {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  task?: string;
  progress: number;
  logs: AgentLog[];
  createdAt: string;
}

export default function FeatureAgentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAgent = useCallback(async () => {
    if (!id) return;
    try {
      const response = await api.getAgent(id);
      if (response.success && response.data) {
        setAgent(response.data.agent as Agent);
      }
    } catch (error) {
      console.error('Failed to fetch agent:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAgent();
    // Poll for updates if running
    const interval = setInterval(() => {
      if (agent?.status === 'running') {
        fetchAgent();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [id, agent?.status, fetchAgent]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAgent();
    setRefreshing(false);
  }, [fetchAgent]);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleStop = () => {
    Alert.alert(
      'Stop Agent',
      'Are you sure you want to stop this agent?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            if (id) {
              await api.stopAgent(id);
              await fetchAgent();
            }
          },
        },
      ]
    );
  };

  const getStatusColor = () => {
    switch (agent?.status) {
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

  const getStatusIcon = () => {
    switch (agent?.status) {
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

  const getLogColor = (type: AgentLog['type']) => {
    switch (type) {
      case 'success':
        return colors.status.success;
      case 'warning':
        return colors.status.warning;
      case 'error':
        return colors.status.error;
      default:
        return colors.text.secondary;
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
              {agent?.name || 'Feature Agent'}
            </Text>
            <View style={styles.statusRow}>
              {getStatusIcon()}
              <Text style={[styles.statusText, { color: getStatusColor() }]}>
                {agent?.status || 'Loading'}
              </Text>
            </View>
          </View>
          <View style={styles.headerIcon}>
            <AgentsIcon size={24} color={colors.accent.primary} />
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
          {/* Task */}
          {agent?.task && (
            <Animated.View entering={FadeInDown.delay(100)}>
              <GlassCard style={styles.taskCard}>
                <Text style={styles.taskLabel}>Task</Text>
                <Text style={styles.taskText}>{agent.task}</Text>
              </GlassCard>
            </Animated.View>
          )}

          {/* Progress */}
          {agent?.status === 'running' && (
            <Animated.View entering={FadeInDown.delay(150)}>
              <GlassCard style={styles.progressCard} variant="elevated">
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Progress</Text>
                  <Text style={styles.progressValue}>{agent.progress}%</Text>
                </View>
                <View style={styles.progressBar}>
                  <Animated.View
                    style={[styles.progressFill, { width: `${agent.progress}%` }]}
                  />
                </View>
                <Button
                  title="Stop Agent"
                  variant="danger"
                  onPress={handleStop}
                  icon={<StopIcon size={16} color={colors.text.primary} />}
                  fullWidth
                  style={styles.stopButton}
                />
              </GlassCard>
            </Animated.View>
          )}

          {/* Logs */}
          <Animated.View entering={FadeInDown.delay(200)}>
            <Text style={styles.sectionTitle}>Activity Log</Text>
            {agent?.logs && agent.logs.length > 0 ? (
              agent.logs.map((log, index) => (
                <Animated.View
                  key={index}
                  entering={FadeIn.delay(250 + index * 30)}
                >
                  <View style={styles.logItem}>
                    <View
                      style={[
                        styles.logDot,
                        { backgroundColor: getLogColor(log.type) },
                      ]}
                    />
                    <View style={styles.logContent}>
                      <Text style={styles.logMessage}>{log.message}</Text>
                      <Text style={styles.logTime}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              ))
            ) : (
              <View style={styles.emptyLogs}>
                <RefreshIcon size={32} color={colors.text.tertiary} />
                <Text style={styles.emptyLogsText}>No activity yet</Text>
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
  statusText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    textTransform: 'capitalize',
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
  taskCard: {
    marginBottom: spacing.lg,
  },
  taskLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  taskText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
    lineHeight: 22,
  },
  progressCard: {
    marginBottom: spacing.lg,
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
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.mono,
    color: colors.accent.primary,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.background.tertiary,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent.primary,
    borderRadius: 4,
  },
  stopButton: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  logItem: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  logDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: spacing.md,
  },
  logContent: {
    flex: 1,
  },
  logMessage: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
    lineHeight: 20,
  },
  logTime: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.mono,
    color: colors.text.tertiary,
    marginTop: 2,
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
