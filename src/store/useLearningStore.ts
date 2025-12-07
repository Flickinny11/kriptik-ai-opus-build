/**
 * Learning System Store
 *
 * Zustand store for the Autonomous Learning Engine state management.
 * Handles system status, patterns, strategies, and user preferences.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// =============================================================================
// TYPES
// =============================================================================

export interface LearningSystemStatus {
    isRunning: boolean;
    currentCycleId: string | null;
    lastCycle: {
        cycleNumber: number;
        improvementPercent: number;
        tracesCaptured: number;
        patternsExtracted: number;
        completedAt: string;
    } | null;
    totalCycles: number;
    overallImprovement: number;
    patternStats: {
        total: number;
        byCategory: Record<string, number>;
        avgSuccessRate: number;
    };
    strategyStats: {
        total: number;
        active: number;
        experimental: number;
        avgSuccessRate: number;
    };
    pairStats: {
        total: number;
        unused: number;
        byDomain: Record<string, number>;
    };
}

export interface LearningPreferences {
    // Auto-learning during builds
    autoCapture: boolean;
    captureDecisions: boolean;
    captureCode: boolean;
    captureDesign: boolean;
    captureErrors: boolean;

    // Pattern usage
    useLearnedPatterns: boolean;
    patternSuggestions: boolean;

    // Strategy selection
    useLearnedStrategies: boolean;
    allowExperimentalStrategies: boolean;

    // UI display
    showLearningStatus: boolean;
    showInsightsInBuilder: boolean;
    compactLearningView: boolean;
}

export interface LearningStoreState {
    // Status
    status: LearningSystemStatus | null;
    statusLoading: boolean;
    statusError: string | null;
    lastStatusFetch: number | null;

    // Preferences
    preferences: LearningPreferences;

    // Actions
    fetchStatus: () => Promise<void>;
    runCycle: (userId: string) => Promise<void>;
    updatePreferences: (updates: Partial<LearningPreferences>) => void;
    clearError: () => void;
}

// =============================================================================
// DEFAULT PREFERENCES
// =============================================================================

const DEFAULT_PREFERENCES: LearningPreferences = {
    autoCapture: true,
    captureDecisions: true,
    captureCode: true,
    captureDesign: true,
    captureErrors: true,
    useLearnedPatterns: true,
    patternSuggestions: true,
    useLearnedStrategies: true,
    allowExperimentalStrategies: false,
    showLearningStatus: true,
    showInsightsInBuilder: true,
    compactLearningView: false,
};

// =============================================================================
// API CLIENT
// =============================================================================

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function fetchLearningStatus(): Promise<LearningSystemStatus> {
    const res = await fetch(`${apiUrl}/api/learning/status`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch status');
    return data.data;
}

async function runEvolutionCycle(userId: string): Promise<void> {
    const res = await fetch(`${apiUrl}/api/learning/cycles/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to run cycle');
}

// =============================================================================
// STORE
// =============================================================================

export const useLearningStore = create<LearningStoreState>()(
    persist(
        (set, get) => ({
            // Initial state
            status: null,
            statusLoading: false,
            statusError: null,
            lastStatusFetch: null,
            preferences: DEFAULT_PREFERENCES,

            // Fetch status
            fetchStatus: async () => {
                const { statusLoading, lastStatusFetch } = get();

                // Throttle requests (minimum 30 seconds between fetches)
                if (statusLoading) return;
                if (lastStatusFetch && Date.now() - lastStatusFetch < 30000) return;

                set({ statusLoading: true, statusError: null });

                try {
                    const status = await fetchLearningStatus();
                    set({
                        status,
                        statusLoading: false,
                        lastStatusFetch: Date.now(),
                    });
                } catch (error) {
                    set({
                        statusLoading: false,
                        statusError: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            },

            // Run evolution cycle
            runCycle: async (userId: string) => {
                set({ statusLoading: true, statusError: null });

                try {
                    await runEvolutionCycle(userId);
                    // Refresh status after cycle
                    const status = await fetchLearningStatus();
                    set({
                        status,
                        statusLoading: false,
                        lastStatusFetch: Date.now(),
                    });
                } catch (error) {
                    set({
                        statusLoading: false,
                        statusError: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            },

            // Update preferences
            updatePreferences: (updates: Partial<LearningPreferences>) => {
                const { preferences } = get();
                set({
                    preferences: { ...preferences, ...updates },
                });
            },

            // Clear error
            clearError: () => {
                set({ statusError: null });
            },
        }),
        {
            name: 'kriptik-learning-store',
            partialize: (state) => ({
                preferences: state.preferences,
            }),
        }
    )
);

export default useLearningStore;

