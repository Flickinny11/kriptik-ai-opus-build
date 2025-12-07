/**
 * Test Progress Viewer
 *
 * Live view of synthetic user actions during testing.
 */

import { motion } from 'framer-motion';
import {
    MousePointer2, Type, ArrowUpDown, Navigation, Clock,
    CheckCircle2, XCircle, Loader2, AlertTriangle, Camera
} from 'lucide-react';

const accentColor = '#c8ff64';

interface Action {
    id: string;
    type: string;
    target?: string;
    result: string;
    timestamp: number;
    screenshot?: string;
}

interface TestResult {
    personaId: string;
    personaName: string;
    status: 'running' | 'completed' | 'failed';
    actions: Action[];
    issuesFound: Array<{
        id: string;
        type: string;
        severity: string;
        title: string;
    }>;
    journeyScore: number;
    actionCount?: number;
    lastScreenshot?: string;
}

interface TestProgressViewerProps {
    results: TestResult[];
    maxActions: number;
}

const ACTION_ICONS: Record<string, React.ElementType> = {
    'click': MousePointer2,
    'type': Type,
    'scroll': ArrowUpDown,
    'navigate': Navigation,
    'wait': Clock,
    'hover': MousePointer2,
};

export function TestProgressViewer({ results, maxActions }: TestProgressViewerProps) {
    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {results.map(result => {
                const actionCount = result.actions?.length || result.actionCount || 0;
                const progress = Math.min((actionCount / maxActions) * 100, 100);

                return (
                    <motion.div
                        key={result.personaId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-xl bg-white/[0.03] border border-white/10"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{
                                        background: result.status === 'running'
                                            ? 'linear-gradient(145deg, #3b82f6 0%, #1d4ed8 100%)'
                                            : result.status === 'completed'
                                                ? 'linear-gradient(145deg, #10b981 0%, #059669 100%)'
                                                : 'linear-gradient(145deg, #ef4444 0%, #dc2626 100%)'
                                    }}
                                >
                                    {result.status === 'running' ? (
                                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                                    ) : result.status === 'completed' ? (
                                        <CheckCircle2 className="w-4 h-4 text-white" />
                                    ) : (
                                        <XCircle className="w-4 h-4 text-white" />
                                    )}
                                </div>
                                <div>
                                    <div className="font-medium text-white text-sm">{result.personaName}</div>
                                    <div className="text-xs text-white/40">
                                        {result.status === 'running' ? 'Testing...' : result.status}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                {/* Journey Score */}
                                <div className="text-right">
                                    <div
                                        className="text-lg font-bold"
                                        style={{
                                            color: result.journeyScore >= 80
                                                ? '#34d399'
                                                : result.journeyScore >= 60
                                                    ? '#fbbf24'
                                                    : '#f87171'
                                        }}
                                    >
                                        {result.journeyScore}
                                    </div>
                                    <div className="text-[10px] text-white/40">Score</div>
                                </div>
                                {/* Issues Badge */}
                                {result.issuesFound.length > 0 && (
                                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/20">
                                        <AlertTriangle className="w-3 h-3 text-red-400" />
                                        <span className="text-xs text-red-400">{result.issuesFound.length}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-3">
                            <div className="flex items-center justify-between text-xs text-white/40 mb-1">
                                <span>{actionCount} actions</span>
                                <span>{maxActions} max</span>
                            </div>
                            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 0.3 }}
                                    className="h-full rounded-full"
                                    style={{
                                        background: result.status === 'running'
                                            ? `linear-gradient(90deg, #3b82f6 0%, ${accentColor} 100%)`
                                            : result.status === 'completed'
                                                ? '#10b981'
                                                : '#ef4444'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Recent Actions */}
                        {result.actions && result.actions.length > 0 && (
                            <div className="space-y-2">
                                <div className="text-[10px] text-white/30 uppercase tracking-wide">Recent Actions</div>
                                <div className="space-y-1.5">
                                    {result.actions.slice(-5).map((action, index) => {
                                        const ActionIcon = ACTION_ICONS[action.type] || MousePointer2;
                                        const isLatest = index === result.actions.slice(-5).length - 1;

                                        return (
                                            <motion.div
                                                key={action.id}
                                                initial={isLatest ? { opacity: 0, x: -10 } : {}}
                                                animate={{ opacity: 1, x: 0 }}
                                                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${
                                                    isLatest ? 'bg-white/5' : ''
                                                }`}
                                            >
                                                <div
                                                    className="w-5 h-5 rounded flex items-center justify-center"
                                                    style={{
                                                        background: action.result === 'success'
                                                            ? 'rgba(16,185,129,0.2)'
                                                            : action.result === 'failed'
                                                                ? 'rgba(239,68,68,0.2)'
                                                                : 'rgba(255,255,255,0.1)'
                                                    }}
                                                >
                                                    <ActionIcon
                                                        className="w-3 h-3"
                                                        style={{
                                                            color: action.result === 'success'
                                                                ? '#34d399'
                                                                : action.result === 'failed'
                                                                    ? '#f87171'
                                                                    : '#a3a3a3'
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-xs text-white/70 capitalize flex-1 truncate">
                                                    {action.type}
                                                    {action.target && (
                                                        <span className="text-white/40"> on {action.target}</span>
                                                    )}
                                                </span>
                                                {action.screenshot && (
                                                    <Camera className="w-3 h-3 text-white/30" />
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Last Screenshot Preview */}
                        {result.lastScreenshot && (
                            <div className="mt-3 pt-3 border-t border-white/5">
                                <div className="text-[10px] text-white/30 mb-2 flex items-center gap-1">
                                    <Camera className="w-3 h-3" />
                                    Latest Screenshot
                                </div>
                                <div className="rounded-lg overflow-hidden border border-white/10">
                                    <img
                                        src={`data:image/png;base64,${result.lastScreenshot}`}
                                        alt="Test screenshot"
                                        className="w-full h-auto"
                                    />
                                </div>
                            </div>
                        )}
                    </motion.div>
                );
            })}
        </div>
    );
}

