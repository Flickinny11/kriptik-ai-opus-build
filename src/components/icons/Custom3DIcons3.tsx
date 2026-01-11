/**
 * Custom 3D Icons Library Part 3 - System, Data, and Specialized Icons
 */

import React from 'react';
import { cn } from '@/lib/utils';
import type { Icon3DProps } from './Custom3DIcons';

const iconBase = (animated: boolean = true) => cn(
  'transition-all duration-300',
  animated && 'hover:scale-110 hover:drop-shadow-lg'
);

let gradientCounter = 200;
const getGradientId = (prefix: string) => `${prefix}-${++gradientCounter}`;

// ============================================================================
// SYSTEM / SETTINGS ICONS
// ============================================================================

export const Settings3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), animated && 'hover:rotate-45', className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <circle cx="12" cy="12" r="3" fill="rgba(255,255,255,0.1)" stroke={color} strokeWidth="2" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
      stroke={color} strokeWidth="2" fill="none" />
  </svg>
);

export const Cpu3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#AAFF00', animated = true, onClick
}) => {
  const gradId = getGradientId('cpu');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      className={cn(iconBase(animated), className)}
      style={{ filter: 'drop-shadow(0 2px 4px rgba(170,255,0,0.3))' }}
      onClick={onClick}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="16" height="16" rx="2" fill={`url(#${gradId})`} stroke={color} strokeWidth="2" />
      <rect x="9" y="9" width="6" height="6" fill={color} opacity="0.5" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

export const Server3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <path d="M6 6h.01M6 18h.01" stroke={color} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const Database3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <ellipse cx="12" cy="5" rx="9" ry="3" fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" stroke={color} strokeWidth="2" fill="none" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" stroke={color} strokeWidth="2" fill="none" />
  </svg>
);

export const HardDrive3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M22 12H2" stroke={color} strokeWidth="2" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
      fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 16h.01M10 16h.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const Clock3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <circle cx="12" cy="12" r="10" fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <path d="M12 6v6l4 2" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const Timer3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <circle cx="12" cy="14" r="8" fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <path d="M12 10v4l2 2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M10 2h4M12 2v4" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const Activity3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#AAFF00', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(170,255,0,0.3))' }}
    onClick={onClick}
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"
      fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const TrendingDown3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#ef4444', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(239,68,68,0.3))' }}
    onClick={onClick}
  >
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"
      fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="17 18 23 18 23 12"
      fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const DollarSign3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#22c55e', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(34,197,94,0.3))' }}
    onClick={onClick}
  >
    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Scale3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1zM2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1zM7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ============================================================================
// CODE / DEV ICONS
// ============================================================================

export const Code3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#AAFF00', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(170,255,0,0.3))' }}
    onClick={onClick}
  >
    <path d="M16 18l6-6-6-6M8 6l-6 6 6 6"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const GitBranch3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <line x1="6" y1="3" x2="6" y2="15" stroke={color} strokeWidth="2" />
    <circle cx="18" cy="6" r="3" fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <circle cx="6" cy="18" r="3" fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <path d="M18 9a9 9 0 0 1-9 9" stroke={color} strokeWidth="2" fill="none" />
  </svg>
);

export const Merge3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <circle cx="18" cy="18" r="3" fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <circle cx="6" cy="6" r="3" fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <path d="M6 21V9a9 9 0 0 0 9 9" stroke={color} strokeWidth="2" fill="none" />
  </svg>
);

export const FileSearch3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
      fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <path d="M14 2v6h6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <circle cx="11.5" cy="14.5" r="2.5" stroke={color} strokeWidth="2" fill="none" />
    <path d="M13.25 16.25L15 18" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const Layers3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <polygon points="12 2 2 7 12 12 22 7 12 2" fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="2 17 12 22 22 17" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="2 12 12 17 22 12" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ============================================================================
// PEOPLE / SOCIAL ICONS
// ============================================================================

export const User3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <circle cx="12" cy="8" r="4" fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);

export const Users3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <circle cx="9" cy="7" r="4" fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={color} strokeWidth="2" fill="none" />
    <circle cx="19" cy="7" r="3" stroke={color} strokeWidth="2" fill="none" />
    <path d="M23 21v-2a3 3 0 0 0-3-3" stroke={color} strokeWidth="2" fill="none" />
  </svg>
);

export const MessageSquare3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
      fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ============================================================================
// SPECIALIZED ICONS
// ============================================================================

export const Star3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#f59e0b', animated = true, onClick
}) => {
  const gradId = getGradientId('star');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      className={cn(iconBase(animated), className)}
      style={{ filter: 'drop-shadow(0 2px 6px rgba(245,158,11,0.4))' }}
      onClick={onClick}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff700" stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
        fill="rgba(0,0,0,0.2)" transform="translate(0.5, 0.5)" />
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
        fill={`url(#${gradId})`} />
    </svg>
  );
};

