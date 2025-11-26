import { create } from 'zustand';
import { ProjectMemory } from '../lib/memory-types';

interface MemoryStore {
    memory: ProjectMemory;
    isLoading: boolean;

    // Actions
    addPattern: (pattern: any) => void;
    addBusinessRule: (rule: string) => void;
    addLearning: (insight: string, type: 'preference' | 'correction' | 'optimization') => void;
    updateComponentUsage: (component: string, consumer: string) => void;
}

// Mock Initial Data
const INITIAL_MEMORY: ProjectMemory = {
    projectId: 'demo-project-1',
    knowledgeGraph: {
        architecture: {
            id: 'arch-1',
            framework: 'React + Vite',
            reasoning: 'User requested lightweight SPA with fast build times',
            decidedAt: new Date().toISOString()
        },
        patterns: [
            {
                id: 'pat-1',
                category: 'styling',
                description: 'Tailwind CSS with Shadcn UI components',
                usageCount: 15
            },
            {
                id: 'pat-2',
                category: 'stateManagement',
                description: 'Zustand for global client state',
                usageCount: 4
            }
        ],
        components: {
            'Button': {
                name: 'Button',
                variants: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
                dependencies: ['radix-ui/slot', 'class-variance-authority'],
                usedIn: ['Header', 'Hero', 'LoginForm']
            },
            'Card': {
                name: 'Card',
                variants: ['default'],
                dependencies: ['cn'],
                usedIn: ['ProjectCard', 'UsageStats']
            }
        },
        businessRules: [
            {
                id: 'rule-1',
                rule: 'All forms must use Zod validation',
                category: 'validation'
            },
            {
                id: 'rule-2',
                rule: 'Dark mode is the default theme',
                category: 'workflow'
            }
        ],
        learnings: [
            {
                id: 'learn-1',
                insight: 'User prefers "lucide-react" for icons over "heroicons"',
                type: 'preference',
                timestamp: new Date().toISOString()
            }
        ]
    }
};

export const useMemoryStore = create<MemoryStore>((set) => ({
    memory: INITIAL_MEMORY,
    isLoading: false,

    addPattern: (pattern) => set((state) => ({
        memory: {
            ...state.memory,
            knowledgeGraph: {
                ...state.memory.knowledgeGraph,
                patterns: [...state.memory.knowledgeGraph.patterns, pattern]
            }
        }
    })),

    addBusinessRule: (rule) => set((state) => ({
        memory: {
            ...state.memory,
            knowledgeGraph: {
                ...state.memory.knowledgeGraph,
                businessRules: [
                    ...state.memory.knowledgeGraph.businessRules,
                    {
                        id: Math.random().toString(36).substr(2, 9),
                        rule,
                        category: 'other'
                    }
                ]
            }
        }
    })),

    addLearning: (insight, type) => set((state) => ({
        memory: {
            ...state.memory,
            knowledgeGraph: {
                ...state.memory.knowledgeGraph,
                learnings: [
                    ...state.memory.knowledgeGraph.learnings,
                    {
                        id: Math.random().toString(36).substr(2, 9),
                        insight,
                        type,
                        timestamp: new Date().toISOString()
                    }
                ]
            }
        }
    })),

    updateComponentUsage: (component, consumer) => set((state) => {
        const components = { ...state.memory.knowledgeGraph.components };
        if (components[component]) {
            components[component] = {
                ...components[component],
                usedIn: [...new Set([...components[component].usedIn, consumer])]
            };
        }
        return {
            memory: {
                ...state.memory,
                knowledgeGraph: {
                    ...state.memory.knowledgeGraph,
                    components
                }
            }
        };
    })
}));
