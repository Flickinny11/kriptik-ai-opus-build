/**
 * Training Configuration - Training Parameters UI
 * 
 * Configure LoRA, QLoRA, or Full Fine-Tune parameters for model training.
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 4).
 */

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOpenSourceStudioStore, type ModelWithRequirements } from '@/store/useOpenSourceStudioStore';
import { TrainingCostEstimator } from './TrainingCostEstimator';
import './TrainingConfig.css';

// =============================================================================
// TYPES
// =============================================================================

export type TrainingType = 'lora' | 'qlora' | 'full';

export interface TrainingParams {
  type: TrainingType;
  epochs: number;
  learningRate: number;
  batchSize: number;
  loraRank?: number;
  loraAlpha?: number;
  loraDropout?: number;
  targetModules?: string[];
  datasetId?: string;
  budgetLimit?: number;
  autoSaveToHub: boolean;
  modelName?: string;
}

interface TrainingConfigProps {
  model: ModelWithRequirements;
  onStartTraining: (params: TrainingParams) => void;
  isLoading?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TRAINING_TYPES: { value: TrainingType; label: string; description: string }[] = [
  { value: 'lora', label: 'LoRA', description: 'Low-Rank Adaptation - lightweight, saves adapter only (~10-100MB)' },
  { value: 'qlora', label: 'QLoRA', description: 'Quantized LoRA - memory efficient using 4-bit base model' },
  { value: 'full', label: 'Full Fine-Tune', description: 'Complete model weights - WARNING: storage intensive' },
];

const LORA_RANK_OPTIONS = [8, 16, 32, 64, 128];
const LORA_ALPHA_OPTIONS = [16, 32, 64, 128, 256];

const LEARNING_RATE_PRESETS = [
  { value: 1e-5, label: '1e-5 (Conservative)' },
  { value: 2e-5, label: '2e-5 (Recommended)' },
  { value: 3e-5, label: '3e-5 (Standard)' },
  { value: 5e-5, label: '5e-5 (Aggressive)' },
  { value: 1e-4, label: '1e-4 (Fast)' },
];

const DEFAULT_TARGET_MODULES = ['q_proj', 'k_proj', 'v_proj', 'o_proj'];

// =============================================================================
// ICONS
// =============================================================================

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const WarningIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
  </svg>
);

// =============================================================================
// COMPONENT
// =============================================================================

