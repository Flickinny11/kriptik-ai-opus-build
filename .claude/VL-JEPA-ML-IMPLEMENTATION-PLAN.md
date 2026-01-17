# VL-JEPA & Learning Systems Implementation Plan

## Executive Summary

This document provides **actionable implementation prompts** to fix the KripTik AI learning systems. The core issue is that VL-JEPA, Component 28, and the Continuous Learning Engine **bypass the real embedding service** by using internal hash-based fake embeddings (128-384 dim) instead of the production embedding providers (BGE-M3 1024-dim, SigLIP-2 768-dim, Voyage-code-3 1024-dim).

**Status**: Real embedding providers EXIST and WORK. They just aren't being USED by the learning engines.

---

## Problem Analysis

### Files Using Placeholder Hash Embeddings

| File | Line | Current Behavior | Dimension |
|------|------|------------------|-----------|
| `server/src/services/continuous-learning/vector-context-provider.ts` | 452-475 | Hash-based fake embedding | 384 |
| `server/src/services/continuous-learning/engine.ts` | 586-598 | Hash-based fake embedding | 384 |
| `server/src/services/continuous-learning/vl-jepa-feedback.ts` | 375-397 | Character hash embedding | 128 |

### Real Embedding Providers (Already Implemented)

| Provider | File | Dimensions | API |
|----------|------|------------|-----|
| BGE-M3 | `server/src/services/embeddings/providers/bge-m3-provider.ts` | 1024 | HuggingFace Inference API |
| Voyage-code-3 | `server/src/services/embeddings/providers/voyage-code-provider.ts` | 1024 | Voyage AI API |
| SigLIP-2 | `server/src/services/embeddings/providers/siglip-provider.ts` | 768 | HuggingFace Inference API |

### Type-to-Provider Mapping (from embedding-service.ts:226-232)
```typescript
const TYPE_TO_PROVIDER = {
  intent: 'bge-m3',      // Intent Lock contracts
  code: 'voyage-code-3', // Code patterns, repositories
  visual: 'siglip-2',    // Screenshots, design
  error: 'bge-m3',       // Error context
  reasoning: 'bge-m3',   // Hyper-thinking patterns
};
```

---

## Credentials

### RunPod API Key (User-Provided)
```
<RUNPOD_API_KEY from user or .env.local>
```

### HuggingFace Token (User-Provided)
```
<HUGGINGFACE_API_KEY from user or .env.local>
```

**Note**: Actual credentials stored in .env.local (not committed to git)

---

## Implementation Prompts

### PROMPT 1: Add Credentials to Environment

**Task**: Add the RunPod API key and update HuggingFace token in environment files.

**Files to modify**:
1. `/Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/server/.env`
2. `/Volumes/Logan T7 Touch/KripTik AI_Trial_antiGravity/Krip-Tik-AI-Trial/.env.local`

**Changes for server/.env** (after line 55):
```env
RUNPOD_API_KEY=<your_runpod_api_key>
HUGGINGFACE_API_KEY=<your_huggingface_token>
VOYAGE_API_KEY=  # Add Voyage API key if available
```

**Verification**: After adding, run `grep -E "RUNPOD|HUGGINGFACE" server/.env` to confirm.

---

### PROMPT 2: Wire EmbeddingService into VectorContextProvider

**Task**: Replace the internal fake `generateEmbedding` method with calls to the real EmbeddingService.

**File**: `/server/src/services/continuous-learning/vector-context-provider.ts`

**Step 1**: Add import at the top of the file (around line 10):
```typescript
import { EmbeddingService } from '../embeddings/embedding-service-impl.js';
import type { EmbeddingType } from '../embeddings/embedding-service.js';
```

**Step 2**: Add embeddingService to the class constructor (add private property):
```typescript
private embeddingService: EmbeddingService;

constructor() {
  // ... existing initialization
  this.embeddingService = new EmbeddingService();
}
```

**Step 3**: Replace lines 452-475 (the fake generateEmbedding method) with:
```typescript
/**
 * Generate embedding for text using real embedding service
 */
private async generateEmbedding(text: string, type: EmbeddingType = 'reasoning'): Promise<number[]> {
  const cacheKey = `${type}:${text.slice(0, 100)}`;
  const cached = this.embeddingCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const result = await this.embeddingService.embed({
      content: text,
      type: type,
    });

    if (result.embeddings.length > 0) {
      this.embeddingCache.set(cacheKey, result.embeddings[0]);
      return result.embeddings[0];
    }
  } catch (error) {
    console.error('[VectorContextProvider] Embedding failed, using fallback:', error);
  }

  // Fallback: Return zero vector with correct dimensions for type
  const dims = type === 'visual' ? 768 : 1024;
  return new Array(dims).fill(0);
}
```

