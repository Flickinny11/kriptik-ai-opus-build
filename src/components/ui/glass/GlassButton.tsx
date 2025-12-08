/**
 * GlassButton - Premium 3D Glass Button with Interactions
 *
 * Interactive button with liquid glass styling, 3D depth, and smooth animations.
 * Supports multiple variants: primary (warm), secondary, ghost, and accent (fluorescent).
 *
 * Features:
 * - Multi-layer photorealistic shadows
 * - Warm glow on hover
 * - Glass shine sweep animation
 * - Scale interactions (hover/tap)
 * - Loading state with spinner
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';

// Button variants with premium styling
const BUTTON_VARIANTS = {
  primary: {
    bg: 'linear-gradient(145deg, rgba(255,180,150,0.7) 0%, rgba(255,160,130,0.45) 100%)',
    bgHover: 'linear-gradient(145deg, rgba(255,200,170,0.8) 0%, rgba(255,180,150,0.55) 100%)',
    border: 'rgba(255,180,140,0.4)',
    borderHover: 'rgba(255,200,160,0.6)',
    text: '#1a1a1a',
    shadow: `
      0 4px 0 rgba(200,150,120,0.5),
      0 12px 40px rgba(255,150,100,0.15),
      0 6px 20px rgba(255,130,80,0.1),
      inset 0 2px 2px rgba(255,255,255,0.7),
      inset 0 -1px 2px rgba(0,0,0,0.05)
    `,
    shadowHover: `
      0 6px 0 rgba(200,150,120,0.5),
      0 16px 50px rgba(255,150,100,0.25),
      0 8px 25px rgba(255,130,80,0.2),
      inset 0 2px 2px rgba(255,255,255,0.9),
      0 0 30px rgba(255,160,120,0.2)
    `,
    glow: 'rgba(255,180,140,0.3)',
  },
  secondary: {
    bg: 'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.4) 100%)',
    bgHover: 'linear-gradient(145deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.5) 100%)',
    border: 'rgba(255,255,255,0.5)',
    borderHover: 'rgba(255,255,255,0.7)',
    text: '#1e1e24',
    shadow: `
      0 4px 0 rgba(200,195,190,0.5),
      0 12px 40px rgba(0,0,0,0.08),
      0 4px 12px rgba(0,0,0,0.05),
      inset 0 2px 2px rgba(255,255,255,0.95),
      inset 0 -2px 2px rgba(0,0,0,0.03)
    `,
    shadowHover: `
      0 6px 0 rgba(200,195,190,0.5),
      0 16px 50px rgba(0,0,0,0.1),
      0 6px 16px rgba(0,0,0,0.06),
      inset 0 2px 2px rgba(255,255,255,1)
    `,
    glow: 'rgba(255,255,255,0.3)',
  },
  ghost: {
    bg: 'transparent',
    bgHover: 'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.15)',
    borderHover: 'rgba(255,255,255,0.25)',
    text: 'rgba(255,255,255,0.9)',
    shadow: 'none',
    shadowHover: `
      0 8px 24px rgba(0,0,0,0.15),
      inset 0 1px 0 rgba(255,255,255,0.1)
    `,
    glow: 'rgba(255,255,255,0.1)',
  },
  accent: {
    bg: 'linear-gradient(145deg, rgba(200,255,100,0.3) 0%, rgba(180,235,80,0.2) 100%)',
    bgHover: 'linear-gradient(145deg, rgba(200,255,100,0.4) 0%, rgba(180,235,80,0.3) 100%)',
    border: 'rgba(200,255,100,0.4)',
    borderHover: 'rgba(200,255,100,0.6)',
    text: '#c8ff64',
    shadow: `
      0 4px 0 rgba(150,200,60,0.3),
      0 12px 40px rgba(200,255,100,0.1),
      0 6px 20px rgba(180,235,80,0.08),
      inset 0 1px 1px rgba(255,255,255,0.2)
    `,
    shadowHover: `
      0 6px 0 rgba(150,200,60,0.3),
      0 16px 50px rgba(200,255,100,0.2),
      0 8px 25px rgba(180,235,80,0.15),
      inset 0 1px 1px rgba(255,255,255,0.3),
      0 0 30px rgba(200,255,100,0.15)
    `,
    glow: 'rgba(200,255,100,0.3)',
  },
  danger: {
    bg: 'linear-gradient(145deg, rgba(220,38,38,0.3) 0%, rgba(185,28,28,0.2) 100%)',
    bgHover: 'linear-gradient(145deg, rgba(220,38,38,0.4) 0%, rgba(185,28,28,0.3) 100%)',
    border: 'rgba(220,38,38,0.4)',
    borderHover: 'rgba(220,38,38,0.6)',
    text: '#fca5a5',
    shadow: `
      0 4px 0 rgba(150,20,20,0.3),
      0 12px 40px rgba(220,38,38,0.1),
      inset 0 1px 1px rgba(255,255,255,0.1)
    `,
    shadowHover: `
      0 6px 0 rgba(150,20,20,0.3),
      0 16px 50px rgba(220,38,38,0.2),
      0 0 30px rgba(220,38,38,0.15)
    `,
    glow: 'rgba(220,38,38,0.3)',
  },
};

const SIZE_MAP = {
  sm: {
    padding: '8px 16px',
    fontSize: '12px',
    borderRadius: '10px',
    iconSize: '14px',
  },
  md: {
    padding: '12px 24px',
    fontSize: '14px',
    borderRadius: '12px',
    iconSize: '18px',
  },
  lg: {
    padding: '16px 32px',
    fontSize: '16px',
    borderRadius: '14px',
    iconSize: '20px',
  },
};

interface GlassButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
  style?: React.CSSProperties;
}

// Loading spinner component
function LoadingSpinner({ size }: { size: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function GlassButton({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  className = '',
  icon,
  iconPosition = 'left',
  type = 'button',
  fullWidth = false,
  style,
}: GlassButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const tokens = BUTTON_VARIANTS[variant];
  const sizeTokens = SIZE_MAP[size];

  const isInteractive = !disabled && !loading;

  const buttonStyle: React.CSSProperties = {
    position: 'relative',
    display: fullWidth ? 'flex' : 'inline-flex',
    width: fullWidth ? '100%' : 'auto',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: sizeTokens.padding,
    fontSize: sizeTokens.fontSize,
    fontWeight: 500,
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    letterSpacing: '0.01em',
    color: disabled ? 'rgba(255,255,255,0.3)' : tokens.text,
    background: disabled ? 'rgba(100,100,100,0.2)' : (isHovered && isInteractive ? tokens.bgHover : tokens.bg),
    border: `1px solid ${disabled ? 'rgba(100,100,100,0.2)' : (isHovered && isInteractive ? tokens.borderHover : tokens.border)}`,
    borderRadius: sizeTokens.borderRadius,
    boxShadow: disabled ? 'none' : (isHovered && isInteractive ? tokens.shadowHover : tokens.shadow),
    cursor: disabled ? 'not-allowed' : loading ? 'wait' : 'pointer',
    overflow: 'hidden',
    transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
    backdropFilter: variant !== 'ghost' ? 'blur(20px) saturate(180%)' : 'none',
    WebkitBackdropFilter: variant !== 'ghost' ? 'blur(20px) saturate(180%)' : 'none',
    ...style,
  };

  return (
    <motion.button
      type={type}
      className={className}
      style={buttonStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={isInteractive ? onClick : undefined}
      disabled={disabled || loading}
      whileHover={isInteractive ? { scale: 1.02, y: -2 } : undefined}
      whileTap={isInteractive ? { scale: 0.98, y: 0 } : undefined}
      transition={{ duration: 0.2 }}
    >
      {/* Glass shine sweep */}
      {isInteractive && variant !== 'ghost' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: isHovered ? '150%' : '-100%',
            width: '50%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
            transform: 'skewX(-20deg)',
            transition: 'left 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Content */}
      <span style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        opacity: loading ? 0.5 : 1,
        transition: 'opacity 0.2s',
      }}>
        {loading ? (
          <LoadingSpinner size={sizeTokens.iconSize} />
        ) : (
          <>
            {icon && iconPosition === 'left' && (
              <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
            )}
            {children}
            {icon && iconPosition === 'right' && (
              <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
            )}
          </>
        )}
      </span>

      {/* Keyframe animation for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </motion.button>
  );
}

export default GlassButton;

