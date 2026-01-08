/**
 * Thought Artifact System - Types
 *
 * Defines types for memory and context management in long reasoning chains.
 * Integrates with Qdrant collections: hyper_thinking, decomposition, reasoning_skeletons
 */

// ============================================================================
// Core Artifact Types
// ============================================================================

export type ArtifactType =
  | 'reasoning_chain'
  | 'thought_node'
  | 'synthesis'
  | 'evaluation'
  | 'decomposition'
  | 'agent_result'
  | 'conflict_resolution';

export type SkeletonType =
  | 'chain_of_thought'
  | 'tree_of_thought'
  | 'multi_agent'
  | 'decomposition'
  | 'evaluation'
  | 'synthesis';

export type ProblemPattern =
  | 'optimization'
  | 'debugging'
  | 'design'
  | 'integration'
  | 'architecture'
  | 'refactoring'
  | 'implementation'
  | 'analysis';

// ThinkingDomain must match HyperThinkingPayload.problem_domain in collections.ts
export type ThinkingDomain =
  | 'architecture'
  | 'ui'
  | 'api'
  | 'database'
  | 'integration';

// ============================================================================
// Thought Artifact Interface
// ============================================================================

export interface ThoughtArtifact {
  /** Unique identifier */
  id: string;
  /** Type of artifact */
  type: ArtifactType;
  /** Main content of the artifact */
  content: string;
  /** Pre-computed embedding (1024 dimensions for BGE-M3) */
  embedding?: number[];
  /** Context that led to this thought */
  problemContext: string;
  /** Strategy used to generate this artifact */
  strategy: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Tokens consumed in generation */
  tokensUsed: number;
  /** Whether this artifact led to successful outcome */
  successful?: boolean;
  /** Related artifact IDs */
  relatedArtifacts?: string[];
  /** Parent artifact ID (for hierarchical chains) */
  parentId?: string;
  /** Child artifact IDs */
  childIds?: string[];
  /** Depth in reasoning chain */
  depth: number;
  /** Model used for generation */
  model?: string;
  /** Problem domain */
  domain?: ThinkingDomain;
  /** Complexity level (1-10) */
  complexityLevel?: number;
  /** Additional metadata */
  metadata: ThoughtArtifactMetadata;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt?: string;
}

export interface ThoughtArtifactMetadata {
  /** Session ID for grouping artifacts */
  sessionId?: string;
  /** Project ID for context */
  projectId?: string;
  /** User ID for attribution */
  userId?: string;
  /** Tenant ID for multitenancy */
  tenantId?: string;
  /** Build ID for build context */
  buildId?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Custom key-value pairs */
  custom?: Record<string, unknown>;
}

// ============================================================================
// Reasoning Skeleton Interface
// ============================================================================

export interface ReasoningSkeleton {
  /** Unique identifier */
  id: string;
  /** Pattern of problems this skeleton solves */
  problemPattern: ProblemPattern;
  /** Type of reasoning skeleton */
  skeletonType: SkeletonType;
  /** Ordered steps in the skeleton */
  steps: ReasoningStep[];
  /** Success rate from historical usage (0-1) */
  successRate: number;
  /** Number of times used */
  timesUsed: number;
  /** Pre-computed embedding */
  embedding?: number[];
  /** Description of the skeleton */
  description: string;
  /** Example problem this skeleton solved */
  exampleProblem?: string;
  /** Example solution using this skeleton */
  exampleSolution?: string;
  /** Domains where this skeleton excels */
  applicableDomains: ThinkingDomain[];
  /** Minimum complexity level this skeleton handles */
  minComplexity: number;
  /** Maximum complexity level this skeleton handles */
  maxComplexity: number;
  /** Whether this skeleton is validated */
  validated: boolean;
  /** Version number */
  version: number;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt?: string;
}

export interface ReasoningStep {
  /** Step number */
  order: number;
  /** Step name/title */
  name: string;
  /** Step description/instructions */
  description: string;
  /** Expected output format */
  expectedOutput?: string;
  /** Dependencies on previous steps */
  dependencies?: number[];
  /** Whether this step is optional */
  optional?: boolean;
  /** Estimated tokens for this step */
  estimatedTokens?: number;
}

// ============================================================================
// Memory Types
// ============================================================================

export interface MemoryEntry {
  /** Unique identifier */
  id: string;
  /** The memory content */
  content: string;
  /** Embedding for similarity search */
  embedding?: number[];
  /** Importance score (0-1) */
  importance: number;
  /** Access count */
  accessCount: number;
  /** Last accessed timestamp */
  lastAccessed: string;
  /** Source artifact ID */
  sourceArtifactId?: string;
  /** Context summary */
  contextSummary?: string;
  /** Memory type */
  memoryType: 'short_term' | 'working' | 'long_term';
  /** Decay factor for memory pruning */
  decayFactor: number;
  /** Creation timestamp */
  createdAt: string;
}

export interface MemoryContext {
  /** Current session memories */
  sessionMemories: MemoryEntry[];
  /** Retrieved long-term memories */
  relevantMemories: MemoryEntry[];
  /** Total context tokens */
  contextTokens: number;
  /** Context window limit */
  contextLimit: number;
  /** Utilization percentage */
  utilization: number;
}

// ============================================================================
// Context Aggregation Types
// ============================================================================

