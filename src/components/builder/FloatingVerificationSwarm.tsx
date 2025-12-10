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
import { 
  Shield, ChevronUp, ChevronDown, X, 
  Loader2, ExternalLink 
} from 'lucide-react';
import { VerificationSwarmStatus, type AgentState, type SwarmVerdict, type VerificationAgentType } from './VerificationSwarmStatus';

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
  const [isExpanded, setIsExpanded] = useState(false);
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
        className="fixed bottom-6 right-6 z-50 p-3 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-xl hover:border-violet-500/30 transition-colors"
        onClick={() => setIsMinimized(false)}
      >
        <Shield className="w-5 h-5 text-violet-400" />
        {isRunning && (
          <motion.div
            className="absolute -top-1 -right-1 w-3 h-3 bg-violet-500 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
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
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className={`
        fixed bottom-6 right-6 z-50
        rounded-2xl overflow-hidden
        bg-slate-900/95 backdrop-blur-xl
        border border-white/10
        shadow-2xl shadow-black/30
        ${isExpanded ? 'w-[380px]' : 'w-[280px]'}
      `}
      style={{
        boxShadow: `
          0 25px 50px -12px rgba(0, 0, 0, 0.4),
          0 0 0 1px rgba(255, 255, 255, 0.05),
          inset 0 1px 0 rgba(255, 255, 255, 0.1)
        `,
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
              <Shield className="w-4 h-4 text-violet-400" />
            </div>
            {isRunning && (
              <motion.div
                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-violet-500 rounded-full"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Verification Swarm</h4>
            <p className="text-xs text-slate-400">
              {isRunning ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Checking...
                </span>
              ) : (
                `${passedCount}/6 passed${failedCount > 0 ? `, ${failedCount} failed` : ''}${warningCount > 0 ? `, ${warningCount} warnings` : ''}`
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mini status indicators when collapsed */}
          {!isExpanded && (
            <div className="flex gap-0.5 mr-2">
              {agents.map((agent) => (
                <div
                  key={agent.type}
                  className={`
                    w-1.5 h-1.5 rounded-full transition-all duration-300
                    ${agent.status === 'passed' ? 'bg-emerald-500' : ''}
                    ${agent.status === 'failed' ? 'bg-red-500' : ''}
                    ${agent.status === 'warning' ? 'bg-amber-500' : ''}
                    ${agent.status === 'running' ? 'bg-violet-500 animate-pulse' : ''}
                    ${agent.status === 'idle' ? 'bg-slate-600' : ''}
                  `}
                />
              ))}
            </div>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(true);
            }}
            className="p-1 rounded hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>

          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
            <ChevronUp className="w-4 h-4 text-slate-400" />
          </motion.div>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/5">
              <VerificationSwarmStatus
                agents={agents}
                verdict={verdict}
                isRunning={isRunning}
                onRerun={fetchQualityStatus}
                compact={false}
              />
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 bg-slate-950/50">
              {lastChecked && (
                <span className="text-xs text-slate-500">
                  Last checked: {lastChecked.toLocaleTimeString()}
                </span>
              )}
              {onOpenReport && (
                <button
                  onClick={onOpenReport}
                  className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  <span>View Full Report</span>
                  <ExternalLink className="w-3 h-3" />
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

