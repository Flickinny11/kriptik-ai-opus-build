/**
 * Intent Preview
 *
 * Visual preview of extracted intent before building.
 */

import { motion } from 'framer-motion';
import {
    LayersIcon as Layers,
    PaletteIcon as Palette,
    SettingsIcon as Settings,
    HelpCircleIcon as HelpCircle,
    ChevronRightIcon as ChevronRight,
    SparklesIcon as Sparkles,
    CodeIcon as Code,
    AlertTriangleIcon as AlertTriangle,
} from '../ui/icons';

const accentColor = '#c8ff64';

interface FeatureRequest {
    name: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    complexity?: 'simple' | 'moderate' | 'complex';
}

interface DesignPreference {
    category: 'color' | 'layout' | 'typography' | 'style' | 'animation';
    preference: string;
    specificity: 'explicit' | 'implied';
}

interface Ambiguity {
    id: string;
    topic: string;
    question: string;
    options?: string[];
    importance: 'blocking' | 'helpful' | 'optional';
}

interface ExtractedIntent {
    appType: string;
    appName?: string;
    description: string;
    features: FeatureRequest[];
    designPreferences: DesignPreference[];
    technicalRequirements: string[];
    ambiguities: Ambiguity[];
    confidence: number;
}

interface IntentPreviewProps {
    intent: ExtractedIntent;
    onStartBuild?: () => void;
    onClarify?: (ambiguity: Ambiguity) => void;
    className?: string;
}

