/**
 * Build Store - State management for Unified Build System
 *
 * Tracks:
 * - Build phases (0-6)
 * - Intent Lock (Sacred Contract) status
 * - Done Contract verification
 * - Active agents and their progress
 * - Verification results
 *
 * CRITICAL: This connects the UI to the full build pipeline,
 * NOT the previous stateless streaming approach.
 */

import { create } from 'zustand';
import {
    type BuildPhase,
    type BuildMode,
    type UnifiedBuildEvent,
    type IntentContractSummary,
    type DoneContractResult,
} from '../lib/api-client';

// Phase definitions with metadata
export const BUILD_PHASES: Record<BuildPhase, {
    number: number;
    name: string;
    description: string;
    icon: string;
}> = {
    intent_lock: {
        number: 0,
        name: 'Intent Lock',
        description: 'Creating Sacred Contract',
        icon: 'lock',
    },
    initialization: {
        number: 1,
        name: 'Initialization',
        description: 'Setting up project structure',
        icon: 'folder',
    },
    parallel_build: {
        number: 2,
        name: 'Parallel Build',
        description: 'Agents building features',
        icon: 'hammer',
    },
    integration_check: {
        number: 3,
        name: 'Integration Check',
        description: 'Checking connectivity',
        icon: 'link',
    },
    functional_test: {
        number: 4,
        name: 'Functional Test',
        description: 'Testing as real user',
        icon: 'test-tube',
    },
    intent_satisfaction: {
        number: 5,
        name: 'Intent Satisfaction',
        description: 'Verifying success criteria',
        icon: 'check-circle',
    },
    browser_demo: {
        number: 6,
        name: 'Browser Demo',
        description: 'Showing working app',
        icon: 'monitor',
    },
};

export interface ActiveAgent {
    id: string;
    name: string;
    status: 'idle' | 'working' | 'complete' | 'error';
    progress: number;
    currentTask?: string;
}

export interface VerificationResult {
    score: number;
    passed: boolean;
    issues: string[];
    timestamp: number;
}

export interface BuildState {
    // Build session
    buildId: string | null;
    projectId: string | null;
    status: 'idle' | 'initializing' | 'intent_lock' | 'building' | 'verifying' | 'complete' | 'failed';
    mode: BuildMode | null;

    // Phase tracking
    currentPhase: BuildPhase | null;
    currentPhaseNumber: number;
    phaseProgress: number;
    completedPhases: BuildPhase[];

    // Intent Lock (Sacred Contract)
    intentContract: IntentContractSummary | null;
    intentLocked: boolean;

    // Done Contract
    doneContract: DoneContractResult | null;

    // Active agents
    activeAgents: ActiveAgent[];

    // Verification
    lastVerification: VerificationResult | null;

    // Events log
    events: UnifiedBuildEvent[];
    maxEvents: number;

    // Error tracking
    lastError: string | null;

    // Timing
    startedAt: number | null;
    completedAt: number | null;
}

export interface BuildActions {
    // Core actions
    startBuild: (buildId: string, projectId: string, mode: BuildMode) => void;
    handleEvent: (event: UnifiedBuildEvent) => void;
    resetBuild: () => void;

    // Phase actions
    setPhase: (phase: BuildPhase, progress?: number) => void;
    completePhase: (phase: BuildPhase) => void;

    // Intent Lock actions
    setIntentContract: (contract: IntentContractSummary) => void;
    lockIntent: () => void;

    // Done Contract actions
    setDoneContract: (result: DoneContractResult) => void;

    // Agent actions
    updateAgent: (agent: ActiveAgent) => void;
    removeAgent: (agentId: string) => void;

    // Verification actions
    setVerificationResult: (result: VerificationResult) => void;

    // Status actions
    setStatus: (status: BuildState['status']) => void;
    setError: (error: string | null) => void;
    completeBuild: (success: boolean) => void;
}

const initialState: BuildState = {
    buildId: null,
    projectId: null,
    status: 'idle',
    mode: null,
    currentPhase: null,
    currentPhaseNumber: 0,
    phaseProgress: 0,
    completedPhases: [],
    intentContract: null,
    intentLocked: false,
    doneContract: null,
    activeAgents: [],
    lastVerification: null,
    events: [],
    maxEvents: 100,
    lastError: null,
    startedAt: null,
    completedAt: null,
};

