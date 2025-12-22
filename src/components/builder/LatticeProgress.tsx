/**
 * LATTICE Progress Visualization
 *
 * Shows the lattice grid with cells lighting up as they complete.
 * Displays speedup metrics and parallel execution flow.
 *
 * Part of Phase 6: UI Updates (LATTICE)
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useLatticeStore, type LatticeCell } from '@/store/useLatticeStore';
import { cn } from '@/lib/utils';

// ============================================================================
// ICONS
// ============================================================================

function IconUI({ className }: { className?: string }) {
    return (
        <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <rect x="4" y="4" width="4" height="2" fill="currentColor" />
            <rect x="4" y="7" width="8" height="1" fill="currentColor" opacity="0.5" />
            <rect x="4" y="9" width="6" height="1" fill="currentColor" opacity="0.5" />
        </svg>
    );
}

function IconAPI({ className }: { className?: string }) {
    return (
        <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 3v10M12 3v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M4 6h8M4 10h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="8" r="2" fill="currentColor" />
        </svg>
    );
}

function IconLogic({ className }: { className?: string }) {
    return (
        <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v4M8 10v4M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconData({ className }: { className?: string }) {
    return (
        <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <ellipse cx="8" cy="4" rx="5" ry="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 4v8c0 1.1 2.24 2 5 2s5-.9 5-2V4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 8c0 1.1 2.24 2 5 2s5-.9 5-2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
    );
}

function IconIntegration({ className }: { className?: string }) {
    return (
        <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="4" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6 8h4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4v2M8 10v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function IconStyle({ className }: { className?: string }) {
    return (
        <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="10" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        </svg>
    );
}

function IconCheck({ className }: { className?: string }) {
    return (
        <svg className={className} width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconError({ className }: { className?: string }) {
    return (
        <svg className={className} width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

// ============================================================================
// CELL ICON COMPONENT
// ============================================================================

function CellIcon({ type, className }: { type: LatticeCell['type']; className?: string }) {
    switch (type) {
        case 'ui':
            return <IconUI className={className} />;
        case 'api':
            return <IconAPI className={className} />;
        case 'logic':
            return <IconLogic className={className} />;
        case 'data':
            return <IconData className={className} />;
        case 'integration':
            return <IconIntegration className={className} />;
        case 'style':
            return <IconStyle className={className} />;
        default:
            return <IconUI className={className} />;
    }
}

// ============================================================================
// CELL TYPE COLORS
// ============================================================================

const CELL_COLORS: Record<LatticeCell['type'], { bg: string; border: string; text: string; glow: string }> = {
    ui: {
        bg: 'bg-violet-500/20',
        border: 'border-violet-500/50',
        text: 'text-violet-400',
        glow: 'shadow-violet-500/30',
    },
    api: {
        bg: 'bg-blue-500/20',
        border: 'border-blue-500/50',
        text: 'text-blue-400',
        glow: 'shadow-blue-500/30',
    },
    logic: {
        bg: 'bg-amber-500/20',
        border: 'border-amber-500/50',
        text: 'text-amber-400',
        glow: 'shadow-amber-500/30',
    },
    data: {
        bg: 'bg-emerald-500/20',
        border: 'border-emerald-500/50',
        text: 'text-emerald-400',
        glow: 'shadow-emerald-500/30',
    },
    integration: {
        bg: 'bg-cyan-500/20',
        border: 'border-cyan-500/50',
        text: 'text-cyan-400',
        glow: 'shadow-cyan-500/30',
    },
    style: {
        bg: 'bg-pink-500/20',
        border: 'border-pink-500/50',
        text: 'text-pink-400',
        glow: 'shadow-pink-500/30',
    },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface LatticeProgressProps {
    compact?: boolean;
    showDetails?: boolean;
    className?: string;
}

export function LatticeProgress({
    compact = false,
    showDetails = true,
    className,
}: LatticeProgressProps) {
    const {
        blueprint,
        completedCells,
        inProgressCells,
        failedCells,
        speedup,
        isBuilding,
        currentGroupIndex,
        averageQualityScore,
    } = useLatticeStore();

    if (!blueprint) {
        return null;
    }

    const totalCells = blueprint.cells.length;
    const completedCount = completedCells.size;
    const failedCount = failedCells.size;
    const progressPercent = totalCells > 0 ? (completedCount / totalCells) * 100 : 0;

    return (
        <div className={cn(
            'rounded-xl bg-slate-900/50 backdrop-blur-xl border border-white/5',
            compact ? 'p-3' : 'p-4 md:p-6',
            className
        )}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-white">
                                <rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
                                <rect x="12" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
                                <rect x="2" y="12" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
                                <rect x="12" y="12" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
                                <path d="M8 5h4M5 8v4M15 8v4M8 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                        </div>
                        {isBuilding && (
                            <motion.div
                                className="absolute inset-0 rounded-lg border-2 border-violet-500"
                                animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                            />
                        )}
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">LATTICE Build</h3>
                        <p className="text-sm text-slate-400">
                            {blueprint.appName}
                        </p>
                    </div>
                </div>

                {/* Speedup Badge */}
                <motion.div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-emerald-400">
                        <path d="M7 1v12M1 7l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-sm font-bold text-emerald-400">
                        {speedup.toFixed(1)}x faster
                    </span>
                </motion.div>
            </div>

            {/* Parallel Groups Grid */}
            {!compact && (
                <div className="space-y-3 mb-4">
                    {blueprint.parallelGroups.map((group, groupIndex) => (
                        <div
                            key={groupIndex}
                            className={cn(
                                'p-3 rounded-lg transition-all duration-300',
                                groupIndex === currentGroupIndex && isBuilding
                                    ? 'bg-white/5 border border-white/10'
                                    : 'bg-transparent'
                            )}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Group {groupIndex + 1}
                                </span>
                                {groupIndex === currentGroupIndex && isBuilding && (
                                    <motion.span
                                        className="text-xs text-violet-400"
                                        animate={{ opacity: [1, 0.5, 1] }}
                                        transition={{ duration: 1, repeat: Infinity }}
                                    >
                                        Building...
                                    </motion.span>
                                )}
                                {groupIndex < currentGroupIndex && (
                                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                                        <IconCheck className="w-3 h-3" />
                                        Complete
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <AnimatePresence mode="popLayout">
                                    {group.map(cellId => {
                                        const cell = blueprint.cells.find(c => c.id === cellId);
                                        if (!cell) return null;

                                        const isComplete = completedCells.has(cellId);
                                        const isInProgress = inProgressCells.has(cellId);
                                        const isFailed = failedCells.has(cellId);
                                        const colors = CELL_COLORS[cell.type];

                                        return (
                                            <motion.div
                                                key={cellId}
                                                layout
                                                initial={{ scale: 0.8, opacity: 0 }}
                                                animate={{
                                                    scale: isComplete ? 1 : isInProgress ? 1.05 : 0.95,
                                                    opacity: isComplete ? 1 : isInProgress ? 1 : 0.5,
                                                }}
                                                exit={{ scale: 0.8, opacity: 0 }}
                                                className={cn(
                                                    'relative flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
                                                    colors.bg,
                                                    colors.border,
                                                    isComplete && 'bg-emerald-500/20 border-emerald-500/50',
                                                    isFailed && 'bg-red-500/20 border-red-500/50',
                                                    isInProgress && `shadow-lg ${colors.glow}`
                                                )}
                                            >
                                                {/* Cell Icon */}
                                                <div className={cn(
                                                    'w-6 h-6 rounded flex items-center justify-center',
                                                    isComplete ? 'bg-emerald-500/30 text-emerald-400' :
                                                    isFailed ? 'bg-red-500/30 text-red-400' :
                                                    `${colors.bg} ${colors.text}`
                                                )}>
                                                    {isComplete ? (
                                                        <IconCheck className="w-3 h-3" />
                                                    ) : isFailed ? (
                                                        <IconError className="w-3 h-3" />
                                                    ) : (
                                                        <CellIcon type={cell.type} className="w-4 h-4" />
                                                    )}
                                                </div>

                                                {/* Cell Name */}
                                                <span className={cn(
                                                    'text-sm font-medium',
                                                    isComplete ? 'text-emerald-300' :
                                                    isFailed ? 'text-red-300' :
                                                    isInProgress ? 'text-white' :
                                                    'text-slate-400'
                                                )}>
                                                    {cell.name}
                                                </span>

                                                {/* Pulse Animation */}
                                                {isInProgress && (
                                                    <motion.div
                                                        className="absolute inset-0 rounded-lg border-2 border-white/30"
                                                        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] }}
                                                        transition={{ duration: 1, repeat: Infinity }}
                                                    />
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Compact Cell View */}
            {compact && (
                <div className="flex flex-wrap gap-1 mb-3">
                    {blueprint.cells.map(cell => {
                        const isComplete = completedCells.has(cell.id);
                        const isInProgress = inProgressCells.has(cell.id);
                        const isFailed = failedCells.has(cell.id);

                        return (
                            <motion.div
                                key={cell.id}
                                className={cn(
                                    'w-2 h-2 rounded-full',
                                    isComplete ? 'bg-emerald-500' :
                                    isFailed ? 'bg-red-500' :
                                    isInProgress ? 'bg-violet-500' :
                                    'bg-slate-700'
                                )}
                                animate={isInProgress ? { scale: [1, 1.3, 1] } : {}}
                                transition={{ duration: 0.6, repeat: Infinity }}
                            />
                        );
                    })}
                </div>
            )}

            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-violet-500 via-blue-500 to-emerald-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>

                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">
                        {completedCount} / {totalCells} cells
                        {failedCount > 0 && (
                            <span className="text-red-400 ml-2">
                                ({failedCount} failed)
                            </span>
                        )}
                    </span>
                    <span className="text-white font-medium">
                        {progressPercent.toFixed(0)}%
                    </span>
                </div>
            </div>

            {/* Details Section */}
            {showDetails && !compact && completedCount > 0 && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 pt-4 border-t border-white/5"
                >
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-white">
                                {speedup.toFixed(1)}x
                            </div>
                            <div className="text-xs text-slate-400">Speedup</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-white">
                                {averageQualityScore.toFixed(0)}
                            </div>
                            <div className="text-xs text-slate-400">Quality Score</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-white">
                                {blueprint.parallelGroups.length}
                            </div>
                            <div className="text-xs text-slate-400">Parallel Groups</div>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

/**
 * Compact inline version for status bars
 */
export function LatticeProgressInline() {
    const { blueprint, completedCells, speedup, isBuilding } = useLatticeStore();

    if (!blueprint) return null;

    const totalCells = blueprint.cells.length;
    const completedCount = completedCells.size;

    return (
        <div className="flex items-center gap-3">
            {/* Mini cell indicators */}
            <div className="flex gap-0.5">
                {blueprint.cells.slice(0, 10).map(cell => {
                    const isComplete = completedCells.has(cell.id);
                    return (
                        <div
                            key={cell.id}
                            className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                isComplete ? 'bg-emerald-500' : 'bg-slate-600'
                            )}
                        />
                    );
                })}
                {totalCells > 10 && (
                    <span className="text-xs text-slate-500 ml-1">+{totalCells - 10}</span>
                )}
            </div>

            {/* Progress text */}
            <span className="text-xs text-slate-400">
                {completedCount}/{totalCells}
            </span>

            {/* Speedup badge */}
            {speedup > 1 && (
                <span className="text-xs text-emerald-400 font-medium">
                    {speedup.toFixed(1)}x
                </span>
            )}

            {/* Building indicator */}
            {isBuilding && (
                <motion.div
                    className="w-2 h-2 rounded-full bg-violet-500"
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                />
            )}
        </div>
    );
}

export default LatticeProgress;
