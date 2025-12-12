import { useEffect, useMemo, useRef } from 'react';
import { motion, useMotionValue, type PanInfo } from 'framer-motion';
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
import './feature-agent-tile.css';

interface FeatureAgentTileProps {
  agentId: string;
  onClose: () => void;
  onMinimize: () => void;
  initialPosition?: { x: number; y: number };
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function labelForStatus(status: FeatureAgentTileStatus): string {
  switch (status) {
    case 'intent_lock':
      return 'INTENT';
    case 'awaiting_plan_approval':
      return 'PLAN';
    case 'awaiting_credentials':
      return 'CREDENTIALS';
    case 'implementing':
      return 'IMPLEMENTING';
    case 'verifying':
      return 'VERIFYING';
    case 'complete':
      return 'COMPLETE';
    case 'failed':
      return 'FAILED';
    case 'paused':
      return 'PAUSED';
    case 'ghost_mode':
      return 'GHOST';
  }
}

function normalizeMessageType(msgType: StreamMessage['type']): 'thinking' | 'action' | 'result' {
  if (msgType === 'action') return 'action';
  if (msgType === 'result') return 'result';
  return 'thinking';
}

function svgX() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function svgMinimize() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 7H12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function svgStop() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function FeatureAgentTile({ agentId, onClose, onMinimize, initialPosition }: FeatureAgentTileProps) {
  const tile = useFeatureAgentTileStore((s) => s.tiles[agentId]);
  const setTilePosition = useFeatureAgentTileStore((s) => s.setTilePosition);
  const setTileStatus = useFeatureAgentTileStore((s) => s.setTileStatus);
  const addMessage = useFeatureAgentTileStore((s) => s.addMessage);
  const updateProgress = useFeatureAgentTileStore((s) => s.updateProgress);
  const setImplementationPlan = useFeatureAgentTileStore((s) => s.setImplementationPlan);
  const setRequiredCredentials = useFeatureAgentTileStore((s) => s.setRequiredCredentials);

  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const x = useMotionValue(tile?.position.x ?? initialPosition?.x ?? 80);
  const y = useMotionValue(tile?.position.y ?? initialPosition?.y ?? 120);

  const headerMeta = useMemo(() => {
    const name = tile?.agentName || `Feature Agent ${agentId.slice(0, 6)}`;
    const model = tile?.modelName ? `MODEL · ${tile.modelName}` : undefined;
    return { name, model };
  }, [tile?.agentName, tile?.modelName, agentId]);

  const statusLabel = useMemo(() => labelForStatus(tile?.status || 'implementing'), [tile?.status]);
  const isActive = tile?.status !== 'complete' && tile?.status !== 'failed';

  useEffect(() => {
    if (!tile) return;
    if (tile.minimized) return;

    // Connect only once per visible tile
    if (eventSourceRef.current) return;

    const url = `/api/developer-mode/feature-agent/${encodeURIComponent(agentId)}/stream`;
    const es = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = es;

    const push = (msg: StreamMessage) => {
      addMessage(agentId, msg);
      // keep view pinned to bottom for active streams
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
      });
    };

    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as StreamMessage;
        if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;

        // Lightweight state inference from stream messages
        if (data.type === 'status') {
          const meta = (data.metadata || {}) as Record<string, unknown>;
          const progress = typeof meta.progress === 'number' ? meta.progress : undefined;
          const phase = typeof meta.currentStep === 'string' ? meta.currentStep : undefined;
          if (typeof progress === 'number') updateProgress(agentId, progress, phase);

          const nextStatus = (() => {
            const s = typeof meta.status === 'string' ? meta.status : '';
            if (s === 'completed') return 'complete';
            if (s === 'failed') return 'failed';
            if (s === 'paused') return 'paused';
            if (s === 'running') return 'implementing';
            if (s === 'pending_intent' || s === 'intent_locked') return 'intent_lock';
            if (s === 'awaiting_plan_approval') return 'awaiting_plan_approval';
            if (s === 'awaiting_credentials') return 'awaiting_credentials';
            if (s === 'implementing') return 'implementing';
            if (s === 'verifying') return 'verifying';
            if (s === 'complete') return 'complete';
            if (s === 'ghost_mode') return 'ghost_mode';
            return undefined;
          })();
          if (nextStatus) setTileStatus(agentId, nextStatus);
        }

        if (data.type === 'verification') setTileStatus(agentId, 'verifying');
        if (data.type === 'plan') {
          const meta = (data.metadata || {}) as Record<string, unknown>;
          const plan = meta.plan as ImplementationPlan | undefined;
          if (plan && typeof plan === 'object') {
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

        push({
          type: data.type,
          content: data.content,
          timestamp: data.timestamp || Date.now(),
          metadata: data.metadata,
        });
      } catch {
        // Ignore malformed SSE messages
      }
    };

    es.onerror = () => {
      // Preserve tile; user can keep it open while the stream reconnects.
      push({
        type: 'status',
        content: 'Stream connection interrupted. Reconnecting…',
        timestamp: Date.now(),
      });
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [agentId, tile, addMessage, setTileStatus, updateProgress]);

  // Close SSE when minimized to reduce background load.
  useEffect(() => {
    if (!tile) return;
    if (!tile.minimized) return;
    if (!eventSourceRef.current) return;
    eventSourceRef.current.close();
    eventSourceRef.current = null;
  }, [tile?.minimized, tile]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const next = {
      x: (tile?.position.x ?? initialPosition?.x ?? 80) + info.offset.x,
      y: (tile?.position.y ?? initialPosition?.y ?? 120) + info.offset.y,
    };
    setTilePosition(agentId, next);
  };

  const stopAgent = async () => {
    try {
      // Prefer Feature Agent stop if available, fall back to Developer Mode agent stop.
      try {
        await apiClient.post(`/api/developer-mode/feature-agent/${encodeURIComponent(agentId)}/stop`, {});
      } catch {
        await apiClient.post(`/api/developer-mode/agents/${encodeURIComponent(agentId)}/stop`, {});
      }
      setTileStatus(agentId, 'paused');
      addMessage(agentId, { type: 'status', content: 'Stop requested.', timestamp: Date.now() });
    } catch (e) {
      addMessage(agentId, {
        type: 'result',
        content: `Stop failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
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
    addMessage(agentId, { type: 'status', content: `Phase modification submitted: ${phaseId}`, timestamp: Date.now() });
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

  return (
    <motion.div
      className="fa-tile"
      style={{ x, y }}
      drag
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      initial={{ opacity: 0, scale: 0.96, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
    >
      <div className="fa-tile__edge" />
      <div className="fa-tile__noise" />

      <div className="fa-tile__header">
        <div className="fa-tile__title">
          <div className="fa-tile__title-row">
            <div className="fa-tile__status" title={statusLabel}>
              <span className={`fa-tile__status-dot ${isActive ? 'fa-tile__status-dot--active' : ''}`} />
              <span>{statusLabel}</span>
            </div>
            <span className="fa-tile__name">{headerMeta.name}</span>
          </div>
          {headerMeta.model && <div className="fa-tile__meta">{headerMeta.model}</div>}
        </div>

        <div className="fa-tile__actions">
          <button className="fa-tile__iconbtn fa-tile__iconbtn--danger" onClick={stopAgent} title="Stop">
            {svgStop()}
          </button>
          <button className="fa-tile__iconbtn" onClick={onMinimize} title="Minimize">
            {svgMinimize()}
          </button>
          <button className="fa-tile__iconbtn" onClick={onClose} title="Close">
            {svgX()}
          </button>
        </div>
      </div>

      <div className="fa-tile__body">
        <div className="fa-tile__scroll" ref={scrollRef}>
          {tile.status === 'awaiting_plan_approval' && tile.implementationPlan && (
            <ImplementationPlanView
              plan={tile.implementationPlan}
              onApprovePhase={approvePhase}
              onModifyPhase={modifyPhase}
              onApproveAll={approveAll}
            />
          )}
          {tile.status === 'awaiting_credentials' && (tile.requiredCredentials?.length || 0) > 0 && (
            <CredentialsCollectionView
              credentials={tile.requiredCredentials || []}
              onCredentialsSubmit={submitCredentials}
            />
          )}

          {tile.messages.map((m, idx) => {
            const kind = normalizeMessageType(m.type);
            return (
              <div key={`${m.timestamp}-${idx}`} className={`fa-tile__msg fa-tile__msg--${kind}`}>
                <div className="fa-tile__msg-head">
                  <span className="fa-tile__msg-type">{m.type}</span>
                  <span className="fa-tile__msg-time">{formatTime(m.timestamp)}</span>
                </div>
                <div className="fa-tile__msg-body">{m.content}</div>
              </div>
            );
          })}
        </div>

        <div className="fa-tile__footer">
          <div className="fa-tile__progress" aria-label="Progress">
            <div className="fa-tile__progress-fill" style={{ width: `${Math.max(0, Math.min(100, tile.progress ?? 0))}%` }} />
          </div>
          <div className="fa-tile__phase">
            {tile.currentPhase ? tile.currentPhase : 'Stream connected'}
          </div>
        </div>
      </div>
    </motion.div>
  );
}


