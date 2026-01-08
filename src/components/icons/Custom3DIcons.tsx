/**
 * Custom 3D Icons Library for KripTik AI
 *
 * Premium 3D icons with depth, shadows, and animations.
 * NO Lucide icons in production - these are the replacements.
 *
 * Design Principles:
 * - Each icon has base shadow layer for depth
 * - Gradient fills for 3D effect
 * - Highlight lines for reflection
 * - Drop shadow filter
 * - Hover animations (scale, glow)
 */

import React from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface Icon3DProps {
  size?: number;
  className?: string;
  color?: string;
  animated?: boolean;
  onClick?: () => void;
}

const iconBase = (animated: boolean = true) => cn(
  'transition-all duration-300',
  animated && 'hover:scale-110 hover:drop-shadow-lg'
);

// Unique gradient ID generator
let gradientCounter = 0;
const getGradientId = (prefix: string) => `${prefix}-${++gradientCounter}`;

// ============================================================================
// COMMON UI ICONS
// ============================================================================

export const CheckIcon3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#22c55e', animated = true, onClick
}) => {
  const gradId = getGradientId('check');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      className={cn(iconBase(animated), className)}
      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
      onClick={onClick}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
        fill="rgba(0,0,0,0.2)" transform="translate(1, 2)" />
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
        fill={`url(#${gradId})`} />
    </svg>
  );
};

export const XIcon3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => {
  const gradId = getGradientId('x');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      className={cn(iconBase(animated), 'cursor-pointer', className)}
      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
      onClick={onClick}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
        fill="rgba(0,0,0,0.2)" transform="translate(1, 1)" />
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
        fill={`url(#${gradId})`} />
    </svg>
  );
};

export const ChevronDownIcon3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"
      fill="rgba(0,0,0,0.15)" transform="translate(0, 1)" />
    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"
      fill={color} />
  </svg>
);

export const ChevronUpIcon3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z"
      fill="rgba(0,0,0,0.15)" transform="translate(0, 1)" />
    <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z"
      fill={color} />
  </svg>
);

export const ChevronRightIcon3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"
      fill="rgba(0,0,0,0.15)" transform="translate(1, 0)" />
    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"
      fill={color} />
  </svg>
);

export const ChevronLeftIcon3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"
      fill="rgba(0,0,0,0.15)" transform="translate(-1, 0)" />
    <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"
      fill={color} />
  </svg>
);

export const ArrowRightIcon3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"
      fill="rgba(0,0,0,0.15)" transform="translate(1, 1)" />
    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"
      fill={color} />
  </svg>
);

export const ArrowLeftIcon3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
      fill="rgba(0,0,0,0.15)" transform="translate(-1, 1)" />
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
      fill={color} />
  </svg>
);

// ============================================================================
// LOADER / PROGRESS ICONS
// ============================================================================

export const Loader3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#AAFF00', animated = true
}) => {
  const gradId = getGradientId('loader');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      className={cn(animated && 'animate-spin', className)}
      style={{ filter: 'drop-shadow(0 2px 4px rgba(170,255,0,0.3))' }}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.1)" strokeWidth="3" fill="none" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={`url(#${gradId})`} strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
};

