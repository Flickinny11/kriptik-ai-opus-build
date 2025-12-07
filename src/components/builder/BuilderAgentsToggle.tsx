/**
 * Builder/Agents/Developer Mode Toggle
 *
 * A toggle button that switches between:
 * - Builder mode: Chat on left, preview on right (autonomous building)
 * - Agents mode: Preview on left, agent sidebar on right (multi-agent orchestration)
 * - Developer mode: Full IDE with model selector (import existing projects)
 */

import { motion } from 'framer-motion';
import { MessageSquare, Bot, Code2 } from 'lucide-react';

export type BuilderMode = 'builder' | 'agents' | 'developer';

interface BuilderAgentsToggleProps {
    mode: BuilderMode;
    onModeChange: (mode: BuilderMode) => void;
}

// Color themes for each mode
const MODE_COLORS = {
    builder: {
        active: '#c25a00',    // Warm orange
        inactive: '#666',
        darkInactive: 'rgba(255,255,255,0.5)',
        gradient: 'linear-gradient(145deg, rgba(255,200,170,0.5) 0%, rgba(255,180,150,0.35) 100%)',
        glow: 'inset 0 0 15px rgba(255, 160, 120, 0.15), 0 0 0 1px rgba(255, 200, 170, 0.3)',
    },
    agents: {
        active: '#c8ff64',    // Lime green
        inactive: '#666',
        darkInactive: 'rgba(255,255,255,0.5)',
        gradient: 'linear-gradient(145deg, rgba(200,255,100,0.2) 0%, rgba(180,240,80,0.15) 100%)',
        glow: 'inset 0 0 10px rgba(200,255,100,0.15), 0 0 0 1px rgba(200,255,100,0.3)',
    },
    developer: {
        active: '#00d4ff',    // Cyan
        inactive: '#666',
        darkInactive: 'rgba(255,255,255,0.5)',
        gradient: 'linear-gradient(145deg, rgba(0,212,255,0.2) 0%, rgba(0,180,220,0.15) 100%)',
        glow: 'inset 0 0 10px rgba(0,212,255,0.15), 0 0 0 1px rgba(0,212,255,0.3)',
    },
};

export function BuilderAgentsToggle({ mode, onModeChange }: BuilderAgentsToggleProps) {
    const isDarkMode = mode === 'agents' || mode === 'developer';
    const activeColors = MODE_COLORS[mode];

    // Calculate slider position based on mode
    const getSliderPosition = () => {
        switch (mode) {
            case 'builder': return 4;
            case 'agents': return 'calc(33.33% + 2px)';
            case 'developer': return 'calc(66.66% + 0px)';
            default: return 4;
        }
    };

    return (
        <div
            className="flex items-center gap-1 p-1 rounded-xl relative"
            style={{
                background: isDarkMode
                    ? 'linear-gradient(145deg, rgba(20,20,25,0.95) 0%, rgba(15,15,20,0.98) 100%)'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)',
                boxShadow: isDarkMode
                    ? 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 12px rgba(0,0,0,0.3)'
                    : 'inset 0 1px 2px rgba(255,255,255,0.8), 0 2px 8px rgba(0,0,0,0.05), 0 0 0 1px rgba(255,255,255,0.35)',
                backdropFilter: 'blur(16px)',
            }}
        >
            {/* Sliding background indicator */}
            <motion.div
                className="absolute rounded-lg"
                initial={false}
                animate={{
                    x: getSliderPosition(),
                    width: 'calc(33.33% - 4px)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                style={{
                    height: 'calc(100% - 8px)',
                    top: 4,
                    background: activeColors.gradient,
                    boxShadow: activeColors.glow,
                }}
            />

            {/* Builder Button */}
            <button
                onClick={() => onModeChange('builder')}
                className="relative z-10 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                    color: mode === 'builder'
                        ? MODE_COLORS.builder.active
                        : isDarkMode ? MODE_COLORS.builder.darkInactive : MODE_COLORS.builder.inactive,
                }}
                title="Builder Mode - Autonomous app building from prompts"
            >
                <MessageSquare className="w-4 h-4" />
                <span>Builder</span>
            </button>

            {/* Agents Button */}
            <button
                onClick={() => onModeChange('agents')}
                className="relative z-10 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                    color: mode === 'agents'
                        ? MODE_COLORS.agents.active
                        : isDarkMode ? MODE_COLORS.agents.darkInactive : MODE_COLORS.agents.inactive,
                }}
                title="Agents Mode - Multi-agent orchestration with model selector"
            >
                <Bot className="w-4 h-4" />
                <span>Agents</span>
            </button>

            {/* Developer Button */}
            <button
                onClick={() => onModeChange('developer')}
                className="relative z-10 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                    color: mode === 'developer'
                        ? MODE_COLORS.developer.active
                        : isDarkMode ? MODE_COLORS.developer.darkInactive : MODE_COLORS.developer.inactive,
                }}
                title="Developer Mode - Import & enhance existing projects"
            >
                <Code2 className="w-4 h-4" />
                <span>Developer</span>
            </button>
        </div>
    );
}

export default BuilderAgentsToggle;
