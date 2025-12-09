/**
 * Developer Bar Panel - Floating Glass Feature Visualization
 * 
 * Each panel is:
 * - Independently draggable
 * - Resizable
 * - Glass morphism styled
 * - High-quality data visualization
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, PanInfo } from 'framer-motion';
import { DeveloperBarIcon, type IconName } from './DeveloperBarIcons';
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

// Feature-specific panel content
const FEATURE_PANELS: Record<string, {
  title: string;
  icon: IconName;
  component: React.FC<{ isActive: boolean; onClose: () => void }>;
}> = {
  'agents': { title: 'Agent Command Center', icon: 'agents', component: AgentsPanel },
  'memory': { title: 'Project Memory', icon: 'memory', component: MemoryPanel },
  'quality-check': { title: 'Quality Analysis', icon: 'qualityCheck', component: QualityCheckPanel },
  'ghost-mode': { title: 'Ghost Mode Control', icon: 'ghostMode', component: GhostModePanel },
  'time-machine': { title: 'Time Machine', icon: 'timeMachine', component: TimeMachinePanel },
  'deployment': { title: 'Deployment Center', icon: 'deployment', component: DeploymentPanel },
  'database': { title: 'Database Manager', icon: 'database', component: DatabasePanel },
  'workflows': { title: 'Workflow Studio', icon: 'workflows', component: WorkflowsPanel },
  'live-debug': { title: 'Live Debug Console', icon: 'liveDebug', component: LiveDebugPanel },
  'live-health': { title: 'System Health Monitor', icon: 'liveHealth', component: LiveHealthPanel },
  'integrations': { title: 'Integrations Hub', icon: 'integrations', component: IntegrationsPanel },
  'developer-settings': { title: 'Developer Settings', icon: 'developerSettings', component: DeveloperSettingsPanel },
  'market-fit': { title: 'Market Fit Oracle', icon: 'marketFit', component: MarketFitPanel },
  'predictive-engine': { title: 'Predictive Engine', icon: 'predictiveEngine', component: PredictiveEnginePanel },
  'ai-slop-catch': { title: 'AI-Slop Detection', icon: 'aiSlopCatch', component: AISlopCatchPanel },
  'voice-first': { title: 'Voice First', icon: 'voiceFirst', component: VoiceFirstPanel },
  'test-gen': { title: 'Test Generator', icon: 'testGen', component: TestGenPanel },
  'self-heal': { title: 'Self-Healing Engine', icon: 'selfHeal', component: SelfHealPanel },
  'cloud-deploy': { title: 'Cloud Deployment', icon: 'cloudDeploy', component: CloudDeployPanel },
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
    component: DefaultPanelContent
  };

  const { title, icon, component: PanelContent } = feature;
  
  // Panel position and size state
  const [panelSize, setPanelSize] = useState({ width: 380, height: 480 });
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Calculate initial position
  const getInitialPosition = () => {
    const gap = 16;
    const stackOffset = stackIndex * 30; // Offset for stacked panels

    switch (slideDirection) {
      case 'right':
        return { x: barPosition.x + 72 + stackOffset, y: barPosition.y + stackOffset };
      case 'left':
        return { x: barPosition.x - panelSize.width - gap - stackOffset, y: barPosition.y + stackOffset };
      case 'down':
        return { x: barPosition.x + stackOffset, y: barPosition.y + 72 + stackOffset };
      case 'up':
        return { x: barPosition.x + stackOffset, y: barPosition.y - panelSize.height - gap - stackOffset };
    }
  };

  const initialPos = getInitialPosition();
  const x = useMotionValue(initialPos.x);
  const y = useMotionValue(initialPos.y);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, _info: PanInfo) => {
    // Position is automatically updated by motion
  };

  const handleResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = panelSize.width;
    const startHeight = panelSize.height;

    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(300, Math.min(800, startWidth + (e.clientX - startX)));
      const newHeight = Math.max(350, Math.min(800, startHeight + (e.clientY - startY)));
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

  const slideAnim = {
    x: slideDirection === 'right' ? [-40, 0] : slideDirection === 'left' ? [40, 0] : 0,
    y: slideDirection === 'down' ? [-40, 0] : slideDirection === 'up' ? [40, 0] : 0,
    opacity: [0, 1],
  };

  return (
    <motion.div
      ref={panelRef}
      className={`devbar-panel ${isResizing ? 'devbar-panel--resizing' : ''}`}
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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ scale: 1, ...slideAnim }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: stackIndex * 0.05 }}
    >
      {/* Glass container */}
      <div className="devbar-panel__glass">
        {/* Refraction layer */}
        <div className="devbar-panel__refraction" />
        
        {/* Header (draggable area) */}
        <div className="devbar-panel__header">
          <div className="devbar-panel__header-left">
            <div className="devbar-panel__icon">
              <DeveloperBarIcon name={icon} size={18} isActive={isActive} />
            </div>
            <span className="devbar-panel__title">{title}</span>
          </div>
          <div className="devbar-panel__header-right">
            <div className={`devbar-panel__status ${isActive ? 'devbar-panel__status--active' : ''}`}>
              <span className="devbar-panel__status-dot" />
              <span className="devbar-panel__status-text">{isActive ? 'Active' : 'Idle'}</span>
            </div>
            <button className="devbar-panel__close" onClick={onClose}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="devbar-panel__content">
          <PanelContent isActive={isActive} onClose={onClose} />
        </div>

        {/* Resize handle */}
        <div className="devbar-panel__resize" onMouseDown={handleResize}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
        </div>
        
        {/* Edge highlights */}
        <div className="devbar-panel__edge devbar-panel__edge--top" />
        <div className="devbar-panel__edge devbar-panel__edge--bottom" />
      </div>
      
      {/* Shadow */}
      <div className="devbar-panel__shadow" />
    </motion.div>
  );
}

