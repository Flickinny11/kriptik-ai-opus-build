/**
 * Streaming Consciousness - Simple AI Activity Stream
 *
 * Shows what the AI is doing in real-time, similar to Cursor's streaming UI:
 * - Files being read/written
 * - Thinking/reasoning text
 * - Commands being run
 * - Diffs and changes
 *
 * Clean, functional, premium styling.
 */

import { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { API_URL } from '@/lib/api-config';

// Activity types
type ActivityType =
  | 'thinking'
  | 'reading'
  | 'writing'
  | 'command'
  | 'diff'
  | 'phase'
  | 'complete'
  | 'error';

interface ActivityItem {
  id: string;
  type: ActivityType;
  content: string;
  file?: string;
  timestamp: Date;
  expanded?: boolean;
  details?: string;
}

interface StreamingConsciousnessProps {
  className?: string;
  sessionId?: string;
  isActive?: boolean;
  onFileClick?: (file: string) => void;
}

// Type indicator icons (inline SVG, no dependencies)
const TypeIcon = memo(({ type }: { type: ActivityType }) => {
  const iconProps = { className: "w-3.5 h-3.5", strokeWidth: 2, fill: "none", stroke: "currentColor" };

  switch (type) {
    case 'thinking':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
          <path d="M12 6v6l4 2" />
        </svg>
      );
    case 'reading':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case 'writing':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      );
    case 'command':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      );
    case 'diff':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <line x1="12" y1="5" x2="12" y2="19" />
          <polyline points="19 12 12 19 5 12" />
        </svg>
      );
    case 'phase':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case 'complete':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case 'error':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    default:
      return null;
  }
});

TypeIcon.displayName = 'TypeIcon';

// Typing animation component
const TypewriterText = memo(({ text, speed = 15 }: { text: string; speed?: number }) => {
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!text) return;

    let index = 0;
    setDisplayText('');
    setIsComplete(false);

    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayText(text.slice(0, index + 1));
        index++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span>
      {displayText}
      {!isComplete && (
        <motion.span
          className="inline-block w-0.5 h-4 ml-0.5 bg-amber-500"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      )}
    </span>
  );
});

TypewriterText.displayName = 'TypewriterText';

