/**
 * FeatureCard3D - Premium Feature/Stat Card with 3D Effects
 * 
 * Designed for displaying features, stats, or highlights with
 * premium glass styling and subtle animations.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface FeatureCard3DProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  value?: string | number;
  trend?: { value: number; positive: boolean };
  variant?: 'glass' | 'accent' | 'warm' | 'cool';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}

const VARIANT_CONFIG = {
  glass: {
    bg: 'linear-gradient(145deg, rgba(30,30,35,0.95) 0%, rgba(20,20,25,0.98) 100%)',
    iconBg: 'rgba(255,255,255,0.08)',
    iconColor: '#ffffff',
    accentColor: 'rgba(255,255,255,0.6)',
    glowColor: 'rgba(255,255,255,0.1)',
  },
  accent: {
    bg: 'linear-gradient(145deg, rgba(30,40,30,0.95) 0%, rgba(20,30,20,0.98) 100%)',
    iconBg: 'rgba(200,255,100,0.15)',
    iconColor: '#c8ff64',
    accentColor: '#c8ff64',
    glowColor: 'rgba(200,255,100,0.2)',
  },
  warm: {
    bg: 'linear-gradient(145deg, rgba(40,30,30,0.95) 0%, rgba(30,20,20,0.98) 100%)',
    iconBg: 'rgba(255,150,100,0.15)',
    iconColor: '#ffb088',
    accentColor: '#ffb088',
    glowColor: 'rgba(255,150,100,0.2)',
  },
  cool: {
    bg: 'linear-gradient(145deg, rgba(30,30,40,0.95) 0%, rgba(20,20,30,0.98) 100%)',
    iconBg: 'rgba(100,150,255,0.15)',
    iconColor: '#88b4ff',
    accentColor: '#88b4ff',
    glowColor: 'rgba(100,150,255,0.2)',
  },
};

const SIZE_CONFIG = {
  sm: {
    padding: '16px',
    iconSize: 36,
    titleSize: '14px',
    descSize: '12px',
    valueSize: '20px',
  },
  md: {
    padding: '20px',
    iconSize: 44,
    titleSize: '15px',
    descSize: '13px',
    valueSize: '24px',
  },
  lg: {
    padding: '24px',
    iconSize: 52,
    titleSize: '16px',
    descSize: '14px',
    valueSize: '28px',
  },
};

export function FeatureCard3D({
  icon,
  title,
  description,
  value,
  trend,
  variant = 'glass',
  size = 'md',
  onClick,
  className = '',
}: FeatureCard3DProps) {
  const [isHovered, setIsHovered] = useState(false);
  const config = VARIANT_CONFIG[variant];
  const sizeConfig = SIZE_CONFIG[size];

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    padding: sizeConfig.padding,
    borderRadius: '16px',
    background: config.bg,
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: isHovered
      ? `
        inset 0 0 30px ${config.glowColor},
        0 20px 50px rgba(0,0,0,0.4),
        0 10px 25px rgba(0,0,0,0.3)
      `
      : `
        0 15px 40px rgba(0,0,0,0.35),
        0 8px 20px rgba(0,0,0,0.25)
      `,
    cursor: onClick ? 'pointer' : 'default',
    overflow: 'hidden',
    transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
  };

  const iconContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: sizeConfig.iconSize,
    height: sizeConfig.iconSize,
    borderRadius: '12px',
    background: config.iconBg,
    color: config.iconColor,
    marginBottom: '16px',
    transition: 'all 0.3s ease',
    boxShadow: isHovered ? `0 0 20px ${config.glowColor}` : 'none',
  };

  return (
    <motion.div
      className={className}
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={onClick ? { scale: 0.99 } : undefined}
    >
      {/* Shine sweep effect */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: isHovered ? '150%' : '-100%',
          width: '50%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
          transform: 'skewX(-20deg)',
          transition: 'left 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
          pointerEvents: 'none',
        }}
      />

      {/* Top border glow */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: `linear-gradient(90deg, transparent 0%, ${config.accentColor} 50%, transparent 100%)`,
          opacity: isHovered ? 0.6 : 0.3,
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={iconContainerStyle}>
          {icon}
        </div>

        <h3 style={{
          fontSize: sizeConfig.titleSize,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.95)',
          margin: 0,
          marginBottom: description ? '6px' : '0',
        }}>
          {title}
        </h3>

        {description && (
          <p style={{
            fontSize: sizeConfig.descSize,
            color: 'rgba(255,255,255,0.5)',
            margin: 0,
            lineHeight: 1.5,
          }}>
            {description}
          </p>
        )}

        {value !== undefined && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'baseline', 
            gap: '8px',
            marginTop: '12px',
          }}>
            <span style={{
              fontSize: sizeConfig.valueSize,
              fontWeight: 700,
              color: config.accentColor,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {value}
            </span>
            
            {trend && (
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: 500,
                color: trend.positive ? '#10b981' : '#f43f5e',
              }}>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{
                    transform: trend.positive ? 'rotate(0deg)' : 'rotate(180deg)',
                  }}
                >
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
                {Math.abs(trend.value)}%
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default FeatureCard3D;

