/**
 * RunPod SigLIP 2 Embedding Provider
 *
 * Uses RunPod Serverless to generate visual embeddings with SigLIP 2.
 * This provider calls the deployed SigLIP endpoint on RunPod.
 *
 * Features:
 * - 1152-dimensional embeddings (So400m model)
 * - Image and text input support
 * - Text-image similarity
 * - Scale-to-zero (cost efficient)
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

// RunPod endpoint configuration
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || '';
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_SIGLIP || '';
const RUNPOD_ENDPOINT_URL = process.env.RUNPOD_URL_SIGLIP ||
  (RUNPOD_ENDPOINT_ID ? `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/runsync` : '');

// Fallback to HuggingFace if RunPod not configured
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY || '';
const HUGGINGFACE_API_URL = 'https://router.huggingface.co/hf-inference/models';

// Updated dimensions for So400m model
const SIGLIP_SO400M_DIMENSIONS = 1152;

interface RunPodResponse {
  id?: string;
  status?: string;
  output?: {
    embeddings?: number[][];
    image_embedding?: number[];
    text_embeddings?: number[][];
    similarity_scores?: number[];
    dimensions?: number;
    type?: string;
    error?: string;
    traceback?: string;
  };
  error?: string;
}

// ============================================================================
// RunPod SigLIP Provider Implementation
// ============================================================================

export class RunPodSigLIPProvider implements EmbeddingProvider {
  readonly name = 'runpod-siglip';
  readonly model = 'google/siglip-so400m-patch14-384';
  readonly defaultDimensions = SIGLIP_SO400M_DIMENSIONS;
  readonly maxTokens = CONFIG.maxTokens;
  readonly maxBatchSize = CONFIG.maxBatchSize;
  readonly costPer1kTokens = COST.costPerText * 1000;

  private retryAttempts = 3;
  private retryDelay = 1000;

  /**
   * Check if RunPod endpoint is configured
   */
  isRunPodConfigured(): boolean {
    return !!(RUNPOD_API_KEY && RUNPOD_ENDPOINT_URL);
  }

  /**
   * Generate embeddings for text inputs (for text-image similarity)
   */
  async embed(texts: string[], _options?: EmbeddingOptions): Promise<ProviderEmbeddingResult> {
    const startTime = Date.now();

    // Try RunPod first if configured
    if (this.isRunPodConfigured()) {
      try {
        return await this.embedTextViaRunPod(texts, startTime);
      } catch (error) {
        console.warn('[RunPod SigLIP] RunPod failed, falling back to HuggingFace:', error);
      }
    }

    // Fallback to HuggingFace
    if (HUGGINGFACE_API_KEY) {
      return await this.embedTextViaHuggingFace(texts, startTime);
    }

    throw new Error('No embedding provider configured. Set RUNPOD_API_KEY or HUGGINGFACE_API_KEY.');
  }

  /**
   * Generate embeddings for an image
   */
  async embedImage(imageData: string, options?: EmbeddingOptions): Promise<ProviderEmbeddingResult> {
    const startTime = Date.now();

    // Try RunPod first if configured
    if (this.isRunPodConfigured()) {
      try {
        return await this.embedImageViaRunPod(imageData, options, startTime);
      } catch (error) {
        console.warn('[RunPod SigLIP] RunPod failed, falling back to HuggingFace:', error);
      }
    }

    // Fallback to HuggingFace
    if (HUGGINGFACE_API_KEY) {
      return await this.embedImageViaHuggingFace(imageData, startTime);
    }

    throw new Error('No embedding provider configured.');
  }

  /**
   * Generate text embeddings via RunPod
   */
  private async embedTextViaRunPod(texts: string[], startTime: number): Promise<ProviderEmbeddingResult> {
    const response = await fetch(RUNPOD_ENDPOINT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          texts,
          type: 'text',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RunPod API error (${response.status}): ${errorText}`);
    }

    const data: RunPodResponse = await response.json();

    if (data.error || data.output?.error) {
      throw new Error(data.error || data.output?.error);
    }

    const embeddings = data.output?.embeddings || data.output?.text_embeddings;
    if (!embeddings) {
      throw new Error('No embeddings returned');
    }

    return {
      embeddings,
      tokensUsed: texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
      dimensions: data.output?.dimensions || this.defaultDimensions,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Generate image embeddings via RunPod
   */
  private async embedImageViaRunPod(
    imageData: string,
    options?: EmbeddingOptions,
    startTime = Date.now()
  ): Promise<ProviderEmbeddingResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        // Determine input type
        const inputType = options?.textForVisual ? 'similarity' : 'image';

        const response = await fetch(RUNPOD_ENDPOINT_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RUNPOD_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: {
              image: imageData,
              texts: options?.textForVisual ? [options.textForVisual] : undefined,
              type: inputType,
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`RunPod API error (${response.status}): ${errorText}`);
        }

        const data: RunPodResponse = await response.json();

        if (data.error || data.output?.error) {
          throw new Error(data.error || data.output?.error);
        }

        // Get embeddings based on type
        let embeddings: number[][];

        if (data.output?.image_embedding) {
          embeddings = [data.output.image_embedding];
        } else if (data.output?.embeddings) {
          embeddings = data.output.embeddings;
        } else {
          throw new Error('No embeddings returned');
        }

        return {
          embeddings,
          tokensUsed: 1, // Images count as 1 unit
          dimensions: data.output?.dimensions || this.defaultDimensions,
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

    throw new Error(`[RunPod SigLIP] Failed after ${this.retryAttempts} attempts: ${lastError?.message}`);
  }

  /**
   * Fallback: Generate text embeddings via HuggingFace
   */
  private async embedTextViaHuggingFace(texts: string[], startTime: number): Promise<ProviderEmbeddingResult> {
    const embeddings: number[][] = [];

    for (const text of texts) {
      const response = await fetch(`${HUGGINGFACE_API_URL}/${CONFIG.modelId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text,
          options: { wait_for_model: true },
        }),
      });

      if (!response.ok) {
        throw new Error(`HuggingFace API error: ${response.status}`);
      }

      const data = await response.json();
      let embedding: number[];

      if (Array.isArray(data) && typeof data[0] === 'number') {
        embedding = data;
      } else if (Array.isArray(data) && Array.isArray(data[0])) {
        embedding = data[0];
      } else {
        throw new Error('Unexpected response format');
      }

      embeddings.push(embedding.slice(0, this.defaultDimensions));
    }

    return {
      embeddings,
      tokensUsed: texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
      dimensions: this.defaultDimensions,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Fallback: Generate image embeddings via HuggingFace
   */
  private async embedImageViaHuggingFace(imageData: string, startTime: number): Promise<ProviderEmbeddingResult> {
    const isUrl = imageData.startsWith('http://') || imageData.startsWith('https://');

    let body: BodyInit;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
    };

    if (isUrl) {
      const imageResponse = await fetch(imageData);
      body = await imageResponse.blob();
      headers['Content-Type'] = 'application/octet-stream';
    } else {
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      body = new Blob([bytes], { type: 'image/png' });
      headers['Content-Type'] = 'application/octet-stream';
    }

    const response = await fetch(`${HUGGINGFACE_API_URL}/${CONFIG.modelId}`, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`HuggingFace API error: ${response.status}`);
    }

    const data = await response.json();
    let embedding: number[];

    if (Array.isArray(data) && typeof data[0] === 'number') {
      embedding = data;
    } else if (Array.isArray(data) && Array.isArray(data[0])) {
      embedding = data[0];
    } else {
      throw new Error('Unexpected response format');
    }

    return {
      embeddings: [embedding.slice(0, this.defaultDimensions)],
      tokensUsed: 1,
      dimensions: this.defaultDimensions,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      if (!this.isRunPodConfigured() && !HUGGINGFACE_API_KEY) {
        return {
          name: this.name,
          healthy: false,
          error: 'No API keys configured',
          lastChecked: new Date().toISOString(),
        };
      }

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

export default RunPodSigLIPProvider;
