/**
 * PhaseVerificationCard - Inline card showing verification progress in chat
 *
 * Appears when a build phase starts verification
 * Shows:
 * - Small browser preview thumbnail (updates at 2fps)
 * - Current verification step
 * - Swarm agent progress bars
 * - Expandable for details
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, typography, spacing, radius } from '../design-tokens';

interface SwarmAgentProgress {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'warning';
  progress: number; // 0-100
  score?: number;
  message?: string;
}

interface PhaseVerificationCardProps {
  phase: number;
  phaseName: string;
  browserThumbnailUrl?: string;
  currentStep?: string;
  swarmAgents: SwarmAgentProgress[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  timestamp: Date;
}

const statusColors: Record<SwarmAgentProgress['status'], string> = {
  pending: colors.text.muted,
  running: colors.accent[500],
  passed: colors.success.main,
  failed: colors.error.main,
  warning: colors.warning.main,
};

export function PhaseVerificationCard({
  phase,
  phaseName,
  browserThumbnailUrl,
  currentStep,
  swarmAgents,
  isExpanded = false,
  onToggleExpand,
  timestamp,
}: PhaseVerificationCardProps) {
  const [localExpanded, setLocalExpanded] = useState(isExpanded);
  const expanded = onToggleExpand ? isExpanded : localExpanded;
  const toggleExpand = onToggleExpand || (() => setLocalExpanded((v) => !v));

  const completedAgents = swarmAgents.filter((a) => a.status === 'passed' || a.status === 'failed');
  const overallProgress = swarmAgents.length > 0
    ? swarmAgents.reduce((sum, a) => sum + a.progress, 0) / swarmAgents.length
    : 0;

  const phaseColor = colors.accent[500];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      style={{
        background: colors.bg.tertiary,
        borderRadius: radius.xl,
        border: `1px solid ${phaseColor}30`,
        overflow: 'hidden',
        marginTop: spacing[2],
        marginBottom: spacing[2],
      }}
    >
      {/* Header - always visible */}
      <button
        onClick={toggleExpand}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: spacing[3],
          padding: spacing[3],
          background: `linear-gradient(135deg, ${phaseColor}08, transparent)`,
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Browser thumbnail */}
        {browserThumbnailUrl && (
          <div
            style={{
              width: '80px',
              height: '60px',
              borderRadius: radius.md,
              overflow: 'hidden',
              background: colors.bg.primary,
              flexShrink: 0,
            }}
          >
            <img
              src={browserThumbnailUrl}
              alt="Browser preview"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
        )}

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing[2],
              marginBottom: spacing[1],
            }}
          >
            {/* Phase badge */}
            <span
              style={{
                padding: `${spacing[0.5]} ${spacing[2]}`,
                background: `${phaseColor}20`,
                borderRadius: radius.sm,
                fontSize: typography.sizes.xs,
                fontWeight: typography.weights.semibold,
                color: phaseColor,
              }}
            >
              Phase {phase}
            </span>
            <span
              style={{
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.medium,
                color: colors.text.primary,
              }}
            >
              {phaseName}
            </span>
          </div>

          {/* Current step */}
          {currentStep && (
            <div
              style={{
                fontSize: typography.sizes.xs,
                color: colors.text.secondary,
                marginBottom: spacing[2],
              }}
            >
              {currentStep}
            </div>
          )}

          {/* Overall progress bar */}
          <div
            style={{
              height: '4px',
              background: colors.bg.primary,
              borderRadius: radius.full,
              overflow: 'hidden',
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.3 }}
              style={{
                height: '100%',
                background: `linear-gradient(90deg, ${phaseColor}, ${colors.accent[400]})`,
                borderRadius: radius.full,
              }}
            />
          </div>
        </div>

        {/* Progress indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[2],
            color: colors.text.muted,
          }}
        >
          <span style={{ fontSize: typography.sizes.xs }}>
            {completedAgents.length}/{swarmAgents.length}
          </span>
          <motion.svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <path d="M6 9l6 6 6-6" />
          </motion.svg>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                padding: spacing[3],
                paddingTop: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: spacing[2],
              }}
            >
              {swarmAgents.map((agent) => (
                <div
                  key={agent.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing[3],
                    padding: `${spacing[2]} ${spacing[3]}`,
                    background: `${statusColors[agent.status]}08`,
                    borderRadius: radius.md,
                    border: `1px solid ${statusColors[agent.status]}15`,
                  }}
                >
                  {/* Status icon */}
                  <div style={{ color: statusColors[agent.status], flexShrink: 0 }}>
                    {agent.status === 'running' ? (
                      <motion.svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                      </motion.svg>
                    ) : agent.status === 'passed' ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : agent.status === 'failed' ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M15 9l-6 6M9 9l6 6" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" strokeDasharray="4 4" />
                      </svg>
                    )}
                  </div>

                  {/* Agent info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: typography.sizes.xs,
                        fontWeight: typography.weights.medium,
                        color: colors.text.primary,
                      }}
                    >
                      {agent.name}
                    </div>
                    {agent.message && (
                      <div
                        style={{
                          fontSize: '10px',
                          color: colors.text.muted,
                          marginTop: spacing[0.5],
                        }}
                      >
                        {agent.message}
                      </div>
                    )}
                  </div>

                  {/* Score/Progress */}
                  <div
                    style={{
                      fontSize: typography.sizes.xs,
                      fontWeight: typography.weights.medium,
                      color: statusColors[agent.status],
                    }}
                  >
                    {agent.score !== undefined ? `${agent.score}/100` : `${agent.progress}%`}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timestamp footer */}
      <div
        style={{
          padding: `${spacing[2]} ${spacing[3]}`,
          borderTop: `1px solid ${colors.border.subtle}`,
          fontSize: '10px',
          color: colors.text.muted,
        }}
      >
        {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
    </motion.div>
  );
}

export default PhaseVerificationCard;
