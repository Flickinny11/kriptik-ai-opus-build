/**
 * RunPod BGE-M3 Embedding Provider
 *
 * Uses RunPod Serverless to generate embeddings with the BAAI/bge-m3 model.
 * This provider calls the deployed BGE-M3 endpoint on RunPod instead of
 * the HuggingFace Inference API.
 *
 * Features:
 * - 1024-dimensional embeddings
 * - 8192 token context
 * - Scale-to-zero (cost efficient)
 * - Self-hosted for lower latency
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

// RunPod endpoint configuration
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || '';
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_BGE_M3 || '';
const RUNPOD_ENDPOINT_URL = process.env.RUNPOD_URL_BGE_M3 ||
  (RUNPOD_ENDPOINT_ID ? `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/runsync` : '');

// Fallback to HuggingFace if RunPod not configured
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY || '';
const HUGGINGFACE_API_URL = 'https://router.huggingface.co/hf-inference/pipeline/feature-extraction';

interface RunPodResponse {
  id?: string;
  status?: string;
  output?: {
    embeddings?: number[][];
    dimensions?: number;
    tokens_used?: number;
    error?: string;
    traceback?: string;
  };
  error?: string;
}

// ============================================================================
// RunPod BGE-M3 Provider Implementation
// ============================================================================

export class RunPodBGEM3Provider implements EmbeddingProvider {
  readonly name = 'runpod-bge-m3';
  readonly model = CONFIG.modelId;
  readonly defaultDimensions = CONFIG.dimensions;
  readonly maxTokens = CONFIG.maxTokens;
  readonly maxBatchSize = CONFIG.maxBatchSize;
  readonly costPer1kTokens = COST.costPer1kTokens;

  private retryAttempts = 3;
  private retryDelay = 1000;

  /**
   * Check if RunPod endpoint is configured
   */
  isRunPodConfigured(): boolean {
    return !!(RUNPOD_API_KEY && RUNPOD_ENDPOINT_URL);
  }

  /**
   * Generate embeddings for text inputs
   */
  async embed(texts: string[], options?: EmbeddingOptions): Promise<ProviderEmbeddingResult> {
    const startTime = Date.now();

    // Try RunPod first if configured
    if (this.isRunPodConfigured()) {
      try {
        return await this.embedViaRunPod(texts, options, startTime);
      } catch (error) {
        console.warn('[RunPod BGE-M3] RunPod failed, falling back to HuggingFace:', error);
      }
    }

    // Fallback to HuggingFace
    if (HUGGINGFACE_API_KEY) {
      return await this.embedViaHuggingFace(texts, startTime);
    }

    throw new Error('No embedding provider configured. Set RUNPOD_API_KEY or HUGGINGFACE_API_KEY.');
  }

  /**
   * Generate embeddings via RunPod Serverless
   */
  private async embedViaRunPod(
    texts: string[],
    _options?: EmbeddingOptions,
    startTime = Date.now()
  ): Promise<ProviderEmbeddingResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(RUNPOD_ENDPOINT_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RUNPOD_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: {
              texts,
              options: {
                return_dense: true,
                return_sparse: false,
                max_length: this.maxTokens,
              },
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`RunPod API error (${response.status}): ${errorText}`);
        }

        const data: RunPodResponse = await response.json();

        // Check for RunPod-level errors
        if (data.error) {
          throw new Error(`RunPod error: ${data.error}`);
        }

        // Check for handler errors
        if (data.output?.error) {
          throw new Error(`Handler error: ${data.output.error}`);
        }

        // Extract embeddings
        const embeddings = data.output?.embeddings;
        if (!embeddings || embeddings.length === 0) {
          throw new Error('No embeddings returned from RunPod');
        }

        return {
          embeddings,
          tokensUsed: data.output?.tokens_used || texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
          dimensions: data.output?.dimensions || this.defaultDimensions,
          latencyMs: Date.now() - startTime,
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.warn(`[RunPod BGE-M3] Attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`[RunPod BGE-M3] Failed after ${this.retryAttempts} attempts: ${lastError?.message}`);
  }

  /**
   * Fallback: Generate embeddings via HuggingFace Inference API
   */
  private async embedViaHuggingFace(texts: string[], startTime = Date.now()): Promise<ProviderEmbeddingResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(`${HUGGINGFACE_API_URL}/${CONFIG.modelId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
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

          if (response.status === 429) {
            throw new Error('Rate limited. Retry after delay.');
          }

          if (response.status === 503) {
            throw new Error('Model is loading.');
          }

          throw new Error(`HuggingFace API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();

        // Parse response
        let embeddings: number[][];

        if (Array.isArray(data)) {
          if (Array.isArray(data[0]) && Array.isArray(data[0][0])) {
            embeddings = data.map((item: number[] | number[][]) => {
              if (Array.isArray(item) && Array.isArray(item[0])) {
                return item[0] as number[];
              }
              return item as number[];
            });
          } else if (Array.isArray(data[0]) && typeof data[0][0] === 'number') {
            embeddings = texts.length === 1 ? [data[0] as number[]] : (data as number[][]);
          } else {
            embeddings = [data as number[]];
          }
        } else {
          throw new Error('Unexpected response format from HuggingFace');
        }

        // Normalize to expected dimensions
        embeddings = embeddings.map(emb => {
          if (emb.length > this.defaultDimensions) {
            return emb.slice(0, this.defaultDimensions);
          }
          return emb;
        });

        return {
          embeddings,
          tokensUsed: texts.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0),
          dimensions: this.defaultDimensions,
          latencyMs: Date.now() - startTime,
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
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
      // Check if any provider is configured
      if (!this.isRunPodConfigured() && !HUGGINGFACE_API_KEY) {
        return {
          name: this.name,
          healthy: false,
          error: 'No API keys configured',
          lastChecked: new Date().toISOString(),
        };
      }

      // Test with a simple embedding
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

export default RunPodBGEM3Provider;