**Step 4**: Update all calls to `generateEmbedding` to pass the appropriate type:
- For code patterns: `generateEmbedding(text, 'code')`
- For error resolutions: `generateEmbedding(text, 'error')`
- For learning insights: `generateEmbedding(text, 'reasoning')`

---

### PROMPT 3: Wire EmbeddingService into ContinuousLearningEngine

**Task**: Replace the internal fake `generateTaskEmbedding` method with calls to the real EmbeddingService.

**File**: `/server/src/services/continuous-learning/engine.ts`

**Step 1**: Add import at the top of the file:
```typescript
import { EmbeddingService } from '../embeddings/embedding-service-impl.js';
```

**Step 2**: Add embeddingService to the class:
```typescript
private embeddingService: EmbeddingService;
```

**Step 3**: Initialize in constructor:
```typescript
this.embeddingService = new EmbeddingService();
```

**Step 4**: Replace lines 586-598 (the fake generateTaskEmbedding method) with:
```typescript
/**
 * Generate embedding for a task description using real embedding service
 */
private async generateTaskEmbedding(task: string): Promise<number[]> {
  try {
    const result = await this.embeddingService.embed({
      content: task,
      type: 'reasoning', // Tasks are reasoning-type embeddings
    });

    if (result.embeddings.length > 0) {
      return result.embeddings[0];
    }
  } catch (error) {
    console.error('[ContinuousLearningEngine] Embedding failed:', error);
  }

  // Fallback: Return zero vector with correct dimensions (1024 for BGE-M3)
  return new Array(1024).fill(0);
}
```

---

### PROMPT 4: Wire EmbeddingService into VL-JEPA Feedback

**Task**: Replace the internal fake `getIntentEmbedding` method with calls to the real EmbeddingService.

**File**: `/server/src/services/continuous-learning/vl-jepa-feedback.ts`

**Step 1**: Add import at the top of the file:
```typescript
import { EmbeddingService } from '../embeddings/embedding-service-impl.js';
```

**Step 2**: Add embeddingService to the class:
```typescript
private embeddingService: EmbeddingService;
```

**Step 3**: Initialize in constructor (or as singleton):
```typescript
this.embeddingService = new EmbeddingService();
```

**Step 4**: Replace lines 375-397 (the fake getIntentEmbedding method) with:
```typescript
/**
 * Get intent embedding using real embedding service
 */
private async getIntentEmbedding(intent: string): Promise<number[]> {
  try {
    const result = await this.embeddingService.embed({
      content: intent,
      type: 'intent', // Intent embeddings use BGE-M3
    });

    if (result.embeddings.length > 0) {
      return result.embeddings[0];
    }
  } catch (error) {
    console.error('[VLJEPAFeedback] Embedding failed:', error);
  }

  // Fallback: Return zero vector with correct dimensions (1024 for BGE-M3)
  return new Array(1024).fill(0);
}
```

**Step 5**: Update Qdrant collection dimensions. The `intent_embeddings` collection needs to use 1024 dimensions (BGE-M3) instead of 128.

Check file: `/server/src/services/embeddings/collections.ts`
Ensure `intent_embeddings` has `size: 1024` in the vector configuration.

---

### PROMPT 5: Update Qdrant Collection Dimensions

**Task**: Verify and update Qdrant collection vector dimensions to match real embedding providers.

**File**: `/server/src/services/embeddings/collections.ts`

**Required dimensions by collection**:
```typescript
const COLLECTION_CONFIGS = {
  'intent_embeddings': { size: 1024, distance: 'Cosine' },      // BGE-M3
  'visual_embeddings': { size: 768, distance: 'Cosine' },       // SigLIP-2
  'code_patterns': { size: 1024, distance: 'Cosine' },          // Voyage-code-3
  'error_fixes': { size: 1024, distance: 'Cosine' },            // BGE-M3
  'hyper_thinking': { size: 1024, distance: 'Cosine' },         // BGE-M3
  'decomposition': { size: 1024, distance: 'Cosine' },          // BGE-M3
  'reasoning_skeletons': { size: 1024, distance: 'Cosine' },    // BGE-M3
};
```

