/**
 * Design Tokens Bridge - Connects visual editor to KripTik design token system
 *
 * Features:
 * - Converts design tokens to visual editor presets
 * - Validates styles against design system
 * - Generates token-aligned CSS
 * - Provides design system hints and autocomplete
 */

// Design token types
export interface DesignTokens {
  colors: {
    primary: { from: string; to: string; gradient: string };
    background: { base: string; elevated: string; surface: string };
    surface: { glass: string; card: string; overlay: string };
    text: { primary: string; secondary: string; muted: string; inverse: string };
    accent: { success: string; warning: string; error: string; info: string };
    border: { subtle: string; default: string; focus: string };
  };
  shadows: {
    glow: { primary: string; success: string; error: string };
    card: { default: string; hover: string; elevated: string };
    glass: string;
  };
  typography: {
    fonts: { heading: string; body: string; mono: string };
    sizes: Record<string, { size: string; lineHeight: string }>;
    weights: { normal: number; medium: number; semibold: number; bold: number };
  };
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
  animations: {
    duration: Record<string, string>;
    easing: Record<string, string>;
  };
  zIndex: Record<string, number>;
}

// Default KripTik design tokens
export const KRIPTIK_TOKENS: DesignTokens = {
  colors: {
    primary: {
      from: '#fbbf24',
      to: '#f97316',
      gradient: 'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)',
    },
    background: {
      base: '#0a0a0f',
      elevated: '#0f0f14',
      surface: '#1a1a24',
    },
    surface: {
      glass: 'rgba(30, 30, 40, 0.5)',
      card: 'rgba(26, 26, 36, 0.8)',
      overlay: 'rgba(0, 0, 0, 0.6)',
    },
    text: {
      primary: '#ffffff',
      secondary: '#94a3b8',
      muted: '#64748b',
      inverse: '#0a0a0f',
    },
    accent: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#06b6d4',
    },
    border: {
      subtle: 'rgba(255, 255, 255, 0.1)',
      default: 'rgba(255, 255, 255, 0.15)',
      focus: 'rgba(251, 191, 36, 0.5)',
    },
  },
  shadows: {
    glow: {
      primary: '0 8px 32px rgba(251, 191, 36, 0.15)',
      success: '0 8px 32px rgba(16, 185, 129, 0.15)',
      error: '0 8px 32px rgba(239, 68, 68, 0.15)',
    },
    card: {
      default: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.2)',
      hover: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
      elevated: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    },
    glass: '0 4px 30px rgba(0, 0, 0, 0.2)',
  },
  typography: {
    fonts: {
      heading: "'Inter', 'system-ui', sans-serif",
      body: "'Inter', 'system-ui', sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', monospace",
    },
    sizes: {
      xs: { size: '0.75rem', lineHeight: '1rem' },
      sm: { size: '0.875rem', lineHeight: '1.25rem' },
      base: { size: '1rem', lineHeight: '1.5rem' },
      lg: { size: '1.125rem', lineHeight: '1.75rem' },
      xl: { size: '1.25rem', lineHeight: '1.75rem' },
      '2xl': { size: '1.5rem', lineHeight: '2rem' },
      '3xl': { size: '1.875rem', lineHeight: '2.25rem' },
      '4xl': { size: '2.25rem', lineHeight: '2.5rem' },
      '5xl': { size: '3rem', lineHeight: '1.2' },
    },
    weights: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  borderRadius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
    full: '9999px',
  },
  animations: {
    duration: {
      fast: '150ms',
      normal: '200ms',
      slow: '300ms',
      slower: '500ms',
    },
    easing: {
      default: 'cubic-bezier(0.4, 0, 0.2, 1)',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
      inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },
  zIndex: {
    base: 0,
    dropdown: 10,
    sticky: 20,
    modal: 30,
    popover: 40,
    toast: 50,
  },
};

// Color preset generator from tokens
export function generateColorPresets(tokens: DesignTokens) {
  return {
    backgrounds: [
      { label: 'Base', value: tokens.colors.background.base },
      { label: 'Elevated', value: tokens.colors.background.elevated },
      { label: 'Surface', value: tokens.colors.background.surface },
      { label: 'Glass', value: tokens.colors.surface.glass },
      { label: 'Card', value: tokens.colors.surface.card },
      { label: 'Transparent', value: 'transparent' },
    ],
    accents: [
      { label: 'Primary From', value: tokens.colors.primary.from },
      { label: 'Primary To', value: tokens.colors.primary.to },
      { label: 'Success', value: tokens.colors.accent.success },
      { label: 'Warning', value: tokens.colors.accent.warning },
      { label: 'Error', value: tokens.colors.accent.error },
      { label: 'Info', value: tokens.colors.accent.info },
    ],
    text: [
      { label: 'Primary', value: tokens.colors.text.primary },
      { label: 'Secondary', value: tokens.colors.text.secondary },
      { label: 'Muted', value: tokens.colors.text.muted },
      { label: 'Inverse', value: tokens.colors.text.inverse },
    ],
    borders: [
      { label: 'Subtle', value: tokens.colors.border.subtle },
      { label: 'Default', value: tokens.colors.border.default },
      { label: 'Focus', value: tokens.colors.border.focus },
    ],
  };
}

// Shadow preset generator from tokens
export function generateShadowPresets(tokens: DesignTokens) {
  return [
    { label: 'None', value: 'none' },
    { label: 'Card Default', value: tokens.shadows.card.default },
    { label: 'Card Hover', value: tokens.shadows.card.hover },
    { label: 'Card Elevated', value: tokens.shadows.card.elevated },
    { label: 'Glass', value: tokens.shadows.glass },
    { label: 'Glow Primary', value: tokens.shadows.glow.primary },
    { label: 'Glow Success', value: tokens.shadows.glow.success },
    { label: 'Glow Error', value: tokens.shadows.glow.error },
  ];
}

