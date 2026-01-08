/**
 * Reasoning Skeleton Library
 *
 * Manages reusable reasoning patterns stored in Qdrant.
 * Supports matching problems to skeletons, learning new patterns, and pruning.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  type ReasoningSkeleton,
  type ReasoningStep,
  type SkeletonSearchOptions,
  type SearchResult,
  type SkeletonLibraryConfig,
  type ProblemPattern,
  type SkeletonType,
  type ThinkingDomain,
  type ThoughtArtifact,
  DEFAULT_SKELETON_LIBRARY_CONFIG,
} from './types.js';
import {
  getEmbeddingService,
  getCollectionManager,
  COLLECTION_NAMES,
  type ReasoningSkeletonPayload,
} from '../../embeddings/index.js';

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Convert skeleton to Qdrant payload
 */
function skeletonToPayload(skeleton: ReasoningSkeleton): ReasoningSkeletonPayload {
  return {
    skeleton_type: skeleton.skeletonType as 'chain_of_thought' | 'tree_of_thought' | 'graph_reasoning',
    problem_pattern: skeleton.problemPattern as 'optimization' | 'debugging' | 'design' | 'integration',
    reasoning_steps: skeleton.steps.length,
    validated: skeleton.validated,
    reuse_count: skeleton.timesUsed,
    skeleton_description: skeleton.description,
    created_at: skeleton.createdAt,
  };
}

/**
 * Convert Qdrant payload to skeleton (partial)
 */
function payloadToSkeleton(
  id: string,
  payload: ReasoningSkeletonPayload,
  vector?: number[]
): Partial<ReasoningSkeleton> {
  return {
    id,
    skeletonType: payload.skeleton_type as SkeletonType,
    problemPattern: payload.problem_pattern as ProblemPattern,
    description: payload.skeleton_description,
    validated: payload.validated,
    timesUsed: payload.reuse_count,
    embedding: vector,
    createdAt: payload.created_at,
  };
}

// ============================================================================
// Built-in Skeletons
// ============================================================================

