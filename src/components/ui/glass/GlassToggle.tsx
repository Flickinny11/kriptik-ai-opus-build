/**
 * GlassToggle - Premium Glass Toggle Switch
 * 
 * Toggle switch with glass morphism styling supporting dark/light variants.
 * Features smooth spring animation and customizable accent colors.
 */

import React from 'react';
import { motion } from 'framer-motion';

interface GlassToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  label?: string;
  description?: string;
  className?: string;
}

const SIZE_MAP = {
  sm: { width: 36, height: 20, thumbSize: 14, padding: 3 },
  md: { width: 44, height: 24, thumbSize: 18, padding: 3 },
  lg: { width: 52, height: 28, thumbSize: 22, padding: 3 },
};

export function GlassToggle({
  checked,
  onChange,
  variant = 'dark',
  size = 'md',
  disabled = false,
  label,
  description,
  className = '',
}: GlassToggleProps) {
  const sizeTokens = SIZE_MAP[size];

  const trackStyle: React.CSSProperties = {
    position: 'relative',
    width: sizeTokens.width,
    height: sizeTokens.height,
    borderRadius: sizeTokens.height / 2,
    padding: sizeTokens.padding,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    background: checked
      ? 'linear-gradient(145deg, rgba(200,255,100,0.4) 0%, rgba(180,235,80,0.3) 100%)'
      : variant === 'dark'
        ? 'rgba(50,50,55,0.8)'
        : 'rgba(200,200,205,0.6)',
    border: checked
      ? '1px solid rgba(200,255,100,0.5)'
      : variant === 'dark'
        ? '1px solid rgba(255,255,255,0.1)'
        : '1px solid rgba(0,0,0,0.1)',
    boxShadow: checked
      ? `
        inset 0 1px 2px rgba(0,0,0,0.1),
        0 0 20px rgba(200,255,100,0.2)
      `
      : `
        inset 0 2px 4px rgba(0,0,0,0.2),
        0 0 0 1px rgba(255,255,255,0.05)
      `,
    transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
  };

  const thumbStyle: React.CSSProperties = {
    width: sizeTokens.thumbSize,
    height: sizeTokens.thumbSize,
    borderRadius: '50%',
    background: checked
      ? 'linear-gradient(145deg, #c8ff64 0%, #b0e850 100%)'
      : variant === 'dark'
        ? 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(240,240,245,0.85) 100%)'
        : 'linear-gradient(145deg, #ffffff 0%, #f0f0f5 100%)',
    boxShadow: checked
      ? `
        0 2px 8px rgba(0,0,0,0.15),
        0 1px 3px rgba(0,0,0,0.1),
        inset 0 1px 0 rgba(255,255,255,0.5)
      `
      : `
        0 2px 8px rgba(0,0,0,0.15),
        0 1px 3px rgba(0,0,0,0.1),
        inset 0 1px 0 rgba(255,255,255,0.8)
      `,
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  };

  const labelContainerStyle: React.CSSProperties = {
    flex: 1,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: variant === 'dark' ? 'rgba(255,255,255,0.9)' : '#1e1e24',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };

  const descriptionStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    color: variant === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
    marginTop: '2px',
  };

  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const toggleElement = (
    <div
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      style={trackStyle}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <motion.div
        style={thumbStyle}
        animate={{
          x: checked ? sizeTokens.width - sizeTokens.thumbSize - sizeTokens.padding * 2 : 0,
        }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 30,
        }}
      />
    </div>
  );

  if (!label) {
    return <div className={className}>{toggleElement}</div>;
  }

  return (
    <div className={className} style={containerStyle}>
      <div style={labelContainerStyle} onClick={handleClick}>
        <span style={labelStyle}>{label}</span>
        {description && <span style={descriptionStyle}>{description}</span>}
      </div>
      {toggleElement}
    </div>
  );
}

export default GlassToggle;

