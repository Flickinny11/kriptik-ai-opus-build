/**
 * ImplementationPlanApproval Component
 *
 * Displays the Deep Intent Contract and implementation plan for user approval before building.
 * Shows:
 * - App Soul (the core purpose)
 * - App Type (web app, mobile, etc.)
 * - Success Criteria (list of requirements)
 * - Functional Checklist (features to build)
 * - Integration Requirements (APIs, services)
 * - Estimated Complexity
 *
 * Premium liquid glass styling following KripTik design standards.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircleIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    SparklesIcon,
    LockIcon,
    AlertCircleIcon,
    CodeIcon,
    DatabaseIcon,
    ShieldIcon,
    ServerIcon,
    ZapIcon,
    SettingsIcon,
} from '../ui/icons';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { API_URL } from '@/lib/api-config';

// Deep Intent Contract interface - represents the Sacred Contract
export interface DeepIntentContract {
    appSoul: string;
    appType: string;
    coreValueProp: string;
    successCriteria: SuccessCriterion[];
    functionalChecklist: FunctionalChecklistItem[];
    integrationRequirements: IntegrationRequirement[];
    visualIdentity: VisualIdentity;
    estimatedComplexity: EstimatedComplexity;
    locked: boolean;
    lockedAt?: string;
}

export interface SuccessCriterion {
    id: string;
    description: string;
    category: 'functional' | 'visual' | 'performance' | 'security' | 'accessibility';
    priority: 'critical' | 'high' | 'medium' | 'low';
    verified?: boolean;
}

export interface FunctionalChecklistItem {
    id: string;
    feature: string;
    description: string;
    complexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'critical';
    dependencies: string[];
    estimatedTokens: number;
}

export interface IntegrationRequirement {
    id: string;
    service: string;
    purpose: string;
    envVariables: string[];
    required: boolean;
    documentation?: string;
}

export interface VisualIdentity {
    soul: string;
    emotion: string;
    depth: string;
    motion: string;
}

export interface EstimatedComplexity {
    overall: 'simple' | 'moderate' | 'complex' | 'enterprise';
    frontendComplexity: number;
    backendComplexity: number;
    integrationComplexity: number;
    estimatedHours: number;
    estimatedTokens: number;
    estimatedCostUSD: number;
    parallelAgentsRecommended: number;
}

// Implementation phases from the build plan
export interface ImplementationPhase {
    id: string;
    title: string;
    description: string;
    icon: string;
    type: 'frontend' | 'backend' | 'integration' | 'testing';
    steps: PhaseStep[];
    order: number;
    approved: boolean;
}

export interface PhaseStep {
    id: string;
    description: string;
    type: string;
    estimatedTokens: number;
}

export interface ImplementationPlanData {
    intentSummary: string;
    phases: ImplementationPhase[];
    estimatedTokenUsage: number;
    estimatedCostUSD: number;
    parallelAgentsNeeded: number;
}

export interface ImplementationPlanApprovalProps {
    contract: DeepIntentContract;
    plan: ImplementationPlanData;
    sessionId: string;
    onApprove: (plan: ImplementationPlanData) => void;
    onReject: (feedback: string) => void;
    onCancel: () => void;
}

// App Soul type descriptions and styles
const APP_SOUL_INFO: Record<string, { description: string; gradient: string; icon: React.ReactNode }> = {
    immersive_media: {
        description: 'Rich visual experiences, entertainment, creative content',
        gradient: 'from-purple-500/20 to-pink-500/20',
        icon: <SparklesIcon size={18} />,
    },
    professional: {
        description: 'Business tools, productivity, enterprise solutions',
        gradient: 'from-blue-500/20 to-cyan-500/20',
        icon: <SettingsIcon size={18} />,
    },
    developer: {
        description: 'Technical tools, APIs, infrastructure, code platforms',
        gradient: 'from-emerald-500/20 to-teal-500/20',
        icon: <CodeIcon size={18} />,
    },
    creative: {
        description: 'Design tools, artistic platforms, creative workflows',
        gradient: 'from-amber-500/20 to-orange-500/20',
        icon: <SparklesIcon size={18} />,
    },
    social: {
        description: 'Community platforms, communication, networking',
        gradient: 'from-rose-500/20 to-red-500/20',
        icon: <SparklesIcon size={18} />,
    },
    ecommerce: {
        description: 'Shopping, marketplaces, transactions, commerce',
        gradient: 'from-green-500/20 to-emerald-500/20',
        icon: <ShieldIcon size={18} />,
    },
    utility: {
        description: 'Practical tools, calculators, converters, helpers',
        gradient: 'from-slate-500/20 to-gray-500/20',
        icon: <SettingsIcon size={18} />,
    },
    gaming: {
        description: 'Games, interactive experiences, gamification',
        gradient: 'from-violet-500/20 to-indigo-500/20',
        icon: <ZapIcon size={18} />,
    },
};

// Complexity color mapping
const COMPLEXITY_COLORS: Record<string, string> = {
    simple: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    moderate: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    complex: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    enterprise: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
};

// Priority color mapping
const PRIORITY_COLORS: Record<string, string> = {
    critical: 'text-rose-400 bg-rose-500/10',
    high: 'text-orange-400 bg-orange-500/10',
    medium: 'text-amber-400 bg-amber-500/10',
    low: 'text-slate-400 bg-slate-500/10',
};

// Icon mapping for phase types - exported for external use
export const PHASE_ICONS: Record<string, React.ReactNode> = {
    'Code': <CodeIcon size={18} />,
    'Database': <DatabaseIcon size={18} />,
    'Shield': <ShieldIcon size={18} />,
    'Server': <ServerIcon size={18} />,
    'Zap': <ZapIcon size={18} />,
    'Settings': <SettingsIcon size={18} />,
};

// Collapsible Section Component
function CollapsibleSection({
    title,
    icon,
    count,
    expanded,
    onToggle,
    children,
    badge,
}: {
    title: string;
    icon: React.ReactNode;
    count?: number;
    expanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    badge?: React.ReactNode;
}) {
    return (
        <div
            className="rounded-xl overflow-hidden"
            style={{
                background: 'linear-gradient(145deg, rgba(30, 30, 35, 0.6) 0%, rgba(20, 20, 25, 0.8) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
        >
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{
                            background: 'linear-gradient(145deg, rgba(245, 168, 108, 0.2) 0%, rgba(194, 90, 0, 0.1) 100%)',
                            border: '1px solid rgba(245, 168, 108, 0.3)',
                        }}
                    >
                        {icon}
                    </div>
                    <span className="text-white/90 text-sm font-medium">{title}</span>
                    {count !== undefined && (
                        <span className="text-white/40 text-xs">({count})</span>
                    )}
                    {badge}
                </div>
                {expanded ? (
                    <ChevronUpIcon size={18} className="text-white/40" />
                ) : (
                    <ChevronDownIcon size={18} className="text-white/40" />
                )}
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 pt-1">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Feedback Modal for rejection
function FeedbackModal({
    open,
    onClose,
    onSubmit,
}: {
    open: boolean;
    onClose: () => void;
    onSubmit: (feedback: string) => void;
}) {
    const [feedback, setFeedback] = useState('');

    const handleSubmit = () => {
        if (feedback.trim()) {
            onSubmit(feedback.trim());
            setFeedback('');
            onClose();
        }
    };

    if (!open) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{
                background: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(8px)',
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="w-full max-w-md rounded-2xl overflow-hidden"
                style={{
                    background: 'linear-gradient(145deg, rgba(30, 30, 35, 0.98) 0%, rgba(20, 20, 25, 0.99) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
                }}
            >
                <div className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Request Changes</h3>
                    <p className="text-sm text-white/60 mb-4">
                        Describe what you would like changed in the implementation plan.
                        The AI will regenerate the plan based on your feedback.
                    </p>
                    <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Describe your changes..."
                        className={cn(
                            "w-full p-3 rounded-xl resize-none h-32",
                            "bg-slate-800/50 border border-slate-700",
                            "text-white placeholder:text-slate-500",
                            "focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        )}
                    />
                    <div className="flex justify-end gap-3 mt-4">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            className="text-slate-400 hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!feedback.trim()}
                            className={cn(
                                "px-6 rounded-xl font-semibold",
                                "bg-gradient-to-r from-amber-500 to-orange-500",
                                "hover:from-amber-400 hover:to-orange-400",
                                "text-black shadow-lg shadow-amber-500/25",
                                "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                        >
                            Submit Changes
                        </Button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

// Main ImplementationPlanApproval Component
export function ImplementationPlanApproval({
    contract,
    plan,
    sessionId,
    onApprove,
    onReject,
    onCancel,
}: ImplementationPlanApprovalProps) {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set(['criteria', 'checklist', 'integrations'])
    );
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [isApproving, setIsApproving] = useState(false);

    const toggleSection = (section: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(section)) {
                next.delete(section);
            } else {
                next.add(section);
            }
            return next;
        });
    };

    // Get soul info with fallback
    const soulInfo = APP_SOUL_INFO[contract.appSoul] || APP_SOUL_INFO.utility;

    // Handle approval with server communication
    const handleApprove = useCallback(async () => {
        setIsApproving(true);
        try {
            // Send approval to server
            const response = await fetch(`${API_URL}/api/execute/plan/${sessionId}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    approved: true,
                    planData: plan,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to approve plan');
            }

            onApprove(plan);
        } catch (error) {
            console.error('[ImplementationPlanApproval] Approval failed:', error);
            setIsApproving(false);
        }
    }, [sessionId, plan, onApprove]);

    // Handle rejection with feedback
    const handleReject = useCallback(async (feedback: string) => {
        try {
            // Send rejection to server
            const response = await fetch(`${API_URL}/api/execute/plan/${sessionId}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    feedback,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to submit feedback');
            }

            onReject(feedback);
        } catch (error) {
            console.error('[ImplementationPlanApproval] Rejection failed:', error);
        }
    }, [sessionId, onReject]);

    // Format locked timestamp
    const lockedTimeDisplay = contract.lockedAt
        ? new Date(contract.lockedAt).toLocaleString()
        : 'Just now';

    return (
        <div className="space-y-4">
            {/* Header with Lock Status */}
            <div
                className="flex items-center justify-between p-4 rounded-xl"
                style={{
                    background: `linear-gradient(135deg, ${soulInfo.gradient.split(' ')[0].replace('from-', 'rgba(').replace('/20', ', 0.1)')} 0%, rgba(30, 30, 35, 0.9) 100%)`,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{
                            background: contract.locked
                                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(5, 150, 105, 0.2) 100%)'
                                : 'linear-gradient(135deg, rgba(245, 168, 108, 0.3) 0%, rgba(194, 90, 0, 0.2) 100%)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                        }}
                    >
                        <LockIcon
                            size={24}
                            className={contract.locked ? 'text-emerald-400' : 'text-amber-400'}
                        />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Implementation Plan</h2>
                        <p className="text-sm text-white/50">
                            {contract.locked ? `Locked ${lockedTimeDisplay}` : 'Review and approve'}
                        </p>
                    </div>
                </div>

                {/* Complexity Badge */}
                <div
                    className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium border",
                        COMPLEXITY_COLORS[contract.estimatedComplexity.overall]
                    )}
                >
                    {contract.estimatedComplexity.overall.charAt(0).toUpperCase() + contract.estimatedComplexity.overall.slice(1)} Project
                </div>
            </div>

            {/* App Soul Section */}
            <div
                className={cn(
                    "p-4 rounded-xl",
                    `bg-gradient-to-r ${soulInfo.gradient}`
                )}
                style={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}
            >
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/80">
                        {soulInfo.icon}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white/90 capitalize">
                                {contract.appSoul.replace('_', ' ')} Application
                            </span>
                            <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-white/70">
                                {contract.appType}
                            </span>
                        </div>
                        <p className="text-sm text-white/70">{contract.coreValueProp}</p>
                        <p className="text-xs text-white/50 mt-1">{soulInfo.description}</p>
                    </div>
                </div>
            </div>

            {/* Success Criteria Section */}
            <CollapsibleSection
                title="Success Criteria"
                icon={<CheckCircleIcon size={18} className="text-amber-400" />}
                count={contract.successCriteria.length}
                expanded={expandedSections.has('criteria')}
                onToggle={() => toggleSection('criteria')}
            >
                <div className="space-y-2">
                    {contract.successCriteria.map((criterion, index) => (
                        <div
                            key={criterion.id || index}
                            className="flex items-start gap-3 p-3 rounded-lg"
                            style={{
                                background: criterion.verified
                                    ? 'rgba(16, 185, 129, 0.1)'
                                    : 'rgba(255, 255, 255, 0.03)',
                            }}
                        >
                            <div
                                className={cn(
                                    "mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                                    criterion.verified ? 'bg-emerald-500/30' : 'bg-white/10'
                                )}
                            >
                                {criterion.verified ? (
                                    <CheckCircleIcon size={14} className="text-emerald-400" />
                                ) : (
                                    <span className="text-white/40 text-xs">{index + 1}</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-white/80">{criterion.description}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={cn(
                                        "px-2 py-0.5 text-xs rounded-full",
                                        PRIORITY_COLORS[criterion.priority]
                                    )}>
                                        {criterion.priority}
                                    </span>
                                    <span className="text-xs text-white/40">{criterion.category}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CollapsibleSection>

            {/* Functional Checklist Section */}
            <CollapsibleSection
                title="Features to Build"
                icon={<CodeIcon size={18} className="text-amber-400" />}
                count={contract.functionalChecklist.length}
                expanded={expandedSections.has('checklist')}
                onToggle={() => toggleSection('checklist')}
                badge={
                    <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-400">
                        ~{Math.round(contract.estimatedComplexity.estimatedTokens / 1000)}k tokens
                    </span>
                }
            >
                <div className="space-y-2">
                    {contract.functionalChecklist.map((item) => (
                        <div
                            key={item.id}
                            className="p-3 rounded-lg"
                            style={{ background: 'rgba(255, 255, 255, 0.03)' }}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white/90">{item.feature}</p>
                                    <p className="text-xs text-white/60 mt-0.5">{item.description}</p>
                                </div>
                                <span className={cn(
                                    "px-2 py-0.5 text-xs rounded-full shrink-0",
                                    item.complexity === 'trivial' ? 'text-emerald-400 bg-emerald-500/10' :
                                    item.complexity === 'simple' ? 'text-green-400 bg-green-500/10' :
                                    item.complexity === 'moderate' ? 'text-amber-400 bg-amber-500/10' :
                                    item.complexity === 'complex' ? 'text-orange-400 bg-orange-500/10' :
                                    'text-rose-400 bg-rose-500/10'
                                )}>
                                    {item.complexity}
                                </span>
                            </div>
                            {item.dependencies.length > 0 && (
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs text-white/40">Depends on:</span>
                                    {item.dependencies.map((dep, i) => (
                                        <span
                                            key={i}
                                            className="px-2 py-0.5 text-xs rounded bg-white/5 text-white/50"
                                        >
                                            {dep}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </CollapsibleSection>

            {/* Integration Requirements Section */}
            <CollapsibleSection
                title="Integration Requirements"
                icon={<ServerIcon size={18} className="text-amber-400" />}
                count={contract.integrationRequirements.length}
                expanded={expandedSections.has('integrations')}
                onToggle={() => toggleSection('integrations')}
            >
                <div className="space-y-2">
                    {contract.integrationRequirements.length === 0 ? (
                        <p className="text-sm text-white/50 text-center py-4">
                            No external integrations required
                        </p>
                    ) : (
                        contract.integrationRequirements.map((integration) => (
                            <div
                                key={integration.id}
                                className="p-3 rounded-lg"
                                style={{ background: 'rgba(255, 255, 255, 0.03)' }}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-white/90">{integration.service}</p>
                                            {integration.required && (
                                                <span className="px-2 py-0.5 text-xs rounded-full bg-rose-500/20 text-rose-400">
                                                    Required
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-white/60 mt-0.5">{integration.purpose}</p>
                                    </div>
                                </div>
                                {integration.envVariables.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                        <span className="text-xs text-white/40">ENV:</span>
                                        {integration.envVariables.map((env, i) => (
                                            <code
                                                key={i}
                                                className="px-2 py-0.5 text-xs rounded bg-slate-800 text-amber-400 font-mono"
                                            >
                                                {env}
                                            </code>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </CollapsibleSection>

            {/* Visual Identity Section */}
            <CollapsibleSection
                title="Visual Identity"
                icon={<SparklesIcon size={18} className="text-amber-400" />}
                expanded={expandedSections.has('visual')}
                onToggle={() => toggleSection('visual')}
            >
                <div className="grid grid-cols-2 gap-3">
                    <div
                        className="p-3 rounded-lg"
                        style={{ background: 'rgba(255, 255, 255, 0.03)' }}
                    >
                        <p className="text-xs text-white/40 mb-1">Soul</p>
                        <p className="text-sm text-white/90 capitalize">{contract.visualIdentity.soul}</p>
                    </div>
                    <div
                        className="p-3 rounded-lg"
                        style={{ background: 'rgba(255, 255, 255, 0.03)' }}
                    >
                        <p className="text-xs text-white/40 mb-1">Emotion</p>
                        <p className="text-sm text-white/90 capitalize">{contract.visualIdentity.emotion}</p>
                    </div>
                    <div
                        className="p-3 rounded-lg"
                        style={{ background: 'rgba(255, 255, 255, 0.03)' }}
                    >
                        <p className="text-xs text-white/40 mb-1">Depth</p>
                        <p className="text-sm text-white/90 capitalize">{contract.visualIdentity.depth}</p>
                    </div>
                    <div
                        className="p-3 rounded-lg"
                        style={{ background: 'rgba(255, 255, 255, 0.03)' }}
                    >
                        <p className="text-xs text-white/40 mb-1">Motion</p>
                        <p className="text-sm text-white/90 capitalize">{contract.visualIdentity.motion}</p>
                    </div>
                </div>
            </CollapsibleSection>

            {/* Estimated Complexity Summary */}
            <div
                className="p-4 rounded-xl"
                style={{
                    background: 'linear-gradient(145deg, rgba(30, 30, 35, 0.8) 0%, rgba(20, 20, 25, 0.9) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
            >
                <div className="flex items-center gap-2 mb-3">
                    <AlertCircleIcon size={16} className="text-amber-400" />
                    <span className="text-sm font-medium text-white/90">Build Estimates</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="text-center">
                        <p className="text-2xl font-bold text-amber-400">
                            ${contract.estimatedComplexity.estimatedCostUSD.toFixed(2)}
                        </p>
                        <p className="text-xs text-white/50">Estimated Cost</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-emerald-400">
                            {contract.estimatedComplexity.parallelAgentsRecommended}
                        </p>
                        <p className="text-xs text-white/50">Parallel Agents</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-cyan-400">
                            {Math.round(contract.estimatedComplexity.estimatedTokens / 1000)}k
                        </p>
                        <p className="text-xs text-white/50">Est. Tokens</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-violet-400">
                            ~{contract.estimatedComplexity.estimatedHours}h
                        </p>
                        <p className="text-xs text-white/50">Build Time</p>
                    </div>
                </div>
                <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-white/5">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="text-xs text-white/60">Frontend: {contract.estimatedComplexity.frontendComplexity}/10</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-xs text-white/60">Backend: {contract.estimatedComplexity.backendComplexity}/10</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-400" />
                        <span className="text-xs text-white/60">Integration: {contract.estimatedComplexity.integrationComplexity}/10</span>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                <Button
                    variant="ghost"
                    onClick={onCancel}
                    className="text-slate-400 hover:text-white"
                >
                    Cancel
                </Button>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={() => setShowFeedbackModal(true)}
                        className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                    >
                        Request Changes
                    </Button>
                    <Button
                        onClick={handleApprove}
                        disabled={isApproving}
                        className={cn(
                            "px-6 rounded-xl font-semibold",
                            "bg-gradient-to-r from-amber-500 to-orange-500",
                            "hover:from-amber-400 hover:to-orange-400",
                            "text-black shadow-lg shadow-amber-500/25",
                            "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                    >
                        {isApproving ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                Approving...
                            </span>
                        ) : (
                            'Approve & Build'
                        )}
                    </Button>
                </div>
            </div>

            {/* Feedback Modal */}
            <AnimatePresence>
                {showFeedbackModal && (
                    <FeedbackModal
                        open={showFeedbackModal}
                        onClose={() => setShowFeedbackModal(false)}
                        onSubmit={handleReject}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

export default ImplementationPlanApproval;
