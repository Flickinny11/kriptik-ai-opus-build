/**
 * Training UI Types
 *
 * Shared types for training UI components
 */

export interface GPURecommendation {
  gpuType: string;
  gpuCount: number;
  vramRequired: number;
  estimatedCost: number;
  estimatedTime: string;
  provider: 'runpod' | 'modal' | 'both';
  reasoning: string;
}

export interface TrainingProgressData {
  jobId: string;
  status: 'pending' | 'starting' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentEpoch: number;
  totalEpochs: number;
  currentStep: number;
  totalSteps: number;
  loss: number;
  learningRate: number;
  eta: string;
  gpuUtilization: number;
  gpuMemoryUsed: number;
  gpuMemoryTotal: number;
  logs: LogEntry[];
  metrics: MetricsHistory;
  cost: CostTracking;
  startedAt?: string;
  completedAt?: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

export interface MetricsHistory {
  loss: { step: number; value: number }[];
  learningRate: { step: number; value: number }[];
  gradNorm?: { step: number; value: number }[];
  evalLoss?: { step: number; value: number }[];
}

export interface CostTracking {
  gpuCost: number;
  platformFee: number;
  totalCost: number;
  creditsUsed: number;
  estimatedRemaining: number;
}

export interface TrainingResult {
  jobId: string;
  status: 'completed' | 'failed';
  modelPath?: string;
  huggingfaceUrl?: string;
  finalLoss?: number;
  totalEpochs: number;
  totalSteps: number;
  trainingTime: number;
  totalCost: number;
  reportUrl?: string;
  error?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  author: string;
  description?: string;
  downloads?: number;
  likes?: number;
  tags?: string[];
  modelSize?: string;
  license?: string;
  lastModified?: string;
  private?: boolean;
}

export interface HuggingFaceSearchResult {
  models: ModelInfo[];
  totalCount: number;
  nextPage?: string;
}

export interface DeploymentConfig {
  provider: 'runpod' | 'modal' | 'huggingface';
  gpuType?: string;
  minReplicas: number;
  maxReplicas: number;
  autoscale: boolean;
  idleTimeout: number;
  customDomain?: string;
}

export interface DeploymentStatus {
  id: string;
  status: 'deploying' | 'running' | 'scaling' | 'failed' | 'stopped';
  endpoint?: string;
  replicas: number;
  lastRequest?: string;
  requestCount: number;
  totalCost: number;
}

export interface TestResult {
  id: string;
  input: string;
  output: string;
  model: 'base' | 'finetuned' | 'comparison';
  latency: number;
  tokensGenerated?: number;
  cost: number;
  timestamp: string;
  metrics?: Record<string, number>;
}

export interface ComparisonResult {
  baseOutput: string;
  finetunedOutput: string;
  baseLatency: number;
  finetunedLatency: number;
  qualityDelta?: number;
  userPreference?: 'base' | 'finetuned' | 'equal';
}

// Phase 4: Budget Management Types
export type BudgetStatus = 
  | 'within_budget' 
  | 'approaching_alert' 
  | 'alert_sent' 
  | 'approaching_freeze' 
  | 'frozen' 
  | 'resumed' 
  | 'completed';

export interface BudgetState {
  jobId: string;
  userId: string;
  maxBudget: number;
  alertThreshold: number;
  freezeThreshold: number;
  currentSpend: number;
  estimatedTotalSpend: number;
  spendRate: number;
  status: BudgetStatus;
  notificationChannels: ('email' | 'sms' | 'in_app')[];
  updatedAt: string;
}

export interface FreezeState {
  jobId: string;
  checkpoint: CheckpointInfo;
  frozenAt: string;
  currentSpend: number;
  percentUsed: number;
  canResume: boolean;
  resumeUrl: string;
  expiresAt: string;
}

export interface CheckpointInfo {
  id: string;
  step: number;
  epoch: number;
  loss: number;
  path: string;
  sizeBytes: number;
  createdAt: string;
  metrics?: Record<string, number>;
}

export interface QualityCheckpoint {
  id: string;
  jobId: string;
  step: number;
  epoch: number;
  timestamp: string;
  metrics: {
    loss: number;
    evalLoss?: number;
    customMetrics: Record<string, number>;
  };
  sample: {
    input: unknown;
    output: unknown;
    expected?: unknown;
  };
}

export interface PipelineProgress {
  currentStage: number;
  totalStages: number;
  stageName: string;
  stageMethod: string;
  stageProgress: number;
  completedStages: StageResult[];
  remainingStages: string[];
}

export interface StageResult {
  stageId: string;
  stageName: string;
  method: string;
  startedAt: string;
  completedAt: string;
  duration: number;
  finalLoss: number;
  checkpointPath: string;
}

export interface CurrentDataSample {
  index: number;
  content: unknown;
  contentType: 'text' | 'image' | 'audio' | 'video';
  preview: string;
  source: string;
  timestamp: string;
}
