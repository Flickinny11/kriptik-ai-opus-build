/**
 * MergeNotificationCard - Shows when sandbox merges to main
 *
 * Displays:
 * - Success message with phase info
 * - Preview thumbnail before/after (if available)
 * - Link to view changes
 */

import { motion } from 'framer-motion';
import { colors, typography, spacing, radius } from '../design-tokens';

interface MergeNotificationCardProps {
  phase: number;
  phaseName: string;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  beforeThumbnail?: string;
  afterThumbnail?: string;
  timestamp: Date;
  onViewChanges?: () => void;
}

export function MergeNotificationCard({
  phase,
  phaseName,
  filesChanged,
  linesAdded,
  linesRemoved,
  beforeThumbnail,
  afterThumbnail,
  timestamp,
  onViewChanges,
}: MergeNotificationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      style={{
        background: `linear-gradient(135deg, ${colors.success.main}08, transparent)`,
        borderRadius: radius.xl,
        border: `1px solid ${colors.success.main}30`,
        overflow: 'hidden',
        marginTop: spacing[2],
        marginBottom: spacing[2],
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[3],
          padding: spacing[3],
        }}
      >
        {/* Success icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.1 }}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: radius.lg,
            background: `${colors.success.main}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.success.main,
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <path d="M22 4L12 14.01l-3-3" />
          </svg>
        </motion.div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: typography.sizes.sm,
              fontWeight: typography.weights.semibold,
              color: colors.success.text,
              marginBottom: spacing[0.5],
            }}
          >
            Phase {phase} Merged Successfully
          </div>
          <div
            style={{
              fontSize: typography.sizes.xs,
              color: colors.text.secondary,
            }}
          >
            {phaseName} implementation merged to main sandbox
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[3],
            fontSize: typography.sizes.xs,
            fontFamily: typography.fonts.mono,
          }}
        >
          <span style={{ color: colors.text.muted }}>
            {filesChanged} file{filesChanged !== 1 ? 's' : ''}
          </span>
          <span style={{ color: colors.success.main }}>+{linesAdded}</span>
          <span style={{ color: colors.error.main }}>-{linesRemoved}</span>
        </div>
      </div>

      {/* Thumbnails (if available) */}
      {(beforeThumbnail || afterThumbnail) && (
        <div
          style={{
            display: 'flex',
            gap: spacing[3],
            padding: spacing[3],
            paddingTop: 0,
          }}
        >
          {beforeThumbnail && (
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: '10px',
                  color: colors.text.muted,
                  marginBottom: spacing[1],
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Before
              </div>
              <div
                style={{
                  borderRadius: radius.md,
                  overflow: 'hidden',
                  background: colors.bg.primary,
                  aspectRatio: '16/10',
                }}
              >
                <img
                  src={beforeThumbnail}
                  alt="Before merge"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            </div>
          )}

          {/* Arrow */}
          {beforeThumbnail && afterThumbnail && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.success.main,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
          )}

          {afterThumbnail && (
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: '10px',
                  color: colors.text.muted,
                  marginBottom: spacing[1],
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                After
              </div>
              <div
                style={{
                  borderRadius: radius.md,
                  overflow: 'hidden',
                  background: colors.bg.primary,
                  aspectRatio: '16/10',
                  border: `2px solid ${colors.success.main}30`,
                }}
              >
                <img
                  src={afterThumbnail}
                  alt="After merge"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${spacing[2]} ${spacing[3]}`,
          borderTop: `1px solid ${colors.border.subtle}`,
        }}
      >
        <span
          style={{
            fontSize: '10px',
            color: colors.text.muted,
          }}
        >
          {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>

        {onViewChanges && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onViewChanges}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing[1.5],
              padding: `${spacing[1]} ${spacing[2.5]}`,
              background: 'transparent',
              border: `1px solid ${colors.border.muted}`,
              borderRadius: radius.md,
              cursor: 'pointer',
              color: colors.text.secondary,
              fontSize: typography.sizes.xs,
            }}
          >
            View Changes
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <path d="M15 3h6v6M10 14L21 3" />
            </svg>
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export default MergeNotificationCard;