export function TrainingConfig({ model, onStartTraining, isLoading = false }: TrainingConfigProps) {
  const { hfUsername } = useOpenSourceStudioStore();
  
  const [params, setParams] = useState<TrainingParams>({
    type: 'qlora',
    epochs: 3,
    learningRate: 2e-5,
    batchSize: 4,
    loraRank: 16,
    loraAlpha: 32,
    loraDropout: 0.05,
    targetModules: DEFAULT_TARGET_MODULES,
    budgetLimit: 10,
    autoSaveToHub: true,
    modelName: `${model.modelId.split('/').pop()}-finetuned`,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Calculate VRAM requirement based on training type
  const estimatedVRAM = useMemo(() => {
    const baseVRAM = model.estimatedVRAM || 8;
    switch (params.type) {
      case 'qlora':
        return Math.ceil(baseVRAM * 0.3); // ~30% of original
      case 'lora':
        return Math.ceil(baseVRAM * 0.6); // ~60% of original
      case 'full':
        return Math.ceil(baseVRAM * 2.5); // ~2.5x for gradients
      default:
        return baseVRAM;
    }
  }, [model.estimatedVRAM, params.type]);

  const updateParams = useCallback(<K extends keyof TrainingParams>(key: K, value: TrainingParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!isLoading) {
      onStartTraining(params);
    }
  }, [params, isLoading, onStartTraining]);

  return (
    <div className="training-config">
      {/* Header */}
      <div className="training-config-header">
        <h2 className="training-config-title">Training Configuration</h2>
        <p className="training-config-subtitle">
          Configure fine-tuning for <strong>{model.modelId.split('/').pop()}</strong>
        </p>
      </div>

      {/* Training Type Selection */}
      <div className="training-config-section">
        <label className="training-config-label">Training Type</label>
        <div className="training-config-types">
          {TRAINING_TYPES.map((type) => (
            <button
              key={type.value}
              className={`training-type-btn ${params.type === type.value ? 'active' : ''}`}
              onClick={() => updateParams('type', type.value)}
            >
              <span className="training-type-label">{type.label}</span>
              <span className="training-type-desc">{type.description}</span>
              {type.value === 'full' && (
                <span className="training-type-warning">
                  <WarningIcon />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Basic Parameters */}
      <div className="training-config-grid">
        {/* Epochs */}
        <div className="training-config-field">
          <label className="training-config-label">
            Epochs
            <span className="training-config-hint" title="Number of complete passes through the dataset">
              <InfoIcon />
            </span>
          </label>
          <div className="training-config-slider">
            <input
              type="range"
              min="1"
              max="20"
              value={params.epochs}
              onChange={(e) => updateParams('epochs', parseInt(e.target.value))}
            />
            <span className="training-config-value">{params.epochs}</span>
          </div>
        </div>

        {/* Batch Size */}
        <div className="training-config-field">
          <label className="training-config-label">
            Batch Size
            <span className="training-config-hint" title="Samples per training step (auto-adjusted for VRAM)">
              <InfoIcon />
            </span>
          </label>
          <select
            value={params.batchSize}
            onChange={(e) => updateParams('batchSize', parseInt(e.target.value))}
            className="training-config-select"
          >
            {[1, 2, 4, 8, 16, 32].map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>

        {/* Learning Rate */}
        <div className="training-config-field">
          <label className="training-config-label">
            Learning Rate
            <span className="training-config-hint" title="Step size for weight updates">
              <InfoIcon />
            </span>
          </label>
          <select
            value={params.learningRate}
            onChange={(e) => updateParams('learningRate', parseFloat(e.target.value))}
            className="training-config-select"
          >
            {LEARNING_RATE_PRESETS.map(preset => (
              <option key={preset.value} value={preset.value}>{preset.label}</option>
            ))}
          </select>
        </div>

        {/* Budget Limit */}
        <div className="training-config-field">
          <label className="training-config-label">
            Budget Limit (USD)
            <span className="training-config-hint" title="Training will stop if this limit is reached">
              <InfoIcon />
            </span>
          </label>
          <input
            type="number"
            min="1"
            max="1000"
            step="1"
            value={params.budgetLimit}
            onChange={(e) => updateParams('budgetLimit', parseInt(e.target.value) || 10)}
            className="training-config-input"
          />
        </div>
      </div>

      {/* LoRA Parameters (for LoRA and QLoRA) */}
      {(params.type === 'lora' || params.type === 'qlora') && (
        <AnimatePresence>
          <motion.div
            className="training-config-section training-config-lora"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <h3 className="training-config-section-title">LoRA Parameters</h3>
            <div className="training-config-grid">
              <div className="training-config-field">
                <label className="training-config-label">Rank (r)</label>
                <select
                  value={params.loraRank}
                  onChange={(e) => updateParams('loraRank', parseInt(e.target.value))}
                  className="training-config-select"
                >
                  {LORA_RANK_OPTIONS.map(rank => (
                    <option key={rank} value={rank}>{rank}</option>
                  ))}
                </select>
              </div>

              <div className="training-config-field">
                <label className="training-config-label">Alpha</label>
                <select
                  value={params.loraAlpha}
                  onChange={(e) => updateParams('loraAlpha', parseInt(e.target.value))}
                  className="training-config-select"
                >
                  {LORA_ALPHA_OPTIONS.map(alpha => (
                    <option key={alpha} value={alpha}>{alpha}</option>
                  ))}
                </select>
              </div>

              <div className="training-config-field">
                <label className="training-config-label">Dropout</label>
                <select
                  value={params.loraDropout}
                  onChange={(e) => updateParams('loraDropout', parseFloat(e.target.value))}
                  className="training-config-select"
                >
                  {[0, 0.05, 0.1, 0.15, 0.2].map(dropout => (
                    <option key={dropout} value={dropout}>{dropout}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Advanced Toggle */}
            <button
              className="training-config-advanced-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
            </button>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  className="training-config-advanced"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="training-config-field training-config-field--full">
                    <label className="training-config-label">Target Modules</label>
                    <div className="training-config-modules">
                      {['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'].map(module => (
                        <label key={module} className="training-config-module">
                          <input
                            type="checkbox"
                            checked={params.targetModules?.includes(module)}
                            onChange={(e) => {
                              const modules = params.targetModules || [];
                              if (e.target.checked) {
                                updateParams('targetModules', [...modules, module]);
                              } else {
                                updateParams('targetModules', modules.filter(m => m !== module));
                              }
                            }}
                          />
                          <span>{module}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Output Settings */}
      <div className="training-config-section">
        <h3 className="training-config-section-title">Output Settings</h3>
        <div className="training-config-grid">
          <div className="training-config-field training-config-field--full">
            <label className="training-config-label">Model Name on HuggingFace</label>
            <div className="training-config-model-name">
              <span className="training-config-prefix">{hfUsername}/</span>
              <input
                type="text"
                value={params.modelName}
                onChange={(e) => updateParams('modelName', e.target.value)}
                className="training-config-input"
                placeholder="my-finetuned-model"
              />
            </div>
          </div>

          <div className="training-config-field">
            <label className="training-config-checkbox">
              <input
                type="checkbox"
                checked={params.autoSaveToHub}
                onChange={(e) => updateParams('autoSaveToHub', e.target.checked)}
              />
              <span>Auto-save to HuggingFace Hub</span>
            </label>
          </div>
        </div>
      </div>

      {/* Cost Estimator */}
      <TrainingCostEstimator
        vramRequired={estimatedVRAM}
        epochs={params.epochs}
        trainingType={params.type}
        budgetLimit={params.budgetLimit}
      />

      {/* Submit Button */}
      <motion.button
        className="training-config-submit"
        onClick={handleSubmit}
        disabled={isLoading || !params.modelName}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {isLoading ? (
          <>
            <span className="training-config-spinner" />
            <span>Starting Training...</span>
          </>
        ) : (
          <>
            <PlayIcon />
            <span>Start Training</span>
          </>
        )}
      </motion.button>

      {/* Warnings */}
      {params.type === 'full' && (
        <div className="training-config-warning-box">
          <WarningIcon />
          <div>
            <strong>Full Fine-Tuning Warning</strong>
            <p>This will create a complete copy of the model weights (~{model.estimatedSize ? Math.ceil(model.estimatedSize / (1024 * 1024 * 1024)) : '?'} GB). Storage charges will apply.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default TrainingConfig;
