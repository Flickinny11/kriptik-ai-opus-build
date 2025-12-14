/**
 * Swarm Mode Selector Component
 *
 * Dropdown selector for 5 intelligent verification swarm modes.
 * Shows recommended mode based on build context.
 * Glass morphism styling matching KripTik design system.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

            <style>{`
                .swarm-mode-selector {
                    position: relative;
                    width: 100%;
                }

                .swarm-mode-trigger {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    background: linear-gradient(
                        145deg,
                        rgba(255, 255, 255, 0.08),
                        rgba(255, 255, 255, 0.03)
                    );
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease-out;
                    text-align: left;
                }

                .swarm-mode-trigger:hover:not(:disabled) {
                    background: linear-gradient(
                        145deg,
                        rgba(255, 255, 255, 0.12),
                        rgba(255, 255, 255, 0.05)
                    );
                    border-color: rgba(255, 255, 255, 0.15);
                }

                .swarm-mode-trigger:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .mode-info {
                    flex: 1;
                }

                .mode-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 2px;
                }

                .mode-name {
                    font-weight: 600;
                    font-size: 14px;
                    color: #ffffff;
                }

                .mode-desc {
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.6);
                }

                .mode-stats {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 2px;
                }

                .stat {
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.5);
                    font-family: 'SF Mono', 'Fira Code', monospace;
                }

                .recommended-badge {
                    padding: 2px 8px;
                    background: linear-gradient(135deg, #f59e0b, #d97706);
                    border-radius: 100px;
                    font-size: 10px;
                    font-weight: 600;
                    color: #000000;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .recommended-badge.small {
                    padding: 1px 6px;
                    font-size: 9px;
                }

                .chevron {
                    color: rgba(255, 255, 255, 0.5);
                    transition: transform 0.2s ease-out;
                }

                .chevron.open {
                    transform: rotate(180deg);
                }

                .swarm-mode-dropdown {
                    position: absolute;
                    top: calc(100% + 8px);
                    left: 0;
                    right: 0;
                    background: linear-gradient(
                        145deg,
                        rgba(30, 30, 40, 0.95),
                        rgba(20, 20, 30, 0.95)
                    );
                    backdrop-filter: blur(40px) saturate(180%);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    overflow: hidden;
                    z-index: 100;
                    box-shadow:
                        0 20px 60px rgba(0, 0, 0, 0.3),
                        0 8px 24px rgba(0, 0, 0, 0.2),
                        inset 0 1px 0 rgba(255, 255, 255, 0.05);
                }

                .mode-option {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: all 0.15s ease-out;
                    text-align: left;
                }

                .mode-option:hover {
                    background: rgba(255, 255, 255, 0.05);
                }

                .mode-option.selected {
                    background: rgba(245, 158, 11, 0.1);
                }

                .mode-option:not(:last-child) {
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }

                .option-content {
                    flex: 1;
                }

                .option-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 4px;
                }

                .option-name {
                    font-weight: 600;
                    font-size: 14px;
                    color: #ffffff;
                }

                .option-desc {
                    display: block;
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.6);
                    margin-bottom: 6px;
                }

                .option-meta {
                    display: flex;
                    gap: 12px;
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.4);
                    font-family: 'SF Mono', 'Fira Code', monospace;
                }

                .check-icon {
                    color: #f59e0b;
                    flex-shrink: 0;
                }
            `}</style>
        </div>
    );
}

export default SwarmModeSelector;
