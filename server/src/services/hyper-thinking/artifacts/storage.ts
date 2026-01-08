/**
 * Artifact Storage Service
 *
 * Handles storage, retrieval, and search of thought artifacts in Qdrant.
 * Integrates with VL-JEPA embedding service for vector generation.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  getCollectionManager,
  getEmbeddingService,
  COLLECTION_NAMES,
  type HyperThinkingPayload,
  type CollectionSearchResult,
} from '../../embeddings/index.js';
import {
  type ThoughtArtifact,
  type ArtifactSearchOptions,
  type SearchResult,
  type ArtifactStorageConfig,
  DEFAULT_ARTIFACT_STORAGE_CONFIG,
  type ArtifactType,
  type ThinkingDomain,
} from './types.js';

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Convert ThoughtArtifact to Qdrant payload
 */
function artifactToPayload(artifact: ThoughtArtifact): HyperThinkingPayload {
  // Map domain to valid HyperThinkingPayload.problem_domain values
  const validDomain = artifact.domain && ['architecture', 'ui', 'api', 'database', 'integration'].includes(artifact.domain)
    ? artifact.domain as 'architecture' | 'ui' | 'api' | 'database' | 'integration'
    : 'integration';

  return {
    tenant_id: artifact.metadata.tenantId,
    thinking_type: mapArtifactTypeToThinkingType(artifact.type),
    problem_domain: validDomain,
    complexity_level: artifact.complexityLevel || 5,
    success_score: artifact.successful ? 1.0 : artifact.confidence,
    parent_id: artifact.parentId,
    reasoning_text: artifact.content,
    created_at: artifact.createdAt,
  };
}

/**
 * Map artifact type to thinking type for Qdrant
 */
function mapArtifactTypeToThinkingType(
  type: ArtifactType
): 'analysis' | 'synthesis' | 'evaluation' | 'creation' {
  switch (type) {
    case 'reasoning_chain':
    case 'thought_node':
      return 'analysis';
    case 'synthesis':
    case 'agent_result':
      return 'synthesis';
    case 'evaluation':
    case 'conflict_resolution':
      return 'evaluation';
    case 'decomposition':
      return 'creation';
    default:
      return 'analysis';
  }
}

/**
 * Convert Qdrant result back to ThoughtArtifact
 */
function payloadToArtifact(
  id: string,
  payload: HyperThinkingPayload,
  vector?: number[],
  score?: number
): Partial<ThoughtArtifact> {
  return {
    id,
    content: payload.reasoning_text,
    domain: payload.problem_domain,
    complexityLevel: payload.complexity_level,
    confidence: payload.success_score,
    parentId: payload.parent_id,
    embedding: vector,
    createdAt: payload.created_at,
    metadata: {
      tenantId: payload.tenant_id,
    },
  };
}

// ============================================================================
// Artifact Storage Class
// ============================================================================

export class ArtifactStorage {
  private config: ArtifactStorageConfig;
  private sessionArtifacts: Map<string, ThoughtArtifact[]> = new Map();

  constructor(config: Partial<ArtifactStorageConfig> = {}) {
    this.config = { ...DEFAULT_ARTIFACT_STORAGE_CONFIG, ...config };
  }

  // ==========================================================================
  // Storage Operations
  // ==========================================================================

  /**
   * Store a thought artifact
   */
  async store(artifact: ThoughtArtifact): Promise<{ success: boolean; id: string }> {
    try {
      // Skip if confidence too low
      if (artifact.confidence < this.config.minConfidenceThreshold) {
        return { success: false, id: artifact.id };
      }

      // Generate embedding if not provided and enabled
      let embedding = artifact.embedding;
      if (this.config.generateEmbeddings && !embedding) {
        const embeddingService = getEmbeddingService();
        const result = await embeddingService.embed({
          content: artifact.content,
          type: 'reasoning',
          projectId: artifact.metadata.projectId,
          userId: artifact.metadata.userId,
        });
        embedding = result.embeddings[0];
      }

      // Ensure ID exists
      const artifactId = artifact.id || uuidv4();

      // Store in session cache
      const sessionId = artifact.metadata.sessionId || 'default';
      const sessionArtifacts = this.sessionArtifacts.get(sessionId) || [];
      
      // Enforce max artifacts per session
      if (sessionArtifacts.length >= this.config.maxArtifactsPerSession) {
        sessionArtifacts.shift(); // Remove oldest
      }
      
      sessionArtifacts.push({ ...artifact, id: artifactId, embedding });
      this.sessionArtifacts.set(sessionId, sessionArtifacts);

      // Store in Qdrant if embedding available
      if (embedding) {
        const collectionManager = getCollectionManager();
        const payload = artifactToPayload({ ...artifact, id: artifactId });

        await collectionManager.upsertPoints<HyperThinkingPayload>(
          COLLECTION_NAMES.HYPER_THINKING,
          [{
            id: artifactId,
            vector: embedding,
            payload,
          }],
          artifact.metadata.tenantId
        );
      }

      return { success: true, id: artifactId };
    } catch (error) {
      console.error('[ArtifactStorage] Failed to store artifact:', error);
      return { success: false, id: artifact.id };
    }
  }

