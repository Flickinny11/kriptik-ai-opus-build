/**
 * Behavior Heatmap
 *
 * Heatmap overlay showing user interactions with gradient colors.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface HeatmapPoint {
    x: number;
    y: number;
    intensity: number;
    type: 'click' | 'hover' | 'scroll-stop';
}

interface ElementHeatmap {
    selector: string;
    interactions: number;
    avgTimeOnElement: number;
    clickRate: number;
}

interface BehaviorHeatmapProps {
    points: HeatmapPoint[];
    elementHeatmap: ElementHeatmap[];
    width?: number;
    height?: number;
    showOverlay?: boolean;
    className?: string;
}

export function BehaviorHeatmap({
    points,
    elementHeatmap,
    width = 800,
    height = 600,
    showOverlay = true,
    className = '',
}: BehaviorHeatmapProps) {
    // Find max intensity for normalization
    const maxIntensity = useMemo(() => {
        return Math.max(...points.map(p => p.intensity), 1);
    }, [points]);

    // Get color based on intensity (blue → green → yellow → red)
    const getColor = (intensity: number) => {
        const normalized = intensity / maxIntensity;
        
        if (normalized < 0.25) {
            // Blue to cyan
            const t = normalized / 0.25;
            return `rgba(59, 130, 246, ${0.3 + t * 0.3})`;
        } else if (normalized < 0.5) {
            // Cyan to green
            const t = (normalized - 0.25) / 0.25;
            return `rgba(34, 197, ${94 + t * 100}, ${0.4 + t * 0.2})`;
        } else if (normalized < 0.75) {
            // Green to yellow
            const t = (normalized - 0.5) / 0.25;
            return `rgba(${200 + t * 55}, ${197 - t * 50}, 94, ${0.6 + t * 0.2})`;
        } else {
            // Yellow to red
            const t = (normalized - 0.75) / 0.25;
            return `rgba(239, ${68 + (1 - t) * 130}, 68, ${0.7 + t * 0.3})`;
        }
    };

    // Get radius based on intensity
    const getRadius = (intensity: number) => {
        const normalized = intensity / maxIntensity;
        return 20 + normalized * 40;
    };

    // Top elements by interactions
    const topElements = useMemo(() => {
        return [...elementHeatmap]
            .sort((a, b) => b.interactions - a.interactions)
            .slice(0, 5);
    }, [elementHeatmap]);

    return (
        <div className={`relative ${className}`}>
            {/* Heatmap canvas */}
            <svg
                width={width}
                height={height}
                className="overflow-visible"
                style={{ background: 'rgba(0,0,0,0.02)' }}
            >
                {/* Define gradient for points */}
                <defs>
                    {points.map((point, i) => (
                        <radialGradient key={i} id={`heatGrad-${i}`}>
                            <stop offset="0%" stopColor={getColor(point.intensity)} stopOpacity="0.9" />
                            <stop offset="100%" stopColor={getColor(point.intensity)} stopOpacity="0" />
                        </radialGradient>
                    ))}
                </defs>

                {/* Render heatmap points */}
                {points.map((point, i) => (
                    <motion.circle
                        key={i}
                        cx={point.x}
                        cy={point.y}
                        r={getRadius(point.intensity)}
                        fill={`url(#heatGrad-${i})`}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.01 }}
                        style={{ mixBlendMode: 'screen' }}
                    />
                ))}
            </svg>

            {/* Legend */}
            <div className="absolute top-4 right-4 p-3 rounded-lg bg-black/80 backdrop-blur-sm border border-white/10">
                <p className="text-xs text-white/60 mb-2">Interaction Intensity</p>
                <div className="flex items-center gap-1">
                    <div className="w-16 h-2 rounded-full" style={{
                        background: 'linear-gradient(to right, rgba(59, 130, 246, 0.6), rgba(34, 197, 194, 0.7), rgba(200, 255, 100, 0.8), rgba(239, 68, 68, 0.9))'
                    }} />
                </div>
                <div className="flex justify-between text-[10px] text-white/40 mt-1">
                    <span>Low</span>
                    <span>High</span>
                </div>
            </div>

            {/* Stats overlay */}
            {showOverlay && (
                <div className="absolute bottom-4 left-4 p-3 rounded-lg bg-black/80 backdrop-blur-sm border border-white/10 max-w-xs">
                    <p className="text-xs text-white/60 mb-2">Top Interacted Elements</p>
                    <div className="space-y-2">
                        {topElements.map((el, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ background: getColor(el.interactions) }}
                                />
                                <span className="text-xs text-white/80 truncate flex-1 font-mono">
                                    {el.selector.length > 25 ? el.selector.slice(0, 25) + '...' : el.selector}
                                </span>
                                <span className="text-xs text-white/50">
                                    {el.interactions}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Point type legend */}
            <div className="absolute top-4 left-4 p-3 rounded-lg bg-black/80 backdrop-blur-sm border border-white/10">
                <p className="text-xs text-white/60 mb-2">Point Types</p>
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/70" />
                        <span className="text-xs text-white/70">Clicks</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500/70" />
                        <span className="text-xs text-white/70">Hover</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500/70" />
                        <span className="text-xs text-white/70">Scroll Stop</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

