# Component 28: Hosting & Training Infrastructure Evaluation

## Executive Summary

This document evaluates the current training/hosting configuration and proposes a more realistic architecture for production "takeover" scenarios where trained models need to serve high-traffic inference.

---

## Current Configuration Analysis

### Training Pipeline
| Component | Current Choice | Status |
|-----------|----------------|--------|
| Training Framework | Unsloth | Library (no credentials needed) |
| Compute Provider | Modal Labs | Requires `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET` |
| Model Storage | HuggingFace Hub | Requires `HUGGINGFACE_TOKEN` |
| Model Hosting | HuggingFace Inference | **NOT suitable for production** |

### The Problem

1. **HuggingFace Inference API Limitations:**
   - Free tier: ~1,000 requests/hour, cold starts 30-60s
   - Pro tier ($9/mo): Better but still rate-limited
   - Enterprise Inference Endpoints: $0.06-0.60/hour per replica
   - **Not designed for high-traffic, low-latency inference**

2. **Unsloth Adds Complexity Without Clear ROI:**
   - It's an optimization library, not infrastructure
   - Benefits: 2x faster training, 60% less VRAM
   - Drawbacks: External dependency, opaque optimizations
   - Alternative: Use standard `transformers` + `peft` with larger GPUs

---

## Recommended Production Architecture

### Phase 1: Training (Current - Mostly Good)

```
┌─────────────────────────────────────────────┐
│           Training Pipeline                  │
│                                              │
│  Option A: Modal Labs (Serverless GPU)      │
│  - Pay per second, scales to zero            │
│  - Good for sporadic training jobs           │
│  - Supports A10G, A100, H100                 │
│                                              │
│  Option B: RunPod (GPU Rentals)              │
│  - Cheaper for sustained training            │
│  - More GPU selection                        │
│  - Community cloud or secure cloud           │
│                                              │
│  Framework: Standard PyTorch + PEFT          │
│  (Remove Unsloth dependency for simplicity)  │
└─────────────────────────────────────────────┘
```

### Phase 2: Model Storage (Current - Good)

```
┌─────────────────────────────────────────────┐
│          Model Storage                       │
│                                              │
│  HuggingFace Hub: ✓ Good Choice             │
│  - Version control for models                │
│  - LoRA adapter hosting                      │
│  - Model cards and documentation             │
│  - Private repos for proprietary models      │
│  - FREE for storage                          │
└─────────────────────────────────────────────┘
```

### Phase 3: Production Inference (NEEDS CHANGE)

```
┌─────────────────────────────────────────────────────────────────┐
│                Production Inference Options                      │
│                                                                  │
│  Tier 1: Serverless GPU (Best for Variable Traffic)             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Modal Labs Endpoints                                      │  │
│  │  - Auto-scale to zero when idle                           │  │
│  │  - Cold start: 5-15 seconds                               │  │
│  │  - Cost: $0.000306/sec (A10G) to $0.002222/sec (H100)     │  │
│  │  - Best for: 0-1000 req/min with spiky traffic            │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  Replicate                                                 │  │
│  │  - Simpler API, community models                          │  │
│  │  - Cold start: 10-30 seconds                              │  │
│  │  - Cost: Similar to Modal                                 │  │
│  │  - Best for: Quick deployments                            │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  RunPod Serverless                                         │  │
│  │  - Lower costs for sustained inference                    │  │
│  │  - Cold start: 5-20 seconds                               │  │
│  │  - Best for: Cost-sensitive, moderate traffic             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Tier 2: Dedicated GPU (Best for High Traffic)                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Self-Hosted vLLM/TGI Cluster                             │  │
│  │  - No cold starts (always warm)                           │  │
│  │  - Latency: 50-200ms per request                         │  │
│  │  - Cost: $500-2000/mo per GPU                            │  │
│  │  - Best for: 1000+ req/min sustained                     │  │
│  │  - Providers: Lambda Labs, RunPod, Vast.ai               │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  AWS SageMaker / GCP Vertex AI                            │  │
│  │  - Enterprise SLAs                                        │  │
│  │  - Auto-scaling built-in                                  │  │
│  │  - Higher cost, more features                            │  │
│  │  - Best for: Enterprise deployments                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Tier 3: Managed Inference Providers                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Together.ai / Fireworks.ai / Anyscale                    │  │
│  │  - Upload custom models                                   │  │
│  │  - No infrastructure management                          │  │
│  │  - Best for: Focus on product, not infra                 │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cost Comparison for "Takeover" Scenario

Assuming 10,000 requests/day, average 500 tokens/request:

| Provider | Monthly Cost | Cold Start | Best For |
|----------|--------------|------------|----------|
| HuggingFace Free | $0 | 30-60s | Testing only |
| HuggingFace Endpoints | $50-200 | 0s (warm) | Light prod |
| Modal Serverless | $30-100 | 5-15s | Variable traffic |
| RunPod Serverless | $20-80 | 5-20s | Budget-conscious |
| Dedicated A10G | $150-300 | 0s | Sustained traffic |
| Together.ai | $50-150 | 0s | No-ops preference |

---

## Recommended Changes to Component 28

### 1. Remove Hard Unsloth Dependency

**Why:** Adds complexity, doesn't provide unique value for KripTik's use case.

**Replace with:**
```python
# Standard PEFT training (no Unsloth)
from transformers import AutoModelForCausalLM
from peft import get_peft_model, LoraConfig
from trl import DPOTrainer

