/**
 * Qdrant Collection Manager
 *
 * Provides CRUD operations and management for all VL-JEPA collections.
 * Features:
 * - Automatic tenant field for multitenancy
 * - Shard configuration for production
 * - Index optimization per collection type
 * - Collection statistics tracking
 */

import { getQdrantClient, type QdrantClientWrapper } from './qdrant-client.js';
import {
  COLLECTION_NAMES,
  VECTOR_CONFIGS,
  PAYLOAD_SCHEMAS,
  type CollectionName,
  type IntentEmbeddingPayload,
  type VisualEmbeddingPayload,
  type CodePatternPayload,
  type ErrorFixPayload,
  type HyperThinkingPayload,
  type DecompositionPayload,
  type ReasoningSkeletonPayload,
} from './collections.js';

// ============================================================================
// Types
// ============================================================================

export interface CollectionConfig {
  name: CollectionName;
  vectorSize: number;
  distance: 'Cosine' | 'Euclid' | 'Dot';
  onDisk?: boolean;
  hnswConfig?: {
    m: number;
    efConstruct: number;
  };
  quantizationConfig?: {
    scalar?: {
      type: 'int8' | 'float32';
      quantile?: number;
      alwaysRam?: boolean;
    };
  };
  replicationFactor?: number;
  writeConsistencyFactor?: number;
  shardNumber?: number;
}

export interface CollectionInfo {
  name: string;
  fullName: string;
  vectorsCount: number;
  pointsCount: number;
  segmentsCount: number;
  status: 'green' | 'yellow' | 'red';
  config: CollectionConfig;
  indexes: string[];
}

export interface Point<T> {
  id: string;
  vector: number[];
  payload: T;
}

export interface SearchQuery {
  vector: number[];
  limit: number;
  filter?: Record<string, unknown>;
  scoreThreshold?: number;
  offset?: number;
  withPayload?: boolean;
  withVector?: boolean;
}

export interface SearchResult<T> {
  id: string;
  score: number;
  payload?: T;
  vector?: number[];
}

// Type union for all payload types
export type AnyPayload =
  | IntentEmbeddingPayload
  | VisualEmbeddingPayload
  | CodePatternPayload
  | ErrorFixPayload
  | HyperThinkingPayload
  | DecompositionPayload
  | ReasoningSkeletonPayload;

// ============================================================================
// Collection Manager
// ============================================================================

export class CollectionManager {
  private client: QdrantClientWrapper;
  private initialized = false;

  constructor() {
    this.client = getQdrantClient();
  }

