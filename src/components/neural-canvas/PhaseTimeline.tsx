/**
 * PhaseTimeline - Build progress visualization component
 *
 * A vertical timeline displaying build phases with connected nodes.
 * Uses Framer Motion for animations and neural-canvas.css for styling.
 *
 * Features:
 * - Vertical timeline with connected nodes
 * - Each phase shows: icon, name, description, status, duration
 * - Visual states: pending, active, complete, error
 * - Active phase has animated glow effect
 * - Connection line between phases shows progress
 *
 * NO emojis, NO Lucide icons - uses NeuralIcon components only.
 */

import React from 'react';
import { motion, AnimatePresence, Easing } from 'framer-motion';
import { NeuralIcon, NeuralIconName } from './icons/NeuralIcons';
import '../../styles/neural-canvas.css';

// Cubic bezier easing for smooth animations
const smoothEase: Easing = [0.25, 0.46, 0.45, 0.94];

/**
 * Phase status types
 */
export type PhaseStatus = 'pending' | 'active' | 'complete' | 'error';

/**
 * Phase information interface
 */
export interface PhaseInfo {
    id: string;
    name: string;
    description?: string;
    status: PhaseStatus;
    duration?: number; // Duration in seconds
    iconName?: NeuralIconName;
}

/**
 * PhaseTimeline component props
 */
