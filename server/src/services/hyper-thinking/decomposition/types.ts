/**
 * Task Decomposition Engine Types
 *
 * Types for breaking complex tasks into manageable subtasks
 * with dependency tracking and execution order optimization.
 */

import type { TokenUsage, ModelTier, ComplexityLevel } from '../types.js';

// ============================================================================
// Strategy Types
// ============================================================================

/**
 * Decomposition strategy types
 */
export type DecompositionStrategy =
  | 'functional'     // Break by feature/capability
  | 'data_flow'      // Break by data transformation steps
  | 'architectural'  // Break by system layers
  | 'temporal'       // Break by execution order
  | 'hybrid';        // Combination of strategies

/**
 * Subtask types
 */
export type SubtaskType =
  | 'feature'        // Feature implementation
  | 'refactor'       // Code refactoring
  | 'integration'    // System integration
  | 'analysis'       // Analysis/research
  | 'design'         // Design/architecture
  | 'testing'        // Testing/validation
  | 'documentation'  // Documentation
  | 'configuration'  // Configuration/setup
  | 'data'           // Data processing
  | 'ui'             // UI/UX work
  | 'api'            // API development
  | 'infrastructure' // Infrastructure setup
  | 'other';

/**
 * Subtask execution status
 */
export type SubtaskStatus =
  | 'pending'      // Not yet started
  | 'blocked'      // Waiting on dependencies
  | 'ready'        // Dependencies satisfied, ready to execute
  | 'in_progress'  // Currently executing
  | 'complete'     // Successfully completed
  | 'failed'       // Failed execution
  | 'skipped';     // Skipped (e.g., optional task)

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * A subtask in the decomposition tree
 */
export interface Subtask {
  /** Unique identifier */
  id: string;
  /** Parent subtask ID (null for root tasks) */
  parentId: string | null;
  /** Short title */
  title: string;
  /** Detailed description */
  description: string;
  /** Type of subtask */
  type: SubtaskType;
  /** Complexity level */
  complexity: ComplexityLevel;
  /** Estimated tokens to complete */
  estimatedTokens: number;
  /** IDs of subtasks this depends on */
  dependencies: string[];
  /** IDs of child subtasks */
  children: string[];
  /** Current status */
  status: SubtaskStatus;
  /** Result when completed */
  result?: SubtaskResult;
  /** Depth in tree (0 = root) */
  depth: number;
  /** Execution stage (for parallel scheduling) */
  stage?: number;
  /** Priority (higher = more important) */
  priority: number;
  /** Whether this can be parallelized with siblings */
  parallelizable: boolean;
  /** Tags for categorization */
  tags: string[];
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Result from executing a subtask
 */
export interface SubtaskResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Output content */
  output: string;
  /** Confidence in result */
  confidence: number;
  /** Token usage */
  tokenUsage: TokenUsage;
  /** Execution latency */
  latencyMs: number;
  /** Any artifacts produced */
  artifacts?: string[];
  /** Error message if failed */
  error?: string;
  /** Completed timestamp */
  completedAt: Date;
}

/**
 * Dependency relationship between subtasks
 */
export interface DependencyEdge {
  /** Source subtask ID (dependent) */
  from: string;
  /** Target subtask ID (dependency) */
  to: string;
  /** Dependency type */
  type: 'hard' | 'soft' | 'optional';
  /** Description of relationship */
  description?: string;
}

/**
 * Dependency graph for execution ordering
 */
export interface DependencyGraph {
  /** All edges in the graph */
  edges: DependencyEdge[];
  /** Subtasks grouped by execution stage */
  stages: string[][];
  /** Any circular dependencies detected */
  circularDependencies: string[][];
  /** Parallelization opportunities */
  parallelGroups: string[][];
  /** Critical path (longest dependency chain) */
  criticalPath: string[];
  /** Total estimated stages */
  totalStages: number;
}

/**
 * The complete decomposition tree
 */
export interface DecompositionTree {
  /** Root task ID */
  rootTaskId: string;
  /** Original task description */
  originalTask: string;
  /** Strategy used */
  strategy: DecompositionStrategy;
  /** All subtasks indexed by ID */
  subtasks: Map<string, Subtask>;
  /** Dependency graph */
  dependencyGraph: DependencyGraph;
  /** Execution order (flattened stages) */
  executionOrder: string[];
  /** Total estimated tokens */
  totalEstimatedTokens: number;
  /** Estimated execution time */
  estimatedDurationMs: number;
  /** Tree depth (max levels) */
  maxDepth: number;
  /** Created timestamp */
  createdAt: Date;
  /** Metadata */
  metadata: DecompositionMetadata;
}

/**
 * Metadata about the decomposition process
 */