  /**
   * Store multiple artifacts in batch
   */
  async storeBatch(artifacts: ThoughtArtifact[]): Promise<{
    success: boolean;
    stored: number;
    failed: number;
    ids: string[];
  }> {
    const results = await Promise.all(artifacts.map(a => this.store(a)));
    const stored = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const ids = results.filter(r => r.success).map(r => r.id);

    return { success: failed === 0, stored, failed, ids };
  }

  /**
   * Retrieve artifact by ID
   */
  async get(id: string): Promise<ThoughtArtifact | null> {
    try {
      // Check session cache first
      for (const [, artifacts] of this.sessionArtifacts) {
        const found = artifacts.find(a => a.id === id);
        if (found) return found;
      }

      // Check Qdrant
      const collectionManager = getCollectionManager();
      const points = await collectionManager.getPoints<HyperThinkingPayload>(
        COLLECTION_NAMES.HYPER_THINKING,
        [id],
        true
      );

      if (points.length === 0) return null;

      const point = points[0];
      return {
        ...payloadToArtifact(point.id, point.payload, point.vector),
        type: 'reasoning_chain', // Default type
        problemContext: '',
        strategy: 'unknown',
        tokensUsed: 0,
        depth: 0,
        metadata: {
          tenantId: point.payload.tenant_id,
        },
      } as ThoughtArtifact;
    } catch (error) {
      console.error('[ArtifactStorage] Failed to get artifact:', error);
      return null;
    }
  }

  /**
   * Delete artifact by ID
   */
  async delete(id: string): Promise<boolean> {
    try {
      // Remove from session cache
      for (const [sessionId, artifacts] of this.sessionArtifacts) {
        const filtered = artifacts.filter(a => a.id !== id);
        if (filtered.length < artifacts.length) {
          this.sessionArtifacts.set(sessionId, filtered);
        }
      }

      // Remove from Qdrant
      const collectionManager = getCollectionManager();
      await collectionManager.deletePoints(COLLECTION_NAMES.HYPER_THINKING, [id]);

      return true;
    } catch (error) {
      console.error('[ArtifactStorage] Failed to delete artifact:', error);
      return false;
    }
  }

  // ==========================================================================
  // Search Operations
  // ==========================================================================

  /**
   * Search artifacts by similarity
   */
  async searchSimilar(
    query: string,
    options: ArtifactSearchOptions = {}
  ): Promise<SearchResult<ThoughtArtifact>[]> {
    try {
      // Generate embedding for query
      const embeddingService = getEmbeddingService();
      const embeddingResult = await embeddingService.embed({
        content: query,
        type: 'reasoning',
      });
      const queryVector = embeddingResult.embeddings[0];

      return this.searchByVector(queryVector, options);
    } catch (error) {
      console.error('[ArtifactStorage] Search failed:', error);
      return [];
    }
  }