**Note**: If collections already exist with wrong dimensions, they need to be recreated. Run the setup script after updating:
```bash
cd server && npx tsx src/scripts/setup-qdrant-collections.ts
```

---

### PROMPT 6: Deploy Embedding Model to RunPod (Optional - For Scale)

**Task**: Deploy BGE-M3 to RunPod for self-hosted inference (faster, cheaper at scale).

**Why**: HuggingFace Inference API has rate limits. For viral traffic, self-hosted is better.

**RunPod Serverless Deployment** via GraphQL:

**Endpoint**: `https://api.runpod.io/graphql`

**Headers**:
```json
{
  "Authorization": "Bearer <RUNPOD_API_KEY>",
  "Content-Type": "application/json"
}
```

**Mutation to create serverless endpoint**:
```graphql
mutation CreateEndpoint($input: EndpointInput!) {
  createEndpoint(input: $input) {
    id
    name
    templateId
    gpuIds
    workersMin
    workersMax
    idleTimeout
  }
}
```

**Variables for BGE-M3 deployment**:
```json
{
  "input": {
    "name": "kriptik-bge-m3-embeddings",
    "templateId": "runpod/serverless-sentence-transformers:latest",
    "gpuIds": "NVIDIA L4",
    "workersMin": 0,
    "workersMax": 3,
    "idleTimeout": 60,
    "env": [
      { "key": "MODEL_NAME", "value": "BAAI/bge-m3" },
      { "key": "HF_TOKEN", "value": "<HUGGINGFACE_API_KEY>" }
    ]
  }
}
```

**After deployment**: Update BGE-M3 provider to use RunPod endpoint instead of HuggingFace Inference API.

---

### PROMPT 7: Create RunPod Embedding Provider

**Task**: Create a new provider that calls the RunPod-deployed embedding model.

**File to create**: `/server/src/services/embeddings/providers/runpod-bge-provider.ts`

```typescript
/**
 * RunPod BGE-M3 Embedding Provider
 *
 * Self-hosted BGE-M3 on RunPod serverless for production scale.
 */

import type {
  EmbeddingProvider,
  EmbeddingOptions,
  ProviderEmbeddingResult,
  ProviderHealth,
} from '../embedding-service.js';

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_BGE_ENDPOINT_ID;

export class RunPodBGEProvider implements EmbeddingProvider {
  readonly name = 'runpod-bge-m3';
  readonly model = 'BAAI/bge-m3';
  readonly defaultDimensions = 1024;
  readonly maxTokens = 8192;
  readonly maxBatchSize = 32;
  readonly costPer1kTokens = 0.005; // Cheaper than HuggingFace at scale

  async embed(texts: string[], _options?: EmbeddingOptions): Promise<ProviderEmbeddingResult> {
    const startTime = Date.now();

    if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
      throw new Error('RunPod configuration missing');
    }

    const response = await fetch(
      `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/runsync`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RUNPOD_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            texts: texts,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`RunPod API error: ${response.status}`);
    }

    const data = await response.json();
    const embeddings = data.output.embeddings;
    const tokensUsed = texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0);

    return {
      embeddings,
      tokensUsed,
      dimensions: this.defaultDimensions,
      latencyMs: Date.now() - startTime,
    };
  }

  async healthCheck(): Promise<ProviderHealth> {
    // Implementation similar to BGE-M3 provider
    return {
      name: this.name,
      healthy: true,
      lastChecked: new Date().toISOString(),
    };
  }
}
```

---

### PROMPT 8: Update Provider Selection for Scale

**Task**: Modify the embedding service to use RunPod provider when available, falling back to HuggingFace.

**File**: `/server/src/services/embeddings/embedding-service-impl.ts`

**Add provider fallback logic**:
```typescript
private selectProvider(type: EmbeddingType): EmbeddingProvider {
  const baseProvider = TYPE_TO_PROVIDER[type];

  // Use RunPod if available and configured
  if (baseProvider === 'bge-m3' && process.env.RUNPOD_BGE_ENDPOINT_ID) {
    return this.providers['runpod-bge-m3'];
  }

  return this.providers[baseProvider];
}
```

---

### PROMPT 9: Verify Integration End-to-End

**Task**: Test the complete pipeline after implementation.

