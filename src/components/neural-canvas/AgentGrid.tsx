/**
 * AgentGrid - Displays a grid of parallel AI agents working simultaneously
 *
 * Uses Framer Motion for animations and CSS from neural-canvas.css
 * Each agent card shows: avatar icon, name, type, task description, status badge, progress bar
 *
 * Visual states:
 * - pending: Muted, waiting to start
 * - active: Animated border glow, pulsing status dot
 * - complete: Success styling with checkmark
 * - error: Error styling with warning indicator
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NeuralIcon, NeuralIconName } from './icons/NeuralIcons';

/** Agent status types */
export type AgentStatus = 'pending' | 'active' | 'complete' | 'error';

/** Information about a single agent */
export interface AgentInfo {
    id: string;
    name: string;
    type: string;
    task: string;
    status: AgentStatus;
    progress: number;
    iconName?: NeuralIconName;
}

/** Props for the AgentGrid component */
export interface AgentGridProps {
    /** Array of agents to display */
    agents: AgentInfo[];
    /** Callback when an agent card is clicked */
    onAgentClick?: (agentId: string) => void;
    /** Number of columns in the grid (auto-fit by default) */
    columns?: number;
    /** Additional CSS class names */
    className?: string;
}

/**
 * Get human-readable status text for display
 */
function getStatusText(status: AgentStatus): string {
    switch (status) {
        case 'pending':
            return 'Waiting';
        case 'active':
            return 'Working';
        case 'complete':
            return 'Complete';
        case 'error':
            return 'Error';
        default:
            return status;
    }
}

/**
 * Container animation variants for staggered children
 */
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.05,
        },
    },
};

/**
 * Card animation variants for individual agent cards
 */
const cardVariants = {
    hidden: {
        opacity: 0,
        y: 20,
        scale: 0.95,
    },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            type: 'spring' as const,
            stiffness: 300,
            damping: 24,
        },
    },
    hover: {
        y: -4,
        transition: {
            type: 'spring' as const,
            stiffness: 400,
            damping: 20,
        },
    },
    tap: {
        scale: 0.98,
        transition: {
            type: 'spring' as const,
            stiffness: 500,
            damping: 30,
        },
    },
};

/**
 * AgentGrid Component
 *
 * Displays a responsive grid of agent cards with animations and status indicators.
 * Each card shows the agent's current task, progress, and status.
 */
export const AgentGrid: React.FC<AgentGridProps> = ({
    agents,
    onAgentClick,
    columns,
    className = '',
}) => {
    // Build grid style with custom columns if specified
    const gridStyle: React.CSSProperties | undefined = columns
        ? { gridTemplateColumns: `repeat(${columns}, 1fr)` }
        : undefined;

    return (
        <motion.div
            className={`agent-grid ${className}`.trim()}
            style={gridStyle || {}}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            <AnimatePresence mode="popLayout">
                {agents.map((agent) => (
                    <motion.div
                        key={agent.id}
                        className={`agent-card agent-card--${agent.status}`}
                        onClick={() => onAgentClick?.(agent.id)}
                        layoutId={agent.id}
                        variants={cardVariants}
                        whileHover="hover"
                        whileTap="tap"
                        exit={{
                            opacity: 0,
                            scale: 0.9,
                            transition: { duration: 0.2 },
                        }}
                    >
                        {/* Agent Header: Avatar, Name, Type, Status */}
                        <div className="agent-header">
                            <div className="agent-identity">
                                <motion.div
                                    className="agent-avatar"
                                    animate={agent.status === 'active' ? {
                                        boxShadow: [
                                            '0 0 0 0 rgba(245, 168, 108, 0)',
                                            '0 0 0 8px rgba(245, 168, 108, 0.2)',
                                            '0 0 0 0 rgba(245, 168, 108, 0)',
                                        ],
                                    } : {}}
                                    transition={agent.status === 'active' ? {
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: 'easeInOut',
                                    } : {}}
                                >
                                    <NeuralIcon
                                        name={agent.iconName || 'agent'}
                                        size={20}
                                    />
                                </motion.div>
                                <div>
                                    <div className="agent-name">{agent.name}</div>
                                    <div className="agent-type">{agent.type}</div>
                                </div>
                            </div>
                            <span className={`agent-status-badge agent-status-badge--${agent.status}`}>
                                <motion.span
                                    className="agent-status-dot"
                                    animate={agent.status === 'active' ? {
                                        opacity: [1, 0.4, 1],
                                        scale: [1, 1.2, 1],
                                    } : {}}
                                    transition={agent.status === 'active' ? {
                                        duration: 1.5,
                                        repeat: Infinity,
                                        ease: 'easeInOut',
                                    } : {}}
                                />
                                {getStatusText(agent.status)}
                            </span>
                        </div>

                        {/* Task Description */}
                        <p className="agent-task">{agent.task}</p>

                        {/* Progress Bar */}
                        <div className="agent-progress">
                            <div className="agent-progress-bar">
                                <motion.div
                                    className="agent-progress-fill"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${agent.progress}%` }}
                                    transition={{
                                        type: 'spring',
                                        stiffness: 100,
                                        damping: 20,
                                    }}
                                />
                            </div>
                            <div className="agent-progress-text">
                                <span>{agent.progress}%</span>
                                <span>{getStatusText(agent.status)}</span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </motion.div>
    );
};

export default AgentGrid;
