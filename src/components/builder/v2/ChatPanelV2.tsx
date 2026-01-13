/**
 * ChatPanelV2 - Streaming chat interface for Builder V2
 *
 * Features:
 * - Real-time streaming from SSE endpoint
 * - Message bubbles with typing indicator
 * - Agent avatar with model indicator
 * - Phase progress cards
 * - Collapsible code blocks
 * - Quick action buttons
 *
 * Integrates with existing:
 * - useAgentStore
 * - useCostStore
 * - useLatticeStore
 * - SSE from /api/execute
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, typography, spacing, radius, shadows, buildPhaseColors, buildModeConfig } from './design-tokens';
import { useCostStore } from '@/store/useCostStore';
import { API_URL } from '@/lib/api-config';
import { useUserStore } from '@/store/useUserStore';

export type BuildPhase = 
  | 'intent_lock' 
  | 'initialization' 
  | 'parallel_build' 
  | 'integration' 
  | 'testing' 
  | 'intent_satisfaction' 
  | 'demo';

export type BuildMode = 'lightning' | 'standard' | 'tournament' | 'production';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
  phase?: BuildPhase;
  isStreaming?: boolean;
  codeBlocks?: { language: string; code: string }[];
  tokenCount?: number;
}

interface ChatPanelV2Props {
  projectId?: string;
  buildMode?: BuildMode;
  onBuildStart?: () => void;
  onPhaseChange?: (phase: BuildPhase) => void;
  onBuildComplete?: () => void;
}

const phaseLabels: Record<BuildPhase, string> = {
  intent_lock: 'Intent Lock',
  initialization: 'Initialization',
  parallel_build: 'Building',
  integration: 'Integration',
  testing: 'Testing',
  intent_satisfaction: 'Verification',
  demo: 'Demo Ready',
};

const suggestions = [
  'Build a dashboard with analytics charts',
  'Create a user authentication system',
  'Design a landing page with pricing',
  'Add a contact form with validation',
];

export function ChatPanelV2({
  projectId,
  buildMode = 'standard',
  onBuildStart,
  onPhaseChange,
  onBuildComplete,
}: ChatPanelV2Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-20250514');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [expandedCodeBlocks, setExpandedCodeBlocks] = useState<Set<string>>(new Set());

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const { user } = useUserStore();
  const { setEstimate, deductCredits } = useCostStore();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isGenerating) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);
    onBuildStart?.();

    // Create assistant message placeholder
    const assistantId = `assistant-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      model: selectedModel,
      isStreaming: true,
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      // Connect to SSE endpoint
      const params = new URLSearchParams({
        prompt: userMessage.content,
        model: selectedModel,
        buildMode,
        projectId: projectId || 'new',
      });

      const es = new EventSource(`${API_URL}/api/execute?${params}`, {
        withCredentials: true,
      });
      eventSourceRef.current = es;

      let accumulatedContent = '';
      let currentPhase: BuildPhase | undefined;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'thinking':
            case 'text':
            case 'content':
              accumulatedContent += data.content || data.text || '';
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: accumulatedContent }
                    : m
                )
              );
              break;

            case 'phase':
              currentPhase = data.phase as BuildPhase;
              onPhaseChange?.(currentPhase);
              // Add phase indicator to message
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, phase: currentPhase }
                    : m
                )
              );
              break;

            case 'code':
              // Handle code blocks
              const codeBlock = { language: data.language || 'typescript', code: data.code };
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        codeBlocks: [...(m.codeBlocks || []), codeBlock],
                      }
                    : m
                )
              );
              break;

            case 'cost':
              // Update cost estimate in store
              if (data.estimated || data.estimatedTokens) {
                setEstimate({
                  totalCredits: data.estimated || 0,
                  complexity: 'Medium',
                  breakdown: {
                    planning: Math.floor((data.estimated || 0) * 0.1),
                    generation: Math.floor((data.estimated || 0) * 0.6),
                    testing: Math.floor((data.estimated || 0) * 0.2),
                    refinement: Math.floor((data.estimated || 0) * 0.1),
                  },
                  costDrivers: ['Model: ' + selectedModel],
                  confidence: 85,
                });
              }
              // Deduct actual credits if provided
              if (data.actual && data.actual > 0) {
                deductCredits(data.actual, 'Build generation');
              }
              break;

            case 'tokens':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, tokenCount: data.count }
                    : m
                )
              );
              break;

            case 'complete':
            case 'done':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, isStreaming: false }
                    : m
                )
              );
              setIsGenerating(false);
              onBuildComplete?.();
              es.close();
              eventSourceRef.current = null;
              break;

            case 'error':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: m.content + `\n\nError: ${data.message}`,
                        isStreaming: false,
                      }
                    : m
                )
              );
              setIsGenerating(false);
              es.close();
              eventSourceRef.current = null;
              break;
          }
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };

      es.onerror = () => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, isStreaming: false }
              : m
          )
        );
        setIsGenerating(false);
        es.close();
        eventSourceRef.current = null;
      };
    } catch (err) {
      console.error('Failed to start generation:', err);
      setIsGenerating(false);
    }
  }, [input, isGenerating, selectedModel, buildMode, projectId, onBuildStart, onPhaseChange, onBuildComplete, setEstimate, deductCredits]);

  const handleStop = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsGenerating(false);
    setMessages((prev) =>
      prev.map((m) =>
        m.isStreaming ? { ...m, isStreaming: false, content: m.content + '\n\n[Generation stopped]' } : m
      )
    );
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === 'Escape' && isGenerating) {
        handleStop();
      }
    },
    [handleSend, handleStop, isGenerating]
  );

  const toggleCodeBlock = useCallback((id: string) => {
    setExpandedCodeBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const modeConfig = buildModeConfig[buildMode];

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: colors.bg.secondary,
        borderRadius: radius.xl,
        overflow: 'hidden',
        border: `1px solid ${colors.border.subtle}`,
      }}
    >
      {/* Messages area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: spacing[4],
          display: 'flex',
          flexDirection: 'column',
          gap: spacing[4],
        }}
      >
        {/* Welcome message if no messages */}
        {messages.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              gap: spacing[6],
            }}
          >
            {/* Logo/Icon */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: radius.xl,
                background: `linear-gradient(135deg, ${colors.accent[500]}30, ${colors.accent[700]}30)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: shadows.glowAmber,
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={colors.accent[500]} strokeWidth="1.5">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
              </svg>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <h2
                style={{
                  fontFamily: typography.fonts.display,
                  fontSize: typography.sizes['2xl'],
                  fontWeight: typography.weights.semibold,
                  color: colors.text.primary,
                  marginBottom: spacing[2],
                }}
              >
                What would you like to build?
              </h2>
              <p
                style={{
                  fontSize: typography.sizes.sm,
                  color: colors.text.secondary,
                  maxWidth: '400px',
                }}
              >
                Describe your app in natural language. I'll create a complete, production-ready application for you.
              </p>
            </motion.div>

            {/* Suggestions */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: spacing[2],
                justifyContent: 'center',
                maxWidth: '500px',
              }}
            >
              {suggestions.map((suggestion, i) => (
                <motion.button
                  key={i}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setInput(suggestion)}
                  style={{
                    padding: `${spacing[2]} ${spacing[4]}`,
                    background: colors.bg.tertiary,
                    border: `1px solid ${colors.border.muted}`,
                    borderRadius: radius.lg,
                    fontSize: typography.sizes.sm,
                    color: colors.text.secondary,
                    cursor: 'pointer',
                    transition: 'all 200ms ease',
                  }}
                >
                  {suggestion}
                </motion.button>
              ))}
            </motion.div>
          </div>
        )}

        {/* Messages */}
        <AnimatePresence mode="popLayout">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              expandedCodeBlocks={expandedCodeBlocks}
              onToggleCodeBlock={toggleCodeBlock}
              userName={user?.name}
              userAvatar={user?.avatar}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Input area */}
      <div
        style={{
          borderTop: `1px solid ${colors.border.subtle}`,
          padding: spacing[4],
          background: colors.bg.panel,
        }}
      >
        {/* Action bar */}
        {isGenerating && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing[2],
              marginBottom: spacing[3],
            }}
          >
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing[2],
                padding: `${spacing[1.5]} ${spacing[3]}`,
                background: `${colors.accent[600]}15`,
                borderRadius: radius.md,
                border: `1px solid ${colors.accent[600]}30`,
              }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{ color: colors.accent[500] }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
              </motion.div>
              <span
                style={{
                  fontSize: typography.sizes.xs,
                  color: colors.accent[400],
                  fontWeight: typography.weights.medium,
                }}
              >
                Agent is working...
              </span>
            </motion.div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleStop}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing[1.5],
                padding: `${spacing[1.5]} ${spacing[3]}`,
                background: `${colors.error.main}15`,
                border: `1px solid ${colors.error.main}30`,
                borderRadius: radius.md,
                color: colors.error.text,
                fontSize: typography.sizes.xs,
                fontWeight: typography.weights.medium,
                cursor: 'pointer',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              Stop
            </motion.button>
          </div>
        )}

        {/* Input container */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: spacing[3],
            background: colors.bg.tertiary,
            borderRadius: radius.xl,
            padding: spacing[2],
            border: `1px solid ${colors.border.muted}`,
          }}
        >
          {/* Attachment button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: colors.text.muted,
              borderRadius: radius.md,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          </motion.button>

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to build..."
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: typography.sizes.sm,
              fontFamily: typography.fonts.body,
              color: colors.text.primary,
              minHeight: '36px',
              maxHeight: '120px',
              lineHeight: 1.5,
            }}
          />

          {/* Model selector */}
          <div style={{ position: 'relative' }}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowModelSelector(!showModelSelector)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing[1.5],
                padding: `${spacing[1.5]} ${spacing[2.5]}`,
                background: colors.bg.secondary,
                border: `1px solid ${colors.border.muted}`,
                borderRadius: radius.md,
                cursor: 'pointer',
                color: colors.text.secondary,
                fontSize: typography.sizes.xs,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={colors.accent[500]} strokeWidth="2">
                <circle cx="12" cy="12" r="3" fill="currentColor" />
              </svg>
              <span>{selectedModel.includes('sonnet') ? 'Sonnet' : selectedModel.includes('opus') ? 'Opus' : 'GPT'}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </motion.button>

            <AnimatePresence>
              {showModelSelector && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.95 }}
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    right: 0,
                    marginBottom: spacing[2],
                    background: colors.bg.panel,
                    borderRadius: radius.lg,
                    border: `1px solid ${colors.border.muted}`,
                    boxShadow: shadows.lg,
                    overflow: 'hidden',
                    zIndex: 50,
                    minWidth: '180px',
                  }}
                >
                  {[
                    { id: 'claude-sonnet-4-20250514', label: 'Sonnet 4', provider: 'Anthropic' },
                    { id: 'claude-opus-4-20250514', label: 'Opus 4', provider: 'Anthropic' },
                    { id: 'gpt-4.1-2025-04-14', label: 'GPT-4.1', provider: 'OpenAI' },
                  ].map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setShowModelSelector(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: `${spacing[2.5]} ${spacing[3]}`,
                        background: selectedModel === model.id ? `${colors.accent[600]}15` : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: colors.text.primary,
                        fontSize: typography.sizes.sm,
                        textAlign: 'left',
                      }}
                    >
                      <span>{model.label}</span>
                      <span style={{ fontSize: typography.sizes.xs, color: colors.text.muted }}>
                        {model.provider}
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Send button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSend}
            disabled={!input.trim() || isGenerating}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              background: input.trim() && !isGenerating
                ? `linear-gradient(135deg, ${colors.accent[500]}, ${colors.accent[600]})`
                : colors.bg.elevated,
              border: 'none',
              borderRadius: radius.md,
              cursor: input.trim() && !isGenerating ? 'pointer' : 'not-allowed',
              color: input.trim() && !isGenerating ? '#0C0A09' : colors.text.muted,
              boxShadow: input.trim() && !isGenerating ? shadows.glowAmber : 'none',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </motion.button>
        </div>

        {/* Keyboard hints */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: spacing[2],
            padding: `0 ${spacing[2]}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing[3],
              fontSize: typography.sizes.xs,
              color: colors.text.muted,
            }}
          >
            <span>
              <kbd style={{ padding: `${spacing[0.5]} ${spacing[1]}`, background: colors.bg.tertiary, borderRadius: radius.sm }}>Enter</kbd> to send
            </span>
            <span>
              <kbd style={{ padding: `${spacing[0.5]} ${spacing[1]}`, background: colors.bg.tertiary, borderRadius: radius.sm }}>Shift+Enter</kbd> for new line
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing[1.5],
              fontSize: typography.sizes.xs,
              color: modeConfig.color,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            {modeConfig.label} Mode
          </div>
        </div>
      </div>
    </div>
  );
}

