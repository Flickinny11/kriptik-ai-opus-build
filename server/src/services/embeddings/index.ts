/**
 * Embeddings Service Index
 * 
 * Exports all embedding-related services for the VL-JEPA semantic layer.
 */

// Qdrant client
export {
  getQdrantClient,
  resetQdrantClient,
  QdrantClientWrapper,
  type QdrantConfig,
  type QdrantHealthStatus,
  type CollectionStats,
  type TenantInfo,
  type Point,
  type SearchQuery,
  type SearchResult,
} from './qdrant-client.js';

// Collection definitions
export {
  COLLECTION_NAMES,
  VECTOR_CONFIGS,
  PAYLOAD_SCHEMAS,
  getCollectionConfig,
  getAllCollectionConfigs,
  type CollectionName,
  type VectorConfig,
  type PayloadFieldSchema,
  type CollectionPayloadSchema,
  type CollectionConfig,
  type IntentEmbeddingPayload,
  type VisualEmbeddingPayload,
  type CodePatternPayload,
  type ErrorFixPayload,
  type HyperThinkingPayload,
  type DecompositionPayload,
  type ReasoningSkeletonPayload,
} from './collections.js';

// Embedding service interfaces and types
export {
  type EmbeddingType,
  type EmbeddingRequest,
  type EmbeddingResult,
  type BatchEmbeddingResult,
  type SimilarityResult,
  type EmbeddingServiceHealth,
  type EmbeddingProvider,
  type EmbeddingOptions,
  type ProviderHealth,
  type IEmbeddingService,
  EMBEDDING_COSTS,
  MODEL_CONFIG,
  TYPE_TO_PROVIDER,
} from './embedding-service.js';

// Embedding service implementation
export {
  EmbeddingService,
  getEmbeddingService,
  resetEmbeddingService,
} from './embedding-service-impl.js';

// Embedding cache
export {
  EmbeddingCache,
  getEmbeddingCache,
  resetEmbeddingCache,
  type EmbeddingCacheConfig,
} from './embedding-cache.js';

// Providers
export {
  BGEM3Provider,
  VoyageCodeProvider,
  SigLIPProvider,
} from './providers/index.js';
