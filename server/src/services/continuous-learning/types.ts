/**
 * Continuous Learning Engine Types
 *
 * Type definitions for the meta-integration layer that ties together:
 * - Billing/Stripe
 * - VL-JEPA/Vector Memory
 * - Hyper-Thinking (ToT, MARS)
 * - Training/Fine-Tuning
 * - Component 28 (Autonomous Learning Engine)
 */

import type { TokenUsage } from '../hyper-thinking/types.js';
import type { SearchResult } from '../embeddings/qdrant-client.js';

// =============================================================================
// SESSION TYPES
// =============================================================================

export type SessionType = 'build' | 'feature_agent' | 'training' | 'fix_my_app' | 'ghost_mode';
export type SessionOutcome = 'success' | 'partial' | 'failure' | 'cancelled';

export interface SessionConfig {
  userId: string;
  projectId?: string;
  taskType: SessionType;
  complexity?: number;
  qualityRequirement?: number;
  budgetLimit?: number;
}

export interface LearningSession {
  id: string;
  userId: string;
  projectId?: string;
  sessionType: SessionType;
  startedAt: string;
  completedAt?: string;

  // Billing tracking
  billingSessionId?: string;
  totalCostUsd: number;
  creditsUsed: number;

  // Vector context tracking
  vectorQueriesCount: number;
  vectorHitsCount: number;
  contextRelevanceScore: number;

  // Hyper-thinking tracking
  hyperThinkingUsed: boolean;
  totPathsExplored: number;
  marsAgentsUsed: number;
  reasoningQuality: number;

  // Learning tracking
  learningEventsCount: number;
  patternsApplied: number;
  strategiesUsed: string[];

  // Outcome
  outcome?: SessionOutcome;
  userSatisfaction?: number; // 1-5 rating if provided
  improvementScore?: number;

  // Context
  vectorContext?: UnifiedContext;
  thinkingConfig?: ThinkingConfig;
  learningContext?: LearningContextData;
  shadowModels?: ModelSelection[];

  metadata?: Record<string, unknown>;
}

export interface LearningContextData {
  patterns: LearnedPatternRef[];
  strategies: LearnedStrategyRef[];
  reflexions: ReflexionNoteRef[];
}

export interface LearnedPatternRef {
  id: string;
  type: string;
  name: string;
  relevanceScore: number;
}

export interface LearnedStrategyRef {
  id: string;
  name: string;
  successRate: number;
}

export interface ReflexionNoteRef {
  id: string;
  failureType: string;
  summary: string;
}

// =============================================================================
// BILLING-LEARNING BRIDGE TYPES
// =============================================================================

export interface ModelSelection {
  model: string;
  cost: number;
  predictedQuality: number;
  valueScore: number;
  isShadow: boolean;
  deploymentId?: string;
}

export interface CostAnalysis {
  period: string;
  operations: OperationCost[];
  errors: ErrorCost[];
}

export interface OperationCost {
  operationType: string;
  totalCost: number;
  count: number;
  avgCostPerOp: number;
}

export interface ErrorCost {
  errorType: string;
  retryCost: number;
  occurrences: number;
}

export interface LearningPriority {
  type: 'cost_reduction' | 'error_reduction' | 'quality_improvement' | 'speed_improvement';
  target: string;
  currentCost?: number;
  potentialSavings: number;
  strategies: string[];
}

export interface LearningROI {
  period: string;
  actualCost: number;
  estimatedWithoutLearning: number;
  savings: number;
  learningInvestment: number;
  roi: number;
  breakdown: {
    shadowModelSavings: number;
    patternApplicationSavings: number;
    errorReductionSavings: number;
    cacheHitSavings: number;
  };
}

export interface BillingLearningInsights {
  currentUsage: {
    totalCredits: number;
    byCategory: Record<string, number>;
    generationCount: number;
  };
  creditsRemaining: number;
  learningROI: LearningROI;
  recommendations: CostRecommendation[];
  projectedCost: number;
  projectedSavings: number;
}

export interface CostRecommendation {
  type: 'model_switch' | 'pattern_usage' | 'caching' | 'training';
  description: string;
  estimatedSavings: number;
  confidence: number;
}

// =============================================================================
// VECTOR CONTEXT TYPES
// =============================================================================

export interface ContextConfig {
  userId: string;
  projectId?: string;
  maxTokens?: number;
  collections?: string[];
}

