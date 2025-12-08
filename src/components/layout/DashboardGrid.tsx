/**
 * DashboardGrid - Premium Responsive Grid System
 *
 * A flexible grid layout system for dashboard views with
 * responsive breakpoints and glass morphism styling.
 */

import React from 'react';
import { motion } from 'framer-motion';

interface DashboardGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4 | 6 | 12;
  gap?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  staggerChildren?: boolean;
}

const GAP_MAP = {
  sm: '12px',
  md: '20px',
  lg: '28px',
  xl: '36px',
};

export function DashboardGrid({
  children,
  columns = 12,
  gap = 'md',
  className = '',
  staggerChildren = false,
}: DashboardGridProps) {
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: GAP_MAP[gap],
    width: '100%',
  };

  if (staggerChildren) {
    return (
      <motion.div
        className={className}
        style={gridStyle}
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.08,
              delayChildren: 0.1,
            },
          },
        }}
      >
        {React.Children.map(children, (child, index) => (
          <motion.div
            key={index}
            variants={{
              hidden: { opacity: 0, y: 20, scale: 0.98 },
              visible: {
                opacity: 1,
                y: 0,
                scale: 1,
                transition: {
                  duration: 0.4,
                  ease: [0.23, 1, 0.32, 1],
                },
              },
            }}
          >
            {child}
          </motion.div>
        ))}
      </motion.div>
    );
  }

  return (
    <div className={className} style={gridStyle}>
      {children}
    </div>
  );
}

// ============================================
// Grid Item Component
// ============================================

interface GridItemProps {
  children: React.ReactNode;
  span?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  rowSpan?: 1 | 2 | 3 | 4;
  className?: string;
  style?: React.CSSProperties;
}

export function GridItem({
  children,
  span = 1,
  rowSpan = 1,
  className = '',
  style,
}: GridItemProps) {
  const itemStyle: React.CSSProperties = {
    gridColumn: `span ${span}`,
    gridRow: rowSpan > 1 ? `span ${rowSpan}` : undefined,
    minWidth: 0, // Prevent overflow
    ...style,
  };

  return (
    <div className={className} style={itemStyle}>
      {children}
    </div>
  );
}

// ============================================
// Dashboard Section Component
// ============================================

interface DashboardSectionProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
}

export function DashboardSection({
  children,
  title,
  subtitle,
  action,
  collapsible = false,
  defaultCollapsed = false,
  className = '',
}: DashboardSectionProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  const sectionStyle: React.CSSProperties = {
    marginBottom: '32px',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: isCollapsed ? '0' : '20px',
    cursor: collapsible ? 'pointer' : 'default',
  };

  const titleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  return (
    <section className={className} style={sectionStyle}>
      {(title || action) && (
        <div
          style={headerStyle}
          onClick={collapsible ? () => setIsCollapsed(!isCollapsed) : undefined}
        >
          <div style={titleStyle}>
            {collapsible && (
              <motion.svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ color: 'rgba(255,255,255,0.4)' }}
                animate={{ rotate: isCollapsed ? -90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <polyline points="6 9 12 15 18 9" />
              </motion.svg>
            )}
            <div>
              {title && (
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.95)',
                  margin: 0,
                }}>
                  {title}
                </h2>
              )}
              {subtitle && (
                <p style={{
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.4)',
                  margin: '4px 0 0 0',
                }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {action && !isCollapsed && action}
        </div>
      )}

      <motion.div
        initial={false}
        animate={{
          height: isCollapsed ? 0 : 'auto',
          opacity: isCollapsed ? 0 : 1,
        }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        style={{ overflow: 'hidden' }}
      >
        {children}
      </motion.div>
    </section>
  );
}

export default DashboardGrid;

