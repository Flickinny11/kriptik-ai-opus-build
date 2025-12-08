/**
 * GlassTextarea - Premium Glass Textarea Input
 * 
 * Multi-line text input with glass morphism styling supporting dark/light variants.
 * Features focus glow, error states, auto-resize, and character count.
 */

import React, { useState, forwardRef, useEffect, useRef } from 'react';
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

interface GlassTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'style'> {
  variant?: 'dark' | 'light';
  error?: boolean;
  errorMessage?: string;
  label?: string;
  hint?: string;
  fullWidth?: boolean;
  autoResize?: boolean;
  minRows?: number;
  maxRows?: number;
  showCharCount?: boolean;
  maxLength?: number;
  textareaStyle?: React.CSSProperties;
}

export const GlassTextarea = forwardRef<HTMLTextAreaElement, GlassTextareaProps>(({
  variant = 'dark',
  error = false,
  errorMessage,
  label,
  hint,
  fullWidth = true,
  autoResize = false,
  minRows = 3,
  maxRows = 10,
  showCharCount = false,
  maxLength,
  className = '',
  textareaStyle,
  value,
  onChange,
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const tokens = GLASS_TOKENS[variant];

  // Combine refs
  const setRefs = (element: HTMLTextAreaElement | null) => {
    textareaRef.current = element;
    if (typeof ref === 'function') {
      ref(element);
    } else if (ref) {
      ref.current = element;
    }
  };

  // Auto-resize logic
  useEffect(() => {
    if (autoResize && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24;
      const minHeight = lineHeight * minRows;
      const maxHeight = lineHeight * maxRows;
      const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  }, [value, autoResize, minRows, maxRows]);

  // Character count
  useEffect(() => {
    if (typeof value === 'string') {
      setCharCount(value.length);
    }
  }, [value]);

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

  const textareaWrapperStyle: React.CSSProperties = {
    position: 'relative',
    background: isFocused ? tokens.bgFocus : tokens.bg,
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: `1px solid ${getBorderColor()}`,
    borderRadius: '12px',
    boxShadow: getBoxShadow(),
    transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
    overflow: 'hidden',
  };

  const textareaElementStyle: React.CSSProperties = {
    width: '100%',
    minHeight: `${24 * minRows}px`,
    padding: '14px 16px',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    color: tokens.text,
    resize: autoResize ? 'none' : 'vertical',
    lineHeight: '1.6',
    ...textareaStyle,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '8px',
    fontSize: '13px',
    fontWeight: 500,
    color: variant === 'dark' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
  };

  const footerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '6px',
  };

  const hintStyle: React.CSSProperties = {
    fontSize: '12px',
    color: variant === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
  };

  const errorStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#f43f5e',
  };

  const charCountStyle: React.CSSProperties = {
    fontSize: '11px',
    color: maxLength && charCount >= maxLength 
      ? '#f43f5e' 
      : variant === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
  };

  return (
    <motion.div 
      className={className}
      style={containerStyle}
      initial={false}
    >
      {label && <label style={labelStyle}>{label}</label>}
      
      <div style={textareaWrapperStyle}>
        <textarea
          ref={setRefs}
          value={value}
          onChange={onChange}
          maxLength={maxLength}
          {...props}
          style={textareaElementStyle}
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
      
      <div style={footerStyle}>
        <div>
          {error && errorMessage && <span style={errorStyle}>{errorMessage}</span>}
          {!error && hint && <span style={hintStyle}>{hint}</span>}
        </div>
        {showCharCount && (
          <span style={charCountStyle}>
            {charCount}{maxLength ? `/${maxLength}` : ''}
          </span>
        )}
      </div>
    </motion.div>
  );
});

GlassTextarea.displayName = 'GlassTextarea';

export default GlassTextarea;

