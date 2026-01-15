/**
 * GeometricIcons - Custom geometric SVG icon system
 * 
 * Replaces Lucide React icons with premium geometric designs.
 * Uses white/black/red (#dc2626) color palette with 3D depth.
 * 
 * Features:
 * - No external dependencies (pure SVG)
 * - Spin/pulse animation variants
 * - Consistent sizing and styling
 * - Red accent color per design spec
 */

import React from 'react';
import { motion } from 'framer-motion';

// Design tokens
const COLORS = {
  primary: '#ffffff',
  secondary: '#1a1a1a',
  accent: '#dc2626',
  muted: '#666666',
  subtle: '#999999',
} as const;

interface IconProps {
  size?: number;
  className?: string;
  color?: string;
  accentColor?: string;
  animate?: 'spin' | 'pulse' | 'none';
}

const defaultProps: IconProps = {
  size: 24,
  className: '',
  color: COLORS.primary,
  accentColor: COLORS.accent,
  animate: 'none',
};

// Animation wrapper component
function AnimatedIcon({ 
  children, 
  animate, 
  size 
}: { 
  children: React.ReactNode; 
  animate: IconProps['animate']; 
  size: number; 
}) {
  if (animate === 'spin') {
    return (
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{ width: size, height: size, display: 'inline-flex' }}
      >
        {children}
      </motion.div>
    );
  }
  
  if (animate === 'pulse') {
    return (
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [1, 0.8, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ width: size, height: size, display: 'inline-flex' }}
      >
        {children}
      </motion.div>
    );
  }
  
  return <>{children}</>;
}

// ============================================================================
// GEOMETRIC SHAPES
// ============================================================================

/**
 * Interlocking Triangles - Fallback brand icon
 */
export function InterlockingTriangles(props: IconProps) {
  const { size, className, color, accentColor, animate } = { ...defaultProps, ...props };
  
  return (
    <AnimatedIcon animate={animate} size={size!}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        {/* Main triangle */}
        <path 
          d="M12 2L2 20h20L12 2z" 
          fill={color} 
          fillOpacity="0.15"
          stroke={color}
          strokeWidth="1.5"
        />
        {/* Inner inverted triangle */}
        <path 
          d="M12 18L7 10h10L12 18z" 
          fill={accentColor}
          fillOpacity="0.9"
        />
        {/* Top accent */}
        <path 
          d="M12 4L9 9h6L12 4z" 
          fill={color}
          fillOpacity="0.5"
        />
      </svg>
    </AnimatedIcon>
  );
}

/**
 * Hexagon Mesh - Technology/Network icon
 */
export function HexagonMesh(props: IconProps) {
  const { size, className, color, accentColor, animate } = { ...defaultProps, ...props };
  
  return (
    <AnimatedIcon animate={animate} size={size!}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        {/* Central hexagon */}
        <path 
          d="M12 3L19 7v6l-7 4-7-4V7l7-4z" 
          fill={color}
          fillOpacity="0.1"
          stroke={color}
          strokeWidth="1.5"
        />
        {/* Inner hexagon */}
        <path 
          d="M12 6L16 8.5v4L12 15l-4-2.5v-4L12 6z" 
          fill={accentColor}
          fillOpacity="0.6"
          stroke={accentColor}
          strokeWidth="1"
        />
        {/* Connection lines */}
        <path d="M12 3v3M19 7l-3 1.5M19 13l-3-0.5M12 17v-2M5 13l3-0.5M5 7l3 1.5" 
          stroke={color} 
          strokeWidth="1" 
          strokeOpacity="0.5"
        />
      </svg>
    </AnimatedIcon>
  );
}

/**
 * Cube Frame - 3D/Structure icon
 */
export function CubeFrame(props: IconProps) {
  const { size, className, color, accentColor, animate } = { ...defaultProps, ...props };
  
  return (
    <AnimatedIcon animate={animate} size={size!}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        {/* Back face */}
        <path 
          d="M7 5h10v10H7z" 
          fill={color}
          fillOpacity="0.05"
          stroke={color}
          strokeWidth="1"
          strokeOpacity="0.3"
        />
        {/* Front face */}
        <path 
          d="M5 7h10v10H5z" 
          fill={color}
          fillOpacity="0.15"
          stroke={color}
          strokeWidth="1.5"
        />
        {/* Connecting edges */}
        <path d="M5 7L7 5M15 7l2-2M5 17l2-2M15 17l2-2" 
          stroke={color} 
          strokeWidth="1.5"
        />
        {/* Accent corner */}
        <circle cx="17" cy="5" r="2" fill={accentColor} />
      </svg>
    </AnimatedIcon>
  );
}

