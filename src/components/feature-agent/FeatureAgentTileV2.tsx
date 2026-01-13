/**
 * FeatureAgentTileV2 - Fixed and improved Feature Agent tile
 *
 * Fixes:
 * 1. Proper CSS transform positioning (not left/top)
 * 2. Resize handles with visual indicators
 * 3. Stop task confirmation modal
 * 4. Merge flow modal for completed tasks
 * 5. Proper drag boundaries
 * 6. Z-index management for focus
 * 7. No cursor sticking
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/lib/api-client';
import {
  useFeatureAgentTileStore,
  type StreamMessage,
  type FeatureAgentTileStatus,
  type ImplementationPlan,
  type RequiredCredential,
} from '@/store/useFeatureAgentTileStore';
import { ImplementationPlanView, type PhaseModification } from './ImplementationPlanView';
import { CredentialsCollectionView } from './CredentialsCollectionView';
import { FeatureAgentActivityStream } from './FeatureAgentActivityStream';
import type { AgentActivityEvent } from '@/types/agent-activity';
import { parseStreamChunkToEvent } from '@/types/agent-activity';

// Size constraints
const MIN_WIDTH = 360;
const MIN_HEIGHT = 440;
const MAX_WIDTH = 800;
const MAX_HEIGHT = 900;
const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 560;

// Status colors
const statusColors: Record<FeatureAgentTileStatus, string> = {
  intent_lock: '#F59E0B',
  awaiting_plan_approval: '#F59E0B',
  awaiting_credentials: '#F59E0B',
  awaiting_integrations: '#F59E0B',
  implementing: '#F59E0B',
  verifying: '#14B8A6',
  complete: '#22C55E',
  failed: '#EF4444',
  paused: '#6B7280',
  ghost_mode: '#F59E0B',
};

const statusLabels: Record<FeatureAgentTileStatus, string> = {
  intent_lock: 'INTENT',
  awaiting_plan_approval: 'PLAN',
  awaiting_credentials: 'CREDENTIALS',
  awaiting_integrations: 'CONNECT',
  implementing: 'IMPLEMENTING',
  verifying: 'VERIFYING',
  complete: 'COMPLETE',
  failed: 'FAILED',
  paused: 'PAUSED',
  ghost_mode: 'GHOST',
};

interface FeatureAgentTileV2Props {
  agentId: string;
  onClose: () => void;
  onMinimize: () => void;
  initialPosition?: { x: number; y: number };
}

export function FeatureAgentTileV2({
  agentId,
  onClose,
  onMinimize,
  initialPosition = { x: 80, y: 120 },
}: FeatureAgentTileV2Props) {
  const tile = useFeatureAgentTileStore((s) => s.tiles[agentId]);
  const setTilePosition = useFeatureAgentTileStore((s) => s.setTilePosition);
  const setTileStatus = useFeatureAgentTileStore((s) => s.setTileStatus);
  const addMessage = useFeatureAgentTileStore((s) => s.addMessage);
  const updateProgress = useFeatureAgentTileStore((s) => s.updateProgress);
  const setImplementationPlan = useFeatureAgentTileStore((s) => s.setImplementationPlan);
  const setRequiredCredentials = useFeatureAgentTileStore((s) => s.setRequiredCredentials);
  const setSandboxUrl = useFeatureAgentTileStore((s) => s.setSandboxUrl);
  const setEscalationProgress = useFeatureAgentTileStore((s) => s.setEscalationProgress);

  // Local state
  const [position, setPosition] = useState({
    x: tile?.position.x ?? initialPosition.x,
    y: tile?.position.y ?? initialPosition.y,
  });
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeEdge, setResizeEdge] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [activityEvents, setActivityEvents] = useState<AgentActivityEvent[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });

  const status = tile?.status || 'implementing';
  const isActive = status !== 'complete' && status !== 'failed' && status !== 'paused';
  const statusColor = statusColors[status];
  const statusLabel = statusLabels[status];

  // Sync position with store
  useEffect(() => {
    if (tile?.position) {
      setPosition(tile.position);
    }
  }, [tile?.position]);

  // SSE connection
  useEffect(() => {
    if (!tile || tile.minimized) return;
    if (eventSourceRef.current) return;

    const apiBase = import.meta.env.VITE_API_URL || '';
    const url = `${apiBase}/api/developer-mode/feature-agent/${encodeURIComponent(agentId)}/stream`;
    const es = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = es;

    const pushMessage = (msg: StreamMessage) => {
      addMessage(agentId, msg);
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    };

    es.onmessage = (evt) => {
      try {
        const rawData = JSON.parse(evt.data);
        if (!rawData || typeof rawData !== 'object') return;

        const data = rawData as StreamMessage;
        if (typeof data.type !== 'string') return;

        // Handle status updates
        if (data.type === 'status') {
          const meta = (data.metadata || {}) as Record<string, unknown>;
          if (typeof meta.progress === 'number') {
            updateProgress(agentId, meta.progress, typeof meta.currentStep === 'string' ? meta.currentStep : undefined);
          }
          const statusStr = typeof meta.status === 'string' ? meta.status : '';
          const statusMap: Record<string, FeatureAgentTileStatus> = {
            completed: 'complete',
            complete: 'complete',
            failed: 'failed',
            paused: 'paused',
            running: 'implementing',
            implementing: 'implementing',
            verifying: 'verifying',
            pending_intent: 'intent_lock',
            intent_locked: 'intent_lock',
            awaiting_plan_approval: 'awaiting_plan_approval',
            awaiting_credentials: 'awaiting_credentials',
            awaiting_integrations: 'awaiting_integrations',
            ghost_mode: 'ghost_mode',
          };
          if (statusMap[statusStr]) {
            setTileStatus(agentId, statusMap[statusStr]);
          }
        }

        if (data.type === 'verification') setTileStatus(agentId, 'verifying');

        if (data.type === 'plan') {
          const meta = (data.metadata || {}) as Record<string, unknown>;
          const plan = meta.plan as ImplementationPlan | undefined;
          if (plan) {
            setImplementationPlan(agentId, plan);
            setRequiredCredentials(agentId, (plan.requiredCredentials || []) as RequiredCredential[]);
          }
          setTileStatus(agentId, 'awaiting_plan_approval');
        }

        if (data.type === 'credentials') {
          const meta = (data.metadata || {}) as Record<string, unknown>;
          const creds = meta.credentials as RequiredCredential[] | undefined;
          if (Array.isArray(creds)) setRequiredCredentials(agentId, creds);
          setTileStatus(agentId, 'awaiting_credentials');
        }

        const meta = (data.metadata || {}) as Record<string, unknown>;
        if (typeof meta.sandboxUrl === 'string' && meta.sandboxUrl) {
          setSandboxUrl(agentId, meta.sandboxUrl);
        }
        if (typeof meta.escalationLevel === 'number' && typeof meta.escalationAttempt === 'number') {
          setEscalationProgress(agentId, meta.escalationLevel, meta.escalationAttempt);
        }

        pushMessage({
          type: data.type,
          content: data.content,
          timestamp: data.timestamp || Date.now(),
          metadata: data.metadata,
        });

        const activityEvent = parseStreamChunkToEvent(data, agentId);
        if (activityEvent) {
          setActivityEvents((prev) => [...prev.slice(-49), activityEvent]);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    es.onerror = () => {
      pushMessage({
        type: 'status',
        content: 'Stream connection interrupted. Reconnecting...',
        timestamp: Date.now(),
      });
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [agentId, tile?.minimized, addMessage, setTileStatus, updateProgress, setImplementationPlan, setRequiredCredentials, setSandboxUrl, setEscalationProgress]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, input, textarea, [data-no-drag]')) return;
    e.preventDefault();
    setIsDragging(true);
    setIsFocused(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStart.current = { x: clientX, y: clientY, posX: position.x, posY: position.y };
  }, [position]);

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const dx = clientX - dragStart.current.x;
    const dy = clientY - dragStart.current.y;

    const newX = Math.max(0, Math.min(window.innerWidth - size.width, dragStart.current.posX + dx));
    const newY = Math.max(0, Math.min(window.innerHeight - size.height, dragStart.current.posY + dy));

    setPosition({ x: newX, y: newY });
  }, [isDragging, size]);

  const handleDragEnd = useCallback(() => {
    if (isDragging) {
      setTilePosition(agentId, position);
    }
    setIsDragging(false);
  }, [isDragging, agentId, position, setTilePosition]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, edge: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeEdge(edge);

    const clientX = e.clientX;
    const clientY = e.clientY;
    resizeStart.current = {
      x: clientX,
      y: clientY,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y,
    };
  }, [size, position]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeEdge) return;
    const dx = e.clientX - resizeStart.current.x;
    const dy = e.clientY - resizeStart.current.y;

    let newWidth = resizeStart.current.width;
    let newHeight = resizeStart.current.height;
    let newX = resizeStart.current.posX;
    let newY = resizeStart.current.posY;

    if (resizeEdge.includes('e')) newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStart.current.width + dx));
    if (resizeEdge.includes('w')) {
      const widthChange = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStart.current.width - dx)) - resizeStart.current.width;
      newWidth = resizeStart.current.width + Math.abs(widthChange);
      newX = resizeStart.current.posX - widthChange;
    }
    if (resizeEdge.includes('s')) newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, resizeStart.current.height + dy));
    if (resizeEdge.includes('n')) {
      const heightChange = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, resizeStart.current.height - dy)) - resizeStart.current.height;
      newHeight = resizeStart.current.height + Math.abs(heightChange);
      newY = resizeStart.current.posY - heightChange;
    }

    setSize({ width: newWidth, height: newHeight });
    setPosition({ x: newX, y: newY });
  }, [isResizing, resizeEdge]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeEdge(null);
    setTilePosition(agentId, position);
  }, [agentId, position, setTilePosition]);

  // Global event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Actions
  const stopAgent = async () => {
    try {
      await apiClient.post(`/api/developer-mode/feature-agent/${encodeURIComponent(agentId)}/stop`, {});
      setTileStatus(agentId, 'paused');
      addMessage(agentId, { type: 'status', content: 'Agent stopped.', timestamp: Date.now() });
      setShowStopConfirm(false);
    } catch (e) {
      addMessage(agentId, {
        type: 'result',
        content: `Stop failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
        timestamp: Date.now(),
      });
    }
  };

  const mergeToMain = async () => {
    try {
      await apiClient.post(`/api/developer-mode/feature-agent/${encodeURIComponent(agentId)}/merge`, {});
      addMessage(agentId, {
        type: 'result',
        content: 'Feature merged to main successfully!',
        timestamp: Date.now(),
        metadata: { event: 'merge_complete' },
      });
      setShowMergeModal(false);
    } catch (e) {
      addMessage(agentId, {
        type: 'result',
        content: `Merge failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
        timestamp: Date.now(),
      });
    }
  };

  const discardChanges = async () => {
    try {
      await apiClient.post(`/api/developer-mode/feature-agent/${encodeURIComponent(agentId)}/discard`, {});
      addMessage(agentId, { type: 'status', content: 'Changes discarded.', timestamp: Date.now() });
      setShowMergeModal(false);
      onClose();
    } catch (e) {
      addMessage(agentId, {
        type: 'result',
        content: `Discard failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
        timestamp: Date.now(),
      });
    }
  };

  const approvePhase = async (phaseId: string) => {
    await apiClient.post(`/api/developer-mode/feature-agent/${encodeURIComponent(agentId)}/plan/approve-phase`, { phaseId });
    addMessage(agentId, { type: 'status', content: `Phase approved: ${phaseId}`, timestamp: Date.now() });
  };

  const modifyPhase = async (phaseId: string, modifications: PhaseModification[]) => {
    await apiClient.post(`/api/developer-mode/feature-agent/${encodeURIComponent(agentId)}/plan/modify-phase`, { phaseId, modifications });
    addMessage(agentId, { type: 'status', content: `Phase modified: ${phaseId}`, timestamp: Date.now() });
  };

  const approveAll = async () => {
    await apiClient.post(`/api/developer-mode/feature-agent/${encodeURIComponent(agentId)}/plan/approve-all`, {});
    addMessage(agentId, { type: 'status', content: 'All phases approved.', timestamp: Date.now() });
  };

  const submitCredentials = async (credentials: Record<string, string>) => {
    await apiClient.post(`/api/developer-mode/feature-agent/${encodeURIComponent(agentId)}/credentials`, { credentials });
    addMessage(agentId, { type: 'status', content: 'Credentials submitted.', timestamp: Date.now() });
  };

  if (!tile || tile.minimized) return null;

  const agentName = tile.agentName || `Feature Agent ${agentId.slice(0, 6)}`;

  return (
    <>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={() => setIsFocused(true)}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          transform: `translate(${position.x}px, ${position.y}px)`,
          width: size.width,
          height: size.height,
          zIndex: isFocused ? 100 : 90,
          borderRadius: '20px',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, rgba(20, 24, 33, 0.92), rgba(12, 15, 20, 0.96))',
          border: `1px solid ${isDragging || isResizing ? statusColor : 'rgba(255, 255, 255, 0.08)'}`,
          boxShadow: isFocused
            ? `0 24px 70px rgba(0, 0, 0, 0.6), 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px ${statusColor}30, inset 0 1px 0 rgba(255, 255, 255, 0.06)`
            : '0 18px 55px rgba(0, 0, 0, 0.55), 0 6px 18px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
          backdropFilter: 'blur(14px)',
          display: 'flex',
          flexDirection: 'column',
          userSelect: isDragging || isResizing ? 'none' : 'auto',
          cursor: isDragging ? 'grabbing' : 'default',
        }}
      >
        {/* Ambient glow */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `radial-gradient(1200px 420px at 18% 0%, ${statusColor}10 0%, transparent 45%)`,
            borderRadius: 'inherit',
          }}
        />

        {/* Header */}
        <div
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          style={{
            padding: '14px 14px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01))',
            cursor: 'grab',
          }}
        >
          {/* Title area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Status indicator */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: statusColor,
                }}
              >
                <motion.div
                  animate={isActive ? { scale: [1, 1.2, 1], opacity: [1, 0.7, 1] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: statusColor,
                    boxShadow: isActive ? `0 0 8px ${statusColor}` : 'none',
                  }}
                />
                {statusLabel}
              </div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.92)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {agentName}
              </span>
            </div>
            {tile.modelName && (
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  color: 'rgba(255, 255, 255, 0.45)',
                }}
              >
                MODEL: {tile.modelName}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} data-no-drag>
            {/* Stop button */}
            {isActive && (
              <button
                onClick={() => setShowStopConfirm(true)}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '10px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#EF4444',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Stop Agent"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            )}

            {/* Minimize */}
            <button
              onClick={onMinimize}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(255, 255, 255, 0.04)',
                color: 'rgba(255, 255, 255, 0.78)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Minimize"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14" />
              </svg>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(255, 255, 255, 0.04)',
                color: 'rgba(255, 255, 255, 0.78)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Close"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '12px',
            }}
          >
            {/* Activity stream when implementing */}
            {(status === 'implementing' || status === 'verifying') && (
              <FeatureAgentActivityStream
                agentId={agentId}
                events={activityEvents}
                isActive={isActive}
                compact
              />
            )}

            {/* Plan approval view */}
            {status === 'awaiting_plan_approval' && tile.implementationPlan && (
              <ImplementationPlanView
                plan={tile.implementationPlan}
                onApprovePhase={approvePhase}
                onModifyPhase={modifyPhase}
                onApproveAll={approveAll}
              />
            )}

            {/* Credentials collection */}
            {status === 'awaiting_credentials' && (tile.requiredCredentials?.length || 0) > 0 && (
              <CredentialsCollectionView
                credentials={tile.requiredCredentials || []}
                onCredentialsSubmit={submitCredentials}
              />
            )}

            {/* Messages */}
            {tile.messages.map((m, idx) => (
              <div
                key={`${m.timestamp}-${idx}`}
                style={{
                  padding: '10px 12px',
                  marginBottom: '10px',
                  borderRadius: '12px',
                  background:
                    m.type === 'action' ? 'rgba(20, 184, 166, 0.08)' :
                    m.type === 'result' ? 'rgba(34, 197, 94, 0.08)' :
                    'rgba(245, 168, 108, 0.08)',
                  border: `1px solid ${
                    m.type === 'action' ? 'rgba(20, 184, 166, 0.2)' :
                    m.type === 'result' ? 'rgba(34, 197, 94, 0.2)' :
                    'rgba(245, 168, 108, 0.2)'
                  }`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'rgba(255, 255, 255, 0.58)',
                  }}
                >
                  <span>{m.type}</span>
                  <span style={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.42)' }}>
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    lineHeight: 1.45,
                    color: 'rgba(255, 255, 255, 0.9)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.01), rgba(0, 0, 0, 0.12))',
          }}
        >
          {/* Progress bar */}
          <div
            style={{
              height: '8px',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.06)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.max(0, Math.min(100, tile.progress ?? 0))}%`,
                background: `linear-gradient(90deg, ${statusColor}, ${statusColor}80)`,
                boxShadow: `0 0 12px ${statusColor}40`,
                transition: 'width 200ms ease',
              }}
            />
          </div>
          <div
            style={{
              marginTop: '8px',
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.42)',
            }}
          >
            {tile.currentPhase || 'Stream connected'}
          </div>

          {/* Complete actions */}
          {status === 'complete' && (
            <button
              onClick={() => setShowMergeModal(true)}
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '10px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 0 rgba(0, 0, 0, 0.15), 0 4px 12px rgba(34, 197, 94, 0.3)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Review and Merge Changes
            </button>
          )}
        </div>

        {/* Resize handles */}
        {['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'].map((edge) => (
          <div
            key={edge}
            onMouseDown={(e) => handleResizeStart(e, edge)}
            style={{
              position: 'absolute',
              ...(edge.includes('n') ? { top: 0, height: '8px' } : {}),
              ...(edge.includes('s') ? { bottom: 0, height: '8px' } : {}),
              ...(edge.includes('e') ? { right: 0, width: '8px' } : {}),
              ...(edge.includes('w') ? { left: 0, width: '8px' } : {}),
              ...(edge === 'n' || edge === 's' ? { left: '8px', right: '8px' } : {}),
              ...(edge === 'e' || edge === 'w' ? { top: '8px', bottom: '8px' } : {}),
              cursor: `${edge}-resize`,
              zIndex: 10,
            }}
          />
        ))}
      </motion.div>

      {/* Stop confirmation modal */}
      <AnimatePresence>
        {showStopConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 200,
            }}
            onClick={() => setShowStopConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '360px',
                padding: '24px',
                background: 'linear-gradient(180deg, rgba(20, 24, 33, 0.98), rgba(12, 15, 20, 0.99))',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
              }}
            >
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.92)',
                  marginBottom: '8px',
                }}
              >
                Stop Agent?
              </h3>
              <p
                style={{
                  fontSize: '13px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginBottom: '20px',
                  lineHeight: 1.5,
                }}
              >
                This will pause the agent. Work completed so far will be preserved. You can resume or discard later.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowStopConfirm(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={stopAgent}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                  }}
                >
                  Stop Agent
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Merge modal */}
      <AnimatePresence>
        {showMergeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 200,
            }}
            onClick={() => setShowMergeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '420px',
                padding: '24px',
                background: 'linear-gradient(180deg, rgba(20, 24, 33, 0.98), rgba(12, 15, 20, 0.99))',
                borderRadius: '16px',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(34, 197, 94, 0.1)',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(34, 197, 94, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <path d="M22 4L12 14.01l-3-3" />
                </svg>
              </div>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.92)',
                  marginBottom: '8px',
                }}
              >
                Feature Complete
              </h3>
              <p
                style={{
                  fontSize: '13px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginBottom: '20px',
                  lineHeight: 1.5,
                }}
              >
                {agentName} has finished. Review the changes and merge to your main branch, or discard if not needed.
              </p>

              {/* Preview link if available */}
              {tile.sandboxUrl && (
                <a
                  href={tile.sandboxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    marginBottom: '16px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: '13px',
                    textDecoration: 'none',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <path d="M15 3h6v6M10 14L21 3" />
                  </svg>
                  Preview changes in sandbox
                </a>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={discardChanges}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#EF4444',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Discard
                </button>
                <button
                  onClick={mergeToMain}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)',
                  }}
                >
                  Merge to Main
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default FeatureAgentTileV2;
