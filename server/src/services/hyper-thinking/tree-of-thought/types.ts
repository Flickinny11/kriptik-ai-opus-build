/**
 * Tree-of-Thought Types
 *
 * Types for ToT reasoning - parallel exploration of multiple solution paths.
 * Based on "Tree of Thoughts" paper (Yao et al., 2023):
 * - Game of 24: GPT-4 CoT = 4% success, GPT-4 ToT = 74% success (18.5x improvement)
 */

import type { TokenUsage, ModelConfig, ProviderType } from '../types.js';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Search strategy for traversing the thought tree
 */
export type ToTStrategy = 'bfs' | 'dfs' | 'beam';

/**
 * Generation strategy for diverse thoughts
 */
export type GenerationStrategy =
  | 'direct'        // Direct approach to problem
  | 'analogy'       // Solve by analogy to similar problems
  | 'decomposition' // Break into smaller parts
  | 'constraint'    // Focus on constraints first
  | 'creative';     // Novel/unconventional approaches

// ============================================================================
// Thought Node
// ============================================================================

/**
 * Evaluation result for a thought
 */
export interface ThoughtEvaluation {
  /** Score from 0-1 */
  score: number;
  /** Confidence in evaluation (0-1) */
  confidence: number;
  /** Reasoning behind the score */
  reasoning: string;
  /** Is this a terminal/final answer? */
  isTerminal: boolean;
  /** Should this branch be expanded further? */
  shouldExpand: boolean;
  /** Detected issues or concerns */
  concerns?: string[];
  /** Suggestions for improvement */
  suggestions?: string[];
}

/**
 * A node in the thought tree
 */