  /**
   * Initialize all collections
   */
  async initialize(): Promise<{ created: string[]; existing: string[]; errors: string[] }> {
    const created: string[] = [];
    const existing: string[] = [];
    const errors: string[] = [];

    for (const collectionName of Object.values(COLLECTION_NAMES)) {
      try {
        const wasCreated = await this.ensureCollection(collectionName);
        if (wasCreated) {
          created.push(collectionName);
        } else {
          existing.push(collectionName);
        }
      } catch (error) {
        errors.push(`${collectionName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    this.initialized = true;
    return { created, existing, errors };
  }

  /**
   * Ensure a collection exists with proper configuration
   */
  async ensureCollection(collectionName: CollectionName): Promise<boolean> {
    const vectorConfig = VECTOR_CONFIGS[collectionName];
    const payloadSchema = PAYLOAD_SCHEMAS[collectionName];

    // Check if exists
    const exists = await this.client.collectionExists(collectionName);
    if (exists) {
      // Ensure indexes exist
      for (const field of payloadSchema.fields) {
        if (field.indexed) {
          await this.client.createPayloadIndex(collectionName, field.name, field.type);
        }
      }
      return false;
    }

    // Create collection
    await this.client.createCollection(
      collectionName,
      vectorConfig.size,
      vectorConfig.distance,
      {
        onDisk: vectorConfig.onDisk,
        hnswConfig: vectorConfig.hnswConfig,
        quantizationConfig: vectorConfig.quantizationConfig ? {
          scalar: vectorConfig.quantizationConfig.scalar ? {
            type: vectorConfig.quantizationConfig.scalar.type,
            quantile: vectorConfig.quantizationConfig.scalar.quantile,
            always_ram: vectorConfig.quantizationConfig.scalar.alwaysRam,
          } : undefined,
        } : undefined,
        replicationFactor: 2,
        writeConsistencyFactor: 1,
        shardNumber: 2,
      }
    );

    // Create indexes
    for (const field of payloadSchema.fields) {
      if (field.indexed) {
        await this.client.createPayloadIndex(collectionName, field.name, field.type);
      }
    }

    return true;
  }

  /**
   * Delete a collection
   */
  async deleteCollection(collectionName: CollectionName): Promise<boolean> {
    return this.client.deleteCollection(collectionName);
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(collectionName: CollectionName): Promise<CollectionInfo | null> {
    const stats = await this.client.getCollectionStats(collectionName);
    if (!stats) return null;

    const vectorConfig = VECTOR_CONFIGS[collectionName];
    const payloadSchema = PAYLOAD_SCHEMAS[collectionName];

    return {
      name: collectionName,
      fullName: stats.name,
      vectorsCount: stats.vectorsCount,
      pointsCount: stats.pointsCount,
      segmentsCount: stats.segmentsCount,
      status: stats.status,
      config: {
        name: collectionName,
        vectorSize: vectorConfig.size,
        distance: vectorConfig.distance,
        hnswConfig: vectorConfig.hnswConfig,
      },
      indexes: payloadSchema.fields.filter(f => f.indexed).map(f => f.name),
    };
  }

  /**
   * Get all collections info
   */
  async getAllCollectionsInfo(): Promise<CollectionInfo[]> {
    const infos: CollectionInfo[] = [];

    for (const name of Object.values(COLLECTION_NAMES)) {
      const info = await this.getCollectionInfo(name);
      if (info) {
        infos.push(info);
      }
    }

    return infos;
  }

  // ============================================================================
  // Point Operations
  // ============================================================================

  /**
   * Upsert points into a collection
   */
  async upsertPoints<T extends AnyPayload>(
    collectionName: CollectionName,
    points: Point<T>[],
    tenantId?: string
  ): Promise<boolean> {
    const payloadSchema = PAYLOAD_SCHEMAS[collectionName];

    // Add tenant_id if collection supports multitenancy
    const processedPoints = points.map(p => ({
      id: p.id,
      vector: p.vector,
      payload: (payloadSchema.tenantField && tenantId
        ? { ...p.payload, tenant_id: tenantId }
        : p.payload) as Record<string, unknown>,
    }));

    return this.client.upsertPoints(collectionName, processedPoints);
  }

  /**
   * Delete points by IDs
   */
  async deletePoints(collectionName: CollectionName, pointIds: string[]): Promise<boolean> {
    return this.client.deletePoints(collectionName, pointIds);
  }

  /**
   * Delete points by tenant
   */
  async deleteByTenant(collectionName: CollectionName, tenantId: string): Promise<boolean> {
    return this.client.deletePointsByFilter(collectionName, {
      must: [{ key: 'tenant_id', match: { value: tenantId } }],
    });
  }

  /**
   * Get points by IDs
   */
  async getPoints<T extends AnyPayload>(
    collectionName: CollectionName,
    pointIds: string[],
    withVector = false
  ): Promise<Point<T>[]> {
    const results = await this.client.getPoints(collectionName, pointIds, true, withVector);
    return results.map(r => ({
      id: String(r.id),
      vector: r.vector || [],
      payload: r.payload as T,
    }));
  }

  // ============================================================================
  // Search Operations
  // ============================================================================

  /**
   * Search for similar vectors
   */
  async search<T extends AnyPayload>(
    collectionName: CollectionName,
    query: SearchQuery,
    tenantId?: string
  ): Promise<SearchResult<T>[]> {
    // Build filter with tenant if provided
    let filter = query.filter;
    if (tenantId) {
      filter = {
        must: [
          { key: 'tenant_id', match: { value: tenantId } },
          ...(query.filter ? [query.filter] : []),
        ],
      };
    }

    const results = await this.client.search(collectionName, {
      ...query,
      filter,
    });

    return results.map(r => ({
      id: String(r.id),
      score: r.score,
      payload: r.payload as T,
      vector: r.vector,
    }));
  }

  /**
   * Search with batch queries
   */
  async searchBatch<T extends AnyPayload>(
    collectionName: CollectionName,
    queries: SearchQuery[],
    tenantId?: string
  ): Promise<SearchResult<T>[][]> {
    const processedQueries = queries.map(q => {
      let filter = q.filter;
      if (tenantId) {
        filter = {
          must: [
            { key: 'tenant_id', match: { value: tenantId } },
            ...(q.filter ? [q.filter] : []),
          ],
        };
      }
      return { ...q, filter };
    });

    const results = await this.client.searchBatch(collectionName, processedQueries);
    return results.map(batch =>
      batch.map(r => ({
        id: String(r.id),
        score: r.score,
        payload: r.payload as T,
        vector: r.vector,
      }))
    );
  }

  // ============================================================================
  // Collection-Specific Methods
  // ============================================================================

  /**
   * Store intent embedding
   */
  async storeIntentEmbedding(
    point: Point<IntentEmbeddingPayload>,
    tenantId?: string
  ): Promise<boolean> {
    return this.upsertPoints(COLLECTION_NAMES.INTENT_EMBEDDINGS, [point], tenantId);
  }

  /**
   * Search similar intents
   */
  async searchSimilarIntents(
    vector: number[],
    options: {
      projectId?: string;
      intentType?: string;
      limit?: number;
      minScore?: number;
      tenantId?: string;
    }
  ): Promise<SearchResult<IntentEmbeddingPayload>[]> {
    const filter: Record<string, unknown> = { must: [] };
    const must = filter.must as Array<Record<string, unknown>>;

    if (options.projectId) {
      must.push({ key: 'project_id', match: { value: options.projectId } });
    }
    if (options.intentType) {
      must.push({ key: 'intent_type', match: { value: options.intentType } });
    }

    return this.search<IntentEmbeddingPayload>(
      COLLECTION_NAMES.INTENT_EMBEDDINGS,
      {
        vector,
        limit: options.limit || 10,
        filter: must.length > 0 ? filter : undefined,
        scoreThreshold: options.minScore,
        withPayload: true,
      },
      options.tenantId
    );
  }

  /**
   * Store visual embedding
   */
  async storeVisualEmbedding(
    point: Point<VisualEmbeddingPayload>,
    tenantId?: string
  ): Promise<boolean> {
    return this.upsertPoints(COLLECTION_NAMES.VISUAL_EMBEDDINGS, [point], tenantId);
  }

  /**
   * Search similar visuals
   */
  async searchSimilarVisuals(
    vector: number[],
    options: {
      projectId?: string;
      imageType?: string;
      appSoul?: string;
      limit?: number;
      minScore?: number;
      tenantId?: string;
    }
  ): Promise<SearchResult<VisualEmbeddingPayload>[]> {
    const filter: Record<string, unknown> = { must: [] };
    const must = filter.must as Array<Record<string, unknown>>;

    if (options.projectId) {
      must.push({ key: 'project_id', match: { value: options.projectId } });
    }
    if (options.imageType) {
      must.push({ key: 'image_type', match: { value: options.imageType } });
    }
    if (options.appSoul) {
      must.push({ key: 'app_soul', match: { value: options.appSoul } });
    }

    return this.search<VisualEmbeddingPayload>(
      COLLECTION_NAMES.VISUAL_EMBEDDINGS,
      {
        vector,
        limit: options.limit || 10,
        filter: must.length > 0 ? filter : undefined,
        scoreThreshold: options.minScore,
        withPayload: true,
      },
      options.tenantId
    );
  }

  /**
   * Store code pattern
   */
  async storeCodePattern(
    point: Point<CodePatternPayload>,
    tenantId?: string
  ): Promise<boolean> {
    return this.upsertPoints(COLLECTION_NAMES.CODE_PATTERNS, [point], tenantId);
  }

  /**
   * Search similar code patterns
   */
  async searchSimilarCode(
    vector: number[],
    options: {
      projectId?: string;
      patternType?: string;
      language?: string;
      framework?: string;
      limit?: number;
      minScore?: number;
      tenantId?: string;
    }
  ): Promise<SearchResult<CodePatternPayload>[]> {
    const filter: Record<string, unknown> = { must: [] };
    const must = filter.must as Array<Record<string, unknown>>;

    if (options.projectId) {
      must.push({ key: 'project_id', match: { value: options.projectId } });
    }
    if (options.patternType) {
      must.push({ key: 'pattern_type', match: { value: options.patternType } });
    }
    if (options.language) {
      must.push({ key: 'language', match: { value: options.language } });
    }
    if (options.framework) {
      must.push({ key: 'framework', match: { value: options.framework } });
    }

    return this.search<CodePatternPayload>(
      COLLECTION_NAMES.CODE_PATTERNS,
      {
        vector,
        limit: options.limit || 10,
        filter: must.length > 0 ? filter : undefined,
        scoreThreshold: options.minScore,
        withPayload: true,
      },
      options.tenantId
    );
  }

  /**
   * Store error fix (global, not per-tenant)
   */
  async storeErrorFix(point: Point<ErrorFixPayload>): Promise<boolean> {
    return this.upsertPoints(COLLECTION_NAMES.ERROR_FIXES, [point]);
  }

  /**
   * Search similar error fixes
   */
  async searchSimilarErrorFixes(
    vector: number[],
    options: {
      errorType?: string;
      errorCode?: string;
      severity?: string;
      limit?: number;
      minScore?: number;
    }
  ): Promise<SearchResult<ErrorFixPayload>[]> {
    const filter: Record<string, unknown> = { must: [] };
    const must = filter.must as Array<Record<string, unknown>>;

    if (options.errorType) {
      must.push({ key: 'error_type', match: { value: options.errorType } });
    }
    if (options.errorCode) {
      must.push({ key: 'error_code', match: { value: options.errorCode } });
    }
    if (options.severity) {
      must.push({ key: 'severity', match: { value: options.severity } });
    }

    return this.search<ErrorFixPayload>(
      COLLECTION_NAMES.ERROR_FIXES,
      {
        vector,
        limit: options.limit || 10,
        filter: must.length > 0 ? filter : undefined,
        scoreThreshold: options.minScore,
        withPayload: true,
      }
    );
  }

  /**
   * Update error fix success rate
   */
  async updateErrorFixSuccessRate(
    pointId: string,
    success: boolean
  ): Promise<boolean> {
    const points = await this.getPoints<ErrorFixPayload>(COLLECTION_NAMES.ERROR_FIXES, [pointId]);
    if (points.length === 0) return false;

    const point = points[0];
    const timesUsed = (point.payload.times_used || 0) + 1;
    const currentSuccesses = (point.payload.success_rate || 0) * (timesUsed - 1);
    const newSuccessRate = (currentSuccesses + (success ? 1 : 0)) / timesUsed;

    return this.upsertPoints<ErrorFixPayload>(COLLECTION_NAMES.ERROR_FIXES, [{
      id: pointId,
      vector: point.vector,
      payload: {
        ...point.payload,
        times_used: timesUsed,
        success_rate: newSuccessRate,
        updated_at: new Date().toISOString(),
      },
    }]);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Count points in collection
   */
  async countPoints(collectionName: CollectionName, tenantId?: string): Promise<number> {
    const filter = tenantId
      ? { must: [{ key: 'tenant_id', match: { value: tenantId } }] }
      : undefined;
    return this.client.countPoints(collectionName, filter);
  }

  /**
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get raw Qdrant client for advanced operations
   */
  getClient(): QdrantClientWrapper {
    return this.client;
  }
}

// ============================================================================
// Singleton
// ============================================================================

let managerInstance: CollectionManager | null = null;

export function getCollectionManager(): CollectionManager {
  if (!managerInstance) {
    managerInstance = new CollectionManager();
  }
  return managerInstance;
}

export function resetCollectionManager(): void {
  managerInstance = null;
}

export default CollectionManager;
