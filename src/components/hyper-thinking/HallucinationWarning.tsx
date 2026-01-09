/**
 * HallucinationWarning - Show hallucination detection warnings
 *
 * Displays real-time warnings when reasoning drift is detected:
 * - Semantic drift indicator
 * - Factual inconsistency alerts
 * - Logical contradiction warnings
 * - Confidence drop notifications
 *
 * Provides actions to address detected issues.
 * Uses liquid glass styling consistent with KripTik dashboard.
 */

import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle3D,
  AlertOctagon3D,
  Activity3D,
  ArrowLeftRight3D,
  Ban3D,
  RotateCcw3D,
  CheckCircle3D,
  X3D,
  TrendingDown3D,
  Pause3D,
  Play3D,
} from '@/components/icons';

// ============================================================================
// Types
// ============================================================================

export type HallucinationIndicator =
  | 'semanticDrift'
  | 'factualInconsistency'
  | 'logicalContradiction'
  | 'confidenceDrop';

export interface HallucinationSignal {
  id: string;
  stepId: string;
  score: number; // 0-1, higher = more likely hallucination
  indicators: HallucinationIndicator[];
  shouldPause: boolean;
  suggestedAction: 'continue' | 'pause' | 'backtrack' | 'verify' | 'regenerate';
  details?: string;
  timestamp: string;
}

export interface HallucinationWarningProps {
  signals: HallucinationSignal[];
  isPaused: boolean;
  onDismiss?: (signalId: string) => void;
  onPause?: () => void;
  onResume?: () => void;
  onBacktrack?: (stepId: string) => void;
  onVerify?: (stepId: string) => void;
  onRegenerate?: (stepId: string) => void;
  className?: string;
}

// ============================================================================
// Indicator Configuration
// ============================================================================

const INDICATOR_CONFIG: Record<HallucinationIndicator, {
  label: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  description: string;
}> = {
  semanticDrift: {
    label: 'Semantic Drift',
    icon: ArrowLeftRight3D,
    color: 'text-yellow-400',
    description: 'Reasoning has drifted from the original problem',
  },
  factualInconsistency: {
    label: 'Factual Issue',
    icon: Ban3D,
    color: 'text-orange-400',
    description: 'Statement may contradict known facts',
  },
  logicalContradiction: {
    label: 'Logic Error',
    icon: AlertOctagon3D,
    color: 'text-red-400',
    description: 'Logical inconsistency detected',
  },
  confidenceDrop: {
    label: 'Confidence Drop',
    icon: TrendingDown3D,
    color: 'text-purple-400',
    description: 'Confidence in reasoning has decreased',
  },
};

// ============================================================================
// Sub-Components
// ============================================================================

