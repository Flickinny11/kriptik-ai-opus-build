/**
 * Training Services - Multi-Modal Model Fine-Tuning Platform
 *
 * Barrel export for training services.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import type {
  LLMTrainingConfig,
  ImageTrainingConfig,
  VideoTrainingConfig,
  AudioTrainingConfig,
} from './types.js';

// Types
export * from './types.js';

// GPU Recommender
export {
  GPURecommender,
  getGPURecommender,
  GPU_SPECS,
  type GPUSpec,
} from './gpu-recommender.js';

// Multi-Modal Training Orchestrator
export {
  MultiModalTrainingOrchestrator,
  getMultiModalTrainingOrchestrator,
} from './multi-modal-orchestrator.js';

// Container Images Registry
export {
  getContainerImage as getTrainingContainerImage,
  getContainerVRAMOverhead,
  getRecommendedDiskSize,
  LLM_CONTAINERS,
  IMAGE_CONTAINERS,
  VIDEO_CONTAINERS,
  AUDIO_CONTAINERS,
} from './container-images.js';

// Trainers
export {
  createTrainer,
  generateTrainerConfig,
  getTrainingScript,
  getDatasetScript,
  estimateVRAM,
  ImageTrainer,
  VideoTrainer,
  AudioTrainer,
  LLMTrainer,
  SUPPORTED_METHODS,
  RECOMMENDED_MODELS,
  TRAINING_PRESETS,
} from './trainers/index.js';

// HuggingFace Upload Service
export {
  HuggingFaceUploadService,
  getHuggingFaceUploadService,
  type HFUploadConfig,
  type HFUploadResult,
  type ModelCard,
  type HFRepoInfo,
} from './huggingface-upload.js';

// Model Preservation Service
export {
  ModelPreservationService,
  getModelPreservationService,
  type ModelVersion,
  type PreservationConfig,
  type StorageInfo,
  type ModelRegistry,
  type PreservationResult,
} from './model-preservation.js';

// Training Completion Handler
export {
  TrainingCompletionHandler,
  getTrainingCompletionHandler,
  type CompletionConfig,
  type CompletionResult,
  type CompletionEvent,
} from './completion-handler.js';

// Usage Code Generator
export {
  UsageCodeGenerator,
  getUsageCodeGenerator,
  type UsageCodeOptions,
  type GeneratedCode,
} from './usage-code-generator.js';

// Report Templates
export {
  ReportTemplates,
  getReportTemplates,
  type ReportTemplateData,
} from './report-templates.js';

// Training Report Generator
export {
  TrainingReportGenerator,
  getTrainingReportGenerator,
  type TrainingReportData,
  type GeneratedReport,
} from './report-generator.js';

// Model Inference Service
export {
  ModelInferenceService,
  getModelInferenceService,
  type InferenceRequest,
  type InferenceResponse,
  type ComparisonMetrics,
  type ComparisonResult,
  type InferenceConfig,
} from './model-inference.js';

// Comparison Engine
export {
  ComparisonEngine,
  getComparisonEngine,
  type LLMComparisonResult,
  type ImageComparisonResult,
  type VideoComparisonResult,
  type AudioComparisonResult,
} from './comparison-engine.js';

// Test Session Manager
export {
  TestSessionManager,
  getTestSessionManager,
  type TestSession,
  type TestResult,
  type SessionSummary,
} from './test-session.js';

// Test Billing Service
export {
  TestBillingService,
  getTestBillingService,
  TEST_PRICING,
  type UsageMetrics,
  type BillingResult,
  type UsageRecord,
} from './test-billing.js';

// =============================================================================
// FLAGSHIP TRAINING SERVICES (Phase 1)
// =============================================================================

// Training Intent Lock Engine
export {
  TrainingIntentLockEngine,
  createTrainingIntentLockEngine,
  type TrainingCapability,
  type TrainingMethod as FlagshipTrainingMethod,
  type QualityTier,
  type DataSourceStrategy,
  type BaseModelRecommendation,
  type TrainingMethodRecommendation,
  type DataRequirement as FlagshipDataRequirement,
  type TechnicalRequirement,
  type GPURequirement as FlagshipGPURequirement,
  type CostEstimate,
  type TrainingSuccessCriterion,
  type EvaluationStrategy,
  type ImplementationStep,
  type TrainingContract,
  type TrainingIntentLockOptions,
} from './training-intent-lock.js';

// Training Method Recommender
export {
  TrainingMethodRecommender,
  createTrainingMethodRecommender,
  type TrainingStage,
  type TrainingPipeline,
  type MethodConfig,
} from './training-method-recommender.js';

// Training Data Strategist
export {
  TrainingDataStrategist,
  createTrainingDataStrategist,
  type DataSource,
  type DataValidationResult,
  type DataPipelineConfig,
  type DataProcessingStep,
  type PreferencePair,
  type PreferencePairConfig,
  type DataStatistics,
} from './training-data-strategist.js';

// Training Plan Generator (Phase 2)
export {
  TrainingPlanGenerator,
  createTrainingPlanGenerator,
  type TileCategory,
  type TileStatus,
  type PlanStatus,
  type NotificationChannel,
  type Alternative,
  type ImplementationTile,
  type UserDecision,
  type UserModification,
  type CostRange,
  type TrainingImplementationPlan,
  type BudgetAuthorization,
  type ApprovedTrainingPlan,
  type TileModification,
  type PlanChange,
} from './training-plan-generator.js';

// Training Environment Orchestrator (Phase 3)
export {
  TrainingEnvironmentOrchestrator,
  getTrainingEnvironmentOrchestrator,
  createTrainingEnvironmentOrchestrator,
  type SetupStageStatus,
  type EnvironmentStatus,
  type SetupLog,
  type SetupStage,
  type GPUPod,
  type StorageMount,
  type NetworkConfig,
  type TrainingFrameworkConfig,
  type DataPipelineSetup,
  type MonitoringSetup,
  type EnvironmentSetup,
  type DistributedEnvironment,
  type SetupProgressEvent,
} from './training-environment-orchestrator.js';

// Training Executors (Phase 3)
export {
  // Executors
  DoRAExecutor,
  createDoRAExecutor,
  DPOExecutor,
  createDPOExecutor,
  RLHFExecutor,
  createRLHFExecutor,
  DeepSpeedExecutor,
  createDeepSpeedExecutor,
  MoEDiffusionExecutor,
  createMoEDiffusionExecutor,
  MultiStageExecutor,
  createMultiStageExecutor,
  // Factory
  getExecutor,
  createExecutor,
  isMethodSupported,
  getSupportedMethods,
  getExecutorMetadata,
  // Types
  type ExecutorMethod,
  type TrainingExecutor as FlagshipTrainingExecutor,
  type TrainingProgress as ExecutorTrainingProgress,
  type TrainingResult as ExecutorTrainingResult,
  type TrainingCheckpoint as ExecutorTrainingCheckpoint,
  type TrainingMetrics as ExecutorTrainingMetrics,
  type BaseExecutorConfig,
  type DoRAConfig,
  type DPOConfig,
  type RLHFConfig,
  type DeepSpeedConfig,
  type MoEDiffusionConfig,
  type MultiStageConfig,
  type StageConfig,
  type StageResult,
} from './executors/index.js';

// Training Monitor Service (Phase 4)
export {
  TrainingMonitorService,
  getTrainingMonitorService,
  createTrainingMonitorService,
  type TrainingMetrics as MonitorTrainingMetrics,
  type CheckpointInfo as MonitorCheckpointInfo,
  type CurrentDataSample,
  type PipelineProgress,
  type StageResult as MonitorStageResult,
  type QualityCheckpoint,
  type LogEntry,
  type MonitoringConfig,
} from './training-monitor.js';

// Budget Manager Service (Phase 4)
export {
  BudgetManagerService,
  getBudgetManagerService,
  createBudgetManagerService,
  type BudgetStatus,
  type NotificationChannel as BudgetNotificationChannel,
  type BudgetState,
  type NotificationRecord,
  type FreezeState,
  type ResumeResult,
  type BudgetManagerConfig,
} from './budget-manager.js';

// Universal Model Tester Service (Phase 5)
export {
  UniversalModelTesterService,
  getUniversalModelTesterService,
  createUniversalModelTesterService,
  type ExtendedModality,
  type TestRequest,
  type TestResult,
  type ComparisonResult as TesterComparisonResult,
  type ComparisonMetrics as TesterComparisonMetrics,
  type InferenceEndpoint,
  type TestSession,
  type DeployConfig,
} from './universal-model-tester.js';

// =============================================================================
// DEFAULT CONFIGURATIONS
// =============================================================================

/**
 * Default configuration for LLM fine-tuning
 */
