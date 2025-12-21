/**
 * Agent Activity Stream - Real-time orchestration activity display
 *
 * Displays streaming events from the build loop including:
 * - Thinking/reasoning tokens (Anthropic & OpenAI)
 * - File operations (read/write/edit)
 * - Tool calls with parameters
 * - Status updates with phase indicators
 * - Verification results
 * - Error notifications
 *
 * Features:
 * - Model-agnostic event parsing
 * - Collapsible thinking section with Framer Motion
 * - Smooth entry animations
 * - Monospace typography (Fira Code)
 * - KripTik dark theme with glassmorphism
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BrainIcon,
  CodeIcon,
  EditIcon,
  EyeIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ActivityIcon,
  ChevronDownIcon,
  FileIcon,
  WandIcon,
} from '../ui/icons';
import type {
  AgentActivityEvent,
  AgentActivityEventType,
  AgentActivityPhase,
} from '../../types/agent-activity';
import { parseStreamChunkToEvent, extractPhaseFromEvent } from '../../types/agent-activity';
import './AgentActivityStream.css';

interface AgentActivityStreamProps {
  /** WebSocket URL or SSE endpoint for streaming events */
  streamUrl?: string;
  /** Alternatively, receive events directly */
  events?: AgentActivityEvent[];
  /** Maximum events to display (older events are pruned) */
  maxEvents?: number;
  /** Whether the stream is currently active */
  isActive?: boolean;
  /** Callback when an event is received */
  onEvent?: (event: AgentActivityEvent) => void;
}

type EventIconMap = Record<AgentActivityEventType, React.ReactNode>;

const EVENT_ICONS: EventIconMap = {
  thinking: <BrainIcon size={14} />,
  file_read: <EyeIcon size={14} />,
  file_write: <FileIcon size={14} />,
  file_edit: <EditIcon size={14} />,
  tool_call: <WandIcon size={14} />,
  status: <ActivityIcon size={14} />,
  verification: <CheckCircleIcon size={14} />,
  error: <AlertCircleIcon size={14} />,
};

const PHASE_LABELS: Record<AgentActivityPhase, string> = {
  thinking: 'Thinking',
  planning: 'Planning',
  coding: 'Coding',
  testing: 'Testing',
  verifying: 'Verifying',
  integrating: 'Integrating',
  deploying: 'Deploying',
};

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function truncatePath(path: string, maxLength = 40): string {
  if (path.length <= maxLength) return path;
  const parts = path.split('/');
  if (parts.length <= 2) return '...' + path.slice(-maxLength + 3);
  return '.../' + parts.slice(-2).join('/');
}

