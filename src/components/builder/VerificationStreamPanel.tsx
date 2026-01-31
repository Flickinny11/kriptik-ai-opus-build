/**
 * Verification Stream Panel
 *
 * Real-time SSE streaming panel for verification swarm status and V-JEPA 2 predictions.
 * Shows:
 * - V-JEPA 2 predicted errors with confidence scores
 * - Tier 1/Tier 2 verification gate status
 * - All 6 agent statuses with last run times
 * - System health trending
 *
 * Premium liquid glass styling matching KripTik design standards.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './VerificationStreamPanel.css';

const API_URL = import.meta.env.VITE_API_URL || '';

// Types
interface AgentState {
  type: VerificationAgentType;
  status: 'idle' | 'running' | 'complete' | 'error';
  lastRun: string | null;
  lastResult: 'pass' | 'fail' | 'warning' | null;
  issues: number;
  score: number | null;
  antiSlopScore?: number | null;
}

interface PredictedError {
  id: string;
  severity: 'info' | 'warning' | 'critical' | 'imminent';
  type: string;
  confidence: number;
  predictedTimeToError: number;
  description: string;
  suggestedFix: string;
  affectedComponents: string[];
}

interface GateStatus {
  tier1: {
    status: 'pending' | 'running' | 'passed' | 'failed';
    checks: string[];
    passed: number;
    failed: number;
    running: boolean;
  };
  tier2: {
    status: 'pending' | 'running' | 'passed' | 'failed';
    agents: VerificationAgentType[];
    depths: Record<VerificationAgentType, 'minimal' | 'standard' | 'deep' | 'maximum'>;
    running: boolean;
  };
  canMerge: boolean;
  timestamp: number;
}

interface SystemHealth {
  score: number;
  status: 'healthy' | 'warning' | 'critical';
  trend: 'improving' | 'stable' | 'degrading';
  predictions: PredictedError[];
  recommendations: string[];
  timestamp: number;
}

type VerificationAgentType =
  | 'error_checker'
  | 'code_quality'
  | 'visual_verifier'
  | 'security_scanner'
  | 'placeholder_eliminator'
  | 'design_style';

interface VerificationStreamPanelProps {
  projectId: string;
  isBuilding: boolean;
  sessionId?: string;
  onPrediction?: (prediction: PredictedError) => void;
}

const AGENT_LABELS: Record<VerificationAgentType, { name: string; icon: string; color: string }> = {
  error_checker: { name: 'Error Checker', icon: '⚡', color: '#c41e3a' },
  code_quality: { name: 'Code Quality', icon: '✨', color: '#cc7722' },
  visual_verifier: { name: 'Visual Verifier', icon: '👁', color: '#6366f1' },
  security_scanner: { name: 'Security', icon: '🛡', color: '#059669' },
  placeholder_eliminator: { name: 'Placeholders', icon: '🚫', color: '#dc2626' },
  design_style: { name: 'Design Style', icon: '🎨', color: '#8b5cf6' },
};

const STORAGE_KEY = 'kriptik_verification_stream_state';

export function VerificationStreamPanel({
  projectId,
  isBuilding: _isBuilding,
  sessionId: _sessionId,
  onPrediction,
}: VerificationStreamPanelProps) {
  // Note: _isBuilding and _sessionId are available for future use
  // when we want to auto-expand during builds or track session-specific state
  void _isBuilding;
  void _sessionId;
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'predictions' | 'agents' | 'gate'>('agents');

  const [agents, setAgents] = useState<AgentState[]>([]);
  const [predictions, setPredictions] = useState<PredictedError[]>([]);
  const [gateStatus, setGateStatus] = useState<GateStatus | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const initializedRef = useRef(false);

  // Load persisted state
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_${projectId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.isExpanded === 'boolean') setIsExpanded(parsed.isExpanded);
        if (typeof parsed.isMinimized === 'boolean') setIsMinimized(parsed.isMinimized);
      }
    } catch (e) {
      console.warn('[VerificationStream] Failed to restore state:', e);
    }
  }, [projectId]);

  // Persist state
  useEffect(() => {
    if (!projectId || projectId === 'new') return;
    try {
      localStorage.setItem(
        `${STORAGE_KEY}_${projectId}`,
        JSON.stringify({ isExpanded, isMinimized })
      );
    } catch (e) {
      console.warn('[VerificationStream] Failed to persist state:', e);
    }
  }, [projectId, isExpanded, isMinimized]);

  // Fetch initial status
  const fetchStatus = useCallback(async () => {
    if (!projectId || projectId === 'new') return;

    try {
      const response = await fetch(`${API_URL}/api/verification/status/${projectId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.agents) {
          setAgents(data.agents);
        }
        if (data.gate) {
          setGateStatus({
            tier1: data.gate.tier1,
            tier2: data.gate.tier2,
            canMerge: data.gate.canMerge,
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      console.error('[VerificationStream] Failed to fetch status:', error);
    }
  }, [projectId]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // SSE Connection
  useEffect(() => {
    if (!projectId || projectId === 'new' || isMinimized) return;

    const connectToStream = () => {
      const url = `${API_URL}/api/verification/predictions/${projectId}/stream`;
      const eventSource = new EventSource(url, { withCredentials: true });
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        console.log('[VerificationStream] Connected to prediction stream');
      };

      eventSource.addEventListener('connected', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[VerificationStream] Connection confirmed:', data.message);
        } catch (error) {
          console.error('[VerificationStream] Failed to parse connected event:', error);
        }
      });

      eventSource.addEventListener('agent_status', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.agents) {
            setAgents(data.agents);
          }
        } catch (error) {
          console.error('[VerificationStream] Failed to parse agent_status:', error);
        }
      });

      eventSource.addEventListener('gate_status', (event) => {
        try {
          const data = JSON.parse(event.data);
          setGateStatus(data);
        } catch (error) {
          console.error('[VerificationStream] Failed to parse gate_status:', error);
        }
      });

      eventSource.addEventListener('prediction', (event) => {
        try {
          const data = JSON.parse(event.data);
          setPredictions((prev) => {
            // Keep only the most recent 10 predictions
            const updated = [data, ...prev].slice(0, 10);
            return updated;
          });
          if (onPrediction) {
            onPrediction(data);
          }
        } catch (error) {
          console.error('[VerificationStream] Failed to parse prediction:', error);
        }
      });

      eventSource.addEventListener('system_health', (event) => {
        try {
          const data = JSON.parse(event.data);
          setSystemHealth(data);
        } catch (error) {
          console.error('[VerificationStream] Failed to parse system_health:', error);
        }
      });

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource.close();
        // Retry after delay
        setTimeout(connectToStream, 5000);
      };
    };

    connectToStream();

    return () => {
      eventSourceRef.current?.close();
      setIsConnected(false);
    };
  }, [projectId, isMinimized, onPrediction]);

  // Format time ago
  const formatTimeAgo = (timestamp: string | null): string => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return `${Math.floor(diffSec / 3600)}h ago`;
  };

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pass':
      case 'passed':
      case 'complete':
        return 'var(--vs-success)';
      case 'fail':
      case 'failed':
      case 'error':
        return 'var(--vs-error)';
      case 'running':
        return 'var(--vs-active)';
      default:
        return 'var(--vs-text-dim)';
    }
  };

  // Minimized button
  if (isMinimized) {
    return (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        className="verification-stream__minimized"
        onClick={() => setIsMinimized(false)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="Open Verification Stream"
      >
        <VerificationStreamIcon isConnected={isConnected} />
        {predictions.length > 0 && (
          <motion.span
            className="verification-stream__badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            {predictions.length}
          </motion.span>
        )}
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className={`verification-stream ${isExpanded ? 'verification-stream--expanded' : ''}`}
    >
      {/* Header */}
      <div className="verification-stream__header">
        <div className="verification-stream__header-left">
          <VerificationStreamIcon isConnected={isConnected} />
          <span className="verification-stream__title">Verification Stream</span>
          {isConnected && (
            <motion.span
              className="verification-stream__live-badge"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              LIVE
            </motion.span>
          )}
        </div>
        <div className="verification-stream__header-right">
          <button
            className="verification-stream__btn"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '−' : '+'}
          </button>
          <button
            className="verification-stream__btn"
            onClick={() => setIsMinimized(true)}
            title="Minimize"
          >
            ×
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="verification-stream__tabs">
        <button
          className={`verification-stream__tab ${activeTab === 'agents' ? 'verification-stream__tab--active' : ''}`}
          onClick={() => setActiveTab('agents')}
        >
          Agents
        </button>
        <button
          className={`verification-stream__tab ${activeTab === 'predictions' ? 'verification-stream__tab--active' : ''}`}
          onClick={() => setActiveTab('predictions')}
        >
          Predictions
          {predictions.length > 0 && (
            <span className="verification-stream__tab-badge">{predictions.length}</span>
          )}
        </button>
        <button
          className={`verification-stream__tab ${activeTab === 'gate' ? 'verification-stream__tab--active' : ''}`}
          onClick={() => setActiveTab('gate')}
        >
          Gate
        </button>
      </div>

      {/* Content */}
      <div className="verification-stream__content">
        <AnimatePresence mode="wait">
          {activeTab === 'agents' && (
            <motion.div
              key="agents"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="verification-stream__agents"
            >
              {agents.length === 0 ? (
                <div className="verification-stream__empty">
                  No agent data yet. Start a build to see verification status.
                </div>
              ) : (
                <div className="verification-stream__agent-grid">
                  {agents.map((agent) => {
                    const config = AGENT_LABELS[agent.type];
                    return (
                      <div
                        key={agent.type}
                        className={`verification-stream__agent ${agent.status === 'running' ? 'verification-stream__agent--running' : ''}`}
                      >
                        <div className="verification-stream__agent-icon" style={{ color: config.color }}>
                          {config.icon}
                        </div>
                        <div className="verification-stream__agent-info">
                          <span className="verification-stream__agent-name">{config.name}</span>
                          <span
                            className="verification-stream__agent-status"
                            style={{ color: getStatusColor(agent.lastResult || agent.status) }}
                          >
                            {agent.lastResult === 'pass' ? '✓' : agent.lastResult === 'fail' ? '✗' : '○'}{' '}
                            {formatTimeAgo(agent.lastRun)}
                          </span>
                        </div>
                        {agent.score !== null && (
                          <div className="verification-stream__agent-score">
                            {agent.score}/100
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* System Health */}
              {systemHealth && (
                <div className="verification-stream__health">
                  <div className="verification-stream__health-header">
                    <span>System Health</span>
                    <span
                      className="verification-stream__health-score"
                      style={{
                        color:
                          systemHealth.score >= 85
                            ? 'var(--vs-success)'
                            : systemHealth.score >= 70
                              ? 'var(--vs-warning)'
                              : 'var(--vs-error)',
                      }}
                    >
                      {systemHealth.score}/100
                    </span>
                  </div>
                  <div className="verification-stream__health-bar">
                    <motion.div
                      className="verification-stream__health-bar-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${systemHealth.score}%` }}
                      style={{
                        backgroundColor:
                          systemHealth.score >= 85
                            ? 'var(--vs-success)'
                            : systemHealth.score >= 70
                              ? 'var(--vs-warning)'
                              : 'var(--vs-error)',
                      }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'predictions' && (
            <motion.div
              key="predictions"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="verification-stream__predictions"
            >
              {predictions.length === 0 ? (
                <div className="verification-stream__empty">
                  <div className="verification-stream__empty-icon">🔮</div>
                  <div>No predictions yet.</div>
                  <div className="verification-stream__empty-hint">
                    V-JEPA 2 will analyze your app and predict potential issues.
                  </div>
                </div>
              ) : (
                <div className="verification-stream__prediction-list">
                  {predictions.map((pred) => (
                    <motion.div
                      key={pred.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`verification-stream__prediction verification-stream__prediction--${pred.severity}`}
                    >
                      <div className="verification-stream__prediction-header">
                        <span className="verification-stream__prediction-type">{pred.type}</span>
                        <span className="verification-stream__prediction-confidence">
                          {Math.round(pred.confidence * 100)}% confidence
                        </span>
                      </div>
                      <div className="verification-stream__prediction-desc">{pred.description}</div>
                      {pred.suggestedFix && (
                        <div className="verification-stream__prediction-fix">
                          💡 {pred.suggestedFix}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'gate' && (
            <motion.div
              key="gate"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="verification-stream__gate"
            >
              {!gateStatus ? (
                <div className="verification-stream__empty">
                  No gate status yet. Start a build to see verification gates.
                </div>
              ) : (
                <>
                  {/* Tier 1 */}
                  <div className="verification-stream__tier">
                    <div className="verification-stream__tier-header">
                      <span className="verification-stream__tier-title">TIER 1: Instant Checks</span>
                      <span
                        className="verification-stream__tier-status"
                        style={{ color: getStatusColor(gateStatus.tier1.status) }}
                      >
                        {gateStatus.tier1.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="verification-stream__tier-checks">
                      {gateStatus.tier1.checks.map((check) => (
                        <span key={check} className="verification-stream__tier-check">
                          {check}
                        </span>
                      ))}
                    </div>
                    <div className="verification-stream__tier-stats">
                      <span className="verification-stream__stat verification-stream__stat--pass">
                        ✓ {gateStatus.tier1.passed}
                      </span>
                      <span className="verification-stream__stat verification-stream__stat--fail">
                        ✗ {gateStatus.tier1.failed}
                      </span>
                    </div>
                  </div>

                  {/* Tier 2 */}
                  <div className="verification-stream__tier">
                    <div className="verification-stream__tier-header">
                      <span className="verification-stream__tier-title">TIER 2: Deep Verification</span>
                      <span
                        className="verification-stream__tier-status"
                        style={{ color: getStatusColor(gateStatus.tier2.status) }}
                      >
                        {gateStatus.tier2.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="verification-stream__tier-agents">
                      {gateStatus.tier2.agents.map((agentType) => (
                        <div key={agentType} className="verification-stream__tier-agent">
                          <span>{AGENT_LABELS[agentType].icon}</span>
                          <span className="verification-stream__tier-agent-depth">
                            {gateStatus.tier2.depths[agentType]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Merge Status */}
                  <div
                    className={`verification-stream__merge ${gateStatus.canMerge ? 'verification-stream__merge--allowed' : 'verification-stream__merge--blocked'}`}
                  >
                    <span className="verification-stream__merge-icon">
                      {gateStatus.canMerge ? '✓' : '⚠'}
                    </span>
                    <span className="verification-stream__merge-text">
                      {gateStatus.canMerge ? 'Ready to Merge' : 'Merge Blocked'}
                    </span>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Icon component with connection status
function VerificationStreamIcon({ isConnected }: { isConnected: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="verification-stream__icon">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1" fill="none" />
      <circle cx="12" cy="12" r="2" fill={isConnected ? '#1a8754' : '#707070'} />
      {isConnected && (
        <motion.circle
          cx="12"
          cy="12"
          r="4"
          stroke="#1a8754"
          strokeWidth="1"
          fill="none"
          initial={{ scale: 1, opacity: 1 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </svg>
  );
}

export default VerificationStreamPanel;
