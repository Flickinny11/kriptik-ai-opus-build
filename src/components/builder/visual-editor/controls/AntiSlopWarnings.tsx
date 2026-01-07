/**
 * Anti-Slop Warnings - Display design quality warnings
 *
 * Shows warnings for detected anti-slop patterns including:
 * - Purple-to-pink gradients (classic AI slop)
 * - Generic placeholder text
 * - Flat gray designs without depth
 * - Missing shadows/blur effects
 * - Typography issues
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AntiSlopWarning } from '../../../../store/useVisualEditorStore';

interface AntiSlopWarningsProps {
  warnings: AntiSlopWarning[];
}

// Severity icons
const CriticalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const WarningIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
      transition: 'transform 0.2s ease',
    }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const FixIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

function getSeverityIcon(severity: AntiSlopWarning['severity']) {
  switch (severity) {
    case 'critical':
    case 'error':
      return <CriticalIcon />;
    case 'warning':
      return <WarningIcon />;
    case 'info':
    default:
      return <InfoIcon />;
  }
}

function getSeverityColor(severity: AntiSlopWarning['severity']): string {
  switch (severity) {
    case 'critical':
    case 'error':
      return 'var(--vpp-danger, #ef4444)';
    case 'warning':
      return 'var(--vpp-warning, #f59e0b)';
    case 'info':
    default:
      return 'var(--vpp-info, #3b82f6)';
  }
}

interface WarningItemProps {
  warning: AntiSlopWarning;
  onApplySuggestion?: (suggestion: string) => void;
}

function WarningItem({ warning, onApplySuggestion }: WarningItemProps) {
  const [expanded, setExpanded] = useState(false);

  const handleApplySuggestion = useCallback(() => {
    if (warning.suggestion && onApplySuggestion) {
      onApplySuggestion(warning.suggestion);
    }
  }, [warning.suggestion, onApplySuggestion]);

  return (
    <motion.div
      className={`vpp-warning vpp-warning--${warning.severity}`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      style={{
        borderLeftColor: getSeverityColor(warning.severity),
      }}
    >
      <button
        className="vpp-warning__header"
        onClick={() => setExpanded(!expanded)}
      >
        <span
          className="vpp-warning__icon"
          style={{ color: getSeverityColor(warning.severity) }}
        >
          {getSeverityIcon(warning.severity)}
        </span>
        <span className="vpp-warning__message">{warning.message}</span>
        <span className="vpp-warning__chevron">
          <ChevronIcon expanded={expanded} />
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="vpp-warning__details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Pattern info */}
            <div className="vpp-warning__pattern">
              <span className="vpp-warning__pattern-label">Pattern:</span>
              <code className="vpp-warning__pattern-value">{warning.pattern}</code>
            </div>

            {/* Suggestion */}
            {warning.suggestion && (
              <div className="vpp-warning__suggestion">
                <span className="vpp-warning__suggestion-label">Suggestion:</span>
                <span className="vpp-warning__suggestion-text">{warning.suggestion}</span>
                {onApplySuggestion && (
                  <motion.button
                    className="vpp-warning__apply-btn"
                    onClick={handleApplySuggestion}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FixIcon />
                    <span>Apply Fix</span>
                  </motion.button>
                )}
              </div>
            )}

            {/* Score impact */}
            <div className="vpp-warning__impact">
              <span className="vpp-warning__impact-label">Score Impact:</span>
              <span
                className="vpp-warning__impact-value"
                style={{ color: getSeverityColor(warning.severity) }}
              >
                {warning.severity === 'critical' ? '-15' : warning.severity === 'warning' ? '-8' : '-3'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function AntiSlopWarnings({ warnings }: AntiSlopWarningsProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Group warnings by severity
  const criticalCount = warnings.filter((w) => w.severity === 'critical').length;
  const warningCount = warnings.filter((w) => w.severity === 'warning').length;
  const infoCount = warnings.filter((w) => w.severity === 'info').length;

  // Calculate score impact
  const scoreImpact = criticalCount * -15 + warningCount * -8 + infoCount * -3;

  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="vpp-warnings">
      {/* Summary header */}
      <button
        className="vpp-warnings__header"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="vpp-warnings__summary">
          <span className="vpp-warnings__title">Design Quality</span>
          <div className="vpp-warnings__counts">
            {criticalCount > 0 && (
              <span className="vpp-warnings__count vpp-warnings__count--critical">
                <CriticalIcon /> {criticalCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="vpp-warnings__count vpp-warnings__count--warning">
                <WarningIcon /> {warningCount}
              </span>
            )}
            {infoCount > 0 && (
              <span className="vpp-warnings__count vpp-warnings__count--info">
                <InfoIcon /> {infoCount}
              </span>
            )}
          </div>
        </div>
        <div className="vpp-warnings__score-impact">
          <span className={scoreImpact < -20 ? 'critical' : scoreImpact < -10 ? 'warning' : 'info'}>
            {scoreImpact}
          </span>
        </div>
        <ChevronIcon expanded={!collapsed} />
      </button>

      {/* Warning list */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            className="vpp-warnings__list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Critical warnings first */}
            {warnings
              .sort((a, b) => {
                const order: Record<AntiSlopWarning['severity'], number> = { critical: 0, error: 0, warning: 1, info: 2 };
                return order[a.severity] - order[b.severity];
              })
              .map((warning) => (
                <WarningItem
                  key={warning.id}
                  warning={warning}
                  onApplySuggestion={(suggestion) => {
                    // Apply the suggestion - this would trigger the AI to apply the fix
                    console.log('[AntiSlop] Applying suggestion:', suggestion);
                  }}
                />
              ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer with tips */}
      {!collapsed && warnings.length > 0 && (
        <div className="vpp-warnings__footer">
          <span className="vpp-warnings__tip">
            Fix critical issues to improve design quality score
          </span>
        </div>
      )}
    </div>
  );
}

export default AntiSlopWarnings;
