/**
 * DOM Reorder Panel Component
 *
 * Tree-based UI for visualizing and reordering DOM elements.
 * Provides an alternative to direct drag-and-drop manipulation.
 *
 * Features:
 * - Hierarchical DOM tree view
 * - Drag-and-drop within tree
 * - Move up/down/in/out buttons
 * - Undo/redo controls
 * - Search and filter
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVisualEditorStore, type SelectedElement } from '../../../../store/useVisualEditorStore';
import { dragDropManager } from '../services/drag-drop-manager';

// =============================================================================
// Types
// =============================================================================

export interface DOMReorderPanelProps {
  className?: string;
}

interface TreeNode {
  id: string;
  element: SelectedElement;
  children: TreeNode[];
  depth: number;
  isExpanded: boolean;
  parentId: string | null;
}

// =============================================================================
// Icons
// =============================================================================

const ChevronIcon: React.FC<{ expanded: boolean; className?: string }> = ({
  expanded,
  className = '',
}) => (
  <svg
    className={`w-3 h-3 transition-transform duration-150 ${expanded ? 'rotate-90' : ''} ${className}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const MoveUpIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const MoveDownIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const MoveOutIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14V5" />
  </svg>
);

const MoveInIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5v14" />
  </svg>
);

const UndoIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
  </svg>
);

const RedoIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
  </svg>
);

const DragIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={`w-3 h-3 ${className}`} fill="currentColor" viewBox="0 0 14 14">
    <circle cx="4" cy="3" r="1.5" />
    <circle cx="10" cy="3" r="1.5" />
    <circle cx="4" cy="7" r="1.5" />
    <circle cx="10" cy="7" r="1.5" />
    <circle cx="4" cy="11" r="1.5" />
    <circle cx="10" cy="11" r="1.5" />
  </svg>
);

// =============================================================================
// Tree Node Component
// =============================================================================

interface TreeNodeItemProps {
  node: TreeNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onMoveOut: (id: string) => void;
  onMoveIn: (id: string) => void;
  onDragStart: (element: SelectedElement) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canMoveOut: boolean;
  canMoveIn: boolean;
  searchQuery: string;
}

const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  isSelected,
  onSelect,
  onToggle,
  onMoveUp,
  onMoveDown,
  onMoveOut,
  onMoveIn,
  onDragStart,
  canMoveUp,
  canMoveDown,
  canMoveOut,
  canMoveIn,
  searchQuery,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const hasChildren = node.children.length > 0;
  const { element } = node;

  // Highlight matching text
  const highlightMatch = (text: string) => {
    if (!searchQuery) return text;

    const regex = new RegExp(`(${searchQuery})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="bg-yellow-500/30 text-yellow-300">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  // Handle drag start
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDragStart(element);
    },
    [element, onDragStart]
  );

  return (
    <div
      className={`
        group flex items-center gap-1 py-1 px-2 rounded
        transition-colors duration-150 cursor-pointer
        ${isSelected ? 'bg-yellow-500/20' : isHovered ? 'bg-neutral-800/50' : ''}
      `}
      style={{ paddingLeft: 8 + node.depth * 16 }}
      onClick={() => onSelect(node.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Drag handle */}
      <button
        className="p-0.5 text-neutral-600 hover:text-yellow-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        onMouseDown={handleDragStart}
        title="Drag to reorder"
      >
        <DragIcon />
      </button>

      {/* Expand/collapse toggle */}
      {hasChildren ? (
        <button
          className="p-0.5 text-neutral-500 hover:text-neutral-300"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node.id);
          }}
        >
          <ChevronIcon expanded={node.isExpanded} />
        </button>
      ) : (
        <span className="w-4" />
      )}

      {/* Element tag/name */}
      <span
        className={`
          text-xs font-mono truncate flex-1
          ${isSelected ? 'text-yellow-400' : 'text-neutral-300'}
        `}
      >
        {highlightMatch(element.componentName || `<${element.tagName}>`)}
      </span>

      {/* Class indicator */}
      {element.className && (
        <span className="text-[10px] text-neutral-600 truncate max-w-[80px]">
          .{element.className.split(' ')[0]}
        </span>
      )}

      {/* Move controls (visible on hover or selection) */}
      <div
        className={`
          flex items-center gap-0.5
          ${isSelected || isHovered ? 'opacity-100' : 'opacity-0'}
          transition-opacity
        `}
      >
        <button
          className="p-0.5 text-neutral-600 hover:text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp(node.id);
          }}
          disabled={!canMoveUp}
          title="Move up"
        >
          <MoveUpIcon className="w-3 h-3" />
        </button>
        <button
          className="p-0.5 text-neutral-600 hover:text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown(node.id);
          }}
          disabled={!canMoveDown}
          title="Move down"
        >
          <MoveDownIcon className="w-3 h-3" />
        </button>
        <button
          className="p-0.5 text-neutral-600 hover:text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={(e) => {
            e.stopPropagation();
            onMoveOut(node.id);
          }}
          disabled={!canMoveOut}
          title="Move out (unindent)"
        >
          <MoveOutIcon className="w-3 h-3" />
        </button>
        <button
          className="p-0.5 text-neutral-600 hover:text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={(e) => {
            e.stopPropagation();
            onMoveIn(node.id);
          }}
          disabled={!canMoveIn}
          title="Move in (indent)"
        >
          <MoveInIcon className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// DOM Reorder Panel Component
