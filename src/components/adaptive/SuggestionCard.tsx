/**
 * Suggestion Card
 *
 * Card displaying a UI improvement suggestion with preview and apply button.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ZapIcon,
    CheckIcon,
    XIcon,
    CodeIcon,
    ChevronDownIcon,
    ChevronRightIcon as ChevronUpIcon,
    WarningIcon,
    ActivityIcon,
} from '../ui/icons';

const accentColor = '#c8ff64';

interface CodeChange {
    file: string;
    selector: string;
    originalCode: string;
    suggestedCode: string;
    cssChanges?: Record<string, string>;
    addedClasses?: string[];
    removedClasses?: string[];
}

interface UISuggestion {
    id: string;
    patternId: string;
    suggestionType: string;
    description: string;
    rationale: string;
    codeChange: CodeChange;
    predictedImpact: number;
    autoApply: boolean;
    confidence: number;
    status: 'pending' | 'applied' | 'dismissed' | 'testing';
}

interface SuggestionCardProps {
    suggestion: UISuggestion;
    onApply: (id: string) => void;
    onDismiss: (id: string) => void;
    isApplying?: boolean;
}

export function SuggestionCard({
    suggestion,
    onApply,
    onDismiss,
    isApplying = false,
}: SuggestionCardProps) {
    const [expanded, setExpanded] = useState(false);
    const [showCode, setShowCode] = useState(false);

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'reposition': return '↔️';
            case 'resize': return '📐';
            case 'restyle': return '🎨';
            case 'add-feedback': return '💬';
            case 'simplify': return '✨';
            case 'add-tooltip': return '💡';
            case 'improve-contrast': return '🔆';
            case 'increase-click-area': return '👆';
            case 'add-loading-state': return '⏳';
            default: return '🔧';
        }
    };

    const getImpactColor = (impact: number) => {
        if (impact >= 70) return '#22c55e';
        if (impact >= 40) return '#f59e0b';
        return '#6b7280';
    };

    const isApplied = suggestion.status === 'applied';
    const isDismissed = suggestion.status === 'dismissed';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl border overflow-hidden transition-all ${
                isApplied
                    ? 'border-green-500/30 bg-green-500/5'
                    : isDismissed
                        ? 'border-white/5 bg-white/[0.01] opacity-50'
                        : 'border-white/10 bg-white/[0.02]'
            }`}
        >
            {/* Header */}
            <div
                className="p-4 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-start gap-3">
                    {/* Type icon */}
                    <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xl"
                        style={{ background: 'rgba(255,255,255,0.1)' }}
                    >
                        {getTypeIcon(suggestion.suggestionType)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-white">
                                {suggestion.description}
                            </h4>
                            {suggestion.autoApply && (
                                <span
                                    className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1"
                                    style={{ background: `${accentColor}20`, color: accentColor }}
                                >
                                    <ZapIcon size={10} />
                                    Auto
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-white/50 line-clamp-2">
                            {suggestion.rationale}
                        </p>
                    </div>

                    {/* Impact score */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <div className="flex items-center gap-1">
                            <ActivityIcon
                                size={16}
                                className="opacity-80"
                                style={{ color: getImpactColor(suggestion.predictedImpact) }}
                            />
                            <span
                                className="text-lg font-bold"
                                style={{ color: getImpactColor(suggestion.predictedImpact) }}
                            >
                                +{suggestion.predictedImpact}%
                            </span>
                        </div>
                        <span className="text-[10px] text-white/40">
                            {suggestion.confidence}% confidence
                        </span>
                    </div>

                    {/* Expand chevron */}
                    <button className="p-1 text-white/40 hover:text-white transition-colors">
                        {expanded ? (
                            <ChevronUpIcon size={20} />
                        ) : (
                            <ChevronDownIcon size={20} />
                        )}
                    </button>
                </div>

                {/* Status badge */}
                {(isApplied || isDismissed) && (
                    <div className={`mt-3 flex items-center gap-2 text-sm ${
                        isApplied ? 'text-green-400' : 'text-white/40'
                    }`}>
                        {isApplied ? (
                            <>
                                <CheckIcon size={16} />
                                Applied
                            </>
                        ) : (
                            <>
                                <XIcon size={16} />
                                Dismissed
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Expanded content */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-white/5"
                    >
                        <div className="p-4 space-y-4">
                            {/* Element selector */}
                            <div>
                                <p className="text-xs text-white/40 mb-1">Affected Element</p>
                                <code className="text-sm text-white/70 font-mono bg-black/30 px-2 py-1 rounded">
                                    {suggestion.codeChange.selector}
                                </code>
                            </div>

                            {/* Code preview toggle */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowCode(!showCode);
                                }}
                                className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
                            >
                                <CodeIcon size={16} />
                                {showCode ? 'Hide' : 'Show'} Code Changes
                            </button>

                            {/* Code diff */}
                            <AnimatePresence>
                                {showCode && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="space-y-3"
                                    >
                                        {/* Original code */}
                                        {suggestion.codeChange.originalCode && (
                                            <div>
                                                <p className="text-xs text-red-400/60 mb-1">Before</p>
                                                <pre className="text-xs font-mono p-3 rounded bg-red-500/10 border border-red-500/20 overflow-x-auto">
                                                    <code className="text-red-400/80">
                                                        {suggestion.codeChange.originalCode}
                                                    </code>
                                                </pre>
                                            </div>
                                        )}

                                        {/* Suggested code */}
                                        {suggestion.codeChange.suggestedCode && (
                                            <div>
                                                <p className="text-xs text-green-400/60 mb-1">After</p>
                                                <pre className="text-xs font-mono p-3 rounded bg-green-500/10 border border-green-500/20 overflow-x-auto">
                                                    <code className="text-green-400/80">
                                                        {suggestion.codeChange.suggestedCode}
                                                    </code>
                                                </pre>
                                            </div>
                                        )}

                                        {/* CSS changes */}
                                        {suggestion.codeChange.cssChanges && Object.keys(suggestion.codeChange.cssChanges).length > 0 && (
                                            <div>
                                                <p className="text-xs text-blue-400/60 mb-1">CSS Changes</p>
                                                <pre className="text-xs font-mono p-3 rounded bg-blue-500/10 border border-blue-500/20">
                                                    <code className="text-blue-400/80">
                                                        {Object.entries(suggestion.codeChange.cssChanges)
                                                            .map(([prop, val]) => `${prop}: ${val};`)
                                                            .join('\n')}
                                                    </code>
                                                </pre>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Action buttons */}
                            {suggestion.status === 'pending' && (
                                <div className="flex items-center gap-3 pt-2">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onApply(suggestion.id);
                                        }}
                                        disabled={isApplying}
                                        className="flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                        style={{ background: accentColor, color: 'black' }}
                                    >
                                        {isApplying ? (
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                                className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                                            />
                                        ) : (
                                            <>
                                                <ZapIcon size={16} />
                                                Apply Change
                                            </>
                                        )}
                                    </motion.button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDismiss(suggestion.id);
                                        }}
                                        className="px-4 py-2.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-all"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            )}

                            {/* Auto-apply warning */}
                            {suggestion.autoApply && suggestion.status === 'pending' && (
                                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                    <WarningIcon size={16} className="flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-400/80">
                                        This is a low-risk change that can be auto-applied.
                                        Review the changes above before applying.
                                    </p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