export const useBuildStore = create<BuildState & BuildActions>((set, get) => ({
    ...initialState,

    // Start a new build
    startBuild: (buildId, projectId, mode) => {
        set({
            ...initialState,
            buildId,
            projectId,
            mode,
            status: 'initializing',
            startedAt: Date.now(),
        });
    },

    // Handle incoming build events from SSE
    handleEvent: (event) => {
        const state = get();

        // Add event to log (keep last N events)
        const events = [...state.events, event].slice(-state.maxEvents);

        switch (event.type) {
            case 'build_started':
                set({
                    events,
                    status: 'initializing',
                    buildId: event.buildId || state.buildId,
                    projectId: event.projectId || state.projectId,
                });
                break;

            case 'intent_created':
                set({
                    events,
                    status: 'intent_lock',
                    currentPhase: 'intent_lock',
                    currentPhaseNumber: 0,
                    intentContract: event.intentContract || null,
                });
                break;

            case 'intent_locked':
                set({
                    events,
                    intentLocked: true,
                    intentContract: event.intentContract || state.intentContract,
                });
                break;

            case 'phase_start':
                set({
                    events,
                    status: 'building',
                    currentPhase: event.phase || state.currentPhase,
                    currentPhaseNumber: event.phaseNumber ?? state.currentPhaseNumber,
                    phaseProgress: 0,
                });
                break;

            case 'phase_complete':
                const completedPhase = event.phase || state.currentPhase;
                set({
                    events,
                    phaseProgress: 100,
                    completedPhases: completedPhase
                        ? [...state.completedPhases, completedPhase]
                        : state.completedPhases,
                });
                break;

            case 'feature_building':
                // Update phase progress based on feature progress
                set({
                    events,
                    phaseProgress: event.featureProgress ?? state.phaseProgress,
                });
                break;

            case 'agent_update':
                if (event.agentId) {
                    const existingAgent = state.activeAgents.find(a => a.id === event.agentId);
                    const updatedAgent: ActiveAgent = {
                        id: event.agentId,
                        name: event.agentName || existingAgent?.name || 'Agent',
                        status: (event.agentStatus as ActiveAgent['status']) || existingAgent?.status || 'working',
                        progress: event.progress ?? existingAgent?.progress ?? 0,
                    };
                    set({
                        events,
                        activeAgents: existingAgent
                            ? state.activeAgents.map(a => a.id === event.agentId ? updatedAgent : a)
                            : [...state.activeAgents, updatedAgent],
                    });
                }
                break;

            case 'verification_result':
                set({
                    events,
                    status: 'verifying',
                    lastVerification: {
                        score: event.verificationScore ?? 0,
                        passed: event.verificationPassed ?? false,
                        issues: event.verificationIssues ?? [],
                        timestamp: event.timestamp ?? Date.now(),
                    },
                });
                break;

            case 'done_check':
                set({
                    events,
                    doneContract: event.doneContract || null,
                });
                break;

            case 'build_complete':
            case 'complete':
                set({
                    events,
                    status: event.success ? 'complete' : 'failed',
                    completedAt: Date.now(),
                });
                break;

            case 'error':
                set({
                    events,
                    status: 'failed',
                    lastError: event.error || event.message || 'Unknown error',
                });
                break;

            default:
                // Just log the event
                set({ events });
        }
    },

    // Reset to initial state
    resetBuild: () => {
        set(initialState);
    },

    // Set current phase
    setPhase: (phase, progress = 0) => {
        const phaseInfo = BUILD_PHASES[phase];
        set({
            currentPhase: phase,
            currentPhaseNumber: phaseInfo?.number ?? 0,
            phaseProgress: progress,
        });
    },

    // Mark phase as complete
    completePhase: (phase) => {
        set(state => ({
            completedPhases: [...state.completedPhases, phase],
            phaseProgress: 100,
        }));
    },

    // Set intent contract
    setIntentContract: (contract) => {
        set({ intentContract: contract });
    },

    // Lock the intent
    lockIntent: () => {
        set({ intentLocked: true });
    },

    // Set done contract result
    setDoneContract: (result) => {
        set({ doneContract: result });
    },

    // Update or add agent
    updateAgent: (agent) => {
        set(state => {
            const existing = state.activeAgents.find(a => a.id === agent.id);
            if (existing) {
                return {
                    activeAgents: state.activeAgents.map(a =>
                        a.id === agent.id ? agent : a
                    ),
                };
            }
            return {
                activeAgents: [...state.activeAgents, agent],
            };
        });
    },

    // Remove agent
    removeAgent: (agentId) => {
        set(state => ({
            activeAgents: state.activeAgents.filter(a => a.id !== agentId),
        }));
    },

    // Set verification result
    setVerificationResult: (result) => {
        set({ lastVerification: result });
    },

    // Set build status
    setStatus: (status) => {
        set({ status });
    },

    // Set error
    setError: (error) => {
        set({
            lastError: error,
            status: error ? 'failed' : get().status,
        });
    },

    // Complete the build
    completeBuild: (success) => {
        set({
            status: success ? 'complete' : 'failed',
            completedAt: Date.now(),
        });
    },
}));

// Selector hooks
export const useCurrentPhase = () => useBuildStore(state => ({
    phase: state.currentPhase,
    number: state.currentPhaseNumber,
    progress: state.phaseProgress,
    info: state.currentPhase ? BUILD_PHASES[state.currentPhase] : null,
}));

export const useIntentLock = () => useBuildStore(state => ({
    contract: state.intentContract,
    locked: state.intentLocked,
}));

export const useDoneContract = () => useBuildStore(state => state.doneContract);

export const useActiveAgents = () => useBuildStore(state => state.activeAgents);

export const useBuildStatus = () => useBuildStore(state => ({
    status: state.status,
    buildId: state.buildId,
    projectId: state.projectId,
    mode: state.mode,
    duration: state.startedAt
        ? (state.completedAt || Date.now()) - state.startedAt
        : null,
}));

export const useBuildProgress = () => useBuildStore(state => ({
    currentPhase: state.currentPhaseNumber,
    totalPhases: 7,
    phaseProgress: state.phaseProgress,
    overallProgress: Math.round(
        ((state.currentPhaseNumber + state.phaseProgress / 100) / 7) * 100
    ),
}));
