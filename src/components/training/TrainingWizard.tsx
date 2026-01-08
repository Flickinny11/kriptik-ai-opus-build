/**
 * Training Wizard - Multi-step training job configuration
 *
 * Guides users through modality selection, model selection,
 * dataset configuration, and training parameters.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  CheckCircle,
  Brain,
  Image,
  Video,
  Music,
  Layers
} from 'lucide-react';
import { useTrainingStore, type ModelModality, type TrainingMethod } from '@/store/useTrainingStore';
import { ModelSelector } from './ModelSelector';
import { DatasetConfigurator } from './DatasetConfigurator';
import { TrainingConfig, DEFAULT_CONFIGS, type TrainingConfigValues } from './TrainingConfig';

const MODALITY_CONFIG: Record<ModelModality, {
  icon: typeof Brain;
  label: string;
  description: string;
  methods: { value: TrainingMethod; label: string; description: string }[];
}> = {
  llm: {
    icon: Brain,
    label: 'LLM / Text',
    description: 'Train language models for text generation, chat, and coding',
    methods: [
      { value: 'qlora', label: 'QLoRA', description: 'Quantized LoRA - Most efficient' },
      { value: 'lora', label: 'LoRA', description: 'Low-Rank Adaptation - Balanced' },
      { value: 'full', label: 'Full Fine-tune', description: 'Full model - Best quality' },
      { value: 'dpo', label: 'DPO', description: 'Direct Preference Optimization' },
      { value: 'rlhf', label: 'RLHF', description: 'Reinforcement Learning from Human Feedback' },
    ],
  },
  image: {
    icon: Image,
    label: 'Image',
    description: 'Train image generation models like SDXL, Flux, and SD3.5',
    methods: [
      { value: 'lora', label: 'LoRA', description: 'Style and concept training' },
      { value: 'dreambooth', label: 'DreamBooth', description: 'Subject-driven generation' },
      { value: 'textual_inversion', label: 'Textual Inversion', description: 'Learn new concepts' },
    ],
  },
  video: {
    icon: Video,
    label: 'Video',
    description: 'Train video generation models like Wan2.1, HunyuanVideo',
    methods: [
      { value: 'lora', label: 'LoRA', description: 'Style and motion training' },
    ],
  },
  audio: {
    icon: Music,
    label: 'Audio',
    description: 'Train voice cloning and audio generation models',
    methods: [
      { value: 'voice_clone', label: 'Voice Clone', description: 'Clone voices with XTTS or WhisperSpeech' },
      { value: 'style_transfer', label: 'Style Transfer', description: 'MusicGen style adaptation' },
      { value: 'lora', label: 'LoRA', description: 'General audio model fine-tuning' },
    ],
  },
  multimodal: {
    icon: Layers,
    label: 'Multimodal',
    description: 'Train models that understand multiple modalities',
    methods: [
      { value: 'lora', label: 'LoRA', description: 'Efficient multimodal training' },
    ],
  },
};

type WizardStep = 'modality' | 'model' | 'dataset' | 'config' | 'review';
const WIZARD_STEPS: WizardStep[] = ['modality', 'model', 'dataset', 'config', 'review'];

interface TrainingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (jobId: string) => void;
}

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

  const currentStepIndex = WIZARD_STEPS.indexOf(wizardStep);

  useEffect(() => {
    if (!isOpen) {
      resetWizard();
      setJobName('');
    }
  }, [isOpen, resetWizard]);

  // Get GPU recommendation when entering config step
  useEffect(() => {
    if (wizardStep === 'config' && wizardData.modality && wizardData.method && wizardData.baseModel) {
      getGPURecommendation();
    }
  }, [wizardStep, wizardData.modality, wizardData.method, wizardData.baseModel, getGPURecommendation]);

  const goBack = () => {
    if (currentStepIndex > 0) {
      setWizardStep(WIZARD_STEPS[currentStepIndex - 1]);
    }
  };

  const goNext = () => {
    if (currentStepIndex < WIZARD_STEPS.length - 1) {
      setWizardStep(WIZARD_STEPS[currentStepIndex + 1]);
    }
  };

  const canProceed = () => {
    switch (wizardStep) {
      case 'modality':
        return !!wizardData.modality && !!wizardData.method;
      case 'model':
        return !!wizardData.baseModel;
      case 'dataset':
        return !!wizardData.datasetConfig;
      case 'config':
        return !!wizardData.trainingConfig;
      case 'review':
        return true;
      default:
        return false;
    }
  };

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
    setWizardData({ jobName: jobName || undefined });
    const jobId = await createJob();
    if (jobId) {
      await startJob(jobId);
      onComplete?.(jobId);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl max-h-[90vh] bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              New Training Job
            </h2>
            <p className="text-sm text-white/60 mt-1">
              Step {currentStepIndex + 1} of {WIZARD_STEPS.length}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center px-4 py-2 border-b border-white/5">
          {WIZARD_STEPS.map((step, index) => (
            <div key={step} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                  index < currentStepIndex
                    ? 'bg-green-500/20 text-green-400'
                    : index === currentStepIndex
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-white/5 text-white/40'
                }`}
              >
                {index < currentStepIndex ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  index + 1
                )}
              </div>
              {index < WIZARD_STEPS.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-2 transition-colors ${
                    index < currentStepIndex ? 'bg-green-500/40' : 'bg-white/10'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-2 text-red-300 hover:text-red-200"
              >
                Dismiss
              </button>
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
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-white mb-2">Choose Modality</h3>
                    <p className="text-sm text-white/60">What type of model do you want to train?</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {(Object.entries(MODALITY_CONFIG) as [ModelModality, typeof MODALITY_CONFIG[ModelModality]][]).map(
                      ([modality, config]) => {
                        const Icon = config.icon;
                        const isSelected = wizardData.modality === modality;
                        return (
                          <button
                            key={modality}
                            onClick={() => handleModalitySelect(modality)}
                            className={`p-4 rounded-xl border text-left transition-all ${
                              isSelected
                                ? 'bg-blue-500/20 border-blue-500/50'
                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                            }`}
                          >
                            <Icon className={`w-8 h-8 mb-2 ${isSelected ? 'text-blue-400' : 'text-white/60'}`} />
                            <div className="font-medium text-white">{config.label}</div>
                            <div className="text-xs text-white/40 mt-1">{config.description}</div>
                          </button>
                        );
                      }
                    )}
                  </div>

                  {/* Method selection */}
                  {wizardData.modality && (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-white/80 mb-3">Training Method</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {MODALITY_CONFIG[wizardData.modality].methods.map((method) => (
                          <button
                            key={method.value}
                            onClick={() => handleMethodSelect(method.value)}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              wizardData.method === method.value
                                ? 'bg-blue-500/20 border-blue-500/50'
                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            <div className="font-medium text-white text-sm">{method.label}</div>
                            <div className="text-xs text-white/40">{method.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Model Selection */}
              {wizardStep === 'model' && wizardData.modality && (
                <ModelSelector
                  modality={wizardData.modality}
                  method={wizardData.method}
                  selectedModel={wizardData.baseModelInfo}
                  onSelect={selectModel}
                  onSearch={(query) => searchModels(query, wizardData.modality!)}
                />
              )}

              {/* Step 3: Dataset Configuration */}
              {wizardStep === 'dataset' && wizardData.modality && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium text-white mb-2">Configure Dataset</h3>
                    <p className="text-sm text-white/60">Upload or select a dataset for training</p>
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
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium text-white mb-2">Training Parameters</h3>
                    <p className="text-sm text-white/60">Configure hyperparameters and GPU settings</p>
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

              {/* Step 5: Review */}
              {wizardStep === 'review' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-white mb-2">Review & Start</h3>
                    <p className="text-sm text-white/60">Review your configuration and start training</p>
                  </div>

                  {/* Job name */}
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      Job Name (optional)
                    </label>
                    <input
                      type="text"
                      value={jobName}
                      onChange={(e) => setJobName(e.target.value)}
                      placeholder={`${wizardData.modality}-${wizardData.method}-${Date.now()}`}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>

                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-4">
                    <SummaryCard label="Modality" value={wizardData.modality || '-'} />
                    <SummaryCard label="Method" value={wizardData.method || '-'} />
                    <SummaryCard label="Base Model" value={wizardData.baseModel || '-'} />
                    <SummaryCard label="Dataset" value={wizardData.datasetConfig?.source || '-'} />
                    <SummaryCard label="Epochs" value={String(wizardData.trainingConfig?.epochs || '-')} />
                    <SummaryCard label="Batch Size" value={String(wizardData.trainingConfig?.batchSize || '-')} />
                    <SummaryCard label="GPU" value={wizardData.trainingConfig?.gpuType || 'Auto'} />
                    <SummaryCard
                      label="Est. Cost"
                      value={
                        wizardData.gpuRecommendation
                          ? `$${wizardData.gpuRecommendation.estimatedCost.toFixed(2)}/hr`
                          : '-'
                      }
                    />
                  </div>

                  {wizardData.gpuRecommendation && (
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <p className="text-sm text-white/80">{wizardData.gpuRecommendation.reasoning}</p>
                      <p className="text-xs text-white/40 mt-2">
                        Estimated time: {wizardData.gpuRecommendation.estimatedTime}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-white/10">
          <button
            onClick={goBack}
            disabled={currentStepIndex === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {wizardStep === 'review' ? (
            <button
              onClick={handleStartTraining}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Start Training
                </>
              )}
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-white/5 rounded-lg">
      <div className="text-xs text-white/40">{label}</div>
      <div className="text-sm font-medium text-white mt-1 truncate">{value}</div>
    </div>
  );
}
