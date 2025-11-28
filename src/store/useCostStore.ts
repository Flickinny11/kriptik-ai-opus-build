import { create } from 'zustand';
import { CreditBalance, UsageLog, CostEstimate, CostBreakdown } from '../lib/cost-types';
import { apiClient } from '../lib/api-client';

interface CostStore {
    balance: CreditBalance;
    usageHistory: UsageLog[];
    activeSessionCost: number;
    currentEstimate: CostEstimate | null;
    lastBreakdown: CostBreakdown | null;
    isLoading: boolean;

    // Actions
    fetchCredits: () => Promise<void>;
    deductCredits: (amount: number, action: string) => void;
    setEstimate: (estimate: CostEstimate | null) => void;
    setBreakdown: (breakdown: CostBreakdown | null) => void;
    resetSessionCost: () => void;
    addUsageLog: (log: UsageLog) => void;
}

// Default balance (shown while loading)
const DEFAULT_BALANCE: CreditBalance = {
    available: 0,
    totalUsedThisMonth: 0,
    limit: 500,
    resetDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString()
};

export const useCostStore = create<CostStore>((set, get) => ({
    balance: DEFAULT_BALANCE,
    usageHistory: [],
    activeSessionCost: 0,
    currentEstimate: null,
    lastBreakdown: null,
    isLoading: true,

    fetchCredits: async () => {
        try {
            set({ isLoading: true });

            // Fetch credits from backend
            const { data } = await apiClient.get<{
                credits: number;
                tier: string;
                usedThisMonth?: number;
            }>('/api/billing/credits');

            set({
                balance: {
                    available: data.credits || 0,
                    totalUsedThisMonth: data.usedThisMonth || 0,
                    limit: data.tier === 'unlimited' ? Infinity : (data.tier === 'enterprise' ? 100000 : (data.tier === 'pro' ? 10000 : 500)),
                    resetDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString()
                },
                isLoading: false,
            });
        } catch (error) {
            console.error('[CostStore] Failed to fetch credits:', error);
            set({ isLoading: false });
        }
    },

    deductCredits: (amount, action) => {
        const { balance, activeSessionCost } = get();
        const newBalance = balance.available - amount;

        set({
            balance: {
                ...balance,
                available: Math.max(0, newBalance),
                totalUsedThisMonth: balance.totalUsedThisMonth + amount
            },
            activeSessionCost: activeSessionCost + amount
        });

        get().addUsageLog({
            id: Math.random().toString(36).substr(2, 9),
            projectId: 'current-project',
            timestamp: new Date().toISOString(),
            creditsUsed: amount,
            actionType: 'generation',
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
