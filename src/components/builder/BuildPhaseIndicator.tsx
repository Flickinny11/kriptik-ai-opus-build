/**
 * Build Phase Indicator Component
 *
 * Visualizes the 6-phase build loop progress.
 * Part of Phase 9: UI Enhancements
 */

import {
    CheckIcon,
    LoadingIcon,
    SettingsIcon,
    AlertCircleIcon,
} from '../ui/icons';
import { motion } from 'framer-motion';

// Custom icons for build phases (using inline SVG)
const FileTextIcon = ({ className, ...props }: { className?: string; size?: number }) => (
    <svg className={className} width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
    </svg>
);

const HammerIcon = ({ className, ...props }: { className?: string; size?: number }) => (
    <svg className={className} width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"/>
        <path d="M17.64 15 22 10.64"/>
        <path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/>
    </svg>
);

const Link2Icon = ({ className, ...props }: { className?: string; size?: number }) => (
    <svg className={className} width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 17H7A5 5 0 0 1 7 7h2"/>
        <path d="M15 7h2a5 5 0 1 1 0 10h-2"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
);

const TestTubeIcon = ({ className, ...props }: { className?: string; size?: number }) => (
    <svg className={className} width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5V2"/>
        <path d="M8.5 2h7"/>
        <path d="M14.5 16h-5"/>
    </svg>
);

const SparklesIcon = ({ className, ...props }: { className?: string; size?: number }) => (
    <svg className={className} width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
        <path d="M5 3v4"/>
        <path d="M19 17v4"/>
        <path d="M3 5h4"/>
        <path d="M17 19h4"/>
    </svg>
);

const MonitorIcon = ({ className, ...props }: { className?: string; size?: number }) => (
    <svg className={className} width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
);

type LucideIcon = React.FC<{ className?: string; size?: number }>;

// ============================================================================
// TYPES
// ============================================================================

export type BuildPhase =
    | 'intent_lock'       // Phase 0: Sacred Contract
    | 'initialization'    // Phase 1: Setup artifacts
    | 'parallel_build'    // Phase 2: Feature building
    | 'integration'       // Phase 3: Integration check
    | 'testing'           // Phase 4: Functional tests
    | 'intent_satisfaction' // Phase 5: Final validation
    | 'demo';             // Phase 6: Browser demo

export type PhaseStatus = 'pending' | 'active' | 'complete' | 'failed' | 'skipped';

export interface PhaseInfo {
    phase: BuildPhase;
    status: PhaseStatus;
    progress?: number;  // 0-100 for active phase
    message?: string;
    duration?: number;  // ms
    startTime?: Date;
}

interface BuildPhaseIndicatorProps {
    phases: PhaseInfo[];
    currentPhase?: BuildPhase;
    showDetails?: boolean;
    compact?: boolean;
    onPhaseClick?: (phase: BuildPhase) => void;
}

// ============================================================================
// PHASE CONFIGURATION
// ============================================================================

const PHASE_CONFIG: Record<BuildPhase, {
    name: string;
    shortName: string;
    icon: LucideIcon;
    description: string;
    color: string;
}> = {
    intent_lock: {
        name: 'Intent Lock',
        shortName: 'Intent',
        icon: FileTextIcon,
        description: 'Creating the sacred contract',
        color: 'violet',
    },
    initialization: {
        name: 'Initialization',
        shortName: 'Init',
        icon: SettingsIcon as any,
        description: 'Setting up artifacts & features',
        color: 'blue',
    },
    parallel_build: {
        name: 'Parallel Build',
        shortName: 'Build',
        icon: HammerIcon,
        description: 'Building features with AI agents',
        color: 'amber',
    },
    integration: {
        name: 'Integration',
        shortName: 'Integrate',
        icon: Link2Icon,
        description: 'Checking connections & wiring',
        color: 'cyan',
    },
    testing: {
        name: 'Testing',
        shortName: 'Test',
        icon: TestTubeIcon,
        description: 'Running functional tests',
        color: 'emerald',
    },
    intent_satisfaction: {
        name: 'Intent Check',
        shortName: 'Verify',
        icon: SparklesIcon,
        description: 'Final intent satisfaction gate',
        color: 'purple',
    },
    demo: {
        name: 'Browser Demo',
        shortName: 'Demo',
        icon: MonitorIcon,
        description: 'Showing the working app',
        color: 'rose',
    },
};