// Message Bubble Component
interface MessageBubbleProps {
  message: Message;
  expandedCodeBlocks: Set<string>;
  onToggleCodeBlock: (id: string) => void;
  userName?: string;
  userAvatar?: string;
}

function MessageBubble({
  message,
  expandedCodeBlocks,
  onToggleCodeBlock,
  userName,
  userAvatar,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: `${spacing[2]} 0`,
        }}
      >
        <div
          style={{
            padding: `${spacing[2]} ${spacing[4]}`,
            background: colors.bg.tertiary,
            borderRadius: radius.full,
            fontSize: typography.sizes.xs,
            color: colors.text.muted,
          }}
        >
          {message.content}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: spacing[3],
        alignItems: 'flex-start',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: radius.lg,
          background: isUser
            ? colors.bg.tertiary
            : `linear-gradient(135deg, ${colors.accent[500]}30, ${colors.accent[700]}30)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {isUser && userAvatar ? (
          <img src={userAvatar} alt={userName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : isUser ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.text.secondary} strokeWidth="2">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.accent[500]} strokeWidth="1.5">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
          </svg>
        )}
      </div>

      {/* Message content */}
      <div
        style={{
          flex: 1,
          maxWidth: '85%',
        }}
      >
        {/* Phase indicator */}
        {message.phase && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: spacing[1.5],
              padding: `${spacing[1]} ${spacing[2.5]}`,
              background: `${buildPhaseColors[message.phase]}15`,
              borderRadius: radius.md,
              marginBottom: spacing[2],
              fontSize: typography.sizes.xs,
              color: buildPhaseColors[message.phase],
              fontWeight: typography.weights.medium,
            }}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: buildPhaseColors[message.phase],
              }}
            />
            {phaseLabels[message.phase]}
          </div>
        )}

        {/* Message bubble */}
        <div
          style={{
            padding: `${spacing[3]} ${spacing[4]}`,
            background: isUser ? `${colors.accent[600]}15` : colors.bg.tertiary,
            borderRadius: radius.xl,
            borderTopLeftRadius: isUser ? radius.xl : radius.sm,
            borderTopRightRadius: isUser ? radius.sm : radius.xl,
            border: isUser ? `1px solid ${colors.accent[600]}30` : `1px solid ${colors.border.subtle}`,
          }}
        >
          {/* Text content */}
          <div
            style={{
              fontSize: typography.sizes.sm,
              color: colors.text.primary,
              lineHeight: typography.lineHeights.relaxed,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {message.content}
            {message.isStreaming && (
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                style={{
                  display: 'inline-block',
                  width: '2px',
                  height: '1em',
                  background: colors.accent[500],
                  marginLeft: '2px',
                  verticalAlign: 'text-bottom',
                }}
              />
            )}
          </div>

          {/* Code blocks */}
          {message.codeBlocks && message.codeBlocks.length > 0 && (
            <div style={{ marginTop: spacing[3], display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
              {message.codeBlocks.map((block, i) => {
                const blockId = `${message.id}-code-${i}`;
                const isExpanded = expandedCodeBlocks.has(blockId);
                return (
                  <div
                    key={i}
                    style={{
                      background: colors.bg.primary,
                      borderRadius: radius.lg,
                      overflow: 'hidden',
                      border: `1px solid ${colors.border.subtle}`,
                    }}
                  >
                    <button
                      onClick={() => onToggleCodeBlock(blockId)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: `${spacing[2]} ${spacing[3]}`,
                        background: colors.bg.secondary,
                        border: 'none',
                        cursor: 'pointer',
                        color: colors.text.secondary,
                        fontSize: typography.sizes.xs,
                        fontFamily: typography.fonts.mono,
                      }}
                    >
                      <span>{block.language}</span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 200ms ease',
                        }}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <pre
                            style={{
                              padding: spacing[3],
                              margin: 0,
                              fontSize: typography.sizes.xs,
                              fontFamily: typography.fonts.mono,
                              color: colors.text.secondary,
                              overflow: 'auto',
                              maxHeight: '300px',
                            }}
                          >
                            {block.code}
                          </pre>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[3],
            marginTop: spacing[1.5],
            paddingLeft: spacing[2],
          }}
        >
          <span
            style={{
              fontSize: '10px',
              color: colors.text.muted,
            }}
          >
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {message.model && (
            <span
              style={{
                fontSize: '10px',
                color: colors.text.muted,
              }}
            >
              {message.model.includes('sonnet') ? 'Sonnet 4' : message.model.includes('opus') ? 'Opus 4' : 'GPT'}
            </span>
          )}
          {message.tokenCount && (
            <span
              style={{
                fontSize: '10px',
                color: colors.text.muted,
              }}
            >
              {message.tokenCount.toLocaleString()} tokens
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default ChatPanelV2;
