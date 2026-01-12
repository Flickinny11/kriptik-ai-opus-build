/**
 * DiffViewer - Premium unified diff display component
 *
 * Displays file changes in a visually rich format with:
 * - Operation badges (ADD, MODIFY, DELETE)
 * - Addition/deletion statistics
 * - Animated hunk rendering with staggered line reveals
 * - Color-coded line types (additions, deletions, context)
 * - Collapse/expand functionality with smooth transitions
 *
 * Part of the Neural Canvas design system.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence, Easing } from 'framer-motion';
import { NeuralIcon } from './icons/NeuralIcons';

// Typed cubic bezier for Framer Motion
const smoothEase: Easing = [0.4, 0, 0.2, 1];

/**
 * Represents a single line in a diff hunk
 */
export interface DiffLine {
    type: 'add' | 'remove' | 'context';
    content: string;
    oldLineNumber?: number;
    newLineNumber?: number;
}

/**
 * Represents a hunk (section) of changes in a diff
 */
export interface DiffHunk {
    header: string;
    lines: DiffLine[];
}

/**
 * Props for the DiffViewer component
 */
export interface DiffViewerProps {
    /** Name of the file being diffed */
    filename: string;
    /** Type of operation performed on the file */
    operation: 'add' | 'modify' | 'delete';
    /** Array of diff hunks containing the actual changes */
    hunks: DiffHunk[];
    /** Number of lines added */
    additions: number;
    /** Number of lines deleted */
    deletions: number;
    /** Callback when expand/collapse is triggered */
    onExpand?: () => void;
    /** Whether the diff content is collapsed */
    isCollapsed?: boolean;
    /** Additional CSS class names */
    className?: string;
}

/**
 * Animation variants for the diff container
 */
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            duration: 0.3,
            ease: smoothEase,
        },
    },
    exit: {
        opacity: 0,
        transition: {
            duration: 0.2,
        },
    },
};

/**
 * Animation variants for hunks - sequential reveal
 */
const hunkVariants = {
    hidden: {
        opacity: 0,
        y: 10,
    },
    visible: (index: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            delay: index * 0.1,
            duration: 0.3,
            ease: smoothEase,
        },
    }),
    exit: {
        opacity: 0,
        y: -10,
        transition: {
            duration: 0.2,
        },
    },
};

/**
 * Animation variants for individual diff lines - staggered reveal
 */
const lineVariants = {
    hidden: {
        opacity: 0,
        x: -8,
    },
    visible: (index: number) => ({
        opacity: 1,
        x: 0,
        transition: {
            delay: index * 0.02,
            duration: 0.2,
            ease: smoothEase,
        },
    }),
};

/**
 * Animation variants for added lines - includes green glow effect
 */
const addLineVariants = {
    hidden: {
        opacity: 0,
        x: -8,
        boxShadow: '0 0 0 rgba(74, 222, 128, 0)',
    },
    visible: (index: number) => ({
        opacity: 1,
        x: 0,
        boxShadow: [
            '0 0 0 rgba(74, 222, 128, 0)',
            '0 0 12px rgba(74, 222, 128, 0.4)',
            '0 0 4px rgba(74, 222, 128, 0.2)',
        ],
        transition: {
            delay: index * 0.02,
            duration: 0.4,
            ease: smoothEase,
            boxShadow: {
                duration: 0.6,
                times: [0, 0.5, 1],
            },
        },
    }),
};

/**
 * Animation variants for removed lines - includes strikethrough effect
 */
const removeLineVariants = {
    hidden: {
        opacity: 0,
        x: -8,
    },
    visible: (index: number) => ({
        opacity: 1,
        x: 0,
        transition: {
            delay: index * 0.02,
            duration: 0.2,
            ease: smoothEase,
        },
    }),
};

/**
 * Animation variants for collapse/expand content
 */
const collapseVariants = {
    collapsed: {
        height: 0,
        opacity: 0,
        transition: {
            height: {
                duration: 0.3,
                ease: smoothEase,
            },
            opacity: {
                duration: 0.2,
            },
        },
    },
    expanded: {
        height: 'auto',
        opacity: 1,
        transition: {
            height: {
                duration: 0.3,
                ease: smoothEase,
            },
            opacity: {
                duration: 0.3,
                delay: 0.1,
            },
        },
    },
};

/**
 * DiffViewer component - displays file diffs in a premium unified format
 */
