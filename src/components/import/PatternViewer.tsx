/**
 * Pattern Viewer
 *
 * Detected patterns with code examples.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayersIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    CodeIcon,
    PaletteIcon,
    DatabaseIcon,
    SquareIcon,
    FileCodeIcon,
} from '../ui/icons';

const accentColor = '#c8ff64';

interface CodeExample {
    file: string;
    startLine?: number;
    endLine?: number;
    code: string;
}

interface DetectedPattern {
    type: 'architecture' | 'naming' | 'component' | 'state-management' | 'styling' | 'api';
    name: string;
    description: string;
    examples: CodeExample[];
    confidence: number;
}

interface PatternViewerProps {
    patterns: DetectedPattern[];
    className?: string;
}

const PATTERN_ICONS: Record<string, React.FC<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
    architecture: LayersIcon,
    naming: FileCodeIcon,
    component: SquareIcon,
    'state-management': DatabaseIcon,
    styling: PaletteIcon,
    api: CodeIcon,
};

const PATTERN_COLORS: Record<string, string> = {
    architecture: '#8b5cf6',
    naming: '#3b82f6',
    component: '#10b981',
    'state-management': '#f59e0b',
    styling: '#ec4899',
    api: '#06b6d4',
};

export function PatternViewer({
    patterns,
    className = '',
}: PatternViewerProps) {
    const [expandedPattern, setExpandedPattern] = useState<string | null>(null);

    const getConfidenceLabel = (confidence: number) => {
        if (confidence >= 0.8) return { text: 'High', color: '#22c55e' };
        if (confidence >= 0.5) return { text: 'Medium', color: '#f59e0b' };
        return { text: 'Low', color: '#6b7280' };
    };

    if (patterns.length === 0) {
        return (
            <div className={`rounded-xl border border-white/10 bg-black/30 p-8 text-center ${className}`}>
                <LayersIcon size={48} className="text-white/20 mx-auto mb-3" />
                <p className="text-white/60">No patterns detected yet</p>
                <p className="text-sm text-white/40 mt-1">Import a codebase to detect patterns</p>
            </div>
        );
    }

    return (
        <div className={`rounded-xl border border-white/10 bg-black/30 overflow-hidden ${className}`}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <LayersIcon size={16} style={{ color: accentColor }} />
                    Detected Patterns ({patterns.length})
                </h3>
            </div>

            {/* Patterns list */}
            <div className="divide-y divide-white/5">
                {patterns.map((pattern, index) => {
                    const Icon = PATTERN_ICONS[pattern.type] || LayersIcon;
                    const color = PATTERN_COLORS[pattern.type] || '#6b7280';
                    const confidence = getConfidenceLabel(pattern.confidence);
                    const isExpanded = expandedPattern === pattern.name;

                    return (
                        <motion.div
                            key={`${pattern.type}-${pattern.name}-${index}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <button
                                onClick={() => setExpandedPattern(isExpanded ? null : pattern.name)}
                                className="w-full p-4 text-left hover:bg-white/[0.02] transition-colors"
                            >
                                <div className="flex items-start gap-3">
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: `${color}20` }}
                                    >
                                        <Icon size={16} style={{ color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-medium text-white">{pattern.name}</h4>
                                            <span
                                                className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                                                style={{ background: `${color}20`, color }}
                                            >
                                                {pattern.type}
                                            </span>
                                        </div>
                                        <p className="text-sm text-white/50 mt-1 line-clamp-2">
                                            {pattern.description}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="text-xs px-2 py-0.5 rounded"
                                            style={{ background: `${confidence.color}20`, color: confidence.color }}
                                        >
                                            {Math.round(pattern.confidence * 100)}%
                                        </span>
                                        {isExpanded ? (
                                            <ChevronUpIcon size={16} className="text-white/40" />
                                        ) : (
                                            <ChevronDownIcon size={16} className="text-white/40" />
                                        )}
                                    </div>
                                </div>
                            </button>

                            {/* Expanded examples */}
                            <AnimatePresence>
                                {isExpanded && pattern.examples.length > 0 && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="border-t border-white/5"
                                    >
                                        <div className="p-4 space-y-3">
                                            <p className="text-xs text-white/40">Code Examples:</p>
                                            {pattern.examples.slice(0, 3).map((example, i) => (
                                                <div
                                                    key={i}
                                                    className="rounded-lg bg-black/40 border border-white/5 overflow-hidden"
                                                >
                                                    <div className="px-3 py-1.5 bg-white/5 border-b border-white/5">
                                                        <span className="text-xs text-white/50 font-mono">
                                                            {example.file}
                                                        </span>
                                                    </div>
                                                    <pre className="p-3 text-xs overflow-x-auto">
                                                        <code className="text-white/70 font-mono">
                                                            {example.code.slice(0, 500)}
                                                            {example.code.length > 500 && '...'}
                                                        </code>
                                                    </pre>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

