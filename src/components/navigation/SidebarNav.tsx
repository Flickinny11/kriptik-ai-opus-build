/**
 * SidebarNav - Premium Glass Sidebar Navigation
 *
 * A feature-rich sidebar navigation with glass morphism styling,
 * collapsible sections, and smooth animations.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  href?: string;
  badge?: string | number;
  badgeColor?: 'accent' | 'warning' | 'error' | 'info';
  children?: NavItem[];
  disabled?: boolean;
  onClick?: () => void;
}

interface SidebarNavProps {
  items: NavItem[];
  activeId?: string;
  onNavigate?: (item: NavItem) => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  collapsed?: boolean;
  className?: string;
}

const BADGE_COLORS = {
  accent: { bg: 'rgba(200,255,100,0.15)', text: '#c8ff64', border: 'rgba(200,255,100,0.3)' },
  warning: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  error: { bg: 'rgba(244,63,94,0.15)', text: '#f43f5e', border: 'rgba(244,63,94,0.3)' },
  info: { bg: 'rgba(6,182,212,0.15)', text: '#06b6d4', border: 'rgba(6,182,212,0.3)' },
};

export function SidebarNav({
  items,
  activeId,
  onNavigate,
  header,
  footer,
  collapsed = false,
  className = '',
}: SidebarNavProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  const toggleSection = (id: string) => {
    setExpandedSections(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleItemClick = (item: NavItem) => {
    if (item.disabled) return;

    if (item.children && item.children.length > 0) {
      toggleSection(item.id);
    } else {
      item.onClick?.();
      onNavigate?.(item);
    }
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: collapsed ? '16px 8px' : '16px',
  };

  const navStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  return (
    <nav className={className} style={containerStyle}>
      {/* Header */}
      {header && (
        <div style={{ marginBottom: '20px' }}>
          {header}
        </div>
      )}

      {/* Navigation items */}
      <div style={navStyle}>
        {items.map(item => (
          <NavItemComponent
            key={item.id}
            item={item}
            isActive={activeId === item.id}
            isExpanded={expandedSections.includes(item.id)}
            collapsed={collapsed}
            onItemClick={handleItemClick}
            activeId={activeId}
          />
        ))}
      </div>

      {/* Footer */}
      {footer && (
        <div style={{ marginTop: '20px' }}>
          {footer}
        </div>
      )}
    </nav>
  );
}

// ============================================
// Nav Item Component
// ============================================

interface NavItemComponentProps {
  item: NavItem;
  isActive: boolean;
  isExpanded: boolean;
  collapsed: boolean;
  onItemClick: (item: NavItem) => void;
  activeId?: string;
  depth?: number;
}

function NavItemComponent({
  item,
  isActive,
  isExpanded,
  collapsed,
  onItemClick,
  activeId,
  depth = 0,
}: NavItemComponentProps) {
  const [isHovered, setIsHovered] = useState(false);
  const hasChildren = item.children && item.children.length > 0;
  const badgeConfig = item.badge && item.badgeColor ? BADGE_COLORS[item.badgeColor] : BADGE_COLORS.accent;

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: collapsed ? '0' : '12px',
    padding: collapsed ? '12px' : '10px 14px',
    marginLeft: collapsed ? '0' : `${depth * 12}px`,
    borderRadius: '10px',
    cursor: item.disabled ? 'not-allowed' : 'pointer',
    opacity: item.disabled ? 0.4 : 1,
    background: isActive
      ? 'linear-gradient(145deg, rgba(200,255,100,0.15) 0%, rgba(200,255,100,0.05) 100%)'
      : isHovered
        ? 'rgba(255,255,255,0.05)'
        : 'transparent',
    border: isActive
      ? '1px solid rgba(200,255,100,0.2)'
      : '1px solid transparent',
    boxShadow: isActive
      ? 'inset 0 0 20px rgba(200,255,100,0.05)'
      : 'none',
    transition: 'all 0.2s ease',
    justifyContent: collapsed ? 'center' : 'flex-start',
    position: 'relative',
  };

  const iconStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    color: isActive ? '#c8ff64' : 'rgba(255,255,255,0.6)',
    flexShrink: 0,
    transition: 'color 0.2s ease',
  };

  const labelStyle: React.CSSProperties = {
    flex: 1,
    fontSize: '13px',
    fontWeight: isActive ? 500 : 400,
    color: isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const badgeStyle: React.CSSProperties = {
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: 600,
    background: badgeConfig.bg,
    color: badgeConfig.text,
    border: `1px solid ${badgeConfig.border}`,
  };

  return (
    <>
      <motion.div
        style={itemStyle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => onItemClick(item)}
        whileTap={!item.disabled ? { scale: 0.98 } : undefined}
      >
        {/* Active indicator */}
        {isActive && (
          <motion.div
            layoutId="activeIndicator"
            style={{
              position: 'absolute',
              left: '0',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '3px',
              height: '60%',
              borderRadius: '0 3px 3px 0',
              background: '#c8ff64',
              boxShadow: '0 0 8px rgba(200,255,100,0.5)',
            }}
          />
        )}

        {/* Icon */}
        {item.icon && (
          <span style={iconStyle}>
            {item.icon}
          </span>
        )}

        {/* Label */}
        {!collapsed && (
          <>
            <span style={labelStyle}>{item.label}</span>

            {/* Badge */}
            {item.badge && (
              <span style={badgeStyle}>{item.badge}</span>
            )}

            {/* Expand/collapse arrow for parent items */}
            {hasChildren && (
              <motion.svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{
                  color: 'rgba(255,255,255,0.4)',
                }}
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <polyline points="6 9 12 15 18 9" />
              </motion.svg>
            )}
          </>
        )}
      </motion.div>

      {/* Children */}
      {!collapsed && hasChildren && (
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              {item.children!.map(child => (
                <NavItemComponent
                  key={child.id}
                  item={child}
                  isActive={activeId === child.id}
                  isExpanded={false}
                  collapsed={collapsed}
                  onItemClick={onItemClick}
                  activeId={activeId}
                  depth={depth + 1}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </>
  );
}

export default SidebarNav;

