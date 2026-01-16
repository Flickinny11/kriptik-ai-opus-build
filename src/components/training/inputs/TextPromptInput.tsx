/**
 * Text Prompt Input - Text/Chat input for LLM testing
 */

import { useState } from 'react';
import { motion } from 'framer-motion';

interface TextPromptInputProps {
  value: string;
  onChange: (value: string) => void;
  systemPrompt?: string;
  onSystemPromptChange?: (value: string) => void;
  temperature?: number;
  onTemperatureChange?: (value: number) => void;
  maxTokens?: number;
  onMaxTokensChange?: (value: number) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  placeholder?: string;
  showAdvanced?: boolean;
}

export function TextPromptInput({
  value,
  onChange,
  systemPrompt = '',
  onSystemPromptChange,
  temperature = 0.7,
  onTemperatureChange,
  maxTokens = 256,
  onMaxTokensChange,
  onSubmit,
  isLoading = false,
  placeholder = 'Enter your prompt...',
  showAdvanced = true,
}: TextPromptInputProps) {
  const [showSettings, setShowSettings] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      onSubmit();
    }
  };

  return (
    <div className="space-y-4">
      {/* System Prompt (optional) */}
      {onSystemPromptChange && showAdvanced && (
        <div className="space-y-2">
          <label className="block text-sm text-white/60">System Prompt</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => onSystemPromptChange(e.target.value)}
            placeholder="Set the behavior of the model..."
            rows={2}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 resize-none text-sm"
          />
        </div>
      )}

      {/* Main Prompt */}
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={4}
          disabled={isLoading}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 resize-none disabled:opacity-50"
        />
        <div className="absolute bottom-3 right-3 text-xs text-white/30">
          {value.length} chars
        </div>
      </div>

      {/* Advanced Settings Toggle */}
      {showAdvanced && (
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          {showSettings ? 'Hide settings' : 'Show settings'}
        </button>
      )}

      {/* Settings Panel */}
      {showSettings && showAdvanced && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-xl border border-white/10"
        >
          {/* Temperature */}
          {onTemperatureChange && (
            <div className="space-y-2">
              <label className="flex justify-between text-sm">
                <span className="text-white/60">Temperature</span>
                <span className="text-white">{temperature.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>
          )}

          {/* Max Tokens */}
          {onMaxTokensChange && (
            <div className="space-y-2">
              <label className="flex justify-between text-sm">
                <span className="text-white/60">Max Tokens</span>
                <span className="text-white">{maxTokens}</span>
              </label>
              <input
                type="range"
                min="64"
                max="2048"
                step="64"
                value={maxTokens}
                onChange={(e) => onMaxTokensChange(parseInt(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>
          )}
        </motion.div>
      )}

      {/* Submit Button */}
      <button
        onClick={onSubmit}
        disabled={!value.trim() || isLoading}
        className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Generating...
          </>
        ) : (
          'Generate'
        )}
      </button>

      <p className="text-xs text-white/30 text-center">
        Press Cmd/Ctrl + Enter to submit
      </p>
    </div>
  );
}

export default TextPromptInput;
