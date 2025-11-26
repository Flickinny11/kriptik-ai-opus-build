export interface CostEstimate {
    totalCredits: number;
    complexity: 'Low' | 'Medium' | 'High';
    breakdown: {
        planning: number;
        generation: number;
        testing: number;
        refinement: number;
    };
    costDrivers: string[];
    confidence: number; // 0-100
}

export interface UsageLog {
    id: string;
    projectId: string;
    timestamp: string;
    creditsUsed: number;
    actionType: 'generation' | 'refinement' | 'chat' | 'deployment';
    details: string;
    balanceAfter: number;
}

export interface CreditBalance {
    available: number;
    totalUsedThisMonth: number;
    limit: number;
    resetDate: string;
}

export interface CostBreakdown {
    totalUsed: number;
    agentBreakdown: Record<string, number>;
    drivers: { name: string; cost: number }[];
    optimizationTips: string[];
}
