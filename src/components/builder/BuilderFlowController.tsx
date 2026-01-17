/**
 * Builder Flow Controller
 *
 * Orchestrates the complete builder flow, rendering the appropriate
 * view based on the current phase. Integrates all new builder components:
 *
 * - Plan modification UI (PlanPhaseCard, ReconfigurePlanButton)
 * - Dependency connection (DependencyConnectionView)
 * - Dependency installation (DependencyInstallView)
 * - Resource approval (ResourceApprovalView)
 * - Deployment status
 *
 * Premium 3D liquid glass styling throughout.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    useBuilderFlowStore,
    type BuilderFlowPhase,
} from '../../store/builder-flow-store';
import { usePlanModificationStore } from '../../store/plan-modification-store';
import { DependencyConnectionView } from './dependencies/DependencyConnectionView';
import { DependencyInstallView } from './dependencies/DependencyInstallView';
import { ResourceApprovalView } from './resources/ResourceApprovalView';
import { PlanPhaseCard } from './plan/PlanPhaseCard';
import { ReconfigurePlanButton, type ReconfigurationPayload } from './plan/ReconfigurePlanButton';
import { apiClient } from '../../lib/api-client';

// =============================================================================
// Types
// =============================================================================

interface BuilderFlowControllerProps {
    buildId: string;
    projectId: string;
    onPhaseComplete?: (phase: BuilderFlowPhase) => void;
    onBuildComplete?: () => void;
    onError?: (error: string) => void;
}

// =============================================================================
// Styles
// =============================================================================

const containerStyles: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    minHeight: '400px',
};

const phaseIndicatorStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '16px 24px',
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    marginBottom: '24px',
};

const phaseStepStyles = (isActive: boolean, isCompleted: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '12px',
    background: isActive
        ? 'linear-gradient(135deg, rgba(147, 197, 253, 0.3) 0%, rgba(59, 130, 246, 0.2) 100%)'
        : isCompleted
        ? 'linear-gradient(135deg, rgba(134, 239, 172, 0.2) 0%, rgba(34, 197, 94, 0.1) 100%)'
        : 'rgba(255, 255, 255, 0.05)',
    border: `1px solid ${
        isActive
            ? 'rgba(147, 197, 253, 0.4)'
            : isCompleted
            ? 'rgba(134, 239, 172, 0.3)'
            : 'rgba(255, 255, 255, 0.08)'
    }`,
    color: isActive ? '#93c5fd' : isCompleted ? '#86efac' : 'rgba(255, 255, 255, 0.5)',
    fontSize: '13px',
    fontWeight: isActive ? 600 : 500,
    transition: 'all 0.3s ease',
});

const errorBannerStyles: React.CSSProperties = {
    padding: '16px 24px',
    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.1) 100%)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    marginBottom: '24px',
    color: '#fca5a5',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
};

// =============================================================================
// Phase Display Names
// =============================================================================

const PHASE_DISPLAY_NAMES: Record<BuilderFlowPhase, string> = {
    idle: 'Ready',
    plan_review: 'Plan Review',
    dependency_connect: 'Connect Integrations',
    dependency_install: 'Installing Dependencies',
    resource_approval: 'Resource Approval',
    build: 'Building',
    deployment: 'Deploying',
    complete: 'Complete',
    error: 'Error',
};

const VISIBLE_PHASES: BuilderFlowPhase[] = [
    'plan_review',
    'dependency_connect',
    'dependency_install',
    'resource_approval',
    'build',
    'deployment',
    'complete',
];

// =============================================================================
// Component
// =============================================================================

export function BuilderFlowController({
    buildId,
    projectId,
    onPhaseComplete,
    onBuildComplete,
    onError,
}: BuilderFlowControllerProps) {
    const flowStore = useBuilderFlowStore();
    const planStore = usePlanModificationStore();

    // State for resource approval view
    const [resourceLoading, setResourceLoading] = useState(false);
    // These will be populated from the build configuration
    const modelRequirements = 'AI model inference';
    const minVramGb = 16;
    const estimatedRuntimeMinutes = 60;

    const {
        currentPhase,
        error,
        dependencies,
        connectedDependencies,
        installStatus,
        installStreamLines,
        installProgress,
        resourceRecommendations,
        deploymentStatus,
        deploymentEndpointUrl,
        deploymentInferenceCode,
        initializeBuild,
        setPhase,
        nextPhase,
        setError,
        markDependencyConnected,
        completeDependencyConnection,
        completeInstallation,
        completeResourceApproval,
        getProgress,
    } = flowStore;

    // Initialize build on mount
    useEffect(() => {
        if (buildId && projectId) {
            initializeBuild(buildId, projectId);
        }
    }, [buildId, projectId, initializeBuild]);

    // Notify parent of phase changes
    useEffect(() => {
        if (currentPhase !== 'idle' && currentPhase !== 'error') {
            onPhaseComplete?.(currentPhase);
        }
        if (currentPhase === 'complete') {
            onBuildComplete?.();
        }
    }, [currentPhase, onPhaseComplete, onBuildComplete]);

    // Notify parent of errors
    useEffect(() => {
        if (error) {
            onError?.(error);
        }
    }, [error, onError]);

    // =========================================================================
    // Handlers
    // =========================================================================

    const handlePlanReconfigure = useCallback(async (modifications: ReconfigurationPayload) => {
        try {
            // Call backend to reconfigure plan
            await apiClient.post(`/api/plan/${buildId}/reconfigure`, modifications);
            // Plan will be updated via store subscription or re-fetch
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reconfigure plan');
            throw err;
        }
    }, [buildId, setError]);

    const handlePlanApprove = useCallback(async () => {
        try {
            planStore.approvePlan();
            flowStore.approvePlan();
            nextPhase();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to approve plan');
        }
    }, [planStore, flowStore, nextPhase, setError]);

    const handleCredentialsSaved = useCallback(async (integrationId: string, credentials: Record<string, string>) => {
        try {
            await apiClient.post(`/api/credentials/${buildId}/${integrationId}`, { credentials });
            markDependencyConnected(integrationId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save credentials');
        }
    }, [buildId, markDependencyConnected, setError]);

    const handleNangoConnect = useCallback(async (integrationId: string) => {
        try {
            // Nango connection is handled via OAuth flow
            // Mark as connected after successful OAuth callback
            markDependencyConnected(integrationId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to connect via Nango');
        }
    }, [markDependencyConnected, setError]);

    const handleDependencyConnectionComplete = useCallback(() => {
        completeDependencyConnection();
        nextPhase();
    }, [completeDependencyConnection, nextPhase]);

    const handleInstallationComplete = useCallback(() => {
        completeInstallation();
        nextPhase();
    }, [completeInstallation, nextPhase]);

    const handleResourceApproval = useCallback(async (resourceId: string, estimatedCost: number) => {
        try {
            setResourceLoading(true);
            await apiClient.post(`/api/resources/${buildId}/approve`, {
                resourceId,
                estimatedCost,
            });
            completeResourceApproval();
            nextPhase();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to approve resources');
        } finally {
            setResourceLoading(false);
        }
    }, [buildId, completeResourceApproval, nextPhase, setError]);

    const handleResourceDecline = useCallback(() => {
        completeResourceApproval();
        // Skip to build without GPU
        setPhase('build');
    }, [completeResourceApproval, setPhase]);

    const handleResourceRefresh = useCallback(async () => {
        try {
            setResourceLoading(true);
            // Refresh resource availability from backend
            await apiClient.get(`/api/runpod/gpus`);
            // Update would happen via store - this is just to trigger refresh
        } catch (err) {
            console.error('Failed to refresh resources:', err);
        } finally {
            setResourceLoading(false);
        }
    }, []);

    // =========================================================================
    // Render Helpers
    // =========================================================================

    const renderPhaseIndicator = () => {
        const { completedPhases } = getProgress();

        return (
            <div style={phaseIndicatorStyles}>
                {VISIBLE_PHASES.map((phase, index) => {
                    const isActive = phase === currentPhase;
                    const isCompleted = completedPhases.includes(phase);

                    return (
                        <React.Fragment key={phase}>
                            <div style={phaseStepStyles(isActive, isCompleted)}>
                                {isCompleted && (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                        <path
                                            d="M20 6L9 17L4 12"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                )}
                                {PHASE_DISPLAY_NAMES[phase]}
                            </div>
                            {index < VISIBLE_PHASES.length - 1 && (
                                <div
                                    style={{
                                        width: '24px',
                                        height: '2px',
                                        background: isCompleted
                                            ? 'rgba(134, 239, 172, 0.4)'
                                            : 'rgba(255, 255, 255, 0.1)',
                                        borderRadius: '1px',
                                    }}
                                />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    const renderPlanReview = () => {
        const plan = planStore.planState.originalPlan;
        if (!plan) return null;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px',
                    }}
                >
                    <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: 600, margin: 0 }}>
                        Implementation Plan
                    </h3>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <ReconfigurePlanButton
                            buildId={buildId}
                            onReconfigure={handlePlanReconfigure}
                            onError={(err) => setError(err.message)}
                        />
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handlePlanApprove}
                            style={{
                                padding: '12px 24px',
                                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                border: 'none',
                                borderRadius: '12px',
                                color: '#fff',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                boxShadow: '0 4px 20px rgba(34, 197, 94, 0.3)',
                            }}
                        >
                            Approve Plan
                        </motion.button>
                    </div>
                </div>
                {plan.phases.map((phase, index) => (
                    <PlanPhaseCard
                        key={phase.id}
                        phase={phase}
                        phaseIndex={index}
                        isApproved={planStore.planState.isApproved}
                    />
                ))}
            </div>
        );
    };

    const renderDependencyConnection = () => {
        // Convert DependencyData[] to string[] of integration IDs
        const requiredIntegrations = dependencies.map(d => d.id);

        return (
            <DependencyConnectionView
                requiredIntegrations={requiredIntegrations}
                buildId={buildId}
                connectedIntegrations={connectedDependencies}
                onCredentialsSaved={handleCredentialsSaved}
                onNangoConnect={handleNangoConnect}
                onContinue={handleDependencyConnectionComplete}
            />
        );
    };

    const renderDependencyInstallation = () => {
        return (
            <DependencyInstallView
                buildId={buildId}
                dependencies={installStatus}
                streamLines={installStreamLines}
                overallStatus={installProgress >= 100 ? 'success' : 'installing'}
                progressPercent={installProgress}
                onComplete={handleInstallationComplete}
            />
        );
    };

    const renderResourceApproval = () => {
        if (resourceRecommendations.length === 0) {
            // Skip if no resources needed
            return (
                <div
                    style={{
                        padding: '48px',
                        textAlign: 'center',
                        color: 'rgba(255, 255, 255, 0.6)',
                    }}
                >
                    <p>No GPU resources required for this build.</p>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => nextPhase()}
                        style={{
                            marginTop: '16px',
                            padding: '12px 24px',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            border: 'none',
                            borderRadius: '12px',
                            color: '#fff',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Continue to Build
                    </motion.button>
                </div>
            );
        }

        return (
            <ResourceApprovalView
                buildId={buildId}
                modelRequirements={modelRequirements}
                minVramGb={minVramGb}
                estimatedRuntimeMinutes={estimatedRuntimeMinutes}
                recommendations={resourceRecommendations}
                loading={resourceLoading}
                onApprove={handleResourceApproval}
                onDecline={handleResourceDecline}
                onRefresh={handleResourceRefresh}
            />
        );
    };

    const renderBuildingState = () => {
        return (
            <div
                style={{
                    padding: '48px',
                    textAlign: 'center',
                }}
            >
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    style={{
                        width: '64px',
                        height: '64px',
                        margin: '0 auto 24px',
                        borderRadius: '50%',
                        border: '3px solid rgba(59, 130, 246, 0.2)',
                        borderTopColor: '#3b82f6',
                    }}
                />
                <h3 style={{ color: '#fff', fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
                    Building Your Application
                </h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
                    Our AI agents are working on your project...
                </p>
            </div>
        );
    };

    const renderDeploymentState = () => {
        return (
            <div
                style={{
                    padding: '32px',
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
            >
                <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
                    Deployment Status
                </h3>

                {deploymentStatus === 'deploying' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                            style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                border: '2px solid rgba(59, 130, 246, 0.2)',
                                borderTopColor: '#3b82f6',
                            }}
                        />
                        <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                            Deploying to RunPod...
                        </span>
                    </div>
                )}

                {deploymentStatus === 'active' && deploymentEndpointUrl && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div
                            style={{
                                padding: '16px',
                                background: 'rgba(34, 197, 94, 0.1)',
                                borderRadius: '12px',
                                border: '1px solid rgba(34, 197, 94, 0.2)',
                            }}
                        >
                            <div style={{ color: '#86efac', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                                Endpoint Active
                            </div>
                            <code
                                style={{
                                    display: 'block',
                                    padding: '8px 12px',
                                    background: 'rgba(0, 0, 0, 0.3)',
                                    borderRadius: '8px',
                                    color: '#93c5fd',
                                    fontSize: '12px',
                                    wordBreak: 'break-all',
                                }}
                            >
                                {deploymentEndpointUrl}
                            </code>
                        </div>

                        {deploymentInferenceCode && (
                            <div>
                                <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px', marginBottom: '8px' }}>
                                    Example Request (TypeScript):
                                </div>
                                <pre
                                    style={{
                                        padding: '16px',
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        borderRadius: '12px',
                                        color: '#93c5fd',
                                        fontSize: '12px',
                                        overflow: 'auto',
                                        maxHeight: '200px',
                                    }}
                                >
                                    {deploymentInferenceCode.typescript}
                                </pre>
                            </div>
                        )}

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => nextPhase()}
                            style={{
                                padding: '12px 24px',
                                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                border: 'none',
                                borderRadius: '12px',
                                color: '#fff',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                alignSelf: 'flex-end',
                            }}
                        >
                            Complete Build
                        </motion.button>
                    </div>
                )}
            </div>
        );
    };

    const renderCompleteState = () => {
        return (
            <div
                style={{
                    padding: '48px',
                    textAlign: 'center',
                }}
            >
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    style={{
                        width: '80px',
                        height: '80px',
                        margin: '0 auto 24px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(16, 163, 74, 0.2) 100%)',
                        border: '2px solid rgba(34, 197, 94, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                        <path
                            d="M20 6L9 17L4 12"
                            stroke="#22c55e"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </motion.div>
                <h3 style={{ color: '#fff', fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>
                    Build Complete!
                </h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
                    Your application is ready.
                </p>
            </div>
        );
    };

    const renderCurrentPhase = () => {
        switch (currentPhase) {
            case 'idle':
                return null;
            case 'plan_review':
                return renderPlanReview();
            case 'dependency_connect':
                return renderDependencyConnection();
            case 'dependency_install':
                return renderDependencyInstallation();
            case 'resource_approval':
                return renderResourceApproval();
            case 'build':
                return renderBuildingState();
            case 'deployment':
                return renderDeploymentState();
            case 'complete':
                return renderCompleteState();
            case 'error':
                return null; // Error shown in banner
            default:
                return null;
        }
    };

    // =========================================================================
    // Render
    // =========================================================================

    return (
        <div style={containerStyles}>
            {/* Phase Progress Indicator */}
            {currentPhase !== 'idle' && currentPhase !== 'error' && renderPhaseIndicator()}

            {/* Error Banner */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        style={errorBannerStyles}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                            <path d="M12 8v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <circle cx="12" cy="16" r="1" fill="currentColor" />
                        </svg>
                        <span>{error}</span>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setError(null)}
                            style={{
                                marginLeft: 'auto',
                                padding: '6px 12px',
                                background: 'rgba(239, 68, 68, 0.2)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '8px',
                                color: '#fca5a5',
                                fontSize: '12px',
                                cursor: 'pointer',
                            }}
                        >
                            Dismiss
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Current Phase Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentPhase}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                >
                    {renderCurrentPhase()}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

export default BuilderFlowController;
