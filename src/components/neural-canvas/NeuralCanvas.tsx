/**
 * Neural Canvas - Main Orchestration UI Container
 *
 * A premium 3D visualization for AI orchestration activities.
 * Displays real-time thoughts, code generation, diffs, parallel agents, and build phases.
 *
 * Features:
 * - Glassmorphism with ambient glow backgrounds
 * - 3D depth through transforms and layered shadows
 * - Smooth Framer Motion animations
 * - Responsive layout with collapsible sections
 * - Real-time event processing
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNeuralCanvasStore } from '../../store/useNeuralCanvasStore';
import { ThoughtStream } from './ThoughtStream';
import { CodeCanvas, SupportedLanguage } from './CodeCanvas';
import { DiffViewer } from './DiffViewer';
import { AgentGrid } from './AgentGrid';
import { PhaseTimeline } from './PhaseTimeline';
import { NeuralIcon } from './icons/NeuralIcons';
import type { AgentActivityEvent } from '../../types/agent-activity';
import '../../styles/neural-canvas.css';

// ============================================================================
// TYPES
// ============================================================================

export interface NeuralCanvasProps {
  /** Events from orchestration */
  events?: AgentActivityEvent[];
  /** External active state */
  isActive?: boolean;
  /** Display mode */
  mode?: 'compact' | 'standard' | 'expanded';
  /** Initial visible sections */
  initialSections?: Array<'thoughts' | 'code' | 'diff' | 'agents' | 'timeline'>;
  /** Callback when section is clicked */
  onSectionClick?: (section: string) => void;
  /** Callback when code is clicked for expansion */
  onCodeExpand?: (code: { filename: string; content: string }) => void;
  /** Callback when diff is clicked for expansion */
  onDiffExpand?: (diff: { filename: string; hunks: unknown[] }) => void;
  /** Custom class name */
  className?: string;
  /** Max height for container */
  maxHeight?: string | number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function NeuralCanvas({
  events = [],
  isActive: externalActive,
  mode: initialMode = 'standard',
  initialSections = ['thoughts', 'code', 'agents', 'timeline'],
  onSectionClick,
  onCodeExpand,
  onDiffExpand,
  className = '',
  maxHeight = '100%',
}: NeuralCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const processedEventsRef = useRef(new Set<string>());

  // Store state
  const {
    mode,
    visibleSections,
    isActive,
    thoughts,
    activeCode,
    activeDiff,
    agents,
    phases,
    currentPhaseId,
    totalProgress,
    setMode,
    setSectionVisible,
    setActive,
    processAgentEvent,
    startSession,
  } = useNeuralCanvasStore();

  // Initialize store on mount
  useEffect(() => {
    setMode(initialMode);
    initialSections.forEach(section => setSectionVisible(section, true));
  }, [initialMode, initialSections, setMode, setSectionVisible]);

  // Sync external active state
  useEffect(() => {
    if (externalActive !== undefined) {
      setActive(externalActive);
      if (externalActive && !isActive) {
        startSession();
      }
    }
  }, [externalActive, isActive, setActive, startSession]);

  // Process incoming events
  useEffect(() => {
    events.forEach(event => {
      if (!processedEventsRef.current.has(event.id)) {
        processedEventsRef.current.add(event.id);
        processAgentEvent(event);
      }
    });
  }, [events, processAgentEvent]);

  // Cleanup processed events periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (processedEventsRef.current.size > 1000) {
        const arr = Array.from(processedEventsRef.current);
        processedEventsRef.current = new Set(arr.slice(-500));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Convert Map to array for AgentGrid
  const agentsList = useMemo(() => Array.from(agents.values()), [agents]);

  // Handlers
  const handleThoughtClick = useCallback((thoughtId: string) => {
    onSectionClick?.('thought-' + thoughtId);
  }, [onSectionClick]);

  const handleCodeCopy = useCallback(() => {
    if (activeCode) {
      const content = activeCode.lines.map(l => l.content).join('\n');
      navigator.clipboard.writeText(content);
    }
  }, [activeCode]);

  const handleCodeExpandClick = useCallback(() => {
    if (activeCode) {
      onCodeExpand?.({
        filename: activeCode.filename,
        content: activeCode.lines.map(l => l.content).join('\n'),
      });
    }
  }, [activeCode, onCodeExpand]);

  const handleDiffExpandClick = useCallback(() => {
    if (activeDiff) {
      onDiffExpand?.({
        filename: activeDiff.filename,
        hunks: activeDiff.hunks,
      });
    }
  }, [activeDiff, onDiffExpand]);

  const handleAgentClick = useCallback((agentId: string) => {
    onSectionClick?.('agent-' + agentId);
  }, [onSectionClick]);

  // Mode-based layout classes
  const layoutClass = useMemo(() => {
    switch (mode) {
      case 'compact':
        return 'neural-canvas--compact';
      case 'expanded':
        return 'neural-canvas--expanded';
      default:
        return 'neural-canvas--standard';
    }
  }, [mode]);

  // Section visibility checks
  const showThoughts = visibleSections.has('thoughts');
  const showCode = visibleSections.has('code') && activeCode;
  const showDiff = visibleSections.has('diff') && activeDiff;
  const showAgents = visibleSections.has('agents') && agentsList.length > 0;
  const showTimeline = visibleSections.has('timeline') && phases.length > 0;

  return (
    <motion.div
      ref={containerRef}
      className={`neural-canvas ${layoutClass} ${className}`}
      style={{ maxHeight }}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Ambient background effects */}
      <div className="neural-canvas-ambient" aria-hidden="true" />

      {/* Main content */}
      <div className="neural-canvas-content">
        {/* Header with status */}
        <motion.div
          className="neural-canvas-header"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="neural-canvas-title">
            <NeuralIcon
              name="brain"
              size={20}
              className={`neural-canvas-title-icon ${isActive ? 'animate-neural-pulse' : ''}`}
            />
            <span>Neural Canvas</span>
            {isActive && (
              <motion.span
                className="neural-canvas-status-badge"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <span className="neural-canvas-status-dot" />
                Processing
              </motion.span>
            )}
          </div>
          <div className="neural-canvas-controls">
            <button
              className="neural-canvas-mode-btn"
              onClick={() => setMode(mode === 'compact' ? 'standard' : mode === 'standard' ? 'expanded' : 'compact')}
              title="Toggle display mode"
            >
              <NeuralIcon name={mode === 'expanded' ? 'collapse' : 'expand'} size={16} />
            </button>
          </div>
        </motion.div>

        {/* Two-column layout for standard/expanded modes */}
        <div className={`neural-canvas-grid ${mode === 'compact' ? 'neural-canvas-grid--single' : ''}`}>
          {/* Left column: Thoughts + Code/Diff */}
          <div className="neural-canvas-primary">
            <AnimatePresence mode="popLayout">
              {/* Thought Stream */}
              {showThoughts && (
                <motion.div
                  key="thoughts"
                  className="neural-canvas-section"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <ThoughtStream
                    thoughts={thoughts}
                    onThoughtClick={handleThoughtClick}
                    maxHeight={mode === 'compact' ? 200 : 300}
                  />
                </motion.div>
              )}

              {/* Code Canvas */}
              {showCode && activeCode && (
                <motion.div
                  key="code"
                  className="neural-canvas-section"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <CodeCanvas
                    filename={activeCode.filename}
                    filepath={activeCode.filepath}
                    language={activeCode.language as SupportedLanguage}
                    lines={activeCode.lines}
                    onCopy={handleCodeCopy}
                    onExpand={handleCodeExpandClick}
                    maxHeight={mode === 'compact' ? 200 : 350}
                  />
                </motion.div>
              )}

              {/* Diff Viewer */}
              {showDiff && activeDiff && (
                <motion.div
                  key="diff"
                  className="neural-canvas-section"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.3, delay: 0.15 }}
                >
                  <DiffViewer
                    filename={activeDiff.filename}
                    operation={activeDiff.operation}
                    hunks={activeDiff.hunks}
                    additions={activeDiff.additions}
                    deletions={activeDiff.deletions}
                    onExpand={handleDiffExpandClick}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right column: Agents + Timeline (hidden in compact mode) */}
          {mode !== 'compact' && (
            <div className="neural-canvas-secondary">
              <AnimatePresence mode="popLayout">
                {/* Agent Grid */}
                {showAgents && (
                  <motion.div
                    key="agents"
                    className="neural-canvas-section"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <AgentGrid
                      agents={agentsList}
                      onAgentClick={handleAgentClick}
                    />
                  </motion.div>
                )}

                {/* Phase Timeline */}
                {showTimeline && (
                  <motion.div
                    key="timeline"
                    className="neural-canvas-section"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  >
                    <PhaseTimeline
                      phases={phases}
                      currentPhaseId={currentPhaseId || undefined}
                      totalProgress={totalProgress}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Empty state */}
        {!isActive && thoughts.length === 0 && (
          <motion.div
            className="neural-canvas-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <NeuralIcon name="circuit" size={48} className="neural-canvas-empty-icon" />
            <p className="neural-canvas-empty-text">
              Neural Canvas ready. Waiting for orchestration events...
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// ADDITIONAL STYLES (inline for layout specifics)
// ============================================================================

const additionalStyles = `
.neural-canvas-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.neural-canvas-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-heading);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-neutral-100);
}

.neural-canvas-title-icon {
  color: var(--neural-synapse);
}

.neural-canvas-status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-2);
  margin-left: var(--space-2);
  background: rgba(168, 85, 247, 0.15);
  border: 1px solid rgba(168, 85, 247, 0.3);
  border-radius: var(--radius-full);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--neural-synapse);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.neural-canvas-status-dot {
  width: 6px;
  height: 6px;
  background: var(--neural-synapse);
  border-radius: 50%;
  animation: status-pulse 1.5s ease-in-out infinite;
}

.neural-canvas-controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.neural-canvas-mode-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  color: var(--color-neutral-400);
  cursor: pointer;
  transition: all var(--neural-timing-fast) ease;
}

.neural-canvas-mode-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--color-neutral-100);
}

.neural-canvas-grid {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: var(--space-4);
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.neural-canvas-grid--single {
  grid-template-columns: 1fr;
}

.neural-canvas-primary,
.neural-canvas-secondary {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-height: 0;
  overflow-y: auto;
}

.neural-canvas-section {
  flex-shrink: 0;
}

.neural-canvas-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-12);
  text-align: center;
}

.neural-canvas-empty-icon {
  color: var(--color-neutral-600);
  opacity: 0.5;
}

.neural-canvas-empty-text {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--color-neutral-500);
  max-width: 300px;
}

/* Compact mode adjustments */
.neural-canvas--compact .neural-canvas-content {
  padding: var(--space-3);
  gap: var(--space-3);
}

.neural-canvas--compact .neural-canvas-header {
  padding: var(--space-2) var(--space-3);
}

/* Expanded mode adjustments */
.neural-canvas--expanded .neural-canvas-grid {
  grid-template-columns: 1fr 400px;
}

@media (max-width: 1024px) {
  .neural-canvas-grid {
    grid-template-columns: 1fr;
  }

  .neural-canvas-secondary {
    display: none;
  }

  .neural-canvas--expanded .neural-canvas-secondary {
    display: flex;
  }
}
`;

// Inject additional styles
if (typeof document !== 'undefined') {
  const styleId = 'neural-canvas-layout-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = additionalStyles;
    document.head.appendChild(styleEl);
  }
}

export default NeuralCanvas;
