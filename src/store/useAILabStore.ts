/**
 * AI Lab Zustand Store (PROMPT 6)
 *
 * State management for the multi-agent research orchestration UI
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// TYPES
// ============================================================================

export interface ResearchFinding {
    id: string;
    category: 'insight' | 'recommendation' | 'warning' | 'question' | 'resource';
    summary: string;
    details: string;
    confidence: number;
    relevance: number;
    timestamp: Date;
}

export interface OrchestrationState {
    id: string;
    index: number;
    focusArea: string;
    currentPhase: number;
    phaseProgress: number;
    phaseStatus: 'pending' | 'running' | 'completed' | 'failed';
    status: 'queued' | 'initializing' | 'running' | 'completed' | 'failed' | 'stopped';
    findings: ResearchFinding[];
    conclusion?: string;
    tokensUsed: number;
    costCents: number;
}

export interface AgentMessage {
    id: string;
    fromOrchestrationId: string;
    toOrchestrationId?: string;
    messageType: 'focus_announcement' | 'finding' | 'conflict' | 'request' | 'response';
    content: string;
    timestamp: Date;
}

export interface SynthesizedResult {
    summary: string;
    keyInsights: Array<{
        id: string;
        title: string;
        description: string;
        priority: 'critical' | 'high' | 'medium' | 'low';
        confidence: number;
    }>;
    recommendations: Array<{
        id: string;
        title: string;
        description: string;
        effort: 'low' | 'medium' | 'high';
        impact: 'low' | 'medium' | 'high';
    }>;
    nextSteps: string[];
    confidence: number;
    completeness: number;
}

export interface AILabSession {
    id: string;
    researchPrompt: string;
    problemType: 'general' | 'code_review' | 'architecture' | 'optimization' | 'research';
    status: 'initializing' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
    budgetLimitCents: number;
    budgetUsedCents: number;
    orchestrations: OrchestrationState[];
    messages: AgentMessage[];
    synthesizedResult?: SynthesizedResult;
    startedAt?: string;
    completedAt?: string;
}

export interface AILabState {
    // UI state
    isOpen: boolean;
    activeTab: 'research' | 'history' | 'results' | 'tournament';

    // Session state
    currentSession: AILabSession | null;
    sessionHistory: AILabSession[];

    // Form state
    researchPrompt: string;
    selectedProblemType: AILabSession['problemType'];
    budgetLimitDollars: number;
    maxOrchestrations: number;

    // Loading states
    isCreating: boolean;
    isStarting: boolean;
    isStopping: boolean;
    isLoadingHistory: boolean;

    // Error state
    error: string | null;

    // Actions
    setOpen: (isOpen: boolean) => void;
    setActiveTab: (tab: AILabState['activeTab']) => void;
    setResearchPrompt: (prompt: string) => void;
    setSelectedProblemType: (type: AILabSession['problemType']) => void;
    setBudgetLimitDollars: (limit: number) => void;
    setMaxOrchestrations: (max: number) => void;
    setCurrentSession: (session: AILabSession | null) => void;
    updateOrchestration: (orchestrationId: string, updates: Partial<OrchestrationState>) => void;
    addMessage: (message: AgentMessage) => void;
    setSessionHistory: (history: AILabSession[]) => void;
    setError: (error: string | null) => void;
    setIsCreating: (isCreating: boolean) => void;
    setIsStarting: (isStarting: boolean) => void;
    setIsStopping: (isStopping: boolean) => void;
    setIsLoadingHistory: (isLoading: boolean) => void;
    reset: () => void;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_STATE = {
    isOpen: false,
    activeTab: 'research' as const,
    currentSession: null,
    sessionHistory: [],
    researchPrompt: '',
    selectedProblemType: 'general' as const,
    budgetLimitDollars: 100,
    maxOrchestrations: 5,
    isCreating: false,
    isStarting: false,
    isStopping: false,
    isLoadingHistory: false,
    error: null,
};

// ============================================================================
// STORE
// ============================================================================

export const useAILabStore = create<AILabState>()(
    persist(
        (set) => ({
            ...DEFAULT_STATE,

            setOpen: (isOpen) => set({ isOpen }),
            setActiveTab: (activeTab) => set({ activeTab }),
            setResearchPrompt: (researchPrompt) => set({ researchPrompt }),
            setSelectedProblemType: (selectedProblemType) => set({ selectedProblemType }),
            setBudgetLimitDollars: (budgetLimitDollars) => set({ budgetLimitDollars }),
            setMaxOrchestrations: (maxOrchestrations) => set({ maxOrchestrations }),

            setCurrentSession: (currentSession) => set({ currentSession }),

            updateOrchestration: (orchestrationId, updates) => set((state) => {
                if (!state.currentSession) return state;

                const orchestrations = state.currentSession.orchestrations.map(o =>
                    o.id === orchestrationId ? { ...o, ...updates } : o
                );

                return {
                    currentSession: {
                        ...state.currentSession,
                        orchestrations,
                    },
                };
            }),

            addMessage: (message) => set((state) => {
                if (!state.currentSession) return state;

                return {
                    currentSession: {
                        ...state.currentSession,
                        messages: [...state.currentSession.messages, message],
                    },
                };
            }),

            setSessionHistory: (sessionHistory) => set({ sessionHistory }),
            setError: (error) => set({ error }),
            setIsCreating: (isCreating) => set({ isCreating }),
            setIsStarting: (isStarting) => set({ isStarting }),
            setIsStopping: (isStopping) => set({ isStopping }),
            setIsLoadingHistory: (isLoadingHistory) => set({ isLoadingHistory }),

            reset: () => set(DEFAULT_STATE),
        }),
        {
            name: 'ai-lab-storage',
            partialize: (state) => ({
                sessionHistory: state.sessionHistory,
                budgetLimitDollars: state.budgetLimitDollars,
                maxOrchestrations: state.maxOrchestrations,
            }),
        }
    )
);
