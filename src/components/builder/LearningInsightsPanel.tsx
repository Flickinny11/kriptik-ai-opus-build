/**
 * Learning Insights Panel Component
 *
 * Displays the Autonomous Learning Engine status, patterns,
 * strategies, and improvement metrics in the builder/settings UI.
 * Part of Component 28: Autonomous Learning Engine.
 */

import { useState, useEffect, useCallback } from 'react';
import {
    BrainIcon,
    ActivityIcon,
    RefreshIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    CheckIcon,
    AlertCircleIcon,
    ZapIcon,
    LayersIcon,
    type IconProps,
} from '../ui/icons';
import { motion, AnimatePresence } from 'framer-motion';

// =============================================================================
// TYPES
// =============================================================================

interface LearningStatus {
    isRunning: boolean;
    currentCycleId: string | null;
    lastCycle: {
        cycleNumber: number;
        improvementPercent: number;
        tracesCaptured: number;
        patternsExtracted: number;
        completedAt: string;
    } | null;
    totalCycles: number;
    overallImprovement: number;
    patternStats: {
        total: number;
        byCategory: Record<string, number>;
        avgSuccessRate: number;
    };
    strategyStats: {
        total: number;
        active: number;
        experimental: number;
        avgSuccessRate: number;
    };
    pairStats: {
        total: number;
        unused: number;
        byDomain: Record<string, number>;
    };
    recentInsights: Array<{
        insightId: string;
        category: string;
        observation: string;
        implemented: boolean;
    }>;
}

interface ImprovementTrend {
    cycleNumber: number;
    improvement: number;
    avgSuccessRate: number;
    avgDesignScore: number;
    date: string;
}

interface Pattern {
    patternId: string;
    category: string;
    name: string;
    problem: string;
    successRate: number;
    usageCount: number;
}

interface Strategy {
    strategyId: string;
    domain: string;
    name: string;
    description: string;
    successRate: number;
    confidence: number;
    isExperimental: boolean;
    isActive: boolean;
}