/**
 * Diamond Grid - Data/Pattern icon
 */
export function DiamondGrid(props: IconProps) {
  const { size, className, color, accentColor, animate } = { ...defaultProps, ...props };
  
  return (
    <AnimatedIcon animate={animate} size={size!}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        {/* Grid of diamonds */}
        <path d="M12 2l3 4-3 4-3-4 3-4z" fill={color} fillOpacity="0.3" />
        <path d="M6 6l3 4-3 4-3-4 3-4z" fill={color} fillOpacity="0.2" />
        <path d="M18 6l3 4-3 4-3-4 3-4z" fill={color} fillOpacity="0.2" />
        <path d="M12 10l3 4-3 4-3-4 3-4z" fill={accentColor} fillOpacity="0.8" />
        <path d="M6 14l3 4-3 4-3-4 3-4z" fill={color} fillOpacity="0.15" />
        <path d="M18 14l3 4-3 4-3-4 3-4z" fill={color} fillOpacity="0.15" />
        {/* Outer frame */}
        <rect x="2" y="2" width="20" height="20" rx="3" 
          stroke={color} 
          strokeWidth="1" 
          strokeOpacity="0.3"
          fill="none"
        />
      </svg>
    </AnimatedIcon>
  );
}

/**
 * Circuit Pattern - Tech/Connection icon
 */
export function CircuitPattern(props: IconProps) {
  const { size, className, color, accentColor, animate } = { ...defaultProps, ...props };
  
  return (
    <AnimatedIcon animate={animate} size={size!}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        {/* Main circuit paths */}
        <path 
          d="M4 12h4M8 12v-4M8 8h4M12 8v-4M12 4h4M16 4v4M16 8h4" 
          stroke={color} 
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path 
          d="M4 12h0M12 20v-4M12 16h4M16 16v-4M16 12h4M20 12v4" 
          stroke={color} 
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.6"
        />
        {/* Node points */}
        <circle cx="8" cy="12" r="2" fill={color} />
        <circle cx="12" cy="8" r="2" fill={color} />
        <circle cx="16" cy="12" r="2.5" fill={accentColor} />
        <circle cx="12" cy="16" r="2" fill={color} fillOpacity="0.6" />
      </svg>
    </AnimatedIcon>
  );
}

// ============================================================================
// UI ICONS (Replace Lucide equivalents)
// ============================================================================

/**
 * CheckGeometric - Success indicator
 */
