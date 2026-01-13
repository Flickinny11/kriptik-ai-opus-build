import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, borderRadius, spacing } from '../../lib/design-system';
import { GlassCard } from '../ui/GlassCard';
import { UserIcon, RocketIcon, CodeIcon, CheckIcon, CloseIcon } from '../icons';
import type { ChatMessage as ChatMessageType } from '../../store/build-store';

interface ChatMessageProps {
  message: ChatMessageType;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function ChatMessage({ message, isExpanded, onToggleExpand }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isError = message.type === 'error';
  const isPlan = message.type === 'plan';
  const isCode = message.type === 'code' || (message.codeBlocks && message.codeBlocks.length > 0);

  const renderContent = () => {
    if (isPlan && message.plan) {
      return (
        <View style={styles.planContainer}>
          <Text style={styles.planTitle}>Implementation Plan</Text>
          {message.plan.steps.map((step, index) => (
            <View key={step.id} style={styles.planStep}>
              <View
                style={[
                  styles.planStepIndicator,
                  step.status === 'completed' && styles.planStepCompleted,
                  step.status === 'in_progress' && styles.planStepInProgress,
                  step.status === 'failed' && styles.planStepFailed,
                ]}
              >
                {step.status === 'completed' ? (
                  <CheckIcon size={12} color={colors.text.primary} />
                ) : step.status === 'failed' ? (
                  <CloseIcon size={12} color={colors.text.primary} />
                ) : (
                  <Text style={styles.planStepNumber}>{index + 1}</Text>
                )}
              </View>
              <Text
                style={[
                  styles.planStepText,
                  step.status === 'completed' && styles.planStepTextCompleted,
                ]}
              >
                {step.description}
              </Text>
            </View>
          ))}
        </View>
      );
    }

    if (isCode && message.codeBlocks) {
      return (
        <View style={styles.codeContainer}>
          {message.codeBlocks.map((block, index) => (
            <View key={index} style={styles.codeBlock}>
              {block.filename && (
                <View style={styles.codeHeader}>
                  <CodeIcon size={14} color={colors.accent.primary} />
                  <Text style={styles.codeFilename}>{block.filename}</Text>
                  <Text style={styles.codeAction}>{block.action}</Text>
                </View>
              )}
              <Text style={styles.codeContent} numberOfLines={isExpanded ? undefined : 8}>
                {block.code}
              </Text>
            </View>
          ))}
        </View>
      );
    }

    return (
      <Text
        style={[
          styles.messageText,
          isUser && styles.messageTextUser,
          isSystem && styles.messageTextSystem,
          isError && styles.messageTextError,
        ]}
      >
        {message.content}
        {message.isStreaming && <Text style={styles.cursor}>|</Text>}
      </Text>
    );
  };

  if (isUser) {
    return (
      <Animated.View entering={FadeInUp.duration(200)} style={styles.userContainer}>
        <View style={styles.userBubble}>
          <LinearGradient
            colors={['rgba(217, 119, 6, 0.15)', 'rgba(217, 119, 6, 0.05)']}
            style={StyleSheet.absoluteFill}
          />
          {renderContent()}
        </View>
        <View style={styles.userAvatar}>
          <UserIcon size={16} color={colors.accent.primary} />
        </View>
      </Animated.View>
    );
  }

  if (isSystem) {
    return (
      <Animated.View entering={FadeIn.duration(200)} style={styles.systemContainer}>
        <Text style={styles.systemText}>{message.content}</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.duration(200)} style={styles.assistantContainer}>
      <View style={styles.assistantAvatar}>
        <RocketIcon size={16} color={colors.accent.secondary} />
      </View>
      <GlassCard
        style={[styles.assistantBubble, isError && styles.errorBubble]}
        variant={isError ? 'error' : 'default'}
      >
        {renderContent()}
        {message.tokens && (
          <Text style={styles.tokenCount}>{message.tokens} tokens</Text>
        )}
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  userContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  userBubble: {
    maxWidth: '80%',
    borderRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.sm,
    padding: spacing.md,
    overflow: 'hidden',
    backgroundColor: colors.accent.muted,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  assistantContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  assistantBubble: {
    maxWidth: '80%',
    borderBottomLeftRadius: borderRadius.sm,
  },
  errorBubble: {
    borderColor: colors.status.error,
  },
  systemContainer: {
    alignItems: 'center',
    marginVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  systemText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  messageText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
    lineHeight: 22,
  },
  messageTextUser: {
    color: colors.text.primary,
  },
  messageTextSystem: {
    color: colors.text.tertiary,
  },
  messageTextError: {
    color: colors.status.error,
  },
  cursor: {
    color: colors.accent.primary,
  },
  tokenCount: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.mono,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
    textAlign: 'right',
  },
  planContainer: {
    gap: spacing.sm,
  },
  planTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.heading,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  planStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planStepIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planStepCompleted: {
    backgroundColor: colors.status.success,
  },
  planStepInProgress: {
    backgroundColor: colors.accent.primary,
  },
  planStepFailed: {
    backgroundColor: colors.status.error,
  },
  planStepNumber: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.secondary,
  },
  planStepText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
  },
  planStepTextCompleted: {
    textDecorationLine: 'line-through',
    color: colors.text.secondary,
  },
  codeContainer: {
    gap: spacing.md,
  },
  codeBlock: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.background.tertiary,
  },
  codeFilename: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.mono,
    color: colors.text.primary,
  },
  codeAction: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.accent.primary,
    textTransform: 'uppercase',
  },
  codeContent: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.mono,
    color: colors.text.primary,
    padding: spacing.md,
  },
});
