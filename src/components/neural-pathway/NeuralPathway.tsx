/**
 * Neural Pathway Visualization
 * 
 * A beautiful, animated visualization showing real-time AI orchestration.
 * Displays the user's prompt flowing through KripTik's processing pipeline
 * with expandable nodes showing detailed progress.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { 
  NeuralPathwayProps, 
  PathwayNode, 
  PathwayConnection,
  NodeStatus 
} from './types';
import { PathwayNode as PathwayNodeComponent } from './PathwayNode';
import { PathwayConnection as PathwayConnectionComponent } from './PathwayConnection';
import { NodeDetailsPanel } from './NodeDetailsPanel';
import { useNeuralPathwayEvents } from '@/hooks/useNeuralPathwayEvents';

// Default node layout for the orchestration pipeline
const DEFAULT_NODES: Omit<PathwayNode, 'status'>[] = [
  // Center - User Prompt
  { id: 'prompt', type: 'prompt', label: 'Your Prompt', position: { x: 50, y: 50 }, size: 'large', icon: 'sparkles' },
  
  // Phase 0 - Intent Lock (top)
  { id: 'intent-lock', type: 'intent-lock', label: 'Intent Lock', shortLabel: 'Intent', position: { x: 50, y: 15 }, parentId: 'prompt', icon: 'lock', expandable: true },
  
  // Phase 1 - Feature Decomposition (top-right)
  { id: 'feature-decomp', type: 'feature-decomp', label: 'Feature Analysis', shortLabel: 'Features', position: { x: 80, y: 25 }, parentId: 'intent-lock', icon: 'layers', expandable: true },
  
  // Phase 2 - Parallel Agents (right side, multiple)
  { id: 'agent-1', type: 'agent-slot', label: 'Agent Slot 1', shortLabel: 'A1', position: { x: 90, y: 40 }, parentId: 'feature-decomp', size: 'small', icon: 'cpu' },
  { id: 'agent-2', type: 'agent-slot', label: 'Agent Slot 2', shortLabel: 'A2', position: { x: 92, y: 55 }, parentId: 'feature-decomp', size: 'small', icon: 'cpu' },
  { id: 'agent-3', type: 'agent-slot', label: 'Agent Slot 3', shortLabel: 'A3', position: { x: 90, y: 70 }, parentId: 'feature-decomp', size: 'small', icon: 'cpu' },
  
  // Code Generation (bottom-right)
  { id: 'code-gen', type: 'code-gen', label: 'Code Generation', shortLabel: 'Code', position: { x: 75, y: 80 }, parentId: 'agent-1', icon: 'code', expandable: true },
  
  // Verification (bottom)
  { id: 'verification', type: 'verification', label: 'Verification Swarm', shortLabel: 'Verify', position: { x: 50, y: 90 }, parentId: 'code-gen', icon: 'shield', expandable: true },
  
  // Build (bottom-left)
  { id: 'build', type: 'build', label: 'Build & Compile', shortLabel: 'Build', position: { x: 25, y: 80 }, parentId: 'verification', icon: 'hammer' },
  
  // Deploy (left)
  { id: 'deploy', type: 'deploy', label: 'Deploy', shortLabel: 'Deploy', position: { x: 10, y: 55 }, parentId: 'build', icon: 'rocket' },
  
  // Complete (top-left, connecting back)
  { id: 'complete', type: 'complete', label: 'Complete', shortLabel: '✓', position: { x: 20, y: 25 }, parentId: 'deploy', size: 'medium', icon: 'check' },
];

// Status-based colors
const STATUS_COLORS: Record<NodeStatus, { bg: string; border: string; glow: string }> = {
  idle: { bg: 'bg-gray-800/50', border: 'border-gray-700', glow: '' },
  pending: { bg: 'bg-yellow-900/30', border: 'border-yellow-600/50', glow: 'shadow-yellow-500/20' },
  active: { bg: 'bg-blue-900/40', border: 'border-blue-500', glow: 'shadow-blue-500/40 shadow-lg' },
  streaming: { bg: 'bg-purple-900/40', border: 'border-purple-500', glow: 'shadow-purple-500/50 shadow-lg' },
  complete: { bg: 'bg-emerald-900/30', border: 'border-emerald-500', glow: 'shadow-emerald-500/20' },
  error: { bg: 'bg-red-900/40', border: 'border-red-500', glow: 'shadow-red-500/40' },
  skipped: { bg: 'bg-gray-800/30', border: 'border-gray-600', glow: '' },
};

export function NeuralPathway({
  sessionId,
  promptText,
  className,
  compact = false,
  showLabels = true,
  onNodeClick,
  onComplete,
}: NeuralPathwayProps) {
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  
  // Connect to real-time events
  const { state, isConnected } = useNeuralPathwayEvents(sessionId);
  
  // Merge default layout with real-time state
  const nodes = useMemo((): PathwayNode[] => {
    if (!state?.nodes) {
      // Initial state - all idle except prompt
      return DEFAULT_NODES.map(n => ({
        ...n,
        status: n.id === 'prompt' ? 'active' : 'idle' as NodeStatus,
        summary: n.id === 'prompt' ? promptText : undefined,
      }));
    }
    
    // Merge with state updates
    return DEFAULT_NODES.map(defaultNode => {
      const stateNode = state.nodes.find(n => n.id === defaultNode.id);
      return {
        ...defaultNode,
        ...stateNode,
        status: stateNode?.status || 'idle' as NodeStatus,
      };
    });
  }, [state?.nodes, promptText]);
  
  // Generate connections between nodes
  const connections = useMemo((): PathwayConnection[] => {
    const conns: PathwayConnection[] = [];
    
    nodes.forEach(node => {
      if (node.parentId) {
        const parentNode = nodes.find(n => n.id === node.parentId);
        if (parentNode) {
          const isActive = node.status === 'active' || node.status === 'streaming';
          const isComplete = node.status === 'complete' || parentNode.status === 'complete';
          
          conns.push({
            id: `${node.parentId}-${node.id}`,
            fromId: node.parentId,
            toId: node.id,
            status: isActive ? 'pulsing' : isComplete ? 'complete' : 'inactive',
            animated: isActive,
            dataFlow: node.status === 'streaming',
          });
        }
      }
    });
    
    return conns;
  }, [nodes]);
  
  // Handle node click
  const handleNodeClick = useCallback((node: PathwayNode) => {
    if (node.expandable) {
      setExpandedNodeId(prev => prev === node.id ? null : node.id);
    }
    onNodeClick?.(node);
  }, [onNodeClick]);
  
  // Check for completion
  useEffect(() => {
    if (state?.status === 'complete') {
      onComplete?.();
    }
  }, [state?.status, onComplete]);
  
  const containerSize = compact ? 'h-48' : 'h-80';
  
  return (
    <div className={cn('relative w-full', containerSize, className)}>
      {/* Background gradient */}
      <div className="absolute inset-0 rounded-xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/95 via-gray-900/90 to-gray-900/95" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-purple-500/5" />
        
        {/* Animated grid pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-10">
          <defs>
            <pattern id="neural-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-blue-400" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#neural-grid)" />
        </svg>
      </div>
      
      {/* Main visualization area */}
      <div className="relative w-full h-full p-4">
        {/* SVG for connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            {/* Gradient for active connections */}
            <linearGradient id="connection-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.3" />
              <stop offset="50%" stopColor="rgb(147, 51, 234)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0.3" />
            </linearGradient>
            
            {/* Glow filter */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          {/* Render connections */}
          {connections.map(conn => (
            <PathwayConnectionComponent
              key={conn.id}
              connection={conn}
              fromNode={nodes.find(n => n.id === conn.fromId)!}
              toNode={nodes.find(n => n.id === conn.toId)!}
            />
          ))}
        </svg>
        
        {/* Render nodes */}
        <AnimatePresence>
          {nodes.map(node => (
            <PathwayNodeComponent
              key={node.id}
              node={node}
              compact={compact}
              showLabel={showLabels && !compact}
              isHovered={hoveredNodeId === node.id}
              isExpanded={expandedNodeId === node.id}
              onClick={() => handleNodeClick(node)}
              onHover={(hovered) => setHoveredNodeId(hovered ? node.id : null)}
              statusColors={STATUS_COLORS[node.status]}
            />
          ))}
        </AnimatePresence>
        
        {/* Progress indicator */}
        {state && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-2 left-4 right-4"
          >
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="font-medium text-gray-300">{state.currentPhase}</span>
              <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${state.progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <span>{state.progress}%</span>
            </div>
          </motion.div>
        )}
        
        {/* Connection status indicator */}
        <div className="absolute top-2 right-2">
          <div className={cn(
            'w-2 h-2 rounded-full',
            isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'
          )} />
        </div>
      </div>
      
      {/* Expanded node details panel */}
      <AnimatePresence>
        {expandedNodeId && (
          <NodeDetailsPanel
            node={nodes.find(n => n.id === expandedNodeId)!}
            onClose={() => setExpandedNodeId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default NeuralPathway;
