/**
 * Time Machine Panel
 *
 * Browse and restore checkpoints for a project.
 * Integrates with the backend time-machine service.
 *
 * B6: Time Machine UI from integration analysis
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ClockIcon,
    RefreshCwIcon,
    DownloadIcon,
    EyeIcon,
    ChevronRightIcon,
    WorkflowIcon,
    FileCodeIcon,
    DatabaseIcon,
    CheckCircleIcon,
    AlertTriangleIcon,
    Loader2Icon
} from '../ui/icons';
import { cn } from '@/lib/utils';

const accentColor = '#c8ff64';

interface Checkpoint {
    id: string;
    timestamp: Date;
    trigger: 'manual' | 'auto' | 'phase_complete' | 'error_recovery';
    label?: string;
    qualityScore?: number;
    gitCommit?: string;
    filesCount: number;
    size: number;
    description?: string;
}

interface TimeMachinePanelProps {
    projectId: string;
    onRestore?: (checkpointId: string) => void;
    className?: string;
}

export function TimeMachinePanel({
    projectId,
    onRestore,
    className
}: TimeMachinePanelProps) {
    const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [restoring, setRestoring] = useState<string | null>(null);
    const [selectedCheckpoint, setSelectedCheckpoint] = useState<string | null>(null);
    const [diffPreview, setDiffPreview] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [storageUsed, setStorageUsed] = useState(0);
    const [storageLimit, setStorageLimit] = useState(500);

    useEffect(() => {
        fetchCheckpoints();
    }, [projectId]);

    const fetchCheckpoints = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/checkpoints/${projectId}`, {
                credentials: 'include'
            });
            const data = await response.json();

            if (data.success) {
                setCheckpoints(data.checkpoints.map((cp: any) => ({
                    ...cp,
                    timestamp: new Date(cp.timestamp)
                })));
                setStorageUsed(data.storageUsedMB || 0);
                setStorageLimit(data.storageLimitMB || 500);
            } else {
                setError(data.error || 'Failed to load checkpoints');
            }
        } catch (err) {
            console.error('Failed to fetch checkpoints:', err);
            setError('Failed to load checkpoints');
            // Load demo data for UI
            setCheckpoints([
                {
                    id: 'demo-1',
                    timestamp: new Date(Date.now() - 3600000),
                    trigger: 'auto',
                    label: 'Automatic checkpoint',
                    qualityScore: 85,
                    filesCount: 24,
                    size: 1.2,
                    description: 'Auto-saved after feature completion'
                },
                {
                    id: 'demo-2',
                    timestamp: new Date(Date.now() - 7200000),
                    trigger: 'phase_complete',
                    label: 'Build Phase Complete',
                    qualityScore: 92,
                    gitCommit: 'abc1234',
                    filesCount: 22,
                    size: 1.1,
                    description: 'After parallel build phase'
                },
                {
                    id: 'demo-3',
                    timestamp: new Date(Date.now() - 10800000),
                    trigger: 'manual',
                    label: 'Before major refactor',
                    filesCount: 18,
                    size: 0.9,
                    description: 'Manual save point'
                }
            ]);
        }
        setLoading(false);
    };

    const handlePreviewDiff = async (checkpointId: string) => {
        try {
            const response = await fetch(`/api/checkpoints/${checkpointId}/diff`, {
                credentials: 'include'
            });
            const data = await response.json();
            if (data.success) {
                setDiffPreview(data.diff);
            }
        } catch (err) {
            console.error('Failed to fetch diff:', err);
        }
        setSelectedCheckpoint(checkpointId);
    };

    const handleRestore = async (checkpointId: string) => {
        if (!confirm('Are you sure you want to restore to this checkpoint? Current changes will be saved as a new checkpoint.')) {
            return;
        }

        setRestoring(checkpointId);
        setError(null);

        try {
            const response = await fetch(`/api/checkpoints/${checkpointId}/restore`, {
                method: 'POST',
                credentials: 'include'
            });
            const data = await response.json();

            if (data.success) {
                onRestore?.(checkpointId);
                fetchCheckpoints();
            } else {
                setError(data.error || 'Failed to restore checkpoint');
            }
        } catch (err) {
            console.error('Failed to restore:', err);
            setError('Failed to restore checkpoint');
        }
        setRestoring(null);
    };

    const handleDownload = async (checkpointId: string) => {
        try {
            const response = await fetch(`/api/checkpoints/${checkpointId}/download`, {
                credentials: 'include'
            });
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `checkpoint-${checkpointId}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to download:', err);
        }
    };

    const formatSize = (mb: number) => {
        if (mb < 1) return `${Math.round(mb * 1024)} KB`;
        return `${mb.toFixed(1)} MB`;
    };

    const formatTimestamp = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    };

    const getTriggerIcon = (trigger: Checkpoint['trigger']) => {
        switch (trigger) {
            case 'manual': return <ClockIcon size={16} className="text-blue-400" />;
            case 'auto': return <DatabaseIcon size={16} className="text-gray-400" />;
            case 'phase_complete': return <CheckCircleIcon size={16} className="text-emerald-400" />;
            case 'error_recovery': return <AlertTriangleIcon size={16} className="text-amber-400" />;
        }
    };

    return (
        <div className={cn('flex flex-col', className)}>
            {/* Storage Usage */}
            <div className="mb-6 p-4 bg-white/[0.02] rounded-xl border border-white/10">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <DatabaseIcon size={16} className="text-gray-400" />
                        <span className="text-sm text-gray-400">Storage Used</span>
                    </div>
                    <span className="text-sm font-medium" style={{ color: accentColor }}>
                        {formatSize(storageUsed)} / {formatSize(storageLimit)}
                    </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(storageUsed / storageLimit) * 100}%` }}
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${accentColor}80, ${accentColor})` }}
                    />
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-sm text-red-400">{error}</p>
                </div>
            )}

            {/* Checkpoints List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2Icon size={24} className="text-gray-400 animate-spin" />
                </div>
            ) : checkpoints.length === 0 ? (
                <div className="text-center py-12">
                    <ClockIcon size={48} className="text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No checkpoints yet</p>
                    <p className="text-sm text-gray-500 mt-1">Checkpoints will be created automatically as you work</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {checkpoints.map((checkpoint, index) => (
                        <motion.div
                            key={checkpoint.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={cn(
                                'p-4 rounded-xl border transition-all cursor-pointer',
                                selectedCheckpoint === checkpoint.id
                                    ? 'bg-white/[0.05] border-cyan-500/30'
                                    : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                            )}
                            onClick={() => handlePreviewDiff(checkpoint.id)}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                    {getTriggerIcon(checkpoint.trigger)}
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-white font-medium">
                                                {checkpoint.label || `Checkpoint ${index + 1}`}
                                            </span>
                                            {checkpoint.qualityScore && (
                                                <span className={cn(
                                                    'text-xs px-2 py-0.5 rounded-full',
                                                    checkpoint.qualityScore >= 80
                                                        ? 'bg-emerald-500/20 text-emerald-400'
                                                        : checkpoint.qualityScore >= 60
                                                        ? 'bg-amber-500/20 text-amber-400'
                                                        : 'bg-red-500/20 text-red-400'
                                                )}>
                                                    {checkpoint.qualityScore}%
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <ClockIcon size={12} />
                                                {formatTimestamp(checkpoint.timestamp)}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <FileCodeIcon size={12} />
                                                {checkpoint.filesCount} files
                                            </span>
                                            <span>{formatSize(checkpoint.size)}</span>
                                            {checkpoint.gitCommit && (
                                                <span className="flex items-center gap-1 font-mono">
                                                    <WorkflowIcon size={12} />
                                                    {checkpoint.gitCommit.substring(0, 7)}
                                                </span>
                                            )}
                                        </div>
                                        {checkpoint.description && (
                                            <p className="text-xs text-gray-400 mt-1">
                                                {checkpoint.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <ChevronRightIcon size={16} className={cn(
                                    'text-gray-500 transition-transform',
                                    selectedCheckpoint === checkpoint.id && 'rotate-90'
                                )} />
                            </div>

                            {/* Expanded Actions */}
                            <AnimatePresence>
                                {selectedCheckpoint === checkpoint.id && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/10">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRestore(checkpoint.id);
                                                }}
                                                disabled={restoring === checkpoint.id}
                                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                                                style={{
                                                    background: `linear-gradient(145deg, ${accentColor}cc, ${accentColor}99)`,
                                                    color: '#000',
                                                }}
                                            >
                                                {restoring === checkpoint.id ? (
                                                    <Loader2Icon size={16} className="animate-spin" />
                                                ) : (
                                                    <RefreshCwIcon size={16} />
                                                )}
                                                Restore
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDownload(checkpoint.id);
                                                }}
                                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10"
                                            >
                                                <DownloadIcon size={16} />
                                                Download
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handlePreviewDiff(checkpoint.id);
                                                }}
                                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10"
                                            >
                                                <EyeIcon size={16} />
                                                Preview Diff
                                            </button>
                                        </div>

                                        {/* Diff Preview */}
                                        {diffPreview && (
                                            <div className="mt-4 p-3 rounded-lg bg-black/30 max-h-40 overflow-auto">
                                                <pre className="text-xs font-mono text-gray-400">
                                                    {diffPreview}
                                                </pre>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default TimeMachinePanel;