export const DiffViewer: React.FC<DiffViewerProps> = ({
    filename,
    operation,
    hunks,
    additions,
    deletions,
    onExpand,
    isCollapsed: controlledCollapsed,
    className = '',
}) => {
    // Internal collapsed state for uncontrolled mode
    const [internalCollapsed, setInternalCollapsed] = useState(false);

    // Use controlled or uncontrolled collapsed state
    const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

    /**
     * Handle expand/collapse toggle
     */
    const handleToggle = () => {
        if (onExpand) {
            onExpand();
        } else {
            setInternalCollapsed(!internalCollapsed);
        }
    };

    /**
     * Get the appropriate line animation variants based on line type
     */
    const getLineVariants = (lineType: DiffLine['type']) => {
        switch (lineType) {
            case 'add':
                return addLineVariants;
            case 'remove':
                return removeLineVariants;
            default:
                return lineVariants;
        }
    };

    /**
     * Get the gutter symbol for a line type
     */
    const getGutterSymbol = (lineType: DiffLine['type']): string => {
        switch (lineType) {
            case 'add':
                return '+';
            case 'remove':
                return '-';
            default:
                return ' ';
        }
    };

    return (
        <motion.div
            className={`diff-viewer ${className}`.trim()}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
        >
            {/* Diff Header */}
            <div className="diff-header">
                <div className="diff-file-info">
                    {/* Operation Badge */}
                    <span className={`diff-operation diff-operation--${operation}`}>
                        {operation.toUpperCase()}
                    </span>

                    {/* File Icon and Name */}
                    <NeuralIcon name="file-code" size={14} className="diff-file-icon" />
                    <span className="diff-filename">{filename}</span>
                </div>

                <div className="diff-controls">
                    {/* Statistics */}
                    <div className="diff-stats">
                        {additions > 0 && (
                            <span className="diff-additions">+{additions}</span>
                        )}
                        {deletions > 0 && (
                            <span className="diff-deletions">-{deletions}</span>
                        )}
                    </div>

                    {/* Collapse/Expand Button */}
                    <button
                        className="diff-toggle"
                        onClick={handleToggle}
                        aria-expanded={!isCollapsed}
                        aria-label={isCollapsed ? 'Expand diff' : 'Collapse diff'}
                    >
                        <NeuralIcon
                            name={isCollapsed ? 'chevron-right' : 'chevron-down'}
                            size={16}
                        />
                    </button>
                </div>
            </div>

            {/* Diff Content - Animated collapse/expand */}
            <AnimatePresence initial={false}>
                {!isCollapsed && (
                    <motion.div
                        className="diff-content"
                        variants={collapseVariants}
                        initial="collapsed"
                        animate="expanded"
                        exit="collapsed"
                        style={{ overflow: 'hidden' }}
                    >
                        {hunks.map((hunk, hunkIndex) => (
                            <motion.div
                                key={`hunk-${hunkIndex}`}
                                className="diff-hunk"
                                variants={hunkVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                custom={hunkIndex}
                            >
                                {/* Hunk Header */}
                                <div className="diff-hunk-header">
                                    <span className="diff-hunk-range">{hunk.header}</span>
                                </div>

                                {/* Diff Lines */}
                                {hunk.lines.map((line, lineIndex) => (
                                    <motion.div
                                        key={`line-${hunkIndex}-${lineIndex}`}
                                        className={`diff-line diff-line--${line.type}`}
                                        variants={getLineVariants(line.type)}
                                        initial="hidden"
                                        animate="visible"
                                        custom={lineIndex}
                                    >
                                        {/* Gutter Symbol (+/-/space) */}
                                        <span className="diff-line-gutter">
                                            {getGutterSymbol(line.type)}
                                        </span>

                                        {/* Old Line Number */}
                                        <span className="diff-line-number diff-line-number--old">
                                            {line.type !== 'add' ? line.oldLineNumber : ''}
                                        </span>

                                        {/* New Line Number */}
                                        <span className="diff-line-number diff-line-number--new">
                                            {line.type !== 'remove' ? line.newLineNumber : ''}
                                        </span>

                                        {/* Line Content */}
                                        <span className="diff-line-content">
                                            {line.type === 'remove' ? (
                                                <motion.span
                                                    className="diff-line-text diff-line-text--strikethrough"
                                                    initial={{ textDecoration: 'none' }}
                                                    animate={{
                                                        textDecoration: 'line-through',
                                                        transition: {
                                                            delay: lineIndex * 0.02 + 0.1,
                                                            duration: 0.3,
                                                        },
                                                    }}
                                                >
                                                    {line.content}
                                                </motion.span>
                                            ) : (
                                                <span className="diff-line-text">{line.content}</span>
                                            )}
                                        </span>
                                    </motion.div>
                                ))}
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default DiffViewer;
