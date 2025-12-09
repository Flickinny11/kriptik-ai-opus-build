/**
 * Agents Command Center - Premium 3D AI Agent Control
 *
 * Features:
 * - Real OpenRouter models with high/low/thinking variations
 * - 3D skewed agent tiles with matte slate texture
 * - Expandable streaming reasoning window
 * - Realistic layered shadows
 * - GitHub PR creation integration
 * - Liquid glass UI elements
 */

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/lib/api-client';
import './AgentsCommandCenter.css';

// Real OpenRouter Models with variations
const AI_MODELS = [
  // Anthropic Claude
  {
    id: 'anthropic/claude-opus-4.5',
    name: 'Claude Opus 4.5',
    variant: 'Maximum',
    provider: 'anthropic',
    color: '#D4A574',
    desc: 'Highest reasoning capability',
    icon: 'https://cdn.simpleicons.org/anthropic/D4A574'
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    variant: 'Balanced',
    provider: 'anthropic',
    color: '#F5A86C',
    desc: 'Best balance of speed & quality',
    icon: 'https://cdn.simpleicons.org/anthropic/F5A86C'
  },
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    variant: 'Fast',
    provider: 'anthropic',
    color: '#E8845B',
    desc: 'Quick responses, good quality',
    icon: 'https://cdn.simpleicons.org/anthropic/E8845B'
  },
  {
    id: 'anthropic/claude-3.5-haiku',
    name: 'Claude Haiku 3.5',
    variant: 'Speed',
    provider: 'anthropic',
    color: '#CC7A50',
    desc: 'Fastest, cost-effective',
    icon: 'https://cdn.simpleicons.org/anthropic/CC7A50'
  },
  // OpenAI
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    variant: 'Multimodal',
    provider: 'openai',
    color: '#00A67E',
    desc: 'Vision + code specialist',
    icon: 'https://cdn.simpleicons.org/openai/00A67E'
  },
  {
    id: 'openai/o1-preview',
    name: 'o1 Preview',
    variant: 'Reasoning',
    provider: 'openai',
    color: '#10A37F',
    desc: 'Chain-of-thought reasoning',
    icon: 'https://cdn.simpleicons.org/openai/10A37F'
  },
  {
    id: 'openai/o1-mini',
    name: 'o1 Mini',
    variant: 'Fast Reasoning',
    provider: 'openai',
    color: '#0D8C6D',
    desc: 'Quick reasoning tasks',
    icon: 'https://cdn.simpleicons.org/openai/0D8C6D'
  },
  // DeepSeek
  {
    id: 'deepseek/deepseek-chat-v3-0324',
    name: 'DeepSeek V3',
    variant: 'Performance',
    provider: 'deepseek',
    color: '#06B6D4',
    desc: 'Speed optimized, cost-effective',
    icon: null
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    variant: 'Reasoning',
    provider: 'deepseek',
    color: '#0891B2',
    desc: 'Deep reasoning capabilities',
    icon: null
  },
  // Krip-Toe-Nite (Custom)
  {
    id: 'krip-toe-nite',
    name: 'Krip-Toe-Nite',
    variant: 'Auto-Select',
    provider: 'kriptik',
    color: '#C8FF64',
    desc: 'Intelligent model routing',
    icon: null
  },
];

interface AgentThought {
  timestamp: number;
  type: 'thinking' | 'action' | 'result';
  content: string;
}

interface AgentDiff {
  file: string;
  additions: number;
  deletions: number;
  patch?: string;
}

interface Agent {
  id: string;
  name: string;
  model: string;
  modelName: string;
  status: 'idle' | 'thinking' | 'building' | 'verifying' | 'complete' | 'error';
  task: string;
  progress: number;
  thoughts: AgentThought[];
  currentAction?: string;
  summary?: string;
  diffs?: AgentDiff[];
  branchName?: string;
  prUrl?: string;
  tokensUsed?: number;
  startTime?: Date;
  endTime?: Date;
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
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedModelData = AI_MODELS.find(m => m.id === selectedModel) || AI_MODELS[1];

