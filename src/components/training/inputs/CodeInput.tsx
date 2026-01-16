/**
 * Code Input - Code editor input for code generation testing
 */

import { useState } from 'react';
import { motion } from 'framer-motion';

interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  onLanguageChange?: (lang: string) => void;
  mode?: 'completion' | 'generation' | 'explanation';
  onModeChange?: (mode: 'completion' | 'generation' | 'explanation') => void;
  maxTokens?: number;
  onMaxTokensChange?: (value: number) => void;
  onSubmit: () => void;
  isLoading?: boolean;
}

const LANGUAGES = [
  'python',
  'javascript',
  'typescript',
  'java',
  'c++',
  'rust',
  'go',
  'ruby',
  'swift',
  'kotlin',
];

export function CodeInput({
  value,
  onChange,
  language = 'python',
  onLanguageChange,
  mode = 'generation',
  onModeChange,
  maxTokens = 512,
  onMaxTokensChange,
  onSubmit,
  isLoading = false,
}: CodeInputProps) {
  const [showSettings, setShowSettings] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      onChange(value.substring(0, start) + '  ' + value.substring(end));
      // Would need to restore cursor position in production
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      onSubmit();
    }
  };

  const placeholders: Record<string, string> = {
    completion: `// Write the start of your code and get completion
function calculateTotal(items) {
  // Complete this function...`,
    generation: `# Describe what code you want to generate
"Write a Python function that sorts a list of dictionaries by a specific key"`,
    explanation: `# Paste code here to get an explanation
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)`,
  };

  return (
    <div className="space-y-4">
      {/* Mode Selector */}
      {onModeChange && (
        <div className="flex gap-2">
          {(['generation', 'completion', 'explanation'] as const).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                mode === m
                  ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                  : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Language Selector */}
      {onLanguageChange && (
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              onClick={() => onLanguageChange(lang)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                language === lang
                  ? 'bg-cyan-500/30 text-cyan-300'
                  : 'bg-white/10 text-white/60 hover:text-white'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      )}

      {/* Code Editor */}
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholders[mode]}
          rows={10}
          disabled={isLoading}
          spellCheck={false}
          className="w-full px-4 py-3 rounded-xl bg-stone-900 border border-white/10 text-white font-mono text-sm placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 resize-none disabled:opacity-50"
          style={{ tabSize: 2 }}
        />
        <div className="absolute top-2 right-2 px-2 py-1 rounded bg-white/10 text-xs text-white/40">
          {language}
        </div>
        <div className="absolute bottom-2 right-2 text-xs text-white/30">
          {value.split('\n').length} lines
        </div>
      </div>

      {/* Settings */}
      <button
        type="button"
        onClick={() => setShowSettings(!showSettings)}
        className="text-sm text-white/40 hover:text-white/60 transition-colors"
      >
        {showSettings ? 'Hide settings' : 'Show settings'}
      </button>

      {showSettings && onMaxTokensChange && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="p-4 bg-white/5 rounded-xl border border-white/10"
        >
          <div className="space-y-2">
            <label className="flex justify-between text-sm">
              <span className="text-white/60">Max Tokens</span>
              <span className="text-white">{maxTokens}</span>
            </label>
            <input
              type="range"
              min="128"
              max="2048"
              step="128"
              value={maxTokens}
              onChange={(e) => onMaxTokensChange(parseInt(e.target.value))}
              className="w-full accent-cyan-500"
            />
          </div>
        </motion.div>
      )}

      {/* Submit */}
      <button
        onClick={onSubmit}
        disabled={!value.trim() || isLoading}
        className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {mode === 'completion' ? 'Completing...' : mode === 'explanation' ? 'Analyzing...' : 'Generating...'}
          </>
        ) : (
          mode === 'completion' ? 'Complete Code' : mode === 'explanation' ? 'Explain Code' : 'Generate Code'
        )}
      </button>

      <p className="text-xs text-white/30 text-center">
        Press Cmd/Ctrl + Enter to submit | Tab for indentation
      </p>
    </div>
  );
}

export default CodeInput;
