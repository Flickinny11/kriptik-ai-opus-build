/**
 * Developer Bar Panel - Premium Feature Panels
 *
 * Stunning, comprehensive panels for each feature:
 * - Real-time visualizations
 * - Full configuration options
 * - Backend integration
 * - High-tech photorealistic design
 */

import { useState, useRef } from 'react';
import { motion, useMotionValue, PanInfo } from 'framer-motion';
import { DeveloperBarIcon, type IconName } from './DeveloperBarIcons';
import { FeatureAgentCommandCenter } from './panels/FeatureAgentCommandCenter';
import { useParams } from 'react-router-dom';
import './developer-bar-panel.css';

interface DeveloperBarPanelProps {
  featureId: string;
  slideDirection: 'left' | 'right' | 'up' | 'down';
  barPosition: { x: number; y: number };
  barOrientation: 'vertical' | 'horizontal';
  onClose: () => void;
  isActive: boolean;
  stackIndex?: number;
  totalPanels?: number;
}

// Panel wrapper to inject FeatureAgentCommandCenter (full-size panel, no title bar)
const FeatureAgentCommandCenterWrapper = ({ isActive: _isActive, onClose: _onClose }: { isActive: boolean; onClose: () => void }) => {
  const { projectId } = useParams();
  return <FeatureAgentCommandCenter projectId={projectId || undefined} />;
};

const FEATURE_PANELS: Record<string, {
  title: string;
  icon: IconName;
  component: React.FC<{ isActive: boolean; onClose: () => void }>;
  fullWidth?: boolean;
}> = {
  // Premium comprehensive panels
  'feature-agent': { title: 'Feature Agent Command Center', icon: 'agents', component: FeatureAgentCommandCenterWrapper, fullWidth: true },

  // Other panels (to be upgraded to comprehensive versions)
  'memory': { title: 'Memory', icon: 'memory', component: MemoryPanel },
  'quality-check': { title: 'Quality', icon: 'qualityCheck', component: QualityCheckPanel },
  'ghost-mode': { title: 'Ghost Mode', icon: 'ghostMode', component: GhostModePanel },
  'time-machine': { title: 'Time Machine', icon: 'timeMachine', component: TimeMachinePanel },
  'deployment': { title: 'Deploy', icon: 'deployment', component: GenericPanel },
  'database': { title: 'Database', icon: 'database', component: GenericPanel },
  'workflows': { title: 'Workflows', icon: 'workflows', component: GenericPanel },
  'live-debug': { title: 'Debug', icon: 'liveDebug', component: GenericPanel },
  'live-health': { title: 'Health', icon: 'liveHealth', component: GenericPanel },
  'integrations': { title: 'Integrations', icon: 'integrations', component: GenericPanel },
  'developer-settings': { title: 'Settings', icon: 'developerSettings', component: GenericPanel },
  'market-fit': { title: 'Market Fit', icon: 'marketFit', component: GenericPanel },
  'predictive-engine': { title: 'Predictive', icon: 'predictiveEngine', component: GenericPanel },
  'ai-slop-catch': { title: 'AI-Slop', icon: 'aiSlopCatch', component: GenericPanel },
  'voice-first': { title: 'Voice', icon: 'voiceFirst', component: GenericPanel },
  'test-gen': { title: 'Test Gen', icon: 'testGen', component: GenericPanel },
  'self-heal': { title: 'Self Heal', icon: 'selfHeal', component: GenericPanel },
  'cloud-deploy': { title: 'Cloud', icon: 'cloudDeploy', component: GenericPanel },
};

