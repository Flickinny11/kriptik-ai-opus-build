/**
 * Comparison View - Side-by-side model output comparison
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TextOutput } from './outputs/TextOutput';
import { ImageOutput } from './outputs/ImageOutput';
import { AudioOutput } from './outputs/AudioOutput';
import { VideoOutput } from './outputs/VideoOutput';

type ModelModality = 'llm' | 'image' | 'audio' | 'video' | 'code';

interface ComparisonResult {
  pretrained: {
    output: unknown;
    outputUrl?: string;
    latency: number;
    cost: number;
    tokensUsed?: number;
  };
  finetuned: {
    output: unknown;
    outputUrl?: string;
    latency: number;
    cost: number;
    tokensUsed?: number;
  };
  prompt: string;
  timestamp: string;
}

interface ComparisonViewProps {
  result: ComparisonResult;
  modality: ModelModality;
  pretrainedLabel?: string;
  finetunedLabel?: string;
  onPreferenceSelect?: (preference: 'pretrained' | 'finetuned' | 'equal') => void;
}

export function ComparisonView({
  result,
  modality,
  pretrainedLabel = 'Original Model',
  finetunedLabel = 'Fine-Tuned Model',
  onPreferenceSelect,
}: ComparisonViewProps) {
  const [preference, setPreference] = useState<'pretrained' | 'finetuned' | 'equal' | null>(null);
  const [syncAudioVideo, setSyncAudioVideo] = useState(true);

  const handlePreference = (pref: 'pretrained' | 'finetuned' | 'equal') => {
    setPreference(pref);
    onPreferenceSelect?.(pref);
  };

  const renderOutput = (data: ComparisonResult['pretrained'] | ComparisonResult['finetuned']) => {
    switch (modality) {
      case 'llm':
      case 'code':
        return (
          <TextOutput
            content={String(data.output)}
            tokensUsed={data.tokensUsed}
            latency={data.latency}
            cost={data.cost}
          />
        );

      case 'image':
        return (
          <ImageOutput
            src={data.outputUrl || String(data.output)}
            latency={data.latency}
            cost={data.cost}
          />
        );

      case 'audio':
        return (
          <AudioOutput
            src={data.outputUrl || String(data.output)}
            latency={data.latency}
            cost={data.cost}
          />
        );

      case 'video':
        return (
          <VideoOutput
            src={data.outputUrl || String(data.output)}
            latency={data.latency}
            cost={data.cost}
          />
        );

      default:
        return <div className="text-white/60">Unsupported modality</div>;
    }
  };

  const latencyDiff = result.finetuned.latency - result.pretrained.latency;
  const costDiff = result.finetuned.cost - result.pretrained.cost;
  const latencyImprovement = result.pretrained.latency > 0
    ? ((result.pretrained.latency - result.finetuned.latency) / result.pretrained.latency * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Prompt */}
      <div className="p-3 bg-white/5 rounded-lg border border-white/10">
        <p className="text-sm text-white/60">Prompt:</p>
        <p className="text-sm text-white">{result.prompt}</p>
      </div>

      {/* Sync Toggle (for audio/video) */}
      {(modality === 'audio' || modality === 'video') && (
        <div className="flex items-center gap-2 text-sm text-white/60">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={syncAudioVideo}
              onChange={(e) => setSyncAudioVideo(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/10 text-cyan-500 focus:ring-cyan-500"
            />
            Sync playback
          </label>
        </div>
      )}

      {/* Side-by-Side Comparison */}
      <div className="grid grid-cols-2 gap-4">
        {/* Pretrained Output */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-white/80">{pretrainedLabel}</h4>
            <span className="text-xs text-white/40">{result.pretrained.latency}ms</span>
          </div>
          <div className={`rounded-xl border transition-colors ${
            preference === 'pretrained'
              ? 'border-green-500/50 bg-green-500/10'
              : 'border-white/10'
          }`}>
            {renderOutput(result.pretrained)}
          </div>
        </div>

        {/* Finetuned Output */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-white/80">{finetunedLabel}</h4>
            <span className="text-xs text-white/40">{result.finetuned.latency}ms</span>
          </div>
          <div className={`rounded-xl border transition-colors ${
            preference === 'finetuned'
              ? 'border-green-500/50 bg-green-500/10'
              : 'border-white/10'
          }`}>
            {renderOutput(result.finetuned)}
          </div>
        </div>
      </div>

      {/* Metrics Comparison */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
        <div className="text-center">
          <div className="text-xs text-white/40 mb-1">Latency Diff</div>
          <div className={`text-lg font-semibold ${latencyDiff < 0 ? 'text-green-400' : latencyDiff > 0 ? 'text-red-400' : 'text-white'}`}>
            {latencyDiff > 0 ? '+' : ''}{latencyDiff}ms
          </div>
          {latencyImprovement !== 0 && (
            <div className={`text-xs ${latencyImprovement > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {latencyImprovement > 0 ? '+' : ''}{latencyImprovement.toFixed(1)}%
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="text-xs text-white/40 mb-1">Cost Diff</div>
          <div className={`text-lg font-semibold ${costDiff < 0 ? 'text-green-400' : costDiff > 0 ? 'text-red-400' : 'text-white'}`}>
            {costDiff > 0 ? '+' : ''}${costDiff.toFixed(4)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-white/40 mb-1">Total Cost</div>
          <div className="text-lg font-semibold text-white">
            ${(result.pretrained.cost + result.finetuned.cost).toFixed(4)}
          </div>
        </div>
      </div>

      {/* Preference Selection */}
      {onPreferenceSelect && (
        <div className="space-y-2">
          <p className="text-sm text-white/60">Which output is better?</p>
          <div className="flex gap-2">
            <button
              onClick={() => handlePreference('pretrained')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm transition-colors ${
                preference === 'pretrained'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-white/10 text-white/60 hover:text-white'
              }`}
            >
              {pretrainedLabel}
            </button>
            <button
              onClick={() => handlePreference('equal')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                preference === 'equal'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-white/10 text-white/60 hover:text-white'
              }`}
            >
              Equal
            </button>
            <button
              onClick={() => handlePreference('finetuned')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm transition-colors ${
                preference === 'finetuned'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-white/10 text-white/60 hover:text-white'
              }`}
            >
              {finetunedLabel}
            </button>
          </div>
          <p className="text-xs text-white/30 text-center">
            Your feedback helps improve model evaluation
          </p>
        </div>
      )}

      {/* Timestamp */}
      <div className="text-xs text-white/30 text-right">
        {new Date(result.timestamp).toLocaleString()}
      </div>
    </motion.div>
  );
}

export default ComparisonView;
