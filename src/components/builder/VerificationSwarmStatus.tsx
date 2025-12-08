/**
 * Verification Swarm Status Component
 *
 * Live display of 6-agent verification swarm status.
 * Part of Phase 9: UI Enhancements
 */

import { useState } from 'react';
import {
    AlertTriangle, CheckCircle2, XCircle, Loader2,
    Bug, Code, Eye, Shield, FileText, Palette,
    ChevronDown, RefreshCw,
    LucideIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================================
// TYPES
// ============================================================================

export type VerificationAgentType =
    | 'error_checker'
    | 'code_quality'
    | 'visual_verifier'
    | 'security_scanner'
    | 'placeholder_eliminator'
    | 'design_style';

export type AgentStatus = 'idle' | 'running' | 'passed' | 'failed' | 'warning';

export interface AgentState {
    type: VerificationAgentType;
    status: AgentStatus;
    lastRun?: Date;
    score?: number;
    issues?: number;
    message?: string;
    details?: string[];
}

export interface SwarmVerdict {
    verdict: 'approved' | 'needs_work' | 'blocked' | 'rejected';
    message: string;
    overallScore: number;
}

interface VerificationSwarmStatusProps {
    agents: AgentState[];
    verdict?: SwarmVerdict;
    isRunning?: boolean;
    onRerun?: () => void;
    compact?: boolean;
}

// ============================================================================
// AGENT CONFIGURATION
// ============================================================================

const AGENT_CONFIG: Record<VerificationAgentType, {
    name: string;
    shortName: string;
    icon: LucideIcon;
    description: string;
    color: string;
    pollInterval: string;
}> = {
    error_checker: {
        name: 'Error Checker',
        shortName: 'Errors',
        icon: Bug,
        description: 'TypeScript, ESLint, runtime errors',
        color: 'red',
        pollInterval: '5s',
    },
    code_quality: {
        name: 'Code Quality',
        shortName: 'Quality',
        icon: Code,
        description: 'DRY, naming, organization',
        color: 'blue',
        pollInterval: '30s',
    },
    visual_verifier: {
        name: 'Visual Verifier',
        shortName: 'Visual',
        icon: Eye,
        description: 'Screenshot AI analysis',
        color: 'purple',
        pollInterval: '60s',
    },
    security_scanner: {
        name: 'Security Scanner',
        shortName: 'Security',
        icon: Shield,
        description: 'Vulnerabilities, secrets',
        color: 'amber',
        pollInterval: '60s',
    },
    placeholder_eliminator: {
        name: 'Placeholder Eliminator',
        shortName: 'Placeholders',
        icon: FileText,
        description: 'TODOs, lorem ipsum, mocks',
        color: 'rose',
        pollInterval: '10s',
    },
    design_style: {
        name: 'Design Style',
        shortName: 'Design',
        icon: Palette,
        description: 'Soul-appropriate design',
        color: 'cyan',
        pollInterval: 'on-feature',
    },
};

const AGENT_ORDER: VerificationAgentType[] = [
    'error_checker',
    'code_quality',
    'visual_verifier',
    'security_scanner',
    'placeholder_eliminator',
    'design_style',
];

// ============================================================================
// VERDICT BADGE
// ============================================================================

function VerdictBadge({ verdict }: { verdict: SwarmVerdict }) {
    const getVerdictStyles = () => {
        switch (verdict.verdict) {
            case 'approved':
                return {
                    bg: 'bg-emerald-500/20',
                    border: 'border-emerald-500/50',
                    text: 'text-emerald-400',
                    icon: CheckCircle2,
                };
            case 'needs_work':
                return {
                    bg: 'bg-amber-500/20',
                    border: 'border-amber-500/50',
                    text: 'text-amber-400',
                    icon: AlertTriangle,
                };
            case 'blocked':
                return {
                    bg: 'bg-red-500/20',
                    border: 'border-red-500/50',
                    text: 'text-red-400',
                    icon: XCircle,
                };
            case 'rejected':
                return {
                    bg: 'bg-rose-500/20',
                    border: 'border-rose-500/50',
                    text: 'text-rose-400',
                    icon: XCircle,
                };
        }
    };

    const styles = getVerdictStyles();
    const Icon = styles.icon;

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${styles.bg} border ${styles.border}`}>
            <Icon className={`w-4 h-4 ${styles.text}`} />
            <span className={`text-sm font-medium ${styles.text}`}>
                {verdict.verdict.replace('_', ' ').toUpperCase()}
            </span>
            <span className="text-xs text-slate-400">({verdict.overallScore})</span>
        </div>
    );
}

// ============================================================================
// AGENT CARD
// ============================================================================

function AgentCard({
    agent,
    config,
    expanded,
    onToggle,
}: {
    agent: AgentState;
    config: typeof AGENT_CONFIG[VerificationAgentType];
    expanded: boolean;
    onToggle: () => void;
}) {
    const Icon = config.icon;

    const getStatusStyles = () => {
        switch (agent.status) {
            case 'passed':
                return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: CheckCircle2, iconColor: 'text-emerald-400' };
            case 'failed':
                return { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: XCircle, iconColor: 'text-red-400' };
            case 'warning':
                return { bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: AlertTriangle, iconColor: 'text-amber-400' };
            case 'running':
                return { bg: `bg-${config.color}-500/10`, border: `border-${config.color}-500/30`, icon: Loader2, iconColor: `text-${config.color}-400` };
            default:
                return { bg: 'bg-slate-800/50', border: 'border-slate-700/50', icon: Icon, iconColor: 'text-slate-400' };
        }
    };

    const styles = getStatusStyles();
    const StatusIcon = styles.icon;

    return (
        <motion.div
            className={`rounded-lg ${styles.bg} border ${styles.border} overflow-hidden transition-all duration-200`}
            layout
        >
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg bg-${config.color}-500/20`}>
                        <Icon className={`w-4 h-4 text-${config.color}-400`} />
                    </div>
                    <div className="text-left">
                        <div className="text-sm font-medium text-white">{config.name}</div>
                        <div className="text-xs text-slate-500">{config.pollInterval}</div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {agent.score !== undefined && (
                        <span className={`text-sm font-mono ${agent.score >= 80 ? 'text-emerald-400' : agent.score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                            {agent.score}
                        </span>
                    )}
                    {agent.issues !== undefined && agent.issues > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                            {agent.issues} issues
                        </span>
                    )}
                    <StatusIcon className={`w-4 h-4 ${styles.iconColor} ${agent.status === 'running' ? 'animate-spin' : ''}`} />
                    <motion.div animate={{ rotate: expanded ? 180 : 0 }}>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                    </motion.div>
                </div>
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3 space-y-2">
                            <p className="text-xs text-slate-400">{config.description}</p>

                            {agent.message && (
                                <p className="text-xs text-slate-300">{agent.message}</p>
                            )}

                            {agent.details && agent.details.length > 0 && (
                                <div className="space-y-1">
                                    {agent.details.slice(0, 3).map((detail, i) => (
                                        <div key={i} className="flex items-start gap-2 text-xs">
                                            <span className="text-slate-500">•</span>
                                            <span className="text-slate-400">{detail}</span>
                                        </div>
                                    ))}
                                    {agent.details.length > 3 && (
                                        <div className="text-xs text-slate-500">
                                            +{agent.details.length - 3} more...
                                        </div>
                                    )}
                                </div>
                            )}

                            {agent.lastRun && (
                                <div className="text-[10px] text-slate-500">
                                    Last run: {formatTimeAgo(agent.lastRun)}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function VerificationSwarmStatus({
    agents,
    verdict,
    isRunning = false,
    onRerun,
    compact = false,
}: VerificationSwarmStatusProps) {
    const [expandedAgent, setExpandedAgent] = useState<VerificationAgentType | null>(null);

    // Build agent map
    const agentMap = new Map(agents.map(a => [a.type, a]));

    // Calculate stats
    const passedCount = agents.filter(a => a.status === 'passed').length;
    const failedCount = agents.filter(a => a.status === 'failed').length;
    const warningCount = agents.filter(a => a.status === 'warning').length;
    const runningCount = agents.filter(a => a.status === 'running').length;

    if (compact) {
        return (
            <div className="flex items-center gap-3">
                {/* Mini status dots */}
                <div className="flex gap-1">
                    {AGENT_ORDER.map((type) => {
                        const agent = agentMap.get(type);
                        const config = AGENT_CONFIG[type];

                        return (
                            <div
                                key={type}
                                title={config.name}
                                className={`
                                    w-2 h-2 rounded-full transition-all duration-300
                                    ${agent?.status === 'passed' ? 'bg-emerald-500' : ''}
                                    ${agent?.status === 'failed' ? 'bg-red-500' : ''}
                                    ${agent?.status === 'warning' ? 'bg-amber-500' : ''}
                                    ${agent?.status === 'running' ? `bg-${config.color}-500 animate-pulse` : ''}
                                    ${!agent || agent.status === 'idle' ? 'bg-slate-700' : ''}
                                `}
                            />
                        );
                    })}
                </div>

                {/* Summary */}
                <span className="text-xs text-slate-400">
                    {passedCount}/{AGENT_ORDER.length} passed
                </span>
            </div>
        );
    }

    return (
        <div className="rounded-xl bg-slate-900/50 backdrop-blur-xl border border-white/5 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
                            <Shield className="w-5 h-5 text-violet-400" />
                        </div>
                        {isRunning && (
                            <motion.div
                                className="absolute -top-1 -right-1 w-3 h-3 bg-violet-500 rounded-full"
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 1, repeat: Infinity }}
                            />
                        )}
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">Verification Swarm</h3>
                        <p className="text-xs text-slate-400">
                            {runningCount > 0
                                ? `${runningCount} agent${runningCount > 1 ? 's' : ''} running...`
                                : `${passedCount} passed, ${failedCount} failed, ${warningCount} warnings`
                            }
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {verdict && <VerdictBadge verdict={verdict} />}

                    {onRerun && (
                        <button
                            onClick={onRerun}
                            disabled={isRunning}
                            className={`
                                p-2 rounded-lg transition-all duration-200
                                ${isRunning
                                    ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                                }
                            `}
                        >
                            <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
                        </button>
                    )}
                </div>
            </div>

            {/* Agent List */}
            <div className="p-4 space-y-2">
                {AGENT_ORDER.map((type) => {
                    const agent = agentMap.get(type) || { type, status: 'idle' as AgentStatus };
                    const config = AGENT_CONFIG[type];

                    return (
                        <AgentCard
                            key={type}
                            agent={agent}
                            config={config}
                            expanded={expandedAgent === type}
                            onToggle={() => setExpandedAgent(expandedAgent === type ? null : type)}
                        />
                    );
                })}
            </div>

            {/* Overall Score Bar */}
            {verdict && (
                <div className="p-4 border-t border-white/5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400">Overall Score</span>
                        <span className="text-sm font-mono text-white">{verdict.overallScore}/100</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                            className={`h-full ${
                                verdict.overallScore >= 85 ? 'bg-emerald-500' :
                                verdict.overallScore >= 70 ? 'bg-amber-500' :
                                'bg-red-500'
                            }`}
                            initial={{ width: 0 }}
                            animate={{ width: `${verdict.overallScore}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{verdict.message}</p>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

export default VerificationSwarmStatus;

