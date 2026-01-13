/**
 * IntentContractDisplay - Shows the locked Intent Contract after Phase 0
 *
 * Displays the Sacred Contract created during the Intent Lock phase:
 * - Success criteria that must be met
 * - User workflows being built
 * - Visual identity and app soul
 * - Feature breakdown
 *
 * Premium liquid glass styling per KripTik design standards.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LockIcon,
    CheckCircleIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    TargetIcon,
    SparklesIcon,
    CloseIcon,
} from '../ui/icons';

// Custom inline icons for features not in icon set
const WorkflowStepsIcon: React.FC<{ size?: number; className?: string }> = ({
    size = 24,
    className,
}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <line x1="6" y1="6" x2="6" y2="18" />
        <circle cx="6" cy="6" r="2" />
        <circle cx="6" cy="18" r="2" />
        <path d="M6 12h12a2 2 0 0 1 2 2v4" />
        <circle cx="20" cy="18" r="2" />
    </svg>
);

const PaletteIcon: React.FC<{ size?: number; className?: string }> = ({
    size = 24,
    className,
}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
        <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
        <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
        <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" />
    </svg>
);

export interface IntentContract {
    appSoul: string;
    coreValueProp: string;
    successCriteria: Array<{
        id: string;
        description: string;
        verified?: boolean;
    }>;
    userWorkflows: Array<{
        name: string;
        steps: string[];
    }>;
    visualIdentity: {
        soul: string;
        emotion: string;
        depth: string;
        motion: string;
    };
    locked: boolean;
    lockedAt?: string;
}

interface IntentContractDisplayProps {
    contract: IntentContract;
    onDismiss?: () => void;
    compact?: boolean;
}

// Map app soul types to descriptions and colors
const APP_SOUL_INFO: Record<
    string,
    { description: string; gradient: string; emoji: string }
> = {
    immersive_media: {
        description: 'Rich visual experiences, entertainment, creative content',
        gradient: 'from-purple-500/30 to-pink-500/30',
        emoji: '',
    },
    professional: {
        description: 'Business tools, productivity, enterprise solutions',
        gradient: 'from-blue-500/30 to-cyan-500/30',
        emoji: '',
    },
    developer: {
        description: 'Technical tools, APIs, infrastructure, code platforms',
        gradient: 'from-emerald-500/30 to-teal-500/30',
        emoji: '',
    },
    creative: {
        description: 'Design tools, artistic platforms, creative workflows',
        gradient: 'from-amber-500/30 to-orange-500/30',
        emoji: '',
    },
    social: {
        description: 'Community platforms, communication, networking',
        gradient: 'from-rose-500/30 to-red-500/30',
        emoji: '',
    },
    ecommerce: {
        description: 'Shopping, marketplaces, transactions, commerce',
        gradient: 'from-green-500/30 to-emerald-500/30',
        emoji: '',
    },
    utility: {
        description: 'Practical tools, calculators, converters, helpers',
        gradient: 'from-slate-500/30 to-gray-500/30',
        emoji: '',
    },
    gaming: {
        description: 'Games, interactive experiences, gamification',
        gradient: 'from-violet-500/30 to-purple-500/30',
        emoji: '',
    },
};

export function IntentContractDisplay({
    contract,
    onDismiss,
    compact = false,
}: IntentContractDisplayProps) {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set(['criteria', 'workflows'])
    );

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

    const soulInfo = APP_SOUL_INFO[contract.appSoul] || APP_SOUL_INFO.utility;

    // Format the locked timestamp
    const lockedTimeDisplay = contract.lockedAt
        ? new Date(contract.lockedAt).toLocaleString()
        : 'Just now';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`relative overflow-hidden rounded-2xl ${compact ? 'max-w-md' : 'w-full'}`}
            style={{
                background:
                    'linear-gradient(145deg, rgba(30, 30, 35, 0.95) 0%, rgba(20, 20, 25, 0.98) 100%)',
                backdropFilter: 'blur(40px) saturate(180%)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: `
                    0 8px 32px rgba(0, 0, 0, 0.3),
                    0 4px 16px rgba(0, 0, 0, 0.2),
                    inset 0 1px 0 rgba(255, 255, 255, 0.05)
                `,
            }}
        >
            {/* Header with Lock Icon */}
            <div
                className="flex items-center justify-between p-4 border-b"
                style={{
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    background: `linear-gradient(135deg, ${soulInfo.gradient.split(' ')[0].replace('from-', 'rgba(').replace('/30', ', 0.1)')} 0%, transparent 50%)`,
                }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                            background: contract.locked
                                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(5, 150, 105, 0.2) 100%)'
                                : 'linear-gradient(135deg, rgba(245, 168, 108, 0.3) 0%, rgba(194, 90, 0, 0.2) 100%)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                        }}
                    >
                        <LockIcon
                            size={20}
                            className={
                                contract.locked ? 'text-emerald-400' : 'text-amber-400'
                            }
                        />
                    </div>
                    <div>
                        <h3 className="text-white font-semibold text-sm">
                            Sacred Contract
                        </h3>
                        <p className="text-white/50 text-xs">
                            {contract.locked ? `Locked ${lockedTimeDisplay}` : 'Creating...'}
                        </p>
                    </div>
                </div>

                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="p-2 rounded-lg transition-colors hover:bg-white/10"
                    >
                        <CloseIcon size={16} className="text-white/60" />
                    </button>
                )}
            </div>

            {/* App Soul Badge */}
            <div className="px-4 pt-4">
                <div
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r ${soulInfo.gradient}`}
                    style={{
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                >
                    <SparklesIcon size={14} className="text-white/80" />
                    <span className="text-white/90 capitalize">
                        {contract.appSoul.replace('_', ' ')}
                    </span>
                </div>
            </div>

            {/* Core Value Proposition */}
            <div className="px-4 pt-3 pb-4">
                <p className="text-white/90 text-sm leading-relaxed">
                    {contract.coreValueProp}
                </p>
            </div>

            {/* Success Criteria Section */}
            <CollapsibleSection
                title="Success Criteria"
                icon={<TargetIcon size={16} className="text-emerald-400" />}
                count={contract.successCriteria.length}
                expanded={expandedSections.has('criteria')}
                onToggle={() => toggleSection('criteria')}
            >
                <div className="space-y-2">
                    {contract.successCriteria.map((criterion, index) => (
                        <div
                            key={criterion.id || index}
                            className="flex items-start gap-3 p-2 rounded-lg"
                            style={{
                                background: criterion.verified
                                    ? 'rgba(16, 185, 129, 0.1)'
                                    : 'rgba(255, 255, 255, 0.03)',
                            }}
                        >
                            <div
                                className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    criterion.verified
                                        ? 'bg-emerald-500/30'
                                        : 'bg-white/10'
                                }`}
                            >
                                {criterion.verified ? (
                                    <CheckCircleIcon
                                        size={14}
                                        className="text-emerald-400"
                                    />
                                ) : (
                                    <span className="text-white/40 text-xs">
                                        {index + 1}
                                    </span>
                                )}
                            </div>
                            <p className="text-white/80 text-sm leading-relaxed">
                                {criterion.description}
                            </p>
                        </div>
                    ))}
                </div>
            </CollapsibleSection>

            {/* User Workflows Section */}
            <CollapsibleSection
                title="User Workflows"
                icon={<WorkflowStepsIcon size={16} className="text-blue-400" />}
                count={contract.userWorkflows.length}
                expanded={expandedSections.has('workflows')}
                onToggle={() => toggleSection('workflows')}
            >
                <div className="space-y-4">
                    {contract.userWorkflows.map((workflow, wIndex) => (
                        <div key={wIndex}>
                            <h5 className="text-white/90 text-sm font-medium mb-2">
                                {workflow.name}
                            </h5>
                            <div className="space-y-1 pl-2">
                                {workflow.steps.map((step, sIndex) => (
                                    <div
                                        key={sIndex}
                                        className="flex items-start gap-2 text-white/70 text-sm"
                                    >
                                        <span className="text-white/30 text-xs mt-1">
                                            {sIndex + 1}.
                                        </span>
                                        <span>{step}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </CollapsibleSection>

            {/* Visual Identity Section */}
            <CollapsibleSection
                title="Visual Identity"
                icon={<PaletteIcon size={16} className="text-amber-400" />}
                expanded={expandedSections.has('visual')}
                onToggle={() => toggleSection('visual')}
            >
                <div className="grid grid-cols-2 gap-3">
                    <VisualIdentityCard
                        label="Soul"
                        value={contract.visualIdentity.soul}
                    />
                    <VisualIdentityCard
                        label="Emotion"
                        value={contract.visualIdentity.emotion}
                    />
                    <VisualIdentityCard
                        label="Depth"
                        value={contract.visualIdentity.depth}
                    />
                    <VisualIdentityCard
                        label="Motion"
                        value={contract.visualIdentity.motion}
                    />
                </div>
            </CollapsibleSection>

            {/* Locked Status Footer */}
            {contract.locked && (
                <div
                    className="px-4 py-3 border-t"
                    style={{
                        borderColor: 'rgba(255, 255, 255, 0.05)',
                        background: 'rgba(16, 185, 129, 0.05)',
                    }}
                >
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-emerald-400/90 text-xs font-medium">
                            Contract Locked - Implementation in Progress
                        </span>
                    </div>
                </div>
            )}
        </motion.div>
    );
}

// Collapsible Section Component
function CollapsibleSection({
    title,
    icon,
    count,
    expanded,
    onToggle,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    count?: number;
    expanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.05)' }}>
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-white/90 text-sm font-medium">{title}</span>
                    {count !== undefined && (
                        <span className="text-white/40 text-xs">({count})</span>
                    )}
                </div>
                {expanded ? (
                    <ChevronUpIcon size={16} className="text-white/40" />
                ) : (
                    <ChevronDownIcon size={16} className="text-white/40" />
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
                        <div className="px-4 pb-4">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Visual Identity Card Component
function VisualIdentityCard({ label, value }: { label: string; value: string }) {
    return (
        <div
            className="p-3 rounded-lg"
            style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
        >
            <p className="text-white/40 text-xs mb-1">{label}</p>
            <p className="text-white/90 text-sm capitalize">{value}</p>
        </div>
    );
}

// Compact inline display for header use
export function IntentContractInline({
    contract,
    onClick,
}: {
    contract: IntentContract;
    onClick?: () => void;
}) {
    const verifiedCount = contract.successCriteria.filter((c) => c.verified).length;
    const totalCount = contract.successCriteria.length;

    return (
        <motion.button
            onClick={onClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors"
            style={{
                background: contract.locked
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(245, 168, 108, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
        >
            <LockIcon
                size={14}
                className={contract.locked ? 'text-emerald-400' : 'text-amber-400'}
            />
            <span className="text-white/80 text-xs font-medium">
                {verifiedCount}/{totalCount} criteria
            </span>
        </motion.button>
    );
}

export default IntentContractDisplay;
