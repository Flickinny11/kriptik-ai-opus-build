// KripTik Mobile Design System
// Matches web app's "Liquid Glass 3D" aesthetic

export const colors = {
  // Primary backgrounds
  background: {
    primary: '#0C0A09',      // stone-950 - main app background
    secondary: '#1C1917',    // stone-900 - cards, panels
    tertiary: '#292524',     // stone-800 - elevated surfaces
    glass: 'rgba(28, 25, 23, 0.85)', // glass effect background
    glassLight: 'rgba(41, 37, 36, 0.7)',
  },

  // Accent colors (KripTik amber/gold identity)
  accent: {
    primary: '#D97706',      // amber-600 - primary actions
    secondary: '#F59E0B',    // amber-500 - highlights
    tertiary: '#FBBF24',     // amber-400 - glows
    muted: '#92400E',        // amber-800 - muted accent
    glow: 'rgba(217, 119, 6, 0.4)', // amber glow effect
  },

  // Text colors
  text: {
    primary: '#F5F5F4',      // stone-100 - main text
    secondary: '#A8A29E',    // stone-400 - secondary text
    tertiary: '#78716C',     // stone-500 - muted text
    inverse: '#0C0A09',      // for light backgrounds
  },

  // Status colors
  status: {
    success: '#22C55E',      // green-500
    successMuted: '#166534', // green-800
    error: '#EF4444',        // red-500
    errorMuted: '#991B1B',   // red-800
    warning: '#F59E0B',      // amber-500
    warningMuted: '#92400E', // amber-800
    info: '#3B82F6',         // blue-500
    infoMuted: '#1E40AF',    // blue-800
  },

  // Build phase colors
  phases: {
    intentLock: '#8B5CF6',   // violet-500
    initialization: '#3B82F6', // blue-500
    building: '#D97706',     // amber-600
    verification: '#22C55E', // green-500
    complete: '#10B981',     // emerald-500
    failed: '#EF4444',       // red-500
  },

  // Border colors
  border: {
    default: 'rgba(168, 162, 158, 0.2)', // stone-400 @ 20%
    focused: 'rgba(217, 119, 6, 0.5)',   // amber-600 @ 50%
    error: 'rgba(239, 68, 68, 0.5)',     // red-500 @ 50%
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
} as const;

export const typography = {
  // Font families (loaded via expo-font)
  fontFamily: {
    display: 'CalSans-SemiBold',    // Headlines
    heading: 'Outfit-SemiBold',     // Section headers
    body: 'DMSans-Regular',         // Body text
    bodyMedium: 'DMSans-Medium',    // Emphasized body
    bodySemiBold: 'DMSans-SemiBold', // Strong emphasis
    mono: 'JetBrainsMono-Regular',  // Code
  },

  // Font sizes
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },

  // Line heights
  lineHeight: {
    tight: 1.1,
    snug: 1.25,
    normal: 1.5,
    relaxed: 1.625,
  },
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  glow: {
    shadowColor: colors.accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 0,
  },
  glowStrong: {
    shadowColor: colors.accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 0,
  },
} as const;

export const animations = {
  // Duration in milliseconds
  duration: {
    instant: 100,
    fast: 150,
    normal: 250,
    slow: 400,
    verySlow: 600,
  },

  // Spring configurations for Reanimated
  spring: {
    snappy: { damping: 20, stiffness: 300, mass: 0.8 },
    bouncy: { damping: 12, stiffness: 200, mass: 1 },
    smooth: { damping: 25, stiffness: 150, mass: 1 },
    gentle: { damping: 30, stiffness: 100, mass: 1.2 },
  },
} as const;

// Haptic feedback patterns
export const haptics = {
  light: 'light',
  medium: 'medium',
  heavy: 'heavy',
  success: 'success',
  warning: 'warning',
  error: 'error',
  selection: 'selection',
} as const;