const BUILT_IN_SKELETONS: ReasoningSkeleton[] = [
  {
    id: 'skeleton_debugging_systematic',
    problemPattern: 'debugging',
    skeletonType: 'chain_of_thought',
    steps: [
      { order: 1, name: 'Reproduce', description: 'Reproduce the error with minimal steps' },
      { order: 2, name: 'Isolate', description: 'Narrow down the source of the error' },
      { order: 3, name: 'Analyze', description: 'Understand why the error occurs' },
      { order: 4, name: 'Hypothesize', description: 'Form hypotheses about the fix' },
      { order: 5, name: 'Test', description: 'Test each hypothesis' },
      { order: 6, name: 'Verify', description: 'Verify the fix resolves the issue' },
    ],
    successRate: 0.85,
    timesUsed: 0,
    description: 'Systematic debugging approach for isolating and fixing errors',
    applicableDomains: ['api', 'database', 'integration', 'ui'],
    minComplexity: 3,
    maxComplexity: 8,
    validated: true,
    version: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'skeleton_architecture_decision',
    problemPattern: 'architecture',
    skeletonType: 'tree_of_thought',
    steps: [
      { order: 1, name: 'Requirements', description: 'List functional and non-functional requirements' },
      { order: 2, name: 'Options', description: 'Generate multiple architecture options' },
      { order: 3, name: 'Tradeoffs', description: 'Analyze tradeoffs for each option' },
      { order: 4, name: 'Evaluate', description: 'Score options against requirements' },
      { order: 5, name: 'Select', description: 'Choose the best option with reasoning' },
      { order: 6, name: 'Document', description: 'Document the decision and rationale' },
    ],
    successRate: 0.78,
    timesUsed: 0,
    description: 'Tree-of-thought approach for architecture decisions',
    applicableDomains: ['architecture', 'api', 'database'],
    minComplexity: 5,
    maxComplexity: 10,
    validated: true,
    version: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'skeleton_optimization',
    problemPattern: 'optimization',
    skeletonType: 'chain_of_thought',
    steps: [
      { order: 1, name: 'Baseline', description: 'Establish current performance baseline' },
      { order: 2, name: 'Profile', description: 'Identify performance bottlenecks' },
      { order: 3, name: 'Prioritize', description: 'Rank optimizations by impact vs effort' },
      { order: 4, name: 'Implement', description: 'Apply optimizations one at a time' },
      { order: 5, name: 'Measure', description: 'Measure improvement after each change' },
      { order: 6, name: 'Validate', description: 'Ensure no regressions in functionality' },
    ],
    successRate: 0.82,
    timesUsed: 0,
    description: 'Systematic performance optimization approach',
    applicableDomains: ['api', 'database', 'integration'],
    minComplexity: 4,
    maxComplexity: 9,
    validated: true,
    version: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'skeleton_feature_implementation',
    problemPattern: 'implementation',
    skeletonType: 'multi_agent',
    steps: [
      { order: 1, name: 'Intent', description: 'Clarify the feature intent and success criteria' },
      { order: 2, name: 'Design', description: 'Design the solution architecture' },
      { order: 3, name: 'Dependencies', description: 'Identify and resolve dependencies' },
      { order: 4, name: 'Implement', description: 'Implement the feature incrementally' },
      { order: 5, name: 'Test', description: 'Write and run tests' },
      { order: 6, name: 'Integrate', description: 'Integrate with existing code' },
      { order: 7, name: 'Review', description: 'Review for quality and completeness' },
    ],
    successRate: 0.75,
    timesUsed: 0,
    description: 'Multi-agent approach for complex feature implementation',
    applicableDomains: ['ui', 'api', 'database', 'integration'],
    minComplexity: 6,
    maxComplexity: 10,
    validated: true,
    version: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'skeleton_refactoring',
    problemPattern: 'refactoring',
    skeletonType: 'chain_of_thought',
    steps: [
      { order: 1, name: 'Identify', description: 'Identify code smells and technical debt' },
      { order: 2, name: 'Plan', description: 'Plan refactoring in small, safe steps' },
      { order: 3, name: 'Tests', description: 'Ensure test coverage before refactoring' },
      { order: 4, name: 'Refactor', description: 'Apply refactoring patterns' },
      { order: 5, name: 'Verify', description: 'Run tests after each step' },
      { order: 6, name: 'Clean', description: 'Clean up and document changes' },
    ],
    successRate: 0.88,
    timesUsed: 0,
    description: 'Safe refactoring approach with test coverage',
    applicableDomains: ['api', 'ui', 'database'],
    minComplexity: 3,
    maxComplexity: 7,
    validated: true,
    version: 1,
    createdAt: new Date().toISOString(),
  },
];

// ============================================================================
// Skeleton Library Class
// ============================================================================

export class SkeletonLibrary {
  private config: SkeletonLibraryConfig;
  private localSkeletons: Map<string, ReasoningSkeleton> = new Map();
  private initialized = false;

  constructor(config: Partial<SkeletonLibraryConfig> = {}) {
    this.config = { ...DEFAULT_SKELETON_LIBRARY_CONFIG, ...config };
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize library with built-in skeletons
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load built-in skeletons to local cache
    for (const skeleton of BUILT_IN_SKELETONS) {
      this.localSkeletons.set(skeleton.id, skeleton);
    }

    // Store built-in skeletons in Qdrant if they don't exist
    try {
      const embeddingService = getEmbeddingService();
      const collectionManager = getCollectionManager();

      for (const skeleton of BUILT_IN_SKELETONS) {
        // Generate embedding if not present
        if (!skeleton.embedding) {
          const result = await embeddingService.embed({
            content: `${skeleton.problemPattern} ${skeleton.description} ${skeleton.steps.map(s => s.name).join(' ')}`,
            type: 'reasoning',
          });
          skeleton.embedding = result.embeddings[0];
        }

        // Upsert to Qdrant
        const payload = skeletonToPayload(skeleton);
        await collectionManager.upsertPoints<ReasoningSkeletonPayload>(
          COLLECTION_NAMES.REASONING_SKELETONS,
          [{
            id: skeleton.id,
            vector: skeleton.embedding,
            payload,
          }]
        );
      }
    } catch (error) {
      console.warn('[SkeletonLibrary] Failed to sync built-in skeletons to Qdrant:', error);
    }

    this.initialized = true;
  }

