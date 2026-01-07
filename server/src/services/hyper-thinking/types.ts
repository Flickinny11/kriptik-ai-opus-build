/**
 * Hyper-Thinking Types
 * 
 * Comprehensive type definitions for KripTik AI's advanced multi-model reasoning system.
 * Supports:
 * - Extended thinking orchestration
 * - Tree-of-Thought (ToT) reasoning
 * - Multi-agent reasoning swarm
 * - Task decomposition
 * - Thought artifact storage
 */

// ============================================================================
// Complexity & Strategy Types
// ============================================================================

/**
 * Task complexity levels for routing decisions
 */
export type ComplexityLevel = 'trivial' | 'simple' | 'moderate' | 'complex' | 'extreme';

/**
 * Reasoning strategies available
 */
export type ReasoningStrategy = 
  | 'chain_of_thought'   // Sequential CoT - straightforward tasks
  | 'tree_of_thought'    // ToT - parallel path exploration
  | 'multi_agent'        // Swarm - parallel agents with synthesis
  | 'hybrid';            // Combination of strategies

/**
 * Model tier for routing to appropriate models
 */
export type ModelTier = 'maximum' | 'deep' | 'standard' | 'fast';

/**
 * Provider types for model routing
 */
export type ProviderType = 'anthropic' | 'openai' | 'openrouter';

// ============================================================================
// Budget & Resource Types
// ============================================================================

/**
 * Thinking budget allocation and tracking
 */
export interface ThinkingBudget {
  /** Total tokens allocated for thinking */
  totalTokens: number;
  /** Tokens used so far */
  usedTokens: number;
  /** Remaining tokens available */
  remainingTokens: number;
  /** Budget per reasoning step */
  budgetPerStep: number;
  /** Maximum steps allowed within budget */
  maxSteps: number;
  /** Credit cost estimate */
  estimatedCreditCost: number;
}

/**
 * Token usage tracking
 */
