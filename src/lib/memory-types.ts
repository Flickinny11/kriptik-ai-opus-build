export interface ArchitectureDecision {
    id: string;
    framework: string;
    reasoning: string;
    decidedAt: string;
}

export interface Pattern {
    id: string;
    category: 'authentication' | 'stateManagement' | 'styling' | 'other';
    description: string;
    usageCount: number;
}

export interface ComponentNode {
    name: string;
    variants: string[];
    dependencies: string[];
    usedIn: string[];
}

export interface BusinessRule {
    id: string;
    rule: string;
    category: 'pricing' | 'validation' | 'workflow' | 'other';
}

export interface Learning {
    id: string;
    insight: string;
    type: 'preference' | 'correction' | 'optimization';
    timestamp: string;
}

export interface KnowledgeGraph {
    architecture: ArchitectureDecision;
    patterns: Pattern[];
    components: Record<string, ComponentNode>;
    businessRules: BusinessRule[];
    learnings: Learning[];
}

export interface ProjectMemory {
    projectId: string;
    knowledgeGraph: KnowledgeGraph;
}
