/**
 * ResourceApprovalView Component
 *
 * Premium 3D liquid glass view for approving GPU/cloud resources.
 * Shows real-time GPU availability, pricing, and allows user to
 * approve resource allocation for ML model deployment.
 *
 * Features:
 * - Real-time GPU availability display
 * - Cost estimation and comparison
 * - Resource recommendation cards
 * - Approve charges button with metered billing
 * - Premium liquid glass styling
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// =============================================================================
// Types
// =============================================================================

export interface GPUResource {
    id: string;
    provider: string;
    gpuType: string;
    gpuModel: string;
    vramGb: number;
    cpuCores: number;
    memoryGb: number;
    available: boolean;
    availableCount: number;
    region: string;
    pricePerHour: number;
    spotAvailable?: boolean;
    spotPrice?: number;
}

export interface ResourceRecommendation {
    resource: GPUResource;
    score: number;
    estimatedCost: number;
    reasons: string[];
}

export interface ResourceApprovalViewProps {
    /** Build ID for billing */
    buildId: string;
    /** Model requirements description */
    modelRequirements: string;
    /** Minimum VRAM needed in GB */
    minVramGb: number;
    /** Estimated runtime in minutes */
    estimatedRuntimeMinutes: number;
    /** Resource recommendations from backend */
    recommendations: ResourceRecommendation[];
    /** Loading state */
    loading?: boolean;
    /** Callback when user approves resources */
    onApprove: (resourceId: string, estimatedCost: number) => Promise<void>;
    /** Callback when user declines */
    onDecline: () => void;
    /** Refresh availability callback */
    onRefresh?: () => void;
}

// =============================================================================
// Styles
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
    padding: '32px 40px',
    marginBottom: '32px',
    boxShadow: `
        0 8px 32px rgba(0, 0, 0, 0.4),
        0 0 60px rgba(255, 200, 150, 0.05),
        inset 0 1px 0 rgba(255, 255, 255, 0.1)
    `,
};

const resourceCardStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)',
    backdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '16px',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
};

// =============================================================================
// Helper Components
// =============================================================================

const ProviderBadge: React.FC<{ provider: string }> = ({ provider }) => {
    const colors: Record<string, { bg: string; text: string }> = {
        runpod: { bg: 'rgba(138, 43, 226, 0.2)', text: 'rgba(180, 120, 255, 0.95)' },
        replicate: { bg: 'rgba(255, 165, 0, 0.2)', text: 'rgba(255, 200, 100, 0.95)' },
        modal: { bg: 'rgba(0, 191, 255, 0.2)', text: 'rgba(100, 220, 255, 0.95)' },
    };

    const style = colors[provider] || { bg: 'rgba(255, 255, 255, 0.1)', text: 'rgba(255, 255, 255, 0.7)' };

    return (
        <span
            style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                background: style.bg,
                color: style.text,
                borderRadius: '6px',
                border: `1px solid ${style.text}33`,
            }}
        >
            {provider}
        </span>
    );
};

const ScoreBadge: React.FC<{ score: number }> = ({ score }) => {
    const getColor = () => {
        if (score >= 120) return { bg: 'rgba(245, 166, 35, 0.25)', text: 'rgba(255, 184, 77, 0.95)' };
        if (score >= 100) return { bg: 'rgba(255, 200, 100, 0.2)', text: 'rgba(255, 200, 100, 0.95)' };
        return { bg: 'rgba(255, 255, 255, 0.1)', text: 'rgba(255, 255, 255, 0.7)' };
    };

    const style = getColor();

    return (
        <span
            style={{
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 600,
                background: style.bg,
                color: style.text,
                borderRadius: '6px',
            }}
        >
            Score: {score}
        </span>
    );
};

// =============================================================================
// Component
// =============================================================================

