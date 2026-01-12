/**
 * ThoughtStream Component
 *
 * Displays AI thinking/reasoning in real-time, like a stream of consciousness.
 * Uses Framer Motion for smooth animations and auto-scrolls to latest thought.
 * Each thought has an icon, label, content, and timestamp with different visual
 * treatments based on thought type.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NeuralIcon, NeuralIconName } from './icons/NeuralIcons';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Supported thought types with different visual treatments
 */
export type ThoughtType =
  | 'reasoning'   // Purple - neural connections
  | 'analyzing'   // Cyan - data flow
  | 'generating'  // Green - successful output
  | 'error'       // Rose - errors
  | 'complete';   // Success - completed

/**
 * Individual thought item structure
 */
export interface ThoughtItem {
  /** Unique identifier for the thought */
  id: string;
  /** Type determines visual treatment and icon */
  type: ThoughtType;
  /** Main content of the thought */
  content: string;
  /** Unix timestamp in milliseconds when the thought occurred */
  timestamp: number;
  /** Whether this thought is currently active (shows typing cursor) */
  isActive?: boolean;
  /** Optional expanded content for more detail */
  expandedContent?: string;
}

/**
 * Props for ThoughtStream component
 */
export interface ThoughtStreamProps {
  /** Array of thought items to display */
  thoughts: ThoughtItem[];
  /** Whether the stream is in expanded view mode */
  isExpanded?: boolean;
  /** Maximum height of the stream container */
  maxHeight?: number | string;
  /** Callback when a thought is clicked */
  onThoughtClick?: (thoughtId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Maps thought type to the appropriate NeuralIcon name
 */
function getIconForType(type: ThoughtType): NeuralIconName {
  switch (type) {
    case 'reasoning':
      return 'brain';
    case 'analyzing':
      return 'analyze';
    case 'generating':
      return 'code';
    case 'error':
      return 'error';
    case 'complete':
      return 'check';
    default:
      return 'brain';
  }
}

/**
 * Formats a timestamp for display
 * Shows relative time for recent thoughts, absolute time for older ones
 * @param timestamp - Unix timestamp in milliseconds
 */
function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) {
    return seconds <= 1 ? 'just now' : `${seconds}s ago`;
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

/**
 * Gets the appropriate label for a thought type
 */
function getTypeLabel(type: ThoughtType): string {
  switch (type) {
    case 'reasoning':
      return 'Reasoning';
    case 'analyzing':
      return 'Analyzing';
    case 'generating':
      return 'Generating';
    case 'error':
      return 'Error';
    case 'complete':
      return 'Complete';
    default:
      return type;
  }
}

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

/**
 * Custom cubic bezier easing that matches the neural-ease-out timing function
 */
const neuralEaseOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Animation variants for individual thought items
 */
const thoughtVariants = {
  initial: {
    opacity: 0,
    x: -20,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: neuralEaseOut,
    },
  },
  exit: {
    opacity: 0,
    x: -10,
    scale: 0.95,
    transition: {
      duration: 0.2,
      ease: 'easeOut' as const,
    },
  },
  hover: {
    y: -1,
    transition: {
      duration: 0.2,
      ease: 'easeOut' as const,
    },
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export const ThoughtStream: React.FC<ThoughtStreamProps> = ({
  thoughts,
  isExpanded = false,
  maxHeight = 300,
  onThoughtClick,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [expandedThoughtId, setExpandedThoughtId] = React.useState<string | null>(null);

  /**
   * Scroll to the bottom of the container when new thoughts are added
   */
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      // Smooth scroll to bottom
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [thoughts.length]);

  /**
   * Handle thought click - toggle expansion and notify parent
   */
  const handleThoughtClick = useCallback((thoughtId: string) => {
    setExpandedThoughtId(prev => prev === thoughtId ? null : thoughtId);
    onThoughtClick?.(thoughtId);
  }, [onThoughtClick]);

  // Calculate dynamic max height
  const resolvedMaxHeight = typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight;

  return (
    <div
      ref={containerRef}
      className={`thought-stream ${className}`}
      style={{
        maxHeight: isExpanded ? 'none' : resolvedMaxHeight,
      }}
      role="log"
      aria-label="AI thought stream"
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {thoughts.map((thought, index) => {
          const isThoughtExpanded = expandedThoughtId === thought.id;
          const hasExpandedContent = !!thought.expandedContent;

          return (
            <motion.div
              key={thought.id}
              layout
              variants={thoughtVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              whileHover={onThoughtClick ? "hover" : undefined}
              className={`
                thought-item
                thought-item--${thought.type}
                ${thought.isActive ? 'thought-item--active' : ''}
                ${onThoughtClick ? 'neural-clickable' : ''}
              `}
              onClick={() => handleThoughtClick(thought.id)}
              style={{
                cursor: onThoughtClick || hasExpandedContent ? 'pointer' : 'default',
                animationDelay: `${index * 0.05}s`,
              }}
              role="article"
              aria-label={`${getTypeLabel(thought.type)} thought: ${thought.content}`}
            >
              {/* Thought Icon */}
              <div className="thought-icon">
                <NeuralIcon
                  name={getIconForType(thought.type)}
                  size={14}
                  className={`thought-icon-svg thought-icon-svg--${thought.type}`}
                />
              </div>

              {/* Thought Content */}
              <div className="thought-content">
                <span className="thought-label">
                  {getTypeLabel(thought.type)}
                </span>

                <p className="thought-text">
                  {thought.content}
                  {/* Typing cursor animation for active thoughts */}
                </p>

                {/* Expanded content (when clicked) */}
                <AnimatePresence>
                  {isThoughtExpanded && thought.expandedContent && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="thought-expanded"
                      style={{
                        marginTop: '8px',
                        paddingTop: '8px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                        fontSize: '12px',
                        color: 'var(--color-neutral-400)',
                        lineHeight: 1.6,
                      }}
                    >
                      {thought.expandedContent}
                    </motion.div>
                  )}
                </AnimatePresence>

                <span className="thought-timestamp">
                  {formatTime(thought.timestamp)}
                  {hasExpandedContent && (
                    <span style={{ marginLeft: '8px', opacity: 0.6 }}>
                      {isThoughtExpanded ? '(click to collapse)' : '(click for details)'}
                    </span>
                  )}
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Empty state */}
      {thoughts.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="thought-empty"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            color: 'var(--color-neutral-500)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
          }}
        >
          Awaiting neural activity...
        </motion.div>
      )}
    </div>
  );
};

// ============================================================================
// ADDITIONAL STYLES (for icon colors based on type)
// ============================================================================

// These styles are injected to provide type-specific icon coloring
// The base styles are in neural-canvas.css
const additionalStyles = `
  .thought-icon-svg--reasoning {
    color: var(--neural-synapse, #a855f7);
  }

  .thought-icon-svg--analyzing {
    color: var(--neural-flow, #06b6d4);
  }

  .thought-icon-svg--generating {
    color: var(--neural-output, #10b981);
  }

  .thought-icon-svg--error {
    color: var(--neural-error, #f43f5e);
  }

  .thought-icon-svg--complete {
    color: var(--color-success, #10b981);
  }

  .thought-expanded {
    white-space: pre-wrap;
    word-break: break-word;
  }
`;

// Inject styles on module load
if (typeof document !== 'undefined') {
  const styleId = 'thought-stream-additional-styles';
  if (!document.getElementById(styleId)) {
    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = additionalStyles;
    document.head.appendChild(styleElement);
  }
}

export default ThoughtStream;
