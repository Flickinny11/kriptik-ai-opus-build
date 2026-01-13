/**
 * SwarmResultCard - Shows final verification results from swarm agents
 *
 * Displays:
 * - Grid of 6 verification agents with status
 * - Overall verdict (APPROVED / NEEDS_WORK / BLOCKED)
 * - Expandable detailed reports
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, typography, spacing, radius } from '../design-tokens';

interface SwarmAgentResult {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'warning';
  score?: number;
  issues?: string[];
  suggestions?: string[];
}

type Verdict = 'approved' | 'needs_work' | 'blocked';

interface SwarmResultCardProps {
  verdict: Verdict;
  agents: SwarmAgentResult[];
  timestamp: Date;
  phaseName?: string;
  onExpand?: () => void;
}

const verdictConfig: Record<Verdict, { label: string; color: string; icon: React.ReactNode }> = {
  approved: {
    label: 'Approved',
    color: colors.success.main,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <path d="M22 4L12 14.01l-3-3" />
      </svg>
    ),
  },
  needs_work: {
    label: 'Needs Work',
    color: colors.warning.main,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    ),
  },
  blocked: {
    label: 'Blocked',
    color: colors.error.main,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M4.93 4.93l14.14 14.14" />
      </svg>
    ),
  },
};

const statusColors: Record<SwarmAgentResult['status'], string> = {
  passed: colors.success.main,
  failed: colors.error.main,
  warning: colors.warning.main,
};

export function SwarmResultCard({
  verdict,
  agents,
  timestamp,
  phaseName,
}: SwarmResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const config = verdictConfig[verdict];
  const passedCount = agents.filter((a) => a.status === 'passed').length;
  const avgScore = agents.reduce((sum, a) => sum + (a.score || 0), 0) / agents.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      style={{
        background: colors.bg.tertiary,
        borderRadius: radius.xl,
        border: `1px solid ${config.color}40`,
        overflow: 'hidden',
        marginTop: spacing[3],
        marginBottom: spacing[3],
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[3],
          padding: spacing[4],
          background: `linear-gradient(135deg, ${config.color}15, transparent)`,
        }}
      >
        {/* Verdict icon */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: radius.lg,
            background: `${config.color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: config.color,
            flexShrink: 0,
          }}
        >
          {config.icon}
        </div>

        {/* Verdict info */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing[2],
              marginBottom: spacing[1],
            }}
          >
            <span
              style={{
                fontSize: typography.sizes.lg,
                fontWeight: typography.weights.semibold,
                color: config.color,
              }}
            >
              {config.label}
            </span>
            {phaseName && (
              <span
                style={{
                  fontSize: typography.sizes.xs,
                  color: colors.text.muted,
                  padding: `${spacing[0.5]} ${spacing[2]}`,
                  background: colors.bg.primary,
                  borderRadius: radius.sm,
                }}
              >
                {phaseName}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: typography.sizes.sm,
              color: colors.text.secondary,
            }}
          >
            {passedCount}/{agents.length} checks passed
            {avgScore > 0 && ` - Avg score: ${Math.round(avgScore)}/100`}
          </div>
        </div>

        {/* Expand button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setExpanded(!expanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[1.5],
            padding: `${spacing[2]} ${spacing[3]}`,
            background: colors.bg.secondary,
            border: `1px solid ${colors.border.muted}`,
            borderRadius: radius.md,
            cursor: 'pointer',
            color: colors.text.secondary,
            fontSize: typography.sizes.xs,
          }}
        >
          {expanded ? 'Hide' : 'Details'}
          <motion.svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            animate={{ rotate: expanded ? 180 : 0 }}
          >
            <path d="M6 9l6 6 6-6" />
          </motion.svg>
        </motion.button>
      </div>

      {/* Agent grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: spacing[2],
          padding: spacing[3],
          background: colors.bg.secondary,
        }}
      >
        {agents.map((agent) => (
          <motion.button
            key={agent.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing[2],
              padding: `${spacing[2]} ${spacing[2.5]}`,
              background: `${statusColors[agent.status]}08`,
              borderRadius: radius.md,
              border: `1px solid ${statusColors[agent.status]}20`,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {/* Status icon */}
            <div style={{ color: statusColors[agent.status], flexShrink: 0 }}>
              {agent.status === 'passed' ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : agent.status === 'failed' ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v4M12 17h.01" />
                </svg>
              )}
            </div>

            {/* Agent name */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: typography.sizes.xs,
                  fontWeight: typography.weights.medium,
                  color: colors.text.primary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {agent.name}
              </div>
            </div>

            {/* Score */}
            {agent.score !== undefined && (
              <span
                style={{
                  fontSize: '10px',
                  color: statusColors[agent.status],
                  fontWeight: typography.weights.medium,
                }}
              >
                {agent.score}
              </span>
            )}
          </motion.button>
        ))}
      </div>

      {/* Expanded details */}
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
                borderTop: `1px solid ${colors.border.subtle}`,
                display: 'flex',
                flexDirection: 'column',
                gap: spacing[3],
              }}
            >
              {agents.map((agent) => (
                <div key={agent.id}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing[2],
                      marginBottom: spacing[2],
                    }}
                  >
                    <span
                      style={{
                        fontSize: typography.sizes.sm,
                        fontWeight: typography.weights.medium,
                        color: colors.text.primary,
                      }}
                    >
                      {agent.name}
                    </span>
                    <span
                      style={{
                        fontSize: typography.sizes.xs,
                        padding: `${spacing[0.5]} ${spacing[2]}`,
                        background: `${statusColors[agent.status]}15`,
                        borderRadius: radius.sm,
                        color: statusColors[agent.status],
                        fontWeight: typography.weights.medium,
                      }}
                    >
                      {agent.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Issues */}
                  {agent.issues && agent.issues.length > 0 && (
                    <div style={{ marginBottom: spacing[2] }}>
                      <div
                        style={{
                          fontSize: typography.sizes.xs,
                          color: colors.error.text,
                          marginBottom: spacing[1],
                        }}
                      >
                        Issues:
                      </div>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: spacing[4],
                          fontSize: typography.sizes.xs,
                          color: colors.text.secondary,
                        }}
                      >
                        {agent.issues.map((issue, i) => (
                          <li key={i} style={{ marginBottom: spacing[0.5] }}>
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Suggestions */}
                  {agent.suggestions && agent.suggestions.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontSize: typography.sizes.xs,
                          color: colors.info.text,
                          marginBottom: spacing[1],
                        }}
                      >
                        Suggestions:
                      </div>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: spacing[4],
                          fontSize: typography.sizes.xs,
                          color: colors.text.secondary,
                        }}
                      >
                        {agent.suggestions.map((suggestion, i) => (
                          <li key={i} style={{ marginBottom: spacing[0.5] }}>
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div
        style={{
          padding: `${spacing[2]} ${spacing[3]}`,
          borderTop: `1px solid ${colors.border.subtle}`,
          fontSize: '10px',
          color: colors.text.muted,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>
          {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <span>Verification complete</span>
      </div>
    </motion.div>
  );
}

export default SwarmResultCard;
