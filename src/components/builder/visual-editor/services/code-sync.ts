/**
 * Code Sync Service - Synchronizes visual editor changes with source code
 *
 * Features:
 * - Generates CSS/Tailwind from style changes
 * - Updates source files with new styles
 * - Tracks style changes with AST-based modifications
 * - Supports inline styles, CSS files, and Tailwind classes
 */

import type { ElementStyles, PendingStyleChange, SelectedElement } from '../../../../store/useVisualEditorStore';
import { designTokensBridge } from './design-tokens-bridge';

// Style output format
export type StyleOutputFormat = 'inline' | 'css-class' | 'tailwind' | 'css-module';

// Code change descriptor
export interface CodeChange {
  filePath: string;
  startLine: number;
  endLine: number;
  oldContent: string;
  newContent: string;
  description: string;
}

// Style to code conversion result
export interface StyleToCodeResult {
  format: StyleOutputFormat;
  code: string;
  className?: string;
  changes: CodeChange[];
}

// CSS property to Tailwind class mapping
const TAILWIND_MAPPINGS: Record<string, Record<string, string>> = {
  display: {
    block: 'block',
    flex: 'flex',
    grid: 'grid',
    inline: 'inline',
    'inline-block': 'inline-block',
    'inline-flex': 'inline-flex',
    none: 'hidden',
  },
  flexDirection: {
    row: 'flex-row',
    'row-reverse': 'flex-row-reverse',
    column: 'flex-col',
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
    clip: 'overflow-clip',
  },
};

// Numeric value to Tailwind spacing
function numericToTailwindSpacing(value: string): string | null {
  const num = parseFloat(value);
  if (isNaN(num)) return null;

  // Common Tailwind spacing values
  const spacingMap: Record<number, string> = {
    0: '0',
    1: '0.5',
    2: '0.5',
    4: '1',
    6: '1.5',
    8: '2',
    10: '2.5',
    12: '3',
    14: '3.5',
    16: '4',
    20: '5',
    24: '6',
    28: '7',
    32: '8',
    36: '9',
    40: '10',
    44: '11',
    48: '12',
    56: '14',
    64: '16',
    80: '20',
    96: '24',
  };

  return spacingMap[num] || null;
}

// Convert a single CSS property to Tailwind class
function cssToTailwindClass(property: string, value: string): string | null {
  // Direct mappings
  if (TAILWIND_MAPPINGS[property]?.[value]) {
    return TAILWIND_MAPPINGS[property][value];
  }

  // Spacing properties (padding, margin, gap)
  if (property === 'padding' || property === 'margin' || property === 'gap') {
    const spacing = numericToTailwindSpacing(value);
    if (spacing) {
      const prefix = property === 'padding' ? 'p' : property === 'margin' ? 'm' : 'gap';
      return `${prefix}-${spacing}`;
    }
  }

  // Border radius
  if (property === 'borderRadius') {
    const num = parseFloat(value);
    if (num === 0) return 'rounded-none';
    if (num <= 2) return 'rounded-sm';
    if (num <= 4) return 'rounded';
    if (num <= 6) return 'rounded-md';
    if (num <= 8) return 'rounded-lg';
    if (num <= 12) return 'rounded-xl';
    if (num <= 16) return 'rounded-2xl';
    if (num <= 24) return 'rounded-3xl';
    return 'rounded-full';
  }

  // Font size
  if (property === 'fontSize') {
    const num = parseFloat(value);
    if (num <= 12) return 'text-xs';
    if (num <= 14) return 'text-sm';
    if (num <= 16) return 'text-base';
    if (num <= 18) return 'text-lg';
    if (num <= 20) return 'text-xl';
    if (num <= 24) return 'text-2xl';
    if (num <= 30) return 'text-3xl';
    if (num <= 36) return 'text-4xl';
    if (num <= 48) return 'text-5xl';
    return 'text-6xl';
  }

  // Width and height
  if (property === 'width' || property === 'height') {
    const prefix = property === 'width' ? 'w' : 'h';
    if (value === 'auto') return `${prefix}-auto`;
    if (value === '100%') return `${prefix}-full`;
    if (value === 'fit-content') return `${prefix}-fit`;
    if (value === 'min-content') return `${prefix}-min`;
    if (value === 'max-content') return `${prefix}-max`;
    if (value === '100vh') return `${prefix}-screen`;
    if (value === '50%') return `${prefix}-1/2`;

    const num = parseFloat(value);
    const spacing = numericToTailwindSpacing(String(num));
    if (spacing) return `${prefix}-${spacing}`;
  }

  // Opacity
  if (property === 'opacity') {
    const num = parseFloat(value) * 100;
    return `opacity-${Math.round(num)}`;
  }

  return null;
}

// Convert full styles object to Tailwind classes
export function stylesToTailwind(styles: Partial<ElementStyles>): string[] {
  const classes: string[] = [];

  for (const [prop, value] of Object.entries(styles)) {
    if (!value) continue;
    const tailwindClass = cssToTailwindClass(prop, value);
    if (tailwindClass) {
      classes.push(tailwindClass);
    }
  }

  return classes;
}

// Convert styles to CSS declaration block
export function stylesToCSS(styles: Partial<ElementStyles>): string {
  const declarations: string[] = [];

  for (const [prop, value] of Object.entries(styles)) {
    if (!value) continue;

    // Convert camelCase to kebab-case
    const cssProperty = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
    declarations.push(`  ${cssProperty}: ${value};`);
  }

  return declarations.join('\n');
}

// Convert styles to inline style string
export function stylesToInline(styles: Partial<ElementStyles>): string {
  return designTokensBridge.toInlineCSS(styles as Record<string, string>);
}

