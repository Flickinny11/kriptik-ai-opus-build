# KripTik AI Auto-Deploy Private Endpoints Implementation Plan

## Overview

This document contains 12 structured NLP prompts for Cursor 2.2 with Claude Opus 4.5 to implement automatic deployment of trained/fine-tuned models to private serverless endpoints with a unified "Connect" system throughout KripTik.

**Architecture Decision: KripTik as Unified API Gateway**

After analyzing the current landscape (January 2026), the optimal approach is:
- KripTik provisions endpoints on RunPod/Modal using a **KripTik master account**
- Endpoints use **serverless scale-to-zero** (free when idle)
- KripTik generates unique API keys per user per endpoint
- Users connect via KripTik's unified API (proxied to underlying provider)
- All endpoints are **private by default** - only the owning user can access

**Why This Approach:**
1. **Zero cost when idle** - Serverless endpoints scale to zero
2. **Unified billing** - Users pay KripTik in credits, KripTik pays providers
3. **Complete control** - Usage tracking, rate limiting, abuse prevention
4. **Consistent UX** - Same "Connect" experience everywhere in KripTik
5. **Multi-provider** - Can switch between RunPod/Modal transparently

**Provider Comparison (January 2026):**

| Feature | RunPod Serverless | Modal | HuggingFace IE | Replicate |
|---------|-------------------|-------|----------------|-----------|
| Scale-to-zero | Yes (Flex Workers) | Yes | Yes (Serverless) | Yes |
| Cold start | 200ms-12s | Sub-second | 5-30s | 3-15s |
| GPU options | T4→H100 | T4→H100 | T4→A100 | T4→A100 |
| API style | OpenAI-compatible | Custom | OpenAI/TGI | Replicate API |
| Best for | LLMs, all modalities | Python apps | HF models | Pre-built models |

**Selected Primary Providers:** RunPod Serverless + Modal (already integrated)

---

## Critical Requirements

- NO placeholders, NO TODOs, NO mock implementations
- ONLY real production code that actually deploys endpoints
- Automatic deployment after training completes
- Private endpoints with user-specific API keys
- "Connect" dropdown component usable throughout KripTik
- Endpoint configs stored in database with user ownership
- Model files saved to HuggingFace AND deployed to inference endpoint

---

## PROMPT 1: Endpoint Registry & Private Key Management

