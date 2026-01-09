/**
 * HyperThinkingProgress - Shows reasoning progress indicator
 *
 * Displays the current state of hyper-thinking operations:
 * - Active thinking indicator with animated brain icon
 * - Steps completed counter
 * - Current strategy being used
 * - Token usage and estimated time remaining
 *
 * Uses liquid glass styling consistent with KripTik dashboard.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain3D,
  Sparkles3D,
  Clock3D,
  Zap3D,
  CheckCircle3D,
  Loader3D,
} from '@/components/icons';

// ============================================================================
// Types
// ============================================================================

export interface ThinkingStep {
  id: string;
  thought: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  confidence?: number;
  tokensUsed?: number;
  timestamp?: string;
}

export interface HyperThinkingProgressProps {
  isActive: boolean;
  strategy: 'chain_of_thought' | 'tree_of_thought' | 'multi_agent' | 'hybrid';
  steps: ThinkingStep[];
  currentStep?: string;
  totalTokensUsed: number;
  estimatedTokensRemaining?: number;
  confidence?: number;
  onCancel?: () => void;
}

// ============================================================================
// Strategy Display Config
// ============================================================================

const STRATEGY_CONFIG = {
  chain_of_thought: {
    label: 'Chain of Thought',
    icon: '🔗',
    color: 'from-blue-500 to-cyan-500',
    bgGlow: 'rgba(6, 182, 212, 0.15)',
  },
  tree_of_thought: {
    label: 'Tree of Thought',
    icon: '🌳',
    color: 'from-green-500 to-emerald-500',
    bgGlow: 'rgba(16, 185, 129, 0.15)',
  },
  multi_agent: {
    label: 'Multi-Agent Swarm',
    icon: '🐝',
    color: 'from-purple-500 to-pink-500',
    bgGlow: 'rgba(168, 85, 247, 0.15)',
  },
  hybrid: {
    label: 'Hybrid Strategy',
    icon: '⚡',
    color: 'from-amber-500 to-orange-500',
    bgGlow: 'rgba(245, 158, 11, 0.15)',
  },
};

// ============================================================================
// Sub-Components
// ============================================================================

function ThinkingBrain({ isActive }: { isActive: boolean }) {
  return (
    <div className="relative">
      <motion.div
        animate={isActive ? {
          scale: [1, 1.1, 1],
          opacity: [0.8, 1, 0.8],
        } : {}}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="relative z-10"
      >
        <Brain3D className="w-8 h-8" />
      </motion.div>
      {isActive && (
        <>
          <motion.div
            className="absolute inset-0 rounded-full bg-lime-500/20"
            animate={{
              scale: [1, 1.8, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeOut',
            }}
          />
          <motion.div
            className="absolute -top-1 -right-1"
            animate={{
              rotate: [0, 360],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <Sparkles3D className="w-3 h-3" />
          </motion.div>
        </>
      )}
    </div>
  );
}

function StepIndicator({ step, index }: { step: ThinkingStep; index: number }) {
  const statusColors = {
    pending: 'bg-white/20 border-white/10',
    active: 'bg-lime-500/20 border-lime-500/50 animate-pulse',
    completed: 'bg-emerald-500/30 border-emerald-500/50',
    failed: 'bg-red-500/20 border-red-500/50',
  };

  const StatusIcon = () => {
    switch (step.status) {
      case 'active':
        return <Loader3D className="w-3 h-3" />;
      case 'completed':
        return <CheckCircle3D className="w-3 h-3" />;
      case 'failed':
        return <span className="text-red-400 text-xs">✕</span>;
      default:
        return <span className="text-white/40 text-xs">{index + 1}</span>;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg border
        ${statusColors[step.status]}
        transition-all duration-300
      `}
    >
      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        <StatusIcon />
      </div>
      <p className="text-xs text-white/80 line-clamp-1 flex-1">
        {step.thought}
      </p>
      {step.confidence !== undefined && step.status === 'completed' && (
        <span className="text-[10px] text-white/50 flex-shrink-0">
          {Math.round(step.confidence * 100)}%
        </span>
      )}
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function HyperThinkingProgress({
  isActive,
  strategy,
  steps,
  currentStep: _currentStep, // Prefixed with underscore to indicate intentionally unused
  totalTokensUsed,
  estimatedTokensRemaining,
  confidence,
  onCancel,
}: HyperThinkingProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const config = STRATEGY_CONFIG[strategy];

  // Note: currentStep prop available as _currentStep for future use
  void _currentStep;

  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const activeSteps = steps.filter(s => s.status === 'active').length;

  // Timer for elapsed time
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive]);

  // Reset timer when becoming active
  useEffect(() => {
    if (isActive) {
      setElapsedTime(0);
    }
  }, [isActive]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, rgba(20,20,25,0.98) 0%, rgba(12,12,16,0.99) 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(40px)',
      }}
    >
      {/* Ambient glow based on strategy */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background: `radial-gradient(ellipse at top right, ${config.bgGlow}, transparent 70%)`,
        }}
      />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <ThinkingBrain isActive={isActive} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">{config.icon}</span>
                <h3 className="text-sm font-medium text-white">
                  {config.label}
                </h3>
              </div>
              <p className="text-xs text-white/50 mt-0.5">
                {isActive ? 'Reasoning in progress...' : 'Completed'}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-white/60">
              <Clock3D className="w-3.5 h-3.5" />
              <span>{formatTime(elapsedTime)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/60">
              <Zap3D className="w-3.5 h-3.5" />
              <span>{formatTokens(totalTokensUsed)} tokens</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-white/50">
              {completedSteps} of {steps.length} steps
              {activeSteps > 0 && ` (${activeSteps} active)`}
            </span>
            {confidence !== undefined && (
              <span className="text-xs text-lime-400/80">
                {Math.round(confidence * 100)}% confidence
              </span>
            )}
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className={`h-full bg-gradient-to-r ${config.color}`}
              initial={{ width: 0 }}
              animate={{
                width: `${steps.length > 0 ? (completedSteps / steps.length) * 100 : 0}%`,
              }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Steps list */}
        <AnimatePresence mode="popLayout">
          <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
            {steps.slice(-5).map((step, index) => (
              <StepIndicator
                key={step.id}
                step={step}
                index={index}
              />
            ))}
          </div>
        </AnimatePresence>

        {/* Footer with cancel */}
        {isActive && onCancel && (
          <div className="mt-4 pt-3 border-t border-white/5">
            <button
              onClick={onCancel}
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              Cancel reasoning
            </button>
          </div>
        )}

        {/* Estimated remaining */}
        {estimatedTokensRemaining !== undefined && estimatedTokensRemaining > 0 && (
          <div className="mt-3 text-center">
            <span className="text-[10px] text-white/30">
              Est. {formatTokens(estimatedTokensRemaining)} tokens remaining
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default HyperThinkingProgress;
