/**
 * ProgressRing - Animated Circular Progress Indicator
 *
 * A premium circular progress indicator with glass styling.
 */

import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { CHART_COLORS } from './ChartTheme';

interface ProgressRingProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  label?: string;
  sublabel?: string;
  showValue?: boolean;
  valuePrefix?: string;
  valueSuffix?: string;
  animated?: boolean;
  className?: string;
}

export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 8,
  color = CHART_COLORS.primary[0],
  backgroundColor = 'rgba(255,255,255,0.08)',
  label,
  sublabel,
  showValue = true,
  valuePrefix = '',
  valueSuffix = '%',
  animated = true,
  className = '',
}: ProgressRingProps) {
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => setIsAnimated(true), 100);
      return () => clearTimeout(timer);
    }
  }, [animated]);

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const normalizedValue = Math.min(100, Math.max(0, value));

  const springValue = useSpring(0, {
    damping: 30,
    stiffness: 100,
  });

  useEffect(() => {
    if (animated) {
      springValue.set(normalizedValue);
    }
  }, [normalizedValue, animated, springValue]);

  const strokeDashoffset = useTransform(
    springValue,
    [0, 100],
    [circumference, 0]
  );

  const displayValue = useTransform(springValue, Math.round);

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: size,
    height: size,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const svgStyle: React.CSSProperties = {
    position: 'absolute',
    transform: 'rotate(-90deg)',
  };

  const centerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    zIndex: 1,
  };

  return (
    <div className={className} style={containerStyle}>
      <svg
        width={size}
        height={size}
        style={svgStyle}
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id={`progress-gradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={`${color}80`} />
          </linearGradient>

          {/* Glow filter */}
          <filter id={`glow-${color.replace('#', '')}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
        />

        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#progress-gradient-${color.replace('#', '')})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{
            strokeDashoffset: animated ? strokeDashoffset : circumference - (normalizedValue / 100) * circumference,
            filter: `url(#glow-${color.replace('#', '')})`,
          }}
        />

        {/* End cap glow */}
        {normalizedValue > 0 && (
          <motion.circle
            cx={size / 2}
            cy={strokeWidth / 2 + size / 2 - radius}
            r={strokeWidth / 2}
            fill={color}
            style={{
              filter: `url(#glow-${color.replace('#', '')})`,
              opacity: isAnimated ? 1 : 0,
            }}
            animate={{
              rotate: normalizedValue * 3.6,
            }}
            transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
            transformOrigin={`${size / 2}px ${size / 2}px`}
          />
        )}
      </svg>

      {/* Center content */}
      <div style={centerStyle}>
        {showValue && (
          <motion.span
            style={{
              fontSize: size * 0.22,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.95)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {valuePrefix}
            {animated ? (
              <motion.span>{displayValue}</motion.span>
            ) : (
              normalizedValue
            )}
            {valueSuffix}
          </motion.span>
        )}

        {label && (
          <span style={{
            fontSize: size * 0.1,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.6)',
            marginTop: '4px',
          }}>
            {label}
          </span>
        )}

        {sublabel && (
          <span style={{
            fontSize: size * 0.08,
            color: 'rgba(255,255,255,0.4)',
            marginTop: '2px',
          }}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

export default ProgressRing;

