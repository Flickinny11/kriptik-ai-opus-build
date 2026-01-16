/**
 * Training Intent Input - NLP Prompt Box for Flagship Training
 *
 * Large NLP input for describing training goals in natural language.
 * Similar to Builder View prompt box.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTrainingStore } from '@/store/useTrainingStore';

interface TrainingIntentInputProps {
  onParseComplete?: () => void;
}

export function TrainingIntentInput({ onParseComplete }: TrainingIntentInputProps) {
  const {
    nlpPrompt,
    setNlpPrompt,
    parseTrainingIntent,
    isParsingIntent,
    error,
  } = useTrainingStore();

  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlpPrompt.trim() || isParsingIntent) return;
    await parseTrainingIntent();
    onParseComplete?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const examplePrompts = [
    'Train a model to generate Suno-quality music with expressive vocals and instrumentals',
    'Fine-tune Llama 3.3 to be an expert legal document analyzer',
    'Create a Veo-level video generation model for cinematic short films',
    'Train a voice cloning model for audiobook narration',
    'Fine-tune GPT-4 level coding assistant for TypeScript and React',
  ];

  return (
    <div className="w-full max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Header */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-semibold text-white mb-2 tracking-tight">
            What do you want to train?
          </h2>
          <p className="text-white/60 text-sm">
            Describe your training goal in natural language. AI will create an implementation plan.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit}>
          <div
            className={`
              relative rounded-2xl overflow-hidden transition-all duration-300
              ${isFocused ? 'ring-2 ring-cyan-500/50 shadow-lg shadow-cyan-500/10' : 'ring-1 ring-white/10'}
            `}
          >
            {/* Glass Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-white/[0.03] backdrop-blur-xl" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />

            {/* Textarea */}
            <div className="relative">
              <textarea
                value={nlpPrompt}
                onChange={(e) => setNlpPrompt(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder="Describe what you want to train... e.g., 'Train a model to generate Suno-quality music with expressive vocals'"
                className="
                  w-full min-h-[140px] p-6 pb-20
                  bg-transparent text-white text-base
                  placeholder:text-white/40
                  resize-none focus:outline-none
                  font-light tracking-wide leading-relaxed
                "
                disabled={isParsingIntent}
              />

              {/* Submit Area */}
              <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
                <span className="text-xs text-white/40">
                  Press Enter to submit, Shift+Enter for new line
                </span>
                <motion.button
                  type="submit"
                  disabled={!nlpPrompt.trim() || isParsingIntent}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`
                    px-6 py-2.5 rounded-xl font-medium text-sm
                    transition-all duration-200
                    ${nlpPrompt.trim() && !isParsingIntent
                      ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/25'
                      : 'bg-white/10 text-white/40 cursor-not-allowed'
                    }
                  `}
                >
                  {isParsingIntent ? (
                    <span className="flex items-center gap-2">
                      <motion.span
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                      Analyzing...
                    </span>
                  ) : (
                    'Create Training Plan'
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        </form>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
          >
            {error}
          </motion.div>
        )}

        {/* Example Prompts */}
        <div className="mt-8">
          <p className="text-xs text-white/40 mb-3 uppercase tracking-wider">Examples</p>
          <div className="flex flex-wrap gap-2">
            {examplePrompts.map((prompt, idx) => (
              <motion.button
                key={idx}
                type="button"
                onClick={() => setNlpPrompt(prompt)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="
                  px-3 py-1.5 rounded-lg text-xs
                  bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80
                  border border-white/5 hover:border-white/10
                  transition-all duration-200
                  line-clamp-1
                "
              >
                {prompt.length > 60 ? prompt.slice(0, 60) + '...' : prompt}
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default TrainingIntentInput;
