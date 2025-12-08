/**
 * ChartContainer - Premium Glass Container for Charts
 *
 * A styled wrapper for chart components with glass morphism styling.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface ChartContainerProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  legend?: React.ReactNode;
  actions?: React.ReactNode;
  height?: string | number;
  className?: string;
}

export function ChartContainer({
  children,
  title,
  subtitle,
  legend,
  actions,
  height = 300,
  className = '',
}: ChartContainerProps) {
  const [isHovered, setIsHovered] = useState(false);

  const containerStyle: React.CSSProperties = {
    borderRadius: '16px',
    overflow: 'hidden',
    background: 'linear-gradient(145deg, rgba(25,25,30,0.95) 0%, rgba(18,18,22,0.98) 100%)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: isHovered
      ? `
        0 25px 60px rgba(0,0,0,0.4),
        0 12px 30px rgba(0,0,0,0.3),
        inset 0 0 30px rgba(200,255,100,0.03)
      `
      : `
        0 20px 50px rgba(0,0,0,0.35),
        0 10px 25px rgba(0,0,0,0.25)
      `,
    transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '20px 20px 0',
    marginBottom: '16px',
  };

  const chartAreaStyle: React.CSSProperties = {
    height: typeof height === 'number' ? `${height}px` : height,
    padding: '0 20px 20px',
    position: 'relative',
  };

  const legendStyle: React.CSSProperties = {
    padding: '12px 20px 16px',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    justifyContent: 'center',
  };

  return (
    <motion.div
      className={className}
      style={containerStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      {(title || actions) && (
        <div style={headerStyle}>
          <div>
            {title && (
              <h3 style={{
                fontSize: '15px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.95)',
                margin: 0,
              }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.4)',
                margin: '4px 0 0 0',
              }}>
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {actions}
            </div>
          )}
        </div>
      )}

      {/* Chart area */}
      <div style={chartAreaStyle}>
        {children}
      </div>

      {/* Legend */}
      {legend && (
        <div style={legendStyle}>
          {legend}
        </div>
      )}
    </motion.div>
  );
}

// ============================================
// Chart Legend Component
// ============================================

interface LegendItem {
  label: string;
  color: string;
  value?: string | number;
  active?: boolean;
}

interface ChartLegendProps {
  items: LegendItem[];
  onItemClick?: (index: number) => void;
}

export function ChartLegend({ items, onItemClick }: ChartLegendProps) {
  return (
    <>
      {items.map((item, index) => (
        <motion.div
          key={item.label}
          onClick={() => onItemClick?.(index)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: onItemClick ? 'pointer' : 'default',
            opacity: item.active !== false ? 1 : 0.4,
            transition: 'opacity 0.2s ease',
          }}
          whileHover={onItemClick ? { scale: 1.02 } : undefined}
          whileTap={onItemClick ? { scale: 0.98 } : undefined}
        >
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '3px',
              background: item.color,
              boxShadow: `0 0 8px ${item.color}40`,
            }}
          />
          <span style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.7)',
          }}>
            {item.label}
          </span>
          {item.value !== undefined && (
            <span style={{
              fontSize: '12px',
              fontWeight: 600,
              color: item.color,
            }}>
              {item.value}
            </span>
          )}
        </motion.div>
      ))}
    </>
  );
}

export default ChartContainer;

