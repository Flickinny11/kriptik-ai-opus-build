/**
 * Speed Dial Selector Component
 *
 * A beautiful, intuitive UI for selecting build modes.
 * Part of Phase 9: UI Enhancements
 */

import { useState } from 'react';
import { ZapIcon, CheckIcon, ClockIcon } from '../ui/icons';
import { motion, AnimatePresence } from 'framer-motion';

// Custom icons for Speed Dial
const TrophyIcon = ({ className, ...props }: { className?: string; size?: number }) => (
    <svg className={className} width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
        <path d="M4 22h16"/>
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>
);

const RocketIcon = ({ className, ...props }: { className?: string; size?: number }) => (
    <svg className={className} width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </svg>
);

type LucideIcon = React.FC<{ className?: string; size?: number }>;

export type BuildMode = 'lightning' | 'standard' | 'tournament' | 'production';

interface BuildModeConfig {
    mode: BuildMode;
    name: string;
    description: string;
    icon: LucideIcon;
    time: string;
    cost: string;
    color: string;
    gradient: string;
    features: string[];
}

const BUILD_MODES: BuildModeConfig[] = [
    {
        mode: 'lightning',
        name: 'Lightning',
        description: 'Fastest MVP. Ship something working in minutes.',
        icon: ZapIcon as any,
        time: '3-5 min',
        cost: '$0.50-2',
        color: 'amber',
        gradient: 'from-amber-500 to-orange-500',
        features: ['Minimal verification', 'Single agent', 'No checkpoints', 'Best for prototypes'],
    },
    {
        mode: 'standard',
        name: 'Standard',
        description: 'Balanced quality and speed. Great for most projects.',
        icon: ClockIcon as any,
        time: '15-30 min',
        cost: '$3-10',
        color: 'blue',
        gradient: 'from-blue-500 to-cyan-500',
        features: ['Anti-slop detection', '3 parallel agents', 'Checkpoints every 10min', 'Security scanning'],
    },
    {
        mode: 'tournament',
        name: 'Tournament',
        description: 'AI agents compete. Best implementation wins.',
        icon: TrophyIcon as any,
        time: '30-45 min',
        cost: '$15-50',
        color: 'rose',
        gradient: 'from-rose-500 to-amber-500', // Anti-slop: amber-rose instead of purple-pink
        features: ['3 competing builds', 'AI judge panel', 'Full verification', 'E2E testing'],
    },
    {
        mode: 'production',
        name: 'Production',
        description: 'Enterprise-grade quality. Full verification suite.',
        icon: RocketIcon as any,
        time: '60-120 min',
        cost: '$30-100',
        color: 'emerald',
        gradient: 'from-emerald-500 to-teal-500',
        features: ['Opus-powered', 'Security audit', 'Full test coverage', '90+ quality threshold'],
    },
];

interface SpeedDialSelectorProps {
    selectedMode: BuildMode;
    onModeChange: (mode: BuildMode) => void;
    disabled?: boolean;
    showDetails?: boolean;
}

