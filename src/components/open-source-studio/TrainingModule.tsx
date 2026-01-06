/**
 * Training Module - Fine-Tuning Workflow Container
 * 
 * Orchestrates the complete training workflow from dataset selection to completion.
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 4).
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrainingConfig, type TrainingParams } from './TrainingConfig';
import { DatasetSelector, type HuggingFaceDataset } from './DatasetSelector';
import { TrainingProgress, type TrainingMetrics, type TrainingStatus } from './TrainingProgress';
import { useOpenSourceStudioStore, type ModelWithRequirements } from '@/store/useOpenSourceStudioStore';
import { authenticatedFetch } from '@/lib/api-config';
import './TrainingModule.css';

// =============================================================================
// TYPES
// =============================================================================

type TrainingStep = 'dataset' | 'config' | 'training' | 'completed';

interface ActiveJob {
  id: string;
  status: TrainingStatus;
  metrics: TrainingMetrics | null;
  logs: string[];
  outputModelUrl?: string;
}

interface TrainingModuleProps {
  model: ModelWithRequirements;
  onClose: () => void;
  onComplete: (outputModelUrl: string) => void;
}

// =============================================================================
// ICONS
// =============================================================================

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DatasetIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" strokeWidth="2" />
    <path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3" stroke="currentColor" strokeWidth="2" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const ConfigIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const TrainIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <polygon points="5 3 19 12 5 21 5 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// =============================================================================
// COMPONENT
// =============================================================================

export function TrainingModule({ model, onClose, onComplete }: TrainingModuleProps) {
  const [step, setStep] = useState<TrainingStep>('dataset');
  const [selectedDataset, setSelectedDataset] = useState<HuggingFaceDataset | null>(null);
  const [_trainingParams, setTrainingParams] = useState<TrainingParams | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { hfUsername } = useOpenSourceStudioStore();

  // Poll for job updates
  useEffect(() => {
    if (!activeJob || !['queued', 'provisioning', 'downloading', 'training', 'saving'].includes(activeJob.status)) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await authenticatedFetch(`/api/training/jobs/${activeJob.id}`);
        if (response.ok) {
          const data = await response.json();
          setActiveJob(prev => ({
            ...prev!,
            status: data.job.status,
            metrics: data.job.metrics,
            logs: JSON.parse(data.job.logs || '[]'),
            outputModelUrl: data.job.outputModelUrl,
          }));

          if (data.job.status === 'completed' && data.job.outputModelUrl) {
            setStep('completed');
          } else if (data.job.status === 'failed') {
            setError(data.job.error || 'Training failed');
          }
        }
      } catch (err) {
        console.error('[TrainingModule] Poll error:', err);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [activeJob?.id, activeJob?.status]);

  /**
   * Handle dataset selection
   */
  const handleDatasetSelect = useCallback((dataset: HuggingFaceDataset) => {
    setSelectedDataset(dataset);
    setStep('config');
  }, []);

  /**
   * Start training job
   */
  const handleStartTraining = useCallback(async (params: TrainingParams) => {
    setIsStarting(true);
    setError(null);
    setTrainingParams(params);

    try {
      const response = await authenticatedFetch('/api/training/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: model.modelId,
          modelName: model.modelId.split('/').pop(),
          trainingType: params.type,
          epochs: params.epochs,
          learningRate: params.learningRate,
          batchSize: params.batchSize,
          loraRank: params.loraRank,
          loraAlpha: params.loraAlpha,
          loraDropout: params.loraDropout,
          targetModules: params.targetModules,
          datasetId: selectedDataset?.id,
          outputRepoName: `${hfUsername}/${params.modelName}`,
          autoSaveToHub: params.autoSaveToHub,
          budgetLimit: params.budgetLimit,
          gpuType: 'NVIDIA GeForce RTX 4090', // Default, can be made configurable
          gpuCount: 1,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start training');
      }

      const data = await response.json();
      setActiveJob({
        id: data.job.id,
        status: data.job.status,
        metrics: null,
        logs: [],
      });
      setStep('training');
    } catch (err) {
      console.error('[TrainingModule] Start training error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start training');
    } finally {
      setIsStarting(false);
    }
  }, [model.modelId, selectedDataset, hfUsername]);

  /**
   * Stop training
   */
  const handleStopTraining = useCallback(async () => {
    if (!activeJob) return;

    try {
      await authenticatedFetch(`/api/training/jobs/${activeJob.id}/stop`, {
        method: 'POST',
      });
      setActiveJob(prev => prev ? { ...prev, status: 'stopped' } : null);
    } catch (err) {
      console.error('[TrainingModule] Stop training error:', err);
    }
  }, [activeJob]);

  /**
   * View model on HuggingFace
   */
  const handleViewOnHub = useCallback(() => {
    if (activeJob?.outputModelUrl) {
      window.open(activeJob.outputModelUrl, '_blank');
      onComplete(activeJob.outputModelUrl);
    }
  }, [activeJob, onComplete]);

  /**
   * Go back to previous step
   */
  const handleBack = useCallback(() => {
    if (step === 'config') {
      setStep('dataset');
    } else if (step === 'completed') {
      setStep('training');
    }
  }, [step]);

  /**
   * Skip dataset selection (use default)
   */
  const handleSkipDataset = useCallback(() => {
    setSelectedDataset(null);
    setStep('config');
  }, []);

  // Step indicators
  const steps = [
    { key: 'dataset', label: 'Dataset', icon: DatasetIcon },
    { key: 'config', label: 'Configure', icon: ConfigIcon },
    { key: 'training', label: 'Training', icon: TrainIcon },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  return (
    <div className="training-module">
      {/* Header */}
      <div className="training-module-header">
        <div className="training-module-title-row">
          {step !== 'dataset' && step !== 'completed' && (
            <button className="training-module-back" onClick={handleBack} aria-label="Go back">
              <BackIcon />
            </button>
          )}
          <div className="training-module-title-text">
            <h2 className="training-module-title">Fine-Tune Model</h2>
            <p className="training-module-subtitle">{model.modelId}</p>
          </div>
          <button className="training-module-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {/* Step Indicator */}
        <div className="training-module-steps">
          {steps.map((s, idx) => (
            <div
              key={s.key}
              className={`training-module-step ${
                idx < currentStepIndex ? 'completed' : idx === currentStepIndex ? 'active' : ''
              }`}
            >
              <div className="training-module-step-icon">
                {idx < currentStepIndex ? <CheckIcon /> : <s.icon />}
              </div>
              <span className="training-module-step-label">{s.label}</span>
              {idx < steps.length - 1 && <div className="training-module-step-connector" />}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="training-module-content">
        {error && (
          <div className="training-module-error">
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 'dataset' && (
            <motion.div
              key="dataset"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="training-module-step-content"
            >
              <DatasetSelector
                onSelect={handleDatasetSelect}
                selectedDataset={selectedDataset}
                modelTask={model.pipeline_tag}
              />
              <button className="training-module-skip" onClick={handleSkipDataset}>
                Skip (use default dataset)
              </button>
            </motion.div>
          )}

          {step === 'config' && (
            <motion.div
              key="config"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="training-module-step-content"
            >
              <TrainingConfig
                model={model}
                onStartTraining={handleStartTraining}
                isLoading={isStarting}
              />
            </motion.div>
          )}

          {(step === 'training' || step === 'completed') && activeJob && (
            <motion.div
              key="training"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="training-module-step-content"
            >
              <TrainingProgress
                jobId={activeJob.id}
                status={activeJob.status}
                metrics={activeJob.metrics}
                logs={activeJob.logs}
                onStop={handleStopTraining}
                onViewOnHub={handleViewOnHub}
                hubUrl={activeJob.outputModelUrl}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default TrainingModule;
