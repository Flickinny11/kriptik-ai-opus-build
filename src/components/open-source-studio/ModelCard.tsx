/**
 * Model Card - Individual HuggingFace Model Display
 * 
 * Draggable card showing model info, downloads, likes, VRAM estimate.
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 2).
 */

import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { useOpenSourceStudioStore, type ModelWithRequirements } from '@/store/useOpenSourceStudioStore';
import './ModelCard.css';

// =============================================================================
// HELPERS
// =============================================================================

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return String(num);
}

function formatSize(bytes?: number): string {
  if (!bytes) return 'Unknown';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

function isRestrictiveLicense(license?: string): boolean {
  if (!license) return false;
  const restrictive = ['cc-by-nc', 'cc-by-nc-nd', 'cc-by-nc-sa', 'other', 'proprietary'];
  return restrictive.some(r => license.toLowerCase().includes(r));
}

// =============================================================================
// ICONS
// =============================================================================

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const HeartIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const GpuIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M7 6V4M12 6V4M17 6V4M7 18v2M12 18v2M17 18v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const WarningIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// =============================================================================
// COMPONENT
// =============================================================================

interface ModelCardProps {
  model: ModelWithRequirements;
  index: number;
  isDocked?: boolean;
  onRemove?: () => void;
}

export function ModelCard({ model, index, isDocked = false, onRemove }: ModelCardProps) {
  const { selectModel, selectedModel, addToDock, dock } = useOpenSourceStudioStore();
  const [isDragging, setIsDragging] = useState(false);
  const [showAdded, setShowAdded] = useState(false);

  const isSelected = selectedModel?.modelId === model.modelId;
  const isInDock = dock.some(item => item.model.modelId === model.modelId);
  const hasRestrictiveLicense = isRestrictiveLicense(model.cardData?.license);

  const handleClick = useCallback(() => {
    selectModel(isSelected ? null : model);
  }, [model, isSelected, selectModel]);

  const handleAddToDock = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const added = addToDock(model);
    if (added) {
      setShowAdded(true);
      setTimeout(() => setShowAdded(false), 1500);
    }
  }, [model, addToDock]);

  const handleNativeDragStart = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    setIsDragging(true);
    e.dataTransfer.setData('application/json', JSON.stringify(model));
    e.dataTransfer.effectAllowed = 'copy';
  }, [model]);

  const handleNativeDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Calculate estimated size from siblings
  const estimatedSize = model.siblings
    ?.filter(f =>
      f.rfilename.endsWith('.bin') ||
      f.rfilename.endsWith('.safetensors') ||
      f.rfilename.endsWith('.pt')
    )
    .reduce((sum, f) => sum + (f.size || 0), 0) || 0;

  const estimatedVRAM = Math.ceil((estimatedSize / (1024 * 1024 * 1024)) * 2.5);

  return (
    <div
      draggable={!isDocked}
      onDragStart={handleNativeDragStart}
      onDragEnd={handleNativeDragEnd}
    >
      <motion.div
        className={`model-card ${isSelected ? 'model-card--selected' : ''} ${isDocked ? 'model-card--docked' : ''} ${isDragging ? 'model-card--dragging' : ''}`}
        onClick={handleClick}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ delay: index * 0.03, duration: 0.3 }}
        layout
      >
      {/* Card Header */}
      <div className="model-card-header">
        <div className="model-card-author">{model.author}</div>
        {hasRestrictiveLicense && (
          <div className="model-card-warning" title="Restrictive license - may not allow modifications">
            <WarningIcon />
          </div>
        )}
      </div>

      {/* Model Name */}
      <h3 className="model-card-name">{model.modelId.split('/').pop()}</h3>

      {/* Task Badge */}
      {model.pipeline_tag && (
        <span className="model-card-task">{model.pipeline_tag.replace(/-/g, ' ')}</span>
      )}

      {/* Stats */}
      <div className="model-card-stats">
        <div className="model-card-stat" title="Downloads">
          <DownloadIcon />
          <span>{formatNumber(model.downloads)}</span>
        </div>
        <div className="model-card-stat" title="Likes">
          <HeartIcon />
          <span>{formatNumber(model.likes)}</span>
        </div>
        {estimatedVRAM > 0 && (
          <div className="model-card-stat" title="Estimated VRAM">
            <GpuIcon />
            <span>{estimatedVRAM}GB</span>
          </div>
        )}
      </div>

      {/* Size & License */}
      <div className="model-card-meta">
        <span className="model-card-size">{formatSize(estimatedSize)}</span>
        {model.cardData?.license && (
          <span className={`model-card-license ${hasRestrictiveLicense ? 'restrictive' : ''}`}>
            {model.cardData.license}
          </span>
        )}
      </div>

      {/* Actions */}
      {!isDocked && (
        <div className="model-card-actions">
          {isInDock || showAdded ? (
            <button className="model-card-btn model-card-btn--added" disabled>
              <CheckIcon />
              <span>In Dock</span>
            </button>
          ) : (
            <button
              className="model-card-btn model-card-btn--add"
              onClick={handleAddToDock}
              disabled={dock.length >= 5}
            >
              <PlusIcon />
              <span>Add to Dock</span>
            </button>
          )}
        </div>
      )}

      {/* Remove Button (for docked cards) */}
      {isDocked && onRemove && (
        <button className="model-card-remove" onClick={onRemove} title="Remove from dock">
          ×
        </button>
      )}
      </motion.div>
    </div>
  );
}

export default ModelCard;