// Default panel content for features without custom implementation
function DefaultPanelContent({ isActive: _isActive, onClose: _onClose }: { isActive: boolean; onClose: () => void }) {
  return (
    <div className="devbar-panel__default">
      <p>Panel content coming soon...</p>
    </div>
  );
}

// ============================================================================
// Feature Panel Implementations
// ============================================================================

function AgentsPanel({ isActive: _isActive, onClose: _onClose }: { isActive: boolean; onClose: () => void }) {
  const [agents, setAgents] = useState<Array<{ id: string; name: string; status: string; progress: number; task: string }>>([]);
  const [showNewAgent, setShowNewAgent] = useState(false);
  const [newAgentPrompt, setNewAgentPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-20250514');

  const models = [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', tier: 'fast' },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', tier: 'powerful' },
    { id: 'gpt-4o', name: 'GPT-4o', tier: 'balanced' },
  ];

  useEffect(() => {
    setAgents([
      { id: '1', name: 'Code Generator', status: 'working', progress: 67, task: 'Building authentication flow' },
      { id: '2', name: 'Test Writer', status: 'completed', progress: 100, task: 'Unit tests for API routes' },
      { id: '3', name: 'Bug Fixer', status: 'idle', progress: 0, task: '' },
    ]);
  }, []);

  const handleDeployAgent = async () => {
    if (!newAgentPrompt.trim()) return;
    try {
      const response = await fetch('/api/developer-mode/agents/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: newAgentPrompt, model: selectedModel }),
      });
      if (response.ok) {
        const newAgent = await response.json();
        setAgents(prev => [...prev, newAgent]);
        setNewAgentPrompt('');
        setShowNewAgent(false);
      }
    } catch (err) {
      console.error('Failed to deploy agent:', err);
    }
  };

  return (
    <div className="panel-agents">
      <div className="panel-agents__grid">
        {agents.map((agent) => (
          <motion.div
            key={agent.id}
            className={`panel-agents__tile panel-agents__tile--${agent.status}`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {agent.status === 'working' && (
              <motion.div
                className="panel-agents__tile-glow"
                animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
            <div className="panel-agents__tile-header">
              <span className="panel-agents__tile-name">{agent.name}</span>
              <span className={`panel-agents__tile-status panel-agents__tile-status--${agent.status}`}>
                {agent.status}
              </span>
            </div>
            {agent.task && <p className="panel-agents__tile-task">{agent.task}</p>}
            {agent.status === 'working' && (
              <div className="panel-agents__tile-progress">
                <div className="panel-agents__tile-progress-bar" style={{ width: `${agent.progress}%` }} />
              </div>
            )}
            {agent.status === 'completed' && (
              <div className="panel-agents__tile-actions">
                <button className="panel-agents__action-btn">View Diff</button>
                <button className="panel-agents__action-btn panel-agents__action-btn--primary">Create PR</button>
              </div>
            )}
          </motion.div>
        ))}
        
        <motion.button
          className="panel-agents__new-tile"
          onClick={() => setShowNewAgent(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>New Agent +</span>
        </motion.button>
      </div>

      <AnimatePresence>
        {showNewAgent && (
          <motion.div
            className="panel-agents__modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <div className="panel-agents__modal-content">
              <h4>Deploy New Agent</h4>
              <textarea
                className="panel-agents__input"
                placeholder="Describe what you want the agent to build..."
                value={newAgentPrompt}
                onChange={(e) => setNewAgentPrompt(e.target.value)}
              />
              <div className="panel-agents__model-selector">
                <label>Model</label>
                <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>{model.name} ({model.tier})</option>
                  ))}
                </select>
              </div>
              <div className="panel-agents__modal-actions">
                <button className="panel-agents__btn panel-agents__btn--secondary" onClick={() => setShowNewAgent(false)}>Cancel</button>
                <button className="panel-agents__btn panel-agents__btn--primary" onClick={handleDeployAgent} disabled={!newAgentPrompt.trim()}>Deploy Agent</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MemoryPanel({ isActive: _isActive }: { isActive: boolean; onClose: () => void }) {
  return (
    <div className="panel-memory">
      <div className="panel-memory__stats">
        <div className="panel-memory__stat">
          <span className="panel-memory__stat-value">24</span>
          <span className="panel-memory__stat-label">Patterns Learned</span>
        </div>
        <div className="panel-memory__stat">
          <span className="panel-memory__stat-value">156</span>
          <span className="panel-memory__stat-label">Code Snippets</span>
        </div>
        <div className="panel-memory__stat">
          <span className="panel-memory__stat-value">89%</span>
          <span className="panel-memory__stat-label">Accuracy</span>
        </div>
      </div>
      <div className="panel-memory__recent">
        <h5>Recent Memory Updates</h5>
        <div className="panel-memory__list">
          {['Component patterns', 'API conventions', 'Error handling', 'Styling preferences'].map((item, i) => (
            <div key={i} className="panel-memory__item">
              <div className="panel-memory__item-indicator" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QualityCheckPanel({ isActive: _isActive }: { isActive: boolean; onClose: () => void }) {
  const [scores] = useState({ code: 87, visual: 92, security: 95, performance: 78 });

  return (
    <div className="panel-quality">
      <div className="panel-quality__overview">
        <div className="panel-quality__score-ring">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
            <motion.circle
              cx="50" cy="50" r="45" fill="none" stroke="url(#qualityGrad)" strokeWidth="8"
              strokeLinecap="round" strokeDasharray={283} strokeDashoffset={283 - (283 * 88) / 100}
              initial={{ strokeDashoffset: 283 }}
              animate={{ strokeDashoffset: 283 - (283 * 88) / 100 }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
            <defs>
              <linearGradient id="qualityGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFB87A" />
                <stop offset="100%" stopColor="#40C870" />
              </linearGradient>
            </defs>
          </svg>
          <div className="panel-quality__score-value">
            <span className="panel-quality__score-number">88</span>
            <span className="panel-quality__score-label">Overall</span>
          </div>
        </div>
      </div>
      <div className="panel-quality__breakdown">
        {Object.entries(scores).map(([key, value]) => (
          <div key={key} className="panel-quality__metric">
            <div className="panel-quality__metric-header">
              <span className="panel-quality__metric-name">{key}</span>
              <span className="panel-quality__metric-value">{value}%</span>
            </div>
            <div className="panel-quality__metric-bar">
              <motion.div
                className="panel-quality__metric-fill"
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
              />
            </div>
          </div>
        ))}
      </div>
      <button className="panel-quality__run-btn">Run Full Analysis</button>
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
    notifySlack: false,
  });

  return (
    <div className="panel-ghost">
      <div className="panel-ghost__status">
        <div className={`panel-ghost__indicator ${isActive ? 'panel-ghost__indicator--active' : ''}`}>
          <motion.div
            className="panel-ghost__indicator-ring"
            animate={isActive ? { scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <DeveloperBarIcon name="ghostMode" size={32} isActive={isActive} />
        </div>
        <span className="panel-ghost__status-text">{isActive ? 'Ghost Mode Active' : 'Ghost Mode Idle'}</span>
      </div>
      
      <div className="panel-ghost__config">
        <div className="panel-ghost__config-item">
          <label>Max Runtime (hours)</label>
          <input type="range" min="1" max="24" value={config.maxRuntime} onChange={(e) => setConfig({ ...config, maxRuntime: parseInt(e.target.value) })} />
          <span>{config.maxRuntime}h</span>
        </div>
        <div className="panel-ghost__config-item">
          <label>Max Credits ($)</label>
          <input type="range" min="10" max="200" value={config.maxCredits} onChange={(e) => setConfig({ ...config, maxCredits: parseInt(e.target.value) })} />
          <span>${config.maxCredits}</span>
        </div>
        <div className="panel-ghost__config-item">
          <label>Autonomy Level</label>
          <select value={config.autonomyLevel} onChange={(e) => setConfig({ ...config, autonomyLevel: e.target.value })}>
            <option value="low">Low - Ask before changes</option>
            <option value="medium">Medium - Proceed with caution</option>
            <option value="high">High - Full autonomy</option>
          </select>
        </div>
        <div className="panel-ghost__config-toggles">
          <label className="panel-ghost__toggle">
            <input type="checkbox" checked={config.pauseOnError} onChange={(e) => setConfig({ ...config, pauseOnError: e.target.checked })} />
            <span>Pause on Error</span>
          </label>
          <label className="panel-ghost__toggle">
            <input type="checkbox" checked={config.notifyEmail} onChange={(e) => setConfig({ ...config, notifyEmail: e.target.checked })} />
            <span>Email Notifications</span>
          </label>
          <label className="panel-ghost__toggle">
            <input type="checkbox" checked={config.notifySlack} onChange={(e) => setConfig({ ...config, notifySlack: e.target.checked })} />
            <span>Slack Notifications</span>
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
    { id: '1', time: '5 min ago', label: 'Auto-save', files: 3 },
    { id: '2', time: '15 min ago', label: 'Feature complete', files: 8 },
    { id: '3', time: '1 hour ago', label: 'Major milestone', files: 15 },
    { id: '4', time: '3 hours ago', label: 'Session start', files: 2 },
  ];

  return (
    <div className="panel-timemachine">
      <div className="panel-timemachine__timeline">
        {checkpoints.map((cp, i) => (
          <motion.div
            key={cp.id}
            className="panel-timemachine__checkpoint"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="panel-timemachine__checkpoint-dot" />
            <div className="panel-timemachine__checkpoint-info">
              <span className="panel-timemachine__checkpoint-time">{cp.time}</span>
              <span className="panel-timemachine__checkpoint-label">{cp.label}</span>
              <span className="panel-timemachine__checkpoint-files">{cp.files} files</span>
            </div>
            <div className="panel-timemachine__checkpoint-actions">
              <button className="panel-timemachine__btn">Preview</button>
              <button className="panel-timemachine__btn panel-timemachine__btn--restore">Restore</button>
            </div>
          </motion.div>
        ))}
      </div>
      <button className="panel-timemachine__create-btn">Create Checkpoint</button>
    </div>
  );
}

// Stub panels
function DeploymentPanel({ isActive: _isActive }: { isActive: boolean; onClose: () => void }) {
  return <div className="devbar-panel__default">Deployment Panel</div>;
}

function DatabasePanel({ isActive: _isActive }: { isActive: boolean; onClose: () => void }) {
  return <div className="devbar-panel__default">Database Panel</div>;
}

function WorkflowsPanel({ isActive: _isActive }: { isActive: boolean; onClose: () => void }) {
  return <div className="devbar-panel__default">Workflows Panel</div>;
}

function LiveDebugPanel({ isActive: _isActive }: { isActive: boolean; onClose: () => void }) {
  return <div className="devbar-panel__default">Live Debug Panel</div>;
}

function LiveHealthPanel({ isActive: _isActive }: { isActive: boolean; onClose: () => void }) {
  return <div className="devbar-panel__default">Live Health Panel</div>;
}

function IntegrationsPanel({ isActive: _isActive }: { isActive: boolean; onClose: () => void }) {
  return <div className="devbar-panel__default">Integrations Panel</div>;
}

function DeveloperSettingsPanel({ isActive: _isActive }: { isActive: boolean; onClose: () => void }) {
  return <div className="devbar-panel__default">Developer Settings Panel</div>;
}

function MarketFitPanel({ isActive: _isActive }: { isActive: boolean; onClose: () => void }) {
  return <div className="devbar-panel__default">Market Fit Panel</div>;
}

function PredictiveEnginePanel({ isActive: _isActive }: { isActive: boolean; onClose: () => void }) {
  return <div className="devbar-panel__default">Predictive Engine Panel</div>;
}

function AISlopCatchPanel({ isActive: _isActive }: { isActive: boolean; onClose: () => void }) {
  return <div className="devbar-panel__default">AI-Slop Catch Panel</div>;
}

function VoiceFirstPanel({ isActive: _isActive }: { isActive: boolean; onClose: () => void }) {
  return <div className="devbar-panel__default">Voice First Panel</div>;
}

function TestGenPanel({ isActive: _isActive }: { isActive: boolean; onClose: () => void }) {
  return <div className="devbar-panel__default">Test Gen Panel</div>;
}

function SelfHealPanel({ isActive: _isActive }: { isActive: boolean; onClose: () => void }) {
  return <div className="devbar-panel__default">Self Heal Panel</div>;
}

function CloudDeployPanel({ isActive: _isActive }: { isActive: boolean; onClose: () => void }) {
  return <div className="devbar-panel__default">Cloud Deploy Panel</div>;
}

export default DeveloperBarPanel;
