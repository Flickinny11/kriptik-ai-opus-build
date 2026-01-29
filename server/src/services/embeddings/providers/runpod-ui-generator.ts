/**
 * RunPod UI Generator Provider
 *
 * Uses RunPod Serverless to run FLUX.2-dev + UI-Design-LoRA for generating
 * professional UI mockup images. This is the self-hosted Stitch-equivalent
 * for unlimited scale UI generation.
 *
 * Features:
 * - FLUX.2-dev base model (best text rendering)
 * - Custom UI-Design-LoRA trained on UIClip, Enrico, Gridaco datasets
 * - Auto-scaling via RunPod Serverless (handles viral traffic)
 * - Configurable dimensions for web/mobile/tablet
 * - Trigger word "kriptik_ui" for style activation
 *
 * Model: FLUX.2-dev + ui-design-lora
 * Endpoint: Self-hosted on RunPod Serverless
 */

// ============================================================================
// Configuration
// ============================================================================

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || '';
const RUNPOD_UI_GENERATOR_ENDPOINT = process.env.RUNPOD_UI_GENERATOR_ENDPOINT || '';
const RUNPOD_UI_GENERATOR_URL = process.env.RUNPOD_UI_GENERATOR_URL ||
  (RUNPOD_UI_GENERATOR_ENDPOINT ? `https://api.runpod.ai/v2/${RUNPOD_UI_GENERATOR_ENDPOINT}` : '');

// ============================================================================
// Types
// ============================================================================

/** Available LoRA model types */
export type LoRAType = 'ui' | 'asset' | 'sliderrev';

export interface UIGenerationRequest {
  /** UI description prompt (auto-prepends trigger word if missing) */
  prompt: string;
  /** Which LoRA model to use (default: 'ui') */
  loraType?: LoRAType;
  /** Platform determines default dimensions */
  platform?: 'web' | 'mobile' | 'tablet';
  /** Custom width (overrides platform default) */
  width?: number;
  /** Custom height (overrides platform default) */
  height?: number;
  /** Inference steps (default: 8 for FLUX turbo) */
  steps?: number;
  /** Classifier-free guidance scale (default: 3.5) */
  cfgScale?: number;
  /** UI-LoRA strength 0.0-1.0 (default: 0.85) */
  loraStrength?: number;
  /** Random seed (-1 for random) */
  seed?: number;
  /** Number of images to generate */
  batchSize?: number;
  /** Negative prompt (defaults to quality negatives) */
  negativePrompt?: string;
  /** Style reference description */
  styleDescription?: string;
}

export interface UIGenerationResult {
  /** Base64 encoded images */
  images: string[];
  /** Seeds used for generation */
  seeds: number[];
  /** Generation time in seconds */
  inferenceTime: number;
  /** Final prompt used */
  prompt: string;
  /** Parameters used */
  parameters: {
    width: number;
    height: number;
    steps: number;
    cfgScale: number;
    loraStrength: number;
  };
}

export interface UIGeneratorHealth {
  name: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  lastChecked: string;
  gpuInfo?: {
    name: string;
    vram: string;
  };
}

interface RunPodJobResponse {
  id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  output?: UIGenerationResult;
  error?: string;
}

// ============================================================================
// Platform Dimension Presets
// ============================================================================

const PLATFORM_DIMENSIONS: Record<string, { width: number; height: number }> = {
  web: { width: 1280, height: 720 },        // 16:9 desktop
  mobile: { width: 430, height: 932 },       // iPhone 14 Pro
  tablet: { width: 1024, height: 1366 },     // iPad Pro 12.9"
  square: { width: 1024, height: 1024 },     // Default/square
};

// ============================================================================
// Default Parameters
// ============================================================================

const DEFAULT_PARAMS = {
  steps: 8,                    // FLUX turbo mode
  cfgScale: 3.5,               // FLUX works well with lower CFG
  loraStrength: 0.85,          // Strong LoRA influence for consistent UI style
  seed: -1,                    // Random
  batchSize: 1,
  negativePrompt: 'blurry, low quality, distorted text, broken layout, watermark, signature, amateur, ugly, deformed',
};

