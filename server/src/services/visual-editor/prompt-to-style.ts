/**
 * Prompt-to-Style Service
 *
 * AI-powered style generation from natural language prompts.
 * Integrates with KripTik's design tokens and anti-slop detection.
 *
 * Features:
 * - Natural language to CSS/Tailwind conversion
 * - Context-aware style suggestions
 * - Design token awareness
 * - Anti-slop validation before returning styles
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { ANTI_SLOP_RULES, PROVIDER_CODE_HINTS } from '../ai/unified-context.js';
import { antiSlopValidator, type ValidationResult } from './anti-slop-validator.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ElementContext {
  id: string;
  tagName: string;
  componentName?: string;
  className?: string;
  currentStyles?: Record<string, string>;
  parentContext?: {
    tagName: string;
    className?: string;
    isFlexContainer?: boolean;
    isGridContainer?: boolean;
  };
  siblingCount?: number;
  childCount?: number;
  sourceFile?: string;
  sourceLine?: number;
}

export interface StylePromptRequest {
  prompt: string;
  elementContext: ElementContext;
  projectContext?: {
    designTokens?: Record<string, string>;
    colorPalette?: string[];
    fontFamily?: string;
    appSoul?: string;
    styleFormat?: 'tailwind' | 'css' | 'inline';
  };
  userId: string;
  projectId?: string;
}

export interface GeneratedStyle {
  property: string;
  value: string;
  tailwindClass?: string;
  reason?: string;
}

export interface StylePromptResponse {
  styles: GeneratedStyle[];
  tailwindClasses: string[];
  cssDeclarations: string;
  inlineStyle: string;
  validation: ValidationResult;
  suggestions: string[];
  reasoning?: string;
}

// =============================================================================
// KRIPTIK DESIGN TOKENS (Server-side reference)
// =============================================================================

const KRIPTIK_DESIGN_TOKENS = {
  colors: {
    primary: {
      50: '#fefce8',
      100: '#fef9c3',
      200: '#fef08a',
      300: '#fde047',
      400: '#facc15',
      500: '#eab308',
      600: '#ca8a04',
      700: '#a16207',
      800: '#854d0e',
      900: '#713f12',
    },
    neutral: {
      50: '#fafafa',
      100: '#f4f4f5',
      200: '#e4e4e7',
      300: '#d4d4d8',
      400: '#a1a1aa',
      500: '#71717a',
      600: '#52525b',
      700: '#3f3f46',
      800: '#27272a',
      900: '#18181b',
      950: '#0f0f11',
    },
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
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
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
    glass: '0 8px 32px rgba(0, 0, 0, 0.12)',
    glow: '0 0 20px rgba(234, 179, 8, 0.3)',
  },
  fonts: {
    sans: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    mono: "'Space Mono', 'SF Mono', monospace",
    display: "'Space Grotesk', 'DM Sans', sans-serif",
  },
};

// =============================================================================
// PROMPT-TO-STYLE SERVICE
// =============================================================================

export class PromptToStyleService {
  private anthropicClient: Anthropic | null = null;

  constructor() {
    this.initializeClient();
  }

  private async initializeClient() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }

  /**
   * Generate styles from a natural language prompt
   */
  async generateStylesFromPrompt(request: StylePromptRequest): Promise<StylePromptResponse> {
    const { prompt, elementContext, projectContext } = request;

    // Build context for the AI
    const systemPrompt = this.buildSystemPrompt(projectContext);
    const userPrompt = this.buildUserPrompt(prompt, elementContext, projectContext);

    try {
      // Use Claude for intelligent style generation
      if (this.anthropicClient) {
        const response = await this.anthropicClient.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });

        // Parse the AI response
        const textContent = response.content.find(c => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
          throw new Error('No text response from AI');
        }

        const parsed = this.parseAIResponse(textContent.text);

        // Validate against anti-slop rules
        const validation = antiSlopValidator.validateStyles(parsed.styles);

        // If validation fails, attempt to fix the styles
        if (!validation.isValid && validation.blockers.length > 0) {
          const fixedStyles = await this.fixSlopStyles(parsed.styles, validation);
          const revalidation = antiSlopValidator.validateStyles(fixedStyles);

          return {
            styles: fixedStyles,
            tailwindClasses: this.stylesToTailwind(fixedStyles),
            cssDeclarations: this.stylesToCSS(fixedStyles),
            inlineStyle: this.stylesToInline(fixedStyles),
            validation: revalidation,
            suggestions: parsed.suggestions || [],
            reasoning: parsed.reasoning,
          };
        }

        return {
          styles: parsed.styles,
          tailwindClasses: this.stylesToTailwind(parsed.styles),
          cssDeclarations: this.stylesToCSS(parsed.styles),
          inlineStyle: this.stylesToInline(parsed.styles),
          validation,
          suggestions: parsed.suggestions || [],
          reasoning: parsed.reasoning,
        };
      }

      // Fallback: Rule-based style generation
      return this.generateFallbackStyles(prompt, elementContext);
    } catch (error) {
      console.error('[PromptToStyle] Error generating styles:', error);
      return this.generateFallbackStyles(prompt, elementContext);
    }
  }

  /**
   * Build the system prompt for style generation
   */
  private buildSystemPrompt(projectContext?: StylePromptRequest['projectContext']): string {
    const tokenContext = projectContext?.designTokens
      ? `\nProject Design Tokens:\n${JSON.stringify(projectContext.designTokens, null, 2)}`
      : '';

    const colorContext = projectContext?.colorPalette
      ? `\nColor Palette: ${projectContext.colorPalette.join(', ')}`
      : '';

    const soulContext = projectContext?.appSoul
      ? `\nApp Soul/Identity: ${projectContext.appSoul}`
      : '';

    return `You are a CSS and design expert for KripTik AI, a premium web application builder.

Your job is to convert natural language descriptions into precise CSS styles that match the user's intent.

## Design Philosophy
${ANTI_SLOP_RULES.designPrinciples.join('\n')}

## CRITICAL: Anti-Slop Rules
These patterns are BANNED and must NEVER be used:
${ANTI_SLOP_RULES.instantFailPatterns.map(p => `- ${p.pattern}: ${p.reason}`).join('\n')}

## KripTik Design System
${JSON.stringify(KRIPTIK_DESIGN_TOKENS, null, 2)}
${tokenContext}
${colorContext}
${soulContext}

## Response Format
Respond with a JSON object containing:
{
  "styles": [
    { "property": "camelCase property", "value": "CSS value", "tailwindClass": "optional", "reason": "why" }
  ],
  "suggestions": ["additional recommendations"],
  "reasoning": "brief explanation of design choices"
}

## Guidelines
1. Use KripTik design tokens when possible
2. Prefer semantic values over magic numbers
3. Consider accessibility (color contrast, font sizes)
4. Use appropriate units (rem for spacing/fonts, px for borders)
5. Apply smooth transitions for interactive properties
6. NEVER use generic AI gradients (purple-to-pink, blue-to-purple)
7. NEVER include placeholder text or emojis
8. Ensure depth through shadows and layers
9. Use glassmorphism when appropriate for modern UI`;
  }

  /**
   * Build the user prompt with element context
   */
  private buildUserPrompt(
    prompt: string,
    elementContext: ElementContext,
    projectContext?: StylePromptRequest['projectContext']
  ): string {
    const contextInfo = `
## Element Context
- Tag: <${elementContext.tagName}>
- Component: ${elementContext.componentName || 'N/A'}
- Current Classes: ${elementContext.className || 'none'}
- Children: ${elementContext.childCount || 0}
- Parent Layout: ${elementContext.parentContext?.isFlexContainer ? 'flex' : elementContext.parentContext?.isGridContainer ? 'grid' : 'block'}

## Current Styles
${elementContext.currentStyles ? JSON.stringify(elementContext.currentStyles, null, 2) : 'No current styles'}

## Style Format Preference
${projectContext?.styleFormat || 'tailwind'}
`;

    return `${contextInfo}

## User Request
"${prompt}"

Generate the appropriate CSS styles for this request. Ensure styles are valid, follow the design system, and avoid anti-slop patterns.`;
  }

  /**
   * Parse the AI response into structured styles
   */
  private parseAIResponse(response: string): {
    styles: GeneratedStyle[];
    suggestions: string[];
    reasoning?: string;
  } {
    try {
      // Extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { styles: [], suggestions: ['Could not parse AI response'] };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        styles: parsed.styles || [],
        suggestions: parsed.suggestions || [],
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      console.error('[PromptToStyle] Failed to parse AI response:', error);
      return { styles: [], suggestions: ['Failed to parse response'] };
    }
  }

  /**
   * Fix styles that triggered anti-slop rules
   */
  private async fixSlopStyles(
    styles: GeneratedStyle[],
    validation: ValidationResult
  ): Promise<GeneratedStyle[]> {
    const fixedStyles = [...styles];

    for (const blocker of validation.blockers) {
      // Find and fix the problematic style
      const styleIndex = fixedStyles.findIndex(
        s => s.value.includes(blocker.pattern) || s.property.includes(blocker.pattern)
      );

      if (styleIndex !== -1) {
        const style = fixedStyles[styleIndex];

        // Apply automatic fixes for common issues
        if (blocker.pattern.includes('purple') && blocker.pattern.includes('pink')) {
          // Replace slop gradient with KripTik gold gradient
          fixedStyles[styleIndex] = {
            ...style,
            value: 'linear-gradient(135deg, #fde047 0%, #eab308 50%, #ca8a04 100%)',
            reason: 'Auto-fixed: Replaced generic gradient with KripTik brand gradient',
          };
        } else if (blocker.pattern === 'font-sans') {
          // Replace with KripTik font
          fixedStyles[styleIndex] = {
            ...style,
            value: KRIPTIK_DESIGN_TOKENS.fonts.sans,
            reason: 'Auto-fixed: Applied KripTik font family',
          };
        } else {
          // Remove the problematic style
          fixedStyles.splice(styleIndex, 1);
        }
      }
    }

    return fixedStyles;
  }

  /**
   * Convert styles to Tailwind classes
   */
  private stylesToTailwind(styles: GeneratedStyle[]): string[] {
    const classes: string[] = [];

    for (const style of styles) {
      if (style.tailwindClass) {
        classes.push(style.tailwindClass);
      }
    }

    return classes;
  }

  /**
   * Convert styles to CSS declaration block
   */
  private stylesToCSS(styles: GeneratedStyle[]): string {
    return styles
      .map(s => {
        const kebabProperty = s.property.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `  ${kebabProperty}: ${s.value};`;
      })
      .join('\n');
  }

  /**
   * Convert styles to inline style string
   */
  private stylesToInline(styles: GeneratedStyle[]): string {
    return styles.map(s => `${s.property}: ${s.value}`).join('; ');
  }

  /**
   * Fallback rule-based style generation when AI is unavailable
   */
  private generateFallbackStyles(
    prompt: string,
    elementContext: ElementContext
  ): StylePromptResponse {
    const styles: GeneratedStyle[] = [];
    const promptLower = prompt.toLowerCase();

    // Color keywords
    if (promptLower.includes('gold') || promptLower.includes('yellow') || promptLower.includes('brand')) {
      styles.push({
        property: 'color',
        value: KRIPTIK_DESIGN_TOKENS.colors.primary[500],
        tailwindClass: 'text-yellow-500',
        reason: 'Applied KripTik brand gold color',
      });
    }

    if (promptLower.includes('dark') || promptLower.includes('black')) {
      styles.push({
        property: 'backgroundColor',
        value: KRIPTIK_DESIGN_TOKENS.colors.neutral[900],
        tailwindClass: 'bg-neutral-900',
        reason: 'Applied dark background',
      });
    }

    // Layout keywords
    if (promptLower.includes('center')) {
      styles.push(
        { property: 'display', value: 'flex', tailwindClass: 'flex' },
        { property: 'justifyContent', value: 'center', tailwindClass: 'justify-center' },
        { property: 'alignItems', value: 'center', tailwindClass: 'items-center' }
      );
    }

    if (promptLower.includes('row') || promptLower.includes('horizontal')) {
      styles.push(
        { property: 'display', value: 'flex', tailwindClass: 'flex' },
        { property: 'flexDirection', value: 'row', tailwindClass: 'flex-row' }
      );
    }

    if (promptLower.includes('column') || promptLower.includes('vertical') || promptLower.includes('stack')) {
      styles.push(
        { property: 'display', value: 'flex', tailwindClass: 'flex' },
        { property: 'flexDirection', value: 'column', tailwindClass: 'flex-col' }
      );
    }

    // Spacing keywords
    if (promptLower.includes('more space') || promptLower.includes('padding')) {
      styles.push({
        property: 'padding',
        value: KRIPTIK_DESIGN_TOKENS.spacing.lg,
        tailwindClass: 'p-6',
        reason: 'Added comfortable padding',
      });
    }

    if (promptLower.includes('gap') || promptLower.includes('space between')) {
      styles.push({
        property: 'gap',
        value: KRIPTIK_DESIGN_TOKENS.spacing.md,
        tailwindClass: 'gap-4',
        reason: 'Added spacing between items',
      });
    }

    // Visual effects
    if (promptLower.includes('rounded') || promptLower.includes('border radius')) {
      styles.push({
        property: 'borderRadius',
        value: KRIPTIK_DESIGN_TOKENS.borderRadius.lg,
        tailwindClass: 'rounded-lg',
        reason: 'Applied rounded corners',
      });
    }

    if (promptLower.includes('shadow') || promptLower.includes('elevation')) {
      styles.push({
        property: 'boxShadow',
        value: KRIPTIK_DESIGN_TOKENS.shadows.lg,
        tailwindClass: 'shadow-lg',
        reason: 'Added shadow for depth',
      });
    }

    if (promptLower.includes('glass') || promptLower.includes('blur')) {
      styles.push(
        { property: 'backdropFilter', value: 'blur(20px)', tailwindClass: 'backdrop-blur-xl' },
        { property: 'backgroundColor', value: 'rgba(255, 255, 255, 0.05)', tailwindClass: 'bg-white/5' }
      );
    }

    // Typography
    if (promptLower.includes('bold') || promptLower.includes('strong')) {
      styles.push({
        property: 'fontWeight',
        value: '700',
        tailwindClass: 'font-bold',
        reason: 'Applied bold font weight',
      });
    }

    if (promptLower.includes('larger') || promptLower.includes('bigger')) {
      styles.push({
        property: 'fontSize',
        value: '1.25rem',
        tailwindClass: 'text-xl',
        reason: 'Increased font size',
      });
    }

    if (promptLower.includes('smaller')) {
      styles.push({
        property: 'fontSize',
        value: '0.875rem',
        tailwindClass: 'text-sm',
        reason: 'Decreased font size',
      });
    }

    // Validate the generated styles
    const validation = antiSlopValidator.validateStyles(styles);

    return {
      styles,
      tailwindClasses: this.stylesToTailwind(styles),
      cssDeclarations: this.stylesToCSS(styles),
      inlineStyle: this.stylesToInline(styles),
      validation,
      suggestions: styles.length === 0
        ? ['Try being more specific, e.g., "make it centered with a dark background"']
        : [],
      reasoning: 'Generated using rule-based fallback (AI unavailable)',
    };
  }
}

// Singleton instance
let promptToStyleService: PromptToStyleService | null = null;

export function getPromptToStyleService(): PromptToStyleService {
  if (!promptToStyleService) {
    promptToStyleService = new PromptToStyleService();
  }
  return promptToStyleService;
}

export default getPromptToStyleService;
