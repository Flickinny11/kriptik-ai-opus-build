/**
 * Vector Context Provider
 *
 * Makes VL-JEPA's vector memory available to ALL systems - builds,
 * feature agents, learning cycles, and more. It's the shared brain
 * that provides relevant context for every operation.
 */

import { v4 as uuidv4 } from 'uuid';
import { LRUCache } from 'lru-cache';

import { EmbeddingService } from '../embeddings/embedding-service-impl.js';
import type { EmbeddingType } from '../embeddings/embedding-service.js';

import type {
  TaskDescription,
  ContextConfig,
  UnifiedContext,
  PrioritizedContext,
  ErrorResolutionContext,
  CrossBuildContext,
  BuildRecommendation,
  SessionLearning,
  BuildPhase,
  BuildInfo,
} from './types.js';

import {
  getQdrantClient,
  QdrantClientWrapper,
  type SearchResult,
} from '../embeddings/qdrant-client.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

interface VectorContextConfig {
  maxCacheSize: number;
  cacheTTL: number;
  defaultLimit: number;
  minScoreThreshold: number;
}

const DEFAULT_CONFIG: VectorContextConfig = {
  maxCacheSize: 1000,
  cacheTTL: 300000, // 5 minutes
  defaultLimit: 10,
  minScoreThreshold: 0.5,
};

// Collection names
const COLLECTIONS = {
  CODE_PATTERNS: 'code_patterns',
  DESIGN_DECISIONS: 'design_decisions',
  ERROR_SOLUTIONS: 'error_solutions',
  USER_PREFERENCES: 'user_preferences',
  PROJECT_CONTEXT: 'project_context',
  LEARNING_INSIGHTS: 'learning_insights',
  CONVERSATION_MEMORY: 'conversation_memory',
};

// =============================================================================
// VECTOR CONTEXT PROVIDER
// =============================================================================

export class VectorContextProvider {
  private config: VectorContextConfig;
  private qdrantClient: QdrantClientWrapper;
  private queryCache: LRUCache<string, SearchResult[]>;
  private embeddingCache: LRUCache<string, number[]>;
  private embeddingService: EmbeddingService;

  constructor(config?: Partial<VectorContextConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.qdrantClient = getQdrantClient();
    this.embeddingService = new EmbeddingService();

    this.queryCache = new LRUCache<string, SearchResult[]>({
      max: this.config.maxCacheSize,
      ttl: this.config.cacheTTL,
    });

    this.embeddingCache = new LRUCache<string, number[]>({
      max: this.config.maxCacheSize,
      ttl: this.config.cacheTTL,
    });
  }

  // =========================================================================
  // UNIFIED CONTEXT RETRIEVAL
  // =========================================================================

