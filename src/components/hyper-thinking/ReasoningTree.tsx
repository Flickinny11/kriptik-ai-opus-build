/**
 * ReasoningTree - Visualize Tree-of-Thought reasoning
 *
 * Interactive tree visualization showing:
 * - Expandable/collapsible nodes
 * - Score indicators per branch
 * - Best path highlighting
 * - Pruned branch indicators
 *
 * Uses liquid glass styling consistent with KripTik dashboard.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronDown,
  Sparkles,
  Ban,
  Star,
  GitBranch,
  Target,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface ThoughtNode {
  id: string;
  thought: string;
  score: number;
  depth: number;
  children: ThoughtNode[];
  isPruned?: boolean;
  isBestPath?: boolean;
  metadata?: {
    tokensUsed?: number;
    strategy?: string;
    reasoning?: string;
  };
}

export interface ReasoningTreeProps {
  tree: ThoughtNode;
  bestPathIds?: string[];
  onNodeClick?: (node: ThoughtNode) => void;
  className?: string;
  maxVisibleDepth?: number;
}

// ============================================================================
// Score Display
// ============================================================================

function ScoreBadge({ score, isBestPath }: { score: number; isBestPath?: boolean }) {
  const getScoreColor = (s: number) => {
    if (s >= 0.8) return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
    if (s >= 0.6) return 'text-lime-400 bg-lime-500/20 border-lime-500/30';
    if (s >= 0.4) return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
    return 'text-red-400 bg-red-500/20 border-red-500/30';
  };

  return (
    <span className={`
      inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono
      border ${getScoreColor(score)}
      ${isBestPath ? 'ring-1 ring-lime-400/50' : ''}
    `}>
      {isBestPath && <Star className="w-2.5 h-2.5" />}
      {Math.round(score * 100)}%
    </span>
  );
}

// ============================================================================
// Tree Node Component
// ============================================================================

interface TreeNodeProps {
  node: ThoughtNode;
  bestPathIds: Set<string>;
  onNodeClick?: (node: ThoughtNode) => void;
  depth: number;
  maxVisibleDepth: number;
  isLast?: boolean;
}

function TreeNode({
  node,
  bestPathIds,
  onNodeClick,
  depth,
  maxVisibleDepth,
  isLast: _isLast = false, // Prefixed with underscore to indicate intentionally unused
}: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(
    depth < maxVisibleDepth || bestPathIds.has(node.id)
  );

  // Note: isLast prop available as _isLast for future use (e.g., special styling for last node)
  void _isLast;

  const hasChildren = node.children && node.children.length > 0;
  const isBestPath = bestPathIds.has(node.id);
  const isPruned = node.isPruned;

  const toggleExpanded = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(prev => !prev);
  }, []);

  const handleClick = useCallback(() => {
    onNodeClick?.(node);
  }, [node, onNodeClick]);

  return (
    <div className={`relative ${depth > 0 ? 'ml-4' : ''}`}>
      {/* Connection line */}
      {depth > 0 && (
        <div
          className={`
            absolute left-[-16px] top-0 w-[16px] h-[20px]
            border-l-2 border-b-2 rounded-bl-lg
            ${isBestPath
              ? 'border-lime-500/50'
              : isPruned
                ? 'border-red-500/20'
                : 'border-white/10'
            }
          `}
        />
      )}

      {/* Node content */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: depth * 0.05 }}
        className={`
          group relative flex items-start gap-2 p-2.5 rounded-lg cursor-pointer
          transition-all duration-200
          ${isBestPath
            ? 'bg-lime-500/10 border border-lime-500/30 hover:bg-lime-500/15'
            : isPruned
              ? 'bg-red-500/5 border border-red-500/20 opacity-60 hover:opacity-80'
              : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
          }
        `}
        onClick={handleClick}
      >
        {/* Expand/collapse button */}
        {hasChildren && (
          <button
            onClick={toggleExpanded}
            className={`
              flex-shrink-0 w-5 h-5 flex items-center justify-center rounded
              transition-colors
              ${isBestPath ? 'text-lime-400 hover:bg-lime-500/20' : 'text-white/40 hover:bg-white/10'}
            `}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Icon for leaf nodes */}
        {!hasChildren && (
          <div className={`
            flex-shrink-0 w-5 h-5 flex items-center justify-center
            ${isPruned ? 'text-red-400' : isBestPath ? 'text-lime-400' : 'text-white/30'}
          `}>
            {isPruned ? (
              <Ban className="w-3.5 h-3.5" />
            ) : isBestPath ? (
              <Target className="w-3.5 h-3.5" />
            ) : (
              <GitBranch className="w-3 h-3" />
            )}
          </div>
        )}

        {/* Thought content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`
              text-xs leading-relaxed
              ${isPruned ? 'text-white/40 line-through' : 'text-white/80'}
            `}>
              {node.thought}
            </p>
            <ScoreBadge score={node.score} isBestPath={isBestPath} />
          </div>

          {/* Metadata on hover */}
          {node.metadata && (
            <div className="mt-1.5 hidden group-hover:flex items-center gap-2 text-[10px] text-white/40">
              {node.metadata.tokensUsed && (
                <span>{node.metadata.tokensUsed} tokens</span>
              )}
              {node.metadata.strategy && (
                <span>• {node.metadata.strategy}</span>
              )}
            </div>
          )}
        </div>

        {/* Best path indicator */}
        {isBestPath && !isPruned && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -right-1 -top-1"
          >
            <Sparkles className="w-3 h-3 text-lime-400" />
          </motion.div>
        )}
      </motion.div>

      {/* Children */}
      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-1.5 space-y-1.5"
          >
            {node.children.map((child, index) => (
              <TreeNode
                key={child.id}
                node={child}
                bestPathIds={bestPathIds}
                onNodeClick={onNodeClick}
                depth={depth + 1}
                maxVisibleDepth={maxVisibleDepth}
                isLast={index === node.children.length - 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ReasoningTree({
  tree,
  bestPathIds = [],
  onNodeClick,
  className = '',
  maxVisibleDepth = 3,
}: ReasoningTreeProps) {
  const bestPathSet = new Set(bestPathIds);

  // Calculate tree stats
  const countNodes = (node: ThoughtNode): number => {
    return 1 + (node.children?.reduce((sum, child) => sum + countNodes(child), 0) || 0);
  };

  const countPruned = (node: ThoughtNode): number => {
    const selfPruned = node.isPruned ? 1 : 0;
    return selfPruned + (node.children?.reduce((sum, child) => sum + countPruned(child), 0) || 0);
  };

  const totalNodes = countNodes(tree);
  const prunedNodes = countPruned(tree);
  const exploredNodes = totalNodes - prunedNodes;

  return (
    <div
      className={`relative ${className}`}
      style={{
        background: 'linear-gradient(145deg, rgba(20,20,25,0.98) 0%, rgba(12,12,16,0.99) 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(40px)',
      }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌳</span>
            <h3 className="text-sm font-medium text-white">Reasoning Tree</h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/50">
            <span className="flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5" />
              {exploredNodes} explored
            </span>
            <span className="flex items-center gap-1 text-red-400/60">
              <Ban className="w-3.5 h-3.5" />
              {prunedNodes} pruned
            </span>
          </div>
        </div>
      </div>

      {/* Tree content */}
      <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
        <TreeNode
          node={tree}
          bestPathIds={bestPathSet}
          onNodeClick={onNodeClick}
          depth={0}
          maxVisibleDepth={maxVisibleDepth}
        />
      </div>

      {/* Legend */}
      <div className="px-5 py-3 border-t border-white/5 flex items-center gap-4 text-[10px] text-white/40">
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-lime-500" />
          Best path
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-white/30" />
          Explored
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500/50" />
          Pruned
        </span>
      </div>
    </div>
  );
}

export default ReasoningTree;
