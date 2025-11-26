/**
 * Generation Store - Real AI generation with streaming
 *
 * Connects to the backend for actual Claude-powered code generation
 */

import { create } from 'zustand';
import { apiClient, AgentLog, GenerationComplete } from '../lib/api-client';

export type AgentType = 'planning' | 'generation' | 'testing' | 'refinement' | 'deployment';
export type AgentStatus = 'idle' | 'working' | 'completed' | 'failed' | 'paused';
export type GenerationStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

export interface AgentState {
    type: AgentType;
    status: AgentStatus;
    progress: number;
}

export interface GeneratedFile {
    path: string;
    content: string;
    timestamp: Date;
}

interface GenerationState {
    // Status
    status: GenerationStatus;
    currentPrompt: string | null;

    // Agents
    agents: Record<AgentType, AgentState>;
    activeAgent: AgentType | null;

    // Logs
    logs: AgentLog[];

    // Generated files
    generatedFiles: GeneratedFile[];

    // Usage
    usage: {
        inputTokens: number;
        outputTokens: number;
        thinkingTokens: number;
    };

    // Timing
    startedAt: Date | null;
    completedAt: Date | null;

    // Actions
    startGeneration: (projectId: string, prompt: string) => Promise<void>;
    stopGeneration: () => void;
    reset: () => void;

    // Internal actions
    setStatus: (status: GenerationStatus) => void;
    setActiveAgent: (agent: AgentType | null) => void;
    updateAgentState: (agent: AgentType, state: Partial<AgentState>) => void;
    addLog: (log: AgentLog) => void;
    addGeneratedFile: (file: GeneratedFile) => void;
    setUsage: (usage: { inputTokens: number; outputTokens: number; thinkingTokens: number }) => void;
}

const initialAgentState = (type: AgentType): AgentState => ({
    type,
    status: 'idle',
    progress: 0,
});

const initialAgents: Record<AgentType, AgentState> = {
    planning: initialAgentState('planning'),
    generation: initialAgentState('generation'),
    testing: initialAgentState('testing'),
    refinement: initialAgentState('refinement'),
    deployment: initialAgentState('deployment'),
};

export const useGenerationStore = create<GenerationState>((set, get) => ({
    status: 'idle',
    currentPrompt: null,
    agents: { ...initialAgents },
    activeAgent: null,
    logs: [],
    generatedFiles: [],
    usage: {
        inputTokens: 0,
        outputTokens: 0,
        thinkingTokens: 0,
    },
    startedAt: null,
    completedAt: null,

    startGeneration: async (projectId: string, prompt: string) => {
        // Reset state
        set({
            status: 'running',
            currentPrompt: prompt,
            agents: { ...initialAgents },
            activeAgent: 'planning',
            logs: [],
            generatedFiles: [],
            usage: { inputTokens: 0, outputTokens: 0, thinkingTokens: 0 },
            startedAt: new Date(),
            completedAt: null,
        });

        try {
            // Stream generation from backend
            for await (const event of apiClient.generate(projectId, prompt)) {
                // Check if stopped
                if (get().status !== 'running') break;

                switch (event.type) {
                    case 'start':
                        console.log('Generation started:', event.data);
                        break;

                    case 'log':
                        get().addLog(event.data);
                        break;

                    case 'agent':
                        const agentType = event.data.agent as AgentType;
                        get().updateAgentState(agentType, {
                            status: event.data.status as AgentStatus,
                            progress: event.data.progress,
                        });
                        if (event.data.status === 'working') {
                            set({ activeAgent: agentType });
                        }
                        break;

                    case 'file':
                        get().addGeneratedFile({
                            path: event.data.path,
                            content: event.data.content,
                            timestamp: new Date(),
                        });
                        break;

                    case 'progress':
                        const progressAgent = event.data.phase as AgentType;
                        get().updateAgentState(progressAgent, {
                            progress: event.data.progress,
                        });
                        break;

                    case 'complete':
                        const complete = event.data as GenerationComplete;
                        set({
                            status: complete.status as GenerationStatus,
                            completedAt: new Date(),
                            usage: {
                                inputTokens: complete.usage.totalInputTokens,
                                outputTokens: complete.usage.totalOutputTokens,
                                thinkingTokens: complete.usage.totalThinkingTokens,
                            },
                        });
                        break;

                    case 'error':
                        set({ status: 'failed' });
                        get().addLog({
                            id: Date.now().toString(),
                            agentType: 'planning',
                            message: event.data.message,
                            type: 'error',
                            timestamp: new Date().toISOString(),
                        });
                        break;
                }
            }
        } catch (error) {
            console.error('Generation failed:', error);
            set({ status: 'failed' });
            get().addLog({
                id: Date.now().toString(),
                agentType: 'planning',
                message: error instanceof Error ? error.message : 'Generation failed',
                type: 'error',
                timestamp: new Date().toISOString(),
            });
        }
    },

    stopGeneration: () => {
        set({ status: 'idle' });
    },

    reset: () => {
        set({
            status: 'idle',
            currentPrompt: null,
            agents: { ...initialAgents },
            activeAgent: null,
            logs: [],
            generatedFiles: [],
            usage: { inputTokens: 0, outputTokens: 0, thinkingTokens: 0 },
            startedAt: null,
            completedAt: null,
        });
    },

    setStatus: (status) => set({ status }),

    setActiveAgent: (agent) => set({ activeAgent: agent }),

    updateAgentState: (agent, state) => set((prev) => ({
        agents: {
            ...prev.agents,
            [agent]: { ...prev.agents[agent], ...state },
        },
    })),

    addLog: (log) => set((prev) => ({
        logs: [...prev.logs, log],
    })),

    addGeneratedFile: (file) => set((prev) => ({
        generatedFiles: [...prev.generatedFiles.filter(f => f.path !== file.path), file],
    })),

    setUsage: (usage) => set({ usage }),
}));