  /**
   * Get context for a task from all relevant collections
   */
  async getContextForTask(
    task: TaskDescription,
    config: ContextConfig
  ): Promise<UnifiedContext> {
    const startTime = Date.now();

    // Generate task embedding
    const taskEmbedding = await this.generateEmbedding(task.description);

    // Query all relevant collections in parallel
    const [
      codePatterns,
      designDecisions,
      errorSolutions,
      userPrefs,
      projectContext,
      learningInsights,
    ] = await Promise.all([
      this.queryCollection(COLLECTIONS.CODE_PATTERNS, taskEmbedding, config),
      this.queryCollection(COLLECTIONS.DESIGN_DECISIONS, taskEmbedding, config),
      this.queryCollection(COLLECTIONS.ERROR_SOLUTIONS, taskEmbedding, config),
      this.queryCollection(COLLECTIONS.USER_PREFERENCES, taskEmbedding, {
        ...config,
        filter: { userId: config.userId },
      }),
      config.projectId ? this.queryCollection(COLLECTIONS.PROJECT_CONTEXT, taskEmbedding, {
        ...config,
        filter: { projectId: config.projectId },
      }) : Promise.resolve([]),
      this.queryCollection(COLLECTIONS.LEARNING_INSIGHTS, taskEmbedding, config),
    ]);

    // Combine and prioritize results
    const allResults = [
      ...codePatterns.map(r => ({ ...r, collection: COLLECTIONS.CODE_PATTERNS })),
      ...designDecisions.map(r => ({ ...r, collection: COLLECTIONS.DESIGN_DECISIONS })),
      ...errorSolutions.map(r => ({ ...r, collection: COLLECTIONS.ERROR_SOLUTIONS })),
      ...userPrefs.map(r => ({ ...r, collection: COLLECTIONS.USER_PREFERENCES })),
      ...projectContext.map(r => ({ ...r, collection: COLLECTIONS.PROJECT_CONTEXT })),
      ...learningInsights.map(r => ({ ...r, collection: COLLECTIONS.LEARNING_INSIGHTS })),
    ];

    // Calculate priority weights
    const priorityWeights: Record<string, number> = {
      [COLLECTIONS.PROJECT_CONTEXT]: 1.5,
      [COLLECTIONS.USER_PREFERENCES]: 1.4,
      [COLLECTIONS.ERROR_SOLUTIONS]: 1.3,
      [COLLECTIONS.CODE_PATTERNS]: 1.2,
      [COLLECTIONS.LEARNING_INSIGHTS]: 1.1,
      [COLLECTIONS.DESIGN_DECISIONS]: 1.0,
    };

    // Apply priority weights and sort
    const prioritized: PrioritizedContext[] = allResults
      .map(r => {
        const weight = priorityWeights[r.collection] || 1.0;
        return {
          id: String(r.id),
          collection: r.collection,
          content: JSON.stringify(r.payload || {}),
          score: r.score,
          priorityWeight: weight,
          metadata: r.payload as Record<string, unknown>,
        };
      })
      .sort((a, b) => (b.score * b.priorityWeight) - (a.score * a.priorityWeight))
      .slice(0, config.maxTokens ? Math.floor(config.maxTokens / 100) : 20);

    // Calculate priority scores
    const priorityScores: Record<string, number> = {};
    for (const result of prioritized) {
      priorityScores[result.collection] = (priorityScores[result.collection] || 0) + result.score;
    }

    return {
      relevant: prioritized,
      metadata: {
        totalCandidates: allResults.length,
        selectedCount: prioritized.length,
        priorityScores,
        retrievalTimeMs: Date.now() - startTime,
      },
    };
  }

  // =========================================================================
  // ERROR CONTEXT
  // =========================================================================

  /**
   * Get context for error resolution
   */
  async getErrorContext(
    error: {
      type: string;
      message: string;
      stack?: string;
    },
    buildContext: {
      projectId?: string;
      language?: string;
    }
  ): Promise<ErrorResolutionContext> {
    // Generate error embedding
    const errorText = `${error.type}: ${error.message}\n${error.stack?.slice(0, 500) || ''}`;
    const errorEmbedding = await this.generateEmbedding(errorText);

    // Search with high specificity first
    const exactMatches = await this.qdrantClient.search(COLLECTIONS.ERROR_SOLUTIONS, {
      vector: errorEmbedding,
      limit: 5,
      scoreThreshold: 0.85,
      filter: buildContext.language ? {
        must: [{ key: 'language', match: { value: buildContext.language } }],
      } : undefined,
    });

    // Search with lower threshold for similar errors
    const similarErrors = await this.qdrantClient.search(COLLECTIONS.ERROR_SOLUTIONS, {
      vector: errorEmbedding,
      limit: 10,
      scoreThreshold: 0.6,
    });

    // Get project-specific error history
    let projectErrors: SearchResult[] = [];
    if (buildContext.projectId) {
      projectErrors = await this.qdrantClient.search(COLLECTIONS.PROJECT_CONTEXT, {
        vector: errorEmbedding,
        limit: 5,
        filter: {
          must: [
            { key: 'projectId', match: { value: buildContext.projectId } },
            { key: 'type', match: { value: 'error_resolution' } },
          ],
        },
      });
    }

    // Get helpful patterns
    const helpfulPatterns = await this.qdrantClient.search(COLLECTIONS.CODE_PATTERNS, {
      vector: errorEmbedding,
      limit: 3,
      filter: {
        must: [{ key: 'outcome', match: { value: 'successful' } }],
      },
    });

    // Synthesize approach from matches
    let suggestedApproach: string | undefined;
    if (exactMatches.length > 0) {
      const topMatch = exactMatches[0];
      if (topMatch.payload && typeof topMatch.payload === 'object' && 'solution' in topMatch.payload) {
        suggestedApproach = String(topMatch.payload.solution);
      }
    }

    return {
      exactMatches,
      similarErrors,
      projectErrors,
      helpfulPatterns,
      suggestedApproach,
    };
  }

