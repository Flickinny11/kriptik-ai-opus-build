/**
 * Model Comparison - Side-by-side comparison of pretrained vs fine-tuned
 * 
 * Synchronized input, split view responses, quality metrics display.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  Clock,
  DollarSign,
  Sparkles,
  ArrowLeftRight
} from 'lucide-react';
import { authenticatedFetch, API_URL } from '@/lib/api-config';
import type { ModelModality } from '@/store/useTrainingStore';

interface ModelComparisonProps {
  pretrainedModelId: string;
  finetunedModelId: string;
  modality: ModelModality;
  trainingJobId: string;
}

interface ComparisonResult {
  pretrained: {
    output: string;
    latencyMs: number;
    tokensUsed?: number;
    cost: number;
  };
  finetuned: {
    output: string;
    latencyMs: number;
    tokensUsed?: number;
    cost: number;
  };
  metrics?: {
    qualityImprovement?: number;
    coherenceScore?: number;
    relevanceScore?: number;
  };
}

export function ModelComparison({ pretrainedModelId, finetunedModelId, modality, trainingJobId }: ModelComparisonProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [copiedSide, setCopiedSide] = useState<'pretrained' | 'finetuned' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    if (!input.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authenticatedFetch(`${API_URL}/api/model-testing/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pretrainedModelId,
          finetunedModelId,
          trainingJobId,
          modality,
          input: { text: input },
        }),
      });
      
      if (!response.ok) {
        throw new Error('Comparison failed');
      }
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, side: 'pretrained' | 'finetuned') => {
    navigator.clipboard.writeText(text);
    setCopiedSide(side);
    setTimeout(() => setCopiedSide(null), 2000);
  };

  const handleReset = () => {
    setInput('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Input area */}
      <div className="p-4 bg-white/5 rounded-xl border border-white/10">
        <label className="block text-sm font-medium text-white/80 mb-2">
          Test Prompt
        </label>
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              modality === 'llm'
                ? 'Enter a prompt to test both models...'
                : modality === 'image'
                ? 'Enter an image generation prompt...'
                : 'Enter your test input...'
            }
            rows={3}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50 resize-none"
          />
          <div className="flex items-center justify-between mt-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-white/60 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={handleCompare}
              disabled={isLoading || !input.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Comparing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Compare
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
          {error}
        </div>
      )}

      {/* Comparison results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Header with comparison icon */}
            <div className="flex items-center justify-center gap-3 py-2">
              <span className="text-sm text-white/60">Pretrained</span>
              <ArrowLeftRight className="w-5 h-5 text-white/40" />
              <span className="text-sm text-white/60">Fine-tuned</span>
            </div>

            {/* Split view */}
            <div className="grid grid-cols-2 gap-4">
              {/* Pretrained output */}
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-white/80">Pretrained</h4>
                  <button
                    onClick={() => handleCopy(result.pretrained.output, 'pretrained')}
                    className="p-1.5 rounded hover:bg-white/10 transition-colors"
                  >
                    {copiedSide === 'pretrained' ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-white/40" />
                    )}
                  </button>
                </div>
                <div className="p-3 bg-black/20 rounded-lg min-h-[120px] max-h-[300px] overflow-y-auto">
                  <p className="text-sm text-white/80 whitespace-pre-wrap">
                    {result.pretrained.output}
                  </p>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-white/40">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {result.pretrained.latencyMs}ms
                  </span>
                  {result.pretrained.tokensUsed && (
                    <span>{result.pretrained.tokensUsed} tokens</span>
                  )}
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    ${result.pretrained.cost.toFixed(4)}
                  </span>
                </div>
              </div>

              {/* Fine-tuned output */}
              <div className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/20">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-blue-400 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Fine-tuned
                  </h4>
                  <button
                    onClick={() => handleCopy(result.finetuned.output, 'finetuned')}
                    className="p-1.5 rounded hover:bg-white/10 transition-colors"
                  >
                    {copiedSide === 'finetuned' ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-white/40" />
                    )}
                  </button>
                </div>
                <div className="p-3 bg-black/20 rounded-lg min-h-[120px] max-h-[300px] overflow-y-auto">
                  <p className="text-sm text-white/80 whitespace-pre-wrap">
                    {result.finetuned.output}
                  </p>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-white/40">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {result.finetuned.latencyMs}ms
                  </span>
                  {result.finetuned.tokensUsed && (
                    <span>{result.finetuned.tokensUsed} tokens</span>
                  )}
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    ${result.finetuned.cost.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>

            {/* Metrics */}
            {result.metrics && (
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <h4 className="text-sm font-medium text-white/80 mb-3">Quality Metrics</h4>
                <div className="grid grid-cols-3 gap-4">
                  {result.metrics.qualityImprovement !== undefined && (
                    <MetricCard
                      label="Quality Improvement"
                      value={`${result.metrics.qualityImprovement > 0 ? '+' : ''}${result.metrics.qualityImprovement.toFixed(1)}%`}
                      positive={result.metrics.qualityImprovement > 0}
                    />
                  )}
                  {result.metrics.coherenceScore !== undefined && (
                    <MetricCard
                      label="Coherence Score"
                      value={`${result.metrics.coherenceScore.toFixed(1)}/10`}
                      positive={result.metrics.coherenceScore > 7}
                    />
                  )}
                  {result.metrics.relevanceScore !== undefined && (
                    <MetricCard
                      label="Relevance Score"
                      value={`${result.metrics.relevanceScore.toFixed(1)}/10`}
                      positive={result.metrics.relevanceScore > 7}
                    />
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MetricCard({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="p-3 bg-white/5 rounded-lg">
      <div className="text-xs text-white/40 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${positive ? 'text-green-400' : 'text-white/80'}`}>
        {value}
      </div>
    </div>
  );
}