const PHASE_ORDER: BuildPhase[] = [
    'intent_lock',
    'initialization',
    'parallel_build',
    'integration',
    'testing',
    'intent_satisfaction',
    'demo',
];

// ============================================================================
// PHASE STEP COMPONENT
// ============================================================================

function PhaseStep({
    info,
    config,
    isFirst,
    isLast: _isLast,
    showConnector,
    compact,
    onClick,
}: {
    info: PhaseInfo;
    config: typeof PHASE_CONFIG[BuildPhase];
    isFirst: boolean;
    isLast: boolean;
    showConnector: boolean;
    compact: boolean;
    onClick?: () => void;
}) {
    const Icon = config.icon;

    const getStatusStyles = () => {
        switch (info.status) {
            case 'complete':
                return {
                    ring: `ring-${config.color}-500/50`,
                    bg: `bg-${config.color}-500`,
                    text: 'text-white',
                    glow: `shadow-lg shadow-${config.color}-500/30`,
                };
            case 'active':
                return {
                    ring: `ring-${config.color}-500 ring-2`,
                    bg: `bg-${config.color}-500/20`,
                    text: `text-${config.color}-400`,
                    glow: `shadow-lg shadow-${config.color}-500/30 animate-pulse`,
                };
            case 'failed':
                return {
                    ring: 'ring-red-500/50',
                    bg: 'bg-red-500/20',
                    text: 'text-red-400',
                    glow: '',
                };
            case 'skipped':
                return {
                    ring: 'ring-slate-600/50',
                    bg: 'bg-slate-700/50',
                    text: 'text-slate-500',
                    glow: '',
                };
            default:
                return {
                    ring: 'ring-slate-700/50',
                    bg: 'bg-slate-800',
                    text: 'text-slate-400',
                    glow: '',
                };
        }
    };

    const styles = getStatusStyles();

    return (
        <div className="relative flex items-center">
            {/* Connector Line */}
            {showConnector && !isFirst && (
                <div className="absolute right-full w-4 md:w-8 h-0.5 top-1/2 -translate-y-1/2">
                    <motion.div
                        className={`h-full ${info.status === 'complete' || info.status === 'active' ? `bg-${config.color}-500` : 'bg-slate-700'}`}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                    />
                </div>
            )}

            {/* Phase Circle */}
            <motion.button
                onClick={onClick}
                disabled={!onClick}
                className={`
                    relative flex items-center justify-center
                    ${compact ? 'w-8 h-8' : 'w-10 h-10 md:w-12 md:h-12'}
                    rounded-full ring-1 ${styles.ring} ${styles.bg} ${styles.glow}
                    transition-all duration-300
                    ${onClick ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
                `}
                whileHover={onClick ? { scale: 1.1 } : undefined}
                whileTap={onClick ? { scale: 0.95 } : undefined}
            >
                {info.status === 'complete' ? (
                    <CheckIcon size={compact ? 16 : 20} className="text-white" />
                ) : info.status === 'active' ? (
                    <LoadingIcon size={compact ? 16 : 20} className={`${styles.text} animate-spin`} />
                ) : info.status === 'failed' ? (
                    <AlertCircleIcon size={compact ? 16 : 20} className={styles.text} />
                ) : (
                    <Icon className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} ${styles.text}`} size={compact ? 16 : 20} />
                )}

                {/* Progress Ring for Active Phase */}
                {info.status === 'active' && info.progress !== undefined && (
                    <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                        <circle
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            className={`text-${config.color}-500/20`}
                        />
                        <motion.circle
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            strokeLinecap="round"
                            className={`text-${config.color}-500`}
                            strokeDasharray={283}
                            initial={{ strokeDashoffset: 283 }}
                            animate={{ strokeDashoffset: 283 - (283 * info.progress) / 100 }}
                            transition={{ duration: 0.5 }}
                        />
                    </svg>
                )}
            </motion.button>

            {/* Phase Label (non-compact) */}
            {!compact && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
                    <div className={`text-xs font-medium ${info.status === 'active' ? 'text-white' : 'text-slate-400'}`}>
                        {config.shortName}
                    </div>
                    {info.status === 'active' && info.progress !== undefined && (
                        <div className="text-[10px] text-slate-500">{info.progress}%</div>
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BuildPhaseIndicator({
    phases,
    currentPhase,
    showDetails = true,
    compact = false,
    onPhaseClick,
}: BuildPhaseIndicatorProps) {
    // Build a map of phases for easy lookup
    const phaseMap = new Map(phases.map(p => [p.phase, p]));

    // Get current phase info
    const current = currentPhase ? phaseMap.get(currentPhase) : undefined;
    const currentConfig = currentPhase ? PHASE_CONFIG[currentPhase] : undefined;

    // Calculate overall progress
    const completedCount = phases.filter(p => p.status === 'complete').length;
    const totalCount = PHASE_ORDER.length;
    const overallProgress = Math.round((completedCount / totalCount) * 100);

    return (
        <div className={`${compact ? 'p-3' : 'p-4 md:p-6'} rounded-xl bg-slate-900/50 backdrop-blur-xl border border-white/5`}>
            {/* Header */}
            {!compact && (
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Build Progress</h3>
                        <p className="text-sm text-slate-400">
                            Phase {completedCount + (current?.status === 'active' ? 1 : 0)} of {totalCount}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-white">{overallProgress}%</div>
                        <div className="text-xs text-slate-400">Complete</div>
                    </div>
                </div>
            )}

            {/* Phase Steps */}
            <div className={`flex items-center justify-between ${compact ? 'gap-1' : 'gap-4 md:gap-2'}`}>
                {PHASE_ORDER.map((phase, index) => {
                    const info = phaseMap.get(phase) || { phase, status: 'pending' as PhaseStatus };
                    const config = PHASE_CONFIG[phase];

                    return (
                        <PhaseStep
                            key={phase}
                            info={info}
                            config={config}
                            isFirst={index === 0}
                            isLast={index === PHASE_ORDER.length - 1}
                            showConnector={!compact}
                            compact={compact}
                            onClick={onPhaseClick ? () => onPhaseClick(phase) : undefined}
                        />
                    );
                })}
            </div>

            {/* Current Phase Details */}
            {showDetails && current && currentConfig && (
                <motion.div
                    key={currentPhase}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mt-6 p-4 rounded-lg bg-${currentConfig.color}-500/10 border border-${currentConfig.color}-500/20`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-${currentConfig.color}-500/20`}>
                            <currentConfig.icon className={`w-5 h-5 text-${currentConfig.color}-400`} />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-white">{currentConfig.name}</h4>
                            <p className="text-sm text-slate-400">{current.message || currentConfig.description}</p>
                        </div>
                        {current.progress !== undefined && (
                            <div className="text-right">
                                <div className="text-lg font-bold text-white">{current.progress}%</div>
                            </div>
                        )}
                    </div>

                    {/* Progress Bar */}
                    {current.progress !== undefined && (
                        <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                                className={`h-full bg-gradient-to-r from-${currentConfig.color}-500 to-${currentConfig.color}-400`}
                                initial={{ width: 0 }}
                                animate={{ width: `${current.progress}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                    )}
                </motion.div>
            )}

            {/* Overall Progress Bar (compact) */}
            {compact && (
                <div className="mt-3 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-violet-500 via-amber-500 to-emerald-500"
                        animate={{ width: `${overallProgress}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>
            )}
        </div>
    );
}

/**
 * Minimal inline version
 */
export function BuildPhaseInline({ phases, currentPhase }: { phases: PhaseInfo[]; currentPhase?: BuildPhase }) {
    const current = currentPhase ? PHASE_CONFIG[currentPhase] : undefined;

    return (
        <div className="flex items-center gap-2">
            {/* Mini dots */}
            <div className="flex gap-1">
                {PHASE_ORDER.map((phase) => {
                    const info = phases.find(p => p.phase === phase);
                    const config = PHASE_CONFIG[phase];

                    return (
                        <div
                            key={phase}
                            className={`
                                w-2 h-2 rounded-full transition-all duration-300
                                ${info?.status === 'complete' ? `bg-${config.color}-500` : ''}
                                ${info?.status === 'active' ? `bg-${config.color}-500 animate-pulse` : ''}
                                ${!info || info.status === 'pending' ? 'bg-slate-700' : ''}
                            `}
                        />
                    );
                })}
            </div>

            {/* Current phase label */}
            {current && (
                <span className="text-xs text-slate-400">
                    {current.shortName}
                </span>
            )}
        </div>
    );
}

export default BuildPhaseIndicator;

