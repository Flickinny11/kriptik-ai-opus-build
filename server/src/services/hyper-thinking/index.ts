/**
 * Hyper-Thinking Module Index
 *
 * Advanced multi-model reasoning system for KripTik AI.
 * Exports all hyper-thinking services and types.
 */

// Types
export * from './types.js';

// Complexity Analyzer
export {
  ComplexityAnalyzer,
  getComplexityAnalyzer,
  resetComplexityAnalyzer,
} from './complexity-analyzer.js';

// Model Router
export {
  ModelRouter,
  getModelRouter,
  resetModelRouter,
  HYPER_THINKING_MODELS,
  MODELS_BY_TIER,
  DEFAULT_MODEL_BY_TIER,
} from './model-router.js';

// Budget Manager
export {
  BudgetManager,
  getBudgetManager,
  resetBudgetManager,
  type BudgetSession,
} from './budget-manager.js';

// Orchestrator
export {
  HyperThinkingOrchestrator,
  getHyperThinkingOrchestrator,
  resetHyperThinkingOrchestrator,
} from './orchestrator.js';

// Providers
export {
  getProvider,
  getAvailableProviders,
  resetProviders,
  AnthropicReasoningClient,
  OpenAIReasoningClient,
  OpenRouterReasoningClient,
  type ReasoningProvider,
  type ReasoningRequest,
  type ReasoningResponse,
  type StreamingReasoningResponse,
} from './providers/index.js';

// Tree-of-Thought
export {
  ToTEngine,
  createToTEngine,
  ThoughtGenerator,
  ThoughtEvaluator,
  SynthesisEngine,
  createSearchStrategy,
  BeamSearchStrategy,
  BFSStrategy,
  DFSStrategy,
  DEFAULT_TOT_CONFIG,
  type ToTConfig,
  type ToTResult,
  type ToTProgressEvent,
  type ThoughtNode,
  type ThoughtTree,
  type ThoughtEvaluation,
  type GenerationStrategy,
  type ToTStrategy,
} from './tree-of-thought/index.js';

// Multi-Agent Reasoning Swarm
export {
  SwarmEngine,
  getSwarmEngine,
  createSwarmEngine,
  resetSwarmEngine,
  AgentFactory,
  AgentCoordinator,
  ConflictDetector,
  ConflictResolver,
  SwarmSynthesisEngine,
  DEFAULT_SWARM_CONFIG,
  type SwarmConfig,
  type SwarmResult,
  type SwarmAgent,
  type AgentResult,
  type SwarmProgressEvent,
  type SwarmState,
  type Conflict,
  type ConflictResolution,
  type DebateRound,
  type ReasoningSwarmInput,
  type SwarmEngineOptions,
  type SwarmReasoningStep,
  type ContributingAgent,
} from './multi-agent/index.js';

// Task Decomposition Engine
export {
  DecompositionEngine,
  getDecompositionEngine,
  createDecompositionEngine,
  resetDecompositionEngine,
  DependencyAnalyzer,
  createDependencyAnalyzer,
  FunctionalDecomposition,
  DataFlowDecomposition,
  ArchitecturalDecomposition,
  TemporalDecomposition,
  HybridDecomposition,
  getDecompositionStrategy,
  selectBestStrategy,
  DEFAULT_DECOMPOSITION_CONFIG,
  type DecompositionConfig,
  type DecompositionResult,
  type DecompositionTree,
  type DecompositionSummary,
  type DecompositionProgressEvent,
  type Subtask,
  type SubtaskResult,
  type SubtaskExecutor,
  type ExecutionContext,
  type DependencyGraph,
  type DecompositionStrategy,
  type IDecompositionStrategy,
} from './decomposition/index.js';

// Thought Artifact System
export {
  // Types
  type ArtifactType,
  type SkeletonType,
  type ProblemPattern,
  type ThinkingDomain,
  type ThoughtArtifact,
  type ThoughtArtifactMetadata,
  type ReasoningSkeleton,
  type ReasoningStep as SkeletonReasoningStep,
  type MemoryEntry,
  type MemoryContext,
  type ContextChunk,
  type AggregatedContext,
  type ContextAggregationStrategy,
  type ArtifactStorageConfig,
  type SkeletonLibraryConfig,
  type ArtifactSearchOptions,
  type SkeletonSearchOptions,
  type SearchResult as ArtifactSearchResult,
  type ConsolidationCandidate,
  type ConsolidationResult,
  DEFAULT_ARTIFACT_STORAGE_CONFIG,
  DEFAULT_SKELETON_LIBRARY_CONFIG,
  // Artifact Storage
  ArtifactStorage,
  getArtifactStorage,
  resetArtifactStorage,
  createArtifactStorage,
  // Context Aggregator
  ContextAggregator,
  createContextAggregator,
  type ContextAggregatorConfig,
  DEFAULT_CONTEXT_AGGREGATOR_CONFIG,
  // Reasoning Memory
  ReasoningMemory,
  getReasoningMemory,
  resetReasoningMemory,
  createReasoningMemory,
  type ReasoningMemoryConfig,
  DEFAULT_REASONING_MEMORY_CONFIG,
  // Skeleton Library
  SkeletonLibrary,
  getSkeletonLibrary,
  resetSkeletonLibrary,
  createSkeletonLibrary,
} from './artifacts/index.js';

// Convenience function for quick reasoning
export async function reason(
  prompt: string,
  options?: {
    strategy?: 'chain_of_thought' | 'tree_of_thought' | 'multi_agent' | 'hybrid';
    modelTier?: 'maximum' | 'deep' | 'standard' | 'fast';
    maxThinkingBudget?: number;
    userId?: string;
    context?: string;
  }
): Promise<import('./types.js').HyperThinkingResult> {
  // Import dynamically to avoid circular dependencies
  const { getHyperThinkingOrchestrator: getOrchestrator } = await import('./orchestrator.js');
  const orchestrator = getOrchestrator();
  return orchestrator.think({
    prompt,
    context: options?.context,
    config: {
      strategy: options?.strategy,
      modelTier: options?.modelTier,
      maxThinkingBudget: options?.maxThinkingBudget,
      userId: options?.userId,
    },
  });
}

// Convenience function for streaming reasoning
export async function* reasonStream(
  prompt: string,
  options?: {
    strategy?: 'chain_of_thought' | 'tree_of_thought' | 'multi_agent' | 'hybrid';
    modelTier?: 'maximum' | 'deep' | 'standard' | 'fast';
    maxThinkingBudget?: number;
    userId?: string;
    context?: string;
  }
): AsyncGenerator<import('./types.js').StreamingEvent, import('./types.js').HyperThinkingResult> {
  // Import dynamically to avoid circular dependencies
  const { getHyperThinkingOrchestrator: getOrchestrator } = await import('./orchestrator.js');
  const orchestrator = getOrchestrator();
  const generator = orchestrator.thinkStream({
    prompt,
    context: options?.context,
    config: {
      strategy: options?.strategy,
      modelTier: options?.modelTier,
      maxThinkingBudget: options?.maxThinkingBudget,
      userId: options?.userId,
    },
  });

  let result: import('./types.js').HyperThinkingResult;
  for await (const event of generator) {
    const res = yield event;
    if (res) result = res;
  }
  return result!;
}
