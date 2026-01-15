/**
 * Tournament Mode Toggle - Enable/disable tournament-based feature building
 *
 * Features:
 * - Toggle button with visual feedback
 * - Cost warning alert when enabled
 * - Integrates with IntelligenceSettings
 * - Liquid Glass styling
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TrophyIcon,
    InfoIcon,
} from '../ui/icons';

interface TournamentModeToggleProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    estimatedCostMultiplier?: number; // Default ~3x for 3 competitors
    disabled?: boolean;
    compact?: boolean;
}

// Cost comparison info
const COST_INFO = {
    normalBuild: 'Uses single AI model for implementation',
    tournamentBuild: 'Runs 3 AI competitors in parallel, AI judges evaluate, selects best',
    typicalMultiplier: 3.5, // 3 builders + judging overhead
};

export function TournamentModeToggle({
    enabled,
    onChange,
    estimatedCostMultiplier = COST_INFO.typicalMultiplier,
    disabled = false,
    compact = false,
}: TournamentModeToggleProps) {
    const [showWarning, setShowWarning] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    // Show warning when user tries to enable
    const handleToggle = () => {
        if (disabled) return;

        if (!enabled) {
            // Show warning before enabling
            setShowWarning(true);
        } else {
            // Disable immediately
            onChange(false);
        }
    };

    const confirmEnable = () => {
        setShowWarning(false);
        onChange(true);
    };

    const cancelEnable = () => {
        setShowWarning(false);
    };

    return (
        <div className="relative">
            {/* Toggle Button */}
            <button
                onClick={handleToggle}
                disabled={disabled}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`
                    relative flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300
                    ${compact ? 'px-2 py-1.5' : ''}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
                style={{
                    background: enabled
                        ? 'linear-gradient(145deg, rgba(251,191,36,0.3) 0%, rgba(245,158,11,0.2) 100%)'
                        : isHovered
                            ? 'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.4) 100%)'
                            : 'linear-gradient(145deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.25) 100%)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: enabled
                        ? '0 4px 16px rgba(251,191,36,0.2), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(251,191,36,0.4)'
                        : isHovered
                            ? '0 6px 20px rgba(0,0,0,0.1), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255,255,255,0.5)'
                            : '0 2px 8px rgba(0,0,0,0.05), inset 0 1px 2px rgba(255,255,255,0.8), 0 0 0 1px rgba(255,255,255,0.3)',
                }}
            >
                {/* 3D Glass Icon Container */}
                <div
                    className="relative flex items-center justify-center"
                    style={{
                        width: compact ? 18 : 22,
                        height: compact ? 18 : 22,
                    }}
                >
                    {/* Glass surface */}
                    <div
                        className="absolute inset-0 rounded-md"
                        style={{
                            background: enabled
                                ? 'linear-gradient(145deg, rgba(251,191,36,0.25) 0%, rgba(245,158,11,0.15) 100%)'
                                : 'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(248,250,252,0.4) 100%)',
                            boxShadow: enabled
                                ? 'inset 0 1px 2px rgba(255,255,255,0.7), inset 0 -1px 1px rgba(0,0,0,0.05), 0 1px 3px rgba(251,191,36,0.2)'
                                : 'inset 0 1px 2px rgba(255,255,255,0.8), inset 0 -1px 1px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.04)',
                            transform: 'perspective(200px) rotateX(2deg)',
                        }}
                    />
                    {/* Icon with gradient stroke */}
                    <svg
                        width={compact ? 12 : 14}
                        height={compact ? 12 : 14}
                        viewBox="0 0 24 24"
                        fill="none"
                        className="relative z-10"
                    >
                        <defs>
                            <linearGradient id={enabled ? 'trophyGradOn' : 'trophyGradOff'} x1="4" y1="3" x2="20" y2="21">
                                <stop offset="0%" stopColor={enabled ? '#f59e0b' : '#78716c'} />
                                <stop offset="100%" stopColor={enabled ? '#d97706' : '#57534e'} />
                            </linearGradient>
                        </defs>
                        <path
                            d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"
                            stroke={`url(#${enabled ? 'trophyGradOn' : 'trophyGradOff'})`}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                        />
                        <path
                            d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"
                            stroke={`url(#${enabled ? 'trophyGradOn' : 'trophyGradOff'})`}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                        />
                        <path
                            d="M4 4h16v5a8 8 0 0 1-16 0V4zM9 21h6M12 17v4"
                            stroke={`url(#${enabled ? 'trophyGradOn' : 'trophyGradOff'})`}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>

                {!compact && (
                    <span
                        className={`text-sm font-medium transition-colors ${enabled ? 'text-amber-700' : 'text-stone-600'}`}
                    >
                        Tournament Mode
                    </span>
                )}

                {/* Toggle indicator */}
                <div
                    className={`
                        w-8 h-4 rounded-full relative transition-all duration-300
                        ${enabled ? 'bg-amber-400' : 'bg-stone-300'}
                    `}
                >
                    <motion.div
                        className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm"
                        animate={{ left: enabled ? 16 : 2 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                </div>

                {/* Active glow effect */}
                {enabled && (
                    <motion.div
                        className="absolute inset-0 rounded-xl pointer-events-none"
                        style={{
                            background: 'radial-gradient(circle at center, rgba(251,191,36,0.1) 0%, transparent 70%)',
                        }}
                        animate={{ opacity: [0.5, 0.8, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    />
                )}
            </button>

            {/* Cost Warning Modal */}
            <AnimatePresence>
                {showWarning && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/30 z-50"
                            onClick={cancelEnable}
                        />

                        {/* Warning Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50"
                        >
                            <div
                                className="rounded-2xl p-6"
                                style={{
                                    background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
                                    backdropFilter: 'blur(40px)',
                                    boxShadow: '0 20px 60px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.9)',
                                }}
                            >
                                {/* Header */}
                                <div className="flex items-center gap-3 mb-4">
                                    <div
                                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                                        style={{
                                            background: 'linear-gradient(145deg, rgba(251,191,36,0.2) 0%, rgba(245,158,11,0.1) 100%)',
                                        }}
                                    >
                                        <TrophyIcon size={24} className="text-amber-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-stone-800">Enable Tournament Mode?</h3>
                                        <p className="text-sm text-stone-500">Higher quality, higher cost</p>
                                    </div>
                                </div>

                                {/* Cost Comparison */}
                                <div className="space-y-3 mb-6">
                                    {/* Normal Build */}
                                    <div
                                        className="p-3 rounded-xl"
                                        style={{
                                            background: 'linear-gradient(145deg, rgba(107,114,128,0.08) 0%, rgba(107,114,128,0.04) 100%)',
                                        }}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-stone-600">Standard Build</span>
                                            <span className="text-sm font-mono text-stone-500">1x cost</span>
                                        </div>
                                        <p className="text-xs text-stone-400">{COST_INFO.normalBuild}</p>
                                    </div>

                                    {/* Tournament Build */}
                                    <div
                                        className="p-3 rounded-xl border-2 border-amber-300"
                                        style={{
                                            background: 'linear-gradient(145deg, rgba(251,191,36,0.12) 0%, rgba(245,158,11,0.06) 100%)',
                                        }}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-amber-700">Tournament Build</span>
                                            <span className="text-sm font-mono font-bold text-amber-600">
                                                ~{estimatedCostMultiplier.toFixed(1)}x cost
                                            </span>
                                        </div>
                                        <p className="text-xs text-amber-600/80">{COST_INFO.tournamentBuild}</p>
                                    </div>
                                </div>

                                {/* Recommendation */}
                                <div
                                    className="flex items-start gap-2 p-3 rounded-xl mb-6"
                                    style={{
                                        background: 'linear-gradient(145deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.04) 100%)',
                                    }}
                                >
                                    <InfoIcon size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-blue-600">
                                        <strong>Best for:</strong> Complex features, critical UI/UX, when quality matters most.
                                        Each competitor builds independently, then AI judges select the best implementation.
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={cancelEnable}
                                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-stone-600 transition-all"
                                        style={{
                                            background: 'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.4) 100%)',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.05), inset 0 1px 2px rgba(255,255,255,0.8)',
                                        }}
                                    >
                                        Keep Standard
                                    </button>
                                    <button
                                        onClick={confirmEnable}
                                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-amber-800 transition-all flex items-center justify-center gap-2"
                                        style={{
                                            background: 'linear-gradient(145deg, rgba(251,191,36,0.4) 0%, rgba(245,158,11,0.3) 100%)',
                                            boxShadow: '0 4px 16px rgba(251,191,36,0.2), inset 0 1px 2px rgba(255,255,255,0.9)',
                                        }}
                                    >
                                        <TrophyIcon size={16} />
                                        Enable Tournament
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

export default TournamentModeToggle;
