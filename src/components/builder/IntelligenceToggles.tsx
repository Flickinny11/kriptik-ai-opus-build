/**
 * Intelligence Toggles Component
 *
 * Beautiful UI for per-request AI capability toggles.
 * Part of Phase 9: UI Enhancements
 */

import { useState } from 'react';
import {
    BrainIcon,
    ZapIcon,
    ActivityIcon,
    CodeIcon,
    ChevronDownIcon,
} from '../ui/icons';
import { motion, AnimatePresence } from 'framer-motion';

// Custom icons for Intelligence Toggles
const SparklesIcon = ({ className, ...props }: { className?: string; size?: number }) => (
    <svg className={className} width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
        <path d="M5 3v4"/>
        <path d="M19 17v4"/>
        <path d="M3 5h4"/>
        <path d="M17 19h4"/>
    </svg>
);

const PaletteIcon = ({ className, ...props }: { className?: string; size?: number }) => (
    <svg className={className} width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r=".5"/>
        <circle cx="17.5" cy="10.5" r=".5"/>
        <circle cx="8.5" cy="7.5" r=".5"/>
        <circle cx="6.5" cy="12.5" r=".5"/>
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
    </svg>
);

const LightbulbIcon = ({ className, ...props }: { className?: string; size?: number }) => (
    <svg className={className} width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
        <path d="M9 18h6"/>
        <path d="M10 22h4"/>
    </svg>
);

const RocketIcon = ({ className, ...props }: { className?: string; size?: number }) => (
    <svg className={className} width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </svg>
);

type LucideIcon = React.FC<{ className?: string; size?: number }>;

// ============================================================================
// TYPES
// ============================================================================

export interface IntelligenceSettings {
    thinkingDepth: 'shallow' | 'normal' | 'deep' | 'maximum';
    powerLevel: 'economy' | 'balanced' | 'performance' | 'maximum';
    speedPriority: 'fastest' | 'fast' | 'balanced' | 'quality' | 'maximum-quality';
    creativityLevel: 'conservative' | 'balanced' | 'creative' | 'experimental';
    codeVerbosity: 'minimal' | 'standard' | 'verbose';
    designDetail: 'minimal' | 'standard' | 'polished' | 'premium';
}

interface IntelligenceTogglesProps {
    settings: IntelligenceSettings;
    onSettingsChange: (settings: IntelligenceSettings) => void;
    disabled?: boolean;
    compact?: boolean;
}

// ============================================================================
// PRESETS
// ============================================================================

const PRESETS = [
    { id: 'quick', name: 'Quick Draft', icon: ZapIcon as any, color: 'amber' },
    { id: 'balanced', name: 'Balanced', icon: ActivityIcon as any, color: 'blue' },
    { id: 'quality', name: 'Quality', icon: SparklesIcon as any, color: 'purple' },
    { id: 'production', name: 'Production', icon: RocketIcon as any, color: 'emerald' },
];

const PRESET_SETTINGS: Record<string, IntelligenceSettings> = {
    quick: {
        thinkingDepth: 'shallow',
        powerLevel: 'economy',
        speedPriority: 'fastest',
        creativityLevel: 'balanced',
        codeVerbosity: 'minimal',
        designDetail: 'minimal',
    },
    balanced: {
        thinkingDepth: 'normal',
        powerLevel: 'balanced',
        speedPriority: 'balanced',
        creativityLevel: 'balanced',
        codeVerbosity: 'standard',
        designDetail: 'standard',
    },
    quality: {
        thinkingDepth: 'deep',
        powerLevel: 'performance',
        speedPriority: 'quality',
        creativityLevel: 'balanced',
        codeVerbosity: 'standard',
        designDetail: 'polished',
    },
    production: {
        thinkingDepth: 'maximum',
        powerLevel: 'maximum',
        speedPriority: 'maximum-quality',
        creativityLevel: 'conservative',
        codeVerbosity: 'verbose',
        designDetail: 'premium',
    },
};

// ============================================================================
// SLIDER COMPONENT
// ============================================================================

interface SliderConfig {
    icon: LucideIcon;
    label: string;
    description: string;
    options: { value: string; label: string }[];
    color: string;
}

