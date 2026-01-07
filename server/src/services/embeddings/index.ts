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
