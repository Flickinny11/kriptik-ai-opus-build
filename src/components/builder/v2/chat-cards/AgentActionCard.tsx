/**
 * AgentActionCard - Shows individual agent browser actions in chat
 *
 * Displays actions like:
 * - Click events
 * - Form fills
 * - Navigation
 * - Scrolling
 */

import { motion } from 'framer-motion';
import { colors, typography, spacing, radius } from '../design-tokens';

export type ActionType = 'click' | 'type' | 'scroll' | 'navigate' | 'verify' | 'wait';

interface AgentActionCardProps {
  actionType: ActionType;
  description: string;
  target?: string;
  timestamp: Date;
  duration?: number; // milliseconds
}

const actionIcons: Record<ActionType, React.ReactNode> = {
  click: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 15l-2 5L9 9l11 4-5 2z" />
      <path d="M14 14l5 5" />
    </svg>
  ),
  type: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
    </svg>
  ),
  scroll: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  ),
  navigate: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <path d="M15 3h6v6M10 14L21 3" />
    </svg>
  ),
  verify: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  ),
  wait: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
};

const actionLabels: Record<ActionType, string> = {
  click: 'Clicked',
  type: 'Typed',
  scroll: 'Scrolled',
  navigate: 'Navigated',
  verify: 'Verified',
  wait: 'Waiting',
};

const actionColors: Record<ActionType, string> = {
  click: colors.accent[500],
  type: colors.info.main,
  scroll: colors.text.secondary,
  navigate: colors.accent[400],
  verify: colors.success.main,
  wait: colors.warning.main,
};

export function AgentActionCard({
  actionType,
  description,
  target,
  timestamp,
  duration,
}: AgentActionCardProps) {
  const color = actionColors[actionType];
  const timeSince = getTimeSince(timestamp);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: spacing[2.5],
        padding: `${spacing[2]} ${spacing[3]}`,
        background: `${color}08`,
        borderRadius: radius.lg,
        borderLeft: `3px solid ${color}`,
        marginTop: spacing[1],
        marginBottom: spacing[1],
      }}
    >
      {/* Icon */}
      <div
        style={{
          color,
          marginTop: spacing[0.5],
          flexShrink: 0,
        }}
      >
        {actionIcons[actionType]}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[2],
            marginBottom: spacing[0.5],
          }}
        >
          <span
            style={{
              fontSize: typography.sizes.xs,
              fontWeight: typography.weights.semibold,
              color,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {actionLabels[actionType]}
          </span>
          {target && (
            <span
              style={{
                fontSize: typography.sizes.xs,
                color: colors.text.primary,
                fontFamily: typography.fonts.mono,
                background: colors.bg.tertiary,
                padding: `${spacing[0.5]} ${spacing[1.5]}`,
                borderRadius: radius.sm,
              }}
            >
              {target}
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: typography.sizes.xs,
            color: colors.text.secondary,
          }}
        >
          {description}
        </div>
      </div>

      {/* Timestamp & duration */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: spacing[0.5],
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '10px',
            color: colors.text.muted,
          }}
        >
          {timeSince}
        </span>
        {duration !== undefined && (
          <span
            style={{
              fontSize: '10px',
              color: colors.text.muted,
              fontFamily: typography.fonts.mono,
            }}
          >
            {duration}ms
          </span>
        )}
      </div>
    </motion.div>
  );
}

function getTimeSince(timestamp: Date): string {
  const seconds = Math.floor((Date.now() - timestamp.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default AgentActionCard;