// Single activity row
const ActivityRow = memo(({
  item,
  isLatest,
  onFileClick,
  onToggleExpand,
}: {
  item: ActivityItem;
  isLatest: boolean;
  onFileClick?: (file: string) => void;
  onToggleExpand?: () => void;
}) => {
  const typeColors: Record<ActivityType, string> = {
    thinking: '#f59e0b',
    reading: '#06b6d4',
    writing: '#10b981',
    command: '#8b5cf6',
    diff: '#ec4899',
    phase: '#f97316',
    complete: '#22c55e',
    error: '#ef4444',
  };

  const typeLabels: Record<ActivityType, string> = {
    thinking: 'Thinking',
    reading: 'Reading',
    writing: 'Writing',
    command: 'Running',
    diff: 'Changed',
    phase: 'Phase',
    complete: 'Done',
    error: 'Error',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group flex items-start gap-2 py-1.5 px-2 rounded-lg transition-colors',
        isLatest ? 'bg-amber-50/50' : 'hover:bg-stone-50/50'
      )}
    >
      {/* Type indicator */}
      <div
        className="flex-shrink-0 mt-0.5 p-1 rounded"
        style={{
          color: typeColors[item.type],
          background: `${typeColors[item.type]}15`,
        }}
      >
        <TypeIcon type={item.type} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Type label and file */}
        <div className="flex items-center gap-1.5 text-xs">
          <span
            className="font-semibold"
            style={{ color: typeColors[item.type], fontFamily: 'Syne, sans-serif' }}
          >
            {typeLabels[item.type]}
          </span>
          {item.file && (
            <button
              onClick={() => onFileClick?.(item.file!)}
              className="font-mono text-stone-600 hover:text-amber-600 hover:underline truncate max-w-[200px]"
            >
              {item.file}
            </button>
          )}
          <span className="text-stone-400 ml-auto text-[10px]">
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        {/* Main content */}
        <div className="text-sm text-stone-700 mt-0.5">
          {isLatest && item.type === 'thinking' ? (
            <TypewriterText text={item.content} speed={20} />
          ) : (
            <span className="line-clamp-2">{item.content}</span>
          )}
        </div>

        {/* Expandable details (for diffs, etc) */}
        {item.details && (
          <button
            onClick={onToggleExpand}
            className="text-xs text-amber-600 hover:text-amber-700 mt-1 font-medium"
          >
            {item.expanded ? 'Hide details' : 'Show details'}
          </button>
        )}

        <AnimatePresence>
          {item.expanded && item.details && (
            <motion.pre
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-2 p-2 bg-stone-900 text-stone-100 rounded text-xs font-mono overflow-x-auto"
            >
              {item.details}
            </motion.pre>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

ActivityRow.displayName = 'ActivityRow';

// Main component
export function StreamingConsciousness({
  className,
  sessionId,
  isActive = true,
  onFileClick,
}: StreamingConsciousnessProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-scroll to bottom on new activities
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activities]);

  // Connect to SSE stream for real-time events
  useEffect(() => {
    if (!sessionId || !isActive) return;

    const eventSource = new EventSource(
      `${API_URL}/api/orchestrate/${sessionId}/stream`,
      { withCredentials: true }
    );
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const newActivity = parseEventToActivity(data);
        if (newActivity) {
          setActivities(prev => [...prev.slice(-50), newActivity]); // Keep last 50
        }
      } catch (e) {
        console.error('[StreamingConsciousness] Parse error:', e);
      }
    };

    eventSource.onerror = () => {
      console.warn('[StreamingConsciousness] SSE connection error');
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [sessionId, isActive]);

  // Simulated activities for demo/loading state
  useEffect(() => {
    if (!isActive || sessionId) return;

    // Show initial loading activities
    const demoActivities: ActivityItem[] = [
      { id: '1', type: 'phase', content: 'Starting Intent Analysis', timestamp: new Date() },
    ];
    setActivities(demoActivities);

    // Simulate activity stream
    const phases = [
      { type: 'thinking' as const, content: 'Parsing natural language input and extracting core intent...' },
      { type: 'reading' as const, content: 'Loading project context', file: 'intent.json' },
      { type: 'thinking' as const, content: 'Identifying required features and dependencies...' },
      { type: 'phase' as const, content: 'Creating Implementation Plan' },
      { type: 'thinking' as const, content: 'Decomposing into frontend and backend tasks...' },
      { type: 'writing' as const, content: 'Generating build plan', file: 'feature_list.json' },
      { type: 'thinking' as const, content: 'Detecting required credentials and services...' },
      { type: 'phase' as const, content: 'Analyzing Dependencies' },
      { type: 'reading' as const, content: 'Checking GPU requirements', file: 'gpu-requirements.ts' },
      { type: 'thinking' as const, content: 'Plan ready for review...' },
    ];

    let index = 0;
    const interval = setInterval(() => {
      if (index < phases.length) {
        const phase = phases[index];
        setActivities(prev => [...prev, {
          id: String(Date.now()),
          type: phase.type,
          content: phase.content,
          file: phase.file,
          timestamp: new Date(),
        }]);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [isActive, sessionId]);

  // Toggle expand for an activity
  const toggleExpand = (id: string) => {
    setActivities(prev => prev.map(a =>
      a.id === id ? { ...a, expanded: !a.expanded } : a
    ));
  };

  return (
    <div
      className={cn(
        'flex flex-col h-full rounded-xl overflow-hidden',
        className
      )}
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,250,249,0.95) 100%)',
        border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.8)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{ borderColor: 'rgba(0,0,0,0.05)' }}
      >
        <motion.div
          className="w-2 h-2 rounded-full bg-amber-500"
          animate={isActive ? { scale: [1, 1.2, 1], opacity: [1, 0.7, 1] } : {}}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <span
          className="text-sm font-semibold"
          style={{ color: '#44403c', fontFamily: 'Syne, sans-serif' }}
        >
          AI Activity
        </span>
        <span className="text-xs text-stone-400 ml-auto">
          {activities.length} events
        </span>
      </div>

      {/* Activity stream */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5"
        style={{ scrollBehavior: 'smooth' }}
      >
        <AnimatePresence initial={false}>
          {activities.map((item, index) => (
            <ActivityRow
              key={item.id}
              item={item}
              isLatest={index === activities.length - 1}
              onFileClick={onFileClick}
              onToggleExpand={() => toggleExpand(item.id)}
            />
          ))}
        </AnimatePresence>

        {activities.length === 0 && (
          <div className="flex items-center justify-center h-full text-stone-400 text-sm">
            Waiting for activity...
          </div>
        )}
      </div>
    </div>
  );
}

// Parse backend events to activity items
function parseEventToActivity(data: any): ActivityItem | null {
  const id = String(Date.now() + Math.random());
  const timestamp = new Date();

  // Handle different event types from the backend
  if (data.type === 'thinking' || data.type === 'reasoning') {
    return { id, type: 'thinking', content: data.content || data.message, timestamp };
  }
  if (data.type === 'file_read' || data.type === 'context_loaded') {
    return { id, type: 'reading', content: 'Reading file', file: data.file || data.path, timestamp };
  }
  if (data.type === 'file_write' || data.type === 'file_update') {
    return {
      id,
      type: 'writing',
      content: data.summary || 'Writing changes',
      file: data.file || data.path,
      details: data.diff,
      timestamp
    };
  }
  if (data.type === 'command' || data.type === 'terminal') {
    return { id, type: 'command', content: data.command || data.content, timestamp };
  }
  if (data.type === 'phase' || data.type === 'phase_start') {
    return { id, type: 'phase', content: data.name || data.phase || data.content, timestamp };
  }
  if (data.type === 'complete' || data.type === 'done') {
    return { id, type: 'complete', content: data.message || 'Complete', timestamp };
  }
  if (data.type === 'error') {
    return { id, type: 'error', content: data.message || data.error, timestamp };
  }
  if (data.type === 'diff') {
    return {
      id,
      type: 'diff',
      content: `Changed ${data.file}`,
      file: data.file,
      details: data.diff,
      timestamp
    };
  }

  // Generic message
  if (data.message || data.content) {
    return { id, type: 'thinking', content: data.message || data.content, timestamp };
  }

  return null;
}

export default StreamingConsciousness;
