/**
 * Feature Agent Manager
 *
 * Renders all open Feature Agent tiles as draggable windows.
 * Handles tile positioning, z-index management, and edge cases:
 * - Browser refresh during implementation
 * - Network disconnection detection and reconnection
 * - Multiple tabs coordination
 * - Ghost mode agent completion while user is away
 */

import { useEffect, useRef, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useFeatureAgentTileStore } from '@/store/useFeatureAgentTileStore';
import { useFeatureAgentStore } from '@/store/feature-agent-store';
import { FeatureAgentTileV2 } from './FeatureAgentTileV2';

// Calculate staggered position for new tiles
function calculatePosition(index: number): { x: number; y: number } {
    const baseX = 80;
    const baseY = 80;
    const offsetX = 40;
    const offsetY = 40;

    return {
        x: baseX + (index % 5) * offsetX,
        y: baseY + (index % 5) * offsetY,
    };
}

// Tab coordination via BroadcastChannel (if supported)
const CHANNEL_NAME = 'kriptik-feature-agent-sync';

export function FeatureAgentManager() {
    const order = useFeatureAgentTileStore((s) => s.order);
    const tiles = useFeatureAgentTileStore((s) => s.tiles);
    const minimizeTile = useFeatureAgentTileStore((s) => s.minimizeTile);

    // Persisted running agents
    const runningAgents = useFeatureAgentStore((s) => s.runningAgents);
    const updateAgentStatus = useFeatureAgentStore((s) => s.updateAgentStatus);
    const removeRunningAgent = useFeatureAgentStore((s) => s.removeRunningAgent);

    // Track reconnection attempts and online status
    const reconnectedRef = useRef<Set<string>>(new Set());
    const isReconnectingRef = useRef(false);
    const channelRef = useRef<BroadcastChannel | null>(null);

    // Handle online/offline status
    const handleOnline = useCallback(() => {
        console.log('[FeatureAgentManager] Network reconnected, checking agent status...');
        reconnectActiveAgents();
    }, []);

    const handleOffline = useCallback(() => {
        console.log('[FeatureAgentManager] Network disconnected');
    }, []);

    // Reconnect to active agents
    const reconnectActiveAgents = useCallback(async () => {
        if (isReconnectingRef.current) return;
        isReconnectingRef.current = true;

        const activeAgents = runningAgents.filter(
            (a) => !['complete', 'failed', 'paused'].includes(a.status)
        );

        for (const agent of activeAgents) {
            // Skip if already reconnected this session
            if (reconnectedRef.current.has(agent.id)) continue;
            reconnectedRef.current.add(agent.id);

            try {
                const response = await fetch(
                    `/api/developer-mode/feature-agent/${encodeURIComponent(agent.id)}`,
                    { credentials: 'include' }
                );

                if (!response.ok) {
                    // Agent no longer exists on server
                    if (response.status === 404) {
                        updateAgentStatus(agent.id, { status: 'failed' });
                        reconnectedRef.current.delete(agent.id);
                    }
                    continue;
                }

                const data = await response.json();

                if (data.success && data.agent) {
                    const serverStatus = data.agent.status;

                    // Handle ghost mode completion
                    if (agent.ghostModeEnabled && (serverStatus === 'complete' || serverStatus === 'completed')) {
                        updateAgentStatus(agent.id, { status: 'complete', progress: 100 });

                        // Show notification if permission granted
                        if (Notification.permission === 'granted') {
                            new Notification('Feature Complete', {
                                body: `${agent.name} has completed building your feature.`,
                                icon: '/favicon.ico',
                            });
                        }
                    } else if (serverStatus === 'complete' || serverStatus === 'completed') {
                        updateAgentStatus(agent.id, { status: 'complete', progress: 100 });
                    } else if (serverStatus === 'failed') {
                        updateAgentStatus(agent.id, { status: 'failed' });
                    } else {
                        updateAgentStatus(agent.id, {
                            progress: data.agent.progress?.progress ?? agent.progress,
                        });
                    }
                }
            } catch (error) {
                console.error(`Failed to reconnect to agent ${agent.id}:`, error);
            }
        }

        isReconnectingRef.current = false;
    }, [runningAgents, updateAgentStatus]);

    // Initialize on mount
    useEffect(() => {
        // Online/offline listeners
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Visibility change handler for ghost mode agents
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // User returned to tab - refresh agent status
                reconnectedRef.current.clear();
                reconnectActiveAgents();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // BroadcastChannel for multi-tab coordination
        if ('BroadcastChannel' in window) {
            channelRef.current = new BroadcastChannel(CHANNEL_NAME);

            channelRef.current.onmessage = (event) => {
                const { type, agentId, status } = event.data;

                if (type === 'agent_status_update' && agentId && status) {
                    updateAgentStatus(agentId, { status });
                } else if (type === 'agent_removed' && agentId) {
                    removeRunningAgent(agentId);
                }
            };
        }

        // Reconnect on page load
        reconnectActiveAgents();

        // Cleanup
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            document.removeEventListener('visibilitychange', handleVisibilityChange);

            if (channelRef.current) {
                channelRef.current.close();
            }
        };
    }, [handleOnline, handleOffline, reconnectActiveAgents, updateAgentStatus, removeRunningAgent]);

    // Render all visible tiles
    return (
        <AnimatePresence>
            {order.map((agentId, index) => {
                const tile = tiles[agentId];
                if (!tile || tile.minimized) return null;

                return (
                    <FeatureAgentTileV2
                        key={agentId}
                        agentId={agentId}
                        onClose={() => minimizeTile(agentId)}
                        onMinimize={() => minimizeTile(agentId)}
                        initialPosition={tile.position ?? calculatePosition(index)}
                    />
                );
            })}
        </AnimatePresence>
    );
}

export default FeatureAgentManager;
