/**
 * Verification Swarm Status Component - Premium Edition
 *
 * Stunning, dynamic 6-agent verification swarm display.
 * Features:
 * - Custom geometric SVG icons
 * - Atmospheric gradients and glows
 * - Microanimations and hover effects
 * - Semitranslucent glass textures
 * - High-tech premium aesthetics
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
// CUSTOM 3D GEOMETRIC ICONS
// ============================================================================

const AgentIcons: Record<VerificationAgentType, React.FC<{ className?: string; isActive?: boolean }>> = {
    error_checker: ({ className, isActive }) => (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
            <defs>
                <linearGradient id="error-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={isActive ? "#ef4444" : "#64748b"} />
                    <stop offset="100%" stopColor={isActive ? "#f97316" : "#475569"} />
                </linearGradient>
            </defs>
            <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" stroke="url(#error-grad)" strokeWidth="1.5" fill="none" />
            <path d="M12 6v6M12 16v.01" stroke="url(#error-grad)" strokeWidth="2" strokeLinecap="round" />
            <path d="M7 9.5l5 2.5 5-2.5" stroke="url(#error-grad)" strokeWidth="1" opacity="0.5" />
        </svg>
    ),
    code_quality: ({ className, isActive }) => (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
            <defs>
                <linearGradient id="quality-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={isActive ? "#3b82f6" : "#64748b"} />
                    <stop offset="100%" stopColor={isActive ? "#8b5cf6" : "#475569"} />
                </linearGradient>
            </defs>
            <rect x="3" y="3" width="18" height="18" rx="3" stroke="url(#quality-grad)" strokeWidth="1.5" fill="none" />
            <path d="M7 8l3 3-3 3M12 14h5" stroke="url(#quality-grad)" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="18" cy="6" r="2" fill={isActive ? "#3b82f6" : "#475569"} opacity="0.6" />
        </svg>
    ),
    visual_verifier: ({ className, isActive }) => (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
            <defs>
                <linearGradient id="visual-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={isActive ? "#a855f7" : "#64748b"} />
                    <stop offset="100%" stopColor={isActive ? "#ec4899" : "#475569"} />
                </linearGradient>
            </defs>
            <circle cx="12" cy="12" r="9" stroke="url(#visual-grad)" strokeWidth="1.5" fill="none" />
            <circle cx="12" cy="12" r="5" stroke="url(#visual-grad)" strokeWidth="1.5" fill="none" />
            <circle cx="12" cy="12" r="2" fill="url(#visual-grad)" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2" stroke="url(#visual-grad)" strokeWidth="1" opacity="0.5" />
        </svg>
    ),
    security_scanner: ({ className, isActive }) => (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
            <defs>
                <linearGradient id="security-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={isActive ? "#f59e0b" : "#64748b"} />
                    <stop offset="100%" stopColor={isActive ? "#ef4444" : "#475569"} />
                </linearGradient>
            </defs>
            <path d="M12 2L4 6v6c0 5.5 3.5 10 8 11 4.5-1 8-5.5 8-11V6l-8-4z" stroke="url(#security-grad)" strokeWidth="1.5" fill="none" />
            <path d="M9 12l2 2 4-4" stroke="url(#security-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="8" r="1" fill={isActive ? "#f59e0b" : "#475569"} opacity="0.6" />
        </svg>
    ),
    placeholder_eliminator: ({ className, isActive }) => (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
            <defs>
                <linearGradient id="placeholder-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={isActive ? "#f43f5e" : "#64748b"} />
                    <stop offset="100%" stopColor={isActive ? "#fb923c" : "#475569"} />
                </linearGradient>
            </defs>
            <rect x="4" y="4" width="16" height="16" rx="2" stroke="url(#placeholder-grad)" strokeWidth="1.5" fill="none" />
            <path d="M8 8h8M8 12h6M8 16h4" stroke="url(#placeholder-grad)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M16 14l4 4M20 14l-4 4" stroke={isActive ? "#f43f5e" : "#64748b"} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    ),
    design_style: ({ className, isActive }) => (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
            <defs>
                <linearGradient id="design-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={isActive ? "#06b6d4" : "#64748b"} />
                    <stop offset="100%" stopColor={isActive ? "#10b981" : "#475569"} />
                </linearGradient>
            </defs>
            <path d="M12 2L4 6l8 4 8-4-8-4z" fill="url(#design-grad)" opacity="0.3" />
            <path d="M4 10l8 4 8-4" stroke="url(#design-grad)" strokeWidth="1.5" fill="none" />
            <path d="M4 14l8 4 8-4" stroke="url(#design-grad)" strokeWidth="1.5" fill="none" />
            <circle cx="12" cy="10" r="2" fill={isActive ? "#06b6d4" : "#475569"} />
        </svg>
    ),
};

// Status indicator icons
const StatusIcons = {
    passed: () => (
        <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
            <circle cx="8" cy="8" r="7" stroke="#10b981" strokeWidth="1.5" fill="rgba(16, 185, 129, 0.15)" />
            <path d="M5 8l2 2 4-4" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    failed: () => (
        <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
            <circle cx="8" cy="8" r="7" stroke="#ef4444" strokeWidth="1.5" fill="rgba(239, 68, 68, 0.15)" />
            <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    ),
    warning: () => (
        <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
            <path d="M8 2L1 14h14L8 2z" stroke="#f59e0b" strokeWidth="1.5" fill="rgba(245, 158, 11, 0.15)" />
            <path d="M8 6v4M8 12v.01" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    ),
    running: () => (
        <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 animate-spin">
            <circle cx="8" cy="8" r="6" stroke="rgba(139, 92, 246, 0.3)" strokeWidth="2" fill="none" />
            <path d="M8 2a6 6 0 0 1 6 6" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
    ),
    idle: () => (
        <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
            <circle cx="8" cy="8" r="6" stroke="#475569" strokeWidth="1.5" fill="rgba(71, 85, 105, 0.15)" />
            <circle cx="8" cy="8" r="2" fill="#475569" />
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
    gradient: string;
    glowColor: string;
    interval: string;
}> = {
    error_checker: {
        name: 'Error Checker',
        shortName: 'Errors',
        description: 'TypeScript, ESLint, runtime errors',
        gradient: 'from-red-500/20 via-orange-500/10 to-transparent',
        glowColor: 'rgba(239, 68, 68, 0.4)',
        interval: '5s',
    },
    code_quality: {
        name: 'Code Quality',
        shortName: 'Quality',
        description: 'DRY, naming, organization',
        gradient: 'from-blue-500/20 via-violet-500/10 to-transparent',
        glowColor: 'rgba(59, 130, 246, 0.4)',
        interval: '30s',
    },
    visual_verifier: {
        name: 'Visual Verifier',
        shortName: 'Visual',
        description: 'Screenshot AI analysis',
        gradient: 'from-purple-500/20 via-pink-500/10 to-transparent',
        glowColor: 'rgba(168, 85, 247, 0.4)',
        interval: '60s',
    },
    security_scanner: {
        name: 'Security Scanner',
        shortName: 'Security',
        description: 'Vulnerabilities, secrets',
        gradient: 'from-amber-500/20 via-red-500/10 to-transparent',
        glowColor: 'rgba(245, 158, 11, 0.4)',
        interval: '60s',
    },
    placeholder_eliminator: {
        name: 'Placeholder Eliminator',
        shortName: 'Placeholders',
        description: 'TODOs, lorem ipsum, mocks',
        gradient: 'from-rose-500/20 via-orange-500/10 to-transparent',
        glowColor: 'rgba(244, 63, 94, 0.4)',
        interval: '10s',
    },
    design_style: {
        name: 'Design Style',
        shortName: 'Design',
        description: 'Soul-appropriate design',
        gradient: 'from-cyan-500/20 via-emerald-500/10 to-transparent',
        glowColor: 'rgba(6, 182, 212, 0.4)',
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
// VERDICT BADGE - Premium Version
// ============================================================================

function VerdictBadge({ verdict }: { verdict: SwarmVerdict }) {
    const config = {
        approved: {
            gradient: 'from-emerald-600 to-green-500',
            glow: 'rgba(16, 185, 129, 0.5)',
            text: 'APPROVED',
        },
        needs_work: {
            gradient: 'from-amber-600 to-yellow-500',
            glow: 'rgba(245, 158, 11, 0.5)',
            text: 'NEEDS WORK',
        },
        blocked: {
            gradient: 'from-red-600 to-orange-500',
            glow: 'rgba(239, 68, 68, 0.5)',
            text: 'BLOCKED',
        },
        rejected: {
            gradient: 'from-rose-600 to-red-500',
            glow: 'rgba(244, 63, 94, 0.5)',
            text: 'REJECTED',
        },
    }[verdict.verdict];

    return (
        <motion.div
            className="verdict-badge"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
                background: `linear-gradient(135deg, ${config.gradient.replace('from-', '').replace(' to-', ', ')})`,
                boxShadow: `0 0 20px ${config.glow}, inset 0 1px 0 rgba(255,255,255,0.2)`,
            }}
        >
            <span className="verdict-badge__text">{config.text}</span>
            <span className="verdict-badge__score">{verdict.overallScore}</span>
        </motion.div>
    );
}

// ============================================================================
// AGENT CARD - Premium Version
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
    const isActive = agent.status !== 'idle';

    return (
        <motion.div
            className={`agent-card agent-card--${agent.status}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            layout
        >
            {/* Atmospheric gradient background */}
            <div 
                className="agent-card__atmosphere"
                style={{
                    background: isActive 
                        ? `radial-gradient(ellipse at 0% 50%, ${config.glowColor} 0%, transparent 70%)`
                        : 'none',
                }}
            />

            {/* Glass texture layer */}
            <div className="agent-card__glass" />

            {/* Content */}
            <button
                onClick={onToggle}
                className="agent-card__content"
            >
                {/* Icon with glow */}
                <div className="agent-card__icon-container">
                    <div 
                        className="agent-card__icon-glow"
                        style={{
                            background: isActive ? config.glowColor : 'transparent',
                            opacity: isActive ? 0.6 : 0,
                        }}
                    />
                    <Icon className="agent-card__icon" isActive={isActive} />
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
                            transition={{ type: 'spring', stiffness: 500 }}
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
                        transition={{ duration: 0.2 }}
                    >
                        <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
                        transition={{ duration: 0.2 }}
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

            {/* Edge highlights */}
            <div className="agent-card__edge-top" />
            <div className="agent-card__edge-left" />
        </motion.div>
    );
}