function SeverityMeter({ score }: { score: number }) {
  const getSeverityColor = () => {
    if (score >= 0.8) return 'from-red-500 to-red-600';
    if (score >= 0.6) return 'from-orange-500 to-red-500';
    if (score >= 0.4) return 'from-yellow-500 to-orange-500';
    return 'from-green-500 to-yellow-500';
  };

  const getSeverityLabel = () => {
    if (score >= 0.8) return 'Critical';
    if (score >= 0.6) return 'High';
    if (score >= 0.4) return 'Medium';
    return 'Low';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className={`h-full bg-gradient-to-r ${getSeverityColor()}`}
          initial={{ width: 0 }}
          animate={{ width: `${score * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <span className={`text-[10px] font-medium ${
        score >= 0.6 ? 'text-red-400' : score >= 0.4 ? 'text-orange-400' : 'text-yellow-400'
      }`}>
        {getSeverityLabel()}
      </span>
    </div>
  );
}

function IndicatorBadge({ indicator }: { indicator: HallucinationIndicator }) {
  const config = INDICATOR_CONFIG[indicator];
  const Icon = config.icon;

  return (
    <span className={`
      inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]
      bg-white/5 border border-white/10 ${config.color}
    `}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function ActionButton({
  onClick,
  icon: Icon,
  label,
  variant = 'default',
}: {
  onClick: () => void;
  icon: React.FC<{ className?: string }>;
  label: string;
  variant?: 'default' | 'danger' | 'success';
}) {
  const variants = {
    default: 'bg-white/10 hover:bg-white/20 text-white/70 hover:text-white',
    danger: 'bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300',
    success: 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 hover:text-emerald-300',
  };

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs
        transition-colors duration-200 ${variants[variant]}
      `}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function SignalCard({
  signal,
  onDismiss,
  onBacktrack,
  onVerify,
  onRegenerate,
}: {
  signal: HallucinationSignal;
  onDismiss?: () => void;
  onBacktrack?: () => void;
  onVerify?: () => void;
  onRegenerate?: () => void;
}) {
  const isCritical = signal.score >= 0.7;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      className={`
        relative p-4 rounded-xl border
        ${isCritical
          ? 'bg-red-500/10 border-red-500/30'
          : 'bg-yellow-500/10 border-yellow-500/30'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`
            p-1.5 rounded-lg
            ${isCritical ? 'bg-red-500/20' : 'bg-yellow-500/20'}
          `}>
            <AlertTriangle3D className="w-4 h-4" />
          </div>
          <div>
            <span className={`text-sm font-medium ${isCritical ? 'text-red-400' : 'text-yellow-400'}`}>
              Potential Hallucination
            </span>
            <p className="text-[10px] text-white/40 mt-0.5">
              Step: {signal.stepId.substring(0, 8)}...
            </p>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
          >
            <X3D className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Severity */}
      <div className="mb-3">
        <span className="text-[10px] text-white/40 block mb-1">Confidence Score</span>
        <SeverityMeter score={signal.score} />
      </div>

      {/* Indicators */}
      <div className="mb-3">
        <span className="text-[10px] text-white/40 block mb-1.5">Detected Issues</span>
        <div className="flex flex-wrap gap-1.5">
          {signal.indicators.map(indicator => (
            <IndicatorBadge key={indicator} indicator={indicator} />
          ))}
        </div>
      </div>

      {/* Details */}
      {signal.details && (
        <p className="text-[11px] text-white/60 mb-3 p-2 rounded-lg bg-white/5">
          {signal.details}
        </p>
      )}

      {/* Suggested action */}
      <div className="mb-3">
        <span className="text-[10px] text-white/40 block mb-1">Suggested Action</span>
        <span className={`
          inline-flex items-center gap-1 px-2 py-1 rounded text-xs
          ${signal.suggestedAction === 'backtrack' || signal.suggestedAction === 'regenerate'
            ? 'bg-red-500/20 text-red-400'
            : signal.suggestedAction === 'verify'
              ? 'bg-yellow-500/20 text-yellow-400'
              : 'bg-white/10 text-white/70'
          }
        `}>
          {signal.suggestedAction === 'backtrack' && 'Backtrack to previous step'}
          {signal.suggestedAction === 'regenerate' && 'Regenerate this step'}
          {signal.suggestedAction === 'verify' && 'Verify reasoning'}
          {signal.suggestedAction === 'pause' && 'Pause for review'}
          {signal.suggestedAction === 'continue' && 'Continue with caution'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-white/5">
        {onBacktrack && (
          <ActionButton
            onClick={onBacktrack}
            icon={RotateCcw3D}
            label="Backtrack"
            variant="danger"
          />
        )}
        {onVerify && (
          <ActionButton
            onClick={onVerify}
            icon={Activity3D}
            label="Verify"
          />
        )}
        {onRegenerate && (
          <ActionButton
            onClick={onRegenerate}
            icon={RotateCcw3D}
            label="Regenerate"
          />
        )}
      </div>

      {/* Critical pulse animation */}
      {isCritical && (
        <motion.div
          className="absolute inset-0 rounded-xl border-2 border-red-500/50 pointer-events-none"
          animate={{
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function HallucinationWarning({
  signals,
  isPaused,
  onDismiss,
  onPause,
  onResume,
  onBacktrack,
  onVerify,
  onRegenerate,
  className = '',
}: HallucinationWarningProps) {
  const criticalSignals = signals.filter(s => s.score >= 0.7);
  const warningSignals = signals.filter(s => s.score >= 0.4 && s.score < 0.7);

  const handleDismiss = useCallback((signalId: string) => {
    onDismiss?.(signalId);
  }, [onDismiss]);

  if (signals.length === 0) {
    return (
      <div
        className={`p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 ${className}`}
      >
        <div className="flex items-center gap-2">
          <CheckCircle3D className="w-5 h-5" />
          <span className="text-sm text-emerald-400">Reasoning quality is healthy</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative ${className}`}
      style={{
        background: 'linear-gradient(145deg, rgba(20,20,25,0.98) 0%, rgba(12,12,16,0.99) 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(40px)',
      }}
    >
      {/* Warning glow */}
      {criticalSignals.length > 0 && (
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at top, rgba(239, 68, 68, 0.3), transparent 70%)',
          }}
        />
      )}

      {/* Header */}
      <div className="relative px-5 py-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`
              p-2 rounded-lg
              ${criticalSignals.length > 0 ? 'bg-red-500/20' : 'bg-yellow-500/20'}
            `}>
              <Activity3D className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">
                Hallucination Detection
              </h3>
              <div className="flex items-center gap-3 mt-0.5 text-[11px]">
                {criticalSignals.length > 0 && (
                  <span className="text-red-400">{criticalSignals.length} critical</span>
                )}
                {warningSignals.length > 0 && (
                  <span className="text-yellow-400">{warningSignals.length} warning</span>
                )}
              </div>
            </div>
          </div>

          {/* Pause/Resume control */}
          <div className="flex items-center gap-2">
            {isPaused ? (
              <button
                onClick={onResume}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors text-xs"
              >
                <Play3D className="w-3.5 h-3.5" />
                Resume
              </button>
            ) : (
              <button
                onClick={onPause}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors text-xs"
              >
                <Pause3D className="w-3.5 h-3.5" />
                Pause
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Signals list */}
      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {signals.map(signal => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onDismiss={onDismiss ? () => handleDismiss(signal.id) : undefined}
              onBacktrack={onBacktrack ? () => onBacktrack(signal.stepId) : undefined}
              onVerify={onVerify ? () => onVerify(signal.stepId) : undefined}
              onRegenerate={onRegenerate ? () => onRegenerate(signal.stepId) : undefined}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Status bar */}
      {isPaused && (
        <div className="px-5 py-3 border-t border-white/5 bg-yellow-500/10">
          <div className="flex items-center gap-2 text-xs text-yellow-400">
            <Pause3D className="w-3.5 h-3.5" />
            Reasoning paused for review
          </div>
        </div>
      )}
    </div>
  );
}

export default HallucinationWarning;
