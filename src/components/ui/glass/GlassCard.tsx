/**
 * GlassCard - Premium 3D Glass Card with Hover Effects
 * 
 * Interactive content card with liquid glass styling and premium hover effects.
 * Features warm glow on hover, 3D transform, and glass shine animation.
 * 
 * Inspired by ProjectCard3D but as a reusable component.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';

// Glass design tokens
const GLASS_TOKENS = {
  dark: {
    bg: 'linear-gradient(145deg, rgba(30,30,35,0.95) 0%, rgba(20,20,25,0.98) 100%)',
    border: 'rgba(255,255,255,0.08)',
    borderHover: 'rgba(200,255,100,0.3)',
    shadowBase: `
      inset 0 1px 2px rgba(255,255,255,0.05),
      0 20px 50px rgba(0,0,0,0.4),
      0 10px 25px rgba(0,0,0,0.3),
      0 0 0 1px rgba(255,255,255,0.05)
    `,
    shadowHover: `
      inset 0 0 40px rgba(200,255,100,0.08),
      inset 0 1px 2px rgba(255,255,255,0.08),
      0 25px 60px rgba(0,0,0,0.45),
      0 15px 35px rgba(200,255,100,0.1),
      0 0 0 1px rgba(200,255,100,0.2)
    `,
  },
  light: {
    bg: 'linear-gradient(145deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.45) 100%)',
    border: 'rgba(255,255,255,0.5)',
    borderHover: 'rgba(255,180,140,0.5)',
    shadowBase: `
      inset 0 2px 4px rgba(255,255,255,0.9),
      inset 0 -2px 4px rgba(0,0,0,0.03),
      0 25px 60px rgba(0,0,0,0.12),
      0 10px 30px rgba(0,0,0,0.08),
      0 0 0 1px rgba(255,255,255,0.6)
    `,
    shadowHover: `
      inset 0 0 60px rgba(255,180,140,0.25),
      inset 0 2px 4px rgba(255,255,255,0.95),
      0 20px 60px rgba(255,150,100,0.2),
      0 30px 80px rgba(0,0,0,0.15),
      0 0 0 1px rgba(255,220,200,0.5)
    `,
  },
  blur: 'blur(40px) saturate(180%)',
};

interface GlassCardProps {
  children: React.ReactNode;
  variant?: 'dark' | 'light';
  hoverable?: boolean;
  onClick?: () => void;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  rounded?: 'md' | 'lg' | 'xl' | '2xl';
  style?: React.CSSProperties;
}

const PADDING_MAP = {
  none: '0',
  sm: '12px',
  md: '20px',
  lg: '28px',
};

const ROUNDED_MAP = {
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
};

export function GlassCard({
  children,
  variant = 'dark',
  hoverable = true,
  onClick,
  className = '',
  padding = 'md',
  rounded = 'xl',
  style,
}: GlassCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const tokens = GLASS_TOKENS[variant];

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    background: tokens.bg,
    backdropFilter: GLASS_TOKENS.blur,
    WebkitBackdropFilter: GLASS_TOKENS.blur,
    border: `1px solid ${isHovered && hoverable ? tokens.borderHover : tokens.border}`,
    borderRadius: ROUNDED_MAP[rounded],
    boxShadow: isHovered && hoverable ? tokens.shadowHover : tokens.shadowBase,
    padding: PADDING_MAP[padding],
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
    transform: isHovered && hoverable ? 'translateY(-4px) scale(1.01)' : 'translateY(0) scale(1)',
    ...style,
  };

  return (
    <motion.div
      className={className}
      style={cardStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      whileTap={onClick ? { scale: 0.98 } : undefined}
    >
      {/* Light refraction effect */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: variant === 'light'
            ? `
              radial-gradient(ellipse 80% 50% at 20% 20%, rgba(255,255,255,0.3) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 80%, rgba(255,255,255,0.15) 0%, transparent 40%)
            `
            : `
              radial-gradient(ellipse 60% 40% at 10% 10%, rgba(255,255,255,0.04) 0%, transparent 50%)
            `,
          opacity: isHovered ? 0.8 : 0.5,
          transition: 'opacity 0.5s ease',
          pointerEvents: 'none',
        }}
      />

      {/* Glass shine sweep animation */}
      {hoverable && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: isHovered ? '150%' : '-100%',
            width: '60%',
            height: '100%',
            background: variant === 'light'
              ? 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)'
              : 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
            transform: 'skewX(-25deg)',
            transition: 'left 0.7s cubic-bezier(0.23, 1, 0.32, 1)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Top edge highlight */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: variant === 'light'
            ? 'linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.7) 50%, transparent 90%)'
            : 'linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.1) 50%, transparent 90%)',
          borderRadius: `${ROUNDED_MAP[rounded]} ${ROUNDED_MAP[rounded]} 0 0`,
          pointerEvents: 'none',
        }}
      />

      {/* Inner glow ring on hover */}
      {hoverable && isHovered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'absolute',
            inset: '2px',
            borderRadius: `calc(${ROUNDED_MAP[rounded]} - 2px)`,
            border: variant === 'light' 
              ? '1px solid rgba(255,180,140,0.3)'
              : '1px solid rgba(200,255,100,0.15)',
            boxShadow: variant === 'light'
              ? 'inset 0 0 20px rgba(255,160,120,0.1)'
              : 'inset 0 0 20px rgba(200,255,100,0.05)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </motion.div>
  );
}

export default GlassCard;

