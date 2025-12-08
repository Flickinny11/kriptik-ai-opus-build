/**
 * MiniBar - Minimal Inline Bar Chart
 *
 * A compact bar chart for inline data visualization.
 */

import { motion } from 'framer-motion';
import { CHART_COLORS, getSeriesColor } from './ChartTheme';

interface MiniBarProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  multiColor?: boolean;
  gap?: number;
  animated?: boolean;
  className?: string;
}

export function MiniBar({
  data,
  width = 100,
  height = 32,
  color = CHART_COLORS.primary[0],
  multiColor = false,
  gap = 3,
  animated = true,
  className = '',
}: MiniBarProps) {
  if (data.length === 0) return null;

  const max = Math.max(...data);
  const padding = 2;
  const effectiveWidth = width - padding * 2;
  const effectiveHeight = height - padding * 2;
  const barWidth = (effectiveWidth - gap * (data.length - 1)) / data.length;

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {data.map((value, index) => {
        const barHeight = max > 0 ? (value / max) * effectiveHeight : 0;
        const barColor = multiColor ? getSeriesColor(index) : color;
        const x = padding + index * (barWidth + gap);
        const y = padding + effectiveHeight - barHeight;

        return (
          <motion.rect
            key={index}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            rx={2}
            fill={barColor}
            initial={animated ? { scaleY: 0, opacity: 0 } : undefined}
            animate={animated ? { scaleY: 1, opacity: 1 } : undefined}
            transition={{
              duration: 0.4,
              delay: animated ? index * 0.05 : 0,
              ease: [0.23, 1, 0.32, 1],
            }}
            style={{
              originY: 1,
              filter: `drop-shadow(0 0 3px ${barColor}40)`,
            }}
          />
        );
      })}
    </svg>
  );
}

export default MiniBar;