  // ==========================================================================
  // Search and Match
  // ==========================================================================

  /**
   * Find matching skeletons for a problem
   */
  async findMatching(
    problem: string,
    options: SkeletonSearchOptions = {}
  ): Promise<SearchResult<ReasoningSkeleton>[]> {
    await this.initialize();

    try {
      // Generate embedding for problem
      const embeddingService = getEmbeddingService();
      const result = await embeddingService.embed({
        content: problem,
        type: 'reasoning',
      });
      const queryVector = result.embeddings[0];

      return this.searchByVector(queryVector, options);
    } catch (error) {
      console.error('[SkeletonLibrary] Search failed:', error);
      // Fall back to local search
      return this.searchLocal(options);
    }
  }

  /**
   * Search skeletons by embedding vector
   */
  async searchByVector(
    vector: number[],
    options: SkeletonSearchOptions = {}
  ): Promise<SearchResult<ReasoningSkeleton>[]> {
    const collectionManager = getCollectionManager();

    // Build filter
    const filter: Record<string, unknown> = { must: [] };
    const must = filter.must as Array<Record<string, unknown>>;

    if (options.skeletonType) {
      must.push({ key: 'skeleton_type', match: { value: options.skeletonType } });
    }
    if (options.problemPattern) {
      must.push({ key: 'problem_pattern', match: { value: options.problemPattern } });
    }
    if (options.validatedOnly) {
      must.push({ key: 'validated', match: { value: true } });
    }
    if (options.minSuccessRate) {
      // Note: success_rate isn't in payload, use reuse_count as proxy
      must.push({ key: 'reuse_count', range: { gte: 1 } });
    }

    const results = await collectionManager.search<ReasoningSkeletonPayload>(
      COLLECTION_NAMES.REASONING_SKELETONS,
      {
        vector,
        limit: options.limit || this.config.maxSearchResults,
        filter: must.length > 0 ? filter : undefined,
        scoreThreshold: options.minScore || this.config.matchingThreshold,
        withPayload: true,
        withVector: true,
      }
    );

    // Convert to SearchResult<ReasoningSkeleton>
    return results.map(r => {
      // Try to get full skeleton from local cache
      const localSkeleton = this.localSkeletons.get(r.id);

      const skeleton: ReasoningSkeleton = localSkeleton || {
        ...payloadToSkeleton(r.id, r.payload!, r.vector),
        steps: [],
        successRate: 0.7,
        applicableDomains: [],
        minComplexity: 1,
        maxComplexity: 10,
        version: 1,
      } as ReasoningSkeleton;

      return {
        item: skeleton,
        score: r.score,
        matchDetails: {
          embeddingSimilarity: r.score,
        },
      };
    });
  }

  /**
   * Search local skeletons only (fallback)
   */
  private searchLocal(options: SkeletonSearchOptions = {}): SearchResult<ReasoningSkeleton>[] {
    const results: SearchResult<ReasoningSkeleton>[] = [];

    for (const [, skeleton] of this.localSkeletons) {
      // Apply filters
      if (options.skeletonType && skeleton.skeletonType !== options.skeletonType) continue;
      if (options.problemPattern && skeleton.problemPattern !== options.problemPattern) continue;
      if (options.validatedOnly && !skeleton.validated) continue;
      if (options.minSuccessRate && skeleton.successRate < options.minSuccessRate) continue;
      if (options.domain && !skeleton.applicableDomains.includes(options.domain)) continue;
      if (options.complexityRange) {
        if (skeleton.minComplexity > options.complexityRange.max) continue;
        if (skeleton.maxComplexity < options.complexityRange.min) continue;
      }

      results.push({
        item: skeleton,
        score: skeleton.successRate, // Use success rate as score
      });
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, options.limit || this.config.maxSearchResults);
  }

