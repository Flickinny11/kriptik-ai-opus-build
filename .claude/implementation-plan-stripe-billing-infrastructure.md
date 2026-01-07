# Stripe Payment Infrastructure - Complete Implementation Plan

> **Purpose**: Implement metered billing for GPU usage, training costs, and Open Source Studio features while maintaining profitability.
> **Date**: January 7, 2026
> **Status**: Ready for Implementation
> **Auth Protection**: All auth files LOCKED per AUTH-IMMUTABLE-SPECIFICATION.md - DO NOT MODIFY

---

## EXECUTIVE ANALYSIS

### What Already Exists (Complete)

KripTik has a **mature, multi-layered billing system** with the following production-ready components:

| Component | File | Status | Function |
|-----------|------|--------|----------|
| **Credit System** | `credits.ts` | Complete | Token-to-credit conversion, tier allocations, balance tracking |
| **Stripe Billing** | `stripe.ts` | Complete | Subscriptions, plans, top-ups, checkout sessions |
| **Usage Tracking** | `usage-service.ts` | Complete | Persistent database tracking with daily aggregation |
| **GPU Cost Tracker** | `gpu-cost-tracker.ts` | Partial | Training/inference estimation, real-time active job tracking |
| **Credit Ceiling** | `credit-ceiling.ts` | Complete | Multi-threshold spending limits (75%, 90%, 100%) |
| **Cost Limiter** | `cost-limiter.ts` | Complete | Per-tier budget enforcement (hourly, daily) |
| **Credit Pool** | `credit-pool.ts` | Complete | Self-funding revenue allocation (60/20/10/10 split) |
| **User Stripe Helper** | `stripe-integration.ts` | Complete | Helps users configure their own Stripe accounts |

### What's Missing (Gaps to Fill)

