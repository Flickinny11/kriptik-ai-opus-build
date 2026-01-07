/**
 * Embedding Service Interface for KripTik AI VL-JEPA
 * 
 * Defines the contract for embedding operations across multiple providers:
 * - BGE-M3 (text/intent embeddings)
 * - Voyage-code-3 (code embeddings)
 * - SigLIP 2 (visual embeddings)
 */

// ============================================================================
// Request/Response Types
// ============================================================================

export type EmbeddingType = 'intent' | 'code' | 'visual' | 'error' | 'reasoning';

export interface EmbeddingRequest {
  /** Text content or array of texts to embed */
  content: string | string[];
  /** Type determines which provider to use */
  type: EmbeddingType;
  /** For cost attribution */
  projectId?: string;
  /** For rate limiting */
  userId?: string;
  /** Additional options */
  options?: EmbeddingOptions;
}

export interface EmbeddingOptions {
  /** For models that support variable dimensions (Voyage-code-3) */
  dimensions?: 256 | 512 | 1024 | 2048;
  /** Quantization format */
  quantization?: 'float32' | 'int8' | 'binary';
  /** Custom cache key */
  cacheKey?: string;
  /** Skip cache lookup */
  skipCache?: boolean;
  /** For visual: image URL or base64 */
  imageUrl?: string;
  imageBase64?: string;
  /** For visual: text for text-image similarity */
  textForVisual?: string;
}

export interface EmbeddingResult {
  /** Generated embeddings (one per input text) */
  embeddings: number[][];
  /** Model used for generation */
  model: string;
  /** Provider name */
  provider: string;
  /** Embedding dimensions */
  dimensions: number;
  /** Tokens consumed */
  tokensUsed: number;
  /** Whether result was from cache */
  cached: boolean;
  /** Processing time in milliseconds */
  latencyMs: number;
  /** Cost in credits */
  creditsCost: number;
}

export interface BatchEmbeddingResult {
  results: EmbeddingResult[];
  totalTokensUsed: number;
  totalLatencyMs: number;
  totalCreditsCost: number;
}

export interface SimilarityResult {
  similarity: number;
  method: 'cosine' | 'dot' | 'euclidean';
}

export interface ProviderHealth {
  name: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  lastChecked: string;
}

export interface EmbeddingServiceHealth {
  healthy: boolean;
  providers: Record<string, ProviderHealth>;
  cache: {
    healthy: boolean;
    entries?: number;
    hitRate?: number;
  };
}

// ============================================================================
// Provider Interface
// ============================================================================

export interface EmbeddingProvider {
  /** Provider name */
  name: string;
  /** Model identifier */
  model: string;
  /** Default embedding dimensions */
  defaultDimensions: number;
  /** Maximum tokens per request */
  maxTokens: number;
  /** Maximum batch size */
  maxBatchSize: number;
  /** Cost per 1K tokens in credits */
  costPer1kTokens: number;
  
  /** Generate embeddings for text */
  embed(texts: string[], options?: EmbeddingOptions): Promise<ProviderEmbeddingResult>;
  
  /** Generate embeddings for images (visual provider only) */
  embedImage?(imageData: string, options?: EmbeddingOptions): Promise<ProviderEmbeddingResult>;
  
  /** Health check */
  healthCheck(): Promise<ProviderHealth>;
}

export interface ProviderEmbeddingResult {
  embeddings: number[][];
  tokensUsed: number;
  dimensions: number;
  latencyMs: number;
}

// ============================================================================
// Embedding Service Interface
// ============================================================================

export interface IEmbeddingService {
  /**
   * Generate embeddings for content
   */
  embed(request: EmbeddingRequest): Promise<EmbeddingResult>;
  
  /**
   * Generate embeddings for multiple requests in batch
   */
  embedBatch(requests: EmbeddingRequest[]): Promise<BatchEmbeddingResult>;
  
  /**
   * Calculate similarity between two embeddings
   */
  similarity(
    embedding1: number[],
    embedding2: number[],
    method?: 'cosine' | 'dot' | 'euclidean'
  ): SimilarityResult;
  
  /**
   * Health check for all providers
   */
  healthCheck(): Promise<EmbeddingServiceHealth>;
  
  /**
   * Get provider for specific type
   */
  getProvider(type: EmbeddingType): EmbeddingProvider;
  
  /**
   * Estimate cost for embedding request
   */
  estimateCost(content: string | string[], type: EmbeddingType): number;
}

// ============================================================================
// Cost Configuration
// ============================================================================

export const EMBEDDING_COSTS = {
  // BGE-M3 via HuggingFace Inference API
  'bge-m3': {
    costPer1kTokens: 0.01, // $0.00001 per token → 0.01 credits
    creditsPerToken: 0.00001,
  },
  // Voyage-code-3 via Voyage AI API
  'voyage-code-3': {
    costPer1kTokens: 0.12, // $0.00012 per token → 0.12 credits
    creditsPerToken: 0.00012,
  },
  // SigLIP 2 via HuggingFace
  'siglip-2': {
    costPerImage: 0.05, // $0.00005 per image → 0.05 credits
    costPerText: 0.01,
  },
} as const;

// ============================================================================
// Model Configuration
// ============================================================================

export const MODEL_CONFIG = {
  'bge-m3': {
    provider: 'huggingface',
    modelId: 'BAAI/bge-m3',
    dimensions: 1024,
    maxTokens: 8192,
    maxBatchSize: 32,
    supportsHybrid: true, // Dense + sparse vectors
  },
  'voyage-code-3': {
    provider: 'voyage',
    modelId: 'voyage-code-3',
    dimensions: 1024, // Configurable: 256, 512, 1024, 2048
    maxTokens: 32000,
    maxBatchSize: 128,
    supportsQuantization: true,
  },
  'siglip-2': {
    provider: 'huggingface',
    modelId: 'google/siglip-base-patch16-224',
    dimensions: 768,
    maxTokens: 512, // For text input
    maxBatchSize: 16,
    supportsImages: true,
  },
} as const;

// ============================================================================
// Type to Provider Mapping
// ============================================================================

export const TYPE_TO_PROVIDER: Record<EmbeddingType, keyof typeof MODEL_CONFIG> = {
  intent: 'bge-m3',
  code: 'voyage-code-3',
  visual: 'siglip-2',
  error: 'bge-m3', // Errors use BGE-M3 for text context
  reasoning: 'bge-m3', // Reasoning patterns use BGE-M3
};

export default IEmbeddingService;