  // =========================================================================
  // CROSS-BUILD KNOWLEDGE
  // =========================================================================

  /**
   * Inject knowledge from similar past builds
   */
  async injectCrossBuildKnowledge(
    currentBuild: BuildInfo,
    phase: BuildPhase
  ): Promise<CrossBuildContext> {
    // Generate build embedding
    const buildEmbedding = await this.generateEmbedding(currentBuild.intentDescription);

    // Find similar past builds
    const similarBuilds = await this.qdrantClient.search(COLLECTIONS.PROJECT_CONTEXT, {
      vector: buildEmbedding,
      limit: 5,
      filter: {
        must: [
          { key: 'type', match: { value: 'build_summary' } },
          { key: 'outcome', match: { value: 'success' } },
        ],
      },
    });

    // Get phase-specific insights
    const phaseEmbedding = await this.generateEmbedding(phase.description || phase.name);
    const phaseInsights = await this.qdrantClient.search(COLLECTIONS.LEARNING_INSIGHTS, {
      vector: phaseEmbedding,
      limit: 10,
      filter: {
        must: [{ key: 'phase', match: { value: phase.name } }],
      },
    });

    // Get user's successful patterns
    const userPatterns = await this.qdrantClient.search(COLLECTIONS.CODE_PATTERNS, {
      vector: buildEmbedding,
      limit: 10,
      filter: {
        must: [
          { key: 'userId', match: { value: currentBuild.userId } },
          { key: 'outcome', match: { value: 'successful' } },
        ],
      },
    });

    // Generate recommendations
    const recommendations: BuildRecommendation[] = [];

    // From similar builds
    for (const build of similarBuilds.slice(0, 3)) {
      if (build.payload && typeof build.payload === 'object' && 'learnings' in build.payload) {
        recommendations.push({
          type: 'pattern',
          description: String(build.payload.learnings),
          confidence: build.score,
          source: `build_${build.id}`,
        });
      }
    }

    // From phase insights
    for (const insight of phaseInsights.slice(0, 2)) {
      if (insight.payload && typeof insight.payload === 'object' && 'recommendation' in insight.payload) {
        recommendations.push({
          type: 'strategy',
          description: String(insight.payload.recommendation),
          confidence: insight.score,
          source: `insight_${insight.id}`,
        });
      }
    }

    return {
      similarBuilds,
      phaseInsights,
      userPatterns,
      recommendations,
    };
  }

  // =========================================================================
  // STORE LEARNINGS
  // =========================================================================

  /**
   * Store session learnings to vector collections
   */
  async storeSessionLearning(
    sessionId: string,
    learnings: SessionLearning[]
  ): Promise<void> {
    for (const learning of learnings) {
      const embedding = await this.generateEmbedding(learning.description);
      const collection = this.getTargetCollection(learning.type);

      await this.qdrantClient.upsertPoints(collection, [{
        id: `${sessionId}_${learning.id}`,
        vector: embedding,
        payload: {
          sessionId,
          type: learning.type,
          content: learning.content,
          outcome: learning.outcome,
          confidence: learning.confidence,
          timestamp: new Date().toISOString(),
          ...learning.metadata,
        },
      }]);
    }
  }

