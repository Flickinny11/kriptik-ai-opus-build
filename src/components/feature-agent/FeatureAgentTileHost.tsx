import { useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useFeatureAgentTileStore } from '@/store/useFeatureAgentTileStore';
import { useFeatureAgentStore } from '@/store/feature-agent-store';
import { FeatureAgentTile } from './FeatureAgentTile';

/**
 * Feature Agent Tile Host
 *
 * Renders all open feature agent tiles and handles:
 * - SSE reconnection on page load for persisted running agents
 * - Graceful handling of browser close/reopen
 */
export function FeatureAgentTileHost() {
  const order = useFeatureAgentTileStore((s) => s.order);
  const tiles = useFeatureAgentTileStore((s) => s.tiles);
  const minimizeTile = useFeatureAgentTileStore((s) => s.minimizeTile);

  // Persisted running agents
  const runningAgents = useFeatureAgentStore((s) => s.runningAgents);
  const updateAgentStatus = useFeatureAgentStore((s) => s.updateAgentStatus);

  // Track reconnection attempts
  const reconnectedRef = useRef<Set<string>>(new Set());

  // On page load, check for persisted running agents and reconnect to their SSE streams
  useEffect(() => {
    const activeAgents = runningAgents.filter(
      (a) => !['complete', 'failed', 'paused'].includes(a.status)
    );

    activeAgents.forEach((agent) => {
      // Skip if already reconnected
      if (reconnectedRef.current.has(agent.id)) return;
      reconnectedRef.current.add(agent.id);

      // Reconnect to SSE stream for status updates
      const reconnect = async () => {
        try {
          // Fetch current status from API first
          const response = await fetch(
            `/api/developer-mode/feature-agent/${encodeURIComponent(agent.id)}`,
            { credentials: 'include' }
          );

          if (!response.ok) {
            // Agent no longer exists on server - mark as failed
            updateAgentStatus(agent.id, { status: 'failed' });
            reconnectedRef.current.delete(agent.id);
            return;
          }

          const data = await response.json();

          if (data.success && data.agent) {
            // Update status from server
            const serverStatus = data.agent.status;
            if (serverStatus === 'complete' || serverStatus === 'completed') {
              updateAgentStatus(agent.id, { status: 'complete', progress: 100 });
            } else if (serverStatus === 'failed') {
              updateAgentStatus(agent.id, { status: 'failed' });
            } else {
              // Agent still running - connect SSE stream via tile
              // The tile component handles SSE connection
              updateAgentStatus(agent.id, {
                progress: data.agent.progress?.progress ?? agent.progress,
              });
            }
          }
        } catch (error) {
          console.error(`Failed to reconnect to agent ${agent.id}:`, error);
          // Keep the agent in the list but don't remove - may be temporary network issue
        }
      };

      reconnect();
    });
  }, []); // Only run on mount

  // Close means "minimize" per requirements (do not stop agent).
  return (
    <AnimatePresence>
      {order.map((agentId) => {
        const tile = tiles[agentId];
        if (!tile || tile.minimized) return null;
        return (
          <FeatureAgentTile
            key={agentId}
            agentId={agentId}
            onClose={() => minimizeTile(agentId)}
            onMinimize={() => minimizeTile(agentId)}
            initialPosition={tile.position}
          />
        );
      })}
    </AnimatePresence>
  );
}