model = AutoModelForCausalLM.from_pretrained(
    base_model,
    load_in_4bit=True,  # Built-in quantization
    device_map="auto"
)

lora_config = LoraConfig(
    r=64,
    lora_alpha=128,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
)
model = get_peft_model(model, lora_config)
```

### 2. Add Multi-Tier Hosting Configuration

```typescript
interface InferenceHostingConfig {
    // Development/Testing
    development: {
        provider: 'local' | 'huggingface-free';
        coldStartTolerance: 'high';
    };

    // Staging
    staging: {
        provider: 'modal' | 'replicate';
        coldStartTolerance: 'medium';
        maxColdStartMs: 15000;
    };

    // Production (Model Takeover)
    production: {
        provider: 'dedicated-vllm' | 'together' | 'sagemaker';
        coldStartTolerance: 'none';
        minReplicas: 1;
        maxReplicas: 10;
        targetLatencyMs: 200;
    };
}
```

### 3. Add Inference Provider Abstraction

Create unified interface that can swap between providers:

```typescript
interface InferenceProvider {
    name: string;
    deploy(model: TrainedModel): Promise<Endpoint>;
    inference(endpoint: Endpoint, prompt: string): Promise<string>;
    scale(endpoint: Endpoint, replicas: number): Promise<void>;
    destroy(endpoint: Endpoint): Promise<void>;
    getMetrics(endpoint: Endpoint): Promise<InferenceMetrics>;
}

// Implementations
class ModalInferenceProvider implements InferenceProvider { ... }
class VLLMInferenceProvider implements InferenceProvider { ... }
class TogetherInferenceProvider implements InferenceProvider { ... }
class SageMakerInferenceProvider implements InferenceProvider { ... }
```

---

## Environment Variables Summary

### Required for Current Setup
```bash
# Training (Modal Labs)
MODAL_TOKEN_ID=
MODAL_TOKEN_SECRET=

# Model Storage (HuggingFace)
HUGGINGFACE_TOKEN=

# AI Judgment (Claude)
OPENROUTER_API_KEY=
```

### Additional for Production Inference
```bash
# Option 1: Dedicated vLLM
VLLM_CLUSTER_URL=
VLLM_API_KEY=

# Option 2: Together.ai
TOGETHER_API_KEY=

# Option 3: AWS SageMaker
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=

# Option 4: RunPod
RUNPOD_API_KEY=
```

---

## Recommended Implementation Path

### Immediate (No New Credentials)
1. Keep Modal for training (already configured)
2. Use HuggingFace Hub for model storage only
3. Add Modal inference endpoints for staging

### When Traffic Increases (Production)
1. Deploy vLLM cluster on dedicated GPU
2. Or use Together.ai/Fireworks.ai for managed inference
3. Keep HuggingFace as model registry only

### Enterprise Scale
1. AWS SageMaker or GCP Vertex AI
2. Multi-region deployment
3. Auto-scaling based on traffic patterns

---

## Conclusion

**Key Takeaways:**

1. **Unsloth is optional** - Standard PyTorch/PEFT works fine and is simpler
2. **HuggingFace is NOT suitable for production inference** - Use it for storage only
3. **Modal is good for training AND staging inference** - Already integrated
4. **Production "takeover" needs dedicated infrastructure** - vLLM, Together.ai, or SageMaker

The current architecture is reasonable for development and small-scale testing. For production model takeover, you'll need to add a dedicated inference provider layer.
