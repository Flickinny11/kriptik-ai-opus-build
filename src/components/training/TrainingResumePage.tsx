/**
 * Training Resume Page - Resume from Email/SMS Link
 *
 * Page for resuming training from a freeze state via secure link.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  AlertCircle3D,
  DollarSign3D,
  Play3D,
  Timer3D,
  Download3D,
  Zap3D,
  CheckCircle3D,
  XCircle3D,
} from '@/components/icons';
import type { BudgetState, FreezeState } from './types';
import { API_URL } from '@/lib/api-config';

type PageState = 'loading' | 'valid' | 'invalid' | 'expired' | 'resumed' | 'error';

export function TrainingResumePage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [pageState, setPageState] = useState<PageState>('loading');
  const [freezeState, setFreezeState] = useState<FreezeState | null>(null);
  const [budgetState, setBudgetState] = useState<BudgetState | null>(null);
  const [newBudget, setNewBudget] = useState<number>(0);
  const [isResuming, setIsResuming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId || !token) {
      setPageState('invalid');
      return;
    }

    validateToken();
  }, [jobId, token]);

  const validateToken = async () => {
    try {
      const response = await fetch(`${API_URL}/api/training/resume/${jobId}?token=${token}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        const data = await response.json();
        if (data.error === 'Invalid or expired resume token') {
          setPageState('expired');
        } else {
          setPageState('invalid');
        }
        return;
      }

      const data = await response.json();
      setFreezeState(data.freezeState);
      setBudgetState(data.budgetState);
      setNewBudget((data.budgetState?.maxBudget || 0) + 10);
      setPageState('valid');
    } catch {
      setPageState('error');
    }
  };

  const handleResume = async () => {
    if (!token) return;

    setIsResuming(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/training/jobs/${jobId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, newBudget }),
      });

      if (!response.ok) {
        throw new Error('Failed to resume training');
      }

      setPageState('resumed');

      // Redirect to training dashboard after 3 seconds
      setTimeout(() => {
        navigate(`/dashboard/training/${jobId}`);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume');
    } finally {
      setIsResuming(false);
    }
  };

  const handleTestModel = () => {
    navigate(`/dashboard/training/${jobId}/test`);
  };

  // Loading state
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-950 to-stone-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex p-4 rounded-full bg-amber-500/20 mb-4 animate-pulse">
            <Zap3D size={32} color="#f59e0b" animated={true} />
          </div>
          <p className="text-white/60">Validating resume link...</p>
        </div>
      </div>
    );
  }

  // Invalid or expired state
  if (pageState === 'invalid' || pageState === 'expired') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-950 to-stone-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md text-center"
        >
          <div className="inline-flex p-4 rounded-full bg-red-500/20 mb-4">
            <XCircle3D size={32} color="#ef4444" animated={false} />
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">
            {pageState === 'expired' ? 'Link Expired' : 'Invalid Link'}
          </h1>
          <p className="text-white/60 mb-6">
            {pageState === 'expired'
              ? 'This resume link has expired. Please request a new one from your dashboard.'
              : 'This resume link is invalid. Please check the link or sign in to your account.'}
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-medium transition-colors"
          >
            Go to Login
          </button>
        </motion.div>
      </div>
    );
  }

  // Resumed state
  if (pageState === 'resumed') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-950 to-stone-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md text-center"
        >
          <div className="inline-flex p-4 rounded-full bg-green-500/20 mb-4">
            <CheckCircle3D size={32} color="#22c55e" animated={true} />
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">
            Training Resumed
          </h1>
          <p className="text-white/60">
            Redirecting to your training dashboard...
          </p>
        </motion.div>
      </div>
    );
  }

  // Error state
  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-950 to-stone-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md text-center"
        >
          <div className="inline-flex p-4 rounded-full bg-red-500/20 mb-4">
            <AlertCircle3D size={32} color="#ef4444" animated={false} />
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">
            Something went wrong
          </h1>
          <p className="text-white/60 mb-6">
            We couldn't load the resume page. Please try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-medium transition-colors"
          >
            Try Again
          </button>
        </motion.div>
      </div>
    );
  }

  // Valid state - show resume form
  if (!freezeState || !budgetState) return null;

  const percentUsed = Math.round((budgetState.currentSpend / budgetState.maxBudget) * 100);
  const remainingToComplete = Math.max(0, budgetState.estimatedTotalSpend - budgetState.currentSpend);

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-950 to-stone-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg"
      >
        {/* Glass container */}
        <div className="relative rounded-2xl overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-stone-800/90 to-stone-900/95" />
          
          {/* Glass effect */}
          <div className="absolute inset-0 backdrop-blur-xl" />
          
          {/* Border */}
          <div className="absolute inset-0 rounded-2xl border border-white/10" />

          {/* Content */}
          <div className="relative p-8 space-y-6">
            {/* Header */}
            <div className="text-center">
              <div className="inline-flex p-4 rounded-full bg-amber-500/20 mb-4">
                <AlertCircle3D size={32} color="#f59e0b" animated={false} />
              </div>
              <h1 className="text-2xl font-semibold text-white mb-2">
                Resume Training
              </h1>
              <p className="text-white/60">
                Your training was paused at {percentUsed}% of budget
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
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-white/60">Original Budget</span>
                <span className="text-white font-medium">${budgetState.maxBudget.toFixed(2)}</span>
              </div>
            </div>

            {/* Checkpoint info */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center gap-2 text-white/80">
                <Timer3D size={16} color="rgba(255,255,255,0.6)" animated={false} />
                <span className="text-sm font-medium">Saved Checkpoint</span>
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
              <div className="text-xs text-white/40 text-center">
                Frozen {new Date(freezeState.frozenAt).toLocaleString()}
              </div>
            </div>

            {/* Budget adjustment */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-white/80">
                <DollarSign3D size={16} color="rgba(255,255,255,0.6)" animated={false} />
                New Budget
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
                  Estimated ~${remainingToComplete.toFixed(2)} more to complete
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
                onClick={handleTestModel}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white transition-colors"
              >
                <Download3D size={18} color="rgba(255,255,255,0.8)" animated={false} />
                Test Current
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
                    Resume
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default TrainingResumePage;
