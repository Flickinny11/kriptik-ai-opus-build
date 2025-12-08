/**
 * CodeBlock - Premium Syntax Highlighted Code Block
 *
 * A styled code block component with syntax highlighting,
 * copy functionality, and glass morphism styling.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Language color mapping
const LANGUAGE_COLORS: Record<string, string> = {
  typescript: '#3178c6',
  javascript: '#f7df1e',
  python: '#3776ab',
  rust: '#ce422b',
  go: '#00add8',
  java: '#b07219',
  cpp: '#f34b7d',
  c: '#555555',
  html: '#e34c26',
  css: '#563d7c',
  scss: '#c6538c',
  json: '#292929',
  yaml: '#cb171e',
  markdown: '#083fa1',
  shell: '#89e051',
  bash: '#89e051',
  sql: '#e38c00',
  graphql: '#e10098',
  jsx: '#61dafb',
  tsx: '#3178c6',
  vue: '#41b883',
  svelte: '#ff3e00',
};

// Language display names
const LANGUAGE_NAMES: Record<string, string> = {
  typescript: 'TypeScript',
  ts: 'TypeScript',
  javascript: 'JavaScript',
  js: 'JavaScript',
  python: 'Python',
  py: 'Python',
  rust: 'Rust',
  go: 'Go',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  markdown: 'Markdown',
  md: 'Markdown',
  shell: 'Shell',
  bash: 'Bash',
  sh: 'Shell',
  sql: 'SQL',
  graphql: 'GraphQL',
  gql: 'GraphQL',
  jsx: 'JSX',
  tsx: 'TSX',
  vue: 'Vue',
  svelte: 'Svelte',
};

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  startLineNumber?: number;
  highlightLines?: number[];
  maxHeight?: string | number;
  className?: string;
}

// Simple syntax highlighting (can be replaced with Prism/Shiki)
function highlightCode(code: string, _language: string): string {
  // Basic keyword highlighting for common languages
  const keywords = [
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
    'class', 'interface', 'type', 'import', 'export', 'from', 'async', 'await',
    'try', 'catch', 'throw', 'new', 'this', 'extends', 'implements', 'public',
    'private', 'protected', 'static', 'readonly', 'abstract', 'default', 'case',
    'switch', 'break', 'continue', 'in', 'of', 'true', 'false', 'null', 'undefined',
  ];

  let highlighted = code;

  // Escape HTML
  highlighted = highlighted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Strings (double quotes)
  highlighted = highlighted.replace(
    /"([^"\\]|\\.)*"/g,
    '<span class="token-string">"$&"</span>'.slice(0, -21) + '</span>'
  );
  highlighted = highlighted.replace(
    /"([^"\\]|\\.)*"/g,
    '<span class="token-string">$&</span>'
  );

  // Strings (single quotes)
  highlighted = highlighted.replace(
    /'([^'\\]|\\.)*'/g,
    '<span class="token-string">$&</span>'
  );

  // Template literals
  highlighted = highlighted.replace(
    /`([^`\\]|\\.)*`/g,
    '<span class="token-string">$&</span>'
  );

  // Comments (single line)
  highlighted = highlighted.replace(
    /(\/\/.*$)/gm,
    '<span class="token-comment">$1</span>'
  );

  // Comments (multi line)
  highlighted = highlighted.replace(
    /(\/\*[\s\S]*?\*\/)/g,
    '<span class="token-comment">$1</span>'
  );

  // Numbers
  highlighted = highlighted.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span class="token-number">$1</span>'
  );

  // Keywords
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b(${keyword})\\b`, 'g');
    highlighted = highlighted.replace(
      regex,
      '<span class="token-keyword">$1</span>'
    );
  });

  // Functions
  highlighted = highlighted.replace(
    /\b([a-zA-Z_]\w*)\s*(?=\()/g,
    '<span class="token-function">$1</span>'
  );

  return highlighted;
}

// Copy icon
function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// Check icon
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function CodeBlock({
  code,
  language = 'text',
  filename,
  showLineNumbers = true,
  startLineNumber = 1,
  highlightLines = [],
  maxHeight,
  className = '',
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [code]);

  const lines = code.split('\n');
  const langColor = LANGUAGE_COLORS[language.toLowerCase()] || '#71717a';
  const langName = LANGUAGE_NAMES[language.toLowerCase()] || language;

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    borderRadius: '16px',
    overflow: 'hidden',
    background: 'linear-gradient(145deg, rgba(20,20,25,0.98) 0%, rgba(12,12,16,0.99) 100%)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: `
      0 20px 50px rgba(0,0,0,0.4),
      0 10px 25px rgba(0,0,0,0.3),
      inset 0 1px 0 rgba(255,255,255,0.05)
    `,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Monaco, Consolas, monospace",
    fontSize: '13px',
    lineHeight: '1.6',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    background: 'rgba(0,0,0,0.2)',
  };

  const codeContainerStyle: React.CSSProperties = {
    padding: '16px',
    overflowX: 'auto',
    maxHeight: maxHeight,
    overflowY: maxHeight ? 'auto' : undefined,
  };

  return (
    <div className={className} style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Language badge */}
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              background: `${langColor}20`,
              color: langColor,
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {langName}
          </span>

          {/* Filename */}
          {filename && (
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
              {filename}
            </span>
          )}
        </div>

        {/* Copy button */}
        <motion.button
          onClick={handleCopy}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            background: copied ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
            border: 'none',
            color: copied ? '#10b981' : 'rgba(255,255,255,0.6)',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          whileHover={{ background: 'rgba(255,255,255,0.1)' }}
          whileTap={{ scale: 0.95 }}
        >
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.span
                key="check"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <CheckIcon /> Copied
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <CopyIcon /> Copy
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Code content */}
      <div style={codeContainerStyle}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {lines.map((line, index) => {
              const lineNumber = startLineNumber + index;
              const isHighlighted = highlightLines.includes(lineNumber);

              return (
                <tr
                  key={index}
                  style={{
                    background: isHighlighted ? 'rgba(200,255,100,0.08)' : 'transparent',
                  }}
                >
                  {/* Line number */}
                  {showLineNumbers && (
                    <td
                      style={{
                        width: '1px',
                        padding: '0 16px 0 0',
                        textAlign: 'right',
                        userSelect: 'none',
                        color: isHighlighted ? '#c8ff64' : 'rgba(255,255,255,0.25)',
                        borderRight: isHighlighted
                          ? '2px solid #c8ff64'
                          : '2px solid transparent',
                      }}
                    >
                      {lineNumber}
                    </td>
                  )}

                  {/* Code */}
                  <td
                    style={{
                      padding: showLineNumbers ? '0 0 0 16px' : 0,
                      whiteSpace: 'pre',
                      color: 'rgba(255,255,255,0.9)',
                    }}
                    dangerouslySetInnerHTML={{
                      __html: highlightCode(line || ' ', language),
                    }}
                  />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Token color styles */}
      <style>{`
        .token-string { color: #c8ff64; }
        .token-comment { color: #4a4a52; font-style: italic; }
        .token-number { color: #ffb088; }
        .token-keyword { color: #ff6b8a; }
        .token-function { color: #88d4ff; }
      `}</style>
    </div>
  );
}

export default CodeBlock;

