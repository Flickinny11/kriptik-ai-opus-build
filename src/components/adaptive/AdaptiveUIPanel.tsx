/**
 * Adaptive UI Panel
 *
 * Main dashboard showing behavior patterns, heatmaps, and suggestions.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Brain,
    Activity,
    Map,
    Sparkles,
    RefreshCw,
    Loader2,
    AlertTriangle,
    CheckCircle,
    BarChart3,
} from 'lucide-react';
import { BehaviorHeatmap } from './BehaviorHeatmap';
import { SuggestionCard } from './SuggestionCard';
import { PatternTimeline } from './PatternTimeline';

const accentColor = '#c8ff64';

interface ElementIdentifier {
    selector: string;
    componentType: string;
    text?: string;
    location: { x: number; y: number };
}

interface BehaviorPattern {
    id: string;
    projectId: string;
    patternType: 'friction' | 'engagement' | 'confusion' | 'success' | 'drop-off';
    affectedElements: ElementIdentifier[];
    frequency: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    firstDetected: Date | string;
    lastDetected: Date | string;
    sessionCount: number;
}

interface UISuggestion {
    id: string;
    patternId: string;
    suggestionType: string;
    description: string;
    rationale: string;
    codeChange: {
        file: string;
        selector: string;
        originalCode: string;
        suggestedCode: string;
        cssChanges?: Record<string, string>;
    };
    predictedImpact: number;
    autoApply: boolean;
    confidence: number;
    status: 'pending' | 'applied' | 'dismissed' | 'testing';
}

interface HeatmapData {
    points: Array<{
        x: number;
        y: number;
        intensity: number;
        type: 'click' | 'hover' | 'scroll-stop';
    }>;
    elementHeatmap: Array<{
        selector: string;
        interactions: number;
        avgTimeOnElement: number;
        clickRate: number;
    }>;
}

interface Statistics {
    totalSignals: number;
    totalPatterns: number;
    totalSuggestions: number;
    pendingSuggestions: number;
    appliedSuggestions: number;
    patternsByType: Record<string, number>;
    patternsBySeverity: Record<string, number>;
}

interface AdaptiveUIPanelProps {
    isOpen: boolean;
    onClose: () => void;
    projectId?: string;
}

type Tab = 'overview' | 'patterns' | 'suggestions' | 'heatmap';

export function AdaptiveUIPanel({
    isOpen,
    onClose,
    projectId = 'default',
}: AdaptiveUIPanelProps) {
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [patterns, setPatterns] = useState<BehaviorPattern[]>([]);
    const [suggestions, setSuggestions] = useState<UISuggestion[]>([]);
    const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
    const [stats, setStats] = useState<Statistics | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [applyingId, setApplyingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetch all data
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const [patternsRes, suggestionsRes, heatmapRes, statsRes] = await Promise.all([
                fetch(`/api/adaptive/patterns/${projectId}`, { credentials: 'include' }),
                fetch(`/api/adaptive/suggestions/${projectId}`, { credentials: 'include' }),
                fetch(`/api/adaptive/heatmap/${projectId}`, { credentials: 'include' }),
                fetch(`/api/adaptive/stats/${projectId}`, { credentials: 'include' }),
            ]);

            const [patternsData, suggestionsData, heatmapData, statsData] = await Promise.all([
                patternsRes.json(),
                suggestionsRes.json(),
                heatmapRes.json(),
                statsRes.json(),
            ]);

            if (patternsData.success) setPatterns(patternsData.patterns);
            if (suggestionsData.success) setSuggestions(suggestionsData.suggestions);
            if (heatmapData.success) setHeatmap(heatmapData.heatmap);
            if (statsData.success) setStats(statsData.stats);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    // Fetch on open
    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, fetchData]);

    // Apply suggestion
    const handleApplySuggestion = async (suggestionId: string) => {
        setApplyingId(suggestionId);

        try {
            const response = await fetch(`/api/adaptive/apply/${suggestionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ projectId }),
            });

            const data = await response.json();
            if (data.success) {
                setSuggestions(prev =>
                    prev.map(s => s.id === suggestionId ? { ...s, status: 'applied' as const } : s)
                );
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to apply suggestion');
        } finally {
            setApplyingId(null);
        }
    };

    // Dismiss suggestion
    const handleDismissSuggestion = async (suggestionId: string) => {
        try {
            const response = await fetch(`/api/adaptive/dismiss/${suggestionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ projectId }),
            });

            const data = await response.json();
            if (data.success) {
                setSuggestions(prev =>
                    prev.map(s => s.id === suggestionId ? { ...s, status: 'dismissed' as const } : s)
                );
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to dismiss suggestion');
        }
    };

    const tabs = [
        { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
        { id: 'patterns' as const, label: 'Patterns', icon: Activity },
        { id: 'suggestions' as const, label: 'Suggestions', icon: Sparkles },
        { id: 'heatmap' as const, label: 'Heatmap', icon: Map },
    ];

    const pendingSuggestions = suggestions.filter(s => s.status === 'pending');

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ opacity: 0, x: '100%' }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-3xl z-50 flex flex-col overflow-hidden"
                        style={{
                            background: 'linear-gradient(180deg, rgba(15,15,20,0.98) 0%, rgba(10,10,15,0.98) 100%)',
                            borderLeft: '1px solid rgba(255,255,255,0.1)',
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: `${accentColor}20` }}
                                >
                                    <Brain className="w-5 h-5" style={{ color: accentColor }} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Adaptive UI</h2>
                                    <p className="text-xs text-white/50">
                                        Learning from user behavior
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={fetchData}
                                    disabled={isLoading}
                                    className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-white/10">
                            {tabs.map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                const hasBadge = tab.id === 'suggestions' && pendingSuggestions.length > 0;

                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 relative ${
                                            isActive
                                                ? 'text-white border-current'
                                                : 'text-white/50 border-transparent hover:text-white/80'
                                        }`}
                                        style={{
                                            borderColor: isActive ? accentColor : 'transparent',
                                        }}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {tab.label}
                                        {hasBadge && (
                                            <span
                                                className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] flex items-center justify-center"
                                                style={{ background: accentColor, color: 'black' }}
                                            >
                                                {pendingSuggestions.length}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Error display */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
                                >
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="flex flex-col items-center gap-3">
                                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
                                        <span className="text-sm text-white/50">Loading analytics...</span>
                                    </div>
                                </div>
                            ) : (
                                <AnimatePresence mode="wait">
                                    {/* Overview Tab */}
                                    {activeTab === 'overview' && stats && (
                                        <motion.div
                                            key="overview"
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            className="space-y-6"
                                        >
                                            {/* Stats grid */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <StatCard
                                                    label="Total Signals"
                                                    value={stats.totalSignals}
                                                    icon={Activity}
                                                />
                                                <StatCard
                                                    label="Patterns Found"
                                                    value={stats.totalPatterns}
                                                    icon={AlertTriangle}
                                                    color="#f59e0b"
                                                />
                                                <StatCard
                                                    label="Pending Fixes"
                                                    value={stats.pendingSuggestions}
                                                    icon={Sparkles}
                                                    color={accentColor}
                                                />
                                                <StatCard
                                                    label="Applied"
                                                    value={stats.appliedSuggestions}
                                                    icon={CheckCircle}
                                                    color="#22c55e"
                                                />
                                            </div>

                                            {/* Pattern breakdown */}
                                            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                                                <h3 className="text-sm font-medium text-white mb-4">Pattern Types</h3>
                                                <div className="space-y-3">
                                                    {Object.entries(stats.patternsByType).map(([type, count]) => (
                                                        <div key={type} className="flex items-center gap-3">
                                                            <span className="text-sm text-white/60 capitalize w-24">{type}</span>
                                                            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${(count / stats.totalPatterns) * 100}%` }}
                                                                    className="h-full rounded-full"
                                                                    style={{ background: accentColor }}
                                                                />
                                                            </div>
                                                            <span className="text-sm text-white/80 w-8">{count}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Recent patterns */}
                                            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                                                <h3 className="text-sm font-medium text-white mb-4">Recent Activity</h3>
                                                <PatternTimeline patterns={patterns.slice(0, 5)} />
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Patterns Tab */}
                                    {activeTab === 'patterns' && (
                                        <motion.div
                                            key="patterns"
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                        >
                                            <PatternTimeline patterns={patterns} />
                                        </motion.div>
                                    )}

                                    {/* Suggestions Tab */}
                                    {activeTab === 'suggestions' && (
                                        <motion.div
                                            key="suggestions"
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            className="space-y-4"
                                        >
                                            {suggestions.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center p-8 text-center">
                                                    <div
                                                        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                                                        style={{ background: `${accentColor}20` }}
                                                    >
                                                        <Sparkles className="w-8 h-8" style={{ color: accentColor }} />
                                                    </div>
                                                    <p className="text-white/60">No suggestions yet</p>
                                                    <p className="text-sm text-white/40 mt-1">
                                                        Suggestions will appear as patterns are detected
                                                    </p>
                                                </div>
                                            ) : (
                                                suggestions.map(suggestion => (
                                                    <SuggestionCard
                                                        key={suggestion.id}
                                                        suggestion={suggestion}
                                                        onApply={handleApplySuggestion}
                                                        onDismiss={handleDismissSuggestion}
                                                        isApplying={applyingId === suggestion.id}
                                                    />
                                                ))
                                            )}
                                        </motion.div>
                                    )}

                                    {/* Heatmap Tab */}
                                    {activeTab === 'heatmap' && heatmap && (
                                        <motion.div
                                            key="heatmap"
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                        >
                                            <BehaviorHeatmap
                                                points={heatmap.points}
                                                elementHeatmap={heatmap.elementHeatmap}
                                                width={700}
                                                height={500}
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// Stat Card Component
function StatCard({
    label,
    value,
    icon: Icon,
    color = 'white',
}: {
    label: string;
    value: number;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    color?: string;
}) {
    return (
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-2">
                <span style={{ color }}><Icon className="w-4 h-4" /></span>
                <span className="text-xs text-white/50">{label}</span>
            </div>
            <span className="text-2xl font-bold text-white">{value}</span>
        </div>
    );
}

