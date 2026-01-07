/**
 * Anti-Slop Validator Service
 *
 * Validates generated styles against KripTik's anti-slop rules.
 * Ensures AI-generated styles meet quality standards and brand guidelines.
 *
 * Features:
 * - Pattern matching for banned styles
 * - Design quality scoring
 * - Actionable feedback for improvements
 * - Brand consistency checking
 */

import { ANTI_SLOP_RULES } from '../ai/unified-context.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ValidationIssue {
  type: 'blocker' | 'warning' | 'suggestion';
  pattern: string;
  reason: string;
  property?: string;
  value?: string;
  fix?: string;
}

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100
  blockers: ValidationIssue[];
  warnings: ValidationIssue[];
  suggestions: ValidationIssue[];
  designPrincipleScores: {
    depth: number;
    motion: number;
    typography: number;
    color: number;
    layout: number;
  };
}

export interface StyleEntry {
  property: string;
  value: string;
  tailwindClass?: string;
  reason?: string;
}

// =============================================================================
// ANTI-SLOP PATTERNS
// =============================================================================

const INSTANT_FAIL_PATTERNS: Array<{ pattern: RegExp | string; reason: string }> = [
  // Generic AI gradients
  { pattern: /from-purple.*to-pink/i, reason: 'Classic AI slop gradient (purple-to-pink)' },
  { pattern: /from-blue.*to-purple/i, reason: 'Generic AI gradient (blue-to-purple)' },
  { pattern: /linear-gradient.*#[89a-f]{2}[0-9a-f]{4}.*#[cd][0-9a-f]{5}/i, reason: 'Generic AI gradient detected' },

  // Placeholder content
  { pattern: /coming\s*soon/i, reason: 'Placeholder text detected' },
  { pattern: /lorem\s*ipsum/i, reason: 'Lorem ipsum placeholder detected' },
  { pattern: /\bTODO\b/i, reason: 'TODO marker in styles' },
  { pattern: /\bFIXME\b/i, reason: 'FIXME marker in styles' },

  // Generic fonts without customization
  { pattern: /^font-sans$/, reason: 'Generic font-sans without custom font family' },
  { pattern: /^sans-serif$/, reason: 'Generic sans-serif fallback only' },

  // Emojis in CSS values (not in content)
  { pattern: /[\u{1F300}-\u{1F9FF}]/u, reason: 'Emoji in CSS value' },
];

const WARNING_PATTERNS: Array<{ pattern: RegExp | string; reason: string; fix?: string }> = [
  // Magic numbers without explanation
  { pattern: /: \d{3,}px/, reason: 'Large pixel value - consider using rem or design tokens', fix: 'Use rem units or spacing tokens' },

  // Inconsistent spacing
  { pattern: /margin:\s*\d+px\s+\d+px\s+\d+px\s+\d+px/, reason: 'Consider using consistent spacing values', fix: 'Use symmetric spacing or shorthand' },

  // Hardcoded colors (not from palette)
  { pattern: /#[0-9a-f]{6}/i, reason: 'Hardcoded color - verify it matches design system', fix: 'Consider using design token colors' },

  // Deprecated or problematic properties
  { pattern: /float:\s*(left|right)/, reason: 'Float layout is deprecated - use flexbox/grid', fix: 'Use display: flex or display: grid' },

  // Low contrast potential
  { pattern: /color:\s*#[89a-f]{6}/i, reason: 'Light text color - verify contrast ratio', fix: 'Ensure WCAG AA contrast ratio' },

  // Generic box shadows
  { pattern: /box-shadow:\s*0\s+0\s+10px/, reason: 'Generic shadow - consider using design token shadows', fix: 'Use shadow tokens for consistency' },
];

// =============================================================================
// DESIGN PRINCIPLE DETECTORS
// =============================================================================

const hasDepth = (styles: StyleEntry[]): number => {
  let score = 50; // Base score

  // Check for shadows
  if (styles.some(s => s.property === 'boxShadow' && s.value !== 'none')) {
    score += 15;
  }

  // Check for glassmorphism
  if (styles.some(s => s.property === 'backdropFilter' && s.value.includes('blur'))) {
    score += 20;
  }

  // Check for layered backgrounds
  if (styles.some(s => s.property === 'background' && s.value.includes('gradient'))) {
    score += 10;
  }

  // Check for border effects
  if (styles.some(s => s.property === 'border' || s.property.includes('Border'))) {
    score += 5;
  }

  return Math.min(100, score);
};

const hasMotion = (styles: StyleEntry[]): number => {
  let score = 50;

  // Check for transitions
  if (styles.some(s => s.property === 'transition')) {
    score += 25;
  }

  // Check for transforms
  if (styles.some(s => s.property === 'transform')) {
    score += 15;
  }

  // Check for animation
  if (styles.some(s => s.property === 'animation')) {
    score += 10;
  }

  return Math.min(100, score);
};

const hasTypography = (styles: StyleEntry[]): number => {
  let score = 50;

  // Check for custom font family
  if (styles.some(s => s.property === 'fontFamily' && !s.value.includes('sans-serif') && s.value.includes("'"))) {
    score += 20;
  }

  // Check for font weight variation
  if (styles.some(s => s.property === 'fontWeight' && s.value !== '400' && s.value !== 'normal')) {
    score += 10;
  }

  // Check for letter spacing
  if (styles.some(s => s.property === 'letterSpacing')) {
    score += 10;
  }

  // Check for line height
  if (styles.some(s => s.property === 'lineHeight')) {
    score += 10;
  }

  return Math.min(100, score);
};

const hasColor = (styles: StyleEntry[]): number => {
  let score = 50;

  // Check for intentional color choices
  const colorProps = styles.filter(s =>
    s.property === 'color' ||
    s.property === 'backgroundColor' ||
    s.property.includes('Color')
  );

  if (colorProps.length > 0) {
    score += 15;

    // Bonus for using design tokens (indicated by reason)
    if (colorProps.some(s => s.reason?.toLowerCase().includes('kriptik') || s.reason?.toLowerCase().includes('brand'))) {
      score += 20;
    }
  }

  // Check for accent colors
  if (styles.some(s => s.value.includes('#eab308') || s.value.includes('#facc15'))) {
    score += 15; // KripTik gold
  }

  return Math.min(100, score);
};

const hasLayout = (styles: StyleEntry[]): number => {
  let score = 50;

  // Check for modern layout
  if (styles.some(s => s.property === 'display' && (s.value === 'flex' || s.value === 'grid'))) {
    score += 20;
  }

  // Check for gap spacing
  if (styles.some(s => s.property === 'gap')) {
    score += 15;
  }

  // Check for intentional alignment
  if (styles.some(s => s.property === 'justifyContent' || s.property === 'alignItems')) {
    score += 10;
  }

  // Check for responsive considerations (via Tailwind classes)
  if (styles.some(s => s.tailwindClass?.includes(':') || s.tailwindClass?.includes('max-'))) {
    score += 5;
  }

  return Math.min(100, score);
};

// =============================================================================
// ANTI-SLOP VALIDATOR
// =============================================================================

class AntiSlopValidator {
  /**
   * Validate styles against anti-slop rules
   */
  validateStyles(styles: StyleEntry[]): ValidationResult {
    const blockers: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const suggestions: ValidationIssue[] = [];

    // Check each style against instant-fail patterns
    for (const style of styles) {
      const valueToCheck = `${style.property}: ${style.value}`;

      for (const pattern of INSTANT_FAIL_PATTERNS) {
        const regex = pattern.pattern instanceof RegExp
          ? pattern.pattern
          : new RegExp(pattern.pattern, 'i');

        if (regex.test(valueToCheck) || regex.test(style.value) || regex.test(style.tailwindClass || '')) {
          blockers.push({
            type: 'blocker',
            pattern: pattern.pattern.toString(),
            reason: pattern.reason,
            property: style.property,
            value: style.value,
          });
        }
      }

      // Check warning patterns
      for (const pattern of WARNING_PATTERNS) {
        const regex = pattern.pattern instanceof RegExp
          ? pattern.pattern
          : new RegExp(pattern.pattern, 'i');

        if (regex.test(valueToCheck)) {
          warnings.push({
            type: 'warning',
            pattern: pattern.pattern.toString(),
            reason: pattern.reason,
            property: style.property,
            value: style.value,
            fix: pattern.fix,
          });
        }
      }
    }

    // Calculate design principle scores
    const designPrincipleScores = {
      depth: hasDepth(styles),
      motion: hasMotion(styles),
      typography: hasTypography(styles),
      color: hasColor(styles),
      layout: hasLayout(styles),
    };

    // Generate suggestions based on low scores
    if (designPrincipleScores.depth < 60) {
      suggestions.push({
        type: 'suggestion',
        pattern: 'depth',
        reason: 'Consider adding depth with shadows, glassmorphism, or layered effects',
        fix: 'Add box-shadow or backdrop-filter: blur()',
      });
    }

    if (designPrincipleScores.motion < 60) {
      suggestions.push({
        type: 'suggestion',
        pattern: 'motion',
        reason: 'Consider adding transitions for interactive elements',
        fix: 'Add transition: all 0.2s ease-out',
      });
    }

    // Calculate overall score
    const avgDesignScore = Object.values(designPrincipleScores).reduce((a, b) => a + b, 0) / 5;
    const blockerPenalty = blockers.length * 20;
    const warningPenalty = warnings.length * 5;
    const score = Math.max(0, Math.min(100, avgDesignScore - blockerPenalty - warningPenalty));

    return {
      isValid: blockers.length === 0 && score >= ANTI_SLOP_RULES.thresholds.minimumDesignScore,
      score,
      blockers,
      warnings,
      suggestions,
      designPrincipleScores,
    };
  }

  /**
   * Quick check if a single value passes anti-slop rules
   */
  isValidValue(property: string, value: string): boolean {
    const valueToCheck = `${property}: ${value}`;

    for (const pattern of INSTANT_FAIL_PATTERNS) {
      const regex = pattern.pattern instanceof RegExp
        ? pattern.pattern
        : new RegExp(pattern.pattern, 'i');

      if (regex.test(valueToCheck) || regex.test(value)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get design quality score for a set of styles
   */
  getDesignScore(styles: StyleEntry[]): number {
    const scores = {
      depth: hasDepth(styles),
      motion: hasMotion(styles),
      typography: hasTypography(styles),
      color: hasColor(styles),
      layout: hasLayout(styles),
    };

    return Object.values(scores).reduce((a, b) => a + b, 0) / 5;
  }

  /**
   * Suggest improvements for a style
   */
  suggestImprovements(property: string, value: string): string[] {
    const suggestions: string[] = [];

    // Color improvements
    if (property === 'backgroundColor' || property === 'color') {
      if (!value.startsWith('var(') && !value.includes('rgb')) {
        suggestions.push('Consider using a design token variable for consistency');
      }
    }

    // Shadow improvements
    if (property === 'boxShadow') {
      if (value === 'none') {
        suggestions.push('Adding a subtle shadow can improve depth perception');
      } else if (!value.includes('rgba')) {
        suggestions.push('Use rgba() for shadow colors to enable transparency');
      }
    }

    // Transition improvements
    if (property === 'transition') {
      if (value === 'all') {
        suggestions.push('Specify exact properties to transition for better performance');
      }
    }

    // Border radius improvements
    if (property === 'borderRadius') {
      if (value === '0' || value === '0px') {
        suggestions.push('Consider soft corners (border-radius: 0.5rem) for modern UI');
      }
    }

    return suggestions;
  }
}

// Singleton instance
export const antiSlopValidator = new AntiSlopValidator();
export default antiSlopValidator;
