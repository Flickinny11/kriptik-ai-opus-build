/**
 * Implementation Tile - Approval Tile Component
 *
 * Card component for each configuration tile in the training plan.
 * Shows title, description, recommendation, and alternatives.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ImplementationTile as TileType } from '@/store/useTrainingStore';

interface ImplementationTileProps {
  tile: TileType;
  onModify: (modification: { type: string; value?: string; nlpPrompt?: string }) => void;
  isLoading?: boolean;
}

export function ImplementationTile({ tile, onModify, isLoading }: ImplementationTileProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);

  const currentValue = tile.userSelection || tile.recommendation;

  const statusColors = {
    pending: 'border-white/20',
    approved: 'border-emerald-500/50',
    modified: 'border-amber-500/50',
    skipped: 'border-white/10 opacity-50',
  };

  const statusBadges = {
    pending: null,
    approved: { text: 'Approved', color: 'bg-emerald-500/20 text-emerald-400' },
    modified: { text: 'Modified', color: 'bg-amber-500/20 text-amber-400' },
    skipped: { text: 'Skipped', color: 'bg-white/10 text-white/40' },
  };

  const categoryIcons: Record<string, string> = {
    model: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
    method: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    data: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
    gpu: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
    config: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    budget: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  };

  const handleSelectAlternative = (value: string) => {
    onModify({ type: 'select_alternative', value });
    setShowAlternatives(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        relative overflow-hidden rounded-2xl border transition-all duration-300
        ${statusColors[tile.status]}
        ${isExpanded ? 'ring-1 ring-cyan-500/30' : ''}
      `}
    >
      {/* Glass Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10" />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Category Icon */}
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={categoryIcons[tile.category] || categoryIcons.config} />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">{tile.title}</h3>
              <p className="text-xs text-white/50">{tile.description}</p>
            </div>
          </div>

          {/* Status Badge */}
          {statusBadges[tile.status] && (
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${statusBadges[tile.status]!.color}`}>
              {statusBadges[tile.status]!.text}
            </span>
          )}
        </div>

        {/* Current Selection */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40 mb-1">
                {tile.isRecommended ? 'Recommended' : 'Current Selection'}
              </p>
              <p className="text-base font-medium text-white">{currentValue}</p>
            </div>
            {tile.requiresApproval && tile.status === 'pending' && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onModify({ type: 'select_alternative', value: currentValue })}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
              >
                Approve
              </motion.button>
            )}
          </div>
        </div>

        {/* Alternatives Toggle */}
        {tile.alternatives.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAlternatives(!showAlternatives)}
            className="w-full flex items-center justify-between py-2 text-xs text-white/50 hover:text-white/70 transition-colors"
          >
            <span>{showAlternatives ? 'Hide alternatives' : `${tile.alternatives.length} alternatives available`}</span>
            <svg
              className={`w-4 h-4 transition-transform ${showAlternatives ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {/* Alternatives List */}
        <AnimatePresence>
          {showAlternatives && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-2 space-y-2">
                {tile.alternatives.map((alt) => (
                  <motion.button
                    key={alt.id}
                    type="button"
                    onClick={() => handleSelectAlternative(alt.value)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    disabled={isLoading}
                    className={`
                      w-full p-3 rounded-xl text-left transition-all duration-200
                      ${alt.value === currentValue
                        ? 'bg-cyan-500/10 border border-cyan-500/30'
                        : 'bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{alt.label}</p>
                        <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{alt.description}</p>
                        {alt.tradeoff && (
                          <p className="text-[10px] text-amber-400/70 mt-1 italic">{alt.tradeoff}</p>
                        )}
                      </div>
                      {alt.costImpact && (
                        <div className="text-right shrink-0">
                          <p className="text-xs text-white/60">${alt.costImpact.min}-${alt.costImpact.max}</p>
                        </div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Metadata Display */}
        {tile.metadata && isExpanded && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(tile.metadata).map(([key, value]) => {
                if (typeof value === 'object') return null;
                return (
                  <div key={key} className="flex justify-between">
                    <span className="text-white/40 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="text-white/70">{String(value)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Expand Toggle */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute bottom-2 right-2 p-1 rounded text-white/30 hover:text-white/50 transition-colors"
        >
          <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
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

export default ImplementationTile;
