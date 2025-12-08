/**
 * Premium Code Editor Themes for KripTik AI
 *
 * Custom themes designed to match the premium glass morphism aesthetic.
 * These themes are compatible with Monaco Editor and CodeMirror.
 */

export interface EditorTheme {
  name: string;
  type: 'dark' | 'light';
  colors: {
    // Editor background and foreground
    'editor.background': string;
    'editor.foreground': string;

    // Line numbers
    'editorLineNumber.foreground': string;
    'editorLineNumber.activeForeground': string;

    // Cursor
    'editorCursor.foreground': string;

    // Selection
    'editor.selectionBackground': string;
    'editor.inactiveSelectionBackground': string;
    'editor.selectionHighlightBackground': string;

    // Current line
    'editor.lineHighlightBackground': string;
    'editor.lineHighlightBorder': string;

    // Search
    'editor.findMatchBackground': string;
    'editor.findMatchHighlightBackground': string;

    // Minimap
    'minimap.background': string;
    'minimapSlider.background': string;

    // Scrollbar
    'scrollbar.shadow': string;
    'scrollbarSlider.background': string;
    'scrollbarSlider.hoverBackground': string;

    // Widget (autocomplete, etc.)
    'editorWidget.background': string;
    'editorWidget.border': string;

    // Gutter
    'editorGutter.background': string;

    // Indent guides
    'editorIndentGuide.background': string;
    'editorIndentGuide.activeBackground': string;

    // Bracket matching
    'editorBracketMatch.background': string;
    'editorBracketMatch.border': string;
  };
  tokenColors: Array<{
    name: string;
    scope: string | string[];
    settings: {
      foreground?: string;
      fontStyle?: string;
    };
  }>;
}

// ============================================
// KripTik Night Theme (Dark)
// ============================================

