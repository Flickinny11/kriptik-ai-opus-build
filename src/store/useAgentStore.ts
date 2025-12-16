import { create } from 'zustand';
import { AgentType, AgentStatus, AgentLog, AgentState, AGENTS } from '../lib/agent-types';

interface AgentStore {
    globalStatus: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
    activeAgent: AgentType | null;
    agents: Record<AgentType, AgentState>;
    logs: AgentLog[];

    setGlobalStatus: (status: AgentStore['globalStatus']) => void;
    setActiveAgent: (type: AgentType | null) => void;
    updateAgentStatus: (type: AgentType, status: AgentStatus) => void;
    updateAgentProgress: (type: AgentType, progress: number) => void;
    addLog: (log: AgentLog) => void;
    reset: () => void;
}

const initialAgentState = (type: AgentType): AgentState => ({
    type,
    name: AGENTS[type].name,
    status: 'idle',
    progress: 0,
    logs: []
});

export const useAgentStore = create<AgentStore>((set) => ({
    globalStatus: 'idle',
    activeAgent: null,
    agents: {
        planning: initialAgentState('planning'),
        generation: initialAgentState('generation'),
        testing: initialAgentState('testing'),
        refinement: initialAgentState('refinement'),
        deployment: initialAgentState('deployment'),
    },
    logs: [],

    setGlobalStatus: (status) => set({ globalStatus: status }),

    setActiveAgent: (type) => set({ activeAgent: type }),

    updateAgentStatus: (type, status) => set((state) => ({
        agents: {
            ...state.agents,
            [type]: { ...state.agents[type], status }
        }
    })),

    updateAgentProgress: (type, progress) => set((state) => ({
        agents: {
            ...state.agents,
            [type]: { ...state.agents[type], progress }
        }
    })),

    addLog: (log) => set((state) => ({
        logs: [...state.logs, log]
    })),

    reset: () => set({
        globalStatus: 'idle',
        activeAgent: null,
        agents: {
            planning: initialAgentState('planning'),
            generation: initialAgentState('generation'),
            testing: initialAgentState('testing'),
            refinement: initialAgentState('refinement'),
            deployment: initialAgentState('deployment'),
        },
        logs: []
    })
}));