export interface TaskDescription {
  description: string;
  type: string;
  hints?: string[];
}

export interface UnifiedContext {
  relevant: PrioritizedContext[];
  metadata: {
    totalCandidates: number;
    selectedCount: number;
    priorityScores: Record<string, number>;
    retrievalTimeMs: number;
  };
}

export interface PrioritizedContext {
  id: string;
  collection: string;
  content: string;
  score: number;
  priorityWeight: number;
  metadata?: Record<string, unknown>;
}

export interface ErrorResolutionContext {
  exactMatches: SearchResult[];
  similarErrors: SearchResult[];
  projectErrors: SearchResult[];
  helpfulPatterns: SearchResult[];
  suggestedApproach?: string;
}

export interface CrossBuildContext {
  similarBuilds: SearchResult[];
  phaseInsights: SearchResult[];
  userPatterns: SearchResult[];
  recommendations: BuildRecommendation[];
}

export interface BuildRecommendation {
  type: 'pattern' | 'strategy' | 'warning';
  description: string;
  confidence: number;
  source?: string;
}

export interface SessionLearning {
  id: string;
  type: 'code_pattern' | 'design_decision' | 'error_resolution' | 'strategy_outcome';
  description: string;
  content: unknown;
  outcome: 'success' | 'failure' | 'partial';
  confidence: number;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// HYPER-THINKING INTEGRATION TYPES
// =============================================================================

export type ReasoningMode = 'standard' | 'tree_of_thought' | 'mars' | 'decomposition' | 'hybrid';

export interface ThinkingConfig {
  mode: ReasoningMode;
  maxPaths?: number;
  maxAgents?: number;
  maxDepth?: number;
  timeout?: number;
}

export interface ReasoningResult {
  mode: ReasoningMode;
  phase: string;
  context: unknown;
  selectedPath?: ThoughtPath;
  fallbackPath?: ThoughtPath;
  confidence: number;
  tokenUsage: TokenUsage;
  latencyMs: number;
}

export interface ThoughtPath {
  id: string;
  steps: ThoughtStep[];
  score: number;
  risks: Risk[];
}

export interface ThoughtStep {
  thought: string;
  evaluation: number;
}

export interface Risk {
  description: string;
  severity: number;
  mitigation?: string;
}

export interface MARSErrorResolution {
  sessionId: string;
  error: string;
  agentPerspectives: Array<{ agent: string; analysis: string; suggestion: string }>;
  consensusReached: boolean;
  consensusScore: number;
  proposedFix: string;
  reasoning: string;
  confidence: number;
  duration: number;
}

export interface ToTResult {
  sessionId: string;
  branches: Array<{ id: string; thought: string; score: number }>;
  selectedPath: string[];
  confidence: number;
  reasoning: string;
  alternatives: Array<{ id: string; thought: string; score: number }>;
  duration: number;
}

export type ReasoningType = 'tot' | 'mars' | 'hybrid';

export interface ReasoningConfig {
  maxBranches?: number;
  maxIterations?: number;
  consensusThreshold?: number;
}

export interface PhaseOutcome {
  success: boolean;
  pathTaken?: ThoughtPath;
  usedFallback: boolean;
  fallbackReason?: string;
  outcome?: unknown;
}

// =============================================================================
// MODEL DEPLOYMENT TYPES
// =============================================================================

export type DeploymentProvider = 'runpod' | 'modal' | 'local';
export type DeploymentStatus = 'pending' | 'deploying' | 'active' | 'promoting' | 'demoted' | 'failed';

export interface DeploymentConfig {
  modelName: string;
  modelVersion: string;
  trafficPercentage?: number;
  baselineModel?: string;
  provider?: DeploymentProvider;
  autoPromote?: boolean;
  gpuType?: string;
  minReplicas?: number;
  maxReplicas?: number;
  idleTimeout?: number;
}

export interface Deployment {
  id: string;
  modelName: string;
  modelVersion: string;
  status: 'testing' | 'promoted' | 'rolled_back' | 'pending';
  trafficPercentage: number;
  baselineModel?: string;
  startedAt: string;
  promotedAt?: string;
  metrics: {
    requestCount: number;
    successRate: number;
    avgLatency: number;
    errorRate: number;
  };
}

export interface DeploymentMetrics {
  requests: number;
  avgLatency: number;
  errorRate: number;
  qualityScore: number;
}

export interface DeploymentEvaluation {
  deploymentId: string;
  recommendation: 'promote' | 'rollback' | 'continue_testing';
  improvement: number;
  confidence: number;
  metrics: Deployment['metrics'];
}

export interface ABComparison {
  deploymentId: string;
  testModelMetrics: {
    requests: number;
    successes: number;
    totalLatency: number;
  };
  baselineMetrics: {
    requests: number;
    successes: number;
    totalLatency: number;
  };
  improvement: number;
  pValue: number;
}

export interface ABMetrics {
  samples: number;
  totalQuality: number;
  totalLatency: number;
  errors: number;
}

export interface RequestResult {
  deploymentId: string;
  isTestModel: boolean;
  success: boolean;
  latency: number;
  qualityScore?: number;
  error?: string;
}

// =============================================================================
// UNIFIED METRICS TYPES
// =============================================================================

export interface UnifiedMetrics {
  timestamp: string;

