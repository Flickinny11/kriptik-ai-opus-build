export type AgentType = 'planning' | 'generation' | 'testing' | 'refinement' | 'deployment';

export type AgentStatus = 'idle' | 'working' | 'completed' | 'failed' | 'paused';

export interface AgentStep {
    id: string;
    description: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface AgentLog {
    id: string;
    agentType: AgentType;
    message: string;
    timestamp: Date;
    type: 'info' | 'success' | 'warning' | 'error' | 'thought';
}

export interface AgentState {
    type: AgentType;
    name: string;
    status: AgentStatus;
    progress: number; // 0-100
    currentStep?: string;
    logs: AgentLog[];
}

export interface Agent {
    type: AgentType;
    name: string;
    description: string;
    color: string;
    icon: string; // Lucide icon name
}

export const AGENTS: Record<AgentType, Agent> = {
    planning: {
        type: 'planning',
        name: 'Planning Agent',
        description: 'Analyzes requirements and creates architecture',
        color: 'text-blue-500',
        icon: 'BrainCircuit'
    },
    generation: {
        type: 'generation',
        name: 'Generation Agent',
        description: 'Writes code and creates files',
        color: 'text-purple-500',
        icon: 'Code2'
    },
    testing: {
        type: 'testing',
        name: 'Testing Agent',
        description: 'Validates code and checks for bugs',
        color: 'text-yellow-500',
        icon: 'TestTube2'
    },
    refinement: {
        type: 'refinement',
        name: 'Refinement Agent',
        description: 'Optimizes and polishes the codebase',
        color: 'text-green-500',
        icon: 'Sparkles'
    },
    deployment: {
        type: 'deployment',
        name: 'Deployment Agent',
        description: 'Prepares for production deployment',
        color: 'text-orange-500',
        icon: 'Rocket'
    }
};