export function DeveloperBarPanel({
  featureId,
  slideDirection,
  barPosition,
  barOrientation: _barOrientation,
  onClose,
  isActive,
  stackIndex = 0,
  totalPanels: _totalPanels = 1,
}: DeveloperBarPanelProps) {
  const feature = FEATURE_PANELS[featureId] || {
    title: featureId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    icon: 'agents' as IconName,
    component: GenericPanel
  };

  const { title, icon, component: PanelContent, fullWidth } = feature;

  // Larger size for comprehensive panels
  const defaultSize = fullWidth ? { width: 560, height: 620 } : { width: 360, height: 420 };
  const [panelSize, setPanelSize] = useState(defaultSize);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const getInitialPosition = () => {
    const gap = 20;
    const stackOffset = stackIndex * 24;

    switch (slideDirection) {
      case 'right':
        return { x: barPosition.x + 120 + stackOffset, y: barPosition.y + stackOffset };
      case 'left':
        return { x: barPosition.x - panelSize.width - gap - stackOffset, y: barPosition.y + stackOffset };
      case 'down':
        return { x: barPosition.x + stackOffset, y: barPosition.y + 120 + stackOffset };
      case 'up':
        return { x: barPosition.x + stackOffset, y: barPosition.y - panelSize.height - gap - stackOffset };
    }
  };

  const initialPos = getInitialPosition();
  const x = useMotionValue(initialPos.x);
  const y = useMotionValue(initialPos.y);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, _info: PanInfo) => {
    // Position updated by framer-motion
  };

  const handleResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = panelSize.width;
    const startHeight = panelSize.height;

    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(280, Math.min(700, startWidth + (e.clientX - startX)));
      const newHeight = Math.max(320, Math.min(700, startHeight + (e.clientY - startY)));
      setPanelSize({ width: newWidth, height: newHeight });
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <motion.div
      ref={panelRef}
      className={`glass-panel ${isResizing ? 'glass-panel--resizing' : ''}`}
      style={{
        x,
        y,
        width: panelSize.width,
        height: panelSize.height,
      }}
      drag
      dragMomentum={false}
      dragListener={!isResizing}
      onDragEnd={handleDragEnd}
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{
        duration: 0.5,
        ease: [0.23, 1, 0.32, 1],
        delay: stackIndex * 0.05
      }}
    >
      {/* 3D Frosted glass base */}
      <div className={`glass-panel__base ${fullWidth ? 'glass-panel__base--fullwidth' : ''}`}>
        {/* Multi-layer shadow for floating effect */}
        <div className="glass-panel__shadow" />

        {/* Primary frost layer with refraction */}
        <div className="glass-panel__frost" />

        {/* Inner frost for depth */}
        <div className="glass-panel__frost-inner" />

        {/* Specular highlight - top reflection */}
        <div className="glass-panel__specular" />

        {/* Top edge highlight */}
        <div className="glass-panel__highlight" />

        {/* Header - only show for non-fullWidth panels (fullWidth panels have their own header) */}
        {!fullWidth && (
          <div className="glass-panel__header">
            <div className="glass-panel__header-left">
              <div className={`glass-panel__icon ${isActive ? 'glass-panel__icon--active' : ''}`}>
                <DeveloperBarIcon name={icon} size={18} isActive={isActive} />
              </div>
              <span className="glass-panel__title">{title}</span>
            </div>
            <div className="glass-panel__header-right">
              <div className={`glass-panel__status ${isActive ? 'glass-panel__status--active' : ''}`}>
                <span className="glass-panel__status-dot" />
                <span>{isActive ? 'Active' : 'Idle'}</span>
              </div>
              <button className="glass-panel__close" onClick={onClose}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Close button for fullWidth panels (positioned absolutely) */}
        {fullWidth && (
          <button className="glass-panel__close glass-panel__close--floating" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {/* Content - projected onto glass */}
        <div className={`glass-panel__content ${fullWidth ? 'glass-panel__content--fullwidth' : ''}`}>
          <PanelContent isActive={isActive} onClose={onClose} />
        </div>

        {/* Resize handle */}
        <div className="glass-panel__resize" onMouseDown={handleResize}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M10 2L2 10M10 6L6 10M10 10L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

        {/* Top highlight */}
        <div className="glass-panel__highlight" />

        {/* Shadow */}
        <div className="glass-panel__shadow" />
      </div>
    </motion.div>
  );
}

// ============================================================================
// Panel Content Components
// ============================================================================

function GenericPanel({ isActive: _isActive }: { isActive: boolean; onClose: () => void }) {
  return (
    <div className="panel-generic">
      <p className="panel-generic__text">Panel content loading...</p>
    </div>
  );
}

function MemoryPanel({ isActive: _isActive }: { isActive: boolean; onClose: () => void }) {
  return (
    <div className="panel-memory">
      <div className="panel-memory__stats">
        <div className="panel-memory__stat">
          <span className="panel-memory__stat-value">24</span>
          <span className="panel-memory__stat-label">Patterns</span>
        </div>
        <div className="panel-memory__stat">
          <span className="panel-memory__stat-value">156</span>
          <span className="panel-memory__stat-label">Snippets</span>
        </div>
        <div className="panel-memory__stat">
          <span className="panel-memory__stat-value">89%</span>
          <span className="panel-memory__stat-label">Accuracy</span>
        </div>
      </div>
      <div className="panel-memory__list">
        <h5>Recent Updates</h5>
        {['Component patterns', 'API conventions', 'Error handling', 'Styling preferences'].map((item, i) => (
          <div key={i} className="panel-memory__item">
            <span className="panel-memory__item-dot" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QualityCheckPanel({ isActive: _isActive }: { isActive: boolean; onClose: () => void }) {
  const scores = { code: 87, visual: 92, security: 95, performance: 78 };

  return (
    <div className="panel-quality">
      <div className="panel-quality__ring">
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="8" />
          <motion.circle
            cx="50" cy="50" r="42" fill="none" stroke="url(#qualityGrad)" strokeWidth="8"
            strokeLinecap="round" strokeDasharray={264} strokeDashoffset={264}
            initial={{ strokeDashoffset: 264 }}
            animate={{ strokeDashoffset: 264 - (264 * 88) / 100 }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
          <defs>
            <linearGradient id="qualityGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F5A86C" />
              <stop offset="100%" stopColor="#40C870" />
            </linearGradient>
          </defs>
        </svg>
        <div className="panel-quality__ring-value">
          <span className="panel-quality__ring-number">88</span>
          <span className="panel-quality__ring-label">Overall</span>
        </div>
      </div>
      <div className="panel-quality__bars">
        {Object.entries(scores).map(([key, value]) => (
          <div key={key} className="panel-quality__bar">
            <div className="panel-quality__bar-header">
              <span>{key}</span>
              <span>{value}%</span>
            </div>
            <div className="panel-quality__bar-track">
              <motion.div
                className="panel-quality__bar-fill"
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
              />
            </div>
          </div>
        ))}
      </div>
      <button className="panel-quality__run-btn">Run Analysis</button>
    </div>
  );
}

function GhostModePanel({ isActive }: { isActive: boolean; onClose: () => void }) {
  const [config, setConfig] = useState({
    maxRuntime: 8,
    maxCredits: 50,
    autonomyLevel: 'medium',
    pauseOnError: true,
    notifyEmail: true,
  });

  return (
    <div className="panel-ghost">
      <div className="panel-ghost__status">
        <div className={`panel-ghost__indicator ${isActive ? 'panel-ghost__indicator--active' : ''}`}>
          {isActive && (
            <motion.div
              className="panel-ghost__indicator-ring"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.2, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
          <DeveloperBarIcon name="ghostMode" size={28} isActive={isActive} />
        </div>
        <span>{isActive ? 'Active' : 'Idle'}</span>
      </div>

      <div className="panel-ghost__config">
        <div className="panel-ghost__field">
          <label>Runtime (h)</label>
          <div className="panel-ghost__slider-row">
            <input
              type="range"
              min="1"
              max="24"
              value={config.maxRuntime}
              onChange={(e) => setConfig({ ...config, maxRuntime: parseInt(e.target.value) })}
            />
            <span>{config.maxRuntime}h</span>
          </div>
        </div>
        <div className="panel-ghost__field">
          <label>Credits ($)</label>
          <div className="panel-ghost__slider-row">
            <input
              type="range"
              min="10"
              max="200"
              value={config.maxCredits}
              onChange={(e) => setConfig({ ...config, maxCredits: parseInt(e.target.value) })}
            />
            <span>${config.maxCredits}</span>
          </div>
        </div>
        <div className="panel-ghost__field">
          <label>Autonomy</label>
          <select
            value={config.autonomyLevel}
            onChange={(e) => setConfig({ ...config, autonomyLevel: e.target.value })}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="panel-ghost__toggles">
          <label className="panel-ghost__toggle">
            <input
              type="checkbox"
              checked={config.pauseOnError}
              onChange={(e) => setConfig({ ...config, pauseOnError: e.target.checked })}
            />
            <span>Pause on Error</span>
          </label>
          <label className="panel-ghost__toggle">
            <input
              type="checkbox"
              checked={config.notifyEmail}
              onChange={(e) => setConfig({ ...config, notifyEmail: e.target.checked })}
            />
            <span>Email Notify</span>
          </label>
        </div>
      </div>

      <button className={`panel-ghost__start-btn ${isActive ? 'panel-ghost__start-btn--stop' : ''}`}>
        {isActive ? 'Stop Ghost Mode' : 'Start Ghost Mode'}
      </button>
    </div>
  );
}

function TimeMachinePanel({ isActive: _isActive }: { isActive: boolean; onClose: () => void }) {
  const checkpoints = [
    { id: '1', time: '5m ago', label: 'Auto-save', files: 3 },
    { id: '2', time: '15m ago', label: 'Feature done', files: 8 },
    { id: '3', time: '1h ago', label: 'Milestone', files: 15 },
  ];

  return (
    <div className="panel-timemachine">
      <div className="panel-timemachine__list">
        {checkpoints.map((cp, i) => (
          <motion.div
            key={cp.id}
            className="panel-timemachine__item"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="panel-timemachine__item-dot" />
            <div className="panel-timemachine__item-info">
              <span className="panel-timemachine__item-time">{cp.time}</span>
              <span className="panel-timemachine__item-label">{cp.label}</span>
              <span className="panel-timemachine__item-files">{cp.files} files</span>
            </div>
            <div className="panel-timemachine__item-actions">
              <button className="panel-timemachine__btn">View</button>
              <button className="panel-timemachine__btn panel-timemachine__btn--restore">Restore</button>
            </div>
          </motion.div>
        ))}
      </div>
      <button className="panel-timemachine__create-btn">Create Checkpoint</button>
    </div>
  );
}

export default DeveloperBarPanel;
