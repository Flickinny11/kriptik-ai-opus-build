/**
 * Embedding Service Implementation
 * 
 * Central service for generating embeddings across multiple providers.
 * Features:
 * - Automatic provider selection based on type
 * - Caching layer integration
 * - Rate limiting per user/project
 * - Cost tracking and credit deduction
 * - Provider fallbacks
 * - Similarity calculations
 */

import type {
  IEmbeddingService,
  EmbeddingRequest,
  EmbeddingResult,
  BatchEmbeddingResult,
  SimilarityResult,
  EmbeddingServiceHealth,
  EmbeddingProvider,
  EmbeddingType,
  EmbeddingOptions,
} from './embedding-service.js';
import { TYPE_TO_PROVIDER, EMBEDDING_COSTS } from './embedding-service.js';
import { BGEM3Provider } from './providers/bge-m3-provider.js';
import { VoyageCodeProvider } from './providers/voyage-code-provider.js';
import { SigLIPProvider } from './providers/siglip-provider.js';
import { getEmbeddingCache, type EmbeddingCache } from './embedding-cache.js';

// ============================================================================
// Provider Instances
// ============================================================================

const providers = {
  'bge-m3': new BGEM3Provider(),
  'voyage-code-3': new VoyageCodeProvider(),
  'siglip-2': new SigLIPProvider(),
} as const;

type ProviderKey = keyof typeof providers;

// ============================================================================
// Rate Limiting (in-memory for now, should use Redis in production)
// ============================================================================

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimits = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_RATE_LIMIT = parseInt(process.env.EMBEDDING_RATE_LIMIT_PER_MINUTE || '100', 10);

function checkRateLimit(userId?: string, projectId?: string): boolean {
  if (!userId) return true;
  
  const key = `${userId}:${projectId || 'default'}`;
  const now = Date.now();
  const entry = rateLimits.get(key);
  
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(key, { count: 1, windowStart: now });
    return true;
  }
  
  if (entry.count >= DEFAULT_RATE_LIMIT) {
    return false;
  }
  
  entry.count++;
  return true;
}

// ============================================================================
// Embedding Service Implementation
// ============================================================================

export class EmbeddingService implements IEmbeddingService {
  private cache: EmbeddingCache;
  private creditTracker: Map<string, number> = new Map();

  constructor() {
    this.cache = getEmbeddingCache();
  }

  /**
   * Generate embeddings for content
   */
  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const startTime = Date.now();
    
    // Rate limit check
    if (!checkRateLimit(request.userId, request.projectId)) {
      throw new Error('Rate limit exceeded. Please wait before making more requests.');
    }

    const providerKey = TYPE_TO_PROVIDER[request.type];
    const provider = providers[providerKey];
    
    // Normalize content to array
    const texts = Array.isArray(request.content) ? request.content : [request.content];
    
    // Check cache for each text
    const cachedResults = new Map<number, number[]>();
    const textsToEmbed: Array<{ index: number; text: string }> = [];
    
    if (!request.options?.skipCache) {
      for (let i = 0; i < texts.length; i++) {
        const cacheKey = this.cache.generateKey(texts[i], provider.model, request.options);
        const cached = await this.cache.get(cacheKey);
        
        if (cached) {
          cachedResults.set(i, cached);
        } else {
          textsToEmbed.push({ index: i, text: texts[i] });
        }
      }
    } else {
      texts.forEach((text, index) => textsToEmbed.push({ index, text }));
    }

    let providerResult: {
      embeddings: number[][];
      tokensUsed: number;
      dimensions: number;
      latencyMs: number;
    } = {
      embeddings: [],
      tokensUsed: 0,
      dimensions: provider.defaultDimensions,
      latencyMs: 0,
    };

    // Generate embeddings for uncached texts
    if (textsToEmbed.length > 0) {
      const textsOnly = textsToEmbed.map(t => t.text);
      
      // Handle visual type with images
      if (request.type === 'visual' && request.options?.imageBase64) {
        const siglip = providers['siglip-2'] as SigLIPProvider;
        providerResult = await siglip.embedImage(request.options.imageBase64, request.options);
      } else if (request.type === 'visual' && request.options?.imageUrl) {
        const siglip = providers['siglip-2'] as SigLIPProvider;
        providerResult = await siglip.embedImage(request.options.imageUrl, request.options);
      } else {
        providerResult = await provider.embed(textsOnly, request.options);
      }

      // Cache the new embeddings
      const cacheEntries: Array<{ key: string; embedding: number[]; type: string }> = [];
      
      for (let i = 0; i < textsToEmbed.length; i++) {
        const cacheKey = this.cache.generateKey(
          textsToEmbed[i].text,
          provider.model,
          request.options
        );
        cacheEntries.push({
          key: cacheKey,
          embedding: providerResult.embeddings[i],
          type: request.type,
        });
      }
      
      await this.cache.setMany(cacheEntries);
    }

    // Combine cached and new results in correct order
    const finalEmbeddings: number[][] = new Array(texts.length);
    let newIndex = 0;
    
    for (let i = 0; i < texts.length; i++) {
      if (cachedResults.has(i)) {
        finalEmbeddings[i] = cachedResults.get(i)!;
      } else {
        finalEmbeddings[i] = providerResult.embeddings[newIndex++];
      }
    }

    // Calculate cost
    const creditsCost = this.calculateCost(
      request.type,
      providerResult.tokensUsed,
      request.options?.imageBase64 || request.options?.imageUrl ? 1 : 0
    );
    
    // Track cost for project
    if (request.projectId) {
      const current = this.creditTracker.get(request.projectId) || 0;
      this.creditTracker.set(request.projectId, current + creditsCost);
    }

