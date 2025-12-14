/**
 * Feature Agent Store with Persistence
 *
 * Zustand store for managing running feature agents with localStorage persistence.
 * Tracks running agents across browser sessions and manages open tile windows.
 */

import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import type { FeatureAgentTileStatus } from './useFeatureAgentTileStore';

export interface RunningAgent {
    id: string;
    name: string;
    model: string;
    modelName: string;
    status: FeatureAgentTileStatus;
    progress: number;
    taskPrompt: string;
    startedAt: string; // ISO string for serialization
    ghostModeEnabled: boolean;
    ghostModeConfig?: GhostModeAgentConfig;
}

export interface GhostModeAgentConfig {
    maxBudgetUSD: number;
    notifyEmail: boolean;
    emailAddress?: string;
    notifySMS: boolean;
    phoneNumber?: string;
    notifySlack: boolean;
    slackWebhookUrl?: string;
    notifyPush: boolean;
    notifyOnErrors: boolean;
    notifyOnDecisions: boolean;
    notifyOnBudgetThreshold: boolean;
    budgetThresholdPercent: number;
    notifyOnCompletion: boolean;
    mergeWhenComplete: boolean;
}

interface FeatureAgentStoreState {
    runningAgents: RunningAgent[];
    openTiles: string[]; // Agent IDs with open tile windows

    // Actions
    addRunningAgent: (agent: RunningAgent) => void;
    removeRunningAgent: (agentId: string) => void;
    updateAgentStatus: (agentId: string, updates: Partial<RunningAgent>) => void;
    setGhostMode: (agentId: string, config: GhostModeAgentConfig) => void;
    disableGhostMode: (agentId: string) => void;
    openTile: (agentId: string) => void;
    closeTile: (agentId: string) => void;
    clearCompletedAgents: () => void;
}

export const useFeatureAgentStore = create<FeatureAgentStoreState>()(
    devtools(
        persist(
            (set) => ({
                runningAgents: [],
                openTiles: [],

                addRunningAgent: (agent) => {
                    set((state) => {
                        // Avoid duplicates
                        if (state.runningAgents.some((a) => a.id === agent.id)) {
                            return state;
                        }
                        return {
                            runningAgents: [agent, ...state.runningAgents],
                        };
                    }, false, { type: 'featureAgentStore/addRunningAgent' });
                },

                removeRunningAgent: (agentId) => {
                    set((state) => ({
                        runningAgents: state.runningAgents.filter((a) => a.id !== agentId),
                        openTiles: state.openTiles.filter((id) => id !== agentId),
                    }), false, { type: 'featureAgentStore/removeRunningAgent' });
                },

                updateAgentStatus: (agentId, updates) => {
                    set((state) => ({
                        runningAgents: state.runningAgents.map((a) =>
                            a.id === agentId ? { ...a, ...updates } : a
                        ),
                    }), false, { type: 'featureAgentStore/updateAgentStatus' });
                },

                setGhostMode: (agentId, config) => {
                    set((state) => ({
                        runningAgents: state.runningAgents.map((a) =>
                            a.id === agentId
                                ? { ...a, ghostModeEnabled: true, ghostModeConfig: config }
                                : a
                        ),
                    }), false, { type: 'featureAgentStore/setGhostMode' });
                },

                disableGhostMode: (agentId) => {
                    set((state) => ({
                        runningAgents: state.runningAgents.map((a) =>
                            a.id === agentId
                                ? { ...a, ghostModeEnabled: false, ghostModeConfig: undefined }
                                : a
                        ),
                    }), false, { type: 'featureAgentStore/disableGhostMode' });
                },

                openTile: (agentId) => {
                    set((state) => {
                        if (state.openTiles.includes(agentId)) return state;
                        return { openTiles: [...state.openTiles, agentId] };
                    }, false, { type: 'featureAgentStore/openTile' });
                },

                closeTile: (agentId) => {
                    set((state) => ({
                        openTiles: state.openTiles.filter((id) => id !== agentId),
                    }), false, { type: 'featureAgentStore/closeTile' });
                },

                clearCompletedAgents: () => {
                    set((state) => ({
                        runningAgents: state.runningAgents.filter(
                            (a) => a.status !== 'complete' && a.status !== 'failed'
                        ),
                    }), false, { type: 'featureAgentStore/clearCompletedAgents' });
                },
            }),
            {
                name: 'feature-agent-storage',
                // Only persist runningAgents, not openTiles (they should reset on page load)
                partialize: (state) => ({ runningAgents: state.runningAgents }),
            }
        ),
        { name: 'FeatureAgentStore' }
    )
);