export function CheckGeometric(props: IconProps) {
  const { size, className, color, animate } = { ...defaultProps, ...props };
  const successColor = '#22c55e';
  
  return (
    <AnimatedIcon animate={animate} size={size!}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        {/* Hexagonal background */}
        <path 
          d="M12 2L20 6v8l-8 4-8-4V6l8-4z" 
          fill={successColor}
          fillOpacity="0.15"
          stroke={successColor}
          strokeWidth="1.5"
        />
        {/* Checkmark */}
        <path 
          d="M8 12l3 3 5-6" 
          stroke={color || successColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </AnimatedIcon>
  );
}

/**
 * XGeometric - Error/Close indicator
 */
export function XGeometric(props: IconProps) {
  const { size, className, color, accentColor, animate } = { ...defaultProps, ...props };
  
  return (
    <AnimatedIcon animate={animate} size={size!}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        {/* Diamond background */}
        <path 
          d="M12 2l8 8-8 8-8-8 8-8z" 
          fill={accentColor}
          fillOpacity="0.15"
          stroke={accentColor}
          strokeWidth="1.5"
        />
        {/* X mark */}
        <path 
          d="M9 9l6 6M15 9l-6 6" 
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </AnimatedIcon>
  );
}

/**
 * PlusGeometric - Add action
 */
export function PlusGeometric(props: IconProps) {
  const { size, className, color, accentColor, animate } = { ...defaultProps, ...props };
  
  return (
    <AnimatedIcon animate={animate} size={size!}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        {/* Circle background */}
        <circle 
          cx="12" 
          cy="12" 
          r="9" 
          fill={color}
          fillOpacity="0.1"
          stroke={color}
          strokeWidth="1.5"
        />
        {/* Plus */}
        <path 
          d="M12 7v10M7 12h10" 
          stroke={accentColor}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </AnimatedIcon>
  );
}

/**
 * RefreshGeometric - Loading/Retry
 */
export function RefreshGeometric(props: IconProps) {
  const { size, className, color, accentColor, animate = 'spin' } = { ...defaultProps, ...props };
  
  return (
    <AnimatedIcon animate={animate} size={size!}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        {/* Circular arrow segments */}
        <path 
          d="M12 4a8 8 0 0 1 8 8" 
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path 
          d="M12 20a8 8 0 0 1-8-8" 
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Arrow heads */}
        <path 
          d="M20 8l0 4-4 0" 
          stroke={accentColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path 
          d="M4 16l0-4 4 0" 
          stroke={accentColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </AnimatedIcon>
  );
}

/**
 * LockGeometric - Security/Credentials
 */
export function LockGeometric(props: IconProps) {
  const { size, className, color, accentColor, animate } = { ...defaultProps, ...props };
  
  return (
    <AnimatedIcon animate={animate} size={size!}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        {/* Lock body - 3D effect */}
        <rect 
          x="4" 
          y="10" 
          width="16" 
          height="12" 
          rx="2"
          fill={color}
          fillOpacity="0.1"
          stroke={color}
          strokeWidth="1.5"
        />
        {/* Shackle */}
        <path 
          d="M7 10V7a5 5 0 0 1 10 0v3" 
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Keyhole */}
        <circle cx="12" cy="15" r="2" fill={accentColor} />
        <path d="M12 17v2" stroke={accentColor} strokeWidth="2" strokeLinecap="round" />
        {/* 3D edge highlight */}
        <path 
          d="M4 10h16" 
          stroke={color}
          strokeWidth="1"
          strokeOpacity="0.5"
        />
      </svg>
    </AnimatedIcon>
  );
}

/**
 * KeyGeometric - API Key
 */
export function KeyGeometric(props: IconProps) {
  const { size, className, color, accentColor, animate } = { ...defaultProps, ...props };
  
  return (
    <AnimatedIcon animate={animate} size={size!}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        {/* Key head (octagon) */}
        <path 
          d="M7 4l2-2h6l2 2v2l-2 2v2l2 2 1 1v5l-2 2h-2l-2-2v-1l-1-1-1 1v1l-2 2H6l-2-2v-5l1-1 2-2V8L5 6V4l2 0z" 
          fill={color}
          fillOpacity="0.1"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Simplified key shape */}
        <circle cx="9" cy="9" r="4" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5" />
        <path d="M12 11l6 6M15 17h3v3" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Key teeth */}
        <path d="M16 14l1 1M14 16l1 1" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </AnimatedIcon>
  );
}

/**
 * LinkGeometric - Connection
 */
export function LinkGeometric(props: IconProps) {
  const { size, className, color, accentColor, animate } = { ...defaultProps, ...props };
  
  return (
    <AnimatedIcon animate={animate} size={size!}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        {/* Chain links */}
        <rect 
          x="2" 
          y="10" 
          width="8" 
          height="4" 
          rx="2"
          fill={color}
          fillOpacity="0.2"
          stroke={color}
          strokeWidth="1.5"
        />
        <rect 
          x="14" 
          y="10" 
          width="8" 
          height="4" 
          rx="2"
          fill={color}
          fillOpacity="0.2"
          stroke={color}
          strokeWidth="1.5"
        />
        {/* Connection */}
        <path 
          d="M10 12h4" 
          stroke={accentColor}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Accent dots */}
        <circle cx="6" cy="12" r="1.5" fill={accentColor} />
        <circle cx="18" cy="12" r="1.5" fill={accentColor} />
      </svg>
    </AnimatedIcon>
  );
}

/**
 * SettingsGeometric - Configuration
 */
