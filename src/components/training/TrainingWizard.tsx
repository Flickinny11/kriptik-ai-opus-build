/**
 * Training Wizard - Multi-step training job configuration
 *
 * Guides users through modality selection, model selection,
 * dataset configuration, and training parameters.
 * 
 * NO Lucide React icons - custom SVG icons only
 * 3D Photorealistic Liquid Glass Design System
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTrainingStore, type ModelModality, type TrainingMethod } from '@/store/useTrainingStore';
import { ModelSelector } from './ModelSelector';
import { DatasetConfigurator } from './DatasetConfigurator';
import { TrainingConfig, DEFAULT_CONFIGS, type TrainingConfigValues } from './TrainingConfig';
import './TrainingWizard.css';

// =============================================================================
// TYPES
// =============================================================================

interface BudgetConfig {
  maxDollars: number;
  hardStop: boolean;
  softWarningPercent: number;
  autoExtend: boolean;
}

// =============================================================================
// CUSTOM SVG ICONS - No Lucide React
// =============================================================================

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M5 12h14M14 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SparklesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12 3v2m0 14v2M5.5 5.5l1.5 1.5m10-1.5l-1.5 1.5M5.5 18.5l1.5-1.5m10 1.5l-1.5-1.5M3 12h2m14 0h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BrainIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
    <path d="M12 2a4 4 0 00-4 4c0 1.1.45 2.1 1.17 2.83L8 10a4 4 0 00-4 4c0 1.66 1 3.08 2.44 3.69L6 19a2 2 0 002 2h8a2 2 0 002-2l-.44-1.31A4 4 0 0020 14a4 4 0 00-4-4l-1.17-1.17A4 4 0 0016 6a4 4 0 00-4-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="9" cy="9" r="1" fill="currentColor" />
    <circle cx="15" cy="9" r="1" fill="currentColor" />
    <path d="M12 12v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const ImageIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const VideoIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <polygon points="10,8 16,12 10,16" fill="currentColor" />
    <path d="M2 8h20M2 16h20" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const AudioIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
    <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const LayersIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
    <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DollarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M12 6v12M8 10h8M8 14h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const AlertIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// =============================================================================
// TYPES & CONFIG
// =============================================================================

const MODALITY_CONFIG: Record<ModelModality, {
  icon: () => JSX.Element;
  label: string;
  description: string;
  color: string;
  methods: { value: TrainingMethod; label: string; description: string }[];
}> = {
  llm: {
    icon: BrainIcon,
    label: 'LLM / Text',
    description: 'Train language models for text generation, chat, and coding',
    color: '#3B82F6',
    methods: [
      { value: 'qlora', label: 'QLoRA', description: 'Quantized LoRA - Most efficient' },
      { value: 'lora', label: 'LoRA', description: 'Low-Rank Adaptation - Balanced' },
      { value: 'full', label: 'Full Fine-tune', description: 'Full model - Best quality' },
      { value: 'dpo', label: 'DPO', description: 'Direct Preference Optimization' },
      { value: 'rlhf', label: 'RLHF', description: 'Reinforcement Learning from Human Feedback' },
    ],
  },
  image: {
    icon: ImageIcon,
    label: 'Image',
    description: 'Train image generation models like SDXL, Flux, and SD3.5',
    color: '#8B5CF6',
    methods: [
      { value: 'lora', label: 'LoRA', description: 'Style and concept training' },
      { value: 'dreambooth', label: 'DreamBooth', description: 'Subject-driven generation' },
      { value: 'textual_inversion', label: 'Textual Inversion', description: 'Learn new concepts' },
    ],
  },
  video: {
    icon: VideoIcon,
    label: 'Video',
    description: 'Train video generation models like Wan2.1, HunyuanVideo',
    color: '#EC4899',
    methods: [
      { value: 'lora', label: 'LoRA', description: 'Style and motion training' },
    ],
  },
  audio: {
    icon: AudioIcon,
    label: 'Audio',
    description: 'Train voice cloning and audio generation models',
    color: '#F59E0B',
    methods: [
      { value: 'voice_clone', label: 'Voice Clone', description: 'Clone voices with XTTS or WhisperSpeech' },
      { value: 'style_transfer', label: 'Style Transfer', description: 'MusicGen style adaptation' },
      { value: 'lora', label: 'LoRA', description: 'General audio model fine-tuning' },
    ],
  },
  multimodal: {
    icon: LayersIcon,
    label: 'Multimodal',
    description: 'Train models that understand multiple modalities',
    color: '#10B981',
    methods: [
      { value: 'lora', label: 'LoRA', description: 'Efficient multimodal training' },
    ],
  },
};

type WizardStep = 'modality' | 'model' | 'dataset' | 'config' | 'budget' | 'review';
const WIZARD_STEPS: WizardStep[] = ['modality', 'model', 'dataset', 'config', 'budget', 'review'];

interface TrainingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (jobId: string) => void;
}

// =============================================================================
// BUDGET CONTROLS COMPONENT
// =============================================================================

function BudgetControls({
  budget,
  onBudgetChange,
  estimatedCost,
  gpuType,
}: {
  budget: BudgetConfig;
  onBudgetChange: (budget: BudgetConfig) => void;
  estimatedCost: number;
  gpuType: string;
}) {
  return (
    <div className="tw-budget-controls">
      <div className="tw-budget-header">
        <h4>Budget Controls</h4>
        <p>Set spending limits to prevent unexpected charges</p>
      </div>

      <div className="tw-budget-grid">
        {/* Max Budget */}
        <div className="tw-budget-card tw-budget-card--primary">
          <div className="tw-budget-card-icon">
            <DollarIcon />
          </div>
          <div className="tw-budget-card-content">
            <label>Maximum Budget</label>
            <div className="tw-budget-input-group">
              <span className="tw-budget-currency">$</span>
              <input
                type="number"
                min={1}
                max={10000}
                value={budget.maxDollars}
                onChange={(e) => onBudgetChange({ ...budget, maxDollars: Number(e.target.value) })}
                className="tw-budget-input"
              />
            </div>
            <span className="tw-budget-hint">
              Estimated: ${estimatedCost.toFixed(2)} ({gpuType})
            </span>
          </div>
        </div>

        {/* Warning Threshold */}
        <div className="tw-budget-card">
          <div className="tw-budget-card-content">
            <label>Warning at</label>
            <div className="tw-budget-slider-group">
              <input
                type="range"
                min={50}
                max={95}
                step={5}
                value={budget.softWarningPercent}
                onChange={(e) => onBudgetChange({ ...budget, softWarningPercent: Number(e.target.value) })}
                className="tw-budget-slider"
              />
              <span className="tw-budget-percent">{budget.softWarningPercent}%</span>
            </div>
            <span className="tw-budget-hint">
              Alert when ${((budget.maxDollars * budget.softWarningPercent) / 100).toFixed(2)} spent
            </span>
          </div>
        </div>

        {/* Hard Stop Toggle */}
        <div className="tw-budget-card">
          <div className="tw-budget-card-content">
            <label>Hard Stop</label>
            <div className="tw-budget-toggle-row">
              <button
                className={`tw-budget-toggle ${budget.hardStop ? 'tw-budget-toggle--active' : ''}`}
                onClick={() => onBudgetChange({ ...budget, hardStop: !budget.hardStop })}
              >
                <span className="tw-budget-toggle-knob" />
              </button>
              <span className="tw-budget-toggle-label">
                {budget.hardStop ? 'Stop training at budget limit' : 'Allow overrun with warning'}
              </span>
            </div>
          </div>
        </div>

        {/* Auto-Extend */}
        <div className="tw-budget-card">
          <div className="tw-budget-card-content">
            <label>Auto-Extend</label>
            <div className="tw-budget-toggle-row">
              <button
                className={`tw-budget-toggle ${budget.autoExtend ? 'tw-budget-toggle--active' : ''}`}
                onClick={() => onBudgetChange({ ...budget, autoExtend: !budget.autoExtend })}
                disabled={budget.hardStop}
              >
                <span className="tw-budget-toggle-knob" />
              </button>
              <span className="tw-budget-toggle-label">
                {budget.autoExtend ? 'Ask to extend if more epochs needed' : 'No auto-extension'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Banner */}
      {estimatedCost > budget.maxDollars && (
        <div className="tw-budget-warning">
          <AlertIcon />
          <span>
            Estimated cost (${estimatedCost.toFixed(2)}) exceeds budget (${budget.maxDollars}).
            Consider increasing budget or reducing epochs.
          </span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function TrainingWizard({ isOpen, onClose, onComplete }: TrainingWizardProps) {
  const {
    wizardStep,
    wizardData,
    setWizardStep,
    setWizardData,
    resetWizard,
    searchModels,
    selectModel,
    getGPURecommendation,
    createJob,
    startJob,
    isLoading,
    error,
    setError,
  } = useTrainingStore();

  const [jobName, setJobName] = useState('');
  const [budget, setBudget] = useState({
    maxDollars: 50,
    hardStop: true,
    softWarningPercent: 80,
    autoExtend: false,
  });
  const [autoSaveToHub, setAutoSaveToHub] = useState(true);
  const [hubRepoName, setHubRepoName] = useState('');

  const currentStepIndex = WIZARD_STEPS.indexOf(wizardStep);

  useEffect(() => {
    if (!isOpen) {
      resetWizard();
      setJobName('');
      setBudget({ maxDollars: 50, hardStop: true, softWarningPercent: 80, autoExtend: false });
    }
  }, [isOpen, resetWizard]);

  // Get GPU recommendation when entering config step
  useEffect(() => {
    if (wizardStep === 'config' && wizardData.modality && wizardData.method && wizardData.baseModel) {
      getGPURecommendation();
    }
  }, [wizardStep, wizardData.modality, wizardData.method, wizardData.baseModel, getGPURecommendation]);

  const goBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setWizardStep(WIZARD_STEPS[currentStepIndex - 1]);
    }
  }, [currentStepIndex, setWizardStep]);

  const goNext = useCallback(() => {
    if (currentStepIndex < WIZARD_STEPS.length - 1) {
      setWizardStep(WIZARD_STEPS[currentStepIndex + 1]);
    }
  }, [currentStepIndex, setWizardStep]);

  const canProceed = useCallback(() => {
    switch (wizardStep) {
      case 'modality':
        return !!wizardData.modality && !!wizardData.method;
      case 'model':
        return !!wizardData.baseModel;
      case 'dataset':
        return !!wizardData.datasetConfig;
      case 'config':
        return !!wizardData.trainingConfig;
      case 'budget':
        return budget.maxDollars > 0;
      case 'review':
        return true;
      default:
        return false;
    }
  }, [wizardStep, wizardData, budget]);

  const handleModalitySelect = (modality: ModelModality) => {
    setWizardData({ modality, method: undefined });
  };

  const handleMethodSelect = (method: TrainingMethod) => {
    setWizardData({ method });
  };

  const handleTrainingConfigChange = (config: TrainingConfigValues) => {
    setWizardData({ trainingConfig: config as any });
  };

  const handleStartTraining = async () => {
    setWizardData({
      jobName: jobName || undefined,
      budgetLimit: budget.maxDollars * 100, // Convert to cents
      autoSaveToHub,
      hubRepoName: hubRepoName || undefined,
    });
    
    const jobId = await createJob();
    if (jobId) {
      await startJob(jobId);
      onComplete?.(jobId);
      onClose();
    }
  };

  const estimatedCost = wizardData.gpuRecommendation?.estimatedCost || 0;
  const estimatedTime = wizardData.gpuRecommendation?.estimatedTime || 'Unknown';

  if (!isOpen) return null;

  return (
    <div className="tw-overlay">
      <motion.div
        className="tw-container"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      >
        {/* Glass layers for 3D effect */}
        <div className="tw-glass-layer tw-glass-layer--1" />
        <div className="tw-glass-layer tw-glass-layer--2" />
        
        {/* Header */}
        <header className="tw-header">
          <div className="tw-header-title">
            <span className="tw-header-icon"><SparklesIcon /></span>
            <div>
              <h2>New Training Job</h2>
              <p>Step {currentStepIndex + 1} of {WIZARD_STEPS.length}</p>
            </div>
          </div>
          <button className="tw-close-btn" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>

        {/* Progress indicator */}
        <div className="tw-progress">
          {WIZARD_STEPS.map((step, index) => (
            <div key={step} className="tw-progress-item">
              <div
                className={`tw-progress-step ${
                  index < currentStepIndex ? 'tw-progress-step--complete' :
                  index === currentStepIndex ? 'tw-progress-step--active' : ''
                }`}
              >
                {index < currentStepIndex ? <CheckCircleIcon /> : index + 1}
              </div>
              {index < WIZARD_STEPS.length - 1 && (
                <div className={`tw-progress-line ${index < currentStepIndex ? 'tw-progress-line--complete' : ''}`} />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="tw-content">
          {error && (
            <div className="tw-error">
              <AlertIcon />
              <span>{error}</span>
              <button onClick={() => setError(null)}>Dismiss</button>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={wizardStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Step 1: Modality Selection */}
              {wizardStep === 'modality' && (
                <div className="tw-step">
                  <div className="tw-step-header">
                    <h3>Choose Modality</h3>
                    <p>What type of model do you want to train?</p>
                  </div>

                  <div className="tw-modality-grid">
                    {(Object.entries(MODALITY_CONFIG) as [ModelModality, typeof MODALITY_CONFIG[ModelModality]][]).map(
                      ([modality, config]) => {
                        const Icon = config.icon;
                        const isSelected = wizardData.modality === modality;
                        return (
                          <button
                            key={modality}
                            onClick={() => handleModalitySelect(modality)}
                            className={`tw-modality-card ${isSelected ? 'tw-modality-card--selected' : ''}`}
                            style={{ '--accent-color': config.color } as React.CSSProperties}
                          >
                            <div className="tw-modality-icon">
                              <Icon />
                            </div>
                            <div className="tw-modality-label">{config.label}</div>
                            <div className="tw-modality-desc">{config.description}</div>
                          </button>
                        );
                      }
                    )}
                  </div>

                  {/* Method selection */}
                  {wizardData.modality && (
                    <div className="tw-method-section">
                      <h4>Training Method</h4>
                      <div className="tw-method-grid">
                        {MODALITY_CONFIG[wizardData.modality].methods.map((method) => (
                          <button
                            key={method.value}
                            onClick={() => handleMethodSelect(method.value)}
                            className={`tw-method-card ${wizardData.method === method.value ? 'tw-method-card--selected' : ''}`}
                          >
                            <div className="tw-method-label">{method.label}</div>
                            <div className="tw-method-desc">{method.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Model Selection */}
              {wizardStep === 'model' && wizardData.modality && (
                <div className="tw-step">
                  <div className="tw-step-header">
                    <h3>Select Base Model</h3>
                    <p>Choose a model from HuggingFace to fine-tune</p>
                  </div>
                  <ModelSelector
                    modality={wizardData.modality}
                    method={wizardData.method}
                    selectedModel={wizardData.baseModelInfo}
                    onSelect={selectModel}
                    onSearch={(query) => searchModels(query, wizardData.modality!)}
                  />
                </div>
              )}

              {/* Step 3: Dataset Configuration */}
              {wizardStep === 'dataset' && wizardData.modality && (
                <div className="tw-step">
                  <div className="tw-step-header">
                    <h3>Configure Dataset</h3>
                    <p>Upload or select a dataset for training</p>
                  </div>
                  <DatasetConfigurator
                    modality={wizardData.modality}
                    config={wizardData.datasetConfig}
                    onChange={(config) => setWizardData({ datasetConfig: config })}
                  />
                </div>
              )}

              {/* Step 4: Training Configuration */}
              {wizardStep === 'config' && wizardData.modality && wizardData.method && (
                <div className="tw-step">
                  <div className="tw-step-header">
                    <h3>Training Parameters</h3>
                    <p>Configure hyperparameters and GPU settings</p>
                  </div>
                  <TrainingConfig
                    modality={wizardData.modality}
                    method={wizardData.method}
                    config={wizardData.trainingConfig || DEFAULT_CONFIGS[wizardData.modality] as TrainingConfigValues}
                    gpuRecommendation={wizardData.gpuRecommendation}
                    onChange={handleTrainingConfigChange}
                  />
                </div>
              )}

              {/* Step 5: Budget Controls */}
              {wizardStep === 'budget' && (
                <div className="tw-step">
                  <div className="tw-step-header">
                    <h3>Budget &amp; Auto-Save</h3>
                    <p>Set spending limits and model preservation options</p>
                  </div>
                  
                  <BudgetControls
                    budget={budget}
                    onBudgetChange={setBudget}
                    estimatedCost={estimatedCost}
                    gpuType={wizardData.trainingConfig?.gpuType || 'Auto'}
                  />

                  <div className="tw-autosave-section">
                    <h4>Model Auto-Save</h4>
                    <p>Ensure your trained model is preserved</p>
                    
                    <div className="tw-autosave-options">
                      <div className="tw-autosave-toggle">
                        <button
                          className={`tw-budget-toggle ${autoSaveToHub ? 'tw-budget-toggle--active' : ''}`}
                          onClick={() => setAutoSaveToHub(!autoSaveToHub)}
                        >
                          <span className="tw-budget-toggle-knob" />
                        </button>
                        <span>Auto-save to HuggingFace Hub</span>
                      </div>
                      
                      {autoSaveToHub && (
                        <div className="tw-hub-repo-input">
                          <label>Repository Name</label>
                          <input
                            type="text"
                            value={hubRepoName}
                            onChange={(e) => setHubRepoName(e.target.value)}
                            placeholder={`${wizardData.baseModel?.split('/').pop() || 'model'}-finetuned`}
                          />
                        </div>
                      )}
                    </div>

                    <div className="tw-autosave-info">
                      <strong>Checkpoints are automatically saved:</strong>
                      <ul>
                        <li>Every epoch checkpoint</li>
                        <li>Best model (lowest loss)</li>
                        <li>Final model on completion</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 6: Review */}
              {wizardStep === 'review' && (
                <div className="tw-step">
                  <div className="tw-step-header">
                    <h3>Review &amp; Start</h3>
                    <p>Review your configuration and start training</p>
                  </div>

                  <div className="tw-review-name">
                    <label>Job Name (optional)</label>
                    <input
                      type="text"
                      value={jobName}
                      onChange={(e) => setJobName(e.target.value)}
                      placeholder={`${wizardData.modality}-${wizardData.method}-${Date.now()}`}
                    />
                  </div>

                  <div className="tw-review-grid">
                    <SummaryCard label="Modality" value={wizardData.modality || '-'} />
                    <SummaryCard label="Method" value={wizardData.method || '-'} />
                    <SummaryCard label="Base Model" value={wizardData.baseModel?.split('/').pop() || '-'} />
                    <SummaryCard label="Dataset" value={wizardData.datasetConfig?.source || '-'} />
                    <SummaryCard label="Epochs" value={String(wizardData.trainingConfig?.epochs || '-')} />
                    <SummaryCard label="Batch Size" value={String(wizardData.trainingConfig?.batchSize || '-')} />
                    <SummaryCard label="GPU" value={wizardData.trainingConfig?.gpuType || 'Auto'} />
                    <SummaryCard label="Budget" value={`$${budget.maxDollars}`} highlight />
                    <SummaryCard label="Est. Cost" value={`$${estimatedCost.toFixed(2)}/hr`} />
                    <SummaryCard label="Est. Time" value={estimatedTime} />
                    <SummaryCard label="Auto-Save" value={autoSaveToHub ? 'HuggingFace Hub' : 'Local Only'} />
                    <SummaryCard label="Hard Stop" value={budget.hardStop ? 'Enabled' : 'Disabled'} />
                  </div>

                  {wizardData.gpuRecommendation && (
                    <div className="tw-review-recommendation">
                      <p>{wizardData.gpuRecommendation.reasoning}</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="tw-footer">
          <button
            onClick={goBack}
            disabled={currentStepIndex === 0}
            className="tw-btn tw-btn--secondary"
          >
            <ArrowLeftIcon />
            Back
          </button>

          {wizardStep === 'review' ? (
            <button
              onClick={handleStartTraining}
              disabled={isLoading}
              className="tw-btn tw-btn--primary tw-btn--start"
            >
              {isLoading ? (
                <>
                  <div className="tw-spinner" />
                  Starting...
                </>
              ) : (
                <>
                  <SparklesIcon />
                  Start Training
                </>
              )}
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={!canProceed()}
              className="tw-btn tw-btn--primary"
            >
              Next
              <ArrowRightIcon />
            </button>
          )}
        </footer>
      </motion.div>
    </div>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`tw-summary-card ${highlight ? 'tw-summary-card--highlight' : ''}`}>
      <div className="tw-summary-label">{label}</div>
      <div className="tw-summary-value">{value}</div>
    </div>
  );
}

export default TrainingWizard;
