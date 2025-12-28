/**
 * Floating Verification Swarm Panel
 *
 * Shows real-time 6-agent verification swarm status during builds.
 * Features:
 * - 5 Configurable Swarm Modes
 * - Individual Agent Control
 * - Comprehensive Bug Hunt Mode
 * - Premium Glass Morphism UI
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VerificationSwarmStatus, type AgentState, type SwarmVerdict, type VerificationAgentType } from './VerificationSwarmStatus';
import SwarmModeSelector, { type SwarmMode } from './SwarmModeSelector';
import AgentConfigSlider, { type AgentConfig } from './AgentConfigSlider';
import BugHuntTab from './BugHuntTab';
import './FloatingVerificationSwarm.css';

// API URL for backend requests
const API_URL = import.meta.env.VITE_API_URL || 'https://api.kriptik.app';

// Custom logo icon - Black, white, and red
const SwarmLogoMini = () => (
  <svg viewBox="0 0 28 28" fill="none" className="floating-swarm__logo-icon">
    <path
      d="M14 3L23 8.5v11L14 25L5 19.5v-11L14 3z"
      stroke="#1a1a1a"
      strokeWidth="1.5"
      fill="rgba(255, 255, 255, 0.5)"
    />
    <path
      d="M14 8L18 10.5v5L14 18l-4-2.5v-5L14 8z"
      fill="#1a1a1a"
      opacity="0.8"
    />
    <circle cx="14" cy="13" r="2" fill="#c41e3a" />
  </svg>
);

interface FloatingVerificationSwarmProps {
  projectId: string;
  isBuilding: boolean;
  onOpenReport?: () => void;
}

// API Response type
interface QualityCheckResponse {
  overallScore: number;
  status: 'pass' | 'pass_with_warnings' | 'fail';
  lint?: Array<{
    errorCount: number;
    warningCount: number;
    messages?: Array<{ message: string }>;
  }>;
  security?: Array<{
    severity: string;
    message: string;
  }>;
  review?: {
    score: number;
    summary: string;
    suggestions?: string[];
    issues?: string[];
    security?: Array<{ message: string }>;
  };
  categories?: {
    security?: { score: number; issues: Array<{ message: string }> };
    quality?: { score: number; issues: Array<{ message: string }> };
    design?: { score: number; issues: Array<{ message: string }> };
    implementation?: { score: number; issues: Array<{ message: string }> };
    placeholders?: { score: number; issues: Array<{ message: string }> };
    errors?: { score: number; issues: Array<{ message: string }> };
  };
}

const DEFAULT_AGENT_CONFIGS: AgentConfig[] = [
  { agentType: 'error_checker', enabled: true, maxFiles: 50, maxIssues: 100, priority: 'critical', autoFix: true },
  { agentType: 'code_quality', enabled: true, maxFiles: 25, maxIssues: 50, priority: 'high', autoFix: false },
  { agentType: 'visual_verifier', enabled: true, maxFiles: 10, maxIssues: 20, priority: 'normal', autoFix: false },
  { agentType: 'security_scanner', enabled: true, maxFiles: 100, maxIssues: 50, priority: 'critical', autoFix: false },
  { agentType: 'placeholder_eliminator', enabled: true, maxFiles: 100, maxIssues: 200, priority: 'high', autoFix: true },
  { agentType: 'design_style', enabled: true, maxFiles: 15, maxIssues: 30, priority: 'normal', autoFix: false },
];

export function FloatingVerificationSwarm({
  projectId,
  isBuilding,
  onOpenReport,
}: FloatingVerificationSwarmProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'config' | 'bughunt'>('status');
  const [swarmMode, setSwarmMode] = useState<SwarmMode>('thorough');
  const [recommendedMode, setRecommendedMode] = useState<SwarmMode | undefined>();
  const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>(DEFAULT_AGENT_CONFIGS);

  const [agents, setAgents] = useState<AgentState[]>([]);
  const [verdict, setVerdict] = useState<SwarmVerdict | undefined>();
  const [isRunning, setIsRunning] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Initial mock intent contract - in production this would come from project settings
  const [intentContract] = useState({
    coreFeatures: ['Login', 'Dashboard', 'Payment Processing'],
    criticalPaths: ['/auth/login', '/dashboard'],
    preventDeletion: ['UserAuthService', 'PaymentController'],
  });

  // Convert API response to agent states
  const processQualityResponse = useCallback((data: QualityCheckResponse): AgentState[] => {
    const categories = data.categories || {};

    return [
      {
        type: 'error_checker' as VerificationAgentType,
        status: categories.errors?.score !== undefined
          ? (categories.errors.score >= 90 ? 'passed' : categories.errors.score >= 60 ? 'warning' : 'failed')
          : (data.lint?.some(l => l.errorCount > 0) ? 'failed' : 'passed'),
        score: categories.errors?.score ?? (data.lint?.reduce((sum, l) => sum + l.errorCount, 0) === 0 ? 100 : 50),
        issues: data.lint?.reduce((sum, l) => sum + l.errorCount + l.warningCount, 0) || 0,
        message: data.lint?.length ? `${data.lint.length} files checked` : 'No errors detected',
        details: data.lint?.flatMap(l => l.messages?.map(m => m.message) || []).slice(0, 5),
        lastRun: new Date(),
      },
      {
        type: 'code_quality' as VerificationAgentType,
        status: (data.review?.score ?? 0) >= 80 ? 'passed' : (data.review?.score ?? 0) >= 60 ? 'warning' : 'failed',
        score: data.review?.score ?? categories.quality?.score ?? 75,
        issues: data.review?.issues?.length || categories.quality?.issues?.length || 0,
        message: data.review?.summary || 'Code quality analyzed',
        details: data.review?.suggestions?.slice(0, 3) || categories.quality?.issues?.map(i => i.message).slice(0, 3),
        lastRun: new Date(),
      },
      {
        type: 'visual_verifier' as VerificationAgentType,
        status: categories.design?.score !== undefined
          ? (categories.design.score >= 80 ? 'passed' : categories.design.score >= 60 ? 'warning' : 'failed')
          : 'idle',
        score: categories.design?.score ?? 85,
        issues: categories.design?.issues?.length || 0,
        message: categories.design ? 'Visual checks complete' : 'Awaiting visual verification',
        details: categories.design?.issues?.map(i => i.message).slice(0, 3),
        lastRun: categories.design ? new Date() : undefined,
      },
      {
        type: 'security_scanner' as VerificationAgentType,
        status: categories.security?.score !== undefined
          ? (categories.security.score >= 90 ? 'passed' : categories.security.score >= 70 ? 'warning' : 'failed')
          : (data.security?.some(s => s.severity === 'critical' || s.severity === 'high') ? 'failed' : 'passed'),
        score: categories.security?.score ?? (data.security?.length === 0 ? 100 : 60),
        issues: data.security?.length || categories.security?.issues?.length || 0,
        message: data.security?.length === 0 ? 'No vulnerabilities found' : `${data.security?.length || 0} findings`,
        details: (data.security?.map(s => s.message) || categories.security?.issues?.map(i => i.message))?.slice(0, 3),
        lastRun: new Date(),
      },
      {
        type: 'placeholder_eliminator' as VerificationAgentType,
        status: categories.placeholders?.score !== undefined
          ? (categories.placeholders.score >= 90 ? 'passed' : categories.placeholders.score >= 60 ? 'warning' : 'failed')
          : 'idle',
        score: categories.placeholders?.score ?? 90,
        issues: categories.placeholders?.issues?.length || 0,
        message: categories.placeholders ? 'Placeholder scan complete' : 'Awaiting placeholder scan',
        details: categories.placeholders?.issues?.map(i => i.message).slice(0, 3),
        lastRun: categories.placeholders ? new Date() : undefined,
      },
      {
        type: 'design_style' as VerificationAgentType,
        status: categories.implementation?.score !== undefined
          ? (categories.implementation.score >= 80 ? 'passed' : categories.implementation.score >= 60 ? 'warning' : 'failed')
          : 'idle',
        score: categories.implementation?.score ?? 85,
        issues: categories.implementation?.issues?.length || 0,
        message: categories.implementation ? 'Style guidelines verified' : 'Awaiting style check',
        details: categories.implementation?.issues?.map(i => i.message).slice(0, 3),
        lastRun: categories.implementation ? new Date() : undefined,
      },
    ];
  }, []);

  // Fetch quality status
  const fetchQualityStatus = useCallback(async () => {
    if (!projectId || projectId === 'new') return;

    setIsRunning(true);
    setAgents(prev => prev.map(a => ({ ...a, status: 'running' as const })));

    try {
      const response = await fetch(`${API_URL}/api/quality/${projectId}/report`);

      if (response.ok) {
        const data: QualityCheckResponse = await response.json();
        const newAgents = processQualityResponse(data);
        setAgents(newAgents);

        const passedCount = newAgents.filter(a => a.status === 'passed').length;
        const failedCount = newAgents.filter(a => a.status === 'failed').length;
        const avgScore = newAgents.reduce((sum, a) => sum + (a.score || 0), 0) / newAgents.length;

        setVerdict({
          verdict: failedCount > 1 ? 'blocked' : failedCount > 0 ? 'needs_work' : passedCount === 6 ? 'approved' : 'needs_work',
          message: failedCount > 0
            ? `${failedCount} agent${failedCount > 1 ? 's' : ''} found issues`
            : 'All checks passing',
          overallScore: Math.round(avgScore),
        });

        setLastChecked(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch quality status:', error);
    } finally {
      setIsRunning(false);
    }
  }, [projectId, processQualityResponse]);

  // Recommend mode based on basic heuristics
  useEffect(() => {
    if (isBuilding) {
      fetch('/api/verification/recommend-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildPhase: 'developing',
          changeSize: 'medium',
          lastVerificationMinutesAgo: 30,
          previousFailureRate: 0.1,
        }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.recommendedMode) setRecommendedMode(data.recommendedMode);
        })
        .catch(console.error);
    }
  }, [isBuilding]);

  // Poll when building
  useEffect(() => {
    if (isBuilding) {
      fetchQualityStatus();
      const interval = setInterval(fetchQualityStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [isBuilding, fetchQualityStatus]);

  // Initialize agents on mount
  useEffect(() => {
    setAgents([
      { type: 'error_checker', status: 'idle' },
      { type: 'code_quality', status: 'idle' },
      { type: 'visual_verifier', status: 'idle' },
      { type: 'security_scanner', status: 'idle' },
      { type: 'placeholder_eliminator', status: 'idle' },
      { type: 'design_style', status: 'idle' },
    ]);

    if (projectId && projectId !== 'new') {
      fetchQualityStatus();
    }
  }, [projectId, fetchQualityStatus]);

  // Run custom swarm with current config
  const handleRunSwarm = async () => {
    if (!projectId) return;
    setIsRunning(true);
    setActiveTab('status'); // Switch to status view

    try {
      await fetch('/api/verification/swarm/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          mode: swarmMode,
          agentConfigs,
        }),
      });
      // Polling will pick up status
    } catch (error) {
      console.error('Failed to start swarm:', error);
      setIsRunning(false);
    }
  };

  const handleRunSingleAgent = async (agentType: string) => {
    if (!projectId) return;

    try {
      await fetch(`/api/verification/swarm/run-agent/${agentType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      setAgents(prev => prev.map(a =>
        a.type === agentType ? { ...a, status: 'running' } : a
      ));
    } catch (error) {
      console.error('Failed to run agent:', error);
    }
  };

  if (isMinimized) {
    return (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`floating-swarm__minimized ${isRunning ? 'floating-swarm__minimized--active' : ''}`}
        onClick={() => setIsMinimized(false)}
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95, y: 1 }}
      >
        <svg viewBox="0 0 28 28" fill="none" className="floating-swarm__minimized-icon">
          <path
            d="M14 3L23 8.5v11L14 25L5 19.5v-11L14 3z"
            stroke="#1a1a1a"
            strokeWidth="1.5"
            fill="rgba(255, 255, 255, 0.5)"
          />
          <path
            d="M14 8L18 10.5v5L14 18l-4-2.5v-5L14 8z"
            fill="#1a1a1a"
            opacity="0.8"
          />
          <circle cx="14" cy="13" r="2" fill="#c41e3a" />
        </svg>
        {isRunning && (
          <motion.div
            className="floating-swarm__minimized-pulse"
            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </motion.button>
    );
  }

  const passedCount = agents.filter(a => a.status === 'passed').length;
  const failedCount = agents.filter(a => a.status === 'failed').length;
  const warningCount = agents.filter(a => a.status === 'warning').length;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 100, opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`floating-swarm ${isExpanded ? 'floating-swarm--expanded' : ''} ${isRunning ? 'floating-swarm--running' : ''}`}
    >
      <div
        className="floating-swarm__header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="floating-swarm__header-left">
          <div className="floating-swarm__logo">
            <SwarmLogoMini />
            <div className="floating-swarm__logo-pulse" />
          </div>

          <div className="floating-swarm__title-area">
            <h4 className="floating-swarm__title">Verification Swarm</h4>
            <p className="floating-swarm__subtitle">
              {isRunning ? (
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  Scanning...
                </motion.span>
              ) : (
                `${passedCount}/6 passed${failedCount > 0 ? ` · ${failedCount} failed` : ''}${warningCount > 0 ? ` · ${warningCount} warnings` : ''}`
              )}
            </p>
          </div>
        </div>

        <div className="floating-swarm__header-right">
          {!isExpanded && (
            <div className="floating-swarm__orbs">
              {agents.map((agent, i) => (
                <motion.div
                  key={agent.type}
                  className={`floating-swarm__orb floating-swarm__orb--${agent.status}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.04, type: 'spring', stiffness: 400 }}
                  whileHover={{ scale: 1.4, y: -3 }}
                />
              ))}
            </div>
          )}

          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(true);
            }}
            className="floating-swarm__close"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </motion.button>

          <motion.div
            className="floating-swarm__chevron"
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.25 }}
          >
            <svg viewBox="0 0 14 14" fill="none" className="w-4 h-4">
              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="floating-swarm__expanded"
          >
            <div className="floating-swarm__tabs">
              <button
                className={`tab-btn ${activeTab === 'status' ? 'active' : ''}`}
                onClick={() => setActiveTab('status')}
              >
                Status & Control
              </button>
              <button
                className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`}
                onClick={() => setActiveTab('config')}
              >
                Agent Config
              </button>
              <button
                className={`tab-btn ${activeTab === 'bughunt' ? 'active' : ''}`}
                onClick={() => setActiveTab('bughunt')}
              >
                Bug Hunt
              </button>
            </div>

            <div className="floating-swarm__content">
              {activeTab === 'status' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <div className="mode-selector-wrapper">
                    <SwarmModeSelector
                      selectedMode={swarmMode}
                      onModeChange={setSwarmMode}
                      recommendedMode={recommendedMode}
                      disabled={isRunning}
                    />
                  </div>
                  <VerificationSwarmStatus
                    agents={agents}
                    verdict={verdict}
                    isRunning={isRunning}
                    onRerun={handleRunSwarm}
                    compact={false}
                  />
                  <button
                    className="run-swarm-main-btn"
                    onClick={handleRunSwarm}
                    disabled={isRunning}
                  >
                    {isRunning ? 'Swarm Active...' : 'Run Swarm Check'}
                  </button>
                </motion.div>
              )}

              {activeTab === 'config' && (
                <motion.div
                  className="config-panel"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  {agentConfigs.map((config, index) => (
                    <AgentConfigSlider
                      key={config.agentType}
                      config={config}
                      onChange={(newConfig) => {
                        const newConfigs = [...agentConfigs];
                        newConfigs[index] = newConfig;
                        setAgentConfigs(newConfigs);
                      }}
                      onRunAgent={() => handleRunSingleAgent(config.agentType)}
                      isRunning={agents.find(a => a.type === config.agentType)?.status === 'running'}
                    />
                  ))}
                </motion.div>
              )}

              {activeTab === 'bughunt' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <BugHuntTab
                    projectId={projectId}
                    intent={intentContract}
                    onBugFixed={() => fetchQualityStatus()} // Refresh status after fix
                    onAllSafeFixed={() => fetchQualityStatus()}
                  />
                </motion.div>
              )}
            </div>

            <div className="floating-swarm__footer">
              {lastChecked && (
                <span className="floating-swarm__timestamp">
                  Last check: {lastChecked.toLocaleTimeString()}
                </span>
              )}
              {onOpenReport && (
                <button
                  onClick={onOpenReport}
                  className="floating-swarm__report-btn"
                >
                  Full Report
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
                .floating-swarm__tabs {
                    display: flex;
                    gap: 4px;
                    padding: 0 16px 12px 16px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    margin-bottom: 12px;
                }

                .tab-btn {
                    flex: 1;
                    padding: 8px;
                    background: transparent;
                    border: none;
                    border-radius: 6px;
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 11px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .tab-btn:hover {
                    background: rgba(255, 255, 255, 0.05);
                    color: rgba(255, 255, 255, 0.8);
                }

                .tab-btn.active {
                    background: rgba(255, 255, 255, 0.1);
                    color: #ffffff;
                    font-weight: 600;
                }

                .mode-selector-wrapper {
                    margin-bottom: 16px;
                }

                .config-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    max-height: 400px;
                    overflow-y: auto;
                    padding-right: 4px;
                }

                /* Custom Scrollbar for Config Panel */
                .config-panel::-webkit-scrollbar {
                    width: 4px;
                }

                .config-panel::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.02);
                }

                .config-panel::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                }

                .run-swarm-main-btn {
                    width: 100%;
                    padding: 12px;
                    margin-top: 16px;
                    background: linear-gradient(135deg, #10b981, #059669);
                    border: none;
                    border-radius: 12px;
                    color: white;
                    font-weight: 600;
                    font-size: 14px;
                    cursor: pointer;
                    transition: transform 0.1s, box-shadow 0.2s;
                }

                .run-swarm-main-btn:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
                }

                .run-swarm-main-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
            `}</style>
    </motion.div>
  );
}

export default FloatingVerificationSwarm;