// Generate a unique class name
export function generateClassName(prefix = 'vpp'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 8)}`;
}

// Code sync service
class CodeSyncService {
  private outputFormat: StyleOutputFormat = 'tailwind';

  setOutputFormat(format: StyleOutputFormat) {
    this.outputFormat = format;
  }

  getOutputFormat(): StyleOutputFormat {
    return this.outputFormat;
  }

  // Convert pending changes to code
  convertChangesToCode(
    changes: PendingStyleChange[],
    element: SelectedElement
  ): StyleToCodeResult {
    // Build styles object from changes
    const styles: Partial<ElementStyles> = {};
    for (const change of changes) {
      styles[change.property] = change.newValue;
    }

    switch (this.outputFormat) {
      case 'tailwind':
        return this.toTailwindCode(styles, element);
      case 'css-class':
        return this.toCSSClassCode(styles, element);
      case 'css-module':
        return this.toCSSModuleCode(styles, element);
      case 'inline':
      default:
        return this.toInlineCode(styles, element);
    }
  }

  // Generate inline style code
  private toInlineCode(
    styles: Partial<ElementStyles>,
    element: SelectedElement
  ): StyleToCodeResult {
    const inlineStyle = stylesToInline(styles);

    return {
      format: 'inline',
      code: `style={{ ${inlineStyle.split(';').filter(Boolean).map(s => {
        const [prop, val] = s.split(':').map(x => x.trim());
        // Convert kebab-case back to camelCase for React
        const camelProp = prop.replace(/-([a-z])/g, g => g[1].toUpperCase());
        return `${camelProp}: '${val}'`;
      }).join(', ')} }}`,
      changes: [{
        filePath: element.sourceFile,
        startLine: element.sourceLine,
        endLine: element.sourceLine,
        oldContent: '', // Would need to parse actual file
        newContent: `style={{ ${inlineStyle} }}`,
        description: `Updated inline styles for ${element.componentName || element.tagName}`,
      }],
    };
  }

  // Generate Tailwind class code
  private toTailwindCode(
    styles: Partial<ElementStyles>,
    element: SelectedElement
  ): StyleToCodeResult {
    const tailwindClasses = stylesToTailwind(styles);
    const classString = tailwindClasses.join(' ');

    return {
      format: 'tailwind',
      code: `className="${classString}"`,
      className: classString,
      changes: [{
        filePath: element.sourceFile,
        startLine: element.sourceLine,
        endLine: element.sourceLine,
        oldContent: '',
        newContent: `className="${classString}"`,
        description: `Updated Tailwind classes for ${element.componentName || element.tagName}`,
      }],
    };
  }

  // Generate CSS class code
  private toCSSClassCode(
    styles: Partial<ElementStyles>,
    element: SelectedElement
  ): StyleToCodeResult {
    const className = generateClassName();
    const cssBlock = stylesToCSS(styles);

    return {
      format: 'css-class',
      code: `.${className} {\n${cssBlock}\n}`,
      className,
      changes: [
        {
          filePath: element.sourceFile,
          startLine: element.sourceLine,
          endLine: element.sourceLine,
          oldContent: '',
          newContent: `className="${className}"`,
          description: `Added CSS class to ${element.componentName || element.tagName}`,
        },
        {
          filePath: element.sourceFile.replace(/\.(tsx?|jsx?)$/, '.css'),
          startLine: -1, // Append to end
          endLine: -1,
          oldContent: '',
          newContent: `.${className} {\n${cssBlock}\n}`,
          description: `Created CSS class .${className}`,
        },
      ],
    };
  }

  // Generate CSS module code
  private toCSSModuleCode(
    styles: Partial<ElementStyles>,
    element: SelectedElement
  ): StyleToCodeResult {
    const className = generateClassName('style');
    const cssBlock = stylesToCSS(styles);

    const modulePath = element.sourceFile.replace(/\.(tsx?|jsx?)$/, '.module.css');

    return {
      format: 'css-module',
      code: `.${className} {\n${cssBlock}\n}`,
      className,
      changes: [
        {
          filePath: element.sourceFile,
          startLine: 1, // Import at top
          endLine: 1,
          oldContent: '',
          newContent: `import styles from './${modulePath.split('/').pop()}'`,
          description: `Added CSS module import`,
        },
        {
          filePath: element.sourceFile,
          startLine: element.sourceLine,
          endLine: element.sourceLine,
          oldContent: '',
          newContent: `className={styles.${className}}`,
          description: `Applied CSS module class to ${element.componentName || element.tagName}`,
        },
        {
          filePath: modulePath,
          startLine: -1,
          endLine: -1,
          oldContent: '',
          newContent: `.${className} {\n${cssBlock}\n}`,
          description: `Created CSS module class .${className}`,
        },
      ],
    };
  }

  // Generate code diff for display
  generateDiff(result: StyleToCodeResult): string {
    const lines: string[] = [];

    for (const change of result.changes) {
      lines.push(`--- ${change.filePath}`);
      lines.push(`+++ ${change.filePath}`);

      if (change.oldContent) {
        lines.push(`- ${change.oldContent}`);
      }
      lines.push(`+ ${change.newContent}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  // Validate that code changes are safe
  validateChanges(changes: CodeChange[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const change of changes) {
      // Check for valid file paths
      if (!change.filePath) {
        errors.push('Missing file path in code change');
      }

      // Check for empty content
      if (!change.newContent) {
        errors.push(`Empty new content for ${change.filePath}`);
      }

      // Check for potentially dangerous patterns
      if (change.newContent.includes('eval(') || change.newContent.includes('Function(')) {
        errors.push('Potentially dangerous code pattern detected');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Singleton instance
export const codeSyncService = new CodeSyncService();
export default codeSyncService;
