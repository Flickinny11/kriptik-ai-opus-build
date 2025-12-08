/**
 * GlassInput - Premium Glass Form Input
 *
 * Form input with glass morphism styling supporting dark/light variants.
 * Features focus glow, error states, and optional icon support.
 */

import React, { useState, forwardRef } from 'react';
import { motion } from 'framer-motion';

// Glass design tokens
const GLASS_TOKENS = {
  dark: {
    bg: 'rgba(30,30,35,0.6)',
    bgFocus: 'rgba(35,35,40,0.7)',
    border: 'rgba(255,255,255,0.1)',
    borderFocus: '#c8ff64',
    borderError: '#f43f5e',
    text: 'rgba(255,255,255,0.9)',
    placeholder: 'rgba(255,255,255,0.35)',
    shadow: `
      inset 0 2px 4px rgba(0,0,0,0.2),
      0 0 0 1px rgba(255,255,255,0.05)
    `,
    shadowFocus: `
      inset 0 2px 4px rgba(0,0,0,0.15),
      0 0 0 2px rgba(200,255,100,0.2),
      0 0 20px rgba(200,255,100,0.1)
    `,
    shadowError: `
      inset 0 2px 4px rgba(0,0,0,0.15),
      0 0 0 2px rgba(244,63,94,0.2),
      0 0 20px rgba(244,63,94,0.1)
    `,
  },
  light: {
    bg: 'rgba(255,255,255,0.55)',
    bgFocus: 'rgba(255,255,255,0.65)',
    border: 'rgba(0,0,0,0.1)',
    borderFocus: '#f97316',
    borderError: '#f43f5e',
    text: '#1e1e24',
    placeholder: 'rgba(0,0,0,0.35)',
    shadow: `
      inset 0 2px 4px rgba(0,0,0,0.05),
      0 0 0 1px rgba(255,255,255,0.5)
    `,
    shadowFocus: `
      inset 0 2px 4px rgba(0,0,0,0.03),
      0 0 0 2px rgba(255,180,140,0.3),
      0 0 20px rgba(255,160,120,0.1)
    `,
    shadowError: `
      inset 0 2px 4px rgba(0,0,0,0.05),
      0 0 0 2px rgba(244,63,94,0.2),
      0 0 20px rgba(244,63,94,0.1)
    `,
  },
};

interface GlassInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'style'> {
  variant?: 'dark' | 'light';
  error?: boolean;
  errorMessage?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  label?: string;
  hint?: string;
  fullWidth?: boolean;
  inputStyle?: React.CSSProperties;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(({
  variant = 'dark',
  error = false,
  errorMessage,
  icon,
  iconPosition = 'left',
  label,
  hint,
  fullWidth = true,
  className = '',
  inputStyle,
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const tokens = GLASS_TOKENS[variant];

  const getBorderColor = () => {
    if (error) return tokens.borderError;
    if (isFocused) return tokens.borderFocus;
    return tokens.border;
  };

  const getBoxShadow = () => {
    if (error) return tokens.shadowError;
    if (isFocused) return tokens.shadowFocus;
    return tokens.shadow;
  };

  const containerStyle: React.CSSProperties = {
    width: fullWidth ? '100%' : 'auto',
  };

  const inputWrapperStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    background: isFocused ? tokens.bgFocus : tokens.bg,
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: `1px solid ${getBorderColor()}`,
    borderRadius: '12px',
    boxShadow: getBoxShadow(),
    transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
    overflow: 'hidden',
  };

  const inputElementStyle: React.CSSProperties = {
    width: '100%',
    padding: icon
      ? (iconPosition === 'left' ? '14px 16px 14px 44px' : '14px 44px 14px 16px')
      : '14px 16px',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    color: tokens.text,
    ...inputStyle,
  };

  const iconStyle: React.CSSProperties = {
    position: 'absolute',
    [iconPosition]: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: isFocused ? tokens.borderFocus : 'rgba(255,255,255,0.4)',
    transition: 'color 0.3s ease',
    pointerEvents: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '8px',
    fontSize: '13px',
    fontWeight: 500,
    color: variant === 'dark' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
  };

  const hintStyle: React.CSSProperties = {
    display: 'block',
    marginTop: '6px',
    fontSize: '12px',
    color: variant === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
  };

  const errorStyle: React.CSSProperties = {
    display: 'block',
    marginTop: '6px',
    fontSize: '12px',
    color: '#f43f5e',
  };

  return (
    <motion.div
      className={className}
      style={containerStyle}
      initial={false}
      animate={{ y: 0 }}
    >
      {label && <label style={labelStyle}>{label}</label>}

      <div style={inputWrapperStyle}>
        {icon && (
          <span style={iconStyle}>{icon}</span>
        )}
        <input
          ref={ref}
          {...props}
          style={inputElementStyle}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
        />
      </div>

      {error && errorMessage && <span style={errorStyle}>{errorMessage}</span>}
      {!error && hint && <span style={hintStyle}>{hint}</span>}
    </motion.div>
  );
});

GlassInput.displayName = 'GlassInput';

export default GlassInput;