/**
 * Trigger words for each LoRA model type
 * These activate the specific style during generation
 */
const TRIGGER_WORDS: Record<LoRAType, string> = {
  ui: 'kriptik_ui',           // UI mockups - Awwwards-tier interfaces
  asset: 'kriptik_asset',     // Photorealistic assets - hero images, backgrounds
  sliderrev: 'sliderrev_slider', // SliderRevolution - premium slider/carousel designs
};

/**
 * Default LoRA strengths by type
 * Asset LoRA uses higher strength for more dramatic effect
 */
const LORA_STRENGTHS: Record<LoRAType, number> = {
  ui: 0.85,
  asset: 0.90,
  sliderrev: 0.88,
};

// ============================================================================
// UI Generator Provider Implementation
// ============================================================================

export class RunPodUIGeneratorProvider {
  readonly name = 'runpod-ui-generator';
  readonly model = 'flux2-dev+ui-design-lora';

  private retryAttempts = 3;
  private retryDelay = 3000;
  private pollInterval = 2000;
  private maxPollTime = 120000; // 2 minutes max wait

  /**
   * Check if RunPod endpoint is configured
   */
  isConfigured(): boolean {
    return !!(RUNPOD_API_KEY && RUNPOD_UI_GENERATOR_URL);
  }

  /**
   * Generate UI mockup images
   */
  async generate(request: UIGenerationRequest): Promise<UIGenerationResult> {
    if (!this.isConfigured()) {
      throw new Error('UI Generator RunPod endpoint not configured. Set RUNPOD_API_KEY and RUNPOD_UI_GENERATOR_ENDPOINT.');
    }

    // Determine LoRA type and trigger word
    const loraType: LoRAType = request.loraType || 'ui';
    const triggerWord = TRIGGER_WORDS[loraType];
    const defaultLoraStrength = LORA_STRENGTHS[loraType];

    // Ensure prompt has trigger word
    let prompt = request.prompt;
    if (!prompt.toLowerCase().includes(triggerWord)) {
      prompt = `${triggerWord}, ${prompt}`;
    }

    // Add style description if provided
    if (request.styleDescription) {
      prompt = `${prompt}, ${request.styleDescription}`;
    }

    // Determine dimensions
    const platform = request.platform || 'square';
    const dimensions = PLATFORM_DIMENSIONS[platform] || PLATFORM_DIMENSIONS.square;
    const width = request.width || dimensions.width;
    const height = request.height || dimensions.height;

    // Build request payload
    const payload = {
      input: {
        prompt,
        negative_prompt: request.negativePrompt || DEFAULT_PARAMS.negativePrompt,
        width,
        height,
        steps: request.steps || DEFAULT_PARAMS.steps,
        cfg_scale: request.cfgScale || DEFAULT_PARAMS.cfgScale,
        lora_strength: request.loraStrength || defaultLoraStrength,
        lora_type: loraType,  // Tell endpoint which LoRA to use
        seed: request.seed ?? DEFAULT_PARAMS.seed,
        batch_size: request.batchSize || DEFAULT_PARAMS.batchSize,
      },
    };

    // Try synchronous endpoint first (faster for quick generations)
    try {
      const result = await this.callSyncEndpoint(payload);
      return result;
    } catch (error) {
      // Fall back to async endpoint for longer generations
      console.log('[UI-Generator] Sync failed, trying async:', error instanceof Error ? error.message : error);
      return this.callAsyncEndpoint(payload);
    }
  }

  /**
   * Generate multiple UI variations in parallel
   */
  async generateVariations(
    request: UIGenerationRequest,
    count: number
  ): Promise<UIGenerationResult[]> {
    const requests: Promise<UIGenerationResult>[] = [];

    for (let i = 0; i < count; i++) {
      // Use different seeds for variations
      requests.push(
        this.generate({
          ...request,
          seed: request.seed === -1 ? -1 : (request.seed || 0) + i,
        })
      );
    }

    return Promise.all(requests);
  }

