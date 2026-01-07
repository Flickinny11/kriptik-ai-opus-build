/**
 * Draggable Element Component
 *
 * Wraps elements to provide drag-and-drop functionality.
 * Supports mouse and touch interactions with visual feedback.
 *
 * Features:
 * - Drag handle for initiating drags
 * - Visual feedback during drag
 * - Touch device support
 * - Keyboard accessibility
 * - Integration with DragDropManager
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVisualEditorStore, type SelectedElement } from '../../../../store/useVisualEditorStore';
import { dragDropManager } from '../services/drag-drop-manager';

// =============================================================================
// Types
// =============================================================================

export interface DraggableElementProps {
  element: SelectedElement;
  children: React.ReactNode;
  disabled?: boolean;
  showHandle?: boolean;
  className?: string;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

// =============================================================================
// Drag Handle Icon
// =============================================================================

const DragHandleIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    className={className}
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="4" cy="3" r="1.5" fill="currentColor" />
    <circle cx="10" cy="3" r="1.5" fill="currentColor" />
    <circle cx="4" cy="7" r="1.5" fill="currentColor" />
    <circle cx="10" cy="7" r="1.5" fill="currentColor" />
    <circle cx="4" cy="11" r="1.5" fill="currentColor" />
    <circle cx="10" cy="11" r="1.5" fill="currentColor" />
  </svg>
);

// =============================================================================
// Draggable Element Component
// =============================================================================

export const DraggableElement: React.FC<DraggableElementProps> = ({
  element,
  children,
  disabled = false,
  showHandle = true,
  className = '',
  onDragStart,
  onDragEnd,
}) => {
  const {
    selectionMode,
    dragSource,
    startDrag: storeStartDrag,
    endDrag: storeEndDrag,
  } = useVisualEditorStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [localDragging, setLocalDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);

  // Check if this element is the one being dragged
  const isBeingDragged = dragSource?.id === element.id;
  const isDragMode = selectionMode === 'drag';

  // Handle drag start
  const handleDragStart = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (disabled || !isDragMode) return;

      event.preventDefault();
      event.stopPropagation();

      // Get the native event
      const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : event;

      // Start drag in store
      storeStartDrag(element);

      // Start drag in manager
      dragDropManager.startDrag(element, nativeEvent as MouseEvent | TouchEvent);

      // Set local state
      setLocalDragging(true);
      onDragStart?.();

      // Set initial position
      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
      setDragPosition({ x: clientX, y: clientY });
    },
    [disabled, isDragMode, element, storeStartDrag, onDragStart]
  );

  // Handle keyboard drag initiation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (disabled || !isDragMode) return;

      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        // TODO: Implement keyboard-based drag mode
      }
    },
    [disabled, isDragMode]
  );

  // Set up drag manager handlers
  useEffect(() => {
    if (!localDragging) return;

    dragDropManager.setHandlers({
      onDragMove: (position) => {
        setDragPosition(position);
      },
      onDragEnd: () => {
        setLocalDragging(false);
        setDragPosition(null);
        storeEndDrag();
        onDragEnd?.();
      },
    });

    return () => {
      dragDropManager.setHandlers({});
    };
  }, [localDragging, storeEndDrag, onDragEnd]);

  // Render drag ghost
  const renderDragGhost = () => {
    if (!localDragging || !dragPosition) return null;

    return (
      <div
        className="fixed pointer-events-none z-[100000]"
        style={{
          left: dragPosition.x - 50,
          top: dragPosition.y - 20,
          transform: 'translate(0, 0)',
        }}
      >
        <div
          className="px-3 py-2 rounded-lg shadow-xl border"
          style={{
            background: 'rgba(10, 10, 15, 0.95)',
            borderColor: 'rgba(251, 191, 36, 0.3)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-yellow-500 text-xs">
              <DragHandleIcon />
            </span>
            <span className="text-xs text-neutral-300 font-medium">
              {element.componentName || element.tagName}
            </span>
          </div>
          {element.className && (
            <div className="text-xs text-neutral-500 mt-1 truncate max-w-[150px]">
              .{element.className.split(' ')[0]}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Don't render drag UI if disabled
  if (disabled) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        ref={containerRef}
        className={`relative group ${className}`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Drag handle */}
        <AnimatePresence>
          {showHandle && isDragMode && (isHovering || isBeingDragged) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute -left-8 top-0 z-10"
            >
              <button
                type="button"
                className={`
                  p-1.5 rounded cursor-grab active:cursor-grabbing
                  transition-colors duration-150
                  ${isBeingDragged
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-neutral-800/80 text-neutral-400 hover:text-yellow-400 hover:bg-neutral-700/80'
                  }
                `}
                style={{
                  backdropFilter: 'blur(8px)',
                }}
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
                onKeyDown={handleKeyDown}
                tabIndex={0}
                aria-label={`Drag ${element.componentName || element.tagName}`}
                title="Drag to reorder"
              >
                <DragHandleIcon />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Element content with drag overlay */}
        <div
          className={`
            relative
            ${isDragMode ? 'cursor-grab' : ''}
            ${isBeingDragged ? 'opacity-50 cursor-grabbing' : ''}
          `}
          onMouseDown={!showHandle ? handleDragStart : undefined}
          onTouchStart={!showHandle ? handleDragStart : undefined}
        >
          {children}

          {/* Drag mode indicator */}
          <AnimatePresence>
            {isDragMode && !isBeingDragged && isHovering && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-none"
                style={{
                  border: '2px dashed rgba(251, 191, 36, 0.3)',
                  borderRadius: '4px',
                }}
              />
            )}
          </AnimatePresence>

          {/* Being dragged indicator */}
          <AnimatePresence>
            {isBeingDragged && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-none"
                style={{
                  border: '2px solid rgba(251, 191, 36, 0.5)',
                  borderRadius: '4px',
                  background: 'rgba(251, 191, 36, 0.05)',
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Drag ghost - rendered at document level */}
      {localDragging && renderDragGhost()}
    </>
  );
};

