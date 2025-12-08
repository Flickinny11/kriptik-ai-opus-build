/**
 * Persona Card Component
 *
 * Display a user persona with behavior characteristics.
 */

import { motion } from 'framer-motion';
import {
    User, Zap, Search, Target, Bug, Keyboard, Eye, Gauge
} from 'lucide-react';

const accentColor = '#c8ff64';

// Behavior gradients and icons
const BEHAVIOR_CONFIG: Record<string, {
    gradient: string;
    icon: React.ComponentType<{ className?: string; color?: string }>;
    color: string;
}> = {
    'careful': {
        gradient: 'linear-gradient(145deg, #3b82f6 0%, #1d4ed8 100%)',
        icon: Eye,
        color: '#60a5fa',
    },
    'impatient': {
        gradient: 'linear-gradient(145deg, #f59e0b 0%, #d97706 100%)',
        icon: Zap,
        color: '#fbbf24',
    },
    'explorer': {
        gradient: 'linear-gradient(145deg, #8b5cf6 0%, #6d28d9 100%)',
        icon: Search,
        color: '#a78bfa',
    },
    'goal-oriented': {
        gradient: 'linear-gradient(145deg, #10b981 0%, #059669 100%)',
        icon: Target,
        color: '#34d399',
    },
    'edge-case-finder': {
        gradient: 'linear-gradient(145deg, #ef4444 0%, #dc2626 100%)',
        icon: Bug,
        color: '#f87171',
    },
};

const TECH_LEVEL_ICONS: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
    'novice': { icon: User, label: 'Novice' },
    'intermediate': { icon: Gauge, label: 'Intermediate' },
    'power-user': { icon: Keyboard, label: 'Power User' },
};

interface Persona {
    id: string;
    name: string;
    behavior: string;
    techLevel: string;
    accessibilityNeeds?: string[];
    goalPatterns?: string[];
    avatar?: string;
    isCustom?: boolean;
}

interface PersonaCardProps {
    persona: Persona;
    selected: boolean;
    onClick: () => void;
    showDetails?: boolean;
}

export function PersonaCard({
    persona,
    selected,
    onClick,
    showDetails = false
}: PersonaCardProps) {
    const config = BEHAVIOR_CONFIG[persona.behavior] || BEHAVIOR_CONFIG['careful'];
    const techConfig = TECH_LEVEL_ICONS[persona.techLevel] || TECH_LEVEL_ICONS['intermediate'];
    const BehaviorIcon = config.icon;
    const TechIcon = techConfig.icon;

    return (
        <motion.button
            onClick={onClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`relative p-4 rounded-xl text-left transition-all ${
                selected ? 'ring-2' : ''
            }`}
            style={{
                background: selected
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(255,255,255,0.03)',
                border: selected
                    ? `1px solid ${accentColor}40`
                    : '1px solid rgba(255,255,255,0.1)',
            }}
        >
            {/* Selection indicator */}
            {selected && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: accentColor }}
                >
                    <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                </motion.div>
            )}

            {/* Avatar / Behavior Icon */}
            <div className="flex items-center gap-3 mb-3">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ background: config.gradient }}
                >
                    {persona.avatar || <BehaviorIcon className="w-5 h-5 text-white" />}
                </div>
                <div>
                    <div className="font-medium text-white">{persona.name}</div>
                    <div
                        className="text-xs capitalize"
                        style={{ color: config.color }}
                    >
                        {persona.behavior.replace('-', ' ')}
                    </div>
                </div>
            </div>

            {/* Tech Level */}
            <div className="flex items-center gap-2 mb-2">
                <TechIcon className="w-3 h-3 text-white/40" />
                <span className="text-xs text-white/50">{techConfig.label}</span>
            </div>

            {/* Accessibility Needs */}
            {persona.accessibilityNeeds && persona.accessibilityNeeds.length > 0 && (
                <div className="flex gap-1 flex-wrap mb-2">
                    {persona.accessibilityNeeds.map(need => (
                        <span
                            key={need}
                            className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-400"
                        >
                            {need}
                        </span>
                    ))}
                </div>
            )}

            {/* Goal Patterns (if showing details) */}
            {showDetails && persona.goalPatterns && persona.goalPatterns.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/5">
                    <div className="text-[10px] text-white/30 mb-1">Goals:</div>
                    <div className="text-xs text-white/50">
                        {persona.goalPatterns.join(', ')}
                    </div>
                </div>
            )}

            {/* Custom badge */}
            {persona.isCustom && (
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-400">
                    Custom
                </div>
            )}
        </motion.button>
    );
}

