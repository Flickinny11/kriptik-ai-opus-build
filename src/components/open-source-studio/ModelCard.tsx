/**
 * Model Card - Premium 3D HuggingFace Model Display
 *
 * Photorealistic 3D glass cards with depth, perspective, layered shadows.
 * High frame-rate hover animations, expandable details.
 * Part of KripTik AI's Open Source Studio.
 */

import { useCallback, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

function formatDate(dateString?: string): string {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

// =============================================================================
// ICONS - Custom SVG (No Lucide)
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
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ExpandIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TagIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="7" cy="7" r="1.5" fill="currentColor" />
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const cardRef = useRef<HTMLDivElement>(null);

  const isSelected = selectedModel?.modelId === model.modelId;
  const isInDock = dock.some(item => item.model.modelId === model.modelId);
  const hasRestrictiveLicense = isRestrictiveLicense(model.cardData?.license);

  // Calculate estimated size from siblings
  const estimatedSize = model.siblings
    ?.filter(f =>
      f.rfilename.endsWith('.bin') ||
      f.rfilename.endsWith('.safetensors') ||
      f.rfilename.endsWith('.pt')
    )
    .reduce((sum, f) => sum + (f.size || 0), 0) || 0;

  const estimatedVRAM = model.estimatedVRAM || Math.ceil((estimatedSize / (1024 * 1024 * 1024)) * 2.5);

  // 3D tilt effect on mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || isDocked) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setMousePos({ x, y });
  }, [isDocked]);

  const handleMouseLeave = useCallback(() => {
    setMousePos({ x: 0.5, y: 0.5 });
  }, []);

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

  const handleExpandToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(prev => !prev);
  }, []);

  const handleViewOnHuggingFace = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://huggingface.co/${model.modelId}`, '_blank', 'noopener,noreferrer');
  }, [model.modelId]);

  const handleNativeDragStart = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    setIsDragging(true);
    e.dataTransfer.setData('application/json', JSON.stringify(model));
    e.dataTransfer.effectAllowed = 'copy';
  }, [model]);

  const handleNativeDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Calculate 3D transform based on mouse position
  const rotateX = (mousePos.y - 0.5) * -12;
  const rotateY = (mousePos.x - 0.5) * 12;

  return (
    <div
      draggable={!isDocked}
      onDragStart={handleNativeDragStart}
      onDragEnd={handleNativeDragEnd}
      className="model-card-wrapper"
    >
      <motion.div
        ref={cardRef}
        className={`model-card ${isSelected ? 'model-card--selected' : ''} ${isDocked ? 'model-card--docked' : ''} ${isDragging ? 'model-card--dragging' : ''} ${isExpanded ? 'model-card--expanded' : ''}`}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        initial={{ opacity: 0, y: 30, rotateX: -10 }}
        animate={{
          opacity: 1,
          y: 0,
          rotateX: 0,
        }}
        exit={{ opacity: 0, scale: 0.9, rotateX: 10 }}
        transition={{
          delay: index * 0.04,
          duration: 0.5,
          ease: [0.23, 1, 0.32, 1]
        }}
        style={{
          transform: !isDocked ? `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)` : undefined,
          ...(isDocked ? { padding: '5px', gap: '3px' } : {}),
        }}
        layout
      >
        {/* Ambient light reflection layer */}
        <div
          className="model-card-reflection"
          style={{
            background: `radial-gradient(circle at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(255,210,30,0.08) 0%, transparent 60%)`,
          }}
        />

        {/* Glass edge highlight */}
        <div className="model-card-edge" />

        {/* Top shimmer line */}
        <div className="model-card-shimmer" />

        {/* Card Header */}
        {!isDocked && (
          <div className="model-card-header">
            <div className="model-card-author-row">
              <div className="model-card-avatar">
                {model.author?.charAt(0).toUpperCase() || 'M'}
              </div>
              <div className="model-card-author-info">
                <span className="model-card-author">{model.author}</span>
                <span className="model-card-updated">
                  <ClockIcon />
                  {formatDate(model.lastModified)}
                </span>
              </div>
            </div>
            {hasRestrictiveLicense && (
              <div className="model-card-warning" title="Restrictive license - may not allow modifications">
                <WarningIcon />
              </div>
            )}
          </div>
        )}

        {/* Model Name */}
        <h3 className="model-card-name" style={isDocked ? { fontSize: '0.7rem', margin: 0 } : undefined}>{model.modelId.split('/').pop()}</h3>

        {/* Task Badge */}
        {model.pipeline_tag && (
          <div className="model-card-task-row" style={isDocked ? { margin: 0 } : undefined}>
            <span className="model-card-task" style={isDocked ? { fontSize: '0.55rem', padding: '1px 4px' } : undefined}>{model.pipeline_tag.replace(/-/g, ' ')}</span>
          </div>
        )}

        {/* Stats Row - Premium 3D Stat Pills (hidden when docked for compactness) */}
        {!isDocked && (
          <div className="model-card-stats">
            <div className="model-card-stat model-card-stat--downloads" title="Downloads">
              <DownloadIcon />
              <span>{formatNumber(model.downloads)}</span>
            </div>
            <div className="model-card-stat model-card-stat--likes" title="Likes">
              <HeartIcon />
              <span>{formatNumber(model.likes)}</span>
            </div>
            {estimatedVRAM > 0 && (
              <div className="model-card-stat model-card-stat--vram" title="Estimated VRAM">
                <GpuIcon />
                <span>{estimatedVRAM}GB</span>
              </div>
            )}
          </div>
        )}

        {/* Size & License - Premium Badges (hidden when docked) */}
        {!isDocked && (
          <div className="model-card-meta">
            <span className="model-card-size">{formatSize(estimatedSize)}</span>
            {model.cardData?.license && (
              <span className={`model-card-license ${hasRestrictiveLicense ? 'restrictive' : ''}`}>
                {model.cardData.license}
              </span>
            )}
          </div>
        )}

        {/* Tags Preview (hidden when docked) */}
        {!isDocked && model.tags && model.tags.length > 0 && (
          <div className="model-card-tags">
            <TagIcon />
            {model.tags.slice(0, 3).map(tag => (
              <span key={tag} className="model-card-tag">{tag}</span>
            ))}
            {model.tags.length > 3 && (
              <span className="model-card-tag-more">+{model.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Expandable Details (hidden when docked) */}
        {!isDocked && (
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                className="model-card-details"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              >
                <div className="model-card-details-inner">
                  {/* Model Info Grid */}
                  <div className="model-card-info-grid">
                    <div className="model-card-info-item">
                      <span className="model-card-info-label">Model ID</span>
                      <span className="model-card-info-value">{model.modelId}</span>
                    </div>
                    {model.pipeline_tag && (
                      <div className="model-card-info-item">
                        <span className="model-card-info-label">Pipeline</span>
                        <span className="model-card-info-value">{model.pipeline_tag}</span>
                      </div>
                    )}
                    {model.cardData?.license && (
                      <div className="model-card-info-item">
                        <span className="model-card-info-label">License</span>
                        <span className="model-card-info-value">{model.cardData.license}</span>
                      </div>
                    )}
                    {estimatedVRAM > 0 && (
                      <div className="model-card-info-item">
                        <span className="model-card-info-label">Est. VRAM</span>
                        <span className="model-card-info-value">{estimatedVRAM} GB</span>
                      </div>
                    )}
                  </div>

                  {/* All Tags */}
                  {model.tags && model.tags.length > 0 && (
                    <div className="model-card-all-tags">
                      <h4>Tags</h4>
                      <div className="model-card-tags-list">
                        {model.tags.map(tag => (
                          <span key={tag} className="model-card-tag-full">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View on HuggingFace */}
                  <button className="model-card-hf-link" onClick={handleViewOnHuggingFace}>
                    <span>View on HuggingFace</span>
                    <ExternalLinkIcon />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Actions */}
        {!isDocked && (
          <div className="model-card-actions">
            <button
              className="model-card-expand-btn"
              onClick={handleExpandToggle}
              title={isExpanded ? 'Show less' : 'Show more details'}
            >
              <motion.span
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <ExpandIcon />
              </motion.span>
              <span>{isExpanded ? 'Less' : 'More'}</span>
            </button>

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
          <button
            className="model-card-remove"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('[ModelCard] Remove clicked for:', model.modelId);
              onRemove();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Remove from dock"
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '20px',
              height: '20px',
              borderRadius: '5px',
              background: 'rgba(255, 80, 80, 0.3)',
              border: '1px solid rgba(255, 80, 80, 0.5)',
              color: '#ff6b6b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 100,
              pointerEvents: 'auto',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {/* Selection indicator glow ring */}
        {isSelected && <div className="model-card-selection-ring" />}
      </motion.div>
    </div>
  );
}

export default ModelCard;
