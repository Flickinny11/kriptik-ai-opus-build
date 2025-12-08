/**
 * SparkLine - Minimal Inline Chart
 * 
 * A compact line chart for inline data visualization.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CHART_COLORS } from './ChartTheme';

interface SparkLineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
  showDot?: boolean;
  animated?: boolean;
  className?: string;
}

export function SparkLine({
  data,
  width = 100,
  height = 32,
  color = CHART_COLORS.primary[0],
  showArea = true,
  showDot = true,
  animated = true,
  className = '',
}: SparkLineProps) {
  const { path, areaPath, lastPoint } = useMemo(() => {
    if (data.length < 2) return { path: '', areaPath: '', lastPoint: { x: 0, y: 0 } };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 4;
    const effectiveHeight = height - padding * 2;
    const effectiveWidth = width - padding * 2;
    const stepX = effectiveWidth / (data.length - 1);

    const points = data.map((value, index) => ({
      x: padding + index * stepX,
      y: padding + effectiveHeight - ((value - min) / range) * effectiveHeight,
    }));

    // Create smooth curved path
    let pathD = `M ${points[0].x},${points[0].y}`;
    
    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const cpx = (current.x + next.x) / 2;
      pathD += ` C ${cpx},${current.y} ${cpx},${next.y} ${next.x},${next.y}`;
    }

    // Create area path
    const areaD = `${pathD} L ${points[points.length - 1].x},${height - padding} L ${points[0].x},${height - padding} Z`;

    return {
      path: pathD,
      areaPath: areaD,
      lastPoint: points[points.length - 1],
    };
  }, [data, width, height]);

  const gradientId = `sparkline-gradient-${Math.random().toString(36).slice(2)}`;

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ overflow: 'visible' }}
    >
      {/* Gradient definition */}
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      {showArea && (
        <motion.path
          d={areaPath}
          fill={`url(#${gradientId})`}
          initial={animated ? { opacity: 0 } : undefined}
          animate={animated ? { opacity: 1 } : undefined}
          transition={{ duration: 0.5, delay: 0.3 }}
        />
      )}

      {/* Line */}
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={animated ? { pathLength: 0, opacity: 0 } : undefined}
        animate={animated ? { pathLength: 1, opacity: 1 } : undefined}
        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
      />

      {/* End dot */}
      {showDot && lastPoint && (
        <motion.circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={3}
          fill={color}
          stroke="rgba(0,0,0,0.3)"
          strokeWidth={1}
          initial={animated ? { scale: 0, opacity: 0 } : undefined}
          animate={animated ? { scale: 1, opacity: 1 } : undefined}
          transition={{ duration: 0.3, delay: 0.8 }}
          style={{
            filter: `drop-shadow(0 0 4px ${color})`,
          }}
        />
      )}
    </svg>
  );
}

export default SparkLine;