export const DEFAULT_LLM_CONFIG: Partial<LLMTrainingConfig> = {
  epochs: 3,
  learningRate: 2e-5,
  batchSize: 4,
  gradientAccumulationSteps: 4,
  warmupSteps: 100,
  maxSeqLength: 2048,
  loraConfig: {
    rank: 16,
    alpha: 32,
    dropout: 0.05,
    targetModules: ['q_proj', 'k_proj', 'v_proj', 'o_proj'],
  },
};

/**
 * Default configuration for Image training (LoRA/DreamBooth)
 */
export const DEFAULT_IMAGE_CONFIG: Partial<ImageTrainingConfig> = {
  baseModel: 'sdxl',
  steps: 1000,
  learningRate: 1e-4,
  batchSize: 1,
  resolution: 1024,
  loraConfig: {
    rank: 8,
    alpha: 16,
    networkDim: 16,
    networkAlpha: 16,
  },
  gradientCheckpointing: true,
  textEncoderTraining: true,
};

/**
 * Default configuration for Video training
 */
export const DEFAULT_VIDEO_CONFIG: Partial<VideoTrainingConfig> = {
  baseModel: 'wan',
  steps: 500,
  learningRate: 1e-5,
  batchSize: 1,
  frameCount: 24,
  resolution: { width: 720, height: 480 },
  loraConfig: {
    rank: 4,
    alpha: 8,
  },
};

/**
 * Default configuration for Audio training
 */
export const DEFAULT_AUDIO_CONFIG: Partial<AudioTrainingConfig> = {
  baseModel: 'xtts2',
  steps: 1000,
  learningRate: 1e-5,
  sampleRate: 22050,
};
