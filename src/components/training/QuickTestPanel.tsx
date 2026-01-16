/**
 * Quick Test Panel - Collapsible panel for testing during training
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authenticatedFetch, API_URL } from '@/lib/api-config';

interface QuickTestPanelProps {
  jobId?: string; // Optional, for future use
  baseModelId: string;
  checkpointPath?: string;
  modality: 'llm' | 'image' | 'audio' | 'video' | 'code';
}

interface QuickTestResult {
  output: string;
  latency: number;
  checkpoint: string;
}

export function QuickTestPanel({
  jobId: _jobId,
  baseModelId,
  checkpointPath,
  modality,
}: QuickTestPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QuickTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runQuickTest = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await authenticatedFetch(`${API_URL}/api/training/test/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: checkpointPath || baseModelId,
          modality,
          textPrompt: prompt,
        }),
      });

      if (!response.ok) {
        throw new Error('Test failed');
      }

      const data = await response.json();
      setResult({
        output: String(data.result.output),
        latency: data.result.latency,
        checkpoint: checkpointPath || 'base',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-white/80 transition-colors"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        >
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Quick Test
      </button>

      {/* Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 z-10"
          >
            <div className="p-4 bg-stone-800/95 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl space-y-4">
              {/* Checkpoint indicator */}
              {checkpointPath && (
                <div className="text-xs text-white/40">
                  Testing checkpoint: <span className="text-cyan-400">{checkpointPath.split('/').pop()}</span>
                </div>
              )}

              {/* Input */}
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  modality === 'llm' ? 'Enter a quick test prompt...' :
                  modality === 'code' ? 'Enter code to complete...' :
                  'Describe what to generate...'
                }
                rows={3}
                disabled={isLoading}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50 resize-none disabled:opacity-50"
              />

              {/* Run button */}
              <button
                onClick={runQuickTest}
                disabled={!prompt.trim() || isLoading}
                className="w-full px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Run Quick Test'
                )}
              </button>

              {/* Error */}
              {error && (
                <div className="p-2 rounded-lg bg-red-500/20 text-red-400 text-xs">
                  {error}
                </div>
              )}

              {/* Result */}
              {result && (
                <div className="p-3 bg-white/5 rounded-lg border border-white/10 space-y-2">
                  <div className="flex justify-between text-xs text-white/40">
                    <span>Output</span>
                    <span>{result.latency}ms</span>
                  </div>
                  <pre className="text-sm text-white whitespace-pre-wrap font-sans">
                    {result.output}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default QuickTestPanel;
