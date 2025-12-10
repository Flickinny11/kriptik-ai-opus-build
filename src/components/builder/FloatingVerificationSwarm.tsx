/**
 * Floating Verification Swarm Panel
 *
 * Shows real-time 6-agent verification swarm status during builds.
 * - Compact mode by default
 * - Expandable on click
 * - Glass morphism styling
 * - Polls quality API during active builds
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VerificationSwarmStatus, type AgentState, type SwarmVerdict, type VerificationAgentType } from './VerificationSwarmStatus';
import './FloatingVerificationSwarm.css';

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

export function FloatingVerificationSwarm({
  projectId,
  isBuilding,
  onOpenReport,
}: FloatingVerificationSwarmProps) {
  const [isExpanded, setIsExpanded] = useState(false); // Collapsed by default - compact status indicator
  const [isMinimized, setIsMinimized] = useState(false);
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [verdict, setVerdict] = useState<SwarmVerdict | undefined>();
  const [isRunning, setIsRunning] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

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

    // Set all agents to running initially
    setAgents(prev => prev.map(a => ({ ...a, status: 'running' as const })));

    try {
      const response = await fetch(`/api/quality/${projectId}/report`);

      if (response.ok) {
        const data: QualityCheckResponse = await response.json();
        const newAgents = processQualityResponse(data);
        setAgents(newAgents);

        // Calculate verdict
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

  // Poll when building
  useEffect(() => {
    if (isBuilding) {
      fetchQualityStatus();
      const interval = setInterval(fetchQualityStatus, 10000); // Poll every 10s during build
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

    // Fetch initial status if we have a project
    if (projectId && projectId !== 'new') {
      fetchQualityStatus();
    }
  }, [projectId, fetchQualityStatus]);

  // Don't render if minimized completely
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
        {/* Custom hexagon icon - black, white, red */}
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
      {/* Header */}
      <div
        className="floating-swarm__header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="floating-swarm__header-left">
          {/* Logo - black, white, red */}
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
          {/* Status orbs when collapsed */}
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

      {/* Expanded Content - Compact status list */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="floating-swarm__expanded"
          >
            <div className="floating-swarm__content">
              <VerificationSwarmStatus
                agents={agents}
                verdict={verdict}
                isRunning={isRunning}
                onRerun={fetchQualityStatus}
                compact={false}
              />
            </div>

            {/* Footer */}
            <div className="floating-swarm__footer">
              {lastChecked && (
                <span className="floating-swarm__timestamp">
                  {lastChecked.toLocaleTimeString()}
                </span>
              )}
              {onOpenReport && (
                <button
                  onClick={onOpenReport}
                  className="floating-swarm__report-btn"
                >
                  Details
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default FloatingVerificationSwarm;