// ============================================================================
// MAIN COMPONENT - Premium Version
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
                {/* Animated status orbs */}
                <div className="swarm-compact__orbs">
                    {AGENT_ORDER.map((type, i) => {
                        const agent = agentMap.get(type);
                        const config = AGENT_CONFIG[type];
                        const status = agent?.status || 'idle';

                        return (
                            <motion.div
                                key={type}
                                className={`swarm-compact__orb swarm-compact__orb--${status}`}
                                title={config.name}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: i * 0.05, type: 'spring' }}
                                whileHover={{ scale: 1.3, y: -2 }}
                                style={{
                                    boxShadow: status !== 'idle' 
                                        ? `0 0 8px ${config.glowColor}, 0 0 2px ${config.glowColor}`
                                        : 'none',
                                }}
                            />
                        );
                    })}
                </div>

                {/* Summary text */}
                <span className="swarm-compact__summary">
                    {passedCount}/{AGENT_ORDER.length} passed
                </span>
            </div>
        );
    }

    return (
        <div className="swarm-panel">
            {/* Atmospheric background */}
            <div className="swarm-panel__atmosphere">
                <div className="swarm-panel__gradient-1" />
                <div className="swarm-panel__gradient-2" />
                <div className="swarm-panel__noise" />
            </div>

            {/* Header */}
            <div className="swarm-panel__header">
                <div className="swarm-panel__header-left">
                    {/* Animated hexagon logo */}
                    <div className="swarm-panel__logo">
                        <svg viewBox="0 0 32 32" fill="none" className="swarm-panel__logo-icon">
                            <defs>
                                <linearGradient id="swarm-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#8b5cf6" />
                                    <stop offset="50%" stopColor="#a855f7" />
                                    <stop offset="100%" stopColor="#c084fc" />
                                </linearGradient>
                            </defs>
                            <path 
                                d="M16 2L28 9v14l-12 7L4 23V9l12-7z" 
                                stroke="url(#swarm-logo-grad)" 
                                strokeWidth="2" 
                                fill="rgba(139, 92, 246, 0.15)"
                            />
                            <path 
                                d="M16 8L22 11.5v7L16 22l-6-3.5v-7L16 8z" 
                                fill="url(#swarm-logo-grad)"
                                opacity="0.6"
                            />
                            <circle cx="16" cy="15" r="3" fill="url(#swarm-logo-grad)" />
                        </svg>
                        {isRunning && (
                            <motion.div
                                className="swarm-panel__logo-pulse"
                                animate={{ scale: [1, 1.4, 1], opacity: [0.8, 0, 0.8] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                        )}
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
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <svg viewBox="0 0 20 20" fill="none" className={`w-5 h-5 ${isRunning ? 'animate-spin' : ''}`}>
                                <path 
                                    d="M4 10a6 6 0 0 1 10.5-4M16 10a6 6 0 0 1-10.5 4" 
                                    stroke="currentColor" 
                                    strokeWidth="1.5" 
                                    strokeLinecap="round"
                                />
                                <path d="M14 4l2 2-2 2M6 12l-2 2 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
                            className="swarm-panel__score-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${verdict.overallScore}%` }}
                            transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                            style={{
                                background: verdict.overallScore >= 85 
                                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                                    : verdict.overallScore >= 70 
                                    ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                                    : 'linear-gradient(90deg, #ef4444, #f87171)',
                                boxShadow: verdict.overallScore >= 85 
                                    ? '0 0 20px rgba(16, 185, 129, 0.5)'
                                    : verdict.overallScore >= 70 
                                    ? '0 0 20px rgba(245, 158, 11, 0.5)'
                                    : '0 0 20px rgba(239, 68, 68, 0.5)',
                            }}
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
