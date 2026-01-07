/**
 * Selection Overlay Component
 *
 * Visual overlay for selected elements in the preview.
 * Shows selection bounds, resize handles, and multi-select indicators.
 *
 * Features:
 * - Element highlight overlay
 * - Selection bounds with resize handles
 * - Multi-select support with grouped bounds
 * - Hover preview
 * - Keyboard navigation support
 * - Click-through to preview for selection
 */

import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVisualEditorStore, type SelectedElement } from '../../../../store/useVisualEditorStore';

// =============================================================================
// TYPES
// =============================================================================

export interface SelectionOverlayProps {
  className?: string;
  previewContainerRef?: React.RefObject<HTMLElement>;
}

interface ElementBounds {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  element: SelectedElement;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getElementBounds = (element: SelectedElement): ElementBounds | null => {
  // In production, this would use postMessage to get bounds from iframe
  // For now, return mock bounds based on element position
  return {
    id: element.id,
    left: 0,
    top: 0,
    width: 200,
    height: 100,
    element,
  };
};

const getGroupedBounds = (bounds: ElementBounds[]): { left: number; top: number; width: number; height: number } => {
  if (bounds.length === 0) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }

  const minLeft = Math.min(...bounds.map(b => b.left));
  const minTop = Math.min(...bounds.map(b => b.top));
  const maxRight = Math.max(...bounds.map(b => b.left + b.width));
  const maxBottom = Math.max(...bounds.map(b => b.top + b.height));

  return {
    left: minLeft,
    top: minTop,
    width: maxRight - minLeft,
    height: maxBottom - minTop,
  };
};

// =============================================================================
// RESIZE HANDLE COMPONENT
// =============================================================================

