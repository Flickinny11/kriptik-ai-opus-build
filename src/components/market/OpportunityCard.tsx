/**
 * Opportunity Card
 *
 * Actionable opportunity with implementation button.
 */

import { motion } from 'framer-motion';
import {
    LightbulbIcon,
    ZapIcon,
    ClockIcon,
    ChevronRightIcon,
    LayersIcon,
    DollarSignIcon,
    CheckCircleIcon,
    ActivityIcon // Using as Target substitute
} from '../ui/icons';

// Temporary icon aliases for icons not yet in custom library
const TargetIcon = ActivityIcon;
const PaletteIcon = LayersIcon; // Using LayersIcon as Palette substitute
const Link2Icon = LayersIcon; // Using LayersIcon as Link2 substitute
const CheckCircle2Icon = CheckCircleIcon;

const accentColor = '#c8ff64';

interface Opportunity {
    id: string;
    type: string;
    title: string;
    description: string;
    potentialValue: string;
    effort: string;
    timeToImplement: string;
    competitiveAdvantage: string;
    actionItems: string[];
}

interface OpportunityCardProps {
    opportunity: Opportunity;
    onImplement?: () => void;
}

const TYPE_CONFIG: Record<string, { icon: React.ComponentType<{ size?: number; className?: string; color?: string }>; color: string; gradient: string }> = {
    feature: { icon: LayersIcon, color: '#3b82f6', gradient: 'from-blue-500/20 to-blue-600/10' },
    pricing: { icon: DollarSignIcon, color: '#10b981', gradient: 'from-emerald-500/20 to-emerald-600/10' },
    positioning: { icon: TargetIcon, color: '#f59e0b', gradient: 'from-amber-500/20 to-amber-600/10' },
    design: { icon: PaletteIcon, color: '#8b5cf6', gradient: 'from-purple-500/20 to-purple-600/10' },
    integration: { icon: Link2Icon, color: '#ec4899', gradient: 'from-pink-500/20 to-pink-600/10' },
};

const VALUE_COLORS = {
    high: '#22c55e',
    medium: '#fbbf24',
    low: '#6b7280',
};

const EFFORT_COLORS = {
    low: '#22c55e',
    medium: '#fbbf24',
    high: '#ef4444',
};

export function OpportunityCard({ opportunity, onImplement }: OpportunityCardProps) {
    const config = TYPE_CONFIG[opportunity.type] || TYPE_CONFIG.feature;
    const TypeIcon = config.icon;
    const valueColor = VALUE_COLORS[opportunity.potentialValue as keyof typeof VALUE_COLORS] || VALUE_COLORS.medium;
    const effortColor = EFFORT_COLORS[opportunity.effort as keyof typeof EFFORT_COLORS] || EFFORT_COLORS.medium;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className="group relative rounded-2xl overflow-hidden"
            style={{
                background: 'linear-gradient(145deg, rgba(30,30,35,0.95) 0%, rgba(20,20,25,0.98) 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 20px 40px -12px rgba(0,0,0,0.4)',
            }}
        >
            {/* Gradient Header */}
            <div className={`relative h-2 bg-gradient-to-r ${config.gradient}`} />

            <div className="p-5">
                {/* Header */}
                <div className="flex items-start gap-4 mb-4">
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${config.color}20`, color: config.color }}
                    >
                        <TypeIcon size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span
                                className="px-2 py-0.5 rounded text-xs font-medium capitalize"
                                style={{ background: `${config.color}20`, color: config.color }}
                            >
                                {opportunity.type}
                            </span>
                        </div>
                        <h3 className="font-semibold text-white text-lg leading-tight">
                            {opportunity.title}
                        </h3>
                    </div>
                </div>

                {/* Description */}
                <p className="text-sm text-white/60 mb-4 line-clamp-3">
                    {opportunity.description}
                </p>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="p-3 rounded-xl bg-white/5 text-center" style={{ color: valueColor }}>
                        <ZapIcon size={16} className="mx-auto mb-1" />
                        <div className="text-xs text-white/40 mb-0.5">Value</div>
                        <div className="text-sm font-medium capitalize">
                            {opportunity.potentialValue}
                        </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 text-center" style={{ color: effortColor }}>
                        <TargetIcon size={16} className="mx-auto mb-1" />
                        <div className="text-xs text-white/40 mb-0.5">Effort</div>
                        <div className="text-sm font-medium capitalize">
                            {opportunity.effort}
                        </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 text-center text-cyan-400">
                        <ClockIcon size={16} className="mx-auto mb-1" />
                        <div className="text-xs text-white/40 mb-0.5">Time</div>
                        <div className="text-sm font-medium">
                            {opportunity.timeToImplement}
                        </div>
                    </div>
                </div>

                {/* Competitive Advantage */}
                <div className="p-3 rounded-xl bg-white/5 mb-4">
                    <div className="text-xs text-white/40 mb-1 flex items-center gap-1">
                        <LightbulbIcon size={12} />
                        Competitive Advantage
                    </div>
                    <p className="text-sm text-white/80">{opportunity.competitiveAdvantage}</p>
                </div>

                {/* Action Items */}
                {opportunity.actionItems && opportunity.actionItems.length > 0 && (
                    <div className="mb-4">
                        <div className="text-xs text-white/40 mb-2">Action Items</div>
                        <ul className="space-y-1.5">
                            {opportunity.actionItems.slice(0, 3).map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                                    <CheckCircle2Icon size={16} className="mt-0.5 text-white/30 flex-shrink-0" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Implement Button */}
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onImplement}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all"
                    style={{
                        background: `linear-gradient(145deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
                        color: '#000',
                    }}
                >
                    <ZapIcon size={16} />
                    Implement This
                    <ChevronRightIcon size={16} />
                </motion.button>
            </div>
        </motion.div>
    );
}

