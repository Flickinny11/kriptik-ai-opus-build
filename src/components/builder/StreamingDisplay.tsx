/**
 * StreamingDisplay - Real-time AI Thinking and Progress Display
 *
 * Features:
 * - Typing animation for streaming text
 * - Syntax highlighting for code blocks
 * - Collapsible sections for verbose output
 * - Progress indicators for each phase
 * - Time metrics display (TTFT, total time)
 * - Liquid glass styling per KripTik design system
 *
 * Part of Phase 8: Streaming Display Implementation
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export type StreamPhase =
  | 'idle'
  | 'thinking'
  | 'generating'
  | 'verification'
  | 'complete'
  | 'error';

export interface StreamMetrics {
  ttft: number | null;       // Time to first token (ms)
  totalTime: number | null;  // Total generation time (ms)
  tokensGenerated: number;   // Token count
  tokensPerSecond: number;   // Generation speed
}

export interface CodeBlock {
  id: string;
  language: string;
  content: string;
  fileName?: string;
  collapsed?: boolean;
}

export interface StreamingDisplayProps {
  className?: string;
  stream?: AsyncIterable<string> | null;
  isLoading?: boolean;
  initialText?: string;
  currentPhase?: StreamPhase;
  onComplete?: (fullText: string, metrics: StreamMetrics) => void;
  onError?: (error: Error) => void;
  showMetrics?: boolean;
  autoScroll?: boolean;
}

// ============================================================================
// CUSTOM ICONS (inline SVG - no Lucide)
// ============================================================================

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const ZapIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const CopyIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ============================================================================
// TTFT BADGE COMPONENT
// ============================================================================

const TTFTBadge = memo(({ ttft, isActive }: { ttft: number | null; isActive: boolean }) => {
  if (ttft === null && !isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
        'transition-all duration-300'
      )}
      style={{
        background: ttft !== null
          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(20, 184, 166, 0.15) 100%)'
          : 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(249, 115, 22, 0.15) 100%)',
        border: ttft !== null
          ? '1px solid rgba(16, 185, 129, 0.3)'
          : '1px solid rgba(245, 158, 11, 0.3)',
        color: ttft !== null ? '#10b981' : '#f59e0b',
        boxShadow: ttft !== null
          ? '0 2px 8px rgba(16, 185, 129, 0.15)'
          : '0 2px 8px rgba(245, 158, 11, 0.15)',
      }}
    >
      <ClockIcon className="w-3 h-3" />
      <span>
        TTFT: {ttft !== null ? `${ttft}ms` : (
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            ...
          </motion.span>
        )}
      </span>
    </motion.div>
  );
});

TTFTBadge.displayName = 'TTFTBadge';

// ============================================================================
// METRICS BAR COMPONENT
// ============================================================================

const MetricsBar = memo(({ metrics, phase }: { metrics: StreamMetrics; phase: StreamPhase }) => {
  const formatDuration = (ms: number | null): string => {
    if (ms === null) return '--';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 px-4 py-2 rounded-lg"
      style={{
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* TTFT */}
      <TTFTBadge ttft={metrics.ttft} isActive={phase === 'thinking' || phase === 'generating'} />

      {/* Total Time */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <ZapIcon className="w-3.5 h-3.5 text-amber-500" />
        <span>Total: {formatDuration(metrics.totalTime)}</span>
      </div>

      {/* Tokens */}
      {metrics.tokensGenerated > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="text-cyan-400 font-mono">{metrics.tokensGenerated}</span>
          <span>tokens</span>
          {metrics.tokensPerSecond > 0 && (
            <span className="text-slate-500">
              ({metrics.tokensPerSecond.toFixed(0)}/s)
            </span>
          )}
        </div>
      )}

      {/* Phase Indicator */}
      <div className="ml-auto flex items-center gap-2">
        <motion.div
          className={cn(
            'w-2 h-2 rounded-full',
            phase === 'thinking' || phase === 'generating' ? 'bg-amber-500' : '',
            phase === 'verification' ? 'bg-cyan-500' : '',
            phase === 'complete' ? 'bg-emerald-500' : '',
            phase === 'error' ? 'bg-red-500' : '',
            phase === 'idle' ? 'bg-slate-500' : ''
          )}
          animate={
            phase === 'thinking' || phase === 'generating' || phase === 'verification'
              ? { scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }
              : {}
          }
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <span className="text-xs font-medium text-slate-400 capitalize">
          {phase}
        </span>
      </div>
    </motion.div>
  );
});

MetricsBar.displayName = 'MetricsBar';

// ============================================================================
// TYPING CURSOR COMPONENT
// ============================================================================

const TypingCursor = memo(() => (
  <motion.span
    className="inline-block w-0.5 h-4 ml-0.5"
    style={{ backgroundColor: '#f59e0b' }}
    animate={{ opacity: [1, 0] }}
    transition={{ duration: 0.5, repeat: Infinity }}
  />
));