interface ResizeHandleProps {
  position: 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se';
  onResize?: (direction: string, delta: { x: number; y: number }) => void;
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({ position }) => {
  const positionStyles: Record<string, React.CSSProperties> = {
    nw: { top: -4, left: -4, cursor: 'nwse-resize' },
    n: { top: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
    ne: { top: -4, right: -4, cursor: 'nesw-resize' },
    w: { top: '50%', left: -4, transform: 'translateY(-50%)', cursor: 'ew-resize' },
    e: { top: '50%', right: -4, transform: 'translateY(-50%)', cursor: 'ew-resize' },
    sw: { bottom: -4, left: -4, cursor: 'nesw-resize' },
    s: { bottom: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
    se: { bottom: -4, right: -4, cursor: 'nwse-resize' },
  };

  return (
    <div
      className="absolute w-2 h-2 bg-yellow-400 border border-yellow-600 rounded-sm hover:bg-yellow-300 transition-colors"
      style={positionStyles[position]}
    />
  );
};

// =============================================================================
// ELEMENT SELECTION BOX
// =============================================================================

interface ElementSelectionBoxProps {
  bounds: ElementBounds;
  isPrimary: boolean;
  isMultiSelect: boolean;
  onSelect?: () => void;
}

const ElementSelectionBox: React.FC<ElementSelectionBoxProps> = ({
  bounds,
  isPrimary,
  isMultiSelect,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className={`absolute pointer-events-none ${
        isPrimary ? 'z-20' : 'z-10'
      }`}
      style={{
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      }}
    >
      {/* Selection border */}
      <div
        className={`absolute inset-0 border-2 ${
          isPrimary
            ? 'border-yellow-400 bg-yellow-400/5'
            : isMultiSelect
            ? 'border-yellow-400/60 bg-yellow-400/5'
            : 'border-blue-400/50 bg-blue-400/5'
        }`}
        style={{
          boxShadow: isPrimary ? '0 0 0 1px rgba(0,0,0,0.1), 0 0 10px rgba(234, 179, 8, 0.2)' : undefined,
        }}
      />

      {/* Element label */}
      <div
        className={`absolute -top-6 left-0 px-2 py-0.5 text-xs rounded ${
          isPrimary
            ? 'bg-yellow-500 text-black font-medium'
            : 'bg-neutral-700 text-neutral-200'
        }`}
        style={{ fontSize: '10px' }}
      >
        {bounds.element.componentName || bounds.element.tagName}
      </div>

      {/* Resize handles (only for primary selection) */}
      {isPrimary && (
        <>
          <ResizeHandle position="nw" />
          <ResizeHandle position="n" />
          <ResizeHandle position="ne" />
          <ResizeHandle position="w" />
          <ResizeHandle position="e" />
          <ResizeHandle position="sw" />
          <ResizeHandle position="s" />
          <ResizeHandle position="se" />
        </>
      )}

      {/* Size indicator (only for primary) */}
      {isPrimary && (
        <div
          className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-neutral-800 text-neutral-300 text-xs rounded whitespace-nowrap"
          style={{ fontSize: '10px' }}
        >
          {bounds.width} × {bounds.height}
        </div>
      )}
    </motion.div>
  );
};

// =============================================================================
// HOVER HIGHLIGHT
// =============================================================================

interface HoverHighlightProps {
  bounds: ElementBounds;
}

const HoverHighlight: React.FC<HoverHighlightProps> = ({ bounds }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      className="absolute pointer-events-none z-5"
      style={{
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      }}
    >
      <div className="absolute inset-0 border border-dashed border-blue-400/50 bg-blue-400/5" />
      <div
        className="absolute -top-5 left-0 px-1.5 py-0.5 bg-blue-500/80 text-white text-xs rounded"
        style={{ fontSize: '10px' }}
      >
        {bounds.element.componentName || bounds.element.tagName}
      </div>
    </motion.div>
  );
};

// =============================================================================
// MULTI-SELECT GROUP BOX
// =============================================================================

interface MultiSelectGroupBoxProps {
  bounds: { left: number; top: number; width: number; height: number };
  count: number;
}

const MultiSelectGroupBox: React.FC<MultiSelectGroupBoxProps> = ({ bounds, count }) => {
  if (bounds.width === 0 || bounds.height === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute pointer-events-none z-30"
      style={{
        left: bounds.left - 8,
        top: bounds.top - 8,
        width: bounds.width + 16,
        height: bounds.height + 16,
      }}
    >
      <div className="absolute inset-0 border-2 border-dashed border-yellow-400/40 rounded-lg" />
      <div className="absolute -top-6 right-0 px-2 py-0.5 bg-yellow-500 text-black text-xs rounded font-medium">
        {count} selected
      </div>
    </motion.div>
  );
};

// =============================================================================
// SELECTION OVERLAY COMPONENT
// =============================================================================

export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
  className = '',
}) => {
  const {
    selectedElements,
    hoveredElement,
    selectionMode,
    selectElement,
    deselectElement,
    clearSelection,
    setHoveredElement,
  } = useVisualEditorStore();

  const overlayRef = useRef<HTMLDivElement>(null);

  // Calculate bounds for all selected elements
  const selectedBounds = useMemo(() => {
    return selectedElements
      .map(getElementBounds)
      .filter((b): b is ElementBounds => b !== null);
  }, [selectedElements]);

  // Calculate grouped bounds for multi-select
  const groupedBounds = useMemo(() => {
    return selectedBounds.length > 1 ? getGroupedBounds(selectedBounds) : null;
  }, [selectedBounds]);

  // Calculate hover bounds
  const hoverBounds = useMemo(() => {
    if (!hoveredElement) return null;
    // Don't show hover if element is already selected
    if (selectedElements.some(e => e.id === hoveredElement.id)) return null;
    return getElementBounds(hoveredElement);
  }, [hoveredElement, selectedElements]);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectionMode === 'off') return;

      // Escape: Clear selection
      if (e.key === 'Escape') {
        clearSelection();
        return;
      }

      // Delete/Backspace: Could trigger element deletion in future
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Prevent if in input
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        // TODO: Delete selected elements
      }

      // Arrow keys: Move selection
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        // TODO: Navigate between elements
      }

      // Tab: Cycle through elements
      if (e.key === 'Tab' && selectedElements.length > 0) {
        // TODO: Cycle selection
        e.preventDefault();
      }

      // Cmd/Ctrl + A: Select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        // TODO: Select all visible elements
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectionMode, clearSelection, selectedElements.length]);

  // Handle click outside to deselect
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      // Clicked on overlay background, clear selection
      clearSelection();
    }
  }, [clearSelection]);

  // Handle element click for selection
  const handleElementClick = useCallback((element: SelectedElement, e: React.MouseEvent) => {
    e.stopPropagation();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;

    if (additive && selectedElements.some(el => el.id === element.id)) {
      // If already selected and additive click, deselect
      deselectElement(element.id);
    } else {
      // Select element (additive if shift/cmd/ctrl held)
      selectElement(element, additive);
    }
  }, [selectedElements, selectElement, deselectElement]);

  if (selectionMode === 'off') {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className={`absolute inset-0 overflow-hidden ${className}`}
      onClick={handleOverlayClick}
      style={{ pointerEvents: selectedElements.length > 0 ? 'auto' : 'none' }}
    >
      <AnimatePresence>
        {/* Hover highlight */}
        {hoverBounds && (
          <HoverHighlight key={`hover-${hoverBounds.id}`} bounds={hoverBounds} />
        )}

        {/* Selected element boxes */}
        {selectedBounds.map((bounds, index) => (
          <ElementSelectionBox
            key={bounds.id}
            bounds={bounds}
            isPrimary={index === 0}
            isMultiSelect={selectedBounds.length > 1}
          />
        ))}

        {/* Multi-select group box */}
        {groupedBounds && (
          <MultiSelectGroupBox
            key="group-box"
            bounds={groupedBounds}
            count={selectedElements.length}
          />
        )}
      </AnimatePresence>

      {/* Selection mode indicator */}
      <div className="absolute top-2 right-2 px-2 py-1 bg-neutral-800/80 text-neutral-300 text-xs rounded backdrop-blur-sm">
        {selectionMode === 'multi' ? (
          <>
            <span className="text-yellow-400">Multi-select</span> • Hold Shift to add
          </>
        ) : selectionMode === 'drag' ? (
          <>
            <span className="text-blue-400">Drag mode</span> • Drag to reorder
          </>
        ) : (
          <>
            <span className="text-green-400">Select mode</span> • Click to select
          </>
        )}
      </div>

      {/* Selection count badge */}
      {selectedElements.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-neutral-900/90 border border-neutral-700 text-neutral-200 text-sm rounded-full backdrop-blur-sm shadow-lg"
        >
          <span className="text-yellow-400 font-medium">{selectedElements.length}</span>
          {selectedElements.length === 1 ? ' element' : ' elements'} selected
          {selectedElements.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearSelection();
              }}
              className="ml-2 text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              ×
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default SelectionOverlay;
