/**
 * Plan Modification Store
 *
 * Zustand store for managing modifications to implementation plans.
 * Tracks per-task and per-phase modifications that will be used to
 * reconfigure the entire plan when "Reconfigure Plan" is clicked.
 *
 * Features:
 * - Track modifications at task and phase level
 * - NLP prompt storage for each modification
 * - Pending state until user clicks "Reconfigure Plan"
 * - Clear all modifications after reconfiguration
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// =============================================================================
// Types
// =============================================================================

export interface TaskModification {
    /** Task ID being modified */
    taskId: string;
    /** Phase ID this task belongs to */
    phaseId: string;
    /** Original task content */
    originalContent: string;
    /** User's modification prompt (NLP) */
    modificationPrompt: string;
    /** When the modification was made */
    timestamp: number;
}

export interface PhaseModification {
    /** Phase ID being modified */
    phaseId: string;
    /** Original phase title */
    originalTitle: string;
    /** User's modification prompt (NLP) */
    modificationPrompt: string;
    /** When the modification was made */
    timestamp: number;
}

export interface PlanState {
    /** Build ID this plan belongs to */
    buildId: string | null;
    /** Original plan data (phases and tasks) */
    originalPlan: ImplementationPlan | null;
    /** Whether the plan has been approved (locked) */
    isApproved: boolean;
    /** Whether a reconfiguration is in progress */
    isReconfiguring: boolean;
}

export interface ImplementationPlan {
    phases: PlanPhase[];
    estimatedTime?: string;
    complexity?: number;
}

export interface PlanPhase {
    id: string;
    title: string;
    description?: string;
    tasks: PlanTask[];
    order: number;
}

export interface PlanTask {
    id: string;
    content: string;
    completed?: boolean;
    order: number;
}

interface PlanModificationStoreState {
    // State
    planState: PlanState;
    taskModifications: Map<string, TaskModification>;
    phaseModifications: Map<string, PhaseModification>;
    expandedPhases: Set<string>;
    editingTaskId: string | null;
    editingPhaseId: string | null;

    // Actions - Plan
    setPlan: (buildId: string, plan: ImplementationPlan) => void;
    approvePlan: () => void;
    resetPlan: () => void;
    setReconfiguring: (isReconfiguring: boolean) => void;

    // Actions - Task Modifications
    addTaskModification: (
        taskId: string,
        phaseId: string,
        originalContent: string,
        modificationPrompt: string
    ) => void;
    removeTaskModification: (taskId: string) => void;
    getTaskModification: (taskId: string) => TaskModification | undefined;

    // Actions - Phase Modifications
    addPhaseModification: (
        phaseId: string,
        originalTitle: string,
        modificationPrompt: string
    ) => void;
    removePhaseModification: (phaseId: string) => void;
    getPhaseModification: (phaseId: string) => PhaseModification | undefined;

    // Actions - UI State
    togglePhaseExpanded: (phaseId: string) => void;
    setEditingTask: (taskId: string | null) => void;
    setEditingPhase: (phaseId: string | null) => void;

    // Actions - Clear
    clearAllModifications: () => void;

    // Computed
    hasModifications: () => boolean;
    getModificationCount: () => number;
    getAllModifications: () => {
        tasks: TaskModification[];
        phases: PhaseModification[];
    };
}

// =============================================================================
// Store
// =============================================================================

