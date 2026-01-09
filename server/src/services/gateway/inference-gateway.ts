/**
 * Inference Gateway Service
 *
 * Unified API Gateway for proxying inference requests to RunPod/Modal endpoints.
 * Handles API key validation, rate limiting, usage tracking, and billing.
 *
 * Part of KripTik AI's Auto-Deploy Private Endpoints feature.
 */

import { EventEmitter } from 'events';
import { 
  EndpointRegistry, 
  createEndpointRegistry, 
  type EndpointInfo, 
  type UsageRecord 
} from '../deployment/endpoint-registry.js';
import { RunPodDeployer, getRunPodDeployer } from '../deployment/runpod-deployer.js';
import { ModalDeployer, getModalDeployer } from '../deployment/modal-deployer.js';
import { CredentialVault } from '../security/credential-vault.js';

// =============================================================================
// TYPES
// =============================================================================

export interface InferenceRequest {
  endpointId: string;
  apiKey: string;
  body: unknown;
  stream?: boolean;
}

export interface InferenceResponse {
  success: boolean;
  data?: unknown;
  stream?: AsyncGenerator<unknown>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    computeSeconds: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

interface RateLimits {
  perMinute: number;
  perDay: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  error?: string;
}

interface RateLimitState {
  minuteCount: number;
  minuteResetAt: number;
  dayCount: number;
  dayResetAt: number;
}

// =============================================================================
// ERROR CODES
// =============================================================================

export const ERROR_CODES: Record<string, { status: number; message: string }> = {
  INVALID_API_KEY: { status: 401, message: 'Invalid API key' },
  EXPIRED_API_KEY: { status: 401, message: 'API key has expired' },
  RATE_LIMIT_MINUTE: { status: 429, message: 'Rate limit exceeded (per minute)' },
  RATE_LIMIT_DAY: { status: 429, message: 'Rate limit exceeded (per day)' },
  ENDPOINT_NOT_FOUND: { status: 404, message: 'Endpoint not found' },
  ENDPOINT_SCALING: { status: 503, message: 'Endpoint is scaling up, retry in a few seconds' },
  ENDPOINT_ERROR: { status: 502, message: 'Endpoint returned an error' },
  INSUFFICIENT_CREDITS: { status: 402, message: 'Insufficient credits' },
  ENDPOINT_TERMINATED: { status: 410, message: 'Endpoint has been terminated' },
  INTERNAL_ERROR: { status: 500, message: 'Internal server error' },
};

export function getStatusCode(errorCode: string): number {
  return ERROR_CODES[errorCode]?.status || 500;
}

// =============================================================================
// RATE LIMITER (In-memory, production should use Redis)
// =============================================================================

class RateLimiter {
  private limits: Map<string, RateLimitState> = new Map();

  async checkLimit(keyId: string, limits: RateLimits): Promise<RateLimitResult> {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000);
    const currentDay = Math.floor(now / 86400000);

    let state = this.limits.get(keyId);

    // Initialize or reset state
    if (!state) {
      state = {
        minuteCount: 0,
        minuteResetAt: currentMinute,
        dayCount: 0,
        dayResetAt: currentDay,
      };
    }

    // Reset minute counter if new minute
    if (state.minuteResetAt !== currentMinute) {
      state.minuteCount = 0;
      state.minuteResetAt = currentMinute;
    }

    // Reset day counter if new day
    if (state.dayResetAt !== currentDay) {
      state.dayCount = 0;
      state.dayResetAt = currentDay;
    }

    // Check minute limit
    if (state.minuteCount >= limits.perMinute) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date((currentMinute + 1) * 60000),
        error: 'RATE_LIMIT_MINUTE',
      };
    }

    // Check day limit
    if (state.dayCount >= limits.perDay) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date((currentDay + 1) * 86400000),
        error: 'RATE_LIMIT_DAY',
      };
    }

    // Increment counters
    state.minuteCount++;
    state.dayCount++;
    this.limits.set(keyId, state);

    return {
      allowed: true,
      remaining: limits.perMinute - state.minuteCount,
      resetAt: new Date((currentMinute + 1) * 60000),
    };
  }

  // Cleanup old entries periodically
  cleanup(): void {
    const now = Date.now();
    const currentDay = Math.floor(now / 86400000);

    for (const [keyId, state] of this.limits.entries()) {
      if (state.dayResetAt < currentDay - 1) {
        this.limits.delete(keyId);
      }
    }
  }
}

