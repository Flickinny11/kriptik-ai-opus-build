/**
 * Swarm Mode Selector Component
 *
 * Dropdown selector for 5 intelligent verification swarm modes.
 * Shows recommended mode based on build context.
 * Glass morphism styling matching KripTik design system.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './SwarmModeSelector.css';

export type SwarmMode = 'lightning' | 'standard' | 'thorough' | 'production' | 'paranoid';

export interface SwarmModeConfig {
    id: SwarmMode;
    name: string;
    description: string;
    maxFilesPerAgent: number;
    maxElementsToTest: number;
    estimatedDurationSec: number;
    creditCost: number;
    recommended: boolean;
    agentsEnabled: string[];
}

const SWARM_MODES: SwarmModeConfig[] = [
    {
        id: 'lightning',
        name: 'Lightning',
        description: 'Quick scan for critical issues only. Best for rapid iterations.',
        maxFilesPerAgent: 10,
        maxElementsToTest: 5,
        estimatedDurationSec: 15,
        creditCost: 2,
        recommended: false,
        agentsEnabled: ['error_checker', 'placeholder_eliminator'],
    },
    {
        id: 'standard',
        name: 'Standard',
        description: 'Balanced verification for everyday development.',
        maxFilesPerAgent: 25,
        maxElementsToTest: 15,
        estimatedDurationSec: 45,
        creditCost: 8,
        recommended: false,
        agentsEnabled: ['error_checker', 'placeholder_eliminator', 'code_quality', 'security_scanner'],
    },
    {
        id: 'thorough',
        name: 'Thorough',
        description: 'Comprehensive analysis including visual verification.',
        maxFilesPerAgent: 50,
        maxElementsToTest: 30,
        estimatedDurationSec: 120,
        creditCost: 25,
        recommended: true,
        agentsEnabled: ['error_checker', 'placeholder_eliminator', 'code_quality', 'security_scanner', 'visual_verifier', 'design_style'],
    },
    {
        id: 'production',
        name: 'Production',
        description: 'Full enterprise-grade verification before deployment.',
        maxFilesPerAgent: 100,
        maxElementsToTest: 50,
        estimatedDurationSec: 300,
        creditCost: 50,
        recommended: false,
        agentsEnabled: ['error_checker', 'placeholder_eliminator', 'code_quality', 'security_scanner', 'visual_verifier', 'design_style'],
    },
    {
        id: 'paranoid',
        name: 'Paranoid',
        description: 'Maximum depth analysis. Checks EVERYTHING. No limits.',
        maxFilesPerAgent: Infinity,
        maxElementsToTest: Infinity,
        estimatedDurationSec: 600,
        creditCost: 100,
        recommended: false,
        agentsEnabled: ['error_checker', 'placeholder_eliminator', 'code_quality', 'security_scanner', 'visual_verifier', 'design_style'],
    },
];

interface SwarmModeSelectorProps {
    selectedMode: SwarmMode;
    onModeChange: (mode: SwarmMode) => void;
    recommendedMode?: SwarmMode;
    disabled?: boolean;
}

export function SwarmModeSelector({
    selectedMode,
    onModeChange,
    recommendedMode,
    disabled = false,
}: SwarmModeSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);

    const currentMode = useMemo(
        () => SWARM_MODES.find((m) => m.id === selectedMode) || SWARM_MODES[2],
        [selectedMode]
    );

    const formatDuration = (seconds: number): string => {
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        return `${Math.floor(seconds / 3600)}h`;
    };

    return (
        <div className="swarm-mode-selector">
            <button
                className="swarm-mode-trigger"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
            >
                <div className="mode-info">
                    <div className="mode-header">
                        <span className="mode-name">{currentMode.name}</span>
                        {recommendedMode === currentMode.id && (
                            <span className="recommended-badge">Recommended</span>
                        )}
                    </div>
                    <span className="mode-desc">{currentMode.description}</span>
                </div>
                <div className="mode-stats">
                    <span className="stat">{formatDuration(currentMode.estimatedDurationSec)}</span>
                    <span className="stat">{currentMode.creditCost} credits</span>
                </div>
                <svg
                    className={`chevron ${isOpen ? 'open' : ''}`}
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                >
                    <path
                        d="M4 6L8 10L12 6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="swarm-mode-dropdown"
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    >
                        {SWARM_MODES.map((mode) => (
                            <button
                                key={mode.id}
                                className={`mode-option ${selectedMode === mode.id ? 'selected' : ''}`}
                                onClick={() => {
                                    onModeChange(mode.id);
                                    setIsOpen(false);
                                }}
                            >
                                <div className="option-content">
                                    <div className="option-header">
                                        <span className="option-name">{mode.name}</span>
                                        {recommendedMode === mode.id && (
                                            <span className="recommended-badge small">Recommended</span>
                                        )}
                                    </div>
                                    <span className="option-desc">{mode.description}</span>
                                    <div className="option-meta">
                                        <span>{mode.agentsEnabled.length} agents</span>
                                        <span>{formatDuration(mode.estimatedDurationSec)}</span>
                                        <span>{mode.creditCost} credits</span>
                                    </div>
                                </div>
                                {selectedMode === mode.id && (
                                    <svg
                                        className="check-icon"
                                        width="16"
                                        height="16"
                                        viewBox="0 0 16 16"
                                        fill="none"
                                    >
                                        <path
                                            d="M3 8L6.5 11.5L13 5"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default SwarmModeSelector;
