/**
 * Training Implementation Plan - Main Plan Display
 *
 * Displays the full implementation plan with tile grid,
 * summary, and approval controls.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTrainingStore } from '@/store/useTrainingStore';
import { ImplementationTile } from './ImplementationTile';
import { TrainingMethodTile } from './TrainingMethodTile';
import { DataSourceTile } from './DataSourceTile';
import { GPUConfigTile } from './GPUConfigTile';
import { BudgetAuthorizationTile } from './BudgetAuthorizationTile';

interface TrainingImplementationPlanProps {
  onApproved?: (jobId: string) => void;
}

export function TrainingImplementationPlan({ onApproved }: TrainingImplementationPlanProps) {
  const {
    currentPlan,
    isLoading,
    isApprovingPlan,
    budgetAuthorization,
    modifyTile,
    modifyPlanWithAI,
    approvePlan,
    resetPlan,
    error,
  } = useTrainingStore();

  const [aiModification, setAiModification] = useState('');
  const [showAiInput, setShowAiInput] = useState(false);

  if (!currentPlan) {
    return null;
  }

  const handleTileModify = async (
    tileId: string,
    modification: { type: string; value?: string; nlpPrompt?: string }
  ) => {
    await modifyTile(tileId, modification);
  };

  const handleAiModify = async () => {
    if (!aiModification.trim()) return;
    await modifyPlanWithAI(aiModification);
    setAiModification('');
    setShowAiInput(false);
  };

  const handleApprove = async () => {
    const jobId = await approvePlan();
    if (jobId) {
      onApproved?.(jobId);
    }
  };

  const renderTile = (tile: typeof currentPlan.tiles[0]) => {
    switch (tile.category) {
      case 'method':
        return (
          <TrainingMethodTile
            key={tile.id}
            tile={tile}
            onModify={(mod) => handleTileModify(tile.id, mod)}
            isLoading={isLoading}
          />
        );
      case 'data':
        return (
          <DataSourceTile
            key={tile.id}
            tile={tile}
            onModify={(mod) => handleTileModify(tile.id, mod)}
            isLoading={isLoading}
          />
        );
      case 'gpu':
        return (
          <GPUConfigTile
            key={tile.id}
            tile={tile}
            onModify={(mod) => handleTileModify(tile.id, mod)}
            isLoading={isLoading}
          />
        );
      case 'budget':
        return (
          <BudgetAuthorizationTile
            key={tile.id}
            estimatedMin={currentPlan.summary.estimatedCost.min}
            estimatedMax={currentPlan.summary.estimatedCost.max}
            recommendedBudget={Math.ceil(currentPlan.summary.estimatedCost.max * 1.2)}
          />
        );
      default:
        return (
          <ImplementationTile
            key={tile.id}
            tile={tile}
            onModify={(mod) => handleTileModify(tile.id, mod)}
            isLoading={isLoading}
          />
        );
    }
  };

  const canApprove =
    budgetAuthorization.termsAccepted &&
    budgetAuthorization.maxBudget > 0 &&
    currentPlan.status !== 'approved';

  return (
    <div className="w-full max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Summary Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-white mb-1 tracking-tight">
                Training Plan
              </h2>
              <p className="text-white/60 text-sm">
                {currentPlan.summary.targetCapability} - {currentPlan.summary.qualityBenchmark}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAiInput(!showAiInput)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 text-white/80 hover:bg-white/15 transition-colors"
              >
                Modify with AI
              </button>
              <button
                type="button"
                onClick={resetPlan}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 text-white/50 hover:text-white/70 hover:bg-white/10 transition-colors"
              >
                Start Over
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Method', value: currentPlan.summary.selectedMethod },
              { label: 'GPU', value: currentPlan.summary.gpuRequirement },
              { label: 'Time', value: currentPlan.summary.estimatedTime },
              {
                label: 'Cost',
                value: `$${currentPlan.summary.estimatedCost.min} - $${currentPlan.summary.estimatedCost.max}`,
              },
            ].map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-4 rounded-xl bg-white/5 border border-white/10"
              >
                <p className="text-xs text-white/40 mb-1">{stat.label}</p>
                <p className="text-sm font-medium text-white truncate">{stat.value}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* AI Modification Input */}
        <AnimatePresence>
          {showAiInput && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={aiModification}
                    onChange={(e) => setAiModification(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAiModify()}
                    placeholder="e.g., 'Use a smaller model' or 'Make it cheaper' or 'Add DPO alignment'"
                    className="
                      flex-1 px-4 py-3 rounded-xl
                      bg-white/5 border border-white/10
                      text-white text-sm placeholder:text-white/40
                      focus:outline-none focus:ring-1 focus:ring-cyan-500/30
                    "
                  />
                  <motion.button
                    type="button"
                    onClick={handleAiModify}
                    disabled={!aiModification.trim() || isLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`
                      px-6 py-3 rounded-xl text-sm font-medium transition-all
                      ${aiModification.trim() && !isLoading
                        ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white'
                        : 'bg-white/10 text-white/40 cursor-not-allowed'
                      }
                    `}
                  >
                    {isLoading ? 'Updating...' : 'Apply Changes'}
                  </motion.button>
                </div>
                <p className="text-xs text-white/40 mt-2">
                  Describe changes in natural language. AI will update the relevant configuration tiles.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
          >
            {error}
          </motion.div>
        )}

        {/* Tile Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {currentPlan.tiles.map((tile, idx) => (
            <motion.div
              key={tile.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              {renderTile(tile)}
            </motion.div>
          ))}
        </div>

        {/* Pending Decisions */}
        {currentPlan.pendingDecisions.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-medium text-white mb-4">Decisions Needed</h3>
            <div className="space-y-3">
              {currentPlan.pendingDecisions.map((decision) => (
                <div
                  key={decision.id}
                  className="p-4 rounded-xl bg-white/5 border border-white/10"
                >
                  <p className="text-sm text-white mb-3">{decision.question}</p>
                  <div className="flex flex-wrap gap-2">
                    {decision.options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`
                          px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                          ${decision.answer === option
                            ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400'
                            : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
                          }
                        `}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approval Button */}
        <div className="flex justify-end gap-4">
          {currentPlan.status === 'approved' ? (
            <div className="flex items-center gap-3 px-6 py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-emerald-400 font-medium">Plan Approved</span>
            </div>
          ) : (
            <motion.button
              type="button"
              onClick={handleApprove}
              disabled={!canApprove || isApprovingPlan}
              whileHover={canApprove ? { scale: 1.02 } : {}}
              whileTap={canApprove ? { scale: 0.98 } : {}}
              className={`
                px-8 py-4 rounded-2xl text-base font-semibold transition-all duration-300
                ${canApprove
                  ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/30'
                  : 'bg-white/10 text-white/40 cursor-not-allowed'
                }
              `}
            >
              {isApprovingPlan ? (
                <span className="flex items-center gap-3">
                  <motion.span
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  Approving...
                </span>
              ) : (
                'Approve & Start Training'
              )}
            </motion.button>
          )}
        </div>

        {!canApprove && currentPlan.status !== 'approved' && (
          <p className="text-center text-xs text-white/40 mt-3">
            Accept the budget authorization terms to proceed
          </p>
        )}
      </motion.div>
    </div>
  );
}

export default TrainingImplementationPlan;
