/**
 * RunPod VL-JEPA Provider
 *
 * Uses RunPod Serverless to run the VL-JEPA (Vision-Language Joint Embedding
 * Predictive Architecture) model for advanced vision-language understanding.
 *
 * VL-JEPA is specifically designed for:
 * - Intent understanding from text and visual inputs
 * - Predictive architecture for build outcome prediction
 * - Cross-modal embeddings (text + image → unified representation)
 * - Video understanding (temporal reasoning)
 *
 * Model: facebook/vl-jepa (1.6B parameters)
 * Dimensions: 1024
 */

import type {
  EmbeddingProvider,
  EmbeddingOptions,
  ProviderEmbeddingResult,
  ProviderHealth,
} from '../embedding-service.js';

// ============================================================================
// Configuration
// ============================================================================

// RunPod endpoint configuration
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || '';
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_VL_JEPA || '';
const RUNPOD_ENDPOINT_URL = process.env.RUNPOD_URL_VL_JEPA ||
  (RUNPOD_ENDPOINT_ID ? `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/runsync` : '');

const VL_JEPA_DIMENSIONS = 1024;

interface VLJEPAOutput {
  embedding?: number[];
  embeddings?: number[][];
  image_embedding?: number[];
  text_embedding?: number[];
  predictions?: {
    success_probability?: number;
    complexity_score?: number;
    recommended_patterns?: string[];
    potential_issues?: string[];
    pattern_similarities?: number[];
  };
  type?: string;
  dimensions?: number;
  error?: string;
  traceback?: string;
}

interface RunPodResponse {
  id?: string;
  status?: string;
  output?: VLJEPAOutput;
  error?: string;
}

// ============================================================================
// VL-JEPA Provider Implementation
// ============================================================================

export class RunPodVLJEPAProvider implements EmbeddingProvider {
  readonly name = 'runpod-vl-jepa';
  readonly model = 'facebook/vl-jepa';
  readonly defaultDimensions = VL_JEPA_DIMENSIONS;
  readonly maxTokens = 4096;
  readonly maxBatchSize = 8;
  readonly costPer1kTokens = 0.15; // Higher cost for larger model

  private retryAttempts = 3;
  private retryDelay = 2000;

  /**
   * Check if RunPod endpoint is configured
   */
  isConfigured(): boolean {
    return !!(RUNPOD_API_KEY && RUNPOD_ENDPOINT_URL);
  }

  /**
   * Generate embeddings for text inputs (intent understanding)
   */
  async embed(texts: string[], options?: EmbeddingOptions): Promise<ProviderEmbeddingResult> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      throw new Error('VL-JEPA RunPod endpoint not configured. Set RUNPOD_API_KEY and RUNPOD_ENDPOINT_VL_JEPA.');
    }

    const embeddings: number[][] = [];
    let totalTokens = 0;

    // Process each text as an intent
    for (const text of texts) {
      const result = await this.callEndpoint({
        type: 'intent',
        text,
        context: options?.cacheKey || '',
      });

      if (result.embedding) {
        embeddings.push(result.embedding);
      }

      totalTokens += Math.ceil(text.length / 4);
    }

    return {
      embeddings,
      tokensUsed: totalTokens,
      dimensions: this.defaultDimensions,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Generate embeddings for visual + text (joint understanding)
   */
  async embedVisualText(
    imageData: string,
    text: string
  ): Promise<{
    embedding: number[];
    imageEmbedding?: number[];
    textEmbedding?: number[];
    latencyMs: number;
  }> {
    const startTime = Date.now();

    const result = await this.callEndpoint({
      type: 'visual_text',
      image: imageData,
      text,
    });

    return {
      embedding: result.embedding || [],
      imageEmbedding: result.image_embedding,
      textEmbedding: result.text_embedding,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Predictive mode: Predict build outcomes based on intent and patterns
   */
  async predict(
    intent: string,
    patterns: number[][],
    context: Record<string, unknown> = {}
  ): Promise<{
    embedding: number[];
    predictions: VLJEPAOutput['predictions'];
    latencyMs: number;
  }> {
    const startTime = Date.now();

    const result = await this.callEndpoint({
      type: 'predictive',
      intent,
      patterns,
      context,
    });

    return {
      embedding: result.embedding || [],
      predictions: result.predictions,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Video understanding mode
   */
  async embedVideo(
    frames: string[],
    text?: string
  ): Promise<{
    embedding: number[];
    frameEmbeddings?: number[][];
    latencyMs: number;
  }> {
    const startTime = Date.now();

    const result = await this.callEndpoint({
      type: 'video',
      frames,
      text,
    });

    // Parse frame embeddings if present
    let frameEmbeddings: number[][] | undefined;
    const rawOutput = result as unknown as { frame_embeddings?: number[][] };
    if (rawOutput.frame_embeddings) {
      frameEmbeddings = rawOutput.frame_embeddings;
    }

    return {
      embedding: result.embedding || [],
      frameEmbeddings,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Call RunPod endpoint with retry logic
   */
  private async callEndpoint(input: Record<string, unknown>): Promise<VLJEPAOutput> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(RUNPOD_ENDPOINT_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RUNPOD_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ input }),
        });

        if (!response.ok) {
          const errorText = await response.text();

          // Handle cold start (502/503)
          if (response.status === 502 || response.status === 503) {
            throw new Error('Endpoint starting up (cold start)');
          }

          throw new Error(`RunPod API error (${response.status}): ${errorText}`);
        }

        const data: RunPodResponse = await response.json();

        if (data.error) {
          throw new Error(`RunPod error: ${data.error}`);
        }

        if (data.output?.error) {
          throw new Error(`Handler error: ${data.output.error}`);
        }

        return data.output || {};

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.retryAttempts) {
          // Longer delay for cold starts
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.warn(`[VL-JEPA] Attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`[VL-JEPA] Failed after ${this.retryAttempts} attempts: ${lastError?.message}`);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      if (!this.isConfigured()) {
        return {
          name: this.name,
          healthy: false,
          error: 'Endpoint not configured',
          lastChecked: new Date().toISOString(),
        };
      }

      // Simple intent test
      const result = await this.callEndpoint({
        type: 'intent',
        text: 'health check',
      });

      if (!result.embedding || result.embedding.length === 0) {
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

// ============================================================================
// Singleton
// ============================================================================

let providerInstance: RunPodVLJEPAProvider | null = null;

export function getVLJEPAProvider(): RunPodVLJEPAProvider {
  if (!providerInstance) {
    providerInstance = new RunPodVLJEPAProvider();
  }
  return providerInstance;
}

export default RunPodVLJEPAProvider;