// Border radius preset generator from tokens
export function generateRadiusPresets(tokens: DesignTokens) {
  return Object.entries(tokens.borderRadius).map(([label, value]) => ({
    label: label.charAt(0).toUpperCase() + label.slice(1),
    value,
  }));
}

// Spacing preset generator from tokens
export function generateSpacingPresets(tokens: DesignTokens) {
  return Object.entries(tokens.spacing).map(([label, value]) => ({
    label: label.toUpperCase(),
    value,
  }));
}

// Validate a color against design tokens
export function validateColorAgainstTokens(color: string, tokens: DesignTokens): boolean {
  const allColors = [
    ...Object.values(tokens.colors.background),
    ...Object.values(tokens.colors.surface),
    ...Object.values(tokens.colors.text),
    ...Object.values(tokens.colors.accent),
    ...Object.values(tokens.colors.border),
    tokens.colors.primary.from,
    tokens.colors.primary.to,
  ];

  return allColors.some((tokenColor) => color === tokenColor);
}

// Get closest design token for a value
export function findClosestToken(
  value: string,
  type: 'spacing' | 'radius' | 'shadow',
  tokens: DesignTokens
): { name: string; value: string } | null {
  const tokenMap = type === 'spacing'
    ? tokens.spacing
    : type === 'radius'
      ? tokens.borderRadius
      : null;

  if (!tokenMap) return null;

  // Parse numeric value
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return null;

  // Find closest match
  let closest: { name: string; value: string } | null = null;
  let minDiff = Infinity;

  for (const [name, tokenValue] of Object.entries(tokenMap)) {
    const tokenNum = parseFloat(tokenValue);
    const diff = Math.abs(tokenNum - numValue);
    if (diff < minDiff) {
      minDiff = diff;
      closest = { name, value: tokenValue };
    }
  }

  return closest;
}

// Convert styles to Tailwind classes where possible
export function stylesToTailwind(styles: Record<string, string>): string[] {
  const classes: string[] = [];

  // Common mappings
  const mappings: Record<string, Record<string, string>> = {
    display: {
      flex: 'flex',
      block: 'block',
      inline: 'inline',
      grid: 'grid',
      'inline-flex': 'inline-flex',
      'inline-block': 'inline-block',
      none: 'hidden',
    },
    flexDirection: {
      row: 'flex-row',
      column: 'flex-col',
      'row-reverse': 'flex-row-reverse',
      'column-reverse': 'flex-col-reverse',
    },
    justifyContent: {
      'flex-start': 'justify-start',
      'flex-end': 'justify-end',
      center: 'justify-center',
      'space-between': 'justify-between',
      'space-around': 'justify-around',
      'space-evenly': 'justify-evenly',
    },
    alignItems: {
      'flex-start': 'items-start',
      'flex-end': 'items-end',
      center: 'items-center',
      stretch: 'items-stretch',
      baseline: 'items-baseline',
    },
    flexWrap: {
      nowrap: 'flex-nowrap',
      wrap: 'flex-wrap',
      'wrap-reverse': 'flex-wrap-reverse',
    },
    textAlign: {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
      justify: 'text-justify',
    },
    fontWeight: {
      '100': 'font-thin',
      '200': 'font-extralight',
      '300': 'font-light',
      '400': 'font-normal',
      '500': 'font-medium',
      '600': 'font-semibold',
      '700': 'font-bold',
      '800': 'font-extrabold',
      '900': 'font-black',
    },
    position: {
      static: 'static',
      relative: 'relative',
      absolute: 'absolute',
      fixed: 'fixed',
      sticky: 'sticky',
    },
    overflow: {
      visible: 'overflow-visible',
      hidden: 'overflow-hidden',
      scroll: 'overflow-scroll',
      auto: 'overflow-auto',
    },
  };

  for (const [prop, value] of Object.entries(styles)) {
    if (value && mappings[prop]?.[value]) {
      classes.push(mappings[prop][value]);
    }
  }

  return classes;
}

// Generate inline CSS from styles object
export function generateInlineCSS(styles: Record<string, string>): string {
  return Object.entries(styles)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => {
      // Convert camelCase to kebab-case
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssKey}: ${value}`;
    })
    .join('; ');
}

// Design tokens bridge singleton
class DesignTokensBridge {
  private tokens: DesignTokens = KRIPTIK_TOKENS;

  setTokens(tokens: DesignTokens) {
    this.tokens = tokens;
  }

  getTokens(): DesignTokens {
    return this.tokens;
  }

  getColorPresets() {
    return generateColorPresets(this.tokens);
  }

  getShadowPresets() {
    return generateShadowPresets(this.tokens);
  }

  getRadiusPresets() {
    return generateRadiusPresets(this.tokens);
  }

  getSpacingPresets() {
    return generateSpacingPresets(this.tokens);
  }

  validateColor(color: string): boolean {
    return validateColorAgainstTokens(color, this.tokens);
  }

  findClosestToken(value: string, type: 'spacing' | 'radius' | 'shadow') {
    return findClosestToken(value, type, this.tokens);
  }

  toTailwind(styles: Record<string, string>): string[] {
    return stylesToTailwind(styles);
  }

  toInlineCSS(styles: Record<string, string>): string {
    return generateInlineCSS(styles);
  }
}

export const designTokensBridge = new DesignTokensBridge();
export default designTokensBridge;
