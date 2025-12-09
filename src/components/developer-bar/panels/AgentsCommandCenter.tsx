/**
 * Agents Command Center - PREMIUM AI Agent Control
 * 
 * Ultra high-tech command center with:
 * - Animated holographic backgrounds
 * - 3D depth and parallax effects
 * - Real-time streaming agent visualizations
 * - Premium model selector with brand logos
 * - Crisp, dynamic, butter-smooth animations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { apiClient } from '@/lib/api-client';
import './AgentsCommandCenter.css';

// Premium AI Models
const AI_MODELS = [
  { 
    id: 'claude-opus-4-5', 
    name: 'Opus 4.5', 
    provider: 'anthropic',
    tier: 'FLAGSHIP',
    color: '#D4A574',
    desc: 'Maximum intelligence'
  },
  { 
    id: 'claude-sonnet-4-5', 
    name: 'Sonnet 4.5', 
    provider: 'anthropic',
    tier: 'PREMIUM',
    color: '#F5A86C',
    desc: 'Best balance'
  },
  { 
    id: 'gpt-5-1-codex', 
    name: 'GPT-5.1 Codex', 
    provider: 'openai',
    tier: 'FLAGSHIP',
    color: '#00A67E',
    desc: 'Code specialist'
  },
  { 
    id: 'gemini-2-ultra', 
    name: 'Gemini Ultra', 
    provider: 'google',
    tier: 'FLAGSHIP',
    color: '#4285F4',
    desc: 'Multimodal'
  },
  { 
    id: 'kriptoe-nite', 
    name: 'KripToe-Nite', 
    provider: 'kriptik',
    tier: 'CUSTOM',
    color: '#C8FF64',
    desc: 'Our flagship'
  },
  { 
    id: 'deepseek-v3', 
    name: 'DeepSeek V3', 
    provider: 'deepseek',
    tier: 'PERFORMANCE',
    color: '#06B6D4',
    desc: 'Speed optimized'
  },
];

interface Agent {
  id: string;
  name: string;
  model: string;
  status: 'idle' | 'thinking' | 'building' | 'verifying' | 'complete' | 'error';
  task: string;
  progress: number;
  thoughts?: string[];
  currentFile?: string;
  tokensUsed?: number;
  ttftMs?: number;
  startTime?: Date;
}

interface AgentsCommandCenterProps {
  sessionId?: string;
  projectId?: string;
}

export function AgentsCommandCenter({ sessionId, projectId }: AgentsCommandCenterProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[1].id);
  const [taskPrompt, setTaskPrompt] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'config'>('active');
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse parallax effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothMouseX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const smoothMouseY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x * 20);
    mouseY.set(y * 20);
  }, [mouseX, mouseY]);

  // Deploy agent
  const deployAgent = useCallback(async () => {
    if (!taskPrompt.trim() || isDeploying || agents.length >= 6) return;
    setIsDeploying(true);
    
    try {
      const response = await apiClient.post('/api/developer-mode/agents/deploy', {
        sessionId,
        projectId,
        taskPrompt: taskPrompt.trim(),
        model: selectedModel,
        name: `Agent-${agents.length + 1}`,
      });

      setAgents(prev => [...prev, {
        id: response.agentId || `agent-${Date.now()}`,
        name: `Agent-${agents.length + 1}`,
        model: selectedModel,
        status: 'thinking',
        task: taskPrompt.trim(),
        progress: 0,
        thoughts: ['Initializing...', 'Analyzing task requirements...'],
        startTime: new Date(),
      }]);
      setTaskPrompt('');
    } catch (error) {
      console.error('Deploy failed:', error);
    } finally {
      setIsDeploying(false);
    }
  }, [taskPrompt, selectedModel, sessionId, projectId, agents.length, isDeploying]);

  const getStatusConfig = (status: Agent['status']) => {
    const configs = {
      thinking: { color: '#F5A86C', label: 'THINKING', glow: true },
      building: { color: '#4ADE80', label: 'BUILDING', glow: true },
      verifying: { color: '#60A5FA', label: 'VERIFYING', glow: true },
      complete: { color: '#22C55E', label: 'COMPLETE', glow: false },
      error: { color: '#EF4444', label: 'ERROR', glow: false },
      idle: { color: '#6B7280', label: 'IDLE', glow: false },
    };
    return configs[status] || configs.idle;
  };

  return (
    <div 
      ref={containerRef}
      className="acc"
      onMouseMove={handleMouseMove}
    >
      {/* Animated background layers */}
      <div className="acc__bg">
        <motion.div 
          className="acc__bg-gradient"
          style={{ x: smoothMouseX, y: smoothMouseY }}
        />
        <div className="acc__bg-grid" />
        <div className="acc__bg-noise" />
        <div className="acc__bg-vignette" />
      </div>

      {/* Floating particles */}
      <div className="acc__particles">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="acc__particle"
            animate={{
              y: [0, -30, 0],
              x: [0, Math.sin(i) * 10, 0],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 4 + i * 0.5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.3,
            }}
            style={{
              left: `${10 + (i * 8)}%`,
              top: `${20 + (i % 4) * 20}%`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="acc__content">
        {/* Header */}
        <div className="acc__header">
          <div className="acc__header-main">
            <div className="acc__logo">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <defs>
                  <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F5A86C" />
                    <stop offset="100%" stopColor="#E88B4D" />
                  </linearGradient>
                </defs>
                <path d="M14 2L4 8v12l10 6 10-6V8L14 2z" fill="url(#logo-grad)" opacity="0.9"/>
                <path d="M14 2L4 8l10 6 10-6L14 2z" fill="#FFB87D"/>
                <circle cx="14" cy="11" r="3" fill="#fff" opacity="0.9"/>
                <circle cx="9" cy="14" r="2" fill="#fff" opacity="0.5"/>
                <circle cx="19" cy="14" r="2" fill="#fff" opacity="0.5"/>
              </svg>
              <motion.div 
                className="acc__logo-glow"
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <div className="acc__title-group">
              <h1 className="acc__title">Agents Command Center</h1>
              <p className="acc__subtitle">
                <span className="acc__stat">{agents.filter(a => a.status !== 'idle').length}</span> active
                <span className="acc__divider">·</span>
                <span className="acc__stat">{agents.length}</span>/6 deployed
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="acc__tabs">
            {(['active', 'history', 'config'] as const).map(tab => (
              <motion.button
                key={tab}
                className={`acc__tab ${activeTab === tab ? 'acc__tab--active' : ''}`}
                onClick={() => setActiveTab(tab)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {tab.toUpperCase()}
                {activeTab === tab && (
                  <motion.div 
                    className="acc__tab-indicator"
                    layoutId="tab-indicator"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Active Tab */}
        <AnimatePresence mode="wait">
          {activeTab === 'active' && (
            <motion.div
              key="active"
              className="acc__body"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Deploy Section */}
              <div className="acc__deploy">
                <div className="acc__deploy-header">
                  <span className="acc__deploy-title">Deploy New Agent</span>
                  <span className="acc__deploy-slots">{6 - agents.length} slots</span>
                </div>

                {/* Model Grid */}
                <div className="acc__models">
                  {AI_MODELS.map((model, i) => (
                    <motion.button
                      key={model.id}
                      className={`acc__model ${selectedModel === model.id ? 'acc__model--selected' : ''}`}
                      onClick={() => setSelectedModel(model.id)}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      style={{ '--model-color': model.color } as React.CSSProperties}
                    >
                      <div className="acc__model-icon">
                        {model.provider === 'anthropic' && (
                          <img src="https://cdn.simpleicons.org/anthropic/D4A574" alt="" />
                        )}
                        {model.provider === 'openai' && (
                          <img src="https://cdn.simpleicons.org/openai/00A67E" alt="" />
                        )}
                        {model.provider === 'google' && (
                          <img src="https://cdn.simpleicons.org/google/4285F4" alt="" />
                        )}
                        {model.provider === 'kriptik' && (
                          <span className="acc__model-logo acc__model-logo--k">K</span>
                        )}
                        {model.provider === 'deepseek' && (
                          <span className="acc__model-logo acc__model-logo--ds">DS</span>
                        )}
                      </div>
                      <div className="acc__model-info">
                        <span className="acc__model-name">{model.name}</span>
                        <span className="acc__model-desc">{model.desc}</span>
                      </div>
                      <span className={`acc__model-tier acc__model-tier--${model.tier.toLowerCase()}`}>
                        {model.tier}
                      </span>
                      {selectedModel === model.id && (
                        <motion.div 
                          className="acc__model-glow"
                          layoutId="model-glow"
                          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        />
                      )}
                    </motion.button>
                  ))}
                </div>

                {/* Prompt Input */}
                <div className="acc__prompt">
                  <textarea
                    value={taskPrompt}
                    onChange={(e) => setTaskPrompt(e.target.value)}
                    placeholder="Describe what you want this agent to build..."
                    className="acc__prompt-input"
                    rows={3}
                    disabled={agents.length >= 6}
                  />
                  <div className="acc__prompt-footer">
                    <kbd className="acc__kbd">⌘</kbd>
                    <span className="acc__hint">+ Enter to deploy</span>
                    <motion.button
                      className="acc__deploy-btn"
                      onClick={deployAgent}
                      disabled={!taskPrompt.trim() || isDeploying || agents.length >= 6}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isDeploying ? (
                        <motion.span
                          className="acc__deploy-spinner"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        />
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                          </svg>
                          Deploy Agent
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* Agent Cards */}
              <div className="acc__agents">
                <AnimatePresence mode="popLayout">
                  {agents.map((agent, i) => {
                    const status = getStatusConfig(agent.status);
                    return (
                      <motion.div
                        key={agent.id}
                        className={`acc__agent ${agent.status !== 'idle' ? 'acc__agent--active' : ''}`}
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -30 }}
                        transition={{ delay: i * 0.05, type: 'spring', stiffness: 300 }}
                        layout
                        style={{ '--agent-color': status.color } as React.CSSProperties}
                      >
                        {status.glow && (
                          <motion.div 
                            className="acc__agent-glow"
                            animate={{ opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                        )}
                        <div className="acc__agent-header">
                          <div className="acc__agent-avatar">
                            <span>{agent.name.replace('Agent-', '')}</span>
                            {status.glow && <div className="acc__agent-pulse" />}
                          </div>
                          <div className="acc__agent-meta">
                            <span className="acc__agent-name">{agent.name}</span>
                            <span className="acc__agent-model">
                              {AI_MODELS.find(m => m.id === agent.model)?.name}
                            </span>
                          </div>
                          <div className="acc__agent-status">
                            <span className="acc__agent-dot" />
                            {status.label}
                          </div>
                        </div>

                        <p className="acc__agent-task">{agent.task}</p>

                        {agent.status !== 'idle' && (
                          <div className="acc__agent-progress">
                            <div className="acc__agent-bar">
                              <motion.div 
                                className="acc__agent-fill"
                                initial={{ width: 0 }}
                                animate={{ width: `${agent.progress}%` }}
                                transition={{ duration: 0.5 }}
                              />
                            </div>
                            <span className="acc__agent-pct">{agent.progress}%</span>
                          </div>
                        )}

                        {agent.thoughts && agent.thoughts.length > 0 && (
                          <div className="acc__agent-thoughts">
                            <div className="acc__thoughts-header">AGENT THINKING</div>
                            {agent.thoughts.slice(-2).map((thought, ti) => (
                              <motion.div
                                key={ti}
                                className="acc__thought"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: ti * 0.1 }}
                              >
                                {thought}
                              </motion.div>
                            ))}
                            {agent.status === 'thinking' && (
                              <motion.span 
                                className="acc__cursor"
                                animate={{ opacity: [1, 0, 1] }}
                                transition={{ duration: 1, repeat: Infinity }}
                              />
                            )}
                          </div>
                        )}

                        {agent.status === 'complete' && (
                          <div className="acc__agent-actions">
                            <button className="acc__action acc__action--primary">Review</button>
                            <button className="acc__action">Create PR</button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}

                  {/* Empty slots */}
                  {Array.from({ length: Math.max(0, 6 - agents.length) }).map((_, i) => (
                    <motion.div
                      key={`empty-${i}`}
                      className="acc__agent acc__agent--empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: (agents.length + i) * 0.05 }}
                    >
                      <div className="acc__empty">
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                          <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" opacity="0.3"/>
                          <path d="M16 10v12M10 16h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
                        </svg>
                        <span>Empty Slot</span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              className="acc__body acc__history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="acc__history-empty">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" opacity="0.2"/>
                  <path d="M24 12v12l8 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
                </svg>
                <span>No agent history yet</span>
                <p>Deploy your first agent to see history</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'config' && (
            <motion.div
              key="config"
              className="acc__body acc__config"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="acc__config-section">
                <h3>Agent Defaults</h3>
                <div className="acc__config-row">
                  <label>Default Model</label>
                  <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                    {AI_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="acc__config-row">
                  <label>Thinking Budget</label>
                  <select>
                    <option>Low (Fast)</option>
                    <option>Medium</option>
                    <option>High (Thorough)</option>
                    <option>Maximum</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default AgentsCommandCenter;