export interface ThoughtNode {
  /** Unique identifier */
  id: string;
  /** Parent node ID (null for root) */
  parentId: string | null;
  /** Depth in tree (0 = root) */
  depth: number;
  /** The thought content */
  thought: string;
  /** Generation strategy used */
  generationStrategy: GenerationStrategy;
  /** Evaluation result */
  evaluation?: ThoughtEvaluation;
  /** Child node IDs */
  children: string[];
  /** Model used to generate this thought */
  model: string;
  /** Provider used */
  provider: ProviderType;
  /** Token usage */
  tokenUsage: TokenUsage;
  /** Latency in ms */
  latencyMs: number;
  /** Created timestamp */
  createdAt: Date;
  /** Was this node pruned? */
  pruned: boolean;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

// ============================================================================
// Thought Tree
// ============================================================================

/**
 * Complete thought tree structure
 */
export interface ThoughtTree {
  /** Root node ID */
  rootId: string;
  /** All nodes by ID */
  nodes: Map<string, ThoughtNode>;
  /** Original problem/prompt */
  problem: string;
  /** Strategy used */
  strategy: ToTStrategy;
  /** Beam width (for beam search) */
  beamWidth: number;
  /** Maximum depth */
  maxDepth: number;
  /** Total nodes created */
  totalNodes: number;
  /** Nodes evaluated */
  evaluatedNodes: number;
  /** Best path node IDs (root to terminal) */
  bestPath: string[];
  /** Best score achieved */
  bestScore: number;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Tree-of-Thought configuration
 */
export interface ToTConfig {
  /** Search strategy */
  strategy: ToTStrategy;
  /** Beam width for beam search */
  beamWidth: number;
  /** Maximum tree depth */
  maxDepth: number;
  /** Maximum branches per node */
  maxBranches: number;
  /** Evaluation threshold (nodes below this may be pruned) */
  evaluationThreshold: number;
  /** Number of branches to explore in parallel */
  parallelBranches: number;
  /** Enable automatic pruning */
  enablePruning: boolean;
  /** Pruning threshold (score below which to prune) */
  pruningThreshold: number;
  /** Temperature for thought generation */
  generationTemperature: number;
  /** Temperature for evaluation */
  evaluationTemperature: number;
  /** Minimum score to consider successful */
  minSuccessScore: number;
  /** Enable consistency voting for evaluation */
  enableConsistencyVoting: boolean;
  /** Number of votes for consistency */
  consistencyVotes: number;
}

/**
 * Default ToT configuration
 */
export const DEFAULT_TOT_CONFIG: ToTConfig = {
  strategy: 'beam',
  beamWidth: 5,
  maxDepth: 4,
  maxBranches: 3,
  evaluationThreshold: 0.5,
  parallelBranches: 3,
  enablePruning: true,
  pruningThreshold: 0.3,
  generationTemperature: 0.8,
  evaluationTemperature: 0.3,
  minSuccessScore: 0.7,
  enableConsistencyVoting: false,
  consistencyVotes: 3,
};

// ============================================================================
// Generation & Evaluation
// ============================================================================

/**
 * Prompt for generating thoughts
 */
export interface ToTGenerationPrompt {
  /** The original problem */
  problem: string;
  /** Current reasoning path (parent thoughts) */
  currentPath: string[];
  /** Current depth */
  depth: number;
  /** Optional hint or constraint */
  hint?: string;
  /** Strategy to use */
  strategy: GenerationStrategy;
  /** Number of thoughts to generate */
  numThoughts: number;
}

/**
 * Prompt for evaluating thoughts
 */
export interface ToTEvaluationPrompt {
  /** The original problem */
  problem: string;
  /** The thought to evaluate */
  thought: string;
  /** The path to this thought */
  path: string[];
  /** Current depth */
  depth: number;
  /** Success criteria */
  successCriteria?: string[];
}

/**
 * Generated thought result
 */
export interface GeneratedThought {
  /** The thought content */
  thought: string;
  /** Strategy used */
  strategy: GenerationStrategy;
  /** Token usage */
  tokenUsage: TokenUsage;
  /** Generation latency */
  latencyMs: number;
}

// ============================================================================
// Results
// ============================================================================

/**
 * ToT solve result
 */
export interface ToTResult {
  /** Was solving successful? */
  success: boolean;
  /** The complete tree */
  tree: ThoughtTree;
  /** Final answer */
  finalAnswer: string;
  /** Confidence in answer (0-1) */
  confidence: number;
  /** Total tokens used */
  totalTokens: TokenUsage;
  /** Total latency in ms */
  totalLatencyMs: number;
  /** Models used */
  modelsUsed: string[];
  /** Best reasoning path (thoughts only) */
  bestReasoningPath: string[];
  /** Alternative paths considered */
  alternativePaths: Array<{
    path: string[];
    score: number;
  }>;
  /** Metadata */
  metadata: {
    nodesGenerated: number;
    nodesEvaluated: number;
    nodesPruned: number;
    maxDepthReached: number;
    strategyUsed: ToTStrategy;
    beamWidth: number;
  };
}

// ============================================================================
// Progress Events
// ============================================================================

/**
 * ToT progress event types
 */
export type ToTProgressEventType =
  | 'tree_start'
  | 'node_generated'
  | 'node_evaluated'
  | 'node_pruned'
  | 'branch_expanded'
  | 'depth_complete'
  | 'best_path_updated'
  | 'synthesis_start'
  | 'tree_complete'
  | 'error';

/**
 * ToT progress event
 */
export interface ToTProgressEvent {
  /** Event type */
  type: ToTProgressEventType;
  /** Event message */
  message: string;
  /** Current state */
  state: {
    nodesGenerated: number;
    nodesEvaluated: number;
    currentDepth: number;
    bestScore: number;
    progress: number; // 0-1
  };
  /** Related node (if applicable) */
  node?: ThoughtNode;
  /** Timestamp */
  timestamp: Date;
}

// ============================================================================
// Synthesis
// ============================================================================

/**
 * Input for synthesis
 */
export interface SynthesisInput {
  /** The original problem */
  problem: string;
  /** The complete tree */
  tree: ThoughtTree;
  /** Best path nodes */
  bestPath: ThoughtNode[];
  /** Alternative good paths */
  alternativePaths: ThoughtNode[][];
  /** Insights from pruned but interesting branches */
  prunedInsights?: string[];
}

/**
 * Synthesis result
 */
export interface SynthesisResult {
  /** Final answer */
  answer: string;
  /** Reasoning chain */
  reasoning: string;
  /** Confidence (0-1) */
  confidence: number;
  /** Insights incorporated from alternatives */
  incorporatedInsights: string[];
  /** Token usage */
  tokenUsage: TokenUsage;
  /** Latency */
  latencyMs: number;
}