// =============================================================================
// USAGE TRACKER
// =============================================================================

class UsageTracker {
  private endpointRegistries: Map<string, EndpointRegistry> = new Map();

  private getRegistry(userId: string): EndpointRegistry {
    let registry = this.endpointRegistries.get(userId);
    if (!registry) {
      registry = createEndpointRegistry(userId);
      this.endpointRegistries.set(userId, registry);
    }
    return registry;
  }

  async recordUsage(
    userId: string,
    usage: UsageRecord
  ): Promise<void> {
    const registry = this.getRegistry(userId);
    await registry.recordUsage(usage);
  }
}

// =============================================================================
// INFERENCE GATEWAY
// =============================================================================

export class InferenceGateway extends EventEmitter {
  private rateLimiter: RateLimiter;
  private usageTracker: UsageTracker;
  private runpodDeployer: RunPodDeployer;
  private modalDeployer: ModalDeployer;
  private credentialVault: CredentialVault;

  // Cache for endpoint info to reduce DB lookups
  private endpointCache: Map<string, { endpoint: EndpointInfo; userId: string; expiresAt: number }> = new Map();
  private readonly CACHE_TTL_MS = 60000; // 1 minute

  constructor() {
    super();
    this.rateLimiter = new RateLimiter();
    this.usageTracker = new UsageTracker();
    this.runpodDeployer = getRunPodDeployer();
    this.modalDeployer = getModalDeployer();
    this.credentialVault = new CredentialVault();

    // Cleanup rate limiter periodically
    setInterval(() => this.rateLimiter.cleanup(), 300000); // Every 5 minutes
  }

  /**
   * Process an inference request
   */
  async processRequest(req: InferenceRequest): Promise<InferenceResponse> {
    const startTime = Date.now();

    try {
      // Step 1: Validate API key and get endpoint info
      const validation = await this.validateAndGetEndpoint(req.apiKey);
      if (!validation.valid || !validation.endpoint || !validation.userId) {
        return {
          success: false,
          error: {
            code: validation.error || 'INVALID_API_KEY',
            message: ERROR_CODES[validation.error || 'INVALID_API_KEY']?.message || 'Authentication failed',
          },
        };
      }

      const { endpoint, userId, keyId, rateLimits } = validation;

      // Step 2: Check rate limits
      const rateLimitCheck = await this.rateLimiter.checkLimit(keyId!, rateLimits!);
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          error: {
            code: rateLimitCheck.error || 'RATE_LIMIT_MINUTE',
            message: ERROR_CODES[rateLimitCheck.error || 'RATE_LIMIT_MINUTE']?.message || 'Rate limit exceeded',
          },
        };
      }

      // Step 3: Check endpoint status
      if (endpoint.status === 'terminated') {
        return {
          success: false,
          error: {
            code: 'ENDPOINT_TERMINATED',
            message: ERROR_CODES.ENDPOINT_TERMINATED.message,
          },
        };
      }

      if (endpoint.status === 'error') {
        return {
          success: false,
          error: {
            code: 'ENDPOINT_ERROR',
            message: endpoint.modelDescription || ERROR_CODES.ENDPOINT_ERROR.message,
          },
        };
      }

      if (endpoint.status === 'scaling') {
        return {
          success: false,
          error: {
            code: 'ENDPOINT_SCALING',
            message: ERROR_CODES.ENDPOINT_SCALING.message,
          },
        };
      }

      // Step 4: Proxy request to provider
      const proxyResult = await this.proxyToProvider(endpoint, req.body, false);

      const latencyMs = Date.now() - startTime;

      // Step 5: Track usage
      if (proxyResult.success) {
        await this.trackUsage(endpoint.id, keyId!, userId, {
          endpointId: endpoint.id,
          apiKeyId: keyId,
          userId,
          latencyMs,
          inputTokens: proxyResult.usage?.inputTokens,
          outputTokens: proxyResult.usage?.outputTokens,
          computeSeconds: proxyResult.usage?.computeSeconds,
          success: true,
        });
      } else {
        await this.trackUsage(endpoint.id, keyId!, userId, {
          endpointId: endpoint.id,
          apiKeyId: keyId,
          userId,
          latencyMs,
          success: false,
          errorCode: proxyResult.error?.code,
        });
      }