function ThinkingAccordion({
  events,
  isExpanded,
  onToggle,
}: {
  events: AgentActivityEvent[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isExpanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length, isExpanded]);

  if (events.length === 0) return null;

  const latestThought = events[events.length - 1];
  const totalTokens = events.reduce(
    (sum, e) => sum + (e.metadata?.tokenCount || e.content.split(/\s+/).length),
    0
  );

  return (
    <div className="aas-thinking">
      <button
        className="aas-thinking__header"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <div className="aas-thinking__icon">
          <BrainIcon size={14} />
          <span className="aas-thinking__pulse" />
        </div>
        <span className="aas-thinking__label">Thinking</span>
        <span className="aas-thinking__count">{totalTokens} tokens</span>
        <motion.span
          className="aas-thinking__chevron"
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDownIcon size={12} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            className="aas-thinking__content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="aas-thinking__scroll" ref={scrollRef}>
              {events.map((event) => (
                <div key={event.id} className="aas-thinking__item">
                  <span className="aas-thinking__time">
                    {formatTimestamp(event.timestamp)}
                  </span>
                  <span className="aas-thinking__text">{event.content}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isExpanded && latestThought && (
        <div className="aas-thinking__preview">
          {latestThought.content.slice(0, 80)}
          {latestThought.content.length > 80 ? '...' : ''}
        </div>
      )}
    </div>
  );
}

function ActivityEventItem({ event }: { event: AgentActivityEvent }) {
  const icon = EVENT_ICONS[event.type];
  const isError = event.type === 'error';
  const isVerification = event.type === 'verification';
  const isFileOp = ['file_read', 'file_write', 'file_edit'].includes(event.type);

  return (
    <motion.div
      className={`aas-event aas-event--${event.type} ${isError ? 'aas-event--error' : ''}`}
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
    >
      <div className="aas-event__icon">{icon}</div>

      <div className="aas-event__content">
        <div className="aas-event__header">
          <span className="aas-event__type">{event.type.replace('_', ' ')}</span>
          {event.agentName && (
            <span className="aas-event__agent">{event.agentName}</span>
          )}
          <span className="aas-event__time">{formatTimestamp(event.timestamp)}</span>
        </div>

        <div className="aas-event__body">
          {isFileOp && event.metadata?.filePath ? (
            <>
              <span className="aas-event__path">
                {truncatePath(event.metadata.filePath)}
              </span>
              {event.metadata.lineNumbers && (
                <span className="aas-event__lines">
                  L{event.metadata.lineNumbers.start}
                  {event.metadata.lineNumbers.end !== event.metadata.lineNumbers.start && (
                    <>-{event.metadata.lineNumbers.end}</>
                  )}
                </span>
              )}
            </>
          ) : event.type === 'tool_call' && event.metadata?.toolName ? (
            <>
              <span className="aas-event__tool">{event.metadata.toolName}</span>
              {event.content && (
                <span className="aas-event__text">{event.content}</span>
              )}
            </>
          ) : isVerification ? (
            <span className={`aas-event__result aas-event__result--${event.metadata?.result || 'pending'}`}>
              {event.content}
            </span>
          ) : (
            <span className="aas-event__text">{event.content}</span>
          )}
        </div>

        {event.metadata?.duration && (
          <div className="aas-event__duration">{event.metadata.duration}ms</div>
        )}
      </div>
    </motion.div>
  );
}

function PhaseIndicator({ phase }: { phase: AgentActivityPhase | null }) {
  if (!phase) return null;

  return (
    <div className="aas-phase">
      <span className="aas-phase__dot" />
      <span className="aas-phase__label">{PHASE_LABELS[phase]}</span>
    </div>
  );
}

export default function AgentActivityStream({
  streamUrl,
  events: externalEvents,
  maxEvents = 100,
  isActive = true,
  onEvent,
}: AgentActivityStreamProps) {
  const [events, setEvents] = useState<AgentActivityEvent[]>([]);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const [activePhase, setActivePhase] = useState<AgentActivityPhase | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Use external events if provided
  useEffect(() => {
    if (externalEvents) {
      setEvents(externalEvents.slice(-maxEvents));
      const lastEvent = externalEvents[externalEvents.length - 1];
      if (lastEvent) {
        const phase = extractPhaseFromEvent(lastEvent);
        if (phase) setActivePhase(phase);
      }
    }
  }, [externalEvents, maxEvents]);

  // Connect to SSE stream
  useEffect(() => {
    if (!streamUrl || externalEvents) return;

    const es = new EventSource(streamUrl, { withCredentials: true });
    eventSourceRef.current = es;

    es.onmessage = (evt) => {
      try {
        const raw = JSON.parse(evt.data);
        const event = parseStreamChunkToEvent(raw);
        if (!event) return;

        setEvents((prev) => {
          const updated = [...prev, event].slice(-maxEvents);
          return updated;
        });

        const phase = extractPhaseFromEvent(event);
        if (phase) setActivePhase(phase);

        onEvent?.(event);
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      // Connection will auto-reconnect
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [streamUrl, externalEvents, maxEvents, onEvent]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  // Separate thinking events from activity events
  const thinkingEvents = events.filter((e) => e.type === 'thinking');
  const activityEvents = events.filter((e) => e.type !== 'thinking');

  const handleThinkingToggle = useCallback(() => {
    setIsThinkingExpanded((prev) => !prev);
  }, []);

  if (!isActive && events.length === 0) return null;

  return (
    <div className="aas">
      <div className="aas__header">
        <div className="aas__title">
          <CodeIcon size={14} />
          <span>Agent Activity</span>
        </div>
        <PhaseIndicator phase={activePhase} />
      </div>

      <div className="aas__body" ref={scrollRef}>
        {thinkingEvents.length > 0 && (
          <ThinkingAccordion
            events={thinkingEvents}
            isExpanded={isThinkingExpanded}
            onToggle={handleThinkingToggle}
          />
        )}

        <div className="aas__events">
          <AnimatePresence mode="popLayout">
            {activityEvents.map((event) => (
              <ActivityEventItem key={event.id} event={event} />
            ))}
          </AnimatePresence>
        </div>

        {isActive && events.length === 0 && (
          <div className="aas__empty">
            <ActivityIcon size={20} />
            <span>Waiting for agent activity...</span>
          </div>
        )}
      </div>
    </div>
  );
}