export const kriptikNight: EditorTheme = {
  name: 'KripTik Night',
  type: 'dark',
  colors: {
    'editor.background': '#0a0a0c',
    'editor.foreground': '#e4e4e7',

    'editorLineNumber.foreground': '#3f3f46',
    'editorLineNumber.activeForeground': '#c8ff64',

    'editorCursor.foreground': '#c8ff64',

    'editor.selectionBackground': 'rgba(200, 255, 100, 0.15)',
    'editor.inactiveSelectionBackground': 'rgba(200, 255, 100, 0.08)',
    'editor.selectionHighlightBackground': 'rgba(200, 255, 100, 0.1)',

    'editor.lineHighlightBackground': 'rgba(255, 255, 255, 0.03)',
    'editor.lineHighlightBorder': 'transparent',

    'editor.findMatchBackground': 'rgba(200, 255, 100, 0.3)',
    'editor.findMatchHighlightBackground': 'rgba(200, 255, 100, 0.15)',

    'minimap.background': '#0a0a0c',
    'minimapSlider.background': 'rgba(200, 255, 100, 0.1)',

    'scrollbar.shadow': 'rgba(0, 0, 0, 0.5)',
    'scrollbarSlider.background': 'rgba(200, 255, 100, 0.1)',
    'scrollbarSlider.hoverBackground': 'rgba(200, 255, 100, 0.2)',

    'editorWidget.background': '#14141a',
    'editorWidget.border': 'rgba(200, 255, 100, 0.1)',

    'editorGutter.background': '#0a0a0c',

    'editorIndentGuide.background': 'rgba(255, 255, 255, 0.05)',
    'editorIndentGuide.activeBackground': 'rgba(200, 255, 100, 0.2)',

    'editorBracketMatch.background': 'rgba(200, 255, 100, 0.2)',
    'editorBracketMatch.border': '#c8ff64',
  },
  tokenColors: [
    // Comments
    {
      name: 'Comment',
      scope: ['comment', 'punctuation.definition.comment'],
      settings: {
        foreground: '#4a4a52',
        fontStyle: 'italic',
      },
    },
    // Strings
    {
      name: 'String',
      scope: ['string', 'string.quoted'],
      settings: {
        foreground: '#c8ff64',
      },
    },
    // Numbers
    {
      name: 'Number',
      scope: ['constant.numeric'],
      settings: {
        foreground: '#ffb088',
      },
    },
    // Keywords
    {
      name: 'Keyword',
      scope: ['keyword', 'storage.type', 'storage.modifier'],
      settings: {
        foreground: '#ff6b8a',
      },
    },
    // Functions
    {
      name: 'Function',
      scope: ['entity.name.function', 'support.function'],
      settings: {
        foreground: '#88d4ff',
      },
    },
    // Variables
    {
      name: 'Variable',
      scope: ['variable', 'variable.other'],
      settings: {
        foreground: '#e4e4e7',
      },
    },
    // Constants
    {
      name: 'Constant',
      scope: ['constant', 'constant.language'],
      settings: {
        foreground: '#ffb088',
      },
    },
    // Classes/Types
    {
      name: 'Class',
      scope: ['entity.name.class', 'entity.name.type', 'support.type'],
      settings: {
        foreground: '#ffd700',
      },
    },
    // Operators
    {
      name: 'Operator',
      scope: ['keyword.operator'],
      settings: {
        foreground: '#c8ff64',
      },
    },
    // Punctuation
    {
      name: 'Punctuation',
      scope: ['punctuation'],
      settings: {
        foreground: '#71717a',
      },
    },
    // Properties
    {
      name: 'Property',
      scope: ['variable.other.property', 'meta.object-literal.key'],
      settings: {
        foreground: '#a78bfa',
      },
    },
    // Tags (HTML/JSX)
    {
      name: 'Tag',
      scope: ['entity.name.tag'],
      settings: {
        foreground: '#ff6b8a',
      },
    },
    // Attributes
    {
      name: 'Attribute',
      scope: ['entity.other.attribute-name'],
      settings: {
        foreground: '#88d4ff',
      },
    },
    // Imports
    {
      name: 'Import',
      scope: ['keyword.control.import', 'keyword.control.export'],
      settings: {
        foreground: '#ff6b8a',
        fontStyle: 'italic',
      },
    },
    // Regular Expressions
    {
      name: 'Regex',
      scope: ['string.regexp'],
      settings: {
        foreground: '#ff8f8f',
      },
    },
    // Decorators
    {
      name: 'Decorator',
      scope: ['meta.decorator', 'punctuation.decorator'],
      settings: {
        foreground: '#ffd700',
        fontStyle: 'italic',
      },
    },
  ],
};

// ============================================
// KripTik Glass Theme (Light)
// ============================================

