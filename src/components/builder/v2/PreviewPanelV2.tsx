/**
 * PreviewPanelV2 - Live preview with Agent Browser Verification
 *
 * Features:
 * - Live iframe preview of the app being built
 * - Viewport selector (Desktop/Tablet/Mobile)
 * - Refresh button with timestamp
 * - Console drawer (collapsible)
 * - Agent Browser Verification Window (KEY FEATURE)
 *   - Small overlay showing real-time agent browser at 2fps
 *   - Appears during verification phases
 *   - Shows swarm verification status
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, typography, spacing, radius, shadows, viewportSizes } from './design-tokens';
import { ViewportSelector, type ViewportType } from './ViewportSelector';

interface SwarmAgentStatus {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'warning';
  score?: number;
  message?: string;
}

interface PreviewPanelV2Props {
  sandboxUrl?: string;
  projectId?: string;
  isVerifying?: boolean;
  verificationPhase?: number;
  verificationTarget?: string;
  swarmStatus?: SwarmAgentStatus[];
  browserStreamUrl?: string;
  onRefresh?: () => void;
  onOpenNewTab?: () => void;
}

// Default swarm agents
const defaultSwarmAgents: SwarmAgentStatus[] = [
  { id: 'error-checker', name: 'Error Checker', status: 'pending' },
  { id: 'code-quality', name: 'Code Quality', status: 'pending' },
  { id: 'visual-verifier', name: 'Visual Verifier', status: 'pending' },
  { id: 'security-scanner', name: 'Security Scanner', status: 'pending' },
  { id: 'placeholder-eliminator', name: 'Placeholder Eliminator', status: 'pending' },
  { id: 'design-style', name: 'Design Style', status: 'pending' },
];

const statusColors: Record<SwarmAgentStatus['status'], string> = {
  pending: colors.text.muted,
  running: colors.accent[500],
  passed: colors.success.main,
  failed: colors.error.main,
  warning: colors.warning.main,
};

const statusIcons: Record<SwarmAgentStatus['status'], React.ReactNode> = {
  pending: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" strokeDasharray="4 4" />
    </svg>
  ),
  running: (
    <motion.svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    >
      <path d="M21 12a9 9 0 11-6.219-8.56" />
    </motion.svg>
  ),
  passed: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  failed: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
};

export function PreviewPanelV2({
  sandboxUrl,
  projectId,
  isVerifying = false,
  verificationPhase,
  verificationTarget,
  swarmStatus = defaultSwarmAgents,
  browserStreamUrl,
  onRefresh,
  onOpenNewTab,
}: PreviewPanelV2Props) {
  const [viewport, setViewport] = useState<ViewportType>('desktop');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [showConsole, setShowConsole] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [verificationWindowVisible, setVerificationWindowVisible] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const viewportConfig = viewportSizes[viewport];

  // Show verification window when verifying
  useEffect(() => {
    if (isVerifying) {
      setVerificationWindowVisible(true);
    } else {
      // Auto-hide after success (3 seconds)
      const timer = setTimeout(() => setVerificationWindowVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isVerifying]);

  const handleRefresh = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
    setLastRefreshed(new Date());
    onRefresh?.();
  }, [onRefresh]);

  const handleOpenNewTab = useCallback(() => {
    if (sandboxUrl) {
      window.open(sandboxUrl, '_blank');
    }
    onOpenNewTab?.();
  }, [sandboxUrl, onOpenNewTab]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: colors.bg.secondary,
        borderRadius: radius.xl,
        overflow: 'hidden',
        border: `1px solid ${colors.border.subtle}`,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${spacing[3]} ${spacing[4]}`,
          borderBottom: `1px solid ${colors.border.subtle}`,
          background: colors.bg.panel,
        }}
      >
        {/* Left: URL bar style */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[2],
            flex: 1,
            maxWidth: '400px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing[2],
              padding: `${spacing[1.5]} ${spacing[3]}`,
              background: colors.bg.tertiary,
              borderRadius: radius.md,
              flex: 1,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.success.main}
              strokeWidth="2"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span
              style={{
                fontSize: typography.sizes.sm,
                color: colors.text.secondary,
                fontFamily: typography.fonts.mono,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {sandboxUrl || `preview/${projectId || 'new'}`}
            </span>
          </div>
        </div>

        {/* Center: Viewport selector */}
        <ViewportSelector value={viewport} onChange={setViewport} />

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          {/* Last refreshed */}
          <span
            style={{
              fontSize: typography.sizes.xs,
              color: colors.text.muted,
              fontFamily: typography.fonts.mono,
            }}
          >
            {formatTime(lastRefreshed)}
          </span>

          {/* Refresh button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: colors.bg.tertiary,
              border: 'none',
              borderRadius: radius.md,
              cursor: 'pointer',
              color: colors.text.secondary,
            }}
            title="Refresh preview"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
          </motion.button>

          {/* Open in new tab */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleOpenNewTab}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: colors.bg.tertiary,
              border: 'none',
              borderRadius: radius.md,
              cursor: 'pointer',
              color: colors.text.secondary,
            }}
            title="Open in new tab"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <path d="M15 3h6v6M10 14L21 3" />
            </svg>
          </motion.button>

          {/* Console toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowConsole(!showConsole)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: showConsole ? `${colors.accent[600]}20` : colors.bg.tertiary,
              border: 'none',
              borderRadius: radius.md,
              cursor: 'pointer',
              color: showConsole ? colors.accent[500] : colors.text.secondary,
            }}
            title="Toggle console"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 17l6-6-6-6M12 19h8" />
            </svg>
          </motion.button>
        </div>
      </div>

      {/* Preview area */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: spacing[4],
          background: `
            linear-gradient(45deg, ${colors.bg.primary} 25%, transparent 25%),
            linear-gradient(-45deg, ${colors.bg.primary} 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, ${colors.bg.primary} 75%),
            linear-gradient(-45deg, transparent 75%, ${colors.bg.primary} 75%)
          `,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          backgroundColor: colors.bg.tertiary,
          overflow: 'auto',
        }}
      >
        {/* Iframe container with viewport sizing */}
        <div
          style={{
            width: viewport === 'desktop' ? '100%' : `${viewportConfig.width}px`,
            maxWidth: '100%',
            height: '100%',
            background: '#FFFFFF',
            borderRadius: radius.lg,
            boxShadow: shadows.xl,
            overflow: 'hidden',
            transition: 'width 300ms ease',
          }}
        >
          {sandboxUrl ? (
            <iframe
              ref={iframeRef}
              src={sandboxUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              title="Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: colors.bg.secondary,
                color: colors.text.muted,
                fontSize: typography.sizes.sm,
              }}
            >
              Preview will appear when building starts
            </div>
          )}
        </div>

        {/* Verification Window Overlay */}
        <AnimatePresence>
          {verificationWindowVisible && (
            <VerificationWindow
              phase={verificationPhase || 0}
              target={verificationTarget || ''}
              swarmStatus={swarmStatus}
              browserStreamUrl={browserStreamUrl}
              isVerifying={isVerifying}
              onClose={() => setVerificationWindowVisible(false)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Console drawer */}
      <AnimatePresence>
        {showConsole && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 200 }}
            exit={{ height: 0 }}
            style={{
              overflow: 'hidden',
              borderTop: `1px solid ${colors.border.subtle}`,
              background: colors.bg.primary,
            }}
          >
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: `${spacing[2]} ${spacing[3]}`,
                  borderBottom: `1px solid ${colors.border.subtle}`,
                }}
              >
                <span
                  style={{
                    fontSize: typography.sizes.xs,
                    fontWeight: typography.weights.medium,
                    color: colors.text.secondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Console
                </span>
                <button
                  onClick={() => setConsoleLogs([])}
                  style={{
                    fontSize: typography.sizes.xs,
                    color: colors.text.muted,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              </div>
              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  padding: spacing[3],
                  fontFamily: typography.fonts.mono,
                  fontSize: typography.sizes.xs,
                  color: colors.text.secondary,
                }}
              >
                {consoleLogs.length === 0 ? (
                  <span style={{ color: colors.text.muted }}>No console output</span>
                ) : (
                  consoleLogs.map((log, i) => (
                    <div key={i} style={{ marginBottom: spacing[1] }}>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Verification Window Component
interface VerificationWindowProps {
  phase: number;
  target: string;
  swarmStatus: SwarmAgentStatus[];
  browserStreamUrl?: string;
  isVerifying: boolean;
  onClose: () => void;
}

function VerificationWindow({
  phase,
  target,
  swarmStatus,
  browserStreamUrl,
  isVerifying,
  onClose,
}: VerificationWindowProps) {
  const allPassed = swarmStatus.every((s) => s.status === 'passed');
  const hasFailed = swarmStatus.some((s) => s.status === 'failed');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      style={{
        position: 'absolute',
        bottom: spacing[4],
        right: spacing[4],
        width: '340px',
        background: colors.bg.panel,
        backdropFilter: 'blur(12px)',
        borderRadius: radius.xl,
        border: `1px solid ${isVerifying ? colors.accent[600] : allPassed ? colors.success.main : hasFailed ? colors.error.main : colors.border.visible}`,
        boxShadow: shadows.xl,
        overflow: 'hidden',
        zIndex: 50,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${spacing[3]} ${spacing[4]}`,
          borderBottom: `1px solid ${colors.border.subtle}`,
          background: isVerifying
            ? `linear-gradient(135deg, ${colors.accent[600]}15 0%, transparent 100%)`
            : allPassed
            ? `linear-gradient(135deg, ${colors.success.main}15 0%, transparent 100%)`
            : hasFailed
            ? `linear-gradient(135deg, ${colors.error.main}15 0%, transparent 100%)`
            : 'transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          {isVerifying ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              style={{ color: colors.accent[500] }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            </motion.div>
          ) : allPassed ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.success.main} strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : hasFailed ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.error.main} strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
          ) : null}
          <span
            style={{
              fontSize: typography.sizes.sm,
              fontWeight: typography.weights.semibold,
              color: colors.text.primary,
            }}
          >
            {isVerifying
              ? `Phase ${phase}: Verifying...`
              : allPassed
              ? 'Verification Passed'
              : hasFailed
              ? 'Issues Found'
              : 'Verification Complete'}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: colors.text.muted,
            borderRadius: radius.sm,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Browser stream preview (if available) */}
      {browserStreamUrl && (
        <div
          style={{
            width: '100%',
            height: '180px',
            background: colors.bg.primary,
            borderBottom: `1px solid ${colors.border.subtle}`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <img
            src={browserStreamUrl}
            alt="Agent browser"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
          {/* Action indicator overlay */}
          {target && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: `${spacing[2]} ${spacing[3]}`,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                color: colors.text.primary,
                fontSize: typography.sizes.xs,
                fontFamily: typography.fonts.mono,
              }}
            >
              {target}
            </div>
          )}
        </div>
      )}

      {/* Swarm status grid */}
      <div
        style={{
          padding: spacing[3],
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: spacing[2],
        }}
      >
        {swarmStatus.map((agent) => (
          <div
            key={agent.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing[2],
              padding: `${spacing[2]} ${spacing[2.5]}`,
              background: `${statusColors[agent.status]}08`,
              borderRadius: radius.md,
              border: `1px solid ${statusColors[agent.status]}20`,
            }}
          >
            <span style={{ color: statusColors[agent.status] }}>{statusIcons[agent.status]}</span>
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
              {agent.score !== undefined && (
                <div
                  style={{
                    fontSize: '10px',
                    color: statusColors[agent.status],
                  }}
                >
                  {agent.score}/100
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Success/Merge notification */}
      {allPassed && !isVerifying && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: spacing[3],
            borderTop: `1px solid ${colors.border.subtle}`,
            display: 'flex',
            alignItems: 'center',
            gap: spacing[2],
            background: `${colors.success.main}08`,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.success.main} strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <path d="M22 4L12 14.01l-3-3" />
          </svg>
          <span
            style={{
              fontSize: typography.sizes.sm,
              color: colors.success.text,
            }}
          >
            Auto-merging to main sandbox...
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

export default PreviewPanelV2;
