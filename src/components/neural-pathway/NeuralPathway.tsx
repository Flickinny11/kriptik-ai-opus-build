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
  { id: 'complete', type: 'complete', label: 'Complete', shortLabel: 'Done', position: { x: 20, y: 25 }, parentId: 'deploy', size: 'medium', icon: 'check' },
];

// Status-based colors - KripTik amber/copper theme
const STATUS_COLORS: Record<NodeStatus, { bg: string; border: string; glow: string }> = {
  idle: { bg: 'bg-stone-100/60', border: 'border-stone-300/50', glow: '' },
  pending: { bg: 'bg-amber-50/70', border: 'border-amber-400/50', glow: 'shadow-amber-400/20' },
  active: { bg: 'bg-amber-100/80', border: 'border-amber-500', glow: 'shadow-amber-500/40 shadow-lg' },
  streaming: { bg: 'bg-orange-100/80', border: 'border-orange-500', glow: 'shadow-orange-500/50 shadow-lg' },
  complete: { bg: 'bg-emerald-50/70', border: 'border-emerald-500', glow: 'shadow-emerald-500/20' },
  error: { bg: 'bg-red-50/70', border: 'border-red-500', glow: 'shadow-red-500/40' },
  skipped: { bg: 'bg-stone-100/40', border: 'border-stone-300/30', glow: '' },
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
      {/* Liquid Glass Background - matches KripTik dashboard aesthetic */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden">
        {/* Base glass layer */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(250,245,240,0.9) 50%, rgba(255,255,255,0.85) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        />
        {/* Warm amber glow gradient */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 30% 20%, rgba(251,191,36,0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(245,158,11,0.06) 0%, transparent 50%)',
          }}
        />
        {/* Subtle inner shadow for depth */}
        <div 
          className="absolute inset-0 rounded-2xl"
          style={{
            boxShadow: 'inset 0 2px 20px rgba(0,0,0,0.03), inset 0 -2px 10px rgba(255,255,255,0.8)',
          }}
        />

        {/* Animated neural grid pattern - warm copper tones */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.07]">
          <defs>
            <pattern id="neural-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#c2410c" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#neural-grid)" />
        </svg>
        
        {/* Outer glass border */}
        <div 
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            border: '1px solid rgba(255,255,255,0.6)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.06), 0 0 0 1px rgba(251,191,36,0.1)',
          }}
        />
      </div>

      {/* Main visualization area */}
      <div className="relative w-full h-full p-4">
        {/* SVG for connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            {/* Gradient for active connections - amber/copper theme */}
            <linearGradient id="connection-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgb(251, 191, 36)" stopOpacity="0.4" />
              <stop offset="50%" stopColor="rgb(245, 158, 11)" stopOpacity="0.7" />
              <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0.4" />
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

        {/* Progress indicator - glass pill style */}
        {state && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-3 left-4 right-4"
          >
            <div 
              className="flex items-center gap-3 text-xs px-3 py-2 rounded-full"
              style={{
                background: 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)',
                border: '1px solid rgba(255,255,255,0.5)',
              }}
            >
              <span className="font-semibold" style={{ color: '#92400e', fontFamily: 'Syne, sans-serif' }}>{state.currentPhase}</span>
              <div className="flex-1 h-1.5 bg-stone-200/60 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 50%, #10b981 100%)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${state.progress}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
              <span className="font-medium" style={{ color: '#78716c' }}>{state.progress}%</span>
            </div>
          </motion.div>
        )}

        {/* Connection status indicator - warm glow style */}
        <div className="absolute top-3 right-3">
          <div 
            className={cn(
              'w-2.5 h-2.5 rounded-full transition-colors duration-300',
              isConnected ? 'bg-emerald-500' : 'bg-stone-400'
            )}
            style={{
              boxShadow: isConnected ? '0 0 8px rgba(16,185,129,0.5)' : 'none',
            }}
          />
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