  // Deploy agent using the backend orchestration system
  const deployAgent = useCallback(async () => {
    if (!taskPrompt.trim() || isDeploying || agents.length >= 6) return;
    setIsDeploying(true);

    const agentId = `agent-${Date.now()}`;
    const agentName = `Agent ${agents.length + 1}`;

    // Create optimistic agent
    const newAgent: Agent = {
      id: agentId,
      name: agentName,
      model: selectedModel,
      modelName: selectedModelData.name,
      status: 'thinking',
      task: taskPrompt.trim(),
      progress: 0,
      thoughts: [{
        timestamp: Date.now(),
        type: 'thinking',
        content: 'Initializing agent and analyzing task requirements...'
      }],
      startTime: new Date(),
    };

    setAgents(prev => [...prev, newAgent]);
    setTaskPrompt('');

    try {
      // Call the actual backend orchestration system
      const response = await apiClient.post('/api/developer-mode/agents/deploy', {
        sessionId: sessionId || `session-${Date.now()}`,
        projectId: projectId || 'default',
        taskPrompt: taskPrompt.trim(),
        model: selectedModel,
        name: agentName,
        agentId,
      });

      // Update agent with response
      setAgents(prev => prev.map(a =>
        a.id === agentId
          ? {
              ...a,
              id: response.agentId || agentId,
              status: 'building' as const,
              progress: 10,
              thoughts: [
                ...a.thoughts,
                { timestamp: Date.now(), type: 'action' as const, content: 'Agent deployed successfully, beginning task execution...' }
              ]
            }
          : a
      ));

      // Start polling for updates or connect to SSE
      pollAgentStatus(response.agentId || agentId);

    } catch (error) {
      console.error('Deploy failed:', error);
      setAgents(prev => prev.map(a =>
        a.id === agentId
          ? { ...a, status: 'error' as const, thoughts: [...a.thoughts, { timestamp: Date.now(), type: 'result' as const, content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }] }
          : a
      ));
    } finally {
      setIsDeploying(false);
    }
  }, [taskPrompt, selectedModel, selectedModelData, sessionId, projectId, agents.length, isDeploying]);

  // Poll for agent status updates
  const pollAgentStatus = useCallback(async (agentId: string) => {
    const poll = async () => {
      try {
        const status = await apiClient.get(`/api/developer-mode/agents/${agentId}/status`);

        setAgents(prev => prev.map(a => {
          if (a.id !== agentId) return a;

          const newThoughts = [...a.thoughts];
          if (status.currentAction && status.currentAction !== a.currentAction) {
            newThoughts.push({
              timestamp: Date.now(),
              type: 'action',
              content: status.currentAction
            });
          }
          if (status.thinking) {
            newThoughts.push({
              timestamp: Date.now(),
              type: 'thinking',
              content: status.thinking
            });
          }

          return {
            ...a,
            status: status.status || a.status,
            progress: status.progress || a.progress,
            thoughts: newThoughts,
            currentAction: status.currentAction,
            summary: status.summary,
            diffs: status.diffs,
            branchName: status.branchName,
            endTime: status.status === 'complete' ? new Date() : undefined,
          };
        }));

        // Continue polling if not complete
        const agent = agents.find(a => a.id === agentId);
        if (agent && !['complete', 'error'].includes(agent.status)) {
          setTimeout(poll, 2000);
        }
      } catch (error) {
        console.error('Poll failed:', error);
      }
    };

    poll();
  }, [agents]);

  // Create GitHub PR
  const createPR = useCallback(async (agent: Agent) => {
    if (!agent.branchName) return;

    try {
      const response = await apiClient.post('/api/developer-mode/agents/create-pr', {
        agentId: agent.id,
        branchName: agent.branchName,
        title: `[Agent ${agent.name}] ${agent.task.slice(0, 50)}...`,
        body: agent.summary || 'Automated changes by KripTik AI Agent',
      });

      setAgents(prev => prev.map(a =>
        a.id === agent.id ? { ...a, prUrl: response.prUrl } : a
      ));

      if (response.prUrl) {
        window.open(response.prUrl, '_blank');
      }
    } catch (error) {
      console.error('PR creation failed:', error);
    }
  }, []);

