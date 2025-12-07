/**
 * Competitor Grid
 *
 * 3D angled competitor cards with website screenshots and key metrics.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Globe, DollarSign, Star, Shield, AlertTriangle,
    ExternalLink, ChevronDown, ChevronUp, Layers
} from 'lucide-react';

const accentColor = '#c8ff64';

interface Competitor {
    id: string;
    name: string;
    url: string;
    description?: string;
    features?: Array<{ name: string; category: string }>;
    pricing?: Array<{ name: string; price: number }>;
    marketPosition?: {
        segment: string;
        pricePoint: string;
        primaryDifferentiator: string;
    };
    strengths?: string[];
    weaknesses?: string[];
    screenshot?: string;
    lastAnalyzed?: string;
}

interface CompetitorGridProps {
    competitors: Competitor[];
}

const SEGMENT_COLORS: Record<string, string> = {
    'enterprise': '#8b5cf6',
    'mid-market': '#3b82f6',
    'smb': '#10b981',
    'consumer': '#f59e0b',
};

const PRICE_COLORS: Record<string, string> = {
    'premium': '#ef4444',
    'mid-tier': '#f59e0b',
    'budget': '#10b981',
    'freemium': '#3b82f6',
};

export function CompetitorGrid({ competitors }: CompetitorGridProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    if (competitors.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center">
                <Globe className="w-12 h-12 text-white/20 mb-4" />
                <p className="text-white/50">No competitors analyzed yet</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {competitors.map((competitor, index) => {
                const isExpanded = expandedId === competitor.id;
                const segmentColor = SEGMENT_COLORS[competitor.marketPosition?.segment || 'smb'] || '#6b7280';
                const priceColor = PRICE_COLORS[competitor.marketPosition?.pricePoint || 'mid-tier'] || '#6b7280';

                return (
                    <motion.div
                        key={competitor.id}
                        initial={{ opacity: 0, y: 20, rotateX: -5 }}
                        animate={{ opacity: 1, y: 0, rotateX: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="group perspective-1000"
                    >
                        <motion.div
                            whileHover={{ rotateY: 3, rotateX: -3, scale: 1.02 }}
                            transition={{ type: 'spring', stiffness: 300 }}
                            className="relative rounded-2xl overflow-hidden"
                            style={{
                                background: 'linear-gradient(145deg, rgba(30,30,35,0.95) 0%, rgba(20,20,25,0.98) 100%)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                boxShadow: `
                                    0 25px 50px -12px rgba(0,0,0,0.5),
                                    0 0 0 1px rgba(255,255,255,0.05),
                                    inset 0 1px 0 rgba(255,255,255,0.05)
                                `,
                                transformStyle: 'preserve-3d',
                            }}
                        >
                            {/* Screenshot Header */}
                            <div className="relative h-40 overflow-hidden">
                                {competitor.screenshot ? (
                                    <img
                                        src={`data:image/png;base64,${competitor.screenshot}`}
                                        alt={competitor.name}
                                        className="w-full h-full object-cover object-top opacity-80 group-hover:opacity-100 transition-opacity"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-white/5 to-transparent flex items-center justify-center">
                                        <Globe className="w-16 h-16 text-white/20" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-[#14141a] via-transparent to-transparent" />

                                {/* Segment Badge */}
                                <div
                                    className="absolute top-3 left-3 px-2 py-1 rounded-lg text-xs font-medium"
                                    style={{ background: `${segmentColor}30`, color: segmentColor }}
                                >
                                    {competitor.marketPosition?.segment || 'Unknown'}
                                </div>

                                {/* External Link */}
                                <a
                                    href={competitor.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="absolute top-3 right-3 p-2 rounded-lg bg-black/50 hover:bg-black/70 transition-colors"
                                >
                                    <ExternalLink className="w-4 h-4 text-white/70" />
                                </a>
                            </div>

                            {/* Content */}
                            <div className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="font-semibold text-white text-lg">{competitor.name}</h3>
                                        <p className="text-xs text-white/40 truncate max-w-[200px]">{competitor.url}</p>
                                    </div>
                                    {competitor.pricing && competitor.pricing.length > 0 && (
                                        <div
                                            className="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1"
                                            style={{ background: `${priceColor}20`, color: priceColor }}
                                        >
                                            <DollarSign className="w-3 h-3" />
                                            {competitor.marketPosition?.pricePoint || 'mid-tier'}
                                        </div>
                                    )}
                                </div>

                                {competitor.description && (
                                    <p className="text-sm text-white/60 mb-3 line-clamp-2">
                                        {competitor.description}
                                    </p>
                                )}

                                {/* Quick Stats */}
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    <div className="text-center p-2 rounded-lg bg-white/5">
                                        <Layers className="w-4 h-4 mx-auto mb-1 text-blue-400" />
                                        <div className="text-lg font-bold text-white">
                                            {competitor.features?.length || 0}
                                        </div>
                                        <div className="text-[10px] text-white/40">Features</div>
                                    </div>
                                    <div className="text-center p-2 rounded-lg bg-white/5">
                                        <DollarSign className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
                                        <div className="text-lg font-bold text-white">
                                            {competitor.pricing?.length || 0}
                                        </div>
                                        <div className="text-[10px] text-white/40">Plans</div>
                                    </div>
                                    <div className="text-center p-2 rounded-lg bg-white/5">
                                        <Star className="w-4 h-4 mx-auto mb-1 text-amber-400" />
                                        <div className="text-lg font-bold text-white">
                                            {competitor.strengths?.length || 0}
                                        </div>
                                        <div className="text-[10px] text-white/40">Strengths</div>
                                    </div>
                                </div>

                                {/* Differentiator */}
                                {competitor.marketPosition?.primaryDifferentiator && (
                                    <div className="p-2 rounded-lg bg-white/5 mb-3">
                                        <div className="text-[10px] text-white/40 mb-1">Primary Differentiator</div>
                                        <p className="text-sm text-white/80">
                                            {competitor.marketPosition.primaryDifferentiator}
                                        </p>
                                    </div>
                                )}

                                {/* Expand Button */}
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : competitor.id)}
                                    className="w-full flex items-center justify-center gap-2 py-2 text-sm text-white/50 hover:text-white transition-colors"
                                >
                                    {isExpanded ? (
                                        <>
                                            <ChevronUp className="w-4 h-4" />
                                            Show Less
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown className="w-4 h-4" />
                                            Show Details
                                        </>
                                    )}
                                </button>

                                {/* Expanded Details */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="pt-4 space-y-4 border-t border-white/5">
                                                {/* Strengths */}
                                                {competitor.strengths && competitor.strengths.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center gap-2 text-sm text-emerald-400 mb-2">
                                                            <Shield className="w-4 h-4" />
                                                            Strengths
                                                        </div>
                                                        <ul className="space-y-1">
                                                            {competitor.strengths.map((strength, i) => (
                                                                <li key={i} className="text-sm text-white/60 flex items-start gap-2">
                                                                    <span className="text-emerald-400 mt-1">•</span>
                                                                    {strength}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Weaknesses */}
                                                {competitor.weaknesses && competitor.weaknesses.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center gap-2 text-sm text-red-400 mb-2">
                                                            <AlertTriangle className="w-4 h-4" />
                                                            Weaknesses
                                                        </div>
                                                        <ul className="space-y-1">
                                                            {competitor.weaknesses.map((weakness, i) => (
                                                                <li key={i} className="text-sm text-white/60 flex items-start gap-2">
                                                                    <span className="text-red-400 mt-1">•</span>
                                                                    {weakness}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Pricing Tiers */}
                                                {competitor.pricing && competitor.pricing.length > 0 && (
                                                    <div>
                                                        <div className="text-sm text-white/60 mb-2">Pricing Tiers</div>
                                                        <div className="space-y-2">
                                                            {competitor.pricing.map((tier, i) => (
                                                                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                                                                    <span className="text-sm text-white">{tier.name}</span>
                                                                    <span className="text-sm font-medium" style={{ color: accentColor }}>
                                                                        ${tier.price}/mo
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Last Analyzed */}
                                                {competitor.lastAnalyzed && (
                                                    <div className="text-xs text-white/30 text-right">
                                                        Last analyzed: {new Date(competitor.lastAnalyzed).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    </motion.div>
                );
            })}
        </div>
    );
}