export const CheckCircle3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#22c55e', animated = true, onClick
}) => {
  const gradId = getGradientId('checkCircle');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      className={cn(iconBase(animated), className)}
      style={{ filter: 'drop-shadow(0 3px 6px rgba(34,197,94,0.4))' }}
      onClick={onClick}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="rgba(0,0,0,0.2)" transform="translate(1, 1)" />
      <circle cx="12" cy="12" r="10" fill={`url(#${gradId})`} />
      <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const XCircle3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#ef4444', animated = true, onClick
}) => {
  const gradId = getGradientId('xCircle');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      className={cn(iconBase(animated), className)}
      style={{ filter: 'drop-shadow(0 3px 6px rgba(239,68,68,0.4))' }}
      onClick={onClick}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="rgba(0,0,0,0.2)" transform="translate(1, 1)" />
      <circle cx="12" cy="12" r="10" fill={`url(#${gradId})`} />
      <path d="M15 9l-6 6M9 9l6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

// ============================================================================
// ALERT / STATUS ICONS
// ============================================================================

export const AlertCircle3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#f59e0b', animated = true, onClick
}) => {
  const gradId = getGradientId('alert');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      className={cn(iconBase(animated), className)}
      style={{ filter: 'drop-shadow(0 3px 6px rgba(245,158,11,0.4))' }}
      onClick={onClick}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="rgba(0,0,0,0.2)" transform="translate(1, 1)" />
      <circle cx="12" cy="12" r="10" fill={`url(#${gradId})`} />
      <path d="M12 8v4M12 16h.01" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

export const AlertTriangle3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#f59e0b', animated = true, onClick
}) => {
  const gradId = getGradientId('alertTri');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      className={cn(iconBase(animated), className)}
      style={{ filter: 'drop-shadow(0 3px 6px rgba(245,158,11,0.4))' }}
      onClick={onClick}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
        fill="rgba(0,0,0,0.2)" transform="translate(1, 1)" />
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
        fill={`url(#${gradId})`} />
      <path d="M12 9v4M12 17h.01" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

export const AlertOctagon3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#ef4444', animated = true, onClick
}) => {
  const gradId = getGradientId('alertOct');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      className={cn(iconBase(animated), className)}
      style={{ filter: 'drop-shadow(0 3px 6px rgba(239,68,68,0.4))' }}
      onClick={onClick}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2z"
        fill="rgba(0,0,0,0.2)" transform="translate(1, 1)" />
      <path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2z"
        fill={`url(#${gradId})`} />
      <path d="M12 8v4M12 16h.01" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

// ============================================================================
// AI / BRAIN ICONS
// ============================================================================

export const Brain3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#AAFF00', animated = true, onClick
}) => {
  const gradId = getGradientId('brain');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      className={cn(iconBase(animated), className)}
      style={{ filter: 'drop-shadow(0 3px 6px rgba(170,255,0,0.3))' }}
      onClick={onClick}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"
        fill="rgba(0,0,0,0.2)" transform="translate(1, 1)" />
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"
        fill={`url(#${gradId})`} />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"
        fill="rgba(0,0,0,0.2)" transform="translate(1, 1)" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"
        fill={`url(#${gradId})`} />
      <path d="M12 5v13M9 8h6M9 12h6M9 16h6" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" />
    </svg>
  );
};

export const Sparkles3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#AAFF00', animated = true, onClick
}) => {
  const gradId = getGradientId('sparkles');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      className={cn(iconBase(animated), animated && 'animate-pulse', className)}
      style={{ filter: 'drop-shadow(0 2px 8px rgba(170,255,0,0.5))' }}
      onClick={onClick}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.937A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"
        fill={`url(#${gradId})`} />
      <path d="M20 3v4M22 5h-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};

export const Zap3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#AAFF00', animated = true, onClick
}) => {
  const gradId = getGradientId('zap');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      className={cn(iconBase(animated), className)}
      style={{ filter: 'drop-shadow(0 2px 6px rgba(170,255,0,0.4))' }}
      onClick={onClick}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor="#fff700" stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        fill="rgba(0,0,0,0.2)" transform="translate(1, 1)" />
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        fill={`url(#${gradId})`} />
    </svg>
  );
};

export const Lightbulb3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#f59e0b', animated = true, onClick
}) => {
  const gradId = getGradientId('bulb');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      className={cn(iconBase(animated), className)}
      style={{ filter: 'drop-shadow(0 3px 8px rgba(245,158,11,0.4))' }}
      onClick={onClick}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff700" stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"
        fill="rgba(0,0,0,0.15)" transform="translate(0.5, 0.5)" />
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"
        stroke={`url(#${gradId})`} strokeWidth="2" fill="none" />
      <path d="M9 18h6M10 22h4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

// ============================================================================
// EXPORT DEFAULT MAP
// ============================================================================

export const Custom3DIconMap = {
  Check: CheckIcon3D,
  X: XIcon3D,
  ChevronDown: ChevronDownIcon3D,
  ChevronUp: ChevronUpIcon3D,
  ChevronRight: ChevronRightIcon3D,
  ChevronLeft: ChevronLeftIcon3D,
  ArrowRight: ArrowRightIcon3D,
  ArrowLeft: ArrowLeftIcon3D,
  Loader: Loader3D,
  Loader2: Loader3D,
  CheckCircle: CheckCircle3D,
  CheckCircle2: CheckCircle3D,
  XCircle: XCircle3D,
  AlertCircle: AlertCircle3D,
  AlertTriangle: AlertTriangle3D,
  AlertOctagon: AlertOctagon3D,
  Brain: Brain3D,
  Sparkles: Sparkles3D,
  Zap: Zap3D,
  Lightbulb: Lightbulb3D,
};
