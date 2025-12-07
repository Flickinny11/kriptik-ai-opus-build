/**
 * Pattern Timeline
 *
 * Timeline view of detected behavior patterns.
 */

import { motion } from 'framer-motion';
import { AlertTriangle, Zap, HelpCircle, CheckCircle, TrendingDown } from 'lucide-react';

const accentColor = '#c8ff64';

interface ElementIdentifier {
    selector: string;
    componentType: string;
    text?: string;
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

interface PatternTimelineProps {
    patterns: BehaviorPattern[];
    className?: string;
}

export function PatternTimeline({
    patterns,
    className = '',
}: PatternTimelineProps) {
    const sortedPatterns = [...patterns].sort(
        (a, b) => new Date(b.lastDetected).getTime() - new Date(a.lastDetected).getTime()
    );

    const getPatternIcon = (type: string) => {
        switch (type) {
            case 'friction':
                return <AlertTriangle className="w-4 h-4" />;
            case 'engagement':
                return <Zap className="w-4 h-4" />;
            case 'confusion':
                return <HelpCircle className="w-4 h-4" />;
            case 'success':
                return <CheckCircle className="w-4 h-4" />;
            case 'drop-off':
                return <TrendingDown className="w-4 h-4" />;
            default:
                return <AlertTriangle className="w-4 h-4" />;
        }
    };

    const getPatternColor = (type: string) => {
        switch (type) {
            case 'friction':
                return '#ef4444';
            case 'engagement':
                return accentColor;
            case 'confusion':
                return '#f59e0b';
            case 'success':
                return '#22c55e';
            case 'drop-off':
                return '#8b5cf6';
            default:
                return '#6b7280';
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical':
                return '#ef4444';
            case 'high':
                return '#f59e0b';
            case 'medium':
                return '#eab308';
            case 'low':
                return '#22c55e';
            default:
                return '#6b7280';
        }
    };

    const formatTime = (date: Date | string) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    if (patterns.length === 0) {
        return (
            <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
                <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                    style={{ background: `${accentColor}20` }}
                >
                    <Zap className="w-8 h-8" style={{ color: accentColor }} />
                </div>
                <p className="text-white/60">No patterns detected yet</p>
                <p className="text-sm text-white/40 mt-1">
                    Patterns will appear as users interact with your app
                </p>
            </div>
        );
    }

    return (
        <div className={`relative ${className}`}>
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-white/10" />

            {/* Pattern items */}
            <div className="space-y-4">
                {sortedPatterns.map((pattern, index) => {
                    const color = getPatternColor(pattern.patternType);

                    return (
                        <motion.div
                            key={pattern.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="relative flex gap-4 pl-2"
                        >
                            {/* Timeline dot */}
                            <div
                                className="relative z-10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{
                                    background: `${color}20`,
                                    color: color,
                                    border: `2px solid ${color}`,
                                }}
                            >
                                {getPatternIcon(pattern.patternType)}
                            </div>

                            {/* Content */}
                            <div
                                className="flex-1 p-3 rounded-lg border transition-all hover:bg-white/[0.02]"
                                style={{ borderColor: `${color}20` }}
                            >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div>
                                        <h4 className="text-sm font-medium text-white">
                                            {pattern.description}
                                        </h4>
                                        <p className="text-xs text-white/40 mt-0.5">
                                            {pattern.frequency} occurrences · {pattern.sessionCount} sessions
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                                            style={{
                                                background: `${getSeverityColor(pattern.severity)}20`,
                                                color: getSeverityColor(pattern.severity),
                                            }}
                                        >
                                            {pattern.severity}
                                        </span>
                                        <span className="text-xs text-white/40">
                                            {formatTime(pattern.lastDetected)}
                                        </span>
                                    </div>
                                </div>

                                {/* Affected elements */}
                                <div className="flex flex-wrap gap-1">
                                    {pattern.affectedElements.slice(0, 3).map((el, i) => (
                                        <span
                                            key={i}
                                            className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/50 font-mono"
                                        >
                                            {el.componentType || el.selector.slice(0, 20)}
                                        </span>
                                    ))}
                                    {pattern.affectedElements.length > 3 && (
                                        <span className="text-[10px] px-1.5 py-0.5 text-white/40">
                                            +{pattern.affectedElements.length - 3} more
                                        </span>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