  /**
   * Get skeleton by ID
   */
  async get(id: string): Promise<ReasoningSkeleton | null> {
    await this.initialize();

    // Check local cache first
    const local = this.localSkeletons.get(id);
    if (local) return local;

    // Check Qdrant
    try {
      const collectionManager = getCollectionManager();
      const points = await collectionManager.getPoints<ReasoningSkeletonPayload>(
        COLLECTION_NAMES.REASONING_SKELETONS,
        [id],
        true
      );

      if (points.length === 0) return null;

      const point = points[0];
      return {
        ...payloadToSkeleton(point.id, point.payload, point.vector),
        steps: [],
        successRate: 0.7,
        applicableDomains: [],
        minComplexity: 1,
        maxComplexity: 10,
        version: 1,
      } as ReasoningSkeleton;
    } catch (error) {
      console.error('[SkeletonLibrary] Failed to get skeleton:', error);
      return null;
    }
  }

  // ==========================================================================
  // Learning and Update
  // ==========================================================================

  /**
   * Learn a new skeleton from successful reasoning
   */
  async learnFromArtifacts(
    artifacts: ThoughtArtifact[],
    options: {
      problemPattern?: ProblemPattern;
      domain?: ThinkingDomain;
      description?: string;
    } = {}
  ): Promise<ReasoningSkeleton | null> {
    if (!this.config.enableLearning) return null;
    if (artifacts.length < 2) return null;

    // Extract steps from artifacts
    const steps: ReasoningStep[] = artifacts.map((artifact, index) => ({
      order: index + 1,
      name: `Step ${index + 1}`,
      description: artifact.content.slice(0, 200),
      estimatedTokens: artifact.tokensUsed,
    }));

    // Determine skeleton type based on artifact structure
    const hasParallel = artifacts.some(a => a.childIds && a.childIds.length > 1);
    const skeletonType: SkeletonType = hasParallel ? 'tree_of_thought' : 'chain_of_thought';

    // Calculate success rate from artifacts
    const successfulCount = artifacts.filter(a => a.successful).length;
    const successRate = successfulCount / artifacts.length;

    // Only learn if success rate is high enough
    if (successRate < this.config.minSuccessRate) {
      return null;
    }

    // Create new skeleton
    const skeleton: ReasoningSkeleton = {
      id: `skeleton_learned_${uuidv4()}`,
      problemPattern: options.problemPattern || 'implementation',
      skeletonType,
      steps,
      successRate,
      timesUsed: 1,
      description: options.description || `Learned pattern from ${artifacts.length} reasoning steps`,
      applicableDomains: options.domain ? [options.domain] : ['integration'],
      minComplexity: Math.min(...artifacts.map(a => a.complexityLevel || 5)),
      maxComplexity: Math.max(...artifacts.map(a => a.complexityLevel || 5)),
      validated: false,
      version: 1,
      createdAt: new Date().toISOString(),
    };

    // Store skeleton
    await this.store(skeleton);

    return skeleton;
  }

  /**
   * Store a skeleton
   */
  async store(skeleton: ReasoningSkeleton): Promise<boolean> {
    await this.initialize();

    try {
      // Generate embedding if not present
      if (!skeleton.embedding) {
        const embeddingService = getEmbeddingService();
        const result = await embeddingService.embed({
          content: `${skeleton.problemPattern} ${skeleton.description} ${skeleton.steps.map(s => s.name).join(' ')}`,
          type: 'reasoning',
        });
        skeleton.embedding = result.embeddings[0];
      }

      // Add to local cache
      this.localSkeletons.set(skeleton.id, skeleton);

      // Store in Qdrant
      const collectionManager = getCollectionManager();
      const payload = skeletonToPayload(skeleton);
      await collectionManager.upsertPoints<ReasoningSkeletonPayload>(
        COLLECTION_NAMES.REASONING_SKELETONS,
        [{
          id: skeleton.id,
          vector: skeleton.embedding,
          payload,
        }]
      );

      return true;
    } catch (error) {
      console.error('[SkeletonLibrary] Failed to store skeleton:', error);
      return false;
    }
  }