TypingCursor.displayName = 'TypingCursor';

// ============================================================================
// LOADING INDICATOR COMPONENT
// ============================================================================

const LoadingIndicator = memo(() => (
  <motion.div
    className="flex items-center gap-2 text-sm text-amber-500"
    animate={{ opacity: [0.6, 1, 0.6] }}
    transition={{ duration: 1.5, repeat: Infinity }}
  >
    <motion.div
      className="w-2 h-2 rounded-full bg-amber-500"
      animate={{ scale: [0.8, 1.2, 0.8] }}
      transition={{ duration: 0.8, repeat: Infinity }}
    />
    <span className="font-medium" style={{ fontFamily: 'Outfit, sans-serif' }}>
      Thinking...
    </span>
  </motion.div>
));

LoadingIndicator.displayName = 'LoadingIndicator';

// ============================================================================
// CODE BLOCK COMPONENT WITH SYNTAX HIGHLIGHTING
// ============================================================================

const CodeBlockDisplay = memo(({
  block,
  onToggle,
  onCopy,
}: {
  block: CodeBlock;
  onToggle: () => void;
  onCopy: () => void;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Basic syntax highlighting patterns
  const highlightCode = (code: string, language: string): string => {
    let highlighted = code;

    // Keywords for TypeScript/JavaScript
    if (['typescript', 'javascript', 'ts', 'js', 'tsx', 'jsx'].includes(language.toLowerCase())) {
      const keywords = /\b(const|let|var|function|return|if|else|for|while|class|interface|type|export|import|from|async|await|try|catch|throw|new|this|extends|implements|public|private|protected|static|readonly)\b/g;
      highlighted = highlighted.replace(keywords, '<span class="text-violet-400">$1</span>');

      // Strings
      highlighted = highlighted.replace(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, '<span class="text-emerald-400">$&</span>');

      // Numbers
      highlighted = highlighted.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="text-amber-400">$1</span>');

      // Comments
      highlighted = highlighted.replace(/(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, '<span class="text-slate-500 italic">$1</span>');
    }

    return highlighted;
  };

  return (
    <div
      className="my-3 rounded-lg overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{
          background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          <motion.span
            animate={{ rotate: block.collapsed ? 0 : 90 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRightIcon className="w-4 h-4" />
          </motion.span>
          {block.fileName && (
            <span className="text-slate-300">{block.fileName}</span>
          )}
          <span className="text-slate-500">{block.language}</span>
        </button>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 rounded transition-colors"
          style={{ background: 'rgba(255, 255, 255, 0.05)' }}
        >
          {copied ? (
            <>
              <CheckIcon className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <CopyIcon className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <AnimatePresence initial={false}>
        {!block.collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <pre
              className="p-4 text-sm leading-relaxed overflow-x-auto"
              style={{
                fontFamily: 'JetBrains Mono, Fira Code, SF Mono, monospace',
                fontSize: '13px',
              }}
            >
              <code
                dangerouslySetInnerHTML={{
                  __html: highlightCode(block.content, block.language),
                }}
              />
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

CodeBlockDisplay.displayName = 'CodeBlockDisplay';

// ============================================================================
// COLLAPSIBLE SECTION COMPONENT
// ============================================================================

const CollapsibleSection = memo(({
  title,
  children,
  defaultExpanded = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      className="my-2 rounded-lg overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-300 hover:text-slate-100 transition-colors"
      >
        <span className="font-medium" style={{ fontFamily: 'Outfit, sans-serif' }}>
          {title}
        </span>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDownIcon className="w-4 h-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className="px-3 py-2"
              style={{ borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

CollapsibleSection.displayName = 'CollapsibleSection';

// ============================================================================
// MAIN STREAMING DISPLAY COMPONENT
// ============================================================================

export function StreamingDisplay({
  className,
  stream,
  isLoading = false,
  initialText = '',
  currentPhase = 'idle',
  onComplete,
  onError,
  showMetrics = true,
  autoScroll = true,
}: StreamingDisplayProps) {
  const [displayText, setDisplayText] = useState(initialText);
  const [phase, setPhase] = useState<StreamPhase>(currentPhase);
  const [metrics, setMetrics] = useState<StreamMetrics>({
    ttft: null,
    totalTime: null,
    tokensGenerated: 0,
    tokensPerSecond: 0,
  });
  const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const firstTokenTimeRef = useRef<number | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayText, autoScroll]);

  // Update phase from props
  useEffect(() => {
    setPhase(currentPhase);
  }, [currentPhase]);

  // Process stream
  useEffect(() => {
    if (!stream) return;

    const processStream = async () => {
      startTimeRef.current = Date.now();
      setPhase('thinking');
      setDisplayText('');
      setMetrics(prev => ({ ...prev, ttft: null, totalTime: null, tokensGenerated: 0 }));

      try {
        let fullText = '';
        let tokenCount = 0;

        for await (const chunk of stream) {
          // Record TTFT on first token
          if (firstTokenTimeRef.current === null) {
            firstTokenTimeRef.current = Date.now();
            const ttft = firstTokenTimeRef.current - (startTimeRef.current || 0);
            setMetrics(prev => ({ ...prev, ttft }));
            setPhase('generating');
          }

          fullText += chunk;
          tokenCount++;

          // Update display with typing effect (batch updates for performance)
          setDisplayText(fullText);

          // Update token count and speed
          const elapsed = Date.now() - (startTimeRef.current || Date.now());
          const tokensPerSecond = elapsed > 0 ? (tokenCount / elapsed) * 1000 : 0;
          setMetrics(prev => ({
            ...prev,
            tokensGenerated: tokenCount,
            tokensPerSecond,
          }));
        }

        // Complete
        const totalTime = Date.now() - (startTimeRef.current || Date.now());
        setMetrics(prev => ({ ...prev, totalTime }));
        setPhase('complete');

        // Extract code blocks from final text
        extractCodeBlocks(fullText);

        onComplete?.(fullText, {
          ttft: metrics.ttft,
          totalTime,
          tokensGenerated: tokenCount,
          tokensPerSecond: tokenCount / (totalTime / 1000),
        });
      } catch (error) {
        setPhase('error');
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }

      // Reset refs
      startTimeRef.current = null;
      firstTokenTimeRef.current = null;
    };

    processStream();
  }, [stream, onComplete, onError]);

  // Extract code blocks from text
  const extractCodeBlocks = useCallback((text: string) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const blocks: CodeBlock[] = [];
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      blocks.push({
        id: `block-${blocks.length}`,
        language: match[1] || 'plaintext',
        content: match[2].trim(),
        collapsed: false,
      });
    }

    setCodeBlocks(blocks);
  }, []);

  // Toggle code block collapse
  const toggleCodeBlock = useCallback((id: string) => {
    setCodeBlocks(prev =>
      prev.map(block =>
        block.id === id ? { ...block, collapsed: !block.collapsed } : block
      )
    );
  }, []);

  // Copy code block
  const copyCodeBlock = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
  }, []);

  // Render text with code blocks inline
  const renderTextWithCodeBlocks = () => {
    if (codeBlocks.length === 0) {
      return (
        <div
          className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {displayText}
          {(phase === 'thinking' || phase === 'generating') && <TypingCursor />}
        </div>
      );
    }

    // Split text by code blocks and render
    const parts = displayText.split(/```\w*\n[\s\S]*?```/);
    return (
      <div className="text-sm leading-relaxed text-slate-200">
        {parts.map((part, index) => (
          <div key={index}>
            <span className="whitespace-pre-wrap" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              {part}
            </span>
            {codeBlocks[index] && (
              <CodeBlockDisplay
                block={codeBlocks[index]}
                onToggle={() => toggleCodeBlock(codeBlocks[index].id)}
                onCopy={() => copyCodeBlock(codeBlocks[index].content)}
              />
            )}
          </div>
        ))}
        {(phase === 'thinking' || phase === 'generating') && <TypingCursor />}
      </div>
    );
  };

  return (
    <div
      className={cn(
        'flex flex-col h-full rounded-xl overflow-hidden',
        className
      )}
      style={{
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(40px) saturate(180%)',
      }}
    >
      {/* Header with Metrics */}
      {showMetrics && (
        <div
          className="flex-shrink-0 px-4 py-3"
          style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
        >
          <MetricsBar metrics={metrics} phase={phase} />
        </div>
      )}

      {/* Content Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ scrollBehavior: 'smooth' }}
      >
        {/* Loading State */}
        {isLoading && displayText === '' && (
          <LoadingIndicator />
        )}

        {/* Main Content */}
        {displayText && renderTextWithCodeBlocks()}

        {/* Empty State */}
        {!isLoading && displayText === '' && phase === 'idle' && (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Waiting for input...
          </div>
        )}
      </div>

      {/* Footer with Phase Progress */}
      {phase !== 'idle' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-shrink-0 px-4 py-2"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.2) 100%)',
            borderTop: '1px solid rgba(255, 255, 255, 0.04)',
          }}
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {phase === 'complete' && 'Generation complete'}
              {phase === 'error' && 'An error occurred'}
              {(phase === 'thinking' || phase === 'generating') && 'Generating response...'}
              {phase === 'verification' && 'Verifying output...'}
            </span>
            {metrics.tokensGenerated > 0 && (
              <span className="font-mono">
                {metrics.tokensGenerated} tokens
              </span>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default StreamingDisplay;
