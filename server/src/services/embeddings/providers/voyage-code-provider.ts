/**
 * Voyage-code-3 Embedding Provider
 * 
 * Uses Voyage AI API to generate code embeddings with the voyage-code-3 model.
 * Features:
 * - 32K token context (excellent for full files)
 * - Configurable dimensions: 256, 512, 1024, 2048
 * - Quantization support: float32, int8, binary
 * - Optimized for code similarity and search
 * - +16.81% MRR improvement over CodeSage
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

const CONFIG = MODEL_CONFIG['voyage-code-3'];
const COST = EMBEDDING_COSTS['voyage-code-3'];

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';

interface VoyageResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    total_tokens: number;
  };
}

interface VoyageError {
  error: {
    message: string;
    type: string;
  };
}

// ============================================================================
// Voyage-code-3 Provider Implementation
// ============================================================================

export class VoyageCodeProvider implements EmbeddingProvider {
  readonly name = 'voyage-code-3';
  readonly model = CONFIG.modelId;
  readonly defaultDimensions = CONFIG.dimensions;
  readonly maxTokens = CONFIG.maxTokens;
  readonly maxBatchSize = CONFIG.maxBatchSize;
  readonly costPer1kTokens = COST.costPer1kTokens;
  
  private apiKey: string;
  private retryAttempts = 3;
  private retryDelay = 1000;

  constructor() {
    this.apiKey = process.env.VOYAGE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[Voyage-code-3] VOYAGE_API_KEY not set - provider will be unavailable');
    }
  }

  /**
   * Generate embeddings for code inputs
   */
  async embed(texts: string[], options?: EmbeddingOptions): Promise<ProviderEmbeddingResult> {
    if (!this.apiKey) {
      throw new Error('VOYAGE_API_KEY not configured');
    }

    const startTime = Date.now();
    const dimensions = options?.dimensions || this.defaultDimensions;
    
    // Process in batches if needed
    const allEmbeddings: number[][] = [];
    let totalTokens = 0;
    
    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const batch = texts.slice(i, i + this.maxBatchSize);
      const result = await this.processBatch(batch, dimensions, options);
      allEmbeddings.push(...result.embeddings);
      totalTokens += result.tokensUsed;
    }

    return {
      embeddings: allEmbeddings,
      tokensUsed: totalTokens,
      dimensions,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Process a single batch of texts
   */
  private async processBatch(
    texts: string[],
    dimensions: number,
    options?: EmbeddingOptions
  ): Promise<{ embeddings: number[][]; tokensUsed: number }> {
    let lastError: Error | null = null;
    
    // Truncate texts that exceed context window
    const truncatedTexts = texts.map(text => {
      // Rough estimate: 1 token ≈ 4 characters for code
      const maxChars = this.maxTokens * 4;
      if (text.length > maxChars) {
        // Truncate with overlap for context preservation
        const overlapChars = 1000;
        console.warn(`[Voyage-code-3] Truncating text from ${text.length} to ${maxChars} chars`);
        return text.slice(0, maxChars - overlapChars) + '\n...[truncated]...\n' + text.slice(-overlapChars);
      }
      return text;
    });
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const requestBody: Record<string, unknown> = {
          model: this.model,
          input: truncatedTexts,
          input_type: 'document', // For code, use 'document' type
        };

        // Add dimensions if not default (Voyage supports variable dims)
        if (dimensions !== 1024) {
          requestBody.output_dimension = dimensions;
        }

        // Add quantization if requested
        if (options?.quantization && options.quantization !== 'float32') {
          requestBody.output_dtype = options.quantization === 'int8' ? 'int8' : 'ubinary';
        }

        // Server-side external API call to Voyage AI (credentials: omit for external APIs)
        const response = await fetch(VOYAGE_API_URL, {
          method: 'POST',
          credentials: 'omit', // External API - no browser cookies
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json() as VoyageError;
          
          // Handle rate limiting
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
            throw new Error(`Rate limited. Retry after ${retryAfter}s`);
          }
          
          throw new Error(`Voyage API error (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json() as VoyageResponse;
        
        // Sort by index to maintain order
        const sortedData = [...data.data].sort((a, b) => a.index - b.index);
        const embeddings = sortedData.map(item => item.embedding);

        return {
          embeddings,
          tokensUsed: data.usage.total_tokens,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.warn(`[Voyage-code-3] Attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`[Voyage-code-3] Failed after ${this.retryAttempts} attempts: ${lastError?.message}`);
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

      // Simple test embedding with minimal code
      const result = await this.embed(['function test() { return true; }']);
      
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

export default VoyageCodeProvider;