// =============================================================================

export const DOMReorderPanel: React.FC<DOMReorderPanelProps> = ({ className = '' }) => {
  const {
    selectedElements,
    selectionMode,
    setSelectionMode,
    selectElement,
    startDrag,
    isDragging,
  } = useVisualEditorStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Mock tree data - in production this would come from the actual DOM structure
  // For now, we'll create a flat list from selected elements
  const treeData = useMemo((): TreeNode[] => {
    // Build tree from selected elements and their relationships
    const nodes: TreeNode[] = [];
    const nodeMap = new Map<string, TreeNode>();

    // First pass: create all nodes
    for (const element of selectedElements) {
      const node: TreeNode = {
        id: element.id,
        element,
        children: [],
        depth: 0,
        isExpanded: expandedNodes.has(element.id),
        parentId: element.parentElement || null,
      };
      nodes.push(node);
      nodeMap.set(element.id, node);
    }

    // Second pass: build hierarchy (if parent info is available)
    for (const node of nodes) {
      if (node.parentId && nodeMap.has(node.parentId)) {
        const parent = nodeMap.get(node.parentId)!;
        parent.children.push(node);
        node.depth = parent.depth + 1;
      }
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return nodes.filter(
        (node) =>
          node.element.tagName.toLowerCase().includes(query) ||
          node.element.componentName?.toLowerCase().includes(query) ||
          node.element.className?.toLowerCase().includes(query)
      );
    }

    return nodes;
  }, [selectedElements, expandedNodes, searchQuery]);

  // Update undo/redo state
  useEffect(() => {
    setCanUndo(dragDropManager.canUndo());
    setCanRedo(dragDropManager.canRedo());
  }, [selectedElements]);

  // Handle node selection
  const handleSelect = useCallback(
    (id: string) => {
      setSelectedNodeId(id);
      const node = treeData.find((n) => n.id === id);
      if (node) {
        selectElement(node.element, false);
      }
    },
    [treeData, selectElement]
  );

  // Handle node toggle
  const handleToggle = useCallback((id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Move operations
  const handleMoveUp = useCallback((id: string) => {
    // TODO: Implement move up via dragDropManager
    console.log('[DOMReorderPanel] Move up:', id);
  }, []);

  const handleMoveDown = useCallback((id: string) => {
    // TODO: Implement move down via dragDropManager
    console.log('[DOMReorderPanel] Move down:', id);
  }, []);

  const handleMoveOut = useCallback((id: string) => {
    // TODO: Implement move out via dragDropManager
    console.log('[DOMReorderPanel] Move out:', id);
  }, []);

  const handleMoveIn = useCallback((id: string) => {
    // TODO: Implement move in via dragDropManager
    console.log('[DOMReorderPanel] Move in:', id);
  }, []);

  // Handle drag start from tree
  const handleDragStart = useCallback(
    (element: SelectedElement) => {
      setSelectionMode('drag');
      startDrag(element);
    },
    [setSelectionMode, startDrag]
  );

  // Undo/redo handlers
  const handleUndo = useCallback(async () => {
    await dragDropManager.undo();
    setCanUndo(dragDropManager.canUndo());
    setCanRedo(dragDropManager.canRedo());
  }, []);

  const handleRedo = useCallback(async () => {
    await dragDropManager.redo();
    setCanUndo(dragDropManager.canUndo());
    setCanRedo(dragDropManager.canRedo());
  }, []);

  // Toggle drag mode
  const toggleDragMode = useCallback(() => {
    setSelectionMode(selectionMode === 'drag' ? 'single' : 'drag');
  }, [selectionMode, setSelectionMode]);

  // Check move capabilities
  const getNodeIndex = useCallback(
    (id: string) => {
      return treeData.findIndex((n) => n.id === id);
    },
    [treeData]
  );

  return (
    <div className={`vpp-section ${className}`}>
      {/* Header */}
      <div className="vpp-section-header">
        <h3 className="vpp-section-title">DOM Structure</h3>
        <div className="flex items-center gap-1">
          {/* Undo/Redo buttons */}
          <button
            className="p-1 rounded text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo (Cmd+Z)"
          >
            <UndoIcon />
          </button>
          <button
            className="p-1 rounded text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo (Cmd+Shift+Z)"
          >
            <RedoIcon />
          </button>

          {/* Drag mode toggle */}
          <button
            className={`
              ml-2 px-2 py-1 rounded text-xs font-medium transition-colors
              ${selectionMode === 'drag'
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-neutral-800/50 text-neutral-400 hover:text-neutral-300'
              }
            `}
            onClick={toggleDragMode}
            title={selectionMode === 'drag' ? 'Exit drag mode' : 'Enter drag mode'}
          >
            {selectionMode === 'drag' ? 'Dragging' : 'Drag Mode'}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-white/5">
        <input
          type="text"
          placeholder="Search elements..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-2 py-1 text-xs bg-neutral-800/50 border border-neutral-700 rounded text-neutral-300 placeholder:text-neutral-600 focus:outline-none focus:border-yellow-500/50"
        />
      </div>

      {/* Tree content */}
      <div className="vpp-section-content max-h-[400px] overflow-y-auto">
        {treeData.length === 0 ? (
          <div className="py-8 text-center text-sm text-neutral-500">
            {searchQuery
              ? 'No elements match your search'
              : 'Select elements in the preview to see their structure'}
          </div>
        ) : (
          <div className="py-1">
            <AnimatePresence mode="popLayout">
              {treeData.map((node) => {
                const index = getNodeIndex(node.id);
                return (
                  <motion.div
                    key={node.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <TreeNodeItem
                      node={node}
                      isSelected={selectedNodeId === node.id}
                      onSelect={handleSelect}
                      onToggle={handleToggle}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                      onMoveOut={handleMoveOut}
                      onMoveIn={handleMoveIn}
                      onDragStart={handleDragStart}
                      canMoveUp={index > 0}
                      canMoveDown={index < treeData.length - 1}
                      canMoveOut={node.depth > 0}
                      canMoveIn={index > 0}
                      searchQuery={searchQuery}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Drag mode instructions */}
      <AnimatePresence>
        {selectionMode === 'drag' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 py-2 border-t border-white/5 text-xs text-neutral-500"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              <span>Drag elements in the preview or tree to reorder</span>
            </div>
            <div className="mt-1 text-neutral-600">
              Press <kbd className="px-1 py-0.5 bg-neutral-800 rounded text-[10px]">Esc</kbd> to
              cancel
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dragging indicator */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-yellow-500/5 border-2 border-yellow-500/20 rounded pointer-events-none"
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default DOMReorderPanel;
