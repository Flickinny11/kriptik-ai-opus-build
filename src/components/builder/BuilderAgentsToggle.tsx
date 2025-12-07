/**
 * Builder/Agents Mode Toggle
 *
 * A toggle button that switches between Builder mode (chat on left, preview on right)
 * and Agents mode (preview on left, agent sidebar on right with dark theme).
 */

import { motion } from 'framer-motion';
import { MessageSquare, Bot } from 'lucide-react';

interface BuilderAgentsToggleProps {
    mode: 'builder' | 'agents';
    onModeChange: (mode: 'builder' | 'agents') => void;
}

export function BuilderAgentsToggle({ mode, onModeChange }: BuilderAgentsToggleProps) {
    return (
        <div className="flex items-center gap-1 p-1 rounded-xl relative"
            style={{
                background: mode === 'agents'
                    ? 'linear-gradient(145deg, rgba(20,20,25,0.95) 0%, rgba(15,15,20,0.98) 100%)'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)',
                boxShadow: mode === 'agents'
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
                    x: mode === 'builder' ? 4 : '50%',
                    width: 'calc(50% - 4px)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                style={{
                    height: 'calc(100% - 8px)',
                    top: 4,
                    background: mode === 'agents'
                        ? 'linear-gradient(145deg, rgba(200,255,100,0.2) 0%, rgba(180,240,80,0.15) 100%)'
                        : 'linear-gradient(145deg, rgba(255,200,170,0.5) 0%, rgba(255,180,150,0.35) 100%)',
                    boxShadow: mode === 'agents'
                        ? 'inset 0 0 10px rgba(200,255,100,0.15), 0 0 0 1px rgba(200,255,100,0.3)'
                        : 'inset 0 0 15px rgba(255, 160, 120, 0.15), 0 0 0 1px rgba(255, 200, 170, 0.3)',
                }}
            />

            {/* Builder Button */}
            <button
                onClick={() => onModeChange('builder')}
                className="relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                    color: mode === 'builder'
                        ? '#c25a00'
                        : mode === 'agents' ? 'rgba(255,255,255,0.5)' : '#666',
                }}
            >
                <MessageSquare className="w-4 h-4" />
                <span>Builder</span>
            </button>

            {/* Agents Button */}
            <button
                onClick={() => onModeChange('agents')}
                className="relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                    color: mode === 'agents'
                        ? '#c8ff64'
                        : mode === 'builder' ? 'rgba(255,255,255,0.5)' : '#666',
                }}
            >
                <Bot className="w-4 h-4" />
                <span>Agents</span>
            </button>
        </div>
    );
}

export default BuilderAgentsToggle;

