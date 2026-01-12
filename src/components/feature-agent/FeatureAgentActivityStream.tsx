/**
 * Feature Agent Activity Stream - Real-time orchestration activity display
 *
 * Same functionality as AgentActivityStream but styled to match feature agent tiles:
 * - Amber/orange color scheme (#F5A86C)
 * - Compact design for tile integration
 * - Glassmorphism matching tile aesthetic
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
import './FeatureAgentActivityStream.css';

interface FeatureAgentActivityStreamProps {
  /** Agent ID for SSE connection */
  agentId: string;
  /** Pre-loaded events */
  events?: AgentActivityEvent[];
  /** Maximum events to display */
  maxEvents?: number;
  /** Whether streaming is active */
  isActive?: boolean;
  /** Callback when an event is received */
  onEvent?: (event: AgentActivityEvent) => void;
  /** Compact mode for minimal height */
  compact?: boolean;
}

type EventIconMap = Record<AgentActivityEventType, React.ReactNode>;

const EVENT_ICONS: EventIconMap = {
  thinking: <BrainIcon size={12} />,
  file_read: <EyeIcon size={12} />,
  file_write: <FileIcon size={12} />,
  file_edit: <EditIcon size={12} />,
  tool_call: <WandIcon size={12} />,
  status: <ActivityIcon size={12} />,
  verification: <CheckCircleIcon size={12} />,
  error: <AlertCircleIcon size={12} />,
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

function truncatePath(path: string, maxLength = 30): string {
  if (path.length <= maxLength) return path;
  const parts = path.split('/');
  if (parts.length <= 2) return '...' + path.slice(-maxLength + 3);
  return '.../' + parts.slice(-2).join('/');
}

function ThinkingSection({
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
    <div className="faas-thinking">
      <button
        className="faas-thinking__header"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <div className="faas-thinking__icon">
          <BrainIcon size={12} />
          <span className="faas-thinking__pulse" />
        </div>
        <span className="faas-thinking__label">Thinking</span>
        <span className="faas-thinking__count">{totalTokens}</span>
        <motion.span
          className="faas-thinking__chevron"
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDownIcon size={10} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            className="faas-thinking__content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="faas-thinking__scroll" ref={scrollRef}>
              {events.map((event) => (
                <div key={event.id} className="faas-thinking__item">
                  <span className="faas-thinking__text">{event.content}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isExpanded && latestThought && (
        <div className="faas-thinking__preview">
          {latestThought.content.slice(0, 60)}
          {latestThought.content.length > 60 ? '...' : ''}
        </div>
      )}
    </div>
  );
}

function CompactEventItem({ event }: { event: AgentActivityEvent }) {
  const icon = EVENT_ICONS[event.type];
  const isError = event.type === 'error';
  const isFileOp = ['file_read', 'file_write', 'file_edit'].includes(event.type);

  return (
    <motion.div
      className={`faas-event faas-event--${event.type} ${isError ? 'faas-event--error' : ''}`}
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
    >
      <div className="faas-event__icon">{icon}</div>
      <div className="faas-event__content">
        {isFileOp && event.metadata?.filePath ? (
          <span className="faas-event__path">
            {truncatePath(event.metadata.filePath)}
          </span>
        ) : event.type === 'tool_call' && event.metadata?.toolName ? (
          <span className="faas-event__tool">{event.metadata.toolName}</span>
        ) : (
          <span className="faas-event__text">
            {event.content.slice(0, 50)}
            {event.content.length > 50 ? '...' : ''}
          </span>
        )}
      </div>
      <span className="faas-event__time">{formatTimestamp(event.timestamp)}</span>
    </motion.div>
  );
}

function PhaseIndicator({ phase }: { phase: AgentActivityPhase | null }) {
  if (!phase) return null;

  return (
    <div className="faas-phase">
      <span className="faas-phase__dot" />
      <span className="faas-phase__label">{PHASE_LABELS[phase]}</span>
    </div>
  );
}

export function FeatureAgentActivityStream({
  agentId,
  events: externalEvents,
  maxEvents = 50,
  isActive = true,
  onEvent,
  compact = false,
}: FeatureAgentActivityStreamProps) {
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

  // Connect to SSE stream for this agent
  useEffect(() => {
    if (externalEvents || !isActive) return;

    // Use API_URL for proper server connection
    const apiBase = import.meta.env.VITE_API_URL || '';
    const url = `${apiBase}/api/developer-mode/feature-agent/${encodeURIComponent(agentId)}/activity-stream`;
    const es = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = es;

    es.onmessage = (evt) => {
      try {
        const raw = JSON.parse(evt.data);
        const event = parseStreamChunkToEvent(raw, agentId);
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

    es.onerror = (err) => {
      console.warn('[FeatureAgentActivityStream] SSE error, connection may have been interrupted:', err);
      // Don't close immediately - browser will auto-reconnect
      // Only add error event if we had some activity first
      if (events.length > 0) {
        setEvents((prev) => {
          const errorEvent: AgentActivityEvent = {
            id: `error-${Date.now()}`,
            agentId,
            type: 'error',
            content: 'Stream connection lost. Attempting to reconnect...',
            timestamp: Date.now(),
          };
          return [...prev, errorEvent].slice(-maxEvents);
        });
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [agentId, externalEvents, maxEvents, onEvent, isActive, events.length]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  const thinkingEvents = events.filter((e) => e.type === 'thinking');
  const activityEvents = events.filter((e) => e.type !== 'thinking');

  const handleThinkingToggle = useCallback(() => {
    setIsThinkingExpanded((prev) => !prev);
  }, []);

  if (!isActive && events.length === 0) return null;

  return (
    <div className={`faas ${compact ? 'faas--compact' : ''}`}>
      <div className="faas__header">
        <div className="faas__title">
          <CodeIcon size={12} />
          <span>Activity</span>
        </div>
        <PhaseIndicator phase={activePhase} />
      </div>

      <div className="faas__body" ref={scrollRef}>
        {thinkingEvents.length > 0 && (
          <ThinkingSection
            events={thinkingEvents}
            isExpanded={isThinkingExpanded}
            onToggle={handleThinkingToggle}
          />
        )}

        <div className="faas__events">
          <AnimatePresence mode="popLayout">
            {activityEvents.slice(-10).map((event) => (
              <CompactEventItem key={event.id} event={event} />
            ))}
          </AnimatePresence>
        </div>

        {isActive && events.length === 0 && (
          <div className="faas__empty">
            <ActivityIcon size={16} />
            <span>Waiting...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default FeatureAgentActivityStream;
