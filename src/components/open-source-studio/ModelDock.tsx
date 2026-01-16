/**
 * Model Dock - Drag-and-Drop Model Collection with 3 Modes
 *
 * Collects up to 5 models for:
 * 1. Deploy & Use - Deploy as serverless endpoint
 * 2. Fine-Tune - Fine-tune with LoRA/QLoRA
 * 3. Train from Scratch - Full training
 *
 * Part of KripTik AI's Open Source Studio
 * 3D Photorealistic Liquid Glass Design - NO Lucide React icons
 */

import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOpenSourceStudioStore, type ModelWithRequirements } from '@/store/useOpenSourceStudioStore';
import { authenticatedFetch, API_URL } from '@/lib/api-config';
import { ModelCard } from './ModelCard';
import './ModelDock.css';

// =============================================================================
// TYPES
// =============================================================================

export type DockMode = 'deploy' | 'finetune' | 'train';

interface DockModeConfig {
  id: DockMode;
  label: string;
  description: string;
  icon: () => JSX.Element;
  actionLabel: string;
  color: string;
}

// =============================================================================
// CUSTOM SVG ICONS - No Lucide React
// =============================================================================

const DockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M3 15h18" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="7" cy="19" r="1.5" fill="currentColor" />
    <circle cx="12" cy="19" r="1.5" fill="currentColor" />
    <circle cx="17" cy="19" r="1.5" fill="currentColor" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RocketIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 15l-3-3 9.5-9.5c.78-.78 2.04-.78 2.83 0 .78.78.78 2.05 0 2.83L12 15z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 22l4-4M9 18l2-2M15 12l-3 3M9 18l-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const WrenchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BrainIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12 2a4 4 0 00-4 4c0 1.1.45 2.1 1.17 2.83L8 10a4 4 0 00-4 4c0 1.66 1 3.08 2.44 3.69L6 19a2 2 0 002 2h8a2 2 0 002-2l-.44-1.31A4 4 0 0020 14a4 4 0 00-4-4l-1.17-1.17A4 4 0 0016 6a4 4 0 00-4-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="9" cy="9" r="1" fill="currentColor" />
    <circle cx="15" cy="9" r="1" fill="currentColor" />
  </svg>
);

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SparklesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M12 3v2m0 14v2M5.5 5.5l1.5 1.5m10-1.5l-1.5 1.5M5.5 18.5l1.5-1.5m10 1.5l-1.5-1.5M3 12h2m14 0h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
  </svg>
);

// =============================================================================
// DOCK MODE CONFIGURATIONS
// =============================================================================

