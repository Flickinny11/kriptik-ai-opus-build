/**
 * Learning Settings Section
 *
 * User settings for the Autonomous Learning Engine.
 * Controls auto-capture, pattern usage, and display preferences.
 * Updated to match glass theme styling.
 */

import { motion } from 'framer-motion';
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
import { useLearningStore, type LearningPreferences } from '../../store/useLearningStore';

// =============================================================================
// TOGGLE COMPONENT - Glass Theme
// =============================================================================

interface ToggleProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    label: string;
    description?: string;
    icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
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
            disabled ? 'opacity-50' : 'hover:bg-black/[0.02]'
        } transition-colors`}>
            {Icon && (
                <div
                    className="p-2 rounded-lg"
                    style={{ background: 'rgba(255,180,140,0.2)' }}
                >
                    <Icon className="w-4 h-4" style={{ color: '#c25a00' }} />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: '#1a1a1a' }}>{label}</span>
                    <button
                        onClick={() => !disabled && onChange(!enabled)}
                        disabled={disabled}
                        className="w-12 h-6 rounded-full transition-colors relative"
                        style={{
                            background: enabled ? 'rgba(255,180,140,0.6)' : 'rgba(0,0,0,0.1)',
                            cursor: disabled ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <motion.div
                            className="w-5 h-5 rounded-full shadow absolute top-0.5"
                            style={{ background: enabled ? '#c25a00' : '#999' }}
                            animate={{ left: enabled ? 26 : 2 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                    </button>
                </div>
                {description && (
                    <p className="text-xs mt-1" style={{ color: '#666' }}>{description}</p>
                )}
            </div>
        </div>
    );
}

// =============================================================================
// SECTION COMPONENT - Glass Theme
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
                <h3 className="text-sm font-medium" style={{ color: '#1a1a1a' }}>{title}</h3>
                {description && (
                    <p className="text-xs mt-0.5" style={{ color: '#666' }}>{description}</p>
                )}
            </div>
            <div className="space-y-1 rounded-lg glass-panel" style={{ padding: '8px' }}>
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
                <div
                    className="p-2 rounded-lg"
                    style={{ background: 'rgba(255,180,140,0.2)' }}
                >
                    <Brain className="w-5 h-5" style={{ color: '#c25a00' }} />
                </div>
                <div>
                    <h2 className="text-lg font-semibold" style={{ color: '#1a1a1a', fontFamily: 'Syne, sans-serif' }}>
                        Autonomous Learning Engine
                    </h2>
                    <p className="text-sm" style={{ color: '#666' }}>
                        Configure how KripTik learns and improves from your builds
                    </p>
                </div>
            </div>

            {/* Status indicator */}
            {status && (
                <div className="flex items-center gap-4 p-3 rounded-lg glass-panel">
                    <div className={`w-2 h-2 rounded-full ${
                        status.isRunning
                            ? 'animate-pulse'
                            : ''
                    }`} style={{
                        background: status.isRunning
                            ? 'linear-gradient(135deg, #c25a00, #d97706)'
                            : 'linear-gradient(135deg, #22c55e, #16a34a)'
                    }} />
                    <div className="flex-1">
                        <span className="text-sm" style={{ color: '#1a1a1a' }}>
                            {status.isRunning ? 'Learning cycle in progress...' : 'Learning system active'}
                        </span>
                        <p className="text-xs" style={{ color: '#666' }}>
                            {status.patternStats.total} patterns • {status.strategyStats.active} strategies • {status.totalCycles} cycles completed
                        </p>
                    </div>
                    {status.overallImprovement > 0 && (
                        <span className="text-sm font-medium" style={{ color: '#16a34a' }}>
                            +{status.overallImprovement}% improvement
                        </span>
                    )}
                </div>
            )}

            {statusError && (
                <div
                    className="flex items-center gap-2 p-3 rounded-lg"
                    style={{
                        background: 'rgba(220, 38, 38, 0.1)',
                        border: '1px solid rgba(220, 38, 38, 0.2)'
                    }}
                >
                    <AlertCircle className="w-4 h-4" style={{ color: '#dc2626' }} />
                    <span className="text-sm" style={{ color: '#dc2626' }}>{statusError}</span>
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

            {/* Info banner */}
            <div
                className="glass-panel p-4 flex items-start gap-3"
                style={{ background: 'rgba(255,180,140,0.1)' }}
            >
                <Brain className="w-5 h-5 mt-0.5" style={{ color: '#c25a00' }} />
                <div>
                    <p className="font-medium text-sm" style={{ color: '#1a1a1a' }}>
                        Learning improves over time
                    </p>
                    <p className="text-xs" style={{ color: '#666' }}>
                        The more you build, the better KripTik understands your preferences and coding patterns.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default LearningSettingsSection;
