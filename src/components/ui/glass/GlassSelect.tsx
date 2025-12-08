/**
 * GlassSelect - Premium Glass Dropdown Select
 *
 * Custom select dropdown with glass morphism styling supporting dark/light variants.
 * Features animated dropdown, keyboard navigation, and search functionality.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Glass design tokens
const GLASS_TOKENS = {
  dark: {
    bg: 'rgba(30,30,35,0.6)',
    bgFocus: 'rgba(35,35,40,0.7)',
    bgDropdown: 'linear-gradient(145deg, rgba(25,25,30,0.98) 0%, rgba(18,18,22,0.99) 100%)',
    bgOptionHover: 'rgba(200,255,100,0.1)',
    border: 'rgba(255,255,255,0.1)',
    borderFocus: '#c8ff64',
    text: 'rgba(255,255,255,0.9)',
    textMuted: 'rgba(255,255,255,0.4)',
    shadow: `
      inset 0 2px 4px rgba(0,0,0,0.2),
      0 0 0 1px rgba(255,255,255,0.05)
    `,
    shadowFocus: `
      inset 0 2px 4px rgba(0,0,0,0.15),
      0 0 0 2px rgba(200,255,100,0.2)
    `,
    shadowDropdown: `
      0 20px 60px rgba(0,0,0,0.5),
      0 10px 30px rgba(0,0,0,0.4),
      0 0 0 1px rgba(255,255,255,0.08)
    `,
  },
  light: {
    bg: 'rgba(255,255,255,0.55)',
    bgFocus: 'rgba(255,255,255,0.65)',
    bgDropdown: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,248,250,0.98) 100%)',
    bgOptionHover: 'rgba(255,180,140,0.15)',
    border: 'rgba(0,0,0,0.1)',
    borderFocus: '#f97316',
    text: '#1e1e24',
    textMuted: 'rgba(0,0,0,0.4)',
    shadow: `
      inset 0 2px 4px rgba(0,0,0,0.05),
      0 0 0 1px rgba(255,255,255,0.5)
    `,
    shadowFocus: `
      inset 0 2px 4px rgba(0,0,0,0.03),
      0 0 0 2px rgba(255,180,140,0.3)
    `,
    shadowDropdown: `
      0 20px 60px rgba(0,0,0,0.15),
      0 10px 30px rgba(0,0,0,0.1),
      0 0 0 1px rgba(0,0,0,0.05)
    `,
  },
};

interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface GlassSelectProps {
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variant?: 'dark' | 'light';
  label?: string;
  hint?: string;
  error?: boolean;
  errorMessage?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  searchable?: boolean;
  className?: string;
}

// Chevron icon
function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{
        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// Check icon
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function GlassSelect({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  variant = 'dark',
  label,
  hint,
  error = false,
  errorMessage,
  disabled = false,
  fullWidth = true,
  searchable = false,
  className = '',
}: GlassSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tokens = GLASS_TOKENS[variant];

  const selectedOption = options.find(opt => opt.value === value);

  const filteredOptions = searchable && searchQuery
    ? options.filter(opt =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        opt.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0) {
          const option = filteredOptions[highlightedIndex];
          if (!option.disabled) {
            onChange(option.value);
            setIsOpen(false);
            setSearchQuery('');
          }
        } else {
          setIsOpen(true);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex(prev =>
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchQuery('');
        break;
    }
  }, [disabled, isOpen, highlightedIndex, filteredOptions, onChange]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: fullWidth ? '100%' : 'auto',
  };

  const triggerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    width: '100%',
    padding: '14px 16px',
    background: isOpen ? tokens.bgFocus : tokens.bg,
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: `1px solid ${isOpen ? tokens.borderFocus : tokens.border}`,
    borderRadius: '12px',
    boxShadow: isOpen ? tokens.shadowFocus : tokens.shadow,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
    outline: 'none',
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: 0,
    right: 0,
    zIndex: 100,
    background: tokens.bgDropdown,
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    border: `1px solid ${tokens.border}`,
    borderRadius: '12px',
    boxShadow: tokens.shadowDropdown,
    overflow: 'hidden',
    maxHeight: '280px',
    overflowY: 'auto',
  };

  const optionStyle = (isHighlighted: boolean, _isSelected: boolean, isDisabled: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '12px 16px',
    background: isHighlighted ? tokens.bgOptionHover : 'transparent',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
    transition: 'background 0.15s ease',
  });

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
    color: tokens.textMuted,
  };

  const errorStyle: React.CSSProperties = {
    display: 'block',
    marginTop: '6px',
    fontSize: '12px',
    color: '#f43f5e',
  };

  return (
    <div ref={containerRef} className={className} style={containerStyle}>
      {label && <label style={labelStyle}>{label}</label>}

      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        style={triggerStyle}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          {selectedOption?.icon && selectedOption.icon}
          <span style={{
            color: selectedOption ? tokens.text : tokens.textMuted,
            fontSize: '14px',
          }}>
            {selectedOption?.label || placeholder}
          </span>
        </div>
        <ChevronIcon isOpen={isOpen} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={dropdownStyle}
          >
            {/* Search input */}
            {searchable && (
              <div style={{ padding: '8px', borderBottom: `1px solid ${tokens.border}` }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${tokens.border}`,
                    borderRadius: '8px',
                    color: tokens.text,
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>
            )}

            {/* Options */}
            <div style={{ padding: '4px 0' }}>
              {filteredOptions.length === 0 ? (
                <div style={{ padding: '12px 16px', color: tokens.textMuted, fontSize: '13px' }}>
                  No options found
                </div>
              ) : (
                filteredOptions.map((option, index) => {
                  const isSelected = option.value === value;
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <div
                      key={option.value}
                      role="option"
                      aria-selected={isSelected}
                      style={optionStyle(isHighlighted, isSelected, !!option.disabled)}
                      onClick={() => {
                        if (!option.disabled) {
                          onChange(option.value);
                          setIsOpen(false);
                          setSearchQuery('');
                        }
                      }}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {option.icon && option.icon}
                        <div>
                          <div style={{ color: tokens.text, fontSize: '14px' }}>
                            {option.label}
                          </div>
                          {option.description && (
                            <div style={{ color: tokens.textMuted, fontSize: '12px', marginTop: '2px' }}>
                              {option.description}
                            </div>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <span style={{ color: '#c8ff64' }}>
                          <CheckIcon />
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && errorMessage && <span style={errorStyle}>{errorMessage}</span>}
      {!error && hint && <span style={hintStyle}>{hint}</span>}
    </div>
  );
}

export default GlassSelect;

