/**
 * Builder V2 Design Tokens
 *
 * Centralized design system for the new Replit-style builder interface.
 * Dark theme with amber accents - NO PURPLE.
 *
 * Typography: Outfit (display), DM Sans (body), JetBrains Mono (code)
 * Accent: Amber #D97706
 */

// Color palette - Dark theme optimized
export const colors = {
  // Backgrounds
  bg: {
    primary: '#0C0A09',      // stone-950
    secondary: '#1C1917',     // stone-900
    tertiary: '#292524',      // stone-800
    elevated: '#44403C',      // stone-700
    panel: 'rgba(28, 25, 23, 0.95)',
    glass: 'rgba(28, 25, 23, 0.85)',
    glassLight: 'rgba(41, 37, 36, 0.75)',
  },

  // Text
  text: {
    primary: '#F5F5F4',       // stone-100
    secondary: '#A8A29E',     // stone-400
    muted: '#78716C',         // stone-500
    disabled: '#57534E',      // stone-600
  },

  // Accent - Amber (Primary brand color)
  accent: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',           // Primary accent
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },

  // Semantic
  success: {
    main: '#22C55E',
    muted: 'rgba(34, 197, 94, 0.15)',
    text: '#86EFAC',
  },
  error: {
    main: '#EF4444',
    muted: 'rgba(239, 68, 68, 0.15)',
    text: '#FCA5A5',
  },
  warning: {
    main: '#F59E0B',
    muted: 'rgba(245, 158, 11, 0.15)',
    text: '#FCD34D',
  },
  info: {
    main: '#14B8A6',          // Teal as secondary accent
    muted: 'rgba(20, 184, 166, 0.15)',
    text: '#5EEAD4',
  },

  // Borders
  border: {
    subtle: 'rgba(255, 255, 255, 0.06)',
    muted: 'rgba(255, 255, 255, 0.1)',
    visible: 'rgba(255, 255, 255, 0.15)',
    strong: 'rgba(255, 255, 255, 0.2)',
    accent: 'rgba(217, 119, 6, 0.5)',
  },
} as const;

// Typography
export const typography = {
  fonts: {
    display: "'Outfit', system-ui, sans-serif",
    body: "'DM Sans', system-ui, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  sizes: {
    xs: '0.75rem',    // 12px
    sm: '0.8125rem',  // 13px
    base: '0.875rem', // 14px
    lg: '1rem',       // 16px
    xl: '1.125rem',   // 18px
    '2xl': '1.25rem', // 20px
    '3xl': '1.5rem',  // 24px
    '4xl': '1.875rem',// 30px
    '5xl': '2.25rem', // 36px
  },
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

// Spacing
export const spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  3.5: '0.875rem',  // 14px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  8: '2rem',        // 32px
  10: '2.5rem',     // 40px
  12: '3rem',       // 48px
  16: '4rem',       // 64px
} as const;

// Border radius
export const radius = {
  sm: '0.375rem',   // 6px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  '2xl': '1.25rem', // 20px
  '3xl': '1.5rem',  // 24px
  full: '9999px',
} as const;

// Shadows
export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
  md: '0 4px 8px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)',
  lg: '0 8px 16px rgba(0, 0, 0, 0.4), 0 4px 8px rgba(0, 0, 0, 0.3)',
  xl: '0 16px 32px rgba(0, 0, 0, 0.5), 0 8px 16px rgba(0, 0, 0, 0.3)',
  '2xl': '0 24px 48px rgba(0, 0, 0, 0.5)',
  inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.4)',

  // Glow effects
  glowAmber: '0 0 20px rgba(217, 119, 6, 0.3), 0 0 40px rgba(217, 119, 6, 0.1)',
  glowTeal: '0 0 20px rgba(20, 184, 166, 0.3), 0 0 40px rgba(20, 184, 166, 0.1)',
  glowSuccess: '0 0 20px rgba(34, 197, 94, 0.3), 0 0 40px rgba(34, 197, 94, 0.1)',
  glowError: '0 0 20px rgba(239, 68, 68, 0.3), 0 0 40px rgba(239, 68, 68, 0.1)',
} as const;

// Transitions
export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  slower: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
  spring: '500ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  bounce: '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

// Z-index scale
export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  fixed: 300,
  modalBackdrop: 400,
  modal: 500,
  popover: 600,
  tooltip: 700,
  toast: 800,
} as const;

// Breakpoints
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// Component-specific styles
export const panelStyles = {
  glass: {
    background: colors.bg.glass,
    backdropFilter: 'blur(12px) saturate(150%)',
    WebkitBackdropFilter: 'blur(12px) saturate(150%)',
    border: `1px solid ${colors.border.subtle}`,
    boxShadow: shadows.lg,
  },
  solid: {
    background: colors.bg.secondary,
    border: `1px solid ${colors.border.subtle}`,
    boxShadow: shadows.md,
  },
} as const;

export const buttonStyles = {
  primary: {
    background: `linear-gradient(135deg, ${colors.accent[500]} 0%, ${colors.accent[600]} 100%)`,
    color: '#0C0A09',
    boxShadow: `0 2px 0 ${colors.accent[700]}, ${shadows.md}`,
  },
  secondary: {
    background: 'rgba(255, 255, 255, 0.05)',
    color: colors.text.primary,
    border: `1px solid ${colors.border.visible}`,
  },
  ghost: {
    background: 'transparent',
    color: colors.text.secondary,
  },
  danger: {
    background: `linear-gradient(135deg, ${colors.error.main} 0%, #DC2626 100%)`,
    color: '#FFFFFF',
  },
} as const;

// Status bar specific
export const statusBarStyles = {
  height: '36px',
  background: colors.bg.primary,
  borderTop: `1px solid ${colors.border.subtle}`,
  fontSize: typography.sizes.xs,
  fontFamily: typography.fonts.mono,
} as const;

// Viewport sizes for preview
export const viewportSizes = {
  desktop: { width: 1440, label: 'Desktop' },
  tablet: { width: 768, label: 'Tablet' },
  mobile: { width: 375, label: 'Mobile' },
} as const;

// Build phases with colors
export const buildPhaseColors = {
  intent_lock: colors.accent[500],
  initialization: colors.info.main,
  parallel_build: colors.accent[600],
  integration: colors.warning.main,
  testing: colors.info.main,
  intent_satisfaction: colors.success.main,
  demo: colors.success.main,
} as const;

// Build mode labels
export const buildModeConfig = {
  lightning: {
    label: 'Lightning',
    color: colors.accent[400],
    description: 'Fast, single-pass build',
  },
  standard: {
    label: 'Standard',
    color: colors.accent[500],
    description: 'Balanced speed and quality',
  },
  tournament: {
    label: 'Tournament',
    color: colors.info.main,
    description: 'Multi-agent competition',
  },
  production: {
    label: 'Production',
    color: colors.success.main,
    description: 'Maximum quality checks',
  },
} as const;

// Export all as default for convenience
export default {
  colors,
  typography,
  spacing,
  radius,
  shadows,
  transitions,
  zIndex,
  breakpoints,
  panelStyles,
  buttonStyles,
  statusBarStyles,
  viewportSizes,
  buildPhaseColors,
  buildModeConfig,
};