// =============================================================================
// Drag Handle Only Component
// =============================================================================

export interface DragHandleProps {
  element: SelectedElement;
  disabled?: boolean;
  className?: string;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export const DragHandle: React.FC<DragHandleProps> = ({
  element,
  disabled = false,
  className = '',
  onDragStart,
  onDragEnd,
}) => {
  const { selectionMode, startDrag: storeStartDrag, endDrag: storeEndDrag } = useVisualEditorStore();
  const [localDragging, setLocalDragging] = useState(false);

  const isDragMode = selectionMode === 'drag';

  const handleDragStart = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (disabled || !isDragMode) return;

      event.preventDefault();
      event.stopPropagation();

      const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : event;

      storeStartDrag(element);
      dragDropManager.startDrag(element, nativeEvent as MouseEvent | TouchEvent);
      setLocalDragging(true);
      onDragStart?.();
    },
    [disabled, isDragMode, element, storeStartDrag, onDragStart]
  );

  useEffect(() => {
    if (!localDragging) return;

    dragDropManager.setHandlers({
      onDragEnd: () => {
        setLocalDragging(false);
        storeEndDrag();
        onDragEnd?.();
      },
    });

    return () => {
      dragDropManager.setHandlers({});
    };
  }, [localDragging, storeEndDrag, onDragEnd]);

  if (disabled || !isDragMode) {
    return null;
  }

  return (
    <button
      type="button"
      className={`
        p-1.5 rounded cursor-grab active:cursor-grabbing
        bg-neutral-800/80 text-neutral-400
        hover:text-yellow-400 hover:bg-neutral-700/80
        transition-colors duration-150
        ${className}
      `}
      style={{
        backdropFilter: 'blur(8px)',
      }}
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
      tabIndex={0}
      aria-label={`Drag ${element.componentName || element.tagName}`}
      title="Drag to reorder"
    >
      <DragHandleIcon />
    </button>
  );
};

export default DraggableElement;
