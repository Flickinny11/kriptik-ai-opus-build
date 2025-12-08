/**
 * TabNav - Premium Tab Navigation
 * 
 * A styled tab navigation component with glass morphism styling
 * and smooth indicator animations.
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

interface TabNavProps {
  tabs: Tab[];
  activeTabId?: string;
  onTabChange?: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
}

const SIZE_CONFIG = {
  sm: { padding: '6px 12px', fontSize: '12px', iconSize: '14px' },
  md: { padding: '10px 18px', fontSize: '13px', iconSize: '16px' },
  lg: { padding: '12px 24px', fontSize: '14px', iconSize: '18px' },
};

export function TabNav({
  tabs,
  activeTabId,
  onTabChange,
  variant = 'default',
  size = 'md',
  fullWidth = false,
  className = '',
}: TabNavProps) {
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const sizeConfig = SIZE_CONFIG[size];

  // Update indicator position
  useEffect(() => {
    if (!activeTabId || !containerRef.current) return;
    
    const activeTab = tabRefs.current.get(activeTabId);
    if (!activeTab) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();

    setIndicatorStyle({
      left: tabRect.left - containerRect.left,
      width: tabRect.width,
    });
  }, [activeTabId, tabs]);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: variant === 'pills' ? '8px' : '4px',
    padding: variant === 'default' ? '4px' : '0',
    borderRadius: variant === 'default' ? '12px' : '0',
    background: variant === 'default' ? 'rgba(255,255,255,0.03)' : 'transparent',
    border: variant === 'default' ? '1px solid rgba(255,255,255,0.05)' : 'none',
    position: 'relative',
    width: fullWidth ? '100%' : 'auto',
  };

  const getTabStyle = (isActive: boolean, isDisabled: boolean): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: sizeConfig.padding,
      fontSize: sizeConfig.fontSize,
      fontWeight: 500,
      color: isDisabled 
        ? 'rgba(255,255,255,0.3)'
        : isActive 
          ? variant === 'underline' ? '#c8ff64' : 'rgba(255,255,255,0.95)'
          : 'rgba(255,255,255,0.6)',
      background: 'transparent',
      border: 'none',
      borderRadius: variant === 'pills' ? '8px' : variant === 'default' ? '8px' : '0',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      transition: 'color 0.2s ease',
      position: 'relative',
      zIndex: 1,
      flex: fullWidth ? 1 : 'none',
      whiteSpace: 'nowrap',
    };

    if (variant === 'pills' && isActive) {
      base.background = 'rgba(200,255,100,0.15)';
      base.border = '1px solid rgba(200,255,100,0.2)';
    }

    return base;
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
    >
      {/* Sliding indicator for default variant */}
      {variant === 'default' && activeTabId && (
        <motion.div
          layoutId="tabIndicator"
          style={{
            position: 'absolute',
            top: '4px',
            bottom: '4px',
            borderRadius: '8px',
            background: 'linear-gradient(145deg, rgba(200,255,100,0.2) 0%, rgba(200,255,100,0.1) 100%)',
            border: '1px solid rgba(200,255,100,0.2)',
            boxShadow: 'inset 0 0 15px rgba(200,255,100,0.05)',
            ...indicatorStyle,
          }}
          transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        />
      )}

      {/* Tabs */}
      {tabs.map(tab => {
        const isActive = tab.id === activeTabId;
        
        return (
          <motion.button
            key={tab.id}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.id, el);
            }}
            style={getTabStyle(isActive, !!tab.disabled)}
            onClick={() => !tab.disabled && onTabChange?.(tab.id)}
            whileHover={!tab.disabled ? { 
              color: 'rgba(255,255,255,0.9)',
            } : undefined}
            whileTap={!tab.disabled ? { scale: 0.98 } : undefined}
          >
            {tab.icon && (
              <span style={{ 
                display: 'flex', 
                alignItems: 'center',
                fontSize: sizeConfig.iconSize,
              }}>
                {tab.icon}
              </span>
            )}
            {tab.label}
            {tab.badge && (
              <span style={{
                padding: '2px 6px',
                borderRadius: '6px',
                fontSize: '10px',
                fontWeight: 600,
                background: 'rgba(200,255,100,0.15)',
                color: '#c8ff64',
                marginLeft: '4px',
              }}>
                {tab.badge}
              </span>
            )}
            
            {/* Underline indicator */}
            {variant === 'underline' && isActive && (
              <motion.div
                layoutId="underlineIndicator"
                style={{
                  position: 'absolute',
                  bottom: '0',
                  left: '0',
                  right: '0',
                  height: '2px',
                  background: '#c8ff64',
                  borderRadius: '2px',
                  boxShadow: '0 0 8px rgba(200,255,100,0.5)',
                }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

export default TabNav;