export function SettingsGeometric(props: IconProps) {
  const { size, className, color, accentColor, animate } = { ...defaultProps, ...props };
  
  return (
    <AnimatedIcon animate={animate} size={size!}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        {/* Outer gear teeth */}
        <path 
          d="M12 2l1.5 2.5h3l1 2.5-2 2 .5 2.5L14 13l1 2.5-2 2-2.5-.5-2 2-2.5-1L5 16l-2-2 1-2.5L2 9l2.5-1 .5-2.5 2-2h3L12 2z" 
          fill={color}
          fillOpacity="0.1"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Central circle */}
        <circle 
          cx="12" 
          cy="12" 
          r="4"
          fill={color}
          fillOpacity="0.2"
          stroke={color}
          strokeWidth="1.5"
        />
        {/* Inner accent */}
        <circle cx="12" cy="12" r="2" fill={accentColor} />
      </svg>
    </AnimatedIcon>
  );
}

/**
 * BellGeometric - Notifications (3D raised design per spec)
 */
export function BellGeometric(props: IconProps) {
  const { size, className, color, accentColor, animate } = { ...defaultProps, ...props };
  
  return (
    <AnimatedIcon animate={animate} size={size!}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        {/* Bell body with 3D depth */}
        <path 
          d="M12 2C8 2 5 5.5 5 9v5l-2 2v1h18v-1l-2-2V9c0-3.5-3-7-7-7z" 
          fill={color}
          fillOpacity="0.15"
        />
        {/* Main bell outline */}
        <path 
          d="M12 2C8 2 5 5.5 5 9v5l-2 2v1h18v-1l-2-2V9c0-3.5-3-7-7-7z" 
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* 3D highlight edge */}
        <path 
          d="M6 9c0-3 2.5-6 6-6" 
          stroke={color}
          strokeWidth="1"
          strokeOpacity="0.5"
          strokeLinecap="round"
        />
        {/* Clapper */}
        <path 
          d="M10 19a2 2 0 0 0 4 0" 
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* Red accent notification dot */}
        <circle 
          cx="17" 
          cy="5" 
          r="3" 
          fill={accentColor}
          stroke={COLORS.secondary}
          strokeWidth="1"
        />
      </svg>
    </AnimatedIcon>
  );
}

/**
 * ExternalLinkGeometric - Open in new window
 */
export function ExternalLinkGeometric(props: IconProps) {
  const { size, className, color, accentColor, animate } = { ...defaultProps, ...props };
  
  return (
    <AnimatedIcon animate={animate} size={size!}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        {/* Window frame */}
        <rect 
          x="3" 
          y="6" 
          width="14" 
          height="14" 
          rx="2"
          fill={color}
          fillOpacity="0.1"
          stroke={color}
          strokeWidth="1.5"
        />
        {/* Arrow */}
        <path 
          d="M14 3h7v7" 
          stroke={accentColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path 
          d="M21 3L12 12" 
          stroke={accentColor}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </AnimatedIcon>
  );
}

/**
 * SaveGeometric - Save action
 */
export function SaveGeometric(props: IconProps) {
  const { size, className, color, accentColor, animate } = { ...defaultProps, ...props };
  
  return (
    <AnimatedIcon animate={animate} size={size!}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        {/* Floppy disk body */}
        <path 
          d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" 
          fill={color}
          fillOpacity="0.1"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Label area */}
        <rect x="7" y="13" width="10" height="8" rx="1" fill={color} fillOpacity="0.2" />
        {/* Metal slider */}
        <rect x="8" y="3" width="6" height="5" rx="1" fill={accentColor} fillOpacity="0.5" stroke={accentColor} strokeWidth="1" />
      </svg>
    </AnimatedIcon>
  );
}

/**
 * CloudGeometric - Cloud/Deploy
 */
export function CloudGeometric(props: IconProps) {
  const { size, className, color, accentColor, animate } = { ...defaultProps, ...props };
  
  return (
    <AnimatedIcon animate={animate} size={size!}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        {/* Cloud shape */}
        <path 
          d="M18 18H7a5 5 0 0 1-.5-9.96A7 7 0 0 1 20 10a4 4 0 0 1-2 8z" 
          fill={color}
          fillOpacity="0.15"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Upload arrow */}
        <path 
          d="M12 12v6M9 14l3-3 3 3" 
          stroke={accentColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </AnimatedIcon>
  );
}

