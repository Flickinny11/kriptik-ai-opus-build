/**
 * Intelligence Toggles Component
 *
 * Beautiful UI for per-request AI capability toggles.
 * Part of Phase 9: UI Enhancements
 */

import { useState } from 'react';
import {
    Brain, Zap, Gauge, Sparkles, Code, Palette,
    ChevronDown, Lightbulb, Rocket,
    LucideIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
    { id: 'quick', name: 'Quick Draft', icon: Zap, color: 'amber' },
    { id: 'balanced', name: 'Balanced', icon: Gauge, color: 'blue' },
    { id: 'quality', name: 'Quality', icon: Sparkles, color: 'purple' },
    { id: 'production', name: 'Production', icon: Rocket, color: 'emerald' },
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
                    <Icon className={`w-4 h-4 text-${config.color}-400`} />
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
            icon: Brain,
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
            icon: Zap,
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
            icon: Gauge,
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
            icon: Sparkles,
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
            icon: Code,
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
            icon: Palette,
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
                        <Lightbulb className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                        <h3 className="font-semibold text-white">Intelligence Settings</h3>
                        <p className="text-xs text-slate-400">
                            {currentPreset ? PRESETS.find(p => p.id === currentPreset)?.name : 'Custom Configuration'}
                        </p>
                    </div>
                </div>

                <motion.div animate={{ rotate: expanded ? 180 : 0 }}>
                    <ChevronDown className="w-5 h-5 text-slate-400" />
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
                                                <Icon className={`w-5 h-5 mx-auto mb-1 ${isActive ? `text-${preset.color}-400` : 'text-slate-400'}`} />
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

