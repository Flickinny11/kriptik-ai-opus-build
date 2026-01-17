/**
 * DependencyInstallView Component
 *
 * Premium 3D liquid glass streaming view for dependency installation progress.
 * Shows real-time terminal output with animated status indicators.
 *
 * Features:
 * - Live streaming terminal output
 * - Per-dependency status tracking
 * - Animated progress indicators
 * - Auto-scroll with manual override
 * - Success/error state visualization
 * - Premium translucent glass styling
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// =============================================================================
// Types
// =============================================================================

export interface DependencyInstallStatus {
    id: string;
    name: string;
    status: 'pending' | 'installing' | 'success' | 'error';
    version?: string;
    errorMessage?: string;
}

export interface StreamLine {
    id: string;
    timestamp: string;
    type: 'info' | 'success' | 'error' | 'warning' | 'command';
    content: string;
}

export interface DependencyInstallViewProps {
    /** Build ID for this installation */
    buildId: string;
    /** List of dependencies being installed */
    dependencies: DependencyInstallStatus[];
    /** Stream of output lines */
    streamLines: StreamLine[];
    /** Overall installation status */
    overallStatus: 'installing' | 'success' | 'error' | 'cancelled';
    /** Total progress percentage (0-100) */
    progressPercent: number;
    /** Callback when installation completes successfully */
    onComplete?: () => void;
    /** Callback to retry failed installation */
    onRetry?: () => void;
    /** Callback to cancel installation */
    onCancel?: () => void;
    /** Header text override */
    headerText?: string;
}

// =============================================================================
// Liquid Glass Styles
// =============================================================================

const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    minHeight: '100vh',
    background: 'linear-gradient(180deg, rgba(15, 15, 25, 0.95) 0%, rgba(10, 10, 20, 0.98) 100%)',
    padding: '40px',
    overflow: 'auto',
};

const headerCardStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)',
    backdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '24px',
    padding: '24px 32px',
    marginBottom: '24px',
    boxShadow: `
        0 8px 32px rgba(0, 0, 0, 0.4),
        0 0 60px rgba(100, 200, 255, 0.05),
        inset 0 1px 0 rgba(255, 255, 255, 0.1)
    `,
};

const terminalStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.6) 0%, rgba(10, 10, 20, 0.8) 100%)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    padding: '20px',
    fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace',
    fontSize: '13px',
    lineHeight: '1.6',
    color: 'rgba(255, 255, 255, 0.85)',
    maxHeight: '400px',
    overflow: 'auto',
    boxShadow: `
        0 4px 24px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.05)
    `,
};

const dependencyListStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px',
    marginBottom: '24px',
};

const dependencyItemStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
};

// =============================================================================
// Helper Components
// =============================================================================

const StatusIcon: React.FC<{ status: DependencyInstallStatus['status'] }> = ({ status }) => {
    const baseStyle: React.CSSProperties = {
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 600,
    };

    switch (status) {
        case 'pending':
            return (
                <div style={{
                    ...baseStyle,
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '2px solid rgba(255, 255, 255, 0.2)',
                }} />
            );
        case 'installing':
            return (
                <motion.div
                    style={{
                        ...baseStyle,
                        background: 'linear-gradient(135deg, rgba(100, 180, 255, 0.3) 0%, rgba(80, 160, 255, 0.2) 100%)',
                        border: '2px solid rgba(100, 180, 255, 0.5)',
                        boxShadow: '0 0 12px rgba(100, 180, 255, 0.3)',
                    }}
                    animate={{
                        scale: [1, 1.1, 1],
                        boxShadow: [
                            '0 0 12px rgba(100, 180, 255, 0.3)',
                            '0 0 20px rgba(100, 180, 255, 0.5)',
                            '0 0 12px rgba(100, 180, 255, 0.3)',
                        ],
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                />
            );
        case 'success':
            return (
                <motion.div
                    style={{
                        ...baseStyle,
                        background: 'linear-gradient(135deg, rgba(120, 255, 150, 0.3) 0%, rgba(100, 220, 130, 0.2) 100%)',
                        border: '2px solid rgba(120, 255, 150, 0.6)',
                        boxShadow: '0 0 12px rgba(120, 255, 150, 0.3)',
                        color: 'rgba(120, 255, 150, 0.95)',
                    }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 10 }}
                >
                    <span style={{ marginTop: '-1px' }}>&#10003;</span>
                </motion.div>
            );
        case 'error':
            return (
                <motion.div
                    style={{
                        ...baseStyle,
                        background: 'linear-gradient(135deg, rgba(255, 100, 100, 0.3) 0%, rgba(220, 80, 80, 0.2) 100%)',
                        border: '2px solid rgba(255, 100, 100, 0.6)',
                        boxShadow: '0 0 12px rgba(255, 100, 100, 0.3)',
                        color: 'rgba(255, 100, 100, 0.95)',
                    }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 10 }}
                >
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>&#215;</span>
                </motion.div>
            );
    }
};

