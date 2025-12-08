/**
 * Issue Report Component
 *
 * Display discovered issues with severity and reproduction steps.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bug, AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp,
    Copy, Check, Eye, Accessibility, Gauge
} from 'lucide-react';

interface Issue {
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    location?: string;
    screenshot?: string;
    reproductionSteps?: string[];
}

interface IssueReportProps {
    issues: Issue[];
}

const SEVERITY_CONFIG: Record<string, { color: string; bgColor: string; icon: React.ComponentType<{ className?: string; color?: string }> }> = {
    'critical': { color: '#f87171', bgColor: 'rgba(239,68,68,0.15)', icon: AlertTriangle },
    'high': { color: '#fb923c', bgColor: 'rgba(251,146,60,0.15)', icon: AlertCircle },
    'medium': { color: '#fbbf24', bgColor: 'rgba(251,191,36,0.15)', icon: AlertCircle },
    'low': { color: '#a3e635', bgColor: 'rgba(163,230,53,0.15)', icon: Info },
};

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
    'error': Bug,
    'warning': AlertTriangle,
    'accessibility': Accessibility,
    'ux': Eye,
    'performance': Gauge,
};

export function IssueReport({ issues }: IssueReportProps) {
    const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Group issues by severity
    const groupedIssues = issues.reduce((acc, issue) => {
        const severity = issue.severity || 'medium';
        if (!acc[severity]) acc[severity] = [];
        acc[severity].push(issue);
        return acc;
    }, {} as Record<string, Issue[]>);

    const severityOrder = ['critical', 'high', 'medium', 'low'];

    const copyReproSteps = (issue: Issue) => {
        if (!issue.reproductionSteps) return;

        const text = `Issue: ${issue.title}\n\nReproduction Steps:\n${issue.reproductionSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
        navigator.clipboard.writeText(text);
        setCopiedId(issue.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (issues.length === 0) {
        return (
            <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-emerald-400 font-medium">No Issues Found</p>
                <p className="text-sm text-emerald-400/60 mt-1">
                    All synthetic users completed testing without discovering issues.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <Bug className="w-4 h-4 text-red-400" />
                    Issues Found ({issues.length})
                </h3>

                {/* Summary badges */}
                <div className="flex items-center gap-2">
                    {severityOrder.map(severity => {
                        const count = groupedIssues[severity]?.length || 0;
                        if (count === 0) return null;

                        const config = SEVERITY_CONFIG[severity];
                        return (
                            <span
                                key={severity}
                                className="px-2 py-0.5 rounded text-xs font-medium"
                                style={{ background: config.bgColor, color: config.color }}
                            >
                                {count} {severity}
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Issue List by Severity */}
            {severityOrder.map(severity => {
                const severityIssues = groupedIssues[severity];
                if (!severityIssues || severityIssues.length === 0) return null;

                const config = SEVERITY_CONFIG[severity];
                const SeverityIcon = config.icon;

                return (
                    <div key={severity} className="space-y-2">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide" style={{ color: config.color }}>
                            <SeverityIcon className="w-3 h-3" />
                            {severity} ({severityIssues.length})
                        </div>

                        {severityIssues.map(issue => {
                            const TypeIcon = TYPE_ICONS[issue.type] || Bug;
                            const isExpanded = expandedIssue === issue.id;

                            return (
                                <motion.div
                                    key={issue.id}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="rounded-xl overflow-hidden"
                                    style={{ background: config.bgColor, border: `1px solid ${config.color}30` }}
                                >
                                    {/* Issue Header */}
                                    <button
                                        onClick={() => setExpandedIssue(isExpanded ? null : issue.id)}
                                        className="w-full p-4 text-left flex items-center gap-3"
                                    >
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                                            style={{ background: `${config.color}30` }}
                                        >
                                            <TypeIcon className="w-4 h-4" style={{ color: config.color }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-white truncate">{issue.title}</div>
                                            {issue.location && (
                                                <div className="text-xs text-white/40 truncate font-mono">{issue.location}</div>
                                            )}
                                        </div>
                                        <span
                                            className="px-2 py-0.5 rounded text-xs capitalize"
                                            style={{ background: `${config.color}20`, color: config.color }}
                                        >
                                            {issue.type}
                                        </span>
                                        {isExpanded ? (
                                            <ChevronUp className="w-5 h-5 text-white/40" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-white/40" />
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
                                                <div className="px-4 pb-4 space-y-4">
                                                    {/* Description */}
                                                    <div className="p-3 rounded-lg bg-black/20">
                                                        <p className="text-sm text-white/70">{issue.description}</p>
                                                    </div>

                                                    {/* Reproduction Steps */}
                                                    {issue.reproductionSteps && issue.reproductionSteps.length > 0 && (
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-xs text-white/50">Reproduction Steps</span>
                                                                <button
                                                                    onClick={() => copyReproSteps(issue)}
                                                                    className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-colors"
                                                                >
                                                                    {copiedId === issue.id ? (
                                                                        <>
                                                                            <Check className="w-3 h-3" />
                                                                            Copied!
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Copy className="w-3 h-3" />
                                                                            Copy
                                                                        </>
                                                                    )}
                                                                </button>
                                                            </div>
                                                            <ol className="space-y-1">
                                                                {issue.reproductionSteps.map((step, index) => (
                                                                    <li
                                                                        key={index}
                                                                        className="text-sm text-white/60 flex items-start gap-2"
                                                                    >
                                                                        <span
                                                                            className="w-5 h-5 rounded flex items-center justify-center text-xs flex-shrink-0"
                                                                            style={{ background: `${config.color}20`, color: config.color }}
                                                                        >
                                                                            {index + 1}
                                                                        </span>
                                                                        {step}
                                                                    </li>
                                                                ))}
                                                            </ol>
                                                        </div>
                                                    )}

                                                    {/* Screenshot */}
                                                    {issue.screenshot && (
                                                        <div>
                                                            <div className="text-xs text-white/50 mb-2">Screenshot at time of issue</div>
                                                            <div className="rounded-lg overflow-hidden border border-white/10">
                                                                <img
                                                                    src={`data:image/png;base64,${issue.screenshot}`}
                                                                    alt="Issue screenshot"
                                                                    className="w-full h-auto"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}

