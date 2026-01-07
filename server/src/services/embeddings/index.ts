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
  type CollectionConfig as CollectionDefinitionConfig,
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

// Collection Manager
export {
  CollectionManager,
  getCollectionManager,
  resetCollectionManager,
  type CollectionConfig,
  type CollectionInfo,
  type Point as CollectionPoint,
  type SearchQuery as CollectionSearchQuery,
  type SearchResult as CollectionSearchResult,
  type AnyPayload,
} from './collection-manager.js';

// Multitenancy Manager
export {
  MultitenancyManager,
  getMultitenancyManager,
  resetMultitenancyManager,
  type MultitenancyConfig,
  type TenantStats,
  type PromotionEvent,
  type TenantHealth,
} from './multitenancy-manager.js';

// Semantic Intent Service (VL-JEPA Integration)
export {
  SemanticIntentService,
  getSemanticIntentService,
  resetSemanticIntentService,
  type SemanticIntent,
  type SemanticAlignmentResult,
  type SemanticDriftResult,
  type SimilarIntent,
} from './semantic-intent-service.js';

// Semantic Satisfaction Service (VL-JEPA Completion Gates)
export {
  SemanticSatisfactionService,
  getSemanticSatisfactionService,
  resetSemanticSatisfactionService,
  type SuccessCriterion,
  type WorkflowStep,
  type UserWorkflow,
  type SatisfactionInput,
  type CriterionResult,
  type WorkflowResult,
  type SatisfactionResult,
  type CompletionGateResult,
} from './semantic-satisfaction-service.js';

// Visual Understanding Service (VL-JEPA Visual Analysis)
export {
  VisualUnderstandingService,
  getVisualUnderstandingService,
  resetVisualUnderstandingService,
  type VisualAnalysisInput,
  type VisualDescription,
  type DesignAlignmentResult,
  type SimilarVisual,
} from './visual-understanding-service.js';
