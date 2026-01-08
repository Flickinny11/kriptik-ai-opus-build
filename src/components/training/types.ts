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
