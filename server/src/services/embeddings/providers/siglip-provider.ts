/**
 * SigLIP 2 Embedding Provider
 *
 * Uses HuggingFace Inference API to generate visual embeddings with SigLIP 2.
 * Features:
 * - 768-dimensional embeddings
 * - Image and text input support
 * - Text-image similarity
 * - Efficient for design/screenshot analysis
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

const CONFIG = MODEL_CONFIG['siglip-2'];
const COST = EMBEDDING_COSTS['siglip-2'];

const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models';

// ============================================================================
// SigLIP Provider Implementation
// ============================================================================

export class SigLIPProvider implements EmbeddingProvider {
  readonly name = 'siglip-2';
  readonly model = CONFIG.modelId;
  readonly defaultDimensions = CONFIG.dimensions;
  readonly maxTokens = CONFIG.maxTokens;
  readonly maxBatchSize = CONFIG.maxBatchSize;
  readonly costPer1kTokens = COST.costPerText * 1000; // Convert to per-1k

  private apiKey: string;
  private retryAttempts = 3;
  private retryDelay = 1000;

  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[SigLIP] HUGGINGFACE_API_KEY not set - provider will be unavailable');
    }
  }

  /**
   * Generate embeddings for text inputs (for text-image similarity)
   */
  async embed(texts: string[], _options?: EmbeddingOptions): Promise<ProviderEmbeddingResult> {
    if (!this.apiKey) {
      throw new Error('HUGGINGFACE_API_KEY not configured');
    }

    const startTime = Date.now();
    const embeddings: number[][] = [];

    // Process texts individually (SigLIP text encoding)
    for (const text of texts) {
      const embedding = await this.embedText(text);
      embeddings.push(embedding);
    }

    // Estimate tokens for text
    const tokensUsed = texts.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);

    return {
      embeddings,
      tokensUsed,
      dimensions: this.defaultDimensions,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Generate embedding for a single text
   */
  private async embedText(text: string): Promise<number[]> {
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
            inputs: text,
            options: {
              wait_for_model: true,
              use_cache: true,
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();

          if (response.status === 429) {
            throw new Error('Rate limited');
          }

          if (response.status === 503) {
            throw new Error('Model is loading');
          }

          throw new Error(`HuggingFace API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();

        // Parse response - SigLIP returns text embeddings
        let embedding: number[];

        if (Array.isArray(data) && typeof data[0] === 'number') {
          embedding = data;
        } else if (Array.isArray(data) && Array.isArray(data[0])) {
          // Nested array - take first
          embedding = data[0];
        } else if (data.embeddings) {
          embedding = data.embeddings;
        } else {
          throw new Error('Unexpected response format');
        }

        // Ensure correct dimensions
        if (embedding.length > this.defaultDimensions) {
          embedding = embedding.slice(0, this.defaultDimensions);
        }

        return embedding;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.warn(`[SigLIP] Text embed attempt ${attempt} failed, retrying:`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`[SigLIP] Text embedding failed: ${lastError?.message}`);
  }

  /**
   * Generate embedding for an image
   */
  async embedImage(imageData: string, _options?: EmbeddingOptions): Promise<ProviderEmbeddingResult> {
    if (!this.apiKey) {
      throw new Error('HUGGINGFACE_API_KEY not configured');
    }

    const startTime = Date.now();
    let lastError: Error | null = null;

    // Determine if imageData is URL or base64
    const isUrl = imageData.startsWith('http://') || imageData.startsWith('https://');

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        let body: BodyInit;
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${this.apiKey}`,
        };

        if (isUrl) {
          // Fetch image from URL (server-side, no credentials needed)
          const imageResponse = await fetch(imageData, { credentials: 'omit' });
          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image from URL: ${imageResponse.status}`);
          }
          body = await imageResponse.blob();
          headers['Content-Type'] = 'application/octet-stream';
        } else {
          // Base64 - convert to blob
          const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          body = new Blob([bytes], { type: 'image/png' });
          headers['Content-Type'] = 'application/octet-stream';
        }

        // Server-side external API call to HuggingFace for image embedding
        const response = await fetch(`${HUGGINGFACE_API_URL}/${CONFIG.modelId}`, {
          method: 'POST',
          credentials: 'omit', // External API - no browser cookies
          headers,
          body,
        });

        if (!response.ok) {
          const errorText = await response.text();

          if (response.status === 429) {
            throw new Error('Rate limited');
          }

          if (response.status === 503) {
            throw new Error('Model is loading');
          }

          throw new Error(`HuggingFace API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();

        // Parse image embedding response
        let embedding: number[];

        if (Array.isArray(data) && typeof data[0] === 'number') {
          embedding = data;
        } else if (Array.isArray(data) && Array.isArray(data[0])) {
          embedding = data[0];
        } else if (data.embeddings) {
          embedding = data.embeddings;
        } else {
          throw new Error('Unexpected response format for image embedding');
        }

        // Ensure correct dimensions
        if (embedding.length > this.defaultDimensions) {
          embedding = embedding.slice(0, this.defaultDimensions);
        }

        return {
          embeddings: [embedding],
          tokensUsed: 1, // Images counted as 1 unit
          dimensions: this.defaultDimensions,
          latencyMs: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.warn(`[SigLIP] Image embed attempt ${attempt} failed, retrying:`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`[SigLIP] Image embedding failed: ${lastError?.message}`);
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

      // Test with text embedding (simpler than image)
      const result = await this.embed(['visual health check']);

      if (result.embeddings.length === 0) {
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

export default SigLIPProvider;