  /**
   * Call synchronous endpoint (/runsync)
   */
  private async callSyncEndpoint(payload: unknown): Promise<UIGenerationResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(`${RUNPOD_UI_GENERATOR_URL}/runsync`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RUNPOD_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();

          // Handle cold start
          if (response.status === 502 || response.status === 503) {
            throw new Error('Endpoint starting up (cold start)');
          }

          // Timeout - use async endpoint
          if (response.status === 504) {
            throw new Error('Sync timeout - use async');
          }

          throw new Error(`RunPod API error (${response.status}): ${errorText}`);
        }

        const data: RunPodJobResponse = await response.json();

        if (data.status === 'FAILED') {
          throw new Error(`Generation failed: ${data.error || 'Unknown error'}`);
        }

        if (!data.output) {
          throw new Error('No output in response');
        }

        return data.output;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry if we should use async
        if (lastError.message.includes('async')) {
          throw lastError;
        }

        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(1.5, attempt - 1);
          console.warn(`[UI-Generator] Attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`[UI-Generator] Failed after ${this.retryAttempts} attempts: ${lastError?.message}`);
  }

  /**
   * Call asynchronous endpoint (/run + /status polling)
   */
  private async callAsyncEndpoint(payload: unknown): Promise<UIGenerationResult> {
    // Submit job
    const submitResponse = await fetch(`${RUNPOD_UI_GENERATOR_URL}/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(`Failed to submit job: ${errorText}`);
    }

    const submitData: { id: string } = await submitResponse.json();
    const jobId = submitData.id;

    // Poll for completion
    const startTime = Date.now();

    while (Date.now() - startTime < this.maxPollTime) {
      await new Promise(resolve => setTimeout(resolve, this.pollInterval));

      const statusResponse = await fetch(`${RUNPOD_UI_GENERATOR_URL}/status/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        },
      });

      if (!statusResponse.ok) {
        continue; // Retry polling
      }

      const statusData: RunPodJobResponse = await statusResponse.json();

      if (statusData.status === 'COMPLETED' && statusData.output) {
        return statusData.output;
      }

      if (statusData.status === 'FAILED') {
        throw new Error(`Generation failed: ${statusData.error || 'Unknown error'}`);
      }

      if (statusData.status === 'CANCELLED') {
        throw new Error('Generation was cancelled');
      }
    }

    throw new Error('Generation timed out');
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<void> {
    await fetch(`${RUNPOD_UI_GENERATOR_URL}/cancel/${jobId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
      },
    });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<UIGeneratorHealth> {
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

      // Check endpoint health
      const response = await fetch(`${RUNPOD_UI_GENERATOR_URL}/health`, {
        headers: {
          'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const health = await response.json();

      return {
        name: this.name,
        healthy: true,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        gpuInfo: health.gpu ? {
          name: health.gpu.name || 'Unknown',
          vram: health.gpu.vram || 'Unknown',
        } : undefined,
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

  /**
   * Get current worker stats
   */
  async getWorkerStats(): Promise<{
    activeWorkers: number;
    queuedJobs: number;
    completedJobs: number;
  }> {
    try {
      const response = await fetch(`${RUNPOD_UI_GENERATOR_URL.replace('/v2/', '/v1/endpoints/')}`, {
        headers: {
          'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get worker stats');
      }

      const data = await response.json();

      return {
        activeWorkers: data.workersActive || 0,
        queuedJobs: data.jobsInQueue || 0,
        completedJobs: data.jobsCompleted || 0,
      };
    } catch {
      return {
        activeWorkers: 0,
        queuedJobs: 0,
        completedJobs: 0,
      };
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let providerInstance: RunPodUIGeneratorProvider | null = null;

export function getUIGeneratorProvider(): RunPodUIGeneratorProvider {
  if (!providerInstance) {
    providerInstance = new RunPodUIGeneratorProvider();
  }
  return providerInstance;
}

export default RunPodUIGeneratorProvider;
