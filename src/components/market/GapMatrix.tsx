/**
 * Gap Matrix
 *
 * Interactive feature gap visualization with color-coded cells.
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    CheckCircleIcon,
    XCircleIcon,
    AlertCircleIcon,
    LightbulbIcon,
    TrendingUpIcon,
    ActivityIcon
} from '../ui/icons';

// Temporary icon alias for icon not yet in custom library
const FilterIcon = ActivityIcon; // Using ActivityIcon as Filter substitute
const CheckCircle2Icon = CheckCircleIcon;

const accentColor = '#c8ff64';

interface MarketGap {
    id: string;
    category: string;
    title: string;
    description: string;
    competitorCoverage?: Array<{
        competitor: string;
        competitorId?: string;
        coverage: 'none' | 'partial' | 'full';
    }>;
    opportunityScore: number;
    implementationEffort: string;
    estimatedImpact: string;
    suggestedApproach?: string;
}

interface Competitor {
    id: string;
    name: string;
}

interface GapMatrixProps {
    gaps: MarketGap[];
    competitors: Competitor[];
}

const COVERAGE_COLORS = {
    full: { bg: 'rgba(34,197,94,0.2)', color: '#22c55e', icon: CheckCircle2Icon },
    partial: { bg: 'rgba(251,191,36,0.2)', color: '#fbbf24', icon: AlertCircleIcon },
    none: { bg: 'rgba(239,68,68,0.2)', color: '#ef4444', icon: XCircleIcon },
    opportunity: { bg: 'rgba(59,130,246,0.2)', color: '#3b82f6', icon: LightbulbIcon },
};

const EFFORT_COLORS = {
    low: '#22c55e',
    medium: '#fbbf24',
    high: '#ef4444',
};

export function GapMatrix({ gaps, competitors }: GapMatrixProps) {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'score' | 'effort' | 'impact'>('score');

    // Get unique categories
    const categories = useMemo(() => {
        const cats = new Set<string>();
        gaps.forEach(g => cats.add(g.category));
        return Array.from(cats);
    }, [gaps]);

    // Filter and sort gaps
    const filteredGaps = useMemo(() => {
        let result = [...gaps];

        if (selectedCategory) {
            result = result.filter(g => g.category === selectedCategory);
        }

        switch (sortBy) {
            case 'score':
                result.sort((a, b) => b.opportunityScore - a.opportunityScore);
                break;
            case 'effort':
                const effortOrder = { low: 0, medium: 1, high: 2 };
                result.sort((a, b) => effortOrder[a.implementationEffort as keyof typeof effortOrder] - effortOrder[b.implementationEffort as keyof typeof effortOrder]);
                break;
            case 'impact':
                const impactOrder = { high: 0, medium: 1, low: 2 };
                result.sort((a, b) => impactOrder[a.estimatedImpact as keyof typeof impactOrder] - impactOrder[b.estimatedImpact as keyof typeof impactOrder]);
                break;
        }

        return result;
    }, [gaps, selectedCategory, sortBy]);

    if (gaps.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center">
                <AlertCircleIcon size={48} className="text-white/20 mb-4" />
                <p className="text-white/50">No market gaps identified yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <FilterIcon size={16} className="text-white/40" />
                    <span className="text-sm text-white/60">Category:</span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={`px-3 py-1 rounded-lg text-sm transition-all ${
                                !selectedCategory
                                    ? 'bg-white/10 text-white'
                                    : 'text-white/50 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            All
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3 py-1 rounded-lg text-sm transition-all ${
                                    selectedCategory === cat
                                        ? 'bg-white/10 text-white'
                                        : 'text-white/50 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                    <span className="text-sm text-white/60">Sort by:</span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                        className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none"
                    >
                        <option value="score">Opportunity Score</option>
                        <option value="effort">Implementation Effort</option>
                        <option value="impact">Estimated Impact</option>
                    </select>
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 p-4 rounded-xl bg-white/5">
                <span className="text-sm text-white/60">Coverage:</span>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ background: COVERAGE_COLORS.full.bg }} />
                    <span className="text-sm text-white/60">Full</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ background: COVERAGE_COLORS.partial.bg }} />
                    <span className="text-sm text-white/60">Partial</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ background: COVERAGE_COLORS.none.bg }} />
                    <span className="text-sm text-white/60">None (Gap)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ background: COVERAGE_COLORS.opportunity.bg }} />
                    <span className="text-sm text-white/60">Opportunity</span>
                </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="text-left py-3 px-4 text-sm font-medium text-white/60">Gap / Feature</th>
                            {competitors.map(comp => (
                                <th key={comp.id} className="py-3 px-4 text-sm font-medium text-white/60 text-center min-w-[100px]">
                                    {comp.name}
                                </th>
                            ))}
                            <th className="py-3 px-4 text-sm font-medium text-white/60 text-center">Score</th>
                            <th className="py-3 px-4 text-sm font-medium text-white/60 text-center">Effort</th>
                            <th className="py-3 px-4 text-sm font-medium text-white/60 text-center">Impact</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredGaps.map((gap, index) => (
                            <motion.tr
                                key={gap.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="border-b border-white/5 hover:bg-white/[0.02] group"
                            >
                                <td className="py-4 px-4">
                                    <div className="flex items-start gap-3">
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{ background: COVERAGE_COLORS.opportunity.bg, color: COVERAGE_COLORS.opportunity.color }}
                                        >
                                            <LightbulbIcon size={16} />
                                        </div>
                                        <div>
                                            <div className="font-medium text-white">{gap.title}</div>
                                            <div className="text-xs text-white/40">{gap.category}</div>
                                        </div>
                                    </div>
                                </td>
                                {competitors.map(comp => {
                                    const coverage = gap.competitorCoverage?.find(
                                        c => c.competitor === comp.name || c.competitorId === comp.id
                                    )?.coverage || 'none';
                                    const config = COVERAGE_COLORS[coverage];
                                    const Icon = config.icon;

                                    return (
                                        <td key={comp.id} className="py-4 px-4 text-center">
                                            <motion.div
                                                whileHover={{ scale: 1.1 }}
                                                className="inline-flex items-center justify-center w-10 h-10 rounded-lg mx-auto"
                                                style={{ background: config.bg, color: config.color }}
                                            >
                                                <Icon size={20} />
                                            </motion.div>
                                        </td>
                                    );
                                })}
                                <td className="py-4 px-4 text-center">
                                    <div
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg"
                                        style={{
                                            background: `linear-gradient(90deg, ${accentColor}20 0%, transparent ${gap.opportunityScore}%)`,
                                        }}
                                    >
                                        <TrendingUpIcon size={16} className="text-[#c8ff64]" />
                                        <span className="font-bold text-white">{gap.opportunityScore}</span>
                                    </div>
                                </td>
                                <td className="py-4 px-4 text-center">
                                    <span
                                        className="px-2 py-1 rounded-lg text-sm font-medium capitalize"
                                        style={{
                                            background: `${EFFORT_COLORS[gap.implementationEffort as keyof typeof EFFORT_COLORS]}20`,
                                            color: EFFORT_COLORS[gap.implementationEffort as keyof typeof EFFORT_COLORS],
                                        }}
                                    >
                                        {gap.implementationEffort}
                                    </span>
                                </td>
                                <td className="py-4 px-4 text-center">
                                    <span
                                        className="px-2 py-1 rounded-lg text-sm font-medium capitalize"
                                        style={{
                                            background: `${EFFORT_COLORS[gap.estimatedImpact as keyof typeof EFFORT_COLORS] || '#6b7280'}20`,
                                            color: EFFORT_COLORS[gap.estimatedImpact as keyof typeof EFFORT_COLORS] || '#6b7280',
                                        }}
                                    >
                                        {gap.estimatedImpact}
                                    </span>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Gap Details Panel */}
            {filteredGaps.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-white/60">Gap Details</h3>
                    {filteredGaps.slice(0, 5).map(gap => (
                        <motion.div
                            key={gap.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 rounded-xl bg-white/[0.03] border border-white/10"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <h4 className="font-medium text-white">{gap.title}</h4>
                                    <p className="text-sm text-white/60">{gap.description}</p>
                                </div>
                                <span
                                    className="px-3 py-1 rounded-full text-sm font-bold"
                                    style={{ background: `${accentColor}20`, color: accentColor }}
                                >
                                    {gap.opportunityScore}
                                </span>
                            </div>
                            {gap.suggestedApproach && (
                                <div className="mt-3 p-3 rounded-lg bg-white/5">
                                    <div className="text-xs text-white/40 mb-1">Suggested Approach</div>
                                    <p className="text-sm text-white/80">{gap.suggestedApproach}</p>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}

