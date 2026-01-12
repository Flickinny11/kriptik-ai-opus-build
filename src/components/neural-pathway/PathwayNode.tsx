/**
 * Pathway Node Component
 *
 * Individual node in the neural pathway visualization.
 * Animates based on status and supports expansion.
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { PathwayNode as PathwayNodeType } from './types';
import {
  Sparkles3D,
  Lock3D,
  Layers3D,
  Cpu3D,
  Code3D,
  Shield3D,
  Hammer3D,
  Rocket3D,
  CheckCircle3D,
} from '@/components/icons';

interface PathwayNodeProps {
  node: PathwayNodeType;
  compact?: boolean;
  showLabel?: boolean;
  isHovered?: boolean;
  isExpanded?: boolean;
  onClick?: () => void;
  onHover?: (hovered: boolean) => void;
  statusColors: { bg: string; border: string; glow: string };
}

// Icon mapping
const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  sparkles: Sparkles3D,
  lock: Lock3D,
  layers: Layers3D,
  cpu: Cpu3D,
  code: Code3D,
  shield: Shield3D,
  hammer: Hammer3D,
  rocket: Rocket3D,
  check: CheckCircle3D,
};

// Size configurations
const SIZE_CONFIG = {
  small: { container: 'w-8 h-8', icon: 'w-4 h-4', ring: 'w-10 h-10' },
  medium: { container: 'w-12 h-12', icon: 'w-6 h-6', ring: 'w-14 h-14' },
  large: { container: 'w-16 h-16', icon: 'w-8 h-8', ring: 'w-20 h-20' },
};

export const PathwayNode = memo(function PathwayNode({
  node,
  compact,
  showLabel,
  isHovered,
  isExpanded,
  onClick,
  onHover,
  statusColors,
}: PathwayNodeProps) {
  const Icon = node.icon ? ICON_MAP[node.icon] : Sparkles3D;
  const size = compact ? 'small' : (node.size || 'medium');
  const sizeConfig = SIZE_CONFIG[size];

  const isActive = node.status === 'active' || node.status === 'streaming';
  const isPending = node.status === 'pending';
  const isComplete = node.status === 'complete';
  const hasProgress = node.progress !== undefined && node.progress < 100;

  return (
    <motion.div
      className="absolute"
      style={{
        left: `${node.position.x}%`,
        top: `${node.position.y}%`,
        transform: 'translate(-50%, -50%)',
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
    >
      {/* Outer pulsing ring for active nodes - warm amber glow */}
      {(isActive || isPending) && (
        <motion.div
          className={cn(
            'absolute rounded-full',
            sizeConfig.ring
          )}
          style={{ 
            left: '50%', 
            top: '50%', 
            transform: 'translate(-50%, -50%)',
            border: isActive ? '2px solid rgba(245,158,11,0.5)' : '2px solid rgba(251,191,36,0.3)',
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Secondary pulse ring - copper accent */}
      {isActive && (
        <motion.div
          className={cn('absolute rounded-full', sizeConfig.ring)}
          style={{ 
            left: '50%', 
            top: '50%', 
            transform: 'translate(-50%, -50%)',
            border: '1px solid rgba(194,65,12,0.3)',
          }}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.3, 0, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.5,
          }}
        />
      )}

      {/* Main node button */}
      <motion.button
        className={cn(
          'relative rounded-full border-2 flex items-center justify-center',
          'transition-all duration-200 cursor-pointer',
          sizeConfig.container,
          statusColors.bg,
          statusColors.border,
          statusColors.glow,
          isHovered && 'ring-2 ring-white/20',
          isExpanded && 'ring-2 ring-blue-500/50',
          node.expandable && 'hover:ring-2 hover:ring-white/10'
        )}
        onClick={onClick}
        onMouseEnter={() => onHover?.(true)}
        onMouseLeave={() => onHover?.(false)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Progress ring */}
        {hasProgress && (
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-gray-700"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="url(#progress-gradient)"
              strokeWidth="4"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: (node.progress || 0) / 100 }}
              transition={{ duration: 0.5 }}
              style={{
                strokeDasharray: '283',
                strokeDashoffset: '0',
              }}
            />
            <defs>
              <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
          </svg>
        )}

        {/* Icon with animation - warm copper color for active */}
        <motion.div
          className={sizeConfig.icon}
          style={{ color: isActive ? '#c2410c' : isComplete ? '#059669' : '#78716c' }}
          animate={isActive ? {
            scale: [1, 1.1, 1],
          } : {}}
          transition={{
            duration: 1,
            repeat: isActive ? Infinity : 0,
            ease: 'easeInOut',
          }}
        >
          <Icon className="w-full h-full" />
        </motion.div>

        {/* Completion checkmark overlay */}
        {isComplete && (
          <motion.div
            className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
          >
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
        )}

        {/* Expand indicator - amber accent */}
        {node.expandable && (
          <motion.div
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.9)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0.5 }}
          >
            <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.div>
        )}
      </motion.button>

      {/* Label - glass pill style */}
      {showLabel && (
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <span 
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{
              color: isActive ? '#92400e' : isComplete ? '#047857' : '#78716c',
              background: isActive ? 'rgba(251,191,36,0.15)' : isComplete ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.6)',
              backdropFilter: 'blur(4px)',
              border: '1px solid ' + (isActive ? 'rgba(251,191,36,0.3)' : isComplete ? 'rgba(16,185,129,0.2)' : 'rgba(0,0,0,0.05)'),
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              fontFamily: 'Syne, sans-serif',
            }}
          >
            {node.shortLabel || node.label}
          </span>
        </motion.div>
      )}

      {/* Status tooltip on hover - liquid glass style */}
      {isHovered && node.summary && (
        <motion.div
          className="absolute z-50 left-1/2 -translate-x-1/2 -top-2 -translate-y-full"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 5 }}
        >
          <div 
            className="rounded-xl px-3 py-2 max-w-xs"
            style={{
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.8)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.03)',
            }}
          >
            <p className="text-xs line-clamp-2" style={{ color: '#44403c' }}>{node.summary}</p>
            {node.duration && (
              <p className="text-xs mt-1" style={{ color: '#a8a29e' }}>
                {(node.duration / 1000).toFixed(1)}s
              </p>
            )}
          </div>
          <div 
            className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 transform rotate-45 -mt-1"
            style={{
              background: 'rgba(255,255,255,0.95)',
              borderRight: '1px solid rgba(255,255,255,0.8)',
              borderBottom: '1px solid rgba(255,255,255,0.8)',
            }}
          />
        </motion.div>
      )}
    </motion.div>
  );
});