const StreamLineItem: React.FC<{ line: StreamLine; index: number }> = ({ line, index }) => {
    const colors: Record<StreamLine['type'], string> = {
        info: 'rgba(255, 255, 255, 0.7)',
        success: 'rgba(120, 255, 150, 0.9)',
        error: 'rgba(255, 100, 100, 0.9)',
        warning: 'rgba(255, 200, 100, 0.9)',
        command: 'rgba(100, 180, 255, 0.9)',
    };

    const prefixes: Record<StreamLine['type'], string> = {
        info: '',
        success: '[OK] ',
        error: '[ERR] ',
        warning: '[WARN] ',
        command: '$ ',
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15, delay: index * 0.02 }}
            style={{
                color: colors[line.type],
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
            }}
        >
            <span style={{ color: 'rgba(255, 255, 255, 0.3)', marginRight: '8px' }}>
                {new Date(line.timestamp).toLocaleTimeString()}
            </span>
            {prefixes[line.type]}
            {line.content}
        </motion.div>
    );
};

// =============================================================================
// Main Component
// =============================================================================

export const DependencyInstallView: React.FC<DependencyInstallViewProps> = ({
    buildId,
    dependencies,
    streamLines,
    overallStatus,
    progressPercent,
    onComplete,
    onRetry,
    onCancel,
    headerText = 'Installing Dependencies',
}) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);

    // Auto-scroll terminal
    useEffect(() => {
        if (autoScroll && terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [streamLines, autoScroll]);

    // Handle scroll to detect manual scroll
    const handleScroll = useCallback(() => {
        if (terminalRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
            const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
            setAutoScroll(isAtBottom);
        }
    }, []);

    // Count statuses
    const statusCounts = {
        pending: dependencies.filter(d => d.status === 'pending').length,
        installing: dependencies.filter(d => d.status === 'installing').length,
        success: dependencies.filter(d => d.status === 'success').length,
        error: dependencies.filter(d => d.status === 'error').length,
    };

    return (
        <div style={containerStyle}>
            {/* Header Card */}
            <motion.div
                style={headerCardStyle}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h2 style={{
                            margin: 0,
                            fontSize: '24px',
                            fontWeight: 600,
                            color: 'rgba(255, 255, 255, 0.95)',
                            letterSpacing: '-0.5px',
                        }}>
                            {headerText}
                        </h2>
                        <p style={{
                            margin: '6px 0 0',
                            fontSize: '14px',
                            color: 'rgba(255, 255, 255, 0.5)',
                        }}>
                            Build: {buildId.slice(0, 8)}...
                        </p>
                    </div>

                    {/* Status Badge */}
                    <motion.div
                        style={{
                            padding: '8px 16px',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: 600,
                            background: overallStatus === 'success'
                                ? 'linear-gradient(135deg, rgba(120, 255, 150, 0.2) 0%, rgba(100, 220, 130, 0.1) 100%)'
                                : overallStatus === 'error'
                                    ? 'linear-gradient(135deg, rgba(255, 100, 100, 0.2) 0%, rgba(220, 80, 80, 0.1) 100%)'
                                    : 'linear-gradient(135deg, rgba(100, 180, 255, 0.2) 0%, rgba(80, 160, 255, 0.1) 100%)',
                            color: overallStatus === 'success'
                                ? 'rgba(120, 255, 150, 0.95)'
                                : overallStatus === 'error'
                                    ? 'rgba(255, 100, 100, 0.95)'
                                    : 'rgba(100, 180, 255, 0.95)',
                            border: `1px solid ${overallStatus === 'success'
                                ? 'rgba(120, 255, 150, 0.3)'
                                : overallStatus === 'error'
                                    ? 'rgba(255, 100, 100, 0.3)'
                                    : 'rgba(100, 180, 255, 0.3)'}`,
                        }}
                        animate={overallStatus === 'installing' ? {
                            boxShadow: [
                                '0 0 12px rgba(100, 180, 255, 0.2)',
                                '0 0 20px rgba(100, 180, 255, 0.4)',
                                '0 0 12px rgba(100, 180, 255, 0.2)',
                            ],
                        } : {}}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    >
                        {overallStatus === 'installing' && 'Installing...'}
                        {overallStatus === 'success' && 'Complete'}
                        {overallStatus === 'error' && 'Failed'}
                        {overallStatus === 'cancelled' && 'Cancelled'}
                    </motion.div>
                </div>

                {/* Progress Bar */}
                <div style={{
                    marginTop: '20px',
                    height: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                }}>
                    <motion.div
                        style={{
                            height: '100%',
                            borderRadius: '4px',
                            background: overallStatus === 'error'
                                ? 'linear-gradient(90deg, rgba(255, 100, 100, 0.8), rgba(220, 80, 80, 0.9))'
                                : overallStatus === 'success'
                                    ? 'linear-gradient(90deg, rgba(120, 255, 150, 0.8), rgba(100, 220, 130, 0.9))'
                                    : 'linear-gradient(90deg, rgba(100, 180, 255, 0.8), rgba(80, 160, 255, 0.9))',
                            boxShadow: overallStatus === 'error'
                                ? '0 0 12px rgba(255, 100, 100, 0.4)'
                                : overallStatus === 'success'
                                    ? '0 0 12px rgba(120, 255, 150, 0.4)'
                                    : '0 0 12px rgba(100, 180, 255, 0.4)',
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                </div>

                {/* Stats */}
                <div style={{
                    display: 'flex',
                    gap: '24px',
                    marginTop: '16px',
                    fontSize: '13px',
                    color: 'rgba(255, 255, 255, 0.5)',
                }}>
                    <span>
                        <span style={{ color: 'rgba(120, 255, 150, 0.9)', fontWeight: 600 }}>
                            {statusCounts.success}
                        </span> installed
                    </span>
                    {statusCounts.installing > 0 && (
                        <span>
                            <span style={{ color: 'rgba(100, 180, 255, 0.9)', fontWeight: 600 }}>
                                {statusCounts.installing}
                            </span> installing
                        </span>
                    )}
                    {statusCounts.pending > 0 && (
                        <span>
                            <span style={{ fontWeight: 600 }}>{statusCounts.pending}</span> pending
                        </span>
                    )}
                    {statusCounts.error > 0 && (
                        <span>
                            <span style={{ color: 'rgba(255, 100, 100, 0.9)', fontWeight: 600 }}>
                                {statusCounts.error}
                            </span> failed
                        </span>
                    )}
                </div>
            </motion.div>

            {/* Dependency List */}
            <div style={dependencyListStyle}>
                <AnimatePresence>
                    {dependencies.map((dep, index) => (
                        <motion.div
                            key={dep.id}
                            style={dependencyItemStyle}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3, delay: index * 0.03 }}
                        >
                            <StatusIcon status={dep.status} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}>
                                    {dep.name}
                                </div>
                                {dep.version && (
                                    <div style={{
                                        fontSize: '11px',
                                        color: 'rgba(255, 255, 255, 0.4)',
                                        marginTop: '2px',
                                    }}>
                                        v{dep.version}
                                    </div>
                                )}
                                {dep.errorMessage && (
                                    <div style={{
                                        fontSize: '11px',
                                        color: 'rgba(255, 100, 100, 0.8)',
                                        marginTop: '2px',
                                    }}>
                                        {dep.errorMessage}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Terminal Output */}
            <motion.div
                style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '20px',
                    padding: '20px',
                    marginBottom: '24px',
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                }}>
                    <div style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'rgba(255, 255, 255, 0.7)',
                    }}>
                        Output
                    </div>
                    <button
                        onClick={() => setAutoScroll(true)}
                        style={{
                            padding: '4px 12px',
                            fontSize: '12px',
                            background: autoScroll
                                ? 'rgba(100, 180, 255, 0.2)'
                                : 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: autoScroll
                                ? 'rgba(100, 180, 255, 0.9)'
                                : 'rgba(255, 255, 255, 0.5)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
                    </button>
                </div>

                <div
                    ref={terminalRef}
                    style={terminalStyle}
                    onScroll={handleScroll}
                >
                    {streamLines.length === 0 ? (
                        <div style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                            Waiting for output...
                        </div>
                    ) : (
                        streamLines.map((line, index) => (
                            <StreamLineItem key={line.id} line={line} index={index} />
                        ))
                    )}
                </div>
            </motion.div>

            {/* Action Buttons */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '16px',
            }}>
                {overallStatus === 'installing' && onCancel && (
                    <motion.button
                        style={{
                            padding: '14px 32px',
                            fontSize: '15px',
                            fontWeight: 500,
                            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '12px',
                            color: 'rgba(255, 255, 255, 0.7)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                        whileHover={{
                            background: 'linear-gradient(135deg, rgba(255, 100, 100, 0.15) 0%, rgba(220, 80, 80, 0.1) 100%)',
                            borderColor: 'rgba(255, 100, 100, 0.3)',
                            color: 'rgba(255, 100, 100, 0.9)',
                        }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onCancel}
                    >
                        Cancel
                    </motion.button>
                )}

                {overallStatus === 'error' && onRetry && (
                    <motion.button
                        style={{
                            padding: '14px 32px',
                            fontSize: '15px',
                            fontWeight: 500,
                            background: 'linear-gradient(135deg, rgba(255, 200, 100, 0.2) 0%, rgba(255, 180, 80, 0.15) 100%)',
                            border: '1px solid rgba(255, 200, 100, 0.3)',
                            borderRadius: '12px',
                            color: 'rgba(255, 200, 100, 0.95)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                        whileHover={{
                            scale: 1.02,
                            boxShadow: '0 8px 24px rgba(255, 200, 100, 0.2)',
                        }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onRetry}
                    >
                        Retry Installation
                    </motion.button>
                )}

                {overallStatus === 'success' && onComplete && (
                    <motion.button
                        style={{
                            padding: '16px 40px',
                            fontSize: '16px',
                            fontWeight: 600,
                            background: 'linear-gradient(135deg, rgba(120, 255, 150, 0.9) 0%, rgba(100, 220, 130, 0.95) 100%)',
                            border: 'none',
                            borderRadius: '14px',
                            color: 'rgba(0, 0, 0, 0.9)',
                            cursor: 'pointer',
                            boxShadow: '0 8px 32px rgba(120, 255, 150, 0.3)',
                            transition: 'all 0.2s',
                        }}
                        whileHover={{
                            scale: 1.02,
                            boxShadow: '0 12px 40px rgba(120, 255, 150, 0.4)',
                        }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onComplete}
                    >
                        Continue to Build
                    </motion.button>
                )}
            </div>
        </div>
    );
};

export default DependencyInstallView;
