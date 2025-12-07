/**
 * Positioning Radar
 *
 * Radar chart showing market positioning with smooth animations.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Target, MessageSquare, Users, Trophy, DollarSign, Quote, Star } from 'lucide-react';

const accentColor = '#c8ff64';

interface Positioning {
    currentPosition: string;
    recommendedPosition: string;
    valueProposition: string;
    targetAudience: string;
    keyMessages: string[];
    competitiveAdvantages: string[];
    pricingStrategy: string;
}

interface Competitor {
    id: string;
    name: string;
    marketPosition?: {
        segment: string;
        pricePoint: string;
    };
}

interface PositioningRadarProps {
    positioning: Positioning;
    competitors: Competitor[];
}

// Radar chart dimensions
const RADAR_SIZE = 300;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 120;

// Position map for visualization
const SEGMENT_POSITIONS: Record<string, { x: number; y: number }> = {
    enterprise: { x: 0.3, y: 0.2 },
    'mid-market': { x: 0.5, y: 0.4 },
    smb: { x: 0.7, y: 0.6 },
    consumer: { x: 0.8, y: 0.8 },
};

const PRICE_POSITIONS: Record<string, number> = {
    premium: 0.9,
    'mid-tier': 0.6,
    budget: 0.35,
    freemium: 0.15,
};

const SEGMENT_COLORS: Record<string, string> = {
    enterprise: '#8b5cf6',
    'mid-market': '#3b82f6',
    smb: '#10b981',
    consumer: '#f59e0b',
};

export function PositioningRadar({ positioning, competitors }: PositioningRadarProps) {
    // Calculate competitor positions for visualization
    const competitorPositions = useMemo(() => {
        return competitors.map(comp => {
            const segment = comp.marketPosition?.segment || 'smb';
            const pricePoint = comp.marketPosition?.pricePoint || 'mid-tier';

            const basePos = SEGMENT_POSITIONS[segment] || { x: 0.5, y: 0.5 };
            const priceOffset = PRICE_POSITIONS[pricePoint] || 0.5;

            return {
                ...comp,
                x: basePos.x * RADAR_SIZE,
                y: basePos.y * RADAR_SIZE,
                color: SEGMENT_COLORS[segment] || '#6b7280',
                size: Math.max(20, priceOffset * 40),
            };
        });
    }, [competitors]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Radar Visualization */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                <h3 className="text-sm font-medium text-white/60 mb-4 flex items-center gap-2">
                    <Target className="w-4 h-4" style={{ color: accentColor }} />
                    Market Position Map
                </h3>

                <div className="relative" style={{ width: RADAR_SIZE, height: RADAR_SIZE, margin: '0 auto' }}>
                    {/* Background Grid */}
                    <svg width={RADAR_SIZE} height={RADAR_SIZE} className="absolute inset-0">
                        {/* Concentric circles */}
                        {[0.25, 0.5, 0.75, 1].map((scale, i) => (
                            <circle
                                key={i}
                                cx={RADAR_CENTER}
                                cy={RADAR_CENTER}
                                r={RADAR_RADIUS * scale}
                                fill="none"
                                stroke="rgba(255,255,255,0.1)"
                                strokeWidth="1"
                                strokeDasharray="4 4"
                            />
                        ))}

                        {/* Quadrant lines */}
                        <line x1={RADAR_CENTER} y1="10" x2={RADAR_CENTER} y2={RADAR_SIZE - 10} stroke="rgba(255,255,255,0.1)" />
                        <line x1="10" y1={RADAR_CENTER} x2={RADAR_SIZE - 10} y2={RADAR_CENTER} stroke="rgba(255,255,255,0.1)" />

                        {/* Axis labels */}
                        <text x={RADAR_CENTER} y="20" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10">Enterprise</text>
                        <text x={RADAR_CENTER} y={RADAR_SIZE - 10} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10">Consumer</text>
                        <text x="15" y={RADAR_CENTER} textAnchor="start" fill="rgba(255,255,255,0.4)" fontSize="10">Budget</text>
                        <text x={RADAR_SIZE - 15} y={RADAR_CENTER} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="10">Premium</text>
                    </svg>

                    {/* Competitor dots */}
                    {competitorPositions.map((comp, index) => (
                        <motion.div
                            key={comp.id}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: index * 0.1, type: 'spring' }}
                            className="absolute flex items-center justify-center rounded-full cursor-pointer group"
                            style={{
                                left: comp.x - comp.size / 2,
                                top: comp.y - comp.size / 2,
                                width: comp.size,
                                height: comp.size,
                                background: `${comp.color}40`,
                                border: `2px solid ${comp.color}`,
                            }}
                            title={comp.name}
                        >
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-black/80 text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                {comp.name}
                            </div>
                        </motion.div>
                    ))}

                    {/* Your position (center with accent) */}
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5, type: 'spring' }}
                        className="absolute flex items-center justify-center rounded-full"
                        style={{
                            left: RADAR_CENTER - 20,
                            top: RADAR_CENTER - 20,
                            width: 40,
                            height: 40,
                            background: `${accentColor}40`,
                            border: `3px solid ${accentColor}`,
                            boxShadow: `0 0 20px ${accentColor}40`,
                        }}
                    >
                        <Star className="w-5 h-5" style={{ color: accentColor }} />
                    </motion.div>
                </div>

                {/* Legend */}
                <div className="mt-4 flex flex-wrap gap-3 justify-center">
                    {Object.entries(SEGMENT_COLORS).map(([segment, color]) => (
                        <div key={segment} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                            <span className="text-xs text-white/60 capitalize">{segment}</span>
                        </div>
                    ))}
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: accentColor }} />
                        <span className="text-xs text-white/60">You</span>
                    </div>
                </div>
            </div>

            {/* Right: Positioning Details */}
            <div className="space-y-4">
                {/* Value Proposition */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-5 rounded-2xl bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10"
                >
                    <div className="flex items-center gap-2 mb-3">
                        <Quote className="w-5 h-5" style={{ color: accentColor }} />
                        <h3 className="font-medium text-white">Value Proposition</h3>
                    </div>
                    <p className="text-lg text-white/80 italic">"{positioning.valueProposition}"</p>
                </motion.div>

                {/* Current vs Recommended */}
                <div className="grid grid-cols-2 gap-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="p-4 rounded-xl bg-white/[0.03] border border-white/10"
                    >
                        <div className="text-xs text-white/40 mb-2">Current Position</div>
                        <p className="text-sm text-white/70">{positioning.currentPosition || 'Not defined'}</p>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="p-4 rounded-xl border"
                        style={{ background: `${accentColor}10`, borderColor: `${accentColor}30` }}
                    >
                        <div className="text-xs mb-2" style={{ color: accentColor }}>Recommended</div>
                        <p className="text-sm text-white/90">{positioning.recommendedPosition}</p>
                    </motion.div>
                </div>

                {/* Target Audience */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-4 rounded-xl bg-white/[0.03] border border-white/10"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-blue-400" />
                        <span className="text-xs text-white/40">Target Audience</span>
                    </div>
                    <p className="text-sm text-white/80">{positioning.targetAudience}</p>
                </motion.div>

                {/* Key Messages */}
                {positioning.keyMessages && positioning.keyMessages.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="p-4 rounded-xl bg-white/[0.03] border border-white/10"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <MessageSquare className="w-4 h-4 text-purple-400" />
                            <span className="text-xs text-white/40">Key Messages</span>
                        </div>
                        <ul className="space-y-2">
                            {positioning.keyMessages.map((msg, i) => (
                                <li key={i} className="flex items-start gap-2">
                                    <span className="text-purple-400">•</span>
                                    <span className="text-sm text-white/70">{msg}</span>
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                )}

                {/* Competitive Advantages */}
                {positioning.competitiveAdvantages && positioning.competitiveAdvantages.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="p-4 rounded-xl bg-white/[0.03] border border-white/10"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <Trophy className="w-4 h-4 text-amber-400" />
                            <span className="text-xs text-white/40">Competitive Advantages</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {positioning.competitiveAdvantages.map((adv, i) => (
                                <span
                                    key={i}
                                    className="px-3 py-1 rounded-full text-xs bg-amber-500/20 text-amber-400"
                                >
                                    {adv}
                                </span>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Pricing Strategy */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="p-4 rounded-xl bg-white/[0.03] border border-white/10"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs text-white/40">Pricing Strategy</span>
                    </div>
                    <p className="text-sm text-white/80">{positioning.pricingStrategy}</p>
                </motion.div>
            </div>
        </div>
    );
}

