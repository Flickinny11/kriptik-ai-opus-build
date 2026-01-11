/**
 * Endpoint Registry Service
 *
 * Comprehensive management of private user endpoints with API key authentication.
 * This is the foundation for KripTik's private endpoint system.
 *
 * Part of KripTik AI's Auto-Deploy Private Endpoints feature.
 */

import { eq, and, desc, gte, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../../db.js';
import { userEndpoints, endpointApiKeys, endpointUsage } from '../../schema.js';

// =============================================================================
// TYPES
// =============================================================================

export interface EndpointRegistryConfig {
  userId: string;
}

export type EndpointModality = 'llm' | 'image' | 'video' | 'audio';
export type EndpointProvider = 'runpod' | 'modal';
export type EndpointType = 'serverless' | 'dedicated';
export type EndpointStatus = 'provisioning' | 'active' | 'scaling' | 'idle' | 'error' | 'terminated';

export interface RegisterEndpointInput {
  trainingJobId?: string;
  sourceType: 'training' | 'open_source_studio' | 'imported';
  modelName: string;
  modelDescription?: string;
  modality: EndpointModality;
  baseModelId?: string;
  huggingFaceRepoUrl?: string;
  provider: EndpointProvider;
  gpuType: string;
  endpointType: EndpointType;
  minWorkers?: number;
  maxWorkers?: number;
}

export interface EndpointInfo {
  id: string;
  userId: string;
  modelName: string;
  modelDescription?: string;
  modality: string;
  provider: string;
  status: string;
  endpointUrl: string;
  gpuType?: string;
  minWorkers: number;
  maxWorkers: number;
  huggingFaceRepoUrl?: string;
  sourceType: 'training' | 'open_source_studio' | 'imported';
  trainingJobId?: string;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyInfo {
  id: string;
  keyPrefix: string;
  keyName: string;
  permissions: string[];
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  isActive: boolean;
  lastUsedAt?: string;
  createdAt: string;
}

export interface ConnectionInfo {
  endpointId: string;
  endpointUrl: string;
  provider: EndpointProvider;
  modality: string;
  status: string;
  code: {
    curl: string;
    python: string;
    typescript: string;
    openai_compatible?: string;
  };
  openaiConfig?: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
  rateLimits: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
}

export interface UsageRecord {
  endpointId: string;
  apiKeyId?: string;
  userId: string;
  requestId?: string;
  method?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  computeSeconds?: number;
  costUsd?: number;
  creditsCharged?: number;
  success: boolean;
  errorCode?: string;
}

export interface UsageStats {
  period: 'day' | 'week' | 'month';
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalCreditsUsed: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  totalComputeSeconds: number;
  requestsByDay: Array<{ date: string; count: number; credits: number }>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const BCRYPT_COST_FACTOR = 12;
const API_KEY_PREFIX = 'kptk_live_';
const API_KEY_LENGTH = 32;

// =============================================================================
// ENDPOINT REGISTRY CLASS
// =============================================================================

export class EndpointRegistry {
  private userId: string;

  constructor(config: EndpointRegistryConfig) {
    this.userId = config.userId;
  }

  /**
   * Register a new endpoint (creates DB record, returns endpoint ID)
   */
  async registerEndpoint(input: RegisterEndpointInput): Promise<{ endpointId: string }> {
    const endpointId = crypto.randomUUID();

    await db.insert(userEndpoints).values({
      id: endpointId,
      userId: this.userId,
      trainingJobId: input.trainingJobId || null,
      sourceType: input.sourceType,
      modelName: input.modelName,
      modelDescription: input.modelDescription || null,
      modality: input.modality,
      baseModelId: input.baseModelId || null,
      huggingFaceRepoUrl: input.huggingFaceRepoUrl || null,
      provider: input.provider,
      endpointType: input.endpointType,
      gpuType: input.gpuType,
      minWorkers: input.minWorkers ?? 0,
      maxWorkers: input.maxWorkers ?? 1,
      idleTimeoutSeconds: 30,
      status: 'provisioning',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return { endpointId };
  }

  /**
   * Generate a new API key for an endpoint
   */
  async generateApiKey(
    endpointId: string,
    keyName: string = 'default'
  ): Promise<{ apiKey: string; keyInfo: ApiKeyInfo }> {
    // Verify endpoint ownership
    const endpoint = await this.getEndpoint(endpointId);
    if (!endpoint) {
      throw new Error('Endpoint not found or not owned by user');
    }

    // Generate cryptographically secure random key
    const randomBytes = crypto.randomBytes(API_KEY_LENGTH);
    const apiKey = API_KEY_PREFIX + randomBytes.toString('base64url').substring(0, API_KEY_LENGTH);

    // Extract prefix for display
    const keyPrefix = apiKey.substring(0, 12) + '...';

    // Hash the key for storage
    const keyHash = await bcrypt.hash(apiKey, BCRYPT_COST_FACTOR);

    const keyId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(endpointApiKeys).values({
      id: keyId,
      endpointId,
      userId: this.userId,
      keyName,
      keyPrefix,
      keyHash,
      permissions: ['inference'],
      rateLimitPerMinute: 60,
      rateLimitPerDay: 10000,
      isActive: true,
      createdAt: now,
    });

    return {
      apiKey, // Full key - only returned once!
      keyInfo: {
        id: keyId,
        keyPrefix,
        keyName,
        permissions: ['inference'],
        rateLimitPerMinute: 60,
        rateLimitPerDay: 10000,
        isActive: true,
        createdAt: now,
      },
    };
  }

  /**
   * Validate an API key (used by gateway middleware)
   */
  async validateApiKey(apiKey: string): Promise<{
    valid: boolean;
    endpointId?: string;
    userId?: string;
    keyId?: string;
    permissions?: string[];
    rateLimits?: { perMinute: number; perDay: number };
  }> {
    // Check if key format is valid
    if (!apiKey.startsWith(API_KEY_PREFIX)) {
      return { valid: false };
    }

    // Get key prefix for lookup
    const keyPrefix = apiKey.substring(0, 12) + '...';

    // Find matching keys by prefix
    const keys = await db
      .select()
      .from(endpointApiKeys)
      .where(
        and(
          eq(endpointApiKeys.keyPrefix, keyPrefix),
          eq(endpointApiKeys.isActive, true)
        )
      );

    // Verify hash for each potential match
    for (const key of keys) {
      const isMatch = await bcrypt.compare(apiKey, key.keyHash);
      if (isMatch) {
        // Check expiration
        if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
          return { valid: false };
        }

        // Update last used timestamp
        await db
          .update(endpointApiKeys)
          .set({ lastUsedAt: new Date().toISOString() })
          .where(eq(endpointApiKeys.id, key.id));

        return {
          valid: true,
          endpointId: key.endpointId,
          userId: key.userId,
          keyId: key.id,
          permissions: key.permissions as string[] || ['inference'],
          rateLimits: {
            perMinute: key.rateLimitPerMinute || 60,
            perDay: key.rateLimitPerDay || 10000,
          },
        };
      }
    }

    return { valid: false };
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string): Promise<void> {
    await db
      .update(endpointApiKeys)
      .set({
        isActive: false,
        revokedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(endpointApiKeys.id, keyId),
          eq(endpointApiKeys.userId, this.userId)
        )
      );
  }

  /**
   * List user's endpoints (for "Connect" dropdown)
   */
  async listUserEndpoints(options?: {
    modality?: string;
    status?: string;
    sourceType?: string;
  }): Promise<EndpointInfo[]> {
    let query = db
      .select()
      .from(userEndpoints)
      .where(eq(userEndpoints.userId, this.userId))
      .orderBy(desc(userEndpoints.createdAt));

    const endpoints = await query;

    return endpoints
      .filter((ep) => {
        if (options?.modality && ep.modality !== options.modality) return false;
        if (options?.status && ep.status !== options.status) return false;
        if (options?.sourceType && ep.sourceType !== options.sourceType) return false;
        return true;
      })
      .map((ep) => ({
        id: ep.id,
        userId: ep.userId,
        modelName: ep.modelName,
        modelDescription: ep.modelDescription || undefined,
        modality: ep.modality,
        provider: ep.provider,
        status: ep.status,
        endpointUrl: ep.endpointUrl || '',
        gpuType: ep.gpuType || undefined,
        minWorkers: ep.minWorkers || 0,
        maxWorkers: ep.maxWorkers || 1,
        huggingFaceRepoUrl: ep.huggingFaceRepoUrl || undefined,
        sourceType: ep.sourceType as 'training' | 'open_source_studio' | 'imported',
        trainingJobId: ep.trainingJobId || undefined,
        lastActiveAt: ep.lastActiveAt || undefined,
        createdAt: ep.createdAt,
        updatedAt: ep.updatedAt,
      }));
  }

  /**
   * Get endpoint details
   */
  async getEndpoint(endpointId: string): Promise<EndpointInfo | null> {
    const endpoints = await db
      .select()
      .from(userEndpoints)
      .where(
        and(
          eq(userEndpoints.id, endpointId),
          eq(userEndpoints.userId, this.userId)
        )
      )
      .limit(1);

    const ep = endpoints[0];
    if (!ep) return null;

    return {
      id: ep.id,
      userId: ep.userId,
      modelName: ep.modelName,
      modelDescription: ep.modelDescription || undefined,
      modality: ep.modality,
      provider: ep.provider,
      status: ep.status,
      endpointUrl: ep.endpointUrl || '',
      gpuType: ep.gpuType || undefined,
      minWorkers: ep.minWorkers || 0,
      maxWorkers: ep.maxWorkers || 1,
      huggingFaceRepoUrl: ep.huggingFaceRepoUrl || undefined,
      sourceType: ep.sourceType as 'training' | 'open_source_studio' | 'imported',
      trainingJobId: ep.trainingJobId || undefined,
      lastActiveAt: ep.lastActiveAt || undefined,
      createdAt: ep.createdAt,
      updatedAt: ep.updatedAt,
    };
  }

  /**
   * Update endpoint status
   */
  async updateEndpointStatus(
    endpointId: string,
    status: EndpointStatus,
    errorMessage?: string
  ): Promise<void> {
    await db
      .update(userEndpoints)
      .set({
        status,
        errorMessage: errorMessage || null,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(userEndpoints.id, endpointId),
          eq(userEndpoints.userId, this.userId)
        )
      );
  }

  /**
   * Update endpoint URL after provisioning
   */
  async setEndpointUrl(
    endpointId: string,
    url: string,
    providerEndpointId: string
  ): Promise<void> {
    await db
      .update(userEndpoints)
      .set({
        endpointUrl: url,
        providerEndpointId,
        status: 'active',
        lastActiveAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(userEndpoints.id, endpointId),
          eq(userEndpoints.userId, this.userId)
        )
      );
  }

  /**
   * Get endpoint connection info (URL + code samples)
   */
  async getConnectionInfo(endpointId: string): Promise<ConnectionInfo | null> {
    const endpoint = await this.getEndpoint(endpointId);
    if (!endpoint) return null;

    // Get an active API key or create one
    const keys = await this.listApiKeys(endpointId);
    let apiKeyPlaceholder = 'YOUR_API_KEY';

    if (keys.length > 0) {
      apiKeyPlaceholder = keys[0].keyPrefix;
    }

    const baseUrl = endpoint.endpointUrl || 'https://api.kriptik.app/v1/inference/' + endpointId;

    // Generate code samples
    const code = this.generateCodeSamples(
      endpoint.id,
      baseUrl,
      apiKeyPlaceholder,
      endpoint.modality,
      endpoint.modelName
    );

    // OpenAI-compatible config for LLMs
    let openaiConfig: ConnectionInfo['openaiConfig'];
    if (endpoint.modality === 'llm') {
      openaiConfig = {
        baseUrl: `https://api.kriptik.app/v1/inference/${endpointId}`,
        apiKey: apiKeyPlaceholder,
        model: endpoint.modelName,
      };
    }

    return {
      endpointId: endpoint.id,
      endpointUrl: baseUrl,
      provider: endpoint.provider as EndpointProvider,
      modality: endpoint.modality,
      status: endpoint.status,
      code,
      openaiConfig,
      rateLimits: {
        requestsPerMinute: 60,
        requestsPerDay: 10000,
      },
    };
  }

  /**
   * List API keys for an endpoint
   */
  async listApiKeys(endpointId: string): Promise<ApiKeyInfo[]> {
    const keys = await db
      .select()
      .from(endpointApiKeys)
      .where(
        and(
          eq(endpointApiKeys.endpointId, endpointId),
          eq(endpointApiKeys.userId, this.userId),
          eq(endpointApiKeys.isActive, true)
        )
      )
      .orderBy(desc(endpointApiKeys.createdAt));

    return keys.map((k) => ({
      id: k.id,
      keyPrefix: k.keyPrefix,
      keyName: k.keyName,
      permissions: k.permissions as string[] || ['inference'],
      rateLimitPerMinute: k.rateLimitPerMinute || 60,
      rateLimitPerDay: k.rateLimitPerDay || 10000,
      isActive: k.isActive ?? true,
      lastUsedAt: k.lastUsedAt || undefined,
      createdAt: k.createdAt,
    }));
  }

  /**
   * Record usage
   */
  async recordUsage(usage: UsageRecord): Promise<void> {
    await db.insert(endpointUsage).values({
      id: crypto.randomUUID(),
      endpointId: usage.endpointId,
      apiKeyId: usage.apiKeyId || null,
      userId: usage.userId,
      requestId: usage.requestId || null,
      method: usage.method || null,
      inputTokens: usage.inputTokens || null,
      outputTokens: usage.outputTokens || null,
      latencyMs: usage.latencyMs || null,
      computeSeconds: usage.computeSeconds || null,
      costUsd: usage.costUsd || null,
      creditsCharged: usage.creditsCharged || null,
      success: usage.success,
      errorCode: usage.errorCode || null,
      createdAt: new Date().toISOString(),
    });

    // Update endpoint last active time
    await db
      .update(userEndpoints)
      .set({
        lastActiveAt: new Date().toISOString(),
        status: 'active',
      })
      .where(eq(userEndpoints.id, usage.endpointId));
  }

  /**
   * Get usage stats
   */
  async getUsageStats(
    endpointId: string,
    period: 'day' | 'week' | 'month'
  ): Promise<UsageStats> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const usageRecords = await db
      .select()
      .from(endpointUsage)
      .where(
        and(
          eq(endpointUsage.endpointId, endpointId),
          eq(endpointUsage.userId, this.userId),
          gte(endpointUsage.createdAt, startDate.toISOString())
        )
      )
      .orderBy(desc(endpointUsage.createdAt));

    const totalRequests = usageRecords.length;
    const successfulRequests = usageRecords.filter((r) => r.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const totalCreditsUsed = usageRecords.reduce((sum, r) => sum + (r.creditsCharged || 0), 0);
    const totalCostUsd = usageRecords.reduce((sum, r) => sum + (r.costUsd || 0), 0);
    const totalLatency = usageRecords.reduce((sum, r) => sum + (r.latencyMs || 0), 0);
    const avgLatencyMs = totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0;
    const totalComputeSeconds = usageRecords.reduce((sum, r) => sum + (r.computeSeconds || 0), 0);

    // Group by day for chart
    const byDay = new Map<string, { count: number; credits: number }>();
    usageRecords.forEach((r) => {
      const date = r.createdAt.substring(0, 10);
      const existing = byDay.get(date) || { count: 0, credits: 0 };
      existing.count++;
      existing.credits += r.creditsCharged || 0;
      byDay.set(date, existing);
    });

    const requestsByDay = Array.from(byDay.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      period,
      totalRequests,
      successfulRequests,
      failedRequests,
      totalCreditsUsed,
      totalCostUsd,
      avgLatencyMs,
      totalComputeSeconds,
      requestsByDay,
    };
  }

  /**
   * Terminate endpoint
   */
  async terminateEndpoint(endpointId: string): Promise<void> {
    await db
      .update(userEndpoints)
      .set({
        status: 'terminated',
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(userEndpoints.id, endpointId),
          eq(userEndpoints.userId, this.userId)
        )
      );

    // Revoke all API keys
    await db
      .update(endpointApiKeys)
      .set({
        isActive: false,
        revokedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(endpointApiKeys.endpointId, endpointId),
          eq(endpointApiKeys.userId, this.userId)
        )
      );
  }

  /**
   * Update endpoint settings
   */
  async updateEndpointSettings(
    endpointId: string,
    settings: {
      minWorkers?: number;
      maxWorkers?: number;
      idleTimeoutSeconds?: number;
    }
  ): Promise<void> {
    await db
      .update(userEndpoints)
      .set({
        ...(settings.minWorkers !== undefined && { minWorkers: settings.minWorkers }),
        ...(settings.maxWorkers !== undefined && { maxWorkers: settings.maxWorkers }),
        ...(settings.idleTimeoutSeconds !== undefined && { idleTimeoutSeconds: settings.idleTimeoutSeconds }),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(userEndpoints.id, endpointId),
          eq(userEndpoints.userId, this.userId)
        )
      );
  }

  /**
   * Get user endpoints summary
   */
  async getUserEndpointsSummary(): Promise<{
    active: number;
    idle: number;
    error: number;
    total: number;
    creditsUsedToday: number;
    requestsToday: number;
  }> {
    const endpoints = await this.listUserEndpoints();

    const active = endpoints.filter((ep) => ep.status === 'active').length;
    const idle = endpoints.filter((ep) => ep.status === 'idle').length;
    const error = endpoints.filter((ep) => ep.status === 'error').length;

    // Get today's usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayUsage = await db
      .select()
      .from(endpointUsage)
      .where(
        and(
          eq(endpointUsage.userId, this.userId),
          gte(endpointUsage.createdAt, today.toISOString())
        )
      );

    const creditsUsedToday = todayUsage.reduce((sum, r) => sum + (r.creditsCharged || 0), 0);
    const requestsToday = todayUsage.length;

    return {
      active,
      idle,
      error,
      total: endpoints.length,
      creditsUsedToday,
      requestsToday,
    };
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private generateCodeSamples(
    endpointId: string,
    baseUrl: string,
    apiKey: string,
    modality: string,
    modelName: string
  ): ConnectionInfo['code'] {
    const kriptikUrl = `https://api.kriptik.app/v1/inference/${endpointId}`;

    // Generate curl example
    const curl = modality === 'llm'
      ? `curl -X POST "${kriptikUrl}/chat/completions" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`
      : `curl -X POST "${kriptikUrl}" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"input": "your input here"}'`;

    // Generate Python example
    const python = modality === 'llm'
      ? `from openai import OpenAI

client = OpenAI(
    base_url="${kriptikUrl}",
    api_key="${apiKey}"
)

response = client.chat.completions.create(
    model="${modelName}",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`
      : `import requests

response = requests.post(
    "${kriptikUrl}",
    headers={"Authorization": "Bearer ${apiKey}"},
    json={"input": "your input here"}
)
print(response.json())`;

    // Generate TypeScript example
    const typescript = modality === 'llm'
      ? `import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: '${kriptikUrl}',
  apiKey: '${apiKey}',
});

const response = await client.chat.completions.create({
  model: '${modelName}',
  messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(response.choices[0].message.content);`
      : `const response = await fetch('${kriptikUrl}', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${apiKey}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ input: 'your input here' }),
});
const data = await response.json();
console.log(data);`;

    // OpenAI-compatible example for LLMs
    const openai_compatible = modality === 'llm'
      ? `# Use with any OpenAI SDK
client = OpenAI(
    base_url="${kriptikUrl}",
    api_key="${apiKey}"
)

# Same API as OpenAI
response = client.chat.completions.create(
    model="${modelName}",
    messages=[{"role": "user", "content": "Hello!"}]
)`
      : undefined;

    return {
      curl,
      python,
      typescript,
      openai_compatible,
    };
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createEndpointRegistry(userId: string): EndpointRegistry {
  return new EndpointRegistry({ userId });
}

export default EndpointRegistry;