export const Target3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#ef4444', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(239,68,68,0.3))' }}
    onClick={onClick}
  >
    <circle cx="12" cy="12" r="10" fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <circle cx="12" cy="12" r="6" stroke={color} strokeWidth="2" fill="none" />
    <circle cx="12" cy="12" r="2" fill={color} />
  </svg>
);

export const Shield3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#22c55e', animated = true, onClick
}) => {
  const gradId = getGradientId('shield');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      className={cn(iconBase(animated), className)}
      style={{ filter: 'drop-shadow(0 3px 6px rgba(34,197,94,0.4))' }}
      onClick={onClick}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        fill={`url(#${gradId})`} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const Eye3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
      fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <circle cx="12" cy="12" r="3" fill={color} />
  </svg>
);

export const Palette3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <circle cx="13.5" cy="6.5" r="1.5" fill="#ef4444" />
    <circle cx="17.5" cy="10.5" r="1.5" fill="#f59e0b" />
    <circle cx="8.5" cy="7.5" r="1.5" fill="#22c55e" />
    <circle cx="6.5" cy="12.5" r="1.5" fill="#3b82f6" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"
      fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
  </svg>
);

export const Rocket3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#AAFF00', animated = true, onClick
}) => {
  const gradId = getGradientId('rocket');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      className={cn(iconBase(animated), className)}
      style={{ filter: 'drop-shadow(0 3px 6px rgba(170,255,0,0.4))' }}
      onClick={onClick}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="1" />
          <stop offset="50%" stopColor="#f59e0b" stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
      </defs>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"
        fill="#f59e0b" stroke={color} strokeWidth="1.5" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"
        fill={`url(#${gradId})`} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"
        stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
};

export const Ban3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#ef4444', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(239,68,68,0.3))' }}
    onClick={onClick}
  >
    <circle cx="12" cy="12" r="10" fill="rgba(0,0,0,0.1)" stroke={color} strokeWidth="2" />
    <path d="M4.93 4.93l14.14 14.14" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const Crown3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#f59e0b', animated = true, onClick
}) => {
  const gradId = getGradientId('crown');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      className={cn(iconBase(animated), className)}
      style={{ filter: 'drop-shadow(0 2px 6px rgba(245,158,11,0.4))' }}
      onClick={onClick}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff700" stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <path d="M2 17l3-11 5 5 2-7 2 7 5-5 3 11H2z"
        fill={`url(#${gradId})`} />
      <rect x="2" y="17" width="20" height="3" rx="1" fill={color} />
    </svg>
  );
};

export const Microscope3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M6 18h8M3 22h18M14 22a7 7 0 1 0 0-14h-1M9 14h1"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 6a3 3 0 1 0 0-6" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M14 4v6M9 7v5" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const Swords3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14.5 6.5L21 3v3L9.5 17.5M11 19l-6 6M8 16l-4 4M5 21l-2 2"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Handshake3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#22c55e', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(34,197,94,0.3))' }}
    onClick={onClick}
  >
    <path d="M11 17a2 2 0 0 1-2-2v0a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2" stroke={color} strokeWidth="2" fill="none" />
    <path d="M7 21v-4a2 2 0 0 1 2-2h.5L14 10l3.5 3-4.5 4h.5a2 2 0 0 1 2 2v4"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M5 11h1a2 2 0 0 1 2 2v3M19 11h-1a2 2 0 0 0-2 2v3"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);

export const ArrowLeftRight3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = 'currentColor', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    onClick={onClick}
  >
    <path d="M8 3L4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"
      stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ============================================================================
// NEURAL PATHWAY ICONS (for orchestration visualization)
// ============================================================================

export const Lock3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#f59e0b', animated = true, onClick
}) => {
  const gradId = getGradientId('lock');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      className={cn(iconBase(animated), className)}
      style={{ filter: 'drop-shadow(0 2px 4px rgba(245,158,11,0.3))' }}
      onClick={onClick}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" 
        fill={`url(#${gradId})`} stroke={color} strokeWidth="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1" fill={color} />
    </svg>
  );
};

export const Hammer3D: React.FC<Icon3DProps> = ({
  size = 24, className = '', color = '#8b5cf6', animated = true, onClick
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    className={cn(iconBase(animated), animated && 'hover:-rotate-12', className)}
    style={{ filter: 'drop-shadow(0 2px 4px rgba(139,92,246,0.3))' }}
    onClick={onClick}
  >
    <path d="M15 12l-8.5 8.5a2.12 2.12 0 0 1-3-3L12 9" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M17.64 15L22 10.64a1 1 0 0 0 0-1.41l-5.23-5.23a1 1 0 0 0-1.41 0L11 8.36" 
      stroke={color} strokeWidth="2" fill="rgba(139,92,246,0.2)" strokeLinecap="round" />
    <path d="M14.5 12.5L11 9" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Brain3D is already defined in Custom3DIcons.tsx, using that version