export const kriptikGlass: EditorTheme = {
  name: 'KripTik Glass',
  type: 'light',
  colors: {
    'editor.background': 'rgba(255, 255, 255, 0)',
    'editor.foreground': '#1e1e24',

    'editorLineNumber.foreground': 'rgba(0, 0, 0, 0.25)',
    'editorLineNumber.activeForeground': '#d35f00',

    'editorCursor.foreground': '#d35f00',

    'editor.selectionBackground': 'rgba(255, 150, 100, 0.2)',
    'editor.inactiveSelectionBackground': 'rgba(255, 150, 100, 0.1)',
    'editor.selectionHighlightBackground': 'rgba(255, 150, 100, 0.15)',

    'editor.lineHighlightBackground': 'rgba(0, 0, 0, 0.03)',
    'editor.lineHighlightBorder': 'transparent',

    'editor.findMatchBackground': 'rgba(255, 150, 100, 0.4)',
    'editor.findMatchHighlightBackground': 'rgba(255, 150, 100, 0.2)',

    'minimap.background': 'rgba(255, 255, 255, 0.5)',
    'minimapSlider.background': 'rgba(255, 150, 100, 0.15)',

    'scrollbar.shadow': 'rgba(0, 0, 0, 0.1)',
    'scrollbarSlider.background': 'rgba(255, 150, 100, 0.2)',
    'scrollbarSlider.hoverBackground': 'rgba(255, 150, 100, 0.3)',

    'editorWidget.background': 'rgba(255, 255, 255, 0.9)',
    'editorWidget.border': 'rgba(255, 150, 100, 0.2)',

    'editorGutter.background': 'transparent',

    'editorIndentGuide.background': 'rgba(0, 0, 0, 0.06)',
    'editorIndentGuide.activeBackground': 'rgba(255, 150, 100, 0.3)',

    'editorBracketMatch.background': 'rgba(255, 150, 100, 0.25)',
    'editorBracketMatch.border': '#d35f00',
  },
  tokenColors: [
    // Comments
    {
      name: 'Comment',
      scope: ['comment', 'punctuation.definition.comment'],
      settings: {
        foreground: '#94a3b8',
        fontStyle: 'italic',
      },
    },
    // Strings
    {
      name: 'String',
      scope: ['string', 'string.quoted'],
      settings: {
        foreground: '#059669',
      },
    },
    // Numbers
    {
      name: 'Number',
      scope: ['constant.numeric'],
      settings: {
        foreground: '#d35f00',
      },
    },
    // Keywords
    {
      name: 'Keyword',
      scope: ['keyword', 'storage.type', 'storage.modifier'],
      settings: {
        foreground: '#c026d3',
      },
    },
    // Functions
    {
      name: 'Function',
      scope: ['entity.name.function', 'support.function'],
      settings: {
        foreground: '#0284c7',
      },
    },
    // Variables
    {
      name: 'Variable',
      scope: ['variable', 'variable.other'],
      settings: {
        foreground: '#1e1e24',
      },
    },
    // Constants
    {
      name: 'Constant',
      scope: ['constant', 'constant.language'],
      settings: {
        foreground: '#d35f00',
      },
    },
    // Classes/Types
    {
      name: 'Class',
      scope: ['entity.name.class', 'entity.name.type', 'support.type'],
      settings: {
        foreground: '#ca8a04',
      },
    },
    // Operators
    {
      name: 'Operator',
      scope: ['keyword.operator'],
      settings: {
        foreground: '#059669',
      },
    },
    // Punctuation
    {
      name: 'Punctuation',
      scope: ['punctuation'],
      settings: {
        foreground: '#64748b',
      },
    },
    // Properties
    {
      name: 'Property',
      scope: ['variable.other.property', 'meta.object-literal.key'],
      settings: {
        foreground: '#7c3aed',
      },
    },
    // Tags (HTML/JSX)
    {
      name: 'Tag',
      scope: ['entity.name.tag'],
      settings: {
        foreground: '#c026d3',
      },
    },
    // Attributes
    {
      name: 'Attribute',
      scope: ['entity.other.attribute-name'],
      settings: {
        foreground: '#0284c7',
      },
    },
    // Imports
    {
      name: 'Import',
      scope: ['keyword.control.import', 'keyword.control.export'],
      settings: {
        foreground: '#c026d3',
        fontStyle: 'italic',
      },
    },
    // Regular Expressions
    {
      name: 'Regex',
      scope: ['string.regexp'],
      settings: {
        foreground: '#dc2626',
      },
    },
    // Decorators
    {
      name: 'Decorator',
      scope: ['meta.decorator', 'punctuation.decorator'],
      settings: {
        foreground: '#ca8a04',
        fontStyle: 'italic',
      },
    },
  ],
};

// ============================================
// KripTik Amber Theme (Warm Dark)
// ============================================

