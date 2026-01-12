/**
 * CodeCanvas - Premium code display component with syntax highlighting
 *
 * Features:
 * - Beautiful syntax highlighting using CSS classes (no external library)
 * - Line numbers with proper alignment
 * - Highlighted lines for showing current generation point
 * - File header with icon, filename, and path
 * - Action buttons (copy, expand/collapse)
 * - Smooth line-by-line reveal animation for new code
 *
 * Uses styles from /src/styles/neural-canvas.css
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NeuralIcon, getLanguageIcon } from './icons/NeuralIcons';

// Supported languages for syntax highlighting
export type SupportedLanguage =
    | 'typescript'
    | 'javascript'
    | 'jsx'
    | 'tsx'
    | 'css'
    | 'html'
    | 'json'
    | 'python'
    | 'go'
    | 'rust'
    | 'markdown'
    | 'plaintext';

/**
 * Helper to normalize a language string to SupportedLanguage type.
 * Useful when receiving language values from external sources like stores.
 * @param lang - Language string to normalize
 * @returns Normalized SupportedLanguage value, defaults to 'plaintext' if unknown
 */
export function normalizeLanguage(lang: string): SupportedLanguage {
    const normalized = lang.toLowerCase();
    const languageMap: Record<string, SupportedLanguage> = {
        'typescript': 'typescript',
        'ts': 'typescript',
        'javascript': 'javascript',
        'js': 'javascript',
        'jsx': 'jsx',
        'tsx': 'tsx',
        'css': 'css',
        'html': 'html',
        'json': 'json',
        'python': 'python',
        'py': 'python',
        'go': 'go',
        'golang': 'go',
        'rust': 'rust',
        'rs': 'rust',
        'markdown': 'markdown',
        'md': 'markdown',
        'plaintext': 'plaintext',
        'text': 'plaintext',
    };
    return languageMap[normalized] || 'plaintext';
}

// Token types for syntax highlighting
export type TokenType =
    | 'keyword'
    | 'function'
    | 'string'
    | 'number'
    | 'comment'
    | 'operator'
    | 'punctuation'
    | 'variable'
    | 'class'
    | 'property'
    | 'type'
    | 'tag'
    | 'attribute'
    | 'plain';

// Token structure
export interface Token {
    type: TokenType;
    content: string;
}

// Line structure
export interface CodeLine {
    lineNumber: number;
    content: string;
    isHighlighted?: boolean;
    isNew?: boolean;
}

// Component props
export interface CodeCanvasProps {
    filename: string;
    filepath?: string;
    /** Language for syntax highlighting - accepts any string, normalizes internally */
    language: string;
    lines: CodeLine[];
    showLineNumbers?: boolean;
    maxHeight?: number | string;
    isCollapsible?: boolean;
    onCopy?: () => void;
    onExpand?: () => void;
    className?: string;
}

// Keywords by language
const KEYWORDS: Record<string, string[]> = {
    typescript: [
        'const', 'let', 'var', 'function', 'class', 'import', 'export', 'from',
        'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
        'continue', 'default', 'async', 'await', 'try', 'catch', 'finally',
        'throw', 'new', 'this', 'super', 'extends', 'implements', 'static',
        'public', 'private', 'protected', 'readonly', 'abstract', 'interface',
        'type', 'enum', 'namespace', 'module', 'declare', 'as', 'is', 'in',
        'of', 'typeof', 'instanceof', 'void', 'null', 'undefined', 'true',
        'false', 'never', 'unknown', 'any', 'string', 'number', 'boolean',
        'object', 'symbol', 'bigint', 'keyof', 'infer', 'satisfies'
    ],
    javascript: [
        'const', 'let', 'var', 'function', 'class', 'import', 'export', 'from',
        'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
        'continue', 'default', 'async', 'await', 'try', 'catch', 'finally',
        'throw', 'new', 'this', 'super', 'extends', 'static', 'typeof',
        'instanceof', 'void', 'null', 'undefined', 'true', 'false', 'of', 'in'
    ],
    python: [
        'def', 'class', 'import', 'from', 'as', 'return', 'if', 'elif', 'else',
        'for', 'while', 'break', 'continue', 'pass', 'raise', 'try', 'except',
        'finally', 'with', 'lambda', 'yield', 'global', 'nonlocal', 'assert',
        'del', 'in', 'is', 'not', 'and', 'or', 'True', 'False', 'None', 'async',
        'await', 'self', 'cls'
    ],
    go: [
        'package', 'import', 'func', 'type', 'struct', 'interface', 'const',
        'var', 'return', 'if', 'else', 'for', 'range', 'switch', 'case',
        'default', 'break', 'continue', 'fallthrough', 'goto', 'defer', 'go',
        'chan', 'select', 'map', 'make', 'new', 'len', 'cap', 'append', 'copy',
        'delete', 'nil', 'true', 'false', 'iota'
    ],
    rust: [
        'fn', 'let', 'mut', 'const', 'static', 'struct', 'enum', 'trait',
        'impl', 'type', 'use', 'mod', 'pub', 'crate', 'self', 'super', 'return',
        'if', 'else', 'match', 'for', 'while', 'loop', 'break', 'continue',
        'move', 'ref', 'async', 'await', 'dyn', 'where', 'as', 'in', 'unsafe',
        'extern', 'true', 'false', 'Some', 'None', 'Ok', 'Err', 'Self'
    ],
    css: [
        'important', 'inherit', 'initial', 'unset', 'revert', 'auto', 'none',
        'block', 'inline', 'flex', 'grid', 'absolute', 'relative', 'fixed',
        'sticky', 'static', 'hidden', 'visible', 'scroll', 'transparent'
    ],
    html: [
        'DOCTYPE', 'html', 'head', 'body', 'div', 'span', 'p', 'a', 'img',
        'script', 'style', 'link', 'meta', 'title', 'header', 'footer', 'main',
        'nav', 'section', 'article', 'aside', 'form', 'input', 'button',
        'label', 'select', 'option', 'textarea', 'table', 'tr', 'td', 'th'
    ],
    json: []
};

