/**
 * Custom 3D Icons Library Part 2 - Action & Media Icons
 */

import React from 'react';
import { cn } from '@/lib/utils';
import type { Icon3DProps } from './Custom3DIcons';

const iconBase = (animated: boolean = true) => cn(
  'transition-all duration-300',
  animated && 'hover:scale-110 hover:drop-shadow-lg'
);

let gradientCounter = 100;
const getGradientId = (prefix: string) => `${prefix}-${++gradientCounter}`;

// ============================================================================
// ACTION ICONS
// ============================================================================

export const Upload3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
      stroke="rgba(0,0,0,0.2)" strokeWidth="2" fill="none" transform="translate(1, 1)" />
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M17 8l-5-5-5 5M12 3v12"
      stroke="rgba(0,0,0,0.2)" strokeWidth="2" fill="none" transform="translate(0.5, 0.5)" />
    <path d="M17 8l-5-5-5 5M12 3v12"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Download3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M7 10l5 5 5-5M12 15V3"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Copy3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"
      fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);

export const Search3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <circle cx="11" cy="11" r="8" fill="rgba(255,255,255,0.05)"
      stroke={color} strokeWidth="2" />
    <path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const Filter3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"
      fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const RefreshCw3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M23 4v6h-6" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1 20v-6h6" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const RotateCcw3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M1 4v6h6" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ExternalLink3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M15 3h6v6" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 14L21 3" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const Play3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#22c55e', animated = true, onClick
}) => {
  const gradId = getGradientId('play');
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
      <polygon points="5 3 19 12 5 21 5 3" fill="rgba(0,0,0,0.2)" transform="translate(1, 1)" />
      <polygon points="5 3 19 12 5 21 5 3" fill={`url(#${gradId})`} />
    </svg>
  );
};

export const Pause3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#f59e0b', animated = true, onClick
}) => {
  const gradId = getGradientId('pause');
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
      <rect x="6" y="4" width="4" height="16" rx="1" fill="rgba(0,0,0,0.2)" transform="translate(0.5, 0.5)" />
      <rect x="6" y="4" width="4" height="16" rx="1" fill={`url(#${gradId})`} />
      <rect x="14" y="4" width="4" height="16" rx="1" fill="rgba(0,0,0,0.2)" transform="translate(0.5, 0.5)" />
      <rect x="14" y="4" width="4" height="16" rx="1" fill={`url(#${gradId})`} />
    </svg>
  );
};

export const Square3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#ef4444', animated = true, onClick
}) => {
  const gradId = getGradientId('square');
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
      <rect x="4" y="4" width="16" height="16" rx="2" fill="rgba(0,0,0,0.2)" transform="translate(0.5, 0.5)" />
      <rect x="4" y="4" width="16" height="16" rx="2" fill={`url(#${gradId})`} />
    </svg>
  );
};

// ============================================================================
// MEDIA ICONS
// ============================================================================

export const Image3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"
      fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <circle cx="8.5" cy="8.5" r="1.5" fill={color} />
    <path d="M21 15l-5-5L5 21" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Video3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <rect x="2" y="6" width="14" height="12" rx="2" ry="2"
      fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <path d="M23 7l-7 5 7 5V7z" fill={color} />
  </svg>
);

export const Music3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M9 18V5l12-2v13" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6" cy="18" r="3" fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <circle cx="18" cy="16" r="3" fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
  </svg>
);

export const FileText3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
      fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// ============================================================================
// DEVICE ICONS
// ============================================================================

export const Monitor3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"
      fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <path d="M8 21h8M12 17v4" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const Tablet3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2"
      fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <path d="M12 18h.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const Smartphone3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"
      fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <path d="M12 18h.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const Maximize3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Minimize3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Columns3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <rect x="3" y="3" width="7" height="18" rx="1" fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <rect x="14" y="3" width="7" height="18" rx="1" fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
  </svg>
);

export const PanelRightClose3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <path d="M15 3v18" stroke={color} strokeWidth="2" />
    <path d="M9 10l-2 2 2 2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ============================================================================
// MISSING CORE ICONS - Added for training components
// ============================================================================

export const X3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M18 6L6 18M6 6l12 12"
      stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Check3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#22c55e', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(34,197,94,0.3))' }}
    onClick={onClick}
  >
    <polyline points="20 6 9 17 4 12"
      fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ChevronDown3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <polyline points="6 9 12 15 18 9"
      fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ChevronUp3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <polyline points="18 15 12 9 6 15"
      fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const LoadingSpinner3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#AAFF00', animated = true, onClick
}) => {
  const gradId = getGradientId('spinner');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      className={cn(iconBase(false), animated && 'animate-spin', className)}
      style={{ filter: 'drop-shadow(0 2px 4px rgba(170,255,0,0.3))' }}
      onClick={onClick}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10"
        fill="none" stroke={`url(#${gradId})`} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
};

export const ArrowRight3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M5 12h14M12 5l7 7-7 7"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ArrowLeft3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M19 12H5M12 19l-7-7 7-7"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