export function SpeedDialSelector({
    selectedMode,
    onModeChange,
    disabled = false,
    showDetails = true,
}: SpeedDialSelectorProps) {
    const [hoveredMode, setHoveredMode] = useState<BuildMode | null>(null);

    const selectedConfig = BUILD_MODES.find(m => m.mode === selectedMode);

    return (
        <div className="w-full">
            {/* Mode Selector */}
            <div className="flex gap-2 p-1 rounded-xl bg-slate-900/50 backdrop-blur-xl border border-white/5">
                {BUILD_MODES.map((config) => {
                    const isSelected = selectedMode === config.mode;
                    const isHovered = hoveredMode === config.mode;
                    const Icon = config.icon;

                    return (
                        <motion.button
                            key={config.mode}
                            onClick={() => !disabled && onModeChange(config.mode)}
                            onMouseEnter={() => setHoveredMode(config.mode)}
                            onMouseLeave={() => setHoveredMode(null)}
                            disabled={disabled}
                            className={`
                                relative flex-1 px-4 py-3 rounded-lg font-medium text-sm
                                transition-all duration-300 overflow-hidden
                                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                            `}
                            whileHover={{ scale: disabled ? 1 : 1.02 }}
                            whileTap={{ scale: disabled ? 1 : 0.98 }}
                        >
                            {/* Background */}
                            <AnimatePresence>
                                {isSelected && (
                                    <motion.div
                                        layoutId="speedDialBg"
                                        className={`absolute inset-0 bg-gradient-to-r ${config.gradient} opacity-90`}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 0.9 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    />
                                )}
                            </AnimatePresence>

                            {/* Hover Effect */}
                            {!isSelected && isHovered && (
                                <motion.div
                                    className="absolute inset-0 bg-white/5"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                />
                            )}

                            {/* Content */}
                            <div className="relative z-10 flex items-center justify-center gap-2">
                                <Icon size={16} className={isSelected ? 'text-white' : 'text-slate-400'} />
                                <span className={isSelected ? 'text-white' : 'text-slate-300'}>
                                    {config.name}
                                </span>
                            </div>

                            {/* Selected Indicator */}
                            {isSelected && (
                                <motion.div
                                    className="absolute top-1 right-1"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.1 }}
                                >
                                    <CheckIcon size={12} className="text-white/80" />
                                </motion.div>
                            )}
                        </motion.button>
                    );
                })}
            </div>

            {/* Details Panel */}
            {showDetails && selectedConfig && (
                <motion.div
                    key={selectedMode}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-3 p-4 rounded-xl bg-slate-900/30 backdrop-blur-lg border border-white/5"
                >
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${selectedConfig.gradient}`}>
                                <selectedConfig.icon size={20} className="text-white" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-white">{selectedConfig.name} Build</h4>
                                <p className="text-sm text-slate-400">{selectedConfig.description}</p>
                            </div>
                        </div>

                        <div className="text-right">
                            <div className="text-sm text-slate-400">Est. Time & Cost</div>
                            <div className="font-mono text-sm text-white">{selectedConfig.time}</div>
                            <div className="font-mono text-xs text-slate-500">{selectedConfig.cost}</div>
                        </div>
                    </div>

                    {/* Features */}
                    <div className="mt-4 grid grid-cols-2 gap-2">
                        {selectedConfig.features.map((feature, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                                <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${selectedConfig.gradient}`} />
                                <span className="text-slate-300">{feature}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
        </div>
    );
}

/**
 * Compact version for inline use
 */
export function SpeedDialCompact({
    selectedMode,
    onModeChange,
    disabled = false,
}: Omit<SpeedDialSelectorProps, 'showDetails'>) {
    const selectedConfig = BUILD_MODES.find(m => m.mode === selectedMode);

    if (!selectedConfig) return null;

    return (
        <div className="relative">
            <button
                onClick={() => !disabled && document.getElementById('speedDialDropdown')?.classList.toggle('hidden')}
                disabled={disabled}
                className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg
                    bg-gradient-to-r ${selectedConfig.gradient}
                    text-white font-medium text-sm
                    hover:shadow-lg hover:shadow-${selectedConfig.color}-500/25
                    transition-all duration-200
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
            >
                <selectedConfig.icon size={16} />
                <span>{selectedConfig.name}</span>
            </button>

            <div
                id="speedDialDropdown"
                className="hidden absolute top-full left-0 mt-2 p-2 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-xl z-50 min-w-[200px]"
            >
                {BUILD_MODES.map((config) => {
                    const isSelected = selectedMode === config.mode;
                    const Icon = config.icon;

                    return (
                        <button
                            key={config.mode}
                            onClick={() => {
                                onModeChange(config.mode);
                                document.getElementById('speedDialDropdown')?.classList.add('hidden');
                            }}
                            className={`
                                w-full flex items-center gap-3 px-3 py-2 rounded-lg
                                text-left transition-all duration-200
                                ${isSelected ? `bg-gradient-to-r ${config.gradient} text-white` : 'hover:bg-white/5 text-slate-300'}
                            `}
                        >
                            <Icon size={16} />
                            <div className="flex-1">
                                <div className="font-medium">{config.name}</div>
                                <div className="text-xs opacity-70">{config.time}</div>
                            </div>
                            {isSelected && <CheckIcon size={16} />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default SpeedDialSelector;

