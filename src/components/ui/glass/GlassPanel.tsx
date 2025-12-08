/**
 * GlassPanel - Premium Frosted Glass Container
 *
 * Base container component with dark/light glass morphism styling.
 * Supports multiple padding sizes, rounded corners, glow effects, and border options.
 *
 * Dark variant: Inspired by DeveloperModeSettings panel
 * Light variant: Inspired by ProjectCard3D liquid glass
 */

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

// Glass design tokens
const GLASS_TOKENS = {
  dark: {
    bg: 'linear-gradient(145deg, rgba(20,20,25,0.98) 0%, rgba(12,12,16,0.99) 100%)',
    bgSubtle: 'linear-gradient(145deg, rgba(25,25,30,0.95) 0%, rgba(15,15,20,0.98) 100%)',
    border: 'rgba(255,255,255,0.08)',
    borderHover: 'rgba(200,255,100,0.3)',
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.6)',
  },
  light: {
    bg: 'linear-gradient(145deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.45) 100%)',
    bgSubtle: 'linear-gradient(145deg, rgba(255,255,255,0.55) 0%, rgba(248,250,252,0.5) 100%)',
    border: 'rgba(255,255,255,0.4)',
    borderHover: 'rgba(255,180,140,0.5)',
    text: '#1e1e24',
    textMuted: 'rgba(0,0,0,0.6)',
  },
  blur: 'blur(40px) saturate(180%)',
  glowAccent: 'rgba(200,255,100,0.3)',
  glowAmber: 'rgba(255,150,100,0.2)',
  glowCyan: 'rgba(6,182,212,0.2)',
};

const PADDING_MAP = {
  none: '0',
  sm: '12px',
  md: '20px',
  lg: '32px',
};

const ROUNDED_MAP = {
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
};

interface GlassPanelProps extends Omit<HTMLMotionProps<'div'>, 'style'> {
  children: React.ReactNode;
  variant?: 'dark' | 'light';
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  rounded?: 'md' | 'lg' | 'xl' | '2xl';
  glow?: 'none' | 'accent' | 'amber' | 'cyan';
  border?: boolean;
  subtle?: boolean;
  style?: React.CSSProperties;
}

export function GlassPanel({
  children,
  variant = 'dark',
  className = '',
  padding = 'md',
  rounded = 'xl',
  glow = 'none',
  border = true,
  subtle = false,
  style,
  ...motionProps
}: GlassPanelProps) {
  const tokens = GLASS_TOKENS[variant];

  // Build glow shadow
  const getGlowShadow = () => {
    switch (glow) {
      case 'accent':
        return `0 0 60px ${GLASS_TOKENS.glowAccent}, 0 0 30px ${GLASS_TOKENS.glowAccent}`;
      case 'amber':
        return `0 0 60px ${GLASS_TOKENS.glowAmber}, 0 0 30px ${GLASS_TOKENS.glowAmber}`;
      case 'cyan':
        return `0 0 60px ${GLASS_TOKENS.glowCyan}, 0 0 30px ${GLASS_TOKENS.glowCyan}`;
      default:
        return 'none';
    }
  };

  // Build box shadow
  const baseShadow = variant === 'dark'
    ? `
      0 30px 80px rgba(0,0,0,0.5),
      0 15px 40px rgba(0,0,0,0.4),
      inset 0 1px 0 rgba(255,255,255,0.05),
      0 0 0 1px rgba(255,255,255,0.05)
    `
    : `
      0 25px 60px rgba(0,0,0,0.12),
      0 10px 30px rgba(0,0,0,0.08),
      inset 0 2px 4px rgba(255,255,255,0.9),
      0 0 0 1px rgba(255,255,255,0.6)
    `;

  const glowShadow = getGlowShadow();
  const combinedShadow = glow !== 'none'
    ? `${baseShadow}, ${glowShadow}`
    : baseShadow;

  const panelStyle: React.CSSProperties = {
    background: subtle ? tokens.bgSubtle : tokens.bg,
    backdropFilter: GLASS_TOKENS.blur,
    WebkitBackdropFilter: GLASS_TOKENS.blur,
    boxShadow: combinedShadow,
    border: border ? `1px solid ${tokens.border}` : 'none',
    borderRadius: ROUNDED_MAP[rounded],
    padding: PADDING_MAP[padding],
    color: tokens.text,
    ...style,
  };

  return (
    <motion.div
      className={className}
      style={panelStyle}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}

export default GlassPanel;

