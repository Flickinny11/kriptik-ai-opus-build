/**
 * Verification Dashboard - SESSION 5
 *
 * Real-time display of 6-agent Verification Swarm status.
 * Shows each agent's status, score, and issue count.
 * Updates during continuous verification in Phase 2.
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Shield,
  Code2,
  Eye,
  Palette,
  FileSearch,
  Zap,
  type LucideIcon,
} from 'lucide-react';

interface VerificationAgentResult {
  passed: boolean;
  score?: number;
  errors?: number;
  issues?: number;
  found?: number;
}

interface VerificationResults {
  errorChecker: VerificationAgentResult | null;
  codeQuality: VerificationAgentResult | null;
  visual: VerificationAgentResult | null;
  security: VerificationAgentResult | null;
  placeholders: VerificationAgentResult | null;
  antiSlop: VerificationAgentResult | null;
}

interface VerificationDashboardProps {
  results: VerificationResults | null;
  isRunning: boolean;
  overallScore?: number;
  lastCheckTime?: Date;
}

interface AgentConfig {
  key: keyof VerificationResults;
  name: string;
  icon: LucideIcon;
  getValue: (result: VerificationAgentResult) => string;
  getStatus: (result: VerificationAgentResult) => 'pass' | 'fail' | 'warn';
}

const agents: AgentConfig[] = [
  {
    key: 'errorChecker',
    name: 'Errors',
    icon: AlertCircle,
    getValue: (r) => r.errors === 0 ? '0' : `${r.errors}`,
    getStatus: (r) => r.passed ? 'pass' : 'fail',
  },
  {
    key: 'codeQuality',
    name: 'Quality',
    icon: Code2,
    getValue: (r) => r.score !== undefined ? `${r.score}%` : '-',
    getStatus: (r) => r.passed ? 'pass' : (r.score && r.score >= 60 ? 'warn' : 'fail'),
  },
  {
    key: 'visual',
    name: 'Visual',
    icon: Eye,
    getValue: (r) => r.score !== undefined ? `${r.score}%` : '-',
    getStatus: (r) => r.passed ? 'pass' : (r.score && r.score >= 60 ? 'warn' : 'fail'),
  },
  {
    key: 'security',
    name: 'Security',
    icon: Shield,
    getValue: (r) => r.issues === 0 ? 'OK' : `${r.issues}`,
    getStatus: (r) => r.passed ? 'pass' : 'fail',
  },
  {
    key: 'placeholders',
    name: 'Placeholders',
    icon: FileSearch,
    getValue: (r) => r.found === 0 ? '0' : `${r.found}`,
    getStatus: (r) => r.passed ? 'pass' : 'fail',
  },
  {
    key: 'antiSlop',
    name: 'Anti-Slop',
    icon: Palette,
    getValue: (r) => r.score !== undefined ? `${r.score}%` : '-',
    getStatus: (r) => r.passed ? 'pass' : (r.score && r.score >= 60 ? 'warn' : 'fail'),
  },
];

function getStatusColor(status: 'pass' | 'fail' | 'warn' | null): string {
  switch (status) {
    case 'pass':
      return 'bg-green-900/30 border-green-700/50';
    case 'fail':
      return 'bg-red-900/30 border-red-700/50';
    case 'warn':
      return 'bg-amber-900/30 border-amber-700/50';
    default:
      return 'bg-gray-800 border-gray-700';
  }
}

function getStatusTextColor(status: 'pass' | 'fail' | 'warn' | null): string {
  switch (status) {
    case 'pass':
      return 'text-green-400';
    case 'fail':
      return 'text-red-400';
    case 'warn':
      return 'text-amber-400';
    default:
      return 'text-gray-500';
  }
}

export function VerificationDashboard({
  results,
  isRunning,
  overallScore,
  lastCheckTime,
}: VerificationDashboardProps) {
  const allPassed = results
    ? Object.values(results).every(r => r === null || r.passed)
    : false;

  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-blue-400" />
          <span className="text-sm font-medium text-gray-200">Verification Swarm</span>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1 text-xs text-amber-400"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-amber-400"
              />
              Running
            </motion.div>
          )}
          {overallScore !== undefined && (
            <span className={`text-xs font-medium ${overallScore >= 85 ? 'text-green-400' : overallScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
              {overallScore}%
            </span>
          )}
        </div>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-6 gap-1.5">
        <AnimatePresence>
          {agents.map(agent => {
            const result = results?.[agent.key];
            const status = result ? agent.getStatus(result) : null;
            const Icon = agent.icon;

            return (
              <motion.div
                key={agent.key}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`p-2 rounded-lg border text-center ${getStatusColor(status)}`}
              >
                <Icon
                  size={18}
                  className={`mx-auto mb-1 ${status ? getStatusTextColor(status) : 'text-gray-500'}`}
                />
                <div className="text-[10px] text-gray-400 truncate">{agent.name}</div>
                {result && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`text-xs font-medium mt-0.5 ${getStatusTextColor(status)}`}
                  >
                    {agent.getValue(result)}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Status Summary */}
      {results && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 pt-2 border-t border-gray-700"
        >
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              {allPassed ? (
                <>
                  <CheckCircle2 size={14} className="text-green-400" />
                  <span className="text-green-400">All checks passed</span>
                </>
              ) : (
                <>
                  <AlertCircle size={14} className="text-red-400" />
                  <span className="text-red-400">Issues detected</span>
                </>
              )}
            </div>
            {lastCheckTime && (
              <span className="text-gray-500">
                Last check: {lastCheckTime.toLocaleTimeString()}
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {!results && !isRunning && (
        <div className="text-center py-2">
          <p className="text-xs text-gray-500">Waiting for verification...</p>
        </div>
      )}
    </div>
  );
}

export default VerificationDashboard;
