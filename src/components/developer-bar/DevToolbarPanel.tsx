/**
 * Developer Toolbar Panel - Premium Resizable Panels
 *
 * Features:
 * - Resizable from all edges (like normal windows)
 * - Premium glass styling matching Feature Agents
 * - Real-time data visualization
 * - 3D depth with layered shadows
 * - Smooth animations
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, useMotionValue, PanInfo } from 'framer-motion';
import { DevToolbarIcon, type ToolbarIconName } from './DevToolbarIcons';
import { FeatureAgentCommandCenter } from './panels/FeatureAgentCommandCenter';
import { useParams } from 'react-router-dom';
import './dev-toolbar-panel.css';

interface DevToolbarPanelProps {
  featureId: string;
  title: string;
  icon: ToolbarIconName;
  barPosition: { x: number; y: number };
  barOrientation: 'vertical' | 'horizontal';
  onClose: () => void;
  isActive: boolean;
  stackIndex?: number;
}

// Panel size constraints
const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const MIN_HEIGHT = 300;
const MAX_HEIGHT = 700;

// Resize edge types
type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null;

export function DevToolbarPanel({
  featureId,
  title,
  icon,
  barPosition,
  barOrientation,
  onClose,
  isActive,
  stackIndex = 0,
}: DevToolbarPanelProps) {
  // Default sizes based on panel type
  const getDefaultSize = () => {
    switch (featureId) {
      case 'feature-agents':
      case 'ai-lab':
        return { width: 560, height: 600 };
      case 'health':
      case 'quality':
        return { width: 420, height: 480 };
      default:
        return { width: 380, height: 420 };
    }
  };

  const [size, setSize] = useState(getDefaultSize());
  const [resizing, setResizing] = useState<ResizeEdge>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const startPos = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Calculate initial position with gap from toolbar
  const getInitialPosition = () => {
    const gap = 20; // Gap between toolbar and panel
    const stackOffset = stackIndex * 30;

    if (barOrientation === 'vertical') {
      return {
        x: barPosition.x + 70 + gap + stackOffset,
        y: Math.max(gap, barPosition.y - 50 + stackOffset)
      };
    } else {
      return {
        x: Math.max(gap, barPosition.x - 50 + stackOffset),
        y: barPosition.y + 70 + gap + stackOffset
      };
    }
  };

  const initialPos = getInitialPosition();
  const x = useMotionValue(initialPos.x);
  const y = useMotionValue(initialPos.y);

  // Resize handlers
  const handleResizeStart = useCallback((edge: ResizeEdge) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(edge);
    startPos.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    };
  }, [size]);

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startPos.current.x;
      const deltaY = e.clientY - startPos.current.y;

      let newWidth = startPos.current.width;
      let newHeight = startPos.current.height;

      // Calculate new size based on edge being dragged
      if (resizing.includes('e')) {
        newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startPos.current.width + deltaX));
      }
      if (resizing.includes('w')) {
        newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startPos.current.width - deltaX));
      }
      if (resizing.includes('s')) {
        newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startPos.current.height + deltaY));
      }
      if (resizing.includes('n')) {
        newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startPos.current.height - deltaY));
      }

      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, _info: PanInfo) => {
    // Position updated automatically by framer-motion
  };

  // Get panel content based on feature
  const renderContent = () => {
    switch (featureId) {
      case 'feature-agents':
        return <FeatureAgentsPanelContent />;
      case 'health':
        return <HealthPanelContent />;
      case 'database':
        return <DatabasePanelContent />;
      case 'memory':
        return <MemoryPanelContent />;
      case 'dna':
        return <DNAPanelContent />;
      case 'ai-lab':
        return <AILabPanelContent />;
      case 'quality':
        return <QualityPanelContent />;
      case 'voice':
        return <VoicePanelContent />;
      case 'self-heal':
        return <SelfHealPanelContent />;
      case 'rules':
        return <RulesPanelContent />;
      case 'clone-mode':
        return <CloneModePanelContent />;
      case 'security':
        return <SecurityPanelContent />;
      case 'multiplayer':
        return <MultiplayerPanelContent />;
      case 'permissions':
        return <PermissionsPanelContent />;
      default:
        return <div className="panel-placeholder">Panel content loading...</div>;
    }
  };

  return (
    <motion.div
      ref={panelRef}
      className={`dev-toolbar-panel ${resizing ? 'dev-toolbar-panel--resizing' : ''}`}
      style={{
        x,
        y,
        width: size.width,
        height: size.height,
      }}
      drag={!resizing}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{
        duration: 0.4,
        ease: [0.23, 1, 0.32, 1],
        delay: stackIndex * 0.05
      }}
    >
      {/* Glass base */}
      <div className="dev-toolbar-panel__glass">
        {/* Layered shadows */}
        <div className="dev-toolbar-panel__shadow-1" />
        <div className="dev-toolbar-panel__shadow-2" />
        <div className="dev-toolbar-panel__shadow-3" />

        {/* Frost */}
        <div className="dev-toolbar-panel__frost" />

        {/* 3D edges */}
        <div className="dev-toolbar-panel__edge-top" />
        <div className="dev-toolbar-panel__edge-left" />
        <div className="dev-toolbar-panel__edge-right" />
        <div className="dev-toolbar-panel__edge-bottom" />

        {/* Header */}
        <div className="dev-toolbar-panel__header">
          <div className="dev-toolbar-panel__header-left">
            <div className={`dev-toolbar-panel__icon ${isActive ? 'dev-toolbar-panel__icon--active' : ''}`}>
              <DevToolbarIcon name={icon} size={20} isActive={isActive} />
            </div>
            <div className="dev-toolbar-panel__title-container">
              <span className="dev-toolbar-panel__title">{title}</span>
              <span className={`dev-toolbar-panel__status ${isActive ? 'dev-toolbar-panel__status--active' : ''}`}>
                {isActive ? 'Active' : 'Idle'}
              </span>
            </div>
          </div>

          <div className="dev-toolbar-panel__header-right">
            <button className="dev-toolbar-panel__close" onClick={onClose}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="dev-toolbar-panel__content">
          {renderContent()}
        </div>

        {/* Resize handles - all edges */}
        <div className="dev-toolbar-panel__resize-n" onMouseDown={handleResizeStart('n')} />
        <div className="dev-toolbar-panel__resize-s" onMouseDown={handleResizeStart('s')} />
        <div className="dev-toolbar-panel__resize-e" onMouseDown={handleResizeStart('e')} />
        <div className="dev-toolbar-panel__resize-w" onMouseDown={handleResizeStart('w')} />
        <div className="dev-toolbar-panel__resize-ne" onMouseDown={handleResizeStart('ne')} />
        <div className="dev-toolbar-panel__resize-nw" onMouseDown={handleResizeStart('nw')} />
        <div className="dev-toolbar-panel__resize-se" onMouseDown={handleResizeStart('se')} />
        <div className="dev-toolbar-panel__resize-sw" onMouseDown={handleResizeStart('sw')} />
      </div>
    </motion.div>
  );
}