export const ResourceApprovalView: React.FC<ResourceApprovalViewProps> = ({
    buildId: _buildId, // Reserved for billing integration
    modelRequirements,
    minVramGb,
    estimatedRuntimeMinutes,
    recommendations,
    loading = false,
    onApprove,
    onDecline,
    onRefresh,
}) => {
    const [selectedResource, setSelectedResource] = useState<string | null>(null);
    const [approving, setApproving] = useState(false);

    // Auto-select best recommendation
    useEffect(() => {
        if (recommendations.length > 0 && !selectedResource) {
            setSelectedResource(recommendations[0].resource.id);
        }
    }, [recommendations, selectedResource]);

    const handleApprove = useCallback(async () => {
        if (!selectedResource) return;

        const recommendation = recommendations.find(r => r.resource.id === selectedResource);
        if (!recommendation) return;

        setApproving(true);
        try {
            await onApprove(selectedResource, recommendation.estimatedCost);
        } finally {
            setApproving(false);
        }
    }, [selectedResource, recommendations, onApprove]);

    const selectedRecommendation = recommendations.find(r => r.resource.id === selectedResource);

    return (
        <div style={containerStyle}>
            {/* Header */}
            <motion.div
                style={headerCardStyle}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                        <h2 style={{
                            margin: 0,
                            fontSize: '28px',
                            fontWeight: 600,
                            color: 'rgba(255, 255, 255, 0.95)',
                            letterSpacing: '-0.5px',
                        }}>
                            GPU Resources Required
                        </h2>
                        <p style={{
                            margin: '8px 0 0',
                            fontSize: '15px',
                            color: 'rgba(255, 255, 255, 0.6)',
                            maxWidth: '600px',
                        }}>
                            Your build requires GPU resources for: {modelRequirements}
                        </p>
                    </div>

                    {onRefresh && (
                        <button
                            style={{
                                padding: '10px 20px',
                                fontSize: '13px',
                                fontWeight: 500,
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '8px',
                                color: 'rgba(255, 255, 255, 0.7)',
                                cursor: 'pointer',
                            }}
                            onClick={onRefresh}
                            disabled={loading}
                        >
                            {loading ? 'Refreshing...' : 'Refresh Availability'}
                        </button>
                    )}
                </div>

                {/* Requirements Summary */}
                <div style={{
                    display: 'flex',
                    gap: '32px',
                    marginTop: '24px',
                    padding: '16px 20px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '12px',
                }}>
                    <div>
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px' }}>
                            Minimum VRAM
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 600, color: 'rgba(255, 200, 150, 0.95)' }}>
                            {minVramGb} GB
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px' }}>
                            Est. Runtime
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 600, color: 'rgba(255, 200, 150, 0.95)' }}>
                            {estimatedRuntimeMinutes} min
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px' }}>
                            Available Options
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 600, color: 'rgba(255, 184, 77, 0.95)' }}>
                            {recommendations.length}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Resource Cards */}
            <div style={{ marginBottom: '32px' }}>
                <h3 style={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: 'rgba(255, 255, 255, 0.8)',
                    marginBottom: '16px',
                }}>
                    Recommended Resources
                </h3>

                <AnimatePresence>
                    {recommendations.map((rec, index) => (
                        <motion.div
                            key={rec.resource.id}
                            style={{
                                ...resourceCardStyle,
                                borderColor: selectedResource === rec.resource.id
                                    ? 'rgba(120, 200, 255, 0.4)'
                                    : 'rgba(255, 255, 255, 0.1)',
                                boxShadow: selectedResource === rec.resource.id
                                    ? '0 8px 32px rgba(120, 200, 255, 0.15), 0 0 40px rgba(120, 200, 255, 0.08)'
                                    : '0 4px 20px rgba(0, 0, 0, 0.2)',
                            }}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            onClick={() => setSelectedResource(rec.resource.id)}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                        <ProviderBadge provider={rec.resource.provider} />
                                        <span style={{
                                            fontSize: '18px',
                                            fontWeight: 600,
                                            color: 'rgba(255, 255, 255, 0.95)',
                                        }}>
                                            {rec.resource.gpuModel}
                                        </span>
                                        <ScoreBadge score={rec.score} />
                                        {index === 0 && (
                                            <span style={{
                                                padding: '4px 10px',
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                                background: 'linear-gradient(135deg, rgba(245, 166, 35, 0.95), rgba(232, 139, 16, 0.95))',
                                                color: 'rgba(255, 255, 255, 0.95)',
                                                borderRadius: '4px',
                                            }}>
                                                Best Match
                                            </span>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', gap: '24px', marginBottom: '12px' }}>
                                        <div>
                                            <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' }}>VRAM: </span>
                                            <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.85)' }}>
                                                {rec.resource.vramGb} GB
                                            </span>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' }}>CPU: </span>
                                            <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.85)' }}>
                                                {rec.resource.cpuCores} cores
                                            </span>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' }}>Available: </span>
                                            <span style={{
                                                fontSize: '14px',
                                                color: rec.resource.availableCount > 5
                                                    ? 'rgba(255, 184, 77, 0.95)'
                                                    : 'rgba(255, 200, 100, 0.9)',
                                            }}>
                                                {rec.resource.availableCount} units
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {rec.reasons.slice(0, 3).map((reason, i) => (
                                            <span
                                                key={i}
                                                style={{
                                                    padding: '4px 10px',
                                                    fontSize: '12px',
                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                    borderRadius: '4px',
                                                    color: 'rgba(255, 255, 255, 0.6)',
                                                }}
                                            >
                                                {reason}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ textAlign: 'right', minWidth: '140px' }}>
                                    <div style={{
                                        fontSize: '24px',
                                        fontWeight: 700,
                                        color: 'rgba(255, 200, 150, 0.95)',
                                    }}>
                                        ${rec.resource.pricePerHour.toFixed(2)}
                                        <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255, 255, 255, 0.5)' }}>
                                            /hr
                                        </span>
                                    </div>
                                    {rec.resource.spotAvailable && rec.resource.spotPrice && (
                                        <div style={{
                                            fontSize: '12px',
                                            color: 'rgba(255, 184, 77, 0.85)',
                                            marginTop: '4px',
                                        }}>
                                            Spot: ${rec.resource.spotPrice.toFixed(2)}/hr
                                        </div>
                                    )}
                                    <div style={{
                                        marginTop: '8px',
                                        padding: '8px 12px',
                                        background: 'rgba(255, 200, 150, 0.1)',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: 'rgba(255, 200, 150, 0.95)',
                                    }}>
                                        Est: ${rec.estimatedCost.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Action Buttons */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '16px',
                padding: '20px 0',
            }}>
                <motion.button
                    style={{
                        padding: '16px 32px',
                        fontSize: '14px',
                        fontWeight: 500,
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '12px',
                        color: 'rgba(255, 255, 255, 0.7)',
                        cursor: 'pointer',
                    }}
                    whileHover={{
                        borderColor: 'rgba(255, 255, 255, 0.4)',
                        color: 'rgba(255, 255, 255, 0.9)',
                    }}
                    onClick={onDecline}
                >
                    Cancel Build
                </motion.button>

                <motion.button
                    style={{
                        padding: '16px 40px',
                        fontSize: '15px',
                        fontWeight: 600,
                        background: selectedResource
                            ? 'linear-gradient(135deg, rgba(245, 166, 35, 0.95) 0%, rgba(232, 139, 16, 0.95) 100%)'
                            : 'rgba(255, 255, 255, 0.1)',
                        border: 'none',
                        borderRadius: '12px',
                        color: selectedResource ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.4)',
                        cursor: selectedResource ? 'pointer' : 'default',
                        boxShadow: selectedResource
                            ? '0 8px 32px rgba(245, 166, 35, 0.35), 0 0 40px rgba(232, 139, 16, 0.2)'
                            : 'none',
                    }}
                    whileHover={selectedResource ? {
                        scale: 1.02,
                        boxShadow: '0 12px 40px rgba(245, 166, 35, 0.45), 0 0 60px rgba(232, 139, 16, 0.25)',
                    } : {}}
                    whileTap={selectedResource ? { scale: 0.98 } : {}}
                    onClick={handleApprove}
                    disabled={!selectedResource || approving}
                >
                    {approving ? (
                        <>
                            <motion.span
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                style={{ display: 'inline-block', marginRight: '8px' }}
                            >
                                ◌
                            </motion.span>
                            Provisioning...
                        </>
                    ) : selectedRecommendation ? (
                        `Approve Charges ($${selectedRecommendation.estimatedCost.toFixed(2)})`
                    ) : (
                        'Select a Resource'
                    )}
                </motion.button>
            </div>

            {/* Billing Note */}
            <div style={{
                textAlign: 'center',
                fontSize: '13px',
                color: 'rgba(255, 255, 255, 0.4)',
                marginTop: '8px',
            }}>
                Charges are metered per-second and billed through your KripTik account.
                <br />
                You can cancel at any time and only pay for actual usage.
            </div>
        </div>
    );
};

export default ResourceApprovalView;
