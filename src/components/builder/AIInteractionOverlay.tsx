/**
 * AI Interaction Overlay
 *
 * Visual overlay for the live preview window that shows AI agent activity.
 * Displays cursor position, current file being edited, agent status,
 * and pulse animations on modified elements.
 *
 * Uses custom SVG icons - NO lucide-react, NO emojis.
 * Neon/glow effects with cyan (#00d4ff) accent color.
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// =============================================================================
// TYPES
// =============================================================================

export type AgentPhase = 'idle' | 'thinking' | 'coding' | 'testing' | 'building' | 'verifying' | 'complete' | 'error';

export interface AgentEvent {
    type: 'file_read' | 'file_write' | 'verification' | 'build_start' | 'build_complete' | 'cursor_move' | 'status_change';
    timestamp: number;
    data?: {
        filePath?: string;
        cursorX?: number;
        cursorY?: number;
        status?: AgentPhase;
        message?: string;
        success?: boolean;
    };
}

export interface AIInteractionOverlayProps {
    isActive: boolean;
    agentPhase: AgentPhase;
    currentFile?: string;
    cursorPosition?: { x: number; y: number };
    onEvent?: (event: AgentEvent) => void;
    showCursor?: boolean;
    showStatus?: boolean;
    showFileIndicator?: boolean;
}

// =============================================================================
// CUSTOM SVG ICONS
// =============================================================================

function IconCursor() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
                d="M5 3l12 9-5 1.5-2 5.5L5 3z"
                fill="#00d4ff"
                stroke="#00d4ff"
                strokeWidth="1.5"
                strokeLinejoin="round"
            />
            <path
                d="M5 3l12 9-5 1.5-2 5.5L5 3z"
                fill="url(#cursorGlow)"
                opacity="0.6"
            />
            <defs>
                <radialGradient id="cursorGlow" cx="0.5" cy="0.5" r="0.5">
                    <stop offset="0%" stopColor="#00d4ff" stopOpacity="1" />
                    <stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
                </radialGradient>
            </defs>
        </svg>
    );
}

function IconThinking() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="4" cy="8" r="1.5" fill="currentColor">
                <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
            </circle>
            <circle cx="8" cy="8" r="1.5" fill="currentColor">
                <animate attributeName="opacity" values="1;0.3;1" dur="1s" begin="0.2s" repeatCount="indefinite" />
            </circle>
            <circle cx="12" cy="8" r="1.5" fill="currentColor">
                <animate attributeName="opacity" values="1;0.3;1" dur="1s" begin="0.4s" repeatCount="indefinite" />
            </circle>
        </svg>
    );
}

function IconCoding() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M5 4L1 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 2l-2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function IconTesting() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 2h4v3l2 3v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8l2-3V2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx="8" cy="11" r="1.5" fill="currentColor">
                <animate attributeName="r" values="1.5;2;1.5" dur="0.8s" repeatCount="indefinite" />
            </circle>
        </svg>
    );
}

function IconBuilding() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="8" width="4" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
            <rect x="6" y="4" width="4" height="10" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
            <rect x="10" y="6" width="4" height="8" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4 8V2l4 2v4" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        </svg>
    );
}

function IconVerifying() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2">
                <animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="2s" repeatCount="indefinite" />
            </circle>
            <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconComplete() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" fill="#22c55e" opacity="0.2" />
            <circle cx="8" cy="8" r="6" stroke="#22c55e" strokeWidth="1.5" />
            <path d="M5 8l2 2 4-4" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconError() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" fill="#ef4444" opacity="0.2" />
            <circle cx="8" cy="8" r="6" stroke="#ef4444" strokeWidth="1.5" />
            <path d="M6 6l4 4M10 6l-4 4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function IconFile() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 1h5l3 3v8a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 1v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
    );
}

// =============================================================================
// PHASE ICON MAPPING
// =============================================================================

const PHASE_ICONS: Record<AgentPhase, React.ComponentType> = {
    idle: IconThinking,
    thinking: IconThinking,
    coding: IconCoding,
    testing: IconTesting,
    building: IconBuilding,
    verifying: IconVerifying,
    complete: IconComplete,
    error: IconError,
};

const PHASE_LABELS: Record<AgentPhase, string> = {
    idle: 'Idle',
    thinking: 'Thinking...',
    coding: 'Writing Code',
    testing: 'Running Tests',
    building: 'Building',
    verifying: 'Verifying',
    complete: 'Complete',
    error: 'Error',
};

const PHASE_COLORS: Record<AgentPhase, string> = {
    idle: 'rgba(255, 255, 255, 0.5)',
    thinking: '#00d4ff',
    coding: '#00d4ff',
    testing: '#fbbf24',
    building: '#a855f7',
    verifying: '#22d3ee',
    complete: '#22c55e',
    error: '#ef4444',
};

// =============================================================================
// PULSE EFFECT COMPONENT
// =============================================================================

const PulseEffect = memo(function PulseEffect({
    x,
    y,
    color = '#00d4ff',
    onComplete,
}: {
    x: number;
    y: number;
    color?: string;
    onComplete?: () => void;
}) {
    return (
        <motion.div
            className="ai-overlay__pulse"
            style={{
                left: x,
                top: y,
                '--pulse-color': color,
            } as React.CSSProperties}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            onAnimationComplete={onComplete}
        />
    );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const AIInteractionOverlay = memo(function AIInteractionOverlay({
    isActive,
    agentPhase,
    currentFile,
    cursorPosition,
    showCursor = true,
    showStatus = true,
    showFileIndicator = true,
}: AIInteractionOverlayProps) {
    const [pulses, setPulses] = useState<Array<{ id: string; x: number; y: number; color: string }>>([]);
    const [cursorTrail, setCursorTrail] = useState<Array<{ x: number; y: number; id: string }>>([]);
    const lastCursorRef = useRef<{ x: number; y: number } | null>(null);

    // Update cursor trail
    useEffect(() => {
        if (!cursorPosition || !showCursor || !isActive) return;

        const now = Date.now();
        const newTrailPoint = {
            x: cursorPosition.x,
            y: cursorPosition.y,
            id: `trail-${now}`,
        };

        setCursorTrail(prev => {
            const updated = [...prev, newTrailPoint].slice(-8); // Keep last 8 points
            return updated;
        });

        lastCursorRef.current = cursorPosition;

        // Clean up old trail points
        const cleanup = setTimeout(() => {
            setCursorTrail(prev => prev.filter(p => p.id !== newTrailPoint.id));
        }, 300);

        return () => clearTimeout(cleanup);
    }, [cursorPosition, showCursor, isActive]);

    // Add pulse effect
    const addPulse = useCallback((x: number, y: number, color: string = '#00d4ff') => {
        const id = `pulse-${Date.now()}-${Math.random()}`;
        setPulses(prev => [...prev, { id, x, y, color }]);
    }, []);

    // Remove pulse effect
    const removePulse = useCallback((id: string) => {
        setPulses(prev => prev.filter(p => p.id !== id));
    }, []);

    // Add pulse on phase changes
    useEffect(() => {
        if (!isActive) return;

        if (agentPhase === 'coding' && cursorPosition) {
            addPulse(cursorPosition.x, cursorPosition.y, '#00d4ff');
        } else if (agentPhase === 'complete') {
            // Success animation - multiple pulses
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    addPulse(
                        Math.random() * 200 + 100,
                        Math.random() * 200 + 100,
                        '#22c55e'
                    );
                }, i * 150);
            }
        }
    }, [agentPhase, isActive, cursorPosition, addPulse]);

    const PhaseIcon = PHASE_ICONS[agentPhase];

    if (!isActive) return null;

    return (
        <div className="ai-overlay" style={{ pointerEvents: 'none' }}>
            {/* Status Badge */}
            <AnimatePresence>
                {showStatus && (
                    <motion.div
                        className="ai-overlay__status"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        style={{
                            '--status-color': PHASE_COLORS[agentPhase],
                        } as React.CSSProperties}
                    >
                        <div className="ai-overlay__status-icon">
                            <PhaseIcon />
                        </div>
                        <span className="ai-overlay__status-label">
                            {PHASE_LABELS[agentPhase]}
                        </span>
                        {agentPhase !== 'idle' && agentPhase !== 'complete' && agentPhase !== 'error' && (
                            <div className="ai-overlay__status-spinner" />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* File Indicator */}
            <AnimatePresence>
                {showFileIndicator && currentFile && (
                    <motion.div
                        className="ai-overlay__file"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                    >
                        <IconFile />
                        <span className="ai-overlay__file-name">
                            {currentFile.split('/').pop()}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cursor Trail */}
            {showCursor && (
                <svg className="ai-overlay__trail-svg" width="100%" height="100%">
                    <defs>
                        <linearGradient id="trailGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#00d4ff" stopOpacity="0" />
                            <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.8" />
                        </linearGradient>
                    </defs>
                    {cursorTrail.length > 1 && (
                        <motion.path
                            d={`M ${cursorTrail.map(p => `${p.x} ${p.y}`).join(' L ')}`}
                            fill="none"
                            stroke="url(#trailGradient)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.2 }}
                        />
                    )}
                </svg>
            )}

            {/* AI Cursor */}
            <AnimatePresence>
                {showCursor && cursorPosition && (
                    <motion.div
                        className="ai-overlay__cursor"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{
                            x: cursorPosition.x - 12,
                            y: cursorPosition.y - 12,
                            scale: 1,
                            opacity: 1,
                        }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{
                            type: 'spring',
                            stiffness: 400,
                            damping: 30,
                        }}
                    >
                        <IconCursor />
                        <div className="ai-overlay__cursor-glow" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Pulse Effects */}
            <AnimatePresence>
                {pulses.map(pulse => (
                    <PulseEffect
                        key={pulse.id}
                        x={pulse.x}
                        y={pulse.y}
                        color={pulse.color}
                        onComplete={() => removePulse(pulse.id)}
                    />
                ))}
            </AnimatePresence>

            {/* Verification Spinner Overlay */}
            <AnimatePresence>
                {agentPhase === 'verifying' && (
                    <motion.div
                        className="ai-overlay__verifying"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="ai-overlay__verifying-spinner">
                            <IconVerifying />
                        </div>
                        <span>Verifying changes...</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Build Complete Animation */}
            <AnimatePresence>
                {agentPhase === 'complete' && (
                    <motion.div
                        className="ai-overlay__complete"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                    >
                        <div className="ai-overlay__complete-icon">
                            <IconComplete />
                        </div>
                        <span>Build Complete</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Styles */}
            <style>{`
                .ai-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    overflow: hidden;
                    z-index: 100;
                }

                .ai-overlay__status {
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    background: rgba(10, 10, 20, 0.85);
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(0, 212, 255, 0.2);
                    border-radius: 8px;
                    color: var(--status-color, #00d4ff);
                    font-size: 12px;
                    font-weight: 500;
                    box-shadow: 0 0 20px rgba(0, 212, 255, 0.15);
                }

                .ai-overlay__status-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 20px;
                    height: 20px;
                }

                .ai-overlay__status-label {
                    color: rgba(255, 255, 255, 0.9);
                }

                .ai-overlay__status-spinner {
                    width: 12px;
                    height: 12px;
                    border: 2px solid transparent;
                    border-top-color: var(--status-color, #00d4ff);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .ai-overlay__file {
                    position: absolute;
                    bottom: 12px;
                    left: 12px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 10px;
                    background: rgba(10, 10, 20, 0.85);
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(0, 212, 255, 0.15);
                    border-radius: 6px;
                    color: #00d4ff;
                    font-size: 11px;
                    font-family: 'SF Mono', Monaco, monospace;
                }

                .ai-overlay__file-name {
                    color: rgba(255, 255, 255, 0.8);
                    max-width: 150px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .ai-overlay__trail-svg {
                    position: absolute;
                    top: 0;
                    left: 0;
                    pointer-events: none;
                }

                .ai-overlay__cursor {
                    position: absolute;
                    width: 24px;
                    height: 24px;
                    filter: drop-shadow(0 0 8px rgba(0, 212, 255, 0.8));
                }

                .ai-overlay__cursor-glow {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 24px;
                    height: 24px;
                    background: radial-gradient(circle, rgba(0, 212, 255, 0.4) 0%, transparent 70%);
                    animation: cursorGlow 1.5s ease-in-out infinite;
                }

                @keyframes cursorGlow {
                    0%, 100% { transform: scale(1); opacity: 0.5; }
                    50% { transform: scale(1.5); opacity: 0.8; }
                }

                .ai-overlay__pulse {
                    position: absolute;
                    width: 20px;
                    height: 20px;
                    margin-left: -10px;
                    margin-top: -10px;
                    border-radius: 50%;
                    background: radial-gradient(circle, var(--pulse-color, #00d4ff) 0%, transparent 70%);
                    pointer-events: none;
                }

                .ai-overlay__verifying {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    padding: 20px 30px;
                    background: rgba(10, 10, 20, 0.9);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(34, 211, 238, 0.3);
                    border-radius: 12px;
                    color: #22d3ee;
                    font-size: 14px;
                    box-shadow: 0 0 40px rgba(34, 211, 238, 0.2);
                }

                .ai-overlay__verifying-spinner {
                    width: 32px;
                    height: 32px;
                    animation: spin 2s linear infinite;
                }

                .ai-overlay__verifying-spinner svg {
                    width: 100%;
                    height: 100%;
                }

                .ai-overlay__complete {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    padding: 20px 30px;
                    background: rgba(10, 30, 20, 0.9);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(34, 197, 94, 0.3);
                    border-radius: 12px;
                    color: #22c55e;
                    font-size: 14px;
                    font-weight: 600;
                    box-shadow: 0 0 40px rgba(34, 197, 94, 0.2);
                }

                .ai-overlay__complete-icon {
                    width: 48px;
                    height: 48px;
                }

                .ai-overlay__complete-icon svg {
                    width: 100%;
                    height: 100%;
                }
            `}</style>
        </div>
    );
});

export default AIInteractionOverlay;