```
/ultrathink
/context server/src/services/deployment/unified-deployer.ts
/context server/src/services/deployment/deployment-recommender.ts
/context server/src/schema.ts

You are implementing a comprehensive Endpoint Registry and Private API Key Management system for KripTik AI. This is the foundation for private user endpoints.

## Context
- Location: server/src/services/deployment/endpoint-registry.ts
- Every trained/fine-tuned model gets a private endpoint
- Users should NEVER see each other's endpoints
- API keys are per-user, per-endpoint, rotatable
- Endpoints are tracked with full metadata for the "Connect" dropdown

## Database Schema Additions

Add to server/src/schema.ts:

```typescript
export const userEndpoints = pgTable('user_endpoints', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),

  // Source reference
  trainingJobId: text('training_job_id').references(() => trainingJobs.id),
  sourceType: text('source_type').notNull(), // 'training' | 'open_source_studio' | 'imported'

  // Model info
  modelName: text('model_name').notNull(),
  modelDescription: text('model_description'),
  modality: text('modality').notNull(), // 'llm' | 'image' | 'video' | 'audio'
  baseModelId: text('base_model_id'),
  huggingFaceRepoUrl: text('huggingface_repo_url'),

  // Endpoint info
  provider: text('provider').notNull(), // 'runpod' | 'modal'
  providerEndpointId: text('provider_endpoint_id'),
  endpointUrl: text('endpoint_url'),
  endpointType: text('endpoint_type').notNull(), // 'serverless' | 'dedicated'

  // GPU config
  gpuType: text('gpu_type'),
  minWorkers: integer('min_workers').default(0),
  maxWorkers: integer('max_workers').default(1),
  idleTimeoutSeconds: integer('idle_timeout_seconds').default(30),

  // Status
  status: text('status').notNull().default('provisioning'), // 'provisioning' | 'active' | 'scaling' | 'idle' | 'error' | 'terminated'
  lastActiveAt: timestamp('last_active_at'),
  errorMessage: text('error_message'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const endpointApiKeys = pgTable('endpoint_api_keys', {
  id: text('id').primaryKey(),
  endpointId: text('endpoint_id').notNull().references(() => userEndpoints.id),
  userId: text('user_id').notNull().references(() => users.id),

  // Key info
  keyName: text('key_name').notNull().default('default'),
  keyPrefix: text('key_prefix').notNull(), // First 8 chars for display: "kptk_abc..."
  keyHash: text('key_hash').notNull(), // bcrypt hash of full key

  // Permissions
  permissions: jsonb('permissions').default('["inference"]'), // ['inference', 'manage', 'delete']

  // Rate limiting
  rateLimitPerMinute: integer('rate_limit_per_minute').default(60),
  rateLimitPerDay: integer('rate_limit_per_day').default(10000),

  // Status
  isActive: boolean('is_active').default(true),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  revokedAt: timestamp('revoked_at'),
});

export const endpointUsage = pgTable('endpoint_usage', {
  id: text('id').primaryKey(),
  endpointId: text('endpoint_id').notNull().references(() => userEndpoints.id),
  apiKeyId: text('api_key_id').references(() => endpointApiKeys.id),
  userId: text('user_id').notNull(),

  // Request info
  requestId: text('request_id'),
  method: text('method'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  latencyMs: integer('latency_ms'),

  // Cost tracking
  computeSeconds: real('compute_seconds'),
  costUsd: real('cost_usd'),
  creditsCharged: integer('credits_charged'),

  // Status
  success: boolean('success'),
  errorCode: text('error_code'),

  // Timestamp
  createdAt: timestamp('created_at').defaultNow(),
});
```

## EndpointRegistry Class

Implement server/src/services/deployment/endpoint-registry.ts:

```typescript
interface EndpointRegistryConfig {
  userId: string;
}

interface RegisterEndpointInput {
  trainingJobId?: string;
  sourceType: 'training' | 'open_source_studio' | 'imported';
  modelName: string;
  modelDescription?: string;
  modality: 'llm' | 'image' | 'video' | 'audio';
  baseModelId?: string;
  huggingFaceRepoUrl?: string;
  provider: 'runpod' | 'modal';
  gpuType: string;
  endpointType: 'serverless' | 'dedicated';
  minWorkers?: number;
  maxWorkers?: number;
}

interface EndpointInfo {
  id: string;
  modelName: string;
  modality: string;
  provider: string;
  status: string;
  endpointUrl: string;
  apiKey?: string; // Only returned on creation
  createdAt: string;
}

interface ApiKeyInfo {
  id: string;
  keyPrefix: string;
  keyName: string;
  permissions: string[];
  rateLimitPerMinute: number;
  isActive: boolean;
  lastUsedAt?: string;
  createdAt: string;
}

export class EndpointRegistry {
  constructor(private config: EndpointRegistryConfig) {}

  // Register a new endpoint (creates DB record, returns endpoint ID)
  async registerEndpoint(input: RegisterEndpointInput): Promise<{ endpointId: string }>;

  // Generate a new API key for an endpoint
  async generateApiKey(endpointId: string, keyName?: string): Promise<{ apiKey: string; keyInfo: ApiKeyInfo }>;

  // Validate an API key (used by gateway middleware)
  async validateApiKey(apiKey: string): Promise<{ valid: boolean; endpointId?: string; userId?: string; permissions?: string[] }>;

  // Revoke an API key
  async revokeApiKey(keyId: string): Promise<void>;

  // List user's endpoints (for "Connect" dropdown)
  async listUserEndpoints(options?: { modality?: string; status?: string }): Promise<EndpointInfo[]>;

  // Get endpoint details
  async getEndpoint(endpointId: string): Promise<EndpointInfo | null>;

  // Update endpoint status
  async updateEndpointStatus(endpointId: string, status: string, errorMessage?: string): Promise<void>;

  // Update endpoint URL after provisioning
  async setEndpointUrl(endpointId: string, url: string, providerEndpointId: string): Promise<void>;

  // Get endpoint connection info (URL + code samples)
  async getConnectionInfo(endpointId: string): Promise<ConnectionInfo>;

  // Record usage
  async recordUsage(usage: UsageRecord): Promise<void>;

  // Get usage stats
  async getUsageStats(endpointId: string, period: 'day' | 'week' | 'month'): Promise<UsageStats>;

  // Terminate endpoint
  async terminateEndpoint(endpointId: string): Promise<void>;
}
```

## API Key Generation

API keys should be in format: `kptk_live_[32-char-random]`
- Prefix identifies as KripTik key
- `live` vs `test` for environment
- 32-char cryptographically random suffix
- Store only bcrypt hash in database
- Return full key ONCE on creation

## Connection Info Response

```typescript
interface ConnectionInfo {
  endpointId: string;
  endpointUrl: string;
  provider: 'runpod' | 'modal';
  modality: string;
  status: string;

  // Code samples
  code: {
    curl: string;
    python: string;
    typescript: string;
    openai_compatible?: string; // For LLMs
  };

  // OpenAI SDK compatibility (for LLMs)
  openaiConfig?: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };

  // Rate limits
  rateLimits: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
}
```

## Security Requirements

1. API keys are hashed with bcrypt (cost factor 12)
2. Full key only returned once at creation
3. Key prefix stored for display/identification
4. All endpoint queries filtered by userId (row-level security)
5. Rate limiting enforced per API key
6. Usage logged for billing and abuse detection

Implement the complete EndpointRegistry class with all methods. NO placeholders.
```

---

## PROMPT 2: Auto-Deploy After Training Completion

```
/ultrathink
/context server/src/services/training/completion-handler.ts
/context server/src/services/training/multi-modal-orchestrator.ts
/context server/src/services/deployment/unified-deployer.ts

You are implementing automatic deployment of trained models to private serverless endpoints. When training completes, the model should be automatically deployed and ready for the user.

## Context
- Location: server/src/services/deployment/auto-deployer.ts
- Modify: server/src/services/training/completion-handler.ts
- This hooks into the training completion flow
- After HuggingFace upload completes, auto-deploy triggers
- Uses DeploymentRecommender to pick best provider/GPU
- Creates endpoint via EndpointRegistry

## Auto-Deploy Flow

1. Training completes
2. Model uploads to HuggingFace (existing flow)
3. Auto-deployer triggers:
   a. Analyze model (size, modality, requirements)
   b. Get deployment recommendation (RunPod vs Modal, GPU type)
   c. Register endpoint in EndpointRegistry
   d. Deploy to provider (serverless, scale-to-zero)
   e. Generate API key
   f. Update endpoint with URL
   g. Notify user (WebSocket + email)

## AutoDeployer Class

```typescript
interface AutoDeployConfig {
  trainingJobId: string;
  userId: string;
  modelUrl: string; // HuggingFace URL
  modality: ModelModality;
  baseModelId: string;
  modelName: string;
}

interface AutoDeployResult {
  success: boolean;
  endpointId?: string;
  endpointUrl?: string;
  apiKey?: string; // Full key, returned only once
  provider?: 'runpod' | 'modal';
  gpuType?: string;
  estimatedColdStartMs?: number;
  error?: string;
}

export class AutoDeployer {
  private endpointRegistry: EndpointRegistry;
  private deploymentRecommender: DeploymentRecommender;
  private runpodDeployer: RunPodDeployer;
  private modalDeployer: ModalDeployer;
  private credentialVault: CredentialVault;

  /**
   * Automatically deploy a trained model to a serverless endpoint
   */
  async autoDeploy(config: AutoDeployConfig): Promise<AutoDeployResult>;

  /**
   * Analyze model to determine deployment requirements
   */
  private async analyzeModel(modelUrl: string, modality: ModelModality): Promise<ModelAnalysis>;

  /**
   * Select optimal provider and configuration
   */
  private selectDeploymentConfig(
    analysis: ModelAnalysis,
    modality: ModelModality
  ): DeploymentRecommendation;

  /**
   * Deploy to RunPod serverless
   */
  private async deployToRunPod(
    endpointId: string,
    modelUrl: string,
    modality: ModelModality,
    gpuType: string
  ): Promise<{ endpointUrl: string; providerEndpointId: string }>;

  /**
   * Deploy to Modal serverless
   */
  private async deployToModal(
    endpointId: string,
    modelUrl: string,
    modality: ModelModality,
    gpuType: string
  ): Promise<{ endpointUrl: string; providerEndpointId: string }>;

  /**
   * Monitor deployment until ready
   */
  private async waitForDeployment(
    provider: 'runpod' | 'modal',
    providerEndpointId: string,
    timeoutMs: number
  ): Promise<boolean>;
}
```

## Deployment Configuration by Modality

```typescript
const DEPLOYMENT_DEFAULTS: Record<ModelModality, DeploymentDefaults> = {
  llm: {
    preferredProvider: 'runpod',
    containerImage: 'runpod/worker-vllm:stable-cuda12.1.0',
    minWorkers: 0, // Scale to zero
    maxWorkers: 3,
    idleTimeoutSeconds: 60,
    gpuOptions: ['T4', 'L4', 'A10G', 'A100-40GB'],
  },
  image: {
    preferredProvider: 'runpod',
    containerImage: 'runpod/worker-comfyui:stable',
    minWorkers: 0,
    maxWorkers: 2,
    idleTimeoutSeconds: 30,
    gpuOptions: ['T4', 'RTX4090', 'A10G'],
  },
  video: {
    preferredProvider: 'modal',
    containerImage: null, // Modal uses Python code
    minWorkers: 0,
    maxWorkers: 1,
    idleTimeoutSeconds: 120,
    gpuOptions: ['A100-40GB', 'A100-80GB', 'H100'],
  },
  audio: {
    preferredProvider: 'runpod',
    containerImage: 'runpod/worker-whisper:latest',
    minWorkers: 0,
    maxWorkers: 2,
    idleTimeoutSeconds: 30,
    gpuOptions: ['T4', 'L4'],
  },
};
```

## Integration with Completion Handler

Modify server/src/services/training/completion-handler.ts to call AutoDeployer:

```typescript
// In handleTrainingCompletion() after HuggingFace upload:

// Auto-deploy to serverless endpoint
const autoDeployer = new AutoDeployer();
const deployResult = await autoDeployer.autoDeploy({
  trainingJobId: job.id,
  userId: job.userId,
  modelUrl: huggingFaceUrl,
  modality: job.modality,
  baseModelId: job.baseModelId,
  modelName: job.outputModelName,
});

if (deployResult.success) {
  // Store endpoint info
  await this.updateJobWithEndpoint(job.id, {
    endpointId: deployResult.endpointId,
    endpointUrl: deployResult.endpointUrl,
    provider: deployResult.provider,
  });

  // Notify user
  await this.notifyUser(job.userId, {
    type: 'training_complete_with_endpoint',
    trainingJobId: job.id,
    modelName: job.outputModelName,
    endpointUrl: deployResult.endpointUrl,
    apiKey: deployResult.apiKey,
  });
}
```

## WebSocket Notification

When deployment completes, send WebSocket message:

```typescript
{
  type: 'ENDPOINT_READY',
  payload: {
    endpointId: string,
    endpointUrl: string,
    modelName: string,
    modality: string,
    provider: string,
    apiKey: string, // Full key - only sent once via WebSocket
    connectionCode: {
      python: string,
      typescript: string,
      curl: string,
    }
  }
}
```

Implement the complete AutoDeployer class. Ensure it integrates properly with the existing training completion flow. NO placeholders.
```

---

## PROMPT 3: KripTik API Gateway for Inference

```
/ultrathink
/context server/src/services/deployment/endpoint-registry.ts
/context server/src/routes/api/index.ts

You are implementing KripTik's unified API Gateway that proxies inference requests to RunPod/Modal endpoints. This provides consistent API surface, usage tracking, and security.

## Context
- Location: server/src/services/gateway/inference-gateway.ts
- Routes: server/src/routes/api/inference.ts
- All inference requests go through KripTik's API
- Validates API keys, enforces rate limits, tracks usage
- Proxies to underlying RunPod/Modal endpoint
- Handles both REST and streaming responses

## API Gateway Architecture

```
User Request (with kptk_live_xxx key)
           ↓
   KripTik API Gateway
           ↓
   ┌───────────────────┐
   │ 1. Validate key   │
   │ 2. Check rate     │
   │ 3. Get endpoint   │
   │ 4. Proxy request  │
   │ 5. Track usage    │
   │ 6. Return resp    │
   └───────────────────┘
           ↓
   RunPod / Modal Endpoint
```

## Inference Gateway Service

```typescript
interface InferenceRequest {
  endpointId: string;
  apiKey: string;
  body: unknown;
  stream?: boolean;
}

interface InferenceResponse {
  success: boolean;
  data?: unknown;
  stream?: ReadableStream;
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

export class InferenceGateway {
  private endpointRegistry: EndpointRegistry;
  private rateLimiter: RateLimiter;
  private usageTracker: UsageTracker;

  /**
   * Process an inference request
   */
  async processRequest(req: InferenceRequest): Promise<InferenceResponse>;

  /**
   * Process a streaming inference request
   */
  async processStreamingRequest(req: InferenceRequest): Promise<AsyncGenerator<unknown>>;

  /**
   * Validate API key and get endpoint info
   */
  private async validateAndGetEndpoint(apiKey: string): Promise<{
    valid: boolean;
    endpoint?: EndpointInfo;
    userId?: string;
    error?: string;
  }>;

  /**
   * Check rate limits
   */
  private async checkRateLimits(keyId: string, limits: RateLimits): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
  }>;

  /**
   * Proxy request to provider endpoint
   */
  private async proxyToProvider(
    endpoint: EndpointInfo,
    body: unknown,
    stream: boolean
  ): Promise<InferenceResponse>;

  /**
   * Track usage for billing
   */
  private async trackUsage(
    endpointId: string,
    keyId: string,
    userId: string,
    usage: UsageRecord
  ): Promise<void>;
}
```

## API Routes

Create server/src/routes/api/inference.ts:

```typescript
// POST /api/v1/inference/:endpointId
// Headers: Authorization: Bearer kptk_live_xxx

router.post('/:endpointId', async (req, res) => {
  const { endpointId } = req.params;
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  const stream = req.headers.accept === 'text/event-stream';

  const gateway = getInferenceGateway();

  if (stream) {
    // Streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of gateway.processStreamingRequest({
      endpointId,
      apiKey,
      body: req.body,
      stream: true,
    })) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } else {
    // Regular response
    const response = await gateway.processRequest({
      endpointId,
      apiKey,
      body: req.body,
    });

    if (response.success) {
      res.json(response.data);
    } else {
      res.status(getStatusCode(response.error.code)).json(response.error);
    }
  }
});