  const getStatusConfig = (status: Agent['status']) => {
    const configs = {
      thinking: { label: 'THINKING', glow: true },
      building: { label: 'BUILDING', glow: true },
      verifying: { label: 'VERIFYING', glow: true },
      complete: { label: 'COMPLETE', glow: false },
      error: { label: 'ERROR', glow: false },
      idle: { label: 'IDLE', glow: false },
    };
    return configs[status] || configs.idle;
  };

  return (
    <div className="acc-v2">
      {/* Subtle gradient background without particles */}
      <div className="acc-v2__bg">
        <div className="acc-v2__bg-gradient" />
        <div className="acc-v2__bg-noise" />
      </div>

      {/* Content */}
      <div className="acc-v2__content">
        {/* Header */}
        <div className="acc-v2__header">
          <div className="acc-v2__header-row">
            <div className="acc-v2__logo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="url(#acc-grad)" />
                <defs>
                  <linearGradient id="acc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F5A86C" />
                    <stop offset="100%" stopColor="#D46A4A" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="acc-v2__title-area">
              <h1 className="acc-v2__title">Agents Command Center</h1>
              <span className="acc-v2__stats">
                {agents.filter(a => ['thinking', 'building', 'verifying'].includes(a.status)).length} running · {agents.length}/6 slots
              </span>
            </div>
          </div>

          {/* Liquid Glass Tabs */}
          <div className="acc-v2__tabs">
            {(['active', 'history'] as const).map(tab => (
              <button
                key={tab}
                className={`acc-v2__tab ${activeTab === tab ? 'acc-v2__tab--active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                <span className="acc-v2__tab-text">{tab.toUpperCase()}</span>
                {activeTab === tab && <div className="acc-v2__tab-glow" />}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="acc-v2__body">
          <AnimatePresence mode="wait">
            {activeTab === 'active' && (
              <motion.div
                key="active"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="acc-v2__active"
              >
                {/* Deploy Section - Liquid Glass */}
                <div className="acc-v2__deploy-card">
                  <div className="acc-v2__deploy-header">
                    <span className="acc-v2__deploy-title">Deploy New Agent</span>
                    <span className="acc-v2__deploy-slots">{6 - agents.length} slots available</span>
                  </div>

                  {/* Model Dropdown */}
                  <div className="acc-v2__model-select" ref={dropdownRef}>
                    <button
                      className="acc-v2__model-trigger"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    >
                      <div className="acc-v2__model-selected">
                        {selectedModelData.icon ? (
                          <img src={selectedModelData.icon} alt="" className="acc-v2__model-icon" />
                        ) : (
                          <div
                            className="acc-v2__model-icon-placeholder"
                            style={{ background: selectedModelData.color }}
                          >
                            {selectedModelData.provider === 'kriptik' ? 'K' : 'DS'}
                          </div>
                        )}
                        <div className="acc-v2__model-info">
                          <span className="acc-v2__model-name">{selectedModelData.name}</span>
                          <span className="acc-v2__model-variant">{selectedModelData.variant}</span>
                        </div>
                      </div>
                      <svg className={`acc-v2__model-chevron ${isDropdownOpen ? 'open' : ''}`} width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>

                    <AnimatePresence>
                      {isDropdownOpen && (
                        <motion.div
                          className="acc-v2__model-dropdown"
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                        >
                          {AI_MODELS.map((model) => (
                            <button
                              key={model.id}
                              className={`acc-v2__model-option ${selectedModel === model.id ? 'selected' : ''}`}
                              onClick={() => {
                                setSelectedModel(model.id);
                                setIsDropdownOpen(false);
                              }}
                            >
                              {model.icon ? (
                                <img src={model.icon} alt="" className="acc-v2__model-icon" />
                              ) : (
                                <div
                                  className="acc-v2__model-icon-placeholder"
                                  style={{ background: model.color }}
                                >
                                  {model.provider === 'kriptik' ? 'K' : 'DS'}
                                </div>
                              )}
                              <div className="acc-v2__model-info">
                                <span className="acc-v2__model-name">{model.name}</span>
                                <span className="acc-v2__model-desc">{model.desc}</span>
                              </div>
                              <span
                                className="acc-v2__model-badge"
                                style={{ background: `${model.color}20`, color: model.color }}
                              >
                                {model.variant}
                              </span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Prompt Input */}
                  <div className="acc-v2__prompt-container">
                    <textarea
                      value={taskPrompt}
                      onChange={(e) => setTaskPrompt(e.target.value)}
                      placeholder="Describe what you want this agent to build..."
                      className="acc-v2__prompt"
                      rows={3}
                      disabled={agents.length >= 6}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.metaKey) {
                          deployAgent();
                        }
                      }}
                    />
                  </div>

                  <div className="acc-v2__deploy-footer">
                    <div className="acc-v2__deploy-hint">
                      <kbd>⌘</kbd><span>+ Enter to deploy</span>
                    </div>
                    <motion.button
                      className="acc-v2__deploy-btn"
                      onClick={deployAgent}
                      disabled={!taskPrompt.trim() || isDeploying || agents.length >= 6}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isDeploying ? (
                        <motion.div
                          className="acc-v2__spinner"
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

                {/* 3D Agent Tiles */}
                <div className="acc-v2__agents">
                  <AnimatePresence>
                    {agents.map((agent, index) => {
                      const status = getStatusConfig(agent.status);
                      const isExpanded = expandedAgentId === agent.id;
                      const modelData = AI_MODELS.find(m => m.id === agent.model);

                      return (
                        <motion.div
                          key={agent.id}
                          className={`acc-v2__tile ${isExpanded ? 'acc-v2__tile--expanded' : ''} acc-v2__tile--${agent.status}`}
                          initial={{ opacity: 0, scale: 0.8, rotateY: -15, rotateX: 5 }}
                          animate={{
                            opacity: 1,
                            scale: 1,
                            rotateY: isExpanded ? 0 : -8,
                            rotateX: isExpanded ? 0 : 3,
                          }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{
                            type: 'spring',
                            stiffness: 300,
                            damping: 25,
                            delay: index * 0.05
                          }}
                          onClick={() => setExpandedAgentId(isExpanded ? null : agent.id)}
                          style={{
                            '--tile-color': modelData?.color || '#F5A86C',
                            zIndex: isExpanded ? 100 : agents.length - index,
                          } as React.CSSProperties}
                        >
                          {/* Tile Glow for active states */}
                          {status.glow && (
                            <motion.div
                              className="acc-v2__tile-glow"
                              animate={{ opacity: [0.3, 0.6, 0.3] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                          )}

                          {/* Tile Header */}
                          <div className="acc-v2__tile-header">
                            <div className="acc-v2__tile-model">
                              {modelData?.icon ? (
                                <img src={modelData.icon} alt="" className="acc-v2__tile-model-icon" />
                              ) : (
                                <div
                                  className="acc-v2__tile-model-placeholder"
                                  style={{ background: modelData?.color }}
                                >
                                  {modelData?.provider === 'kriptik' ? 'K' : 'DS'}
                                </div>
                              )}
                              <span className="acc-v2__tile-model-name">{agent.modelName}</span>
                            </div>
                            <div className={`acc-v2__tile-status acc-v2__tile-status--${agent.status}`}>
                              {status.glow && <span className="acc-v2__tile-status-dot" />}
                              {status.label}
                            </div>
                          </div>

                          {/* Task Description */}
                          <p className="acc-v2__tile-task">{agent.task}</p>

                          {/* Progress Bar */}
                          {agent.status !== 'idle' && agent.status !== 'complete' && (
                            <div className="acc-v2__tile-progress">
                              <div className="acc-v2__tile-progress-bar">
                                <motion.div
                                  className="acc-v2__tile-progress-fill"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${agent.progress}%` }}
                                />
                              </div>
                              <span className="acc-v2__tile-progress-pct">{agent.progress}%</span>
                            </div>
                          )}

                          {/* Expanded Content */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                className="acc-v2__tile-expanded"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                              >
                                {/* Streaming Thoughts */}
                                <div className="acc-v2__tile-thoughts">
                                  <div className="acc-v2__tile-thoughts-header">
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
                                      <path d="M7 4v3l2 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                    </svg>
                                    AGENT REASONING
                                  </div>
                                  <div className="acc-v2__tile-thoughts-list">
                                    {agent.thoughts.slice(-5).map((thought, i) => (
                                      <motion.div
                                        key={i}
                                        className={`acc-v2__thought acc-v2__thought--${thought.type}`}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                      >
                                        {thought.content}
                                      </motion.div>
                                    ))}
                                    {agent.status === 'thinking' && (
                                      <motion.span
                                        className="acc-v2__cursor"
                                        animate={{ opacity: [1, 0, 1] }}
                                        transition={{ duration: 1, repeat: Infinity }}
                                      />
                                    )}
                                  </div>
                                </div>

                                {/* Summary & Actions for completed agents */}
                                {agent.status === 'complete' && (
                                  <div className="acc-v2__tile-complete">
                                    {agent.summary && (
                                      <div className="acc-v2__tile-summary">
                                        <div className="acc-v2__tile-summary-header">Summary</div>
                                        <p>{agent.summary}</p>
                                      </div>
                                    )}

                                    {agent.diffs && agent.diffs.length > 0 && (
                                      <div className="acc-v2__tile-diffs">
                                        <div className="acc-v2__tile-diffs-header">
                                          Changes ({agent.diffs.length} files)
                                        </div>
                                        {agent.diffs.map((diff, i) => (
                                          <div key={i} className="acc-v2__tile-diff">
                                            <span className="acc-v2__tile-diff-file">{diff.file}</span>
                                            <span className="acc-v2__tile-diff-stats">
                                              <span className="additions">+{diff.additions}</span>
                                              <span className="deletions">-{diff.deletions}</span>
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    <div className="acc-v2__tile-actions">
                                      {agent.prUrl ? (
                                        <a
                                          href={agent.prUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="acc-v2__tile-btn acc-v2__tile-btn--primary"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <path d="M6 3H3v10h10v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                            <path d="M7 9L13 3M13 3H9M13 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                          </svg>
                                          View PR
                                        </a>
                                      ) : (
                                        <button
                                          className="acc-v2__tile-btn acc-v2__tile-btn--primary"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            createPR(agent);
                                          }}
                                        >
                                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <circle cx="5" cy="4" r="2" stroke="currentColor" strokeWidth="1.5"/>
                                            <circle cx="5" cy="12" r="2" stroke="currentColor" strokeWidth="1.5"/>
                                            <circle cx="11" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
                                            <path d="M5 6v4M7 12h2c1 0 2-1 2-2V8" stroke="currentColor" strokeWidth="1.5"/>
                                          </svg>
                                          Create PR
                                        </button>
                                      )}
                                      <button
                                        className="acc-v2__tile-btn"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Review Changes
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {/* Empty slots indicator */}
                  {agents.length === 0 && (
                    <div className="acc-v2__empty">
                      <div className="acc-v2__empty-icon">
                        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                          <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" opacity="0.3"/>
                          <path d="M24 18v12M18 24h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
                        </svg>
                      </div>
                      <span>No agents deployed</span>
                      <p>Deploy your first agent to start building</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="acc-v2__history"
              >
                <div className="acc-v2__history-empty">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2" opacity="0.2"/>
                    <path d="M24 14v10l6 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
                  </svg>
                  <span>No agent history yet</span>
                  <p>Completed agent runs will appear here</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default AgentsCommandCenter;
