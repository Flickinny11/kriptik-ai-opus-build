/**
 * Landing Page Specialized 3D Icons
 *
 * Premium icons specifically designed for marketing materials.
 * Features enhanced depth, gradients, and animations.
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface LandingIcon3DProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

/**
 * ComparisonCheckIcon - Premium green check for KripTik features
 * Conveys success, completion, and positive attributes
 */
export const ComparisonCheckIcon: React.FC<LandingIcon3DProps> = ({
  size = 24,
  className = '',
  animated = true,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={cn(
      'transition-all duration-300 drop-shadow-[0_2px_4px_rgba(168,255,65,0.3)]',
      animated && 'hover:scale-110 hover:drop-shadow-[0_4px_8px_rgba(168,255,65,0.5)]',
      className
    )}
  >
    <defs>
      <linearGradient id="landing-check-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#A8FF41" />
        <stop offset="50%" stopColor="#8BDF2A" />
        <stop offset="100%" stopColor="#6BC018" />
      </linearGradient>
      <filter id="landing-check-glow">
        <feGaussianBlur stdDeviation="1" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    {/* Shadow layer */}
    <path
      d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
      fill="rgba(107,192,24,0.3)"
      transform="translate(1, 2)"
    />
    {/* Main checkmark with gradient */}
    <path
      d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
      fill="url(#landing-check-gradient)"
      filter="url(#landing-check-glow)"
    />
    {/* Highlight */}
    <path
      d="M9 15L5.5 11.5 4.8 12.2 9 16.4 19.2 6.2 18.5 5.5z"
      fill="rgba(255,255,255,0.4)"
    />
  </svg>
);

/**
 * ComparisonXIcon - Subtle X for competitor limitations
 * Conveys limitations without being too negative
 */
export const ComparisonXIcon: React.FC<LandingIcon3DProps> = ({
  size = 24,
  className = '',
  animated = true,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={cn(
      'transition-all duration-300 drop-shadow-[0_2px_4px_rgba(239,68,68,0.3)]',
      animated && 'hover:scale-110',
      className
    )}
  >
    <defs>
      <linearGradient id="landing-x-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F87171" />
        <stop offset="50%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#DC2626" />
      </linearGradient>
    </defs>
    {/* Shadow layer */}
    <path
      d="M18.3 5.71L12 12l6.3 6.29-1.41 1.42L12 13.41l-6.29 6.3-1.42-1.42L10.59 12 4.3 5.71 5.71 4.3 12 10.59l6.29-6.3z"
      fill="rgba(185,28,28,0.3)"
      transform="translate(1, 1)"
    />
    {/* Main X with gradient */}
    <path
      d="M18.3 5.71L12 12l6.3 6.29-1.41 1.42L12 13.41l-6.29 6.3-1.42-1.42L10.59 12 4.3 5.71 5.71 4.3 12 10.59l6.29-6.3z"
      fill="url(#landing-x-gradient)"
    />
    {/* Subtle highlight */}
    <path
      d="M17 6.5L12 11.5l5 5-.7.7L12 12.7l-5 5-.7-.7 5-5-5-5 .7-.7 5 5 5-5z"
      fill="rgba(255,255,255,0.2)"
    />
  </svg>
);

/**
 * AgentIcon3D - Verification agent icon with pulsing glow
 */
export const AgentIcon3D: React.FC<LandingIcon3DProps & { agentColor?: string }> = ({
  size = 32,
  className = '',
  animated = true,
  agentColor = '#A8FF41',
}) => (
  <svg
    viewBox="0 0 32 32"
    width={size}
    height={size}
    className={cn(
      'transition-all duration-300',
      animated && 'hover:scale-110',
      className
    )}
    style={{ filter: `drop-shadow(0 4px 8px ${agentColor}40)` }}
  >
    <defs>
      <radialGradient id={`agent-gradient-${agentColor.replace('#', '')}`} cx="30%" cy="30%">
        <stop offset="0%" stopColor={agentColor} stopOpacity="1" />
        <stop offset="100%" stopColor={agentColor} stopOpacity="0.6" />
      </radialGradient>
    </defs>
    {/* Agent body shadow */}
    <circle
      cx="17"
      cy="18"
      r="12"
      fill="rgba(0,0,0,0.3)"
    />
    {/* Agent body */}
    <circle
      cx="16"
      cy="16"
      r="12"
      fill={`url(#agent-gradient-${agentColor.replace('#', '')})`}
      stroke={agentColor}
      strokeWidth="1"
    />
    {/* Inner glow */}
    <circle
      cx="14"
      cy="14"
      r="6"
      fill="rgba(255,255,255,0.2)"
    />
    {/* Eye/sensor */}
    <circle
      cx="16"
      cy="16"
      r="4"
      fill="rgba(0,0,0,0.4)"
    />
    <circle
      cx="15"
      cy="15"
      r="2"
      fill="rgba(255,255,255,0.6)"
    />
  </svg>
);

/**
 * CTAArrowIcon - Animated call-to-action arrow
 */
export const CTAArrowIcon: React.FC<LandingIcon3DProps> = ({
  size = 24,
  className = '',
  animated = true,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={cn(
      'transition-all duration-300',
      animated && 'group-hover:translate-x-1',
      className
    )}
  >
    <defs>
      <linearGradient id="cta-arrow-gradient" x1="0%" y1="50%" x2="100%" y2="50%">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.5" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
      </linearGradient>
    </defs>
    {/* Shadow */}
    <path
      d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"
      fill="rgba(0,0,0,0.2)"
      transform="translate(1, 1)"
    />
    {/* Main arrow */}
    <path
      d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"
      fill="url(#cta-arrow-gradient)"
    />
    {/* Highlight */}
    <path
      d="M12 5.5L11 6.5 15.5 11H5v1h10.5L11 16.5l1 1 7-7.5z"
      fill="rgba(255,255,255,0.3)"
    />
  </svg>
);

/**
 * SpeedIcon3D - Speed/performance indicator
 */
export const SpeedIcon3D: React.FC<LandingIcon3DProps> = ({
  size = 24,
  className = '',
  animated = true,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={cn(
      'transition-all duration-300 drop-shadow-[0_2px_4px_rgba(168,255,65,0.3)]',
      animated && 'hover:scale-110',
      className
    )}
  >
    <defs>
      <linearGradient id="speed-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#A8FF41" />
        <stop offset="100%" stopColor="#6BC018" />
      </linearGradient>
    </defs>
    {/* Speedometer arc shadow */}
    <path
      d="M13 3.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z"
      fill="none"
      stroke="rgba(0,0,0,0.2)"
      strokeWidth="3"
      transform="translate(1, 1)"
    />
    {/* Speedometer arc */}
    <path
      d="M12 2a10 10 0 100 20 10 10 0 000-20z"
      fill="none"
      stroke="url(#speed-gradient)"
      strokeWidth="2"
      strokeDasharray="31.4 62.8"
      strokeLinecap="round"
    />
    {/* Needle shadow */}
    <path
      d="M13 13l5-7"
      stroke="rgba(0,0,0,0.3)"
      strokeWidth="2.5"
      strokeLinecap="round"
      transform="translate(1, 1)"
    />
    {/* Needle */}
    <path
      d="M12 12l5-7"
      stroke="url(#speed-gradient)"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Center dot */}
    <circle cx="12" cy="12" r="2" fill="url(#speed-gradient)" />
  </svg>
);

/**
 * TrustBadgeIcon - Trust indicator with shield
 */
export const TrustBadgeIcon: React.FC<LandingIcon3DProps> = ({
  size = 24,
  className = '',
  animated = true,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={cn(
      'transition-all duration-300 drop-shadow-[0_2px_4px_rgba(168,255,65,0.3)]',
      animated && 'hover:scale-110',
      className
    )}
  >
    <defs>
      <linearGradient id="trust-shield-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#A8FF41" />
        <stop offset="50%" stopColor="#8BDF2A" />
        <stop offset="100%" stopColor="#6BC018" />
      </linearGradient>
    </defs>
    {/* Shield shadow */}
    <path
      d="M13 2L4 5v6.09c0 5.05 3.41 9.76 9 10.91 5.59-1.15 9-5.86 9-10.91V5l-9-3z"
      fill="rgba(107,192,24,0.3)"
      transform="translate(1, 1)"
    />
    {/* Shield body */}
    <path
      d="M12 1L3 4v6.09c0 5.05 3.41 9.76 9 10.91 5.59-1.15 9-5.86 9-10.91V4l-9-3z"
      fill="url(#trust-shield-gradient)"
    />
    {/* Shield highlight */}
    <path
      d="M12 3L5 5.5v4.5c0 4 2.7 7.8 7 8.5V3z"
      fill="rgba(255,255,255,0.2)"
    />
    {/* Check inside shield */}
    <path
      d="M10.5 13.5l-2-2-1 1 3 3 5-5-1-1z"
      fill="rgba(0,0,0,0.4)"
    />
  </svg>
);

// Export all landing icons
export const LandingIconsMap = {
  check: ComparisonCheckIcon,
  x: ComparisonXIcon,
  agent: AgentIcon3D,
  ctaArrow: CTAArrowIcon,
  speed: SpeedIcon3D,
  trustBadge: TrustBadgeIcon,
};