// OpenAI-compatible endpoint for LLMs
// POST /api/v1/inference/:endpointId/chat/completions
router.post('/:endpointId/chat/completions', async (req, res) => {
  // Handles OpenAI SDK compatible requests
  // Transforms to/from provider format as needed
});

// GET /api/v1/inference/:endpointId/status
router.get('/:endpointId/status', async (req, res) => {
  // Returns endpoint status, current workers, queue depth
});
```

## OpenAI SDK Compatibility

For LLM endpoints, provide OpenAI SDK compatible interface:

```typescript
// User code:
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://api.kriptik.ai/v1/inference/ep_xxx',
  apiKey: 'kptk_live_xxx',
});

const response = await client.chat.completions.create({
  model: 'my-fine-tuned-model',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## Rate Limiting

Use Redis for distributed rate limiting:

```typescript
class RateLimiter {
  private redis: Redis;

  async checkLimit(keyId: string, limits: RateLimits): Promise<RateLimitResult> {
    const minuteKey = `ratelimit:${keyId}:minute:${getCurrentMinute()}`;
    const dayKey = `ratelimit:${keyId}:day:${getCurrentDay()}`;

    const [minuteCount, dayCount] = await this.redis.mget(minuteKey, dayKey);

    if (Number(minuteCount) >= limits.perMinute) {
      return { allowed: false, error: 'RATE_LIMIT_MINUTE' };
    }
    if (Number(dayCount) >= limits.perDay) {
      return { allowed: false, error: 'RATE_LIMIT_DAY' };
    }

    // Increment counters
    await this.redis.incr(minuteKey);
    await this.redis.expire(minuteKey, 60);
    await this.redis.incr(dayKey);
    await this.redis.expire(dayKey, 86400);

    return { allowed: true };
  }
}
```

## Error Codes

```typescript
const ERROR_CODES = {
  INVALID_API_KEY: { status: 401, message: 'Invalid API key' },
  EXPIRED_API_KEY: { status: 401, message: 'API key has expired' },
  RATE_LIMIT_MINUTE: { status: 429, message: 'Rate limit exceeded (per minute)' },
  RATE_LIMIT_DAY: { status: 429, message: 'Rate limit exceeded (per day)' },
  ENDPOINT_NOT_FOUND: { status: 404, message: 'Endpoint not found' },
  ENDPOINT_SCALING: { status: 503, message: 'Endpoint is scaling up, retry in a few seconds' },
  ENDPOINT_ERROR: { status: 502, message: 'Endpoint returned an error' },
  INSUFFICIENT_CREDITS: { status: 402, message: 'Insufficient credits' },
};
```

Implement the complete InferenceGateway and API routes. Handle both REST and streaming. NO placeholders.
```

---

## PROMPT 4: Connect Dropdown Component

```
/ultrathink
/context client/src/components

You are implementing the "Connect" dropdown component that appears throughout KripTik. This allows users to select and connect to their deployed models/endpoints from any part of the app.

## Context
- Location: client/src/components/common/ConnectDropdown.tsx
- Appears in: Builder View, Feature Agent, Open Source Studio, AI Lab, etc.
- Shows user's deployed endpoints grouped by modality
- Provides connection info, code samples, and status

## Component Requirements

### ConnectDropdown Props

```typescript
interface ConnectDropdownProps {
  // Filter options
  modality?: 'llm' | 'image' | 'video' | 'audio' | 'all';
  sourceType?: 'training' | 'open_source_studio' | 'imported' | 'all';

  // Callback when user selects an endpoint
  onConnect: (endpoint: EndpointConnection) => void;

  // Optional: currently connected endpoint
  connectedEndpointId?: string;

  // Display options
  size?: 'sm' | 'md' | 'lg';
  variant?: 'button' | 'menu' | 'inline';
  placeholder?: string;

  // Optional: show quick actions
  showQuickActions?: boolean; // Copy API key, view code, etc.
}

interface EndpointConnection {
  endpointId: string;
  endpointUrl: string;
  modelName: string;
  modality: string;
  provider: 'runpod' | 'modal';
  apiKey: string;
  status: string;

  // OpenAI SDK config (for LLMs)
  openaiConfig?: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };

  // Code samples
  codeSamples: {
    python: string;
    typescript: string;
    curl: string;
  };
}
```

### Component Structure

```tsx
export function ConnectDropdown({
  modality = 'all',
  onConnect,
  connectedEndpointId,
  size = 'md',
  variant = 'button',
  showQuickActions = true,
}: ConnectDropdownProps) {
  const { data: endpoints, isLoading } = useUserEndpoints({ modality });
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointConnection | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant={variant === 'button' ? 'outline' : 'ghost'} size={size}>
          <PlugIcon className="mr-2 h-4 w-4" />
          {connectedEndpointId ? (
            <span className="truncate max-w-[150px]">
              {getEndpointName(endpoints, connectedEndpointId)}
            </span>
          ) : (
            'Connect Model'
          )}
          <ChevronDownIcon className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-80">
        {/* Search */}
        <div className="px-2 py-2">
          <Input
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>

        <DropdownMenuSeparator />

        {/* Grouped by modality */}
        {Object.entries(groupedEndpoints).map(([mod, eps]) => (
          <DropdownMenuGroup key={mod}>
            <DropdownMenuLabel className="flex items-center gap-2">
              <ModalityIcon modality={mod} className="h-4 w-4" />
              {getModalityLabel(mod)}
            </DropdownMenuLabel>

            {eps.map((ep) => (
              <DropdownMenuItem
                key={ep.id}
                onSelect={() => handleSelect(ep)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <StatusDot status={ep.status} />
                  <span className="truncate max-w-[180px]">{ep.modelName}</span>
                </div>

                <div className="flex items-center gap-1">
                  <ProviderBadge provider={ep.provider} />
                  {showQuickActions && (
                    <QuickActions endpoint={ep} />
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}

        {endpoints?.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            <p>No deployed models yet</p>
            <p className="mt-1">Train a model to get started</p>
          </div>
        )}

        <DropdownMenuSeparator />

        {/* Actions */}
        <DropdownMenuItem onSelect={() => navigate('/ai-lab/training')}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Train New Model
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => navigate('/ai-lab/endpoints')}>
          <ExternalLinkIcon className="mr-2 h-4 w-4" />
          Manage Endpoints
        </DropdownMenuItem>
      </DropdownMenuContent>

      {/* Code Modal */}
      <CodeSamplesModal
        open={showCodeModal}
        onOpenChange={setShowCodeModal}
        endpoint={selectedEndpoint}
      />
    </DropdownMenu>
  );
}
```

### Quick Actions Menu

```tsx
function QuickActions({ endpoint }: { endpoint: EndpointInfo }) {
  const { toast } = useToast();
  const { mutate: regenerateKey } = useRegenerateApiKey();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <DotsHorizontalIcon className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => copyToClipboard(endpoint.endpointUrl)}>
          <CopyIcon className="mr-2 h-4 w-4" />
          Copy URL
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => copyApiKey(endpoint.id)}>
          <KeyIcon className="mr-2 h-4 w-4" />
          Copy API Key
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setShowCodeModal(true)}>
          <CodeIcon className="mr-2 h-4 w-4" />
          View Code Samples
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate(`/ai-lab/endpoints/${endpoint.id}`)}>
          <SettingsIcon className="mr-2 h-4 w-4" />
          Manage
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Code Samples Modal

```tsx
function CodeSamplesModal({ open, onOpenChange, endpoint }: CodeSamplesModalProps) {
  const [activeTab, setActiveTab] = useState<'python' | 'typescript' | 'curl'>('python');

  if (!endpoint) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Connect to {endpoint.modelName}</DialogTitle>
          <DialogDescription>
            Use these code samples to connect your application
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="python">Python</TabsTrigger>
            <TabsTrigger value="typescript">TypeScript</TabsTrigger>
            <TabsTrigger value="curl">cURL</TabsTrigger>
          </TabsList>

          <TabsContent value="python">
            <CodeBlock
              language="python"
              code={endpoint.codeSamples.python}
              copyable
            />
          </TabsContent>

          {/* Similar for typescript and curl */}
        </Tabs>

        {endpoint.modality === 'llm' && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">OpenAI SDK Compatible</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Use the OpenAI SDK with your custom model:
            </p>
            <CodeBlock
              language="python"
              code={generateOpenAICode(endpoint.openaiConfig)}
              copyable
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### React Query Hooks

```typescript
// hooks/useUserEndpoints.ts
export function useUserEndpoints(options?: { modality?: string }) {
  return useQuery({
    queryKey: ['user-endpoints', options?.modality],
    queryFn: async () => {
      const response = await fetch('/api/v1/endpoints', {
        headers: { 'Authorization': `Bearer ${getSessionToken()}` },
      });
      return response.json();
    },
  });
}

// hooks/useEndpointConnection.ts
export function useEndpointConnection(endpointId: string) {
  return useQuery({
    queryKey: ['endpoint-connection', endpointId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/endpoints/${endpointId}/connection`, {
        headers: { 'Authorization': `Bearer ${getSessionToken()}` },
      });
      return response.json();
    },
    enabled: !!endpointId,
  });
}

