/**
 * Training Method Tile - Specialized Method Selection
 *
 * Shows training method with pipeline visualization for multi-stage training.
 */

import React from 'react';
import { motion } from 'framer-motion';
import type { ImplementationTile } from '@/store/useTrainingStore';

interface TrainingMethodTileProps {
  tile: ImplementationTile;
  onModify: (modification: { type: string; value?: string }) => void;
  isLoading?: boolean;
}

const methodDescriptions: Record<string, { name: string; description: string; color: string }> = {
  lora: { name: 'LoRA', description: 'Low-Rank Adaptation for efficient fine-tuning', color: 'from-blue-500 to-cyan-500' },
  qlora: { name: 'QLoRA', description: 'Quantized LoRA for memory efficiency', color: 'from-purple-500 to-blue-500' },
  dora: { name: 'DoRA', description: 'Weight-Decomposed Low-Rank Adaptation', color: 'from-emerald-500 to-teal-500' },
  dpo: { name: 'DPO', description: 'Direct Preference Optimization', color: 'from-amber-500 to-orange-500' },
  rlhf: { name: 'RLHF', description: 'Reinforcement Learning from Human Feedback', color: 'from-rose-500 to-pink-500' },
  full_finetune: { name: 'Full Fine-tune', description: 'Complete model weight updates', color: 'from-indigo-500 to-purple-500' },
  hybrid_lora_dpo: { name: 'LoRA + DPO', description: 'Multi-stage: LoRA adaptation then DPO alignment', color: 'from-cyan-500 to-teal-500' },
  dreambooth: { name: 'DreamBooth', description: 'Personalized image generation', color: 'from-pink-500 to-rose-500' },
  voice_clone: { name: 'Voice Clone', description: 'Voice synthesis adaptation', color: 'from-violet-500 to-purple-500' },
};

export function TrainingMethodTile({ tile, onModify, isLoading }: TrainingMethodTileProps) {
  const methodKey = (tile.userSelection || tile.recommendation).toLowerCase().replace(/ /g, '_');
  const methodInfo = methodDescriptions[methodKey] || {
    name: tile.userSelection || tile.recommendation,
    description: 'Advanced training method',
    color: 'from-slate-500 to-slate-600',
  };

  const isMultiStage = methodKey.includes('hybrid') || methodKey.includes('+') || tile.recommendation.includes('→');
  const stages = isMultiStage
    ? (tile.userSelection || tile.recommendation).split(/[→+]/).map(s => s.trim())
    : [tile.userSelection || tile.recommendation];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-white/20"
    >
      {/* Glass Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl" />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${methodInfo.color} flex items-center justify-center`}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Training Method</h3>
            <p className="text-xs text-white/50">How your model will be trained</p>
          </div>
        </div>

        {/* Method Display */}
        <div className="mb-4">
          <p className="text-lg font-semibold text-white mb-1">{methodInfo.name}</p>
          <p className="text-xs text-white/60">{methodInfo.description}</p>
        </div>

        {/* Pipeline Visualization (for multi-stage) */}
        {isMultiStage && stages.length > 1 && (
          <div className="mb-4">
            <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Training Pipeline</p>
            <div className="flex items-center gap-2">
              {stages.map((stage, idx) => (
                <React.Fragment key={idx}>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex-1 px-3 py-2 rounded-lg bg-gradient-to-r from-white/10 to-white/5 border border-white/10"
                  >
                    <p className="text-xs font-medium text-white text-center">{stage}</p>
                    <p className="text-[10px] text-white/40 text-center">Stage {idx + 1}</p>
                  </motion.div>
                  {idx < stages.length - 1 && (
                    <svg className="w-4 h-4 text-white/30 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        {tile.metadata && (
          <div className="grid grid-cols-2 gap-3">
            {tile.metadata.estimatedHours !== undefined && (
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <p className="text-[10px] text-white/40 uppercase">Est. Time</p>
                <p className="text-sm font-medium text-white">{String(tile.metadata.estimatedHours)}h</p>
              </div>
            )}
            {tile.metadata.tier !== undefined && (
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <p className="text-[10px] text-white/40 uppercase">Quality Tier</p>
                <p className="text-sm font-medium text-white capitalize">{String(tile.metadata.tier)}</p>
              </div>
            )}
          </div>
        )}

        {/* Alternatives */}
        {tile.alternatives.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs text-white/40 mb-2">Other Options</p>
            <div className="space-y-2">
              {tile.alternatives.slice(0, 3).map((alt) => (
                <button
                  key={alt.id}
                  type="button"
                  onClick={() => onModify({ type: 'select_alternative', value: alt.value })}
                  disabled={isLoading}
                  className="w-full p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all text-left"
                >
                  <p className="text-xs font-medium text-white">{alt.label}</p>
                  {alt.costImpact && (
                    <p className="text-[10px] text-white/40">${alt.costImpact.min}-${alt.costImpact.max}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <motion.div
            className="w-6 h-6 border-2 border-white/20 border-t-cyan-500 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      )}
    </motion.div>
  );
}

export default TrainingMethodTile;
