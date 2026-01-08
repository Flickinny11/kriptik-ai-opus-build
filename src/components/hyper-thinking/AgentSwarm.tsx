/**
 * AgentSwarm - Visualize multi-agent reasoning work
 *
 * Shows parallel reasoning agents working on a problem:
 * - Agent cards with role and status
 * - Real-time insight generation
 * - Conflict visualization and resolution
 * - Synthesis progress
 *
 * Uses liquid glass styling consistent with KripTik dashboard.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User,
  Users,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Swords,
  Handshake,
  Crown,
  Microscope,
  Palette,
  Code2,
  Merge,
  MessageSquare,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type AgentRole = 'lead' | 'analyst' | 'critic' | 'creative' | 'implementer' | 'synthesizer';

export type AgentStatus = 'idle' | 'thinking' | 'contributing' | 'debating' | 'complete';

export interface SwarmAgent {
  id: string;
  role: AgentRole;
  status: AgentStatus;
  modelName?: string;
  insight?: string;
  confidence?: number;
  tokensUsed?: number;
}

export interface AgentConflict {
  id: string;
  agentIds: string[];
  description: string;
  resolved: boolean;
  resolution?: string;
}

export interface AgentSwarmProps {
  agents: SwarmAgent[];
  phase: 'initializing' | 'reasoning' | 'debating' | 'resolving' | 'synthesizing' | 'complete';
  conflicts: AgentConflict[];
  insights: string[];
  consensusLevel?: number;
  className?: string;
}

// ============================================================================
// Role Configuration
// ============================================================================

const ROLE_CONFIG: Record<AgentRole, {
  label: string;
  icon: typeof User;
  color: string;
  bgColor: string;
  description: string;
}> = {
  lead: {
    label: 'Lead',
    icon: Crown,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    description: 'Orchestrates the reasoning process',
  },
  analyst: {
    label: 'Analyst',
    icon: Microscope,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    description: 'Deep analysis and data examination',
  },
  critic: {
    label: 'Critic',
    icon: AlertTriangle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    description: 'Finds flaws and edge cases',
  },
  creative: {
    label: 'Creative',
    icon: Palette,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    description: 'Novel approaches and ideas',
  },
  implementer: {
    label: 'Implementer',
    icon: Code2,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    description: 'Practical implementation focus',
  },
  synthesizer: {
    label: 'Synthesizer',
    icon: Merge,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    description: 'Combines insights into final answer',
  },
};

const PHASE_CONFIG = {
  initializing: { label: 'Initializing Agents', icon: Users },
  reasoning: { label: 'Parallel Reasoning', icon: Lightbulb },
  debating: { label: 'Agent Debate', icon: MessageSquare },
  resolving: { label: 'Resolving Conflicts', icon: Handshake },
  synthesizing: { label: 'Synthesizing Answer', icon: Merge },
  complete: { label: 'Complete', icon: CheckCircle2 },
};

// ============================================================================
// Sub-Components
// ============================================================================

function AgentCard({ agent }: { agent: SwarmAgent }) {
  const config = ROLE_CONFIG[agent.role];
  const Icon = config.icon;

  const statusIndicator = () => {
    switch (agent.status) {
      case 'thinking':
        return (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="w-3 h-3 text-lime-400" />
          </motion.div>
        );
      case 'contributing':
        return <Lightbulb className="w-3 h-3 text-yellow-400" />;
      case 'debating':
        return <Swords className="w-3 h-3 text-orange-400" />;
      case 'complete':
        return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
      default:
        return <div className="w-3 h-3 rounded-full bg-white/20" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`
        relative p-3 rounded-xl border transition-all duration-300
        ${agent.status === 'thinking' 
          ? 'bg-white/10 border-lime-500/30 shadow-lg shadow-lime-500/10' 
          : agent.status === 'complete'
            ? 'bg-white/5 border-emerald-500/30'
            : 'bg-white/5 border-white/10'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${config.color}`}>
              {config.label}
            </span>
            {statusIndicator()}
          </div>
          {agent.modelName && (
            <span className="text-[10px] text-white/40 truncate">
              {agent.modelName}
            </span>
          )}
        </div>
      </div>

      {/* Insight */}
      {agent.insight && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 p-2 rounded-lg bg-white/5"
        >
          <p className="text-[11px] text-white/70 line-clamp-3">
            {agent.insight}
          </p>
        </motion.div>
      )}

      {/* Stats */}
      {(agent.confidence !== undefined || agent.tokensUsed !== undefined) && (
        <div className="mt-2 flex items-center gap-3 text-[10px] text-white/40">
          {agent.confidence !== undefined && (
            <span>{Math.round(agent.confidence * 100)}% confident</span>
          )}
          {agent.tokensUsed !== undefined && (
            <span>{agent.tokensUsed.toLocaleString()} tokens</span>
          )}
        </div>
      )}

      {/* Thinking animation */}
      {agent.status === 'thinking' && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, ${config.bgColor}, transparent)`,
          }}
          animate={{
            x: ['-100%', '100%'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      )}
    </motion.div>
  );
}

function ConflictCard({ conflict }: { conflict: AgentConflict }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`
        p-3 rounded-lg border transition-all
        ${conflict.resolved 
          ? 'bg-emerald-500/10 border-emerald-500/30' 
          : 'bg-orange-500/10 border-orange-500/30'
        }
      `}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {conflict.resolved ? (
          <Handshake className="w-4 h-4 text-emerald-400" />
        ) : (
          <Swords className="w-4 h-4 text-orange-400" />
        )}
        <span className={`text-xs font-medium ${conflict.resolved ? 'text-emerald-400' : 'text-orange-400'}`}>
          {conflict.resolved ? 'Resolved' : 'Active Conflict'}
        </span>
      </div>
      <p className="text-[11px] text-white/60 mb-1">
        {conflict.description}
      </p>
      {conflict.resolved && conflict.resolution && (
        <p className="text-[10px] text-emerald-400/80 mt-1.5 pl-2 border-l border-emerald-500/30">
          {conflict.resolution}
        </p>
      )}
    </motion.div>
  );
}

function InsightsList({ insights }: { insights: string[] }) {
  return (
    <div className="space-y-2">
      {insights.slice(-5).map((insight, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="flex items-start gap-2 p-2 rounded-lg bg-white/5"
        >
          <Lightbulb className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-white/70">{insight}</p>
        </motion.div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentSwarm({
  agents,
  phase,
  conflicts,
  insights,
  consensusLevel,
  className = '',
}: AgentSwarmProps) {
  const phaseConfig = PHASE_CONFIG[phase];
  const PhaseIcon = phaseConfig.icon;
  
  const activeAgents = agents.filter(a => a.status === 'thinking' || a.status === 'contributing');
  const completedAgents = agents.filter(a => a.status === 'complete');
  const unresolvedConflicts = conflicts.filter(c => !c.resolved);

  return (
    <div 
      className={`relative ${className}`}
      style={{
        background: 'linear-gradient(145deg, rgba(20,20,25,0.98) 0%, rgba(12,12,16,0.99) 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(40px)',
      }}
    >
      {/* Ambient glow for active state */}
      {phase !== 'complete' && (
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(168, 85, 247, 0.2), transparent 70%)',
          }}
        />
      )}

      {/* Header */}
      <div className="relative px-5 py-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <PhaseIcon className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">🐝</span>
                <h3 className="text-sm font-medium text-white">
                  {phaseConfig.label}
                </h3>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-[11px] text-white/50">
                <span>{agents.length} agents</span>
                <span>{activeAgents.length} active</span>
                <span>{completedAgents.length} complete</span>
              </div>
            </div>
          </div>

          {/* Consensus meter */}
          {consensusLevel !== undefined && (
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-white/40 mb-1">Consensus</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${consensusLevel * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="text-xs text-white/60 font-mono">
                  {Math.round(consensusLevel * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Agent grid */}
        <div>
          <h4 className="text-xs font-medium text-white/60 mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Active Agents
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {agents.map(agent => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </div>

        {/* Conflicts section */}
        {conflicts.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-white/60 mb-2 flex items-center gap-1.5">
              <Swords className="w-3.5 h-3.5" />
              Conflicts ({unresolvedConflicts.length} unresolved)
            </h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {conflicts.map(conflict => (
                <ConflictCard key={conflict.id} conflict={conflict} />
              ))}
            </div>
          </div>
        )}

        {/* Insights section */}
        {insights.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-white/60 mb-2 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" />
              Shared Insights ({insights.length})
            </h4>
            <InsightsList insights={insights} />
          </div>
        )}
      </div>

      {/* Phase progress */}
      <div className="px-5 py-3 border-t border-white/5">
        <div className="flex items-center justify-between text-[10px] text-white/40">
          <span>Phase: {phase}</span>
          {phase === 'complete' && (
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              Synthesis complete
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default AgentSwarm;
