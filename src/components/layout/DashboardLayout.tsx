/**
 * DashboardLayout - Premium Full Dashboard Layout
 * 
 * Complete dashboard layout with sidebar, header, and main content area.
 * Features glass morphism styling and responsive behavior.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  sidebarWidth?: number;
  collapsedSidebarWidth?: number;
  defaultCollapsed?: boolean;
  onSidebarToggle?: (collapsed: boolean) => void;
  className?: string;
}

export function DashboardLayout({
  children,
  sidebar,
  header,
  sidebarWidth = 280,
  collapsedSidebarWidth = 72,
  defaultCollapsed = false,
  onSidebarToggle,
  className = '',
}: DashboardLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(defaultCollapsed);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  const handleToggle = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    onSidebarToggle?.(newState);
  };

  const currentSidebarWidth = isSidebarCollapsed 
    ? (isSidebarHovered ? sidebarWidth : collapsedSidebarWidth)
    : sidebarWidth;

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    background: 'linear-gradient(135deg, #0a0a0c 0%, #121218 50%, #0f0f12 100%)',
  };

  const sidebarStyle: React.CSSProperties = {
    position: 'relative',
    height: '100%',
    flexShrink: 0,
    borderRight: '1px solid rgba(255,255,255,0.05)',
    background: 'linear-gradient(180deg, rgba(20,20,25,0.95) 0%, rgba(15,15,18,0.98) 100%)',
    backdropFilter: 'blur(40px)',
    WebkitBackdropFilter: 'blur(40px)',
    boxShadow: '4px 0 30px rgba(0,0,0,0.3)',
    zIndex: 100,
    overflow: 'hidden',
  };

  const mainStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
  };

  const headerStyle: React.CSSProperties = {
    flexShrink: 0,
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    background: 'rgba(15,15,18,0.8)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: '24px',
  };

  return (
    <div className={className} style={containerStyle}>
      {/* Sidebar */}
      {sidebar && (
        <motion.aside
          style={sidebarStyle}
          animate={{ width: currentSidebarWidth }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          onMouseEnter={() => isSidebarCollapsed && setIsSidebarHovered(true)}
          onMouseLeave={() => setIsSidebarHovered(false)}
        >
          {/* Toggle button */}
          <motion.button
            onClick={handleToggle}
            style={{
              position: 'absolute',
              top: '16px',
              right: '-12px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'linear-gradient(145deg, #1e1e24 0%, #14141a 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              color: 'rgba(255,255,255,0.6)',
            }}
            whileHover={{ 
              scale: 1.1,
              background: 'linear-gradient(145deg, #2a2a30 0%, #1a1a20 100%)',
            }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              animate={{ rotate: isSidebarCollapsed ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <polyline points="15 18 9 12 15 6" />
            </motion.svg>
          </motion.button>

          {/* Sidebar content wrapper */}
          <div style={{ 
            height: '100%', 
            width: sidebarWidth,
            overflow: 'hidden',
          }}>
            {sidebar}
          </div>
        </motion.aside>
      )}

      {/* Main area */}
      <main style={mainStyle}>
        {/* Header */}
        {header && (
          <header style={headerStyle}>
            {header}
          </header>
        )}

        {/* Content */}
        <div style={contentStyle}>
          {children}
        </div>
      </main>
    </div>
  );
}

// ============================================
// Dashboard Header Component
// ============================================

interface DashboardHeaderProps {
  children?: React.ReactNode;
  title?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
  className?: string;
}

export function DashboardHeader({
  children,
  title,
  breadcrumbs,
  actions,
  className = '',
}: DashboardHeaderProps) {
  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    minHeight: '64px',
  };

  const leftStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  const breadcrumbStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.4)',
  };

  return (
    <div className={className} style={headerStyle}>
      <div style={leftStyle}>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav style={breadcrumbStyle}>
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                {index > 0 && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
                {crumb.href ? (
                  <a 
                    href={crumb.href}
                    style={{ 
                      color: 'inherit', 
                      textDecoration: 'none',
                      transition: 'color 0.2s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                    onMouseOut={(e) => e.currentTarget.style.color = 'inherit'}
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span style={{ color: index === breadcrumbs.length - 1 ? 'rgba(255,255,255,0.7)' : 'inherit' }}>
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        
        {title && (
          <h1 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.95)',
            margin: 0,
          }}>
            {title}
          </h1>
        )}
        
        {children}
      </div>

      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {actions}
        </div>
      )}
    </div>
  );
}

export default DashboardLayout;

