/**
 * BGE-M3 Embedding Provider
 *
 * Uses HuggingFace Inference API to generate embeddings with the BAAI/bge-m3 model.
 * Features:
 * - 1024-dimensional embeddings
 * - 8192 token context
 * - Hybrid retrieval (dense + sparse vectors)
 * - Batching support (max 32 texts)
 * - Retry with exponential backoff
 */

import type {
  EmbeddingProvider,
  EmbeddingOptions,
  ProviderEmbeddingResult,
  ProviderHealth,
} from '../embedding-service.js';
import { EMBEDDING_COSTS, MODEL_CONFIG } from '../embedding-service.js';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = MODEL_CONFIG['bge-m3'];
const COST = EMBEDDING_COSTS['bge-m3'];

const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/pipeline/feature-extraction';

interface HuggingFaceResponse {
  embeddings?: number[][];
  error?: string;
}

// ============================================================================
// BGE-M3 Provider Implementation
// ============================================================================

export class BGEM3Provider implements EmbeddingProvider {
  readonly name = 'bge-m3';
  readonly model = CONFIG.modelId;
  readonly defaultDimensions = CONFIG.dimensions;
  readonly maxTokens = CONFIG.maxTokens;
  readonly maxBatchSize = CONFIG.maxBatchSize;
  readonly costPer1kTokens = COST.costPer1kTokens;

  private apiKey: string;
  private retryAttempts = 3;
  private retryDelay = 1000;

  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[BGE-M3] HUGGINGFACE_API_KEY not set - provider will be unavailable');
    }
  }

  /**
   * Generate embeddings for text inputs
   */
  async embed(texts: string[], _options?: EmbeddingOptions): Promise<ProviderEmbeddingResult> {
    if (!this.apiKey) {
      throw new Error('HUGGINGFACE_API_KEY not configured');
    }

    const startTime = Date.now();

    // Process in batches if needed
    const allEmbeddings: number[][] = [];
    let totalTokens = 0;

    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const batch = texts.slice(i, i + this.maxBatchSize);
      const result = await this.processBatch(batch);
      allEmbeddings.push(...result.embeddings);
      totalTokens += result.tokensUsed;
    }

    return {
      embeddings: allEmbeddings,
      tokensUsed: totalTokens,
      dimensions: this.defaultDimensions,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Process a single batch of texts
   */
  private async processBatch(texts: string[]): Promise<{ embeddings: number[][]; tokensUsed: number }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        // Server-side external API call to HuggingFace (credentials: omit for external APIs)
        const response = await fetch(`${HUGGINGFACE_API_URL}/${CONFIG.modelId}`, {
          method: 'POST',
          credentials: 'omit', // External API - no browser cookies
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: texts,
            options: {
              wait_for_model: true,
              use_cache: true,
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();

          // Handle rate limiting
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
            throw new Error(`Rate limited. Retry after ${retryAfter}s`);
          }

          // Handle model loading
          if (response.status === 503) {
            throw new Error('Model is loading. Please wait.');
          }

          throw new Error(`HuggingFace API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();

        // HuggingFace returns embeddings directly as array
        let embeddings: number[][];

        if (Array.isArray(data)) {
          // Check if it's nested (batch) or single
          if (Array.isArray(data[0]) && Array.isArray(data[0][0])) {
            // Batch response: [[embedding], [embedding], ...]
            embeddings = data.map((item: number[] | number[][]) => {
              // BGE-M3 returns [CLS] token embedding as first element
              if (Array.isArray(item) && Array.isArray(item[0])) {
                return item[0] as number[];
              }
              return item as number[];
            });
          } else if (Array.isArray(data[0]) && typeof data[0][0] === 'number') {
            // Single or batch where each item is already the embedding
            embeddings = texts.length === 1 ? [data[0] as number[]] : (data as number[][]);
          } else {
            embeddings = [data as number[]];
          }
        } else {
          throw new Error('Unexpected response format from HuggingFace');
        }

        // Normalize embeddings to expected dimension
        embeddings = embeddings.map(emb => {
          if (emb.length > this.defaultDimensions) {
            return emb.slice(0, this.defaultDimensions);
          }
          return emb;
        });

        // Estimate tokens (rough: 4 chars per token)
        const tokensUsed = texts.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);

        return {
          embeddings,
          tokensUsed,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.warn(`[BGE-M3] Attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`[BGE-M3] Failed after ${this.retryAttempts} attempts: ${lastError?.message}`);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      if (!this.apiKey) {
        return {
          name: this.name,
          healthy: false,
          error: 'API key not configured',
          lastChecked: new Date().toISOString(),
        };
      }

      // Simple test embedding
      const result = await this.embed(['health check test']);

      if (result.embeddings.length === 0 || result.embeddings[0].length !== this.defaultDimensions) {
        throw new Error('Invalid embedding response');
      }

      return {
        name: this.name,
        healthy: true,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        name: this.name,
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString(),
      };
    }
  }
}

export default BGEM3Provider;