/**
 * GPUGeometric - GPU/Compute
 */
export function GPUGeometric(props: IconProps) {
  const { size, className, color, accentColor, animate } = { ...defaultProps, ...props };
  
  return (
    <AnimatedIcon animate={animate} size={size!}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        {/* GPU board */}
        <rect 
          x="2" 
          y="6" 
          width="20" 
          height="12" 
          rx="2"
          fill={color}
          fillOpacity="0.1"
          stroke={color}
          strokeWidth="1.5"
        />
        {/* Fan area */}
        <rect x="4" y="8" width="6" height="8" rx="1" fill={color} fillOpacity="0.2" />
        <circle cx="7" cy="12" r="2.5" fill={accentColor} fillOpacity="0.8" />
        <circle cx="7" cy="12" r="1" fill={COLORS.secondary} />
        {/* Heat sink */}
        <rect x="12" y="8" width="8" height="8" rx="1" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="0.5" />
        <path d="M13 9v6M15 9v6M17 9v6M19 9v6" stroke={color} strokeWidth="0.5" strokeOpacity="0.5" />
        {/* Power connectors */}
        <rect x="5" y="4" width="2" height="2" rx="0.5" fill={color} fillOpacity="0.5" />
        <rect x="9" y="4" width="2" height="2" rx="0.5" fill={color} fillOpacity="0.5" />
        <rect x="13" y="4" width="2" height="2" rx="0.5" fill={color} fillOpacity="0.5" />
      </svg>
    </AnimatedIcon>
  );
}

/**
 * DatabaseGeometric - Database
 */
export function DatabaseGeometric(props: IconProps) {
  const { size, className, color, accentColor, animate } = { ...defaultProps, ...props };
  
  return (
    <AnimatedIcon animate={animate} size={size!}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        {/* Top ellipse */}
        <ellipse cx="12" cy="5" rx="8" ry="3" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5" />
        {/* Cylinder sides */}
        <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" stroke={color} strokeWidth="1.5" />
        {/* Middle accent ring */}
        <ellipse cx="12" cy="12" rx="8" ry="3" fill="none" stroke={accentColor} strokeWidth="1" />
        {/* Bottom ellipse hint */}
        <path d="M4 19c0 1.66 3.58 3 8 3s8-1.34 8-3" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
      </svg>
    </AnimatedIcon>
  );
}

/**
 * CreditCardGeometric - Payment
 */
export function CreditCardGeometric(props: IconProps) {
  const { size, className, color, accentColor, animate } = { ...defaultProps, ...props };
  
  return (
    <AnimatedIcon animate={animate} size={size!}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        {/* Card body with 3D perspective */}
        <rect 
          x="2" 
          y="5" 
          width="20" 
          height="14" 
          rx="2"
          fill={color}
          fillOpacity="0.1"
          stroke={color}
          strokeWidth="1.5"
          transform="perspective(100) rotateX(-3deg)"
        />
        {/* Magnetic stripe */}
        <rect x="2" y="9" width="20" height="3" fill={color} fillOpacity="0.3" />
        {/* Chip */}
        <rect x="5" y="13" width="4" height="3" rx="0.5" fill={accentColor} />
        {/* Card number area */}
        <path d="M11 15h8" stroke={color} strokeWidth="1" strokeOpacity="0.5" strokeDasharray="3 2" />
      </svg>
    </AnimatedIcon>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export const GeometricIcons = {
  // Shapes
  InterlockingTriangles,
  HexagonMesh,
  CubeFrame,
  DiamondGrid,
  CircuitPattern,
  // UI Icons
  Check: CheckGeometric,
  X: XGeometric,
  Plus: PlusGeometric,
  Refresh: RefreshGeometric,
  Lock: LockGeometric,
  Key: KeyGeometric,
  Link: LinkGeometric,
  Settings: SettingsGeometric,
  Bell: BellGeometric,
  ExternalLink: ExternalLinkGeometric,
  Save: SaveGeometric,
  Cloud: CloudGeometric,
  GPU: GPUGeometric,
  Database: DatabaseGeometric,
  CreditCard: CreditCardGeometric,
};

export default GeometricIcons;