| Gap | Priority | Description |
|-----|----------|-------------|
| **Metered GPU Billing** | Critical | Connect GPU cost tracker to credit deduction system |
| **Billing Context Logic** | Critical | Distinguish: building (KripTik pays) vs training (user pays) vs deployed (user's account) |
| **RunPod Cost Passthrough** | High | Real-time cost polling from RunPod API → credit deduction |
| **Open Source Studio Products** | High | Stripe products/prices for training, fine-tuning, endpoints |
| **Training Job Credit Deduction** | High | Deduct credits when training completes (not just estimate) |
| **Margin Configuration** | Medium | Configurable markup on GPU costs (default 20%) |
| **Usage-Based Overage** | Medium | Bill for usage exceeding subscription limits |
| **Detailed Invoice Items** | Low | Per-operation cost breakdown for invoices |

---

## EXISTING INFRASTRUCTURE DETAILS

### 1. Credit System Architecture (`credits.ts`)

**Pricing Model:**
- Base: 100 credits = $1 USD
- Minimum deduction: 1 credit

**Token Costs (per 1M tokens):**
```typescript
MODEL_COSTS = {
  'claude-opus-4-5': { input: 15, output: 75 },      // $15/$75 per 1M
  'claude-sonnet-4-5': { input: 3, output: 15 },    // $3/$15 per 1M
  'gpt-4o': { input: 2.5, output: 10 },             // $2.50/$10 per 1M
  'claude-3-5-haiku': { input: 0.8, output: 4 },    // $0.80/$4 per 1M
  'deepseek-v3': { input: 0.14, output: 0.28 },     // Ultra-cheap
}
```

**Tier Allocations (Monthly):**
```typescript
TIER_ALLOCATIONS = {
  free: 500,        // $5 worth
  pro: 5000,        // $50 worth
  enterprise: 50000 // $500 worth
}
```

**Key Methods:**
- `calculateCreditsForGeneration(model, inputTokens, outputTokens)` → number
- `deductCredits(userId, amount, description, metadata)` → { success, newBalance }
- `recordGeneration(userId, projectId, model, inputTokens, outputTokens)` → { creditsUsed, remainingBalance }

### 2. Stripe Plans (`stripe.ts`)

**Current Plans:**
| Plan | Monthly | Credits | Stripe Price ID Pattern |
|------|---------|---------|------------------------|
| Free | $0 | 50 | N/A |
| Starter | $29 | 300 | `price_1SbdJ72KRfBV8ELz*` |
| Builder | $59 | 800 | `price_1SbdJ82KRfBV8ELz*` |
| Developer | $99 | 2,000 | `price_1SbdJ82KRfBV8ELz*` |
| Pro | $199 | 5,000 | `price_1SbdJ92KRfBV8ELz*` |

**Top-Up Packages:**
| Package | Price | Credits | Rate |
|---------|-------|---------|------|
| topup_100 | $15 | 100 | $0.15/credit |
| topup_300 | $39 | 300 | $0.13/credit |
| topup_500 | $59 | 500 | $0.118/credit |
| topup_1000 | $99 | 1,000 | $0.099/credit |
| topup_2500 | $199 | 2,500 | $0.0796/credit |

### 3. GPU Cost Tracker (`gpu-cost-tracker.ts`)

**GPU Pricing (January 2026):**
```typescript
GPU_PRICING = {
  'NVIDIA GeForce RTX 4090': { pricePerHour: 0.74, vram: 24 },
  'NVIDIA RTX A6000': { pricePerHour: 0.79, vram: 48 },
  'NVIDIA L40S': { pricePerHour: 1.14, vram: 48 },
  'NVIDIA A100-SXM4-80GB': { pricePerHour: 2.49, vram: 80 },
  'NVIDIA H100 PCIe': { pricePerHour: 3.29, vram: 80 },
  'NVIDIA H100 SXM': { pricePerHour: 4.29, vram: 80 },
  'STORAGE_VOLUME': { pricePerHour: 0.00015 }, // per GB
}
```

**Existing Methods (Estimation Only):**
- `startTracking(params)` → trackingId
- `stopTracking(trackingId)` → GPUUsageRecord
- `estimateTrainingCost(params)` → CostEstimate
- `estimateInferenceCost(params)` → CostEstimate
- `getCostSummary(userId, period)` → CostSummary

**GAP: No connection to credit deduction system**

### 4. Credit Pool Revenue Allocation (`credit-pool.ts`)

**Allocation Split:**
- 60% → API Reserve (pays Anthropic/OpenAI via OpenRouter)
- 20% → Free Tier Subsidy (funds free users)
- 10% → Infrastructure Reserve (Vercel, Turso, RunPod margin)
- 10% → Profit Reserve (business growth)

**Key Methods:**
- `recordRevenue(amountCents, source, userId)` → void
- `canAffordApiCall(estimatedCostCents, isFreeTier)` → { allowed, reason, availableBalance }
- `deductApiCost(actualCostCents, isFreeTier, userId, details)` → void
- `getHealth()` → PoolHealth { status, apiRunway, freeRunway, alerts }

---

## IMPLEMENTATION PLAN

### Phase 1: Billing Context System

**Purpose**: Distinguish who pays for what usage.

**File**: `server/src/services/billing/billing-context.ts`

```typescript
// Billing context determines who pays
export enum BillingContext {
  // KripTik absorbs cost (building user's app)
  KRIPTIK_BUILDING = 'kriptik_building',

  // KripTik absorbs cost (quality verification)
  KRIPTIK_VERIFICATION = 'kriptik_verification',

  // KripTik absorbs cost (sandbox preview)
  KRIPTIK_SANDBOX = 'kriptik_sandbox',

  // User pays via credits (training their models)
  USER_TRAINING = 'user_training',

  // User pays via credits (fine-tuning)
  USER_FINETUNING = 'user_finetuning',

  // User pays via credits (inference on KripTik infrastructure)
  USER_INFERENCE = 'user_inference',

  // User's own account (deployed backend)
  USER_DEPLOYED = 'user_deployed',
}

export interface BillingDecision {
  context: BillingContext;
  billUser: boolean;
  creditMultiplier: number; // 1.0 = at cost, 1.2 = 20% margin
  reason: string;
}

export function determineBillingContext(params: {
  operationType: 'training' | 'inference' | 'building' | 'verification' | 'sandbox' | 'deployed';
  isUserInitiated: boolean;
  deploymentTarget: 'kriptik' | 'user_account';
}): BillingDecision {
  // Building apps = KripTik cost
  if (params.operationType === 'building') {
    return {
      context: BillingContext.KRIPTIK_BUILDING,
      billUser: false,
      creditMultiplier: 0,
      reason: 'App building is included in subscription',
    };
  }

  // Verification swarm = KripTik cost
  if (params.operationType === 'verification') {
    return {
      context: BillingContext.KRIPTIK_VERIFICATION,
      billUser: false,
      creditMultiplier: 0,
      reason: 'Quality verification is included',
    };
  }

  // Sandbox previews = KripTik cost
  if (params.operationType === 'sandbox') {
    return {
      context: BillingContext.KRIPTIK_SANDBOX,
      billUser: false,
      creditMultiplier: 0,
      reason: 'Sandbox previews are included',
    };
  }

  // User-initiated training = bill user with margin
  if (params.operationType === 'training' && params.isUserInitiated) {
    return {
      context: BillingContext.USER_TRAINING,
      billUser: true,
      creditMultiplier: 1.2, // 20% margin
      reason: 'User-initiated training on KripTik infrastructure',
    };
  }

  // User-initiated fine-tuning = bill user with margin
  if (params.operationType === 'inference' && params.deploymentTarget === 'kriptik') {
    return {
      context: BillingContext.USER_INFERENCE,
      billUser: true,
      creditMultiplier: 1.2, // 20% margin
      reason: 'Inference on KripTik-hosted endpoint',
    };
  }

  // Deployed to user's account = no KripTik billing
  if (params.deploymentTarget === 'user_account') {
    return {
      context: BillingContext.USER_DEPLOYED,
      billUser: false,
      creditMultiplier: 0,
      reason: 'Running on user\'s own cloud account',
    };
  }

  // Default: bill user
  return {
    context: BillingContext.USER_TRAINING,
    billUser: true,
    creditMultiplier: 1.2,
    reason: 'Default: user-initiated operation',
  };
}
```

---

### Phase 2: GPU Credit Integration

**Purpose**: Connect GPU cost tracker to credit system for actual billing.

**File**: `server/src/services/billing/gpu-billing.ts`

```typescript
import { getGPUCostTracker, GPU_PRICING } from './gpu-cost-tracker.js';
import { getCreditService } from './credits.js';
import { getCreditPoolService } from './credit-pool.js';
import { getUsageService } from './usage-service.js';
import { determineBillingContext, BillingContext } from './billing-context.js';

export interface GPUBillingConfig {
  marginPercent: number;      // Default: 20%
  minimumChargeCents: number; // Default: 10 (10 cents)
  roundUpSeconds: number;     // Default: 60 (bill in 1-min increments)
}

const DEFAULT_CONFIG: GPUBillingConfig = {
  marginPercent: 20,
  minimumChargeCents: 10,
  roundUpSeconds: 60,
};

export interface GPUChargeResult {
  success: boolean;
  actualCostCents: number;
  chargedCents: number;
  creditsDeducted: number;
  remainingBalance: number;
  billingContext: BillingContext;
  error?: string;
}

export class GPUBillingService {
  private config: GPUBillingConfig;
  private tracker = getGPUCostTracker();
  private creditService = getCreditService();
  private poolService = getCreditPoolService();
  private usageService = getUsageService();

  constructor(config: Partial<GPUBillingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate cost with margin for user billing
   */
  private calculateChargeWithMargin(actualCostCents: number): number {
    const withMargin = actualCostCents * (1 + this.config.marginPercent / 100);
    return Math.max(this.config.minimumChargeCents, Math.ceil(withMargin));
  }

  /**
   * Convert cents to credits (100 credits = $1)
   */
  private centsToCredits(cents: number): number {
    return Math.ceil(cents); // 1 cent = 1 credit (100 credits = $1)
  }

  /**
   * Pre-authorize GPU usage before job starts
   * Returns tracking ID if authorized, throws if insufficient credits
   */
  async authorizeGPUUsage(params: {
    userId: string;
    projectId?: string;
    gpuType: string;
    estimatedDurationMinutes: number;
    operationType: 'training' | 'inference';
    isUserInitiated: boolean;
  }): Promise<{
    trackingId: string;
    estimatedCostCents: number;
    estimatedCredits: number;
    billingContext: BillingContext;
  }> {
    const decision = determineBillingContext({
      operationType: params.operationType,
      isUserInitiated: params.isUserInitiated,
      deploymentTarget: 'kriptik',
    });

    // If KripTik is paying, just start tracking (no credit check)
    if (!decision.billUser) {
      const trackingId = await this.tracker.startTracking({
        userId: params.userId,
        projectId: params.projectId,
        type: params.operationType,
        provider: 'runpod',
        gpuType: params.gpuType,
        details: { billingContext: decision.context },
      });

      return {
        trackingId,
        estimatedCostCents: 0,
        estimatedCredits: 0,
        billingContext: decision.context,
      };
    }

    // Calculate estimated cost
    const pricing = GPU_PRICING[params.gpuType] || GPU_PRICING['DEFAULT'];
    const estimatedHours = params.estimatedDurationMinutes / 60;
    const estimatedCostCents = Math.ceil(estimatedHours * pricing.pricePerHour * 100);
    const chargeWithMargin = this.calculateChargeWithMargin(estimatedCostCents);
    const estimatedCredits = this.centsToCredits(chargeWithMargin);

    // Check if user has enough credits
    const hasCredits = await this.creditService.hasCredits(params.userId, estimatedCredits);
    if (!hasCredits) {
      const balance = await this.creditService.getCredits(params.userId);
      throw new Error(
        `Insufficient credits. Estimated cost: ${estimatedCredits} credits. ` +
        `Current balance: ${balance.balance} credits. ` +
        `Please add credits to continue.`
      );
    }

    // Start tracking
    const trackingId = await this.tracker.startTracking({
      userId: params.userId,
      projectId: params.projectId,
      type: params.operationType,
      provider: 'runpod',
      gpuType: params.gpuType,
      details: {
        billingContext: decision.context,
        estimatedCostCents,
        estimatedCredits,
      },
    });

    return {
      trackingId,
      estimatedCostCents,
      estimatedCredits,
      billingContext: decision.context,
    };
  }

  /**
   * Finalize GPU usage and charge user
   * Called when job completes or is cancelled
   */
  async finalizeGPUUsage(params: {
    trackingId: string;
    userId: string;
    projectId?: string;
    success: boolean;
    operationType: 'training' | 'inference';
    isUserInitiated: boolean;
  }): Promise<GPUChargeResult> {
    // Stop tracking and get final cost
    const record = await this.tracker.stopTracking(params.trackingId);

    if (!record) {
      return {
        success: false,
        actualCostCents: 0,
        chargedCents: 0,
        creditsDeducted: 0,
        remainingBalance: 0,
        billingContext: BillingContext.KRIPTIK_BUILDING,
        error: 'Tracking record not found',
      };
    }

    const decision = determineBillingContext({
      operationType: params.operationType,
      isUserInitiated: params.isUserInitiated,
      deploymentTarget: 'kriptik',
    });

    // If KripTik is paying, record to pool but don't charge user
    if (!decision.billUser) {
      await this.poolService.deductApiCost(
        record.costCents,
        false, // Not free tier
        params.userId,
        {
          model: 'gpu',
          tokens: 0,
          endpoint: record.gpuType || 'unknown',
        }
      );

      return {
        success: true,
        actualCostCents: record.costCents,
        chargedCents: 0,
        creditsDeducted: 0,
        remainingBalance: (await this.creditService.getCredits(params.userId)).balance,
        billingContext: decision.context,
      };
    }

    // Calculate charge with margin
    const chargedCents = this.calculateChargeWithMargin(record.costCents);
    const creditsToDeduct = this.centsToCredits(chargedCents);

    // Deduct credits from user
    const deductResult = await this.creditService.deductCredits(
      params.userId,
      creditsToDeduct,
      `GPU ${params.operationType}: ${record.gpuType || 'Unknown GPU'} for ${this.tracker.formatDuration(record.durationSeconds || 0)}`,
      {
        trackingId: params.trackingId,
        gpuType: record.gpuType,
        durationSeconds: record.durationSeconds,
        actualCostCents: record.costCents,
        chargedCents,
        billingContext: decision.context,
      }
    );

    if (!deductResult.success) {
      return {
        success: false,
        actualCostCents: record.costCents,
        chargedCents,
        creditsDeducted: 0,
        remainingBalance: deductResult.newBalance,
        billingContext: decision.context,
        error: deductResult.error,
      };
    }

    // Record to usage service for analytics
    await this.usageService.recordUsage({
      userId: params.userId,
      projectId: params.projectId,
      category: params.operationType === 'training' ? 'deployment' : 'api_call',
      subcategory: `gpu_${params.operationType}`,
      creditsUsed: creditsToDeduct,
      metadata: {
        trackingId: params.trackingId,
        gpuType: record.gpuType,
        durationSeconds: record.durationSeconds,
        actualCostCents: record.costCents,
        chargedCents,
        marginPercent: this.config.marginPercent,
      },
    });

    // Record revenue to pool (only the margin portion is profit)
    const marginCents = chargedCents - record.costCents;
    if (marginCents > 0) {
      await this.poolService.recordRevenue(marginCents, 'overage', params.userId);
    }

    return {
      success: true,
      actualCostCents: record.costCents,
      chargedCents,
      creditsDeducted: creditsToDeduct,
      remainingBalance: deductResult.newBalance,
      billingContext: decision.context,
    };
  }

  /**
   * Get real-time cost for active job (with margin)
   */
  getActiveJobCost(trackingId: string): {
    actualCostCents: number;
    chargedCents: number;
    estimatedCredits: number;
  } {
    const actualCostCents = this.tracker.getActiveCost(trackingId);
    const chargedCents = this.calculateChargeWithMargin(actualCostCents);
    return {
      actualCostCents,
      chargedCents,
      estimatedCredits: this.centsToCredits(chargedCents),
    };
  }
}

// Singleton
let instance: GPUBillingService | null = null;

export function getGPUBillingService(config?: Partial<GPUBillingConfig>): GPUBillingService {
  if (!instance) {
    instance = new GPUBillingService(config);
  }
  return instance;
}
```

---

### Phase 3: Open Source Studio Stripe Products

**Purpose**: Create Stripe products and prices for Open Source Studio features.

**File**: `server/src/services/billing/open-source-studio-billing.ts`

```typescript
import Stripe from 'stripe';

// Open Source Studio pricing tiers
export const OPEN_SOURCE_STUDIO_PRODUCTS = {
  // Training Jobs - metered by GPU-hour
  training: {
    productName: 'KripTik AI - Model Training',
    description: 'GPU compute for training custom models',
    unitLabel: 'GPU-hour',
    prices: [
      { gpuTier: 'consumer', unitAmountCents: 100, displayName: 'Consumer GPU (RTX 4090)' },
      { gpuTier: 'professional', unitAmountCents: 150, displayName: 'Professional GPU (A6000/L40S)' },
      { gpuTier: 'datacenter', unitAmountCents: 350, displayName: 'Datacenter GPU (A100/H100)' },
    ],
  },

  // Fine-Tuning - metered by training step
  fineTuning: {
    productName: 'KripTik AI - Model Fine-Tuning',
    description: 'LoRA/QLoRA fine-tuning for custom models',
    unitLabel: 'training-step',
    prices: [
      { method: 'lora', unitAmountCents: 1, displayName: 'LoRA Fine-Tuning' },
      { method: 'qlora', unitAmountCents: 2, displayName: 'QLoRA Fine-Tuning' },
      { method: 'full', unitAmountCents: 5, displayName: 'Full Fine-Tuning' },
    ],
  },

  // Inference Endpoints - metered by request + compute time
  inference: {
    productName: 'KripTik AI - Inference Endpoints',
    description: 'Hosted model inference endpoints',
    unitLabel: 'request',
    prices: [
      { tier: 'standard', unitAmountCents: 1, displayName: 'Standard Inference' },
      { tier: 'premium', unitAmountCents: 5, displayName: 'Premium Inference (larger models)' },
    ],
  },

  // Volume Storage - metered by GB-hour
  storage: {
    productName: 'KripTik AI - Model Storage',
    description: 'Persistent storage for models and checkpoints',
    unitLabel: 'GB-hour',
    prices: [
      { tier: 'standard', unitAmountCents: 0.02, displayName: 'Standard Storage' }, // $0.0002/GB-hour
    ],
  },
};

export interface SetupOpenSourceStudioResult {
  products: Map<string, string>; // productKey → stripeProductId
  prices: Map<string, string>;   // priceKey → stripePriceId
  errors: string[];
}

export async function setupOpenSourceStudioProducts(
  stripe: Stripe
): Promise<SetupOpenSourceStudioResult> {
  const products = new Map<string, string>();
  const prices = new Map<string, string>();
  const errors: string[] = [];

  for (const [key, productConfig] of Object.entries(OPEN_SOURCE_STUDIO_PRODUCTS)) {
    try {
      // Create or retrieve product
      let product: Stripe.Product;
      const existingProducts = await stripe.products.list({
        limit: 100,
        active: true,
      });

      const existing = existingProducts.data.find(
        p => p.name === productConfig.productName
      );

      if (existing) {
        product = existing;
      } else {
        product = await stripe.products.create({
          name: productConfig.productName,
          description: productConfig.description,
          metadata: {
            category: 'open_source_studio',
            productKey: key,
          },
        });
      }

      products.set(key, product.id);

      // Create metered prices for each tier
      for (const priceConfig of productConfig.prices) {
        const priceKey = `${key}_${Object.values(priceConfig)[0]}`;

        try {
          // Check for existing price
          const existingPrices = await stripe.prices.list({
            product: product.id,
            active: true,
            limit: 100,
          });

          const existingPrice = existingPrices.data.find(
            p => p.metadata?.priceKey === priceKey
          );

          if (existingPrice) {
            prices.set(priceKey, existingPrice.id);
          } else {
            // Create metered price
            const price = await stripe.prices.create({
              product: product.id,
              currency: 'usd',
              unit_amount: Math.round(priceConfig.unitAmountCents),
              recurring: {
                interval: 'month',
                usage_type: 'metered',
                aggregate_usage: 'sum',
              },
              metadata: {
                priceKey,
                displayName: priceConfig.displayName,
              },
            });

            prices.set(priceKey, price.id);
          }
        } catch (priceError) {
          errors.push(`Failed to create price ${priceKey}: ${priceError}`);
        }
      }
    } catch (productError) {
      errors.push(`Failed to create product ${key}: ${productError}`);
    }
  }

  return { products, prices, errors };
}

/**
 * Record metered usage to Stripe
 */
export async function recordMeteredUsage(
  stripe: Stripe,
  subscriptionItemId: string,
  quantity: number,
  timestamp?: number
): Promise<Stripe.UsageRecord> {
  return stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
    quantity,
    timestamp: timestamp || Math.floor(Date.now() / 1000),
    action: 'increment',
  });
}
```

---

### Phase 4: Integration with Training Orchestrator

**Purpose**: Wire GPU billing into the training job lifecycle.

**Modify**: `server/src/services/ml/training-orchestrator.ts`

Add these integration points:

```typescript
import { getGPUBillingService } from '../billing/gpu-billing.js';

// In startTrainingJob method:
async startTrainingJob(params: TrainingJobParams): Promise<TrainingJob> {
  const gpuBilling = getGPUBillingService();

  // 1. Pre-authorize GPU usage
  const authorization = await gpuBilling.authorizeGPUUsage({
    userId: params.userId,
    projectId: params.projectId,
    gpuType: params.gpuConfig.gpuType,
    estimatedDurationMinutes: params.estimatedDurationMinutes,
    operationType: 'training',
    isUserInitiated: true, // User clicked "Train" in Open Source Studio
  });

  // Store trackingId in job for later billing
  const job = await this.createJob({
    ...params,
    billingTrackingId: authorization.trackingId,
    estimatedCostCents: authorization.estimatedCostCents,
  });

  // 2. Start the actual training on RunPod
  await this.provisionAndStartTraining(job);

  return job;
}

// In onTrainingComplete method:
async onTrainingComplete(jobId: string, success: boolean): Promise<void> {
  const job = await this.getJob(jobId);
  const gpuBilling = getGPUBillingService();

  // 3. Finalize billing
  const chargeResult = await gpuBilling.finalizeGPUUsage({
    trackingId: job.billingTrackingId,
    userId: job.userId,
    projectId: job.projectId,
    success,
    operationType: 'training',
    isUserInitiated: true,
  });

  // 4. Update job with billing info
  await this.updateJob(jobId, {
    billingComplete: true,
    actualCostCents: chargeResult.actualCostCents,
    chargedCents: chargeResult.chargedCents,
    creditsDeducted: chargeResult.creditsDeducted,
  });

  // 5. Notify user
  await this.notifyUser(job.userId, {
    type: 'training_complete',
    jobId,
    success,
    cost: chargeResult,
  });
}
```

---

### Phase 5: API Routes for GPU Billing

**File**: `server/src/routes/gpu-billing.ts`

```typescript
import { Router, Request, Response } from 'express';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import { getGPUBillingService } from '../services/billing/gpu-billing.js';
import { getGPUCostTracker } from '../services/billing/gpu-cost-tracker.js';

const router = Router();

/**
 * POST /api/gpu-billing/estimate
 * Get cost estimate for GPU operation
 */
router.post('/estimate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { gpuType, durationMinutes, operationType } = req.body;

    const tracker = getGPUCostTracker();
    const billing = getGPUBillingService();

    if (operationType === 'training') {
      const estimate = tracker.estimateTrainingCost({
        modelSizeGB: req.body.modelSizeGB || 7,
        datasetSizeGB: req.body.datasetSizeGB || 1,
        epochs: req.body.epochs || 3,
        batchSize: req.body.batchSize || 4,
        gpuType,
        trainingType: req.body.trainingType || 'lora',
      });

      // Add margin for user billing
      const withMargin = Math.ceil(estimate.estimatedCostCents * 1.2);

      res.json({
        estimate: {
          ...estimate,
          chargedCostCents: withMargin,
          chargedCredits: withMargin,
          marginPercent: 20,
        },
      });
    } else {
      const estimate = tracker.estimateInferenceCost({
        gpuType,
        minWorkers: req.body.minWorkers || 0,
        maxWorkers: req.body.maxWorkers || 1,
        estimatedRequestsPerHour: req.body.requestsPerHour || 100,
        avgLatencyMs: req.body.avgLatencyMs || 500,
        hoursPerDay: req.body.hoursPerDay || 24,
      });

      const withMargin = Math.ceil(estimate.estimatedCostCents * 1.2);

      res.json({
        estimate: {
          ...estimate,
          chargedCostCents: withMargin,
          chargedCredits: withMargin,
          marginPercent: 20,
        },
      });
    }
  } catch (error) {
    console.error('Error estimating GPU cost:', error);
    res.status(500).json({ error: 'Failed to estimate cost' });
  }
});

/**
 * GET /api/gpu-billing/active
 * Get active GPU jobs and their real-time costs
 */
router.get('/active', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user.id;
    const tracker = getGPUCostTracker();
    const billing = getGPUBillingService();

    // Get active jobs from tracker
    const summary = await tracker.getCostSummary(userId, 'today');

    res.json({
      activeJobs: summary,
    });
  } catch (error) {
    console.error('Error fetching active GPU jobs:', error);
    res.status(500).json({ error: 'Failed to fetch active jobs' });
  }
});

/**
 * GET /api/gpu-billing/pricing
 * Get current GPU pricing with margins
 */
router.get('/pricing', async (req: Request, res: Response) => {
  try {
    const tracker = getGPUCostTracker();
    const rawPricing = tracker.getGPUPricing() as Record<string, { pricePerHour: number; vram: number }>;

    // Add margin to pricing for display
    const pricingWithMargin: Record<string, {
      pricePerHour: number;
      chargedPerHour: number;
      vram: number;
      marginPercent: number;
    }> = {};

    for (const [gpu, pricing] of Object.entries(rawPricing)) {
      if (gpu === 'DEFAULT' || gpu === 'STORAGE_VOLUME') continue;

      pricingWithMargin[gpu] = {
        pricePerHour: pricing.pricePerHour,
        chargedPerHour: Math.ceil(pricing.pricePerHour * 1.2 * 100) / 100,
        vram: pricing.vram,
        marginPercent: 20,
      };
    }

    res.json({ pricing: pricingWithMargin });
  } catch (error) {
    console.error('Error fetching GPU pricing:', error);
    res.status(500).json({ error: 'Failed to fetch pricing' });
  }
});

export default router;
```

---

### Phase 6: Database Schema Updates

**Add to**: `server/src/schema.ts`

```typescript
// =============================================================================
// GPU BILLING RECORDS - Tracks all billable GPU usage
// =============================================================================

export const gpuBillingRecords = sqliteTable('gpu_billing_records', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id).notNull(),
  projectId: text('project_id').references(() => projects.id),

  // Tracking reference
  trackingId: text('tracking_id').notNull(),

  // Operation details
  operationType: text('operation_type').notNull().$type<'training' | 'inference' | 'storage'>(),
  gpuType: text('gpu_type'),
  provider: text('provider').default('runpod').$type<'runpod' | 'modal' | 'huggingface'>(),

  // Timing
  startTime: text('start_time').notNull(),
  endTime: text('end_time'),
  durationSeconds: integer('duration_seconds'),

  // Cost breakdown
  actualCostCents: integer('actual_cost_cents').notNull().default(0),
  marginPercent: integer('margin_percent').notNull().default(20),
  chargedCents: integer('charged_cents').notNull().default(0),
  creditsDeducted: integer('credits_deducted').notNull().default(0),

  // Billing context
  billingContext: text('billing_context').notNull().$type<
    'kriptik_building' | 'kriptik_verification' | 'kriptik_sandbox' |
    'user_training' | 'user_finetuning' | 'user_inference' | 'user_deployed'
  >(),
  billUser: integer('bill_user', { mode: 'boolean' }).notNull().default(true),

  // Status
  status: text('status').default('pending').$type<'pending' | 'completed' | 'failed' | 'refunded'>(),

  // Metadata
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),

  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

// Index for fast lookups
export const gpuBillingRecordsUserIdx = index('gpu_billing_records_user_idx')
  .on(gpuBillingRecords.userId);
export const gpuBillingRecordsTrackingIdx = index('gpu_billing_records_tracking_idx')
  .on(gpuBillingRecords.trackingId);
```

---

## IMPLEMENTATION PROMPTS

### PROMPT 1: Billing Context System

```
TASK: Create the billing context system for KripTik AI that determines who pays for GPU and compute usage.

CONTEXT:
- KripTik absorbs costs for: app building, verification swarm, sandbox previews
- Users pay (with 20% margin) for: training, fine-tuning, inference on KripTik infrastructure
- Users pay directly (no KripTik involvement) for: deployed backends on their own accounts

CREATE:
1. server/src/services/billing/billing-context.ts
   - BillingContext enum with all context types
   - BillingDecision interface
   - determineBillingContext() function with full logic

INTEGRATE WITH:
- Existing credit-pool.ts for revenue allocation
- Existing gpu-cost-tracker.ts for cost tracking
- Existing credits.ts for user balance management

REQUIREMENTS:
- Export all types for use by other billing services
- Include comprehensive JSDoc comments
- Handle all edge cases (unknown operation types, etc.)
- Default to billing user if context is unclear

VALIDATION:
- npm run build must pass
- Types must be correctly inferred
- No circular dependencies
```

---

### PROMPT 2: GPU Billing Integration

```
TASK: Create the GPU billing service that connects GPU cost tracking to credit deduction.

CONTEXT:
- server/src/services/billing/gpu-cost-tracker.ts exists with estimation and tracking
- server/src/services/billing/credits.ts exists with credit management
- We need to bridge these systems with margin calculation

CREATE:
1. server/src/services/billing/gpu-billing.ts
   - GPUBillingService class with:
     - authorizeGPUUsage() - pre-flight credit check
     - finalizeGPUUsage() - actual billing when job completes
     - getActiveJobCost() - real-time cost with margin
   - Configurable margin (default 20%)
   - Minimum charge threshold (10 cents)

INTEGRATE WITH:
- billing-context.ts for determining who pays
- gpu-cost-tracker.ts for cost calculation
- credits.ts for deducting credits
- credit-pool.ts for recording revenue
- usage-service.ts for analytics

REQUIREMENTS:
- Handle job cancellation (partial billing)
- Handle job failure (no billing or partial based on progress)
- Log all billing events for audit trail
- Emit events for real-time cost updates

VALIDATION:
- npm run build must pass
- Test authorization with insufficient credits
- Test finalization with successful job
```

---

### PROMPT 3: Open Source Studio Products

```
TASK: Create Stripe products and metered prices for Open Source Studio features.

CONTEXT:
- Users can train models (GPU-hour billing)
- Users can fine-tune models (training-step billing)
- Users can host inference endpoints (request billing)
- Users can store models (GB-hour billing)

CREATE:
1. server/src/services/billing/open-source-studio-billing.ts
   - Product definitions for each feature category
   - setupOpenSourceStudioProducts() function to create in Stripe
   - recordMeteredUsage() function to record usage
   - Price tiers for different GPU classes

2. Update server/src/routes/billing.ts:
   - POST /api/billing/oss/setup - Create products (admin only)
   - POST /api/billing/oss/usage - Record metered usage
   - GET /api/billing/oss/products - List products and prices

REQUIREMENTS:
- Use metered billing (recurring: { usage_type: 'metered' })
- Idempotent setup (don't create duplicates)
- Store product/price IDs in database for reference
- Support different pricing tiers per GPU class

VALIDATION:
- npm run build must pass
- Test with Stripe test mode
- Verify products appear in Stripe dashboard
```

---

### PROMPT 4: Training Orchestrator Integration

```
TASK: Integrate GPU billing into the training job lifecycle.

CONTEXT:
- server/src/services/ml/training-orchestrator.ts manages training jobs
- We need to authorize before starting and finalize when complete
- Billing must handle success, failure, and cancellation

MODIFY:
1. server/src/services/ml/training-orchestrator.ts:
   - Add billingTrackingId to job schema
   - Call authorizeGPUUsage() before starting job
   - Call finalizeGPUUsage() when job completes/fails
   - Handle insufficient credits gracefully

2. Update server/src/schema.ts:
   - Add billingTrackingId column to trainingJobs table
   - Add billing result columns (actualCost, chargedCost, creditsDeducted)

REQUIREMENTS:
- Fail fast if user doesn't have credits
- Show estimated cost in UI before user confirms
- Real-time cost updates during training
- Clear billing receipt on completion

VALIDATION:
- npm run build must pass
- Test full training job lifecycle
- Test cancellation mid-training
- Test failure recovery
```

---

### PROMPT 5: GPU Billing API Routes

```
TASK: Create API routes for GPU billing information and operations.

CONTEXT:
- Frontend needs cost estimates before starting jobs
- Frontend needs real-time cost during active jobs
- Frontend needs pricing information for display

CREATE:
1. server/src/routes/gpu-billing.ts:
   - POST /api/gpu-billing/estimate - Get cost estimate
   - GET /api/gpu-billing/active - Get active jobs with costs
   - GET /api/gpu-billing/pricing - Get GPU pricing table
   - GET /api/gpu-billing/history - Get billing history

2. Register routes in server/src/routes/index.ts

INTEGRATE WITH:
- Existing auth middleware
- gpu-billing.ts service
- gpu-cost-tracker.ts for pricing data

REQUIREMENTS:
- All routes require authentication
- Include margin in all price displays
- Return consistent response format
- Handle errors gracefully

VALIDATION:
- npm run build must pass
- Test all endpoints with valid auth
- Test unauthorized access returns 401
```

---

### PROMPT 6: Database Schema Updates

```
TASK: Add database tables for GPU billing records and audit trail.

CONTEXT:
- Need to track all billable GPU usage
- Need audit trail for financial compliance
- Need to link to existing users, projects, training jobs

CREATE:
1. Update server/src/schema.ts:
   - gpuBillingRecords table with full billing details
   - Indexes for fast lookups
   - Foreign key references

2. Create migration script if needed

REQUIREMENTS:
- Store all cost components (actual, margin, charged)
- Store billing context for each record
- Support refunds (status: 'refunded')
- Include timestamps for audit

VALIDATION:
- npm run build must pass
- Run migration successfully
- Verify table created with correct schema
```

---

## TESTING CHECKLIST

Before considering implementation complete:

```
[ ] Billing context correctly identifies who pays
[ ] GPU authorization fails with insufficient credits
[ ] GPU finalization deducts correct credits
[ ] Margin is correctly applied (20% default)
[ ] Credit pool receives margin as revenue
[ ] Usage service records all GPU usage
[ ] Stripe products created successfully
[ ] Metered usage records to Stripe
[ ] Training jobs include billing tracking
[ ] API routes return correct data
[ ] Real-time cost updates work
[ ] Cancellation bills for partial usage
[ ] Failed jobs handled correctly
[ ] Database records created properly
[ ] npm run build passes
```

---

## MARGIN STRATEGY

**Recommended Margin: 20%**

| Our Cost | Charge to User | Our Margin |
|----------|----------------|------------|
| $0.74/hr (RTX 4090) | $0.89/hr | $0.15/hr |
| $2.49/hr (A100) | $2.99/hr | $0.50/hr |
| $4.29/hr (H100 SXM) | $5.15/hr | $0.86/hr |

**Why 20%:**
- Covers payment processing fees (~3%)
- Covers infrastructure overhead (~7%)
- Provides business profit (~10%)
- Competitive with direct RunPod pricing (users get KripTik UI value)

---

*This document provides the complete implementation plan for Stripe payment infrastructure.*
*Last updated: January 7, 2026*