      return proxyResult;
    } catch (error) {
      console.error('[InferenceGateway] Error processing request:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      };
    }
  }

  /**
   * Process a streaming inference request
   */
  async *processStreamingRequest(req: InferenceRequest): AsyncGenerator<unknown> {
    const startTime = Date.now();

    try {
      // Validate API key and get endpoint info
      const validation = await this.validateAndGetEndpoint(req.apiKey);
      if (!validation.valid || !validation.endpoint || !validation.userId) {
        yield {
          error: {
            code: validation.error || 'INVALID_API_KEY',
            message: ERROR_CODES[validation.error || 'INVALID_API_KEY']?.message || 'Authentication failed',
          },
        };
        return;
      }

      const { endpoint, userId, keyId, rateLimits } = validation;

      // Check rate limits
      const rateLimitCheck = await this.rateLimiter.checkLimit(keyId!, rateLimits!);
      if (!rateLimitCheck.allowed) {
        yield {
          error: {
            code: rateLimitCheck.error || 'RATE_LIMIT_MINUTE',
            message: ERROR_CODES[rateLimitCheck.error || 'RATE_LIMIT_MINUTE']?.message || 'Rate limit exceeded',
          },
        };
        return;
      }

      // Check endpoint status
      if (endpoint.status === 'terminated' || endpoint.status === 'error') {
        yield {
          error: {
            code: endpoint.status === 'terminated' ? 'ENDPOINT_TERMINATED' : 'ENDPOINT_ERROR',
            message: ERROR_CODES[endpoint.status === 'terminated' ? 'ENDPOINT_TERMINATED' : 'ENDPOINT_ERROR'].message,
          },
        };
        return;
      }

      // Proxy streaming request
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      // For streaming, we'd proxy to the provider's streaming endpoint
      // This is a simplified version - in production, you'd use the provider's streaming API
      const response = await this.proxyToProvider(endpoint, req.body, true);

      if (response.success && response.data) {
        yield response.data;
        totalOutputTokens = response.usage?.outputTokens || 0;
        totalInputTokens = response.usage?.inputTokens || 0;
      } else if (response.error) {
        yield { error: response.error };
      }

      const latencyMs = Date.now() - startTime;

      // Track usage after streaming completes
      await this.trackUsage(endpoint.id, keyId!, userId, {
        endpointId: endpoint.id,
        apiKeyId: keyId,
        userId,
        latencyMs,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        success: response.success,
        errorCode: response.error?.code,
      });
    } catch (error) {
      console.error('[InferenceGateway] Error in streaming request:', error);
      yield {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      };
    }
  }

  /**
   * Validate API key and get endpoint info
   */
  private async validateAndGetEndpoint(apiKey: string): Promise<{
    valid: boolean;
    endpoint?: EndpointInfo;
    userId?: string;
    keyId?: string;
    rateLimits?: RateLimits;
    error?: string;
  }> {
    // Check if API key format is valid
    if (!apiKey || !apiKey.startsWith('kptk_live_')) {
      return { valid: false, error: 'INVALID_API_KEY' };
    }

    // Create a temporary registry to validate the key
    // In production, this would be a shared service
    const tempRegistry = createEndpointRegistry('system');
    const keyValidation = await tempRegistry.validateApiKey(apiKey);

    if (!keyValidation.valid) {
      return { valid: false, error: 'INVALID_API_KEY' };
    }

    // Check cache for endpoint info
    const cached = this.endpointCache.get(keyValidation.endpointId!);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        valid: true,
        endpoint: cached.endpoint,
        userId: cached.userId,
        keyId: keyValidation.keyId,
        rateLimits: keyValidation.rateLimits,
      };
    }

    // Get endpoint info
    const userRegistry = createEndpointRegistry(keyValidation.userId!);
    const endpoint = await userRegistry.getEndpoint(keyValidation.endpointId!);

    if (!endpoint) {
      return { valid: false, error: 'ENDPOINT_NOT_FOUND' };
    }

    // Cache the result
    this.endpointCache.set(keyValidation.endpointId!, {
      endpoint,
      userId: keyValidation.userId!,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });

    return {
      valid: true,
      endpoint,
      userId: keyValidation.userId,
      keyId: keyValidation.keyId,
      rateLimits: keyValidation.rateLimits,
    };
  }

  /**
   * Proxy request to provider endpoint
   */
  private async proxyToProvider(
    endpoint: EndpointInfo,
    body: unknown,
    stream: boolean
  ): Promise<InferenceResponse> {
    const startTime = Date.now();

    try {
      if (!endpoint.endpointUrl) {
        return {
          success: false,
          error: {
            code: 'ENDPOINT_ERROR',
            message: 'Endpoint URL not configured',
          },
        };
      }

      // Make the request to the provider endpoint
      const response = await fetch(endpoint.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(stream ? { 'Accept': 'text/event-stream' } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: {
            code: 'ENDPOINT_ERROR',
            message: `Provider returned ${response.status}: ${errorText}`,
          },
        };
      }

      const data = await response.json();
      const latencyMs = Date.now() - startTime;

      // Extract usage info from response (format varies by provider)
      const usage = this.extractUsageFromResponse(data, latencyMs);

      return {
        success: true,
        data,
        usage,
      };
    } catch (error) {
      console.error('[InferenceGateway] Error proxying to provider:', error);
      return {
        success: false,
        error: {
          code: 'ENDPOINT_ERROR',
          message: error instanceof Error ? error.message : 'Failed to reach provider endpoint',
        },
      };
    }
  }

  /**
   * Extract usage information from provider response
   */
  private extractUsageFromResponse(
    data: unknown,
    latencyMs: number
  ): InferenceResponse['usage'] {
    // Try to extract usage from various response formats
    const response = data as Record<string, unknown>;

    // OpenAI-style response
    if (response.usage && typeof response.usage === 'object') {
      const usage = response.usage as Record<string, number>;
      return {
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        latencyMs,
        computeSeconds: latencyMs / 1000,
      };
    }

    // RunPod-style response
    if (response.output && typeof response.output === 'object') {
      const output = response.output as Record<string, unknown>;
      if (output.usage && typeof output.usage === 'object') {
        const usage = output.usage as Record<string, number>;
        return {
          inputTokens: usage.input_tokens || usage.prompt_tokens || 0,
          outputTokens: usage.output_tokens || usage.completion_tokens || 0,
          latencyMs,
          computeSeconds: Number(response.executionTime || 0) / 1000 || latencyMs / 1000,
        };
      }
    }

    // Default
    return {
      inputTokens: 0,
      outputTokens: 0,
      latencyMs,
      computeSeconds: latencyMs / 1000,
    };
  }

  /**
   * Track usage for billing
   */
  private async trackUsage(
    endpointId: string,
    keyId: string,
    userId: string,
    usage: UsageRecord
  ): Promise<void> {
    try {
      await this.usageTracker.recordUsage(userId, usage);
      this.emit('usage_recorded', { endpointId, keyId, userId, usage });
    } catch (error) {
      console.error('[InferenceGateway] Error tracking usage:', error);
    }
  }

  /**
   * Get endpoint status
   */
  async getEndpointStatus(
    endpointId: string,
    apiKey: string
  ): Promise<{ status: string; activeWorkers?: number; queuedRequests?: number }> {
    const validation = await this.validateAndGetEndpoint(apiKey);
    if (!validation.valid || !validation.endpoint) {
      throw new Error(validation.error || 'Invalid API key');
    }

    if (validation.endpoint.id !== endpointId) {
      throw new Error('API key does not match endpoint');
    }

    return {
      status: validation.endpoint.status,
      activeWorkers: validation.endpoint.minWorkers,
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let inferenceGatewayInstance: InferenceGateway | null = null;

export function getInferenceGateway(): InferenceGateway {
  if (!inferenceGatewayInstance) {
    inferenceGatewayInstance = new InferenceGateway();
  }
  return inferenceGatewayInstance;
}

export default InferenceGateway;