function SettingSlider({
    config,
    value,
    onChange,
    disabled,
}: {
    config: SliderConfig;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}) {
    const Icon = config.icon;
    const currentIndex = config.options.findIndex(o => o.value === value);
    const percentage = (currentIndex / (config.options.length - 1)) * 100;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon size={16} className={`text-${config.color}-400`} />
                    <span className="text-sm font-medium text-white">{config.label}</span>
                </div>
                <span className="text-xs text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded">
                    {config.options[currentIndex]?.label}
                </span>
            </div>

            <div className="relative h-8 flex items-center">
                {/* Track */}
                <div className="absolute inset-x-0 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                        className={`h-full bg-gradient-to-r from-${config.color}-500 to-${config.color}-400`}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.2 }}
                    />
                </div>

                {/* Options */}
                <div className="absolute inset-x-0 flex justify-between">
                    {config.options.map((option, index) => {
                        const isActive = index <= currentIndex;
                        const isCurrent = option.value === value;

                        return (
                            <button
                                key={option.value}
                                onClick={() => !disabled && onChange(option.value)}
                                disabled={disabled}
                                className={`
                                    relative w-6 h-6 rounded-full transition-all duration-200
                                    flex items-center justify-center
                                    ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-110'}
                                    ${isCurrent ? `bg-${config.color}-500 shadow-lg shadow-${config.color}-500/30` : isActive ? 'bg-slate-600' : 'bg-slate-700'}
                                `}
                                title={option.label}
                            >
                                {isCurrent && (
                                    <motion.div
                                        layoutId={`slider-${config.label}`}
                                        className={`absolute inset-0 rounded-full border-2 border-${config.color}-400`}
                                    />
                                )}
                                <span className={`text-[10px] font-bold ${isCurrent ? 'text-white' : 'text-slate-400'}`}>
                                    {index + 1}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <p className="text-xs text-slate-500">{config.description}</p>
        </div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function IntelligenceToggles({
    settings,
    onSettingsChange,
    disabled = false,
    compact = false,
}: IntelligenceTogglesProps) {
    const [expanded, setExpanded] = useState(!compact);
    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

    // Detect current preset
    const detectPreset = () => {
        for (const [id, presetSettings] of Object.entries(PRESET_SETTINGS)) {
            if (JSON.stringify(settings) === JSON.stringify(presetSettings)) {
                return id;
            }
        }
        return null;
    };

    const currentPreset = selectedPreset || detectPreset();

    const applyPreset = (presetId: string) => {
        setSelectedPreset(presetId);
        onSettingsChange(PRESET_SETTINGS[presetId]);
    };

    const updateSetting = <K extends keyof IntelligenceSettings>(
        key: K,
        value: IntelligenceSettings[K]
    ) => {
        setSelectedPreset(null);
        onSettingsChange({ ...settings, [key]: value });
    };

    const sliderConfigs: (SliderConfig & { key: keyof IntelligenceSettings })[] = [
        {
            key: 'thinkingDepth',
            icon: BrainIcon as any,
            label: 'Thinking Depth',
            description: 'How much reasoning before responding',
            options: [
                { value: 'shallow', label: 'Shallow' },
                { value: 'normal', label: 'Normal' },
                { value: 'deep', label: 'Deep' },
                { value: 'maximum', label: 'Maximum' },
            ],
            color: 'violet',
        },
        {
            key: 'powerLevel',
            icon: ZapIcon as any,
            label: 'Power Level',
            description: 'AI model capability (affects cost)',
            options: [
                { value: 'economy', label: 'Economy' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'performance', label: 'Performance' },
                { value: 'maximum', label: 'Maximum' },
            ],
            color: 'amber',
        },
        {
            key: 'speedPriority',
            icon: ActivityIcon as any,
            label: 'Speed vs Quality',
            description: 'Trade-off between response time and output quality',
            options: [
                { value: 'fastest', label: 'Fastest' },
                { value: 'fast', label: 'Fast' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'quality', label: 'Quality' },
                { value: 'maximum-quality', label: 'Max Quality' },
            ],
            color: 'cyan',
        },
        {
            key: 'creativityLevel',
            icon: SparklesIcon as any,
            label: 'Creativity',
            description: 'Novel approaches vs proven patterns',
            options: [
                { value: 'conservative', label: 'Conservative' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'creative', label: 'Creative' },
                { value: 'experimental', label: 'Experimental' },
            ],
            color: 'pink',
        },
        {
            key: 'codeVerbosity',
            icon: CodeIcon as any,
            label: 'Code Style',
            description: 'Amount of code comments and verbosity',
            options: [
                { value: 'minimal', label: 'Minimal' },
                { value: 'standard', label: 'Standard' },
                { value: 'verbose', label: 'Verbose' },
            ],
            color: 'emerald',
        },
        {
            key: 'designDetail',
            icon: PaletteIcon as any,
            label: 'Design Detail',
            description: 'Visual polish and UI refinement',
            options: [
                { value: 'minimal', label: 'Minimal' },
                { value: 'standard', label: 'Standard' },
                { value: 'polished', label: 'Polished' },
                { value: 'premium', label: 'Premium' },
            ],
            color: 'rose',
        },
    ];

    return (
        <div className="rounded-xl bg-slate-900/50 backdrop-blur-xl border border-white/5 overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500">
                        <LightbulbIcon size={16} className="text-white" />
                    </div>
                    <div className="text-left">
                        <h3 className="font-semibold text-white">Intelligence Settings</h3>
                        <p className="text-xs text-slate-400">
                            {currentPreset ? PRESETS.find(p => p.id === currentPreset)?.name : 'Custom Configuration'}
                        </p>
                    </div>
                </div>

                <motion.div animate={{ rotate: expanded ? 180 : 0 }}>
                    <ChevronDownIcon size={20} className="text-slate-400" />
                </motion.div>
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
                        <div className="px-4 pb-4 space-y-6">
                            {/* Presets */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Quick Presets
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {PRESETS.map((preset) => {
                                        const isActive = currentPreset === preset.id;
                                        const Icon = preset.icon;

                                        return (
                                            <motion.button
                                                key={preset.id}
                                                onClick={() => !disabled && applyPreset(preset.id)}
                                                disabled={disabled}
                                                whileHover={{ scale: disabled ? 1 : 1.02 }}
                                                whileTap={{ scale: disabled ? 1 : 0.98 }}
                                                className={`
                                                    relative p-3 rounded-lg text-center
                                                    transition-all duration-200
                                                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                                    ${isActive
                                                        ? `bg-${preset.color}-500/20 border border-${preset.color}-500/50`
                                                        : 'bg-slate-800/50 border border-white/5 hover:border-white/10'
                                                    }
                                                `}
                                            >
                                                <Icon size={20} className={`mx-auto mb-1 ${isActive ? `text-${preset.color}-400` : 'text-slate-400'}`} />
                                                <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-slate-300'}`}>
                                                    {preset.name}
                                                </span>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-white/5" />

                            {/* Individual Sliders */}
                            <div className="space-y-6">
                                {sliderConfigs.map((config) => (
                                    <SettingSlider
                                        key={config.key}
                                        config={config}
                                        value={settings[config.key]}
                                        onChange={(value) => updateSetting(config.key, value as any)}
                                        disabled={disabled}
                                    />
                                ))}
                            </div>

                            {/* Cost Indicator */}
                            <div className="p-3 rounded-lg bg-slate-800/50 border border-white/5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400">Estimated cost multiplier</span>
                                    <span className="text-sm font-mono text-white">
                                        {calculateCostMultiplier(settings)}x
                                    </span>
                                </div>
                                <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"
                                        animate={{ width: `${Math.min(100, calculateCostMultiplier(settings) * 20)}%` }}
                                        transition={{ duration: 0.3 }}
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ============================================================================
// HELPERS
// ============================================================================

function calculateCostMultiplier(settings: IntelligenceSettings): number {
    let multiplier = 1;

    const powerMultipliers = { economy: 0.3, balanced: 1, performance: 2, maximum: 5 };
    multiplier *= powerMultipliers[settings.powerLevel];

    const thinkingMultipliers = { shallow: 1, normal: 1.2, deep: 1.5, maximum: 2 };
    multiplier *= thinkingMultipliers[settings.thinkingDepth];

    const speedMultipliers = { fastest: 0.7, fast: 0.9, balanced: 1, quality: 1.5, 'maximum-quality': 2.5 };
    multiplier *= speedMultipliers[settings.speedPriority];

    return Math.round(multiplier * 10) / 10;
}

export default IntelligenceToggles;