  /**
   * Record skeleton usage and update success rate
   */
  async recordUsage(skeletonId: string, successful: boolean): Promise<boolean> {
    const skeleton = await this.get(skeletonId);
    if (!skeleton) return false;

    // Update metrics
    skeleton.timesUsed++;
    const previousTotal = skeleton.successRate * (skeleton.timesUsed - 1);
    skeleton.successRate = (previousTotal + (successful ? 1 : 0)) / skeleton.timesUsed;
    skeleton.updatedAt = new Date().toISOString();

    // Version bump if enabled
    if (this.config.enableVersioning) {
      skeleton.version++;
    }

    return this.store(skeleton);
  }

  /**
   * Validate a skeleton (mark as production-ready)
   */
  async validate(skeletonId: string): Promise<boolean> {
    const skeleton = await this.get(skeletonId);
    if (!skeleton) return false;

    skeleton.validated = true;
    skeleton.updatedAt = new Date().toISOString();

    return this.store(skeleton);
  }

  // ==========================================================================
  // Maintenance
  // ==========================================================================

  /**
   * Prune unsuccessful skeletons
   */
  async prune(): Promise<{ pruned: string[]; kept: number }> {
    await this.initialize();

    const pruned: string[] = [];

    for (const [id, skeleton] of this.localSkeletons) {
      // Skip built-in skeletons
      if (id.startsWith('skeleton_') && !id.startsWith('skeleton_learned_')) continue;

      // Check prune criteria
      if (
        skeleton.timesUsed >= this.config.minUsesBeforePrune &&
        skeleton.successRate < this.config.minSuccessRate
      ) {
        // Delete from local cache
        this.localSkeletons.delete(id);

        // Delete from Qdrant
        try {
          const collectionManager = getCollectionManager();
          await collectionManager.deletePoints(COLLECTION_NAMES.REASONING_SKELETONS, [id]);
        } catch (error) {
          console.error(`[SkeletonLibrary] Failed to delete skeleton ${id}:`, error);
        }

        pruned.push(id);
      }
    }

    return { pruned, kept: this.localSkeletons.size };
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get library statistics
   */
  async getStats(): Promise<{
    localCount: number;
    qdrantCount: number;
    validatedCount: number;
    averageSuccessRate: number;
  }> {
    await this.initialize();

    let qdrantCount = 0;
    try {
      const collectionManager = getCollectionManager();
      qdrantCount = await collectionManager.countPoints(COLLECTION_NAMES.REASONING_SKELETONS);
    } catch (error) {
      console.error('[SkeletonLibrary] Failed to count Qdrant points:', error);
    }

    let validatedCount = 0;
    let totalSuccessRate = 0;

    for (const [, skeleton] of this.localSkeletons) {
      if (skeleton.validated) validatedCount++;
      totalSuccessRate += skeleton.successRate;
    }

    return {
      localCount: this.localSkeletons.size,
      qdrantCount,
      validatedCount,
      averageSuccessRate: this.localSkeletons.size > 0 
        ? totalSuccessRate / this.localSkeletons.size 
        : 0,
    };
  }

  /**
   * Get all local skeletons
   */
  getAll(): ReasoningSkeleton[] {
    return Array.from(this.localSkeletons.values());
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SkeletonLibraryConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let libraryInstance: SkeletonLibrary | null = null;

export function getSkeletonLibrary(): SkeletonLibrary {
  if (!libraryInstance) {
    libraryInstance = new SkeletonLibrary();
  }
  return libraryInstance;
}

export function resetSkeletonLibrary(): void {
  libraryInstance = null;
}

export function createSkeletonLibrary(
  config?: Partial<SkeletonLibraryConfig>
): SkeletonLibrary {
  return new SkeletonLibrary(config);
}

export default SkeletonLibrary;
