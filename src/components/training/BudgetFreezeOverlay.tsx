/**
 * Budget Freeze Overlay - Training Frozen UI
 *
 * Full-screen overlay when training is frozen due to budget limits.
 * Allows budget adjustment and resume.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle3D,
  DollarSign3D,
  Play3D,
  Timer3D,
  Download3D,
  Zap3D,
} from '@/components/icons';
import type { BudgetState, FreezeState } from './types';
import { API_URL } from '@/lib/api-config';

interface BudgetFreezeOverlayProps {
  jobId: string;
  freezeState: FreezeState;
  budgetState: BudgetState;
  onResume: () => void;
  onTest: () => void;
  onClose?: () => void;
}

export function BudgetFreezeOverlay({
  jobId,
  freezeState,
  budgetState,
  onResume,
  onTest,
  onClose,
}: BudgetFreezeOverlayProps) {
  const [newBudget, setNewBudget] = useState(budgetState.maxBudget + 10);
  const [isResuming, setIsResuming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const percentUsed = Math.round((budgetState.currentSpend / budgetState.maxBudget) * 100);
  const remainingToComplete = Math.max(0, budgetState.estimatedTotalSpend - budgetState.currentSpend);

  const handleResume = async () => {
    setIsResuming(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/training/jobs/${jobId}/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ newBudget }),
      });

      if (!response.ok) {
        throw new Error('Failed to resume training');
      }

      onResume();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume');
    } finally {
      setIsResuming(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-lg mx-4"
        >
          {/* Glass container */}
          <div className="relative rounded-2xl overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-900/30 via-stone-900/90 to-stone-900/95" />
            
            {/* Glass effect */}
            <div className="absolute inset-0 backdrop-blur-xl" />
            
            {/* Border glow */}
            <div className="absolute inset-0 rounded-2xl border border-amber-500/30" />

            {/* Content */}
            <div className="relative p-8 space-y-6">
              {/* Header */}
              <div className="text-center">
                <div className="inline-flex p-4 rounded-full bg-amber-500/20 mb-4">
                  <AlertCircle3D size={32} color="#f59e0b" animated={true} />
                </div>
                <h2 className="text-2xl font-semibold text-white mb-2">
                  Training Paused
                </h2>
                <p className="text-white/60">
                  Budget limit reached at {percentUsed}%
                </p>
              </div>

              {/* Budget visual */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Current Spend</span>
                  <span className="text-white font-medium">${budgetState.currentSpend.toFixed(2)}</span>
                </div>
                
                {/* Progress bar */}
                <div className="relative h-4 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-red-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${percentUsed}%` }}
                    transition={{ duration: 0.5 }}
                  />
                  {/* Alert threshold marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-yellow-400"
                    style={{ left: `${budgetState.alertThreshold}%` }}
                  />
                  {/* Freeze threshold marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-400"
                    style={{ left: `${budgetState.freezeThreshold}%` }}
                  />
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Budget Limit</span>
                  <span className="text-white font-medium">${budgetState.maxBudget.toFixed(2)}</span>
                </div>
              </div>

              {/* Checkpoint info */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center gap-2 text-white/80">
                  <Timer3D size={16} color="rgba(255,255,255,0.6)" animated={false} />
                  <span className="text-sm font-medium">Checkpoint Saved</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xl font-semibold text-white">{freezeState.checkpoint.step.toLocaleString()}</div>
                    <div className="text-xs text-white/40">Steps</div>
                  </div>
                  <div>
                    <div className="text-xl font-semibold text-white">{freezeState.checkpoint.epoch}</div>
                    <div className="text-xs text-white/40">Epochs</div>
                  </div>
                  <div>
                    <div className="text-xl font-semibold text-white">{freezeState.checkpoint.loss.toFixed(4)}</div>
                    <div className="text-xs text-white/40">Loss</div>
                  </div>
                </div>
              </div>

              {/* Budget adjustment */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-white/80">
                  <DollarSign3D size={16} color="rgba(255,255,255,0.6)" animated={false} />
                  Adjust Budget to Continue
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">$</span>
                  <input
                    type="number"
                    value={newBudget}
                    onChange={(e) => setNewBudget(parseFloat(e.target.value) || 0)}
                    min={budgetState.currentSpend + 1}
                    step={5}
                    className="w-full pl-8 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                  />
                </div>
                {remainingToComplete > 0 && (
                  <p className="text-xs text-white/40">
                    Estimated ~${remainingToComplete.toFixed(2)} more to complete at current rate
                  </p>
                )}
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onTest}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white transition-colors"
                >
                  <Download3D size={18} color="rgba(255,255,255,0.8)" animated={false} />
                  Test Current Model
                </button>
                <button
                  onClick={handleResume}
                  disabled={isResuming || newBudget <= budgetState.currentSpend}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResuming ? (
                    <>
                      <Zap3D size={18} color="white" animated={true} />
                      Resuming...
                    </>
                  ) : (
                    <>
                      <Play3D size={18} color="white" animated={false} />
                      Resume Training
                    </>
                  )}
                </button>
              </div>

              {/* Close button (if cancelable) */}
              {onClose && (
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default BudgetFreezeOverlay;
