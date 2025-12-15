/**
 * Floating Soft Interrupt Panel
 *
 * Allows users to communicate with agents mid-execution without
 * hard-stopping them. Shows as a floating button that expands to
 * reveal interrupt type buttons and message input.
 *
 * Features:
 * - 9 Interrupt Types with Visual Feedback
 * - Glass Morphism UI matching Verification Swarm
 * - Real-time Feedback Toast
 * - Collapsible Interrupt History
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './FloatingSoftInterrupt.css';

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

interface FloatingSoftInterruptProps {
  sessionId: string;
  agentId?: string;
  isAgentRunning: boolean;
  onInterruptSubmitted?: (interrupt: ClassifiedInterrupt) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const INTERRUPT_TYPE_EXPLANATIONS: Record<InterruptType, string> = {
  HALT: 'Stop the agent immediately. Use for critical issues.',
  CONTEXT_ADD: 'Add new information without interrupting current work.',
  COURSE_CORRECT: 'Redirect the agent\'s approach without restarting.',
  BACKTRACK: 'Undo recent changes and return to a previous state.',
  QUEUE: 'Schedule this for later - after current task completes.',
  CLARIFICATION: 'Pause the agent to answer your question.',
  URGENT_FIX: 'Something is broken - prioritize this fix immediately.',
  APPRECIATION: 'Great job! Continue with current approach.',
  IGNORE: 'This message is not relevant to the current task.',
};

const INTERRUPT_TYPE_CONFIG: Record<InterruptType, { label: string; colorClass: string; priority: InterruptPriority }> = {
  HALT: { label: 'Halt', colorClass: 'HALT', priority: 'critical' },
  URGENT_FIX: { label: 'Urgent', colorClass: 'URGENT_FIX', priority: 'critical' },
  BACKTRACK: { label: 'Undo', colorClass: 'BACKTRACK', priority: 'high' },
  COURSE_CORRECT: { label: 'Redirect', colorClass: 'COURSE_CORRECT', priority: 'high' },
  CONTEXT_ADD: { label: 'Add Info', colorClass: 'CONTEXT_ADD', priority: 'normal' },
  CLARIFICATION: { label: 'Clarify', colorClass: 'CLARIFICATION', priority: 'normal' },
  QUEUE: { label: 'Later', colorClass: 'QUEUE', priority: 'deferred' },
  APPRECIATION: { label: 'Approve', colorClass: 'APPRECIATION', priority: 'low' },
  IGNORE: { label: 'Ignore', colorClass: 'IGNORE', priority: 'low' },
};

// Grid order: top-left to bottom-right
const INTERRUPT_TYPE_ORDER: InterruptType[] = [
  'HALT', 'URGENT_FIX', 'BACKTRACK',
  'COURSE_CORRECT', 'CONTEXT_ADD', 'CLARIFICATION',
  'QUEUE', 'APPRECIATION', 'IGNORE',
];

// Custom SVG icon for the minimized button
const InterruptLogoMini = () => (
  <svg viewBox="0 0 28 28" fill="none" className="floating-interrupt__logo-icon">
    <rect x="4" y="4" width="20" height="20" rx="4" stroke="#1a1a1a" strokeWidth="1.5" fill="rgba(255, 255, 255, 0.5)" />
    <path d="M14 8v8" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
    <circle cx="14" cy="19" r="1.5" fill="#c25a00" />
  </svg>
);

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

// Custom icon components (no lucide-react)
const IconPause = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);

const IconInfo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const IconGitBranch = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

const IconUndo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
  </svg>
);

const IconClock = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12,6 12,12 16,14" />
  </svg>
);

const IconQuestion = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconZap = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" />
  </svg>
);

const IconThumbsUp = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
  </svg>
);

const IconX = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconSend = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22,2 15,22 11,13 2,9 22,2" />
  </svg>
);

const IconCheck = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20,6 9,17 4,12" />
  </svg>
);

const IconChevronDown = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="6,9 12,15 18,9" />
  </svg>
);

const IconChevronUp = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="18,15 12,9 6,15" />
  </svg>
);

const IconAlert = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const InterruptTypeIcon = ({ type, className }: { type: InterruptType; className?: string }) => {
  const iconClass = className || 'w-4 h-4';

  switch (type) {
    case 'HALT':
      return <IconPause className={iconClass} />;
    case 'CONTEXT_ADD':
      return <IconInfo className={iconClass} />;
    case 'COURSE_CORRECT':
      return <IconGitBranch className={iconClass} />;
    case 'BACKTRACK':
      return <IconUndo className={iconClass} />;
    case 'QUEUE':
      return <IconClock className={iconClass} />;
    case 'CLARIFICATION':
      return <IconQuestion className={iconClass} />;
    case 'URGENT_FIX':
      return <IconZap className={iconClass} />;
    case 'APPRECIATION':
      return <IconThumbsUp className={iconClass} />;
    case 'IGNORE':
      return <IconX className={iconClass} />;
    default:
      return <IconInfo className={iconClass} />;
  }
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function FloatingSoftInterrupt({
  sessionId,
  agentId,
  isAgentRunning,
  onInterruptSubmitted,
}: FloatingSoftInterruptProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [selectedType, setSelectedType] = useState<InterruptType | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<InterruptApplicationResult | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [interruptHistory, setInterruptHistory] = useState<ClassifiedInterrupt[]>([]);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [hoveredType, setHoveredType] = useState<InterruptType | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch interrupt history on mount
  useEffect(() => {
    if (sessionId) {
      fetchInterruptHistory();
    }
  }, [sessionId]);

  const fetchInterruptHistory = async () => {
    try {
      const response = await fetch(`/api/soft-interrupt/history/${sessionId}`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setInterruptHistory(data.interrupts || []);
      }
    } catch (error) {
      console.error('Failed to fetch interrupt history:', error);
    }
  };

  const getAgentResponseForType = (type: InterruptType): string => {
    const responses: Record<InterruptType, string> = {
      HALT: 'Agent paused. Ready to resume on your command.',
      CONTEXT_ADD: 'Context noted. Incorporating into current work.',
      COURSE_CORRECT: 'Course corrected. Adjusting approach without restarting.',
      BACKTRACK: 'Backtrack requested. Preparing to revert to previous state.',
      QUEUE: 'Noted for later. Will address after current task completes.',
      CLARIFICATION: 'Processing your question. Agent paused pending response.',
      URGENT_FIX: 'Urgent fix acknowledged. Prioritizing immediately.',
      APPRECIATION: 'Thanks! Continuing with current approach.',
      IGNORE: 'Message noted but not relevant to current task.',
    };
    return responses[type];
  };

  const handleSubmit = useCallback(async () => {
    if (!message.trim() || !selectedType || isSubmitting) return;

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
          agentId,
          type: selectedType,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const interrupt = data.interrupt as ClassifiedInterrupt;
        setInterruptHistory((prev) => [interrupt, ...prev]);
        setLastResult({
          success: true,
          interruptId: interrupt.id,
          action: interrupt.type === 'HALT' ? 'applied' : interrupt.type === 'QUEUE' ? 'queued' : 'applied',
          agentResponse: getAgentResponseForType(interrupt.type),
        });
        setShowFeedback(true);
        setMessage('');
        setSelectedType(null);
        onInterruptSubmitted?.(interrupt);

        // Auto-hide feedback after 3 seconds
        setTimeout(() => setShowFeedback(false), 3000);
      } else {
        setLastResult({
          success: false,
          interruptId: '',
          action: 'rejected',
          agentResponse: data.error || 'Failed to process interrupt',
        });
        setShowFeedback(true);
      }
    } catch (error) {
      console.error('Failed to submit interrupt:', error);
      setLastResult({
        success: false,
        interruptId: '',
        action: 'rejected',
        agentResponse: 'Network error. Please try again.',
      });
      setShowFeedback(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [message, selectedType, isSubmitting, sessionId, agentId, onInterruptSubmitted]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTypeSelect = (type: InterruptType) => {
    setSelectedType(type);
    // Focus textarea after selecting type
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  const pendingCount = interruptHistory.filter((i) => i.status === 'pending').length;

  // Minimized state - just show the button
  if (isMinimized) {
    return (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`floating-interrupt__minimized ${isAgentRunning ? 'floating-interrupt__minimized--active' : ''}`}
        onClick={() => setIsMinimized(false)}
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95, y: 1 }}
      >
        <InterruptLogoMini />
        {isAgentRunning && (
          <motion.div
            className="floating-interrupt__minimized-pulse"
            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ y: 100, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 100, opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`floating-interrupt ${isExpanded ? 'floating-interrupt--expanded' : ''} ${isAgentRunning ? 'floating-interrupt--running' : ''}`}
    >
      {/* Header */}
      <div className="floating-interrupt__header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="floating-interrupt__header-left">
          <div className="floating-interrupt__logo">
            <InterruptLogoMini />
            <div className="floating-interrupt__logo-pulse" />
          </div>

          <div className="floating-interrupt__title-area">
            <h4 className="floating-interrupt__title">Soft Interrupt</h4>
            <p className="floating-interrupt__subtitle">
              {isAgentRunning ? (
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  Agent active...
                </motion.span>
              ) : (
                'Send feedback to agent'
              )}
            </p>
          </div>
        </div>

        <div className="floating-interrupt__header-right">
          {pendingCount > 0 && (
            <span className="floating-interrupt__pending-badge">{pendingCount}</span>
          )}

          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(true);
            }}
            className="floating-interrupt__close"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </motion.button>

          <motion.div
            className="floating-interrupt__chevron"
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.25 }}
          >
            <svg viewBox="0 0 14 14" fill="none" className="w-4 h-4">
              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </motion.div>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="floating-interrupt__expanded"
          >
            {/* Interrupt Type Grid */}
            <div className="interrupt-type-grid">
              {INTERRUPT_TYPE_ORDER.map((type) => {
                const config = INTERRUPT_TYPE_CONFIG[type];
                const isSelected = selectedType === type;
                const isHovered = hoveredType === type;

                return (
                  <button
                    key={type}
                    className={`interrupt-type-btn interrupt-type-btn--${config.colorClass} ${isSelected ? 'interrupt-type-btn--selected' : ''}`}
                    onClick={() => handleTypeSelect(type)}
                    onMouseEnter={() => setHoveredType(type)}
                    onMouseLeave={() => setHoveredType(null)}
                  >
                    <InterruptTypeIcon type={type} className="w-4 h-4" />
                    <span className="interrupt-type-btn__label">{config.label}</span>

                    {/* Tooltip */}
                    <AnimatePresence>
                      {isHovered && !isSelected && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          className="interrupt-type-tooltip"
                        >
                          {INTERRUPT_TYPE_EXPLANATIONS[type]}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                );
              })}
            </div>

            {/* Message Input */}
            <div className="floating-interrupt__input-area">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={selectedType ? `Describe your ${INTERRUPT_TYPE_CONFIG[selectedType].label.toLowerCase()} request...` : 'Select an interrupt type first...'}
                className="floating-interrupt__textarea"
                rows={2}
                disabled={isSubmitting || !selectedType}
              />
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || !selectedType || isSubmitting}
                className="floating-interrupt__submit-btn"
              >
                {isSubmitting ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <IconZap className="w-4 h-4" />
                  </motion.div>
                ) : (
                  <IconSend className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Feedback Toast */}
            <AnimatePresence>
              {showFeedback && lastResult && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`floating-interrupt__feedback ${lastResult.success ? 'floating-interrupt__feedback--success' : 'floating-interrupt__feedback--error'}`}
                >
                  <div className="floating-interrupt__feedback-icon">
                    {lastResult.success ? <IconCheck className="w-4 h-4" /> : <IconAlert className="w-4 h-4" />}
                  </div>
                  <p className="floating-interrupt__feedback-text">{lastResult.agentResponse}</p>
                  <button
                    onClick={() => setShowFeedback(false)}
                    className="floating-interrupt__feedback-close"
                  >
                    <IconX className="w-3 h-3" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Interrupt History */}
            {interruptHistory.length > 0 && (
              <div className="floating-interrupt__history">
                <button
                  onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                  className="floating-interrupt__history-toggle"
                >
                  {isHistoryExpanded ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
                  <span>
                    Recent ({interruptHistory.length})
                    {pendingCount > 0 && (
                      <span className="floating-interrupt__history-pending">{pendingCount} pending</span>
                    )}
                  </span>
                </button>

                <AnimatePresence>
                  {isHistoryExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="floating-interrupt__history-list"
                    >
                      {interruptHistory.slice(0, 10).map((interrupt, index) => (
                        <motion.div
                          key={interrupt.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="floating-interrupt__history-item"
                        >
                          <div className="floating-interrupt__history-item-header">
                            <span className={`floating-interrupt__history-type floating-interrupt__history-type--${interrupt.type}`}>
                              <InterruptTypeIcon type={interrupt.type} className="w-3 h-3" />
                              {interrupt.type.replace('_', ' ')}
                            </span>
                            <span className={`floating-interrupt__history-status floating-interrupt__history-status--${interrupt.status}`}>
                              {interrupt.status}
                            </span>
                          </div>
                          <p className="floating-interrupt__history-message">{interrupt.message}</p>
                          <p className="floating-interrupt__history-time">
                            {new Date(interrupt.timestamp).toLocaleTimeString()}
                          </p>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default FloatingSoftInterrupt;
