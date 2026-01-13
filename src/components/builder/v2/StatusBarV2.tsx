/**
 * StatusBarV2 - Bottom status bar for Builder V2
 *
 * Shows:
 * - Current build phase (1/6)
 * - Selected model badge
 * - Token usage (estimated/actual)
 * - Cost estimate (real-time)
 * - Build mode indicator
 *
 * Integrates with:
 * - useAgentStore for phase/status
 * - useCostStore for token/cost tracking
 */

import { motion } from 'framer-motion';
import { colors, typography, spacing, buildPhaseColors, buildModeConfig } from './design-tokens';
import { useCostStore } from '@/store/useCostStore';

export type BuildPhase = 
  | 'intent_lock' 
  | 'initialization' 
  | 'parallel_build' 
  | 'integration' 
  | 'testing' 
  | 'intent_satisfaction' 
  | 'demo';

export type BuildMode = 'lightning' | 'standard' | 'tournament' | 'production';

interface StatusBarV2Props {
  currentPhase?: BuildPhase;
  phaseProgress?: number;
  model?: string;
  buildMode?: BuildMode;
  isBuilding?: boolean;
  estimatedTokens?: number;
  actualTokens?: number;
  estimatedCost?: number;
  actualCost?: number;
  onPhaseClick?: () => void;
}

const phaseLabels: Record<BuildPhase, { label: string; number: number }> = {
  intent_lock: { label: 'Intent Lock', number: 1 },
  initialization: { label: 'Initialization', number: 2 },
  parallel_build: { label: 'Building', number: 3 },
  integration: { label: 'Integration', number: 4 },
  testing: { label: 'Testing', number: 5 },
  intent_satisfaction: { label: 'Verification', number: 6 },
  demo: { label: 'Demo Ready', number: 6 },
};