export function IntentPreview({
    intent,
    onStartBuild,
    onClarify,
    className = '',
}: IntentPreviewProps) {
    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return '#ef4444';
            case 'medium': return '#f59e0b';
            case 'low': return '#6b7280';
            default: return '#6b7280';
        }
    };

    const getComplexityIcon = (complexity?: string) => {
        switch (complexity) {
            case 'simple': return '●';
            case 'moderate': return '●●';
            case 'complex': return '●●●';
            default: return '●';
        }
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'color': return '🎨';
            case 'layout': return '📐';
            case 'typography': return '🔤';
            case 'style': return '✨';
            case 'animation': return '🎬';
            default: return '🎯';
        }
    };

    const hasBlockingAmbiguities = intent.ambiguities.some(a => a.importance === 'blocking');
    const canBuild = intent.confidence >= 50 && !hasBlockingAmbiguities;

    return (
        <div className={`flex flex-col gap-4 ${className}`}>
            {/* Header */}
            <div
                className="p-4 rounded-xl border"
                style={{
                    background: `linear-gradient(135deg, ${accentColor}15 0%, transparent 50%)`,
                    borderColor: `${accentColor}30`,
                }}
            >
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles size={20} style={{ color: accentColor }} />
                            <span className="text-xs text-white/50 uppercase tracking-wide">
                                Extracted Intent
                            </span>
                        </div>
                        <h2 className="text-xl font-semibold text-white">
                            {intent.appName || intent.appType}
                        </h2>
                        <p className="text-sm text-white/60 mt-1">
                            {intent.description}
                        </p>
                    </div>

                    {/* Confidence meter */}
                    <div className="flex flex-col items-end">
                        <span className="text-xs text-white/50 mb-1">Confidence</span>
                        <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${intent.confidence}%` }}
                                    transition={{ duration: 0.5 }}
                                    className="h-full rounded-full"
                                    style={{
                                        background: intent.confidence >= 70
                                            ? accentColor
                                            : intent.confidence >= 50
                                                ? '#f59e0b'
                                                : '#ef4444',
                                    }}
                                />
                            </div>
                            <span className="text-sm font-mono text-white">
                                {intent.confidence}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Blocking Ambiguities Warning */}
            {hasBlockingAmbiguities && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-lg border border-orange-500/30 bg-orange-500/10"
                >
                    <div className="flex items-start gap-3">
                        <AlertTriangle size={20} className="text-orange-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-medium text-orange-400">
                                Clarification needed
                            </h4>
                            <p className="text-xs text-white/60 mt-1">
                                Some details need clarification before building.
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Features */}
            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-3">
                    <Layers size={16} className="text-white/60" />
                    <h3 className="text-sm font-medium text-white">Features</h3>
                    <span className="text-xs text-white/40">({intent.features.length})</span>
                </div>

                <div className="space-y-2">
                    {intent.features.map((feature, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
                        >
                            <div
                                className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                                style={{ background: getPriorityColor(feature.priority) }}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-white font-medium">
                                        {feature.name}
                                    </span>
                                    <span className="text-[10px] text-white/30 tracking-wider">
                                        {getComplexityIcon(feature.complexity)}
                                    </span>
                                </div>
                                <p className="text-xs text-white/50 mt-0.5">
                                    {feature.description}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Design Preferences */}
            {intent.designPreferences.length > 0 && (
                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                    <div className="flex items-center gap-2 mb-3">
                        <Palette size={16} className="text-white/60" />
                        <h3 className="text-sm font-medium text-white">Design Preferences</h3>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {intent.designPreferences.map((pref, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.05 }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
                                style={{
                                    borderColor: pref.specificity === 'explicit'
                                        ? `${accentColor}50`
                                        : 'rgba(255,255,255,0.1)',
                                    background: pref.specificity === 'explicit'
                                        ? `${accentColor}10`
                                        : 'rgba(255,255,255,0.03)',
                                }}
                            >
                                <span>{getCategoryIcon(pref.category)}</span>
                                <span className="text-xs text-white/80">{pref.preference}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* Technical Requirements */}
            {intent.technicalRequirements.length > 0 && (
                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                    <div className="flex items-center gap-2 mb-3">
                        <Settings size={16} className="text-white/60" />
                        <h3 className="text-sm font-medium text-white">Technical Requirements</h3>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {intent.technicalRequirements.map((req, index) => (
                            <span
                                key={index}
                                className="px-2 py-1 rounded text-xs bg-white/5 text-white/70 border border-white/10"
                            >
                                {req}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Ambiguities */}
            {intent.ambiguities.length > 0 && (
                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                    <div className="flex items-center gap-2 mb-3">
                        <HelpCircle size={16} className="text-white/60" />
                        <h3 className="text-sm font-medium text-white">Questions</h3>
                    </div>

                    <div className="space-y-2">
                        {intent.ambiguities.map((ambiguity, index) => (
                            <motion.button
                                key={ambiguity.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => onClarify?.(ambiguity)}
                                className="w-full flex items-center gap-3 p-3 rounded-lg border transition-all hover:bg-white/5 group text-left"
                                style={{
                                    borderColor: ambiguity.importance === 'blocking'
                                        ? 'rgba(239, 68, 68, 0.3)'
                                        : 'rgba(255,255,255,0.1)',
                                    background: ambiguity.importance === 'blocking'
                                        ? 'rgba(239, 68, 68, 0.05)'
                                        : 'transparent',
                                }}
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-white">{ambiguity.topic}</span>
                                        {ambiguity.importance === 'blocking' && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                                                Required
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-white/50 mt-0.5">
                                        {ambiguity.question}
                                    </p>
                                </div>
                                <ChevronRight size={16} className="text-white/30 group-hover:text-white/60 transition-colors" />
                            </motion.button>
                        ))}
                    </div>
                </div>
            )}

            {/* Build Button */}
            <motion.button
                onClick={onStartBuild}
                disabled={!canBuild}
                whileHover={canBuild ? { scale: 1.02 } : {}}
                whileTap={canBuild ? { scale: 0.98 } : {}}
                className={`w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                    canBuild
                        ? 'cursor-pointer'
                        : 'cursor-not-allowed opacity-50'
                }`}
                style={{
                    background: canBuild
                        ? `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)`
                        : 'rgba(255,255,255,0.1)',
                    color: canBuild ? 'black' : 'rgba(255,255,255,0.4)',
                    boxShadow: canBuild ? `0 10px 30px ${accentColor}40` : 'none',
                }}
            >
                <Code size={20} />
                {canBuild ? 'Start Building' : 'Resolve questions to continue'}
            </motion.button>
        </div>
    );
}

