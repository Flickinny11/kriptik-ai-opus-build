/**
 * Training Executor Types
 *
 * Shared types for all training executors.
 * Part of KripTik AI's Flagship Training Module
 */

// =============================================================================
// BASE TYPES
// =============================================================================

export interface TrainingProgress {
  step: number;
  totalSteps: number;
  epoch: number;
  totalEpochs: number;
  loss: number;
  learningRate: number;
  gradNorm?: number;
  eta: string;
  gpuMemoryUsed: number;
  gpuMemoryTotal: number;
  gpuUtilization: number;
  tokensPerSecond?: number;
  samplesPerSecond?: number;
}

export interface TrainingMetrics {
  trainLoss: number[];
  evalLoss?: number[];
  learningRates: number[];
  gradNorms?: number[];
  perplexity?: number[];
  accuracy?: number[];
  bleuScore?: number[];
  rougeScore?: number[];
}

export interface TrainingCheckpoint {
  id: string;
  step: number;
  epoch: number;
  loss: number;
  path: string;
  sizeBytes: number;
  createdAt: string;
}

export interface TrainingResult {
  id: string;
  status: 'completed' | 'failed' | 'stopped';
  finalLoss: number;
  bestLoss: number;
  bestCheckpoint?: TrainingCheckpoint;
  checkpoints: TrainingCheckpoint[];
  metrics: TrainingMetrics;
  outputModelPath: string;
  huggingfaceUrl?: string;
  totalTrainingTime: number;
  totalCost: number;
  error?: string;
}

// =============================================================================
// EXECUTOR INTERFACE
// =============================================================================

export interface TrainingExecutor<TConfig = unknown> {
  readonly name: string;
  readonly method: string;

  execute(config: TConfig): Promise<TrainingResult>;
  getProgress(): TrainingProgress;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;

  // Event emitter methods (implemented by extending EventEmitter)
  on(event: 'progress', listener: (progress: TrainingProgress) => void): this;
  on(event: 'checkpoint', listener: (checkpoint: TrainingCheckpoint) => void): this;
  on(event: 'log', listener: (log: { level: string; message: string }) => void): this;
  on(event: 'error', listener: (error: { message: string }) => void): this;
  on(event: 'completed', listener: (result: TrainingResult) => void): this;
  on(event: string, listener: (...args: unknown[]) => void): this;

  emit(event: string, ...args: unknown[]): boolean;
}

// =============================================================================
// CONFIG TYPES
// =============================================================================

export interface BaseExecutorConfig {
  id: string;
  userId: string;
  baseModelId: string;
  outputPath: string;
  checkpointPath: string;
  logsPath: string;
  epochs: number;
  batchSize: number;
  learningRate: number;
  warmupSteps: number;
  maxSteps?: number;
  gradientAccumulationSteps: number;
  gradientCheckpointing: boolean;
  fp16: boolean;
  bf16: boolean;
  callbackUrl?: string;
  huggingfaceToken?: string;
  pushToHub: boolean;
  hubRepoName?: string;
}

export interface DoRAConfig extends BaseExecutorConfig {
  rank: number;
  alpha: number;
  dropout: number;
  targetModules: string[];
  magnitudeScaling: boolean;
  directionTraining: boolean;
}

export interface DPOConfig extends BaseExecutorConfig {
  beta: number; // KL penalty coefficient
  labelSmoothingRatio: number;
  referenceModelId?: string;
  generateDuringEval: boolean;
  maxPromptLength: number;
  maxLength: number;
}

export interface RLHFConfig extends BaseExecutorConfig {
  rewardModelId?: string;
  trainRewardModel: boolean;
  ppoEpochs: number;
  klCoefficient: number;
  clipRange: number;
  valueCoefficient: number;
  entropyCoefficient: number;
  maxResponseLength: number;
  minResponseLength: number;
  temperature: number;
  topK: number;
  topP: number;
}

export interface DeepSpeedConfig extends BaseExecutorConfig {
  zeroStage: 1 | 2 | 3;
  offloadOptimizer: boolean;
  offloadParam: boolean;
  cpuOffload: boolean;
  nvmeOffload: boolean;
  nvmeOffloadPath?: string;
  partitionActivations: boolean;
  cpuCheckpointing: boolean;
  numNodes: number;
  gpusPerNode: number;
  masterAddr?: string;
  masterPort?: number;
}

export interface MoEDiffusionConfig extends BaseExecutorConfig {
  numExperts: number;
  topK: number;
  expertCapacity: number;
  routerType: 'softmax' | 'topk' | 'expert_choice';
  balanceLossWeight: number;
  zLossWeight: number;
  noiseTimestepSpecialization: boolean;
  expertDim: number;
}

export interface MultiStageConfig {
  id: string;
  userId: string;
  stages: StageConfig[];
  continueBetweenStages: boolean;
  approvalRequiredStages: number[];
}

export interface StageConfig {
  id: string;
  name: string;
  method: string;
  config: BaseExecutorConfig;
  checkpoint?: string;
  requiresApproval: boolean;
  dependencies: string[];
}

export interface StageResult {
  stageId: string;
  stageName: string;
  result: TrainingResult;
  checkpoint: TrainingCheckpoint;
  duration: number;
}

// =============================================================================
// EVENT TYPES
// =============================================================================

export interface ExecutorEvent {
  type: 'progress' | 'checkpoint' | 'log' | 'error' | 'completed';
  timestamp: string;
  data: unknown;
}

export interface LogEvent {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, unknown>;
}
