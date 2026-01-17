/**
 * ReconfigurePlanButton Component
 *
 * Premium button that triggers plan reconfiguration based on all
 * accumulated modifications. Displays modification count and sends
 * all changes to the backend for AI-powered plan regeneration.
 *
 * Features:
 * - Shows modification count badge
 * - Premium liquid glass styling with warm glow
 * - Loading state during reconfiguration
 * - Disabled when no modifications exist
 */

import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlanModificationStore } from '../../../store/plan-modification-store';

// =============================================================================
// Types
// =============================================================================

export interface ReconfigurePlanButtonProps {
    buildId: string;
    onReconfigure: (modifications: ReconfigurationPayload) => Promise<void>;
    onError?: (error: Error) => void;
}

export interface ReconfigurationPayload {
    buildId: string;
    originalPlan: {
        phases: Array<{
            id: string;
            title: string;
            tasks: Array<{
                id: string;
                content: string;
            }>;
        }>;
    };
    taskModifications: Array<{
        taskId: string;
        phaseId: string;
        originalContent: string;
        modificationPrompt: string;
    }>;
    phaseModifications: Array<{
        phaseId: string;
        originalTitle: string;
        modificationPrompt: string;
    }>;
}

// =============================================================================
// Styles
// =============================================================================

const buttonContainerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
};

const reconfigureButtonStyle: React.CSSProperties = {
    padding: '14px 28px',
    fontSize: '14px',
    fontWeight: 600,
    letterSpacing: '0.3px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
};

const badgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: '-8px',
    right: '-8px',
    minWidth: '22px',
    height: '22px',
    padding: '0 6px',
    borderRadius: '11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 700,
    color: 'white',
};

// =============================================================================
// Component
// =============================================================================

export const ReconfigurePlanButton: React.FC<ReconfigurePlanButtonProps> = ({
    buildId,
    onReconfigure,
    onError,
}) => {
    const [isProcessing, setIsProcessing] = useState(false);

    const {
        planState,
        hasModifications,
        getModificationCount,
        getAllModifications,
        clearAllModifications,
        setReconfiguring,
    } = usePlanModificationStore();

    const modificationCount = getModificationCount();
    const hasChanges = hasModifications();

    const handleReconfigure = useCallback(async () => {
        if (!hasChanges || isProcessing || !planState.originalPlan) return;

        setIsProcessing(true);
        setReconfiguring(true);

        try {
            const modifications = getAllModifications();

            const payload: ReconfigurationPayload = {
                buildId,
                originalPlan: {
                    phases: planState.originalPlan.phases.map(phase => ({
                        id: phase.id,
                        title: phase.title,
                        tasks: phase.tasks.map(task => ({
                            id: task.id,
                            content: task.content,
                        })),
                    })),
                },
                taskModifications: modifications.tasks,
                phaseModifications: modifications.phases,
            };

            await onReconfigure(payload);

            // Clear modifications after successful reconfiguration
            clearAllModifications();
        } catch (error) {
            console.error('[ReconfigurePlan] Error:', error);
            onError?.(error instanceof Error ? error : new Error('Reconfiguration failed'));
        } finally {
            setIsProcessing(false);
            setReconfiguring(false);
        }
    }, [
        hasChanges,
        isProcessing,
        planState.originalPlan,
        buildId,
        getAllModifications,
        onReconfigure,
        clearAllModifications,
        setReconfiguring,
        onError,
    ]);

    const isDisabled = !hasChanges || isProcessing || planState.isApproved;

    return (
        <div style={buttonContainerStyle}>
            <motion.button
                style={{
                    ...reconfigureButtonStyle,
                    background: isDisabled
                        ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%)'
                        : 'linear-gradient(135deg, rgba(120, 200, 255, 0.9) 0%, rgba(100, 180, 255, 0.95) 100%)',
                    color: isDisabled ? 'rgba(255, 255, 255, 0.4)' : 'white',
                    boxShadow: isDisabled
                        ? '0 4px 16px rgba(0, 0, 0, 0.2)'
                        : '0 8px 32px rgba(120, 200, 255, 0.3), 0 0 40px rgba(120, 200, 255, 0.15)',
                    cursor: isDisabled ? 'default' : 'pointer',
                }}
                whileHover={!isDisabled ? {
                    scale: 1.02,
                    boxShadow: '0 12px 40px rgba(120, 200, 255, 0.4), 0 0 60px rgba(120, 200, 255, 0.2)',
                } : {}}
                whileTap={!isDisabled ? { scale: 0.98 } : {}}
                onClick={handleReconfigure}
                disabled={isDisabled}
            >
                {isProcessing ? (
                    <>
                        <motion.span
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            style={{ display: 'inline-block' }}
                        >
                            ◌
                        </motion.span>
                        Reconfiguring...
                    </>
                ) : (
                    <>
                        <span style={{ fontSize: '16px' }}>↻</span>
                        Reconfigure Plan
                    </>
                )}
            </motion.button>

            {/* Modification Count Badge */}
            <AnimatePresence>
                {hasChanges && !isProcessing && (
                    <motion.div
                        style={{
                            ...badgeStyle,
                            background: 'linear-gradient(135deg, rgba(255, 150, 100, 0.95) 0%, rgba(255, 120, 80, 1) 100%)',
                            boxShadow: '0 2px 8px rgba(255, 150, 100, 0.4)',
                        }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    >
                        {modificationCount}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// =============================================================================
// Approve Plan Button
// =============================================================================

export interface ApprovePlanButtonProps {
    onApprove: () => void;
    disabled?: boolean;
    loading?: boolean;
}

export const ApprovePlanButton: React.FC<ApprovePlanButtonProps> = ({
    onApprove,
    disabled = false,
    loading = false,
}) => {
    const { planState, approvePlan } = usePlanModificationStore();

    const handleApprove = useCallback(() => {
        approvePlan();
        onApprove();
    }, [approvePlan, onApprove]);

    const isDisabled = disabled || loading || planState.isApproved;

    return (
        <motion.button
            style={{
                ...reconfigureButtonStyle,
                background: isDisabled
                    ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%)'
                    : 'linear-gradient(135deg, rgba(120, 255, 150, 0.9) 0%, rgba(100, 220, 130, 0.95) 100%)',
                color: isDisabled ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.9)',
                boxShadow: isDisabled
                    ? '0 4px 16px rgba(0, 0, 0, 0.2)'
                    : '0 8px 32px rgba(120, 255, 150, 0.3), 0 0 40px rgba(120, 255, 150, 0.15)',
                cursor: isDisabled ? 'default' : 'pointer',
            }}
            whileHover={!isDisabled ? {
                scale: 1.02,
                boxShadow: '0 12px 40px rgba(120, 255, 150, 0.4), 0 0 60px rgba(120, 255, 150, 0.2)',
            } : {}}
            whileTap={!isDisabled ? { scale: 0.98 } : {}}
            onClick={handleApprove}
            disabled={isDisabled}
        >
            {loading ? (
                <>
                    <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        style={{ display: 'inline-block' }}
                    >
                        ◌
                    </motion.span>
                    Approving...
                </>
            ) : planState.isApproved ? (
                <>
                    <span style={{ fontSize: '16px' }}>✓</span>
                    Plan Approved
                </>
            ) : (
                <>
                    <span style={{ fontSize: '16px' }}>✓</span>
                    Approve Plan
                </>
            )}
        </motion.button>
    );
};

export default ReconfigurePlanButton;