  /**
   * Store a build event for real-time indexing
   */
  async storeBuildEvent(event: {
    type: string;
    buildId: string;
    phase?: string;
    decision?: unknown;
    error?: unknown;
    solution?: unknown;
  }): Promise<void> {
    if (event.type === 'decision_made' && event.decision) {
      const embedding = await this.generateEmbedding(JSON.stringify(event.decision));
      await this.qdrantClient.upsertPoints(COLLECTIONS.DESIGN_DECISIONS, [{
        id: `decision_${event.buildId}_${Date.now()}`,
        vector: embedding,
        payload: {
          buildId: event.buildId,
          phase: event.phase,
          decision: event.decision,
          timestamp: new Date().toISOString(),
        },
      }]);
    }

    if (event.type === 'error_resolved' && event.error && event.solution) {
      const embedding = await this.generateEmbedding(
        `Error: ${JSON.stringify(event.error)}\nSolution: ${JSON.stringify(event.solution)}`
      );
      await this.qdrantClient.upsertPoints(COLLECTIONS.ERROR_SOLUTIONS, [{
        id: `error_${event.buildId}_${Date.now()}`,
        vector: embedding,
        payload: {
          buildId: event.buildId,
          error: event.error,
          solution: event.solution,
          success: true,
          timestamp: new Date().toISOString(),
        },
      }]);
    }
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  /**
   * Query a collection with caching
   */
  private async queryCollection(
    collection: string,
    embedding: number[],
    config: ContextConfig & { filter?: Record<string, unknown> }
  ): Promise<SearchResult[]> {
    const cacheKey = `${collection}_${JSON.stringify(embedding.slice(0, 10))}_${JSON.stringify(config.filter || {})}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const results = await this.qdrantClient.search(collection, {
        vector: embedding,
        limit: this.config.defaultLimit,
        scoreThreshold: this.config.minScoreThreshold,
        filter: config.filter,
      });

      this.queryCache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.warn(`[VectorContextProvider] Failed to query ${collection}:`, error);
      return [];
    }
  }

  /**
   * Generate embedding for text using real embedding service
   * Uses BGE-M3 (1024-dim) for semantic understanding
   */
  private async generateEmbedding(text: string, type: EmbeddingType = 'reasoning'): Promise<number[]> {
    const cacheKey = `${type}:${text.slice(0, 100)}`;
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await this.embeddingService.embed({
        content: text,
        type: type,
      });

      if (result.embeddings.length > 0) {
        this.embeddingCache.set(cacheKey, result.embeddings[0]);
        return result.embeddings[0];
      }
    } catch (error) {
      console.error('[VectorContextProvider] Embedding failed, using fallback:', error);
    }

    // Fallback: Return zero vector with correct dimensions for type
    // BGE-M3 (reasoning, intent, error) = 1024 dims
    // Voyage-code-3 (code) = 1024 dims
    // SigLIP-2 (visual) = 768 dims
    const dims = type === 'visual' ? 768 : 1024;
    return new Array(dims).fill(0);
  }

  /**
   * Get target collection for learning type
   */
  private getTargetCollection(learningType: string): string {
    const typeMap: Record<string, string> = {
      code_pattern: COLLECTIONS.CODE_PATTERNS,
      design_decision: COLLECTIONS.DESIGN_DECISIONS,
      error_resolution: COLLECTIONS.ERROR_SOLUTIONS,
      strategy_outcome: COLLECTIONS.LEARNING_INSIGHTS,
    };
    return typeMap[learningType] || COLLECTIONS.LEARNING_INSIGHTS;
  }

  // =========================================================================
  // CACHE MANAGEMENT
  // =========================================================================

  clearCache(): void {
    this.queryCache.clear();
    this.embeddingCache.clear();
  }

  getCacheStats(): { queries: number; embeddings: number } {
    return {
      queries: this.queryCache.size,
      embeddings: this.embeddingCache.size,
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let providerInstance: VectorContextProvider | null = null;

export function getVectorContextProvider(): VectorContextProvider {
  if (!providerInstance) {
    providerInstance = new VectorContextProvider();
  }
  return providerInstance;
}

export function resetVectorContextProvider(): void {
  providerInstance = null;
}

export default VectorContextProvider;