// ============================================================================
// Panel Content Components - Premium Real-time Visualizations
// ============================================================================

function FeatureAgentsPanelContent() {
  const { projectId } = useParams();
  return <FeatureAgentCommandCenter projectId={projectId || undefined} />;
}

function HealthPanelContent() {
  const [health, setHealth] = useState({
    cpu: 45,
    memory: 62,
    latency: 124,
    uptime: '99.9%',
    requests: 1247,
    errors: 3
  });

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setHealth(prev => ({
        ...prev,
        cpu: Math.min(100, Math.max(20, prev.cpu + (Math.random() - 0.5) * 10)),
        memory: Math.min(100, Math.max(30, prev.memory + (Math.random() - 0.5) * 8)),
        latency: Math.max(50, Math.min(300, prev.latency + (Math.random() - 0.5) * 30)),
        requests: prev.requests + Math.floor(Math.random() * 5)
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="panel-health">
      {/* Overall health ring */}
      <div className="panel-health__ring-container">
        <svg viewBox="0 0 120 120" className="panel-health__ring">
          {/* Background ring */}
          <circle
            cx="60" cy="60" r="52"
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="10"
          />
          {/* Health ring */}
          <motion.circle
            cx="60" cy="60" r="52"
            fill="none"
            stroke="url(#healthGradient)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={326}
            initial={{ strokeDashoffset: 326 }}
            animate={{ strokeDashoffset: 326 - (326 * (100 - (health.cpu + health.memory) / 2) / 100) }}
            transition={{ duration: 0.8 }}
          />
          <defs>
            <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22C55E" />
              <stop offset="50%" stopColor="#EAB308" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>
          </defs>
        </svg>
        <div className="panel-health__ring-center">
          <span className="panel-health__ring-value">{Math.round(100 - (health.cpu + health.memory) / 2)}%</span>
          <span className="panel-health__ring-label">Overall</span>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="panel-health__metrics">
        <HealthMetric label="CPU" value={`${Math.round(health.cpu)}%`} percentage={health.cpu} color="#EF4444" />
        <HealthMetric label="Memory" value={`${Math.round(health.memory)}%`} percentage={health.memory} color="#F59E0B" />
        <HealthMetric label="Latency" value={`${Math.round(health.latency)}ms`} percentage={health.latency / 3} color="#3B82F6" />
        <HealthMetric label="Uptime" value={health.uptime} percentage={99.9} color="#22C55E" />
      </div>

      {/* Stats row */}
      <div className="panel-health__stats">
        <div className="panel-health__stat">
          <span className="panel-health__stat-value">{health.requests.toLocaleString()}</span>
          <span className="panel-health__stat-label">Requests</span>
        </div>
        <div className="panel-health__stat panel-health__stat--error">
          <span className="panel-health__stat-value">{health.errors}</span>
          <span className="panel-health__stat-label">Errors</span>
        </div>
      </div>
    </div>
  );
}

function HealthMetric({ label, value, percentage, color }: { label: string; value: string; percentage: number; color: string }) {
  return (
    <div className="health-metric">
      <div className="health-metric__header">
        <span className="health-metric__label">{label}</span>
        <span className="health-metric__value" style={{ color }}>{value}</span>
      </div>
      <div className="health-metric__bar">
        <motion.div
          className="health-metric__bar-fill"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, percentage)}%` }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        />
      </div>
    </div>
  );
}

function DatabasePanelContent() {
  const [tables] = useState([
    { name: 'users', rows: 15420, size: '24.5 MB' },
    { name: 'projects', rows: 892, size: '156 MB' },
    { name: 'builds', rows: 4521, size: '1.2 GB' },
    { name: 'credentials', rows: 245, size: '8.2 MB' },
  ]);

  return (
    <div className="panel-database">
      <div className="panel-database__header">
        <div className="panel-database__connection">
          <span className="panel-database__connection-dot" />
          <span>Connected to Production</span>
        </div>
      </div>

      <div className="panel-database__tables">
        {tables.map((table, i) => (
          <motion.div
            key={table.name}
            className="panel-database__table"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="panel-database__table-icon">
              <DevToolbarIcon name="database" size={16} isActive />
            </div>
            <div className="panel-database__table-info">
              <span className="panel-database__table-name">{table.name}</span>
              <span className="panel-database__table-meta">
                {table.rows.toLocaleString()} rows • {table.size}
              </span>
            </div>
            <button className="panel-database__table-action">Query</button>
          </motion.div>
        ))}
      </div>

      <div className="panel-database__actions">
        <button className="panel-database__btn">Run Migration</button>
        <button className="panel-database__btn panel-database__btn--secondary">Backup</button>
      </div>
    </div>
  );
}

function MemoryPanelContent() {
  const [patterns] = useState([
    { type: 'Component', count: 47, trend: 'up' },
    { type: 'API Routes', count: 23, trend: 'stable' },
    { type: 'Styles', count: 156, trend: 'up' },
    { type: 'Tests', count: 89, trend: 'down' },
  ]);

  return (
    <div className="panel-memory">
      <div className="panel-memory__stats-grid">
        <div className="panel-memory__stat-card">
          <span className="panel-memory__stat-value">847</span>
          <span className="panel-memory__stat-label">Total Patterns</span>
        </div>
        <div className="panel-memory__stat-card">
          <span className="panel-memory__stat-value">94%</span>
          <span className="panel-memory__stat-label">Accuracy</span>
        </div>
      </div>

      <div className="panel-memory__patterns">
        <h4 className="panel-memory__section-title">Pattern Categories</h4>
        {patterns.map((pattern, i) => (
          <motion.div
            key={pattern.type}
            className="panel-memory__pattern"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <span className="panel-memory__pattern-type">{pattern.type}</span>
            <span className="panel-memory__pattern-count">{pattern.count}</span>
            <span className={`panel-memory__pattern-trend panel-memory__pattern-trend--${pattern.trend}`}>
              {pattern.trend === 'up' ? '↑' : pattern.trend === 'down' ? '↓' : '→'}
            </span>
          </motion.div>
        ))}
      </div>

      <button className="panel-memory__btn">Refresh Memory</button>
    </div>
  );
}

function DNAPanelContent() {
  return (
    <div className="panel-dna">
      <div className="panel-dna__visual">
        {/* DNA helix visualization */}
        <svg viewBox="0 0 200 300" className="panel-dna__helix">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <g key={i}>
              {/* Left strand */}
              <motion.circle
                cx={100 + Math.sin(i * 0.8) * 40}
                cy={30 + i * 35}
                r={6}
                fill={i % 2 === 0 ? '#EF4444' : '#E5E5E5'}
                animate={{
                  cx: [100 + Math.sin(i * 0.8) * 40, 100 + Math.sin(i * 0.8 + 0.3) * 40],
                }}
                transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
              />
              {/* Right strand */}
              <motion.circle
                cx={100 - Math.sin(i * 0.8) * 40}
                cy={30 + i * 35}
                r={6}
                fill={i % 2 === 1 ? '#EF4444' : '#3A3A4A'}
                animate={{
                  cx: [100 - Math.sin(i * 0.8) * 40, 100 - Math.sin(i * 0.8 + 0.3) * 40],
                }}
                transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
              />
              {/* Bridge */}
              <motion.line
                x1={100 + Math.sin(i * 0.8) * 40}
                y1={30 + i * 35}
                x2={100 - Math.sin(i * 0.8) * 40}
                y2={30 + i * 35}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={2}
              />
            </g>
          ))}
        </svg>
      </div>

      <div className="panel-dna__info">
        <div className="panel-dna__info-item">
          <span className="panel-dna__info-label">App Type</span>
          <span className="panel-dna__info-value">AI-Powered SaaS</span>
        </div>
        <div className="panel-dna__info-item">
          <span className="panel-dna__info-label">Architecture</span>
          <span className="panel-dna__info-value">Microservices</span>
        </div>
        <div className="panel-dna__info-item">
          <span className="panel-dna__info-label">Stack</span>
          <span className="panel-dna__info-value">React + Node + PostgreSQL</span>
        </div>
      </div>
    </div>
  );
}

function AILabPanelContent() {
  const [experiments] = useState([
    { name: 'Prompt Optimization', status: 'running', progress: 67 },
    { name: 'Model Fine-tuning', status: 'queued', progress: 0 },
    { name: 'A/B Test: UI Gen', status: 'complete', progress: 100 },
  ]);

  return (
    <div className="panel-ai-lab">
      <div className="panel-ai-lab__experiments">
        {experiments.map((exp, i) => (
          <motion.div
            key={exp.name}
            className={`panel-ai-lab__experiment panel-ai-lab__experiment--${exp.status}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="panel-ai-lab__experiment-header">
              <span className="panel-ai-lab__experiment-name">{exp.name}</span>
              <span className={`panel-ai-lab__experiment-status panel-ai-lab__experiment-status--${exp.status}`}>
                {exp.status}
              </span>
            </div>
            {exp.status !== 'queued' && (
              <div className="panel-ai-lab__experiment-progress">
                <motion.div
                  className="panel-ai-lab__experiment-progress-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${exp.progress}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <button className="panel-ai-lab__btn">New Experiment</button>
    </div>
  );
}

function QualityPanelContent() {
  const [scores] = useState({
    code: 87,
    security: 95,
    performance: 78,
    accessibility: 92,
  });

  return (
    <div className="panel-quality">
      {/* Overall score ring */}
      <div className="panel-quality__ring-container">
        <svg viewBox="0 0 100 100" className="panel-quality__ring">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <motion.circle
            cx="50" cy="50" r="42"
            fill="none"
            stroke="url(#qualityGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={264}
            initial={{ strokeDashoffset: 264 }}
            animate={{ strokeDashoffset: 264 - (264 * 88) / 100 }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
          <defs>
            <linearGradient id="qualityGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22C55E" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>
          </defs>
        </svg>
        <div className="panel-quality__ring-center">
          <span className="panel-quality__ring-value">88</span>
          <span className="panel-quality__ring-label">Overall</span>
        </div>
      </div>

      {/* Score bars */}
      <div className="panel-quality__scores">
        {Object.entries(scores).map(([key, value]) => (
          <div key={key} className="panel-quality__score">
            <div className="panel-quality__score-header">
              <span className="panel-quality__score-label">{key}</span>
              <span className="panel-quality__score-value">{value}%</span>
            </div>
            <div className="panel-quality__score-bar">
              <motion.div
                className="panel-quality__score-bar-fill"
                style={{
                  background: value >= 90 ? '#22C55E' : value >= 70 ? '#EAB308' : '#EF4444'
                }}
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
              />
            </div>
          </div>
        ))}
      </div>

      <button className="panel-quality__btn">Run Full Analysis</button>
    </div>
  );
}

function VoicePanelContent() {
  const [isListening, setIsListening] = useState(false);

  return (
    <div className="panel-voice">
      <div className="panel-voice__visualizer">
        <motion.div
          className={`panel-voice__circle ${isListening ? 'panel-voice__circle--active' : ''}`}
          animate={{
            scale: isListening ? [1, 1.2, 1] : 1,
            boxShadow: isListening
              ? ['0 0 0 0 rgba(239,68,68,0.4)', '0 0 0 20px rgba(239,68,68,0)', '0 0 0 0 rgba(239,68,68,0.4)']
              : '0 0 0 0 rgba(239,68,68,0)'
          }}
          transition={{ duration: 1.5, repeat: isListening ? Infinity : 0 }}
        >
          <DevToolbarIcon name="voice" size={32} isActive={isListening} />
        </motion.div>
      </div>

      <button
        className={`panel-voice__btn ${isListening ? 'panel-voice__btn--active' : ''}`}
        onClick={() => setIsListening(!isListening)}
      >
        {isListening ? 'Stop Listening' : 'Start Voice Input'}
      </button>

      <div className="panel-voice__commands">
        <h4>Recent Commands</h4>
        <ul>
          <li>"Create a new component"</li>
          <li>"Run the tests"</li>
          <li>"Deploy to staging"</li>
        </ul>
      </div>
    </div>
  );
}

function SelfHealPanelContent() {
  const [issues] = useState([
    { type: 'error', message: 'Type mismatch in auth.ts', fixed: true },
    { type: 'warning', message: 'Unused import in utils.ts', fixed: false },
    { type: 'error', message: 'Missing dependency', fixed: true },
  ]);

  return (
    <div className="panel-self-heal">
      <div className="panel-self-heal__summary">
        <div className="panel-self-heal__stat">
          <span className="panel-self-heal__stat-value">12</span>
          <span className="panel-self-heal__stat-label">Auto-fixed today</span>
        </div>
        <div className="panel-self-heal__stat">
          <span className="panel-self-heal__stat-value">98%</span>
          <span className="panel-self-heal__stat-label">Success rate</span>
        </div>
      </div>

      <div className="panel-self-heal__issues">
        {issues.map((issue, i) => (
          <motion.div
            key={i}
            className={`panel-self-heal__issue panel-self-heal__issue--${issue.type}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <span className="panel-self-heal__issue-message">{issue.message}</span>
            <span className={`panel-self-heal__issue-status ${issue.fixed ? 'panel-self-heal__issue-status--fixed' : ''}`}>
              {issue.fixed ? 'Fixed' : 'Pending'}
            </span>
          </motion.div>
        ))}
      </div>

      <button className="panel-self-heal__btn">Heal All Issues</button>
    </div>
  );
}

function RulesPanelContent() {
  const [rules] = useState([
    { name: 'Auth Required', active: true },
    { name: 'Rate Limiting', active: true },
    { name: 'Data Validation', active: true },
    { name: 'Audit Logging', active: false },
  ]);

  return (
    <div className="panel-rules">
      <div className="panel-rules__list">
        {rules.map((rule, i) => (
          <motion.div
            key={rule.name}
            className="panel-rules__rule"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <span className="panel-rules__rule-name">{rule.name}</span>
            <div className={`panel-rules__toggle ${rule.active ? 'panel-rules__toggle--active' : ''}`}>
              <div className="panel-rules__toggle-knob" />
            </div>
          </motion.div>
        ))}
      </div>

      <button className="panel-rules__btn">Add New Rule</button>
    </div>
  );
}

function CloneModePanelContent() {
  return (
    <div className="panel-clone-mode">
      <div className="panel-clone-mode__visual">
        <motion.div
          className="panel-clone-mode__layer panel-clone-mode__layer--back"
          animate={{ x: [0, 8, 0], y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.div className="panel-clone-mode__layer panel-clone-mode__layer--front">
          <DevToolbarIcon name="cloneMode" size={40} isActive />
        </motion.div>
      </div>

      <div className="panel-clone-mode__options">
        <button className="panel-clone-mode__btn">Clone Project</button>
        <button className="panel-clone-mode__btn panel-clone-mode__btn--secondary">Create Branch</button>
        <button className="panel-clone-mode__btn panel-clone-mode__btn--secondary">Duplicate Feature</button>
      </div>
    </div>
  );
}

function SecurityPanelContent() {
  const [scans] = useState({
    vulnerabilities: 0,
    warnings: 3,
    lastScan: '2 min ago',
    score: 98
  });

  return (
    <div className="panel-security">
      <div className="panel-security__shield">
        <motion.div
          className="panel-security__shield-icon"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <DevToolbarIcon name="security" size={48} isActive />
        </motion.div>
        <span className="panel-security__score">{scans.score}%</span>
        <span className="panel-security__score-label">Security Score</span>
      </div>

      <div className="panel-security__stats">
        <div className="panel-security__stat panel-security__stat--safe">
          <span className="panel-security__stat-value">{scans.vulnerabilities}</span>
          <span className="panel-security__stat-label">Vulnerabilities</span>
        </div>
        <div className="panel-security__stat panel-security__stat--warning">
          <span className="panel-security__stat-value">{scans.warnings}</span>
          <span className="panel-security__stat-label">Warnings</span>
        </div>
      </div>

      <div className="panel-security__last-scan">
        Last scan: {scans.lastScan}
      </div>

      <button className="panel-security__btn">Run Security Scan</button>
    </div>
  );
}

function MultiplayerPanelContent() {
  const [collaborators] = useState([
    { name: 'John D.', status: 'active', avatar: 'JD' },
    { name: 'Sarah M.', status: 'idle', avatar: 'SM' },
    { name: 'Alex K.', status: 'active', avatar: 'AK' },
  ]);

  return (
    <div className="panel-multiplayer">
      <div className="panel-multiplayer__collaborators">
        {collaborators.map((user, i) => (
          <motion.div
            key={user.name}
            className="panel-multiplayer__user"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className={`panel-multiplayer__avatar ${user.status === 'active' ? 'panel-multiplayer__avatar--active' : ''}`}>
              {user.avatar}
            </div>
            <div className="panel-multiplayer__user-info">
              <span className="panel-multiplayer__user-name">{user.name}</span>
              <span className={`panel-multiplayer__user-status panel-multiplayer__user-status--${user.status}`}>
                {user.status}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <button className="panel-multiplayer__btn">Invite Collaborator</button>
    </div>
  );
}

function PermissionsPanelContent() {
  const [roles] = useState([
    { name: 'Admin', count: 2, color: '#EF4444' },
    { name: 'Developer', count: 5, color: '#3B82F6' },
    { name: 'Viewer', count: 12, color: '#22C55E' },
  ]);

  return (
    <div className="panel-permissions">
      <div className="panel-permissions__roles">
        {roles.map((role, i) => (
          <motion.div
            key={role.name}
            className="panel-permissions__role"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="panel-permissions__role-indicator" style={{ background: role.color }} />
            <span className="panel-permissions__role-name">{role.name}</span>
            <span className="panel-permissions__role-count">{role.count}</span>
          </motion.div>
        ))}
      </div>

      <button className="panel-permissions__btn">Manage Roles</button>
    </div>
  );
}

export default DevToolbarPanel;
