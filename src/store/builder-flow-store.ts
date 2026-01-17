/**
 * Builder Flow Store
 *
 * Unified Zustand store for managing the complete builder flow.
 * Orchestrates all phases from plan approval through deployment.
 *
 * Flow Phases:
 * 1. PLAN_REVIEW - Review/modify implementation plan
 * 2. DEPENDENCY_CONNECT - Connect required integrations
 * 3. DEPENDENCY_INSTALL - Install dependencies (streaming)
 * 4. RESOURCE_APPROVAL - Approve GPU/cloud resources
 * 5. BUILD - Execute the build
 * 6. DEPLOYMENT - Deploy model (if applicable)
 * 7. COMPLETE - Build complete
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { DependencyData, DependencyInstallStatus, StreamLine } from '../components/builder/dependencies';
import type { ResourceRecommendation } from '../components/builder/resources/ResourceApprovalView';

// =============================================================================
// Types
// =============================================================================

export type BuilderFlowPhase =
    | 'idle'
    | 'plan_generation'      // NEW: Generate implementation plan from prompt
    | 'plan_review'          // Review/modify generated plan
    | 'intent_lock'          // NEW: Lock intent and create sacred contract
    | 'dependency_connect'   // Connect required integrations
    | 'dependency_install'   // Install dependencies (streaming)
    | 'resource_approval'    // Approve GPU/cloud resources
    | 'build'                // Execute the build
    | 'deployment'           // Deploy model (if applicable)
    | 'complete'             // Build complete
    | 'error';

export interface BuilderFlowState {
    // Core state
    buildId: string | null;
    projectId: string | null;
    currentPhase: BuilderFlowPhase;
    error: string | null;

    // Plan generation state
    userPrompt: string | null;
    planGenerating: boolean;
    planGenerated: boolean;

    // Plan review state
    planApproved: boolean;

    // Intent lock state
    intentLocked: boolean;

    // Dependency connection state
    dependencies: DependencyData[];
    connectedDependencies: Set<string>;
    dependencyConnectionComplete: boolean;

    // Dependency installation state
    installStatus: DependencyInstallStatus[];
    installStreamLines: StreamLine[];
    installProgress: number;
    installComplete: boolean;

    // Resource approval state
    resourceRecommendations: ResourceRecommendation[];
    approvedResources: Set<string>;
    resourceApprovalComplete: boolean;
    estimatedCostCents: number;

    // Deployment state
    deploymentStatus: 'idle' | 'pending_approval' | 'deploying' | 'active' | 'error';
    deploymentEndpointUrl: string | null;
    deploymentAllocationId: string | null;
    deploymentInferenceCode: {
        python: string;
        typescript: string;
        curl: string;
    } | null;

    // Timestamps
    phaseStartTime: number | null;
    buildStartTime: number | null;
}

interface BuilderFlowActions {
    // Flow control
    initializeBuild: (buildId: string, projectId: string) => void;
    startPlanGeneration: (prompt: string) => void;
    setPhase: (phase: BuilderFlowPhase) => void;
    nextPhase: () => void;
    setError: (error: string | null) => void;
    reset: () => void;

    // Plan generation actions
    setPlanGenerating: (generating: boolean) => void;
    completePlanGeneration: () => void;

    // Plan actions
    approvePlan: () => void;

    // Intent lock actions
    lockIntent: () => void;

    // Dependency connection actions
    setDependencies: (dependencies: DependencyData[]) => void;
    markDependencyConnected: (dependencyId: string) => void;
    markDependencyDisconnected: (dependencyId: string) => void;
    completeDependencyConnection: () => void;

    // Dependency installation actions
    setInstallStatus: (status: DependencyInstallStatus[]) => void;
    updateInstallStatus: (dependencyId: string, status: Partial<DependencyInstallStatus>) => void;
    addInstallStreamLine: (line: StreamLine) => void;
    setInstallProgress: (progress: number) => void;
    completeInstallation: () => void;

    // Resource approval actions
    setResourceRecommendations: (recommendations: ResourceRecommendation[]) => void;
    approveResource: (resourceId: string) => void;
    setEstimatedCost: (costCents: number) => void;
    completeResourceApproval: () => void;

    // Deployment actions
    setDeploymentStatus: (status: BuilderFlowState['deploymentStatus']) => void;
    setDeploymentEndpoint: (url: string, allocationId: string) => void;
    setDeploymentInferenceCode: (code: BuilderFlowState['deploymentInferenceCode']) => void;

    // Computed
    canProceedToNextPhase: () => boolean;
    getProgress: () => {
        currentPhase: BuilderFlowPhase;
        completedPhases: BuilderFlowPhase[];
        progressPercent: number;
    };
}

type BuilderFlowStore = BuilderFlowState & BuilderFlowActions;

// =============================================================================
// Initial State
// =============================================================================

const initialState: BuilderFlowState = {
    buildId: null,
    projectId: null,
    currentPhase: 'idle',
    error: null,

    userPrompt: null,
    planGenerating: false,
    planGenerated: false,

    planApproved: false,

    intentLocked: false,

    dependencies: [],
    connectedDependencies: new Set(),
    dependencyConnectionComplete: false,

    installStatus: [],
    installStreamLines: [],
    installProgress: 0,
    installComplete: false,

    resourceRecommendations: [],
    approvedResources: new Set(),
    resourceApprovalComplete: false,
    estimatedCostCents: 0,

    deploymentStatus: 'idle',
    deploymentEndpointUrl: null,
    deploymentAllocationId: null,
    deploymentInferenceCode: null,

    phaseStartTime: null,
    buildStartTime: null,
};

// =============================================================================
// Phase Transitions
// =============================================================================

const PHASE_ORDER: BuilderFlowPhase[] = [
    'idle',
    'plan_generation',     // Generate implementation plan from prompt
    'plan_review',         // User reviews and modifies plan
    'intent_lock',         // Lock intent and extract dependencies
    'dependency_connect',  // Connect required integrations
    'dependency_install',  // Install dependencies
    'resource_approval',   // Approve GPU resources if needed
    'build',               // Execute the build
    'deployment',          // Deploy model if applicable
    'complete',
];

function getNextPhase(currentPhase: BuilderFlowPhase): BuilderFlowPhase {
    const currentIndex = PHASE_ORDER.indexOf(currentPhase);
    if (currentIndex === -1 || currentIndex === PHASE_ORDER.length - 1) {
        return currentPhase;
    }
    return PHASE_ORDER[currentIndex + 1];
}

function getCompletedPhases(currentPhase: BuilderFlowPhase): BuilderFlowPhase[] {
    const currentIndex = PHASE_ORDER.indexOf(currentPhase);
    if (currentIndex <= 0) return [];
    return PHASE_ORDER.slice(1, currentIndex);
}

function getProgressPercent(currentPhase: BuilderFlowPhase): number {
    const currentIndex = PHASE_ORDER.indexOf(currentPhase);
    if (currentIndex <= 0) return 0;
    return Math.round((currentIndex / (PHASE_ORDER.length - 1)) * 100);
}

// =============================================================================
// Store
// =============================================================================

export const useBuilderFlowStore = create<BuilderFlowStore>()(
    devtools(
        (set, get) => ({
            ...initialState,

            // Flow control
            initializeBuild: (buildId, projectId) => {
                set({
                    ...initialState,
                    buildId,
                    projectId,
                    currentPhase: 'idle',
                    phaseStartTime: Date.now(),
                    buildStartTime: Date.now(),
                }, false, { type: 'builderFlow/initializeBuild' });
            },

            startPlanGeneration: (prompt) => {
                set({
                    userPrompt: prompt,
                    currentPhase: 'plan_generation',
                    planGenerating: true,
                    phaseStartTime: Date.now(),
                }, false, { type: 'builderFlow/startPlanGeneration' });
            },

            setPhase: (phase) => {
                set({
                    currentPhase: phase,
                    phaseStartTime: Date.now(),
                    error: null,
                }, false, { type: 'builderFlow/setPhase' });
            },

            nextPhase: () => {
                const state = get();
                if (!state.canProceedToNextPhase()) {
                    console.warn('[BuilderFlow] Cannot proceed to next phase');
                    return;
                }
                const nextPhase = getNextPhase(state.currentPhase);
                set({
                    currentPhase: nextPhase,
                    phaseStartTime: Date.now(),
                    error: null,
                }, false, { type: 'builderFlow/nextPhase' });
            },

            setError: (error) => {
                set({
                    error,
                    currentPhase: error ? 'error' : get().currentPhase,
                }, false, { type: 'builderFlow/setError' });
            },

            reset: () => {
                set(initialState, false, { type: 'builderFlow/reset' });
            },

            // Plan generation actions
            setPlanGenerating: (generating) => {
                set({ planGenerating: generating }, false, { type: 'builderFlow/setPlanGenerating' });
            },

            completePlanGeneration: () => {
                set({
                    planGenerating: false,
                    planGenerated: true,
                    currentPhase: 'plan_review',
                    phaseStartTime: Date.now(),
                }, false, { type: 'builderFlow/completePlanGeneration' });
            },

            // Plan actions
            approvePlan: () => {
                set({ planApproved: true }, false, { type: 'builderFlow/approvePlan' });
            },

            // Intent lock actions
            lockIntent: () => {
                set({
                    intentLocked: true,
                    currentPhase: 'dependency_connect',
                    phaseStartTime: Date.now(),
                }, false, { type: 'builderFlow/lockIntent' });
            },

            // Dependency connection actions
            setDependencies: (dependencies) => {
                set({
                    dependencies,
                    installStatus: dependencies.map((d) => ({
                        id: d.id,
                        name: d.name,
                        status: 'pending' as const,
                    })),
                }, false, { type: 'builderFlow/setDependencies' });
            },

            markDependencyConnected: (dependencyId) => {
                set((state) => {
                    const newConnected = new Set(state.connectedDependencies);
                    newConnected.add(dependencyId);
                    return { connectedDependencies: newConnected };
                }, false, { type: 'builderFlow/markDependencyConnected' });
            },

            markDependencyDisconnected: (dependencyId) => {
                set((state) => {
                    const newConnected = new Set(state.connectedDependencies);
                    newConnected.delete(dependencyId);
                    return { connectedDependencies: newConnected };
                }, false, { type: 'builderFlow/markDependencyDisconnected' });
            },

            completeDependencyConnection: () => {
                set({ dependencyConnectionComplete: true }, false, { type: 'builderFlow/completeDependencyConnection' });
            },

            // Dependency installation actions
            setInstallStatus: (status) => {
                set({ installStatus: status }, false, { type: 'builderFlow/setInstallStatus' });
            },

            updateInstallStatus: (dependencyId, status) => {
                set((state) => ({
                    installStatus: state.installStatus.map((s) =>
                        s.id === dependencyId ? { ...s, ...status } : s
                    ),
                }), false, { type: 'builderFlow/updateInstallStatus' });
            },

            addInstallStreamLine: (line) => {
                set((state) => ({
                    installStreamLines: [...state.installStreamLines, line],
                }), false, { type: 'builderFlow/addInstallStreamLine' });
            },

            setInstallProgress: (progress) => {
                set({ installProgress: progress }, false, { type: 'builderFlow/setInstallProgress' });
            },

            completeInstallation: () => {
                set({ installComplete: true }, false, { type: 'builderFlow/completeInstallation' });
            },

            // Resource approval actions
            setResourceRecommendations: (recommendations) => {
                set({ resourceRecommendations: recommendations }, false, { type: 'builderFlow/setResourceRecommendations' });
            },

            approveResource: (resourceId) => {
                set((state) => {
                    const newApproved = new Set(state.approvedResources);
                    newApproved.add(resourceId);
                    return { approvedResources: newApproved };
                }, false, { type: 'builderFlow/approveResource' });
            },

            setEstimatedCost: (costCents) => {
                set({ estimatedCostCents: costCents }, false, { type: 'builderFlow/setEstimatedCost' });
            },

            completeResourceApproval: () => {
                set({ resourceApprovalComplete: true }, false, { type: 'builderFlow/completeResourceApproval' });
            },

            // Deployment actions
            setDeploymentStatus: (status) => {
                set({ deploymentStatus: status }, false, { type: 'builderFlow/setDeploymentStatus' });
            },

            setDeploymentEndpoint: (url, allocationId) => {
                set({
                    deploymentEndpointUrl: url,
                    deploymentAllocationId: allocationId,
                    deploymentStatus: 'active',
                }, false, { type: 'builderFlow/setDeploymentEndpoint' });
            },

            setDeploymentInferenceCode: (code) => {
                set({ deploymentInferenceCode: code }, false, { type: 'builderFlow/setDeploymentInferenceCode' });
            },

            // Computed
            canProceedToNextPhase: () => {
                const state = get();
                switch (state.currentPhase) {
                    case 'idle':
                        return !!state.buildId && !!state.userPrompt;
                    case 'plan_generation':
                        return state.planGenerated && !state.planGenerating;
                    case 'plan_review':
                        return state.planApproved;
                    case 'intent_lock':
                        return state.intentLocked;
                    case 'dependency_connect':
                        // Can proceed if all dependencies are connected or user manually completed
                        return state.dependencyConnectionComplete ||
                            state.dependencies.every((d) =>
                                state.connectedDependencies.has(d.id)
                            );
                    case 'dependency_install':
                        return state.installComplete;
                    case 'resource_approval':
                        return state.resourceApprovalComplete ||
                            state.resourceRecommendations.length === 0;
                    case 'build':
                        // Build completion is handled externally
                        return true;
                    case 'deployment':
                        return state.deploymentStatus === 'active' || state.deploymentStatus === 'idle';
                    case 'complete':
                        return false;
                    case 'error':
                        return false;
                    default:
                        return false;
                }
            },

            getProgress: () => {
                const state = get();
                return {
                    currentPhase: state.currentPhase,
                    completedPhases: getCompletedPhases(state.currentPhase),
                    progressPercent: getProgressPercent(state.currentPhase),
                };
            },
        }),
        { name: 'BuilderFlowStore' }
    )
);

// =============================================================================
// Selectors
// =============================================================================

export const selectCurrentPhase = (state: BuilderFlowStore) => state.currentPhase;
export const selectBuildId = (state: BuilderFlowStore) => state.buildId;
export const selectDependencies = (state: BuilderFlowStore) => state.dependencies;
export const selectConnectedDependencies = (state: BuilderFlowStore) => state.connectedDependencies;
export const selectInstallStatus = (state: BuilderFlowStore) => state.installStatus;
export const selectResourceRecommendations = (state: BuilderFlowStore) => state.resourceRecommendations;
export const selectDeploymentStatus = (state: BuilderFlowStore) => state.deploymentStatus;
export const selectError = (state: BuilderFlowStore) => state.error;

// =============================================================================
// Export Types
// =============================================================================

export type { BuilderFlowStore };
