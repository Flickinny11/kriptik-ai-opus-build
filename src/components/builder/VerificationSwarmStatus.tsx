/**
 * Verification Swarm Status Component - Premium Liquid Glass
 *
 * Design: Photorealistic liquid glass with visible 3D edges
 * Colors: Warm amber/copper glow (NO purple)
 * Typography: Cal Sans / Outfit
 * Icons: Custom white, black, and red geometric icons
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './VerificationSwarmStatus.css';

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
// CUSTOM ICONS - White, Black, Red geometric designs
// ============================================================================

const SwarmLogo = () => (
    <svg viewBox="0 0 28 28" fill="none" className="swarm-panel__logo-icon">
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

const AgentIcons: Record<VerificationAgentType, React.FC<{ className?: string }>> = {
    error_checker: ({ className }) => (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
            <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" stroke="#1a1a1a" strokeWidth="1.5" fill="rgba(255,255,255,0.4)" />
            <path d="M12 6v6" stroke="#c41e3a" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="16" r="1.5" fill="#c41e3a" />
        </svg>
    ),
    code_quality: ({ className }) => (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
            <rect x="3" y="3" width="18" height="18" rx="3" stroke="#1a1a1a" strokeWidth="1.5" fill="rgba(255,255,255,0.4)" />
            <path d="M7 8l3 3-3 3" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13 14h4" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="18" cy="6" r="2" fill="#c41e3a" />
        </svg>
    ),
    visual_verifier: ({ className }) => (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
            <circle cx="12" cy="12" r="9" stroke="#1a1a1a" strokeWidth="1.5" fill="rgba(255,255,255,0.4)" />
            <circle cx="12" cy="12" r="5" stroke="#1a1a1a" strokeWidth="1.5" fill="none" />
            <circle cx="12" cy="12" r="2" fill="#c41e3a" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2" stroke="#1a1a1a" strokeWidth="1" />
        </svg>
    ),
    security_scanner: ({ className }) => (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
            <path d="M12 2L4 6v6c0 5.5 3.5 10 8 11 4.5-1 8-5.5 8-11V6l-8-4z" stroke="#1a1a1a" strokeWidth="1.5" fill="rgba(255,255,255,0.4)" />
            <path d="M9 12l2 2 4-4" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="7" r="1.5" fill="#c41e3a" />
        </svg>
    ),
    placeholder_eliminator: ({ className }) => (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
            <rect x="4" y="4" width="16" height="16" rx="2" stroke="#1a1a1a" strokeWidth="1.5" fill="rgba(255,255,255,0.4)" />
            <path d="M8 8h8M8 12h6M8 16h4" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M16 14l3 3M19 14l-3 3" stroke="#c41e3a" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    ),
    design_style: ({ className }) => (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
            <path d="M12 2L4 6l8 4 8-4-8-4z" fill="rgba(255,255,255,0.5)" stroke="#1a1a1a" strokeWidth="1" />
            <path d="M4 10l8 4 8-4" stroke="#1a1a1a" strokeWidth="1.5" />
            <path d="M4 14l8 4 8-4" stroke="#1a1a1a" strokeWidth="1.5" />
            <circle cx="12" cy="10" r="2" fill="#c41e3a" />
        </svg>
    ),
};

// Status icons - Clean geometric
const StatusIcons = {
    passed: () => (
        <svg viewBox="0 0 18 18" fill="none" className="w-[18px] h-[18px]">
            <circle cx="9" cy="9" r="8" stroke="#1a8754" strokeWidth="1.5" fill="rgba(26, 135, 84, 0.1)" />
            <path d="M5.5 9l2.5 2.5 4.5-5" stroke="#1a8754" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    failed: () => (
        <svg viewBox="0 0 18 18" fill="none" className="w-[18px] h-[18px]">
            <circle cx="9" cy="9" r="8" stroke="#c41e3a" strokeWidth="1.5" fill="rgba(196, 30, 58, 0.1)" />
            <path d="M6 6l6 6M12 6l-6 6" stroke="#c41e3a" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    ),
    warning: () => (
        <svg viewBox="0 0 18 18" fill="none" className="w-[18px] h-[18px]">
            <path d="M9 2L1 16h16L9 2z" stroke="#cc7722" strokeWidth="1.5" fill="rgba(204, 119, 34, 0.1)" strokeLinejoin="round" />
            <path d="M9 7v4" stroke="#cc7722" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="9" cy="13" r="1" fill="#cc7722" />
        </svg>
    ),
    running: () => (
        <svg viewBox="0 0 18 18" fill="none" className="w-[18px] h-[18px] animate-spin">
            <circle cx="9" cy="9" r="7" stroke="rgba(255, 140, 80, 0.25)" strokeWidth="2" fill="none" />
            <path d="M9 2a7 7 0 0 1 7 7" stroke="#ff8c50" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
    ),
    idle: () => (
        <svg viewBox="0 0 18 18" fill="none" className="w-[18px] h-[18px]">
            <circle cx="9" cy="9" r="7" stroke="#a0a0a0" strokeWidth="1.5" fill="rgba(160, 160, 160, 0.1)" />
            <circle cx="9" cy="9" r="2.5" fill="#a0a0a0" />
        </svg>
    ),
};

// ============================================================================
// AGENT CONFIGURATION
// ============================================================================

const AGENT_CONFIG: Record<VerificationAgentType, {
    name: string;
    shortName: string;
    description: string;
    interval: string;
}> = {
    error_checker: {
        name: 'Error Checker',
        shortName: 'Errors',
        description: 'TypeScript, ESLint, runtime errors',
        interval: '5s',
    },
    code_quality: {
        name: 'Code Quality',
        shortName: 'Quality',
        description: 'DRY, naming, organization',
        interval: '30s',
    },
    visual_verifier: {
        name: 'Visual Verifier',
        shortName: 'Visual',
        description: 'Screenshot AI analysis',
        interval: '60s',
    },
    security_scanner: {
        name: 'Security Scanner',
        shortName: 'Security',
        description: 'Vulnerabilities, secrets',
        interval: '60s',
    },
    placeholder_eliminator: {
        name: 'Placeholder Eliminator',
        shortName: 'Placeholders',
        description: 'TODOs, lorem ipsum, mocks',
        interval: '10s',
    },
    design_style: {
        name: 'Design Style',
        shortName: 'Design',
        description: 'Soul-appropriate design',
        interval: 'on-feature',
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
    const config = {
        approved: { bg: 'linear-gradient(135deg, #1a8754, #22a366)', text: 'APPROVED' },
        needs_work: { bg: 'linear-gradient(135deg, #cc7722, #e8973d)', text: 'NEEDS WORK' },
        blocked: { bg: 'linear-gradient(135deg, #c41e3a, #e63950)', text: 'BLOCKED' },
        rejected: { bg: 'linear-gradient(135deg, #8b0000, #c41e3a)', text: 'REJECTED' },
    }[verdict.verdict];

    return (
        <motion.div
            className="verdict-badge"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ background: config.bg }}
            whileHover={{ scale: 1.02, y: -1 }}
            transition={{ type: 'spring', stiffness: 400 }}
        >
            <span className="verdict-badge__text">{config.text}</span>
            <span className="verdict-badge__score">{verdict.overallScore}</span>
        </motion.div>
    );
}

// ============================================================================
// AGENT CARD
// ============================================================================

function AgentCard({
    agent,
    config,
    type,
    expanded,
    onToggle,
    index,
}: {
    agent: AgentState;
    config: typeof AGENT_CONFIG[VerificationAgentType];
    type: VerificationAgentType;
    expanded: boolean;
    onToggle: () => void;
    index: number;
}) {
    const Icon = AgentIcons[type];
    const StatusIcon = StatusIcons[agent.status];

    return (
        <motion.div
            className={`agent-card agent-card--${agent.status}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            layout
        >
            <button onClick={onToggle} className="agent-card__content">
                {/* Icon */}
                <div className="agent-card__icon-container">
                    <div className="agent-card__icon-glow" />
                    <Icon className="agent-card__icon" />
                </div>

                {/* Info */}
                <div className="agent-card__info">
                    <div className="agent-card__name">{config.name}</div>
                    <div className="agent-card__interval">{config.interval}</div>
                </div>

                {/* Stats */}
                <div className="agent-card__stats">
                    {agent.score !== undefined && (
                        <motion.div 
                            className={`agent-card__score ${
                                agent.score >= 80 ? 'agent-card__score--good' : 
                                agent.score >= 60 ? 'agent-card__score--warn' : 
                                'agent-card__score--bad'
                            }`}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, delay: index * 0.05 + 0.1 }}
                        >
                            {agent.score}
                        </motion.div>
                    )}
                    {agent.issues !== undefined && agent.issues > 0 && (
                        <motion.div 
                            className="agent-card__issues"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            whileHover={{ scale: 1.1 }}
                        >
                            {agent.issues}
                        </motion.div>
                    )}
                    <StatusIcon />
                    <motion.div 
                        className="agent-card__chevron"
                        animate={{ rotate: expanded ? 180 : 0 }}
                        transition={{ duration: 0.25 }}
                    >
                        <svg viewBox="0 0 14 14" fill="none" className="w-4 h-4">
                            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </motion.div>
                </div>
            </button>

            {/* Expanded details */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        className="agent-card__details"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                    >
                        <div className="agent-card__details-inner">
                            <p className="agent-card__description">{config.description}</p>

                            {agent.message && (
                                <p className="agent-card__message">{agent.message}</p>
                            )}

                            {agent.details && agent.details.length > 0 && (
                                <div className="agent-card__detail-list">
                                    {agent.details.slice(0, 3).map((detail, i) => (
                                        <motion.div 
                                            key={i} 
                                            className="agent-card__detail-item"
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                        >
                                            <span className="agent-card__detail-dot" />
                                            <span>{detail}</span>
                                        </motion.div>
                                    ))}
                                    {agent.details.length > 3 && (
                                        <div className="agent-card__detail-more">
                                            +{agent.details.length - 3} more...
                                        </div>
                                    )}
                                </div>
                            )}

                            {agent.lastRun && (
                                <div className="agent-card__timestamp">
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
            <div className="swarm-compact">
                <div className="swarm-compact__orbs">
                    {AGENT_ORDER.map((type, i) => {
                        const agent = agentMap.get(type);
                        const status = agent?.status || 'idle';

                        return (
                            <motion.div
                                key={type}
                                className={`swarm-compact__orb swarm-compact__orb--${status}`}
                                title={AGENT_CONFIG[type].name}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: i * 0.04, type: 'spring', stiffness: 400 }}
                                whileHover={{ scale: 1.4, y: -3 }}
                            />
                        );
                    })}
                </div>
                <span className="swarm-compact__summary">
                    {passedCount}/{AGENT_ORDER.length} passed
                </span>
            </div>
        );
    }

    return (
        <div className={`swarm-panel ${isRunning ? 'swarm-panel--running' : ''}`}>
            {/* Header */}
            <div className="swarm-panel__header">
                <div className="swarm-panel__header-left">
                    <div className="swarm-panel__logo">
                        <SwarmLogo />
                        <div className="swarm-panel__logo-pulse" />
                    </div>
                    <div className="swarm-panel__title-area">
                        <h3 className="swarm-panel__title">Verification Swarm</h3>
                        <p className="swarm-panel__subtitle">
                            {runningCount > 0
                                ? `${runningCount} agent${runningCount > 1 ? 's' : ''} scanning...`
                                : `${passedCount} passed · ${failedCount} failed · ${warningCount} warnings`
                            }
                        </p>
                    </div>
                </div>

                <div className="swarm-panel__header-right">
                    {verdict && <VerdictBadge verdict={verdict} />}

                    {onRerun && (
                        <motion.button
                            onClick={onRerun}
                            disabled={isRunning}
                            className="swarm-panel__rerun"
                            whileHover={{ scale: 1.05, y: -1 }}
                            whileTap={{ scale: 0.95, y: 1 }}
                        >
                            <svg 
                                viewBox="0 0 20 20" 
                                fill="none" 
                                className={`w-5 h-5 ${isRunning ? 'animate-spin' : ''}`}
                            >
                                <path 
                                    d="M4 10a6 6 0 0 1 10.5-4M16 10a6 6 0 0 1-10.5 4" 
                                    stroke="currentColor" 
                                    strokeWidth="1.5" 
                                    strokeLinecap="round"
                                />
                                <path 
                                    d="M14 4l2 2-2 2M6 12l-2 2 2 2" 
                                    stroke="currentColor" 
                                    strokeWidth="1.5" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round" 
                                />
                            </svg>
                        </motion.button>
                    )}
                </div>
            </div>

            {/* Agent List */}
            <div className="swarm-panel__agents">
                {AGENT_ORDER.map((type, index) => {
                    const agent = agentMap.get(type) || { type, status: 'idle' as AgentStatus };
                    const config = AGENT_CONFIG[type];

                    return (
                        <AgentCard
                            key={type}
                            agent={agent}
                            config={config}
                            type={type}
                            expanded={expandedAgent === type}
                            onToggle={() => setExpandedAgent(expandedAgent === type ? null : type)}
                            index={index}
                        />
                    );
                })}
            </div>

            {/* Overall Score Bar */}
            {verdict && (
                <div className="swarm-panel__score-section">
                    <div className="swarm-panel__score-header">
                        <span className="swarm-panel__score-label">Overall Score</span>
                        <span className="swarm-panel__score-value">{verdict.overallScore}/100</span>
                    </div>
                    <div className="swarm-panel__score-track">
                        <motion.div
                            className={`swarm-panel__score-fill ${
                                verdict.overallScore >= 85 ? 'swarm-panel__score-fill--good' :
                                verdict.overallScore >= 70 ? 'swarm-panel__score-fill--warn' :
                                'swarm-panel__score-fill--bad'
                            }`}
                            initial={{ width: 0 }}
                            animate={{ width: `${verdict.overallScore}%` }}
                            transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                        />
                    </div>
                    <p className="swarm-panel__score-message">{verdict.message}</p>
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