export const usePlanModificationStore = create<PlanModificationStoreState>()(
    devtools(
        persist(
            (set, get) => ({
                // Initial state
                planState: {
                    buildId: null,
                    originalPlan: null,
                    isApproved: false,
                    isReconfiguring: false,
                },
                taskModifications: new Map(),
                phaseModifications: new Map(),
                expandedPhases: new Set(),
                editingTaskId: null,
                editingPhaseId: null,

                // Plan actions
                setPlan: (buildId, plan) => {
                    set({
                        planState: {
                            buildId,
                            originalPlan: plan,
                            isApproved: false,
                            isReconfiguring: false,
                        },
                        taskModifications: new Map(),
                        phaseModifications: new Map(),
                        expandedPhases: new Set(),
                        editingTaskId: null,
                        editingPhaseId: null,
                    }, false, { type: 'planModification/setPlan' });
                },

                approvePlan: () => {
                    set((state) => ({
                        planState: {
                            ...state.planState,
                            isApproved: true,
                        },
                        editingTaskId: null,
                        editingPhaseId: null,
                    }), false, { type: 'planModification/approvePlan' });
                },

                resetPlan: () => {
                    set({
                        planState: {
                            buildId: null,
                            originalPlan: null,
                            isApproved: false,
                            isReconfiguring: false,
                        },
                        taskModifications: new Map(),
                        phaseModifications: new Map(),
                        expandedPhases: new Set(),
                        editingTaskId: null,
                        editingPhaseId: null,
                    }, false, { type: 'planModification/resetPlan' });
                },

                setReconfiguring: (isReconfiguring) => {
                    set((state) => ({
                        planState: {
                            ...state.planState,
                            isReconfiguring,
                        },
                    }), false, { type: 'planModification/setReconfiguring' });
                },

                // Task modification actions
                addTaskModification: (taskId, phaseId, originalContent, modificationPrompt) => {
                    set((state) => {
                        const newModifications = new Map(state.taskModifications);
                        newModifications.set(taskId, {
                            taskId,
                            phaseId,
                            originalContent,
                            modificationPrompt,
                            timestamp: Date.now(),
                        });
                        return {
                            taskModifications: newModifications,
                            editingTaskId: null,
                        };
                    }, false, { type: 'planModification/addTaskModification' });
                },

                removeTaskModification: (taskId) => {
                    set((state) => {
                        const newModifications = new Map(state.taskModifications);
                        newModifications.delete(taskId);
                        return { taskModifications: newModifications };
                    }, false, { type: 'planModification/removeTaskModification' });
                },

                getTaskModification: (taskId) => {
                    return get().taskModifications.get(taskId);
                },

                // Phase modification actions
                addPhaseModification: (phaseId, originalTitle, modificationPrompt) => {
                    set((state) => {
                        const newModifications = new Map(state.phaseModifications);
                        newModifications.set(phaseId, {
                            phaseId,
                            originalTitle,
                            modificationPrompt,
                            timestamp: Date.now(),
                        });
                        return {
                            phaseModifications: newModifications,
                            editingPhaseId: null,
                        };
                    }, false, { type: 'planModification/addPhaseModification' });
                },

                removePhaseModification: (phaseId) => {
                    set((state) => {
                        const newModifications = new Map(state.phaseModifications);
                        newModifications.delete(phaseId);
                        return { phaseModifications: newModifications };
                    }, false, { type: 'planModification/removePhaseModification' });
                },

                getPhaseModification: (phaseId) => {
                    return get().phaseModifications.get(phaseId);
                },

                // UI state actions
                togglePhaseExpanded: (phaseId) => {
                    set((state) => {
                        const newExpanded = new Set(state.expandedPhases);
                        if (newExpanded.has(phaseId)) {
                            newExpanded.delete(phaseId);
                        } else {
                            newExpanded.add(phaseId);
                        }
                        return { expandedPhases: newExpanded };
                    }, false, { type: 'planModification/togglePhaseExpanded' });
                },

                setEditingTask: (taskId) => {
                    set({
                        editingTaskId: taskId,
                        editingPhaseId: null,
                    }, false, { type: 'planModification/setEditingTask' });
                },

                setEditingPhase: (phaseId) => {
                    set({
                        editingPhaseId: phaseId,
                        editingTaskId: null,
                    }, false, { type: 'planModification/setEditingPhase' });
                },

                // Clear actions
                clearAllModifications: () => {
                    set({
                        taskModifications: new Map(),
                        phaseModifications: new Map(),
                    }, false, { type: 'planModification/clearAllModifications' });
                },

                // Computed
                hasModifications: () => {
                    const state = get();
                    return state.taskModifications.size > 0 || state.phaseModifications.size > 0;
                },

                getModificationCount: () => {
                    const state = get();
                    return state.taskModifications.size + state.phaseModifications.size;
                },

                getAllModifications: () => {
                    const state = get();
                    return {
                        tasks: Array.from(state.taskModifications.values()),
                        phases: Array.from(state.phaseModifications.values()),
                    };
                },
            }),
            {
                name: 'plan-modification-storage',
                // Custom serialization for Map and Set
                storage: {
                    getItem: (name) => {
                        const str = localStorage.getItem(name);
                        if (!str) return null;
                        const parsed = JSON.parse(str);
                        return {
                            ...parsed,
                            state: {
                                ...parsed.state,
                                taskModifications: new Map(parsed.state.taskModifications || []),
                                phaseModifications: new Map(parsed.state.phaseModifications || []),
                                expandedPhases: new Set(parsed.state.expandedPhases || []),
                            },
                        };
                    },
                    setItem: (name, value) => {
                        const state = value.state;
                        const serialized = {
                            ...value,
                            state: {
                                ...state,
                                taskModifications: Array.from(state.taskModifications.entries()),
                                phaseModifications: Array.from(state.phaseModifications.entries()),
                                expandedPhases: Array.from(state.expandedPhases),
                            },
                        };
                        localStorage.setItem(name, JSON.stringify(serialized));
                    },
                    removeItem: (name) => localStorage.removeItem(name),
                },
            }
        ),
        { name: 'PlanModificationStore' }
    )
);

// =============================================================================
// Selectors
// =============================================================================

export const selectPlanState = (state: PlanModificationStoreState) => state.planState;
export const selectIsApproved = (state: PlanModificationStoreState) => state.planState.isApproved;
export const selectIsReconfiguring = (state: PlanModificationStoreState) => state.planState.isReconfiguring;
export const selectHasModifications = (state: PlanModificationStoreState) => state.hasModifications();
export const selectModificationCount = (state: PlanModificationStoreState) => state.getModificationCount();
