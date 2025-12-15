/**
 * Tournament Panel - Competition UI for Tournament Mode
 *
 * Displays:
 * - Real-time competitor progress
 * - AI judge verdicts
 * - Winner selection
 * - Vote tallies
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TrophyIcon,
    UsersIcon,
    GavelIcon,
    ClockIcon,
    LoadingIcon,
    XIcon,
    CheckIcon,
    WarningIcon
} from '../../components/ui/icons';
import { apiClient } from '../../lib/api-client';

interface Competitor {
    id: string;
    name: string;
    status: 'pending' | 'building' | 'verifying' | 'complete' | 'failed';
    scores?: {
        codeQuality?: number;
        visual?: number;
        antiSlop?: number;
        security?: number;
        creativity?: number;
        efficiency?: number;
    };
    buildTimeMs?: number;
    tokensUsed?: number;
    logs?: string[];
}

interface JudgeVerdict {
    judgeId: string;
    winnerId: string;
    reasoning: string;
    confidence?: number;
}

interface TournamentStatus {
    tournamentId: string;
    status: 'pending' | 'running' | 'judging' | 'complete' | 'cancelled';
    phase: 'init' | 'building' | 'judging' | 'selecting' | 'complete';
    competitors: Competitor[];
    winner: { id: string; name: string; scores: Record<string, number> } | null;
    startTime: string;
    endTime?: string;
}

interface TournamentPanelProps {
    tournamentId: string | null;
    isVisible: boolean;
    onClose: () => void;
    onSelectWinner: (files: Record<string, string>) => void;
    featureDescription?: string;
}

// Liquid Glass Button
function GlassButton({
    children,
    onClick,
    variant = 'default',
    disabled = false,
    className = '',
}: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: 'default' | 'primary' | 'outline';
    disabled?: boolean;
    className?: string;
}) {
    const [isHovered, setIsHovered] = useState(false);

    const getVariantStyles = () => {
        if (variant === 'primary') {
            return {
                background: isHovered
                    ? 'linear-gradient(145deg, rgba(255,200,170,0.8) 0%, rgba(255,180,150,0.6) 100%)'
                    : 'linear-gradient(145deg, rgba(255,200,170,0.6) 0%, rgba(255,180,150,0.4) 100%)',
                color: '#92400e',
            };
        }
        if (variant === 'outline') {
            return {
                background: 'transparent',
                border: '1px solid rgba(0,0,0,0.1)',
                color: '#1a1a1a',
            };
        }
        return {
            background: isHovered
                ? 'linear-gradient(145deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.5) 100%)'
                : 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)',
            color: '#1a1a1a',
        };
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`flex items-center justify-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${className}`}
            style={{
                ...getVariantStyles(),
                backdropFilter: 'blur(16px)',
                boxShadow: isHovered
                    ? '0 6px 20px rgba(0,0,0,0.1), inset 0 1px 2px rgba(255,255,255,0.9)'
                    : '0 2px 8px rgba(0,0,0,0.05), inset 0 1px 2px rgba(255,255,255,0.8)',
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
            }}
        >
            {children}
        </button>
    );
}

// Progress badge styles
function StatusBadge({ status }: { status: Competitor['status'] }) {
    const getStyles = () => {
        switch (status) {
            case 'complete':
                return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
            case 'failed':
                return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
            case 'building':
            case 'verifying':
                return { bg: 'rgba(251, 191, 36, 0.15)', color: '#f59e0b', border: 'rgba(251, 191, 36, 0.3)' };
            default:
                return { bg: 'rgba(107, 114, 128, 0.15)', color: '#6b7280', border: 'rgba(107, 114, 128, 0.3)' };
        }
    };

    const styles = getStyles();

    return (
        <span
            className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1"
            style={{ background: styles.bg, color: styles.color, border: `1px solid ${styles.border}` }}
        >
            {(status === 'building' || status === 'verifying') && (
                <LoadingIcon size={12} className="animate-spin" />
            )}
            {status}
        </span>
    );
}

export default function TournamentPanel({
    tournamentId,
    isVisible,
    onClose,
    onSelectWinner,
}: TournamentPanelProps) {
    const [status, setStatus] = useState<TournamentStatus | null>(null);
    const [verdicts, setVerdicts] = useState<JudgeVerdict[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Poll for status updates
    useEffect(() => {
        if (!tournamentId || !isVisible) return;

        const pollStatus = async () => {
            try {
                const { data: statusData } = await apiClient.get<TournamentStatus>(`/api/tournament/${tournamentId}/status`);
                setStatus(statusData);

                if (statusData.status === 'complete' || statusData.phase === 'judging') {
                    const { data: verdictsData } = await apiClient.get<{ verdicts: JudgeVerdict[] }>(`/api/tournament/${tournamentId}/verdicts`);
                    setVerdicts(verdictsData.verdicts || []);
                }
            } catch (err) {
                console.error('Failed to fetch tournament status:', err);
            }
        };

        pollStatus();
        const interval = setInterval(pollStatus, 2000);
        return () => clearInterval(interval);
    }, [tournamentId, isVisible]);

    const handleMergeWinner = useCallback(async () => {
        if (!tournamentId || !status?.winner) return;
        setIsLoading(true);
        setError(null);
        try {
            const { data: filesData } = await apiClient.get<{ files: Record<string, string> }>(`/api/tournament/${tournamentId}/winner/files`);
            onSelectWinner(filesData.files);
            onClose();
        } catch (err) {
            setError('Failed to get winner files');
        } finally {
            setIsLoading(false);
        }
    }, [tournamentId, status?.winner, onSelectWinner, onClose]);

    const handleStopTournament = useCallback(async () => {
        if (!tournamentId) return;
        try {
            await apiClient.post(`/api/tournament/${tournamentId}/stop`, {});
            onClose();
        } catch (err) {
            setError('Failed to stop tournament');
        }
    }, [tournamentId, onClose]);

    if (!isVisible) return null;

    const phaseProgress: Record<string, number> = {
        init: 10,
        building: 40,
        judging: 70,
        selecting: 90,
        complete: 100,
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
            >
                <motion.div
                    initial={{ scale: 0.95, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95, y: 20 }}
                    className="w-full max-w-5xl max-h-[90vh] overflow-auto rounded-2xl"
                    style={{
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(248,248,250,0.95) 100%)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.9)',
                    }}
                >
                    {/* Header */}
                    <div
                        className="sticky top-0 z-10 flex items-center justify-between p-6"
                        style={{
                            background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,248,250,0.98) 100%)',
                            borderBottom: '1px solid rgba(0,0,0,0.06)',
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className="p-2 rounded-xl"
                                style={{ background: 'rgba(251, 191, 36, 0.2)' }}
                            >
                                <TrophyIcon size={24} style={{ color: '#f59e0b' }} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>
                                    Tournament Mode
                                </h2>
                                <p className="text-sm" style={{ color: '#666' }}>
                                    {status?.phase === 'complete'
                                        ? 'Winner Selected!'
                                        : status?.phase === 'judging'
                                        ? 'AI Judges Deliberating...'
                                        : status?.phase === 'building'
                                        ? 'Competitors Building...'
                                        : 'Initializing...'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {status?.status !== 'complete' && (
                                <GlassButton variant="outline" onClick={handleStopTournament}>
                                    Stop Tournament
                                </GlassButton>
                            )}
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-black/5 transition-colors"
                            >
                                <XIcon size={20} style={{ color: '#666' }} />
                            </button>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                        <div className="flex items-center justify-between mb-2 text-sm">
                            <span style={{ color: '#666' }}>Tournament Progress</span>
                            <span className="font-medium" style={{ color: '#1a1a1a' }}>
                                {status?.phase || 'init'}
                            </span>
                        </div>
                        <div
                            className="h-2 rounded-full overflow-hidden"
                            style={{ background: 'rgba(0,0,0,0.06)' }}
                        >
                            <motion.div
                                className="h-full rounded-full"
                                style={{ background: 'linear-gradient(90deg, #f59e0b, #f97316)' }}
                                initial={{ width: 0 }}
                                animate={{ width: `${phaseProgress[status?.phase || 'init']}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                        <div className="flex justify-between mt-2 text-xs" style={{ color: '#999' }}>
                            <span>Init</span>
                            <span>Building</span>
                            <span>Judging</span>
                            <span>Complete</span>
                        </div>
                    </div>

                    {/* Competitors Grid */}
                    <div className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <UsersIcon size={20} style={{ color: '#666' }} />
                            <h3 className="font-semibold" style={{ color: '#1a1a1a' }}>
                                Competitors ({status?.competitors?.length || 0})
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {status?.competitors?.map((competitor) => (
                                <div
                                    key={competitor.id}
                                    className="p-4 rounded-xl transition-all"
                                    style={{
                                        background:
                                            status.winner?.id === competitor.id
                                                ? 'linear-gradient(145deg, rgba(251, 191, 36, 0.1) 0%, rgba(249, 115, 22, 0.05) 100%)'
                                                : 'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.4) 100%)',
                                        border:
                                            status.winner?.id === competitor.id
                                                ? '2px solid rgba(251, 191, 36, 0.5)'
                                                : '1px solid rgba(0,0,0,0.06)',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                                    }}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="font-semibold" style={{ color: '#1a1a1a' }}>
                                            {competitor.name}
                                        </span>
                                        <StatusBadge status={competitor.status} />
                                    </div>

                                    {competitor.scores && (
                                        <div className="space-y-2 text-sm">
                                            {Object.entries(competitor.scores).map(([key, value]) => (
                                                <div key={key} className="flex justify-between">
                                                    <span style={{ color: '#666' }} className="capitalize">
                                                        {key.replace(/([A-Z])/g, ' $1').trim()}
                                                    </span>
                                                    <span
                                                        style={{
                                                            color:
                                                                value >= 80
                                                                    ? '#10b981'
                                                                    : value >= 60
                                                                    ? '#f59e0b'
                                                                    : '#ef4444',
                                                        }}
                                                    >
                                                        {value}%
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {competitor.buildTimeMs && (
                                        <div
                                            className="flex items-center gap-1 mt-3 text-xs"
                                            style={{ color: '#999' }}
                                        >
                                            <ClockIcon size={12} />
                                            {(competitor.buildTimeMs / 1000).toFixed(1)}s
                                        </div>
                                    )}

                                    {status.winner?.id === competitor.id && (
                                        <div
                                            className="flex items-center gap-2 mt-3"
                                            style={{ color: '#f59e0b' }}
                                        >
                                            <TrophyIcon size={16} />
                                            <span className="text-sm font-medium">Winner!</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Judge Verdicts */}
                    {verdicts.length > 0 && (
                        <div className="p-6" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                            <div className="flex items-center gap-2 mb-4">
                                <GavelIcon size={20} style={{ color: '#666' }} />
                                <h3 className="font-semibold" style={{ color: '#1a1a1a' }}>
                                    Judge Verdicts ({verdicts.length})
                                </h3>
                            </div>

                            <div className="space-y-3">
                                {verdicts.map((verdict, idx) => (
                                    <div
                                        key={idx}
                                        className="p-4 rounded-xl"
                                        style={{
                                            background:
                                                'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.4) 100%)',
                                            border: '1px solid rgba(0,0,0,0.06)',
                                        }}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-medium" style={{ color: '#1a1a1a' }}>
                                                        Judge #{idx + 1}
                                                    </span>
                                                    <span
                                                        className="px-2 py-0.5 rounded text-xs"
                                                        style={{
                                                            background: 'rgba(0,0,0,0.05)',
                                                            color: '#666',
                                                        }}
                                                    >
                                                        {status?.competitors?.find((c) => c.id === verdict.winnerId)
                                                            ?.name || verdict.winnerId}
                                                    </span>
                                                </div>
                                                <p className="text-sm" style={{ color: '#666' }}>
                                                    {verdict.reasoning}
                                                </p>
                                            </div>
                                            {verdict.confidence && (
                                                <span className="text-sm" style={{ color: '#999' }}>
                                                    {Math.round(verdict.confidence * 100)}% confident
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Vote Tally */}
                            <div
                                className="mt-4 p-4 rounded-xl"
                                style={{ background: 'rgba(0,0,0,0.03)' }}
                            >
                                <h4 className="text-sm font-medium mb-2" style={{ color: '#1a1a1a' }}>
                                    Vote Tally
                                </h4>
                                {status?.competitors?.map((competitor) => {
                                    const votes = verdicts.filter((v) => v.winnerId === competitor.id).length;
                                    const percentage = (votes / verdicts.length) * 100;
                                    return (
                                        <div key={competitor.id} className="flex items-center gap-3 mb-2">
                                            <span className="w-20 text-sm" style={{ color: '#666' }}>
                                                {competitor.name}
                                            </span>
                                            <div
                                                className="flex-1 h-2 rounded-full overflow-hidden"
                                                style={{ background: 'rgba(0,0,0,0.06)' }}
                                            >
                                                <motion.div
                                                    className="h-full"
                                                    style={{ background: '#f59e0b' }}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${percentage}%` }}
                                                    transition={{ duration: 0.3 }}
                                                />
                                            </div>
                                            <span className="text-sm w-16" style={{ color: '#999' }}>
                                                {votes}/{verdicts.length} votes
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Winner Actions */}
                    {status?.winner && status.status === 'complete' && (
                        <div
                            className="p-6"
                            style={{
                                background: 'linear-gradient(145deg, rgba(251, 191, 36, 0.1) 0%, rgba(249, 115, 22, 0.05) 100%)',
                                borderTop: '1px solid rgba(251, 191, 36, 0.2)',
                            }}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <TrophyIcon size={32} style={{ color: '#f59e0b' }} />
                                    <div>
                                        <h3 className="font-bold text-lg" style={{ color: '#1a1a1a' }}>
                                            {status.winner.name} Wins!
                                        </h3>
                                        <p className="text-sm" style={{ color: '#666' }}>
                                            Ready to merge winning implementation
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <GlassButton variant="outline" onClick={onClose}>
                                        Discard
                                    </GlassButton>
                                    <GlassButton
                                        variant="primary"
                                        onClick={handleMergeWinner}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <LoadingIcon size={16} className="mr-2 animate-spin" />
                                        ) : (
                                            <CheckIcon size={16} className="mr-2" />
                                        )}
                                        Merge Winner
                                    </GlassButton>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div
                            className="p-4 m-6 rounded-xl"
                            style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                            }}
                        >
                            <div className="flex items-center gap-2" style={{ color: '#ef4444' }}>
                                <WarningIcon size={16} />
                                <span>{error}</span>
                            </div>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