// Operators regex
const OPERATORS_REGEX = /^(===|!==|==|!=|<=|>=|=>|&&|\|\||[+\-*/%=<>!&|^~?:])/;

// Punctuation regex
const PUNCTUATION_REGEX = /^[{}[\]();,.:]/;

/**
 * Tokenize a single line of code
 * Returns an array of tokens with type and content
 */
function tokenizeLine(line: string, language: SupportedLanguage): Token[] {
    const tokens: Token[] = [];
    let remaining = line;
    const keywords = KEYWORDS[language] || KEYWORDS.javascript;

    // Normalize JSX/TSX to use JavaScript/TypeScript keywords
    const effectiveKeywords = ['jsx', 'tsx'].includes(language)
        ? KEYWORDS.typescript
        : keywords;

    while (remaining.length > 0) {
        let matched = false;

        // Check for single-line comments
        if (remaining.startsWith('//') || remaining.startsWith('#')) {
            tokens.push({ type: 'comment', content: remaining });
            break;
        }

        // Check for multi-line comment start (just capture the whole remaining as comment for simplicity)
        if (remaining.startsWith('/*')) {
            const endIndex = remaining.indexOf('*/');
            if (endIndex !== -1) {
                tokens.push({ type: 'comment', content: remaining.slice(0, endIndex + 2) });
                remaining = remaining.slice(endIndex + 2);
                matched = true;
                continue;
            } else {
                tokens.push({ type: 'comment', content: remaining });
                break;
            }
        }

        // Check for strings (double quotes)
        if (remaining[0] === '"') {
            let i = 1;
            while (i < remaining.length && remaining[i] !== '"') {
                if (remaining[i] === '\\') i++; // Skip escaped char
                i++;
            }
            i++; // Include closing quote
            tokens.push({ type: 'string', content: remaining.slice(0, i) });
            remaining = remaining.slice(i);
            matched = true;
            continue;
        }

        // Check for strings (single quotes)
        if (remaining[0] === "'") {
            let i = 1;
            while (i < remaining.length && remaining[i] !== "'") {
                if (remaining[i] === '\\') i++; // Skip escaped char
                i++;
            }
            i++; // Include closing quote
            tokens.push({ type: 'string', content: remaining.slice(0, i) });
            remaining = remaining.slice(i);
            matched = true;
            continue;
        }

        // Check for template literals
        if (remaining[0] === '`') {
            let i = 1;
            while (i < remaining.length && remaining[i] !== '`') {
                if (remaining[i] === '\\') i++; // Skip escaped char
                i++;
            }
            i++; // Include closing backtick
            tokens.push({ type: 'string', content: remaining.slice(0, i) });
            remaining = remaining.slice(i);
            matched = true;
            continue;
        }

        // Check for numbers (including decimals, hex, binary, octal)
        const numberMatch = remaining.match(/^(0x[\da-fA-F]+|0b[01]+|0o[0-7]+|\d+\.?\d*(?:e[+-]?\d+)?)/);
        if (numberMatch) {
            tokens.push({ type: 'number', content: numberMatch[0] });
            remaining = remaining.slice(numberMatch[0].length);
            matched = true;
            continue;
        }

        // Check for JSX/HTML tags
        if (['jsx', 'tsx', 'html'].includes(language)) {
            const tagMatch = remaining.match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)/);
            if (tagMatch) {
                tokens.push({ type: 'punctuation', content: remaining[0] === '/' ? '</' : '<' });
                remaining = remaining.slice(remaining[0] === '/' ? 2 : 1);
                if (remaining.startsWith('/')) {
                    remaining = remaining.slice(1);
                }
                // Check if it's a component (starts with uppercase) or HTML tag
                const tagName = tagMatch[1];
                const isComponent = tagName[0] === tagName[0].toUpperCase();
                tokens.push({
                    type: isComponent ? 'class' : 'tag',
                    content: tagName
                });
                remaining = remaining.slice(tagName.length);
                matched = true;
                continue;
            }

            // Check for JSX attributes
            const attrMatch = remaining.match(/^([a-zA-Z][a-zA-Z0-9]*)=/);
            if (attrMatch) {
                tokens.push({ type: 'attribute', content: attrMatch[1] });
                tokens.push({ type: 'operator', content: '=' });
                remaining = remaining.slice(attrMatch[0].length);
                matched = true;
                continue;
            }
        }

        // Check for operators
        const opMatch = remaining.match(OPERATORS_REGEX);
        if (opMatch) {
            tokens.push({ type: 'operator', content: opMatch[0] });
            remaining = remaining.slice(opMatch[0].length);
            matched = true;
            continue;
        }

        // Check for punctuation
        const punctMatch = remaining.match(PUNCTUATION_REGEX);
        if (punctMatch) {
            tokens.push({ type: 'punctuation', content: punctMatch[0] });
            remaining = remaining.slice(1);
            matched = true;
            continue;
        }

        // Check for identifiers (keywords, functions, types, variables)
        const identMatch = remaining.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
        if (identMatch) {
            const word = identMatch[0];
            const restOfLine = remaining.slice(word.length);

            // Check if it's a keyword
            if (effectiveKeywords.includes(word)) {
                tokens.push({ type: 'keyword', content: word });
            }
            // Check if it's a function call (followed by parenthesis)
            else if (restOfLine.trimStart().startsWith('(')) {
                tokens.push({ type: 'function', content: word });
            }
            // Check if it's a type (starts with uppercase and not followed by parens)
            else if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
                // Could be a class, type, or component
                tokens.push({ type: 'class', content: word });
            }
            // Check for property access (preceded by dot)
            else if (tokens.length > 0 && tokens[tokens.length - 1].content === '.') {
                tokens.push({ type: 'property', content: word });
            }
            // Default to variable
            else {
                tokens.push({ type: 'variable', content: word });
            }

            remaining = remaining.slice(word.length);
            matched = true;
            continue;
        }

        // Whitespace
        const wsMatch = remaining.match(/^\s+/);
        if (wsMatch) {
            tokens.push({ type: 'plain', content: wsMatch[0] });
            remaining = remaining.slice(wsMatch[0].length);
            matched = true;
            continue;
        }

        // Fallback: take single character
        if (!matched && remaining.length > 0) {
            tokens.push({ type: 'plain', content: remaining[0] });
            remaining = remaining.slice(1);
        }
    }

    return tokens;
}

