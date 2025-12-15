/**
 * Request Changes Modal
 *
 * When a user reviews completed agent work, they can request changes
 * with specific feedback that creates a new iteration.
 *
 * This implements the feedback loop from the Developer_View_Concept:
 * - User provides feedback on what needs to change
 * - Feedback tags for quick categorization
 * - Priority levels
 * - Option to keep or discard existing changes
 * - Feedback is stored for learning and appended to agent prompt
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CloseIcon,
    MessageSquareIcon,
    WarningIcon,
    LoadingIcon,
    RefreshIcon,
} from '../ui/icons';
import { apiClient } from '../../lib/api-client';
import '../../styles/realistic-glass.css';

// Dark glass styling
const darkGlassPanel = {
    background: 'linear-gradient(145deg, rgba(20,20,25,0.98) 0%, rgba(12,12,16,0.99) 100%)',
    backdropFilter: 'blur(40px) saturate(180%)',
    boxShadow: `
        0 30px 80px rgba(0,0,0,0.5),
        0 15px 40px rgba(0,0,0,0.4),
        inset 0 1px 0 rgba(255,255,255,0.05),
        0 0 0 1px rgba(255,255,255,0.05)
    `,
};

const accentColor = '#c8ff64';

type Priority = 'low' | 'medium' | 'high' | 'critical';

const FEEDBACK_TAGS = [
    'Animation',
    'Styling',
    'Functionality',
    'Performance',
    'Tests',
    'Documentation',
    'Security',
    'Accessibility',
    'Types',
    'Error Handling',
];

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
    { value: 'low', label: 'Low', color: '#60a5fa' },
    { value: 'medium', label: 'Medium', color: '#fbbf24' },
    { value: 'high', label: 'High', color: '#f97316' },
    { value: 'critical', label: 'Critical', color: '#ef4444' },
];

interface Agent {
    id: string;
    name: string;
    status: string;
    verificationScore?: number;
    verificationPassed?: boolean;
    buildAttempts?: number;
}

interface RequestChangesModalProps {
    isOpen: boolean;
    onClose: () => void;
    agent: Agent | null;
    onSubmit?: (agentId: string, iterationNumber: number) => void;
}

export function RequestChangesModal({
    isOpen,
    onClose,
    agent,
    onSubmit
}: RequestChangesModalProps) {
    const [feedbackContent, setFeedbackContent] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [priority, setPriority] = useState<Priority>('medium');
    const [keepChanges, setKeepChanges] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleToggleTag = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag)
                ? prev.filter(t => t !== tag)
                : [...prev, tag]
        );
    };

    const handleSubmit = async () => {
        if (!agent || !feedbackContent.trim()) {
            setError('Please provide feedback');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const response = await apiClient.post<{ iterationNumber: number }>(
                `/api/developer-settings/agents/${agent.id}/feedback`,
                {
                    feedbackContent,
                    feedbackType: 'request_changes',
                    priority,
                    tags: selectedTags,
                    keepChanges,
                }
            );

            // Reset form
            setFeedbackContent('');
            setSelectedTags([]);
            setPriority('medium');
            setKeepChanges(true);

            // Callback
            if (onSubmit) {
                onSubmit(agent.id, response.data.iterationNumber);
            }

            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to submit feedback');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen || !agent) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-xl rounded-2xl overflow-hidden"
                    style={darkGlassPanel}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div
                                className="p-2 rounded-xl"
                                style={{ background: 'rgba(249,115,22,0.15)' }}
                            >
                                <MessageSquareIcon size={20} className="text-orange-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">Request Changes</h2>
                                <p className="text-xs text-white/40">
                                    Agent: {agent.name}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                        >
                            <CloseIcon size={20} className="text-white/40" />
                        </button>
                    </div>

                    {/* Agent Status */}
                    <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02]">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-white/60">Current Status</span>
                            <div className="flex items-center gap-2">
                                {agent.verificationPassed ? (
                                    <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                                        ✓ Verification Passed
                                    </span>
                                ) : (
                                    <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400">
                                        Pending Review
                                    </span>
                                )}
                                {agent.verificationScore !== undefined && (
                                    <span className="text-xs text-white/40">
                                        Score: {agent.verificationScore}/100
                                    </span>
                                )}
                            </div>
                        </div>
                        {agent.buildAttempts && agent.buildAttempts > 0 && (
                            <div className="mt-2 text-xs text-white/40">
                                Iteration #{agent.buildAttempts + 1}
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* Error */}
                        {error && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                <WarningIcon size={16} className="text-red-400" />
                                <span className="text-sm text-red-400">{error}</span>
                            </div>
                        )}

                        {/* Feedback Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/80">
                                What needs to change?
                            </label>
                            <textarea
                                value={feedbackContent}
                                onChange={(e) => setFeedbackContent(e.target.value)}
                                placeholder="The toggle animation is too slow, make it snappier (under 200ms). Also, the icon should change from sun to moon when toggled."
                                className="w-full h-32 p-4 rounded-xl bg-white/[0.02] border border-white/10 focus:border-white/20 outline-none text-sm text-white/80 placeholder-white/30 resize-none"
                            />
                        </div>

                        {/* Quick Tags */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white/40">
                                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <circle cx="7" cy="7" r="1.5" fill="currentColor"/>
                                </svg>
                                <label className="text-sm font-medium text-white/80">
                                    Quick Feedback Tags
                                </label>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {FEEDBACK_TAGS.map((tag) => (
                                    <button
                                        key={tag}
                                        onClick={() => handleToggleTag(tag)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                            selectedTags.includes(tag)
                                                ? 'text-black'
                                                : 'text-white/60 border border-white/10 hover:border-white/20'
                                        }`}
                                        style={selectedTags.includes(tag) ? {
                                            background: accentColor,
                                        } : {}}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Priority */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white/40">
                                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                                <label className="text-sm font-medium text-white/80">
                                    Priority
                                </label>
                            </div>
                            <div className="flex gap-2">
                                {PRIORITY_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => setPriority(option.value)}
                                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all border ${
                                            priority === option.value
                                                ? 'border-transparent'
                                                : 'border-white/10 text-white/60 hover:border-white/20'
                                        }`}
                                        style={priority === option.value ? {
                                            background: `${option.color}20`,
                                            color: option.color,
                                            borderColor: option.color,
                                        } : {}}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Options */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/80">Options</label>
                            <div className="space-y-2">
                                <button
                                    onClick={() => setKeepChanges(true)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                                        keepChanges
                                            ? 'border-2'
                                            : 'border-white/10 hover:border-white/20'
                                    }`}
                                    style={keepChanges ? {
                                        borderColor: accentColor,
                                        background: `${accentColor}10`,
                                    } : {}}
                                >
                                    <div
                                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                            keepChanges ? 'border-transparent' : 'border-white/30'
                                        }`}
                                        style={keepChanges ? { background: accentColor } : {}}
                                    >
                                        {keepChanges && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                                    </div>
                                    <div>
                                        <div className="text-sm text-white/80">Keep existing changes, add improvements</div>
                                        <div className="text-xs text-white/40">Agent will iterate on current work</div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setKeepChanges(false)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                                        !keepChanges
                                            ? 'border-2'
                                            : 'border-white/10 hover:border-white/20'
                                    }`}
                                    style={!keepChanges ? {
                                        borderColor: accentColor,
                                        background: `${accentColor}10`,
                                    } : {}}
                                >
                                    <div
                                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                            !keepChanges ? 'border-transparent' : 'border-white/30'
                                        }`}
                                        style={!keepChanges ? { background: accentColor } : {}}
                                    >
                                        {!keepChanges && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                                    </div>
                                    <div>
                                        <div className="text-sm text-white/80">Start fresh with new approach</div>
                                        <div className="text-xs text-white/40">Agent will discard changes and try again</div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Estimated Cost */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
                            <span className="text-sm text-white/60">Estimated additional cost</span>
                            <span className="text-sm font-medium" style={{ color: accentColor }}>
                                ~$0.15
                            </span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between p-6 border-t border-white/5">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white/80 hover:bg-white/5 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || !feedbackContent.trim()}
                            className="flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
                            style={{
                                background: `linear-gradient(145deg, #f97316 0%, #ea580c 100%)`,
                                color: '#fff',
                            }}
                        >
                            {submitting ? (
                                <LoadingIcon size={16} className="animate-spin" />
                            ) : (
                                <RefreshIcon size={16} />
                            )}
                            Submit Feedback & Iterate
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

