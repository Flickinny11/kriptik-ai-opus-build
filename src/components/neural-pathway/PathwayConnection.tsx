/**
 * Pathway Connection Component
 * 
 * Animated SVG connection line between nodes in the neural pathway.
 * Shows data flow with animated particles.
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { PathwayConnection as ConnectionType, PathwayNode } from './types';

interface PathwayConnectionProps {
  connection: ConnectionType;
  fromNode: PathwayNode;
  toNode: PathwayNode;
}

export const PathwayConnection = memo(function PathwayConnection({
  connection,
  fromNode,
  toNode,
}: PathwayConnectionProps) {
  // Calculate SVG path coordinates (as percentages of container)
  const path = useMemo(() => {
    const x1 = fromNode.position.x;
    const y1 = fromNode.position.y;
    const x2 = toNode.position.x;
    const y2 = toNode.position.y;
    
    // Calculate control points for a curved bezier path
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    
    // Add some curve based on the direction
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Control point offset perpendicular to the line
    const curveFactor = Math.min(dist * 0.2, 10);
    const cx1 = midX - (dy / dist) * curveFactor;
    const cy1 = midY + (dx / dist) * curveFactor;
    
    return {
      x1, y1, x2, y2,
      cx1, cy1,
      pathD: `M ${x1} ${y1} Q ${cx1} ${cy1} ${x2} ${y2}`,
    };
  }, [fromNode.position, toNode.position]);
  
  const isActive = connection.status === 'active' || connection.status === 'pulsing';
  const isComplete = connection.status === 'complete';
  const hasDataFlow = connection.dataFlow;
  
  // Generate multiple particles for data flow effect
  const particles = useMemo(() => {
    if (!hasDataFlow) return [];
    return Array.from({ length: 5 }, (_, i) => ({
      id: i,
      delay: i * 0.3,
    }));
  }, [hasDataFlow]);
  
  return (
    <g className="pathway-connection">
      {/* Background line (always visible, dim) */}
      <motion.path
        d={path.pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        className="text-gray-800"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5 }}
        style={{
          vectorEffect: 'non-scaling-stroke',
        }}
        transform={`scale(${100 / 100})`}
      />
      
      {/* Active glow line */}
      {(isActive || isComplete) && (
        <motion.path
          d={path.pathD}
          fill="none"
          stroke={isComplete ? 'rgb(16, 185, 129)' : 'url(#connection-gradient)'}
          strokeWidth={isActive ? '2' : '1.5'}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          filter={isActive ? 'url(#glow)' : undefined}
          style={{
            vectorEffect: 'non-scaling-stroke',
          }}
        />
      )}
      
      {/* Animated pulse for active connections */}
      {isActive && (
        <motion.path
          d={path.pathD}
          fill="none"
          stroke="rgb(147, 51, 234)"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0, pathOffset: 0 }}
          animate={{
            pathOffset: [0, 1],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{
            vectorEffect: 'non-scaling-stroke',
            strokeDasharray: '20 80',
          }}
        />
      )}
      
      {/* Data flow particles */}
      {hasDataFlow && particles.map(particle => (
        <motion.circle
          key={particle.id}
          r="2"
          fill="rgb(147, 51, 234)"
          filter="url(#glow)"
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            offsetDistance: ['0%', '100%'],
          }}
          transition={{
            duration: 1.2,
            delay: particle.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{
            offsetPath: `path('${path.pathD}')`,
          }}
        />
      ))}
    </g>
  );
});
