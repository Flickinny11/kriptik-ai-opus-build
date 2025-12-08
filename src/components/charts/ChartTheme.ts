/**
 * Premium Chart Theme for KripTik AI
 * 
 * Design tokens and configurations for consistent chart styling.
 */

// Chart color palette
export const CHART_COLORS = {
  // Primary series colors
  primary: [
    '#c8ff64', // Accent green
    '#88d4ff', // Cyan blue
    '#ffb088', // Warm orange
    '#a78bfa', // Purple
    '#ff6b8a', // Pink
    '#ffd700', // Gold
    '#06b6d4', // Teal
    '#f97316', // Orange
  ],
  
  // Status colors
  success: '#10b981',
  warning: '#f59e0b',
  error: '#f43f5e',
  info: '#06b6d4',
  
  // Gradient pairs for area fills
  gradients: {
    accent: {
      from: 'rgba(200,255,100,0.3)',
      to: 'rgba(200,255,100,0)',
    },
    cyan: {
      from: 'rgba(136,212,255,0.3)',
      to: 'rgba(136,212,255,0)',
    },
    warm: {
      from: 'rgba(255,176,136,0.3)',
      to: 'rgba(255,176,136,0)',
    },
    purple: {
      from: 'rgba(167,139,250,0.3)',
      to: 'rgba(167,139,250,0)',
    },
  },
  
  // UI colors
  grid: 'rgba(255,255,255,0.05)',
  gridStrong: 'rgba(255,255,255,0.1)',
  axis: 'rgba(255,255,255,0.3)',
  axisLabel: 'rgba(255,255,255,0.5)',
  tooltip: {
    background: 'linear-gradient(145deg, rgba(25,25,30,0.98) 0%, rgba(18,18,22,0.99) 100%)',
    border: 'rgba(255,255,255,0.1)',
    text: 'rgba(255,255,255,0.9)',
    textMuted: 'rgba(255,255,255,0.5)',
  },
  legend: {
    text: 'rgba(255,255,255,0.7)',
    inactive: 'rgba(255,255,255,0.3)',
  },
};

// Chart styling configurations
export const CHART_STYLES = {
  // Font settings
  font: {
    family: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    size: {
      small: 10,
      normal: 12,
      large: 14,
    },
  },
  
  // Animation settings
  animation: {
    duration: 800,
    easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
  },
  
  // Grid settings
  grid: {
    strokeDasharray: '4 4',
    strokeWidth: 1,
  },
  
  // Line/Area chart settings
  line: {
    strokeWidth: 2,
    dotRadius: 4,
    dotRadiusHover: 6,
  },
  
  // Bar chart settings
  bar: {
    borderRadius: 4,
    maxBarWidth: 40,
    gap: 0.3, // Gap ratio
  },
  
  // Pie/Donut settings
  pie: {
    innerRadius: 0.6, // For donut
    padAngle: 0.02,
    cornerRadius: 4,
  },
  
  // Tooltip settings
  tooltip: {
    borderRadius: 12,
    padding: '12px 16px',
    shadow: '0 10px 40px rgba(0,0,0,0.4)',
    backdropBlur: 20,
  },
  
  // Legend settings
  legend: {
    dotSize: 10,
    gap: 20,
  },
};

// Get color for series index
export function getSeriesColor(index: number): string {
  return CHART_COLORS.primary[index % CHART_COLORS.primary.length];
}

// Get gradient for series index
export function getSeriesGradient(index: number): { from: string; to: string } {
  const gradientKeys = Object.keys(CHART_COLORS.gradients) as Array<keyof typeof CHART_COLORS.gradients>;
  const key = gradientKeys[index % gradientKeys.length];
  return CHART_COLORS.gradients[key];
}

// Generate CSS gradient string
export function generateGradient(
  id: string,
  from: string,
  to: string,
  direction: 'vertical' | 'horizontal' = 'vertical'
): string {
  const x1 = direction === 'horizontal' ? '0' : '0';
  const y1 = direction === 'horizontal' ? '0' : '0';
  const x2 = direction === 'horizontal' ? '1' : '0';
  const y2 = direction === 'horizontal' ? '0' : '1';
  
  return `
    <linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
      <stop offset="0%" stopColor="${from}" />
      <stop offset="100%" stopColor="${to}" />
    </linearGradient>
  `;
}

