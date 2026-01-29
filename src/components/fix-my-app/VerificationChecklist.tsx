/**
 * VerificationChecklist
 * 
 * Displays the list of features from the user's intent that have been
 * verified as working in the fixed app.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2Icon,
  CircleIcon,
  XCircleIcon,
  RefreshCwIcon,
  Loader2Icon,
  ImagePlusIcon,
  PlayIcon,
} from '../ui/icons';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/use-toast';

interface VerificationItem {
  id: string;
  feature: string;
  description: string;
  status: 'verified' | 'pending' | 'failed';
  verifiedAt?: string;
  screenshot?: string;
  testSteps?: string[];
}

interface VerificationChecklistProps {
  projectId: string;
  items: VerificationItem[];
  onRetest?: (itemId: string) => void;
}

export function VerificationChecklist({
  projectId,
  items,
  onRetest,
}: VerificationChecklistProps) {
  const { toast } = useToast();
  const [retestingId, setRetestingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleRetest = async (itemId: string) => {
    setRetestingId(itemId);

    try {
      await apiClient.post(`/api/fix-my-app/${projectId}/verify/${itemId}`);
      toast({
        title: 'Retest started',
        description: 'Agent is re-testing this feature...',
      });
      onRetest?.(itemId);
    } catch (error) {
      console.error('Retest failed:', error);
      toast({
        title: 'Retest failed',
        description: 'Could not start the retest. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRetestingId(null);
    }
  };

  const verifiedCount = items.filter(i => i.status === 'verified').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  const getStatusIcon = (status: VerificationItem['status'], isRetesting: boolean) => {
    if (isRetesting) {
      return <Loader2Icon size={18} className="animate-spin text-amber-400" />;
    }
    switch (status) {
      case 'verified':
        return <CheckCircle2Icon size={18} className="text-emerald-400" />;
      case 'failed':
        return <XCircleIcon size={18} className="text-red-400" />;
      default:
        return <CircleIcon size={18} className="text-slate-500" />;
    }
  };

  const getStatusColor = (status: VerificationItem['status']) => {
    switch (status) {
      case 'verified':
        return 'border-emerald-500/30 bg-emerald-500/5';
      case 'failed':
        return 'border-red-500/30 bg-red-500/5';
      default:
        return 'border-slate-700/50 bg-slate-800/50';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">Feature Verification</h3>
          <p className="text-sm text-slate-400">
            All intended features from your original chat
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2Icon size={14} />
            {verifiedCount} verified
          </span>
          {failedCount > 0 && (
            <span className="flex items-center gap-1.5 text-red-400">
              <XCircleIcon size={14} />
              {failedCount} failed
            </span>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(verifiedCount / items.length) * 100}%` }}
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
        />
      </div>

      {/* Items */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`rounded-xl border transition-all ${getStatusColor(item.status)}`}
            >
              {/* Main row */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer"
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
              >
                {getStatusIcon(item.status, retestingId === item.id)}
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white truncate">{item.feature}</h4>
                  <p className="text-sm text-slate-400 truncate">{item.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  {item.screenshot && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Open screenshot modal
                      }}
                      className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                      title="View screenshot"
                    >
                      <ImagePlusIcon size={16} className="text-slate-400" />
                    </button>
                  )}
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRetest(item.id);
                    }}
                    disabled={retestingId === item.id}
                    className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors disabled:opacity-50"
                    title="Retest"
                  >
                    <RefreshCwIcon size={16} className="text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              <AnimatePresence>
                {expandedId === item.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-2 border-t border-slate-700/50 space-y-3">
                      {/* Verification time */}
                      {item.verifiedAt && (
                        <p className="text-xs text-slate-500">
                          Verified {new Date(item.verifiedAt).toLocaleString()}
                        </p>
                      )}

                      {/* Test steps */}
                      {item.testSteps && item.testSteps.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-slate-400 mb-2">Test Steps:</p>
                          <ol className="space-y-1">
                            {item.testSteps.map((step, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                <span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-xs flex-shrink-0">
                                  {i + 1}
                                </span>
                                {step}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {/* Screenshot */}
                      {item.screenshot && (
                        <div className="relative rounded-lg overflow-hidden border border-slate-700">
                          <img
                            src={item.screenshot}
                            alt={`Screenshot of ${item.feature}`}
                            className="w-full h-auto"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                        </div>
                      )}

                      {/* Quick retest */}
                      <button
                        onClick={() => handleRetest(item.id)}
                        disabled={retestingId === item.id}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-sm transition-colors disabled:opacity-50"
                      >
                        {retestingId === item.id ? (
                          <>
                            <Loader2Icon size={14} className="animate-spin" />
                            Testing...
                          </>
                        ) : (
                          <>
                            <PlayIcon size={14} />
                            Run Test Again
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* All verified message */}
      {verifiedCount === items.length && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-center"
        >
          <CheckCircle2Icon size={24} className="mx-auto mb-2 text-emerald-400" />
          <p className="font-medium text-emerald-400">All Features Verified!</p>
          <p className="text-sm text-slate-400 mt-1">
            Your app is working as intended
          </p>
        </motion.div>
      )}
    </div>
  );
}

export default VerificationChecklist;