export interface DecompositionMetadata {
  /** Model used for decomposition */
  model: string;
  /** Total tokens used for decomposition */
  decompositionTokens: TokenUsage;
  /** Latency of decomposition */
  decompositionLatencyMs: number;
  /** Number of decomposition iterations */
  iterations: number;
  /** Strategy selection reasoning */
  strategyReasoning: string;
  /** Pattern ID if matched from Qdrant */
  matchedPatternId?: string;
  /** Pattern similarity score */
  patternSimilarity?: number;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Decomposition configuration
 */
export interface DecompositionConfig {
  /** Strategy to use */
  strategy: DecompositionStrategy;
  /** Maximum tree depth */
  maxDepth: number;
  /** Minimum subtask size (tokens) */
  minSubtaskSize: number;
  /** Maximum subtask size (tokens) */
  maxSubtaskSize: number;
  /** Enable automatic parallelization detection */
  enableParallelization: boolean;
  /** Validate dependencies for cycles */
  validateDependencies: boolean;
  /** Maximum subtasks to create */
  maxSubtasks: number;
  /** Model tier for decomposition */
  modelTier: ModelTier;
  /** Temperature for decomposition model */
  temperature: number;
  /** Store successful patterns in Qdrant */
  storePatterns: boolean;
  /** Search for similar patterns before decomposing */
  usePatternMatching: boolean;
  /** Minimum pattern similarity to use */
  patternSimilarityThreshold: number;
}

/**
 * Default decomposition configuration
 */
export const DEFAULT_DECOMPOSITION_CONFIG: DecompositionConfig = {
  strategy: 'hybrid',
  maxDepth: 4,
  minSubtaskSize: 500,
  maxSubtaskSize: 10000,
  enableParallelization: true,
  validateDependencies: true,
  maxSubtasks: 20,
  modelTier: 'deep',
  temperature: 0.5,
  storePatterns: true,
  usePatternMatching: true,
  patternSimilarityThreshold: 0.75,
};

// ============================================================================
// Decomposition Result
// ============================================================================

/**
 * Result from decomposition
 */
export interface DecompositionResult {
  /** Whether decomposition succeeded */
  success: boolean;
  /** The decomposition tree */
  tree: DecompositionTree;
  /** Summary statistics */
  summary: DecompositionSummary;
  /** Warnings generated during decomposition */
  warnings: string[];
  /** Error if failed */
  error?: string;
}

/**
 * Summary of decomposition
 */
export interface DecompositionSummary {
  /** Total number of subtasks */
  totalSubtasks: number;
  /** Subtasks by type */
  subtasksByType: Record<SubtaskType, number>;
  /** Subtasks by complexity */
  subtasksByComplexity: Record<ComplexityLevel, number>;
  /** Number of execution stages */
  executionStages: number;
  /** Maximum parallelism achievable */
  maxParallelism: number;
  /** Critical path length (stages) */
  criticalPathLength: number;
  /** Total estimated tokens */
  totalEstimatedTokens: number;
  /** Estimated total duration */
  estimatedDurationMs: number;
  /** Whether pattern was matched */
  patternMatched: boolean;
}

// ============================================================================
// Execution Types
// ============================================================================

/**
 * Execution context for subtask
 */
export interface ExecutionContext {
  /** Subtask being executed */
  subtask: Subtask;
  /** Results from dependencies */
  dependencyResults: Map<string, SubtaskResult>;
  /** Shared context/state */
  sharedContext: string;
  /** Remaining budget */
  remainingBudget: number;
  /** Execution stage */
  stage: number;
  /** Total stages */
  totalStages: number;
}

/**
 * Executor function type
 */
export type SubtaskExecutor = (
  context: ExecutionContext
) => Promise<SubtaskResult>;

/**
 * Progress event during execution
 */
export interface DecompositionProgressEvent {
  /** Event type */
  type: DecompositionProgressType;
  /** Event message */
  message: string;
  /** Current subtask (if applicable) */
  subtaskId?: string;
  /** Current stage */
  stage: number;
  /** Total stages */
  totalStages: number;
  /** Progress (0-1) */
  progress: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Progress event types
 */
export type DecompositionProgressType =
  | 'decomposition_start'
  | 'decomposition_complete'
  | 'strategy_selected'
  | 'pattern_matched'
  | 'subtask_created'
  | 'dependencies_analyzed'
  | 'execution_start'
  | 'stage_start'
  | 'subtask_start'
  | 'subtask_complete'
  | 'subtask_failed'
  | 'stage_complete'
  | 'execution_complete'
  | 'error';

// ============================================================================
// Qdrant Pattern Types
// ============================================================================

/**
 * Stored decomposition pattern
 */
export interface DecompositionPattern {
  /** Pattern ID */
  id: string;
  /** Original task that was decomposed */
  originalTask: string;
  /** Task embedding vector */
  taskEmbedding: number[];
  /** Strategy that was used */
  strategy: DecompositionStrategy;
  /** Serialized tree structure */
  treeStructure: SerializedDecompositionTree;
  /** Success rate of this pattern */
  successRate: number;
  /** Number of times used */
  usageCount: number;
  /** Average execution time */
  avgExecutionTimeMs: number;
  /** Tags */
  tags: string[];
  /** Created timestamp */
  createdAt: Date;
  /** Last used timestamp */
  lastUsedAt: Date;
}

/**
 * Serialized tree for storage
 */
export interface SerializedDecompositionTree {
  /** Root task */
  rootTask: string;
  /** Strategy */
  strategy: DecompositionStrategy;
  /** Subtasks as array */
  subtasks: Array<Omit<Subtask, 'result'>>;
  /** Dependency edges */
  dependencies: DependencyEdge[];
  /** Metadata */
  metadata: Partial<DecompositionMetadata>;
}
