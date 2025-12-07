/**
 * Developer Mode Store
 *
 * Zustand store for managing Developer Mode state on the frontend.
 * Handles:
 * - Session management
 * - Agent state and progress
 * - Merge queue
 * - Real-time event streaming
 * - Credit tracking
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// =============================================================================
// TYPES
// =============================================================================

export type AgentStatus = 'idle' | 'running' | 'completed' | 'waiting' | 'failed' | 'paused';

export type AgentModel =
    | 'claude-opus-4-5'
    | 'claude-sonnet-4-5'
    | 'claude-haiku-3-5'
    | 'gpt-5-codex'
    | 'gemini-2-5-pro'
    | 'deepseek-r1';

export type VerificationMode = 'quick' | 'standard' | 'thorough' | 'full_swarm';

export interface AgentProgress {
    progress: number;
    currentStep: string;
    stepsCompleted: number;
    stepsTotal: number;
    tokensUsed: number;
    creditsUsed: number;
}

export interface AgentLog {
    id: string;
    agentId: string;
    logType: 'action' | 'thought' | 'code' | 'verification' | 'error' | 'warning' | 'info' | 'debug';
    level: 'debug' | 'info' | 'warning' | 'error';
    message: string;
    details?: {
        code?: string;
        file?: string;
        line?: number;
        thinking?: string;
    };
    phase?: string;
    stepNumber?: number;
    createdAt: Date;
}

export interface Agent {
    id: string;
    sessionId: string;
    projectId: string;
    agentNumber: number;
    name: string;
    status: AgentStatus;
    model: AgentModel;
    taskPrompt?: string;
    progress: AgentProgress;
    verificationMode?: VerificationMode;
    verificationPassed?: boolean;
    verificationScore?: number;
    mergeStatus?: string;
    sandboxUrl?: string;
    lastError?: string;
    branch?: string;
    filesModified?: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface Session {
    id: string;
    projectId: string;
    status: 'active' | 'paused' | 'completed' | 'failed';
    startedAt: Date;
    maxConcurrentAgents: number;
    activeAgentCount: number;
    defaultModel: AgentModel;
    verificationMode: VerificationMode;
    autoMergeEnabled: boolean;
    creditsUsed: number;
    creditsEstimated: number;
    budgetLimit?: number;
    baseBranch: string;
    totalAgentsDeployed: number;
    totalTasksCompleted: number;
    agents: Agent[];
}

export interface MergeQueueItem {
    id: string;
    agentId: string;
    agentName: string;
    status: 'pending' | 'approved' | 'rejected' | 'merged' | 'conflict';
    priority: number;
    filesChanged: number;
    additions: number;
    deletions: number;
    verificationPassed: boolean;
    verificationScore: number;
    createdAt: Date;
}

export interface ModelInfo {
    id: AgentModel;
    name: string;
    provider: string;
    description: string;
    creditsPerTask: number;
    recommended: string[];
}

export interface VerificationModeConfig {
    name: string;
    description: string;
    estimatedTimeMs: number;
    estimatedCredits: number;
    minScoreForPass: number;
}

// =============================================================================
// STORE STATE
// =============================================================================

interface DeveloperModeState {
    // Session state
    currentSession: Session | null;
    isLoading: boolean;
    error: string | null;

    // Agent state
    selectedAgentId: string | null;
    agentLogs: Map<string, AgentLog[]>;

    // Merge queue
    mergeQueue: MergeQueueItem[];

    // Configuration
    availableModels: ModelInfo[];
    verificationModes: Map<VerificationMode, VerificationModeConfig>;

    // Event source for SSE
    eventSource: EventSource | null;

    // Actions
    startSession: (projectId: string, config?: Partial<{
        defaultModel: AgentModel;
        verificationMode: VerificationMode;
        autoMergeEnabled: boolean;
        budgetLimit: number;
    }>) => Promise<void>;
    pauseSession: () => Promise<void>;
    resumeSession: () => Promise<void>;
    endSession: () => Promise<void>;
    refreshSession: () => Promise<void>;

    // Agent actions
    deployAgent: (config: {
        name: string;
        taskPrompt: string;
        model?: AgentModel;
        verificationMode?: VerificationMode;
        files?: string[];
        context?: string;
    }) => Promise<Agent>;
    stopAgent: (agentId: string) => Promise<void>;
    resumeAgent: (agentId: string) => Promise<void>;
    renameAgent: (agentId: string, newName: string) => Promise<void>;
    changeAgentModel: (agentId: string, model: AgentModel) => Promise<void>;
    deleteAgent: (agentId: string) => Promise<void>;
    selectAgent: (agentId: string | null) => void;
    fetchAgentLogs: (agentId: string) => Promise<void>;

    // Merge queue actions
    approveMerge: (mergeId: string) => Promise<void>;
    rejectMerge: (mergeId: string, reason?: string) => Promise<void>;
    executeMerge: (mergeId: string) => Promise<void>;
    refreshMergeQueue: () => Promise<void>;

    // Event streaming
    connectToEvents: () => void;
    disconnectFromEvents: () => void;

    // Utilities
    estimateCredits: (model: AgentModel, complexity: 'simple' | 'medium' | 'complex') => Promise<number>;
    loadModels: () => Promise<void>;
    loadVerificationModes: () => Promise<void>;

    // Internal
    setError: (error: string | null) => void;
    updateAgent: (agentId: string, updates: Partial<Agent>) => void;
    addAgentLog: (agentId: string, log: AgentLog) => void;
    handleEvent: (event: { type: string; [key: string]: unknown }) => void;
}

// =============================================================================
// API CLIENT
// =============================================================================

const API_BASE = '/api/developer-mode';

async function apiCall<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        credentials: 'include',
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
}

// =============================================================================
// STORE
// =============================================================================

export const useDeveloperModeStore = create<DeveloperModeState>()(
    devtools(
        (set, get) => ({
            // Initial state
            currentSession: null,
            isLoading: false,
            error: null,
            selectedAgentId: null,
            agentLogs: new Map(),
            mergeQueue: [],
            availableModels: [],
            verificationModes: new Map(),
            eventSource: null,

            // Session actions
            startSession: async (projectId, config) => {
                set({ isLoading: true, error: null });
                try {
                    const result = await apiCall<{ session: Session }>('/sessions', {
                        method: 'POST',
                        body: JSON.stringify({
                            projectId,
                            ...config,
                        }),
                    });
                    set({ currentSession: result.session, isLoading: false });

                    // Connect to events
                    get().connectToEvents();
                } catch (error) {
                    set({ error: error instanceof Error ? error.message : 'Failed to start session', isLoading: false });
                    throw error;
                }
            },

            pauseSession: async () => {
                const session = get().currentSession;
                if (!session) return;

                set({ isLoading: true, error: null });
                try {
                    await apiCall(`/sessions/${session.id}/pause`, { method: 'POST' });
                    await get().refreshSession();
                } catch (error) {
                    set({ error: error instanceof Error ? error.message : 'Failed to pause session', isLoading: false });
                    throw error;
                }
            },

            resumeSession: async () => {
                const session = get().currentSession;
                if (!session) return;

                set({ isLoading: true, error: null });
                try {
                    await apiCall(`/sessions/${session.id}/resume`, { method: 'POST' });
                    await get().refreshSession();
                    get().connectToEvents();
                } catch (error) {
                    set({ error: error instanceof Error ? error.message : 'Failed to resume session', isLoading: false });
                    throw error;
                }
            },

            endSession: async () => {
                const session = get().currentSession;
                if (!session) return;

                set({ isLoading: true, error: null });
                try {
                    await apiCall(`/sessions/${session.id}/end`, { method: 'POST' });
                    get().disconnectFromEvents();
                    set({ currentSession: null, isLoading: false });
                } catch (error) {
                    set({ error: error instanceof Error ? error.message : 'Failed to end session', isLoading: false });
                    throw error;
                }
            },

            refreshSession: async () => {
                const session = get().currentSession;
                if (!session) return;

                try {
                    const result = await apiCall<{ session: Session }>(`/sessions/${session.id}`);
                    set({ currentSession: result.session, isLoading: false });
                } catch (error) {
                    set({ error: error instanceof Error ? error.message : 'Failed to refresh session', isLoading: false });
                }
            },

            // Agent actions
            deployAgent: async (config) => {
                const session = get().currentSession;
                if (!session) throw new Error('No active session');

                set({ isLoading: true, error: null });
                try {
                    const result = await apiCall<{ agent: Agent }>(`/sessions/${session.id}/agents`, {
                        method: 'POST',
                        body: JSON.stringify(config),
                    });
                    await get().refreshSession();
                    set({ isLoading: false });
                    return result.agent;
                } catch (error) {
                    set({ error: error instanceof Error ? error.message : 'Failed to deploy agent', isLoading: false });
                    throw error;
                }
            },

            stopAgent: async (agentId) => {
                set({ isLoading: true, error: null });
                try {
                    await apiCall(`/agents/${agentId}/stop`, { method: 'POST' });
                    await get().refreshSession();
                } catch (error) {
                    set({ error: error instanceof Error ? error.message : 'Failed to stop agent', isLoading: false });
                    throw error;
                }
            },

            resumeAgent: async (agentId) => {
                set({ isLoading: true, error: null });
                try {
                    await apiCall(`/agents/${agentId}/resume`, { method: 'POST' });
                    await get().refreshSession();
                } catch (error) {
                    set({ error: error instanceof Error ? error.message : 'Failed to resume agent', isLoading: false });
                    throw error;
                }
            },

            renameAgent: async (agentId, newName) => {
                try {
                    await apiCall(`/agents/${agentId}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ name: newName }),
                    });
                    get().updateAgent(agentId, { name: newName });
                } catch (error) {
                    set({ error: error instanceof Error ? error.message : 'Failed to rename agent' });
                    throw error;
                }
            },

            changeAgentModel: async (agentId, model) => {
                try {
                    await apiCall(`/agents/${agentId}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ model }),
                    });
                    get().updateAgent(agentId, { model });
                } catch (error) {
                    set({ error: error instanceof Error ? error.message : 'Failed to change model' });
                    throw error;
                }
            },

            deleteAgent: async (agentId) => {
                set({ isLoading: true, error: null });
                try {
                    await apiCall(`/agents/${agentId}`, { method: 'DELETE' });
                    await get().refreshSession();

                    // Clear selection if deleted agent was selected
                    if (get().selectedAgentId === agentId) {
                        set({ selectedAgentId: null });
                    }
                } catch (error) {
                    set({ error: error instanceof Error ? error.message : 'Failed to delete agent', isLoading: false });
                    throw error;
                }
            },

            selectAgent: (agentId) => {
                set({ selectedAgentId: agentId });
                if (agentId) {
                    get().fetchAgentLogs(agentId);
                }
            },

            fetchAgentLogs: async (agentId) => {
                try {
                    const result = await apiCall<{ logs: AgentLog[] }>(`/agents/${agentId}/logs?limit=100`);
                    const logs = new Map(get().agentLogs);
                    logs.set(agentId, result.logs.map(log => ({
                        ...log,
                        createdAt: new Date(log.createdAt),
                    })));
                    set({ agentLogs: logs });
                } catch (error) {
                    console.error('Failed to fetch agent logs:', error);
                }
            },

            // Merge queue actions
            approveMerge: async (mergeId) => {
                try {
                    await apiCall(`/merges/${mergeId}/approve`, { method: 'POST' });
                    await get().refreshMergeQueue();
                } catch (error) {
                    set({ error: error instanceof Error ? error.message : 'Failed to approve merge' });
                    throw error;
                }
            },

            rejectMerge: async (mergeId, reason) => {
                try {
                    await apiCall(`/merges/${mergeId}/reject`, {
                        method: 'POST',
                        body: JSON.stringify({ reason }),
                    });
                    await get().refreshMergeQueue();
                } catch (error) {
                    set({ error: error instanceof Error ? error.message : 'Failed to reject merge' });
                    throw error;
                }
            },

            executeMerge: async (mergeId) => {
                try {
                    await apiCall(`/merges/${mergeId}/execute`, { method: 'POST' });
                    await get().refreshMergeQueue();
                    await get().refreshSession();
                } catch (error) {
                    set({ error: error instanceof Error ? error.message : 'Failed to execute merge' });
                    throw error;
                }
            },

            refreshMergeQueue: async () => {
                const session = get().currentSession;
                if (!session) return;

                try {
                    const result = await apiCall<{ mergeQueue: MergeQueueItem[] }>(`/sessions/${session.id}/merge-queue`);
                    set({
                        mergeQueue: result.mergeQueue.map(item => ({
                            ...item,
                            createdAt: new Date(item.createdAt),
                        })),
                    });
                } catch (error) {
                    console.error('Failed to refresh merge queue:', error);
                }
            },

            // Event streaming
            connectToEvents: () => {
                const session = get().currentSession;
                if (!session) return;

                // Disconnect existing
                get().disconnectFromEvents();

                const eventSource = new EventSource(`${API_BASE}/sessions/${session.id}/events`, {
                    withCredentials: true,
                });

                eventSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        get().handleEvent(data);
                    } catch (e) {
                        console.error('Failed to parse SSE event:', e);
                    }
                };

                eventSource.onerror = () => {
                    console.error('SSE connection error');
                    // Try to reconnect after 5 seconds
                    setTimeout(() => {
                        if (get().currentSession) {
                            get().connectToEvents();
                        }
                    }, 5000);
                };

                set({ eventSource });
            },

            disconnectFromEvents: () => {
                const eventSource = get().eventSource;
                if (eventSource) {
                    eventSource.close();
                    set({ eventSource: null });
                }
            },

            // Utilities
            estimateCredits: async (model, complexity) => {
                try {
                    const result = await apiCall<{ estimatedCredits: number }>('/estimate-credits', {
                        method: 'POST',
                        body: JSON.stringify({ model, taskComplexity: complexity }),
                    });
                    return result.estimatedCredits;
                } catch (error) {
                    console.error('Failed to estimate credits:', error);
                    return 0;
                }
            },

            loadModels: async () => {
                try {
                    const result = await apiCall<{ models: ModelInfo[] }>('/models');
                    set({ availableModels: result.models });
                } catch (error) {
                    console.error('Failed to load models:', error);
                }
            },

            loadVerificationModes: async () => {
                try {
                    const result = await apiCall<{
                        modes: Array<{ mode: VerificationMode; config: VerificationModeConfig }>;
                    }>('/verification-modes');
                    const modes = new Map<VerificationMode, VerificationModeConfig>();
                    for (const { mode, config } of result.modes) {
                        modes.set(mode, config);
                    }
                    set({ verificationModes: modes });
                } catch (error) {
                    console.error('Failed to load verification modes:', error);
                }
            },

            // Internal helpers
            setError: (error) => set({ error }),

            updateAgent: (agentId, updates) => {
                const session = get().currentSession;
                if (!session) return;

                const updatedAgents = session.agents.map(agent =>
                    agent.id === agentId ? { ...agent, ...updates } : agent
                );

                set({
                    currentSession: {
                        ...session,
                        agents: updatedAgents,
                    },
                });
            },

            addAgentLog: (agentId, log) => {
                const logs = new Map(get().agentLogs);
                const agentLogs = logs.get(agentId) || [];
                logs.set(agentId, [log, ...agentLogs].slice(0, 100)); // Keep last 100 logs
                set({ agentLogs: logs });
            },

            handleEvent: (event) => {
                switch (event.type) {
                    case 'agent:progress':
                        get().updateAgent(event.agentId as string, {
                            progress: {
                                progress: event.progress as number,
                                currentStep: event.currentStep as string,
                                stepsCompleted: event.stepsCompleted as number,
                                stepsTotal: event.stepsTotal as number,
                                tokensUsed: 0,
                                creditsUsed: 0,
                            },
                        });
                        break;

                    case 'agent:log':
                        if (event.log) {
                            const log = event.log as AgentLog;
                            get().addAgentLog(event.agentId as string, {
                                ...log,
                                createdAt: new Date(log.createdAt),
                            });
                        }
                        break;

                    case 'agent:task-completed':
                        get().updateAgent(event.agentId as string, {
                            status: event.success ? 'completed' : 'failed',
                            verificationScore: event.verificationScore as number,
                        });
                        get().refreshMergeQueue();
                        break;

                    case 'agent:error':
                        get().updateAgent(event.agentId as string, {
                            status: 'failed',
                            lastError: event.error as string,
                        });
                        break;

                    case 'agent:stopped':
                        get().updateAgent(event.agentId as string, { status: 'paused' });
                        break;

                    case 'merge:queued':
                    case 'merge:approved':
                    case 'merge:rejected':
                    case 'merge:completed':
                        get().refreshMergeQueue();
                        break;

                    case 'session:paused':
                    case 'session:resumed':
                    case 'session:ended':
                    case 'session:config-updated':
                        get().refreshSession();
                        break;
                }
            },
        }),
        { name: 'developer-mode-store' }
    )
);

// =============================================================================
// SELECTORS
// =============================================================================

export const selectSession = (state: DeveloperModeState) => state.currentSession;
export const selectAgents = (state: DeveloperModeState) => state.currentSession?.agents || [];
export const selectSelectedAgent = (state: DeveloperModeState) => {
    const agents = state.currentSession?.agents || [];
    return agents.find(a => a.id === state.selectedAgentId);
};
export const selectSelectedAgentLogs = (state: DeveloperModeState) => {
    if (!state.selectedAgentId) return [];
    return state.agentLogs.get(state.selectedAgentId) || [];
};
export const selectMergeQueue = (state: DeveloperModeState) => state.mergeQueue;
export const selectPendingMerges = (state: DeveloperModeState) =>
    state.mergeQueue.filter(m => m.status === 'pending');
export const selectIsLoading = (state: DeveloperModeState) => state.isLoading;
export const selectError = (state: DeveloperModeState) => state.error;
export const selectAvailableModels = (state: DeveloperModeState) => state.availableModels;
export const selectCreditsUsed = (state: DeveloperModeState) =>
    state.currentSession?.creditsUsed || 0;
export const selectBudgetRemaining = (state: DeveloperModeState) => {
    const session = state.currentSession;
    if (!session || !session.budgetLimit) return null;
    return session.budgetLimit - session.creditsUsed;
};

