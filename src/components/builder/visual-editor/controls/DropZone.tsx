/**
 * Drop Zone Component
 *
 * Visual indicators for valid drop targets during drag operations.
 * Renders insertion lines and container highlights.
 *
 * Features:
 * - Before/after insertion indicators
 * - Inside container indicators
 * - Animated feedback
 * - Accessibility labels
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVisualEditorStore } from '../../../../store/useVisualEditorStore';
import { dragDropManager, type DropTarget, type DropPosition } from '../services/drag-drop-manager';

// =============================================================================
// Types
// =============================================================================

export interface DropZoneProps {
  className?: string;
}

interface DropIndicatorProps {
  target: DropTarget;
  frameOffset?: { x: number; y: number };
}

// =============================================================================
// Drop Indicator Component
// =============================================================================

const DropIndicator: React.FC<DropIndicatorProps> = ({
  target,
  frameOffset = { x: 0, y: 0 },
}) => {
  const { bounds, position } = target;

  // Calculate adjusted bounds for indicator positioning
  const adjustedBounds = {
    top: bounds.top + frameOffset.y,
    left: bounds.left + frameOffset.x,
    width: bounds.width,
    height: bounds.height,
  };

  // Render based on position type
  switch (position) {
    case 'before':
      return (
        <motion.div
          initial={{ opacity: 0, scaleX: 0.8 }}
          animate={{ opacity: 1, scaleX: 1 }}
          exit={{ opacity: 0, scaleX: 0.8 }}
          className="fixed pointer-events-none z-[99999]"
          style={{
            top: adjustedBounds.top - 2,
            left: adjustedBounds.left,
            width: adjustedBounds.width,
            height: 4,
            background: 'linear-gradient(90deg, rgba(251, 191, 36, 0.9), rgba(234, 179, 8, 0.9))',
            borderRadius: 2,
            boxShadow: '0 0 12px rgba(251, 191, 36, 0.5)',
          }}
        >
          {/* End caps */}
          <div
            className="absolute -left-1 -top-1 w-2 h-2 rounded-full"
            style={{ background: 'rgba(251, 191, 36, 1)' }}
          />
          <div
            className="absolute -right-1 -top-1 w-2 h-2 rounded-full"
            style={{ background: 'rgba(251, 191, 36, 1)' }}
          />
        </motion.div>
      );

    case 'after':
      return (
        <motion.div
          initial={{ opacity: 0, scaleX: 0.8 }}
          animate={{ opacity: 1, scaleX: 1 }}
          exit={{ opacity: 0, scaleX: 0.8 }}
          className="fixed pointer-events-none z-[99999]"
          style={{
            top: adjustedBounds.top + adjustedBounds.height - 2,
            left: adjustedBounds.left,
            width: adjustedBounds.width,
            height: 4,
            background: 'linear-gradient(90deg, rgba(251, 191, 36, 0.9), rgba(234, 179, 8, 0.9))',
            borderRadius: 2,
            boxShadow: '0 0 12px rgba(251, 191, 36, 0.5)',
          }}
        >
          {/* End caps */}
          <div
            className="absolute -left-1 -top-1 w-2 h-2 rounded-full"
            style={{ background: 'rgba(251, 191, 36, 1)' }}
          />
          <div
            className="absolute -right-1 -top-1 w-2 h-2 rounded-full"
            style={{ background: 'rgba(251, 191, 36, 1)' }}
          />
        </motion.div>
      );

    case 'inside':
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed pointer-events-none z-[99998]"
          style={{
            top: adjustedBounds.top,
            left: adjustedBounds.left,
            width: adjustedBounds.width,
            height: adjustedBounds.height,
            background: 'rgba(251, 191, 36, 0.08)',
            border: '2px dashed rgba(251, 191, 36, 0.5)',
            borderRadius: 4,
          }}
        >
          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{
                background: 'rgba(10, 10, 15, 0.9)',
                color: 'rgba(251, 191, 36, 0.9)',
                backdropFilter: 'blur(8px)',
              }}
            >
              Drop inside
            </div>
          </div>
        </motion.div>
      );

    case 'first-child':
      return (
        <motion.div
          initial={{ opacity: 0, scaleX: 0.8 }}
          animate={{ opacity: 1, scaleX: 1 }}
          exit={{ opacity: 0, scaleX: 0.8 }}
          className="fixed pointer-events-none z-[99999]"
          style={{
            top: adjustedBounds.top + 6,
            left: adjustedBounds.left + 6,
            width: adjustedBounds.width - 12,
            height: 4,
            background: 'linear-gradient(90deg, rgba(34, 197, 94, 0.9), rgba(21, 128, 61, 0.9))',
            borderRadius: 2,
            boxShadow: '0 0 12px rgba(34, 197, 94, 0.5)',
          }}
        >
          <div
            className="absolute -left-1 -top-1 w-2 h-2 rounded-full"
            style={{ background: 'rgba(34, 197, 94, 1)' }}
          />
          <div
            className="absolute -right-1 -top-1 w-2 h-2 rounded-full"
            style={{ background: 'rgba(34, 197, 94, 1)' }}
          />
        </motion.div>
      );

    case 'last-child':
      return (
        <motion.div
          initial={{ opacity: 0, scaleX: 0.8 }}
          animate={{ opacity: 1, scaleX: 1 }}
          exit={{ opacity: 0, scaleX: 0.8 }}
          className="fixed pointer-events-none z-[99999]"
          style={{
            top: adjustedBounds.top + adjustedBounds.height - 10,
            left: adjustedBounds.left + 6,
            width: adjustedBounds.width - 12,
            height: 4,
            background: 'linear-gradient(90deg, rgba(34, 197, 94, 0.9), rgba(21, 128, 61, 0.9))',
            borderRadius: 2,
            boxShadow: '0 0 12px rgba(34, 197, 94, 0.5)',
          }}
        >
          <div
            className="absolute -left-1 -top-1 w-2 h-2 rounded-full"
            style={{ background: 'rgba(34, 197, 94, 1)' }}
          />
          <div
            className="absolute -right-1 -top-1 w-2 h-2 rounded-full"
            style={{ background: 'rgba(34, 197, 94, 1)' }}
          />
        </motion.div>
      );

    default:
      return null;
  }
};