  // Billing metrics
  activeSessions: number;
  totalCostToday: number;
  creditBurnRate: number;

  // Vector metrics
  vectorQueriesPerMin: number;
  cacheHitRate: number;
  avgRetrievalTimeMs: number;

  // Learning metrics
  patternsAppliedToday: number;
  improvementRate: number;
  cyclesCompletedToday: number;

  // Model metrics
  shadowModelsActive: number;
  shadowModelSuccessRate: number;
  deploymentsActive: number;

  // Hyper-thinking metrics
  reasoningSessionsToday: number;
  avgReasoningQuality: number;

  // Health
  systemHealth: SystemHealthState;
}

export interface SystemHealthState {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: ComponentHealth[];
  lastCheck: string;
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  errorRate?: number;
  message?: string;
}

export interface CorrelationReport {
  correlations: LearningCorrelation[];
  insights: string[];
  recommendations: string[];
}

export interface LearningCorrelation {
  id: string;
  correlationType: 'cost_reduction' | 'quality_improvement' | 'speed_increase';
  triggerSystem: string;
  triggerEvent: string;
  improvedSystem: string;
  improvementMetric: string;
  improvementValue: number;
  confidence: number;
  samplesCount: number;
}

export interface AnomalyAlert {
  id: string;
  type: 'spike' | 'drop' | 'drift' | 'error_surge';
  severity: 'low' | 'medium' | 'high' | 'critical';
  system: string;
  metric: string;
  currentValue: number;
  expectedValue: number;
  deviation: number;
  timestamp: string;
  resolved: boolean;
}

export interface TrendAnalysis {
  period: string;
  metrics: MetricTrend[];
  predictions: MetricPrediction[];
}

export interface MetricTrend {
  name: string;
  values: { timestamp: string; value: number }[];
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercent: number;
}

export interface MetricPrediction {
  name: string;
  predictedValue: number;
  confidence: number;
  horizon: string;
}

// =============================================================================
// FEEDBACK LOOP TYPES
// =============================================================================

export type FeedbackType = 'implicit' | 'explicit';
export type ImplicitAction = 'accept' | 'reject' | 'modify' | 'abandon' | 'retry';

export interface UserFeedback {
  id: string;
  sessionId: string;
  buildId?: string;
  userId: string;
  type: FeedbackType;
  action?: ImplicitAction;
  rating?: number; // 1-5
  comment?: string;
  context: FeedbackContext;
  timestamp: string;
  processed: boolean;
  quality: number; // Feedback quality score
}

export interface FeedbackContext {
  phase?: string;
  feature?: string;
  artifact?: string;
  previousAttempts?: number;
}

export interface FeedbackPropagation {
  feedbackId: string;
  propagatedTo: {
    patternLibrary: boolean;
    strategyEvolution: boolean;
    shadowModels: boolean;
    vectorMemory: boolean;
    contextPriority: boolean;
  };
  impact: Record<string, number>;
}

// =============================================================================
// AUTO-OPTIMIZATION TYPES
// =============================================================================

export interface OptimizationParam {
  name: string;
  currentValue: number;
  minValue: number;
  maxValue: number;
  autoTuneEnabled: boolean;
  lastTunedAt?: string;
  tuningHistory: ParamTuning[];
  correlatedMetrics: string[];
}

export interface ParamTuning {
  value: number;
  outcome: 'improved' | 'degraded' | 'neutral';
  metrics: Record<string, number>;
  timestamp: string;
}

export interface OptimizationResult {
  correlations: OptimizationCorrelation[];
  adjustedParams: AdjustedParam[];
  improvements: Record<string, number>;
  timestamp: string;
}

export interface OptimizationCorrelation {
  param: string;
  metrics: string[];
  correlation: number;
  confidence: number;
}

export interface AdjustedParam {
  name: string;
  oldValue: number;
  newValue: number;
  reason: string;
  expectedImpact: number;
}

export interface ImpactEstimate {
  param: string;
  newValue: number;
  estimatedChange: Record<string, number>;
  confidence: number;
  risks: string[];
}

// =============================================================================
// HEALTH MONITORING TYPES
// =============================================================================

export interface HealthReport {
  timestamp: string;
  overallHealth: 'healthy' | 'degraded' | 'unhealthy';
  components: ComponentHealthReport[];
  alerts: HealthAlert[];
  uptime: number;
}

export interface ComponentHealthReport {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTimeMs: number;
  errorRate: number;
  lastCheck: string;
  dependencies: string[];
  details?: Record<string, unknown>;
}

export interface HealthAlert {
  id: string;
  component: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  resolvedAt?: string;
}

export interface Diagnosis {
  component: string;
  issue: string;
  rootCause: string;
  affectedSystems: string[];
  suggestedActions: string[];
  autoRecoverable: boolean;
}

export interface RecoveryResult {
  component: string;
  success: boolean;
  action: string;
  duration: number;
  error?: string;
}

export interface SLAReport {
  period: string;
  uptime: number;
  targetUptime: number;
  incidents: number;
  avgResolutionTime: number;
  byComponent: Record<string, { uptime: number; incidents: number }>;
}

// =============================================================================
// BUILD CONTEXT TYPES
// =============================================================================

export interface BuildPhase {
  name: string;
  description?: string;
  importance?: number;
}

export interface PhaseContext {
  buildId?: string;
  phase: string;
  feature?: string;
  currentTask: string;
  relevantContext?: string;
  estimatedTokens?: number;
  errorCount?: number;
  errorHistory?: BuildError[];
  complexity?: number;
  hasArchitecturalChoices?: boolean;
  conflictCount?: number;
  intentComplexity?: number;
  phaseType?: string;
}

export interface BuildError {
  id: string;
  type: string;
  message: string;
  stack?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

export interface ErrorContext {
  domain?: string;
  attemptCount: number;
  previousFixes?: string[];
}

export interface EnhancedContext extends PhaseContext {
  vectorContext?: UnifiedContext;
  patterns?: LearnedPatternRef[];
  enhancedReasoning?: ReasoningResult;
}

export interface ErrorResolution {
  similarErrors?: SearchResult[];
  reflexions?: ReflexionNoteRef[];
  suggestedFix?: string;
  confidence?: number;
}

export interface BuildInfo {
  id: string;
  userId: string;
  projectId?: string;
  intentDescription: string;
  startedAt: string;
}

// =============================================================================
// ENGINE CONFIGURATION
// =============================================================================

export interface ContinuousLearningConfig {
  // Session settings
  maxActiveSessions: number;
  sessionTimeoutMs: number;