    return {
      embeddings: finalEmbeddings,
      model: provider.model,
      provider: provider.name,
      dimensions: providerResult.dimensions,
      tokensUsed: providerResult.tokensUsed,
      cached: cachedResults.size === texts.length,
      latencyMs: Date.now() - startTime,
      creditsCost,
    };
  }

  /**
   * Generate embeddings for multiple requests in batch
   */
  async embedBatch(requests: EmbeddingRequest[]): Promise<BatchEmbeddingResult> {
    const results: EmbeddingResult[] = [];
    let totalTokens = 0;
    let totalCredits = 0;
    const startTime = Date.now();

    // Group requests by type for more efficient batching
    const groupedByType = new Map<EmbeddingType, EmbeddingRequest[]>();
    
    for (const req of requests) {
      const existing = groupedByType.get(req.type) || [];
      existing.push(req);
      groupedByType.set(req.type, existing);
    }

    // Process each type group
    for (const [_type, typeRequests] of groupedByType) {
      for (const request of typeRequests) {
        try {
          const result = await this.embed(request);
          results.push(result);
          totalTokens += result.tokensUsed;
          totalCredits += result.creditsCost;
        } catch (error) {
          // Add error result
          results.push({
            embeddings: [],
            model: 'error',
            provider: 'error',
            dimensions: 0,
            tokensUsed: 0,
            cached: false,
            latencyMs: 0,
            creditsCost: 0,
          });
          console.error('[EmbeddingService] Batch item failed:', error);
        }
      }
    }

    return {
      results,
      totalTokensUsed: totalTokens,
      totalLatencyMs: Date.now() - startTime,
      totalCreditsCost: totalCredits,
    };
  }

  /**
   * Calculate similarity between two embeddings
   */
  similarity(
    embedding1: number[],
    embedding2: number[],
    method: 'cosine' | 'dot' | 'euclidean' = 'cosine'
  ): SimilarityResult {
    if (embedding1.length !== embedding2.length) {
      throw new Error(`Embedding dimensions mismatch: ${embedding1.length} vs ${embedding2.length}`);
    }

    let similarity: number;

    switch (method) {
      case 'cosine': {
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        
        for (let i = 0; i < embedding1.length; i++) {
          dotProduct += embedding1[i] * embedding2[i];
          norm1 += embedding1[i] * embedding1[i];
          norm2 += embedding2[i] * embedding2[i];
        }
        
        const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
        similarity = magnitude > 0 ? dotProduct / magnitude : 0;
        break;
      }
      
      case 'dot': {
        similarity = 0;
        for (let i = 0; i < embedding1.length; i++) {
          similarity += embedding1[i] * embedding2[i];
        }
        break;
      }
      
      case 'euclidean': {
        let sumSquared = 0;
        for (let i = 0; i < embedding1.length; i++) {
          const diff = embedding1[i] - embedding2[i];
          sumSquared += diff * diff;
        }
        // Convert distance to similarity (1 / (1 + distance))
        similarity = 1 / (1 + Math.sqrt(sumSquared));
        break;
      }
    }

    return { similarity, method };
  }

  /**
   * Health check for all providers
   */
  async healthCheck(): Promise<EmbeddingServiceHealth> {
    const providerHealths: Record<string, Awaited<ReturnType<EmbeddingProvider['healthCheck']>>> = {};
    
    const healthChecks = Object.entries(providers).map(async ([key, provider]) => {
      const health = await provider.healthCheck();
      providerHealths[key] = health;
    });
    
    await Promise.all(healthChecks);
    
    const cacheHealth = await this.cache.healthCheck();
    const anyHealthy = Object.values(providerHealths).some(h => h.healthy);

    return {
      healthy: anyHealthy,
      providers: providerHealths,
      cache: {
        healthy: cacheHealth.healthy,
        entries: cacheHealth.memoryEntries,
        hitRate: this.cache.getStats().hitRate,
      },
    };
  }

  /**
   * Get provider for specific type
   */
  getProvider(type: EmbeddingType): EmbeddingProvider {
    const providerKey = TYPE_TO_PROVIDER[type];
    return providers[providerKey];
  }

  /**
   * Estimate cost for embedding request
   */
  estimateCost(content: string | string[], type: EmbeddingType): number {
    const texts = Array.isArray(content) ? content : [content];
    const estimatedTokens = texts.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);
    
    return this.calculateCost(type, estimatedTokens, 0);
  }

  /**
   * Calculate actual cost in credits
   */
  private calculateCost(type: EmbeddingType, tokensUsed: number, imagesUsed: number): number {
    const providerKey = TYPE_TO_PROVIDER[type];
    
    switch (providerKey) {
      case 'bge-m3':
        return (tokensUsed / 1000) * EMBEDDING_COSTS['bge-m3'].costPer1kTokens;
      case 'voyage-code-3':
        return (tokensUsed / 1000) * EMBEDDING_COSTS['voyage-code-3'].costPer1kTokens;
      case 'siglip-2':
        return (tokensUsed / 1000) * EMBEDDING_COSTS['siglip-2'].costPerText + 
               imagesUsed * EMBEDDING_COSTS['siglip-2'].costPerImage;
      default:
        return 0;
    }
  }

  /**
   * Get accumulated cost for a project
   */
  getProjectCost(projectId: string): number {
    return this.creditTracker.get(projectId) || 0;
  }

  /**
   * Reset project cost tracker
   */
  resetProjectCost(projectId: string): void {
    this.creditTracker.delete(projectId);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}

// ============================================================================
// Singleton
// ============================================================================

let serviceInstance: EmbeddingService | null = null;

export function getEmbeddingService(): EmbeddingService {
  if (!serviceInstance) {
    serviceInstance = new EmbeddingService();
  }
  return serviceInstance;
}

export function resetEmbeddingService(): void {
  serviceInstance = null;
}

export default EmbeddingService;