// =============================================================================
// Drop Zone Label
// =============================================================================

const DropZoneLabel: React.FC<{ position: DropPosition; elementName: string }> = ({
  position,
  elementName,
}) => {
  const getLabel = () => {
    switch (position) {
      case 'before':
        return `Insert before ${elementName}`;
      case 'after':
        return `Insert after ${elementName}`;
      case 'inside':
        return `Insert into ${elementName}`;
      case 'first-child':
        return `Insert as first child of ${elementName}`;
      case 'last-child':
        return `Insert as last child of ${elementName}`;
      default:
        return 'Drop here';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="fixed z-[100000] pointer-events-none"
      style={{
        left: '50%',
        bottom: 80,
        transform: 'translateX(-50%)',
      }}
    >
      <div
        className="px-4 py-2 rounded-lg text-sm font-medium"
        style={{
          background: 'rgba(10, 10, 15, 0.95)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          color: 'rgba(251, 191, 36, 0.9)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        {getLabel()}
      </div>
    </motion.div>
  );
};

// =============================================================================
// Drop Zone Component
// =============================================================================

export const DropZone: React.FC<DropZoneProps> = ({ className = '' }) => {
  const { isDragging, dropTarget } = useVisualEditorStore();
  const [currentTarget, setCurrentTarget] = useState<DropTarget | null>(null);
  const [frameOffset, setFrameOffset] = useState({ x: 0, y: 0 });

  // Subscribe to drop target changes from manager
  useEffect(() => {
    if (!isDragging) {
      setCurrentTarget(null);
      return;
    }

    dragDropManager.setHandlers({
      onDropTargetChange: (target) => {
        setCurrentTarget(target);
      },
    });

    return () => {
      dragDropManager.setHandlers({});
    };
  }, [isDragging]);

  // Update frame offset when preview frame changes
  useEffect(() => {
    const updateFrameOffset = () => {
      // Find the preview iframe
      const iframe = document.querySelector('iframe[data-preview-frame]') as HTMLIFrameElement;
      if (iframe) {
        const rect = iframe.getBoundingClientRect();
        setFrameOffset({ x: rect.left, y: rect.top });
      }
    };

    updateFrameOffset();
    window.addEventListener('resize', updateFrameOffset);

    return () => {
      window.removeEventListener('resize', updateFrameOffset);
    };
  }, []);

  // Use store's dropTarget if available, otherwise use local state
  const activeTarget = dropTarget || currentTarget;

  if (!isDragging) {
    return null;
  }

  return (
    <div className={`drop-zone-container ${className}`}>
      <AnimatePresence>
        {activeTarget && (
          <>
            <DropIndicator
              target={activeTarget}
              frameOffset={frameOffset}
            />
            <DropZoneLabel
              position={activeTarget.position}
              elementName={activeTarget.element.componentName || activeTarget.element.tagName}
            />
          </>
        )}
      </AnimatePresence>

      {/* Screen reader announcement */}
      {activeTarget && (
        <div className="sr-only" role="status" aria-live="polite">
          {`Drop zone: ${activeTarget.position} ${activeTarget.element.componentName || activeTarget.element.tagName}`}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Static Drop Zone (for predefined drop areas)
// =============================================================================

export interface StaticDropZoneProps {
  position: DropPosition;
  elementId: string;
  elementName: string;
  bounds: DOMRect;
  onDrop?: () => void;
  className?: string;
}

export const StaticDropZone: React.FC<StaticDropZoneProps> = ({
  position,
  elementId,
  elementName,
  bounds,
  onDrop,
  className = '',
}) => {
  const { isDragging, dragSource } = useVisualEditorStore();
  const [isOver, setIsOver] = useState(false);

  // Don't show if not dragging or if dropping on self
  if (!isDragging || dragSource?.id === elementId) {
    return null;
  }

  const handleDragEnter = useCallback(() => {
    setIsOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsOver(false);
  }, []);

  const handleDrop = useCallback(() => {
    setIsOver(false);
    onDrop?.();
  }, [onDrop]);

  // Calculate zone position and size based on position type
  const getZoneStyle = (): React.CSSProperties => {
    const zoneHeight = 24;

    switch (position) {
      case 'before':
        return {
          position: 'absolute',
          top: bounds.top - zoneHeight / 2,
          left: bounds.left,
          width: bounds.width,
          height: zoneHeight,
        };

      case 'after':
        return {
          position: 'absolute',
          top: bounds.top + bounds.height - zoneHeight / 2,
          left: bounds.left,
          width: bounds.width,
          height: zoneHeight,
        };

      case 'inside':
        return {
          position: 'absolute',
          top: bounds.top + zoneHeight,
          left: bounds.left + zoneHeight,
          width: bounds.width - zoneHeight * 2,
          height: bounds.height - zoneHeight * 2,
        };

      default:
        return {};
    }
  };

  return (
    <div
      className={`static-drop-zone ${className}`}
      style={getZoneStyle()}
      onMouseEnter={handleDragEnter}
      onMouseLeave={handleDragLeave}
      onMouseUp={handleDrop}
    >
      <AnimatePresence>
        {isOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background:
                position === 'inside'
                  ? 'rgba(251, 191, 36, 0.1)'
                  : 'linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.3), transparent)',
            }}
          >
            {position === 'inside' && (
              <span
                className="text-xs font-medium"
                style={{ color: 'rgba(251, 191, 36, 0.9)' }}
              >
                Drop into {elementName}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DropZone;