// =============================================================================
// API CLIENT
// =============================================================================

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function fetchLearningStatus(): Promise<LearningStatus> {
    const res = await fetch(`${apiUrl}/api/learning/status`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
}

async function fetchTrend(): Promise<ImprovementTrend[]> {
    const res = await fetch(`${apiUrl}/api/learning/trend?count=10`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
}

async function fetchPatterns(category?: string): Promise<Pattern[]> {
    const url = category
        ? `${apiUrl}/api/learning/patterns?category=${category}&limit=10`
        : `${apiUrl}/api/learning/patterns?limit=10`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
}

async function fetchStrategies(domain?: string): Promise<Strategy[]> {
    const url = domain
        ? `${apiUrl}/api/learning/strategies?domain=${domain}`
        : `${apiUrl}/api/learning/strategies`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
}

async function runEvolutionCycle(userId: string): Promise<void> {
    const res = await fetch(`${apiUrl}/api/learning/cycles/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
}

// =============================================================================
// STAT CARD
// =============================================================================

function StatCard({
    icon: Icon,
    label,
    value,
    subtext,
    color = 'blue',
}: {
    icon: React.FC<IconProps>;
    label: string;
    value: string | number;
    subtext?: string;
    color?: string;
}) {
    const colorClasses: Record<string, string> = {
        blue: 'text-blue-400 bg-blue-500/10',
        emerald: 'text-emerald-400 bg-emerald-500/10',
        amber: 'text-amber-400 bg-amber-500/10',
        purple: 'text-purple-400 bg-purple-500/10',
        cyan: 'text-cyan-400 bg-cyan-500/10',
    };

    return (
        <div className="rounded-lg bg-[#1a1a2e]/60 border border-white/5 p-4">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                    <Icon size={16} />
                </div>
                <div>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="text-lg font-semibold text-white">{value}</p>
                    {subtext && (
                        <p className="text-xs text-gray-500">{subtext}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// MINI CHART
// =============================================================================

function MiniTrendChart({ data }: { data: ImprovementTrend[] }) {
    if (data.length < 2) return null;

    const maxImprovement = Math.max(...data.map(d => Math.abs(d.improvement)), 10);
    const height = 60;
    const width = 200;
    const pointSpacing = width / (data.length - 1);

    const points = data.map((d, i) => ({
        x: i * pointSpacing,
        y: height / 2 - (d.improvement / maxImprovement) * (height / 2 - 5),
    }));

    const pathD = points.map((p, i) =>
        `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
    ).join(' ');

    return (
        <svg width={width} height={height} className="overflow-visible">
            {/* Zero line */}
            <line
                x1={0} y1={height / 2}
                x2={width} y2={height / 2}
                stroke="rgba(255,255,255,0.1)"
                strokeDasharray="4 4"
            />
            {/* Trend line */}
            <path
                d={pathD}
                fill="none"
                stroke="url(#trendGradient)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Gradient definition */}
            <defs>
                <linearGradient id="trendGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
            </defs>
            {/* Points */}
            {points.map((p, i) => (
                <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={3}
                    fill={data[i].improvement >= 0 ? '#10b981' : '#ef4444'}
                />
            ))}
        </svg>
    );
}

// =============================================================================
// COLLAPSIBLE SECTION
// =============================================================================

function CollapsibleSection({
    title,
    icon: Icon,
    defaultOpen = false,
    children,
}: {
    title: string;
    icon: React.FC<IconProps>;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="rounded-lg bg-[#1a1a2e]/60 border border-white/5 overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <Icon size={16} className="text-purple-400" />
                    <span className="text-sm font-medium text-white">{title}</span>
                </div>
                {isOpen ? (
                    <ChevronDownIcon size={16} className="text-gray-400" />
                ) : (
                    <ChevronRightIcon size={16} className="text-gray-400" />
                )}
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 pt-0 border-t border-white/5">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface LearningInsightsPanelProps {
    userId: string;
    compact?: boolean;
    className?: string;
}

export function LearningInsightsPanel({
    userId,
    compact = false,
    className = '',
}: LearningInsightsPanelProps) {
    const [status, setStatus] = useState<LearningStatus | null>(null);
    const [trend, setTrend] = useState<ImprovementTrend[]>([]);
    const [patterns, setPatterns] = useState<Pattern[]>([]);
    const [strategies, setStrategies] = useState<Strategy[]>([]);
    const [loading, setLoading] = useState(true);
    const [runningCycle, setRunningCycle] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const [statusData, trendData, patternsData, strategiesData] = await Promise.all([
                fetchLearningStatus(),
                fetchTrend(),
                fetchPatterns(),
                fetchStrategies(),
            ]);
            setStatus(statusData);
            setTrend(trendData);
            setPatterns(patternsData);
            setStrategies(strategiesData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load learning data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleRunCycle = async () => {
        try {
            setRunningCycle(true);
            await runEvolutionCycle(userId);
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to run cycle');
        } finally {
            setRunningCycle(false);
        }
    };

    if (loading) {
        return (
            <div className={`flex items-center justify-center p-8 ${className}`}>
                <RefreshIcon size={24} className="text-purple-400 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className={`rounded-lg bg-red-500/10 border border-red-500/20 p-4 ${className}`}>
                <div className="flex items-center gap-2 text-red-400">
                    <AlertCircleIcon size={16} />
                    <span className="text-sm">{error}</span>
                </div>
            </div>
        );
    }

    if (!status) return null;

    // Compact view for sidebar
    if (compact) {
        return (
            <div className={`space-y-3 ${className}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BrainIcon size={16} className="text-purple-400" />
                        <span className="text-sm font-medium text-white">Learning Engine</span>
                    </div>
                    {status.isRunning ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-400">
                            Running
                        </span>
                    ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400">
                            Ready
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-white/5 p-2">
                        <span className="text-gray-400">Patterns</span>
                        <p className="text-white font-medium">{status.patternStats.total}</p>
                    </div>
                    <div className="rounded bg-white/5 p-2">
                        <span className="text-gray-400">Strategies</span>
                        <p className="text-white font-medium">{status.strategyStats.active}</p>
                    </div>
                    <div className="rounded bg-white/5 p-2">
                        <span className="text-gray-400">Training Data</span>
                        <p className="text-white font-medium">{status.pairStats.total}</p>
                    </div>
                    <div className="rounded bg-white/5 p-2">
                        <span className="text-gray-400">Improvement</span>
                        <p className={`font-medium ${
                            status.overallImprovement > 0 ? 'text-emerald-400' : 'text-gray-400'
                        }`}>
                            {status.overallImprovement > 0 ? '+' : ''}{status.overallImprovement}%
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Full view
    return (
        <div className={`space-y-6 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                        <BrainIcon size={20} className="text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">
                            Autonomous Learning Engine
                        </h2>
                        <p className="text-sm text-gray-400">
                            Self-improving AI that evolves with every build
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleRunCycle}
                    disabled={runningCycle || status.isRunning}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        runningCycle || status.isRunning
                            ? 'bg-white/5 text-gray-400 cursor-not-allowed'
                            : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                    }`}
                >
                    <RefreshIcon size={16} className={runningCycle ? 'animate-spin' : ''} />
                    {runningCycle ? 'Running...' : 'Run Evolution Cycle'}
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                    icon={LayersIcon}
                    label="Learned Patterns"
                    value={status.patternStats.total}
                    subtext={`${status.patternStats.avgSuccessRate.toFixed(0)}% success rate`}
                    color="purple"
                />
                <StatCard
                    icon={ActivityIcon}
                    label="Active Strategies"
                    value={status.strategyStats.active}
                    subtext={`${status.strategyStats.experimental} experimental`}
                    color="blue"
                />
                <StatCard
                    icon={ZapIcon}
                    label="Training Pairs"
                    value={status.pairStats.total}
                    subtext={`${status.pairStats.unused} ready for training`}
                    color="amber"
                />
                <StatCard
                    icon={ActivityIcon}
                    label="Total Improvement"
                    value={`${status.overallImprovement > 0 ? '+' : ''}${status.overallImprovement}%`}
                    subtext={`${status.totalCycles} cycles completed`}
                    color="emerald"
                />
            </div>

            {/* Improvement Trend */}
            {trend.length > 0 && (
                <div className="rounded-lg bg-[#1a1a2e]/60 border border-white/5 p-4">
                    <h3 className="text-sm font-medium text-white mb-3">
                        Improvement Trend
                    </h3>
                    <MiniTrendChart data={trend} />
                </div>
            )}

            {/* Patterns Section */}
            <CollapsibleSection title="Learned Patterns" icon={LayersIcon} defaultOpen>
                <div className="space-y-2">
                    {patterns.length === 0 ? (
                        <p className="text-sm text-gray-400">
                            No patterns learned yet. Build more projects to generate patterns.
                        </p>
                    ) : (
                        patterns.slice(0, 5).map(pattern => (
                            <div
                                key={pattern.patternId}
                                className="flex items-center justify-between p-2 rounded bg-white/5"
                            >
                                <div>
                                    <p className="text-sm text-white">{pattern.name}</p>
                                    <p className="text-xs text-gray-400">
                                        {pattern.category} • {pattern.problem.slice(0, 50)}...
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-emerald-400">
                                        {pattern.successRate}%
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {pattern.usageCount} uses
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CollapsibleSection>

            {/* Strategies Section */}
            <CollapsibleSection title="Build Strategies" icon={ActivityIcon}>
                <div className="space-y-2">
                    {strategies.length === 0 ? (
                        <p className="text-sm text-gray-400">
                            No strategies evolved yet.
                        </p>
                    ) : (
                        strategies.slice(0, 5).map(strategy => (
                            <div
                                key={strategy.strategyId}
                                className="flex items-center justify-between p-2 rounded bg-white/5"
                            >
                                <div className="flex items-center gap-2">
                                    {strategy.isExperimental && (
                                        <ZapIcon size={12} className="text-amber-400" />
                                    )}
                                    <div>
                                        <p className="text-sm text-white">{strategy.name}</p>
                                        <p className="text-xs text-gray-400">
                                            {strategy.domain} • {strategy.description.slice(0, 40)}...
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-sm ${
                                        strategy.successRate >= 70 ? 'text-emerald-400' :
                                        strategy.successRate >= 50 ? 'text-amber-400' : 'text-red-400'
                                    }`}>
                                        {strategy.successRate}%
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {strategy.confidence}% confidence
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CollapsibleSection>

            {/* Recent Insights */}
            <CollapsibleSection title="Recent Insights" icon={BrainIcon}>
                <div className="space-y-2">
                    {status.recentInsights.length === 0 ? (
                        <p className="text-sm text-gray-400">
                            No insights generated yet.
                        </p>
                    ) : (
                        status.recentInsights.slice(0, 5).map(insight => (
                            <div
                                key={insight.insightId}
                                className="flex items-start gap-2 p-2 rounded bg-white/5"
                            >
                                {insight.implemented ? (
                                    <CheckIcon size={16} className="text-emerald-400 mt-0.5" />
                                ) : (
                                    <div className="w-4 h-4 rounded-full border border-gray-500 mt-0.5" />
                                )}
                                <div>
                                    <p className="text-sm text-white">{insight.observation}</p>
                                    <p className="text-xs text-gray-400">{insight.category}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CollapsibleSection>
        </div>
    );
}

export default LearningInsightsPanel;