export interface PhaseTimelineProps {
    phases: PhaseInfo[];
    currentPhaseId?: string;
    totalProgress?: number; // 0-100
    className?: string;
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds?: number): string {
    if (seconds === undefined || seconds < 0) return '';

    if (seconds < 60) {
        return `${Math.round(seconds)}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);

    if (minutes < 60) {
        return remainingSeconds > 0
            ? `${minutes}m ${remainingSeconds}s`
            : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return remainingMinutes > 0
        ? `${hours}h ${remainingMinutes}m`
        : `${hours}h`;
}

/**
 * Get default icon name based on phase name
 */
function getDefaultIcon(phaseName: string): NeuralIconName {
    const nameLower = phaseName.toLowerCase();

    if (nameLower.includes('intent') || nameLower.includes('lock') || nameLower.includes('contract')) {
        return 'intent-lock';
    }
    if (nameLower.includes('init') || nameLower.includes('setup') || nameLower.includes('scaffold')) {
        return 'initialize';
    }
    if (nameLower.includes('build') || nameLower.includes('construct') || nameLower.includes('parallel')) {
        return 'build';
    }
    if (nameLower.includes('integrat') || nameLower.includes('merge') || nameLower.includes('combine')) {
        return 'integration';
    }
    if (nameLower.includes('test') || nameLower.includes('functional') || nameLower.includes('e2e')) {
        return 'test';
    }
    if (nameLower.includes('verif') || nameLower.includes('intent satisfaction') || nameLower.includes('swarm')) {
        return 'verify';
    }
    if (nameLower.includes('demo') || nameLower.includes('browser') || nameLower.includes('preview')) {
        return 'demo';
    }

    return 'code';
}

/**
 * Animation variants for the timeline container
 */
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            when: 'beforeChildren',
            staggerChildren: 0.1,
            duration: 0.3,
        },
    },
};

/**
 * Animation variants for each phase item
 */
const phaseVariants = {
    hidden: {
        opacity: 0,
        x: -20,
    },
    visible: {
        opacity: 1,
        x: 0,
        transition: {
            duration: 0.4,
            ease: smoothEase,
        },
    },
};

/**
 * Animation variants for the phase node
 */
const nodeVariants = {
    pending: {
        scale: 1,
        opacity: 0.6,
    },
    active: {
        scale: 1,
        opacity: 1,
        transition: {
            duration: 0.3,
        },
    },
    complete: {
        scale: 1,
        opacity: 1,
    },
    error: {
        scale: 1,
        opacity: 1,
    },
};

/**
 * Pulse animation for active phase glow
 * Note: Using inline transition to avoid Variants type issues with repeat: Infinity
 */
const pulseAnimation = {
    boxShadow: [
        '0 0 0 0 rgba(168, 85, 247, 0.4)',
        '0 0 0 10px rgba(168, 85, 247, 0)',
        '0 0 0 0 rgba(168, 85, 247, 0)',
    ],
};

const pulseTransition = {
    duration: 2,
    repeat: Infinity,
    ease: 'easeInOut' as const,
};

/**
 * Check animation for completed phases
 * Note: Using inline animation to avoid Variants type issues with nested ease strings
 */
const checkAnimation = {
    pathLength: 1,
    opacity: 1,
};

const checkTransition = {
    pathLength: { duration: 0.4, ease: 'easeOut' as const },
    opacity: { duration: 0.2 },
};

/**
 * Connection line progress animation
 */
const connectionVariants = {
    hidden: {
        scaleY: 0,
        originY: 0,
    },
    visible: (progress: number) => ({
        scaleY: progress / 100,
        transition: {
            duration: 0.5,
            ease: 'easeOut' as Easing,
        },
    }),
};

/**
 * PhaseTimeline Component
 *
 * Displays a vertical timeline of build phases with animations.
 */
export const PhaseTimeline: React.FC<PhaseTimelineProps> = ({
    phases,
    currentPhaseId,
    totalProgress = 0,
    className = '',
}) => {
    // Calculate which phase is active based on currentPhaseId or first non-complete phase
    const activePhaseId = currentPhaseId || phases.find(p => p.status === 'active')?.id;

    return (
        <motion.div
            className={`phase-timeline ${className}`}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* Header */}
            <div className="phase-timeline-header">
                <h3 className="phase-timeline-title">Build Progress</h3>
                <div className="phase-timeline-progress">
                    <NeuralIcon name="clock" size={14} />
                    <span className="phase-timeline-progress-value">
                        {Math.round(totalProgress)}%
                    </span>
                </div>
            </div>

            {/* Timeline Track */}
            <div className="phase-timeline-track">
                {/* Animated Connection Line */}
                <motion.div
                    style={{
                        position: 'absolute',
                        left: 15,
                        top: 20,
                        bottom: 20,
                        width: 2,
                        background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.8) 0%, rgba(6, 182, 212, 0.5) 100%)',
                        borderRadius: 1,
                        transformOrigin: 'top',
                        zIndex: 0,
                    }}
                    variants={connectionVariants}
                    initial="hidden"
                    animate="visible"
                    custom={totalProgress}
                />

                {/* Phase Items */}
                <AnimatePresence>
                    {phases.map((phase) => {
                        const isActive = phase.id === activePhaseId || phase.status === 'active';
                        const isComplete = phase.status === 'complete';
                        const isError = phase.status === 'error';

                        // Determine status class
                        const statusClass = isActive
                            ? 'phase-item--active'
                            : isComplete
                            ? 'phase-item--complete'
                            : isError
                            ? 'phase-item--error'
                            : '';

                        // Get the icon to display
                        const iconName = phase.iconName || getDefaultIcon(phase.name);

                        return (
                            <motion.div
                                key={phase.id}
                                className={`phase-item ${statusClass}`}
                                variants={phaseVariants}
                                layout
                            >
                                {/* Phase Node */}
                                <motion.div
                                    className="phase-node"
                                    variants={nodeVariants}
                                    animate={phase.status}
                                >
                                    {/* Active Phase Pulse Effect */}
                                    {isActive && (
                                        <motion.div
                                            style={{
                                                position: 'absolute',
                                                inset: -4,
                                                borderRadius: 'inherit',
                                                pointerEvents: 'none',
                                            }}
                                            initial={{ boxShadow: '0 0 0 0 rgba(168, 85, 247, 0.4)' }}
                                            animate={pulseAnimation}
                                            transition={pulseTransition}
                                        />
                                    )}

                                    {/* Icon Display */}
                                    {isComplete ? (
                                        <motion.svg
                                            width={14}
                                            height={14}
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth={2.5}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <motion.polyline
                                                points="20,6 9,17 4,12"
                                                initial={{ pathLength: 0, opacity: 0 }}
                                                animate={checkAnimation}
                                                transition={checkTransition}
                                            />
                                        </motion.svg>
                                    ) : isError ? (
                                        <NeuralIcon name="error" size={14} />
                                    ) : (
                                        <NeuralIcon name={iconName} size={14} />
                                    )}
                                </motion.div>

                                {/* Phase Content */}
                                <div className="phase-content">
                                    <div className="phase-name">{phase.name}</div>
                                    {phase.description && (
                                        <div className="phase-description">{phase.description}</div>
                                    )}

                                    {/* Phase Meta */}
                                    {(phase.duration !== undefined || isActive) && (
                                        <div className="phase-meta">
                                            {phase.duration !== undefined && (
                                                <span className="phase-duration">
                                                    {formatDuration(phase.duration)}
                                                </span>
                                            )}
                                            {isActive && !phase.duration && (
                                                <motion.span
                                                    className="phase-duration"
                                                    animate={{ opacity: [0.5, 1, 0.5] }}
                                                    transition={{
                                                        duration: 1.5,
                                                        repeat: Infinity,
                                                        ease: 'easeInOut',
                                                    }}
                                                >
                                                    In Progress...
                                                </motion.span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export default PhaseTimeline;
