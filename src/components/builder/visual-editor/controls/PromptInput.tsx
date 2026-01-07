/**
 * Prompt Input - Point-and-prompt interface for AI-assisted styling
 *
 * Features:
 * - Natural language input for style changes
 * - Prompt history with quick re-apply
 * - Context-aware suggestions
 * - Anti-slop detection before submission
 * - Loading state during AI processing
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVisualEditorStore } from '../../../../store/useVisualEditorStore';

// Icons
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const HistoryIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v5h5" />
    <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
    <path d="M12 7v5l4 2" />
  </svg>
);

const SparklesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
    <path d="M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1z" />
  </svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// Context-aware suggestions based on element type
const SUGGESTIONS: Record<string, string[]> = {
  button: [
    'Add hover glow effect with amber color',
    'Make it look like a glass button',
    'Add subtle shadow and rounded corners',
    'Make the text bolder and add padding',
  ],
  card: [
    'Add glass morphism effect',
    'Add subtle border and shadow depth',
    'Make corners more rounded',
    'Add background blur effect',
  ],
  text: [
    'Make the text larger and bolder',
    'Add letter spacing for elegance',
    'Change to muted color',
    'Use the Cal Sans font',
  ],
  container: [
    'Center the content with flexbox',
    'Add padding and gap between items',
    'Make it a flex column',
    'Add background with glass effect',
  ],
  image: [
    'Add rounded corners',
    'Add subtle shadow',
    'Make it cover the container',
    'Add border with accent color',
  ],
  default: [
    'Add glass effect with blur',
    'Make it more prominent with shadow',
    'Add subtle border',
    'Improve spacing and alignment',
  ],
};

export function PromptInput() {
  const {
    selectedElements,
    promptHistory,
    isPromptProcessing,
    submitPrompt,
    setPromptInput,
  } = useVisualEditorStore();

  const [prompt, setPrompt] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  const element = selectedElements[0] ?? null;

  // Get contextual suggestions based on element type
  const suggestions = useMemo(() => {
    if (!element) return SUGGESTIONS.default;

    const tagName = element.tagName.toLowerCase();
    const componentName = element.componentName?.toLowerCase() || '';

    if (tagName === 'button' || componentName.includes('button')) {
      return SUGGESTIONS.button;
    }
    if (componentName.includes('card') || tagName === 'article') {
      return SUGGESTIONS.card;
    }
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label'].includes(tagName)) {
      return SUGGESTIONS.text;
    }
    if (tagName === 'img' || componentName.includes('image')) {
      return SUGGESTIONS.image;
    }
    if (['div', 'section', 'main', 'aside', 'header', 'footer'].includes(tagName)) {
      return SUGGESTIONS.container;
    }

    return SUGGESTIONS.default;
  }, [element]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [prompt]);

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() || !element || isPromptProcessing) return;

    // Set the prompt input in the store and trigger submission
    setPromptInput(prompt.trim());
    setPrompt('');
    setShowSuggestions(false);

    // The actual AI processing happens in the store's submitPrompt action
    await submitPrompt();
  }, [prompt, element, isPromptProcessing, setPromptInput, submitPrompt]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleHistorySelect = useCallback((historyPrompt: string) => {
    setPrompt(historyPrompt);
    setShowHistory(false);
    inputRef.current?.focus();
  }, []);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setPrompt(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, []);

  if (!element) {
    return (
      <div className="vpp-prompt vpp-prompt--disabled">
        <div className="vpp-prompt__placeholder">
          <SparklesIcon />
          <span>Select an element to use AI styling</span>
        </div>
      </div>
    );
  }

  return (
    <div className="vpp-prompt">
      {/* Header with suggestions toggle */}
      <div className="vpp-prompt__header">
        <div className="vpp-prompt__title">
          <SparklesIcon />
          <span>Style with AI</span>
        </div>
        <div className="vpp-prompt__actions">
          <button
            className={`vpp-prompt__action-btn ${showSuggestions ? 'active' : ''}`}
            onClick={() => {
              setShowSuggestions(!showSuggestions);
              setShowHistory(false);
            }}
            title="Show suggestions"
          >
            <SparklesIcon />
          </button>
          {promptHistory.length > 0 && (
            <button
              className={`vpp-prompt__action-btn ${showHistory ? 'active' : ''}`}
              onClick={() => {
                setShowHistory(!showHistory);
                setShowSuggestions(false);
              }}
              title="Prompt history"
            >
              <HistoryIcon />
            </button>
          )}
        </div>
      </div>

      {/* Suggestions dropdown */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            className="vpp-prompt__dropdown"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className="vpp-prompt__dropdown-header">
              <span>Suggestions for {element.componentName || element.tagName}</span>
              <button onClick={() => setShowSuggestions(false)}>
                <CloseIcon />
              </button>
            </div>
            <div className="vpp-prompt__suggestions">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  className="vpp-prompt__suggestion"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History dropdown */}
      <AnimatePresence>
        {showHistory && promptHistory.length > 0 && (
          <motion.div
            ref={historyRef}
            className="vpp-prompt__dropdown"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className="vpp-prompt__dropdown-header">
              <span>Recent prompts</span>
              <button onClick={() => setShowHistory(false)}>
                <CloseIcon />
              </button>
            </div>
            <div className="vpp-prompt__history-list">
              {promptHistory.slice(0, 10).map((entry) => (
                <button
                  key={entry.id}
                  className="vpp-prompt__history-item"
                  onClick={() => handleHistorySelect(entry.prompt)}
                >
                  <span className="vpp-prompt__history-text">{entry.prompt}</span>
                  <span className="vpp-prompt__history-time">
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="vpp-prompt__input-container">
        <textarea
          ref={inputRef}
          className="vpp-prompt__input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (!prompt && suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder={`Describe how to style this ${element.componentName || element.tagName}...`}
          disabled={isPromptProcessing}
          rows={1}
        />
        <motion.button
          className="vpp-prompt__submit"
          onClick={handleSubmit}
          disabled={!prompt.trim() || isPromptProcessing}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isPromptProcessing ? (
            <span className="vpp-prompt__spinner" />
          ) : (
            <SendIcon />
          )}
        </motion.button>
      </div>

      {/* Processing indicator */}
      <AnimatePresence>
        {isPromptProcessing && (
          <motion.div
            className="vpp-prompt__processing"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <span className="vpp-prompt__processing-text">
              Generating styles...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard hint */}
      <div className="vpp-prompt__hint">
        <kbd>Enter</kbd> to submit, <kbd>Shift+Enter</kbd> for new line
      </div>
    </div>
  );
}

export default PromptInput;