  // Learning thresholds
  minSignificantOutcome: number;
  miniCycleThreshold: number;
  fullCycleThreshold: number;

  // Optimization settings
  autoOptimizationEnabled: boolean;
  optimizationInterval: number;

  // Health monitoring
  healthCheckInterval: number;
  alertThresholds: AlertThresholds;

  // Model deployment
  autoDeployEnabled: boolean;
  minDeploymentQuality: number;
  maxTrafficPerModel: number;
}

export interface AlertThresholds {
  responseTimeMs: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
}

export const DEFAULT_CONTINUOUS_LEARNING_CONFIG: ContinuousLearningConfig = {
  maxActiveSessions: 100,
  sessionTimeoutMs: 3600000, // 1 hour

  minSignificantOutcome: 0.7,
  miniCycleThreshold: 10,
  fullCycleThreshold: 100,

  autoOptimizationEnabled: true,
  optimizationInterval: 3600000, // 1 hour

  healthCheckInterval: 60000, // 1 minute
  alertThresholds: {
    responseTimeMs: 5000,
    errorRate: 0.05,
    cpuUsage: 0.8,
    memoryUsage: 0.85,
  },

  autoDeployEnabled: true,
  minDeploymentQuality: 0.8,
  maxTrafficPerModel: 50,
};