const modelLabels: Record<string, string> = {
  'claude-sonnet-4-20250514': 'Sonnet 4',
  'claude-opus-4-20250514': 'Opus 4',
  'claude-3-5-haiku-20241022': 'Haiku 3.5',
  'gpt-4.1-2025-04-14': 'GPT-4.1',
  'gpt-5': 'GPT-5',
  'kriptoenite': 'KTN',
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatCost(cost: number): string {
  if (cost < 0.01) return '<$0.01';
  return `$${cost.toFixed(2)}`;
}

export function StatusBarV2({
  currentPhase,
  phaseProgress = 0,
  model = 'claude-sonnet-4-20250514',
  buildMode = 'standard',
  isBuilding = false,
  estimatedTokens = 0,
  actualTokens = 0,
  estimatedCost,
  actualCost,
}: StatusBarV2Props) {
  const { currentEstimate, activeSessionCost } = useCostStore();

  // Use store values if not provided via props
  const displayEstimatedCost = estimatedCost ?? (currentEstimate?.totalCredits || 0);
  const displayActualCost = actualCost ?? activeSessionCost;
  // Estimate tokens from cost breakdown
  const breakdownTotal = currentEstimate?.breakdown
    ? Object.values(currentEstimate.breakdown).reduce((sum, v) => sum + v, 0)
    : 0;
  const displayEstimatedTokens = estimatedTokens || breakdownTotal * 100;
  const displayActualTokens = actualTokens;

  const modeConfig = buildModeConfig[buildMode];
  const phaseInfo = currentPhase ? phaseLabels[currentPhase] : null;
  const phaseColor = currentPhase ? buildPhaseColors[currentPhase] : colors.text.muted;

  return (
    <div
      style={{
        height: '36px',
        background: colors.bg.primary,
        borderTop: `1px solid ${colors.border.subtle}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${spacing[4]}`,
        fontFamily: typography.fonts.mono,
        fontSize: typography.sizes.xs,
        color: colors.text.secondary,
        flexShrink: 0,
      }}
    >
      {/* Left section: Phase indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[4] }}>
        {/* Build phase */}
        {isBuilding && phaseInfo ? (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing[2],
              padding: `${spacing[1]} ${spacing[3]}`,
              background: `${phaseColor}15`,
              borderRadius: '6px',
              border: `1px solid ${phaseColor}40`,
            }}
          >
            {/* Pulsing dot */}
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [1, 0.7, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: phaseColor,
              }}
            />
            <span style={{ color: phaseColor, fontWeight: typography.weights.medium }}>
              Phase {phaseInfo.number}/6
            </span>
            <span style={{ color: colors.text.muted }}>:</span>
            <span style={{ color: colors.text.primary }}>
              {phaseInfo.label}
            </span>
            {phaseProgress > 0 && phaseProgress < 100 && (
              <span style={{ color: colors.text.muted }}>
                ({Math.round(phaseProgress)}%)
              </span>
            )}
          </motion.div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: colors.text.muted,
              }}
            />
            <span>Ready</span>
          </div>
        )}

        {/* Separator */}
        <div
          style={{
            width: '1px',
            height: '16px',
            background: colors.border.muted,
          }}
        />

        {/* Build mode badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[1.5],
            padding: `${spacing[1]} ${spacing[2]}`,
            background: `${modeConfig.color}15`,
            borderRadius: '4px',
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            style={{ color: modeConfig.color }}
          >
            <path
              d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ color: modeConfig.color, fontWeight: typography.weights.medium }}>
            {modeConfig.label}
          </span>
        </div>
      </div>

      {/* Center section: Model */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3] }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[1.5],
            padding: `${spacing[1]} ${spacing[2.5]}`,
            background: colors.bg.tertiary,
            borderRadius: '4px',
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            style={{ color: colors.accent[500] }}
          >
            <circle cx="12" cy="12" r="3" fill="currentColor" />
            <path
              d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07l-2.83 2.83m-8.48 8.48l-2.83 2.83m14.14 0l-2.83-2.83M6.34 6.34L3.51 3.51"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span style={{ color: colors.text.primary, fontWeight: typography.weights.medium }}>
            {modelLabels[model] || model}
          </span>
        </div>
      </div>

      {/* Right section: Tokens and cost */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[4] }}>
        {/* Token usage */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            style={{ color: colors.text.muted }}
          >
            <path
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            {displayActualTokens > 0 ? (
              <>
                <span style={{ color: colors.text.primary }}>
                  {formatNumber(displayActualTokens)}
                </span>
                {displayEstimatedTokens > 0 && (
                  <span style={{ color: colors.text.muted }}>
                    /{formatNumber(displayEstimatedTokens)}
                  </span>
                )}
              </>
            ) : displayEstimatedTokens > 0 ? (
              <span style={{ color: colors.text.muted }}>
                ~{formatNumber(displayEstimatedTokens)}
              </span>
            ) : (
              <span style={{ color: colors.text.muted }}>--</span>
            )}
          </span>
          <span style={{ color: colors.text.muted }}>tokens</span>
        </div>

        {/* Separator */}
        <div
          style={{
            width: '1px',
            height: '16px',
            background: colors.border.muted,
          }}
        />

        {/* Cost */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[2],
            padding: `${spacing[1]} ${spacing[2.5]}`,
            background: isBuilding ? `${colors.accent[600]}15` : colors.bg.tertiary,
            borderRadius: '4px',
            border: isBuilding ? `1px solid ${colors.accent[600]}30` : 'none',
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            style={{ color: isBuilding ? colors.accent[500] : colors.text.muted }}
          >
            <path
              d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {displayActualCost > 0 ? (
            <span style={{ color: colors.text.primary, fontWeight: typography.weights.medium }}>
              {formatCost(displayActualCost)}
            </span>
          ) : displayEstimatedCost > 0 ? (
            <span style={{ color: colors.text.muted }}>
              ~{formatCost(displayEstimatedCost)}
            </span>
          ) : (
            <span style={{ color: colors.text.muted }}>$0.00</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default StatusBarV2;
