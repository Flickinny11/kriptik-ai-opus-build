/**
 * Convention Summary
 *
 * Quick-reference card for detected coding conventions.
 */

import { motion } from 'framer-motion';
import { CodeIcon, CircleIcon } from '../ui/icons';

// Inline SVG icons for AlignLeft, Quote, and Braces
const AlignLeftIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <line x1="17" y1="10" x2="3" y2="10" />
        <line x1="21" y1="6" x2="3" y2="6" />
        <line x1="21" y1="14" x2="3" y2="14" />
        <line x1="17" y1="18" x2="3" y2="18" />
    </svg>
);

const QuoteIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z" />
        <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z" />
    </svg>
);

const BracesIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1" />
        <path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />
    </svg>
);

const accentColor = '#c8ff64';

interface CodingConventions {
    indentation: 'tabs' | 'spaces';
    indentSize: number;
    quoteStyle: 'single' | 'double';
    semicolons: boolean;
    componentStyle: 'functional' | 'class' | 'mixed';
    namingConventions: {
        components: 'PascalCase' | 'camelCase';
        files: 'kebab-case' | 'camelCase' | 'PascalCase';
        variables: 'camelCase' | 'snake_case';
    };
    trailingCommas: boolean;
}

interface ConventionSummaryProps {
    conventions: CodingConventions;
    className?: string;
}

export function ConventionSummary({
    conventions,
    className = '',
}: ConventionSummaryProps) {
    const items = [
        {
            icon: AlignLeftIcon,
            label: 'Indentation',
            value: `${conventions.indentSize} ${conventions.indentation}`,
        },
        {
            icon: QuoteIcon,
            label: 'Quotes',
            value: conventions.quoteStyle === 'single' ? "Single (')" : 'Double (")',
        },
        {
            icon: CircleIcon,
            label: 'Semicolons',
            value: conventions.semicolons ? 'Required' : 'Optional',
        },
        {
            icon: BracesIcon,
            label: 'Components',
            value: conventions.componentStyle.charAt(0).toUpperCase() + conventions.componentStyle.slice(1),
        },
        {
            icon: CodeIcon,
            label: 'Trailing Commas',
            value: conventions.trailingCommas ? 'Yes' : 'No',
        },
    ];

    return (
        <div className={`rounded-xl border border-white/10 bg-black/30 overflow-hidden ${className}`}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <CodeIcon size={16} style={{ color: accentColor }} />
                    Coding Conventions
                </h3>
            </div>

            {/* Items */}
            <div className="p-4 space-y-3">
                {items.map((item, index) => {
                    const Icon = item.icon;
                    return (
                        <motion.div
                            key={item.label}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center justify-between"
                        >
                            <div className="flex items-center gap-2">
                                <Icon size={16} className="text-white/40" />
                                <span className="text-sm text-white/60">{item.label}</span>
                            </div>
                            <span className="text-sm font-medium text-white">{item.value}</span>
                        </motion.div>
                    );
                })}

                {/* Naming conventions */}
                <div className="pt-3 mt-3 border-t border-white/10">
                    <p className="text-xs text-white/40 mb-2">Naming Conventions</p>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-white/60">Components</span>
                            <code className="px-2 py-0.5 rounded bg-white/5 text-white/80 text-xs">
                                {conventions.namingConventions.components}
                            </code>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-white/60">Files</span>
                            <code className="px-2 py-0.5 rounded bg-white/5 text-white/80 text-xs">
                                {conventions.namingConventions.files}
                            </code>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-white/60">Variables</span>
                            <code className="px-2 py-0.5 rounded bg-white/5 text-white/80 text-xs">
                                {conventions.namingConventions.variables}
                            </code>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

