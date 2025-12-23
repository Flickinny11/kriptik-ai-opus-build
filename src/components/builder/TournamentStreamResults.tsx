/**
 * Tournament Stream Results - Expandable tournament results in streaming chat
 *
 * Features:
 * - Collapsible sections for each competitor's work
 * - Sandbox preview on hover
 * - Real-time progress updates
 * - Integration with AgentActivityStream
 * - Liquid Glass styling
 */

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TrophyIcon,
    ChevronDownIcon,
    CodeIcon,
    EyeIcon,
    CheckCircleIcon,
    ClockIcon,
    SparklesIcon,
    ZapIcon,
    GavelIcon,
} from '../ui/icons';

// =============================================================================
// TYPES
// =============================================================================

export interface TournamentCompetitor {
    id: string;
    name: string;
    model: string;
    status: 'pending' | 'building' | 'verifying' | 'complete' | 'failed';
    progress: number;
    sandboxUrl?: string;
    files?: Record<string, string>;
    buildTimeMs?: number;
    tokensUsed?: number;
    scores?: {
        codeQuality?: number;
        visual?: number;
        antiSlop?: number;
        security?: number;
        creativity?: number;
        efficiency?: number;
    };
    summary?: string;
    highlights?: string[];
}

export interface TournamentJudge {
    id: string;
    model: string;
    status: 'pending' | 'evaluating' | 'voted';
    vote?: string;
    reasoning?: string;
    confidence?: number;
}

export interface TournamentStreamData {
    tournamentId: string;
    featureDescription: string;
    phase: 'init' | 'building' | 'verifying' | 'judging' | 'selecting' | 'complete';
    competitors: TournamentCompetitor[];
    judges: TournamentJudge[];
    winner?: {
        competitorId: string;
        competitorName: string;
        voteCount: number;
        totalJudges: number;
    };
    startTime: number;
    endTime?: number;
}

interface TournamentStreamResultsProps {
    data: TournamentStreamData;
    onSelectWinner?: (files: Record<string, string>) => void;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function ProgressBar({ progress }: { progress: number }) {
    return (
        <div className="h-1 w-full bg-stone-200/50 rounded-full overflow-hidden">
            <motion.div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
            />
        </div>
    );
}

function ScoreBadge({ label, score }: { label: string; score: number }) {
    const getColor = (s: number) => {
        if (s >= 90) return 'text-emerald-600';
        if (s >= 75) return 'text-blue-600';
        if (s >= 60) return 'text-amber-600';
        return 'text-red-600';
    };

    return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-stone-100/50">
            <span className="text-xs text-stone-500">{label}</span>
            <span className={`text-xs font-mono font-medium ${getColor(score)}`}>{score}%</span>
        </div>
    );
}

function SandboxPreview({
    url,
    name,
    isVisible,
    position,
}: {
    url: string;
    name: string;
    isVisible: boolean;
    position: { x: number; y: number };
}) {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="fixed z-[100] pointer-events-none"
                    style={{
                        left: position.x + 10,
                        top: position.y - 200,
                    }}
                >
                    <div
                        className="w-[400px] h-[300px] rounded-xl overflow-hidden shadow-2xl"
                        style={{
                            background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)',
                            boxShadow: '0 25px 50px rgba(0,0,0,0.25), 0 10px 20px rgba(0,0,0,0.1)',
                        }}
                    >
                        {/* Preview Header */}
                        <div
                            className="px-3 py-2 flex items-center gap-2 border-b border-stone-200/50"
                            style={{
                                background: 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(250,250,250,0.9) 100%)',
                            }}
                        >
                            <EyeIcon size={14} className="text-stone-400" />
                            <span className="text-xs font-medium text-stone-600">{name} Preview</span>
                        </div>

                        {/* Iframe Preview */}
                        <iframe
                            src={url}
                            className="w-full h-[260px] border-0 pointer-events-none"
                            title={`${name} preview`}
                            sandbox="allow-scripts"
                        />
                    </div>

                    {/* Arrow pointer */}
                    <div
                        className="absolute -bottom-2 left-4 w-4 h-4 rotate-45"
                        style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)',
                            boxShadow: '2px 2px 4px rgba(0,0,0,0.1)',
                        }}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// =============================================================================
// COMPETITOR CARD
// =============================================================================

