/**
 * GlassBadge - Premium Glass Status Badge
 * 
 * Status badge with glass morphism styling and multiple variants.
 * Features pulse animation for live/active states.
 */

import React from 'react';
import { motion } from 'framer-motion';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'accent' | 'live';

interface GlassBadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  pulse?: boolean;
  className?: string;
}

const VARIANT_STYLES: Record<BadgeVariant, {
  bg: string;
  border: string;
  text: string;
  glow?: string;
}> = {
  default: {
    bg: 'rgba(255,255,255,0.1)',
    border: 'rgba(255,255,255,0.15)',
    text: 'rgba(255,255,255,0.8)',
  },
  success: {
    bg: 'rgba(16,185,129,0.15)',
    border: 'rgba(16,185,129,0.3)',
    text: '#10b981',
    glow: 'rgba(16,185,129,0.2)',
  },
  warning: {
    bg: 'rgba(245,158,11,0.15)',
    border: 'rgba(245,158,11,0.3)',
    text: '#f59e0b',
    glow: 'rgba(245,158,11,0.2)',
  },
  error: {
    bg: 'rgba(244,63,94,0.15)',
    border: 'rgba(244,63,94,0.3)',
    text: '#f43f5e',
    glow: 'rgba(244,63,94,0.2)',
  },
  info: {
    bg: 'rgba(6,182,212,0.15)',
    border: 'rgba(6,182,212,0.3)',
    text: '#06b6d4',
    glow: 'rgba(6,182,212,0.2)',
  },
  accent: {
    bg: 'rgba(200,255,100,0.15)',
    border: 'rgba(200,255,100,0.3)',
    text: '#c8ff64',
    glow: 'rgba(200,255,100,0.2)',
  },
  live: {
    bg: 'rgba(16,185,129,0.15)',
    border: 'rgba(16,185,129,0.4)',
    text: '#10b981',
    glow: 'rgba(16,185,129,0.3)',
  },
};

const SIZE_MAP = {
  sm: { padding: '4px 8px', fontSize: '10px', gap: '4px', dotSize: 6 },
  md: { padding: '6px 12px', fontSize: '12px', gap: '6px', dotSize: 8 },
  lg: { padding: '8px 16px', fontSize: '14px', gap: '8px', dotSize: 10 },
};

export function GlassBadge({
  children,
  variant = 'default',
  size = 'md',
  icon,
  pulse = false,
  className = '',
}: GlassBadgeProps) {
  const variantTokens = VARIANT_STYLES[variant];
  const sizeTokens = SIZE_MAP[size];
  const shouldPulse = pulse || variant === 'live';

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: sizeTokens.gap,
    padding: sizeTokens.padding,
    fontSize: sizeTokens.fontSize,
    fontWeight: 500,
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    letterSpacing: '0.02em',
    color: variantTokens.text,
    background: variantTokens.bg,
    border: `1px solid ${variantTokens.border}`,
    borderRadius: '50px',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    boxShadow: variantTokens.glow ? `0 0 20px ${variantTokens.glow}` : 'none',
    whiteSpace: 'nowrap',
  };

  const dotStyle: React.CSSProperties = {
    width: sizeTokens.dotSize,
    height: sizeTokens.dotSize,
    borderRadius: '50%',
    background: variantTokens.text,
  };

  return (
    <span className={className} style={badgeStyle}>
      {variant === 'live' && (
        <span style={{ position: 'relative' }}>
          <span style={dotStyle} />
          {shouldPulse && (
            <motion.span
              style={{
                position: 'absolute',
                inset: -2,
                borderRadius: '50%',
                border: `2px solid ${variantTokens.text}`,
              }}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.8, 0, 0.8],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          )}
        </span>
      )}
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </span>
  );
}

export default GlassBadge;

