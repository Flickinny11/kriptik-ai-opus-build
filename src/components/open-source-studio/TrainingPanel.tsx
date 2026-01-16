/**
 * Training Panel - Comprehensive Training & Fine-Tuning Interface
 *
 * Features:
 * - NLP goal input for training
 * - Mode selection (Fine-tune, Quick train)
 * - Training method selection (LoRA, QLoRA, Full, DPO, etc.)
 * - Dataset configuration with HuggingFace search
 * - Advanced hyperparameter controls
 * - Budget controls with hard stop
 * - Training jobs list with live progress
 * - Completion UI with before/after testing
 * - Save options (KripTik, HuggingFace, Download)
 *
 * NO Lucide React icons - custom SVG icons only
 * 3D Photorealistic Liquid Glass Design System
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authenticatedFetch, API_URL } from '@/lib/api-config';
import { useOpenSourceStudioStore, type ModelWithRequirements } from '@/store/useOpenSourceStudioStore';
import './TrainingPanel.css';

// =============================================================================
// TYPES
// =============================================================================

type TrainingMethod = 'lora' | 'qlora' | 'full' | 'dpo' | 'rlhf' | 'dreambooth' | 'textual_inversion';
type TrainingStatus = 'queued' | 'preparing' | 'downloading' | 'training' | 'completed' | 'failed' | 'stopped' | 'paused';
type ModalityType = 'llm' | 'image' | 'video' | 'audio' | 'multimodal';

interface TrainingJob {
  id: string;
  name: string;
  baseModel: string;
  modality: ModalityType;
  method: TrainingMethod;
  status: TrainingStatus;
  progress: number;
  currentEpoch: number;
  totalEpochs: number;
  currentStep: number;
  totalSteps: number;
  currentLoss: number;
  bestLoss: number;
  costSoFar: number;
  budgetLimit: number;
  elapsedSeconds: number;
  estimatedRemainingSeconds: number;
  startedAt: string;
  hubUrl?: string;
}

interface TrainingConfig {
  method: TrainingMethod;
  epochs: number;
  learningRate: number;
  batchSize: number;
  loraRank: number;
  loraAlpha: number;
  loraDropout: number;
  gradientAccumulation: number;
  warmupSteps: number;
  weightDecay: number;
  maxSeqLength: number;
  gpuType: string;
}

interface Dataset {
  id: string;
  name: string;
  source: 'huggingface' | 'custom';
  samples: number;
  selected: boolean;
}

// =============================================================================
// CUSTOM SVG ICONS
// =============================================================================

const SparklesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12 3v2m0 14v2M5.5 5.5l1.5 1.5m10-1.5l-1.5 1.5M5.5 18.5l1.5-1.5m10 1.5l-1.5-1.5M3 12h2m14 0h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const BrainIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 2a4 4 0 00-4 4c0 1.1.45 2.1 1.17 2.83L8 10a4 4 0 00-4 4c0 1.66 1 3.08 2.44 3.69L6 19a2 2 0 002 2h8a2 2 0 002-2l-.44-1.31A4 4 0 0020 14a4 4 0 00-4-4l-1.17-1.17A4 4 0 0016 6a4 4 0 00-4-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="9" cy="9" r="1" fill="currentColor" />
    <circle cx="15" cy="9" r="1" fill="currentColor" />
  </svg>
);

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <polygon points="5,3 19,12 5,21" fill="currentColor" />
  </svg>
);

const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="6" y="4" width="4" height="16" fill="currentColor" />
    <rect x="14" y="4" width="4" height="16" fill="currentColor" />
  </svg>
);

const StopIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ChevronUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DollarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M12 6v12M8 10h8M8 14h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SaveIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const UploadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const RocketIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91-.78-.8-2.07-.81-2.91-.09zM12 15l-3-3 9-9a3 3 0 113 3l-9 9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TestIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M9 3h6v2H9V3z" stroke="currentColor" strokeWidth="2"/>
    <path d="M9 5v3.5L5 18c-.4.8.2 2 1.2 2h11.6c1 0 1.6-1.2 1.2-2L15 8.5V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="10" cy="14" r="1" fill="currentColor"/>
    <circle cx="14" cy="16" r="1" fill="currentColor"/>
  </svg>
);

const BackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const ExpandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// =============================================================================
// CONSTANTS
// =============================================================================

const TRAINING_METHODS: Record<ModalityType, { value: TrainingMethod; label: string; description: string }[]> = {
  llm: [
    { value: 'qlora', label: 'QLoRA', description: 'Quantized LoRA - Most efficient, low memory' },
    { value: 'lora', label: 'LoRA', description: 'Low-Rank Adaptation - Balanced quality/cost' },
    { value: 'full', label: 'Full Fine-tune', description: 'Best quality, highest cost' },
    { value: 'dpo', label: 'DPO', description: 'Direct Preference Optimization' },
    { value: 'rlhf', label: 'RLHF', description: 'Reinforcement Learning from Human Feedback' },
  ],
  image: [
    { value: 'lora', label: 'LoRA', description: 'Style and concept training' },
    { value: 'dreambooth', label: 'DreamBooth', description: 'Subject-driven generation' },
    { value: 'textual_inversion', label: 'Textual Inversion', description: 'Learn new concepts' },
  ],
  video: [
    { value: 'lora', label: 'LoRA', description: 'Style and motion training' },
  ],
  audio: [
    { value: 'lora', label: 'LoRA', description: 'Voice cloning and style transfer' },
  ],
  multimodal: [
    { value: 'lora', label: 'LoRA', description: 'Efficient multimodal training' },
  ],
};

const INTENSITY_PRESETS = [
  { id: 'light', label: 'Quick & Light', cost: '$15-25', time: '2-4 hrs', description: 'Good for testing' },
  { id: 'balanced', label: 'Balanced', cost: '$35-55', time: '8-12 hrs', description: 'Recommended' },
  { id: 'thorough', label: 'Thorough', cost: '$80-120', time: '20-30 hrs', description: 'Best quality' },
  { id: 'custom', label: 'Custom', cost: 'Varies', time: 'Varies', description: 'Use your settings' },
];

const DEFAULT_CONFIG: TrainingConfig = {
  method: 'lora',
  epochs: 3,
  learningRate: 0.0002,
  batchSize: 4,
  loraRank: 64,
  loraAlpha: 128,
  loraDropout: 0.05,
  gradientAccumulation: 4,
  warmupSteps: 100,
  weightDecay: 0.01,
  maxSeqLength: 2048,
  gpuType: 'auto',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

// NLP Training Goal Input
function TrainingGoalInput({
  goal,
  onGoalChange,
  onSubmit,
  isProcessing,
  selectedModel,
}: {
  goal: string;
  onGoalChange: (goal: string) => void;
  onSubmit: () => void;
  isProcessing: boolean;
  selectedModel: ModelWithRequirements | null;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && goal.trim()) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="tp-goal-input">
      <div className="tp-goal-header">
        <BrainIcon />
        <div>
          <h4>Describe Your Training Goal</h4>
          <p>What do you want this model to learn or specialize in?</p>
        </div>
      </div>

      {selectedModel && (
        <div className="tp-selected-model">
          <span className="tp-selected-model-label">Base Model:</span>
          <span className="tp-selected-model-name">{selectedModel.modelId}</span>
        </div>
      )}

      <div className="tp-goal-textarea-container">
        <textarea
          ref={textareaRef}
          value={goal}
          onChange={(e) => onGoalChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g., 'Fine-tune to be a legal contract analysis expert that can identify key clauses, risks, and obligations in business contracts'"
          className="tp-goal-textarea"
          rows={4}
        />
        <button
          className="tp-goal-submit"
          onClick={onSubmit}
          disabled={!goal.trim() || isProcessing || !selectedModel}
        >
          {isProcessing ? (
            <motion.div
              className="tp-spinner"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          ) : (
            <>
              <SparklesIcon />
              <span>Generate Plan</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Training Method Selector
function MethodSelector({
  modality,
  selectedMethod,
  onSelect,
}: {
  modality: ModalityType;
  selectedMethod: TrainingMethod;
  onSelect: (method: TrainingMethod) => void;
}) {
  const methods = TRAINING_METHODS[modality] || TRAINING_METHODS.llm;

  return (
    <div className="tp-method-selector">
      <h4>Training Method</h4>
      <div className="tp-method-grid">
        {methods.map((method) => (
          <button
            key={method.value}
            className={`tp-method-card ${selectedMethod === method.value ? 'tp-method-card--selected' : ''}`}
            onClick={() => onSelect(method.value)}
          >
            <span className="tp-method-label">{method.label}</span>
            <span className="tp-method-desc">{method.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Budget Controls
function BudgetControls({
  budget,
  onBudgetChange,
  hardStop,
  onHardStopChange,
  estimatedCost,
}: {
  budget: number;
  onBudgetChange: (budget: number) => void;
  hardStop: boolean;
  onHardStopChange: (hardStop: boolean) => void;
  estimatedCost: number;
}) {
  return (
    <div className="tp-budget-controls">
      <div className="tp-budget-header">
        <DollarIcon />
        <h4>Budget Controls</h4>
      </div>

      <div className="tp-budget-main">
        <div className="tp-budget-input-group">
          <label>Maximum Budget</label>
          <div className="tp-budget-input-wrapper">
            <span className="tp-budget-currency">$</span>
            <input
              type="number"
              min={10}
              max={1000}
              value={budget}
              onChange={(e) => onBudgetChange(Number(e.target.value))}
              className="tp-budget-input"
            />
          </div>
          <span className="tp-budget-estimate">
            Estimated: ${estimatedCost.toFixed(2)}
          </span>
        </div>

        <div className="tp-budget-options">
          <label className="tp-budget-toggle">
            <input
              type="checkbox"
              checked={hardStop}
              onChange={(e) => onHardStopChange(e.target.checked)}
            />
            <span className="tp-toggle-slider" />
            <span className="tp-toggle-label">
              Hard stop at budget limit (recommended)
            </span>
          </label>
        </div>

        {estimatedCost > budget && (
          <div className="tp-budget-warning">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>
              Estimated cost exceeds budget. Consider increasing budget or reducing training intensity.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Dataset Selector
function DatasetConfig({
  datasets,
  onToggleDataset,
  onUploadCustom,
}: {
  datasets: Dataset[];
  onToggleDataset: (id: string) => void;
  onUploadCustom: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  return (
    <div className="tp-dataset-config">
      <div className="tp-dataset-header">
        <h4>Training Data</h4>
        <p>KripTik auto-selected these datasets based on your goal</p>
      </div>

      <div className="tp-dataset-list">
        {datasets.map((dataset) => (
          <label key={dataset.id} className="tp-dataset-item">
            <input
              type="checkbox"
              checked={dataset.selected}
              onChange={() => onToggleDataset(dataset.id)}
            />
            <span className="tp-dataset-checkbox" />
            <div className="tp-dataset-info">
              <span className="tp-dataset-name">{dataset.name}</span>
              <span className="tp-dataset-samples">{dataset.samples.toLocaleString()} samples</span>
            </div>
          </label>
        ))}
      </div>

      <div className="tp-dataset-actions">
        <button
          className="tp-dataset-add-btn"
          onClick={() => setShowSearch(!showSearch)}
        >
          <PlusIcon />
          <span>Add HuggingFace Dataset</span>
        </button>
        <button className="tp-dataset-upload-btn" onClick={onUploadCustom}>
          <UploadIcon />
          <span>Upload Custom Data</span>
        </button>
      </div>

      <AnimatePresence>
        {showSearch && (
          <motion.div
            className="tp-dataset-search"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="tp-dataset-search-input">
              <SearchIcon />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search HuggingFace datasets..."
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Training Job Card
function TrainingJobCard({
  job,
  onExpand,
  onPause,
  onStop,
  onResume,
  isExpanded,
}: {
  job: TrainingJob;
  onExpand: () => void;
  onPause: () => void;
  onStop: () => void;
  onResume: () => void;
  isExpanded: boolean;
}) {
  const isRunning = job.status === 'training';
  const isPaused = job.status === 'paused';
  const isCompleted = job.status === 'completed';
  const progressPercent = (job.progress * 100).toFixed(1);

  return (
    <motion.div
      className={`tp-job-card ${isExpanded ? 'tp-job-card--expanded' : ''} ${isCompleted ? 'tp-job-card--completed' : ''}`}
      layout
    >
      <div className="tp-job-card-header" onClick={onExpand}>
        <div className="tp-job-card-title">
          <span className={`tp-job-status tp-job-status--${job.status}`}>
            {job.status}
          </span>
          <h4>{job.name}</h4>
        </div>
        <div className="tp-job-card-toggle">
          {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </div>
      </div>

      <div className="tp-job-card-progress">
        <div className="tp-job-progress-bar">
          <motion.div
            className="tp-job-progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <div className="tp-job-progress-info">
          <span className="tp-job-progress-percent">{progressPercent}%</span>
          <span className="tp-job-progress-epochs">
            Epoch {job.currentEpoch}/{job.totalEpochs}
          </span>
        </div>
      </div>

      <div className="tp-job-card-stats">
        <div className="tp-job-stat">
          <ClockIcon />
          <span>{formatDuration(job.elapsedSeconds)}</span>
        </div>
        <div className="tp-job-stat">
          <DollarIcon />
          <span>${(job.costSoFar / 100).toFixed(2)}</span>
        </div>
        <div className="tp-job-stat tp-job-stat--loss">
          <span>Loss: {job.currentLoss.toFixed(4)}</span>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="tp-job-card-details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="tp-job-details-grid">
              <div className="tp-job-detail">
                <span className="tp-job-detail-label">Base Model</span>
                <span className="tp-job-detail-value">{job.baseModel}</span>
              </div>
              <div className="tp-job-detail">
                <span className="tp-job-detail-label">Method</span>
                <span className="tp-job-detail-value">{job.method.toUpperCase()}</span>
              </div>
              <div className="tp-job-detail">
                <span className="tp-job-detail-label">Step</span>
                <span className="tp-job-detail-value">{job.currentStep}/{job.totalSteps}</span>
              </div>
              <div className="tp-job-detail">
                <span className="tp-job-detail-label">Best Loss</span>
                <span className="tp-job-detail-value">{job.bestLoss.toFixed(4)}</span>
              </div>
              <div className="tp-job-detail">
                <span className="tp-job-detail-label">Est. Remaining</span>
                <span className="tp-job-detail-value">{formatDuration(job.estimatedRemainingSeconds)}</span>
              </div>
              <div className="tp-job-detail">
                <span className="tp-job-detail-label">Budget</span>
                <span className="tp-job-detail-value">${(job.budgetLimit / 100).toFixed(0)}</span>
              </div>
            </div>

            <div className="tp-job-actions">
              {isRunning && (
                <>
                  <button className="tp-job-action tp-job-action--pause" onClick={onPause}>
                    <PauseIcon />
                    <span>Pause</span>
                  </button>
                  <button className="tp-job-action tp-job-action--stop" onClick={onStop}>
                    <StopIcon />
                    <span>Stop & Save</span>
                  </button>
                </>
              )}
              {isPaused && (
                <button className="tp-job-action tp-job-action--resume" onClick={onResume}>
                  <PlayIcon />
                  <span>Resume</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Training Completion Panel
function TrainingComplete({
  job,
  onTest,
  onSaveToKriptik,
  onPushToHub,
  onDownload,
  onDeployAndBuild,
  onBack,
}: {
  job: TrainingJob;
  onTest: () => void;
  onSaveToKriptik: () => void;
  onPushToHub: (repoName: string, isPrivate: boolean) => void;
  onDownload: () => void;
  onDeployAndBuild: () => void;
  onBack: () => void;
}) {
  const [hubRepoName, setHubRepoName] = useState(`${job.baseModel.split('/').pop()}-finetuned`);
  const [isPrivate, setIsPrivate] = useState(true);

  return (
    <motion.div
      className="tp-complete"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <button className="tp-back-btn" onClick={onBack}>
        <BackIcon />
        <span>Back to Training</span>
      </button>

      <div className="tp-complete-header">
        <div className="tp-complete-icon">
          <CheckIcon />
        </div>
        <h2>Training Complete</h2>
        <p>Your model "{job.name}" is ready!</p>
      </div>

      <div className="tp-complete-summary">
        <div className="tp-complete-stat">
          <span className="tp-complete-stat-value">{formatDuration(job.elapsedSeconds)}</span>
          <span className="tp-complete-stat-label">Total Time</span>
        </div>
        <div className="tp-complete-stat">
          <span className="tp-complete-stat-value">${(job.costSoFar / 100).toFixed(2)}</span>
          <span className="tp-complete-stat-label">Total Cost</span>
        </div>
        <div className="tp-complete-stat">
          <span className="tp-complete-stat-value">{job.bestLoss.toFixed(4)}</span>
          <span className="tp-complete-stat-label">Final Loss</span>
        </div>
      </div>

      {/* Test Model Section */}
      <div className="tp-complete-section">
        <h3>Test Your Model</h3>
        <p>Compare before and after to see the improvement</p>
        <button className="tp-complete-btn tp-complete-btn--test" onClick={onTest}>
          <TestIcon />
          <span>Run Comparison Test</span>
        </button>
      </div>

      {/* Save Options */}
      <div className="tp-complete-section">
        <h3>Save Your Model</h3>
        
        <div className="tp-complete-options">
          <button className="tp-complete-option" onClick={onSaveToKriptik}>
            <div className="tp-complete-option-icon">
              <SaveIcon />
            </div>
            <div className="tp-complete-option-content">
              <h4>Save to KripTik Profile</h4>
              <p>Keep in your account for future use in apps</p>
            </div>
          </button>

          <div className="tp-complete-option tp-complete-option--form">
            <div className="tp-complete-option-icon">
              <UploadIcon />
            </div>
            <div className="tp-complete-option-content">
              <h4>Push to HuggingFace</h4>
              <p>Publish to your HF account</p>
              <div className="tp-hub-form">
                <input
                  type="text"
                  value={hubRepoName}
                  onChange={(e) => setHubRepoName(e.target.value)}
                  placeholder="Repository name"
                  className="tp-hub-input"
                />
                <div className="tp-hub-visibility">
                  <label className={isPrivate ? 'active' : ''}>
                    <input
                      type="radio"
                      checked={isPrivate}
                      onChange={() => setIsPrivate(true)}
                    />
                    Private
                  </label>
                  <label className={!isPrivate ? 'active' : ''}>
                    <input
                      type="radio"
                      checked={!isPrivate}
                      onChange={() => setIsPrivate(false)}
                    />
                    Public
                  </label>
                </div>
                <button
                  className="tp-hub-push-btn"
                  onClick={() => onPushToHub(hubRepoName, isPrivate)}
                >
                  Push to Hub
                </button>
              </div>
            </div>
          </div>

          <button className="tp-complete-option" onClick={onDownload}>
            <div className="tp-complete-option-icon">
              <DownloadIcon />
            </div>
            <div className="tp-complete-option-content">
              <h4>Download Weights</h4>
              <p>Download adapter weights to your computer</p>
            </div>
          </button>
        </div>
      </div>

      {/* Deploy & Build */}
      <div className="tp-complete-section tp-complete-section--deploy">
        <button className="tp-complete-btn tp-complete-btn--deploy" onClick={onDeployAndBuild}>
          <RocketIcon />
          <span>Deploy & Build App</span>
        </button>
        <p>Deploy to RunPod and build an app using this model</p>
      </div>
    </motion.div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function TrainingPanel() {
  const { dock } = useOpenSourceStudioStore();
  const dockModels = dock.map(d => d.model);

  // View state
  const [view, setView] = useState<'overview' | 'configure' | 'progress' | 'complete'>('overview');
  const [selectedModel, setSelectedModel] = useState<ModelWithRequirements | null>(null);

  // Training configuration
  const [trainingGoal, setTrainingGoal] = useState('');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [config, setConfig] = useState<TrainingConfig>(DEFAULT_CONFIG);
  const [budget, setBudget] = useState(50);
  const [hardStop, setHardStop] = useState(true);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [intensityPreset, setIntensityPreset] = useState('balanced');

  // Training jobs
  const [jobs, setJobs] = useState<TrainingJob[]>([]);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [completedJob, _setCompletedJob] = useState<TrainingJob | null>(null);

  // Detect modality from selected model
  const detectModality = useCallback((model: ModelWithRequirements): ModalityType => {
    const task = model.pipeline_tag?.toLowerCase() || '';
    if (task.includes('image')) return 'image';
    if (task.includes('video')) return 'video';
    if (task.includes('audio') || task.includes('speech')) return 'audio';
    if (task.includes('multimodal') || task.includes('vision-language')) return 'multimodal';
    return 'llm';
  }, []);

  // Load training jobs
  useEffect(() => {
    const loadJobs = async () => {
      try {
        const response = await authenticatedFetch(`${API_URL}/api/training/jobs`);
        if (response.ok) {
          const data = await response.json();
          setJobs(data.jobs || []);
        }
      } catch (err) {
        console.error('Failed to load training jobs:', err);
      }
    };
    loadJobs();
    
    // Poll for updates
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  // Generate training plan from NLP
  const handleGeneratePlan = useCallback(async () => {
    if (!trainingGoal.trim() || !selectedModel) return;

    setIsGeneratingPlan(true);
    try {
      const response = await authenticatedFetch(`${API_URL}/api/training/generate-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: trainingGoal,
          modelId: selectedModel.modelId,
          modality: detectModality(selectedModel),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Apply generated config
        if (data.config) {
          setConfig(prev => ({ ...prev, ...data.config }));
        }
        if (data.datasets) {
          setDatasets(data.datasets);
        }
        if (data.estimatedCost) {
          setBudget(Math.ceil(data.estimatedCost * 1.2));
        }
        setView('configure');
      }
    } catch (err) {
      console.error('Failed to generate plan:', err);
    } finally {
      setIsGeneratingPlan(false);
    }
  }, [trainingGoal, selectedModel, detectModality]);

  // Start training
  const handleStartTraining = useCallback(async () => {
    if (!selectedModel) return;

    try {
      const response = await authenticatedFetch(`${API_URL}/api/training/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trainingGoal.slice(0, 50) || `${selectedModel.modelId.split('/').pop()}-finetuned`,
          modelId: selectedModel.modelId,
          goal: trainingGoal,
          config,
          datasets: datasets.filter(d => d.selected).map(d => d.id),
          budgetLimit: budget * 100,
          hardStop,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setJobs(prev => [data.job, ...prev]);
        setView('progress');
      }
    } catch (err) {
      console.error('Failed to start training:', err);
    }
  }, [selectedModel, trainingGoal, config, datasets, budget, hardStop]);

  // Job actions
  const handlePauseJob = async (jobId: string) => {
    await authenticatedFetch(`${API_URL}/api/training/jobs/${jobId}/pause`, { method: 'POST' });
  };

  const handleStopJob = async (jobId: string) => {
    await authenticatedFetch(`${API_URL}/api/training/jobs/${jobId}/stop`, { method: 'POST' });
  };

  const handleResumeJob = async (jobId: string) => {
    await authenticatedFetch(`${API_URL}/api/training/jobs/${jobId}/resume`, { method: 'POST' });
  };

  // Completion actions
  const handleTest = () => {
    // Navigate to test comparison UI
    console.log('Opening test comparison...');
  };

  const handleSaveToKriptik = async () => {
    if (!completedJob) return;
    await authenticatedFetch(`${API_URL}/api/training/models/${completedJob.id}/save`, { method: 'POST' });
  };

  const handlePushToHub = async (repoName: string, isPrivate: boolean) => {
    if (!completedJob) return;
    await authenticatedFetch(`${API_URL}/api/training/models/${completedJob.id}/push-to-hub`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoName, private: isPrivate }),
    });
  };

  const handleDownload = async () => {
    if (!completedJob) return;
    window.open(`${API_URL}/api/training/models/${completedJob.id}/download`, '_blank');
  };

  const handleDeployAndBuild = () => {
    // Navigate to deploy with model attached
    console.log('Deploying and building app...');
  };

  // Render based on view
  const renderContent = () => {
    // Completion view
    if (view === 'complete' && completedJob) {
      return (
        <TrainingComplete
          job={completedJob}
          onTest={handleTest}
          onSaveToKriptik={handleSaveToKriptik}
          onPushToHub={handlePushToHub}
          onDownload={handleDownload}
          onDeployAndBuild={handleDeployAndBuild}
          onBack={() => setView('overview')}
        />
      );
    }

    // Configuration view
    if (view === 'configure' && selectedModel) {
      const modality = detectModality(selectedModel);
      
      return (
        <div className="tp-configure">
          <button className="tp-back-btn" onClick={() => setView('overview')}>
            <BackIcon />
            <span>Back</span>
          </button>

          <div className="tp-configure-header">
            <h3>Configure Training</h3>
            <p>Review and customize your training parameters</p>
          </div>

          <div className="tp-configure-grid">
            <div className="tp-configure-main">
              <MethodSelector
                modality={modality}
                selectedMethod={config.method}
                onSelect={(method) => setConfig(prev => ({ ...prev, method }))}
              />

              <DatasetConfig
                datasets={datasets}
                onToggleDataset={(id) => {
                  setDatasets(prev =>
                    prev.map(d => d.id === id ? { ...d, selected: !d.selected } : d)
                  );
                }}
                onUploadCustom={() => console.log('Upload custom data')}
              />

              {/* Intensity Presets */}
              <div className="tp-intensity">
                <h4>Training Intensity</h4>
                <div className="tp-intensity-grid">
                  {INTENSITY_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      className={`tp-intensity-card ${intensityPreset === preset.id ? 'tp-intensity-card--selected' : ''}`}
                      onClick={() => setIntensityPreset(preset.id)}
                    >
                      <span className="tp-intensity-label">{preset.label}</span>
                      <span className="tp-intensity-cost">{preset.cost}</span>
                      <span className="tp-intensity-time">{preset.time}</span>
                      <span className="tp-intensity-desc">{preset.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Config (expandable) */}
              <details className="tp-advanced">
                <summary>
                  <span>Advanced Parameters</span>
                  <ExpandIcon />
                </summary>
                <div className="tp-advanced-grid">
                  <div className="tp-param">
                    <label>Epochs</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={config.epochs}
                      onChange={(e) => setConfig(prev => ({ ...prev, epochs: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="tp-param">
                    <label>Learning Rate</label>
                    <select
                      value={config.learningRate}
                      onChange={(e) => setConfig(prev => ({ ...prev, learningRate: Number(e.target.value) }))}
                    >
                      <option value={0.00001}>1e-5</option>
                      <option value={0.00005}>5e-5</option>
                      <option value={0.0001}>1e-4</option>
                      <option value={0.0002}>2e-4</option>
                      <option value={0.0005}>5e-4</option>
                      <option value={0.001}>1e-3</option>
                    </select>
                  </div>
                  <div className="tp-param">
                    <label>Batch Size</label>
                    <select
                      value={config.batchSize}
                      onChange={(e) => setConfig(prev => ({ ...prev, batchSize: Number(e.target.value) }))}
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={4}>4</option>
                      <option value={8}>8</option>
                      <option value={16}>16</option>
                    </select>
                  </div>
                  <div className="tp-param">
                    <label>LoRA Rank</label>
                    <select
                      value={config.loraRank}
                      onChange={(e) => setConfig(prev => ({ ...prev, loraRank: Number(e.target.value) }))}
                    >
                      <option value={8}>8</option>
                      <option value={16}>16</option>
                      <option value={32}>32</option>
                      <option value={64}>64</option>
                      <option value={128}>128</option>
                    </select>
                  </div>
                  <div className="tp-param">
                    <label>LoRA Alpha</label>
                    <input
                      type="number"
                      min={8}
                      max={256}
                      value={config.loraAlpha}
                      onChange={(e) => setConfig(prev => ({ ...prev, loraAlpha: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="tp-param">
                    <label>Gradient Accumulation</label>
                    <select
                      value={config.gradientAccumulation}
                      onChange={(e) => setConfig(prev => ({ ...prev, gradientAccumulation: Number(e.target.value) }))}
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={4}>4</option>
                      <option value={8}>8</option>
                      <option value={16}>16</option>
                    </select>
                  </div>
                </div>
              </details>
            </div>

            <div className="tp-configure-sidebar">
              <BudgetControls
                budget={budget}
                onBudgetChange={setBudget}
                hardStop={hardStop}
                onHardStopChange={setHardStop}
                estimatedCost={35} // This would be calculated
              />

              {/* Cost Estimate */}
              <div className="tp-cost-estimate">
                <h4>Estimated Cost</h4>
                <div className="tp-cost-range">
                  <span className="tp-cost-low">$35</span>
                  <span className="tp-cost-sep">-</span>
                  <span className="tp-cost-high">$55</span>
                </div>
                <div className="tp-cost-details">
                  <span>GPU: 4x A100 80GB @ $4.47/hr</span>
                  <span>Time: ~8-12 hours</span>
                </div>
              </div>

              {/* Start Training Button */}
              <button className="tp-start-btn" onClick={handleStartTraining}>
                <RocketIcon />
                <span>Start Training</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Progress view
    if (view === 'progress') {
      return (
        <div className="tp-progress">
          <button className="tp-back-btn" onClick={() => setView('overview')}>
            <BackIcon />
            <span>Back to Overview</span>
          </button>

          <div className="tp-progress-header">
            <h3>Training Jobs</h3>
            <p>{jobs.filter(j => j.status === 'training').length} active, {jobs.filter(j => j.status === 'completed').length} completed</p>
          </div>

          <div className="tp-jobs-list">
            {jobs.length === 0 ? (
              <div className="tp-jobs-empty">
                <p>No training jobs yet. Start a new training to see progress here.</p>
              </div>
            ) : (
              jobs.map((job) => (
                <TrainingJobCard
                  key={job.id}
                  job={job}
                  isExpanded={expandedJobId === job.id}
                  onExpand={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                  onPause={() => handlePauseJob(job.id)}
                  onStop={() => handleStopJob(job.id)}
                  onResume={() => handleResumeJob(job.id)}
                />
              ))
            )}
          </div>
        </div>
      );
    }

    // Overview (default)
    return (
      <div className="tp-overview">
        <div className="tp-overview-header">
          <h3>Training & Fine-Tuning</h3>
          <p>Train LLM, Image, Video, and Audio models with full parameter control</p>
        </div>

        {/* Quick actions */}
        <div className="tp-quick-actions">
          {jobs.filter(j => j.status === 'training' || j.status === 'paused').length > 0 && (
            <button className="tp-quick-action" onClick={() => setView('progress')}>
              <div className="tp-quick-action-badge">
                {jobs.filter(j => j.status === 'training').length}
              </div>
              <span>View Active Jobs</span>
            </button>
          )}
        </div>

        {/* Model Selection */}
        {dockModels.length > 0 ? (
          <div className="tp-model-selection">
            <h4>Select Model to Train</h4>
            <div className="tp-model-grid">
              {dockModels.map((model) => (
                <button
                  key={model.id}
                  className={`tp-model-card ${selectedModel?.id === model.id ? 'tp-model-card--selected' : ''}`}
                  onClick={() => setSelectedModel(model)}
                >
                  <span className="tp-model-name">{model.modelId.split('/').pop()}</span>
                  <span className="tp-model-task">{model.pipeline_tag || 'Unknown'}</span>
                  {model.estimatedVRAM && (
                    <span className="tp-model-vram">{model.estimatedVRAM} GB VRAM</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="tp-no-models">
            <p>Drag models to the dock in the Open Source tab to start training</p>
          </div>
        )}

        {/* Training Goal Input */}
        {selectedModel && (
          <TrainingGoalInput
            goal={trainingGoal}
            onGoalChange={setTrainingGoal}
            onSubmit={handleGeneratePlan}
            isProcessing={isGeneratingPlan}
            selectedModel={selectedModel}
          />
        )}
      </div>
    );
  };

  return (
    <div className="training-panel">
      {renderContent()}
    </div>
  );
}

export default TrainingPanel;
