import { create } from 'zustand';
import { CreditBalance, UsageLog, CostEstimate, CostBreakdown } from '../lib/cost-types';

interface CostStore {
    balance: CreditBalance;
    usageHistory: UsageLog[];
    activeSessionCost: number;
    currentEstimate: CostEstimate | null;
    lastBreakdown: CostBreakdown | null;

    // Actions
    deductCredits: (amount: number, action: string) => void;
    setEstimate: (estimate: CostEstimate | null) => void;
    setBreakdown: (breakdown: CostBreakdown | null) => void;
    resetSessionCost: () => void;
    addUsageLog: (log: UsageLog) => void;
}

// Mock Initial Data
const INITIAL_BALANCE: CreditBalance = {
    available: 87,
    totalUsedThisMonth: 43,
    limit: 100,
    resetDate: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString() // 15 days from now
};

export const useCostStore = create<CostStore>((set, get) => ({
    balance: INITIAL_BALANCE,
    usageHistory: [],
    activeSessionCost: 0,
    currentEstimate: null,
    lastBreakdown: null,

    deductCredits: (amount, action) => {
        const { balance, activeSessionCost } = get();
        const newBalance = balance.available - amount;

        // Circuit breaker check could go here

        set({
            balance: {
                ...balance,
                available: newBalance,
                totalUsedThisMonth: balance.totalUsedThisMonth + amount
            },
            activeSessionCost: activeSessionCost + amount
        });

        get().addUsageLog({
            id: Math.random().toString(36).substr(2, 9),
            projectId: 'current-project',
            timestamp: new Date().toISOString(),
            creditsUsed: amount,
            actionType: 'generation', // Simplified for now
            details: action,
            balanceAfter: newBalance
        });
    },

    setEstimate: (estimate) => set({ currentEstimate: estimate }),
    setBreakdown: (breakdown) => set({ lastBreakdown: breakdown }),
    resetSessionCost: () => set({ activeSessionCost: 0 }),

    addUsageLog: (log) => set((state) => ({
        usageHistory: [log, ...state.usageHistory]
    }))
}));