export const kriptikAmber: EditorTheme = {
  name: 'KripTik Amber',
  type: 'dark',
  colors: {
    'editor.background': '#0f0d0a',
    'editor.foreground': '#f5f0e8',

    'editorLineNumber.foreground': '#4a4540',
    'editorLineNumber.activeForeground': '#ffb088',

    'editorCursor.foreground': '#ffb088',

    'editor.selectionBackground': 'rgba(255, 176, 136, 0.2)',
    'editor.inactiveSelectionBackground': 'rgba(255, 176, 136, 0.1)',
    'editor.selectionHighlightBackground': 'rgba(255, 176, 136, 0.12)',

    'editor.lineHighlightBackground': 'rgba(255, 200, 150, 0.03)',
    'editor.lineHighlightBorder': 'transparent',

    'editor.findMatchBackground': 'rgba(255, 176, 136, 0.35)',
    'editor.findMatchHighlightBackground': 'rgba(255, 176, 136, 0.18)',

    'minimap.background': '#0f0d0a',
    'minimapSlider.background': 'rgba(255, 176, 136, 0.12)',

    'scrollbar.shadow': 'rgba(0, 0, 0, 0.5)',
    'scrollbarSlider.background': 'rgba(255, 176, 136, 0.12)',
    'scrollbarSlider.hoverBackground': 'rgba(255, 176, 136, 0.22)',

    'editorWidget.background': '#1a1714',
    'editorWidget.border': 'rgba(255, 176, 136, 0.12)',

    'editorGutter.background': '#0f0d0a',

    'editorIndentGuide.background': 'rgba(255, 200, 150, 0.06)',
    'editorIndentGuide.activeBackground': 'rgba(255, 176, 136, 0.22)',

    'editorBracketMatch.background': 'rgba(255, 176, 136, 0.22)',
    'editorBracketMatch.border': '#ffb088',
  },
  tokenColors: [
    {
      name: 'Comment',
      scope: ['comment', 'punctuation.definition.comment'],
      settings: {
        foreground: '#5c5550',
        fontStyle: 'italic',
      },
    },
    {
      name: 'String',
      scope: ['string', 'string.quoted'],
      settings: {
        foreground: '#b4e876',
      },
    },
    {
      name: 'Number',
      scope: ['constant.numeric'],
      settings: {
        foreground: '#ffb088',
      },
    },
    {
      name: 'Keyword',
      scope: ['keyword', 'storage.type', 'storage.modifier'],
      settings: {
        foreground: '#ff8888',
      },
    },
    {
      name: 'Function',
      scope: ['entity.name.function', 'support.function'],
      settings: {
        foreground: '#88d4ff',
      },
    },
    {
      name: 'Variable',
      scope: ['variable', 'variable.other'],
      settings: {
        foreground: '#f5f0e8',
      },
    },
    {
      name: 'Constant',
      scope: ['constant', 'constant.language'],
      settings: {
        foreground: '#ffb088',
      },
    },
    {
      name: 'Class',
      scope: ['entity.name.class', 'entity.name.type', 'support.type'],
      settings: {
        foreground: '#ffd080',
      },
    },
    {
      name: 'Operator',
      scope: ['keyword.operator'],
      settings: {
        foreground: '#ffb088',
      },
    },
    {
      name: 'Punctuation',
      scope: ['punctuation'],
      settings: {
        foreground: '#8a8580',
      },
    },
    {
      name: 'Property',
      scope: ['variable.other.property', 'meta.object-literal.key'],
      settings: {
        foreground: '#d0a0ff',
      },
    },
    {
      name: 'Tag',
      scope: ['entity.name.tag'],
      settings: {
        foreground: '#ff8888',
      },
    },
    {
      name: 'Attribute',
      scope: ['entity.other.attribute-name'],
      settings: {
        foreground: '#88d4ff',
      },
    },
    {
      name: 'Import',
      scope: ['keyword.control.import', 'keyword.control.export'],
      settings: {
        foreground: '#ff8888',
        fontStyle: 'italic',
      },
    },
    {
      name: 'Regex',
      scope: ['string.regexp'],
      settings: {
        foreground: '#ffaaaa',
      },
    },
    {
      name: 'Decorator',
      scope: ['meta.decorator', 'punctuation.decorator'],
      settings: {
        foreground: '#ffd080',
        fontStyle: 'italic',
      },
    },
  ],
};

// Export all themes
export const editorThemes = {
  kriptikNight,
  kriptikGlass,
  kriptikAmber,
} as const;

export type EditorThemeName = keyof typeof editorThemes;

