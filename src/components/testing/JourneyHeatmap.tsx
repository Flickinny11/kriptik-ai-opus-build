/**
 * Journey Heatmap Component
 *
 * Visualize common paths and drop-off points from synthetic user testing.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapPin, MousePointer2, ArrowRight, Users, TrendingDown, Activity } from 'lucide-react';

const accentColor = '#c8ff64';

interface HeatmapData {
    url: string;
    clicks: Array<{ x: number; y: number; count: number }>;
    scrollDepth: number[];
    timeOnPage: number[];
    dropOffRate: number;
}

interface JourneyStep {
    page: string;
    visitors: number;
    dropOff: number;
    avgTime: number;
    actions: Array<{
        type: string;
        target: string;
        count: number;
    }>;
}

interface JourneyHeatmapProps {
    heatmaps: HeatmapData[];
    totalSessions: number;
}

export function JourneyHeatmap({ heatmaps, totalSessions }: JourneyHeatmapProps) {
    // Build journey funnel from heatmap data
    const journeySteps = useMemo<JourneyStep[]>(() => {
        if (!heatmaps || heatmaps.length === 0) {
            return [];
        }

        return heatmaps.map((heatmap, index) => ({
            page: new URL(heatmap.url, 'http://localhost').pathname || '/',
            visitors: Math.round(totalSessions * (1 - index * 0.15)), // Simulated drop-off
            dropOff: heatmap.dropOffRate * 100,
            avgTime: heatmap.timeOnPage.reduce((a, b) => a + b, 0) / Math.max(heatmap.timeOnPage.length, 1) / 1000,
                actions: heatmap.clicks.slice(0, 5).map((click) => ({
                type: 'click',
                target: `Element at (${click.x}, ${click.y})`,
                count: click.count,
            })),
        }));
    }, [heatmaps, totalSessions]);

    if (journeySteps.length === 0) {
        return (
            <div className="p-6 rounded-xl bg-white/[0.03] border border-white/10 text-center">
                <Activity className="w-8 h-8 text-white/30 mx-auto mb-2" />
                <p className="text-white/50">No journey data available yet</p>
                <p className="text-xs text-white/30 mt-1">
                    Run a synthetic test to generate user journey insights
                </p>
            </div>
        );
    }

    const maxVisitors = Math.max(...journeySteps.map(s => s.visitors));

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-medium text-white">User Journey Funnel</h3>
            </div>

            {/* Funnel Visualization */}
            <div className="space-y-2">
                {journeySteps.map((step, index) => {
                    const widthPercent = (step.visitors / maxVisitors) * 100;
                    const isLastStep = index === journeySteps.length - 1;

                    return (
                        <div key={step.page}>
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="relative"
                            >
                                {/* Funnel bar */}
                                <div className="relative h-16 rounded-xl overflow-hidden bg-white/[0.02]">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${widthPercent}%` }}
                                        transition={{ delay: index * 0.1 + 0.2, duration: 0.5 }}
                                        className="absolute inset-y-0 left-0 rounded-xl"
                                        style={{
                                            background: `linear-gradient(90deg, ${accentColor}40 0%, ${accentColor}20 100%)`,
                                            borderLeft: `3px solid ${accentColor}`,
                                        }}
                                    />

                                    {/* Content */}
                                    <div className="absolute inset-0 flex items-center justify-between px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                                                <span className="text-sm font-bold text-white">{index + 1}</span>
                                            </div>
                                            <div>
                                                <div className="font-medium text-white text-sm truncate max-w-[200px]">
                                                    {step.page}
                                                </div>
                                                <div className="text-xs text-white/50 flex items-center gap-2">
                                                    <span className="flex items-center gap-1">
                                                        <Users className="w-3 h-3" />
                                                        {step.visitors}
                                                    </span>
                                                    <span>•</span>
                                                    <span>{step.avgTime.toFixed(1)}s avg</span>
                                                </div>
                                            </div>
                                        </div>

                                        {!isLastStep && step.dropOff > 0 && (
                                            <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-red-500/20">
                                                <TrendingDown className="w-3 h-3 text-red-400" />
                                                <span className="text-xs text-red-400">
                                                    -{step.dropOff.toFixed(0)}%
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Arrow to next step */}
                                {!isLastStep && (
                                    <div className="flex justify-center py-1">
                                        <ArrowRight className="w-4 h-4 text-white/20 rotate-90" />
                                    </div>
                                )}
                            </motion.div>

                            {/* Popular actions on this page */}
                            {step.actions.length > 0 && (
                                <div className="ml-12 mt-2 mb-4 flex flex-wrap gap-2">
                                    {step.actions.slice(0, 3).map((action, actionIndex) => (
                                        <div
                                            key={actionIndex}
                                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 text-xs text-white/50"
                                        >
                                            <MousePointer2 className="w-3 h-3" />
                                            <span>{action.target}</span>
                                            <span className="text-white/30">×{action.count}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
                <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                        {journeySteps[0]?.visitors || 0}
                    </div>
                    <div className="text-xs text-white/40">Started</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold" style={{ color: accentColor }}>
                        {journeySteps[journeySteps.length - 1]?.visitors || 0}
                    </div>
                    <div className="text-xs text-white/40">Completed</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-amber-400">
                        {journeySteps.length > 0
                            ? Math.round((journeySteps[journeySteps.length - 1]?.visitors / journeySteps[0]?.visitors) * 100)
                            : 0}%
                    </div>
                    <div className="text-xs text-white/40">Conversion</div>
                </div>
            </div>
        </div>
    );
}

