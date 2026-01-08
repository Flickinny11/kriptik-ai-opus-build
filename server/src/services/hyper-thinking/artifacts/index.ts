/**
 * Thought Artifact System - Index
 *
 * Exports all components for memory and context management in long reasoning chains.
 */

// Types
export {
  type ArtifactType,
  type SkeletonType,
  type ProblemPattern,
  type ThinkingDomain,
  type ThoughtArtifact,
  type ThoughtArtifactMetadata,
  type ReasoningSkeleton,
  type ReasoningStep,
  type MemoryEntry,
  type MemoryContext,
  type ContextChunk,
  type AggregatedContext,
  type ContextAggregationStrategy,
  type ArtifactStorageConfig,
  type SkeletonLibraryConfig,
  type ArtifactSearchOptions,
  type SkeletonSearchOptions,
  type SearchResult,
  type ConsolidationCandidate,
  type ConsolidationResult,
  DEFAULT_ARTIFACT_STORAGE_CONFIG,
  DEFAULT_SKELETON_LIBRARY_CONFIG,
} from './types.js';

// Artifact Storage
export {
  ArtifactStorage,
  getArtifactStorage,
  resetArtifactStorage,
  createArtifactStorage,
} from './storage.js';

// Context Aggregator
export {
  ContextAggregator,
  createContextAggregator,
  type ContextAggregatorConfig,
  DEFAULT_CONTEXT_AGGREGATOR_CONFIG,
} from './context-aggregator.js';

// Reasoning Memory
export {
  ReasoningMemory,
  getReasoningMemory,
  resetReasoningMemory,
  createReasoningMemory,
  type ReasoningMemoryConfig,
  DEFAULT_REASONING_MEMORY_CONFIG,
} from './reasoning-memory.js';

// Skeleton Library
export {
  SkeletonLibrary,
  getSkeletonLibrary,
  resetSkeletonLibrary,
  createSkeletonLibrary,
} from './skeleton-library.js';