  /**
   * Search artifacts by embedding vector
   */
  async searchByVector(
    vector: number[],
    options: ArtifactSearchOptions = {}
  ): Promise<SearchResult<ThoughtArtifact>[]> {
    try {
      const collectionManager = getCollectionManager();

      // Build filter
      const filter: Record<string, unknown> = { must: [] };
      const must = filter.must as Array<Record<string, unknown>>;

      if (options.domain) {
        must.push({ key: 'problem_domain', match: { value: options.domain } });
      }
      if (options.successfulOnly) {
        must.push({ key: 'success_score', range: { gte: 0.8 } });
      }
      if (options.minConfidence) {
        must.push({ key: 'success_score', range: { gte: options.minConfidence } });
      }

      const results = await collectionManager.search<HyperThinkingPayload>(
        COLLECTION_NAMES.HYPER_THINKING,
        {
          vector,
          limit: options.limit || 10,
          filter: must.length > 0 ? filter : undefined,
          scoreThreshold: options.minScore,
          withPayload: true,
          withVector: options.includeEmbeddings,
        },
        options.projectId
      );

      return results.map(r => ({
        item: {
          id: r.id,
          type: 'reasoning_chain' as ArtifactType,
          content: r.payload?.reasoning_text || '',
          problemContext: '',
          strategy: 'retrieved',
          confidence: r.payload?.success_score || 0,
          tokensUsed: 0,
          depth: 0,
          domain: r.payload?.problem_domain as ThinkingDomain,
          complexityLevel: r.payload?.complexity_level,
          embedding: r.vector,
          createdAt: r.payload?.created_at || new Date().toISOString(),
          metadata: {
            tenantId: r.payload?.tenant_id,
          },
        },
        score: r.score,
        matchDetails: {
          embeddingSimilarity: r.score,
        },
      }));
    } catch (error) {
      console.error('[ArtifactStorage] Vector search failed:', error);
      return [];
    }
  }

  /**
   * Get artifacts from current session
   */
  getSessionArtifacts(sessionId: string): ThoughtArtifact[] {
    return this.sessionArtifacts.get(sessionId) || [];
  }

  /**
   * Clear session artifacts
   */
  clearSession(sessionId: string): void {
    this.sessionArtifacts.delete(sessionId);
  }

  // ==========================================================================
  // Success Tracking
  // ==========================================================================

  /**
   * Mark artifact as successful
   */
  async markSuccessful(id: string, successful: boolean): Promise<boolean> {
    try {
      // Update session cache
      for (const [sessionId, artifacts] of this.sessionArtifacts) {
        const artifact = artifacts.find(a => a.id === id);
        if (artifact) {
          artifact.successful = successful;
          artifact.updatedAt = new Date().toISOString();
          this.sessionArtifacts.set(sessionId, artifacts);
          break;
        }
      }

      // Update in Qdrant
      const existing = await this.get(id);
      if (existing) {
        await this.store({
          ...existing,
          successful,
          updatedAt: new Date().toISOString(),
        });
      }

      return true;
    } catch (error) {
      console.error('[ArtifactStorage] Failed to mark success:', error);
      return false;
    }
  }

  /**
   * Get successful artifacts for consolidation
   */
  async getSuccessfulArtifacts(options: {
    minConfidence?: number;
    domain?: ThinkingDomain;
    limit?: number;
  } = {}): Promise<ThoughtArtifact[]> {
    const results = await this.searchSimilar('', {
      ...options,
      successfulOnly: true,
      minConfidence: options.minConfidence || this.config.consolidationThreshold,
    });

    return results.map(r => r.item);
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    sessionCount: number;
    totalSessionArtifacts: number;
    qdrantCount: number;
  }> {
    let totalSessionArtifacts = 0;
    for (const [, artifacts] of this.sessionArtifacts) {
      totalSessionArtifacts += artifacts.length;
    }

    let qdrantCount = 0;
    try {
      const collectionManager = getCollectionManager();
      qdrantCount = await collectionManager.countPoints(COLLECTION_NAMES.HYPER_THINKING);
    } catch (error) {
      console.error('[ArtifactStorage] Failed to get Qdrant count:', error);
    }

    return {
      sessionCount: this.sessionArtifacts.size,
      totalSessionArtifacts,
      qdrantCount,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ArtifactStorageConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let storageInstance: ArtifactStorage | null = null;

export function getArtifactStorage(): ArtifactStorage {
  if (!storageInstance) {
    storageInstance = new ArtifactStorage();
  }
  return storageInstance;
}

export function resetArtifactStorage(): void {
  storageInstance = null;
}

export function createArtifactStorage(
  config?: Partial<ArtifactStorageConfig>
): ArtifactStorage {
  return new ArtifactStorage(config);
}

export default ArtifactStorage;
