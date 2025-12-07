/**
 * Learning Settings Section
 *
 * User settings for the Autonomous Learning Engine.
 * Controls auto-capture, pattern usage, and display preferences.
 */

import { useState } from 'react';
import {
    Brain,
    Layers,
    GitBranch,
    Eye,
    Sparkles,
    Zap,
    Code,
    Palette,
    AlertCircle,
    Beaker,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLearningStore, type LearningPreferences } from '../../store/useLearningStore';

// =============================================================================
// TOGGLE COMPONENT
// =============================================================================

interface ToggleProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    label: string;
    description?: string;
    icon?: React.ElementType;
    disabled?: boolean;
}

function Toggle({
    enabled,
    onChange,
    label,
    description,
    icon: Icon,
    disabled = false,
}: ToggleProps) {
    return (
        <div className={`flex items-start gap-4 p-3 rounded-lg ${
            disabled ? 'opacity-50' : 'hover:bg-white/5'
        } transition-colors`}>
            {Icon && (
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                    <Icon className="w-4 h-4" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">{label}</span>
                    <button
                        onClick={() => !disabled && onChange(!enabled)}
                        disabled={disabled}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            enabled ? 'bg-purple-500' : 'bg-gray-600'
                        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                    </button>
                </div>
                {description && (
                    <p className="text-xs text-gray-400 mt-1">{description}</p>
                )}
            </div>
        </div>
    );
}

// =============================================================================
// SECTION COMPONENT
// =============================================================================

interface SectionProps {
    title: string;
    description?: string;
    children: React.ReactNode;
}

function Section({ title, description, children }: SectionProps) {
    return (
        <div className="space-y-3">
            <div>
                <h3 className="text-sm font-medium text-white">{title}</h3>
                {description && (
                    <p className="text-xs text-gray-400 mt-0.5">{description}</p>
                )}
            </div>
            <div className="space-y-1 rounded-lg bg-[#1a1a2e]/60 border border-white/5">
                {children}
            </div>
        </div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function LearningSettingsSection() {
    const { preferences, updatePreferences, status, statusError } = useLearningStore();

    const handleToggle = (key: keyof LearningPreferences) => (enabled: boolean) => {
        updatePreferences({ [key]: enabled });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                    <Brain className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-white">
                        Autonomous Learning Engine
                    </h2>
                    <p className="text-sm text-gray-400">
                        Configure how KripTik learns and improves from your builds
                    </p>
                </div>
            </div>

            {/* Status indicator */}
            {status && (
                <div className="flex items-center gap-4 p-3 rounded-lg bg-[#1a1a2e]/60 border border-white/5">
                    <div className={`w-2 h-2 rounded-full ${
                        status.isRunning ? 'bg-purple-400 animate-pulse' : 'bg-emerald-400'
                    }`} />
                    <div className="flex-1">
                        <span className="text-sm text-white">
                            {status.isRunning ? 'Learning cycle in progress...' : 'Learning system active'}
                        </span>
                        <p className="text-xs text-gray-400">
                            {status.patternStats.total} patterns • {status.strategyStats.active} strategies • {status.totalCycles} cycles completed
                        </p>
                    </div>
                    {status.overallImprovement > 0 && (
                        <span className="text-sm text-emerald-400">
                            +{status.overallImprovement}% improvement
                        </span>
                    )}
                </div>
            )}

            {statusError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-red-400">{statusError}</span>
                </div>
            )}

            {/* Experience Capture */}
            <Section
                title="Experience Capture"
                description="What data should be collected during builds"
            >
                <Toggle
                    enabled={preferences.autoCapture}
                    onChange={handleToggle('autoCapture')}
                    label="Auto-capture builds"
                    description="Automatically collect learning data from every build"
                    icon={Zap}
                />
                <Toggle
                    enabled={preferences.captureDecisions}
                    onChange={handleToggle('captureDecisions')}
                    label="Capture decisions"
                    description="Record AI decision-making processes"
                    icon={GitBranch}
                    disabled={!preferences.autoCapture}
                />
                <Toggle
                    enabled={preferences.captureCode}
                    onChange={handleToggle('captureCode')}
                    label="Capture code evolution"
                    description="Track how code changes across iterations"
                    icon={Code}
                    disabled={!preferences.autoCapture}
                />
                <Toggle
                    enabled={preferences.captureDesign}
                    onChange={handleToggle('captureDesign')}
                    label="Capture design choices"
                    description="Record typography, color, and layout decisions"
                    icon={Palette}
                    disabled={!preferences.autoCapture}
                />
                <Toggle
                    enabled={preferences.captureErrors}
                    onChange={handleToggle('captureErrors')}
                    label="Capture error recoveries"
                    description="Learn from how errors are fixed"
                    icon={AlertCircle}
                    disabled={!preferences.autoCapture}
                />
            </Section>

            {/* Pattern Usage */}
            <Section
                title="Pattern Usage"
                description="How learned patterns are applied to new builds"
            >
                <Toggle
                    enabled={preferences.useLearnedPatterns}
                    onChange={handleToggle('useLearnedPatterns')}
                    label="Use learned patterns"
                    description="Apply patterns from successful past builds"
                    icon={Layers}
                />
                <Toggle
                    enabled={preferences.patternSuggestions}
                    onChange={handleToggle('patternSuggestions')}
                    label="Show pattern suggestions"
                    description="Display relevant patterns while building"
                    icon={Sparkles}
                    disabled={!preferences.useLearnedPatterns}
                />
            </Section>

            {/* Strategy Selection */}
            <Section
                title="Strategy Selection"
                description="How build strategies are chosen"
            >
                <Toggle
                    enabled={preferences.useLearnedStrategies}
                    onChange={handleToggle('useLearnedStrategies')}
                    label="Use learned strategies"
                    description="Select build approaches based on past success"
                    icon={GitBranch}
                />
                <Toggle
                    enabled={preferences.allowExperimentalStrategies}
                    onChange={handleToggle('allowExperimentalStrategies')}
                    label="Allow experimental strategies"
                    description="Include new, unproven strategies in selection"
                    icon={Beaker}
                    disabled={!preferences.useLearnedStrategies}
                />
            </Section>

            {/* Display Settings */}
            <Section
                title="Display Settings"
                description="How learning information is shown"
            >
                <Toggle
                    enabled={preferences.showLearningStatus}
                    onChange={handleToggle('showLearningStatus')}
                    label="Show learning status"
                    description="Display learning system status in dashboard"
                    icon={Eye}
                />
                <Toggle
                    enabled={preferences.showInsightsInBuilder}
                    onChange={handleToggle('showInsightsInBuilder')}
                    label="Show insights in builder"
                    description="Display learning insights while building"
                    icon={Brain}
                />
                <Toggle
                    enabled={preferences.compactLearningView}
                    onChange={handleToggle('compactLearningView')}
                    label="Compact view"
                    description="Use condensed layout for learning panels"
                    icon={Layers}
                />
            </Section>
        </div>
    );
}

export default LearningSettingsSection;

