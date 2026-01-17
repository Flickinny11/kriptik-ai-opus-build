/**
 * PlanPhaseCard Component
 *
 * Premium 3D liquid glass card for displaying implementation plan phases.
 * Features expandable task list with per-task modification capability.
 *
 * Features:
 * - "Modify" button to expand and show tasks
 * - Click on individual tasks to open NLP prompt input
 * - Visual indicators for modified tasks
 * - Collapsible animation with Framer Motion
 * - Premium liquid glass styling
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlanModificationStore, type PlanPhase, type PlanTask } from '../../../store/plan-modification-store';

// =============================================================================
// Types
// =============================================================================

export interface PlanPhaseCardProps {
    phase: PlanPhase;
    phaseIndex: number;
    isApproved: boolean;
    onTaskClick?: (task: PlanTask, phase: PlanPhase) => void;
}

// =============================================================================
// Styles
// =============================================================================

const cardStyle: React.CSSProperties = {
    position: 'relative',
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)',
    backdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    overflow: 'hidden',
    marginBottom: '16px',
};

const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    cursor: 'pointer',
};

const phaseNumberStyle: React.CSSProperties = {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, rgba(255, 200, 150, 0.3) 0%, rgba(255, 150, 100, 0.2) 100%)',
    border: '1px solid rgba(255, 200, 150, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 600,
    color: 'rgba(255, 200, 150, 0.95)',
    marginRight: '16px',
    flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
    flex: 1,
    fontSize: '16px',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: '-0.2px',
};

const modifyButtonStyle: React.CSSProperties = {
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 500,
    color: 'rgba(255, 200, 150, 0.9)',
    background: 'linear-gradient(135deg, rgba(255, 200, 150, 0.15) 0%, rgba(255, 150, 100, 0.1) 100%)',
    border: '1px solid rgba(255, 200, 150, 0.25)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginLeft: '12px',
};

const tasksContainerStyle: React.CSSProperties = {
    padding: '0 24px 20px',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
};

const taskItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    padding: '12px 16px',
    marginTop: '12px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: '1px solid transparent',
};

const taskNumberStyle: React.CSSProperties = {
    width: '20px',
    height: '20px',
    borderRadius: '4px',
    background: 'rgba(255, 255, 255, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.5)',
    marginRight: '12px',
    flexShrink: 0,
};

const taskContentStyle: React.CSSProperties = {
    flex: 1,
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.75)',
    lineHeight: '1.5',
};

const modificationBadgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'rgba(120, 200, 255, 0.95)',
    background: 'linear-gradient(135deg, rgba(120, 200, 255, 0.2) 0%, rgba(100, 180, 255, 0.1) 100%)',
    border: '1px solid rgba(120, 200, 255, 0.3)',
    borderRadius: '4px',
    marginLeft: '8px',
};

const nlpInputContainerStyle: React.CSSProperties = {
    marginTop: '12px',
    padding: '16px',
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
};

const nlpTextareaStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '80px',
    padding: '12px',
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.9)',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    resize: 'vertical',
    outline: 'none',
    fontFamily: 'inherit',
};

const nlpButtonsStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '12px',
};

// =============================================================================
// Component
// =============================================================================

export const PlanPhaseCard: React.FC<PlanPhaseCardProps> = ({
    phase,
    phaseIndex,
    isApproved,
    onTaskClick,
}) => {
    const [nlpPrompt, setNlpPrompt] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const {
        expandedPhases,
        togglePhaseExpanded,
        editingTaskId,
        setEditingTask,
        addTaskModification,
        removeTaskModification,
        getTaskModification,
    } = usePlanModificationStore();

    const isExpanded = expandedPhases.has(phase.id);
    const hasModifiedTasks = phase.tasks.some(t => getTaskModification(t.id));

    // Focus textarea when editing starts
    useEffect(() => {
        if (editingTaskId && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [editingTaskId]);

    const handleModifyClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        togglePhaseExpanded(phase.id);
    }, [phase.id, togglePhaseExpanded]);

    const handleTaskClick = useCallback((task: PlanTask) => {
        if (isApproved) return;

        setEditingTask(task.id);
        const existingMod = getTaskModification(task.id);
        setNlpPrompt(existingMod?.modificationPrompt || '');
        onTaskClick?.(task, phase);
    }, [isApproved, phase, setEditingTask, getTaskModification, onTaskClick]);

    const handleSaveModification = useCallback((task: PlanTask) => {
        if (!nlpPrompt.trim()) return;

        addTaskModification(
            task.id,
            phase.id,
            task.content,
            nlpPrompt.trim()
        );
        setNlpPrompt('');
    }, [nlpPrompt, phase.id, addTaskModification]);

    const handleCancelEdit = useCallback(() => {
        setEditingTask(null);
        setNlpPrompt('');
    }, [setEditingTask]);

    const handleRemoveModification = useCallback((taskId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        removeTaskModification(taskId);
    }, [removeTaskModification]);

    return (
        <motion.div
            style={{
                ...cardStyle,
                boxShadow: isExpanded
                    ? '0 12px 40px rgba(0, 0, 0, 0.4), 0 0 40px rgba(255, 200, 150, 0.1)'
                    : '0 4px 20px rgba(0, 0, 0, 0.2)',
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: phaseIndex * 0.1, duration: 0.4 }}
        >
            {/* Header */}
            <div
                style={headerStyle}
                onClick={() => togglePhaseExpanded(phase.id)}
            >
                <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <div style={phaseNumberStyle}>{phaseIndex + 1}</div>
                    <div style={titleStyle}>
                        {phase.title}
                        {hasModifiedTasks && (
                            <span style={modificationBadgeStyle}>Modified</span>
                        )}
                    </div>
                </div>

                {/* Modify Button */}
                {!isApproved && (
                    <motion.button
                        style={modifyButtonStyle}
                        whileHover={{
                            background: 'linear-gradient(135deg, rgba(255, 200, 150, 0.25) 0%, rgba(255, 150, 100, 0.15) 100%)',
                            borderColor: 'rgba(255, 200, 150, 0.4)',
                        }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleModifyClick}
                    >
                        {isExpanded ? 'Collapse' : 'Modify'}
                    </motion.button>
                )}

                {/* Expand Indicator */}
                <motion.div
                    style={{
                        marginLeft: '8px',
                        color: 'rgba(255, 255, 255, 0.4)',
                        fontSize: '12px',
                    }}
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    ▼
                </motion.div>
            </div>

            {/* Expandable Tasks */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    >
                        <div style={tasksContainerStyle}>
                            {phase.description && (
                                <p style={{
                                    fontSize: '13px',
                                    color: 'rgba(255, 255, 255, 0.5)',
                                    marginBottom: '16px',
                                    paddingTop: '12px',
                                }}>
                                    {phase.description}
                                </p>
                            )}

                            {phase.tasks.map((task, taskIndex) => {
                                const modification = getTaskModification(task.id);
                                const isEditing = editingTaskId === task.id;

                                return (
                                    <div key={task.id}>
                                        <motion.div
                                            style={{
                                                ...taskItemStyle,
                                                borderColor: modification
                                                    ? 'rgba(120, 200, 255, 0.3)'
                                                    : isEditing
                                                        ? 'rgba(255, 200, 150, 0.3)'
                                                        : 'transparent',
                                                background: modification
                                                    ? 'rgba(120, 200, 255, 0.08)'
                                                    : isEditing
                                                        ? 'rgba(255, 200, 150, 0.08)'
                                                        : 'rgba(255, 255, 255, 0.03)',
                                                cursor: isApproved ? 'default' : 'pointer',
                                            }}
                                            whileHover={!isApproved ? {
                                                background: modification
                                                    ? 'rgba(120, 200, 255, 0.12)'
                                                    : 'rgba(255, 255, 255, 0.06)',
                                            } : {}}
                                            onClick={() => handleTaskClick(task)}
                                        >
                                            <div style={taskNumberStyle}>{taskIndex + 1}</div>
                                            <div style={taskContentStyle}>
                                                {task.content}
                                                {modification && (
                                                    <div style={{
                                                        marginTop: '8px',
                                                        padding: '8px 12px',
                                                        background: 'rgba(120, 200, 255, 0.1)',
                                                        borderRadius: '6px',
                                                        fontSize: '12px',
                                                        color: 'rgba(120, 200, 255, 0.9)',
                                                    }}>
                                                        <strong>Modification:</strong> {modification.modificationPrompt}
                                                        {!isApproved && (
                                                            <button
                                                                style={{
                                                                    marginLeft: '8px',
                                                                    padding: '2px 6px',
                                                                    fontSize: '10px',
                                                                    background: 'rgba(255, 100, 100, 0.2)',
                                                                    border: '1px solid rgba(255, 100, 100, 0.3)',
                                                                    borderRadius: '4px',
                                                                    color: 'rgba(255, 100, 100, 0.9)',
                                                                    cursor: 'pointer',
                                                                }}
                                                                onClick={(e) => handleRemoveModification(task.id, e)}
                                                            >
                                                                Remove
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>

                                        {/* NLP Prompt Input */}
                                        <AnimatePresence>
                                            {isEditing && !isApproved && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    style={nlpInputContainerStyle}
                                                >
                                                    <div style={{
                                                        fontSize: '12px',
                                                        color: 'rgba(255, 200, 150, 0.8)',
                                                        marginBottom: '8px',
                                                        fontWeight: 500,
                                                    }}>
                                                        How would you like to modify this task?
                                                    </div>
                                                    <textarea
                                                        ref={textareaRef}
                                                        style={nlpTextareaStyle}
                                                        placeholder="Describe your changes in natural language..."
                                                        value={nlpPrompt}
                                                        onChange={(e) => setNlpPrompt(e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                    <div style={nlpButtonsStyle}>
                                                        <button
                                                            style={{
                                                                padding: '8px 16px',
                                                                fontSize: '13px',
                                                                background: 'transparent',
                                                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                                                borderRadius: '6px',
                                                                color: 'rgba(255, 255, 255, 0.6)',
                                                                cursor: 'pointer',
                                                            }}
                                                            onClick={handleCancelEdit}
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            style={{
                                                                padding: '8px 16px',
                                                                fontSize: '13px',
                                                                background: nlpPrompt.trim()
                                                                    ? 'linear-gradient(135deg, rgba(120, 200, 255, 0.8) 0%, rgba(100, 180, 255, 0.9) 100%)'
                                                                    : 'rgba(255, 255, 255, 0.1)',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                color: nlpPrompt.trim() ? 'white' : 'rgba(255, 255, 255, 0.4)',
                                                                cursor: nlpPrompt.trim() ? 'pointer' : 'default',
                                                                fontWeight: 500,
                                                            }}
                                                            onClick={() => handleSaveModification(task)}
                                                            disabled={!nlpPrompt.trim()}
                                                        >
                                                            Save Modification
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default PlanPhaseCard;
