/**
 * Soft Interrupt Input Component
 *
 * Allows users to communicate with agents mid-execution without
 * hard-stopping them. Shows classification feedback and queue status.
 *
 * F046: Soft Interrupt System Frontend
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquarePlus,
  Send,
  AlertCircle,
  Info,
  CheckCircle,
  Clock,
  Pause,
  Undo2,
  GitBranch,
  MessageCircleQuestion,
  Zap,
  ThumbsUp,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

type InterruptType =
  | 'HALT'
  | 'CONTEXT_ADD'
  | 'COURSE_CORRECT'
  | 'BACKTRACK'
  | 'QUEUE'
  | 'CLARIFICATION'
  | 'URGENT_FIX'
  | 'APPRECIATION'
  | 'IGNORE';

type InterruptPriority = 'critical' | 'high' | 'normal' | 'low' | 'deferred';

interface ClassifiedInterrupt {
  id: string;
  sessionId: string;
  agentId?: string;
  message: string;
  timestamp: Date;
  type: InterruptType;
  priority: InterruptPriority;
  confidence: number;
  extractedContext: string | null;
  status: 'pending' | 'processing' | 'applied' | 'rejected' | 'expired';
  appliedAt?: Date;
}

interface InterruptApplicationResult {
  success: boolean;
  interruptId: string;
  action: 'applied' | 'queued' | 'rejected' | 'requires_response';
  agentResponse?: string;
  contextInjected?: string;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

const InterruptTypeIcon: React.FC<{ type: InterruptType; className?: string }> = ({
  type,
  className
}) => {
  const iconProps = { className: cn('w-4 h-4', className) };

  switch (type) {
    case 'HALT':
      return <Pause {...iconProps} />;
    case 'CONTEXT_ADD':
      return <Info {...iconProps} />;
    case 'COURSE_CORRECT':
      return <GitBranch {...iconProps} />;
    case 'BACKTRACK':
      return <Undo2 {...iconProps} />;
    case 'QUEUE':
      return <Clock {...iconProps} />;
    case 'CLARIFICATION':
      return <MessageCircleQuestion {...iconProps} />;
    case 'URGENT_FIX':
      return <Zap {...iconProps} />;
    case 'APPRECIATION':
      return <ThumbsUp {...iconProps} />;
    default:
      return <MessageSquarePlus {...iconProps} />;
  }
};

const InterruptTypeBadge: React.FC<{ type: InterruptType; priority: InterruptPriority }> = ({
  type,
  priority
}) => {
  const typeColors: Record<InterruptType, string> = {
    HALT: 'bg-red-500/20 text-red-400 border-red-500/30',
    CONTEXT_ADD: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    COURSE_CORRECT: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    BACKTRACK: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    QUEUE: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    CLARIFICATION: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    URGENT_FIX: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    APPRECIATION: 'bg-green-500/20 text-green-400 border-green-500/30',
    IGNORE: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  };

  const priorityIndicator: Record<InterruptPriority, string> = {
    critical: '🔴',
    high: '🟠',
    normal: '🟡',
    low: '🟢',
    deferred: '⚪'
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
      typeColors[type]
    )}>
      <InterruptTypeIcon type={type} className="w-3 h-3" />
      {type.replace('_', ' ')}
      <span className="text-[10px]">{priorityIndicator[priority]}</span>
    </span>
  );
};

const StatusIndicator: React.FC<{ status: ClassifiedInterrupt['status'] }> = ({ status }) => {
  const statusConfig = {
    pending: { color: 'text-yellow-400', icon: Clock, label: 'Pending' },
    processing: { color: 'text-blue-400', icon: Zap, label: 'Processing' },
    applied: { color: 'text-green-400', icon: CheckCircle, label: 'Applied' },
    rejected: { color: 'text-red-400', icon: X, label: 'Rejected' },
    expired: { color: 'text-gray-400', icon: Clock, label: 'Expired' }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', config.color)}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface SoftInterruptInputProps {
  sessionId: string;
  agentId?: string;
  onInterruptSubmitted?: (interrupt: ClassifiedInterrupt) => void;
  className?: string;
}

export const SoftInterruptInput: React.FC<SoftInterruptInputProps> = ({
  sessionId,
  agentId,
  onInterruptSubmitted,
  className
}) => {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<InterruptApplicationResult | null>(null);
  const [interruptHistory, setInterruptHistory] = useState<ClassifiedInterrupt[]>([]);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch interrupt history on mount
  useEffect(() => {
    if (sessionId) {
      fetchInterruptHistory();
    }
  }, [sessionId]);

  const fetchInterruptHistory = async () => {
    try {
      const response = await fetch(`/api/soft-interrupt/history/${sessionId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setInterruptHistory(data.interrupts);
      }
    } catch (error) {
      console.error('Failed to fetch interrupt history:', error);
    }
  };

  const handleSubmit = async () => {
    if (!message.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setShowFeedback(false);

    try {
      const response = await fetch('/api/soft-interrupt/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sessionId,
          message: message.trim(),
          agentId
        })
      });

      const data = await response.json();

      if (data.success) {
        const interrupt = data.interrupt as ClassifiedInterrupt;
        setInterruptHistory(prev => [interrupt, ...prev]);
        setLastResult({
          success: true,
          interruptId: interrupt.id,
          action: interrupt.type === 'HALT' ? 'applied' :
                  interrupt.type === 'QUEUE' ? 'queued' : 'applied',
          agentResponse: getAgentResponseForType(interrupt.type)
        });
        setShowFeedback(true);
        setMessage('');
        onInterruptSubmitted?.(interrupt);

        // Auto-hide feedback after 3 seconds
        setTimeout(() => setShowFeedback(false), 3000);
      }
    } catch (error) {
      console.error('Failed to submit interrupt:', error);
      setLastResult({
        success: false,
        interruptId: '',
        action: 'rejected'
      });
      setShowFeedback(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAgentResponseForType = (type: InterruptType): string => {
    const responses: Record<InterruptType, string> = {
      HALT: '⏸️ Agent paused. Ready to resume on your command.',
      CONTEXT_ADD: '📝 Context noted. Incorporating into current work.',
      COURSE_CORRECT: '🔄 Course corrected. Adjusting approach without restarting.',
      BACKTRACK: '⏪ Backtrack requested. Preparing to revert to previous state.',
      QUEUE: '📋 Noted for later. Will address after current task completes.',
      CLARIFICATION: '🤔 Processing your question. Agent paused pending response.',
      URGENT_FIX: '⚡ Urgent fix acknowledged. Prioritizing immediately.',
      APPRECIATION: '😊 Thanks! Continuing with current approach.',
      IGNORE: 'Message noted but not relevant to current task.'
    };
    return responses[type];
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const pendingCount = interruptHistory.filter(i => i.status === 'pending').length;

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Input Area */}
      <div className="relative">
        <div className="flex items-start gap-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700/50 focus-within:border-cyan-500/50 transition-colors">
          <MessageSquarePlus className="w-5 h-5 text-cyan-400 mt-1.5 flex-shrink-0" />
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Talk to the agent without stopping it... (Enter to send)"
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 resize-none outline-none min-h-[40px] max-h-[120px]"
            rows={1}
            disabled={isSubmitting}
          />
          <button
            onClick={handleSubmit}
            disabled={!message.trim() || isSubmitting}
            className={cn(
              'p-2 rounded-lg transition-all',
              message.trim() && !isSubmitting
                ? 'bg-cyan-500 text-white hover:bg-cyan-400'
                : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
            )}
          >
            {isSubmitting ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Zap className="w-4 h-4" />
              </motion.div>
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-slate-500">Quick:</span>
          <button
            onClick={() => setMessage('Stop!')}
            className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded border border-red-500/30 hover:bg-red-500/30 transition-colors"
          >
            ⏸️ Halt
          </button>
          <button
            onClick={() => setMessage('Go back to the previous version')}
            className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded border border-purple-500/30 hover:bg-purple-500/30 transition-colors"
          >
            ⏪ Undo
          </button>
          <button
            onClick={() => setMessage('Looking good! Keep going.')}
            className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded border border-green-500/30 hover:bg-green-500/30 transition-colors"
          >
            👍 Approve
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      <AnimatePresence>
        {showFeedback && lastResult && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="mt-3"
          >
            <div className={cn(
              'p-3 rounded-lg border',
              lastResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-red-500/10 border-red-500/30'
            )}>
              <div className="flex items-start gap-2">
                {lastResult.success ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm',
                    lastResult.success ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {lastResult.agentResponse || (lastResult.success ? 'Interrupt processed' : 'Failed to process')}
                  </p>
                  {lastResult.contextInjected && (
                    <p className="text-xs text-slate-400 mt-1">
                      Context added: {lastResult.contextInjected}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowFeedback(false)}
                  className="text-slate-500 hover:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interrupt History */}
      {interruptHistory.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-300 transition-colors"
          >
            {isHistoryExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>
              Interrupt History ({interruptHistory.length})
              {pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-[10px]">
                  {pendingCount} pending
                </span>
              )}
            </span>
          </button>

          <AnimatePresence>
            {isHistoryExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto pr-2">
                  {interruptHistory.slice(0, 10).map((interrupt, index) => (
                    <motion.div
                      key={interrupt.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-2 bg-slate-800/30 rounded-lg border border-slate-700/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <InterruptTypeBadge type={interrupt.type} priority={interrupt.priority} />
                            <StatusIndicator status={interrupt.status} />
                          </div>
                          <p className="text-xs text-slate-300 truncate">{interrupt.message}</p>
                          <p className="text-[10px] text-slate-500 mt-1">
                            {new Date(interrupt.timestamp).toLocaleTimeString()}
                            {interrupt.confidence && (
                              <span className="ml-2">
                                Confidence: {Math.round(interrupt.confidence * 100)}%
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default SoftInterruptInput;

