/**
 * ChartTooltip - Premium Glass Tooltip for Charts
 *
 * A styled tooltip component for chart hover states.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipItem {
  label: string;
  value: string | number;
  color?: string;
}

interface ChartTooltipProps {
  visible: boolean;
  x: number;
  y: number;
  title?: string;
  items: TooltipItem[];
  containerRef?: React.RefObject<HTMLDivElement>;
}

export function ChartTooltip({
  visible,
  x,
  y,
  title,
  items,
}: ChartTooltipProps) {
  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    left: x,
    top: y,
    transform: 'translate(-50%, -100%)',
    marginTop: '-12px',
    padding: '12px 16px',
    borderRadius: '12px',
    background: 'linear-gradient(145deg, rgba(25,25,30,0.98) 0%, rgba(18,18,22,0.99) 100%)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: `
      0 10px 40px rgba(0,0,0,0.4),
      0 4px 16px rgba(0,0,0,0.3)
    `,
    pointerEvents: 'none',
    zIndex: 100,
    minWidth: '120px',
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          style={tooltipStyle}
        >
          {/* Title */}
          {title && (
            <div style={{
              fontSize: '11px',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.5)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              {title}
            </div>
          )}

          {/* Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {items.map((item, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {item.color && (
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '2px',
                        background: item.color,
                        boxShadow: `0 0 6px ${item.color}50`,
                      }}
                    />
                  )}
                  <span style={{
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.7)',
                  }}>
                    {item.label}
                  </span>
                </div>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: item.color || 'rgba(255,255,255,0.95)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          {/* Arrow */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              bottom: '-6px',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid rgba(18,18,22,0.99)',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ChartTooltip;