export interface ContextChunk {
  /** Unique identifier */
  id: string;
  /** Content of this chunk */
  content: string;
  /** Source artifact or memory ID */
  sourceId: string;
  /** Relevance score (0-1) */
  relevance: number;
  /** Priority for inclusion */
  priority: number;
  /** Token count */
  tokenCount: number;
  /** Chunk type */
  type: 'artifact' | 'memory' | 'summary' | 'instruction';
  /** Creation order */
  order: number;
}

export interface AggregatedContext {
  /** Ordered context chunks */
  chunks: ContextChunk[];
  /** Total tokens */
  totalTokens: number;
  /** Context limit */
  limit: number;
  /** Whether context was truncated */
  truncated: boolean;
  /** Summary of excluded content */
  excludedSummary?: string;
  /** Aggregation strategy used */
  strategy: ContextAggregationStrategy;
}

export type ContextAggregationStrategy =
  | 'relevance_first'
  | 'recency_first'
  | 'importance_weighted'
  | 'hybrid';

// ============================================================================
// Storage Configuration
// ============================================================================

export interface ArtifactStorageConfig {
  /** Enable embedding generation */
  generateEmbeddings: boolean;
  /** Enable automatic success tracking */
  trackSuccess: boolean;
  /** Minimum confidence to store */
  minConfidenceThreshold: number;
  /** Enable long-term memory consolidation */
  enableConsolidation: boolean;
  /** Consolidation threshold (how successful before promoting) */
  consolidationThreshold: number;
  /** Maximum artifacts per session */
  maxArtifactsPerSession: number;
  /** Memory decay rate (0-1) */
  memoryDecayRate: number;
  /** Context window size in tokens */
  contextWindowSize: number;
}

export const DEFAULT_ARTIFACT_STORAGE_CONFIG: ArtifactStorageConfig = {
  generateEmbeddings: true,
  trackSuccess: true,
  minConfidenceThreshold: 0.3,
  enableConsolidation: true,
  consolidationThreshold: 0.8,
  maxArtifactsPerSession: 1000,
  memoryDecayRate: 0.1,
  contextWindowSize: 128000,
};

// ============================================================================
// Skeleton Library Configuration
// ============================================================================

export interface SkeletonLibraryConfig {
  /** Minimum success rate to keep skeleton */
  minSuccessRate: number;
  /** Minimum uses before pruning check */
  minUsesBeforePrune: number;
  /** Enable automatic learning of new skeletons */
  enableLearning: boolean;
  /** Similarity threshold for skeleton matching */
  matchingThreshold: number;
  /** Maximum skeletons to return in search */
  maxSearchResults: number;
  /** Enable skeleton versioning */
  enableVersioning: boolean;
}

export const DEFAULT_SKELETON_LIBRARY_CONFIG: SkeletonLibraryConfig = {
  minSuccessRate: 0.5,
  minUsesBeforePrune: 5,
  enableLearning: true,
  matchingThreshold: 0.75,
  maxSearchResults: 5,
  enableVersioning: true,
};

// ============================================================================
// Search and Retrieval Types
// ============================================================================

export interface ArtifactSearchOptions {
  /** Search by type */
  type?: ArtifactType;
  /** Search by domain */
  domain?: ThinkingDomain;
  /** Search by session */
  sessionId?: string;
  /** Search by project */
  projectId?: string;
  /** Only successful artifacts */
  successfulOnly?: boolean;
  /** Minimum confidence */
  minConfidence?: number;
  /** Maximum results */
  limit?: number;
  /** Score threshold */
  minScore?: number;
  /** Include embeddings in results */
  includeEmbeddings?: boolean;
}

export interface SkeletonSearchOptions {
  /** Search by skeleton type */
  skeletonType?: SkeletonType;
  /** Search by problem pattern */
  problemPattern?: ProblemPattern;
  /** Search by domain */
  domain?: ThinkingDomain;
  /** Minimum success rate */
  minSuccessRate?: number;
  /** Complexity range */
  complexityRange?: { min: number; max: number };
  /** Only validated skeletons */
  validatedOnly?: boolean;
  /** Maximum results */
  limit?: number;
  /** Score threshold */
  minScore?: number;
}

export interface SearchResult<T> {
  /** The found item */
  item: T;
  /** Similarity score */
  score: number;
  /** Match details */
  matchDetails?: {
    embeddingSimilarity?: number;
    filterMatches?: string[];
  };
}

// ============================================================================
// Consolidation Types
// ============================================================================

export interface ConsolidationCandidate {
  /** Artifact to consolidate */
  artifact: ThoughtArtifact;
  /** Success indicators */
  successIndicators: string[];
  /** Related successful artifacts */
  relatedSuccesses: string[];
  /** Recommended skeleton pattern */
  recommendedPattern?: ProblemPattern;
}

export interface ConsolidationResult {
  /** Artifacts consolidated */
  consolidatedCount: number;
  /** New skeletons created */
  newSkeletons: ReasoningSkeleton[];
  /** Updated skeletons */
  updatedSkeletons: string[];
  /** Memories created */
  memoriesCreated: number;
  /** Total processing time */
  processingTimeMs: number;
}

// ============================================================================
// Export Default Config
// ============================================================================

export default {
  DEFAULT_ARTIFACT_STORAGE_CONFIG,
  DEFAULT_SKELETON_LIBRARY_CONFIG,
};
