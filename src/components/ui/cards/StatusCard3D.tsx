/**
 * StatusCard3D - Premium Status/Activity Card
 * 
 * Card for displaying status, progress, or activity information
 * with animated indicators and premium glass styling.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';

type StatusType = 'success' | 'warning' | 'error' | 'info' | 'pending' | 'active';

interface StatusCard3DProps {
  title: string;
  subtitle?: string;
  status: StatusType;
  statusLabel?: string;
  progress?: number; // 0-100
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  timestamp?: string;
  children?: React.ReactNode;
  className?: string;
}

const STATUS_CONFIG: Record<StatusType, {
  color: string;
  bgColor: string;
  glowColor: string;
  label: string;
}> = {
  success: {
    color: '#10b981',
    bgColor: 'rgba(16,185,129,0.15)',
    glowColor: 'rgba(16,185,129,0.3)',
    label: 'Complete',
  },
  warning: {
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.15)',
    glowColor: 'rgba(245,158,11,0.3)',
    label: 'Warning',
  },
  error: {
    color: '#f43f5e',
    bgColor: 'rgba(244,63,94,0.15)',
    glowColor: 'rgba(244,63,94,0.3)',
    label: 'Error',
  },
  info: {
    color: '#06b6d4',
    bgColor: 'rgba(6,182,212,0.15)',
    glowColor: 'rgba(6,182,212,0.3)',
    label: 'Info',
  },
  pending: {
    color: '#8b5cf6',
    bgColor: 'rgba(139,92,246,0.15)',
    glowColor: 'rgba(139,92,246,0.3)',
    label: 'Pending',
  },
  active: {
    color: '#c8ff64',
    bgColor: 'rgba(200,255,100,0.15)',
    glowColor: 'rgba(200,255,100,0.3)',
    label: 'Active',
  },
};

export function StatusCard3D({
  title,
  subtitle,
  status,
  statusLabel,
  progress,
  icon,
  action,
  timestamp,
  children,
  className = '',
}: StatusCard3DProps) {
  const [isHovered, setIsHovered] = useState(false);
  const config = STATUS_CONFIG[status];

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    padding: '20px',
    borderRadius: '16px',
    background: 'linear-gradient(145deg, rgba(25,25,30,0.95) 0%, rgba(18,18,22,0.98) 100%)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    border: `1px solid ${isHovered ? config.color : 'rgba(255,255,255,0.08)'}`,
    boxShadow: isHovered
      ? `
        0 0 30px ${config.glowColor},
        0 20px 50px rgba(0,0,0,0.4)
      `
      : `
        0 15px 40px rgba(0,0,0,0.35)
      `,
    transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
    overflow: 'hidden',
  };

  return (
    <motion.div
      className={className}
      style={cardStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: -2, scale: 1.005 }}
    >
      {/* Status indicator line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: `linear-gradient(90deg, ${config.color} 0%, transparent 100%)`,
          opacity: isHovered ? 1 : 0.6,
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'flex-start', 
        justifyContent: 'space-between',
        marginBottom: children ? '16px' : '0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {icon && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: config.bgColor,
                color: config.color,
              }}
            >
              {icon}
            </div>
          )}
          <div>
            <h3 style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.95)',
              margin: 0,
            }}>
              {title}
            </h3>
            {subtitle && (
              <p style={{
                fontSize: '13px',
                color: 'rgba(255,255,255,0.5)',
                margin: '2px 0 0 0',
              }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Status badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '20px',
            background: config.bgColor,
            border: `1px solid ${config.color}40`,
          }}
        >
          {/* Pulse dot for active status */}
          {status === 'active' && (
            <span style={{ position: 'relative' }}>
              <span
                style={{
                  display: 'block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: config.color,
                }}
              />
              <motion.span
                style={{
                  position: 'absolute',
                  inset: '-2px',
                  borderRadius: '50%',
                  border: `2px solid ${config.color}`,
                }}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.8, 0, 0.8],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            </span>
          )}
          <span style={{
            fontSize: '12px',
            fontWeight: 500,
            color: config.color,
          }}>
            {statusLabel || config.label}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {progress !== undefined && (
        <div style={{ marginBottom: children ? '16px' : '0' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '6px',
          }}>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
              Progress
            </span>
            <span style={{ fontSize: '12px', color: config.color, fontWeight: 500 }}>
              {progress}%
            </span>
          </div>
          <div
            style={{
              height: '6px',
              borderRadius: '3px',
              background: 'rgba(255,255,255,0.1)',
              overflow: 'hidden',
            }}
          >
            <motion.div
              style={{
                height: '100%',
                borderRadius: '3px',
                background: `linear-gradient(90deg, ${config.color} 0%, ${config.color}80 100%)`,
                boxShadow: `0 0 10px ${config.glowColor}`,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
            />
          </div>
        </div>
      )}

      {/* Content */}
      {children}

      {/* Footer with timestamp and action */}
      {(timestamp || action) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}>
          {timestamp && (
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
              {timestamp}
            </span>
          )}
          {action && (
            <motion.button
              onClick={action.onClick}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: config.bgColor,
                border: `1px solid ${config.color}40`,
                color: config.color,
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              whileHover={{ 
                scale: 1.02,
                background: `${config.color}30`,
              }}
              whileTap={{ scale: 0.98 }}
            >
              {action.label}
            </motion.button>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default StatusCard3D;

