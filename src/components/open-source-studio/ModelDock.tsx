/**
 * Model Dock - Drag-and-Drop Model Collection
 * 
 * Collects up to 5 models for training/deployment.
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 2).
 */

import { useCallback, useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { useOpenSourceStudioStore, type ModelWithRequirements, type ModelDockItem } from '@/store/useOpenSourceStudioStore';
import { ModelCard } from './ModelCard';
import './ModelDock.css';

// =============================================================================
// ICONS
// =============================================================================

const DockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
    <path d="M3 15h18" stroke="currentColor" strokeWidth="2" />
    <circle cx="7" cy="19" r="1" fill="currentColor" />
    <circle cx="12" cy="19" r="1" fill="currentColor" />
    <circle cx="17" cy="19" r="1" fill="currentColor" />
  </svg>
);

const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PlayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
  </svg>
);

// =============================================================================
// COMPONENT
// =============================================================================

export function ModelDock() {
  const { dock, addToDock, removeFromDock, reorderDock, clearDock } = useOpenSourceStudioStore();
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    try {
      const modelData = e.dataTransfer.getData('application/json');
      if (modelData) {
        const model: ModelWithRequirements = JSON.parse(modelData);
        addToDock(model);
      }
    } catch (error) {
      console.error('[ModelDock] Drop error:', error);
    }
  }, [addToDock]);

  const handleReorder = useCallback((newOrder: ModelDockItem[]) => {
    // Find what moved and update positions
    newOrder.forEach((item, newIndex) => {
      const oldIndex = dock.findIndex(d => d.model.modelId === item.model.modelId);
      if (oldIndex !== newIndex) {
        reorderDock(oldIndex, newIndex);
      }
    });
  }, [dock, reorderDock]);

  const totalEstimatedVRAM = dock.reduce((sum, item) => {
    const size = item.model.siblings
      ?.filter(f =>
        f.rfilename.endsWith('.bin') ||
        f.rfilename.endsWith('.safetensors') ||
        f.rfilename.endsWith('.pt')
      )
      .reduce((s, f) => s + (f.size || 0), 0) || 0;
    return sum + Math.ceil((size / (1024 * 1024 * 1024)) * 2.5);
  }, 0);

  return (
    <div
      className={`model-dock ${isDragOver ? 'model-dock--drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="model-dock-header">
        <div className="model-dock-title">
          <DockIcon />
          <span>Model Dock</span>
          <span className="model-dock-count">{dock.length}/5</span>
        </div>

        {dock.length > 0 && (
          <button
            className="model-dock-clear"
            onClick={clearDock}
            title="Clear all models"
          >
            <TrashIcon />
          </button>
        )}
      </div>

      {/* Dock Content */}
      <div className="model-dock-content">
        {dock.length === 0 ? (
          <div className="model-dock-empty">
            <div className="model-dock-empty-icon">
              <DockIcon />
            </div>
            <p className="model-dock-empty-text">
              Drag models here to collect them for training
            </p>
            <p className="model-dock-empty-hint">
              You can add up to 5 models
            </p>
          </div>
        ) : (
          <Reorder.Group
            axis="y"
            values={dock}
            onReorder={handleReorder}
            className="model-dock-list"
          >
            <AnimatePresence>
              {dock.map((item) => (
                <Reorder.Item
                  key={item.model.modelId}
                  value={item}
                  className="model-dock-item"
                >
                  <ModelCard
                    model={item.model}
                    index={item.position}
                    isDocked
                    onRemove={() => removeFromDock(item.model.modelId)}
                  />
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}
      </div>

      {/* Footer Stats */}
      {dock.length > 0 && (
        <div className="model-dock-footer">
          <div className="model-dock-stats">
            <span className="model-dock-stat">
              Est. VRAM: <strong>{totalEstimatedVRAM} GB</strong>
            </span>
          </div>

          <motion.button
            className="model-dock-train-btn"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <PlayIcon />
            <span>Start Training</span>
          </motion.button>
        </div>
      )}

      {/* Drop Zone Indicator */}
      <AnimatePresence>
        {isDragOver && dock.length < 5 && (
          <motion.div
            className="model-dock-drop-zone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <span>Drop to add model</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Indicator */}
      <AnimatePresence>
        {isDragOver && dock.length >= 5 && (
          <motion.div
            className="model-dock-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <span>Dock is full - remove a model first</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ModelDock;