export interface TokenUsage {
  /** Prompt tokens used */
  promptTokens: number;
  /** Completion tokens used */
  completionTokens: number;
  /** Thinking/reasoning tokens (extended thinking) */
  thinkingTokens: number;
  /** Cache read tokens (if applicable) */
  cacheReadTokens?: number;
  /** Cache write tokens (if applicable) */
  cacheWriteTokens?: number;
  /** Total tokens */
  totalTokens: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Hyper-Thinking configuration
 */
export interface HyperThinkingConfig {
  /** Reasoning strategy to use */
  strategy: ReasoningStrategy;
  /** Model tier for routing */
  modelTier: ModelTier;
  /** Maximum thinking budget in tokens */
  maxThinkingBudget: number;
  /** Enable streaming output */
  enableStreaming: boolean;
  /** Enable hallucination detection */
  enableHallucinationDetection: boolean;
  /** Store artifacts for learning */
  storeArtifacts: boolean;
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Maximum parallel operations */
  maxParallelOperations: number;
  /** Temperature for generation (0-1) */
  temperature: number;
  /** Top-p for generation */
  topP?: number;
  /** Force specific model (override routing) */
  forceModel?: string;
  /** Force specific provider */
  forceProvider?: ProviderType;
  /** User ID for tracking */
  userId?: string;
  /** Project ID for context */
  projectId?: string;
  /** Build intent ID for context */
  buildIntentId?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_HYPER_THINKING_CONFIG: HyperThinkingConfig = {
  strategy: 'chain_of_thought',
  modelTier: 'standard',
  maxThinkingBudget: 32000,
  enableStreaming: true,
  enableHallucinationDetection: true,
  storeArtifacts: true,
  timeoutMs: 300000, // 5 minutes
  maxParallelOperations: 5,
  temperature: 0.7,
};

// ============================================================================
// Reasoning Step Types
// ============================================================================

/**
 * Evaluation result for a reasoning step
 */
export interface StepEvaluation {
  /** Score from 0-1 */
  score: number;
  /** Confidence in the evaluation */
  confidence: number;
  /** Reasoning behind the score */
  reasoning: string;
  /** Is this a terminal/final step? */
  isTerminal: boolean;
  /** Should this branch be expanded further? */
  shouldExpand: boolean;
  /** Detected issues or concerns */
  concerns?: string[];
  /** Suggestions for improvement */
  suggestions?: string[];
}

/**
 * A single reasoning step in the thinking process
 */
export interface ReasoningStep {
  /** Unique identifier */
  id: string;
  /** Parent step ID (null for root) */
  parentId: string | null;
  /** Depth in reasoning tree */
  depth: number;
  /** The actual thought/reasoning content */
  thought: string;
  /** Evaluation of this step */
  evaluation?: StepEvaluation;
  /** Child steps (for ToT) */
  children: string[];
  /** Model used for this step */
  model: string;
  /** Provider used */
  provider: ProviderType;
  /** Token usage for this step */
  tokenUsage: TokenUsage;
  /** Latency in milliseconds */
  latencyMs: number;
  /** Timestamp */
  createdAt: Date;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Complete result from hyper-thinking
 */
export interface HyperThinkingResult {
  /** Was the reasoning successful? */
  success: boolean;
  /** Strategy used */
  strategy: ReasoningStrategy;
  /** Final answer/output */
  finalAnswer: string;
  /** Complete reasoning path */
  reasoningPath: ReasoningStep[];
  /** Overall confidence score (0-1) */
  confidence: number;
  /** Total tokens used */
  totalTokens: TokenUsage;
  /** Total latency in milliseconds */
  totalLatencyMs: number;
  /** Models used during reasoning */
  modelsUsed: string[];
  /** Thinking budget status */
  budgetStatus: ThinkingBudget;
  /** Hallucination warnings (if any) */
  hallucinationWarnings?: HallucinationWarning[];
  /** Artifact ID if stored */
  artifactId?: string;
  /** Error message if failed */
  error?: string;
  /** Metadata */
  metadata: {
    startedAt: Date;
    completedAt: Date;
    stepsCompleted: number;
    stepsEvaluated: number;
    branchesPruned?: number;
    agentsUsed?: number;
    conflictsResolved?: number;
  };
}

// ============================================================================
// Streaming Types
// ============================================================================

/**
 * Streaming event types
 */
export type StreamingEventType =
  | 'thinking_start'
  | 'thinking_step'
  | 'thinking_evaluation'
  | 'thinking_branch'
  | 'thinking_synthesis'
  | 'thinking_complete'
  | 'hallucination_warning'
  | 'error';

/**
 * Streaming event from hyper-thinking
 */
export interface StreamingEvent {
  /** Event type */
  type: StreamingEventType;
  /** Event content */
  content: string;
  /** Event metadata */
  metadata: {
    stepId?: string;
    depth?: number;
    confidence?: number;
    hallucinationScore?: number;
    tokensUsed?: number;
    progress?: number;
  };
  /** Timestamp */
  timestamp: Date;
}

// ============================================================================
// Hallucination Detection Types
// ============================================================================

/**
 * Hallucination warning from monitoring
 */
export interface HallucinationWarning {
  /** Unique identifier */
  id: string;
  /** Step ID that triggered warning */
  stepId: string;
  /** Hallucination score (0-1, higher = more likely hallucination) */
  score: number;
  /** Detected indicators */
  indicators: {
    /** Semantic drift from original topic */
    semanticDrift: number;
    /** Factual inconsistency with prior steps */
    factualInconsistency: number;
    /** Logical contradiction */
    logicalContradiction: number;
    /** Sudden confidence drop */
    confidenceDrop: number;
  };
  /** Should reasoning pause for review? */
  shouldPause: boolean;
  /** Suggested action */
  suggestedAction: 'continue' | 'verify' | 'backtrack' | 'stop';
  /** Explanation */
  explanation: string;
  /** Timestamp */
  timestamp: Date;
}

// ============================================================================
// Thought Artifact Types
// ============================================================================

/**
 * Artifact types for storage
 */
export type ThoughtArtifactType =
  | 'reasoning_chain'     // Complete reasoning chain
  | 'thought_branch'      // Single ToT branch
  | 'agent_contribution'  // Multi-agent contribution
  | 'synthesis'           // Synthesis result
  | 'decomposition'       // Task decomposition
  | 'skeleton';           // Reusable reasoning skeleton

/**
 * Thought artifact for memory storage
 */
export interface ThoughtArtifact {
  /** Unique identifier */
  id: string;
  /** Artifact type */
  type: ThoughtArtifactType;
  /** The content/reasoning */
  content: string;
  /** Embedding vector (from BGE-M3) */
  embedding?: number[];
  /** Original problem context */
  problemContext: string;
  /** Strategy used */
  strategy: ReasoningStrategy;
  /** Confidence score */
  confidence: number;
  /** Tokens used */
  tokensUsed: number;
  /** Was this reasoning successful? */
  successful: boolean;
  /** Usage count (for skeletons) */
  usageCount: number;
  /** Success rate (for skeletons) */
  successRate: number;
  /** User ID */
  userId?: string;
  /** Project ID */
  projectId?: string;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

// ============================================================================
// Complexity Analysis Types
// ============================================================================

/**
 * Factors contributing to complexity
 */
export interface ComplexityFactors {
  /** Length of the prompt in tokens */
  tokenCount: number;
  /** Number of distinct requirements */
  requirementCount: number;
  /** Domain complexity score (0-1) */
  domainComplexity: number;
  /** Number of constraints mentioned */
  constraintCount: number;
  /** Ambiguity score (0-1) */
  ambiguityScore: number;
  /** Technical depth required */
  technicalDepth: number;
  /** Integration complexity */
  integrationComplexity: number;
  /** Reasoning depth required */
  reasoningDepthRequired: number;
}

/**
 * Result of complexity analysis
 */
export interface ComplexityAnalysis {
  /** Determined complexity level */
  level: ComplexityLevel;
  /** Numeric score (0-100) */
  score: number;
  /** Recommended strategy */
  recommendedStrategy: ReasoningStrategy;
  /** Recommended model tier */
  recommendedModelTier: ModelTier;
  /** Contributing factors */
  factors: ComplexityFactors;
  /** Reasoning behind the analysis */
  reasoning: string;
  /** Estimated tokens needed */
  estimatedTokensNeeded: number;
  /** Estimated time in ms */
  estimatedTimeMs: number;
}

// ============================================================================
// Model Routing Types
// ============================================================================

/**
 * Model configuration for reasoning
 */
export interface ModelConfig {
  /** Model identifier */
  modelId: string;
  /** Provider type */
  provider: ProviderType;
  /** Display name */
  displayName: string;
  /** Maximum context window */
  maxContextTokens: number;
  /** Maximum thinking budget */
  maxThinkingBudget: number;
  /** Supports extended thinking? */
  supportsExtendedThinking: boolean;
  /** Supports streaming? */
  supportsStreaming: boolean;
  /** Cost per 1K input tokens */
  costPerInputK: number;
  /** Cost per 1K output tokens */
  costPerOutputK: number;
  /** Cost per 1K thinking tokens */
  costPerThinkingK?: number;
  /** Best for these task types */
  bestFor: string[];
  /** Model tier */
  tier: ModelTier;
}

/**
 * Routing decision result
 */
export interface RoutingDecision {
  /** Selected model */
  model: ModelConfig;
  /** Fallback models in order */
  fallbacks: ModelConfig[];
  /** Reasoning for selection */
  reasoning: string;
  /** Allocated thinking budget */
  thinkingBudget: number;
  /** Estimated cost */
  estimatedCost: number;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Input to hyper-thinking system
 */
export interface HyperThinkingInput {
  /** The problem/prompt to reason about */
  prompt: string;
  /** System context/instructions */
  systemPrompt?: string;
  /** Configuration options */
  config?: Partial<HyperThinkingConfig>;
  /** Existing context to include */
  context?: string;
  /** Previous reasoning to continue from */
  continuationFrom?: string;
  /** Hints or constraints */
  hints?: string[];
  /** Expected output format */
  outputFormat?: 'text' | 'json' | 'code' | 'structured';
  /** Schema for structured output */
  outputSchema?: Record<string, unknown>;
}

/**
 * Extended thinking configuration per provider
 */
export interface ExtendedThinkingConfig {
  /** For Anthropic: budget_tokens */
  anthropic?: {
    type: 'enabled';
    budgetTokens: number;
  };
  /** For OpenAI: reasoning effort */
  openai?: {
    reasoningEffort: 'low' | 'medium' | 'high';
  };
  /** For OpenRouter/Gemini: thinking level */
  openrouter?: {
    reasoning?: boolean;
    thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
  };
}

// ============================================================================
// Provider-specific Types
// ============================================================================

/**
 * Anthropic-specific message with extended thinking
 */
export interface AnthropicReasoningMessage {
  role: 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'thinking';
    text?: string;
    thinking?: string;
  }>;
}

/**
 * OpenAI-specific message with reasoning
 */
export interface OpenAIReasoningMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
}

/**
 * OpenRouter-specific message
 */
export interface OpenRouterReasoningMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Hyper-thinking error codes
 */
export type HyperThinkingErrorCode =
  | 'BUDGET_EXCEEDED'
  | 'TIMEOUT'
  | 'MODEL_UNAVAILABLE'
  | 'PROVIDER_ERROR'
  | 'HALLUCINATION_DETECTED'
  | 'INVALID_CONFIG'
  | 'CONTEXT_TOO_LONG'
  | 'RATE_LIMITED'
  | 'INSUFFICIENT_CREDITS';

/**
 * Hyper-thinking error
 */
export class HyperThinkingError extends Error {
  constructor(
    public code: HyperThinkingErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'HyperThinkingError';
  }
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Complexity level thresholds (score 0-100)
 */
export const COMPLEXITY_THRESHOLDS = {
  trivial: 20,
  simple: 40,
  moderate: 60,
  complex: 80,
  extreme: 100,
} as const;

/**
 * Default thinking budgets per tier
 */
export const DEFAULT_THINKING_BUDGETS: Record<ModelTier, number> = {
  maximum: 128000,
  deep: 64000,
  standard: 32000,
  fast: 8000,
};

/**
 * Model tier to strategy mapping
 */
export const TIER_STRATEGY_MAP: Record<ComplexityLevel, ReasoningStrategy> = {
  trivial: 'chain_of_thought',
  simple: 'chain_of_thought',
  moderate: 'chain_of_thought',
  complex: 'tree_of_thought',
  extreme: 'multi_agent',
};

/**
 * Complexity level to model tier mapping
 */
export const COMPLEXITY_TIER_MAP: Record<ComplexityLevel, ModelTier> = {
  trivial: 'fast',
  simple: 'standard',
  moderate: 'standard',
  complex: 'deep',
  extreme: 'maximum',
};