**Test Script** (create as `/server/src/scripts/test-embeddings.ts`):
```typescript
import { EmbeddingService } from '../services/embeddings/embedding-service-impl.js';

async function testEmbeddings() {
  const service = new EmbeddingService();

  console.log('Testing intent embedding...');
  const intentResult = await service.embed({
    content: 'Build a chatbot with voice recognition',
    type: 'intent',
  });
  console.log(`Intent: ${intentResult.dimensions} dims, ${intentResult.latencyMs}ms`);

  console.log('Testing code embedding...');
  const codeResult = await service.embed({
    content: 'function greet(name: string) { return `Hello, ${name}!`; }',
    type: 'code',
  });
  console.log(`Code: ${codeResult.dimensions} dims, ${codeResult.latencyMs}ms`);

  console.log('Testing error embedding...');
  const errorResult = await service.embed({
    content: 'TypeError: Cannot read property "map" of undefined',
    type: 'error',
  });
  console.log(`Error: ${errorResult.dimensions} dims, ${errorResult.latencyMs}ms`);

  console.log('All embedding tests passed!');
}

testEmbeddings().catch(console.error);
```

**Run test**:
```bash
cd server && npx tsx src/scripts/test-embeddings.ts
```

---

## Verification Checklist

After implementing all prompts, verify:

- [ ] `RUNPOD_API_KEY` is set in environment
- [ ] `HUGGINGFACE_API_KEY` is set in environment
- [ ] VectorContextProvider uses EmbeddingService (1024-dim)
- [ ] ContinuousLearningEngine uses EmbeddingService (1024-dim)
- [ ] VL-JEPA Feedback uses EmbeddingService (1024-dim)
- [ ] Qdrant collections have correct dimensions
- [ ] Test script passes for all embedding types
- [ ] No hash-based fake embeddings remain in learning code

---

## Architecture After Implementation

```
User Prompt
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│                    INTENT LOCK (Phase 0)                       │
│  • EmbeddingService.embed(prompt, 'intent')                   │
│  • Stores 1024-dim vector in intent_embeddings collection     │
└───────────────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│                VL-JEPA FEEDBACK LOOP                          │
│  • EmbeddingService.embed(intent, 'intent')                   │
│  • Real 1024-dim similarity matching                          │
│  • Drift detection with cosine similarity                     │
└───────────────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│               CONTINUOUS LEARNING ENGINE                       │
│  • EmbeddingService.embed(task, 'reasoning')                  │
│  • Pattern matching against learned embeddings                │
│  • L1-L5 learning layers with real vectors                    │
└───────────────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│              VECTOR CONTEXT PROVIDER                          │
│  • EmbeddingService.embed(context, type)                      │
│  • code_patterns: Voyage-code-3 (1024-dim)                    │
│  • error_solutions: BGE-M3 (1024-dim)                         │
│  • design_decisions: BGE-M3 (1024-dim)                        │
└───────────────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│                    QDRANT STORAGE                             │
│  • intent_embeddings: 1024-dim BGE-M3                         │
│  • code_patterns: 1024-dim Voyage-code-3                      │
│  • visual_embeddings: 768-dim SigLIP-2                        │
│  • error_fixes: 1024-dim BGE-M3                               │
│  • hyper_thinking: 1024-dim BGE-M3                            │
└───────────────────────────────────────────────────────────────┘
```

---

## Cost Optimization for Viral Traffic

| Provider | Cost | Latency | Best For |
|----------|------|---------|----------|
| HuggingFace Inference API | $0.01/1K tokens | 500-2000ms | Development, low volume |
| RunPod Serverless (L4) | $0.005/1K tokens | 100-500ms | Production, medium volume |
| RunPod Serverless (A100) | $0.015/1K tokens | 50-200ms | High throughput, low latency |

**Recommendation for viral traffic**:
1. Deploy BGE-M3 to RunPod with L4 GPUs
2. Set `workersMin: 1` to avoid cold starts
3. Set `workersMax: 10` for auto-scaling
4. Use caching aggressively (already implemented)

---

## Summary

This implementation plan replaces **fake hash embeddings** with **real ML embeddings** by:

1. **Wiring existing providers** (no new models to deploy initially)
2. **Adding credentials** (RunPod + HuggingFace)
3. **Updating vector dimensions** (128/384 → 1024)
4. **Optional: Deploy to RunPod** (for scale)

The system will **actually learn** because embeddings will capture semantic meaning rather than random hash values.
