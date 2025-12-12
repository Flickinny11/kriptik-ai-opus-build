import { AnimatePresence } from 'framer-motion';
import { useFeatureAgentTileStore } from '@/store/useFeatureAgentTileStore';
import { FeatureAgentTile } from './FeatureAgentTile';

export function FeatureAgentTileHost() {
  const order = useFeatureAgentTileStore((s) => s.order);
  const tiles = useFeatureAgentTileStore((s) => s.tiles);
  const minimizeTile = useFeatureAgentTileStore((s) => s.minimizeTile);

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