// hooks/useRegenerateApiKey.ts
export function useRegenerateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (endpointId: string) => {
      const response = await fetch(`/api/v1/endpoints/${endpointId}/keys`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getSessionToken()}` },
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Show the new key (only shown once)
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['user-endpoints'] });
    },
  });
}
```

### Integration Examples

```tsx
// In Builder View
<ConnectDropdown
  modality="llm"
  onConnect={(ep) => {
    setConnectedModel(ep);
    // Use ep.openaiConfig with your AI SDK
  }}
/>

// In Open Source Studio
<ConnectDropdown
  modality="all"
  sourceType="open_source_studio"
  onConnect={(ep) => {
    // Connect to the deployed model
  }}
/>

// In AI Lab
<ConnectDropdown
  showQuickActions={true}
  onConnect={(ep) => {
    // Use for testing
  }}
/>
```

Implement the complete ConnectDropdown component with all sub-components. Include proper loading states, error handling, and animations. Use shadcn/ui components. NO placeholders.
```

---

## PROMPT 5: Endpoint Management Dashboard

```
/ultrathink
/context client/src/pages

You are implementing the Endpoint Management Dashboard where users can view, manage, and monitor all their deployed endpoints.

## Context
- Location: client/src/pages/ai-lab/endpoints/index.tsx
- Individual: client/src/pages/ai-lab/endpoints/[endpointId].tsx
- Shows all endpoints with status, usage, costs
- Allows scaling configuration, key management, termination

## Dashboard Page

```tsx
// /ai-lab/endpoints
export default function EndpointsDashboard() {
  const { data: endpoints, isLoading } = useUserEndpoints();
  const [filter, setFilter] = useState({ modality: 'all', status: 'all' });

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Model Endpoints</h1>
          <p className="text-muted-foreground mt-1">
            Manage your deployed models and inference endpoints
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/ai-lab/training')}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Train New Model
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Active Endpoints"
          value={stats.active}
          icon={<CircleIcon className="h-4 w-4 text-green-500" />}
        />
        <StatsCard
          title="Requests Today"
          value={stats.requestsToday.toLocaleString()}
          icon={<ActivityIcon className="h-4 w-4" />}
        />
        <StatsCard
          title="Credits Used"
          value={stats.creditsUsed.toLocaleString()}
          icon={<CoinsIcon className="h-4 w-4" />}
        />
        <StatsCard
          title="Avg Latency"
          value={`${stats.avgLatencyMs}ms`}
          icon={<ClockIcon className="h-4 w-4" />}
        />
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <Select value={filter.modality} onValueChange={(v) => setFilter({ ...filter, modality: v })}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Modality" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="llm">LLM</SelectItem>
            <SelectItem value="image">Image</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filter.status} onValueChange={(v) => setFilter({ ...filter, status: v })}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="idle">Idle</SelectItem>
            <SelectItem value="scaling">Scaling</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Endpoints Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requests (24h)</TableHead>
              <TableHead>Latency</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEndpoints.map((endpoint) => (
              <TableRow key={endpoint.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ModalityIcon modality={endpoint.modality} className="h-4 w-4" />
                    <div>
                      <div className="font-medium">{endpoint.modelName}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {endpoint.endpointUrl}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{endpoint.modality}</Badge>
                </TableCell>
                <TableCell>
                  <ProviderBadge provider={endpoint.provider} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={endpoint.status} />
                </TableCell>
                <TableCell>{endpoint.requestsToday.toLocaleString()}</TableCell>
                <TableCell>{endpoint.avgLatencyMs}ms</TableCell>
                <TableCell>{formatDate(endpoint.createdAt)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <DotsHorizontalIcon className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => copyEndpointUrl(endpoint)}>
                        <CopyIcon className="mr-2 h-4 w-4" />
                        Copy URL
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => showCodeSamples(endpoint)}>
                        <CodeIcon className="mr-2 h-4 w-4" />
                        View Code
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => navigate(`/ai-lab/endpoints/${endpoint.id}`)}>
                        <SettingsIcon className="mr-2 h-4 w-4" />
                        Manage
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onSelect={() => confirmTerminate(endpoint)}
                      >
                        <TrashIcon className="mr-2 h-4 w-4" />
                        Terminate
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
```

## Individual Endpoint Page

```tsx
// /ai-lab/endpoints/[endpointId]
export default function EndpointDetailPage() {
  const { endpointId } = useParams();
  const { data: endpoint } = useEndpoint(endpointId);
  const { data: usage } = useEndpointUsage(endpointId);
  const { data: apiKeys } = useEndpointApiKeys(endpointId);

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <Breadcrumb>
            <BreadcrumbItem href="/ai-lab/endpoints">Endpoints</BreadcrumbItem>
            <BreadcrumbItem>{endpoint?.modelName}</BreadcrumbItem>
          </Breadcrumb>
          <h1 className="text-3xl font-bold mt-2">{endpoint?.modelName}</h1>
          <div className="flex items-center gap-2 mt-2">
            <StatusBadge status={endpoint?.status} />
            <ProviderBadge provider={endpoint?.provider} />
            <Badge variant="outline">{endpoint?.modality}</Badge>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={showCodeSamples}>
            <CodeIcon className="mr-2 h-4 w-4" />
            Code Samples
          </Button>
          <Button variant="destructive" onClick={confirmTerminate}>
            <TrashIcon className="mr-2 h-4 w-4" />
            Terminate
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Usage & Analytics</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-2 gap-6">
            {/* Connection Info */}
            <Card>
              <CardHeader>
                <CardTitle>Connection Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Endpoint URL</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={endpoint?.endpointUrl} readOnly />
                    <Button variant="outline" size="icon" onClick={copyUrl}>
                      <CopyIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {endpoint?.modality === 'llm' && (
                  <div>
                    <Label>OpenAI SDK Base URL</Label>
                    <div className="flex gap-2 mt-1">
                      <Input value={endpoint?.openaiConfig?.baseUrl} readOnly />
                      <Button variant="outline" size="icon" onClick={copyBaseUrl}>
                        <CopyIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <div>
                  <Label>GPU Configuration</Label>
                  <p className="text-sm mt-1">
                    {endpoint?.gpuType} • Min: {endpoint?.minWorkers} • Max: {endpoint?.maxWorkers}
                  </p>
                </div>

                <div>
                  <Label>HuggingFace Model</Label>
                  <a
                    href={endpoint?.huggingFaceRepoUrl}
                    target="_blank"
                    className="text-sm text-primary hover:underline"
                  >
                    {endpoint?.huggingFaceRepoUrl}
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Requests Today</p>
                    <p className="text-2xl font-bold">{usage?.today.requests.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Latency</p>
                    <p className="text-2xl font-bold">{usage?.today.avgLatencyMs}ms</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Credits Used</p>
                    <p className="text-2xl font-bold">{usage?.today.credits.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Error Rate</p>
                    <p className="text-2xl font-bold">{usage?.today.errorRate.toFixed(2)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage">
          <UsageAnalytics endpointId={endpointId} />
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys">
          <ApiKeysManager endpointId={endpointId} />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <EndpointSettings endpoint={endpoint} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

## API Keys Manager Component

```tsx
function ApiKeysManager({ endpointId }: { endpointId: string }) {
  const { data: keys } = useEndpointApiKeys(endpointId);
  const { mutate: createKey, isPending } = useCreateApiKey();
  const { mutate: revokeKey } = useRevokeApiKey();
  const [newKeyName, setNewKeyName] = useState('');
  const [showNewKey, setShowNewKey] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>API Keys</CardTitle>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm">
                <PlusIcon className="mr-2 h-4 w-4" />
                Create Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create API Key</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Key Name</Label>
                  <Input
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g., Production, Development"
                  />
                </div>
                <Button
                  onClick={() => {
                    createKey({ endpointId, name: newKeyName }, {
                      onSuccess: (data) => {
                        setShowNewKey(data.apiKey);
                        setNewKeyName('');
                      },
                    });
                  }}
                  disabled={isPending}
                >
                  Create Key
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {showNewKey && (
          <Alert className="mb-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <AlertTriangleIcon className="h-4 w-4 text-yellow-600" />
            <AlertTitle>Save Your API Key</AlertTitle>
            <AlertDescription>
              <p className="mb-2">This key will only be shown once. Copy it now:</p>
              <div className="flex gap-2">
                <Input value={showNewKey} readOnly className="font-mono" />
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(showNewKey);
                    toast.success('Copied!');
                  }}
                >
                  <CopyIcon className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setShowNewKey(null)}
              >
                I've saved my key
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys?.map((key) => (
              <TableRow key={key.id}>
                <TableCell>{key.keyName}</TableCell>
                <TableCell className="font-mono">{key.keyPrefix}...</TableCell>
                <TableCell>{formatDate(key.createdAt)}</TableCell>
                <TableCell>{key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never'}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => revokeKey(key.id)}
                  >
                    Revoke
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

Implement all dashboard pages and components. Include loading states, error handling, and animations. Use shadcn/ui. NO placeholders.
```

---

## PROMPT 6: Provider Selection & Cost Optimization

```
/ultrathink
/context server/src/services/deployment/deployment-recommender.ts

You are enhancing the DeploymentRecommender to make intelligent, cost-optimized decisions between RunPod and Modal based on current pricing, availability, and workload characteristics.

## Context
- Location: server/src/services/deployment/smart-provider-selector.ts
- Integrates with: deployment-recommender.ts
- Must consider: pricing (January 2026), cold start times, GPU availability
- Goal: Always pick the most cost-effective option for serverless scale-to-zero

## Updated Pricing (January 2026)

```typescript
// server/src/services/deployment/provider-pricing.ts

interface GPUPricing {
  gpuType: string;
  vram: number;
  runpod: {
    serverlessPerSecond: number; // Flex worker pricing
    podPerHour: number;
    available: boolean;
  };
  modal: {
    perSecond: number;
    available: boolean;
  };
}

export const GPU_PRICING_2026: GPUPricing[] = [
  {
    gpuType: 'T4',
    vram: 16,
    runpod: { serverlessPerSecond: 0.000055, podPerHour: 0.20, available: true },
    modal: { perSecond: 0.000164, available: true },
  },
  {
    gpuType: 'L4',
    vram: 24,
    runpod: { serverlessPerSecond: 0.000097, podPerHour: 0.35, available: true },
    modal: { perSecond: 0.000222, available: true },
  },
  {
    gpuType: 'A10G',
    vram: 24,
    runpod: { serverlessPerSecond: 0.000139, podPerHour: 0.50, available: true },
    modal: { perSecond: 0.000306, available: true },
  },
  {
    gpuType: 'RTX3090',
    vram: 24,
    runpod: { serverlessPerSecond: 0.000122, podPerHour: 0.44, available: true },
    modal: { perSecond: 0, available: false }, // Not on Modal
  },
  {
    gpuType: 'RTX4090',
    vram: 24,
    runpod: { serverlessPerSecond: 0.000192, podPerHour: 0.69, available: true },
    modal: { perSecond: 0, available: false }, // Not on Modal
  },
  {
    gpuType: 'A100-40GB',
    vram: 40,
    runpod: { serverlessPerSecond: 0.000389, podPerHour: 1.40, available: true },
    modal: { perSecond: 0.000772, available: true },
  },
  {
    gpuType: 'A100-80GB',
    vram: 80,
    runpod: { serverlessPerSecond: 0.000611, podPerHour: 2.20, available: true },
    modal: { perSecond: 0.001172, available: true },
  },
  {
    gpuType: 'H100',
    vram: 80,
    runpod: { serverlessPerSecond: 0.001247, podPerHour: 4.49, available: true },
    modal: { perSecond: 0.001527, available: true },
  },
];

// Cold start characteristics
export const COLD_START_ESTIMATES = {
  runpod: {
    // FlashBoot enables sub-200ms for 48% of starts
    p50: 200, // ms
    p95: 6000,
    p99: 12000,
    withFlashBoot: 100, // If model is frequently used
  },
  modal: {
    p50: 500,
    p95: 2000,
    p99: 5000,
    withWarmPool: 100, // If using warm pools
  },
};
```

## SmartProviderSelector Class

```typescript
interface ProviderSelectionInput {
  modality: ModelModality;
  modelSizeGB: number;
  expectedRequestsPerDay: number;
  latencyRequirement: 'critical' | 'low' | 'medium' | 'high';
  budgetConstraint?: 'minimum_cost' | 'balanced' | 'performance';
}

interface ProviderSelectionResult {
  provider: 'runpod' | 'modal';
  gpuType: string;
  reason: string;

  costEstimates: {
    perRequest: number;
    perHourActive: number;
    monthlyEstimate: number; // Based on expected usage
  };

  performance: {
    coldStartP50Ms: number;
    coldStartP95Ms: number;
    expectedLatencyMs: number;
  };

  configuration: {
    minWorkers: number;
    maxWorkers: number;
    idleTimeoutSeconds: number;
    containerImage: string;
    gpuMemory: number;
  };

  alternatives: Array<{
    provider: 'runpod' | 'modal';
    gpuType: string;
    costDifference: string;
    tradeoff: string;
  }>;
}

export class SmartProviderSelector {
  /**
   * Select optimal provider and configuration
   */
  async selectProvider(input: ProviderSelectionInput): Promise<ProviderSelectionResult>;

  /**
   * Determine minimum GPU VRAM needed
   */
  private calculateVRAMRequirement(
    modality: ModelModality,
    modelSizeGB: number
  ): number;

  /**
   * Filter GPUs that meet VRAM requirement
   */
  private filterSuitableGPUs(vramRequired: number): GPUPricing[];

  /**
   * Score each provider/GPU combo
   */
  private scoreOption(
    gpu: GPUPricing,
    provider: 'runpod' | 'modal',
    input: ProviderSelectionInput
  ): number;

  /**
   * Calculate monthly cost estimate
   */
  private estimateMonthlyCost(
    gpuPricing: GPUPricing,
    provider: 'runpod' | 'modal',
    requestsPerDay: number,
    avgRequestDurationSeconds: number
  ): number;

  /**
   * Check current availability (live API call)
   */
  private async checkAvailability(
    provider: 'runpod' | 'modal',
    gpuType: string
  ): Promise<{ available: boolean; queueDepth?: number }>;
}
```

## Selection Algorithm

```typescript
async selectProvider(input: ProviderSelectionInput): Promise<ProviderSelectionResult> {
  const vramRequired = this.calculateVRAMRequirement(input.modality, input.modelSizeGB);
  const suitableGPUs = this.filterSuitableGPUs(vramRequired);

  if (suitableGPUs.length === 0) {
    throw new Error(`No suitable GPU found for ${vramRequired}GB VRAM requirement`);
  }

  // Score all options
  const scoredOptions: Array<{
    gpu: GPUPricing;
    provider: 'runpod' | 'modal';
    score: number;
    costs: CostEstimate;
  }> = [];

  for (const gpu of suitableGPUs) {
    // Score RunPod if available
    if (gpu.runpod.available) {
      const score = this.scoreOption(gpu, 'runpod', input);
      const costs = this.estimateCosts(gpu, 'runpod', input);
      scoredOptions.push({ gpu, provider: 'runpod', score, costs });
    }

    // Score Modal if available
    if (gpu.modal.available) {
      const score = this.scoreOption(gpu, 'modal', input);
      const costs = this.estimateCosts(gpu, 'modal', input);
      scoredOptions.push({ gpu, provider: 'modal', score, costs });
    }
  }

  // Sort by score (higher is better)
  scoredOptions.sort((a, b) => b.score - a.score);

  const best = scoredOptions[0];
  const alternatives = scoredOptions.slice(1, 4).map(opt => ({
    provider: opt.provider,
    gpuType: opt.gpu.gpuType,
    costDifference: this.formatCostDifference(best.costs, opt.costs),
    tradeoff: this.describeTradeoff(best, opt),
  }));

  return {
    provider: best.provider,
    gpuType: best.gpu.gpuType,
    reason: this.generateReason(best, input),
    costEstimates: best.costs,
    performance: this.getPerformanceEstimates(best.gpu, best.provider, input),
    configuration: this.getConfiguration(best.gpu, best.provider, input),
    alternatives,
  };
}

private scoreOption(
  gpu: GPUPricing,
  provider: 'runpod' | 'modal',
  input: ProviderSelectionInput
): number {
  let score = 100;

  // Cost factor (most important for serverless scale-to-zero)
  const costPerSecond = provider === 'runpod'
    ? gpu.runpod.serverlessPerSecond
    : gpu.modal.perSecond;

  // Normalize cost (lower is better, max 40 points)
  const costScore = 40 * (1 - (costPerSecond / 0.002)); // 0.002 is max expected
  score += Math.max(0, costScore);

  // Cold start factor (up to 30 points)
  const coldStart = COLD_START_ESTIMATES[provider].p50;
  if (input.latencyRequirement === 'critical') {
    // Heavily penalize slow cold starts
    score -= coldStart / 50;
  } else if (input.latencyRequirement === 'low') {
    score -= coldStart / 100;
  }

  // Modal has better cold starts, give slight bonus
  if (provider === 'modal') {
    score += 5;
  }

  // RunPod has RTX GPUs (consumer, cheaper)
  if (provider === 'runpod' && gpu.gpuType.startsWith('RTX')) {
    score += 10; // Good value option
  }

  // Budget constraint adjustment
  if (input.budgetConstraint === 'minimum_cost') {
    score += costScore * 0.5; // Double weight on cost
  } else if (input.budgetConstraint === 'performance') {
    // Prefer higher VRAM and faster GPUs
    score += gpu.vram / 10;
    if (gpu.gpuType === 'H100') score += 15;
    if (gpu.gpuType.includes('A100')) score += 10;
  }

  return score;
}
```

Implement the complete SmartProviderSelector with accurate 2026 pricing and intelligent selection logic. NO placeholders.
```

---

## PROMPT 7: Endpoint Status Monitoring & Auto-Recovery

```
/ultrathink
/context server/src/services/deployment

You are implementing real-time endpoint status monitoring with automatic recovery for failed endpoints.

## Context
- Location: server/src/services/deployment/endpoint-monitor.ts
- Monitors all user endpoints across RunPod and Modal
- Detects failures, scaling issues, and cold start problems
- Automatic recovery: retry deployment, scale up, notify user

## EndpointMonitor Class

```typescript
interface MonitoringConfig {
  checkIntervalMs: number;
  unhealthyThreshold: number;
  autoRecoveryEnabled: boolean;
}

interface EndpointHealth {
  endpointId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  consecutiveFailures: number;
  metrics: {
    latencyP50Ms: number;
    latencyP99Ms: number;
    successRate: number;
    activeWorkers: number;
    queuedRequests: number;
  };
  issues: string[];
}

export class EndpointMonitor {
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * Start monitoring all endpoints
   */
  start(): void;

  /**
   * Stop monitoring
   */
  stop(): void;

  /**
   * Check health of a specific endpoint
   */
  async checkEndpointHealth(endpointId: string): Promise<EndpointHealth>;

  /**
   * Check health of all user endpoints
   */
  async checkAllEndpoints(userId: string): Promise<EndpointHealth[]>;

  /**
   * Attempt automatic recovery
   */
  private async attemptRecovery(endpointId: string, issue: string): Promise<boolean>;

  /**
   * Send health alert to user
   */
  private async sendHealthAlert(
    userId: string,
    endpointId: string,
    health: EndpointHealth
  ): Promise<void>;

  /**
   * Get provider-specific health check
   */
  private async checkRunPodHealth(providerEndpointId: string): Promise<ProviderHealth>;
  private async checkModalHealth(providerEndpointId: string): Promise<ProviderHealth>;
}
```

## Health Check Logic

```typescript
async checkEndpointHealth(endpointId: string): Promise<EndpointHealth> {
  const endpoint = await this.endpointRegistry.getEndpoint(endpointId);
  if (!endpoint) {
    return { status: 'unknown', issues: ['Endpoint not found'] };
  }

  const issues: string[] = [];
  let status: EndpointHealth['status'] = 'healthy';

  // Check provider health
  const providerHealth = endpoint.provider === 'runpod'
    ? await this.checkRunPodHealth(endpoint.providerEndpointId)
    : await this.checkModalHealth(endpoint.providerEndpointId);

  if (!providerHealth.reachable) {
    issues.push('Endpoint not reachable');
    status = 'unhealthy';
  }

  // Check recent error rate
  const recentUsage = await this.endpointRegistry.getRecentUsage(endpointId, 15); // last 15 min
  if (recentUsage.errorRate > 0.1) {
    issues.push(`High error rate: ${(recentUsage.errorRate * 100).toFixed(1)}%`);
    status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
  }

  // Check latency
  if (recentUsage.latencyP99Ms > 30000) {
    issues.push(`High latency: ${recentUsage.latencyP99Ms}ms p99`);
    status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
  }

  // Check if stuck in scaling
  if (endpoint.status === 'scaling' && endpoint.lastActiveAt) {
    const scalingTime = Date.now() - new Date(endpoint.lastActiveAt).getTime();
    if (scalingTime > 5 * 60 * 1000) { // 5 minutes
      issues.push('Endpoint stuck in scaling state');
      status = 'unhealthy';
    }
  }

  // Check queue depth (for RunPod)
  if (providerHealth.queuedRequests > 100) {
    issues.push(`High queue depth: ${providerHealth.queuedRequests} requests`);
    status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
  }

  return {
    endpointId,
    status,
    lastCheck: new Date(),
    consecutiveFailures: status === 'healthy' ? 0 : (this.failureCount.get(endpointId) || 0) + 1,
    metrics: {
      latencyP50Ms: recentUsage.latencyP50Ms,
      latencyP99Ms: recentUsage.latencyP99Ms,
      successRate: 1 - recentUsage.errorRate,
      activeWorkers: providerHealth.activeWorkers,
      queuedRequests: providerHealth.queuedRequests,
    },
    issues,
  };
}
```

## Auto-Recovery

```typescript
private async attemptRecovery(endpointId: string, issue: string): Promise<boolean> {
  const endpoint = await this.endpointRegistry.getEndpoint(endpointId);
  if (!endpoint) return false;

  console.log(`[EndpointMonitor] Attempting recovery for ${endpointId}: ${issue}`);

  try {
    if (issue.includes('not reachable') || issue.includes('stuck in scaling')) {
      // Redeploy the endpoint
      const autoDeployer = new AutoDeployer();
      await autoDeployer.redeployEndpoint(endpointId);
      return true;
    }

    if (issue.includes('High queue depth')) {
      // Scale up workers
      if (endpoint.provider === 'runpod') {
        await this.runpodDeployer.scaleWorkers(endpoint.providerEndpointId, {
          maxWorkers: Math.min(endpoint.maxWorkers + 2, 10),
        });
      }
      return true;
    }

    if (issue.includes('High error rate')) {
      // Check if it's a model loading issue
      const recentErrors = await this.getRecentErrors(endpointId);
      if (recentErrors.some(e => e.includes('CUDA out of memory'))) {
        // Need larger GPU - notify user
        await this.notifyUserOfGPUUpgrade(endpoint.userId, endpointId);
      }
      return false;
    }

    return false;
  } catch (error) {
    console.error(`[EndpointMonitor] Recovery failed for ${endpointId}:`, error);
    return false;
  }
}
```

Implement the complete EndpointMonitor with real health checks and auto-recovery. Include WebSocket notifications for health status changes. NO placeholders.
```

---

## PROMPT 8: Billing Integration for Endpoints

```
/ultrathink
/context server/src/services/billing

You are implementing billing integration for endpoint usage. Users pay in KripTik credits, and usage is tracked per-request.

## Context
- Location: server/src/services/billing/endpoint-billing.ts
- Integrates with: endpoint-usage table, user credits
- Cost model: per-second of GPU compute + per-token for LLMs
- Users pre-purchase credits, deducted on usage

## Billing Configuration

```typescript
// Cost per credit (1 credit = $0.01)
const CREDIT_VALUE_USD = 0.01;

// Markup over provider cost (KripTik margin)
const MARKUP_PERCENTAGE = 0.20; // 20% margin

interface EndpointBillingConfig {
  endpointId: string;
  provider: 'runpod' | 'modal';
  gpuType: string;
  modality: ModelModality;
}

interface UsageCost {
  computeSeconds: number;
  computeCostUsd: number;
  tokensCost?: {
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
  totalCostUsd: number;
  creditsCharged: number;
}
```

## EndpointBilling Service

```typescript
export class EndpointBilling {
  /**
   * Calculate cost for a single request
   */
  calculateRequestCost(
    config: EndpointBillingConfig,
    usage: {
      computeSeconds: number;
      inputTokens?: number;
      outputTokens?: number;
    }
  ): UsageCost;

  /**
   * Check if user has sufficient credits
   */
  async checkCredits(userId: string, estimatedCredits: number): Promise<{
    sufficient: boolean;
    currentBalance: number;
    required: number;
  }>;

  /**
   * Deduct credits for usage
   */
  async chargeForUsage(
    userId: string,
    endpointId: string,
    usage: UsageCost
  ): Promise<{ success: boolean; newBalance: number }>;

  /**
   * Get usage summary for billing period
   */
  async getUsageSummary(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UsageSummary>;

  /**
   * Estimate cost for expected usage
   */
  estimateMonthlyCost(
    config: EndpointBillingConfig,
    expectedRequestsPerDay: number,
    avgRequestDurationSeconds: number
  ): MonthlyEstimate;
}
```

## Cost Calculation

```typescript
calculateRequestCost(
  config: EndpointBillingConfig,
  usage: { computeSeconds: number; inputTokens?: number; outputTokens?: number }
): UsageCost {
  const gpuPricing = GPU_PRICING_2026.find(g => g.gpuType === config.gpuType);
  if (!gpuPricing) {
    throw new Error(`Unknown GPU type: ${config.gpuType}`);
  }

  // Base compute cost
  const costPerSecond = config.provider === 'runpod'
    ? gpuPricing.runpod.serverlessPerSecond
    : gpuPricing.modal.perSecond;

  const computeCostUsd = usage.computeSeconds * costPerSecond;

  // Token cost for LLMs (optional additional charge)
  let tokensCost: UsageCost['tokensCost'] = undefined;
  if (config.modality === 'llm' && usage.inputTokens && usage.outputTokens) {
    // $0.001 per 1K input tokens, $0.002 per 1K output tokens
    const inputCost = (usage.inputTokens / 1000) * 0.001;
    const outputCost = (usage.outputTokens / 1000) * 0.002;
    tokensCost = {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: inputCost + outputCost,
    };
  }

  // Total with markup
  const baseCostUsd = computeCostUsd + (tokensCost?.costUsd || 0);
  const totalCostUsd = baseCostUsd * (1 + MARKUP_PERCENTAGE);

  // Convert to credits
  const creditsCharged = Math.ceil(totalCostUsd / CREDIT_VALUE_USD);

  return {
    computeSeconds: usage.computeSeconds,
    computeCostUsd,
    tokensCost,
    totalCostUsd,
    creditsCharged,
  };
}
```

## Integration with Gateway

```typescript
// In InferenceGateway.processRequest()

// Before proxying request
const billingCheck = await endpointBilling.checkCredits(userId, estimatedCredits);
if (!billingCheck.sufficient) {
  return {
    success: false,
    error: {
      code: 'INSUFFICIENT_CREDITS',
      message: `Insufficient credits. Current balance: ${billingCheck.currentBalance}, required: ~${billingCheck.required}`,
    },
  };
}

// After successful request
const cost = endpointBilling.calculateRequestCost(endpointConfig, {
  computeSeconds: response.usage.computeSeconds,
  inputTokens: response.usage.inputTokens,
  outputTokens: response.usage.outputTokens,
});

await endpointBilling.chargeForUsage(userId, endpointId, cost);
await endpointRegistry.recordUsage({
  endpointId,
  apiKeyId,
  userId,
  ...cost,
});
```

Implement the complete EndpointBilling service with accurate cost calculations. NO placeholders.
```

---

## PROMPT 9: Open Source Studio Auto-Deploy Integration

```
/ultrathink
/context server/src/services/open-source-studio

You are integrating auto-deploy with Open Source Studio. When users deploy an open source model from the studio, it should automatically create a private endpoint.

## Context
- Location: server/src/services/open-source-studio/deploy-integration.ts
- Modify: existing Open Source Studio deployment flow
- Users browse HuggingFace models → select → deploy → get private endpoint

## Integration Flow

1. User selects model in Open Source Studio
2. User clicks "Deploy to Endpoint"
3. System:
   a. Analyzes model requirements
   b. Recommends provider/GPU
   c. Creates endpoint record
   d. Deploys to provider
   e. Generates API key
   f. Returns connection info

## OpenSourceStudioDeployer

```typescript
interface DeployFromStudioInput {
  userId: string;
  modelId: string; // HuggingFace model ID
  modelName?: string; // Custom name
  customConfig?: {
    provider?: 'runpod' | 'modal';
    gpuType?: string;
  };
}

interface DeployFromStudioResult {
  endpointId: string;
  endpointUrl: string;
  apiKey: string;
  provider: 'runpod' | 'modal';
  gpuType: string;
  status: string;
  connectionCode: ConnectionCode;
}

export class OpenSourceStudioDeployer {
  private modelDiscovery: ModelDiscoveryService;
  private smartSelector: SmartProviderSelector;
  private endpointRegistry: EndpointRegistry;
  private autoDeployer: AutoDeployer;

  /**
   * Deploy a HuggingFace model to a private endpoint
   */
  async deployModel(input: DeployFromStudioInput): Promise<DeployFromStudioResult>;

  /**
   * Get deployment preview (cost estimate, GPU recommendation)
   */
  async getDeploymentPreview(modelId: string): Promise<DeploymentPreview>;

  /**
   * Check if model is deployable
   */
  async checkDeployability(modelId: string): Promise<DeployabilityCheck>;
}
```

## Frontend Integration

```tsx
// In Open Source Studio model card or detail page

function DeployToEndpointButton({ modelId }: { modelId: string }) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [preview, setPreview] = useState<DeploymentPreview | null>(null);
  const [result, setResult] = useState<DeployResult | null>(null);

  const { mutate: deploy } = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/open-source-studio/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId }),
      });
      return res.json();
    },
  });

  return (
    <>
      <Button onClick={showPreview}>
        <RocketIcon className="mr-2 h-4 w-4" />
        Deploy to Endpoint
      </Button>

      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deploy {modelId}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Deployment recommendation */}
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium">Recommended Configuration</h4>
              <div className="mt-2 space-y-1 text-sm">
                <p>Provider: {preview.recommendation.provider}</p>
                <p>GPU: {preview.recommendation.gpuType}</p>
                <p>Est. Cost: {preview.recommendation.estimatedCostPerRequest} credits/request</p>
              </div>
            </div>

            {/* Cost estimate */}
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium">Monthly Estimate</h4>
              <p className="text-sm text-muted-foreground">Based on 1,000 requests/day</p>
              <p className="text-2xl font-bold mt-1">
                {preview.monthlyEstimate.credits.toLocaleString()} credits
              </p>
              <p className="text-sm text-muted-foreground">
                (~${preview.monthlyEstimate.usd.toFixed(2)})
              </p>
            </div>

            <Button
              className="w-full"
              onClick={() => deploy()}
              disabled={isDeploying}
            >
              {isDeploying ? 'Deploying...' : 'Deploy Now'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      {result && (
        <DeploymentSuccessModal
          result={result}
          onClose={() => setResult(null)}
        />
      )}
    </>
  );
}
```

Implement the complete Open Source Studio deploy integration. NO placeholders.
```

---

## PROMPT 10: API Routes for Endpoint Management

```
/ultrathink
/context server/src/routes/api

You are implementing all API routes for endpoint management.

## Context
- Location: server/src/routes/api/endpoints.ts
- Handles: CRUD for endpoints, API keys, usage stats, deployment

## API Routes

```typescript
// server/src/routes/api/endpoints.ts

const router = express.Router();

// =============================================================================
// ENDPOINTS CRUD
// =============================================================================

// GET /api/v1/endpoints - List user's endpoints
router.get('/', auth, async (req, res) => {
  const { modality, status, sourceType } = req.query;
  const endpoints = await endpointRegistry.listUserEndpoints(req.user.id, {
    modality, status, sourceType,
  });
  res.json({ endpoints });
});

// GET /api/v1/endpoints/:id - Get endpoint details
router.get('/:id', auth, async (req, res) => {
  const endpoint = await endpointRegistry.getEndpoint(req.params.id);
  if (!endpoint || endpoint.userId !== req.user.id) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.json({ endpoint });
});

// GET /api/v1/endpoints/:id/connection - Get connection info with code samples
router.get('/:id/connection', auth, async (req, res) => {
  const connection = await endpointRegistry.getConnectionInfo(req.params.id);
  res.json({ connection });
});

// PATCH /api/v1/endpoints/:id - Update endpoint settings
router.patch('/:id', auth, async (req, res) => {
  const { minWorkers, maxWorkers, idleTimeoutSeconds } = req.body;
  await endpointRegistry.updateEndpointSettings(req.params.id, {
    minWorkers, maxWorkers, idleTimeoutSeconds,
  });
  res.json({ success: true });
});

// DELETE /api/v1/endpoints/:id - Terminate endpoint
router.delete('/:id', auth, async (req, res) => {
  await endpointRegistry.terminateEndpoint(req.params.id);
  res.json({ success: true });
});

// =============================================================================
// API KEYS
// =============================================================================

// GET /api/v1/endpoints/:id/keys - List API keys
router.get('/:id/keys', auth, async (req, res) => {
  const keys = await endpointRegistry.listApiKeys(req.params.id);
  res.json({ keys });
});

// POST /api/v1/endpoints/:id/keys - Create new API key
router.post('/:id/keys', auth, async (req, res) => {
  const { keyName } = req.body;
  const { apiKey, keyInfo } = await endpointRegistry.generateApiKey(
    req.params.id,
    keyName
  );
  res.json({ apiKey, keyInfo }); // apiKey only shown once
});

// DELETE /api/v1/endpoints/:id/keys/:keyId - Revoke API key
router.delete('/:id/keys/:keyId', auth, async (req, res) => {
  await endpointRegistry.revokeApiKey(req.params.keyId);
  res.json({ success: true });
});

// =============================================================================
// USAGE & ANALYTICS
// =============================================================================

// GET /api/v1/endpoints/:id/usage - Get usage stats
router.get('/:id/usage', auth, async (req, res) => {
  const { period = 'day' } = req.query;
  const usage = await endpointRegistry.getUsageStats(req.params.id, period);
  res.json({ usage });
});

// GET /api/v1/endpoints/:id/usage/detailed - Get detailed usage logs
router.get('/:id/usage/detailed', auth, async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const logs = await endpointRegistry.getUsageLogs(req.params.id, { page, limit });
  res.json({ logs });
});

// =============================================================================
// DEPLOYMENT
// =============================================================================

// POST /api/v1/endpoints/deploy - Deploy new endpoint (from Open Source Studio)
router.post('/deploy', auth, async (req, res) => {
  const { modelId, modelName, provider, gpuType } = req.body;
  const deployer = new OpenSourceStudioDeployer();
  const result = await deployer.deployModel({
    userId: req.user.id,
    modelId,
    modelName,
    customConfig: { provider, gpuType },
  });
  res.json({ result });
});

// GET /api/v1/endpoints/deploy/preview - Get deployment preview
router.get('/deploy/preview', auth, async (req, res) => {
  const { modelId } = req.query;
  const deployer = new OpenSourceStudioDeployer();
  const preview = await deployer.getDeploymentPreview(modelId);
  res.json({ preview });
});

// POST /api/v1/endpoints/:id/redeploy - Redeploy failed endpoint
router.post('/:id/redeploy', auth, async (req, res) => {
  const autoDeployer = new AutoDeployer();
  const result = await autoDeployer.redeployEndpoint(req.params.id);
  res.json({ result });
});

// =============================================================================
// STATUS & HEALTH
// =============================================================================

// GET /api/v1/endpoints/:id/health - Get health status
router.get('/:id/health', auth, async (req, res) => {
  const monitor = getEndpointMonitor();
  const health = await monitor.checkEndpointHealth(req.params.id);
  res.json({ health });
});

// GET /api/v1/endpoints/summary - Get summary stats for all endpoints
router.get('/summary', auth, async (req, res) => {
  const summary = await endpointRegistry.getUserEndpointsSummary(req.user.id);
  res.json({ summary });
});

export default router;
```

Implement all API routes with proper validation, error handling, and authorization. NO placeholders.
```

---

## PROMPT 11: WebSocket Real-time Updates

```
/ultrathink
/context server/src/services/websocket

You are implementing WebSocket real-time updates for endpoint status, deployment progress, and usage alerts.

## Context
- Location: server/src/services/websocket/endpoint-events.ts
- Sends: deployment progress, status changes, health alerts, usage updates
- Integrates with: AutoDeployer, EndpointMonitor, InferenceGateway

## Event Types

```typescript
type EndpointEvent =
  | { type: 'DEPLOYMENT_STARTED'; endpointId: string; modelName: string }
  | { type: 'DEPLOYMENT_PROGRESS'; endpointId: string; stage: string; progress: number }
  | { type: 'DEPLOYMENT_COMPLETE'; endpointId: string; endpointUrl: string; apiKey: string }
  | { type: 'DEPLOYMENT_FAILED'; endpointId: string; error: string }
  | { type: 'ENDPOINT_STATUS_CHANGED'; endpointId: string; status: string; previousStatus: string }
  | { type: 'ENDPOINT_HEALTH_ALERT'; endpointId: string; health: EndpointHealth }
  | { type: 'ENDPOINT_USAGE_UPDATE'; endpointId: string; usage: UsageSummary }
  | { type: 'CREDITS_LOW_WARNING'; currentBalance: number; threshold: number };
```

## EndpointEventEmitter

```typescript
export class EndpointEventEmitter {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  /**
   * Emit event to specific user
   */
  emitToUser(userId: string, event: EndpointEvent): void {
    this.io.to(`user:${userId}`).emit('endpoint:event', event);
  }

  /**
   * Emit deployment progress
   */
  emitDeploymentProgress(userId: string, endpointId: string, stage: string, progress: number): void {
    this.emitToUser(userId, {
      type: 'DEPLOYMENT_PROGRESS',
      endpointId,
      stage,
      progress,
    });
  }

  /**
   * Emit deployment complete with connection info
   */
  emitDeploymentComplete(
    userId: string,
    endpointId: string,
    endpointUrl: string,
    apiKey: string
  ): void {
    this.emitToUser(userId, {
      type: 'DEPLOYMENT_COMPLETE',
      endpointId,
      endpointUrl,
      apiKey,
    });
  }

  // ... other emit methods
}
```

## Client-Side Hook

```typescript
// hooks/useEndpointEvents.ts
export function useEndpointEvents(onEvent: (event: EndpointEvent) => void) {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on('endpoint:event', onEvent);

    return () => {
      socket.off('endpoint:event', onEvent);
    };
  }, [socket, onEvent]);
}

// Usage in component
function DeploymentProgress({ endpointId }: { endpointId: string }) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');

  useEndpointEvents((event) => {
    if (event.endpointId !== endpointId) return;

    if (event.type === 'DEPLOYMENT_PROGRESS') {
      setProgress(event.progress);
      setStage(event.stage);
    }

    if (event.type === 'DEPLOYMENT_COMPLETE') {
      // Show success with connection info
      toast.success('Deployment complete!');
      showConnectionModal(event);
    }
  });

  return (
    <div>
      <Progress value={progress} />
      <p>{stage}</p>
    </div>
  );
}
```

Implement the complete WebSocket event system. NO placeholders.
```

---

## PROMPT 12: Complete Integration Testing

```
/ultrathink

You are writing comprehensive integration tests for the auto-deploy private endpoints feature.

## Context
- Location: server/src/tests/endpoints/
- Tests: full flow from training completion → auto-deploy → inference
- Mocks: RunPod and Modal APIs
- Validates: all edge cases, error handling, security

## Test Suites

```typescript
// server/src/tests/endpoints/auto-deploy.test.ts

describe('Auto-Deploy After Training', () => {
  describe('Successful Deployment', () => {
    it('should auto-deploy LLM after training completes', async () => {
      // Create training job
      // Complete training
      // Verify endpoint created
      // Verify API key generated
      // Verify connection info correct
    });

    it('should select RunPod for LLM when cheaper', async () => {
      // ...
    });

    it('should select Modal for video models', async () => {
      // ...
    });
  });

  describe('Error Handling', () => {
    it('should handle RunPod deployment failure gracefully', async () => {
      // Mock RunPod API failure
      // Verify retry logic
      // Verify user notification
    });

    it('should fallback to Modal if RunPod unavailable', async () => {
      // ...
    });
  });
});

describe('Endpoint Registry', () => {
  describe('API Key Management', () => {
    it('should generate secure API keys', async () => {
      // Verify key format
      // Verify hash is stored, not plaintext
    });

    it('should validate keys correctly', async () => {
      // ...
    });

    it('should revoke keys properly', async () => {
      // ...
    });
  });

  describe('User Isolation', () => {
    it('should not allow access to other user endpoints', async () => {
      // Create endpoints for user A
      // Try to access as user B
      // Verify 404
    });
  });
});

describe('Inference Gateway', () => {
  describe('Request Processing', () => {
    it('should proxy requests to RunPod', async () => {
      // ...
    });

    it('should handle streaming responses', async () => {
      // ...
    });

    it('should track usage correctly', async () => {
      // ...
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce per-minute limits', async () => {
      // ...
    });

    it('should enforce per-day limits', async () => {
      // ...
    });
  });

  describe('Billing', () => {
    it('should charge credits correctly', async () => {
      // ...
    });

    it('should reject requests with insufficient credits', async () => {
      // ...
    });
  });
});
```

Write comprehensive integration tests covering all components. NO placeholders.
```

---

## Summary

This implementation plan covers 12 comprehensive prompts that will enable:

1. **Private Endpoint Registry** - Database schema and API key management
2. **Auto-Deploy After Training** - Automatic deployment when training completes
3. **KripTik API Gateway** - Unified proxy with usage tracking
4. **Connect Dropdown Component** - Universal UI for selecting deployed models
5. **Endpoint Management Dashboard** - Full management UI
6. **Smart Provider Selection** - Cost-optimized RunPod vs Modal decisions
7. **Endpoint Monitoring** - Health checks and auto-recovery
8. **Billing Integration** - Credit-based usage charging
9. **Open Source Studio Integration** - Deploy models directly from browser
10. **API Routes** - Complete REST API
11. **WebSocket Events** - Real-time deployment and status updates
12. **Integration Testing** - Comprehensive test coverage

**Architecture Summary:**
- Serverless scale-to-zero (free when idle)
- KripTik as unified API gateway
- Private endpoints per user
- Automatic deployment after training
- "Connect" dropdown throughout the app
- Credit-based billing with usage tracking

**Sources:**
- [RunPod Serverless](https://www.runpod.io/product/serverless)
- [RunPod Pricing](https://docs.runpod.io/serverless/pricing)
- [Modal Pricing](https://modal.com/pricing)
- [Modal High-Performance AI](https://modal.com/)
- [Together AI Fine-Tuning](https://www.together.ai/fine-tuning)
- [Together AI Dedicated Endpoints](https://www.together.ai/dedicated-endpoints)
- [HuggingFace Inference Endpoints](https://huggingface.co/inference-endpoints/dedicated)
- [Replicate Pricing](https://replicate.com/pricing)
- [MonsterAPI Deploy](https://developer.monsterapi.ai/docs/monster-deploy)
- [AWS Multi-Tenant AI Gateway](https://aws.amazon.com/solutions/guidance/multi-tenant-generative-ai-gateway-with-cost-and-usage-tracking-on-aws/)
- [Azure Multi-Tenant AI Architecture](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/approaches/ai-ml)