function CompetitorCard({
    competitor,
    isWinner,
    onHoverStart,
    onHoverEnd,
}: {
    competitor: TournamentCompetitor;
    isWinner: boolean;
    onHoverStart: (e: React.MouseEvent) => void;
    onHoverEnd: () => void;
}) {
    const [isExpanded, setIsExpanded] = useState(false);

    const getStatusIcon = () => {
        switch (competitor.status) {
            case 'complete':
                return <CheckCircleIcon size={14} className="text-emerald-500" />;
            case 'building':
            case 'verifying':
                return (
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                        <ZapIcon size={14} className="text-amber-500" />
                    </motion.div>
                );
            case 'failed':
                return <span className="text-red-500 text-xs font-bold">!</span>;
            default:
                return <ClockIcon size={14} className="text-stone-400" />;
        }
    };

    return (
        <motion.div
            className={`rounded-xl overflow-hidden transition-all ${isWinner ? 'ring-2 ring-amber-400' : ''}`}
            style={{
                background: isWinner
                    ? 'linear-gradient(145deg, rgba(251,191,36,0.15) 0%, rgba(245,158,11,0.08) 100%)'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.4) 100%)',
                backdropFilter: 'blur(16px)',
                boxShadow: isWinner
                    ? '0 4px 16px rgba(251,191,36,0.2), inset 0 1px 2px rgba(255,255,255,0.9)'
                    : '0 2px 8px rgba(0,0,0,0.05), inset 0 1px 2px rgba(255,255,255,0.8)',
            }}
        >
            {/* Header - Always visible */}
            <button
                className="w-full px-3 py-2.5 flex items-center gap-3 text-left"
                onClick={() => setIsExpanded(!isExpanded)}
                onMouseEnter={onHoverStart}
                onMouseLeave={onHoverEnd}
            >
                {/* Status indicator */}
                <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-white/50">
                    {getStatusIcon()}
                </div>

                {/* Name and model */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-stone-700 truncate">
                            {competitor.name}
                        </span>
                        {isWinner && (
                            <TrophyIcon size={14} className="text-amber-500 flex-shrink-0" />
                        )}
                    </div>
                    <span className="text-xs text-stone-400">{competitor.model}</span>
                </div>

                {/* Progress or scores */}
                <div className="flex items-center gap-2">
                    {competitor.status === 'complete' && competitor.scores?.codeQuality ? (
                        <span className="text-xs font-mono font-medium text-emerald-600">
                            {competitor.scores.codeQuality}%
                        </span>
                    ) : competitor.status === 'building' || competitor.status === 'verifying' ? (
                        <span className="text-xs font-mono text-amber-600">
                            {competitor.progress}%
                        </span>
                    ) : null}

                    <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <ChevronDownIcon size={16} className="text-stone-400" />
                    </motion.div>
                </div>
            </button>

            {/* Progress bar for active builds */}
            {(competitor.status === 'building' || competitor.status === 'verifying') && (
                <div className="px-3 pb-2">
                    <ProgressBar progress={competitor.progress} />
                </div>
            )}

            {/* Expanded content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3 space-y-3">
                            {/* Summary */}
                            {competitor.summary && (
                                <p className="text-xs text-stone-600 leading-relaxed">
                                    {competitor.summary}
                                </p>
                            )}

                            {/* Highlights */}
                            {competitor.highlights && competitor.highlights.length > 0 && (
                                <div className="space-y-1">
                                    {competitor.highlights.map((h, i) => (
                                        <div key={i} className="flex items-start gap-1.5">
                                            <SparklesIcon size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                            <span className="text-xs text-stone-600">{h}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Scores */}
                            {competitor.scores && Object.keys(competitor.scores).length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {competitor.scores.codeQuality && (
                                        <ScoreBadge label="Code" score={competitor.scores.codeQuality} />
                                    )}
                                    {competitor.scores.visual && (
                                        <ScoreBadge label="Visual" score={competitor.scores.visual} />
                                    )}
                                    {competitor.scores.antiSlop && (
                                        <ScoreBadge label="Anti-Slop" score={competitor.scores.antiSlop} />
                                    )}
                                    {competitor.scores.security && (
                                        <ScoreBadge label="Security" score={competitor.scores.security} />
                                    )}
                                </div>
                            )}

                            {/* Build stats */}
                            {(competitor.buildTimeMs || competitor.tokensUsed) && (
                                <div className="flex items-center gap-4 text-xs text-stone-400">
                                    {competitor.buildTimeMs && (
                                        <span>
                                            <ClockIcon size={12} className="inline mr-1" />
                                            {(competitor.buildTimeMs / 1000).toFixed(1)}s
                                        </span>
                                    )}
                                    {competitor.tokensUsed && (
                                        <span>
                                            <CodeIcon size={12} className="inline mr-1" />
                                            {competitor.tokensUsed.toLocaleString()} tokens
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Preview button */}
                            {competitor.sandboxUrl && (
                                <button
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-600 transition-colors hover:bg-white/50"
                                    style={{
                                        background: 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)',
                                    }}
                                >
                                    <EyeIcon size={12} />
                                    View Full Preview
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// =============================================================================
// JUDGE VERDICT DISPLAY
// =============================================================================

function JudgeVerdicts({ judges }: { judges: TournamentJudge[] }) {
    const completedJudges = judges.filter(j => j.status === 'voted');

    if (completedJudges.length === 0) {
        return (
            <div className="flex items-center gap-2 text-xs text-stone-400">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                    <GavelIcon size={14} />
                </motion.div>
                <span>AI Judges evaluating...</span>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-stone-600">
                <GavelIcon size={14} />
                <span>Judge Verdicts</span>
            </div>
            {completedJudges.map((judge) => (
                <div
                    key={judge.id}
                    className="px-3 py-2 rounded-lg"
                    style={{
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)',
                    }}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-stone-600">{judge.model}</span>
                        <span className="text-xs text-amber-600">
                            voted {judge.vote}
                            {judge.confidence && ` (${Math.round(judge.confidence * 100)}%)`}
                        </span>
                    </div>
                    {judge.reasoning && (
                        <p className="text-xs text-stone-500 line-clamp-2">{judge.reasoning}</p>
                    )}
                </div>
            ))}
        </div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function TournamentStreamResults({ data, onSelectWinner: _onSelectWinner }: TournamentStreamResultsProps) {
    // Note: onSelectWinner is available for future use when winner selection UI is added
    void _onSelectWinner;
    const [isExpanded, setIsExpanded] = useState(true);
    const [previewCompetitor, setPreviewCompetitor] = useState<TournamentCompetitor | null>(null);
    const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const handleCompetitorHover = useCallback((competitor: TournamentCompetitor, e: React.MouseEvent) => {
        if (competitor.sandboxUrl) {
            setPreviewCompetitor(competitor);
            setPreviewPosition({ x: e.clientX, y: e.clientY });
        }
    }, []);

    const handleCompetitorLeave = useCallback(() => {
        setPreviewCompetitor(null);
    }, []);

    const getPhaseLabel = () => {
        switch (data.phase) {
            case 'init': return 'Initializing';
            case 'building': return 'Competitors Building';
            case 'verifying': return 'Verifying Builds';
            case 'judging': return 'AI Judges Evaluating';
            case 'selecting': return 'Selecting Winner';
            case 'complete': return 'Tournament Complete';
            default: return data.phase;
        }
    };

    const elapsedTime = data.endTime
        ? ((data.endTime - data.startTime) / 1000).toFixed(1)
        : ((Date.now() - data.startTime) / 1000).toFixed(0);

    return (
        <div ref={containerRef} className="w-full">
            {/* Tournament Header - Always visible in stream */}
            <div
                className="rounded-xl overflow-hidden"
                style={{
                    background: 'linear-gradient(145deg, rgba(251,191,36,0.12) 0%, rgba(245,158,11,0.06) 100%)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08), inset 0 1px 2px rgba(255,255,255,0.9)',
                }}
            >
                {/* Header */}
                <button
                    className="w-full px-4 py-3 flex items-center gap-3 text-left"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{
                            background: 'linear-gradient(145deg, rgba(251,191,36,0.3) 0%, rgba(245,158,11,0.2) 100%)',
                        }}
                    >
                        <TrophyIcon size={16} className="text-amber-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-stone-700">Tournament Mode</span>
                            <span
                                className="px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{
                                    background: data.phase === 'complete'
                                        ? 'rgba(16, 185, 129, 0.15)'
                                        : 'rgba(251, 191, 36, 0.2)',
                                    color: data.phase === 'complete' ? '#059669' : '#b45309',
                                }}
                            >
                                {getPhaseLabel()}
                            </span>
                        </div>
                        <p className="text-xs text-stone-500 truncate">{data.featureDescription}</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-stone-400">{elapsedTime}s</span>
                        <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <ChevronDownIcon size={18} className="text-stone-400" />
                        </motion.div>
                    </div>
                </button>

                {/* Expanded content */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                            className="overflow-hidden"
                        >
                            <div className="px-4 pb-4 space-y-3">
                                {/* Competitors */}
                                <div className="space-y-2">
                                    {data.competitors.map((competitor) => (
                                        <CompetitorCard
                                            key={competitor.id}
                                            competitor={competitor}
                                            isWinner={data.winner?.competitorId === competitor.id}
                                            onHoverStart={(e) => handleCompetitorHover(competitor, e)}
                                            onHoverEnd={handleCompetitorLeave}
                                        />
                                    ))}
                                </div>

                                {/* Judge verdicts */}
                                {(data.phase === 'judging' || data.phase === 'selecting' || data.phase === 'complete') && (
                                    <JudgeVerdicts judges={data.judges} />
                                )}

                                {/* Winner announcement */}
                                {data.winner && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-3 rounded-xl text-center"
                                        style={{
                                            background: 'linear-gradient(145deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.08) 100%)',
                                            border: '1px solid rgba(16,185,129,0.3)',
                                        }}
                                    >
                                        <div className="flex items-center justify-center gap-2 mb-1">
                                            <TrophyIcon size={18} className="text-emerald-600" />
                                            <span className="text-sm font-semibold text-emerald-700">
                                                Winner: {data.winner.competitorName}
                                            </span>
                                        </div>
                                        <p className="text-xs text-emerald-600">
                                            {data.winner.voteCount}/{data.winner.totalJudges} judge votes
                                        </p>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Sandbox Preview Popup */}
            {previewCompetitor?.sandboxUrl && (
                <SandboxPreview
                    url={previewCompetitor.sandboxUrl}
                    name={previewCompetitor.name}
                    isVisible={!!previewCompetitor}
                    position={previewPosition}
                />
            )}
        </div>
    );
}

export default TournamentStreamResults;