/**
 * CodeCanvas Component
 */
export const CodeCanvas: React.FC<CodeCanvasProps> = ({
    filename,
    filepath,
    language: rawLanguage,
    lines,
    showLineNumbers = true,
    maxHeight,
    isCollapsible = false,
    onCopy,
    onExpand,
    className = ''
}) => {
    // Normalize language string to supported type
    const language = normalizeLanguage(rawLanguage);

    const [isCollapsed, setIsCollapsed] = useState(false);
    const [copyFeedback, setCopyFeedback] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const [prevLinesCount, setPrevLinesCount] = useState(lines.length);

    // Track new lines for animation
    useEffect(() => {
        setPrevLinesCount(lines.length);
    }, [lines.length]);

    // Handle copy action
    const handleCopy = useCallback(async () => {
        const codeContent = lines.map(l => l.content).join('\n');

        try {
            await navigator.clipboard.writeText(codeContent);
            setCopyFeedback(true);
            setTimeout(() => setCopyFeedback(false), 2000);
            onCopy?.();
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    }, [lines, onCopy]);

    // Handle expand/collapse
    const handleExpandCollapse = useCallback(() => {
        if (isCollapsible) {
            setIsCollapsed(!isCollapsed);
        }
        onExpand?.();
    }, [isCollapsible, isCollapsed, onExpand]);

    // Normalize language to SupportedLanguage type
    const normalizedLanguage = useMemo(() => normalizeLanguage(language), [language]);

    // Memoize tokenized lines for performance
    const tokenizedLines = useMemo(() => {
        return lines.map(line => ({
            ...line,
            tokens: tokenizeLine(line.content, normalizedLanguage)
        }));
    }, [lines, normalizedLanguage]);

    // Compute content style
    const contentStyle: React.CSSProperties = maxHeight
        ? { maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }
        : {};

    return (
        <motion.div
            className={`code-canvas ${className}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
            {/* Header */}
            <div className="code-canvas-header">
                <div className="code-canvas-file">
                    <span className="code-canvas-icon">
                        {getLanguageIcon(language, 16)}
                    </span>
                    <span className="code-canvas-filename">{filename}</span>
                    {filepath && (
                        <span className="code-canvas-path">{filepath}</span>
                    )}
                </div>
                <div className="code-canvas-actions">
                    {/* Copy button */}
                    <motion.button
                        className="code-canvas-action"
                        onClick={handleCopy}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title={copyFeedback ? 'Copied!' : 'Copy code'}
                    >
                        <AnimatePresence mode="wait">
                            {copyFeedback ? (
                                <motion.span
                                    key="check"
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    style={{ color: 'var(--neural-output)' }}
                                >
                                    <NeuralIcon name="check" size={14} />
                                </motion.span>
                            ) : (
                                <motion.span
                                    key="copy"
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                >
                                    <NeuralIcon name="copy" size={14} />
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </motion.button>

                    {/* Expand/Collapse button */}
                    {isCollapsible && (
                        <motion.button
                            className="code-canvas-action"
                            onClick={handleExpandCollapse}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            title={isCollapsed ? 'Expand' : 'Collapse'}
                        >
                            <NeuralIcon
                                name={isCollapsed ? 'expand' : 'collapse'}
                                size={14}
                            />
                        </motion.button>
                    )}

                    {/* Expand button for non-collapsible mode */}
                    {!isCollapsible && onExpand && (
                        <motion.button
                            className="code-canvas-action"
                            onClick={onExpand}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            title="Expand"
                        >
                            <NeuralIcon name="expand" size={14} />
                        </motion.button>
                    )}
                </div>
            </div>

            {/* Content */}
            <AnimatePresence>
                {!isCollapsed && (
                    <motion.div
                        className="code-canvas-content"
                        ref={contentRef}
                        style={contentStyle}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="code-lines">
                            {tokenizedLines.map((line, index) => {
                                const isNewLine = line.isNew || index >= prevLinesCount;
                                const lineClasses = [
                                    'code-line',
                                    line.isHighlighted ? 'code-line--highlight' : '',
                                    isNewLine ? 'code-line--new' : ''
                                ].filter(Boolean).join(' ');

                                return (
                                    <motion.div
                                        key={`${line.lineNumber}-${index}`}
                                        className={lineClasses}
                                        initial={isNewLine ? { opacity: 0, x: -10 } : false}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{
                                            duration: 0.2,
                                            delay: isNewLine ? index * 0.02 : 0,
                                            ease: 'easeOut'
                                        }}
                                    >
                                        {/* Line number */}
                                        {showLineNumbers && (
                                            <span className="code-line-number">
                                                {line.lineNumber}
                                            </span>
                                        )}

                                        {/* Line content with syntax highlighting */}
                                        <span className="code-line-content">
                                            {line.tokens.map((token, tokenIndex) => (
                                                <span
                                                    key={tokenIndex}
                                                    className={`syntax-${token.type}`}
                                                >
                                                    {token.content}
                                                </span>
                                            ))}
                                        </span>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Highlighted line pulse effect */}
            <style>{`
                .code-line--highlight {
                    animation: highlight-pulse 2s ease-in-out infinite;
                }

                @keyframes highlight-pulse {
                    0%, 100% {
                        background: var(--code-line-active);
                    }
                    50% {
                        background: rgba(245, 158, 11, 0.15);
                    }
                }
            `}</style>
        </motion.div>
    );
};

export default CodeCanvas;
