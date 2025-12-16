import { create } from 'zustand';
import { AgentType, AgentStatus, AgentLog, AgentState, AGENTS } from '../lib/agent-types';
import { limitArray } from '../lib/store-utils';

// Maximum logs to prevent memory leaks
const MAX_LOGS = 1000;

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
    clearLogs: () => void;
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
        // Limit logs array to prevent memory leaks
        logs: limitArray([...state.logs, log], {
            maxItems: MAX_LOGS,
            removeStrategy: 'fifo'
        })
    })),

    clearLogs: () => set({ logs: [] }),

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