const DOCK_MODES: DockModeConfig[] = [
  {
    id: 'deploy',
    label: 'Deploy & Use',
    description: 'Deploy as serverless inference endpoint',
    icon: RocketIcon,
    actionLabel: 'Deploy Models',
    color: '#22C55E',
  },
  {
    id: 'finetune',
    label: 'Fine-Tune',
    description: 'Fine-tune with LoRA or QLoRA',
    icon: WrenchIcon,
    actionLabel: 'Start Fine-Tuning',
    color: '#F59E0B',
  },
  {
    id: 'train',
    label: 'Train from Scratch',
    description: 'Full training with custom dataset',
    icon: BrainIcon,
    actionLabel: 'Start Training',
    color: '#8B5CF6',
  },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface ModelDockProps {
  onStartTraining?: (models: ModelWithRequirements[], mode: DockMode) => void;
  onDeploy?: (models: ModelWithRequirements[]) => void;
}

export function ModelDock({ onStartTraining, onDeploy }: ModelDockProps) {
  const { dock, addToDock, removeFromDock, clearDock } = useOpenSourceStudioStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedMode, setSelectedMode] = useState<DockMode>('deploy');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [nlpPrompt, setNlpPrompt] = useState('');

  const currentMode = DOCK_MODES.find(m => m.id === selectedMode)!;

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

  const handleAction = async () => {
    if (dock.length === 0) return;

    setIsProcessing(true);
    const models = dock.map(d => d.model);

    try {
      if (selectedMode === 'deploy') {
        // Send to deployment endpoint with NLP context
        const response = await authenticatedFetch(`${API_URL}/api/open-source-studio/deploy/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            models: models.map(m => ({
              modelId: m.modelId,
              estimatedVRAM: m.estimatedVRAM,
              task: m.pipeline_tag,
            })),
            prompt: nlpPrompt || undefined,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          onDeploy?.(models);
          console.log('[ModelDock] Deployment started:', result);
        }
      } else {
        // Training or fine-tuning
        onStartTraining?.(models, selectedMode);
      }
    } catch (error) {
      console.error('[ModelDock] Action error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate total VRAM requirement
  const totalEstimatedVRAM = dock.reduce((sum, item) => {
    const vram = item.model.estimatedVRAM || 0;
    return sum + vram;
  }, 0);

  // Estimate cost per hour based on VRAM needs
  const estimateCostPerHour = () => {
    if (totalEstimatedVRAM <= 24) return 0.69; // RTX 4090
    if (totalEstimatedVRAM <= 48) return 0.99; // L40
    if (totalEstimatedVRAM <= 80) return 2.49; // A100 80GB
    return 3.99; // H100
  };

  return (
    <div
      className={`model-dock ${isDragOver ? 'model-dock--drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Glass effect layers */}
      <div className="model-dock__glass-layer model-dock__glass-layer--1" />
      <div className="model-dock__glass-layer model-dock__glass-layer--2" />

      {/* Header */}
      <div className="model-dock__header" style={{ padding: '4px 6px', flexShrink: 0 }}>
        <div className="model-dock__title-section" style={{ gap: '6px' }}>
          <DockIcon />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span className="model-dock__title" style={{ fontSize: '0.7rem' }}>Model Dock</span>
            <span className="model-dock__count" style={{ fontSize: '0.6rem', padding: '1px 4px' }}>{dock.length}/5</span>
          </div>
        </div>

        {dock.length > 0 && (
          <button className="model-dock__clear" onClick={clearDock} title="Clear all models" style={{ width: '20px', height: '20px' }}>
            <TrashIcon />
          </button>
        )}
      </div>

      {/* Mode Selector */}
      <div className="model-dock__mode-selector" style={{ padding: '3px 6px', flexShrink: 0 }}>
        <button
          className="model-dock__mode-button"
          onClick={() => setShowModeSelector(!showModeSelector)}
          style={{ '--mode-color': currentMode.color, padding: '3px 6px', gap: '4px' } as React.CSSProperties}
        >
          <currentMode.icon />
          <span style={{ fontSize: '0.65rem' }}>{currentMode.label}</span>
          <ChevronDownIcon />
        </button>

        <AnimatePresence>
          {showModeSelector && (
            <motion.div
              className="model-dock__mode-dropdown"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {DOCK_MODES.map((mode) => (
                <button
                  key={mode.id}
                  className={`model-dock__mode-option ${selectedMode === mode.id ? 'model-dock__mode-option--selected' : ''}`}
                  onClick={() => {
                    setSelectedMode(mode.id);
                    setShowModeSelector(false);
                  }}
                  style={{ '--mode-color': mode.color } as React.CSSProperties}
                >
                  <mode.icon />
                  <div className="model-dock__mode-option-text">
                    <span className="model-dock__mode-option-label">{mode.label}</span>
                    <span className="model-dock__mode-option-desc">{mode.description}</span>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Dock Content */}
      <div className="model-dock__content" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '4px' }}>
        {dock.length === 0 ? (
          <div className="model-dock__empty" style={{ padding: '12px 8px' }}>
            <div className="model-dock__empty-icon" style={{ width: '28px', height: '28px', marginBottom: '6px' }}>
              <DockIcon />
            </div>
            <p className="model-dock__empty-text" style={{ fontSize: '0.65rem', margin: '0 0 2px' }}>
              Drag models here to collect them
            </p>
            <p className="model-dock__empty-hint" style={{ fontSize: '0.55rem', margin: 0 }}>
              You can add up to 5 models
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: 0, margin: 0 }}>
            <AnimatePresence>
              {dock.map((item) => (
                <motion.div
                  key={item.model.modelId}
                  className="model-dock__item"
                  style={{ position: 'relative' }}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <ModelCard
                    model={item.model}
                    index={item.position}
                    isDocked
                    onRemove={() => {
                      console.log('[ModelDock] Removing model:', item.model.modelId);
                      removeFromDock(item.model.modelId);
                    }}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* NLP Prompt Input */}
      {dock.length > 0 && (
        <div className="model-dock__nlp-section" style={{ padding: '4px 6px', flexShrink: 0 }}>
          <div className="model-dock__nlp-header" style={{ fontSize: '0.55rem', marginBottom: '3px', gap: '3px' }}>
            <SparklesIcon />
            <span>Describe your workflow (optional)</span>
          </div>
          <textarea
            className="model-dock__nlp-input"
            value={nlpPrompt}
            onChange={(e) => setNlpPrompt(e.target.value)}
            placeholder={
              selectedMode === 'deploy'
                ? 'e.g., "Create an image generation API..."'
                : selectedMode === 'finetune'
                ? 'e.g., "Fine-tune for anime-style images..."'
                : 'e.g., "Train a custom model..."'
            }
            rows={2}
            style={{ 
              fontSize: '0.6rem', 
              padding: '6px 8px', 
              minHeight: '40px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: 'rgba(255,255,255,0.9)',
              resize: 'none',
            }}
          />
        </div>
      )}

      {/* Footer Stats & Action */}
      {dock.length > 0 && (
        <div className="model-dock__footer" style={{ padding: '4px 5px', flexShrink: 0 }}>
          <div className="model-dock__stats" style={{ gap: '3px', marginBottom: '3px' }}>
            <div className="model-dock__stat" style={{ padding: '2px 4px' }}>
              <span className="model-dock__stat-label" style={{ fontSize: '0.45rem' }}>Est. VRAM</span>
              <span className="model-dock__stat-value" style={{ fontSize: '0.6rem' }}>{totalEstimatedVRAM || '?'} GB</span>
            </div>
            <div className="model-dock__stat" style={{ padding: '2px 4px' }}>
              <span className="model-dock__stat-label" style={{ fontSize: '0.45rem' }}>Est. Cost</span>
              <span className="model-dock__stat-value" style={{ fontSize: '0.6rem' }}>${estimateCostPerHour().toFixed(2)}/hr</span>
            </div>
          </div>

          <motion.button
            className="model-dock__action-btn"
            style={{ '--mode-color': currentMode.color, padding: '5px 8px', fontSize: '0.65rem' } as React.CSSProperties}
            onClick={handleAction}
            disabled={isProcessing}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isProcessing ? (
              <>
                <div className="model-dock__spinner" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <PlayIcon />
                <span>{currentMode.actionLabel}</span>
              </>
            )}
          </motion.button>
        </div>
      )}

      {/* Drop Zone Indicator */}
      <AnimatePresence>
        {isDragOver && dock.length < 5 && (
          <motion.div
            className="model-dock__drop-zone"
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
            className="model-dock__full"
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
